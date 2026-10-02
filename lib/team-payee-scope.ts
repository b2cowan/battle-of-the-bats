/**
 * WHAT A TEAM SEES OF ITS ORG'S PAYEES — the one rule (Ledger Parity D7, owner 2026-10-02; Business Decisions
 * Log "A club can SHARE payees…"). Pure, so tests/unit/team-payees.test.ts holds it without a database; every
 * team read and write in lib/team-payees.ts goes through it (the SQL twin is `team_payee_merge`, mig 316, which
 * must restate it because a merge is one database step).
 *
 *   'team' — the team's own: `team_id` is this team, or (in a team-workspace org) `team_id IS NULL`, because a
 *            standalone team's org holds only the team's things (the team-move rule, mig 313).
 *   'club' — in a club, a club payee (`team_id IS NULL`) the club SHARED: usable, never renamed, merged or deleted
 *            by the team; "Shared by your club" in the picker.
 *   null   — anything else: another team's payee, or a club payee the club keeps to itself. The team never sees it.
 */
import { hasModuleEntitlement, type EntitlementOrg } from './module-entitlements';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import type { Organization } from './types';

export type PayeeScope = 'team' | 'club';

/** A payee's note, as the payee window edits it (round 3, D9) — a few lines, never a document. One number for
 *  the field's cap and the route's refusal; here because this module is safe to import in the browser. */
export const PAYEE_NOTE_MAX = 1000;

/**
 * Can this org share a payee with its teams? A club that runs Rep Teams — never a standalone team's org,
 * whose payees are all the team's own. The club PATCH refuses on it (`shareRefusal`), and the screens ask it
 * before drawing the Teams column, the share switch and the Payees tool's "choose which the teams can use".
 */
export function clubSharesPayees(org: EntitlementOrg & Pick<Organization, 'accountKind' | 'planId'>): boolean {
  return !isTeamWorkspaceOrg(org) && hasModuleEntitlement(org, 'module_rep_teams');
}

export function teamPayeeScope(
  row: { team_id: string | null; shared_with_teams: boolean },
  teamId: string,
  workspace: boolean,
): PayeeScope | null {
  if (row.team_id === teamId) return 'team';
  if (row.team_id !== null) return null;
  if (workspace) return 'team';
  return row.shared_with_teams ? 'club' : null;
}

/**
 * The same rule as a PostgREST `.or()` filter, so a read fetches only what the team could see: its own rows
 * (`'own'` — the WHERE every team write re-asserts), or its own plus the club's shared ones (`'visible'`).
 */
export function teamPayeeFilter(teamId: string, workspace: boolean, which: 'own' | 'visible'): string {
  if (workspace) return `team_id.is.null,team_id.eq.${teamId}`;
  return which === 'own' ? `team_id.eq.${teamId}` : `team_id.eq.${teamId},and(team_id.is.null,shared_with_teams.is.true)`;
}
