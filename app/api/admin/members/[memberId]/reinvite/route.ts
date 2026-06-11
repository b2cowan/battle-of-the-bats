import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, orgInviteHtml } from '@/lib/email';
import { withObservability } from '@/lib/observability';

function getActionLink(data: unknown) {
  return (data as { properties?: { action_link?: string | null } }).properties?.action_link ?? null;
}

type Params = { params: Promise<{ memberId: string }> };

export const POST = withObservability(async (_req: Request, { params }: Params) => {
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
  const roleLabel = role === 'official' ? 'scorekeeper' : `team ${role}`;
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
    await sendEmail(
      email,
      `You've been invited to ${org.name} on FieldLogicHQ`,
      orgInviteHtml({ orgName: org.name, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: inviteAction, scorekeeperNote: role === 'official' }),
    );
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
  await sendEmail(
    email,
    `You've been invited to ${org.name} on FieldLogicHQ`,
    orgInviteHtml({ orgName: org.name, roleLabel, inviteUrl: inviteUrl ?? appUrl, ctaLabel: inviteAction, scorekeeperNote: role === 'official' }),
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/members/[memberId]/reinvite' });
