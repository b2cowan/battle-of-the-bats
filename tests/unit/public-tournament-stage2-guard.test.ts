import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, filesUnder, readCode, readSource, sourceExists } from './_source-code.ts';
import { visibleTournamentTabs } from '../../lib/tournament-page-tabs.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * PUBLIC TOURNAMENT PAGES · STAGE 2, THE OVERVIEW (build prompt docs/projects/active/PUBLIC_TOURNAMENT_STAGE2_BUILD_PROMPT.md;
 * plan §5, Asks 3, 4, 17). Built behind the preview switch; Stage 8 Part 3d deleted the old Overview, the ticker and the
 * explore row, so the new body is the Overview's only body. This guard holds that, and the rules the stage stands on.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const HOME = 'components/public/TournamentHomeContent.tsx';
const PARTS = ['PublicGameRow', 'PublicLiveCard', 'PublicSectionHead', 'PublicDoorRow', 'PublicPostList', 'FollowTournamentLine', 'TournamentOverview',
  'PublicRegisterCard', 'PublicFactsList', 'PublicHostCard', 'PublicChampions', 'PublicRules'];
/** The files that may draw the shared parts: each is its page's only body since Stage 8 deleted the old halves (Part 3a:
 *  Rules, Teams, the team page, Standings; Part 3b: the Schedule, a game's page; Part 3c: Playoffs, Champions; Part 3d:
 *  the Overview, whose loader hands over to TournamentOverview — held below). */
const FRAME_ONLY_USERS = ['components/public/TournamentOverview.tsx', 'components/public/PublicSchedule.tsx', 'components/public/PublicGameDetails.tsx',
  'components/public/PublicStandings.tsx', 'components/public/PublicPlayoffs.tsx',
  'components/public/PublicTeams.tsx', 'components/public/PublicTeamPage.tsx',
  'components/public/PublicChampionsPage.tsx', 'app/[orgSlug]/[tournamentSlug]/rules/page.tsx',
  // Part 3: sub-bodies of guarded pages. The bracket is drawn only by Playoffs (through TieredBracket) and draws each match
  // as the Schedule's own ScheduleMatchup; the Rules sections are only PublicRules' list of joined disclosures.
  'components/bracket/PublicBracket.tsx', 'components/public/PublicRuleSections.tsx',
  'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx', HOME];

describe('the shared parts render only inside the new frame', () => {
  it('no page or component outside the guarded frame bodies imports them', () => {
    const users = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => !PARTS.some(p => f.endsWith(`/${p}.tsx`)))
      .filter(f => PARTS.some(p => new RegExp(`from ['"][^'"]*/${p}['"]`).test(readSource(f))));
    assert.deepEqual(users.filter(f => !FRAME_ONLY_USERS.includes(f)), [], 'a shared part reached a page outside the switch');
    // Stage 3 reuses the parts; since Stage 8 Part 3b the Schedule, its preview twin and a game's page render the new body
    // as their only body (the old halves are gone, so there is no switch left on these three to hold).
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/schedule/page.tsx'), /return <PublicSchedule /);
    assert.match(between(readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx'),
      "if (section === 'schedule')", "if (section === 'standings')"), /return <PublicSchedule /);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx'), /return <PublicGameDetails /);
  });
  it('their styles read only the frame\'s own light token set (they have no meaning outside it)', () => {
    const css = readSource('components/public/PublicParts.module.css');
    const vars = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]);
    assert.ok(vars.length > 0);
    assert.deepEqual(vars.filter(v => !v.startsWith('--club-')), [], 'a shared part reads a token the frame does not set');
  });
  it('a score and a time are tabular figures; the heading door, the door row and the Directions target are 44 px or more', () => {
    const css = readSource('components/public/PublicParts.module.css');
    assert.match(css, /\.count \{[^}]*font-variant-numeric: tabular-nums/);
    // Part 3: the Overview's own .when / .scores / .score are gone — a game's time and score are the Schedule row's.
    const sched = readSource('components/public/PublicSchedule.module.css');
    for (const sel of ['gameTime', 'gameScore']) {
      assert.match(sched, new RegExp(`\\.${sel} \\{[^}]*font-variant-numeric: tabular-nums`), sel);
    }
    assert.match(css, /\.headLink \{[^}]*min-height: 44px/);
    // The link row is the club kit's 60 px list row (Public page layout standard R7, 2026-11-04), not a copy of it.
    assert.match(readSource('components/public/ClubKit.module.css'), /\n\.row \{[^}]*min-height: 60px/);
    assert.match(readCode('components/public/PublicDoorRow.tsx'), /className \? `\$\{kit\.row\} \$\{className\}` : kit\.row/, 'the club kit row, plus a page\'s own placement class');
    assert.doesNotMatch(css, /\n\.door \{/, 'the old door look is gone');
    assert.match(readCode('components/public/TournamentOverview.tsx'), /<DirectionsLink /, 'the club pages\' one Directions control');
    assert.match(readSource('components/public/PublicSchedule.module.css'), /\.placeStrip \{[^}]*min-height: 56px/, 'the strip that holds it');
  });
});

