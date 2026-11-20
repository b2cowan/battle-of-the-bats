import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearStartDoor } from '@/lib/start-door-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { createOrganization, createOrganizationMember, generateUniqueOrgSlug } from '@/lib/db';
import { isReservedOrgSlug } from '@/lib/reserved-slugs';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { demoActorRefusal } from '@/lib/demo-guard';
import { userBelongsToOtherRealOrg } from '@/lib/org-membership-policy';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';
import { slugifyOrgName } from '@/lib/utils';
import { requireAcceptance } from '@/lib/legal-acceptance';
import { getSignedInUser } from '@/lib/two-step-session';
import { hasLiveInvitation } from '@/lib/invite-reconciliation';
import { paidDoorOf, parseStartPaidPlan } from '@/lib/start-door';
import { isPaidDoorOpen } from '@/lib/start-plan-server';
import { getActiveOwnedTeamWorkspace } from '@/lib/team-workspace-owned';

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
 * invariant: $0 / active / no Stripe sub), exactly like
 * a first-time signup org.
 */
export const POST = withObservability(async (req: Request) => {
  let orgId: string | null = null;
  try {
    const supabase = await createClient();
    const user = await getSignedInUser(supabase);
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    // A "See it live" demo account never creates a real club (Board Ready trust close-out 1) — refused by WHO it is, not
    // through the one-club rule below, which lets a request through when its own read fails.
    const demoRefusal = demoActorRefusal(user);
    if (demoRefusal) return demoRefusal;
    // FieldLogicHQ staff are not organizers — a platform-admin session must never become
    // the owner of a public org (matches the guard on the coach create routes + register).
    if (await isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    // Nobody starts an organization without the current Terms (GST/HST Stage 6 step 6.3, C1) — before every branch.
    // Live since step 6.7 (2026-11-17, `lib/legal-pages-switch.ts`).
    const terms = await requireAcceptance(user);
    if (!terms.ok) return terms.response;

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
    // A run-out invitation (P2c) is not somewhere to go: it is off Home and can't be accepted, so it never blocks.
    if (await hasLiveInvitation(user.id)) {
      return NextResponse.json(
        { error: 'You have a pending invitation. Accept it from your home screen before creating a new organization.' },
        { status: 409 }
      );
    }

    const { orgName, orgSlug, startPlan: rawStartPlan } = await req.json().catch(() => ({}));
    // A paid door (On-sale pages S2): Start a club sends `club` or `club_large`, Start a league season `league`. The
    // organization is still made on the free Tournament plan and remembers the plan
    // (organizations.start_plan) for the plan step, an abandoned checkout and the wait after Stripe.
    const startPlan = rawStartPlan === undefined || rawStartPlan === null ? null : parseStartPaidPlan(rawStartPlan);
    if (rawStartPlan !== undefined && rawStartPlan !== null && !startPlan) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
    }
    const paidDoor = startPlan ? paidDoorOf(startPlan) : null;
    const nameWord = paidDoor === 'club' ? 'club' : paidDoor === 'league' ? 'league' : 'organization';
    const normalizedOrgName = typeof orgName === 'string' ? orgName.trim() : '';
    if (!normalizedOrgName) {
      return NextResponse.json({ error: paidDoor === 'club' ? 'Enter a club name.' : paidDoor === 'league' ? 'Enter a league name.' : 'Enter an organization name.' }, { status: 400 });
    }
    if (paidDoor) {
      // The door is on sale, read from the live gate (the page shows the interest form while it is closed; this holds when
      // the page is bypassed or the gate closed between the two).
      if (!(await isPaidDoorOpen(paidDoor))) {
        return NextResponse.json({ error: 'This plan is not open for sign-up yet.', code: 'plan_not_on_sale' }, { status: 403 });
      }
      // Trap D: a coach's own Coaches Portal does not count as a real organization (above), so a Premium coach would
      // otherwise make a second organization here and strand their team outside it. Their club starts in place, from their
      // portal's Plan & billing (the "Start your club" window), which keeps the team. The page sends them there first.
      if (paidDoor === 'club') {
        const portal = await getActiveOwnedTeamWorkspace(user.id);
        if (portal) {
          return NextResponse.json({
            error: 'Your Coaches Portal becomes your club, with your team in it. Start your club from your portal’s Plan & billing.',
            code: 'start_club_in_place',
            href: `/${portal.orgSlug}/coaches/billing`,
          }, { status: 409 });
        }
      }
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
      return NextResponse.json({ error: `Failed to create your ${nameWord}. The name or URL may already be taken.` }, { status: 400 });
    }
    orgId = org.id;
    if (startPlan) {
      // Part of the door's promise: without it the plan step and the return from Stripe would treat a club as a tournament
      // organization, so a failed write undoes the creation (the catch below deletes the organization).
      const { error: startPlanError } = await supabaseAdmin.from('organizations').update({ start_plan: startPlan }).eq('id', org.id);
      if (startPlanError) throw startPlanError;
    }

    const member = await createOrganizationMember(org.id, user.id, 'owner');
    if (!member) {
      await supabaseAdmin.from('organizations').delete().eq('id', org.id).then(() => {}, () => {});
      return captureAndJson(
        new Error('createOrganizationMember returned null (owner link failed)'),
        { error: 'Failed to link you to the new organization.' },
        500,
      );
    }

    // Account-first (Part 2): the organization is made, so Home's waiting workspace has done its job.
    await clearStartDoor(user.id, paidDoor ? [paidDoor] : ['organization']);

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
