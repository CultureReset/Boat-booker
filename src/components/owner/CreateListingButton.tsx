'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { api, errorMessage } from '@/lib/client/api';
import { Overlay } from '@/components/ui/Overlay';
import { Button, Field, Input, Select } from '@/components/ui/primitives';

/**
 * Creates a draft listing and drops the owner straight into the editor.
 *
 * Only two fields are asked for up front — a name and where the boat is —
 * because everything else is easier to fill in against a real editor than in a
 * modal, and a draft is not visible to anyone until it is published.
 */
export function CreateListingButton({
  destinations,
}: {
  destinations: { slug: string; title: string }[];
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [destinationSlug, setDestinationSlug] = useState(destinations[0]?.slug ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const listing = await api.post<{ id: string }>('/api/owner/listings', { title, destinationSlug });
      router.push(`/owner/listings/${listing.id}`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        {t('owner', 'createListing')}
      </Button>

      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        title={t('owner', 'createListing')}
        size="sm"
        footer={
          <Button fullWidth onClick={create} loading={busy} disabled={title.trim().length < 3 || !destinationSlug}>
            {t('general', 'continue')}
          </Button>
        }
      >
        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="space-y-4">
          <Field label={t('owner', 'listingTitleLabel')} required>
            {({ id }) => (
              <Input
                id={id}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('login', 'companyNamePlaceholder')}
                autoFocus
              />
            )}
          </Field>

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
        </div>
      </Overlay>
    </>
  );
}
