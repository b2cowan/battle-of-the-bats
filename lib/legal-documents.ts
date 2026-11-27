/**
 * The registry of FieldLogicHQ's own legal documents (GST/HST Stage 6 step 6.2, rulings Q1 and Q2).
 *
 * HOW A VERSION IS MADE. A change starts as a draft in `docs/agents/legal/drafts/` (begun from the published file); a Terms or
 * Privacy draft sets `draftPath` so the dev preview reads it (`lib/legal-draft-preview.ts`). Once the owner approves it, the
 * customer text (the draft filter's output: no owner note, no title heading) is written ONCE as that date's frozen file
 * `lib/legal-documents/<doc>/<YYYY-MM-DD>.md`, registered below with its sha256, and the draft is deleted. A published version
 * is FROZEN by the build: its sha256 is the hash of the file's text with line endings normalized to LF, and an edit fails
 * `tests/unit/legal-documents.test.ts`.
 *
 * ⚠ A version is named for the day it takes effect (the promote day, owner 2026-11-17). A file frozen only in the working tree may
 *   still be renamed to the real promote day (same text, same sha256); after production serves a version, never rename it again,
 *   and never reuse a date production already served.
 *
 * Versions so far: 2026-11-22 (the first published Terms and Privacy Policy), 2026-11-23 (the Club release: the Data Terms and the
 * list of companies join, Terms and Privacy follow), 2026-11-24 (the Payments Terms publish; the Terms, Privacy Policy and Data
 * Terms carry the sentences that name them — `docs/agents/legal/PUBLISHED_CLUB_RELEASE_DOCUMENTS_NOTES.md`), 2026-11-28 (the
 * sponsorship version: a business paying a sponsorship by card, in the Payments Terms, the Privacy Policy, the Terms and the Data
 * Terms; same notes file). Each later version was a minor change: `current` moved, `oldestAccepted` stayed 2026-11-22, nobody
 * accepts the Terms or the Privacy Policy again (a connected club is asked to agree to a new Payments Terms version).
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
 *   · The Data Terms, the list of companies and the Payments Terms are NOT keys here — see `LegalPageKey` below.
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
    published: [
      { version: '2026-11-22', sha256: 'b5f8e3d6428cc4709908b4bb199c95ea4ee47df993300589dfc29a5cca877eba' },
      { version: '2026-11-23', sha256: 'e322a101cf5b1b33618858dc68a25e556c8c268e3a3bcd29159a447a4bf46cfe' },
      { version: '2026-11-24', sha256: '179758c92fd25cb48c98fda35b42d4ba029b25f283294bb5d4f7899a58fcb8a6' },
      { version: '2026-11-28', sha256: '05f4bc5c30f310d96a36c428be4fc287c139defcf3a148aadf005b14cf709843' },
    ],
    current: '2026-11-28',
    oldestAccepted: '2026-11-22',
  },
  privacy: {
    draftPath: null,
    published: [
      { version: '2026-11-22', sha256: 'abdaa491af8b11109ac2471e9db9106c5ab361d50c125948b42519bd86800552' },
      { version: '2026-11-23', sha256: '013c2bca8c15ce6f3fb7507449412ee75c41e46e4dbf40e068e74c8abf6b4423' },
      { version: '2026-11-24', sha256: '4799eb1df81bf71c26aad6416161c39b4ef106de800a118da6f045df1457f3d5' },
      { version: '2026-11-28', sha256: '6953b37f794439f3e97f54a030fb83326ef5fa006132c2b7ac63d0669f77b379' },
    ],
    current: '2026-11-28',
    oldestAccepted: '2026-11-22',
  },
};

/*
 * ── The pages the sign-in doors never record (Board Ready 0a-5, built 2026-11-19; the Payments Terms 2026-11-24) ────────────────
 *   Kept OUT of `LegalDocKey` on purpose: that key is the doors' acceptance contract (each entry carries `current` and
 *   `oldestAccepted`, and the registry test requires both once the pages are published). None of these is ticked at a sign-in
 *   door, and the acceptance record keeps exactly two versions (`tests/unit/legal-data-terms-and-list.test.ts` asserts it).
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
 *   · Both lists were EMPTY until the Club release (2026-11-23, the Terms version that names the Data Terms): until a text is
 *     registered, the page answers "not found" and no link to it renders.
 *   · THE PAYMENTS TERMS (`docs/agents/legal/PUBLISHED_CLUB_RELEASE_DOCUMENTS_NOTES.md`): added to the Terms for an organization
 *     that takes payments online, and agreed to by an owner's tick in the Payouts card — that tick has its own record
 *     (`payments_terms_agreements`, mig 497) and its own version constant, `PAYMENTS_TERMS_VERSION` in
 *     `lib/online-payment-words.ts`, which must equal the newest date below (`tests/unit/online-payments-terms.test.ts`). Versions
 *     of their own (Payments Terms §13), one frozen file each, `lib/legal-documents/payments/<date>.md`; the newest is in force,
 *     and each earlier one stays served at its own address (the card's "Read the terms" opens the version that owner agreed to).
 *     ⚠ Every new version asks every connected club to agree again and emails its owners (the daily job), minor or not.
 *   · A frozen text starts at its first section: the page draws the title, so the file carries no title heading of its own.
 */
export type LegalPageKey = LegalDocKey | 'data-terms' | 'subprocessors' | 'payments';

export const DATA_TERMS_VERSIONS: PublishedVersion[] = [
  { version: '2026-11-23', sha256: '23d88e4ae12c751b9513dffb7d31f01953ca3923998afb9f1d096af24e4af358' },
  { version: '2026-11-24', sha256: '6f3ca5d077558a46ee3cf257370bc4c0ec6e4f10794f7aa709af794e92b35c2d' },
  { version: '2026-11-28', sha256: 'b19c83f15ee4cfafe14250164a6be8c994cca3569920a3f81747e0611b42387d' },
];
export const PAYMENTS_TERMS_VERSIONS: PublishedVersion[] = [
  { version: '2026-11-24', sha256: '3fe278cb35e129f806c10a3cfca96fcde3bc87e35612e4cf9f1701cd3d20d951' },
  { version: '2026-11-28', sha256: '6b72288a4147f79214eb34be886fe70a416248a683c4e0e8b1eca36f388bd5b2' },
];
export const SUBPROCESSOR_LIST_VERSIONS: PublishedVersion[] = [
  { version: '2026-11-23', sha256: '45de07d8b2a178bbb17bde58bca2235878490b979be74e116233fc04368078e8' },
];

/** Is this one of the two documents a door records (rather than a page that is only read)? */
export const isDoorDocument = (page: LegalPageKey): page is LegalDocKey => (LEGAL_DOC_KEYS as readonly string[]).includes(page);

const versionsOf = (page: LegalPageKey): PublishedVersion[] =>
  page === 'data-terms' ? DATA_TERMS_VERSIONS
    : page === 'subprocessors' ? SUBPROCESSOR_LIST_VERSIONS
      : page === 'payments' ? PAYMENTS_TERMS_VERSIONS
        : LEGAL_DOCUMENTS[page].published;

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
 * the newest version at or before the Terms' `current`. The list and the Payments Terms: the newest copy.
 */
export function pageVersionInForce(page: LegalPageKey): string | null {
  if (isDoorDocument(page)) return LEGAL_DOCUMENTS[page].current;
  const newestFirst = publishedVersions(page);
  if (page === 'subprocessors' || page === 'payments') return newestFirst[0] ?? null;
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
