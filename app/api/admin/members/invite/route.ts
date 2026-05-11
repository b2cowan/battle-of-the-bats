import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgRole } from '@/lib/types';

let _resend: import('resend').Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const INVITABLE_ROLES: OrgRole[] = ['admin', 'staff', 'official', 'league_admin', 'league_registrar', 'treasurer'];

const ROLE_EMAIL_LABEL: Record<OrgRole, string> = {
  owner: 'owner',
  admin: 'administrator',
  staff: 'staff member',
  official: 'field official (scorekeeper)',
  league_admin: 'league administrator',
  league_registrar: 'league registrar',
  treasurer: 'treasurer',
  coach: 'coach',
};

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const body = await req.json();
  const email: string = String(body.email ?? '').trim().toLowerCase();
  const role: OrgRole = INVITABLE_ROLES.includes(body.role) ? (body.role as OrgRole) : 'staff';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const planCfg = PLAN_CONFIG[org.planId];

  // Officials are free on Pro/Elite — skip the seat check entirely for them.
  const skipSeatCheck = role === 'official' && planCfg.officialsFreeSeats;

  if (!skipSeatCheck) {
    // Count only billable seats (exclude officials on plans where they are free).
    let seatQuery = supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    if (planCfg.officialsFreeSeats) {
      seatQuery = seatQuery.neq('role', 'official');
    }

    const { count: seatCount } = await seatQuery;
    const seatLimit = planCfg.seatLimit;

    if ((seatCount ?? 0) >= seatLimit) {
      return NextResponse.json(
        { error: `Seat limit reached (${seatLimit} seat${seatLimit === 1 ? '' : 's'} on the ${planCfg.label} plan). Upgrade to add more members.` },
        { status: 403 }
      );
    }
  }

  // Check if a Supabase auth user already exists with this email.
  // NOTE: supabase.auth.admin.getUserByEmail() is not available in supabase-js v2.x.
  // Using listUsers with perPage:1000 — sufficient for current platform scale.
  // Revisit with pagination or a direct email lookup API when the user base grows.
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = usersData?.users.find(u => u.email?.toLowerCase() === email);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@fieldlogichq.ca';
  const roleLabel = ROLE_EMAIL_LABEL[role] ?? role;

  if (existingUser) {
    // Check they're not already in THIS org
    const { data: sameMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', existingUser.id)
      .maybeSingle();

    if (sameMember) {
      return NextResponse.json({ error: 'This user is already a member of this organization' }, { status: 409 });
    }

    // One-org constraint: reject if they belong to any other org
    const { data: otherMembers } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', existingUser.id)
      .limit(1);

    if (otherMembers && otherMembers.length > 0) {
      return NextResponse.json(
        { error: 'This user already belongs to another organization. They must be removed from their current organization before being invited here.' },
        { status: 409 }
      );
    }

    // Add directly with accepted_at = now
    const { error: insertError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: existingUser.id,
        role,
        status: 'active',
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: user.id, target_id: existingUser.id,
      action: 'member_invited', payload: { email, role },
    });

    // Notify the existing user that they now have access to this org.
    await getResend().emails.send({
      from: fromAddress,
      to: email,
      subject: `You've been added to ${org.name} on FieldLogicHQ`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; color: #1a1a2e;">
  <h2 style="margin-top: 0;">You've been added to ${org.name}</h2>
  <p>You now have access to <strong>${org.name}</strong> on <strong>FieldLogicHQ</strong> as a ${roleLabel}.</p>
  <p>No action is required — just sign in to get started:</p>
  <p style="margin: 1.5rem 0;">
    <a href="${appUrl}/auth/login"
       style="background: #7c3aed; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
      Sign In
    </a>
  </p>
  <p style="font-size: 0.85rem; color: #666;">If you weren't expecting this, you can safely ignore this email.</p>
</body>
</html>`,
      text: `You've been added to ${org.name} on FieldLogicHQ as a ${roleLabel}.

No action is required — just sign in to get started:
${appUrl}/auth/login

If you weren't expecting this, you can safely ignore this email.`,
    });

    return NextResponse.json({ ok: true, added: true });
  }

  // User doesn't exist — generate Supabase invite link.
  // Route through /auth/callback so the PKCE code is exchanged server-side
  // before the accept-invite page renders. The callback then redirects to next.
  const next = encodeURIComponent(`/auth/accept-invite?org=${org.slug}`);
  const redirectTo = `${appUrl}/auth/callback?next=${next}`;
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message ?? 'Failed to generate invite link' }, { status: 500 });
  }

  // Create pending member row (no accepted_at)
  const newUserId = (linkData.user as any)?.id;
  if (newUserId) {
    await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: newUserId,
        role,
        status: 'invited',
        invited_at: new Date().toISOString(),
      });

    void supabaseAdmin.from('org_audit_log').insert({
      org_id: org.id, actor_id: user.id, target_id: newUserId,
      action: 'member_invited', payload: { email, role },
    });
  }

  // Send invite email via Resend
  const inviteUrl = (linkData as any).properties?.action_link ?? linkData.properties?.action_link;

  const officialNote = role === 'official'
    ? `<p>As a field official, you'll have access to the score entry app to submit game results from your assigned diamonds.</p>`
    : '';
  const officialNoteText = role === 'official'
    ? `As a field official, you'll have access to the score entry app to submit game results from your assigned diamonds.\n\n`
    : '';
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
      Accept Invitation
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

  return NextResponse.json({ ok: true, added: false });
}
