import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { addCalendarDays, daysBetweenDateStrings } from './timezone';
import { getBookTotals, resolvePersonNamer } from './db';
import { loadClubLoop, seasonsHoldingPayout, type ClubLoop } from './club-money-reads';
import {
  allocationsOf, loadBookLines, loadClubBooks, loadRequests, readClubYear, loadYear,
} from './club-budget-read';
import {
  allocationInYear, allocationYearKey, fileClubLine, loopIndex, type ClubAllocationFacts, type ClubReport, type TeamScope,
} from './club-budget-report';
import {
  clubBillFigures, clubInstallmentDaysLate, clubInstallmentState, clubMovement, countsAsActual, sumMoney,
  type CountAndAmount,
} from './club-money-figures';
import {
  closedThrough, fiscalYearOf, nextFiscalYear, previousFiscalYear,
  type FiscalSetting, type FiscalYear,
} from './club-fiscal-year';
import { closerNames } from './club-fiscal-year-server';
import { NOT_FILED_ID } from './club-ledger';
import { NOT_FILED_WORD, OUTSIDE_YOUR_GROUPS_WORD } from './club-money-words';
import {
  buildAgainstLastYear, buildYearEndReport, compareSpans, holdsBooks, scopeCloseSnapshot, statementOrder,
  type AgainstLastYear, type CloseSnapshot, type YearEndReport,
} from './club-year-compare';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FISCAL YEAR'S READS (Club Tier Stage 3c; Asks 2, 3, 4, 8c; specimens 3–5). Every figure is the
 * definitions module's (lib/club-money-figures.ts) or the year-compare module's (lib/club-year-compare.ts);
 * nothing is summed here. Teams outside the reader's groups (B11) are counted, never named, wherever a list
 * names teams; the CLOSE stores the club's whole figures (it is the club's record, whoever closes it).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type YearRows = Awaited<ReturnType<typeof loadYear>>;

// ── Compare › Against last year (Ask 8c) ─────────────────────────────────────────────────────

/** This year's Actual beside the year before's — null while this year hasn't begun, or when the year before
 *  has no books in the span compared ("offered when the year before has books"). */
export async function againstLastYear(
  p: { year: FiscalYear; setting: FiscalSetting; today: string; report: ClubReport; rows: YearRows },
): Promise<AgainstLastYear | null> {
  const before = previousFiscalYear(p.year, p.setting);
  const spans = compareSpans(p.year, before, p.today);
  if (!spans) return null;
  const lastLines = await loadBookLines(p.rows.books, { first: spans.lastSpan.from, last: spans.lastSpan.to });
  if (!holdsBooks(lastLines, spans.lastSpan)) return null;
  return buildAgainstLastYear({
    year: p.year, before, spans, thisLines: p.rows.bookLines, lastLines,
    allocations: p.rows.allocations, requests: p.rows.requests, setting: p.setting,
    statementOrder: statementOrder(p.report),
  });
}

// ── The close question (Ask 2) ───────────────────────────────────────────────────────────────

export interface OpenInstallmentRow {
  installmentId: string;
  splitId: string;
  allocationId: string;
  allocationDescription: string;
  teamId: string;
  /** The team's name — or "A team outside your groups" (B11). */
  teamName: string;
  installmentNumber: number;
  installmentCount: number;
  amount: number;
  dueDate: string;
  state: 'overdue' | 'sent' | 'upcoming';
  sentOn: string | null;
  daysLate: number;
}

export interface OpenRequestRow {
  requestId: string;
  teamId: string;
  teamName: string;
  description: string;
  amount: number;
  requestType: 'payment_to_org' | 'charge_to_org';
  filedOn: string;
  holdingPayout: boolean;
}

export interface OpenLineRow {
  entryId: string;
  ledgerId: string;
  bookName: string;
  date: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
}

