import 'server-only';
import { supabaseAdmin } from './supabase-admin';
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
 * The follower payload is TEAM-LEVEL ONLY — schedule, results, venue. There is no player
 * field in `FamilyScheduleEntry` at all, because the tier boundary is a security boundary
 * and the cheapest way to guarantee a follower cannot reach child data is for the shape
 * they receive to have nowhere to put it. The guardian payload (Slice 2) will be a
 * SEPARATE type that adds the player allow-list; it must never be added to this one.
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
  arrivalTime: string | null;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  /** Scores appear on COMPLETED games only — an upcoming row carrying 0–0 would read
   *  as a result that has not happened. */
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  status: 'scheduled' | 'cancelled';
  /**
   * Is this game OVER? Computed once, server-side, and carried on the DTO so no surface can
   * hold a second opinion. Two client-side definitions of "completed" previously disagreed:
   * one counted a recorded result, the other a recorded score, and a row with a result but
   * no scores (a forfeit synced from a tournament, where the three columns are independently
   * nullable) read as finished on one surface and upcoming on the other.
   */
  completed: boolean;
  /**
   * Are BOTH scores present, i.e. is there a score to render? Deliberately separate from
   * `completed`: a forfeit is over but has no scoreboard, and rendering one from two nulls
   * produced a literal "null–null".
   */
  hasScore: boolean;
  /** True when the coach has shared this specific game — the family view links to the
   *  shareable page only where one exists. */
  shared: boolean;
  /** The row the list opens at. Exactly one entry carries this. */
  isNextUp: boolean;
}

export interface FamilyTeamView {
  repTeamId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  teamName: string;
  teamSlug: string;
  seasonName: string | null;
  seasonYear: number | null;
  scheduleVisibility: ScheduleVisibility;
  entries: FamilyScheduleEntry[];
  /** Season record, computed from completed games — the "12–6–2" in the mockup header. */
  record: { wins: number; losses: number; ties: number };
}

const EVENT_COLUMNS =
  'id, event_type, name, starts_at, ends_at, location, location_address, field_number, ' +
  'arrival_time, opponent, home_away, team_score, opponent_score, result, status, family_shared_at';

interface EventRow {
  id: string;
  event_type: string;
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
  family_shared_at: string | null;
}

/** A game is "completed" for display purposes when a result OR a score was recorded. We do
 *  NOT infer completion from the clock: a game that started an hour ago but has no score yet
 *  is still an upcoming row as far as a family is concerned, and inventing 0–0 for it
 *  would be worse than saying nothing. */
function isCompleted(row: EventRow): boolean {
  return row.result !== null || row.team_score !== null || row.opponent_score !== null;
}

/** Both scores present — the only condition under which a scoreboard may be drawn. The three
 *  score columns are independently nullable (a tournament-mirrored forfeit can set `result`
 *  alone), so "over" and "has a score" are genuinely different questions. */
function hasScore(row: EventRow): boolean {
  return row.team_score !== null && row.opponent_score !== null;
}

