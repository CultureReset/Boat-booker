import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { ownerCharterDetail } from '@/lib/services/owner';
import { ListingEditor, type EditableListing } from '@/components/owner/ListingEditor';

export const metadata: Metadata = { title: t('owner', 'editListing') };

export default async function OwnerListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;
  const db = await getDb();

  let listing: EditableListing;
  try {
    listing = ownerCharterDetail(db, id, user.id) as EditableListing;
  } catch {
    // Missing listing and someone else's listing look identical from here.
    notFound();
  }

  const destinations = db.destinations
    .map((d) => ({ slug: d.slug, title: d.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return <ListingEditor listing={listing} destinations={destinations} />;
}
