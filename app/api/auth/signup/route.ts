import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createOrganization, createOrganizationMember } from '@/lib/db';
import { sendEmail, signupVerificationHtml } from '@/lib/email';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function shouldRequireEmailVerification() {
  const explicit = process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
  if (explicit !== undefined) return explicit === 'true';
  return process.env.NODE_ENV === 'production';
}

export async function POST(req: Request) {
  try {
    const { email, password, orgName } = await req.json();

    if (!email || !password || !orgName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const slug = slugify(orgName);
    if (!slug) {
      return NextResponse.json({ error: 'Organization name is invalid.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const requireVerification = shouldRequireEmailVerification();
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'https://www.fieldlogichq.ca';

    if (requireVerification && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email verification is not configured.' }, { status: 500 });
    }

    let userId: string;
    let actionLink: string | null = null;

    if (requireVerification) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password,
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/${slug}/admin/onboarding?choosePlan=1`)}`,
        },
      });

      if (linkError || !linkData?.user || !linkData.properties?.action_link) {
        const msg = linkError?.message ?? 'Failed to create verification link.';
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      userId = linkData.user.id;
      actionLink = linkData.properties.action_link;
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        const msg = authError?.message ?? 'Failed to create user account.';
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      userId = authData.user.id;
    }

    // Create the organization
    const org = await createOrganization(orgName, slug, 'tournament');
    if (!org) {
      // Roll back auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to create organization. The name or URL may already be taken.' }, { status: 400 });
    }

    // Link user as owner
    const member = await createOrganizationMember(org.id, userId, 'owner');
    if (!member) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to link user to organization.' }, { status: 500 });
    }

    if (requireVerification) {
      if (!actionLink) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: 'Failed to generate verification email.' }, { status: 500 });
      }

      const verifyUrl = `${origin}/auth/signup-confirm?link=${encodeURIComponent(actionLink)}`;
      await sendEmail(
        normalizedEmail,
        'Verify your FieldLogicHQ email',
        signupVerificationHtml({ orgName, verifyUrl })
      );

      return NextResponse.json({
        success: true,
        requiresEmailVerification: true,
        email: normalizedEmail,
        orgSlug: org.slug,
      });
    }

    return NextResponse.json({ success: true, orgSlug: org.slug, requiresEmailVerification: false });
  } catch (err) {
    console.error('Signup route error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
