import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { utcToZonedInputs } from './timezone';
import { weekdayOf } from './permit-time';

/**
 * AN ASK, READ (Club Tier Stage 11d, part A — mig 328). Server-only. The one reading of a hand-back's Sundays that both
 * sides share: the club's lists and its Answer window (lib/club-hand-back.ts), and the coach's practice — its amber pill
 * and "what was asked" (lib/club-schedule-coach.ts `clubSourcesFor`). Its own module so neither of those imports the
 * other.
 *
 * A WAITING ask's live Sundays are read exactly as the accept step reads them (`club_hand_back_accept`): the slot is
 * still there and not removed, it hasn't started (as it stands now — a moved slot reads its new time), the team still
 * holds it, and the team's practice is still on it. A Sunday that fails any of those has left the ask, with its figure
 * (Ask 7). An ask LAPSES when no Sunday in it is still to come — each slot, as it stands, has started or is gone (the
 * step's and the sweep's own reading).
 *
 * A LATE ASK (Stage 11d part C, mig 330 — Ask 12: `late_for` names the landed hand-back it asks money for) counts every
 * Sunday it asked about, in every state: the time left the team at the hand-back, so a Sunday that started since, or
 * that the club gave to another team, still counts. It never lapses (mig 331 keeps the sweep off it).
 *
 * THE COACH'S HANDED-BACK PRACTICE (part C, C2 — `practiceHandBacks`): which hand-back took each of the team's cancelled
 * club practices, the rest of it, whether this one can come back (Ask 11), what a late ask would ask (Ask 12), and
 * what the money did.
 */

/** The one weekday a set of practices share, or null ("4 Sundays", else "4 practices"). */
export function commonWeekday(startsAt: readonly string[]): number | null {
  const days = new Set(startsAt.map(s => weekdayOf(utcToZonedInputs(s).date)));
  return days.size === 1 ? [...days][0] : null;
}

/** "At $108.00 each" — only when every practice costs the same. */
export function eachCents(xs: readonly { cents: number }[]): number | null {
  const each = new Set(xs.map(x => x.cents));
  return each.size === 1 ? [...each][0] : null;
}

/** A Sunday an ask counts: its slot as it stands (its time, venue and facility), and its figure as asked. */
export interface AskSunday { slotId: string | null; startsAt: string; endsAt: string; cents: number; venueId: string | null; facilityId: string | null }

/** An ask, as every list and window reads it. */
export interface AskSummary {
  id: string; state: 'waiting' | 'accepted' | 'declined' | 'withdrawn' | 'lapsed'; teamId: string; teamName: string;
  scheduleId: string; scheduleName: string; askedAt: string; askedBy: string | null; closedAt: string | null; declineReason: string | null;
  /** A late ask (part C): the landed hand-back it asks money for — its Sundays are already open. */
  lateFor: string | null;
  /** Live while waiting; the figure accepted once accepted; as asked otherwise. */
  cents: number; count: number; first: string | null; last: string | null; weekday: number | null;
  creditedCents: number | null; toPayCents: number | null;
  /** The Sundays counted (live while waiting · handed back once accepted · as asked otherwise), in time order. */
  sundays: AskSunday[];
  /** Every slot the ask reached — the coach's pill sits on each of the team's practices on them. */
  slotIds: string[];
  /** Any Sunday still to come, its slot as it stands; none, and a waiting ask lapses at the next sweep. */
  toCome: boolean;
}

type Row = {
  id: string; state: AskSummary['state'] | 'landed'; team_id: string; schedule_id: string; asked_at: string; asked_by: string | null; closed_at: string | null;
  late_for: string | null;
  decline_reason: string | null; asked_cents: number | string | null; accepted_cents: number | string | null; credited_cents: number | string | null; to_pay_cents: number | string | null;
  club_schedules: { name: string } | null;
  rep_teams: { name: string } | null;
  club_schedule_hand_back_slots: {
    slot_id: string | null; starts_at: string; ends_at: string; cents: number | string; handed_back: boolean;
    club_schedule_slots: { starts_at: string; ends_at: string; removed_at: string | null; org_venue_id: string; facility_id: string | null } | null;
  }[] | null;
};

