import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getPublicTournamentPageData } from './public-tournament-data';
import { getTournamentsByOrg } from './db';
import {
  isGameLive,
  gameStartMs,
  DEFAULT_GAME_DURATION_MINUTES,
} from './game-status';
import { deriveTierChampions, isTournamentPlayoffsComplete } from './champions';
import { getRegistrationState } from './registration-state';
import { tournamentToday, daysBetweenDateStrings } from './timezone';
import { relativeDayLabel, formatTime } from './utils';
import type { Division, Game, Team, Tournament } from './types';
import type { TournamentFollowCard, OrgFollowCard } from './home-following';

/**
 * lib/entity-follow-status.ts — the ONE current-state status vocabulary for Phase-6 follows
 * (F5: computed entirely from already-public data — NO activity feed, NO new push). Shared by
 * Home's whole-event cards + Organizations section (and reused by Scores org tiles).
 *
 * Whole-tournament line: dates/starts-in → REGISTRATION OPEN → FIRST PITCH → live/today →
 * PLAYOFFS ARE SET → CHAMPIONS CROWNED → COMPLETED. Org rollup line: live → next-event →
 * upcoming count → quiet off-season.
 *
 * Fetch posture mirrors the Following/Scores feeds: one getPublicTournamentPageData('scores')
 * per unique tournament (games + teams only), plus ONE batched divisions query for the
 * registration-open + champion-name branches. Hidden-schedule tournaments (`!pageEnabled`) fall
 * back to a date-level status — a hidden schedule must never leak game counts (P3 precedent).
 * `championsCrownedAt` (mig 176) is prod-pending → null is treated as "not crowned".
 */

const COMPLETED_GRACE_DAYS = 7;
/** Bound the per-org tournament scan (matches the Scores staff cap posture). */
const MAX_ORG_TOURNAMENTS = 40;
/** Bound the NUMBER of followed orgs a single rollup resolves — each org costs a tournaments scan
 *  plus a per-in-progress-event fetch, and the device endpoints (/follows/entities, /scores POST)
 *  are anonymous + unthrottled, so this caps the fan-out an arbitrary caller can trigger. Well
 *  above any real fan's followed-org count; a log fires (never silent truncation) if it's hit. */
const MAX_ROLLUP_ORGS = 30;

export interface TournamentFollowStatus {
  group: 'live' | 'today' | 'playoffs_set' | 'champions' | 'completed' | 'scheduled' | 'reg_open' | 'pre';
  text: string;
  live: boolean;
  finished: boolean;
}

export interface ResolvedTournamentStatus {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  status: TournamentFollowStatus;
}

