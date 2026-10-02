import 'server-only';
import { refused, type Moved, type Refused } from './club-money-route';
import type { EntitlementOrg } from './module-entitlements';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { clubSharesPayees } from './team-payee-scope';
import type { Organization } from './types';

/**
 * THE CLUB'S PAYEES, MANAGED (Club Tier Stage 3a, C01 / C14). The picker could list and create; nothing
 * could see the whole list, rename one, or fold "Mizuno Canada" and "Mizuno Canada Ltd." into one.
 *
 * ⚠ The club's payees only (`team_id IS NULL`) — a team's payees are the coach's (lib/team-payees.ts).
 * ⚠ A payee is never deleted while a line names it (the FK says so too); a merge moves every line to
 * the one kept and removes the other in ONE step (`club_payee_merge`, migs 315 + 316).
 * ⚖ THE CLUB IS SHOWN ITS OWN BOOK'S LINES ONLY (Ledger Parity D7/D7a, mig 316). `uses`, `lastUsed` and a
 * merge's `moved` count the club's entries, never a team's records: what a team recorded paying a SHARED
 * payee, from the moment it was shared, is Stage 3b's report and nothing else. `inUse` is the one bit a
 * team's record adds, because the FK refuses the delete either way.
 */

export interface ClubPayee {
  id: string; name: string; notes: string | null; isActive: boolean;
  /** How many of the club's own book lines name it (never a team's records) — the Payees page's "Entries". */
  uses: number;
  /** The newest day one of the club's lines named it — the Payees page's "Last used". */
  lastUsed: string | null;
  /** Something names it — a club line, or a team's record — so it cannot be deleted, only merged. */
  inUse: boolean;
  /** The club shares it with its teams (mig 316, D7) — the Payees list's Teams column. */
  sharedWithTeams: boolean;
}

/** How many records name each payee, and the newest day one did — the club's Payees page and a team's. */
export function tallyPayeeUses(rows: Iterable<{ id: string; day: string }>): Map<string, { count: number; last: string | null }> {
  const out = new Map<string, { count: number; last: string | null }>();
  for (const { id, day } of rows) {
    const was = out.get(id) ?? { count: 0, last: null };
    out.set(id, { count: was.count + 1, last: !was.last || day > was.last ? day : was.last });
  }
  return out;
}

/** A payee's name as both portals' rename takes it: trimmed, required, at most 200 characters. */
export function readPayeeName(raw: unknown): { name: string } | Refused {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) return refused(400, { error: 'Give the payee a name.', code: 'name_required' });
  if (name.length > 200) return refused(400, { error: 'Keep the name to 200 characters.', code: 'bad_name' });
  return { name };
}

/** The two merge refusals both portals share. */
export const INTO_REQUIRED = refused(400, { error: 'Choose the payee to keep.', code: 'into_required' });
export const SAME_PAYEE = refused(400, { error: 'Choose a different payee to keep.', code: 'same_payee' });
const NOT_FOUND = refused(404, { error: 'Not found' });

/** Every club payee, by name, with how many of the club's lines name it. */
export async function listClubPayees(orgId: string): Promise<ClubPayee[]> {
  const payees = await fetchAll<{ id: string; name: string; notes: string | null; is_active: boolean; shared_with_teams: boolean }>((a, b) =>
    supabaseAdmin.from('org_payees').select('id, name, notes, is_active, shared_with_teams')
      .eq('org_id', orgId).is('team_id', null).order('name').order('id').range(a, b));
  const ids = payees.map(p => p.id);
  const [entries, teamRecords] = await Promise.all([
    fetchAllIn<{ payee_id: string; entry_date: string }>(ids, (c, a, b) =>
      supabaseAdmin.from('accounting_entries').select('payee_id, entry_date').in('payee_id', c).order('id').range(a, b)),
    // Which payees any team's record names — read for a yes/no, never shown as a count or a team.
    fetchAllIn<{ payee_id: string }>(ids, (c, a, b) =>
      supabaseAdmin.from('rep_team_expenses').select('payee_id').in('payee_id', c).order('id').range(a, b)),
  ]);
  const uses = tallyPayeeUses(entries.map(r => ({ id: r.payee_id, day: r.entry_date })));
  const teamNamed = new Set(teamRecords.map(r => r.payee_id));
  return payees.map(p => {
    const u = uses.get(p.id);
    return {
      id: p.id, name: p.name, notes: p.notes, isActive: p.is_active,
      uses: u?.count ?? 0, lastUsed: u?.last ?? null,
      inUse: (u?.count ?? 0) > 0 || teamNamed.has(p.id),
      sharedWithTeams: p.shared_with_teams,
    };
  });
}

