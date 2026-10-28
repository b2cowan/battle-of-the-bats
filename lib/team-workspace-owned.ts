import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { keysOf, portalsInForce } from './portal-in-force-server';

/* ⚠ Lives apart from `team-workspace-entitlements.ts` on purpose: that file is reachable from the BROWSER bundle
   (org-context → member-access → module-entitlements → db → it), and this function needs the `server-only` one-question
   reads. Importing them there took the dev server's pages down (Support console 4b). */

/**
 * The LIVE Coaches Portal this user already OWNS, if any — enforcing "one paid Coaches Portal per
 * email" (decision 2026-06-19). Returns its org id + slug (to route them to it), or null. "Live" is the
 * one question (`lib/portal-in-force.ts`, Support console Stage 4b): an ended portal does NOT count —
 * they can reactivate it or start fresh — and a portal on free time DOES, until its last free day.
 */
export async function getActiveOwnedTeamWorkspace(
  userId: string,
): Promise<{ orgSlug: string; workspaceOrgId: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, workspace_org_id, rep_team_id')
    .eq('primary_owner_user_id', userId);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: string; workspace_org_id: string; rep_team_id: string }>;
  const inForce = await portalsInForce(keysOf(rows));
  const live = rows.find(w => inForce.has(w.id));
  if (!live) return null;

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', live.workspace_org_id)
    .maybeSingle<{ slug: string }>();

  if (!org?.slug) {
    // A live workspace whose org can't be resolved is a data-integrity anomaly — surface it rather
    // than silently treating the user as portal-less (which would let them buy a second).
    console.error('[team-workspace-owned] live team_workspace has unresolvable org:', live.workspace_org_id);
    return null;
  }
  return { orgSlug: org.slug, workspaceOrgId: live.workspace_org_id as string };
}
