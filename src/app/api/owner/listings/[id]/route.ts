import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { deleteCharter, ownerCharterDetail, updateCharter, type CharterUpdate } from '@/lib/services/owner';

/** GET /api/owner/listings/:id — the full editable record. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const detail = await withDb((db) => ownerCharterDetail(db, id, auth.user.id));
    return ok(detail);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** PATCH /api/owner/listings/:id — partial update from any editor step. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<CharterUpdate>(request);

  try {
    const detail = await withMutation((db) => {
      updateCharter(db, id, auth.user.id, body);
      return ownerCharterDetail(db, id, auth.user.id);
    });
    return ok(detail);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/owner/listings/:id */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await withMutation((db) => deleteCharter(db, id, auth.user.id));
    return ok({ deleted: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
