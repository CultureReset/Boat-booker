import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { listThreads, startThread } from '@/lib/services/messages';

/** GET /api/inbox — conversation list for the signed-in user. */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const threads = await withDb((db) => listThreads(db, auth.user.id));
  return ok(threads, {
    totalCount: threads.length,
    unreadCount: threads.reduce((sum, t) => sum + t.unreadCount, 0),
  });
}

/** POST /api/inbox — open (or reuse) a conversation about a listing. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ charterId?: string; body?: string }>(request);

  try {
    const thread = await withMutation((db) =>
      startThread(db, {
        customerId: auth.user.id,
        charterId: String(body.charterId ?? ''),
        body: String(body.body ?? ''),
      }),
    );
    return ok({ threadId: thread.id }, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}
