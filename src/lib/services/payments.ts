import { commerceConfig } from '@/config/brand';
import { addDays, today } from '@/lib/core/dates';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import { isExpired } from '@/lib/domain/paymentMethods';
import type { Booking, Charter, Database } from '@/lib/domain/types';
import { notify } from './notifications';

/**
 * Money that moves after the booking is made: the remaining balance, and tips.
 *
 * Both are settled through single-use links rather than by logging in and
 * hunting for the booking, because both happen at moments when nobody wants to
 * navigate — standing on a dock, or ten minutes after stepping off the boat.
 * That means the link itself is the security boundary, so it is short-lived,
 * scoped to one booking, and refuses to work twice.
 */

export class PaymentError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'invalid'
      | 'expired'
      | 'already_paid'
      | 'disabled'
      | 'card_expired',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** Tips are bounded so a mis-typed amount cannot become a disaster. */
export const TIP_MIN_PERCENT = 5;
export const TIP_MAX_PERCENT = 50;
export const TIP_PRESETS = [10, 15, 20] as const;

/** How long a payment link stays valid. */
export const PAYMENT_LINK_HOURS = 72;

function requireBooking(db: Database, bookingId: string): Booking {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new PaymentError('not_found', 'Booking not found');
  return booking;
}

/* ------------------------------------------------------------ balance links */

/**
 * Issues a link the guest can use to settle the balance without signing in.
 *
 * The operator triggers this ("request the remaining balance"), so the token is
 * minted here rather than at booking time — a link that existed from the start
 * would be sitting in an inbox for months.
 */
export function createBalanceLink(db: Database, bookingId: string, actorId: string): string {
  const booking = requireBooking(db, bookingId);
  if (booking.ownerId !== actorId && booking.customerId !== actorId) {
    throw new PaymentError('forbidden', 'Not your booking');
  }
  if (booking.balance.paidAt) throw new PaymentError('already_paid', 'The balance is already paid');
  if (booking.balance.outstanding <= 0) {
    throw new PaymentError('invalid', 'There is nothing outstanding on this booking');
  }

  const token = newId() + newId();
  booking.balance.paymentToken = token;
  booking.balance.paymentTokenExpiresAt = new Date(
    Date.now() + PAYMENT_LINK_HOURS * 3_600_000,
  ).toISOString();

  if (actorId === booking.ownerId) {
    notify(db, booking.customerId, {
      type: 'payment_link_created',
      category: 'booking',
      title: 'Pay remaining balance',
      body: `Your captain has requested the remaining balance for ${booking.date}.`,
      href: `/pay/balance?token=${token}`,
    });
  }

  return token;
}

export interface PaymentContext {
  booking: Booking;
  charter: Charter | undefined;
  captainName: string;
}

/**
 * Resolves a payment token to a booking.
 *
 * Deliberately distinguishes "never valid" from "no longer valid": a guest who
 * waited too long gets a page telling them so and a way to ask for a new link,
 * rather than a dead end that looks like a bug.
 */
export function resolvePaymentToken(db: Database, token: string): PaymentContext {
  const booking = db.bookings.find((b) => b.balance.paymentToken === token);
  if (!booking) throw new PaymentError('not_found', 'This payment link is not valid');

  if (
    booking.balance.paymentTokenExpiresAt &&
    booking.balance.paymentTokenExpiresAt <= new Date().toISOString()
  ) {
    throw new PaymentError('expired', 'This payment request is no longer valid');
  }
  if (booking.balance.paidAt) throw new PaymentError('already_paid', 'This balance is already paid');

  const charter = db.charters.find((c) => c.id === booking.charterId);
  const owner = db.users.find((u) => u.id === booking.ownerId);

  return {
    booking,
    charter,
    captainName: owner?.ownerProfile?.captainName || owner?.firstName || 'your captain',
  };
}

