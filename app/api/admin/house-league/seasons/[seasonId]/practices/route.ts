import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, getPracticesForSeason, getPracticesForTeam, createPractices } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason } from '@/lib/league-season-scope';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';
import { clashReportForLeagueRows } from '@/lib/venue-clash-lookup';
import { generateOccurrences } from '@/lib/league-practice-series';

// The series generator moved to `lib/league-practice-series.ts` (Club Tier Stage 6a) — the window's live check
// expands a series with the SAME function, so its line names exactly the dates this route writes.

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
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!; // a signed-out ctx is always refused

  // Season + team ownership: previously unchecked, so any authenticated league admin could
  // read practices for a team id belonging to another org. Now scoped like the game routes.
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  // One team's practices, or — with no team named — the whole season's (House League 9d-2a step 3: the Schedule draws every
  // division's games and practices together, and reads its clashes across the season). The season row was checked above.
  const teamId = req.nextUrl.searchParams.get('teamId');
  if (teamId) {
    const team = await verifyTeamInSeason(teamId, seasonId);
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  let practices;
  try {
    practices = teamId ? await getPracticesForTeam(teamId) : await getPracticesForSeason(seasonId);
  } catch {
    return NextResponse.json({ error: 'We couldn’t load the practices.' }, { status: 500 });
  }
  // A practice handed out from the club's time reads "From {schedule}" (Stage 11b Part 4, h2): its slot's schedule.
  const slotIds = [...new Set(practices.map(p => p.clubScheduleSlotId).filter((x): x is string => !!x))];
  const scheduleOf = new Map<string, string>();
  if (slotIds.length) {
    const { data } = await supabaseAdmin.from('club_schedule_slots').select('id, club_schedules!inner(name)')
      .eq('org_id', ctx.org.id).in('id', slotIds);
    for (const r of (data ?? []) as { id: string; club_schedules: { name: string } | { name: string }[] }[]) {
      const s = Array.isArray(r.club_schedules) ? r.club_schedules[0] : r.club_schedules;
      if (s?.name) scheduleOf.set(r.id, s.name);
    }
  }
  return NextResponse.json({
    practices: practices.map(p => (p.clubScheduleSlotId ? { ...p, fromSchedule: scheduleOf.get(p.clubScheduleSlotId) ?? null } : p)),
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!; // a signed-out ctx is always refused

  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

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
  if (divisionId != null && !(await divisionInSeason(seasonId, divisionId))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }

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
  // Across programs (Club Tier Stage 6a): every date of a series against the club's other programs — warns only;
  // the league's own refusal above is unchanged.
  const crossProgram = await clashReportForLeagueRows(ctx.org.id, season, 'practice', practices);
  return NextResponse.json(
    { practices, count: practices.length, warnings: check.warnings.map(w => w.message), crossProgram },
    { status: 201 },
  );
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices' });
