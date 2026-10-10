import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * Tournament admin redesign Stage 3, Part 7 (S6, S7, S8; ruled 2026-10-09). The readings are proven in
 * bracket-reading-and-coin-toss.test.ts; this pins the WIRING — the places a later edit could put the old screen back.
 */

const COLUMNS = 'app/[orgSlug]/admin/tournaments/schedule/components/BracketColumns.tsx';
const VIEW = 'app/[orgSlug]/admin/tournaments/schedule/components/PlayoffBracketView.tsx';
const PUBLISH = 'app/[orgSlug]/admin/tournaments/schedule/components/PublishScheduleModal.tsx';
const PAGE = 'app/[orgSlug]/admin/tournaments/schedule/page.tsx';
const RESULTS = 'app/[orgSlug]/admin/tournaments/results/page.tsx';
const DASHBOARD = 'app/[orgSlug]/admin/tournaments/dashboard/page.tsx';
const DASHBOARD_ROUTE = 'app/api/admin/tournament-dashboard/route.ts';
const STANDINGS = 'components/public/StandingsContent.tsx';
const PREVIEW = 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx';

describe('S6 — the bracket reads who played, the score, who won and the champion', () => {
  it('a card reads the bracket\'s sides and opens the game; the pencil and the trash can are gone', () => {
    const cols = readCode(COLUMNS);
    assert.match(cols, /bracketSides\(full, teams\)/);
    assert.match(cols, /onClick=\{\(\) => onOpen\(full\)\}/);
    assert.doesNotMatch(cols, /Pencil|Trash2|onDelete|VIS|HOM/);
  });
  it('the champion card and the phone\'s bands read the one reading, never a second model', () => {
    const view = readCode(VIEW);
    assert.match(view, /bracketChampion\(division, divisionGames, groupGames, teams, top\)/);
    assert.match(view, /<ScheduleGameRow/);
  });
  it('the Bracket view gets every bracket game, whatever the Filter', () => {
    const page = readCode(PAGE);
    assert.match(page, /const bracketGames = bracketDivision \? scheduled\.filter\(g => g\.isPlayoff && g\.divisionId === bracketDivision\.id\) : \[\];/);
    assert.match(page, /<PlayoffBracketView\s+games=\{bracketGames\}/);
  });
});

describe('S7 — the coin toss is said and recorded where the seeds wait', () => {
  it('the recorder leaves the standings preview', () => {
    assert.doesNotMatch(readCode(STANDINGS), /CoinTossRecorder|enableCoinTossAdmin/);
    assert.doesNotMatch(readCode(PREVIEW), /enableCoinTossAdmin/);
  });
  it('the bracket, Results and the dashboard read the same pending tosses and open the same recorder', () => {
    for (const file of [PAGE, RESULTS]) {
      const code = readCode(file);
      assert.match(code, /pendingCoinTosses\(\{ divisions, teams, games(: scheduled)?, settings: currentTournament\?\.settings \}\)/, file);
      assert.match(code, /<CoinTossRecorder/, file);
    }
    const route = readCode(DASHBOARD_ROUTE);
    assert.match(route, /pendingCoinTosses\(\{/);
    assert.doesNotMatch(route, /computeTournamentStandings/);
    const dash = readCode(DASHBOARD);
    assert.match(dash, /<CoinTossRecorder/);
    assert.doesNotMatch(dash, /preview\/\$\{currentTournament\.slug\}\/standings/);
  });
  it('the waiting count is the rail\'s amber count — on the view pill, and on Results\' division list (never a browser list)', () => {
    assert.match(readCode(PAGE), /waiting: \{ count: tosses\.length, words: CT\.pending\(tosses\.length\) \}/);
    const results = readCode(RESULTS);
    assert.match(results, /<DivisionPicker/);
    assert.doesNotMatch(results, /<select className=\{styles\.select\} value=\{filterGroup\}/);
  });
});

describe('S8 — one Publish window that says what publishing does', () => {
  const publish = readCode(PUBLISH);
  it('registration closing is said in the row, not asked on a second screen; the route closes it with the publish', () => {
    assert.match(publish, /PW\.registrationOpen/);
    assert.doesNotMatch(publish, /Close registration and publish\?|showRegCloseWarning|'set-closed'/);
  });
  it('a refused publish says the server\'s reason', () => {
    assert.match(publish, /if \(!res\.ok\) throw new Error\(await readRefusal\(res, PW\.failed\)\);/);
  });
  it('the Tournament plan\'s email is one plain lock line', () => {
    assert.match(publish, /<PlanLockLine href=\{tournamentPlusPanelHref\(orgSlug\)\} plan=\{W\.lockedPlan\}>\{PW\.emailLocked\}<\/PlanLockLine>/);
  });
  it('the day says who can\'t see its games yet, with Publish…', () => {
    const page = readCode(PAGE);
    assert.match(page, /<b>\{PW\.noteTitle\}<\/b>/);
    assert.match(page, /onClick=\{\(\) => setPublishOpen\(true\)\}>\{PW\.noteAction\}/);
  });
});
