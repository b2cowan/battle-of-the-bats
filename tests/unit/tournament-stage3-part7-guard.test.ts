import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * Tournament admin redesign Stage 3, Part 7 (S6, S7, S8; ruled 2026-10-09). The readings are proven in
 * bracket-reading-and-coin-toss.test.ts; this pins the WIRING — the places a later edit could put the old screen back.
 */

const COLUMNS = 'app/[orgSlug]/admin/tournaments/schedule/components/BracketColumns.tsx';
const VIEW = 'app/[orgSlug]/admin/tournaments/schedule/components/PlayoffBracketView.tsx';
const GENERATOR = 'app/[orgSlug]/admin/tournaments/schedule/PlayoffGenerator.tsx';
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
  it('the Bracket view\'s Filter never names a division or stage, and a listed bracket says why (owner 2026-10-19)', () => {
    const page = readCode(PAGE);
    // The arrows are the division and every game is a playoff: those picks rest here, never empty the bracket.
    assert.match(page, /const bracketFilter: ScheduleFilter = \{ \.\.\.filter, divisions: \[\], stages: \[\] \};/);
    assert.match(page, /options: divisions\.length > 1 && !inBracket \?/);
    assert.match(page, /options: hasRoundRobinStage && hasPlayoffStage && !inBracket/);
    assert.match(page, /focus=\{bracketFocus\}\s+onClearFocus=\{clearScheduleFilters\}/);
    const view = readCode(VIEW);
    // Said on the head line after the format — one line, Edit bracket at its end, never a second row with a button.
    assert.match(view, /\{caption\}\s*\{focus !== null && matched > 0 && <span role="status">\{caption \? ' · ' : ''\}\{B\.focusNote\(matched\)\}<\/span>\}/);
    assert.doesNotMatch(view, /bv\.focusNote/);
    assert.match(view, /focus !== null && matched === 0 \? \(\s*<ClubRowList>\s*<ClubRow title=\{W\.noGamesMatch\} actions=\{clearButton\} \/>/);
  });
  it('Show as diagram is offered only when a game feeds another — a lone final is its list (owner 2026-10-12)', () => {
    const view = readCode(VIEW);
    assert.match(view, /const hasDiagram = bracketHasFeeds\(games\);/);
    assert.match(view, /isPhone && !\(diagramOnPhone && hasDiagram\)/);
    assert.match(view, /isPhone && focus === null && hasDiagram && \(/);
    const gen = readCode(GENERATOR);
    assert.match(gen, /const hasDiagram = bracketHasFeeds\(/);
    assert.match(gen, /\{hasDiagram && \(\s*<div className=\{pg\.viewLine\}>/);
    assert.match(gen, /\{diagram && hasDiagram \? \(/);
    // Both toggles' words flip with the view, so neither carries a pressed state ("Show as list, pressed" misreads).
    assert.doesNotMatch(view, /aria-pressed=\{diagramOnPhone\}/);
    assert.doesNotMatch(gen, /aria-pressed=\{diagram\}/);
  });
  it('the head is one line: the format and its one action — no "U11 playoffs" title over the arrows\' division (owner 2026-10-12)', () => {
    const view = readCode(VIEW);
    assert.doesNotMatch(view, /bracketTitle|bv\.title\b/);
    assert.match(view, /const headAction = isPhone \? diagramSwitch : editButton;/);
    assert.match(view, /<span className=\{bv\.caption\}>\s*\{caption\}[\s\S]*?<\/span>\s*\{headAction && <div className=\{bv\.headAction\}>/);
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
  it('the three say it in ONE note (/simplify 2026-10-09: never three hand-synced copies)', () => {
    for (const file of [VIEW, RESULTS, DASHBOARD]) assert.match(readCode(file), /<CoinTossNote /, file);
    for (const file of [VIEW, RESULTS, DASHBOARD]) assert.doesNotMatch(readCode(file), /CT\.title\(/, file);
  });
  it('the waiting count is the rail\'s amber count on the view pill; Results says it in the note alone', () => {
    assert.match(readCode(PAGE), /waiting: \{ count: tosses\.length, words: CT\.pending\(tosses\.length\) \}/);
    // Results took the schedule's one toolbar line (owner 2026-10-17): Division and Stage are the Filter's ticks, so
    // the division picker — and its amber count — left; the toss note at the top of Needs you is the signal.
    const results = readCode(RESULTS);
    assert.match(results, /<ScheduleToolbar/);
    assert.match(results, /<FilterMenu/);
    assert.doesNotMatch(results, /<DivisionPicker|<select /);
  });
  it('one side for search (owner 2026-10-17): Teams and Check-in put Search and Filter on the right, the shared field', () => {
    // Teams: the spacer follows the division picker, so Search and Filter sit beside Tools.
    const teams = readCode('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
    assert.match(teams, /<DivisionPicker [^>]*\/>\s*(?:\{[^}]*\}\s*)?<span className=\{tb\.toolbarSpacer\} aria-hidden \/>\s*\{showViewTools && \(\s*<div className=\{(?:tb\.deskFilters|`\$\{tb\.deskFilters\}[^`]*`)\}>/);
    // Check-in (organizer and gate): the shared line, field and Filter — no board-owned dropdown or search box.
    const board = readCode('components/admin/CheckInBoard.tsx');
    assert.match(board, /className=\{`\$\{tb\.toolbar\} \$\{styles\.toolbar\}`\}/);
    assert.match(board, /<div className=\{tb\.deskFilters\}>\{searchField\.field\}<\/div>/);
    assert.match(board, /<FilterMenu/);
    assert.doesNotMatch(board, /<select |styles\.searchWrap|styles\.searchToggle/);
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
  it('the route refuses a completed tournament, and an email failure never reports a landed publish as failed (/review)', () => {
    const route = readCode('app/api/admin/schedule-publish/route.ts');
    assert.match(route, /if \(lockRow\?\.status === 'completed'\) return Response\.json\(\{ error: LOCKED_RESULTS \}, \{ status: 409 \}\);/);
    assert.match(route, /return Response\.json\(\{ success: true, notified: 0, notifyFailed: true \}\);/);
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
