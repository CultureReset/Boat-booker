import { newId } from '@/lib/core/ids';
import {
  MESSAGE_DELETE_WINDOW_HOURS,
  MESSAGE_EDIT_WINDOW_MINUTES,
  type Booking,
  type Database,
  type Message,
  type MessageThread,
  type SystemEventKey,
  type ThreadKind,
} from '@/lib/domain/types';
import { BYPASS_FLAG_THRESHOLD, moderateMessage, shouldFlagThread } from './moderation';
import { notify } from './notifications';
import { activeOfferForThread } from './offers';

/**
 * Messaging.
 *
 * Threads are always between exactly one customer and one owner about one
 * listing. Access is checked on every read and write — a thread ID alone is
 * never enough to see its contents.
 *
 * A thread carries three kinds of row: messages people wrote, photos they
 * attached, and system events (booking accepted, offer expired). Keeping system
 * events *in* the thread rather than in a side-channel activity log is what
 * makes the conversation readable months later.
 */

export class MessageError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'empty' | 'blocked' | 'too_late' | 'locked',
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'MessageError';
  }
}

export function canAccessThread(thread: MessageThread, userId: string): boolean {
  return thread.customerId === userId || thread.ownerId === userId;
}

function requireThread(db: Database, threadId: string, userId: string): MessageThread {
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) throw new MessageError('not_found', 'Conversation not found');
  if (!canAccessThread(thread, userId)) throw new MessageError('forbidden', 'Not your conversation');
  return thread;
}

function bookingFor(db: Database, thread: MessageThread): Booking | undefined {
  return thread.bookingId ? db.bookings.find((b) => b.id === thread.bookingId) : undefined;
}

function isArchivedFor(thread: MessageThread, userId: string): boolean {
  return thread.customerId === userId
    ? Boolean(thread.archivedByCustomer)
    : Boolean(thread.archivedByOwner);
}

export type ThreadFilter = 'latest' | 'unread' | 'priority' | 'support' | 'archived';

export interface ThreadSummary {
  id: string;
  kind: ThreadKind;
  subject: string;
  charterId: string;
  bookingId?: string;
  bookingReference?: string;
  bookingStatus?: Booking['status'];
  counterparty: { id: string; displayName: string; initials: string };
  lastMessage: { body: string; createdAt: string; fromMe: boolean; isSystem: boolean } | null;
  unreadCount: number;
  updatedAt: string;
  archived: boolean;
  flagged: boolean;
  /** An offer still awaiting an answer — the reason a thread needs attention. */
  hasPendingOffer: boolean;
  photo: { placeholder: string; altText: string } | null;
}

