import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, updateLeagueGame } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings, resolveEndInstant } from '@/lib/league-venue';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';
import { clashReportForLeagueRows, emptyReport } from '@/lib/venue-clash-lookup';
import { invalidGamePatch } from '@/lib/league-game-patch';
import { houseLeagueAccess } from '@/lib/house-league-access';
import { placeGame } from '@/lib/league-game-place';
import { heldChangesOf, heldGamesOf, isShownHeld } from '@/lib/league-game-changes-server';
import { sendChangesAndTell } from '@/lib/league-schedule-mail';
import { CHANGES_TO_SEND_WORDS as CW } from '@/lib/league-schedule-words';
import { GAME_WINDOW_WORDS } from '@/lib/league-season-calendar';

// f5's "tell families now" emails the game's two teams' families inside the request (the season emails' rule).
export const maxDuration = 120;

async function verifyGame(gameId: string, seasonId: string) {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('id, division_id, status, scheduled_at, ends_at, org_venue_id, org_venue_facility_id, location, home_team_id, away_team_id, updated_at')
    .eq('id', gameId)
    .eq('season_id', seasonId)
    .single();
  return data;
}

/** The game's division: its name (the move refusal's words) and whether its schedule is published (9d-2b). */
async function divisionOf(divisionId: string) {
  const { data, error } = await supabaseAdmin.from('league_divisions').select('name, schedule_published_at').eq('id', divisionId).single();
  // ⚠ A failed read THROWS: a published division read as a draft would let a delete, a team swap or an urgent send through.
  if (error || !data) throw error ?? new Error('Division not found');
  return { name: data.name as string, published: !!data.schedule_published_at };
}

