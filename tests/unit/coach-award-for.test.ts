/**
 * Which game an award is for (owner rulings 2026-10-02; docs/projects/active/COACH_AWARD_OCCASION_PLAN.md).
 *
 * Production, 2026-10-01: Alex Tennant showed two MVPs for one game. The Awards page's Give window
 * could only take typed words, so the coach gave "Majors game MVP" (tied to no game, dated the next
 * day), entered the score, then gave it again from the game. These pin the four rulings:
 *   1. a "For" dropdown of the season's events that have happened, then Something else / The season;
 *   2. it opens on the newest event that can carry an award;
 *   3. a game still waiting for its score is listed, greyed, saying why;
 *   4. a quiet near-duplicate line (same player, same award, within two days) that never blocks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  AWARD_FOR_WORDS,
  awardForOptions,
  awardForSubline,
  nearDuplicateAward,
  nearDuplicateSentence,
  NEAR_DUPLICATE_DAYS,
  type AwardForEvent,
} from '../../lib/rep-award-occasion.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

// "Now" = Thu Oct 1, 2026, 7:26 a.m. Eastern — the moment the first MVP was given.
const NOW = Date.parse('2026-10-01T11:26:00Z');

const ev = (over: Partial<AwardForEvent> & { id: string; startsAt: string }): AwardForEvent => ({
  eventType: 'league_game', name: 'Game', opponent: null, status: 'scheduled', teamScore: null, opponentScore: null, ...over,
});

const SEASON: AwardForEvent[] = [
  // 8:30 p.m. Eastern on Sep 30 is Oct 1 in UTC — the day must be the org's, never the UTC slice.
  ev({ id: 'majors', startsAt: '2026-10-01T00:30:00Z', opponent: 'Mississauga Majors', teamScore: 14, opponentScore: 3 }),
  ev({ id: 'practice', eventType: 'practice', name: 'Practice', startsAt: '2026-09-28T22:00:00Z' }),
  ev({ id: 'oakville', startsAt: '2026-09-27T17:00:00Z', opponent: 'Oakville A’s' }),
  ev({ id: 'bandits', startsAt: '2026-09-26T17:00:00Z', opponent: 'Burlington Bandits', teamScore: 4, opponentScore: 9 }),
  ev({ id: 'rained', startsAt: '2026-09-25T17:00:00Z', opponent: 'Hamilton', status: 'cancelled' }),
  ev({ id: 'tomorrow', startsAt: '2026-10-02T22:00:00Z', opponent: 'Brampton' }),
  ev({ id: 'tonight-practice', eventType: 'practice', name: 'Batting cages', startsAt: '2026-10-01T22:00:00Z' }),
];

describe('awardForOptions — the "For" dropdown’s events (rulings 1–3)', () => {
  const options = awardForOptions(SEASON, NOW);

  it('lists what has happened, newest first; never what is still to come or was cancelled', () => {
    assert.deepEqual(options.map(o => o.eventId), ['majors', 'practice', 'oakville', 'bandits']);
  });

  it('dates each event by the org’s day, not the UTC day (an 8:30 p.m. game is still Sep 30)', () => {
    assert.equal(options[0].day, '2026-09-30');
  });

  it('labels a game by its opponent and any other event by its own name', () => {
    assert.equal(options[0].label, 'vs Mississauga Majors');
    assert.equal(options[1].label, 'Practice');
  });

  it('keeps a game with no score on the list, as needs-score, where it falls (ruling 3)', () => {
    const oakville = options.find(o => o.eventId === 'oakville');
    assert.equal(oakville?.state, 'needs-score');
    assert.equal(options.filter(o => o.state === 'open').length, 3);
  });

  it('two events on one day list by start time — a doubleheader opens on the LATER game', () => {
    const day = awardForOptions([
      // Listed out of order, and ids chosen so an id tie-break would put the early game first.
      ev({ id: 'zz-early', startsAt: '2026-09-26T14:00:00Z', opponent: 'Early', teamScore: 1, opponentScore: 0 }),
      ev({ id: 'aa-late', startsAt: '2026-09-26T18:00:00Z', opponent: 'Late', teamScore: 2, opponentScore: 0 }),
    ], NOW);
    assert.deepEqual(day.map(o => o.eventId), ['aa-late', 'zz-early']);
  });

  it('the newest choosable event is the one the window opens on (ruling 2)', () => {
    const src = read('components/coaches/GiveAwardModal.tsx');
    assert.match(src, /forOptions\.find\(o => o\.state === 'open'\)\?\.eventId \?\? FOR_SEASON/);
  });
});

describe('awardForSubline — each answer’s second line', () => {
  const [majors, practice, oakville, bandits] = awardForOptions(SEASON, NOW);
  it('a scored game reads its day and result', () => {
    assert.equal(awardForSubline(majors), 'Wed Sep 30 · W 14–3');
    assert.equal(awardForSubline(bandits), 'Sat Sep 26 · L 4–9');
  });
  it('a game without its score says what it needs', () => {
    assert.equal(awardForSubline(oakville), `Sun Sep 27 · ${AWARD_FOR_WORDS.needsScore}`);
  });
  it('any other event reads its day alone', () => {
    assert.equal(awardForSubline(practice), 'Mon Sep 28');
  });
  it('a tie reads T', () => {
    assert.equal(awardForSubline({ ...majors, teamScore: 5, opponentScore: 5 }), 'Wed Sep 30 · T 5–5');
  });
});

describe('nearDuplicateAward — the double-check (ruling 4)', () => {
  const award = (over: { id: string; awardedAt: string; createdAt?: string; playerId?: string; awardTypeId?: string }) => ({
    playerId: 'alex', awardTypeId: 'mvp', createdAt: '2026-10-01T11:26:00Z', ...over,
  });
  // The production pair: "Majors game MVP" typed, dated Oct 1 — and the game itself, Sep 30.
  const typed = award({ id: 'typed', awardedAt: '2026-10-01' });

  it('is two days either side', () => assert.equal(NEAR_DUPLICATE_DAYS, 2));

  it('finds the typed award one day from the game (Alex’s pair)', () => {
    assert.equal(nearDuplicateAward([typed], { playerId: 'alex', awardTypeId: 'mvp', day: '2026-09-30' })?.id, 'typed');
  });
  it('two days away still counts; three days does not', () => {
    assert.equal(nearDuplicateAward([typed], { playerId: 'alex', awardTypeId: 'mvp', day: '2026-09-29' })?.id, 'typed');
    assert.equal(nearDuplicateAward([typed], { playerId: 'alex', awardTypeId: 'mvp', day: '2026-09-28' }), null);
  });
  it('a different player, or a different award, is not a near-duplicate', () => {
    assert.equal(nearDuplicateAward([typed], { playerId: 'sam', awardTypeId: 'mvp', day: '2026-10-01' }), null);
    assert.equal(nearDuplicateAward([typed], { playerId: 'alex', awardTypeId: 'hustle', day: '2026-10-01' }), null);
  });
  it('a day still being typed (the Date box cleared) matches nothing — never a flicker of false warnings', () => {
    assert.equal(nearDuplicateAward([typed], { playerId: 'alex', awardTypeId: 'mvp', day: '' }), null);
  });
  it('never warns about the award being edited against itself', () => {
    assert.equal(nearDuplicateAward([typed], { playerId: 'alex', awardTypeId: 'mvp', day: '2026-10-01', excludeId: 'typed' }), null);
  });
  it('names the nearest; on a tie, the one given most recently', () => {
    const far = award({ id: 'far', awardedAt: '2026-09-28' });
    const older = award({ id: 'older', awardedAt: '2026-09-30', createdAt: '2026-09-30T23:00:00Z' });
    const newer = award({ id: 'newer', awardedAt: '2026-09-30', createdAt: '2026-10-01T11:29:00Z' });
    assert.equal(nearDuplicateAward([far, older, newer], { playerId: 'alex', awardTypeId: 'mvp', day: '2026-09-30' })?.id, 'newer');
  });
});

describe('nearDuplicateSentence — what the line says', () => {
  const mvp = { name: 'MVP', emoji: '🏆' };
  it('a typed occasion is quoted — the coach’s own words', () => {
    const w = nearDuplicateSentence('Alex Tennant', { eventId: null, tournamentLabel: 'Majors game MVP', awardedAt: '2026-10-01', awardType: mvp });
    assert.equal(w.line, 'Alex Tennant already has 🏆 MVP for “Majors game MVP”, Oct 1.');
    assert.equal(w.hint, 'If it’s the same award, close this without saving.');
    // Never two actions: "close this and remove that one" left the player with neither (§257 W1).
    assert.doesNotMatch(w.hint, /remove/);
  });
  it('an event reads by its label; a season award as the season', () => {
    assert.equal(
      nearDuplicateSentence('Alex Tennant', { eventId: 'majors', tournamentLabel: null, awardedAt: '2026-09-30', occasionLabel: 'vs Mississauga Majors', awardType: mvp }).line,
      'Alex Tennant already has 🏆 MVP for vs Mississauga Majors, Sep 30.',
    );
    assert.match(nearDuplicateSentence('Alex Tennant', { eventId: null, tournamentLabel: null, awardedAt: '2026-09-30', awardType: mvp }).line, /for the season, Sep 30\.$/);
  });
});

describe('the doors — source guards', () => {
  const modal = read('components/coaches/GiveAwardModal.tsx');
  const awardsPage = read('app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx');
  const sheet = read('components/coaches/ScheduleEventSheet.tsx');
  const route = read('app/api/coaches/[orgSlug]/teams/[teamId]/awards/route.ts');

  it('the For field is the shared sub-lined dropdown, never a native select or a second picker', () => {
    assert.match(modal, /<SublinedChoice[\s\S]{0,200}label="For"/);
    assert.equal(fs.existsSync(path.join(REPO, 'components/coaches/AwardForPicker.tsx')), false);
  });
  it('a game still waiting for its score is listed but not choosable', () => {
    assert.match(modal, /disabled: o\.state !== 'open'/);
    assert.match(read('components/coaches/SublinedChoice.tsx'), /if \(o\.disabled\) return;/);
  });
  it('an event answer posts the event; Something else posts its words and its date; the season posts neither', () => {
    assert.match(modal, /forEvent\s*\n?\s*\?\s*\{ eventId: forEvent\.eventId \}/);
    assert.match(modal, /\{ tournamentLabel: tournamentLabel\.trim\(\) \|\| undefined, awardedAt: occasionDay \}/);
  });
  it('the double-check is a status line, and Save is never disabled by it', () => {
    assert.match(modal, /className=\{styles\.awardNear\} role="status"/);
    assert.doesNotMatch(modal, /disabled=\{[^}]*near/);
  });
  it('the Awards page reads the schedule only up to now, and hands both lists to the window', () => {
    assert.match(awardsPage, /events\?to=\$\{encodeURIComponent\(new Date\(\)\.toISOString\(\)\)\}/);
    assert.match(awardsPage, /forEvents=\{forEvents\}/);
    assert.match(awardsPage, /existingAwards=\{awards\}/);
  });
  it('the Awards page reads the schedule FRESH on every open, and an older read never lands over a newer one', () => {
    // A list kept for the visit still showed a just-scored game as "enter its score first" (/review 2026-10-02).
    assert.doesNotMatch(awardsPage, /forRead/);
    assert.match(awardsPage, /const run = \+\+forRun\.current;/);
    assert.match(awardsPage, /if \(forRun\.current === run\) setForEvents\(list\)/);
  });
  it('the game window gives the double-check its awards and the game’s own day', () => {
    assert.match(sheet, /existingAwards=\{teamAwards\}/);
    assert.match(sheet, /day: orgDayKey\(ev\.startsAt\)/);
  });
  it('the server refuses an award dated in the future', () => {
    assert.match(route, /if \(awardedAt > today\) return NextResponse\.json\(\{ error: AWARD_FOR_WORDS\.futureDate \}, \{ status: 400 \}\)/);
  });
});
