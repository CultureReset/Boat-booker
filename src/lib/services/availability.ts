import { addDays, isPast, today, weekdayMaskAllows, type IsoDate } from '@/lib/core/dates';
import type { AvailabilityBlock, Booking, Charter, Database, TripPackage } from '@/lib/domain/types';

/**
 * Availability resolution.
 *
 * A trip is bookable on a date when all of these hold:
 *   1. the date is not in the past,
 *   2. the package runs on that weekday and is inside its season,
 *   3. the owner has not blocked the date,
 *   4. the boat is not already booked that day (one trip per boat per day),
 *   5. the group fits the package's capacity and minimum.
 *
 * Every surface that asks "can I book this?" — search, the listing page, the
 * calendar, checkout — resolves through this module, so the answer is the same
 * everywhere and a race at checkout is caught by the same rule that hid the
 * date in search.
 */

export interface AvailabilityQuery {
  charterId: string;
  date?: IsoDate;
  adults?: number;
  children?: number;
  days?: number;
}

export interface PackageAvailability {
  packageId: string;
  available: boolean;
  /** Machine-readable reason, mapped to a catalog string by the UI. */
  reason?:
    | 'past_date'
    | 'weekday_closed'
    | 'out_of_season'
    | 'blocked'
    | 'booked'
    | 'capacity_exceeded'
    | 'min_persons'
    | 'min_days'
    | 'inactive';
  /** How many more guests are needed to meet the minimum. */
  needsMorePersons?: number;
  departureTimes: string[];
}

/** Index the blocking records once so per-date checks stay O(1). */
export function buildBlockIndex(db: Database) {
  const byCharterDate = new Map<string, AvailabilityBlock[]>();
  for (const block of db.availability) {
    const key = `${block.charterId}:${block.date}`;
    const list = byCharterDate.get(key);
    if (list) list.push(block);
    else byCharterDate.set(key, [block]);
  }
  return byCharterDate;
}

export type BlockIndex = ReturnType<typeof buildBlockIndex>;

function isBlocked(index: BlockIndex, charterId: string, date: IsoDate): boolean {
  return (index.get(`${charterId}:${date}`)?.length ?? 0) > 0;
}

export function packageAvailability(input: {
  pkg: TripPackage;
  date?: IsoDate;
  guests: number;
  days: number;
  blockIndex: BlockIndex;
}): PackageAvailability {
  const { pkg, date, guests, days, blockIndex } = input;
  const base: PackageAvailability = {
    packageId: pkg.id,
    available: true,
    departureTimes: pkg.departureTimes,
  };

  if (!pkg.active) return { ...base, available: false, reason: 'inactive' };

  if (guests > pkg.capacity) {
    return { ...base, available: false, reason: 'capacity_exceeded' };
  }

  if (guests > 0 && guests < pkg.minPersons) {
    return {
      ...base,
      available: false,
      reason: 'min_persons',
      needsMorePersons: pkg.minPersons - guests,
    };
  }

  if (pkg.minDays && days < pkg.minDays) {
    return { ...base, available: false, reason: 'min_days' };
  }

  // With no date selected we report on group fit only — this is what the
  // search page shows before the user picks a day.
  if (!date) return base;

  if (isPast(date)) return { ...base, available: false, reason: 'past_date' };

  if (!weekdayMaskAllows(pkg.weekdayMask, date)) {
    return { ...base, available: false, reason: 'weekday_closed' };
  }

  if (pkg.seasonStart && pkg.seasonEnd && (date < pkg.seasonStart || date > pkg.seasonEnd)) {
    return { ...base, available: false, reason: 'out_of_season' };
  }

  // Multi-day trips need every day in the span free.
  for (let offset = 0; offset < Math.max(1, days); offset += 1) {
    const day = addDays(date, offset);
    if (isBlocked(blockIndex, pkg.charterId, day)) {
      const blocks = blockIndex.get(`${pkg.charterId}:${day}`) ?? [];
      const reason = blocks.some((b) => b.reason === 'booking') ? 'booked' : 'blocked';
      return { ...base, available: false, reason };
    }
  }

  return base;
}

/** Availability for every package on a listing. */
export function charterAvailability(input: {
  charter: Charter;
  packages: TripPackage[];
  date?: IsoDate;
  guests: number;
  days: number;
  blockIndex: BlockIndex;
}): { available: boolean; packages: PackageAvailability[] } {
  const results = input.packages.map((pkg) =>
    packageAvailability({
      pkg,
      date: input.date,
      guests: input.guests,
      days: input.days,
      blockIndex: input.blockIndex,
    }),
  );
  return { available: results.some((r) => r.available), packages: results };
}

