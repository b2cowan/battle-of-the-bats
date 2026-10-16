/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A TEAM OWES THE CLUB, ROW BY ROW — AND WHAT ON A TEAM'S ACCOUNT NEEDS YOU (Club Tier Stage 3c's open
 * money; Club Accounting · Teams, Ask 5, ruled 2026-10-16).
 *
 * `owedRows` is the ONE reading of "still owed" as rows: every installment on a bill that is neither received nor
 * covered whole by a credit, named inside the reader's groups (B11). The close question reads it for a year's bills,
 * the Overview's "From 2025–26, still open" for the closed years', and a team's account for every year of its own —
 * three callers, one reading (it moved here from lib/club-fiscal-reads.ts so the unit suite can run it: a server-only
 * module cannot be loaded there).
 *
 * `teamNeedsYou` is a team's account's "Needs you": its late installments (oldest first), the payments its coaches say
 * they have sent for the club to confirm, and the requests waiting on the club — one row each, every year, each with
 * the door it opens (the team's bill, or the request). A row from a CLOSED fiscal year carries that year, so the screen
 * can say "from 2025–26". Nothing upcoming is here: Next due already says it.
 *
 * ⚠ PURE: no database, no React. Every figure is lib/club-money-figures.ts's.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { ClubLoop } from './club-money-reads';
import type { TeamScope } from './club-budget-report';
import {
  clubInstallmentDaysLate, clubInstallmentDue, clubInstallmentState, requestWaitsOnClub, sumMoney, type ClubInstallmentFacts,
} from './club-money-figures';
import { OUTSIDE_YOUR_GROUPS_WORD } from './club-money-words';

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

/** The installments still owed on the bills `inYear` keeps, as rows (named inside the scope). */
export function owedRows<A extends { id: string; description: string }>(
  loop: Pick<ClubLoop, 'splits' | 'teams'>, allocations: readonly A[], inYear: (a: A) => boolean,
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
      // Received, or covered whole by a credit (Stage 11d): nothing is owed on it.
      if (state === 'received' || state === 'credited') continue;
      rows.push({
        installmentId: i.id, splitId: s.id, allocationId: a.id, allocationDescription: a.description,
        teamId: s.teamId, teamName: named ? loop.teams.get(s.teamId)?.name ?? 'A team' : OUTSIDE_YOUR_GROUPS_WORD,
        installmentNumber: i.installmentNumber, installmentCount: s.installments.length,
        amount: clubInstallmentDue(i), dueDate: i.dueDate, state, sentOn: i.sentOn ?? null, daysLate: clubInstallmentDaysLate(i, today),
      });
    }
  }
  return rows.sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.teamName.localeCompare(y.teamName, undefined, { numeric: true }));
}

/**
 * THE TEAMS UNDER THEIR GROUP, IN ONE ORDER — the Teams table's bands and the Team pill's headings (Club Accounting ·
 * Teams, Asks 1 and 2): groups by name with "No group" (null) last, the teams by name within, numbers in order ("9U"
 * before "11U"). One function, so the pill can never list the teams in an order the table doesn't.
 */
export function teamsByGroup<T extends { groupName: string | null; teamName: string }>(teams: readonly T[]): { group: string | null; teams: T[] }[] {
  const out: { group: string | null; teams: T[] }[] = [];
  const sorted = [...teams].sort((a, b) => (a.groupName == null ? 1 : 0) - (b.groupName == null ? 1 : 0)
    || (a.groupName ?? '').localeCompare(b.groupName ?? '')
    || a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));
  for (const t of sorted) {
    const last = out[out.length - 1];
    if (last && last.group === t.groupName) last.teams.push(t);
    else out.push({ group: t.groupName, teams: [t] });
  }
  return out;
}

/** A fiscal year, by its key and its name ("2025–26"). */
export interface YearName { key: string; name: string }

/** A late or sent installment on the team's bill: it opens the bill over the account. */
export interface NeedsYouBillRow {
  kind: 'late' | 'sent';
  key: string;
  allocationDescription: string;
  installmentNumber: number;
  installmentCount: number;
  dueDate: string;
  sentOn: string | null;
  /** The server's count, as the bill's own row reads it (`clubInstallmentDaysLate`). */
  daysLate: number;
  amount: number;
  /** The CLOSED fiscal year the bill counts in, or null for an open year's. */
  closedYear: YearName | null;
  /** The team's bill, in its allocation's window over the account (the statement's Billed rows' own door). */
  door: { bill: { allocationId: string; splitId: string } };
}

/** A request waiting on the club: it opens the request over the account. */
export interface NeedsYouRequestRow {
  kind: 'request';
  key: string;
  description: string;
  amount: number;
  filedOn: string;
  askedBy: string | null;
  /** The club's answer is the one thing between the team and its end-of-season payout (the coach's own rule). */
  holdingPayout: boolean;
  /** The CLOSED fiscal year it was filed in, or null. */
  closedYear: YearName | null;
  /** The request, over the account (`RequestFlow`). */
  door: { request: string };
}

