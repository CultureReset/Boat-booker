'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { timeAgo } from '@/lib/core/dates';
import type { ThreadSummary } from '@/lib/services/messages';
import { Icon } from '@/components/ui/Icon';
import { Badge, EmptyState, LinkButton, PhotoFrame } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Conversation list.
 *
 * The filter rail is the operator's triage tool: "Priority" surfaces threads
 * where something is waiting on *them* — an unanswered offer, a live booking
 * request, a flagged conversation — which is the difference between an inbox
 * you can run a business from and one you have to read end to end.
 */

const FILTERS = [
  { key: 'latest', labelKey: 'filterLatest' },
  { key: 'unread', labelKey: 'filterUnread' },
  { key: 'priority', labelKey: 'filterPriority' },
  { key: 'support', labelKey: 'filterSupport' },
  { key: 'archived', labelKey: 'filterArchived' },
] as const;

export function ThreadList({
  threads,
  basePath,
  filter = 'latest',
}: {
  threads: ThreadSummary[];
  basePath: '/account/inbox' | '/owner/inbox';
  filter?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const setFilter = (next: string) => {
    const params = new URLSearchParams(search.toString());
    if (next === 'latest') params.delete('filter');
    else params.set('filter', next);
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`);
  };

  return (
    <>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            aria-pressed={filter === option.key}
            className={cx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              filter === option.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
            )}
          >
            {t('inbox', option.labelKey)}
          </button>
        ))}
      </div>

      {threads.length === 0 ? (
        <EmptyState
          icon="message"
          title={t('navigation', 'emptyMessagesTitle')}
          body={
            basePath === '/owner/inbox'
              ? t('navigation', 'emptyMessagesDescriptionCaptain')
              : t('navigation', 'emptyMessagesDescriptionCustomer')
          }
          action={
            basePath === '/account/inbox' ? (
              <LinkButton href="/">{t('bookings', 'emptyCta')}</LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`${basePath}/${thread.id}`}
                className="flex items-start gap-3 p-3 transition-colors hover:bg-surface-sunken"
              >
                <PhotoFrame photo={thread.photo} rounded="rounded-lg" className="h-12 w-14 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cx(
                        'min-w-0 truncate text-sm',
                        thread.unreadCount ? 'font-bold text-ink' : 'font-semibold text-ink',
                      )}
                    >
                      {thread.counterparty.displayName}
                    </p>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {timeAgo(thread.updatedAt)}
                    </span>
                  </div>

                  <p className="truncate text-xs text-ink-muted">{thread.subject}</p>

                  {thread.lastMessage ? (
                    <p
                      className={cx(
                        'mt-0.5 truncate text-xs',
                        thread.lastMessage.isSystem
                          ? 'font-medium italic text-ink-faint'
                          : thread.unreadCount
                            ? 'font-semibold text-ink-soft'
                            : 'text-ink-muted',
                      )}
                    >
                      {thread.lastMessage.fromMe && !thread.lastMessage.isSystem ? 'You: ' : ''}
                      {thread.lastMessage.body}
                    </p>
                  ) : null}

                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {thread.hasPendingOffer ? (
                      <Badge tone="brand">{t('inbox', 'offerTitle')}</Badge>
                    ) : null}
                    {thread.kind === 'inquiry' ? (
                      <Badge tone="neutral">{t('inbox', 'inquiryTitle')}</Badge>
                    ) : null}
                    {thread.bookingReference ? (
                      <Badge tone="neutral">{thread.bookingReference}</Badge>
                    ) : null}
                    {thread.flagged ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                        <Icon name="alert" size={11} />
                        {t('inbox', 'flaggedTitle')}
                      </span>
                    ) : null}
                  </div>
                </div>

                {thread.unreadCount ? (
                  <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
