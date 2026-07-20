import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getTournamentsByOrg } from './db';
import { getPublicTournamentPageData } from './public-tournament-data';
import { getFollowedTeamsForUser, getFollowedTournamentsForUser, getFollowedOrgsForUser } from './fan-follows';
import { getBasicCoachTournamentTeamsForUserCached } from './basic-coach-teams';
import { getUserAccessContexts, type UserAccessContext } from './user-contexts';
import { getOrgFollowRollups } from './entity-follow-status';
import { resolveFollowableOrgsBySlugs } from './directory';
import {
  isGameLive,
  gameStartMs,
  isGameUpcoming,
  publicGameStatus,
  opponentNameFor,
  teamScoreFor,
  DEFAULT_GAME_DURATION_MINUTES,
} from './game-status';
import { tournamentToday } from './timezone';
import { formatTime, relativeDayLabel } from './utils';
import { dayOffset, strongerReason, PAST_WINDOW_DAYS } from './scores-view';
import type {
  ScoresReason,
  ScoresGameRow,
  ScoresEvent,
  ScoresOrgTile,
  ScoresPayload,
} from './scores-view';
import type { Game } from './types';

/**
 * lib/scores-feed.ts — server-side union resolver for the Unified Home Scores tab
 * (Phase 3). Aggregates the account's memberships (coached teams, tournaments they
 * run/officiate) with its fan follows, deduped with a reason chip (a coach sees their
 * team WITHOUT following it; a membership chip beats "Following").
 *
 * It reuses the exact one-fetch-per-tournament batching the Following feed uses
 * (getPublicTournamentPageData, here in the narrow 'scores' section — games + teams only),
 * so a followed/coached team's
 * tournament being unpublished/canceled drops out cleanly — no dead rows. From each
 * tournament's public schedule it builds BOTH lanes: full My-Games rows for the watched
 * teams, and an event rollup (live/today/next) for the My-Events grid.
 */

/** How long a finished event lingers in Scores before it drops to All following → Past
 *  (design R2-1: a completed event stays one week after it ends, then leaves Scores). */
const COMPLETED_GRACE_DAYS = 7;

/** Bound the staff/official event scan so a big organizer can't turn Scores into a heavy
 *  fan-out. Well above any realistic count of concurrently-relevant tournaments; a log
 *  fires (never a silent truncation) if it's ever hit. */
const MAX_STAFF_EVENTS = 40;

/** One watched team: a team you coach or follow, resolved to its public tournament. */
interface WatchedTeam {
  teamId: string;
  teamName: string;
  orgSlug: string;
  tournamentSlug: string;
  reason: Extract<ScoresReason, 'coach' | 'following'>;
}

/** One watched event with no watched team in it: you run/officiate it (staff/official) or you
 *  follow the WHOLE event as a fan ('following' — F4: adds an event tile, never My-Games rows). */
interface WatchedEvent {
  orgSlug: string;
  tournamentSlug: string;
  reason: Extract<ScoresReason, 'staff' | 'official' | 'following'>;
}

/** Build one Scores org rollup tile per followed org (F4) from the shared Home rollup, dropping
 *  off-season orgs (Home holds the durable card) — Scores shows an org only while something's on. */
async function buildOrgTiles(
  orgs: Array<{ orgSlug: string; orgId: string; orgName: string; logoUrl: string | null }>,
): Promise<ScoresOrgTile[]> {
  if (orgs.length === 0) return [];
  const rollups = await getOrgFollowRollups(orgs);
  return rollups
    .filter(r => !r.context.offSeason)
    .map(r => ({
      key: `org:${r.orgSlug}`,
      orgSlug: r.orgSlug,
      orgName: r.orgName,
      href: r.href,
      logoUrl: r.logoUrl,
      fragment: r.context.text,
      live: r.context.live,
    }));
}

const tournamentKey = (orgSlug: string, tournamentSlug: string) => `${orgSlug}/${tournamentSlug}`;

/** A completed event still inside its Scores grace window — the one definition of "recently
 *  ended enough to keep showing" shared by the staff/official prefilter and the tile drop check. */
function withinCompletedGrace(endDate: string | null | undefined, today: string): boolean {
  return endDate != null && dayOffset(endDate, today) >= -COMPLETED_GRACE_DAYS;
}

