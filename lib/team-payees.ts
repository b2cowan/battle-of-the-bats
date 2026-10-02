import 'server-only';
import { refused, type Moved, type Refused } from './club-money-route';
import { INTO_REQUIRED, SAME_PAYEE, readPayeeName, tallyPayeeUses } from './club-payees';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { orgDayKey } from './timezone';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { teamPayeeFilter, teamPayeeScope, type PayeeScope } from './team-payee-scope';
import type { Organization } from './types';

/**
 * A TEAM'S PAYEES (Ledger Parity D5 + D7, mig 316). What a team's picker lists, the team's Payees page, and the
 * team's rename / merge / delete — every one through the one rule in lib/team-payee-scope.ts.
 *
 *   - a club team sees the payees the club SHARED (read-only, the club's) plus its own;
 *   - a standalone team (a team-workspace org) sees every payee of its org — all of them are its own;
 *   - nobody sees another team's payees, or the club's unshared ones, or any count of a record that is not
 *     this team's.
 *
 * The club's own list is lib/club-payees.ts. ⚠ The writes re-assert the scope in the WHERE of the write, not
 * only in the read before it (reference: coach money check-then-act).
 */

type Org = Pick<Organization, 'id' | 'accountKind' | 'planId'>;
type PayeeRow = { id: string; team_id: string | null; name: string; is_active: boolean; shared_with_teams: boolean };
const COLS = 'id, team_id, name, is_active, shared_with_teams';

/** A payee as a team's picker shows it: `scope` says which group ("Shared by your club" / the team's own). */
export interface PickerPayee { id: string; teamId: string | null; name: string; scope: PayeeScope }
/** One of the team's own payees on its Payees page — counts and dates from THIS team's records only. */
export interface TeamPayee { id: string; name: string; isActive: boolean; uses: number; lastUsed: string | null }
/** A club payee the club shares, as the team's Payees page lists it: read-only, name only (a merge target). */
export interface SharedPayee { id: string; name: string }

const NOT_FOUND = refused(404, { error: 'Not found' });
const CLUB_ONLY = refused(403, {
  error: 'This is the club’s payee: only the club can change it. To use one name, merge your own payee into it.',
  code: 'not_allowed',
});

/** The team's picker search: shared club payees first (club rows have no team), then the team's own. */
export async function searchTeamPayees(org: Org, teamId: string, q: string): Promise<PickerPayee[]> {
  const workspace = isTeamWorkspaceOrg(org);
  let query = supabaseAdmin.from('org_payees').select(COLS)
    .eq('org_id', org.id).eq('is_active', true).or(teamPayeeFilter(teamId, workspace, 'visible'))
    .order('team_id', { ascending: true, nullsFirst: true }).order('name', { ascending: true }).limit(30);
  if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  const out: PickerPayee[] = [];
  for (const r of (data ?? []) as PayeeRow[]) {
    const scope = teamPayeeScope(r, teamId, workspace);
    if (scope) out.push({ id: r.id, teamId: r.team_id, name: r.name, scope });
  }
  return out;
}

/** The team's Payees page: its own payees with uses and last used (this team's records only) + the shared ones. */
export async function listTeamPayees(org: Org, teamId: string): Promise<{ payees: TeamPayee[]; shared: SharedPayee[] }> {
  const workspace = isTeamWorkspaceOrg(org);
  // The team's records are read whole and in parallel — counted against the team's own payees only below.
  const [rows, records] = await Promise.all([
    fetchAll<PayeeRow>((a, b) =>
      supabaseAdmin.from('org_payees').select(COLS).eq('org_id', org.id).or(teamPayeeFilter(teamId, workspace, 'visible'))
        .order('name').order('id').range(a, b)),
    fetchAll<{ payee_id: string; created_at: string }>((a, b) =>
      supabaseAdmin.from('rep_team_expenses').select('payee_id, created_at')
        .eq('team_id', teamId).not('payee_id', 'is', null).order('id').range(a, b)),
  ]);
  const uses = tallyPayeeUses(records.map(r => ({ id: r.payee_id, day: orgDayKey(r.created_at) })));
  const payees: TeamPayee[] = [];
  const shared: SharedPayee[] = [];
  for (const p of rows) {
    const scope = teamPayeeScope(p, teamId, workspace);
    if (scope === 'team') {
      const u = uses.get(p.id);
      payees.push({ id: p.id, name: p.name, isActive: p.is_active, uses: u?.count ?? 0, lastUsed: u?.last ?? null });
    } else if (scope === 'club' && p.is_active) {
      shared.push({ id: p.id, name: p.name });
    }
  }
  return { payees, shared };
}

/** How this team sees one payee of the org — null when it cannot see it at all. */
async function payeeScopeForTeam(org: Org, teamId: string, payeeId: string): Promise<PayeeScope | null> {
  const { data, error } = await supabaseAdmin.from('org_payees').select('team_id, shared_with_teams')
    .eq('id', payeeId).eq('org_id', org.id).maybeSingle();
  if (error) throw error;
  return data ? teamPayeeScope(data, teamId, isTeamWorkspaceOrg(org)) : null;
}

