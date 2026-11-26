/**
 * club-schedule-document.ts — A CLUB SCHEDULE ON PAPER AND IN A WORKBOOK (Club Tier Stage 11a, part B; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimen 15 "Exports"; plan §6b, Ask 26; memory `feedback_exports_house_format`).
 * Pure: the PDF's sections and the workbook's sheets, from the schedule's slots. The caller adds the house format's
 * letterhead (the club's colour band and crest — the PDF engine's; the masthead, the club's logo, the FieldLogicHQ row
 * and the print setup — the workbook's).
 *
 *   PDF      — through the shared day document (`buildDayDocument`, lib/export/schedule-document.ts — the tournament
 *              schedule's builder, its columns made parameters, never a fork): a section per day (and per venue on a
 *              day that holds two), headed "Sun, Oct 4, 2026 · 12 slots · Lakeshore Dome"; the time down, a facility
 *              per column ("Field 5 · half" for a field the permit prices at half), the team in its cell, "Open" where
 *              nobody has it; the zone, the half fields, the dates off and what a hand-back means said ONCE, in the
 *              notes under the tables — never inside a cell.
 *   Workbook — three sheets: the schedule (a row per slot: Date · Day · Start · End · Facility · Team · Group · Hours,
 *              and Cost for a money reader — each slot's share of the permit), By team (slots, hours, prime time, and
 *              the bill with its payments for a money reader) and By field (each field's hours and who had them). Hours
 *              are NUMBERS and money is money (the accounting reports' formats); the totals row is bold.
 *
 * A DRAFT says so: its subtitle reads "a draft", and its filename carries the draft's name (Ask 19).
 */
import { buildDayDocument, DAY_HEADING_SEP, type ScheduleDocument } from './export/schedule-document.ts';
import { formatShortWeekdayDate, formatStoredDate, timesInZoneSentence } from './timezone.ts';
import { formatTime, formatTimeRange, joinWithAnd, pluralize, possessive } from './utils.ts';
import { facilityListWords, weekdayCount } from './permit-words.ts';
import { fmt as money } from './coach-money-summary.ts';
import type { PriceMode } from './club-schedule-bill.ts';
import { teamsOnly } from './club-schedule-holders.ts';
import { fieldPartName, maskOf, maskSuffix, partFactor, sectionsOf, sortMasks, WHOLE } from './field-parts.ts';

/** A venue and its fields; `sections` is a field's split (Stage 2; absent: not split). */
export interface DocPlace { venueId: string; venueName: string; facilities: { id: string; name: string; sections?: number }[] }
export interface DocTeam { id: string; name: string; groupName: string | null }
export interface DocSlot {
  key: string; venueId: string; facilityId: string | null; day: string; weekday: number;
  startClock: string; endClock: string; startsAt: string; endsAt: string;
  /** `weight` is the slot's whole price weight: the field's permit share × its part's size (Session 2B's one weight). */
  teamIds: string[]; weight: number; prime: boolean;
  /** The part of its field it is on (Stage 2; absent: the whole field). */
  sectionMask?: number;
  heldBy: { ownerName: string; kind: string | null } | null;
  handedBackTeamId?: string | null;
  /** The permit that prices it (several permits, Session C). */
  pricePermitId?: string | null;
}

export interface ScheduleDocInput {
  name: string;
  /** A draft's label ("Best overall") — the file says "a draft" and names it. Null on a kept schedule. */
  draftLabel?: string | null;
  /** The kept schedule's state, when it isn't a draft step-2 export. */
  state?: 'draft' | 'in_review' | 'final' | null;
  /** "Final, sent Sep 23 by Jordan Reyes" — how the schedule stands, said in the subtitle. */
  sentWords?: string | null;
  startsOn: string;
  endsOn: string;
  places: readonly DocPlace[];
  teams: readonly DocTeam[];
  slots: readonly DocSlot[];
  /** `venueIds`: the parks a date off closes (mig 488); none = every park. */
  datesOff: readonly { day: string; note: string | null; venueIds?: readonly string[] }[];
  /** Names of parks a date off names that no row of the schedule uses (so `places` can't name them): venue id → name. */
  offParkNames?: Readonly<Record<string, string>>;
  /** The permit's price, for a MONEY reader only: an hour of a full field, its cost, its reference words. On several
   *  permits (Session C): each permit's hour, and how the bill prices them (each permit's price, or one rate for all). */
  pricing?: {
    fullHour: number | null; permitCost: number | null; permitName: string | null;
    mode?: PriceMode;
    permits?: readonly { id: string; name: string; fullHour: number | null }[];
  } | null;
  /** Each team's bill (a money reader, a bill riding with the schedule): its share and payments, in dollars. */
  bill?: { teamId: string; amount: number; installments: { dueDate: string; amount: number }[] }[] | null;
}

