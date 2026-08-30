import { commerceConfig } from '@/config/brand';
import { convert, roundMoney } from '@/lib/core/money';
import type {
  Charter,
  PaymentMode,
  PriceBreakdown,
  PriceLine,
  TripPackage,
} from '@/lib/domain/types';

/**
 * Pricing engine.
 *
 * One function computes every price the platform quotes — search card minimums,
 * the listing page, the checkout summary, the booking record and the owner's
 * payout ledger all call through here, so a quote can never disagree with what
 * is ultimately charged.
 *
 * Order of operations matters and is fixed:
 *   base → additional guests → multi-day → discounts → service fee →
 *   card processing → split into due-now / due-on-arrival.
 */

export interface BreakdownInput {
  charter: Charter;
  pkg: TripPackage;
  adults: number;
  children: number;
  days: number;
  paymentMode: PaymentMode;
  /** Display currency. Amounts convert from the listing's base currency. */
  currency: string;
  /** Loyalty percentage (0–100) the customer qualifies for. */
  loyaltyDiscountPercent?: number;
  /** Boating credit to apply, in the display currency. */
  creditApplied?: number;
  /** Flat promotional discount in the display currency. */
  promoDiscount?: number;
}

export function computeBreakdown(input: BreakdownInput): PriceBreakdown {
  const {
    charter,
    pkg,
    adults,
    children,
    days,
    paymentMode,
    currency,
    loyaltyDiscountPercent = 0,
    creditApplied = 0,
    promoDiscount = 0,
  } = input;

  const from = pkg.currency;
  const to = currency;
  const cv = (amount: number) => roundMoney(convert(amount, from, to), to);

  const guests = adults + children;
  const lines: PriceLine[] = [];

  // --- Base fare ------------------------------------------------------------
  // Shared trips are priced per head; private trips price the whole boat.
  const baseAmount =
    pkg.type === 'shared' ? cv(pkg.price) * guests * days : cv(pkg.price) * days;

  lines.push({
    key: 'base',
    label: pkg.type === 'shared' ? 'tripPricePerPerson' : 'tripPrice',
    amount: baseAmount,
  });

  // --- Additional guests ----------------------------------------------------
  // Private trips may include a headcount in the base and charge beyond it.
  let additionalAmount = 0;
  if (pkg.type === 'private' && pkg.additionalPersonAfter && pkg.additionalPersonPrice) {
    const extraGuests = Math.max(0, guests - pkg.additionalPersonAfter);
    additionalAmount = cv(pkg.additionalPersonPrice) * extraGuests * days;
    if (extraGuests > 0) {
      lines.push({
        key: 'additional_guests',
        label: 'additionalGuests',
        amount: additionalAmount,
      });
    }
  }

  const subtotal = roundMoney(baseAmount + additionalAmount, to);

  // --- Discounts ------------------------------------------------------------
  const loyaltyAmount =
    loyaltyDiscountPercent > 0 ? roundMoney(subtotal * (loyaltyDiscountPercent / 100), to) : 0;
  if (loyaltyAmount > 0) {
    lines.push({ key: 'loyalty', label: 'loyaltyDiscount', amount: -loyaltyAmount });
  }

  const promo = Math.min(promoDiscount, subtotal - loyaltyAmount);
  if (promo > 0) {
    lines.push({ key: 'promo', label: 'promoDiscount', amount: -roundMoney(promo, to) });
  }

  const discountedSubtotal = Math.max(0, roundMoney(subtotal - loyaltyAmount - promo, to));

  // --- Platform service fee -------------------------------------------------
  const serviceFee = roundMoney(discountedSubtotal * commerceConfig.serviceFeeRate, to);
  lines.push({ key: 'service_fee', label: 'serviceFee', amount: serviceFee });

  // --- Card processing ------------------------------------------------------
  // Only charged when money actually moves through the platform.
  const paysOnline = paymentMode !== 'on_arrival';
  const processingBase = discountedSubtotal + serviceFee;
  const processingFee = paysOnline
    ? roundMoney(processingBase * (charter.policies.cardProcessingRate ?? 0), to)
    : 0;
  if (processingFee > 0) {
    lines.push({ key: 'processing_fee', label: 'processingFee', amount: processingFee });
  }

  const grossTotal = roundMoney(discountedSubtotal + serviceFee + processingFee, to);

  // --- Boating credit -------------------------------------------------------
  const credit = Math.min(creditApplied, grossTotal);
  if (credit > 0) {
    lines.push({ key: 'credit', label: 'creditApplied', amount: -roundMoney(credit, to) });
  }

  const total = Math.max(0, roundMoney(grossTotal - credit, to));

  // --- Payment split --------------------------------------------------------
  let dueNow = 0;
  if (paymentMode === 'online_full') {
    dueNow = total;
  } else if (paymentMode === 'online_deposit') {
    const rate = (charter.policies.depositPercent ?? commerceConfig.defaultDepositRate * 100) / 100;
    dueNow = roundMoney(total * rate, to);
  }
  const dueOnArrival = roundMoney(total - dueNow, to);

  // --- Security deposit -----------------------------------------------------
  // Informational: held by the operator on arrival, refunded after the trip,
  // and deliberately excluded from the total.
  const securityDeposit = charter.policies.hasSecurityDeposit
    ? cv(charter.policies.securityDepositAmount)
    : 0;
  if (securityDeposit > 0) {
    lines.push({
      key: 'security_deposit',
      label: 'securityDeposit',
      amount: securityDeposit,
      informational: true,
    });
  }

  return {
    currency: to,
    lines,
    subtotal,
    discounts: roundMoney(loyaltyAmount + promo + credit, to),
    total,
    dueNow,
    dueOnArrival,
    securityDeposit,
  };
}

