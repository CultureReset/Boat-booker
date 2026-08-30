import {
  activityByKey,
  amenities,
  amenityByKey,
  boatTypeByTitle,
  verificationBadges,
  type AmenityGroup,
} from '@/config/taxonomy';
import { addDays, today } from '@/lib/core/dates';
import { money } from '@/lib/core/money';
import type {
  AddOn,
  ItineraryStep,
  Charter,
  Database,
  Destination,
  Review,
  ReviewStatistics,
  TripPackage,
  User,
} from '@/lib/domain/types';
import { minimumPriceFor } from './pricing';
import type { BlockIndex, PackageAvailability } from './availability';
import { charterAvailability } from './availability';

/**
 * Read models.
 *
 * Route handlers and server components never hand raw records to the client.
 * These builders decide exactly what each surface needs — a search card needs
 * far less than the listing page — which keeps payloads small and stops
 * server-only fields (owner email, password hash, exact address before
 * booking) from leaking into the browser.
 */

export function reviewStatisticsFor(reviews: Review[]): ReviewStatistics {
  const stars: ReviewStatistics['stars'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  if (!reviews.length) {
    return { reviewCount: 0, rating: 0, ratingOverall: 0, ratingCaptain: 0, ratingEquipment: 0, stars };
  }

  let overall = 0;
  let captain = 0;
  let equipment = 0;

  for (const review of reviews) {
    overall += review.ratings.ratingOverall;
    captain += review.ratings.ratingCaptain;
    equipment += review.ratings.ratingEquipment;
    const bucket = String(Math.round(review.rating)) as keyof ReviewStatistics['stars'];
    if (stars[bucket] !== undefined) stars[bucket] += 1;
  }

  const n = reviews.length;
  const round = (v: number) => Number((v / n).toFixed(2));

  return {
    reviewCount: n,
    rating: round(overall + captain + equipment) / 3,
    ratingOverall: round(overall),
    ratingCaptain: round(captain),
    ratingEquipment: round(equipment),
    stars,
  };
}

/** Index reviews by listing so a search page does not scan the table per card. */
export function indexReviews(db: Database) {
  const byCharter = new Map<string, Review[]>();
  for (const review of db.reviews) {
    const list = byCharter.get(review.charterId);
    if (list) list.push(review);
    else byCharter.set(review.charterId, [review]);
  }
  return byCharter;
}

export function indexPackages(db: Database) {
  const byCharter = new Map<string, TripPackage[]>();
  for (const pkg of db.packages) {
    if (!pkg.active) continue;
    const list = byCharter.get(pkg.charterId);
    if (list) list.push(pkg);
    else byCharter.set(pkg.charterId, [pkg]);
  }
  for (const list of byCharter.values()) list.sort((a, b) => a.hours - b.hours);
  return byCharter;
}

export interface CharterCard {
  id: string;
  title: string;
  listingType: string;
  destination: { id: string; slug: string; title: string; stateAbbrev?: string; countryTitle: string };
  photo: {
    placeholder: string;
    altText: string;
    url: string;
    /** Set when the cover is a clip — the card shows a play badge. */
    video?: { url?: string; durationSeconds: number };
  };
  photoCount: number;
  boatType: string;
  boatCategory: string;
  length: number;
  capacity: number;
  activities: { slug: string; title: string }[];
  minPrice: { value: number; currency: string; displayValue: string } | null;
  pricePerPerson: boolean;
  reviewStatistics: ReviewStatistics;
  isInstantBookActive: boolean;
  freeCancellationDaysInAdvance: number;
  verificationBadge: string | null;
  licenseStatus: string;
  hasBoatersChoiceAward: boolean;
  isNew: boolean;
  inHighDemand: boolean;
  available: boolean;
  /** Distance from the search origin in kilometres, when one was supplied. */
  distanceKm?: number;
  geoPoint: { lat: number; lon: number };
}

export function buildCharterCard(input: {
  charter: Charter;
  packages: TripPackage[];
  reviews: Review[];
  destination: Destination;
  countryTitle: string;
  stateAbbrev?: string;
  currency: string;
  guests: number;
  availability?: { available: boolean; packages: PackageAvailability[] };
  distanceKm?: number;
}): CharterCard {
  const { charter, packages, reviews, destination, currency, guests } = input;
  const cheapest = minimumPriceFor(charter, packages, currency, Math.max(1, guests));
  const cheapestPackage = cheapest ? packages.find((p) => p.id === cheapest.packageId) : undefined;
  const cover = charter.photos[0];

  const createdDaysAgo = (Date.now() - new Date(charter.createdAt).getTime()) / 86_400_000;

  return {
    id: charter.id,
    title: charter.title,
    listingType: charter.listingType,
    destination: {
      id: destination.id,
      slug: destination.slug,
      title: destination.title,
      stateAbbrev: input.stateAbbrev,
      countryTitle: input.countryTitle,
    },
    photo: cover
      ? { placeholder: cover.placeholder, altText: cover.altText, url: cover.url, video: cover.video }
      : { placeholder: 'linear-gradient(160deg,#cbd5e1,#94a3b8)', altText: charter.title, url: '' },
    photoCount: charter.photos.length,
    boatType: charter.boat.type,
    boatCategory: charter.boat.category,
    length: charter.boat.length,
    capacity: charter.boat.capacity,
    activities: charter.activityKeys
      .map((key) => activityByKey.get(key))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({ slug: a.slug, title: a.title })),
    minPrice: cheapest ? money(cheapest.amount, currency, currency) : null,
    pricePerPerson: cheapestPackage?.type === 'shared',
    reviewStatistics: reviewStatisticsFor(reviews),
    isInstantBookActive: charter.policies.isInstantBookActive,
    freeCancellationDaysInAdvance: charter.policies.freeCancellationDaysInAdvance,
    verificationBadge: charter.verificationBadge,
    licenseStatus: charter.licenseStatus,
    hasBoatersChoiceAward: charter.hasBoatersChoiceAward,
    isNew: createdDaysAgo < 120,
    inHighDemand: charter.viewsLast7Days > 260,
    available: input.availability?.available ?? true,
    distanceKm: input.distanceKm,
    geoPoint: charter.geoPoint,
  };
}

