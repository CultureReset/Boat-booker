import Link from 'next/link';
import type { Metadata } from 'next';
import { commerceConfig } from '@/config/brand';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import { listOwnerCharters } from '@/lib/services/owner';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = { title: t('owner', 'opportunitiesTitle') };

/**
 * Growth opportunities.
 *
 * Derived from the operator's own data rather than a static checklist — every
 * suggestion is measured against their listings, so a well-run business is not
 * nagged about things it already does.
 */
export default async function OpportunitiesPage() {
  const user = (await currentUser())!;
  const db = await getDb();

  const listings = listOwnerCharters(db, user.id);
  const charters = db.charters.filter((c) => c.ownerId === user.id);

  const withoutInstantBook = charters.filter((c) => !c.policies.isInstantBookActive);
  const withoutFreeCancellation = charters.filter((c) => c.policies.freeCancellationDaysInAdvance === 0);
  const thinPhotos = listings.filter((l) => l.photoCount < 5);
  const singleTrip = listings.filter((l) => l.packageCount < 2);
  const incomplete = listings.filter((l) => l.completeness < 90);

  const opportunities: {
    key: string;
    title: string;
    body: string;
    icon: IconName;
    href: string;
    impact: 'high' | 'medium' | 'low';
    done: boolean;
  }[] = [
    {
      key: 'instant_book',
      title: t('owner', 'instantBook'),
      body: `${withoutInstantBook.length} of your ${charters.length} listings still make guests wait for a reply. ${t('owner', 'instantBookBody')}`,
      icon: 'bolt',
      href: '/owner/listings',
      impact: 'high',
      done: withoutInstantBook.length === 0,
    },
    {
      key: 'online_payments',
      title: t('owner', 'onlinePaymentsTitle'),
      body: t('owner', 'onlinePaymentsBody'),
      icon: 'card',
      href: '/owner/settings',
      impact: 'high',
      done: Boolean(user.ownerProfile?.onlinePaymentsEnabled),
    },
    {
      key: 'verification',
      title: t('owner', 'verificationTitle'),
      body: t('owner', 'verificationBody'),
      icon: 'shield',
      href: '/owner/verification',
      impact: 'high',
      done: user.ownerProfile?.verification.status === 'verified',
    },
    {
      key: 'photos',
      title: t('owner', 'photosTitle'),
      body: `${thinPhotos.length} listing${thinPhotos.length === 1 ? '' : 's'} have fewer than five photos. Listings with more photos convert noticeably better.`,
      icon: 'camera',
      href: '/owner/listings',
      impact: 'medium',
      done: thinPhotos.length === 0,
    },
    {
      key: 'trips',
      title: t('owner', 'addTrip'),
      body: `${singleTrip.length} listing${singleTrip.length === 1 ? '' : 's'} offer only one trip. A second duration or departure time captures groups the first one misses.`,
      icon: 'tag',
      href: '/owner/listings',
      impact: 'medium',
      done: singleTrip.length === 0,
    },
    {
      key: 'free_cancellation',
      title: t('listingCard', 'freeCancellation'),
      body: `${withoutFreeCancellation.length} listing${withoutFreeCancellation.length === 1 ? '' : 's'} offer no free cancellation window. Guests filter for it.`,
      icon: 'check-circle',
      href: '/owner/listings',
      impact: 'medium',
      done: withoutFreeCancellation.length === 0,
    },
    {
      key: 'completeness',
      title: t('owner', 'listingCompleteness'),
      body: `${incomplete.length} listing${incomplete.length === 1 ? '' : 's'} are below 90% complete. ${t('owner', 'listingCompletenessBody')}`,
      icon: 'edit',
      href: '/owner/listings',
      impact: 'medium',
      done: incomplete.length === 0,
    },
    {
      key: 'widgets',
      title: t('owner', 'widgetsTitle'),
      body: t('owner', 'widgetsBody'),
      icon: 'grid',
      href: '/owner/widgets',
      impact: 'low',
      done: false,
    },
    {
      key: 'team',
      title: t('owner', 'teamTitle'),
      body: t('owner', 'teamBody'),
      icon: 'users',
      href: '/owner/team',
      impact: 'low',
      done: (user.ownerProfile?.team.length ?? 0) > 1,
    },
  ];

  const open = opportunities.filter((o) => !o.done);
  const done = opportunities.filter((o) => o.done);

  const impactOrder = { high: 0, medium: 1, low: 2 };
  open.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return (
    <>
      <SectionHeading
        title={t('owner', 'opportunitiesTitle')}
        subtitle={t('owner', 'opportunitiesBody')}
        level={1}
      />

      <p className="mb-4 rounded-card border border-line bg-white p-3 text-sm text-ink-muted">
        {t('owner', 'platformFee', { percent: Math.round(commerceConfig.serviceFeeRate * 100) })} is deducted
        from each booking. Everything below is free to enable.
      </p>

      <ul className="space-y-2">
        {open.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex items-start gap-3 rounded-card border border-line bg-white p-4 transition-shadow hover:shadow-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon name={item.icon} size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink">{item.title}</span>
                  <Badge tone={item.impact === 'high' ? 'warning' : 'neutral'}>
                    {item.impact === 'high' ? 'High impact' : item.impact === 'medium' ? 'Medium' : 'Nice to have'}
                  </Badge>
                </span>
                <span className="mt-1 block text-sm text-ink-muted">{item.body}</span>
              </span>
              <Icon name="chevron-right" size={18} className="mt-2 shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>

      {done.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-ink">{t('general', 'done')}</h2>
          <ul className="space-y-1.5">
            {done.map((item) => (
              <li
                key={item.key}
                className={cx('flex items-center gap-2.5 rounded-control border border-line bg-white p-3')}
              >
                <Icon name="check-circle" size={17} className="shrink-0 text-success" />
                <span className="text-sm text-ink-soft">{item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
