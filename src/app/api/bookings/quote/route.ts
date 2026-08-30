import { fromServiceError, ok, readJson, withDb } from '@/lib/api/http';
import { currentUser } from '@/lib/auth/session';
import { quote } from '@/lib/services/bookings';
import type { PaymentMode } from '@/lib/domain/types';

/**
 * POST /api/bookings/quote
 *
 * Price and availability for a prospective booking. Open to signed-out
 * visitors so the listing page can quote before login; loyalty and credit are
 * only applied when there is a session to apply them to.
 */
export async function POST(request: Request) {
  const body = await readJson<Record<string, unknown>>(request);
  const viewer = await currentUser();

  const paymentMode = (['online_full', 'online_deposit', 'on_arrival'] as const).includes(
    body.paymentMode as PaymentMode,
  )
    ? (body.paymentMode as PaymentMode)
    : 'online_deposit';

  try {
    const result = await withDb((db) =>
      quote(db, {
        charterId: String(body.charterId ?? ''),
        packageId: String(body.packageId ?? ''),
        date: String(body.date ?? ''),
        adults: Math.max(1, Number(body.adults) || 1),
        children: Math.max(0, Number(body.children) || 0),
        days: Math.max(1, Number(body.days) || 1),
        paymentMode,
        currency: String(body.currency ?? viewer?.currency ?? 'USD'),
        customerId: viewer?.id,
        applyCredit: Boolean(body.applyCredit),
        promoDiscount: Number(body.promoDiscount) || 0,
      }),
    );

    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
