import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { SectionHeading } from '@/components/ui/primitives';
import { OfferBuilder, type OfferContext } from '@/components/owner/OfferBuilder';

export const metadata: Metadata = { title: t('offers', 'pageTitle') };

/**
 * Build an offer for one conversation.
 *
 * Reached from a thread, so the customer and listing are already decided — the
 * operator only has to choose the trip, the date and the price.
 */
export default async function CreateOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadId } = await searchParams;
  const user = await currentUser();

  if (!user) redirect('/login?next=/offer/create');
  if (user.role !== 'owner') redirect('/account');
  if (!threadId) notFound();

  const db = await getDb();
  const thread = db.threads.find((t2) => t2.id === threadId && t2.ownerId === user.id);
  if (!thread) notFound();

  const charter = db.charters.find((c) => c.id === thread.charterId);
  if (!charter) notFound();

  const customer = db.users.find((u) => u.id === thread.customerId);

  const context: OfferContext = {
    threadId: thread.id,
    customerName: customer?.firstName ?? 'the customer',
    charterId: charter.id,
    charterTitle: charter.title,
    currency: charter.currency,
    capacity: charter.boat.capacity,
    packages: db.packages
      .filter((p) => p.charterId === charter.id && p.active)
      .map((p) => ({
        id: p.id,
        title: p.title,
        hours: p.hours,
        price: p.price,
        currency: p.currency,
        capacity: p.capacity,
        departureTimes: p.departureTimes,
      })),
    // Blocked days come across up front so the date field can refuse them
    // without a round trip — on a phone that latency is the whole experience.
    blockedDates: db.availability
      .filter((block) => block.charterId === charter.id)
      .map((block) => block.date),
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-5">
      <SectionHeading
        title={t('offers', 'pageTitle')}
        subtitle={t('offers', 'subtitle', { name: context.customerName })}
        level={1}
      />
      <OfferBuilder context={context} />
    </div>
  );
}
