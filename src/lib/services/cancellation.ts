import type {
  AccountHealth,
  AppliedPenalty,
  Booking,
  CancellationReasonKey,
  Charter,
  Database,
  ListingSuspension,
  PenaltyImpact,
  SuspensionReasonKey,
} from '@/lib/domain/types';

/**
 * Cancellation reasons and what they cost.
 *
 * The refund calculation is the easy half. The half that actually shapes
 * operator behaviour is the *penalty assessment*: the platform tells an
 * operator, before they confirm, exactly what cancelling will do to their
 * ranking, their calendar, their Instant Book status and their public reviews.
 *
 * The distinction that matters is **avoidable versus not**. A cancellation
 * caused by weather or a genuine emergency costs nothing — punishing it would
 * push operators to run trips in unsafe conditions, which is the opposite of
 * what the rules are for. A double-booking, by contrast, is a calendar the
 * operator did not keep, and it is treated as such.
 */

export interface CancellationReason {
  key: CancellationReasonKey;
  /** Who is offered this reason. */
  actor: 'customer' | 'owner' | 'both';
  label: string;
  /** Groups reasons under a heading in the picker. */
  group: string;
  /**
   * Penalty-free reasons are outside the operator's control. They still cancel
   * the trip; they just do not count against the listing.
   */
  penaltyFree?: boolean;
  /** Needs a human to decide the refund rather than the policy engine. */
  supportReview?: boolean;
  /** Feeds the account-health signal of this name. */
  healthSignal?: 'boat_malfunction' | 'realization' | 'double_booking';
  /** Prompts the operator for extra context, matching the real product. */
  followUp?: string;
}

export const cancellationReasons: CancellationReason[] = [
  // --- Customer ------------------------------------------------------------
  { key: 'plans_changed', actor: 'customer', group: 'Can’t go on a boat trip', label: 'My plans have changed' },
  { key: 'could_not_attend', actor: 'customer', group: 'Can’t go on a boat trip', label: 'I couldn’t attend' },
  {
    key: 'found_better_deal_here',
    actor: 'customer',
    group: 'I found a better deal',
    label: 'I found a better deal on the platform',
  },
  {
    key: 'found_better_deal_elsewhere',
    actor: 'customer',
    group: 'I found a better deal',
    label: 'I found a better deal on another website',
  },
  {
    key: 'operator_offered_lower_rate',
    actor: 'customer',
    group: 'I found a better deal',
    label: 'The operator offered me a lower rate',
    // This is an off-platform booking attempt wearing a cancellation's coat.
    healthSignal: 'realization',
    supportReview: true,
  },
  {
    key: 'need_to_change_details',
    actor: 'customer',
    group: 'I need to change details',
    label: 'Trip date, group size or departure time',
    followUp: 'Would a booking change work instead of cancelling?',
  },
  {
    key: 'operator_needs_to_cancel',
    actor: 'customer',
    group: 'Something went wrong',
    label: 'My operator needs to cancel',
    penaltyFree: true,
    supportReview: true,
  },
  {
    key: 'operator_no_show',
    actor: 'customer',
    group: 'Something went wrong',
    label: 'The operator didn’t show up',
    supportReview: true,
    healthSignal: 'realization',
  },

  // --- Operator ------------------------------------------------------------
  {
    key: 'bad_weather',
    actor: 'owner',
    group: 'Conditions',
    label: 'Bad weather conditions',
    penaltyFree: true,
  },
  {
    key: 'boat_malfunction',
    actor: 'owner',
    group: 'The boat',
    label: 'Boat malfunction',
    healthSignal: 'boat_malfunction',
    followUp: 'How long will your boat be down for? Should we snooze your listing?',
  },
  { key: 'boat_out_of_water', actor: 'owner', group: 'The boat', label: 'Boat out of the water', healthSignal: 'boat_malfunction' },
  {
    key: 'already_booked',
    actor: 'owner',
    group: 'The calendar',
    label: 'Already booked on that date',
    // The canonical avoidable cancellation: the calendar was not kept.
    healthSignal: 'double_booking',
  },
  {
    key: 'not_enough_people',
    actor: 'owner',
    group: 'The trip',
    label: 'Not enough people for the trip (shared trip)',
    penaltyFree: true,
  },
  { key: 'customer_wants_to_cancel', actor: 'owner', group: 'The customer', label: 'Customer called or emailed to cancel' },
  { key: 'customer_no_show', actor: 'owner', group: 'The customer', label: 'The customer didn’t show up', supportReview: true },
  { key: 'activity_unavailable', actor: 'owner', group: 'The trip', label: 'Requested activity is not available', penaltyFree: true },
  { key: 'wrong_price', actor: 'owner', group: 'The listing', label: 'The trip price is incorrect', followUp: 'What should the correct price be?' },
  { key: 'want_to_unlist', actor: 'owner', group: 'The listing', label: 'I want to unlist', healthSignal: 'realization' },
  { key: 'moving_location', actor: 'owner', group: 'The listing', label: 'I am moving to another location', followUp: 'Where is the new location?' },
  { key: 'capacity_too_high', actor: 'owner', group: 'The trip', label: 'I can’t accommodate this capacity' },

  // --- Either --------------------------------------------------------------
  {
    key: 'extenuating_circumstances',
    actor: 'both',
    group: 'Something went wrong',
    label: 'Extenuating circumstances',
    penaltyFree: true,
    supportReview: true,
  },
  { key: 'other', actor: 'both', group: 'Other', label: 'Other' },
];