const sameInstant = (a: unknown, b: string | null) =>
  typeof a === 'string' && b != null && Date.parse(a) === Date.parse(b);

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const game = await verifyGame(gameId, seasonId);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });
  const invalid = invalidGamePatch(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  // ⚖ THE PRESS IS ABOUT THE GAME THE WINDOW SAW (9d-2a review, 9d-2b Part 3): `seen` is its status and `updated_at` when
  // it opened. A game changed since — postponed, scored or moved by someone else — is refused, never written over; and
  // the write itself is conditional on the row read here, so a change landing between this read and the write loses too.
  const seen = body.seen as { status?: unknown; updatedAt?: unknown } | undefined;
  if (seen && (seen.status !== game.status || !sameInstant(seen.updatedAt, game.updated_at))) {
    return NextResponse.json({ error: CW.gameChanged, code: 'changed' }, { status: 409 });
  }
  const division = await divisionOf(game.division_id);
  const patch: Parameters<typeof updateLeagueGame>[1] = {};

  // Home and away. A published game's teams are facts (plan §0h build default): a different match-up is a new game,
  // which the change record explains as a cancel and an add. A draft's teams are the form's to change.
  const homeTeamId = typeof body.homeTeamId === 'string' ? body.homeTeamId : game.home_team_id;
  const awayTeamId = typeof body.awayTeamId === 'string' ? body.awayTeamId : game.away_team_id;
  if (homeTeamId !== game.home_team_id || awayTeamId !== game.away_team_id) {
    if (division.published) return NextResponse.json({ error: GAME_WINDOW_WORDS.teamsFixed }, { status: 409 });
    if (homeTeamId === awayTeamId) return NextResponse.json({ error: 'Home and away teams must be different' }, { status: 400 });
    const { count } = await supabaseAdmin.from('league_teams').select('id', { count: 'exact', head: true })
      .in('id', [homeTeamId, awayTeamId]).eq('season_id', seasonId).eq('division_id', game.division_id);
    if (count !== 2) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    patch.homeTeamId = homeTeamId;
    patch.awayTeamId = awayTeamId;
  }

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
  // Where or when changed (or the slot came back), and the game holds a slot: both checks run, the league's own
  // refusal before the write and the cross-program report after it.
  const recheck = (placementChanged || slotRevived) && effectiveStatus !== 'cancelled' && effectiveStatus !== 'postponed';
  if (recheck) {
    const { data: teamRows } = await supabaseAdmin
      .from('league_teams')
      .select('id, name')
      .in('id', [homeTeamId, awayTeamId]);
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
        label: `${names.get(homeTeamId) ?? 'Home'} vs ${names.get(awayTeamId) ?? 'Away'}`,
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

  // ⚖ WHERE IT MAY GO (9d2b·B, `placeGame`): a game whose start or place moves, and that is on, lands on its division's
  // game time and links to it — or, for a league admin on the club's schedule, is refused. A game left where it was
  // (a score, a note, an end time, put back on) keeps its link, even one outside every use: it says nothing.
  const effStart = (patch.scheduledAt !== undefined ? patch.scheduledAt : game.scheduled_at) as string | null;
  const effVenue = patch.orgVenueId !== undefined ? patch.orgVenueId : game.org_venue_id;
  const effFacility = patch.orgVenueFacilityId !== undefined ? patch.orgVenueFacilityId : game.org_venue_facility_id;
  // A game coming back on (from postponed or cancelled) is placed again: moving it while it was off checked nothing.
  const moved = slotRevived || !(effStart == null ? game.scheduled_at == null : sameInstant(effStart, game.scheduled_at))
    || (effVenue ?? null) !== (game.org_venue_id ?? null) || (effFacility ?? null) !== (game.org_venue_facility_id ?? null)
    || (patch.location !== undefined && (patch.location ?? null) !== (game.location ?? null));
  if (moved && effectiveStatus !== 'cancelled' && effectiveStatus !== 'postponed') {
    const placed = await placeGame({
      orgId: ctx!.org.id, seasonId, divisionId: game.division_id, divisionName: division.name,
      scheduledAt: effStart, orgVenueId: effVenue, orgVenueFacilityId: effFacility,
      placeAnywhere: houseLeagueAccess(ctx!, ctx!.org, season).placeAnywhere,
    });
    if ('refusal' in placed) return NextResponse.json({ error: placed.refusal, code: 'outside_time' }, { status: 409 });
    patch.slotUseId = placed.slotUseId;
  }

  // On a published division the database records the change as it writes it (mig 409's trigger): it waits in Changes to
  // send, and the public page keeps what families last heard until it goes.
  if (!(await updateLeagueGame(gameId, patch, game.updated_at))) {
    return NextResponse.json({ error: CW.gameChanged, code: 'changed' }, { status: 409 });
  }

  // ⚖ f5, THE URGENT CANCEL OR POSTPONE: "tell families now" sends this one game's change on its own; anything else waiting
  // keeps waiting. The change is saved first; a send refused or failed leaves it waiting with the rest, and says so.
  let sent: { families: number; reached: number; failed: number; others: number } | null = null;
  let sendFailed = false;
  if (body.sendNow === true && division.published && (patch.status === 'cancelled' || patch.status === 'postponed')) {
    try {
      const mine = (await heldChangesOf(seasonId, game.division_id)).filter(c => c.gameId === gameId).map(c => c.id);
      const r = await sendChangesAndTell({
        org: ctx!.org, season, divisionId: game.division_id, actorId: ctx!.user.id, changeIds: mine,
      });
      if (r.refusal === null) {
        // The count is a nicety: the emails have gone, so a read that fails says 0, never "it didn't send".
        let others = 0;
        try { others = (await heldGamesOf(seasonId, game.division_id)).filter(isShownHeld).length; } catch { /* keep 0 */ }
        sent = { families: r.families, reached: r.reached, failed: r.failed, others };
      } else sendFailed = true;
    } catch {
      sendFailed = true;
    }
  }

  // Across programs (Club Tier Stage 6a): the moved or re-opened game against the club's other programs — warns
  // only, and only when where or when changed (a final score is a record, not a booking).
  const crossProgram = recheck
    ? await clashReportForLeagueRows(ctx!.org.id, season, 'game', [{
        id: gameId,
        scheduledAt: (patch.scheduledAt !== undefined ? patch.scheduledAt : game.scheduled_at) as string | null,
        endsAt: (patch.endsAt !== undefined ? patch.endsAt : game.ends_at) as string | null,
        status: effectiveStatus,
        orgVenueId: patch.orgVenueId !== undefined ? patch.orgVenueId : game.org_venue_id,
        orgVenueFacilityId: patch.orgVenueFacilityId !== undefined ? patch.orgVenueFacilityId : game.org_venue_facility_id,
      }])
    : emptyReport();
  return NextResponse.json({ ok: true, warnings, crossProgram, sent, ...(sendFailed ? { sendFailed: CW.sendNowFailed } : {}) });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]' });

// Delete removes a DRAFT's game for good (9d2·9, 9d-2b: a published division's game is cancelled instead) (owner, 2026-10-09, at Edit Game walking Club Tier §288 W9: "I don't see delete
// anywhere"). ⚰ It used to be a soft cancel (status = 'cancelled') behind the window's "Cancel Game", which the Status
// field already did; that button went the same day, and house league was left with no way to remove a game added by
// mistake — Cancelled kept it on the public schedule, telling families a game that never existed was called off.
// Nothing references a league game, and standings are computed from the games, so a scored game's result simply
// leaves them; the window's question says so first.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const game = await verifyGame(gameId, seasonId);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  // 9d2·9: Delete before publishing, Cancel after. A published game was told to families; it is cancelled, never removed.
  if ((await divisionOf(game.division_id)).published) {
    return NextResponse.json({ error: CW.deletePublished, code: 'published' }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('league_games').delete().eq('id', gameId).eq('season_id', seasonId);
  if (error) return NextResponse.json({ error: 'Could not delete the game' }, { status: 500 });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]' });