/** The four kinds of open money a year still holds (each a count, a total and the rows its door opens). */
export interface YearOpenMoney {
  installments: { count: number; amount: number; overdue: CountAndAmount; sent: CountAndAmount; upcoming: CountAndAmount; rows: OpenInstallmentRow[] };
  requests: { count: number; amount: number; holdingPayout: number; rows: OpenRequestRow[] };
  /** Lines in the year filed under no budget word (the Statement's "Not filed"); the door is the Ledger narrowed to them. */
  unfiled: { count: number; amount: number; moneyIn: number; moneyOut: number; ledger: { from: string; to: string; category: string; book?: string } };
  /** Lines still pending in the year (a cheque not cleared); the door is the Ledger narrowed to pending. */
  pending: { count: number; amount: number; rows: OpenLineRow[]; ledger: { from: string; to: string; status: 'pending'; book?: string } };
}

export interface CloseQuestion {
  year: { key: string; name: string; firstDay: string; lastDay: string; closed: boolean };
  /** Can it be closed now — and if not, why (the words are /marketing's: FISCAL_YEAR_REFUSAL). */
  canClose: boolean;
  refusal: { code: 'not_ended' | 'already_closed' | 'close_order'; year?: { key: string; name: string }; lastDay?: string } | null;
  open: YearOpenMoney;
  /** What the close locks: every club-owned book's lines dated in the year, and the year's plan. */
  locks: { books: number; lines: number; planLines: number };
  /** What carries: the closing balance (the next year opens on it, locked), and whether next year's plan is started. */
  carries: { closingBalance: number; nextYear: { key: string; name: string }; nextPlanLines: number };
  /** A re-close after a Reopen: what the last close locked, and the change since (from the reopen history). */
  sinceLastClose: { reopenedAt: string; reopenedByName: string | null; reason: string; wasClosingBalance: number; change: number } | null;
}

/** The installments still owed on the bills that count in these years, as rows (named inside the scope). */
function owedRows(
  loop: ClubLoop, allocations: readonly ClubAllocationFacts[], inYear: (a: ClubAllocationFacts) => boolean,
  today: string, scope: TeamScope,
): OpenInstallmentRow[] {
  const byId = new Map(allocations.map(a => [a.id, a] as const));
  const rows: OpenInstallmentRow[] = [];
  for (const s of loop.splits) {
    const a = byId.get(s.allocationId);
    if (!a || !inYear(a)) continue;
    const named = !scope || scope.has(s.teamId);
    for (const i of s.installments) {
      const state = clubInstallmentState(i, today);
      if (state === 'received') continue;
      rows.push({
        installmentId: i.id, splitId: s.id, allocationId: a.id, allocationDescription: a.description,
        teamId: s.teamId, teamName: named ? loop.teams.get(s.teamId)?.name ?? 'A team' : OUTSIDE_YOUR_GROUPS_WORD,
        installmentNumber: i.installmentNumber, installmentCount: s.installments.length,
        amount: i.amount, dueDate: i.dueDate, state, sentOn: i.sentOn ?? null, daysLate: clubInstallmentDaysLate(i, today),
      });
    }
  }
  return rows.sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.teamName.localeCompare(y.teamName, undefined, { numeric: true }));
}

function figuresOf(rows: readonly OpenInstallmentRow[]): YearOpenMoney['installments'] {
  const pick = (st: OpenInstallmentRow['state']) => {
    const list = rows.filter(r => r.state === st);
    return { count: list.length, amount: sumMoney(list) };
  };
  return { count: rows.length, amount: sumMoney(rows), overdue: pick('overdue'), sent: pick('sent'), upcoming: pick('upcoming'), rows: [...rows] };
}

/** A request belongs to the fiscal year it was FILED in, in the club's day (call 4). */
const requestYear = (createdOn: string, setting: FiscalSetting) => fiscalYearOf(createdOn, setting);

/** How many plan lines a fiscal year holds (a year with no row holds none). */
async function planLineCount(yearId: string | null): Promise<number> {
  if (!yearId) return 0;
  const r = await supabaseAdmin.from('org_budget_lines').select('id', { count: 'exact', head: true }).eq('fiscal_year_id', yearId);
  if (r.error) throw r.error;
  return r.count ?? 0;
}

/** The Ledger opens on ONE book: a door to a year's lines opens on the book holding most of them (the General
 *  ledger by default when there are none). Lines spread over several books leave the rest one Book pill away. */
