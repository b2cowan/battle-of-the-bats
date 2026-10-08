/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S FISCAL YEAR — ONE DEFINITION (Club Tier Stage 3c; Asks 5 and 9, S3C-01, S3C-08; mig 318).
 *
 * The club's period is its FISCAL YEAR (Ask 9: the board's own word, the club side only — the coach keeps
 * "season"; never "financial year"). It names a period and promises nothing D2 left out: no fiscal
 * periods, no closing entries.
 *
 * ⚖ THE ONE WAY TO FIND A YEAR: `fiscalYearOf(day, setting)`, for any day, past or future, from the club's
 * first month and its rows (`org_fiscal_years`). It is the pure twin of the database's
 * `club_fiscal_year_ensure` (mig 318), and `check:club-money-atomicity` holds the two equal:
 *   · a day inside a row → that row;
 *   · after the newest row → twelve-month years from the day after it;
 *   · before the oldest row → twelve-month years ending the day before it;
 *   · no rows at all → the year from the club's first month (a January club with no rows reads calendar
 *     years exactly as every club did before 3c).
 * A year that has begun keeps its months; a change of first month makes the NEXT year the short one
 * (the database's step does it — `club_fiscal_first_month_set`), never a long one.
 *
 * ⚖ THE NAME RULE (`fiscalYearName`): the year's number for a January–December year ("2026"); "2026–27"
 * (en dash, the second year's last two digits) for one that crosses a New Year. An open year can be
 * renamed (unique per club); every read and export prints `name`, never a hand-built label. A FILE name
 * writes the en dash as a hyphen (`fiscalYearFileName`).
 *
 * ⚖ THE KEY (call 3): a year is addressed by its FIRST DAY ("2026-09-01" — `?year=` on every club money
 * read). It survives a rename, it is never the name, and it exists for a year nothing has been recorded
 * in yet. An old `?year=2026` link keeps landing: a bare number reads the year with that name, else the
 * year that starts in that calendar year (on a January club, both are Jan 1–Dec 31 of it).
 *
 * ⚖ CLOSED (Asks 1–3): a club's books are CLOSED THROUGH the last day of its newest closed year; years
 * close oldest first, so every year on or before that day is LOCKED (`locked`). A year with a row that
 * was closed carries who closed it, when, and the closing balance it locked (`closed`).
 *
 * Pure and client-safe: no database, no server imports, no Date.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { addCalendarDays } from './timezone';

/** A year's row, as the database keeps it (`org_fiscal_years`). */
export interface FiscalYearRow {
  id: string;
  name: string;
  firstDay: string;
  lastDay: string;
  closedAt: string | null;
  closedBy: string | null;
  closingBalance: number | null;
}

/** What finding a year needs: the club's first month (1–12) and its rows, oldest first. */
export interface FiscalSetting {
  firstMonth: number;
  rows: readonly FiscalYearRow[];
}

/** A fiscal year, as every club money read returns it. */
export interface FiscalYear {
  /** Its first day — the key an address carries (`?year=`). */
  key: string;
  /** The row's id; null for a year nothing has needed a row for yet. */
  id: string | null;
  name: string;
  firstDay: string;
  lastDay: string;
  /** How many months it runs (1–12). */
  months: number;
  /** Shorter than twelve months: the year a change of first month shortened. */
  short: boolean;
  /** Its close, when it was closed (a year before the club's first closed year is `locked` with no close). */
  closed: { at: string; by: string | null; closingBalance: number } | null;
  /** Inside the closed stretch: nothing dated in it can be added, changed or removed. */
  locked: boolean;
}

/** The FISCAL YEAR's word (Ask 9): one spelling everywhere a club person reads it. */
export const FISCAL_YEAR_WORD = 'Fiscal year';

const pad2 = (n: number) => String(n).padStart(2, '0');
const yearOf = (day: string) => Number(day.slice(0, 4));
const monthOf = (day: string) => Number(day.slice(5, 7));

/** The first day of the month `n` months after `day`'s month. */
function monthStart(day: string, n: number): string {
  const total = yearOf(day) * 12 + (monthOf(day) - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}-01`;
}

/** The last day of a twelve-month year starting `first`. */
const twelveMonthsFrom = (first: string) => addCalendarDays(monthStart(first, 12), -1);

/** The same day `months` months earlier: a month's last day stays its month's last day; a day past the
 *  target month's end lands on that end (Mar 31 − 1 month = Feb 28). */
export function shiftMonthsBack(day: string, months: number): string {
  const target = monthStart(day, -months);
  const targetEnd = addCalendarDays(monthStart(target, 1), -1);
  const isEnd = addCalendarDays(day, 1).slice(8, 10) === '01';
  if (isEnd) return targetEnd;
  const d = Number(day.slice(8, 10));
  return d > Number(targetEnd.slice(8, 10)) ? targetEnd : `${target.slice(0, 8)}${pad2(d)}`;
}

/** The same day `months` months later: a month's last day stays its month's last day (Feb 28 2027 + 12 months =
 *  Feb 29 2028); a day past the target month's end lands on that end. */
export function shiftMonthsOn(day: string, months: number): string {
  return shiftMonthsBack(day, -months);
}

/** How many whole months a year runs. */
export function monthsBetween(first: string, last: string): number {
  return (yearOf(last) - yearOf(first)) * 12 + monthOf(last) - monthOf(first) + 1;
}

/** THE NAME RULE: "2026" for January–December, "2026–27" across a New Year. */
export function fiscalYearName(firstDay: string, lastDay: string): string {
  const a = yearOf(firstDay), b = yearOf(lastDay);
  return a === b ? String(a) : `${a}–${pad2(b % 100)}`;
}

/** A year's name in a FILE name: the en dash written as a hyphen (the only place it is). */
export function fiscalYearFileName(name: string): string {
  return name.replace(/–/g, '-');
}

/** The rule's name, or — when a renamed year already holds it — the name with a number after it
 *  (`club_fiscal_year_free_name`'s twin). */
function freeName(rows: readonly FiscalYearRow[], first: string, last: string): string {
  const base = fiscalYearName(first, last);
  const taken = new Set(rows.map(r => r.name.toLowerCase()));
  let name = base, n = 1;
  while (taken.has(name.toLowerCase())) { n++; name = `${base} (${n})`; }
  return name;
}

/** The day the club's books are closed through (its newest closed year's last day), or null. */
export function closedThrough(setting: FiscalSetting): string | null {
  let through: string | null = null;
  for (const r of setting.rows) if (r.closedAt && (!through || r.lastDay > through)) through = r.lastDay;
  return through;
}

/** The club's LATEST closed year — the only one Reopen unlocks (Ask 3) — or null before the first close. The ONE
 *  answer the Reopen button, the locked sentences and the server's refusal read. */
export function latestClosedYear(setting: FiscalSetting): FiscalYear | null {
  const through = closedThrough(setting);
  const row = through ? setting.rows.find(r => r.closedAt && r.lastDay === through) ?? null : null;
  return row ? fiscalYearOf(row.firstDay, setting) : null;
}

function yearFrom(row: { id: string | null; name: string; firstDay: string; lastDay: string }, through: string | null,
  close: FiscalYearRow | null): FiscalYear {
  const months = monthsBetween(row.firstDay, row.lastDay);
  return {
    key: row.firstDay, id: row.id, name: row.name, firstDay: row.firstDay, lastDay: row.lastDay,
    months, short: months < 12,
    closed: close?.closedAt ? { at: close.closedAt, by: close.closedBy, closingBalance: close.closingBalance ?? 0 } : null,
    locked: through !== null && row.lastDay <= through,
  };
}

/**
 * THE FISCAL YEAR A DAY FALLS IN (`club_fiscal_year_ensure`'s pure twin). `day` is a club day,
 * `YYYY-MM-DD`.
 */
export function fiscalYearOf(day: string, setting: FiscalSetting): FiscalYear {
  const rows = [...setting.rows].sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  const through = closedThrough(setting);
  const hit = rows.find(r => day >= r.firstDay && day <= r.lastDay);
  if (hit) return yearFrom(hit, through, hit);

  let first: string;
  if (rows.length === 0) {
    const m = setting.firstMonth;
    first = `${yearOf(day) - (monthOf(day) < m ? 1 : 0)}-${pad2(m)}-01`;
  } else if (day > rows[rows.length - 1].lastDay) {
    first = addCalendarDays(rows[rows.length - 1].lastDay, 1);
    while (day > twelveMonthsFrom(first)) first = monthStart(first, 12);
  } else {
    first = monthStart(rows[0].firstDay, -12);
    while (day < first) first = monthStart(first, -12);
  }
  const last = twelveMonthsFrom(first);
  return yearFrom({ id: null, name: freeName(rows, first, last), firstDay: first, lastDay: last }, through, null);
}

/** The year whose KEY (first day) this is, or null when no year starts that day. */
export function fiscalYearAt(key: string, setting: FiscalSetting): FiscalYear | null {
  const y = fiscalYearOf(key, setting);
  return y.firstDay === key ? y : null;
}

/** The year after, and the year before. */
export const nextFiscalYear = (y: FiscalYear, s: FiscalSetting) => fiscalYearOf(addCalendarDays(y.lastDay, 1), s);
export const previousFiscalYear = (y: FiscalYear, s: FiscalSetting) => fiscalYearOf(addCalendarDays(y.firstDay, -1), s);

/**
 * The calendar years a fiscal year touches (one for January–December, two across a New Year). A team's
 * season stores no dates, only a number (S3C-04), so a team is active in a fiscal year when it has a season
 * numbered for either of these (S3C-03 — the shared-payee report's teams).
 */
export function calendarYearsTouched(y: Pick<FiscalYear, 'firstDay' | 'lastDay'>): number[] {
  const a = yearOf(y.firstDay), b = yearOf(y.lastDay);
  return a === b ? [a] : [a, b];
}

/** The year's months, first to last (`YYYY-MM`): twelve, or a short year's own. */
export function fiscalYearMonths(y: Pick<FiscalYear, 'firstDay' | 'lastDay'>): string[] {
  const out: string[] = [];
  for (let m = y.firstDay; m <= y.lastDay; m = monthStart(m, 1)) out.push(m.slice(0, 7));
  return out;
}

/**
 * THE CLUB'S QUARTERS (S3C-02): three months at a time from the year's first month, named by their
 * months ("Sep–Nov"); a short year's last quarter may be shorter. The coach's quarters are calendar
 * quarters and are unchanged (`quarterKeyOf`, lib/coach-budget-periods-view.ts).
 * The key is the quarter's first month with `~q` ("2026-09~q"): its first four characters are a year,
 * as the period grid's year bands read every key.
 */
export interface FiscalQuarter { key: string; label: string; months: string[] }

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fiscalQuarters(y: Pick<FiscalYear, 'firstDay' | 'lastDay'>): FiscalQuarter[] {
  const months = fiscalYearMonths(y);
  const out: FiscalQuarter[] = [];
  for (let i = 0; i < months.length; i += 3) {
    const group = months.slice(i, i + 3);
    const a = MONTH_SHORT[Number(group[0].slice(5, 7)) - 1];
    const b = MONTH_SHORT[Number(group[group.length - 1].slice(5, 7)) - 1];
    out.push({ key: `${group[0]}~q`, label: group.length === 1 ? a : `${a}–${b}`, months: group });
  }
  return out;
}

/**
 * A `?year=` off a request: a key (`YYYY-MM-DD`, a year's first day) or an old bare number. Null when it
 * names no year (the caller reads the year today falls in).
 */
export function readFiscalYearParam(raw: string | null | undefined, setting: FiscalSetting): FiscalYear | null {
  const v = (raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    if (y < 1990 || y > 2199) return null;
    return fiscalYearAt(v, setting);
  }
  if (/^\d{4}$/.test(v)) {
    const n = Number(v);
    if (n < 1990 || n > 2199) return null;
    const named = setting.rows.find(r => r.name === v);
    if (named) return fiscalYearOf(named.firstDay, setting);
    // The year that starts in that calendar year (a January club: Jan 1–Dec 31 of it).
    const y = fiscalYearOf(`${n}-12-31`, setting);
    return yearOf(y.firstDay) === n ? y : fiscalYearOf(`${n}-01-01`, setting);
  }
  return null;
}

/** A year as the Year pill lists it. */
export interface FiscalYearOption {
  key: string;
  name: string;
  /** Closed (or before the first close): the pill's lock glyph. */
  locked: boolean;
  /** The year today falls in: the pill's dot. */
  current: boolean;
  /** How many months it runs: a SHORT year's menu row says it ("8 months" — the one exception to the bare rows). */
  months: number;
  /** Plan lines on it (the Budget's empty year offers to start from the newest earlier year that has some). */
  lines: number;
}

/**
 * The years the Year pill offers (C10's planning half, 3b's rule on the fiscal year): every year with a
 * plan line, every closed year, the year today falls in and ALWAYS the next one — never an empty year two
 * ahead. Newest first.
 */
export function fiscalYearOptions(
  setting: FiscalSetting, today: string, linesByYearKey: Readonly<Record<string, number>>,
): FiscalYearOption[] {
  const current = fiscalYearOf(today, setting);
  const keys = new Set<string>([current.key, nextFiscalYear(current, setting).key]);
  for (const k of Object.keys(linesByYearKey)) if (linesByYearKey[k] > 0) keys.add(k);
  for (const r of setting.rows) if (r.closedAt) keys.add(r.firstDay);
  return [...keys].sort((a, b) => b.localeCompare(a)).map(k => {
    const y = fiscalYearOf(k, setting);
    return { key: y.key, name: y.name, locked: y.locked, current: y.key === current.key, months: y.months, lines: linesByYearKey[y.key] ?? 0 };
  });
}

/**
 * THE FISCAL YEAR AS EVERY READ RETURNS IT (S3C-01: "no page works a year out again"): the year, who closed it
 * (by name), whether it is the year today falls in, and whether THIS reader can write it (`canWrite` — false
 * on a locked year for everyone; the Budget's own `canMove` reads it, so a closed year's writes are absent,
 * never greyed). Built on the server (`describeFiscalYear`, lib/club-fiscal-year-server.ts).
 */
export interface FiscalYearRead extends FiscalYear {
  closedByName: string | null;
  current: boolean;
  canWrite: boolean;
  /** Its latest Reopen (who, when, why) — the closed-year line names it, and so does an open year that was reopened
   *  and not yet closed again (Ask 3: "Reopened Oct 9 by Priya Nair: A bounced cheque from 10U A"). */
  reopened: { at: string; byName: string | null; reason: string } | null;
  /** The club's LATEST closed year (only it can be reopened — Ask 3); null before the first close. */
  latestClosed: { key: string; name: string } | null;
  /** This reader may reopen THIS year: it is the latest closed year and they can move the club's money. */
  canReopen: boolean;
  /** This reader moves the club's money (3a's one rule), whatever the year — `canWrite` adds "and it is open". */
  canMove: boolean;
  /** The year before, when it is CLOSED: this year's opening is its closing, locked (Ask 4 — the Budget's opening
   *  row says where it came from). */
  carriedFrom: { key: string; name: string; closedAt: string } | null;
}

/**
 * A record dated in the club's CLOSED stretch (Stage 3c, Ask 8d — S3C-07): the closed year it sits in, and Reopen's
 * year when that is the LATEST closed year and this reader moves the club's money (Ask 3). Null for an open day. The
 * screens put one locked sentence where its corrections (Undo, Reverse, Void) would be.
 */
export function lockedIn(day: string | null | undefined, setting: FiscalSetting, canMove: boolean): { yearName: string; reopen: string | null } | null {
  const through = closedThrough(setting);
  if (!day || !through || day > through) return null;
  const y = fiscalYearOf(day, setting);
  const latest = latestClosedYear(setting);
  return { yearName: y.name, reopen: canMove && latest && day >= latest.firstDay ? y.name : null };
}
