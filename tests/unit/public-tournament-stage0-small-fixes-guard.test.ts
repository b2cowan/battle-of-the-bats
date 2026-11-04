import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, sourceExists } from './_source-code.ts';
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

// Stage 8 Part 3d deleted the old Overview body (and the MyTournamentCard and nav status pill only the old chrome drew);
// the new Overview body draws its live cards through public-game-row's view, like the Schedule.
const HOME = 'components/public/TournamentOverview.tsx';
// Stage 8 Part 3b deleted the old game page body and the old Schedule (with the MyTeamCard only it drew); their
// successors ask the rule in their view models — a game's page through public-game-detail, the Schedule's rows through
// public-game-row — and the game body is where the countdown now lives.
const GAME = 'components/public/PublicGameDetails.tsx';
const GAME_VIEW = 'lib/public-game-detail.ts';
const SCHEDULE_ROWS = 'lib/public-game-row.ts';
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
    // The /review of this change found three more live-score surfaces beyond the four the defect named; all ask.
    for (const file of [
      GAME_VIEW, SCHEDULE_ROWS,
      'components/public/MyTeamDock.tsx',
      'components/public/DesktopMyTeamRailCard.tsx',
    ]) {
      const code = readCode(file);
      assert.match(code, /hasNoScoreYet\(/, `${file} asks whether the game has a score`);
      assert.match(code, /\bNO_SCORE_YET\b/, `${file} says so in the one spelling`);
    }
    // The Overview's live cards are the shared row view's, not a hand-rolled score.
    assert.match(readCode(HOME), /liveCardView\(g, /);
    assert.ok(!sourceExists('components/public/MyTournamentCard.tsx'), 'the old Overview\'s My Team card is gone');
  });
  it('the follower dock has no share at all, so it can never share a live game nobody has scored (owner 2026-11-01)', () => {
    assert.doesNotMatch(readCode('components/public/MyTeamDock.tsx'), /ShareScoreButton|shareGame/);
  });
  it('the home never prints the raw scores either side of a dash', () => {
    // Stronger than the old pattern: the Overview body reads no raw score at all — the row and live views word it.
    assert.doesNotMatch(readCode(HOME), /awayScore|homeScore/);
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
      HOME, GAME, GAME_VIEW, SCHEDULE_ROWS, 'components/public/PublicSchedule.tsx',
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
  it('the theme rides in the body only once it was changed (one body since Stage 8 Part 4b: look-draft.ts frameBodyOf)', () => {
    const draft = readCode('app/[orgSlug]/admin/tournaments/branding/look-draft.ts');
    assert.match(draft, /const theme = themeChanged \? \{ themePreset, themePrimary, themeAccent \} : \{\};/);
    assert.match(code, /frameBodyOf\(held\.draft, held\.advanced, held\.themeChanged, held\.typeChanged\)/);
    assert.doesNotMatch(code, /\bbodyOf\b/);
  });
  it('a fresh read starts unchanged; touching a theme field marks it, and the mark stays', () => {
    assert.match(code, /draft: d, themeChanged: false, typeChanged: false \}/);
    assert.match(code, /themeChanged: held\.themeChanged \|\| THEME_FIELDS\.some\(k => k in patch\)/);
    // Stage 1a Part 3 added `own` (the Look card's "The club's look" vs a colour of its own), a theme field like the rest.
    assert.match(code, /THEME_FIELDS = \['presetKey', 'customPrimary', 'customAccent', 'own'\]/);
  });
});
