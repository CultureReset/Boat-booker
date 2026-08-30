import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { ownerCharterDetail } from '@/lib/services/owner';
import { Icon } from '@/components/ui/Icon';
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

  return (
    <>
      <ListingEditor listing={listing} destinations={destinations} />

      {/* Itineraries and extras are separate screens rather than editor steps:
          they are per-trip, and threading them through a listing-wide wizard
          would make the wizard about the wrong unit.

          They sit after the editor, not before it: the editor opens with the
          back link and the listing's name, and pushing those below two
          unrelated cards leaves the screen with no header at the top. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          href={`/owner/listings/${id}/itineraries`}
          className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition-colors hover:bg-surface-sunken"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="list" size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{t('itinerary', 'title')}</span>
            <span className="block text-xs text-ink-muted">{t('itinerary', 'subtitle')}</span>
          </span>
        </Link>

        <Link
          href={`/owner/listings/${id}/add-ons`}
          className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition-colors hover:bg-surface-sunken"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Icon name="plus" size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{t('addOns', 'title')}</span>
            <span className="block text-xs text-ink-muted">{t('addOns', 'subtitle')}</span>
          </span>
        </Link>
      </div>
    </>
  );
}
