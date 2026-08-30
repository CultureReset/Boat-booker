import { ok } from '@/lib/api/http';
import { destroySession } from '@/lib/auth/session';

/** POST /api/auth/logout — revokes the session server-side and clears the cookie. */
export async function POST() {
  await destroySession();
  return ok({ signedOut: true });
}
