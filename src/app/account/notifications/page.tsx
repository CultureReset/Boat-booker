import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { countsFor, listFor } from '@/lib/services/notifications';
import { SectionHeading } from '@/components/ui/primitives';
import { NotificationCentre } from '@/components/account/NotificationCentre';
import type { NotificationCategory } from '@/lib/domain/types';

export const metadata: Metadata = { title: t('notifications', 'title') };

/**
 * The notification centre.
 *
 * Category and archive state live in the query string so a tab is linkable and
 * survives a refresh — an operator sent here by a push notification lands on
 * the right tab rather than the default one.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; archived?: string }>;
}) {
  const { category, archived } = await searchParams;
  const user = (await currentUser())!;
  const db = await getDb();

  const counts = countsFor(db, user.id);
  const isArchived = archived === 'true';

  const notifications = listFor(db, user.id, {
    category: (category as NotificationCategory) || undefined,
    archived: isArchived,
  }).slice(0, 100);

  return (
    <>
      <SectionHeading
        title={t('notifications', isArchived ? 'archivedTitle' : 'title')}
        level={1}
      />
      <NotificationCentre
        notifications={notifications}
        counts={counts}
        archived={isArchived}
        activeCategory={(category as NotificationCategory) || undefined}
      />
    </>
  );
}
