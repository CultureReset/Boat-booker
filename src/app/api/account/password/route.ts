import { fromServiceError, ok, readJson, requireAuth, withMutation } from '@/lib/api/http';
import { changePassword } from '@/lib/services/accounts';

/**
 * PUT /api/account/password
 *
 * Changing the password invalidates every other session, so a device that was
 * signed in stays signed out after the change.
 */
export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);

  try {
    await withMutation((db) => {
      changePassword(
        db,
        auth.user.id,
        String(body.currentPassword ?? ''),
        String(body.newPassword ?? ''),
      );
      db.sessions = db.sessions.filter((s) => s.userId !== auth.user.id);
    });
    return ok({ changed: true, signedOutOtherDevices: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
