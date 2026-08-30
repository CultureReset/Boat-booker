import { commerceConfig } from '@/config/brand';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import type {
  Charter,
  Database,
  Inquiry,
  Message,
  Offer,
  SystemEventKey,
  TripPackage,
} from '@/lib/domain/types';
import { buildBlockIndex, packageAvailability } from './availability';
import { notify } from './notifications';

/**
 * Inquiries and custom offers.
 *
 * These are the two things that turn a conversation into a booking, and the
 * platform treats them as first-class records rather than as messages that
 * happen to contain a price.
 *
 * The important rule: **an outstanding offer does not hold the date.** It is a
 * quote, not a reservation. Two offers for the same day can both be live and
 * whichever guest accepts first wins through the normal availability check —
 * which is why `acceptOffer` re-checks rather than trusting the offer.
 */

export class OfferError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'invalid'
      | 'expired'
      | 'unavailable'
      | 'already_pending',
    message: string,
  ) {
    super(message);
    this.name = 'OfferError';
  }
}

/** How long a guest has to act on an offer before it lapses. */
export const OFFER_VALIDITY_HOURS = 48;

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function systemMessage(db: Database, threadId: string, event: SystemEventKey): Message {
  const now = new Date().toISOString();
  const message: Message = {
    id: newId(),
    threadId,
    body: '',
    createdAt: now,
    deliveredAt: now,
    systemEvent: event,
  };
  db.messages.push(message);
  const thread = db.threads.find((t) => t.id === threadId);
  if (thread) thread.updatedAt = now;
  return message;
}

/* ------------------------------------------------------------------ inquiries */

/**
 * A guest asks about a listing before booking.
 *
 * Reuses the guest's existing thread on the listing rather than starting a new
 * one — someone asking a second question is continuing a conversation, not
 * beginning one — but always creates a fresh inquiry record, because the
 * operator's response clock restarts.
 */
export function createInquiry(
  db: Database,
  input: {
    customerId: string;
    charterId: string;
    body: string;
    date?: string;
    adults?: number;
    children?: number;
  },
): { inquiry: Inquiry; threadId: string } {
  const charter = db.charters.find((c) => c.id === input.charterId);
  if (!charter) throw new OfferError('not_found', 'Listing not found');
  if (charter.ownerId === input.customerId) {
    throw new OfferError('forbidden', 'You cannot enquire about your own listing');
  }

  const body = input.body.trim();
  if (body.length < 2) throw new OfferError('invalid', 'Write a short message');

  const now = new Date().toISOString();
  let thread = db.threads.find(
    (t) => t.customerId === input.customerId && t.charterId === charter.id && !t.bookingId,
  );

  if (!thread) {
    thread = {
      id: newId(),
      kind: 'inquiry',
      customerId: input.customerId,
      ownerId: charter.ownerId,
      charterId: charter.id,
      subject: charter.title,
      createdAt: now,
      updatedAt: now,
    };
    db.threads.push(thread);
  }

  const inquiry: Inquiry = {
    id: newId(),
    threadId: thread.id,
    charterId: charter.id,
    ownerId: charter.ownerId,
    customerId: input.customerId,
    date: input.date,
    adults: input.adults ?? 2,
    children: input.children ?? 0,
    status: 'open',
    createdAt: now,
    respondByAt: hoursFromNow(commerceConfig.inquiryResponseWindowHours),
  };
  db.inquiries.push(inquiry);
  thread.inquiryId = inquiry.id;
  thread.updatedAt = now;

  systemMessage(db, thread.id, 'inquiry_sent');
  db.messages.push({
    id: newId(),
    threadId: thread.id,
    senderId: input.customerId,
    body: body.slice(0, 4000),
    createdAt: now,
    deliveredAt: now,
  });

  const customer = db.users.find((u) => u.id === input.customerId);
  notify(db, charter.ownerId, {
    type: 'inquiry_received_captain',
    category: 'message',
    title: 'A customer sent you an inquiry',
    body: `${customer?.firstName ?? 'A customer'} asked about ${charter.title}.`,
    href: `/owner/inbox/${thread.id}`,
  });

  return { inquiry, threadId: thread.id };
}

/**
 * Operator answers an inquiry without committing to a price.
 *
 * Pre-approving is a signal, not a hold — it tells the guest the operator wants
 * the booking and unlocks the "book now" path in the thread.
 */
