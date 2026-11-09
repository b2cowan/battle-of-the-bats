/**
 * The registry of FieldLogicHQ's own legal documents (GST/HST Stage 6 step 6.2, rulings Q1 and Q2).
 *
 * Until step 6.7 the drafts (`docs/agents/legal/drafts/TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`) are the words' one home; the
 * dev preview reads the draft file itself (`lib/legal-draft-preview.ts`). At 6.7 the approved text is written ONCE as that
 * date's frozen version file `lib/legal-documents/<doc>/<YYYY-MM-DD>.md` (customer text only), the draft is deleted, and the
 * entry below gains `{ version, sha256 }`. A published version is FROZEN by the build: its sha256 is the hash of the file's text
 * with line endings normalized to LF, and an edit fails `tests/unit/legal-documents.test.ts`.
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
 *
 * No `server-only` import so the unit tests can load it; it reads no file itself.
 */

import { legalPagesMode } from './legal-pages-switch';

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
  /** The draft file, repo-relative — the preview reads it until 6.7. */
  draftPath: string;
  /** Every published version (empty until 6.7). */
  published: PublishedVersion[];
  /** The version in force; null until 6.7. */
  current: string | null;
  /** The oldest version still treated as accepted; null until 6.7. */
  oldestAccepted: string | null;
}

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDocument> = {
  terms: { draftPath: 'docs/agents/legal/drafts/TERMS_OF_SERVICE.md', published: [], current: null, oldestAccepted: null },
  privacy: { draftPath: 'docs/agents/legal/drafts/PRIVACY_POLICY.md', published: [], current: null, oldestAccepted: null },
};

const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isVersionDate = (v: string): boolean => VERSION_RE.test(v);

/** Where a published version's frozen text lives (repo-relative). */
export const publishedFilePath = (doc: LegalDocKey, version: string): string => `lib/legal-documents/${doc}/${version}.md`;

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

export const isPublishedVersion = (doc: LegalDocKey, version: string): boolean =>
  LEGAL_DOCUMENTS[doc].published.some(p => p.version === version);

/** Published versions, newest first. */
export const publishedVersions = (doc: LegalDocKey): string[] =>
  LEGAL_DOCUMENTS[doc].published.map(p => p.version).sort().reverse();

function dayBefore(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * The span a version was in force, for the earlier-version line. `from` is its effective date; `to` is the LAST DAY it applied
 * (the day before the next version's effective date, so no day shows two versions) — null for the newest version.
 */
export function versionSpan(doc: LegalDocKey, version: string): { from: string; to: string | null } | null {
  const all = publishedVersions(doc); // newest first
  const i = all.indexOf(version);
  if (i < 0) return null;
  return { from: version, to: i === 0 ? null : dayBefore(all[i - 1]) };
}
