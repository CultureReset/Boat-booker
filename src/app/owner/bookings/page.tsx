import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb, mutate } from '@/lib/storage';
import { expandBooking, settleElapsedBookings } from '@/lib/services/bookings';
import { SectionHeading } from '@/components/ui/primitives';
import { BookingList } from '@/components/account/BookingList';

export const metadata: Metadata = { title: t('owner', 'bookingsTitle') };

/** Owner booking queue — same component as the customer list, owner actions. */
export default async function OwnerBookingsPage() {
  const user = (await currentUser())!;

  await mutate((db) => settleElapsedBookings(db));

  const db = await getDb();
  const bookings = db.bookings
    .filter((b) => b.ownerId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((b) => expandBooking(db, b));

  return (
    <>
      <SectionHeading title={t('owner', 'bookingsTitle')} level={1} />
      <BookingList bookings={bookings} role="owner" />
    </>
  );
}
