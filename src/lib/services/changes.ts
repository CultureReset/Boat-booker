import { commerceConfig } from '@/config/brand';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import type {
  Booking,
  ChangeRequest,
  ChangeRequestFields,
  Database,
  Message,
  SystemEventKey,
} from '@/lib/domain/types';
import { buildBlockIndex, packageAvailability, releaseDates, reserveDates } from './availability';
import { notify } from './notifications';
import { computeBreakdown } from './pricing';

/**
 * Booking changes.
 *
 * Either party can propose an amendment to a confirmed booking; the other has a
 * fixed window to answer. Two rules do most of the work:
 *
 *   1. **A price move goes to a human.** Accepting an unpriced change applies
 *      immediately. Accepting one that moves the price does not — it lands in
 *      `manual_review`, because automatically charging or refunding a card on
 *      the strength of one tap is the kind of thing that turns a small
 *      misunderstanding into a chargeback.
 *
 *   2. **The old dates are held until the new ones are secured.** Requesting a
 *      change never frees the original slot, so a request that is declined or
 *      expires leaves the booking exactly as it was.
 */

export class ChangeError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'invalid' | 'unavailable' | 'already_pending' | 'expired',
    message: string,
  ) {
    super(message);
    this.name = 'ChangeError';
  }
}

/** How long the other party has to answer. */
export const CHANGE_RESPONSE_HOURS = commerceConfig.inquiryResponseWindowHours;

function systemMessage(db: Database, bookingId: string, event: SystemEventKey): void {
  const thread = db.threads.find((t) => t.bookingId === bookingId);
  if (!thread) return;

  const now = new Date().toISOString();
  const message: Message = {
    id: newId(),
    threadId: thread.id,
    body: '',
    createdAt: now,
    deliveredAt: now,
    systemEvent: event,
  };
  db.messages.push(message);
  thread.updatedAt = now;
}

function requireBooking(db: Database, bookingId: string): Booking {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new ChangeError('not_found', 'Booking not found');
  return booking;
}

/**
 * What the booking would cost with the requested fields applied.
 *
 * Recomputed from the pricing engine rather than adjusted arithmetically, so a
 * change that crosses a group-size threshold or a multi-day discount is priced
 * the same way a fresh booking would be.
 */
export function priceChange(
  db: Database,
  booking: Booking,
  requested: ChangeRequestFields,
): { total: number; difference: number; currency: string } {
  const merged = { ...currentFields(booking), ...requested };
  const charter = db.charters.find((c) => c.id === booking.charterId);
  const pkg = db.packages.find((p) => p.id === merged.packageId);
  if (!charter || !pkg) return { total: booking.breakdown.total, difference: 0, currency: booking.currency };

  const breakdown = computeBreakdown({
    charter,
    pkg,
    adults: merged.adults,
    children: merged.children,
    days: merged.days,
    paymentMode: booking.paymentMode,
    currency: booking.currency,
  });

  return {
    total: breakdown.total,
    difference: roundMoney(breakdown.total - booking.breakdown.total, booking.currency),
    currency: booking.currency,
  };
}

function currentFields(booking: Booking): Required<ChangeRequestFields> {
  return {
    date: booking.date,
    departureTime: booking.departureTime,
    adults: booking.adults,
    children: booking.children,
    days: booking.days,
    packageId: booking.packageId,
  };
}

export interface RequestChangeInput {
  bookingId: string;
  actorId: string;
  requested: ChangeRequestFields;
  note: string;
}

