import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getUserDisplayName } from './user-display';

/**
 * The name a member is shown by, to another person — the name they gave this organization
 * (`organization_members.display_name`), else the name on their account, else their email.
 *
 * Used where one person is named to another: the plan-check wall names the club's owner ("Ask
 * your club's owner, Dana Whitfield, about the plan"), and the invitation names who sent it
 * (specimen 6, J10-010). Best-effort by design — a failed read returns null and the sentence
 * drops the name; it never fails the page it sits on.
 */
export async function memberDisplayName(orgId: string, userId: string): Promise<string | null> {
  try {
    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('display_name')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle<{ display_name: string | null }>();
    const given = member?.display_name?.trim();
    if (given) return given;
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user ? (getUserDisplayName(data.user) || null) : null;
  } catch (error) {
    console.error('[member-names] display name read failed:', error);
    return null;
  }
}

export type InvitationSender = {
  name: string | null;
  /** The sender's role in the org at the time of reading ('owner', 'admin', …), when known. */
  role: string | null;
  /** When the invitation was sent (the audit row's timestamp). */
  sentAt: string | null;
};

/**
 * Who sent this person their invitation to this organization — read from the org audit log's most
 * recent `member_invited` row for them, the one record that names the sender (the membership row
 * has no inviter column, and adding one for this was not worth a migration). Null fields when the
 * invitation predates the log or the read fails; the card then simply omits the "From" line.
 */
export async function invitationSender(orgId: string, invitedUserId: string): Promise<InvitationSender> {
  const empty: InvitationSender = { name: null, role: null, sentAt: null };
  const { data, error } = await supabaseAdmin
    .from('org_audit_log')
    .select('actor_id, created_at')
    .eq('org_id', orgId)
    .eq('target_id', invitedUserId)
    .eq('action', 'member_invited')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ actor_id: string | null; created_at: string }>();
  if (error || !data?.actor_id) return error ? empty : { ...empty, sentAt: data?.created_at ?? null };
  const [{ data: actor }, name] = await Promise.all([
    supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', data.actor_id)
      .maybeSingle<{ role: string }>(),
    memberDisplayName(orgId, data.actor_id),
  ]);
  return { name, role: actor?.role ?? null, sentAt: data.created_at };
}

/** The organization owner's display name (the earliest owner when there are several), or null. */
export async function orgOwnerDisplayName(orgId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .order('invited_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ user_id: string }>();
  if (error || !data) return null;
  return memberDisplayName(orgId, data.user_id);
}
