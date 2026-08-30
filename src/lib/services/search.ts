import {
  activityByKey,
  boatTypes,
  departureWindowFor,
  durationCategories,
  filterableAmenities,
  type DepartureWindowKey,
  type DurationCategoryKey,
} from '@/config/taxonomy';
import { defaultCurrency } from '@/config/locale';
import type { Charter, Database, TripPackage } from '@/lib/domain/types';
import { buildBlockIndex, charterAvailability, nextAvailableDates } from './availability';
import { buildCharterCard, indexPackages, indexReviews, type CharterCard } from './charters';
import { minimumPriceFor } from './pricing';

/**
 * Search.
 *
 * The whole query — parsing, filtering, faceting, sorting, paging — lives here
 * so the web search page, the map view and the API all return identical
 * results for identical input. Facet counts are computed with the
 * "all filters except this one" rule, which is what stops a user from ticking
 * a box and being told there are zero results with no way back.
 */

export type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'distance' | 'newest';

export interface SearchQuery {
  destinationSlug?: string;
  /** Free-text match against listing title, destination and operator name. */
  q?: string;
  date?: string;
  days: number;
  adults: number;
  children: number;
  activities: string[];
  boatTypes: string[];
  amenities: string[];
  durations: DurationCategoryKey[];
  departureWindows: DepartureWindowKey[];
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  minCapacity?: number;
  instantBookOnly: boolean;
  freeCancellationOnly: boolean;
  tripType?: 'private' | 'shared';
  /** Geo search origin, used by "near me" and map bounds. */
  near?: { lat: number; lon: number; radiusKm: number };
  sort: SortKey;
  page: number;
  perPage: number;
  currency: string;
}

export const defaultSearchQuery = (): SearchQuery => ({
  days: 1,
  adults: 2,
  children: 0,
  activities: [],
  boatTypes: [],
  amenities: [],
  durations: [],
  departureWindows: [],
  instantBookOnly: false,
  freeCancellationOnly: false,
  sort: 'recommended',
  page: 1,
  perPage: 12,
  currency: defaultCurrency,
});

const SORT_ALIASES: Record<string, SortKey> = {
  '-recommended': 'recommended',
  recommended: 'recommended',
  price: 'price_asc',
  price_asc: 'price_asc',
  '-price': 'price_desc',
  price_desc: 'price_desc',
  rating: 'rating',
  '-rating': 'rating',
  distance: 'distance',
  newest: 'newest',
  '-newest': 'newest',
};

