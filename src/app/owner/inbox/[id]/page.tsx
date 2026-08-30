import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { mutate } from '@/lib/storage';
import { markThreadRead, readThread } from '@/lib/services/messages';
import { ThreadView } from '@/components/inbox/Thread';

export const metadata: Metadata = { title: t('inbox', 'title') };

export default async function OwnerThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  try {
    const { thread, quickReplies } = await mutate((db) => {
      markThreadRead(db, id, user.id);
      return {
        thread: readThread(db, id, user.id),
        // Loaded here rather than fetched from the client so the Quick Replies
        // sheet opens with content already in it.
        quickReplies: db.quickReplies
          .filter((q) => q.ownerId === user.id)
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((q) => ({ id: q.id, title: q.title, body: q.body })),
      };
    });
    return <ThreadView thread={thread} basePath="/owner/inbox" quickReplies={quickReplies} />;
  } catch {
    notFound();
  }
}
