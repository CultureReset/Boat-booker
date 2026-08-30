import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { formatMoney } from '@/lib/core/money';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { awardStateFor } from '@/lib/services/performance';
import { nextStepsFor } from '@/lib/services/opportunities';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import { LogoutButton } from '@/components/shell/LogoutButton';
import { MenuList, type MenuGroup } from '@/components/shell/MenuList';

export const metadata: Metadata = { title: t('navigation', 'menu') };

/**
 * The operator app's Menu tab.
 *
 * Everything that is not one of the four working screens lives here. Grouped
 * by what the operator is trying to do rather than by which service owns it —
 * "get paid" is one job even though it spans payouts, methods and business
 * info.
 */
export default async function OwnerMenuPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const steps = nextStepsFor(db, user.id);
  const stepsLeft = steps.filter((s) => !s.done).length;
  const award = awardStateFor(db, user.id);

  const pendingPayout = db.payouts
    .filter((p) => p.ownerId === user.id && p.status === 'pending')
    .reduce((sum, p) => sum + p.net, 0);

  const currency = db.charters.find((c) => c.ownerId === user.id)?.currency ?? 'USD';

  const groups: MenuGroup[] = [
    {
      title: t('owner', 'menuGroupBusiness'),
      rows: [
        { href: '/owner/listings', label: t('navigation', 'listings'), icon: 'boat' },
        { href: '/owner/performance', label: t('performance', 'title'), icon: 'chart' },
        {
          href: '/owner/opportunities',
          label: t('navigation', 'opportunities'),
          icon: 'plus',
          badge: stepsLeft ? String(stepsLeft) : undefined,
        },
        { href: '/owner/reviews', label: t('navigation', 'reviews'), icon: 'star-empty' },
        { href: '/owner/direct', label: t('direct', 'title', { brand: brand.name }), icon: 'external' },
      ],
    },
    {
      title: t('owner', 'menuGroupMoney'),
      rows: [
        {
          href: '/owner/payouts',
          label: t('navigation', 'payouts'),
          icon: 'wallet',
          value: pendingPayout > 0 ? formatMoney(pendingPayout, currency) : undefined,
        },
        { href: '/owner/payout-methods', label: t('navigation', 'payoutMethods'), icon: 'card' },
        { href: '/owner/settings', label: t('owner', 'businessInfo'), icon: 'tag' },
      ],
    },
    {
      title: t('owner', 'menuGroupTools'),
      rows: [
        { href: '/owner/quick-replies', label: t('quickReplies', 'title'), icon: 'bolt' },
        { href: '/owner/calendar/links', label: t('calendarSync', 'title'), icon: 'refresh' },
        { href: '/owner/widgets', label: t('navigation', 'widgets'), icon: 'grid' },
        { href: '/owner/team', label: t('navigation', 'crewMembers'), icon: 'users' },
        { href: '/owner/verification', label: t('navigation', 'verification'), icon: 'shield' },
      ],
    },
    {
      title: t('owner', 'menuGroupAccount'),
      rows: [
        { href: '/account/notifications', label: t('notifications', 'title'), icon: 'bell' },
        { href: '/owner/settings', label: t('navigation', 'settings'), icon: 'settings' },
        { href: '/help', label: t('navigation', 'helpCenter'), icon: 'info' },
      ],
    },
  ];

  return (
    <>
      {/* Identity card — the operator app opens Menu to check who they are
          signed in as more often than to reach any single screen. */}
      <section className="mb-4 flex items-center gap-3 rounded-card border border-line bg-white p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-800">
          {(user.ownerProfile?.companyName ?? user.firstName).slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">
            {user.ownerProfile?.companyName || `${user.firstName} ${user.lastName}`}
          </p>
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
        </div>
        {award.hasAward ? (
          <Badge tone="gold">
            <Icon name="star" size={11} />
            {award.awardedYear}
          </Badge>
        ) : null}
      </section>

      <MenuList groups={groups} />

      <LogoutButton />
    </>
  );
}
