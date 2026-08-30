import { newId } from '@/lib/core/ids';
import type { Database, Message, MessageThread } from '@/lib/domain/types';
import { notify } from './bookings';

/**
 * Messaging.
 *
 * Threads are always between exactly one customer and one owner about one
 * listing. Access is checked on every read and write — a thread ID alone is
 * never enough to see its contents.
 */

export class MessageError extends Error {
  constructor(readonly code: 'not_found' | 'forbidden' | 'empty', message: string) {
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

export interface ThreadSummary {
  id: string;
  subject: string;
  charterId: string;
  bookingId?: string;
  bookingReference?: string;
  counterparty: { id: string; displayName: string; initials: string };
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null;
  unreadCount: number;
  updatedAt: string;
  photo: { placeholder: string; altText: string } | null;
}

export function listThreads(db: Database, userId: string): ThreadSummary[] {
  const threads = db.threads.filter((t) => canAccessThread(t, userId));

  const messagesByThread = new Map<string, Message[]>();
  for (const message of db.messages) {
    const list = messagesByThread.get(message.threadId);
    if (list) list.push(message);
    else messagesByThread.set(message.threadId, [message]);
  }

  return threads
    .map((thread) => {
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
      const booking = thread.bookingId ? db.bookings.find((b) => b.id === thread.bookingId) : undefined;

      return {
        id: thread.id,
        subject: thread.subject,
        charterId: thread.charterId,
        bookingId: thread.bookingId,
        bookingReference: booking?.reference,
        counterparty: {
          id: counterpartyId,
          displayName,
          initials: initialsFor(displayName),
        },
        lastMessage: last
          ? { body: last.body, createdAt: last.createdAt, fromMe: last.senderId === userId }
          : null,
        // Unread means: sent by the other party and never marked read.
        unreadCount: messages.filter((m) => m.senderId !== userId && !m.readAt).length,
        updatedAt: thread.updatedAt,
        photo: charter?.photos[0]
          ? { placeholder: charter.photos[0].placeholder, altText: charter.photos[0].altText }
          : null,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function unreadCount(db: Database, userId: string): number {
  const threadIds = new Set(db.threads.filter((t) => canAccessThread(t, userId)).map((t) => t.id));
  return db.messages.filter((m) => threadIds.has(m.threadId) && m.senderId !== userId && !m.readAt)
    .length;
}

export function readThread(db: Database, threadId: string, userId: string) {
  const thread = requireThread(db, threadId, userId);
  const messages = db.messages
    .filter((m) => m.threadId === thread.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const counterpartyId = thread.customerId === userId ? thread.ownerId : thread.customerId;
  const counterparty = db.users.find((u) => u.id === counterpartyId);
  const charter = db.charters.find((c) => c.id === thread.charterId);
  const booking = thread.bookingId ? db.bookings.find((b) => b.id === thread.bookingId) : undefined;
  const displayName = counterparty
    ? counterparty.ownerProfile?.companyName || `${counterparty.firstName} ${counterparty.lastName}`
    : 'Unknown';

  return {
    id: thread.id,
    subject: thread.subject,
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
      ? { id: booking.id, reference: booking.reference, date: booking.date, status: booking.status }
      : null,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      fromMe: m.senderId === userId,
      readAt: m.readAt,
    })),
  };
}

export function markThreadRead(db: Database, threadId: string, userId: string): number {
  const thread = requireThread(db, threadId, userId);
  const now = new Date().toISOString();
  let marked = 0;

  for (const message of db.messages) {
    if (message.threadId === thread.id && message.senderId !== userId && !message.readAt) {
      message.readAt = now;
      marked += 1;
    }
  }
  return marked;
}

export function sendMessage(
  db: Database,
  threadId: string,
  userId: string,
  body: string,
): Message {
  const thread = requireThread(db, threadId, userId);
  const trimmed = body.trim();
  if (!trimmed) throw new MessageError('empty', 'Message is empty');

  const now = new Date().toISOString();
  const message: Message = {
    id: newId(),
    threadId: thread.id,
    senderId: userId,
    // Cap length so a single message cannot bloat the snapshot.
    body: trimmed.slice(0, 4000),
    createdAt: now,
  };

  db.messages.push(message);
  thread.updatedAt = now;

  const recipientId = thread.customerId === userId ? thread.ownerId : thread.customerId;
  const sender = db.users.find((u) => u.id === userId);
  notify(db, recipientId, {
    kind: 'message',
    title: `New message from ${sender?.firstName ?? 'a member'}`,
    body: trimmed.slice(0, 120),
    href: thread.customerId === recipientId ? `/account/inbox/${thread.id}` : `/owner/inbox/${thread.id}`,
  });

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

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