export function requestChange(db: Database, input: RequestChangeInput): ChangeRequest {
  const booking = requireBooking(db, input.bookingId);

  const isCustomer = booking.customerId === input.actorId;
  const isOwner = booking.ownerId === input.actorId;
  if (!isCustomer && !isOwner) throw new ChangeError('forbidden', 'Not your booking');

  if (booking.status !== 'confirmed' && booking.status !== 'accepted') {
    throw new ChangeError('invalid', 'Only a confirmed booking can be changed');
  }
  if (booking.changeRequestId) {
    throw new ChangeError('already_pending', 'There is already a change request on this booking');
  }

  const current = currentFields(booking);
  const merged = { ...current, ...input.requested };

  const changed = (Object.keys(input.requested) as (keyof ChangeRequestFields)[]).some(
    (key) => input.requested[key] !== undefined && input.requested[key] !== current[key],
  );
  if (!changed) throw new ChangeError('invalid', 'Nothing was changed');

  const charter = db.charters.find((c) => c.id === booking.charterId);
  const pkg = db.packages.find((p) => p.id === merged.packageId);
  if (!charter || !pkg) throw new ChangeError('not_found', 'Listing or trip not found');

  // A shared trip's group size is fixed — other people are already on the boat.
  if (pkg.type === 'shared' && (input.requested.adults !== undefined || input.requested.children !== undefined)) {
    throw new ChangeError('invalid', 'Group size cannot be changed on a shared trip');
  }

  // Check the *new* date is open, ignoring this booking's own hold on the old
  // one. Requesting never releases the original slot.
  if (merged.date !== current.date || merged.days !== current.days) {
    const availability = packageAvailability({
      pkg,
      date: merged.date,
      guests: merged.adults + merged.children,
      days: merged.days,
      blockIndex: buildBlockIndex(db),
    });
    if (!availability.available) {
      throw new ChangeError('unavailable', availability.reason ?? 'Those dates are not available');
    }
  }

  if (!pkg.departureTimes.includes(merged.departureTime)) {
    throw new ChangeError('invalid', 'That departure time is not available');
  }

  const priced = priceChange(db, booking, input.requested);
  const now = new Date();

  const request: ChangeRequest = {
    id: newId(),
    bookingId: booking.id,
    requestedBy: isCustomer ? 'customer' : 'owner',
    requestedByUserId: input.actorId,
    original: current,
    requested: input.requested,
    note: input.note.trim().slice(0, 2000),
    priceDifference: priced.difference,
    currency: priced.currency,
    status: 'requested',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CHANGE_RESPONSE_HOURS * 3_600_000).toISOString(),
  };

  db.changeRequests.push(request);
  booking.changeRequestId = request.id;
  booking.status = 'change_requested';

  systemMessage(db, booking.id, 'change_requested');

  const recipient = isCustomer ? booking.ownerId : booking.customerId;
  notify(db, recipient, {
    type: isCustomer ? 'booking_change_requested_captain' : 'booking_change_requested_customer',
    category: 'booking',
    title: 'Change requested',
    body: `${booking.reference}: the other party asked to change this booking. You have ${CHANGE_RESPONSE_HOURS} hours to respond.`,
    href: isCustomer ? `/owner/bookings/${booking.id}` : `/account/bookings/${booking.id}`,
  });

  return request;
}

export function withdrawChange(db: Database, requestId: string, actorId: string): ChangeRequest {
  const request = db.changeRequests.find((c) => c.id === requestId);
  if (!request) throw new ChangeError('not_found', 'Change request not found');
  if (request.requestedByUserId !== actorId) {
    throw new ChangeError('forbidden', 'Only the requester can withdraw this');
  }
  if (request.status !== 'requested') throw new ChangeError('invalid', 'This request is no longer open');

  request.status = 'withdrawn';
  request.resolvedAt = new Date().toISOString();
  restoreBooking(db, request);
  systemMessage(db, request.bookingId, 'change_withdrawn');

  const booking = requireBooking(db, request.bookingId);
  const recipient = request.requestedBy === 'customer' ? booking.ownerId : booking.customerId;
  notify(db, recipient, {
    type: 'booking_change_withdrawn',
    category: 'booking',
    title: 'Change request withdrawn',
    body: `${booking.reference} is unchanged.`,
    href: request.requestedBy === 'customer' ? `/owner/bookings/${booking.id}` : `/account/bookings/${booking.id}`,
  });

  return request;
}

export interface RespondResult {
  request: ChangeRequest;
  booking: Booking;
  /** True when the change went to support instead of applying. */
  needsSupportReview: boolean;
}

