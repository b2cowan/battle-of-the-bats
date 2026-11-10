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
 * The door a shared sign-up route records, as the form named it (`termsDoor`): one of the doors that route serves, else its own
 * default. A route serves several census doors through one endpoint (the follow nudge posts to sign-up; the registration and
 * both coach invitations post to coach sign-up); anything the form sends outside that list is the default, never a free label.
 */
export const termsDoorFrom = (v: unknown, served: readonly AcceptanceDoor[], fallback: AcceptanceDoor): AcceptanceDoor =>
  served.includes(v as AcceptanceDoor) ? (v as AcceptanceDoor) : fallback;

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
 * The sign-in screen's words (§20 (2), (5a), (5e); Chunk B). Each line with a link is split into parts so the screen renders the
 * links and the test can read the sentence back. "Continue", "Sign out" and "Saving…" are §20's / the house pattern's.
 */
export const SCREEN_WORDS = {
  published: {
    title: 'We’ve published our Terms',
    line: ['FieldLogicHQ now has ', TERMS_TITLE, ' and a ', PRIVACY_TITLE, '. Please read them and tick the box to keep using your account.'],
  },
  updated: {
    title: 'We’ve updated our Terms',
    line: ['We’ve changed our ', TERMS_TITLE, ' since you last agreed to them. Please read them and tick the box to keep using your account.'],
  },
  /** (5a) */
  saveFailed: 'Couldn’t save your agreement. Check your connection and try again.',
  /** (5e) — only on "updated", only for a person who owns a paid plan. The middle part is the link. */
  cancelDoor: ['Don’t agree? You can ', 'cancel your plan', ' instead. It runs to the end of the period you’ve paid for.'],
  continue: 'Continue',
  saving: 'Saving…',
  signOut: 'Sign out',
  signedInAs: 'Signed in as',
} as const;

/**
 * WHERE THE SIGN-IN SCREEN DOES NOT TAKE OVER (Chunk B, owner yes 2026-11-09 — disagreements 1 and 3 with the build prompt).
 *
 * The consumer shell wraps more than the family app: the whole sign-in area (`/auth/*`) and the family join page sit under
 * it too. Every emailed link (an invitation, a password reset, a verification) lands in `/auth/*` SIGNED IN, before the
 * person has a password or has finished — the screen there would say "keep using your account" to someone who has none
 * yet, hide the staff invitation's own box, and stand between a person and their password reset. The family join page has
 * its own third box (§20 (5h)). Each page behind these addresses mounts the screen, so nobody walks past it.
 */
export const CONSUMER_SHELL_DOORS = ['/auth/', '/family/claim/'] as const;

const underPath = (pathname: string, prefix: string): boolean =>
  prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Does the shell render its page instead of the screen? `doors`: the shell's own account doors (the consumer shell passes
 * `CONSUMER_SHELL_DOORS`). `billingHrefs`: the cancel door's destinations (§20 (5e)) — a paid-plan owner on "updated" is let
 * through to their own billing page, where cancelling works without agreeing; only ever non-empty on "updated".
 */
export function screenPassesThrough(
  pathname: string | null | undefined,
  { doors = [], billingHrefs = [] }: { doors?: readonly string[]; billingHrefs?: readonly string[] },
): boolean {
  if (!pathname) return false;
  return doors.some(d => underPath(pathname, d)) || billingHrefs.some(h => underPath(pathname, h));
}

/** The fields every account-door form sends (Chunk B): the tick, and the Terms version the form showed (`LegalLinks.termsVersion`). */
export interface DoorTermsFields {
  acceptTerms?: unknown;
  termsVersion?: unknown;
}

/**
 * An account door's verdict on its body, BEFORE it creates anything: null → go on (the pages are off, or ticked against the
 * current version); `unticked` → (5b); `changed` → (5b)'s twin, the version moved while the page was open.
 */
export function doorTermsVerdict(body: DoorTermsFields | null | undefined, current: string | null): null | 'unticked' | 'changed' {
  if (current === null) return null;
  if (body?.acceptTerms !== true) return 'unticked';
  if (body.termsVersion !== current) return 'changed';
  return null;
}

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
