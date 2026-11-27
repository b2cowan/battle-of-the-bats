import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant, onPart } from '@/lib/league-venue';
import { isUuid } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { divisionInSeason, teamsInSeason } from '@/lib/league-season-scope';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';
import { bookingOfLeagueRow, checkClubClashes } from '@/lib/venue-clash-lookup';
import { checkClubPermitsQuietly } from '@/lib/permit-lookup';
import type { PermitOutside } from '@/lib/permit-words';
import { generateOccurrences } from '@/lib/league-practice-series';
import type { ClubBooking, ClashFinding } from '@/lib/venue-clash';
import { maskProp } from '@/lib/field-parts';
import { placeGame } from '@/lib/league-game-place';

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
 *   - `permit` — the date OUTSIDE a permit the club holds at that venue (Club Tier Stage 10a, Ask 3): quiet, never
 *     blocking, its own field beside the other two (null: inside, or no permit there).
 * Typed-name matches stay what they were (a warning after the save) — the field says a typed place isn't checked.
 * Read-only; the same gate and roles as the writers.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  // Read-only, but asked only by the schedule's own windows: the same permission as the writers it serves.
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!; // a signed-out ctx is always refused

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

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
  const blank = { results: occurrences.map(o => ({ date: o.date, refusal: null as Refusal | null, crossProgram: [] as ClashFinding[], permit: null as PermitOutside | null })) };
  if (!occurrences.length || !body.orgVenueId) return NextResponse.json(blank);

  const excludeGameIds = isUuid(body.excludeGameId) ? [body.excludeGameId] : [];
  // A practice being edited (Stage 11b Part 4): its own dates are never another booking.
  const excludePracticeIds = Array.isArray(body.excludePracticeIds)
    ? (body.excludePracticeIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, MAX_OCCURRENCES) : [];

  // A game or practice being edited keeps its part while it stays on its field (the save's rule, `keptPart`): ask about
  // that ground. A series edit asks about its first date's part.
  const editedIds = kind === 'practice' ? excludePracticeIds : excludeGameIds;
  const editing = editedIds.length
    ? (await supabaseAdmin.from(kind === 'practice' ? 'league_practices' : 'league_games').select('org_venue_facility_id, section_mask')
      .in('id', editedIds).eq('season_id', seasonId).order('scheduled_at').limit(1).maybeSingle()).data
    : null;
  const selection = await resolveLeagueVenueSelection({
    orgId: ctx.org.id,
    orgVenueId: typeof body.orgVenueId === 'string' ? body.orgVenueId : null,
    orgVenueFacilityId: typeof body.orgVenueFacilityId === 'string' ? body.orgVenueFacilityId : null,
    ...(editing ? { stored: editing } : {}),
  });
  if (!selection.ok || !selection.value.orgVenueId) return NextResponse.json(blank);
  const { orgVenueId, orgVenueFacilityId } = selection.value;
  let { location } = selection.value;
  let part = maskProp(selection.value.sectionMask);

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

  // A game takes the side of the club time it lands on (the save's `placeGame`, owner 2026-11-27): ask about that side, so
  // the line never refuses side A when the save would put the game on a free side B.
  // The division is tied to THIS season first (the league scope rule, plan I01).
  if (kind === 'game' && slots.length === 1 && slots[0].startsAt && await divisionInSeason(seasonId, body.divisionId)) {
    const placed = await placeGame({
      orgId: ctx.org.id, seasonId, divisionId: body.divisionId as string, divisionName: '', scheduledAt: slots[0].startsAt,
      orgVenueId, orgVenueFacilityId, sectionMask: selection.value.sectionMask, gameId: excludeGameIds[0], placeAnywhere: true,
    });
    if (!('refusal' in placed)) { part = maskProp(placed.sectionMask); location = onPart(selection.value, placed.sectionMask).location; }
  }

  // 1. House league's own rule — per occurrence, so a series' refusal is on the date it falls on.
  const own = await checkLeagueBookings({
    orgId: ctx.org.id,
    excludeGameIds,
    excludePracticeIds,
    proposed: slots.map((s, i) => ({
      id: `proposed-${i}`, kind, startsAt: s.startsAt, endsAt: s.endsAt,
      orgVenueId, orgVenueFacilityId, ...part, location, label: `${label} #${i}`,
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
    id: `proposed-${i}`, scheduledAt: s.startsAt, endsAt: s.endsAt, status: 'scheduled', orgVenueId, orgVenueFacilityId, ...part,
  }, kind, season.name));
  const placed = proposed.filter((p): p is ClubBooking => !!p);
  const [found, outside] = await Promise.all([
    checkClubClashes(ctx.org.id, placed),
    checkClubPermitsQuietly(ctx.org.id, placed),
  ]);

  return NextResponse.json({
    results: slots.map((slot, i) => ({
      date: slot.date,
      refusal: refusalByIndex.get(i) ?? null,
      crossProgram: (proposed[i] && found.get(proposed[i]!.key)) || [],
      permit: (proposed[i] && outside.get(proposed[i]!.key)) || null,
    })),
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/venue-check' });
