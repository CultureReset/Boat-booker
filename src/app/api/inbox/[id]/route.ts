import { fromServiceError, ok, readJson, requireAuth, withMutation } from '@/lib/api/http';
import { markThreadRead, readThread, sendMessage } from '@/lib/services/messages';

/**
 * GET /api/inbox/:id
 *
 * Reading a conversation also marks it read, which is why this is a mutation
 * rather than a pure read.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const thread = await withMutation((db) => {
      markThreadRead(db, id, auth.user.id);
      return readThread(db, id, auth.user.id);
    });
    return ok(thread);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** POST /api/inbox/:id — send a message into the conversation. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{ body?: string }>(request);

  try {
    const result = await withMutation((db) => {
      sendMessage(db, id, auth.user.id, String(body.body ?? ''));
      return readThread(db, id, auth.user.id);
    });
    return ok(result, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}
