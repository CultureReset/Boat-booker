import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { getDb } from '@/lib/storage';
import { Icon } from '@/components/ui/Icon';
import { PhotoFrame, SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('navigation', 'blog'),
  description: `Guides and destination notes from ${brand.name}.`,
  alternates: { canonical: '/blog' },
};

/**
 * Blog index.
 *
 * Posts are generated from the destination set rather than hand-written, so
 * the index stays in step with the inventory the platform actually has. A CMS
 * would replace the source of `posts` and nothing else.
 */
export default async function BlogPage() {
  const db = await getDb();

  const counts = new Map<string, number>();
  for (const charter of db.charters) {
    if (!charter.published) continue;
    counts.set(charter.destinationId, (counts.get(charter.destinationId) ?? 0) + 1);
  }

  const posts = db.destinations
    .filter((d) => d.popular && (counts.get(d.id) ?? 0) > 0)
    .map((destination) => {
      const country = db.countries.find((c) => c.id === destination.countryId);
      return {
        slug: destination.slug,
        title: `A first-timer's guide to boating in ${destination.title}`,
        excerpt: destination.blurb,
        photo: destination.heroPhoto,
        label: country?.title ?? '',
        count: counts.get(destination.id) ?? 0,
      };
    })
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-shell px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('navigation', 'blog')}</li>
        </ol>
      </nav>

      <SectionHeading
        title={t('navigation', 'blog')}
        subtitle="Destination notes, written from what operators tell us."
        level={1}
      />

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/destination/${post.slug}`} className="group block">
              <PhotoFrame
                photo={post.photo}
                className="aspect-[16/10] w-full transition-transform group-hover:scale-[1.01]"
              />
              <h2 className="mt-2.5 text-base font-bold leading-snug text-ink group-hover:underline">
                {post.title}
              </h2>
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-muted">{post.excerpt}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                <Icon name="map-pin" size={12} />
                {post.label} · {t('destinations', 'charterCount', { count: post.count })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
