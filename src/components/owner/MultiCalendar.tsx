'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { addDays, formatDate, today } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import { Icon } from '@/components/ui/Icon';
import { Button, EmptyState, LinkButton } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Multicalendar.
 *
 * A grid of listings against days. Its whole reason for existing is bulk
 * editing: an owner going away for a fortnight should close every boat in one
 * gesture, not open fourteen date pickers. Dates are selected by tapping (or
 * shift-clicking for a range) and then blocked or opened together.
 *
 * Days consumed by a booking are read-only here — freeing one means cancelling
 * the booking, which has refund consequences and belongs on the booking screen.
 */

export type CellState = 'available' | 'blocked' | 'booked' | 'past';

export interface CalendarCell {
  date: string;
  state: CellState;
  bookingId?: string;
  reference?: string;
  guests?: number;
  note?: string;
}

export interface CalendarRow {
  charterId: string;
  title: string;
  published: boolean;
  photo: { placeholder: string; altText: string } | null;
  cells: CalendarCell[];
}

const WINDOW_DAYS = 35;

export function MultiCalendar({ rows: initialRows }: { rows: CalendarRow[] }) {
  const { toast } = useToast();

  const [rows, setRows] = useState(initialRows);
  const [from, setFrom] = useState(today());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Selection is keyed `charterId:date` so it can span multiple boats. */
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastPicked, setLastPicked] = useState<{ charterId: string; index: number } | null>(null);

  const load = useCallback(
    async (start: string) => {
      setLoading(true);
      try {
        const result = await api.get<CalendarRow[]>(
          `/api/owner/calendar?from=${start}&days=${WINDOW_DAYS}`,
        );
        setRows(result);
        setSelection(new Set());
      } catch (caught) {
        toast(errorMessage(caught), 'error');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  // Reload whenever the window moves; the first render already has data.
  const initialFrom = useMemo(() => today(), []);
  useEffect(() => {
    if (from !== initialFrom) void load(from);
  }, [from, initialFrom, load]);

  const toggleCell = (charterId: string, index: number, shiftKey: boolean) => {
    const row = rows.find((r) => r.charterId === charterId);
    const cell = row?.cells[index];
    if (!cell || cell.state === 'past' || cell.state === 'booked') return;

    setSelection((current) => {
      const next = new Set(current);

      // Shift-click extends from the previous pick within the same row.
      if (shiftKey && lastPicked && lastPicked.charterId === charterId) {
        const [start, end] = [lastPicked.index, index].sort((a, b) => a - b);
        for (let i = start; i <= end; i += 1) {
          const target = row!.cells[i];
          if (target.state === 'past' || target.state === 'booked') continue;
          next.add(`${charterId}:${target.date}`);
        }
        return next;
      }

      const key = `${charterId}:${cell.date}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    setLastPicked({ charterId, index });
  };

  const applyBlocks = async (blocked: boolean) => {
    if (!selection.size) return;

    // Group by listing so each boat is one request.
    const byCharter = new Map<string, string[]>();
    for (const key of selection) {
      const [charterId, date] = key.split(':');
      const list = byCharter.get(charterId) ?? [];
      list.push(date);
      byCharter.set(charterId, list);
    }

    setBusy(true);
    try {
      await Promise.all(
        Array.from(byCharter.entries()).map(([charterId, dates]) =>
          api.post('/api/owner/calendar', { charterId, dates, blocked }),
        ),
      );

      // Reflect the change locally rather than refetching the whole grid.
      setRows((current) =>
        current.map((row) => {
          const dates = new Set(byCharter.get(row.charterId) ?? []);
          if (!dates.size) return row;
          return {
            ...row,
            cells: row.cells.map((cell) =>
              dates.has(cell.date) && cell.state !== 'booked' && cell.state !== 'past'
                ? { ...cell, state: blocked ? 'blocked' : 'available' }
                : cell,
            ),
          };
        }),
      );

      setSelection(new Set());
      toast(blocked ? t('owner', 'blockDates') : t('owner', 'unblockDates'), 'success');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!rows.length) {
    return (
      <EmptyState
        icon="calendar"
        title={t('owner', 'listingsEmpty')}
        action={<LinkButton href="/owner/listings">{t('owner', 'createListing')}</LinkButton>}
      />
    );
  }

  const days = rows[0]?.cells ?? [];

  return (
    <div>
      {/* ------------------------------------------------------ toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFrom(addDays(from, -WINDOW_DAYS))}
            disabled={from <= today()}
            aria-label={t('calendar', 'previousMonth')}
            className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink transition-colors hover:bg-surface-sunken disabled:opacity-40"
          >
            <Icon name="chevron-left" size={17} />
          </button>
          <button
            type="button"
            onClick={() => setFrom(addDays(from, WINDOW_DAYS))}
            aria-label={t('calendar', 'nextMonth')}
            className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink transition-colors hover:bg-surface-sunken"
          >
            <Icon name="chevron-right" size={17} />
          </button>
          <span className="ml-2 text-sm font-semibold text-ink" aria-live="polite">
            {formatDate(from, 'medium')} – {formatDate(addDays(from, WINDOW_DAYS - 1), 'medium')}
          </span>
          {loading ? <span className="ml-2 text-xs text-ink-muted">{t('general', 'loading')}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Legend className="bg-white ring-1 ring-inset ring-line" label={t('owner', 'openDate')} />
          <Legend className="bg-slate-300" label={t('owner', 'blockedDate')} />
          <Legend className="bg-brand-500" label={t('owner', 'bookedDate')} />
        </div>
      </div>

      {/* Bulk action bar appears only when something is selected. */}
      {selection.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-brand-300 bg-brand-50 px-3 py-2">
          <span className="text-sm font-semibold text-brand-900">
            {selection.size} {selection.size === 1 ? 'date' : 'dates'} selected
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setSelection(new Set())}>
            {t('general', 'clear')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyBlocks(false)} loading={busy}>
            {t('owner', 'unblockDates')}
          </Button>
          <Button size="sm" onClick={() => applyBlocks(true)} loading={busy}>
            {t('owner', 'blockDates')}
          </Button>
        </div>
      ) : null}

      {/* -------------------------------------------------------- grid */}
      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('owner', 'multicalendarTitle')}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[160px] border-b border-r border-line bg-white p-2 text-left text-xs font-bold text-ink"
              >
                {t('navigation', 'listings')}
              </th>
              {days.map((cell) => {
                const weekend = [0, 6].includes(new Date(`${cell.date}T00:00:00Z`).getUTCDay());
                return (
                  <th
                    key={cell.date}
                    scope="col"
                    className={cx(
                      'border-b border-line p-1 text-center text-[10px] font-semibold',
                      weekend ? 'bg-surface-sunken text-ink-soft' : 'text-ink-muted',
                    )}
                  >
                    <span className="block">{cell.date.slice(8, 10)}</span>
                    <span className="block font-normal">
                      {new Date(`${cell.date}T00:00:00Z`).toLocaleDateString('en-US', {
                        weekday: 'narrow',
                        timeZone: 'UTC',
                      })}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.charterId}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-r border-line bg-white p-2 text-left align-middle"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-8 w-10 shrink-0 rounded bg-slate-200"
                      style={row.photo ? { backgroundImage: row.photo.placeholder } : undefined}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-ink">{row.title}</span>
                      {!row.published ? (
                        <span className="block text-[10px] text-ink-faint">{t('owner', 'draft')}</span>
                      ) : null}
                    </span>
                  </span>
                </th>

                {row.cells.map((cell, index) => {
                  const selected = selection.has(`${row.charterId}:${cell.date}`);
                  const interactive = cell.state !== 'past' && cell.state !== 'booked';

                  return (
                    <td key={cell.date} className="border-b border-line p-0">
                      <button
                        type="button"
                        disabled={!interactive}
                        onClick={(event) => toggleCell(row.charterId, index, event.shiftKey)}
                        aria-label={`${row.title} — ${formatDate(cell.date, 'medium')} — ${cell.state}`}
                        aria-pressed={selected}
                        title={cell.reference ? `${cell.reference} · ${cell.guests} guests` : undefined}
                        className={cx(
                          'h-10 w-full min-w-[28px] border-r border-line transition-colors',
                          selected
                            ? 'bg-brand-600 ring-2 ring-inset ring-brand-800'
                            : cell.state === 'booked'
                              ? 'cursor-not-allowed bg-brand-500'
                              : cell.state === 'blocked'
                                ? 'bg-slate-300 hover:bg-slate-400'
                                : cell.state === 'past'
                                  ? 'cursor-not-allowed bg-surface-sunken'
                                  : 'bg-white hover:bg-brand-50',
                        )}
                      >
                        {cell.state === 'booked' ? (
                          <span className="text-[10px] font-bold text-white">
                            {cell.guests ?? ''}
                          </span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        {t('owner', 'calendarHelp')}
      </p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span className={cx('h-3 w-3 rounded', className)} aria-hidden="true" />
      {label}
    </span>
  );
}