/** Resolve a set of tournament ids to their public (org slug, tournament slug, name,
 *  logo) — skipping canceled orgs. A non-public tournament left in is harmless: its
 *  later schedule fetch returns null and the entry drops, exactly like the follow feed. */
async function resolveTournamentSlugs(
  tournamentIds: string[],
): Promise<Map<string, { orgSlug: string; tournamentSlug: string }>> {
  const out = new Map<string, { orgSlug: string; tournamentSlug: string }>();
  if (tournamentIds.length === 0) return out;

  const { data: tournRows } = await supabaseAdmin
    .from('tournaments')
    .select('id, slug, org_id, status')
    .in('id', tournamentIds);
  const tourns = (tournRows ?? []) as Array<{ id: string; slug: string; org_id: string; status: string }>;
  // Only public statuses can ever render a schedule (getPublicContext filters the same set).
  const publicTourns = tourns.filter(t => t.status === 'active' || t.status === 'completed');
  if (publicTourns.length === 0) return out;

  const orgIds = Array.from(new Set(publicTourns.map(t => t.org_id).filter(Boolean)));
  const { data: orgRows } = orgIds.length > 0
    ? await supabaseAdmin.from('organizations').select('id, slug, subscription_status').in('id', orgIds)
    : { data: [] };
  const orgById = new Map(
    ((orgRows ?? []) as Array<{ id: string; slug: string; subscription_status: string | null }>)
      .filter(o => o.subscription_status !== 'canceled')
      .map(o => [o.id, o] as const),
  );

  for (const t of publicTourns) {
    const org = orgById.get(t.org_id);
    if (org) out.set(t.id, { orgSlug: org.slug, tournamentSlug: t.slug });
  }
  return out;
}

/** The tournament-registration teams this user coaches (Basic coach floor), resolved to
 *  their public tournaments. A coached team surfaces in My Games without a follow. */
async function resolveCoachedTeams(userId: string, email: string | null | undefined): Promise<WatchedTeam[]> {
  // Request-cached: getUserAccessContexts (run concurrently on the same request) resolves the
  // same basic-coach scan for the same (userId, email), so React cache() dedupes it to one pass.
  const teams = await getBasicCoachTournamentTeamsForUserCached(userId, email ?? null);
  const regs = teams
    .flatMap(t => t.registrations)
    // Drop rejected registrations — a declined team is not a live "Coach" relationship and must
    // not linger as a Coach event tile (pending/waitlisted still surface: the coach IS registered).
    .filter((r): r is typeof r & { tournamentId: string } => Boolean(r.tournamentId) && r.status !== 'rejected');
  if (regs.length === 0) return [];

  const slugs = await resolveTournamentSlugs(Array.from(new Set(regs.map(r => r.tournamentId))));
  const out: WatchedTeam[] = [];
  for (const r of regs) {
    const t = slugs.get(r.tournamentId);
    if (!t) continue;
    out.push({ teamId: r.id, teamName: r.name, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug, reason: 'coach' });
  }
  return out;
}

/** Tournaments the user runs (org admin) or officiates, bounded to the events that are
 *  currently relevant — active, or completed within the grace week. These populate the
 *  My Events grid only (an admin/official has no single "my team" for the My Games lane). */
async function resolveStaffOfficialEvents(
  contexts: UserAccessContext[],
  today: string,
): Promise<WatchedEvent[]> {
  // One reason per org (an org you administer AND officiate is just "staff" here).
  const orgReason = new Map<string, { orgId: string; orgSlug: string; reason: WatchedEvent['reason'] }>();
  for (const ctx of contexts) {
    if (!ctx.orgId || !ctx.orgSlug) continue;
    const reason: WatchedEvent['reason'] | null =
      ctx.kind === 'organization' ? 'staff' : ctx.kind === 'tournament_official' ? 'official' : null;
    if (!reason) continue;
    const existing = orgReason.get(ctx.orgId);
    if (!existing || (existing.reason === 'official' && reason === 'staff')) {
      orgReason.set(ctx.orgId, { orgId: ctx.orgId, orgSlug: ctx.orgSlug, reason });
    }
  }
  if (orgReason.size === 0) return [];

  const perOrg = await Promise.all(
    Array.from(orgReason.values()).map(async ({ orgId, orgSlug, reason }) => {
      try {
        const tournaments = await getTournamentsByOrg(orgId, { admin: true });
        return tournaments
          // Currently relevant only: active, or completed and ended within the grace week.
          // Drafts/archived and long-finished events never clutter the consumer Scores tab.
          .filter(t => {
            if (t.status === 'active') return true;
            if (t.status === 'completed') return withinCompletedGrace(t.endDate, today);
            return false;
          })
          .map(t => ({ orgSlug, tournamentSlug: t.slug, reason }) as WatchedEvent);
      } catch {
        return [] as WatchedEvent[]; // one org's lookup failing must not blank the lane
      }
    }),
  );

  const events = perOrg.flat();
  if (events.length > MAX_STAFF_EVENTS) {
    console.warn(`[scores-feed] staff/official events capped at ${MAX_STAFF_EVENTS} (had ${events.length})`);
    return events.slice(0, MAX_STAFF_EVENTS);
  }
  return events;
}

