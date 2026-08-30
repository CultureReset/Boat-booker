import { newId } from '@/lib/core/ids';
import type {
  Database,
  Notification,
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
  User,
} from '@/lib/domain/types';

/**
 * Notification delivery.
 *
 * Lives on its own rather than inside the booking service for two reasons:
 * every service needs to send, and having bookings own it created an import
 * cycle the moment offers started notifying too.
 *
 * The in-app feed always receives the notification. Preferences only decide
 * which *outbound* channels — push, email, SMS — carry it, so switching
 * everything off quietens someone's phone without hiding anything from them
 * when they open the app.
 */

export interface NotifyInput {
  /** Key from the catalogue below. Decides the channel policy. */
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string;
}

/**
 * Which preference gates which category.
 *
 * `system` and `ticket` are absent on purpose: an account being suspended or a
 * support agent replying is not something a user can opt out of and still have
 * the product work.
 */
const CATEGORY_PREFERENCE: Partial<
  Record<NotificationCategory, Partial<Record<NotificationChannel, keyof NotificationPreferences>>>
> = {
  booking: {
    push: 'pushBookingUpdates',
    email: 'emailBookingUpdates',
    sms: 'smsBookingUpdates',
  },
  message: { push: 'pushMessages', email: 'emailMessages' },
  review: { email: 'emailReviewReminders' },
  marketing: { email: 'emailPromotions' },
  payout: { email: 'emailBookingUpdates', push: 'pushBookingUpdates' },
};

/** Channels a category can use at all, before preferences narrow them. */
const CATEGORY_CHANNELS: Record<NotificationCategory, NotificationChannel[]> = {
  booking: ['push', 'email', 'sms'],
  message: ['push', 'email'],
  review: ['push', 'email'],
  payout: ['push', 'email'],
  onboarding: ['push', 'email'],
  product_update: ['push'],
  ticket: ['push', 'email'],
  marketing: ['email'],
  system: ['push', 'email'],
};

function channelsFor(user: User | undefined, category: NotificationCategory): NotificationChannel[] {
  const allowed = CATEGORY_CHANNELS[category] ?? ['push'];
  if (!user) return allowed;

  const gates = CATEGORY_PREFERENCE[category];
  if (!gates) return allowed;

  return allowed.filter((channel) => {
    const key = gates[channel];
    // No gate for this channel means it is not opt-out-able.
    if (!key) return true;
    return user.notificationPreferences[key] !== false;
  });
}

/** Records a notification and works out which channels it goes out on. */
export function notify(db: Database, userId: string, input: NotifyInput): Notification {
  const user = db.users.find((u) => u.id === userId);

  const notification: Notification = {
    id: newId(),
    userId,
    type: input.type,
    category: input.category,
    channels: channelsFor(user, input.category),
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: new Date().toISOString(),
  };

  db.notifications.push(notification);
  return notification;
}

export function markRead(db: Database, userId: string, id?: string): number {
  const now = new Date().toISOString();
  let marked = 0;
  for (const notification of db.notifications) {
    if (notification.userId !== userId || notification.readAt) continue;
    if (id && notification.id !== id) continue;
    notification.readAt = now;
    marked += 1;
  }
  return marked;
}

/**
 * Archive rather than delete.
 *
 * The operator app has a separate "Archived notifications" view, so archiving
 * has to be reversible — `restore` puts it back in the main list.
 */
export function archive(db: Database, userId: string, id: string): boolean {
  const notification = db.notifications.find((n) => n.id === id && n.userId === userId);
  if (!notification || notification.archivedAt) return false;
  notification.archivedAt = new Date().toISOString();
  return true;
}

export function restore(db: Database, userId: string, id: string): boolean {
  const notification = db.notifications.find((n) => n.id === id && n.userId === userId);
  if (!notification?.archivedAt) return false;
  notification.archivedAt = undefined;
  return true;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byCategory: Partial<Record<NotificationCategory, number>>;
  archived: number;
}

export function countsFor(db: Database, userId: string): NotificationCounts {
  const mine = db.notifications.filter((n) => n.userId === userId);
  const live = mine.filter((n) => !n.archivedAt);

  const byCategory: Partial<Record<NotificationCategory, number>> = {};
  for (const notification of live) {
    byCategory[notification.category] = (byCategory[notification.category] ?? 0) + 1;
  }

  return {
    total: live.length,
    unread: live.filter((n) => !n.readAt).length,
    byCategory,
    archived: mine.length - live.length,
  };
}

export function listFor(
  db: Database,
  userId: string,
  options: { category?: NotificationCategory; archived?: boolean } = {},
): Notification[] {
  return db.notifications
    .filter((n) => n.userId === userId)
    .filter((n) => (options.archived ? Boolean(n.archivedAt) : !n.archivedAt))
    .filter((n) => !options.category || n.category === options.category)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
