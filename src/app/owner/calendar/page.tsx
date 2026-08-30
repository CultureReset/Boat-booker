import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { today } from '@/lib/core/dates';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { multiCalendar } from '@/lib/services/owner';
import { SectionHeading } from '@/components/ui/primitives';
import { MonthCalendar } from '@/components/owner/MonthCalendar';
import { MultiCalendar } from '@/components/owner/MultiCalendar';

export const metadata: Metadata = { title: t('owner', 'multicalendarTitle') };

export default async function OwnerCalendarPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const rows = multiCalendar(db, user.id, today(), 35);

  return (
    <>
      {/*
        Two calendars, chosen by viewport rather than by preference.
        The scrolling month view is the only usable form on a phone; the
        listing × day matrix is the better tool once there is a mouse and the
        width to show several boats at once. Rendering both and hiding one
        costs a little markup and avoids a layout that is wrong on half the
        devices that open it.

        Each carries its own heading: "Multicalendar" names the desktop matrix,
        and would be a lie on the phone, where one listing is shown at a time.
      */}
      <div className="md:hidden">
        <MonthCalendar rows={rows} />
      </div>
      <div className="hidden md:block">
        <SectionHeading
          title={t('owner', 'multicalendarTitle')}
          subtitle={t('owner', 'calendarLegend')}
          level={1}
        />
        <MultiCalendar rows={rows} />
      </div>
    </>
  );
}
