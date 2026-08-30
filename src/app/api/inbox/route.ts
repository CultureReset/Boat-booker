import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { listThreads, startThread, type ThreadFilter } from '@/lib/services/messages';
import { createInquiry } from '@/lib/services/offers';

const FILTERS: ThreadFilter[] = ['latest', 'unread', 'priority', 'support', 'archived'];

function parseFilter(value: string | null): ThreadFilter {
  return FILTERS.includes(value as ThreadFilter) ? (value as ThreadFilter) : 'latest';
}

/** GET /api/inbox?filter= — conversation list for the signed-in user. */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const filter = parseFilter(new URL(request.url).searchParams.get('filter'));
  const threads = await withDb((db) => listThreads(db, auth.user.id, filter));

  return ok(threads, {
    filter,
    totalCount: threads.length,
    unreadCount: threads.reduce((sum, t) => sum + t.unreadCount, 0),
  });
}

/**
 * POST /api/inbox — start a conversation about a listing.
 *
 * Sending trip details makes it an *inquiry*, which starts the operator's
 * response clock and can be pre-approved; without them it is just a message.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    charterId?: string;
    body?: string;
    date?: string;
    adults?: number;
    children?: number;
  }>(request);

  const isInquiry = Boolean(body.date || body.adults);

  try {
    const result = await withMutation((db) => {
      if (isInquiry) {
        const { inquiry, threadId } = createInquiry(db, {
          customerId: auth.user.id,
          charterId: String(body.charterId ?? ''),
          body: String(body.body ?? ''),
          date: body.date,
          adults: Number(body.adults) || undefined,
          children: Number(body.children) || 0,
        });
        return { threadId, inquiryId: inquiry.id };
      }

      const thread = startThread(db, {
        customerId: auth.user.id,
        charterId: String(body.charterId ?? ''),
        body: String(body.body ?? ''),
      });
      return { threadId: thread.id, inquiryId: null };
    });

    return ok(result, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}
