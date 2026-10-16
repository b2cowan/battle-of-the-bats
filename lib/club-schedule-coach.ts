import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { formatShortWeekdayDate, tournamentToday, utcToZonedInputs } from './timezone';
import { weekdayOf } from './permit-time';
import { isUuid } from './utils';
import type { RepTeamEvent } from './types';
import { slotPatterns } from './club-schedule-engine';
import { slotFigure, teamInstallments, type Installment } from './club-schedule-bill';
import { SCHEDULE_NOTICES, SCHEDULE_REFUSALS as R, patternLine, placeWords } from './club-schedule-words';
import { billSlotsOf, computeBill, liveSlots, loadSchedule, readClubTeams, readPrices, type ScheduleRow } from './club-schedule-server';
import { readClubPlaces } from './permit-lookup';
import { tellBuilders } from './club-schedule-send';
import { practiceHandBacks, waitingAsksOfTeam, type PracticeHandBack } from './club-hand-back-reads';
import { dayRange } from './club-hand-back-words';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HEAD COACH AND THE CLUB'S SCHEDULE (Club Tier Stage 11a, part A — Stage 11 Ask 1, Asks 16, 17, 24). Server-only.
 *
 *   · The review card's read (Ask 24): the schedules the club has sent for review that give this team time — its slots
 *     as a pattern and its bill (worked out now; nothing is billed until Finalize) — and the team's latest answer.
 *   · The reply: Looks good, or Ask for a change (with words) — any head coach of the team; the latest answer per team
 *     stands; Finalize is never held up by a team that hasn't answered.
 *   · Hand back (Ask 17): the coach's own act, landing at once — this practice, this & future, or all (the same weekly
 *     place: weekday, start, facility) — the slot reads "Open · handed back by {team}", the practice stays on the coach's
 *     schedule as Handed back (Stage 11d part C, Ask 10: cancelled, never deleted — families see it as Cancelled), and
 *     the builders are told. Taking it back and asking for its money later are lib/club-hand-back.ts's.
 *   · Each club practice's source ("From {schedule} · the club's schedule"): the schedule's name, for the coach's read.
 *
 * Who: the routes check the coach (a staff membership of the team; the review and the reply a HEAD coach; hand-back the
 * schedule's write capability — the same as any change to the team's schedule).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Each club practice's schedule, by slot: "From {schedule}" — and the team that HANDED the slot back, if one did (part
 *  B: a cancelled club practice whose slot this team handed back reads "Handed back", struck through, never hidden).
 *  Stage 11d part C (C2): each of the team's CANCELLED club practices also carries its hand-back (`practiceHandBacks`) —
 *  what the practice's end says, and its two ways back. */
export async function clubSourcesFor(orgId: string, events: readonly Pick<RepTeamEvent, 'clubScheduleSlotId' | 'status'>[], teamId?: string): Promise<Record<string, ClubSourceRead>> {
  const slotIds = [...new Set(events.map(e => e.clubScheduleSlotId).filter((s): s is string => !!s))];
  if (!slotIds.length) return {};
  const cancelled = [...new Set(events.filter(e => e.status === 'cancelled' && e.clubScheduleSlotId).map(e => e.clubScheduleSlotId!))];
  const [rows, asks, handBacks] = await Promise.all([
    fetchAllIn<{ id: string; schedule_id: string; handed_back_team_id: string | null; club_schedules: { name: string } | null }>(slotIds, (c, a, b) => supabaseAdmin
      .from('club_schedule_slots').select('id, schedule_id, handed_back_team_id, club_schedules ( name )').eq('org_id', orgId).in('id', c).order('id').range(a, b)),
    teamId ? waitingAsksOn(orgId, teamId) : Promise.resolve(new Map<string, ClubSourceAsk>()),
    teamId && cancelled.length ? practiceHandBacks(orgId, teamId, cancelled) : Promise.resolve(new Map<string, PracticeHandBack>()),
  ]);
  return Object.fromEntries(rows.map(r => [r.id, {
    scheduleId: r.schedule_id, scheduleName: r.club_schedules?.name ?? '', handedBackTeamId: r.handed_back_team_id ?? null,
    ask: asks.get(r.id) ?? null,
    handBack: handBacks.get(r.id) ?? null,
    // This team handed it back: its hand-back's record says so (part C), or — before any record — the slot's last one.
    handedBack: handBacks.has(r.id) || (!!teamId && r.handed_back_team_id === teamId),
  }]));
}

