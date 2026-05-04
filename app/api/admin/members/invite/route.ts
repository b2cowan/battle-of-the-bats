import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgRole } from '@/lib/types';

let _resend: import('resend').Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  // Verify caller is owner
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Enforce seat limit
  const { count: seatCount } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id);

  const seatLimit = PLAN_CONFIG[org.planId].seatLimit;
  if ((seatCount ?? 0) >= seatLimit) {
    return NextResponse.json(
      { error: `Seat limit reached (${seatLimit} seat${seatLimit === 1 ? '' : 's'} on the ${PLAN_CONFIG[org.planId].label} plan). Upgrade to add more members.` },
      { status: 403 }
    );
  }

  const body = await req.json();
  const email: string = String(body.email ?? '').trim().toLowerCase();
  const role: OrgRole = body.role === 'admin' ? 'admin' : body.role === 'official' ? 'official' : 'staff';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Check if a Supabase auth user already exists with this email
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = usersData?.users.find(u => u.email?.toLowerCase() === email);

  if (existingUser) {
    // Check they're not already a member
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ error: 'This user is already a member of the organization' }, { status: 409 });
    }

    // Add directly with accepted_at = now
    const { error: insertError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: existingUser.id,
        role,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, added: true });
  }

  // User doesn't exist — generate Supabase invite link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://battleofthebats.ca';
  const redirectTo = role === 'official'
    ? `${appUrl}/${org.slug}/official/score`
    : `${appUrl}/${org.slug}/admin`;
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to generate invite link' }, { status: 500 });
  }

  // Create pending member row (no accepted_at)
  // Use the user id from the generated link if available, otherwise a placeholder
  const newUserId = (linkData.user as any)?.id;
  if (newUserId) {
    await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: newUserId,
        role,
        invited_at: new Date().toISOString(),
      });
  }

  // Send invite email via Resend
  const inviteUrl = (linkData as any).properties?.action_link ?? linkData.properties?.action_link;

  const fromDomain = new URL(appUrl).hostname;
  const roleLabel = role === 'official' ? 'field official (scorekeeper)' : `team ${role}`;
  const officialNote = role === 'official'
    ? `<p>As a field official, you'll have access to the score entry app to submit game results from your assigned diamonds.</p>`
    : '';
  await getResend().emails.send({
    from: `noreply@${fromDomain}`,
    to: email,
    subject: `You've been invited to ${org.name} on Battle of the Bats`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; color: #1a1a2e;">
  <h2 style="margin-top: 0;">You're invited!</h2>
  <p>You've been invited to join <strong>${org.name}</strong> on <strong>Battle of the Bats</strong> as a ${roleLabel}.</p>
  ${officialNote}
  <p>Click the button below to accept your invitation and set up your account:</p>
  <p style="margin: 1.5rem 0;">
    <a href="${inviteUrl}"
       style="background: #7c3aed; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
      Accept Invitation
    </a>
  </p>
  <p style="font-size: 0.85rem; color: #666;">If you weren't expecting this invitation, you can safely ignore this email.</p>
  <p style="font-size: 0.85rem; color: #666;">This link will expire in 24 hours.</p>
</body>
</html>`,
  });

  return NextResponse.json({ ok: true, added: false });
}
