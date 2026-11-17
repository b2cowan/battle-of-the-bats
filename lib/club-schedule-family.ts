/**
 * A SCHEDULE AND ITS ADDED PARTS — "2 schedules built the same way, but viewed as 1" (plan
 * docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8; storage ruled B 2026-11-17, mig 491).
 *
 * An added part is its own `club_schedules` row (`part_of_schedule_id`): its own time, teams, dates off and bill. This module
 * is the pure half of reading a family as one:
 *   - `familyClashes`: what the REST of the family already holds at a slot's time — the same place, or the same team. The
 *     generator drops a slot whose place the family holds, a hand edit refuses a team the family already has then, and the
 *     page marks both (the database refuses the exact same place and start, and a team twice; the rest is said here).
 *   - `familyShown`: the page's READ of the family — the parent's view with each part's slots, places and teams laid in,
 *     and Fair shares' figures counting the whole family (Handed out, Short, Clashes — decided Session 1). Money stays the
 *     parent's: the bill, its pricing and what each team pays are the parent's bill (drawing tab 4, note 2); a part's bill
 *     is set and shown in Send the changes. Nothing that WRITES reads this view: Settings…, Bill the teams and Send keep the
 *     parent's own view, and an edit goes to the part that owns its slot.
 *   - `partChangeLines`: an unsent part's practices as Needs attention's change lines ("Gains Thu, Dec 10, 6:00 p.m. · …").
 */
import { isProgramHolder } from './club-schedule-holders';
import { PART_WORDS, changeLine } from './club-schedule-words';
import { addCalendarDays, formatStoredDate } from './timezone';
import type { ScheduleView, SlotView } from './club-schedule-server';
import type { TeamResult } from './club-schedule-engine';

/** A slot as the family check reads it: its place, its instants, its holders. */
export interface FamilySlot {
  id: string;
  venueId: string;
  facilityId: string | null;
  startMs: number;
  endMs: number;
  teamIds: readonly string[];
}

/** Another member of the family: the schedule it is (the parent, or a part), its name as the page says it, its live slots. */
export interface FamilyMember { id: string; name: string; slots: readonly FamilySlot[] }

/** What the rest of the family holds at a slot's time: the member holding its place (null: nobody), and each of its teams
 *  another member already gives that time to. */
export interface FamilyClash { placeWith: string | null; teams: { teamId: string; with: string }[] }

/** A slot is at most 24 hours (CHECK club_schedule_slots_window), so nothing that starts earlier than this can overlap. */
const LONGEST_MS = 24 * 3_600_000;

const overlaps = (a: Pick<FamilySlot, 'startMs' | 'endMs'>, b: Pick<FamilySlot, 'startMs' | 'endMs'>) => a.startMs < b.endMs && b.startMs < a.endMs;

/**
 * THE FAMILY'S CLASHES, by `own` slot id: for each slot, the other member holding the same place at an overlapping time
 * (the same venue and the same facility — a venue with no facilities is the venue itself), and each of its rep teams that
 * another member gives an overlapping slot. House league is not a team: it may hold several slots at once. A slot with
 * neither is left out.
 */
export function familyClashes(own: readonly FamilySlot[], others: readonly FamilyMember[]): Map<string, FamilyClash> {
  const theirs = others.flatMap(m => m.slots.map(s => ({ s, name: m.name }))).sort((a, b) => a.s.startMs - b.s.startMs);
  const out = new Map<string, FamilyClash>();
  if (!theirs.length) return out;
  for (const mine of own) {
    // The first of theirs that could still overlap (binary search on the start, a day back).
    let lo = 0, hi = theirs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (theirs[mid].s.startMs < mine.startMs - LONGEST_MS) lo = mid + 1; else hi = mid; }
    let placeWith: string | null = null;
    const teams: FamilyClash['teams'] = [];
    const mineTeams = mine.teamIds.filter(id => !isProgramHolder(id));
    for (let i = lo; i < theirs.length && theirs[i].s.startMs < mine.endMs; i++) {
      const { s, name } = theirs[i];
      if (!overlaps(mine, s)) continue;
      if (placeWith == null && s.venueId === mine.venueId && (s.facilityId ?? null) === (mine.facilityId ?? null)) placeWith = name;
      for (const t of mineTeams) if (s.teamIds.includes(t) && !teams.some(x => x.teamId === t)) teams.push({ teamId: t, with: name });
    }
    if (placeWith != null || teams.length) out.set(mine.id, { placeWith, teams });
  }
  return out;
}

