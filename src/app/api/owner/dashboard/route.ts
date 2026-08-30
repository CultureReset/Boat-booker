import { ok, requireOwner, settle, withDb } from '@/lib/api/http';
import { ownerDashboard } from '@/lib/services/owner';

/** GET /api/owner/dashboard — KPIs, today's trips and the attention list. */
export async function GET() {
  await settle();

  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const dashboard = await withDb((db) => ownerDashboard(db, auth.user));
  return ok(dashboard);
}
