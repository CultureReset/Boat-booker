import { notFound, ok, withDb } from '@/lib/api/http';
import { reviewStatisticsFor } from '@/lib/services/charters';
import { reviewsForCharter } from '@/lib/services/reviews';

/** GET /api/charters/:id/reviews — paginated reviews plus the rating breakdown. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);

  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page')) || 10));
  const sortParam = url.searchParams.get('sort');
  const sort = sortParam === 'highest' || sortParam === 'lowest' ? sortParam : 'newest';

  const result = await withDb((db) => {
    if (!db.charters.some((c) => c.id === id)) return null;
    const page1 = reviewsForCharter(db, id, { page, perPage, sort });
    return {
      ...page1,
      statistics: reviewStatisticsFor(db.reviews.filter((r) => r.charterId === id)),
    };
  });

  if (!result) return notFound('Listing not found');
  return ok({ reviews: result.reviews, statistics: result.statistics }, result.metadata);
}