/** The refusal for a payee that is not the team's own to change (null when it is). */
async function refuseUnlessOwn(org: Org, teamId: string, payeeId: string): Promise<Refused | null> {
  const scope = await payeeScopeForTeam(org, teamId, payeeId);
  return scope === 'team' ? null : scope === 'club' ? CLUB_ONLY : NOT_FOUND;
}

/**
 * May a record of this team name this payee? Its own, or one the club shares — and always the payee the record
 * ALREADY names (`current`): the club may have stopped sharing it since, and unsharing never touches a record,
 * so editing the amount must not suddenly refuse. The expense routes ask before they write, because the picker
 * narrowing is a courtesy: a stale tab or a direct caller could name an unshared club payee, another team's, or
 * another org's.
 */
export async function teamMayNamePayee(org: Org, teamId: string, payeeId: string, current?: string | null): Promise<boolean> {
  return payeeId === current || (await payeeScopeForTeam(org, teamId, payeeId)) != null;
}

export async function renameTeamPayee(org: Org, teamId: string, payeeId: string, rawName: unknown): Promise<Moved<{ payee: { id: string; name: string } }>> {
  const read = readPayeeName(rawName);
  if ('ok' in read) return read;
  const workspace = isTeamWorkspaceOrg(org);
  const own = teamPayeeFilter(teamId, workspace, 'own');
  const taken = refused(409, { error: 'Another of the team’s payees already has that name. Merge them instead.', code: 'payee_exists' });

  const [notOwn, ownNames] = await Promise.all([
    refuseUnlessOwn(org, teamId, payeeId),
    // In a club the team's own list is one unique index, which answers a clash itself (23505). A standalone
    // team's own list spans both index scopes (`team_id` null and set), so the clash is checked here,
    // compared as the indexes compare (lower(name)).
    workspace
      ? fetchAll<{ id: string; name: string }>((a, b) =>
          supabaseAdmin.from('org_payees').select('id, name').eq('org_id', org.id).or(own).order('id').range(a, b))
      : Promise.resolve([]),
  ]);
  if (notOwn) return notOwn;
  if (ownNames.some(p => p.id !== payeeId && p.name.toLowerCase() === read.name.toLowerCase())) return taken;

  const { data, error } = await supabaseAdmin.from('org_payees').update({ name: read.name })
    .eq('id', payeeId).eq('org_id', org.id).or(own)
    .select('id, name').maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === '23505') return taken;
    throw error;
  }
  if (!data) return NOT_FOUND;
  return { ok: true, payee: data };
}

export async function mergeTeamPayee(org: Org, teamId: string, fromId: string, intoId: unknown): Promise<Moved<{ moved: number; into: string }>> {
  if (typeof intoId !== 'string' || !intoId) return INTO_REQUIRED;
  const { data, error } = await supabaseAdmin.rpc('team_payee_merge', { p_org: org.id, p_team: teamId, p_from: fromId, p_into: intoId });
  if (error) throw error;
  const r = data as { ok: boolean; code?: string; moved?: number };
  if (!r.ok) {
    if (r.code === 'same_payee') return SAME_PAYEE;
    if (r.code === 'not_allowed') return CLUB_ONLY;
    if (r.code === 'named_elsewhere') {
      return refused(409, { error: 'Another record outside this team names this payee, so it can’t be merged here.', code: 'named_elsewhere' });
    }
    return NOT_FOUND;
  }
  return { ok: true, moved: r.moved ?? 0, into: intoId };
}

export async function deleteTeamPayee(org: Org, teamId: string, payeeId: string): Promise<Moved<{ deleted: true }>> {
  const [notOwn, named] = await Promise.all([
    refuseUnlessOwn(org, teamId, payeeId),
    supabaseAdmin.from('rep_team_expenses').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('payee_id', payeeId),
  ]);
  if (named.error) throw named.error;
  if (notOwn) return notOwn;
  const uses = named.count ?? 0;
  if (uses > 0) {
    return refused(409, { error: `This payee is named on ${uses === 1 ? 'a record' : `${uses} records`}. Merge it into another payee instead.`, code: 'payee_in_use', uses });
  }
  const { data, error } = await supabaseAdmin.from('org_payees').delete()
    .eq('id', payeeId).eq('org_id', org.id).or(teamPayeeFilter(teamId, isTeamWorkspaceOrg(org), 'own')).select('id');
  if (error) {
    // Something names it after all — another record, or one written in the instant since the count. The FK
    // refuses, and so do we; no count, since the record may not be this team's.
    if ((error as { code?: string }).code === '23503') {
      return refused(409, { error: 'A record still names this payee. Merge it into another payee instead.', code: 'payee_in_use' });
    }
    throw error;
  }
  // Merged away (or moved) since the read: nothing was deleted, so say so rather than claim it.
  if (!data?.length) return NOT_FOUND;
  return { ok: true, deleted: true };
}
