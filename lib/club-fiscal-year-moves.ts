import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { refused, type Moved } from './club-money-route';
import { FISCAL_YEAR_REFUSAL } from './club-money-words';
import {
  closedThrough, fiscalYearAt, fiscalYearOf, nextFiscalYear,
  type FiscalSetting, type FiscalYear, type FiscalYearOption,
} from './club-fiscal-year';
import { closerNames, loadFiscalSetting } from './club-fiscal-year-server';
import { closeQuestion } from './club-fiscal-reads';
import { clubPlanYears } from './club-budget-read';
import type { TeamScope } from './club-budget-report';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FISCAL YEAR'S STEPS (Club Tier Stage 3c; Asks 2, 3, 5). Each is ONE database step (mig 318) that decides
 * and re-checks under the club's locks; this module reads the input, asks the step, and turns its answer into one
 * coded refusal in words (`FISCAL_YEAR_REFUSAL`, /marketing's drafts).
 *
 *   · the first month — `club_fiscal_first_month_set` (and its PREVIEW: the same work, rolled back, so the counts
 *     the window shows before the save are the counts the save makes);
 *   · a year's name — `club_fiscal_year_rename` (an open year only);
 *   · Close — `club_fiscal_year_close`, given the close question's figures read just before it (what was still
 *     open, each team's standing) to keep as the year's snapshot;
 *   · Reopen — `club_fiscal_year_reopen`: the latest closed year only, with a reason that is kept.
 *
 * WHO: every route calling here answers to 3a's one money rule (`canMoveClubMoney`); anyone who opens Accounting
 * reads the year (`fiscalYearWindow`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type StepAnswer = { ok: boolean; code?: string } & Record<string, any>;

async function step(fn: string, args: Record<string, unknown>): Promise<StepAnswer> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) throw error;
  return data as StepAnswer;
}

/** A year's KEY off a request (its first day), resolved to a year that starts that day — or a 404. */
export function readYearKey(raw: unknown, setting: FiscalSetting): Moved<{ year: FiscalYear }> {
  const key = typeof raw === 'string' ? raw.trim() : '';
  const year = /^\d{4}-\d{2}-\d{2}$/.test(key) ? fiscalYearAt(key, setting) : null;
  return year ? { ok: true, year } : refused(404, { error: FISCAL_YEAR_REFUSAL.not_found, code: 'not_found' });
}

// ── The window (Budget › Tools › Fiscal year) ─────────────────────────────────────────────────

export interface FiscalYearWindow {
  /** The club's first month, 1–12. */
  firstMonth: number;
  /** The first month can change until the first close (Ask 5). */
  firstMonthCanChange: boolean;
  /** Whether this reader may change the first month or a name (`canMoveClubMoney`). */
  canEdit: boolean;
  current: FiscalYearWindowYear;
  next: FiscalYearWindowYear;
  /** Every closed year, newest first. */
  closed: FiscalYearWindowYear[];
  /** The Year pill's list (the same as every money tab's). */
  years: FiscalYearOption[];
}

export interface FiscalYearWindowYear {
  key: string; name: string; firstDay: string; lastDay: string; months: number; short: boolean;
  closed: { at: string; byName: string | null; closingBalance: number } | null;
  /** An open year's name can change. */
  canRename: boolean;
}

export async function fiscalYearWindow(orgId: string, today: string, canMove: boolean): Promise<FiscalYearWindow> {
  const setting = await loadFiscalSetting(orgId);
  const [names, years] = await Promise.all([closerNames(orgId, setting), clubPlanYears(orgId, setting, today)]);
  const shape = (y: FiscalYear): FiscalYearWindowYear => ({
    key: y.key, name: y.name, firstDay: y.firstDay, lastDay: y.lastDay, months: y.months, short: y.short,
    closed: y.closed ? { at: y.closed.at, byName: y.closed.by ? names[y.closed.by] ?? null : null, closingBalance: y.closed.closingBalance } : null,
    canRename: canMove && !y.locked,
  });
  const current = fiscalYearOf(today, setting);
  return {
    firstMonth: setting.firstMonth,
    firstMonthCanChange: closedThrough(setting) === null,
    canEdit: canMove,
    current: shape(current),
    next: shape(nextFiscalYear(current, setting)),
    closed: setting.rows.filter(r => r.closedAt).sort((a, b) => b.firstDay.localeCompare(a.firstDay)).map(r => shape(fiscalYearOf(r.firstDay, setting))),
    years,
  };
}