const tournamentKey = (orgSlug: string, tournamentSlug: string) => `${orgSlug}/${tournamentSlug}`;

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const s = new Date(`${startDate}T12:00:00`);
  const e = endDate ? new Date(`${endDate}T12:00:00`) : null;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (!e || startDate === endDate) return s.toLocaleDateString('en-CA', opts);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${s.toLocaleDateString('en-CA', opts)} – ${e.toLocaleDateString('en-CA', sameYear ? opts : { ...opts, year: 'numeric' })}`;
}

/** Compute the current-state status for one tournament from its public data (F5 vocabulary). */
function computeTournamentStatus(
  tournament: Tournament,
  games: Game[],
  teams: Array<{ id: string; name: string }>,
  divisions: Division[],
  pageEnabled: boolean,
  today: string,
  now: Date,
): TournamentFollowStatus {
  const startDate = tournament.startDate ?? null;
  const endDate = tournament.endDate ?? null;

  // ── Finished detection — MUST match TournamentHomeContent's canonical signal, which counts a
  //    cancelled game as TERMINAL (a fully rained-out round-robin is finished, not "upcoming").
  //    Computed over ALL games; gated on pageEnabled so a hidden schedule falls back to date-level
  //    status (no game-derived signal). `playable` (cancelled excluded) drives the LIVE/today counts. ──
  const allGames = pageEnabled ? games : [];
  const playable = pageEnabled ? games.filter(g => g.status !== 'cancelled') : [];
  const hasPlayoffGames = allGames.some(g => g.isPlayoff);
  const allGamesTerminal = allGames.length > 0 && allGames.every(g => g.status === 'completed' || g.status === 'forfeit' || g.status === 'cancelled');
  const noUnplayed = !allGames.some(g => g.status === 'scheduled');
  const playoffsComplete = pageEnabled && isTournamentPlayoffsComplete(games, divisions);
  const eventEnded = !endDate || today >= endDate;
  const roundRobinComplete = !hasPlayoffGames && allGamesTerminal && eventEnded;
  const isFinished =
    tournament.status === 'completed' ||
    (playoffsComplete && noUnplayed) ||
    roundRobinComplete;

  const completedLabel = endDate ? relativeDayLabel(endDate, today) : null;

  // Finished FIRST — a completed event is done (a finished event has no live games). Champions
  // only when the crowned timestamp is set (mig 176 null-tolerant); otherwise "Completed".
  if (isFinished) {
    if (tournament.championsCrownedAt) {
      const champ = deriveTierChampions(games, teams as Team[], divisions).find(c => c.isTopTier)?.champion ?? null;
      if (champ) return { group: 'champions', text: `Champions crowned · ${champ}`, live: false, finished: true };
    }
    return { group: 'completed', text: completedLabel ? `Completed · ${completedLabel}` : 'Completed', live: false, finished: true };
  }

  // ── Live / today (only meaningful with a visible schedule) ──
  let liveCount = 0;
  let todayCount = 0;
  for (const g of playable) {
    if (isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now)) liveCount++;
    if (g.date === today) todayCount++;
  }
  if (liveCount > 0) return { group: 'live', text: `${liveCount} live now`, live: true, finished: false };
  if (todayCount > 0) return { group: 'today', text: `${todayCount} game${todayCount === 1 ? '' : 's'} today`, live: false, finished: false };

  // ── Playoffs are set (pool play done, finals not started) ──
  const eventHasStarted = !startDate || today >= startDate;
  const poolPlayComplete = playable.filter(g => !g.isPlayoff).every(g => g.status === 'completed' || g.status === 'forfeit');
  if (hasPlayoffGames && eventHasStarted && poolPlayComplete) {
    return { group: 'playoffs_set', text: 'Playoffs are set', live: false, finished: false };
  }

  // ── Pre-event: first pitch (schedule published) → registration open → dates/starts-in ──
  const isPreEvent = !!startDate && today < startDate;
  if (isPreEvent && pageEnabled) {
    const firstScheduled = playable
      .filter(g => g.status === 'scheduled' && g.date && (!startDate || g.date >= startDate))
      .sort((a, b) => (gameStartMs(a) ?? Date.parse(`${a.date}T12:00:00Z`)) - (gameStartMs(b) ?? Date.parse(`${b.date}T12:00:00Z`)))[0];
    if (firstScheduled?.date) {
      const when = [relativeDayLabel(firstScheduled.date, today), firstScheduled.time ? formatTime(firstScheduled.time) : null]
        .filter(Boolean).join(' · ');
      return { group: 'scheduled', text: `First pitch · ${when}`, live: false, finished: false };
    }
  }

  // Registration open/waitlist (uses accepted teams for a rough capacity read — enough for open vs full).
  const reg = getRegistrationState(tournament, divisions, teams as unknown as Team[]);
  if (reg.state === 'open') return { group: 'reg_open', text: 'Registration open', live: false, finished: false };
  if (reg.state === 'waitlist') return { group: 'reg_open', text: 'Waitlist open', live: false, finished: false };

  // Dates / starts-in fallback.
  if (startDate) {
    const range = formatDateRange(startDate, endDate);
    const daysAway = daysBetweenDateStrings(today, startDate);
    if (daysAway > 0 && daysAway <= 14) return { group: 'pre', text: `Starts ${relativeDayLabel(startDate, today)}`, live: false, finished: false };
    return { group: 'pre', text: range ?? 'Upcoming', live: false, finished: false };
  }
  return { group: 'pre', text: 'Dates TBD', live: false, finished: false };
}

/** Resolve current-state statuses for a set of tournament refs. One scores fetch per unique
 *  tournament + one batched divisions query; dead/non-public tournaments drop out (clean-drop). */
export async function resolveTournamentStatuses(
  refs: Array<{ orgSlug: string; tournamentSlug: string }>,
): Promise<Map<string, ResolvedTournamentStatus>> {
  const out = new Map<string, ResolvedTournamentStatus>();
  const uniqueKeys = Array.from(new Set(refs.map(r => tournamentKey(r.orgSlug, r.tournamentSlug))));
  if (uniqueKeys.length === 0) return out;

  const results = await Promise.allSettled(
    uniqueKeys.map(async key => {
      const [orgSlug, tournamentSlug] = key.split('/');
      const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'scores');
      return [key, data] as const;
    }),
  );
  const dataByKey = new Map(
    results
      .filter((r): r is PromiseFulfilledResult<readonly [string, Awaited<ReturnType<typeof getPublicTournamentPageData>>]> => r.status === 'fulfilled')
      .map(r => r.value),
  );

  // One batched divisions query across every resolved tournament (registration + champions).
  const idByKey = new Map<string, string>();
  for (const [key, data] of dataByKey) if (data?.tournament) idByKey.set(key, data.tournament.id);
  const divisionsByTournament = new Map<string, Division[]>();
  const ids = Array.from(idByKey.values());
  if (ids.length > 0) {
    // Only the fields the status branches read: reg-state (is_closed / capacity) + champions (id).
    const { data: divRows } = await supabaseAdmin
      .from('divisions')
      .select('id, tournament_id, name, order, is_closed, capacity, playoff_config')
      .in('tournament_id', ids);
    for (const d of (divRows ?? []) as Array<Record<string, unknown>>) {
      const tid = d.tournament_id as string;
      const list = divisionsByTournament.get(tid) ?? [];
      list.push({
        id: d.id as string,
        tournamentId: tid,
        name: (d.name as string) ?? '',
        order: (d.order as number) ?? 0,
        isClosed: (d.is_closed as boolean) ?? false,
        capacity: (d.capacity as number | undefined) ?? undefined,
        playoffConfig: (d.playoff_config as Division['playoffConfig']) ?? undefined,
      } as Division);
      divisionsByTournament.set(tid, list);
    }
  }

  const today = tournamentToday();
  const now = new Date();
  for (const key of uniqueKeys) {
    const data = dataByKey.get(key);
    if (!data || !data.tournament) continue; // clean-drop: non-public / vanished / canceled
    const [orgSlug, tournamentSlug] = key.split('/');
    const divisions = divisionsByTournament.get(data.tournament.id) ?? [];
    const status = computeTournamentStatus(
      data.tournament,
      data.games,
      data.teams,
      divisions,
      data.pageEnabled,
      today,
      now,
    );
    out.set(key, { orgSlug, tournamentSlug, tournamentName: data.tournament.name, status });
  }
  return out;
}

/** Map a status group to the FollowFeedGroup bucket the tournament card uses for current/past
 *  ordering (live floats first, finished → Past). */
function statusToFeedGroup(status: TournamentFollowStatus): TournamentFollowCard['group'] {
  if (status.finished) return 'recent';
  if (status.live) return 'live';
  if (status.group === 'today' || status.group === 'playoffs_set') return 'live';
  return 'upcoming';
}

/** Whole-event follow cards (F2) — the tournament card with the event status as the context line
 *  (no team line). Split current vs past like the team rollup. */
export async function getWholeEventFollowCards(
  refs: Array<{ orgSlug: string; tournamentSlug: string; tournamentName: string }>,
): Promise<TournamentFollowCard[]> {
  const statuses = await resolveTournamentStatuses(refs);
  const cards: TournamentFollowCard[] = [];
  for (const ref of refs) {
    const key = tournamentKey(ref.orgSlug, ref.tournamentSlug);
    const resolved = statuses.get(key);
    if (!resolved) continue; // clean-drop
    cards.push({
      key,
      orgSlug: ref.orgSlug,
      tournamentSlug: ref.tournamentSlug,
      tournamentName: resolved.tournamentName || ref.tournamentName,
      href: `/${ref.orgSlug}/${ref.tournamentSlug}`,
      teamNames: [],
      status: { text: resolved.status.text, live: resolved.status.live },
      group: statusToFeedGroup(resolved.status),
      wholeEvent: true,
    });
  }
  return cards;
}

/** Org rollup context line (F2): live → next-event → upcoming count → quiet off-season.
 *  Live detection fetches game data only for IN-PROGRESS tournaments (bounded, usually 0–2). */
export async function getOrgFollowRollups(
  orgs: Array<{ orgSlug: string; orgId: string; orgName: string; logoUrl: string | null }>,
): Promise<OrgFollowCard[]> {
  const today = tournamentToday();
  const now = new Date();

  if (orgs.length > MAX_ROLLUP_ORGS) {
    console.warn(`[entity-follow-status] org rollups capped at ${MAX_ROLLUP_ORGS} (had ${orgs.length})`);
  }
  const cards = await Promise.all(
    orgs.slice(0, MAX_ROLLUP_ORGS).map(async (org): Promise<OrgFollowCard> => {
      const base: OrgFollowCard = {
        key: org.orgSlug,
        orgSlug: org.orgSlug,
        orgName: org.orgName,
        href: `/${org.orgSlug}`,
        logoUrl: org.logoUrl,
        context: { text: 'Off-season — their next event will show up here', live: false, offSeason: true },
      };
      let tournaments: Tournament[];
      try {
        tournaments = (await getTournamentsByOrg(org.orgId, { admin: true }))
          .filter(t => t.status === 'active' || t.status === 'completed')
          .slice(0, MAX_ORG_TOURNAMENTS);
      } catch {
        return base;
      }

      const inProgress = tournaments.filter(
        t => t.status === 'active' && t.startDate && t.endDate && today >= t.startDate && today <= t.endDate,
      );
      const upcoming = tournaments
        .filter(t => t.status === 'active' && (!t.startDate || t.startDate > today))
        .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'));

      // Live line — check games only for the in-progress events (bounded fetch).
      for (const t of inProgress) {
        try {
          const data = await getPublicTournamentPageData(org.orgSlug, t.slug, 'scores');
          if (!data?.tournament || !data.pageEnabled) continue;
          const liveCount = data.games.filter(
            g => g.status !== 'cancelled' && isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now),
          ).length;
          if (liveCount > 0) {
            return { ...base, context: { text: `Live now · ${t.name}`, live: true, offSeason: false } };
          }
        } catch { /* skip this event's live check */ }
      }
      // An event is on today (window includes today) but nothing live this moment.
      if (inProgress.length > 0) {
        return { ...base, context: { text: `Today · ${inProgress[0].name}`, live: false, offSeason: false } };
      }
      // Next upcoming event.
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const range = formatDateRange(next.startDate, next.endDate);
        return { ...base, context: { text: `Next · ${next.name}${range ? ` · ${range}` : ''}`, live: false, offSeason: false } };
      }
      // Off-season (cards persist — the year-round promise).
      return base;
    }),
  );
  return cards;
}
