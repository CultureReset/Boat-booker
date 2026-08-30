import type { StaticPage } from '@/content/pages';
import { Icon } from '@/components/ui/Icon';

/**
 * Renders a `StaticPage` from `content/pages.ts`.
 *
 * A single renderer for every policy and informational page means they all
 * share type scale, spacing and heading levels — and a new page needs no new
 * markup.
 */
export function StaticPageBody({ page }: { page: StaticPage }) {
  return (
    <article>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{page.title}</h1>
        {page.subtitle ? <p className="mt-2 text-base text-ink-soft">{page.subtitle}</p> : null}
        {page.updated ? <p className="mt-2 text-xs text-ink-faint">{page.updated}</p> : null}
      </header>

      <div className="space-y-8">
        {page.sections.map((section, index) => (
          <section key={index} aria-labelledby={section.heading ? `section-${index}` : undefined}>
            {section.heading ? (
              <h2 id={`section-${index}`} className="mb-2.5 text-lg font-bold text-ink">
                {section.heading}
              </h2>
            ) : null}

            {section.paragraphs?.map((paragraph, pIndex) => (
              <p key={pIndex} className="mb-3 text-[15px] leading-relaxed text-ink-soft last:mb-0">
                {paragraph}
              </p>
            ))}

            {section.bullets ? (
              <ul className="space-y-2">
                {section.bullets.map((bullet, bIndex) => (
                  <li key={bIndex} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-soft">
                    <Icon name="check" size={16} className="mt-1 shrink-0 text-brand-600" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {section.steps ? (
              <ol className="space-y-3">
                {section.steps.map((step, sIndex) => (
                  <li key={sIndex} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {sIndex + 1}
                    </span>
                    <span>
                      <span className="block text-[15px] font-bold text-ink">{step.title}</span>
                      <span className="mt-0.5 block text-[15px] leading-relaxed text-ink-soft">
                        {step.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
