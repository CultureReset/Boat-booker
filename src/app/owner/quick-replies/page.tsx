import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { quickRepliesFor } from '@/lib/services/direct';
import { QUICK_REPLY_PLACEHOLDERS } from '@/lib/domain/types';
import { SectionHeading } from '@/components/ui/primitives';
import { QuickReplyManager } from '@/components/owner/QuickReplyManager';

export const metadata: Metadata = { title: t('quickReplies', 'title') };

export default async function QuickRepliesPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  return (
    <>
      <SectionHeading
        title={t('quickReplies', 'title')}
        subtitle={t('quickReplies', 'subtitle')}
        level={1}
      />
      <QuickReplyManager
        replies={quickRepliesFor(db, user.id)}
        placeholders={QUICK_REPLY_PLACEHOLDERS}
      />
    </>
  );
}