function busiestBook(lines: readonly { ledgerId: string }[]): { book?: string } {
  const count = new Map<string, number>();
  for (const l of lines) count.set(l.ledgerId, (count.get(l.ledgerId) ?? 0) + 1);
  let best: string | undefined, most = 0;
  for (const [id, n] of count) if (n > most) { best = id; most = n; }
  return best ? { book: best } : {};
}

/**
 * THE CLOSE QUESTION: what closing `year` locks, what carries, and the four kinds of open money still in it —
 * each counted, totalled, and a door. Never blocks (Ask 2); `canClose`/`refusal` say only what the step itself
 * refuses (not ended, already closed, oldest first). `scope` names teams (B11) — the snapshot a close stores is
 * the club's own, unscoped (`closeSnapshot`).
 */
export async function closeQuestion(
  orgId: string,
  p: { year: FiscalYear; setting: FiscalSetting; today: string; scope: TeamScope },
): Promise<{ question: CloseQuestion; snapshot: CloseSnapshot }> {
  const { year, setting, today, scope } = p;
  const next = nextFiscalYear(year, setting);
  const loop = await loadClubLoop(orgId, null);
  const booksP = loadClubBooks(orgId, year, setting);
  const [allocations, requests, booksNow, bookLines, planLines, nextLines, reopenings, closing, heldDay] = await Promise.all([
    allocationsOf(orgId, loop, setting),
    loadRequests(orgId),
    booksP,
    booksP.then(b => loadBookLines(b.books, { first: year.firstDay, last: year.lastDay })),
    planLineCount(year.id),
    planLineCount(next.id),
    year.id
      ? supabaseAdmin.from('org_fiscal_year_reopenings').select('reopened_at, reopened_by, reason, was_closing_balance')
        .eq('fiscal_year_id', year.id).order('reopened_at', { ascending: false }).limit(1).then(r => r.data ?? [])
      : Promise.resolve([] as Record<string, any>[]),
    supabaseAdmin.rpc('club_closing_balance', { p_org: orgId, p_last: year.lastDay }).then(r => { if (r.error) throw r.error; return Number(r.data); }),
    supabaseAdmin.rpc('club_fiscal_first_held_day', { p_org: orgId }).then(r => { if (r.error) throw r.error; return (r.data as string | null) ?? null; }),
  ]);

  // 1. Installments still owed on the bills that count in the year.
  const owed = owedRows(loop, allocations, a => allocationInYear(a, year, setting), today, scope);
  // 2. Requests waiting on the club, filed in the year.
  const waiting = requests.filter(r => r.status === 'pending' && requestYear(r.createdOn, setting).key === year.key);
  const held = await seasonsHoldingPayout(waiting.map(r => r.programYearId));
  const requestRows: OpenRequestRow[] = waiting.map(r => ({
    requestId: r.id, teamId: r.teamId,
    teamName: !scope || scope.has(r.teamId) ? r.teamName : OUTSIDE_YOUR_GROUPS_WORD,
    description: !scope || scope.has(r.teamId) ? r.description : OUTSIDE_YOUR_GROUPS_WORD,
    amount: r.amount, requestType: r.requestType, filedOn: r.createdOn, holdingPayout: held.has(r.programYearId),
  }));
  // 3. Lines the Statement counts that are filed under no word. 4. Lines still pending.
  const index = loopIndex(allocations, requests);
  const unfiled = bookLines.filter(l => countsAsActual(l) && fileClubLine(l, index).filing.categoryId === NOT_FILED_ID);
  const pending = bookLines.filter(l => l.status === 'pending' && (clubMovement(l) === 'in' || clubMovement(l) === 'out'));

  const open: YearOpenMoney = {
    installments: figuresOf(owed),
    requests: { count: requestRows.length, amount: sumMoney(requestRows), holdingPayout: requestRows.filter(r => r.holdingPayout).length, rows: requestRows },
    unfiled: {
      count: unfiled.length, amount: sumMoney(unfiled),
      moneyIn: sumMoney(unfiled.filter(l => clubMovement(l) === 'in')), moneyOut: sumMoney(unfiled.filter(l => clubMovement(l) === 'out')),
      // The Ledger narrows by the Category's WORD (its filter's own value), never the filing's id.
      ledger: { from: year.firstDay, to: year.lastDay, category: NOT_FILED_WORD, ...busiestBook(unfiled) },
    },
    pending: {
      count: pending.length, amount: sumMoney(pending),
      rows: pending.map(l => ({ entryId: l.id, ledgerId: l.ledgerId, bookName: l.bookName, date: l.entryDate, description: l.description, amount: l.amount, direction: clubMovement(l) as 'in' | 'out' })),
      ledger: { from: year.firstDay, to: year.lastDay, status: 'pending', ...busiestBook(pending) },
    },
  };

  // What the step itself would refuse (it warns about the rest, never blocks).
  const through = closedThrough(setting);
  let refusal: CloseQuestion['refusal'] = null;
  if (year.locked) refusal = { code: 'already_closed' };
  else if (today <= year.lastDay) refusal = { code: 'not_ended', lastDay: year.lastDay };
  else {
    const first = through ? fiscalYearOf(addCalendarDays(through, 1), setting) : heldDay ? fiscalYearOf(heldDay, setting) : null;
    if (first && first.key < year.key) refusal = { code: 'close_order', year: { key: first.key, name: first.name } };
  }

  const last = reopenings[0];
  const nameOf = last?.reopened_by ? await resolvePersonNamer(orgId, [last.reopened_by]) : null;
  const question: CloseQuestion = {
    year: { key: year.key, name: year.name, firstDay: year.firstDay, lastDay: year.lastDay, closed: !!year.closed },
    canClose: refusal === null,
    refusal,
    open,
    locks: { books: booksNow.books.length, lines: bookLines.length, planLines },
    carries: { closingBalance: closing, nextYear: { key: next.key, name: next.name }, nextPlanLines: nextLines },
    sinceLastClose: last ? {
      reopenedAt: last.reopened_at, reopenedByName: nameOf?.(last.reopened_by) ?? null, reason: last.reason,
      wasClosingBalance: Number(last.was_closing_balance), change: sumMoney([{ amount: closing }, { amount: -Number(last.was_closing_balance) }]),
    } : null,
  };
  return { question, snapshot: closeSnapshot(loop, allocations, year, setting, today, open, waiting.map(r => r.teamName), pending) };
}

