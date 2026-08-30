import { fromServiceError, ok, readJson, requireOwner, settle, withDb, withMutation } from '@/lib/api/http';
import { addPayoutMethod, payoutLedger, removePayoutMethod } from '@/lib/services/owner';

/** GET /api/owner/payouts — ledger, totals and the payout methods on file. */
export async function GET() {
  await settle();

  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const payload = await withDb((db) => ({
    ...payoutLedger(db, auth.user.id),
    methods: auth.user.ownerProfile?.payoutMethods ?? [],
  }));

  return ok(payload);
}

/** POST /api/owner/payouts — add a payout method. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    kind?: string;
    label?: string;
    accountHolder?: string;
    accountNumber?: string;
    currency?: string;
  }>(request);

  try {
    const method = await withMutation((db) =>
      addPayoutMethod(db, auth.user.id, {
        kind: body.kind === 'paypal' ? 'paypal' : 'bank',
        label: String(body.label ?? ''),
        accountHolder: String(body.accountHolder ?? ''),
        accountNumber: String(body.accountNumber ?? ''),
        currency: String(body.currency ?? auth.user.currency),
      }),
    );
    return ok(method, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/owner/payouts?methodId=… */
export async function DELETE(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const methodId = new URL(request.url).searchParams.get('methodId') ?? '';

  try {
    await withMutation((db) => removePayoutMethod(db, auth.user.id, methodId));
    return ok({ removed: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
