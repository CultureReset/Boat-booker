import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import {
  deleteItinerary,
  publishBlockers,
  publishItinerary,
  saveItinerary,
  unpublishItinerary,
} from '@/lib/services/itineraries';
import type { ItineraryStep } from '@/lib/domain/types';

/** GET — every itinerary on this listing, with its publish blockers. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const itineraries = await withDb((db) => {
    const charter = db.charters.find((c) => c.id === id && c.ownerId === auth.user.id);
    if (!charter) return [];

    return db.itineraries
      .filter((i) => i.charterId === id)
      .map((itinerary) => ({ ...itinerary, blockers: publishBlockers(itinerary) }));
  });

  return ok(itineraries);
}

/**
 * POST — save a draft, publish, unpublish or delete.
 *
 * Saving always writes a draft; publishing is a separate action, so editing at
 * the dock cannot push a half-finished plan live by accident.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{
    action?: 'save' | 'publish' | 'unpublish' | 'delete';
    itineraryId?: string;
    packageId?: string;
    days?: { steps: Omit<ItineraryStep, 'id'>[] }[];
  }>(request);

  try {
    const result = await withMutation((db) => {
      switch (body.action) {
        case 'publish':
          return publishItinerary(db, String(body.itineraryId ?? ''), auth.user.id);
        case 'unpublish':
          return unpublishItinerary(db, String(body.itineraryId ?? ''), auth.user.id);
        case 'delete':
          deleteItinerary(db, String(body.itineraryId ?? ''), auth.user.id);
          return { deleted: true };
        default:
          return saveItinerary(db, {
            ownerId: auth.user.id,
            charterId: id,
            packageId: String(body.packageId ?? ''),
            days: body.days ?? [],
          });
      }
    });
    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