export function respondToChange(
  db: Database,
  requestId: string,
  actorId: string,
  action: 'accept' | 'decline',
): RespondResult {
  const request = db.changeRequests.find((c) => c.id === requestId);
  if (!request) throw new ChangeError('not_found', 'Change request not found');
  if (request.status !== 'requested') throw new ChangeError('invalid', 'This request is no longer open');
  if (request.expiresAt <= new Date().toISOString()) throw new ChangeError('expired', 'This request has expired');

  const booking = requireBooking(db, request.bookingId);
  // Only the *other* party answers — the requester withdraws instead.
  const responder = request.requestedBy === 'customer' ? booking.ownerId : booking.customerId;
  if (actorId !== responder) throw new ChangeError('forbidden', 'This is not yours to answer');

  const now = new Date().toISOString();

  if (action === 'decline') {
    request.status = 'declined';
    request.resolvedAt = now;
    restoreBooking(db, request);
    systemMessage(db, booking.id, 'change_declined');

    notify(db, request.requestedByUserId, {
      type: 'booking_change_declined',
      category: 'booking',
      title: 'Changes declined',
      body: `${booking.reference} stays as it was.`,
      href: request.requestedBy === 'customer' ? `/account/bookings/${booking.id}` : `/owner/bookings/${booking.id}`,
    });

    return { request, booking, needsSupportReview: false };
  }

  // A change that moves money is reviewed by a person, not applied on a tap.
  if (request.priceDifference !== 0) {
    request.status = 'manual_review';
    request.resolvedAt = now;
    booking.status = 'change_pending';

    notify(db, request.requestedByUserId, {
      type: 'booking_change_accepted_manual',
      category: 'booking',
      title: 'Change accepted — being processed',
      body: 'This change adjusts the price, so our team will confirm it within 24 hours.',
      href: request.requestedBy === 'customer' ? `/account/bookings/${booking.id}` : `/owner/bookings/${booking.id}`,
    });

    return { request, booking, needsSupportReview: true };
  }

  applyChange(db, booking, request);

  request.status = 'accepted';
  request.resolvedAt = now;
  systemMessage(db, booking.id, 'change_accepted');

  notify(db, request.requestedByUserId, {
    type: 'booking_change_accepted',
    category: 'booking',
    title: 'Changes accepted',
    body: `${booking.reference} is now ${booking.date} at ${booking.departureTime}.`,
    href: request.requestedBy === 'customer' ? `/account/bookings/${booking.id}` : `/owner/bookings/${booking.id}`,
  });

  return { request, booking, needsSupportReview: false };
}

/**
 * Moves the booking onto the requested terms.
 *
 * Dates are released and re-reserved in one pass, so a failure to secure the
 * new day leaves the old one held rather than losing both.
 */
function applyChange(db: Database, booking: Booking, request: ChangeRequest): void {
  const next = { ...currentFields(booking), ...request.requested };
  const movingDates = next.date !== booking.date || next.days !== booking.days;

  if (movingDates) {
    releaseDates(db, booking.id);
  }

  booking.date = next.date;
  booking.departureTime = next.departureTime;
  booking.adults = next.adults;
  booking.children = next.children;
  booking.days = next.days;
  booking.packageId = next.packageId;
  booking.status = 'confirmed';
  booking.changeRequestId = undefined;

  if (movingDates && !reserveDates(db, booking, () => newId())) {
    // Should not happen — availability was checked at request time — but if the
    // day went in the meantime, put the request back rather than leaving the
    // booking with no calendar hold at all.
    throw new ChangeError('unavailable', 'Those dates were just taken');
  }
}

/** Puts a booking back to `confirmed` when a request ends without applying. */
function restoreBooking(db: Database, request: ChangeRequest): void {
  const booking = db.bookings.find((b) => b.id === request.bookingId);
  if (!booking) return;
  booking.changeRequestId = undefined;
  if (booking.status === 'change_requested' || booking.status === 'change_pending') {
    booking.status = 'confirmed';
  }
}

/**
 * Lapses change requests nobody answered.
 *
 * Expiry is the responder's fault, not the requester's, so the notification
 * names whichever side went quiet — the real product has separate copy for
 * "you were unresponsive" and "they were unresponsive".
 */
export function settleElapsedChanges(db: Database): number {
  const now = new Date().toISOString();
  let changed = 0;

  for (const request of db.changeRequests) {
    if (request.status !== 'requested' || request.expiresAt > now) continue;

    request.status = 'expired';
    request.resolvedAt = now;
    restoreBooking(db, request);
    systemMessage(db, request.bookingId, 'change_expired');

    const booking = db.bookings.find((b) => b.id === request.bookingId);
    if (booking) {
      const responder = request.requestedBy === 'customer' ? booking.ownerId : booking.customerId;
      notify(db, request.requestedByUserId, {
        type: 'booking_change_expired',
        category: 'booking',
        title: 'Changes expired',
        body: 'The other party did not respond in time. The original booking stands.',
        href: request.requestedBy === 'customer' ? `/account/bookings/${booking.id}` : `/owner/bookings/${booking.id}`,
      });
      notify(db, responder, {
        type: 'booking_change_expired_you',
        category: 'booking',
        title: 'Change request expired',
        body: 'You did not respond in time, so the original booking stands.',
        href: request.requestedBy === 'customer' ? `/owner/bookings/${booking.id}` : `/account/bookings/${booking.id}`,
      });
    }

    changed += 1;
  }

  return changed;
}

/** The change request currently in flight on a booking, if any. */
export function activeChangeFor(db: Database, bookingId: string): ChangeRequest | undefined {
  return db.changeRequests.find((c) => c.bookingId === bookingId && c.status === 'requested');
}
