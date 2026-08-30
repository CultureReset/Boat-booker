import type { Booking, MessageThread } from '@/lib/domain/types';

/**
 * Keeping conversations on the platform.
 *
 * Two different problems wear the same coat here and they need different
 * answers:
 *
 *   1. Guests and operators swapping phone numbers *before* a booking exists.
 *      Usually innocent — they want to talk — but it strips the platform of any
 *      record if the trip then goes wrong, so contact details are held back
 *      until a booking is confirmed and released automatically after.
 *
 *   2. Deliberate attempts to move the *payment* off-platform. That is fraud
 *      exposure for the guest and fee avoidance for the operator, and it stays
 *      blocked at every stage of the booking.
 *
 * The first is a delay, the second is a wall. Treating them the same would
 * either leak payments or make the product unusable after confirmation.
 */

export type ModerationVerdict =
  | { action: 'allow'; body: string }
  | { action: 'strip'; body: string; removed: string[] }
  | { action: 'block'; reason: 'off_platform_payment'; matched: string[] };

/** Emails, phone numbers, URLs and handles — the contact-detail shapes. */
const CONTACT_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'email address', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/gi },
  // Seven or more digits, tolerating the separators people actually type.
  { label: 'phone number', pattern: /(?:\+?\d[\d\s().-]{6,}\d)/g },
  { label: 'link', pattern: /\b(?:https?:\/\/|www\.)[^\s]+/gi },
  { label: 'social handle', pattern: /(?:^|\s)@[A-Za-z][\w.]{2,}/g },
];

/**
 * Phrases that mean "pay me directly".
 *
 * Deliberately conservative: each one names a payment rail or an explicit
 * instruction to leave the platform. Matching on "cash" alone would block
 * legitimate messages about the on-arrival balance, which is a supported
 * payment mode.
 */
const PAYMENT_BYPASS_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'payment app', pattern: /\b(venmo|zelle|cash\s?app|paypal\.me|revolut|wise|western\s?union)\b/gi },
  { label: 'wire request', pattern: /\b(wire|bank)\s+(me|us|the)\s+(the\s+)?(money|payment|deposit|funds)\b/gi },
  { label: 'off-platform booking', pattern: /\b(book|pay|deal)\s+(with\s+me\s+)?(directly|off[\s-]?(the\s+)?(site|platform|app)|outside\s+(of\s+)?(the\s+)?(site|platform|app))\b/gi },
  { label: 'fee avoidance', pattern: /\b(avoid|skip|save\s+on|dodge)\s+(the\s+)?(fee|fees|commission|booking\s+fee)\b/gi },
  { label: 'crypto', pattern: /\b(bitcoin|btc|usdt|crypto\s+wallet)\b/gi },
];

/** A booking is far enough along that contact details can safely be exchanged. */
export function contactDetailsUnlocked(booking: Booking | undefined): boolean {
  if (!booking) return false;
  return (
    booking.status === 'confirmed' ||
    booking.status === 'accepted' ||
    booking.status === 'change_requested' ||
    booking.status === 'change_pending' ||
    booking.status === 'done'
  );
}

function findMatches(body: string, set: { label: string; pattern: RegExp }[]): string[] {
  const found = new Set<string>();
  for (const { label, pattern } of set) {
    // Fresh lastIndex each call — these are module-level globals.
    pattern.lastIndex = 0;
    if (pattern.test(body)) found.add(label);
  }
  return [...found];
}

/**
 * Decides what happens to a message before it is stored.
 *
 * Support threads skip moderation entirely: telling support your phone number
 * is the normal thing to do, and there is no counterparty to protect from.
 */
export function moderateMessage(
  body: string,
  thread: Pick<MessageThread, 'kind'>,
  booking: Booking | undefined,
): ModerationVerdict {
  if (thread.kind === 'support') return { action: 'allow', body };

  const bypass = findMatches(body, PAYMENT_BYPASS_PATTERNS);
  if (bypass.length) {
    return { action: 'block', reason: 'off_platform_payment', matched: bypass };
  }

  if (contactDetailsUnlocked(booking)) return { action: 'allow', body };

  const contact = findMatches(body, CONTACT_PATTERNS);
  if (!contact.length) return { action: 'allow', body };

  let redacted = body;
  for (const { pattern } of CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, (match) =>
      // Preserve any leading whitespace the handle pattern captured.
      match.replace(/\S/g, '•'),
    );
  }

  return { action: 'strip', body: redacted, removed: contact };
}

/**
 * How many blocked attempts before a thread is flagged for the other party.
 *
 * One is a misunderstanding. Three in the same conversation is a pattern, and
 * the guest deserves to be told before they act on it.
 */
export const BYPASS_FLAG_THRESHOLD = 3;

/** Counts blocked attempts on a thread so far, from the moderation markers. */
export function shouldFlagThread(priorWarnings: number): boolean {
  return priorWarnings + 1 >= BYPASS_FLAG_THRESHOLD;
}
