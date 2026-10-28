import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES · STAGE 2, THE OVERVIEW (build prompt docs/projects/active/PUBLIC_TOURNAMENT_STAGE2_BUILD_PROMPT.md;
 * plan §5, Asks 3, 4, 17). Everything is built behind the preview switch: with it off, today's Overview, ticker, band and
 * explore row are exactly as they were. This guard holds that, and the rules the stage stands on.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const HOME = 'components/public/TournamentHomeContent.tsx';
const PARTS = ['PublicGameRow', 'PublicLiveCard', 'PublicSectionHead', 'PublicDoorRow', 'PublicPostList', 'FollowTournamentLine', 'TournamentOverview'];
/** The files that may draw the shared parts: each renders only with the switch on (Part 2: the frame-on body, and the
 *  old Overview's one frame branch that hands over to it — held below). */
const FRAME_ONLY_USERS = ['components/public/TournamentOverview.tsx', HOME];

describe('the shared parts render only inside the new frame', () => {
  it('no page or component outside the frame-on Overview imports them', () => {
    const users = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => !PARTS.some(p => f.endsWith(`/${p}.tsx`)))
      .filter(f => PARTS.some(p => new RegExp(`from ['"][^'"]*/${p}['"]`).test(readSource(f))));
    assert.deepEqual(users.filter(f => !FRAME_ONLY_USERS.includes(f)), [], 'a shared part reached a page outside the switch');
  });
  it('their styles read only the frame\'s own light token set (they have no meaning outside it)', () => {
    const css = readSource('components/public/PublicParts.module.css');
    const vars = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]);
    assert.ok(vars.length > 0);
    assert.deepEqual(vars.filter(v => !v.startsWith('--club-')), [], 'a shared part reads a token the frame does not set');
  });
  it('a score and a time are tabular figures; the heading door, the door row and the Directions target are 44 px or more', () => {
    const css = readSource('components/public/PublicParts.module.css');
    for (const sel of ['.when', '.scores', '.score', '.count']) {
      assert.match(css, new RegExp(`\\${sel} \\{[^}]*font-variant-numeric: tabular-nums`), sel);
    }
    assert.match(css, /\.headLink \{[^}]*min-height: 44px/);
    assert.match(css, /\.door \{[^}]*min-height: 56px/);
    assert.match(readCode('components/public/PublicLiveCard.tsx'), /<DirectionsLink /, 'the club pages\' one Directions control');
  });
});

describe('the moment helper is today\'s finished rule, exactly', () => {
  it('the old Overview keeps its own copy, unchanged, until Stage 8 deletes it — edit both or neither', () => {
    const home = readCode(HOME);
    assert.match(home, /const noUnplayedGames = !allGames\.some\(g => g\.status === 'scheduled'\);/);
    assert.match(home, /const eventEnded = !endDate \|\| now >= endDate;/);
    assert.match(home, /const roundRobinComplete = !hasPlayoffGames && allGamesTerminal && eventEnded;/);
    assert.match(home, /isCompletedTournament \|\|\s*\(!scheduleWithheld && \(\(playoffsComplete && noUnplayedGames\) \|\| roundRobinComplete\)\);/);
    const moment = readCode('lib/tournament-moment.ts');
    assert.match(moment, /tournament\.status === 'completed' \|\|\s*\(!scheduleWithheld && \(\(playoffsComplete && noUnplayedGames\) \|\| roundRobinComplete\)\);/);
    assert.match(moment, /const roundRobinComplete = !hasPlayoffGames && allGamesTerminal && eventEnded;/);
  });
});

describe('the band says Finished once the champion is crowned (owner, 2026-10-28)', () => {
  it('one rule for the band, the club home and the club\'s Tournaments tab: the word and the sorting move together', () => {
    const rule = readCode('lib/club-site-home.ts');
    assert.match(rule, /t\.status === 'completed' \|\| t\.status === 'archived' \|\| t\.championsCrownedAt \|\|/);
    assert.match(rule, /const isFinishedTournament = [^;]*!!t\.championsCrownedAt/);
  });
});