/** Parse a `URLSearchParams` into a validated query. Unknown values are dropped. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery {
  const base = defaultSearchQuery();

  const list = (key: string) =>
    (params.getAll(key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean));

  const int = (key: string, fallback: number, min: number, max: number) => {
    const raw = Number(params.get(key));
    if (!Number.isFinite(raw)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(raw)));
  };

  const optionalNumber = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const validActivities = new Set(
    Array.from(activityByKey.values()).map((a) => a.slug),
  );
  const validBoatTypes = new Set(boatTypes.map((b) => b.slug));
  const validAmenities = new Set(filterableAmenities.map((a) => a.key));
  const validDurations = new Set(durationCategories.map((d) => d.key));

  const date = params.get('date') ?? undefined;

  const near = (() => {
    const lat = optionalNumber('lat');
    const lon = optionalNumber('lon');
    if (lat === undefined || lon === undefined) return undefined;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
    return { lat, lon, radiusKm: optionalNumber('radius') ?? 120 };
  })();

  return {
    ...base,
    destinationSlug: params.get('destination') ?? undefined,
    q: params.get('q')?.trim() || undefined,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    days: int('days', 1, 1, 30),
    adults: int('adults', 2, 1, 60),
    children: int('children', 0, 0, 40),
    activities: list('activities').filter((v) => validActivities.has(v)),
    boatTypes: list('boat_types').filter((v) => validBoatTypes.has(v)),
    amenities: list('amenities').filter((v) => validAmenities.has(v)),
    durations: list('durations').filter((v): v is DurationCategoryKey => validDurations.has(v as DurationCategoryKey)),
    departureWindows: list('departure').filter((v): v is DepartureWindowKey =>
      ['early_morning', 'morning', 'afternoon', 'evening', 'night'].includes(v),
    ),
    priceMin: optionalNumber('price_min'),
    priceMax: optionalNumber('price_max'),
    minRating: optionalNumber('rating'),
    minCapacity: optionalNumber('capacity'),
    instantBookOnly: params.get('instant_book') === 'true',
    freeCancellationOnly: params.get('free_cancellation') === 'true',
    tripType: params.get('trip_type') === 'private' || params.get('trip_type') === 'shared'
      ? (params.get('trip_type') as 'private' | 'shared')
      : undefined,
    near,
    sort: SORT_ALIASES[params.get('sort') ?? ''] ?? 'recommended',
    page: int('page', 1, 1, 500),
    perPage: int('per_page', 12, 1, 48),
    currency: (params.get('currency') ?? defaultCurrency).toUpperCase(),
  };
}

/** Serialise a query back into a URL, omitting defaults to keep links short. */
export function serializeSearchQuery(query: Partial<SearchQuery>): string {
  const params = new URLSearchParams();
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      return;
    }
    params.set(key, String(value));
  };

  set('destination', query.destinationSlug);
  set('q', query.q);
  set('date', query.date);
  if (query.days && query.days !== 1) set('days', query.days);
  if (query.adults !== undefined && query.adults !== 2) set('adults', query.adults);
  if (query.children) set('children', query.children);
  set('activities', query.activities);
  set('boat_types', query.boatTypes);
  set('amenities', query.amenities);
  set('durations', query.durations);
  set('departure', query.departureWindows);
  set('price_min', query.priceMin);
  set('price_max', query.priceMax);
  set('rating', query.minRating);
  set('capacity', query.minCapacity);
  set('instant_book', query.instantBookOnly);
  set('free_cancellation', query.freeCancellationOnly);
  set('trip_type', query.tripType);
  if (query.near) {
    set('lat', query.near.lat.toFixed(5));
    set('lon', query.near.lon.toFixed(5));
    if (query.near.radiusKm !== 120) set('radius', query.near.radiusKm);
  }
  if (query.sort && query.sort !== 'recommended') set('sort', query.sort);
  if (query.page && query.page > 1) set('page', query.page);
  if (query.perPage && query.perPage !== 12) set('per_page', query.perPage);
  if (query.currency && query.currency !== defaultCurrency) set('currency', query.currency);

  return params.toString();
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface FacetOption {
  key: string;
  title: string;
  count: number;
  selected: boolean;
}

export interface FacetGroup {
  key: string;
  title: string;
  kind: 'checkbox' | 'range' | 'toggle' | 'radio';
  options: FacetOption[];
  /** Present on range facets. */
  range?: { min: number; max: number; selectedMin?: number; selectedMax?: number; histogram: number[] };
}

export interface SearchResult {
  charters: CharterCard[];
  facets: FacetGroup[];
  metadata: {
    page: number;
    perPage: number;
    pageCount: number;
    totalCount: number;
    availableCount: number;
    destination?: { id: string; slug: string; title: string; blurb: string; stateAbbrev?: string; countryTitle: string };
    /** Populated when the requested date has no availability at all. */
    nextAvailableDates: string[];
    /** Suggested alternatives when the destination itself is empty. */
    nearbyDestinations: { slug: string; title: string; charterCount: number; distanceKm: number }[];
    priceBounds: { min: number; max: number };
  };
}

/** Filter dimensions, named so facet counts can exclude one at a time. */
type PredicateKey =
  | 'activities' | 'boatTypes' | 'amenities' | 'durations' | 'departure'
  | 'price' | 'rating' | 'capacity' | 'instant' | 'freeCancellation' | 'tripType';

type PassingFn = (c: Candidate, except?: PredicateKey) => boolean;

interface Candidate {
  charter: Charter;
  packages: TripPackage[];
  distanceKm?: number;
  minPrice: number | null;
  rating: number;
  reviewCount: number;
  available: boolean;
}

