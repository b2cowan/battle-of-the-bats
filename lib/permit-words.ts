/**
 * permit-words.ts — every sentence a permit says, in one place (Club Tier Stage 10a; hub K4MPu4ni53Ct7yrDcmWJd9 →
 * Mockups → Stages 10 + 11, specimens 1, 2, 3, 12, 14 and 15). The quiet line on every Where form, the club calendar's
 * read window, the Venue library's Permits view, a permit's window, the budget line's "Pays for" and the use workbook
 * all speak through here, so one permit reads the same words wherever it is seen. Client-safe, pure.
 *
 * ⚠ THE SURFACE WORD IS NEVER WRITTEN IN (owner wording ruling 2026-10-08): "Diamond 2" for softball and baseball,
 * "Court 2" for basketball — `facilityWords` (lib/venue-clash-words.ts) from the program's sport. A facility the club
 * named in full is said as named.
 * ⚠ A COACH READS A FACILITY, DAYS AND HOURS — NEVER A COST, ISSUER OR REFERENCE (owner 2026-10-11, plan §6 Ask 1). The
 * quiet line's builders only ever receive a `PermitOutside`, which carries nothing more.
 *
 * Copy status: drafted to the hub's drawings, then signed off by /marketing 2026-10-11 (four changed, each noted where it
 * lives: the quiet line's "Outside", the empty year, Delete's body, the bookings contact's hint). No tag is left open.
 */
import { formatTimeRange, joinWithAnd, pluralize } from './utils.ts';
import { daysBetweenDateStrings, formatStoredDate } from './timezone.ts';
import { facilityWords } from './venue-clash-words.ts';
import { fmt } from './coach-money-summary.ts';
import { WEEKDAY_HEADS } from './calendar-recipe.ts';
import { weekdayOf, type DateOff } from './permit-time.ts';

/** What a permit covers, named — the wire shape of the quiet line (a coach's reply carries exactly this). */
export interface PermitOutside {
  kind: 'outside';
  /** The booking's club day. */
  day: string;
  /** The booking's venue and facility, as the club names them. */
  venueName: string;
  facilityName: string | null;
  /** `covers` describes the booking's own facility (the permit holds it). */
  onFacility: boolean;
  /** Facility names (null = every facility at the venue), weekdays (1 = Monday), the hours. */
  covers: { facilities: string[] | null; weekdays: number[]; startTime: string; endTime: string }[];
  /** The permit's last day. */
  until: string;
  dateOff: DateOff | null;
}

