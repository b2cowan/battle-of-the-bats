import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * The seat that set a team's tryout questions address ended (removal) or became an assistant (demotion): clear the
 * address IF that membership set it (Club Tier Stage 4c-2 Part B, Ask 1). Called by `removeStaffMember` and
 * `setStaffMemberRole`; the readers' live check (`lib/coach-tryout-contact.ts`) is the second half of the same rule.
 *
 * A leaf module on purpose: `lib/coach-membership.ts` imports it, and `lib/coach-tryout-contact.ts` imports
 * `coach-membership`, so the clear living there would make a cycle. The reset fields are left alone — this was not
 * the club.
 */
export async function clearTryoutContactSetBy(teamId: string, membershipId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_tryout_contacts')
    .update({ email: null, set_by_membership_id: null, set_at: null, updated_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('set_by_membership_id', membershipId);
  if (error) throw error;
}
