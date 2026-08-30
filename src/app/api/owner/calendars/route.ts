import { fromServiceError, ok, readJson, requireOwner, withDb, withMutation } from '@/lib/api/http';
import {
  addExternalCalendar,
  linkCalendars,
  removeExternalCalendar,
  unlinkCalendars,
} from '@/lib/services/performance';

/** GET — external feeds and hull links for this operator. */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const data = await withDb((db) => ({
    calendars: db.externalCalendars.filter((c) => c.ownerId === auth.user.id),
    links: db.calendarLinks.filter((l) => l.ownerId === auth.user.id),
    listings: db.charters
      .filter((c) => c.ownerId === auth.user.id)
      .map((c) => ({ id: c.id, title: c.title })),
  }));

  return ok(data);
}

/** POST — connect a feed, drop one, link listings, or unlink them. */
export async function POST(request: Request) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    action?: 'add' | 'remove' | 'link' | 'unlink';
    charterId?: string;
    charterIds?: string[];
    name?: string;
    url?: string;
    id?: string;
  }>(request);

  try {
    const result = await withMutation((db) => {
      switch (body.action) {
        case 'remove':
          removeExternalCalendar(db, String(body.id ?? ''), auth.user.id);
          return { removed: true };
        case 'link':
          linkCalendars(db, auth.user.id, body.charterIds ?? []);
          return { linked: true };
        case 'unlink':
          unlinkCalendars(db, auth.user.id, String(body.id ?? ''));
          return { unlinked: true };
        default:
          return addExternalCalendar(db, auth.user.id, {
            charterId: String(body.charterId ?? ''),
            name: String(body.name ?? ''),
            url: String(body.url ?? ''),
          });
      }
    });
    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