// ── The first month (Ask 5) ───────────────────────────────────────────────────────────────────

/** What a first-month change does (the window shows it BEFORE the save; the save answers the same counts). */
export interface FirstMonthChange {
  /** unchanged · fresh (a club holding nothing just starts on it) · short_next (the next year is the short one) ·
   *  whole_next (the next year already starts on that month). */
  mode: 'unchanged' | 'fresh' | 'short_next' | 'whole_next';
  preview: boolean;
  current: { name: string; firstDay: string; lastDay: string } | null;
  next: { name: string; firstDay: string; lastDay: string } | null;
  /** The first day of the first twelve-month year on the new month. */
  thenFrom: string | null;
  /** Plan lines that moved whole to a later year · lines split by their dates · lines that joined one of the same word. */
  moved: number;
  split: number;
  joined: number;
  /** The dates of the plan money that moved (first and last), for "4 lines dated September to December 2027". */
  movedFrom: string | null;
  movedTo: string | null;
}

export async function setFirstMonth(orgId: string, month: unknown, today: string, preview: boolean): Promise<Moved<{ change: FirstMonthChange }>> {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) return refused(400, { error: FISCAL_YEAR_REFUSAL.bad_month, code: 'bad_month' });
  const r = await step('club_fiscal_first_month_set', { p_org: orgId, p_month: m, p_today: today, p_preview: preview });
  if (!r.ok) {
    if (r.code === 'first_close_done') return refused(409, { error: FISCAL_YEAR_REFUSAL.first_close_done, code: r.code });
    if (r.code === 'split_below_allocated') {
      return refused(409, {
        error: FISCAL_YEAR_REFUSAL.split_below_allocated(r.line, Number(r.allocated), Number(r.staying)),
        code: r.code, line: r.line, allocated: Number(r.allocated), staying: Number(r.staying),
      });
    }
    if (r.code === 'bad_month') return refused(400, { error: FISCAL_YEAR_REFUSAL.bad_month, code: r.code });
    throw new Error(`club_fiscal_first_month_set: unexpected answer ${JSON.stringify(r)}`);
  }
  const span = (x: Record<string, string> | undefined) => (x ? { name: x.name, firstDay: x.firstDay, lastDay: x.lastDay } : null);
  return {
    ok: true,
    change: {
      mode: r.mode, preview, current: span(r.current), next: span(r.next), thenFrom: r.thenFrom ?? null,
      moved: Number(r.moved ?? 0), split: Number(r.split ?? 0), joined: Number(r.joined ?? 0),
      movedFrom: r.movedFrom ?? null, movedTo: r.movedTo ?? null,
    },
  };
}

// ── A year's name ─────────────────────────────────────────────────────────────────────────────

export async function renameFiscalYear(orgId: string, key: unknown, name: unknown): Promise<Moved<{ year: { key: string; name: string } }>> {
  const setting = await loadFiscalSetting(orgId);
  const found = readYearKey(key, setting); if (!found.ok) return found;
  const want = typeof name === 'string' ? name.trim() : '';
  const r = await step('club_fiscal_year_rename', { p_org: orgId, p_first: found.year.key, p_name: want });
  if (r.ok) return { ok: true, year: { key: found.year.key, name: r.name } };
  switch (r.code) {
    case 'bad_name': return refused(400, { error: FISCAL_YEAR_REFUSAL.bad_name, code: r.code });
    case 'name_taken': return refused(409, { error: FISCAL_YEAR_REFUSAL.name_taken(want), code: r.code });
    case 'year_closed': return refused(409, { error: FISCAL_YEAR_REFUSAL.year_closed(found.year.name), code: r.code });
    default: return refused(404, { error: FISCAL_YEAR_REFUSAL.not_found, code: 'not_found' });
  }
}

