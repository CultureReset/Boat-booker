import { addDays, today } from '@/lib/core/dates';
import { newId } from '@/lib/core/ids';
import { AWARD_THRESHOLDS } from '@/lib/domain/types';
import type { AwardState, Charter, Database, ExternalCalendar, User } from '@/lib/domain/types';

/**
 * Operator performance.
 *
 * The metrics that matter are ratios, not counts — an operator with 40 bookings
 * and 400 enquiries is doing worse than one with 10 and 12 — so every headline
 * figure here is a rate, with the raw numbers underneath it as evidence.
 *
 * Year-on-year comparison is the other half. A booking count in isolation tells
 * an operator nothing about whether their season is going well; the same count
 * against last year tells them everything.
 */

export type Period = 'last_4_weeks' | 'last_12_months' | 'this_year';

export interface Metric {
  key: string;
  value: number;
  /** Formatted by the caller; this says which shape it is. */
  kind: 'count' | 'percent' | 'rating' | 'money';
  /** Same metric a year earlier, when there is enough history to compare. */
  previous?: number;
  /** Positive means better, and "better" is not always "larger". */
  changePercent?: number;
}

export interface PerformanceReport {
  period: Period;
  from: string;
  to: string;
  charterId: string | null;
  metrics: Metric[];
  /** True when there is too little data to say anything honest. */
  sparse: boolean;
  award: AwardState;
}

function windowFor(period: Period): { from: string; to: string } {
  const to = today();
  if (period === 'last_4_weeks') return { from: addDays(to, -28), to };
  if (period === 'this_year') return { from: `${to.slice(0, 4)}-01-01`, to };
  return { from: addDays(to, -365), to };
}

