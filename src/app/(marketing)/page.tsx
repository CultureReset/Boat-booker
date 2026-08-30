import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { activities, boatTypes } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { indexPackages, indexReviews, buildCharterCard } from '@/lib/services/charters';
import { Icon } from '@/components/ui/Icon';
import { Badge, Card, LinkButton, PhotoFrame, SectionHeading, Stars } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { SearchWidget } from '@/components/search/SearchWidget';
import { ListingCard } from '@/components/listing/ListingCard';

export const metadata: Metadata = {
  title: t('homepage', 'metaTitle'),
  description: t('homepage', 'metaDescription'),
};

/**
 * Home page.
 *
 * Rendered on the server so the destination rails, top-rated listings and the
 * counts in the trust block are real data rather than a loading skeleton the
 * client has to fill in. The only client components here are the search widget
 * and the listing cards, which need interactivity.
 */
export default async function HomePage() {
  const db = await getDb();

  const packagesByCharter = indexPackages(db);
  const reviewsByCharter = indexReviews(db);

  const charterCountByDestination = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    charterCountByDestination.set(
      charter.destinationId,
      (charterCountByDestination.get(charter.destinationId) ?? 0) + 1,
    );
  }

  const destinations = db.destinations
    .map((destination) => {
      const country = db.countries.find((c) => c.id === destination.countryId);
      const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;
      return {
        slug: destination.slug,
        title: destination.title,
        popular: destination.popular,
        heroPhoto: destination.heroPhoto,
        label: [state?.abbrev, country?.title].filter(Boolean).join(', '),
        charterCount: charterCountByDestination.get(destination.id) ?? 0,
      };
    })
    .filter((d) => d.charterCount > 0)
    .sort((a, b) => b.charterCount - a.charterCount);

  const popularDestinations = destinations.filter((d) => d.popular).slice(0, 12);

  // Top-rated listings, requiring a few reviews so a single 5★ does not win.
  const topRated = db.charters
    .filter((c) => c.published && !c.snoozed)
    .map((charter) => {
      const reviews = reviewsByCharter.get(charter.id) ?? [];
      const rating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
      return { charter, reviews, rating };
    })
    .filter((entry) => entry.reviews.length >= 3)
    .sort((a, b) => b.rating - a.rating || b.reviews.length - a.reviews.length)
    .slice(0, 8)
    .map((entry) => {
      const destination = db.destinations.find((d) => d.id === entry.charter.destinationId)!;
      const country = db.countries.find((c) => c.id === destination.countryId);
      const state = destination.stateId ? db.states.find((s) => s.id === destination.stateId) : undefined;
      return buildCharterCard({
        charter: entry.charter,
        packages: packagesByCharter.get(entry.charter.id) ?? [],
        reviews: entry.reviews,
        destination,
        countryTitle: country?.title ?? '',
        stateAbbrev: state?.abbrev,
        currency: 'USD',
        guests: 2,
      });
    });

  const stats = {
    charters: db.charters.filter((c) => c.published).length,
    destinations: destinations.length,
    reviews: db.reviews.length,
  };

  const activityCounts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    for (const key of charter.activityKeys) {
      activityCounts.set(key, (activityCounts.get(key) ?? 0) + 1);
    }
  }

  const boatTypeCounts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    boatTypeCounts.set(charter.boat.type, (boatTypeCounts.get(charter.boat.type) ?? 0) + 1);
  }

  const topActivities = activities
    .map((activity) => ({ ...activity, count: activityCounts.get(activity.key) ?? 0 }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const topBoatTypes = boatTypes
    .map((type) => ({ ...type, count: boatTypeCounts.get(type.title) ?? 0 }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative">
        <div
          className="absolute inset-0 -z-10 bg-brand-900"
          style={{
            backgroundImage:
              'linear-gradient(140deg, #0b2a55 0%, #12508f 45%, #1f7fc4 78%, #35a6d8 100%)',
          }}
          aria-hidden="true"
        />
        {/* Suggestion of a horizon line, so the hero reads as water not a slab. */}
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-40 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(120% 90% at 50% 100%, rgba(255,255,255,.35), transparent 60%)',
          }}
          aria-hidden="true"
        />

        <div className="mx-auto max-w-shell px-4 pb-8 pt-10 md:pb-16 md:pt-20">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            {t('homepage', 'heroTitleLine1')}
            <br />
            {t('homepage', 'heroTitleLine2')}
          </h1>
          <p className="mt-3 text-base text-white/85 md:text-lg">{t('homepage', 'heroSubtitle')}</p>

          <div className="mt-6 md:mt-8">
            <SearchWidget variant="hero" />
          </div>

          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            <Stat value={stats.charters} label={t('homepage', 'charterCountLabel', { count: stats.charters })} />
            <Stat value={stats.destinations} label={t('homepage', 'destinationCountLabel', { count: stats.destinations })} />
            <Stat value={stats.reviews} label={t('homepage', 'reviewCountLabel', { count: stats.reviews })} />
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-shell space-y-12 px-4 py-10">
        {/* ------------------------------------------------ destinations */}
        <section aria-labelledby="destinations-heading">
          <SectionHeading
            title={t('homepage', 'destinationsNearYouTitle')}
            action={
              <Link href="/sitemap" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('general', 'seeAll')}
              </Link>
            }
          />
          <h2 id="destinations-heading" className="sr-only">
            {t('homepage', 'destinationsNearYouTitle')}
          </h2>
          <ul className="rail md:grid md:grid-cols-4 md:gap-4 md:overflow-visible lg:grid-cols-6">
            {popularDestinations.map((destination) => (
              <li key={destination.slug} className="w-40 shrink-0 md:w-auto">
                <Link href={`/destination/${destination.slug}`} className="group block">
                  <PhotoFrame
                    photo={destination.heroPhoto}
                    className="aspect-[4/5] w-full transition-transform group-hover:scale-[1.02] md:aspect-[3/4]"
                  >
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-2.5">
                      <span className="block text-sm font-bold text-white">{destination.title}</span>
                      <span className="block text-[11px] text-white/80">
                        {t('destinations', 'charterCount', { count: destination.charterCount })}
                      </span>
                    </span>
                  </PhotoFrame>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------- top rated */}
        {topRated.length ? (
          <section aria-labelledby="toprated-heading">
            <SectionHeading title={t('search', 'sortRating')} subtitle={t('homepage', 'heroSubtitle')} />
            <h2 id="toprated-heading" className="sr-only">
              {t('search', 'sortRating')}
            </h2>
            <ul className="rail md:grid md:grid-cols-2 md:gap-4 md:overflow-visible lg:grid-cols-4">
              {topRated.map((charter, index) => (
                <li key={charter.id} className="w-64 shrink-0 md:w-auto">
                  <ListingCard charter={charter} index={index} total={topRated.length} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---------------------------------------------- how it works */}
        <section aria-labelledby="how-heading">
          <SectionHeading title={t('homepage', 'howItWorksTitle')} />
          <h2 id="how-heading" className="sr-only">
            {t('homepage', 'howItWorksTitle')}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {(['1', '2', '3'] as const).map((step, index) => (
              <li key={step}>
                <Card className="h-full p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Icon name={index === 0 ? 'search' : index === 1 ? 'list' : 'check-circle'} size={20} />
                  </span>
                  <h3 className="mt-3 text-base font-bold text-ink">
                    {t('homepage', `howItWorksStep${step}Title`)}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{t('homepage', `howItWorksStep${step}Body`)}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* ----------------------------------------------------- trust */}
        <section className="rounded-card border border-line bg-surface-sunken p-6 text-center">
          <h2 className="text-lg font-bold text-ink">{t('homepage', 'trustTitle')}</h2>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-4xl font-extrabold tabular-nums text-ink">
              {brand.reviewAggregate.score}
            </span>
            <span className="text-left">
              <Stars rating={brand.reviewAggregate.score} size={16} />
              <span className="mt-0.5 block text-xs text-ink-muted">
                out of {brand.reviewAggregate.outOf}
              </span>
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {t('homepage', 'trustRatingBasis', {
              count: brand.reviewAggregate.count,
              source: brand.reviewAggregate.source,
            })}
          </p>
        </section>

        {/* --------------------------------------------- list your boat */}
        <section className="overflow-hidden rounded-card bg-ink text-white">
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h2 className="text-xl font-bold md:text-2xl">{t('homepage', 'listYourBusinessTitle')}</h2>
              <p className="mt-1.5 text-sm text-white/75">{t('homepage', 'listYourBusinessSubtitle')}</p>
            </div>
            <LinkButton href="/pages/whylist" variant="primary" size="lg" iconRight="arrow-right" className="shrink-0">
              {t('homepage', 'listYourBusinessCta')}
            </LinkButton>
          </div>
        </section>

        {/* ------------------------------------------------ boat types */}
        <section aria-labelledby="boattypes-heading">
          <SectionHeading
            title={t('homepage', 'topBoatTypesTitle')}
            action={
              <Link href="/boat-type" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('homepage', 'seeAllBoatTypes')}
              </Link>
            }
          />
          <h2 id="boattypes-heading" className="sr-only">
            {t('homepage', 'topBoatTypesTitle')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {topBoatTypes.map((type) => (
              <li key={type.slug}>
                <Link
                  href={`/boat-type/${type.slug}`}
                  className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-2.5 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{type.title}</span>
                    <span className="block text-xs text-ink-muted">{type.category}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-faint">{type.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ activities */}
        <section aria-labelledby="activities-heading">
          <SectionHeading
            title={t('homepage', 'topActivitiesTitle')}
            action={
              <Link href="/activity" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('homepage', 'seeAllActivities')}
              </Link>
            }
          />
          <h2 id="activities-heading" className="sr-only">
            {t('homepage', 'topActivitiesTitle')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {topActivities.map((activity) => (
              <li key={activity.slug}>
                <Link
                  href={`/activity/${activity.slug}`}
                  className="flex h-full flex-col justify-between gap-1 rounded-control border border-line bg-white p-3 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
                >
                  <span className="text-sm font-semibold text-ink">{activity.title}</span>
                  <span className="text-xs text-ink-muted">
                    {t('activities', 'boatsOffering', { count: activity.count })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------- app promo */}
        <section className="rounded-card border border-line bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-lg">
              <Badge tone="brand" icon="bolt">
                {brand.name} app
              </Badge>
              <h2 className="mt-2 text-xl font-bold text-ink">{t('homepage', 'appDownloadTitle')}</h2>
              <p className="mt-1.5 text-sm text-ink-muted">{t('homepage', 'appDownloadSubtitle')}</p>
            </div>
            <div className="flex gap-3">
              <AppBadge store="Google Play" href={brand.appStore.android} />
              <AppBadge store="App Store" href={brand.appStore.ios} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="flex items-baseline gap-1.5">
        <span className="text-lg font-extrabold tabular-nums text-white">{value.toLocaleString('en-US')}</span>
        <span className="text-white/75">{label.replace(/^[\d,]+\s*/, '')}</span>
      </dd>
    </div>
  );
}

function AppBadge({ store, href }: { store: string; href: string }) {
  return (
    <a
      href={href}
      className={cx(
        'flex h-12 items-center gap-2 rounded-control bg-ink px-4 text-white transition-opacity hover:opacity-90',
      )}
    >
      <Icon name="download" size={20} />
      <span className="leading-tight">
        <span className="block text-[9px] uppercase tracking-wide opacity-70">Get it on</span>
        <span className="block text-sm font-bold">{store}</span>
      </span>
    </a>
  );
}
