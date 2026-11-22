/**
 * The registry of FieldLogicHQ's own legal documents (GST/HST Stage 6 step 6.2, rulings Q1 and Q2).
 *
 * Until step 6.7 the drafts (`docs/agents/legal/drafts/TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`) are the words' one home; the
 * dev preview reads the draft file itself (`lib/legal-draft-preview.ts`). At 6.7 the approved text is written ONCE as that
 * date's frozen version file `lib/legal-documents/<doc>/<YYYY-MM-DD>.md` (customer text only), the draft is deleted, and the
 * entry below gains `{ version, sha256 }`. A published version is FROZEN by the build: its sha256 is the hash of the file's text
 * with line endings normalized to LF, and an edit fails `tests/unit/legal-documents.test.ts`.
 *
 * ── 6.7, written 2026-11-17 ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   Both documents' owner-approved 0.3 text is frozen as `2026-11-17` (the draft filter's output, so the words are the approved
 *   ones minus every owner note) and the drafts are deleted. ⚠ The version is named for the day it takes effect, and the owner
 *   ruled (2026-11-17) that it is the RELEASE DAY. If the promote that carries `LEGAL_PAGES_PUBLISHED = true` to production is
 *   not on 2026-11-17, rename BOTH files to the promote day and change the six date strings below in the same commit, before
 *   promoting. The text, so the sha256, does not change. After production serves a version, never rename it again.
 *
 * ── How 6.3 (acceptance at every door) uses the two values — build it there, NOT here ──────────────────────────────────────
 *   · `currentVersion(doc)` is what a door records when someone accepts: the dated `current` when published, `'draft'` in the
 *     preview, `null` when the pages are off (record nothing, show no tick box line).
 *   · A recorded version counts as accepted when it is a date `>= oldestAcceptedVersion(doc)`. The string `'draft'` NEVER
 *     satisfies a dated `oldestAccepted`, so nothing accepted on a dev preview ever counts as accepted on production.
 *   · `current` moves on every change; `oldestAccepted` moves only for a significant one (Terms §18), which brings the
 *     accept-again screen back.
 *
 * ── Deferred, written as a comment only ────────────────────────────────────────────────────────────────────────────────────
 *   · A significant change needs 30 days' notice (Terms §18), so the new version must be readable BEFORE it is current: an
 *     `upcoming` field, added at the first significant change — not now.
 *   · The payments terms (backlog L3) will add a third key, `'payments'`. No entry until it is written.
 *   · The Data Terms and the list of companies are NOT keys here — see `LegalPageKey` below.
 *
 * No `server-only` import so the unit tests can load it; it reads no file itself.
 */

import { legalPagesMode } from './legal-pages-switch.ts'; // .ts: scripts import this module under plain Node

export type LegalDocKey = 'terms' | 'privacy';
export const LEGAL_DOC_KEYS: readonly LegalDocKey[] = ['terms', 'privacy'];

/** What `currentVersion` returns in the dev preview. */
export const DRAFT_VERSION = 'draft';

export interface PublishedVersion {
  /** The effective date, `YYYY-MM-DD`. */
  version: string;
  /** sha256 (hex) of the version file's text with CRLF normalized to LF. */
  sha256: string;
}

export interface LegalDocument {
  /** The draft file, repo-relative, while a version is being written — the dev preview reads it. null when there is no draft
   *  (since 6.7, 2026-11-17: the approved text is the frozen version file and the draft was deleted). A later change writes a new
   *  draft in `docs/agents/legal/drafts/` and sets this again. */
  draftPath: string | null;
  /** Every published version. */
  published: PublishedVersion[];
  /** The version in force. */
  current: string | null;
  /** The oldest version still treated as accepted. */
  oldestAccepted: string | null;
}

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDocument> = {
  terms: {
    draftPath: null,
    published: [{ version: '2026-11-22', sha256: 'b5f8e3d6428cc4709908b4bb199c95ea4ee47df993300589dfc29a5cca877eba' }],
    current: '2026-11-22',
    oldestAccepted: '2026-11-22',
  },
  privacy: {
    // Stripe-owned pricing Stage 5 (2026-11-18): the next version (the retired fee invoice cut, the Payments Terms record
    // named). Read only in preview mode, which a published pair never enters; set here so the filter test checks its shape.
    draftPath: 'docs/agents/legal/drafts/PRIVACY_POLICY.md',
    published: [{ version: '2026-11-22', sha256: 'abdaa491af8b11109ac2471e9db9106c5ab361d50c125948b42519bd86800552' }],
    current: '2026-11-22',
    oldestAccepted: '2026-11-22',
  },
};