export interface AmenitySection {
  group: AmenityGroup;
  title: string;
  items: { key: string; title: string; icon: string; active: boolean; policy: boolean }[];
}

/** Group a listing's amenity flags into the sections the listing page renders. */
export function amenitySections(charter: Charter): AmenitySection[] {
  const byGroup = new Map<AmenityGroup, AmenitySection['items']>();

  for (const amenity of amenities) {
    const active = charter.amenities[amenity.key] === true;
    // Equipment is only listed when present; rules are listed either way so a
    // guest can see "no pets" as clearly as "pets welcome".
    if (!active && !amenity.policy) continue;

    const items = byGroup.get(amenity.group) ?? [];
    items.push({
      key: amenity.key,
      title: amenity.title,
      icon: amenity.icon,
      active,
      policy: amenity.policy === true,
    });
    byGroup.set(amenity.group, items);
  }

  const order: AmenityGroup[] = [
    'comfort', 'entertainment', 'deck', 'water-toys', 'fishing-gear',
    'catering', 'navigation', 'safety', 'rules',
  ];

  return order
    .filter((group) => byGroup.has(group))
    .map((group) => ({
      group,
      title: groupTitle(group),
      items: byGroup.get(group)!,
    }));
}

function groupTitle(group: AmenityGroup): string {
  const titles: Record<AmenityGroup, string> = {
    comfort: 'Comfort',
    entertainment: 'Entertainment',
    navigation: 'Navigation & electronics',
    safety: 'Safety',
    'water-toys': 'Water toys',
    'fishing-gear': 'Fishing gear',
    catering: 'Food & drink',
    deck: 'Deck & layout',
    rules: 'Boat rules',
  };
  return titles[group];
}

