import { commerceConfig } from '@/config/brand';
import { addDays, today } from '@/lib/core/dates';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import type {
  BookingInvite,
  Database,
  DirectSettings,
  InviteChannel,
  QuickReply,
} from '@/lib/domain/types';
import { notify } from './notifications';

/**
 * Direct — the operator's own booking channel.
 *
 * The commercial shape is the whole point: bookings that the operator brought
 * themselves pay **no commission**, only the payment processing fee. The
 * platform still provides the calendar, the messaging, the payment rails and
 * the cancellation policy, so a Direct booking is a first-class booking that
 * happens to have a different fee line.
 *
 * That is why `source` lives on the booking rather than being inferred: a trip
 * booked through a QR code on a business card has to be indistinguishable from
 * a marketplace one everywhere except the payout maths.
 */

export class DirectError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'invalid' | 'not_enabled' | 'expired',
    message: string,
  ) {
    super(message);
    this.name = 'DirectError';
  }
}

/** Direct's own fee, standing in for commission. */
export const DIRECT_PROCESSING_RATE = 0.0265;
export const DIRECT_PROCESSING_FIXED = 0.3;

/** How long a book-direct invite stays live. */
export const INVITE_VALIDITY_DAYS = 30;

export function directSettingsFor(db: Database, ownerId: string): DirectSettings | undefined {
  return db.directSettings.find((d) => d.ownerId === ownerId);
}

/**
 * Turns Direct on, which requires accepting its terms.
 *
 * The terms acceptance is stored rather than assumed because Direct changes who
 * absorbs the processing fee and how cancellations are handled — the operator
 * has to have seen that.
 */
export function enableDirect(
  db: Database,
  ownerId: string,
  input: { acceptTerms: boolean; feeBearer?: 'operator' | 'customer' },
): DirectSettings {
  const settings = directSettingsFor(db, ownerId);
  if (!settings) throw new DirectError('not_found', 'No Direct settings for this account');

  if (!input.acceptTerms) {
    throw new DirectError('invalid', 'You must accept the Direct terms of use');
  }

  const owner = db.users.find((u) => u.id === ownerId);
  // Direct settles online, so it cannot work without a payout destination.
  if (!owner?.ownerProfile?.payoutMethods.length) {
    throw new DirectError('not_enabled', 'Add a payout method before enabling Direct');
  }

  settings.enabled = true;
  settings.termsAcceptedAt = new Date().toISOString();
  if (input.feeBearer) settings.feeBearer = input.feeBearer;

  return settings;
}

export function disableDirect(db: Database, ownerId: string): DirectSettings {
  const settings = directSettingsFor(db, ownerId);
  if (!settings) throw new DirectError('not_found', 'No Direct settings for this account');
  settings.enabled = false;
  return settings;
}

/**
 * What a Direct booking actually costs the operator.
 *
 * Presented next to the marketplace equivalent, because the number that
 * matters to an operator deciding whether to promote their own link is the
 * difference, not the absolute.
 */
export function directEconomics(
  amount: number,
  currency: string,
): { processingFee: number; operatorReceives: number; marketplaceEquivalent: number; saved: number } {
  const processingFee = roundMoney(amount * DIRECT_PROCESSING_RATE + DIRECT_PROCESSING_FIXED, currency);
  const operatorReceives = roundMoney(amount - processingFee, currency);
  const commission = roundMoney(amount * commerceConfig.serviceFeeRate, currency);
  const marketplaceEquivalent = roundMoney(amount - commission, currency);

  return {
    processingFee,
    operatorReceives,
    marketplaceEquivalent,
    saved: roundMoney(operatorReceives - marketplaceEquivalent, currency),
  };
}

/* ------------------------------------------------------------------ invites */

export interface CreateInviteInput {
  ownerId: string;
  charterId: string;
  channel: InviteChannel;
  recipient?: string;
}