describe('the host card\'s Open now list (Ask 4 / Ask B)', () => {
  it('is the club home\'s own list, and its read asks the access question itself', () => {
    const data = readCode('lib/club-home-data.ts');
    assert.match(data, /const openNow = clubOpenNowRows\(publicLeagueSeasons, clubTryouts, today, href\);/);
    const body = data.slice(data.indexOf('export async function loadHostClubOpenNow'));
    assert.match(body, /if \(!isPublicClubSiteOpen\(org\) \|\| !hasModuleEntitlement\(org, 'module_public_site'\)\) return null;/);
    assert.match(body, /clubOpenNowRows\(leagueSeasons\.filter\(s => s\.status !== 'draft'\), tryouts, today, href\)/);
  });
});

describe('game day (Part 2): the new body is the frame\'s alone, and the old one is untouched', () => {
  it('the old Overview hands over only inside its frame branch, and only on game day', () => {
    const home = readCode(HOME);
    const branch = home.slice(home.indexOf('if (frameOn) {'), home.indexOf('// Honor the tournament'));
    assert.match(branch, /if \(moment\.moment === 'gameDay'\) \{/);
    assert.match(branch, /<TournamentOverview/);
    assert.equal(home.split('<TournamentOverview').length, 2, 'one hand-over, inside the branch');
  });
  it('Up next, Latest results and Live now come from the games families can see (a held-back division never, D1)', () => {
    const home = readCode(HOME);
    assert.match(home, /const \{ games: allGames, withheld: scheduleWithheld \} = await readPublicGames\(/);
    assert.match(home.slice(home.indexOf('<TournamentOverview')), /games=\{allGames\}/);
  });
  it('no follow-a-team, no alerts, no star in the band: the Overview carries the tournament\'s follow alone (owner, 2026-10-28)', () => {
    const body = readCode('components/public/TournamentOverview.tsx');
    for (const gone of ['MyTournamentCard', 'FollowTeamPicker', 'FollowAlertsToggle', 'FollowTournamentStrip', 'ScoreTicker', 'TodaysResultsLine']) {
      assert.doesNotMatch(body, new RegExp(gone), gone);
    }
    assert.doesNotMatch(readCode('components/public/TournamentBand.tsx'), /Follow/);
  });
  it('following lives inside the installed app only, and never on a club\'s own address', () => {
    const line = readCode('components/public/FollowTournamentLine.tsx');
    assert.match(line, /className=\{`\$\{styles\.appOnly\}/);
    assert.match(line, /export default hideOnClubOwnHost\(FollowTournamentLine\)/);
    const css = readSource('components/public/PublicParts.module.css');
    assert.match(css, /\.appOnly \{ display: none; \}\s*@media \(display-mode: standalone\) \{\s*\.appOnly \{ display: block; \}/);
    assert.match(css, /\.followStar \{[^}]*width: 44px;[^}]*height: 44px/);
  });
  it('today\'s follow strip and the new line are one behaviour', () => {
    for (const f of ['components/public/FollowTournamentStrip.tsx', 'components/public/FollowTournamentLine.tsx']) {
      assert.match(readCode(f), /useTournamentFollowToggle\(orgSlug, tournamentSlug, tournamentName\)/, f);
    }
  });
});

describe('the ticker leaves the Overview (Ask 17)', () => {
  it('the line asks its page list before it loads a game; the switch-off ticker is unchanged', () => {
    const line = readCode('components/public/TodaysResultsLine.tsx');
    assert.match(line, /return pageCarriesTicker\(pathname, [^)]*\) \? <ResultsLine \/> : null;/);
    const layout = readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx');
    assert.match(layout, /\{!frameOn && <ScoreTicker \/>\}/);
  });
});
