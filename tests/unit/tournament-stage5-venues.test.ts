/**
 * VENUES & FACILITIES (Tournament admin redesign Stage 5, Part 5 — E5, A51; F87). What the build must keep true:
 *   - a venue is a record with its diamonds inside it; a venue with none says so;
 *   - the pencil edits the venue and its diamonds in ONE save, never taking out a diamond with a played game, and every
 *     write reports its failure;
 *   - one Add a venue window: the library (or "your venues") and a new venue with its count; a repeat is said;
 *   - the address is one line; the library line says the truth about a copy.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { VENUE_WORDS as W, deleteVenueQuestion, lanesHeading, lanesLine, noLanes } from '../../lib/tournament-venue-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('a venue, in words (E5)', () => {
  it('names its diamonds, or says it has none, in the sport\'s word', () => {
    assert.equal(lanesLine(['Diamond 1', 'Diamond 2', 'Diamond 3', 'Diamond 4']), 'Diamond 1 · Diamond 2 · Diamond 3 · Diamond 4');
    assert.equal(lanesLine(['A', 'B', 'C', 'D', 'E', 'F']), 'A · B · C · D and 2 more');
    assert.equal(noLanes('diamond'), 'No diamonds yet');
    assert.equal(noLanes('court'), 'No courts yet');
    assert.equal(lanesHeading('diamond'), 'Diamonds');
  });
  it('the library line says a copy stays a copy (lib/venue-library-server)', () => {
    assert.match(W.fromLibrary, /keeps its own copy: a change here or in the library stays where it’s made/);
    assert.doesNotMatch(W.fromLibrary, /follow/i);
  });
  it('the in-use rule and the delete question', () => {
    assert.equal(W.inUse, 'It has played games, so you can rename it but not delete it.');
    assert.equal(deleteVenueQuestion('Lions Park', 0).body, 'Nothing is scheduled there.');
    assert.match(deleteVenueQuestion('Lions Park', 3).body, /^3 upcoming games are scheduled there\. .* TBD/);
  });
});

describe('the screen and its route (E5)', () => {
  const page = code('app/[orgSlug]/admin/tournaments/venues/page.tsx');
  const route = code('app/api/admin/venues/route.ts');
  const record = code('components/admin/tournament/VenueRecord.tsx');
  it('each row opens the venue\'s record; the fold-open bar, the facility windows and the old modal are gone', () => {
    assert.match(page, /<VenueRecord/);
    assert.match(page, /<AddVenuesWindow/);
    assert.doesNotMatch(page, /AddFacilityRow|FacilityModal|ImportFromLibraryModal|TournamentVenueCard|Import from Library/);
    assert.equal(existsSync(new URL('../../components/admin/AddVenueModal.tsx', import.meta.url)), false);
    assert.equal(existsSync(new URL('../../app/[orgSlug]/admin/org/venues/venues-admin.module.css', import.meta.url)), false);
  });
  it('the schedule\'s venue door is the same window', () => {
    assert.match(code('app/[orgSlug]/admin/tournaments/schedule/page.tsx'), /<AddVenuesWindow/);
  });
  it('?import=library opens Add a venue', () => {
    assert.match(page, /searchParams\.get\('import'\) === 'library'/);
  });
  it('the venue and its diamonds save in one call; a played diamond is never taken out; failures are said', () => {
    assert.match(route, /if \(Array\.isArray\(data\.facilities\)\)/);
    assert.match(route, /has played games, so it stays\./);
    assert.match(route, /created\[f\.key\] = row\.id/);
    assert.match(record, /action: 'update-venue'/);
    assert.match(record, /if \(!res\.ok\) throw new Error\(data\?\.error \?\? W\.saveFailed\)/);
  });
  it('a diamond with upcoming games asks before it goes; one with played games has no ✕', () => {
    assert.match(record, /gamesOf\(l\.id\) > 0\s*\? setTakingOut\(l\)/);
    assert.match(record, /n > 0\s*\? <span className=\{styles\.inUse\}>\{W\.played\(n\)\}<\/span>/);
  });
  it('the address is one line', () => {
    assert.match(record, /<TextField id="tvenue-address"/);
    assert.doesNotMatch(record, /postalCode|province/);
  });
});
