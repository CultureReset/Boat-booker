import { clientKey, fail, ok, rateLimit, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { publicUser } from '@/lib/auth/session';
import {
  RESEND_COOLDOWN_SECONDS,
  VerificationError,
  cooldownRemaining,
  sendCode,
  verifyCode,
} from '@/lib/services/verification';

/**
 * Phone verification.
 *
 * `GET` reports where the signed-in account stands, so the finish-registration
 * screen can resume a countdown rather than restarting it on every reload.
 * `POST { action }` sends a code or answers one.
 *
 * There is no SMS transport in this build, so the code comes back in the
 * response and the screen fills it in. That is gated behind
 * `AUTH_EXPOSE_MAGIC_LINK` — the same switch the magic link uses, because it is
 * the same risk: with it on, anyone who can call this endpoint can verify any
 * number on their own account. It must be `false` in a real deployment.
 */

const exposeCode = () => process.env.AUTH_EXPOSE_MAGIC_LINK !== 'false';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const remaining = await withDb((db) => cooldownRemaining(db, auth.user.id));

  return ok({
    phone: auth.user.phone ?? null,
    verified: Boolean(auth.user.phoneVerifiedAt),
    resendAfterSeconds: remaining,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  // The service's own cooldown paces sending; this caps the whole endpoint so
  // a flood of wrong codes cannot be used to hunt for a live one.
  if (!rateLimit(clientKey(request, 'phone'), 12, 60_000)) {
    return fail('rate_limited', 'Too many attempts. Try again in a minute.', 429);
  }

  const body = await readJson<{ action?: 'send' | 'verify'; phone?: string; code?: string }>(request);

  try {
    if (body.action === 'verify') {
      const user = await withMutation((db) => {
        verifyCode(db, auth.user.id, String(body.code ?? ''));
        return db.users.find((u) => u.id === auth.user.id)!;
      });
      return ok({ verified: true, user: publicUser(user) });
    }

    const result = await withMutation((db) =>
      sendCode(db, auth.user.id, String(body.phone ?? auth.user.phone ?? '')),
    );

    return ok({
      sent: true,
      phone: result.verification.phone,
      resendAfterSeconds: result.resendAfterSeconds,
      // Present only in demo mode; production returns just `sent: true`.
      code: exposeCode() ? result.code : undefined,
    });
  } catch (error) {
    if (error instanceof VerificationError) {
      const status =
        error.code === 'cooldown' ? 429
        : error.code === 'not_found' ? 404
        : error.code === 'too_many_attempts' ? 429
        : 400;
      return fail(error.code, error.message, status, { retryAfter: error.retryAfter });
    }
    throw error;
  }
}
