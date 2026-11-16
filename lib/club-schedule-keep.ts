import { addCalendarDays, mondayOfDay, utcToZonedInputs } from './timezone';
import { clock, overlappingBlocks, weekdayOf, type DateOff } from './permit-time';
import { isPrimeSlot, type ScheduleBlock, type ScheduleTime, type Slot, type WeightOf } from './club-schedule-engine';
import type { ScheduleSettings } from './club-schedule-settings';
import { mergeDatesOff } from './club-schedule-permit-rows';

// ---------------------------------------------------------------------------
// WHAT A CHANGE TO A SCHEDULE'S TIME KEEPS EXACTLY AS IT IS (a schedule on several permits, Session E; owner rulings
// S1 A, P10 A, P11 A). Pure: no database, no request — the routes read, this decides.
//
// Three changes reach the time of a schedule that exists, and each makes one promise:
//   · REGENERATE (Settings…, "Regenerate the unlocked slots…", "Take … off"): on a SENT schedule, nothing before today
//     moves (P10 A, finding F1). Every slot whose day has passed is kept as it was sent — its place, its teams, its row's
//     permit (what prices it) — locked or not, even when the new time no longer holds it.
//   · ADD TIME (S1 A): nothing already on the schedule moves, locked or not; only the NEW rows are cut into slots.
//   · TAKE A PERMIT OFF (P11 A): only that permit's slots come off — from today on, on a sent schedule — and nothing
//     else moves.
// One rule, three doors: `pinnedSlots` says which stored slots stay, `timeKeeping` gives them the rows they need, and
// `slotsWithPinned` puts them in the cut. Guard 4 of the build prompt (`club-schedule-keep.test.ts`).
// ---------------------------------------------------------------------------

/** A stored slot as this module reads it (`StoredSlot` in `club-schedule-server.ts`). */
export interface KeepSlot {
  key: string;
  venueId: string;
  facilityId: string | null;
  blockId: string | null;
  permitId: string | null;
  startsAt: string;
  endsAt: string;
  teamIds: string[];
  locked: boolean;
  movedByHand: boolean;
  removed: boolean;
}

export type KeepChange =
  | { kind: 'regenerate' }
  | { kind: 'add' }
  | { kind: 'take_off'; permitId: string };

/** A slot as the engine reads it, rebuilt from what is stored (the bill, the send and a kept slot all read it so). */
export function engineSlotOf(s: Pick<KeepSlot, 'key' | 'venueId' | 'facilityId' | 'startsAt' | 'endsAt'> & { permitId?: string | null }, blockIndex: number, settings: Pick<ScheduleSettings, 'prime'>, weightOf: WeightOf): Slot {
  const start = utcToZonedInputs(s.startsAt), end = utcToZonedInputs(s.endsAt);
  const weekday = weekdayOf(start.date);
  return {
    key: s.key, venueId: s.venueId, facilityId: s.facilityId, blockIndex, day: start.date, weekday, week: mondayOfDay(start.date),
    startClock: start.time, endClock: end.time, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt),
    pos: `${weekday}|${start.time}|${s.venueId}|${s.facilityId ?? ''}`,
    prime: isPrimeSlot(settings.prime, weekday, start.time, end.time), weight: weightOf(s.facilityId, s.permitId ?? null),
    ...(s.permitId ? { permitId: s.permitId } : {}),
  };
}

/** A stored slot's club day. */
const clubDayOf = (s: Pick<KeepSlot, 'startsAt'>) => utcToZonedInputs(s.startsAt).date;

/**
 * The stored slots a change keeps EXACTLY as they are — never re-cut, never given other teams, never removed:
 *  · regenerate — on a sent schedule, every slot before `today` (P10 A);
 *  · add        — every slot on the schedule (S1 A);
 *  · take_off   — every slot not on that permit, and on a sent schedule that permit's own before `today` too (P11 A).
 * A slot removed and waiting for Send the changes is not kept (it is already going). A slot locked or moved by hand is
 * the regenerate's OTHER keep (Ask 19): kept only while the new time still holds it — not this rule's.
 */
