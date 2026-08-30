'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate, timeAgo } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import type { ThreadSummary } from '@/lib/services/messages';
import { Icon } from '@/components/ui/Icon';
import { Badge, EmptyState, LinkButton, PhotoFrame, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Inbox.
 *
 * Two screens on mobile (list, then thread) and one two-pane view on desktop.
 * Both are driven by the same data, so a conversation opened from either side
 * looks identical.
 */

export function ThreadList({
  threads,
  basePath,
}: {
  threads: ThreadSummary[];
  basePath: '/account/inbox' | '/owner/inbox';
}) {
  if (!threads.length) {
    return (
      <EmptyState
        icon="message"
        title={t('navigation', 'emptyMessagesTitle')}
        body={
          basePath === '/owner/inbox'
            ? t('navigation', 'emptyMessagesDescriptionCaptain')
            : t('navigation', 'emptyMessagesDescriptionCustomer')
        }
        action={basePath === '/account/inbox' ? <LinkButton href="/">{t('bookings', 'emptyCta')}</LinkButton> : undefined}
      />
    );
  }

  return (
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
                <span className="shrink-0 text-xs text-ink-faint">
                  {timeAgo(thread.updatedAt)}
                </span>
              </div>

              <p className="truncate text-xs text-ink-muted">{thread.subject}</p>

              {thread.lastMessage ? (
                <p
                  className={cx(
                    'mt-0.5 line-clamp-1 text-sm',
                    thread.unreadCount ? 'font-medium text-ink' : 'text-ink-muted',
                  )}
                >
                  {thread.lastMessage.fromMe ? 'You: ' : ''}
                  {thread.lastMessage.body}
                </p>
              ) : null}

              {thread.bookingReference ? (
                <p className="mt-1">
                  <Badge tone="neutral">{thread.bookingReference}</Badge>
                </p>
              ) : null}
            </div>

            {thread.unreadCount > 0 ? (
              <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                {thread.unreadCount}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface ThreadDetail {
  id: string;
  subject: string;
  counterparty: { id: string; displayName: string; initials: string };
  charter: { id: string; title: string; photo: { placeholder: string; altText: string } | null } | null;
  booking: { id: string; reference: string; date: string; status: string } | null;
  messages: { id: string; body: string; createdAt: string; fromMe: boolean; readAt?: string }[];
}

export function ThreadView({
  thread: initial,
  basePath,
}: {
  thread: ThreadDetail;
  basePath: '/account/inbox' | '/owner/inbox';
}) {
  const router = useRouter();

  const [thread, setThread] = useState(initial);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    try {
      const updated = await api.post<ThreadDetail>(`/api/inbox/${thread.id}`, { body });
      setThread(updated);
      setDraft('');
      // Refresh so the unread badges in the shell update too.
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col rounded-card border border-line bg-white">
      {/* ---------------------------------------------------- header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line p-3">
        <Link
          href={basePath}
          aria-label={t('inbox', 'backToInbox')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-sunken md:hidden"
        >
          <Icon name="chevron-left" size={18} />
        </Link>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
          {thread.counterparty.initials}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{thread.counterparty.displayName}</p>
          {thread.charter ? (
            <Link
              href={`/charters/view/${thread.charter.id}`}
              className="truncate text-xs text-ink-muted hover:underline"
            >
              {thread.charter.title}
            </Link>
          ) : null}
        </div>

        {thread.booking ? (
          <Link
            href={`${basePath === '/owner/inbox' ? '/owner' : '/account'}/bookings/${thread.booking.id}`}
            className="shrink-0"
          >
            <Badge tone="neutral">{thread.booking.reference}</Badge>
          </Link>
        ) : null}
      </header>

      {/* -------------------------------------------------- messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {thread.messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">{t('inbox', 'startConversation')}</p>
        ) : (
          thread.messages.map((message, index) => {
            const previous = thread.messages[index - 1];
            const showDay =
              !previous || previous.createdAt.slice(0, 10) !== message.createdAt.slice(0, 10);

            return (
              <div key={message.id}>
                {showDay ? (
                  <p className="my-3 text-center text-xs text-ink-faint">
                    {formatDate(message.createdAt.slice(0, 10), 'medium')}
                  </p>
                ) : null}

                <div className={cx('flex', message.fromMe ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cx(
                      'max-w-[80%] rounded-2xl px-3.5 py-2',
                      message.fromMe
                        ? 'rounded-br-sm bg-brand-600 text-white'
                        : 'rounded-bl-sm bg-surface-sunken text-ink',
                    )}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                    <p
                      className={cx(
                        'mt-0.5 text-right text-[10px]',
                        message.fromMe ? 'text-white/70' : 'text-ink-faint',
                      )}
                    >
                      {new Date(message.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* -------------------------------------------------- composer */}
      <form onSubmit={send} className="shrink-0 border-t border-line p-3 safe-bottom">
        {error ? (
          <p role="alert" className="mb-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline, as in every
              // messaging app people already know.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder={t('inbox', 'typeMessage')}
            aria-label={t('inbox', 'typeMessage')}
            className="max-h-32 min-h-[44px] resize-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label={t('inbox', 'send')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-brand-300"
          >
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
