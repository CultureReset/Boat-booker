'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { formatMoney } from '@/lib/core/money';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Conversation view.
 *
 * Modelled on the real app, which renders the two sides differently on
 * purpose: the guest app shows messages as flat rows with an avatar and a bold
 * name, the operator app shows them as outlined bubbles with the avatar outside
 * and a delivery receipt. Both share the context bar at the top — a status chip
 * and a "View details" link — because on a phone that bar is the only thing
 * telling you which booking you are talking about.
 */

export interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  fromMe: boolean;
  readAt?: string;
  deliveredAt?: string;
  editedAt?: string;
  deleted: boolean;
  systemEvent: string | null;
  systemText: string | null;
  moderation: 'contact_stripped' | 'policy_warning' | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ThreadOffer {
  id: string;
  date: string;
  departureTime: string;
  adults: number;
  children: number;
  days: number;
  price: number;
  currency: string;
  expiresAt: string;
  packageId: string | null;
  customTrip: { title: string; description: string; hours: number } | null;
}

export interface ThreadDetail {
  id: string;
  kind: 'inquiry' | 'booking' | 'offer' | 'support';
  subject: string;
  archived: boolean;
  flagged: boolean;
  locked: boolean;
  role: 'customer' | 'owner';
  counterparty: { id: string; displayName: string; initials: string };
  charter: { id: string; title: string; photo: { placeholder: string; altText: string } | null } | null;
  booking: {
    id: string;
    reference: string;
    date: string;
    status: string;
    adults: number;
    children: number;
  } | null;
  offer: ThreadOffer | null;
  inquiry: { id: string; status: string; respondByAt: string } | null;
  ownerName: string | null;
  messages: ThreadMessage[];
}

export interface QuickReplyOption {
  id: string;
  title: string;
  body: string;
}

/** Green for live, red for ended — the two states the context bar signals. */
const STATUS_TONE: Record<string, 'success' | 'danger' | 'brand' | 'neutral'> = {
  request: 'brand',
  pending: 'brand',
  confirmed: 'success',
  accepted: 'success',
  change_requested: 'brand',
  change_pending: 'brand',
  cancel_requested: 'danger',
  cancelled: 'danger',
  declined: 'danger',
  withdrawn: 'neutral',
  done: 'neutral',
};

