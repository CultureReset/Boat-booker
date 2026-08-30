import { ok, settle, withDb } from '@/lib/api/http';
import { parseSearchQuery, search } from '@/lib/services/search';

/**
 * GET /api/search
 *
 * The search back-end for the results page and the map. Query parameters are
 * documented in `lib/services/search.ts#parseSearchQuery`; anything
 * unrecognised is dropped rather than erroring, so an old bookmark still
 * returns sensible results.
 */
export async function GET(request: Request) {
  await settle();

  const url = new URL(request.url);
  const query = parseSearchQuery(url.searchParams);

  const result = await withDb((db) => search(db, query));

  return ok({ charters: result.charters, facets: result.facets }, result.metadata);
}
