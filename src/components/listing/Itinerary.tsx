import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';

/**
 * Guest-facing itinerary.
 *
 * Rendered server-side with no interactivity: this is the part of a listing a
 * guest reads before deciding, so it has to be in the HTML for search engines
 * and for anyone on a slow connection.
 */

export interface PublicItineraryStep {
  title: string;
  description: string;
  durationMinutes?: number;
  isMeetingPoint: boolean;
}

export function ItinerarySection({
  days,
}: {
  days: { steps: PublicItineraryStep[] }[];
}) {
  if (!days.length || days.every((day) => !day.steps.length)) return null;
  const multiDay = days.length > 1;

  return (
    <section className="rounded-card border border-line bg-white p-4">
      <h2 className="text-base font-bold text-ink">{t('itinerary', 'whatToExpect')}</h2>
      <p className="mt-0.5 text-sm text-ink-muted">{t('itinerary', 'subtitle')}</p>

      <div className="mt-4 space-y-5">
        {days.map((day, dayIndex) => (
          <div key={dayIndex}>
            {multiDay ? (
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                {t('itinerary', 'dayNumber', { day: String(dayIndex + 1) })}
              </h3>
            ) : null}

            <ol className="relative space-y-4 pl-8">
              {/* A single continuous rail behind the markers reads as a
                  journey; separate dots read as a checklist. */}
              <span
                aria-hidden
                className="absolute bottom-2 left-[13px] top-2 w-px bg-line"
              />
              {day.steps.map((step, index) => (
                <li key={index} className="relative">
                  <span className="absolute -left-8 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-50 text-xs font-bold text-brand-700">
                    {step.isMeetingPoint ? <Icon name="map-pin" size={13} /> : index + 1}
                  </span>
                  <p className="flex flex-wrap items-baseline gap-2 text-sm font-bold text-ink">
                    {step.title}
                    {step.isMeetingPoint ? (
                      <Badge tone="brand">{t('itinerary', 'meetingPoint')}</Badge>
                    ) : null}
                    {step.durationMinutes ? (
                      <span className="text-xs font-normal text-ink-muted">
                        {step.durationMinutes >= 60
                          ? t('itinerary', 'hoursShort', {
                              count: Math.round(step.durationMinutes / 60),
                              hours: Math.round(step.durationMinutes / 60),
                            })
                          : t('itinerary', 'minutesShort', {
                              minutes: String(step.durationMinutes),
                            })}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
