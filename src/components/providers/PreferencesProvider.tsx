'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { currencyByCode, defaultCurrency, defaultLanguage, languageByCode } from '@/config/locale';
import { formatMoney } from '@/lib/core/money';

/**
 * Display preferences: currency and language.
 *
 * These are presentation-only — prices are always stored in the listing's own
 * currency and converted at render time. The choice is persisted to
 * localStorage so it survives a reload for signed-out visitors, and synced to
 * the account for signed-in ones.
 */

const STORAGE_KEY = 'bb_preferences';

interface PreferencesValue {
  currency: string;
  language: string;
  setCurrency: (code: string) => void;
  setLanguage: (code: string) => void;
  /** Format an amount already expressed in the active display currency. */
  format: (amount: number) => string;
  currencySymbol: string;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({
  initialCurrency,
  initialLanguage,
  children,
}: {
  initialCurrency: string;
  initialLanguage: string;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = useState(initialCurrency);
  const [language, setLanguageState] = useState(initialLanguage);

  // Read the stored preference after mount rather than during render, so the
  // server and client markup agree on the first pass and React does not warn
  // about a hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { currency?: string; language?: string };
      if (stored.currency && currencyByCode.has(stored.currency)) setCurrencyState(stored.currency);
      if (stored.language && languageByCode.has(stored.language)) setLanguageState(stored.language);
    } catch {
      // A corrupt or unavailable store just means we keep the server defaults.
    }
  }, []);

  const persist = useCallback((next: { currency: string; language: string }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse writes; the preference still applies for
      // this session, it just will not be remembered.
    }
  }, []);

  const setCurrency = useCallback(
    (code: string) => {
      const normalized = code.toUpperCase();
      if (!currencyByCode.has(normalized)) return;
      setCurrencyState(normalized);
      persist({ currency: normalized, language });
      // Persist to the account too, when there is one. A failure here is not
      // worth interrupting the user for.
      void fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currency: normalized }),
      }).catch(() => {});
    },
    [language, persist],
  );

  const setLanguage = useCallback(
    (code: string) => {
      if (!languageByCode.has(code)) return;
      setLanguageState(code);
      persist({ currency, language: code });
      void fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: code }),
      }).catch(() => {});
    },
    [currency, persist],
  );

  const value = useMemo<PreferencesValue>(
    () => ({
      currency,
      language,
      setCurrency,
      setLanguage,
      format: (amount: number) => formatMoney(amount, currency),
      currencySymbol: currencyByCode.get(currency)?.symbol ?? currencyByCode.get(defaultCurrency)!.symbol,
    }),
    [currency, language, setCurrency, setLanguage],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    // Falls back to defaults rather than throwing, so a component can be
    // rendered in isolation (tests, storybook) without the provider.
    return {
      currency: defaultCurrency,
      language: defaultLanguage,
      setCurrency: () => {},
      setLanguage: () => {},
      format: (amount: number) => formatMoney(amount, defaultCurrency),
      currencySymbol: currencyByCode.get(defaultCurrency)!.symbol,
    };
  }
  return context;
}
