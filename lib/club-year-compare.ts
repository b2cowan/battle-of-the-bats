/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A FISCAL YEAR AGAINST THE YEAR BEFORE, AND THE YEAR-END REPORT (Club Tier Stage 3c; Ask 8c, specimen 5).
 *
 * ⚖ COMPARE › AGAINST LAST YEAR — the club's SEVENTH named difference from the coach's Budget vs. Actual (the
 * coach compares seasons on the closed-season page and must never gain a year on a live screen). This
 * year's Actual beside last year's, and the Change (this − last, plain arithmetic). Category by category,
 * each with its items, the two section totals and the net. Filed by the ONE filing rule (`fileClubLine`) and
 * counted by the ONE rule (`countsAsActual`), so a row here is a row of each year's own Statement:
 *   · a closed year against the year before: two whole years;
 *   · the open year: to today, against the year before to the same day;
 *   · against (or from) a SHORT year: the same months — only the calendar months both years hold, a year apart
 *     (a short January–August year against January–August of the year before; the twelve months after a short
 *     year against it from January, so there is nothing to compare until January comes). `thisSpan` and
 *     `lastSpan` name the spans compared, so the screen can say them.
 * Last year's figures are its books as they were closed, so neither column can move (the lock).
 * The bills of an EARLIER year paid in either year are one row ("Earlier years' bills"), whichever year
 * they were planned in, so the two columns compare like with like.
 *
 * ⚖ THE YEAR-END REPORT — read only from locked figures: the closed year's span and close, the year at a
 * glance (opening · revenue · expenses · net · closing), the Statement against budget and against last year,
 * the club's books at both ends, the teams' standing with the club AT THE CLOSE (the close's snapshot),
 * what carried, and one line instead of the teams' cash (the club never stores it, so it can't be stated at
 * the year's end).
 *
 * Pure and client-safe: no database, no Date. Money in cents through the figures.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { clubMovement, countsAsActual, netForYear, sumMoney } from './club-money-figures';
import { shiftMonthsBack, shiftMonthsOn, type FiscalSetting, type FiscalYear } from './club-fiscal-year';
import {
  allocationYearKey, fileClubLine, loopIndex, EARLIER_BILLS_PREFIX,
  type ClubAllocationFacts, type ClubBookLineFacts, type ClubRequestFacts, type ClubReport, type ClubBook, type TeamScope,
} from './club-budget-report';
import { categoryKey } from './coach-budget-rollup';
import { EARLIER_YEARS_BILLS_WORD, OUTSIDE_YOUR_GROUPS_WORD } from './club-money-words';
import { toCents, toDollars } from './coach-register';

export interface CompareSpan { from: string; to: string }

/**
 * The two spans compared — THE SAME MONTHS, A YEAR APART: the months this year shares with the year before moved
 * on twelve months (two twelve-month years: all of them; against or from a short year: only the months both hold),
 * and while this year runs, only to today. Null while those months haven't begun.
 */
export function compareSpans(year: FiscalYear, before: FiscalYear, today: string): { thisSpan: CompareSpan; lastSpan: CompareSpan } | null {
  const shiftedFirst = shiftMonthsOn(before.firstDay, 12), shiftedLast = shiftMonthsOn(before.lastDay, 12);
  const from = year.firstDay > shiftedFirst ? year.firstDay : shiftedFirst;
  const end = year.lastDay < shiftedLast ? year.lastDay : shiftedLast;
  if (from > end || today < from) return null;
  const thisTo = today < end ? today : end;
  return { thisSpan: { from, to: thisTo }, lastSpan: { from: shiftMonthsBack(from, 12), to: shiftMonthsBack(thisTo, 12) } };
}

export interface CompareItem { itemId: string | null; itemName: string; thisYear: number; lastYear: number; change: number }
export interface CompareCategory { categoryId: string | null; categoryName: string; thisYear: number; lastYear: number; change: number; items: CompareItem[] }
export interface CompareSection { direction: 'in' | 'out'; categories: CompareCategory[]; thisYear: number; lastYear: number; change: number }

export interface AgainstLastYear {
  lastYear: { key: string; name: string };
  thisSpan: CompareSpan;
  lastSpan: CompareSpan;
  revenue: CompareSection;
  expenses: CompareSection;
  net: { thisYear: number; lastYear: number; change: number };
}

type Key = string;
interface Acc { categoryId: string | null; categoryName: string; items: Map<Key, { itemId: string | null; itemName: string; c: [number, number] }> }


/** Each counted line of a year, filed once (the Statement's own rule) — an earlier year's bill as one row. */
function fileYear(
  lines: readonly ClubBookLineFacts[], span: CompareSpan, yearKey: string, side: 0 | 1,
  allocations: readonly ClubAllocationFacts[], requests: readonly ClubRequestFacts[], setting: FiscalSetting,
  into: { in: Map<Key, Acc>; out: Map<Key, Acc> },
): void {
  const loop = loopIndex(allocations, requests);
  const byId = new Map(allocations.map(a => [a.id, a] as const));
  for (const l of lines) {
    if (l.entryDate < span.from || l.entryDate > span.to || !countsAsActual(l)) continue;
    const { filing, source } = fileClubLine(l, loop);
    const dir = clubMovement(l) as 'in' | 'out';
    let itemId = filing.itemId, itemName = filing.itemName ?? filing.categoryName;
    if (source?.kind === 'allocation') {
      const a = byId.get(source.allocationId);
      if (a && allocationYearKey(a, setting) < yearKey) { itemId = EARLIER_BILLS_PREFIX; itemName = EARLIER_YEARS_BILLS_WORD; }
    }
    const book = into[dir];
    const ck = categoryKey(filing.categoryId, filing.categoryName);
    const cat = book.get(ck) ?? { categoryId: filing.categoryId, categoryName: filing.categoryName, items: new Map() };
    const ik = itemId ?? `name:${itemName}`;
    const item = cat.items.get(ik) ?? { itemId, itemName, c: [0, 0] as [number, number] };
    item.c[side] += toCents(l.amount);
    cat.items.set(ik, item);
    book.set(ck, cat);
  }
}

function section(direction: 'in' | 'out', accs: Map<Key, Acc>, order: readonly string[]): CompareSection {
  const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? order.length : i; };
  const categories: CompareCategory[] = [...accs.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1].categoryName.localeCompare(b[1].categoryName))
    .map(([, acc]) => {
      const items: CompareItem[] = [...acc.items.values()].map(i => ({
        itemId: i.itemId, itemName: i.itemName, thisYear: toDollars(i.c[0]), lastYear: toDollars(i.c[1]), change: toDollars(i.c[0] - i.c[1]),
      })).sort((a, b) => a.itemName.localeCompare(b.itemName));
      const t = items.reduce((s, i) => s + toCents(i.thisYear), 0), l = items.reduce((s, i) => s + toCents(i.lastYear), 0);
      return { categoryId: acc.categoryId, categoryName: acc.categoryName, thisYear: toDollars(t), lastYear: toDollars(l), change: toDollars(t - l), items };
    });
  const t = categories.reduce((s, c) => s + toCents(c.thisYear), 0), l = categories.reduce((s, c) => s + toCents(c.lastYear), 0);
  return { direction, categories, thisYear: toDollars(t), lastYear: toDollars(l), change: toDollars(t - l) };
}

