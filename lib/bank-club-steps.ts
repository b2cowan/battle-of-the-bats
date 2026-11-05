import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { resolvePersonNamer } from './db';
import type { AuthContextWithRole } from './api-auth';
import { canMoveClubMoney } from './member-access';
import { moveRefused, refused, type Moved, type Refused } from './club-money-route';
import { loadFiscalSetting } from './club-fiscal-year-server';
import { closedThrough } from './club-fiscal-year';
import { tournamentToday } from './timezone';
import { bankFeeDate, evaluateCheck, orderedChecks } from './bank-check';
import { readClubBankAccount, readClubBankAccounts, type ClubBankRead } from './bank-club-read';
import { directionOfEntry, ENTRY_SELECT, type EntryRow } from './bank-club-map';
import { toCents } from './coach-register';
import { isUuid } from './utils';
import {
  bookNames, checkSummaries, checkToShow, checkedThrough, keptOutPlan, markPlan, openingPlan, payoutGapViews, readCents,
  readDay, readText, refusalOfDbError, refusalOfStep, statusOfRefusal, tickPlan, undoPlan, type BankCheckEvent, type Decision,
} from './bank-club-rules';
import { BANK_REFUSAL, type BankRefusalCode } from './bank-check-words';

/**
 * THE CLUB'S BANK STEPS (Bank reconciliation R2b): what each route under app/api/admin/accounting/bank/** does, once its
 * gate (`resolveClubMoney`, B7) has passed. Every step reads the account fresh (lib/bank-club-read.ts), decides with
 * the pure rules (lib/bank-club-rules.ts) and the engine, and writes through mig 439's functions or one plain row. A write
 * answers with the account's view read again, so the screen shows the server's numbers, never its own (rule 6).
 * ⚖ No year, no season: nothing here reads either.
 */

/** The club's day: the end of the Stripe read, the fee's "today" (rule 6: the server's, never the request's). */
export const clubToday = () => tournamentToday();

const bankRefused = (status: number, code: BankRefusalCode): Refused =>
  refused(status, { error: BANK_REFUSAL[code], code });

/** A rules decision's refusal as the route's. */
const fromDecision = (d: Extract<Decision<object>, { ok: false }>): Refused => bankRefused(d.status, d.code);

/** A coded refusal at its own status. */
export const bankRefusedAs = (code: BankRefusalCode): Refused => bankRefused(statusOfRefusal(code), code);

/** One mig 439 step: its coded refusal, or its answer. */
async function step(fn: string, args: Record<string, unknown>): Promise<Moved<{ data: Record<string, unknown> }>> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) {
    const code = refusalOfDbError(error);
    if (code) return bankRefusedAs(code);
    throw error;
  }
  const r = data as { ok: boolean; code?: string } & Record<string, unknown>;
  return r.ok ? { ok: true, data: r } : bankRefusedAs(refusalOfStep(r.code));
}

// ── reads ────────────────────────────────────────────────────────────────────────────────────

/** Each account's latest checked statement end (the Account pill: "through Oct 31, 2026" / "not checked yet"). */
async function checkedThroughByAccount(accountIds: readonly string[]): Promise<Map<string, string>> {
  const rows = await fetchAllIn<{ bank_account_id: string; statement_end_date: string }>(accountIds, (c, a, b) =>
    supabaseAdmin.from('bank_checks').select('bank_account_id, statement_end_date').in('bank_account_id', c)
      .eq('status', 'checked').order('bank_account_id').order('statement_end_date').range(a, b));
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(r.bank_account_id) || r.statement_end_date > out.get(r.bank_account_id)!) out.set(r.bank_account_id, r.statement_end_date);
  return out;
}

/** GET /bank — the club's accounts (C1's "never done this", C10's pill) and every club book with the account holding it. */
export async function bankOverview(ctx: AuthContextWithRole) {
  const all = await readClubBankAccounts(ctx.org.id);
  const through = await checkedThroughByAccount(all.accounts.map(a => a.id));
  const books = [...all.accounts.flatMap(a => a.books), ...all.unplacedBooks];
  return {
    never: all.never,
    accounts: all.accounts.map(a => ({
      id: a.id, name: a.name, isFirst: a.isFirst, setup: a.setup, bookIds: a.books.map(b => b.id),
      checkedThrough: through.get(a.id) ?? null,
    })),
    books: books.map(b => ({ id: b.id, name: b.name, entityType: b.entityType, accountId: all.accountOfBook.get(b.id) ?? null })),
    canMove: canMoveClubMoney(ctx, ctx.org),
  };
}

