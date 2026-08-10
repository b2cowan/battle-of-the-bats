/**
 * Phase 3 of "game location — one source of truth": the server side of the admin review screen
 * that turns hand-typed field names into real references.
 *
 * ⚠ THIS ROUTE MUST NEVER NOTIFY FAMILIES.
 * A conversion changes a game's venue reference from "none" to a real field, which
 * `lib/schedule-change-classify.ts` correctly reads as the game having MOVED. On the games route
 * that would send a "game moved" notice to every following family. Tidying data is not a schedule
 * change, so every write here goes straight through `supabaseAdmin` and deliberately does NOT call
 * `recordGameScheduleChanges`. The import commit path sets the same columns the same way, for the
 * same reason. `tests/unit/tournament-location-resolve.test.ts` fails the build if this route ever
 * gains a notifier import — that test is the only thing standing between a data tidy-up and a
 * Tuesday-night push notification to a thousand parents.
 *
 * There is no GET. The review model is a pure function of games + venues
 * (`lib/tournament-location-resolve.ts`), and the schedule page already holds both — so it builds
 * the plan client-side rather than asking the server to re-read the same two tables. The server
 * still builds its OWN plan on every write: which games a decision touches is never taken from
 * the client.
 *
 * Multi-tenant: every read and write is scoped to one tournament that `requireWritableTournament`
 * has confirmed belongs to the caller's org and is not locked, and venue resolution goes through
 * the tournament venue rail, whose catalog is tournament-scoped by construction (a foreign venue
 * id 400s rather than being written through).
 */

import { forbidden, getAuthContextWithScope, requireWritableTournament, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import {
  createTournamentFacility,
  createTournamentVenue,
  loadTournamentVenueCatalog,
  resolveVenueSelectionFromCatalog,
  type TournamentVenueCatalog,
} from '@/lib/tournament-venue';
import { normalizeVenueNameToken } from '@/lib/venue-name-match';
import {
  buildLocationResolvePlan,
  type LocationResolvePlan,
  type ResolveGameRow,
} from '@/lib/tournament-location-resolve';
import { getSportPack } from '@/lib/sports';
import type { FacilityType } from '@/lib/types';

/** A single request can never sweep an unbounded set of rows. */
const MAX_GAMES_PER_REQUEST = 2000;
const MAX_ASSIGNMENTS = 60;

type AssignmentSource =
  | { kind: 'text'; token: string }
  | { kind: 'field'; key: string };

type AssignmentTarget =
  | { kind: 'field'; venueId?: string | null; venueFacilityId?: string | null }
  | { kind: 'create-facility'; venueId: string; name: string }
  | { kind: 'create-venue'; name: string };

type Assignment = { source: AssignmentSource; target: AssignmentTarget };

/** The before-state a client hands back to undo a conversion. */
type RevertGame = {
  id: string;
  venueId: string | null;
  venueFacilityId: string | null;
  location: string | null;
};

/** What the apply wrote — an undo only touches games that still hold exactly this. */
type ExpectedState = {
  venueId: string | null;
  venueFacilityId: string | null;
  location: string | null;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function loadGameRows(tournamentId: string): Promise<ResolveGameRow[]> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('id, location, diamond_id, venue_facility_id, schedule_facility_lane_id, status')
    .eq('tournament_id', tournamentId);
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id as string,
    location: (row.location as string | null) ?? null,
    venueId: (row.diamond_id as string | null) ?? null,
    venueFacilityId: (row.venue_facility_id as string | null) ?? null,
    scheduleFacilityLaneId: (row.schedule_facility_lane_id as string | null) ?? null,
    status: (row.status as string | null) ?? null,
  }));
}

/** The server's own view of what is resolvable — the authority on which games a decision moves. */
async function buildPlan(tournamentId: string): Promise<{
  plan: LocationResolvePlan;
  catalog: TournamentVenueCatalog;
  games: ResolveGameRow[];
}> {
  const [games, catalog] = await Promise.all([
    loadGameRows(tournamentId),
    loadTournamentVenueCatalog(tournamentId),
  ]);
  return { plan: planFrom(games, catalog), catalog, games };
}

