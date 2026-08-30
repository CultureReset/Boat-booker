'use client';

import { useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { Icon } from '@/components/ui/Icon';

/**
 * A read-only value with a copy button.
 *
 * Used for referral codes and invite links. Reverts to "copy" after a moment
 * so the button never gets stuck reading "copied".
 */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the value is selectable regardless.
    }
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-control border border-line bg-surface-sunken p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{value}</code>
        <button
          type="button"
          onClick={copy}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded bg-white px-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-surface-sunken"
        >
          <Icon name={copied ? 'check' : 'share'} size={13} />
          {copied ? t('general', 'copied') : t('general', 'copyLink')}
        </button>
      </div>
    </div>
  );
}
