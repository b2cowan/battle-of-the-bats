/**
 * The words the legal pages and the links to them show (GST/HST Stage 6 step 6.2). Every string here is `/legal`-owned:
 * they are copied from the Terms draft §20 "Page words" block (items 4a–4f, `docs/agents/legal/drafts/TERMS_OF_SERVICE.md`),
 * never invented by the build. A change of wording is a `/legal` edit to that block first, then one edit here.
 *
 * One constant per title, so a spelling change is one edit (no spelling-gate rule: the owner has not ruled to widen the gate).
 * Dates are written with `formatStoredDate(..., { longMonth: true })` ("November 8, 2026") by the caller — a legal page is a
 * document people print and quote, and the full month cannot be misread.
 */

import type { LegalDocKey } from './legal-documents';

export const TERMS_TITLE = 'Terms of Service';
export const PRIVACY_TITLE = 'Privacy Policy';

export const LEGAL_TITLES: Record<LegalDocKey, string> = { terms: TERMS_TITLE, privacy: PRIVACY_TITLE };

/** (4a) Under the page title on a current version. `dateText` is the long-month date. */
export const LEGAL_EFFECTIVE_PREFIX = 'Effective';
export const legalEffectiveLine = (dateText: string): string => `${LEGAL_EFFECTIVE_PREFIX} ${dateText}`;

/** (4b) Under the page title on a version that is no longer current (replaces 4a). The last words are the link to the current page. */
export const legalEarlierVersionLine = (fromText: string, toText: string): string =>
  `This is an earlier version, in effect from ${fromText} to ${toText}.`;
export const LEGAL_READ_CURRENT = 'Read the current version.';

/** (4c) The draft banner — the dev preview only, above the title, one line. */
export const LEGAL_DRAFT_BANNER_TITLE = 'Draft — not published.';
export const LEGAL_DRAFT_BANNER_BODY = 'The text can change before it goes live.';

/** The label over the contents list that sits beside the text on a wide screen (drawing tab 1). */
export const LEGAL_CONTENTS_LABEL = 'Contents';

/** (4d) A fact still blank in the preview, in place of `[phone]` and `[mailing address]`; the mark keeps the fact's name. */
export const legalToBeFilled = (fact: string): string => `[${fact} — to be filled]`;
/** With no effective date yet, (4a) reads `Effective [date — to be filled]`. */
export const LEGAL_EFFECTIVE_BLANK_FACT = 'date';

/**
 * (4e) Full forms wherever a link has room; the short forms only in the account menu's small line under Sign out, written
 * `Terms · Privacy` (each short link carries its full title as its accessible name — note 1 on item 4).
 * (4f) The account page's two rows use the full titles (`LEGAL_TITLES`): no chooser, no combined label.
 */
export const LEGAL_SHORT_LABELS: Record<LegalDocKey, string> = { terms: 'Terms', privacy: 'Privacy' };
export const LEGAL_SHORT_SEPARATOR = ' · ';
