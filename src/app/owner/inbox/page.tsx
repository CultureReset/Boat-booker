import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { listThreads } from '@/lib/services/messages';
import { SectionHeading } from '@/components/ui/primitives';
import { ThreadList } from '@/components/account/Inbox';

export const metadata: Metadata = { title: t('inbox', 'title') };

export default async function OwnerInboxPage() {
  const user = (await currentUser())!;
  const db = await getDb();
  const threads = listThreads(db, user.id);

  return (
    <>
      <SectionHeading title={t('inbox', 'title')} level={1} />
      <ThreadList threads={threads} basePath="/owner/inbox" />
    </>
  );
}
