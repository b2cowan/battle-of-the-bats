import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, getPracticesForTeam, createPractices } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';

function generateOccurrences(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): { scheduledAt: string; endsAt: string }[] {
  const result: { scheduledAt: string; endsAt: string }[] = [];
  const end = new Date(endDate + 'T23:59:59');
  const current = new Date(startDate + 'T00:00:00');
  const daysUntil = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + daysUntil);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    // J3-047: convert each occurrence's wall-clock (org zone, America/Toronto V1) to a
    // correct UTC instant before it lands in timestamptz — naive strings were previously
    // interpreted in the DB session zone (UTC on prod), shifting every practice 4–5h.
    const scheduledAt = zonedWallClockToUtc(dateStr, startTime) ?? `${dateStr}T${startTime}:00`;
    result.push({
      scheduledAt,
      // Overnight-aware: an end at/before the start rolls to the next day (see resolveEndInstant).
      endsAt: resolveEndInstant(scheduledAt, dateStr, endTime) ?? `${dateStr}T${endTime}:00`,
    });
    current.setDate(current.getDate() + 7);
  }
  return result;
}

/** The team must live in this org's season — a foreign team id must read as "not found". */
async function verifyTeamInSeason(teamId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('id, name')
    .eq('id', teamId)
    .eq('season_id', seasonId)
    .single();
  return data;
}

export const GET = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!hasModuleEntitlement(ctx.org, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Season + team ownership: previously unchecked, so any authenticated league admin could
  // read practices for a team id belonging to another org. Now scoped like the game routes.
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const teamId = req.nextUrl.searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  const team = await verifyTeamInSeason(teamId, seasonId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const practices = await getPracticesForTeam(teamId);
  return NextResponse.json({ practices });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!hasModuleEntitlement(ctx.org, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (ctx.role !== 'owner' && ctx.role !== 'league_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const {
    teamId,
    divisionId = null,
    recurring = false,
    dayOfWeek,
    startDate,
    endDate,
    scheduledDate,
    startTime,
    endTime = null,
    notes = null,
  } = body;

  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  const team = await verifyTeamInSeason(teamId, seasonId);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // Field comes from the org venue library (display string derived server-side); free text
  // only when nothing is picked — same rules as games.
  const selection = await resolveLeagueVenueSelection({
    orgId: ctx.org.id,
    orgVenueId: body.orgVenueId ?? null,
    orgVenueFacilityId: body.orgVenueFacilityId ?? null,
    locationText: body.location ?? null,
  });
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });
  const { orgVenueId, orgVenueFacilityId, location } = selection.value;

  const inputs: Parameters<typeof createPractices>[0] = [];

  if (recurring) {
    if (dayOfWeek == null || !startDate || !endDate || !startTime || !endTime)
      return NextResponse.json({ error: 'Missing recurring fields' }, { status: 400 });

    const groupId = randomUUID();
    const occurrences = generateOccurrences(startDate, endDate, Number(dayOfWeek), startTime, endTime);
    if (!occurrences.length)
      return NextResponse.json({ error: 'No occurrences in date range' }, { status: 400 });

    for (const { scheduledAt, endsAt } of occurrences) {
      inputs.push({ orgId: ctx.org.id, seasonId, divisionId, teamId, scheduledAt, endsAt, orgVenueId, orgVenueFacilityId, location, notes, recurrenceGroupId: groupId });
    }
  } else {
    if (!scheduledDate || !startTime)
      return NextResponse.json({ error: 'scheduledDate and startTime required' }, { status: 400 });

    // J3-047: org-zone wall-clock → UTC (see generateOccurrences).
    const scheduledAt = zonedWallClockToUtc(scheduledDate, startTime) ?? `${scheduledDate}T${startTime}:00`;
    const endsAt = endTime ? (resolveEndInstant(scheduledAt, scheduledDate, endTime) ?? `${scheduledDate}T${endTime}:00`) : null;
    inputs.push({ orgId: ctx.org.id, seasonId, divisionId, teamId, scheduledAt, endsAt, orgVenueId, orgVenueFacilityId, location, notes });
  }

  // One booking pool: a practice occupying a surface blocks a game on it, and vice versa.
  // A structured clash (picked field) blocks the save — for a series, the message names the
  // first colliding occurrence. A typed-text clash warns but saves.
  const check = await checkLeagueBookings({
    orgId: ctx.org.id,
    proposed: inputs.map((inp, i) => ({
      id: `new-${i}`, kind: 'practice' as const,
      startsAt: inp.scheduledAt, endsAt: inp.endsAt,
      orgVenueId: inp.orgVenueId, orgVenueFacilityId: inp.orgVenueFacilityId,
      location: inp.location,
      label: `${team.name} practice`,
    })),
  });
  if (check.blocking.length) {
    return NextResponse.json(
      { error: check.blocking[0].message, conflicts: check.blocking },
      { status: 409 },
    );
  }

  const practices = await createPractices(inputs);
  return NextResponse.json(
    { practices, count: practices.length, warnings: check.warnings.map(w => w.message) },
    { status: 201 },
  );
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices' });
