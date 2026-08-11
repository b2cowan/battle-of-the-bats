/**
 * The ONE season-label helper for coach-portal chrome (page-header ruling 2026-08-11).
 *
 * Orgs often auto-name a program year "<Team name> <Year>" ("Riverdale Ridge 12U 2026"), and the
 * team's name is already on screen wherever a season label renders — so a leading team-name copy
 * is stripped, whole-word only (a team called "Jay" never mangles a season "Jays 2026").
 *
 * This file exists because three hand-copies of that strip had grown (Overview, Roster, player
 * page) and the two feeding subtitles both produced masthead-duplicating text — one literally
 * rendered "2026 Season season". Page subtitles are gone; the masthead is the season's one
 * surface, and this is its one label function.
 */

/** Strip a leading whole-word team-name prefix off a season name. */
export function stripTeamNamePrefix(
  seasonName: string | null | undefined,
  teamName: string | null | undefined,
): string {
  const s = (seasonName ?? '').trim();
  if (!s) return '';
  const t = (teamName ?? '').trim();
  if (t && s.toLowerCase().startsWith(t.toLowerCase())) {
    const rest = s.slice(t.length);
    // Whole-word prefix only: the next character must be a separator (or the end).
    if (rest === '' || /^[\s—–-]/.test(rest)) {
      const stripped = rest.replace(/^[\s—–-]+/, '').trim();
      if (stripped) return stripped;
    }
  }
  return s;
}

/**
 * The masthead's season text. An org that NAMED its season ("Fall Ball 2026", "2026 Season")
 * shows that name verbatim — new information the derived year can't carry. A bare-year name
 * (or no name at all) renders "<year> season" exactly as the masthead always has. Returns
 * null when there is nothing to say.
 */
export function mastheadSeasonLabel(
  seasonName: string | null | undefined,
  teamName: string | null | undefined,
  year: number | string | null | undefined,
): string | null {
  const stripped = stripTeamNamePrefix(seasonName, teamName);
  const y = year == null ? '' : String(year).trim();
  if (stripped && (!y || stripped.toLowerCase() !== y.toLowerCase())) return stripped;
  if (y) return `${y} season`;
  return null;
}
