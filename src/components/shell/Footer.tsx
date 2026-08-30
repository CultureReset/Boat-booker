import Link from 'next/link';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

/**
 * Site footer.
 *
 * Collapses to stacked sections on mobile and a four-column grid on desktop.
 * The link groups mirror the platform's own information architecture so the
 * SEO surface (destinations, activities, boat types) stays crawlable from
 * every page.
 */

const GROUPS = [
  {
    heading: t('navigation', 'aboutBrand'),
    links: [
      { href: '/about', label: t('navigation', 'aboutUs') },
      { href: '/careers', label: t('navigation', 'careers') },
      { href: '/blog', label: t('navigation', 'blog') },
      { href: '/contact', label: t('navigation', 'contact') },
      { href: '/pages/safety', label: t('navigation', 'safety') },
    ],
  },
  {
    heading: t('navigation', 'discover'),
    links: [
      { href: '/activity', label: t('navigation', 'activity') },
      { href: '/boat-type', label: t('navigation', 'boatType') },
      { href: '/boating-near-me', label: t('navigation', 'boatingNearMe') },
      { href: '/loyalty', label: t('navigation', 'loyalty') },
    ],
  },
  {
    heading: t('navigation', 'sitemap'),
    links: [
      { href: '/countries', label: t('navigation', 'allCountries') },
      { href: '/states', label: t('navigation', 'allStates') },
      { href: '/locations', label: t('navigation', 'allLocations') },
      { href: '/sitemap', label: t('navigation', 'allDestinations') },
    ],
  },
  {
    heading: t('navigation', 'support'),
    links: [
      { href: '/help', label: t('navigation', 'helpCenter') },
      { href: '/pages/terms', label: t('navigation', 'termsOfUse') },
      { href: '/pages/privacy', label: t('navigation', 'privacyPolicy') },
      { href: '/pages/gdpr', label: t('navigation', 'gdprPrivacyNotice') },
      { href: '/pages/rules', label: t('navigation', 'rulesAndGuidelines') },
      { href: '/pages/accessibility', label: t('navigation', 'accessibilityStatement') },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-surface-sunken">
      <div className="mx-auto max-w-shell px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {GROUPS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="mb-3 text-sm font-bold text-ink">{group.heading}</h2>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-soft transition-colors hover:text-brand-700 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mb-2 text-sm font-bold text-ink">{t('homepage', 'appDownloadTitle')}</h2>
            <p className="mb-3 max-w-sm text-sm text-ink-muted">{t('homepage', 'appDownloadSubtitle')}</p>
            <div className="flex gap-3">
              <StoreBadge store="Google Play" href={brand.appStore.android} />
              <StoreBadge store="App Store" href={brand.appStore.ios} />
            </div>
          </div>

          <div className="md:text-right">
            <h2 className="mb-2 text-sm font-bold text-ink">{t('navigation', 'findUsOn')}</h2>
            <div className="flex gap-2 md:justify-end">
              {brand.social.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  <Icon name="globe" size={18} />
                </a>
              ))}
            </div>
            <a
              href={`tel:${brand.supportPhone.replace(/\s/g, '')}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink transition-colors hover:text-brand-700"
            >
              <Icon name="phone" size={16} />
              {brand.supportPhone}
            </a>
          </div>
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          {t('navigation', 'allRightsReserved', { brand: brand.legalName })}
        </p>
      </div>
    </footer>
  );
}

function StoreBadge({ store, href }: { store: string; href: string }) {
  return (
    <a
      href={href}
      className="flex h-11 items-center gap-2 rounded-control bg-ink px-3 text-white transition-opacity hover:opacity-90"
    >
      <Icon name="download" size={18} />
      <span className="leading-tight">
        <span className="block text-[9px] uppercase tracking-wide opacity-70">Get it on</span>
        <span className="block text-xs font-bold">{store}</span>
      </span>
    </a>
  );
}