/** The processing fee a card payment on this listing attracts. */
export function processingFeeFor(charter: Charter | undefined, amount: number): number {
  const rate = charter?.policies.cardProcessingRate ?? commerceConfig.cardProcessingRate;
  return roundMoney(amount * rate);
}

export interface BalancePaymentResult {
  booking: Booking;
  charged: number;
  processingFee: number;
}

/**
 * Settles the remaining balance.
 *
 * The card is validated but never charged — the money movement is modelled in
 * the payout ledger, same as the initial payment.
 */
export function payBalance(
  db: Database,
  token: string,
  input: { paymentMethodId?: string; cardExpired?: boolean },
): BalancePaymentResult {
  const { booking, charter } = resolvePaymentToken(db, token);

  // An expired card is the single most common failure at this step, and it
  // deserves its own message rather than a generic decline.
  if (input.cardExpired) {
    booking.balance.lastAttemptFailedAt = new Date().toISOString();
    throw new PaymentError('card_expired', 'This card has expired');
  }

  const fee = processingFeeFor(charter, booking.balance.outstanding);
  const charged = roundMoney(booking.balance.outstanding + fee);

  booking.balance.paidAt = new Date().toISOString();
  booking.balance.outstanding = 0;
  booking.balance.paymentToken = undefined;
  booking.balance.paymentTokenExpiresAt = undefined;
  if (input.paymentMethodId) booking.paymentMethodId = input.paymentMethodId;

  const customer = db.users.find((u) => u.id === booking.customerId);
  notify(db, booking.ownerId, {
    type: 'remainingBalancePaymentMadeCaptain',
    category: 'payout',
    title: 'Remaining balance paid',
    body: `${customer?.firstName ?? 'The customer'} paid the balance for ${booking.date}.`,
    href: `/owner/bookings/${booking.id}`,
  });

  return { booking, charged, processingFee: fee };
}

/**
 * Schedules an automatic charge instead of asking the guest to remember.
 *
 * Always cancellable back to paying in person or online, which is why the mode
 * is stored on the booking rather than implied by the presence of a date.
 */
export function scheduleBalance(
  db: Database,
  bookingId: string,
  customerId: string,
  mode: Booking['balance']['mode'],
): Booking {
  const booking = requireBooking(db, bookingId);
  if (booking.customerId !== customerId) throw new PaymentError('forbidden', 'Not your booking');
  if (booking.balance.paidAt) throw new PaymentError('already_paid', 'The balance is already paid');

  booking.balance.mode = mode;
  booking.balance.scheduledFor =
    mode === 'scheduled'
      ? // Charge the day before the trip, so a failure still leaves time to fix.
        addDays(booking.date, -1)
      : undefined;

  return booking;
}

/* ---------------------------------------------------------------------- tips */

export interface TipContext {
  booking: Booking;
  charter: Charter | undefined;
  captainName: string;
  tripPrice: number;
  currency: string;
  enabled: boolean;
  presets: { percent: number; amount: number }[];
  minAmount: number;
  maxAmount: number;
}

/**
 * Everything the tip screen needs.
 *
 * Percentages are of the *original trip price*, not the total — tipping on top
 * of the platform's own service fee would be charging the guest gratuity on a
 * fee the captain never sees.
 */
export function tipContext(db: Database, bookingId: string, customerId: string): TipContext {
  const booking = requireBooking(db, bookingId);
  if (booking.customerId !== customerId) throw new PaymentError('forbidden', 'Not your booking');

  const charter = db.charters.find((c) => c.id === booking.charterId);
  const owner = db.users.find((u) => u.id === booking.ownerId);

  const baseLine = booking.breakdown.lines.find((l) => l.key === 'base');
  const tripPrice = baseLine?.amount ?? booking.breakdown.subtotal;

  return {
    booking,
    charter,
    captainName: owner?.ownerProfile?.captainName || owner?.firstName || 'your captain',
    tripPrice,
    currency: booking.currency,
    enabled: charter?.policies.onlineTippingEnabled ?? true,
    presets: TIP_PRESETS.map((percent) => ({
      percent,
      amount: roundMoney((tripPrice * percent) / 100, booking.currency),
    })),
    minAmount: roundMoney((tripPrice * TIP_MIN_PERCENT) / 100, booking.currency),
    maxAmount: roundMoney((tripPrice * TIP_MAX_PERCENT) / 100, booking.currency),
  };
}

