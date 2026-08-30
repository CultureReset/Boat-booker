import { commerceConfig } from '@/config/brand';
import { currencyByCode, languageByCode } from '@/config/locale';
import { newId } from '@/lib/core/ids';
import { roundMoney } from '@/lib/core/money';
import { hashPassword, validatePassword, verifyPassword } from '@/lib/auth/password';
import type { Database, SavedCard, User } from '@/lib/domain/types';
import { loyaltyTierFor } from './pricing';

/**
 * Account operations: profile, preferences, saved cards, wishlist, credit.
 *
 * Anything that touches credentials or payment instruments lives here so those
 * rules exist in exactly one place.
 */

export class AccountError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'invalid'
      | 'email_taken'
      | 'weak_password'
      | 'wrong_password',
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  language?: string;
  currency?: string;
  countryCode?: string;
  timezone?: string;
}

export function updateProfile(db: Database, userId: string, input: ProfileUpdate): User {
  const user = requireUser(db, userId);

  if (input.firstName !== undefined) {
    const value = input.firstName.trim();
    if (!value) throw new AccountError('invalid', 'First name is required');
    user.firstName = value.slice(0, 60);
  }
  if (input.lastName !== undefined) {
    const value = input.lastName.trim();
    if (!value) throw new AccountError('invalid', 'Last name is required');
    user.lastName = value.slice(0, 60);
  }
  if (input.phone !== undefined) user.phone = input.phone.trim().slice(0, 40);
  if (input.bio !== undefined) user.bio = input.bio.trim().slice(0, 1000);

  // Preferences are validated against the registries rather than stored raw,
  // so an unknown code can never break formatting downstream.
  if (input.language && languageByCode.has(input.language)) user.language = input.language;
  if (input.currency && currencyByCode.has(input.currency.toUpperCase())) {
    user.currency = input.currency.toUpperCase();
  }
  if (input.countryCode) user.countryCode = input.countryCode.toLowerCase().slice(0, 2);
  if (input.timezone) user.timezone = input.timezone.slice(0, 64);

  return user;
}

export function updateNotificationPreferences(
  db: Database,
  userId: string,
  input: Partial<User['notificationPreferences']>,
): User {
  const user = requireUser(db, userId);
  const keys = Object.keys(user.notificationPreferences) as (keyof User['notificationPreferences'])[];

  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'boolean') user.notificationPreferences[key] = value;
  }
  return user;
}

export function changePassword(
  db: Database,
  userId: string,
  currentPassword: string,
  newPassword: string,
): void {
  const user = requireUser(db, userId);

  // An account created by magic link has no password yet; in that case there
  // is nothing to verify and this call sets the first one.
  if (user.passwordHash && !verifyPassword(currentPassword, {
    hash: user.passwordHash,
    salt: user.passwordSalt ?? '',
  })) {
    throw new AccountError('wrong_password', 'Current password is incorrect');
  }

  const check = validatePassword(newPassword);
  if (!check.valid) {
    throw new AccountError('weak_password', 'Password does not meet requirements', check.failed);
  }

  const credentials = hashPassword(newPassword);
  user.passwordHash = credentials.hash;
  user.passwordSalt = credentials.salt;
}

export function changeEmail(db: Database, userId: string, email: string): User {
  const user = requireUser(db, userId);
  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AccountError('invalid', 'Invalid email address');
  }
  if (db.users.some((u) => u.email === normalized && u.id !== userId)) {
    throw new AccountError('email_taken', 'That email is already in use');
  }

  user.email = normalized;
  return user;
}

/** Promote a customer account to an owner account, keeping its history. */
export function becomeOwner(db: Database, userId: string, companyName: string): User {
  const user = requireUser(db, userId);
  if (user.role === 'owner') return user;

  const name = companyName.trim();
  if (name.length < 2) throw new AccountError('invalid', 'Enter your business name');

  user.role = 'owner';
  user.ownerProfile = {
    companyName: name.slice(0, 120),
    captainName: `${user.firstName} ${user.lastName}`,
    captainType: 'captain',
    background: '',
    languages: 'English',
    yearStartedRunningCharters: new Date().getFullYear(),
    verification: { status: 'unverified', documents: [] },
    payoutMethods: [],
    team: [
      {
        id: newId(),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: 'owner',
        invitedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
      },
    ],
    onlinePaymentsEnabled: false,
    responseRate: 100,
    averageResponseTimeSeconds: 0,
  };

  return user;
}

/** Anonymise rather than hard-delete, so bookings and payouts stay consistent. */
export function deleteAccount(db: Database, userId: string): void {
  const user = requireUser(db, userId);

  user.status = 'disabled';
  user.email = `deleted+${user.id}@invalid`;
  user.firstName = 'Deleted';
  user.lastName = 'User';
  user.phone = undefined;
  user.bio = '';
  user.passwordHash = undefined;
  user.passwordSalt = undefined;

  db.sessions = db.sessions.filter((s) => s.userId !== userId);
  db.cards = db.cards.filter((c) => c.userId !== userId);
  db.wishlist = db.wishlist.filter((w) => w.userId !== userId);
}

// --- Saved cards -----------------------------------------------------------

