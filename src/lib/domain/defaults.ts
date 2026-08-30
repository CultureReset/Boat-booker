import { commerceConfig } from '@/config/brand';
import type {
  AccountHealth,
  BalanceState,
  Booking,
  CharterPolicies,
  ID,
  PaymentModelState,
} from './types';

/**
 * Default shapes for records the model gained after the first build.
 *
 * Every construction site — the seed generator, the booking service, the owner
 * service — goes through here, so a new field gets one default rather than one
 * per call site that then drift apart.
 */

/**
 * The four payment models, in the order the operator sees them.
 *
 * `deposit` is on by default because it is the only model that works before a
 * payout method exists; the others need Online Payments enabled first.
 */
export function defaultPaymentModels(depositPercent: number): PaymentModelState[] {
  return [
    { key: 'deposit', active: true, depositPercent, feeBearer: 'operator' },
    { key: 'full_upfront', active: false, feeBearer: 'operator' },
    { key: 'remaining_balance', active: false, feeBearer: 'operator' },
    { key: 'tip', active: false, feeBearer: 'operator' },
  ];
}

/** Policy fields added alongside the payment models. */
export function defaultPolicyExtras(depositPercent: number): Pick<
  CharterPolicies,
  'paymentModels' | 'advanceNoticeHours' | 'bookingWindowDays' | 'onlineTippingEnabled'
> {
  return {
    paymentModels: defaultPaymentModels(depositPercent),
    advanceNoticeHours: 24,
    bookingWindowDays: 365,
    onlineTippingEnabled: true,
  };
}

/**
 * What a fresh booking still owes and how it will be settled.
 *
 * Defaults to `direct_to_operator` — settling in person is the only mode that
 * needs no further consent from the guest, so it is the safe starting point
 * and the other two are opt-ins.
 */
export function initialBalance(outstanding: number, currency: string): BalanceState {
  return { outstanding, currency, mode: 'direct_to_operator' };
}

/** Fields every booking carries that predate no default of their own. */
export function bookingExtras(
  outstanding: number,
  currency: string,
): Pick<Booking, 'source' | 'addOns' | 'balance' | 'buddyInvitations'> {
  return {
    source: 'marketplace',
    addOns: [],
    balance: initialBalance(outstanding, currency),
    buddyInvitations: [],
  };
}

/** A clean health record. Rates start at 1 so a new operator is not punished. */
export function initialAccountHealth(ownerId: ID, now = new Date()): AccountHealth {
  return {
    ownerId,
    realizationRate: 1,
    responseRate: 1,
    instantBookStrikes: 0,
    bypassAttempts: 0,
    boatMalfunctionCancellations: 0,
    bookingLimit: null,
    bookingsSinceLimit: 0,
    suspensions: [],
    updatedAt: now.toISOString(),
  };
}

/** How long an operator has to answer a request before it lapses. */
export const RESPONSE_WINDOW_HOURS = commerceConfig.inquiryResponseWindowHours;
