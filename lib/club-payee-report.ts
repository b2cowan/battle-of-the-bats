import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { getRepTeams } from './db';
import { clubYearSpan, sumMoney } from './club-money-figures';
import { calendarYearsTouched, fiscalYearOf, type FiscalSetting, type FiscalYear } from './club-fiscal-year';
import { isUuid } from './utils';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE TEAMS RECORDED PAYING A SHARED PAYEE (Club Tier Stage 3b, S3B-06; the plan's "3b shared-payee
 * report, defined" — Ledger Parity session 1, 2026-10-02 — and Ask 3, ruled 2026-10-06).
 *
 * For ONE shared club payee P (`org_payees.team_id IS NULL AND shared_with_teams`, stamp S = `shared_at`):
 *   · ROWS: every `rep_payable_payments` row whose commitment (`rep_team_expenses`) names P, in this club,
 *     where BOTH stamps are on or after S — the payment's `created_at` (recorded after the notice; a coach
 *     can backdate `paid_date`, never when it was entered) AND the commitment's `created_at` (the payee was
 *     CHOSEN after the notice: a bill picked under the old silent heading and paid later stays out). An
 *     out-of-pocket payment (a family paid) is still a payment to P and counts.
 *   · THE YEAR (Ask 3): rows whose PAYMENT DATE falls in the club's FISCAL year (Stage 3c); any year can be
 *     asked. The share stamps apply whatever the year. `years` lists every fiscal year that holds a row for
 *     this payee (the window shows a Year control only when there is more than one — Ask 7).
 *   · THE TEAMS (Ask 3, S3C-03): the club's teams active in the fiscal year — a team with a season numbered for
 *     EITHER calendar year the fiscal year touches (a season stores no dates, S3C-04, so its number is all
 *     there is), or with a row in it. A team archived with neither is not listed as "Nothing recorded".
 *   · Labelled as what each team RECORDED, never proof of payment (BUSINESS_DECISIONS 2026-10-02 §2).
 *   · NEVER: a team's own payees, an unshared payee, a payment recorded before S, or any team figure on the
 *     club's Payees list (its Entries / Last used are the club's own lines only — mig 316). Nothing on the
 *     Payees list changes.
 * Group scope (B11): a member limited to some team groups sees those teams only.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PayeeReportPayment { id: string; paidDate: string; amount: number; outOfPocket: boolean }
export interface PayeeReportTeam {
  teamId: string;
  teamName: string;
  count: number;
  total: number;
  firstDay: string;
  lastDay: string;
  payments: PayeeReportPayment[];
}
export interface PayeeReport {
  payee: { id: string; name: string; sharedAt: string };
  /** The fiscal year read. */
  year: { key: string; name: string; firstDay: string; lastDay: string };
  /** Every fiscal year holding a row for this payee, newest first (a Year control only when there are two). */
  years: { key: string; name: string }[];
  teams: PayeeReportTeam[];
  /** "Nothing recorded (n)": the active teams in the year with no row. */
  nothingRecorded: { teamId: string; teamName: string }[];
  count: number;
  total: number;
}

export async function sharedPayeeReport(
  orgId: string,
  payeeId: string,
  year: FiscalYear,
  setting: FiscalSetting,
  scope: PromiseLike<Set<string> | null> | Set<string> | null,
): Promise<PayeeReport | null> {
  if (!isUuid(payeeId)) return null;
  const { first, last } = clubYearSpan(year);
  // S3C-03: a season numbered for either calendar year the fiscal year touches.
  const seasonNumbers = calendarYearsTouched(year);
  // The teams don't depend on the payee: they load beside it.
  const listsP = Promise.all([
    getRepTeams(orgId),
    fetchAll<{ team_id: string }>((a, b) => supabaseAdmin.from('rep_program_years').select('team_id')
      .eq('org_id', orgId).in('year', seasonNumbers).order('id').range(a, b)),
    scope,
  ]);
  listsP.catch(() => undefined);   // awaited below; never an unhandled rejection if the payee read throws first
  const { data: payee, error } = await supabaseAdmin.from('org_payees')
    .select('id, name, team_id, shared_with_teams, shared_at')
    .eq('id', payeeId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  // Only a club payee that is shared has a report (an unshared one never surfaces a team's payment).
  if (!payee || payee.team_id !== null || !payee.shared_with_teams || !payee.shared_at) return null;
  const since = payee.shared_at as string;

  // Both stamps on or after the share, in one read: the payment's own, and its commitment's (joined). Every
  // year's payment DAYS beside it, for the years that hold records.
  const [payments, everyDay, [teams, seasons, inScopeIds]] = await Promise.all([
    fetchAll<Record<string, any>>((a, b) => supabaseAdmin
      .from('rep_payable_payments')
      .select('id, team_id, amount, paid_date, paid_by_player_id, rep_team_expenses!inner ( payee_id, created_at )')
      .eq('org_id', orgId).eq('rep_team_expenses.payee_id', payeeId).gte('rep_team_expenses.created_at', since)
      .gte('created_at', since).gte('paid_date', first).lte('paid_date', last)
      .order('paid_date').order('id').range(a, b)),
    fetchAll<{ paid_date: string; team_id: string }>((a, b) => supabaseAdmin
      .from('rep_payable_payments')
      .select('paid_date, team_id, rep_team_expenses!inner ( payee_id, created_at )')
      .eq('org_id', orgId).eq('rep_team_expenses.payee_id', payeeId).gte('rep_team_expenses.created_at', since)
      .gte('created_at', since).order('paid_date').order('id').range(a, b)),
    listsP,
  ]);
  const inScope = (teamId: string) => !inScopeIds || inScopeIds.has(teamId);
  const withSeason = new Set(seasons.map(s => s.team_id));
  const byTeam = new Map<string, PayeeReportPayment[]>();
  for (const p of payments) {
    if (!inScope(p.team_id)) continue;
    const list = byTeam.get(p.team_id) ?? [];
    list.push({ id: p.id, paidDate: p.paid_date, amount: Number(p.amount), outOfPocket: !!p.paid_by_player_id });
    byTeam.set(p.team_id, list);
  }

  const name = new Map(teams.map(t => [t.id, t.name] as const));
  const rows: PayeeReportTeam[] = [...byTeam.entries()].map(([teamId, list]) => ({
    teamId,
    teamName: name.get(teamId) ?? 'A team',
    count: list.length,
    total: sumMoney(list),
    firstDay: list[0].paidDate,
    lastDay: list[list.length - 1].paidDate,
    payments: list,
  })).sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));

  const nothingRecorded = teams
    .filter(t => inScope(t.id) && !byTeam.has(t.id) && withSeason.has(t.id))
    .map(t => ({ teamId: t.id, teamName: t.name }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));

  const yearsHeld = new Map<string, string>();
  for (const d of everyDay) {
    if (!inScope(d.team_id) || !d.paid_date) continue;
    const y = fiscalYearOf(d.paid_date, setting);
    yearsHeld.set(y.key, y.name);
  }
  return {
    payee: { id: payee.id, name: payee.name, sharedAt: since },
    year: { key: year.key, name: year.name, firstDay: year.firstDay, lastDay: year.lastDay },
    years: [...yearsHeld.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, name]) => ({ key, name })),
    teams: rows,
    nothingRecorded,
    count: rows.reduce((n, r) => n + r.count, 0),
    total: sumMoney(rows.map(r => ({ amount: r.total }))),
  };
}
