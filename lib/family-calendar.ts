import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { hashNoLoginToken } from './no-login-token';
import { GUARDIAN_TIER_ENABLED } from './family-guardian';
import { getFamilyReach } from './family-access';
import { teamKey } from './family-link-reach';
import { familyTeamSchedule, HIDDEN } from './family-team-schedule';
import { calendarLinkSecret, coachFeedUrl, signCoachCalendarToken, verifyCoachCalendarToken } from './coach-calendar-link';
import { teamFeedEntries } from './export/team-feed-words';
import type { ICSInstantEventInput } from './export/ics';
import { FAMILY_HOME_WORDS } from './family-home-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A PARENT'S ONE CALENDAR ADDRESS (Signed-in family accounts Stage 4a, Part 7; ruling 6; drawing tab 6). One address per
 * parent (`family_calendar_feeds`, mig 453), every team each of the parent's live connections reaches, of both kinds.
 *
 *   · MINTED ONLY FROM THE SIGNED-IN FAMILY PAGE ("Make my link"). The address is SIGNED, so it is shown again on every visit
 *     (the coach's link's recipe, lib/coach-calendar-link.ts, in its own `family-calendar` domain): the row's id at generation
 *     0 and an HMAC. `token_hash` keeps the address's fingerprint as the table asks; nothing reads the address back from it.
 *   · "Stop this calendar" ends the row at once (`stopped_at`). Making one again makes a NEW row, so a new address; the old one
 *     answers an EMPTY calendar for ever (F10: its events leave the subscriber's calendar), never a revived one.
 *   · Asked on every read: what the parent reaches NOW (`getFamilyReach`), so a season close, a move, a leave or a club's
 *     removal changes what it serves by itself, and it goes empty when nothing is reached (the S6 empty-calendar answer).
 *   · EVENTS ARE TITLED BY TEAM ("Otters · Practice", the feed recipe F1), NEVER BY CHILD: the feed carries no child's name.
 *   · While the guardian tier is off a good address answers an empty calendar (nothing can be minted then).
 * The per-link feed (`family_links.calendar_token_hash`) still answers its existing dev tokens at the same route; it is noted
 * for a drop in the Stage 4a closeout.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const DOMAIN = 'family-calendar' as const;

export type MakeFeedResult = { ok: true; url: string } | { ok: false; reason: 'not_set_up' };

function feedUrl(origin: string, feedId: string, secret: string): string {
  return coachFeedUrl(origin, signCoachCalendarToken(feedId, 0, secret, DOMAIN), DOMAIN);
}

async function liveFeedId(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('family_calendar_feeds')
    .select('id').eq('user_id', userId).is('stopped_at', null).maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/** The parent's live address, or null (none made, or stopped). */
export async function familyFeedUrl(userId: string, origin: string): Promise<string | null> {
  if (!GUARDIAN_TIER_ENABLED) return null;
  const secret = calendarLinkSecret();
  if (!secret) return null;
  const id = await liveFeedId(userId);
  return id ? feedUrl(origin, id, secret) : null;
}

/** Make my link: the live address, made if there is none (pressing twice gives the same one). */
export async function makeFamilyFeed(userId: string, origin: string): Promise<MakeFeedResult> {
  const secret = calendarLinkSecret();
  if (!secret) return { ok: false, reason: 'not_set_up' };
  const existing = await liveFeedId(userId);
  if (existing) return { ok: true, url: feedUrl(origin, existing, secret) };
  const id = crypto.randomUUID();
  const token = signCoachCalendarToken(id, 0, secret, DOMAIN);
  const { error } = await supabaseAdmin.from('family_calendar_feeds')
    .insert({ id, user_id: userId, token_hash: hashNoLoginToken(token) });
  if (error) {
    // Two presses at once: the one live row per parent (a unique index) keeps the first.
    if ((error as { code?: string }).code === '23505') {
      const winner = await liveFeedId(userId);
      if (winner) return { ok: true, url: feedUrl(origin, winner, secret) };
    }
    throw error;
  }
  return { ok: true, url: coachFeedUrl(origin, token, DOMAIN) };
}

/** Stop this calendar: ends the live address at once. */
export async function stopFamilyFeed(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('family_calendar_feeds')
    .update({ stopped_at: new Date().toISOString() }).eq('user_id', userId).is('stopped_at', null);
  if (error) throw error;
}

/** Is this the shape of a parent's address (rather than an older per-link token)? */
export function isFamilyFeedToken(raw: string): boolean {
  return /^[A-Za-z0-9_-]{22}\.[0-9a-z]{1,7}\.[A-Za-z0-9_-]{22}(\.ics)?$/i.test(raw);
}

export type FamilyFeedAnswer =
  | { kind: 'refused' }
  | { kind: 'calendar'; calendarName: string; entries: ICSInstantEventInput[] };

/** The feed: refused (an address we never issued), or a calendar — empty when stopped or nothing is reached. */
export async function readFamilyFeed(raw: string): Promise<FamilyFeedAnswer> {
  const secret = calendarLinkSecret();
  const named = secret ? verifyCoachCalendarToken(raw, secret, DOMAIN) : null;
  if (!named || named.generation !== 0) return { kind: 'refused' };
  const { data, error } = await supabaseAdmin.from('family_calendar_feeds')
    .select('id, user_id, stopped_at').eq('id', named.membershipId).maybeSingle();
  if (error) throw error;
  const feed = data as { id: string; user_id: string; stopped_at: string | null } | null;
  if (!feed) return { kind: 'refused' };
  const calendarName = FAMILY_HOME_WORDS.calendar.feedName;
  if (feed.stopped_at || !GUARDIAN_TIER_ENABLED) return { kind: 'calendar', calendarName, entries: [] };

  const reach = await getFamilyReach(feed.user_id);
  const teams = new Map<string, { kind: 'rep' | 'league'; teamId: string }>();
  for (const r of reach) for (const t of r.teams) teams.set(teamKey(t.kind, t.teamId), t);
  const schedules = await Promise.all([...teams.values()].map(t => familyTeamSchedule(t.kind, t.teamId)));
  const entries: ICSInstantEventInput[] = [];
  for (const s of schedules) {
    if (!s || s === HIDDEN) continue;
    entries.push(...teamFeedEntries({ teamName: s.teamName, sport: s.sport, reader: 'family', events: s.entries }));
  }
  return { kind: 'calendar', calendarName, entries };
}