export function pinnedSlots<S extends KeepSlot>(stored: readonly S[], change: KeepChange, o: { final: boolean; today: string }): S[] {
  const past = (s: S) => o.final && clubDayOf(s) < o.today;
  return stored.filter(s => {
    if (s.removed) return false;
    if (change.kind === 'add') return true;
    if (change.kind === 'take_off') return s.permitId !== change.permitId || past(s);
    return past(s);
  });
}

/** Does this row of time hold that slot — its place, its weekday, its hours, its dates, and the SAME permit (what prices it)? */
export function blockHolds(b: ScheduleBlock, s: Slot, range: { startsOn: string; endsOn: string }): boolean {
  if (b.venueId !== s.venueId) return false;
  if (b.facilityIds.length && (s.facilityId == null || !b.facilityIds.includes(s.facilityId))) return false;
  if (!b.weekdays.includes(s.weekday)) return false;
  if (clock(b.startTime) > s.startClock || s.endClock > clock(b.endTime)) return false;
  if (s.day < (b.fromDate ?? range.startsOn) || s.day > (b.untilDate ?? range.endsOn)) return false;
  return (b.permitId ?? null) === (s.permitId ?? null);
}

export interface Keeping {
  /** The time the change saves: what was asked, plus every row a kept slot needs (below). */
  time: ScheduleTime & { blockIds: (string | null)[] };
  /** The kept slots, as the engine reads them, each pointing at its row in `time`. */
  pinned: Slot[];
  /** On a sent schedule, today: nothing NEW is cut before it. Null on a draft or a schedule in review. */
  pastFrom: string | null;
  /** The rows fresh slots may be cut from (Add time: the new rows only; Take … off: none). Null = every row. */
  freshBlocks: ReadonlySet<number> | null;
}

/**
 * The time a change saves, so every kept slot still sits on a row of it:
 *  · a kept slot a row of the asked time holds (same place, day, hours and permit) is that row's;
 *  · otherwise its OWN stored row comes back, ending the day before today (a sent schedule's row edited, narrowed or
 *    taken out keeps its past: "Tue 6–8 p.m. until Nov 15", beside the new "Tue 6:30–8:30 p.m. from Nov 16"), with its
 *    stored id, so the slots on it keep their row;
 *  · a row of the asked time that overlaps a row brought back starts today, so the two never hold the same evening;
 *  · the dates stretch to cover every kept slot.
 * A kept slot whose stored row is gone (an old slot, its block deleted before this rule) gets a row of its own: its one
 * day, its hours, its place and permit.
 */
