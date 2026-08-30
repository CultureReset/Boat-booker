import { addDays, today, toIsoDate } from '@/lib/core/dates';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import type { Booking, Catch, Database, Photo, SharedWishlist } from '@/lib/domain/types';
import { buildBlockIndex, packageAvailability } from './availability';
import { loyaltyTierFor } from './pricing';

/**
 * Trip memories, shared wishlists, buddy invitations and the catches feed.
 *
 * These are the parts of the product that exist to bring someone *back* rather
 * than to complete a transaction. They share a design constraint: none of them
 * may leak anything the viewer would not already be entitled to see. A shared
 * wishlist shows listings, never the owner's name or bookings; a trip memory is
 * scoped to the one booking it belongs to; a buddy invitation carries a trip,
 * not an account.
 */

export class MemoryError extends Error {
  constructor(readonly code: 'not_found' | 'forbidden' | 'not_eligible' | 'invalid', message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

/* --------------------------------------------------------------- memories */

export interface MemoryScene {
  key:
    | 'intro'
    | 'the_trip'
    | 'others_enjoyed'
    | 'captain_reputation'
    | 'same_dates'
    | 'similar'
    | 'outro';
  [key: string]: unknown;
}

export interface TripMemory {
  bookingId: string;
  customerName: string;
  yearsAgo: number;
  charter: { id: string; title: string; photo: Photo | null };
  destination: string;
  captainName: string;
  tripDate: string;
  guests: number;
  scenes: MemoryScene[];
}

/**
 * Builds the recap for one past trip.
 *
 * Only completed trips qualify, and only the guest who took them — a memory of
 * someone else's holiday is a privacy leak dressed as a feature.
 */
export function tripMemoryFor(db: Database, bookingId: string, customerId: string): TripMemory {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new MemoryError('not_found', 'That trip does not exist');
  if (booking.customerId !== customerId) {
    throw new MemoryError('forbidden', 'That trip belongs to another customer');
  }
  if (booking.status !== 'done') {
    throw new MemoryError('not_eligible', 'A memory is only made once the trip has happened');
  }

  const charter = db.charters.find((c) => c.id === booking.charterId);
  const destination = charter && db.destinations.find((d) => d.id === charter.destinationId);
  const customer = db.users.find((u) => u.id === booking.customerId);
  const owner = db.users.find((u) => u.id === booking.ownerId);
  if (!charter || !customer) throw new MemoryError('not_found', 'That trip does not exist');

  const captainName = owner?.ownerProfile?.captainName || owner?.firstName || 'your captain';
  const tripYear = Number(booking.date.slice(0, 4));
  const yearsAgo = Math.max(0, new Date().getUTCFullYear() - tripYear);

  // --- Reviews written since the guest's trip -------------------------------
  const reviewsSince = db.reviews.filter(
    (r) => r.charterId === charter.id && r.createdAt.slice(0, 10) > booking.date,
  );
  const averageSince = reviewsSince.length
    ? reviewsSince.reduce((sum, r) => sum + r.rating, 0) / reviewsSince.length
    : 0;

  // --- How many others took the same trip -----------------------------------
  const sameTrip = db.bookings.filter(
    (b) => b.packageId === booking.packageId && b.status === 'done' && b.id !== booking.id,
  ).length;

  // --- The same dates, next year --------------------------------------------
  const anniversary = anniversaryDates(booking.date);
  const pkg = db.packages.find((p) => p.id === booking.packageId);
  const blockIndex = buildBlockIndex(db);

  const availableDates = pkg
    ? anniversary.filter(
        (date) =>
          packageAvailability({
            pkg,
            date,
            guests: booking.adults + booking.children,
            days: booking.days,
            blockIndex,
          }).available,
      )
    : [];

  const loyalty = loyaltyTierFor(customer.completedTrips);

  // --- Similar charters nearby ----------------------------------------------
  const similar = db.charters
    .filter((c) => c.id !== charter.id && c.destinationId === charter.destinationId && c.published)
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      title: c.title,
      photo: c.photos[0] ?? null,
    }));

  const scenes: MemoryScene[] = [
    { key: 'intro', name: customer.firstName, years: yearsAgo },
    {
      key: 'the_trip',
      title: charter.title,
      date: booking.date,
      guests: booking.adults + booking.children,
      destination: destination?.title ?? '',
      photo: charter.photos[0] ?? null,
    },
    { key: 'others_enjoyed', count: sameTrip },
    {
      key: 'captain_reputation',
      captainName,
      reviewsSince: reviewsSince.length,
      averageSince: roundMoney(averageSince),
    },
    {
      key: 'same_dates',
      dates: availableDates,
      fullyBooked: availableDates.length === 0,
      discountPercent: loyalty.discountPercentage,
      captainName,
      name: customer.firstName,
    },
    { key: 'similar', charters: similar, destination: destination?.title ?? '' },
    { key: 'outro', charterId: charter.id },
  ];

  return {
    bookingId: booking.id,
    customerName: customer.firstName,
    yearsAgo,
    charter: { id: charter.id, title: charter.title, photo: charter.photos[0] ?? null },
    destination: destination?.title ?? '',
    captainName,
    tripDate: booking.date,
    guests: booking.adults + booking.children,
    scenes,
  };
}

