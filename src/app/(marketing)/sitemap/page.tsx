import Link from 'next/link';
import type { Metadata } from 'next';
import { activities, boatTypes } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('navigation', 'sitemap'),
  description: t('destinations', 'allDestinationsTitle'),
  alternates: { canonical: '/sitemap' },
};

/**
 * Human sitemap.
 *
 * Every indexable page in one place: destinations by country, activities, boat
 * types and the static pages. Search engines get `/sitemap.xml`; this is the
 * version a person can actually use.
 */
export default async function SitemapPage() {
  const db = await getDb();

  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    counts.set(charter.destinationId, (counts.get(charter.destinationId) ?? 0) + 1);
  }

  const byCountry = db.countries
    .map((country) => ({
      country,
      destinations: db.destinations
        .filter((d) => d.countryId === country.id && (counts.get(d.id) ?? 0) > 0)
        .map((d) => ({
          slug: d.slug,
          title: d.title,
          count: counts.get(d.id) ?? 0,
          stateAbbrev: d.stateId ? db.states.find((s) => s.id === d.stateId)?.abbrev : undefined,
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((entry) => entry.destinations.length > 0)
    .sort((a, b) => a.country.title.localeCompare(b.country.title));

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <SectionHeading
        title={t('navigation', 'sitemap')}
        subtitle={t('destinations', 'allDestinationsTitle')}
        level={1}
      />

      <section className="mb-10">
        <h2 className="mb-4 text-base font-bold text-ink">{t('destinations', 'browseByCountry')}</h2>
        <div className="space-y-6">
          {byCountry.map(({ country, destinations }) => (
            <section key={country.id} aria-labelledby={`country-${country.id}`}>
              <h3 id={`country-${country.id}`} className="mb-2 text-sm font-bold text-ink">
                <Link href={`/countries#${country.code}`} className="hover:underline">
                  {country.title}
                </Link>
                <span className="ml-2 text-xs font-normal text-ink-muted">
                  {destinations.length} {destinations.length === 1 ? 'destination' : 'destinations'}
                </span>
              </h3>
              <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                {destinations.map((destination) => (
                  <li key={destination.slug}>
                    <Link
                      href={`/destination/${destination.slug}`}
                      className="flex items-baseline justify-between gap-2 py-1 text-sm text-ink-soft transition-colors hover:text-brand-700 hover:underline"
                    >
                      <span className="truncate">
                        {destination.title}
                        {destination.stateAbbrev ? `, ${destination.stateAbbrev}` : ''}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-faint">
                        {destination.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-bold text-ink">
            <Link href="/activity" className="hover:underline">{t('activities', 'title')}</Link>
          </h2>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {activities.map((activity) => (
              <li key={activity.slug}>
                <Link
                  href={`/activity/${activity.slug}`}
                  className="block py-1 text-sm text-ink-soft transition-colors hover:text-brand-700 hover:underline"
                >
                  {activity.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold text-ink">
            <Link href="/boat-type" className="hover:underline">{t('boatTypes', 'title')}</Link>
          </h2>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {boatTypes.map((type) => (
              <li key={type.slug}>
                <Link
                  href={`/boat-type/${type.slug}`}
                  className="block py-1 text-sm text-ink-soft transition-colors hover:text-brand-700 hover:underline"
                >
                  {type.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-bold text-ink">{t('navigation', 'support')}</h2>
        <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/about', label: t('navigation', 'aboutUs') },
            { href: '/careers', label: t('navigation', 'careers') },
            { href: '/contact', label: t('navigation', 'contact') },
            { href: '/blog', label: t('navigation', 'blog') },
            { href: '/help', label: t('navigation', 'helpCenter') },
            { href: '/loyalty', label: t('account', 'loyaltyTitle') },
            { href: '/boating-near-me', label: t('navigation', 'boatingNearMe') },
            { href: '/pages/whylist', label: t('navigation', 'getListed') },
            { href: '/pages/safety', label: t('navigation', 'safety') },
            { href: '/pages/terms', label: t('navigation', 'termsOfUse') },
            { href: '/pages/privacy', label: t('navigation', 'privacyPolicy') },
            { href: '/pages/gdpr', label: t('navigation', 'gdprPrivacyNotice') },
            { href: '/pages/rules', label: t('navigation', 'rulesAndGuidelines') },
            { href: '/pages/accessibility', label: t('navigation', 'accessibilityStatement') },
            { href: '/countries', label: t('destinations', 'countriesTitle') },
            { href: '/states', label: t('destinations', 'statesTitle') },
            { href: '/locations', label: t('destinations', 'locationsTitle') },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block py-1 text-sm text-ink-soft transition-colors hover:text-brand-700 hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
