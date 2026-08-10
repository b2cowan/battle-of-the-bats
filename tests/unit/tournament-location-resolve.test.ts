/**
 * Phase 3 — the review model behind "Match Typed Locations", plus the one invariant that keeps a
 * data tidy-up from paging a thousand families.
 *
 * The fixtures below are the REAL dev tournaments this phase was built against (measured
 * 2026-08-10), because the interesting cases were all found in the data rather than imagined:
 * a name that matches exactly, a name that matches nothing, a facility that shadows its own
 * venue's name, a tournament with no venues at all, and a tournament whose typed games are all
 * still tethered to generator lanes.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildLocationResolvePlan,
  linkedGroupKey,
  type ResolveGameRow,
} from '../../lib/tournament-location-resolve.ts';

function game(over: Partial<ResolveGameRow> & { id: string }): ResolveGameRow {
  return {
    location: null,
    venueId: null,
    venueFacilityId: null,
    scheduleFacilityLaneId: null,
    status: 'scheduled',
    ...over,
  };
}

/** Battle of the Bats: one venue, four surfaces, one of which shadows the venue's own name. */
const bats = {
  venues: [{ id: 'v1', name: 'Lions Sports Field' }],
  facilities: [
    { id: 'f1', venueId: 'v1', name: 'Diamond 1' },
    { id: 'f2', venueId: 'v1', name: 'Diamond 2' },
    { id: 'f3', venueId: 'v1', name: 'Diamond 3' },
    { id: 'f4', venueId: 'v1', name: 'Lions Sports Field' },
  ],
};

describe('buildLocationResolvePlan — grouping by name, not by game', () => {
  it('groups games by normalized name and counts them', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 1' }),
        game({ id: 'g2', location: 'diamond 1' }),
        game({ id: 'g3', location: '  DIAMOND   1  ' }),
        game({ id: 'g4', location: 'Diamond 2' }),
      ],
      bats,
    );
    assert.equal(plan.typedGroups.length, 2);
    assert.equal(plan.typedGroups[0].gameCount, 3);
    assert.deepEqual(plan.typedGroups[0].gameIds, ['g1', 'g2', 'g3']);
    assert.equal(plan.typedGameCount, 4);
  });

  it('groups punctuation variants of one name together, because the matcher does', () => {
    // Found by review: grouping used a normalization that does NOT flatten punctuation while
    // matching used one that does. "Diamond-1" and "Diamond 1" became two rows, each offering the
    // SAME exact-match suggestion — so resolving one silently left the other behind forever.
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 1' }),
        game({ id: 'g2', location: 'Diamond-1' }),
        game({ id: 'g3', location: 'diamond #1' }),
      ],
      bats,
    );
    assert.equal(plan.typedGroups.length, 1);
    assert.equal(plan.typedGroups[0].gameCount, 3);
    assert.equal(plan.typedGroups[0].match, 'exact');
  });

  it('labels a group with its most-used wording, and breaks ties the same way every time', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'diamond 1' }),
        game({ id: 'g2', location: 'diamond 1' }),
        game({ id: 'g3', location: 'Diamond 1' }),
      ],
      bats,
    );
    assert.equal(plan.typedGroups[0].name, 'diamond 1');

    // Which casing wins a tie is cosmetic; that it is STABLE is not. The label is the row's
    // identity on screen, so it must not shuffle between reloads or when the game order changes.
    const tiedA = buildLocationResolvePlan(
      [game({ id: 'g1', location: 'diamond 1' }), game({ id: 'g2', location: 'Diamond 1' })],
      bats,
    );
    const tiedB = buildLocationResolvePlan(
      [game({ id: 'g1', location: 'Diamond 1' }), game({ id: 'g2', location: 'diamond 1' })],
      bats,
    );
    assert.equal(tiedA.typedGroups[0].name, tiedB.typedGroups[0].name);
  });

  it('sorts the biggest cleanup first', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 2' }),
        game({ id: 'g2', location: 'Diamond 1' }),
        game({ id: 'g3', location: 'Diamond 1' }),
      ],
      bats,
    );
    assert.deepEqual(plan.typedGroups.map(g => g.name), ['Diamond 1', 'Diamond 2']);
  });

  it('suggests the exact match, and only the exact match', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 1' }),
        game({ id: 'g2', location: 'Diamond 4' }),
      ],
      bats,
    );
    const byName = new Map(plan.typedGroups.map(g => [g.name, g]));
    assert.equal(byName.get('Diamond 1')!.match, 'exact');
    assert.deepEqual(byName.get('Diamond 1')!.suggestion, { venueId: 'v1', facilityId: 'f1' });
    // "Diamond 4" genuinely does not exist in this fixture — 20 real games depend on it staying
    // unmatched rather than being nudged onto Diamond 1.
    assert.equal(byName.get('Diamond 4')!.match, 'unmatched');
    assert.equal(byName.get('Diamond 4')!.suggestion, null);
  });

  it('names the venues that already own a surface by this name, so "create it" is not offered there', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 1' }),
        game({ id: 'g2', location: 'Diamond 4' }),
        // Punctuation must not smuggle a duplicate past the check: the matcher would read
        // "Diamond #2" and "Diamond 2" as the same name, so creating it would poison both.
        game({ id: 'g3', location: 'Diamond #2' }),
      ],
      bats,
    );
    const byName = new Map(plan.typedGroups.map(g => [g.name, g]));
    assert.deepEqual(byName.get('Diamond 1')!.existingAtVenueIds, ['v1']);
    assert.deepEqual(byName.get('Diamond #2')!.existingAtVenueIds, ['v1']);
    assert.deepEqual(byName.get('Diamond 4')!.existingAtVenueIds, []);
  });

  it('offers no suggestion when a name shadows its own venue', () => {
    const plan = buildLocationResolvePlan([game({ id: 'g1', location: 'Lions Sports Field' })], bats);
    assert.equal(plan.typedGroups[0].match, 'ambiguous');
    assert.equal(plan.typedGroups[0].suggestion, null);
    assert.equal(plan.typedGroups[0].ambiguousTargets.length, 2);
  });

  it('reports how many games in a group are already played', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 1', status: 'completed' }),
        game({ id: 'g2', location: 'Diamond 1', status: 'completed' }),
        game({ id: 'g3', location: 'Diamond 1', status: 'scheduled' }),
      ],
      bats,
    );
    assert.equal(plan.typedGroups[0].gameCount, 3);
    assert.equal(plan.typedGroups[0].completedCount, 2);
  });

  it('includes completed and cancelled games (owner decision 2026-08-10)', () => {
    // Leaving them out would leave the history wrong AND leave the group permanently
    // half-converted, so the screen could never reach empty.
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Diamond 1', status: 'completed' }),
        game({ id: 'g2', location: 'Diamond 1', status: 'cancelled' }),
      ],
      bats,
    );
    assert.equal(plan.typedGroups[0].gameCount, 2);
  });
});

