import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { deletePackage, upsertPackage, type PackageInput } from '@/lib/services/owner';

/** GET /api/owner/listings/:id/packages */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const packages = await withDb((db) => {
    const charter = db.charters.find((c) => c.id === id && c.ownerId === auth.user.id);
    if (!charter) return null;
    return db.packages.filter((p) => p.charterId === charter.id).sort((a, b) => a.hours - b.hours);
  });

  if (!packages) return fromServiceError({ code: 'not_found', message: 'Listing not found' });
  return ok(packages);
}

/** POST /api/owner/listings/:id/packages — create or update a trip. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<PackageInput & { id?: string }>(request);

  try {
    const pkg = await withMutation((db) => upsertPackage(db, id, auth.user.id, body));
    return ok(pkg, undefined, body.id ? 200 : 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/owner/listings/:id/packages?packageId=… */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const packageId = new URL(request.url).searchParams.get('packageId') ?? '';

  try {
    await withMutation((db) => deletePackage(db, id, auth.user.id, packageId));
    return ok({ deleted: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
