import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { hasNoScoreYet, NO_SCORE_YET } from '../../lib/game-status.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES — STAGE 0, PART 2: "THE SMALL WRONG THINGS ARE RIGHT" (2026-10-27).
 * Plan: docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §2 (D2–D4) and §4a (D7).
 *
 *   D2  a live game nobody has scored says "No score yet" — never a lone "–", never an invented 0–0;
 *   D3  the club fallback list says each tournament's status true to its dates, never "Live" on every card;
 *   D4  the countdown is sport-neutral: "Starts in …", never "First pitch in …";
 *   D7  the Branding page writes the theme only once the organizer changed it, so a page switch no longer
 *       locks the club's colours off the tournament.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const HOME = 'components/public/TournamentHomeContent.tsx';
const GAME = 'app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx';
const SCHEDULE = 'components/public/ScheduleContent.tsx';
const MY_TEAM = 'components/public/MyTournamentCard.tsx';
const FALLBACK = 'app/[orgSlug]/page.tsx';
const BRANDING = 'app/[orgSlug]/admin/tournaments/branding/page.tsx';

describe('D2 · a live game nobody has scored', () => {
  it('is "No score yet" only while neither side has a score', () => {
    assert.equal(NO_SCORE_YET, 'No score yet');
    assert.equal(hasNoScoreYet({ homeScore: null, awayScore: null }), true);
    assert.equal(hasNoScoreYet({}), true);
    assert.equal(hasNoScoreYet({ homeScore: 0, awayScore: 0 }), false, 'an entered 0–0 is a score');
    assert.equal(hasNoScoreYet({ homeScore: 2, awayScore: null }), false);
  });
  it('every public surface that shows a live score asks the one rule', () => {
    // The /review of this change found three more live-score surfaces beyond the four the defect named; all seven ask.
    for (const file of [
      HOME, GAME, SCHEDULE, MY_TEAM,
      'components/public/MyTeamDock.tsx',
      'components/public/DesktopMyTeamRailCard.tsx',
      'components/public/MyTeamCard.tsx',
    ]) {
      const code = readCode(file);
      assert.match(code, /hasNoScoreYet\(/, `${file} asks whether the game has a score`);
      assert.match(code, /\bNO_SCORE_YET\b/, `${file} says so in the one spelling`);
    }
  });
  it('the follower dock never shares a live game nobody has scored', () => {
    assert.match(readCode('components/public/MyTeamDock.tsx'), /const shareGame = liveGame && !noScoreYet \? liveGame : latestResult;/);
  });
  it('the home never prints the raw scores either side of a dash', () => {
    assert.doesNotMatch(readCode(HOME), /\{game\.awayScore\}–\{game\.homeScore\}/);
  });
});

describe('D3 · the club fallback list', () => {
  it('reads each card\'s status from the club home\'s own rule, in its words', () => {
    const code = readCode(FALLBACK);
    assert.match(code, /clubTournamentRows\(activeTournaments, tournamentToday\(\), href\)/);
    assert.match(code, /TOURNAMENT_STATUS_WORD\[status\]/);
    assert.doesNotMatch(code, /<Star[^>]*\/>\s*Live\b/, 'no "Live" on every card');
  });
});

describe('D4 · the countdown is sport-neutral', () => {
  it('no public tournament surface (or the wizard\'s preview of one) says "First pitch"', () => {
    for (const file of [
      HOME, GAME,
      'components/public/TournamentNavStatus.tsx',
      'components/admin/TournamentCreationPreview.tsx',
      'lib/entity-follow-status.ts',
      'lib/sandbox-chrome.ts',
    ]) {
      assert.doesNotMatch(readCode(file), /First pitch/i, file);
    }
  });
});

describe('D7 · the Branding page keeps the club\'s colours', () => {
  const code = readCode(BRANDING);
  it('the theme rides in the body only once it was changed', () => {
    assert.match(code, /function bodyOf\(d: Draft, advanced: boolean, themeChanged: boolean\)/);
    assert.match(code, /const theme = !themeChanged \? \{\}/);
    assert.match(code, /bodyOf\(held\.draft, held\.advanced, held\.themeChanged\)/);
  });
  it('a fresh read starts unchanged; touching a theme field marks it, and the mark stays', () => {
    assert.match(code, /draft: d, themeChanged: false \}/);
    assert.match(code, /themeChanged: held\.themeChanged \|\| THEME_FIELDS\.some\(k => k in patch\)/);
    assert.match(code, /THEME_FIELDS = \['presetKey', 'customPrimary', 'customAccent'\]/);
  });
});
