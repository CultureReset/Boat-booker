import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { addCard, addWallet, removePaymentMethod, setDefaultPaymentMethod } from '@/lib/services/accounts';

/**
 * Saved payment methods — cards and wallets.
 *
 * The full card number never leaves this request: `addCard` validates it, keeps
 * the last four digits and the brand, and discards the rest. A wallet has no
 * number to discard; only the account label is stored.
 */

/** GET /api/cards */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const methods = await withDb((db) =>
    db.paymentMethods
      .filter((c) => c.userId === auth.user.id)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
  );
  return ok(methods);
}

/** POST /api/cards — `{ kind }` picks between a card and a wallet. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    kind?: 'card' | 'paypal' | 'apple_pay';
    number?: string;
    expMonth?: number | string;
    expYear?: number | string;
    accountLabel?: string;
    makeDefault?: boolean;
  }>(request);

  try {
    const method = await withMutation((db) =>
      body.kind === 'paypal' || body.kind === 'apple_pay'
        ? addWallet(db, auth.user.id, {
            kind: body.kind,
            accountLabel: String(body.accountLabel ?? ''),
            makeDefault: Boolean(body.makeDefault),
          })
        : addCard(db, auth.user.id, {
            number: String(body.number ?? ''),
            expMonth: Number(body.expMonth),
            expYear: Number(body.expYear),
            makeDefault: Boolean(body.makeDefault),
          }),
    );
    return ok(method, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** PATCH /api/cards — promote a payment method to default. */
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ cardId?: string; methodId?: string }>(request);

  try {
    await withMutation((db) =>
      setDefaultPaymentMethod(db, auth.user.id, String(body.methodId ?? body.cardId ?? '')),
    );
    return ok({ updated: true });
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/cards?id=… */
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const methodId = new URL(request.url).searchParams.get('id') ?? '';

  try {
    await withMutation((db) => removePaymentMethod(db, auth.user.id, methodId));
    return ok({ removed: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
