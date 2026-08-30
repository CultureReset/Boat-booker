'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PublicUser } from '@/lib/auth/session';
import { api } from '@/lib/client/api';

/**
 * Session context.
 *
 * Seeded from the server render so the first paint already knows who is signed
 * in. `refresh()` re-reads `/api/me` after any action that changes account
 * state (booking, wishlist, profile edit) so counters stay accurate without a
 * full reload.
 */

export interface AccountSummary {
  loyalty: { level: number; discountPercentage: number; tripsToNext: number; next: { level: number; completedTrips: number; discountPercentage: number } | null };
  creditBalance: number;
  referralCode: string;
  referralCredit: number;
  referredCount: number;
  counts: {
    upcoming: number;
    pending: number;
    completed: number;
    cancelled: number;
    wishlist: number;
    reviewsWritten: number;
    awaitingReview: number;
  };
}

interface SessionValue {
  user: PublicUser | null;
  summary: AccountSummary | null;
  unreadMessages: number;
  unreadNotifications: number;
  loading: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: PublicUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<PublicUser | null>(initialUser);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        user: PublicUser | null;
        summary?: AccountSummary;
        unreadMessages?: number;
        unreadNotifications?: number;
      }>('/api/me');

      setUser(response.user);
      setSummary(response.summary ?? null);
      setUnreadMessages(response.unreadMessages ?? 0);
      setUnreadNotifications(response.unreadNotifications ?? 0);
    } catch {
      // A failed refresh should never sign the user out of the UI — the
      // server-rendered session stays authoritative until it says otherwise.
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout', {});
    setUser(null);
    setSummary(null);
    setUnreadMessages(0);
    setUnreadNotifications(0);
    // Full reload so every server component re-renders as signed out.
    window.location.href = '/';
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      summary,
      unreadMessages,
      unreadNotifications,
      loading,
      isOwner: user?.role === 'owner' || user?.role === 'admin',
      refresh,
      setUser,
      logout,
    }),
    [user, summary, unreadMessages, unreadNotifications, loading, refresh, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