const STATUS_KEY: Record<string, string> = {
  request: 'statusRequest',
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  accepted: 'statusAccepted',
  change_requested: 'statusChangeRequested',
  change_pending: 'statusChangePending',
  cancel_requested: 'statusCancelRequested',
  cancelled: 'statusCancelled',
  declined: 'statusDeclined',
  withdrawn: 'statusWithdrawn',
  done: 'statusCompleted',
};

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "2 days", "6 hours", "45 minutes" — coarse enough not to tick visibly. */
function timeRemaining(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return '0 minutes';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

export function ThreadView({
  thread: initial,
  basePath,
  quickReplies = [],
}: {
  thread: ThreadDetail;
  basePath: '/account/inbox' | '/owner/inbox';
  quickReplies?: QuickReplyOption[];
}) {
  const router = useRouter();
  const isOwner = basePath === '/owner/inbox';

  const [thread, setThread] = useState(initial);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [stripped, setStripped] = useState<string[] | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState<ThreadMessage | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ThreadMessage | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.messages.length]);

  const detailHref = thread.booking
    ? `${isOwner ? '/owner' : '/account'}/bookings/${thread.booking.id}`
    : thread.charter
      ? `/charters/view/${thread.charter.id}`
      : null;

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;

    setBusy(true);
    setError(null);
    setStripped(null);
    try {
      const result = await api.post<{ thread: ThreadDetail; stripped: string[] | null }>(
        `/api/inbox/${thread.id}`,
        { body },
      );
      setThread(result.thread);
      setDraft('');
      if (result.stripped?.length) setStripped(result.stripped);
      router.refresh();
    } catch (caught) {
      const details = (caught as { details?: unknown })?.details;
      if ((caught as { code?: string })?.code === 'blocked') {
        setBlocked(Array.isArray(details) ? (details as string[]) : []);
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<ThreadDetail>(`/api/inbox/${thread.id}`, payload);
      setThread(updated);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const respondToOffer = async (action: 'withdraw') => {
    if (!thread.offer) return;
    setBusy(true);
    try {
      await api.patch('/api/offers', { offerId: thread.offer.id, action });
      router.refresh();
      setThread({ ...thread, offer: null });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const respondToInquiry = async (action: 'pre_approve' | 'decline') => {
    if (!thread.inquiry) return;
    setBusy(true);
    try {
      await api.patch('/api/offers', { inquiryId: thread.inquiry.id, action });
      router.refresh();
      setThread({
        ...thread,
        inquiry: { ...thread.inquiry, status: action === 'pre_approve' ? 'pre_approved' : 'declined' },
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col rounded-card border border-line bg-white">
      <ThreadHeader
        thread={thread}
        basePath={basePath}
        busy={busy}
        onArchive={() => patch({ action: thread.archived ? 'unarchive' : 'archive' })}
        onMarkUnread={() => patch({ action: 'unread' })}
      />

      {/* Context bar — status chip and the way back to the booking. */}
      {thread.booking ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-sunken px-3 py-2">
          <Badge tone={STATUS_TONE[thread.booking.status] ?? 'neutral'}>
            {t('bookings', STATUS_KEY[thread.booking.status] ?? 'statusPending').toUpperCase()}
          </Badge>
          {detailHref ? (
            <Link href={detailHref} className="text-sm font-semibold text-brand-700 hover:underline">
              {t('inbox', 'viewDetails')}
            </Link>
          ) : null}
        </div>
      ) : null}

      {thread.flagged ? (
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="flex shrink-0 items-start gap-2 border-b border-danger/30 bg-danger/10 px-3 py-2 text-left"
        >
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-danger" />
          <span className="min-w-0">
            <span className="block text-xs font-bold text-danger">{t('inbox', 'flaggedTitle')}</span>
            <span className="block text-xs text-ink-soft">{t('inbox', 'flaggedBody')}</span>
          </span>
        </button>
      ) : null}

      {/* -------------------------------------------------- messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {thread.inquiry && thread.inquiry.status === 'open' ? (
          <InquiryCard
            thread={thread}
            isOwner={isOwner}
            busy={busy}
            onRespond={respondToInquiry}
          />
        ) : null}

        {thread.offer ? (
          <OfferCard
            offer={thread.offer}
            thread={thread}
            isOwner={isOwner}
            busy={busy}
            onWithdraw={() => respondToOffer('withdraw')}
          />
        ) : isOwner && !thread.booking ? (
          // Only one offer can be outstanding at a time, so this prompt appears
          // exactly when the operator is free to send one.
          <Link
            href={`/offer/create?thread=${thread.id}`}
            className="flex items-center gap-3 rounded-card border border-dashed border-brand-300 bg-brand-50/50 p-3 transition-colors hover:bg-brand-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <Icon name="plus" size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{t('inbox', 'createOffer')}</span>
              <span className="block text-xs text-ink-muted">
                {t('inbox', 'createOfferDescription', { name: thread.counterparty.displayName })}
              </span>
            </span>
          </Link>
        ) : null}

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
                  <p className="my-3 text-center text-xs font-semibold text-ink-faint">
                    {formatDate(message.createdAt.slice(0, 10), 'medium')}
                  </p>
                ) : null}

                {message.systemEvent ? (
                  <SystemRow text={message.systemText ?? ''} time={clockTime(message.createdAt)} />
                ) : isOwner ? (
                  <BubbleRow
                    message={message}
                    initials={thread.counterparty.initials}
                    onEdit={() => {
                      setEditing(message);
                      setEditDraft(message.body);
                    }}
                    onDelete={() => setConfirmDelete(message)}
                  />
                ) : (
                  <FlatRow
                    message={message}
                    name={message.fromMe ? 'You' : thread.counterparty.displayName}
                    initials={message.fromMe ? 'You'.slice(0, 1) : thread.counterparty.initials}
                    onEdit={() => {
                      setEditing(message);
                      setEditDraft(message.body);
                    }}
                    onDelete={() => setConfirmDelete(message)}
                  />
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* -------------------------------------------------- composer */}
      {thread.locked ? (
        <div className="shrink-0 border-t border-line p-4 text-center safe-bottom">
          <p className="text-sm font-bold text-ink">
            {t('inbox', isOwner ? 'lockedTitleOwner' : 'lockedTitleCustomer')}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {t('inbox', isOwner ? 'lockedBodyOwner' : 'lockedBodyCustomer')}
          </p>
        </div>
      ) : (
        <form onSubmit={send} className="shrink-0 border-t border-line p-3 safe-bottom">
          {stripped?.length ? (
            <p className="mb-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-ink-soft">
              <strong className="block text-ink">{t('inbox', 'contactStrippedTitle')}</strong>
              {t('inbox', 'contactStrippedBody', { items: stripped.join(', ') })}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mb-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          {/* Quick Replies are an operator-only affordance. */}
          {isOwner ? (
            <button
              type="button"
              onClick={() => setShowReplies(true)}
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface-sunken"
            >
              <Icon name="bolt" size={13} />
              {t('inbox', 'useQuickReplies')}
            </button>
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
                  void send();
                }
              }}
              rows={1}
              placeholder={t('inbox', 'typeMessage')}
              aria-label={t('inbox', 'typeMessage')}
              className="max-h-32 min-h-[44px] resize-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t('inbox', 'send')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-brand-300"
            >
              <Icon name="arrow-right" size={18} />
            </button>
          </div>
        </form>
      )}

      {/* ---------------------------------------------------- overlays */}
      <Overlay
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title={t('inbox', 'blockedTitle')}
      >
        <p className="text-sm text-ink-soft">{t('inbox', 'blockedBody', { brand: brand.name })}</p>
        {blocked?.length ? (
          <ul className="mt-3 space-y-1">
            {blocked.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-ink">
                <Icon name="alert" size={14} className="text-danger" />
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        <Button className="mt-4 w-full" onClick={() => setBlocked(null)}>
          {t('inbox', 'blockedEdit')}
        </Button>
      </Overlay>

      <Overlay open={showReport} onClose={() => setShowReport(false)} title={t('inbox', 'reportTitle')}>
        <p className="text-sm text-ink-soft">{t('inbox', 'reportBody', { brand: brand.name })}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowReport(false)}>
            {t('general', 'cancel')}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await patch({ action: 'report' });
              setShowReport(false);
            }}
          >
            {t('inbox', 'report')}
          </Button>
        </div>
      </Overlay>

      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('inbox', 'editMessage')}
      >
        <Textarea
          value={editDraft}
          onChange={(e) => setEditDraft(e.target.value)}
          rows={4}
          aria-label={t('inbox', 'editMessage')}
        />
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
            {t('general', 'cancel')}
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              if (editing) await patch({ messageId: editing.id, body: editDraft });
              setEditing(null);
            }}
          >
            {t('inbox', 'saveEdit')}
          </Button>
        </div>
      </Overlay>

      <Overlay
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t('inbox', 'deleteConfirmTitle')}
      >
        <p className="text-sm text-ink-soft">{t('inbox', 'deleteConfirmBody')}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)}>
            {t('general', 'cancel')}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (confirmDelete) await patch({ messageId: confirmDelete.id, deleted: true });
              setConfirmDelete(null);
            }}
          >
            {t('general', 'delete')}
          </Button>
        </div>
      </Overlay>

      <Overlay
        open={showReplies}
        onClose={() => setShowReplies(false)}
        title={t('inbox', 'quickRepliesTitle')}
      >
        {quickReplies.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('inbox', 'quickRepliesEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {quickReplies.map((reply) => (
              <li key={reply.id}>
                <button
                  type="button"
                  onClick={async () => {
                    setShowReplies(false);
                    setBusy(true);
                    try {
                      const result = await api.post<{ thread: ThreadDetail }>(
                        `/api/inbox/${thread.id}`,
                        { quickReplyId: reply.id },
                      );
                      setThread(result.thread);
                      router.refresh();
                    } catch (caught) {
                      setError(errorMessage(caught));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full rounded-lg border border-line p-3 text-left transition-colors hover:bg-surface-sunken"
                >
                  <span className="block text-sm font-bold text-ink">{reply.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-xs text-ink-muted">{reply.body}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/owner/quick-replies"
          className="mt-3 block text-center text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('inbox', 'manageQuickReplies')}
        </Link>
      </Overlay>
    </div>
  );
}

function ThreadHeader({
  thread,
  basePath,
  busy,
  onArchive,
  onMarkUnread,
}: {
  thread: ThreadDetail;
  basePath: string;
  busy: boolean;
  onArchive: () => void;
  onMarkUnread: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative flex shrink-0 items-center gap-3 border-b border-line p-3">
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('general', 'more')}
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-sunken"
      >
        <Icon name="menu" size={18} />
      </button>

      {open ? (
        <div className="absolute right-3 top-14 z-20 w-52 overflow-hidden rounded-card border border-line bg-white shadow-lg">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onMarkUnread();
              setOpen(false);
            }}
            className="block w-full px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-sunken"
          >
            {t('inbox', 'markAsUnread')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onArchive();
              setOpen(false);
            }}
            className="block w-full px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-sunken"
          >
            {t('inbox', thread.archived ? 'unarchive' : 'archive')}
          </button>
        </div>
      ) : null}
    </header>
  );
}

