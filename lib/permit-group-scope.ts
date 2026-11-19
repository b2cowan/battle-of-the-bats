// server-only — touches supabaseAdmin.
//
// ⚖ A MEMBER LIMITED TO SOME TEAM GROUPS, AND THE CLUB'S PERMITS (Board Ready trust close-out 10, owner 2026-11-18; leftover
// calls 1 + 2, owner 2026-11-19). ONE place for both rules, so the permit routes and the document route can't drift:
//
//   CHANGING a permit (add, edit, renew, delete, replace its file): only one held for a team in their groups. A permit held
//   for the whole club, the rep program or the league (no team) is OUTSIDE their groups — on the stored permit AND on the
//   draft, so a switch from their team to the whole club is refused too.
//   OPENING a permit's file: their groups' teams' permits and the whole club's (no team) permits. Outside them the window
//   says only "File attached" (trust call 9's words) and the file route refuses. The permits LIST stays whole (owner ruling).
//
// A member the limit doesn't narrow (owner, admin, treasurer, or no group rows) passes both. A team that isn't the club's
// is not counted here: the database floor refuses it in its own words (`permit_team`).

import { supabaseAdmin } from './supabase-admin';
import { isUuid } from './utils';

type Scoped = { repGroupIds: string[] | null };

/** The club's teams among these that sit outside the member's groups; null when the member isn't limited. */
async function teamsOutside(ctx: Scoped, orgId: string, teamIds: string[]): Promise<Set<string> | null> {
  if (!ctx.repGroupIds) return null;
  const ids = [...new Set(teamIds.filter(t => isUuid(t)))];
  if (!ids.length) return new Set();
  const { data, error } = await supabaseAdmin.from('rep_teams').select('id, group_id').eq('org_id', orgId).in('id', ids);
  if (error) throw error;
  const groups = ctx.repGroupIds;
  // An ungrouped team is outside every limit (the scope guard's rule).
  return new Set(((data ?? []) as { id: string; group_id: string | null }[])
    .filter(t => !t.group_id || !groups.includes(t.group_id)).map(t => t.id));
}

/** May this member CHANGE a permit held for these teams (the stored permit's and the draft's)? A null team = the club's. */
export async function permitChangeOutsideGroups(ctx: Scoped, orgId: string, heldForTeamIds: (string | null | undefined)[]): Promise<boolean> {
  if (!ctx.repGroupIds) return false;
  if (heldForTeamIds.some(t => !t)) return true;
  const outside = await teamsOutside(ctx, orgId, heldForTeamIds as string[]);
  return !!outside && outside.size > 0;
}

/** May this member OPEN the file of a permit held for this team? The whole club's (no team) permits open. */
export async function permitFileOutsideGroups(ctx: Scoped, orgId: string, heldForTeamId: string | null | undefined): Promise<boolean> {
  if (!ctx.repGroupIds || !heldForTeamId) return false;
  const outside = await teamsOutside(ctx, orgId, [heldForTeamId]);
  return !!outside && outside.has(heldForTeamId);
}

/** The refusal's words, one sentence for every door that changes a permit. */
export const PERMIT_OUTSIDE_GROUPS_WORDS =
  'That permit isn’t held for a team in your team groups. Ask your club’s owner or an admin to change it.';
