import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';
import type { Moved } from './club-money-route';
import { closedYearFromError, isClosedYearError, loadFiscalSetting, refuseIfClosedFor } from './club-fiscal-year-server';
import { closedThrough } from './club-fiscal-year';
import { readFiledUnder } from './club-budget-writes';
import { formatStoredDate } from './timezone';
import { isUuid } from './utils';
import { bankFeeDate, evaluateCheck } from './bank-check';
import { payoutGapViews, readCents, readDay, readText, refusalOfDbError, refusalOfStep } from './bank-club-rules';
import { bankRefusedAs, clubToday, readFor } from './bank-club-steps';
import { BANK_LINE_WORDS } from './bank-check-words';

/**
 * ADD A BANK FEE, INTEREST OR PAYMENT PROCESSING FROM A STATEMENT (Bank reconciliation R2b; B5 amended by Ask 1, Asks 7
 * and 8). Thin: it decides the book, the budget word, the day and the amount, and mig 439's `bank_check_add_line` writes
 * the ONE real club-book line, records it as added from this statement and ticks it there — together, so no line is ever
 * left in a book without its tick (one database step instead of "write, then void it if the tick fails").
 *
 * ⚖ The book is the ACCOUNT's own (Ask 1: General for Club chequing, the Gaming book for a Gaming account); the request
 *   may name another of the account's books, never one outside it, never a team's (`TEAM_BOOK_READ_ONLY`, refused there).
 * ⚖ The day is `bankFeeDate` (the statement's end, or today when that day is in a closed fiscal year); the treasurer may
 *   name another day, and the year lock is still the floor (`refuseIfClosedFor`, then the database's `year_closed`). A
 *   re-dated line still ticks on the statement it was added from (Ask 8).
 * ⚖ A payout's "Payment processing" line is the SERVER's figure (rule 6): offered only for a gap that is a fee — never a
 *   held dispute, never activity that isn't from FieldLogicHQ (P4), never while a member line is void or in another
 *   account's book. It is filed under the standard "Bank & payment fees" word: the club's own "Payment processing"
 *   words each belong to one program (a house-league season, a tournament), so none fits a General-book line.
 */

type Kind = 'bank_fee' | 'interest' | 'payment_processing';
const KINDS: readonly Kind[] = ['bank_fee', 'interest', 'payment_processing'];

/** The standard word a line is filed under: the club's own copy first, else the platform library's. Never refused for a word. */
const WORD: Record<Kind, { name: string; direction: 'in' | 'out' }> = {
  bank_fee: { name: 'Bank & payment fees', direction: 'out' },
  interest: { name: 'Interest', direction: 'in' },
  payment_processing: { name: 'Bank & payment fees', direction: 'out' },
};

/** The book entry type a kind is written as (one derivation, from the word's own direction). */
const entryTypeOf = (kind: Kind): 'income' | 'expense' => (WORD[kind].direction === 'in' ? 'income' : 'expense');

async function filedUnder(orgId: string, kind: Kind): Promise<{ categoryId: string; itemId: string } | null> {
  const w = WORD[kind];
  const { data, error } = await supabaseAdmin.from('budget_items').select('id, org_id')
    .eq('name', w.name).eq('direction', w.direction).is('team_id', null)
    .or(`org_id.eq.${orgId},org_id.is.null`).order('org_id', { ascending: true, nullsFirst: false }).limit(2);
  if (error) throw error;
  const pick = (data ?? []).find(r => r.org_id === orgId) ?? (data ?? [])[0];
  if (!pick) return null;
  const word = await readFiledUnder(orgId, pick.id, entryTypeOf(kind));
  return word.ok ? word.value : null;
}

