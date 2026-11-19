import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { countActiveBasicCoachTeamMembershipsForUser } from './basic-coach-teams';
import { accountKeptReason, isInvitationToOwnAccount, type AccountKeepFacts, type AccountKeptReason } from './member-account-keep';

/** The family-link statuses that no longer connect anyone (outside the live index, mig 445). */
const ENDED_FAMILY_LINK_STATUSES = ['declined', 'revoked'] as const;

/**
 * The facts `accountKeptReason` decides on, for a member of `orgId` (lib/member-account-keep.ts holds the rule). Read by the
 * member route's GET and DELETE alike, and the invitation sweep. ⚠ A failed read THROWS: a count that did not come back must
 * never read as zero, or a removal would delete an account that had another use.
 *
 * `orgId` null = the removal belongs to NO club (a FieldLogicHQ staff member removed from platform admin; leftover call 4,
 * owner 2026-11-19): every club seat counts as another use (1), and there is no club row for (4) to read.
 */
export async function readAccountKeepFacts(userId: string, orgId: string | null): Promise<AccountKeepFacts & { reason: AccountKeptReason | null }> {
  const seats = supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const [otherOrgs, basicCoachTeamCount, familyLinks, thisRow, authUser] = await Promise.all([
    orgId === null ? seats : seats.neq('organization_id', orgId),
    countActiveBasicCoachTeamMembershipsForUser(userId),
    supabaseAdmin
      .from('family_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('status', 'in', `(${ENDED_FAMILY_LINK_STATUSES.join(',')})`),
    // (4) this club's own row: a pending invitation to an account that already existed is never the club's to delete.
    orgId === null
      ? Promise.resolve({ data: null, error: null })
      : supabaseAdmin
        .from('organization_members')
        .select('status, invited_email')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .maybeSingle<{ status: string; invited_email: string | null }>(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);
  if (otherOrgs.error) throw otherOrgs.error;
  if (familyLinks.error) throw familyLinks.error;
  if (thisRow.error) throw thisRow.error;
  if (authUser.error) throw authUser.error;
  // A count that came back empty is a count that failed, never zero (zero would delete an account that has another use).
  if (otherOrgs.count == null || familyLinks.count == null) throw new Error('account-keep count unavailable');
  const facts: AccountKeepFacts = {
    otherOrgCount: otherOrgs.count,
    basicCoachTeamCount,
    familyLinkCount: familyLinks.count,
    invitedOwnAccount: thisRow.data ? isInvitationToOwnAccount(thisRow.data, authUser.data.user?.invited_at) : false,
  };
  return { ...facts, reason: accountKeptReason(facts) };
}
