import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import { getDb, mutate } from '@/lib/storage';
import type { Database, User } from '@/lib/domain/types';
import { settleElapsedBookings } from '@/lib/services/bookings';
import { settleElapsedOffers } from '@/lib/services/offers';

/**
 * Shared HTTP plumbing for the route handlers.
 *
 * Every endpoint returns the same envelope — `{ data, code }` on success,
 * `{ error: { code, message, details }, code }` on failure — so the client has
 * exactly one response shape to handle. Errors thrown by the service layer are
 * translated here rather than in each route.
 */

export interface ApiEnvelope<T> {
  data: T;
  code: number;
  metadata?: unknown;
}

export function ok<T>(data: T, metadata?: unknown, status = 200): NextResponse {
  const body: ApiEnvelope<T> = { data, code: status };
  if (metadata !== undefined) body.metadata = metadata;
  return NextResponse.json(body, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ error: { code, message, details }, code: status }, { status });
}

export const unauthorized = () => fail('unauthorized', 'You must be logged in', 401);
export const forbidden = (message = 'You do not have access to this') =>
  fail('forbidden', message, 403);
export const notFound = (message = 'Not found') => fail('not_found', message, 404);

/** Map a service-layer error onto the right status code. */
export function fromServiceError(error: unknown): NextResponse {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const code = String((error as { code: unknown }).code);
    const message = String((error as { message: unknown }).message);
    const details = (error as { details?: unknown }).details;

    const status =
      code === 'forbidden' ? 403
      : code === 'not_found' || code.endsWith('_not_found') ? 404
      : code === 'unavailable' || code === 'already_pending' ? 409
      // A blocked message is a policy refusal, not a malformed request, and the
      // client shows a different modal for it.
      : code === 'blocked' ? 422
      // Gone, not bad: the offer or payment link was valid and has lapsed.
      : code === 'expired' ? 410
      : code === 'rate_limited' ? 429
      : 400;

    return fail(code, message, status, details);
  }

  if (process.env.NODE_ENV !== 'production') console.error('[api] unhandled', error);
  return fail('server_error', 'Something went wrong', 500);
}

/** Parse a JSON body, tolerating an empty or malformed payload. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const body = await request.json();
    return (body ?? {}) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Read handler with the database resolved. Elapsed bookings are settled on
 * read so the demo advances with wall-clock time rather than needing a cron.
 */
export async function withDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await getDb();
  return fn(db);
}

/** Write handler. The callback runs inside a persisted mutation. */
export async function withMutation<T>(fn: (db: Database) => T): Promise<T> {
  return mutate(fn);
}

/**
 * Advance anything whose clock has run out. Cheap and idempotent.
 *
 * Expiry is observed on read rather than driven by a scheduler, so the demo
 * advances with wall-clock time on any machine without a cron. The `some()`
 * guards keep the common case to a scan with no write.
 */
export async function settle(): Promise<void> {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);

  const bookingsDue = db.bookings.some(
    (b) =>
      (b.status === 'confirmed' && b.date < todayIso) ||
      (b.status === 'pending' && b.respondByAt && b.respondByAt < nowIso),
  );
  const offersDue =
    db.offers.some((o) => o.status === 'sent' && o.expiresAt <= nowIso) ||
    db.inquiries.some((i) => i.status === 'open' && i.respondByAt <= nowIso) ||
    db.changeRequests.some((c) => c.status === 'requested' && c.expiresAt <= nowIso);

  if (bookingsDue) await mutate((next) => settleElapsedBookings(next));
  if (offersDue) await mutate((next) => settleElapsedOffers(next));
}

export type AuthedHandler<T> = (user: User, db: Database) => T | Promise<T>;

/** Require a signed-in user, else 401. */
export async function requireAuth(): Promise<
  { ok: true; user: User } | { ok: false; response: NextResponse }
> {
  const user = await currentUser();
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, user };
}

/** Require a signed-in owner, else 401/403. */
export async function requireOwner(): Promise<
  { ok: true; user: User } | { ok: false; response: NextResponse }
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (auth.user.role !== 'owner' && auth.user.role !== 'admin') {
    return { ok: false, response: forbidden('This area is for owner accounts') };
  }
  return auth;
}

/**
 * Very small fixed-window rate limiter, keyed per identifier.
 *
 * Protects the credential endpoints from trivial brute forcing. In a
 * multi-instance deployment this moves to a shared store; the interface stays
 * the same.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** Best-effort client identifier for rate limiting. */
export function clientKey(request: Request, suffix = ''): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || request.headers.get('x-real-ip') || 'local';
  return `${ip}:${suffix}`;
}