function planFrom(games: readonly ResolveGameRow[], catalog: TournamentVenueCatalog): LocationResolvePlan {
  return buildLocationResolvePlan(games, {
    venues: [...catalog.venues.values()],
    facilities: [...catalog.facilities.values()],
  });
}

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  try {
    const body = await req.json();
    const action = body.action as string | undefined;
    const tournamentId = body.tournamentId as string | undefined;
    if (!tournamentId) return json({ error: 'tournamentId is required.' }, 400);
    if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();

    if (action === 'resolve') {
      return await applyAssignments(tournamentId, ctx, (body.assignments ?? []) as Assignment[]);
    }
    if (action === 'revert') {
      return await revertGames(
        tournamentId,
        ctx,
        (body.games ?? []) as RevertGame[],
        (body.expected ?? null) as ExpectedState | null,
      );
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (err: unknown) {
    console.error('Schedule Locations API error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown server error' }, 500);
  }
}, { route: '/api/admin/schedule-locations' });

/**
 * Apply one decision per name.
 *
 * The ordering is deliberate and was the subject of Phase 2's review finding on `save-bracket`:
 * validate every target, then create the records the decisions call for while resolving each one to
 * its final columns, and only then touch a single game. A refusal partway through must not leave
 * the schedule half-converted.
 */