function toEntry(row: EventRow, nextUpId: string | null): FamilyScheduleEntry {
  const completed = isCompleted(row);
  const scored = hasScore(row);
  return {
    completed,
    hasScore: scored,
    id: row.id,
    eventType: row.event_type,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    locationAddress: row.location_address,
    fieldNumber: row.field_number,
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
    shared: !!row.family_shared_at,
    isNextUp: row.id === nextUpId,
  };
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
function findNextUpId(rows: EventRow[]): string | null {
  const now = Date.now();
  const upcoming = rows
    .filter(r => r.status !== 'cancelled' && !isCompleted(r) && new Date(r.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0]?.id ?? null;
}

/** Event types that can carry a result. A practice must never reach the win/loss record —
 *  the coach UI only offers scoring on games, but the events API has no server-side type
 *  guard, so a future caller could set one and silently skew a family-facing record. */
const RESULT_BEARING_TYPES = new Set([
  'league_game', 'tournament_game', 'scrimmage', 'external_tournament',
]);

function computeRecord(rows: EventRow[]): { wins: number; losses: number; ties: number } {
  let wins = 0, losses = 0, ties = 0;
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    if (!RESULT_BEARING_TYPES.has(row.event_type)) continue;
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
    .select('id, org_id, name, slug, schedule_visibility, is_archived')
    .eq('id', params.repTeamId)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!teamRow) return null;

  const team = teamRow as {
    id: string; org_id: string; name: string; slug: string;
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
      .in('status', ['active', 'draft'])
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

  const { data: eventRows, error: eventError } = await supabaseAdmin
    .from('rep_team_events')
    .select(EVENT_COLUMNS)
    .eq('team_id', params.repTeamId)
    .eq('program_year_id', year.id)
    .order('starts_at', { ascending: true });
  if (eventError) throw eventError;

  const rows = (eventRows ?? []) as unknown as EventRow[];
  const nextUpId = findNextUpId(rows);

  return {
    repTeamId: team.id,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    teamName: team.name,
    teamSlug: team.slug,
    seasonName: year.name,
    seasonYear: year.year,
    scheduleVisibility: visibility,
    entries: rows.map(row => toEntry(row, nextUpId)),
    record: computeRecord(rows),
  };
}

// ── A single shared game (1.8) ─────────────────────────────────────────────────

export interface FamilyGameView {
  id: string;
  orgSlug: string;
  orgName: string;
  teamName: string;
  teamSlug: string;
  opponent: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
  startsAt: string;
  location: string | null;
  locationAddress: string | null;
  fieldNumber: string | null;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  status: 'scheduled' | 'cancelled';
  /** The game is over (a result or a score was recorded). Drives the "Final" pill. */
  isFinal: boolean;
  /** BOTH scores are present, so a scoreboard can be drawn. A forfeit is `isFinal` without
   *  being `hasScore` — conflating the two rendered a literal "null–null". */
  hasScore: boolean;
}

/**
 * One game's public page — the grandparent screen.
 *
 * Three conditions, ALL required: the team is not `staff`, the event is a game, and the
 * coach explicitly shared THIS game. Decision #15 kept the URL plain rather than
 * tokenized because the page shows what the scoreboard at the field shows; what keeps it
 * honest is that it does not exist until a coach decides it should, and stops existing
 * the moment they close the team down to Staff only.
 *
 * There is no player field on this type. There never is one.
 */
export async function getSharedGameView(params: {
  repTeamId: string;
  eventId: string;
}): Promise<FamilyGameView | null> {
  // The event is keyed on (eventId, teamId) and the team on teamId — neither needs the
  // other's result, so they run together. This is a PUBLIC page; the round-trip saved is
  // paid by every visitor a coach shares a game with.
  const [eventResult, teamResult] = await Promise.all([
    supabaseAdmin
      .from('rep_team_events')
      .select(`${EVENT_COLUMNS}, team_id, org_id`)
      .eq('id', params.eventId)
      .eq('team_id', params.repTeamId)
      .maybeSingle(),
    supabaseAdmin
      .from('rep_teams')
      .select('id, org_id, name, slug, schedule_visibility, is_archived')
      .eq('id', params.repTeamId)
      .maybeSingle(),
  ]);
  if (eventResult.error) throw eventResult.error;
  if (teamResult.error) throw teamResult.error;
  if (!eventResult.data || !teamResult.data) return null;

  const row = eventResult.data as unknown as EventRow & { team_id: string; org_id: string };
  if (!row.family_shared_at) return null;
  if (row.event_type === 'practice') return null;

  const team = teamResult.data as {
    id: string; org_id: string; name: string; slug: string;
    schedule_visibility: string | null; is_archived: boolean;
  };
  if (team.is_archived) return null;
  if (!isVisibleToFamilies(team.schedule_visibility)) return null;

  const { data: orgRow, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('name, slug')
    .eq('id', team.org_id)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!orgRow) return null;
  const org = orgRow as { name: string; slug: string };

  const completed = isCompleted(row);
  const scored = hasScore(row);
  return {
    id: row.id,
    orgSlug: org.slug,
    orgName: org.name,
    teamName: team.name,
    teamSlug: team.slug,
    opponent: row.opponent,
    homeAway: row.home_away,
    startsAt: row.starts_at,
    location: row.location,
    locationAddress: row.location_address,
    fieldNumber: row.field_number,
    teamScore: scored ? row.team_score : null,
    opponentScore: scored ? row.opponent_score : null,
    result: completed ? row.result : null,
    status: row.status,
    isFinal: completed,
    hasScore: scored,
  };
}
