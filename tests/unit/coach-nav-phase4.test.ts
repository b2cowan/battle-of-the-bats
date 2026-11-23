import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode } from './_source-code.ts';
import { coachDeskTitleAt, coachDrillBack, coachNavGroupsFor } from '../../lib/coach-team-nav.ts';
import { coachStripFacts, stripRecord } from '../../lib/coach-strip-facts.ts';
import { coachOffTeamPageName } from '../../lib/coach-off-team-pages.ts';
import { teamTile, teamTileColor, teamCrestUrl, teamSwitchGroups } from '../../lib/coach-team-tile.ts';
import { mastheadSeasonLabel } from '../../lib/coach-season-label.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';
import { crestBytes, crestVersion } from '../../lib/team-crest.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * NAVIGATION PHASE 4 — THE COACHES PORTAL ON A COMPUTER (owner rulings E6, E7, E9, E10, E11, E14 and the gate's C1–C9,
 * 2026-11-11; drawings tab 17). What this pins:
 *   1. the strip names the page from the sidebar's own list, or one level down carries the way back (C4, C8);
 *   2. the strip's right end says the team bar's words by its rules (E7, C2, C5, C9);
 *   3. the team's tile is crest → colour → initials, from stored facts (C7), and its list is live teams then
 *      "No live season" (C6);
 *   4. the chrome: one split strip (team pages only — never a wall, never the free portal), one <h1> per width, the team
 *      bar the phone's only, the season gate untouched.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const BASE = '/falcons/coaches/teams/t1';
const none = new URLSearchParams();
const head = resolveCoachCapabilities('head_coach');
const liveRows = coachNavGroupsFor(head, false).flatMap(g => g.items);
const closedRows = coachNavGroupsFor(head, true).flatMap(g => g.items);

describe('1. the strip names the page (E6, C4, C8)', () => {
  it('the sidebar’s lit row, in the sidebar’s words', () => {
    assert.deepEqual(coachDeskTitleAt(BASE, none, BASE, liveRows, null), { kind: 'name', name: 'Overview' });
    assert.deepEqual(coachDeskTitleAt(`${BASE}/roster`, none, BASE, liveRows, null), { kind: 'name', name: 'Roster' });
    // C8: "Staff" and "Settings", never the pages' longer titles.
    assert.deepEqual(coachDeskTitleAt(`${BASE}/staff`, none, BASE, liveRows, null), { kind: 'name', name: 'Staff' });
    assert.deepEqual(coachDeskTitleAt(`${BASE}/settings`, none, BASE, liveRows, null), { kind: 'name', name: 'Settings' });
    assert.deepEqual(coachDeskTitleAt(`${BASE}/accounting`, new URLSearchParams('tab=dues'), BASE, liveRows, null), { kind: 'name', name: 'Money' });
  });

  it('a page with no row keeps its own title (null)', () => {
    // (The game page was this case until navigation Phase 5 — F7 put it one level down from the Schedule.)
    assert.equal(coachDeskTitleAt(`${BASE}/attendance`, none, BASE, liveRows, null), null);
    // A live team's season page is not in its sidebar.
    assert.equal(coachDeskTitleAt(`${BASE}/season-end`, none, BASE, liveRows, null), null);
  });

  it('C8: the closed-season page names the SEASON, from the team list — never "Season’s End" then a year', () => {
    assert.deepEqual(coachDeskTitleAt(`${BASE}/season-end`, none, BASE, closedRows, '2025 season'), { kind: 'name', name: '2025 season' });
    assert.equal(mastheadSeasonLabel('Falcons 14U 2025', 'Falcons 14U', 2025), '2025 season');
    assert.equal(mastheadSeasonLabel('Fall Ball 2025', 'Falcons 14U', 2025), 'Fall Ball 2025');
  });

  it('C4: one level down, the way back in today’s words, from one table', () => {
    const back = (p: string, q = '') => coachDrillBack(`${BASE}${p}`, new URLSearchParams(q), BASE);
    // `here` is the KIND of place the bar says until the page names the record (owner 2026-11-12) — never the list left behind.
    assert.deepEqual(back('/history/opponents/hawks'), { href: `${BASE}/history?section=scouting`, label: 'All opponents', here: 'Opponent' });
    assert.deepEqual(back('/roster/p1'), { href: `${BASE}/roster`, label: 'Roster', here: 'Player' });
    assert.deepEqual(back('/lineups/templates/x'), { href: `${BASE}/lineups?section=templates`, label: 'Templates', here: 'Template' });
    assert.deepEqual(back('/lineups/e1'), { href: `${BASE}/lineups`, label: 'All lineups', here: 'Lineup' });
    assert.deepEqual(back('/practice/templates/x'), { href: `${BASE}/practice?section=templates`, label: 'Templates', here: 'Template' });
    assert.deepEqual(back('/practice/circuits/x'), { href: `${BASE}/practice?section=circuits`, label: 'Circuits', here: 'Circuit' });
    assert.deepEqual(back('/practice/e1'), { href: `${BASE}/practice`, label: 'Practice plans', here: 'Practice' });
    assert.deepEqual(back('/development/sessions/s1'), { href: `${BASE}/development?section=sessions`, label: 'Skills & goals', here: 'Session' });
    assert.deepEqual(back('/tournaments/r1'), { href: `${BASE}/tournaments`, label: 'Tournaments', here: 'Tournament' });
    assert.deepEqual(back('/tryouts/history'), { href: `${BASE}/tryouts`, label: 'Tryouts', here: 'Tryout history' });
    assert.equal(back('/roster/p1/development/handout')?.label, 'Player');
    assert.equal(back('/roster/p1/development/handout')?.here, 'Handout');
    assert.deepEqual(back('/history/development/practices/e1', 'from=season-end&year=2025'), { href: `${BASE}/season-end?year=2025`, label: "Season's End", here: 'Practice' });
    assert.equal(back('/history/development/practices/e1')?.label, 'Practice review');
    // A drill-in opened from somewhere goes back there, named as today; a foreign or unnamed return is ignored.
    assert.deepEqual(back('/lineups/e1', `return=${encodeURIComponent(`${BASE}/schedule?event=e1`)}`), { href: `${BASE}/schedule?event=e1`, label: 'The game', here: 'Lineup' });
    assert.deepEqual(back('/roster/p1', 'return=%2Fother%2Fcoaches'), { href: `${BASE}/roster`, label: 'Roster', here: 'Player' });
    // Hub pages and the run mode are not one level down.
    for (const p of ['/practice', '/practice/e1/run', '/lineups', '/history', '/roster']) assert.equal(back(p), null, p);
    // …and the drill-in wins over the lit row it sits under.
    assert.equal(coachDeskTitleAt(`${BASE}/roster/p1`, none, BASE, liveRows, null)?.kind, 'back');
  });
});

