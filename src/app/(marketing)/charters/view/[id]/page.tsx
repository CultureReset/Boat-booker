import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { currentUser } from '@/lib/auth/session';
import { buildBlockIndex } from '@/lib/services/availability';
import { buildCharterDetail, reviewStatisticsFor } from '@/lib/services/charters';
import { reviewsForCharter } from '@/lib/services/reviews';
import { minimumPriceFor } from '@/lib/services/pricing';
import { formatMoney } from '@/lib/core/money';
import { Icon } from '@/components/ui/Icon';
import { Badge, Divider, RatingSummary } from '@/components/ui/primitives';
import { Gallery } from '@/components/listing/Gallery';
import { BookingPanel } from '@/components/listing/BookingPanel';
import { SaveButton, ShareButton } from '@/components/listing/ListingActions';
import {
  AmenitiesSection,
  BoatSection,
  DescriptionSection,
  LocationSection,
  OwnerSection,
  PoliciesSection,
  ReviewsSection,
  SimilarSection,
} from '@/components/listing/ListingSections';

/**
 * Listing detail page.
 *
 * Server-rendered in full — gallery, specs, amenities, reviews and the initial
 * price all come down in the first response — so the page is indexable and
 * usable before any JavaScript runs. Only the booking panel, gallery viewer and
 * save button hydrate.
 */

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();

  const charter = db.charters.find((c) => c.id === id);
  if (!charter) return { title: t('errors', 'notFoundTitle') };

  const destination = db.destinations.find((d) => d.id === charter.destinationId);
  const reviews = db.reviews.filter((r) => r.charterId === charter.id);
  const stats = reviewStatisticsFor(reviews);

  return {
    title: t('viewCharter', 'metaTitle', {
      title: charter.title,
      location: destination?.title ?? '',
      brand: brand.name,
    }),
    description: charter.shortDescription,
    alternates: { canonical: `/charters/view/${charter.id}` },
    openGraph: {
      title: charter.title,
      description: charter.shortDescription,
      type: 'website',
    },
    other: {
      // Product structured data so a listing can surface as a rich result.
      'application/ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: charter.title,
        description: charter.shortDescription,
        ...(stats.reviewCount > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: stats.rating.toFixed(1),
                reviewCount: stats.reviewCount,
              },
            }
          : {}),
      }),
    },
  };
}

