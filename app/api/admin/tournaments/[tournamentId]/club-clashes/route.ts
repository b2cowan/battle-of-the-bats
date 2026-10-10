import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { checkClubClashes } from '@/lib/venue-clash-lookup';
import { tournamentGameBooking, type ClashFinding, type ClubBooking } from '@/lib/venue-clash';

/** One draft's worth of games, at most (three drafts are asked together). */
const MAX_GAMES = 600;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}/.test(v);

/**
 * THE ROUND-ROBIN GENERATOR'S CLUB CHECK (Tournament admin redesign Stage 3, Part 5 — S3: a draft card names the games
 * that land on a club booking; 6a's amber, which warns and never refuses). The drafts are made in the browser and are
 * not saved, so this asks Club Tier 6a's check about games that do not exist yet: each proposed game on one of this
 * tournament's venue copies linked to the club's Venue library (S6-04) becomes a tournament booking by 6a's own
 * builder (`tournamentGameBooking`) and goes through 6a's own check (`checkClubClashes`) — the tournament's own games
 * are never compared (6a's rule: one owner never clashes with itself; that is the tournament's overlap rule, A37).
 *
 * Read-only. A club without a Venue library has nothing to compare and pays nothing. Answers findings per the
 * caller's own key; a game on a venue the tournament made itself is never compared (no library link).
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();
  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const empty = NextResponse.json({ findings: {} as Record<string, ClashFinding[]> });
  if (!hasOrgVenueLibrary(ctx.org.planId ?? null)) return empty;

  const body = await req.json().catch(() => ({})) as { games?: unknown };
  const games = (Array.isArray(body.games) ? body.games : []).slice(0, MAX_GAMES)
    .map(g => g as Record<string, unknown>)
    .filter(g => typeof g.key === 'string' && isDate(g.date) && isTime(g.time) && typeof g.venueId === 'string')
    .map(g => ({
      key: g.key as string,
      date: g.date as string,
      time: (g.time as string).slice(0, 5),
      venueId: g.venueId as string,
      venueFacilityId: typeof g.venueFacilityId === 'string' ? g.venueFacilityId : null,
      minutes: typeof g.durationMinutes === 'number' && g.durationMinutes > 0 ? Math.min(600, g.durationMinutes) : 90,
    }));
  if (!games.length) return empty;

  const venueIds = [...new Set(games.map(g => g.venueId))];
  const facilityIds = [...new Set(games.map(g => g.venueFacilityId).filter((x): x is string => !!x))];
  const [venuesRes, facilitiesRes, tournamentRes] = await Promise.all([
    supabaseAdmin.from('diamonds').select('id, source_org_venue_id').eq('tournament_id', tournamentId).in('id', venueIds).not('source_org_venue_id', 'is', null),
    facilityIds.length
      ? supabaseAdmin.from('venue_facilities').select('id, source_org_facility_id').eq('tournament_id', tournamentId).in('id', facilityIds)
      : Promise.resolve({ data: [] as { id: string; source_org_facility_id: string | null }[], error: null }),
    supabaseAdmin.from('tournaments').select('name').eq('id', tournamentId).maybeSingle(),
  ]);
  if (venuesRes.error) throw venuesRes.error;
  if (facilitiesRes.error) throw facilitiesRes.error;
  const libraryVenue = new Map((venuesRes.data ?? []).map(v => [v.id as string, v.source_org_venue_id as string]));
  if (!libraryVenue.size) return empty;
  const libraryFacility = new Map((facilitiesRes.data ?? []).map(f => [f.id as string, (f.source_org_facility_id as string | null) ?? null]));
  const name = (tournamentRes.data?.name as string | undefined) ?? '';

  const bookings: ClubBooking[] = [];
  for (const g of games) {
    const venue = libraryVenue.get(g.venueId);
    if (!venue) continue;
    const booking = tournamentGameBooking(
      { id: g.key, tournament_id: tournamentId, game_date: g.date, game_time: g.time, status: 'scheduled', duration_minutes: g.minutes },
      { venueId: venue, facilityId: g.venueFacilityId ? libraryFacility.get(g.venueFacilityId) ?? null : null, minutes: g.minutes },
      { tournament: name },
    );
    if (booking) bookings.push(booking);
  }
  const found = await checkClubClashes(ctx.org.id, bookings);
  const findings: Record<string, ClashFinding[]> = {};
  for (const [key, list] of found) findings[key.replace(/^tournament_game:/, '')] = list;
  return NextResponse.json({ findings });
}, { route: '/api/admin/tournaments/[tournamentId]/club-clashes' });
