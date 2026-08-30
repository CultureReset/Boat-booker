import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { listOwnerCharters } from '@/lib/services/owner';
import { Icon } from '@/components/ui/Icon';
import { Badge, EmptyState, PhotoFrame, RatingSummary, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { CreateListingButton } from '@/components/owner/CreateListingButton';

export const metadata: Metadata = { title: t('owner', 'listingsTitle') };

/**
 * Owner listing index.
 *
 * Each row leads with the completeness meter, because an incomplete listing is
 * the single biggest thing holding back an operator's bookings.
 */
export default async function OwnerListingsPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const listings = listOwnerCharters(db, user.id);
  const destinations = db.destinations
    .map((d) => ({ slug: d.slug, title: d.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      <SectionHeading
        title={t('owner', 'listingsTitle')}
        level={1}
        action={<CreateListingButton destinations={destinations} />}
      />

      {listings.length === 0 ? (
        <EmptyState
          icon="boat"
          title={t('owner', 'listingsEmpty')}
          body={t('owner', 'listingCompletenessBody')}
          action={<CreateListingButton destinations={destinations} />}
        />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <article className="rounded-card border border-line bg-white p-3 shadow-card">
                <div className="flex gap-3">
                  <PhotoFrame photo={listing.photo} rounded="rounded-lg" className="h-20 w-24 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="min-w-0 text-sm font-bold text-ink">
                        <Link href={`/owner/listings/${listing.id}`} className="hover:underline">
                          <span className="line-clamp-1">{listing.title}</span>
                        </Link>
                      </h2>
                      <Badge tone={listing.published ? 'success' : 'neutral'}>
                        {listing.published ? t('owner', 'published') : t('owner', 'draft')}
                      </Badge>
                    </div>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Icon name="map-pin" size={11} />
                        {listing.destinationTitle}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="boat" size={11} />
                        {listing.boatType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="users" size={11} />
                        {listing.capacity}
                      </span>
                    </p>

                    {listing.reviewStatistics.reviewCount > 0 ? (
                      <div className="mt-1">
                        <RatingSummary
                          rating={listing.reviewStatistics.rating}
                          count={listing.reviewStatistics.reviewCount}
                          size="sm"
                        />
                      </div>
                    ) : null}

                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <Metric label={t('navigation', 'bookings')} value={listing.upcomingBookings} />
                      <Metric label={t('owner', 'statsPendingRequests')} value={listing.pendingBookings} />
                      <Metric label={t('owner', 'stepTrips')} value={listing.packageCount} />
                      <Metric label={t('owner', 'statsViewsThisWeek')} value={listing.viewsLast7Days} />
                    </dl>
                  </div>
                </div>

                {/* Completeness meter */}
                <div className="mt-3 border-t border-line pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-ink">
                      {t('owner', 'listingCompleteness')}
                    </span>
                    <span
                      className={cx(
                        'text-xs font-bold tabular-nums',
                        listing.completeness >= 80 ? 'text-success' : 'text-warning',
                      )}
                    >
                      {listing.completeness}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cx(
                        'h-full rounded-full transition-all',
                        listing.completeness >= 80 ? 'bg-success' : 'bg-warning',
                      )}
                      style={{ width: `${listing.completeness}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/owner/listings/${listing.id}`}
                    className="flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
                  >
                    <Icon name="edit" size={15} />
                    {t('owner', 'editListing')}
                  </Link>
                  <Link
                    href={`/charters/view/${listing.id}`}
                    className="flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken"
                  >
                    <Icon name="external" size={15} />
                    {t('search', 'listView')}
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
