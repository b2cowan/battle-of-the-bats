/**
 * Acceptance of FieldLogicHQ's Terms of Service — the SERVER half (GST/HST Stage 6 step 6.3, Chunk A; plan
 * `docs/projects/active/GST_HST_STAGE6_TERMS_PLAN.md` §5, rulings R1–R10 of 2026-11-09; build prompt A3).
 *
 *   · `checkAcceptance(user)` / `acceptanceState(user)` — the question every signed-in shell (Chunk B) and every gated
 *     organization/plan route (Chunk C) asks.
 *   · `recordAcceptance(...)` — writes one row of `legal_acceptances` (migration 455), then the mirror.
 *   · `requireAcceptance(user)` — the gated routes' refusal: a 409 `terms_required` the client turns into the window.
 *
 * ⚖ DARK MEANS INVISIBLE. While `legalPagesMode()` is `off` (production until 6.7) `currentVersion('terms')` is null: nothing is
 * read, recorded or refused, and every state is `off`.
 *
 * ⚖ THE TABLE IS THE TRUTH; THE MIRROR IS A CACHE. The accepted Terms version is copied onto the auth user's `app_metadata`
 * (service role only) AFTER the row is written, so the mirror never claims what the table lacks. Every layout already calls
 * `supabase.auth.getUser()`, which returns fresh `app_metadata` from the auth server, so an accepted person costs no query. A
 * mirror that says "not yet" is confirmed against the table, and repaired when the table says accepted.
 *
 * Who never sees any of it: `lib/legal-acceptance-exempt.ts`. The pure rules and the words: `lib/legal-acceptance-rules.ts`.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { currentVersion, oldestAcceptedVersion } from './legal-documents';
import { acceptanceExemption } from './legal-acceptance-exempt';
import {
  ACCEPTANCE_WORDS,
  acceptanceRow,
  doorTermsVerdict,
  type DoorTermsFields,
  TERMS_ACCEPTED_KEY,
  hadEarlierPublishedAcceptance,
  isAccepted,
  mirroredTermsVersion,
  type AcceptanceDoor,
  type AcceptanceState,
} from './legal-acceptance-rules';

/** What the check needs of the signed-in user — `supabase.auth.getUser()`'s user satisfies it. */
export interface AcceptanceUser {
  id: string;
  email?: string | null;
  app_metadata?: unknown;
}

export interface AcceptanceCheck {
  state: AcceptanceState;
  /** True when the person agreed to an earlier PUBLISHED version: "We've updated our Terms" (§20 (2)), the window's (5d) line. */
  hadEarlier: boolean;
}

type Env = Record<string, string | undefined>;

/** The latest Terms version the table holds for this person, or null. A read failure is null (the person is asked again). */
async function latestRecordedTermsVersion(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('legal_acceptances')
    .select('terms_version')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[legal-acceptance] could not read the acceptance record:', error);
    return null;
  }
  return (data?.terms_version as string | undefined) ?? null;
}

/** Copy the accepted version onto `app_metadata`. Never fatal: the table already holds the row, and the next check repairs it. */
async function writeMirror(userId: string, version: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { [TERMS_ACCEPTED_KEY]: version } });
    if (error) console.error('[legal-acceptance] mirror write failed:', error);
  } catch (err) {
    console.error('[legal-acceptance] mirror write failed:', err);
  }
}

/**
 * The person's standing. Order, so an accepted person costs no query:
 *   1. the pages are off → `off`;
 *   2. the mirror says accepted → `accepted` (no query);
 *   3. exempt (staff or demo) → `exempt` (the demo check is pure; staff may read `platform_users`);
 *   4. the table — the truth: accepted → repair the mirror, `accepted`; otherwise `needed`.
 * (The build prompt put "exempt" before the mirror. The outcome is the same — both let the person through — but that order
 * costs a `platform_users` read on every page load for every customer. Staff and demo accounts never tick, so they never carry
 * a mirror and still read `exempt`.)
 */
export async function checkAcceptance(user: AcceptanceUser, env: Env = process.env): Promise<AcceptanceCheck> {
  const oldest = oldestAcceptedVersion('terms', env);
  if (oldest === null) return { state: 'off', hadEarlier: false };
  const mirrored = mirroredTermsVersion(user.app_metadata);
  if (isAccepted(mirrored, oldest)) return { state: 'accepted', hadEarlier: false };
  if (await acceptanceExemption(user)) return { state: 'exempt', hadEarlier: false };
  const latest = await latestRecordedTermsVersion(user.id);
  if (isAccepted(latest, oldest)) {
    if (latest !== mirrored) await writeMirror(user.id, latest!);
    return { state: 'accepted', hadEarlier: false };
  }
  return { state: 'needed', hadEarlier: hadEarlierPublishedAcceptance(latest) };
}