export type NeedsYouRow = NeedsYouBillRow | NeedsYouRequestRow;

export interface TeamNeedsYou { count: number; amount: number; rows: NeedsYouRow[] }

/** What the builder reads of a request — every one of the team's; the waiting ones are kept here. */
export interface NeedsYouRequestFacts {
  id: string;
  status: string;
  description: string;
  amount: number;
  filedOn: string;
  askedBy: string | null;
  holdingPayout: boolean;
  closedYear: YearName | null;
}

/**
 * A team's "Needs you" (Ask 5): late (oldest first), then sent (oldest sent first), then requests (oldest filed first).
 * `owed` is `owedRows` over every year of the team's bills; `closedYearOf` names the closed fiscal year a bill counts in.
 */
export function teamNeedsYou(p: {
  owed: readonly OpenInstallmentRow[];
  closedYearOf: (allocationId: string) => YearName | null;
  requests: readonly NeedsYouRequestFacts[];
}): TeamNeedsYou {
  const bill = (o: OpenInstallmentRow, kind: 'late' | 'sent'): NeedsYouBillRow => ({
    kind, key: o.installmentId, allocationDescription: o.allocationDescription,
    installmentNumber: o.installmentNumber, installmentCount: o.installmentCount,
    dueDate: o.dueDate, sentOn: o.sentOn, daysLate: o.daysLate, amount: o.amount,
    closedYear: p.closedYearOf(o.allocationId),
    door: { bill: { allocationId: o.allocationId, splitId: o.splitId } },
  });
  const late = p.owed.filter(o => o.state === 'overdue')
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.allocationDescription.localeCompare(y.allocationDescription))
    .map(o => bill(o, 'late'));
  const sent = p.owed.filter(o => o.state === 'sent')
    .sort((x, y) => (x.sentOn ?? x.dueDate).localeCompare(y.sentOn ?? y.dueDate) || x.dueDate.localeCompare(y.dueDate))
    .map(o => bill(o, 'sent'));
  const requests = p.requests.filter(r => requestWaitsOnClub(r.status))
    .sort((x, y) => x.filedOn.localeCompare(y.filedOn))
    .map((r): NeedsYouRequestRow => ({
      kind: 'request', key: r.id, description: r.description, amount: r.amount, filedOn: r.filedOn,
      askedBy: r.askedBy, holdingPayout: r.holdingPayout, closedYear: r.closedYear, door: { request: r.id },
    }));
  const rows: NeedsYouRow[] = [...late, ...sent, ...requests];
  return { count: rows.length, amount: sumMoney(rows), rows };
}

/** One earlier year's line under a team's Outstanding on the Teams table (Ask 8, correction C2). */
export interface EarlierYearLine { yearKey: string; yearName: string; amount: number; late: boolean }

/**
 * WHAT AN EARLIER YEAR STILL OWES, PER TEAM (Ask 8 + C2; widened by the owner 2026-10-16 from closed years to ANY earlier
 * year, closed or not — "Yes, any earlier year": between a year's end and its close, the Overview's teams card counts a
 * team late on that year's money, and its row must say so in red too). Over the bills of every year before the one on
 * screen — the year rule's year for each bill — one line per team per earlier year: what is still owed on it (neither
 * received nor covered whole by a credit), `late` when ANY of it is overdue (the line is then red, and says so). Requests
 * are not in it: the line explains the gap between the row's Outstanding and the team's every-year Outstanding, which
 * counts installments only. No figure's definition changes; the row keeps the year's figure.
 */
export function earlierYearLines(
  bills: readonly { year: YearName; teamId: string; installments: readonly ClubInstallmentFacts[] }[],
  onScreenYearKey: string,
  today: string,
): Map<string, EarlierYearLine[]> {
  const byTeam = new Map<string, Map<string, { name: string; amounts: { amount: number }[]; late: boolean }>>();
  for (const b of bills) {
    if (b.year.key >= onScreenYearKey) continue;
    for (const i of b.installments) {
      const state = clubInstallmentState(i, today);
      if (state === 'received' || state === 'credited') continue;
      const years = byTeam.get(b.teamId) ?? new Map();
      const y = years.get(b.year.key) ?? { name: b.year.name, amounts: [], late: false };
      y.amounts.push({ amount: clubInstallmentDue(i) });
      if (state === 'overdue') y.late = true;
      years.set(b.year.key, y);
      byTeam.set(b.teamId, years);
    }
  }
  const out = new Map<string, EarlierYearLine[]>();
  for (const [teamId, years] of byTeam) {
    out.set(teamId, [...years.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([yearKey, y]) => ({ yearKey, yearName: y.name, amount: sumMoney(y.amounts), late: y.late })));
  }
  return out;
}
