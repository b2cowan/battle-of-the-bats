/**
 * A legal document's numbered sections, for the contents list and the "§N" links (GST/HST Stage 6 step 6.2, drawings tab 9, Ask 1).
 * Pure, so the unit tests run it. A section is a level-2 heading written `## 18. Changes to these Terms`; its anchor is `section-18`.
 */

import type { LegalPageKey } from './legal-documents';
import { PRIVACY_TITLE, TERMS_TITLE } from './legal-words';

export interface LegalSection {
  n: number;
  /** The heading without its number. */
  title: string;
}

export const sectionAnchor = (n: number): string => `section-${n}`;

/** The numbered `##` headings, in order. */
export function legalSections(markdown: string): LegalSection[] {
  return [...markdown.matchAll(/^## (\d+)\.\s+(.+?)\s*$/gm)].map(m => ({ n: Number(m[1]), title: m[2] }));
}

/** A heading's anchor when it has no number: lowercase words joined by dashes. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

/**
 * Turns each "§N" that names one of THIS document's sections into a link to it. A reference to the other document ("Privacy Policy
 * §6 and §7", "The Privacy Policy (§5)") is left as plain text: its number means a section of a page we are not on. The test is the
 * words just before it, back to the last sentence break. Headings are not touched.
 */
export function linkSectionReferences(markdown: string, sections: LegalSection[], otherTitles: readonly (string | RegExp)[] = []): string {
  const have = new Set(sections.map(s => s.n));
  return markdown.replace(/§(\d+)/g, (whole, digits: string, offset: number) => {
    const n = Number(digits);
    if (!have.has(n)) return whole;
    const lineStart = markdown.lastIndexOf('\n', offset - 1) + 1;
    if (markdown.startsWith('#', lineStart)) return whole; // a heading is not rewritten
    // The words just before it, across a hard-wrapped line, back to the last sentence break.
    const before = markdown.slice(Math.max(0, offset - 40), offset).replace(/\s+/g, ' ');
    const sinceBreak = before.slice(Math.max(before.lastIndexOf('. '), before.lastIndexOf('; ')) + 1);
    if (otherTitles.some(t => (typeof t === 'string' ? sinceBreak.includes(t) : t.test(sinceBreak)))) return whole;
    return `[§${n}](#${sectionAnchor(n)})`;
  });
}

/**
 * The other documents a page's text names by section ("Privacy Policy §6", "our Data Terms (§6)", "our Payments Terms (§1)"): a "§N"
 * after one of these stays plain text, because its number is a section of a page we are not on. The Data Terms name the Terms by the
 * bare word ("Terms §4") and their own sections bare or as "these Data Terms (§6)", so their rule is "Terms" NOT preceded by "Data ".
 * The list has no numbered sections, so nothing on it links. Pinned against the drafts by `tests/unit/legal-data-terms-and-list.test.ts`.
 */
const DATA_TERMS_WORDS = 'Data Terms';
const PAYMENTS_TERMS_WORDS = 'Payments Terms';
export const LEGAL_OTHER_TITLES: Record<LegalPageKey, readonly (string | RegExp)[]> = {
  terms: [PRIVACY_TITLE, DATA_TERMS_WORDS, PAYMENTS_TERMS_WORDS],
  privacy: [TERMS_TITLE, DATA_TERMS_WORDS, PAYMENTS_TERMS_WORDS],
  'data-terms': [/(?<!Data )Terms\b/, PRIVACY_TITLE],
  subprocessors: [],
};