/** The handful of amenities surfaced as chips at the top of the listing page. */
export function highlightAmenities(charter: Charter, limit = 8) {
  const priority = [
    'wifi', 'ac', 'shower', 'bimini', 'snorkelingEquipment', 'paddleboard',
    'kayak', 'audioSystem', 'refrigerator', 'kitchen', 'bathingPlatform', 'lifeJackets',
  ];
  return priority
    .filter((key) => charter.amenities[key])
    .slice(0, limit)
    .map((key) => amenityByKey.get(key)!)
    .filter(Boolean);
}

export interface CharterDetail extends Omit<CharterCard, 'photo'> {
  shortDescription: string;
  longDescription: string;
  directions: string;
  /** Only populated for a guest with a confirmed booking. */
  exactAddress: string | null;
  approximateAddress: string;
  photos: {
    id: string;
    placeholder: string;
    altText: string;
    url: string;
    video?: { url?: string; durationSeconds: number };
  }[];
  boat: Charter['boat'];
  policies: Charter['policies'];
  amenitySections: AmenitySection[];
  highlights: { key: string; title: string; icon: string }[];
  packages: (TripPackage & {
    availability?: PackageAvailability;
    /** Published itinerary only — a draft is not a promise to a guest. */
    itinerary?: { days: { steps: ItineraryStep[] }[] };
  })[];
  /** Paid extras a guest can add at checkout. */
  addOns: AddOn[];
  /**
   * Real bookings in the past week, or null.
   *
   * Counted rather than estimated: a scarcity claim that is not literally true
   * is the kind of dark pattern that erodes the trust the rest of the product
   * is built on. Null below the threshold, so the UI has nothing to render
   * rather than something to soften.
   */
  scarcity: { bookingsLastWeek: number } | null;
  owner: {
    id: string;
    displayName: string;
    companyName: string;
    captainType: string;
    background: string;
    experience?: string;
    languages: string;
    yearStartedRunningCharters: number;
    responseRate: number;
    averageResponseTimeSeconds: number;
    verified: boolean;
    listingCount: number;
  };
  verification: { key: string; title: string; description: string } | null;
  timezone: string;
  currency: string;
  availabilityUpdatedAt: string;
}

