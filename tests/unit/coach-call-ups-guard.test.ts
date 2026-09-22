/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A CALL-UP IS IN THE GAME AND NOWHERE ELSE** (mig 309; owner rulings R1–R6, 2026-09-22; plan
 * `docs/projects/active/COACH_CALL_UPS_PLAN.md`).
 *
 * A call-up is a player borrowed for one game. They must reach the lineup, the printed card and the
 * game's own screens — and must never reach dues, skills & goals, awards, documents, tryouts,
 * family audiences, the roster count, any season-long playing-time figure, Season Wrapped, the
 * closed-season roster shelf or next season's rollover.
 *
 * ⚠⚠ **WHY THIS FILE EXISTS AT ALL, GIVEN THE FEATURE IS "FREE".** The model was chosen precisely
 * because ~59 roster reads already filter `status === 'active'`, so every one of those exclusions
 * holds today with no code written. That is exactly the argument for testing it: **nothing in the
 * codebase currently says those filters are load-bearing.** A future reader tidying one of them to
 * `!== 'inactive'`, or a new surface written without one, breaks a rule nobody wrote down and no
 * screenshot shows. The whole feature is an absence, and an absence needs a witness.
 *
 * The sibling half is `roster-status-constraint-guard.test.ts`, which holds the type and the live
 * database constraint together — the failure that let `'released'` exist in the type for a year
 * while the database refused every write of it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

const API = join(REPO, 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]');
const readApi = (...seg: string[]) => readFileSync(join(API, ...seg, 'route.ts'), 'utf8');

/** Every `route.ts` under the coach team API. */
function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

