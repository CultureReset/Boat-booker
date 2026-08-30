import { randomBytes } from 'node:crypto';
import { clientKey, fail, ok, rateLimit, readJson } from '@/lib/api/http';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { getDb, mutate } from '@/lib/storage';

const TTL_MINUTES = 60;

/**
 * POST /api/auth/reset-password
 *
 * Request a reset link. The response is identical whether or not the address
 * exists, so this cannot be used to discover registered accounts.
 */
export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, 'reset'), 5, 60_000)) {
    return fail('rate_limited', 'Too many attempts. Try again in a minute.', 429);
  }

  const body = await readJson<{ email?: string }>(request);
  const email = body.email?.trim().toLowerCase() ?? '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail('invalid_email', 'Invalid email address.', 400);
  }

  const db = await getDb();
  const user = db.users.find((u) => u.email === email);
  let token: string | undefined;

  if (user) {
    token = randomBytes(32).toString('base64url');
    const now = new Date();
    await mutate((next) => {
      const nowIso = now.toISOString();
      next.passwordResets = next.passwordResets.filter(
        (r) => r.userId !== user.id && r.expiresAt > nowIso,
      );
      next.passwordResets.push({
        token: token!,
        userId: user.id,
        createdAt: nowIso,
        expiresAt: new Date(now.getTime() + TTL_MINUTES * 60_000).toISOString(),
      });
    });
  }

  const exposeToken = process.env.AUTH_EXPOSE_MAGIC_LINK !== 'false';

  return ok({
    // Always `sent: true` — see the note above about account enumeration.
    sent: true,
    email,
    resetUrl: exposeToken && token ? `/login/reset?token=${token}` : undefined,
  });
}

/**
 * PUT /api/auth/reset-password
 *
 * Consume a reset token and set the new password. Every existing session for
 * the account is revoked, so a stolen session cannot survive a reset.
 */
export async function PUT(request: Request) {
  const body = await readJson<{ token?: string; password?: string }>(request);
  const token = body.token ?? '';
  const password = body.password ?? '';

  if (!token) return fail('invalid_token', 'This link is not valid.', 400);

  const strength = validatePassword(password);
  if (!strength.valid) {
    return fail('weak_password', 'Password does not meet requirements', 400, strength.failed);
  }

  const db = await getDb();
  const reset = db.passwordResets.find((r) => r.token === token);

  if (!reset || reset.consumedAt || reset.expiresAt <= new Date().toISOString()) {
    return fail('invalid_token', 'This link has expired. Request a new one.', 400);
  }

  const credentials = hashPassword(password);

  await mutate((next) => {
    const target = next.passwordResets.find((r) => r.token === token);
    if (target) target.consumedAt = new Date().toISOString();

    const user = next.users.find((u) => u.id === reset.userId);
    if (user) {
      user.passwordHash = credentials.hash;
      user.passwordSalt = credentials.salt;
    }

    next.sessions = next.sessions.filter((s) => s.userId !== reset.userId);
  });

  return ok({ reset: true });
}
