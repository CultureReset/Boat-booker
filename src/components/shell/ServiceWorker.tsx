'use client';

import { useEffect, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

/**
 * Registers the service worker and surfaces connectivity changes.
 *
 * The registration is deferred to `load` so it never competes with the first
 * paint, and skipped entirely in development where a caching worker only gets
 * in the way of hot reload.
 */
export function ServiceWorker() {
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Registration can fail on an insecure origin or with storage blocked.
        // The app works fine without it, so there is nothing to report.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      setRestored(false);
    };
    const goOnline = () => {
      setOffline(false);
      setRestored(true);
      // The "back online" confirmation should not linger.
      setTimeout(() => setRestored(false), 3000);
    };

    setOffline(!navigator.onLine);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline && !restored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white ${
        offline ? 'bg-ink' : 'bg-success'
      }`}
    >
      <Icon name={offline ? 'alert' : 'check-circle'} size={15} />
      {offline ? t('navigation', 'youAreOffline') : t('navigation', 'youAreBackOnline')}
    </div>
  );
}