describe('buildLocationResolvePlan — the two exclusions', () => {
  it('never offers placeholder text as convertible, but says how many there are (R2)', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'TBD' }),
        game({ id: 'g2', location: 'tba' }),
        game({ id: 'g3', location: 'N/A' }),
        game({ id: 'g4', location: 'Diamond 1' }),
      ],
      bats,
    );
    assert.deepEqual(plan.typedGroups.map(g => g.name), ['Diamond 1']);
    assert.equal(plan.excluded.placeholderGames, 3);
  });

  it('does not count a game with no location at all as a placeholder', () => {
    const plan = buildLocationResolvePlan(
      [game({ id: 'g1', location: null }), game({ id: 'g2', location: '   ' })],
      bats,
    );
    assert.equal(plan.typedGroups.length, 0);
    assert.equal(plan.excluded.placeholderGames, 0);
  });

  it('leaves lane-tethered games to the Resolve Temporary Facilities panel', () => {
    // The whole Bye Demo fixture: 21 typed games, every one still on a generator lane. This
    // screen must show NOTHING for it — converting would tear a draft schedule off its lanes.
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', location: 'Playoff Facility 1', scheduleFacilityLaneId: 'lane-1' }),
        game({ id: 'g2', location: 'Playoff Facility 2', scheduleFacilityLaneId: 'lane-2' }),
      ],
      { venues: [], facilities: [] },
    );
    assert.equal(plan.typedGroups.length, 0);
    assert.equal(plan.excluded.laneGames, 2);
  });

  it('still reviews a lane game once a real venue has been resolved onto it', () => {
    // A resolved lane is a linked group like any other — the structured reference is the truth.
    const plan = buildLocationResolvePlan(
      [game({ id: 'g1', venueId: 'v1', venueFacilityId: 'f1', scheduleFacilityLaneId: 'lane-1' })],
      bats,
    );
    assert.equal(plan.excluded.laneGames, 0);
    assert.equal(plan.linkedGroups.length, 1);
  });
});