export default async function ListingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const str = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : undefined);
  const num = (key: string, fallback: number) => {
    const value = Number(str(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const adults = num('adults', 2);
  const children = num('children', 0);
  const date = str('date');
  const currency = (str('currency') ?? 'USD').toUpperCase();

  const db = await getDb();
  const viewer = await currentUser();

  const charter = db.charters.find((c) => c.id === id);
  // An unpublished listing is visible only to its own owner, so a draft can be
  // previewed without being reachable by anyone else.
  if (!charter || (!charter.published && charter.ownerId !== viewer?.id)) notFound();

  const revealExactAddress = Boolean(
    viewer &&
      (viewer.id === charter.ownerId ||
        db.bookings.some(
          (b) =>
            b.charterId === charter.id &&
            b.customerId === viewer.id &&
            (b.status === 'confirmed' || b.status === 'accepted' || b.status === 'done'),
        )),
  );

  const detail = buildCharterDetail({
    db,
    charter,
    currency,
    guests: adults + children,
    days: 1,
    date,
    blockIndex: buildBlockIndex(db),
    revealExactAddress,
  });
  if (!detail) notFound();

  const reviewPage = reviewsForCharter(db, charter.id, { page: 1, perPage: 6 });
  const statistics = reviewStatisticsFor(db.reviews.filter((r) => r.charterId === charter.id));

  const saved = viewer
    ? db.wishlist.some((w) => w.userId === viewer.id && w.charterId === charter.id)
    : false;

  // Nearby listings in the same destination, for the bottom rail.
  const similar = db.charters
    .filter((c) => c.published && c.id !== charter.id && c.destinationId === charter.destinationId)
    .slice(0, 8)
    .map((other) => {
      const packages = db.packages.filter((p) => p.charterId === other.id && p.active);
      const cheapest = minimumPriceFor(other, packages, currency);
      return {
        id: other.id,
        title: other.title,
        boatType: other.boat.type,
        price: cheapest ? formatMoney(cheapest.amount, currency) : undefined,
        photo: other.photos[0]
          ? { placeholder: other.photos[0].placeholder, altText: other.photos[0].altText }
          : { placeholder: 'linear-gradient(160deg,#cbd5e1,#94a3b8)', altText: other.title },
      };
    });

  return (
    <div className="pb-24 lg:pb-8">
      {/* Breadcrumb — also the crawl path back up the destination tree. */}
      <nav aria-label="Breadcrumb" className="mx-auto max-w-shell px-4 pt-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <li>
            <Link href="/" className="hover:underline">
              {t('navigation', 'home')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/destination/${detail.destination.slug}`} className="hover:underline">
              {detail.destination.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="truncate font-medium text-ink-soft" aria-current="page">
            {charter.title}
          </li>
        </ol>
      </nav>

      <div className="mx-auto max-w-shell px-0 pt-3 md:px-4">
        <Gallery photos={detail.photos} title={charter.title} />
      </div>

      <div className="mx-auto grid max-w-shell gap-8 px-4 py-5 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {/* ------------------------------------------------- header */}
          <header>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold leading-tight text-ink md:text-2xl">
                  {charter.title}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Icon name="map-pin" size={14} />
                    {detail.approximateAddress}
                  </span>
                  {statistics.reviewCount > 0 ? (
                    <RatingSummary rating={statistics.rating} count={statistics.reviewCount} size="sm" />
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <ShareButton title={charter.title} />
                <SaveButton charterId={charter.id} initialSaved={saved} />
              </div>
            </div>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {detail.hasBoatersChoiceAward ? (
                <li><Badge tone="gold" icon="star">{t('listingCard', 'boatersChoice')}</Badge></li>
              ) : null}
              {detail.isInstantBookActive ? (
                <li><Badge tone="brand" icon="bolt">{t('listingCard', 'instantConfirmation')}</Badge></li>
              ) : null}
              {charter.policies.freeCancellationDaysInAdvance > 0 ? (
                <li><Badge tone="success" icon="check">{t('listingCard', 'freeCancellation')}</Badge></li>
              ) : null}
              {detail.verification ? (
                <li>
                  <Badge tone="neutral" icon="shield">{detail.verification.title}</Badge>
                </li>
              ) : null}
              {charter.licenseStatus !== 'Unverified' ? (
                <li>
                  <Badge tone="neutral" icon="check-circle">
                    {charter.licenseStatus === 'Verified'
                      ? t('viewCharter', 'licenseVerified')
                      : t('viewCharter', 'licenseAudited')}
                  </Badge>
                </li>
              ) : null}
            </ul>

            {/* Headline stats, the first thing a guest scans for. */}
            <dl className="mt-4 grid grid-cols-3 gap-2 rounded-card border border-line bg-surface-sunken p-3">
              <Stat icon="boat" label={t('boatTypes', 'category')} value={detail.boat.type} />
              <Stat icon="ruler" label={t('viewCharter', 'boatLength')} value={t('listingCard', 'length', { p: detail.boat.length })} />
              <Stat
                icon="users"
                label={t('viewCharter', 'boatCapacity')}
                value={t('listingCard', 'capacity', { count: detail.boat.capacity, p: detail.boat.capacity })}
              />
            </dl>

            {detail.highlights.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {detail.highlights.map((highlight) => (
                  <li key={highlight.key}>
                    <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft">
                      <Icon name={highlight.icon} size={13} />
                      {highlight.title}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {detail.activities.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {detail.activities.map((activity) => (
                  <li key={activity.slug}>
                    <Link
                      href={`/activity/${activity.slug}`}
                      className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 transition-colors hover:bg-brand-100"
                    >
                      {activity.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          <Divider className="my-6" />
          <DescriptionSection charter={detail} />

          <Divider className="my-6" />
          <BoatSection charter={detail} />

          <Divider className="my-6" />
          <AmenitiesSection charter={detail} />

          <Divider className="my-6" />
          <OwnerSection charter={detail} />

          <Divider className="my-6" />
          <LocationSection charter={detail} />

          <Divider className="my-6" />
          <PoliciesSection charter={detail} />

          <Divider className="my-6" />
          <ReviewsSection
            charterId={charter.id}
            statistics={statistics}
            initialReviews={reviewPage.reviews}
            totalCount={reviewPage.metadata.totalCount}
          />

          {similar.length ? (
            <>
              <Divider className="my-6" />
              <SimilarSection charters={similar} />
            </>
          ) : null}
        </div>

        <BookingPanel
          charter={detail}
          initialDate={date}
          initialAdults={adults}
          initialChildren={children}
        />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="text-center">
      <dt className="flex items-center justify-center gap-1 text-[11px] text-ink-muted">
        <Icon name={icon} size={12} />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}
