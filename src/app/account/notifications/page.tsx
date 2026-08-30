import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { SectionHeading } from '@/components/ui/primitives';
import { NotificationList } from '@/components/account/NotificationList';

export const metadata: Metadata = { title: t('navigation', 'notifications') };

export default async function NotificationsPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const notifications = db.notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);

  return (
    <>
      <SectionHeading title={t('navigation', 'notifications')} level={1} />
      <NotificationList notifications={notifications} />
    </>
  );
}
