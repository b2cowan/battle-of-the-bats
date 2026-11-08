import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import { canMoveClubMoney } from './member-access';
import { loadFiscalSetting } from './club-fiscal-year-server';
import { moveRefused, refused, type Moved, type Refused } from './club-money-route';
import { tournamentToday } from './timezone';
import { isUuid } from './utils';
import { entriesById, figureForDate, readClubBankAccount, readClubBankAccounts, readClubBankMarksQuietly, readClubChecks } from './bank-club-read';
import { bookIdsOf, type ClubBook } from './bank-club-map';
import {
  checkView, checkedThrough, readDay, readText, refusalOfDbError, refusalOfStep, savePlan, saveRefusal, startItemIdOf, startItemPlan,
  statusOfRefusal, waitingIdsOf,
} from './bank-club-rules';
import { BANK_REFUSAL, type BankRefusalCode } from './bank-check-words';

/**
 * THE CLUB'S BANK STEPS (Bank balance check BC1): what each route under app/api/admin/accounting/bank/** does, once its
 * gate (`resolveClubMoney`, B7) has passed. Every step reads the account fresh (lib/bank-club-read.ts), decides with the
 * pure rules (lib/bank-club-rules.ts) and the engine, and writes through mig 447's functions, or, for a rename, one plain
 * row. A write answers with the account's view read again, so the screen shows the server's numbers (rule 6).
 * ⚖ Nothing here writes money (ask 1): no step touches `accounting_entries` or a rep money table.
 * ⚖ No year, no season: nothing here reads either. A statement date is a DAY.
 */

/** The club's day: the latest statement date a save takes, and the Stripe read's end (rule 6: the server's). */
export const clubToday = () => tournamentToday();

/** A coded refusal, at the one status the code has (`STATUS_OF`), with its words. */
export const bankRefusedAs = (code: BankRefusalCode): Refused =>
  refused(statusOfRefusal(code), { error: BANK_REFUSAL[code], code });

/**
 * A write request's JSON body as an object. A body that is not one (a JSON `null`, an array, a number, text that isn't JSON)
 * is an EMPTY one, so the step answers its own coded refusal (`bad_name`, `bad_figures`…) rather than a 500 on `null.name`.
 */
export async function bankBody(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

/** One mig 447 step: its coded refusal, or its answer. `as` re-words a code for this step's own door (one place for it).
 *  Shared with the team's steps (lib/bank-coach-steps.ts, BC6b): the same functions, the same refusal shape. */
export async function step(fn: string, args: Record<string, unknown>, as: Partial<Record<BankRefusalCode, BankRefusalCode>> = {}):
  Promise<Moved<{ data: Record<string, unknown> }>> {
  const refuse = (code: BankRefusalCode) => bankRefusedAs(as[code] ?? code);
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error) {
    const code = refusalOfDbError(error);
    if (code) return refuse(code);
    throw error;
  }
  const r = data as { ok: boolean; code?: string } & Record<string, unknown>;
  return r.ok ? { ok: true, data: r } : refuse(refusalOfStep(r.code));
}

// ── reads ────────────────────────────────────────────────────────────────────────────────────

/** GET /bank — the club's accounts ("never done this" when none) and every club book with the account holding it. (Each
 *  account's latest check is the account view's: the Account pill reads it there.) */
export async function bankOverview(ctx: AuthContextWithRole) {
  const all = await readClubBankAccounts(ctx.org.id);
  return {
    never: all.never,
    accounts: all.accounts.map(a => ({ id: a.id, name: a.name })),
    books: allBooks(all).map(b => ({ id: b.id, name: b.name, accountId: all.accountOfBook.get(b.id) ?? null })),
    canMove: canMoveClubMoney(ctx, ctx.org),
  };
}

/**
 * The Accounting Overview's bank line (BC5a; ask 4, R0 tab 7; owner 2026-11-06 "Overview accounts" / "Overview past
 * year"): each live account's latest check, as TODAY reads it — never a year, as "Where the club stands" beside it is
 * today on every year the Year pill shows. `never` + `canMove` decide the no-account state (a reader sees no line: the
 * Bank tab would only tell them to ask the treasurer). Read by GET /api/admin/accounting/summary, behind its gate.
 * Null when the bank couldn't be read: the line is left out, the Overview still loads (/review BC5a).
 */
