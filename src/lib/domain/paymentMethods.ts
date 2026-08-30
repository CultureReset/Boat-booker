import type { PaymentMethod } from './types';

/**
 * Shared reading of a payment method.
 *
 * Both the checkout and the balance-payment link need to answer the same two
 * questions — can this still be charged, and what do we call it — and both used
 * to answer them by reaching straight for `expMonth`/`expYear`, which only a
 * card has. A wallet has no expiry, so that reasoning silently treated every
 * wallet as expired.
 */

/** Wallets never expire; a card does, at the end of its expiry month. */
export function isExpired(method: PaymentMethod, on: Date = new Date()): boolean {
  if (method.kind !== 'card') return false;
  if (method.expYear === undefined || method.expMonth === undefined) return false;

  const year = on.getUTCFullYear();
  const month = on.getUTCMonth() + 1;
  return method.expYear < year || (method.expYear === year && method.expMonth < month);
}

/**
 * How a method reads in a list.
 *
 * `title` names the instrument — a card brand, or the wallet — and `detail`
 * identifies which one: the last four digits, or the linked account. The wallet
 * names are proper nouns and stay untranslated.
 */
export function describe(method: PaymentMethod): { title: string; detail: string } {
  switch (method.kind) {
    case 'paypal':
      return { title: 'PayPal', detail: method.accountLabel ?? '' };
    case 'apple_pay':
      return { title: 'Apple Pay', detail: method.accountLabel ?? '' };
    default:
      return { title: method.brand ?? 'Card', detail: method.last4 ? `•••• ${method.last4}` : '' };
  }
}

/** The icon each kind carries in the UI. */
export function iconFor(method: PaymentMethod): 'card' | 'wallet' | 'phone' {
  if (method.kind === 'paypal') return 'wallet';
  if (method.kind === 'apple_pay') return 'phone';
  return 'card';
}
