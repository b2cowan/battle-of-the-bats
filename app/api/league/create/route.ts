import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { createOrganization, createOrganizationMember, generateUniqueOrgSlug } from '@/lib/db';
import { isReservedOrgSlug } from '@/lib/reserved-slugs';
import { captureError, withObservability } from '@/lib/observability';
import { writePlatformEvent } from '@/lib/platform-events';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';

// Abuse controls (Phase 6.6): blunt scripted mass-creation of free workspaces before the beta flag
// is turned on for real users. Best-effort, per-Lambda-instance (no external store wired). Legit use
// is one league per account, rarely a second; these windows are generous for that, tight for scripts.
// Checked most-specific → global so a throttled abuser can't burn the shared global budget for others.
const MINUTE = 60_000;
const identityLimiter = new FixedWindowRateLimiter(15 * MINUTE, 3); // per signed-in account (id + email)
const ipLimiter = new FixedWindowRateLimiter(60 * MINUTE, 8);       // per source IP (spoofable → global backstop)
const globalLimiter = new FixedWindowRateLimiter(5 * MINUTE, 30);   // spoofing-proof ceiling across all callers

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function isSlugAvailable(slug: string) {
  // Never hand out a slug that collides with a top-level app route (it would shadow the org's pages).
  if (isReservedOrgSlug(slug)) return false;
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return !data;
}

/**
 * Create a FREE League Starter workspace for an ALREADY signed-in user (the signed-out
 * flow creates the account first, then calls this on the live session — mirrors /start/team).
 *
 * The org lands on the free `tournament` plan with `free_floor='league_starter'`: a free-floor
 * ENTITLEMENT PROFILE (not a new OrgPlan key) that unions `module_house_league` + server-side
 * caps (1 season / 1 division / 8 teams) on top of the paid ladder. No payments. The org reuses
 * the existing house-league onboarding wizard (whose trigger now keys off the house-league
 * entitlement, so a free-floor org reaches it).
 *
 * Gated behind the LEAGUE_STARTER_BETA flag (unlisted, capped beta) until caps are proven.
 */
export const POST = withObservability(async (req: Request) => {
  // Capped beta: off by default. The /start/league page renders the waitlist when this is off,
  // so a create request only arrives when the flag is on — but guard the route too (defense-in-depth).
  if (process.env.LEAGUE_STARTER_BETA !== 'true') {
    return NextResponse.json({ error: 'League is not available yet.' }, { status: 403 });
  }

  let orgId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    // FieldLogicHQ staff are not operators — a platform-admin session must never own a public org.
    if (await isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const { orgName, orgSlug } = await req.json().catch(() => ({}));
    const normalizedOrgName = typeof orgName === 'string' ? orgName.trim() : '';
    if (!normalizedOrgName) {
      return NextResponse.json({ error: 'Enter a league name.' }, { status: 400 });
    }

    // Rate-limit (Phase 6.6): only once we have a real create attempt (authed + named), so a typo'd
    // name doesn't burn the budget. Per-identity and per-IP first, then the global ceiling — so an
    // abuser stuck at their own limit can't drain the shared global allowance from legitimate users.
    const email = user.email.toLowerCase();
    const ip = clientIpFrom(req);
    const limited =
      !identityLimiter.take(`u:${user.id}`) ||
      !identityLimiter.take(`e:${email}`) ||
      !ipLimiter.take(`ip:${ip}`) ||
      !globalLimiter.take('global');
    if (limited) {
      console.warn(`[league/create] rate-limited create attempt user=${user.id} ip=${ip}`);
      return NextResponse.json(
        { error: "You've created several leagues in a short time. Please wait a few minutes and try again." },
        { status: 429 },
      );
    }

    // Distinguish a brand-new account's first floor from an existing user adding one (§13 events).
    // Counted before the new org's membership exists, so any prior membership means "existing user".
    const { count: priorMembershipCount, error: membershipCountErr } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (membershipCountErr) {
      // Non-fatal: the floor still gets created; only the existingUser attribution may be wrong.
      console.warn('[league/create] prior-membership count failed (existingUser may be inaccurate):', membershipCountErr);
    }
    const isExistingUser = (priorMembershipCount ?? 0) > 0;

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

    // Free League Starter: plan_id='tournament' (free, $0, no Stripe sub) + the league_starter
    // free-floor profile. house-league access + caps come from free_floor, never from the comp.
    const org = await createOrganization(normalizedOrgName, slug, 'tournament', { freeFloor: 'league_starter' });
    if (!org) {
      return NextResponse.json({ error: 'Failed to create your league. The name or URL may already be taken.' }, { status: 400 });
    }
    orgId = org.id;

    const member = await createOrganizationMember(org.id, user.id, 'owner');
    if (!member) {
      await supabaseAdmin.from('organizations').delete().eq('id', org.id).then(() => {}, () => {});
      return NextResponse.json({ error: 'Failed to link you to the new league.' }, { status: 500 });
    }

    // Instrumentation (§13). Fire-and-forget — writePlatformEvent never throws; never block the
    // create response on a measurement write. Lands in platform_events → Command Center.
    await writePlatformEvent({
      eventType: 'free_floor_created',
      source: 'app',
      orgId: org.id,
      actorUserId: user.id,
      actorEmail: user.email,
      planId: 'tournament',
      metadata: { freeFloor: 'league_starter', existingUser: isExistingUser },
    });
    if (isExistingUser) {
      await writePlatformEvent({
        eventType: 'existing_user_floor_added',
        source: 'app',
        orgId: org.id,
        actorUserId: user.id,
        actorEmail: user.email,
        metadata: { freeFloor: 'league_starter' },
      });
    }

    // Founding Season comp parity with /api/org/create. Harmless for the floor: comp_period is
    // billing-only and grants no modules, so it can't widen the free-floor scope.
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
      if (compErr) console.error('[league/create] Founding season comp_period insert error:', compErr);
    }

    return NextResponse.json({ ok: true, orgSlug: org.slug });
  } catch (err) {
    console.error('[league/create] error:', err);
    void captureError(err, { route: '/api/league/create', method: 'POST', statusCode: 500 });
    if (orgId) {
      await supabaseAdmin.from('organizations').delete().eq('id', orgId).then(() => {}, () => {});
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}, { route: '/api/league/create' });