/** Rollup aggregate for one tournament's My-Events tile, across ALL its games. */
function buildEventTile(
  data: NonNullable<Awaited<ReturnType<typeof getPublicTournamentPageData>>>,
  key: string,
  reason: ScoresReason,
  today: string,
  now: Date,
): ScoresEvent | null {
  const tournament = data.tournament;
  if (!tournament) return null;
  const orgSlug = data.organization.slug;
  const games = data.games.filter(g => g.status !== 'cancelled');

  let liveCount = 0;
  let todayCount = 0;
  let nextGame: Game | null = null;
  let nextMs = Infinity;
  let lastPlayedDate: string | null = null; // most recent game date (for grace + completed label)

  for (const g of games) {
    const dur = g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES;
    if (isGameLive(g, dur, now)) liveCount++;
    if (g.date === today) todayCount++;
    if (g.date && (!lastPlayedDate || g.date > lastPlayedDate)) lastPlayedDate = g.date;
    if (g.status === 'scheduled' && (gameStartMs(g) == null ? g.date >= today : isGameUpcoming(g, now))) {
      const ms = gameStartMs(g) ?? Date.parse(`${g.date}T12:00:00Z`);
      if (ms < nextMs) { nextMs = ms; nextGame = g; }
    }
  }

  const hasUpcoming = nextGame != null || games.some(g => g.date >= today && g.status === 'scheduled');
  const group: ScoresEvent['group'] = liveCount > 0 ? 'live' : hasUpcoming ? 'upcoming' : 'completed';

  // Grace: a finished event lingers a week after it ends, then leaves Scores entirely.
  const endDate = tournament.endDate ?? lastPlayedDate;
  if (group === 'completed' && !withinCompletedGrace(endDate, today)) return null;

  // Ordering bands: live (0) < every upcoming (1e15 + soonest-first) < every completed
  // (2e15 + most-recent-first). The 1e15 gap dwarfs any real epoch-ms time value, so a
  // completed event can NEVER rank ahead of an upcoming one (binding "completed always last").
  let fragment: string;
  let sortMs: number;
  if (group === 'live') {
    fragment = `${liveCount} live`;
    sortMs = 0;
  } else if (group === 'upcoming') {
    if (todayCount > 0) {
      fragment = `${todayCount} today`;
    } else if (nextGame) {
      const when = [relativeDayLabel(nextGame.date, today), nextGame.time ? formatTime(nextGame.time) : null]
        .filter(Boolean)
        .join(' · ');
      fragment = `Next: ${when || 'scheduled'}`;
    } else {
      fragment = 'Scheduled';
    }
    // Soonest next game first; a tournament with no resolvable next game sinks to the band's end.
    sortMs = 1e15 + (Number.isFinite(nextMs) ? nextMs : 1e13);
  } else {
    const label = endDate ? relativeDayLabel(endDate, today) : null;
    fragment = label ? `Completed · ${label}` : 'Completed';
    // Completed always last; most-recently-ended first within the completed block.
    sortMs = 2e15 - (endDate ? Date.parse(`${endDate}T12:00:00Z`) : 0);
  }

  return {
    key,
    orgSlug,
    tournamentSlug: tournament.slug,
    name: tournament.name,
    href: `/${orgSlug}/${tournament.slug}`,
    logoUrl: tournament.logoUrl ?? data.organization.logoUrl ?? null,
    reason,
    group,
    fragment,
    liveCount,
    sortMs,
  };
}

