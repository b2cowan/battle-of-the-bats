/**
 * Opponent Picker (owner rulings D1–D7, 2026-09-21; plan COACH_OPPONENT_PICKER_PLAN.md).
 *
 * Pins the rules the Opponent field leans on:
 *   1. The list is the team's book, MOST RECENTLY MET FIRST; a query matches the book's names AND the
 *      spellings merged away, through the same normalizer the book groups by.
 *   2. The picked state is DERIVED — the text resolves in the book, directly or via a merge — so an
 *      old game's merged-away spelling resolves to the OWNING entry with the whole record.
 *   3. Picking writes the DISPLAY spelling and nothing else (source scan): the row chips key off each
 *      game's own spelling, so a normalized key written into a game would break the chip on its row.
 *   4. The club group (D5) offers only spellings the viewer's book doesn't already answer to.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  filterOpponentEntries, filterClubSpellings, resolveOpponentText, resolveClubSpelling,
  opponentMeetingLine, opponentPickedLine, clubPickedLine,
  OPPONENT_PICKER_OWN_LIMIT, OPPONENT_PICKER_CLUB_LIMIT,
  type OpponentPickerEntry, type ClubPickerSpelling,
} from '../../lib/coach-opponent-picker.ts';
import type { OpponentMeeting } from '../../lib/coach-opponents.ts';

const day = (iso: string) => iso.slice(5, 10); // "Jun 14" stands in as "06-14" — the formatter is the host's

function meeting(over: Partial<OpponentMeeting> & { startsAt: string }): OpponentMeeting {
  return {
    eventId: 'e', name: 'Game', eventType: 'league_game', isScrimmage: false, programYearId: null,
    homeAway: 'home', teamScore: null, opponentScore: null, result: null, counted: true, ...over,
  };
}

function entry(over: Partial<OpponentPickerEntry> & { key: string; displayName: string }): OpponentPickerEntry {
  const last = over.lastMeeting ?? null;
  return {
    aliasKeys: [], record: { wins: 0, losses: 0, ties: 0 }, lastMeeting: last,
    meetings: last ? [last] : [], observationCount: 0, summary: null, ...over,
  };
}

const THUNDER = entry({
  key: 'oakville thunder', displayName: 'Oakville Thunder', aliasKeys: ['thunder 12u'],
  record: { wins: 2, losses: 1, ties: 0 },
  lastMeeting: meeting({ startsAt: '2026-06-14T22:00:00Z', result: 'win', teamScore: 5, opponentScore: 3 }),
  observationCount: 2,
});
const TWINS = entry({
  key: 'thunder bay twins', displayName: 'Thunder Bay Twins',
  record: { wins: 0, losses: 1, ties: 0 },
  lastMeeting: meeting({ startsAt: '2026-05-02T22:00:00Z', result: 'loss', teamScore: 1, opponentScore: 4 }),
});
const OILERS = entry({
  key: 'leduc oilers', displayName: 'Leduc Oilers',
  record: { wins: 1, losses: 1, ties: 1 },
  lastMeeting: meeting({ startsAt: '2026-07-20T22:00:00Z', result: 'tie', teamScore: 4, opponentScore: 4 }),
});
/** A minted row with a note and no game yet — sorts last, still offered. */
const NOTED = entry({ key: 'st albert saints', displayName: 'St. Albert Saints', observationCount: 1 });
/** Aggregation-only with nothing at all — never offered (the book list hides it too). */
const GHOST = entry({ key: 'ghost', displayName: 'Ghost' });
const BOOK = [THUNDER, TWINS, OILERS, NOTED, GHOST];

describe('the list — the book, most recently met first', () => {
  it('an empty query lists everyone met or written about, newest meeting first, no-game rows last', () => {
    assert.deepEqual(filterOpponentEntries(BOOK, '').map(e => e.displayName),
      ['Leduc Oilers', 'Oakville Thunder', 'Thunder Bay Twins', 'St. Albert Saints']);
  });
  it('matches the display name, case-folded and punctuation-blind, as a substring', () => {
    assert.deepEqual(filterOpponentEntries(BOOK, 'thu').map(e => e.key), ['oakville thunder', 'thunder bay twins']);
    assert.deepEqual(filterOpponentEntries(BOOK, 'ST ALBERT').map(e => e.key), ['st albert saints']);
    assert.deepEqual(filterOpponentEntries(BOOK, 'st. albert').map(e => e.key), ['st albert saints']);
  });
  it('matches a merged-away spelling — "12U" still finds Oakville Thunder', () => {
    assert.deepEqual(filterOpponentEntries(BOOK, '12u').map(e => e.key), ['oakville thunder']);
  });
  it('honours the limit, and the Location field\'s eight is the default', () => {
    assert.equal(OPPONENT_PICKER_OWN_LIMIT, 8);
    assert.equal(filterOpponentEntries(BOOK, '', 2).length, 2);
  });
  it('never offers an entry with no meeting and no content', () => {
    assert.equal(filterOpponentEntries(BOOK, 'ghost').length, 0);
  });
});