const hours = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;

function nameOf(teams: readonly DocTeam[], id: string): string {
  return teams.find(t => t.id === id)?.name ?? '';
}

function placeWords(places: readonly DocPlace[], venueId: string, facilityId: string | null): string {
  const v = places.find(p => p.venueId === venueId);
  if (!facilityId) return v?.venueName ?? '';
  return v?.facilities.find(f => f.id === facilityId)?.name ?? '';
}

const fieldOf = (places: readonly DocPlace[], s: Pick<DocSlot, 'venueId' | 'facilityId'>) =>
  places.find(p => p.venueId === s.venueId)?.facilities.find(f => f.id === s.facilityId);

/** A SLOT's place with its part, the one home: "Field 1, quarter A" on paper; the screens join with a space
 *  (lib/club-schedule-view `slotPlaceName`). The field's name alone when whole; the venue when it has no facility. */
export function slotPlaceWords(places: readonly DocPlace[], s: Pick<DocSlot, 'venueId' | 'facilityId' | 'sectionMask'>, sep = ', '): string {
  const name = placeWords(places, s.venueId, s.facilityId);
  return s.facilityId ? fieldPartName(name, s.sectionMask, sectionsOf(fieldOf(places, s)?.sections), sep) : name;
}

/** A slot's column: its field, and its part when it has one ("id", "id|3") — one half never overwrites the other. */
const columnKey = (s: Pick<DocSlot, 'facilityId' | 'sectionMask'>) => `${s.facilityId ?? ''}${maskSuffix(s.sectionMask)}`;

/** Each field's permit share alone (Full 1, Half 0.5): a slot's weight without its part's size. */
const fieldShares = (slots: readonly DocSlot[]) =>
  new Map(slots.flatMap(s => (s.facilityId ? [[s.facilityId, s.weight / partFactor(s.sectionMask)] as const] : [])));

/** "Field 5 · half", "Field 5 · 75%" — a column's heading carries the permit's price share when it isn't Full. */
function weightWords(weight: number): string {
  if (Math.abs(weight - 1) < 0.0001) return '';
  if (Math.abs(weight - 0.5) < 0.0001) return 'half';
  return `${Math.round(weight * 1000) / 10}%`;
}

/** "Booked practice · 13U AAA" — a slot a booking already holds: the word Booked, then what holds it (tryout day, game,
 *  practice) when that is known. The one wording the New schedule's By day list, the printed schedule and the Excel share
 *  (owner 2026-11-24). */
export function bookedWords(h: { ownerName: string; kind: string | null }): string {
  const what = h.kind === 'tryout' ? 'tryout day' : h.kind === 'game' ? 'game' : h.kind === 'practice' ? 'practice' : '';
  return `Booked${what ? ` ${what}` : ''} · ${h.ownerName}`;
}

/** What a slot reads in its cell: its teams, the booking that holds it, "Handed back", or Open. */
function slotWords(s: DocSlot, teams: readonly DocTeam[]): string {
  if (s.teamIds.length) return s.teamIds.map(t => nameOf(teams, t)).join(' · ');
  if (s.heldBy) return bookedWords(s.heldBy);
  return 'Open';
}

/** The one weekday every slot falls on, or null. */
function oneWeekday(slots: readonly DocSlot[]): number | null {
  if (!slots.length) return null;
  return slots.every(s => s.weekday === slots[0].weekday) ? slots[0].weekday : null;
}

