import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { countsTowardRecord } from './season-wrapped';
import { COACH_GAME_EVENT_TYPES } from './coach-tournament-games';
import { repEntryState } from './club-game-live';
import { fetchAll } from './supabase-paging';
import { maskOf, sectionsOf } from './field-parts';
import { LIVE_SEASON_STATUSES } from './season-live';
import { repMarkWords } from './place-closures-server';
import type { MarkWords } from './place-closures';
import {
  isPubliclyVisible,
  isVisibleToFamilies,
  normalizeVisibility,
  type ScheduleVisibility,
} from './family-access';

/**
 * lib/family-view.ts — the READ plane for Chunk D's family layer.
 *
 * `lib/family-access.ts` decides WHO is connected. This file decides WHAT they see, and
 * it does so by ALLOW-LIST: a DTO here names every field that leaves the server, so a
 * column added to `rep_team_events` next month cannot arrive on a family surface by
 * simply existing. That is the difference between a filter (which forgets) and an
 * allow-list (which has to be told).
 *
 * The team payload is TEAM-LEVEL ONLY — schedule, results, venue. There is no player
 * field in `FamilyScheduleEntry` at all, because the tier boundary is a security boundary
 * and the cheapest way to guarantee a team-level reader (the public team page) cannot reach
 * child data is for the shape it receives to have nowhere to put it. The guardian payload
 * is a SEPARATE type that adds the player allow-list; it must never be added to this one.
 */

// ── The one-list schedule (owner ruling #2) ────────────────────────────────────

export interface FamilyScheduleEntry {
  id: string;
  /** 'game' | 'practice' | … — drives the row label, never a section. */
  eventType: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  locationAddress: string | null;
  fieldNumber: string | null;
  /** The part of the field the club booked (0 = whole) and how the field splits (`EventPart`, read with the row).
   *  Absent on a house-league entry (2E). */
  sectionMask?: number;
  fieldSections?: number;
  arrivalTime: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  /** Scores appear on a COMPLETED or LIVE game only — an upcoming row carrying 0–0 would read
   *  as a result that has not happened. */
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  /** 'postponed' only on a house-league game (lib/family-league-entries.ts); a rep team's list has no such state. */
  status: 'scheduled' | 'cancelled' | 'postponed';
  /**
   * Is this game OVER? Computed once, server-side, and carried on the DTO so no surface can
   * hold a second opinion. Two client-side definitions of "completed" previously disagreed:
   * one counted a recorded result, the other a recorded score, and a row with a result but
   * no scores (a forfeit synced from a tournament, where the three columns are independently
   * nullable) read as finished on one surface and upcoming on the other.
   */
  completed: boolean;
  /** Is this game LIVE now (`lib/club-game-live.ts`)? Inside its window and not ended: its score, if any, is the coach's
   *  running score, shown without a result letter. Never true for a practice, a tournament entry, a game copied from a
   *  tournament (its tournament's rule is its truth) or a house-league row. */
  live: boolean;
  /**
   * Are BOTH scores present, i.e. is there a score to render? Deliberately separate from
   * `completed`: a forfeit is over but has no scoreboard, and rendering one from two nulls
   * produced a literal "null–null".
   */
  hasScore: boolean;
  /** The row the list opens at. Exactly one entry carries this. */
  isNextUp: boolean;
  /**
   * The club closed this game's place (Club Website Stage 2, K9): the closed place's words and the game's day while the
   * mark stands, else null. Read HERE, beside the rule that decides who may see the team's games, so a mark reaches exactly
   * the readers its game does (a private team's only its own families) and no page reads it a second way.
   */
  mark: MarkWords | null;
}

export interface FamilyTeamView {
  repTeamId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  teamName: string;
  teamSlug: string;
  /** The team's sport — a calendar entry names the facility in its word ("Diamond 2", Club Tier 6d F5). Team-level. */
  sport: string | null;
  seasonName: string | null;
  seasonYear: number | null;
  scheduleVisibility: ScheduleVisibility;
  entries: FamilyScheduleEntry[];
  /** Season record, computed from completed games — the "12–6–2" in the mockup header. */
  record: { wins: number; losses: number; ties: number };
}

