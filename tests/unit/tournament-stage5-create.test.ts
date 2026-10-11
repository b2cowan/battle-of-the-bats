/**
 * ONE SET OF CREATION QUESTIONS (Tournament admin redesign Stage 5, Part 1 — E1, A47, A51, A55; F77–F79, F83, F84,
 * F91). What the build must keep true:
 *   - a venue's lanes are "Diamond 1…N" in the sport's word, at every way a venue is added — never "Park — Diamond 1",
 *     and one lane is "Diamond 1", never the park's name (F77);
 *   - "your venues" is each past venue ONCE, its newest copy (A51, F79);
 *   - next year's name takes the year in one tap (A55);
 *   - the style rides WITH the tournament in the one create step, and so do the venues and their diamonds (F78);
 *   - every copy path keeps a venue's diamonds and its library links (6a's F2), through one home;
 *   - the clone asks what New tournament asks: no live name twice, no start date before today (F84);
 *   - the first run opens the same window, and its own steps (and the question nothing read) are gone (F25, F91);
 *   - ?create=1 never opens the window at the slot limit (F83).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  clampFacilityCount, dedupePastVenues, facilityKindForSport, facilityNames, facilityNoun, listFacilityNames,
} from '../../lib/venue-facilities.ts';
import { nameForYear, normalizeTournamentName, sameTournamentName, slugForName } from '../../lib/tournament-name.ts';
import { CREATE_WORDS } from '../../lib/tournament-setup-words.ts';
import { endDateFollowingStart } from '../../lib/timezone.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('a venue\'s lanes, named one way (F77)', () => {
  it('a count of N is "Diamond 1…N"; one is "Diamond 1"', () => {
    assert.deepEqual(facilityNames(3, 'diamond'), ['Diamond 1', 'Diamond 2', 'Diamond 3']);
    assert.deepEqual(facilityNames(1, 'diamond'), ['Diamond 1'], 'never the park\'s own name');
    assert.deepEqual(facilityNames(2, 'court'), ['Court 1', 'Court 2']);
    assert.deepEqual(facilityNames(1, 'other'), ['Field 1'], '"Other 1" is not a name');
  });
  it('the count is held to 1…30', () => {
    assert.equal(clampFacilityCount(0), 1);
    assert.equal(clampFacilityCount('4'), 4);
    assert.equal(clampFacilityCount(99), 30);
    assert.equal(clampFacilityCount('x'), 1);
  });
  it('the word follows the sport: softball and baseball diamonds, basketball courts, the rest fields', () => {
    assert.equal(facilityKindForSport('softball'), 'diamond');
    assert.equal(facilityKindForSport('baseball'), 'diamond');
    assert.equal(facilityKindForSport('basketball'), 'court');
    assert.equal(facilityKindForSport('other'), 'field');
    assert.equal(facilityKindForSport(null), 'diamond', 'a new tournament takes the column default, softball');
    assert.equal(facilityNoun('diamond', 3), 'diamonds');
  });
  it('names read in a sentence with the serial comma; four or more as a range', () => {
    assert.equal(listFacilityNames(['Diamond 1']), 'Diamond 1');
    assert.equal(listFacilityNames(['Diamond 1', 'Diamond 2']), 'Diamond 1 and Diamond 2');
    assert.equal(listFacilityNames(['Diamond 1', 'Diamond 2', 'Diamond 3']), 'Diamond 1, Diamond 2, and Diamond 3');
    assert.equal(listFacilityNames(facilityNames(6, 'diamond')), 'Diamond 1 to Diamond 6');
    assert.equal(CREATE_WORDS.venueLine([{ names: facilityNames(3, 'diamond') }], 'diamond'), '1 venue · 3 diamonds: Diamond 1, Diamond 2, and Diamond 3.');
  });
  it('the venue route names its lanes through the one helper — never "Venue — Diamond N"', () => {
    const route = code('app/api/admin/venues/route.ts');
    assert.match(route, /createTournamentVenue\(/);
    assert.doesNotMatch(route, /\$\{data\.name\} — \$\{typeLabel/);
    assert.doesNotMatch(route, /scope === 'org'/, 'the raw every-copy search retired with the old wizard (F79)');
    const copy = code('lib/tournament-venue-copy.ts');
    assert.match(copy, /facilityNames\(clampFacilityCount\(input\.count\), kind\)/);
  });
});

describe('"your venues" — each past venue once, the newest copy (A51, F79)', () => {
  it('two copies of one park are one row, the latest event\'s', () => {
    const rows = dedupePastVenues([
      { id: 'a', name: 'Maple Field 1', address: '1 Main St', sourceTournamentYear: 2025, facilities: [{ name: 'Diamond 1' }] },
      { id: 'b', name: 'Maple Field 1', address: '1 Main St', sourceTournamentYear: 2026, facilities: [{ name: 'Diamond 1' }, { name: 'Diamond 2' }] },
      { id: 'c', name: 'Lions Park', address: null, sourceTournamentYear: 2024 },
      { id: 'd', name: ' maple field 1 ', address: '1  Main St', sourceTournamentYear: 2023 },
    ]);
    assert.deepEqual(rows.map(r => r.id), ['c', 'b']);
  });
});

describe('next year under one at a time (A55)', () => {
  it('a name with last year\'s year has it replaced; a name without one gains the year', () => {
    assert.equal(nameForYear('Spring Classic 2026', 2027, 2026), 'Spring Classic 2027');
    assert.equal(nameForYear('Spring Classic', 2027, 2026), 'Spring Classic 2027');
    assert.equal(nameForYear('Spring Classic 2025', 2027), 'Spring Classic 2027');
    assert.equal(slugForName('Spring Classic 2027'), 'spring-classic-2027');
  });
  it('names compare case- and space-blind, as the server refuses them', () => {
    assert.equal(normalizeTournamentName('  Spring   CLASSIC '), 'spring classic');
    assert.ok(sameTournamentName('Spring Classic', 'spring  classic'));
    assert.match(CREATE_WORDS.nameHeld(2026), /^Your 2026 event has this name\.$/);
  });
});

describe('one create step: the style, the venues and their diamonds ride with the tournament (F78)', () => {
  it('setup-tournament saves the style in the tournament\'s own insert and creates the venues before it answers', () => {
    const route = code('app/api/admin/setup-tournament/route.ts');
    assert.match(route, /formatPatch \? \{ settings: formatPatch\.settings \} : \{\}/);
    assert.match(route, /copyPastVenue\(tid, auth\.org\.id/);
    assert.match(route, /copyLibraryVenue\(tid, auth\.org\.id/);
    assert.match(route, /createTournamentVenue\(tid, venue\)/);
    assert.doesNotMatch(route, /migration/, 'the old venue copy with no facilities had no caller and went');
  });
  it('the wizard sends one request — no second patch-settings call whose failure was swallowed', () => {
    const wizard = code('components/admin/TournamentSetupWizard.tsx');
    assert.doesNotMatch(wizard, /patch-settings/);
    assert.match(wizard, /format: form\.format/);
    assert.doesNotMatch(wizard, /scope=org/);
    assert.match(wizard, /<KitDialog/, 'the kit\'s form window — full screen with ← on a phone');
  });
});

describe('every copy path keeps a venue\'s diamonds and library links (6a\'s F2)', () => {
  it('the clone copies venues through the one home, facilities included', () => {
    const db = code('lib/db.ts');
    const clone = db.slice(db.indexOf('export async function cloneTournament'), db.indexOf('export async function populateTournamentFrom'));
    // Since Part 2 the clone's rows come through the shared copier (lib/tournament-setup-copy), whose venues are this home's.
    assert.match(clone, /copySetupRows\(\{/);
    assert.match(code('lib/tournament-setup-copy.ts'), /copyTournamentVenues\(sourceId, targetId/);
    assert.doesNotMatch(read('lib/db.ts'), /recorded for Tournament Stage 5, which redraws setup; not fixed here/);
  });
  it('the copy home keeps both library links', () => {
    const copy = code('lib/tournament-venue-copy.ts');
    assert.match(copy, /source_org_venue_id: v\.source_org_venue_id \?\? null/);
    assert.match(copy, /source_org_facility_id: f\.source_org_facility_id \?\? null/);
    assert.match(copy, /source_org_facility_id: fromLibrary \? f\.id/);
  });
});

describe('the clone asks what New tournament asks (F84)', () => {
  it('a live name twice and a start date before today are refused', () => {
    const route = code('app/api/admin/tournaments/[tournamentId]/clone/route.ts');
    assert.match(route, /startDate < tournamentToday\(\)/);
    assert.match(route, /sameTournamentName\(String\(row\.name \?\? ''\), name\)/);
    assert.match(route, /'first_run'/, 'the first run is a door the analytics know');
  });
});

describe('the first run opens the one window (F25, F91)', () => {
  it('its own tournament steps, the question nothing read and the Plus offer after a free choice are gone', () => {
    const page = code('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.match(page, /openNew\('first_run'/);
    assert.doesNotMatch(page, /qualifying/);
    assert.doesNotMatch(page, /onboarding-survey/);
    assert.doesNotMatch(page, /action: 'save'/);
    assert.doesNotMatch(page, /— Diamond/);
  });
  it('?create=1 never opens the window at the slot limit (F83)', () => {
    const list = code('app/[orgSlug]/admin/org/tournaments/page.tsx');
    assert.match(list, /if \(!atLimit && canWrite\) openNew\('manage_tournaments_new_button'\)/);
    assert.match(code('components/admin/tournament/SetupWizardOpener.tsx'), /if \(atLimit && door !== 'first_run'\)/);
  });
  it('the shared parts it stands on exist', () => {
    for (const f of ['components/admin/tournament/VenueChooser.tsx', 'components/admin/tournament/NewVenueSheet.tsx', 'lib/tournament-venue-copy.ts']) {
      assert.ok(existsSync(new URL(`../../${f}`, import.meta.url)), f);
    }
  });
});

describe('the End date fills in two days after the Start date, and follows it until it is picked (§290 step 4)', () => {
  // One step of the Start date field: what the End date becomes.
  const pick = (from: { start: string; end: string }, start: string) =>
    ({ start, end: endDateFollowingStart(from.start, from.end, start, 2) });
  const blank = { start: '', end: '' };

  it('a first Start date fills the End date two days later', () => {
    assert.deepEqual(pick(blank, '2026-11-13'), { start: '2026-11-13', end: '2026-11-15' });
    assert.equal(pick(blank, '2026-12-30').end, '2027-01-01', 'across a year end');
  });
  it('a second Start date inside the old span moves the filled-in End date with it — never onto the start\'s own day', () => {
    const first = pick(blank, '2026-11-11');
    assert.equal(pick(first, '2026-11-13').end, '2026-11-15', 'the walk\'s defect: it stayed on 13 November');
    // Arrowing the day up one at a time sends every day in between.
    assert.equal(pick(pick(first, '2026-11-12'), '2026-11-13').end, '2026-11-15');
    assert.equal(pick(first, '2026-11-09').end, '2026-11-11', 'an earlier start pulls it back too');
  });
  it('an End date the organizer picked stays while it is on or after the start, and is filled in again past it', () => {
    const chosen = { start: '2026-11-13', end: '2026-11-17' };
    assert.equal(pick(chosen, '2026-11-14').end, '2026-11-17');
    assert.equal(pick(chosen, '2026-11-17').end, '2026-11-17', 'a one-day event is the organizer\'s to choose');
    assert.equal(pick(chosen, '2026-11-20').end, '2026-11-22');
  });
  it('a cleared Start date clears the End date', () => {
    assert.equal(pick({ start: '2026-11-13', end: '2026-11-15' }, '').end, '');
  });
  it('typing a year passes "0002…", "0020…", "0202…" — the End date follows each, never into the 1900s', () => {
    let at = pick(blank, '2026-11-03');
    for (const start of ['0002-11-03', '0020-11-03', '0202-11-03']) {
      at = pick(at, start);
      assert.equal(at.end, `${start.slice(0, 4)}-11-05`);
    }
    assert.equal(pick(at, '2027-11-03').end, '2027-11-05');
  });
  it('a year typed past four digits never throws and never leaves a broken End date', () => {
    // A picked End, then a Start at the last day a Date can hold, then another Start: the old Start is never shifted.
    assert.doesNotThrow(() => endDateFollowingStart('275760-09-12', '2026-11-20', '2026-11-13', 2));
    assert.equal(endDateFollowingStart('275760-09-12', '2026-11-20', '2026-11-13', 2), '2026-11-20');
    assert.equal(endDateFollowingStart('', '', '111320-02-06', 2), '', 'a 6-digit year fills nothing');
    assert.equal(endDateFollowingStart('', '', '9999-12-31', 2), '', 'year 10000 is not a day the field can show');
  });
  it('both of the window\'s Start date fields use the one rule', () => {
    const wizard = code('components/admin/TournamentSetupWizard.tsx');
    assert.equal(wizard.match(/endDateFollowingStart\(f\.startDate, f\.endDate, /g)?.length, 2, 'New tournament and Start from a past tournament');
    assert.doesNotMatch(wizard, /function addDays/);
  });
});
