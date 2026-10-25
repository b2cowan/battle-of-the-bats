import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { LeagueMoneyLine } from './league-money';

/**
 * A house-league registration's book lines, read one way (Club Tier 9b-2). Every line the one writer writes carries
 * source 'league_registration' + the registration id (mig 368); money in is 'income', money out (a refund) 'expense'.
 * The rules that turn lines into a fee and a band are lib/league-money.ts.
 */
const SELECT = 'id, source_entity_id, entry_type, amount, entry_date, payment_method, status, notes, void_reason, created_at';

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
  };
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
  const { data, error } = await supabaseAdmin.from('accounting_entries').select(SELECT)
    .eq('ledger_id', book.id).eq('source_module', 'league_registration')
    .order('entry_date', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return group((data ?? []) as Record<string, unknown>[]);
}

/** The lines of some registrations (any seasons), by registration. */
export async function loadRegistrationMoneyLines(regIds: readonly string[]): Promise<Map<string, LeagueMoneyLine[]>> {
  if (regIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from('accounting_entries').select(SELECT)
    .eq('source_module', 'league_registration').in('source_entity_id', [...regIds])
    .order('entry_date', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  return group((data ?? []) as Record<string, unknown>[]);
}
