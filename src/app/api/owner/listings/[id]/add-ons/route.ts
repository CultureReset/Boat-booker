import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { addOnsFor, removeAddOn, saveAddOn } from '@/lib/services/itineraries';
import type { AddOn } from '@/lib/domain/types';

/** GET — every add-on on this listing, retired ones included. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const addOns = await withDb((db) => {
    const charter = db.charters.find((c) => c.id === id && c.ownerId === auth.user.id);
    return charter ? addOnsFor(db, id, false) : [];
  });

  return ok(addOns);
}

/** POST — create or update. DELETE lives here too, keyed by `addOnId`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<Partial<AddOn> & { remove?: boolean }>(request);

  try {
    const result = await withMutation((db) => {
      if (body.remove && body.id) {
        return { outcome: removeAddOn(db, body.id, auth.user.id) };
      }
      return saveAddOn(db, {
        ownerId: auth.user.id,
        charterId: id,
        id: body.id,
        title: String(body.title ?? ''),
        description: String(body.description ?? ''),
        price: Number(body.price) || 0,
        pricing: body.pricing === 'per_booking' ? 'per_booking' : 'per_person',
        maxQuantity: Number(body.maxQuantity) || 1,
        active: body.active !== false,
      });
    });
    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
