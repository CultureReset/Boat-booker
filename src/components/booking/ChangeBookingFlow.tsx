'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Button, Field, Input, Select, Stepper, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import type { ChangeRequestFields } from '@/lib/domain/types';

/**
 * Booking change request — three steps, either party.
 *
 * The step order matters: pick what changes, say why, then look at the diff.
 * The third step exists because a change is the one action in the product where
 * both sides need to agree on *exactly* what moved, and a strikethrough diff
 * communicates that faster than two paragraphs.
 */

export interface ChangeableBooking {
  id: string;
  reference: string;
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  days: number;
  packageId: string;
  currency: string;
  role: 'customer' | 'owner';
  packages: {
    id: string;
    title: string;
    type: 'private' | 'shared';
    capacity: number;
    departureTimes: string[];
  }[];
}

type Step = 0 | 1 | 2;

export function ChangeBookingFlow({ booking }: { booking: ChangeableBooking }) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [date, setDate] = useState(booking.date);
  const [departureTime, setDepartureTime] = useState(booking.departureTime);
  const [adults, setAdults] = useState(booking.adults);
  const [children, setChildren] = useState(booking.children);
  const [days, setDays] = useState(booking.days);
  const [packageId, setPackageId] = useState(booking.packageId);
  const [note, setNote] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ priceChanged: boolean } | null>(null);

  const pkg = booking.packages.find((p) => p.id === packageId);
  const shared = pkg?.type === 'shared';

  const requested = useMemo(() => {
    const diff: Record<string, string | number> = {};
    if (date !== booking.date) diff.date = date;
    if (departureTime !== booking.departureTime) diff.departureTime = departureTime;
    if (adults !== booking.adults) diff.adults = adults;
    if (children !== booking.children) diff.children = children;
    if (days !== booking.days) diff.days = days;
    if (packageId !== booking.packageId) diff.packageId = packageId;
    return diff;
  }, [date, departureTime, adults, children, days, packageId, booking]);

  const hasChanges = Object.keys(requested).length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ needsSupportReview?: boolean; changeRequest?: { priceDifference: number } }>(
        `/api/bookings/${booking.id}`,
        { action: 'request_change', requested, note },
      );
      setSent({ priceChanged: (result.changeRequest?.priceDifference ?? 0) !== 0 });
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const backHref = `${booking.role === 'owner' ? '/owner' : '/account'}/bookings/${booking.id}`;

  if (sent) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <Icon name="check-circle" size={26} />
        </span>
        <h2 className="mt-3 text-lg font-bold text-ink">
          {t('changeBooking', sent.priceChanged ? 'requestSentPriceChanged' : 'requestSentHeading')}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {t(
            'changeBooking',
            sent.priceChanged ? 'requestSentPriceParagraph' : 'requestSentParagraph',
          )}
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-block rounded-control bg-brand-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('changeBooking', 'backToBooking')}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-white">
      <ol className="flex gap-1 border-b border-line p-3">
        {[0, 1, 2].map((index) => (
          <li key={index} className="flex-1">
            <span
              className={cx(
                'block h-1 rounded-full',
                index <= step ? 'bg-brand-600' : 'bg-line',
              )}
            />
          </li>
        ))}
      </ol>

      <div className="space-y-4 p-4">
        {step === 0 ? (
          <>
            <h2 className="text-base font-bold text-ink">{t('changeBooking', 'step1Heading')}</h2>

            <Field label={t('changeBooking', 'labelTripDate')}>
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                />
              )}
            </Field>

            <Field label={t('changeBooking', 'labelTrip')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={packageId}
                  onChange={(e) => {
                    setPackageId(e.target.value);
                    const next = booking.packages.find((p) => p.id === e.target.value);
                    if (next?.departureTimes[0]) setDepartureTime(next.departureTimes[0]);
                  }}
                >
                  {booking.packages.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={t('changeBooking', 'labelDepartureTime')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                >
                  {(pkg?.departureTimes ?? [booking.departureTime]).map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {shared ? (
              <p className="rounded-lg bg-surface-sunken p-3 text-xs text-ink-soft">
                {t('changeBooking', 'sharedTripLocked')}
              </p>
            ) : (
              <div className="divide-y divide-line rounded-lg border border-line px-3">
                <Stepper
                  label={t('pickers', 'adults')}
                  value={adults}
                  min={1}
                  max={pkg?.capacity ?? 20}
                  onChange={setAdults}
                />
                <Stepper
                  label={t('pickers', 'children')}
                  value={children}
                  min={0}
                  max={pkg?.capacity ?? 20}
                  onChange={setChildren}
                />
              </div>
            )}

            <div className="rounded-lg border border-line px-3">
              <Stepper
                label={t('changeBooking', 'labelDays')}
                value={days}
                min={1}
                max={14}
                onChange={setDays}
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="text-base font-bold text-ink">{t('changeBooking', 'step2Heading')}</h2>
            <p className="text-sm text-ink-soft">{t('changeBooking', 'step2Paragraph')}</p>
            <Field label={t('changeBooking', 'noteLabel')} hint={t('changeBooking', 'step2Info')}>
              {({ id }) => (
                <Textarea
                  id={id}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder={t('changeBooking', 'notePlaceholder')}
                />
              )}
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-base font-bold text-ink">{t('changeBooking', 'step3Heading')}</h2>

            <dl className="space-y-2 rounded-lg border border-line p-3">
              <DiffRow
                label={t('changeBooking', 'labelTripDate')}
                from={formatDate(booking.date, 'medium')}
                to={date !== booking.date ? formatDate(date, 'medium') : null}
              />
              <DiffRow
                label={t('changeBooking', 'labelDepartureTime')}
                from={booking.departureTime}
                to={departureTime !== booking.departureTime ? departureTime : null}
              />
              <DiffRow
                label={t('changeBooking', 'labelGroupSize')}
                from={`${booking.adults} + ${booking.children}`}
                to={
                  adults !== booking.adults || children !== booking.children
                    ? `${adults} + ${children}`
                    : null
                }
              />
              <DiffRow
                label={t('changeBooking', 'labelDays')}
                from={String(booking.days)}
                to={days !== booking.days ? String(days) : null}
              />
            </dl>

            <p className="text-sm text-ink-soft">{t('changeBooking', 'step3Info', { hours: '24' })}</p>

            {note ? (
              <p className="rounded-lg bg-surface-sunken p-3 text-sm text-ink-soft">“{note}”</p>
            ) : null}

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
        ) : (
          <Link
            href={backHref}
            className="flex-1 rounded-control border border-line py-2.5 text-center text-sm font-bold text-ink"
          >
            {t('general', 'cancel')}
          </Link>
        )}
        {step < 2 ? (
          <Button
            className="flex-1"
            disabled={step === 0 && !hasChanges}
            onClick={() => setStep((step + 1) as Step)}
          >
            {step === 1 ? t('changeBooking', 'reviewAndSend') : t('general', 'next')}
          </Button>
        ) : (
          <Button className="flex-1" disabled={busy} onClick={submit}>
            {t('changeBooking', 'sendRequest')}
          </Button>
        )}
      </footer>
    </div>
  );
}

