import { Suspense } from 'react';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { listThreads, type ThreadFilter } from '@/lib/services/messages';
import { SectionHeading } from '@/components/ui/primitives';
import { ThreadList } from '@/components/inbox/ThreadList';

export const metadata: Metadata = { title: t('inbox', 'title') };

const FILTERS: ThreadFilter[] = ['latest', 'unread', 'priority', 'support', 'archived'];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const active: ThreadFilter = FILTERS.includes(filter as ThreadFilter)
    ? (filter as ThreadFilter)
    : 'latest';

  const user = (await currentUser())!;
  const db = await getDb();
  const threads = listThreads(db, user.id, active);

  return (
    <>
      <SectionHeading title={t('inbox', 'title')} level={1} />
      {/* The filter rail reads the query string, so it needs a Suspense
          boundary for `useSearchParams` during static rendering. */}
      <Suspense fallback={null}>
        <ThreadList threads={threads} basePath="/account/inbox" filter={active} />
      </Suspense>
    </>
  );
}
