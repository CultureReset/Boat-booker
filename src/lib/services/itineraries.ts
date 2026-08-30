import { newId } from '@/lib/core/ids';
import { ITINERARY_MIN_STEPS_PER_DAY } from '@/lib/domain/types';
import type { AddOn, Database, Itinerary, ItineraryStep } from '@/lib/domain/types';

/**
 * Trip itineraries and paid add-ons.
 *
 * Both are operator-authored listing content, and both are gated on the same
 * principle: **a guest-facing promise cannot change under a booked customer.**
 *
 * For itineraries that means a published one must be unpublished before it can
 * be edited, and publishing needs at least two steps per day — a one-line
 * "we go boating" itinerary is worse than none, because it looks like detail
 * and carries none.
 */

export class ItineraryError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'invalid' | 'locked',
    message: string,
  ) {
    super(message);
    this.name = 'ItineraryError';
  }
}

function requireOwnership(db: Database, charterId: string, ownerId: string): void {
  const charter = db.charters.find((c) => c.id === charterId);
  if (!charter) throw new ItineraryError('not_found', 'Listing not found');
  if (charter.ownerId !== ownerId) throw new ItineraryError('forbidden', 'Not your listing');
}

export function itineraryFor(db: Database, packageId: string): Itinerary | undefined {
  return db.itineraries.find((i) => i.packageId === packageId);
}

/** The itinerary a guest should see: published only. */
export function publishedItinerary(db: Database, packageId: string): Itinerary | undefined {
  const itinerary = itineraryFor(db, packageId);
  return itinerary?.status === 'published' ? itinerary : undefined;
}

export interface SaveItineraryInput {
  ownerId: string;
  charterId: string;
  packageId: string;
  days: { steps: Omit<ItineraryStep, 'id'>[] }[];
}

/**
 * Creates or replaces the draft for a trip.
 *
 * Always writes a draft — publishing is a separate, deliberate act — so an
 * operator editing at the dock cannot accidentally push a half-finished plan
 * live.
 */
export function saveItinerary(db: Database, input: SaveItineraryInput): Itinerary {
  requireOwnership(db, input.charterId, input.ownerId);

  const pkg = db.packages.find((p) => p.id === input.packageId && p.charterId === input.charterId);
  if (!pkg) throw new ItineraryError('not_found', 'Trip not found');

  const existing = itineraryFor(db, input.packageId);
  if (existing?.status === 'published') {
    throw new ItineraryError('locked', 'Unpublish this itinerary before editing it');
  }

  const now = new Date().toISOString();
  const days = input.days.map((day) => ({
    steps: day.steps.slice(0, 20).map((step) => ({
      id: newId(),
      title: step.title.trim().slice(0, 120),
      description: step.description.trim().slice(0, 1000),
      durationMinutes: step.durationMinutes,
      isMeetingPoint: Boolean(step.isMeetingPoint),
    })),
  }));

  if (existing) {
    existing.days = days;
    existing.updatedAt = now;
    return existing;
  }

  const created: Itinerary = {
    id: newId(),
    charterId: input.charterId,
    packageId: input.packageId,
    status: 'draft',
    days,
    createdAt: now,
    updatedAt: now,
  };
  db.itineraries.push(created);
  return created;
}

/** Which days fall short of the publish gate, so the UI can say exactly where. */
export function publishBlockers(itinerary: Itinerary): number[] {
  return itinerary.days
    .map((day, index) => (day.steps.length < ITINERARY_MIN_STEPS_PER_DAY ? index : -1))
    .filter((index) => index >= 0);
}

