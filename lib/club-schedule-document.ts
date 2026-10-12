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
import { buildDayDocument, type ScheduleDocument } from './export/schedule-document.ts';
import { formatShortWeekdayDate, formatStoredDate, timesInZoneSentence } from './timezone.ts';
import { formatTime, formatTimeRange, joinWithAnd, pluralize } from './utils.ts';
import { facilityListWords, weekdayCount } from './permit-words.ts';
import { fmt as money } from './coach-money-summary.ts';

export interface DocPlace { venueId: string; venueName: string; facilities: { id: string; name: string }[] }
export interface DocTeam { id: string; name: string; groupName: string | null }
export interface DocSlot {
  key: string; venueId: string; facilityId: string | null; day: string; weekday: number;
  startClock: string; endClock: string; startsAt: string; endsAt: string;
  teamIds: string[]; weight: number; prime: boolean;
  heldBy: { ownerName: string; kind: string | null } | null;
  handedBackTeamId?: string | null;
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
  datesOff: readonly { day: string; note: string | null }[];
  /** The permit's price, for a MONEY reader only: an hour of a full field, its cost, its reference words. */
  pricing?: { fullHour: number | null; permitCost: number | null; permitName: string | null } | null;
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

/** "Field 5 · half", "Field 5 · 75%" — a column's heading carries the permit's price share when it isn't Full. */
function weightWords(weight: number): string {
  if (Math.abs(weight - 1) < 0.0001) return '';
  if (Math.abs(weight - 0.5) < 0.0001) return 'half';
  return `${Math.round(weight * 1000) / 10}%`;
}

/** What a slot reads in its cell: its teams, the booking that holds it, "Handed back", or Open. */
function slotWords(s: DocSlot, teams: readonly DocTeam[]): string {
  if (s.teamIds.length) return s.teamIds.map(t => nameOf(teams, t)).join(' · ');
  if (s.heldBy) return `${s.heldBy.kind === 'tryout' ? 'Tryout day' : 'Booked'} · ${s.heldBy.ownerName}`;
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
  const used = new Map<string, number>();
  for (const s of input.slots) if (s.facilityId) used.set(s.facilityId, s.weight);
  const off = [...used].filter(([, w]) => Math.abs(w - 1) > 0.0001);
  const halfNames = off.filter(([, w]) => Math.abs(w - 0.5) < 0.0001)
    .map(([id]) => input.places.flatMap(p => p.facilities).find(f => f.id === id)?.name ?? '').filter(Boolean);
  const notes = [timesInZoneSentence()];
  if (halfNames.length) notes.push(`${facilityListWords(halfNames)} ${halfNames.length === 1 ? 'is a half field' : 'are half fields'}.`);
  if (input.datesOff.length) {
    notes.push(`Dates off: ${input.datesOff.map(d => `${formatShortWeekdayDate(d.day)}${d.note ? ` (${d.note})` : ''}`).join(', ')}.`);
  }
  notes.push('A slot handed back after this was printed is open on the club’s schedule and on the team’s.');
  return notes;
}

interface PdfRow { day: string; venueId: string; startClock: string; endClock: string; cells: Map<string, string> }

/**
 * THE PDF's SECTIONS — a day (a venue a day when it holds two), the time down, the facilities across. Through the
 * shared day document, so the day heading reads the house way.
 */
export function clubScheduleDocument(input: ScheduleDocInput): ScheduleDocument & { notes: string[] } {
  // One row per day, venue and time range; a cell per facility.
  const rows = new Map<string, PdfRow>();
  const sorted = [...input.slots].sort((a, b) => a.day.localeCompare(b.day) || a.startsAt.localeCompare(b.startsAt));
  for (const s of sorted) {
    const key = `${s.day}|${s.venueId}|${s.startClock}|${s.endClock}`;
    const row = rows.get(key) ?? rows.set(key, { day: s.day, venueId: s.venueId, startClock: s.startClock, endClock: s.endClock, cells: new Map() }).get(key)!;
    row.cells.set(s.facilityId ?? '', slotWords(s, input.teams));
  }
  const weightOf = new Map<string, number>();
  for (const s of input.slots) weightOf.set(s.facilityId ?? '', s.weight);
  const columnsOf = (venueId: string) => {
    const v = input.places.find(p => p.venueId === venueId);
    const usedHere = new Set(input.slots.filter(s => s.venueId === venueId).map(s => s.facilityId ?? ''));
    const list = (v?.facilities ?? []).filter(f => usedHere.has(f.id)).map(f => ({ id: f.id, name: f.name }));
    return list.length ? list : [{ id: '', name: v?.venueName ?? '' }];
  };
  const doc = buildDayDocument<PdfRow, { columns: { id: string; name: string }[]; slots: number }>([...rows.values()], ['Time'], {
    dateOf: r => r.day,
    sectionOf: r => r.venueId,
    dayWords: d => (d ? `${formatShortWeekdayDate(d)}, ${d.slice(0, 4)}` : ''),
    prepare: list => ({ columns: columnsOf(list[0].venueId), slots: list.reduce((n, r) => n + r.cells.size, 0) }),
    facts: (list, ctx) => [pluralize(ctx.slots, 'slot'), input.places.find(p => p.venueId === list[0].venueId)?.venueName ?? ''],
    headersOf: (_list, ctx) => ['Time', ...ctx.columns.map(c => [c.name, weightWords(weightOf.get(c.id) ?? 1)].filter(Boolean).join(' · '))],
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

export function scheduleSheets(input: ScheduleDocInput): ScheduleSheets {
  const fullHour = input.pricing?.fullHour ?? null;
  const priced = fullHour != null;
  const groupOf = (id: string) => input.teams.find(t => t.id === id)?.groupName ?? '';
  const sorted = [...input.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt)
    || placeWords(input.places, a.venueId, a.facilityId).localeCompare(placeWords(input.places, b.venueId, b.facilityId), 'en-CA', { numeric: true }));
  const facilityCell = (s: DocSlot) => {
    const w = weightWords(s.weight);
    return `${placeWords(input.places, s.venueId, s.facilityId)}${w ? ` (${w})` : ''}`;
  };
  const headers = ['Date', 'Day', 'Start', 'End', 'Facility', 'Team', 'Group', 'Hours', ...(priced ? ['Cost'] : [])];
  const rows: (string | number | null)[][] = [];
  let hoursTotal = 0, costTotal = 0;
  for (const s of sorted) {
    const h = hours(Date.parse(s.endsAt) - Date.parse(s.startsAt));
    const cost = priced ? Math.round(h * s.weight * fullHour! * 100) / 100 : null;
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
  const fields = [...new Map(input.slots.map(s => [`${s.venueId}|${s.facilityId ?? ''}`, s])).values()];
  const byField = fields.map(f => {
    const mine = input.slots.filter(s => s.venueId === f.venueId && s.facilityId === f.facilityId);
    const who = [...new Set(mine.flatMap(s => s.teamIds))].map(t => nameOf(input.teams, t));
    return [facilityCell(f), mine.length, Math.round(mine.reduce((n, s) => n + hours(Date.parse(s.endsAt) - Date.parse(s.startsAt)), 0) * 100) / 100, who.join(' · ')];
  });

  const notes = scheduleNotes(input).slice(0, 3);
  if (priced) {
    const half = fullHour! / 2;
    notes.push(`Cost is each slot’s share of ${input.pricing?.permitName ?? 'the permit'}${input.pricing?.permitCost != null ? ` (${money(input.pricing.permitCost)})` : ''}: a full field is ${money(fullHour!)} an hour, a half field ${money(half)}.${input.bill ? ' Each team’s bill is on the By team sheet.' : ''}`);
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