const SELECT = 'id, state, team_id, schedule_id, asked_at, asked_by, closed_at, late_for, decline_reason, asked_cents, accepted_cents, credited_cents, to_pay_cents, '
  + 'club_schedules ( name ), rep_teams ( name ), '
  + 'club_schedule_hand_back_slots ( slot_id, starts_at, ends_at, cents, handed_back, club_schedule_slots ( starts_at, ends_at, removed_at, org_venue_id, facility_id ) )';

const num = (v: number | string | null) => (v == null ? null : Number(v));

async function summarize(orgId: string, rows: readonly Row[]): Promise<AskSummary[]> {
  // Whether each waiting ask's team still holds its slots — one read for every waiting ask, narrowed to their teams. A
  // late ask reads it too: a Sunday the club has given back to the team is never paid for (/review 2026-10-16).
  const waiting = rows.filter(r => r.state === 'waiting');
  const slotIds = [...new Set(waiting.flatMap(r => (r.club_schedule_hand_back_slots ?? []).map(s => s.slot_id)).filter((s): s is string => !!s))];
  const teamIds = [...new Set(waiting.map(r => r.team_id))];
  const [held, practices] = slotIds.length ? await Promise.all([
    fetchAllIn<{ slot_id: string; team_id: string }>(slotIds, (c, a, b) => supabaseAdmin
      .from('club_schedule_slot_teams').select('slot_id, team_id').eq('org_id', orgId).in('team_id', teamIds).in('slot_id', c).order('slot_id').range(a, b)),
    fetchAllIn<{ club_schedule_slot_id: string; team_id: string }>(slotIds, (c, a, b) => supabaseAdmin
      .from('rep_team_events').select('club_schedule_slot_id, team_id').eq('org_id', orgId).in('team_id', teamIds).in('club_schedule_slot_id', c)
      .neq('status', 'cancelled').order('id').range(a, b)),
  ]) : [[], []];
  const holds = new Set(held.map(h => `${h.slot_id}|${h.team_id}`));
  const practiced = new Set(practices.map(e => `${e.club_schedule_slot_id}|${e.team_id}`));
  const now = new Date().toISOString();
  const out: AskSummary[] = [];
  for (const r of rows) {
    if (r.state === 'landed') continue;
    const slots = [...(r.club_schedule_hand_back_slots ?? [])].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    const counted = r.late_for
      ? (r.state === 'waiting' ? slots.filter(s => !s.slot_id || !holds.has(`${s.slot_id}|${r.team_id}`))
        : r.state === 'accepted' ? slots.filter(s => s.handed_back) : slots)
      : r.state === 'waiting'
      ? slots.filter(s => s.slot_id && s.club_schedule_slots && !s.club_schedule_slots.removed_at && s.club_schedule_slots.starts_at > now
          && holds.has(`${s.slot_id}|${r.team_id}`) && practiced.has(`${s.slot_id}|${r.team_id}`))
      : r.state === 'accepted' ? slots.filter(s => s.handed_back) : slots;
    const sundays = counted.map(s => ({
      slotId: s.slot_id, startsAt: s.club_schedule_slots?.starts_at ?? s.starts_at, endsAt: s.club_schedule_slots?.ends_at ?? s.ends_at,
      cents: Number(s.cents), venueId: s.club_schedule_slots?.org_venue_id ?? null, facilityId: s.club_schedule_slots?.facility_id ?? null,
    })).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
    out.push({
      id: r.id, state: r.state, teamId: r.team_id, teamName: r.rep_teams?.name ?? 'The team',
      scheduleId: r.schedule_id, scheduleName: r.club_schedules?.name ?? '',
      askedAt: r.asked_at, askedBy: r.asked_by, closedAt: r.closed_at, declineReason: r.decline_reason, lateFor: r.late_for,
      cents: r.state === 'accepted' ? Number(r.accepted_cents ?? 0) : r.state === 'waiting' ? sundays.reduce((n, s) => n + s.cents, 0) : Number(r.asked_cents ?? 0),
      count: sundays.length,
      first: sundays[0] ? utcToZonedInputs(sundays[0].startsAt).date : null,
      last: sundays.length ? utcToZonedInputs(sundays[sundays.length - 1].startsAt).date : null,
      weekday: commonWeekday(sundays.map(s => s.startsAt)),
      creditedCents: num(r.credited_cents), toPayCents: num(r.to_pay_cents),
      sundays,
      slotIds: slots.map(s => s.slot_id).filter((s): s is string => !!s),
      // A late ask never lapses by date (Ask 12): it is always "to come" for the reads that would lapse it.
      toCome: !!r.late_for || slots.some(s => !!s.club_schedule_slots && !s.club_schedule_slots.removed_at && s.club_schedule_slots.starts_at > now),
    });
  }
  return out;
}

