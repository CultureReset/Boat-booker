import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { MemoryError, tripMemoryFor } from '@/lib/services/memories';
import { MemoryPlayer } from '@/components/memories/MemoryPlayer';
import { Outcome } from '@/components/payments/TipFlow';

export const metadata: Metadata = {
  title: t('memories', 'indexTitle'),
  robots: { index: false, follow: false },
};

/**
 * One trip's animated recap.
 *
 * Full-bleed and outside the account chrome: it is a story, and a dashboard
 * sidebar beside it would undercut the whole effect.
 */
export default async function TripMemoryPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/trip-memory/${bookingId}`);

  const db = await getDb();

  try {
    return <MemoryPlayer memory={tripMemoryFor(db, bookingId, user.id)} />;
  } catch (error) {
    const notEligible = error instanceof MemoryError && error.code === 'not_eligible';
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <Outcome
          icon={notEligible ? 'clock' : 'alert'}
          title={t('memories', notEligible ? 'notEligibleTitle' : 'errorTitle')}
          body={t('memories', notEligible ? 'notEligibleBody' : 'errorBody')}
          href="/account/bookings"
        />
      </div>
    );
  }
}
