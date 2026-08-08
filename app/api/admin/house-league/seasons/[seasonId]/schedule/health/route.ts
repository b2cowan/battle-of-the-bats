import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import {
  scanLeagueBookingConflicts,
  countUncheckedBookings,
  bookingKey,
  type LeagueBooking,
} from '@/lib/league-schedule-conflict';

// ---------------------------------------------------------------------------
// Season schedule health — house league's answer to the tournament panel.
//
// Two findings, same honesty rules as tournaments:
//   - conflicts:  bookings (games AND practices — one pool) sharing a surface + window
//   - unchecked:  scheduled bookings with no usable field, so they CANNOT be checked;
//                 silence must not read as a clean bill of health (venue_unchecked's twin)
//
// Season-scoped by design: this is the strip on the season's schedule page. The save-time
// check in the write routes is org-wide across seasons; this view is what the organizer is
// looking at right now.
// ---------------------------------------------------------------------------

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const [gamesRes, practicesRes, teamsRes] = await Promise.all([
    supabaseAdmin
      .from('league_games')
      .select('id, status, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, home_team_id, away_team_id')
      .eq('season_id', seasonId),
    supabaseAdmin
      .from('league_practices')
      .select('id, status, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, team_id')
      .eq('season_id', seasonId),
    supabaseAdmin
      .from('league_teams')
      .select('id, name')
      .eq('season_id', seasonId),
  ]);

  const teamName = new Map((teamsRes.data ?? []).map(t => [t.id, t.name]));

  const bookings: LeagueBooking[] = [
    ...(gamesRes.data ?? []).map((r): LeagueBooking => ({
      id: r.id, kind: 'game',
      startsAt: r.scheduled_at, endsAt: r.ends_at, status: r.status,
      orgVenueId: r.org_venue_id, orgVenueFacilityId: r.org_venue_facility_id,
      location: r.location,
      label: `${teamName.get(r.home_team_id) ?? 'Home'} vs ${teamName.get(r.away_team_id) ?? 'Away'}`,
    })),
    ...(practicesRes.data ?? []).map((r): LeagueBooking => ({
      id: r.id, kind: 'practice',
      startsAt: r.scheduled_at, endsAt: r.ends_at, status: r.status,
      orgVenueId: r.org_venue_id, orgVenueFacilityId: r.org_venue_facility_id,
      location: r.location,
      label: `${teamName.get(r.team_id) ?? 'Team'} practice`,
    })),
  ];

  const conflictMap = scanLeagueBookingConflicts(bookings);
  const byKey = new Map(bookings.map(b => [bookingKey(b), b]));

  const conflicts = [...conflictMap.entries()].map(([key, c]) => {
    const b = byKey.get(key)!;
    return {
      kind: b.kind,
      id: b.id,
      label: b.label ?? null,
      startsAt: b.startsAt,
      fieldLabel: b.location ?? c.partner.location ?? null,
      partnerKind: c.partner.kind,
      partnerId: c.partner.id,
      partnerLabel: c.partner.label ?? null,
      partnerStartsAt: c.partner.startsAt,
      matchedOn: c.matchedOn,
    };
  });

  return NextResponse.json({
    conflicts,
    uncheckedCount: countUncheckedBookings(bookings),
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/health' });