/** These asks, by id (the lists and the Answer window). A landed hand-back is no ask, and is left out. */
export async function askSummaries(orgId: string, ids: readonly string[]): Promise<Map<string, AskSummary>> {
  if (!ids.length) return new Map();
  const rows = await fetchAllIn<Row>([...new Set(ids)], (c, a, b) => supabaseAdmin.from('club_schedule_hand_backs')
    .select(SELECT).eq('org_id', orgId).in('id', c).order('id').range(a, b));
  return new Map((await summarize(orgId, rows)).map(s => [s.id, s]));
}

/** A team's WAITING asks (the coach's practices — almost always none; `club_schedule_hand_backs_team_idx` reads it). */
export async function waitingAsksOfTeam(orgId: string, teamId: string): Promise<AskSummary[]> {
  const rows = await fetchAll<Row>((a, b) => supabaseAdmin.from('club_schedule_hand_backs')
    .select(SELECT).eq('org_id', orgId).eq('team_id', teamId).eq('state', 'waiting').order('id').range(a, b));
  return rows.length ? summarize(orgId, rows) : [];
}

// ── The coach's handed-back practice (Stage 11d part C, specimen C2) ─────────────────────────────

/** Where a handed-back practice's own Sunday stands now: still open and to come; the club gave it to another team
 *  (`taken`) or back to this one (`returned`, until its changes are sent); it took the time off its schedule
 *  (`removed`); or the Sunday has started. */
export type HandedBackSlot = 'open' | 'taken' | 'returned' | 'removed' | 'started';

/** A slot as the handed-back reads select it: `starts_at, removed_at, club_schedule_slot_teams ( team_id )`. */
export interface StandingSlot { starts_at: string; removed_at: string | null; club_schedule_slot_teams: { team_id: string }[] | null }

/** WHERE A HANDED-BACK SUNDAY STANDS NOW, for `teamId` — the one reading the practice's end, Take it back's rows and the
 *  club's Answer (D3's open / gone count) all share. A slot that is gone (deleted) reads `removed`. */
export function slotStanding(slot: StandingSlot | null | undefined, teamId: string, now: string): HandedBackSlot {
  if (!slot || slot.removed_at) return 'removed';
  const teams = (slot.club_schedule_slot_teams ?? []).map(t => t.team_id);
  if (teams.some(t => t !== teamId)) return 'taken';
  if (teams.length) return 'returned';
  return slot.starts_at <= now ? 'started' : 'open';
}

export interface PracticeHandBack {
  /** The hand-back that took it: without the tick (`landed`), or an ask with its tick the club accepted (`asked`). */
  id: string; kind: 'landed' | 'asked'; scheduleId: string; scheduleName: string;
  /** The club day it was handed back (an ask with its tick: the day the club accepted it). */
  on: string;
  /** Every practice of it still handed back, this one included — club days, in time order. */
  days: string[];
  slot: HandedBackSlot;
  /** Take it back (Ask 11) would bring this practice back now: a hand-back without money, its Sunday open and to come,
   *  no ask waiting on it and no money settled for it. The step reads it again under the schedule's lock. */
  canTakeBack: boolean;
  /** What asking later would ask (Ask 12), in cents — Ask 1's figure, never more than the room. Null when there is
   *  nothing to ask: the club billed nothing for the time, the team has nothing left to ask back, or an ask was made. */
  askCents: number | null;
  /** The ask over it made later — the latest waiting or answered one (a withdrawn ask leaves nothing). */
  late: { id: string; state: 'waiting' | 'accepted' | 'declined'; askedOn: string; closedOn: string | null; cents: number; count: number; reason: string | null } | null;
  /** What the money did: the ask with its tick, or the late ask, the club accepted. */
  settled: { on: string; creditedCents: number; toPayCents: number } | null;
}

