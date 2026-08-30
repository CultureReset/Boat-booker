'use client';

import { useMemo, useState } from 'react';
import { translate as t } from '@/i18n/translate';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';

/**
 * Searchable, filterable help articles with accordion answers.
 *
 * Search runs client-side over the full article set — there are tens of
 * articles, not thousands, so a round trip per keystroke would be pure latency.
 */

interface Article {
  id: string;
  category: string;
  question: string;
  answer: string[];
}

interface Category {
  key: string;
  title: string;
  icon: string;
}

export function HelpSearch({
  articles,
  categories,
}: {
  articles: Article[];
  categories: readonly Category[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category && article.category !== category) return false;
      if (!needle) return true;
      return (
        article.question.toLowerCase().includes(needle) ||
        article.answer.some((paragraph) => paragraph.toLowerCase().includes(needle))
      );
    });
  }, [articles, query, category]);

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <div className="relative mb-4">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('general', 'search')}
          aria-label={t('general', 'search')}
          className="h-12 w-full rounded-control border border-line pl-10 pr-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </div>

      <div className="-mx-4 mb-5 px-4">
        <ul className="rail">
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={cx(
                'flex h-9 items-center rounded-full px-3.5 text-sm transition-colors',
                !category ? 'bg-ink font-bold text-white' : 'border border-line bg-white font-medium text-ink-soft',
              )}
            >
              {t('bookings', 'all')}
            </button>
          </li>
          {categories.map((item) => (
            <li key={item.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setCategory(category === item.key ? null : item.key)}
                className={cx(
                  'flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors',
                  category === item.key
                    ? 'bg-ink font-bold text-white'
                    : 'border border-line bg-white font-medium text-ink-soft',
                )}
              >
                <Icon name={item.icon as IconName} size={14} />
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {results.length === 0 ? (
        <p className="rounded-card border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t('pickers', 'noMatches', { query })}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {results.map((article) => {
            const open = openIds.has(article.id);
            return (
              <li key={article.id}>
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(article.id)}
                    aria-expanded={open}
                    aria-controls={`answer-${article.id}`}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-sunken"
                  >
                    <span className="flex-1 text-sm font-semibold text-ink">{article.question}</span>
                    <Icon
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      className="shrink-0 text-ink-muted"
                    />
                  </button>
                </h3>
                {open ? (
                  <div id={`answer-${article.id}`} className="px-4 pb-4">
                    {article.answer.map((paragraph, index) => (
                      <p key={index} className="mb-2 text-sm leading-relaxed text-ink-soft last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
