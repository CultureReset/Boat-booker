import { notFound, ok, settle, withDb, withMutation } from '@/lib/api/http';
import { currentUser } from '@/lib/auth/session';
import { defaultCurrency } from '@/config/locale';
import { buildBlockIndex } from '@/lib/services/availability';
import { buildCharterDetail } from '@/lib/services/charters';

/**
 * GET /api/charters/:id
 *
 * Full listing payload. Availability is resolved against the date and group
 * size in the query so the trip list can be rendered with live pricing in one
 * round trip.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await settle();

  const { id } = await params;
  const url = new URL(request.url);

  const adults = Math.max(1, Number(url.searchParams.get('adults')) || 2);
  const children = Math.max(0, Number(url.searchParams.get('children')) || 0);
  const days = Math.max(1, Number(url.searchParams.get('days')) || 1);
  const dateParam = url.searchParams.get('date');
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  const currency = (url.searchParams.get('currency') ?? defaultCurrency).toUpperCase();

  const viewer = await currentUser();

  const detail = await withDb((db) => {
    const charter = db.charters.find((c) => c.id === id);
    if (!charter) return null;

    // The exact meeting address is released only to the owner, or to a guest
    // who actually holds a confirmed booking on this listing.
    const revealExactAddress = Boolean(
      viewer &&
        (viewer.id === charter.ownerId ||
          db.bookings.some(
            (b) =>
              b.charterId === charter.id &&
              b.customerId === viewer.id &&
              (b.status === 'confirmed' || b.status === 'accepted' || b.status === 'done'),
          )),
    );

    return buildCharterDetail({
      db,
      charter,
      currency,
      guests: adults + children,
      days,
      date,
      blockIndex: buildBlockIndex(db),
      revealExactAddress,
    });
  });

  if (!detail) return notFound('Listing not found');

  // Cheap popularity signal, used by the "in demand" badge.
  await withMutation((db) => {
    const charter = db.charters.find((c) => c.id === id);
    if (charter) charter.viewsLast7Days += 1;
  });

  return ok(detail);
}
