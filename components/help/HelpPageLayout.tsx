'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { HelpFaq, HelpSection } from '@/lib/help-content';
import styles from './help.module.css';

interface HelpPageLayoutProps {
  title: string;
  role: string;
  intro: string;
  searchPlaceholder?: string;
  sections: HelpSection[];
  faqs?: HelpFaq[];
}

type IndexedFaq = HelpFaq & {
  resolvedId: string;
  sectionHeading?: string;
  sectionId?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sectionId(section: HelpSection, index: number) {
  return section.id ?? `${slugify(section.heading) || 'section'}-${index + 1}`;
}

function searchable(value: Array<string | string[] | undefined>) {
  return value
    .flatMap(item => Array.isArray(item) ? item : [item])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesQuery(haystack: string, query: string) {
  if (!query) return true;
  return haystack.includes(query);
}

export default function HelpPageLayout({
  title,
  role,
  intro,
  searchPlaceholder,
  sections,
  faqs = [],
}: HelpPageLayoutProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const indexedFaqs = useMemo<IndexedFaq[]>(() => {
    const sectionFaqs = sections.flatMap((section, sectionIndex) => {
      const resolvedSectionId = sectionId(section, sectionIndex);
      return (section.faqs ?? []).map((faq, faqIndex) => ({
        ...faq,
        group: faq.group ?? section.group,
        sectionHeading: section.heading,
        sectionId: resolvedSectionId,
        resolvedId: faq.id ?? `${resolvedSectionId}-faq-${faqIndex + 1}`,
      }));
    });

    const pageFaqs = faqs.map((faq, faqIndex) => ({
      ...faq,
      resolvedId: faq.id ?? `faq-${faqIndex + 1}`,
    }));

    return [...sectionFaqs, ...pageFaqs];
  }, [faqs, sections]);

  const faqMatches = useMemo(() => {
    return indexedFaqs.filter(faq => matchesQuery(searchable([
      faq.question,
      faq.answerText,
      faq.group,
      faq.sectionHeading,
      faq.keywords,
    ]), normalizedQuery));
  }, [indexedFaqs, normalizedQuery]);

  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;

    return sections.filter((section, index) => {
      const id = sectionId(section, index);
      const sectionMatch = matchesQuery(searchable([
        section.heading,
        section.summary,
        section.group,
        section.searchText,
        section.keywords,
      ]), normalizedQuery);
      const hasFaqMatch = faqMatches.some(faq => faq.sectionId === id);
      return sectionMatch || hasFaqMatch;
    });
  }, [faqMatches, normalizedQuery, sections]);

  const groupedSections = useMemo(() => {
    const groups = new Map<string, Array<{ section: HelpSection; id: string }>>();
    visibleSections.filter(section => !section.hideFromContents).forEach(section => {
      const group = section.group ?? 'Guide';
      const items = groups.get(group) ?? [];
      items.push({ section, id: sectionId(section, sections.indexOf(section)) });
      groups.set(group, items);
    });
    return [...groups.entries()];
  }, [sections, visibleSections]);

  const popularFaqs = indexedFaqs.filter(faq => faq.popular).slice(0, 8);
  const displayedFaqs = normalizedQuery ? faqMatches : indexedFaqs;
  const hasSearch = normalizedQuery.length > 0;
  const hasResults = visibleSections.length > 0 || displayedFaqs.length > 0;

  return (
    <div className={styles.helpPage}>
      <aside className={styles.helpSidePanel} aria-label="Help navigation">
        <div className={styles.helpSideInner}>
          <div className={styles.helpSearchPanel}>
            <label className={styles.helpSearchLabel} htmlFor="help-search">
              Search this guide
            </label>
            <div className={styles.helpSearchBox}>
              <Search size={16} className={styles.helpSearchIcon} />
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchPlaceholder ?? 'Search help...'}
                className={styles.helpSearchInput}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className={styles.helpSearchClear}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {hasSearch && (
              <p className={styles.helpSearchMeta}>
                {hasResults
                  ? `${visibleSections.length} section${visibleSections.length === 1 ? '' : 's'} and ${displayedFaqs.length} FAQ${displayedFaqs.length === 1 ? '' : 's'} found`
                  : 'No matching help found. Try a broader search term.'}
              </p>
            )}
          </div>

          {!hasSearch && popularFaqs.length > 0 && (
            <div className={styles.quickAnswers}>
              <h2 className={styles.helpUtilityTitle}>Popular Questions</h2>
              <div className={styles.quickAnswerGrid}>
                {popularFaqs.map(faq => (
                  <a key={faq.resolvedId} href={`#${faq.resolvedId}`} className={styles.quickAnswerLink}>
                    {faq.question}
                  </a>
                ))}
              </div>
            </div>
          )}

          {groupedSections.length > 0 && (
            <nav className={styles.helpToc} aria-label="Guide contents">
              <h2 className={styles.helpUtilityTitle}>Contents</h2>
              <div className={styles.helpTocGroups}>
                {groupedSections.map(([group, items]) => (
                  <div key={group} className={styles.helpTocGroup}>
                    <p className={styles.helpTocGroupTitle}>{group}</p>
                    <div className={styles.helpTocLinks}>
                      {items.map(({ section, id }) => (
                        <a key={id} href={`#${id}`} className={styles.helpTocLink}>
                          <span>{section.heading}</span>
                          {section.summary && <em>{section.summary}</em>}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>
          )}
        </div>
      </aside>

      <main className={styles.helpMain}>
        <div className={styles.helpPageHeader}>
          <h1 className={styles.helpPageTitle}>{title}</h1>
          <span className={styles.helpRoleBadge}>For: {role}</span>
        </div>
        <p className={styles.helpIntro}>{intro}</p>

        {!hasResults && (
          <div className={styles.helpEmptyResults}>
            <p className={styles.emptyStateTitle}>No matching help found</p>
            <p className={styles.emptyStateSub}>Try a broader term like schedule, scores, registration, or archive.</p>
          </div>
        )}

        <div className={styles.helpSections}>
          {visibleSections.map((section, i) => {
            const originalIndex = sections.indexOf(section);
            const id = sectionId(section, originalIndex >= 0 ? originalIndex : i);
            return (
            <section key={id} id={id} className={styles.helpSection}>
              <div className={styles.helpSectionHeader}>
                <div>
                  {section.group && <p className={styles.helpSectionGroup}>{section.group}</p>}
                  <h2 className={styles.helpSectionHeading}>{section.heading}</h2>
                </div>
                {section.links && section.links.length > 0 && (
                  <div className={styles.helpSectionLinks}>
                    {section.links.map(link => (
                      <Link key={link.href} href={link.href} className={styles.helpSectionLink}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {section.summary && <p className={styles.helpSectionSummary}>{section.summary}</p>}
              <div className={styles.helpSectionContent}>{section.content}</div>
            </section>
          )})}
        </div>

        {indexedFaqs.length > 0 && (
          <section className={styles.helpFaqSection} aria-labelledby="help-faq-heading">
            <div className={styles.helpFaqHeader}>
              <h2 id="help-faq-heading" className={styles.helpUtilityTitle}>FAQs</h2>
              <span>{displayedFaqs.length} question{displayedFaqs.length === 1 ? '' : 's'}</span>
            </div>
            {displayedFaqs.length === 0 ? (
              <p className={styles.helpNoResults}>No FAQs match this search.</p>
            ) : (
              <div className={styles.helpFaqList}>
                {displayedFaqs.map(faq => (
                  <details key={faq.resolvedId} id={faq.resolvedId} className={styles.helpFaqItem} open={hasSearch}>
                    <summary>
                      <span>{faq.question}</span>
                      {faq.group && <em>{faq.group}</em>}
                    </summary>
                    <div className={styles.helpFaqAnswer}>{faq.answer}</div>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
