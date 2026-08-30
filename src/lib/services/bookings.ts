import { commerceConfig } from '@/config/brand';
import { addDays, daysBetween, isPast, today } from '@/lib/core/dates';
import { newBookingReference, newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import { bookingExtras } from '@/lib/domain/defaults';
import type {
  AddOn,
  Booking,
  BookingAddOn,
  BookingSource,
  BookingStatus,
  CancellationReasonKey,
  Database,
  NotificationCategory,
  PaymentMode,
  PriceBreakdown,
} from '@/lib/domain/types';
import { buildBlockIndex, packageAvailability, releaseDates, reserveDates } from './availability';
import { notify } from './notifications';
import { assertOfferBookable, markOfferAccepted } from './offers';
import { computeBreakdown, loyaltyTierFor, refundFor } from './pricing';

/**
 * Booking lifecycle.
 *
 * Statuses move in one direction only:
 *
 *   pending ──accept──▶ confirmed/accepted ──trip date passes──▶ done
 *      │                    │
 *      ├──decline──▶ declined   └──cancel──▶ cancelled
 *      └──window elapses──▶ withdrawn
 *
 * `done` rather than "completed", and a lapsed request becomes `withdrawn`,
 * both to match the vocabulary the platform shows its own users.
 *
 * Every transition that frees a date releases the calendar block, and every
 * transition that takes one reserves it, so the calendar can never drift from
 * the booking table.
 */

export class BookingError extends Error {
  constructor(
    readonly code:
      | 'charter_not_found'
      | 'package_not_found'
      | 'unavailable'
      | 'capacity_exceeded'
      | 'min_persons'
      | 'past_date'
      | 'invalid_date'
      | 'not_found'
      | 'forbidden'
      | 'invalid_transition',
    message: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export interface QuoteInput {
  charterId: string;
  packageId: string;
  date: string;
  adults: number;
  children: number;
  days: number;
  paymentMode: PaymentMode;
  currency: string;
  customerId?: string;
  promoDiscount?: number;
  applyCredit?: boolean;
  /** Add-on id → quantity. */
  addOns?: Record<string, number>;
  /** Price agreed in a custom offer, replacing the package's list price. */
  agreedTripPrice?: number;
}

export interface Quote {
  breakdown: PriceBreakdown;
  available: boolean;
  reason?: string;
  freeCancellationUntil: string | null;
  instantBook: boolean;
  loyaltyDiscountPercent: number;
  creditApplied: number;
}

/**
 * Price and availability for a prospective booking. Checkout renders this and
 * `createBooking` recomputes it server-side, so a tampered client price is
 * simply ignored.
 */
export function quote(db: Database, input: QuoteInput): Quote {
  const charter = db.charters.find((c) => c.id === input.charterId);
  if (!charter) throw new BookingError('charter_not_found', 'Listing not found');

  const pkg = db.packages.find((p) => p.id === input.packageId && p.charterId === charter.id);
  if (!pkg) throw new BookingError('package_not_found', 'Trip not found');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new BookingError('invalid_date', 'Invalid trip date');
  }

  const guests = input.adults + input.children;
  const availability = packageAvailability({
    pkg,
    date: input.date,
    guests,
    days: input.days,
    blockIndex: buildBlockIndex(db),
  });

  const customer = input.customerId ? db.users.find((u) => u.id === input.customerId) : undefined;
  const loyalty = customer ? loyaltyTierFor(customer.completedTrips) : { discountPercentage: 0 };

  // Credit is capped at the customer's balance and never turns a booking into
  // a refund, which `computeBreakdown` enforces by clamping to the total.
  const creditAvailable = input.applyCredit && customer ? customer.creditBalance : 0;

  const breakdown = computeBreakdown({
    charter,
    pkg,
    adults: input.adults,
    children: input.children,
    days: input.days,
    paymentMode: input.paymentMode,
    currency: input.currency,
    loyaltyDiscountPercent: loyalty.discountPercentage,
    creditApplied: creditAvailable,
    promoDiscount: input.promoDiscount,
    addOns: resolveAddOnLines(db, charter.id, input.addOns),
    agreedTripPrice: input.agreedTripPrice,
  });

  const creditLine = breakdown.lines.find((l) => l.key === 'credit');

  const freeDays = charter.policies.freeCancellationDaysInAdvance;

  return {
    breakdown,
    available: availability.available,
    reason: availability.reason,
    freeCancellationUntil: freeDays > 0 ? addDays(input.date, -freeDays) : null,
    instantBook: charter.policies.isInstantBookActive,
    loyaltyDiscountPercent: loyalty.discountPercentage,
    creditApplied: creditLine ? Math.abs(creditLine.amount) : 0,
  };
}

export interface CreateBookingInput extends QuoteInput {
  customerId: string;
  departureTime: string;
  contact: { firstName: string; lastName: string; email: string; phone: string };
  messageToOwner?: string;
  paymentMethodId?: string;
  /** Accepting an operator's custom offer rather than booking off the listing. */
  offerId?: string;
  /** Paid extras, as add-on id → quantity. */
  addOns?: Record<string, number>;
  /** Direct and manual bookings skip commission; the caller vouches for this. */
  source?: BookingSource;
  /** Invitees to add to the trip at checkout. */
  buddyEmails?: string[];
}

/**
 * Create a booking.
 *
 * Availability is re-checked and the calendar days claimed inside the same
 * synchronous mutation, so two guests racing for the last date cannot both
 * win — the second `reserveDates` call sees the first one's block.
 */
export function createBooking(db: Database, input: CreateBookingInput): Booking {
  const charter = db.charters.find((c) => c.id === input.charterId);
  if (!charter) throw new BookingError('charter_not_found', 'Listing not found');

  // An accepted offer carries its own price and its own availability check.
  // Validating it here — before anything else runs — means a stale or hijacked
  // offer id can never reach the pricing engine.
  const offer = input.offerId
    ? assertOfferBookable(db, input.offerId, input.customerId).offer
    : undefined;

  const pkg = db.packages.find((p) => p.id === input.packageId && p.charterId === charter.id);
  if (!pkg) throw new BookingError('package_not_found', 'Trip not found');

  if (isPast(input.date)) throw new BookingError('past_date', 'Trip date is in the past');

  const guests = input.adults + input.children;
  if (guests > pkg.capacity) {
    throw new BookingError('capacity_exceeded', 'Group is larger than this trip allows');
  }
  if (guests < pkg.minPersons) {
    throw new BookingError('min_persons', 'Group is smaller than this trip allows');
  }

  const availability = packageAvailability({
    pkg,
    date: input.date,
    guests,
    days: input.days,
    blockIndex: buildBlockIndex(db),
  });
  if (!availability.available) {
    throw new BookingError('unavailable', availability.reason ?? 'Not available');
  }

  // Recompute the price server-side; the client's number is never trusted.
  const priced = quote(db, { ...input, agreedTripPrice: offer?.price });

  // An offer is the operator already saying yes, so accepting one confirms
  // immediately even on a listing that normally takes requests.
  const instant = charter.policies.isInstantBookActive || Boolean(offer);
  const status: BookingStatus = instant ? 'confirmed' : 'pending';
  const nowIso = new Date().toISOString();

  const booking: Booking = {
    ...bookingExtras(priced.breakdown.dueOnArrival, priced.breakdown.currency),
    id: newId(),
    reference: newBookingReference(),
    charterId: charter.id,
    packageId: pkg.id,
    customerId: input.customerId,
    ownerId: charter.ownerId,
    status,
    date: input.date,
    departureTime: pkg.departureTimes.includes(input.departureTime)
      ? input.departureTime
      : pkg.departureTimes[0],
    adults: input.adults,
    children: input.children,
    days: input.days,
    currency: priced.breakdown.currency,
    breakdown: priced.breakdown,
    paymentMode: input.paymentMode,
    paymentMethodId: input.paymentMethodId,
    messageToOwner: input.messageToOwner,
    contact: input.contact,
    createdAt: nowIso,
    confirmedAt: instant ? nowIso : undefined,
    respondByAt: instant
      ? undefined
      : new Date(Date.now() + commerceConfig.inquiryResponseWindowHours * 3_600_000).toISOString(),
    source: input.source ?? 'marketplace',
    offerId: offer?.id,
    addOns: resolveAddOns(db, charter.id, input.addOns),
    buddyInvitations: (input.buddyEmails ?? []).slice(0, 10).map((email) => ({
      id: newId(),
      email: email.trim().toLowerCase(),
      invitedAt: nowIso,
    })),
  };

  // A pending request also holds the date — otherwise the owner could accept a
  // request for a day that was sold underneath them.
  if (!reserveDates(db, booking, () => newId())) {
    throw new BookingError('unavailable', 'Those dates were just taken');
  }

  db.bookings.push(booking);

  // Spend the credit that was applied to this booking.
  if (priced.creditApplied > 0) {
    const customer = db.users.find((u) => u.id === input.customerId);
    if (customer) {
      customer.creditBalance = roundMoney(Math.max(0, customer.creditBalance - priced.creditApplied));
    }
  }

  if (status === 'confirmed') schedulePayout(db, booking);

  // A booking that came from an offer continues the conversation it was
  // negotiated in — starting a second thread would strand the context that
  // explains the price.
  const existingThread = offer && db.threads.find((t) => t.id === offer.threadId);
  const thread =
    existingThread ??
    (() => {
      const created = {
        id: newId(),
        customerId: input.customerId,
        ownerId: charter.ownerId,
        charterId: charter.id,
        bookingId: booking.id,
        kind: 'booking' as const,
        subject: charter.title,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.threads.push(created);
      return created;
    })();

  if (existingThread) {
    existingThread.bookingId = booking.id;
    existingThread.kind = 'booking';
    existingThread.updatedAt = nowIso;
  }

  if (offer) markOfferAccepted(db, offer.id, booking.id);

  db.messages.push({
    id: newId(),
    threadId: thread.id,
    body: '',
    createdAt: nowIso,
    deliveredAt: nowIso,
    systemEvent: instant ? 'booking_confirmed' : 'booking_requested',
  });

  if (input.messageToOwner?.trim()) {
    db.messages.push({
      id: newId(),
      threadId: thread.id,
      senderId: input.customerId,
      body: input.messageToOwner.trim(),
      createdAt: nowIso,
    });
  }

  notify(db, charter.ownerId, {
    type: 'booking_new',
    category: 'booking',
    title: instant ? 'New booking confirmed' : 'New booking request',
    body: `${input.contact.firstName} ${input.contact.lastName} · ${booking.date} · ${guests} guests`,
    href: `/owner/bookings/${booking.id}`,
  });

  return booking;
}

export function acceptBooking(db: Database, bookingId: string, ownerId: string): Booking {
  const booking = requireBooking(db, bookingId);
  if (booking.ownerId !== ownerId) throw new BookingError('forbidden', 'Not your booking');
  if (booking.status !== 'pending') {
    throw new BookingError('invalid_transition', 'Only pending bookings can be accepted');
  }

  booking.status = 'confirmed';
  booking.confirmedAt = new Date().toISOString();
  schedulePayout(db, booking);

  notify(db, booking.customerId, {
    type: 'booking_accepted_customer',
    category: 'booking',
    title: 'Your trip is confirmed',
    body: `Booking ${booking.reference} on ${booking.date} is confirmed.`,
    href: `/account/bookings/${booking.id}`,
  });

  return booking;
}

export function declineBooking(
  db: Database,
  bookingId: string,
  ownerId: string,
  reason?: string,
): Booking {
  const booking = requireBooking(db, bookingId);
  if (booking.ownerId !== ownerId) throw new BookingError('forbidden', 'Not your booking');
  if (booking.status !== 'pending') {
    throw new BookingError('invalid_transition', 'Only pending bookings can be declined');
  }

  booking.status = 'declined';
  booking.cancelledAt = new Date().toISOString();
  booking.cancellationReason = reason as CancellationReasonKey | undefined;
  releaseDates(db, booking.id);
  refundCredit(db, booking);

  notify(db, booking.customerId, {
    type: 'booking_declined_customer',
    category: 'booking',
    title: 'Booking request declined',
    body: reason
      ? `${booking.reference} was declined: ${reason}`
      : `${booking.reference} was declined by the owner.`,
    href: `/account/bookings/${booking.id}`,
  });

  return booking;
}

export interface CancellationOutcome {
  booking: Booking;
  refund: number;
  forfeited: number;
  free: boolean;
}

/** Cancel as the customer. Refund follows the listing's cancellation policy. */
export function cancelBooking(
  db: Database,
  bookingId: string,
  actorId: string,
  reason?: string,
): CancellationOutcome {
  const booking = requireBooking(db, bookingId);

  const isCustomer = booking.customerId === actorId;
  const isOwner = booking.ownerId === actorId;
  if (!isCustomer && !isOwner) throw new BookingError('forbidden', 'Not your booking');

  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    throw new BookingError('invalid_transition', 'This booking can no longer be cancelled');
  }

  const charter = db.charters.find((c) => c.id === booking.charterId);
  const daysUntil = daysBetween(today(), booking.date);

  // An owner cancelling is always a full refund — the guest did nothing wrong.
  const outcome = isOwner
    ? { refund: booking.breakdown.dueNow, forfeited: 0, free: true }
    : refundFor(booking.breakdown, charter?.policies.freeCancellationDaysInAdvance ?? 0, daysUntil);

  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();
  booking.cancellationReason = reason as CancellationReasonKey | undefined;
  booking.refundAmount = outcome.refund;

  releaseDates(db, booking.id);
  refundCredit(db, booking);

  // Any payout scheduled against this booking is withdrawn.
  db.payouts = db.payouts.filter((p) => !(p.bookingId === booking.id && p.status === 'pending'));

  notify(db, isCustomer ? booking.ownerId : booking.customerId, {
    type: 'booking_canceled_by_customer_captain',
    category: 'booking',
    title: 'Booking cancelled',
    body: `${booking.reference} on ${booking.date} was cancelled.`,
    href: isCustomer ? `/owner/bookings/${booking.id}` : `/account/bookings/${booking.id}`,
  });

  return { booking, ...outcome };
}

/**
 * Advance bookings whose trip date has passed. Idempotent, so it can run on
 * every request without double-counting completed trips.
 */
export function settleElapsedBookings(db: Database): number {
  const now = new Date().toISOString();
  const cutoff = today();
  let changed = 0;

  for (const booking of db.bookings) {
    if (booking.status === 'confirmed' && booking.date < cutoff) {
      booking.status = 'done';
      changed += 1;

      const customer = db.users.find((u) => u.id === booking.customerId);
      if (customer) customer.completedTrips += 1;

      const payout = db.payouts.find((p) => p.bookingId === booking.id);
      if (payout && payout.status === 'pending') {
        payout.status = 'paid';
        payout.paidAt = now;
      }
    }

    // A request the owner never answered releases its hold.
    if (booking.status === 'pending' && booking.respondByAt && booking.respondByAt < now) {
      booking.status = 'withdrawn';
      releaseDates(db, booking.id);
      refundCredit(db, booking);
      changed += 1;
    }
  }

  return changed;
}

function schedulePayout(db: Database, booking: Booking): void {
  if (db.payouts.some((p) => p.bookingId === booking.id)) return;

  const gross = booking.breakdown.total;
  const platformFee = roundMoney(gross * commerceConfig.serviceFeeRate, booking.currency);

  db.payouts.push({
    id: newId(),
    ownerId: booking.ownerId,
    bookingId: booking.id,
    gross,
    platformFee,
    net: roundMoney(gross - platformFee, booking.currency),
    currency: booking.currency,
    status: 'pending',
    scheduledFor: addDays(booking.date, 2),
  });
}

/** Return credit spent on a booking that never happened. */
function refundCredit(db: Database, booking: Booking): void {
  const creditLine = booking.breakdown.lines.find((l) => l.key === 'credit');
  if (!creditLine) return;

  const customer = db.users.find((u) => u.id === booking.customerId);
  if (customer) {
    customer.creditBalance = roundMoney(customer.creditBalance + Math.abs(creditLine.amount));
  }
}

function requireBooking(db: Database, bookingId: string): Booking {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new BookingError('not_found', 'Booking not found');
  return booking;
}


/** Booking with everything the detail screens render, resolved in one pass. */
export function expandBooking(db: Database, booking: Booking) {
  const charter = db.charters.find((c) => c.id === booking.charterId);
  const pkg = db.packages.find((p) => p.id === booking.packageId);
  const destination = charter ? db.destinations.find((d) => d.id === charter.destinationId) : undefined;
  const owner = db.users.find((u) => u.id === booking.ownerId);
  const customer = db.users.find((u) => u.id === booking.customerId);
  const thread = db.threads.find((t) => t.bookingId === booking.id);
  const review = booking.reviewId ? db.reviews.find((r) => r.id === booking.reviewId) : undefined;

  const daysUntil = daysBetween(today(), booking.date);
  const freeDays = charter?.policies.freeCancellationDaysInAdvance ?? 0;

  return {
    ...booking,
    charter: charter
      ? {
          id: charter.id,
          title: charter.title,
          photo: charter.photos[0]
            ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
            : null,
          destinationTitle: destination?.title ?? '',
          address: charter.address,
          directions: charter.directions,
          geoPoint: charter.geoPoint,
          timezone: charter.timezone,
          policies: charter.policies,
        }
      : null,
    package: pkg
      ? { id: pkg.id, title: pkg.title, hours: pkg.hours, type: pkg.type, capacity: pkg.capacity }
      : null,
    owner: owner
      ? {
          id: owner.id,
          displayName: owner.ownerProfile?.captainName ?? `${owner.firstName} ${owner.lastName}`,
          companyName: owner.ownerProfile?.companyName ?? '',
          // Contact details are released only once a trip is actually on.
          phone: booking.status === 'confirmed' || booking.status === 'accepted' || booking.status === 'done' ? owner.phone : undefined,
        }
      : null,
    customer: customer
      ? {
          id: customer.id,
          displayName: `${customer.firstName} ${customer.lastName}`,
          email: customer.email,
          phone: customer.phone,
        }
      : null,
    threadId: thread?.id,
    review: review ? { id: review.id, rating: review.rating, headline: review.headline } : null,
    daysUntilTrip: daysUntil,
    canCancel: booking.status === 'pending' || booking.status === 'confirmed',
    freeCancellationUntil: freeDays > 0 ? addDays(booking.date, -freeDays) : null,
    isFreeCancellation: freeDays > 0 && daysUntil >= freeDays,
    canReview: booking.status === 'done' && !booking.reviewId,
  };
}

export type ExpandedBooking = ReturnType<typeof expandBooking>;

/**
 * Resolves add-on ids to priced lines, dropping anything that is not a live
 * add-on on this listing.
 *
 * Silently dropping rather than erroring is deliberate: an add-on retired
 * between page load and submit should not fail the whole booking, and the
 * server-side price the guest is shown afterwards reflects what they actually
 * get.
 */
function resolveAddOnLines(
  db: Database,
  charterId: string,
  requested: Record<string, number> | undefined,
): { addOn: AddOn; quantity: number }[] {
  if (!requested) return [];
  const out: { addOn: AddOn; quantity: number }[] = [];

  for (const [addOnId, quantity] of Object.entries(requested)) {
    const addOn = db.addOns.find((a) => a.id === addOnId && a.charterId === charterId && a.active);
    if (!addOn || quantity < 1) continue;
    out.push({ addOn, quantity: Math.min(quantity, addOn.maxQuantity) });
  }
  return out;
}

/** The same resolution, flattened into what a booking stores. */
function resolveAddOns(
  db: Database,
  charterId: string,
  requested: Record<string, number> | undefined,
): BookingAddOn[] {
  return resolveAddOnLines(db, charterId, requested).map(({ addOn, quantity }) => ({
    addOnId: addOn.id,
    title: addOn.title,
    unitPrice: addOn.price,
    quantity,
  }));
}
