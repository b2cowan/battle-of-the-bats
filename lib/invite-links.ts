import { supabaseAdmin } from './supabase-admin';
import { sendEmail, orgInviteHtml } from './email';

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';
  const roleLabel = role === 'official' ? 'scorekeeper' : `team ${role}`;
  const inviteAction = role === 'official' ? 'Accept Scorekeeper Invite' : 'Accept Invitation';
  const next = encodeURIComponent(`/auth/accept-invite?org=${orgSlug}`);
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
    orgInviteHtml({ orgName, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: inviteAction, scorekeeperNote: role === 'official' }),
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
