import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { SectionHeading } from '@/components/ui/primitives';
import { ChangeBookingFlow } from '@/components/booking/ChangeBookingFlow';

export const metadata: Metadata = { title: t('changeBooking', 'pageTitle') };

/**
 * Propose a change to a confirmed booking.
 *
 * The trips list comes from the server so the picker can only offer trips that
 * actually exist on this listing.
 */
export default async function ChangeBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await currentUser())!;
  const db = await getDb();

  const booking = db.bookings.find(
    (b) => b.id === id && b.ownerId === user.id,
  );
  if (!booking) notFound();
  if (booking.status !== 'confirmed' && booking.status !== 'accepted') notFound();

  const packages = db.packages
    .filter((p) => p.charterId === booking.charterId && p.active)
    .map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      capacity: p.capacity,
      departureTimes: p.departureTimes,
    }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5">
      <SectionHeading title={t('changeBooking', 'pageTitle')} subtitle={booking.reference} level={1} />
      <ChangeBookingFlow
        booking={{
          id: booking.id,
          reference: booking.reference,
          date: booking.date,
          departureTime: booking.departureTime,
          adults: booking.adults,
          children: booking.children,
          days: booking.days,
          packageId: booking.packageId,
          currency: booking.currency,
          role: 'owner',
          packages,
        }}
      />
    </div>
  );
}
