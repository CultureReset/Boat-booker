import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb, mutate } from '@/lib/storage';
import { expandBooking, settleElapsedBookings } from '@/lib/services/bookings';
import { SectionHeading } from '@/components/ui/primitives';
import { BookingList } from '@/components/account/BookingList';

export const metadata: Metadata = { title: t('bookings', 'title') };

/** Customer bookings. Server-rendered so the list is complete on first paint. */
export default async function BookingsPage() {
  const user = (await currentUser())!;

  // Roll any elapsed trips forward before reading, so a trip that happened
  // yesterday shows as completed rather than still upcoming.
  await mutate((db) => settleElapsedBookings(db));

  const db = await getDb();
  const bookings = db.bookings
    .filter((b) => b.customerId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((b) => expandBooking(db, b));

  return (
    <>
      <SectionHeading title={t('bookings', 'title')} level={1} />
      <BookingList bookings={bookings} role="customer" />
    </>
  );
}
