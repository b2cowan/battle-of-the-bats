import { planCarriesModule, type EntitlementOrg } from './module-entitlements';
import { isTeamWorkspaceOrg } from './team-workspace-entitlements';
import type { Organization } from './types';

/**
 * DOES THIS ORGANIZATION'S PLAN CARRY THE COACHES PORTAL? (B05, Club Tier Stage 1)
 *
 * A club's own teams get the Premium Coaches Portal because the club's plan carries Rep Teams
 * (Club / Club · Association, or a Rep Teams add-on). Before this check existed the portal never
 * asked: its pages and routes gated on "signed in, not cancelled, holds an assignment", so a Club
 * that moved down to League Plus or Tournament Plus kept every team's full portal while the
 * downgrade screen told the owner it "shuts down".
 *
 * A Coaches Portal WORKSPACE (a standalone coach's own portal, plan `team`) answers yes here: its
 * access runs through its own subscription and per-team entitlements, decided elsewhere.
 *
 * The PLAN question, not the access one: a cancelled club is walled by the billing rail first
 * (SubscriptionEndedWall), so this never has to say "cancelled" — and must not, or a cancelled club
 * would read as "your plan doesn't include it", which names the wrong remedy.
 *
 * Pure: the portal layout decides it before any portal screen mounts. It cannot fail open — there
 * is no read to fail — and an org whose plan key is unknown carries nothing, so it is walled.
 */
export function orgPlanCarriesCoachesPortal(
  org: EntitlementOrg & Pick<Organization, 'accountKind'>,
): boolean {
  if (isTeamWorkspaceOrg(org)) return true;
  return planCarriesModule(org, 'module_rep_teams');
}
