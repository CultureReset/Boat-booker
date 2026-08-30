import { ok, readJson, requireAuth, withDb, withMutation } from '@/lib/api/http';

/** GET /api/notifications — newest first, capped so the bell stays cheap. */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const notifications = await withDb((db) =>
    db.notifications
      .filter((n) => n.userId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50),
  );

  return ok(notifications, {
    unreadCount: notifications.filter((n) => !n.readAt).length,
  });
}

/** POST /api/notifications — mark one, or all, as read. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ id?: string; all?: boolean }>(request);

  const marked = await withMutation((db) => {
    const now = new Date().toISOString();
    let count = 0;

    for (const notification of db.notifications) {
      if (notification.userId !== auth.user.id || notification.readAt) continue;
      if (body.all || notification.id === body.id) {
        notification.readAt = now;
        count += 1;
      }
    }
    return count;
  });

  return ok({ marked });
}
