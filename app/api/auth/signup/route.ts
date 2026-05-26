import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createOrganization, createOrganizationMember } from '@/lib/db';
import { sendEmail, signupVerificationHtml, foundingWelcomeHtml } from '@/lib/email';
import { sendMarketingEmail, createEmailBatch, finalizeBatch } from '@/lib/email-sender';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';

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

async function isSlugAvailable(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return !data;
}

async function rollbackOrganization(id: string) {
  const { error } = await supabaseAdmin.from('organizations').delete().eq('id', id);
  if (error) console.error('Signup rollback organization error:', error);
}

async function rollbackAuthUser(id: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) console.error('Signup rollback auth user error:', error);
}

export async function POST(req: Request) {
  let userId: string | null = null;
  let orgId: string | null = null;

  try {
    const { email, password, orgName, orgSlug } = await req.json();

    if (!email || !password || !orgName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPassword = String(password);
    const normalizedOrgName = String(orgName).trim();
    const slug = slugify(typeof orgSlug === 'string' && orgSlug.trim() ? orgSlug : normalizedOrgName);

    if (!normalizedEmail || !normalizedOrgName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (normalizedPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ error: 'Public URL must contain lowercase letters, numbers, and hyphens.' }, { status: 400 });
    }
    if (!(await isSlugAvailable(slug))) {
      return NextResponse.json({ error: 'That public URL is already taken. Try a different one.' }, { status: 409 });
    }

    const requireVerification = shouldRequireEmailVerification();
    const origin =
      req.headers.get('origin') ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'https://www.fieldlogichq.ca';

    if (requireVerification && !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email verification is not configured.' }, { status: 500 });
    }

    let actionLink: string | null = null;

    if (requireVerification) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: normalizedEmail,
        password: normalizedPassword,
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
        password: normalizedPassword,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        const msg = authError?.message ?? 'Failed to create user account.';
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      userId = authData.user.id;
    }

    // Create the organization
    const org = await createOrganization(normalizedOrgName, slug, 'tournament');
    if (!org) {
      // Roll back auth user on failure
      if (userId) await rollbackAuthUser(userId);
      return NextResponse.json({ error: 'Failed to create organization. The name or URL may already be taken.' }, { status: 400 });
    }
    orgId = org.id;

    // Link user as owner
    const member = await createOrganizationMember(org.id, userId, 'owner');
    if (!member) {
      await rollbackOrganization(org.id);
      await rollbackAuthUser(userId);
      return NextResponse.json({ error: 'Failed to link user to organization.' }, { status: 500 });
    }

    // Founding Season: auto-assign comp_period override
    // Tournament Plus is free through December 31, 2026 for all founding organizations.
    // This is non-fatal — org creation continues even if this insert fails.
    const FOUNDING_SEASON_EXPIRES_AT = '2027-01-01T00:00:00.000Z';
    if (new Date() < new Date(FOUNDING_SEASON_EXPIRES_AT)) {
      const { error: compErr } = await supabaseAdmin.from('org_overrides').insert({
        org_id: org.id,
        type: 'comp_period',
        value: null,
        expires_at: FOUNDING_SEASON_EXPIRES_AT,
        reason: 'Founding Season — Tournament Plus free through December 31, 2026',
        created_by: 'system',
      });
      if (compErr) {
        console.error('[signup] Founding season comp_period insert error:', compErr);
      }
    }

    // ── Founding Season: send founding_welcome email ──────────────────────────
    // Fires immediately at signup for every org created during the founding window.
    // This is a transactional welcome email — it bypasses the opt-out check.
    // Non-fatal: a Resend error or missing API key does not block the signup response.
    if (new Date() < new Date(FOUNDING_SEASON_EXPIRES_AT)) {
      try {
        const setupUrl = `${origin}/${org.slug}/admin/onboarding`;
        const unsubscribeUrl = buildUnsubscribeUrl(org.id);
        const welcomeHtml = foundingWelcomeHtml({
          orgName: normalizedOrgName,
          setupUrl,
          unsubscribeUrl,
        });

        // Create a single-send batch so it appears in the email dashboard
        const batchId = await createEmailBatch({
          emailKey: 'founding_welcome',
          subject: 'Your founding season starts now — Tournament Plus is free through Dec 31',
          triggeredBy: 'signup',
          recipientCount: 1,
        });

        const result = await sendMarketingEmail({
          emailKey: 'founding_welcome',
          orgId: org.id,
          toEmail: normalizedEmail,
          subject: 'Your founding season starts now — Tournament Plus is free through Dec 31',
          html: welcomeHtml,
          batchId: batchId ?? undefined,
          skipOptOutCheck: true, // transactional — always send regardless of opt-out
        });

        if (batchId) {
          await finalizeBatch(batchId, result === 'failed' ? 'failed' : 'complete');
        }

        if (result === 'failed') {
          console.warn('[signup] founding_welcome send failed — signup continues');
        }
      } catch (welcomeErr) {
        // Never block signup on email failure
        console.error('[signup] founding_welcome error (non-fatal):', welcomeErr);
      }
    }

    if (requireVerification) {
      if (!actionLink) {
        await rollbackOrganization(org.id);
        await rollbackAuthUser(userId);
        return NextResponse.json({ error: 'Failed to generate verification email.' }, { status: 500 });
      }

      const verifyUrl = `${origin}/auth/signup-confirm?link=${encodeURIComponent(actionLink)}`;
      await sendEmail(
        normalizedEmail,
        'Verify your FieldLogicHQ email',
        signupVerificationHtml({ orgName: normalizedOrgName, verifyUrl })
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
    if (orgId) {
      await rollbackOrganization(orgId).catch(() => {});
    }
    if (userId) {
      await rollbackAuthUser(userId).catch(() => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