/** Full-width grey row — how the real app renders booking activity. */
function SystemRow({ text, time }: { text: string; time: string }) {
  return (
    <p className="my-2 rounded-lg bg-surface-sunken px-3 py-2 text-center text-xs font-medium text-ink-soft">
      {text} · {time}
    </p>
  );
}

/** Guest-app style: avatar, bold name, plain body, all left-aligned. */
function FlatRow({
  message,
  name,
  initials,
  onEdit,
  onDelete,
}: {
  message: ThreadMessage;
  name: string;
  initials: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex gap-2.5 py-1.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">
          {name}
          <span className="ml-2 text-[11px] font-normal text-ink-faint">
            {clockTime(message.createdAt)}
          </span>
        </p>
        <MessageBody message={message} />
        <MessageActions message={message} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

/** Operator-app style: outlined bubbles, avatar outside, delivery receipt. */
function BubbleRow({
  message,
  initials,
  onEdit,
  onDelete,
}: {
  message: ThreadMessage;
  initials: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cx('group flex items-end gap-2 py-1', message.fromMe && 'flex-row-reverse')}>
      {!message.fromMe ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
          {initials}
        </span>
      ) : (
        <span className="w-8 shrink-0" aria-hidden />
      )}

      <div
        className={cx(
          'max-w-[78%] rounded-2xl border px-3.5 py-2',
          message.fromMe ? 'border-brand-200 bg-brand-50' : 'border-line bg-white',
        )}
      >
        <MessageBody message={message} />
        <p className="mt-1 flex items-center gap-2 text-[10px] text-ink-faint">
          <span>{clockTime(message.createdAt)}</span>
          {message.fromMe ? (
            <span className="ml-auto font-medium">
              {message.readAt ? t('inbox', 'read') : t('inbox', 'delivered')}
            </span>
          ) : null}
        </p>
        <MessageActions message={message} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

function MessageBody({ message }: { message: ThreadMessage }) {
  if (message.deleted) {
    return <p className="text-sm italic text-ink-faint">{t('inbox', 'messageDeleted')}</p>;
  }
  return (
    <>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{message.body}</p>
      {message.editedAt ? (
        <span className="text-[10px] text-ink-faint">{t('inbox', 'edited')}</span>
      ) : null}
      {message.moderation === 'contact_stripped' ? (
        <span className="mt-1 flex items-center gap-1 text-[10px] text-warning">
          <Icon name="shield" size={11} />
          {t('inbox', 'contactStrippedTitle')}
        </span>
      ) : null}
    </>
  );
}

/** Edit and delete only appear inside their windows, and only on hover/focus. */
function MessageActions({
  message,
  onEdit,
  onDelete,
}: {
  message: ThreadMessage;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!message.canEdit && !message.canDelete) return null;

  return (
    <span className="mt-1 flex gap-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {message.canEdit ? (
        <button type="button" onClick={onEdit} className="text-[11px] font-semibold text-brand-700">
          {t('inbox', 'edit')}
        </button>
      ) : null}
      {message.canDelete ? (
        <button type="button" onClick={onDelete} className="text-[11px] font-semibold text-danger">
          {t('general', 'delete')}
        </button>
      ) : null}
    </span>
  );
}

