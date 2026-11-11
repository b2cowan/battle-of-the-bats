/**
 * lib/coach-team-tile.ts — what the team's tile shows (navigation Phase 4, E10 + C7, owner 2026-11-11). Pure, so the server
 * decides it and the first paint is the last.
 *
 * ⚖ CREST → THE TEAM'S COLOUR → INITIALS. The crest when it has a stored shape within 1 : 2 … 2 : 1 (`logoFitsTile`, the
 * club's and the event's rule); else the colour set on the team (`rep_teams.color`, initials in dark ink on a light colour
 * so they still read); else the initials on the one tile's white ground. A crest too wide or too tall falls to the colour,
 * not to the initials (tab 17). A crest whose file fails to load falls the same way (`SidebarLogoTile`'s `onError`).
 */
import { logoFitsTile } from './logo-aspect';
import { pickInk, relativeLuminance } from './color-contrast';
import { mastheadSeasonLabel } from './coach-season-label';

/** A team's door: its Overview, or — with no live season — its season's page, its one door (CLAUDE.md; C6). */
export function teamHref(orgSlug: string, teamId: string, closed: boolean): string {
  return `/${orgSlug}/coaches/teams/${teamId}${closed ? '/season-end' : ''}`;
}

/** The crest's address: the team's own crest route, keyed by its version (a new picture, a new address). */
export function teamCrestUrl(orgSlug: string, teamId: string, version: string | null | undefined): string | null {
  return version ? `/api/coaches/${orgSlug}/teams/${teamId}/crest?v=${encodeURIComponent(version)}` : null;
}

/** `rep_teams.color` is free text: only a `#rrggbb` paints a tile. */
const HEX = /^#[0-9a-fA-F]{6}$/;
/** The crossover for an arbitrary brand colour (lib/color-contrast.ts's note: 0.42). */
const INK_CROSSOVER = 0.42;

/** The tile's fill and ink for a team colour, or null when the colour is unset or not a hex value. */
export function teamTileColor(color: string | null | undefined): { fill: string; ink: string } | null {
  if (!color || !HEX.test(color.trim())) return null;
  const fill = color.trim();
  return { fill, ink: pickInk(relativeLuminance(fill), INK_CROSSOVER) };
}

export type TeamTile = {
  /** The crest's address when the crest is the tile, else null. */
  source: string | null;
  aspect: number | null;
  /** The colour step: used when there is no crest to show (or it fails to load). */
  color: { fill: string; ink: string } | null;
};

type TeamFacts = {
  teamId: string; teamName: string; teamColor: string | null; teamCrestAspect?: number | null; teamCrestVersion?: string | null;
  programYearName: string; programYearYear: number | null; programYearStatus?: string;
};

export type TeamSwitchRow = { teamId: string; name: string; line: string; href: string; current: boolean; tile: TeamTile };
export type TeamSwitchGroup = { label: string; rows: TeamSwitchRow[] };

/**
 * ⚖ THE TEAM LIST (navigation Phase 4, tab 17; C6): "Your teams" — the live ones — then "No live season", each row its tile,
 * its name and its season's words ("2026 season", "Fall Ball 2026 · Draft"; one spelling of a season, `mastheadSeasonLabel`),
 * the current one marked. A picked team opens its Overview; a team with no live season opens its season's page, its one
 * door (CLAUDE.md). The team list does not carry another team's record or its game day, so a row says neither.
 */
export function teamSwitchGroups(
  orgSlug: string,
  live: readonly TeamFacts[],
  closed: readonly TeamFacts[],
  currentTeamId: string | null,
): TeamSwitchGroup[] {
  const row = (t: TeamFacts, isClosed: boolean): TeamSwitchRow => ({
    teamId: t.teamId,
    name: t.teamName,
    line: [mastheadSeasonLabel(t.programYearName, t.teamName, t.programYearYear), !isClosed && t.programYearStatus === 'draft' ? 'Draft' : null]
      .filter(Boolean).join(' · '),
    href: teamHref(orgSlug, t.teamId, isClosed),
    current: t.teamId === currentTeamId,
    tile: teamTile(orgSlug, t),
  });
  return [
    { label: 'Your teams', rows: live.map(t => row(t, false)) },
    { label: 'No live season', rows: closed.map(t => row(t, true)) },
  ].filter(g => g.rows.length);
}

/** The tile for one team, from the facts the coach's team list carries. */
export function teamTile(orgSlug: string, team: {
  teamId: string; teamColor: string | null; teamCrestAspect?: number | null; teamCrestVersion?: string | null;
}): TeamTile {
  const aspect = team.teamCrestAspect ?? null;
  const source = logoFitsTile(aspect) ? teamCrestUrl(orgSlug, team.teamId, team.teamCrestVersion) : null;
  return { source, aspect, color: teamTileColor(team.teamColor) };
}
