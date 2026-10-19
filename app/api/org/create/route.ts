import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { FOUNDING_SEASON_END_LABEL } from '@/lib/plan-config';
import { ensureFoundingSeasonCompPeriod, foundingSeasonOfferFor } from '@/lib/founding-season';
import { clearStartDoor } from '@/lib/start-door-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { createOrganization, createOrganizationMember, generateUniqueOrgSlug } from '@/lib/db';
import { isReservedOrgSlug } from '@/lib/reserved-slugs';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';
import { slugifyOrgName } from '@/lib/utils';

async function isSlugAvailable(slug: string) {
  // Never hand out a slug that collides with a top-level app route (it would shadow the org's pages).
  if (isReservedOrgSlug(slug)) return false;
  // Demo-org slugs are never available to a real signup — a real org squatting one would be
  // adopted, and overwritten, by the demo seed the day the sandbox ships to this environment.
  if (isDemoOrgSlug(slug)) return false;
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return !data;
}

/**
 * Create a free Tournament organization for an ALREADY signed-in user — step 2 of Run a tournament
 * since Account-First Sign-up Part 2 (2026-10-19), and the existing-user "add a workspace" path. Deliberately separate from
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

    // Single-org by default (decision 2026-06-19): a signed-in user who already belongs to a REAL
    // organization cannot self-serve a second — a second org comes only from a deliberate invite or
    // a Coaches Portal purchase. A user's OWN Coaches Portal (team_workspace) does NOT count, so a
    // portal-owning coach can still create their first real org. Uses the shared exemption-aware
    // helper (same rule accept-invite enforces); mirrors the /start/tournament page redirect and is
    // the server-side enforcement so the rule holds even if the page guard is bypassed.
    if (await userBelongsToOtherRealOrg(user.id)) {
      return NextResponse.json(
        { error: 'Your account already has a workspace. To join another organization, ask them to invite you.' },
        { status: 403 }
      );
    }

    // A PENDING invite (not yet accepted) means the user already has somewhere to go — don't let
    // them spin up a stray org first (which would then block the accept via the single-org guard).
    // Server-side mirror of the /start/tournament page redirect to /home.
    const { count: pendingInvites } = await supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'invited');
    if ((pendingInvites ?? 0) > 0) {
      return NextResponse.json(
        { error: 'You have a pending invitation. Accept it from your home screen before creating a new organization.' },
        { status: 409 }
      );
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
      slug = slugifyOrgName(orgSlug);
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
      return captureAndJson(
        new Error('createOrganizationMember returned null (owner link failed)'),
        { error: 'Failed to link you to the new organization.' },
        500,
      );
    }

    // Founding Season: a new free org gets Tournament Plus comped through FOUNDING_SEASON_END while the sign-up window
    // is open — and after it, when the ACCOUNT was made by the close and this is the organization its Run a tournament
    // sign-up came for (A5 + edge (a), 2026-10-19; the one rule, lib/founding-season.ts). Non-fatal — creation
    // succeeds even if this insert fails.
    if (foundingSeasonOfferFor(user, 'organization')) {
      try {
        await ensureFoundingSeasonCompPeriod(org.id, 'system', `Founding Season — Tournament Plus free through ${FOUNDING_SEASON_END_LABEL}`);
      } catch (compErr) {
        console.error('[org/create] Founding season comp_period insert error:', compErr);
      }
    }

    // Account-first (Part 2): the organization is made, so Home's waiting workspace has done its job.
    await clearStartDoor(user.id, ['organization']);

    return NextResponse.json({ ok: true, orgSlug: org.slug });
  } catch (err) {
    console.error('[org/create] error:', err);
    await captureError(err, { route: '/api/org/create', method: 'POST', statusCode: 500 });
    if (orgId) {
      await supabaseAdmin.from('organizations').delete().eq('id', orgId).then(() => {}, () => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/org/create' });
