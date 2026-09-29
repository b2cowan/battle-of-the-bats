import { redirect } from 'next/navigation';

/**
 * THE OLD SEASON ("program year") PAGES — ONE REDIRECT (Club Tier Stage 2, session 3; specimen 2).
 *
 * The club used to work on a year it picked: a season page with a status stepper, and under it the
 * season's Coaches, Tryouts and Schedule. The club now works on the TEAM and its live season, so every
 * old address lands on its team-level twin — a bookmark, a notification link or an old email keeps
 * working. The season id in the address is not needed (and not trusted): the team's pages always open
 * its live season, else its last closed one as a record, and a closed season's own record is its
 * past-season page (the team page's Seasons list opens it).
 *
 *   …/program-years/{year}            → the team page
 *   …/program-years/{year}/coaches    → the team's Coaches
 *   …/program-years/{year}/tryouts    → the team's Tryouts
 *   …/program-years/{year}/schedule   → the team's Schedule
 *   …/program-years/{year}/roster     → the team's Roster
 * The team pages check the org, the Rep Teams gate and the member's team groups themselves.
 */
const TEAM_PAGES = new Set(['coaches', 'tryouts', 'schedule', 'roster']);

export default async function OldSeasonPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; yearId: string; rest?: string[] }>;
}) {
  const { orgSlug, teamId, rest } = await params;
  const page = rest?.[0];
  const team = `/${orgSlug}/admin/rep-teams/teams/${encodeURIComponent(teamId)}`;
  redirect(page && TEAM_PAGES.has(page) ? `${team}/${page}` : team);
}
