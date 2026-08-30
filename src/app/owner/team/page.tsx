import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { SectionHeading } from '@/components/ui/primitives';
import { TeamPanel } from '@/components/owner/TeamPanel';

export const metadata: Metadata = { title: t('owner', 'teamTitle') };

export default async function TeamPage() {
  const user = (await currentUser())!;
  return (
    <>
      <SectionHeading title={t('owner', 'teamTitle')} level={1} />
      <TeamPanel members={user.ownerProfile?.team ?? []} />
    </>
  );
}
