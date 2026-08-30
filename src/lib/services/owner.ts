import { commerceConfig } from '@/config/brand';
import { defaultPolicyExtras } from '@/lib/domain/defaults';
import { activityByKey, amenityByKey, boatTypeBySlug, durationCategoryFor } from '@/config/taxonomy';
import { addDays, today, WEEKDAY_MASK_ALL } from '@/lib/core/dates';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import type { Charter, Database, Photo, TripPackage, User } from '@/lib/domain/types';
import { listingCompleteness, reviewStatisticsFor } from './charters';

/**
 * Owner-side operations: listings, trips, calendar, payouts, team.
 *
 * Every function takes the acting owner's ID and verifies it owns the record
 * before touching it, so authorisation cannot be skipped by calling a service
 * directly.
 */

export class OwnerError extends Error {
  constructor(readonly code: 'not_found' | 'forbidden' | 'invalid', message: string) {
    super(message);
    this.name = 'OwnerError';
  }
}

function requireCharter(db: Database, charterId: string, ownerId: string): Charter {
  const charter = db.charters.find((c) => c.id === charterId);
  if (!charter) throw new OwnerError('not_found', 'Listing not found');
  if (charter.ownerId !== ownerId) throw new OwnerError('forbidden', 'Not your listing');
  return charter;
}

// --- Dashboard -------------------------------------------------------------

export function ownerDashboard(db: Database, owner: User) {
  const start = today();
  const horizon = addDays(start, 30);

  const bookings = db.bookings.filter((b) => b.ownerId === owner.id);
  const charters = db.charters.filter((c) => c.ownerId === owner.id);
  const charterIds = new Set(charters.map((c) => c.id));
  const reviews = db.reviews.filter((r) => r.ownerId === owner.id);
  const payouts = db.payouts.filter((p) => p.ownerId === owner.id);

  const monthStart = `${start.slice(0, 7)}-01`;
  const earningsThisMonth = payouts
    .filter((p) => p.scheduledFor >= monthStart)
    .reduce((sum, p) => sum + p.net, 0);

  // Occupancy: booked days over the next 30, across every published boat.
  const bookedDays = new Set(
    db.availability
      .filter(
        (a) =>
          charterIds.has(a.charterId) &&
          a.reason === 'booking' &&
          a.date >= start &&
          a.date <= horizon,
      )
      .map((a) => `${a.charterId}:${a.date}`),
  ).size;
  const capacityDays = Math.max(1, charters.filter((c) => c.published).length * 30);

  const threadIds = new Set(db.threads.filter((t) => t.ownerId === owner.id).map((t) => t.id));
  const unreadMessages = db.messages.filter(
    (m) => threadIds.has(m.threadId) && m.senderId !== owner.id && !m.readAt,
  ).length;

  const pending = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings
    .filter((b) => b.status === 'confirmed' && b.date >= start)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    stats: {
      upcomingTrips: upcoming.length,
      pendingRequests: pending.length,
      unreadMessages,
      earningsThisMonth: roundMoney(earningsThisMonth, owner.currency),
      currency: owner.currency,
      occupancyPercent: Math.round((bookedDays / capacityDays) * 100),
      responseRate: owner.ownerProfile?.responseRate ?? 0,
      averageRating: reviews.length
        ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2))
        : 0,
      reviewCount: reviews.length,
      viewsThisWeek: charters.reduce((sum, c) => sum + c.viewsLast7Days, 0),
      publishedListings: charters.filter((c) => c.published).length,
      totalListings: charters.length,
    },
    todaysTrips: bookings
      .filter((b) => b.date === start && (b.status === 'confirmed' || b.status === 'accepted' || b.status === 'done'))
      .map((b) => summariseBooking(db, b)),
    upcomingTrips: upcoming.slice(0, 6).map((b) => summariseBooking(db, b)),
    pendingRequests: pending
      .sort((a, b) => (a.respondByAt ?? '').localeCompare(b.respondByAt ?? ''))
      .map((b) => summariseBooking(db, b)),
    // Everything the owner should act on, ranked by urgency.
    needsAttention: buildAttentionList(db, owner),
  };
}

