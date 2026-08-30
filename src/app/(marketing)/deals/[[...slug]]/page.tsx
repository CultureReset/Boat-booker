import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { campaignBySlug } from '@/config/campaigns';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { dealsPage, listCampaigns } from '@/lib/services/deals';
import { Icon } from '@/components/ui/Icon';
import { Badge, EmptyState, LinkButton, SectionHeading } from '@/components/ui/primitives';
import { ListingCard } from '@/components/listing/ListingCard';
import { cx } from '@/components/ui/cx';

/**
 * `/deals` and `/deals/<campaign>`.
 *
 * One optional-catch-all route rather than an index plus a detail route: the
 * two share a hero, a shell and a card grid, and splitting them would mean
 * keeping two copies of that in step. Which campaigns exist is
 * `config/campaigns`, so a new one is a data change.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = slug?.[0] ? campaignBySlug(slug[0]) : undefined;

  return {
    title: campaign ? campaign.title : t('deals', 'indexTitle'),
    description: campaign?.subtitle ?? t('deals', 'indexSubtitle'),
  };
}

export default async function DealsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;

  // More than one segment is not a campaign, it is a bad link.
  if (slug && slug.length > 1) notFound();

  return slug?.[0] ? <Campaign slug={slug[0]} /> : <Index />;
}

/* ------------------------------------------------------------------ index */

async function Index() {
  const entries = listCampaigns();

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-6">
      <SectionHeading title={t('deals', 'indexTitle')} subtitle={t('deals', 'indexSubtitle')} level={1} />

      <ul className="grid gap-3 sm:grid-cols-2">
        {entries.map(({ campaign, running }) => (
          <li key={campaign.slug}>
            <Link
              href={`/deals/${campaign.slug}`}
              className={cx(
                'flex h-full flex-col justify-between gap-6 rounded-card bg-gradient-to-br p-5 text-white transition-transform hover:-translate-y-0.5',
                campaign.hero,
              )}
            >
              <div>
                <p className="flex items-center gap-2">
                  <span className="text-lg font-extrabold">{campaign.title}</span>
                  {running ? <Badge tone="success">{t('deals', 'liveNow')}</Badge> : null}
                </p>
                <p className="mt-1 text-sm text-white/85">{campaign.subtitle}</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-bold">
                {t('deals', 'seeDeals')}
                <Icon name="arrow-right" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- campaign */

async function Campaign({ slug }: { slug: string }) {
  const campaign = campaignBySlug(slug);
  if (!campaign) notFound();

  const db = await getDb();
  const page = dealsPage(db, campaign);

  return (
    <div className="mx-auto w-full max-w-shell px-4 py-6">
      <nav aria-label={t('navigation', 'sitemap')} className="mb-3">
        <Link
          href="/deals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          <Icon name="chevron-left" size={15} />
          {t('deals', 'indexTitle')}
        </Link>
      </nav>

      <header className={cx('mb-5 rounded-card bg-gradient-to-br p-5 text-white', campaign.hero)}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold">{campaign.title}</h1>
          {/* An out-of-season page still renders — the link may be in an old
              email — but it says so rather than implying the offer is live. */}
          <Badge tone={page.running ? 'success' : 'neutral'}>
            {page.running ? t('deals', 'liveNow') : t('deals', 'outOfSeason')}
          </Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-white/85">{campaign.subtitle}</p>
      </header>

      {page.charters.length === 0 ? (
        <EmptyState
          icon="tag"
          title={t('deals', 'emptyTitle')}
          body={t('deals', 'emptyBody')}
          action={<LinkButton href="/charters/search">{t('general', 'search')}</LinkButton>}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted">
            {t('deals', 'matchCount', { count: page.charters.length })}
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {page.charters.map((charter) => (
              <li key={charter.id}>
                <ListingCard charter={charter} layout="grid" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