/** What a close STORES (org_fiscal_years.closing_snapshot): the open money as it stood, and each team's standing
 *  with the club on the year's bills — the club's whole record, never scoped to a reader's groups. */
function closeSnapshot(
  loop: ClubLoop, allocations: readonly ClubAllocationFacts[], year: FiscalYear, setting: FiscalSetting, today: string,
  open: YearOpenMoney, requestTeams: string[], pending: readonly { description: string }[],
): CloseSnapshot {
  const byId = new Map(allocations.map(a => [a.id, a] as const));
  const perTeam = new Map<string, Array<(typeof loop.splits)[number]>>();
  for (const s of loop.splits) {
    const a = byId.get(s.allocationId);
    if (!a || !allocationInYear(a, year, setting)) continue;
    const list = perTeam.get(s.teamId);
    if (list) list.push(s); else perTeam.set(s.teamId, [s]);
  }
  const teams = [...perTeam.entries()].map(([teamId, splits]) => {
    const f = clubBillFigures(splits.flatMap(s => s.installments), today);
    return { teamId, teamName: loop.teams.get(teamId)?.name ?? 'A team', billed: f.billed, collected: f.collected, owed: f.outstanding };
  }).sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));
  const owingTeams = new Set(open.installments.rows.map(r => loop.teams.get(r.teamId)?.name ?? 'A team'));
  return {
    installments: {
      count: open.installments.count, amount: open.installments.amount,
      overdue: open.installments.overdue.amount, sent: open.installments.sent.amount, upcoming: open.installments.upcoming.amount,
    },
    requests: { count: open.requests.count, amount: open.requests.amount },
    unfiled: { count: open.unfiled.count, amount: open.unfiled.amount },
    pending: { count: open.pending.count, amount: open.pending.amount },
    teams,
    totals: {
      billed: sumMoney(teams.map(t => ({ amount: t.billed }))),
      collected: sumMoney(teams.map(t => ({ amount: t.collected }))),
      owed: sumMoney(teams.map(t => ({ amount: t.owed }))),
    },
    installmentTeams: [...owingTeams],
    requestTeams: [...new Set(requestTeams)],
    pendingPayees: pending.map(p => p.description),
  };
}

