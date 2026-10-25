'use client';
/**
 * THE GENERATORS' SHARED PARTS — When and Where, ONE copy for the Round-robin generator and the Playoff generator
 * (Tournament admin redesign, Stage 3 addendum, A61 — ruled 2026-10-12: "the Round-robin generator's two-step window,
 * its frame and its When / Where parts"). Moved here unchanged from the Round-robin generator (§294 walked it), so the
 * two windows can never drift; tagged "Shared candidate · Club Stage 11" on the Stage 3 drawings — the club scheduler
 * reads them.
 *
 *   When   Day · From · Until · remove, Add a day, Game length, Turnover — the day in the house format (F105). A caller
 *          may put a line first (the Playoff generator's "Leave times and diamonds for later") and a hint under the
 *          days (the round robin's end).
 *   Where  each venue's fields as chips that toggle, All / None; a venue that IS its one field reads once (F106), a run
 *          of those shares a row; another division's kept games on the chosen fields and days named in the taken line
 *          (F69 — the drafts leave them free); temporary facilities when none is chosen. A caller may add a field last
 *          (the Playoff generator's "Final played on").
 */
import type { ReactNode } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import type { Division, Game, Venue } from '@/lib/types';
import type { ScheduleDraftSlot } from '@/lib/schedule-generator';
import { GENERATOR_WORDS as GW } from '@/lib/schedule-words';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import TimeInput from '@/components/shared/TimeInput';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import gen from './Generator.module.css';

export interface DateSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleResource {
  key: string;
  venueId: string;
  venueName: string;
  venueFacilityId?: string | null;
  label: string;
}

const venueResourceKey = (venueId: string) => `venue:${venueId}`;
const facilityResourceKey = (facilityId: string) => `facility:${facilityId}`;

export function getVenueResourceKeys(venue: Venue): string[] {
  return venue.facilities?.length
    ? venue.facilities.map(facility => facilityResourceKey(facility.id))
    : [venueResourceKey(venue.id)];
}

/** The chosen fields, as the drafts' resources (a facility labelled with its venue). */
export function selectedResourcesOf(venues: readonly Venue[], keys: ReadonlySet<string>): ScheduleResource[] {
  const resources: ScheduleResource[] = [];
  for (const venue of venues) {
    if (venue.facilities?.length) {
      for (const facility of venue.facilities) {
        const key = facilityResourceKey(facility.id);
        if (!keys.has(key)) continue;
        resources.push({ key, venueId: venue.id, venueName: venue.name, venueFacilityId: facility.id, label: `${venue.name} - ${facility.name}` });
      }
    } else {
      const key = venueResourceKey(venue.id);
      if (!keys.has(key)) continue;
      resources.push({ key, venueId: venue.id, venueName: venue.name, venueFacilityId: null, label: venue.name });
    }
  }
  return resources;
}

