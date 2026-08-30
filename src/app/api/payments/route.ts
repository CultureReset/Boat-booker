import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import {
  createBalanceLink,
  payBalance,
  payTip,
  resolvePaymentToken,
  scheduleBalance,
  tipContext,
} from '@/lib/services/payments';

/**
 * GET /api/payments?token= — resolve a payment link.
 * GET /api/payments?tip=<bookingId> — tip context for a completed trip.
 *
 * Token lookups are open to signed-out visitors: the link *is* the credential,
 * and forcing a login at the dock defeats the point of sending one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const tipBookingId = url.searchParams.get('tip');

  try {
    if (token) {
      const context = await withDb((db) => resolvePaymentToken(db, token));
      return ok({
        bookingId: context.booking.id,
        reference: context.booking.reference,
        date: context.booking.date,
        outstanding: context.booking.balance.outstanding,
        currency: context.booking.currency,
        charterTitle: context.charter?.title ?? '',
        captainName: context.captainName,
      });
    }

    if (tipBookingId) {
      const auth = await requireAuth();
      if (!auth.ok) return auth.response;

      const context = await withDb((db) => tipContext(db, tipBookingId, auth.user.id));
      return ok({
        bookingId: context.booking.id,
        reference: context.booking.reference,
        date: context.booking.date,
        tripPrice: context.tripPrice,
        currency: context.currency,
        enabled: context.enabled,
        presets: context.presets,
        minAmount: context.minAmount,
        maxAmount: context.maxAmount,
        captainName: context.captainName,
        alreadyTipped: Boolean(context.booking.tip),
      });
    }

    return ok(null);
  } catch (error) {
    return fromServiceError(error);
  }
}

/**
 * POST /api/payments
 *
 * `{ action }` selects between requesting a link, paying a balance, tipping,
 * and changing how the balance will be collected.
 */
export async function POST(request: Request) {
  const body = await readJson<{
    action?: 'request_link' | 'pay_balance' | 'tip' | 'schedule';
    bookingId?: string;
    token?: string;
    amount?: number;
    paymentMethodId?: string;
    cardExpired?: boolean;
    mode?: 'direct_to_operator' | 'online_anytime' | 'scheduled';
  }>(request);

  try {
    // Paying by token needs no session — the link carries the authority.
    if (body.action === 'pay_balance') {
      const result = await withMutation((db) =>
        payBalance(db, String(body.token ?? ''), {
          paymentMethodId: body.paymentMethodId,
          cardExpired: body.cardExpired,
        }),
      );
      return ok({
        bookingId: result.booking.id,
        charged: result.charged,
        processingFee: result.processingFee,
        currency: result.booking.currency,
      });
    }

    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const result = await withMutation((db) => {
      switch (body.action) {
        case 'request_link':
          return { token: createBalanceLink(db, String(body.bookingId ?? ''), auth.user.id) };

        case 'tip': {
          const booking = payTip(
            db,
            String(body.bookingId ?? ''),
            auth.user.id,
            Number(body.amount) || 0,
          );
          return { tip: booking.tip };
        }

        case 'schedule': {
          const booking = scheduleBalance(
            db,
            String(body.bookingId ?? ''),
            auth.user.id,
            body.mode ?? 'online_anytime',
          );
          return { balance: booking.balance };
        }

        default:
          throw Object.assign(new Error('Unknown action'), { code: 'invalid' });
      }
    });

    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
