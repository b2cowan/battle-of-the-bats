import { isClubPlan } from './module-entitlements';
import { isTeamWorkspaceOrg } from './team-workspace-kind';

/**
 * A COACH'S PORTAL BECOMING THE CLUB — THE DECISIONS THE TWO ENTRY ROUTES SHARE (Plan & billing Stage 4b, Part 2).
 *
 * Two ways in, one result (`flipWorkspaceIntoClub`, lib/workspace-flip.ts): a PAYING Premium coach is moved onto Club on the
 * subscription they already have (POST /api/billing/move), and a coach with no subscription (free days, or one that ended) buys
 * Club at an ordinary checkout on the SAME workspace (POST /api/billing/create-checkout). Both must carry the club name the coach
 * typed, and both are refused without one — the screen requires it (ruling 3), so the server never quietly keeps
 * "{team} Coaches Portal".
 *
 * PURE ON PURPOSE (no database, no Stripe): a client screen reads the limits and the return marker from here, and the unit
 * tests drive every decision with plain objects. The database read for "has it happened yet" is lib/workspace-upgrade-status.ts.
 */

/** The name field's length (plan §3.3). `organizations.name` has no database length rule, so this is the only one. */
export const CLUB_NAME_MAX = 40;

/**
 * Where the name travels when the flip cannot run in the same request: on the Stripe SESSION and on the SUBSCRIPTION itself, so the
 * webhook (and any retry of it, which has no request body) reads it back. One key, both places.
 */
export const CLUB_NAME_METADATA_KEY = 'clubName';
/** Marks a Stripe checkout or move as "this Coaches Portal becomes the club in place" (value `'1'`). */
export const IN_PLACE_METADATA_KEY = 'inPlaceClub';
/** The return address's marker. The "Setting up your club" screen reads it; the page keeps its other flags (`success`). */
export const IN_PLACE_RETURN_PARAM = 'inPlace';
export const IN_PLACE_RETURN_VALUE = 'club';

export type ClubNameCheck =
  | { ok: true; name: string }
  | { ok: false; code: 'club_name_required' | 'club_name_too_long'; error: string };

/** Trims, collapses inner runs of white space, and refuses an empty or over-long name. */
export function parseClubName(value: unknown): ClubNameCheck {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!name) return { ok: false, code: 'club_name_required', error: 'Enter a name for your club.' };
  if (Array.from(name).length > CLUB_NAME_MAX) {
    return { ok: false, code: 'club_name_too_long', error: `Keep the club name to ${CLUB_NAME_MAX} characters or fewer.` };
  }
  return { ok: true, name };
}

/**
 * The name a Stripe record carries, or null. A value that fails the rule is dropped rather than refused: the webhook has nobody
 * to answer, and the flip keeps today's name when it is given none.
 */
export function clubNameFromMetadata(metadata: Record<string, string> | null | undefined): string | null {
  const parsed = parseClubName(metadata?.[CLUB_NAME_METADATA_KEY]);
  return parsed.ok ? parsed.name : null;
}

export type InPlaceUpgrade =
  | { kind: 'not_in_place' }
  | { kind: 'in_place'; clubName: string }
  | ({ kind: 'refused' } & Omit<Extract<ClubNameCheck, { ok: false }>, 'ok'>);

/**
 * Is buying this plan, from this organization, a Coaches Portal becoming the club? It is when the buyer is a standalone portal and
 * the plan is a Club band. Anything else (a club buying a band, a tournament organization buying Plus) is an ordinary checkout and
 * is not asked for a name.
 */
export function inPlaceUpgradeOf(
  org: { accountKind?: string | null; planId?: string | null },
  planKey: string,
  rawClubName: unknown,
): InPlaceUpgrade {
  if (!isTeamWorkspaceOrg(org) || !isClubPlan(planKey)) return { kind: 'not_in_place' };
  const name = parseClubName(rawClubName);
  return name.ok ? { kind: 'in_place', clubName: name.name } : { kind: 'refused', code: name.code, error: name.error };
}

/** The metadata an in-place Club checkout puts on the session and on the subscription (the same object, both places). */
export function inPlaceMetadata(base: Record<string, string>, clubName: string): Record<string, string> {
  return { ...base, [IN_PLACE_METADATA_KEY]: '1', [CLUB_NAME_METADATA_KEY]: clubName };
}

/**
 * Where the coach lands after paying: the CLUB's Plan & billing address (`/{slug}/admin/org/billing`), with the in-place marker.
 * That page exists on both sides of the flip — until the flip lands it sends the coach on to the portal's own billing page with the
 * query string intact (app/[orgSlug]/admin/org/billing/page.tsx), and afterwards it IS the club's billing page — which a return
 * address built from the portal's own billing page could not do (that address stops existing at the flip).
 */
export function inPlaceReturnPath(orgSlug: string): string {
  return `/${orgSlug}/admin/org/billing?${IN_PLACE_RETURN_PARAM}=${IN_PLACE_RETURN_VALUE}`;
}

/** What the "Setting up your club" screen needs to know, and nothing more. */
export type ClubUpgradeState = {
  /** The workspace is the club now (the flip has run: the tag is off and the workspace row is its tombstone). */
  becameClub: boolean;
  /** Club is paid for on the organization but the subscription is not settled yet, so the flip is waiting (`not_settled`). */
  waitingOnPayment: boolean;
};

/**
 * The state from the two rows. `becameClub` is the flip's own idempotency test (workspace-flip RPC, mig 414): the organization is
 * no longer a workspace AND its workspace row is the tombstone. `waitingOnPayment` mirrors the RPC's gate: a workspace on a Club
 * plan without a settled (active or trialing) subscription.
 */
export function clubUpgradeStateOf(
  org: { account_kind: string | null; plan_id: string | null; subscription_status: string | null; stripe_subscription_id: string | null },
  workspace: { workspace_state: string | null; billing_mode: string | null } | null,
): ClubUpgradeState {
  const becameClub = org.account_kind === 'organization'
    && workspace?.workspace_state === 'org_owned'
    && workspace.billing_mode === 'club_included';
  const settled = !!org.stripe_subscription_id && ['active', 'trialing'].includes(org.subscription_status ?? '');
  const waitingOnPayment = !becameClub
    && workspace !== null
    && org.account_kind === 'team_workspace'
    && isClubPlan(org.plan_id)
    && !settled;
  return { becameClub, waitingOnPayment };
}
