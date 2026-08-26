// Schedule import for the coach portal — PURE parsing + review. No I/O, no React.
import { formatTime, endSentence } from './utils';
//
// Chunk C (P1 #7). Inherits the Chunk H2 importer contract wholesale:
//   1. Templates ship STRUCTURE, never content — every date/time/opponent cell is blank.
//   2. Preview-first means a VERDICT per row, editable in place; the commit route reviews AGAIN
//      against live data, so a row the client called an add can become an update at write time.
//   3. The parser never guesses. An ambiguous `03/04/2026` is REFUSED, not resolved: a schedule
//      that is quietly a month wrong is worse than one that asked a question.
//   4. A round trip must close — this reader understands the schedule's OWN export columns.
//   5. Import writes through the SAME writer the form uses, and gates on `schedule: write` only.
//
// Chunk C adds one rule of its own, from Batch 4: a row that looks like a MIRRORED tournament game
// is surfaced, never merged and never written over. The organizer owns those facts.
//
// Relative imports WITH the .ts extension so the unit tests can run under plain `node --test`.
import { getCell, normalizeHeader } from './import/tabular.ts';
import type { ParsedImportFile } from './import/types.ts';
import { parseEventTypeCell, parseHomeAwayCell, needsOpponent, EVENT_NAME_PREFIX } from './coach-schedule-vocab.ts';
import type { RepEventType } from './types.ts';

/** Upper bound on one intake, mirroring the budget + roster importers. */
export const MAX_SCHEDULE_IMPORT_ROWS = 300;

export type ScheduleRowOutcome = 'add' | 'update' | 'blocked' | 'organizer';

/** Column headings the reader recognises: the export's own spelling first, then plain variants. */
const COLUMNS = {
  date:      ['date', 'game date', 'event date', 'day'],
  time:      ['time', 'start time', 'start'],
  arrival:   ['arrival', 'arrival time', 'call time', 'be there by'],
  eventType: ['event type', 'type', 'kind'],
  name:      ['name', 'event', 'title', 'description'],
  opponent:  ['opponent', 'vs', 'versus', 'against'],
  location:  ['location', 'venue', 'place', 'park'],
  address:   ['address', 'location address'],
  field:     ['field', 'field number', 'diamond', 'court', 'rink'],
  uniform:   ['uniform', 'jersey', 'kit'],
  homeAway:  ['home/away', 'home away', 'homeaway', 'h/a', 'side'],
} as const;

/**
 * A date cell → `YYYY-MM-DD`, `''` when empty, or `null` when it is present but NOT safely
 * readable.
 *
 * Deliberately strict, and the strictness is the feature. ISO (`2026-09-08`) and the ISO prefix a
 * spreadsheet hands over for a real date cell are accepted. **A slash/dot form like `03/04/2026`
 * is REFUSED** — it is April 3rd in most of the world and March 4th in the US, and picking one
 * silently moves a family's Saturday by a month. `2026/09/08` is unambiguous (4-digit year first)
 * so it is accepted; a textual month (`Sep 8, 2026`) is unambiguous too.
 */
export function parseScheduleDateCell(raw: string | null | undefined): string | null | '' {
  const text = (raw ?? '').trim();
  if (!text) return '';

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const isoSlash = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(text);
  if (isoSlash) return `${isoSlash[1]}-${pad(isoSlash[2])}-${pad(isoSlash[3])}`;

  const textual = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(text);
  if (textual) {
    const m = MONTHS.indexOf(textual[1].slice(0, 3).toLowerCase());
    if (m >= 0) return `${textual[3]}-${pad(m + 1)}-${pad(textual[2])}`;
  }
  const textualDayFirst = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(text);
  if (textualDayFirst) {
    const m = MONTHS.indexOf(textualDayFirst[2].slice(0, 3).toLowerCase());
    if (m >= 0) return `${textualDayFirst[3]}-${pad(m + 1)}-${pad(textualDayFirst[1])}`;
  }
  return null; // present, unreadable — hand it back rather than guess
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (v: string | number) => String(v).padStart(2, '0');

/**
 * A time cell → `HH:mm` (24h), `''` when empty, or `null` when present but unreadable.
 * Accepts what spreadsheets and coaches actually produce: `6:00 PM`, `18:00`, `6pm`, `6 PM`.
 */
export function parseScheduleTimeCell(raw: string | null | undefined): string | null | '' {
  const text = (raw ?? '').trim();
  if (!text) return '';

  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AaPp])\.?[Mm]?\.?$/.exec(text);
  if (m) {
    let h = Number(m[1]);
    if (h < 1 || h > 12) return null;
    const isPm = m[3].toLowerCase() === 'p';
    if (h === 12) h = 0;
    return `${pad(isPm ? h + 12 : h)}:${m[2] ?? '00'}`;
  }
  const h24 = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (h24) {
    const h = Number(h24[1]);
    if (h > 23 || Number(h24[2]) > 59) return null;
    return `${pad(h)}:${h24[2]}`;
  }
  return null;
}