// ── The Overview's year reads (Asks 1, 2, 4) ─────────────────────────────────────────────────

export interface StillOpenRow {
  kind: 'installment' | 'request';
  /** The closed year it belongs to. */
  year: { key: string; name: string };
  teamId: string;
  teamName: string;
  /** The bill's name and its installment ("Diamond fees 2025–26 · installment 3 of 3"), or the request's words. */
  what: string;
  /** Installments: overdue / sent / upcoming (with `dueDate`, `sentOn`, `daysLate`); requests: waiting. */
  state: 'overdue' | 'sent' | 'upcoming' | 'waiting';
  dueDate: string | null;
  sentOn: string | null;
  daysLate: number;
  amount: number;
  holdingPayout: boolean;
  /** Where its row opens: the team's bill, or the request. */
  door: { allocationId: string; splitId: string } | { requestId: string };
}

export interface OverviewYearReads {
  /** The oldest fiscal year that has ENDED and isn't closed (the close's door) — for someone who can move the
   *  club's money; null otherwise, or when there is none. */
  endedOpen: { key: string; name: string; lastDay: string } | null;
  /** "From 2025–26, still open" (Ask 4): the closed years' installments still owed and requests still waiting,
   *  until each is settled. */
  stillOpen: { years: { key: string; name: string }[]; rows: StillOpenRow[]; count: number; amount: number };
  /** On a CLOSED year: the year-end report (read only from locked figures). Null on an open year. */
  yearEnd: YearEndReport | null;
}

export async function overviewYearReads(
  orgId: string,
  p: { year: FiscalYear; setting: FiscalSetting; today: string; canMove: boolean; scope: PromiseLike<TeamScope> | TeamScope },
): Promise<OverviewYearReads> {
  const { year, setting, today, canMove } = p;
  const scope = await p.scope;
  const through = closedThrough(setting);

  const endedOpenP = (async () => {
    if (!canMove) return null;
    let first: FiscalYear | null = null;
    if (through) first = fiscalYearOf(addCalendarDays(through, 1), setting);
    else {
      const { data, error } = await supabaseAdmin.rpc('club_fiscal_first_held_day', { p_org: orgId });
      if (error) throw error;
      first = data ? fiscalYearOf(data as string, setting) : null;
    }
    return first && first.lastDay < today ? { key: first.key, name: first.name, lastDay: first.lastDay } : null;
  })();

  const stillOpenP = (async (): Promise<OverviewYearReads['stillOpen']> => {
    if (!through) return { years: [], rows: [], count: 0, amount: 0 };
    const loop = await loadClubLoop(orgId, scope ? new Set(scope) : null);
    const [allocations, requests] = await Promise.all([allocationsOf(orgId, loop, setting), loadRequests(orgId)]);
    const lockedYear = (key: string) => fiscalYearOf(key, setting);
    const owed = owedRows(loop, allocations, a => lockedYear(allocationYearKey(a, setting)).locked, today, null);
    const byId = new Map(allocations.map(a => [a.id, a] as const));
    const waiting = requests.filter(r => r.status === 'pending' && (!scope || scope.has(r.teamId)) && r.createdOn <= through);
    const held = await seasonsHoldingPayout(waiting.map(r => r.programYearId));
    const rows: StillOpenRow[] = [
      ...owed.map((o): StillOpenRow => {
        const y = lockedYear(allocationYearKey(byId.get(o.allocationId)!, setting));
        return {
          kind: 'installment', year: { key: y.key, name: y.name }, teamId: o.teamId, teamName: o.teamName,
          what: `${o.allocationDescription} · installment ${o.installmentNumber} of ${o.installmentCount}`,
          state: o.state, dueDate: o.dueDate, sentOn: o.sentOn, daysLate: o.daysLate, amount: o.amount, holdingPayout: false,
          door: { allocationId: o.allocationId, splitId: o.splitId },
        };
      }),
      ...waiting.map((r): StillOpenRow => {
        const y = requestYear(r.createdOn, setting);
        return {
          kind: 'request', year: { key: y.key, name: y.name }, teamId: r.teamId, teamName: r.teamName,
          what: r.description, state: 'waiting', dueDate: null, sentOn: null,
          daysLate: daysBetweenDateStrings(r.createdOn, today), amount: r.amount, holdingPayout: held.has(r.programYearId),
          door: { requestId: r.id },
        };
      }),
    ];
    const years = new Map(rows.map(r => [r.year.key, r.year.name] as const));
    return {
      years: [...years.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, name]) => ({ key, name })),
      rows, count: rows.length, amount: sumMoney(rows),
    };
  })();

  const yearEndP = year.closed ? readYearEnd(orgId, { year, setting, today, scope }) : Promise.resolve(null);
  const [endedOpen, stillOpen, yearEnd] = await Promise.all([endedOpenP, stillOpenP, yearEndP]);
  return { endedOpen, stillOpen, yearEnd };
}

