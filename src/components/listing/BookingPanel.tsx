'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate, formatDuration, formatTime, today } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { usePreferences } from '@/components/providers/PreferencesProvider';
import { useSession } from '@/components/providers/SessionProvider';
import type { CharterDetail } from '@/lib/services/charters';
import type { PriceBreakdown } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Stepper } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import { DatePicker, type DayState } from '@/components/search/DatePicker';

/**
 * Booking panel.
 *
 * The commercial heart of the listing page: pick a trip, a date, a group size,
 * see the real price, and go to checkout. It is a sticky sidebar on desktop and
 * a fixed bottom bar that expands into a sheet on mobile — the same split the
 * native app uses, because a phone cannot spare the vertical space for a
 * permanently open panel.
 *
 * Every price shown here comes from `/api/bookings/quote`, the same endpoint
 * checkout uses, so the number never changes between here and payment.
 */

export interface BookingPanelProps {
  charter: CharterDetail;
  initialDate?: string;
  initialAdults: number;
  initialChildren: number;
}

interface Quote {
  breakdown: PriceBreakdown;
  available: boolean;
  reason?: string;
  freeCancellationUntil: string | null;
  instantBook: boolean;
  loyaltyDiscountPercent: number;
  creditApplied: number;
}

export function BookingPanel({ charter, initialDate, initialAdults, initialChildren }: BookingPanelProps) {
  const router = useRouter();
  const { currency } = usePreferences();
  const { user } = useSession();

  const bookablePackages = useMemo(() => charter.packages.filter((p) => p.active), [charter.packages]);

  const [packageId, setPackageId] = useState(() => {
    // Default to the cheapest trip that can actually take the party.
    const guests = initialAdults + initialChildren;
    const fits = bookablePackages.filter((p) => p.capacity >= guests);
    return (fits[0] ?? bookablePackages[0])?.id ?? '';
  });
  const [date, setDate] = useState<string | undefined>(initialDate);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [departureTime, setDepartureTime] = useState<string>('');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [calendar, setCalendar] = useState<Record<string, DayState>>({});

  const selectedPackage = bookablePackages.find((p) => p.id === packageId) ?? null;
  const guests = adults + children;

  // Keep the departure time valid whenever the trip changes.
  useEffect(() => {
    if (!selectedPackage) return;
    if (!selectedPackage.departureTimes.includes(departureTime)) {
      setDepartureTime(selectedPackage.departureTimes[0] ?? '');
    }
  }, [selectedPackage, departureTime]);

  // Load the availability calendar once, for the date picker's colouring.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ days: { date: string; state: DayState }[] }>(
        `/api/charters/${charter.id}/availability?days=180&guests=${guests}`,
        controller.signal,
      )
      .then((result) => {
        setCalendar(Object.fromEntries(result.days.map((day) => [day.date, day.state])));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [charter.id, guests]);

  // Re-quote whenever any input changes. Debounced so dragging the guest
  // stepper does not fire a request per click.
  useEffect(() => {
    if (!selectedPackage || !date) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setQuoting(true);
      setQuoteError(null);
      api
        .post<Quote>(
          '/api/bookings/quote',
          {
            charterId: charter.id,
            packageId: selectedPackage.id,
            date,
            adults,
            children,
            days: 1,
            paymentMode: 'online_deposit',
            currency,
            applyCredit: true,
          },
          controller.signal,
        )
        .then(setQuote)
        .catch((caught) => {
          if (controller.signal.aborted) return;
          setQuoteError(errorMessage(caught));
          setQuote(null);
        })
        .finally(() => setQuoting(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [charter.id, selectedPackage, date, adults, children, currency]);

  const goToCheckout = useCallback(() => {
    if (!selectedPackage || !date) {
      setDateOpen(true);
      return;
    }
    const params = new URLSearchParams({
      charter: charter.id,
      trip: selectedPackage.id,
      date,
      time: departureTime,
      adults: String(adults),
      children: String(children),
    });
    router.push(`/book?${params.toString()}`);
  }, [charter.id, selectedPackage, date, departureTime, adults, children, router]);

  const fromPrice = charter.minPrice?.displayValue;
  const totalLabel = quote ? formatMoneyValue(quote.breakdown.total, quote.breakdown.currency) : fromPrice;

  const capacityExceeded = selectedPackage ? guests > selectedPackage.capacity : false;
  const belowMinimum = selectedPackage ? guests < selectedPackage.minPersons : false;

  const panelBody = (
    <div className="space-y-4">
      {/* ------------------------------------------------------- trips */}
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">{t('viewCharter', 'selectTrip')}</legend>
        <div className="space-y-2">
          {bookablePackages.map((pkg) => {
            const duration = formatDuration(pkg.hours);
            const unavailable = pkg.availability && !pkg.availability.available;
            const selected = pkg.id === packageId;

            return (
              <label
                key={pkg.id}
                className={cx(
                  'flex cursor-pointer gap-3 rounded-control border p-3 transition-colors',
                  selected ? 'border-brand-600 bg-brand-50/50' : 'border-line hover:border-ink-faint',
                  unavailable && 'opacity-60',
                )}
              >
                <input
                  type="radio"
                  name="trip"
                  value={pkg.id}
                  checked={selected}
                  onChange={() => setPackageId(pkg.id)}
                  className="mt-1 h-4 w-4 shrink-0 border-line text-brand-600 focus:ring-2 focus:ring-brand-500/40"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{pkg.title}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-extrabold text-ink">
                        {formatMoneyValue(pkg.price, pkg.currency)}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        {pkg.type === 'shared' ? t('listingCard', 'perPerson') : t('packageCard', 'privateCharter')}
                      </span>
                    </span>
                  </span>

                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <Icon name="clock" size={12} />
                      {t('packageCard', duration.unit === 'hour' ? 'duration' : 'durationDays', {
                        count: duration.count,
                        p: duration.count,
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="users" size={12} />
                      {t('listingCard', 'capacity', { count: pkg.capacity, p: pkg.capacity })}
                    </span>
                    {pkg.departureTimes.length ? (
                      <span className="flex items-center gap-1">
                        <Icon name="calendar" size={12} />
                        {pkg.departureTimes.map(formatTime).join(', ')}
                      </span>
                    ) : null}
                  </span>

                  {pkg.type === 'shared' ? (
                    <span className="mt-1 block text-[11px] text-ink-muted">
                      {t('packageCard', 'sharedTripDescription', { p: pkg.capacity })}
                    </span>
                  ) : pkg.additionalPersonAfter && pkg.additionalPersonPrice ? (
                    <span className="mt-1 block text-[11px] text-ink-muted">
                      {t('packageCard', 'basePriceFor', {
                        count: pkg.additionalPersonAfter,
                        p: pkg.additionalPersonAfter,
                      })}{' '}
                      {t('packageCard', 'additionalPersonPricing', {
                        price: formatMoneyValue(pkg.additionalPersonPrice, pkg.currency),
                      })}
                    </span>
                  ) : null}

                  {unavailable ? (
                    <span className="mt-1.5 block">
                      <Badge tone="danger">{reasonLabel(pkg.availability?.reason)}</Badge>
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* ------------------------------------------------ date + guests */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          className="rounded-control border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {t('availabilityForm', 'date')}
          </span>
          <span className={cx('block truncate text-sm', date ? 'font-semibold text-ink' : 'text-ink-faint')}>
            {date ? formatDate(date, 'medium') : t('viewCharter', 'selectDate')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setGuestsOpen(true)}
          className="rounded-control border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken"
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {t('availabilityForm', 'guests')}
          </span>
          <span className="block truncate text-sm font-semibold text-ink">
            {adults + children} {adults + children === 1 ? 'guest' : 'guests'}
          </span>
        </button>
      </div>

      {/* Departure time, only when the trip runs more than one */}
      {selectedPackage && selectedPackage.departureTimes.length > 1 ? (
        <div>
          <span className="mb-1.5 block text-sm font-bold text-ink">{t('availabilityForm', 'trip')}</span>
          <div className="flex flex-wrap gap-2">
            {selectedPackage.departureTimes.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setDepartureTime(time)}
                className={cx(
                  'h-9 rounded-control border px-3 text-sm font-semibold transition-colors',
                  departureTime === time
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-line text-ink hover:bg-surface-sunken',
                )}
              >
                {formatTime(time)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------- quote */}
      {capacityExceeded ? (
        <Message tone="error" text={t('packageCard', 'capacityExceeded')} />
      ) : belowMinimum && selectedPackage ? (
        <Message
          tone="warning"
          text={t('packageCard', 'addMorePersons', {
            count: selectedPackage.minPersons - guests,
            p: selectedPackage.minPersons - guests,
          })}
        />
      ) : !date ? (
        <Message tone="info" text={t('availabilityForm', 'selectDatePrompt')} />
      ) : quoteError ? (
        <Message tone="error" text={quoteError} />
      ) : quote && !quote.available ? (
        <Message tone="error" text={reasonLabel(quote.reason)} />
      ) : quote ? (
        <div className="rounded-control border border-line bg-surface-sunken p-3">
          <ul className="space-y-1.5">
            {quote.breakdown.lines
              .filter((line) => !line.informational)
              .map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={cx(line.amount < 0 ? 'text-success' : 'text-ink-soft')}>
                    {lineLabel(line.label, line.key)}
                  </span>
                  <span
                    className={cx(
                      'shrink-0 tabular-nums',
                      line.amount < 0 ? 'font-semibold text-success' : 'text-ink',
                    )}
                  >
                    {line.amount < 0 ? '−' : ''}
                    {formatMoneyValue(Math.abs(line.amount), quote.breakdown.currency)}
                  </span>
                </li>
              ))}
          </ul>

          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-2">
            <span className="text-sm font-bold text-ink">{t('packageCard', 'total')}</span>
            <span className="text-lg font-extrabold tabular-nums text-ink">
              {formatMoneyValue(quote.breakdown.total, quote.breakdown.currency)}
            </span>
          </div>

          {quote.breakdown.dueOnArrival > 0 ? (
            <p className="mt-1 flex items-baseline justify-between gap-3 text-xs text-ink-muted">
              <span>{t('packageCard', 'dueNow')}</span>
              <span className="tabular-nums">
                {formatMoneyValue(quote.breakdown.dueNow, quote.breakdown.currency)}
              </span>
            </p>
          ) : null}

          {quote.breakdown.securityDeposit > 0 ? (
            <p className="mt-2 border-t border-line pt-2 text-[11px] text-ink-muted">
              {t('viewCharter', 'securityDepositNotice', {
                amount: formatMoneyValue(quote.breakdown.securityDeposit, quote.breakdown.currency),
              })}
            </p>
          ) : null}
        </div>
      ) : quoting ? (
        <div className="skeleton h-28 w-full rounded-control" />
      ) : null}

      {/* ------------------------------------------------------- action */}
      <Button
        size="lg"
        fullWidth
        onClick={goToCheckout}
        loading={quoting}
        disabled={Boolean(date) && (capacityExceeded || belowMinimum || (quote ? !quote.available : false))}
        icon={quote?.instantBook ? 'bolt' : undefined}
      >
        {!date
          ? t('viewCharter', 'checkAvailability')
          : quote?.instantBook
            ? t('availabilityForm', 'instantBookCta')
            : t('availabilityForm', 'requestToBook')}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        {quote?.freeCancellationUntil
          ? t('availabilityForm', 'freeCancellationNotice', {
              date: formatDate(quote.freeCancellationUntil, 'medium'),
            })
          : t('availabilityForm', 'youWontBeChargedYet')}
      </p>

      {user && quote && quote.loyaltyDiscountPercent > 0 ? (
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-success">
          <Icon name="tag" size={13} />
          {t('account', 'loyaltyDiscount', { percent: quote.loyaltyDiscountPercent })}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      {/* ------------------------------------------------ desktop panel */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-card border border-line bg-white p-4 shadow-card">
          <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-line pb-3">
            <span>
              <span className="text-xs text-ink-muted">{t('viewCharter', 'fromPrice', { price: '' }).trim()}</span>
              <span className="ml-1 text-xl font-extrabold text-ink">{totalLabel}</span>
            </span>
            {charter.policies.isInstantBookActive ? (
              <Badge tone="brand" icon="bolt">{t('listingCard', 'instantBook')}</Badge>
            ) : null}
          </div>
          {panelBody}
        </div>
      </aside>

      {/* -------------------------------------------------- mobile bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 shadow-bar safe-bottom lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-ink">{totalLabel}</p>
            <p className="truncate text-xs text-ink-muted">
              {date ? formatDate(date, 'short') : t('search', 'anyDate')} ·{' '}
              {adults + children} {adults + children === 1 ? 'guest' : 'guests'}
            </p>
          </div>
          <Button size="lg" onClick={() => setSheetOpen(true)} className="shrink-0">
            {t('viewCharter', 'checkAvailability')}
          </Button>
        </div>
      </div>

      <Overlay
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('availabilityForm', 'title')}
        size="full"
      >
        {panelBody}
      </Overlay>

      {/* ------------------------------------------------------ pickers */}
      <Overlay
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        title={t('calendar', 'selectDates')}
        size="md"
        footer={
          <Button fullWidth onClick={() => setDateOpen(false)} disabled={!date}>
            {t('general', 'done')}
          </Button>
        }
      >
        <DatePicker
          value={date}
          min={today()}
          months={2}
          states={calendar}
          showLegend
          onChange={(next) => {
            setDate(next);
            if (next) setDateOpen(false);
          }}
        />
        <p className="mt-3 text-xs text-ink-muted">
          {t('calendar', 'lastUpdated', {
            date: formatDate(charter.availabilityUpdatedAt.slice(0, 10), 'medium'),
          })}
        </p>
      </Overlay>

      <Overlay
        open={guestsOpen}
        onClose={() => setGuestsOpen(false)}
        title={t('availabilityForm', 'guests')}
        size="sm"
        footer={
          <Button fullWidth onClick={() => setGuestsOpen(false)}>
            {t('general', 'done')}
          </Button>
        }
      >
        <Stepper
          label={t('pickers', 'adults')}
          value={adults}
          min={1}
          max={selectedPackage?.capacity ?? charter.capacity}
          onChange={setAdults}
        />
        <Stepper
          label={t('pickers', 'children')}
          sublabel={t('pickers', 'childrenAges')}
          value={children}
          min={0}
          max={Math.max(0, (selectedPackage?.capacity ?? charter.capacity) - adults)}
          onChange={setChildren}
        />
        <p className="mt-2 text-xs text-ink-muted">
          {t('listingCard', 'capacity', {
            count: selectedPackage?.capacity ?? charter.capacity,
            p: selectedPackage?.capacity ?? charter.capacity,
          })}
        </p>
      </Overlay>
    </>
  );
}

function Message({ tone, text }: { tone: 'info' | 'warning' | 'error'; text: string }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cx(
        'flex items-start gap-2 rounded-control px-3 py-2.5 text-sm',
        tone === 'error'
          ? 'bg-red-50 text-red-800'
          : tone === 'warning'
            ? 'bg-amber-50 text-amber-900'
            : 'bg-surface-sunken text-ink-soft',
      )}
    >
      <Icon name={tone === 'info' ? 'info' : 'alert'} size={15} className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

/** Map a machine-readable availability reason onto a catalog string. */
function reasonLabel(reason?: string): string {
  switch (reason) {
    case 'capacity_exceeded':
      return t('packageCard', 'capacityExceeded');
    case 'min_persons':
      return t('packageCard', 'minPersons', { p: '' }).replace(/\s+/g, ' ');
    case 'booked':
      return t('calendar', 'booked');
    case 'blocked':
    case 'weekday_closed':
    case 'out_of_season':
      return t('calendar', 'unavailable');
    case 'past_date':
      return t('booking', 'errorPastDate');
    default:
      return t('packageCard', 'unavailableForSelection');
  }
}

/** Price-breakdown line labels live in the packageCard/booking domains. */
function lineLabel(label: string, key: string): string {
  const map: Record<string, string> = {
    base: t('packageCard', 'tripPrice'),
    tripPricePerPerson: t('packageCard', 'tripPrice'),
    additional_guests: t('packageCard', 'additionalGuests', { count: '' }).replace(' ()', ''),
    service_fee: t('packageCard', 'serviceFee'),
    processing_fee: t('packageCard', 'processingFee'),
    security_deposit: t('packageCard', 'securityDeposit'),
    loyalty: t('booking', 'loyaltyApplied', { percent: '' }).replace(' (% off)', ''),
    promo: t('booking', 'promoApplied'),
    credit: t('booking', 'creditApplied'),
  };
  return map[key] ?? map[label] ?? label;
}

/** Local formatter so the panel does not need the preferences context twice. */
function formatMoneyValue(amount: number, currencyCode: string): string {
  const digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
  return currencyCode === 'USD' ? `US $${digits}` : `${digits} ${currencyCode}`;
}
