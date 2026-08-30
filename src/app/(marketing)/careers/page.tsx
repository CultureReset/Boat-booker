import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { staticPageBySlug } from '@/content/pages';
import { translate as t } from '@/i18n/translate';
import { StaticPageBody } from '@/components/content/StaticPageBody';

const page = staticPageBySlug.get('careers');

export const metadata: Metadata = {
  title: page?.title ?? '',
  description: page?.subtitle,
  alternates: { canonical: '/careers' },
};

/** Top-level alias for the /pages/careers content, which is where the footer links. */
export default function Page() {
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