export function search(db: Database, query: SearchQuery): SearchResult {
  const packagesByCharter = indexPackages(db);
  const reviewsByCharter = indexReviews(db);
  const blockIndex = buildBlockIndex(db);

  const destination = query.destinationSlug
    ? db.destinations.find((d) => d.slug === query.destinationSlug)
    : undefined;

  const origin = query.near ?? (destination ? { ...destination.geoPoint, radiusKm: 80 } : undefined);
  const guests = query.adults + query.children;

  // --- Stage 1: candidate set (geography + text) ---------------------------
  const candidates: Candidate[] = [];

  for (const charter of db.charters) {
    if (!charter.published || charter.snoozed) continue;

    const packages = packagesByCharter.get(charter.id) ?? [];
    if (!packages.length) continue;

    if (destination && charter.destinationId !== destination.id && !query.near) continue;

    let distanceKm: number | undefined;
    if (origin) {
      distanceKm = haversineKm(origin, charter.geoPoint);
      if (query.near && distanceKm > query.near.radiusKm) continue;
    }

    if (query.q) {
      const needle = query.q.toLowerCase();
      const dest = db.destinations.find((d) => d.id === charter.destinationId);
      const owner = db.users.find((u) => u.id === charter.ownerId);
      const haystack = [
        charter.title,
        charter.shortDescription,
        dest?.title ?? '',
        owner?.ownerProfile?.companyName ?? '',
        charter.boat.type,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) continue;
    }

    const reviews = reviewsByCharter.get(charter.id) ?? [];
    const ratingSum = reviews.reduce((sum, r) => sum + r.rating, 0);
    const cheapest = minimumPriceFor(charter, packages, query.currency, Math.max(1, guests));

    const availability = charterAvailability({
      charter,
      packages,
      date: query.date,
      guests,
      days: query.days,
      blockIndex,
    });

    candidates.push({
      charter,
      packages,
      distanceKm,
      minPrice: cheapest?.amount ?? null,
      rating: reviews.length ? ratingSum / reviews.length : 0,
      reviewCount: reviews.length,
      available: availability.available,
    });
  }

  // --- Stage 2: filters ----------------------------------------------------
  // Each predicate is separable so facet counts can re-run the set minus one.
  const predicates: Record<PredicateKey, (c: Candidate) => boolean> = {
    activities: (c) =>
      !query.activities.length ||
      query.activities.every((slug) =>
        c.charter.activityKeys.some((key) => activityByKey.get(key)?.slug === slug),
      ),
    boatTypes: (c) =>
      !query.boatTypes.length ||
      query.boatTypes.some((slug) => boatTypes.find((b) => b.slug === slug)?.title === c.charter.boat.type),
    amenities: (c) =>
      !query.amenities.length || query.amenities.every((key) => c.charter.amenities[key] === true),
    durations: (c) =>
      !query.durations.length || c.packages.some((p) => query.durations.includes(p.durationCategory)),
    departure: (c) =>
      !query.departureWindows.length ||
      c.packages.some((p) => p.departureTimes.some((t) => query.departureWindows.includes(departureWindowFor(t)))),
    price: (c) => {
      if (c.minPrice === null) return query.priceMin === undefined && query.priceMax === undefined;
      if (query.priceMin !== undefined && c.minPrice < query.priceMin) return false;
      if (query.priceMax !== undefined && c.minPrice > query.priceMax) return false;
      return true;
    },
    rating: (c) => query.minRating === undefined || (c.reviewCount > 0 && c.rating >= query.minRating),
    capacity: (c) => query.minCapacity === undefined || c.charter.boat.capacity >= query.minCapacity,
    instant: (c) => !query.instantBookOnly || c.charter.policies.isInstantBookActive,
    freeCancellation: (c) =>
      !query.freeCancellationOnly || c.charter.policies.freeCancellationDaysInAdvance > 0,
    tripType: (c) => !query.tripType || c.packages.some((p) => p.type === query.tripType),
  };

  const allKeys = Object.keys(predicates) as PredicateKey[];
  const passing = (c: Candidate, except?: PredicateKey) =>
    allKeys.every((key) => key === except || predicates[key](c));

  const filtered = candidates.filter((c) => passing(c));

  // --- Stage 3: sort -------------------------------------------------------
  const sorted = [...filtered].sort((a, b) => {
    // Unavailable listings always sink, whatever the sort — a guest should not
    // scroll past boats they cannot book on the date they asked for.
    if (a.available !== b.available) return a.available ? -1 : 1;

    switch (query.sort) {
      case 'price_asc':
        return (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity);
      case 'price_desc':
        return (b.minPrice ?? -Infinity) - (a.minPrice ?? -Infinity);
      case 'rating':
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
      case 'distance':
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      case 'newest':
        return new Date(b.charter.createdAt).getTime() - new Date(a.charter.createdAt).getTime();
      default:
        return recommendationScore(b) - recommendationScore(a);
    }
  });

  // --- Stage 4: page -------------------------------------------------------
  const totalCount = sorted.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / query.perPage));
  const page = Math.min(query.page, pageCount);
  const slice = sorted.slice((page - 1) * query.perPage, page * query.perPage);

  const cards = slice.map((candidate) => {
    const dest = db.destinations.find((d) => d.id === candidate.charter.destinationId)!;
    const country = db.countries.find((c) => c.id === dest.countryId);
    const state = dest.stateId ? db.states.find((s) => s.id === dest.stateId) : undefined;
    return buildCharterCard({
      charter: candidate.charter,
      packages: candidate.packages,
      reviews: reviewsByCharter.get(candidate.charter.id) ?? [],
      destination: dest,
      countryTitle: country?.title ?? '',
      stateAbbrev: state?.abbrev,
      currency: query.currency,
      guests,
      availability: { available: candidate.available, packages: [] },
      distanceKm: candidate.distanceKm,
    });
  });

  // --- Stage 5: facets -----------------------------------------------------
  const facets = buildFacets(query, candidates, passing);

  // --- Stage 6: fallbacks --------------------------------------------------
  const availableCount = sorted.filter((c) => c.available).length;

  const nextDates =
    query.date && availableCount === 0 && filtered.length
      ? nextAvailableDates({
          packages: filtered.flatMap((c) => c.packages),
          from: query.date,
          guests,
          days: query.days,
          blockIndex,
          limit: 3,
        })
      : [];

  const nearby =
    destination && totalCount === 0
      ? db.destinations
          .filter((d) => d.id !== destination.id)
          .map((d) => ({
            slug: d.slug,
            title: d.title,
            distanceKm: haversineKm(destination.geoPoint, d.geoPoint),
            charterCount: db.charters.filter((c) => c.destinationId === d.id && c.published).length,
          }))
          .filter((d) => d.charterCount > 0)
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 6)
      : [];

  const prices = candidates.map((c) => c.minPrice).filter((p): p is number => p !== null);

  const destCountry = destination ? db.countries.find((c) => c.id === destination.countryId) : undefined;
  const destState = destination?.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;

  return {
    charters: cards,
    facets,
    metadata: {
      page,
      perPage: query.perPage,
      pageCount,
      totalCount,
      availableCount,
      destination: destination
        ? {
            id: destination.id,
            slug: destination.slug,
            title: destination.title,
            blurb: destination.blurb,
            stateAbbrev: destState?.abbrev,
            countryTitle: destCountry?.title ?? '',
          }
        : undefined,
      nextAvailableDates: nextDates,
      nearbyDestinations: nearby,
      priceBounds: {
        min: prices.length ? Math.floor(Math.min(...prices)) : 0,
        max: prices.length ? Math.ceil(Math.max(...prices)) : 0,
      },
    },
  };
}

