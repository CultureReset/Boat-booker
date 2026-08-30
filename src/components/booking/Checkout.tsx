'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatDuration, formatTime } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { useSession } from '@/components/providers/SessionProvider';
import type { CharterDetail } from '@/lib/services/charters';
import type { PaymentMode, PriceBreakdown, SavedCard } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { Button, Checkbox, Field, Input, PhotoFrame, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { AuthForm } from '@/components/auth/AuthForm';

/**
 * Checkout.
 *
 * A single screen rather than a wizard: the trip is already chosen on the
 * listing page, so everything left — contact details, payment choice, a
 * message to the owner — fits without pagination, and a guest can see the
 * price while they fill it in.
 *
 * The price is re-quoted from the server on every meaningful change and again
 * on submit, so what is charged is always what the server computed, never a
 * number the client sent up.
 */

interface Quote {
  breakdown: PriceBreakdown;
  available: boolean;
  reason?: string;
  freeCancellationUntil: string | null;
  instantBook: boolean;
  loyaltyDiscountPercent: number;
  creditApplied: number;
}

export function Checkout({ charter }: { charter: CharterDetail }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency } = usePreferences();
  const { user, summary, refresh } = useSession();

  const packageId = searchParams.get('trip') ?? '';
  const date = searchParams.get('date') ?? '';
  const departureTime = searchParams.get('time') ?? '';
  const adults = Math.max(1, Number(searchParams.get('adults')) || 1);
  const children = Math.max(0, Number(searchParams.get('children')) || 0);

  const pkg = useMemo(
    () => charter.packages.find((p) => p.id === packageId) ?? null,
    [charter.packages, packageId],
  );

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('online_deposit');
  const [applyCredit, setApplyCredit] = useState(true);
  const [messageToOwner, setMessageToOwner] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [saveCard, setSaveCard] = useState(true);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill contact details from the account once the session resolves.
  useEffect(() => {
    if (!user) return;
    setFirstName((current) => current || user.firstName);
    setLastName((current) => current || user.lastName);
    setEmail((current) => current || user.email);
    setPhone((current) => current || user.phone || '');
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api
      .get<SavedCard[]>('/api/cards')
      .then((result) => {
        setCards(result);
        setSelectedCardId(result.find((c) => c.isDefault)?.id ?? result[0]?.id ?? '');
      })
      .catch(() => {});
  }, [user]);

  // Owners who have not enabled online payments can only be paid on arrival,
  // so the default has to follow what the listing actually supports.
  useEffect(() => {
    const acceptsOnline = charter.policies.acceptedPaymentMethods.some((method) =>
      ['visa', 'master_card', 'american_express', 'paypal'].includes(method),
    );
    if (!acceptsOnline) setPaymentMode('on_arrival');
  }, [charter.policies.acceptedPaymentMethods]);

  // Re-quote on every change that affects price.
  useEffect(() => {
    if (!pkg || !date) return;

    const controller = new AbortController();
    setQuoting(true);
    api
      .post<Quote>(
        '/api/bookings/quote',
        {
          charterId: charter.id,
          packageId: pkg.id,
          date,
          adults,
          children,
          days: 1,
          paymentMode,
          currency,
          applyCredit,
        },
        controller.signal,
      )
      .then((result) => {
        setQuote(result);
        setError(null);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      })
      .finally(() => setQuoting(false));

    return () => controller.abort();
  }, [charter.id, pkg, date, adults, children, paymentMode, currency, applyCredit]);

  const submit = useCallback(async () => {
    if (!pkg || !user) return;

    setSubmitting(true);
    setError(null);
    try {
      const booking = await api.post<{ id: string; reference: string; status: string }>('/api/bookings', {
        charterId: charter.id,
        packageId: pkg.id,
        date,
        departureTime,
        adults,
        children,
        days: 1,
        paymentMode,
        currency,
        applyCredit,
        paymentMethodId: paymentMode === 'on_arrival' ? undefined : selectedCardId || undefined,
        messageToOwner: messageToOwner.trim() || undefined,
        contact: { firstName, lastName, email, phone },
      });

      await refresh();
      router.push(`/book/confirmation/${booking.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }, [
    charter.id, pkg, date, departureTime, adults, children, paymentMode, currency, applyCredit,
    selectedCardId, messageToOwner, firstName, lastName, email, phone, user, refresh, router,
  ]);

  if (!pkg) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-ink">{t('errors', 'notFoundTitle')}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t('booking', 'errorUnavailable')}</p>
        <Button className="mt-4" onClick={() => router.push(`/charters/view/${charter.id}`)}>
          {t('search', 'changeSearch')}
        </Button>
      </div>
    );
  }

  const guests = adults + children;
  const duration = formatDuration(pkg.hours);
  const contactValid = firstName.trim() && lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const cardValid =
    paymentMode === 'on_arrival' ||
    Boolean(selectedCardId) ||
    (cardNumber.replace(/\D/g, '').length >= 13 && /^\d{2}\/\d{2}$/.test(cardExpiry) && cardCvc.length >= 3);

  const canSubmit = Boolean(user) && contactValid && cardValid && quote?.available && !quoting;

  const summaryCard = (
    <aside className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex gap-3">
        <PhotoFrame photo={charter.photos[0] ?? null} rounded="rounded-lg" className="h-20 w-24 shrink-0" />
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-sm font-bold text-ink">{charter.title}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{charter.approximateAddress}</p>
          {charter.reviewStatistics.reviewCount > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
              <Icon name="star" size={11} className="text-gold" strokeWidth={0} />
              {charter.reviewStatistics.rating.toFixed(1)} ({charter.reviewStatistics.reviewCount})
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <Row label={t('packageCard', 'tripDetails')} value={pkg.title} />
        <Row label={t('booking', 'tripDate')} value={formatDate(date, 'long')} />
        {departureTime ? <Row label={t('booking', 'tripTime')} value={formatTime(departureTime)} /> : null}
        <Row
          label={t('booking', 'tripDuration')}
          value={t('packageCard', duration.unit === 'hour' ? 'duration' : 'durationDays', {
            count: duration.count,
            p: duration.count,
          })}
        />
        <Row
          label={t('booking', 'guests')}
          value={`${adults} ${adults === 1 ? 'adult' : 'adults'}${children ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''}`}
        />
      </dl>

      <Link
        href={`/charters/view/${charter.id}?date=${date}&adults=${adults}&children=${children}`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="edit" size={14} />
        {t('booking', 'editTrip')}
      </Link>

      {/* ------------------------------------------------ price details */}
      <div className="mt-4 border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-bold text-ink">{t('booking', 'priceDetails')}</h3>

        {quoting && !quote ? (
          <div className="skeleton h-24 w-full rounded" />
        ) : quote ? (
          <>
            <ul className="space-y-1.5">
              {quote.breakdown.lines
                .filter((line) => !line.informational)
                .map((line) => (
                  <li key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={line.amount < 0 ? 'text-success' : 'text-ink-soft'}>
                      {priceLineLabel(line.key)}
                    </span>
                    <span
                      className={cx(
                        'shrink-0 tabular-nums',
                        line.amount < 0 ? 'font-semibold text-success' : 'text-ink',
                      )}
                    >
                      {line.amount < 0 ? '−' : ''}
                      {money(Math.abs(line.amount), quote.breakdown.currency)}
                    </span>
                  </li>
                ))}
            </ul>

            <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <span className="text-sm font-bold text-ink">{t('packageCard', 'total')}</span>
              <span className="text-lg font-extrabold tabular-nums text-ink">
                {money(quote.breakdown.total, quote.breakdown.currency)}
              </span>
            </div>

            {quote.breakdown.dueOnArrival > 0 ? (
              <dl className="mt-2 space-y-1 rounded-control bg-surface-sunken p-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="font-semibold text-ink">{t('packageCard', 'dueNow')}</dt>
                  <dd className="tabular-nums text-ink">
                    {money(quote.breakdown.dueNow, quote.breakdown.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-muted">{t('packageCard', 'dueOnArrival')}</dt>
                  <dd className="tabular-nums text-ink-muted">
                    {money(quote.breakdown.dueOnArrival, quote.breakdown.currency)}
                  </dd>
                </div>
              </dl>
            ) : null}

            {quote.breakdown.securityDeposit > 0 ? (
              <p className="mt-2 text-[11px] text-ink-muted">
                {t('viewCharter', 'securityDepositNotice', {
                  amount: money(quote.breakdown.securityDeposit, quote.breakdown.currency),
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* ------------------------------------------- cancellation terms */}
      <div className="mt-4 border-t border-line pt-4">
        <h3 className="mb-1.5 text-sm font-bold text-ink">{t('booking', 'cancellationTitle')}</h3>
        <p className="text-xs leading-relaxed text-ink-muted">
          {charter.policies.freeCancellationDaysInAdvance > 0
            ? t('viewCharter', 'cancellationDaysNotice', {
                count: charter.policies.freeCancellationDaysInAdvance,
                p: charter.policies.freeCancellationDaysInAdvance,
              })
            : t('viewCharter', 'cancellationDepositNonRefundable')}
        </p>
      </div>
    </aside>
  );

  return (
    <div className="mx-auto max-w-shell px-4 py-5 pb-28 lg:pb-8">
      <h1 className="mb-1 text-xl font-extrabold text-ink md:text-2xl">
        {quote?.instantBook ? t('booking', 'title') : t('booking', 'requestTitle')}
      </h1>
      <p className="mb-5 text-sm text-ink-muted">
        {quote?.instantBook
          ? t('booking', 'instantConfirmNotice')
          : t('booking', 'requestNotice', { hours: commerceConfig.inquiryResponseWindowHours })}
      </p>

      {error ? (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-control bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* ------------------------------------------------- sign in */}
          {!user ? (
            <section className="rounded-card border border-line bg-white p-4">
              <h2 className="mb-1 text-base font-bold text-ink">{t('booking', 'loginToBook')}</h2>
              <p className="mb-4 text-sm text-ink-muted">{t('booking', 'loginToBookBody')}</p>
              {/* The whole selection lives in the URL, so signing in here
                  returns to exactly this checkout with nothing lost. */}
              <AuthForm compact onSuccess={() => refresh()} />
            </section>
          ) : (
            <>
              {/* ------------------------------------------- contact */}
              <section className="rounded-card border border-line bg-white p-4">
                <h2 className="mb-1 text-base font-bold text-ink">{t('booking', 'contactDetails')}</h2>
                <p className="mb-4 text-sm text-ink-muted">{t('booking', 'contactDetailsBody')}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('login', 'firstName')} required>
                    {({ id }) => (
                      <Input id={id} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                    )}
                  </Field>
                  <Field label={t('login', 'lastName')} required>
                    {({ id }) => (
                      <Input id={id} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                    )}
                  </Field>
                  <Field label={t('login', 'email')} required>
                    {({ id }) => (
                      <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                    )}
                  </Field>
                  <Field label={t('login', 'phone')}>
                    {({ id }) => (
                      <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                    )}
                  </Field>
                </div>
              </section>

              {/* ------------------------------------------- payment */}
              <section className="rounded-card border border-line bg-white p-4">
                <h2 className="mb-3 text-base font-bold text-ink">{t('booking', 'payWith')}</h2>

                <div className="space-y-2">
                  <PaymentOption
                    selected={paymentMode === 'online_full'}
                    onSelect={() => setPaymentMode('online_full')}
                    icon="card"
                    title={t('booking', 'payOnline')}
                    body={t('search', 'bestPriceGuaranteed')}
                  />
                  <PaymentOption
                    selected={paymentMode === 'online_deposit'}
                    onSelect={() => setPaymentMode('online_deposit')}
                    icon="wallet"
                    title={t('booking', 'payDeposit')}
                    body={t('packageCard', 'depositDueNow', { percent: charter.policies.depositPercent })}
                  />
                  <PaymentOption
                    selected={paymentMode === 'on_arrival'}
                    onSelect={() => setPaymentMode('on_arrival')}
                    icon="tag"
                    title={t('booking', 'payOnArrival')}
                    body={t('packageCard', 'dueOnArrival')}
                  />
                </div>

                {paymentMode !== 'on_arrival' ? (
                  <div className="mt-4 border-t border-line pt-4">
                    {cards.length ? (
                      <>
                        <h3 className="mb-2 text-sm font-bold text-ink">{t('booking', 'savedCards')}</h3>
                        <div className="space-y-2">
                          {cards.map((card) => (
                            <label
                              key={card.id}
                              className={cx(
                                'flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors',
                                selectedCardId === card.id ? 'border-brand-600 bg-brand-50/50' : 'border-line',
                              )}
                            >
                              <input
                                type="radio"
                                name="card"
                                checked={selectedCardId === card.id}
                                onChange={() => setSelectedCardId(card.id)}
                                className="h-4 w-4 border-line text-brand-600"
                              />
                              <Icon name="card" size={18} className="text-ink-muted" />
                              <span className="flex-1 text-sm text-ink">
                                {t('account', 'cardEndingIn', { brand: card.brand, last4: card.last4 })}
                              </span>
                              <span className="text-xs text-ink-muted">
                                {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                              </span>
                            </label>
                          ))}

                          <label
                            className={cx(
                              'flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors',
                              selectedCardId === '' ? 'border-brand-600 bg-brand-50/50' : 'border-line',
                            )}
                          >
                            <input
                              type="radio"
                              name="card"
                              checked={selectedCardId === ''}
                              onChange={() => setSelectedCardId('')}
                              className="h-4 w-4 border-line text-brand-600"
                            />
                            <Icon name="plus" size={18} className="text-ink-muted" />
                            <span className="text-sm text-ink">{t('booking', 'useNewCard')}</span>
                          </label>
                        </div>
                      </>
                    ) : null}

                    {!selectedCardId ? (
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Field label={t('booking', 'cardNumber')} required className="sm:col-span-2">
                          {({ id }) => (
                            <Input
                              id={id}
                              inputMode="numeric"
                              autoComplete="cc-number"
                              placeholder="4242 4242 4242 4242"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                              maxLength={23}
                            />
                          )}
                        </Field>
                        <Field label={t('booking', 'cardExpiry')} required>
                          {({ id }) => (
                            <Input
                              id={id}
                              inputMode="numeric"
                              autoComplete="cc-exp"
                              placeholder="MM/YY"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                              maxLength={5}
                            />
                          )}
                        </Field>
                        <Field label={t('booking', 'cardCvc')} required>
                          {({ id }) => (
                            <Input
                              id={id}
                              inputMode="numeric"
                              autoComplete="cc-csc"
                              placeholder="123"
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              maxLength={4}
                            />
                          )}
                        </Field>
                        <div className="sm:col-span-2">
                          <Checkbox
                            label={t('booking', 'saveCard')}
                            checked={saveCard}
                            onChange={(e) => setSaveCard(e.target.checked)}
                          />
                        </div>
                      </div>
                    ) : null}

                    <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
                      <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
                      Card details are validated and only the last four digits are stored.
                    </p>
                  </div>
                ) : null}

                {/* Credit and loyalty */}
                {summary && summary.creditBalance > 0 ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <Checkbox
                      label={t('booking', 'creditApplied')}
                      description={t('account', 'creditBalance') + `: ${money(summary.creditBalance, currency)}`}
                      checked={applyCredit}
                      onChange={(e) => setApplyCredit(e.target.checked)}
                    />
                  </div>
                ) : null}

                {quote && quote.loyaltyDiscountPercent > 0 ? (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-success">
                    <Icon name="tag" size={15} />
                    {t('booking', 'loyaltyApplied', { percent: quote.loyaltyDiscountPercent })}
                  </p>
                ) : null}
              </section>

              {/* -------------------------------------- message owner */}
              <section className="rounded-card border border-line bg-white p-4">
                <h2 className="mb-1 text-base font-bold text-ink">
                  {t('booking', 'messageToOwner')}{' '}
                  <span className="text-sm font-normal text-ink-faint">({t('general', 'optional')})</span>
                </h2>
                <Textarea
                  value={messageToOwner}
                  onChange={(e) => setMessageToOwner(e.target.value)}
                  rows={4}
                  placeholder={t('booking', 'messageToOwnerPlaceholder')}
                  aria-label={t('booking', 'messageToOwner')}
                />
              </section>
            </>
          )}
        </div>

        {/* --------------------------------------------------- summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          {summaryCard}

          <div className="mt-4 hidden lg:block">
            <Button
              size="lg"
              fullWidth
              onClick={submit}
              loading={submitting}
              disabled={!canSubmit}
            >
              {quote?.instantBook
                ? t('booking', 'agreeAndBook', {
                    amount: quote ? money(quote.breakdown.dueNow, quote.breakdown.currency) : '',
                  })
                : t('booking', 'agreeAndRequest')}
            </Button>
            {!quote?.available && quote ? (
              <p role="alert" className="mt-2 text-center text-sm text-danger">
                {t('booking', 'errorUnavailable')}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------- mobile action */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 shadow-bar safe-bottom lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-ink">
              {quote ? money(quote.breakdown.dueNow || quote.breakdown.total, quote.breakdown.currency) : '—'}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {quote && quote.breakdown.dueOnArrival > 0
                ? t('packageCard', 'dueNow')
                : t('packageCard', 'total')}
              {' · '}
              {guests} {guests === 1 ? 'guest' : 'guests'}
            </p>
          </div>
          <Button size="lg" onClick={submit} loading={submitting} disabled={!canSubmit} className="shrink-0">
            {quote?.instantBook ? t('packageCard', 'bookNow') : t('availabilityForm', 'requestToBook')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function PaymentOption({
  selected,
  onSelect,
  icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
        selected ? 'border-brand-600 bg-brand-50/50' : 'border-line hover:border-ink-faint',
      )}
    >
      <input
        type="radio"
        name="payment_mode"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 border-line text-brand-600 focus:ring-2 focus:ring-brand-500/40"
      />
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-ink-muted" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{body}</span>
      </span>
    </label>
  );
}

function priceLineLabel(key: string): string {
  const map: Record<string, string> = {
    base: t('packageCard', 'tripPrice'),
    additional_guests: t('packageCard', 'additionalGuests', { count: '' }).replace(' ()', ''),
    service_fee: t('packageCard', 'serviceFee'),
    processing_fee: t('packageCard', 'processingFee'),
    loyalty: t('packageCard', 'youSave', { amount: '' }).trim(),
    promo: t('booking', 'promoApplied'),
    credit: t('booking', 'creditApplied'),
  };
  return map[key] ?? key;
}

function money(amount: number, currencyCode: string): string {
  const digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
  return currencyCode === 'USD' ? `US $${digits}` : `${digits} ${currencyCode}`;
}

/** Group a card number into fours as it is typed. */
function formatCardNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
}

/** Insert the slash in an MM/YY expiry as the user types. */
function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
