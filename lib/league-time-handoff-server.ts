import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { notify } from './notify';
import { houseLeagueRunnerUserIds, orgOwnerUserIds } from './notify-recipients';
import { boardNames } from './member-names';
import { HOUSE_LEAGUE } from './club-schedule-holders';
import { FINISHED_LEAGUE_SEASON_STATUSES } from './house-league-access';
import { houseLeagueHeldSince, seasonTimeFacts, usesOf } from './league-time-server';
import { groupLeagueTime, leagueTimeMinutes, partsShapes, partsWords, seasonHoldsSlot, type LeagueTimeSlot } from './league-time';
import { facilityListWords } from './permit-words';
import { weekdayOf } from './permit-time';
import { utcToZonedInputs } from './timezone';
import type { ClubPlaces } from './permit-lookup';
import type { StoredSlot } from './club-schedule-server';
import {
  ASK_AGAIN_DAYS, DAY_MS, TIME_HANDOFF_WORDS as W, timeAskDoor, timeAskHref,
  type LeagueTimeLine, type TimeAsksCard, type TimePiece,
} from './league-time-handoff';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOUSE LEAGUE'S TIME HANDED BETWEEN PEOPLE, SERVER SIDE (Club Tier Stage 13d, Session A). The words, the 7-day rule and the
 * card's door are lib/league-time-handoff.ts.
 *
 * ⚖ TIME GIVEN (A1, A2): a send's change to house league's time is worked out ONCE, in the send's preview, so the Send
 * window's WHO IS TOLD line and the bells read one answer. Given = house league's slots (live, still to come) this send
 * holds that the last send did not; taken back = the last send's that this one no longer holds (moved to a team in place,
 * or removed). The last send's list is `club_schedule_sends.league_slot_ids` (mig 486), written by every Finalize and Send
 * the changes from the schedule itself (`heldHouseLeagueSlotIds`, never from this read, so a failed read here costs a bell,
 * never the next send's baseline). A send from before mig 486 had none, so "given" falls back to time made or handed to
 * house league since that send (`houseLeagueHeldSince`, the house-league half's own read) and nothing reads as taken back.
 *   Each live or getting-ready season whose time it is (`seasonHoldsSlot`, the one rule) hears ONE bell when its time GROWS
 * or SHRINKS, by the TOTAL hours given and taken (/review 2026-11-13: ten Tuesdays given and one taken back is a gain, though
 * both read "1 hour a week"); a move that gives and takes the same hours is no bell (the moved games' and practices' own bell
 * says that). The words say each piece as House league's time window does (`groupLeagueTime` → "2 hours a week").
 *   Recipients: everyone who runs house league (`houseLeagueRunnerUserIds`, the list that hears about moved games), never the
 * sender. Nobody left to tell → no bell and no WHO IS TOLD line. Bell only (13d-1 A): `systemDefaults` keeps email copies off.
 *
 * ⚖ THE ASK (A3, A4, 13d-2 A): `league_season_time_asks` (mig 486, server-only: a season row is public past draft). One per
 * season, again after 7 days, by whoever the one gate lets ask (`askForTime`: a league admin — an owner or an admin GIVES
 * time). It waits on This morning until the season has time (`seasonTimeFacts`, the season line's own answer) or finishes;
 * the send that grows a season's time also deletes it, so an ask answered and later taken back never resurfaces. No Dismiss.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** One season's change of time at a send. `grows`: it gained hours in all (it lost them otherwise; equal is no bell). */
interface SeasonTimeChange { seasonId: string; seasonName: string; grows: boolean; given: TimePiece | null; taken: TimePiece | null }

/** What a Finalize or Send the changes does to house league's time — null for a review or a late bill. */
export interface SendTimeHandoff {
  /** The seasons that hear, who hears, and WHO IS TOLD's line; null when house league gets nothing (or nobody is left to tell). */
  told: { seasons: SeasonTimeChange[]; userIds: string[]; line: LeagueTimeLine } | null;
}

type SeasonRow = { id: string; name: string; status: string; season_start_date: string | null; season_end_date: string | null };
const FINISHED = `(${FINISHED_LEAGUE_SEASON_STATUSES.join(',')})`;

/** House league's slots a schedule holds, still to come: what a send leaves as the next send's baseline (`league_slot_ids`). */
export function heldHouseLeagueSlotIds(slots: readonly StoredSlot[], now: number = Date.now()): string[] {
  return slots.filter(s => !s.removed && s.teamIds.includes(HOUSE_LEAGUE) && Date.parse(s.startsAt) > now).map(s => s.id);
}

/** The club's seasons that can be given time: live or getting ready, in the order they start. */
async function seasonsThatHear(orgId: string): Promise<SeasonRow[]> {
  const rows = await fetchAll<SeasonRow>((a, b) => supabaseAdmin.from('league_seasons')
    .select('id, name, status, season_start_date, season_end_date').eq('org_id', orgId).not('status', 'in', FINISHED)
    .order('id').range(a, b));
  return rows.sort((a, b) => (a.season_start_date ?? '').localeCompare(b.season_start_date ?? '') || a.name.localeCompare(b.name));
}

/** Some slots as the window would say them: a week's minutes (its one figure), the parts in words, the first and last day. */
function pieceOf(slots: readonly LeagueTimeSlot[], places: ClubPlaces): TimePiece | null {
  if (!slots.length) return null;
  const days = slots.map(s => s.day).sort();
  const sources = groupLeagueTime({
    slots, schedules: [{ id: 'send', name: '', startsOn: days[0], endsOn: days[days.length - 1] }], divisions: [],
    placeOf: (v, f) => (f ? places.facilityName.get(f) : null) ?? places.venueName.get(v) ?? '',
    venueOf: v => places.venueName.get(v) ?? '',
  });
  const parts = sources.flatMap(src => src.stretches.flatMap(st => st.rows.flatMap(r => r.parts)));
  // One line per slot shape: the opened notice lists them; `detail` keeps them on one line for the Send window.
  const lines = partsShapes(parts).map(sh => `${sh.when} · ${facilityListWords(sh.places)}`);
  return { minutes: leagueTimeMinutes(sources), detail: partsWords(parts), lines, firstDay: days[0], lastDay: days[days.length - 1] };
}

/** A schedule slot in the window's shape (its club day and clock worked out once), with its whole length for the net. */
function asWindowSlot(s: StoredSlot): LeagueTimeSlot & { length: number } {
  const start = utcToZonedInputs(s.startsAt), end = utcToZonedInputs(s.endsAt);
  return {
    id: s.id, scheduleId: 'send', blockId: s.blockId, venueId: s.venueId, facilityId: s.facilityId,
    day: start.date, weekday: weekdayOf(start.date), start: start.time, end: end.time, use: null,
    length: (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60_000,
  };
}
const total = (slots: readonly { length: number }[]) => slots.reduce((n, s) => n + s.length, 0);

/**
 * THE SEND'S CHANGE TO HOUSE LEAGUE'S TIME (A1, A2). Read by the preview beside its house-league half; the send carries it to
 * the bells. `lastTold` is the preview's own last final/changes send (`lastSends`' `practicesTold`).
 */
export async function timeHandoffFor(p: {
  orgId: string; kind: 'review' | 'final' | 'changes' | 'bill'; state: string; senderId: string;
  slots: readonly StoredSlot[]; places: ClubPlaces;
  lastTold: { sent_at: string; league_slot_ids: string[] | null } | null;
}): Promise<SendTimeHandoff | null> {
  if (p.kind !== 'final' && !(p.kind === 'changes' && p.state === 'final')) return null;
  const now = Date.now();
  const heldIds = new Set(heldHouseLeagueSlotIds(p.slots, now));
  const held = p.slots.filter(s => heldIds.has(s.id));

  let given = held;
  let taken: StoredSlot[] = [];
  if (p.kind === 'changes') {
    const before = p.lastTold?.league_slot_ids;
    if (before) {
      const was = new Set(before);
      given = held.filter(s => !was.has(s.id));
      taken = p.slots.filter(s => was.has(s.id) && !heldIds.has(s.id) && Date.parse(s.startsAt) > now);
    } else {
      const since = p.lastTold ? Date.parse(p.lastTold.sent_at) : 0;
      const heldSince = await houseLeagueHeldSince(p.orgId, held.map(s => s.id));
      given = held.filter(s => (heldSince.get(s.id) ?? 0) > since);
    }
  }
  if (!given.length && !taken.length) return { told: null };

  const [seasons, uses, runners] = await Promise.all([
    seasonsThatHear(p.orgId), usesOf(p.orgId, [...given, ...taken].map(s => s.id)), houseLeagueRunnerUserIds(p.orgId),
  ]);
  const userIds = runners.filter(id => id !== p.senderId);
  if (!userIds.length) return { told: null };
  const g = given.map(asWindowSlot), t = taken.map(asWindowSlot);
  const told: SeasonTimeChange[] = [];
  const toldGiven = new Map<string, LeagueTimeSlot>(), toldTaken = new Map<string, LeagueTimeSlot>();
  for (const s of seasons) {
    const holder = { id: s.id, startDate: s.season_start_date, endDate: s.season_end_date };
    const holds = (x: LeagueTimeSlot) => seasonHoldsSlot(holder, x.day, uses.get(x.id)?.season_id ?? null);
    const mineG = g.filter(holds), mineT = t.filter(holds);
    const net = total(mineG) - total(mineT);
    if (net === 0) continue;
    told.push({ seasonId: s.id, seasonName: s.name, grows: net > 0, given: pieceOf(mineG, p.places), taken: pieceOf(mineT, p.places) });
    for (const x of mineG) toldGiven.set(x.id, x);
    for (const x of mineT) toldTaken.set(x.id, x);
  }
  if (!told.length) return { told: null };

  // Names only (`boardNames`: no email ever stands in for a name). A league admin never sends a schedule.
  const leagueAdmins = (await boardNames(p.orgId, ['league_admin'])).map(b => b.name).sort((a, b) => a.localeCompare(b));
  return {
    told: {
      seasons: told, userIds,
      line: {
        leagueAdmins,
        givenMinutes: pieceOf([...toldGiven.values()], p.places)?.minutes ?? 0,
        takenMinutes: pieceOf([...toldTaken.values()], p.places)?.minutes ?? 0,
      },
    },
  };
}

/**
 * TELL WHOEVER RUNS HOUSE LEAGUE (A1), after the send's step landed: one bell per season, its door House league's time;
 * a season whose time grew stops asking. Best-effort, as every club notice: a failure never undoes the send, and a failed
 * bell never keeps an answered ask on This morning (separate steps).
 */
export async function tellTimeGiven(p: { orgId: string; orgSlug: string; senderId: string; scheduleName: string; sendId: string; handoff: SendTimeHandoff }): Promise<void> {
  const told = p.handoff.told;
  if (!told) return;
  try {
    await Promise.all(told.seasons.map(s => notify({
      orgId: p.orgId, eventType: 'house_league_time_given', userIds: told.userIds, excludeUserIds: [p.senderId],
      title: s.grows ? W.bell.givenTitle : W.bell.takenTitle,
      body: W.bell.body({ schedule: p.scheduleName, season: s.seasonName, grows: s.grows, given: s.given, taken: s.taken }),
      link: `/${p.orgSlug}/admin/house-league/seasons/${s.seasonId}/schedule?time=1`,
      // `facts`: what the opened notice draws as labelled rows, the shared shape (the body is only the one-line summary).
      metadata: { seasonId: s.seasonId, sendId: p.sendId, facts: W.bell.facts({ schedule: p.scheduleName, season: s.seasonName, grows: s.grows, given: s.given, taken: s.taken }) },
    })));
  } catch (e) {
    console.error('[league-time-handoff] the time-given notice failed (the send went):', e);
  }
  const answered = told.seasons.filter(s => s.grows).map(s => s.seasonId);
  if (!answered.length) return;
  const { error } = await supabaseAdmin.from('league_season_time_asks').delete().eq('org_id', p.orgId).in('season_id', answered);
  if (error) console.error('[league-time-handoff] an answered ask could not be cleared (the send went):', error);
}

// ── The ask ──────────────────────────────────────────────────────────────────────────────────────

/** A season's ask, as its screens read it: when it asked, or null. A failed read is null (the button, never a wrong "Asked"). */
export async function readTimeAsk(orgId: string, seasonId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('league_season_time_asks').select('asked_at').eq('org_id', orgId).eq('season_id', seasonId).maybeSingle();
  if (error) { console.error('[league-time-handoff] the ask could not be read:', error); return null; }
  return (data as { asked_at: string } | null)?.asked_at ?? null;
}

/** Where the ask opens for someone who gives time: the club's permits and schedules, counted. */
async function askDoor(orgId: string) {
  const [permits, schedules] = await Promise.all([
    supabaseAdmin.from('org_permits').select('id').eq('org_id', orgId).order('id').limit(2),
    // parts-ok: only none vs some matters, and a part has a parent.
    supabaseAdmin.from('club_schedules').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ]);
  if (permits.error) throw permits.error;
  if (schedules.error) throw schedules.error;
  return timeAskDoor({ permitIds: (permits.data ?? []).map(r => r.id as string), schedules: schedules.count ?? 0 });
}

type AskResult = { ok: true; askedAt: string } | { ok: false; status: number; code: 'given' | 'asked_recently'; askedAt?: string };

/**
 * ASK FOR TIME (A3). The route has already asked the one gate (`askForTime`). Refuses `given` when the season has time,
 * and `asked_recently` inside 7 days. The first ask is an insert (the season is the key, so two presses make one row); asking
 * again is an update only where the standing ask is 7 days old. Then one bell to the owner(s).
 */
export async function askForTime(p: {
  orgId: string; orgSlug: string; actorId: string;
  season: { id: string; name: string; seasonStartDate: string | null; seasonEndDate: string | null };
}): Promise<AskResult> {
  if ((await seasonTimeFacts(p.orgId, p.season)).given) return { ok: false, status: 409, code: 'given' };
  const now = Date.now();
  const at = new Date(now).toISOString();
  const cutoff = new Date(now - ASK_AGAIN_DAYS * DAY_MS).toISOString();
  const first = await supabaseAdmin.from('league_season_time_asks')
    .insert({ season_id: p.season.id, org_id: p.orgId, asked_at: at, asked_by: p.actorId }).select('asked_at');
  let rows = first.data;
  if (first.error) {
    if (first.error.code !== '23505') throw first.error;
    const again = await supabaseAdmin.from('league_season_time_asks').update({ asked_at: at, asked_by: p.actorId })
      .eq('org_id', p.orgId).eq('season_id', p.season.id).lte('asked_at', cutoff).select('asked_at');
    if (again.error) throw again.error;
    rows = again.data;
  }
  if (!rows?.length) {
    const askedAt = await readTimeAsk(p.orgId, p.season.id);
    return { ok: false, status: 409, code: 'asked_recently', ...(askedAt ? { askedAt } : {}) };
  }
  const askedAt = (rows[0] as { asked_at: string }).asked_at;
  try {
    const [owners, door] = await Promise.all([orgOwnerUserIds(p.orgId), askDoor(p.orgId)]);
    if (owners.length) {
      await notify({
        orgId: p.orgId, eventType: 'house_league_time_asked', userIds: owners, excludeUserIds: [p.actorId],
        title: W.askBell.title, body: W.askBell.body(p.season.name),
        link: timeAskHref(`/${p.orgSlug}/admin`, door), metadata: { seasonId: p.season.id },
      });
    }
  } catch (e) {
    console.error('[league-time-handoff] the owner\'s ask bell failed (the ask went):', e);
  }
  return { ok: true, askedAt };
}

/**
 * THIS MORNING'S CARD (A4): the live or getting-ready seasons asking, with no time — the season line's own answer
 * (`seasonTimeFacts`), so the card clears by itself the moment a season has time. Null when nothing asks (one read).
 */
export async function readTimeAsksCard(orgId: string): Promise<TimeAsksCard | null> {
  const asks = await fetchAll<{ asked_at: string; league_seasons: SeasonRow | SeasonRow[] }>((a, b) => supabaseAdmin
    .from('league_season_time_asks')
    .select('asked_at, league_seasons!inner(id, name, status, season_start_date, season_end_date)')
    .eq('org_id', orgId).not('league_seasons.status', 'in', FINISHED).order('asked_at').order('season_id').range(a, b));
  const asking = asks.map(r => ({ askedAt: r.asked_at, season: Array.isArray(r.league_seasons) ? r.league_seasons[0] : r.league_seasons }))
    .filter(r => !!r.season);
  if (!asking.length) return null;
  const [facts, door] = await Promise.all([
    Promise.all(asking.map(({ season: s }) => seasonTimeFacts(orgId, { id: s.id, seasonStartDate: s.season_start_date, seasonEndDate: s.season_end_date }))),
    askDoor(orgId),
  ]);
  const waiting = asking.filter((_, i) => !facts[i].given);
  return waiting.length ? { seasons: waiting.map(r => ({ name: r.season.name, askedAt: r.askedAt })), door } : null;
}
