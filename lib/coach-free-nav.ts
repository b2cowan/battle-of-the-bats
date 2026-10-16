import {
  COACHES_NOTIFICATIONS_PATH,
  COACHES_TEAM_PATH,
  COACHES_TOURNAMENTS_PATH,
} from './coaches-portal-routes';
import { COACH_TEAM_TOOLS, coachTeamToolSub } from './coach-team-tools';

/**
 * Where the free Coaches Portal's navigation points and what it lights — ONE set of rules for the
 * computer's left menu and the phone's team bar (Free coach header parity, the phone step, owner
 * 2026-10-15), so the two can never light different sections on the same page. Pure: no React, no
 * fetch, unit-tested in tests/unit/coach-free-bar-guard.test.ts.
 */

/** The slice of a team's context the navigation reads. */
export type FreeNavTeam = {
  id: string;
  activatedFeatures: readonly string[];
  registrationIds: readonly string[];
};

const TEAM_RE = /^\/coaches\/team\/([^/]+)/;
const RECORD_RE = /^\/coaches\/tournaments\/([^/]+)/;

/** The entry a tournament-record page shows (`/coaches/tournaments/{regId}`), or null. */
export function freeRecordId(pathname: string): string | null {
  return pathname.match(RECORD_RE)?.[1] ?? null;
}

/** Does the ADDRESS name a team — a team page, or a team's tournament record? */
export function pathNamesFreeTeam(pathname: string): boolean {
  return TEAM_RE.test(pathname) || RECORD_RE.test(pathname);
}

/**
 * The team a page belongs to — the shell's header and left menu show it:
 *   /coaches/team/{id}[/section]  → that team;
 *   /coaches/tournaments/{regId}  → the team whose entries include regId;
 *   anywhere else                 → nobody's, UNLESS the coach has exactly one team, which then
 *                                   owns every page of the portal.
 */
export function resolveCurrentFreeTeam<T extends FreeNavTeam>(pathname: string, teams: readonly T[]): T | null {
  const teamId = pathname.match(TEAM_RE)?.[1];
  const regId = freeRecordId(pathname);
  let team: T | null = null;
  if (teamId) team = teams.find(t => t.id === teamId) ?? null;
  else if (regId) team = teams.find(t => t.registrationIds.includes(regId)) ?? null;
  if (!team && teams.length === 1) team = teams[0];
  return team;
}

/**
 * The team the PHONE BAR points at, or null for the fan app's bar (owner, 2026-10-15, B3): the team
 * bar shows wherever the page has a team, and on Notifications, which is More's own page — there it
 * points at the team the coach last opened (on this device), else their first. Everywhere else
 * without a team (the portal's front page for a coach with several teams or none, the all-tournaments
 * list reached from it) wears the fan app's bar: Home · Scores · Chat · Account.
 */
export function resolveFreeBarTeam<T extends FreeNavTeam>(
  pathname: string,
  teams: readonly T[],
  rememberedTeamId: string | null,
): T | null {
  const team = resolveCurrentFreeTeam(pathname, teams);
  if (team) return team;
  if (pathname !== COACHES_NOTIFICATIONS_PATH) return null;
  return teams.find(t => t.id === rememberedTeamId) ?? teams[0] ?? null;
}

/**
 * Is a team section the page the coach is on? `sub` is the section's suffix under the team's address
 * ('' for Overview, '/tournaments', '/chat', '/roster', '/explore', …).
 */
export function freeSectionActive(pathname: string, team: FreeNavTeam, sub: string): boolean {
  const base = `${COACHES_TEAM_PATH}/${team.id}`;
  if (sub === '') return pathname === base;
  if (sub === '/tournaments') {
    // Tournaments owns the whole tournament surface (owner call 2026-07-25 — it used to be claimed
    // by Overview, which read as a mis-highlight): the team-scoped list, the account-wide records
    // hub, and a record page for an entry that belongs to THIS team (not just any record — that
    // would wrongly light up for another team's).
    if (pathname.startsWith(`${base}${sub}`)) return true;
    if (pathname === COACHES_TOURNAMENTS_PATH) return true;
    const reg = freeRecordId(pathname);
    return Boolean(reg && team.registrationIds.includes(reg));
  }
  return pathname.startsWith(`${base}${sub}`);
}

/** The team's turned-on tools, in the tools' own order (Roster · Schedule · Fees · Announcements). */
export function freeTeamTools(team: FreeNavTeam) {
  return COACH_TEAM_TOOLS.filter(t => team.activatedFeatures.includes(t.key));
}

/** More is lit on every page it leads to: Notifications, a turned-on tool, and Explore. */
export function freeMoreActive(pathname: string, team: FreeNavTeam): boolean {
  if (pathname === COACHES_NOTIFICATIONS_PATH) return true;
  if (freeSectionActive(pathname, team, '/explore')) return true;
  return freeTeamTools(team).some(t => freeSectionActive(pathname, team, coachTeamToolSub(t.key)));
}