/** "Lakeshore Dome · Oct 4, 2026 – Mar 28, 2027 · 25 Sundays · Final, sent Sep 23 by Jordan Reyes" / "… · a draft". */
export function scheduleSubtitle(input: ScheduleDocInput): string {
  const venues = [...new Set(input.slots.map(s => input.places.find(p => p.venueId === s.venueId)?.venueName ?? ''))].filter(Boolean);
  const days = new Set(input.slots.map(s => s.day)).size;
  const one = oneWeekday(input.slots);
  const span = one ? weekdayCount(days, one) : pluralize(input.slots.length, 'slot');
  const state = input.draftLabel ? `a draft (${input.draftLabel})` : input.state === 'final' ? (input.sentWords ?? 'Final')
    : input.state === 'in_review' ? (input.sentWords ?? 'In review') : 'a draft';
  return [joinWithAnd(venues), `${formatStoredDate(input.startsOn)} – ${formatStoredDate(input.endsOn)}`, span, state].filter(Boolean).join(' · ');
}

/** The notes under the tables — said once, never inside a cell. */
export function scheduleNotes(input: ScheduleDocInput): string[] {
  // The permit's share, never a part's size: a side of a full field is not "a half field" (Stage 2).
  const off = [...fieldShares(input.slots)].filter(([, w]) => Math.abs(w - 1) > 0.0001);
  const halfNames = off.filter(([, w]) => Math.abs(w - 0.5) < 0.0001)
    .map(([id]) => input.places.flatMap(p => p.facilities).find(f => f.id === id)?.name ?? '').filter(Boolean);
  const notes = [timesInZoneSentence()];
  if (halfNames.length) notes.push(`${facilityListWords(halfNames)} ${halfNames.length === 1 ? 'is a half field' : 'are half fields'}.`);
  if (input.datesOff.length) {
    // A date off that names its parks says them ("Sat, Mar 27 (Easter weekend, at Kinsmen Park)"); one on every park says none.
    const parksOf = (d: ScheduleDocInput['datesOff'][number]) => {
      // A date off that names parks always says them — a park no row uses still has its name, never a bare "Dates off".
      const ids = d.venueIds ?? [];
      const names = ids.map(v => placeWords(input.places, v, null) || input.offParkNames?.[v] || '').filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'en-CA', { numeric: true }));
      return ids.length ? `at ${names.length ? joinWithAnd(names) : 'a venue this schedule doesn’t use'}` : '';
    };
    notes.push(`Dates off: ${input.datesOff.map(d => {
      const why = [d.note, parksOf(d)].filter(Boolean).join(', ');
      return `${formatShortWeekdayDate(d.day)}${why ? ` (${why})` : ''}`;
    }).join(', ')}.`);
  }
  notes.push('A slot handed back after this was printed is open on the club’s schedule and on the team’s.');
  return notes;
}

interface PdfRow { day: string; venueId: string; startClock: string; endClock: string; cells: Map<string, string> }

/** A column of a day's table: its cell key and its heading. */
interface DocColumn { id: string; heading: string }
/** A field's columns on a day: itself, or the parts the day uses. Kept in one table when a day splits. */
interface DocField { name: string; columns: DocColumn[] }

/**
 * THE PDF's SECTIONS — a day (a venue a day when it holds two), the time down, the facilities across. Through the
 * shared day document, so the day heading reads the house way.
 *
 * A day can hold more columns than its page: with parts, two quartered fields and four whole ones are 13 columns, about
 * 245 of the page's 251 mm (round 2, Ask 8). So every day declares how it splits — the Time column repeated, each field
 * with its parts kept in one table — and the PDF engine splits it ONLY when it would otherwise drop a column
 * ("Sun, Jan 17, 2027 · 14 slots · Milton Sports Dome · Field 1 and Field 2", then "… · Fields 3–6"). A schedule's
 * columns are never dropped again (Ask 8 A).
 */
