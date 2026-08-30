import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';
import { BuddyInvites } from '@/components/account/BuddyInvites';

export const metadata: Metadata = {
  title: t('buddies', 'title'),
  robots: { index: false, follow: false },
};

export default async function BuddyInvitationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = (await currentUser())!;
  const db = await getDb();

  const booking = db.bookings.find((b) => b.id === bookingId && b.customerId === user.id);
  if (!booking) notFound();

  const charter = db.charters.find((c) => c.id === booking.charterId);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <Link
        href={`/account/bookings/${booking.id}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {booking.reference}
      </Link>
      <SectionHeading
        title={t('buddies', 'title')}
        subtitle={`${charter?.title ?? ''} · ${formatDate(booking.date, 'medium')}`}
        level={1}
      />
      <BuddyInvites bookingId={booking.id} invitations={booking.buddyInvitations} />
    </div>
  );
}
