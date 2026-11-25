/**
 * Club Website Stage 1, Pass 2 guards (drawing tab 8, "Guard tests"):
 *   1. the 30-second check runs only inside a game window and pauses while the tab is hidden (G6);
 *   2. the home and the three house league pages are the ones that check, and each through the one hook;
 *   3. the home's games part opens no browser database connection or live channel, and fetches only the games-only check;
 *   4. its rows are the shipped stacked game row and its words are the pure module's (one spelling);
 *   5. the failed first read is drawn, never an empty part (G11), and a failed check says nothing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, valueReachableFrom } from './_source-code.ts';

const HOOK = 'lib/hooks/useClubGamesCheck.ts';
const PART = 'components/public/ClubGamesPart.tsx';
const REFRESHER = 'components/public/LeagueScoresRefresher.tsx';

describe('1 · the check runs only inside a game window and pauses while hidden', () => {
  const code = readCode(HOOK);
  it('no window, no check; each tick asks the window, and past the close only until an answer from after it is seen', () => {
    assert.match(code, /\{ enabled: !!checkWindow \}/);
    assert.match(code, /const open = isGameDayCheckOn\(\{ fromMs: Date\.parse\(checkWindow\.from\), toMs \}, now\) \|\| \(now >= toMs && seenAsOf\.current < toMs\);/);
    assert.match(code, /if \(!open\) return;/);
  });
  it('a check that never answers gives up, so it cannot hold the rest', () => {
    assert.match(code, /signal: AbortSignal\.timeout\(15_000\)/);
  });
  it('the game-day rhythm: every 30 seconds while visible, at once when the tab comes back, never while hidden', () => {
    assert.match(code, /useVisiblePoll\(/);
    const poll = readCode('lib/hooks/useVisiblePoll.ts');
    assert.match(poll, /GAME_DAY_POLL_MS = 30_000/);
    assert.match(poll, /document\.visibilityState === 'visible'/);
    assert.match(poll, /visibilitychange/);
  });
  it('a failed check is swallowed (it says nothing, G11)', () => {
    assert.match(code, /if \(!res\.ok\) return null;/);
    assert.match(code, /catch \{\s*return null;/);
  });
});

describe('2 · who checks', () => {
  it('the home\'s games part and the house league refresher, through the one hook', () => {
    assert.match(readCode(PART), /useClubGamesCheck\(/);
    assert.match(readCode(REFRESHER), /useClubGamesCheck\(/);
  });
  for (const page of [
    'app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx',
    'app/[orgSlug]/league/[seasonSlug]/standings/page.tsx',
    'app/[orgSlug]/league/[seasonSlug]/page.tsx',
  ]) {
    it(`${page} mounts the refresher`, () => {
      assert.match(readCode(page), /<LeagueScoresRefresher /);
    });
  }
  it('a page refreshes only when its season\'s games changed, never on every check', () => {
    const code = readCode(REFRESHER);
    assert.match(code, /if \(changed\) router\.refresh\(\);/);
    assert.doesNotMatch(code, /setInterval/);
  });
});

describe('3 · no realtime channel or browser database connection on the home', () => {
  const files = [...valueReachableFrom(PART, REFRESHER)];
  it('it loads no server module', () => {
    // The walk walks: the pure words and the hook are reached, so an absence below means something.
    assert.ok(files.includes('lib/club-games-home.ts') && files.includes('lib/hooks/useClubGamesCheck.ts'), files.join(', '));
    for (const f of ['lib/db.ts', 'lib/supabase-admin.ts', 'lib/supabase.ts', 'lib/supabase-browser.ts', 'lib/club-games-read.ts']) {
      assert.ok(!files.includes(f), `${f} reached from the home's browser part`);
    }
  });
  it('nothing the part or the refresher loads opens one', () => {
    for (const f of files) {
      const code = readCode(f);
      assert.doesNotMatch(code, /createBrowserClient|\.channel\(|supabase-browser|realtime/i, f);
    }
  });
  it('the only fetch is the games-only check', () => {
    const hook = readCode(HOOK);
    assert.match(hook, /\/api\/public\/club-games\//);
    assert.doesNotMatch(readCode(PART), /fetch\(/);
  });
});

describe('4 · the shipped row and one set of words', () => {
  const code = readCode(PART);
  it('every game row is the stacked ScheduleMatchup (R6, G8 · A)', () => {
    assert.match(code, /<ScheduleMatchup form="stacked"/);
  });
  it('the words come from the pure module, not the component', () => {
    assert.match(code, /GAMES_HOME_WORDS as W/);
    assert.doesNotMatch(code, />\s*(Live now|Later today|Latest results|Score after the game|No score yet|Try again)\s*</);
  });
  it('a rep game never ended reads as its score alone: no Final pill, no winner bold (G7, Part 0)', () => {
    assert.match(code, /if \(final && row\.decided\) \{/);
    assert.match(code, /\(final && !row\.decided\)\s*\? undefined : row\.state/);
    assert.match(readCode('lib/club-games-read.ts'), /decided: entry\.result !== null,/);
  });
  it('"Show fewer" is spelled once, by the one row both lists use', () => {
    for (const f of [PART, 'components/public/ClubOpenNowList.tsx']) {
      assert.match(readCode(f), /<ClubMoreRow /, f);
      assert.doesNotMatch(readCode(f), /Show fewer/, f);
    }
  });
  it('the live edge is the schedule\'s own status green, never the club colour (R9)', () => {
    assert.match(code, /band === 'live' \? ` \$\{scheduleStyles\.edge\}`/);
    assert.match(readCode('components/public/PublicSchedule.module.css'), /\.edge \{ box-shadow: inset 3px 0 0 var\(--club-ok\); \}/);
    assert.doesNotMatch(readCode('components/public/ClubGamesPart.module.css'), /--club-edge|--club-fill/);
  });
});

describe('5 · a failed first read is drawn (G11)', () => {
  it('the loader turns a failure into the part\'s line, never an absent part', () => {
    const loader = readCode('lib/club-home-data.ts');
    assert.match(loader, /readClubGames\(org\)\.catch\(/);
    assert.match(loader, /games === null \|\| homeGamesView\(/);
  });
  it('the part draws the line and Try again when it has no read', () => {
    const code = readCode(PART);
    assert.match(code, /if \(!read\) \{/);
    assert.match(code, /W\.tryAgain/);
  });
});
