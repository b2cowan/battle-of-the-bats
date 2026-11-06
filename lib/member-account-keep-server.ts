import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { countActiveBasicCoachTeamMembershipsForUser } from './basic-coach-teams';
import { accountKeptReason, type AccountKeepFacts, type AccountKeptReason } from './member-account-keep';

/** The family-link statuses that no longer connect anyone (outside the live index, mig 445). */
const ENDED_FAMILY_LINK_STATUSES = ['declined', 'revoked'] as const;

/**
 * The facts `accountKeptReason` decides on, for a member of `orgId` (lib/member-account-keep.ts holds the rule). Read by the
 * member route's GET and DELETE alike. ⚠ A failed read THROWS: a count that did not come back must never read as zero, or a
 * removal would delete an account that had another use.
 */
export async function readAccountKeepFacts(userId: string, orgId: string): Promise<AccountKeepFacts & { reason: AccountKeptReason | null }> {
  const [otherOrgs, basicCoachTeamCount, familyLinks] = await Promise.all([
    supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('organization_id', orgId),
    countActiveBasicCoachTeamMembershipsForUser(userId),
    supabaseAdmin
      .from('family_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('status', 'in', `(${ENDED_FAMILY_LINK_STATUSES.join(',')})`),
  ]);
  if (otherOrgs.error) throw otherOrgs.error;
  if (familyLinks.error) throw familyLinks.error;
  // A count that came back empty is a count that failed, never zero (zero would delete an account that has another use).
  if (otherOrgs.count == null || familyLinks.count == null) throw new Error('account-keep count unavailable');
  const facts: AccountKeepFacts = {
    otherOrgCount: otherOrgs.count,
    basicCoachTeamCount,
    familyLinkCount: familyLinks.count,
  };
  return { ...facts, reason: accountKeptReason(facts) };
}
