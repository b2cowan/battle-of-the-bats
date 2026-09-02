import type { ReactNode } from 'react';

export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpFaq {
  id?: string;
  question: string;
  answer: ReactNode;
  answerText?: string;
  group?: string;
  keywords?: string[];
  popular?: boolean;
}

/** One titled sub-answer inside a long section (scannable-format standard, 2026-08-14).
 *  The full guide renders these as anchored sub-headings with a jump-chip row; the
 *  in-context drawer renders them as tappable expanders. Sub-topic bodies are NOT
 *  searched (same contract as section content) — searchable terms still belong in the
 *  section's keywords/searchText; titles DO join the section's search haystack. */
export interface HelpSubtopic {
  /** Stable deep-link anchor. Prefer an explicit short id (`<sectionId>-<slug>`) so
   *  support links survive a title reword; falls back to a title slug. */
  id?: string;
  title: string;
  content: ReactNode;
}

export interface HelpSection {
  id?: string;
  group?: string;
  /** Optional second grouping level rendered as a sub-heading under the group.
   *  Sections without a subgroup render flat under their parent group.
   *  Guides that use no groups at all are unaffected. */
  subgroup?: string;
  heading: string;
  summary?: string;
  keywords?: string[];
  searchText?: string;
  links?: HelpLink[];
  faqs?: HelpFaq[];
  hideFromContents?: boolean;
  /** The section body. When `subtopics` is present this is the short overview
   *  rendered above them (1–2 sentences of orientation, not the answers). */
  content: ReactNode;
  /** Long sections (>~6 paragraphs) must break into sub-topics — see the format
   *  standard in `.claude/commands/docs.md`. Sections without them are untouched. */
  subtopics?: HelpSubtopic[];
}

export interface HelpPageContent {
  title: string;
  role: string;
  intro: string;
  searchPlaceholder?: string;
  sections: HelpSection[];
  faqs?: HelpFaq[];
}

/* ⚰ `HelpCalloutContent` ({ variant, title, body, cta }) stood here and was deleted 2026-09-01
   (cleanup tranche 6) with zero references. ⚠ Not to be confused with the LIVE `HelpCallout` — the
   page-embedded dismissible banner in `components/help/HelpBlocks.tsx`, which types its own props.
   This was a second, unused description of the same idea. */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve a section's stable anchor id. This is the SINGLE source of truth used
 * by both the single-scroll guide layout and the in-context help drawer, so a
 * page's "?" drawer and a deep link into the guide always resolve to the same id.
 */
export function resolveSectionId(section: HelpSection, index: number): string {
  return section.id ?? `${slugify(section.heading) || 'section'}-${index + 1}`;
}

/** Resolve a section-attached FAQ's anchor id (shared by the guide + the drawer). */
export function resolveFaqId(sectionId: string, faq: HelpFaq, faqIndex: number): string {
  return faq.id ?? `${sectionId}-faq-${faqIndex + 1}`;
}

/** Resolve a sub-topic's anchor id (shared by the guide headings, the jump chips,
 *  and deep links). The fallback keeps the title slug so links read as what they
 *  point at, but ALWAYS folds in the index — two sub-topics whose titles slug
 *  identically must never share an anchor (duplicate DOM ids + React keys, and
 *  deep links silently resolving to the first). Prefer an explicit `id`: it is
 *  both shorter and immune to reordering. */
export function resolveSubtopicId(sectionId: string, subtopic: HelpSubtopic, index: number): string {
  return subtopic.id ?? `${sectionId}-t-${slugify(subtopic.title) || 'topic'}-${index + 1}`;
}