const CARD_BRANDS: { pattern: RegExp; brand: string }[] = [
  { pattern: /^4/, brand: 'Visa' },
  { pattern: /^5[1-5]/, brand: 'Mastercard' },
  { pattern: /^3[47]/, brand: 'American Express' },
  { pattern: /^6(?:011|5)/, brand: 'Discover' },
];

/** Luhn check. Catches typos before a card is stored. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export function addCard(
  db: Database,
  userId: string,
  input: { number: string; expMonth: number; expYear: number; makeDefault?: boolean },
): SavedCard {
  requireUser(db, userId);

  const digits = input.number.replace(/\D/g, '');
  if (!luhnValid(digits)) throw new AccountError('invalid', 'That card number is not valid');

  const now = new Date();
  if (
    !Number.isInteger(input.expMonth) || input.expMonth < 1 || input.expMonth > 12 ||
    !Number.isInteger(input.expYear) || input.expYear < now.getFullYear() ||
    (input.expYear === now.getFullYear() && input.expMonth < now.getMonth() + 1)
  ) {
    throw new AccountError('invalid', 'That expiry date has passed');
  }

  const card: SavedCard = {
    id: newId(),
    userId,
    brand: CARD_BRANDS.find((b) => b.pattern.test(digits))?.brand ?? 'Card',
    // Only the last four digits are ever persisted — the PAN is discarded here
    // and never written to the snapshot.
    last4: digits.slice(-4),
    expMonth: input.expMonth,
    expYear: input.expYear,
    isDefault: input.makeDefault ?? db.cards.filter((c) => c.userId === userId).length === 0,
    createdAt: new Date().toISOString(),
  };

  if (card.isDefault) {
    for (const existing of db.cards) {
      if (existing.userId === userId) existing.isDefault = false;
    }
  }

  db.cards.push(card);
  return card;
}

export function removeCard(db: Database, userId: string, cardId: string): void {
  const card = db.cards.find((c) => c.id === cardId);
  if (!card) throw new AccountError('not_found', 'Card not found');
  if (card.userId !== userId) throw new AccountError('forbidden', 'Not your card');

  db.cards = db.cards.filter((c) => c.id !== cardId);

  // Promote another card so the account is never left without a default.
  const remaining = db.cards.filter((c) => c.userId === userId);
  if (card.isDefault && remaining.length) remaining[0].isDefault = true;
}

export function setDefaultCard(db: Database, userId: string, cardId: string): void {
  const card = db.cards.find((c) => c.id === cardId);
  if (!card) throw new AccountError('not_found', 'Card not found');
  if (card.userId !== userId) throw new AccountError('forbidden', 'Not your card');

  for (const existing of db.cards) {
    if (existing.userId === userId) existing.isDefault = existing.id === cardId;
  }
}

// --- Wishlist --------------------------------------------------------------

export function toggleWishlist(db: Database, userId: string, charterId: string): boolean {
  const existing = db.wishlist.find((w) => w.userId === userId && w.charterId === charterId);

  if (existing) {
    db.wishlist = db.wishlist.filter((w) => w.id !== existing.id);
    return false;
  }

  if (!db.charters.some((c) => c.id === charterId)) {
    throw new AccountError('not_found', 'Listing not found');
  }

  db.wishlist.push({
    id: newId(),
    userId,
    charterId,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export function wishlistCharterIds(db: Database, userId: string): Set<string> {
  return new Set(db.wishlist.filter((w) => w.userId === userId).map((w) => w.charterId));
}

// --- Loyalty, credit and referrals ----------------------------------------

export function accountSummary(db: Database, user: User) {
  const loyalty = loyaltyTierFor(user.completedTrips);
  const bookings = db.bookings.filter((b) => b.customerId === user.id);

  return {
    loyalty,
    creditBalance: user.creditBalance,
    referralCode: user.referralCode,
    referralCredit: commerceConfig.referralCredit,
    referredCount: db.users.filter((u) => u.referredBy === user.id).length,
    counts: {
      upcoming: bookings.filter((b) => b.status === 'confirmed' && b.date >= new Date().toISOString().slice(0, 10)).length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      completed: bookings.filter((b) => b.status === 'done').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled' || b.status === 'declined').length,
      wishlist: db.wishlist.filter((w) => w.userId === user.id).length,
      reviewsWritten: db.reviews.filter((r) => r.customerId === user.id).length,
      awaitingReview: bookings.filter((b) => b.status === 'done' && !b.reviewId).length,
    },
  };
}

/** Credit both sides once a referred guest completes their first trip. */
export function grantReferralCredit(db: Database, referredUserId: string): void {
  const referred = db.users.find((u) => u.id === referredUserId);
  if (!referred?.referredBy) return;

  const referrer = db.users.find((u) => u.id === referred.referredBy);
  if (!referrer) return;

  const amount = commerceConfig.referralCredit;
  referrer.creditBalance = roundMoney(referrer.creditBalance + amount);
  referred.creditBalance = roundMoney(referred.creditBalance + amount);
}

function requireUser(db: Database, userId: string): User {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new AccountError('not_found', 'Account not found');
  return user;
}