/** What a visitor with no account may read: games and the tournaments the team attends. Never a
 *  practice or a team event — those are the same children at the same place every week, so they stay
 *  with the families the coach connected (owner ruling 2026-10-20). Families get every kind. */
export const PUBLIC_EVENT_TYPES = [...COACH_GAME_EVENT_TYPES, 'external_tournament'];

const EVENT_COLUMNS =
  'id, event_type, is_scrimmage, name, starts_at, ends_at, location, location_address, field_number, ' +
  // The part and its field's split (Stage 2): one foreign key to the facilities, so the embed is unambiguous.
  'arrival_time, opponent, home_away, team_score, opponent_score, result, status, section_mask, facility_split:org_venue_facilities(sections), ' +
  'source_tournament_game_id';

interface EventRow {
  id: string;
  event_type: string;
  is_scrimmage: boolean | null;
  name: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  location_address: string | null;
  field_number: string | null;
  arrival_time: string | null;
  opponent: string | null;
  home_away: 'home' | 'away' | 'neutral' | null;
  team_score: number | null;
  opponent_score: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  status: 'scheduled' | 'cancelled';
  /** Read to tell a game copied from a tournament from one the coach keeps (`repEntryState`); never leaves the server. */
  source_tournament_game_id: string | null;
  section_mask: number | null;
  facility_split: { sections: number | null } | null;
}

/** Is the row over, and is it live? ONE rule (`lib/club-game-live.ts`, Club Website Stage 1 G7): a game is over when the
 *  coach pressed End game (a result), or when its live window has passed with a score saved. Inside the window a score with
 *  no result is the coach's RUNNING score from Game-Day Mode, so the game is live — before G7 any score read as over, and
 *  the row showed a finished tie ("T 4–2") until End game. A game past its window with nothing saved is still not over:
 *  inventing a 0–0 for it would be worse than saying nothing. */
function entryState(row: EventRow, now: number): { completed: boolean; live: boolean } {
  return repEntryState({
    ownGame: COACH_GAME_EVENT_TYPES.includes(row.event_type) && row.source_tournament_game_id === null,
    startsAt: row.starts_at, endsAt: row.ends_at,
    status: row.status, result: row.result, teamScore: row.team_score, opponentScore: row.opponent_score,
  }, now);
}

/** Both scores present — the only condition under which a scoreboard may be drawn. The three
 *  score columns are independently nullable (a tournament-mirrored forfeit can set `result`
 *  alone), so "over" and "has a score" are genuinely different questions. */
function hasScore(row: EventRow): boolean {
  return row.team_score !== null && row.opponent_score !== null;
}

function toEntry(row: EventRow, nextUpId: string | null, now: number, mark: MarkWords | null = null): FamilyScheduleEntry {
  const { completed, live } = entryState(row, now);
  // A score is drawn only on a game that is over or live: a score saved before the start (Game-Day Mode opens early) is
  // not a result, and an upcoming row carrying one would read as a game already played.
  const scored = hasScore(row) && (completed || live);
  return {
    completed,
    live,
    hasScore: scored,
    id: row.id,
    eventType: row.event_type,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    locationAddress: row.location_address,
    fieldNumber: row.field_number,
    sectionMask: maskOf(row.section_mask),
    fieldSections: sectionsOf(row.facility_split?.sections),
    arrivalTime: row.arrival_time,
    opponent: row.opponent,
    homeAway: row.home_away,
    // Deliberately nulled rather than omitted on upcoming rows, so the client cannot
    // render a score it was never given. Gated on `scored`, not `completed`: a finished
    // game with only a result (a forfeit) must not hand the client two nulls to subtract.
    teamScore: scored ? row.team_score : null,
    opponentScore: scored ? row.opponent_score : null,
    result: completed ? row.result : null,
    status: row.status,
    isNextUp: row.id === nextUpId,
    mark: markShown(mark, { live, completed, hasScore: scored }),
  };
}

/**
 * A mark shows only on a game still waiting (K9): one played anyway (live, over, or scored) reads as its score on every
 * surface, never "Place closed". The one rule, so the team page, the family schedule and the club home agree.
 */