/**
 * Ranking for the default sort.
 *
 * Deliberately transparent: quality signals the guest can see on the card
 * (rating, review volume, instant book, free cancellation) plus a small
 * freshness term so new listings are not buried forever. No paid placement.
 */
function recommendationScore(c: Candidate): number {
  const ratingTerm = c.rating * 12;
  // Diminishing returns on volume so a 400-review listing does not dominate.
  const volumeTerm = Math.log10(c.reviewCount + 1) * 14;
  const instantTerm = c.charter.policies.isInstantBookActive ? 8 : 0;
  const cancellationTerm = Math.min(c.charter.policies.freeCancellationDaysInAdvance, 7);
  const awardTerm = c.charter.hasBoatersChoiceAward ? 10 : 0;
  const verifiedTerm = c.charter.verificationBadge === 'enhanced' ? 6 : c.charter.verificationBadge ? 3 : 0;
  const demandTerm = Math.min(c.charter.viewsLast7Days / 60, 8);
  const proximityTerm = c.distanceKm === undefined ? 0 : Math.max(0, 10 - c.distanceKm / 12);
  const completenessTerm = Math.min(c.charter.photos.length, 8);

  return (
    ratingTerm + volumeTerm + instantTerm + cancellationTerm + awardTerm +
    verifiedTerm + demandTerm + proximityTerm + completenessTerm
  );
}