/** Core builder shared by the signed-in (session) and signed-out (device follows) paths. */
async function buildScoresPayload(params: {
  signedIn: boolean;
  watchedTeams: WatchedTeam[];
  watchedEvents: WatchedEvent[];
  orgTiles: ScoresOrgTile[];
}): Promise<ScoresPayload> {
  const today = tournamentToday();
  const now = new Date();

  // Dedupe watched teams by (org, tournament, team); the stronger reason (coach) wins.
  const teamByKey = new Map<string, WatchedTeam>();
  for (const t of params.watchedTeams) {
    const k = `${tournamentKey(t.orgSlug, t.tournamentSlug)}/${t.teamId}`;
    const prev = teamByKey.get(k);
    if (!prev) teamByKey.set(k, t);
    else teamByKey.set(k, { ...prev, reason: strongerReason(prev.reason, t.reason) as WatchedTeam['reason'] });
  }
  const watchedTeams = Array.from(teamByKey.values());

  // The strongest reason we hold per tournament (drives the event tile's chip).
  const eventReason = new Map<string, ScoresReason>();
  const note = (key: string, reason: ScoresReason) => {
    const prev = eventReason.get(key);
    eventReason.set(key, prev ? strongerReason(prev, reason) : reason);
  };
  for (const t of watchedTeams) note(tournamentKey(t.orgSlug, t.tournamentSlug), t.reason);
  for (const e of params.watchedEvents) note(tournamentKey(e.orgSlug, e.tournamentSlug), e.reason);

  const uniqueKeys = Array.from(eventReason.keys());
  if (uniqueKeys.length === 0) {
    // No watched teams/events, but org tiles can still populate the grid on their own.
    return { signedIn: params.signedIn, today, events: [], games: [], orgTiles: params.orgTiles, liveCount: 0 };
  }

  // One schedule fetch per unique tournament, shared across every watched team/event in it.
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

  // ── My Games rows: every watched team's games (cancelled excluded) within a bounded
  //    look-back. A team plays few games, so returning them all is cheap; the client caps
  //    the initial view and reveals the rest via Show earlier/later. ──────────────────
  const games: ScoresGameRow[] = [];
  for (const t of watchedTeams) {
    const data = dataByKey.get(tournamentKey(t.orgSlug, t.tournamentSlug));
    // !pageEnabled = the organizer hid the public schedule page — honor that gate here too
    // (games are already forced empty upstream; skipping keeps the intent explicit).
    if (!data || !data.tournament || !data.pageEnabled) continue;
    const requireFinalization = data.organization.requireScoreFinalization ?? true;
    const teamName = data.teams.find(tm => tm.id === t.teamId)?.name ?? t.teamName;
    const href = `/${t.orgSlug}/${t.tournamentSlug}`;

    for (const g of data.games) {
      if (g.status === 'cancelled') continue;
      if (g.homeTeamId !== t.teamId && g.awayTeamId !== t.teamId) continue;
      if (!g.date) continue;
      const offset = dayOffset(g.date, today);
      const dur = g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES;
      const state = publicGameStatus(g, dur, requireFinalization, now);
      if (state === 'cancelled') continue;
      const live = state === 'live';
      // Drop stale results older than the look-back floor (a fixed multiple of the initial
      // window) so an old event doesn't ship an unbounded results tail; live/upcoming always stay.
      if (!live && offset < -PAST_WINDOW_DAYS * 4) continue;

      const score = teamScoreFor(g, t.teamId);
      games.push({
        key: `${t.teamId}:${g.id}`,
        gameId: g.id,
        teamId: t.teamId,
        teamName,
        opponentName: opponentNameFor(g, t.teamId, data.teams),
        orgSlug: t.orgSlug,
        tournamentSlug: t.tournamentSlug,
        tournamentName: data.tournament.name,
        href: `${href}/schedule/${g.id}`,
        state: state === 'live' ? 'live' : state === 'unofficial' ? 'unofficial' : state === 'final' ? 'final' : 'upcoming',
        live,
        myScore: score.my,
        oppScore: score.opp,
        date: g.date,
        dayOffset: offset,
        dayLabel: relativeDayLabel(g.date, today),
        timeLabel: state === 'upcoming' && g.time ? formatTime(g.time) : null,
        location: g.location || null,
        reason: t.reason,
        sortMs: gameStartMs(g) ?? Date.parse(`${g.date}T12:00:00Z`),
      });
    }
  }

  // ── My Events tiles: one per unique tournament (grace-dropped completed events removed). ──
  const events: ScoresEvent[] = [];
  for (const key of uniqueKeys) {
    const data = dataByKey.get(key);
    // A hidden schedule page empties games upstream, which would otherwise misclassify a live/
    // upcoming event as "completed" and still leak a name/logo tile — skip it entirely so the
    // organizer's "hide schedule" choice is honored on Scores too (matches the games loop).
    if (!data || !data.tournament || !data.pageEnabled) continue;
    const tile = buildEventTile(data, key, eventReason.get(key)!, today, now);
    if (tile) events.push(tile);
  }
  events.sort((a, b) => a.sortMs - b.sortMs || a.name.localeCompare(b.name));

  return {
    signedIn: params.signedIn,
    today,
    events,
    games,
    orgTiles: params.orgTiles,
    liveCount: games.filter(g => g.live).length,
  };
}

