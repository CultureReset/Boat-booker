import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb, mutate } from '@/lib/storage';
import type { Session, User } from '@/lib/domain/types';

/**
 * Session handling.
 *
 * A session is a random opaque token stored server-side and handed to the
 * browser in a signed, HttpOnly cookie. The signature means a tampered cookie
 * is rejected before it ever hits the session table; the server-side record
 * means a session can be revoked (logout, account disabled) without waiting
 * for a token to expire.
 */

export const SESSION_COOKIE = 'bb_session';
const SESSION_TTL_DAYS = 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  // Dev fallback: stable within a process so hot reload does not sign users
  // out, but never used in production — the check below enforces that.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production');
  }
  globalThis.__bbDevSecret ??= randomBytes(32).toString('hex');
  return globalThis.__bbDevSecret;
}

declare global {

  var __bbDevSecret: string | undefined;
}

function sign(token: string): string {
  return createHmac('sha256', secret()).update(token).digest('base64url');
}

function pack(token: string): string {
  return `${token}.${sign(token)}`;
}

/** Verify the cookie signature and return the raw token, or null. */
function unpack(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const index = cookieValue.lastIndexOf('.');
  if (index <= 0) return null;

  const token = cookieValue.slice(0, index);
  const provided = Buffer.from(cookieValue.slice(index + 1));
  const expected = Buffer.from(sign(token));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? token : null;
}

export async function createSession(userId: string): Promise<Session> {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const session: Session = {
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString(),
  };

  await mutate((db) => {
    // Drop expired rows opportunistically so the table cannot grow forever.
    const nowIso = now.toISOString();
    db.sessions = db.sessions.filter((s) => s.expiresAt > nowIso);
    db.sessions.push(session);
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, pack(token), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 86_400,
  });

  return session;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = unpack(jar.get(SESSION_COOKIE)?.value);
  if (token) {
    await mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    });
  }
  jar.delete(SESSION_COOKIE);
}

/** Current user, or null when signed out. Never throws. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = unpack(jar.get(SESSION_COOKIE)?.value);
  if (!token) return null;

  const db = await getDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session || session.expiresAt <= new Date().toISOString()) return null;

  const user = db.users.find((u) => u.id === session.userId);
  if (!user || user.status === 'disabled') return null;
  return user;
}

/** Strip server-only fields before a user object crosses the wire. */
export function publicUser(user: User) {
  const { passwordHash, passwordSalt, ...rest } = user;
  void passwordHash;
  void passwordSalt;
  return rest;
}

export type PublicUser = ReturnType<typeof publicUser>;