function summariseBooking(db: Database, booking: Database['bookings'][number]) {
  const charter = db.charters.find((c) => c.id === booking.charterId);
  const pkg = db.packages.find((p) => p.id === booking.packageId);
  const customer = db.users.find((u) => u.id === booking.customerId);

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    date: booking.date,
    departureTime: booking.departureTime,
    adults: booking.adults,
    children: booking.children,
    total: booking.breakdown.total,
    currency: booking.currency,
    respondByAt: booking.respondByAt,
    charterTitle: charter?.title ?? '',
    charterId: booking.charterId,
    packageTitle: pkg?.title ?? '',
    customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Guest',
    customerId: booking.customerId,
    photo: charter?.photos[0]
      ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
      : null,
  };
}

interface AttentionItem {
  key: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  href: string;
  cta: string;
}

function buildAttentionList(db: Database, owner: User): AttentionItem[] {
  const items: AttentionItem[] = [];
  const start = today();

  const pending = db.bookings.filter((b) => b.ownerId === owner.id && b.status === 'pending');
  if (pending.length) {
    items.push({
      key: 'pending_requests',
      severity: 'high',
      title: `${pending.length} booking ${pending.length === 1 ? 'request' : 'requests'} waiting`,
      body: 'Requests expire if you do not respond in time.',
      href: '/owner/bookings?status=pending',
      cta: 'Respond',
    });
  }

  const threadIds = new Set(db.threads.filter((t) => t.ownerId === owner.id).map((t) => t.id));
  const unread = db.messages.filter(
    (m) => threadIds.has(m.threadId) && m.senderId !== owner.id && !m.readAt,
  ).length;
  if (unread) {
    items.push({
      key: 'unread_messages',
      severity: 'high',
      title: `${unread} unread ${unread === 1 ? 'message' : 'messages'}`,
      body: 'Fast replies convert better and lift your response rate.',
      href: '/owner/inbox',
      cta: 'Open inbox',
    });
  }

  if (owner.ownerProfile?.verification.status !== 'verified') {
    items.push({
      key: 'verification',
      severity: 'medium',
      title: 'Finish verifying your profile',
      body: 'Verified operators rank higher and win more bookings.',
      href: '/owner/verification',
      cta: 'Verify',
    });
  }

  if (!owner.ownerProfile?.payoutMethods.length) {
    items.push({
      key: 'payout_method',
      severity: 'high',
      title: 'Add a payout method',
      body: 'We cannot send your earnings until a payout method is on file.',
      href: '/owner/payout-methods',
      cta: 'Add method',
    });
  }

  for (const charter of db.charters.filter((c) => c.ownerId === owner.id)) {
    const packageCount = db.packages.filter((p) => p.charterId === charter.id).length;
    const completeness = listingCompleteness(charter, packageCount);
    if (completeness < 80) {
      items.push({
        key: `listing_${charter.id}`,
        severity: 'medium',
        title: `“${charter.title}” is ${completeness}% complete`,
        body: 'Complete listings rank higher in search.',
        href: `/owner/listings/${charter.id}`,
        cta: 'Finish listing',
      });
    }
    if (!charter.published) {
      items.push({
        key: `unpublished_${charter.id}`,
        severity: 'low',
        title: `“${charter.title}” is not published`,
        body: 'Unpublished listings cannot be found or booked.',
        href: `/owner/listings/${charter.id}`,
        cta: 'Publish',
      });
    }
  }

  const staleCalendar = db.charters.filter(
    (c) => c.ownerId === owner.id && c.published && c.availabilityUpdatedAt < addDays(start, -21),
  );
  if (staleCalendar.length) {
    items.push({
      key: 'stale_calendar',
      severity: 'medium',
      title: 'Your calendar looks out of date',
      body: 'Guests trust listings with recently updated availability.',
      href: '/owner/calendar',
      cta: 'Update calendar',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

// --- Listings --------------------------------------------------------------

export function listOwnerCharters(db: Database, ownerId: string) {
  return db.charters
    .filter((c) => c.ownerId === ownerId)
    .map((charter) => {
      const packages = db.packages.filter((p) => p.charterId === charter.id);
      const reviews = db.reviews.filter((r) => r.charterId === charter.id);
      const bookings = db.bookings.filter((b) => b.charterId === charter.id);
      const destination = db.destinations.find((d) => d.id === charter.destinationId);

      return {
        id: charter.id,
        title: charter.title,
        published: charter.published,
        snoozed: charter.snoozed,
        photo: charter.photos[0]
          ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
          : null,
        photoCount: charter.photos.length,
        destinationTitle: destination?.title ?? '',
        packageCount: packages.length,
        reviewStatistics: reviewStatisticsFor(reviews),
        upcomingBookings: bookings.filter((b) => b.status === 'confirmed' && b.date >= today()).length,
        pendingBookings: bookings.filter((b) => b.status === 'pending').length,
        viewsLast7Days: charter.viewsLast7Days,
        completeness: listingCompleteness(charter, packages.length),
        currency: charter.currency,
        boatType: charter.boat.type,
        capacity: charter.boat.capacity,
      };
    });
}

/** Full editable record for the listing editor. */
export function ownerCharterDetail(db: Database, charterId: string, ownerId: string) {
  const charter = requireCharter(db, charterId, ownerId);
  const packages = db.packages
    .filter((p) => p.charterId === charter.id)
    .sort((a, b) => a.hours - b.hours);
  const destination = db.destinations.find((d) => d.id === charter.destinationId);

  return {
    ...charter,
    destinationSlug: destination?.slug ?? '',
    destinationTitle: destination?.title ?? '',
    packages,
    completeness: listingCompleteness(charter, packages.length),
  };
}

export interface CharterUpdate {
  title?: string;
  shortDescription?: string;
  longDescription?: string;
  address?: string;
  postalCode?: string;
  directions?: string;
  destinationSlug?: string;
  published?: boolean;
  snoozed?: boolean;
  listingType?: Charter['listingType'];
  boat?: Partial<Charter['boat']>;
  amenities?: Record<string, boolean>;
  activitySlugs?: string[];
  policies?: Partial<Charter['policies']>;
}

export function updateCharter(
  db: Database,
  charterId: string,
  ownerId: string,
  input: CharterUpdate,
): Charter {
  const charter = requireCharter(db, charterId, ownerId);

  if (input.title !== undefined) {
    const value = input.title.trim();
    if (value.length < 3) throw new OwnerError('invalid', 'Listing title is too short');
    charter.title = value.slice(0, 140);
  }
  if (input.shortDescription !== undefined) {
    charter.shortDescription = input.shortDescription.trim().slice(0, 400);
  }
  if (input.longDescription !== undefined) {
    charter.longDescription = input.longDescription.trim().slice(0, 20_000);
  }
  if (input.address !== undefined) charter.address = input.address.trim().slice(0, 200);
  if (input.postalCode !== undefined) charter.postalCode = input.postalCode.trim().slice(0, 20);
  if (input.directions !== undefined) charter.directions = input.directions.trim().slice(0, 4000);
  if (input.published !== undefined) charter.published = input.published;
  if (input.snoozed !== undefined) charter.snoozed = input.snoozed;
  if (input.listingType) charter.listingType = input.listingType;

  if (input.destinationSlug) {
    const destination = db.destinations.find((d) => d.slug === input.destinationSlug);
    if (!destination) throw new OwnerError('invalid', 'Unknown destination');
    charter.destinationId = destination.id;
    charter.timezone = destination.timezone;
    // Keep the pin near the new destination rather than stranding it.
    charter.geoPoint = { ...destination.geoPoint };
  }

  if (input.boat) {
    const boat = input.boat;
    if (boat.type) {
      const type = boatTypeBySlug.get(boat.type) ?? boatTypeBySlug.get(boat.type.toLowerCase());
      charter.boat.type = type?.title ?? boat.type;
      if (type) {
        charter.boat.category = type.category;
        charter.boat.isPowered = type.powered;
      }
    }
    const numeric: (keyof Charter['boat'])[] = [
      'length', 'capacity', 'yearBuilt', 'yearRestored', 'engineHorsepower',
      'engineCount', 'maxSpeed', 'numberOfCabins', 'numberOfBerths', 'numberOfHeads',
    ];
    const boatRecord = charter.boat as unknown as Record<string, unknown>;
    for (const key of numeric) {
      const value = boat[key];
      if (value !== undefined && Number.isFinite(Number(value))) {
        boatRecord[key] = Math.max(0, Number(value));
      }
    }
    for (const key of ['manufacturer', 'boatModel', 'engineManufacturer', 'engineType', 'fuelType'] as const) {
      if (boat[key] !== undefined) charter.boat[key] = String(boat[key]).slice(0, 80);
    }
    if (charter.boat.capacity < 1) throw new OwnerError('invalid', 'Capacity must be at least 1');
  }

  if (input.amenities) {
    // Only keys the taxonomy knows about are stored, so a stale client cannot
    // write junk into the record.
    for (const [key, value] of Object.entries(input.amenities)) {
      if (amenityByKey.has(key)) charter.amenities[key] = Boolean(value);
    }
  }

  if (input.activitySlugs) {
    const keys = input.activitySlugs
      .map((slug) => Array.from(activityByKey.values()).find((a) => a.slug === slug)?.key)
      .filter((key): key is string => Boolean(key));
    charter.activityKeys = Array.from(new Set(keys));
  }

  if (input.policies) {
    const p = input.policies;
    if (p.freeCancellationDaysInAdvance !== undefined) {
      charter.policies.freeCancellationDaysInAdvance = Math.min(
        30,
        Math.max(0, Number(p.freeCancellationDaysInAdvance) || 0),
      );
    }
    if (p.depositPercent !== undefined) {
      charter.policies.depositPercent = Math.min(100, Math.max(0, Number(p.depositPercent) || 0));
    }
    if (p.hasSecurityDeposit !== undefined) charter.policies.hasSecurityDeposit = Boolean(p.hasSecurityDeposit);
    if (p.securityDepositAmount !== undefined) {
      charter.policies.securityDepositAmount = Math.max(0, Number(p.securityDepositAmount) || 0);
    }
    if (p.fuelIncludedInPrice !== undefined) charter.policies.fuelIncludedInPrice = Boolean(p.fuelIncludedInPrice);
    if (p.isInstantBookActive !== undefined) charter.policies.isInstantBookActive = Boolean(p.isInstantBookActive);
    if (p.acceptedPaymentMethods) {
      charter.policies.acceptedPaymentMethods = Array.from(new Set(p.acceptedPaymentMethods));
    }
  }

  return charter;
}

export function createCharter(db: Database, owner: User, input: { title: string; destinationSlug: string }): Charter {
  const destination = db.destinations.find((d) => d.slug === input.destinationSlug);
  if (!destination) throw new OwnerError('invalid', 'Choose a destination');

  const title = input.title.trim();
  if (title.length < 3) throw new OwnerError('invalid', 'Listing title is too short');

  const charter: Charter = {
    id: newId(),
    ownerId: owner.id,
    title: title.slice(0, 140),
    shortDescription: '',
    longDescription: '',
    listingType: 'boat_tour',
    // New listings start as drafts — nothing goes live until the owner says so.
    published: false,
    snoozed: false,
    destinationId: destination.id,
    address: '',
    postalCode: '',
    directions: '',
    geoPoint: { ...destination.geoPoint },
    timezone: destination.timezone,
    currency: owner.currency,
    boat: {
      type: 'Center console',
      category: 'Powerboats',
      length: 24,
      capacity: 6,
      isPowered: true,
    },
    amenities: { lifeJackets: true, anchor: true },
    activityKeys: [],
    policies: {
      freeCancellationDaysInAdvance: 3,
      depositPercent: commerceConfig.defaultDepositRate * 100,
      hasSecurityDeposit: false,
      securityDepositAmount: 0,
      fuelIncludedInPrice: true,
      ...defaultPolicyExtras(commerceConfig.defaultDepositRate * 100),
      isInstantBookActive: false,
      acceptedPaymentMethods: ['visa', 'master_card', 'cash'],
      cardProcessingRate: commerceConfig.cardProcessingRate,
    },
    photos: [],
    licenseStatus: 'Unverified',
    verificationBadge: null,
    hasBoatersChoiceAward: false,
    createdAt: new Date().toISOString(),
    availabilityUpdatedAt: new Date().toISOString(),
    viewsLast7Days: 0,
  };

  db.charters.push(charter);
  return charter;
}

export function deleteCharter(db: Database, charterId: string, ownerId: string): void {
  const charter = requireCharter(db, charterId, ownerId);

  const liveBookings = db.bookings.filter(
    (b) => b.charterId === charter.id && (b.status === 'pending' || b.status === 'confirmed'),
  );
  if (liveBookings.length) {
    throw new OwnerError('invalid', 'Cancel or complete the open bookings on this listing first');
  }

  db.charters = db.charters.filter((c) => c.id !== charter.id);
  db.packages = db.packages.filter((p) => p.charterId !== charter.id);
  db.availability = db.availability.filter((a) => a.charterId !== charter.id);
  db.wishlist = db.wishlist.filter((w) => w.charterId !== charter.id);
}

// --- Photos ----------------------------------------------------------------

/**
 * Photos are stored as deterministic gradients in this build rather than
 * uploaded bitmaps — swapping in real object storage means changing this
 * function and the `Photo.url` field, nothing else.
 */
export function addPhoto(db: Database, charterId: string, ownerId: string, altText: string): Photo {
  const charter = requireCharter(db, charterId, ownerId);

  const index = charter.photos.length;
  const hue = (index * 47 + charter.id.length * 13) % 360;
  const photo: Photo = {
    id: newId(),
    url: '',
    placeholder: `linear-gradient(160deg, hsl(${hue} 60% 46%), hsl(${(hue + 40) % 360} 56% 68%))`,
    altText: altText.trim().slice(0, 200) || charter.title,
    width: 1600,
    height: 1067,
    cardinal: index,
  };

  charter.photos.push(photo);
  return photo;
}

export function reorderPhotos(db: Database, charterId: string, ownerId: string, order: string[]): Photo[] {
  const charter = requireCharter(db, charterId, ownerId);

  const byId = new Map(charter.photos.map((p) => [p.id, p]));
  const reordered = order.map((id) => byId.get(id)).filter((p): p is Photo => Boolean(p));

  // Anything the client did not mention keeps its relative order at the end.
  for (const photo of charter.photos) {
    if (!reordered.includes(photo)) reordered.push(photo);
  }

  charter.photos = reordered.map((photo, index) => ({ ...photo, cardinal: index }));
  return charter.photos;
}

export function removePhoto(db: Database, charterId: string, ownerId: string, photoId: string): void {
  const charter = requireCharter(db, charterId, ownerId);
  charter.photos = charter.photos
    .filter((p) => p.id !== photoId)
    .map((photo, index) => ({ ...photo, cardinal: index }));
}

// --- Trips -----------------------------------------------------------------

export interface PackageInput {
  title?: string;
  hours?: number;
  type?: 'private' | 'shared';
  price?: number;
  capacity?: number;
  minPersons?: number;
  additionalPersonAfter?: number | null;
  additionalPersonPrice?: number | null;
  departureTimes?: string[];
  weekdayMask?: number;
  minDays?: number | null;
  active?: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function upsertPackage(
  db: Database,
  charterId: string,
  ownerId: string,
  input: PackageInput & { id?: string },
): TripPackage {
  const charter = requireCharter(db, charterId, ownerId);

  const existing = input.id
    ? db.packages.find((p) => p.id === input.id && p.charterId === charter.id)
    : undefined;
  if (input.id && !existing) throw new OwnerError('not_found', 'Trip not found');

  const hours = input.hours !== undefined ? Number(input.hours) : existing?.hours ?? 4;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    throw new OwnerError('invalid', 'Enter a valid trip duration');
  }

  const price = input.price !== undefined ? Number(input.price) : existing?.price ?? 0;
  if (!Number.isFinite(price) || price < 0) throw new OwnerError('invalid', 'Enter a valid price');

  const capacity = input.capacity !== undefined ? Number(input.capacity) : existing?.capacity ?? charter.boat.capacity;
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new OwnerError('invalid', 'Enter a valid guest capacity');
  }
  if (capacity > charter.boat.capacity) {
    throw new OwnerError('invalid', `The boat holds ${charter.boat.capacity} guests`);
  }

  const minPersons = input.minPersons !== undefined ? Number(input.minPersons) : existing?.minPersons ?? 1;
  if (!Number.isInteger(minPersons) || minPersons < 1 || minPersons > capacity) {
    throw new OwnerError('invalid', 'Minimum guests must be between 1 and the capacity');
  }

  const departureTimes = (input.departureTimes ?? existing?.departureTimes ?? ['09:00'])
    .filter((t) => TIME_PATTERN.test(t))
    .sort();
  if (!departureTimes.length) throw new OwnerError('invalid', 'Add at least one departure time');

  const pkg: TripPackage = {
    id: existing?.id ?? newId(),
    charterId: charter.id,
    title: (input.title ?? existing?.title ?? `${hours} Hour Trip`).trim().slice(0, 140),
    hours,
    durationCategory: durationCategoryFor(hours),
    type: input.type ?? existing?.type ?? 'private',
    price: roundMoney(price, charter.currency),
    currency: charter.currency,
    capacity,
    minPersons,
    additionalPersonAfter:
      input.additionalPersonAfter !== undefined
        ? input.additionalPersonAfter === null
          ? null
          : Math.max(1, Number(input.additionalPersonAfter))
        : existing?.additionalPersonAfter ?? null,
    additionalPersonPrice:
      input.additionalPersonPrice !== undefined
        ? input.additionalPersonPrice === null
          ? null
          : Math.max(0, Number(input.additionalPersonPrice))
        : existing?.additionalPersonPrice ?? null,
    departureTimes: Array.from(new Set(departureTimes)),
    weekdayMask:
      input.weekdayMask !== undefined
        ? Math.min(WEEKDAY_MASK_ALL, Math.max(0, Number(input.weekdayMask)))
        : existing?.weekdayMask ?? WEEKDAY_MASK_ALL,
    seasonStart: existing?.seasonStart,
    seasonEnd: existing?.seasonEnd,
    minDays: input.minDays !== undefined ? input.minDays : existing?.minDays ?? null,
    active: input.active ?? existing?.active ?? true,
  };

  if (existing) Object.assign(existing, pkg);
  else db.packages.push(pkg);

  return pkg;
}

export function deletePackage(db: Database, charterId: string, ownerId: string, packageId: string): void {
  requireCharter(db, charterId, ownerId);

  const openBookings = db.bookings.filter(
    (b) => b.packageId === packageId && (b.status === 'pending' || b.status === 'confirmed'),
  );
  if (openBookings.length) {
    // Retiring rather than deleting keeps historic bookings readable.
    const pkg = db.packages.find((p) => p.id === packageId);
    if (pkg) pkg.active = false;
    return;
  }

  db.packages = db.packages.filter((p) => p.id !== packageId);
}

// --- Calendar --------------------------------------------------------------

export function setDateBlocks(
  db: Database,
  charterId: string,
  ownerId: string,
  dates: string[],
  blocked: boolean,
  note?: string,
): number {
  const charter = requireCharter(db, charterId, ownerId);
  const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  let changed = 0;

  for (const date of valid) {
    const existing = db.availability.filter((a) => a.charterId === charter.id && a.date === date);

    // A date consumed by a booking is not the owner's to open up here — that
    // needs cancelling the booking, which has its own refund consequences.
    if (existing.some((a) => a.reason === 'booking')) continue;

    const manual = existing.find((a) => a.reason === 'manual');

    if (blocked && !manual) {
      db.availability.push({
        id: newId(),
        charterId: charter.id,
        date,
        reason: 'manual',
        note: note?.slice(0, 200),
      });
      changed += 1;
    } else if (!blocked && manual) {
      db.availability = db.availability.filter((a) => a.id !== manual.id);
      changed += 1;
    }
  }

  if (changed) charter.availabilityUpdatedAt = new Date().toISOString();
  return changed;
}

/** Calendar across every listing an owner has, for the multicalendar view. */
export function multiCalendar(db: Database, ownerId: string, from: string, days: number) {
  const charters = db.charters.filter((c) => c.ownerId === ownerId);
  const start = today();

  return charters.map((charter) => {
    const blocks = db.availability.filter((a) => a.charterId === charter.id);
    const byDate = new Map(blocks.map((b) => [b.date, b]));

    const cells = Array.from({ length: days }, (_, offset) => {
      const date = addDays(from, offset);
      const block = byDate.get(date);

      if (date < start) return { date, state: 'past' as const };
      if (block?.reason === 'booking') {
        const booking = db.bookings.find((b) => b.id === block.bookingId);
        return {
          date,
          state: 'booked' as const,
          bookingId: block.bookingId,
          reference: booking?.reference,
          guests: booking ? booking.adults + booking.children : undefined,
        };
      }
      if (block?.reason === 'manual') return { date, state: 'blocked' as const, note: block.note };
      return { date, state: 'available' as const };
    });

    return {
      charterId: charter.id,
      title: charter.title,
      published: charter.published,
      photo: charter.photos[0]
        ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
        : null,
      cells,
    };
  });
}

// --- Payouts and team ------------------------------------------------------

export function payoutLedger(db: Database, ownerId: string) {
  const payouts = db.payouts
    .filter((p) => p.ownerId === ownerId)
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  const rows = payouts.map((payout) => {
    const booking = db.bookings.find((b) => b.id === payout.bookingId);
    const charter = booking ? db.charters.find((c) => c.id === booking.charterId) : undefined;
    return {
      ...payout,
      reference: booking?.reference ?? '',
      tripDate: booking?.date ?? '',
      charterTitle: charter?.title ?? '',
      guests: booking ? booking.adults + booking.children : 0,
    };
  });

  const pending = payouts.filter((p) => p.status === 'pending');
  const paid = payouts.filter((p) => p.status === 'paid');
  const currency = payouts[0]?.currency ?? 'USD';

  return {
    rows,
    totals: {
      currency,
      available: roundMoney(pending.filter((p) => p.scheduledFor <= today()).reduce((s, p) => s + p.net, 0), currency),
      pending: roundMoney(pending.reduce((s, p) => s + p.net, 0), currency),
      paid: roundMoney(paid.reduce((s, p) => s + p.net, 0), currency),
      platformFees: roundMoney(payouts.reduce((s, p) => s + p.platformFee, 0), currency),
      feeRate: commerceConfig.serviceFeeRate,
    },
    nextPayoutDate: pending.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0]?.scheduledFor ?? null,
  };
}

export function addPayoutMethod(
  db: Database,
  ownerId: string,
  input: { kind: 'bank' | 'paypal'; label: string; accountHolder: string; accountNumber: string; currency: string },
) {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner?.ownerProfile) throw new OwnerError('forbidden', 'Owner account required');

  const digits = input.accountNumber.replace(/\s/g, '');
  if (digits.length < 4) throw new OwnerError('invalid', 'Enter a valid account');

  const method = {
    id: newId(),
    kind: input.kind,
    label: input.label.trim().slice(0, 80) || (input.kind === 'bank' ? 'Bank account' : 'PayPal'),
    accountHolder: input.accountHolder.trim().slice(0, 120),
    // As with cards, only the last four characters are ever persisted.
    last4: digits.slice(-4),
    currency: input.currency.toUpperCase().slice(0, 3),
    isDefault: owner.ownerProfile.payoutMethods.length === 0,
    createdAt: new Date().toISOString(),
  };

  owner.ownerProfile.payoutMethods.push(method);
  return method;
}

export function removePayoutMethod(db: Database, ownerId: string, methodId: string): void {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner?.ownerProfile) throw new OwnerError('forbidden', 'Owner account required');

  const removed = owner.ownerProfile.payoutMethods.find((m) => m.id === methodId);
  owner.ownerProfile.payoutMethods = owner.ownerProfile.payoutMethods.filter((m) => m.id !== methodId);

  const remaining = owner.ownerProfile.payoutMethods;
  if (removed?.isDefault && remaining.length) remaining[0].isDefault = true;
}