// ── Close and Reopen (Asks 2, 3) ──────────────────────────────────────────────────────────────

export async function closeFiscalYear(
  orgId: string, actorId: string, key: unknown, today: string, scope: TeamScope,
): Promise<Moved<{ year: { key: string; name: string; closingBalance: number; closedAt: string } }>> {
  const setting = await loadFiscalSetting(orgId);
  const found = readYearKey(key, setting); if (!found.ok) return found;
  const year = found.year;
  // What the step would refuse anyway, answered here first, so a year that hasn't ended (any key up to 2199 reads as
  // a year) never reaches the step — which makes a row for the year it is asked about.
  if (today <= year.lastDay) return refused(409, { error: FISCAL_YEAR_REFUSAL.not_ended(year.name, year.lastDay), code: 'not_ended', lastDay: year.lastDay });
  if (year.locked) return refused(409, { error: FISCAL_YEAR_REFUSAL.already_closed(year.name), code: 'already_closed' });
  // The figures the close keeps (what was still open, each team's standing) — read now, from the club's whole record.
  const { snapshot } = await closeQuestion(orgId, { year, setting, today, scope });
  const r = await step('club_fiscal_year_close', { p_org: orgId, p_first: year.key, p_actor: actorId, p_today: today, p_snapshot: snapshot });
  if (r.ok) return { ok: true, year: { key: year.key, name: year.name, closingBalance: Number(r.closingBalance), closedAt: r.closedAt } };
  switch (r.code) {
    case 'not_ended': return refused(409, { error: FISCAL_YEAR_REFUSAL.not_ended(year.name, year.lastDay), code: r.code, lastDay: year.lastDay });
    case 'already_closed': return refused(409, { error: FISCAL_YEAR_REFUSAL.already_closed(year.name), code: r.code });
    case 'close_order': return refused(409, { error: FISCAL_YEAR_REFUSAL.close_order(r.name), code: r.code, year: { key: r.firstDay, name: r.name } });
    default: return refused(404, { error: FISCAL_YEAR_REFUSAL.not_found, code: 'not_found' });
  }
}

export async function reopenFiscalYear(orgId: string, actorId: string, key: unknown, reason: unknown): Promise<Moved<{ year: { key: string; name: string } }>> {
  const setting = await loadFiscalSetting(orgId);
  const found = readYearKey(key, setting); if (!found.ok) return found;
  const year = found.year;
  // A year that was never closed is answered here (the step would make a row for it first).
  if (!year.closed) return refused(409, { error: FISCAL_YEAR_REFUSAL.not_closed(year.name), code: 'not_closed' });
  const r = await step('club_fiscal_year_reopen', { p_org: orgId, p_first: year.key, p_actor: actorId, p_reason: typeof reason === 'string' ? reason : '' });
  if (r.ok) return { ok: true, year: { key: year.key, name: year.name } };
  switch (r.code) {
    case 'reason_required': return refused(400, { error: FISCAL_YEAR_REFUSAL.reason_required, code: r.code });
    case 'bad_reason': return refused(400, { error: FISCAL_YEAR_REFUSAL.bad_reason, code: r.code });
    case 'not_closed': return refused(409, { error: FISCAL_YEAR_REFUSAL.not_closed(year.name), code: r.code });
    case 'not_latest': return refused(409, { error: FISCAL_YEAR_REFUSAL.not_latest(r.name), code: r.code, year: { key: r.firstDay, name: r.name } });
    default: return refused(404, { error: FISCAL_YEAR_REFUSAL.not_found, code: 'not_found' });
  }
}