export function markShown(mark: MarkWords | null | undefined, e: { live: boolean; completed: boolean; hasScore: boolean }): MarkWords | null {
  return mark && !e.live && !e.completed && !e.hasScore ? mark : null;
}

/**
 * The next upcoming event — the row the list scrolls to on open.
 *
 * This is an INSTANT comparison, and instants are timezone-free: `starts_at` is a
 * timestamptz and `Date.now()` is the same absolute clock, so "has this started?" is
 * correct in every zone. The org-zone helpers exist for CALENDAR-DAY reasoning ("today",
 * "days until"), which is the case that breaks under UTC — none of that happens here.
 * Every zone-sensitive decision on these surfaces is a DISPLAY decision, and display goes
 * through `formatInOrgZone` at the page.
 */
function findNextUpId(rows: EventRow[], now: number): string | null {
  const upcoming = rows
    .filter(r => r.status !== 'cancelled' && !entryState(r, now).completed && new Date(r.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0]?.id ?? null;
}

/* The family's record is THE record — `countsTowardRecord`, the same predicate as the coach's
   masthead. It used to keep its own kind list here (which counted the old `scrimmage` kind, so a
   family read a different W-L than the coach); a practice still never reaches it, because the
   predicate reads the kind before the box. */

function computeRecord(rows: EventRow[]): { wins: number; losses: number; ties: number } {
  let wins = 0, losses = 0, ties = 0;
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    if (!countsTowardRecord({ eventType: row.event_type, isScrimmage: row.is_scrimmage })) continue;
    if (row.result === 'win') wins++;
    else if (row.result === 'loss') losses++;
    else if (row.result === 'tie') ties++;
  }
  return { wins, losses, ties };
}

/**
 * Build the family's view of a team.
 *
 * `requireVisibility` is the enforcement point for owner ruling #4 — it is checked HERE,
 * server-side, on the way to the data, not by the surface deciding whether to draw a
 * button. A team set to `staff` yields null for every family/public caller no matter
 * which route asked.
 */
export async function getFamilyTeamView(params: {
  repTeamId: string;
  /** The minimum visibility this caller satisfies. A signed-in verified family member
   *  passes at `families`; an anonymous caller passes only at `public_link`. */
  requireVisibility: 'families' | 'public_link';
}): Promise<FamilyTeamView | null> {
  const { data: teamRow, error: teamError } = await supabaseAdmin
    .from('rep_teams')
    .select('id, org_id, name, slug, sport, schedule_visibility, is_archived')
    .eq('id', params.repTeamId)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!teamRow) return null;

  const team = teamRow as {
    id: string; org_id: string; name: string; slug: string; sport: string | null;
    schedule_visibility: string | null; is_archived: boolean;
  };
  if (team.is_archived) return null;

  const visibility = normalizeVisibility(team.schedule_visibility);
  if (!isVisibleToFamilies(visibility)) return null;
  if (params.requireVisibility === 'public_link' && !isPubliclyVisible(visibility)) return null;

  // The season and the org depend only on the team row we already have, and on nothing from
  // each other — so they run together. Only the events query has to wait (it needs the
  // season id).
  const [yearResult, orgResult] = await Promise.all([
    // The ACTIVE season only. Family surfaces are live-season by construction — the
    // archive is opt-in and nothing here opted in.
    supabaseAdmin
      .from('rep_program_years')
      .select('id, name, year, status')
      .eq('team_id', params.repTeamId)
      // A team's LIVE season (lib/season-live.ts): draft or active, the newest by year — a Public team's draft season is
      // public (the 2026-09-28 ruling). The club batch (getTeamGameEntriesBetween) reads it the same way.
      .in('status', [...LIVE_SEASON_STATUSES])
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug')
      .eq('id', team.org_id)
      .maybeSingle(),
  ]);
  if (yearResult.error) throw yearResult.error;
  if (orgResult.error) throw orgResult.error;
  if (!yearResult.data || !orgResult.data) return null;
  const year = yearResult.data as { id: string; name: string | null; year: number | null };
  const org = orgResult.data as { id: string; name: string; slug: string };

  let eventQuery = supabaseAdmin
    .from('rep_team_events')
    .select(EVENT_COLUMNS)
    .eq('team_id', params.repTeamId)
    .eq('program_year_id', year.id);
  // The public caller is narrowed at the query, so a practice never leaves the server for it — and
  // "Up next" below is then the next GAME, which is what a visitor came for.
  if (params.requireVisibility === 'public_link') eventQuery = eventQuery.in('event_type', PUBLIC_EVENT_TYPES);
  const { data: eventRows, error: eventError } = await eventQuery.order('starts_at', { ascending: true });
  if (eventError) throw eventError;

  const rows = (eventRows ?? []) as unknown as EventRow[];
  const now = Date.now();
  const nextUpId = findNextUpId(rows, now);
  // The closure marks on these games (K9): one small indexed read; a failed read is no mark (`repMarkWords`).
  // Only games still waiting can carry one (a press marks games; a cancelled or played game never shows it), so a season
  // mostly played asks about few ids, and one with none asks nothing.
  const marks = await repMarkWords(org.id, rows
    .filter(r => COACH_GAME_EVENT_TYPES.includes(r.event_type) && r.status !== 'cancelled' && !entryState(r, now).completed)
    .map(r => r.id));

  return {
    repTeamId: team.id,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    teamName: team.name,
    teamSlug: team.slug,
    sport: team.sport ?? null,
    seasonName: year.name,
    seasonYear: year.year,
    scheduleVisibility: visibility,
    entries: rows.map(row => toEntry(row, nextUpId, now, marks[row.id] ?? null)),
    record: computeRecord(rows),
  };
}

