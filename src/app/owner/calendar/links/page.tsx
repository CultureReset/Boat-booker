import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';
import { CalendarSyncPanel } from '@/components/owner/CalendarSyncPanel';

export const metadata: Metadata = { title: t('calendarSync', 'title') };

export default async function CalendarLinksPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  return (
    <>
      <Link
        href="/owner/calendar"
        className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {t('navigation', 'multicalendar')}
      </Link>
      <SectionHeading
        title={t('calendarSync', 'title')}
        subtitle={t('calendarSync', 'subtitle')}
        level={1}
      />
      <CalendarSyncPanel
        calendars={db.externalCalendars.filter((c) => c.ownerId === user.id)}
        links={db.calendarLinks.filter((l) => l.ownerId === user.id)}
        listings={db.charters
          .filter((c) => c.ownerId === user.id)
          .map((c) => ({ id: c.id, title: c.title }))}
      />
    </>
  );
}