/** A page slot as the family check reads it. */
export const familySlotOf = (s: Pick<SlotView, 'id' | 'venueId' | 'facilityId' | 'startsAt' | 'endsAt' | 'teamIds'>): FamilySlot => ({
  id: s.id, venueId: s.venueId, facilityId: s.facilityId, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt), teamIds: s.teamIds,
});

/** An added part as the schedule's page reads it: its row's facts and its own view (its slots, teams, places, fairness). */
export interface PartRead {
  id: string;
  /** "Time added Nov 16" — the part's name on the page. */
  label: string;
  state: ScheduleView['schedule']['state'];
  version: number;
  startsOn: string;
  endsOn: string;
  sent: { at: string } | null;
  /** A bill rides with it (chosen at Send the changes, or made): Needs attention says so while it has none. Never money. */
  billed: boolean;
  view: ScheduleView;
}

/** Fair shares' per-team results, added up across the family: counts and minutes add; the facilities a team used is the
 *  most any one part gave it (they are different time); its nights are every night it plays. */
export function addTeamResults(lists: readonly (readonly TeamResult[])[]): TeamResult[] {
  const out = new Map<string, TeamResult>();
  for (const list of lists) {
    for (const r of list) {
      const was = out.get(r.teamId);
      if (!was) { out.set(r.teamId, { ...r, nights: [...r.nights] }); continue; }
      out.set(r.teamId, {
        teamId: r.teamId,
        target: was.target + r.target, got: was.got + r.got, primeTarget: was.primeTarget + r.primeTarget, prime: was.prime + r.prime,
        units: was.units + r.units, shared: was.shared + r.shared, minutes: was.minutes + r.minutes, pricedMinutes: was.pricedMinutes + r.pricedMinutes,
        early: was.early + r.early, facilities: Math.max(was.facilities, r.facilities),
        nights: [...new Set([...was.nights, ...r.nights])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)),
        short: was.short + r.short,
      });
    }
  }
  return [...out.values()];
}

/**
 * THE FAMILY, READ AS ONE (drawing tab 4): the parent's view with every part's slots (each tagged with its part, and
 * `unsent` until its first send — the grid's soft olive), places and teams; the page's dates widened to the family's; the
 * parent "Changed since sent" while a part waits to be sent; Fair shares' figures counting the whole family. A slot another
 * member holds the same place at is HELD by that member, and a team the family already has then is a CLASH. Money is the
 * parent's own. With no parts it returns the parent's view unchanged.
 */
export function familyShown<V extends ScheduleView>(parent: V, parts: readonly PartRead[]): V {
  if (!parts.length) return parent;
  const members = [{ id: null as string | null, name: parent.schedule.name, view: parent, unsent: false },
    ...parts.map(p => ({ id: p.id as string | null, name: p.label, view: p.view, unsent: p.state !== 'final' }))];
  const asFamily = members.map(m => ({ m, slots: m.view.slots.map(familySlotOf) }));
  const slots: SlotView[] = [];
  for (const { m, slots: mine } of asFamily) {
    const clashes = familyClashes(mine, asFamily.filter(x => x.m !== m).map(x => ({ id: x.m.id ?? parent.schedule.id, name: x.m.name, slots: x.slots })));
    for (const s of m.view.slots) {
      const c = clashes.get(s.id);
      const heldBy = s.heldBy ?? (c?.placeWith ? { ownerName: c.placeWith, kind: null } : null);
      slots.push({ ...s, partId: m.id, unsent: m.unsent, heldBy, clash: s.clash || (!!c?.placeWith && s.teamIds.length > 0) || !!c?.teams.length });
    }
  }
  slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.key.localeCompare(b.key));

  const places = new Map<string, ScheduleView['places'][number]>();
  for (const { m } of asFamily) {
    for (const p of m.view.places) {
      const was = places.get(p.venueId);
      if (!was) { places.set(p.venueId, { ...p, facilities: [...p.facilities] }); continue; }
      for (const f of p.facilities) if (!was.facilities.some(x => x.id === f.id)) was.facilities.push(f);
    }
  }
  const teams = [...parent.teams];
  for (const p of parts) for (const t of p.view.teams) if (!teams.some(x => x.id === t.id)) teams.push(t);

  const sum = (of: (t: ScheduleView['fairness']['totals']) => number) => members.reduce((n, m) => n + of(m.view.fairness.totals), 0);
  const s = parent.schedule;
  const out: ScheduleView = {
    ...parent,
    schedule: {
      ...s,
      startsOn: members.reduce((d, m) => (m.view.schedule.startsOn < d ? m.view.schedule.startsOn : d), s.startsOn),
      endsOn: members.reduce((d, m) => (m.view.schedule.endsOn > d ? m.view.schedule.endsOn : d), s.endsOn),
      changedSinceSent: s.changedSinceSent || parts.some(p => p.state !== 'final'),
    },
    places: [...places.values()],
    teams,
    slots,
    fairness: {
      totals: {
        slots: sum(t => t.slots), seats: sum(t => t.seats), handedOut: sum(t => t.handedOut), open: sum(t => t.open),
        held: sum(t => t.held), short: sum(t => t.short), clashes: slots.filter(x => x.clash).length,
      },
      teams: addTeamResults(members.map(m => m.view.fairness.teams)),
    },
    // A waiting hand-back ask on a part is the club's to answer from this page too.
    asks: [...parent.asks, ...parts.flatMap(p => p.view.asks)],
  };
  // Whatever else the page read beside the view (its replies, send log, changes) rides along unchanged.
  return out as V;
}

