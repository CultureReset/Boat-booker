import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { addOnsFor } from '@/lib/services/itineraries';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';
import { AddOnEditor } from '@/components/owner/AddOnEditor';

export const metadata: Metadata = { title: t('addOns', 'title') };

export default async function AddOnsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;
  const db = await getDb();

  const charter = db.charters.find((c) => c.id === id && c.ownerId === user.id);
  if (!charter) notFound();

  return (
    <>
      <Link
        href={`/owner/listings/${charter.id}`}
        className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {charter.title}
      </Link>
      <SectionHeading title={t('addOns', 'title')} subtitle={t('addOns', 'subtitle')} level={1} />
      <AddOnEditor
        charterId={charter.id}
        currency={charter.currency}
        capacity={charter.boat.capacity}
        addOns={addOnsFor(db, charter.id, false)}
      />
    </>
  );
}
