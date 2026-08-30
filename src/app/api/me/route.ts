import { fromServiceError, ok, readJson, requireAuth, settle, withDb, withMutation } from '@/lib/api/http';
import { publicUser } from '@/lib/auth/session';
import { accountSummary, updateNotificationPreferences, updateProfile } from '@/lib/services/accounts';
import { unreadCount } from '@/lib/services/messages';

/**
 * GET /api/me
 *
 * The session bootstrap every client makes on load. Returns null for a signed
 * out visitor rather than 401 — "not logged in" is a normal state, not an error.
 */
export async function GET() {
  await settle();
  const auth = await requireAuth();
  if (!auth.ok) return ok({ user: null, status: 'unauthenticated' });

  const payload = await withDb((db) => ({
    user: publicUser(auth.user),
    status: 'authenticated' as const,
    summary: accountSummary(db, auth.user),
    unreadMessages: unreadCount(db, auth.user.id),
    unreadNotifications: db.notifications.filter((n) => n.userId === auth.user.id && !n.readAt).length,
  }));

  return ok(payload);
}

/** PATCH /api/me — profile and notification preferences. */
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<Record<string, unknown>>(request);

  try {
    const user = await withMutation((db) => {
      const updated = updateProfile(db, auth.user.id, body as never);
      if (body.notificationPreferences && typeof body.notificationPreferences === 'object') {
        updateNotificationPreferences(db, auth.user.id, body.notificationPreferences as never);
      }
      return updated;
    });
    return ok({ user: publicUser(user) });
  } catch (error) {
    return fromServiceError(error);
  }
}
