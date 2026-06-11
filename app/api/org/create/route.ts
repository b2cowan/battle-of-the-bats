import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { createOrganization, createOrganizationMember, generateUniqueOrgSlug } from '@/lib/db';
import { captureError, withObservability } from '@/lib/observability';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

/**
 * Create an additional free Tournament organization for an ALREADY signed-in user —
 * the Phase-2 existing-user "add a workspace" path. Deliberately separate from
 * /api/auth/signup: that route creates the auth user (and rejects existing emails);
 * this one operates on the live session, so an existing user adds a second workspace
 * without re-signing-up. New org lands on the free `tournament` plan (migration-050
 * invariant: $0 / active / no Stripe sub) with the founding-season comp, exactly like
 * a first-time signup org.
 */
export const POST = withObservability(async (req: Request) => {
  let orgId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    // FieldLogicHQ staff are not organizers — a platform-admin session must never become
    // the owner of a public org (matches the guard on the coach create routes + register).
    if (await isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const { orgName, orgSlug } = await req.json().catch(() => ({}));
    const normalizedOrgName = typeof orgName === 'string' ? orgName.trim() : '';
    if (!normalizedOrgName) {
      return NextResponse.json({ error: 'Enter an organization name.' }, { status: 400 });
    }

    // Public URL is auto-generated from the org name (the user refines it later in
    // settings). Honor + validate an explicit orgSlug if one is ever passed.
    let slug: string;
    if (typeof orgSlug === 'string' && orgSlug.trim()) {
      slug = slugify(orgSlug);
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json({ error: 'Public URL must contain lowercase letters, numbers, and hyphens.' }, { status: 400 });
      }
      if (!(await isSlugAvailable(slug))) {
        return NextResponse.json({ error: 'That public URL is already taken. Try a different one.' }, { status: 409 });
      }
    } else {
      slug = await generateUniqueOrgSlug(normalizedOrgName);
    }

    const org = await createOrganization(normalizedOrgName, slug, 'tournament');
    if (!org) {
      return NextResponse.json({ error: 'Failed to create organization. The name or URL may already be taken.' }, { status: 400 });
    }
    orgId = org.id;

    const member = await createOrganizationMember(org.id, user.id, 'owner');
    if (!member) {
      await supabaseAdmin.from('organizations').delete().eq('id', org.id).then(() => {}, () => {});
      return NextResponse.json({ error: 'Failed to link you to the new organization.' }, { status: 500 });
    }

    // Founding Season: each new free org gets Tournament Plus comped through 2026-12-31,
    // matching /api/auth/signup. Non-fatal — creation succeeds even if this insert fails.
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
      if (compErr) console.error('[org/create] Founding season comp_period insert error:', compErr);
    }

    return NextResponse.json({ ok: true, orgSlug: org.slug });
  } catch (err) {
    console.error('[org/create] error:', err);
    void captureError(err, { route: '/api/org/create', method: 'POST', statusCode: 500 });
    if (orgId) {
      await supabaseAdmin.from('organizations').delete().eq('id', orgId).then(() => {}, () => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/org/create' });