export async function addBankLine(ctx: AuthContextWithRole, accountId: string, checkId: string, body: Record<string, unknown>):
  Promise<Moved<{ key: string; redated: boolean }>> {
  const kind = KINDS.find(k => k === body.kind);
  if (!kind) return bankRefusedAs('bad_kind');
  const got = await readFor(ctx, accountId);
  if (!got.ok) return got;
  const { read } = got;
  const check = read.state.checks.find(c => c.id === checkId);
  if (!check) return bankRefusedAs('check_not_found');
  if (check.status !== 'open') return bankRefusedAs('not_open');

  // The book: one of this account's own, its first by default (Ask 1). mig 439 re-checks and refuses a team's book.
  const named = typeof body.ledgerId === 'string' && body.ledgerId ? body.ledgerId : null;
  if (named && !isUuid(named)) return bankRefusedAs('book_not_in_account'); // not a book id at all: never a database error
  const ledgerId = named ?? read.account.books[0]?.id;
  if (!ledgerId) return bankRefusedAs('book_not_in_account');

  let amountCents: number | null;
  let description: string | null = readText(body.description, 500);
  // The payout whose gap a payment-processing line closes: written on the line's tick so the line rides that payout's book
  // side (mig 439), instead of being a second thing counted beside the gap.
  let forPayout: string | null = null;
  if (kind === 'payment_processing') {
    if (read.payoutsUnavailable) return bankRefusedAs('payouts_unavailable');
    const payoutKey = typeof body.payoutKey === 'string' ? body.payoutKey : '';
    const view = payoutGapViews(evaluateCheck(read.state, checkId), read.payoutGaps, read.payoutMembers)[payoutKey];
    if (!view) return bankRefusedAs('not_outstanding');
    if (!view.offerPaymentProcessing) {
      return bankRefusedAs(view.stripeFeeCents + view.otherCents < 0 ? 'gap_not_a_fee' : 'no_processing_gap');
    }
    amountCents = view.processingCents;
    forPayout = payoutKey;
    const payout = read.state.payouts?.find(p => p.key === payoutKey);
    description ??= BANK_LINE_WORDS.processingFor(`Stripe payout, ${formatStoredDate(payout?.arrivalDate)}`);
  } else {
    amountCents = readCents(body.amountCents, { positive: true });
    if (amountCents === null) return bankRefusedAs('bad_amount');
    description ??= BANK_LINE_WORDS[kind];
  }

  let day: string;
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    const d = readDay(body.date);
    // A bank line is dated on a day that has happened: a statement can't end in the future, so neither can its fee.
    if (!d || d > clubToday()) return bankRefusedAs('bad_date');
    day = d;
  } else {
    day = bankFeeDate({
      statementEndDate: check.statementEndDate, booksClosedThrough: closedThrough(await loadFiscalSetting(ctx.org.id)), today: clubToday(),
    }).date;
  }
  // ⚖ The fiscal-year lock, in words first (the screen offers today's date from this refusal).
  const closed = await refuseIfClosedFor(ctx.org.id, [day], 'date');
  if (closed) return closed;

  const word = await filedUnder(ctx.org.id, kind);
  const { data, error } = await supabaseAdmin.rpc('bank_check_add_line', {
    p_org: ctx.org.id, p_account: accountId, p_check: checkId, p_ledger: ledgerId, p_kind: kind,
    p_entry_type: entryTypeOf(kind), p_day: day, p_description: description,
    p_amount_cents: amountCents, p_category: word?.categoryId ?? null, p_item: word?.itemId ?? null, p_actor: ctx.user.id,
    p_payout_key: forPayout,
  });
  if (error) {
    // A close that raced this write: the database's floor, answered the same way.
    if (isClosedYearError(error)) return closedYearFromError(ctx.org.id, [day]);
    const code = refusalOfDbError(error);
    if (code) return bankRefusedAs(code);
    throw error;
  }
  const r = data as { ok: boolean; code?: string; key?: string };
  if (!r.ok) return bankRefusedAs(refusalOfStep(r.code));
  return { ok: true, key: r.key!, redated: day !== check.statementEndDate };
}