export function clubScheduleDocument(input: ScheduleDocInput): ScheduleDocument & { notes: string[] } {
  // One row per day, venue and time range; a cell per facility — and per part, so one side never overwrites the other.
  const rows = new Map<string, PdfRow>();
  const sorted = [...input.slots].sort((a, b) => a.day.localeCompare(b.day) || a.startsAt.localeCompare(b.startsAt));
  const masksOn = new Map<string, Set<number>>();
  for (const s of sorted) {
    const key = `${s.day}|${s.venueId}|${s.startClock}|${s.endClock}`;
    const row = rows.get(key) ?? rows.set(key, { day: s.day, venueId: s.venueId, startClock: s.startClock, endClock: s.endClock, cells: new Map() }).get(key)!;
    row.cells.set(columnKey(s), slotWords(s, input.teams));
    const dayField = `${s.day}|${s.venueId}|${s.facilityId ?? ''}`;
    (masksOn.get(dayField) ?? masksOn.set(dayField, new Set()).get(dayField)!).add(maskOf(s.sectionMask));
  }
  const shares = fieldShares(input.slots);
  // Every field the schedule uses at this venue has its columns every day: the parts that day uses (a whole-field column
  // only when the day has a whole-field slot — the grid's field row), or its one plain column on a day with nothing.
  const fieldsOn = (day: string, venueId: string): DocField[] => {
    const v = input.places.find(p => p.venueId === venueId);
    const usedHere = new Set(input.slots.filter(s => s.venueId === venueId).map(s => s.facilityId ?? ''));
    const list = (v?.facilities ?? []).filter(f => usedHere.has(f.id)).map(f => {
      const today = masksOn.get(`${day}|${venueId}|${f.id}`);
      return {
        name: f.name,
        columns: (today ? sortMasks([...today]) : [WHOLE]).map(m => ({
          id: columnKey({ facilityId: f.id, sectionMask: m }),
          // A part is headed by its own words, the part on the second line, and no price word: a quarter of a full field
          // would otherwise read "Field 1 · 25%". The whole field keeps its permit share ("Field 5 · half").
          heading: m === WHOLE ? [f.name, weightWords(shares.get(f.id) ?? 1)].filter(Boolean).join(' · ') : fieldPartName(f.name, m, sectionsOf(f.sections), '\n'),
        })),
      };
    });
    const venue = v?.venueName ?? '';
    return list.length ? list : [{ name: venue, columns: [{ id: '', heading: venue }] }];
  };
  const dayWords = (d: string) => (d ? `${formatShortWeekdayDate(d)}, ${d.slice(0, 4)}` : '');
  const doc = buildDayDocument<PdfRow, { venueName: string; fields: DocField[]; columns: DocColumn[] }>([...rows.values()], ['Time'], {
    dateOf: r => r.day,
    sectionOf: r => r.venueId,
    dayWords,
    prepare: list => {
      const fields = fieldsOn(list[0].day, list[0].venueId);
      return { venueName: input.places.find(p => p.venueId === list[0].venueId)?.venueName ?? '', fields, columns: fields.flatMap(f => f.columns) };
    },
    facts: (list, ctx) => [pluralize(list.reduce((n, r) => n + r.cells.size, 0), 'slot'), ctx.venueName],
    headersOf: (_list, ctx) => ['Time', ...ctx.columns.map(c => c.heading)],
    splitOf: (list, ctx) => {
      let next = 1;   // column 0 is Time, repeated in every table
      return {
        lead: 1,
        blocks: ctx.fields.map(f => f.columns.map(() => next++)),
        labelOf: blocks => {
          const held = blocks.map(b => ctx.fields[b]);
          const cols = held.flatMap(f => f.columns);
          const slots = list.reduce((n, r) => n + cols.filter(c => r.cells.has(c.id)).length, 0);
          return [dayWords(list[0].day), pluralize(slots, 'slot'), ctx.venueName, facilityListWords(held.map(f => f.name))].filter(Boolean).join(DAY_HEADING_SEP);
        },
      };
    },
    cells: (r, ctx) => [formatTimeRange(r.startClock, r.endClock), ...ctx.columns.map(c => r.cells.get(c.id) ?? '')],
  });
  return { ...doc, notes: scheduleNotes(input) };
}

// ── The workbook ──────────────────────────────────────────────────────────────────────────────────