function InquiryCard({
  thread,
  isOwner,
  busy,
  onRespond,
}: {
  thread: ThreadDetail;
  isOwner: boolean;
  busy: boolean;
  onRespond: (action: 'pre_approve' | 'decline') => void;
}) {
  if (!thread.inquiry) return null;

  return (
    <section className="rounded-card border border-brand-200 bg-brand-50/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
        {t('inbox', 'inquiryTitle')}
      </p>
      <p className="mt-1 text-sm font-bold text-ink">
        {isOwner
          ? t('inbox', 'inquiryHeadingOwner', { name: thread.counterparty.displayName })
          : t('inbox', 'inquiryHeadingCustomer', { name: thread.counterparty.displayName })}
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">
        {t('inbox', isOwner ? 'inquiryBodyOwner' : 'inquiryBodyCustomer')}
      </p>
      <p className="mt-1 text-xs font-semibold text-ink-muted">
        {t('inbox', 'respondWithin', { time: timeRemaining(thread.inquiry.respondByAt) })}
      </p>

      {isOwner ? (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            className="flex-1"
            onClick={() => onRespond('decline')}
          >
            {t('inbox', 'declineInquiry')}
          </Button>
          <Button size="sm" disabled={busy} className="flex-1" onClick={() => onRespond('pre_approve')}>
            {t('inbox', 'preApprove')}
          </Button>
        </div>
      ) : thread.charter ? (
        <Link
          href={`/charters/view/${thread.charter.id}`}
          className="mt-3 block rounded-control bg-brand-600 py-2 text-center text-sm font-bold text-white"
        >
          {t('listingCard', 'seeAvailability')}
        </Link>
      ) : null}
    </section>
  );
}

