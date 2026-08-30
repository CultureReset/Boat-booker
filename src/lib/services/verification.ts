import { randomInt } from 'node:crypto';
import { newId } from '@/lib/core/ids';
import type { Database, PhoneVerification, PhoneVerificationPurpose } from '@/lib/domain/types';

/**
 * Phone verification by one-time code.
 *
 * Two places need it: finishing a registration, and changing the number on an
 * existing profile. Both go through the same code, because the rules that
 * matter — how long a code lives, how often one can be asked for, how many
 * guesses it takes — should not differ by which screen you came from.
 *
 * There is no SMS transport in this build. `sendCode` returns the code and the
 * API decides whether to expose it, exactly as the magic-link flow does.
 */

export class VerificationError extends Error {
  constructor(
    readonly code: 'invalid' | 'not_found' | 'expired' | 'too_many_attempts' | 'cooldown',
    message: string,
    /** Seconds until the next send is allowed, on a `cooldown`. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

/** Six digits, matching what an SMS autofill expects to find. */
export const CODE_LENGTH = 6;

/** A code is good for ten minutes. */
export const CODE_TTL_MINUTES = 10;

/**
 * How long before another code can be asked for.
 *
 * This is the number the resend timer counts down, so the client and the server
 * have to agree on it — the client imports this rather than hardcoding 60.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Guesses allowed per code before it is burnt. */
export const MAX_ATTEMPTS = 5;

/** E.164-ish: a leading +, then 7 to 15 digits. Spaces and dashes are ignored. */
export function normalisePhone(input: string): string {
  const trimmed = input.trim().replace(/[\s()\-.]/g, '');
  return trimmed.startsWith('+') ? `+${trimmed.slice(1).replace(/\D/g, '')}` : trimmed.replace(/\D/g, '');
}

export function isValidPhone(input: string): boolean {
  const digits = normalisePhone(input).replace(/^\+/, '');
  return digits.length >= 7 && digits.length <= 15;
}

function liveCodeFor(
  db: Database,
  userId: string,
  purpose: PhoneVerificationPurpose,
  now: Date,
): PhoneVerification | undefined {
  return db.phoneVerifications.find(
    (v) =>
      v.userId === userId &&
      v.purpose === purpose &&
      !v.consumedAt &&
      v.expiresAt > now.toISOString(),
  );
}

export interface SendResult {
  verification: PhoneVerification;
  /** Never surfaced outside demo mode — the API decides. */
  code: string;
  resendAfterSeconds: number;
}

/**
 * Issues a code, replacing any outstanding one for the same purpose.
 *
 * The cooldown is measured from the last code sent rather than tracked
 * separately, so a restart cannot reset someone's rate limit.
 */
export function sendCode(
  db: Database,
  userId: string,
  phone: string,
  purpose: PhoneVerificationPurpose = 'registration',
): SendResult {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new VerificationError('not_found', 'Account not found');

  const normalised = normalisePhone(phone);
  if (!isValidPhone(normalised)) throw new VerificationError('invalid', 'Enter a valid phone number');

  const now = new Date();

  const outstanding = liveCodeFor(db, userId, purpose, now);
  if (outstanding) {
    const elapsed = (now.getTime() - new Date(outstanding.createdAt).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw new VerificationError(
        'cooldown',
        'A code was just sent. Wait before asking for another.',
        Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      );
    }
    // Past the cooldown, the old code stops working — otherwise two live codes
    // double the guesses an attacker gets.
    outstanding.consumedAt = now.toISOString();
  }

  const verification: PhoneVerification = {
    id: newId(),
    userId,
    phone: normalised,
    code: String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0'),
    purpose,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString(),
    attempts: 0,
  };

  db.phoneVerifications.push(verification);

  return { verification, code: verification.code, resendAfterSeconds: RESEND_COOLDOWN_SECONDS };
}

/**
 * Checks a code and, on success, writes the number onto the account.
 *
 * A wrong guess counts against the code, not the account: five wrong answers
 * burn that code and the next step is to ask for a new one, which the cooldown
 * already paces.
 */
export function verifyCode(
  db: Database,
  userId: string,
  code: string,
  purpose: PhoneVerificationPurpose = 'registration',
): PhoneVerification {
  const now = new Date();
  const verification = liveCodeFor(db, userId, purpose, now);

  if (!verification) {
    // An expired code and a never-issued one look the same from outside, and
    // both have the same next step.
    throw new VerificationError('expired', 'That code has expired. Ask for a new one.');
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    throw new VerificationError('too_many_attempts', 'Too many attempts. Ask for a new code.');
  }

  verification.attempts += 1;

  if (verification.code !== code.trim()) {
    if (verification.attempts >= MAX_ATTEMPTS) {
      verification.consumedAt = now.toISOString();
      throw new VerificationError('too_many_attempts', 'Too many attempts. Ask for a new code.');
    }
    throw new VerificationError('invalid', 'That code is not right');
  }

  verification.consumedAt = now.toISOString();

  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.phone = verification.phone;
    user.phoneVerifiedAt = now.toISOString();
  }

  return verification;
}

/** Seconds left before another code can be requested; 0 when one can be now. */
export function cooldownRemaining(
  db: Database,
  userId: string,
  purpose: PhoneVerificationPurpose = 'registration',
): number {
  const now = new Date();
  const outstanding = liveCodeFor(db, userId, purpose, now);
  if (!outstanding) return 0;

  const elapsed = (now.getTime() - new Date(outstanding.createdAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}
