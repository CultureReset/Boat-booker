import {
  fromServiceError,
  ok,
  readJson,
  requireAuth,
  settle,
  withDb,
  withMutation,
} from '@/lib/api/http';
import { createBooking, expandBooking, type CreateBookingInput } from '@/lib/services/bookings';
import type { PaymentMode } from '@/lib/domain/types';

/**
 * GET /api/bookings
 *
 * The signed-in user's bookings. Owners see bookings taken against their
 * listings; customers see the trips they booked. The scope is derived from the
 * session, never from a query parameter.
 */
export async function GET(request: Request) {
  await settle();

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const asOwner = url.searchParams.get('role') === 'owner' && auth.user.role === 'owner';

  const bookings = await withDb((db) => {
    const mine = db.bookings.filter((b) =>
      asOwner ? b.ownerId === auth.user.id : b.customerId === auth.user.id,
    );

    const today = new Date().toISOString().slice(0, 10);
    const filtered = mine.filter((b) => {
      switch (statusFilter) {
        case 'upcoming':
          return b.status === 'confirmed' && b.date >= today;
        case 'pending':
          return b.status === 'pending';
        case 'completed':
          return b.status === 'done';
        case 'cancelled':
          return b.status === 'cancelled' || b.status === 'declined' || b.status === 'withdrawn';
        case null:
        case '':
        case 'all':
          return true;
        default:
          return b.status === statusFilter;
      }
    });

    return filtered
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((b) => expandBooking(db, b));
  });

  return ok(bookings, { totalCount: bookings.length });
}

/** POST /api/bookings — create a booking or booking request. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<Partial<CreateBookingInput> & { paymentMode?: string }>(request);

  const paymentMode = (['online_full', 'online_deposit', 'on_arrival'] as const).includes(
    body.paymentMode as PaymentMode,
  )
    ? (body.paymentMode as PaymentMode)
    : 'online_deposit';

  try {
    const booking = await withMutation((db) =>
      createBooking(db, {
        charterId: String(body.charterId ?? ''),
        packageId: String(body.packageId ?? ''),
        date: String(body.date ?? ''),
        departureTime: String(body.departureTime ?? ''),
        adults: Math.max(1, Number(body.adults) || 1),
        children: Math.max(0, Number(body.children) || 0),
        days: Math.max(1, Number(body.days) || 1),
        paymentMode,
        currency: String(body.currency ?? auth.user.currency),
        customerId: auth.user.id,
        paymentMethodId: body.paymentMethodId ? String(body.paymentMethodId) : undefined,
        messageToOwner: body.messageToOwner ? String(body.messageToOwner) : undefined,
        applyCredit: Boolean(body.applyCredit),
        promoDiscount: Number(body.promoDiscount) || 0,
        contact: {
          firstName: String(body.contact?.firstName ?? auth.user.firstName),
          lastName: String(body.contact?.lastName ?? auth.user.lastName),
          email: String(body.contact?.email ?? auth.user.email),
          phone: String(body.contact?.phone ?? auth.user.phone ?? ''),
        },
      }),
    );

    const expanded = await withDb((db) => expandBooking(db, booking));
    return ok(expanded, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}
