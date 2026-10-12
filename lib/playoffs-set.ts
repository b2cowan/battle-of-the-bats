/**
 * lib/playoffs-set.ts — "Playoffs are set", once per division, when it is true (server-only).
 *
 * Tournament admin redesign, Stage 3 addendum: A69 (ruled 2026-10-12) and the build-start rulings P3 + P4 (owner,
 * 2026-10-12). It replaces `announcePlayoffsIfFirstTime` (the games route), which went on the first bracket SAVED
 * anywhere in the tournament, published or not, to every follower of every team — "the seeding is locked" before any
 * seeding existed (F102).
 *
 * The rule: the division is published, every one of its playoff teams is known (`playoffTeamsKnown`,
 * lib/playoffs-set-rule.ts), and no coin toss is still owed. Every place that can make it true calls this AFTER its
 * write — the score that ends the round robin (tournament-scoring-service), a coin toss (divisions route) and a bracket
 * saved or re-placed (games route), each once the teams are filled (`fillPlayoffTeams` below), publishing a division
 * (schedule-publish, divisions set-visibility). It reads the state itself, so a
 * caller never decides; it claims `divisions.playoffs_announced_at` NULL → now() before it sends, so two callers at
 * once (or a re-score later) never send it twice.
 *
 *   staff  the bell/push `playoffs_set` to the org's staff (tournament-scoped as notify() scopes it), naming the
 *          division ("🏆 U13 Boys playoffs are set") — the actor who caused it is left out when known;
 *   fans   a push to followers of THAT DIVISION's teams only (P3: a U11 parent isn't told U13's bracket is set).
 *
 * Never throws, so it can never fail the write that triggered it. The routes AWAIT it (this host can drop work left
 * running after the response, and the claim would make that drop permanent); the score hook, which is synchronous,
 * fires it like the score's own alerts.
 */
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { notifyFansForPlayoff } from './fan-notify';
import { getDivisions, getGames, getTeams, getTournament, resolveAndFillPlayoffSeeds } from './db';
import { pendingCoinTosses } from './coin-toss';
import { playoffTeamsKnown, type PlayoffSidesGame } from './playoffs-set-rule';
import { PLAYOFFS_SET_WORDS } from './schedule-words';
import { captureError } from './observability';