/** The event's days, first to last (the Day field's choices). */
export function eventDates(startDate?: string | null, endDate?: string | null): string[] {
  if (!startDate || !endDate) return [];
  const dates: string[] = [];
  const curr = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/** A temporary facility's draft lane ("Facility 2"): the same label saves to the same lane, per division. */
export const draftFacilityLaneIdForLabel = (label?: string | null): string | null => {
  const match = label?.match(/^Facility\s+(\d+)$/i);
  return match ? `draft-facility-${match[1]}` : null;
};

/**
 * Every slot the chosen days and fields hold, game after game with the turnover between (before any kept game takes
 * its share — the caller filters through `slotsClearOfTakenGames`, F69). No field chosen: temporary facilities.
 */
export function draftDaySlots(o: {
  dateSlots: readonly DateSlot[];
  resources: readonly ScheduleResource[];
  gameLength: number;
  breakLength: number;
  temporaryCount: number;
}): ScheduleDraftSlot[] {
  const totalSlots: ScheduleDraftSlot[] = [];
  const sortedDates = [...o.dateSlots].sort((a, b) => a.date.localeCompare(b.date));
  const roundTo5 = (d: Date) => { const ms = 1000 * 60 * 5; return new Date(Math.ceil(d.getTime() / ms) * ms); };
  const temporaryFacilities = Array.from(
    { length: Math.max(1, Math.min(16, Math.round(o.temporaryCount) || 1)) },
    (_, idx) => ({ id: `draft-facility-${idx + 1}`, label: `Facility ${idx + 1}` }),
  );
  sortedDates.forEach(slot => {
    if (!slot.date || !slot.startTime || !slot.endTime) return;
    let current = roundTo5(new Date(`${slot.date}T${slot.startTime}`));
    const end = new Date(`${slot.date}T${slot.endTime}`);
    while (current.getTime() + o.gameLength * 60000 <= end.getTime()) {
      const timeStr = current.toTimeString().slice(0, 5);
      if (o.resources.length === 0) {
        temporaryFacilities.forEach(facility => totalSlots.push({
          date: slot.date, time: timeStr, venueId: null, venueName: facility.label, venueFacilityId: null,
          scheduleFacilityLaneId: facility.id, scheduleFacilityLaneLabel: facility.label,
        }));
      } else {
        o.resources.forEach(resource => {
          totalSlots.push({ date: slot.date, time: timeStr, venueId: resource.venueId, venueName: resource.label, venueFacilityId: resource.venueFacilityId ?? null });
        });
      }
      current = roundTo5(new Date(current.getTime() + (o.gameLength + o.breakLength) * 60000));
    }
  });
  return totalSlots;
}

/** A game's field in words: its facility's name, else its venue's, else the lane or the typed place. */
export function fieldNameIn(venues: readonly Venue[]) {
  return (g: { venueId?: string | null; venueFacilityId?: string | null; scheduleFacilityLaneLabel?: string | null; location?: string | null }) => {
    const venue = venues.find(v => v.id === g.venueId);
    const facility = g.venueFacilityId ? venue?.facilities?.find(f => f.id === g.venueFacilityId) : null;
    return facility?.name ?? venue?.name ?? g.scheduleFacilityLaneLabel ?? g.location ?? '';
  };
}

/**
 * The other divisions' games on the chosen fields and days, said once (F69: the drafts leave them free): the taken
 * line, and the divisions it names (a card's "No clashes with …").
 */
export function takenOthersOf(o: {
  existingGames: readonly Game[];
  divisionId: string;
  dateSlots: readonly DateSlot[];
  selectedKeys: ReadonlySet<string>;
  venues: readonly Venue[];
  divisions: readonly Division[];
}): { line: string | null; divisions: string[] } {
  const chosenDays = new Set(o.dateSlots.map(s => s.date).filter(Boolean));
  const resourceOf = (g: Game) => (g.venueFacilityId ? facilityResourceKey(g.venueFacilityId) : g.venueId ? venueResourceKey(g.venueId) : null);
  const taken = o.existingGames.filter(g => {
    if (g.divisionId === o.divisionId || g.status === 'cancelled' || !g.date || !g.time || !chosenDays.has(g.date)) return false;
    const key = resourceOf(g);
    return !!key && o.selectedKeys.has(key);
  });
  const nameOfDivision = (id: string) => o.divisions.find(d => d.id === id)?.name ?? '';
  const divisions = [...new Set(taken.map(g => nameOfDivision(g.divisionId)))].filter(Boolean);
  if (taken.length === 0) return { line: null, divisions };
  const fieldName = fieldNameIn(o.venues);
  const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
  const line = GW.taken({
    divisions,
    games: taken.length,
    fields: [...new Set(taken.map(fieldName))].filter(Boolean).sort(),
    days: [...new Set(taken.map(g => g.date!))].sort().map(weekday),
    times: [...new Set([...taken].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).map(g => formatTime(g.time!)))],
  });
  return { line, divisions };
}

/** A dropdown's numbers: from, to, by. */
export const range = (from: number, to: number, by = 1) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);
/** …with the value already chosen kept, if the steps skip it. */
export const withCurrent = (list: number[], current: number) => (list.includes(current) ? list : [...list, current].sort((a, b) => a - b));

/** When: the days, then the game length and the turnover. */
export function WhenSection({
  idPrefix, dateSlots, availableDates, onAdd, onRemove, onUpdate, gameLength, onGameLength, breakLength, onBreakLength, noun,
  first, dayHint, collapsed = false,
}: {
  /** The ids' prefix ("gen" — the round robin's, unchanged — or "pg"). */
  idPrefix: string;
  dateSlots: readonly DateSlot[];
  availableDates: readonly string[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, updates: Partial<DateSlot>) => void;
  gameLength: number;
  onGameLength: (minutes: number) => void;
  breakLength: number;
  onBreakLength: (minutes: number) => void;
  /** The facilities' word ("Diamond"). */
  noun: string;
  /** A line before the days (the Playoff generator's "Leave times and diamonds for later"). */
  first?: ReactNode;
  /** A hint under the days (the round robin's end). */
  dayHint?: ReactNode;
  /** Only the first line shows (times left for later). */
  collapsed?: boolean;
}) {
  return (
    <section className={gen.section} aria-labelledby={`${idPrefix}-when`}>
      <h3 id={`${idPrefix}-when`} className={gen.sectionTitle}>{GW.sections.when}</h3>
      {first}
      {!collapsed && (
        <>
          {dateSlots.map((slot, idx) => (
            <div key={idx} className={gen.dayRow}>
              <label className={ck.field}>
                <span className={ck.label}>{GW.fields.day}</span>
                <select className={ck.select} value={slot.date} onChange={e => onUpdate(idx, { date: e.target.value })}>
                  <option value="">{GW.fields.chooseDay}</option>
                  {availableDates.map(d => <option key={d} value={d}>{formatShortWeekdayDate(d)}</option>)}
                </select>
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{GW.fields.from}</span>
                <TimeInput className={ck.input} value={slot.startTime} onChange={v => onUpdate(idx, { startTime: v })} />
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{GW.fields.until}</span>
                <TimeInput className={ck.input} value={slot.endTime} onChange={v => onUpdate(idx, { endTime: v })} />
              </label>
              <button type="button" className={gen.remove} onClick={() => onRemove(idx)} disabled={dateSlots.length === 1}
                aria-label={GW.fields.removeDay(slot.date ? formatShortWeekdayDate(slot.date) : GW.fields.day)}>
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          ))}
          {dayHint && <p className={gen.hint}>{dayHint}</p>}
          <button type="button" className={gen.door} onClick={onAdd}><Plus size={15} aria-hidden /> {GW.fields.addDay}</button>
          <div className={gen.pair2}>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.gameLength}</span>
              <select className={ck.select} value={gameLength} onChange={e => onGameLength(Number(e.target.value))} aria-describedby={`${idPrefix}-length-hint`}>
                {withCurrent([30, 45, 60, 75, 90, 105, 120, 135, 150, 180, 210, 240], gameLength).map(n => <option key={n} value={n}>{GW.fields.minutes(n)}</option>)}
              </select>
              <span id={`${idPrefix}-length-hint`} className={gen.hint}>{GW.fields.gameLengthHint}</span>
            </label>
            <label className={ck.field}>
              <span className={ck.label}>{GW.fields.turnover}</span>
              <select className={ck.select} value={breakLength} onChange={e => onBreakLength(Number(e.target.value))} aria-describedby={`${idPrefix}-turnover-hint`}>
                {withCurrent([0, 5, 10, 15, 20, 25, 30, 45, 60], breakLength).map(n => <option key={n} value={n}>{GW.fields.minutes(n)}</option>)}
              </select>
              <span id={`${idPrefix}-turnover-hint`} className={gen.hint}>{GW.fields.turnoverHint(noun)}</span>
            </label>
          </div>
        </>
      )}
    </section>
  );
}

