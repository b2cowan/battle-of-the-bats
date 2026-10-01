import 'server-only';
import { refused, type Moved } from './club-money-route';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { orgDayKey } from './timezone';

/**
 * THE CLUB'S PAYEES, MANAGED (Club Tier Stage 3a, C01 / C14). The picker could list and create; nothing
 * could see the whole list, rename one, or fold "Mizuno Canada" and "Mizuno Canada Ltd." into one.
 *
 * ⚠ The club's payees only (`team_id IS NULL`) — a team's payees are the coach's.
 * ⚠ A payee is never deleted while a line names it (the FK says so too); a merge moves every line to
 * the one kept and removes the other in ONE step (`club_payee_merge`, mig 315).
 */

export interface ClubPayee {
  id: string; name: string; notes: string | null; isActive: boolean; uses: number;
  /** The newest day a line named it (a book line's date; a team expense's day recorded) — the Payees page's "Last used". */
  lastUsed: string | null;
}

/** Every club payee, by name, with how many lines name it (ledger entries and team expenses). */
export async function listClubPayees(orgId: string): Promise<ClubPayee[]> {
  const payees = await fetchAll<{ id: string; name: string; notes: string | null; is_active: boolean }>((a, b) =>
    supabaseAdmin.from('org_payees').select('id, name, notes, is_active')
      .eq('org_id', orgId).is('team_id', null).order('name').order('id').range(a, b));
  const uses = await payeeUses(payees.map(p => p.id));
  return payees.map(p => ({
    id: p.id, name: p.name, notes: p.notes, isActive: p.is_active,
    uses: uses.get(p.id)?.count ?? 0, lastUsed: uses.get(p.id)?.last ?? null,
  }));
}

async function payeeUses(ids: string[]): Promise<Map<string, { count: number; last: string | null }>> {
  const [entries, expenses] = await Promise.all([
    fetchAllIn<{ payee_id: string; entry_date: string }>(ids, (c, a, b) =>
      supabaseAdmin.from('accounting_entries').select('payee_id, entry_date').in('payee_id', c).order('id').range(a, b)),
    fetchAllIn<{ payee_id: string; created_at: string }>(ids, (c, a, b) =>
      supabaseAdmin.from('rep_team_expenses').select('payee_id, created_at').in('payee_id', c).order('id').range(a, b)),
  ]);
  const out = new Map<string, { count: number; last: string | null }>();
  const add = (id: string, dayKey: string) => {
    const was = out.get(id) ?? { count: 0, last: null };
    out.set(id, { count: was.count + 1, last: !was.last || dayKey > was.last ? dayKey : was.last });
  };
  for (const r of entries) add(r.payee_id, r.entry_date);
  for (const r of expenses) add(r.payee_id, orgDayKey(r.created_at));
  return out;
}

type PayeeResult<T> = Moved<T>;

async function clubPayee(orgId: string, payeeId: string) {
  const { data, error } = await supabaseAdmin.from('org_payees')
    .select('id, name, notes, is_active').eq('id', payeeId).eq('org_id', orgId).is('team_id', null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function renameClubPayee(orgId: string, payeeId: string, rawName: unknown): Promise<PayeeResult<{ payee: { id: string; name: string } }>> {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name) return refused(400, { error: 'Give the payee a name.', code: 'name_required' });
  if (name.length > 200) return refused(400, { error: 'Keep the name to 200 characters.', code: 'bad_name' });
  if (!(await clubPayee(orgId, payeeId))) return refused(404, { error: 'Not found' });
  const { data, error } = await supabaseAdmin.from('org_payees').update({ name })
    .eq('id', payeeId).eq('org_id', orgId).is('team_id', null).select('id, name').maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return refused(409, { error: 'Another payee already has that name. Merge them instead.', code: 'payee_exists' });
    }
    throw error;
  }
  if (!data) return refused(404, { error: 'Not found' });
  return { ok: true, payee: data };
}

export async function mergeClubPayee(orgId: string, fromId: string, intoId: unknown): Promise<PayeeResult<{ moved: number; into: string }>> {
  if (typeof intoId !== 'string' || !intoId) return refused(400, { error: 'Choose the payee to keep.', code: 'into_required' });
  const { data, error } = await supabaseAdmin.rpc('club_payee_merge', { p_org: orgId, p_from: fromId, p_into: intoId });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string; moved?: number };
  if (!r.ok) {
    if (r.code === 'same_payee') return refused(400, { error: 'Choose a different payee to keep.', code: 'same_payee' });
    return refused(404, { error: 'Not found' });
  }
  return { ok: true, moved: r.moved ?? 0, into: intoId };
}

export async function deleteClubPayee(orgId: string, payeeId: string): Promise<PayeeResult<{ deleted: true }>> {
  if (!(await clubPayee(orgId, payeeId))) return refused(404, { error: 'Not found' });
  const uses = (await payeeUses([payeeId])).get(payeeId)?.count ?? 0;
  const inUse = (error: string) => refused(409, { error, code: 'payee_in_use', uses });
  if (uses > 0) return inUse(`This payee is named on ${uses === 1 ? 'a line' : `${uses} lines`}. Merge it into another payee instead.`);
  const { error } = await supabaseAdmin.from('org_payees').delete().eq('id', payeeId).eq('org_id', orgId).is('team_id', null);
  if (error) {
    // A line named it in the instant between the count and the delete: the FK refuses, and so do we.
    if ((error as { code?: string }).code === '23503') return inUse('This payee was just named on a line. Merge it into another payee instead.');
    throw error;
  }
  return { ok: true, deleted: true };
}
