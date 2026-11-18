import { supabaseAdmin } from './supabase-admin';
import { sendEmail, orgInviteHtml } from './email';
import { memberOpensSentence, roleEmailLabel } from './member-access';
import { invitationSender } from './member-names';
import { volunteerJobOf } from './volunteer-jobs';
import { isInvitationToOwnAccount } from './member-account-keep';
import { waitingBoardRole } from './waiting-board-role';
import { INVITE_EMAIL_ACTION, VOLUNTEER_EMAIL_NOTE } from './volunteer-words';

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
}

/**
 * The accept page's address, carrying the club, the role and who sent it (J10-010). Those three
 * paint the page's FIRST frame — a volunteer sees "Join … as Volunteer", never the admin title
 * — and the page then confirms all three from the server once the session lands. The link is a
 * hint, never the authority: a hand-edited link can change only what its own reader sees first.
 */
export function acceptInvitePath(p: { orgSlug: string; role: string; inviterName?: string | null }): string {
  const qs = new URLSearchParams({ org: p.orgSlug, role: p.role });
  if (p.inviterName) qs.set('inviter', p.inviterName);
  return `/auth/accept-invite?${qs.toString()}`;
}

/**
 * Where an invitation to an EXISTING account sends its reader (Board Ready trust close-out 13, owner 2026-11-18): sign in,
 * then Home, whose invitations card is the accept-and-decline door. Never the accept page — its form sets a password, and
 * this reader already has one. A plain sign-in link: no session in the email, nothing that expires.
 */
export function existingAccountInviteUrl(appUrl: string): string {
  return `${appUrl}/auth/login?next=${encodeURIComponent('/discover')}`;
}

/**
 * The invitation to an account its owner already has, sent and re-sent from ONE place (trust close-out 13 and P2b): sign in,
 * then accept or decline on Home. `keepsCoaching` for a club's own coach offered a board role beside their coaching. The
 * role's line and a volunteer's note come from the role and access OFFERED (for a coach, the waiting ones), never the row's.
 */
