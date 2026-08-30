import { fromServiceError, ok, readJson, requireAuth, withMutation } from '@/lib/api/http';
import {
  deleteMessage,
  editMessage,
  markThreadRead,
  readThread,
  renderQuickReply,
  reportThread,
  sendMessage,
  setThreadArchived,
  setThreadRead,
} from '@/lib/services/messages';

/**
 * GET /api/inbox/:id
 *
 * Reading a conversation also marks it read, which is why this is a mutation
 * rather than a pure read.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const thread = await withMutation((db) => {
      markThreadRead(db, id, auth.user.id);
      return readThread(db, id, auth.user.id);
    });
    return ok(thread);
  } catch (error) {
    return fromServiceError(error);
  }
}

/**
 * POST /api/inbox/:id — send a message into the conversation.
 *
 * Contact details held back before confirmation come back as `stripped` rather
 * than as an error: the message did send, just redacted, and the sender needs
 * to know which parts were removed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{ body?: string; quickReplyId?: string }>(request);

  try {
    const result = await withMutation((db) => {
      // A quick reply is expanded server-side so the placeholders resolve
      // against the thread the operator is actually in.
      let text = String(body.body ?? '');
      if (body.quickReplyId) {
        const template = db.quickReplies.find(
          (q) => q.id === body.quickReplyId && q.ownerId === auth.user.id,
        );
        if (template) text = renderQuickReply(db, id, template.body);
      }

      const sent = sendMessage(db, id, auth.user.id, text);
      return { thread: readThread(db, id, auth.user.id), stripped: sent.stripped ?? null };
    });
    return ok(result, undefined, 201);
  } catch (error) {
    return fromServiceError(error);
  }
}

/**
 * PATCH /api/inbox/:id — thread and message state.
 *
 * `{ action }` covers archive/unarchive, read/unread and report;
 * `{ messageId, body }` edits, `{ messageId, deleted: true }` removes.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson<{
    action?: 'archive' | 'unarchive' | 'read' | 'unread' | 'report';
    messageId?: string;
    body?: string;
    deleted?: boolean;
  }>(request);

  try {
    const thread = await withMutation((db) => {
      if (body.messageId) {
        if (body.deleted) deleteMessage(db, body.messageId, auth.user.id);
        else editMessage(db, body.messageId, auth.user.id, String(body.body ?? ''));
      } else {
        switch (body.action) {
          case 'archive':
            setThreadArchived(db, id, auth.user.id, true);
            break;
          case 'unarchive':
            setThreadArchived(db, id, auth.user.id, false);
            break;
          case 'read':
            setThreadRead(db, id, auth.user.id, true);
            break;
          case 'unread':
            setThreadRead(db, id, auth.user.id, false);
            break;
          case 'report':
            reportThread(db, id, auth.user.id);
            break;
          default:
            break;
        }
      }
      return readThread(db, id, auth.user.id);
    });
    return ok(thread);
  } catch (error) {
    return fromServiceError(error);
  }
}
