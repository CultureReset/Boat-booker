import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { mutate } from '@/lib/storage';
import { markThreadRead, readThread } from '@/lib/services/messages';
import { ThreadView } from '@/components/account/Inbox';

export const metadata: Metadata = { title: t('inbox', 'title') };

/**
 * A single conversation.
 *
 * Opening the thread marks it read in the same pass that loads it, so the
 * unread badge clears without a second round trip.
 */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await currentUser())!;

  try {
    const thread = await mutate((db) => {
      markThreadRead(db, id, user.id);
      return readThread(db, id, user.id);
    });
    return <ThreadView thread={thread} basePath="/account/inbox" />;
  } catch {
    // `readThread` throws for a missing thread or one the viewer cannot see;
    // both should look the same from outside.
    notFound();
  }
}
