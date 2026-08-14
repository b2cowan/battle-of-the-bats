'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, X, ChevronRight } from 'lucide-react';
import type { HelpFaq, HelpSection, HelpSubtopic } from '@/lib/help-content';
import { resolveSectionId, resolveFaqId, resolveSubtopicId } from '@/lib/help-content';
import {
  buildHelpArticles,
  buildHelpHashIndex,
  findNeighbours,
  resolvePageFaqId,
  type HelpArticle,
} from '@/lib/help-content/articles';
import { HelpAccordionItem } from './HelpSectionBlock';
import { revealAndScroll } from './help-scroll';
import WhatsNewHelpLink from '@/components/whats-new/WhatsNewHelpLink';
import styles from './help.module.css';

/**
 * The full guide, as a set of ARTICLES (owner ruling 2026-08-14).
 *
 * It used to render every topic on one page — 22,131 words in the coaches guide —
 * with a contents list of anchors that scrolled the reader around inside it. Now
 * the contents list is a two-level menu and ONE article fills the reading pane:
 *
 *   - an ANSWER (a sub-topic) is the article. This is the unit a reader wants.
 *   - a TOPIC (a section with sub-topics) opens to its overview + its answers,
 *     which is what a section-level link lands on and the only thing that can
 *     answer "what's in Money?".
 *   - a SECTION with no sub-topics is already one article.
 *
 * ⚠ THE DEEP LINKS ARE THE WHOLE RISK: ~102 anchored links across the product
 * point into this guide, plus nine Money screens that name their own sub-topic.
 * Every one keeps working because the ids did not change — `lib/help-content/
 * articles.ts` maps any of them to the article that shows it (pinned by
 * `tests/unit/help-articles.test.ts`). A hash now SELECTS rather than scrolls.
 *
 * ⚠ The in-context "?" drawer is deliberately untouched: it was already the
 * article view. It still renders whole sections through `HelpSectionBlock`, and
 * both surfaces still render the SAME content ReactNodes — only the chrome
 * around them differs now, which is why the section renderer stayed the
 * drawer's and the article chrome lives here.
 */

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

