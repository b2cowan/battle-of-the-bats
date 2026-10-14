/**
 * How a coach's own teams are offered in the register and join pickers. Pure, so it is testable
 * without a database; `labelLivePremiumTeams` in `lib/coach-team-page.ts` feeds it.
 *
 * Under every Premium team sits a free team (its "twin"), and both pickers list free teams. A twin is
 * named once, when it is made, and never follows the portal. On 2026-10-13 a coach whose Premium team
 * is "Milton Bats U13 Purple" was offered it as "Milton Bats U13 White" (last season's free team, which
 * the portal was upgraded from), chose New Team, and got a stray second team his portal could not see
 * (`docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PLAN.md`, F3).
 *
 * So the twin of a LIVE portal is offered under the portal team's CURRENT name, ahead of the coach's
 * free teams, and its id is returned so the picker can tag it "Coaches Portal". Order within each group
 * is the order the teams arrived in.
 *
 * ⚠ ONLY THE TWIN — the free team the portal itself points at. Nothing in the schema stops a second
 * free team carrying the same portal back-link, and renaming both would show two identical rows. A
 * second one is an ordinary free team (own name, no tag), which is also the honest answer: the portal
 * reads its tournaments through its twin, so an entry filed under the other never reaches it. When the
 * portal has no twin recorded yet, the earliest back-linked team is the one the portal adopts
 * (`createWorkspaceShadowBasicCoachTeam`), so that one stands in. A canceled portal is not in the map:
 * its free team is an ordinary free team again.
 */
export type LivePortal = {
  /** The portal team's current name; null when it cannot be read (the twin keeps its own). */
  name: string | null;
  /** The free team the portal points at; null when not yet recorded. */
  twinId: string | null;
};

export function namePremiumTeamsFirst<T extends { id: string; name: string; teamWorkspaceId: string | null }>(
  teams: readonly T[],
  livePortalByWorkspace: ReadonlyMap<string, LivePortal>,
): { teams: T[]; portalTeamIds: string[] } {
  const premium: T[] = [];
  const free: T[] = [];
  const claimed = new Set<string>();
  for (const team of teams) {
    const portal = team.teamWorkspaceId ? livePortalByWorkspace.get(team.teamWorkspaceId) : undefined;
    const isTwin = !!portal && !!team.teamWorkspaceId && !claimed.has(team.teamWorkspaceId)
      && (portal.twinId ? portal.twinId === team.id : true);
    if (!isTwin) {
      free.push(team);
      continue;
    }
    claimed.add(team.teamWorkspaceId as string);
    const portalName = portal.name?.trim();
    premium.push(portalName ? { ...team, name: portalName } : team);
  }
  return { teams: [...premium, ...free], portalTeamIds: premium.map(team => team.id) };
}