/** A day's short name, 1 = Monday — the calendar recipe's own heads (C2: Monday first). */
const dayShort = (d: number) => WEEKDAY_HEADS[d - 1] ?? '';
const DAY_PLURAL = ['', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
/** A block's days, once each, Monday first. */
const sortedDays = (days: readonly number[]) => [...new Set(days)].sort((a, b) => a - b);

/** "Tue and Thu", "Mon, Wed and Fri", "every day" — a block's days, Monday first. */
export function weekdaysWords(days: readonly number[]): string {
  const sorted = sortedDays(days);
  return sorted.length === 7 ? 'every day' : joinWithAnd(sorted.map(dayShort));
}

/** "Tue, Thu" — a block's days as a row lists them (specimen 2's time rows), Monday first. */
export function weekdaysShort(days: readonly number[]): string {
  const sorted = sortedDays(days);
  return sorted.length === 7 ? 'Every day' : sorted.map(dayShort).join(', ');
}

/** "212 KB", "1.4 MB" — a document's size. */
export function fileSizeWords(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** "Sundays" for one day, else the short list — the summary line's word for a one-day series. */
export const weekdayPlural = (d: number) => DAY_PLURAL[d] ?? '';

/** "Sunday" — one of `weekdayPlural`'s days. */
export const weekdayOne = (d: number) => weekdayPlural(d).replace(/s$/, '');

/** "25 Sundays", "1 Sunday" — a count of one weekday. */
export const weekdayCount = (n: number, d: number) => pluralize(n, weekdayOne(d), weekdayPlural(d));

/** The one spelling of a day's name in the block form's checklist. */
export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map(d => ({ id: String(d), label: dayShort(d) }));

/**
 * A run of numbered facilities said as a range, as the dome's contract says it: "Field 1" … "Field 6" → "Fields 1–6";
 * two read as a pair ("Lane 1 and Lane 2"); anything else as a list. Sport words come from the caller.
 */
export function facilityListWords(names: readonly string[]): string {
  const list = names.filter(Boolean);
  if (list.length >= 3) {
    const parts = list.map(n => /^(.*?)\s*(\d+)$/.exec(n.trim()));
    const prefix = parts[0]?.[1];
    if (prefix && parts.every(p => p && p[1] === prefix)) {
      const nums = parts.map(p => Number(p![2]));
      const consecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
      if (consecutive) return `${prefix}s ${nums[0]}–${nums[nums.length - 1]}`;
    }
  }
  return joinWithAnd(list);
}

/** A club day said short: "Oct 29"; the year joins when it isn't the booking's own. */
const dayWords = (day: string, againstDay?: string) =>
  formatStoredDate(day, { withYear: !!againstDay && againstDay.slice(0, 4) !== day.slice(0, 4) });

/** "Tue and Thu, 5:30–9:00 p.m." — one cover, with its facilities in front when the line is about the venue. */
function coverWords(c: PermitOutside['covers'][number], sport: string | null | undefined, withFacilities: boolean): string {
  const when = `${weekdaysWords(c.weekdays)}, ${formatTimeRange(c.startTime, c.endTime)}`;
  if (!withFacilities) return when;
  const where = c.facilities === null
    ? 'every facility'
    : facilityListWords(c.facilities.map(f => facilityWords(sport, f) || f));
  return `${where} on ${when}`;
}

/** "It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29." — what the permit DOES hold, so the booking can move inside it. */
function coversSentence(o: PermitOutside, sport: string | null | undefined): string {
  const parts = o.covers.map(c => coverWords(c, sport, !o.onFacility));
  const list = parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return list ? `It covers ${list}, until ${dayWords(o.until, o.day)}.` : '';
}

/** Who the line is about: "the club’s permit for Diamond 2", or "the club’s permit at Lions Park". */
function aboutWords(o: PermitOutside, sport: string | null | undefined): string {
  const fac = o.onFacility && o.facilityName ? facilityWords(sport, o.facilityName) || o.facilityName : '';
  return fac ? `the club’s permit for ${fac}` : `the club’s permit at ${o.venueName}`;
}

/**
 * THE QUIET LINE under Venue (Ask 3, specimen 3) — WhereLine's `quiet` ink, never amber, never a refusal.
 *   "Outside the club’s permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29."
 *   on a facility the permit doesn't hold, or none set:
 *   "Outside the club’s permit at Lions Park. It covers Diamond 2 on Tue and Thu, 5:30–9:00 p.m., until Oct 29."
 *   on a date off: "Outside the club’s permit for Diamond 2: Oct 12 is a date off (Thanksgiving)."
 * ⚖ /marketing 2026-10-11: "Outside", the one word every permit surface uses (the series line, a date's mark, the
 * generator's count) — the drawing's "Not inside" was the one exception, and odd English. (The Use band's "Outside it"
 * was removed the same day, owner — a permit never lists those bookings; lib/permit-time.ts §3.)
 */
export function permitLine(o: PermitOutside | null | undefined, sport: string | null | undefined): string {
  if (!o) return '';
  const about = aboutWords(o, sport);
  if (o.dateOff) {
    const note = o.dateOff.note ? ` (${o.dateOff.note})` : '';
    return `Outside ${about}: ${dayWords(o.dateOff.day)} is a date off${note}.`;
  }
  const covers = coversSentence(o, sport);
  return `Outside ${about}.${covers ? ` ${covers}` : ''}`;
}

/**
 * The club calendar's read window says it ONCE, short (specimen 3's second frame), never on the rows.
 *   "Outside the club’s permit for Diamond 2." · with no facility set: "Outside the club’s permit at Lions Park."
 */
export function permitCalendarLine(o: PermitOutside | null | undefined, sport: string | null | undefined): string {
  if (!o) return '';
  if (o.dateOff) return `Outside ${aboutWords(o, sport)}: ${dayWords(o.dateOff.day)} is a date off.`;
  return `Outside ${aboutWords(o, sport)}.`;
}

/** A series' date mark, in the list the coach already reviews (quiet, beside the clash mark when both). */
export function permitDateMark(o: PermitOutside): string {
  return o.dateOff ? `A date off for the club’s permit${o.dateOff.note ? ` (${o.dateOff.note})` : ''}` : 'Outside the club’s permit';
}

/**
 * The one summary line for a series (the coach's repeat-weekly list, a series edit, house league's practice series): how
 * many of its dates are outside, then what the permit covers.
 *   "2 of 8 dates are outside the club’s permit for Diamond 2. It covers Tue and Thu, 5:30–9:00 p.m., until Oct 29."
 *   house league (no date list on screen): "2 of 8 Tuesdays are outside the club’s permit for Diamond B, on Nov 3 and
 *   Nov 10. It covers …"
 */
export function permitSeriesLine(
  perDate: readonly (PermitOutside | null | undefined)[],
  dates: readonly string[],
  sport: string | null | undefined,
  opts: { nameTheDates?: boolean } = {},
): string {
  const hits = perDate.map((o, i) => ({ o, date: dates[i] })).filter((x): x is { o: PermitOutside; date: string } => !!x.o);
  if (!hits.length) return '';
  if (perDate.length === 1) return permitLine(hits[0].o, sport);
  const first = hits[0].o;
  const total = perDate.length;
  const oneDay = dates.length > 0 && dates.every(d => !!d) && new Set(dates.map(weekdayOf)).size === 1;
  const noun = opts.nameTheDates && oneDay
    ? weekdayPlural(weekdayOf(dates[0]))
    : `date${total === 1 ? '' : 's'}`;
  const verb = hits.length === 1 ? 'is' : 'are';
  const on = opts.nameTheDates ? `, on ${joinWithAnd(hits.map(h => formatStoredDate(h.date, { withYear: false })))}` : '';
  const covers = first.dateOff && hits.length === 1 ? '' : coversSentence({ ...first, dateOff: null }, sport);
  const lead = hits.length === total && total > 1
    ? (total === 2 ? `Both ${noun} are` : `All ${total} ${noun} are`)
    : `${hits.length} of ${total} ${noun} ${verb}`;
  return `${lead} outside ${aboutWords(first, sport)}${on}.${covers ? ` ${covers}` : ''}`;
}

/**
 * After a generator saves (house league's): how many of its bookings are outside the club's permit, and the first line.
 * "3 games are outside the club’s permit" · "First: Outside the club’s permit for Diamond B. …" (after the clash message's own
 * "First:", the house-league generator's convention).
 */
export function permitAfterSave(lines: readonly string[], noun: string): { title: string; sentence: string } | null {
  const said = lines.filter(Boolean);
  if (!said.length) return null;
  return {
    title: `${pluralize(said.length, noun)} ${said.length === 1 ? 'is' : 'are'} outside the club’s permit`,
    sentence: `First: ${said[0]}`,
  };
}

// ── Hours and money, said one way ──────────────────────────────────────────────────────────────────

/** Hours as a number, to two places — the one rounding the screen's words and a spreadsheet cell share. */
export const hoursNumber = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** "80 h", "51.5 h", "0.25 h" — hours as the drawings say them. */
export function hoursWords(minutes: number): string {
  const h = hoursNumber(minutes);
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, '')} h`;
}

/** "51.5 of 80 h" — the Used column's second line. */
export const usedOfWords = (booked: number, held: number) => `${hoursWords(booked).replace(/ h$/, '')} of ${hoursWords(held)}`;

/** Booked over held, to the hundredth (0.64) — the one ratio the screen's percent and the Excel cell both read. */
export const usedRatio = (booked: number, held: number) => (held > 0 ? Math.round((booked / held) * 100) / 100 : 0);

/** "64%" — booked over held, whole percent; "0%" when nothing is held. */
export const usedPercent = (booked: number, held: number) => `${Math.round(usedRatio(booked, held) * 100)}%`;

export const permitMoney = (n: number | null | undefined) => (n == null ? '' : fmt(n));

// ── For whom (the drawing's choices) ───────────────────────────────────────────────────────────────

export type PermitHeldFor = 'club' | 'rep' | 'league' | 'team';
export const HELD_FOR_OPTIONS: { id: PermitHeldFor; label: string }[] = [
  { id: 'club', label: 'The club' },
  { id: 'rep', label: 'Rep teams' },
  { id: 'league', label: 'House league' },
  { id: 'team', label: 'One team' },
];
export const heldForWords = (v: PermitHeldFor, teamName?: string | null) =>
  v === 'team' ? teamName || 'A team' : HELD_FOR_OPTIONS.find(o => o.id === v)?.label ?? 'The club';

/** 0.75 → 75, 0.3333 → 33.3: a field's share as the percent the form and the read say. */
export const sharePercent = (share: number) => Math.round(share * 1000) / 10;

/**
 * A field's price in a permit (Ask 21): Full, Half, or the percent typed — ALWAYS of a full field's hour, never of the
 * permit's cost. "75% of the cost" read as 75% of the $27,000.00 sat right above it (owner 2026-10-11), so a percent
 * names its base. `size` is the read row's quiet line; `short` the workbook's Cost cell (words, never dollars).
 */
export function shareWords(share: number): { size: string; short: string } {
  if (share >= 1) return { size: 'Full field', short: 'Full' };
  if (Math.abs(share - 0.5) < 0.0001) return { size: 'Half field', short: 'Half' };
  const pct = sharePercent(share);
  return { size: `${pct}% of a full field`, short: `${pct}%` };
}

/**
 * "4 full fields and 2 half fields share the $27,000.00: a full field is $72.00 an hour, a half field $36.00." — the
 * line under a permit's field prices, in its window and in its form. A percent names itself ("1 field at 75%"): the
 * line used to say "1 field at a share share the …".
 */
export function fieldPricesSentence(shares: readonly number[], cost: number, fullHour: number): string {
  const full = shares.filter(s => s >= 1).length;
  const half = shares.filter(s => Math.abs(s - 0.5) < 0.0001).length;
  const byPercent = new Map<number, number>();
  for (const s of shares) {
    if (s >= 1 || Math.abs(s - 0.5) < 0.0001) continue;
    const pct = sharePercent(s);
    byPercent.set(pct, (byPercent.get(pct) ?? 0) + 1);
  }
  const parts = [
    full ? pluralize(full, 'full field') : '',
    half ? pluralize(half, 'half field') : '',
    ...[...byPercent].sort((a, b) => b[0] - a[0]).map(([pct, n]) => `${pluralize(n, 'field')} at ${pct}%`),
  ].filter(Boolean);
  const tail = half ? `, a half field ${permitMoney(fullHour / 2)}` : '';
  return `${joinWithAnd(parts)} ${shares.length === 1 ? 'pays' : 'share'} the ${permitMoney(cost)}: a full field is ${permitMoney(fullHour)} an hour${tail}.`;
}

/** A place as a permit's prices read it (the window's `PermitPlaceView` fits). */
export interface PricePlace {
  venueId: string;
  venueName: string;
  facilityName: string | null;
  share: number;
  hour?: number | null;
}
export interface PriceGroup { key: string; title: string; size: string; hour: number | null }

/**
 * ONE ROW PER PRICE (owner 2026-10-11, the permit window's cost as rows): the fields at one share, named in the words The
 * time already uses ("Fields 1–4", "Field 5 and Field 6", "Diamond 1, Diamond 3 and Diamond 4"), never across two venues —
 * a permit at two parks names the park on each row. In the places' own order, so a group sits where its first field does.
 */
export function priceGroups(places: readonly PricePlace[]): PriceGroup[] {
  const oneVenue = new Set(places.map(p => p.venueId)).size <= 1;
  const groups = new Map<string, { venueName: string; names: string[]; share: number; hour: number | null }>();
  for (const p of places) {
    const key = `${p.venueId}|${sharePercent(p.share)}`;
    const g = groups.get(key) ?? { venueName: p.venueName, names: [], share: p.share, hour: p.hour ?? null };
    if (p.facilityName) g.names.push(facilityWords(null, p.facilityName) || p.facilityName);
    groups.set(key, g);
  }
  return [...groups].map(([key, g]) => {
    const list = g.names.length ? facilityListWords(g.names) : '';
    return { key, title: !list ? g.venueName : oneVenue ? list : `${g.venueName} · ${list}`, size: shareWords(g.share).size, hour: g.hour };
  });
}

/**
 * "$27,000.00 over 375 full-field hours: a full field is $72.00 an hour." — the line under a permit's price rows: how the
 * one hour every price is a percent of was worked out (the rows already say each price, so it never repeats them).
 */
export function fieldHourSentence(cost: number, fullFieldHours: number, fullHour: number): string {
  const h = Math.round(fullFieldHours * 100) / 100;
  const hours = h.toLocaleString('en-CA', { maximumFractionDigits: 2 });
  return `${permitMoney(cost)} over ${hours} full-field ${h === 1 ? 'hour' : 'hours'}: a full field is ${permitMoney(fullHour)} an hour.`;
}

// ── The screens' words ─────────────────────────────────────────────────────────────────────────────

export const PERMIT_WORDS = {
  /** [marketing] Club Tier 11a part B: the door into New schedule, started from this permit (specimen 2). */
  handOut: 'Hand out this time in a schedule',
  /** [marketing] While a schedule hands the permit's time out, Delete is absent and this says why. */
  handedOutBy: (names: readonly string[]) => `${joinWithAnd(names.map(n => `“${n}”`))} ${names.length === 1 ? 'hands' : 'hand'} this time out, so the permit stays.`,
  /** The Venue library's view switch (the olive switch chooses what is read). */
  viewVenues: 'Venues',
  viewPermits: 'Permits',
  /** An empty year. Said to every reader (most can't add one, and the door is at the top for those who can), so it
   *  explains rather than instructs; sport-neutral ("a field permit", never "a diamond permit") — /marketing 2026-10-11. */
  emptyTitle: 'No permits for this year',
  emptyBody: 'Permits are the time the club holds at its venues — a town’s field permit, a dome’s winter contract. Each venue shows the permits that hold time there, and every booking form says when a time falls outside them.',
  loadFailed: 'We couldn’t load the club’s permits.',
  /** The table's band rows: the state, said once. */
  bandNow: 'In use now',
  bandLater: 'Starts later',
  bandEnded: 'Ended',
  /** The table's headings. */
  colPermit: 'Permit',
  colWhere: 'Where',
  colDates: 'Dates',
  colWeek: 'A week',
  colUsed: 'Used',
  colCost: 'Cost',
  /** The window's sections. */
  sectionPermit: 'The permit',
  sectionTime: 'The time',
  sectionCost: 'Cost',
  sectionPrices: 'What each field costs',
  sectionUse: 'Use',
  /** The Use band's three words (specimen 2, less "Outside it" — owner 2026-10-11). */
  held: 'Held',
  booked: 'Booked',
  unused: 'Unused',
  /** The cost band. */
  costLabel: 'Cost',
  anHourHeld: 'An hour held',
  aFullFieldHour: 'A full field, an hour',
  /** A field's price, read: "$46.96 an hour" — in the window's rows and beside the form's choice. */
  anHour: (amount: number) => `${permitMoney(amount)} an hour`,
  /** The form's choices for a field's price (Ask 21); "A percent" was "A share" (owner 2026-10-11 — a share of what?). */
  priceFull: 'Full cost',
  priceHalf: 'Half cost',
  pricePercent: 'A percent',
  /** Under the form's prices until the permit has a cost and its time (then the prices line takes its place). */
  pricesPending: 'A field at a percent costs that percent of a full field. Each field’s price an hour shows here once the permit has its cost and its time.',
  onTheBudget: 'On the budget',
  openTheLine: 'Open the line',
  noCost: 'No cost entered',
  noLine: 'Not on the budget',
  /** The read rows. */
  issuer: 'Issuer',
  reference: 'Reference',
  heldFor: 'For',
  dates: 'Dates',
  document: 'Document',
  notes: 'Notes',
  noDocument: 'No document',
  noDatesOff: 'No dates off.',
  /** The body's rare doors (they end the body). */
  renew: 'Renew for next year',
  deleteDoor: 'Delete this permit',
  /** Renew's one line, said when the copy opens (dates off don't carry — a holiday moves). */
  renewed: (name: string) => `${name} is ready to check: the same time a year on. Add the reference, the document, the cost and any dates off.`,
  deleteTitle: (name: string) => `Delete ${name}?`,
  // A permit holds TIME, never bookings — the teams' bookings at its venues are theirs and stay (/marketing 2026-10-11).
  deleteBody: 'Its blocks, field prices, dates off and document go with it. Nothing booked at its venues changes.',
  deleted: (name: string) => `${name} is deleted.`,
  added: (name: string) => `${name} added.`,
  /** Add permit. */
  addTitle: 'Add permit',
  addButton: 'Add permit',
  addBlock: 'Add a block',
  addDateOff: 'Add a date off',
  issuerHint: 'One of the club’s payees, or a new one',
  issuerTypedHint: 'Who issued it — the town, the dome',
  lineHint: 'The line on the club’s budget that pays for it',
  documentHint: 'The issuer’s copy, kept with the permit',
  uploadDocument: 'Upload the permit (PDF)',
  replaceDocument: 'Replace the document',
  everyFacility: 'Every facility',
  /** The money a reader without Accounting never sees — said nowhere; the parts are absent. */
  /** The edit form's held saves (the pill says why). */
  nameHeld: 'Give the permit a name to save it.',
  datesHeld: 'Give the permit its first and last day to save it.',
  datesOrderHeld: 'The last day can’t be before the first.',
  blockHeld: 'Every block needs a venue, a day and its hours to save it.',
  blockHoursHeld: 'A block’s end comes after its start.',
  blocksOverlapHeld: 'Two blocks hold the same place at the same time.',
  costHeld: 'Enter the cost as an amount, like 3200.00.',
  // Instructs, as its siblings do, and says why 100 isn't one (/marketing 2026-10-11).
  shareHeld: 'Enter each percent above 0 and below 100 (100 is Full cost).',
  /** The venue window's section and its contact. */
  venuePermitsHeading: 'Permits',
  bookingsContact: 'Bookings contact',
  // Says what it is, never what it will do: sending a schedule to it is Stage 11a's (/marketing 2026-10-11).
  bookingsContactHint: 'Who to email about bookings at this venue.',
  bookingsContactHeld: 'Enter the bookings contact as an email address.',
  /** The budget line's section (Ask 8a). */
  paysFor: 'Pays for',
  paysForOver: (total: number, over: number) => `The permits cost ${fmt(total)}, ${fmt(over)} more than this line plans.`,
  /** A permit that starts in a closed fiscal year: its money is locked with the year, its time is not (the money
   *  windows' locked line, `planClosedWords`'s shape). */
  moneyLocked: (year: string) => `${year} is closed, so this permit’s cost and budget line can’t change. Its time can.`,
  /** The plan gate (Ask 4: League Plus and both Club bands, as the Venue library). */
  planLocked: 'Permits come with League Plus and Club.',
} as const;

/**
 * Renew's name for the copy a year on: a year in the name moves with it ("Fall diamonds 2026" → "Fall diamonds 2027",
 * "Winter dome 2026–27" → "Winter dome 2027–28", "2026-2027" → "2027-2028"); a name with no year gets "(next year)" until
 * someone renames it. A season span is two CONSECUTIVE years — "2026-10" in a date is a year and a month, so a date in a
 * name moves a year ("2026-10-11 dome" → "2027-10-11 dome"), never its month (/review 10a).
 */
export function renewedName(name: string): string {
  const span = /(?<!\d)(\d{4})([–-])(\d{4}|\d{2})(?![\d–-])/.exec(name);
  if (span) {
    const a = Number(span[1]);
    const short = span[3].length === 2;
    const b = Number(span[3]);
    if (b === (short ? (a + 1) % 100 : a + 1)) {
      const next = short ? String((b + 1) % 100).padStart(2, '0') : String(b + 1);
      return name.replace(span[0], `${a + 1}${span[2]}${next}`);
    }
  }
  if (/(?<!\d)(19|20)\d{2}(?!\d)/.test(name)) return name.replace(/(?<!\d)(19|20)\d{2}(?!\d)/g, y => String(Number(y) + 1));
  return `${name} (next year)`.slice(0, 120);
}

/** "8 weeks", "6 months · 25 Sundays" — the Dates row's quiet second part. */
export function spanWords(startsOn: string, endsOn: string, oneWeekday: number | null, dayCount: number): string {
  const days = daysBetweenDateStrings(startsOn, endsOn) + 1;
  const weeks = Math.round(days / 7);
  const length = days >= 120 ? pluralize(Math.round(days / 30.44), 'month') : pluralize(Math.max(1, weeks), 'week');
  return oneWeekday ? `${length} · ${weekdayCount(dayCount, oneWeekday)}` : length;
}