/**
 * Issues a book-direct invite.
 *
 * A QR invite has no recipient — it is printed on a decal or a business card
 * and scanned by whoever picks it up — so the token is the only identifier and
 * the same one can be reused until it expires.
 */
export function createInvite(db: Database, input: CreateInviteInput): BookingInvite {
  const settings = directSettingsFor(db, input.ownerId);
  if (!settings?.enabled) throw new DirectError('not_enabled', 'Direct is not enabled on this account');

  const charter = db.charters.find((c) => c.id === input.charterId && c.ownerId === input.ownerId);
  if (!charter) throw new DirectError('not_found', 'Listing not found');

  if (input.channel !== 'qr' && !input.recipient?.trim()) {
    throw new DirectError('invalid', 'Enter an email address or phone number');
  }
  if (input.channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(input.recipient ?? '')) {
    throw new DirectError('invalid', 'Enter a valid email address');
  }

  // A listing's QR invite is stable — reprinting decals for a new token would
  // defeat the purpose of putting it on physical media.
  if (input.channel === 'qr') {
    const existing = db.bookingInvites.find(
      (i) => i.charterId === charter.id && i.channel === 'qr' && i.expiresAt > new Date().toISOString(),
    );
    if (existing) return existing;
  }

  const invite: BookingInvite = {
    id: newId(),
    ownerId: input.ownerId,
    charterId: charter.id,
    channel: input.channel,
    recipient: input.recipient?.trim(),
    token: newId() + newId(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + INVITE_VALIDITY_DAYS * 86_400_000).toISOString(),
  };

  db.bookingInvites.push(invite);
  settings.invitesSent += 1;

  return invite;
}

export function resolveInvite(db: Database, token: string): BookingInvite {
  const invite = db.bookingInvites.find((i) => i.token === token);
  if (!invite) throw new DirectError('not_found', 'This invite is not valid');
  if (invite.expiresAt <= new Date().toISOString()) {
    throw new DirectError('expired', 'This invite has expired');
  }

  if (!invite.openedAt) invite.openedAt = new Date().toISOString();
  return invite;
}

/* ------------------------------------------------------- manual bookings */

export interface ManualBookingInput {
  ownerId: string;
  charterId: string;
  packageId: string;
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  contact: { firstName: string; lastName: string; email: string; phone: string };
  /** What the operator actually agreed with the guest. */
  agreedPrice: number;
  note?: string;
}

/**
 * Validates a walk-up or phone booking before it is created.
 *
 * Manual bookings exist so an operator does not have to track two calendars.
 * They are trusted on price — the operator took the money themselves — but not
 * on availability, because the whole reason to record one is to stop the same
 * slot being sold twice.
 */
export function validateManualBooking(
  db: Database,
  input: ManualBookingInput,
): { charterId: string; packageId: string } {
  const charter = db.charters.find((c) => c.id === input.charterId && c.ownerId === input.ownerId);
  if (!charter) throw new DirectError('not_found', 'Listing not found');

  const pkg = db.packages.find((p) => p.id === input.packageId && p.charterId === charter.id);
  if (!pkg) throw new DirectError('not_found', 'Trip not found');

  const guests = input.adults + input.children;
  if (guests < 1) throw new DirectError('invalid', 'At least one guest is required');
  if (guests > pkg.capacity) throw new DirectError('invalid', 'Group is larger than this trip allows');
  if (!(input.agreedPrice >= 0)) throw new DirectError('invalid', 'Enter the agreed price');
  if (!input.contact.firstName.trim()) throw new DirectError('invalid', 'Enter the customer’s name');

  return { charterId: charter.id, packageId: pkg.id };
}

/* ------------------------------------------------------------ quick replies */