/**
 * Next dates a listing can actually be booked, used by the "next available
 * dates" prompt when the requested day is taken.
 */
export function nextAvailableDates(input: {
  packages: TripPackage[];
  from: IsoDate;
  guests: number;
  days: number;
  blockIndex: BlockIndex;
  limit?: number;
  horizon?: number;
}): IsoDate[] {
  const { packages, from, guests, days, blockIndex, limit = 3, horizon = 90 } = input;
  const out: IsoDate[] = [];

  for (let offset = 1; offset <= horizon && out.length < limit; offset += 1) {
    const date = addDays(from, offset);
    const anyAvailable = packages.some(
      (pkg) => packageAvailability({ pkg, date, guests, days, blockIndex }).available,
    );
    if (anyAvailable) out.push(date);
  }

  return out;
}

/**
 * Day-by-day calendar state for one listing. Drives the listing page date
 * picker and the owner calendar.
 */
export interface CalendarDay {
  date: IsoDate;
  state: 'available' | 'blocked' | 'booked' | 'closed' | 'past';
  bookingId?: string;
  note?: string;
}

export function calendarForCharter(input: {
  charterId: string;
  packages: TripPackage[];
  db: Database;
  from: IsoDate;
  days: number;
  guests?: number;
}): CalendarDay[] {
  const { charterId, packages, db, from, days, guests = 0 } = input;
  const blockIndex = buildBlockIndex(db);
  const out: CalendarDay[] = [];
  const start = today();

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);

    if (date < start) {
      out.push({ date, state: 'past' });
      continue;
    }

    const blocks = blockIndex.get(`${charterId}:${date}`) ?? [];
    const booking = blocks.find((b) => b.reason === 'booking');
    if (booking) {
      out.push({ date, state: 'booked', bookingId: booking.bookingId });
      continue;
    }
    const manual = blocks.find((b) => b.reason === 'manual');
    if (manual) {
      out.push({ date, state: 'blocked', note: manual.note });
      continue;
    }

    const anyRuns = packages.some(
      (pkg) => packageAvailability({ pkg, date, guests, days: 1, blockIndex }).available,
    );
    out.push({ date, state: anyRuns ? 'available' : 'closed' });
  }

  return out;
}

/**
 * Reserve the days a booking consumes. Returns false when the dates were taken
 * between quoting and confirming, which is the checkout race guard.
 */
export function reserveDates(db: Database, booking: Booking, idFactory: () => string): boolean {
  const index = buildBlockIndex(db);
  const span = Math.max(1, booking.days);

  // Listings that share a hull block together. Checking the linked ones before
  // writing anything is what stops one boat being sold twice under two names.
  const linked = linkedCharterIds(db, booking.charterId);
  const affected = [booking.charterId, ...linked];

  for (let offset = 0; offset < span; offset += 1) {
    const date = addDays(booking.date, offset);
    for (const charterId of affected) {
      if (isBlocked(index, charterId, date)) return false;
    }
  }

  for (let offset = 0; offset < span; offset += 1) {
    const date = addDays(booking.date, offset);
    for (const charterId of affected) {
      db.availability.push({
        id: idFactory(),
        charterId,
        date,
        reason: 'booking',
        // The linked listings carry the block but not the trip: the booking is
        // on one listing, it just consumes the boat for all of them.
        packageId: charterId === booking.charterId ? booking.packageId : undefined,
        bookingId: booking.id,
      });
    }
  }
  return true;
}

/**
 * Listings whose dates a booking on `charterId` must also consume.
 *
 * Lives here rather than with the linking UI because availability is what
 * actually enforces it, and a rule enforced far from where it is defined is a
 * rule that quietly stops being enforced.
 */
export function linkedCharterIds(db: Database, charterId: string): string[] {
  const link = db.calendarLinks.find((l) => l.charterIds.includes(charterId));
  return link ? link.charterIds.filter((id) => id !== charterId) : [];
}

/** Release the days a cancelled or declined booking was holding. */
export function releaseDates(db: Database, bookingId: string): void {
  db.availability = db.availability.filter(
    (block) => !(block.reason === 'booking' && block.bookingId === bookingId),
  );
}
