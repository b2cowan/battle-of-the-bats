/**
 * May this person reactivate this Coaches Portal? THE ONE RULE, asked twice: by the checkout before anything is made in
 * Stripe (`app/api/billing/create-team-checkout`), so nobody pays for a reactivation that will be refused, and again by
 * the webhook after payment (`lib/team-checkout.ts`), which keeps its own check. Every refusal lives here: one added
 * anywhere else would be met only after the money has moved.
 *
 * Keep Premium (`lib/portal-keep-premium.ts`) is answered BEFORE this rule by both callers: that portal is billed by
 * staff, not by its owner, and this rule would refuse it.
 *
 * `not_asked` covers a first purchase or a free-team upgrade (no portal named) and a named portal that is not cancelled:
 * the caller carries on as for a new portal.
 *
 * Pure: the caller passes the three reads, which are only made as far as the answer needs them.
 */
import { FIELDLOGICHQ_CONTACT_EMAIL } from './fieldlogichq-contact';

/** The sentences the coach reads. None says whether money moved: the checkout adds that, the webhook runs after it. */
export const TEAM_REACTIVATION_REFUSALS = {
  reactivation_workspace_not_found: {
    status: 404,
    message: `We couldn’t find that Coaches Portal. Open your portal and choose Reactivate Premium there, or email ${FIELDLOGICHQ_CONTACT_EMAIL}.`,
  },
  invalid_reactivation_workspace: {
    status: 409,
    message: `That isn’t a Premium Coaches Portal, so it can’t be reactivated here. If you expected it to be one, email ${FIELDLOGICHQ_CONTACT_EMAIL}.`,
  },
  // Also what the former owner of a team that moved into a club reads: the move suspends every membership of the old portal.
  reactivation_not_owner: {
    status: 403,
    message: 'Only this portal’s owner can reactivate it. Sign in with the owner’s account, or ask the owner to. If the team has moved into a club, ask the club’s owner.',
  },
  org_billed_reactivation_not_supported: {
    status: 409,
    message: 'This team is billed through a club, so it can’t be reactivated here. Ask the club’s owner.',
  },
  reactivation_not_self_paid: {
    status: 409,
    message: `This Coaches Portal can’t be paid for here. Email ${FIELDLOGICHQ_CONTACT_EMAIL} to have it turned back on.`,
  },
} as const;

export type TeamReactivationRefusalCode = keyof typeof TEAM_REACTIVATION_REFUSALS;

export type TeamReactivationOrg = { id: string; account_kind: string | null; plan_id: string | null; subscription_status: string | null };
export type TeamReactivationPortal = { billing_mode: string | null; subscription_status: string | null };

export type TeamReactivationReads<P extends TeamReactivationPortal> = {
  org(slug: string): Promise<TeamReactivationOrg | null>;
  /** The person's ACTIVE role in that organization, or null. */
  activeRole(orgId: string, userId: string): Promise<string | null>;
  portal(orgId: string): Promise<P | null>;
};

export type TeamReactivationAnswer<P> =
  | { kind: 'not_asked' }
  | { kind: 'reactivate'; portal: P }
  | { kind: 'refused'; code: TeamReactivationRefusalCode; message: string; status: number };

/** Billed by a club. Any other mode that is not the owner's own (`platform_override`) was set up by us. */
const CLUB_BILLED = new Set(['org_team_addon', 'club_included', 'club_extra_team']);

function refused(code: TeamReactivationRefusalCode) {
  return { kind: 'refused' as const, code, ...TEAM_REACTIVATION_REFUSALS[code] };
}

export async function decideTeamReactivation<P extends TeamReactivationPortal>(
  input: { reactivateOrgSlug: string | null; ownerUserId: string },
  reads: TeamReactivationReads<P>,
): Promise<TeamReactivationAnswer<P>> {
  if (!input.reactivateOrgSlug) return { kind: 'not_asked' };

  const org = await reads.org(input.reactivateOrgSlug);
  if (!org) return refused('reactivation_workspace_not_found');
  if (org.account_kind !== 'team_workspace' && org.plan_id !== 'team') return refused('invalid_reactivation_workspace');

  if (await reads.activeRole(org.id, input.ownerUserId) !== 'owner') return refused('reactivation_not_owner');

  const portal = await reads.portal(org.id);
  if (!portal) return refused('reactivation_workspace_not_found');
  // team_direct = the owner's own paid portal, the only kind a checkout can bring back.
  if (portal.billing_mode !== 'team_direct') {
    return refused(CLUB_BILLED.has(portal.billing_mode ?? '') ? 'org_billed_reactivation_not_supported' : 'reactivation_not_self_paid');
  }
  if (portal.subscription_status !== 'canceled' && org.subscription_status !== 'canceled') return { kind: 'not_asked' };

  return { kind: 'reactivate', portal };
}
