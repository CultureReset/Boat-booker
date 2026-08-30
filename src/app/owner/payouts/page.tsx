import type { Metadata } from 'next';
import { commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb, mutate } from '@/lib/storage';
import { settleElapsedBookings } from '@/lib/services/bookings';
import { payoutLedger } from '@/lib/services/owner';
import { Icon } from '@/components/ui/Icon';
import { Badge, EmptyState, LinkButton, SectionHeading } from '@/components/ui/primitives';

export const metadata: Metadata = { title: t('owner', 'payoutsTitle') };

/**
 * Payout ledger.
 *
 * Shows what has cleared, what is coming and exactly what the platform took,
 * per booking. Owners reconcile against this, so every number ties back to a
 * booking reference.
 */
export default async function PayoutsPage() {
  const user = (await currentUser())!;

  await mutate((db) => settleElapsedBookings(db));
  const db = await getDb();

  const ledger = payoutLedger(db, user.id);
  const hasMethod = (user.ownerProfile?.payoutMethods.length ?? 0) > 0;

  return (
    <>
      <SectionHeading title={t('owner', 'payoutsTitle')} level={1} />

      {!hasMethod ? (
        <div className="mb-4 flex items-start gap-3 rounded-card border-l-4 border-l-danger border-line bg-white p-4">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{t('owner', 'addPayoutMethod')}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              We cannot send your earnings until a payout method is on file.
            </p>
          </div>
          <LinkButton href="/owner/payout-methods" size="sm" className="shrink-0">
            {t('owner', 'addPayoutMethod')}
          </LinkButton>
        </div>
      ) : null}

      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label={t('owner', 'payoutsBalance')} value={formatMoney(ledger.totals.available, ledger.totals.currency)} highlight />
        <Total label={t('owner', 'payoutsPending')} value={formatMoney(ledger.totals.pending, ledger.totals.currency)} />
        <Total label={t('owner', 'payoutsPaid')} value={formatMoney(ledger.totals.paid, ledger.totals.currency)} />
        <Total
          label={t('owner', 'platformFee', { percent: Math.round(commerceConfig.serviceFeeRate * 100) })}
          value={formatMoney(ledger.totals.platformFees, ledger.totals.currency)}
        />
      </dl>

      {ledger.nextPayoutDate ? (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
          <Icon name="calendar" size={15} />
          {t('owner', 'payoutsNextDate', { date: formatDate(ledger.nextPayoutDate, 'medium') })}
        </p>
      ) : null}

      {ledger.rows.length === 0 ? (
        <EmptyState icon="wallet" title={t('owner', 'payoutsEmpty')} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t('owner', 'payoutsTitle')}</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th scope="col" className="p-3 font-semibold">{t('bookings', 'reference', { code: '' }).trim()}</th>
                <th scope="col" className="p-3 font-semibold">{t('navigation', 'listings')}</th>
                <th scope="col" className="p-3 font-semibold">{t('booking', 'tripDate')}</th>
                <th scope="col" className="p-3 text-right font-semibold">{t('owner', 'grossEarnings')}</th>
                <th scope="col" className="p-3 text-right font-semibold">{t('owner', 'platformFee', { percent: Math.round(commerceConfig.serviceFeeRate * 100) })}</th>
                <th scope="col" className="p-3 text-right font-semibold">{t('owner', 'netPayout')}</th>
                <th scope="col" className="p-3 font-semibold">{t('owner', 'listingStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-mono text-xs text-ink-muted">{row.reference}</td>
                  <td className="max-w-[180px] truncate p-3 text-ink">{row.charterTitle}</td>
                  <td className="whitespace-nowrap p-3 text-ink-muted">
                    {row.tripDate ? formatDate(row.tripDate, 'short') : '—'}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums text-ink">
                    {formatMoney(row.gross, row.currency)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right tabular-nums text-ink-muted">
                    − {formatMoney(row.platformFee, row.currency)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-ink">
                    {formatMoney(row.net, row.currency)}
                  </td>
                  <td className="p-3">
                    <Badge tone={row.status === 'paid' ? 'success' : 'neutral'}>
                      {row.status === 'paid' ? t('owner', 'payoutsPaid') : t('owner', 'payoutsPending')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Total({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-card border p-3 ${highlight ? 'border-brand-300 bg-brand-50' : 'border-line bg-white'}`}>
      <dt className="truncate text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-lg font-extrabold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
