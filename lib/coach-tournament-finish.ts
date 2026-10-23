import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { computeTournamentStandings } from './tie-breakers';
import { isPublicPageEnabled, type PublicPageKey } from './public-pages';
import { deriveCoachLifecycleChip, isFinishedLifecycle } from './coach-tournament-lifecycle';
import { finishFromStandings, type TournamentFinish } from './coach-tournament-rows';
import { tournamentToday } from './timezone';
import type { PlayoffConfig, TournamentSettings } from './types';

/**
 * "2nd of 4" on a finished tournament's row (Club Tier Stage 7d; owner ruling 2026-10-22, Put to the
 * owner 2 option (a)): shown only when the organizer publishes standings and the division played a
 * round robin — `isPublicPageEnabled(…, 'standings')`, the same gate as the record's snapshot and every
 * public standings page — and ABSENT otherwise (no placeholder, no dash).
 *
 * Cost: one parallel wave of four small reads per LIST LOAD, however many tournaments are finished —
 * never a standings read per row — and none at all when the list has no finished accepted entry. The
 * ranking is the one tie-break engine (`computeTournamentStandings`, with the division's own tie-break
 * overrides and coin tosses), so a row can never disagree with the public standings page.
 */
/** PostgREST's default page: a read this long was probably cut off. */
const READ_ROW_CAP = 1000;

type FinishCandidate = {
  registration: { id: string; status: string; divisionId: string | null; tournamentId: string | null };
  tournament: { id: string; startDate: string | null; endDate: string | null; status: string } | null;
};

export async function attachTournamentFinishes<T extends FinishCandidate>(
  entries: T[],
  today: string = tournamentToday(),
): Promise<Array<T & { finish: TournamentFinish | null }>> {
  const candidates = entries.filter(e => {
    if (e.registration.status !== 'accepted' || !e.registration.divisionId || !e.tournament) return false;
    return isFinishedLifecycle(deriveCoachLifecycleChip(e.tournament.startDate, e.tournament.endDate, today, e.tournament.status).state);
  });
  if (candidates.length === 0) return entries.map(e => ({ ...e, finish: null }));

  const tournamentIds = [...new Set(candidates.map(e => e.tournament!.id))];
  const divisionIds = [...new Set(candidates.map(e => e.registration.divisionId!))];

  try {
    const [tournaments, divisions, games, teams] = await Promise.all([
      supabaseAdmin.from('tournaments').select('id, settings, public_hidden_pages').in('id', tournamentIds),
      supabaseAdmin.from('divisions').select('id, playoff_config, schedule_visibility').in('id', divisionIds),
      supabaseAdmin
        .from('games')
        .select('division_id, status, is_playoff, home_team_id, away_team_id, home_score, away_score')
        .in('tournament_id', tournamentIds)
        .in('division_id', divisionIds),
      supabaseAdmin
        .from('teams')
        .select('id, name, division_id, status, pool_id')
        .in('tournament_id', tournamentIds)
        .in('division_id', divisionIds)
        .eq('status', 'accepted'),
    ]);
    for (const r of [tournaments, divisions, games, teams]) if (r.error) throw r.error;
    // A read that hit the row cap was cut short, and a rank worked out from half the games is WRONG, not
    // absent — so a capped read drops the finishes like any other failed read.
    for (const r of [games, teams]) if ((r.data?.length ?? 0) >= READ_ROW_CAP) throw new Error('finish read hit the row cap');

    const tournamentById = new Map(((tournaments.data ?? []) as Array<{ id: string; settings: TournamentSettings | null; public_hidden_pages: unknown }>)
      .map(t => [t.id, t] as const));
    const divisionRows = (divisions.data ?? []) as Array<{ id: string; playoff_config: PlayoffConfig | null; schedule_visibility: string | null }>;
    const configByDivision = new Map(divisionRows.map(d => [d.id, d.playoff_config ?? undefined] as const));
    // The record shows a finish only for a division whose schedule is published; the list says the same.
    const publishedDivisions = new Set(divisionRows.filter(d => d.schedule_visibility === 'published').map(d => d.id));
    const teamRows = ((teams.data ?? []) as Array<{ id: string; name: string; division_id: string; status: string; pool_id: string | null }>)
      .map(t => ({ id: t.id, name: t.name, divisionId: t.division_id, status: t.status, poolId: t.pool_id }));
    const gameRows = ((games.data ?? []) as Array<{
      division_id: string; status: string; is_playoff: boolean | null;
      home_team_id: string | null; away_team_id: string | null; home_score: number | null; away_score: number | null;
    }>).map(g => ({
      divisionId: g.division_id, status: g.status, isPlayoff: g.is_playoff,
      homeTeamId: g.home_team_id, awayTeamId: g.away_team_id, homeScore: g.home_score, awayScore: g.away_score,
    }));

    // One standings computation per DIVISION, however many entries share it.
    const standingsByDivision = new Map<string, ReturnType<typeof computeTournamentStandings>>();
    const finishById = new Map<string, TournamentFinish | null>();
    for (const e of candidates) {
      const t = tournamentById.get(e.tournament!.id);
      const shown = t && isPublicPageEnabled(
        { publicHiddenPages: (Array.isArray(t.public_hidden_pages) ? t.public_hidden_pages : []) as PublicPageKey[], settings: t.settings ?? undefined } as Parameters<typeof isPublicPageEnabled>[0],
        'standings',
      );
      if (!shown) continue;
      const divisionId = e.registration.divisionId!;
      if (!publishedDivisions.has(divisionId)) continue;
      let rows = standingsByDivision.get(divisionId);
      if (!rows) {
        rows = computeTournamentStandings(divisionId, teamRows, gameRows, configByDivision.get(divisionId), t.settings ?? undefined);
        standingsByDivision.set(divisionId, rows);
      }
      finishById.set(e.registration.id, finishFromStandings(rows, e.registration.id));
    }
    return entries.map(e => ({ ...e, finish: finishById.get(e.registration.id) ?? null }));
  } catch (error) {
    // A finish is a nicety on a list that must still load: a failed read drops the finishes, never the list.
    console.error('[coach tournament finish] read failed (non-fatal, rows show no finish):', error);
    return entries.map(e => ({ ...e, finish: null }));
  }
}
