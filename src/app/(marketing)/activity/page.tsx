import Link from 'next/link';
import type { Metadata } from 'next';
import { activities } from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('activities', 'title'),
  description: t('activities', 'subtitle'),
  alternates: { canonical: '/activity' },
};

/**
 * Activity index.
 *
 * One of the SEO surfaces: a crawlable page per activity, grouped so a human
 * can scan it too. Counts come from live listing data, so an activity with no
 * inventory is not advertised.
 */
export default async function ActivityIndexPage() {
  const db = await getDb();

  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    for (const key of charter.activityKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const groups: { key: string; title: string }[] = [
    { key: 'tours', title: 'Tours & cruising' },
    { key: 'water-sports', title: 'Water sports' },
    { key: 'wildlife', title: 'Wildlife & nature' },
    { key: 'celebrations', title: 'Celebrations & events' },
    { key: 'fishing', title: 'Fishing' },
  ];

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li>
            <Link href="/" className="hover:underline">{t('navigation', 'home')}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('activities', 'title')}</li>
        </ol>
      </nav>

      <SectionHeading title={t('activities', 'title')} subtitle={t('activities', 'subtitle')} level={1} />

      <div className="space-y-8">
        {groups.map((group) => {
          const items = activities
            .filter((activity) => activity.group === group.key)
            .map((activity) => ({ ...activity, count: counts.get(activity.key) ?? 0 }))
            .filter((activity) => activity.count > 0);

          if (!items.length) return null;

          return (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <h2 id={`group-${group.key}`} className="mb-3 text-base font-bold text-ink">
                {group.title}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((activity) => (
                  <li key={activity.slug}>
                    <Link
                      href={`/activity/${activity.slug}`}
                      className="flex h-full flex-col gap-1.5 rounded-card border border-line bg-white p-4 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-ink">{activity.title}</span>
                        <Icon name="chevron-right" size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                      </span>
                      <span className="text-sm leading-relaxed text-ink-muted">{activity.blurb}</span>
                      <span className="mt-auto pt-2 text-xs font-semibold text-brand-700">
                        {t('activities', 'boatsOffering', { count: activity.count })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
