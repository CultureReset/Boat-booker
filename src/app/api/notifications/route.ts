import { fromServiceError, ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';
import {
  archive,
  countsFor,
  listFor,
  markRead,
  restore,
} from '@/lib/services/notifications';
import { preferenceGroups } from '@/lib/services/notificationCatalogue';
import type { NotificationCategory } from '@/lib/domain/types';

/** GET /api/notifications?category=&archived= — the feed, plus its counts. */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const category = url.searchParams.get('category') as NotificationCategory | null;
  const archived = url.searchParams.get('archived') === 'true';

  const data = await withDb((db) => ({
    notifications: listFor(db, auth.user.id, { category: category ?? undefined, archived }),
    counts: countsFor(db, auth.user.id),
    groups: preferenceGroups(auth.user.role === 'owner' ? 'owner' : 'customer'),
    preferences: auth.user.notificationPreferences,
  }));

  return ok(data.notifications, {
    counts: data.counts,
    groups: data.groups,
    preferences: data.preferences,
  });
}

/**
 * POST /api/notifications
 *
 * `{ id }` or `{ all: true }` marks read; `{ id, archive }` and
 * `{ id, restore }` move a notification in and out of the archive.
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    id?: string;
    all?: boolean;
    archive?: boolean;
    restore?: boolean;
  }>(request);

  try {
    const result = await withMutation((db) => {
      if (body.id && body.archive) return { archived: archive(db, auth.user.id, body.id) };
      if (body.id && body.restore) return { restored: restore(db, auth.user.id, body.id) };
      return { marked: markRead(db, auth.user.id, body.all ? undefined : body.id) };
    });
    return ok(result);
  } catch (error) {
    return fromServiceError(error);
  }
}
