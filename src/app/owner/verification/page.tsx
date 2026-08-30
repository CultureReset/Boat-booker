import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { SectionHeading } from '@/components/ui/primitives';
import { VerificationPanel } from '@/components/owner/VerificationPanel';

export const metadata: Metadata = { title: t('owner', 'verificationTitle') };

export default async function VerificationPage() {
  const user = (await currentUser())!;
  return (
    <>
      <SectionHeading title={t('owner', 'verificationTitle')} level={1} />
      <VerificationPanel
        verification={user.ownerProfile?.verification ?? { status: 'unverified', documents: [] }}
      />
    </>
  );
}
