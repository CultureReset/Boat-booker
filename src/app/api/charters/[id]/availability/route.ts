import { notFound, ok, withDb } from '@/lib/api/http';
import { today } from '@/lib/core/dates';
import { calendarForCharter } from '@/lib/services/availability';

/**
 * GET /api/charters/:id/availability
 *
 * Day-by-day calendar state for a listing, used by the date picker on the
 * listing page and by the owner calendar.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);

  const fromParam = url.searchParams.get('from');
  const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : today();
  const days = Math.min(400, Math.max(1, Number(url.searchParams.get('days')) || 120));
  const guests = Math.max(0, Number(url.searchParams.get('guests')) || 0);

  const result = await withDb((db) => {
    const charter = db.charters.find((c) => c.id === id);
    if (!charter) return null;

    const packages = db.packages.filter((p) => p.charterId === charter.id && p.active);
    return {
      charterId: charter.id,
      timezone: charter.timezone,
      updatedAt: charter.availabilityUpdatedAt,
      days: calendarForCharter({ charterId: charter.id, packages, db, from, days, guests }),
    };
  });

  if (!result) return notFound('Listing not found');
  return ok(result);
}
