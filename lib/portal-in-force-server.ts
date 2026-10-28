import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { effectiveOrgFactsById } from './entitlement-grants';
import { IN_FORCE_ENTITLEMENT_STATUSES, isPortalInForceFrom, type EntitlementFacts } from './portal-in-force';

/**
 * The one question's reads (the rule and why: `lib/portal-in-force.ts`). Batched: two or three queries for any number
 * of portals. Throws on a read error, so a gate fails closed.
 */

export type PortalKey = { workspaceId: string; orgId: string; repTeamId: string };

/** The workspace ids, of those passed, whose portal is in force right now. */
export async function portalsInForce(portals: PortalKey[], now: Date = new Date()): Promise<Set<string>> {
  const out = new Set<string>();
  if (portals.length === 0) return out;
  const orgIds = [...new Set(portals.map(p => p.orgId))];
  const [door, { data: ents, error }] = await Promise.all([
    effectiveOrgFactsById(orgIds),
    supabaseAdmin
      .from('team_entitlements')
      .select('org_id, rep_team_id, status, starts_at, ends_at')
      .in('org_id', orgIds)
      .in('status', [...IN_FORCE_ENTITLEMENT_STATUSES]),
  ]);
  if (error) throw error;
  const byTeam = new Map<string, EntitlementFacts[]>();
  for (const e of (ents ?? []) as Array<EntitlementFacts & { org_id: string; rep_team_id: string }>) {
    const key = `${e.org_id}:${e.rep_team_id}`;
    byTeam.set(key, [...(byTeam.get(key) ?? []), e]);
  }
  for (const p of portals) {
    const inForce = isPortalInForceFrom({
      doorStatus: door.get(p.orgId)?.subscriptionStatus,
      entitlements: byTeam.get(`${p.orgId}:${p.repTeamId}`) ?? [],
    }, now);
    if (inForce) out.add(p.workspaceId);
  }
  return out;
}

/** One portal. */
export async function isPortalInForce(portal: PortalKey, now: Date = new Date()): Promise<boolean> {
  return (await portalsInForce([portal], now)).has(portal.workspaceId);
}

/** The workspace ids, of those passed, whose portal is in force (for a reader that holds only workspace ids). */
export async function workspacesInForce(workspaceIds: string[], now: Date = new Date()): Promise<Set<string>> {
  const ids = [...new Set(workspaceIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id')
    .in('id', ids);
  if (error) throw error;
  return portalsInForce(keysOf((data ?? []) as WorkspaceKeyRow[]), now);
}

type WorkspaceKeyRow = { id: string; workspace_org_id: string; rep_team_id: string };

export function keysOf(rows: WorkspaceKeyRow[]): PortalKey[] {
  return rows.map(r => ({ workspaceId: r.id, orgId: r.workspace_org_id, repTeamId: r.rep_team_id }));
}
