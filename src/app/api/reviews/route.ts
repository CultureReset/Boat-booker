import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { createReview, expandReview, respondToReview } from '@/lib/services/reviews';

/**
 * GET /api/reviews
 *
 * Reviews connected to the signed-in user: ones they wrote, or — with
 * `?role=owner` — ones left on their listings.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const asOwner = new URL(request.url).searchParams.get('role') === 'owner';

  const payload = await withDb((db) => {
    const reviews = db.reviews
      .filter((r) => (asOwner ? r.ownerId === auth.user.id : r.customerId === auth.user.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => expandReview(db, r));

    // Completed trips the guest has not reviewed yet drive the "waiting for
    // your review" prompt.
    const awaiting = asOwner
      ? []
      : db.bookings
          .filter((b) => b.customerId === auth.user.id && b.status === 'done' && !b.reviewId)
          .map((b) => {
            const charter = db.charters.find((c) => c.id === b.charterId);
            return {
              bookingId: b.id,
              reference: b.reference,
              date: b.date,
              charterTitle: charter?.title ?? '',
              charterId: b.charterId,
              photo: charter?.photos[0]
                ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
                : null,
            };
          });

    return { reviews, awaiting };
  });

  return ok(payload, { totalCount: payload.reviews.length });
}

/** POST /api/reviews — publish a review, or an owner response to one. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    bookingId?: string;
    headline?: string;
    body?: string;
    ratings?: Record<string, number>;
    reviewId?: string;
    response?: string;
  }>(request);

  try {
    if (body.reviewId && body.response !== undefined) {
      const review = await withMutation((db) =>
        respondToReview(db, String(body.reviewId), auth.user.id, String(body.response)),
      );
      const expanded = await withDb((db) => expandReview(db, review));
      return ok(expanded);
    }

    const review = await withMutation((db) =>
      createReview(db, {
        bookingId: String(body.bookingId ?? ''),
        customerId: auth.user.id,
        headline: String(body.headline ?? ''),
        body: String(body.body ?? ''),
        ratings: body.ratings ?? {},
      }),
    );
    const expanded = await withDb((db) => expandReview(db, review));
    return ok(expanded, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}