export function timeKeeping(
  asked: ScheduleTime & { blockIds: readonly (string | null)[] },
  stored: { blocks: readonly ScheduleBlock[]; blockIds: readonly string[]; endsOn: string },
  pinnedStored: readonly KeepSlot[],
  o: { settings: Pick<ScheduleSettings, 'prime'>; weightOf: WeightOf; venueFacilities: ReadonlyMap<string, readonly string[]>; pastFrom: string | null; freshBlocks?: 'all' | 'new' | 'none' },
): Keeping {
  const blocks: ScheduleBlock[] = asked.blocks.map(b => ({ ...b }));
  const blockIds: (string | null)[] = [...asked.blockIds];
  const askedCount = blocks.length;
  /** The asked rows' ids; the rows brought back are only ever pushed past them, so this never changes. */
  const askedIds = blockIds.slice(0, askedCount);
  const slots = pinnedStored.map(s => ({ stored: s, slot: engineSlotOf(s, -1, o.settings, o.weightOf) }));
  let startsOn = asked.startsOn, endsOn = asked.endsOn;
  for (const { slot } of slots) {
    if (slot.day < startsOn) startsOn = slot.day;
    if (slot.day > endsOn) endsOn = slot.day;
  }
  const range = () => ({ startsOn, endsOn });
  const yesterday = o.pastFrom ? addCalendarDays(o.pastFrom, -1) : null;
  /** The asked rows that now start today (they overlapped a row brought back). */
  const trimmed = new Set<number>();
  /** Stored row id (or a slot's own key, for a row-less slot) → its index in `blocks`, once brought back. */
  const brought = new Map<string, number>();
  const at = new Map<string, number>();

  // Settles in a few passes: a row trimmed to start today holds no past slot any more, so its slots bring their own back,
  // which may trim another row. Each pass trims at least one more row or stops.
  for (let pass = 0; pass <= askedCount; pass++) {
    at.clear();
    for (const { stored: s, slot } of slots) {
      // Its own stored row first, when the asked time kept it (by id), then any asked row that holds it.
      const own = s.blockId ? askedIds.indexOf(s.blockId) : -1;
      const i = own >= 0 && blockHolds(blocks[own], slot, range()) ? own
        : blocks.findIndex((b, j) => j < askedCount && blockHolds(b, slot, range()));
      if (i >= 0) { at.set(s.key, i); continue; }
      const storedAt = s.blockId ? stored.blockIds.indexOf(s.blockId) : -1;
      const id = storedAt >= 0 ? s.blockId! : `slot:${s.key}`;
      // The stored row's id goes with it — unless the asked time still has that row (edited): then it comes back as a new row.
      const ownId = storedAt >= 0 && !askedIds.includes(s.blockId) ? s.blockId : null;
      let j = brought.get(id);
      if (j === undefined) {
        const was = storedAt >= 0 ? stored.blocks[storedAt] : null;
        const until = was ? minDay(was.untilDate ?? stored.endsOn, yesterday) : slot.day;
        const row: ScheduleBlock = was
          ? { ...was, untilDate: until }
          : {
            id: `kept-${s.key}`, venueId: s.venueId, facilityIds: s.facilityId ? [s.facilityId] : [], weekdays: [slot.weekday],
            startTime: slot.startClock, endTime: slot.endClock, fromDate: slot.day, untilDate: slot.day, permitId: s.permitId,
          };
        j = blocks.push(row) - 1;
        blockIds.push(ownId);
        brought.set(id, j);
      }
      at.set(s.key, j);
    }
    // An asked row that meets a row brought back starts today (only on a sent schedule: a draft keeps nothing by day).
    let more = false;
    if (o.pastFrom) {
      for (let i = 0; i < askedCount; i++) {
        if (trimmed.has(i)) continue;
        const a = blocks[i];
        const meets = [...brought.values()].some(j => overlappingBlocks({ blocks: [withDates(a, range()), withDates(blocks[j], range())] }, o.venueFacilities));
        if (!meets) continue;
        trimmed.add(i);
        blocks[i] = { ...a, fromDate: maxDay(a.fromDate ?? startsOn, o.pastFrom) };
        more = true;
      }
    }
    if (!more) break;
  }

  // A trimmed row left with no day at all goes (its past is held by the row brought back).
  const keep = blocks.map((b, i) => i >= askedCount || !trimmed.has(i) || (b.fromDate ?? startsOn) <= (b.untilDate ?? endsOn));
  const index = new Map<number, number>();
  const outBlocks: ScheduleBlock[] = [], outIds: (string | null)[] = [];
  blocks.forEach((b, i) => { if (keep[i]) { index.set(i, outBlocks.length); outBlocks.push(b); outIds.push(blockIds[i]); } });
  const pinned = slots.map(({ stored: s, slot }) => ({ ...slot, blockIndex: index.get(at.get(s.key)!)! }));

  const fresh = o.freshBlocks ?? 'all';
  const freshBlocks = fresh === 'all' ? null
    : new Set(fresh === 'none' ? [] : asked.blockIds.map((id, i) => (id == null && keep[i] ? index.get(i)! : -1)).filter(i => i >= 0));
  return {
    time: { startsOn, endsOn, blocks: outBlocks, datesOff: asked.datesOff, blockIds: outIds },
    pinned, pastFrom: o.pastFrom, freshBlocks,
  };
}

