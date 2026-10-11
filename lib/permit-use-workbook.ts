/**
 * permit-use-workbook.ts — A PERMIT'S USE, as a workbook for the town or the dome (Club Tier Stage 10a; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimen 15 "A permit's use"; Ask 26 and the owner's instruction 2026-10-11,
 * memory `feedback_exports_house_format`). Pure: it builds the sheets' rows, numbers and notes from the permit's window
 * read; the window adds the house format's letterhead (the club's logo, the masthead, the FieldLogicHQ row, print setup)
 * when it hands the file over. Its arithmetic is held by `tests/unit/permit-use-workbook.test.ts`: totals = Σ rows,
 * Held − Booked = Unused on every field's row.
 *
 * Two sheets: **Use** (a row per field: held, booked, unused, the share used, who had it) and **By date** (each date the
 * permit holds). Hours are NUMBERS (the money exports' rule: real figures in their formats), never words. The drawn third
 * sheet, "Outside the permit", went with the window's "Outside it" (owner 2026-10-11, lib/permit-time.ts §3).
 */
import { formatStoredDate, timesInZoneSentence } from './timezone.ts';
import { formatTimeRange } from './utils.ts';
import { facilityWords } from './venue-clash-words.ts';
import { hoursNumber, hoursWords, permitMoney, shareWords, usedRatio, weekdaysWords, facilityListWords } from './permit-words.ts';
import type { XlsxExtraSheet, XlsxNote } from './export/xlsx.ts';
import type { PermitView } from './permit-server.ts';

export interface PermitUseSheets {
  sheetName: string;
  headers: string[];
  rows: (string | number | null)[][];
  /** Index-aligned with `headers`. */
  columnNumFmts: (string | undefined)[];
  /** The totals row (the last one) is bold. */
  rowStyles: ({ bold?: boolean } | undefined)[];
  notes: XlsxNote[];
  extraSheets: XlsxExtraSheet[];
  /** The masthead's second and third lines (the title and logo are the window's). */
  subtitle: string;
  meta: string;
}

const HOURS = '0.0#';
const PCT = '0%';

/** "Lions Park · Diamond 2", or the bare field when the permit holds one venue. */
function placeLabel(p: PermitView['places'][number], oneVenue: boolean, sport: string | null): string {
  const fac = p.facilityName ? facilityWords(sport, p.facilityName) || p.facilityName : '';
  if (oneVenue) return fac || p.venueName;
  return fac ? `${p.venueName} · ${fac}` : p.venueName;
}

/** "Lions Park · Diamond 2 · Tue and Thu, 5:30–9:00 p.m." — one block as the subtitle names it. */
function blockWords(b: PermitView['blocks'][number], sport: string | null): string {
  const facs = b.facilityNames ? facilityListWords(b.facilityNames.map(f => facilityWords(sport, f) || f)) : 'every facility';
  return `${b.venueName} · ${facs} · ${weekdaysWords(b.weekdays)}, ${formatTimeRange(b.startTime, b.endTime)}`;
}

export function permitUseSheets(view: PermitView, opts: { today: string; sport: string | null; money: boolean }): PermitUseSheets {
  const { sport, money } = opts;
  const oneVenue = new Set(view.places.map(p => p.venueId)).size <= 1;
  const unplaced = view.blocks.reduce((n, b) => n + b.unplacedMinutes, 0);

  const headers = ['Facility', ...(money ? ['Cost'] : []), 'Held (h)', 'Booked (h)', 'Unused (h)', 'Used', 'Booked by'];
  const rows: (string | number | null)[][] = view.places.map(p => [
    placeLabel(p, oneVenue, sport),
    ...(money ? [shareWords(p.share).short] : []),
    hoursNumber(p.heldMinutes),
    hoursNumber(p.bookedMinutes),
    hoursNumber(Math.max(0, p.heldMinutes - p.bookedMinutes)),
    usedRatio(p.bookedMinutes, p.heldMinutes),
    p.who.join(' · '),
  ]);
  if (unplaced > 0.0001) {
    // A booking with no facility set inside the permit's hours counts on its block, not a field: its own row, so the
    // totals stay the sum of the rows and nothing is counted on a field it may not have used.
    rows.push(['No facility set', ...(money ? [''] : []), 0, hoursNumber(unplaced), null, null, '']);
  }
  const col = (name: string) => headers.indexOf(name);
  const sum = (name: string) => Math.round(rows.reduce((n, r) => n + (Number(r[col(name)]) || 0), 0) * 100) / 100;
  const heldTotal = sum('Held (h)');
  const bookedTotal = sum('Booked (h)');
  rows.push([
    oneVenue && view.places.length > 1 ? 'All fields' : 'All', ...(money ? [''] : []),
    heldTotal, bookedTotal, Math.round(Math.max(0, heldTotal - bookedTotal) * 100) / 100, usedRatio(bookedTotal, heldTotal), '',
  ]);

  const numFmt = (h: string) => (h.endsWith('(h)') ? HOURS : h === 'Used' ? PCT : undefined);
  const notes: XlsxNote[] = [
    { runs: [
      { text: 'Held', bold: true }, { text: ': the hours the permit holds on each field over its dates, less its dates off. ' },
      { text: 'Booked', bold: true }, { text: ': every booking from every program on a field inside the permit’s hours, each hour counted once. ' },
      { text: 'Unused', bold: true }, { text: ': held less booked.' },
    ] },
    { runs: [{ text: `${timesInZoneSentence()} ${view.datesOff.length
      ? `Dates off: ${view.datesOff.map(d => `${formatStoredDate(d.day)}${d.note ? ` (${d.note})` : ''}`).join(', ')}.`
      : 'No dates off.'}` }] },
  ];
  if (unplaced > 0.0001) {
    notes.push({ runs: [{ text: `${hoursWords(unplaced)} ${unplaced === 60 ? 'was' : 'were'} booked with no facility set inside the permit’s hours: counted on the block, not a field.` }] });
  }

  const dayRows = view.use.days.map(d => [
    d.day, formatStoredDate(d.day, { withYear: false }), hoursNumber(d.heldMinutes), hoursNumber(d.bookedMinutes),
    hoursNumber(Math.max(0, d.heldMinutes - d.bookedMinutes)),
  ]);
  const where = view.blocks.map(b => blockWords(b, sport)).join('; ');
  const dates = `${formatStoredDate(view.startsOn)} – ${formatStoredDate(view.endsOn)}`;
  return {
    sheetName: 'Use',
    headers,
    rows,
    columnNumFmts: headers.map(numFmt),
    rowStyles: rows.map((_, i) => (i === rows.length - 1 ? { bold: true } : undefined)),
    notes,
    extraSheets: [
      { name: 'By date', headers: ['Date', 'Day', 'Held (h)', 'Booked (h)', 'Unused (h)'], rows: dayRows },
    ],
    subtitle: [view.reference ? `Permit ${view.reference}` : '', where, dates].filter(Boolean).join(' · '),
    meta: [
      `As at ${formatStoredDate(opts.today, { longMonth: true })}`,
      `held ${hoursWords(view.use.heldMinutes)}`,
      money && view.cost != null ? permitMoney(view.cost) : '',
    ].filter(Boolean).join(' · '),
  };
}
