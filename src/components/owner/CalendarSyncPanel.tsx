'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { timeAgo } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Button, Checkbox, EmptyState, Field, Input, Select } from '@/components/ui/primitives';
import type { CalendarLink, ExternalCalendar } from '@/lib/domain/types';

/**
 * External calendars and hull links.
 *
 * Two different protections against the same failure — selling a boat twice —
 * and they are kept visibly separate because the fix differs: a feed covers
 * bookings taken *outside* the platform, a link covers two listings that share
 * one hull *inside* it.
 */
export function CalendarSyncPanel({
  calendars: initialCalendars,
  links: initialLinks,
  listings,
}: {
  calendars: ExternalCalendar[];
  links: CalendarLink[];
  listings: { id: string; title: string }[];
}) {
  const router = useRouter();

  const [calendars, setCalendars] = useState(initialCalendars);
  const [links, setLinks] = useState(initialLinks);
  const [showAdd, setShowAdd] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [charterId, setCharterId] = useState(listings[0]?.id ?? '');
  const [selected, setSelected] = useState<string[]>([]);

  const call = async (payload: Record<string, unknown>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/owner/calendars', payload);
      after();
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const titleFor = (id: string) => listings.find((l) => l.id === id)?.title ?? id;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ external feeds */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">{t('calendarSync', 'feedsTitle')}</h2>

        {calendars.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={t('calendarSync', 'emptyTitle')}
            body={t('calendarSync', 'emptyBody')}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
            {calendars.map((calendar) => (
              <li key={calendar.id} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name="calendar" size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{calendar.name}</p>
                  <p className="truncate text-xs text-ink-muted">{titleFor(calendar.charterId)}</p>
                  <p className="text-xs text-ink-faint">
                    {calendar.lastSyncError
                      ? t('calendarSync', 'syncFailed', { reason: calendar.lastSyncError })
                      : calendar.lastSyncedAt
                        ? t('calendarSync', 'lastSynced', { time: timeAgo(calendar.lastSyncedAt) })
                        : t('calendarSync', 'neverSynced')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    call({ action: 'remove', id: calendar.id }, () =>
                      setCalendars((current) => current.filter((c) => c.id !== calendar.id)),
                    )
                  }
                  aria-label={t('calendarSync', 'removeCalendar')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger/5"
                >
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" className="mt-3" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={15} />
          {t('calendarSync', 'addCalendar')}
        </Button>
      </section>

      {/* ------------------------------------------------------- links */}
      <section>
        <h2 className="text-sm font-bold text-ink">{t('calendarSync', 'linksTitle')}</h2>
        <p className="mb-2 text-xs text-ink-muted">{t('calendarSync', 'linksSubtitle')}</p>

        {links.length === 0 ? (
          <EmptyState
            icon="list"
            title={t('calendarSync', 'linksEmptyTitle')}
            body={t('calendarSync', 'linksEmptyBody')}
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
            {links.map((link) => (
              <li key={link.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {t('calendarSync', 'linkedListings')}
                  </p>
                  <p className="text-sm text-ink">
                    {link.charterIds.map(titleFor).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    call({ action: 'unlink', id: link.id }, () =>
                      setLinks((current) => current.filter((l) => l.id !== link.id)),
                    )
                  }
                  className="shrink-0 text-xs font-semibold text-danger"
                >
                  {t('calendarSync', 'unlink')}
                </button>
              </li>
            ))}
          </ul>
        )}

        {listings.length < 2 ? (
          <p className="mt-3 text-xs text-ink-muted">{t('calendarSync', 'needTwoListings')}</p>
        ) : (
          <Button variant="secondary" className="mt-3" onClick={() => setShowLink(true)}>
            <Icon name="plus" size={15} />
            {t('calendarSync', 'createLink')}
          </Button>
        )}
      </section>

      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {/* ------------------------------------------------------ modals */}
      <Overlay open={showAdd} onClose={() => setShowAdd(false)} title={t('calendarSync', 'addCalendar')}>
        <div className="space-y-3">
          <Field label={t('calendarSync', 'calendarName')}>
            {({ id }) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('calendarSync', 'calendarNamePlaceholder')}
              />
            )}
          </Field>

          <Field label={t('calendarSync', 'calendarUrl')}>
            {({ id }) => (
              <Input
                id={id}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('calendarSync', 'calendarUrlPlaceholder')}
              />
            )}
          </Field>

          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs font-semibold text-brand-700"
          >
            {t('calendarSync', 'urlHelp')}
          </button>
          {showHelp ? (
            <p className="rounded-lg bg-surface-sunken p-3 text-xs text-ink-soft">
              {t('calendarSync', 'urlHelpBody')}
            </p>
          ) : null}

          <Field label={t('calendarSync', 'whichListing')}>
            {({ id }) => (
              <Select id={id} value={charterId} onChange={(e) => setCharterId(e.target.value)}>
                {listings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowAdd(false)}>
              {t('general', 'cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={busy || !name.trim() || !url.trim()}
              onClick={() =>
                call({ charterId, name, url }, () => {
                  setShowAdd(false);
                  setName('');
                  setUrl('');
                })
              }
            >
              {t('general', 'save')}
            </Button>
          </div>
        </div>
      </Overlay>

      <Overlay open={showLink} onClose={() => setShowLink(false)} title={t('calendarSync', 'createLink')}>
        <p className="text-sm text-ink-soft">{t('calendarSync', 'linksSubtitle')}</p>
        <div className="mt-3 space-y-1">
          {listings.map((listing) => (
            <Checkbox
              key={listing.id}
              label={listing.title}
              checked={selected.includes(listing.id)}
              onChange={(e) =>
                setSelected((current) =>
                  e.target.checked
                    ? [...current, listing.id]
                    : current.filter((id) => id !== listing.id),
                )
              }
            />
          ))}
        </div>

        {selected.length === 1 ? (
          <p className="mt-2 text-xs text-warning">{t('calendarSync', 'selectAtLeastTwo')}</p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowLink(false)}>
            {t('general', 'cancel')}
          </Button>
          <Button
            className="flex-1"
            disabled={busy || selected.length < 2}
            onClick={() =>
              call({ action: 'link', charterIds: selected }, () => {
                setShowLink(false);
                setSelected([]);
              })
            }
          >
            {t('calendarSync', 'createLink')}
          </Button>
        </div>
      </Overlay>
    </div>
  );
}
