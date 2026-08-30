import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import { addCard, removeCard, setDefaultCard } from '@/lib/services/accounts';

/**
 * Saved payment methods.
 *
 * The full card number never leaves this request: `addCard` validates it, keeps
 * the last four digits and the brand, and discards the rest.
 */

/** GET /api/cards */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const cards = await withDb((db) =>
    db.cards
      .filter((c) => c.userId === auth.user.id)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
  );
  return ok(cards);
}

/** POST /api/cards */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    number?: string;
    expMonth?: number | string;
    expYear?: number | string;
    makeDefault?: boolean;
  }>(request);

  try {
    const card = await withMutation((db) =>
      addCard(db, auth.user.id, {
        number: String(body.number ?? ''),
        expMonth: Number(body.expMonth),
        expYear: Number(body.expYear),
        makeDefault: Boolean(body.makeDefault),
      }),
    );
    return ok(card, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** PATCH /api/cards — promote a card to default. */
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ cardId?: string }>(request);

  try {
    await withMutation((db) => setDefaultCard(db, auth.user.id, String(body.cardId ?? '')));
    return ok({ updated: true });
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/cards?id=… */
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const cardId = new URL(request.url).searchParams.get('id') ?? '';

  try {
    await withMutation((db) => removeCard(db, auth.user.id, cardId));
    return ok({ removed: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
