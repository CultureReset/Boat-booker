import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { reasonsFor } from '@/lib/services/cancellation';
import { SectionHeading } from '@/components/ui/primitives';
import { CancelBookingFlow } from '@/components/booking/CancelBookingFlow';

export const metadata: Metadata = { title: t('cancel', 'pageTitle') };

/**
 * Cancel a booking.
 *
 * The reason list is filtered by who is cancelling — the two sides are offered
 * genuinely different reasons, and showing an operator "my plans changed" would
 * be nonsense.
 */
export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await currentUser())!;
  const db = await getDb();

  const booking = db.bookings.find(
    (b) => b.id === id && b.customerId === user.id,
  );
  if (!booking) notFound();

  const reasons = reasonsFor('customer').map((reason) => ({
    key: reason.key,
    label: reason.label,
    group: reason.group,
    followUp: reason.followUp,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5">
      <SectionHeading title={t('cancel', 'pageTitle')} subtitle={booking.reference} level={1} />
      <CancelBookingFlow
        bookingId={booking.id}
        role="customer"
        currency={booking.currency}
        reasons={reasons}
        canRequestChange={booking.status === 'confirmed' || booking.status === 'accepted'}
      />
    </div>
  );
}
