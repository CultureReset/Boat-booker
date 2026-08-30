import { redirect } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { unreadCount } from '@/lib/services/messages';
import { Header } from '@/components/shell/Header';
import { TabBar, TabBarSpacer } from '@/components/shell/TabBar';
import { DashboardNav, type DashboardNavItem } from '@/components/shell/DashboardNav';

/**
 * Owner (business) shell.
 *
 * Guards `/owner/*`: signed-out visitors go to the owner login, and a customer
 * account is sent back to the customer area rather than shown an empty
 * business dashboard.
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?intent=owner&next=/owner');
  if (user.role !== 'owner' && user.role !== 'admin') redirect('/account/bookings');

  const db = await getDb();
  const unread = unreadCount(db, user.id);
  const pending = db.bookings.filter((b) => b.ownerId === user.id && b.status === 'pending').length;

  const items: DashboardNavItem[] = [
    { href: '/owner', label: t('owner', 'dashboard'), icon: 'chart' },
    { href: '/owner/bookings', label: t('navigation', 'bookings'), icon: 'tag', badge: pending },
    { href: '/owner/inbox', label: t('navigation', 'inbox'), icon: 'message', badge: unread },
    { href: '/owner/calendar', label: t('navigation', 'multicalendar'), icon: 'calendar' },
    { href: '/owner/listings', label: t('navigation', 'listings'), icon: 'boat' },
    { href: '/owner/reviews', label: t('navigation', 'reviews'), icon: 'star-empty' },
    { href: '/owner/payouts', label: t('navigation', 'payouts'), icon: 'wallet', groupStart: true },
    { href: '/owner/payout-methods', label: t('navigation', 'payoutMethods'), icon: 'card' },
    { href: '/owner/team', label: t('navigation', 'crewMembers'), icon: 'users' },
    { href: '/owner/verification', label: t('navigation', 'verification'), icon: 'shield' },
    { href: '/owner/widgets', label: t('navigation', 'widgets'), icon: 'grid' },
    { href: '/owner/opportunities', label: t('navigation', 'opportunities'), icon: 'bolt' },
    { href: '/owner/settings', label: t('navigation', 'settings'), icon: 'settings' },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <Header />
      {/* Stacks on mobile — the nav renders as a horizontal chip rail there,
          and as a flex row sibling it would squeeze the main column to zero. */}
      <div className="mx-auto flex w-full max-w-shell flex-1 flex-col px-4 py-5 md:flex-row md:gap-8">
        <DashboardNav items={items} title={t('login', 'ownerPortalTitle')} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <TabBarSpacer />
      <TabBar />
    </div>
  );
}
