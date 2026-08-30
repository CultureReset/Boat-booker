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
 * Two densities, chosen by viewport. On a phone this is deliberately minimal —
 * a status strip, the boat, and one row that says "Edit listing" — because the
 * operator app's listings tab is a way *in*, not a dashboard; the metrics live
 * under Performance where there is room to read them. From `sm` up, where the
 * numbers fit without crowding, the fuller card returns.
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
              <article className="overflow-hidden rounded-card border border-line bg-white shadow-card">
                {/* Status as a header strip, matching the bookings cards. */}
                <p
                  className={cx(
                    'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide',
                    listing.published
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-surface-sunken text-ink-soft',
                  )}
                >
                  {listing.published ? t('owner', 'published') : t('owner', 'draft')}
                </p>

                <div className="flex gap-3 p-3">
                  <PhotoFrame photo={listing.photo} rounded="rounded-lg" className="h-20 w-24 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-ink">
                      <Link href={`/owner/listings/${listing.id}`} className="min-w-0 hover:underline">
                        <span className="line-clamp-1">{listing.title}</span>
                      </Link>
                      {listing.verificationBadge ? (
                        <Icon name="shield" size={14} className="shrink-0 text-success" />
                      ) : null}
                    </h2>

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
                      <div className="mt-1 hidden sm:block">
                        <RatingSummary
                          rating={listing.reviewStatistics.rating}
                          count={listing.reviewStatistics.reviewCount}
                          size="sm"
                        />
                      </div>
                    ) : null}

                    <dl className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-xs sm:flex">
                      <Metric label={t('navigation', 'bookings')} value={listing.upcomingBookings} />
                      <Metric label={t('owner', 'statsPendingRequests')} value={listing.pendingBookings} />
                      <Metric label={t('owner', 'stepTrips')} value={listing.packageCount} />
                      <Metric label={t('owner', 'statsViewsThisWeek')} value={listing.viewsLast7Days} />
                    </dl>
                  </div>
                </div>

                {/* Completeness meter — desktop only; on a phone the
                    opportunities screen carries this job properly. */}
                <div className="hidden border-t border-line p-3 sm:block">
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

                {/* The whole row is the affordance on a phone, as it is in
                    the real app: a title, a subtitle and a chevron. */}
                <Link
                  href={`/owner/listings/${listing.id}`}
                  className="flex items-center gap-3 border-t border-line p-3 transition-colors hover:bg-surface-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {t('owner', 'editListing')}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {t('owner', 'editListingHint')}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={16} className="shrink-0 text-ink-faint" />
                </Link>

                <Link
                  href={`/charters/view/${listing.id}`}
                  className="hidden items-center gap-1.5 border-t border-line px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-sunken sm:flex"
                >
                  <Icon name="external" size={15} />
                  {t('search', 'listView')}
                </Link>
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