describe('the moment helper is today\'s finished rule, exactly', () => {
  it('the helper is the one copy: the old Overview\'s own copy went with it (Stage 8 Part 3d)', () => {
    const home = readCode(HOME);
    assert.doesNotMatch(home, /noUnplayedGames|roundRobinComplete|isCompletedTournament|playoffsComplete/);
    assert.match(home, /const moment = tournamentMoment\(\{/);
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

describe('game day (Part 2): the new body is the Overview\'s only body', () => {
  it('the loader hands every moment to TournamentOverview, reads no switch and draws nothing of its own (Stage 8 Part 3d)', () => {
    const home = readCode(HOME);
    assert.match(home, /<TournamentOverview/);
    assert.match(home, /moment=\{moment\.moment\}/);
    assert.equal(home.split('<TournamentOverview').length, 2, 'one hand-over');
    assert.doesNotMatch(home, /isPublicFrameOn|frameOn|moment\.moment === 'gameDay'/, 'no switch, and no moment falls back to an old body');
    assert.doesNotMatch(home, /<(?!TournamentOverview\b)[A-Za-z][\w.]*[\s/>]|Home\.module\.css/, 'the loader draws no markup of its own; the old body\'s sheet is gone');
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
  it('the old follow strip left with the old Overview; the line keeps the shared follow behaviour', () => {
    assert.ok(!sourceExists('components/public/FollowTournamentStrip.tsx'), 'the old Overview\'s strip is gone (Stage 8 Part 3d)');
    assert.match(readCode('components/public/FollowTournamentLine.tsx'), /useTournamentFollowToggle\(orgSlug, tournamentSlug, tournamentName\)/);
  });
});

describe('the ticker leaves the Overview (Ask 17)', () => {
  it('the line asks its page list before it loads a game; the old ticker is gone (Stage 8 Part 3d)', () => {
    const line = readCode('components/public/TodaysResultsLine.tsx');
    assert.match(line, /return pageCarriesTicker\(pathname, [^)]*\) \? <ResultsLine \/> : null;/);
    assert.doesNotMatch(readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx'), /ScoreTicker/);
    assert.ok(!sourceExists('components/public/ScoreTicker.tsx'));
  });
});


describe('before and after the event, and the host card (Part 3)', () => {
  // The loader is the Overview's only body since Stage 8 Part 3d, so its whole source is what these read.
  const branch = () => readCode(HOME);
  it('the champions come from the games families can see, and a round robin still has a way in', () => {
    assert.match(branch(), /deriveTierChampions\(allGames, teams, sortedDivisions\)/);
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
    // A10 (Part 3): nothing open → no card, so the check is "has something open", which also covers the unanswered null.
    assert.match(view, /if \(i\.host\?\.kind !== 'hosted' \|\| !i\.openNow\?\.length\) return null;/);
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
  it('a desk stands the two columns side by side from a 1,200 px window, and below that they stack main-then-side', () => {
    // Public page layout standard R1 (owner 2026-11-04): the Overview, a game's page and a team's page share ONE column
    // rule, and between 1,024 and 1,199 px they stack (was: side by side from 1,024). The page's edges are the shared
    // page's (public-page-layout-guard.test.ts), not the Overview's own.
    const css = readSource('components/public/PublicParts.module.css');
    assert.match(css, /@media \(min-width: 1200px\) \{\s*\.cols \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(0, 1fr\);/);
    const overview = readCode('components/public/TournamentOverview.tsx');
    assert.match(overview, /const main = moment === 'before' \? \[registerEl, factsEl\] : gameDay \? \[liveEl, upNextEl, withheldEl\] : \[championsEl, afterDoorsEl\];/);
    assert.match(overview, /const side = moment === 'before' \? \[hostEl, newsEl\] : gameDay \? \[latestEl, playoffDoorEl, newsEl, hostEl\] : \[hostEl\];/);
  });
});

describe('Stage 6 (Ask 14, "tabs follow what there is"): News, Rules, Register, Champions', () => {
  it('with no frameContent the row is exactly what it has always been (every switch-off caller)', () => {
    const today = visibleTournamentTabs([], false);
    assert.deepEqual(today.map(t => t.key), ['news', 'schedule', 'standings', 'teams', 'rules']);
  });
  it('News/Rules hide while empty, Register and Champions insert only when their fact is true', () => {
    const empty = visibleTournamentTabs([], false, { hasNews: false, hasRules: false, registrationOpen: false, hasChampion: false });
    assert.deepEqual(empty.map(t => t.key), ['schedule', 'standings', 'teams']);
    const full = visibleTournamentTabs([], false, { hasNews: true, hasRules: true, registrationOpen: true, hasChampion: true });
    assert.deepEqual(full.map(t => t.key), ['champions', 'news', 'schedule', 'standings', 'teams', 'rules', 'register']);
  });
  it('Champions never appears once Standings is hidden, even with a title to show (D1\'s own gate)', () => {
    const hidden = visibleTournamentTabs(['standings'], false, { hasNews: false, hasRules: false, registrationOpen: false, hasChampion: true });
    assert.ok(!hidden.some(t => t.key === 'champions'));
  });
  it('a held-back division never reaches the champion the tab/page reads (D1) — every reader filters through onlyPublishedGames first', () => {
    for (const file of ['app/[orgSlug]/[tournamentSlug]/champions/page.tsx', 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx']) {
      const code = readCode(file);
      assert.match(code, /onlyPublishedGames\(rawGames, divisions\)/, file);
      assert.match(code, /deriveTierChampions\(allGames, teams, sortedDivisions\)/, file);
    }
  });
  it('the live layout and preview use the same stamped-champion visibility helper — no result re-derivation', () => {
    // The preview reads them through the one shared read (Stage 1a Part 3), which the Branding page's Look card uses too.
    assert.match(readCode('app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx'), /publicFrameBandFacts\(tournament,/);
    for (const file of ['app/[orgSlug]/[tournamentSlug]/layout.tsx', 'lib/public-frame-server.ts']) {
      assert.match(readCode(file), /tournamentFrameTabContent\(/, file);
      assert.match(readCode(file), /championsCrownedAt: tournament\.championsCrownedAt/, file);
    }
  });
  it('Rules and Champions each have one body (their old halves left in Stage 8 Parts 3a and 3c)', () => {
    const rules = readCode('app/[orgSlug]/[tournamentSlug]/rules/page.tsx');
    assert.match(rules, /return <PublicRules\s/);
    assert.doesNotMatch(rules, /isPublicFrameOn|RulesContent|rulesLayout|resourcesLayout/);
    const champions = readCode('app/[orgSlug]/[tournamentSlug]/champions/page.tsx');
    assert.match(champions, /return <PublicChampionsPage\s/);
    assert.doesNotMatch(champions, /isPublicFrameOn|frameOn|ChampionsRecap|styles\.|PublicTournamentState/);
  });
  it('Register\'s body is not touched by Stage 6 — no RegisterContent.tsx edit, no frameOn import there', () => {
    assert.doesNotMatch(readSource('components/public/RegisterContent.tsx'), /isPublicFrameOn|frameOn/);
  });
});