export async function acceptanceState(user: AcceptanceUser, env: Env = process.env): Promise<AcceptanceState> {
  return (await checkAcceptance(user, env)).state;
}

export type RecordAcceptanceResult =
  | { ok: true; recorded: boolean }
  | { ok: false; code: 'terms_changed' | 'save_failed' };

/**
 * Record one tick. Call it AFTER the account exists (an account door) or from the accept route (the sign-in screen, the
 * purchase window).
 *   · the pages are off → records nothing, `{ ok: true, recorded: false }`;
 *   · `shownTermsVersion` is not the current version → `terms_changed` (the payouts rule: terms published while the page was
 *     open are never agreed unread);
 *   · otherwise inserts the row (both versions, the exact sentence), THEN writes the mirror.
 */
export async function recordAcceptance(
  { user, door, shownTermsVersion }: { user: AcceptanceUser; door: AcceptanceDoor; shownTermsVersion: unknown },
  env: Env = process.env,
): Promise<RecordAcceptanceResult> {
  const row = acceptanceRow(user, door, env);
  if (row === null) return { ok: true, recorded: false };
  if (shownTermsVersion !== row.terms_version) return { ok: false, code: 'terms_changed' };
  const { error } = await supabaseAdmin.from('legal_acceptances').insert(row);
  if (error) {
    console.error('[legal-acceptance] could not record the acceptance:', error);
    return { ok: false, code: 'save_failed' };
  }
  await writeMirror(user.id, row.terms_version);
  return { ok: true, recorded: true };
}

/**
 * A dev seed route's account records acceptance (A5) — the in-app twin of `scripts/lib/record-legal-acceptance.mjs`, door
 * `'fixture'`, the version this environment records. An account whose mirror already holds that version adds no second row.
 * Never fails the seed: a failure is logged and the account meets the sign-in screen.
 */
export async function recordFixtureAcceptance(user: AcceptanceUser, env: Env = process.env): Promise<void> {
  const terms = currentVersion('terms', env);
  if (terms === null || mirroredTermsVersion(user.app_metadata) === terms) return;
  const result = await recordAcceptance({ user, door: 'fixture', shownTermsVersion: terms }, env);
  if (!result.ok) console.error(`[legal-acceptance] fixture acceptance not recorded for ${user.email ?? user.id}: ${result.code}`);
}

/**
 * An account door's refusal (Chunk B, the B1 census) — asked BEFORE the door creates anything. Null when the pages are off (the
 * production path, unchanged: the body's fields are never read) or the box was ticked against the current version.
 *   · 400 `terms_unticked` — (5b) "Tick the box…";
 *   · 409 `terms_changed`  — (5b)'s twin, carrying the version now current so the form's next tick sends it.
 */
export function accountDoorRefusal(body: DoorTermsFields | null | undefined, env: Env = process.env): NextResponse | null {
  const current = currentVersion('terms', env);
  const verdict = doorTermsVerdict(body, current);
  if (verdict === null) return null;
  return verdict === 'unticked'
    ? NextResponse.json({ error: ACCEPTANCE_WORDS.refuseUnticked, code: 'terms_unticked' }, { status: 400 })
    : NextResponse.json({ error: ACCEPTANCE_WORDS.refuseChangedPage, code: 'terms_changed', termsVersion: current }, { status: 409 });
}

/**
 * Record an account door's tick AFTER the account exists. Never fails the door: the account is made, and a tick that did not
 * save (a write failure, or the version moving in the instant since `accountDoorRefusal`) means the person meets the sign-in
 * screen at their first signed-in page — the screen is the backstop.
 */
export async function recordDoorAcceptance(
  user: AcceptanceUser, door: AcceptanceDoor, body: DoorTermsFields | null | undefined, env: Env = process.env,
): Promise<void> {
  const result = await recordAcceptance({ user, door, shownTermsVersion: body?.termsVersion }, env);
  if (!result.ok) console.error(`[legal-acceptance] ${door} acceptance not recorded for ${user.email ?? user.id}: ${result.code}`);
}

/**
 * The gated routes' check (Chunk C: organization create, checkout, plan move, next-season choice, card setup) — called at the
 * TOP of the handler, before any branch. `off`, `exempt` and `accepted` pass; `needed` is a 409 `terms_required` carrying the
 * version to show, which the client turns into the window and, once ticked, re-sends the same request.
 */
export async function requireAcceptance(user: AcceptanceUser, env: Env = process.env): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const { state, hadEarlier } = await checkAcceptance(user, env);
  if (state !== 'needed') return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      { error: ACCEPTANCE_WORDS.refuseStopped, code: 'terms_required', termsVersion: currentVersion('terms', env), hadEarlier },
      { status: 409 },
    ),
  };
}