describe('2. the strip’s right end (E7, C2, C5, C9)', () => {
  const season = { programYearId: 'y', programYearName: '2026', programYearYear: 2026, programYearStatus: 'active' };
  const base = { teamName: 'Falcons', orgName: 'Lakeshore Minor Baseball', isTeamWorkspace: false, season, seasonFinished: false, records: {}, status: null, statusYearId: 'y', gameDayConsole: null };
  const at = (_daysAway: number): { id: string; eventType: string; isScrimmage: boolean; startsAt: string; opponent: string | null; name: string } =>
    ({ id: 'e', eventType: 'game', isScrimmage: false, startsAt: '2026-11-12T23:30:00Z', opponent: 'Hawks', name: '' });

  it('a record drops a zero tie and a 0-0 record shows nothing', () => {
    assert.equal(stripRecord({ w: 5, l: 0, t: 0 }), '5-0');
    assert.equal(stripRecord({ w: 3, l: 2, t: 1 }), '3-2-1');
    assert.equal(stripRecord({ w: 0, l: 0, t: 0 }), null);
  });

  it('C9: a club’s team leads with the club; a standalone team names none; C5: a draft season says so', () => {
    assert.equal(coachStripFacts(base).club, 'Lakeshore Minor Baseball');
    assert.equal(coachStripFacts({ ...base, isTeamWorkspace: true }).club, null);
    assert.equal(coachStripFacts(base).season, '2026 season');
    assert.equal(coachStripFacts({ ...base, season: { ...season, programYearStatus: 'draft' } }).state, 'Draft');
  });

  it('game day: the chip replaces the record; no opponent and no event named → the chip alone; the bench only for that game', () => {
    const gd = { kind: 'game_day' as const, event: at(0), daysAway: 0 };
    const f = coachStripFacts({ ...base, records: { y: { w: 3, l: 2, t: 0 } }, status: gd, gameDayConsole: { eventId: 'e', href: '/bench' } });
    assert.equal(f.record, null);
    assert.equal(f.status?.kind, 'game_day');
    assert.equal(f.status?.kind === 'game_day' && f.status.who, 'Hawks');
    assert.equal(f.status?.kind === 'game_day' && f.status.benchHref, '/bench');
    const bare = coachStripFacts({ ...base, status: { ...gd, event: { ...at(0), opponent: null } }, gameDayConsole: { eventId: 'other', href: '/x' } });
    assert.equal(bare.status?.kind === 'game_day' && bare.status.who, null);
    assert.equal(bare.status?.kind === 'game_day' && bare.status.benchHref, null);
  });

  it('a status for another season says nothing; between seasons: Complete and the final record', () => {
    const gd = { kind: 'next' as const, event: at(3), daysAway: 3 };
    assert.equal(coachStripFacts({ ...base, status: gd, statusYearId: 'other' }).status, null);
    const done = coachStripFacts({ ...base, seasonFinished: true, records: { y: { w: 14, l: 9, t: 2 } } });
    assert.deepEqual(done.status, { kind: 'complete', finalRecord: '14-9-2' });
    assert.equal(done.record, null);
  });

  it('C2: the quiet words give way at 1100; the Game day chip and the bench stay', () => {
    const css = readCode('components/coaches/CoachTopStrip.module.css');
    const narrow = css.slice(css.indexOf('@media (max-width: 1100px)'));
    assert.match(narrow, /\.factsQuiet \{ display: none; \}/);
    assert.doesNotMatch(narrow.slice(0, narrow.indexOf('}\n}')), /\.factsGameDay\s*\{[^}]*display: none/);
    // An end with nothing left but the quiet words hides, hairline and all; one holding the pair stays.
    assert.match(narrow, /\.teamFacts:not\(:has\(\.factsGameDay\)\) \{ display: none; \}/);
    const facts = readCode('components/coaches/CoachStripFacts.tsx');
    assert.match(facts, /<span className=\{styles\.factsGameDay\}>\s*<span className=\{coach\.teamHeaderToday\}>Game day<\/span>/, 'the coach’s own olive chip');
    assert.match(facts, /<span className=\{coach\.seasonChip\}>Complete<\/span>/, 'the coach’s own amber chip');
  });
});

