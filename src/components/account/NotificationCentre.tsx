'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { timeAgo } from '@/lib/core/dates';
import { api } from '@/lib/client/api';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';
import type { Notification, NotificationCategory } from '@/lib/domain/types';

/**
 * The notification centre.
 *
 * Typed tabs with counts, and an archive rather than a delete — the operator
 * app has a separate archived view, which only makes sense if archiving is
 * reversible. Nothing is ever destroyed: a notification is the record that the
 * platform told you something, and that record outlives your interest in it.
 */

const CATEGORY_ICON: Record<NotificationCategory, IconName> = {
  booking: 'tag',
  message: 'message',
  review: 'star-empty',
  payout: 'wallet',
  onboarding: 'check',
  product_update: 'bolt',
  ticket: 'info',
  marketing: 'heart',
  system: 'shield',
};

const CATEGORY_KEY: Record<NotificationCategory, string> = {
  booking: 'categoryBooking',
  message: 'categoryMessage',
  review: 'categoryReview',
  payout: 'categoryPayout',
  onboarding: 'categoryOnboarding',
  product_update: 'categoryProductUpdate',
  ticket: 'categoryTicket',
  marketing: 'categoryMarketing',
  system: 'categorySystem',
};

export function NotificationCentre({
  notifications: initial,
  counts,
  archived,
  activeCategory,
}: {
  notifications: Notification[];
  counts: { total: number; unread: number; archived: number; byCategory: Partial<Record<NotificationCategory, number>> };
  archived: boolean;
  activeCategory?: NotificationCategory;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  const act = async (payload: Record<string, unknown>, remove?: string) => {
    setBusy(true);
    try {
      await api.post('/api/notifications', payload);
      if (remove) setItems((current) => current.filter((n) => n.id !== remove));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const categories = Object.entries(counts.byCategory) as [NotificationCategory, number][];

  const href = (category?: NotificationCategory) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (archived) params.set('archived', 'true');
    return `/account/notifications${params.size ? `?${params}` : ''}`;
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={archived ? '/account/notifications' : '/account/notifications?archived=true'}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('notifications', archived ? 'backToAll' : 'seeArchived')}
          {!archived && counts.archived ? ` (${counts.archived})` : ''}
        </Link>

        {/* Styled as a link, not a button: it is the peer of "See archived"
            opposite it, and a filled control here would outweigh the
            notifications themselves. */}
        {!archived && counts.unread > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => act({ all: true })}
            className="text-sm font-semibold text-brand-700 hover:underline disabled:opacity-50"
          >
            {t('notifications', 'markAllRead')}
          </button>
        ) : null}
      </div>

      {!archived && categories.length > 1 ? (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={href()}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              !activeCategory
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
            )}
          >
            {t('notifications', 'all', { count: String(counts.total) })}
          </Link>
          {categories.map(([category, count]) => (
            <Link
              key={category}
              href={href(category)}
              className={cx(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                activeCategory === category
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
              )}
            >
              {t('notifications', CATEGORY_KEY[category])} ({count})
            </Link>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t('notifications', archived ? 'emptyArchiveTitle' : 'emptyTitle')}
          body={t('notifications', archived ? 'emptyArchiveBody' : 'emptyBody')}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {items.map((notification) => (
            <li key={notification.id} className="flex items-start gap-3 p-3">
              <span
                className={cx(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  notification.readAt
                    ? 'bg-surface-sunken text-ink-muted'
                    : 'bg-brand-50 text-brand-700',
                )}
              >
                <Icon name={CATEGORY_ICON[notification.category]} size={17} />
              </span>

              <div className="min-w-0 flex-1">
                <Wrapper href={notification.href} onOpen={() => act({ id: notification.id })}>
                  <span
                    className={cx(
                      'block text-sm',
                      notification.readAt ? 'font-medium text-ink-soft' : 'font-bold text-ink',
                    )}
                  >
                    {notification.title}
                  </span>
                  <span className="block text-xs text-ink-muted">{notification.body}</span>
                </Wrapper>

                <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
                  <span>{timeAgo(notification.createdAt)}</span>
                  <span>·</span>
                  <span>{t('notifications', CATEGORY_KEY[notification.category])}</span>
                  {/* The channels a send actually went out on, so nobody has to
                      wonder whether their phone should have buzzed. */}
                  {notification.channels.length ? (
                    <>
                      <span>·</span>
                      <span>
                        {notification.channels
                          .map((channel) =>
                            t(
                              'notifications',
                              channel === 'push'
                                ? 'channelPush'
                                : channel === 'email'
                                  ? 'channelEmail'
                                  : 'channelSms',
                            ),
                          )
                          .join(', ')}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act(
                    archived
                      ? { id: notification.id, restore: true }
                      : { id: notification.id, archive: true },
                    notification.id,
                  )
                }
                className="shrink-0 text-[11px] font-semibold text-ink-muted hover:text-ink"
              >
                {t('notifications', archived ? 'restore' : 'archive')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Wrapper({
  href,
  onOpen,
  children,
}: {
  href?: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  if (!href) return <div className="block text-left">{children}</div>;
  return (
    <Link href={href} onClick={onOpen} className="block text-left">
      {children}
    </Link>
  );
}