/** One row as the preview edits it. Every field stays a string so a bad value survives round-trips
 *  back to the coach exactly as they typed it. */
export interface DraftScheduleRow {
  /** 1-based position in the source, shown in the preview and in commit results. */
  rowNumber: number;
  date: string;
  time: string;
  arrival: string;
  eventType: string;
  name: string;
  opponent: string;
  location: string;
  address: string;
  field: string;
  uniform: string;
  homeAway: string;
}

export interface ScheduleRowVerdict {
  outcome: ScheduleRowOutcome;
  /** Why it is blocked, or what an update changes — always in the coach's language. */
  reason?: string;
  /** The existing event this row updates, when matched. */
  matchedEventId?: string;
  /** Worth a look, never blocking. */
  warning?: string;
  /** Resolved values, present only when the row is writable. */
  resolved?: {
    eventType: RepEventType;
    date: string;
    time: string;
    startsAt: string;
    name: string;
    opponent: string | null;
    homeAway: string | null;
  };
}

export type ReviewedScheduleRow = DraftScheduleRow & ScheduleRowVerdict;

const blank = (rowNumber: number): DraftScheduleRow => ({
  rowNumber, date: '', time: '', arrival: '', eventType: '', name: '',
  opponent: '', location: '', address: '', field: '', uniform: '', homeAway: '',
});

/** Rows from a parsed CSV/XLSX file, using the export's own column vocabulary. */
export function rowsFromScheduleFile(file: ParsedImportFile): DraftScheduleRow[] {
  return file.rows.slice(0, MAX_SCHEDULE_IMPORT_ROWS).map((row, i) => {
    const cell = (aliases: readonly string[]) => getCell(row, aliases as string[]).value.trim();
    return {
      ...blank(row.rowNumber || i + 1),
      date: cell(COLUMNS.date),
      time: cell(COLUMNS.time),
      arrival: cell(COLUMNS.arrival),
      eventType: cell(COLUMNS.eventType),
      name: cell(COLUMNS.name),
      opponent: cell(COLUMNS.opponent),
      location: cell(COLUMNS.location),
      address: cell(COLUMNS.address),
      field: cell(COLUMNS.field),
      uniform: cell(COLUMNS.uniform),
      homeAway: cell(COLUMNS.homeAway),
    };
  });
}

/**
 * Rows from pasted text — tab- or comma-separated, with or without a header line.
 *
 * A header line is detected by looking for a column word we recognise; without one the reader
 * assumes the template's own order (Date · Time · Event Type · Opponent · Location · Field ·
 * Home/Away) rather than guessing per-column, and the preview shows what it decided.
 */
