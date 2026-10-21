/**
 * lib/club-about.ts — THE CLUB'S ABOUT PAGE (Club Tier Stage 4c-1, Ask 10 widened; words CLUB_TIER_STAGE4C1_COPY.md §J).
 *
 * The about text, Who to contact, Documents and policies under the club's own headings, and Questions families ask.
 * Reached from the home's About card and the footer's one door "Contacts and documents". Pure, tested in
 * tests/unit/club-stage4c1.test.ts. The site carries the club's documents; it never says the club is compliant.
 */
import type { SiteContact, SiteDocument, SiteQuestion } from './types';

type Lists = { contacts?: readonly SiteContact[] | null; documents?: readonly SiteDocument[] | null; questions?: readonly SiteQuestion[] | null };

/** The page has something the home's About card does not already say: a contact, a document or a question. The footer's
 *  door and the About card's row show only then — a door to the same paragraph again is not a door. */
export function clubAboutPageShows(c: Lists | null | undefined): boolean {
  return !!c && ((c.contacts?.length ?? 0) > 0 || (c.documents?.length ?? 0) > 0 || (c.questions?.length ?? 0) > 0);
}

export interface DocumentBand {
  heading: string;
  documents: SiteDocument[];
}

/** Documents under their headings, each heading once, in the order the club first used it; rows keep the club's order. */
export function documentBands(documents: readonly SiteDocument[] | null | undefined): DocumentBand[] {
  const bands: DocumentBand[] = [];
  for (const d of documents ?? []) {
    const key = d.heading.trim().toLowerCase();
    const band = bands.find(b => b.heading.trim().toLowerCase() === key);
    if (band) band.documents.push(d);
    else bands.push({ heading: d.heading.trim(), documents: [d] });
  }
  return bands;
}

/** The headings offered when a document is added (suggestions only; any words are allowed). */
export const DOCUMENT_HEADING_SUGGESTIONS = ['Codes of conduct', 'Safety', 'The club'] as const;