describe('call-ups — the exclusion lives in the shared read', () => {
  /**
   * ⚠⚠ **THIS REPLACED A LIST OF SIX HAND-NAMED SCREENS, AND THE REPLACEMENT IS THE POINT.**
   *
   * The first cut of mig 309 left `getRepRosterPlayers` open and relied on the ~59 callers that
   * happen to filter `status === 'active'` themselves. This file then asserted that six named files
   * contained that filter — a sample standing in for a claim about fifty-nine, which is exactly the
   * kind of test that is green while the thing it describes is false.
   *
   * It was. `/simplify` found `lib/rep-season-wrapped.ts` feeding the unfiltered roster straight into
   * `rosterCount: roster.length`, and `lib/insights-digest.ts` feeding it to the season analytics —
   * so a borrowed player would have inflated the season's roster count and landed in the fair-play
   * figures, which is the single defect this whole feature exists to prevent. Six named files all
   * passed while two unnamed ones were wrong.
   *
   * The exclusion now lives in the read, so the test can assert the structural fact instead of
   * sampling its consequences.
   */
  it('getRepRosterPlayers excludes call-ups at the query, by default', () => {
    const src = read('lib/db.ts');
    const start = src.indexOf('export async function getRepRosterPlayers');
    assert.ok(start > -1, 'getRepRosterPlayers is gone — every roster read in the portal just changed shape.');
    const body = src.slice(start, src.indexOf('\n}', start));
    assert.match(
      body, /if \(!opts\?\.includeCallUps\) q = q\.neq\('status', 'callup'\)/,
      'The shared roster read no longer excludes call-ups by default. Every caller that does not '
      + 'filter for itself — Season Wrapped\'s roster count and the insights digest among them — now '
      + 'carries borrowed players into figures about the team.',
    );
  });

  it('getRepRosterPlayer returns null for a call-up, which shuts nine side doors', () => {
    const src = read('lib/db.ts');
    const start = src.indexOf('export async function getRepRosterPlayer(');
    assert.ok(start > -1, 'getRepRosterPlayer is gone.');
    const body = src.slice(start, src.indexOf('\n}', start));
    assert.match(
      body, /player\.status === 'callup' && !opts\?\.includeCallUps/,
      'The by-id roster read no longer refuses a call-up. The player page, its notes, documents, '
      + 'development, goals and measurables routes all resolve a player through here with the same '
      + 'ownership check and none of them test for a call-up themselves — so a borrowed player\'s id '
      + 'posted at any of them attaches a note or a document to them.',
    );
  });

  /**
   * The inventory the six named files were standing in for. Opting in is allowed; opting in
   * *silently* is not.
   */
  /**
   * ⚠⚠ **THE RAW QUERIES THE SHARED READ CANNOT REACH.** The default exclusion covers everything
   * that goes through `getRepRosterPlayers` / `getRepRosterPlayer` — but a `.from('rep_roster_players')`
   * written by hand inherits nothing, and `/review` found five that mattered:
   *   · six money routes proving a player id with a raw `select('id')`, so a crafted request could
   *     land dues, a credit, a payout, a surplus adjustment or an expense on a borrowed player —
   *     money that no money screen would then display, because they all exclude call-ups;
   *   · the Families desk, whose predicate is "not declined, not withdrawn" rather than
   *     `=== 'active'`, so every call-up became a permanent "child with no family" the admin could
   *     not clear;
   *   · the guardian-link writer, the one family audience the no-email CHECK cannot close;
   *   · the platform ops desk's roster-size metric.
   * Each is asserted BY NAME, because the failure is silent at every one of them.
   */
  const RAW_QUERY_SURFACES: { what: string; rel: string }[] = [
    { what: 'the dues fee-schedule write', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts' },
    { what: 'dues payments', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/route.ts' },
    { what: 'dues credits', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-credits/route.ts' },
    { what: 'dues payouts', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payouts/route.ts' },
    { what: 'season-surplus adjustments', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/adjustments/route.ts' },
    { what: 'who fronted an expense', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/expenses/route.ts' },
    { what: 'the Families desk', rel: 'lib/families-read.ts' },
    { what: 'the guardian-link writer', rel: 'lib/family-guardian.ts' },
    { what: 'the platform roster-size metric', rel: 'lib/founding-season-desk.ts' },
  ];
  for (const { what, rel } of RAW_QUERY_SURFACES) {
    it(`${what} excludes call-ups in its own raw query`, () => {
      assert.match(
        read(rel), /\.neq\('status', 'callup'\)/,
        `${rel} queries rep_roster_players directly and no longer excludes call-ups. It inherits `
        + 'nothing from the shared read, so the exclusion has to be written here — and its absence '
        + 'is silent: no error, no empty screen, just a borrowed player where one must never be.',
      );
    });
  }

  it('only the surfaces that manage call-ups opt back in', () => {
    const ALLOWED = [
      // The roster page's own Call-ups shelf — the one screen that manages the list.
      'app/api/coaches/[orgSlug]/teams/[teamId]/roster/route.ts',
      // Removing a call-up, and validating one being re-used, both need to see one.
      'app/api/coaches/[orgSlug]/teams/[teamId]/call-ups/route.ts',
      'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/call-ups/route.ts',
    ];
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { scan(full); continue; }
        if (!/\.tsx?$/.test(entry)) continue;
        const rel = full.replace(REPO + '\\', '').replace(/\\/g, '/');
        if (!/includeCallUps:\s*true/.test(readFileSync(full, 'utf8'))) continue;
        if (!ALLOWED.includes(rel)) offenders.push(rel);
      }
    };
    scan(join(REPO, 'app'));
    scan(join(REPO, 'lib'));
    assert.deepEqual(
      offenders, [],
      `These surfaces opt back into reading call-ups: ${offenders.join(', ')}. That is allowed, but `
      + 'it is a decision about whether borrowed players belong in that screen — add it to ALLOWED '
      + 'with a reason, do not delete this assertion.',
    );
  });
});

describe('call-ups — the surfaces a borrowed player must never reach', () => {
  /**
   * The exclusions, by surface. Each entry names a file and the filter that keeps call-ups out.
   *
   * ⚠ Asserted BY NAME, one per surface, rather than as a single "they all filter" sweep. A sweep
   * passes when a surface is deleted or renamed; a named assertion fails and says which screen lost
   * its guarantee. These are the screens the owner's ask was actually about — "we don't want them
   * cluttering up our screens that have roster lists where it is not applicable (i.e. player dues,
   * skills and goals, etc.)".
   */
  const MUST_FILTER_ACTIVE: { what: string; rel: string }[] = [
    { what: 'skills & goals — the development board', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/development/board/route.ts' },
    { what: 'a development session', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/route.ts' },
    { what: 'returning-player continuity', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/route.ts' },
    { what: 'awards', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/awards/route.ts' },
    { what: 'tryout baselines', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-baselines/route.ts' },
    { what: 'attendance', rel: 'app/api/coaches/[orgSlug]/teams/[teamId]/attendance/route.ts' },
  ];

  for (const { what, rel } of MUST_FILTER_ACTIVE) {
    it(`${what} reads the ACTIVE roster only`, () => {
      const src = read(rel);
      assert.match(
        src, /status === 'active'/,
        `${rel} no longer filters the roster to active players. Since mig 309 that filter is what `
        + `keeps CALL-UPS off this screen — a borrowed player would now appear in ${what}, which is `
        + 'the exact clutter this feature was built to prevent. Re-add the filter; do not relax this test.',
      );
    });
  }

  /**
   * ⚠⚠ THE TWO ROUTES THAT DO NOT USE THE `status === 'active'` SHAPE, asserted on their own terms.
   * Both were found by this file rather than by reading, and one of them was a real defect: the
   * dues route deliberately lists the WHOLE roster (a departed player can still owe money), so it
   * inherited none of the free exclusion and would have rendered every call-up as a $0 row — in the
   * one screen the owner named first when asking for this feature.
   */
  it('player dues still lists departed players', () => {
    const src = read('app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts');
    assert.doesNotMatch(
      src, /rosterPlayers\.filter\(p => p\.status === 'active'\)/,
      'The dues list now shows ACTIVE players only, which hides a departed player\'s unpaid balance. '
      + 'It reads the WHOLE roster on purpose; call-ups are excluded by getRepRosterPlayers, so there '
      + 'is nothing here that needs narrowing.',
    );
  });

  it('the budget plan counts the active roster', () => {
    const src = read('app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/route.ts');
    assert.match(
      src, /\.eq\('status', 'active'\)/,
      'The budget plan\'s roster count is no longer restricted to active players, so a borrowed '
      + 'player would inflate the per-player figures the whole plan divides by.',
    );
  });

  it('the installment generator counts the roster, not call-ups', () => {
    const src = read('app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments/route.ts');
    assert.match(
      src, /\.eq\('status', 'active'\)/,
      'The dues installment generator no longer restricts to active roster players. A call-up would '
      + 'be issued a fee schedule — money owed by a family that is not on this team.',
    );
  });

  it('next season\'s rollover carries the roster, not call-ups', () => {
    const src = read('lib/rep-season-rollover.ts');
    assert.match(
      src, /status === 'active'/,
      'The season rollover no longer filters to active players, so a player borrowed for one game '
      + 'in 2026 would be carried onto the 2027 roster.',
    );
  });

  it('the season playing-time report is built from the active roster', () => {
    const src = read('lib/team-season-analytics.ts');
    assert.match(
      src, /status === 'active'/,
      'FINDING F1, AND THE MOST EXPENSIVE ONE IN THIS FEATURE. The season analytics matrix no longer '
      + 'filters to active players. A call-up who played one game lands in the fair-play table showing '
      + '"1 game, 4 field, 2 bench" beside teammates at fourteen games, and reads as a child being '
      + 'short-changed. The rule is: a call-up counts INSIDE a game and never ACROSS the season.',
    );
  });

  /* The archive shelf and the association export both answer "who was on the team", and both get
     the call-up exclusion from the shared read now. What still needs asserting is that neither
     started filtering to ACTIVE: a departed player must stay on both, because dropping someone who
     played rewrites the season — and narrowing to active is the tempting wrong way to exclude. */
  for (const [what, rel] of [
    ['the closed season\'s roster shelf', 'app/api/coaches/[orgSlug]/teams/[teamId]/season-roster/route.ts'],
    ['the association roster export', 'app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/roster/route.ts'],
  ] as const) {
    it(`${what} still lists departed players`, () => {
      assert.doesNotMatch(
        read(rel), /status === 'active'/,
        `${rel} now filters to ACTIVE players, which drops everyone who left the team mid-season `
        + 'from a record of who was on it. Call-ups are already excluded by getRepRosterPlayers.',
      );
    });
  }
});

describe('call-ups — the narrow hole into a game', () => {
  it('a lineup admits the active roster AND this event\'s call-ups, and nothing else', () => {
    const src = readApi('events', '[eventId]', 'lineup');
    assert.match(
      src, /getRepCallUpsForEvent\(eventId\)/,
      'The lineup route no longer resolves THIS event\'s call-ups, so a called-up player cannot be '
      + 'saved into the lineup they were called up for.',
    );
    assert.match(
      src, /new Set\(\[\.\.\.players, \.\.\.eventCallUps\]/,
      'The lineup PUT\'s allowed-player set is no longer "active roster ∪ this event\'s call-ups". '
      + 'Widened (to the pool, or to all non-active rows) it lets ANOTHER game\'s borrowed player '
      + 'into this lineup — invisible in every list the builder draws, but holding a batting slot, '
      + 'counted by the lineup check and printed on the card.',
    );
  });

  it('the per-event call-up read is scoped to the event, never to the season', () => {
    const src = read('lib/db.ts');
    const start = src.indexOf('export async function getRepCallUpsForEvent');
    assert.ok(start > -1, 'getRepCallUpsForEvent is gone — the lineup routes have no scoped call-up read.');
    const body = src.slice(start, src.indexOf('\n}', start));
    assert.match(
      body, /\.eq\('event_id', eventId\)/,
      'getRepCallUpsForEvent no longer filters by event. Every game would offer every call-up the '
      + 'team has ever saved — owner ruling R3 is that a fresh game offers NONE.',
    );
    assert.match(
      body, /\.eq\('status', 'callup'\)/,
      'getRepCallUpsForEvent no longer checks the row is still a call-up, so a demoted row could be '
      + 'admitted to a lineup by a stale link.',
    );
  });

  it('calling someone up is gated on lineups, not on roster-write (R5)', () => {
    const src = readApi('events', '[eventId]', 'call-ups');
    assert.match(
      src, /assignment\.capabilities\.lineups/,
      'The call-up route\'s gate changed. R5: an assistant running the game at a field can call '
      + 'someone up — it creates no money and no record that outlives the game.',
    );
    assert.doesNotMatch(
      src, /capabilities\.rosterWrite/,
      'The call-up route now requires roster-write, which blocks the assistant standing at the '
      + 'diamond an hour before first pitch. R5 put this with the lineups job.',
    );
  });

  it('call-ups are offered on GAMES only — never a practice', () => {
    const src = readApi('events', '[eventId]', 'call-ups');
    assert.match(
      src, /GAME_EVENT_TYPES\.includes\(event\.eventType\)/,
      'The call-up route no longer restricts to games. There is no such thing as calling someone up '
      + 'to a practice, and offering it would put a borrowed child on a practice plan, a station '
      + 'rotation and a practice attendance sheet — none of which this feature has an answer for.',
    );
  });

  it('taking a call-up off a game clears their lineup row, WITHOUT a delete-all rewrite', () => {
    const src = readApi('events', '[eventId]', 'call-ups');
    assert.match(
      src, /removePlayerFromSavedLineup/,
      'Unlinking a call-up no longer clears their lineup entry. A stranded entry holds a batting '
      + 'slot and a fielding position for a player no list on the screen can show, still counted by '
      + 'the lineup check and still printed on the card — and unfixable from the builder.',
    );
    /**
     * ⚠⚠ The FIRST version used `replaceRepTeamLineupEntries`, which deletes every row for the
     * lineup and re-inserts the survivors. A transient failure on that re-insert left the coach's
     * ENTIRE saved lineup empty while the handler answered only "Could not take that call-up off
     * this game" — so nothing on the client knew to rewrite it, and the emptiness surfaced when
     * somebody opened Game-Day Mode at the field. Found by `/review`; do not put it back.
     */
    assert.doesNotMatch(
      src, /replaceRepTeamLineupEntries/,
      'This route is back to the delete-all-then-reinsert helper. A failed re-insert wipes the '
      + 'whole saved lineup and reports only that one removal failed. Remove the one row instead.',
    );
  });

  it('removing one player from a saved lineup closes the batting-order gap', () => {
    const src = read('lib/db.ts');
    const start = src.indexOf('export async function removePlayerFromSavedLineup');
    assert.ok(start > -1, 'removePlayerFromSavedLineup is gone.');
    const body = src.slice(start, src.indexOf('\n}\n', start));
    assert.match(
      body, /batting_order: u\.want/,
      'The targeted removal no longer renumbers. Copying the survivors\' slots verbatim leaves a gap '
      + '(1, 2, 4, 5) which the lineup PUT accepts — it only rejects duplicates and out-of-range — so '
      + 'the gap reaches the printed card and the bench console, then changes under the coach the '
      + 'next time the builder reopens and renumbers on load.',
    );
  });

  it('the player-detail route never opts back into call-ups', () => {
    assert.doesNotMatch(
      readApi('roster', '[playerId]'), /includeCallUps/,
      'The player-detail route opts back into reading call-ups, so `getRepRosterPlayer` stops '
      + 'refusing one there. That page is the portal\'s busiest instrument — dues, documents, '
      + 'development, guardians, medical — and it carries a control that flips `status`, so reaching '
      + 'it with a call-up offers to move a borrowed player ONTO the roster from a screen that has '
      + 'no idea what they are.',
    );
  });

  it('the roster PATCH cannot turn a rostered player into a call-up', () => {
    const src = readApi('roster', '[playerId]');
    assert.match(
      src, /body\.status === 'active' \|\| body\.status === 'inactive'/,
      'The roster PATCH accepts an arbitrary status again. Writing \'callup\' there converts a '
      + 'rostered player into a borrowed one and drops them out of dues, development and the season '
      + 'report in a single request.',
    );
  });
});

describe('call-ups — the mark a coach reads', () => {
  it('there is ONE predicate and ONE label', () => {
    const src = read('lib/coach-roster-name.ts');
    assert.match(src, /export function isCallUp/, 'isCallUp is gone — the mark is now a bare status test at each call site, and will go missing from whichever surface is added next.');
    assert.match(src, /export const CALL_UP_LABEL = 'Call-up'/, 'The call-up label moved or changed spelling. One word, one spelling, everywhere a customer reads it (owner ruling R1).');
  });

  /**
   * ⚠⚠ **THIS ASSERTION IS CARRYING THE ONE-SPELLING RULE FOR THIS WORD.** "Call-up" is settled
   * (owner ruling R1) but cannot go in `check:spelling`: that gate matches whole words
   * case-insensitively, and the identifier forms (`callUps`, `isCallUp`, `CallUpSheet`) plus the
   * stored status value `'callup'` produced 41 hits with no customer prose among them — see the
   * note in `scripts/check-spelling-consistency.mjs`.
   *
   * So the guarantee moved here: the word has ONE definition, and a screen that wants to print it
   * must import that. A second spelling cannot be typed without also being a second constant, which
   * is a stronger promise than a grep — but only while this test exists.
   */
  it('no surface uses a second spelling of the word', () => {
    /**
     * ⚠ **CASE-SENSITIVE, AND THAT IS THE WHOLE TRICK.** The shared `check:spelling` gate matches
     * `\b(...)\b` with the `i` flag, so `callups` swallows the prop `callUps` and `Callup` swallows
     * `isCallUp` / `CallUpSheet` — 41 hits, no prose. Case-SENSITIVELY those collide with nothing:
     * `Callup` ≠ `CallUp`, `callups` ≠ `callUps`. So the rule is enforceable here even though it is
     * not enforceable there, on exactly the surfaces that print the word.
     *
     * Not included: `'callup'`, which is the stored status value and correct everywhere it appears.
     */
    const WRONG: { re: RegExp; why: string }[] = [
      { re: /\bCallups?\b/g, why: 'one word — the settled spelling is hyphenated: Call-up / Call-ups' },
      { re: /\bcallups\b/g, why: 'one word and lowercase — the settled spelling is Call-ups' },
      { re: /\bCall Up\b/g, why: 'title-cased two words — the verb reads "Call up a player"; the noun is "Call-up"' },
      { re: /\bcall-Up\b/g, why: 'mid-word capital — Call-up at the start of a label, call-up inside a sentence' },
    ];
    const SURFACES = [
      'app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx',
      'components/coaches/LineupInningList.tsx',
      'components/coaches/CallUpSheet.tsx',
      'lib/coach-roster-name.ts',
      'lib/export/pdf.ts',
    ];
    const found: string[] = [];
    for (const rel of SURFACES) {
      // Comments stripped: prose in an explanation is not a customer-visible string, and a guard
      // that fires on its own documentation teaches the next reader to delete it.
      const code = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const { re, why } of WRONG) {
        for (const m of code.matchAll(re)) found.push(`${rel}: "${m[0]}" — ${why}`);
      }
    }
    assert.deepEqual(
      found, [],
      'A second spelling of the settled word reached a customer-visible surface:\n  '
      + found.join('\n  ')
      + '\n\nOne word, one spelling, everywhere a customer can read it (owner ruling R1, 2026-09-22). '
      + 'The mark itself should come from CALL_UP_LABEL rather than a literal.',
    );
  });

  const MARKED: { what: string; rel: string }[] = [
    { what: 'the desktop batting order', rel: 'app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx' },
    { what: 'the phone\'s inning list', rel: 'components/coaches/LineupInningList.tsx' },
  ];
  for (const { what, rel } of MARKED) {
    it(`${what} marks a call-up`, () => {
      assert.match(
        read(rel), /isCallUp\(row\.player\)/,
        `${rel} no longer marks call-ups. A coach scanning this list has to work out whether a name `
        + 'is one of their own players, which is the single thing the mark exists to prevent.',
      );
    });
  }

  /**
   * ⚠⚠ **A PICKER AND ITS VALIDATOR MUST AGREE.** Merging call-ups into the bench console's player
   * list also fed the console's "Who's here" drawer and its "About a player?" dropdown — while the
   * attendance and game-moment writes still validated against the active roster alone. So both
   * controls OFFERED a borrowed player and then refused them: attendance rolled the toggle back with
   * no message at all, mid-game; a game note answered "Unknown player." Found by `/review`.
   */
  for (const [what, seg] of [
    ['attendance', 'attendance'],
    ['game notes', 'game-moments'],
  ] as const) {
    it(`${what} accepts this game's call-ups, because the console offers them`, () => {
      const src = readApi('events', '[eventId]', seg);
      assert.match(
        src, /getRepCallUpsForEvent\(eventId\)/,
        `The ${what} route no longer admits this game's call-ups, but the bench console still lists `
        + 'them in the control that writes here. A picker whose validator refuses what it offers is '
        + 'a dead button in the middle of a game.',
      );
    });
  }

  it('the schedule\'s lineup peek reads call-ups, or it shows the wrong batting order', () => {
    assert.match(
      read('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx'), /data\.callUps/,
      'The schedule sheet\'s lineup peek ignores the call-ups key again. It builds rows by resolving '
      + 'each saved entry to a player and drops the ones it cannot resolve, then renumbers — so a '
      + 'call-up batting 4th vanishes and everyone below moves up a slot. The coach reads a different '
      + 'order there from the one on the printed card and the bench console.',
    );
  });

  it('the bench console marks a call-up on BOTH the field and the bench', () => {
    const src = read('app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx');
    assert.match(src, /const callUpMarkFor/, 'The console\'s call-up mark helper is gone.');
    assert.equal(
      src.split('{callUpMarkFor(r.playerId)}').length - 1, 2,
      'The console draws its rows twice — on the field and on the bench — and the call-up mark must '
      + 'appear in both. One of them has lost it, which means a borrowed player reads as one of '
      + 'your own in half the board.',
    );
  });

  /**
   * ⚠⚠ THIS ONE IS ABOUT DATA LOSS, NOT A MISSING MARK.
   *
   * The console filters saved lineup entries down to the players in its payload — on purpose, so a
   * player deactivated mid-season cannot ride into its full-replace PUT and poison every save with
   * a 400 (/review, 2026-08-04). With call-ups missing from that payload, the same filter silently
   * dropped a borrowed player from the loaded grid, and the next substitution wrote the lineup back
   * WITHOUT them — deleting a real player from a lineup saved with them in it, mid-game, no error.
   */
  it('the bench console loads this game\'s call-ups, or its next save deletes them', () => {
    const src = readApi('events', '[eventId]', 'game-console');
    assert.match(
      src, /getRepCallUpsForEvent\(eventId\)/,
      'The game-console payload no longer carries this game\'s call-ups. The console filters saved '
      + 'entries to the players it was given and then PUTs the whole lineup back — so a call-up '
      + 'absent from this payload is silently deleted from the saved lineup by the next substitution.',
    );
    assert.match(
      src, /redactRoster\(\[\.\.\.players, \.\.\.callUps\], caps\)/,
      'Call-ups are no longer merged into the console\'s player list. Every list on that screen — '
      + 'field, bench, swap, seed — asks "who is available for this game?", and a call-up on this '
      + 'game is.',
    );
  });

  it('the printed lineup marks a call-up in WORDS, not colour', () => {
    const src = read('lib/export/pdf.ts');
    assert.match(
      src, /function posterPlayerName/,
      'The poster\'s call-up name helper is gone, so the name column and the card can now disagree '
      + 'about whether a borrowed player is identified.',
    );
    assert.match(
      src, /\(Call-up\)/,
      'The printed sheet no longer names call-ups. This paper goes on a dugout wall and a '
      + 'scorekeeper\'s clipboard and is very often photocopied — a tint that survives the screen '
      + 'and dies in the photocopier is not an answer to "who is on this team".',
    );
  });
});

describe('call-ups — the builder offers none at rest (owner ruling R3)', () => {
  /**
   * ⚠⚠ THE RULING THIS ASSERTS, in the owner's own words (2026-09-22):
   *   "if we have 3 call ups in our system, default the lineup builder does not show me any but
   *    shows me the add call up button, I can add an existing call up or create a new one"
   *
   * The first drawing of this screen showed a standing pool list under the lineup and was rejected.
   * That version is easy to drift back into, because "just show them, it's fewer taps" is a
   * reasonable-sounding change to anyone who does not know the pool grows all season.
   */
  it('the builder renders only THIS game\'s call-ups, never the pool', () => {
    const src = read('app/[orgSlug]/coaches/teams/[teamId]/lineups/_LineupEditor.tsx');
    assert.match(
      src, /callUpsNotInLineup/,
      'The builder\'s call-up group is gone or renamed. It must list only call-ups on THIS game who '
      + 'are not in the order.',
    );
    /* ⚠ CODE ONLY. The first version of this assertion scanned the raw source and failed on the
       word "pool" inside the comments explaining why the pool is not here — a guard that fires on
       its own documentation teaches the next reader to delete it. */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(
      code, /pool/i,
      'THE BUILDER HAS LEARNED ABOUT THE POOL. The saved list must live behind the "Call up a '
      + 'player" sheet and in the roster page\'s Call-ups section — never on the builder at rest. '
      + 'Three saved call-ups show as nothing until the coach asks (owner ruling R3).',
    );
    assert.doesNotMatch(
      code, /fetch\(/,
      'The editor now fetches. It is the presentational half — the page owns every request, which '
      + 'is what keeps the pool out of reach of the component that draws the lineup.',
    );
  });

  it('the page fetches the pool only when the sheet opens', () => {
    const src = read('app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx');
    const start = src.indexOf('async function openCallUpSheet');
    assert.ok(start > -1, 'openCallUpSheet is gone — if the pool is now loaded with the page, it is one edit away from being rendered on it.');
    assert.match(
      src.slice(start, start + 600), /fetch\(callUpsBase\)/,
      'The pool is no longer fetched when the sheet opens. Loading it with the page is the same '
      + 'instinct that put the pool on the page in the first place.',
    );
  });

  it('a new lineup seeds from the roster, never from call-ups', () => {
    const src = read('app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx');
    assert.match(
      src, /: players;/,
      'The empty-lineup seed changed. It must be the ACTIVE ROSTER only — seeding from call-ups '
      + 'puts a borrowed player in the batting order before anyone asked for them.',
    );
    assert.match(
      src, /new Map\(\[\.\.\.players, \.\.\.gameCallUps\]/,
      'The saved-lineup lookup no longer includes this game\'s call-ups. A lineup SAVED with a '
      + 'call-up in it would resolve them to undefined and silently drop them — a hole in the '
      + 'batting order and a card that no longer matches the game.',
    );
  });

  it('call-ups never enter the attendance rows the builder treats as the roster', () => {
    const src = read('app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx');
    const start = src.indexOf('setAttendanceRows(players.map');
    assert.ok(
      start > -1,
      'The attendance rows are no longer built from `players` alone. They feed the editor\'s '
      + '`roster` prop and therefore "Not in the lineup" — a call-up in there is indistinguishable '
      + 'from one of your own players in exactly the list this feature exists to keep clean.',
    );
  });
});

describe('call-ups — a borrowed family is never emailed (owner ruling R6)', () => {
  it('the create path writes no guardian email', () => {
    const src = readApi('events', '[eventId]', 'call-ups');
    assert.match(
      src, /guardianEmail: null/,
      'The call-up create path can now set a guardian email. Every family audience in the product '
      + 'is built by collecting guardian_email, so a call-up that can hold one can enter an '
      + 'audience — and the family emailed is not on this team.',
    );
  });

  it('the database refuses one too', () => {
    const sql = read('supabase/migrations/309_a_call_up_is_in_the_game_not_on_the_team.sql');
    assert.match(
      sql, /rep_roster_players_callup_no_email_check/,
      'Migration 309\'s no-email constraint is gone. The route guard alone is one forgotten filter '
      + 'away from emailing another team\'s family; the constraint is what makes it impossible.',
    );
  });

  it('no coach route may create a call-up outside the per-game door', () => {
    const offenders = routeFiles(API)
      .filter(f => !f.includes(join('events', '[eventId]', 'call-ups')))
      .filter(f => /status: 'callup'|'callup' \}\)/.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(REPO, ''));
    assert.deepEqual(
      offenders, [],
      `These routes create or set 'callup' outside the one door that is allowed to: ${offenders.join(', ')}. `
      + 'A second creation path is a second place the no-email rule, the game scoping and the R5 gate '
      + 'have to be remembered.',
    );
  });
});