export async function bankMarks(ctx: AuthContextWithRole) {
  const marks = await readClubBankMarksQuietly(ctx.org.id);
  if (!marks) return null;
  return {
    never: marks.never,
    canMove: canMoveClubMoney(ctx, ctx.org),
    accounts: marks.accounts.map(a => ({ id: a.id, name: a.name, checkedThrough: checkedThrough(a.checks) })),
  };
}

const allBooks = (all: { accounts: { books: ClubBook[] }[]; unplacedBooks: ClubBook[] }) =>
  [...all.accounts.flatMap(a => a.books), ...all.unplacedBooks];

/**
 * GET /bank/accounts/{id}[?date=] — one account: its books, the starting statement, the saved checks newest first (each
 * with its band, result and "Books now say"), the Account pill's accounts with their latest check, and with `date` the
 * figure for that day (Your books, on its way, suspects, Still waiting?), from which the screen figures the band as the
 * balance is typed.
 */
export async function bankAccountView(ctx: AuthContextWithRole, accountId: string, date: string | null, asked?: 'start' | 'check') {
  const canMove = canMoveClubMoney(ctx, ctx.org);
  // The club's fiscal years, for a writer only: "+ Add entry" and "Add the missing entry" open the Ledger's add window, which warns under
  // the date when it falls in a closed year (the Ledger page hands it the same setting, its closers left out).
  const [read, setting] = await Promise.all([
    readClubBankAccount(ctx.org.id, accountId, { today: clubToday(), date, asked }),
    // (Not on a day's figure read: the form keeps the account read it was given.)
    canMove && date === null ? loadFiscalSetting(ctx.org.id) : Promise.resolve(null),
  ]);
  if (!read) return null;
  const { account, all, checks, latest, figure, nameOf, roleOf } = read;
  const bookName = new Map(allBooks(all).map(b => [b.id, b.name]));
  // The printed report (BC5b): who checked, with their role as it reads today, and the books this check covered — its OWN
  // saved books, by name (a book moved to another account since is still named; one gone is left out).
  const views = checks.map(c => ({
    ...checkView(c, nameOf), checkedByRole: roleOf(c.createdBy),
    bookNames: c.bookIds.map(id => bookName.get(id)).filter((n): n is string => !!n),
  }));
  const named = <L extends { bookId: string }>(lines: L[]) => lines.map(l => ({ ...l, bookName: bookName.get(l.bookId) ?? null }));
  return {
    // A book's kind and owner: "+ Add entry" and "Add the missing entry" open the Ledger's own add window on it (BC3b, WD1).
    account: { id: account.id, name: account.name, isFirst: account.isFirst,
      books: account.books.map(b => ({ id: b.id, name: b.name, kind: b.entityType, entityId: b.entityId })) },
    accounts: all.accounts.map(a => ({ id: a.id, name: a.name, isFirst: a.isFirst, checkedThrough: latest.get(a.id) ?? null })),
    canMove,
    fiscal: setting ? { firstMonth: setting.firstMonth, rows: setting.rows.map(r => ({ ...r, closedBy: null, closingBalance: null })) } : null,
    start: views.find(v => v.kind === 'start') ?? null,
    checks: views.filter(v => v.kind === 'check').reverse(),
    checkedThrough: latest.get(account.id) ?? null,
    figure: figure ? {
      ...figure,
      suspects: { ...figure.suspects, lines: named(figure.suspects.lines) },
      beforeStart: figure.beforeStart ? { ...figure.beforeStart, lines: named(figure.beforeStart.lines) } : null,
      onItsWay: { ...figure.onItsWay, lines: named(figure.onItsWay.lines) },
    } : null,
  };
}

/** A write step's answer: its refusal, or the account read again. */
export async function bankAnswer(ctx: AuthContextWithRole, accountId: string, r: Moved<object>, status = 200): Promise<Response> {
  if (!r.ok) return moveRefused(r);
  const view = await bankAccountView(ctx, accountId, null);
  if (!view) return moveRefused(bankRefusedAs('account_not_found'));
  return NextResponse.json(view, { status });
}

// ── accounts and books ───────────────────────────────────────────────────────────────────────

