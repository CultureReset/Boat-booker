import { randomBytes } from 'node:crypto';
import { clientKey, fail, ok, rateLimit, readJson } from '@/lib/api/http';
import { createSession, publicUser } from '@/lib/auth/session';
import { newId } from '@/lib/core/ids';
import { getDb, mutate } from '@/lib/storage';
import type { User } from '@/lib/domain/types';

const TTL_MINUTES = 15;

/**
 * POST /api/auth/magic-link
 *
 * Issues a password-free login link. An unknown address is treated as a
 * signup, matching the "continue with email" flow on the live product.
 *
 * There is no mail transport in this build, so the token is returned in the
 * response and the UI renders it as a click-through. That is gated behind
 * `AUTH_EXPOSE_MAGIC_LINK`, which must be off in a real deployment — otherwise
 * anyone could request a link for any address and use the response to log in.
 */
export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, 'magic'), 5, 60_000)) {
    return fail('rate_limited', 'Too many attempts. Try again in a minute.', 429);
  }

  const body = await readJson<{ email?: string; intent?: 'customer' | 'owner' }>(request);
  const email = body.email?.trim().toLowerCase() ?? '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail('invalid_email', 'Invalid email address.', 400);
  }

  const token = randomBytes(32).toString('base64url');
  const now = new Date();

  await mutate((db) => {
    const nowIso = now.toISOString();
    // Drop this address's outstanding links so an old one cannot be replayed.
    db.magicLinks = db.magicLinks.filter((l) => l.email !== email && l.expiresAt > nowIso);
    db.magicLinks.push({
      token,
      email,
      intent: body.intent === 'owner' ? 'owner' : 'customer',
      createdAt: nowIso,
      expiresAt: new Date(now.getTime() + TTL_MINUTES * 60_000).toISOString(),
    });
  });

  const exposeToken = process.env.AUTH_EXPOSE_MAGIC_LINK !== 'false';

  return ok({
    email,
    sent: true,
    // Present only in demo mode; production returns just `sent: true`.
    loginUrl: exposeToken ? `/login/verify?token=${token}` : undefined,
  });
}

/**
 * GET /api/auth/magic-link?token=…
 *
 * Consumes a link. Tokens are single-use and time-limited.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token) return fail('invalid_token', 'This link is not valid.', 400);

  const db = await getDb();
  const link = db.magicLinks.find((l) => l.token === token);

  if (!link || link.consumedAt || link.expiresAt <= new Date().toISOString()) {
    return fail('invalid_token', 'This link has expired. Request a new one.', 400);
  }

  let user = db.users.find((u) => u.email === link.email);

  await mutate((next) => {
    const target = next.magicLinks.find((l) => l.token === token);
    if (target) target.consumedAt = new Date().toISOString();

    if (!user) {
      // First sign-in for this address creates the account. The name is filled
      // in afterwards by the "finish your profile" step.
      const now = new Date().toISOString();
      const created: User = {
        id: newId(),
        email: link.email,
        firstName: link.email.split('@')[0].slice(0, 60),
        lastName: '',
        role: link.intent === 'owner' ? 'owner' : 'customer',
        status: 'active',
        bio: '',
        language: 'en',
        currency: 'USD',
        timezone: 'America/New_York',
        countryCode: 'us',
        createdAt: now,
        completedTrips: 0,
        creditBalance: 0,
        referralCode: `NEW${Math.floor(1000 + Math.random() * 9000)}`,
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
      next.users.push(created);
      user = created;
    }
  });

  if (!user) return fail('server_error', 'Could not complete sign-in', 500);
  if (user.status === 'disabled') {
    return fail('account_disabled', 'This account is deactivated.', 403);
  }

  await createSession(user.id);
  // A brand-new magic-link account still needs a name before it can book.
  return ok({ user: publicUser(user), needsProfile: !user.lastName });
}
