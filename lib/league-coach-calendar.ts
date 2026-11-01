import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { houseLeagueCoachAccess } from './house-league-access';
import { readCoachFeedEvents, readCoachFeedTeam } from './house-league-coach';
import { coachTeamPath } from './house-league-coach-invites';
import { tournamentToday } from './timezone';
import type { ICSInstantEventInput } from './export/ics';
import { teamCalendarName, teamFeedEntries } from './export/team-feed-words';
import {
  calendarLinkSecret,
  shouldRecordCalendarRead,
  verifyCoachCalendarToken,
  type CoachCalendarDomain,
} from './coach-calendar-link';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE COACH'S CALENDAR LINK (House League 9d-3 Part 6, ruling 9d3·5; mig 420) — the rep coach's Subscribe
 * (Club Tier 6d: lib/coach-calendar-feed.ts, lib/coach-membership.ts) for a `league_team_coaches` row.
 *
 *   · THE LINK IS SIGNED, NEVER STORED: the row's id, its generation and an HMAC, in the house-league DOMAIN
 *     (`league-coach-calendar`), so a rep membership's token never reads as one of these. Rebuilt on every open.
 *   · Asked on EVERY read: a link we never issued → `refused` (the counted "not found"); a link we issued that has stopped
 *     — the row removed, its person changed or Reset (the generation moved: mig 420's trigger), never accepted, or the
 *     season no longer live (`houseLeagueCoachAccess` not `open`) → `stopped`, an EMPTY calendar named for the team, so its
 *     events leave the subscriber's calendar; otherwise `live`: the season's games as last sent and its practices
 *     (`readCoachFeedEvents`). Live season only (9d3·5): a finished season's events leave the calendar.
 *   · NO PLAN GATE: none is ruled (an open /strategy packaging question); the coach's page has none either.
 *   · The last read is recorded at most once a day (the owner's 6d cost ruling), on a live read only.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const LEAGUE_COACH_DOMAIN: CoachCalendarDomain = 'league-coach-calendar';

export interface LeagueCoachLink {
  id: string;
  teamId: string;
  userId: string | null;
  acceptedAt: string | null;
  removedAt: string | null;
  generation: number;
  lastReadOn: string | null;
}

const LINK_COLUMNS = 'id, team_id, user_id, accepted_at, removed_at, calendar_link_generation, calendar_last_read_on';
type LinkRow = { id: string; team_id: string; user_id: string | null; accepted_at: string | null; removed_at: string | null; calendar_link_generation: number; calendar_last_read_on: string | null };
const toLink = (r: LinkRow): LeagueCoachLink => ({
  id: r.id, teamId: r.team_id, userId: r.user_id, acceptedAt: r.accepted_at, removedAt: r.removed_at,
  generation: r.calendar_link_generation, lastReadOn: r.calendar_last_read_on,
});

/** This person's live seat on this team (accepted, not removed), or null. */
export async function getOwnLeagueCoachLink(userId: string, teamId: string): Promise<LeagueCoachLink | null> {
  const { data, error } = await supabaseAdmin.from('league_team_coaches').select(LINK_COLUMNS)
    .eq('user_id', userId).eq('team_id', teamId).is('removed_at', null).not('accepted_at', 'is', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle<LinkRow>();
  if (error) throw error;
  return data ? toLink(data) : null;
}

/**
 * Reset: the next generation, the last read cleared. A compare-and-set on the generation the window showed, on a live
 * seat — a double press or a removal landing first answers null.
 */
export async function resetLeagueCoachLink(id: string, expectedGeneration: number): Promise<LeagueCoachLink | null> {
  const { data, error } = await supabaseAdmin.from('league_team_coaches')
    .update({ calendar_link_generation: expectedGeneration + 1, calendar_last_read_on: null })
    .eq('id', id).is('removed_at', null).eq('calendar_link_generation', expectedGeneration)
    .select(LINK_COLUMNS).maybeSingle<LinkRow>();
  if (error) throw error;
  return data ? toLink(data) : null;
}

/** "Read by your calendar today": at most one write a day; the WHERE repeats the question (two racing reads, one day). */
async function recordLeagueCoachRead(id: string, generation: number, day: string): Promise<void> {
  const { error } = await supabaseAdmin.from('league_team_coaches')
    .update({ calendar_last_read_on: day })
    .eq('id', id).eq('calendar_link_generation', generation).is('removed_at', null)
    .or(`calendar_last_read_on.is.null,calendar_last_read_on.lt.${day}`);
  if (error) throw error;
}

export type LeagueCoachFeedAnswer =
  | { kind: 'unconfigured' }
  | { kind: 'refused' }
  | { kind: 'stopped'; calendarName: string }
  | { kind: 'live'; calendarName: string; entries: ICSInstantEventInput[] };

export async function readLeagueCoachFeed(token: string, origin: string): Promise<LeagueCoachFeedAnswer> {
  const secret = calendarLinkSecret();
  if (!secret) return { kind: 'unconfigured' };
  const named = verifyCoachCalendarToken(token, secret, LEAGUE_COACH_DOMAIN);
  if (!named) return { kind: 'refused' };

  const { data, error } = await supabaseAdmin.from('league_team_coaches').select(LINK_COLUMNS).eq('id', named.membershipId).maybeSingle<LinkRow>();
  if (error) throw error;
  const link = data ? toLink(data) : null;
  const team = link ? await readCoachFeedTeam(link.teamId) : null;
  const calendarName = team ? teamCalendarName(team.card.teamName, team.card.orgName) : 'Team schedule';
  if (!link || !team || link.generation !== named.generation || !link.userId) return { kind: 'stopped', calendarName };
  const view = houseLeagueCoachAccess([link], link.userId, link.teamId, team.season);
  if (view !== 'open') return { kind: 'stopped', calendarName };

  const events = await readCoachFeedEvents({
    orgId: team.card.orgId, seasonId: team.seasonId, divisionId: team.divisionId, schedulePublished: team.schedulePublished, teamId: link.teamId,
  });

  const today = tournamentToday();
  if (shouldRecordCalendarRead(link.lastReadOn, today)) {
    // Awaited (Amplify drops work after the response), and never fatal: a feed that answers is worth more than the line.
    await recordLeagueCoachRead(link.id, link.generation, today).catch(e => {
      console.error('[league-coach-calendar] recording the last read failed (the feed still answers):', e);
    });
  }

  // F7 — every entry opens the coach's team page (it has no page per game or practice).
  const page = `${origin.replace(/\/$/, '')}${coachTeamPath(team.card.orgSlug, team.card.seasonSlug, link.teamId)}`;
  return {
    kind: 'live',
    calendarName,
    entries: teamFeedEntries({ teamName: team.card.teamName, sport: null, reader: 'coach', events, linkFor: () => page }),
  };
}