async function clubPayee(orgId: string, payeeId: string) {
  const { data, error } = await supabaseAdmin.from('org_payees')
    .select('id, shared_with_teams').eq('id', payeeId).eq('org_id', orgId).is('team_id', null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function renameClubPayee(orgId: string, payeeId: string, rawName: unknown): Promise<Moved<{ payee: { id: string; name: string } }>> {
  const read = readPayeeName(rawName);
  if ('ok' in read) return read;
  if (!(await clubPayee(orgId, payeeId))) return NOT_FOUND;
  const { data, error } = await supabaseAdmin.from('org_payees').update({ name: read.name })
    .eq('id', payeeId).eq('org_id', orgId).is('team_id', null).select('id, name').maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return refused(409, { error: 'Another payee already has that name. Merge them instead.', code: 'payee_exists' });
    }
    throw error;
  }
  if (!data) return NOT_FOUND;
  return { ok: true, payee: data };
}

/**
 * Share a club payee with the club's teams, or stop (D7). Sharing stamps `shared_at` — Stage 3b counts a team's
 * payment only from then (D7a); unsharing clears it, so a later re-share starts a new clock. Asking for the state
 * it is already in changes nothing — above all it never restarts a running clock. Unsharing never touches a
 * record that names the payee: it only leaves the teams' pickers. Only a club that runs rep teams shares; a
 * standalone team's org has no club to share from (its `team_id IS NULL` rows are the team's own).
 */
type SharingOrg = EntitlementOrg & Pick<Organization, 'id' | 'accountKind' | 'planId'>;

/** Why this share request cannot be made at all — or null. Asked before any write, so a refusal writes nothing. */
export function shareRefusal(org: SharingOrg, shared: unknown): Refused | null {
  if (!clubSharesPayees(org)) {
    return refused(403, { error: 'Only a club with teams can share its payees.', code: 'not_allowed' });
  }
  if (typeof shared !== 'boolean') return refused(400, { error: 'Say whether the payee is shared.', code: 'bad_shared' });
  return null;
}

export async function setClubPayeeShared(
  org: SharingOrg, payeeId: string, shared: unknown,
): Promise<Moved<{ payee: { id: string; sharedWithTeams: boolean } }>> {
  const refusal = shareRefusal(org, shared);
  if (refusal) return refusal;
  const on = shared === true; // a boolean: `shareRefusal` refused anything else
  const { data, error } = await supabaseAdmin.from('org_payees')
    .update({ shared_with_teams: on, shared_at: on ? new Date().toISOString() : null })
    .eq('id', payeeId).eq('org_id', org.id).is('team_id', null).eq('shared_with_teams', !on)
    .select('id, shared_with_teams').maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, payee: { id: data.id, sharedWithTeams: data.shared_with_teams } };
  // Nothing changed: already in that state (fine — the same answer), or not one of the club's payees.
  const now = await clubPayee(org.id, payeeId);
  if (!now) return NOT_FOUND;
  return { ok: true, payee: { id: now.id, sharedWithTeams: now.shared_with_teams } };
}

export async function mergeClubPayee(orgId: string, fromId: string, intoId: unknown): Promise<Moved<{ moved: number; into: string }>> {
  if (typeof intoId !== 'string' || !intoId) return INTO_REQUIRED;
  const { data, error } = await supabaseAdmin.rpc('club_payee_merge', { p_org: orgId, p_from: fromId, p_into: intoId });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string; entries?: number };
  if (!r.ok) return r.code === 'same_payee' ? SAME_PAYEE : NOT_FOUND;
  // The club's own lines only — the team records the merge also moved are never counted to the club (D7a).
  return { ok: true, moved: r.entries ?? 0, into: intoId };
}

export async function deleteClubPayee(orgId: string, payeeId: string): Promise<Moved<{ deleted: true }>> {
  const [payee, entries, teamRecord] = await Promise.all([
    clubPayee(orgId, payeeId),
    supabaseAdmin.from('accounting_entries').select('id', { count: 'exact', head: true }).eq('payee_id', payeeId),
    supabaseAdmin.from('rep_team_expenses').select('id').eq('payee_id', payeeId).limit(1),
  ]);
  if (entries.error) throw entries.error;
  if (teamRecord.error) throw teamRecord.error;
  if (!payee) return NOT_FOUND;
  const uses = entries.count ?? 0;
  const inUse = (error: string) => refused(409, { error, code: 'payee_in_use', uses });
  if (uses > 0) return inUse(`This payee is named on ${uses === 1 ? 'a line' : `${uses} lines`}. Merge it into another payee instead.`);
  // A team's record names it: the FK refuses the delete. Said without a count or a team (D7a).
  if ((teamRecord.data ?? []).length > 0) {
    return refused(409, { error: 'A team’s records name this payee. Merge it into another payee instead.', code: 'payee_in_use' });
  }
  const { error } = await supabaseAdmin.from('org_payees').delete().eq('id', payeeId).eq('org_id', orgId).is('team_id', null);
  if (error) {
    // A line named it in the instant between the count and the delete: the FK refuses, and so do we.
    if ((error as { code?: string }).code === '23503') return inUse('This payee was just named on a line. Merge it into another payee instead.');
    throw error;
  }
  return { ok: true, deleted: true };
}