async function eventsOf(orgId: string, checkIds: readonly string[]): Promise<BankCheckEvent[]> {
  const rows = await fetchAllIn<{ check_id: string; kind: BankCheckEvent['kind']; at: string; by_user: string | null; reason: string | null }>(
    checkIds, (c, a, b) => supabaseAdmin.from('bank_check_events').select('check_id, kind, at, by_user, reason')
      .in('check_id', c).order('at').order('id').range(a, b));
  const nameOf = await resolvePersonNamer(orgId, rows.map(r => r.by_user));
  return rows.map(r => ({ checkId: r.check_id, kind: r.kind, at: r.at, byName: nameOf(r.by_user), reason: r.reason }));
}

/**
 * GET /bank/accounts/{id} — one account: its statements (C4, C5), the one shown (C2/C3: band, ticks, outstanding, kept
 * out, left out automatically, payout gaps by reason, changed since), what can happen next, and the fee's date.
 */
export async function bankAccountView(ctx: AuthContextWithRole, accountId: string, askedCheck: string | null) {
  const today = clubToday();
  const read = await readClubBankAccount(ctx.org.id, accountId, { today });
  if (!read) return null;
  return viewOf(ctx, read, askedCheck, today);
}

async function viewOf(ctx: AuthContextWithRole, read: ClubBankRead, askedCheck: string | null, today: string) {
  const { state, account, all } = read;
  const [events, setting, through] = await Promise.all([
    eventsOf(ctx.org.id, state.checks.map(c => c.id)),
    loadFiscalSetting(ctx.org.id),
    checkedThroughByAccount(all.accounts.map(a => a.id)),
  ]);
  const summaries = checkSummaries(state, events);
  const shownId = state.setup ? checkToShow(state, askedCheck) : null;
  const shown = shownId ? evaluateCheck(state, shownId) : null;
  const shownRecord = shownId ? state.checks.find(c => c.id === shownId)! : null;
  const names = new Map([...all.accounts.flatMap(a => a.books), ...all.unplacedBooks].map(b => [b.id, b.name]));
  const last = orderedChecks(state).at(-1) ?? null;
  return {
    account: { id: account.id, name: account.name, isFirst: account.isFirst, setup: account.setup,
      books: account.books.map(b => ({ id: b.id, name: b.name, entityType: b.entityType })) },
    accounts: all.accounts.map(a => ({ id: a.id, name: a.name, isFirst: a.isFirst, checkedThrough: through.get(a.id) ?? null })),
    canMove: canMoveClubMoney(ctx, ctx.org),
    payoutsUnavailable: read.payoutsUnavailable,
    /** The starting point's items (C1 again, while no statement starts from it). */
    openingItems: state.openingItems ?? [],
    checks: summaries,
    checkedThrough: checkedThrough(summaries),
    /** The "Check a statement" window: where the next one starts, and whether one may start (every one checked). */
    next: state.setup ? {
      startsAfter: last ? last.statementEndDate : state.setup.openingDate,
      startingBalanceCents: last ? last.statementEndingBalanceCents : state.setup.openingBalanceCents,
      canStart: !state.checks.some(c => c.status === 'open'),
    } : null,
    shown: shown && shownRecord ? {
      ...shown,
      status: shownRecord.status,
      addedLineKeys: shownRecord.addedLineKeys ?? [],
      books: bookNames([...shown.ticked, ...shown.outstanding, ...shown.keptOut, ...shown.autoExcluded.map(a => a.row)], read.lineBooks, names),
      payoutGaps: payoutGapViews(shown, read.payoutGaps, read.payoutMembers),
      /** Ask 8: the fee's day — the statement's end, or today when that day is in a closed fiscal year. */
      feeDate: shownRecord.status === 'open'
        ? bankFeeDate({ statementEndDate: shown.statementEndDate, booksClosedThrough: closedThrough(setting), today }) : null,
    } : null,
  };
}

/** A write step's answer: its refusal, or the account read again. */
export async function bankAnswer(ctx: AuthContextWithRole, accountId: string, checkId: string | null,
  r: Moved<object>, status = 200): Promise<Response> {
  if (!r.ok) return moveRefused(r);
  const view = await bankAccountView(ctx, accountId, checkId);
  if (!view) return moveRefused(bankRefused(404, 'account_not_found'));
  return NextResponse.json(view, { status });
}

