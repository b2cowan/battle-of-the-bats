import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { captureError } from './observability/capture';

/**
 * lib/user-hidden-workspaces.ts — the workspaces a person chose to HIDE from their own Home (migration 456).
 *
 * HIDE, NOT LEAVE (owner ruling 2026-11-09): this changes only what THIS person sees. The club's roster, the team's
 * records and the coach's assignment are untouched, and nobody is told. A row only APPLIES while the workspace is
 * paused for that person — `lib/user-contexts.ts` decides that (`getHiddenWorkspaceState`) and deletes a row that no
 * longer applies. Service-role only (RLS walled, zero policies).
 */

/** Every organization this person has hidden. A failed read hides nothing — a card showing is the safe side. */
export async function readHiddenOrgIds(userId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_hidden_workspaces')
      .select('organization_id')
      .eq('user_id', userId);
    if (error) throw error;
    return new Set((data ?? []).map(r => r.organization_id as string));
  } catch (e) {
    void captureError(e, { severity: 'warning', route: 'lib/user-hidden-workspaces.readHiddenOrgIds' });
    return new Set();
  }
}

/** Hide one workspace for one person. Idempotent. The CALLER has already proved it is paused for them. */
export async function hideWorkspace(userId: string, organizationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_hidden_workspaces')
    .upsert({ user_id: userId, organization_id: organizationId }, { onConflict: 'user_id,organization_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Show it again. Idempotent. */
export async function showWorkspace(userId: string, organizationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_hidden_workspaces')
    .delete()
    .eq('user_id', userId)
    .eq('organization_id', organizationId);
  if (error) throw error;
}

/** Drop rows that no longer apply (the club is back, or the person is no longer a coach there). Best effort. */
export async function dropStaleHiddenWorkspaces(userId: string, organizationIds: string[]): Promise<void> {
  if (organizationIds.length === 0) return;
  const { error } = await supabaseAdmin
    .from('user_hidden_workspaces')
    .delete()
    .eq('user_id', userId)
    .in('organization_id', organizationIds);
  if (error) void captureError(error, { severity: 'warning', route: 'lib/user-hidden-workspaces.dropStaleHiddenWorkspaces' });
}