/**
 * The offer card.
 *
 * Shows the countdown prominently for the guest — the offer is the only thing
 * in the product with a hard deadline they can lose by ignoring — and shows the
 * operator that their calendar stays open in the meantime, which is the
 * question they actually have.
 */
function OfferCard({
  offer,
  thread,
  isOwner,
  busy,
  onWithdraw,
}: {
  offer: ThreadOffer;
  thread: ThreadDetail;
  isOwner: boolean;
  busy: boolean;
  onWithdraw: () => void;
}) {
  const remaining = useMemo(() => timeRemaining(offer.expiresAt), [offer.expiresAt]);
  const guests = offer.adults + offer.children;

  const bookHref = thread.charter
    ? `/book?charter=${thread.charter.id}&offer=${offer.id}`
    : null;

  return (
    <section className="rounded-card border border-brand-300 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
        {t('inbox', 'offerTitle')}
      </p>
      <p className="mt-1 text-sm font-bold text-ink">
        {isOwner
          ? t('inbox', 'offerSentHeading', { name: thread.counterparty.displayName })
          : t('inbox', 'offerReceivedHeading', { name: thread.counterparty.displayName })}
      </p>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label={t('booking', 'tripDate')} value={formatDate(offer.date, 'medium')} />
        <Row label={t('inbox', 'offerTitle')} value={offer.customTrip?.title ?? thread.subject} />
        <Row label={t('pickers', 'groupSizeLabel')} value={`${guests}`} />
        <Row label={t('booking', 'tripTime')} value={offer.departureTime} />
        <Row
          label={t('inbox', 'offerPrice')}
          value={formatMoney(offer.price, offer.currency)}
          strong
        />
      </dl>

      <p className="mt-2 text-xs text-ink-muted">
        {isOwner
          ? `${t('inbox', 'offerValidFor', { hours: '48' })} ${t('inbox', 'offerCalendarOpen')}`
          : t('inbox', 'offerExpiresIn', { time: remaining })}
      </p>

      {isOwner ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          className="mt-3 w-full"
          onClick={onWithdraw}
        >
          {t('inbox', 'withdrawOffer')}
        </Button>
      ) : bookHref ? (
        <Link
          href={bookHref}
          className="mt-3 block rounded-control bg-accent py-2.5 text-center text-sm font-bold text-white"
        >
          {t('inbox', 'bookThisOffer')}
        </Link>
      ) : null}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={cx('text-right', strong ? 'text-base font-bold text-success' : 'text-sm text-ink')}>
        {value}
      </dd>
    </div>
  );
}
