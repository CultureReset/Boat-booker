import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { today } from '@/lib/core/dates';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { multiCalendar } from '@/lib/services/owner';
import { SectionHeading } from '@/components/ui/primitives';
import { MultiCalendar } from '@/components/owner/MultiCalendar';

export const metadata: Metadata = { title: t('owner', 'multicalendarTitle') };

export default async function OwnerCalendarPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const rows = multiCalendar(db, user.id, today(), 35);

  return (
    <>
      <SectionHeading
        title={t('owner', 'multicalendarTitle')}
        subtitle={t('owner', 'calendarLegend')}
        level={1}
      />
      <MultiCalendar rows={rows} />
    </>
  );
}