export function respondToInquiry(
  db: Database,
  inquiryId: string,
  ownerId: string,
  action: 'pre_approve' | 'decline',
): Inquiry {
  const inquiry = db.inquiries.find((i) => i.id === inquiryId);
  if (!inquiry) throw new OfferError('not_found', 'Inquiry not found');
  if (inquiry.ownerId !== ownerId) throw new OfferError('forbidden', 'Not your inquiry');
  if (inquiry.status !== 'open') throw new OfferError('invalid', 'Already answered');

  inquiry.status = action === 'pre_approve' ? 'pre_approved' : 'declined';
  inquiry.respondedAt = new Date().toISOString();

  systemMessage(
    db,
    inquiry.threadId,
    action === 'pre_approve' ? 'inquiry_pre_approved' : 'inquiry_declined',
  );

  const charter = db.charters.find((c) => c.id === inquiry.charterId);
  notify(db, inquiry.customerId, {
    type: action === 'pre_approve' ? 'inquiry_pre_approved_customer' : 'inquiry_declined_customer',
    category: 'message',
    title: action === 'pre_approve' ? 'Your inquiry was pre-approved' : 'Inquiry declined',
    body:
      action === 'pre_approve'
        ? `${charter?.title ?? 'The captain'} is available — book while the date is open.`
        : `Unfortunately the captain is unavailable for the dates you requested.`,
    href: `/account/inbox/${inquiry.threadId}`,
  });

  return inquiry;
}

/* --------------------------------------------------------------------- offers */

export interface CreateOfferInput {
  ownerId: string;
  threadId: string;
  packageId?: string | null;
  customTrip?: { title: string; description: string; hours: number };
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  days?: number;
  /** Total for the whole trip. Falls back to the package's list price. */
  price?: number;
}

/**
 * Build and send a priced invitation to book.
 *
 * Only one offer can be outstanding per thread at a time — the real product
 * says so explicitly ("A new one can only be sent once this offer expires or is
 * withdrawn"), and it stops an operator stacking three conflicting prices in
 * front of the same guest.
 */
export function createOffer(db: Database, input: CreateOfferInput): Offer {
  const thread = db.threads.find((t) => t.id === input.threadId);
  if (!thread) throw new OfferError('not_found', 'Conversation not found');
  if (thread.ownerId !== input.ownerId) throw new OfferError('forbidden', 'Not your conversation');

  const charter = db.charters.find((c) => c.id === thread.charterId);
  if (!charter) throw new OfferError('not_found', 'Listing not found');

  const pending = db.offers.find((o) => o.threadId === thread.id && o.status === 'sent');
  if (pending) {
    throw new OfferError('already_pending', 'You already have a pending offer on this conversation');
  }

  const pkg = input.packageId
    ? db.packages.find((p) => p.id === input.packageId && p.charterId === charter.id)
    : undefined;
  if (input.packageId && !pkg) throw new OfferError('not_found', 'Trip not found');
  if (!pkg && !input.customTrip) {
    throw new OfferError('invalid', 'Pick a trip or describe a custom one');
  }

  const guests = input.adults + input.children;
  if (guests < 1) throw new OfferError('invalid', 'At least one guest is required');
  if (guests > charter.boat.capacity) {
    throw new OfferError('invalid', 'Charter capacity is too low for this group size');
  }

  const price = resolveOfferPrice(input, pkg);
  if (!(price > 0)) throw new OfferError('invalid', 'The trip price must be a positive value');

  const now = new Date().toISOString();
  const offer: Offer = {
    id: newId(),
    threadId: thread.id,
    charterId: charter.id,
    ownerId: input.ownerId,
    customerId: thread.customerId,
    packageId: pkg?.id ?? null,
    customTrip: input.customTrip
      ? { ...input.customTrip, departureTime: input.departureTime }
      : undefined,
    date: input.date,
    departureTime: input.departureTime,
    adults: input.adults,
    children: input.children,
    days: input.days ?? 1,
    price: roundMoney(price, charter.currency),
    currency: charter.currency,
    status: 'sent',
    createdAt: now,
    expiresAt: hoursFromNow(OFFER_VALIDITY_HOURS),
  };

  db.offers.push(offer);
  thread.offerId = offer.id;
  thread.kind = 'offer';
  thread.updatedAt = now;

  systemMessage(db, thread.id, 'offer_sent');

  const owner = db.users.find((u) => u.id === input.ownerId);
  notify(db, thread.customerId, {
    type: 'offer_sent_customer',
    category: 'booking',
    title: 'New trip offer',
    body: `Captain ${owner?.firstName ?? ''} sent you an offer for ${charter.title} on ${offer.date}.`.trim(),
    href: `/account/inbox/${thread.id}`,
  });

  return offer;
}

