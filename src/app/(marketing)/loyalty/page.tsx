import Link from 'next/link';
import type { Metadata } from 'next';
import { brand, commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { Icon } from '@/components/ui/Icon';
import { LinkButton, SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: t('account', 'loyaltyTitle'),
  description: `Complete trips to unlock automatic discounts on every future booking with ${brand.name}.`,
  alternates: { canonical: '/loyalty' },
};

/** Public explainer for the loyalty programme, driven by `commerceConfig`. */
export default function LoyaltyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-3">
        <ol className="flex items-center gap-1 text-xs text-ink-muted">
          <li><Link href="/" className="hover:underline">{t('navigation', 'home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-ink-soft" aria-current="page">{t('account', 'loyaltyTitle')}</li>
        </ol>
      </nav>

      <SectionHeading
        title={t('account', 'loyaltyPageTitle')}
        subtitle={t('account', 'loyaltyPageSubtitle')}
        level={1}
      />

      <ol className="mb-8 space-y-3">
        {commerceConfig.loyaltyTiers.map((tier, index) => (
          <li
            key={tier.level}
            className="flex items-center gap-4 rounded-card border border-line bg-white p-4"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white"
              style={{ opacity: 0.55 + index * 0.15 }}
            >
              {tier.level}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                {t('account', 'loyaltyLevel', { level: tier.level })}
              </p>
              <p className="text-xs text-ink-muted">
                After {tier.completedTrips} completed {tier.completedTrips === 1 ? 'trip' : 'trips'}
              </p>
            </div>
            <span className="shrink-0 text-lg font-extrabold text-brand-700">
              {tier.discountPercentage}% off
            </span>
          </li>
        ))}
      </ol>

      <section className="mb-8 rounded-card border border-line bg-surface-sunken p-5">
        <h2 className="mb-3 text-base font-bold text-ink">How it works</h2>
        <ul className="space-y-2.5">
          {[
            'A trip counts once it has happened — not when you book it.',
            'The discount applies to the trip price, before fees, and is itemised in the breakdown.',
            'It stacks with boating credit from referrals.',
            'There is nothing to join and nothing to claim; it applies automatically once you qualify.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-600" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card bg-ink p-5 text-white">
        <h2 className="text-base font-bold">{t('account', 'referralsTitle')}</h2>
        <p className="mt-1.5 text-sm text-white/80">
          {t('account', 'referralsBody', { amount: formatMoney(commerceConfig.referralCredit) })}
        </p>
        <LinkButton href="/account/referrals" className="mt-4" iconRight="arrow-right">
          {t('navigation', 'inviteFriend')}
        </LinkButton>
      </section>
    </div>
  );
}