export function inviteTeamMember(
  db: Database,
  ownerId: string,
  input: { name: string; email: string; role: 'manager' | 'captain' },
) {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner?.ownerProfile) throw new OwnerError('forbidden', 'Owner account required');

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OwnerError('invalid', 'Enter a valid email address');
  }
  if (owner.ownerProfile.team.some((m) => m.email === email)) {
    throw new OwnerError('invalid', 'That person is already on your team');
  }

  const member = {
    id: newId(),
    name: input.name.trim().slice(0, 120) || email,
    email,
    role: input.role,
    invitedAt: new Date().toISOString(),
  };

  owner.ownerProfile.team.push(member);
  return member;
}

export function removeTeamMember(db: Database, ownerId: string, memberId: string): void {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner?.ownerProfile) throw new OwnerError('forbidden', 'Owner account required');

  const member = owner.ownerProfile.team.find((m) => m.id === memberId);
  // The account holder cannot be removed from their own team.
  if (member?.role === 'owner') throw new OwnerError('invalid', 'The account owner cannot be removed');

  owner.ownerProfile.team = owner.ownerProfile.team.filter((m) => m.id !== memberId);
}

export function submitVerification(db: Database, ownerId: string, filenames: { kind: 'license' | 'insurance' | 'identity'; filename: string }[]) {
  const owner = db.users.find((u) => u.id === ownerId);
  if (!owner?.ownerProfile) throw new OwnerError('forbidden', 'Owner account required');

  const now = new Date().toISOString();
  for (const file of filenames) {
    owner.ownerProfile.verification.documents.push({
      id: newId(),
      kind: file.kind,
      filename: file.filename.slice(0, 200),
      uploadedAt: now,
    });
  }

  if (owner.ownerProfile.verification.documents.length > 0) {
    owner.ownerProfile.verification.status = 'pending';
  }

  return owner.ownerProfile.verification;
}