export async function announcePlayoffsSetIfReady(divisionId: string | null | undefined, actorUserId?: string | null): Promise<void> {
  if (!divisionId) return;
  try {
    const [{ data: div }, { data: sides }] = await Promise.all([
      supabaseAdmin
        .from('divisions')
        .select('id, name, tournament_id, schedule_visibility, playoffs_announced_at')
        .eq('id', divisionId)
        .maybeSingle(),
      supabaseAdmin
        .from('games')
        .select('status, home_team_id, away_team_id, home_placeholder, away_placeholder')
        .eq('division_id', divisionId)
        .eq('is_playoff', true),
    ]);
    if (!div || div.schedule_visibility !== 'published' || div.playoffs_announced_at) return;
    const playoffGames: PlayoffSidesGame[] = (sides ?? []).map(g => ({
      status: g.status as string,
      homeTeamId: (g.home_team_id as string | null) ?? null,
      awayTeamId: (g.away_team_id as string | null) ?? null,
      homePlaceholder: (g.home_placeholder as string | null) ?? null,
      awayPlaceholder: (g.away_placeholder as string | null) ?? null,
    }));
    // The cheap half first: every score of a published round robin asks, and until its last one a seed still waits —
    // two small reads, then nothing. Only a division whose teams are all known reads the tournament for the coin toss.
    if (!playoffTeamsKnown(playoffGames)) return;
    const tournamentId = div.tournament_id as string;

    const [games, teams, divisions, tournament] = await Promise.all([
      getGames(tournamentId, { admin: true }),
      getTeams(tournamentId, { admin: true }),
      getDivisions(tournamentId, { admin: true }),
      getTournament(tournamentId),
    ]);
    const division = divisions.find(d => d.id === divisionId);
    if (!division || !tournament) return;
    // A coin toss still owed: the seeds it decides can swap, so the moment waits for the toss.
    if (pendingCoinTosses({ divisions: [division], teams, games, settings: tournament.settings }).length > 0) return;

    // The org by `tournaments.org_id` — `Tournament.organizationId` maps a column tournaments does not have (always
    // empty). Read BEFORE the claim: a claim with nowhere to send would silence the division for good.
    const { data: trow } = await supabaseAdmin.from('tournaments').select('org_id').eq('id', tournamentId).maybeSingle();
    const { data: org } = trow?.org_id
      ? await supabaseAdmin.from('organizations').select('id, slug').eq('id', trow.org_id).maybeSingle()
      : { data: null };
    if (!org) return;

    // The claim: only the write that wins the flip sends.
    const { data: claimed } = await supabaseAdmin
      .from('divisions')
      .update({ playoffs_announced_at: new Date().toISOString() })
      .eq('id', divisionId)
      .is('playoffs_announced_at', null)
      .eq('schedule_visibility', 'published')
      .select('id')
      .maybeSingle();
    if (!claimed) return;

    // Both sends finish before this returns: a caller that awaits it has sent the moment, which is claimed for good.
    const link = `/${org.slug}/${tournament.slug}/playoffs`;
    const divisionTeamIds = teams.filter(t => t.divisionId === divisionId).map(t => t.id);
    await Promise.all([
      notify({
        orgId: org.id as string,
        tournamentId,
        eventType: 'playoffs_set',
        title: PLAYOFFS_SET_WORDS.staffTitle(div.name as string),
        body: PLAYOFFS_SET_WORDS.staffBody(tournament.name),
        link,
        excludeUserIds: actorUserId ? [actorUserId] : undefined,
      }).catch(console.error),
      notifyFansForPlayoff(tournamentId, { divisionName: div.name as string, teamIds: divisionTeamIds }).catch(console.error),
    ]);
  } catch (err) {
    console.error('[playoffs-set] announcePlayoffsSetIfReady error:', err);
    void captureError(err, { route: 'lib/playoffs-set', severity: 'warning', title: 'Playoffs are set: announcement failed' });
  }
}

/**
 * Fill the playoff teams the standings already decide (`resolveAndFillPlayoffSeeds` — it stops early until a division's
 * round robin is decided). Awaited: the caller's reload reads the teams. Never throws: a save stands without its fill.
 */
export async function fillPlayoffTeams(tournamentId: string, divisionIds: Iterable<string>): Promise<void> {
  for (const divisionId of new Set([...divisionIds].filter(Boolean))) {
    try {
      await resolveAndFillPlayoffSeeds(tournamentId, divisionId, { admin: true });
    } catch (err) {
      console.error('[playoffs-set] filling the playoff teams failed (the write stands):', err);
    }
  }
}

/**
 * A write that can fill the teams — a bracket saved, a coin toss: the teams first, then the question (P4). A bracket
 * saved after the round robin used to sit on "Seed #1 … Seed #8" until some other score landed, because only a score or
 * a coin toss ran the fill. Awaited to the end, the announcement included (it never throws).
 */
export async function fillPlayoffTeamsThenAnnounce(tournamentId: string, divisionIds: Iterable<string>, actorUserId?: string | null): Promise<void> {
  const ids = [...new Set([...divisionIds].filter(Boolean))];
  await fillPlayoffTeams(tournamentId, ids);
  await Promise.all(ids.map(divisionId => announcePlayoffsSetIfReady(divisionId, actorUserId)));
}

/** The same, from a game (a score's division). */
export async function announcePlayoffsSetForGame(gameId: string, actorUserId?: string | null): Promise<void> {
  try {
    const { data: g } = await supabaseAdmin.from('games').select('division_id').eq('id', gameId).maybeSingle();
    await announcePlayoffsSetIfReady((g?.division_id as string | null) ?? null, actorUserId);
  } catch (err) {
    console.error('[playoffs-set] announcePlayoffsSetForGame error:', err);
  }
}
