import { fromServiceError, ok, readJson, requireOwner, withMutation } from '@/lib/api/http';
import { inviteTeamMember, removeTeamMember } from '@/lib/services/owner';

/** GET /api/owner/team */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  return ok(auth.user.ownerProfile?.team ?? []);
}

/** POST /api/owner/team — invite a manager or captain. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ name?: string; email?: string; role?: string }>(request);

  try {
    const member = await withMutation((db) =>
      inviteTeamMember(db, auth.user.id, {
        name: String(body.name ?? ''),
        email: String(body.email ?? ''),
        role: body.role === 'manager' ? 'manager' : 'captain',
      }),
    );
    return ok(member, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/** DELETE /api/owner/team?memberId=… */
export async function DELETE(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const memberId = new URL(request.url).searchParams.get('memberId') ?? '';

  try {
    await withMutation((db) => removeTeamMember(db, auth.user.id, memberId));
    return ok({ removed: true });
  } catch (error) {
    return fromServiceError(error);
  }
}
