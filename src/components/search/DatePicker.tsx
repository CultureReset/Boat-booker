'use client';

import { useMemo, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { formatDate, monthGrid, today, toIsoDate } from '@/lib/core/dates';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';


/**
 * Month-grid date picker.
 *
 * Used by the search widget, the listing booking panel and the owner calendar.
 * `states` optionally colours each day from live availability so a guest never
 * picks a date that is already gone; without it every future day is selectable.
 *
 * Weeks start on Monday, matching `monthGrid` in `lib/core/dates`.
 */

export type DayState = 'available' | 'blocked' | 'booked' | 'closed' | 'past';

const WEEKDAY_KEYS = [
  'weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri', 'weekdaySat', 'weekdaySun',
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface DatePickerProps {
  value?: string;
  onChange: (date: string | undefined) => void;
  min?: string;
  /** How many months to render at once. Two reads well on a phone sheet. */
  months?: number;
  /** Availability by ISO date; days absent from the map are treated as open. */
  states?: Record<string, DayState>;
  /** Multi-select mode for the owner's bulk calendar edits. */
  selectedDates?: Set<string>;
  onToggleDate?: (date: string) => void;
  showLegend?: boolean;
}

export function DatePicker({
  value,
  onChange,
  min = today(),
  months = 1,
  states,
  selectedDates,
  onToggleDate,
  showLegend,
}: DatePickerProps) {
  const start = useMemo(() => {
    const anchor = value && value >= min ? value : min;
    const [year, month] = anchor.split('-').map(Number);
    return { year, month: month - 1 };
  }, [value, min]);

  const [offset, setOffset] = useState(0);

  const visibleMonths = useMemo(
    () =>
      Array.from({ length: months }, (_, index) => {
        const raw = start.month + offset + index;
        return { year: start.year + Math.floor(raw / 12), month: ((raw % 12) + 12) % 12 };
      }),
    [start, offset, months],
  );

  const multiSelect = Boolean(onToggleDate);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          // Never page back past the first allowed month.
          disabled={
            visibleMonths[0].year < Number(min.slice(0, 4)) ||
            (visibleMonths[0].year === Number(min.slice(0, 4)) &&
              visibleMonths[0].month <= Number(min.slice(5, 7)) - 1)
          }
          aria-label={t('calendar', 'previousMonth')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-sunken disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span className="text-sm font-bold text-ink" aria-live="polite">
          {MONTH_NAMES[visibleMonths[0].month]} {visibleMonths[0].year}
          {months > 1
            ? ` – ${MONTH_NAMES[visibleMonths[months - 1].month]} ${visibleMonths[months - 1].year}`
            : ''}
        </span>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          aria-label={t('calendar', 'nextMonth')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-sunken"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      <div className={cx('grid gap-6', months > 1 && 'md:grid-cols-2')}>
        {visibleMonths.map(({ year, month }) => (
          <MonthGrid
            key={`${year}-${month}`}
            year={year}
            month={month}
            min={min}
            value={value}
            states={states}
            selectedDates={selectedDates}
            multiSelect={multiSelect}
            onSelect={(date) => {
              if (onToggleDate) onToggleDate(date);
              else onChange(date === value ? undefined : date);
            }}
            showTitle={months > 1}
          />
        ))}
      </div>

      {showLegend ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
          <LegendSwatch className="bg-white ring-1 ring-inset ring-line" label={t('calendar', 'available')} />
          <LegendSwatch className="bg-slate-200" label={t('calendar', 'blocked')} />
          <LegendSwatch className="bg-brand-200" label={t('calendar', 'booked')} />
        </div>
      ) : null}
    </div>
  );
}

function MonthGrid({
  year,
  month,
  min,
  value,
  states,
  selectedDates,
  multiSelect,
  onSelect,
  showTitle,
}: {
  year: number;
  month: number;
  min: string;
  value?: string;
  states?: Record<string, DayState>;
  selectedDates?: Set<string>;
  multiSelect: boolean;
  onSelect: (date: string) => void;
  showTitle: boolean;
}) {
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const todayIso = toIsoDate(new Date());

  return (
    <div>
      {showTitle ? (
        <p className="mb-2 text-center text-sm font-semibold text-ink">
          {MONTH_NAMES[month]} {year}
        </p>
      ) : null}

      <div className="grid grid-cols-7 gap-0.5" role="grid">
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="pb-1 text-center text-[11px] font-semibold text-ink-faint" role="columnheader">
            {t('calendar', key)}
          </div>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={`pad-${index}`} aria-hidden="true" />;

          const state = states?.[date] ?? (date < min ? 'past' : 'available');
          const disabled = state === 'past' || state === 'closed' || state === 'booked' || date < min;
          const selected = multiSelect ? selectedDates?.has(date) : value === date;
          const blocked = state === 'blocked';
          const booked = state === 'booked';

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={disabled && !multiSelect}
              aria-selected={selected || undefined}
              aria-label={`${formatDate(date, 'long')}${disabled ? ` — ${t('calendar', 'unavailable')}` : ''}`}
              onClick={() => onSelect(date)}
              className={cx(
                'relative flex aspect-square items-center justify-center rounded-lg text-sm transition-colors',
                selected
                  ? 'bg-brand-600 font-bold text-white'
                  : booked
                    ? 'bg-brand-100 text-brand-900'
                    : blocked
                      ? 'bg-slate-200 text-ink-faint line-through'
                      : disabled
                        ? 'text-ink-faint'
                        : 'text-ink hover:bg-surface-sunken',
                disabled && !multiSelect && 'cursor-not-allowed',
              )}
            >
              {Number(date.slice(8, 10))}
              {date === todayIso && !selected ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-600" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span className={cx('h-3 w-3 rounded', className)} aria-hidden="true" />
      {label}
    </span>
  );
}
