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
  previewCancellation,
} from '@/lib/services/bookings';
import { findReason, impactCopy, penaltyCopy } from '@/lib/services/cancellation';
import {
  requestChange,
  respondToChange,
  withdrawChange,
} from '@/lib/services/changes';
import type { CancellationReasonKey, ChangeRequestFields } from '@/lib/domain/types';

/** GET /api/bookings/:id — visible to the guest and the owner, nobody else. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
 * State transitions. Each action checks the caller's relationship to the
 * booking inside the service layer, never here.
 *
 * `preview_cancel` is a read dressed as a POST because it takes a body: it
 * returns what cancelling *would* cost without doing it, which is what the
 * confirmation screen renders.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{
    action?: string;
    reason?: string;
    note?: string;
    requested?: ChangeRequestFields;
    changeRequestId?: string;
  }>(request);

  const reason = body.reason as CancellationReasonKey | undefined;

  try {
    if (body.action === 'preview_cancel') {
      const preview = await withDb((db) =>
        previewCancellation(db, id, auth.user.id, reason ?? 'other'),
      );
      return ok({
        refund: preview.refund,
        forfeited: preview.forfeited,
        free: preview.free,
        penaltyFree: preview.assessment.penaltyFree,
        supportReview: preview.assessment.supportReview,
        impact: preview.assessment.impact,
        impactLabel: impactCopy(preview.assessment.impact),
        // Copy is resolved here so the client renders penalties without
        // carrying a second copy of the enum.
        penalties: preview.assessment.penalties.map((penalty) => ({
          ...penalty,
          ...penaltyCopy(penalty.key),
        })),
        suspension: preview.assessment.suspension ?? null,
        followUp: findReason(reason ?? 'other')?.followUp ?? null,
      });
    }

    const outcome = await withMutation((db) => {
      switch (body.action) {
        case 'accept':
          return { booking: acceptBooking(db, id, auth.user.id) };

        case 'decline':
          return { booking: declineBooking(db, id, auth.user.id, body.reason) };

        case 'cancel': {
          const cancellation = cancelBooking(db, id, auth.user.id, reason, body.note);
          return {
            booking: cancellation.booking,
            refund: cancellation.refund,
            forfeited: cancellation.forfeited,
            free: cancellation.free,
            penalties: cancellation.penalties.map((penalty) => ({
              ...penalty,
              ...penaltyCopy(penalty.key),
            })),
            impact: cancellation.impact,
            impactLabel: impactCopy(cancellation.impact),
            pendingSupportReview: cancellation.pendingSupportReview,
          };
        }

        case 'request_change': {
          const change = requestChange(db, {
            bookingId: id,
            actorId: auth.user.id,
            requested: body.requested ?? {},
            note: String(body.note ?? ''),
          });
          return { booking: db.bookings.find((b) => b.id === id)!, changeRequest: change };
        }

        case 'accept_change':
        case 'decline_change': {
          const result = respondToChange(
            db,
            String(body.changeRequestId ?? ''),
            auth.user.id,
            body.action === 'accept_change' ? 'accept' : 'decline',
          );
          return {
            booking: result.booking,
            changeRequest: result.request,
            needsSupportReview: result.needsSupportReview,
          };
        }

        case 'withdraw_change': {
          const change = withdrawChange(db, String(body.changeRequestId ?? ''), auth.user.id);
          return { booking: db.bookings.find((b) => b.id === id)!, changeRequest: change };
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
