import { clientKey, fail, ok, rateLimit, readJson } from '@/lib/api/http';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { createSession, publicUser } from '@/lib/auth/session';
import { newId } from '@/lib/core/ids';
import { getDb, mutate } from '@/lib/storage';
import type { User } from '@/lib/domain/types';

/**
 * POST /api/auth/signup
 *
 * Creates a customer or owner account. An owner signup additionally seeds the
 * owner profile so the business dashboard has somewhere to write to on the
 * very first visit.
 */
export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, 'signup'), 5, 60_000)) {
    return fail('rate_limited', 'Too many attempts. Try again in a minute.', 429);
  }

  const body = await readJson<{
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    companyName?: string;
    accountType?: 'customer' | 'owner';
    referralCode?: string;
  }>(request);

  const email = body.email?.trim().toLowerCase() ?? '';
  const firstName = body.firstName?.trim() ?? '';
  const lastName = body.lastName?.trim() ?? '';
  const password = body.password ?? '';
  const accountType = body.accountType === 'owner' ? 'owner' : 'customer';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail('invalid_email', 'Invalid email address.', 400);
  }
  if (!firstName) return fail('invalid_first_name', 'First name is required.', 400);
  if (!lastName) return fail('invalid_last_name', 'Last name is required.', 400);

  const strength = validatePassword(password);
  if (!strength.valid) {
    return fail('weak_password', 'Password does not meet requirements', 400, strength.failed);
  }

  if (accountType === 'owner' && !body.companyName?.trim()) {
    return fail('invalid_company', 'Business name is required.', 400);
  }

  const db = await getDb();
  if (db.users.some((u) => u.email === email)) {
    return fail('email_taken', 'An account with this email already exists.', 409);
  }

  const credentials = hashPassword(password);
  const now = new Date().toISOString();
  const referrer = body.referralCode
    ? db.users.find((u) => u.referralCode === body.referralCode?.trim().toUpperCase())
    : undefined;

  const user: User = {
    id: newId(),
    email,
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    firstName: firstName.slice(0, 60),
    lastName: lastName.slice(0, 60),
    phone: body.phone?.trim().slice(0, 40),
    role: accountType,
    status: 'active',
    bio: '',
    language: 'en',
    currency: 'USD',
    timezone: 'America/New_York',
    countryCode: 'us',
    createdAt: now,
    completedTrips: 0,
    creditBalance: 0,
    referralCode: `${firstName.toUpperCase().slice(0, 4)}${Math.floor(1000 + Math.random() * 9000)}`,
    referredBy: referrer?.id,
    notificationPreferences: {
      emailBookingUpdates: true,
      emailMessages: true,
      emailPromotions: false,
      emailReviewReminders: true,
      pushBookingUpdates: true,
      pushMessages: true,
      smsBookingUpdates: false,
    },
  };

  if (accountType === 'owner') {
    user.ownerProfile = {
      companyName: body.companyName!.trim().slice(0, 120),
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
          invitedAt: now,
          acceptedAt: now,
        },
      ],
      onlinePaymentsEnabled: false,
      responseRate: 100,
      averageResponseTimeSeconds: 0,
    };
  }

  await mutate((next) => {
    next.users.push(user);
  });

  await createSession(user.id);
  return ok({ user: publicUser(user) }, undefined, 201);
}
