import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import { createCharter, listOwnerCharters } from '@/lib/services/owner';

/** GET /api/owner/listings */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const listings = await withDb((db) => listOwnerCharters(db, auth.user.id));
  return ok(listings, { totalCount: listings.length });
}

/** POST /api/owner/listings — create a draft listing. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ title?: string; destinationSlug?: string }>(request);

  try {
    const charter = await withMutation((db) =>
      createCharter(db, auth.user, {
        title: String(body.title ?? ''),
        destinationSlug: String(body.destinationSlug ?? ''),
      }),
    );
    return ok({ id: charter.id, title: charter.title }, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}
