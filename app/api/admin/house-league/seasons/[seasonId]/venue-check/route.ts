import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { teamsInSeason } from '@/lib/league-season-scope';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';
import { bookingOfLeagueRow, checkClubClashes } from '@/lib/venue-clash-lookup';
import { generateOccurrences } from '@/lib/league-practice-series';
import type { ClubBooking, ClashFinding } from '@/lib/venue-clash';

const MAX_OCCURRENCES = 60;

/** House league's own refusal, as the window says it under the field (the words are `leagueRefusalLine`'s). */
interface Refusal {
  partnerLabel: string;
  partnerKind: 'game' | 'practice';
  partnerStartsAt: string | null;
  partnerEndsAt: string | null;
  /** 'facility' = the same diamond · 'venue' = the same park with a diamond unset on one side. */
  matchedOn: 'facility' | 'venue';
}

/**
 * HOUSE LEAGUE'S LIVE CHECK (Club Tier Stage 6a, specimen 3, Asks 4–5) — the game window, the practice window
 * (single and series) ask it as soon as the date, the time and a diamond are set, so BOTH lines are under the field
 * before Create:
 *   - `refusal` — house league's OWN rule, unchanged in what it refuses (a second league booking on a picked
 *     diamond, `checkLeagueBookings` → blocking). Said in red, Create greyed; the server still refuses a save that
 *     slips past (409), as it always has. A series refuses on its first collision, and the line names the date.
 *   - `crossProgram` — another program's booking (a rep team, a tournament) on the same diamond: amber, never blocking.
 * Typed-name matches stay what they were (a warning after the save) — the field says a typed place isn't checked.
 * Read-only; the same gate and roles as the writers.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const kind: 'game' | 'practice' = body.kind === 'practice' ? 'practice' : 'game';
  // One booking, or a practice series — expanded by the SAME generator the practice save uses, so the line names
  // exactly the dates it will write.
  const series = body.series && typeof body.series === 'object' ? body.series as Record<string, unknown> : null;
  const occurrences: { date: string; startTime: string; endTime: string }[] = series
    ? (typeof series.startDate === 'string' && typeof series.endDate === 'string' && typeof series.startTime === 'string' && typeof series.endTime === 'string'
        ? generateOccurrences(series.startDate, series.endDate, Number(series.dayOfWeek), series.startTime, series.endTime)
            .map(o => ({ date: o.date, startTime: series.startTime as string, endTime: series.endTime as string }))
        : [])
    : (Array.isArray(body.occurrences) ? body.occurrences : []).map((o: { date?: unknown; startTime?: unknown; endTime?: unknown }) => ({
        date: typeof o.date === 'string' ? o.date : '',
        startTime: typeof o.startTime === 'string' ? o.startTime : '',
        endTime: typeof o.endTime === 'string' ? o.endTime : '',
      }));
  occurrences.splice(MAX_OCCURRENCES);
  const blank = { results: occurrences.map(o => ({ date: o.date, refusal: null as Refusal | null, crossProgram: [] as ClashFinding[] })) };
  if (!occurrences.length || !body.orgVenueId) return NextResponse.json(blank);

  const selection = await resolveLeagueVenueSelection({
    orgId: ctx.org.id,
    orgVenueId: typeof body.orgVenueId === 'string' ? body.orgVenueId : null,
    orgVenueFacilityId: typeof body.orgVenueFacilityId === 'string' ? body.orgVenueFacilityId : null,
  });
  if (!selection.ok || !selection.value.orgVenueId) return NextResponse.json(blank);
  const { orgVenueId, orgVenueFacilityId, location } = selection.value;

  // The window's own label for the booking it is about to make (the refusal never names it, but the engine wants one).
  let label = kind === 'practice' ? 'This practice' : 'This game';
  // The team is tied to THIS season before its name is read (the league scope rule, plan I01).
  if (kind === 'practice' && typeof body.teamId === 'string' && await teamsInSeason(seasonId, [body.teamId])) {
    const { data: t } = await supabaseAdmin.from('league_teams').select('name').eq('id', body.teamId).maybeSingle();
    if (t?.name) label = `${t.name} practice`;
  }

  const slots = occurrences.map(o => {
    const startsAt = zonedWallClockToUtc(o.date, o.startTime);
    const endsAt = startsAt && o.endTime ? resolveEndInstant(startsAt, o.date, o.endTime) : null;
    return { date: o.date, startsAt, endsAt };
  });

  // 1. House league's own rule — per occurrence, so a series' refusal is on the date it falls on.
  const excludeGameIds = typeof body.excludeGameId === 'string' ? [body.excludeGameId] : [];
  const own = await checkLeagueBookings({
    orgId: ctx.org.id,
    excludeGameIds,
    proposed: slots.map((s, i) => ({
      id: `proposed-${i}`, kind, startsAt: s.startsAt, endsAt: s.endsAt,
      orgVenueId, orgVenueFacilityId, location, label: `${label} #${i}`,
    })),
  });
  const refusalByIndex = new Map<number, Refusal>();
  const ownLabels = new Map(slots.map((_, i) => [`${label} #${i}`, i]));
  for (const r of own.blocking) {
    const i = ownLabels.get(r.proposedLabel);
    if (i === undefined || refusalByIndex.has(i) || r.matchedOn === 'text') continue;
    // Two of this request's own dates against each other (a series overlapping itself) is not another booking.
    if (ownLabels.has(r.partnerLabel)) continue;
    refusalByIndex.set(i, {
      partnerLabel: r.partnerLabel, partnerKind: r.partnerKind,
      partnerStartsAt: r.partnerStartsAt, partnerEndsAt: r.partnerEndsAt, matchedOn: r.matchedOn,
    });
  }

  // 2. Across programs — warns only. League bookings are the league's own rule, never repeated here (owner 'league').
  const proposed = slots.map((s, i) => bookingOfLeagueRow({
    id: `proposed-${i}`, scheduledAt: s.startsAt, endsAt: s.endsAt, status: 'scheduled', orgVenueId, orgVenueFacilityId,
  }, kind, season.name));
  const found = await checkClubClashes(ctx.org.id, proposed.filter((p): p is ClubBooking => !!p));

  return NextResponse.json({
    results: slots.map((slot, i) => ({
      date: slot.date,
      refusal: refusalByIndex.get(i) ?? null,
      crossProgram: (proposed[i] && found.get(proposed[i]!.key)) || [],
    })),
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/venue-check' });
