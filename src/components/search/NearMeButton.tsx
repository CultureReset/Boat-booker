'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/primitives';

/**
 * Resolves the browser's location and jumps into a radius search.
 *
 * A denied or unavailable permission is reported inline rather than silently
 * doing nothing — "I tapped it and nothing happened" is the worst outcome.
 */
export function NearMeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location lookup.');
      return;
    }

    setBusy(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams({
          lat: position.coords.latitude.toFixed(5),
          lon: position.coords.longitude.toFixed(5),
          sort: 'distance',
        });
        router.push(`/charters/search?${params.toString()}`);
      },
      (positionError) => {
        setBusy(false);
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? 'Location access was denied. Search by destination instead.'
            : 'We could not determine your location. Search by destination instead.',
        );
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  return (
    <div>
      <Button size="lg" icon="map-pin" onClick={locate} loading={busy}>
        {busy ? t('pickers', 'loadingCurrentLocation') : t('pickers', 'useMyLocation')}
      </Button>

      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
