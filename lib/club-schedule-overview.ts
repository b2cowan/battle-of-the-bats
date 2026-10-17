/** A read-only summary of the dates already shown by the club schedule's grid. */
import { utcToZonedInputs } from './timezone';
import { placeKey, type PlaceRow, type ScheduleAsk, type SlotView } from './club-schedule-view';

export interface OverviewDate {
  day: string;
  slots: SlotView[];
}

export interface OverviewPattern {
  key: string;
  place: PlaceRow;
  startClock: string;
  endClock: string;
  /** The most frequent nonempty assignment; ties take the first visible date. */
  usual: SlotView[];
  usualDays: string[];
  different: OverviewDate[];
}

/** A slot's operational marks matter: a clash, ask, lock or hand-back must never disappear into a usual run. */
function slotSignature(slot: SlotView, askedIds: ReadonlySet<string>): string {
  return JSON.stringify([
    slot.teamIds, slot.heldBy?.kind ?? null, slot.heldBy?.ownerName ?? null,
    slot.handedBack?.teamId ?? null, slot.locked, slot.movedByHand, slot.clash, askedIds.has(slot.id),
  ]);
}

function dateSignature(slots: readonly SlotView[], askedIds: ReadonlySet<string>): string {
  return JSON.stringify(slots.map(slot => slotSignature(slot, askedIds)));
}

/** Group identical assignments only within the visible dates. Every unlike or missing date stays in `different`. */
export function scheduleOverview(
  rows: readonly PlaceRow[], days: readonly string[], slots: readonly SlotView[], askedIds: ReadonlySet<string>,
): OverviewPattern[] {
  const visible = new Set(days);
  const byPlace = new Map<string, Map<string, Map<string, SlotView[]>>>();
  for (const slot of slots) {
    if (!visible.has(slot.day)) continue;
    const place = placeKey(slot.venueId, slot.facilityId);
    const clock = JSON.stringify([slot.startClock, slot.endClock]);
    const clocks = byPlace.get(place) ?? byPlace.set(place, new Map()).get(place)!;
    const dates = clocks.get(clock) ?? clocks.set(clock, new Map()).get(clock)!;
    (dates.get(slot.day) ?? dates.set(slot.day, []).get(slot.day)!).push(slot);
  }

  return rows.flatMap(place => {
    const clocks = byPlace.get(place.key);
    if (!clocks) return [];
    return [...clocks].sort(([a], [b]) => a.localeCompare(b)).map(([clock, dates]) => {
      const [startClock, endClock] = JSON.parse(clock) as [string, string];
      const reads = days.map(day => ({ day, slots: dates.get(day) ?? [] }));
      const frequencies = new Map<string, number>();
      for (const read of reads) {
        if (!read.slots.length) continue;
        const key = dateSignature(read.slots, askedIds);
        frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
      }
      let usualKey = '';
      let largest = 0;
      for (const read of reads) {
        if (!read.slots.length) continue;
        const key = dateSignature(read.slots, askedIds);
        const count = frequencies.get(key) ?? 0;
        if (count > largest) { largest = count; usualKey = key; }
      }
      const usualDays = reads.filter(read => read.slots.length && dateSignature(read.slots, askedIds) === usualKey).map(read => read.day);
      return {
        key: `${place.key}|${clock}`, place, startClock, endClock,
        usual: reads.find(read => read.day === usualDays[0])?.slots ?? [],
        usualDays,
        different: reads.filter(read => !read.slots.length || dateSignature(read.slots, askedIds) !== usualKey),
      };
    });
  });
}

/** The next affected club day is the practical deadline. Late asks use their recorded hand-back day. */
export function orderScheduleAsks(asks: readonly ScheduleAsk[], slots: readonly Pick<SlotView, 'id' | 'day'>[]): ScheduleAsk[] {
  const dayById = new Map(slots.map(slot => [slot.id, slot.day]));
  const dayOf = (ask: ScheduleAsk): string => {
    if (ask.late) return ask.handedBackOn ?? ask.askedOn;
    const dates = ask.sundays.map(sunday => (sunday.slotId ? dayById.get(sunday.slotId) : null) ?? utcToZonedInputs(sunday.startsAt).date);
    return dates.sort()[0] ?? ask.askedOn;
  };
  return [...asks].sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.askedOn.localeCompare(b.askedOn) || a.id.localeCompare(b.id));
}

/** Both filters must match one assigned team, including when a time is shared across groups. */
export function matchesScheduleTeamFilter(
  teamIds: readonly string[], groups: ReadonlySet<string>, teams: ReadonlySet<string>, groupOf: (teamId: string) => string,
): boolean {
  if (!groups.size && !teams.size) return true;
  return teamIds.some(id => (!groups.size || groups.has(groupOf(id))) && (!teams.size || teams.has(id)));
}
