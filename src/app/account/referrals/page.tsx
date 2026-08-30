import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { accountSummary } from '@/lib/services/accounts';
import { Icon } from '@/components/ui/Icon';
import { SectionHeading } from '@/components/ui/primitives';
import { CopyField } from '@/components/account/CopyField';

export const metadata: Metadata = { title: t('account', 'referralsTitle') };

export default async function ReferralsPage() {
  const user = (await currentUser())!;
  const db = await getDb();
  const summary = accountSummary(db, user);

  const amount = formatMoney(summary.referralCredit, user.currency);
  const inviteUrl = `https://${brand.domain}/?ref=${summary.referralCode}`;

  return (
    <div className="max-w-xl">
      <SectionHeading title={t('account', 'referralsTitle')} level={1} />

      <section className="rounded-card border border-line bg-white p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon name="users" size={24} />
        </span>
        <h2 className="mt-3 text-lg font-bold text-ink">{t('account', 'referralsTitle')}</h2>
        <p className="mt-1.5 text-sm text-ink-soft">{t('account', 'referralsBody', { amount })}</p>

        <div className="mt-4 space-y-3">
          <CopyField label={t('account', 'referralCode')} value={summary.referralCode} />
          <CopyField label={t('general', 'copyLink')} value={inviteUrl} />
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line bg-white p-4">
          <dt className="text-xs text-ink-muted">{t('account', 'creditBalance')}</dt>
          <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-ink">
            {formatMoney(summary.creditBalance, user.currency)}
          </dd>
        </div>
        <div className="rounded-card border border-line bg-white p-4">
          <dt className="text-xs text-ink-muted">{t('navigation', 'referrals')}</dt>
          <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-ink">{summary.referredCount}</dd>
        </div>
      </dl>
    </div>
  );
}
