import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getDestinationForMembership, type MemberRow } from './user-contexts';

/**
 * Where a person lands after accepting an invitation (J10-011): the SAME resolver sign-in uses, for
 * the membership they just accepted. Both accept doors (the accept page and the home-page card)
 * used to hard-code `/{org}/admin` for everyone but a scorekeeper; a treasurer now lands in
 * Accounting, a league admin in the house league, a volunteer on the job they were invited for.
 *
 * Falls back to Home when the org cannot be read — never to a guessed admin URL.
 */
export async function destinationAfterAccept(userId: string, orgSlug: string | null): Promise<string> {
  if (!orgSlug) return '/discover';
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('id, organization_id, role, capabilities, organizations!inner(id, slug, name, plan_id, enabled_addons, account_kind, team_workspace_status, subscription_status, onboarding_completed_at, free_floor)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('organizations.slug', orgSlug)
    .limit(1)
    .maybeSingle();
  if (!data) return '/discover';
  try {
    return await getDestinationForMembership(data as unknown as MemberRow);
  } catch (error) {
    console.error('[invite-acceptance] destination resolve failed:', error);
    return `/${orgSlug}/admin`;
  }
}
