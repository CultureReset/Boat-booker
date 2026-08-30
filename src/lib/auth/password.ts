import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing.
 *
 * PBKDF2-SHA512 from the Node standard library — no native dependency, and
 * strong enough that a leaked snapshot is not a leaked password list. The
 * iteration count is stored implicitly by the constant below; raising it
 * requires a rehash-on-login migration, which `needsRehash` supports.
 */

const ITERATIONS = 120_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export interface PasswordCredentials {
  hash: string;
  salt: string;
}

export function hashPassword(password: string): PasswordCredentials {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return { hash: `${ITERATIONS}$${hash}`, salt };
}

export function verifyPassword(
  password: string,
  credentials: Partial<PasswordCredentials> | undefined,
): boolean {
  if (!credentials?.hash || !credentials.salt) return false;

  const [iterationsRaw, storedHash] = credentials.hash.includes('$')
    ? credentials.hash.split('$')
    : [String(ITERATIONS), credentials.hash];

  const iterations = Number(iterationsRaw) || ITERATIONS;
  const candidate = pbkdf2Sync(password, credentials.salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(storedHash, 'hex');

  // Length mismatch would make timingSafeEqual throw, so check it first — the
  // early return leaks only the digest length, which is not a secret.
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function needsRehash(credentials: Partial<PasswordCredentials> | undefined): boolean {
  if (!credentials?.hash) return true;
  const [iterations] = credentials.hash.split('$');
  return Number(iterations) < ITERATIONS;
}

export interface PasswordRule {
  key: string;
  test: (value: string) => boolean;
}

/** Rules are shared by the server validator and the live client-side checklist. */
export const passwordRules: PasswordRule[] = [
  { key: 'passwordMinLength', test: (v) => v.length >= 8 },
  { key: 'passwordContainsLowercase', test: (v) => /[a-z]/.test(v) },
  { key: 'passwordContainsUppercase', test: (v) => /[A-Z]/.test(v) },
  { key: 'passwordContainsNumber', test: (v) => /\d/.test(v) },
];

export function validatePassword(password: string): { valid: boolean; failed: string[] } {
  const failed = passwordRules.filter((rule) => !rule.test(password)).map((rule) => rule.key);
  return { valid: failed.length === 0, failed };
}