describe('3. the team’s tile and list (E10, C6, C7)', () => {
  it('crest → colour → initials; a crest past 2 : 1 falls to the colour', () => {
    const team = { teamId: 't1', teamColor: '#2C6E49', teamCrestAspect: 1, teamCrestVersion: 'abc' };
    assert.deepEqual(teamTile('falcons', team).source, '/api/coaches/falcons/teams/t1/crest?v=abc');
    assert.equal(teamTile('falcons', { ...team, teamCrestAspect: 3 }).source, null);
    assert.equal(teamTile('falcons', { ...team, teamCrestAspect: 3 }).color?.fill, '#2C6E49');
    assert.equal(teamTile('falcons', { ...team, teamCrestVersion: null }).source, null, 'a crest whose shape is not recorded yet');
    assert.equal(teamCrestUrl('o', 't', null), null);
  });

  it('a light colour gets dark initials; a colour that is not #rrggbb paints nothing', () => {
    assert.equal(teamTileColor('#2C6E49')?.ink, '#FFFFFF');
    assert.notEqual(teamTileColor('#F2D25C')?.ink, '#FFFFFF');
    assert.equal(teamTileColor('green'), null);
    assert.equal(teamTileColor(null), null);
  });

  it('the list: live teams, then "No live season" opening its season’s page; the current one marked', () => {
    const t = (id: string, year: number) => ({ teamId: id, teamName: id.toUpperCase(), teamColor: null, programYearName: String(year), programYearYear: year, programYearStatus: 'active' });
    const groups = teamSwitchGroups('falcons', [t('a', 2026), { ...t('b', 2026), programYearStatus: 'draft' }], [t('c', 2025)], 'a');
    assert.deepEqual(teamSwitchGroups('falcons', [t('a', 2026)], [], 'a').map(g => g.label), ['Your teams'], 'no empty group');
    assert.deepEqual(groups.map(g => g.label), ['Your teams', 'No live season']);
    assert.deepEqual(groups[0].rows.map(r => [r.href, r.line, r.current]), [
      ['/falcons/coaches/teams/a', '2026 season', true],
      ['/falcons/coaches/teams/b', '2026 season · Draft', false],
    ]);
    assert.deepEqual(groups[1].rows.map(r => [r.href, r.line]), [['/falcons/coaches/teams/c/season-end', '2025 season']]);
  });

  it('C7: the crest’s shape and version are the server’s, recorded on save; the picture is served at its own address', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/pdf-settings/route.ts');
    assert.match(route, /Object\.assign\(look, await crestFacts\(normalized\)\);/);
    assert.doesNotMatch(route, /body\.logoAspect|body\.logoVersion/, 'never taken from the request');
    const crest = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/crest/route.ts');
    assert.match(crest, /getEntitledTeamMembership\(ctx\.org, teamId, ctx\.user\.id\)/, 'any coach on the team, as the settings it is kept in');
    assert.match(crest, /'Cache-Control': 'private, max-age=31536000, immutable'/);
    assert.match(crest, /select\('org_id, crest:pdf_settings->>logoDataUrl'\)/, 'the picture alone, never the rest of the team');
    // The team list carries two small facts, never the picture.
    const db = readCode('lib/db.ts');
    assert.match(db, /crest_aspect:pdf_settings->logoAspect, crest_version:pdf_settings->>logoVersion/);
    assert.doesNotMatch(db.slice(db.indexOf('async function loadCoachAssignmentRows'), db.indexOf('export async function getCoachingAssignmentsForUser')), /pdf_settings[ ,)]/);
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    assert.deepEqual(crestBytes(`data:image/png;base64,${png.toString('base64')}`), png);
    assert.equal(crestBytes('https://x/y.png'), null);
    assert.equal(crestVersion(png).length, 12);
  });
});

