/**
 * A legal document's numbered sections, for the contents list and the "§N" links (GST/HST Stage 6 step 6.2, drawings tab 9, Ask 1).
 * Pure, so the unit tests run it. A section is a level-2 heading written `## 18. Changes to these Terms`; its anchor is `section-18`.
 */

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
export function linkSectionReferences(markdown: string, sections: LegalSection[], otherTitle?: string): string {
  const have = new Set(sections.map(s => s.n));
  return markdown.replace(/§(\d+)/g, (whole, digits: string, offset: number) => {
    const n = Number(digits);
    if (!have.has(n)) return whole;
    const lineStart = markdown.lastIndexOf('\n', offset - 1) + 1;
    if (markdown.startsWith('#', lineStart)) return whole; // a heading is not rewritten
    // The words just before it, across a hard-wrapped line, back to the last sentence break.
    const before = markdown.slice(Math.max(0, offset - 40), offset).replace(/\s+/g, ' ');
    const sinceBreak = before.slice(Math.max(before.lastIndexOf('. '), before.lastIndexOf('; ')) + 1);
    if (otherTitle && sinceBreak.includes(otherTitle)) return whole;
    return `[§${n}](#${sectionAnchor(n)})`;
  });
}
