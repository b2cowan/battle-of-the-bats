/**
 * Acceptance of FieldLogicHQ's Terms of Service — the PURE half (GST/HST Stage 6 step 6.3, Chunk A; plan
 * `docs/projects/active/GST_HST_STAGE6_TERMS_PLAN.md` §5, rulings R1–R10 of 2026-11-09; build prompt
 * `GST_HST_STAGE6_3_BUILD_PROMPT.md` A3). No `server-only`, no database, no env of its own (the row builder takes one, as `currentVersion` does): the unit tests load it, and the forms (Chunk B)
 * render the box from the same parts the server stores.
 *
 * The server half — reading and writing the record, the check every shell and gated route asks — is `lib/legal-acceptance.ts`;
 * who never sees any of it is `lib/legal-acceptance-exempt.ts`.
 *
 * ⚖ The words are `/legal`'s, copied from the Terms draft §20 (`docs/agents/legal/drafts/TERMS_OF_SERVICE.md`), items (1), (2)
 * and (5). A change of wording is a `/legal` edit there first, then one edit here; `tests/unit/legal-acceptance.test.ts` reads
 * the draft and fails when the box sentence drifts from item (1). The draft writes a straight apostrophe; the product sets
 * the typographic one (’), as every other product string does — the test treats the two as the same letter.
 */

import { PRIVACY_TITLE, TERMS_TITLE } from './legal-words.ts'; // .ts: the fixture helper imports this module under plain Node
import { DRAFT_VERSION, currentVersion, isVersionDate } from './legal-documents.ts';

/**
 * Every door that records a tick — one per account door of the B1 census, plus the sign-in screen, the purchase window and the
 * script/dev-seed fixture. The CHECK `legal_acceptances_door_check` (migration 455) lists the same ids; the unit test reads the
 * migration and fails when the two differ.
 */
export const ACCEPTANCE_DOORS = [
  'signup',
  'follow',
  'coach_signup',
  'registration',
  'team_signup',
  'assistant_invite',
  'league_coach_invite',
  'staff_invite',
  'family_accept',
  'sign_in_screen',
  'purchase_window',
  'fixture',
] as const;
export type AcceptanceDoor = (typeof ACCEPTANCE_DOORS)[number];
export const isAcceptanceDoor = (v: unknown): v is AcceptanceDoor =>
  typeof v === 'string' && (ACCEPTANCE_DOORS as readonly string[]).includes(v);

/**
 * §20 (1): the one box, at every door. `terms` and `privacy` are the two link labels (Chunk B renders them as links); the
 * stored sentence is the parts joined, with no link markup.
 */
export const ACCEPTANCE_BOX_PARTS = {
  lead: 'I’m 18 or older (or the age of majority where I live). I agree to the ',
  terms: TERMS_TITLE,
  middle: ' and have read the ',
  privacy: PRIVACY_TITLE,
  end: '.',
} as const;

/** The exact sentence every door stores in `legal_acceptances.box_text` (R1: the age promise is recorded by the sentence). */
export const ACCEPTANCE_BOX_TEXT: string =
  ACCEPTANCE_BOX_PARTS.lead + ACCEPTANCE_BOX_PARTS.terms + ACCEPTANCE_BOX_PARTS.middle + ACCEPTANCE_BOX_PARTS.privacy + ACCEPTANCE_BOX_PARTS.end;

/** The server's own lines (§20 (2), (5b), (5c)) — the ones Chunk A's refusals carry. The screen's and window's words land in B/C. */
export const ACCEPTANCE_WORDS = {
  /** (5b) An account door refused because the box was not ticked. */
  refuseUnticked: 'Tick the box to confirm you’re 18 or older and agree to the Terms of Service.',
  /** (5b) twin: the version moved while a sign-up page was open. */
  refuseChangedPage: 'The terms changed while this page was open. Read them again and tick the box.',
  /** (2) The version moved while the sign-in screen or the purchase window was open. */
  refuseChangedWindow: 'The terms changed while this window was open. Read them again.',
  /** (5c) An organization create or a purchase was stopped and the window could not open. */
  refuseStopped: 'Before you continue, you need to agree to our current Terms of Service. Reload this page to see them.',
} as const;

/**
 * The mirror of the accepted Terms version on the auth user's `app_metadata` (service role only — the Founding Season start-door
 * lock is the precedent). A cache that can only ever say "not yet": the table is the truth.
 */
export const TERMS_ACCEPTED_KEY = 'legal_terms_accepted';

/** One row of `legal_acceptances` (migration 455). No IP address and no device, by design (R1). */
export interface AcceptanceRow {
  user_id: string;
  user_email: string;
  terms_version: string;
  privacy_version: string;
  box_text: string;
  door: AcceptanceDoor;
}

/**
 * The row every writer inserts — the app's own doors (`recordAcceptance`), the script fixtures and the UAT fixtures
 * (`scripts/lib/record-legal-acceptance.mjs`) — stamped with the versions THIS environment shows. Null when the pages are
 * off: nothing is recorded. Pure apart from reading `env`, so plain Node, Playwright and Next all build the same row.
 */
export function acceptanceRow(
  user: { id: string; email?: string | null },
  door: AcceptanceDoor,
  env: Record<string, string | undefined> = process.env,
): AcceptanceRow | null {
  const terms = currentVersion('terms', env);
  if (terms === null) return null;
  return {
    user_id: user.id,
    user_email: user.email?.trim() || 'unknown',
    terms_version: terms,
    privacy_version: currentVersion('privacy', env) ?? terms,
    box_text: ACCEPTANCE_BOX_TEXT,
    door,
  };
}

/** The version the mirror holds, or null. */
export function mirroredTermsVersion(appMetadata: unknown): string | null {
  const value = (appMetadata as Record<string, unknown> | null | undefined)?.[TERMS_ACCEPTED_KEY];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Does a recorded Terms version satisfy the oldest version still treated as accepted?
 *   · `oldest === null` → null: NOT APPLICABLE (the pages are off) — the caller does nothing.
 *   · both `'draft'` → accepted (the dev preview).
 *   · both dates and `recorded >= oldest` → accepted.
 *   · anything else → not accepted. A `'draft'` never satisfies a date, and a date never satisfies `'draft'`.
 */
export function isAccepted(recorded: string | null | undefined, oldest: string | null): boolean | null {
  if (oldest === null) return null;
  if (!recorded) return false;
  if (oldest === DRAFT_VERSION) return recorded === DRAFT_VERSION;
  if (!isVersionDate(oldest) || !isVersionDate(recorded)) return false;
  return recorded >= oldest; // YYYY-MM-DD compares as text
}

/**
 * A person's acceptance standing, as a shell or a gated route reads it.
 *   · `off`      — the legal pages are off: nothing renders, records or refuses.
 *   · `exempt`   — FieldLogicHQ staff or a demo account (`lib/legal-acceptance-exempt.ts`).
 *   · `accepted` — the latest tick satisfies the oldest accepted version.
 *   · `needed`   — the sign-in screen, or the window over a stopped purchase.
 */
export type AcceptanceState = 'off' | 'exempt' | 'accepted' | 'needed';

/**
 * Has the person agreed to an EARLIER published version? Picks "We've updated our Terms" over "We've published our Terms" (§20
 * (2)), the window's first line (5d), and whether the cancel door shows (5e). A `'draft'` row is not an earlier published
 * version, so a dev account at 6.7 reads "published", as a production account will.
 */
export const hadEarlierPublishedAcceptance = (latestRecorded: string | null): boolean =>
  latestRecorded !== null && isVersionDate(latestRecorded);
