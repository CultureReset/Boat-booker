import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { accountSummary } from '@/lib/services/accounts';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import { LogoutButton } from '@/components/shell/LogoutButton';
import { MenuList, type MenuGroup } from '@/components/shell/MenuList';

export const metadata: Metadata = { title: t('navigation', 'profile') };

/**
 * The customer app's Profile tab.
 *
 * The tab is a *menu*, not the edit form — editing your name is one row among
 * many, and putting the form behind the tab would strand loyalty, referrals,
 * saved cards and settings with no way to reach them on a phone, where there is
 * no sidebar.
 */
export default async function AccountMenuPage() {
  const user = (await currentUser())!;
  const db = await getDb();
  const summary = accountSummary(db, user);

  const groups: MenuGroup[] = [
    {
      title: t('account', 'menuGroupTrips'),
      rows: [
        {
          href: '/account/bookings',
          label: t('navigation', 'myBookings'),
          icon: 'tag',
          badge: summary.counts.pending ? String(summary.counts.pending) : undefined,
        },
        {
          href: '/account/reviews',
          label: t('navigation', 'myReviews'),
          icon: 'star-empty',
          badge: summary.counts.awaitingReview ? String(summary.counts.awaitingReview) : undefined,
        },
        { href: '/trip-memories', label: t('account', 'tripMemories'), icon: 'camera' },
        { href: '/catches', label: t('account', 'myCatches'), icon: 'boat' },
        { href: '/shared-wishlist', label: t('account', 'sharedWishlists'), icon: 'share' },
      ],
    },
    {
      title: t('account', 'menuGroupYou'),
      rows: [
        {
          href: '/account/profile',
          label: t('account', 'editProfile'),
          icon: 'user',
          hint: t('account', 'editProfileHint'),
        },
        { href: `/profile/view/${user.id}`, label: t('account', 'publicProfile'), icon: 'eye' },
        {
          href: '/finish-registration?next=/account/menu',
          label: t('login', 'phoneLabel'),
          icon: 'phone',
          // An unconfirmed number is the one row here that wants attention;
          // a confirmed one just shows itself.
          value: user.phoneVerifiedAt ? (user.phone ?? undefined) : undefined,
          badge: user.phoneVerifiedAt ? undefined : t('general', 'required'),
        },
        { href: '/account/notifications', label: t('notifications', 'title'), icon: 'bell' },
        { href: '/account/settings', label: t('navigation', 'settings'), icon: 'settings' },
      ],
    },
    {
      title: t('account', 'menuGroupPayments'),
      rows: [
        { href: '/account/payment-methods', label: t('navigation', 'paymentMethods'), icon: 'card' },
        {
          href: '/account/loyalty',
          label: t('navigation', 'loyalty'),
          icon: 'star',
          value: summary.loyalty.level
            ? t('account', 'loyaltyLevel', { level: summary.loyalty.level })
            : undefined,
        },
        {
          href: '/account/referrals',
          label: t('navigation', 'referrals'),
          icon: 'users',
          value: summary.creditBalance > 0 ? formatMoney(summary.creditBalance, user.currency) : undefined,
        },
      ],
    },
    {
      title: t('account', 'menuGroupSupport'),
      rows: [
        { href: '/help', label: t('navigation', 'helpCenter'), icon: 'info' },
        { href: '/pages/whylist', label: t('navigation', 'getListed'), icon: 'boat' },
      ],
    },
  ];

  return (
    <>
      {/* Identity card. Doubles as the entry point to the public profile, which
          is what a guest actually wants when they tap their own avatar. */}
      <section className="mb-4 flex items-center gap-3 rounded-card border border-line bg-white p-4">
        <Link
          href={`/profile/view/${user.id}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800"
        >
          {user.firstName.slice(0, 1)}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
        </div>
        {summary.loyalty.level > 0 ? (
          <Badge tone="gold">
            <Icon name="star" size={11} />
            {t('account', 'loyaltyLevel', { level: summary.loyalty.level })}
          </Badge>
        ) : null}
      </section>

      <MenuList groups={groups} />

      <LogoutButton />
    </>
  );
}
