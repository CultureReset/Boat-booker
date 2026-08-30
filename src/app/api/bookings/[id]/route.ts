import {
  forbidden,
  fromServiceError,
  notFound,
  ok,
  readJson,
  requireAuth,
  settle,
  withDb,
  withMutation,
} from '@/lib/api/http';
import {
  acceptBooking,
  cancelBooking,
  declineBooking,
  expandBooking,
} from '@/lib/services/bookings';

/** GET /api/bookings/:id — visible to the guest and the owner, nobody else. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await settle();

  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const result = await withDb((db) => {
    const booking = db.bookings.find((b) => b.id === id || b.reference === id);
    if (!booking) return { status: 'missing' as const };
    if (booking.customerId !== auth.user.id && booking.ownerId !== auth.user.id) {
      return { status: 'forbidden' as const };
    }
    return { status: 'ok' as const, booking: expandBooking(db, booking) };
  });

  if (result.status === 'missing') return notFound('Booking not found');
  if (result.status === 'forbidden') return forbidden('Not your booking');
  return ok(result.booking);
}

/**
 * POST /api/bookings/:id
 *
 * State transitions. `action` is one of accept, decline or cancel; each one
 * checks the caller's relationship to the booking inside the service layer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{ action?: string; reason?: string }>(request);

  try {
    const outcome = await withMutation((db) => {
      switch (body.action) {
        case 'accept':
          return { booking: acceptBooking(db, id, auth.user.id) };
        case 'decline':
          return { booking: declineBooking(db, id, auth.user.id, body.reason) };
        case 'cancel': {
          const cancellation = cancelBooking(db, id, auth.user.id, body.reason);
          return {
            booking: cancellation.booking,
            refund: cancellation.refund,
            forfeited: cancellation.forfeited,
            free: cancellation.free,
          };
        }
        default:
          throw Object.assign(new Error('Unknown action'), { code: 'invalid' });
      }
    });

    const expanded = await withDb((db) => expandBooking(db, outcome.booking));
    return ok({ ...outcome, booking: expanded });
  } catch (error) {
    return fromServiceError(error);
  }
}