/** Where: each venue's fields as chips, the taken line, temporary facilities when none is chosen. */
export function WhereSection({
  idPrefix, venues, selectedKeys, onToggle, onToggleVenue, onAll, onNone, takenLine, temporaryCount, onTemporaryCount, children,
}: {
  idPrefix: string;
  venues: readonly Venue[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onToggleVenue: (venue: Venue) => void;
  onAll: () => void;
  onNone: () => void;
  takenLine: string | null;
  temporaryCount: number;
  onTemporaryCount: (n: number) => void;
  /** A field last (the Playoff generator's "Final played on"). */
  children?: ReactNode;
}) {
  // The venue's name heads its fields only when they have names of their own (a park with Diamonds 1–4); a venue that
  // IS its one field ("Maple Field 1") reads once, as its chip — and a run of those shares one row (§294).
  const rows: { key: string; head?: Venue; chips: { key: string; name: string }[] }[] = [];
  for (const venue of venues) {
    const facilities = venue.facilities ?? [];
    const chips = facilities.length ? facilities.map(f => ({ key: facilityResourceKey(f.id), name: f.name })) : [{ key: venueResourceKey(venue.id), name: venue.name }];
    const headed = facilities.some(f => f.name !== venue.name);
    const last = rows.at(-1);
    if (!headed && last && !last.head) last.chips.push(...chips);
    else rows.push({ key: venue.id, head: headed ? venue : undefined, chips });
  }
  const chosen = venues.flatMap(getVenueResourceKeys).filter(k => selectedKeys.has(k)).length;
  return (
    <section className={gen.section} aria-labelledby={`${idPrefix}-where`}>
      <div className={gen.sectionHead}>
        <h3 id={`${idPrefix}-where`} className={gen.sectionTitle}>{GW.sections.where}</h3>
        {venues.length > 0 && (
          <span className={gen.headDoors}>
            <button type="button" className={gen.door} onClick={onAll}>{GW.fields.allFields}</button>
            <button type="button" className={gen.door} onClick={onNone}>{GW.fields.noFields}</button>
          </span>
        )}
      </div>
      {rows.map(({ key, head, chips }) => (
        <div key={key} className={gen.venue}>
          {head && (
            <button type="button" className={gen.venueName} onClick={() => onToggleVenue(head)}
              aria-pressed={getVenueResourceKeys(head).every(k => selectedKeys.has(k))}>
              {head.name}
            </button>
          )}
          <div className={gen.chips}>
            {chips.map(f => (
              <button key={f.key} type="button" className={gen.chip} aria-pressed={selectedKeys.has(f.key)} onClick={() => onToggle(f.key)}>
                {selectedKeys.has(f.key) && <Check size={13} aria-hidden />}{f.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {takenLine && <p className={gen.taken}>{takenLine}</p>}
      {(venues.length === 0 || chosen === 0) && (
        <div className={gen.pair2}>
          <p className={gen.hint}><b>{GW.fields.temporary}.</b> {GW.fields.temporaryHint}</p>
          <label className={ck.field}>
            <span className={ck.label}>{GW.fields.temporaryCount}</span>
            <select className={ck.select} value={temporaryCount} onChange={e => onTemporaryCount(Number(e.target.value))}>
              {range(1, 16).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}
      {children}
    </section>
  );
}
