'use client';

import { useMemo, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';
import { Button, EmptyState, Field, LinkButton, Select } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Embeddable widget builder.
 *
 * Generates the snippet an owner pastes into their own site. Three formats
 * cover what operators actually ask for: a full booking iframe, a compact
 * "check availability" button, and a review badge.
 */

type WidgetKind = 'booking' | 'button' | 'reviews';

export function WidgetBuilder({
  listings,
  origin,
}: {
  listings: { id: string; title: string }[];
  origin: string;
}) {
  const [kind, setKind] = useState<WidgetKind>('booking');
  const [listingId, setListingId] = useState(listings[0]?.id ?? '');
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    const url = `${origin}/charters/view/${listingId}`;

    if (kind === 'button') {
      return [
        `<a href="${url}"`,
        `   style="display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;`,
        `          border-radius:10px;background:#1d70f1;color:#fff;font:600 15px/1 system-ui,sans-serif;`,
        `          text-decoration:none">`,
        `  Check availability`,
        `</a>`,
      ].join('\n');
    }

    if (kind === 'reviews') {
      return [
        `<iframe src="${url}#reviews"`,
        `        title="Reviews"`,
        `        width="100%" height="220" frameborder="0"`,
        `        style="border:1px solid #e2e8f0;border-radius:12px"></iframe>`,
      ].join('\n');
    }

    return [
      `<iframe src="${url}"`,
      `        title="Book online"`,
      `        width="100%" height="720" frameborder="0"`,
      `        style="border:1px solid #e2e8f0;border-radius:12px"`,
      `        loading="lazy"></iframe>`,
    ].join('\n');
  }, [kind, listingId, origin]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the snippet is selectable anyway.
    }
  };

  if (!listings.length) {
    return (
      <EmptyState
        icon="grid"
        title={t('owner', 'listingsEmpty')}
        body="Publish a listing before generating an embed."
        action={<LinkButton href="/owner/listings">{t('navigation', 'listings')}</LinkButton>}
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('navigation', 'listings')}>
          {({ id }) => (
            <Select id={id} value={listingId} onChange={(e) => setListingId(e.target.value)}>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('owner', 'widgetsTitle')}>
          {({ id }) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as WidgetKind)}>
              <option value="booking">Booking form</option>
              <option value="button">Check availability button</option>
              <option value="reviews">Review badge</option>
            </Select>
          )}
        </Field>
      </div>

      {/* Preview */}
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">{t('general', 'seeMore')}</h2>
        <div className="flex min-h-[80px] items-center justify-center rounded-control border border-dashed border-line bg-surface-sunken p-4">
          {kind === 'button' ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-control bg-brand-600 px-5 text-sm font-semibold text-white">
              <Icon name="calendar" size={16} />
              Check availability
            </span>
          ) : (
            <span className="text-sm text-ink-muted">
              {kind === 'reviews' ? 'Review badge' : 'Booking form'} · {listings.find((l) => l.id === listingId)?.title}
            </span>
          )}
        </div>
      </section>

      {/* Snippet */}
      <section className="rounded-card border border-line bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">{t('owner', 'copyEmbedCode')}</h2>
          <Button size="sm" variant="outline" onClick={copy} icon={copied ? 'check' : 'share'}>
            {copied ? t('general', 'copied') : t('general', 'copyLink')}
          </Button>
        </div>
        <pre
          className={cx(
            'overflow-x-auto rounded-control bg-ink p-3 text-xs leading-relaxed text-white',
          )}
        >
          <code>{snippet}</code>
        </pre>
        <p className="mt-2 text-xs text-ink-muted">
          Paste this into your own site. Bookings made through it appear in your dashboard like any other.
        </p>
      </section>
    </div>
  );
}