const PAGE = 50;

/**
 * GET /bank/lines-before — C1's "still outstanding then" picker: posted lines of the account's books (or, before the club
 * has an account, every club book) dated on or before the starting date, newest first, by words or amount, a page at a
 * time. The starting date is a DAY the treasurer typed, never a year.
 */
export async function linesBefore(ctx: AuthContextWithRole, p: { accountId: string | null; date: unknown; q: string; offset: number }):
  Promise<Moved<{ lines: unknown[]; more: boolean }>> {
  const day = readDay(p.date);
  if (!day) return bankRefused(400, 'bad_date');
  const all = await readClubBankAccounts(ctx.org.id);
  let books: { id: string; name: string }[];
  if (p.accountId) {
    const a = all.accounts.find(x => x.id === p.accountId);
    if (!a) return bankRefused(404, 'account_not_found');
    books = a.books;
  } else {
    books = all.never ? all.unplacedBooks : (all.accounts.find(a => a.isFirst)?.books ?? []);
  }
  if (books.length === 0) return { ok: true, lines: [], more: false };
  const names = new Map(books.map(b => [b.id, b.name]));
  let q = supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT)
    .in('ledger_id', books.map(b => b.id)).eq('status', 'posted').lte('entry_date', day);
  const words = p.q.trim().slice(0, 80);
  const amount = /^\$?\d{1,9}(\.\d{1,2})?$/.test(words) ? Number(words.replace('$', '')) : null;
  if (amount !== null) q = q.eq('amount', amount);
  else if (words) q = q.ilike('description', `%${words.replace(/[%_\\]/g, m => `\\${m}`)}%`);
  const offset = Math.max(0, Math.min(Number.isInteger(p.offset) ? p.offset : 0, 5000));
  const { data, error } = await q.order('entry_date', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + PAGE);
  if (error) throw error;
  const rows = (data ?? []) as EntryRow[];
  return {
    ok: true,
    more: rows.length > PAGE,
    lines: rows.slice(0, PAGE).map(r => ({
      key: `entry:${r.id}`, date: r.entry_date, description: r.description, bookName: names.get(r.ledger_id) ?? null,
      direction: directionOfEntry(r),
      amountCents: toCents(r.amount),
    })),
  };
}

// ── accounts and books ───────────────────────────────────────────────────────────────────────

/** POST /bank — name an account; a second one takes the books it names (C10, Ask 13). */
export async function addAccount(ctx: AuthContextWithRole, body: Record<string, unknown>): Promise<Moved<{ id: string }>> {
  const name = readText(body.name, 80);
  if (!name) return bankRefused(400, 'bad_name');
  const ledgers = Array.isArray(body.ledgerIds) ? body.ledgerIds : [];
  // A book id is a uuid, and a request names a handful: anything else is "no such book", never a database error.
  if (ledgers.length > 200 || !ledgers.every((x): x is string => typeof x === 'string' && isUuid(x))) return bankRefused(400, 'book_not_found');
  const r = await step('bank_account_add', { p_org: ctx.org.id, p_name: name, p_ledgers: ledgers, p_actor: ctx.user.id });
  return r.ok ? { ok: true, id: r.data.id as string } : r;
}

/** PATCH /bank/accounts/{id} — rename. */
export async function renameAccount(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const name = readText(body.name, 80);
  if (!name) return bankRefused(400, 'bad_name');
  const { data, error } = await supabaseAdmin.from('bank_accounts').update({ name })
    .eq('id', accountId).eq('org_id', ctx.org.id).eq('owner_kind', 'club').is('archived_at', null).select('id');
  if (error) {
    const code = refusalOfDbError(error);
    if (code) return bankRefusedAs(code);
    throw error;
  }
  return (data ?? []).length ? { ok: true } : bankRefused(404, 'account_not_found');
}

/** POST /bank/accounts/{id}/books — move a club book's money into this account (Ask 13). */
export async function moveBook(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const ledgerId = typeof body.ledgerId === 'string' ? body.ledgerId : '';
  if (!isUuid(ledgerId)) return bankRefused(400, 'book_not_found');
  const r = await step('bank_book_move', { p_org: ctx.org.id, p_ledger: ledgerId, p_to: accountId, p_actor: ctx.user.id });
  return r.ok ? { ok: true } : r;
}

