import { redirect } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { accountSummary } from '@/lib/services/accounts';
import { unreadCount } from '@/lib/services/messages';
import { Header } from '@/components/shell/Header';
import { TabBar, TabBarSpacer } from '@/components/shell/TabBar';
import { DashboardNav, type DashboardNavItem } from '@/components/shell/DashboardNav';

/**
 * Customer account shell.
 *
 * Guards every route beneath `/account`: a signed-out visitor is sent to login
 * with a return path, and an owner is redirected into the business dashboard
 * rather than shown an empty customer area.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account/bookings');
  if (user.role === 'owner') redirect('/owner');

  const db = await getDb();
  const summary = accountSummary(db, user);
  const unread = unreadCount(db, user.id);

  const items: DashboardNavItem[] = [
    { href: '/account/bookings', label: t('navigation', 'myBookings'), icon: 'tag', badge: summary.counts.pending },
    { href: '/account/inbox', label: t('navigation', 'inbox'), icon: 'message', badge: unread },
    { href: '/account/wishlist', label: t('navigation', 'myWishlist'), icon: 'heart', badge: summary.counts.wishlist },
    { href: '/account/reviews', label: t('navigation', 'myReviews'), icon: 'star-empty', badge: summary.counts.awaitingReview },
    { href: '/account/profile', label: t('navigation', 'profile'), icon: 'user', groupStart: true },
    { href: '/account/payment-methods', label: t('navigation', 'paymentMethods'), icon: 'card' },
    { href: '/account/loyalty', label: t('navigation', 'loyalty'), icon: 'star' },
    { href: '/account/referrals', label: t('navigation', 'referrals'), icon: 'users' },
    { href: '/account/notifications', label: t('navigation', 'notifications'), icon: 'bell' },
    { href: '/account/settings', label: t('navigation', 'settings'), icon: 'settings' },
  ];

  return (
    <div data-app="guest" className="flex min-h-dvh flex-col">
      <Header />
      {/* Stacks on mobile — the nav renders as a horizontal chip rail there,
          and as a flex row sibling it would squeeze the main column to zero. */}
      <div className="mx-auto flex w-full max-w-shell flex-1 flex-col px-4 py-5 md:flex-row md:gap-8">
        <DashboardNav items={items} title={t('navigation', 'yourAccount')} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <TabBarSpacer />
      <TabBar />
    </div>
  );
}
