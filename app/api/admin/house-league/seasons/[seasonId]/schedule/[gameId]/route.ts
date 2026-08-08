import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, updateLeagueGame } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

async function verifyGame(gameId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('id, status, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, home_team_id, away_team_id')
    .eq('id', gameId)
    .eq('season_id', seasonId)
    .single();
  return data;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const game = await verifyGame(gameId, seasonId);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const body = await req.json();
  const patch: Parameters<typeof updateLeagueGame>[1] = {};

  // Combine date + time into ISO timestamp if provided separately.
  // J3-047: interpret the wall-clock in the org's zone (America/Toronto V1), not the
  // server's runtime zone, so a rescheduled game keeps the time the admin typed.
  if (body.scheduledDate && body.scheduledTime) {
    patch.scheduledAt = zonedWallClockToUtc(body.scheduledDate, body.scheduledTime)
      ?? new Date(`${body.scheduledDate}T${body.scheduledTime}`).toISOString();
  } else if ('scheduledAt' in body) {
    patch.scheduledAt = body.scheduledAt ?? null;
  } else if (body.scheduledDate || body.scheduledTime) {
    // One half of a schedule used to fall through as a silent no-op — the modal closed
    // "successfully" while the stored time stayed put. Refuse it out loud instead.
    return NextResponse.json({ error: 'Date and time must be set together' }, { status: 400 });
  }
  if (body.scheduledDate && 'endTime' in body) {
    patch.endsAt = body.endTime
      ? resolveEndInstant(patch.scheduledAt as string | null, body.scheduledDate, body.endTime)
      : null;
  }

  // Venue: the picker sends `orgVenueId` explicitly — a value to pick, null to clear
  // (clearing falls back to whatever text was typed, if any). When the key is absent the
  // stored reference stays; a bare `location` edit cannot desync it, because a stored
  // venue always re-derives the display string server-side.
  if ('orgVenueId' in body) {
    const selection = await resolveLeagueVenueSelection({
      orgId: ctx!.org.id,
      orgVenueId: body.orgVenueId ?? null,
      orgVenueFacilityId: body.orgVenueFacilityId ?? null,
      locationText: body.location ?? null,
    });
    if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });
    patch.orgVenueId         = selection.value.orgVenueId;
    patch.orgVenueFacilityId = selection.value.orgVenueFacilityId;
    patch.location           = selection.value.location;
  } else if ('location' in body && !game.org_venue_id) {
    patch.location = body.location ?? null;
  }

  if ('notes'     in body) patch.notes     = body.notes ?? null;
  if ('status'    in body) patch.status    = body.status;
  if ('homeScore' in body) patch.homeScore = body.homeScore ?? null;
  if ('awayScore' in body) patch.awayScore = body.awayScore ?? null;

  // If entering scores, auto-set status to completed
  if (patch.homeScore !== undefined && patch.awayScore !== undefined && patch.status === undefined) {
    patch.status = 'completed';
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Clash-check the EFFECTIVE post-save state (stored row + patch), excluding this game's
  // own stored version. A game being cancelled/postponed vacates its slot — skip the check.
  // Also skip when nothing about WHERE or WHEN changed: entering a final score on a game
  // that already clashes must never 409 — the booking is being recorded, not moved.
  const effectiveStatus = (patch.status ?? game.status) as string;
  const placementChanged =
    patch.scheduledAt !== undefined || patch.endsAt !== undefined
    || patch.orgVenueId !== undefined || patch.location !== undefined;
  const slotRevived =
    (game.status === 'cancelled' || game.status === 'postponed')
    && effectiveStatus !== 'cancelled' && effectiveStatus !== 'postponed';
  let warnings: string[] = [];
  if ((placementChanged || slotRevived)
      && effectiveStatus !== 'cancelled' && effectiveStatus !== 'postponed') {
    const { data: teamRows } = await supabaseAdmin
      .from('league_teams')
      .select('id, name')
      .in('id', [game.home_team_id, game.away_team_id]);
    const names = new Map((teamRows ?? []).map(t => [t.id, t.name]));
    const check = await checkLeagueBookings({
      orgId: ctx!.org.id,
      excludeGameIds: [gameId],
      proposed: [{
        id: gameId, kind: 'game',
        startsAt: (patch.scheduledAt !== undefined ? patch.scheduledAt : game.scheduled_at) as string | null,
        endsAt:   (patch.endsAt !== undefined ? patch.endsAt : game.ends_at) as string | null,
        orgVenueId:         patch.orgVenueId !== undefined ? patch.orgVenueId : game.org_venue_id,
        orgVenueFacilityId: patch.orgVenueFacilityId !== undefined ? patch.orgVenueFacilityId : game.org_venue_facility_id,
        location:           (patch.location !== undefined ? patch.location : game.location) as string | null,
        label: `${names.get(game.home_team_id) ?? 'Home'} vs ${names.get(game.away_team_id) ?? 'Away'}`,
      }],
    });
    if (check.blocking.length) {
      return NextResponse.json(
        { error: check.blocking[0].message, conflicts: check.blocking },
        { status: 409 },
      );
    }
    warnings = check.warnings.map(w => w.message);
  }

  await updateLeagueGame(gameId, patch);
  return NextResponse.json({ ok: true, warnings });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]' });

// Soft-cancel: sets status = 'cancelled', does not hard-delete
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const game = await verifyGame(gameId, seasonId);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  await updateLeagueGame(gameId, { status: 'cancelled' });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]' });
