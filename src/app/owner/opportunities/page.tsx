import Link from 'next/link';
import type { Metadata } from 'next';
import { translate as t } from '@/i18n/translate';
import { currentUser } from '@/lib/auth/session';
import { getDb } from '@/lib/storage';
import {
  CATEGORY_COPY,
  CONTEXT_COPY,
  nextStepsFor,
  opportunitiesForOwner,
  type OpportunityContext,
} from '@/lib/services/opportunities';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

export const metadata: Metadata = { title: t('opportunities', 'title') };

/**
 * Growth opportunities, per listing.
 *
 * Every row is measured against the operator's own data, so a well-run business
 * is never nagged about something it already does — and each row links to the
 * screen that fixes it, because a suggestion without a remedy is a complaint.
 */
export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string }>;
}) {
  const { listing } = await searchParams;
  const user = (await currentUser())!;
  const db = await getDb();

  const reports = opportunitiesForOwner(db, user.id);
  const steps = nextStepsFor(db, user.id);
  const stepsLeft = steps.filter((s) => !s.done).length;

  if (!reports.length) {
    return (
      <>
        <SectionHeading title={t('opportunities', 'title')} level={1} />
        <EmptyState
          icon="boat"
          title={t('owner', 'noListings')}
          body={t('opportunities', 'subtitle')}
        />
      </>
    );
  }

  // Worst-scoring listing first, which is where attention is best spent.
  const report = reports.find((r) => r.charterId === listing) ?? reports[0];

  const byContext = (context: OpportunityContext) =>
    report.opportunities.filter((o) => o.context === context);

  return (
    <>
      <SectionHeading
        title={t('opportunities', 'title')}
        subtitle={t('opportunities', 'subtitle')}
        level={1}
      />

      {/* -------------------------------------------------- next steps */}
      <section className="mb-5 rounded-card border border-line bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">{t('opportunities', 'nextStepsTitle')}</h2>
          <Badge tone={stepsLeft ? 'brand' : 'success'}>
            {t('opportunities', 'stepsLeft', { count: stepsLeft })}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">{t('opportunities', 'nextStepsIntro')}</p>

        <ul className="mt-3 space-y-1">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cx(
                  'flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-surface-sunken',
                  step.done && 'opacity-60',
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    step.done ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-700',
                  )}
                >
                  <Icon name={step.done ? 'check' : (step.icon as IconName)} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{step.title}</span>
                  <span className="block text-xs text-ink-muted">{step.description}</span>
                  {!step.done ? (
                    <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wide text-warning">
                      {step.requiredTo}
                    </span>
                  ) : null}
                </span>
                {!step.done ? (
                  <Icon name="chevron-right" size={16} className="mt-2 shrink-0 text-ink-faint" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ listing switch */}
      {reports.length > 1 ? (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reports.map((option) => (
            <Link
              key={option.charterId}
              href={`/owner/opportunities?listing=${option.charterId}`}
              className={cx(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                option.charterId === report.charterId
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
              )}
            >
              {option.charterTitle} · {option.score}%
            </Link>
          ))}
        </div>
      ) : null}

      {/* ---------------------------------------------------- the score */}
      <section className="mb-5 rounded-card border border-line bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 truncate text-sm font-bold text-ink">{report.charterTitle}</h2>
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand-700">
            {t('opportunities', 'scoreLabel', { score: String(report.score) })}
          </span>
        </div>

        {/* Six segments, one per band, so progress reads as steps rather than
            a continuous bar the operator cannot act on. */}
        <div className="mt-2 flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((band) => (
            <span
              key={band}
              className={cx(
                'h-1.5 flex-1 rounded-full',
                band <= report.band ? 'bg-brand-600' : 'bg-line',
              )}
            />
          ))}
        </div>

        <p className="mt-2 text-xs text-ink-soft">{report.bandCopy}</p>
        <p className="mt-1 text-[11px] text-ink-faint">
          {t('opportunities', 'completedOf', {
            done: String(report.completedCount),
            total: String(report.totalCount),
          })}
        </p>
      </section>

      {/* -------------------------------------------------- the rows */}
      <div className="space-y-5">
        {(['appeal', 'convenience', 'experience'] as OpportunityContext[]).map((context) => {
          const rows = byContext(context);
          if (!rows.length) return null;

          return (
            <section key={context}>
              <h2 className="text-sm font-bold text-ink">{CONTEXT_COPY[context].title}</h2>
              <p className="mb-2 text-xs text-ink-muted">{CONTEXT_COPY[context].description}</p>

              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
                {rows.map((opportunity) => (
                  <li key={opportunity.key}>
                    <Link
                      href={opportunity.href}
                      className="flex items-start gap-3 p-3 transition-colors hover:bg-surface-sunken"
                    >
                      <span
                        className={cx(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                          opportunity.completed
                            ? 'bg-success/10 text-success'
                            : 'bg-surface-sunken text-ink-muted',
                        )}
                      >
                        <Icon name={opportunity.completed ? 'check' : 'plus'} size={14} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            'block text-sm font-semibold',
                            opportunity.completed ? 'text-ink-muted line-through' : 'text-ink',
                          )}
                        >
                          {opportunity.title}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {opportunity.description}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint">
                          {CATEGORY_COPY[opportunity.category].title}
                        </span>
                      </span>

                      {!opportunity.completed ? (
                        <Icon
                          name="chevron-right"
                          size={16}
                          className="mt-2 shrink-0 text-ink-faint"
                        />
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