export function reasonsFor(actor: 'customer' | 'owner'): CancellationReason[] {
  return cancellationReasons.filter((r) => r.actor === actor || r.actor === 'both');
}

export function findReason(key: CancellationReasonKey): CancellationReason | undefined {
  return cancellationReasons.find((r) => r.key === key);
}

/** Four double-bookings in a year costs the operator Instant Book. */
export const INSTANT_BOOK_STRIKE_LIMIT = 4;

/** Below this realization rate, new bookings get capped. */
export const REALIZATION_FLOOR = 0.9;

/** Boat-malfunction cancellations before the listing is throttled. */
export const MALFUNCTION_LIMIT = 3;

export interface PenaltyAssessment {
  penalties: AppliedPenalty[];
  /** The worst impact among them — what the summary line shows. */
  impact: PenaltyImpact;
  penaltyFree: boolean;
  supportReview: boolean;
  /** Set when this cancellation trips a throttle. */
  suspension?: ListingSuspension;
}

/**
 * Works out the consequences of a cancellation *without applying them*.
 *
 * Separated from `applyPenalties` so the confirmation screen can show the
 * operator exactly what will happen before they commit — which is the whole
 * point of the feature, and impossible if assessment and mutation are the same
 * call.
 */
export function assessCancellation(
  db: Database,
  booking: Booking,
  reasonKey: CancellationReasonKey,
  initiatedBy: 'customer' | 'owner' | 'system',
): PenaltyAssessment {
  const reason = findReason(reasonKey);
  const penalties: AppliedPenalty[] = [];

  // A guest cancelling never penalises the operator, whatever their reason —
  // except where the reason names the operator as the cause, which routes to
  // support rather than applying automatically.
  if (initiatedBy === 'customer') {
    const free = !reason?.healthSignal;
    return {
      penalties: free ? [] : [{ key: 'rank_drop', impact: 'low' }],
      impact: free ? 'none' : 'low',
      penaltyFree: free,
      supportReview: Boolean(reason?.supportReview),
    };
  }

  if (reason?.penaltyFree) {
    // The date still has to be dealt with: weather cancellations keep the slot
    // blocked, because the weather has not improved for the next guest either.
    penalties.push({
      key: reasonKey === 'bad_weather' ? 'calendar_blocked' : 'calendar_opened',
      impact: 'none',
    });
    penalties.push({ key: 'refund_customer', impact: 'none' });
    return {
      penalties,
      impact: 'none',
      penaltyFree: true,
      supportReview: Boolean(reason.supportReview),
    };
  }

  const health = db.accountHealth.find((h) => h.ownerId === booking.ownerId);
  const doubleBooking = reason?.healthSignal === 'double_booking';

  penalties.push({ key: 'refund_customer', impact: 'none' });
  penalties.push({ key: 'rank_drop', impact: doubleBooking ? 'high' : 'medium' });
  penalties.push({ key: 'automatic_cancel_review', impact: 'medium' });

  if (doubleBooking) {
    // The slot stays blocked: it is genuinely sold, just to someone else.
    penalties.push({ key: 'calendar_blocked', impact: 'none' });

    const strikes = (health?.instantBookStrikes ?? 0) + 1;
    if (strikes >= INSTANT_BOOK_STRIKE_LIMIT) {
      penalties.push({ key: 'instant_book_lost', impact: 'very_high' });
    } else {
      penalties.push({ key: 'instant_book_warning', impact: 'high' });
    }
  } else {
    penalties.push({ key: 'calendar_opened', impact: 'none' });
  }

  const suspension = projectSuspension(db, booking, reasonKey, health);
  if (suspension) penalties.push({ key: 'rank_drop', impact: 'very_high' });

  return {
    penalties,
    impact: worstImpact(penalties),
    penaltyFree: false,
    supportReview: Boolean(reason?.supportReview),
    suspension,
  };
}