/** Old value struck through, new value beside it — only when it moved. */
function DiffRow({ label, from, to }: { label: string; from: string; to: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-sm">
        {to ? (
          <>
            <span className="text-ink-faint line-through">{from}</span>{' '}
            <span className="font-bold text-ink">{to}</span>
          </>
        ) : (
          <span className="text-ink">{from}</span>
        )}
      </dd>
    </div>
  );
}

/** Field keys map to the same labels the request flow used. */
const FIELD_LABEL: Partial<Record<keyof ChangeRequestFields, string>> = {
  date: 'labelTripDate',
  departureTime: 'labelDepartureTime',
  adults: 'labelGroupSize',
  children: 'labelGroupSize',
  days: 'labelDays',
  packageId: 'labelTrip',
};

/**
 * The responder's side: accept, decline, or — if you are the requester —
 * withdraw.
 */
export function ChangeRequestPanel({
  bookingId,
  role,
  request,
  currency,
}: {
  bookingId: string;
  role: 'customer' | 'owner';
  request: {
    id: string;
    requestedBy: 'customer' | 'owner';
    note: string;
    priceDifference: number;
    expiresAt: string;
    original: ChangeRequestFields;
    requested: ChangeRequestFields;
  };
  currency: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRequester = request.requestedBy === role;
  const priceChanged = request.priceDifference !== 0;

  const act = async (action: 'accept_change' | 'decline_change' | 'withdraw_change') => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/bookings/${bookingId}`, { action, changeRequestId: request.id });
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  const hoursLeft = Math.max(
    0,
    Math.round((Date.parse(request.expiresAt) - Date.now()) / 3_600_000),
  );

  return (
    <section className="rounded-card border border-brand-300 bg-brand-50/50 p-4">
      <h2 className="text-sm font-bold text-ink">{t('changeBooking', 'respondHeading')}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {t('changeBooking', role === 'customer' ? 'respondBodyCustomer' : 'respondBodyOwner')}
      </p>

      <dl className="mt-3 space-y-2">
        {(Object.keys(request.requested) as (keyof ChangeRequestFields)[]).map((key) => {
          const value = request.requested[key];
          if (value === undefined) return null;
          return (
            <DiffRow
              key={key}
              label={FIELD_LABEL[key] ? t('changeBooking', FIELD_LABEL[key]) : key}
              from={String(request.original[key] ?? '')}
              to={String(value)}
            />
          );
        })}
      </dl>

      <p className="mt-2 text-sm font-semibold text-ink">
        {priceChanged
          ? `${t('changeBooking', 'priceDifference')}: ${formatMoney(request.priceDifference, currency)}`
          : t('changeBooking', 'noPriceAdjustment')}
      </p>

      {request.note ? (
        <p className="mt-2 rounded-lg bg-white p-3 text-sm text-ink-soft">“{request.note}”</p>
      ) : null}

      <p className="mt-2 text-xs text-ink-muted">
        {t('changeBooking', 'remainingTime', { time: `${hoursLeft} hours` })}
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {isRequester ? (
        <Button
          variant="secondary"
          className="mt-3 w-full"
          disabled={busy}
          onClick={() => act('withdraw_change')}
        >
          {t('changeBooking', 'withdraw')}
        </Button>
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-soft">
            {t(
              'changeBooking',
              priceChanged ? 'acceptWithPriceChange' : 'acceptWithoutPriceChange',
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() => act('decline_change')}
            >
              {t('changeBooking', 'decline')}
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => act('accept_change')}>
              {t('changeBooking', 'accept')}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
