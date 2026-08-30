import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { toggleWishlist } from '@/lib/services/accounts';
import { buildCharterCard, indexPackages, indexReviews } from '@/lib/services/charters';

/** GET /api/wishlist — saved listings, rendered as search cards. */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const cards = await withDb((db) => {
    const packagesByCharter = indexPackages(db);
    const reviewsByCharter = indexReviews(db);

    return db.wishlist
      .filter((w) => w.userId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .flatMap((item) => {
        const charter = db.charters.find((c) => c.id === item.charterId);
        if (!charter) return [];

        const destination = db.destinations.find((d) => d.id === charter.destinationId);
        if (!destination) return [];

        const country = db.countries.find((c) => c.id === destination.countryId);
        const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;

        return [
          buildCharterCard({
            charter,
            packages: packagesByCharter.get(charter.id) ?? [],
            reviews: reviewsByCharter.get(charter.id) ?? [],
            destination,
            countryTitle: country?.title ?? '',
            stateAbbrev: state?.abbrev,
            currency: auth.user.currency,
            guests: 1,
          }),
        ];
      });
  });

  return ok(cards, { totalCount: cards.length });
}

/** POST /api/wishlist — toggle a listing in or out of the wishlist. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ charterId?: string }>(request);

  try {
    const saved = await withMutation((db) =>
      toggleWishlist(db, auth.user.id, String(body.charterId ?? '')),
    );
    return ok({ saved });
  } catch (error) {
    return fromServiceError(error);
  }
}
