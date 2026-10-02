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
export type PayeeScope = 'team' | 'club';

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