function resolveOfferPrice(input: CreateOfferInput, pkg: TripPackage | undefined): number {
  if (typeof input.price === 'number') return input.price;
  if (!pkg) return 0;

  const guests = input.adults + input.children;
  const extra =
    pkg.additionalPersonAfter !== null && pkg.additionalPersonPrice !== null
      ? Math.max(0, guests - pkg.additionalPersonAfter) * pkg.additionalPersonPrice
      : 0;
  return (pkg.price + extra) * (input.days ?? 1);
}

export function withdrawOffer(db: Database, offerId: string, ownerId: string): Offer {
  const offer = db.offers.find((o) => o.id === offerId);
  if (!offer) throw new OfferError('not_found', 'Offer not found');
  if (offer.ownerId !== ownerId) throw new OfferError('forbidden', 'Not your offer');
  if (offer.status !== 'sent') throw new OfferError('invalid', 'This offer is no longer active');

  offer.status = 'withdrawn';
  offer.withdrawnAt = new Date().toISOString();
  systemMessage(db, offer.threadId, 'offer_withdrawn');

  const charter = db.charters.find((c) => c.id === offer.charterId);
  notify(db, offer.customerId, {
    type: 'offer_withdrawn_customer',
    category: 'booking',
    title: 'Offer withdrawn',
    body: `The captain withdrew their offer for ${charter?.title ?? 'the trip'} on ${offer.date}.`,
    href: `/account/inbox/${offer.threadId}`,
  });

  return offer;
}

/**
 * Marks lapsed offers and inquiries.
 *
 * Called from the same sweep that settles elapsed bookings, so expiry is
 * observed on read rather than needing a scheduler.
 */
export function settleElapsedOffers(db: Database): number {
  const now = new Date().toISOString();
  let changed = 0;

  for (const offer of db.offers) {
    if (offer.status !== 'sent' || offer.expiresAt > now) continue;
    offer.status = 'expired';
    systemMessage(db, offer.threadId, 'offer_expired');
    notify(db, offer.customerId, {
      type: 'offer_expired_customer',
      category: 'booking',
      title: 'Offer expired',
      body: `The captain's offer for ${offer.date} has expired.`,
      href: `/account/inbox/${offer.threadId}`,
    });
    changed += 1;
  }

  for (const inquiry of db.inquiries) {
    if (inquiry.status !== 'open' || inquiry.respondByAt > now) continue;
    // An unanswered inquiry is not "declined" — the operator never said no.
    // It simply stops counting against their response clock.
    inquiry.status = 'declined';
    inquiry.respondedAt = now;
    changed += 1;
  }

  return changed;
}

/**
 * Turns an accepted offer into a real booking.
 *
 * Availability is re-checked here, not at send time, because the offer never
 * held the date. If the day sold in the meantime the guest gets `unavailable`
 * and the offer stays live so the operator can propose another date.
 */
export function assertOfferBookable(db: Database, offerId: string, customerId: string): {
  offer: Offer;
  charter: Charter;
  pkg: TripPackage | undefined;
} {
  const offer = db.offers.find((o) => o.id === offerId);
  if (!offer) throw new OfferError('not_found', 'Offer not found');
  if (offer.customerId !== customerId) throw new OfferError('forbidden', 'Not your offer');
  if (offer.status === 'expired' || offer.expiresAt <= new Date().toISOString()) {
    throw new OfferError('expired', 'This offer has expired');
  }
  if (offer.status !== 'sent') throw new OfferError('invalid', 'This offer is no longer active');

  const charter = db.charters.find((c) => c.id === offer.charterId);
  if (!charter) throw new OfferError('not_found', 'Listing not found');

  const pkg = offer.packageId
    ? db.packages.find((p) => p.id === offer.packageId)
    : undefined;

  if (pkg) {
    const availability = packageAvailability({
      pkg,
      date: offer.date,
      days: offer.days,
      guests: offer.adults + offer.children,
      blockIndex: buildBlockIndex(db),
    });
    if (!availability.available) {
      throw new OfferError('unavailable', availability.reason ?? 'Those dates are no longer open');
    }
  }

  return { offer, charter, pkg };
}

/** Records that an offer produced a booking. */
export function markOfferAccepted(db: Database, offerId: string, bookingId: string): void {
  const offer = db.offers.find((o) => o.id === offerId);
  if (!offer) return;
  offer.status = 'accepted';
  offer.acceptedAt = new Date().toISOString();
  offer.bookingId = bookingId;
  systemMessage(db, offer.threadId, 'offer_accepted');
}

/** The offer currently outstanding on a thread, if any. */
export function activeOfferForThread(db: Database, threadId: string): Offer | undefined {
  return db.offers.find((o) => o.threadId === threadId && o.status === 'sent');
}
