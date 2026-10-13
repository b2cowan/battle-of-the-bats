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
  decline_reason: string | null; asked_cents: number | string | null; accepted_cents: number | string | null; credited_cents: number | string | null; to_pay_cents: number | string | null;
  club_schedules: { name: string } | null;
  rep_teams: { name: string } | null;
  club_schedule_hand_back_slots: {
    slot_id: string | null; starts_at: string; ends_at: string; cents: number | string; handed_back: boolean;
    club_schedule_slots: { starts_at: string; ends_at: string; removed_at: string | null; org_venue_id: string; facility_id: string | null } | null;
  }[] | null;
};

const SELECT = 'id, state, team_id, schedule_id, asked_at, asked_by, closed_at, decline_reason, asked_cents, accepted_cents, credited_cents, to_pay_cents, '
  + 'club_schedules ( name ), rep_teams ( name ), '
  + 'club_schedule_hand_back_slots ( slot_id, starts_at, ends_at, cents, handed_back, club_schedule_slots ( starts_at, ends_at, removed_at, org_venue_id, facility_id ) )';

const num = (v: number | string | null) => (v == null ? null : Number(v));

async function summarize(orgId: string, rows: readonly Row[]): Promise<AskSummary[]> {
  // Whether each waiting ask's team still holds its slots — one read for every waiting ask, narrowed to their teams.
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
    const counted = r.state === 'waiting'
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
      askedAt: r.asked_at, askedBy: r.asked_by, closedAt: r.closed_at, declineReason: r.decline_reason,
      cents: r.state === 'accepted' ? Number(r.accepted_cents ?? 0) : r.state === 'waiting' ? sundays.reduce((n, s) => n + s.cents, 0) : Number(r.asked_cents ?? 0),
      count: sundays.length,
      first: sundays[0] ? utcToZonedInputs(sundays[0].startsAt).date : null,
      last: sundays.length ? utcToZonedInputs(sundays[sundays.length - 1].startsAt).date : null,
      weekday: commonWeekday(sundays.map(s => s.startsAt)),
      creditedCents: num(r.credited_cents), toPayCents: num(r.to_pay_cents),
      sundays,
      slotIds: slots.map(s => s.slot_id).filter((s): s is string => !!s),
      toCome: slots.some(s => !!s.club_schedule_slots && !s.club_schedule_slots.removed_at && s.club_schedule_slots.starts_at > now),
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
