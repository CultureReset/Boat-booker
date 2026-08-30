'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { addDays, monthGrid, today, weekdayHeadings } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Button, Select, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import type { CalendarCell, CalendarRow } from './MultiCalendar';

/**
 * The operator app's calendar.
 *
 * A single listing at a time, months scrolling vertically and continuously, and
 * a **selection mode** rather than a spreadsheet. That is a deliberate
 * departure from the desktop multicalendar, which is a listing × day matrix
 * with shift-click ranges: that idiom needs a mouse and a wide screen, and on a
 * phone it is unusable.
 *
 * The contextual app bar is the other half of the pattern. Once a date is
 * picked, the header becomes `✕ · 1 date selected · ⚙` and a floating Edit
 * button appears — so the destructive controls only exist while there is
 * something selected to apply them to.
 *
 * The week starts on **Sunday** here, matching the real operator app, while the
 * guest-facing pickers start on Monday.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** How many months to render below the current one. */
const MONTHS_AHEAD = 11;

export function MonthCalendar({ rows: initialRows }: { rows: CalendarRow[] }) {
  const router = useRouter();

  const [rows, setRows] = useState(initialRows);
  const [charterId, setCharterId] = useState(initialRows[0]?.charterId ?? '');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = rows.find((r) => r.charterId === charterId) ?? rows[0];

  /** Cells by date, so a month grid can look one up in constant time. */
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarCell>();
    for (const cell of row?.cells ?? []) map.set(cell.date, cell);
    return map;
  }, [row]);

  const months = useMemo(() => {
    const start = new Date(`${today()}T00:00:00Z`);
    return Array.from({ length: MONTHS_AHEAD + 1 }, (_, offset) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });
  }, []);

  const toggle = (date: string) => {
    const cell = byDate.get(date);
    // Booked and past days are not the operator's to change here — the booking
    // screen is where a booked day gets released.
    if (cell?.state === 'booked' || cell?.state === 'past') return;

    setSelection((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const apply = async (action: 'block' | 'unblock') => {
    if (!row || selection.size === 0) return;

    setBusy(true);
    setError(null);
    try {
      await api.post('/api/owner/calendar', {
        charterId: row.charterId,
        dates: [...selection],
        action,
        note: note.trim() || undefined,
      });

      // Update in place rather than refetching: the operator is mid-task and a
      // full reload would scroll them back to this month's top.
      setRows((current) =>
        current.map((candidate) =>
          candidate.charterId !== row.charterId
            ? candidate
            : {
                ...candidate,
                cells: candidate.cells.map((cell) =>
                  selection.has(cell.date) && cell.state !== 'booked' && cell.state !== 'past'
                    ? { ...cell, state: action === 'block' ? 'blocked' : 'available', note: note.trim() || undefined }
                    : cell,
                ),
              },
        ),
      );

      setSelection(new Set());
      setNote('');
      setSheetOpen(false);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!row) return null;

  const selecting = selection.size > 0;
  const headings = weekdayHeadings('sunday');

  return (
    <div className="relative">
      {/*
        Contextual app bar. Replaces the normal header while a selection is
        live, which is what makes "1 date selected" the whole title rather than
        a subtitle nobody reads.
      */}
      {selecting ? (
        <div className="sticky top-[var(--header-height,56px)] z-20 -mx-4 mb-3 flex items-center gap-3 border-b border-line bg-brand-600 px-4 py-3 text-white">
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            aria-label={t('general', 'clear')}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
          >
            <Icon name="close" size={18} />
          </button>
          <p className="flex-1 text-sm font-bold">
            {t('owner', 'datesSelected', { count: selection.size })}
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={t('owner', 'bulkEdit')}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      ) : (
        <div className="mb-3">
          {/* Which boat this calendar is for. A picker when there is a choice,
              and the plain name when there is only one — a one-option select
              is a control that does nothing. */}
          {rows.length > 1 ? (
            <Select
              value={charterId}
              onChange={(e) => setCharterId(e.target.value)}
              aria-label={t('owner', 'multicalendarTitle')}
            >
              {rows.map((option) => (
                <option key={option.charterId} value={option.charterId}>
                  {option.title}
                </option>
              ))}
            </Select>
          ) : (
            <h1 className="text-lg font-bold text-ink">{row.title}</h1>
          )}

          {/* The day states are coloured dots; without this nothing says what
              green and red mean. */}
          <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <LegendKey className="bg-success" label={t('owner', 'bookedDate')} />
            <LegendKey className="bg-danger" label={t('owner', 'blockedDate')} />
            <LegendKey className="bg-transparent ring-1 ring-inset ring-line" label={t('owner', 'openDate')} />
          </ul>
        </div>
      )}

      {/* Weekday headings, pinned above the scrolling months. */}
      <div className="sticky top-[calc(var(--header-height,56px)+0px)] z-10 -mx-4 grid grid-cols-7 border-b border-line bg-white px-4 py-2">
        {headings.map((day) => (
          <span key={day} className="text-center text-[11px] font-bold text-ink-muted">
            {day}
          </span>
        ))}
      </div>

      {/* Months run continuously — no pagination, because an operator setting
          summer availability in March should scroll, not click twelve times. */}
      <div className="space-y-6 pt-4">
        {months.map(({ year, month }) => (
          <section key={`${year}-${month}`}>
            <h3 className="mb-2 text-sm font-bold text-ink">
              {MONTH_NAMES[month]} {year}
            </h3>
            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(year, month, 'sunday').map((date, index) =>
                date === null ? (
                  <span key={`pad-${index}`} aria-hidden />
                ) : (
                  <DayCell
                    key={date}
                    date={date}
                    cell={byDate.get(date)}
                    selected={selection.has(date)}
                    onToggle={() => toggle(date)}
                  />
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Floating action, only while something is selected. */}
      {selecting ? (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-[calc(var(--tabbar-height)+16px)] right-4 z-30 flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-pop md:bottom-6"
        >
          {t('general', 'edit')}
          <Icon name="chevron-right" size={16} />
        </button>
      ) : null}

      <Overlay open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('owner', 'bulkEdit')}>
        <p className="text-sm text-ink-soft">
          {t('owner', 'datesSelected', { count: selection.size })}
        </p>

        <Textarea
          rows={2}
          className="mt-3"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('owner', 'calendarNotePlaceholder')}
          aria-label={t('owner', 'calendarNotePlaceholder')}
        />

        {error ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => apply('unblock')}>
            {t('owner', 'unblockDates')}
          </Button>
          <Button variant="danger" className="flex-1" disabled={busy} onClick={() => apply('block')}>
            {t('owner', 'blockDates')}
          </Button>
        </div>
      </Overlay>
    </div>
  );
}

/** One entry in the state legend: the dot, then what it means. */
function LegendKey({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className={cx('h-2 w-2 shrink-0 rounded-full', className)} aria-hidden />
      {label}
    </li>
  );
}

/**
 * One day.
 *
 * State reads as a coloured dot under the number rather than as a filled cell,
 * so a selected day can be solid without fighting the state colour for the same
 * pixels — which is exactly the problem the real app solves the same way.
 */
function DayCell({
  date,
  cell,
  selected,
  onToggle,
}: {
  date: string;
  cell: CalendarCell | undefined;
  selected: boolean;
  onToggle: () => void;
}) {
  const state = cell?.state ?? 'available';
  const day = Number(date.slice(8, 10));
  const isToday = date === today();
  const locked = state === 'booked' || state === 'past';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={state === 'past'}
      aria-pressed={selected}
      aria-label={`${date}${cell?.reference ? ` · ${cell.reference}` : ''}`}
      className={cx(
        'relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm transition-colors',
        selected && 'bg-ink font-bold text-white',
        !selected && state === 'past' && 'text-ink-faint',
        !selected && state === 'booked' && 'bg-emerald-50 font-semibold text-emerald-900',
        !selected && state === 'blocked' && 'bg-red-50 font-semibold text-red-900',
        !selected && state === 'available' && 'text-ink hover:bg-surface-sunken',
        !selected && isToday && 'ring-1 ring-brand-500',
        locked && !selected && 'cursor-default',
      )}
    >
      <span className="leading-none">{day}</span>

      {/* The dot carries the state when the cell itself is showing selection. */}
      <span
        className={cx(
          'mt-0.5 h-1 w-1 rounded-full',
          state === 'booked'
            ? 'bg-success'
            : state === 'blocked'
              ? 'bg-danger'
              : 'bg-transparent',
          selected && state !== 'available' && 'bg-white',
        )}
        aria-hidden
      />

      {/* A dog-ear marks a day carrying a note, as the real app does. */}
      {cell?.note ? (
        <span
          aria-hidden
          className={cx(
            'absolute right-1 top-1 h-0 w-0 border-l-4 border-t-4 border-l-transparent',
            selected ? 'border-t-white' : 'border-t-warning',
          )}
        />
      ) : null}
    </button>
  );
}
