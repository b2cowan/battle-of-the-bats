import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { clubTeamLink, tournamentTeamPaths, type ClubTeamLink } from './team-two-pages';
import type { PublicClubAccessOrg } from './public-club-access';
import type { FamilyScheduleEntry } from './family-view';

/**
 * The reads behind a team's two pages linking to each other (club round C6). The decisions are lib/team-two-pages.ts's;
 * this only fetches the facts. `rep_team_tournament_registrations` has RLS with no policies (service role only), like
 * every public read here.
 */

type Rel<T> = T | T[] | null;
const one = <T,>(v: Rel<T> | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Tournament → club: the link row for one registration on the tournament team page, or null. One read. */
export async function clubTeamLinkForRegistration(
  club: PublicClubAccessOrg & { id: string; name: string },
  tournamentOrgId: string,
  registrationId: string,
): Promise<ClubTeamLink | null> {
  const { data, error } = await supabaseAdmin.from('rep_team_tournament_registrations')
    .select('org_id, rep_teams!inner(org_id, slug, name)')
    .eq('tournament_team_id', registrationId)
    .maybeSingle();
  if (error || !data) return null; // a missing link is the common case; a failed read only loses the link
  const row = data as unknown as { org_id: string; rep_teams: Rel<{ org_id: string; slug: string | null; name: string }> };
  const rep = one(row.rep_teams);
  return clubTeamLink({
    club,
    tournamentOrgId,
    link: { orgId: row.org_id, repTeam: rep ? { orgId: rep.org_id, slug: rep.slug, name: rep.name } : null },
  });
}

/**
 * Club → tournament: entry id → the tournament team page's path, for the schedule's tournament games. A team with no
 * tournament game on its public schedule (nearly all of them) pays no read.
 */
export async function tournamentTeamPathsForSchedule(
  clubOrgId: string,
  repTeamId: string,
  entries: readonly FamilyScheduleEntry[],
): Promise<Map<string, string>> {
  const ids = entries.filter(e => e.eventType === 'tournament_game').map(e => e.id);
  if (ids.length === 0) return new Map();
  try {
    const { data: eventRows, error: e1 } = await supabaseAdmin.from('rep_team_events')
      .select('id, source_tournament_game_id')
      .eq('team_id', repTeamId)
      .in('id', ids)
      .not('source_tournament_game_id', 'is', null);
    if (e1) throw e1;
    const events = ((eventRows ?? []) as Array<{ id: string; source_tournament_game_id: string }>)
      .map(r => ({ id: r.id, sourceGameId: r.source_tournament_game_id }));
    if (events.length === 0) return new Map();

    const [{ data: gameRows, error: e2 }, { data: linkRows, error: e3 }] = await Promise.all([
      supabaseAdmin.from('games').select('id, tournament_id, tournaments!inner(id, slug, status, org_id)')
        .in('id', [...new Set(events.map(e => e.sourceGameId))]),
      supabaseAdmin.from('rep_team_tournament_registrations')
        .select('tournament_team_id, org_id, rep_teams!inner(org_id), teams!inner(tournament_id, status)')
        .eq('rep_team_id', repTeamId),
    ]);
    if (e2) throw e2;
    if (e3) throw e3;
    type GameRow = { id: string; tournament_id: string; tournaments: Rel<{ id: string; slug: string; status: string; org_id: string }> };
    type LinkRow = { tournament_team_id: string; org_id: string; rep_teams: Rel<{ org_id: string }>;
      teams: Rel<{ tournament_id: string; status: string }> };
    const games = (gameRows ?? []) as unknown as GameRow[];
    const links = (linkRows ?? []) as unknown as LinkRow[];
    return tournamentTeamPaths({
      clubOrgId,
      events,
      games: games.map(g => ({ id: g.id, tournamentId: g.tournament_id })),
      tournaments: games.flatMap(g => {
        const t = one(g.tournaments);
        return t ? [{ id: t.id, slug: t.slug, status: t.status, orgId: t.org_id }] : [];
      }),
      registrations: links.flatMap(l => {
        const team = one(l.teams);
        return team ? [{ registrationId: l.tournament_team_id, tournamentId: team.tournament_id, status: team.status,
          linkOrgId: l.org_id, repTeamOrgId: one(l.rep_teams)?.org_id ?? '' }] : [];
      }),
    });
  } catch (err) {
    // The schedule still renders; only the links go. Logged so a broken read is seen, not silently linkless.
    console.error('[team-two-pages] tournament links for a team schedule failed', err);
    return new Map();
  }
}
