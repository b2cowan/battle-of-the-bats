'use client';

import { useEffect, useMemo, useState } from 'react';
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

type IndexedSection = {
  section: HelpSection;
  id: string;
  index: number;
};

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
  // SSR-safe initial state: always start on the first topic so the server and the first
  // client render agree. The deep-link hash is applied after mount in the effect below.
  const [activeSectionId, setActiveSectionId] = useState(() => (
    sections[0] ? sectionId(sections[0], 0) : ''
  ));
  const [focusedFaqId, setFocusedFaqId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const indexedSections = useMemo<IndexedSection[]>(() => (
    sections.map((section, index) => ({
      section,
      id: sectionId(section, index),
      index,
    }))
  ), [sections]);

  const indexedFaqs = useMemo<IndexedFaq[]>(() => {
    const sectionFaqs = indexedSections.flatMap(({ section, id }) => (
      (section.faqs ?? []).map((faq, faqIndex) => ({
        ...faq,
        group: faq.group ?? section.group,
        sectionHeading: section.heading,
        sectionId: id,
        resolvedId: faq.id ?? `${id}-faq-${faqIndex + 1}`,
      }))
    ));

    const pageFaqs = faqs.map((faq, faqIndex) => ({
      ...faq,
      resolvedId: faq.id ?? `faq-${faqIndex + 1}`,
    }));

    return [...sectionFaqs, ...pageFaqs];
  }, [faqs, indexedSections]);

  // Resolve a deep-link hash (e.g. #data-tools-imports) to the matching topic or question
  // after mount. Reading window.location.hash during render/SSR is unreliable and causes a
  // hydration mismatch, so we apply it here and also respond to in-browser hash navigation.
  // In-page topic switches use history.replaceState (no hashchange event), so this does not
  // fight the on-page navigation.
  useEffect(() => {
    function applyHash() {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!hash) return;

      const targetSection = indexedSections.find(item => item.id === hash);
      if (targetSection) {
        setActiveSectionId(targetSection.id);
        setFocusedFaqId(null);
        requestAnimationFrame(() => {
          document.getElementById('help-article')?.scrollIntoView({ block: 'start' });
        });
        return;
      }

      const targetFaq = indexedFaqs.find(faq => faq.resolvedId === hash);
      if (targetFaq) {
        if (targetFaq.sectionId) setActiveSectionId(targetFaq.sectionId);
        setFocusedFaqId(targetFaq.resolvedId);
        const scrollTargetId = targetFaq.sectionId ? 'help-article' : 'help-article-faqs';
        requestAnimationFrame(() => {
          document.getElementById(scrollTargetId)?.scrollIntoView({ block: 'start' });
        });
      }
    }

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [indexedSections, indexedFaqs]);

  const faqMatches = useMemo(() => {
    return indexedFaqs.filter(faq => matchesQuery(searchable([
      faq.question,
      faq.answerText,
      faq.group,
      faq.sectionHeading,
      faq.keywords,
    ]), normalizedQuery));
  }, [indexedFaqs, normalizedQuery]);

  const sectionMatches = useMemo(() => {
    if (!normalizedQuery) return indexedSections;

    return indexedSections.filter(({ section, id }) => {
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
  }, [faqMatches, indexedSections, normalizedQuery]);

  const groupedSections = useMemo(() => {
    const groups = new Map<string, IndexedSection[]>();
    sectionMatches.filter(item => !item.section.hideFromContents).forEach(item => {
      const group = item.section.group ?? 'Guide';
      const items = groups.get(group) ?? [];
      items.push(item);
      groups.set(group, items);
    });
    return [...groups.entries()];
  }, [sectionMatches]);

  const activeSectionRecord = indexedSections.find(item => item.id === activeSectionId) ?? indexedSections[0];
  const activeSection = activeSectionRecord?.section;
  const activeIndex = activeSectionRecord?.index ?? 0;
  const previousSection = activeIndex > 0 ? indexedSections[activeIndex - 1] : null;
  const nextSection = activeIndex < indexedSections.length - 1 ? indexedSections[activeIndex + 1] : null;
  const activeSectionFaqs = indexedFaqs.filter(faq => faq.sectionId === activeSectionRecord?.id);
  const pagePopularFaqs = indexedFaqs.filter(faq => !faq.sectionId && faq.popular).slice(0, 4);
  const focusedFaq = focusedFaqId ? indexedFaqs.find(faq => faq.resolvedId === focusedFaqId) : null;
  const articleFaqs = [
    ...activeSectionFaqs,
    ...pagePopularFaqs.filter(faq => !activeSectionFaqs.some(item => item.resolvedId === faq.resolvedId)),
    ...(focusedFaq && !activeSectionFaqs.some(faq => faq.resolvedId === focusedFaq.resolvedId)
      ? [focusedFaq]
      : []),
  ].slice(0, 6);

  const popularFaqs = indexedFaqs.filter(faq => faq.popular).slice(0, 8);
  const hasSearch = normalizedQuery.length > 0;
  const hasResults = sectionMatches.length > 0 || faqMatches.length > 0;

  function openSection(id: string, options?: { clearSearch?: boolean; faqId?: string }) {
    setActiveSectionId(id);
    setFocusedFaqId(options?.faqId ?? null);
    if (options?.clearSearch) setQuery('');
    if (typeof window !== 'undefined') {
      const hash = options?.faqId ?? id;
      window.history.replaceState(null, '', `#${hash}`);
      document.getElementById('help-article')?.scrollIntoView({ block: 'start' });
    }
  }

  function openFaq(faq: IndexedFaq, options?: { clearSearch?: boolean }) {
    if (faq.sectionId) {
      openSection(faq.sectionId, { clearSearch: options?.clearSearch, faqId: faq.resolvedId });
      return;
    }
    setFocusedFaqId(faq.resolvedId);
    if (options?.clearSearch) setQuery('');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${faq.resolvedId}`);
      document.getElementById('help-article-faqs')?.scrollIntoView({ block: 'start' });
    }
  }

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
                  ? `${sectionMatches.length} topic${sectionMatches.length === 1 ? '' : 's'} and ${faqMatches.length} question${faqMatches.length === 1 ? '' : 's'} found`
                  : 'No matching help found. Try a broader search term.'}
              </p>
            )}
          </div>

          {!hasSearch && popularFaqs.length > 0 && (
            <div className={styles.quickAnswers}>
              <h2 className={styles.helpUtilityTitle}>Popular Questions</h2>
              <div className={styles.quickAnswerGrid}>
                {popularFaqs.map(faq => (
                  <button
                    key={faq.resolvedId}
                    type="button"
                    className={styles.quickAnswerLink}
                    onClick={() => openFaq(faq)}
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {groupedSections.length > 0 && (
            <nav className={styles.helpToc} aria-label="Guide contents">
              <h2 className={styles.helpUtilityTitle}>Topics</h2>
              <div className={styles.helpTocGroups}>
                {groupedSections.map(([group, items]) => (
                  <div key={group} className={styles.helpTocGroup}>
                    <p className={styles.helpTocGroupTitle}>{group}</p>
                    <div className={styles.helpTocLinks}>
                      {items.map(({ section, id }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => openSection(id, { clearSearch: true })}
                          className={`${styles.helpTocLink} ${id === activeSectionRecord?.id ? styles.helpTocLinkActive : ''}`}
                        >
                          <span>{section.heading}</span>
                          {section.summary && <em>{section.summary}</em>}
                        </button>
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

        {hasSearch ? (
          <section className={styles.helpSearchResults} aria-label="Search results">
            <div className={styles.helpResultHeader}>
              <h2>Search Results</h2>
              <span>{sectionMatches.length + faqMatches.length} result{sectionMatches.length + faqMatches.length === 1 ? '' : 's'}</span>
            </div>

            {!hasResults && (
              <div className={styles.helpEmptyResults}>
                <p className={styles.emptyStateTitle}>No matching help found</p>
                <p className={styles.emptyStateSub}>Try a broader term like schedule, scores, registration, billing, module, or export.</p>
              </div>
            )}

            {sectionMatches.length > 0 && (
              <div className={styles.helpResultGroup}>
                <h3>Topics</h3>
                <div className={styles.helpResultList}>
                  {sectionMatches.map(({ section, id }) => (
                    <button
                      key={id}
                      type="button"
                      className={styles.helpResultButton}
                      onClick={() => openSection(id, { clearSearch: true })}
                    >
                      <span>{section.group ?? 'Guide'}</span>
                      <strong>{section.heading}</strong>
                      {section.summary && <em>{section.summary}</em>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {faqMatches.length > 0 && (
              <div className={styles.helpResultGroup}>
                <h3>Questions</h3>
                <div className={styles.helpResultList}>
                  {faqMatches.map(faq => (
                    <button
                      key={faq.resolvedId}
                      type="button"
                      className={styles.helpResultButton}
                      onClick={() => openFaq(faq, { clearSearch: true })}
                    >
                      <span>{faq.group ?? faq.sectionHeading ?? 'FAQ'}</span>
                      <strong>{faq.question}</strong>
                      {faq.answerText && <em>{faq.answerText}</em>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : activeSection ? (
          <article id="help-article" className={styles.helpArticle}>
            <div className={styles.helpArticleMeta}>
              <span>Topic {activeIndex + 1} of {indexedSections.length}</span>
              {activeSection.group && <em>{activeSection.group}</em>}
            </div>

            <div className={styles.helpSectionHeader}>
              <div>
                <h2 className={styles.helpArticleTitle}>{activeSection.heading}</h2>
                {activeSection.summary && <p className={styles.helpSectionSummary}>{activeSection.summary}</p>}
              </div>
              {activeSection.links && activeSection.links.length > 0 && (
                <div className={styles.helpSectionLinks}>
                  {activeSection.links.map(link => (
                    <Link key={link.href} href={link.href} className={styles.helpSectionLink}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.helpSectionContent}>{activeSection.content}</div>

            {articleFaqs.length > 0 && (
              <section id="help-article-faqs" className={styles.helpFaqSection} aria-labelledby="help-article-faq-heading">
                <div className={styles.helpFaqHeader}>
                  <h3 id="help-article-faq-heading" className={styles.helpUtilityTitle}>Related Questions</h3>
                  <span>{articleFaqs.length} question{articleFaqs.length === 1 ? '' : 's'}</span>
                </div>
                <div className={styles.helpFaqList}>
                  {articleFaqs.map(faq => (
                    <details
                      key={faq.resolvedId}
                      id={faq.resolvedId}
                      className={styles.helpFaqItem}
                      open={focusedFaqId === faq.resolvedId}
                    >
                      <summary>
                        <span>{faq.question}</span>
                        {faq.group && <em>{faq.group}</em>}
                      </summary>
                      <div className={styles.helpFaqAnswer}>{faq.answer}</div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <nav className={styles.helpArticleNav} aria-label="Topic navigation">
              {previousSection ? (
                <button type="button" className={styles.helpArticleNavButton} onClick={() => openSection(previousSection.id)}>
                  <span>Previous</span>
                  <strong>{previousSection.section.heading}</strong>
                </button>
              ) : <span />}
              {nextSection ? (
                <button type="button" className={styles.helpArticleNavButton} onClick={() => openSection(nextSection.id)}>
                  <span>Next</span>
                  <strong>{nextSection.section.heading}</strong>
                </button>
              ) : <span />}
            </nav>
          </article>
        ) : (
          <div className={styles.helpEmptyResults}>
            <p className={styles.emptyStateTitle}>No help topics available</p>
            <p className={styles.emptyStateSub}>This guide does not have any published topics yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
