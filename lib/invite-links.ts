import { supabaseAdmin } from './supabase-admin';
import { sendEmail, orgInviteHtml } from './email';
import { roleEmailLabel } from './member-access';
import { invitationSender } from './member-names';

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
}

/**
 * The accept page's address, carrying the club, the role and who sent it (J10-010). Those three
 * paint the page's FIRST frame — a scorekeeper sees "Join … as Scorekeeper", never the admin title
 * — and the page then confirms all three from the server once the session lands. The link is a
 * hint, never the authority: a hand-edited link can change only what its own reader sees first.
 */
export function acceptInvitePath(p: { orgSlug: string; role: string; inviterName?: string | null }): string {
  const qs = new URLSearchParams({ org: p.orgSlug, role: p.role });
  if (p.inviterName) qs.set('inviter', p.inviterName);
  return `/auth/accept-invite?${qs.toString()}`;
}

/**
 * Send (or re-send) the "accept your invitation" link for a PENDING organization_members row.
 *
 * Single source of truth shared by the admin reinvite route
 * (`/api/admin/members/[memberId]/reinvite`) and the unauthenticated self-serve resend route
 * (`/api/auth/resend-invite`). Generates a MAGIC link when the invitee's auth user is already
 * confirmed (generateLink({type:'invite'}) fails "already registered" once confirmed) and an
 * INVITE link otherwise; both redirect through `/auth/callback` → `/auth/accept-invite?org={slug}`.
 * Also refreshes `invited_at` and backfills `invited_email` (lowercased) so the row stays
 * reconcilable by email (mig 128).
 *
 * Reads the send-to email + confirmation state from the auth user, so callers only pass the
 * pending member's identifiers.
 */
export async function sendPendingInviteLink(params: {
  memberId: string;
  userId: string;
  role: string;
  orgName: string;
  orgSlug: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { memberId, userId, role, orgName, orgSlug } = params;

  const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!authUser?.email) {
    return { ok: false, error: 'Could not find email for this member' };
  }

  const email = authUser.email;
  const invitedEmail = email.trim().toLowerCase();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  // J10-005: one role vocabulary for every invite mail. This used to build its own and called a
  // treasurer a "team treasurer" and an admin a "team admin".
  const roleLabel = roleEmailLabel(role);
  const inviteAction = role === 'official' ? 'Accept Scorekeeper Invite' : 'Accept Invitation';
  // The resend names the ORIGINAL sender, as the first invitation did (J10-010).
  const { data: memberRow } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('id', memberId)
    .maybeSingle<{ organization_id: string }>();
  const sender = memberRow ? await invitationSender(memberRow.organization_id, userId) : null;
  const next = encodeURIComponent(acceptInvitePath({ orgSlug, role, inviterName: sender?.name }));
  const redirectTo = `${appUrl}/auth/callback?next=${next}`;

  // Confirmed accounts can't be re-invited (type:'invite' → "already registered"); use a
  // magic link so they still land on accept-invite to finalize their membership.
  const genParams = authUser.email_confirmed_at
    ? { type: 'magiclink' as const, email, options: { redirectTo } }
    : { type: 'invite' as const, email, options: { redirectTo } };

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink(genParams);
  if (linkError || !linkData) {
    return { ok: false, error: linkError?.message ?? 'Failed to generate invite link' };
  }

  const inviteUrl = getActionLink(linkData);
  await sendEmail(
    email,
    `You've been invited to ${orgName} on FieldLogicHQ`,
    orgInviteHtml({ orgName, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: inviteAction, scorekeeperNote: role === 'official', inviterName: sender?.name ?? null }),
  );

  // Refresh invited_at (admin sees the re-invite time) + backfill invited_email so the row
  // stays reconcilable by email (mig 128). The email already sent, so a failed metadata
  // refresh doesn't fail the operation — but log it rather than swallow, else the admin sees
  // a stale "re-invited X ago" with no signal (e.g. the row was accepted mid-flight).
  const { error: refreshError } = await supabaseAdmin
    .from('organization_members')
    .update({ invited_at: new Date().toISOString(), invited_email: invitedEmail })
    .eq('id', memberId);
  if (refreshError) {
    console.error('[sendPendingInviteLink] invite metadata refresh failed:', refreshError);
  }

  return { ok: true };
}