export function publishItinerary(db: Database, itineraryId: string, ownerId: string): Itinerary {
  const itinerary = db.itineraries.find((i) => i.id === itineraryId);
  if (!itinerary) throw new ItineraryError('not_found', 'Itinerary not found');
  requireOwnership(db, itinerary.charterId, ownerId);

  if (!itinerary.days.length) throw new ItineraryError('invalid', 'Add at least one day');

  const blockers = publishBlockers(itinerary);
  if (blockers.length) {
    throw new ItineraryError(
      'invalid',
      `Add at least ${ITINERARY_MIN_STEPS_PER_DAY} steps to day ${blockers[0] + 1} before publishing`,
    );
  }

  itinerary.status = 'published';
  itinerary.publishedAt = new Date().toISOString();
  itinerary.updatedAt = itinerary.publishedAt;
  return itinerary;
}

export function unpublishItinerary(db: Database, itineraryId: string, ownerId: string): Itinerary {
  const itinerary = db.itineraries.find((i) => i.id === itineraryId);
  if (!itinerary) throw new ItineraryError('not_found', 'Itinerary not found');
  requireOwnership(db, itinerary.charterId, ownerId);

  itinerary.status = 'draft';
  itinerary.publishedAt = undefined;
  itinerary.updatedAt = new Date().toISOString();
  return itinerary;
}

export function deleteItinerary(db: Database, itineraryId: string, ownerId: string): void {
  const itinerary = db.itineraries.find((i) => i.id === itineraryId);
  if (!itinerary) throw new ItineraryError('not_found', 'Itinerary not found');
  requireOwnership(db, itinerary.charterId, ownerId);

  db.itineraries = db.itineraries.filter((i) => i.id !== itineraryId);
}

/* ------------------------------------------------------------------ add-ons */

export function addOnsFor(db: Database, charterId: string, activeOnly = true): AddOn[] {
  return db.addOns.filter((a) => a.charterId === charterId && (!activeOnly || a.active));
}

export interface SaveAddOnInput {
  ownerId: string;
  charterId: string;
  id?: string;
  title: string;
  description: string;
  price: number;
  pricing: AddOn['pricing'];
  maxQuantity: number;
  active: boolean;
}

export function saveAddOn(db: Database, input: SaveAddOnInput): AddOn {
  requireOwnership(db, input.charterId, input.ownerId);

  const charter = db.charters.find((c) => c.id === input.charterId)!;
  const title = input.title.trim();
  if (title.length < 2) throw new ItineraryError('invalid', 'Give the add-on a name');
  if (!(input.price > 0)) throw new ItineraryError('invalid', 'The price must be positive');

  const existing = input.id ? db.addOns.find((a) => a.id === input.id) : undefined;
  if (input.id && !existing) throw new ItineraryError('not_found', 'Add-on not found');
  if (existing && existing.charterId !== input.charterId) {
    throw new ItineraryError('forbidden', 'Not your add-on');
  }

  const record: AddOn = {
    id: existing?.id ?? newId(),
    charterId: input.charterId,
    title: title.slice(0, 80),
    description: input.description.trim().slice(0, 400),
    price: input.price,
    currency: charter.currency,
    pricing: input.pricing,
    maxQuantity: Math.max(1, Math.min(input.maxQuantity, charter.boat.capacity)),
    active: input.active,
  };

  if (existing) Object.assign(existing, record);
  else db.addOns.push(record);

  return record;
}

/**
 * Retires an add-on rather than deleting it when bookings reference it.
 *
 * A booking stores the add-on's title and price at the time of purchase, but
 * the id still points here, and a guest looking at last summer's receipt
 * should not see a broken row.
 */
export function removeAddOn(db: Database, addOnId: string, ownerId: string): 'deleted' | 'retired' {
  const addOn = db.addOns.find((a) => a.id === addOnId);
  if (!addOn) throw new ItineraryError('not_found', 'Add-on not found');
  requireOwnership(db, addOn.charterId, ownerId);

  const referenced = db.bookings.some((b) => b.addOns.some((a) => a.addOnId === addOnId));
  if (referenced) {
    addOn.active = false;
    return 'retired';
  }

  db.addOns = db.addOns.filter((a) => a.id !== addOnId);
  return 'deleted';
}
