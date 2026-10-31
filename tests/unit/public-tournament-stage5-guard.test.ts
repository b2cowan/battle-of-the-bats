import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

const ROOT = 'app/[orgSlug]/[tournamentSlug]/teams';
const PREVIEW = 'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx';
const digest = (text: string) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

describe('Stage 5 Part 1: server-selected bodies, legacy preserved', () => {
  it('both server pages ask the preview switch and retain the old fallback', () => {
    assert.match(readCode(`${ROOT}/page.tsx`), /const frameOn = await isPublicFrameOn\(\);[\s\S]*<TeamsPageClient frameOn=\{frameOn\}/);
    assert.match(readCode(`${ROOT}/TeamsPageClient.tsx`), /if \(frameOn\) return <PublicTeams/);
    assert.match(readCode(`${ROOT}/TeamsPageClient.tsx`), /<TeamsContent/);
    const page = readCode(`${ROOT}/[id]/page.tsx`);
    assert.match(page, /const frameOn = await isPublicFrameOn\(\);\s*if \(frameOn\)/);
    assert.match(page, /return <PublicTeamPage/);
    assert.match(page, /return <LegacyTeamProfile params=\{params\} \/>/);
    assert.match(readCode(`${ROOT}/[id]/layout.tsx`), /forwardToOwnAddress\(orgSlug, `\/\$\{tournamentSlug\}\/teams\/\$\{id\}`\)/);
  });
  it('the complete old bodies and their styles retain their bytes', () => {
    for (const [path, hash] of [
      ['components/public/TeamsContent.tsx', '7f200dae903de81ebe556ee7940c44725e2541f2ae153395b6719167771005ab'],
      [`${ROOT}/[id]/LegacyTeamProfile.tsx`, '5c830912f621fbb3e73d2a77c38e2b2f2ca0769ec6e65089ff04cac1516640aa'],
      ['app/[orgSlug]/teams/teams.module.css', '40217be79c184858c6faf9f486025b729d4a747a7b1c9c91db120dff568181c3'],
      [`${ROOT}/[id]/team-profile.module.css`, '64067fa3a959ff77eb4bd31b0cb07c8f5561dec7726f02ce14f24e2f2c31bc36'],
    ]) assert.equal(digest(readSource(path)), hash, path);
  });
  it('the admin Teams preview uses the filtered branch with no team-page preview', () => {
    const preview = readCode(PREVIEW);
    assert.match(preview, /if \(frameOn\) \{\s*const games = await getGames[\s\S]*?return <PublicTeams[^;]+isPreview initialData=\{publicTeamsData\(initialData\)\}/);
    assert.match(readCode('components/public/PublicTeams.tsx'), /enabled: !isPreview && isTournamentInProgress/);
    assert.doesNotMatch(preview.match(/const VALID_SECTIONS = new Set\(\[([^\]]+)\]/)![1], /team-profile|team-page/);
  });
  it('the new Teams body cannot reach the unfiltered legacy reader on load or refresh', () => {
    const data = readCode('lib/public-tournament-data.ts');
    assert.match(data, /section === 'teams-preview' \? 'teams'/);
    assert.match(data, /return section === 'teams-preview' \? publicTeamsData\(data\) : data/);
    assert.match(readCode('app/api/public/tournament-data/route.ts'), /'teams-preview'/);
    const body = readCode('components/public/PublicTeams.tsx');
    assert.match(body, /fetchPublicTournamentData\(orgSlug, tournamentSlug, 'teams-preview'\)/);
    assert.match(body, /section: 'teams-preview'/);
    assert.doesNotMatch(body, /TeamsContent|section: 'teams'|localStorage/);
  });
  it('the profile exception requires both an explicit new caller and the server preview switch', () => {
    const route = readCode('app/api/public/team-profile/route.ts');
    assert.match(route, /const frameOn = searchParams.get\('publicFrame'\) === '1' && await isPublicFrameOn\(\)/);
    assert.match(route, /if \(frameOn && division.scheduleVisibility !== 'published'\)/);
    assert.match(route, /return NextResponse.json\(withheldTeamProfile\(team, division.name\)\)/);
    assert.ok(route.indexOf("team.status !== 'accepted'") < route.indexOf('withheldTeamProfile(team,'));
    assert.ok(route.indexOf('withheldTeamProfile(team,') < route.indexOf('const scheduleShown'));
    assert.match(readCode('components/public/PublicTeamPage.tsx'), /publicFrame: '1'/);
    assert.doesNotMatch(readCode(`${ROOT}/[id]/LegacyTeamProfile.tsx`), /publicFrame/);
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
  it('does not mount browser dock/card/prompts and preserves the legacy fallbacks', () => {
    const gate=readCode('components/public/PublicAppOnly.tsx');
    assert.match(gate,/useSyncExternalStore\(subscribe, installed, server\)/);
    assert.match(gate,/const server = \(\) => false/);
    assert.match(gate,/active \? children : null/);
    assert.match(layout,/frameOn \? <PublicAppOnly><MyTeamDock\s+publicFrame/);
    assert.match(layout,/: <MyTeamDock/);
    assert.match(layout,/frameOn \? <PublicAppOnly><FollowDeepLinkPrompt/);
    assert.match(readCode('components/public/TournamentSideRail.tsx'),/publicFrame \? <PublicAppOnly><DesktopMyTeamRailCard publicFrame/);
    for(const file of ['PublicSchedule','PublicStandings','TournamentOverview','PublicTeams','PublicTeamPage'])
      assert.doesNotMatch(readCode(`components/public/${file}.tsx`),/<MyTeamCard/);
  });
  it('the installed-app readers also use published-only feeds', () => {
    assert.match(readCode('components/public/FollowDeepLinkPrompt.tsx'),/publicFrame \? 'teams-preview' : 'teams'/);
    for(const file of ['MyTeamDock','DesktopMyTeamRailCard'])
      assert.match(readCode(`components/public/${file}.tsx`),/publicFrame \? 'schedule-preview' : 'schedule'/);
    assert.match(readCode('lib/public-tournament-data.ts'),/section === 'schedule-preview' \? publicTeamsData\(data\) : data/);
    assert.match(readCode('components/public/TodaysResultsLine.tsx'),/useTodaysTournamentGames\(true\)/);
    assert.match(readCode('lib/hooks/useTodaysTournamentGames.ts'),/publicFrame \? 'schedule-preview' : 'schedule'/);
    assert.match(readCode('components/public/ScoreTicker.tsx'),/useTodaysTournamentGames\(\)/);
  });
  it('metadata is opt-in only and the old privacy gates still decide what it may describe', () => {
    const route=readCode('app/api/public/team-profile/route.ts');
    assert.match(route,/NextResponse.json\(frameOn \? teamProfilePreview\(profile/);
    assert.match(route,/rows: standingsRows, standingsShown/);
    assert.match(route,/\}\) : profile\)/);
  });
});
