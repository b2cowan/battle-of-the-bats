import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readCode } from './_source-code.ts';
import {
  kitOrgLinks, orgTabs, placeTabFor, repTeamsTabs, seasonTabs, showsOrgBoard, teamTabs,
} from '../../lib/admin-kit-nav.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 13i, SESSION A — PAGES ON THE PAGE (owner 2026-11-06: Asks 1–3 and 5–9 A, Ask 4 B; Session A's four
 * build answers: the division picker, the title's chevron, record pages, "The board" tab). Build prompt
 * docs/projects/active/CLUB_TIER_STAGE13I_BUILD_PROMPT.md; drawing tab 6 (N11).
 *
 *   1. One list of tabs per place, in the nav model; each tab lights on its OWN address, a record page on none.
 *   2. Each place's frame draws THE shared tab row from that list (never a hand-written row, never two rows).
 *   3. The pages a tab row reaches lost their own title and "← {team}" / "← {season}" back link; a create sits in its tab.
 *   4. Organization: the tile hub retired; Plan & billing is never a tab (Ask 4 B); the board is a tab (R1 kept).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const BASE = '/harbourtown/admin';
const TEAM = `${BASE}/rep-teams/teams/t1`;
const SEASON = `${BASE}/house-league/seasons/s1`;
const A = 'app/[orgSlug]/admin';
const EVERY = { read: true, readMoney: true, email: true };

describe('1 · one list of tabs per place', () => {
  it('Rep teams: its six, the program’s own pages in their order', () => {
    assert.deepEqual(repTeamsTabs(BASE).map(t => t.label),
      ['Teams', 'Assistant coaches', 'Document templates', 'Shared library', 'Past seasons', 'Bring in a coach’s team']);
  });
  it('a team: its five, out of the rail', () => {
    assert.deepEqual(teamTabs(TEAM).map(t => t.label), ['Team page', 'Roster', 'Schedule', 'Tryouts', 'Coaches']);
    assert.doesNotMatch(readCode('lib/admin-kit-nav.ts'), /'\/roster'|`\$\{t\}\/roster`/);
  });
  it('a season: the pages the person can open; the treasurer’s is Money alone (a list of one draws no row)', () => {
    assert.deepEqual(seasonTabs(SEASON, EVERY).map(t => t.label),
      ['Overview', 'Registrations', 'Teams & draft', 'Schedule', 'Standings', 'Money', 'Email families']);
    assert.deepEqual(seasonTabs(SEASON, { read: false, readMoney: true, email: false }).map(t => t.label), ['Money']);
  });
  it('each tab lights on its own address; a team, a record page and a forwarding address light none of Rep teams’', () => {
    const rt = repTeamsTabs(BASE);
    assert.equal(placeTabFor(rt, `${BASE}/rep-teams`), 'rt-teams');
    assert.equal(placeTabFor(rt, `${BASE}/rep-teams/bring-in`), 'rt-bring-in');
    assert.equal(placeTabFor(rt, `${TEAM}/roster`), null, 'a team is its own place: Rep teams’ row is absent under it');
    assert.equal(placeTabFor(rt, `${BASE}/rep-teams/rename-slugs`), null, 'Rename team addresses is a record page');
    const tt = teamTabs(TEAM);
    assert.equal(placeTabFor(tt, TEAM), 'team');
    assert.equal(placeTabFor(tt, `${TEAM}/roster`), 'roster');
    assert.equal(placeTabFor(tt, `${TEAM}/history`), null, 'History is a record page');
    assert.equal(placeTabFor(tt, `${TEAM}/history/y1`), null, 'one past season is a record page');
    const st = seasonTabs(SEASON, EVERY);
    assert.equal(placeTabFor(st, SEASON), 'overview');
    assert.equal(placeTabFor(st, `${SEASON}/registrations`), 'registrations');
    assert.equal(placeTabFor(st, `${SEASON}/club-schedule/c1`), null, 'a club schedule read from the season is a record page');
  });
});

