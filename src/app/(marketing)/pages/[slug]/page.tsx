import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { staticPageBySlug, staticPages } from '@/content/pages';
import { translate as t } from '@/i18n/translate';
import { StaticPageBody } from '@/components/content/StaticPageBody';

/**
 * Static content pages.
 *
 * One route renders every policy and informational page from the data in
 * `content/pages.ts`, so adding a page is a data change with no new route.
 */

export async function generateStaticParams() {
  return staticPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = staticPageBySlug.get(slug);
  if (!page) return { title: t('errors', 'notFoundTitle') };

  return {
    title: page.title,
    description: page.subtitle ?? page.sections[0]?.paragraphs?.[0]?.slice(0, 160),
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = staticPageBySlug.get(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{page.title}</li>
        </ol>
      </nav>

      <StaticPageBody page={page} />
    </div>
  );
}