export function quickRepliesFor(db: Database, ownerId: string): QuickReply[] {
  return db.quickReplies
    .filter((q) => q.ownerId === ownerId)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function saveQuickReply(
  db: Database,
  input: { ownerId: string; id?: string; title: string; body: string },
): QuickReply {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2) throw new DirectError('invalid', 'Give the template a title');
  if (body.length < 2) throw new DirectError('invalid', 'Message content is required');

  const existing = input.id ? db.quickReplies.find((q) => q.id === input.id) : undefined;
  if (input.id && !existing) throw new DirectError('not_found', 'Template not found');
  if (existing && existing.ownerId !== input.ownerId) {
    throw new DirectError('forbidden', 'Not your template');
  }

  const now = new Date().toISOString();
  if (existing) {
    existing.title = title.slice(0, 80);
    existing.body = body.slice(0, 2000);
    existing.updatedAt = now;
    return existing;
  }

  const created: QuickReply = {
    id: newId(),
    ownerId: input.ownerId,
    title: title.slice(0, 80),
    body: body.slice(0, 2000),
    createdAt: now,
    updatedAt: now,
  };
  db.quickReplies.push(created);
  return created;
}

export function deleteQuickReply(db: Database, id: string, ownerId: string): void {
  const reply = db.quickReplies.find((q) => q.id === id);
  if (!reply) throw new DirectError('not_found', 'Template not found');
  if (reply.ownerId !== ownerId) throw new DirectError('forbidden', 'Not your template');
  db.quickReplies = db.quickReplies.filter((q) => q.id !== id);
}

/* --------------------------------------------------------- review requests */

/**
 * The QR code an operator shows a guest to collect a review.
 *
 * Scoped to the listing rather than the booking, because the operator holds it
 * up at the dock without knowing which of the day's guests will scan it — the
 * scanner's own completed booking is matched afterwards.
 */
export function reviewQrTarget(db: Database, charterId: string): { charterId: string; title: string } {
  const charter = db.charters.find((c) => c.id === charterId);
  if (!charter) throw new DirectError('not_found', 'Listing not found');
  return { charterId: charter.id, title: charter.title };
}

/** A guest's reviewable booking on a listing, matched from a QR scan. */
export function reviewableBookingFor(
  db: Database,
  charterId: string,
  customerId: string,
): string | null {
  const booking = db.bookings
    .filter(
      (b) =>
        b.charterId === charterId &&
        b.customerId === customerId &&
        b.status === 'done' &&
        !b.reviewId,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return booking?.id ?? null;
}

/**
 * Invites past customers to leave a review.
 *
 * Only trips that actually happened and have no review yet — asking for a
 * review of a cancelled trip is how operators lose customers.
 */
export function requestReviews(
  db: Database,
  ownerId: string,
  bookingIds: string[],
): { sent: number; skipped: number } {
  let sent = 0;
  let skipped = 0;

  for (const bookingId of bookingIds) {
    const booking = db.bookings.find((b) => b.id === bookingId && b.ownerId === ownerId);
    if (!booking || booking.status !== 'done' || booking.reviewId) {
      skipped += 1;
      continue;
    }

    notify(db, booking.customerId, {
      type: 'review_requested_customer',
      category: 'review',
      title: 'How was your trip?',
      body: `Leave a review of your trip on ${booking.date} — it takes a minute.`,
      href: `/account/reviews?booking=${booking.id}`,
    });
    sent += 1;
  }

  return { sent, skipped };
}

/** Bookings an operator could still ask for a review on. */
export function reviewCandidates(db: Database, ownerId: string) {
  return db.bookings
    .filter((b) => b.ownerId === ownerId && b.status === 'done' && !b.reviewId)
    .filter((b) => b.date >= addDays(today(), -365))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((booking) => {
      const customer = db.users.find((u) => u.id === booking.customerId);
      const charter = db.charters.find((c) => c.id === booking.charterId);
      return {
        bookingId: booking.id,
        reference: booking.reference,
        date: booking.date,
        customerName: customer ? `${customer.firstName} ${customer.lastName[0] ?? ''}.` : 'Customer',
        charterTitle: charter?.title ?? '',
      };
    });
}
