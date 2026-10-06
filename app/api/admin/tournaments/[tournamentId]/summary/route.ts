import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { loadEventRecap } from '@/lib/event-recap-read';

type RouteParams = { params: Promise<{ tournamentId: string }> };

type TournamentRow = {
  id: string;
  name: string;
  slug: string | null;
  year: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  org_id: string | null;
};

async function trackSummaryEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  action?: string;
  status: 'attempted' | 'blocked' | 'completed';
}) {
  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'post_tournament_summary',
      action: input.action ?? 'view_post_tournament_summary',
      tournamentId: input.tournamentId,
      status: input.status,
    },
  });
}

/**
 * Summary's read (Tournament admin redesign Stage 4, D3): the event, and `recap` — "How it finished",
 * the event in numbers and each division's final standings — from lib/event-recap-read.ts, the SAME
 * read the finished board returns (Part 0), so the two screens and the printed page cannot disagree.
 * Before Stage 4 this route built its own champion list, a "Leader" per division (F50) and the
 * registration / payment / schedule tallies of the old figure cards; Summary shows none of them now.
 */
export const GET = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action: 'view_post_tournament_summary',
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'post_tournament_summary')) {
    await trackSummaryEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      action: 'view_post_tournament_summary',
      status: 'blocked',
    });
    return NextResponse.json({ error: requiresTournamentPlusCopy('post_tournament_summary') }, { status: 403 });
  }

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, year, status, start_date, end_date, org_id')
    .eq('id', tournamentId)
    .maybeSingle<TournamentRow>();

  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  const recap = await loadEventRecap(tournamentId, ctx.org.slug);

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action: 'view_post_tournament_summary',
    status: 'completed',
  });

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      year: tournament.year,
      status: tournament.status,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
    },
    // lib/event-recap-read.ts, the same object the finished board returns.
    recap,
    /** The event's public home, from the site's root — the printed page's footer. */
    publicHome: tournament.slug ? `/${ctx.org.slug}/${tournament.slug}` : null,
  });
}, { route: '/api/admin/tournaments/[tournamentId]/summary' });

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const requestedAction = typeof body.action === 'string' ? body.action : '';
  const action = requestedAction === 'print'
    ? 'print_post_tournament_summary'
    : requestedAction === 'share_public_results'
      ? 'share_post_tournament_summary'
      : requestedAction === 'renewal_cta_clicked'
        ? 'click_post_event_renewal_cta'
      : null;

  if (!action) return NextResponse.json({ error: 'Unsupported summary action.' }, { status: 400 });

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action,
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'post_tournament_summary')) {
    await trackSummaryEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      action,
      status: 'blocked',
    });
    return NextResponse.json({ error: requiresTournamentPlusCopy('post_tournament_summary') }, { status: 403 });
  }

  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, org_id')
    .eq('id', tournamentId)
    .maybeSingle<{ id: string; org_id: string | null }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action,
    status: 'completed',
  });

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/tournaments/[tournamentId]/summary' });
