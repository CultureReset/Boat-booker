'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  activities,
  amenities,
  amenityGroupTitles,
  boatTypes,
  engineTypes,
  fuelTypes,
  listingTypes,
  paymentMethods,
  type AmenityGroup,
} from '@/config/taxonomy';
import { translate as t } from '@/i18n/translate';
import { formatTime, maskFromWeekdays, weekdaysFromMask, WEEKDAY_MASK_ALL } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { Charter, TripPackage } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Checkbox, Field, Input, PhotoFrame, Select, Textarea, Toggle } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Listing editor.
 *
 * Organised as steps rather than one long form: an operator filling in a boat
 * for the first time works through them in order, and one coming back to fix a
 * price jumps straight to Trips. Every step saves independently, so a partial
 * edit is never lost and nothing has to be completed before something else can
 * be.
 *
 * The form fields are generated from `config/taxonomy` — adding an amenity or
 * an activity there makes it editable here with no change to this file.
 */

export interface EditableListing extends Charter {
  destinationSlug: string;
  destinationTitle: string;
  packages: TripPackage[];
  completeness: number;
}

const STEPS = [
  { key: 'basics', labelKey: 'stepBasics', icon: 'edit' },
  { key: 'boat', labelKey: 'stepBoat', icon: 'boat' },
  { key: 'amenities', labelKey: 'stepAmenities', icon: 'check' },
  { key: 'photos', labelKey: 'stepPhotos', icon: 'camera' },
  { key: 'trips', labelKey: 'stepTrips', icon: 'tag' },
  { key: 'location', labelKey: 'stepLocation', icon: 'map-pin' },
  { key: 'policies', labelKey: 'stepPolicies', icon: 'shield' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export function ListingEditor({
  listing: initial,
  destinations,
}: {
  listing: EditableListing;
  destinations: { slug: string; title: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [listing, setListing] = useState(initial);
  const [step, setStep] = useState<StepKey>('basics');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /** Patch the listing and merge the server's canonical response back in. */
  const save = useCallback(
    async (patch: Record<string, unknown>, message = t('account', 'savedSuccess')) => {
      setSaving(true);
      try {
        const updated = await api.patch<EditableListing>(`/api/owner/listings/${listing.id}`, patch);
        setListing(updated);
        toast(message, 'success');
        router.refresh();
        return true;
      } catch (caught) {
        toast(errorMessage(caught), 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [listing.id, router, toast],
  );

  const remove = async () => {
    try {
      await api.delete(`/api/owner/listings/${listing.id}`);
      toast(t('general', 'delete'), 'success');
      router.push('/owner/listings');
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
      setDeleteOpen(false);
    }
  };

  return (
    <div>
      {/* ------------------------------------------------------- header */}
      <Link
        href="/owner/listings"
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevron-left" size={15} />
        {t('owner', 'listingsTitle')}
      </Link>

      <header className="mb-4 rounded-card border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-ink">{listing.title}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-muted">
              {listing.destinationTitle}
              <Badge tone={listing.published ? 'success' : 'neutral'}>
                {listing.published ? t('owner', 'published') : t('owner', 'draft')}
              </Badge>
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/charters/view/${listing.id}`}
              className="flex h-10 items-center gap-1.5 rounded-control border border-line px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
            >
              <Icon name="eye" size={16} />
              {t('general', 'seeMore')}
            </Link>
            <Button
              variant={listing.published ? 'outline' : 'primary'}
              loading={saving}
              onClick={() =>
                save(
                  { published: !listing.published },
                  listing.published ? t('owner', 'unpublish') : t('owner', 'publish'),
                )
              }
            >
              {listing.published ? t('owner', 'unpublish') : t('owner', 'publish')}
            </Button>
          </div>
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-ink">{t('owner', 'listingCompleteness')}</span>
            <span
              className={cx(
                'text-xs font-bold tabular-nums',
                listing.completeness >= 80 ? 'text-success' : 'text-warning',
              )}
            >
              {listing.completeness}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cx(
                'h-full rounded-full transition-all',
                listing.completeness >= 80 ? 'bg-success' : 'bg-warning',
              )}
              style={{ width: `${listing.completeness}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">{t('owner', 'listingCompletenessBody')}</p>
        </div>
      </header>

      {/* -------------------------------------------------------- steps */}
      <nav aria-label={t('owner', 'editListing')} className="-mx-4 mb-4 px-4 md:mx-0 md:px-0">
        <ul className="rail" role="tablist">
          {STEPS.map((item) => (
            <li key={item.key} className="shrink-0">
              <button
                type="button"
                role="tab"
                aria-selected={step === item.key}
                onClick={() => setStep(item.key)}
                className={cx(
                  'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors',
                  step === item.key
                    ? 'bg-ink font-bold text-white'
                    : 'border border-line bg-white font-medium text-ink-soft hover:border-ink-faint',
                )}
              >
                <Icon name={item.icon} size={14} />
                {t('owner', item.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ------------------------------------------------------ content */}
      <div className="rounded-card border border-line bg-white p-4">
        {step === 'basics' ? <BasicsStep listing={listing} onSave={save} saving={saving} /> : null}
        {step === 'boat' ? <BoatStep listing={listing} onSave={save} saving={saving} /> : null}
        {step === 'amenities' ? <AmenitiesStep listing={listing} onSave={save} saving={saving} /> : null}
        {step === 'photos' ? <PhotosStep listing={listing} setListing={setListing} /> : null}
        {step === 'trips' ? <TripsStep listing={listing} setListing={setListing} /> : null}
        {step === 'location' ? (
          <LocationStep listing={listing} destinations={destinations} onSave={save} saving={saving} />
        ) : null}
        {step === 'policies' ? <PoliciesStep listing={listing} onSave={save} saving={saving} /> : null}
      </div>

      {/* ------------------------------------------------------ danger */}
      <section className="mt-6 rounded-card border border-danger/30 bg-white p-4">
        <h2 className="mb-1 text-base font-bold text-danger">{t('general', 'delete')}</h2>
        <p className="mb-3 text-sm text-ink-muted">
          Deleting removes the listing, its trips and its calendar. Open bookings must be resolved first.
        </p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          {t('general', 'delete')}
        </Button>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title={t('general', 'delete')}
        confirmLabel={t('general', 'delete')}
        body={<p>{listing.title}</p>}
      />
    </div>
  );
}

type SaveFn = (patch: Record<string, unknown>, message?: string) => Promise<boolean>;

// --- Step: basics ----------------------------------------------------------

function BasicsStep({
  listing,
  onSave,
  saving,
}: {
  listing: EditableListing;
  onSave: SaveFn;
  saving: boolean;
}) {
  const [title, setTitle] = useState(listing.title);
  const [shortDescription, setShortDescription] = useState(listing.shortDescription);
  const [longDescription, setLongDescription] = useState(listing.longDescription);
  const [listingType, setListingType] = useState(listing.listingType);
  const [activitySlugs, setActivitySlugs] = useState<string[]>(() =>
    activities.filter((a) => listing.activityKeys.includes(a.key)).map((a) => a.slug),
  );

  return (
    <div className="space-y-4">
      <Field label={t('owner', 'listingTitleLabel')} required>
        {({ id }) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />}
      </Field>

      <Field label={t('owner', 'listingSummaryLabel')} hint={t('owner', 'listingSummaryHint')}>
        {({ id }) => (
          <Input
            id={id}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            maxLength={400}
          />
        )}
      </Field>

      <Field label={t('owner', 'listingDescription')} hint={t('owner', 'listingDescriptionHint')}>
        {({ id }) => (
          <Textarea
            id={id}
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            rows={8}
            maxLength={20000}
          />
        )}
      </Field>
      <p className="-mt-2 text-xs text-ink-muted">
        {longDescription.length} characters {longDescription.length < 200 ? '· aim for 200+' : '✓'}
      </p>

      <Field label={t('boatTypes', 'category')}>
        {({ id }) => (
          <Select
            id={id}
            value={listingType}
            onChange={(e) => setListingType(e.target.value as EditableListing['listingType'])}
          >
            {listingTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.singular}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">{t('activities', 'title')}</legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {activities.map((activity) => (
            <Checkbox
              key={activity.slug}
              label={activity.title}
              checked={activitySlugs.includes(activity.slug)}
              onChange={(e) =>
                setActivitySlugs((current) =>
                  e.target.checked
                    ? [...current, activity.slug]
                    : current.filter((slug) => slug !== activity.slug),
                )
              }
            />
          ))}
        </div>
      </fieldset>

      <Button
        loading={saving}
        onClick={() =>
          onSave({ title, shortDescription, longDescription, listingType, activitySlugs })
        }
      >
        {t('general', 'saveChanges')}
      </Button>
    </div>
  );
}

// --- Step: boat ------------------------------------------------------------

function BoatStep({
  listing,
  onSave,
  saving,
}: {
  listing: EditableListing;
  onSave: SaveFn;
  saving: boolean;
}) {
  const [boat, setBoat] = useState(() => ({
    ...listing.boat,
    typeSlug: boatTypes.find((type) => type.title === listing.boat.type)?.slug ?? 'other',
  }));

  const set = <K extends keyof typeof boat>(key: K, value: (typeof boat)[K]) =>
    setBoat((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('boatTypes', 'title')} required>
          {({ id }) => (
            <Select id={id} value={boat.typeSlug} onChange={(e) => set('typeSlug', e.target.value)}>
              {boatTypes.map((type) => (
                <option key={type.slug} value={type.slug}>
                  {type.title} — {type.category}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('viewCharter', 'boatCapacity')} required>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={200}
              value={boat.capacity}
              onChange={(e) => set('capacity', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={`${t('viewCharter', 'boatLength')} (ft)`} required>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={5}
              max={500}
              value={boat.length}
              onChange={(e) => set('length', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={t('viewCharter', 'yearBuilt')}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              value={boat.yearBuilt ?? ''}
              onChange={(e) => set('yearBuilt', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={t('viewCharter', 'manufacturer')}>
          {({ id }) => (
            <Input id={id} value={boat.manufacturer ?? ''} onChange={(e) => set('manufacturer', e.target.value)} />
          )}
        </Field>

        <Field label={t('viewCharter', 'model')}>
          {({ id }) => (
            <Input id={id} value={boat.boatModel ?? ''} onChange={(e) => set('boatModel', e.target.value)} />
          )}
        </Field>

        <Field label={t('viewCharter', 'engineType')}>
          {({ id }) => (
            <Select id={id} value={boat.engineType ?? ''} onChange={(e) => set('engineType', e.target.value)}>
              {engineTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('viewCharter', 'fuelType')}>
          {({ id }) => (
            <Select id={id} value={boat.fuelType ?? ''} onChange={(e) => set('fuelType', e.target.value)}>
              {fuelTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('viewCharter', 'engineCount')}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={8}
              value={boat.engineCount ?? ''}
              onChange={(e) => set('engineCount', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={`${t('viewCharter', 'enginePower')} (hp)`}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={boat.engineHorsepower ?? ''}
              onChange={(e) => set('engineHorsepower', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={`${t('viewCharter', 'maxSpeed')} (knots)`}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={boat.maxSpeed ?? ''}
              onChange={(e) => set('maxSpeed', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={t('viewCharter', 'cabins')}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={boat.numberOfCabins ?? ''}
              onChange={(e) => set('numberOfCabins', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={t('viewCharter', 'berths')}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={boat.numberOfBerths ?? ''}
              onChange={(e) => set('numberOfBerths', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={t('viewCharter', 'heads')}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={boat.numberOfHeads ?? ''}
              onChange={(e) => set('numberOfHeads', Number(e.target.value))}
            />
          )}
        </Field>
      </div>

      <Button
        loading={saving}
        onClick={() => {
          const { typeSlug, ...rest } = boat;
          return onSave({ boat: { ...rest, type: typeSlug } });
        }}
      >
        {t('general', 'saveChanges')}
      </Button>
    </div>
  );
}

// --- Step: amenities -------------------------------------------------------

function AmenitiesStep({
  listing,
  onSave,
  saving,
}: {
  listing: EditableListing;
  onSave: SaveFn;
  saving: boolean;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(() => ({ ...listing.amenities }));

  // Group once so the render is a straight map over the taxonomy.
  const grouped = useMemo(() => {
    const map = new Map<AmenityGroup, typeof amenities>();
    for (const amenity of amenities) {
      const list = map.get(amenity.group) ?? [];
      list.push(amenity);
      map.set(amenity.group, list);
    }
    return map;
  }, []);

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([group, items]) => (
        <fieldset key={group}>
          <legend className="mb-2 text-sm font-bold text-ink">{amenityGroupTitles[group]}</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {items.map((amenity) => (
              <Checkbox
                key={amenity.key}
                label={amenity.title}
                checked={values[amenity.key] === true}
                onChange={(e) => setValues((current) => ({ ...current, [amenity.key]: e.target.checked }))}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <Button loading={saving} onClick={() => onSave({ amenities: values })}>
        {t('general', 'saveChanges')}
      </Button>
    </div>
  );
}

// --- Step: photos ----------------------------------------------------------

function PhotosStep({
  listing,
  setListing,
}: {
  listing: EditableListing;
  setListing: (listing: EditableListing) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [altText, setAltText] = useState('');

  const add = async () => {
    setBusy(true);
    try {
      await api.post(`/api/owner/listings/${listing.id}/photos`, { altText });
      const updated = await api.get<EditableListing>(`/api/owner/listings/${listing.id}`);
      setListing(updated);
      setAltText('');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photoId: string) => {
    try {
      await api.delete(`/api/owner/listings/${listing.id}/photos?photoId=${photoId}`);
      const updated = await api.get<EditableListing>(`/api/owner/listings/${listing.id}`);
      setListing(updated);
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  };

  /** Move a photo one place in either direction and persist the new order. */
  const move = async (index: number, direction: -1 | 1) => {
    const next = [...listing.photos];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    setListing({ ...listing, photos: next });

    try {
      await api.patch(`/api/owner/listings/${listing.id}/photos`, { order: next.map((p) => p.id) });
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('owner', 'photosHint')}</p>

      {listing.photos.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {listing.photos.map((photo, index) => (
            <li key={photo.id} className="group relative">
              <PhotoFrame photo={photo} className="aspect-[4/3] w-full" />

              {index === 0 ? (
                <span className="absolute left-2 top-2">
                  <Badge tone="dark">{t('owner', 'setAsCover')}</Badge>
                </span>
              ) : null}

              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1">
                <div className="flex gap-1">
                  <IconAction
                    icon="chevron-left"
                    label={t('listingCard', 'previousImage')}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconAction
                    icon="chevron-right"
                    label={t('listingCard', 'nextImage')}
                    disabled={index === listing.photos.length - 1}
                    onClick={() => move(index, 1)}
                  />
                </div>
                <IconAction icon="trash" label={t('general', 'delete')} onClick={() => remove(photo.id)} danger />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-control border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t('owner', 'photosHint')}
        </p>
      )}

      <div className="rounded-control border border-line p-3">
        <Field label={t('owner', 'addPhoto')} hint={t('owner', 'photoAltHint')}>
          {({ id }) => (
            <Input
              id={id}
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder={t('owner', 'photoAltPlaceholder')}
            />
          )}
        </Field>
        <Button className="mt-3" icon="camera" onClick={add} loading={busy}>
          {t('owner', 'addPhoto')}
        </Button>
        <p className="mt-2 text-xs text-ink-muted">
          {t('owner', 'photoUploadNote')}
        </p>
      </div>
    </div>
  );
}

function IconAction({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition-colors disabled:opacity-40',
        danger ? 'text-danger hover:bg-white' : 'text-ink hover:bg-white',
      )}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

// --- Step: trips -----------------------------------------------------------

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function TripsStep({
  listing,
  setListing,
}: {
  listing: EditableListing;
  setListing: (listing: EditableListing) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<TripPackage | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TripPackage | null>(null);

  const reload = async () => {
    const updated = await api.get<EditableListing>(`/api/owner/listings/${listing.id}`);
    setListing(updated);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/owner/listings/${listing.id}/packages?packageId=${deleteTarget.id}`);
      await reload();
      setDeleteTarget(null);
      toast(t('owner', 'deleteTrip'), 'success');
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {listing.packages.length} {listing.packages.length === 1 ? 'trip' : 'trips'}
        </p>
        <Button size="sm" icon="plus" onClick={() => setEditing('new')}>
          {t('owner', 'addTrip')}
        </Button>
      </div>

      {listing.packages.length === 0 ? (
        <p className="rounded-control border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t('owner', 'noTripsYet')}
        </p>
      ) : (
        <ul className="space-y-2">
          {listing.packages.map((pkg) => (
            <li key={pkg.id} className="rounded-control border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">
                    {pkg.title}
                    {!pkg.active ? <Badge tone="neutral" className="ml-2">{t('owner', 'draft')}</Badge> : null}
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>{pkg.hours}h</span>
                    <span>{pkg.type === 'shared' ? t('search', 'perPerson') : t('packageCard', 'privateCharter')}</span>
                    <span>
                      {t('listingCard', 'capacity', { count: pkg.capacity, p: pkg.capacity })}
                    </span>
                    <span>{pkg.departureTimes.map(formatTime).join(', ')}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {weekdaysFromMask(pkg.weekdayMask).length === 7
                      ? 'Every day'
                      : weekdaysFromMask(pkg.weekdayMask).map((d) => WEEKDAY_LABELS[d - 1]).join(', ')}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-base font-extrabold text-ink">
                    {pkg.currency === 'USD' ? `US $${pkg.price}` : `${pkg.price} ${pkg.currency}`}
                  </p>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(pkg)}
                      aria-label={t('owner', 'editTrip')}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(pkg)}
                      aria-label={t('owner', 'deleteTrip')}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TripDialog
        listing={listing}
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          await reload();
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={t('owner', 'deleteTrip')}
        confirmLabel={t('general', 'delete')}
        body={deleteTarget ? <p>{deleteTarget.title}</p> : null}
      />
    </div>
  );
}

function TripDialog({
  listing,
  target,
  onClose,
  onSaved,
}: {
  listing: EditableListing;
  target: TripPackage | 'new' | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const existing = target !== 'new' && target !== null ? target : null;

  // Keyed remount from the parent is not used here, so state is seeded per open.
  const [form, setForm] = useState(() => seedTrip(existing, listing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedKey, setSeedKey] = useState(existing?.id ?? 'new');

  // Re-seed when the dialog is opened for a different trip.
  const currentKey = existing?.id ?? 'new';
  if (target !== null && currentKey !== seedKey) {
    setSeedKey(currentKey);
    setForm(seedTrip(existing, listing));
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/owner/listings/${listing.id}/packages`, {
        id: existing?.id,
        title: form.title,
        hours: Number(form.hours),
        type: form.type,
        price: Number(form.price),
        capacity: Number(form.capacity),
        minPersons: Number(form.minPersons),
        additionalPersonAfter: form.chargeExtra ? Number(form.additionalPersonAfter) : null,
        additionalPersonPrice: form.chargeExtra ? Number(form.additionalPersonPrice) : null,
        departureTimes: form.departureTimes,
        weekdayMask: maskFromWeekdays(form.weekdays),
        active: form.active,
      });
      toast(t('account', 'savedSuccess'), 'success');
      await onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const setTime = (index: number, value: string) =>
    setForm((current) => ({
      ...current,
      departureTimes: current.departureTimes.map((time, i) => (i === index ? value : time)),
    }));

  return (
    <Overlay
      open={target !== null}
      onClose={onClose}
      title={existing ? t('owner', 'editTrip') : t('owner', 'addTrip')}
      size="md"
      footer={
        <Button fullWidth onClick={submit} loading={busy}>
          {t('general', 'save')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <Field label={t('owner', 'tripTitle')} required>
          {({ id }) => (
            <Input
              id={id}
              value={form.title}
              onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              placeholder="4 Hour – Sunset Tour"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('owner', 'tripDurationHours')} required>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={720}
                value={form.hours}
                onChange={(e) => setForm((c) => ({ ...c, hours: e.target.value }))}
              />
            )}
          </Field>

          <Field label={`${t('owner', 'tripPrice')} (${listing.currency})`} required>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))}
              />
            )}
          </Field>

          <Field label={t('owner', 'tripCapacity')} required hint={`Boat holds ${listing.boat.capacity}`}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={listing.boat.capacity}
                value={form.capacity}
                onChange={(e) => setForm((c) => ({ ...c, capacity: e.target.value }))}
              />
            )}
          </Field>

          <Field label={t('owner', 'tripMinGuests')} required>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={1}
                value={form.minPersons}
                onChange={(e) => setForm((c) => ({ ...c, minPersons: e.target.value }))}
              />
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink">{t('search', 'tripTypeFilter')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['private', 'shared'] as const).map((type) => (
              <label
                key={type}
                className={cx(
                  'flex cursor-pointer items-start gap-2.5 rounded-control border p-3 transition-colors',
                  form.type === type ? 'border-brand-600 bg-brand-50/50' : 'border-line',
                )}
              >
                <input
                  type="radio"
                  name="trip_type"
                  checked={form.type === type}
                  onChange={() => setForm((c) => ({ ...c, type }))}
                  className="mt-0.5 h-4 w-4 border-line text-brand-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {type === 'private' ? t('owner', 'tripPrivate') : t('owner', 'tripShared')}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {type === 'private'
                      ? t('packageCard', 'privateCharterDescription', { p: form.capacity })
                      : t('packageCard', 'sharedTripDescription', { p: form.capacity })}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {form.type === 'private' ? (
          <>
            <Toggle
              label={t('owner', 'tripAdditionalPersonAfter')}
              description="Charge per head beyond a base group size."
              checked={form.chargeExtra}
              onChange={(v) => setForm((c) => ({ ...c, chargeExtra: v }))}
            />
            {form.chargeExtra ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('owner', 'tripAdditionalPersonAfter')}>
                  {({ id }) => (
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      value={form.additionalPersonAfter}
                      onChange={(e) => setForm((c) => ({ ...c, additionalPersonAfter: e.target.value }))}
                    />
                  )}
                </Field>
                <Field label={t('owner', 'tripAdditionalPersonPrice')}>
                  {({ id }) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      value={form.additionalPersonPrice}
                      onChange={(e) => setForm((c) => ({ ...c, additionalPersonPrice: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
            ) : null}
          </>
        ) : null}

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink">{t('owner', 'tripDepartureTimes')}</legend>
          <div className="space-y-2">
            {form.departureTimes.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(index, e.target.value)}
                  aria-label={`${t('owner', 'tripDepartureTimes')} ${index + 1}`}
                />
                {form.departureTimes.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((c) => ({
                        ...c,
                        departureTimes: c.departureTimes.filter((_, i) => i !== index),
                      }))
                    }
                    aria-label={t('general', 'remove')}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon="plus"
            className="mt-2"
            onClick={() =>
              setForm((c) => ({ ...c, departureTimes: [...c.departureTimes, '09:00'] }))
            }
          >
            {t('owner', 'addDepartureTime')}
          </Button>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink">{t('owner', 'tripDays')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_LABELS.map((label, index) => {
              const day = index + 1;
              const on = form.weekdays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setForm((c) => ({
                      ...c,
                      weekdays: on ? c.weekdays.filter((d) => d !== day) : [...c.weekdays, day],
                    }))
                  }
                  className={cx(
                    'h-9 w-12 rounded-control border text-sm font-semibold transition-colors',
                    on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line text-ink-soft',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Toggle
          label={t('owner', 'published')}
          description="Inactive trips stay on the listing but cannot be booked."
          checked={form.active}
          onChange={(v) => setForm((c) => ({ ...c, active: v }))}
        />
      </div>
    </Overlay>
  );
}

function seedTrip(existing: TripPackage | null, listing: EditableListing) {
  return {
    title: existing?.title ?? '',
    hours: String(existing?.hours ?? 4),
    type: existing?.type ?? ('private' as 'private' | 'shared'),
    price: String(existing?.price ?? 0),
    capacity: String(existing?.capacity ?? listing.boat.capacity),
    minPersons: String(existing?.minPersons ?? 1),
    chargeExtra: Boolean(existing?.additionalPersonAfter),
    additionalPersonAfter: String(existing?.additionalPersonAfter ?? 4),
    additionalPersonPrice: String(existing?.additionalPersonPrice ?? 0),
    departureTimes: existing?.departureTimes.length ? [...existing.departureTimes] : ['09:00'],
    weekdays: weekdaysFromMask(existing?.weekdayMask ?? WEEKDAY_MASK_ALL),
    active: existing?.active ?? true,
  };
}

// --- Step: location --------------------------------------------------------

function LocationStep({
  listing,
  destinations,
  onSave,
  saving,
}: {
  listing: EditableListing;
  destinations: { slug: string; title: string }[];
  onSave: SaveFn;
  saving: boolean;
}) {
  const [destinationSlug, setDestinationSlug] = useState(listing.destinationSlug);
  const [address, setAddress] = useState(listing.address);
  const [postalCode, setPostalCode] = useState(listing.postalCode);
  const [directions, setDirections] = useState(listing.directions);

  return (
    <div className="space-y-4">
      <Field label={t('pickers', 'destinationLabel')} required>
        {({ id }) => (
          <Select id={id} value={destinationSlug} onChange={(e) => setDestinationSlug(e.target.value)}>
            {destinations.map((destination) => (
              <option key={destination.slug} value={destination.slug}>
                {destination.title}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t('viewCharter', 'whereYoullMeet')} hint={t('viewCharter', 'exactAddressAfterBooking')}>
        {({ id }) => (
          <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
        )}
      </Field>

      <Field label={t('owner', 'postalCode')}>
        {({ id }) => (
          <Input id={id} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} autoComplete="postal-code" />
        )}
      </Field>

      <Field label={t('viewCharter', 'directions')} hint={t('owner', 'directionsHint')}>
        {({ id }) => (
          <Textarea id={id} value={directions} onChange={(e) => setDirections(e.target.value)} rows={5} />
        )}
      </Field>

      <Button
        loading={saving}
        onClick={() => onSave({ destinationSlug, address, postalCode, directions })}
      >
        {t('general', 'saveChanges')}
      </Button>
    </div>
  );
}

// --- Step: policies --------------------------------------------------------

function PoliciesStep({
  listing,
  onSave,
  saving,
}: {
  listing: EditableListing;
  onSave: SaveFn;
  saving: boolean;
}) {
  const [policies, setPolicies] = useState(() => ({ ...listing.policies }));

  const set = <K extends keyof typeof policies>(key: K, value: (typeof policies)[K]) =>
    setPolicies((current) => ({ ...current, [key]: value }));

  const toggleMethod = (key: string) =>
    setPolicies((current) => ({
      ...current,
      acceptedPaymentMethods: current.acceptedPaymentMethods.includes(key)
        ? current.acceptedPaymentMethods.filter((m) => m !== key)
        : [...current.acceptedPaymentMethods, key],
    }));

  return (
    <div className="space-y-5">
      <Toggle
        label={t('owner', 'instantBook')}
        description={t('owner', 'instantBookBody')}
        checked={policies.isInstantBookActive}
        onChange={(v) => set('isInstantBookActive', v)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('owner', 'cancellationPolicyDays')}
          hint="0 means the deposit is non-refundable."
        >
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={30}
              value={policies.freeCancellationDaysInAdvance}
              onChange={(e) => set('freeCancellationDaysInAdvance', Number(e.target.value))}
            />
          )}
        </Field>

        <Field label={t('owner', 'depositPercent')}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={100}
              value={policies.depositPercent}
              onChange={(e) => set('depositPercent', Number(e.target.value))}
            />
          )}
        </Field>
      </div>

      <Toggle
        label={t('packageCard', 'fuelIncluded')}
        checked={policies.fuelIncludedInPrice}
        onChange={(v) => set('fuelIncludedInPrice', v)}
      />

      <Toggle
        label={t('owner', 'securityDeposit')}
        description={t('packageCard', 'securityDepositNote')}
        checked={policies.hasSecurityDeposit}
        onChange={(v) => set('hasSecurityDeposit', v)}
      />

      {policies.hasSecurityDeposit ? (
        <Field label={`${t('owner', 'securityDeposit')} (${listing.currency})`}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              value={policies.securityDepositAmount}
              onChange={(e) => set('securityDepositAmount', Number(e.target.value))}
            />
          )}
        </Field>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">
          {t('viewCharter', 'paymentMethodsTitle')}
        </legend>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {paymentMethods.map((method) => (
            <Checkbox
              key={method.key}
              label={method.title}
              description={method.online ? t('viewCharter', 'paymentOnline') : t('viewCharter', 'paymentOnArrival')}
              checked={policies.acceptedPaymentMethods.includes(method.key)}
              onChange={() => toggleMethod(method.key)}
            />
          ))}
        </div>
      </fieldset>

      <Button loading={saving} onClick={() => onSave({ policies })}>
        {t('general', 'saveChanges')}
      </Button>
    </div>
  );
}