export interface ScheduleSheets {
  sheetName: string;
  headers: string[];
  rows: (string | number | null)[][];
  columnNumFmts: (string | undefined)[];
  rowStyles: ({ bold?: boolean } | undefined)[];
  notes: string[];
  extraSheets: { name: string; headers: string[]; rows: (string | number | null)[][] }[];
  subtitle: string;
}

const HOURS_FMT = '0.00';
const MONEY_FMT = '$#,##0.00';

/** An Excel sheet's name: at most 31 characters, none of : \ / ? * [ ]. */
export function sheetNameOf(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Schedule';
}

/**
 * A SLOT'S HOUR in the Cost column (Session C): one permit, its hour, as before; several, each slot at its own permit's
 * hour, or every slot at the one rate (the time at the permits' prices ÷ its full-field hours, P1 A). Null: not priced.
 */
function slotHours(input: ScheduleDocInput): { hourOf: (s: DocSlot) => number; oneRate: number | null; byPermit: { name: string; fullHour: number }[] } | null {
  const permits = input.pricing?.permits ?? [];
  // Time house league holds is on no bill (11b·A): it prices nothing the sheet shows, so it joins no rate either.
  const billed = input.slots.filter(x => teamsOnly(x.teamIds).length);
  const used = new Set(billed.map(x => x.pricePermitId ?? ''));
  const behind = permits.filter(x => used.has(x.id));
  const distinct = new Set(behind.map(x => x.fullHour));
  if (behind.length < 2 || distinct.size < 2 || [...distinct].some(h => h == null)) {
    const one = input.pricing?.fullHour ?? (behind.length && distinct.size === 1 ? behind[0].fullHour : null);
    return one != null ? { hourOf: () => one, oneRate: null, byPermit: [] } : null;
  }
  const hour = new Map(behind.map(x => [x.id, x.fullHour as number]));
  const own = (x: DocSlot) => hour.get(x.pricePermitId ?? '') ?? 0;
  const byPermit = behind.map(x => ({ name: x.name, fullHour: x.fullHour as number }));
  if (input.pricing?.mode !== 'one_rate') return { hourOf: own, oneRate: null, byPermit };
  let cost = 0, full = 0;
  for (const x of billed) {
    const h = (Date.parse(x.endsAt) - Date.parse(x.startsAt)) / 3_600_000 * x.weight;
    cost += h * own(x); full += h;
  }
  const oneRate = full > 0 ? cost / full : 0;
  return { hourOf: () => oneRate, oneRate, byPermit };
}

