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
const PARTS = ['PublicGameRow', 'PublicLiveCard', 'PublicSectionHead', 'PublicDoorRow', 'PublicPostList', 'FollowTournamentLine', 'TournamentOverview',
  'PublicRegisterCard', 'PublicFactsList', 'PublicHostCard', 'PublicChampions'];
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
  it('the old Overview hands over only inside its frame branch, for every moment (Part 3: before and after too)', () => {
    const home = readCode(HOME);
    const branch = home.slice(home.indexOf('if (frameOn) {'), home.indexOf('// Honor the tournament'));
    assert.match(branch, /<TournamentOverview/);
    assert.match(branch, /moment={moment.moment}/);
    assert.doesNotMatch(branch, /if (moment.moment === 'gameDay')/, 'a moment must not fall back to the old body');
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


describe('before and after the event, and the host card (Part 3)', () => {
  const branch = () => {
    const home = readCode(HOME);
    return home.slice(home.indexOf('if (frameOn) {'), home.indexOf('// Honor the tournament'));
  };
  it('the champions come from the games families can see, and a round robin still has a way in', () => {
    assert.match(branch(), /deriveTierChampions\(allGames, teams, frameDivisions\)/);
    assert.match(branch(), /champions\.length === 0 && showSchedulePage/);
  });
  it("the spots count follows the team list's visibility, the capacity never does", () => {
    assert.match(branch(), /teamSpotsLine\(\{\s*inviteOnly, showTeamsPage, accepted: teams\.length,/);
    const lib = readCode('lib/public-pre-event.ts');
    assert.match(lib, /if \(showTeamsPage && capacity\)/);
    assert.match(lib, /else if \(!showTeamsPage && capacity\)/);
  });
  it("the Register button is never drawn in the organizer's admin preview", () => {
    assert.match(readCode('lib/public-pre-event.ts'), /const open = i\.registerOn && !i\.isPreview && i\.registration\.cta !== null;/);
  });
  it("the host card: only after the club's access question answered, through the door the band and footer use, and plain text in the preview", () => {
    const b = branch();
    assert.match(b, /await loadHostClubOpenNow\(org, href\)\.catch\(\(\) => null\)/);
    assert.match(b, /openNow === null \? null : hostCardView\(/);
    assert.match(b, /publicFrameHost\(org\.name, tournament\.name, await resolveOrgHomeHref\(org\)/);
    const view = readCode('lib/public-host-card.ts');
    assert.match(view, /if \(i\.host\?\.kind !== 'hosted' \|\| i\.openNow === null\) return null;/);
    assert.match(view, /href: i\.isPreview \? null : i\.clubHref/);
  });
  it("the host card wears the club's colours as custom properties only (no colour is written in the component)", () => {
    const card = readCode('components/public/PublicHostCard.tsx');
    assert.doesNotMatch(card, /#[0-9a-fA-F]{3,8}\b/);
    for (const v of ['--club-host-fill', '--club-host-on', '--club-host-edge']) assert.match(card, new RegExp(v));
  });
  it('the buttons and links are 44 px or more, and the countdown is a tabular figure', () => {
    const css = readSource('components/public/PublicParts.module.css');
    for (const sel of ['cta', 'hostBtn']) assert.match(css, new RegExp(`\\.${sel} \\{[^}]*min-height: 44px`), sel);
    assert.match(css, /\.factLink \{[^}]*min-height: 44px/);
    assert.match(css, /\.openItem \{[^}]*min-height: 60px/);
    assert.match(css, /\.regCount \{[^}]*font-variant-numeric: tabular-nums/);
  });
  it('a desk stands the two columns side by side from 1,024 px, and a phone stacks them main-then-side', () => {
    const css = readSource('components/public/PublicParts.module.css');
    assert.match(css, /@media \(min-width: 1024px\) \{\s*\.overview \{ padding: 28px 32px; \}\s*\.cols \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);/);
    const overview = readCode('components/public/TournamentOverview.tsx');
    assert.match(overview, /const main = moment === 'before' \? \[registerEl, factsEl\] : gameDay \? \[liveEl, playoffDoorEl, upNextEl, withheldEl\] : \[championsEl, afterDoorsEl\];/);
    assert.match(overview, /const side = moment === 'before' \? \[hostEl, newsEl\] : gameDay \? \[latestEl, newsEl, hostEl\] : \[hostEl\];/);
  });
});
