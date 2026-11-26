import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { maskOf } from './field-parts';
import { holdersOf, isProgramHolder, type ProgramEmbed } from './club-schedule-holders';
import type { ScheduledTime } from './permit-time';

/**
 * EVERY SCHEDULE'S TIME, AS ITS SLOTS (Club schedules Stage 2, Session 2D — the several-permits plan's owed item, "ONE
 * /plan item for all three places that do not see other schedules' final time"). A club schedule's slots are booked
 * nowhere else until Send writes a team's practice: a FINAL schedule's open slot, its house-league time before the league
 * divides it, and a team given time after the last send are slots and nothing more. So the three readers that must see
 * them read them here, once:
 *   · the builder (`engineContext`): another schedule's final slot is taken (left out, "Spring rep holds it"); its draft
 *     slot is warned on ("Whichever is finalized first keeps it");
 *   · Find the time (`readFreeTime`): final = taken, draft = "held by a draft";
 *   · the permit's Used line (`permitUseOf`): a final slot no booking covers is unused time the schedule holds.
 * A slot taken off by Send the changes (`removed_at`) is gone here: its practices, while they last, are bookings.
 *
 * A slot as read: the Used line's shape (`ScheduledTime`: place, part, time, schedule name as `by`, what it holds, when
 * finalized), with what the builder and the finder ask besides. A slot always names its venue.
 */
export interface ScheduleSlotHeld extends ScheduledTime {
  id: string;
  familyId: string;
  state: 'draft' | 'in_review' | 'final';
  venueId: string;
}

const holdsOf = (holders: readonly string[]): ScheduledTime['holds'] =>
  !holders.length ? 'open' : holders.some(isProgramHolder) ? 'house_league' : 'teams';

type Row = {
  id: string; schedule_id: string; family_id: string; org_venue_id: string; facility_id: string | null; section_mask: number | null;
  starts_at: string; ends_at: string; created_at: string;
  club_schedule_slot_teams: { team_id: string }[] | null; club_schedule_slot_programs: ProgramEmbed;
  club_schedules: { name: string; state: ScheduleSlotHeld['state']; finalized_at: string | null } | null;
};

/** The longest a slot runs (the table's CHECK `club_schedule_slots_window`: it ends within 24 hours of its start). */
const SLOT_MAX_MS = 86_400_000;

/**
 * Every schedule's live slots meeting [fromMs, toMs). `only` narrows it for a reader that asks less: `finalOnly` (no
 * drafts) and `venueIds` (those venues).
 */
export async function readScheduleSlotsIn(
  orgId: string, fromMs: number, toMs: number, only: { finalOnly?: boolean; venueIds?: readonly string[] } = {},
): Promise<ScheduleSlotHeld[]> {
  const rows = await fetchAll<Row>((a, b) => {
    let q = supabaseAdmin.from('club_schedule_slots')
      .select('id, schedule_id, family_id, org_venue_id, facility_id, section_mask, starts_at, ends_at, created_at, club_schedule_slot_teams(team_id), club_schedule_slot_programs(program), club_schedules!inner(name, state, finalized_at)')
      .eq('org_id', orgId).is('removed_at', null)
      // The lower bound on the start keeps the read to the window, not every slot the club ever had before it.
      .gt('starts_at', new Date(fromMs - SLOT_MAX_MS).toISOString())
      .lt('starts_at', new Date(toMs).toISOString()).gt('ends_at', new Date(fromMs).toISOString());
    if (only.finalOnly) q = q.eq('club_schedules.state', 'final');
    if (only.venueIds) q = q.in('org_venue_id', [...only.venueIds]);
    return q.order('id').range(a, b);
  });
  return rows.filter(r => r.club_schedules).map(r => ({
    id: r.id, scheduleId: r.schedule_id, familyId: r.family_id, by: r.club_schedules!.name, state: r.club_schedules!.state,
    // A save keeps a slot's row while its place and start stand (mig 544), so its making says when it was gained.
    heldSince: r.club_schedules!.state === 'final' && r.club_schedules!.finalized_at
      ? Math.max(Date.parse(r.club_schedules!.finalized_at), Date.parse(r.created_at)) : null,
    venueId: r.org_venue_id, facilityId: r.facility_id, sectionMask: maskOf(r.section_mask),
    startMs: Date.parse(r.starts_at), endMs: Date.parse(r.ends_at), holds: holdsOf(holdersOf(r)),
  }));
}