/** The same window, one year earlier. */
function priorWindow(window: { from: string; to: string }): { from: string; to: string } {
  const shift = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  return { from: shift(window.from), to: shift(window.to) };
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Change as a percentage, guarding the zero-baseline case.
 *
 * Going from 0 to 5 is not "infinite growth"; it is new activity, and reporting
 * it as a percentage would be noise. Returns undefined instead.
 */
function change(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

interface Slice {
  views: number;
  requests: number;
  bookings: number;
  completed: number;
  cancelledByOwner: number;
  respondedInTime: number;
  earnings: number;
  reviewCount: number;
  ratingSum: number;
}

function sliceFor(
  db: Database,
  ownerId: string,
  charterId: string | null,
  window: { from: string; to: string },
): Slice {
  const charters = db.charters.filter(
    (c) => c.ownerId === ownerId && (!charterId || c.id === charterId),
  );
  const charterIds = new Set(charters.map((c) => c.id));

  const bookings = db.bookings.filter(
    (b) =>
      charterIds.has(b.charterId) &&
      b.createdAt.slice(0, 10) >= window.from &&
      b.createdAt.slice(0, 10) <= window.to,
  );

  const reviews = db.reviews.filter(
    (r) =>
      charterIds.has(r.charterId) &&
      r.createdAt.slice(0, 10) >= window.from &&
      r.createdAt.slice(0, 10) <= window.to,
  );

  const completed = bookings.filter((b) => b.status === 'done');

  return {
    // Views are a rolling counter on the listing rather than an event log, so
    // they are apportioned across the window rather than filtered by date.
    views: charters.reduce((sum, c) => sum + c.viewsLast7Days, 0) * (daysIn(window) / 7),
    requests: bookings.length,
    bookings: bookings.filter((b) => b.status !== 'declined' && b.status !== 'withdrawn').length,
    completed: completed.length,
    cancelledByOwner: bookings.filter((b) => b.cancellation?.initiatedBy === 'owner').length,
    // A request answered at all counts; the window is enforced at accept time.
    respondedInTime: bookings.filter((b) => b.status !== 'pending' && b.status !== 'request').length,
    earnings: completed.reduce((sum, b) => sum + b.breakdown.total, 0),
    reviewCount: reviews.length,
    ratingSum: reviews.reduce((sum, r) => sum + r.rating, 0),
  };
}

function daysIn(window: { from: string; to: string }): number {
  return Math.max(
    1,
    Math.round((Date.parse(window.to) - Date.parse(window.from)) / 86_400_000),
  );
}

export function performanceFor(
  db: Database,
  ownerId: string,
  options: { period?: Period; charterId?: string | null } = {},
): PerformanceReport {
  const period = options.period ?? 'last_4_weeks';
  const charterId = options.charterId ?? null;

  const window = windowFor(period);
  const current = sliceFor(db, ownerId, charterId, window);
  const previous = sliceFor(db, ownerId, charterId, priorWindow(window));

  const metric = (
    key: string,
    kind: Metric['kind'],
    value: number,
    prior: number,
  ): Metric => ({
    key,
    kind,
    value,
    previous: prior,
    changePercent: change(value, prior),
  });

  const metrics: Metric[] = [
    metric('totalViews', 'count', Math.round(current.views), Math.round(previous.views)),
    metric('requests', 'count', current.requests, previous.requests),
    metric('bookings', 'count', current.bookings, previous.bookings),
    metric(
      'conversionRate',
      'percent',
      ratio(current.requests, current.views),
      ratio(previous.requests, previous.views),
    ),
    metric(
      'realizationRate',
      'percent',
      // Cancellations the operator caused are the only ones counted against
      // them; weather and extenuating circumstances are excluded upstream.
      ratio(current.bookings - current.cancelledByOwner, Math.max(1, current.bookings)),
      ratio(previous.bookings - previous.cancelledByOwner, Math.max(1, previous.bookings)),
    ),
    metric(
      'responseRate',
      'percent',
      ratio(current.respondedInTime, Math.max(1, current.requests)),
      ratio(previous.respondedInTime, Math.max(1, previous.requests)),
    ),
    metric(
      'overallRating',
      'rating',
      ratio(current.ratingSum, current.reviewCount),
      ratio(previous.ratingSum, previous.reviewCount),
    ),
    metric('verifiedReviews', 'count', current.reviewCount, previous.reviewCount),
    metric('earnings', 'money', current.earnings, previous.earnings),
  ];

  return {
    period,
    from: window.from,
    to: window.to,
    charterId,
    metrics,
    // Below a handful of bookings, every ratio is noise dressed as a signal.
    sparse: current.requests < 3,
    award: awardStateFor(db, ownerId),
  };
}

/* ------------------------------------------------------------------- award */

/**
 * Boaters' Choice progress.
 *
 * Measured over a trailing twelve months and released quarterly, so this
 * reports live measurements against the published thresholds rather than
 * whatever was true at the last assessment.
 */
export function awardStateFor(db: Database, ownerId: string): AwardState {
  const window = { from: addDays(today(), -365), to: today() };
  const slice = sliceFor(db, ownerId, null, window);

  const charters = db.charters.filter((c) => c.ownerId === ownerId);
  const owner = db.users.find((u) => u.id === ownerId);

  const averageReviewScore = ratio(slice.ratingSum, slice.reviewCount);
  const reliabilityScore = ratio(
    slice.bookings - slice.cancelledByOwner,
    Math.max(1, slice.bookings),
  );
  const responseRate = ratio(slice.respondedInTime, Math.max(1, slice.requests));
  const fullyVerified =
    charters.length > 0 && owner?.ownerProfile?.verification.status === 'verified';

  const meetsAll =
    averageReviewScore >= AWARD_THRESHOLDS.averageReviewScore &&
    slice.reviewCount >= AWARD_THRESHOLDS.verifiedReviewCount &&
    reliabilityScore >= AWARD_THRESHOLDS.reliabilityScore &&
    responseRate >= AWARD_THRESHOLDS.responseRate &&
    fullyVerified;

  return {
    hasAward: meetsAll,
    awardedYear: meetsAll ? new Date().getUTCFullYear() : undefined,
    assessedAt: new Date().toISOString(),
    averageReviewScore,
    verifiedReviewCount: slice.reviewCount,
    reliabilityScore,
    responseRate,
    fullyVerified,
  };
}

/** Award criteria as rows the UI can render without knowing the thresholds. */
export function awardCriteria(state: AwardState) {
  return [
    {
      key: 'criterionReviewScore',
      value: state.averageReviewScore,
      target: AWARD_THRESHOLDS.averageReviewScore,
      kind: 'rating' as const,
      met: state.averageReviewScore >= AWARD_THRESHOLDS.averageReviewScore,
    },
    {
      key: 'criterionReviewCount',
      value: state.verifiedReviewCount,
      target: AWARD_THRESHOLDS.verifiedReviewCount,
      kind: 'count' as const,
      met: state.verifiedReviewCount >= AWARD_THRESHOLDS.verifiedReviewCount,
    },
    {
      key: 'criterionReliability',
      value: state.reliabilityScore,
      target: AWARD_THRESHOLDS.reliabilityScore,
      kind: 'percent' as const,
      met: state.reliabilityScore >= AWARD_THRESHOLDS.reliabilityScore,
    },
    {
      key: 'criterionResponse',
      value: state.responseRate,
      target: AWARD_THRESHOLDS.responseRate,
      kind: 'percent' as const,
      met: state.responseRate >= AWARD_THRESHOLDS.responseRate,
    },
    {
      key: 'criterionVerified',
      value: state.fullyVerified ? 1 : 0,
      target: 1,
      kind: 'boolean' as const,
      met: state.fullyVerified,
    },
  ];
}

/* -------------------------------------------------------- calendar sync */

export class CalendarError extends Error {
  constructor(readonly code: 'not_found' | 'forbidden' | 'invalid', message: string) {
    super(message);
    this.name = 'CalendarError';
  }
}

/**
 * Connects an external iCal feed.
 *
 * Read-only by design: the platform imports busy dates and never writes back.
 * A two-way sync would mean the platform could delete an operator's personal
 * appointments, which is not a power a booking site should hold.
 */
export function addExternalCalendar(
  db: Database,
  ownerId: string,
  input: { charterId: string; name: string; url: string },
): ExternalCalendar {
  const charter = db.charters.find((c) => c.id === input.charterId && c.ownerId === ownerId);
  if (!charter) throw new CalendarError('not_found', 'Listing not found');

  const name = input.name.trim();
  const url = input.url.trim();
  if (name.length < 2) throw new CalendarError('invalid', 'Name your calendar');
  if (!/^https?:\/\/\S+/.test(url)) throw new CalendarError('invalid', 'Paste the calendar’s URL');

  const provider: ExternalCalendar['provider'] = url.includes('google')
    ? 'google'
    : url.includes('icloud')
      ? 'icloud'
      : 'other';

  const calendar: ExternalCalendar = {
    id: newId(),
    ownerId,
    charterId: charter.id,
    name: name.slice(0, 80),
    url,
    provider,
  };

  db.externalCalendars.push(calendar);
  return calendar;
}

export function removeExternalCalendar(db: Database, id: string, ownerId: string): void {
  const calendar = db.externalCalendars.find((c) => c.id === id);
  if (!calendar) throw new CalendarError('not_found', 'Calendar not found');
  if (calendar.ownerId !== ownerId) throw new CalendarError('forbidden', 'Not your calendar');
  db.externalCalendars = db.externalCalendars.filter((c) => c.id !== id);
}

/**
 * Links listings that share a hull.
 *
 * The link is symmetric and lives once rather than as a field on each listing,
 * so it cannot end up half-applied — a one-directional link is worse than none,
 * because it looks protected and is not.
 */
export function linkCalendars(db: Database, ownerId: string, charterIds: string[]): void {
  const owned = db.charters.filter((c) => c.ownerId === ownerId && charterIds.includes(c.id));
  if (owned.length < 2) throw new CalendarError('invalid', 'Select at least two of your listings');

  const ids = owned.map((c) => c.id).sort();

  // Merge into any existing link that overlaps, rather than creating a second
  // link that describes the same hull.
  const existing = db.calendarLinks.find(
    (link) => link.ownerId === ownerId && link.charterIds.some((id) => ids.includes(id)),
  );

  if (existing) {
    existing.charterIds = [...new Set([...existing.charterIds, ...ids])].sort();
    return;
  }

  db.calendarLinks.push({
    id: newId(),
    ownerId,
    charterIds: ids,
    createdAt: new Date().toISOString(),
  });
}

export function unlinkCalendars(db: Database, ownerId: string, linkId: string): void {
  const link = db.calendarLinks.find((l) => l.id === linkId);
  if (!link) throw new CalendarError('not_found', 'Link not found');
  if (link.ownerId !== ownerId) throw new CalendarError('forbidden', 'Not your link');
  db.calendarLinks = db.calendarLinks.filter((l) => l.id !== linkId);
}

/** Every listing an owner runs, for the link picker. */
export function linkableListings(db: Database, ownerId: string): Charter[] {
  return db.charters.filter((c) => c.ownerId === ownerId);
}

export function ownerOf(db: Database, ownerId: string): User | undefined {
  return db.users.find((u) => u.id === ownerId);
}
