import { fromServiceError, ok, readJson, requireAuth, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { createOffer, respondToInquiry, withdrawOffer } from '@/lib/services/offers';

/**
 * GET /api/offers — offers involving the signed-in user.
 *
 * Scope comes from the session, never a parameter: an operator sees the offers
 * they sent, a guest the ones they received.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const status = new URL(request.url).searchParams.get('status');

  const offers = await withDb((db) =>
    db.offers
      .filter((o) => o.ownerId === auth.user.id || o.customerId === auth.user.id)
      .filter((o) => !status || o.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((offer) => ({
        ...offer,
        charterTitle: db.charters.find((c) => c.id === offer.charterId)?.title ?? '',
        role: offer.ownerId === auth.user.id ? 'owner' : 'customer',
      })),
  );

  return ok(offers, { totalCount: offers.length });
}

/** POST /api/offers — operator sends a priced invitation to book. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    threadId?: string;
    packageId?: string | null;
    customTrip?: { title: string; description: string; hours: number };
    date?: string;
    departureTime?: string;
    adults?: number;
    children?: number;
    days?: number;
    price?: number;
  }>(request);

  try {
    const offer = await withMutation((db) =>
      createOffer(db, {
        ownerId: auth.user.id,
        threadId: String(body.threadId ?? ''),
        packageId: body.packageId ?? null,
        customTrip: body.customTrip,
        date: String(body.date ?? ''),
        departureTime: String(body.departureTime ?? ''),
        adults: Number(body.adults) || 1,
        children: Number(body.children) || 0,
        days: Number(body.days) || 1,
        price: typeof body.price === 'number' ? body.price : undefined,
      }),
    );
    return ok(offer, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/**
 * PATCH /api/offers — withdraw an offer, or answer an inquiry.
 *
 * Both are the operator responding to something outstanding in a thread, so
 * they share an endpoint rather than splitting into near-identical routes.
 */
export async function PATCH(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    offerId?: string;
    inquiryId?: string;
    action?: 'withdraw' | 'pre_approve' | 'decline';
  }>(request);

  try {
    const result = await withMutation((db) => {
      if (body.inquiryId) {
        return respondToInquiry(
          db,
          String(body.inquiryId),
          auth.user.id,
          body.action === 'pre_approve' ? 'pre_approve' : 'decline',
        );
      }
      return withdrawOffer(db, String(body.offerId ?? ''), auth.user.id);
    });
    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
