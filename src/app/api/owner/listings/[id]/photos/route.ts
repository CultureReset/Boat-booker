import { fromServiceError, ok, readJson, requireOwner, withMutation } from '@/lib/api/http';
import { addPhoto, removePhoto, reorderPhotos } from '@/lib/services/owner';

/** POST /api/owner/listings/:id/photos — add a photo. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{ altText?: string }>(request);

  try {
    const photo = await withMutation((db) => addPhoto(db, id, auth.user.id, String(body.altText ?? '')));
    return ok(photo, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** PATCH /api/owner/listings/:id/photos — reorder; index 0 becomes the cover. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{ order?: string[] }>(request);

  try {
    const photos = await withMutation((db) =>
      reorderPhotos(db, id, auth.user.id, Array.isArray(body.order) ? body.order.map(String) : []),
    );
    return ok(photos);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/owner/listings/:id/photos?photoId=… */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const photoId = new URL(request.url).searchParams.get('photoId') ?? '';

  try {
    await withMutation((db) => removePhoto(db, id, auth.user.id, photoId));
    return ok({ deleted: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
