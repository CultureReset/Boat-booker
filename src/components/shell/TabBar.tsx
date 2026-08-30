'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { useSession } from '@/components/providers/SessionProvider';
import { Icon, type IconName } from '@/components/ui/Icon';

import { AuthModal } from '@/components/auth/AuthModal';
import { cx } from '@/components/ui/cx';

/**
 * Mobile bottom tab bar.
 *
 * This is the primary navigation in the mobile app and on small screens; it is
 * hidden from `md` up where the header takes over. Tabs differ by role —
 * owners get calendar and listings where customers get wishlist and bookings —
 * and signed-out visitors are routed into the auth sheet rather than to a
 * screen that would immediately bounce them.
 */

interface Tab {
  key: string;
  href: string;
  icon: IconName;
  label: string;
  /** Matching prefix for the active state; falls back to `href`. */
  match?: string;
  badge?: number;
  requiresAuth?: boolean;
}

export function TabBar() {
  const pathname = usePathname();
  const { user, isOwner, unreadMessages, summary } = useSession();
  const [authOpen, setAuthOpen] = useState(false);

  // Screens that own the bottom edge get it to themselves: the listing page's
  // booking bar, checkout, a message thread's composer, and auth. Two fixed
  // bars stacked on top of each other is the one thing worse than none.
  const hidden =
    pathname.startsWith('/book') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/charters/view/') ||
    pathname.includes('/inbox/');
  if (hidden) return null;

  const tabs: Tab[] = isOwner
    ? [
        { key: 'home', href: '/owner', icon: 'chart', label: t('navigation', 'dashboard') },
        { key: 'calendar', href: '/owner/calendar', icon: 'calendar', label: t('navigation', 'manageCalendar') },
        { key: 'bookings', href: '/owner/bookings', icon: 'tag', label: t('navigation', 'bookings') },
        { key: 'inbox', href: '/owner/inbox', icon: 'message', label: t('navigation', 'inbox'), badge: unreadMessages },
        { key: 'more', href: '/owner/settings', icon: 'menu', label: t('navigation', 'more') },
      ]
    : [
        { key: 'home', href: '/', icon: 'search', label: t('navigation', 'home'), match: '/' },
        {
          key: 'wishlist',
          href: '/account/wishlist',
          icon: 'heart',
          label: t('navigation', 'wishlist'),
          badge: summary?.counts.wishlist,
          requiresAuth: true,
        },
        {
          key: 'bookings',
          href: '/account/bookings',
          icon: 'tag',
          label: t('navigation', 'bookings'),
          requiresAuth: true,
        },
        {
          key: 'inbox',
          href: '/account/inbox',
          icon: 'message',
          label: t('navigation', 'inbox'),
          badge: unreadMessages,
          requiresAuth: true,
        },
        {
          key: 'account',
          href: user ? '/account/profile' : '/login',
          icon: 'user',
          label: user ? t('navigation', 'profile') : t('login', 'login'),
          requiresAuth: false,
        },
      ];

  const isActive = (tab: Tab) => {
    const target = tab.match ?? tab.href;
    return target === '/' ? pathname === '/' : pathname.startsWith(target);
  };

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-bottom md:hidden"
        style={{ height: 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))' }}
      >
        <ul className="mx-auto flex h-[var(--tabbar-height)] max-w-md items-stretch">
          {tabs.map((tab) => {
            const active = isActive(tab);
            const gated = tab.requiresAuth && !user;

            const content = (
              <>
                <span className="relative">
                  <Icon
                    name={active && tab.icon === 'heart' ? 'heart-filled' : tab.icon}
                    size={21}
                    strokeWidth={active ? 2.2 : 1.7}
                  />
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  ) : null}
                </span>
                <span className={cx('text-[10px] leading-none', active ? 'font-bold' : 'font-medium')}>
                  {tab.label}
                </span>
              </>
            );

            const className = cx(
              'flex h-full w-full flex-col items-center justify-center gap-1 transition-colors',
              active ? 'text-brand-700' : 'text-ink-muted',
            );

            return (
              <li key={tab.key} className="flex-1">
                {gated ? (
                  <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className={className}
                    aria-current={active ? 'page' : undefined}
                  >
                    {content}
                  </button>
                ) : (
                  <Link href={tab.href} className={className} aria-current={active ? 'page' : undefined}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

/** Spacer that keeps page content clear of the fixed tab bar on mobile. */
export function TabBarSpacer() {
  return <div className="h-[var(--tabbar-height)] md:hidden" aria-hidden="true" />;
}