/** POST /bank — name an account; a second one takes the books it names (R0 tab 8). */
export async function addAccount(ctx: AuthContextWithRole, body: Record<string, unknown>): Promise<Moved<{ id: string }>> {
  const name = readText(body.name, 80);
  if (!name) return bankRefusedAs('bad_name');
  const ledgers = Array.isArray(body.ledgerIds) ? body.ledgerIds : [];
  // A book id is a uuid, and a request names a handful: anything else is "no such book", never a database error.
  if (ledgers.length > 200 || !ledgers.every((x): x is string => typeof x === 'string' && isUuid(x))) return bankRefusedAs('book_not_found');
  const r = await step('bank_account_add', { p_org: ctx.org.id, p_name: name, p_ledgers: ledgers, p_actor: ctx.user.id });
  return r.ok ? { ok: true, id: r.data.id as string } : r;
}

/** PATCH /bank/accounts/{id} — rename. */
export async function renameAccount(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const name = readText(body.name, 80);
  if (!name) return bankRefusedAs('bad_name');
  const { data, error } = await supabaseAdmin.from('bank_accounts').update({ name })
    .eq('id', accountId).eq('org_id', ctx.org.id).eq('owner_kind', 'club').is('archived_at', null).select('id');
  if (error) {
    const code = refusalOfDbError(error);
    if (code) return bankRefusedAs(code);
    throw error;
  }
  return (data ?? []).length ? { ok: true } : bankRefusedAs('account_not_found');
}

/** POST /bank/accounts/{id}/books — move a club book's money into this account. Saved checks keep the books they counted
 *  (Q3); the next check of each account counts the book where it is now. */
export async function moveBook(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const ledgerId = typeof body.ledgerId === 'string' ? body.ledgerId : '';
  if (!isUuid(ledgerId)) return bankRefusedAs('book_not_found');
  const r = await step('bank_book_move', { p_org: ctx.org.id, p_ledger: ledgerId, p_to: accountId, p_actor: ctx.user.id });
  return r.ok ? { ok: true } : r;
}

// ── a check ──────────────────────────────────────────────────────────────────────────────────

/**
 * PUT /bank/accounts/{id}/setup (`asked: 'start'`) — the starting statement (ask 7): a date and a balance, and (Q2) the
 * lines waiting at the start. POST /bank/accounts/{id}/checks (`asked: 'check'`) — save a check (ruling 3: matching or
 * not), with its Not in the bank yet lines and the cash figure. Both: one step (`bank_check_save`), which replaces a live
 * check of the same date ("Check this statement again").
 */
export async function saveCheck(ctx: AuthContextWithRole, accountId: string, asked: 'start' | 'check',
  body: Record<string, unknown>): Promise<Moved<{ id: string }>> {
  const date = readDay(body.date);
  if (!date) return bankRefusedAs('bad_figures');
  const today = clubToday();
  // The waiting lines' rows are named by the request alone, so their read need not wait for the account's.
  const [all, byAccount, entries] = await Promise.all([
    readClubBankAccounts(ctx.org.id), readClubChecks(ctx.org.id), entriesById(waitingIdsOf(body.waiting)),
  ]);
  const account = all.accounts.find(a => a.id === accountId);
  if (!account) return bankRefusedAs('account_not_found');
  const checks = byAccount.get(accountId) ?? [];
  // The date rules first (the step holds them again under the lock): a refused save reads no figure.
  const refusal = saveRefusal({ asked, date, today, checks });
  if (refusal) return bankRefusedAs(refusal);
  const figure = await figureForDate(ctx.org.id, account, checks, date, today, { kind: asked, suspects: false });
  const start = checks.find(c => c.kind === 'start') ?? null;
  const plan = savePlan({
    kind: asked, date, body, entries,
    facts: { booksCents: figure.booksCents, onItsWay: figure.onItsWay, bookIds: bookIdsOf(account.books),
      startDate: start?.date ?? null, startWaiting: start?.waiting.map(w => w.key) ?? [] },
  });
  if (!plan.ok) return bankRefusedAs(plan.code);
  // ⚖ STRIPE DIDN'T ANSWER = WARN, NEVER BLOCK (owner 2026-11-06), decided HERE (BC2 review): the save reads Stripe again,
  // so Stripe failing between the screen's read and this one must not save a "not counted" the treasurer never saw. The
  // body's `anyway` is the treasurer's choice after reading the notice ("Start anyway", or a check shown not counted).
  if (figure.onItsWay.state === 'not_counted' && body.anyway !== true) {
    return bankRefusedAs(figure.onItsWay.reason === 'stripe_down' ? 'not_counted_down' : 'not_counted_unlisted');
  }
  const a = plan.args;
  // The start this figure was worked from (BC2 review, mig 449): the step refuses `changed` if it was replaced or
  // corrected since, so a check can't save the old start's books. A start names the start it replaces (none: null).
  const r = await step('bank_check_save', {
    p_org: ctx.org.id, p_account: accountId, p_kind: a.kind, p_date: a.date, p_bank_cents: a.bankCents,
    p_books_cents: a.booksCents, p_on_its_way_cents: a.onItsWayCents, p_cash_cents: a.cashCents, p_book_ids: a.bookIds,
    p_waiting: a.waiting, p_start: start?.id ?? null, p_start_books: start?.booksCents ?? null, p_actor: ctx.user.id,
  });
  return r.ok ? { ok: true, id: r.data.id as string } : r;
}