describe('4. the chrome', () => {
  const strip = readCode('components/coaches/CoachTopStrip.tsx');
  it('one split strip, on a team’s pages and the three off-team pages that name themselves, with "Coach" over the sidebar', () => {
    // ⚖ UPDATED IN THE OPEN (owner 2026-11-23, reversing "off a team keeps today's strip" for Notifications, Plan & billing, Join a club).
    assert.match(strip, /const split = !wall && !free && \(!!teamId \|\| !!offTeam\);/);
    assert.match(strip, /<span className=\{`\$\{styles\.stripLabel\} \$\{own\.lcellWord\}`\}>Coach<\/span>/);
    // The shared left cell reads the sidebar's one width variable; the coach shell hands it its own (240, 64 folded).
    assert.match(readCode('app/[orgSlug]/coaches/coaches.module.css'), /--admin-rail-w: var\(--coach-sidebar-w\);/);
    // The free portal mounts the same strip with `free`, so it can never split.
    assert.match(readCode('components/coaches/CoachPortalShell.tsx'), /<CoachTopStrip free \/>/);
  });

  it('one level down the strip names the RECORD too (owner 2026-11-11, reversing C4): the header portals its title + chips into the strip’s slot and hides its own copy above 900', () => {
    const strip = readCode('components/coaches/CoachTopStrip.tsx');
    const header = readCode('components/coaches/CoachPageHeader.tsx');
    const css = readCode('app/[orgSlug]/coaches/coaches.module.css');
    // The strip draws an EMPTY slot after the arrow; it never learns the record's name itself (a drill-in loads it after the page opens).
    assert.match(strip, /<div ref=\{recordSlot\} className=\{styles\.recordSlot\} \/>/);
    assert.match(readCode('components/coaches/CoachDeskTitle.tsx'), /recordSlot: HTMLElement \| null/);
    // The header draws into it only once the slot exists, so a server paint or a free portal keeps the page's own title.
    // ⚖ ANY title, not text only, and only ABOVE 900 (navigation Phase 5b, 2026-11-12: one home per width — the bar holds it at 900
    // and below — so a title that is a control, the player's name ▾, is one element; this replaced "a text title only").
    // The width rule lives with the chrome (`useCoachRecordSlot`, the mirror of the bar's `useCoachBarNameSlot`), not in the header.
    assert.match(header, /const recordSlot = useCoachRecordSlot\(\);/);
    assert.match(header, /const deskRecord = deskDrill && !!recordSlot;/);
    assert.match(readCode('components/coaches/CoachBarName.tsx'), /export function useCoachRecordSlot\(\)[\s\S]{0,200}?return !phone && desk\?\.kind === 'back' \? recordSlot : null;/);
    assert.ok(!/typeof title === 'string';/.test(header.replace(/typeof title === 'string' && !title\.trim\(\)/, '')), 'no text-only rule left');
    assert.match(header, /\{deskRecord && !untitled && createPortal\(\s*<>\s*<h1 className=\{strip\.name\}>\{title\}<\/h1>/);
    assert.match(header, /data-desk-drill=\{deskDrill \? \(deskRecord \|\| untitled \? \(deskRowHas \? 'record' : 'empty'\) : ''\) : undefined\}/);
    // ⚖ The hairline belongs to the strip (it stands beside "Player" while the record loads, A5), not to the portaled title.
    assert.match(strip, /<span className=\{own\.backRule\} aria-hidden \/>[\s\S]{0,40}?<div ref=\{recordSlot\}/);
    // ⚖ A5: until the page names its record, the strip says the KIND of place — the phone bar's rule, on a computer.
    assert.match(strip, /<span className=\{`\$\{own\.name\} \$\{styles\.recordHere\}`\}>\{title\.here\}<\/span>/);
    assert.match(readCode('components/coaches/CoachTopStrip.module.css'), /\.recordSlot:not\(:empty\) \+ \.recordHere \{ display: none; \}/);
    assert.ok(!/backRule/.test(header.replace(/pageHeaderBackRule/g, '')), 'the header no longer portals the strip’s rule');
    assert.match(css, /@media \(min-width: 901px\) \{[\s\S]*\.pageHeaderStd\[data-desk-drill='record'\] \.pageHeaderLeft \{ display: none; \}/);
    assert.match(css, /\.pageHeaderStd\[data-desk-drill='empty'\] \{ display: none; \}/);
  });

  it('exactly one <h1> per width: the strip’s for a named page, the record’s (portaled by its header) one level down; the paper title hides at EVERY width (Phase 5)', () => {
    assert.equal(strip.match(/<h1\b/g)?.length, 1);
    assert.match(strip, /\{pageName && <h1/);
    const css = readCode('app/[orgSlug]/coaches/coaches.module.css');
    // ⚖ Navigation Phase 5 (E8, owner 2026-11-12): the phone's bar names the page too, so the paper title's hide is no longer a
    // computer's only — it stands OUTSIDE any width block, directly before the phone's empty-row rule.
    assert.match(css, /\n\.pageHeaderStd\[data-desk-named\] \{ justify-content: flex-end; \}\n\.pageHeaderStd\[data-desk-named\] \.pageHeaderLeft \{ display: none; \}\n/);
    assert.match(css, /@media \(max-width: 900px\) \{\n  \.pageHeaderStd\[data-phone-row='empty'\] \{ display: none; \}/);
    const header = readCode('components/coaches/CoachPageHeader.tsx');
    assert.match(header, /data-desk-named=\{deskNamed \? \(deskRowHas \? 'actions' : 'empty'\) : undefined\}/,'Phase 4b (owner 2026-11-12): a HOSTED "?" is the strip’s, so it no longer keeps a row alone; an unhosted page still does');
  });

  it('the team bar is the phone’s only: it draws nothing above 900, and the phone keeps its switch sheet', () => {
    const css = readCode('app/[orgSlug]/coaches/coaches.module.css');
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.teamHeader \{ display: none; \}\s*\}/);
    const bar = readCode('components/coaches/CoachTeamHeader.tsx');
    // Teams counted as the sidebar's cell counts them (Phase 5): a team mid-rollover is one team, and offers no switcher of one.
    assert.match(bar, /const canSwitch = isPhoneNav && desk\?\.kind !== 'back' && coachTeamRoster\(assignments, closedAssignments\)\.teamCount > 1;/);
    assert.match(bar, /<CoachTeamSwitchSheet/);
  });

  it('the strip’s facts come from the server, through the coaches layout’s slot, from the bar’s own loader', () => {
    assert.match(readCode('app/[orgSlug]/coaches/@stripFacts/default.tsx'), /return null;/);
    const slot = readCode('app/[orgSlug]/coaches/@stripFacts/teams/[teamId]/layout.tsx');
    assert.match(slot, /await loadCoachTeamMasthead\(orgSlug, teamId\)\.catch\(\(\) => null\)/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/layout.tsx'), /await loadCoachTeamMasthead\(orgSlug, teamId\)/);
    assert.match(readCode('lib/coach-team-masthead.ts'), /export const loadCoachTeamMasthead = cache\(/);
    assert.match(readCode('app/[orgSlug]/coaches/layout.tsx'), /stripFacts=\{stripFacts\}/);
    assert.doesNotMatch(readCode('components/coaches/CoachStripFacts.tsx'), /useEffect|fetch\(/, 'never fetched after load');
  });

  it('every coaches page off a team has an empty page in the slot, so leaving a team replaces its facts (/review: stale facts on return)', () => {
    for (const dir of ['', 'notifications/', 'billing/', 'help/', 'link-org/']) {
      assert.ok(existsSync(`app/[orgSlug]/coaches/${dir}page.tsx`), `${dir || 'the hub'} is a coaches page`);
      assert.match(readCode(`app/[orgSlug]/coaches/@stripFacts/${dir}page.tsx`), /return null;/, `${dir || 'the hub'}: the slot has its own page, not just the default`);
    }
  });

  it('the three off-team pages name themselves in the strip (owner 2026-11-23): Notifications, Plan & billing, Join a club — and nothing else', () => {
    assert.equal(coachOffTeamPageName('/falcons/coaches/billing'), 'Plan & billing');
    assert.equal(coachOffTeamPageName('/falcons/coaches/notifications/'), 'Notifications');
    assert.equal(coachOffTeamPageName('/falcons/coaches/link-org'), 'Join a club');
    // The hub, a team's pages (the team's own rule names those), the guide and a look-alike are not on the list.
    for (const p of ['/falcons/coaches', '/falcons/coaches/help', '/falcons/coaches/teams/t1/billing', '/falcons/coaches/teams/t1', '/falcons/billing']) {
      assert.equal(coachOffTeamPageName(p), null, p);
    }
    const strip = readCode('components/coaches/CoachTopStrip.tsx');
    // The name is the strip's <h1> (still one per width), and an off-team page carries NO team facts — not even a stale slot's.
    assert.match(strip, /const pageName = title\?\.kind === 'name' \? title\.name : !title \? offTeam : null;/);
    assert.match(strip, /\{pageName && <h1 className=\{`\$\{own\.name\} \$\{own\.pageName\}`\}>\{pageName\}<\/h1>\}/);
    assert.match(strip, /\{!offTeam && facts\}/);
    // A computer's only: a phone has no bar on these pages, so the page's own title is hidden above 900 alone, and the desk title
    // (which hides it at every width) is never set for them.
    assert.match(readCode('components/coaches/CoachDeskTitle.tsx'), /title: null, recordSlot: null, barSlot: null, offTeam: coachOffTeamPageName\(pathname\)/);
    assert.match(readCode('components/coaches/CoachPageHeader.tsx'), /data-desk-offteam=\{deskOffTeam \? \(deskRowHas \? 'actions' : 'empty'\) : undefined\}/);
    const css = readCode('app/[orgSlug]/coaches/coaches.module.css');
    assert.match(css, /@media \(min-width: 901px\) \{[\s\S]*?\.pageHeaderStd\[data-desk-offteam\] \.pageHeaderLeft \{ display: none; \}[\s\S]*?\.pageHeaderStd\[data-desk-offteam='empty'\] \{ display: none; \}/);
  });

  it('the season gate is untouched: decided on the server, from the shared resolvers', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/layout.tsx'), /seasonFinished=\{!live && !!closed\}/);
    assert.match(readCode('lib/coach-team-masthead.ts'), /const live = resolveLiveSeason\(assignments, teamId\);\s*const closed = resolveClosedSeason\(assignments, closedForTeam, teamId\);/);
  });

  it('the strip and the sidebar read one answer (the strip’s rows are the sidebar’s)', () => {
    assert.match(readCode('components/coaches/CoachDeskTitle.tsx'), /coachNavGroupsFor\(\(live \?\? closed\)\?\.capabilities, finished\)/);
    assert.match(readCode('components/coaches/CoachesSidebar.tsx'), /coachNavGroupsFor\(workingSeason\.capabilities, seasonFinished\)/);
  });
});