describe('2 · each place draws THE shared tab row, from the model', () => {
  // Rep teams and a season read their list through `clubPlaceAt` (Admin header bar Phase 2): the one statement of "which
  // place, which tab" that the pinned bar asks too, built from `repTeamsTabs` / `seasonTabs` and lit by `placeTabFor`.
  const frames: [string, RegExp, RegExp][] = [
    ['components/admin/kit/club/RepTeamsFrame.tsx', /clubPlaceAt\(/, /clubPlaceAt\(/],
    ['components/admin/kit/club/TeamFrame.tsx', /teamTabs\(/, /placeTabFor\(/],
    ['components/admin/kit/club/SeasonFrame.tsx', /clubPlaceAt\(/, /clubPlaceAt\(/],
    ['components/admin/kit/club/OrgFrame.tsx', /orgTabs\(/, /placeTabFor\(/],
  ];
  it('every frame reads its list and draws it through PlaceFrame, which draws HubTabBar (on the paper, or in the bar)', () => {
    for (const [f, list, lights] of frames) {
      const code = readCode(f);
      assert.match(code, list, `${f} reads the model’s list`);
      assert.match(code, /<PlaceFrame /, `${f} draws the shared frame`);
      assert.match(code, lights, `${f} lights by the one rule`);
      assert.doesNotMatch(code, /HubTabBar|href: `\$\{[a-z]+\}\/roster`/, `${f} hand-writes a row`);
    }
    const nav = readCode('lib/admin-kit-nav.ts');
    const at = nav.slice(nav.indexOf('export function clubPlaceAt('));
    assert.match(at, /repTeamsTabs\(base\)/);
    assert.match(at, /seasonTabs\(seasonPath, seasonAccess\)/);
    assert.match(at, /placeTabFor\(/);
    assert.match(readCode('components/admin/kit/club/PlaceFrame.tsx'), /<HubTabBar tabs=\{tabs\} activeId=\{activeId\} ariaLabel=\{ariaLabel\} \/>/);
    assert.match(readCode('components/admin/AdminEventHeader.tsx'), /<HubTabBar inBar tabs=\{tabbed\.tabs\} activeId=\{tabbed\.activeId\} ariaLabel=\{tabbed\.ariaLabel\} \/>/);
  });
  it('the layouts mount the frames', () => {
    assert.match(readCode(`${A}/rep-teams/layout.tsx`), /<RepTeamsFrame orgSlug=\{ctx\.org\.slug\}>/);
    assert.match(readCode(`${A}/rep-teams/teams/[teamId]/layout.tsx`), /<TeamFrame>/);
    assert.match(readCode(`${A}/house-league/seasons/[seasonId]/layout.tsx`), /<SeasonFrame>/);
    assert.match(readCode(`${A}/org/layout.tsx`), /<OrgFrame>/);
  });
  it('no page shows two tab rows: Registrations’ views are the view switch, Teams & draft’s divisions the picker', () => {
    const regs = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
    assert.doesNotMatch(regs, /HubTabBar/);
    assert.match(regs, /<ViewSwitch views=\{views\} value=\{tab\}/);
    assert.match(regs, /router\.push\(`\$\{base\}\?tab=\$\{id\}`/, 'each view keeps its own address');
    const teams = readCode('components/admin/kit/club/league/teams/TeamsScreen.tsx');
    assert.doesNotMatch(teams, /HubTabBar/);
    assert.match(teams, /<DivisionPicker/);
    assert.match(teams, /router\.push\(`\$\{base\}\/teams\?d=\$\{id\}`/);
  });
  it('the phone’s “In <program>” row and the season’s phone strip retired', () => {
    assert.ok(!existsSync(join(process.cwd(), 'components/admin/kit/AdminKitProgramRow.tsx')));
    assert.ok(!existsSync(join(process.cwd(), 'components/admin/kit/club/SeasonPhoneFrame.tsx')));
    assert.doesNotMatch(readCode(`${A}/AdminChrome.tsx`), /AdminKitProgramRow/);
  });
});

describe('3 · a page its tab row reaches has no title or back link of its own', () => {
  const tabPages = [
    `${A}/rep-teams/page.tsx`, `${A}/rep-teams/assistant-coaches/page.tsx`, `${A}/rep-teams/bring-in/page.tsx`,
    `${A}/rep-teams/documents/page.tsx`, `${A}/rep-teams/past/page.tsx`, `${A}/rep-teams/shared-library/page.tsx`,
    `${A}/rep-teams/teams/[teamId]/page.tsx`, `${A}/rep-teams/teams/[teamId]/roster/page.tsx`,
    `${A}/rep-teams/teams/[teamId]/schedule/page.tsx`, `${A}/rep-teams/teams/[teamId]/tryouts/page.tsx`,
    `${A}/rep-teams/teams/[teamId]/coaches/page.tsx`,
    `${A}/house-league/seasons/[seasonId]/page.tsx`, `${A}/house-league/seasons/[seasonId]/money/page.tsx`,
    `${A}/house-league/seasons/[seasonId]/schedule/page.tsx`, `${A}/house-league/seasons/[seasonId]/standings/page.tsx`,
    'components/admin/kit/club/league/registrations/RegistrationsScreen.tsx',
    'components/admin/kit/club/league/teams/TeamsScreen.tsx',
    'components/admin/kit/club/league/email/SeasonEmailsScreen.tsx',
  ];
  it('no AdminPageHeader and no backTo on a page that only renders inside its place', () => {
    for (const f of tabPages) {
      const code = readCode(f);
      assert.doesNotMatch(code, /<AdminPageHeader\b|backTo=/, `${f} draws its own title or back link`);
    }
  });
  it('the Organization pages the tournament side also renders switch by place (TabPageHeader)', () => {
    for (const f of ['components/admin/kit/club/MembersKit.tsx', 'components/admin/kit/club/AuditLogKit.tsx', 'components/admin/kit/club/SettingsKit.tsx',
      `${A}/org/venues/page.tsx`, `${A}/org/settings/pdf/page.tsx`]) {
      const code = readCode(f);
      assert.match(code, /<TabPageHeader\b/, f);
      assert.doesNotMatch(code, /<AdminPageHeader\b/, f);
    }
    const frame = readCode('components/admin/kit/club/PlaceFrame.tsx');
    assert.match(frame, /if \(!inPlace\) return <AdminPageHeader \{\.\.\.props\} \/>;/, 'outside a place it is the full header');
  });
  it('the record pages keep their own back arrow', () => {
    assert.match(readCode(`${A}/rep-teams/teams/[teamId]/history/page.tsx`), /backTo=/);
    assert.match(readCode(`${A}/rep-teams/rename-slugs/page.tsx`), /<AdminPageHeader\b/);
    assert.match(readCode(`${A}/house-league/seasons/[seasonId]/club-schedule/[scheduleId]/page.tsx`), /backTo=/);
  });
  it('a create sits in its tab’s toolbar: Add team at the Teams toolbar’s end, Add registration at Registrations’', () => {
    const teams = readCode(`${A}/rep-teams/page.tsx`);
    const at = teams.indexOf('<CoachListToolbar');
    const toolbar = teams.slice(at, teams.indexOf('\n        />', at));
    assert.match(toolbar, /aria-label="Add team"/);
    assert.doesNotMatch(readCode('components/admin/kit/club/RepTeamsFrame.tsx'), /Add team/);
    const regs = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
    const bar = regs.slice(regs.search(/<div className=\{[^}]*\btb\.toolbar\b/), regs.indexOf('{searchField.row}'));
    assert.ok(bar.length > 0, 'the toolbar is found');
    assert.match(bar, /aria-label=\{REGS_WORDS\.add\}/);
    assert.ok(bar.indexOf('REGS_WORDS.add') > bar.indexOf('<ExportMenu'), 'Add registration is the last control');
  });
  it('the team’s header is “← Teams”; the season’s “← Seasons” with the switch in its title', () => {
    assert.match(readCode('components/admin/kit/club/TeamFrame.tsx'), /backTo=\{\{ href: repTeams, label: 'Teams' \}\}/);
    // The season's way up is in the pinned bar since Admin header bar Phase 2: `clubPlaceAt` names it, the frame hands it over.
    assert.match(readCode('lib/admin-kit-nav.ts'), /back: \{ href: league, label: 'Seasons' \}/);
    assert.match(readCode('components/admin/kit/club/SeasonFrame.tsx'), /<PlaceFrame place=\{\{\s*\.\.\.place,/);
    assert.match(readCode(`${A}/rep-teams/teams/[teamId]/page.tsx`), /usePublishTeamHead\(teamId, read \? teamHeadOf\(read\.team, read\.programYears\) : null\)/,
      'the Team page tells the header what it changed');
  });
});

describe('4 · Organization', () => {
  const linksFor = (role: string) => kitOrgLinks({
    base: BASE, role, isCanceled: false, canSeeMembers: role !== 'league_registrar', hasVenueLibrary: true,
  });
  it('Plan & billing, Tournaments and the Coaches Portal are never Organization tabs (Ask 3 A, Ask 4 B)', () => {
    for (const role of ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer']) {
      const orgLinks = linksFor(role);
      const labels = orgTabs({ base: BASE, orgLinks, showsBoard: showsOrgBoard({ role, orgLinks, isTeamWorkspace: false }) }).map(t => t.label);
      assert.ok(!labels.includes('Plan & billing') && !labels.includes('Tournaments') && !labels.includes('My Coaches Portal'), role);
    }
  });
  it('Members never lights on the Audit log, and Plan & billing’s page lights no tab', () => {
    const tabs = orgTabs({ base: BASE, orgLinks: linksFor('owner'), showsBoard: false });
    assert.equal(placeTabFor(tabs, `${BASE}/org/members/audit`), 'org/audit');
    assert.equal(placeTabFor(tabs, `${BASE}/org/members`), 'org/members');
    assert.equal(placeTabFor(tabs, `${BASE}/org/settings/pdf`), 'org/pdf');
    assert.equal(placeTabFor(tabs, `${BASE}/org/billing`), null);
  });
  it('the board is a tab for someone without Members, in Members’ place; never for the owner', () => {
    const reg = linksFor('league_registrar');
    assert.equal(showsOrgBoard({ role: 'league_registrar', orgLinks: reg, isTeamWorkspace: false }), true);
    assert.equal(orgTabs({ base: BASE, orgLinks: reg, showsBoard: true })[0].href, `${BASE}/org/board`);
    assert.equal(showsOrgBoard({ role: 'owner', orgLinks: [], isTeamWorkspace: false }), false);
    assert.equal(showsOrgBoard({ role: 'admin', orgLinks: linksFor('admin'), isTeamWorkspace: false }), false);
  });
  it('the tile hub retired: no tile array left, /org goes to the first tab', () => {
    const lib = readCode('lib/admin-kit-nav.ts');
    assert.doesNotMatch(lib, /export function orgHubDoors|ORG_HUB_DESC/);
    assert.doesNotMatch(readCode(`${A}/org/page.tsx`), /orgHubDoors|className="card|ICONS/);
  });
  it('a one-team workspace keeps its staff page as it was (the coaches portal is not 13i’s)', () => {
    assert.match(readCode('components/admin/kit/club/OrgFrame.tsx'), /const tab = isTeamWorkspace \? null : placeTabFor\(tabs, pathname\);/);
  });
});