/*
 * ── The two pages a person READS but never accepts (Board Ready 0a-5, built 2026-11-19) ──────────────────────────────────────
 *   Kept OUT of `LegalDocKey` on purpose: that key is the doors' acceptance contract (each entry carries `current` and
 *   `oldestAccepted`, and the registry test requires both once the pages are published). Neither page is ticked anywhere, and the
 *   acceptance record keeps exactly two versions (`tests/unit/legal-data-terms-and-list.test.ts` asserts it).
 *
 *   · DATA TERMS for organizations (`docs/agents/legal/DATA_TERMS_ACCEPTANCE_NOTE.md`): PART OF the Terms, so a version exists
 *     only at a Terms version date, and that Terms file must name and link it (T1). One frozen file per carrying Terms version,
 *     `lib/legal-documents/data-terms/<terms-date>.md`; the page in force is the newest one at or before the Terms `current`
 *     (a Terms version that leaves the Data Terms alone writes no new file).
 *   · THE LIST of the companies that handle your information: a LIVING page that changes without a Terms version. Each change is
 *     a new frozen copy, `lib/legal-documents/subprocessors/<date>.md`, that adds exactly one row, dated that day ("November 19,
 *     2026"), to its "Changes to this list" table and changes no earlier row. The newest copy is the page; the older copies are
 *     the record of what the list said on each date (no route serves them). A copy whose companies the Privacy Policy in force
 *     does not name fails the build.
 *   · Both lists are EMPTY until the Payments Terms day: both pages answer "not found" and no link to them renders.
 *   · A frozen text starts at its first section: the page draws the title, so the file carries no title heading of its own.
 */
export type LegalPageKey = LegalDocKey | 'data-terms' | 'subprocessors';

export const DATA_TERMS_VERSIONS: PublishedVersion[] = [];
export const SUBPROCESSOR_LIST_VERSIONS: PublishedVersion[] = [];

/** Is this one of the two documents a door records (rather than a page that is only read)? */
export const isDoorDocument = (page: LegalPageKey): page is LegalDocKey => (LEGAL_DOC_KEYS as readonly string[]).includes(page);

const versionsOf = (page: LegalPageKey): PublishedVersion[] =>
  page === 'data-terms' ? DATA_TERMS_VERSIONS : page === 'subprocessors' ? SUBPROCESSOR_LIST_VERSIONS : LEGAL_DOCUMENTS[page].published;

const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isVersionDate = (v: string): boolean => VERSION_RE.test(v);

/** Where a published version's frozen text lives (repo-relative). */
export const publishedFilePath = (doc: LegalPageKey, version: string): string => `lib/legal-documents/${doc}/${version}.md`;

type Env = Record<string, string | undefined>;

/** The version a door records: the dated `current` when published, `'draft'` in the preview, null when the pages are off. */
export function currentVersion(doc: LegalDocKey, env: Env = process.env): string | null {
  const mode = legalPagesMode(env);
  if (mode === 'preview') return DRAFT_VERSION;
  if (mode === 'published') return LEGAL_DOCUMENTS[doc].current;
  return null;
}

/** Same rule as `currentVersion`, for the oldest version still treated as accepted. */
export function oldestAcceptedVersion(doc: LegalDocKey, env: Env = process.env): string | null {
  const mode = legalPagesMode(env);
  if (mode === 'preview') return DRAFT_VERSION;
  if (mode === 'published') return LEGAL_DOCUMENTS[doc].oldestAccepted;
  return null;
}

export const isPublishedVersion = (doc: LegalPageKey, version: string): boolean =>
  versionsOf(doc).some(p => p.version === version);

/** Published versions, newest first. */
export const publishedVersions = (doc: LegalPageKey): string[] =>
  versionsOf(doc).map(p => p.version).sort().reverse();

/**
 * The version a page shows at its plain address, or null when it has no text yet. A door document: its `current`. The Data Terms:
 * the newest version at or before the Terms' `current`. The list: its newest copy.
 */
export function pageVersionInForce(page: LegalPageKey): string | null {
  if (isDoorDocument(page)) return LEGAL_DOCUMENTS[page].current;
  const newestFirst = publishedVersions(page);
  if (page === 'subprocessors') return newestFirst[0] ?? null;
  const termsCurrent = LEGAL_DOCUMENTS.terms.current;
  return termsCurrent === null ? null : newestFirst.find(v => v <= termsCurrent) ?? null;
}

/**
 * Does this page answer at its address (and may a link to it render)? The door documents follow the switch alone (the dev preview
 * shows their drafts); the two read-only pages also need a published text, and have no preview.
 */
export function legalPageLive(page: LegalPageKey, env: Env = process.env): boolean {
  const mode = legalPagesMode(env);
  if (mode === 'off') return false;
  if (isDoorDocument(page)) return true;
  return mode === 'published' && pageVersionInForce(page) !== null;
}

function dayBefore(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * The span a version was in force, for the earlier-version line. `from` is its effective date; `to` is the LAST DAY it applied
 * (the day before the next version's effective date, so no day shows two versions) — null for the newest version.
 */
export function versionSpan(doc: LegalPageKey, version: string): { from: string; to: string | null } | null {
  const all = publishedVersions(doc); // newest first
  const i = all.indexOf(version);
  if (i < 0) return null;
  return { from: version, to: i === 0 ? null : dayBefore(all[i - 1]) };
}