describe('the picked state is derived from the text', () => {
  it('the book\'s own spelling resolves directly', () => {
    const r = resolveOpponentText(BOOK, 'Oakville Thunder');
    assert.equal(r?.entry.key, 'oakville thunder');
    assert.equal(r?.viaAlias, false);
  });
  it('a merged-away spelling resolves to the OWNING entry, flagged', () => {
    const r = resolveOpponentText(BOOK, 'Thunder 12U');
    assert.equal(r?.entry.key, 'oakville thunder');
    assert.equal(r?.viaAlias, true);
  });
  it('a name the book doesn\'t know resolves to nothing — it saves as typed (D3)', () => {
    assert.equal(resolveOpponentText(BOOK, 'Sherwood Park Royals'), null);
    assert.equal(resolveOpponentText(BOOK, ''), null);
    assert.equal(resolveOpponentText(BOOK, null), null);
  });
  it('typing over a picked name detaches it — a prefix is not a match', () => {
    assert.equal(resolveOpponentText(BOOK, 'Oakville Thunde'), null);
  });
});

describe('the words under the field and on each row', () => {
  it('a row reads the book\'s own words: last meeting and the result', () => {
    assert.equal(opponentMeetingLine(THUNDER.lastMeeting, day), 'Last met 06-14 · W 5–3');
    assert.equal(opponentMeetingLine(meeting({ startsAt: '2026-06-14T22:00:00Z' }), day), 'Last met 06-14');
    assert.equal(opponentMeetingLine(null, day), 'No games yet');
  });
  it('the picked line: record, then last meeting', () => {
    assert.equal(opponentPickedLine({ entry: THUNDER, viaAlias: false }, day), '2-1 vs them · last met 06-14');
  });
  it('a merged-away spelling names the owner and shows the WHOLE record, never the fragment', () => {
    assert.equal(opponentPickedLine({ entry: THUNDER, viaAlias: true }, day), 'Same team as Oakville Thunder · 2-1 vs them · last met 06-14');
  });
  it('a noted opponent with no game yet says so, with the note count', () => {
    assert.equal(opponentPickedLine({ entry: NOTED, viaAlias: false }, day), 'No games yet · 1 observation');
  });
});

describe('the club group (D5)', () => {
  const CLUB: ClubPickerSpelling[] = [
    { key: 'oakville thunder', displayName: 'Oakville Thunder', teamNames: ['Millwoods 12U'], observationCount: 4 },
    { key: 'airdrie angels', displayName: 'Airdrie Angels', teamNames: ['Millwoods 12U', '10U Blue'], observationCount: 1 },
  ];
  it('matches by name and key, by name order, capped short', () => {
    assert.equal(OPPONENT_PICKER_CLUB_LIMIT, 4);
    assert.deepEqual(filterClubSpellings(CLUB, '').map(s => s.key), ['airdrie angels', 'oakville thunder']);
    assert.deepEqual(filterClubSpellings(CLUB, 'thun').map(s => s.key), ['oakville thunder']);
    assert.deepEqual(filterClubSpellings(CLUB, 'Angels').map(s => s.key), ['airdrie angels']);
  });
  it('a picked club spelling names who in the club holds the notes', () => {
    assert.equal(resolveClubSpelling(CLUB, 'Airdrie Angels')?.key, 'airdrie angels');
    assert.equal(resolveClubSpelling(CLUB, 'nobody'), null);
    assert.equal(clubPickedLine(CLUB[1]), 'Your club has notes on them (Millwoods 12U, 10U Blue)');
  });
});

describe('source scans — the rules a build could drop by accident', () => {
  const combo = readFileSync('components/coaches/OpponentCombobox.tsx', 'utf8');
  const page = readFileSync('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx', 'utf8');
  const route = readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/opponents/route.ts', 'utf8');

  it('picking writes the DISPLAY spelling, never the normalized key (the row chips key off the game\'s own text)', () => {
    assert.match(combo, /onClick=\{\(\) => pick\(e\.displayName\)\}/);
    assert.match(combo, /onClick=\{\(\) => pick\(s\.displayName\)\}/);
    assert.doesNotMatch(combo, /pick\([a-z]\.key\)/);
  });
  it('no "Add" row and no "Manage" row — nothing is minted on the form (D3, D4)', () => {
    assert.doesNotMatch(combo, /tagComboCreate|tagComboManage|Manage opponents/);
  });
  it('the field owns Escape and Enter only while the list is VISIBLY open — an empty book must let Escape reach the panel (/review 2026-09-21)', () => {
    assert.match(combo, /e\.key === 'Escape' && showList\) \{\s*claimEscape\(e\);/);
    assert.match(combo, /e\.key === 'Enter'\) \{\s*if \(!showList\) return;/);
    assert.match(combo, /data-escape-owner=\{showList \? '' : undefined\}/);
    assert.doesNotMatch(combo, /e\.key === 'Escape' && open\)/);
  });
  it('the host re-read fires on the closed → open transition only, and the highlight follows its opponent, not its row number', () => {
    assert.match(combo, /if \(!open\) onOpen\?\.\(\);/);
    assert.match(combo, /useState<string \| null>\(null\)/, 'activeKey, not activeIdx');
    assert.doesNotMatch(combo, /setActiveIdx/);
  });
  it('the schedule form mounts the picker under the Opponent label, on the book it already fetches', () => {
    assert.match(page, /htmlFor="event-opponent">Opponent<\/label>[\s\S]{0,400}<OpponentCombobox/);
    assert.match(page, /entries=\{bookEntries\}/);
    assert.match(page, /clubSpellings=\{clubSpellings\}/);
    assert.match(page, /onOpen=\{loadBook\}/);
    assert.doesNotMatch(page, /<input id="event-opponent"/, 'the bare text box is gone');
  });
  it('the club spellings ride the club layer\'s gate — the same branch as the badge keys', () => {
    assert.match(route, /scoutingBookAccess && clubAccess\.canSeeClubLayer\n\s+\? resolveClubListExtras\(/);
    assert.match(route, /clubKeys, clubSpellings \}\)/);
  });
});