export function rowsFromSchedulePaste(text: string): DraftScheduleRow[] {
  const lines = (text ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const split = (line: string) => (line.includes('\t') ? line.split('\t') : line.split(',')).map(c => c.trim());
  const first = split(lines[0]).map(normalizeHeader);
  const known = new Set(Object.values(COLUMNS).flat().map(normalizeHeader));
  const hasHeader = first.filter(h => known.has(h)).length >= 2;

  if (hasHeader) {
    const headerIndex = new Map(first.map((h, i) => [h, i]));
    const at = (aliases: readonly string[], cells: string[]) => {
      for (const a of aliases) {
        const i = headerIndex.get(normalizeHeader(a));
        if (i !== undefined) return cells[i] ?? '';
      }
      return '';
    };
    return lines.slice(1, MAX_SCHEDULE_IMPORT_ROWS + 1).map((line, i) => {
      const cells = split(line);
      return {
        ...blank(i + 1),
        date: at(COLUMNS.date, cells), time: at(COLUMNS.time, cells),
        arrival: at(COLUMNS.arrival, cells), eventType: at(COLUMNS.eventType, cells),
        name: at(COLUMNS.name, cells), opponent: at(COLUMNS.opponent, cells),
        location: at(COLUMNS.location, cells), address: at(COLUMNS.address, cells),
        field: at(COLUMNS.field, cells), uniform: at(COLUMNS.uniform, cells),
        homeAway: at(COLUMNS.homeAway, cells),
      };
    });
  }

  return lines.slice(0, MAX_SCHEDULE_IMPORT_ROWS).map((line, i) => {
    const c = split(line);
    return {
      ...blank(i + 1),
      date: c[0] ?? '', time: c[1] ?? '', eventType: c[2] ?? '', opponent: c[3] ?? '',
      location: c[4] ?? '', field: c[5] ?? '', homeAway: c[6] ?? '',
    };
  });
}

/** An event already on the team's schedule, as the reviewer needs to see it. */
export interface ExistingScheduleEvent {
  id: string;
  eventType: string;
  /** Calendar day IN THE ORG'S ZONE — the caller resolves this; never a raw UTC slice. */
  day: string;
  /** `HH:mm` in the org's zone. */
  time: string;
  opponent: string | null;
  name: string;
  location: string | null;
  /** Batch 4: set when the row is a MIRRORED tournament game the organizer owns. */
  isMirrored: boolean;
}

export interface ScheduleReviewOptions {
  /** Rows the coach chose to keep alongside a look-alike organizer game ("Keep both"). */
  keepBothRowNumbers?: number[];
  /** The season's date window, when known — a row outside it warns (never blocks). */
  seasonStart?: string | null;
  seasonEnd?: string | null;
}

const sameOpponent = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Give every row a verdict against what is already on the schedule.
 *
 * Matching is by **day + opponent** for games, and **day + type** otherwise — a coach's league
 * sheet has no ids in it, so identity has to come from the facts. A same-day match that is a
 * MIRRORED tournament game is never an update: it is handed back as `organizer`, which the coach
 * resolves by keeping both or skipping the row (Batch 4 — duplicates are surfaced, never merged).
 */
export function reviewScheduleRows(
  rows: DraftScheduleRow[],
  existing: ExistingScheduleEvent[],
  options: ScheduleReviewOptions = {},
): ReviewedScheduleRow[] {
  const keepBoth = new Set(options.keepBothRowNumbers ?? []);
  const seenInBatch = new Set<string>();

  return rows.map(row => {
    const verdict = (v: ScheduleRowVerdict): ReviewedScheduleRow => ({ ...row, ...v });

    // Wholly blank rows are dropped by the callers before this point; a row with SOME content but
    // no date can't be placed at all, so it is blocked with the reason rather than half-imported.
    const date = parseScheduleDateCell(row.date);
    if (date === null) {
      return verdict({
        outcome: 'blocked',
        reason: `We can’t tell what date “${row.date.trim()}” is — write it as 2026-04-03 and we’ll take it.`,
      });
    }
    if (!date) return verdict({ outcome: 'blocked', reason: 'This row has no date.' });

    const time = parseScheduleTimeCell(row.time);
    if (time === null) {
      return verdict({
        outcome: 'blocked',
        reason: `We can’t read the time “${row.time.trim()}”. Try 6:00 p.m. or 18:00.`,
      });
    }

    const arrival = parseScheduleTimeCell(row.arrival);
    if (arrival === null) {
      return verdict({
        outcome: 'blocked',
        reason: `We can’t read the arrival time “${row.arrival.trim()}”. Try 5:15 p.m. or 17:15.`,
      });
    }

    const eventType = parseEventTypeCell(row.eventType);
    if (!eventType) {
      return verdict({
        outcome: 'blocked',
        reason: row.eventType.trim()
          ? `“${row.eventType.trim()}” isn’t an event type we know. Use Practice, League Game, Scrimmage, Tournament or Team Event.`
          : 'This row doesn’t say what kind of event it is.',
      });
    }
    if (eventType === 'tournament_game') {
      return verdict({
        outcome: 'blocked',
        reason: 'Tournament games come from the tournament itself — they can’t be imported.',
      });
    }

    const opponent = row.opponent.trim() || null;
    const homeAway = parseHomeAwayCell(row.homeAway);
    const isGame = needsOpponent(eventType);
    const name = row.name.trim()
      || (isGame && opponent ? `${EVENT_NAME_PREFIX[eventType]} vs ${opponent}` : EVENT_NAME_PREFIX[eventType]);

    const resolved = {
      eventType, date, time: time || '00:00',
      startsAt: `${date}T${time || '00:00'}`,
      name, opponent: isGame ? opponent : null, homeAway: isGame ? homeAway : null,
    };

    // A duplicate INSIDE the pasted sheet itself — flagged, still importable (a real double-header
    // exists), because refusing it would be guessing about the coach's own league.
    const batchKey = `${date}|${eventType}|${(opponent ?? '').toLowerCase()}|${time}`;
    const dupeInBatch = seenInBatch.has(batchKey);
    seenInBatch.add(batchKey);

    const sameDay = existing.filter(e => e.day === date);
    // A look-alike organizer game is only possible for a GAME row. A practice on a tournament day
    // is an ordinary separate event — flagging it as the organizer's would make a tournament
    // weekend the one time a coach cannot import their own practices.
    const mirroredMatch = isGame
      ? sameDay.find(e => e.isMirrored && (sameOpponent(e.opponent, opponent) || !opponent))
      : undefined;
    if (mirroredMatch && !keepBoth.has(row.rowNumber)) {
      return verdict({
        outcome: 'organizer',
        matchedEventId: mirroredMatch.id,
        reason: `This looks like a game from ${mirroredMatch.name}, which the tournament organizer keeps up to date. We won’t change it.`,
        resolved,
      });
    }

    const match = sameDay.find(e => !e.isMirrored && e.eventType === eventType && (
      isGame ? sameOpponent(e.opponent, opponent) : true
    ));

    const outOfSeason =
      (options.seasonStart && date < options.seasonStart) ||
      (options.seasonEnd && date > options.seasonEnd);
    const warning = dupeInBatch
      ? 'This row appears twice in what you pasted.'
      : outOfSeason
        ? 'This date is outside your season.'
        : undefined;

    if (match && !keepBoth.has(row.rowNumber)) {
      const changes: string[] = [];
      if (time && match.time !== time) changes.push(`time changes from ${friendly(match.time)} to ${friendly(time)}`);
      if (row.location.trim() && (match.location ?? '') !== row.location.trim()) {
        changes.push(`location changes from ${match.location || 'nothing'} to ${row.location.trim()}`);
      }
      return verdict({
        outcome: 'update',
        matchedEventId: match.id,
        reason: changes.length ? endSentence(capitalize(changes.join(', '))) : 'Nothing changes on this one.',
        warning,
        resolved,
      });
    }

    return verdict({ outcome: 'add', warning, resolved });
  });
}

/**
 * `HH:mm` → a friendly 12-hour clock, for verdict copy the coach reads.
 *
 * Guards the shape and then defers to the one shared formatter, rather than building the label
 * itself — this used to be its own copy of that arithmetic and its own uppercase spelling.
 */
function friendly(hhmm: string): string {
  return /^\d{1,2}:\d{2}$/.test(hhmm) ? formatTime(hhmm) : hhmm;
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


/** Rows that will actually be written. */
export function committableScheduleRows(rows: ReviewedScheduleRow[]): ReviewedScheduleRow[] {
  return rows.filter(r => (r.outcome === 'add' || r.outcome === 'update') && r.resolved);
}

/** A row with nothing in it at all — dropped before review so a trailing blank line isn't an error. */
export function isBlankScheduleRow(row: DraftScheduleRow): boolean {
  return !row.date && !row.time && !row.eventType && !row.name && !row.opponent
    && !row.location && !row.field && !row.uniform && !row.homeAway && !row.arrival && !row.address;
}

/** Template headings. Structure only — the generator emits NO example dates, times or opponents
 *  (Chunk G rule 1 / H2 rule 1), and the probe asserts every data cell is empty. */
export const SCHEDULE_TEMPLATE_HEADERS = [
  'Date', 'Time', 'Arrival', 'Event Type', 'Name', 'Opponent',
  'Location', 'Address', 'Field', 'Uniform', 'Home/Away',
] as const;

export type ScheduleTemplateKind = 'games' | 'practices';

/**
 * A downloadable template: headings, then blank rows whose ONLY pre-filled cell is the event type
 * (structure, not content — it tells the coach what the column expects without proposing a fact).
 */
export function buildScheduleTemplate(kind: ScheduleTemplateKind, rowCount = 10): string[][] {
  const typeLabel = kind === 'games' ? 'League Game' : 'Practice';
  const typeIndex = SCHEDULE_TEMPLATE_HEADERS.indexOf('Event Type');
  return [
    [...SCHEDULE_TEMPLATE_HEADERS],
    ...Array.from({ length: rowCount }, () =>
      SCHEDULE_TEMPLATE_HEADERS.map((_, i) => (i === typeIndex ? typeLabel : ''))),
  ];
}
