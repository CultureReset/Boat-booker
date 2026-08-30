import { fromServiceError, ok, readJson, requireAuth, withMutation } from '@/lib/api/http';
import { becomeOwner, changeEmail, deleteAccount } from '@/lib/services/accounts';
import { destroySession, publicUser } from '@/lib/auth/session';

/**
 * POST /api/account
 *
 * Account-level actions that are not simple field edits: changing the login
 * email, and upgrading a customer account into an owner account.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ action?: string; email?: string; companyName?: string }>(request);

  try {
    const user = await withMutation((db) => {
      switch (body.action) {
        case 'change_email':
          return changeEmail(db, auth.user.id, String(body.email ?? ''));
        case 'become_owner':
          return becomeOwner(db, auth.user.id, String(body.companyName ?? ''));
        default:
          throw Object.assign(new Error('Unknown action'), { code: 'invalid' });
      }
    });
    return ok({ user: publicUser(user) });
  } catch (error) {
    return fromServiceError(error);
  }
}

/**
 * DELETE /api/account
 *
 * Anonymises the account rather than removing the row, so bookings, payouts
 * and the other party's message history stay coherent.
 */
export async function DELETE() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    await withMutation((db) => deleteAccount(db, auth.user.id));
    await destroySession();
    return ok({ deleted: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