/** A waiting ask on a club practice (Stage 11d, specimen 2): the amber "Hand-back asked" pill and "what was asked". A
 *  LATE ask (part C) sits on practices already handed back: the amber "Money asked" pill and its own line. */
export interface ClubSourceAsk { id: string; askedAt: string; count: number; first: string; last: string; cents: number; late: boolean }
export interface ClubSourceRead {
  scheduleId: string; scheduleName: string; handedBackTeamId: string | null; ask: ClubSourceAsk | null;
  /** Part C: the hand-back that took this (cancelled) practice, for its end — null on any other practice. */
  handBack: PracticeHandBack | null;
  /** This team handed the slot back — what the row's not-on word reads (Handed back, never Cancelled). */
  handedBack: boolean;
}

/** The team's WAITING asks, by slot — its live figure, read as the club's Answer reads it (`askSummaries`: Ask 7). An
 *  ask with nothing left to count (every Sunday started, or the club moved them off the team) shows on no practice; the
 *  coach can still withdraw it from Money › Club, and the sweep closes it. */
async function waitingAsksOn(orgId: string, teamId: string): Promise<Map<string, ClubSourceAsk>> {
  const out = new Map<string, ClubSourceAsk>();
  for (const ask of await waitingAsksOfTeam(orgId, teamId)) {
    if (!ask.count || !ask.first || !ask.last) continue;
    const view: ClubSourceAsk = { id: ask.id, askedAt: ask.askedAt, count: ask.count, first: ask.first, last: ask.last, cents: ask.cents, late: !!ask.lateFor };
    for (const slotId of ask.slotIds) out.set(slotId, view);
  }
  return out;
}

