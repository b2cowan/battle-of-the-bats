import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, createLeagueGame } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';
import { bookingOfLeagueRow, clashReportForLeagueRows } from '@/lib/venue-clash-lookup';
import { checkClubPermitsQuietly } from '@/lib/permit-lookup';
import type { ClubBooking } from '@/lib/venue-clash';
import type { PermitOutside } from '@/lib/permit-words';
import { seasonGameSlots } from '@/lib/league-time-server';

function mapGame(row: any) {
  return {
    id:          row.id,
    seasonId:    row.season_id,
    divisionId:  row.division_id,
    homeTeamId:  row.home_team_id,
    awayTeamId:  row.away_team_id,
    scheduledAt: row.scheduled_at ?? null,
    endsAt:      row.ends_at ?? null,
    orgVenueId:         row.org_venue_id ?? null,
    orgVenueFacilityId: row.org_venue_facility_id ?? null,
    location:    row.location ?? null,
    homeScore:   row.home_score ?? null,
    awayScore:   row.away_score ?? null,
    status:      row.status,
    notes:       row.notes ?? null,
    slotUseId:   row.slot_use_id ?? null,
    movedFrom:   row.moved_from ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const divisionId = url.searchParams.get('divisionId');
  const weekOf     = url.searchParams.get('weekOf'); // YYYY-MM-DD (Monday of week)

  let q = supabaseAdmin
    .from('league_games')
    .select('*')
    .eq('season_id', seasonId)
    .order('scheduled_at', { ascending: true });

  if (divisionId) q = q.eq('division_id', divisionId);

  if (weekOf) {
    const start = new Date(weekOf);
    const end   = new Date(weekOf);
    end.setDate(end.getDate() + 7);
    q = q.gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString());
  }

  // The season's game time and each game's permit line are for someone who runs the season (the window shows "Time from" and
  // "See the permit" to them alone), so a reader is sent neither. The game time is decoration on the read: a failed read of
  // it leaves the schedule loading, as a failed permit read does.
  const runs = !houseLeagueRefusal(ctx, 'run', season);
  const [{ data, error }, gameSlots, publishing] = await Promise.all([
    q, runs ? seasonGameSlots(ctx!.org.id, seasonId).catch(() => []) : Promise.resolve([]), schedulePublishing(seasonId),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const games = (data ?? []).map(mapGame);

  // The permit's quiet line on each game (9d-2a step 7, frame i), by booking key — only for someone who runs the season:
  // "A reader doesn't see the line", and only they get "See the permit". A failed read says nothing, as every check does.
  let permits: Record<string, PermitOutside> = {};
  if (runs) {
    const placed = games.map(g => bookingOfLeagueRow(g, 'game', season.name)).filter((b): b is ClubBooking => !!b);
    permits = Object.fromEntries(await checkClubPermitsQuietly(ctx!.org.id, placed));
  }

  // The season's game time (9d-2a step 4): the game window's "Time from {schedule}" matches a game to it.
  return NextResponse.json({ games, gameSlots, permits, publishing });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule' });

/**
 * Each published division's line (9d-2b, e1): when, how many families its Publish emailed and how it went (the season's
 * `schedule_published` notice), and how many changes are waiting to be sent. A division absent from the map is a draft.
 * ⚠ A failed read THROWS: a published division read as a draft would offer Publish again (the SQL refuses it, but the
 * screen would say the wrong thing).
 */
async function schedulePublishing(seasonId: string) {
  const [divs, notices, held] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id, schedule_published_at').eq('season_id', seasonId).not('schedule_published_at', 'is', null),
    supabaseAdmin.from('league_season_notices').select('division_id, family_count, reached_count, failed_count, created_at')
      .eq('season_id', seasonId).eq('kind', 'schedule_published').order('created_at', { ascending: false }),
    supabaseAdmin.from('league_game_changes').select('division_id').eq('season_id', seasonId).is('sent_at', null),
  ]);
  for (const r of [divs, notices, held]) if (r.error) throw r.error;
  const out: Record<string, { publishedAt: string; families: number | null; reached: number; failed: number; held: number }> = {};
  for (const d of divs.data ?? []) {
    const n = (notices.data ?? []).find(x => x.division_id === d.id);
    out[d.id as string] = {
      publishedAt: d.schedule_published_at as string,
      // A silent backfill (9d2b·A) and a Publish that reached nobody have no notice: no count to say.
      families: n ? n.family_count as number : null, reached: (n?.reached_count as number) ?? 0, failed: (n?.failed_count as number) ?? 0,
      held: (held.data ?? []).filter(h => h.division_id === d.id).length,
    };
  }
  return out;
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json();
  const { divisionId, homeTeamId, awayTeamId } = body;

  if (!divisionId || !homeTeamId || !awayTeamId) {
    return NextResponse.json({ error: 'divisionId, homeTeamId, and awayTeamId required' }, { status: 400 });
  }
  if (homeTeamId === awayTeamId) {
    return NextResponse.json({ error: 'Home and away teams must be different' }, { status: 400 });
  }

  // Ownership: the division and both teams must live in THIS org's season. Body ids were
  // previously trusted, which both mis-filed rows against foreign orgs and — once conflict
  // messages started naming teams — would have echoed another org's team name back.
  const [{ data: division }, { data: teamRows }] = await Promise.all([
    supabaseAdmin.from('league_divisions').select('id').eq('id', divisionId).eq('season_id', seasonId).single(),
    supabaseAdmin.from('league_teams').select('id, name').in('id', [homeTeamId, awayTeamId]).eq('season_id', seasonId),
  ]);
  if (!division) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  if ((teamRows ?? []).length !== 2) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // Combine date + time into ISO timestamp if both provided.
  // J3-047: org-zone wall-clock → UTC (matches the PATCH route; the naive `new Date()`
  // construction here was the last league writer still using the server's zone).
  let scheduledAt: string | null = null;
  if (body.scheduledDate && body.scheduledTime) {
    scheduledAt = zonedWallClockToUtc(body.scheduledDate, body.scheduledTime)
      ?? new Date(`${body.scheduledDate}T${body.scheduledTime}`).toISOString();
  } else if (body.scheduledAt) {
    scheduledAt = body.scheduledAt;
  } else if (body.scheduledDate || body.scheduledTime) {
    // Half a schedule is a silent no-op waiting to happen — refuse it out loud.
    return NextResponse.json({ error: 'Date and time must be set together' }, { status: 400 });
  }
  const endsAt = resolveEndInstant(scheduledAt, body.scheduledDate, body.endTime);

  // Venue comes from the org library; the display string is DERIVED server-side so
  // `location` can never disagree with the reference. Free text only when nothing picked.
  const selection = await resolveLeagueVenueSelection({
    orgId: ctx!.org.id,
    orgVenueId: body.orgVenueId ?? null,
    orgVenueFacilityId: body.orgVenueFacilityId ?? null,
    locationText: body.location ?? null,
  });
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });

  // One booking pool, org-wide: a practice on this surface blocks this game too.
  const names = new Map((teamRows ?? []).map(t => [t.id, t.name]));
  const check = await checkLeagueBookings({
    orgId: ctx!.org.id,
    proposed: [{
      id: 'new-game', kind: 'game',
      startsAt: scheduledAt, endsAt,
      orgVenueId: selection.value.orgVenueId,
      orgVenueFacilityId: selection.value.orgVenueFacilityId,
      location: selection.value.location,
      label: `${names.get(homeTeamId) ?? 'Home'} vs ${names.get(awayTeamId) ?? 'Away'}`,
    }],
  });
  if (check.blocking.length) {
    return NextResponse.json(
      { error: check.blocking[0].message, conflicts: check.blocking },
      { status: 409 },
    );
  }

  const game = await createLeagueGame({
    orgId: ctx!.org.id,
    seasonId,
    divisionId,
    homeTeamId,
    awayTeamId,
    scheduledAt,
    endsAt,
    orgVenueId:         selection.value.orgVenueId,
    orgVenueFacilityId: selection.value.orgVenueFacilityId,
    location: selection.value.location,
    notes:    body.notes ?? null,
  });

  // Across programs (Club Tier Stage 6a, Ask 4): a rep team's or a tournament's booking on the same diamond WARNS —
  // the league's own refusal above is unchanged. Read after the save, never fatal.
  const crossProgram = await clashReportForLeagueRows(ctx!.org.id, season, 'game', [game]);
  return NextResponse.json(
    { game, warnings: check.warnings.map(w => w.message), crossProgram },
    { status: 201 },
  );
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule' });