describe('buildLocationResolvePlan — the already-linked list (the durable half of undo)', () => {
  it('groups referenced games by surface with a derived label', () => {
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', venueId: 'v1', venueFacilityId: 'f1' }),
        game({ id: 'g2', venueId: 'v1', venueFacilityId: 'f1' }),
        game({ id: 'g3', venueId: 'v1', venueFacilityId: 'f2' }),
        game({ id: 'g4', venueId: 'v1' }),
      ],
      bats,
    );
    const byKey = new Map(plan.linkedGroups.map(g => [g.key, g]));
    assert.equal(byKey.get(linkedGroupKey('v1', 'f1'))!.gameCount, 2);
    assert.equal(byKey.get(linkedGroupKey('v1', 'f1'))!.label, 'Lions Sports Field — Diamond 1');
    // Venue-only games are their own group — they are on the park, surface unknown.
    assert.equal(byKey.get(linkedGroupKey('v1', null))!.label, 'Lions Sports Field');
    assert.equal(byKey.get(linkedGroupKey('v1', null))!.gameCount, 1);
  });

  it('derives the parent venue from the surface when the game carries only the surface', () => {
    const plan = buildLocationResolvePlan([game({ id: 'g1', venueFacilityId: 'f2' })], bats);
    assert.equal(plan.linkedGroups.length, 1);
    assert.equal(plan.linkedGroups[0].venueId, 'v1');
    assert.equal(plan.linkedGroups[0].label, 'Lions Sports Field — Diamond 2');
  });

  it('ignores a reference this tournament does not own', () => {
    // Offering to re-point a group we cannot even name would write against a foreign record.
    const plan = buildLocationResolvePlan(
      [
        game({ id: 'g1', venueId: 'v-elsewhere' }),
        game({ id: 'g2', venueId: 'v1', venueFacilityId: 'f-elsewhere' }),
      ],
      bats,
    );
    assert.equal(plan.linkedGroups.length, 0);
    assert.equal(plan.typedGroups.length, 0);
  });

  it('never lists a referenced game as a typed name, even when it also carries text', () => {
    // Every game carries a `location` cache; a referenced game's text is derived, not authored.
    const plan = buildLocationResolvePlan(
      [game({ id: 'g1', venueId: 'v1', venueFacilityId: 'f1', location: 'Lions Sports Field — Diamond 1' })],
      bats,
    );
    assert.equal(plan.typedGroups.length, 0);
    assert.equal(plan.linkedGroups.length, 1);
  });
});

describe('buildLocationResolvePlan — a tournament with no venues', () => {
  it('reports that there is nothing to match against', () => {
    // Free Cup: 15 games on "Community Park", zero venues configured. Creating is the only
    // honest fix, so the UI needs to know matching is impossible.
    const plan = buildLocationResolvePlan(
      [game({ id: 'g1', location: 'Community Park' })],
      { venues: [], facilities: [] },
    );
    assert.equal(plan.hasVenues, false);
    assert.equal(plan.typedGroups[0].match, 'unmatched');
    assert.equal(plan.typedGroups[0].name, 'Community Park');
  });

  it('reports an empty review when every game is already linked', () => {
    // The live demo sandbox: 30 games, all referenced. The banner must not appear.
    const plan = buildLocationResolvePlan([game({ id: 'g1', venueId: 'v1', venueFacilityId: 'f1' })], bats);
    assert.equal(plan.typedGroups.length, 0);
    assert.equal(plan.typedGameCount, 0);
    assert.equal(plan.hasVenues, true);
  });
});

/**
 * ⚠ THE ONE THAT MATTERS MOST.
 *
 * A conversion changes a game's venue reference from "none" to a real field, which
 * `lib/schedule-change-classify.ts` correctly reads as the game having MOVED. Wire the resolve
 * route through the notifying games path and a Tuesday-evening data tidy-up sends a "your game
 * has moved" notice to every following family — for games that did not move, and in the dev
 * fixtures, for games played weeks ago.
 *
 * This is a source-level rule rather than a behavioural test because the failure is an IMPORT
 * someone adds in good faith, and no unit test of the current code would notice it appearing.
 */
describe('the resolve route must never notify families', () => {
  const routeSource = readFileSync(
    join(process.cwd(), 'app', 'api', 'admin', 'schedule-locations', 'route.ts'),
    'utf8',
  );

  /**
   * Comments are stripped first, on purpose: the rule is about CODE, and the paragraph in the
   * route explaining why it must not notify is the most valuable thing in the file. A guard that
   * punished the explanation would get the explanation deleted.
   */
  const routeCode = routeSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('does not import or call anything that messages families', () => {
    const forbidden = [
      'recordGameScheduleChanges',
      'schedule-change-notices',
      'game-day-reminders',
      'notifyFansForPlayoff',
      'fan-notify',
      "from '@/lib/notify'",
    ];
    for (const token of forbidden) {
      assert.ok(
        !routeCode.includes(token),
        `app/api/admin/schedule-locations/route.ts references "${token}". Tidying data is not a schedule change — a conversion must not message families. If notifications are genuinely wanted here, that is an owner decision, not a refactor.`,
      );
    }
  });

  it('still explains the rule in the file, so the next editor knows why', () => {
    assert.match(routeSource, /MUST NEVER NOTIFY FAMILIES/);
  });
});