/**
 * The same calendar dates, next time they come round.
 *
 * A memory that offers "book again" on a date in the past is worse than no
 * offer, so this always looks forward: this year if the anniversary is still
 * ahead, otherwise next year.
 */
function anniversaryDates(tripDate: string): string[] {
  const [, month, day] = tripDate.split('-').map(Number);
  const now = new Date();
  const thisYear = now.getUTCFullYear();

  const candidate = `${thisYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const base = candidate > today() ? candidate : `${thisYear + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Offer a small window either side — an exact anniversary is sentimental,
  // but people book the weekend that works.
  return [-2, -1, 0, 1, 2].map((offset) => addDays(base, offset));
}

/** Every trip this customer has a memory for, newest first. */
export function memoriesFor(db: Database, customerId: string): Booking[] {
  return db.bookings
    .filter((b) => b.customerId === customerId && b.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* -------------------------------------------------------- shared wishlist */

/**
 * Mints (or reuses) a share token for someone's wishlist.
 *
 * Reused rather than rotated, so a link already sent to a friend keeps working.
 * Revoking is a separate deliberate act.
 */
export function shareWishlist(db: Database, userId: string): SharedWishlist {
  const existing = db.sharedWishlists.find((s) => s.userId === userId);
  if (existing) return existing;

  const created: SharedWishlist = {
    token: newId() + newId(),
    userId,
    createdAt: new Date().toISOString(),
  };
  db.sharedWishlists.push(created);
  return created;
}

export function revokeWishlistShare(db: Database, userId: string): void {
  db.sharedWishlists = db.sharedWishlists.filter((s) => s.userId !== userId);
}

/**
 * Resolves a shared wishlist for a visitor.
 *
 * Returns the owner's *first name only*. A wishlist link is often forwarded
 * onward, and there is no reason a stranger needs the full identity of whoever
 * saved these boats.
 */
export function resolveSharedWishlist(db: Database, token: string) {
  const share = db.sharedWishlists.find((s) => s.token === token);
  if (!share) throw new MemoryError('not_found', 'This shared wishlist is not available');

  const owner = db.users.find((u) => u.id === share.userId);
  const items = db.wishlist.filter((w) => w.userId === share.userId);

  return {
    ownerFirstName: owner?.firstName ?? 'A friend',
    charterIds: items.map((i) => i.charterId),
    count: items.length,
  };
}

/* ------------------------------------------------------ buddy invitations */

export function inviteBuddies(
  db: Database,
  bookingId: string,
  customerId: string,
  emails: string[],
): Booking {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new MemoryError('not_found', 'Booking not found');
  if (booking.customerId !== customerId) throw new MemoryError('forbidden', 'Not your booking');

  const now = new Date().toISOString();
  const existing = new Set(booking.buddyInvitations.map((i) => i.email));

  for (const raw of emails.slice(0, 10)) {
    const email = raw.trim().toLowerCase();
    if (!email || existing.has(email)) continue;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) continue;

    booking.buddyInvitations.push({ id: newId(), email, invitedAt: now });
    existing.add(email);
  }

  return booking;
}

/* ------------------------------------------------------------- catches */

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

const SEASON_MONTHS: Record<Season, number[]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
  winter: [12, 1, 2],
};

export interface CatchQuery {
  months?: number[];
  season?: Season;
  destinationId?: string;
  q?: string;
  page?: number;
  perPage?: number;
}

export interface CatchCard {
  id: string;
  title: string;
  caption: string;
  photo: Photo;
  destination: string;
  charterId: string;
  charterTitle: string;
  customerName: string;
  likes: number;
  createdAt: string;
  month: number;
}

/**
 * The public catches feed.
 *
 * Names are shortened to "Alex N." — the feed is public and indexable, and a
 * full name attached to a dated location is more than anyone signed up for.
 */
export function browseCatches(
  db: Database,
  query: CatchQuery = {},
): { catches: CatchCard[]; totalCount: number; pageCount: number } {
  const months = query.season ? SEASON_MONTHS[query.season] : query.months;
  const needle = query.q?.trim().toLowerCase();

  const matching = db.catches.filter((item) => {
    if (months?.length && !months.includes(item.month)) return false;
    if (query.destinationId && item.destinationId !== query.destinationId) return false;
    if (needle) {
      const destination = db.destinations.find((d) => d.id === item.destinationId);
      const haystack = `${item.title} ${item.caption} ${destination?.title ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const perPage = Math.min(48, Math.max(6, query.perPage ?? 24));
  const page = Math.max(1, query.page ?? 1);
  const start = (page - 1) * perPage;

  const cards = matching.slice(start, start + perPage).map((item) => toCard(db, item));

  return {
    catches: cards,
    totalCount: matching.length,
    pageCount: Math.max(1, Math.ceil(matching.length / perPage)),
  };
}

function toCard(db: Database, item: Catch): CatchCard {
  const charter = db.charters.find((c) => c.id === item.charterId);
  const destination = db.destinations.find((d) => d.id === item.destinationId);
  const customer = db.users.find((u) => u.id === item.customerId);

  return {
    id: item.id,
    title: item.title,
    caption: item.caption,
    photo: item.photo,
    destination: destination?.title ?? '',
    charterId: item.charterId,
    charterTitle: charter?.title ?? '',
    customerName: customer
      ? `${customer.firstName} ${customer.lastName[0] ?? ''}.`.trim()
      : 'A boater',
    likes: item.likes,
    createdAt: item.createdAt,
    month: item.month,
  };
}

/**
 * A public profile, showing only what the person has already made public.
 *
 * Reviews they wrote are already visible on listings; trips they took are not,
 * so only the count appears. Nothing here is derived from anything private.
 */
export function publicProfileFor(db: Database, userId: string) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new MemoryError('not_found', 'Profile not found');

  const reviews = db.reviews
    .filter((r) => r.customerId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((review) => ({
      id: review.id,
      headline: review.headline,
      rating: review.rating,
      createdAt: review.createdAt,
      charterTitle: db.charters.find((c) => c.id === review.charterId)?.title ?? '',
      charterId: review.charterId,
    }));

  const isOwner = user.role === 'owner';
  const listings = isOwner
    ? db.charters
        .filter((c) => c.ownerId === user.id && c.published)
        .map((c) => ({ id: c.id, title: c.title, photo: c.photos[0] ?? null }))
    : [];

  return {
    id: user.id,
    displayName: isOwner
      ? user.ownerProfile?.companyName || `${user.firstName} ${user.lastName[0] ?? ''}.`
      : `${user.firstName} ${user.lastName[0] ?? ''}.`,
    role: user.role,
    memberSince: user.createdAt,
    bio: isOwner ? (user.ownerProfile?.background ?? '') : (user.bio ?? ''),
    languages: isOwner ? (user.ownerProfile?.languages ?? '') : '',
    completedTrips: user.completedTrips,
    reviewCount: db.reviews.filter((r) => r.customerId === user.id).length,
    reviews,
    listings,
  };
}

/** Season a month belongs to, so the feed can label a card. */
export function seasonOf(month: number): Season {
  return (Object.keys(SEASON_MONTHS) as Season[]).find((season) =>
    SEASON_MONTHS[season].includes(month),
  )!;
}

/** Anniversary date for a trip, used by the "boataversary" notification. */
export function anniversaryOf(booking: Booking): string {
  return toIsoDate(anniversaryDates(booking.date)[2]);
}