/**
 * The slots a change hands the engine (and the save): the kept slots as they are, and the fresh cut less what it may not
 * touch — a kept slot's place and start, anything before today on a sent schedule, anything on a row that is not fresh,
 * and anything that would overlap a kept slot on its facility.
 */
export function slotsWithPinned(fresh: readonly Slot[], k: Pick<Keeping, 'pinned' | 'pastFrom' | 'freshBlocks'>, venueFacilities: ReadonlyMap<string, readonly string[]>): Slot[] {
  const keys = new Set(k.pinned.map(s => s.key));
  const meets = (s: Slot) => k.pinned.some(p => p.venueId === s.venueId && (p.facilityId == null || s.facilityId == null || p.facilityId === s.facilityId)
    && p.startMs < s.endMs && s.startMs < p.endMs);
  const cut = fresh.filter(s => !keys.has(s.key)
    && (!k.pastFrom || s.day >= k.pastFrom)
    && (!k.freshBlocks || k.freshBlocks.has(s.blockIndex))
    && !meets(s));
  // The cut's own order (`cutSlots`): by start, then venue, then the facility's place at its venue.
  const order = new Map<string, number>();
  for (const list of venueFacilities.values()) list.forEach((f, i) => order.set(f, i));
  return [...cut, ...k.pinned].sort((a, b) => a.startMs - b.startMs || a.venueId.localeCompare(b.venueId)
    || (order.get(a.facilityId ?? '') ?? 0) - (order.get(b.facilityId ?? '') ?? 0));
}

/**
 * ADD TIME's request, made whole: the schedule's own rows (by id, untouched) and then the new ones, its first day, the
 * later of the two last days, and the dates off one per day — what is stored, with the new ones joined in (All venues
 * stays all; otherwise the parks unite). The settings are the schedule's: Add time changes no setting.
 */
export function addedTime(
  stored: { startsOn: string; endsOn: string; blocks: readonly ScheduleBlock[]; blockIds: readonly string[]; datesOff: readonly DateOff[] },
  added: { endsOn: string; blocks: readonly ScheduleBlock[]; datesOff: readonly DateOff[] },
): ScheduleTime & { blockIds: (string | null)[] } {
  // One per day: All venues wins, otherwise the parks unite (the form's own merge).
  const datesOff = mergeDatesOff([...stored.datesOff, ...added.datesOff], { parks: [], permitParks: () => [] })
    .sort((a, b) => a.day.localeCompare(b.day));
  const widens = added.endsOn > stored.endsOn;
  return {
    startsOn: stored.startsOn,
    endsOn: widens ? added.endsOn : stored.endsOn,
    // A row that ran to the schedule's last day keeps that day when the end widens: the new weeks are the new rows' only
    // (Milton spring ends May 29; widening to Jun 30 for Milton June never gives Milton spring a June).
    blocks: [...stored.blocks.map(b => (widens && !b.untilDate ? { ...b, untilDate: stored.endsOn } : b)), ...added.blocks],
    blockIds: [...stored.blockIds, ...added.blocks.map(() => null)],
    datesOff,
  };
}

/** The practices before today a change keeps on a sent schedule — kept slots with a team, before `pastFrom` (the
 *  regenerate question says how many stay, P10 A). */
export function pastPractices(k: Pick<Keeping, 'pinned' | 'pastFrom'> & { stored: readonly Pick<KeepSlot, 'key' | 'teamIds'>[] }): number {
  if (!k.pastFrom) return 0;
  const past = new Set(k.pinned.filter(p => p.day < k.pastFrom!).map(p => p.key));
  return k.stored.filter(s => s.teamIds.length && past.has(s.key)).length;
}

const minDay = (a: string, b: string | null) => (b && b < a ? b : a);
const maxDay = (a: string, b: string) => (b > a ? b : a);
/** A row with its dates said (a row with none runs on the schedule's), for the overlap check. */
const withDates = (b: ScheduleBlock, range: { startsOn: string; endsOn: string }): ScheduleBlock =>
  ({ ...b, fromDate: b.fromDate ?? range.startsOn, untilDate: b.untilDate ?? range.endsOn });