/** Signed-in Scores union — memberships (coached teams + run/officiated events) ∪ follows
 *  (teams → My Games rows + event tiles; whole tournaments → event tiles only; orgs → org tiles). */
export async function getScoresFeedForUser(user: { id: string; email?: string | null }): Promise<ScoresPayload> {
  const today = tournamentToday();
  const [follows, followedTournaments, followedOrgs, coached, contexts] = await Promise.all([
    getFollowedTeamsForUser(user.id),
    getFollowedTournamentsForUser(user.id),
    getFollowedOrgsForUser(user.id),
    resolveCoachedTeams(user.id, user.email),
    getUserAccessContexts({ id: user.id, email: user.email }),
  ]);
  const staffOfficialEvents = await resolveStaffOfficialEvents(contexts, today);

  const followedTeams: WatchedTeam[] = follows.map(f => ({
    teamId: f.teamId,
    teamName: f.teamName,
    orgSlug: f.orgSlug,
    tournamentSlug: f.tournamentSlug,
    reason: 'following',
  }));

  // Whole-event follows → event tiles only (F4: never My-Games rows). The eventReason strongerReason
  // merge means a tournament also coached/staffed/team-followed keeps its stronger chip.
  const wholeEventFollows: WatchedEvent[] = followedTournaments.map(t => ({
    orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug, reason: 'following',
  }));

  // F4/F6: an org the user works for (admin, official, OR coach) never gets an org tile — its events
  // already surface via that role. Same predicate the Home Organizations section uses (any non-fan
  // context), so the two surfaces agree on which orgs are "staffed".
  const staffedOrgSlugs = new Set(
    contexts.filter(c => c.kind !== 'fan' && c.orgSlug).map(c => c.orgSlug!),
  );
  const orgTiles = await buildOrgTiles(
    followedOrgs
      .filter(o => !staffedOrgSlugs.has(o.orgSlug))
      .map(o => ({ orgSlug: o.orgSlug, orgId: o.orgId, orgName: o.orgName, logoUrl: o.logoUrl })),
  );

  return buildScoresPayload({
    signedIn: true,
    watchedTeams: [...coached, ...followedTeams],
    watchedEvents: [...staffOfficialEvents, ...wholeEventFollows],
    orgTiles,
  });
}

/** Signed-out Scores — the device's local follows only (public data), no memberships. */
export async function getScoresFeedForDeviceFollows(
  teams: Array<{ teamId: string; teamName: string; orgSlug: string; tournamentSlug: string }>,
  tournaments: Array<{ orgSlug: string; tournamentSlug: string }> = [],
  orgSlugs: string[] = [],
): Promise<ScoresPayload> {
  const watchedTeams: WatchedTeam[] = teams.map(t => ({ ...t, reason: 'following' }));
  const watchedEvents: WatchedEvent[] = tournaments.map(t => ({ ...t, reason: 'following' }));

  // Resolve device org slugs → followable orgs (drops private/canceled), then build tiles.
  const orgTiles = await buildOrgTiles(await resolveFollowableOrgsBySlugs(orgSlugs));

  return buildScoresPayload({ signedIn: false, watchedTeams, watchedEvents, orgTiles });
}