type IndexedSubtopic = {
  subtopic: HelpSubtopic;
  id: string;
  sectionHeading: string;
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

/** For a scroll target on the contents page. Never an address — see `groupLink`. */
function slugForAnchor(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Stable empty-array default. Guides without page-level FAQs would otherwise get
// a fresh `[]` on every render, churning the indexed-data memos.
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
  // null = the guide's landing page (its contents). Otherwise the open article.
  const [articleId, setArticleId] = useState<string | null>(null);
  // The contents menu opens to the group the reader is in. A reader who opens a
  // different group keeps it open until they move to another article — held as a
  // choice tagged with the article it was made on, so the group follows the
  // reader without an effect that fights their click.
  const [groupChoice, setGroupChoice] = useState<{ at: string | null; group: string | null } | null>(null);
  // The heading of whatever the pane is showing — focus moves here on every
  // client-side navigation, since no route change happens to do it for us.
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The last hash this component acted on, so a repeated hash can't yank a
  // reader who has since scrolled. Kept in step with every navigation, not just
  // the ones that arrive as a hashchange.
  const lastAppliedHashRef = useRef<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const hasSearch = normalizedQuery.length > 0;

  const pathname = usePathname();
  /* ⚠ There is deliberately NO "← All guides" crumb (owner ruling 2026-08-14).
     It never led to a list of guides: it stripped the last path segment, which
     on the admin side reached the help hub but on the coaches portal — a portal
     with exactly ONE guide — landed on the portal itself, walking the reader out
     of the guide and into a second copy of the app in a tab opened purely for
     reading. Leaving the app is not this surface's job in either case: every
     guide's own navigation is the menu beside it, and the admin sidebar carries
     its own Help entry that falls back to the hub. The trail here goes UP within
     the guide (guide → topic → answer) and no further. */

  const indexedSections = useMemo<IndexedSection[]>(() => (
    sections.map((section, index) => ({ section, id: resolveSectionId(section, index), index }))
  ), [sections]);

  const articles = useMemo(() => buildHelpArticles(sections), [sections]);
  // Page-level questions are passed too: they live on the landing page, and
  // their ids were addressable before the article model — they must stay so.
  const hashIndex = useMemo(() => buildHelpHashIndex(sections, faqs), [sections, faqs]);

  const article = useMemo(
    () => (articleId ? articles.find(candidate => candidate.id === articleId) ?? null : null),
    [articles, articleId],
  );
  const sectionOf = useMemo(
    () => (article ? indexedSections.find(item => item.id === article.sectionId) ?? null : null),
    [article, indexedSections],
  );

  /* ── Landing on an article ───────────────────────────────────────────────
     One door for every route in: the contents menu, a search result, a
     breadcrumb, Previous/Next, and a deep link from anywhere in the product.

     ⚠ The settle step must NOT hang off a `[articleId]` effect. Two different
     questions in the SAME topic both resolve to that topic's article, so
     `setArticleId` is a no-op for React and an effect keyed on it never re-runs
     — the second question would silently fail to open. Settling is therefore
     driven from the navigation itself, which happens exactly once per move
     whether or not the article changed. */
  const settle = useCallback((faqId?: string, anchor?: string) => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      if (faqId) { revealAndScroll(faqId, { faq: true }); return; }
      // A group crumb lands on the contents page AT its group, rather than at
      // the top of a list the reader has to hunt through again.
      if (anchor) {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ block: 'start', behavior: 'smooth' });
          el.focus({ preventScroll: true });
          return;
        }
      }
      window.scrollTo({ top: 0 });
      // A client-side article swap is a navigation with no route change, so
      // nothing moves focus on its own: a keyboard or screen-reader user would
      // be left on the link they just used while the whole page changed under
      // them. Moving focus to the new title announces the article and puts the
      // next Tab at the top of it.
      titleRef.current?.focus({ preventScroll: true });
    });
  }, []);

  /** Show an article (or the landing page, when `id` is null), optionally
   *  opening one of its questions. Every way into the guide goes through here. */
  const open = useCallback((id: string | null, opts?: { faqId?: string; anchor?: string }) => {
    const faqId = opts?.faqId;
    // Clear search synchronously so the target is in the DOM before any scroll.
    flushSync(() => {
      setQuery('');
      setArticleId(id);
    });
    // replaceState, never push — Back should leave the guide, not replay every
    // article the reader opened (the same contract the old anchor links used).
    // The address names the question when there is one, so the URL a reader
    // copies out of the bar reopens exactly what they were looking at.
    const hash = faqId ?? id;
    window.history.replaceState(
      null, '',
      hash ? `#${hash}` : window.location.pathname + window.location.search,
    );
    // Keep the deep-link guard honest: it exists to stop a repeated hash from
    // yanking a scrolling reader back, and if it still named an article we have
    // since navigated away from, a later genuine hashchange to that address
    // would be swallowed and the page would look frozen.
    lastAppliedHashRef.current = hash;
    settle(faqId, opts?.anchor);
  }, [settle]);

  const openContents = useCallback(() => open(null), [open]);

  /* ── Deep links: a hash now SELECTS an article ───────────────────────────
     Runs on mount and on real hashchange (back/forward, or a link to the page
     the reader is already on). */
  useEffect(() => {
    function applyHash() {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      // No hash means the guide's contents — including when Back lands the
      // reader on the address they arrived at, which must not leave the last
      // article on screen.
      if (!hash) {
        lastAppliedHashRef.current = null;
        setArticleId(null);
        return;
      }
      if (hash === lastAppliedHashRef.current) return;

      const target = hashIndex.get(hash);
      if (!target) return;
      lastAppliedHashRef.current = hash;
      setQuery('');
      setArticleId(target.articleId ?? null);
      settle(target.faqId);
    }

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [hashIndex, settle]);

  /* ── Which contents group is open ────────────────────────────────────────
     Default: the group the reader's article is in. On the landing page there is
     no such group, so every group is revealed. A reader's own toggle overrides
     both until they move to another article.
     ⚠ "no group open" and "every group open" are different states and must not
     share a sentinel — reusing `null` for both made collapsing the open group
     reveal the entire tree, the exact opposite of the click's intent. */
  const groupOverride = groupChoice && groupChoice.at === (article?.id ?? null) ? groupChoice : null;
  const openGroup = groupOverride ? groupOverride.group : article?.group ?? null;
  const everyGroupOpen = !groupOverride && !article;

  /* ── Search ─────────────────────────────────────────────────────────────── */
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
      resolvedId: resolvePageFaqId(faq, faqIndex),
    }));

    return [...sectionFaqs, ...pageFaqs];
  }, [faqs, indexedSections]);

  const indexedSubtopics = useMemo<IndexedSubtopic[]>(() => (
    indexedSections.flatMap(({ section, id }) => (
      (section.subtopics ?? []).map((subtopic, i) => ({
        subtopic,
        id: resolveSubtopicId(id, subtopic, i),
        sectionHeading: section.heading,
      }))
    ))
  ), [indexedSections]);

  const faqMatches = useMemo(() => (
    indexedFaqs.filter(faq => matchesQuery(searchable([
      faq.question, faq.answerText, faq.group, faq.sectionHeading, faq.keywords,
    ]), normalizedQuery))
  ), [indexedFaqs, normalizedQuery]);

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
        // Sub-topic titles are searchable; their bodies (like all rendered
        // content) are not — terms still belong in keywords/searchText.
        section.subtopics?.map(subtopic => subtopic.title),
      ]), normalizedQuery);
      const hasFaqMatch = faqMatches.some(faq => faq.sectionId === id);
      return sectionMatch || hasFaqMatch;
    });
  }, [faqMatches, indexedSections, normalizedQuery]);

  // Answers are addressable pages now, so a matching answer is its own result
  // rather than a reason to hand the reader the whole topic.
  const subtopicMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return indexedSubtopics.filter(({ subtopic, sectionHeading }) => (
      matchesQuery(searchable([subtopic.title, sectionHeading]), normalizedQuery)
    ));
  }, [indexedSubtopics, normalizedQuery]);

  const resultCount = sectionMatches.length + subtopicMatches.length + faqMatches.length;
  const hasResults = resultCount > 0;

  /* ── The contents tree: group → topic → answers ─────────────────────────── */
  const groups = useMemo(() => {
    const byGroup = new Map<string, Map<string | null, IndexedSection[]>>();
    indexedSections.forEach(item => {
      const group = item.section.group ?? 'Guide';
      const subgroup = item.section.subgroup ?? null;
      if (!byGroup.has(group)) byGroup.set(group, new Map());
      const bySubgroup = byGroup.get(group)!;
      if (!bySubgroup.has(subgroup)) bySubgroup.set(subgroup, []);
      bySubgroup.get(subgroup)!.push(item);
    });
    return [...byGroup.entries()].map(([group, bySubgroup]) => ({
      group,
      subgroups: [...bySubgroup.entries()].map(([subgroup, items]) => ({ subgroup, items })),
      items: [...bySubgroup.values()].flat(),
    }));
  }, [indexedSections]);

  const answersOfSection = useCallback((sectionId: string): HelpArticle[] => (
    articles.filter(candidate => candidate.kind === 'answer' && candidate.sectionId === sectionId)
  ), [articles]);

  const { previous, next } = useMemo(
    () => (article ? findNeighbours(articles, article.id) : {}),
    [article, articles],
  );

  /** Props for an in-guide link. `id` null = the landing page (where the
   *  page-level questions live), so a question with no owning section still has
   *  a real destination rather than an article id that names nothing. */
  const hashLink = (id: string | null, opts?: { faqId?: string }) => ({
    href: `#${opts?.faqId ?? id ?? ''}`,
    onClick: (event: React.MouseEvent) => {
      event.preventDefault();
      open(id, opts);
    },
  });

  /* The contents page, landed on AT a group (or sub-group) heading. Groups have
     no page of their own, but they ARE a level of the menu, so the trail has to
     lead somewhere real rather than reading as dead text. The anchor never
     enters the address — it is a place on the contents page, not a thing to
     link people to — so it cannot collide with the article ids that ~102
     product links depend on. */
  const groupSlug = (group: string, subgroup?: string | null) => (
    `helpgroup-${slugForAnchor(subgroup ? `${group}-${subgroup}` : group)}`
  );

  const groupLink = (group: string, subgroup?: string | null) => ({
    href: pathname ?? '#',
    onClick: (event: React.MouseEvent) => {
      event.preventDefault();
      open(null, { anchor: groupSlug(group, subgroup) });
    },
  });

  return (
    <div className={styles.helpPage}>

      {/* ── Contents: a column on desktop, a screen on a phone ──────────────── */}
      <aside className={styles.helpSidePanel} aria-label="Help navigation">
        <nav className={styles.helpTocSticky} aria-label="Guide contents">
          <div>
            <div className={styles.helpSideWhatsNew}>
              <WhatsNewHelpLink />
            </div>

            <div className={styles.helpSearchPanel}>
              <div className={styles.helpSearchRow}>
                <div className={styles.helpSearchBox}>
                  <Search size={15} className={styles.helpSearchIcon} />
                  <input
                    id="help-search"
                    type="search"
                    value={query}
                    onChange={event => {
                      setQuery(event.target.value);
                    }}
                    placeholder={searchPlaceholder ?? 'Search this guide'}
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
              </div>
              {hasSearch && (
                <p className={styles.helpSearchMeta}>
                  {hasResults ? `${resultCount} result${resultCount === 1 ? '' : 's'}` : 'No results — try a broader term.'}
                </p>
              )}
            </div>
          </div>

          <div className={styles.helpTocGroups}>
            <a
              className={`${styles.helpTocHome} ${article ? '' : styles.helpTocHomeActive}`}
              href={pathname ?? '#'}
              onClick={event => { event.preventDefault(); openContents(); }}
            >
              {title} — all topics
            </a>

            {groups.map(({ group, subgroups }) => {
              // The menu is the old table of contents, so `hideFromContents`
              // still applies HERE — and only here. (The landing page is the
              // successor of the top of the old scrolling body, where a hidden
              // section did show, so it lists them.)
              const visible = subgroups
                .map(({ subgroup, items }) => ({ subgroup, items: items.filter(it => !it.section.hideFromContents) }))
                .filter(sub => sub.items.length > 0);
              if (visible.length === 0) return null;
              const count = visible.reduce((n, sub) => n + sub.items.length, 0);
              const isOpen = everyGroupOpen || openGroup === group;
              return (
                <div
                  key={group}
                  className={`${styles.helpTocGroup} ${isOpen ? '' : styles.helpTocGroupCollapsed}`}
                >
                  <button
                    type="button"
                    className={styles.helpTocGroupHead}
                    onClick={() => setGroupChoice({
                      at: article?.id ?? null,
                      group: openGroup === group ? null : group,
                    })}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.helpTocGroupCaret} aria-hidden="true">▼</span>
                    <span>{group}</span>
                    <span className={styles.helpTocGroupCount}>{count}</span>
                  </button>

                  <div className={styles.helpTocChildren}>
                    {visible.map(({ subgroup, items }) => (
                    <div key={subgroup ?? '__flat'}>
                    {subgroup && <p className={styles.helpTocSubLabel}>{subgroup}</p>}
                    {items.map(({ section, id }) => {
                      const answers = answersOfSection(id);
                      const isCurrentSection = article?.sectionId === id;
                      const isCurrentArticle = article?.id === id;
                      return (
                        <div key={id}>
                          <a
                            {...hashLink(id)}
                            aria-current={isCurrentArticle ? 'page' : undefined}
                            // The row both navigates AND reveals its answers, so
                            // say so — the group header beside it already does.
                            aria-expanded={answers.length > 0 ? isCurrentSection : undefined}
                            className={`${styles.helpTocLink} ${answers.length > 0 ? styles.helpTocLinkParent : ''} ${isCurrentArticle ? styles.helpTocLinkActive : ''} ${isCurrentSection && answers.length > 0 ? styles.helpTocLinkOpen : ''}`}
                          >
                            {answers.length > 0 && (
                              <span className={styles.helpTocCaret} aria-hidden="true">
                                {isCurrentSection ? '▾' : '▸'}
                              </span>
                            )}
                            <span>{section.heading}</span>
                          </a>

                          {/* Only the open topic reveals its answers — otherwise the
                              coaches guide's rail would be ~150 rows long. */}
                          {isCurrentSection && answers.length > 0 && (
                            <div className={styles.helpTocAnswers}>
                              {answers.map(answer => (
                                <a
                                  key={answer.id}
                                  {...hashLink(answer.id)}
                                  aria-current={article?.id === answer.id ? 'page' : undefined}
                                  className={`${styles.helpTocAnswer} ${article?.id === answer.id ? styles.helpTocAnswerActive : ''}`}
                                >
                                  {answer.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>
      </aside>

      {/* ── The reading pane ────────────────────────────────────────────────── */}
      <main className={styles.helpMain}>

        {hasSearch ? (
          <section className={styles.helpSearchResults} aria-label="Search results">
            {/* h1, not h2: with one article per page, results are a view of
                their own and would otherwise be the only screen in the guide
                with no top-level heading. */}
            <div className={styles.helpResultHeader}>
              <h1>Search Results</h1>
              <span>{resultCount} result{resultCount === 1 ? '' : 's'}</span>
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
                    <a key={id} {...hashLink(id)} className={styles.helpResultButton}>
                      <span>{section.subgroup ?? section.group ?? 'Guide'}</span>
                      <strong>{section.heading}</strong>
                      {section.summary && <em>{section.summary}</em>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {subtopicMatches.length > 0 && (
              <div className={styles.helpResultGroup}>
                <h3>Answers</h3>
                <div className={styles.helpResultList}>
                  {subtopicMatches.map(({ subtopic, id, sectionHeading }) => (
                    <a key={id} {...hashLink(id)} className={styles.helpResultButton}>
                      <span>{sectionHeading}</span>
                      <strong>{subtopic.title}</strong>
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
                      {...hashLink(faq.sectionId ?? null, { faqId: faq.resolvedId })}
                      className={styles.helpResultButton}
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

        ) : article && sectionOf ? (
          /* ── One article ──────────────────────────────────────────────── */
          <article className={styles.helpArticle}>
            <button
              type="button"
              className={styles.helpMobileBack}
              onClick={() => {
                if (article.kind === 'answer') open(article.sectionId);
                else openContents();
              }}
            >
              ← {article.kind === 'answer' ? article.sectionHeading : 'Contents'}
            </button>

            {/* The trail mirrors the menu, level for level: guide → group →
                sub-group (where a guide uses them) → topic → the article you
                are on. Showing only two of those made the article look like it
                sat directly under the guide. */}
            <nav className={styles.helpBreadcrumb} aria-label="Breadcrumb">
              <a href={pathname ?? '#'} onClick={event => { event.preventDefault(); openContents(); }}>{title}</a>

              <span className={styles.helpBreadcrumbSep} aria-hidden="true">/</span>
              <a {...groupLink(article.group)}>{article.group}</a>

              {article.subgroup && (
                <>
                  <span className={styles.helpBreadcrumbSep} aria-hidden="true">/</span>
                  <a {...groupLink(article.group, article.subgroup)}>{article.subgroup}</a>
                </>
              )}

              {article.kind === 'answer' && (
                <>
                  <span className={styles.helpBreadcrumbSep} aria-hidden="true">/</span>
                  <a {...hashLink(article.sectionId)}>{article.sectionHeading}</a>
                </>
              )}

              <span className={styles.helpBreadcrumbSep} aria-hidden="true">/</span>
              <span className={styles.helpBreadcrumbCurrent} aria-current="page">{article.title}</span>
            </nav>

            <h1 ref={titleRef} tabIndex={-1} className={styles.helpArticleTitle}>{article.title}</h1>

            {article.kind === 'answer' ? (
              <>
                <p className={styles.helpArticleMeta}>
                  {`${article.positionInTopic} of ${article.topicSize} in `}
                  <a {...hashLink(article.sectionId)}>{article.sectionHeading}</a>
                </p>
                <div className={styles.helpSectionContent}>
                  {sectionOf.section.subtopics?.[(article.positionInTopic ?? 1) - 1]?.content}
                </div>
              </>
            ) : (
              <>
                {sectionOf.section.summary && (
                  <p className={styles.helpTopicSummary}>{sectionOf.section.summary}</p>
                )}

                {sectionOf.section.links && sectionOf.section.links.length > 0 && (
                  <div className={styles.helpSectionLinks}>
                    {sectionOf.section.links.map(link => (
                      <Link key={link.href} href={link.href} className={styles.helpSectionLink}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                <div className={styles.helpSectionContent}>{sectionOf.section.content}</div>

                {article.kind === 'topic' && (
                  <div className={styles.helpAnswerIndex}>
                    <h2 className={styles.helpAnswerIndexHead}>
                      <span>In this topic</span>
                      <span>{`${answersOfSection(article.sectionId).length} answers`}</span>
                    </h2>
                    {answersOfSection(article.sectionId).map(answer => (
                      <a key={answer.id} {...hashLink(answer.id)} className={styles.helpAnswerCard}>
                        <span>{answer.title}</span>
                        <ChevronRight size={16} aria-hidden />
                      </a>
                    ))}
                  </div>
                )}

                {(sectionOf.section.faqs ?? []).length > 0 && (
                  <div className={styles.helpFaqList}>
                    {(sectionOf.section.faqs ?? []).map((faq, i) => {
                      const id = resolveFaqId(sectionOf.id, faq, i);
                      return (
                        <HelpAccordionItem key={id} id={id} title={faq.question} bodyClassName={styles.helpFaqAnswer}>
                          {faq.answer}
                        </HelpAccordionItem>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {(previous || next) && (
              <nav className={styles.helpPager} aria-label="More in this guide">
                {previous ? (
                  <a {...hashLink(previous.article.id)} className={styles.helpPagerLink}>
                    <small>{previous.sameTopic ? 'Previous in this topic' : 'Previous topic'}</small>
                    <strong>← {previous.article.title}</strong>
                  </a>
                ) : <span />}
                {next && (
                  <a {...hashLink(next.article.id)} className={`${styles.helpPagerLink} ${styles.helpPagerNext}`}>
                    <small>{next.sameTopic ? 'Next in this topic' : 'Next topic'}</small>
                    <strong>{next.article.title} →</strong>
                  </a>
                )}
              </nav>
            )}
          </article>

        ) : (
          /* ── The landing page: what's in this guide ────────────────────── */
          <div>
            {/* No crumb on the contents page: with the hub link gone it would
                have held only the guide's own name, directly above the h1 that
                already says it. */}
            <h1 ref={titleRef} tabIndex={-1} className={styles.helpPageTitle}>{title}</h1>
            <p className={styles.helpRoleLine}>For: {role}</p>
            <p className={styles.helpIntro}>{intro}</p>

            {groups.length === 0 ? (
              <div className={styles.helpEmptyResults}>
                <p className={styles.emptyStateTitle}>No help topics available</p>
                <p className={styles.emptyStateSub}>This guide does not have any published topics yet.</p>
              </div>
            ) : (
              groups.map(({ group, subgroups }) => (
                <div key={group} className={styles.helpLandingGroup}>
                  {/* tabIndex so the group crumb can put focus here, not just
                      scroll — a keyboard reader lands where they aimed. */}
                  <h2 id={groupSlug(group)} tabIndex={-1} className={styles.helpGroupHeading}>{group}</h2>
                  {subgroups.map(({ subgroup, items }) => (
                    <div key={subgroup ?? '__flat'}>
                      {subgroup && (
                        <h3 id={groupSlug(group, subgroup)} tabIndex={-1} className={styles.helpSubGroupHeading}>
                          {subgroup}
                        </h3>
                      )}
                      <div className={styles.helpLandingCards}>
                        {/* Every topic, including any marked `hideFromContents`:
                            that flag keeps a section out of the MENU, and the
                            single-scroll guide still showed it in the body. This
                            page is that body's successor, so hiding it here too
                            would strand it — the tournaments guide's own
                            "workflow at a glance" was reachable by search alone. */}
                        {items.map(({ section, id }) => {
                          const answers = answersOfSection(id);
                          return (
                            <a key={id} {...hashLink(id)} className={styles.helpLandingCard}>
                              <strong>{section.heading}</strong>
                              {section.summary && <em>{section.summary}</em>}
                              {answers.length > 0 && (
                                <span className={styles.helpLandingCount}>{answers.length} answers</span>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}

            {faqs.length > 0 && (
              <div className={styles.helpLandingGroup}>
                <h2 className={styles.helpGroupHeading}>Common Questions</h2>
                <div className={styles.helpFaqList}>
                  {faqs.map((faq, i) => {
                    const id = resolvePageFaqId(faq, i);
                    return (
                      <HelpAccordionItem key={id} id={id} title={faq.question} bodyClassName={styles.helpFaqAnswer}>
                        {faq.answer}
                      </HelpAccordionItem>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