/** A family member's view, by the part a page slot belongs to (null: the parent). */
export function memberView(parent: ScheduleView, parts: readonly PartRead[], partId: string | null | undefined): ScheduleView {
  return (partId && parts.find(p => p.id === partId)?.view) || parent;
}

/** An unsent part's practices as Needs attention's change lines — each team's new time, said as the send says it. */
export function partChangeLines(part: Pick<PartRead, 'view'>): { teamId: string; teamName: string; lines: string[] }[] {
  const v = part.view;
  const name = new Map(v.teams.map(t => [t.id, t.name]));
  const venue = new Map(v.places.map(p => [p.venueId, p]));
  const out = new Map<string, string[]>();
  for (const s of v.slots) {
    for (const t of s.teamIds) {
      if (isProgramHolder(t)) continue;
      const p = venue.get(s.venueId);
      const place = [p?.venueName ?? '', s.facilityId ? p?.facilities.find(f => f.id === s.facilityId)?.name ?? '' : ''].filter(Boolean).join(' · ');
      const line = changeLine({ kind: 'gains', startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt), place }, () => ({ day: s.day, time: s.startClock }));
      (out.get(t) ?? out.set(t, []).get(t)!).push(line);
    }
  }
  return [...out].map(([teamId, lines]) => ({ teamId, teamName: name.get(teamId) ?? 'A team', lines }));
}

// ── Add time makes a part (Session 2 — drawing tab 3; owner rulings 1 and 7) ─────────────────────────────────────────────

/** A new part's label: "Time added Nov 17" — the date it was added, no name to type (ruling 1) — and "… (2)", "… (3)" for
 *  a second and third the same day. `taken`: every label the schedule's parts already use. */
export function partLabelFor(today: string, taken: readonly string[]): string {
  const base = PART_WORDS.label(formatStoredDate(today, { withYear: false }));
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

/** The time a family already uses on one permit: each distinct row of days and hours, and the last day any of it runs. */
export interface PermitUse { rows: { weekdays: number[]; startTime: string; endTime: string }[]; until: string }

/**
 * WHAT THE FAMILY ALREADY USES OF A PERMIT (ruling 7): Add time offers every permit, and one already on the schedule (or
 * on another part) brings only the time the family doesn't use. Its card says this in one line, and From starts where the
 * use ends (`partFromFor`). What enforces it is the cut itself: a part's draft never holds a place the family holds then.
 * Null: the family has no row on that permit.
 */
export function familyUseOf(members: readonly Pick<ScheduleView, 'schedule' | 'time'>[], permitId: string): PermitUse | null {
  const rows = new Map<string, PermitUse['rows'][number]>();
  let until = '';
  for (const m of members) {
    for (const b of m.time.blocks) {
      if (b.permitId !== permitId) continue;
      const days = [...b.weekdays].sort((x, y) => x - y);
      const startTime = b.startTime.slice(0, 5), endTime = b.endTime.slice(0, 5);
      rows.set(`${days.join()}|${startTime}|${endTime}`, { weekdays: days, startTime, endTime });
      // A row runs to its own last day, and never past its schedule's.
      const end = b.untilDate && b.untilDate < m.schedule.endsOn ? b.untilDate : m.schedule.endsOn;
      if (end > until) until = end;
    }
  }
  return rows.size ? { rows: [...rows.values()], until } : null;
}

/** Where a part's time on a permit starts: never before today (the schedule was sent), never before the permit, and — when
 *  the family already uses it — the day after that use ends, unless the use reaches the permit's end (then the left-out
 *  time is other days, hours or parks, and the cut leaves it out). */
export function partFromFor(permit: { startsOn: string; endsOn: string }, use: PermitUse | null, today: string): string {
  const after = use ? addCalendarDays(use.until, 1) : '';
  const from = after && after <= permit.endsOn ? (after > permit.startsOn ? after : permit.startsOn) : permit.startsOn;
  return from < today ? today : from;
}
