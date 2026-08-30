import { ok, withDb } from '@/lib/api/http';
import { suggestDestinations } from '@/lib/services/search';

/**
 * GET /api/destinations?q=…
 *
 * Autocomplete for the destination picker. With no query it returns the
 * popular destinations, which is what the picker shows when first opened.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const term = url.searchParams.get('q') ?? '';
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 8));

  const results = await withDb((db) => suggestDestinations(db, term, limit));
  return ok(results);
}