export function scheduleSheets(input: ScheduleDocInput): ScheduleSheets {
  const pricedBy = slotHours(input);
  const priced = pricedBy != null;
  const groupOf = (id: string) => input.teams.find(t => t.id === id)?.groupName ?? '';
  const sorted = [...input.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)
    || slotPlaceWords(input.places, a).localeCompare(slotPlaceWords(input.places, b), 'en-CA', { numeric: true }));
  // "Field 1, quarter A" names its part and no price word (round 2 tab 5); a whole field keeps its share ("Field 5 (half)").
  const facilityCell = (s: DocSlot) => {
    const w = maskOf(s.sectionMask) === WHOLE ? weightWords(s.weight) : '';
    return `${slotPlaceWords(input.places, s)}${w ? ` (${w})` : ''}`;
  };
  const headers = ['Date', 'Day', 'Start', 'End', 'Facility', 'Team', 'Group', 'Hours', ...(priced ? ['Cost'] : [])];
  const rows: (string | number | null)[][] = [];
  let hoursTotal = 0, costTotal = 0;
  for (const s of sorted) {
    const h = hours(Date.parse(s.endsAt) - Date.parse(s.startsAt));
    const cost = pricedBy ? Math.round(h * s.weight * pricedBy.hourOf(s) * 100) / 100 : null;
    hoursTotal += h;
    if (cost != null) costTotal += cost;
    const teamWords = slotWords(s, input.teams);
    rows.push([
      s.day, formatShortWeekdayDate(s.day).split(',')[0], formatTime(s.startClock), formatTime(s.endClock), facilityCell(s),
      teamWords, s.teamIds.map(groupOf).filter(Boolean).join(' · '), h, ...(priced ? [cost] : []),
    ]);
  }
  rows.push([pluralize(sorted.length, 'slot'), '', '', '', '', '', '', Math.round(hoursTotal * 100) / 100, ...(priced ? [Math.round(costTotal * 100) / 100] : [])]);

  // By team: each team's slots, hours, prime time — and its bill with its payments for a money reader.
  const teamIds = input.teams.map(t => t.id).filter(id => input.slots.some(s => s.teamIds.includes(id)));
  const dues = [...new Set((input.bill ?? []).flatMap(b => b.installments.map(i => i.dueDate)))].sort();
  const byTeam = teamIds.map(id => {
    const mine = input.slots.filter(s => s.teamIds.includes(id));
    const h = mine.reduce((n, s) => n + hours(Date.parse(s.endsAt) - Date.parse(s.startsAt)), 0);
    const b = (input.bill ?? []).find(x => x.teamId === id);
    return [
      nameOf(input.teams, id), groupOf(id), mine.length, Math.round(h * 100) / 100, mine.filter(s => s.prime).length,
      ...(input.bill ? [b?.amount ?? null, ...dues.map(d => b?.installments.find(i => i.dueDate === d)?.amount ?? null)] : []),
    ];
  });
  // By field: each field's slots, hours and who had them.
  // A part is its own row ("Field 1, side A"), as it is its own column on the PDF.
  const byPlace = new Map<string, DocSlot[]>();
  for (const s of input.slots) {
    const key = `${s.venueId}|${columnKey(s)}`;
    (byPlace.get(key) ?? byPlace.set(key, []).get(key)!).push(s);
  }
  const byField = [...byPlace.values()].map(mine => {
    const who = [...new Set(mine.flatMap(s => s.teamIds))].map(t => nameOf(input.teams, t));
    return [facilityCell(mine[mine.length - 1]), mine.length, Math.round(mine.reduce((n, s) => n + hours(Date.parse(s.endsAt) - Date.parse(s.startsAt)), 0) * 100) / 100, who.join(' · ')];
  });

  const notes = scheduleNotes(input).slice(0, 3);
  if (pricedBy) {
    const byTeam = input.bill ? ' Each team’s bill is on the By team sheet.' : '';
    if (pricedBy.oneRate != null) {
      notes.push(`Cost is each slot at one rate for all, ${money(pricedBy.oneRate)} a full field an hour: the time at ${joinWithAnd(pricedBy.byPermit.map(x => `${possessive(x.name)} ${money(x.fullHour)}`))}, over all its hours.${byTeam}`);
    } else if (pricedBy.byPermit.length) {
      notes.push(`Cost is each slot at its own permit’s price, a full field an hour: ${joinWithAnd(pricedBy.byPermit.map(x => `${x.name} ${money(x.fullHour)}`))}. A half field is half of it.${byTeam}`);
    } else {
      const fullHour = pricedBy.hourOf(input.slots[0]);
      notes.push(`Cost is each slot’s share of ${input.pricing?.permitName ?? 'the permit'}${input.pricing?.permitCost != null ? ` (${money(input.pricing.permitCost)})` : ''}: a full field is ${money(fullHour)} an hour, a half field ${money(fullHour / 2)}.${byTeam}`);
    }
  }
  return {
    sheetName: sheetNameOf(input.name),
    headers,
    rows,
    columnNumFmts: headers.map(h => (h === 'Hours' ? HOURS_FMT : h === 'Cost' ? MONEY_FMT : undefined)),
    rowStyles: rows.map((_, i) => (i === rows.length - 1 ? { bold: true } : undefined)),
    notes,
    extraSheets: [
      {
        name: 'By team',
        headers: ['Team', 'Group', 'Slots', 'Hours', 'Prime time', ...(input.bill ? ['Bill', ...dues.map(d => `Due ${formatStoredDate(d, { withYear: false })}`)] : [])],
        rows: byTeam,
      },
      { name: 'By field', headers: ['Facility', 'Slots', 'Hours', 'Teams'], rows: byField },
    ],
    subtitle: scheduleSubtitle(input),
  };
}