export function buildCharterDetail(input: {
  db: Database;
  charter: Charter;
  currency: string;
  guests: number;
  days: number;
  date?: string;
  blockIndex: BlockIndex;
  /** Set when the viewer has a confirmed booking, unlocking the exact address. */
  revealExactAddress?: boolean;
}): CharterDetail | null {
  const { db, charter, currency, guests, days, date, blockIndex } = input;

  const destination = db.destinations.find((d) => d.id === charter.destinationId);
  if (!destination) return null;

  const country = db.countries.find((c) => c.id === destination.countryId);
  const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;
  const owner = db.users.find((u) => u.id === charter.ownerId);
  const packages = db.packages.filter((p) => p.charterId === charter.id && p.active).sort((a, b) => a.hours - b.hours);
  const reviews = db.reviews.filter((r) => r.charterId === charter.id);

  const availability = charterAvailability({ charter, packages, date, guests, days, blockIndex });
  const availabilityByPackage = new Map(availability.packages.map((p) => [p.packageId, p]));

  const card = buildCharterCard({
    charter,
    packages,
    reviews,
    destination,
    countryTitle: country?.title ?? '',
    stateAbbrev: state?.abbrev,
    currency,
    guests,
    availability,
  });

  const { photo, ...cardRest } = card;
  void photo;

  const boatType = boatTypeByTitle.get(charter.boat.type);

  return {
    ...cardRest,
    shortDescription: charter.shortDescription,
    longDescription: charter.longDescription,
    directions: charter.directions,
    exactAddress: input.revealExactAddress
      ? `${charter.address}, ${destination.title}${state ? `, ${state.abbrev}` : ''} ${charter.postalCode}, ${country?.title ?? ''}`
      : null,
    approximateAddress: `${destination.title}${state ? `, ${state.abbrev}` : ''}, ${country?.title ?? ''}`,
    photos: charter.photos.map((p) => ({
      id: p.id,
      placeholder: p.placeholder,
      altText: p.altText,
      url: p.url,
      video: p.video,
    })),
    boat: { ...charter.boat, category: boatType?.category ?? charter.boat.category },
    policies: charter.policies,
    amenitySections: amenitySections(charter),
    highlights: highlightAmenities(charter).map((a) => ({ key: a.key, title: a.title, icon: a.icon })),
    packages: packages.map((pkg) => {
      const itinerary = db.itineraries.find(
        (i) => i.packageId === pkg.id && i.status === 'published',
      );
      return {
        ...pkg,
        availability: availabilityByPackage.get(pkg.id),
        itinerary: itinerary ? { days: itinerary.days } : undefined,
      };
    }),
    addOns: db.addOns.filter((a) => a.charterId === charter.id && a.active),
    scarcity: (() => {
      const cutoff = addDays(today(), -7);
      const recent = db.bookings.filter(
        (b) =>
          b.charterId === charter.id &&
          b.createdAt.slice(0, 10) >= cutoff &&
          b.status !== 'declined' &&
          b.status !== 'withdrawn',
      ).length;
      return recent >= 3 ? { bookingsLastWeek: recent } : null;
    })(),
    owner: {
      id: charter.ownerId,
      displayName: owner?.ownerProfile?.captainName ?? `${owner?.firstName ?? ''} ${owner?.lastName ?? ''}`.trim(),
      companyName: owner?.ownerProfile?.companyName ?? '',
      captainType: owner?.ownerProfile?.captainType ?? 'captain',
      background: owner?.ownerProfile?.background ?? '',
      experience: owner?.ownerProfile?.experience,
      languages: owner?.ownerProfile?.languages ?? 'English',
      yearStartedRunningCharters: owner?.ownerProfile?.yearStartedRunningCharters ?? 0,
      responseRate: owner?.ownerProfile?.responseRate ?? 0,
      averageResponseTimeSeconds: owner?.ownerProfile?.averageResponseTimeSeconds ?? 0,
      verified: owner?.ownerProfile?.verification.status === 'verified',
      listingCount: db.charters.filter((c) => c.ownerId === charter.ownerId && c.published).length,
    },
    verification: charter.verificationBadge
      ? {
          key: charter.verificationBadge,
          title: verificationBadges[charter.verificationBadge].title,
          description: verificationBadges[charter.verificationBadge].description,
        }
      : null,
    timezone: charter.timezone,
    currency: charter.currency,
    availabilityUpdatedAt: charter.availabilityUpdatedAt,
  };
}

/** Owner-facing view: everything, including unpublished listings. */
export function ownerListingSummary(db: Database, charter: Charter) {
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
    upcomingBookings: bookings.filter((b) => b.status === 'confirmed' && b.date >= new Date().toISOString().slice(0, 10)).length,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    viewsLast7Days: charter.viewsLast7Days,
    // The green shield beside a listing's name in the operator app.
    verificationBadge: charter.verificationBadge,
    completeness: listingCompleteness(charter, packages.length),
    currency: charter.currency,
  };
}

/**
 * Percentage completeness, shown as a nudge in the owner dashboard. Each
 * criterion is worth an equal share, so the meter is easy to reason about.
 */
export function listingCompleteness(charter: Charter, packageCount: number): number {
  const criteria = [
    charter.title.length > 3,
    charter.longDescription.length > 200,
    charter.photos.length >= 5,
    packageCount >= 1,
    charter.activityKeys.length >= 1,
    Object.values(charter.amenities).some(Boolean),
    Boolean(charter.address),
    Boolean(charter.directions),
    charter.boat.capacity > 0 && charter.boat.length > 0,
    charter.policies.acceptedPaymentMethods.length > 0,
  ];
  return Math.round((criteria.filter(Boolean).length / criteria.length) * 100);
}
