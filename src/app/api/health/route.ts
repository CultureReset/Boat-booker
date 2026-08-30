import { ok, withDb } from '@/lib/api/http';
import { adapterName } from '@/lib/storage';

/**
 * GET /api/health
 *
 * Liveness plus a snapshot of what the seeded dataset actually contains —
 * useful when checking a fresh deployment came up with data.
 */
export async function GET() {
  const counts = await withDb((db) => ({
    users: db.users.length,
    charters: db.charters.length,
    packages: db.packages.length,
    bookings: db.bookings.length,
    reviews: db.reviews.length,
    destinations: db.destinations.length,
    threads: db.threads.length,
  }));

  return ok({
    status: 'ok',
    storage: adapterName(),
    time: new Date().toISOString(),
    counts,
  });
}
