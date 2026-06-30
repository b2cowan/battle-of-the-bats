'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, X, List } from 'lucide-react';
import type { HelpFaq, HelpSection } from '@/lib/help-content';
import { resolveSectionId, resolveFaqId } from '@/lib/help-content';
import HelpSectionBlock from './HelpSectionBlock';
import WhatsNewHelpLink from '@/components/whats-new/WhatsNewHelpLink';
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

// Scroll to a section/FAQ by id. For an FAQ, open its <details> imperatively —
// the <details> is otherwise uncontrolled so the reader can freely toggle it
// without a re-render snapping it shut.
function revealAndScroll(id: string, opts?: { faq?: boolean }) {
  const el = document.getElementById(id);
  if (!el) return;
  if (opts?.faq && el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// Stable empty-array default. Guides without page-level FAQs would otherwise get a
// fresh `[]` on every render, churning the indexed-data memos and re-firing the
// deep-link scroll effect each render — which yanks the reader back to the hash.
const EMPTY_FAQS: HelpFaq[] = [];

export default function HelpPageLayout({
  title,
  role,
  intro,
  searchPlaceholder,
  sections,
  faqs = EMPTY_FAQS,
}: HelpPageLayoutProps) {
  const [query, setQuery] = useState('');
  // Mobile-only: the "Sections" drawer (the section selector) open state.
  const [tocOpen, setTocOpen] = useState(false);
  const closeToc = () => setTocOpen(false);
  // On mobile the bar (What's New + search) is fixed to the top of the screen.
  // Measure it so the article can be padded clear of it (a fixed bar is out of
  // flow, so the content would otherwise start underneath it).
  const tocBarRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  // SSR-safe: no hash read during render; applied after mount via effect below.
  // Track which TOC group is currently expanded (auto-driven by scroll-spy).
  // null means "all groups revealed" (search mode).
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(0);
  const mainRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  const normalizedQuery = query.trim().toLowerCase();
  const hasSearch = normalizedQuery.length > 0;

  // The Help hub is this guide's parent path (works for both the customer and
  // platform-admin help shells). Lets the reader get back to all guides.
  const pathname = usePathname();
  const hubHref = pathname ? pathname.replace(/\/[^/]+\/?$/, '') : '.';

  const indexedSections = useMemo<IndexedSection[]>(() => (
    sections.map((section, index) => ({
      section,
      id: resolveSectionId(section, index),
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
        resolvedId: resolveFaqId(id, faq, faqIndex),
      }))
    ));

    const pageFaqs = faqs.map((faq, faqIndex) => ({
      ...faq,
      resolvedId: faq.id ?? `faq-${faqIndex + 1}`,
    }));

    return [...sectionFaqs, ...pageFaqs];
  }, [faqs, indexedSections]);

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
        section.subgroup,
        section.searchText,
        section.keywords,
      ]), normalizedQuery);
      const hasFaqMatch = faqMatches.some(faq => faq.sectionId === id);
      return sectionMatch || hasFaqMatch;
    });
  }, [faqMatches, indexedSections, normalizedQuery]);

  // Group -> optional subgroup -> sections
  const groupedSections = useMemo(() => {
    const groups = new Map<string, Map<string | null, IndexedSection[]>>();
    // Body renders every matching section; hideFromContents only hides it from the TOC (below).
    sectionMatches.forEach(item => {
      const group = item.section.group ?? 'Guide';
      const subgroup = item.section.subgroup ?? null;
      if (!groups.has(group)) groups.set(group, new Map());
      const subMap = groups.get(group)!;
      if (!subMap.has(subgroup)) subMap.set(subgroup, []);
      subMap.get(subgroup)!.push(item);
    });
    return [...groups.entries()].map(([group, subMap]) => ({
      group,
      subgroups: [...subMap.entries()].map(([sub, items]) => ({ sub, items })),
      allItems: [...subMap.values()].flat(),
    }));
  }, [sectionMatches]);

  // Deep-link: scroll to the hash target on mount and on real hashchange (back/forward).
  // Guard against re-scrolling to the SAME hash: if this effect re-runs for any other
  // reason (e.g. the scroll-spy updating state as the reader scrolls), honouring the
  // hash again would snap the page back to the deep-linked section on every scroll.
  const lastAppliedHashRef = useRef<string | null>(null);
  useEffect(() => {
    function applyHash() {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (!hash) { lastAppliedHashRef.current = null; return; }
      // Already honoured this hash — don't fight the reader's own scrolling.
      if (hash === lastAppliedHashRef.current) return;

      const targetSection = indexedSections.find(item => item.id === hash);
      if (targetSection) {
        lastAppliedHashRef.current = hash;
        setActiveSectionId(targetSection.id);
        requestAnimationFrame(() => revealAndScroll(targetSection.id));
        return;
      }

      const targetFaq = indexedFaqs.find(faq => faq.resolvedId === hash);
      if (targetFaq) {
        lastAppliedHashRef.current = hash;
        if (targetFaq.sectionId) setActiveSectionId(targetFaq.sectionId);
        requestAnimationFrame(() => revealAndScroll(targetFaq.resolvedId, { faq: true }));
      }
    }

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [indexedSections, indexedFaqs]);

  // IntersectionObserver scroll-spy: auto-focus the TOC group the reader is in
  // and highlight the active section link. Re-connect when sections or search changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Among everything in the active band, pick the topmost section so the
        // highlighted TOC entry matches what the reader is actually looking at.
        const sectionEl = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
          ?.target as HTMLElement | undefined;
        if (!sectionEl) return;
        setActiveSectionId(sectionEl.id);
        const gi = sectionEl.dataset.groupIndex;
        if (gi !== undefined) {
          const parsed = parseInt(gi, 10);
          if (!Number.isNaN(parsed)) setActiveGroupIndex(parsed);
        }
      },
      { rootMargin: '-82px 0px -68% 0px', threshold: 0 },
    );

    observerRef.current = observer;

    // Observe all topic sections in the main content
    const topicEls = document.querySelectorAll('[data-help-section]');
    topicEls.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [groupedSections]);

  // Keep the measured bar height current — it changes with the search-result meta
  // line and across the mobile/desktop breakpoint.
  useEffect(() => {
    const el = tocBarRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setBarHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasResults = sectionMatches.length > 0 || faqMatches.length > 0;
  const pageStyle = barHeight
    ? ({ '--help-bar-h': `${barHeight}px` } as CSSProperties)
    : undefined;

  return (
    <div className={styles.helpPage} style={pageStyle}>
      {/* ── Sticky TOC sidebar ─────────────────────────────────────────────── */}
      <aside className={styles.helpSidePanel} aria-label="Help navigation">
        <nav className={styles.helpTocSticky} aria-label="Guide contents">

          {/* The bar: What's New + search. Sticky in the column on desktop; fixed
              to the top of the screen on mobile (measured so the article clears it). */}
          <div className={styles.helpTocBar} ref={tocBarRef}>

          {/* What's New lives at the top of the side nav (not the article header)
              so it stays reachable while scrolling the guide. */}
          <div className={styles.helpSideWhatsNew}>
            <WhatsNewHelpLink />
          </div>

          {/* In-guide search + (mobile) section-drawer toggle */}
          <div className={styles.helpSearchPanel}>
            <div className={styles.helpSearchRow}>
              <div className={styles.helpSearchBox}>
                <Search size={15} className={styles.helpSearchIcon} />
                <input
                  id="help-search"
                  type="search"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={searchPlaceholder ?? 'Search this guide...'}
                  className={styles.helpSearchInput}
                  aria-label="Search this guide"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className={styles.helpSearchClear}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className={styles.helpTocToggle}
                onClick={() => setTocOpen(o => !o)}
                aria-expanded={tocOpen}
                aria-controls="help-toc-drawer"
              >
                <List size={15} aria-hidden />
                Sections
              </button>
            </div>
            {hasSearch && (
              <p className={styles.helpSearchMeta}>
                {hasResults
                  ? `${sectionMatches.length} topic${sectionMatches.length === 1 ? '' : 's'}${faqMatches.length > 0 ? `, ${faqMatches.length} Q&A` : ''}`
                  : 'No results — try a broader term.'}
              </p>
            )}
          </div>
          </div>

          {/* Section list — inline on desktop; a pinned section-selector drawer on mobile */}
          {groupedSections.length > 0 && (
            <nav
              id="help-toc-drawer"
              className={`${styles.helpTocGroups} ${tocOpen ? styles.helpTocGroupsOpen : ''}`}
              aria-label="Guide sections"
            >
              <div className={styles.helpTocDrawerHead}>
                <span>Sections</span>
                <button
                  type="button"
                  onClick={closeToc}
                  className={styles.helpTocDrawerClose}
                  aria-label="Close sections"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              {groupedSections.map(({ group, subgroups }, gi) => {
                // TOC excludes hideFromContents sections (they still render in the body).
                const visibleSubgroups = subgroups
                  .map(({ sub, items }) => ({ sub, items: items.filter(it => !it.section.hideFromContents) }))
                  .filter(sg => sg.items.length > 0);
                if (visibleSubgroups.length === 0) return null;
                const isExpanded = hasSearch || activeGroupIndex === null || activeGroupIndex === gi;
                return (
                  <div
                    key={group}
                    className={`${styles.helpTocGroup} ${isExpanded ? '' : styles.helpTocGroupCollapsed}`}
                  >
                    <button
                      type="button"
                      className={styles.helpTocGroupHead}
                      onClick={() => setActiveGroupIndex(activeGroupIndex === gi ? null : gi)}
                      aria-expanded={isExpanded}
                    >
                      <span className={styles.helpTocGroupCaret} aria-hidden="true">▼</span>
                      <span>{group}</span>
                    </button>

                    <div className={styles.helpTocChildren}>
                      {visibleSubgroups.map(({ sub, items }) => (
                        <div key={sub ?? '__flat'}>
                          {sub && (
                            <p className={styles.helpTocSubLabel}>{sub}</p>
                          )}
                          {items.map(({ section, id }) => (
                            <a
                              key={id}
                              href={`#${id}`}
                              aria-current={activeSectionId === id ? 'location' : undefined}
                              className={`${styles.helpTocLink} ${sub ? styles.helpTocLinkSub : ''} ${activeSectionId === id ? styles.helpTocLinkActive : ''}`}
                              onClick={(e) => {
                                e.preventDefault();
                                window.history.replaceState(null, '', `#${id}`);
                                closeToc();
                                revealAndScroll(id);
                              }}
                            >
                              {section.heading}
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          )}
        </nav>
      </aside>

      {/* ── Main content area ──────────────────────────────────────────────── */}
      <main ref={mainRef} className={styles.helpMain}>
        {/* Decluttered header */}
        <header className={styles.helpPageHeader}>
          <nav className={styles.helpBreadcrumb} aria-label="Breadcrumb">
            <Link href={hubHref}>← All guides</Link>
            <span className={styles.helpBreadcrumbSep} aria-hidden="true">/</span>
            <span className={styles.helpBreadcrumbCurrent}>{title}</span>
          </nav>
          <h1 className={styles.helpPageTitle}>{title}</h1>
          <p className={styles.helpRoleLine}>For: {role}</p>
          <p className={styles.helpIntro}>{intro}</p>
        </header>

        {/* Search results overlay */}
        {hasSearch ? (
          <section className={styles.helpSearchResults} aria-label="Search results">
            <div className={styles.helpResultHeader}>
              <h2>Search Results</h2>
              <span>{sectionMatches.length + faqMatches.length} result{sectionMatches.length + faqMatches.length === 1 ? '' : 's'}</span>
            </div>

            {!hasResults && (
              <div className={styles.helpEmptyResults}>
                <p className={styles.emptyStateTitle}>No matching help found</p>
                <p className={styles.emptyStateSub}>Try a broader term like schedule, scores, registration, billing, or exports.</p>
              </div>
            )}

            {sectionMatches.length > 0 && (
              <div className={styles.helpResultGroup}>
                <h3>Topics</h3>
                <div className={styles.helpResultList}>
                  {sectionMatches.map(({ section, id }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className={styles.helpResultButton}
                      onClick={(e) => {
                        e.preventDefault();
                        // Clear search synchronously so the article (with the target) is in the
                        // DOM before we scroll to it.
                        flushSync(() => setQuery(''));
                        window.history.replaceState(null, '', `#${id}`);
                        revealAndScroll(id);
                      }}
                    >
                      <span>{section.subgroup ?? section.group ?? 'Guide'}</span>
                      <strong>{section.heading}</strong>
                      {section.summary && <em>{section.summary}</em>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {faqMatches.length > 0 && (
              <div className={styles.helpResultGroup}>
                <h3>Questions</h3>
                <div className={styles.helpResultList}>
                  {faqMatches.map(faq => (
                    <a
                      key={faq.resolvedId}
                      href={`#${faq.resolvedId}`}
                      className={styles.helpResultButton}
                      onClick={(e) => {
                        e.preventDefault();
                        flushSync(() => setQuery(''));
                        if (faq.sectionId) setActiveSectionId(faq.sectionId);
                        window.history.replaceState(null, '', `#${faq.resolvedId}`);
                        revealAndScroll(faq.resolvedId, { faq: true });
                      }}
                    >
                      <span>{faq.group ?? faq.sectionHeading ?? 'FAQ'}</span>
                      <strong>{faq.question}</strong>
                      {faq.answerText && <em>{faq.answerText}</em>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          /* Single-scroll article */
          <div className={styles.helpScrollBody}>
            {groupedSections.length === 0 ? (
              <div className={styles.helpEmptyResults}>
                <p className={styles.emptyStateTitle}>No help topics available</p>
                <p className={styles.emptyStateSub}>This guide does not have any published topics yet.</p>
              </div>
            ) : (
              groupedSections.map(({ group, subgroups }, gi) => (
                <div key={group} className={styles.helpGroupBlock}>
                  {/* Group heading (h2) */}
                  <h2 className={styles.helpGroupHeading}>{group}</h2>

                  {subgroups.map(({ sub, items }) => (
                    <div key={sub ?? '__flat'}>
                      {/* Sub-group heading */}
                      {sub && (
                        <h3 className={styles.helpSubGroupHeading}>{sub}</h3>
                      )}

                      {items.map(({ section, id }) => (
                        <section
                          key={id}
                          id={id}
                          className={styles.helpTopicBlock}
                          data-help-section="1"
                          data-group-index={gi}
                        >
                          {/* Same renderer the in-context drawer uses (h4 under a
                              sub-group, h3 otherwise) so the two never drift. */}
                          <HelpSectionBlock section={section} sectionId={id} headingLevel={sub ? 4 : 3} />
                        </section>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Page-level FAQs (not tied to a section) */}
            {faqs.length > 0 && (
              <section className={styles.helpGroupBlock} aria-label="General questions">
                <h2 className={styles.helpGroupHeading}>Common Questions</h2>
                <div className={styles.helpFaqList}>
                  {faqs.map((faq, i) => {
                    const resolvedId = faq.id ?? `faq-${i + 1}`;
                    return (
                      <details
                        key={resolvedId}
                        id={resolvedId}
                        className={styles.helpFaqItem}
                      >
                        <summary>
                          <span>{faq.question}</span>
                        </summary>
                        <div className={styles.helpFaqAnswer}>{faq.answer}</div>
                      </details>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
