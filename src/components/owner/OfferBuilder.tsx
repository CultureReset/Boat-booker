'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Input, Select, Stepper, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Custom offer builder.
 *
 * Four steps, in the order the real product uses: confirm the date is actually
 * free, decide what the trip is, name a price, then look at it once before it
 * goes out. Availability comes first on purpose — every later decision is
 * wasted work if the boat is already booked that day.
 */

export interface OfferPackage {
  id: string;
  title: string;
  hours: number;
  price: number;
  currency: string;
  capacity: number;
  departureTimes: string[];
}

export interface OfferContext {
  threadId: string;
  customerName: string;
  charterId: string;
  charterTitle: string;
  currency: string;
  capacity: number;
  packages: OfferPackage[];
  /** Dates already taken, so the picker can refuse them before the server does. */
  blockedDates: string[];
}

type Step = 0 | 1 | 2 | 3;

const STEP_KEYS = ['stepAvailability', 'stepTripDetails', 'stepPrice', 'stepReview'] as const;

export function OfferBuilder({ context }: { context: OfferContext }) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [date, setDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [days, setDays] = useState(1);

  const [mode, setMode] = useState<'existing' | 'custom'>('existing');
  const [packageId, setPackageId] = useState(context.packages[0]?.id ?? '');
  const [departureTime, setDepartureTime] = useState(context.packages[0]?.departureTimes[0] ?? '08:00');
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customHours, setCustomHours] = useState(4);

  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const guests = adults + children;
  const selectedPackage = context.packages.find((p) => p.id === packageId);
  const dateBlocked = date !== '' && context.blockedDates.includes(date);
  const overCapacity = guests > context.capacity;

  const standardPrice = useMemo(() => {
    if (mode === 'custom' || !selectedPackage) return 0;
    return selectedPackage.price * days;
  }, [mode, selectedPackage, days]);

  const price = useCustomPrice || mode === 'custom' ? Number(customPrice) || 0 : standardPrice;
  const commission = Math.round(price * commerceConfig.serviceFeeRate * 100) / 100;
  const earnings = Math.round((price - commission) * 100) / 100;

  const canAdvance = (from: Step): boolean => {
    if (from === 0) return Boolean(date) && !dateBlocked && !overCapacity;
    if (from === 1) {
      return mode === 'existing'
        ? Boolean(packageId) && Boolean(departureTime)
        : customTitle.trim().length > 1 && customHours > 0;
    }
    if (from === 2) return price > 0;
    return true;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/offers', {
        threadId: context.threadId,
        packageId: mode === 'existing' ? packageId : null,
        customTrip:
          mode === 'custom'
            ? { title: customTitle.trim(), description: customDescription.trim(), hours: customHours }
            : undefined,
        date,
        departureTime,
        adults,
        children,
        days,
        price,
      });
      setSent(true);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <Icon name="check-circle" size={26} />
        </span>
        <h2 className="mt-3 text-lg font-bold text-ink">{t('offers', 'offerSentTitle')}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {t('offers', 'offerSentBody', { name: context.customerName, hours: '48' })}
        </p>
        <Link
          href={`/owner/inbox/${context.threadId}`}
          className="mt-4 inline-block rounded-control bg-brand-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('offers', 'goToInbox')}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-white">
      {/* Step rail — horizontal and scrollable so four steps fit a phone. */}
      <ol className="flex gap-1 overflow-x-auto border-b border-line p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEP_KEYS.map((key, index) => (
          <li key={key} className="shrink-0">
            <button
              type="button"
              // Only backwards: skipping ahead past an unmet requirement would
              // build an offer that cannot be sent.
              disabled={index > step}
              onClick={() => setStep(index as Step)}
              className={cx(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                index === step
                  ? 'bg-brand-600 text-white'
                  : index < step
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-faint',
              )}
            >
              {index + 1}. {t('offers', key)}
            </button>
          </li>
        ))}
      </ol>

      <div className="space-y-4 p-4">
        {step === 0 ? (
          <>
            <p className="text-sm text-ink-soft">{t('offers', 'availabilityDescription')}</p>

            <Field label={t('booking', 'tripDate')}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  invalid={invalid || dateBlocked}
                />
              )}
            </Field>
            {dateBlocked ? (
              <p className="text-xs font-semibold text-danger">{t('offers', 'dateNotAvailable')}</p>
            ) : null}

            <div className="divide-y divide-line rounded-lg border border-line px-3">
              <Stepper
                label={t('pickers', 'adults')}
                value={adults}
                min={1}
                max={context.capacity}
                onChange={setAdults}
              />
              <Stepper
                label={t('pickers', 'children')}
                value={children}
                min={0}
                max={context.capacity}
                onChange={setChildren}
              />
            </div>
            {overCapacity ? (
              <p className="text-xs font-semibold text-danger">{t('offers', 'groupTooLarge')}</p>
            ) : null}

            <div className="rounded-lg border border-line px-3">
              <Stepper label={t('pickers', 'days')} value={days} min={1} max={14} onChange={setDays} />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeCard
                active={mode === 'existing'}
                onClick={() => setMode('existing')}
                title={t('offers', 'tripPackage')}
                body={t('offers', 'existingTripDescription')}
                disabled={context.packages.length === 0}
              />
              <ModeCard
                active={mode === 'custom'}
                onClick={() => setMode('custom')}
                title={t('offers', 'newCustomTrip')}
                body={t('offers', 'customTripDescription')}
              />
            </div>

            {mode === 'existing' ? (
              context.packages.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('offers', 'noTripsAvailable')}</p>
              ) : (
                <>
                  <Field label={t('offers', 'selectTrip')}>
                    {({ id }) => (
                      <Select
                        id={id}
                        value={packageId}
                        onChange={(e) => {
                          setPackageId(e.target.value);
                          const next = context.packages.find((p) => p.id === e.target.value);
                          if (next?.departureTimes[0]) setDepartureTime(next.departureTimes[0]);
                        }}
                      >
                        {context.packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.title} · {pkg.hours}h · {formatMoney(pkg.price, pkg.currency)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  <Field label={t('offers', 'departureTime')}>
                    {({ id }) => (
                      <Select
                        id={id}
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                      >
                        {(selectedPackage?.departureTimes ?? []).map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </>
              )
            ) : (
              <>
                <Field label={t('offers', 'tripName')}>
                  {({ id }) => (
                    <Input
                      id={id}
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={t('offers', 'tripNamePlaceholder')}
                    />
                  )}
                </Field>
                <Field label={t('offers', 'tripDescription')}>
                  {({ id }) => (
                    <Textarea
                      id={id}
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      rows={3}
                      placeholder={t('offers', 'tripDescriptionPlaceholder')}
                    />
                  )}
                </Field>
                <div className="rounded-lg border border-line px-3">
                  <Stepper
                    label={t('offers', 'tripDuration')}
                    value={customHours}
                    min={1}
                    max={24}
                    onChange={setCustomHours}
                  />
                </div>
                <Field label={t('offers', 'departureTime')}>
                  {({ id }) => (
                    <Input
                      id={id}
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                    />
                  )}
                </Field>
              </>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-sm text-ink-soft">
              {t('offers', mode === 'custom' ? 'priceDescriptionNew' : 'priceDescriptionExisting')}
            </p>

            {mode === 'existing' && selectedPackage ? (
              <div className="space-y-2">
                <ModeCard
                  active={!useCustomPrice}
                  onClick={() => setUseCustomPrice(false)}
                  title={t('offers', 'useStandardPrice', {
                    price: formatMoney(standardPrice, context.currency),
                  })}
                  body=""
                />
                <ModeCard
                  active={useCustomPrice}
                  onClick={() => setUseCustomPrice(true)}
                  title={t('offers', 'setCustomPrice')}
                  body={t('offers', 'customPriceDescription')}
                />
              </div>
            ) : null}

            {useCustomPrice || mode === 'custom' ? (
              <Field label={t('offers', 'pricePerTrip')}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder={t('offers', 'pricePerTripPlaceholder')}
                  />
                )}
              </Field>
            ) : null}

            {price > 0 ? (
              <dl className="space-y-1.5 rounded-lg bg-surface-sunken p-3 text-sm">
                <SummaryRow
                  label={t('offers', 'pricePerTrip')}
                  value={formatMoney(price, context.currency)}
                />
                <SummaryRow
                  label={t('offers', 'commission', {
                    percent: String(Math.round(commerceConfig.serviceFeeRate * 100)),
                  })}
                  value={`−${formatMoney(commission, context.currency)}`}
                />
                <SummaryRow
                  label={t('offers', 'yourEarnings')}
                  value={formatMoney(earnings, context.currency)}
                  strong
                />
              </dl>
            ) : (
              <p className="text-xs text-ink-muted">{t('offers', 'priceMustBePositive')}</p>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-sm text-ink-soft">{t('offers', 'reviewDescription')}</p>

            <section className="rounded-lg border border-line p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {t('offers', 'tripDetailsTitle')}
              </h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                <SummaryRow label={t('offers', 'selectListing')} value={context.charterTitle} />
                <SummaryRow
                  label={t('offers', 'tripName')}
                  value={mode === 'custom' ? customTitle : (selectedPackage?.title ?? '')}
                />
                <SummaryRow label={t('booking', 'tripDate')} value={formatDate(date, 'medium')} />
                <SummaryRow label={t('offers', 'departureTime')} value={departureTime} />
                <SummaryRow label={t('offers', 'groupSize')} value={`${adults} + ${children}`} />
                <SummaryRow
                  label={t('offers', 'tripDuration')}
                  value={`${mode === 'custom' ? customHours : (selectedPackage?.hours ?? 0)}h`}
                />
              </dl>
            </section>

            <section className="rounded-lg border border-line p-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {t('offers', 'priceDetailsTitle')}
              </h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                <SummaryRow
                  label={t('offers', 'pricePerTrip')}
                  value={formatMoney(price, context.currency)}
                />
                <SummaryRow
                  label={t('offers', 'yourEarnings')}
                  value={formatMoney(earnings, context.currency)}
                  strong
                />
              </dl>
            </section>

            {error ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <footer className="flex gap-2 border-t border-line p-3 safe-bottom">
        {step > 0 ? (
          <Button variant="secondary" className="flex-1" onClick={() => setStep((step - 1) as Step)}>
            {t('general', 'back')}
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            className="flex-1"
            disabled={!canAdvance(step)}
            onClick={() => setStep((step + 1) as Step)}
          >
            {t('general', 'next')}
          </Button>
        ) : (
          <Button className="flex-1" disabled={busy || price <= 0} onClick={submit}>
            {busy ? t('offers', 'sending') : t('offers', 'sendOffer')}
          </Button>
        )}
      </footer>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  body,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'w-full rounded-lg border p-3 text-left transition-colors disabled:opacity-50',
        active ? 'border-brand-600 bg-brand-50' : 'border-line hover:bg-surface-sunken',
      )}
    >
      <span className="block text-sm font-bold text-ink">{title}</span>
      {body ? <span className="mt-0.5 block text-xs text-ink-muted">{body}</span> : null}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cx('text-right', strong ? 'font-bold text-success' : 'text-ink')}>{value}</dd>
    </div>
  );
}