/**
 * Cheapest achievable price for a listing, used by search cards and the
 * "from %price%" label. Computed against the smallest viable group so the
 * headline number is one a guest can actually book.
 */
export function minimumPriceFor(
  charter: Charter,
  packages: TripPackage[],
  currency: string,
  guests = 1,
): { amount: number; packageId: string } | null {
  const active = packages.filter((p) => p.active && p.capacity >= guests);
  if (!active.length) return null;

  let best: { amount: number; packageId: string } | null = null;
  for (const pkg of active) {
    const effectiveGuests = Math.max(guests, pkg.minPersons);
    const breakdown = computeBreakdown({
      charter,
      pkg,
      adults: effectiveGuests,
      children: 0,
      days: 1,
      paymentMode: 'on_arrival',
      currency,
    });
    if (!best || breakdown.total < best.amount) {
      best = { amount: breakdown.total, packageId: pkg.id };
    }
  }
  return best;
}

/** Loyalty tier for a customer, derived from completed trips. */
export function loyaltyTierFor(completedTrips: number) {
  const earned = commerceConfig.loyaltyTiers.filter((tier) => completedTrips >= tier.completedTrips);
  const current = earned[earned.length - 1] ?? null;
  const next = commerceConfig.loyaltyTiers.find((tier) => completedTrips < tier.completedTrips) ?? null;
  return {
    level: current?.level ?? 0,
    discountPercentage: current?.discountPercentage ?? 0,
    next,
    tripsToNext: next ? next.completedTrips - completedTrips : 0,
  };
}

/**
 * Refund owed if a booking is cancelled now.
 *
 * Inside the free-cancellation window everything paid comes back; outside it
 * the deposit is forfeit but anything paid beyond the deposit is returned.
 */
export function refundFor(
  breakdown: PriceBreakdown,
  freeCancellationDaysInAdvance: number,
  daysUntilTrip: number,
): { refund: number; forfeited: number; free: boolean } {
  const free = freeCancellationDaysInAdvance > 0 && daysUntilTrip >= freeCancellationDaysInAdvance;
  if (free) {
    return { refund: breakdown.dueNow, forfeited: 0, free: true };
  }
  const depositPortion = Math.min(breakdown.dueNow, breakdown.dueNow);
  return { refund: 0, forfeited: depositPortion, free: false };
}
