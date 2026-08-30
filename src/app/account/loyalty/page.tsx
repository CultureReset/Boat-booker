import type { Metadata } from 'next';
import { commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { accountSummary } from '@/lib/services/accounts';
import { Icon } from '@/components/ui/Icon';
import { Badge, LinkButton, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = { title: t('account', 'loyaltyTitle') };

/**
 * Loyalty status.
 *
 * The tier ladder is read from `commerceConfig`, so changing the programme is
 * a config edit rather than a rewrite of this page.
 */
export default async function LoyaltyPage() {
  const user = (await currentUser())!;
  const db = await getDb();
  const summary = accountSummary(db, user);
  const { loyalty } = summary;

  return (
    <div className="max-w-2xl">
      <SectionHeading title={t('account', 'loyaltyTitle')} level={1} />

      {/* -------------------------------------------------- status card */}
      <section className="rounded-card bg-ink p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">{t('account', 'loyaltyTitle')}</p>
            <p className="mt-1 text-2xl font-extrabold">
              {loyalty.level > 0 ? t('account', 'loyaltyLevel', { level: loyalty.level }) : t('bookings', 'statusPending')}
            </p>
            {loyalty.discountPercentage > 0 ? (
              <p className="mt-1 text-sm text-white/80">
                {t('account', 'loyaltyDiscount', { percent: loyalty.discountPercentage })}
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/80">{t('account', 'loyaltyJoinPrompt')}</p>
            )}
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Icon name="star" size={24} className="text-gold" strokeWidth={0} />
          </span>
        </div>

        <p className="mt-4 text-sm text-white/70">
          {user.completedTrips} completed {user.completedTrips === 1 ? 'trip' : 'trips'}
          {loyalty.next
            ? ` · ${t('account', 'loyaltyProgress', { count: loyalty.tripsToNext, level: loyalty.next.level })}`
            : ''}
        </p>

        {loyalty.next ? (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{
                width: `${Math.min(100, (user.completedTrips / loyalty.next.completedTrips) * 100)}%`,
              }}
            />
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------- ladder */}
      <section className="mt-5">
        <h2 className="mb-3 text-base font-bold text-ink">{t('account', 'loyaltyTitle')}</h2>
        <ul className="space-y-2">
          {commerceConfig.loyaltyTiers.map((tier) => {
            const reached = user.completedTrips >= tier.completedTrips;
            const current = loyalty.level === tier.level;
            return (
              <li
                key={tier.level}
                className={cx(
                  'flex items-center gap-3 rounded-card border p-3',
                  current ? 'border-brand-500 bg-brand-50/50' : 'border-line bg-white',
                )}
              >
                <span
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    reached ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-faint',
                  )}
                >
                  {tier.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">
                    {t('account', 'loyaltyLevel', { level: tier.level })}
                    {current ? <Badge tone="brand" className="ml-2">{t('general', 'yes')}</Badge> : null}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {tier.completedTrips} completed {tier.completedTrips === 1 ? 'trip' : 'trips'}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-ink">{tier.discountPercentage}% off</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------------- credit */}
      <section className="mt-5 rounded-card border border-line bg-white p-4">
        <h2 className="mb-1 text-base font-bold text-ink">{t('account', 'creditBalance')}</h2>
        <p className="text-2xl font-extrabold tabular-nums text-ink">
          {formatMoney(summary.creditBalance, user.currency)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {summary.creditBalance > 0
            ? t('navigation', 'creditExplained', { amount: formatMoney(summary.creditBalance, user.currency) })
            : t('account', 'creditEmpty')}
        </p>
        <LinkButton href="/account/referrals" variant="outline" size="sm" className="mt-3">
          {t('account', 'referralsTitle')}
        </LinkButton>
      </section>
    </div>
  );
}