export function payTip(
  db: Database,
  bookingId: string,
  customerId: string,
  amount: number,
): Booking {
  const context = tipContext(db, bookingId, customerId);
  const { booking } = context;

  if (!context.enabled) {
    throw new PaymentError('disabled', 'This operator prefers to receive tips in person');
  }
  if (booking.tip) throw new PaymentError('already_paid', 'You have already tipped this trip');
  if (booking.status !== 'done') {
    throw new PaymentError('invalid', 'You can tip once the trip has happened');
  }
  if (amount < context.minAmount || amount > context.maxAmount) {
    throw new PaymentError(
      'invalid',
      `A tip must be between ${TIP_MIN_PERCENT}% and ${TIP_MAX_PERCENT}% of the trip price`,
    );
  }

  booking.tip = {
    amount: roundMoney(amount, booking.currency),
    currency: booking.currency,
    percentOfTripPrice: Math.round((amount / context.tripPrice) * 100),
    paidAt: new Date().toISOString(),
  };

  // Tips are not commissionable — the whole amount goes to the operator, which
  // is why this is a payout of its own rather than an adjustment to the trip's.
  db.payouts.push({
    id: newId(),
    ownerId: booking.ownerId,
    bookingId: booking.id,
    gross: booking.tip.amount,
    platformFee: 0,
    net: booking.tip.amount,
    currency: booking.currency,
    status: 'pending',
    scheduledFor: addDays(today(), 2),
  });

  const customer = db.users.find((u) => u.id === booking.customerId);
  notify(db, booking.ownerId, {
    type: 'tipPaymentMadeCaptain',
    category: 'payout',
    title: `${customer?.firstName ?? 'A customer'} sent a tip!`,
    body: `${booking.tip.amount} ${booking.currency} for the trip on ${booking.date}.`,
    href: `/owner/payouts`,
  });

  return booking;
}

/**
 * Charges any balances whose scheduled date has arrived.
 *
 * Runs from the same read-time sweep as the other expiries. A failure is
 * recorded rather than retried: the guest gets told, and the booking falls back
 * to being settleable by hand.
 */
export function settleScheduledBalances(db: Database): number {
  const cutoff = today();
  let changed = 0;

  for (const booking of db.bookings) {
    const balance = booking.balance;
    if (balance.mode !== 'scheduled' || balance.paidAt || !balance.scheduledFor) continue;
    if (balance.scheduledFor > cutoff) continue;

    const method = db.paymentMethods.find((c) => c.id === booking.paymentMethodId);

    if (!method || isExpired(method, new Date(cutoff))) {
      balance.lastAttemptFailedAt = new Date().toISOString();
      balance.mode = 'online_anytime';
      notify(db, booking.customerId, {
        type: 'remainingBalanceScheduledPaymentFailed',
        category: 'booking',
        title: 'Scheduled payment failed',
        body: `We could not charge the remaining balance for ${booking.date}. Please pay it another way.`,
        href: `/account/bookings/${booking.id}`,
      });
      changed += 1;
      continue;
    }

    balance.paidAt = new Date().toISOString();
    balance.outstanding = 0;
    notify(db, booking.customerId, {
      type: 'remainingBalanceScheduledPaymentMade',
      category: 'booking',
      title: 'Remaining balance paid',
      body: `We charged the remaining balance for your trip on ${booking.date}.`,
      href: `/account/bookings/${booking.id}`,
    });
    changed += 1;
  }

  return changed;
}