export function listThreads(
  db: Database,
  userId: string,
  filter: ThreadFilter = 'latest',
): ThreadSummary[] {
  const threads = db.threads.filter((t) => canAccessThread(t, userId));

  const messagesByThread = new Map<string, Message[]>();
  for (const message of db.messages) {
    if (message.deletedAt) continue;
    const list = messagesByThread.get(message.threadId);
    if (list) list.push(message);
    else messagesByThread.set(message.threadId, [message]);
  }

  const summaries = threads.map((thread) => {
    const messages = (messagesByThread.get(thread.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const last = messages[messages.length - 1] ?? null;

    const counterpartyId = thread.customerId === userId ? thread.ownerId : thread.customerId;
    const counterparty = db.users.find((u) => u.id === counterpartyId);
    const displayName = counterparty
      ? counterparty.ownerProfile?.companyName ||
        `${counterparty.firstName} ${counterparty.lastName}`
      : 'Unknown';

    const charter = db.charters.find((c) => c.id === thread.charterId);
    const booking = bookingFor(db, thread);

    return {
      id: thread.id,
      kind: thread.kind,
      subject: thread.subject,
      charterId: thread.charterId,
      bookingId: thread.bookingId,
      bookingReference: booking?.reference,
      bookingStatus: booking?.status,
      counterparty: { id: counterpartyId, displayName, initials: initialsFor(displayName) },
      lastMessage: last
        ? {
            body: last.systemEvent ? systemEventText(last.systemEvent) : last.body,
            createdAt: last.createdAt,
            fromMe: last.senderId === userId,
            isSystem: Boolean(last.systemEvent),
          }
        : null,
      // Unread means: sent by the other party and never marked read. System
      // rows have no sender, so they never inflate the badge.
      unreadCount: messages.filter((m) => m.senderId && m.senderId !== userId && !m.readAt).length,
      updatedAt: thread.updatedAt,
      archived: isArchivedFor(thread, userId),
      flagged: Boolean(thread.flaggedAt),
      hasPendingOffer: Boolean(activeOfferForThread(db, thread.id)),
      photo: charter?.photos[0]
        ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
        : null,
    };
  });

  const visible =
    filter === 'archived'
      ? summaries.filter((s) => s.archived)
      : summaries.filter((s) => !s.archived);

  const filtered =
    filter === 'unread'
      ? visible.filter((s) => s.unreadCount > 0)
      : filter === 'support'
        ? visible.filter((s) => s.kind === 'support')
        : filter === 'priority'
          ? // Priority means something is waiting on the reader: an unanswered
            // offer, a live booking request, or a flagged conversation.
            visible.filter(
              (s) =>
                s.hasPendingOffer ||
                s.flagged ||
                s.bookingStatus === 'pending' ||
                s.bookingStatus === 'request',
            )
          : visible;

  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function unreadCount(db: Database, userId: string): number {
  const threadIds = new Set(db.threads.filter((t) => canAccessThread(t, userId)).map((t) => t.id));
  return db.messages.filter(
    (m) =>
      threadIds.has(m.threadId) && m.senderId && m.senderId !== userId && !m.readAt && !m.deletedAt,
  ).length;
}

/** Human text for a system row, so the client never has to know the enum. */
export function systemEventText(event: SystemEventKey): string {
  const map: Record<SystemEventKey, string> = {
    booking_requested: 'Booking requested',
    booking_received: 'Booking request received',
    booking_accepted: 'Booking accepted',
    booking_confirmed: 'Booking confirmed',
    booking_declined: 'Booking declined',
    booking_cancelled: 'Booking canceled',
    booking_done: 'Trip completed',
    change_requested: 'Change requested',
    change_accepted: 'Change accepted',
    change_declined: 'Change declined',
    change_withdrawn: 'Change request withdrawn',
    change_expired: 'Change request expired',
    offer_sent: 'Offer sent',
    offer_withdrawn: 'Offer withdrawn',
    offer_expired: 'Offer expired',
    offer_accepted: 'Offer accepted',
    inquiry_sent: 'Inquiry sent',
    inquiry_declined: 'Inquiry declined',
    inquiry_pre_approved: 'Inquiry pre-approved',
  };
  return map[event];
}

export function readThread(db: Database, threadId: string, userId: string) {
  const thread = requireThread(db, threadId, userId);
  const messages = db.messages
    .filter((m) => m.threadId === thread.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const counterpartyId = thread.customerId === userId ? thread.ownerId : thread.customerId;
  const counterparty = db.users.find((u) => u.id === counterpartyId);
  const charter = db.charters.find((c) => c.id === thread.charterId);
  const booking = bookingFor(db, thread);
  const offer = activeOfferForThread(db, thread.id);
  const inquiry = thread.inquiryId ? db.inquiries.find((i) => i.id === thread.inquiryId) : undefined;
  const displayName = counterparty
    ? counterparty.ownerProfile?.companyName || `${counterparty.firstName} ${counterparty.lastName}`
    : 'Unknown';

  const isOwner = thread.ownerId === userId;
  const owner = db.users.find((u) => u.id === thread.ownerId);
  // Messaging goes quiet when the operator has nothing bookable — there is
  // nothing for the conversation to lead to.
  const ownerHasPublicListing = db.charters.some((c) => c.ownerId === thread.ownerId && c.published);

  return {
    id: thread.id,
    kind: thread.kind,
    subject: thread.subject,
    archived: isArchivedFor(thread, userId),
    flagged: Boolean(thread.flaggedAt),
    locked: !ownerHasPublicListing,
    role: isOwner ? ('owner' as const) : ('customer' as const),
    counterparty: { id: counterpartyId, displayName, initials: initialsFor(displayName) },
    charter: charter
      ? {
          id: charter.id,
          title: charter.title,
          photo: charter.photos[0]
            ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
            : null,
        }
      : null,
    booking: booking
      ? {
          id: booking.id,
          reference: booking.reference,
          date: booking.date,
          status: booking.status,
          adults: booking.adults,
          children: booking.children,
        }
      : null,
    offer: offer
      ? {
          id: offer.id,
          date: offer.date,
          departureTime: offer.departureTime,
          adults: offer.adults,
          children: offer.children,
          days: offer.days,
          price: offer.price,
          currency: offer.currency,
          expiresAt: offer.expiresAt,
          packageId: offer.packageId,
          customTrip: offer.customTrip ?? null,
        }
      : null,
    inquiry: inquiry
      ? { id: inquiry.id, status: inquiry.status, respondByAt: inquiry.respondByAt }
      : null,
    ownerName: owner ? owner.ownerProfile?.companyName || owner.firstName : null,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.deletedAt ? '' : m.body,
      createdAt: m.createdAt,
      fromMe: m.senderId === userId,
      readAt: m.readAt,
      deliveredAt: m.deliveredAt,
      editedAt: m.editedAt,
      deleted: Boolean(m.deletedAt),
      systemEvent: m.systemEvent ?? null,
      systemText: m.systemEvent ? systemEventText(m.systemEvent) : null,
      moderation: m.moderation ?? null,
      photo: m.photo ?? null,
      canEdit: canEdit(m, userId),
      canDelete: canDelete(m, userId),
    })),
  };
}

function canEdit(message: Message, userId: string): boolean {
  if (message.senderId !== userId || message.deletedAt || message.systemEvent) return false;
  const age = Date.now() - Date.parse(message.createdAt);
  return age <= MESSAGE_EDIT_WINDOW_MINUTES * 60_000;
}

function canDelete(message: Message, userId: string): boolean {
  if (message.senderId !== userId || message.deletedAt || message.systemEvent) return false;
  const age = Date.now() - Date.parse(message.createdAt);
  return age <= MESSAGE_DELETE_WINDOW_HOURS * 3_600_000;
}

export function markThreadRead(db: Database, threadId: string, userId: string): number {
  const thread = requireThread(db, threadId, userId);
  const now = new Date().toISOString();
  let marked = 0;

  for (const message of db.messages) {
    if (
      message.threadId === thread.id &&
      message.senderId &&
      message.senderId !== userId &&
      !message.readAt
    ) {
      message.readAt = now;
      marked += 1;
    }
  }
  return marked;
}

export function setThreadRead(db: Database, threadId: string, userId: string, read: boolean): void {
  const thread = requireThread(db, threadId, userId);
  if (read) {
    markThreadRead(db, threadId, userId);
    return;
  }
  // Marking unread only clears the most recent inbound message — enough to
  // resurface the thread without pretending the whole history is new.
  const inbound = db.messages
    .filter((m) => m.threadId === thread.id && m.senderId && m.senderId !== userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (inbound[0]) inbound[0].readAt = undefined;
}

export function setThreadArchived(
  db: Database,
  threadId: string,
  userId: string,
  archived: boolean,
): void {
  const thread = requireThread(db, threadId, userId);
  // Archiving is per-person: an operator tidying their inbox must not remove
  // the conversation from the guest's.
  if (thread.customerId === userId) thread.archivedByCustomer = archived;
  else thread.archivedByOwner = archived;
}

export function reportThread(db: Database, threadId: string, userId: string): void {
  const thread = requireThread(db, threadId, userId);
  thread.reportedAt = new Date().toISOString();
}

export interface SendResult {
  message: Message;
  /** Present when contact details were held back. */
  stripped?: string[];
}

export function sendMessage(
  db: Database,
  threadId: string,
  userId: string,
  body: string,
  options: { photoId?: string } = {},
): SendResult {
  const thread = requireThread(db, threadId, userId);
  const trimmed = body.trim();
  if (!trimmed && !options.photoId) throw new MessageError('empty', 'Message is empty');

  const booking = bookingFor(db, thread);
  const verdict = moderateMessage(trimmed, thread, booking);

  if (verdict.action === 'block') {
    recordBypassAttempt(db, thread, userId);
    throw new MessageError(
      'blocked',
      'Messages requesting off-platform contact or payment cannot be sent',
      verdict.matched,
    );
  }

  const now = new Date().toISOString();
  const message: Message = {
    id: newId(),
    threadId: thread.id,
    senderId: userId,
    // Cap length so a single message cannot bloat the snapshot.
    body: verdict.body.slice(0, 4000),
    createdAt: now,
    deliveredAt: now,
    moderation: verdict.action === 'strip' ? 'contact_stripped' : undefined,
  };

  db.messages.push(message);
  thread.updatedAt = now;

  const recipientId = thread.customerId === userId ? thread.ownerId : thread.customerId;
  const sender = db.users.find((u) => u.id === userId);
  notify(db, recipientId, {
    type: 'im_new_message',
    category: 'message',
    title: `New message from ${sender?.firstName ?? 'a member'}`,
    body: message.body.slice(0, 120),
    href:
      thread.customerId === recipientId ? `/account/inbox/${thread.id}` : `/owner/inbox/${thread.id}`,
  });

  return { message, stripped: verdict.action === 'strip' ? verdict.removed : undefined };
}

/**
 * Records a blocked attempt against the sender's account health.
 *
 * Counted per operator, because that is who the throttle applies to; a guest
 * pushing for an off-platform deal gets the block and the warning but no
 * lasting mark, since they have no listing to suspend.
 */
function recordBypassAttempt(db: Database, thread: MessageThread, senderId: string): void {
  if (senderId !== thread.ownerId) return;

  const health = db.accountHealth.find((h) => h.ownerId === thread.ownerId);
  if (!health) return;

  const prior = health.bypassAttempts;
  health.bypassAttempts = prior + 1;
  health.updatedAt = new Date().toISOString();

  if (shouldFlagThread(prior)) {
    thread.flaggedAt = new Date().toISOString();
    notify(db, thread.customerId, {
      type: 'bypassWarning',
      category: 'system',
      title: 'Be careful with this request',
      body: 'This conversation shows unusual activity. Tap to review.',
      href: `/account/inbox/${thread.id}`,
    });
  }
}

export const BYPASS_ATTEMPTS_BEFORE_FLAG = BYPASS_FLAG_THRESHOLD;

export function editMessage(db: Database, messageId: string, userId: string, body: string): Message {
  const message = db.messages.find((m) => m.id === messageId);
  if (!message) throw new MessageError('not_found', 'Message not found');
  const thread = requireThread(db, message.threadId, userId);
  if (message.senderId !== userId) throw new MessageError('forbidden', 'Not your message');
  if (!canEdit(message, userId)) {
    throw new MessageError(
      'too_late',
      `Messages can only be edited for ${MESSAGE_EDIT_WINDOW_MINUTES} minutes`,
    );
  }

  const trimmed = body.trim();
  if (!trimmed) throw new MessageError('empty', 'Message is empty');

  const verdict = moderateMessage(trimmed, thread, bookingFor(db, thread));
  if (verdict.action === 'block') {
    throw new MessageError('blocked', 'That edit cannot be saved', verdict.matched);
  }

  message.body = verdict.body.slice(0, 4000);
  message.editedAt = new Date().toISOString();
  message.moderation = verdict.action === 'strip' ? 'contact_stripped' : undefined;
  return message;
}

/**
 * Soft-deletes a message for everyone in the thread.
 *
 * The row stays so the conversation does not silently reorder around a hole —
 * the client renders it as "Message deleted".
 */
export function deleteMessage(db: Database, messageId: string, userId: string): Message {
  const message = db.messages.find((m) => m.id === messageId);
  if (!message) throw new MessageError('not_found', 'Message not found');
  requireThread(db, message.threadId, userId);
  if (message.senderId !== userId) throw new MessageError('forbidden', 'Not your message');
  if (!canDelete(message, userId)) {
    throw new MessageError(
      'too_late',
      `Messages can only be deleted for ${MESSAGE_DELETE_WINDOW_HOURS} hours`,
    );
  }

  message.deletedAt = new Date().toISOString();
  message.body = '';
  return message;
}

/**
 * Open (or reuse) a conversation about a listing. Reused deliberately: a guest
 * asking a second question should land in the same thread, not start a new one.
 */
export function startThread(
  db: Database,
  input: { customerId: string; charterId: string; body: string },
): MessageThread {
  const charter = db.charters.find((c) => c.id === input.charterId);
  if (!charter) throw new MessageError('not_found', 'Listing not found');

  const existing = db.threads.find(
    (t) => t.customerId === input.customerId && t.charterId === charter.id && !t.bookingId,
  );

  const now = new Date().toISOString();
  const thread =
    existing ??
    (() => {
      const created: MessageThread = {
        id: newId(),
        kind: 'inquiry',
        customerId: input.customerId,
        ownerId: charter.ownerId,
        charterId: charter.id,
        subject: charter.title,
        createdAt: now,
        updatedAt: now,
      };
      db.threads.push(created);
      return created;
    })();

  sendMessage(db, thread.id, input.customerId, input.body);
  return thread;
}

/**
 * Fills `{{variable}}` slots in a quick reply from the thread's own context.
 *
 * Unresolvable placeholders are left visible rather than blanked, so the
 * operator sees what is missing before they send instead of after.
 */
export function renderQuickReply(db: Database, threadId: string, template: string): string {
  const thread = db.threads.find((t) => t.id === threadId);
  if (!thread) return template;

  const customer = db.users.find((u) => u.id === thread.customerId);
  const owner = db.users.find((u) => u.id === thread.ownerId);
  const charter = db.charters.find((c) => c.id === thread.charterId);
  const booking = bookingFor(db, thread);

  const values: Record<string, string | undefined> = {
    customer_name: customer?.firstName,
    captain_name: owner?.ownerProfile?.captainName || owner?.firstName,
    charter_title: charter?.title,
    trip_date: booking?.date,
    departure_time: booking?.departureTime,
    group_size: booking ? `${booking.adults + booking.children}` : undefined,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
}

/** Placeholders in a template that this thread cannot fill. */
export function unresolvedPlaceholders(db: Database, threadId: string, template: string): string[] {
  const rendered = renderQuickReply(db, threadId, template);
  return [...rendered.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
