'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { api } from '@/lib/client/api';
import { Button } from '@/components/ui/primitives';

/** Signs out and returns to the public site. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      fullWidth
      icon="logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.post('/api/auth/logout', {});
          // A full navigation rather than a push: signing out should discard
          // every cached server component tied to the old session.
          window.location.href = '/';
        } catch {
          setBusy(false);
        }
        router.refresh();
      }}
    >
      {t('navigation', 'logout')}
    </Button>
  );
}
