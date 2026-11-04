import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, filesUnder, openingTags, readCode, readSource, sourceExists } from './_source-code.ts';

const ROOT = 'app/[orgSlug]/[tournamentSlug]/teams';
const PREVIEW = 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx';

/** Stage 8 Part 3a (2026-11-03): the switch-off halves were deleted, so each page has one body and no fallback. */
describe('Stage 5 Part 1: one body per page (the old halves left in Stage 8 Part 3a)', () => {
  it('the Teams list and the team page render only the new body — no switch, no fallback', () => {
    const list = readCode(`${ROOT}/page.tsx`);
    assert.match(list, /return <PublicTeams orgSlug=\{orgSlug\} tournamentSlug=\{tournamentSlug\} \/>/);
    assert.doesNotMatch(list, /isPublicFrameOn|frameOn/);
    const page = readCode(`${ROOT}/[id]/page.tsx`);
    assert.match(page, /return <PublicTeamPage orgSlug=\{orgSlug\} tournamentSlug=\{tournamentSlug\} teamId=\{id\} \/>/);
    assert.doesNotMatch(page, /isPublicFrameOn|frameOn|LegacyTeamProfile/);
    assert.match(readCode(`${ROOT}/[id]/layout.tsx`), /forwardToOwnAddress\(orgSlug, `\/\$\{tournamentSlug\}\/teams\/\$\{id\}`\)/);
  });
  it('the old bodies and their styles are gone, and nothing reads them', () => {
    for (const path of ['components/public/TeamsContent.tsx', `${ROOT}/[id]/LegacyTeamProfile.tsx`, `${ROOT}/TeamsPageClient.tsx`,
      'app/[orgSlug]/teams/teams.module.css', `${ROOT}/[id]/team-profile.module.css`]) {
      assert.ok(!sourceExists(path), `${path} is back`);
    }
  });
  it('the admin Teams preview renders the filtered new body with no team-page preview', () => {
    const preview = readCode(PREVIEW);
    const teams = between(preview, "if (section === 'teams')", "if (section === 'news')");
    assert.match(teams, /games: onlyPublishedGames\(games, divisions\)/);
    assert.match(teams, /standingsByDivision: await getPublicStandingsByDivision\(tournament, divisions, \{ games, teams \}\)/);
    assert.match(teams, /return <PublicTeams[^;]+isPreview initialData=\{publicTeamsData\(initialData\)\}/);
    assert.doesNotMatch(teams, /isPublicFrameOn|frameOn/);
    assert.match(readCode('components/public/PublicTeams.tsx'), /enabled: !isPreview && isTournamentInProgress/);
    assert.doesNotMatch(preview.match(/const VALID_SECTIONS = new Set\(\[([^\]]+)\]/)![1], /team-profile|team-page/);
  });
  it('the new Teams body cannot reach the unfiltered legacy reader on load or refresh', () => {
    const data = readCode('lib/public-tournament-data.ts');
    assert.match(data, /section === 'teams-preview' \? 'teams'/);
    assert.match(data, /if \(section === 'teams-preview'\) \{[\s\S]*?return publicTeamsData\(\{/);
    assert.doesNotMatch(data, /section === 'teams'/, 'the plain teams section is gone');
    assert.match(readCode('app/api/public/tournament-data/route.ts'), /'teams-preview'/);
    const body = readCode('components/public/PublicTeams.tsx');
    assert.match(body, /fetchPublicTournamentData\(orgSlug, tournamentSlug, 'teams-preview'\)/);
    assert.match(body, /section: 'teams-preview'/);
    assert.doesNotMatch(body, /TeamsContent|section: 'teams'|localStorage/);
  });
  it('the profile exception follows the new caller\'s flag alone — no switch (Stage 8 Part 3a: its other caller left)', () => {
    const route = readCode('app/api/public/team-profile/route.ts');
    // The public feed fix (Stage 8 §16): the withhold and the published-only shape no longer depend on the caller's flag.
    assert.doesNotMatch(route, /frameOn|isPublicFrameOn|searchParams\.get\('publicFrame'\)/);
    assert.match(route, /if \(division\.scheduleVisibility !== 'published'\) \{/);
    assert.match(route, /return NextResponse.json\(withheldTeamProfile\(team, division.name\)\)/);
    assert.ok(route.indexOf("team.status !== 'accepted'") < route.indexOf('withheldTeamProfile(team,'));
    assert.ok(route.indexOf('withheldTeamProfile(team,') < route.indexOf('const scheduleShown'));
    // Stage 8 Part 4a: the page sends no flag either — the route has read none since the feed fix.
    assert.doesNotMatch(readCode('components/public/PublicTeamPage.tsx'), /publicFrame/);
    assert.doesNotMatch(route, /publicFrame|poolRankLabel|ordinal\(|teamsQualifying/, 'nothing the page never read is sent');
    // The old team page was the route's other caller (without the flag); since Stage 8 Part 3a the new page is the only one.
    const callers = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx'), ...filesUnder('lib', '.ts')]
      .filter(f => !f.startsWith('app/api/') && readSource(f).includes('/api/public/team-profile')
        && readCode(f).includes('/api/public/team-profile')); // raw text first: strip comments only on the few hits
    assert.deepEqual(callers, ['components/public/PublicTeamPage.tsx']);
  });
  it('the new profile owns one non-overlapping 30-second poll with hidden-tab pause and catch-up', () => {
    const body = readCode('components/public/PublicTeamPage.tsx');
    assert.equal((body.match(/setInterval\(/g) ?? []).length, 1);
    assert.match(body, /setInterval\(visible, 30_000\)/);
    assert.match(body, /if \(inFlight\) return/);
    assert.match(body, /document.visibilityState === 'visible'/);
    assert.match(body, /document.addEventListener\('visibilitychange', visible\)/);
    assert.match(body, /setEntry\(\{ key, data: next/);
    assert.doesNotMatch(body, /usePublicTournamentLive|LegacyTeamProfile|localStorage/);
  });
});

describe('Stage 5 Part 2: the approved Teams list', () => {
  const body = readCode('components/public/PublicTeams.tsx');
  const css = readSource('components/public/PublicTeams.module.css');
  it('starts on All divisions and neither remembers nor follows a division automatically', () => {
    assert.match(body, /useState\(''\)/);
    assert.match(body, /<option value="">All divisions<\/option>/);
    assert.doesNotMatch(body, /getDivisionPref|setDivisionPref|setDivisionId\(team/);
    assert.match(body, /teamsGroups\(\{ \.\.\.data, divisionId: selectedDivision, query \}\)/);
    assert.match(body, /teamMoment\(/); assert.match(body, /teamPlace\(/); assert.match(body, /teamRowLine\(/);
  });
  it('keeps links and stars as separate targets, the star app-only with a stable accessible name', () => {
    assert.match(body, /<Link className=\{styles.teamLink\}[^>]+>\{content\}<\/Link>/);
    assert.match(body, /!isPreview && <span className=\{`\$\{parts.appOnly\} \$\{styles.starWrap\}`\}/);
    assert.match(body, /aria-label=\{`Follow \$\{team.name\}`\} aria-pressed=\{isFollowed\}/);
    assert.match(body, /<UnfollowConfirmSheet/);
    assert.match(body, /if \(isPreview \|\| !isStandalonePWA\(\)\) return/);
    assert.match(css, /width: 44px; height: 44px/);
    assert.doesNotMatch(body, /Following \$\{|YearSelector|TeamAvatar|\bteamColor\b/);
  });
  it('uses the approved division headings, wraps full names and stays one column at every width', () => {
    assert.match(css, /\.heading h2 \{[^}]*1\.125rem/);
    assert.match(css, /\.teamLink strong \{[^}]*overflow-wrap: anywhere/);
    assert.doesNotMatch(css, /text-overflow|line-clamp|nowrap/);
    assert.match(css, /@media \(min-width: 1024px\)/);
    assert.doesNotMatch(css, /\.groups \{[^}]*grid-template-columns/);
    assert.doesNotMatch(readCode('lib/public-teams.ts').split('export function teamsGroups')[1], /followedTeamId|unshift|splice/);
  });
  it('keeps silent refresh failures and replaces data/clock, clearing a withdrawn selection and confirmation', () => {
    assert.match(body, /setData\(next\); setClock\(new Date\(\)\)/);
    assert.match(body, /!next.divisions.some\(d => d.id === divisionId\)\) setDivisionId\(''\)/);
    assert.match(body, /!next.teams.some\(t => t.id === unfollowId\)\) setUnfollowId\(null\)/);
    assert.doesNotMatch(body, /setInterval|refresh failed|stale data/i);
  });
});

describe('Stage 5 Part 3: the team page and installed-app mounts', () => {
  const body = readCode('components/public/PublicTeamPage.tsx');
  const layout = readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx');
  it('keeps initial 404 and connection/server failure distinct, retries, and leaves refresh failure silent', () => {
    assert.match(body, /response.status === 404[\s\S]*?error: 'missing'/);
    assert.match(body, /if \(!cancelled && !received\) setEntry\(\{ key, data: null, error: 'failed'/);
    assert.match(body, /This team isn't in this tournament/);
    assert.match(body, /Couldn't load this team/);
    assert.match(body, /Loading team…/);
    assert.match(body, /setAttempt\(n => n \+ 1\)/);
    assert.match(body, /entry\?\.key === key \? entry : null/);
  });
  it('the direct-link exception draws identity and one sentence, without actions or coach', () => {
    const start=body.indexOf('if (current?.data && withheld(current.data))');
    const end=body.indexOf('\n  return <div className={styles.page} data-public-team={current',start);
    assert.ok(start>=0 && end>start);
    const block=body.slice(start,end);
    assert.match(body,/data-public-team="withheld"/);
    assert.doesNotMatch(block,/SharePageButton|coach|symbol|Record|<Back/);
    assert.match(readSource('components/public/PublicTeamPage.module.css'),/\.message, \.loading[^}]+1rem/);
  });
  it('uses the shared game card and a standings door, with no team Share (owner removed it 2026-10-31), bell or table', () => {
    assert.match(body, /<PublicLiveCard/);assert.match(body, /<PublicDoorRow/);
    assert.doesNotMatch(body, /SharePageButton|Share this team/);
    assert.doesNotMatch(body, /FollowAlertsToggle|<table|<YearSelector/);
    assert.match(body, /<h3>Results<\/h3>/);
    assert.match(readSource('components/public/PublicTeamPage.module.css'),/grid-template-columns: 56px minmax\(0, 1fr\) auto/);
  });
  it('mounts the dock, the rail card and the prompt only inside the installed app, once each (Stage 8 Part 3d: no legacy mount)', () => {
    const gate=readCode('components/public/PublicAppOnly.tsx');
    assert.match(gate,/useSyncExternalStore\(subscribe, installed, server\)/);
    assert.match(gate,/const server = \(\) => false/);
    assert.match(gate,/active \? children : null/);
    // Stage 7: both also pass through the focused-page gate (public-focused-page.test.ts).
    assert.match(layout,/<PublicAppOnly><MyTeamDock orgSlug/);
    assert.match(layout,/<PublicAppOnly><FollowDeepLinkPrompt orgSlug/);
    for(const name of ['MyTeamDock','FollowDeepLinkPrompt'])
      assert.equal(openingTags(layout,name,'the tournament layout').length,1,`<${name}> has no second, browser mount`);
    assert.doesNotMatch(layout,/\bpublicFrame\b/,'no surface gets the old frame prop (publicFrameBand, Host and Attr are the frame helpers)');
    const rail=readCode('components/public/TournamentSideRail.tsx');
    assert.match(rail,/\{!basePath && <PublicAppOnly><DesktopMyTeamRailCard \/><\/PublicAppOnly>\}/);
    assert.equal(openingTags(rail,'DesktopMyTeamRailCard','the side rail').length,1,'the rail card has no browser mount');
    for(const file of ['PublicSchedule','PublicStandings','TournamentOverview','PublicTeams','PublicTeamPage'])
      assert.doesNotMatch(readCode(`components/public/${file}.tsx`),/<MyTeamCard/);
  });
  it('the installed-app readers use ONLY the published-only feeds (Stage 8 Part 3d: their legacy-feed branches went)', () => {
    const prompt=readCode('components/public/FollowDeepLinkPrompt.tsx');
    assert.match(prompt,/fetchPublicTournamentData\(orgSlug, tournamentSlug, 'teams-preview'\)/);
    assert.doesNotMatch(prompt,/'teams'|publicFrame/);
    for(const file of ['components/public/MyTeamDock.tsx','components/public/DesktopMyTeamRailCard.tsx','lib/hooks/useTodaysTournamentGames.ts']){
      const code=readCode(file);
      assert.match(code,/fetchPublicTournamentData\(orgSlug, tournamentSlug, 'schedule-preview'\)/,file);
      assert.doesNotMatch(code,/'schedule'|publicFrame/,`${file} can still reach the legacy feed`);
    }
    assert.match(readCode('lib/public-tournament-data.ts'),/if \(section === 'schedule-preview'\) \{[\s\S]*?return publicTeamsData\(\{/);
    assert.match(readCode('components/public/TodaysResultsLine.tsx'),/useTodaysTournamentGames\(\)/);
    assert.ok(!sourceExists('components/public/ScoreTicker.tsx'),'the old ticker (the hook\'s legacy-feed caller) is gone');
  });
  it('no public browser part asks for an unscrubbed feed — a sweep, not a list of names (Stage 8 Part 3d /review)', () => {
    // The plain schedule / teams / standings sections ship whole games (notes, the scorekeeper\'s identity); every browser
    // reader of the public pages asks for a published-only section instead. A new or renamed reader is caught here.
    const readers=[...filesUnder('components/public','.tsx'),...filesUnder('lib/hooks','.ts')]
      .filter(f=>/^['"]use client['"]/m.test(readSource(f)))
      .filter(f=>/fetchPublicTournamentData\(|usePublicTournamentLive\(/.test(readCode(f)));
    assert.ok(readers.length>=8,'the sweep finds the public readers (else its filter broke)');
    // Every section argument must be a published-only section written out; a constant, a variable or a legacy name fails.
    const SAFE=/^'(schedule-preview|teams-preview|standings-preview|playoffs|register)'$/;
    const offenders:string[]=[];
    for(const f of readers){
      const code=readCode(f);
      const args=[...code.matchAll(/fetchPublicTournamentData\(\s*[^,()]+,\s*[^,()]+,\s*([^)]+?)\s*\)/g),...code.matchAll(/\bsection:\s*([^,;}\n]+?)\s*[,;}\n]/g)].map(m=>m[1]);
      // The live hook itself only forwards its caller's section (each caller is in this sweep).
      const passThrough=f==='lib/hooks/usePublicTournamentLive.ts'?['section','PublicTournamentSection']:[];
      for(const a of args) if(!SAFE.test(a)&&!passThrough.includes(a)) offenders.push(`${f}: ${a}`);
    }
    assert.deepEqual(offenders,[],'a public browser reader asks for a feed that is not published-only');
  });
  it('metadata is opt-in only and the old privacy gates still decide what it may describe', () => {
    const route=readCode('app/api/public/team-profile/route.ts');
    assert.match(route,/NextResponse.json\(teamProfilePreview\(profile/);
    assert.match(route,/rows: standingsRows, standingsShown/);
    assert.doesNotMatch(route,/\}\) : profile\)/, 'the unscrubbed profile shape is gone');
  });
});