/**
 * PUT /bank/accounts/{id}/setup — the starting date, the bank balance then, and what was still outstanding (C1, Ask 3).
 * Refused once a statement exists (rule 2). A picked item's figures are read here from the book (rule 6).
 */
export async function setUpAccount(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const openingDate = readDay(body.openingDate);
  const balance = readCents(body.openingBalanceCents, { positive: false });
  if (!openingDate || balance === null) return bankRefused(400, 'bad_start');
  if (openingDate > clubToday()) return bankRefusedAs('starts_in_future');
  const keys = Array.isArray(body.picked) ? body.picked.filter((k): k is string => typeof k === 'string') : [];
  // Only uuids are looked up (a malformed one is simply not found, and `openingPlan` refuses it); the plan caps the count at 500.
  const ids = keys.map(k => (k.startsWith('entry:') ? k.slice(6) : '')).filter(isUuid).slice(0, 501);
  // The picked lines come from the request alone, so their read need not wait for the account's.
  const [all, rows] = await Promise.all([
    readClubBankAccounts(ctx.org.id),
    fetchAllIn<EntryRow>(ids, (c, a, b) =>
      supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT).in('id', c).order('id').range(a, b)),
  ]);
  const account = all.accounts.find(a => a.id === accountId);
  if (!account) return bankRefused(404, 'account_not_found');
  const plan = openingPlan({ openingDate, pickedKeys: body.picked, typed: body.typed, rows, books: new Set(account.books.map(b => b.id)) });
  if (!plan.ok) return fromDecision(plan);
  const r = await step('bank_account_set_up', {
    p_org: ctx.org.id, p_account: accountId, p_opening_date: openingDate, p_opening_balance_cents: balance,
    p_picked: plan.picked, p_typed: plan.typed, p_actor: ctx.user.id,
  });
  return r.ok ? { ok: true } : r;
}

// ── a statement ──────────────────────────────────────────────────────────────────────────────