/**
 * COMPARE › AGAINST LAST YEAR. `thisLines` and `lastLines` are each year's lines on the club's own books
 * (any status — only what counts is counted); `statementOrder` is this year's Statement's category order
 * (the plan's), so the two read in one order.
 */
export function buildAgainstLastYear(input: {
  year: FiscalYear;
  before: FiscalYear;
  spans: { thisSpan: CompareSpan; lastSpan: CompareSpan };
  thisLines: readonly ClubBookLineFacts[];
  lastLines: readonly ClubBookLineFacts[];
  allocations: readonly ClubAllocationFacts[];
  requests: readonly ClubRequestFacts[];
  setting: FiscalSetting;
  statementOrder: { revenue: readonly string[]; expenses: readonly string[] };
}): AgainstLastYear {
  const acc = { in: new Map<Key, Acc>(), out: new Map<Key, Acc>() };
  fileYear(input.thisLines, input.spans.thisSpan, input.year.key, 0, input.allocations, input.requests, input.setting, acc);
  fileYear(input.lastLines, input.spans.lastSpan, input.before.key, 1, input.allocations, input.requests, input.setting, acc);
  const revenue = section('in', acc.in, input.statementOrder.revenue);
  const expenses = section('out', acc.out, input.statementOrder.expenses);
  const thisNet = netForYear(revenue.thisYear, expenses.thisYear), lastNet = netForYear(revenue.lastYear, expenses.lastYear);
  return {
    lastYear: { key: input.before.key, name: input.before.name },
    thisSpan: input.spans.thisSpan, lastSpan: input.spans.lastSpan,
    revenue, expenses,
    net: { thisYear: thisNet, lastYear: lastNet, change: netForYear(thisNet, lastNet) },
  };
}

/** Does a year hold anything that counts, in a span? ("offered when the year before has books") */
export function holdsBooks(lines: readonly ClubBookLineFacts[], span: CompareSpan): boolean {
  return lines.some(l => l.entryDate >= span.from && l.entryDate <= span.to && countsAsActual(l));
}

/** The category order a Statement reads in (for the compare to follow it). */
export function statementOrder(report: Pick<ClubReport, 'statement'>): { revenue: string[]; expenses: string[] } {
  const keys = (cats: readonly { categoryId: string | null; categoryName: string }[]) => cats.map(c => categoryKey(c.categoryId, c.categoryName));
  return { revenue: keys(report.statement.revenue.categories), expenses: keys(report.statement.expenses.categories) };
}

// ══ THE YEAR-END REPORT (specimen 5) ═════════════════════════════════════════════════════════════

