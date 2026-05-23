import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

let _resend: import('resend').Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
}

type Params = { params: Promise<{ memberId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const { org } = ctx;
  const { memberId } = await params;

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id, status, accepted_at')
    .eq('id', memberId)
    .eq('organization_id', org.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (member.status !== 'invited') {
    return NextResponse.json({ error: 'This member has already accepted their invitation' }, { status: 400 });
  }

  // Look up their email from the auth user record
  const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
  if (!authUser?.email) {
    return NextResponse.json({ error: 'Could not find email for this member' }, { status: 500 });
  }

  const email = authUser.email;
  const role = member.role as string;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@fieldlogichq.ca';
  const roleLabel = role === 'official' ? 'scorekeeper' : `team ${role}`;
  const officialNote = role === 'official'
    ? `<p>As a scorekeeper, you'll have access to the scorekeeper app to submit game results from your assigned tournaments. After setup, you'll land directly in Scorekeeper View.</p>`
    : '';
  const officialNoteText = role === 'official'
    ? `As a scorekeeper, you'll have access to the scorekeeper app to submit game results from your assigned tournaments. After setup, you'll land directly in Scorekeeper View.\n\n`
    : '';
  const inviteAction = role === 'official' ? 'Accept Scorekeeper Invite' : 'Accept Invitation';

  const next = encodeURIComponent(`/auth/accept-invite?org=${org.slug}`);
  const redirectTo = `${appUrl}/auth/callback?next=${next}`;

  // If the Supabase user is already confirmed, generateLink({ type: 'invite' }) fails
  // with "already registered". Use a magic link instead — same UX, gets them to
  // accept-invite where they can set display name and finalize their account.
  if (authUser.email_confirmed_at) {
    const { data: mlData, error: mlError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });
    if (mlError || !mlData) {
      return NextResponse.json({ error: mlError?.message ?? 'Failed to generate invite link' }, { status: 500 });
    }
    const inviteUrl = getActionLink(mlData);
    await getResend().emails.send({
      from: fromAddress,
      to: email,
      subject: `You've been invited to ${org.name} on FieldLogicHQ`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; color: #1a1a2e;">
  <h2 style="margin-top: 0;">You're invited!</h2>
  <p>You've been invited to join <strong>${org.name}</strong> on <strong>FieldLogicHQ</strong> as a ${roleLabel}.</p>
  ${officialNote}
  <p>Click the button below to accept your invitation and set up your account:</p>
  <p style="margin: 1.5rem 0;">
    <a href="${inviteUrl}"
       style="background: #7c3aed; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
      ${inviteAction}
    </a>
  </p>
  <p style="font-size: 0.85rem; color: #666;">If you weren't expecting this invitation, you can safely ignore this email.</p>
  <p style="font-size: 0.85rem; color: #666;">This link will expire in 24 hours.</p>
</body>
</html>`,
      text: `You've been invited to join ${org.name} on FieldLogicHQ as a ${roleLabel}.\n\n${officialNoteText}Accept your invitation here:\n${inviteUrl}\n\nThis link will expire in 24 hours.`,
    });
    // Refresh invited_at timestamp
    await supabaseAdmin
      .from('organization_members')
      .update({ invited_at: new Date().toISOString() })
      .eq('id', memberId);
    return NextResponse.json({ ok: true });
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to generate invite link' }, { status: 500 });
  }

  // Refresh invited_at so the admin can see the re-invite timestamp
  await supabaseAdmin
    .from('organization_members')
    .update({ invited_at: new Date().toISOString() })
    .eq('id', memberId);

  const inviteUrl = getActionLink(linkData);
  await getResend().emails.send({
    from: fromAddress,
    to: email,
    subject: `You've been invited to ${org.name} on FieldLogicHQ`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; color: #1a1a2e;">
  <h2 style="margin-top: 0;">You're invited!</h2>
  <p>You've been invited to join <strong>${org.name}</strong> on <strong>FieldLogicHQ</strong> as a ${roleLabel}.</p>
  ${officialNote}
  <p>Click the button below to accept your invitation and set up your account:</p>
  <p style="margin: 1.5rem 0;">
    <a href="${inviteUrl}"
       style="background: #7c3aed; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
      ${inviteAction}
    </a>
  </p>
  <p style="font-size: 0.85rem; color: #666;">If you weren't expecting this invitation, you can safely ignore this email.</p>
  <p style="font-size: 0.85rem; color: #666;">This link will expire in 24 hours.</p>
</body>
</html>`,
    text: `You're invited!

You've been invited to join ${org.name} on FieldLogicHQ as a ${roleLabel}.

${officialNoteText}Accept your invitation here:
${inviteUrl}

If you weren't expecting this invitation, you can safely ignore this email.
This link will expire in 24 hours.`,
  });

  return NextResponse.json({ ok: true });
}