/** POST /bank/accounts/{id}/checks — start a statement, in order (`canStartCheck`, held under mig 439's lock). */
export async function startCheck(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<{ id: string }>> {
  const end = readDay(body.statementEndDate);
  const balance = readCents(body.statementEndingBalanceCents, { positive: false });
  if (!end || balance === null) return bankRefused(400, 'bad_figures');
  // A bank can't have printed a statement that ends after today (a typo; its fee would be dated in the future too).
  if (end > clubToday()) return bankRefusedAs('ends_in_future');
  const r = await step('bank_check_start', { p_org: ctx.org.id, p_account: accountId, p_end: end, p_balance_cents: balance, p_actor: ctx.user.id });
  return r.ok ? { ok: true, id: r.data.id as string } : r;
}

/** PATCH /bank/accounts/{id}/checks/{checkId} — correct an OPEN statement's figures ("Undo, then re-enter", rule 2). */
export async function refigureCheck(ctx: AuthContextWithRole, accountId: string, checkId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const end = readDay(body.statementEndDate);
  const balance = readCents(body.statementEndingBalanceCents, { positive: false });
  if (!end || balance === null) return bankRefused(400, 'bad_figures');
  // A bank can't have printed a statement that ends after today (a typo; its fee would be dated in the future too).
  if (end > clubToday()) return bankRefusedAs('ends_in_future');
  const r = await step('bank_check_refigure', { p_org: ctx.org.id, p_account: accountId, p_check: checkId, p_end: end, p_balance_cents: balance });
  return r.ok ? { ok: true } : r;
}

/** The account read for a write, or its refusal. */
export async function readFor(ctx: AuthContextWithRole, accountId: string): Promise<Moved<{ read: ClubBankRead }>> {
  const read = await readClubBankAccount(ctx.org.id, accountId, { today: clubToday() });
  if (!read) return bankRefused(404, 'account_not_found');
  if (!read.state.setup) return bankRefused(409, 'not_set_up');
  return { ok: true, read };
}

/** POST /bank/accounts/{id}/checks/{checkId}/ticks — tick or untick one row (rule 3: a payout with its members). */
export async function tickRow(ctx: AuthContextWithRole, accountId: string, checkId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const key = typeof body.key === 'string' ? body.key : '';
  const tick = body.ticked !== false;
  const got = await readFor(ctx, accountId);
  if (!got.ok) return got;
  const plan = tickPlan(got.read.state, checkId, key, tick);
  if (!plan.ok) return fromDecision(plan);
  if (plan.remove.length) {
    const { error } = await supabaseAdmin.from('bank_check_marks').delete()
      .eq('bank_account_id', accountId).eq('check_id', checkId).in('line_key', plan.remove);
    if (error) throw error;
  }
  if (plan.insert.length) {
    // One statement, so the payout and its members land together or not at all (rule 3).
    const { error } = await supabaseAdmin.from('bank_check_marks').insert(plan.insert.map(m => ({
      bank_account_id: accountId, check_id: checkId, line_key: m.key, line_date: m.date, direction: m.direction,
      amount_cents: m.amountCents, payout_key: m.payoutKey ?? null, marked_by: ctx.user.id,
    })));
    if (error) {
      if (error.code !== '23505') throw error;
      // A unique clash: either a double tap raced its twin (every row of this tick is now ticked on THIS statement: fine), or
      // one of the rows was ticked somewhere else a moment ago and the whole insert was refused. That one is not a success.
      const { data: now, error: readError } = await supabaseAdmin.from('bank_check_marks').select('line_key')
        .eq('bank_account_id', accountId).eq('check_id', checkId).in('line_key', plan.insert.map(m => m.key));
      if (readError) throw readError;
      if ((now ?? []).length !== plan.insert.length) return bankRefusedAs('changed');
    }
  }
  return { ok: true };
}

/** POST /bank/accounts/{id}/checks/{checkId}/kept-out — "Didn't go through the bank" / "Put it back" (B6). */
export async function keepOut(ctx: AuthContextWithRole, accountId: string, checkId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const key = typeof body.key === 'string' ? body.key : '';
  const keptOut = body.keptOut !== false;
  const got = await readFor(ctx, accountId);
  if (!got.ok) return got;
  const plan = keptOutPlan(got.read.state, checkId, key, keptOut);
  if (!plan.ok) return fromDecision(plan);
  if (plan.noop) return { ok: true };
  if (keptOut) {
    const { error } = await supabaseAdmin.from('bank_line_exclusions').insert({ bank_account_id: accountId, line_key: key, excluded_by: ctx.user.id });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabaseAdmin.from('bank_line_exclusions').delete().eq('bank_account_id', accountId).eq('line_key', key);
    if (error) throw error;
  }
  return { ok: true };
}

/** POST /bank/accounts/{id}/checks/{checkId}/mark — Mark checked, or (`again`) Mark checked again. One step (mig 439). */
export async function markCheck(ctx: AuthContextWithRole, accountId: string, checkId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const again = body.again === true;
  const got = await readFor(ctx, accountId);
  if (!got.ok) return got;
  const plan = markPlan(got.read.state, checkId, again);
  if (!plan.ok) return fromDecision(plan);
  const r = await step('bank_check_mark', {
    p_org: ctx.org.id, p_account: accountId, p_check: checkId, p_kind: again ? 'checked_again' : 'checked', p_seen: plan.seen,
    p_snapshot: plan.outstandingSnapshot, p_marks: plan.marks, p_actor: ctx.user.id,
  });
  return r.ok ? { ok: true } : r;
}

/** POST /bank/accounts/{id}/checks/{checkId}/undo — the latest checked statement, with a reason (Ask 9). */
export async function undoCheck(ctx: AuthContextWithRole, accountId: string, checkId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const got = await readFor(ctx, accountId);
  if (!got.ok) return got;
  const plan = undoPlan(got.read.state, checkId, body.reason);
  if (!plan.ok) return fromDecision(plan);
  const r = await step('bank_check_undo', { p_org: ctx.org.id, p_account: accountId, p_check: checkId, p_reason: plan.reason, p_actor: ctx.user.id });
  return r.ok ? { ok: true } : r;
}

/** A path id that isn't a uuid is "not found" before the database sees it (a 22P02 would be a 500). */
export function badBankIds(ids: { accountId?: string; checkId?: string }): Response | null {
  if (ids.accountId !== undefined && !isUuid(ids.accountId)) return moveRefused(bankRefused(404, 'account_not_found'));
  if (ids.checkId !== undefined && !isUuid(ids.checkId)) return moveRefused(bankRefused(404, 'check_not_found'));
  return null;
}
