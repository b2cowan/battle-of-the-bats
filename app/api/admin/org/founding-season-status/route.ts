import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrgBillingFacts } from '@/lib/billing-setup';
import { isFoundingSeasonCompExpiry } from '@/lib/plan-config';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/admin/org/founding-season-status
 *
 * Returns whether this org has an active founding season comp_period override, and — since the
 * summer ask was built (FOUNDING_SEASON_2027_DESK_PLAN.md) — the two facts the billing page needs
 * to decide WHICH ask to show: is there a card on file, and has a plan been chosen for next season.
 *
 * Founding Season = a comp_period whose expires_at falls on FOUNDING_SEASON_END's calendar date
 * (auto-assigned at signup while the signup window is open — see lib/plan-config.ts).
 *
 * ⚠ THE COMP STATUS IS FOR EVERY MEMBER; THE BILLING FACTS ARE NOT. "This org is on the Founding
 * Season until September 30" is ordinary account context that any member's shell may render. A
 * card's brand and last four, and the account's commitment for next season, are billing data — the
 * rest of the codebase treats those as owner-only, and every sibling billing route gates on the
 * `billing` capability. Without this split, any coach or scorekeeper could read their org's card
 * fingerprint by calling this endpoint directly.
 *
 * ⚠ Card-on-file is read from the account's own service-role-only facts table (mig 283), never from
 * stripe_customer_id: comp reactivation and subscription deletion both NULL that column while the
 * card is still there.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();

  const canReadBilling = hasCapability(ctx.role, ctx.capabilities ?? null, 'billing');

  const [{ data }, facts] = await Promise.all([
    supabaseAdmin
      .from('org_overrides')
      .select('expires_at')
      .eq('org_id', ctx.org.id)
      .eq('type', 'comp_period')
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    canReadBilling ? getOrgBillingFacts(ctx.org.id) : Promise.resolve(null),
  ]);

  const card = facts?.cardOnFileAt
    ? { savedAt: facts.cardOnFileAt, brand: facts.cardBrand, last4: facts.cardLast4 }
    : null;

  const nextSeason = facts?.nextSeasonPlanId
    ? {
        planKey: facts.nextSeasonPlanId,
        billingCycle: facts.nextSeasonBillingCycle ?? 'annual',
        chosenAt: facts.nextSeasonChosenAt,
      }
    : null;

  const compUntil = (data?.expires_at as string | undefined) ?? null;
  return NextResponse.json({
    isFoundingSeason: compUntil ? isFoundingSeasonCompExpiry(compUntil) : false,
    compUntil,
    card,
    nextSeason,
  });
}, { route: '/api/admin/org/founding-season-status' });
