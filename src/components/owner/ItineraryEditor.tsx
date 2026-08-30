'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { Icon } from '@/components/ui/Icon';
import { Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Per-trip itinerary editor.
 *
 * Steps are ordered and reorderable because the order *is* the content — an
 * itinerary whose steps can arrive in any sequence is a list of amenities, not
 * a plan for a day.
 *
 * Publishing is gated on two steps per day and a published itinerary must be
 * unpublished to edit, so a guest-facing promise never changes silently under
 * someone who has already booked on it.
 */

const MIN_STEPS = 2;

export interface EditorStep {
  title: string;
  description: string;
  durationMinutes?: number;
  isMeetingPoint: boolean;
}

export interface EditorItinerary {
  id: string;
  packageId: string;
  status: 'draft' | 'published';
  days: { steps: EditorStep[] }[];
}

export interface EditorPackage {
  id: string;
  title: string;
  hours: number;
  days: number;
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

export function ItineraryEditor({
  charterId,
  packages,
  itineraries: initial,
}: {
  charterId: string;
  packages: EditorPackage[];
  itineraries: EditorItinerary[];
}) {
  const router = useRouter();

  const [itineraries, setItineraries] = useState(initial);
  const [activePackage, setActivePackage] = useState(packages[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ day: number; index: number | null } | null>(null);
  const [draft, setDraft] = useState<EditorStep>({
    title: '',
    description: '',
    isMeetingPoint: false,
  });
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  const pkg = packages.find((p) => p.id === activePackage);
  const itinerary = itineraries.find((i) => i.packageId === activePackage);
  const dayCount = Math.max(1, pkg?.days ?? 1);

  const days: { steps: EditorStep[] }[] =
    itinerary?.days.length === dayCount
      ? itinerary.days
      : Array.from({ length: dayCount }, (_, index) => itinerary?.days[index] ?? { steps: [] });

  const locked = itinerary?.status === 'published';
  const blockers = days
    .map((day, index) => (day.steps.length < MIN_STEPS ? index : -1))
    .filter((index) => index >= 0);

  const save = async (nextDays: { steps: EditorStep[] }[]) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await api.post<EditorItinerary>(
        `/api/owner/listings/${charterId}/itineraries`,
        { action: 'save', packageId: activePackage, days: nextDays },
      );
      setItineraries((current) => [
        ...current.filter((i) => i.packageId !== activePackage),
        saved,
      ]);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: 'publish' | 'unpublish' | 'delete') => {
    if (!itinerary) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/owner/listings/${charterId}/itineraries`, {
        action,
        itineraryId: itinerary.id,
      });
      if (action === 'delete') {
        setItineraries((current) => current.filter((i) => i.id !== itinerary.id));
      } else {
        setItineraries((current) =>
          current.map((i) =>
            i.id === itinerary.id
              ? { ...i, status: action === 'publish' ? 'published' : 'draft' }
              : i,
          ),
        );
      }
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
      setConfirmUnpublish(false);
    }
  };

  const commitStep = () => {
    if (!editing) return;
    const next = days.map((day, index) => {
      if (index !== editing.day) return day;
      const steps = [...day.steps];
      if (editing.index === null) steps.push(draft);
      else steps[editing.index] = draft;
      return { steps };
    });
    setEditing(null);
    void save(next);
  };

  const removeStep = (dayIndex: number, stepIndex: number) => {
    void save(
      days.map((day, index) =>
        index === dayIndex
          ? { steps: day.steps.filter((_, i) => i !== stepIndex) }
          : day,
      ),
    );
  };

  const moveStep = (dayIndex: number, stepIndex: number, direction: -1 | 1) => {
    const target = stepIndex + direction;
    const day = days[dayIndex];
    if (target < 0 || target >= day.steps.length) return;

    const steps = [...day.steps];
    [steps[stepIndex], steps[target]] = [steps[target], steps[stepIndex]];
    void save(days.map((d, index) => (index === dayIndex ? { steps } : d)));
  };

  if (!packages.length) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-center text-sm text-ink-muted">
        {t('itinerary', 'emptyBody')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trip switcher */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {packages.map((option) => {
          const state = itineraries.find((i) => i.packageId === option.id)?.status;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setActivePackage(option.id)}
              aria-pressed={activePackage === option.id}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                activePackage === option.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line bg-white text-ink-soft hover:bg-surface-sunken',
              )}
            >
              {option.title}
              {state === 'published' ? (
                <Icon name="check-circle" size={12} />
              ) : state === 'draft' ? (
                <Icon name="edit" size={12} />
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="rounded-card border border-line bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-line p-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink">{pkg?.title}</h2>
            <p className="text-xs text-ink-muted">{t('itinerary', 'subtitle')}</p>
          </div>
          {itinerary ? (
            <Badge tone={locked ? 'success' : 'neutral'}>
              {t('itinerary', locked ? 'published' : 'draft')}
            </Badge>
          ) : null}
        </header>

        {locked ? (
          <div className="border-b border-line bg-warning/10 p-3">
            <p className="text-xs font-bold text-ink">{t('itinerary', 'unpublishToEdit')}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{t('itinerary', 'unpublishToEditBody')}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              disabled={busy}
              onClick={() => setConfirmUnpublish(true)}
            >
              {t('itinerary', 'unpublish')}
            </Button>
          </div>
        ) : null}

        <div className="divide-y divide-line">
          {days.map((day, dayIndex) => (
            <div key={dayIndex} className="p-3">
              {dayCount > 1 ? (
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  {t('itinerary', 'dayNumber', { day: String(dayIndex + 1) })}
                </h3>
              ) : null}

              {day.steps.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {t('itinerary', 'addWhatHappens', { day: String(dayIndex + 1) })}
                </p>
              ) : (
                <ol className="space-y-2">
                  {day.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="flex gap-3">
                      {/* A numbered rail, because sequence is the point. */}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                        {stepIndex + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-ink">
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
                        <p className="text-xs text-ink-muted">{step.description}</p>

                        {!locked ? (
                          <div className="mt-1 flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setDraft(step);
                                setEditing({ day: dayIndex, index: stepIndex });
                              }}
                              className="text-[11px] font-semibold text-brand-700"
                            >
                              {t('general', 'edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStep(dayIndex, stepIndex, -1)}
                              disabled={stepIndex === 0}
                              className="text-[11px] font-semibold text-ink-muted disabled:opacity-40"
                            >
                              {t('itinerary', 'moveUp')}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStep(dayIndex, stepIndex, 1)}
                              disabled={stepIndex === day.steps.length - 1}
                              className="text-[11px] font-semibold text-ink-muted disabled:opacity-40"
                            >
                              {t('itinerary', 'moveDown')}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStep(dayIndex, stepIndex)}
                              className="text-[11px] font-semibold text-danger"
                            >
                              {t('general', 'remove')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {!locked ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => {
                    setDraft({ title: '', description: '', isMeetingPoint: false });
                    setEditing({ day: dayIndex, index: null });
                  }}
                >
                  <Icon name="plus" size={14} />
                  {t('itinerary', 'addStep')}
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {error ? (
          <p role="alert" className="border-t border-line p-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        {!locked ? (
          <footer className="border-t border-line p-3">
            {blockers.length ? (
              <p className="mb-2 text-xs font-semibold text-warning">
                {t('itinerary', 'publishGate', { min: String(MIN_STEPS) })}
              </p>
            ) : null}
            <div className="flex gap-2">
              {itinerary ? (
                <Button
                  variant="secondary"
                  className="flex-1 text-danger"
                  disabled={busy}
                  onClick={() => act('delete')}
                >
                  {t('general', 'delete')}
                </Button>
              ) : null}
              <Button
                className="flex-1"
                disabled={busy || blockers.length > 0 || !itinerary}
                onClick={() => act('publish')}
              >
                {t('itinerary', 'publish')}
              </Button>
            </div>
          </footer>
        ) : null}
      </section>

      {/* ------------------------------------------------------ step sheet */}
      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t('itinerary', editing?.index === null ? 'addStep' : 'editStep')}
      >
        <div className="space-y-3">
          <Field label={t('itinerary', 'stepName')}>
            {({ id }) => (
              <Input
                id={id}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={t('itinerary', 'stepNamePlaceholder')}
              />
            )}
          </Field>

          <Field label={t('itinerary', 'stepDescription')}>
            {({ id }) => (
              <Textarea
                id={id}
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t('itinerary', 'stepDescriptionPlaceholder')}
              />
            )}
          </Field>

          <Field label={t('itinerary', 'duration')}>
            {({ id }) => (
              <Select
                id={id}
                value={draft.durationMinutes ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMinutes: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              >
                <option value="">{t('itinerary', 'selectDuration')}</option>
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Checkbox
            label={t('itinerary', 'meetingPoint')}
            checked={draft.isMeetingPoint}
            onChange={(e) => setDraft({ ...draft, isMeetingPoint: e.target.checked })}
          />

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
              {t('general', 'cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={draft.title.trim().length < 2}
              onClick={commitStep}
            >
              {t('general', 'save')}
            </Button>
          </div>
        </div>
      </Overlay>

      <Overlay
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        title={t('itinerary', 'unpublishConfirmTitle')}
      >
        <p className="text-sm text-ink-soft">{t('itinerary', 'unpublishConfirmBody')}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmUnpublish(false)}>
            {t('general', 'cancel')}
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => act('unpublish')}>
            {t('itinerary', 'unpublish')}
          </Button>
        </div>
      </Overlay>
    </div>
  );
}