type HbRow = {
  id: string; state: 'landed' | 'accepted'; schedule_id: string; asked_at: string; closed_at: string | null;
  credited_cents: number | string | null; to_pay_cents: number | string | null;
  club_schedules: { name: string; state: string; bill_scale: number | string | null; allocation_id: string | null } | null;
};
type LateRow = {
  id: string; late_for: string; state: 'waiting' | 'accepted' | 'declined'; asked_at: string; closed_at: string | null;
  asked_cents: number | string | null; accepted_cents: number | string | null; credited_cents: number | string | null;
  to_pay_cents: number | string | null; decline_reason: string | null; club_schedule_hand_back_slots: { id: string }[] | null;
};

const clubDay = (iso: string) => utcToZonedInputs(iso).date;

/** The club billed its teams for this schedule's time (Ask 1's test): final, priced, and a bill drawn. */
export const billedScheduleRow = (s: { state: string; bill_scale: number | string | null; allocation_id: string | null }) =>
  s.state === 'final' && !!Number(s.bill_scale ?? 0) && !!s.allocation_id;

/** What the team may still ask back from a schedule, in cents (`club_hand_back_room`, mig 328). */
export async function handBackRoom(orgId: string, scheduleId: string, teamId: string, except: string | null): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('club_hand_back_room', { p_org: orgId, p_schedule: scheduleId, p_team: teamId, p_except: except });
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * THE TEAM'S HANDED-BACK PRACTICES, by slot (C2): for each of these slots the team's latest hand-back that took it (a
 * landed one, or an ask with its tick the club accepted — never a late ask, which only asks for money), the rest of it
 * still handed back, where its Sunday stands, and what the coach can still do. `slotIds`: the slots of the team's
 * CANCELLED club practices (a slot handed back before mig 330 may have lost its practice — it isn't asked for).
 */
export async function practiceHandBacks(orgId: string, teamId: string, slotIds: readonly string[]): Promise<Map<string, PracticeHandBack>> {
  const out = new Map<string, PracticeHandBack>();
  if (!slotIds.length) return out;
  const mine = await fetchAllIn<{ slot_id: string; club_schedule_hand_backs: HbRow }>([...new Set(slotIds)], (c, a, b) => supabaseAdmin
    .from('club_schedule_hand_back_slots')
    .select('slot_id, club_schedule_hand_backs!inner ( id, state, schedule_id, asked_at, closed_at, credited_cents, to_pay_cents, club_schedules ( name, state, bill_scale, allocation_id ) )')
    .eq('org_id', orgId).eq('handed_back', true).in('slot_id', c)
    .eq('club_schedule_hand_backs.team_id', teamId).in('club_schedule_hand_backs.state', ['landed', 'accepted'])
    .is('club_schedule_hand_backs.late_for', null).order('id').range(a, b));
  if (!mine.length) return out;
  // The hand-back's day: a landed one's moment, an accepted ask's answer. A Sunday handed back, given back and handed
  // back again reads its latest.
  const when = (h: HbRow) => (h.state === 'accepted' ? h.closed_at : null) ?? h.asked_at;
  const bySlot = new Map<string, HbRow>();
  for (const m of mine) {
    const cur = bySlot.get(m.slot_id);
    if (!cur || when(m.club_schedule_hand_backs) > when(cur)) bySlot.set(m.slot_id, m.club_schedule_hand_backs);
  }
  const hbs = new Map([...bySlot.values()].map(h => [h.id, h]));
  const ids = [...hbs.keys()];
  const [rows, lates, slots] = await Promise.all([
    fetchAllIn<{ hand_back_id: string; starts_at: string; cents: number | string; club_schedule_slots: { club_schedule_slot_teams: { team_id: string }[] | null } | null }>(ids, (c, a, b) => supabaseAdmin
      .from('club_schedule_hand_back_slots').select('hand_back_id, starts_at, cents, club_schedule_slots ( club_schedule_slot_teams ( team_id ) )')
      .eq('org_id', orgId).eq('handed_back', true).in('hand_back_id', c).order('id').range(a, b)),
    fetchAllIn<LateRow>(ids, (c, a, b) => supabaseAdmin.from('club_schedule_hand_backs')
      .select('id, late_for, state, asked_at, closed_at, asked_cents, accepted_cents, credited_cents, to_pay_cents, decline_reason, club_schedule_hand_back_slots ( id )')
      .eq('org_id', orgId).in('late_for', c).in('state', ['waiting', 'accepted', 'declined']).order('id').range(a, b)),
    fetchAllIn<StandingSlot & { id: string }>([...bySlot.keys()], (c, a, b) => supabaseAdmin
      .from('club_schedule_slots').select('id, starts_at, removed_at, club_schedule_slot_teams ( team_id )').eq('org_id', orgId).in('id', c).order('id').range(a, b)),
  ]);
  const lateOf = new Map<string, LateRow>();
  for (const l of lates) {
    const cur = lateOf.get(l.late_for);
    if (!cur || l.asked_at > cur.asked_at) lateOf.set(l.late_for, l);
  }
  // The room is read only where a late ask is still possible: a landed hand-back with no ask over it, on a billed schedule.
  const askable = [...hbs.values()].filter(h => h.state === 'landed' && !lateOf.has(h.id) && h.club_schedules && billedScheduleRow(h.club_schedules));
  const rooms = new Map(await Promise.all([...new Set(askable.map(h => h.schedule_id))]
    .map(async id => [id, await handBackRoom(orgId, id, teamId, null)] as const)));
  // Still handed back: a Sunday the club has given back to the team is the team's again — neither counted nor asked for.
  const rowsOf = new Map<string, typeof rows>();
  for (const r of rows.filter(r => !(r.club_schedule_slots?.club_schedule_slot_teams ?? []).some(t => t.team_id === teamId))
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at))) {
    rowsOf.set(r.hand_back_id, [...(rowsOf.get(r.hand_back_id) ?? []), r]);
  }
  const slotById = new Map(slots.map(s => [s.id, s]));
  const now = new Date().toISOString();
  const num = (v: number | string | null) => Number(v ?? 0);

  for (const [slotId, h] of bySlot) {
    const own = rowsOf.get(h.id) ?? [];
    const slot = slotStanding(slotById.get(slotId), teamId, now);
    const l = h.state === 'landed' ? lateOf.get(h.id) ?? null : null;
    const late = l ? {
      id: l.id, state: l.state, askedOn: clubDay(l.asked_at), closedOn: l.closed_at ? clubDay(l.closed_at) : null,
      cents: l.state === 'accepted' ? num(l.accepted_cents) : num(l.asked_cents), count: (l.club_schedule_hand_back_slots ?? []).length,
      reason: l.decline_reason,
    } : null;
    const settled = h.state === 'accepted'
      ? { on: clubDay(h.closed_at ?? h.asked_at), creditedCents: num(h.credited_cents), toPayCents: num(h.to_pay_cents) }
      : l?.state === 'accepted' ? { on: clubDay(l.closed_at ?? l.asked_at), creditedCents: num(l.credited_cents), toPayCents: num(l.to_pay_cents) }
      : null;
    const room = h.state === 'landed' && !l ? rooms.get(h.schedule_id) : undefined;
    const figure = room == null ? 0 : Math.min(own.reduce((n, r) => n + num(r.cents), 0), room);
    out.set(slotId, {
      id: h.id, kind: h.state === 'landed' ? 'landed' : 'asked', scheduleId: h.schedule_id, scheduleName: h.club_schedules?.name ?? '', on: clubDay(when(h)),
      days: own.map(r => clubDay(r.starts_at)), slot,
      canTakeBack: h.state === 'landed' && slot === 'open' && (!l || l.state === 'declined'),
      askCents: figure > 0 ? figure : null,
      late, settled,
    });
  }
  return out;
}
