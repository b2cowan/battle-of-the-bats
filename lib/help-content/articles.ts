import type { HelpSection } from './index';
import { resolveSectionId, resolveFaqId, resolveSubtopicId } from './index';

/**
 * The article model (owner ruling 2026-08-14): a guide is not one long page, it
 * is a set of ARTICLES, and **the lowest level is the article**.
 *
 *   - `answer`  — one sub-topic, rendered alone. The unit a reader actually wants.
 *   - `topic`   — a section that HAS sub-topics: its overview plus a list of its
 *                 answers. This is what a section-level link lands on, and the
 *                 only thing that can answer "what's in Money?".
 *   - `section` — a section with no sub-topics: already one article (about half
 *                 the coaches guide).
 *
 * Everything here is pure so it can be unit-tested without a DOM: the guide
 * layout is a client component, but which article a hash names is the part that
 * must never drift, because ~102 links across the product point into it.
 */

export type HelpArticleKind = 'topic' | 'section' | 'answer';

export interface HelpArticle {
  /** The address. Identical to the anchor id the single-scroll guide used, which
   *  is why no existing help link has to be rewritten. */
  id: string;
  kind: HelpArticleKind;
  /** The article's own H1. */
  title: string;
  /** The section this article belongs to (its own id when kind !== 'answer'). */
  sectionId: string;
  sectionHeading: string;
  /** Position of the owning section in the guide, for grouping the contents tree. */
  sectionIndex: number;
  /** For an answer: its 1-based place within its topic ("5 / 11"). */
  positionInTopic?: number;
  topicSize?: number;
  group: string;
  subgroup?: string;
  /** Sections hidden from the contents list still render and are still addressable. */
  hideFromContents: boolean;
}

/** Every article in the guide, in reading order: a section, then its answers. */
export function buildHelpArticles(sections: HelpSection[]): HelpArticle[] {
  const articles: HelpArticle[] = [];

  sections.forEach((section, sectionIndex) => {
    const sectionId = resolveSectionId(section, sectionIndex);
    const subtopics = section.subtopics ?? [];
    const shared = {
      sectionId,
      sectionHeading: section.heading,
      sectionIndex,
      group: section.group ?? 'Guide',
      subgroup: section.subgroup,
      hideFromContents: section.hideFromContents === true,
    };

    articles.push({
      ...shared,
      id: sectionId,
      kind: subtopics.length > 0 ? 'topic' : 'section',
      title: section.heading,
    });

    subtopics.forEach((subtopic, i) => {
      articles.push({
        ...shared,
        id: resolveSubtopicId(sectionId, subtopic, i),
        kind: 'answer',
        title: subtopic.title,
        positionInTopic: i + 1,
        topicSize: subtopics.length,
      });
    });
  });

  return articles;
}

export interface HelpHashTarget {
  /** The article to open. Absent means the guide's landing page — where the
   *  page-level questions live. */
  articleId?: string;
  /** Set when the hash named a FAQ: open and scroll to it once the article renders. */
  faqId?: string;
}

/**
 * Every hash the guide can be addressed by, mapped to the article that shows it.
 *
 * Four families, and all of them keep the ids they already had:
 *   - a section id       → its topic page (or its article, when it has no sub-topics)
 *   - a sub-topic id     → that answer, which is now a page of its own
 *   - a section FAQ id   → the owning section's article, with the question opened
 *   - a page-level FAQ id → the landing page, with the question opened
 *
 * A FAQ belongs to its section, so under the article model it renders on the
 * topic page rather than beside an answer — otherwise a section-level question
 * would have to be duplicated onto all eleven of its answers.
 *
 * ⚠ FIRST WRITE WINS. Ids are authored by hand and only namespaced when they are
 * generated, so nothing structurally prevents a later FAQ from being given an id
 * an earlier section already uses. The single-scroll guide resolved a hash by
 * scanning a list front-to-back, so the earliest declaration won; a Map would
 * silently hand the address to the LAST one instead — quietly re-pointing a
 * published support link. Keeping first-write-wins means a collision can only
 * ever make the newcomer unreachable, never move an existing link.
 * `tests/unit/help-articles.test.ts` also asserts the guides declare no
 * duplicate ids at all, so a collision fails the build rather than degrading.
 */
export function buildHelpHashIndex(
  sections: HelpSection[],
  pageFaqs: Array<{ id?: string }> = [],
): Map<string, HelpHashTarget> {
  const index = new Map<string, HelpHashTarget>();
  const claim = (id: string, target: HelpHashTarget) => {
    if (!index.has(id)) index.set(id, target);
  };

  sections.forEach((section, sectionIndex) => {
    const sectionId = resolveSectionId(section, sectionIndex);
    claim(sectionId, { articleId: sectionId });

    (section.subtopics ?? []).forEach((subtopic, i) => {
      const id = resolveSubtopicId(sectionId, subtopic, i);
      claim(id, { articleId: id });
    });

    (section.faqs ?? []).forEach((faq, i) => {
      const id = resolveFaqId(sectionId, faq, i);
      claim(id, { articleId: sectionId, faqId: id });
    });
  });

  // Page-level questions sit on the landing page, so their hash names no article.
  pageFaqs.forEach((faq, i) => {
    const id = resolvePageFaqId(faq, i);
    claim(id, { faqId: id });
  });

  return index;
}

/** Page-level FAQs (not attached to a section) live on the guide's landing page. */
export function resolvePageFaqId(faq: { id?: string }, index: number): string {
  return faq.id ?? `faq-${index + 1}`;
}


export interface HelpArticleNeighbour {
  article: HelpArticle;
  /** True when it sits in the same topic — the label reads "in this topic". */
  sameTopic: boolean;
}

/**
 * The article before and after this one, in reading order. Stepping off the end
 * of a topic rolls on to the next topic rather than dead-ending, so a reader can
 * go through a whole guide with Next and never return to the menu.
 */
export function findNeighbours(
  articles: HelpArticle[],
  articleId: string,
): { previous?: HelpArticleNeighbour; next?: HelpArticleNeighbour } {
  const at = articles.findIndex(article => article.id === articleId);
  if (at < 0) return {};

  const current = articles[at];
  const wrap = (article: HelpArticle | undefined): HelpArticleNeighbour | undefined => (
    article ? { article, sameTopic: article.sectionId === current.sectionId } : undefined
  );

  return { previous: wrap(articles[at - 1]), next: wrap(articles[at + 1]) };
}

/** The answers inside a topic, in order (empty for a section with none). */
export function answersOf(articles: HelpArticle[], sectionId: string): HelpArticle[] {
  return articles.filter(article => article.kind === 'answer' && article.sectionId === sectionId);
}
