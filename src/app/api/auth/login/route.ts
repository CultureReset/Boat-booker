import { clientKey, fail, ok, rateLimit, readJson } from '@/lib/api/http';
import { publicUser, createSession } from '@/lib/auth/session';
import { needsRehash, hashPassword, verifyPassword } from '@/lib/auth/password';
import { getDb, mutate } from '@/lib/storage';

/**
 * POST /api/auth/login
 *
 * Email + password sign-in. The failure message is deliberately identical for
 * "no such account" and "wrong password" so the endpoint cannot be used to
 * enumerate which addresses are registered.
 */
export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, 'login'), 10, 60_000)) {
    return fail('rate_limited', 'Too many attempts. Try again in a minute.', 429);
  }

  const body = await readJson<{ email?: string; password?: string; intent?: string }>(request);
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  if (!email || !password) {
    return fail('invalid', 'Email and password are required', 400);
  }

  const db = await getDb();
  const user = db.users.find((u) => u.email === email);

  const valid =
    user &&
    verifyPassword(password, { hash: user.passwordHash ?? '', salt: user.passwordSalt ?? '' });

  if (!user || !valid) {
    return fail('invalid_credentials', 'Your email and/or password are incorrect.', 401);
  }

  if (user.status === 'disabled') {
    return fail('account_disabled', 'This account is deactivated.', 403);
  }

  // Opportunistically upgrade the stored digest if the work factor has risen.
  if (needsRehash({ hash: user.passwordHash, salt: user.passwordSalt })) {
    const next = hashPassword(password);
    await mutate((db2) => {
      const target = db2.users.find((u) => u.id === user.id);
      if (target) {
        target.passwordHash = next.hash;
        target.passwordSalt = next.salt;
      }
    });
  }

  await createSession(user.id);
  return ok({ user: publicUser(user) });
}