function buildFacets(
  query: SearchQuery,
  candidates: Candidate[],
  passing: PassingFn,
): FacetGroup[] {
  // Count each facet against the set filtered by every *other* facet, so
  // ticking one option never zeroes out its siblings.
  const withoutActivities = candidates.filter((c) => passing(c, 'activities'));
  const withoutBoatTypes = candidates.filter((c) => passing(c, 'boatTypes'));
  const withoutAmenities = candidates.filter((c) => passing(c, 'amenities'));
  const withoutDurations = candidates.filter((c) => passing(c, 'durations'));
  const withoutDeparture = candidates.filter((c) => passing(c, 'departure'));
  const withoutPrice = candidates.filter((c) => passing(c, 'price'));
  const withoutRating = candidates.filter((c) => passing(c, 'rating'));
  const withoutCapacity = candidates.filter((c) => passing(c, 'capacity'));
  const withoutBooking = candidates.filter(
    (c) => passing(c, 'instant') && passing(c, 'freeCancellation'),
  );
  const withoutTripType = candidates.filter((c) => passing(c, 'tripType'));

  const activityOptions: FacetOption[] = Array.from(
    new Map(Array.from(activityByKey.values()).map((a) => [a.slug, a])).values(),
  )
    .map((activity) => ({
      key: activity.slug,
      title: activity.title,
      count: withoutActivities.filter((c) =>
        c.charter.activityKeys.some((key) => activityByKey.get(key)?.slug === activity.slug),
      ).length,
      selected: query.activities.includes(activity.slug),
    }))
    .filter((o) => o.count > 0 || o.selected)
    .sort((a, b) => b.count - a.count);

  const boatTypeOptions: FacetOption[] = boatTypes
    .map((type) => ({
      key: type.slug,
      title: type.title,
      count: withoutBoatTypes.filter((c) => c.charter.boat.type === type.title).length,
      selected: query.boatTypes.includes(type.slug),
    }))
    .filter((o) => o.count > 0 || o.selected)
    .sort((a, b) => b.count - a.count);

  const amenityOptions: FacetOption[] = filterableAmenities
    .map((amenity) => ({
      key: amenity.key,
      title: amenity.title,
      count: withoutAmenities.filter((c) => c.charter.amenities[amenity.key] === true).length,
      selected: query.amenities.includes(amenity.key),
    }))
    .filter((o) => o.count > 0 || o.selected)
    .sort((a, b) => b.count - a.count);

  const durationOptions: FacetOption[] = durationCategories
    .map((duration) => ({
      key: duration.key,
      title: duration.title,
      count: withoutDurations.filter((c) => c.packages.some((p) => p.durationCategory === duration.key)).length,
      selected: query.durations.includes(duration.key),
    }))
    .filter((o) => o.count > 0 || o.selected);

  const departureOptions: FacetOption[] = (
    [
      { key: 'early_morning', title: 'Early morning' },
      { key: 'morning', title: 'Morning' },
      { key: 'afternoon', title: 'Afternoon' },
      { key: 'evening', title: 'Evening' },
      { key: 'night', title: 'Night' },
    ] as const
  )
    .map((window) => ({
      key: window.key,
      title: window.title,
      count: withoutDeparture.filter((c) =>
        c.packages.some((p) => p.departureTimes.some((t) => departureWindowFor(t) === window.key)),
      ).length,
      selected: query.departureWindows.includes(window.key),
    }))
    .filter((o) => o.count > 0 || o.selected);

  const ratingOptions: FacetOption[] = [4.5, 4, 3.5, 3].map((score) => ({
    key: String(score),
    title: `${score}+`,
    count: withoutRating.filter((c) => c.reviewCount > 0 && c.rating >= score).length,
    selected: query.minRating === score,
  }));

  const capacityOptions: FacetOption[] = [2, 4, 6, 8, 12, 20].map((size) => ({
    key: String(size),
    title: `${size}+ guests`,
    count: withoutCapacity.filter((c) => c.charter.boat.capacity >= size).length,
    selected: query.minCapacity === size,
  }));

  const prices = withoutPrice.map((c) => c.minPrice).filter((p): p is number => p !== null);
  const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const max = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  // 20-bucket histogram so the price slider shows where the inventory sits.
  const buckets = 20;
  const histogram = new Array(buckets).fill(0);
  if (max > min) {
    for (const price of prices) {
      const index = Math.min(buckets - 1, Math.floor(((price - min) / (max - min)) * buckets));
      histogram[index] += 1;
    }
  }

  return [
    {
      key: 'booking_options',
      title: 'Booking options',
      kind: 'toggle',
      options: [
        {
          key: 'instant_book',
          title: 'Instant Book',
          count: withoutBooking.filter((c) => c.charter.policies.isInstantBookActive).length,
          selected: query.instantBookOnly,
        },
        {
          key: 'free_cancellation',
          title: 'Free cancellation',
          count: withoutBooking.filter((c) => c.charter.policies.freeCancellationDaysInAdvance > 0).length,
          selected: query.freeCancellationOnly,
        },
      ],
    },
    {
      key: 'price',
      title: 'Price range',
      kind: 'range',
      options: [],
      range: { min, max, selectedMin: query.priceMin, selectedMax: query.priceMax, histogram },
    },
    {
      key: 'trip_type',
      title: 'Trip type',
      kind: 'radio',
      options: [
        {
          key: 'private',
          title: 'Private trip',
          count: withoutTripType.filter((c) => c.packages.some((p) => p.type === 'private')).length,
          selected: query.tripType === 'private',
        },
        {
          key: 'shared',
          title: 'Shared trip',
          count: withoutTripType.filter((c) => c.packages.some((p) => p.type === 'shared')).length,
          selected: query.tripType === 'shared',
        },
      ],
    },
    { key: 'durations', title: 'Trip duration', kind: 'checkbox', options: durationOptions },
    { key: 'departure', title: 'Departure time', kind: 'checkbox', options: departureOptions },
    { key: 'activities', title: 'Activity', kind: 'checkbox', options: activityOptions },
    { key: 'boat_types', title: 'Boat type', kind: 'checkbox', options: boatTypeOptions },
    { key: 'capacity', title: 'Boat capacity', kind: 'radio', options: capacityOptions },
    { key: 'amenities', title: 'Amenities', kind: 'checkbox', options: amenityOptions },
    { key: 'rating', title: 'Review score', kind: 'radio', options: ratingOptions },
  ];
}

/** Destination autocomplete for the search box. */
export function suggestDestinations(db: Database, term: string, limit = 8) {
  const needle = term.trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    counts.set(charter.destinationId, (counts.get(charter.destinationId) ?? 0) + 1);
  }

  const scored = db.destinations
    .map((destination) => {
      const country = db.countries.find((c) => c.id === destination.countryId);
      const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;
      const label = [destination.title, state?.abbrev, country?.title].filter(Boolean).join(', ');
      const title = destination.title.toLowerCase();

      let score = -1;
      if (!needle) score = destination.popular ? 2 : 1;
      else if (title.startsWith(needle)) score = 3;
      else if (title.includes(needle)) score = 2;
      else if (label.toLowerCase().includes(needle)) score = 1;

      return {
        slug: destination.slug,
        title: destination.title,
        label,
        charterCount: counts.get(destination.id) ?? 0,
        geoPoint: destination.geoPoint,
        score,
      };
    })
    .filter((d) => d.score > 0 && d.charterCount > 0)
    .sort((a, b) => b.score - a.score || b.charterCount - a.charterCount)
    .slice(0, limit);

  return scored;
}