// ── The club's batch (Club Website Stage 1, the one games read) ────────────────────────────

/** A club's rep teams as the public-schedule question needs them: never archived. Throws on a failed read. */
export async function getClubRepTeamsForSchedule(orgId: string): Promise<{ id: string; name: string; slug: string; scheduleVisibility: ScheduleVisibility }[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id, name, slug, schedule_visibility')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('name');
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string; slug: string; schedule_visibility: string | null }[])
    .map(t => ({ id: t.id, name: t.name, slug: t.slug, scheduleVisibility: normalizeVisibility(t.schedule_visibility) }));
}

/**
 * These teams' GAMES in [fromIso, toIso), each from the team's live season, read the way `getFamilyTeamView` reads one
 * team's (the same columns, the same live-season rule, the same row facts), in two reads for every team together. The
 * caller has already asked the public question of each team (`getPublicTeamGamesBetween`, lib/public-team-schedule.ts).
 * Only games: a practice, a team event and a multi-day tournament entry never come out, and neither does a game COPIED
 * from a tournament (`source_tournament_game_id`) — it can be stale, and the club's tournaments reach the home through
 * their own rule. ⚠ Throws on a failed read.
 */
export async function getTeamGameEntriesBetween(teamIds: readonly string[], fromIso: string, toIso: string, now: number = Date.now()): Promise<{ teamId: string; entry: FamilyScheduleEntry }[]> {
  if (!teamIds.length) return [];
  const { data: years, error: yearError } = await supabaseAdmin
    .from('rep_program_years')
    .select('id, team_id, year')
    .in('team_id', [...teamIds])
    .in('status', [...LIVE_SEASON_STATUSES])
    .order('year', { ascending: false });
  if (yearError) throw yearError;
  const liveYear = new Map<string, string>();
  for (const y of (years ?? []) as { id: string; team_id: string }[]) if (!liveYear.has(y.team_id)) liveYear.set(y.team_id, y.id);
  if (!liveYear.size) return [];

  const rows = await fetchAll<EventRow & { team_id: string }>((a, b) => supabaseAdmin
    .from('rep_team_events')
    .select(EVENT_COLUMNS + ', team_id')
    .in('program_year_id', [...liveYear.values()])
    .in('event_type', COACH_GAME_EVENT_TYPES)
    .is('source_tournament_game_id', null)
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso)
    .order('starts_at', { ascending: true })
    .order('id', { ascending: true })
    .range(a, b));
  return rows.map(row => ({ teamId: row.team_id, entry: toEntry(row, null, now) }));
}