export interface ReviewCard {
  scheduleId: string;
  scheduleName: string;
  replyBy: string | null;
  slots: number;
  /** The days those slots fall on — what a one-weekday schedule counts ("25 Sundays"). */
  days: number;
  hours: number;
  patterns: string[];
  bill: { cents: number; installments: Installment[] } | null;
  /** What each payment covers (part B, the review window: "Your 9 Sundays in October and November"): the team's slots in
   *  that payment's period and the months they fall in. Index-aligned with `bill.installments`. */
  covers: { slots: number; days: number; months: string[] }[];
  /** The one weekday every slot of the team's falls on, or null — "25 Sundays" rather than "25 slots". */
  oneWeekday: number | null;
  /** The team's running season's name — what the slots and the bill land on. */
  seasonName: string | null;
  /** The team's latest answer this round (the latest), or null. */
  reply: { answer: 'looks_good' | 'ask_for_change'; words: string | null; at: string } | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** THE REVIEW CARD (Ask 24): every schedule in review that gives this team time. */
export async function teamReviews(orgId: string, teamId: string): Promise<ReviewCard[]> {
  const ids = await reviewsGivingTime(orgId, teamId);
  if (!ids.length) return [];
  // The club's team order: the bill's split rounds the way the club's page and the send do (`computeBill`).
  const [places, teams] = await Promise.all([readClubPlaces(orgId), readClubTeams(orgId)]);
  const teamOrder = teams.map(t => t.id);
  const cards = await Promise.all(ids.map(async (id): Promise<ReviewCard | null> => {
    const loaded = await loadSchedule(orgId, id);
    if (!loaded) return null;
    const [prices, reply] = await Promise.all([
      readPrices(orgId, loaded.row.bill_permit_id ?? loaded.row.started_from_permit_id),
      latestReply(orgId, id, teamId),
    ]);
    const { slots, assignments } = liveSlots(loaded, prices.weightOf);
    const own = slots.filter(s => (assignments.get(s.key) ?? []).includes(teamId));
    const patterns = slotPatterns(slots, teamId, assignments).map(p => patternLine(p, placeWords(places.venueName.get(p.venueId) ?? '', p.facilityId ? places.facilityName.get(p.facilityId) ?? null : null)));
    const bill = computeBill(loaded.row, billSlotsOf(slots, assignments), prices.fullHour, teamOrder);
    const cents = bill?.shares?.shares.get(teamId);
    const installments = bill && cents ? teamInstallments(teamId, cents, bill.billSlots, bill.periods) : [];
    const periodOf = (due: string) => bill?.periods.find(p => p.due === due) ?? null;
    const covers = installments.map(i => {
      const p = periodOf(i.dueDate);
      const mine = p ? own.filter(x => x.day >= p.from && (p.until === null || x.day < p.until)) : [];
      return { slots: mine.length, days: new Set(mine.map(x => x.day)).size, months: [...new Set(mine.map(x => MONTHS[Number(x.day.slice(5, 7)) - 1]))] };
    });
    const weekdays = [...new Set(own.map(x => x.weekday))];
    return {
      scheduleId: id, scheduleName: loaded.row.name, replyBy: loaded.row.reply_by, slots: own.length, days: new Set(own.map(x => x.day)).size,
      hours: Math.round(own.reduce((n, s) => n + (s.endMs - s.startMs) / 3_600_000 / Math.max(1, (assignments.get(s.key) ?? []).length), 0) * 100) / 100,
      patterns,
      bill: bill && cents ? { cents, installments } : null,
      covers,
      oneWeekday: weekdays.length === 1 ? weekdays[0] : null,
      seasonName: teams.find(t => t.id === teamId)?.season?.name ?? null,
      reply,
    };
  }));
  return cards.filter((c): c is ReviewCard => !!c);
}

/** The schedules in review where this team has a slot (one read each way). */
async function reviewsGivingTime(orgId: string, teamId: string, only?: string): Promise<string[]> {
  const inReview = await fetchAll<{ id: string }>((a, b) => {
    const q = supabaseAdmin.from('club_schedules').select('id').eq('org_id', orgId).eq('state', 'in_review');
    return (only ? q.eq('id', only) : q).order('id').range(a, b);
  });
  if (!inReview.length) return [];
  const mine = await fetchAllIn<{ schedule_id: string }>(inReview.map(s => s.id), (c, a, b) => supabaseAdmin
    .from('club_schedule_slots').select('schedule_id, club_schedule_slot_teams!inner(team_id)').eq('org_id', orgId)
    .in('schedule_id', c).eq('club_schedule_slot_teams.team_id', teamId).is('removed_at', null).order('id').range(a, b));
  return [...new Set(mine.map(m => m.schedule_id))];
}

/** The latest review send of a schedule — the round a reply answers. */
async function latestReviewSend(orgId: string, scheduleId: string): Promise<string | null> {
  // A landed round only: a claim whose step was refused is removed again, and a reply on it would go with it.
  const { data, error } = await supabaseAdmin.from('club_schedule_sends').select('id').eq('org_id', orgId).eq('schedule_id', scheduleId)
    .eq('kind', 'review').not('landed_at', 'is', null).order('sent_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

async function latestReply(orgId: string, scheduleId: string, teamId: string): Promise<ReviewCard['reply']> {
  const sendId = await latestReviewSend(orgId, scheduleId);
  if (!sendId) return null;
  const { data, error } = await supabaseAdmin.from('club_schedule_replies').select('answer, words, replied_at')
    .eq('org_id', orgId).eq('send_id', sendId).eq('team_id', teamId).order('replied_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { answer: data.answer as 'looks_good' | 'ask_for_change', words: (data.words as string | null) ?? null, at: data.replied_at as string } : null;
}

/** Every team's latest answer this round, for the schedule's page ("In review · 6 of 8 teams replied"). */
export async function scheduleReplies(orgId: string, scheduleId: string): Promise<{ teamId: string; answer: 'looks_good' | 'ask_for_change'; words: string | null; at: string }[]> {
  const sendId = await latestReviewSend(orgId, scheduleId);
  if (!sendId) return [];
  const rows = await fetchAll<{ team_id: string; answer: 'looks_good' | 'ask_for_change'; words: string | null; replied_at: string }>((a, b) => supabaseAdmin
    .from('club_schedule_replies').select('team_id, answer, words, replied_at').eq('org_id', orgId).eq('send_id', sendId)
    .order('replied_at', { ascending: false }).range(a, b));
  const seen = new Set<string>();
  return rows.filter(r => (seen.has(r.team_id) ? false : (seen.add(r.team_id), true)))
    .map(r => ({ teamId: r.team_id, answer: r.answer, words: r.words, at: r.replied_at }));
}

/** THE REPLY (Ask 24): Looks good, or Ask for a change with words. The latest answer stands. */
export async function replyToReview(p: {
  orgId: string; orgSlug: string; teamId: string; teamName: string; scheduleId: string; actorUserId: string; answer: unknown; words: unknown;
}): Promise<{ ok: true } | { ok: false; status: number; code: string; error: string }> {
  const answer = p.answer === 'looks_good' || p.answer === 'ask_for_change' ? p.answer : null;
  if (!answer) return { ok: false, status: 400, code: 'bad_answer', error: 'Answer Looks good, or Ask for a change.' };
  const words = typeof p.words === 'string' ? p.words.trim().slice(0, 1000) || null : null;
  if (answer === 'ask_for_change' && !words) return { ok: false, status: 400, code: 'words_required', error: R.replyWords };
  if (!isUuid(p.scheduleId)) return { ok: false, status: 404, code: 'not_found', error: R.notFound };
  const { data: schedule, error } = await supabaseAdmin.from('club_schedules').select('id, name, state').eq('id', p.scheduleId).eq('org_id', p.orgId).maybeSingle();
  if (error) throw error;
  if (!schedule || schedule.state !== 'in_review') return { ok: false, status: 409, code: 'not_in_review', error: R.notInReview };
  // The team answers only a schedule that gives it time.
  const [mine, sendId] = await Promise.all([reviewsGivingTime(p.orgId, p.teamId, p.scheduleId), latestReviewSend(p.orgId, p.scheduleId)]);
  if (!mine.length) return { ok: false, status: 404, code: 'not_found', error: R.notFound };
  if (!sendId) return { ok: false, status: 409, code: 'not_in_review', error: R.notInReview };
  const { error: insertError } = await supabaseAdmin.from('club_schedule_replies').insert({
    org_id: p.orgId, schedule_id: p.scheduleId, send_id: sendId, team_id: p.teamId, answer, words, replied_by: p.actorUserId,
  });
  if (insertError) throw insertError;
  const words2 = SCHEDULE_NOTICES.reply({ teamName: p.teamName, scheduleName: schedule.name as string, answer, words });
  await tellBuilders({ orgId: p.orgId, orgSlug: p.orgSlug, scheduleId: p.scheduleId, actorUserId: p.actorUserId, eventType: 'club_schedule_reply', ...words2 });
  return { ok: true };
}

// ── Hand back (Ask 17; Stage 11d) ────────────────────────────────────────────────────────────────

export type HandBackScope = 'one' | 'remaining' | 'all';

export const readHandBackScope = (v: unknown): HandBackScope | null => (v === 'one' || v === 'remaining' || v === 'all' ? v : null);

export interface ClubPractice { id: string; starts_at: string; ends_at: string | null; status: string; club_schedule_slot_id: string; org_venue_id: string | null; org_venue_facility_id: string | null }

export interface PracticeSeries {
  scheduleId: string;
  scheduleName: string;
  /** The team's practices from the schedule at this weekly place that haven't started and aren't in a waiting ask. */
  series: ClubPractice[];
  /** Slots of the schedule already in a WAITING ask (Stage 11d): their ask answers for them — never handed back twice. */
  askedSlots: Set<string>;
}

/** The team's practices from the same club schedule at the same place in the week (weekday, start, facility) that
 *  haven't started — the series a hand-back reaches. A practice already in a waiting ask is left out (Stage 11d). */
export async function practiceSeries(orgId: string, teamId: string, event: RepTeamEvent): Promise<PracticeSeries | null> {
  if (!event.clubScheduleSlotId) return null;
  const { data: slot, error } = await supabaseAdmin.from('club_schedule_slots').select('schedule_id, club_schedules ( name, state )')
    .eq('id', event.clubScheduleSlotId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!slot) return null;
  const scheduleId = slot.schedule_id as string;
  const scheduleName = (slot.club_schedules as { name?: string } | null)?.name ?? '';
  const slotIds = (await fetchAll<{ id: string }>((a, b) => supabaseAdmin.from('club_schedule_slots').select('id').eq('org_id', orgId).eq('schedule_id', scheduleId).order('id').range(a, b))).map(s => s.id);
  const [practices, waiting] = await Promise.all([
    fetchAllIn<ClubPractice>(slotIds, (c, a, b) => supabaseAdmin.from('rep_team_events')
      .select('id, starts_at, ends_at, status, club_schedule_slot_id, org_venue_id, org_venue_facility_id')
      .eq('org_id', orgId).eq('team_id', teamId).in('club_schedule_slot_id', c).neq('status', 'cancelled').order('id').range(a, b)),
    // The schedule's slots in a waiting ask — by the schedule (`club_schedule_hand_backs_schedule_idx`), never a list of every slot.
    fetchAll<{ slot_id: string }>((a, b) => supabaseAdmin.from('club_schedule_hand_back_slots')
      .select('slot_id, club_schedule_hand_backs!inner ( schedule_id )').eq('org_id', orgId).eq('waiting', true)
      .eq('club_schedule_hand_backs.schedule_id', scheduleId).order('id').range(a, b)),
  ]);
  const askedSlots = new Set(waiting.map(w => w.slot_id));
  const placeKey = (p: { starts_at: string; org_venue_id: string | null; org_venue_facility_id: string | null }) => {
    const z = utcToZonedInputs(p.starts_at);
    return `${weekdayOf(z.date)}|${z.time}|${p.org_venue_id ?? ''}|${p.org_venue_facility_id ?? ''}`;
  };
  const mine = placeKey({ starts_at: event.startsAt, org_venue_id: event.orgVenueId ?? null, org_venue_facility_id: event.orgVenueFacilityId ?? null });
  const nowIso = new Date().toISOString();
  return {
    scheduleId, scheduleName, askedSlots,
    series: practices.filter(p => placeKey(p) === mine && p.starts_at >= nowIso && !askedSlots.has(p.club_schedule_slot_id))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  };
}

/** The practices a scope reaches: this practice · this & future · all. */
export function scopePractices(found: PracticeSeries, event: Pick<RepTeamEvent, 'id' | 'startsAt'>, scope: HandBackScope): ClubPractice[] {
  if (scope === 'one') return found.series.filter(x => x.id === event.id);
  if (scope === 'remaining') return found.series.filter(x => x.starts_at >= event.startsAt);
  return found.series;
}

/** A practice's slot and what it cost the team (Stage 11d) — the record a hand-back keeps, and an ask's figure. */
export interface HandBackSlot { eventId: string; slotId: string; startsAt: string; endsAt: string; pricedMinutes: number; cents: number }

/**
 * EACH PRACTICE'S FIGURE (Stage 11d, Ask 1): its slot at what the club billed the team for it (`slotFigure` — the team's
 * priced minutes at the schedule's `bill_scale`). Worked out here, on the server, from the schedule as it stands;
 * never typed and never trusted from the browser. `scale` is null when the schedule billed nothing.
 */
export async function practiceFigures(orgId: string, scheduleId: string, practices: readonly ClubPractice[]): Promise<{ figures: HandBackSlot[]; row: ScheduleRow } | null> {
  const loaded = await loadSchedule(orgId, scheduleId);
  if (!loaded) return null;
  const prices = await readPrices(orgId, loaded.row.bill_permit_id ?? loaded.row.started_from_permit_id);
  const scale = loaded.row.bill_scale == null ? null : Number(loaded.row.bill_scale);
  const slotById = new Map(loaded.slots.filter(s => !s.removed).map(s => [s.id, s]));
  const figures: HandBackSlot[] = [];
  for (const p of practices) {
    const slot = slotById.get(p.club_schedule_slot_id);
    if (!slot) continue;
    const f = slotFigure({ startMs: Date.parse(slot.startsAt), endMs: Date.parse(slot.endsAt), weight: prices.weightOf(slot.facilityId), teams: slot.teamIds.length, scale });
    figures.push({ eventId: p.id, slotId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, pricedMinutes: Math.round(f.pricedMinutes * 10_000) / 10_000, cents: f.cents });
  }
  return { figures, row: loaded.row };
}

/** The three rows the question shows (specimen 11): each scope's dates and count, from the series the route read once. */
export function handBackChoices(found: PracticeSeries, event: RepTeamEvent) {
  const { series } = found;
  const fromHere = series.filter(p => p.starts_at >= event.startsAt);
  const range = (list: ClubPractice[]) => dayRange(list.map(p => utcToZonedInputs(p.starts_at).date), formatShortWeekdayDate);
  return {
    scheduleId: found.scheduleId,
    scheduleName: found.scheduleName,
    /** This practice is already in a waiting ask (Stage 11d): its ask answers for it. */
    asked: !!event.clubScheduleSlotId && found.askedSlots.has(event.clubScheduleSlotId),
    one: { count: 1, dates: formatShortWeekdayDate(utcToZonedInputs(event.startsAt).date) },
    remaining: { count: fromHere.length, dates: range(fromHere) },
    all: { count: series.length, dates: range(series) },
  };
}

/** HAND BACK — the coach's own act, landing at once (without money; Stage 11d's ask is lib/club-hand-back.ts). It
 *  records the hand-back with each slot's figure and ⚖ never marks the schedule Changed since sent (Ask 9). */
export async function handBack(p: {
  orgId: string; orgSlug: string; teamId: string; teamName: string; actorUserId: string; event: RepTeamEvent; scope: unknown;
}): Promise<{ ok: true; handedBack: number; cancelled: number; deleted: number; handBackId: string } | { ok: false; status: number; code: string; error: string }> {
  const scope = readHandBackScope(p.scope);
  if (!scope) return { ok: false, status: 400, code: 'bad_scope', error: 'Choose which practices to hand back.' };
  if (!p.event.clubScheduleSlotId || p.event.status === 'cancelled') return { ok: false, status: 409, code: 'not_the_clubs', error: R.handBackNothing };
  if (p.event.startsAt < new Date().toISOString()) return { ok: false, status: 409, code: 'already_started', error: 'That practice has already started, so it can’t be handed back.' };
  const found = await practiceSeries(p.orgId, p.teamId, p.event);
  if (!found) return { ok: false, status: 409, code: 'not_the_clubs', error: R.handBackNothing };
  if (found.askedSlots.has(p.event.clubScheduleSlotId)) return { ok: false, status: 409, code: 'asked', error: R.handBackAsked };
  const practices = scopePractices(found, p.event, scope);
  if (!practices.length) return { ok: false, status: 409, code: 'not_the_clubs', error: R.handBackNothing };
  const priced = await practiceFigures(p.orgId, found.scheduleId, practices);
  if (!priced?.figures.length) return { ok: false, status: 409, code: 'not_the_clubs', error: R.handBackNothing };
  const { data, error } = await supabaseAdmin.rpc('club_schedule_hand_back', {
    p_org: p.orgId, p_team: p.teamId, p_actor: p.actorUserId, p_schedule: found.scheduleId, p_scope: scope, p_slots: priced.figures,
  });
  if (error) throw error;
  const r = data as { ok: boolean; slots: string[]; cancelled: number; deleted: number; handBackId: string };
  if (!r.ok || !r.slots.length) return { ok: false, status: 409, code: 'not_the_clubs', error: R.handBackNothing };
  const words = SCHEDULE_NOTICES.handedBack({ teamName: p.teamName, scheduleName: found.scheduleName, practices: r.slots.length, first: utcToZonedInputs(p.event.startsAt).date || tournamentToday() });
  await tellBuilders({ orgId: p.orgId, orgSlug: p.orgSlug, scheduleId: found.scheduleId, actorUserId: p.actorUserId, eventType: 'club_schedule_handed_back', ...words });
  return { ok: true, handedBack: r.slots.length, cancelled: r.cancelled, deleted: r.deleted, handBackId: r.handBackId };
}
