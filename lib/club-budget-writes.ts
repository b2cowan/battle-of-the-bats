import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { repGroupScopeGuard, type AuthContextWithRole } from './api-auth';
import { isCalendarDate } from './timezone';
import { isUuid } from './utils';
import { resolveOrgBudgetItem, type ResolvedOrgBudgetItem } from './coach-budget-items';
import { joinPeriodSplits } from './coach-budget-periods-payload';
import { refused, type Moved, type Refused } from './club-money-route';
import { CLUB_BUDGET_REFUSAL, FILED_UNDER_REFUSAL } from './club-money-words';
import { CLUB_OWNED_BOOK_KINDS, sumMoney } from './club-money-figures';
import { toCents, toDollars } from './coach-register';

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
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const MAX_AMOUNT = 9_999_999.99;

/** An amount off a request, to the cent — or null when it is not one above zero. */
function readAmount(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? toDollars(toCents(n)) : null;
}

const lineNotFound = () => refused(404, { error: CLUB_BUDGET_REFUSAL.line_not_found, code: 'line_not_found' });
const say = (status: number, code: Exclude<keyof typeof CLUB_BUDGET_REFUSAL, 'below_allocated' | 'over_line' | 'periods_dont_add_up' | 'year_has_lines' | 'nothing_to_copy' | 'word_on_plan'>) =>
  refused(status, { error: CLUB_BUDGET_REFUSAL[code], code });

/** What a budget step answers (mig 317). */
type StepAnswer = { ok: boolean; code?: string } & Record<string, any>;

/**
 * A budget step's refusal, as the one coded answer: its status, its sentence, and the figures it quotes.
 * `about` carries what the sentence names that the database does not (the word, the years).
 */
function stepRefused(step: string, r: StepAnswer, about: { word?: string; from?: number; to?: number } = {}): Refused {
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

const LINE_SELECT = 'id, season_year, description, total_amount, notes, sort_order, created_at, updated_at, category_id, item_id, budget_categories ( id, name ), budget_items ( id, name, direction )';

export interface AddLineInput {
  seasonYear: unknown;
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
export async function addClubLine(orgId: string, body: AddLineInput): Promise<Moved<{ line: Record<string, any>; joined: boolean }>> {
  const year = parseInt(String(body.seasonYear ?? ''), 10);
  if (!year || year < 2020 || year > 2099) return refused(400, { error: 'Choose the year.', code: 'bad_year' });
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
    p_org: orgId, p_year: year, p_item: item.id, p_description: description, p_total: total, p_notes: notes,
    p_sort: Math.trunc(Number(body.sortOrder)) || 0, p_periods: periods.value && periods.value.length > 0 ? periods.value : null,
  });
  if (error) throw error;
  const r = data as StepAnswer;
  if (r.ok) return { ok: true, line: await readLine(orgId, r.lineId as string), joined: false };
  if (r.code === 'word_on_plan') return joinOntoLine(orgId, year, item.id, { total, periods: periods.value ?? [], notes });
  return stepRefused('club_budget_line_add', r, { word: item.name });
}

/** The word is already on the year: add to its line — amounts, dates and notes in the line's one step,
 *  saved against its last change and read again once if another add landed first, so neither is lost. */
async function joinOntoLine(
  orgId: string, year: number, itemId: string,
  added: { total: number; periods: ClubPeriodInput[]; notes: string | null },
): Promise<Moved<{ line: Record<string, any>; joined: boolean }>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: line, error } = await supabaseAdmin.from('org_budget_lines')
      .select('id, total_amount, notes, updated_at, org_budget_periods ( period_label, period_date, amount, sort_order )')
      .eq('org_id', orgId).eq('season_year', year).eq('item_id', itemId)
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

export async function rollClubYear(orgId: string, fromYear: unknown, toYear: unknown): Promise<Moved<{ lines: number; year: number }>> {
  const from = parseInt(String(fromYear ?? ''), 10);
  const to = parseInt(String(toYear ?? ''), 10);
  if (!from || !to || from < 2020 || to > 2099 || to <= from) {
    return refused(400, { error: 'Choose a year that follows the one to start from.', code: 'bad_year' });
  }
  const { data, error } = await supabaseAdmin.rpc('club_budget_roll_year', { p_org: orgId, p_from: from, p_to: to });
  if (error) throw error;
  const r = data as StepAnswer;
  return r.ok ? { ok: true, lines: Number(r.lines), year: to } : stepRefused('club_budget_roll_year', r, { from, to });
}

// ── An allocation (from a line, or a general one) ─────────────────────────────────────────────

export interface AllocationInput {
  description: unknown;
  /** A general allocation's stated total (3a's form): its shares may not exceed it. Never the stored total. */
  totalAmount?: unknown;
  sourceEntryId?: unknown;
  sourceBudgetLineId?: unknown;
  splits: unknown;
}

/**
 * An allocation, its splits and installments, and its link to the line — ONE step (C11). The total it
 * records is its teams' shares, never the line's. From a line, the amount can't exceed what is left on
 * it (worked out inside the step). A general allocation's source is one of the club's own live entries
 * (C17, 3a's rule). A team outside the member's groups is refused (B11).
 */