async function applyAssignments(
  tournamentId: string,
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithScope>>>,
  rawAssignments: Assignment[],
) {
  const assignments = rawAssignments.filter(item => item?.source && item?.target);
  if (assignments.length === 0) return json({ error: 'No changes were supplied.' }, 400);
  if (assignments.length > MAX_ASSIGNMENTS) {
    return json({ error: `Too many changes in one request (limit ${MAX_ASSIGNMENTS}).` }, 400);
  }

  // Creating a venue or a field is tournament SETUP, which the venues admin gates on
  // `create_tournaments`. Reaching the same write through this screen must not be an easier door.
  const wantsCreate = assignments.some(item => item.target.kind !== 'field');
  if (wantsCreate && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const lockOrScope = await requireWritableTournament(ctx, tournamentId);
  if (lockOrScope) return lockOrScope;

  // Step 1 — the affected games come from the SERVER's own view of the tournament, never from
  // the client. A client that could nominate game ids could move any game in the org.
  const { plan, catalog, games } = await buildPlan(tournamentId);
  const typedByToken = new Map(plan.typedGroups.map(group => [group.token, group]));
  const linkedByKey = new Map(plan.linkedGroups.map(group => [group.key, group]));

  type Prepared = { source: AssignmentSource; target: AssignmentTarget; gameIds: string[] };
  const prepared: Prepared[] = [];
  const seenSources = new Set<string>();

  for (const { source, target } of assignments) {
    const sourceKey = source.kind === 'text' ? `text:${source.token}` : `field:${source.key}`;
    if (seenSources.has(sourceKey)) return json({ error: 'The same location was submitted twice.' }, 400);
    seenSources.add(sourceKey);

    const group = source.kind === 'text' ? typedByToken.get(source.token) : linkedByKey.get(source.key);
    if (!group) {
      return json({ error: 'This schedule changed while you were reviewing it. Reopen the panel to see the current locations.' }, 409);
    }

    // Step 2 — validate every target BEFORE creating anything, so a bad request cannot leave an
    // empty new field behind as a souvenir.
    if (target.kind === 'create-facility') {
      if (!target.name?.trim()) return json({ error: 'A name is required to create a field.' }, 400);
      if (!catalog.venues.has(target.venueId)) {
        return json({ error: 'That venue no longer exists in this tournament.' }, 400);
      }
      // The UI hides this option in that case; refuse it here too, so a stale panel cannot
      // manufacture the ambiguity this screen exists to clear up.
      if (source.kind === 'text' && typedByToken.get(source.token)?.existingAtVenueIds.includes(target.venueId)) {
        return json({ error: 'That venue already has a field with this name. Pick it instead of creating a second one.' }, 400);
      }
    } else if (target.kind === 'create-venue') {
      if (!target.name?.trim()) return json({ error: 'A name is required to create a venue.' }, 400);
    } else {
      if (!target.venueId && !target.venueFacilityId) {
        return json({ error: 'Choose a field, or leave the location as typed text.' }, 400);
      }
      // Resolve it HERE, not later. A panel left open while someone deleted a venue in another tab
      // sends an id the catalog no longer holds; if that refusal happened during step 3 it would
      // land AFTER an earlier assignment in the same batch had already created a venue or field,
      // leaving an orphaned empty record behind a 400. Validating every target before the first
      // insert is what makes the ordering guarantee above actually true.
      const check = resolveVenueSelectionFromCatalog(catalog, {
        venueId: target.venueId,
        venueFacilityId: target.venueFacilityId,
      });
      if (!check.ok) return json({ error: check.error }, 400);
    }

    prepared.push({ source, target, gameIds: group.gameIds });
  }

  const totalGames = prepared.reduce((total, item) => total + item.gameIds.length, 0);
  if (totalGames > MAX_GAMES_PER_REQUEST) {
    return json({ error: `Too many games in one request (limit ${MAX_GAMES_PER_REQUEST}).` }, 400);
  }

  // Step 3 — create what the decisions call for and resolve each one to its final columns, in one
  // pass. Creations stay sequential: each new surface takes the next display order, which reads a
  // counter the previous iteration moved.
  const gameById = new Map(games.map(game => [game.id, game]));
  const writes: {
    source: AssignmentSource;
    gameIds: string[];
    venueId: string | null;
    venueFacilityId: string | null;
    location: string | null;
  }[] = [];
  let facilityType: FacilityType | null = null;

  for (const item of prepared) {
    let venueId: string | null | undefined;
    let venueFacilityId: string | null | undefined;

    if (item.target.kind === 'create-venue') {
      const name = item.target.name.trim();
      // Reuse a venue that already carries this name rather than adding a second one. Creating a
      // duplicate is the one outcome worse than doing nothing: two venues named "Community Park"
      // make that name permanently AMBIGUOUS to the matcher, so this screen and every future
      // import would stop being able to resolve it — the screen manufacturing the very problem it
      // exists to clear up. Also makes a retried request idempotent.
      const existing = [...catalog.venues.values()]
        .find(venue => normalizeVenueNameToken(venue.name) === normalizeVenueNameToken(name));
      const venue = existing ?? await createTournamentVenue({ tournamentId, name });
      catalog.venues.set(venue.id, venue);
      venueId = venue.id;
      venueFacilityId = null;
    } else if (item.target.kind === 'create-facility') {
      // Only read the tournament's sport if a surface is actually being created.
      facilityType ??= await defaultFacilityTypeFor(tournamentId);
      const parentVenueId = item.target.venueId;
      const facility = await createTournamentFacility({
        tournamentId,
        venueId: parentVenueId,
        name: item.target.name.trim(),
        facilityType,
        // Sort order is "within the venue" per the data dictionary — count this venue's own
        // surfaces, not every surface in the tournament.
        displayOrder: [...catalog.facilities.values()].filter(f => f.venueId === parentVenueId).length + 1,
      });
      catalog.facilities.set(facility.id, facility);
      venueId = parentVenueId;
      venueFacilityId = facility.id;
    } else {
      venueId = item.target.venueId;
      venueFacilityId = item.target.venueFacilityId;
    }

    const selection = resolveVenueSelectionFromCatalog(catalog, { venueId, venueFacilityId });
    if (!selection.ok) return json({ error: selection.error }, 400);
    writes.push({ source: item.source, gameIds: item.gameIds, ...selection.value });
  }

  // Step 4 — write. One statement per decision, not one per game, and the decisions address
  // disjoint sets of games so they can go together.
  //
  // Each result carries the exact per-game before-state, which is what the screen's Undo replays:
  // the typed wording of one game in a group is not always the wording of its neighbour
  // ("Diamond 1" and "diamond 1" normalize together), so restoring the group's display name to all
  // of them would quietly rewrite data the admin never asked to change.
  const applied = await Promise.all(writes.map(async write => {
    const before: RevertGame[] = write.gameIds.map(id => {
      const game = gameById.get(id)!;
      return {
        id,
        venueId: game.venueId ?? null,
        venueFacilityId: game.venueFacilityId ?? null,
        location: game.location ?? null,
      };
    });
    const { error } = await supabaseAdmin
      .from('games')
      .update({
        diamond_id: write.venueId,
        venue_facility_id: write.venueFacilityId,
        location: write.location,
        // A real field replaces a temporary lane, matching Phase 2's rule that an explicit venue
        // pick detaches the lane. Typed-name groups never carry one (they are excluded from the
        // plan), so in practice this only applies to a re-pointed linked group.
        schedule_facility_lane_id: null,
      })
      .in('id', write.gameIds)
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return {
      source: write.source,
      gameCount: write.gameIds.length,
      label: write.location,
      // Echoed so an Undo can prove these games still hold what this apply wrote.
      written: { venueId: write.venueId, venueFacilityId: write.venueFacilityId, location: write.location },
      before,
    };
  }));

  return json({ applied });
}

/**
 * Undo — put back the state the client captured when it applied.
 *
 * The client is trusted for the VALUES (they are its own record of what was there) but never for
 * the SCOPE: every id is re-checked against this tournament, and a venue reference is re-validated
 * through the rail so an undo cannot smuggle in a foreign venue. Note this is therefore a general
 * bulk location write bounded by the caller's existing `update_schedule` rights — not a privileged
 * "replay a specific history entry" primitive.
 *
 * ⚠ `expected` is what stops an undo trampling someone else's work. Between the apply and the undo,
 * another admin can have re-pointed some of those games by hand through the ordinary editor. Undo
 * only touches games that STILL hold what the apply wrote; anything since changed is left alone and
 * counted back to the caller, because silently reverting a colleague's deliberate edit is the same
 * category of harm as silently moving a game — which is what this whole project exists to stop.
 */
async function revertGames(
  tournamentId: string,
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithScope>>>,
  rawGames: RevertGame[],
  expected: ExpectedState | null,
) {
  const games = rawGames.filter(game => game?.id);
  if (games.length === 0) return json({ error: 'Nothing to undo.' }, 400);
  if (games.length > MAX_GAMES_PER_REQUEST) {
    return json({ error: `Too many games in one request (limit ${MAX_GAMES_PER_REQUEST}).` }, 400);
  }

  const lockOrScope = await requireWritableTournament(ctx, tournamentId);
  if (lockOrScope) return lockOrScope;

  const ids = [...new Set(games.map(game => game.id))];
  const [ownedRes, catalog] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('id, diamond_id, venue_facility_id, location')
      .eq('tournament_id', tournamentId)
      .in('id', ids),
    loadTournamentVenueCatalog(tournamentId),
  ]);
  if (ownedRes.error) throw ownedRes.error;
  const owned = ownedRes.data ?? [];
  const ownedIds = new Set(owned.map(row => row.id as string));
  if (ownedIds.size !== ids.length) {
    return json({ error: 'One or more games are no longer part of this tournament.' }, 404);
  }

  const unchangedIds = new Set(
    expected
      ? owned
        .filter(row =>
          (row.diamond_id ?? null) === expected.venueId
          && (row.venue_facility_id ?? null) === expected.venueFacilityId
          && (row.location ?? null) === expected.location)
        .map(row => row.id as string)
      : ownedIds,
  );
  const skipped = ownedIds.size - unchangedIds.size;
  if (unchangedIds.size === 0) {
    return json({ reverted: 0, skipped, error: 'Those games have all been changed since — nothing was undone.' }, 409);
  }

  // Group identical before-states so restoring 39 games is a handful of statements, not 39.
  const buckets = new Map<string, { venueId: string | null; venueFacilityId: string | null; location: string | null; ids: string[] }>();
  for (const game of games) {
    if (!unchangedIds.has(game.id)) continue;
    const selection = resolveVenueSelectionFromCatalog(catalog, {
      venueId: game.venueId,
      venueFacilityId: game.venueFacilityId,
      locationText: game.location,
    });
    if (!selection.ok) return json({ error: selection.error }, 400);
    const value = selection.value;
    const key = `${value.venueId ?? ''}|${value.venueFacilityId ?? ''}|${value.location ?? ''}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.ids.push(game.id);
    else buckets.set(key, { ...value, ids: [game.id] });
  }

  await Promise.all([...buckets.values()].map(async bucket => {
    const { error } = await supabaseAdmin
      .from('games')
      .update({
        diamond_id: bucket.venueId,
        venue_facility_id: bucket.venueFacilityId,
        location: bucket.location,
      })
      .in('id', bucket.ids)
      .eq('tournament_id', tournamentId);
    if (error) throw error;
  }));

  return json({ reverted: unchangedIds.size, skipped });
}

/**
 * A created field takes the sport's own surface type, not a generic "other". The read error is
 * raised rather than swallowed: falling through would silently stamp a baseball tournament's new
 * diamond as "other", which nothing downstream would ever flag.
 */
async function defaultFacilityTypeFor(tournamentId: string): Promise<FacilityType> {
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .select('sport')
    .eq('id', tournamentId)
    .single();
  if (error) throw error;
  return getSportPack(data?.sport as string | null | undefined).defaultFacilityType;
}
