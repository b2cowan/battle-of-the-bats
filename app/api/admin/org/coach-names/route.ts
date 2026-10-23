import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadListingSeats } from '@/lib/coach-names-audience';
import { tellCoachesNewlyListed } from '@/lib/coach-names-notify';
import {
  DEFAULT_COACH_NAMES_POLICY, listingChange, parseCoachNamesPolicy, sanitizeCoachNamesPolicy,
} from '@/lib/coach-names-policy';
import { withObservability, captureAndJson } from '@/lib/observability';

/**
 * /api/admin/org/coach-names — WHO THE CLUB LISTS AS A COACH ON TEAM PAGES (mig 352; owner rulings 2026-10-23).
 *
 * Team pages are a Club feature, so both verbs need the rep-teams capability AND entitlement. ⚖ The OWNER'S ALONE to change
 * (ruling A2) — an admin may read. It is not "the club's look", so it has no door through `/api/admin/org-settings`, and it
 * lives here, not under `/api/coaches` (the look-back year guard scans that folder).
 */
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

/**
 * GET `?policy=<candidate>` — the club's saved choice, and what moving to the candidate WOULD do: the people it newly lists
 * (heads, assistants, teams) and the people it would stop listing. The window's sentences state these real counts — nothing
 * hard-coded. Counts cover only active staff with a name on file on teams that are not archived and have a live season.
 */
export const GET = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const policy = sanitizeCoachNamesPolicy(ctx!.org.coachNamesPolicy);
  const candidate = parseCoachNamesPolicy(req.nextUrl.searchParams.get('policy'));
  if (!candidate) return NextResponse.json({ policy, canEdit: ctx!.role === 'owner' });

  const change = listingChange(policy, candidate, await loadListingSeats(ctx!.org.id));
  return NextResponse.json({
    policy,
    canEdit: ctx!.role === 'owner',
    candidate,
    newlyListed: { people: change.newlyListedUserIds.length, heads: change.heads, assistants: change.assistants, teams: change.teams },
    noLongerListed: change.noLongerListed,
  });
}, { route: '/api/admin/org/coach-names' });

/**
 * PATCH `{ policy }` — the owner's save. The choice never writes a coach's own switch. A coach the new choice newly lists
 * is told once, best-effort (an in-app notice); nothing is sent when names are hidden or control is given back.
 */
export const PATCH = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => null) as { policy?: unknown } | null;
  const next = parseCoachNamesPolicy(body?.policy);
  if (!next) return NextResponse.json({ error: 'Pick one of the four choices.' }, { status: 400 });

  const before = sanitizeCoachNamesPolicy(ctx!.org.coachNamesPolicy ?? DEFAULT_COACH_NAMES_POLICY);
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update({ coach_names_policy: next })
    .eq('id', ctx!.org.id)
    .select('coach_names_policy')
    .single();
  if (error) return captureAndJson(error, { error: 'Couldn’t save your changes. Try again.' }, 500);

  // The choice has landed; telling people is best-effort and never turns a saved choice into an error.
  if (next !== before) {
    try {
      const change = listingChange(before, next, await loadListingSeats(ctx!.org.id));
      await tellCoachesNewlyListed({
        org: { id: ctx!.org.id, slug: ctx!.org.slug, name: ctx!.org.name },
        actorUserId: ctx!.user.id,
        change,
      });
    } catch (e) {
      console.error('[coach-names] notice step failed (the choice was saved):', e);
    }
  }
  return NextResponse.json({ policy: sanitizeCoachNamesPolicy(data.coach_names_policy) });
}, { route: '/api/admin/org/coach-names' });