export async function createClubAllocation(ctx: AuthContextWithRole, body: AllocationInput): Promise<Moved<{ allocationId: string; total: number }> | { error: Response }> {
  const orgId = ctx.org.id;
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!description) return refused(400, { error: 'Describe what the allocation is for.', code: 'description_required' });
  if (description.length > 200) return say(400, 'bad_description');

  const lineId = body.sourceBudgetLineId ?? null;
  const entryId = body.sourceEntryId ?? null;
  if (lineId !== null && entryId !== null) {
    return refused(400, { error: 'An allocation comes from a budget line or a ledger entry, not both.', code: 'one_source' });
  }
  if (lineId !== null && !isUuid(lineId)) return lineNotFound();
  if (entryId !== null) {
    if (!isUuid(entryId)) return say(400, 'bad_source_entry');
    const { data: src } = await supabaseAdmin
      .from('accounting_entries')
      .select('id, status, accounting_ledgers!inner ( org_id, entity_type )')
      .eq('id', entryId).eq('accounting_ledgers.org_id', orgId).in('accounting_ledgers.entity_type', [...CLUB_OWNED_BOOK_KINDS])
      .maybeSingle();
    if (!src || src.status === 'void') return say(400, 'bad_source_entry');
  }

  const splits = body.splits;
  if (!Array.isArray(splits) || splits.length === 0) return refused(400, { error: 'Bill at least one team.', code: 'splits_required' });
  const splitSum = sumMoney((splits as any[]).map(x => ({ amount: Number(x?.amount ?? 0) || 0 })));
  if (body.totalAmount !== undefined && body.totalAmount !== null) {
    const stated = Number(body.totalAmount);
    if (!Number.isFinite(stated) || stated <= 0) return refused(400, { error: 'The amount must be above zero.', code: 'bad_total' });
    if (splitSum > stated + 0.001) {
      return refused(400, { error: `The teams’ shares ($${splitSum.toFixed(2)}) are more than the amount ($${stated.toFixed(2)}).`, code: 'shares_over_total' });
    }
  }

  // Every team and season named, in two reads — not two per split. An id that isn't one is simply not found.
  const named = (key: 'teamId' | 'programYearId') => [...new Set((splits as any[]).map(s => s?.[key]).filter(isUuid))];
  const [teamsRead, seasonsRead] = await Promise.all([
    supabaseAdmin.from('rep_teams').select('id, name, org_id, group_id').in('id', named('teamId')),
    supabaseAdmin.from('rep_program_years').select('id, team_id').in('id', named('programYearId')),
  ]);
  if (teamsRead.error) throw teamsRead.error;
  if (seasonsRead.error) throw seasonsRead.error;
  const teams = new Map((teamsRead.data ?? []).map(t => [t.id as string, t]));
  const seasons = new Map((seasonsRead.data ?? []).map(y => [y.id as string, y]));

  const clean: Record<string, unknown>[] = [];
  for (const split of splits as any[]) {
    if (!split?.teamId || !split?.programYearId) return refused(400, { error: 'Each team needs its season.', code: 'bad_split' });
    const team = teams.get(split.teamId);
    if (!team || team.org_id !== orgId) return refused(404, { error: 'That team isn’t in the club.', code: 'team_not_found' });
    const scoped = repGroupScopeGuard(ctx, team.group_id ?? null);
    if (scoped) return { error: scoped };
    const season = seasons.get(split.programYearId);
    if (!season || season.team_id !== team.id) return refused(404, { error: 'That season isn’t the team’s.', code: 'season_not_found' });
    if (!['percentage', 'sessions', 'fixed'].includes(split.splitMethod)) return refused(400, { error: 'Choose how the share is split.', code: 'bad_split' });
    if (!['standard', 'custom'].includes(split.paymentSchedule)) return refused(400, { error: 'Choose the payment schedule.', code: 'bad_split' });
    const amount = readAmount(split.amount);
    if (amount === null) return refused(400, { error: 'Each team’s share must be above zero.', code: 'bad_split' });
    if (!Array.isArray(split.installments) || split.installments.length === 0) {
      return refused(400, { error: 'Each team needs at least one installment.', code: 'bad_split' });
    }
    const installments: { installmentNumber: number; amount: number; dueDate: string }[] = [];
    for (const [n, i] of (split.installments as any[]).entries()) {
      const due = readAmount(i?.amount);
      if (typeof i?.dueDate !== 'string' || !isCalendarDate(i.dueDate) || due === null) {
        return refused(400, { error: 'Each installment needs a due date and an amount.', code: 'bad_installment' });
      }
      installments.push({ installmentNumber: Number(i.installmentNumber) || n + 1, amount: due, dueDate: i.dueDate });
    }
    const instSum = sumMoney(installments);
    if (Math.abs(instSum - amount) > 0.01) {
      return refused(400, {
        error: `${team.name}’s installments add up to $${instSum.toFixed(2)}, and its share is $${amount.toFixed(2)}.`, code: 'installments_dont_add_up',
      });
    }
    clean.push({
      teamId: team.id, programYearId: season.id, amount, splitMethod: split.splitMethod,
      splitValue: Number(split.splitValue ?? 0) || 0, paymentSchedule: split.paymentSchedule,
      notes: typeof split.notes === 'string' ? split.notes.trim().slice(0, 500) : null,
      installments,
    });
  }

  const { data, error } = await supabaseAdmin.rpc('club_allocation_create', {
    p_org: orgId, p_actor: ctx.user.id, p_description: description,
    p_source_line: lineId, p_source_entry: entryId, p_splits: clean,
  });
  if (error) throw error;
  const r = data as StepAnswer;
  return r.ok ? { ok: true, allocationId: r.allocationId as string, total: Number(r.total) } : stepRefused('club_allocation_create', r);
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