/** What the close stored (org_fiscal_years.closing_snapshot) — the figures as they stood at the close. */
export interface CloseSnapshot {
  installments: { count: number; amount: number; overdue: number; sent: number; upcoming: number };
  requests: { count: number; amount: number };
  unfiled: { count: number; amount: number };
  pending: { count: number; amount: number };
  teams: { teamId: string; teamName: string; billed: number; collected: number; owed: number }[];
  totals: { billed: number; collected: number; owed: number };
  /** Short names for the still-open lines ("10U A, 16U Girls, 12U Girls"). */
  installmentTeams?: string[];
  requestTeams?: string[];
  pendingPayees?: string[];
}

/**
 * THE SNAPSHOT, AS ONE READER MAY SEE IT (B11). A close stores the club's whole record, unscoped; a member scoped to
 * rep-team groups reads the teams in their groups by name, and every other team COUNTED, never named: their
 * standing is one row ("A team outside your groups", its figures summed), and their names in the still-open lists
 * read the same words. The club's totals stay the club's (they are what the closing locked). `teamIdsByName` is the
 * club's teams — a name a reader can't place among their own groups' teams is never shown.
 */
export function scopeCloseSnapshot(
  snapshot: CloseSnapshot, scope: TeamScope, teamIdsByName: ReadonlyMap<string, readonly string[]>,
): CloseSnapshot {
  if (!scope) return snapshot;
  const named = (name: string) => {
    const ids = teamIdsByName.get(name) ?? [];
    return ids.length > 0 && ids.every(id => scope.has(id)) ? name : OUTSIDE_YOUR_GROUPS_WORD;
  };
  const mine = snapshot.teams.filter(t => scope.has(t.teamId));
  const others = snapshot.teams.filter(t => !scope.has(t.teamId));
  const sum = (k: 'billed' | 'collected' | 'owed') => sumMoney(others.map(t => ({ amount: t[k] })));
  const names = (xs: readonly string[] | undefined) => (xs ? [...new Set(xs.map(named))] : xs);
  return {
    ...snapshot,
    teams: others.length ? [...mine, { teamId: '', teamName: OUTSIDE_YOUR_GROUPS_WORD, billed: sum('billed'), collected: sum('collected'), owed: sum('owed') }] : mine,
    installmentTeams: names(snapshot.installmentTeams),
    requestTeams: names(snapshot.requestTeams),
  };
}

export interface YearEndReport {
  year: { key: string; name: string; firstDay: string; lastDay: string };
  closed: { at: string; byName: string | null };
  atAGlance: { opening: number; revenue: number; expenses: number; net: number; closing: number };
  /** The Statement against budget (the closed year's own, locked). */
  statement: ClubReport['statement'];
  /** Against the year before, whole years (null when the year before has no books). */
  againstLastYear: AgainstLastYear | null;
  /** Each club book at both ends: what it held the day before the first day, and at the last day. */
  books: { id: string; name: string; kind: string; atStart: number; atEnd: number }[];
  booksTotal: { atStart: number; atEnd: number };
  /** The teams' standing with the club AT THE CLOSE (the snapshot). */
  teams: CloseSnapshot['teams'];
  teamsTotal: CloseSnapshot['totals'];
  /** What carried into the next year: the closing (its locked opening) and what was still open. */
  carried: {
    nextYear: { key: string; name: string };
    closing: number;
    stillOpen: Pick<CloseSnapshot, 'installments' | 'requests' | 'pending'> & Pick<CloseSnapshot, 'installmentTeams' | 'requestTeams' | 'pendingPayees'>;
  };
}

export function buildYearEndReport(input: {
  year: FiscalYear;
  closedByName: string | null;
  opening: number;
  report: Pick<ClubReport, 'statement'>;
  againstLastYear: AgainstLastYear | null;
  books: readonly (Pick<ClubBook, 'id' | 'name' | 'kind'> & { atStart: number; atEnd: number })[];
  snapshot: CloseSnapshot;
  nextYear: FiscalYear;
}): YearEndReport {
  const { year, report, snapshot } = input;
  if (!year.closed) throw new Error('buildYearEndReport: a year-end report is read only from a CLOSED year');
  const revenue = report.statement.revenue.actual, expenses = report.statement.expenses.actual;
  return {
    year: { key: year.key, name: year.name, firstDay: year.firstDay, lastDay: year.lastDay },
    closed: { at: year.closed.at, byName: input.closedByName },
    atAGlance: { opening: input.opening, revenue, expenses, net: netForYear(revenue, expenses), closing: year.closed.closingBalance },
    statement: report.statement,
    againstLastYear: input.againstLastYear,
    books: input.books.map(b => ({ id: b.id, name: b.name, kind: b.kind, atStart: b.atStart, atEnd: b.atEnd })),
    booksTotal: {
      atStart: sumMoney(input.books.map(b => ({ amount: b.atStart }))),
      atEnd: sumMoney(input.books.map(b => ({ amount: b.atEnd }))),
    },
    teams: snapshot.teams,
    teamsTotal: snapshot.totals,
    carried: {
      nextYear: { key: input.nextYear.key, name: input.nextYear.name },
      closing: year.closed.closingBalance,
      stillOpen: {
        installments: snapshot.installments, requests: snapshot.requests, pending: snapshot.pending,
        installmentTeams: snapshot.installmentTeams, requestTeams: snapshot.requestTeams, pendingPayees: snapshot.pendingPayees,
      },
    },
  };
}