/** THE YEAR-END REPORT for a closed year (specimen 5): read only from locked figures. */
async function readYearEnd(
  orgId: string, p: { year: FiscalYear; setting: FiscalSetting; today: string; scope: TeamScope },
): Promise<YearEndReport> {
  const { year, setting, today } = p;
  if (!year.closed || !year.id) throw new Error('readYearEnd: the year is not closed');
  const [{ report, rows }, snapshotRow, names, clubTeams] = await Promise.all([
    readClubYear(orgId, year, setting, today, p.scope),
    supabaseAdmin.from('org_fiscal_years').select('closing_snapshot').eq('id', year.id).single(),
    closerNames(orgId, setting),
    // The club's teams by name — only to tell which names a group-scoped reader may see (B11).
    p.scope ? supabaseAdmin.from('rep_teams').select('id, name').eq('org_id', orgId).then(r => { if (r.error) throw r.error; return r.data ?? []; })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  if (snapshotRow.error) throw snapshotRow.error;
  const teamIdsByName = new Map<string, string[]>();
  for (const t of clubTeams) teamIdsByName.set(t.name, [...(teamIdsByName.get(t.name) ?? []), t.id]);
  const ids = rows.books.map(b => b.id);
  const [atStart, atEnd, compare] = await Promise.all([
    getBookTotals(ids, null, addCalendarDays(year.firstDay, -1)),
    getBookTotals(ids, null, year.lastDay),
    againstLastYear({ year, setting, today, report, rows }),
  ]);
  const held = (t: { postedIn: number; postedOut: number } | undefined) => sumMoney([{ amount: t?.postedIn ?? 0 }, { amount: -(t?.postedOut ?? 0) }]);
  return buildYearEndReport({
    year,
    closedByName: year.closed.by ? names[year.closed.by] ?? null : null,
    opening: rows.openingBalance,
    report,
    againstLastYear: compare,
    books: rows.books.map(b => ({ id: b.id, name: b.name, kind: b.kind, atStart: held(atStart.get(b.id)), atEnd: held(atEnd.get(b.id)) })),
    // The close stored the club's whole record; a group-scoped reader sees it as B11 allows.
    snapshot: scopeCloseSnapshot(normalizeSnapshot(snapshotRow.data?.closing_snapshot), p.scope, teamIdsByName),
    nextYear: nextFiscalYear(year, setting),
  });
}

/** A stored snapshot, read defensively (a close made by an earlier build may lack a part). */
function normalizeSnapshot(raw: unknown): CloseSnapshot {
  const s = (raw ?? {}) as Partial<CloseSnapshot>;
  const ca = (x: { count?: number; amount?: number } | undefined) => ({ count: Number(x?.count ?? 0), amount: Number(x?.amount ?? 0) });
  return {
    installments: {
      ...ca(s.installments), overdue: Number(s.installments?.overdue ?? 0), sent: Number(s.installments?.sent ?? 0),
      upcoming: Number(s.installments?.upcoming ?? 0),
    },
    requests: ca(s.requests), unfiled: ca(s.unfiled), pending: ca(s.pending),
    teams: Array.isArray(s.teams) ? s.teams : [],
    totals: { billed: Number(s.totals?.billed ?? 0), collected: Number(s.totals?.collected ?? 0), owed: Number(s.totals?.owed ?? 0) },
    installmentTeams: s.installmentTeams ?? [], requestTeams: s.requestTeams ?? [], pendingPayees: s.pendingPayees ?? [],
  };
}

