import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { repGroupScopeGuard, type AuthContextWithRole } from './api-auth';
import { isCalendarDate } from './timezone';
import { isUuid } from './utils';
import { resolveOrgBudgetItem, type ResolvedOrgBudgetItem } from './coach-budget-items';
import { joinPeriodSplits } from './coach-budget-periods-payload';
import { refused, type Moved, type Refused } from './club-money-route';
import { CLUB_BUDGET_REFUSAL, FILED_UNDER_REFUSAL, SEASON_CLOSED_REFUSAL, SOURCE_ENTRY_RETIRED, planClosedWords } from './club-money-words';
import { sumMoney } from './club-money-figures';
import { toCents, toDollars } from './coach-register';
import { billSplits, readAmount, type BillInput, type BillSplitMethod, type CleanSplit } from './club-bill-split';
import { fiscalYearOf, readFiscalYearParam } from './club-fiscal-year';
import { loadFiscalSetting, refuseIfClosed, refuseIfYearLocked } from './club-fiscal-year-server';
import { liveSeasonOf } from './season-live';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE BUDGET'S WRITES (Club Tier Stage 3b; C10, C11, Asks 4a, 4b, 4d).
 *
 * Each write money depends on is ONE database step (mig 317), and this module only validates the
 * input and turns a refusal into one coded answer the screens render (3a's `refused` shape):
 *   · a line — `club_budget_line_save`: its total, its dates, its word and its words in one step. A
 *     changed total below what is allocated is refused WITH the figure (409 `below_allocated`); dates
 *     must add up to the total (±$0.02); a word already on the year is refused naming that line; a line
 *     teams are billed from never takes a money-in word;
 *   · add a line — `club_budget_line_add`: the line and its dates together, under the year's lock;
 *   · one word, one line — planning a word already on the year ADDS to its line (the coach's mig-286
 *     rule, the write as well as the index): the amounts join and the dates concatenate through the
 *     coach's own `joinPeriodSplits`, saved against the line's last change so two adds a breath apart
 *     can never lose one;
 *   · remove a line — `club_budget_line_delete`, refused while an allocation is drawn from it;
 *   · start a year from another — `club_budget_roll_year`;
 *   · an allocation, its splits, installments and line link — `club_allocation_create`: many per line,
 *     refused above what is left (409 `over_line`), its total is its teams' shares.
 *
 * WHO: every route calling here answers to 3a's one money rule first (`resolveClubMoney(…, { write:
 * true })` → `canMoveClubMoney`: owner, treasurer, an admin with Accounting — Ask 4d). A team named in
 * an allocation is checked against the member's groups here (B11), so a route cannot forget it.
 *
 * ⚖ Stage 3c — THE FISCAL YEAR AND ITS LOCK. A plan line keys on its fiscal year (mig 318, call 3); a year
 * arrives as its KEY, its first day (an old bare number still lands — `readFiscalYearParam`). Every write
 * here is checked against the lock FIRST, so a closed year is refused in words (409 `year_closed`, the one
 * refusal — lib/club-fiscal-year-server.ts); the database's step and its triggers are the floor. New
 * allocation (Ask 6): the split and the payment schedule chosen ONCE per bill (Evenly · By amount · By
 * percentage · By sessions; one payment or installments), a team's row may carry its own installments; only
 * a team's OPEN season is billed (S3C-09); the pasted ledger-entry id is gone (C17).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const lineNotFound = () => refused(404, { error: CLUB_BUDGET_REFUSAL.line_not_found, code: 'line_not_found' });
const say = (status: number, code: Exclude<keyof typeof CLUB_BUDGET_REFUSAL, 'below_allocated' | 'over_line' | 'periods_dont_add_up' | 'year_has_lines' | 'nothing_to_copy' | 'word_on_plan' | 'different_months'>) =>
  refused(status, { error: CLUB_BUDGET_REFUSAL[code], code });

/** What a budget step answers (mig 317). */
type StepAnswer = { ok: boolean; code?: string } & Record<string, any>;

/**
 * A budget step's refusal, as the one coded answer: its status, its sentence, and the figures it quotes.
 * `about` carries what the sentence names that the database does not (the word, the years).
 */
function stepRefused(step: string, r: StepAnswer, about: { word?: string; from?: string; to?: string } = {}): Refused {
  switch (r.code) {
    case 'not_found':
    case 'line_not_found': return lineNotFound();
    case 'below_allocated': {
      const allocated = Number(r.allocated);
      return refused(409, { error: CLUB_BUDGET_REFUSAL.below_allocated(allocated), code: r.code, allocated });
    }
    case 'over_line': {
      const left = Number(r.left);
      return refused(409, { error: CLUB_BUDGET_REFUSAL.over_line(left), code: r.code, left, allocated: Number(r.allocated), planned: Number(r.planned) });
    }
    case 'periods_dont_add_up': {
      const periodsTotal = Number(r.periodsTotal), lineTotal = Number(r.lineTotal);
      return refused(400, { error: CLUB_BUDGET_REFUSAL.periods_dont_add_up(periodsTotal, lineTotal), code: r.code, periodsTotal, lineTotal });
    }
    case 'word_on_plan':
      return refused(409, { error: CLUB_BUDGET_REFUSAL.word_on_plan(about.word ?? 'That word'), code: r.code, existingLineId: r.existingLineId ?? null });
    case 'year_has_lines': return refused(409, { error: CLUB_BUDGET_REFUSAL.year_has_lines(about.to!), code: r.code });
    case 'nothing_to_copy': return refused(400, { error: CLUB_BUDGET_REFUSAL.nothing_to_copy(about.from!), code: r.code });
    case 'different_months': return refused(400, { error: CLUB_BUDGET_REFUSAL.different_months(about.from!, about.to!), code: r.code });
    case 'bad_year': return refused(400, { error: 'Choose a fiscal year.', code: r.code });
    // The routes check the lock first and say it with the year's name; this answer only reaches a caller that
    // raced a close (the step re-checked under its lock).
    case 'year_closed': return refused(409, { error: planClosedWords('That fiscal year', null), code: r.code, year: null, reopen: null, nextDay: null });
    case 'season_closed': return refused(409, { error: SEASON_CLOSED_REFUSAL(about.word ?? 'That team'), code: r.code, teamId: r.teamId ?? null });
    case 'line_changed':
    case 'allocated_line_is_a_cost':
    case 'has_allocations': return say(409, r.code);
    case 'bad_total':
    case 'bad_description':
    case 'bad_source_entry':
    case 'bad_period_amount':
    case 'bad_period_label':
    case 'not_a_cost_line': return say(400, r.code);
    default: throw new Error(`${step}: unexpected answer ${JSON.stringify(r)}`);
  }
}

// ── A line's parts, off a request ─────────────────────────────────────────────────────────────

export interface ClubPeriodInput { label: string; date: string | null; amount: number }

/** A line's periods off a request: `undefined` keeps them, `[]` makes the line a lump sum. Accepts the
 *  old page's `periodDate` beside `date`. Each needs a name and an amount above zero. */
export function readClubPeriods(raw: unknown): Moved<{ value: ClubPeriodInput[] | null }> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (!Array.isArray(raw)) return refused(400, { error: 'The dates must be a list.', code: 'bad_periods' });
  const out: ClubPeriodInput[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    const label = typeof p?.label === 'string' ? p.label.trim() : '';
    const date = (p?.date ?? p?.periodDate ?? null) as unknown;
    const amount = readAmount(p?.amount);
    if (!label || label.length > 100) return say(400, 'bad_period_label');
    if (date !== null && date !== '' && (typeof date !== 'string' || !isCalendarDate(date))) {
      return refused(400, { error: 'Enter each date as a date.', code: 'bad_period_date' });
    }
    if (amount === null) return say(400, 'bad_period_amount');
    out.push({ label, date: typeof date === 'string' && date ? date : null, amount });
  }
  return { ok: true, value: out };
}

/** A line's words (`club_budget_line_save`'s p_fields): a key that is present is written. */
interface LineFields { description?: string; notes?: string; sortOrder?: number }

function readLineFields(body: Record<string, unknown>): Moved<{ value: LineFields }> {
  const value: LineFields = {};
  if ('description' in body) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description || description.length > 200) return say(400, 'bad_description');
    value.description = description;
  }
  if ('notes' in body) value.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : '';
  if ('sortOrder' in body) value.sortOrder = Math.trunc(Number(body.sortOrder)) || 0;
  return { ok: true, value };
}

/** The word a request names, authorised for the club (`resolveOrgBudgetItem`). A word is required. */
async function readWord(raw: unknown, orgId: string): Promise<Moved<{ item: ResolvedOrgBudgetItem }>> {
  const word = await resolveOrgBudgetItem(raw, orgId);
  if (!word.ok) return refused(400, { error: word.error, code: 'bad_word' });
  if (!word.item) return say(400, 'word_required');
  return { ok: true, item: word.item };
}

// ── A line: one step ──────────────────────────────────────────────────────────────────────────

/** `club_budget_line_save` — every part NULL/absent keeps what is there. */
export async function saveClubLine(
  orgId: string,
  lineId: string,
  args: {
    total?: number | null; periods?: readonly ClubPeriodInput[] | null; expect?: string | null;
    item?: ResolvedOrgBudgetItem | null; fields?: LineFields;
  },
): Promise<Moved<{ updatedAt: string; total: number }>> {
  if (!isUuid(lineId)) return lineNotFound();
  const { data, error } = await supabaseAdmin.rpc('club_budget_line_save', {
    p_org: orgId,
    p_line: lineId,
    p_total: args.total ?? null,
    p_periods: args.periods ?? null,
    p_expect: args.expect ?? null,
    p_item: args.item?.id ?? null,
    p_fields: args.fields ?? null,
  });
  if (error) throw error;
  const r = data as StepAnswer;
  return r.ok ? { ok: true, updatedAt: r.updatedAt, total: Number(r.total) } : stepRefused('club_budget_line_save', r, { word: args.item?.name });
}

/** Edit a line: `{ description, notes, sortOrder, itemId, totalAmount, periods, expectUpdatedAt }`, any of
 *  them, saved in ONE step — a refusal of any part leaves every part as it was. */
export async function editClubLine(orgId: string, lineId: string, body: Record<string, unknown>): Promise<Moved<{ line: Record<string, any> }>> {
  let total: number | null = null;
  if (body.totalAmount !== undefined) {
    total = readAmount(body.totalAmount);
    if (total === null) return say(400, 'bad_total');
  }
  const periods = readClubPeriods(body.periods);
  if (!periods.ok) return periods;
  const fields = readLineFields(body);
  if (!fields.ok) return fields;
  let item: ResolvedOrgBudgetItem | null = null;
  if ('itemId' in body) {
    const word = await readWord(body.itemId, orgId);
    if (!word.ok) return word;
    item = word.item;
  }
  const expect = typeof body.expectUpdatedAt === 'string' && !Number.isNaN(Date.parse(body.expectUpdatedAt)) ? body.expectUpdatedAt : null;
  const saved = await saveClubLine(orgId, lineId, { total, periods: periods.value, expect, item, fields: fields.value });
  if (!saved.ok) return saved;
  return { ok: true, line: await readLine(orgId, lineId) };
}

/** Remove a line — `club_budget_line_delete`: refused while an allocation is drawn from it. */
export async function deleteClubLine(orgId: string, lineId: string): Promise<Moved<object>> {
  if (!isUuid(lineId)) return lineNotFound();
  const { data, error } = await supabaseAdmin.rpc('club_budget_line_delete', { p_org: orgId, p_line: lineId });
  if (error) throw error;
  const r = data as StepAnswer;
  return r.ok ? { ok: true } : stepRefused('club_budget_line_delete', r);
}

// ── Add a line (one word, one line) ───────────────────────────────────────────────────────────

const LINE_SELECT = 'id, fiscal_year_id, description, total_amount, notes, sort_order, created_at, updated_at, category_id, item_id, budget_categories ( id, name ), budget_items ( id, name, direction ), org_fiscal_years ( first_day, name )';

export interface AddLineInput {
  /** The fiscal year's KEY (its first day). */
  fiscalYear?: unknown;
  /** ⚠ Stage 3b's bare year number — still read (it lands on the year with that name) until session 2's screen sends the key. */
  seasonYear?: unknown;
  itemId: unknown;
  totalAmount: unknown;
  description?: unknown;
  notes?: unknown;
  periods?: unknown;
  sortOrder?: unknown;
}

/**
 * Plan a word on a year. A word already on that year's plan ADDS to its line (`joined: true`): the
 * amounts join, the dates concatenate (an undated side becomes a "No date yet" period, the coach's
 * Q4 rule), the notes join. Money-in words plan revenue (Ask 4b); money-out words plan costs.
 */
export async function addClubLine(orgId: string, body: AddLineInput, canMove = true): Promise<Moved<{ line: Record<string, any>; joined: boolean }>> {
  const setting = await loadFiscalSetting(orgId);
  const year = readFiscalYearParam(String(body.fiscalYear ?? body.seasonYear ?? ''), setting);
  if (!year) return refused(400, { error: 'Choose a fiscal year.', code: 'bad_year' });
  const locked = refuseIfYearLocked(setting, year, canMove);
  if (locked) return locked;
  const total = readAmount(body.totalAmount);
  if (total === null) return say(400, 'bad_total');
  const word = await readWord(body.itemId, orgId);
  if (!word.ok) return word;
  const item = word.item;
  const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : item.name;
  if (description.length > 200) return say(400, 'bad_description');
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null;
  const periods = readClubPeriods(body.periods);
  if (!periods.ok) return periods;

  // The line and its dates in ONE step (the category is the word's, in the step): a refusal makes nothing.
  const { data, error } = await supabaseAdmin.rpc('club_budget_line_add', {
    p_org: orgId, p_year: year.key, p_item: item.id, p_description: description, p_total: total, p_notes: notes,
    p_sort: Math.trunc(Number(body.sortOrder)) || 0, p_periods: periods.value && periods.value.length > 0 ? periods.value : null,
  });
  if (error) throw error;
  const r = data as StepAnswer;
  if (r.ok) return { ok: true, line: await readLine(orgId, r.lineId as string), joined: false };
  if (r.code === 'word_on_plan') return joinOntoLine(orgId, r.existingLineId as string, { total, periods: periods.value ?? [], notes });
  return stepRefused('club_budget_line_add', r, { word: item.name });
}

/** The word is already on the year: add to its line — amounts, dates and notes in the line's one step,
 *  saved against its last change and read again once if another add landed first, so neither is lost. */
async function joinOntoLine(
  orgId: string, lineId: string,
  added: { total: number; periods: ClubPeriodInput[]; notes: string | null },
): Promise<Moved<{ line: Record<string, any>; joined: boolean }>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: line, error } = await supabaseAdmin.from('org_budget_lines')
      .select('id, total_amount, notes, updated_at, org_budget_periods ( period_label, period_date, amount, sort_order )')
      .eq('org_id', orgId).eq('id', lineId)
      .order('sort_order', { referencedTable: 'org_budget_periods' })
      .maybeSingle();
    if (error) throw error;
    if (!line) return say(409, 'line_changed');
    const lineTotal = Number(line.total_amount);
    const joined = joinPeriodSplits(
      { total: lineTotal, periods: (line.org_budget_periods ?? []).map(p => ({ periodLabel: p.period_label, periodDate: p.period_date, amount: Number(p.amount) })) },
      { total: added.total, periods: added.periods.map(p => ({ periodLabel: p.label, periodDate: p.date, amount: p.amount })) },
    );
    const saved = await saveClubLine(orgId, line.id, {
      total: toDollars(toCents(lineTotal) + toCents(added.total)),
      periods: joined.length > 0 ? joined.map(p => ({ label: p.periodLabel, date: p.periodDate, amount: p.amount })) : null,
      expect: line.updated_at,
      fields: added.notes ? { notes: [line.notes?.trim(), added.notes].filter(Boolean).join('; ') } : undefined,
    });
    if (!saved.ok) {
      if ((saved.body as { code?: string }).code === 'line_changed' && attempt === 0) continue;
      return saved;
    }
    return { ok: true, line: await readLine(orgId, line.id), joined: true };
  }
  return say(409, 'line_changed');
}

export async function readLine(orgId: string, lineId: string): Promise<Record<string, any>> {
  const { data, error } = await supabaseAdmin.from('org_budget_lines').select(LINE_SELECT)
    .eq('id', lineId).eq('org_id', orgId).single();
  if (error) throw error;
  return data;
}

// ── Start a year from another ─────────────────────────────────────────────────────────────────

/** Start a fiscal year from another's plan (keys, or Stage 3b's bare numbers). Refused into a closed year. */
export async function rollClubYear(orgId: string, fromYear: unknown, toYear: unknown, canMove = true): Promise<Moved<{ lines: number; year: { key: string; name: string } }>> {
  const setting = await loadFiscalSetting(orgId);
  const from = readFiscalYearParam(String(fromYear ?? ''), setting);
  const to = readFiscalYearParam(String(toYear ?? ''), setting);
  if (!from || !to || to.key <= from.key) {
    return refused(400, { error: 'Choose a fiscal year that follows the one to start from.', code: 'bad_year' });
  }
  const locked = refuseIfYearLocked(setting, to, canMove);
  if (locked) return locked;
  const { data, error } = await supabaseAdmin.rpc('club_budget_roll_year', { p_org: orgId, p_from: from.key, p_to: to.key });
  if (error) throw error;
  const r = data as StepAnswer;
  return r.ok ? { ok: true, lines: Number(r.lines), year: { key: to.key, name: to.name } } : stepRefused('club_budget_roll_year', r, { from: from.name, to: to.name });
}

/**
 * THE LOCK, for an existing line (an edit, its dates, its removal): its fiscal year closed → 409 `year_closed`
 * in words, before anything is asked of the database. Null: the year is open (or the line isn't the club's —
 * the step answers that).
 */
export async function lineYearRefusal(orgId: string, lineId: string, canMove: boolean): Promise<Refused | null> {
  if (!isUuid(lineId)) return null;
  const { data, error } = await supabaseAdmin.from('org_budget_lines')
    .select('org_fiscal_years ( first_day )').eq('id', lineId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  const key = (data?.org_fiscal_years as { first_day?: string } | null)?.first_day;
  if (!key) return null;
  const setting = await loadFiscalSetting(orgId);
  return refuseIfYearLocked(setting, fiscalYearOf(key, setting), canMove);
}

// ── An allocation (Ask 6: one form for both doors — from a line, or "Bill from" on Allocations) ─────────

/** Stage 3a's body (the page that session 2 retires): a split per team, each with its own method and installments. */
export interface AllocationInput {
  description: unknown;
  /** A general allocation's stated total (3a's form): its shares may not exceed it. Never the stored total. */
  totalAmount?: unknown;
  /** ⚰ C17: the pasted ledger-entry id. Refused when sent (400 `source_entry_retired`); old rows keep theirs. */
  sourceEntryId?: unknown;
  sourceBudgetLineId?: unknown;
  splits: unknown;
}


/** Read Stage 3a's per-team body (the page session 2 retires) into the same clean splits. */
function legacySplits(splits: unknown): Moved<{ method: BillSplitMethod; splits: CleanSplit[] }> {
  if (!Array.isArray(splits) || splits.length === 0) return refused(400, { error: 'Bill at least one team.', code: 'splits_required' });
  const clean: CleanSplit[] = [];
  for (const split of splits as any[]) {
    if (!split?.teamId || !split?.programYearId) return refused(400, { error: 'Each team needs its season.', code: 'bad_split' });
    if (!['percentage', 'sessions', 'fixed'].includes(split.splitMethod)) return refused(400, { error: 'Choose how the share is split.', code: 'bad_split' });
    if (!['standard', 'custom'].includes(split.paymentSchedule)) return refused(400, { error: 'Choose the payment schedule.', code: 'bad_split' });
    const amount = readAmount(split.amount);
    if (amount === null) return refused(400, { error: 'Each team’s share must be above zero.', code: 'bad_split' });
    if (!Array.isArray(split.installments) || split.installments.length === 0) {
      return refused(400, { error: 'Each team needs at least one installment.', code: 'bad_split' });
    }
    const installments: CleanSplit['installments'] = [];
    for (const [n, i] of (split.installments as any[]).entries()) {
      const due = readAmount(i?.amount);
      if (typeof i?.dueDate !== 'string' || !isCalendarDate(i.dueDate) || due === null) {
        return refused(400, { error: 'Each installment needs a due date and an amount.', code: 'bad_installment' });
      }
      installments.push({ installmentNumber: Number(i.installmentNumber) || n + 1, amount: due, dueDate: i.dueDate });
    }
    if (Math.abs(sumMoney(installments) - amount) > 0.01) {
      return refused(400, { error: `A team’s installments add up to $${sumMoney(installments).toFixed(2)}, and its share is $${amount.toFixed(2)}.`, code: 'installments_dont_add_up' });
    }
    clean.push({
      teamId: String(split.teamId), programYearId: String(split.programYearId), amount,
      splitValue: Number(split.splitValue ?? 0) || 0, paymentSchedule: split.paymentSchedule,
      notes: typeof split.notes === 'string' ? split.notes.trim().slice(0, 500) : null, installments,
    });
  }
  const methods = new Set((splits as any[]).map(x => x.splitMethod));
  if (methods.size === 1) return { ok: true, method: [...methods][0] as BillSplitMethod, splits: clean };
  // Mixed ways on one bill (Stage 3a's page let each team pick): a bill now has ONE method (Ask 6), so it is stored
  // By amount — each share's value its own dollars, never a percent or a session count read as dollars.
  return { ok: true, method: 'fixed', splits: clean.map(c => ({ ...c, splitValue: c.amount })) };
}

/**
 * An allocation, its splits and installments, and its link to the line — ONE step (C11). Ask 6's body
 * (`BillInput`: `teams`, `split`, `schedule`) or Stage 3a's (`splits`, until session 2 retires its page).
 * Checked FIRST, in words: a team's season must be RUNNING (S3C-09 — 409 `season_closed`, naming the team); the
 * bill can't count in a closed fiscal year (409 `year_closed`: a closed year's line, or an off-plan bill falling
 * due in one); a team outside the member's groups is refused (B11); the pasted ledger-entry id is refused (C17).
 * From a line, the amount can't exceed what is left on it (409 `over_line`, worked out inside the step).
 */
export async function createClubAllocation(ctx: AuthContextWithRole, body: BillInput & AllocationInput): Promise<Moved<{ allocationId: string; total: number }> | { error: Response }> {
  const orgId = ctx.org.id;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!description) return refused(400, { error: 'Name the bill.', code: 'description_required' });
  if (description.length > 200) return say(400, 'bad_description');
  if (body.sourceEntryId !== undefined && body.sourceEntryId !== null && body.sourceEntryId !== '') {
    return refused(400, { error: SOURCE_ENTRY_RETIRED, code: 'source_entry_retired' });
  }
  const lineId = body.sourceBudgetLineId ?? null;
  if (lineId !== null && !isUuid(lineId)) return lineNotFound();

  // The two bodies, into one clean set of splits.
  let method: BillSplitMethod;
  let clean: CleanSplit[];
  if (Array.isArray(body.teams)) {
    const bill = billSplits(body);
    if (!bill.ok) return bill;
    method = bill.method;
    clean = bill.splits.map((s, n) => ({ ...s, ...bill.teams[n] }));
  } else {
    const legacy = legacySplits(body.splits);
    if (!legacy.ok) return legacy;
    method = legacy.method;
    clean = legacy.splits;
    if (body.totalAmount !== undefined && body.totalAmount !== null) {
      const stated = Number(body.totalAmount);
      const splitSum = sumMoney(clean);
      if (!Number.isFinite(stated) || stated <= 0) return refused(400, { error: 'The amount must be above zero.', code: 'bad_total' });
      if (splitSum > stated + 0.001) {
        return refused(400, { error: `The teams’ shares ($${splitSum.toFixed(2)}) are more than the amount ($${stated.toFixed(2)}).`, code: 'shares_over_total' });
      }
    }
  }

  // Every team named, and every season of those teams, in two reads — not two per split. An id that isn't one is
  // simply not found.
  const named = (key: 'teamId' | 'programYearId') => [...new Set(clean.map(s => s[key]).filter(isUuid))];
  const [teamsRead, seasonsRead, setting, lineRead] = await Promise.all([
    supabaseAdmin.from('rep_teams').select('id, name, org_id, group_id').in('id', named('teamId')),
    supabaseAdmin.from('rep_program_years').select('id, team_id, status, created_at').in('team_id', named('teamId')),
    loadFiscalSetting(orgId),
    lineId ? supabaseAdmin.from('org_budget_lines').select('id, org_fiscal_years ( first_day )').eq('id', lineId as string).eq('org_id', orgId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (teamsRead.error) throw teamsRead.error;
  if (seasonsRead.error) throw seasonsRead.error;
  if (lineRead.error) throw lineRead.error;
  const teams = new Map((teamsRead.data ?? []).map(t => [t.id as string, t]));
  const seasons = new Map((seasonsRead.data ?? []).map(y => [y.id as string, y]));
  /** Each team's RUNNING season — the newest draft or active one, the season its payments are carried by (call 1). */
  const running = (teamId: string) => liveSeasonOf((seasonsRead.data ?? [])
    .filter(y => y.team_id === teamId).map(y => ({ id: y.id as string, status: y.status as string, createdAt: y.created_at as string })))?.id ?? null;

  for (const split of clean) {
    const team = teams.get(split.teamId);
    if (!team || team.org_id !== orgId) return refused(404, { error: 'That team isn’t in the club.', code: 'team_not_found' });
    const scoped = repGroupScopeGuard(ctx, team.group_id ?? null);
    if (scoped) return { error: scoped };
    const season = seasons.get(split.programYearId);
    if (!season || season.team_id !== team.id) return refused(404, { error: 'That season isn’t the team’s.', code: 'season_not_found' });
    // Only the team's RUNNING season is billed (S3C-09): a closed one's books are a record, and an older season
    // still marked open is not the one its payments would be carried by.
    if (running(team.id) !== season.id) {
      return refused(409, { error: SEASON_CLOSED_REFUSAL(team.name), code: 'season_closed', teamId: team.id });
    }
  }

  // The fiscal year it would count in must be open (Ask 1): its line's year; an off-plan bill, the year its first
  // payment falls due in. (Every caller passed the write gate — `canMoveClubMoney` — so Reopen is theirs to offer.)
  if (lineId && lineRead.data === null) return lineNotFound();
  const lineKey = (lineRead.data?.org_fiscal_years as { first_day?: string } | null)?.first_day ?? null;
  const firstDue = clean.flatMap(s => s.installments.map(i => i.dueDate)).sort()[0];
  const closedYear = lineKey
    ? refuseIfYearLocked(setting, fiscalYearOf(lineKey, setting), true)
    : refuseIfClosed(setting, [firstDue], { canMove: true, kind: 'date' });
  if (closedYear) return closedYear;

  const { data, error } = await supabaseAdmin.rpc('club_allocation_create', {
    p_org: orgId, p_actor: ctx.user.id, p_description: description, p_source_line: lineId,
    p_split_method: method,
    p_notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null,
    p_splits: clean.map(s => ({
      teamId: s.teamId, programYearId: s.programYearId, amount: s.amount, splitValue: s.splitValue,
      paymentSchedule: s.paymentSchedule, notes: s.notes, installments: s.installments,
    })),
  });
  if (error) throw error;
  const r = data as StepAnswer;
  const teamName = r.code === 'season_closed' ? teams.get(r.teamId)?.name : undefined;
  return r.ok ? { ok: true, allocationId: r.allocationId as string, total: Number(r.total) } : stepRefused('club_allocation_create', r, { word: teamName });
}

// ── An entry's "Filed under" (Ask 4a) ─────────────────────────────────────────────────────────

/**
 * The budget word a club ledger line is filed under: a word offered to the club (`resolveOrgBudgetItem` —
 * standard and the club's own, never a team's), on the line's OWN side (money out under a money-out word).
 * Its category is derived from it. `null` = not filed.
 */
export async function readFiledUnder(
  orgId: string,
  raw: unknown,
  entryType: 'income' | 'expense',
): Promise<Moved<{ value: { categoryId: string; itemId: string } | null }>> {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  const word = await readWord(raw, orgId);
  if (!word.ok) return word;
  const want = entryType === 'income' ? 'in' : 'out';
  if (word.item.direction !== want) {
    return refused(400, {
      error: want === 'out' ? FILED_UNDER_REFUSAL.wrong_side_out : FILED_UNDER_REFUSAL.wrong_side_in, code: 'wrong_side',
    });
  }
  return { ok: true, value: { categoryId: word.item.categoryId, itemId: word.item.id } };
}
