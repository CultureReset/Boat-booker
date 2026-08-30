import { fromServiceError, ok, readJson, requireOwner, withMutation } from '@/lib/api/http';
import { submitVerification } from '@/lib/services/owner';

/** GET /api/owner/verification */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  return ok(auth.user.ownerProfile?.verification ?? { status: 'unverified', documents: [] });
}

/**
 * POST /api/owner/verification
 *
 * Records which documents were submitted and moves the profile into review.
 * There is no file storage in this build, so only the filename is kept —
 * wiring this to real object storage does not change the state machine.
 */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ documents?: { kind?: string; filename?: string }[] }>(request);

  const documents = (body.documents ?? [])
    .filter((d) => d.filename)
    .map((d) => ({
      kind: (['license', 'insurance', 'identity'].includes(String(d.kind))
        ? String(d.kind)
        : 'identity') as 'license' | 'insurance' | 'identity',
      filename: String(d.filename),
    }));

  try {
    const verification = await withMutation((db) => submitVerification(db, auth.user.id, documents));
    return ok(verification);
  } catch (error) {
    return fromServiceError(error);
  }
}