const IMPACT_ORDER: PenaltyImpact[] = ['none', 'low', 'medium', 'high', 'very_high'];

function worstImpact(penalties: AppliedPenalty[]): PenaltyImpact {
  return penalties.reduce<PenaltyImpact>(
    (worst, p) => (IMPACT_ORDER.indexOf(p.impact) > IMPACT_ORDER.indexOf(worst) ? p.impact : worst),
    'none',
  );
}

/**
 * Would this cancellation trip a throttle?
 *
 * The platform caps new bookings before it pauses a listing outright, so an
 * operator having a bad month gets a warning and a limit rather than being
 * switched off without notice.
 */
function projectSuspension(
  db: Database,
  booking: Booking,
  reasonKey: CancellationReasonKey,
  health: AccountHealth | undefined,
): ListingSuspension | undefined {
  if (!health) return undefined;
  const reason = findReason(reasonKey);
  const now = new Date().toISOString();

  const make = (
    suspensionReason: SuspensionReasonKey,
    current: number,
    limit: number,
  ): ListingSuspension => ({
    charterId: booking.charterId,
    reason: suspensionReason,
    // Repeat offences escalate from a cap to an outright pause.
    mode: current > limit ? 'paused' : 'booking_limit',
    current,
    limit,
    createdAt: now,
  });

  if (reason?.healthSignal === 'boat_malfunction') {
    const count = health.boatMalfunctionCancellations + 1;
    if (count >= MALFUNCTION_LIMIT) return make('boat_malfunction', count, MALFUNCTION_LIMIT);
  }

  // A realization rate is only meaningful over a reasonable number of trips.
  const ownerBookings = db.bookings.filter((b) => b.ownerId === booking.ownerId);
  if (ownerBookings.length >= 10) {
    const cancelledByOwner = ownerBookings.filter(
      (b) => b.cancellation?.initiatedBy === 'owner',
    ).length;
    const projected = 1 - (cancelledByOwner + 1) / ownerBookings.length;
    if (projected < REALIZATION_FLOOR) {
      return make('low_realization_rate', Math.round(projected * 100), Math.round(REALIZATION_FLOOR * 100));
    }
  }

  return undefined;
}

/**
 * Commits an assessment to the operator's account health.
 *
 * Called only after the cancellation itself succeeds, so a failed cancellation
 * never leaves a penalty behind.
 */
