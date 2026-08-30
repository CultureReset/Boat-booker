import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { deleteQuickReply, quickRepliesFor, saveQuickReply } from '@/lib/services/direct';
import { QUICK_REPLY_PLACEHOLDERS } from '@/lib/domain/types';

/** GET — the operator's templates, plus the placeholders they can use. */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const replies = await withDb((db) => quickRepliesFor(db, auth.user.id));
  return ok({ replies, placeholders: QUICK_REPLY_PLACEHOLDERS });
}

/** POST — create or update. `{ id, remove: true }` deletes. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; title?: string; body?: string; remove?: boolean }>(
    request,
  );

  try {
    const result = await withMutation((db) => {
      if (body.remove && body.id) {
        deleteQuickReply(db, body.id, auth.user.id);
        return { deleted: true };
      }
      return saveQuickReply(db, {
        ownerId: auth.user.id,
        id: body.id,
        title: String(body.title ?? ''),
        body: String(body.body ?? ''),
      });
    });
    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