export async function sendExistingAccountInvite(p: {
  email: string;
  orgId: string;
  orgName: string;
  role: string;
  capabilities: Record<string, boolean> | null | undefined;
  inviterName: string | null;
  askedBy?: string;
  keepsCoaching?: boolean;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';
  const job = p.role === 'official' ? volunteerJobOf(p.capabilities) : null;
  await sendEmail(
    p.email,
    `You've been invited to ${p.orgName} on FieldLogicHQ`,
    orgInviteHtml({
      orgName: p.orgName,
      roleLabel: roleEmailLabel(p.role),
      inviteUrl: existingAccountInviteUrl(appUrl),
      ctaLabel: INVITE_EMAIL_ACTION.signInToAccept,
      note: job ? VOLUNTEER_EMAIL_NOTE.existing[job] : null,
      opens: memberOpensSentence(p.role, p.capabilities),
      inviterName: p.inviterName,
      existingAccount: true,
      keepsCoaching: p.keepsCoaching,
    }),
    { kind: 'org_invite', orgId: p.orgId, ...(p.askedBy ? { askedBy: p.askedBy } : {}) },
  );
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
 * reconcilable by email (mig 128). The refresh restarts the invitation's 30 days (P2c), so it is written BEFORE the email
 * and a failed one refuses the resend.
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
  /** The member who pressed Resend (the email log's "asked by"); absent for the self-serve resend. */
  askedBy?: string;
  /** The coach's waiting board role the caller read (P2b): if it was answered or withdrawn since, nothing is sent. */
  waitingRole?: string | null;
}): Promise<{ ok: true; existingAccount: boolean } | { ok: false; error: string; changed?: true }> {
  const { memberId, userId, role, orgName, orgSlug, askedBy, waitingRole } = params;

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
  // The resend names the ORIGINAL sender, as the first invitation did (J10-010), and a volunteer's job
  // as their row holds it now (Stage 6, A26 — Members may have changed it since the first invitation).
  const { data: memberRow } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role, capabilities, status, invited_email, pending_role, pending_capabilities')
    .eq('id', memberId)
    .maybeSingle<{
      organization_id: string; role: string; capabilities: Record<string, boolean> | null; status: string; invited_email: string | null;
      pending_role: string | null; pending_capabilities: Record<string, boolean> | null;
    }>();
  const sender = memberRow ? await invitationSender(memberRow.organization_id, userId) : null;

  // A club's coach with a board role WAITING (trust close-out 13 P2b): it goes again as it was first sent (sign in and accept
  // on Home, "your coaching stays as it is"), naming the waiting role and its access, and the waiting role's date restarts.
  // Their coaching row is not touched.
  const waiting = waitingBoardRole(memberRow);
  // /review: the caller read a waiting role, and it is gone or different now (accepted, declined or cancelled in between).
  // Never fall through to the pending-row links below, which would email an accept link for a row that is not pending.
  if (waitingRole && waiting !== waitingRole) {
    return { ok: false, error: 'That invitation was already answered. Reload the page.', changed: true };
  }
  // ⚖ A resend restarts the invitation's 30 days (P2c, lib/invitation-lapse.ts), so the date is stamped FIRST and must land:
  // an email saying "join" for an invitation that still reads as run out would be a promise the accept doors refuse.
  if (memberRow && waiting) {
    const { data: stamped, error: refreshError } = await supabaseAdmin
      .from('organization_members')
      .update({ pending_invited_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('role', 'coach')
      .eq('pending_role', waiting)
      .select('id');
    if (refreshError) return { ok: false, error: 'We couldn’t send the invitation again. Try again.' };
    if (!stamped?.length) return { ok: false, error: 'That invitation was already answered. Reload the page.', changed: true };
    await sendExistingAccountInvite({
      email, orgId: memberRow.organization_id, orgName, role: waiting, capabilities: memberRow.pending_capabilities,
      inviterName: sender?.name ?? null, askedBy, keepsCoaching: true,
    });
    return { ok: true, existingAccount: true };
  }

  // An invitation to an account its owner already had (trust close-out 13) is resent as it was first sent: sign in and
  // accept on Home. No link is generated and `invited_email` stays empty — that emptiness is what marks the row (see
  // isInvitationToOwnAccount), and the row already names the account, so there is nothing to re-attach by email.
  // ⚠ Only a CONFIRMED account (/review): an unconfirmed one has nothing to sign in with, so it keeps the set-up link below
  // (which also backfills a legacy row's address).
  if (memberRow && authUser.email_confirmed_at && isInvitationToOwnAccount(memberRow, authUser.invited_at)) {
    const stampError = await restampPendingRow(memberId, {});
    if (stampError) return stampError;
    await sendExistingAccountInvite({
      email, orgId: memberRow.organization_id, orgName, role, capabilities: memberRow.capabilities, inviterName: sender?.name ?? null, askedBy,
    });
    return { ok: true, existingAccount: true };
  }
  const job = role === 'official' ? volunteerJobOf(memberRow?.capabilities) : null;
  const opens = memberOpensSentence(role, memberRow?.capabilities);
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

  // Refresh invited_at (the 30 days restart, P2c; the admin sees the re-invite time) + backfill invited_email so the row
  // stays reconcilable by email (mig 128). Before the email, and it must land (see above); a row accepted mid-flight
  // stamps nothing and nothing is sent.
  const stampError = await restampPendingRow(memberId, { invited_email: invitedEmail });
  if (stampError) return stampError;

  const inviteUrl = getActionLink(linkData);
  await sendEmail(
    email,
    `You've been invited to ${orgName} on FieldLogicHQ`,
    orgInviteHtml({ orgName, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: INVITE_EMAIL_ACTION.accept, note: job ? VOLUNTEER_EMAIL_NOTE.invite[job] : null, opens, inviterName: sender?.name ?? null }),
    { kind: 'org_invite', orgId: memberRow?.organization_id ?? null, ...(askedBy ? { askedBy } : {}) },
  );

  return { ok: true, existingAccount: false };
}

/** Restamps a pending row's send date (and any extra columns); a refusal to return, or null. Only a still-pending row. */
async function restampPendingRow(
  memberId: string,
  extra: Record<string, unknown>,
): Promise<{ ok: false; error: string; changed?: true } | null> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .update({ invited_at: new Date().toISOString(), ...extra })
    .eq('id', memberId)
    .eq('status', 'invited')
    .select('id');
  if (error) {
    console.error('[sendPendingInviteLink] invite date refresh failed:', error);
    return { ok: false, error: 'We couldn’t send the invitation again. Try again.' };
  }
  if (!data?.length) return { ok: false, error: 'That invitation was already answered. Reload the page.', changed: true };
  return null;
}