export function applyPenalties(
  db: Database,
  booking: Booking,
  assessment: PenaltyAssessment,
  reasonKey: CancellationReasonKey,
): void {
  if (assessment.penaltyFree) return;

  const health = db.accountHealth.find((h) => h.ownerId === booking.ownerId);
  if (!health) return;

  const reason = findReason(reasonKey);
  const now = new Date().toISOString();

  if (reason?.healthSignal === 'double_booking') {
    health.instantBookStrikes += 1;

    if (health.instantBookStrikes >= INSTANT_BOOK_STRIKE_LIMIT) {
      // Instant Book comes off every listing this operator runs, not just the
      // one that was double-booked — the calendar discipline is account-wide.
      for (const charter of db.charters.filter((c) => c.ownerId === booking.ownerId)) {
        charter.policies.isInstantBookActive = false;
      }
    }
  }

  if (reason?.healthSignal === 'boat_malfunction') {
    health.boatMalfunctionCancellations += 1;
  }

  const ownerBookings = db.bookings.filter((b) => b.ownerId === booking.ownerId);
  const cancelledByOwner = ownerBookings.filter((b) => b.cancellation?.initiatedBy === 'owner').length;
  health.realizationRate = ownerBookings.length
    ? Math.max(0, 1 - cancelledByOwner / ownerBookings.length)
    : 1;

  if (assessment.suspension) {
    health.suspensions.push(assessment.suspension);
    if (assessment.suspension.mode === 'booking_limit') {
      health.bookingLimit = assessment.suspension.limit ?? null;
      health.bookingsSinceLimit = 0;
    } else {
      // A paused listing stops taking bookings until support lifts it.
      const charter = db.charters.find((c) => c.id === booking.charterId);
      if (charter) charter.snoozed = true;
    }
  }

  health.updatedAt = now;
}

/** Human copy for a penalty, so the client never maps the enum itself. */
export function penaltyCopy(key: AppliedPenalty['key']): { title: string; body: string } {
  const map: Record<AppliedPenalty['key'], { title: string; body: string }> = {
    rank_drop: {
      title: 'We’ll temporarily decrease your ranking',
      body: 'Your reliability score has dropped because this cancellation could have been avoided by keeping your calendar up to date.',
    },
    calendar_blocked: {
      title: 'We’ll keep your calendar blocked for this time slot',
      body: 'This prevents other customers from booking the same time slot.',
    },
    calendar_opened: {
      title: 'We’ll make your calendar available for this date',
      body: 'This allows other customers to book this date.',
    },
    automatic_cancel_review: {
      title: 'You’ll receive an automatic cancellation review',
      body: 'This is posted on your listing but does not affect your star rating.',
    },
    instant_book_warning: {
      title: 'You may lose your Instant Book feature',
      body: 'You’ll lose Instant Book after four double bookings in a year.',
    },
    instant_book_lost: {
      title: 'You’ve lost the Instant Book feature',
      body: 'Instant Book has been deactivated on your listings for one year.',
    },
    refund_customer: {
      title: 'We’ll refund the customer',
      body: 'According to our policies, the customer receives a refund.',
    },
    operator_keeps_deposit: {
      title: 'You will keep the deposit',
      body: 'The customer breached the cancellation policy, so the deposit stays with you.',
    },
  };
  return map[key];
}

export function impactCopy(impact: PenaltyImpact): string {
  const map: Record<PenaltyImpact, string> = {
    none: 'No impact on ranking',
    low: 'Low impact on ranking',
    medium: 'Medium impact on ranking',
    high: 'High impact on ranking',
    very_high: 'Very high impact on ranking',
  };
  return map[impact];
}

/**
 * Whether a listing can currently take a new booking.
 *
 * Checked at booking time so a throttled listing stops selling without needing
 * to be unpublished — the operator keeps their page, their reviews and their
 * search presence while they fix the underlying problem.
 */
export function bookingAllowed(
  db: Database,
  charter: Charter,
): { allowed: true } | { allowed: false; reason: SuspensionReasonKey; mode: 'booking_limit' | 'paused' } {
  const health = db.accountHealth.find((h) => h.ownerId === charter.ownerId);
  if (!health) return { allowed: true };

  const active = health.suspensions.filter((s) => s.charterId === charter.id && !s.liftedAt);
  const paused = active.find((s) => s.mode === 'paused');
  if (paused) return { allowed: false, reason: paused.reason, mode: 'paused' };

  const capped = active.find((s) => s.mode === 'booking_limit');
  if (capped && health.bookingLimit !== null && health.bookingsSinceLimit >= health.bookingLimit) {
    return { allowed: false, reason: capped.reason, mode: 'booking_limit' };
  }

  return { allowed: true };
}
