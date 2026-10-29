import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerFreeTime } from '@/lib/entitlement-grants';
import { getEffectiveTournamentLimit, isFoundingSeasonCompExpiry } from '@/lib/plan-config';
import { foundingCompAppliesToPlan } from '@/lib/founding-season';
import { formatLongDay, isGrantRunning, lastDayOfInstant } from '@/lib/free-time';
import { SLOT_STATUSES } from '@/lib/tournament-slot';
import { withObservability } from '@/lib/observability';
import { customerPortalFreeTime, endedPortalFreeTime } from '@/lib/portal-free-time-server';

/**
 * The customer's free time, for their Plan & billing page (Support console Stage 4, owner ruling Q8): running, ending (the
 * last 14 days) or ended (for 30 days after), whole-plan grants only. It says the given plan, the last free day, the plan
 * it goes back to, and whether the club will hold more tournaments than its own plan allows — NEVER the reason, the giver
 * or the grant (T15). Read through the door's own rules on the server (T17); `org_overrides` stays server-only.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  // Billing must distinguish an unavailable read from no grant, and an old ended grant from cancellation.
  // Other consumers keep their existing 30-day informational band window.
  const billingView = new URL(req.url).searchParams.get('billing') === '1';
  if (billingView && ctx.role !== 'owner') return forbidden();

  // A Coaches Portal staff gave free time (Stage 4b, Part 5): its state and last free day only (T24), never a whole-plan
  // grant (a portal holds none). A failed read says nothing rather than failing the page.
  if (ctx.org.accountKind === 'team_workspace') {
    try {
      let portal = await customerPortalFreeTime(ctx.org.id);
      if (!portal && billingView) {
        const ended = await endedPortalFreeTime(ctx.org.id);
        if (ended) portal = { state: 'ended', lastDay: ended.lastDay };
      }
      return NextResponse.json({ freeTime: null, overLimitAfter: false, foundingThrough: null, portal });
    } catch {
      return billingView ? NextResponse.json({ error: 'Free time could not be read. Try again.' }, { status: 503 })
        : NextResponse.json({ freeTime: null, overLimitAfter: false, foundingThrough: null, portal: null });
    }
  }

  const { data: row, error } = await supabaseAdmin
    .from('organizations')
    .select('id, plan_id, subscription_status, enabled_addons, tournament_limit, team_limit')
    .eq('id', ctx.org.id)
    .maybeSingle();
  if (error || !row) return NextResponse.json({ freeTime: null }, { status: billingView ? 503 : 200 });

  let freeTime: Awaited<ReturnType<typeof getCustomerFreeTime>>;
  try {
    freeTime = await getCustomerFreeTime(row, { strict: billingView });
  } catch {
    return NextResponse.json({ error: 'Free time could not be read. Try again.' }, { status: 503 });
  }
  let overLimitAfter = false;
  // Founding Season still running after a shorter grant: its last free day, so the page can say the club stays free.
  let foundingThrough: string | null = null;
  if (freeTime && freeTime.state !== 'ended') {
    const ownLimit = getEffectiveTournamentLimit(freeTime.ownPlan, row.tournament_limit);
    if (ownLimit < 9999) {
      const { count, error: countError } = await supabaseAdmin
        .from('tournaments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', row.id)
        .in('status', [...SLOT_STATUSES]);
      if (billingView && (countError || count === null)) return NextResponse.json({ error: 'Free time could not be read. Try again.' }, { status: 503 });
      overLimitAfter = (count ?? 0) > ownLimit;
    }
  }
  if (freeTime && foundingCompAppliesToPlan(freeTime.ownPlan)) {
    const { data: comps } = await supabaseAdmin
      .from('org_overrides')
      .select('starts_at, expires_at, revoked_at')
      .eq('org_id', row.id)
      .eq('type', 'comp_period')
      .is('revoked_at', null);
    const comp = (comps ?? []).find(c => c.expires_at && isFoundingSeasonCompExpiry(c.expires_at) && isGrantRunning(c));
    const compLast = comp?.expires_at ? lastDayOfInstant(comp.expires_at) : null;
    if (compLast && compLast > freeTime.lastDay) foundingThrough = formatLongDay(compLast);
  }
  return NextResponse.json({ freeTime, overLimitAfter, foundingThrough });
}, { route: '/api/admin/org/free-time' });