/**
 * PATCH /bank/accounts/{id}/setup — correct the starting statement (Q2-A, "Waiting at the start"): `{ add: 'entry:{id}' }`
 * puts a line written before the start and cleared after it on the start; `{ remove: 'entry:{id}' }` takes one off. The
 * start's books move by exactly that line (`startItemPlan`); saved later checks keep their figures and read "Books now
 * say" (ruling "Q2 + ask 6"). One step (`bank_start_waiting`), compare-and-swap on the start this read.
 */
export async function correctStart(ctx: AuthContextWithRole, accountId: string, body: Record<string, unknown>): Promise<Moved<object>> {
  const id = startItemIdOf(body);
  const [all, byAccount, line] = await Promise.all([
    readClubBankAccounts(ctx.org.id), readClubChecks(ctx.org.id), id ? entriesById([id]) : Promise.resolve([]),
  ]);
  const account = all.accounts.find(a => a.id === accountId);
  if (!account) return bankRefusedAs('account_not_found');
  // A transfer's other half decides whether it nets to nothing in this account.
  const pairId = line[0]?.linked_entry_id;
  const entries = pairId && isUuid(pairId) ? [...line, ...await entriesById([pairId])] : line;
  const plan = startItemPlan({
    body, start: (byAccount.get(accountId) ?? []).find(c => c.kind === 'start') ?? null, bookIds: bookIdsOf(account.books), entries,
  });
  if (!plan.ok) return bankRefusedAs(plan.code);
  const a = plan.args;
  const r = await step('bank_start_waiting', {
    p_org: ctx.org.id, p_account: accountId, p_start: a.startId, p_books_before: a.booksBefore, p_books_after: a.booksAfter,
    p_add: a.add, p_remove: a.remove, p_actor: ctx.user.id,
    // The step's `bad_item` on an add (a line put on the start twice in the same instant: bank_check_waiting_once) is
    // the start's refusal, in the start's words.
  }, a.add ? { bad_item: 'bad_start_item' } : {});
  return r.ok ? { ok: true } : r;
}

/** DELETE /bank/accounts/{id}/checks/{checkId} — ask 5: any check, after one question; who and when are kept (soft). The
 *  starting statement can't go while a later check stands on it (`start_has_checks`). */
export async function deleteCheck(ctx: AuthContextWithRole, accountId: string, checkId: string): Promise<Moved<object>> {
  // A CLUB account's check only (BC2 review): the step keys on the org and the account, and a team's account (BC6) is in
  // the same org — the club's door never reaches it.
  const all = await readClubBankAccounts(ctx.org.id);
  if (!all.accounts.some(a => a.id === accountId)) return bankRefusedAs('account_not_found');
  const r = await step('bank_check_delete', { p_org: ctx.org.id, p_account: accountId, p_check: checkId, p_actor: ctx.user.id });
  return r.ok ? { ok: true } : r;
}

/** A path id that isn't a uuid is "not found" before the database sees it (a 22P02 would be a 500). */
export function badBankIds(ids: { accountId?: string; checkId?: string }): Response | null {
  if (ids.accountId !== undefined && !isUuid(ids.accountId)) return moveRefused(bankRefusedAs('account_not_found'));
  if (ids.checkId !== undefined && !isUuid(ids.checkId)) return moveRefused(bankRefusedAs('check_not_found'));
  return null;
}
