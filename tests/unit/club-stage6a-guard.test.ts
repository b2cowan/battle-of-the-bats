import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { functionBody, readCode, readSource } from './_source-code.ts';
import { venueListGroups } from '../../lib/where-field.ts';
import { hasOrgVenueLibrary } from '../../lib/plan-features.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 6a — ONE CLASH CHECK, RUN BY EVERY WRITER; ONE WAY TO SAY WHERE, ON EVERY FORM
 * (ratified 2026-10-08, hub K4MPu4ni53Ct7yrDcmWJd9 v64; plan §6 Stage 6).
 *
 * 1. Every route that writes a booking's TIME or PLACE — a rep event, a tryout day, a house-league game or
 *    practice, a tournament game — runs the cross-program check after it saves (`lib/venue-clash-lookup.ts`).
 *    A new writer fails here until it calls the check, or is named exempt WITH ITS REASON. The not-yet list
 *    only shrinks: a new entry is a decision, not a fix.
 * 2. The tournament mirror is skipped: a team's copy of its own tournament game is the tournament's booking
 *    (S6-06). The rule's own test (`venue-clash.test.ts`) proves it never compares the two.
 * 3. Every form that asks where an event is wears the ONE Venue field (`components/venue/WhereField.tsx`), or
 *    sits on the not-yet list with the stage that redraws it (Ask 13). Only shrinks.
 * 4. A team outside a club sees no Club venues group: the picker is exactly as built.
 * 5. The surface word is never written in (the owner's wording ruling): the field and the line read the sport.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const rel = (abs: string) => path.relative(ROOT, abs).split(path.sep).join('/');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const abs = path.join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(abs).isDirectory() ? walk(abs) : /\.(ts|tsx)$/.test(name) ? [abs] : [];
  });
}
const sourceFiles = () => [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib')), ...walk(path.join(ROOT, 'components'))];

// ── 1. The writers ──────────────────────────────────────────────────────────────────────────────

/** Writes a booking's time or place: one of the db writers, or a raw insert/update that names a time/place column. */
const WRITER_CALL = /\b(createRepTeamEvents?|updateRepTeamEvent|updateRepTeamEventSeries|createRepTryoutSession|updateRepTryoutSession|createLeagueGame|updateLeagueGame|createPractices|updateUpcomingEventsForPlace)\(|rpc\(['"](bulk_reschedule_games|club_schedule_finalize|club_schedule_apply_changes|club_schedule_hand_back|club_practices_carry)['"]/;
const RAW_WRITE = /from\(['"](games|league_games|league_practices|rep_team_events|rep_tryout_sessions)['"]\)\s*\.(insert|update|upsert)\(/g;
const PLACE_OR_TIME = /\b(starts_at|ends_at|scheduled_at|game_date|game_time|location|diamond_id|venue_facility_id|org_venue_id|place_id|field_number|duration_minutes)\b/;

function writesABooking(src: string): boolean {
  if (WRITER_CALL.test(src)) return true;
  for (const m of src.matchAll(RAW_WRITE)) {
    // An INSERT always places a booking (its payload is often built earlier, out of reach of a window); an
    // update or upsert counts when it names a time or place column.
    if (m[2] === 'insert' || PLACE_OR_TIME.test(src.slice(m.index!, m.index! + 600))) return true;
  }
  return false;
}

/** Each writer, the check it must call, and how many times (one per save path in the file). */
const WRITERS: Record<string, { check: RegExp; atLeast: number }> = {
  // Rep teams — add one + a weekly series; edit/move/un-cancel + a series edit (S6-05); the file import.
  'app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts': { check: /clashesForSavedRepEvents\(/g, atLeast: 2 },
  'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts': { check: /clashesForSavedRepEvents\(/g, atLeast: 2 },
  'app/api/coaches/[orgSlug]/teams/[teamId]/events/import/route.ts': { check: /clashesForSavedRepEvents\(/g, atLeast: 1 },
  // A tryout day (the owner's "Join the check", 2026-10-08) — add, and edit/move.
  'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/route.ts': { check: /clashesForSavedTryoutSessions\(/g, atLeast: 1 },
  'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/[sessionId]/route.ts': { check: /clashesForSavedTryoutSessions\(/g, atLeast: 1 },
  // House league — add a game; edit or move a game; add a practice (one or a series); the season generator.
  'app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts': { check: /clashReportForLeagueRows\(/g, atLeast: 1 },
  'app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts': { check: /clashReportForLeagueRows\(/g, atLeast: 1 },
  'app/api/admin/house-league/seasons/[seasonId]/practices/route.ts': { check: /clashReportForLeagueRows\(/g, atLeast: 1 },
  'app/api/admin/house-league/seasons/[seasonId]/schedule/generate/route.ts': { check: /clashReportForLeagueRows\(/g, atLeast: 1 },
  // Tournaments — add/edit a game, a drop on the timeline, the generator's commit, playoffs (POST bulk-save,
  // create, save-bracket); the rain-delay shift (after the database function); update + un-cancel.
  'app/api/admin/games/route.ts': { check: /clashReportForTournamentGames\(/g, atLeast: 3 },
  'app/api/admin/schedule-facility-lanes/route.ts': { check: /clashReportForTournamentGames\(/g, atLeast: 1 },
  'app/api/admin/schedule-locations/route.ts': { check: /clashReportForTournamentGames\(/g, atLeast: 2 },
  'app/api/admin/tournaments/[tournamentId]/schedule/import/commit/route.ts': { check: /clashReportForTournamentGames\(/g, atLeast: 1 },
  // The club scheduler (Club Tier Stage 11a): Finalize and Send the changes write the club's practices in one database
  // step each, then check what they wrote — one read of the pool for every team (two teams in one slot never clash).
  'lib/club-schedule-send.ts': { check: /clashesForSavedClubPractices\(/g, atLeast: 1 },
};

/** Writes a booking's time or place but is not a cross-program writer — each with its reason. */
const EXEMPT: Record<string, string> = {
  'lib/db.ts': 'the writers\' own data layer — every caller above runs the check',
  'lib/rep-tournament-game-mirror.ts': 'the tournament mirror: a team\'s copy of its own tournament game IS the tournament\'s booking (S6-06); the tournament writers check the game',
  'app/api/coaches/[orgSlug]/teams/[teamId]/places/[placeId]/route.ts': 'a place\'s "update the upcoming events" rewrites only events on a TEAM\'S OWN place, which the rule never compares (Ask 3) — it can never land on a club booking',
  'lib/coach-upgrade-migration.ts': 'a Basic team\'s own typed events, copied at upgrade — no club venue can reach them',
  'app/api/admin/venues/route.ts': 'only CLEARS a deleted facility from its games — a booking leaving a place cannot make a clash',
  'app/api/dev/seed/house-league/route.ts': 'a dev seed',
  'app/api/dev/seed/rep-team/route.ts': 'a dev seed',
  'app/api/dev/seed/tournament/route.ts': 'a dev seed',
  'lib/club-schedule-coach.ts': 'Hand back (Club Tier 11a, Ask 17) only REMOVES the team\'s practice — a booking leaving a place cannot make a clash',
  'lib/rep-season-rollover.ts': 'the season roll carries a club schedule\'s upcoming practices to the new season (Club Tier 11a, Ask 15) — their time and place never change',
  'app/api/admin/setup-tournament/route.ts': 'its only game writes are the dev-tools sample schedule (seedData, NEXT_PUBLIC_ENABLE_DEV_TOOLS only) on a brand-new DRAFT — since Tournament Stage 5 its venues may be library copies with their links, but a draft\'s sample games are never a real booking',
};

/** Writers not yet running the check, each with the stage that wires it. ⚠ ONLY SHRINKS. */
const NOT_YET: Record<string, string> = {};

describe('every writer of a booking\'s time or place runs the one clash check (Club Tier Stage 6a)', () => {
  const found = sourceFiles().map(rel).filter(f => writesABooking(readSource(f)));

  it('finds the writers it names (the scan still sees them)', () => {
    for (const f of Object.keys(WRITERS)) assert.ok(found.includes(f), `${f} no longer writes a booking — remove it from WRITERS`);
  });

  it('every writer calls the check, once per save path', () => {
    for (const [f, { check, atLeast }] of Object.entries(WRITERS)) {
      const n = [...readCode(f).matchAll(check)].length;
      assert.ok(n >= atLeast, `${f} calls ${check.source} ${n} time(s); it has ${atLeast} save path(s) — every one runs the check`);
    }
  });

  it('no writer appears that is neither checked, exempt (with its reason) nor on the not-yet list', () => {
    const unknown = found.filter(f => !WRITERS[f] && !EXEMPT[f] && !NOT_YET[f]);
    assert.deepEqual(unknown, [], `a new writer of a booking's time or place must run the cross-program check (lib/venue-clash-lookup.ts):\n  ${unknown.join('\n  ')}`);
  });

  it('the exempt list holds no stale entry', () => {
    for (const f of Object.keys(EXEMPT)) assert.ok(found.includes(f), `${f} no longer writes a booking — drop its exemption`);
  });

  it('the not-yet list only shrinks', () => {
    assert.deepEqual(Object.keys(NOT_YET), [], 'every writer runs the check since 6a — a new not-yet entry is a decision for the owner, not a fix');
  });
});

// ── 2. The mirror ─────────────────────────────────────────────────────────────────────────────

describe('the tournament mirror is skipped (S6-06)', () => {
  it('the lookup never reads a team\'s mirrored copy as a booking — the tournament game is the booking', () => {
    const lookup = readCode('lib/venue-clash-lookup.ts');
    assert.match(lookup, /if \(r\.source_tournament_game_id\) continue;/);
  });
  it('the mirror never runs the check itself, and a mirrored game\'s where is the organizer\'s', () => {
    assert.doesNotMatch(readCode('lib/rep-tournament-game-mirror.ts'), /venue-clash/);
    assert.match(readCode('lib/tournament-game-mirror.ts'), /'placeId', 'orgVenueId', 'orgVenueFacilityId'/);
  });
  it('the rule never compares a copy with its game (venue-clash.test.ts holds the case)', () => {
    assert.match(readSource('tests/unit/venue-clash.test.ts'), /mirrored copy of its own tournament game is never compared/);
  });
});

// ── 3. One way to say where ──────────────────────────────────────────────────────────────────

/** Every form that asks where an event is today. */
const WEARS_THE_FIELD = [
  'components/coaches/ScheduleEventForm.tsx',
  'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx',
  // House league's game window (9d-2a step 4: the page's Edit Game form became the read-first window).
  'components/admin/kit/club/league/schedule/GameWindow.tsx',
  'components/rep-teams/TryoutDayCard.tsx',
  'app/[orgSlug]/admin/tournaments/schedule/components/GameWindow.tsx',
  'app/[orgSlug]/admin/tournaments/schedule/components/MoveSheet.tsx',
];
/** Forms that still ask where their own way, and who brings them onto the field. ⚠ ONLY SHRINKS. */
const WHERE_NOT_YET: Record<string, string> = {
  // The setup wizard's venue step LEFT this list in Tournament admin redesign Stage 5 (2026-10-10): it picks a
  // tournament's venues from one ticked list (components/admin/tournament/VenueChooser — the club's library or "your
  // venues"), it never asks where one event is. Its games wear the Venue field (GameWindow, MoveSheet).
  'components/coaches/ScheduleEditor.tsx': 'the free Basic coach\'s schedule (never in a club, no place book) — found by 6a\'s scan, not drawn; the owner rules whether it takes the field',
  'components/coaches/ScheduleImportSheet.tsx': 'the schedule import\'s row cells mirror the file\'s "Location" column (export and import) — renaming the column changes the file\'s contract (a /marketing finding); since 6a the import links a row to a club venue by name',
};
/** A file that names where without being a form for it. */
const WHERE_EXEMPT: Record<string, string> = {
  'components/venue/WhereField.tsx': 'the field itself',
  'app/[orgSlug]/admin/tournaments/schedule/components/ResolveLocationsModal.tsx': 'matches typed names to venues in bulk — a tool, not a form that places one event',
  'app/[orgSlug]/admin/tournaments/schedule/components/ShiftDayModal.tsx': 'the rain-delay shift\'s Venue FILTER over games already placed — it never asks where',
};

/** "Asks where": wears a picker, or labels a box Location / Venue. */
const ASKS_WHERE = /<(WhereField|TournamentFieldPicker|PlaceCombobox)\b|aria-label="(Location|Venue)"|>\s*(Location|Venue)\s*<\/label>|placeholder="(Location|Venue)\b/;

describe('one way to say where, on every form (Ask 13)', () => {
  const forms = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
    .filter(f => f.endsWith('.tsx')).map(rel)
    .filter(f => ASKS_WHERE.test(readSource(f)));

  it('every form that asks where wears the one Venue field, or is on the not-yet list', () => {
    const unknown = forms.filter(f => !WEARS_THE_FIELD.includes(f) && !WHERE_NOT_YET[f] && !WHERE_EXEMPT[f]);
    assert.deepEqual(unknown, [], `a form asks where an event is in its own shape — wear components/venue/WhereField.tsx:\n  ${unknown.join('\n  ')}`);
  });
  it('the forms that wear it do', () => {
    for (const f of WEARS_THE_FIELD) assert.match(readCode(f), /<(WhereField|LeagueWhere)\b/, `${f} must wear the Venue field`);
  });
  it('the not-yet list only shrinks, and holds nothing stale', () => {
    assert.deepEqual(Object.keys(WHERE_NOT_YET).sort(), [
      'components/coaches/ScheduleEditor.tsx',
      'components/coaches/ScheduleImportSheet.tsx',
    ], 'a new not-yet form is a decision, not a fix');
    for (const f of Object.keys(WHERE_NOT_YET)) {
      assert.ok(forms.includes(f), `${f} no longer asks where its own way — move it to WEARS_THE_FIELD`);
    }
  });
  it('"Location" is retired as a label on the forms that wear the field (one spelling: Venue)', () => {
    for (const f of WEARS_THE_FIELD) assert.doesNotMatch(readCode(f), />\s*Location\s*<\/label>|aria-label="Location"/, f);
  });
});

// ── 4. A team outside a club ─────────────────────────────────────────────────────────────────

describe('a team outside a club sees no Club venues group', () => {
  const venues = [{ id: 'v', name: 'Lions Park', address: '41 Lions Park Dr', facilities: [{ id: 'f', name: 'Diamond 2' }] }];
  const places = [{ name: 'Lions Park', address: null }, { name: 'Westfield School', address: '120 Westfield Rd' }];

  it('outside a club: only the team\'s own places, exactly as built', () => {
    const g = venueListGroups({ inClub: false, clubVenues: venues, places, query: 'Lions' });
    assert.deepEqual(g.venues, []);
    assert.deepEqual(g.places.map(p => p.name), ['Lions Park']);
  });
  it('in a club: the club\'s venues first, the team\'s same-named place beside them, never merged', () => {
    const g = venueListGroups({ inClub: true, clubVenues: venues, places, query: 'Lions' });
    assert.deepEqual(g.venues.map(v => v.name), ['Lions Park']);
    assert.deepEqual(g.places.map(p => p.name), ['Lions Park']);
  });
  it('"in a club" is the plan carrying the library AND an active venue — never the plan alone', () => {
    assert.equal(hasOrgVenueLibrary('team'), false);
    assert.equal(hasOrgVenueLibrary('tournament_plus'), false);
    const lib = readCode('lib/venue-clash-lookup.ts');
    assert.match(lib, /if \(!hasOrgVenueLibrary\(org\.planId \?\? null\)\) return NO_LIBRARY;/);
    assert.match(lib, /if \(!active\.length\) return NO_LIBRARY;/);
  });
});

// ── 5. The word ──────────────────────────────────────────────────────────────────────────────

describe('the surface word is never written in (owner wording ruling, 2026-10-08)', () => {
  const READS_THE_SPORT = [
    'components/venue/WhereField.tsx',
    'lib/venue-clash-words.ts',
    'components/coaches/PlaceSheet.tsx',
  ];
  it('the field, the line and the place sheet read the sport\'s noun', () => {
    // `facilityWordAt` is the sport's noun unless the venue's own facilities say otherwise (owner, 2026-10-11).
    for (const f of READS_THE_SPORT) assert.match(readCode(f), /fieldNounFor\(|facilityWordAt\(/, f);
  });
  it('a club venue\'s facilities are labelled and counted in their own word — a dome reads Field (owner, 2026-10-11)', () => {
    const field = readCode('components/venue/WhereField.tsx');
    assert.match(field, /facLabel = facilityLabel \?\? facilityWordAt\(pickedVenueKinds\(value, clubVenues\), sport\)/);
    assert.match(field, /facilityWordAt\(v\.facilities\.flatMap/, 'the venue list\'s "6 fields" count');
    assert.match(readCode('lib/venue-clash-lookup.ts'), /org_venue_facilities\(id, name, facility_type, display_order\)/, 'the coach\'s list carries each facility\'s kind');
  });
  it('no label or sentence in them spells Diamond, Court or Field by hand', () => {
    for (const f of READS_THE_SPORT) {
      const code = readCode(f);
      assert.doesNotMatch(code, /['"`>]\s*(Field \/ Diamond|Diamond|Court)\b/, `${f} writes a surface word in — read fieldNounFor(sport)`);
    }
  });
  it('house league\'s windows and the tryout day pass the season\'s / team\'s sport to the field', () => {
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx'), /sport=\{season\?\.sport\}/);
    assert.match(readCode('components/rep-teams/TryoutDayCard.tsx'), /<WhereField[\s\S]*?sport=\{sport\}/);
  });
});

// ── 6. What the /review found (2026-10-08) ─────────────────────────────────────────────────────

describe('the review\'s fixes hold (Stage 6a /review, 2026-10-08)', () => {
  const HL_PAGE = 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx';
  const EVENT_PATCH = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts';
  const IMPORT = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/import/route.ts';

  it('a Save that asks the check first can\'t be pressed twice into two bookings', () => {
    // The save now starts after an awaited read, not inside the press: a form that waits on the check before it
    // marks itself saving must disable on `checking`, or a double press writes the game (or the series) twice.
    assert.match(readCode('components/venue/useClashCheck.ts'), /if \(inFlight\.current\) return false;/);
    const hl = readCode(HL_PAGE);
    assert.equal((hl.match(/onClick=\{async \(\) => \{ if \(await lineIsCurrent\(\)\)/g) ?? []).length, 1, 'house league\'s practice Create button');
    // The practice form's also waits for its team (9d-2a step 3: Add › A practice asks which team).
    assert.equal((hl.match(/disabled=\{saving \|\| refused \|\| checking \|\| !form\.teamId\}/g) ?? []).length, 1, 'it disables while the check is out');
    // The game's window (9d-2a step 4) marks itself saving in `write`, after it asks the check: Create and ✓ disable on
    // `checking` meanwhile, and `save` returns while a write is out.
    const gw = readCode('components/admin/kit/club/league/schedule/GameWindow.tsx');
    assert.match(functionBody(gw, 'save'), /if \(blocked \|\| saving\) return;[\s\S]*if \(!\(await lineIsCurrent\(\)\)\) return;/);
    assert.match(gw, /disabled=\{saving \|\| blocked\}/);
    assert.match(gw, /disabled: saving \|\| blocked/);
    assert.match(readCode('components/rep-teams/TryoutDayCard.tsx'), /onClick=\{saveSession\} disabled=\{saving \|\| checking\}/);
    // The coach's form marks itself saving BEFORE it asks — both of its saves.
    const form = readCode('components/coaches/ScheduleEventForm.tsx');
    assert.equal((form.match(/setSaving\(true\);\s*try \{\s*if \(!\(await lineIsCurrent\(\)\)\) return;/g) ?? []).length, 2);
  });

  it('the club pool pages past the 1,000-row cap — a cut-off page drops clashes without a word', () => {
    const pool = functionBody(readCode('lib/venue-clash-lookup.ts'), 'readClubPool');
    const reads = pool.split('supabaseAdmin').slice(1);
    for (const table of ['rep_team_events', 'rep_tryout_sessions', 'league_games', 'league_practices', 'diamonds', 'games', 'org_venue_facilities', 'rep_teams', 'league_seasons']) {
      const read = reads.find(r => r.includes(`.from('${table}')`));
      assert.ok(read, `the pool no longer reads ${table} — update this guard`);
      assert.match(read!, /\.order\('id'\)\.range\(a, b\)/, `${table} is read without paging`);
    }
  });

  it('keeping the venue an edit already stands on skips the plan gate, never the tenant proof', () => {
    const lib = readCode('lib/venue-clash-lookup.ts');
    assert.match(lib, /if \(venueId !== args\.storedVenueId && !hasOrgVenueLibrary\(args\.org\.planId \?\? null\)\)/);
    assert.match(lib, /const proof = await proveLibraryVenue\(args\.org\.id, venueId, facilityId\);/);
    assert.match(readCode(EVENT_PATCH), /storedVenueId: event\.orgVenueId/);
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/[sessionId]/route.ts'), /storedVenueId: owned\.session\.orgVenueId/);
  });

  it('a running score never reads the club pool — only a write that can move the booking is checked', () => {
    assert.match(readCode(EVENT_PATCH), /const checks = movesBooking \? await clashesForSavedRepEvents\(/);
  });

  it('a re-import keeps a diamond the sheet left blank, and never leaves a club link under new words', () => {
    const imp = readCode(IMPORT);
    assert.match(imp, /else if \(!onClub && row\.location\.trim\(\) && stored\?\.orgVenueId\) \{ changes\.orgVenueId = null; changes\.orgVenueFacilityId = null; \}/);
    assert.match(imp, /if \(!row\.field\.trim\(\) && stored\?\.orgVenueId === onClub\.orgVenueId\) \{\s*delete changes\.orgVenueFacilityId;\s*delete changes\.fieldNumber;/);
  });

  it('one check reaches at most two years past its first date', () => {
    const check = functionBody(readCode('lib/venue-clash-lookup.ts'), 'checkClubClashes');
    assert.match(check, /p\.startMs - first <= MAX_CHECK_SPAN_MS/);
  });
});

// ── 7. The permit's answer rides every check and every Where form (Club Tier Stage 10a, Ask 3) ──────────────

/**
 * How each form that wears the field shows "outside the club's permit" — the quiet line under Venue, beside (never inside)
 * the clash line. A form joins WEARS_THE_FIELD above → it must be named here with the way it shows the line, or the test
 * fails: a new form that asks where and says nothing about the permit is the gap this closes.
 */
const SHOWS_THE_PERMIT: Record<string, RegExp> = {
  // The coach's Add / Edit Event — one line or a series' summary, and each date outside marked in its list.
  'components/coaches/ScheduleEventForm.tsx': /permitSeriesLine\([\s\S]*permitLine\([\s\S]*<WhereLine tone="quiet" mark="clock"[\s\S]*permitDateMark\(/,
  // House league's practice and series windows, through the one live line (`useLeagueLine`, which 9d-2a step 4 moved beside
  // the game window so both wear it — the line itself is checked below), and the generator's after-save summary.
  'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx': /useLeagueLine\([\s\S]*permitAfterSave\(/,
  // House league's game window: the same live line, under its Venue field.
  'components/admin/kit/club/league/schedule/GameWindow.tsx': /useLeagueLine\([\s\S]*<WhereField\b[\s\S]*line=\{line\}/,
  // The tryout day.
  'components/rep-teams/TryoutDayCard.tsx': /permitLine\(check\?\.permits\[0\][\s\S]*<WhereLine tone="quiet" mark="clock"/,
  // The tournament's game window — from its save reply, as its clash line is (no live hook in the tournament).
  'app/[orgSlug]/admin/tournaments/schedule/components/GameWindow.tsx': /setPermitNote\(reply\.permitLine[\s\S]*<WhereLine tone="quiet" mark="clock" rest=\{permitNote\}/,
  // The phone's move sheet closes on save; its line is the timeline's note, from the same reply (the page).
  'app/[orgSlug]/admin/tournaments/schedule/components/MoveSheet.tsx': /<WhereField\b/,
};

describe('the permit\'s answer rides every check and every form that asks where (Club Tier 10a, Ask 3)', () => {
  it('every form that wears the field shows the permit\'s line, or names how it gets it', () => {
    assert.deepEqual(Object.keys(SHOWS_THE_PERMIT).sort(), [...WEARS_THE_FIELD].sort(),
      'a form wears the Venue field but says nothing about the club\'s permit — show permitLine under Venue (quiet, mark="clock")');
    for (const [f, shows] of Object.entries(SHOWS_THE_PERMIT)) assert.match(readCode(f), shows, f);
    // The move sheet's line: the timeline's note, from the move's own reply.
    assert.match(readCode('app/[orgSlug]/admin/tournaments/schedule/page.tsx'), /setPermitNote\(reply\.permitLine[\s\S]*<WhereLine tone="quiet" mark="clock" rest=\{permitNote\}/);
    // House league's one live line (its game, practice and series windows): a date or a series outside the permit.
    assert.match(readCode('components/admin/kit/club/league/schedule/useLeagueLine.tsx'), /permitSeriesLine\([\s\S]*permitLine\([\s\S]*<WhereLine tone="quiet" mark="clock"/);
  });
  it('the clash check is the Venue library\'s and checks the plan itself — every caller, the save replies included', () => {
    const body = functionBody(readCode('lib/venue-clash-lookup.ts'), 'checkClubClashes');
    // The plan right now, through the door (Support console Stage 4): free Club time opens the library too.
    assert.match(body, /effectiveOrgFactsForId\(orgId\)/);
    assert.match(body, /if \(!hasOrgVenueLibrary\(plan\?\.planId \?\? null\)\) return new Map\(\);/);
  });
  it('the three live checks answer it as their own field, beside the findings', () => {
    for (const f of [
      'app/api/coaches/[orgSlug]/teams/[teamId]/venue-clashes/route.ts',
      'app/api/admin/house-league/seasons/[seasonId]/venue-check/route.ts',
      'app/api/admin/tournaments/[tournamentId]/club-clashes/route.ts',
    ]) {
      const code = readCode(f);
      // The quiet read: a failed permit read says nothing, never an error.
      assert.match(code, /checkClubPermitsQuietly\(ctx\.org\.id,/, f);
    }
  });
  it('every writer\'s reply carries it: the shared report, and each rep writer\'s own field', () => {
    const lookup = readCode('lib/venue-clash-lookup.ts');
    assert.match(functionBody(lookup, 'report'), /checkClubPermitsQuietly\(orgId, placed\)/);
    // The rep writers' one read answers both, side by side — never a permit folded into the findings.
    assert.match(functionBody(lookup, 'checksFor'), /checkClubClashes\(orgId, placed\)[\s\S]*checkClubPermitsQuietly\(orgId,/);
    const repWriters: Record<string, number> = {
      'app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts': 2,
      'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts': 2,
      'app/api/coaches/[orgSlug]/teams/[teamId]/events/import/route.ts': 1,
      'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/route.ts': 1,
      'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions/[sessionId]/route.ts': 1,
    };
    for (const [f, n] of Object.entries(repWriters)) {
      const code = readCode(f);
      const clashes = (code.match(/clashesForSaved(RepEvents|TryoutSessions)\(/g) ?? []).length;
      const permits = (code.match(/\bpermits\b[,:} ]/g) ?? []).length;
      assert.ok(clashes >= n, f);
      assert.ok(permits >= clashes, `${f}: every save path that reports clashes replies with the permits too`);
    }
  });
  it('it is NEVER a third clash kind — a booking against a permit is not a pair (P11-04b)', () => {
    assert.match(readCode('lib/venue-clash.ts'), /export type ClashKind = 'booked_by' \| 'busy_then';/);
    assert.doesNotMatch(readCode('lib/venue-clash.ts'), /outside_permit/);
  });
});

// Keep the scan honest about what it reads.
void readFileSync;
