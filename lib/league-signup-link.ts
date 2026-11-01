import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { payLinkSecret, readLeaguePayToken } from './league-pay-link';
import { SIGNUP_STATUS_COLUMNS, signupRowsFromAnchor, type SignupAnchorRow, type SignupStatusRow } from './league-signup-status';
import { signupLinkClockRanOut } from './house-league-access';
import { loadLeaguePayFacts } from './league-pay-facts';

/**
 * THE ONE DOOR A FAMILY'S "YOUR SIGN-UP" LINK GOES THROUGH (Signed-in family accounts Stage 1 Part 2; rulings
 * 2026-11-01 asks 1, 5, 6). Every place that reads a family token asks THIS — the page, the Stripe checkout, the
 * post-checkout poll and the withdraw request — never `readLeaguePayToken` on its own, so no door can open a link the
 * others refuse (`tests/unit/league-signup-link.test.ts` pins the callers). The rules, in order:
 *
 *   1. `invalid` — the signature fails, or the link names a registration of another club or season. The page draws it
 *      as "This link no longer works" (the family cannot tell a mangled link from a replaced one, and "Email me my link"
 *      is the honest way out).
 *   2. `replaced` — the token's version is not the anchor row's `link_version`: the club sent a new link (mig 419), which
 *      stopped this one for every brother and sister on the sign-up.
 *   3. `finished` — the club marked the season finished more than 30 days ago (the coach page's clock, never restated)
 *      AND the sign-up owes nothing (`signupStillOwes`, which "Email me my link" asks too). A sign-up still owing keeps its
 *      link until it is paid (ask 1). A reopened season (`finished_at` cleared) opens again.
 *   4. `ok` — the sign-up's rows (`signupRowsFromAnchor`, the set every rule here means by "the sign-up").
 *
 * `afterCheckout` (the post-checkout poll only) skips rule 3: a family who paid the last dollar must still see their
 * payment confirmed, and the poll answers a state word for a session that already belongs to this sign-up.
 */
export type SignupLinkEnd = 'invalid' | 'replaced' | 'finished';

export type SignupLink =
  /** `signupKey` is the sign-up's key on its online payments: its reference, or the one registration's id. */
  | { ok: true; registrationId: string; seasonId: string; signupKey: string; rows: SignupStatusRow[] }
  | { ok: false; ended: SignupLinkEnd };

type AnchorRow = SignupAnchorRow & {
  link_version: number | null;
  league_seasons: { status: string; finished_at: string | null } | null;
};

export async function openSignupLink(
  token: string,
  opts: { at?: { orgId: string; seasonId: string }; afterCheckout?: boolean } = {},
): Promise<SignupLink> {
  const secret = payLinkSecret();
  const read = secret ? readLeaguePayToken(token, secret) : null;
  if (!read) return { ok: false, ended: 'invalid' };

  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select(`${SIGNUP_STATUS_COLUMNS}, org_id, season_id, guardian_email, link_version, league_seasons(status, finished_at)`)
    .eq('id', read.registrationId).maybeSingle();
  if (error) throw error;
  const anchor = data as unknown as AnchorRow | null;
  if (!anchor || (opts.at && (anchor.org_id !== opts.at.orgId || anchor.season_id !== opts.at.seasonId))) return { ok: false, ended: 'invalid' };

  if (read.version !== Number(anchor.link_version ?? 0)) return { ok: false, ended: 'replaced' };

  const season = anchor.league_seasons;
  if (!opts.afterCheckout && signupLinkClockRanOut(season) && !(await signupStillOwes(anchor.id, anchor.season_id))) {
    return { ok: false, ended: 'finished' };
  }

  const rows = await signupRowsFromAnchor(anchor);
  if (!rows.length) return { ok: false, ended: 'invalid' };
  return { ok: true, registrationId: anchor.id, seasonId: anchor.season_id, signupKey: anchor.signup_ref ?? anchor.id, rows };
}

/**
 * Anything still owed on the sign-up a registration anchors: a child owing, a bank debit clearing, or a payment open on
 * Stripe. Rule 3's question, and the only place it is answered (the door and "Email me my link" both ask it).
 */
export async function signupStillOwes(registrationId: string, seasonId: string): Promise<boolean> {
  const facts = await loadLeaguePayFacts(registrationId);
  if (!facts) return false;
  if (facts.children.some(c => c.owingCents > 0 || c.clearingCents > 0)) return true;
  const { data: open } = await supabaseAdmin.from('online_payments').select('id')
    .eq('flow', 'league_signup').eq('season_id', seasonId).eq('signup_key', facts.signupKey).eq('status', 'open').limit(1);
  return (open ?? []).length > 0;
}
