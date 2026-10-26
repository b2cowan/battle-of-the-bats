import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import type { LeagueMoneyLine } from './league-money';
import { hasModuleEntitlement, type EntitlementOrg } from './module-entitlements';

/** Does this club file its house-league fees on the Budget vs. Actual Statement? The Club plan does (it carries the club's
 *  Accounting); on League Plus the season's Money page is the book (Q15). A page-wording fact, never a gate. */
export const filesToClubStatement = (org: EntitlementOrg): boolean => hasModuleEntitlement(org, 'module_accounting');

/**
 * A house-league registration's book lines, read one way (Club Tier 9b-2). Every line the one writer writes carries
 * source 'league_registration' + the registration id (mig 368); money in is 'income', money out (a refund) 'expense'.
 * The rules that turn lines into a fee and a band are lib/league-money.ts.
 */
const SELECT = 'id, source_entity_id, entry_type, amount, entry_date, payment_method, status, notes, void_reason, created_at, category';

function toLine(r: Record<string, unknown>): LeagueMoneyLine | null {
  if (r.entry_type !== 'income' && r.entry_type !== 'expense') return null;
  return {
    id: r.id as string,
    regId: r.source_entity_id as string,
    dir: r.entry_type === 'income' ? 'in' : 'out',
    amount: Number(r.amount),
    day: r.entry_date as string,
    method: (r.payment_method as string | null) ?? null,
    status: r.status as LeagueMoneyLine['status'],
    note: ((r.status === 'void' ? r.void_reason : r.notes) as string | null) ?? null,
    createdAt: r.created_at as string,
    // 12c Part 6 (mig 387): a bank debit reversed after it cleared — the bank's line, not a refund.
    ...(r.category === 'registration_returned' ? { returned: true } : {}),
  };
}

/** Stage 12b: a card payment's line carries its receipt number — the line is the one an online payment's child
 *  became (`online_payment_items.entry_id`). One read for every card line in the map, none when there are none. */
async function withReceipts(map: Map<string, LeagueMoneyLine[]>): Promise<Map<string, LeagueMoneyLine[]>> {
  const card = [...map.values()].flat().filter(l => l.method === 'online_card' || l.method === 'online_bank');
  if (!card.length) return map;
  const items = await fetchAllIn<Record<string, unknown>>(card.map(l => l.id), (chunk, from, to) =>
    supabaseAdmin.from('online_payment_items').select('id, entry_id, online_payments(receipt_no)').in('entry_id', chunk).order('id').range(from, to));
  const receipt = new Map<string, number | null>();
  for (const i of items) {
    const op = i.online_payments as { receipt_no: number | null } | { receipt_no: number | null }[] | null;
    receipt.set(i.entry_id as string, (Array.isArray(op) ? op[0]?.receipt_no : op?.receipt_no) ?? null);
  }
  for (const l of card) l.receiptNo = receipt.get(l.id) ?? null;
  return map;
}

function group(rows: Record<string, unknown>[]): Map<string, LeagueMoneyLine[]> {
  const out = new Map<string, LeagueMoneyLine[]>();
  for (const r of rows) {
    const l = toLine(r);
    if (!l) continue;
    const list = out.get(l.regId);
    if (list) list.push(l); else out.set(l.regId, [l]);
  }
  return out;
}

/** Every line of a season's registrations, by registration (the season's own book). Empty when it has no book yet. */
export async function loadSeasonMoneyLines(orgId: string, seasonId: string): Promise<Map<string, LeagueMoneyLine[]>> {
  const { data: book, error: bookError } = await supabaseAdmin.from('accounting_ledgers').select('id')
    .eq('org_id', orgId).eq('entity_type', 'league_season').eq('entity_id', seasonId).maybeSingle();
  if (bookError) throw bookError;
  if (!book) return new Map();
  return withReceipts(group(await fetchAll<Record<string, unknown>>((from, to) => supabaseAdmin.from('accounting_entries').select(SELECT)
    .eq('ledger_id', book.id).eq('source_module', 'league_registration')
    .order('entry_date', { ascending: true }).order('created_at', { ascending: true }).order('id').range(from, to))));
}

/** What each of an org's house-league registrations has received (posted in − posted out), in cents — for readers that
 *  show a balance without the lines (the Families book). Read from the org's own season books, paged. */
export async function loadOrgLeagueReceivedCents(orgId: string): Promise<Map<string, number>> {
  const { data: books, error: bookError } = await supabaseAdmin.from('accounting_ledgers').select('id')
    .eq('org_id', orgId).eq('entity_type', 'league_season');
  if (bookError) throw bookError;
  const rows = await fetchAllIn<Record<string, unknown>>((books ?? []).map(b => b.id as string), (chunk, from, to) =>
    supabaseAdmin.from('accounting_entries').select('id, source_entity_id, entry_type, amount')
      .in('ledger_id', chunk).eq('source_module', 'league_registration').eq('status', 'posted')
      .in('entry_type', ['income', 'expense']).order('id').range(from, to));
  const out = new Map<string, number>();
  for (const r of rows) {
    const c = Math.round(Number(r.amount) * 100) * (r.entry_type === 'income' ? 1 : -1);
    out.set(r.source_entity_id as string, (out.get(r.source_entity_id as string) ?? 0) + c);
  }
  return out;
}

/** The lines of some registrations (any seasons), by registration. A registration's lines all ride in one chunk, so each
 *  list keeps the read's order. */
export async function loadRegistrationMoneyLines(regIds: readonly string[]): Promise<Map<string, LeagueMoneyLine[]>> {
  return withReceipts(group(await fetchAllIn<Record<string, unknown>>(regIds, (chunk, from, to) =>
    supabaseAdmin.from('accounting_entries').select(SELECT)
      .eq('source_module', 'league_registration').in('source_entity_id', chunk)
      .order('entry_date', { ascending: true }).order('created_at', { ascending: true }).order('id').range(from, to))));
}
