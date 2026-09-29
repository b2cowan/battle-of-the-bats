import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYear, updateRepProgramYear } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { refuseUnlessLiveSeason } from '@/lib/club-team-route';
import { loadRosterCounts } from '@/lib/club-team-board';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErrG = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErrG) return groupErrG;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [
    rosterCounts,
    { count: pendingTryouts },
    { count: coachCount },
    { count: upcomingEvents },
  ] = await Promise.all([
    // THE ROSTER RULE (lib/team-season-figures.ts, Club Tier B08) — one function for every club read.
    loadRosterCounts([programYear.id]),
    supabaseAdmin.from('rep_tryout_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id).eq('status', 'pending_review'),
    supabaseAdmin.from('rep_team_coaches')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id),
    supabaseAdmin.from('rep_team_events')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id)
      .gte('starts_at', new Date().toISOString()),
  ]);

  return NextResponse.json({
    team,
    programYear,
    summary: {
      rosterCount: rosterCounts.get(programYear.id) ?? 0,
      pendingTryouts: pendingTryouts ?? 0,
      coachCount: coachCount ?? 0,
      upcomingEvents: upcomingEvents ?? 0,
    },
  });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErrP = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErrP) return groupErrP;

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const fields: Parameters<typeof updateRepProgramYear>[1] = {};

  if (typeof body.name === 'string') fields.name = body.name.trim();
  if (typeof body.tryoutOpen === 'boolean') {
    // The tryouts-open switch belongs to the team's LIVE season (Club Tier B07) — it used to open
    // sign-ups on a finished season, which the public form then accepted.
    const notLive = await refuseUnlessLiveSeason(team, programYear, 'its tryouts can’t open or close');
    if (notLive) return notLive;
    fields.tryoutOpen = body.tryoutOpen;
  }
  if ('tryoutDescription' in body) fields.tryoutDescription = body.tryoutDescription?.trim() || null;

  /* ⚖ STATUS CHANGES ARE REFUSED HERE (Club Tier Stage 2, session 3 — session 1's retire list; S2-04).
     This path let the old season page Activate and Archive on one click, and Mark completed behind a
     question that promised "an empty coach list". A season now changes ONLY through the club's season
     doors (`app/api/admin/rep-teams/teams/[teamId]/seasons`: Start next season, Close the season,
     Reopen), which carry the roll's five things, warn about unsettled money, never self-heal for a
     club, and TELL the coach. Checked before anything is written, so a body that also carries a name
     changes nothing. */
  if (body.status !== undefined) {
    return NextResponse.json(
      {
        error: 'A season’s state changes from the team’s page now: Start next season, Close the season or Reopen. The team’s coaches are told each time.',
        code: 'season_status_retired',
      },
      { status: 409 },
    );
  }

  const updated = await updateRepProgramYear(yearId, fields);

  // Club Repackaging (2026-06-22): the per-team "$19/team beyond 3" meter is retired,
  // so program-year status changes no longer trigger a per-team billing sync. A Club
  // subscription includes the whole coaching staff up to the plan's team cap.

  return NextResponse.json({ programYear: updated });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]' });
