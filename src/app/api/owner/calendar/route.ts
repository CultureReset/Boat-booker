import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { today } from '@/lib/core/dates';
import { multiCalendar, setDateBlocks } from '@/lib/services/owner';

/**
 * GET /api/owner/calendar
 *
 * The multicalendar: one row per listing, one cell per day. The single-listing
 * calendar is the same data filtered client-side.
 */
export async function GET(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : today();
  const days = Math.min(120, Math.max(7, Number(url.searchParams.get('days')) || 35));

  const rows = await withDb((db) => multiCalendar(db, auth.user.id, from, days));
  return ok(rows, { from, days });
}

/**
 * POST /api/owner/calendar — block or unblock a set of dates.
 *
 * Dates already consumed by a booking are skipped rather than rejected, so a
 * bulk "block this month" does the right thing without the owner having to
 * deselect their booked days first.
 */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    charterId?: string;
    dates?: string[];
    blocked?: boolean;
    note?: string;
  }>(request);

  try {
    const changed = await withMutation((db) =>
      setDateBlocks(
        db,
        String(body.charterId ?? ''),
        auth.user.id,
        Array.isArray(body.dates) ? body.dates.map(String) : [],
        Boolean(body.blocked),
        body.note,
      ),
    );
    return ok({ changed });
  } catch (error) {
    return fromServiceError(error);
  }
}
