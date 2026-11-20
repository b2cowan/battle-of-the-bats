import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLUB_PLACE_HELP, DASHBOARD_HELP, TOURNAMENT_PAGE_HELP, adminPageTopicAt, clubPlaceHelpKey, helpRequestFor, type HelpPlace,
  type PageHelpTopic,
} from '../../lib/admin-page-help.ts';
import {
  accountingTabs, familiesTabs, kitOrgLinks, orgTabs, repTeamsTabs, seasonTabs, teamTabs, tournamentSettingsTabs,
} from '../../lib/admin-kit-nav.ts';
import { filesUnder, readCode, readSource, sourceExists } from './_source-code.ts';

/**
 * ⚖ THE PAGE'S "?" IN THE TOURNAMENT ADMIN AND THE CLUB (navigation Phase 6b, T1–T6, owner 2026-11-13). The chrome draws it — the
 * strip between the bell and the account button, the phone bar's last control — from ONE table (`lib/admin-page-help.ts`). A wrong
 * section id fails SILENTLY (the drawer skips it and opens empty), so every id is proved here against the guide's source.
 */

const BASE = '/club/admin';

/**
 * A guide's top-level sections (6-space indent) that carry an EXPLICIT id, each with the ids of its `subtopics` block only (a
 * question's id pre-opens nothing). Only explicit ids: an id computed from a heading and its place moves when a section is added
 * above it, which is exactly how a "?" ends up opening nothing — so a screen may point only at a written-down id.
 */
function guide(module: string): Map<string, Set<string>> {
  const sections = new Map<string, Set<string>>();
  let id: string | null = null; let subs = new Set<string>(); let inSubs = false;
  const close = () => { if (id) sections.set(id, subs); };
  for (const line of readSource(`lib/help-content/${module}.tsx`).split('\n')) {
    if (/^ {4}\{\s*$/.test(line)) { close(); id = null; subs = new Set(); inSubs = false; continue; }
    let m: RegExpExecArray | null;
    if ((m = /^ {6}id: '([^']+)'/.exec(line))) id = m[1];
    else if (/^ {6}subtopics: \[/.test(line)) inSubs = true;
    else if (/^ {6}[a-zA-Z]+: /.test(line) || /^ {6}\],?$/.test(line)) inSubs = false;
    else if (inSubs && (m = /^ {10}id: '([^']+)'/.exec(line))) subs.add(m[1]);
  }
  close();
  return sections;
}

const ALL_TOPICS: [string, PageHelpTopic][] = [
  ...Object.entries(TOURNAMENT_PAGE_HELP).map(([k, v]) => [`tournament ${k}`, v] as [string, PageHelpTopic]),
  ...Object.entries(CLUB_PLACE_HELP).map(([k, v]) => [`club ${k}`, v] as [string, PageHelpTopic]),
  ...Object.entries(DASHBOARD_HELP).map(([k, v]) => [`dashboard ${k}`, v] as [string, PageHelpTopic]),
];

describe('every "?" opens a section that exists (a wrong id opens an empty panel, silently)', () => {
  const guides = new Map<string, Map<string, Set<string>>>();
  const of = (m: string) => { if (!guides.has(m)) guides.set(m, guide(m)); return guides.get(m)!; };
  for (const [name, topic] of ALL_TOPICS) {
    it(name, () => {
      const sections = of(topic.module);
      assert.ok(topic.sectionIds.length > 0, 'a topic names at least one section');
      for (const id of topic.sectionIds) assert.ok(sections.has(id), `${topic.module}: no section with the written-down id "${id}"`);
      if (topic.subtopicId) {
        assert.ok(sections.get(topic.sectionIds[0])!.has(topic.subtopicId),
          `${topic.module}: "${topic.subtopicId}" is not a sub-topic of "${topic.sectionIds[0]}" (a question's id does not pre-open anything)`);
      }
    });
  }
  it('the drawer is asked with the full guide’s door at the first section', () => {
    assert.equal(helpRequestFor(CLUB_PLACE_HELP['org/org/pdf'], BASE).fullGuideHref, '/club/admin/help/exports#pdf-settings');
    assert.equal(helpRequestFor(TOURNAMENT_PAGE_HELP.schedule, BASE).fullGuideHref, '/club/admin/help/tournaments#recipe-build-tournament-schedule');
    for (const [, topic] of ALL_TOPICS) assert.ok(sourceExists(`app/[orgSlug]/admin/help/${topic.module}/page.tsx`), `no guide page for ${topic.module}`);
  });
});

describe('a place’s tabs are all covered or none are (T3/T5: never half)', () => {
  const at = (key: string, activeId: string) => CLUB_PLACE_HELP[clubPlaceHelpKey({ key, activeId })];
  it('Rep teams, a team, a season, Accounting, Families, Organization, Permits — every tab', () => {
    for (const t of repTeamsTabs(BASE)) assert.ok(at('rep-teams', t.id), `Rep teams › ${t.label}`);
    for (const t of teamTabs(`${BASE}/rep-teams/teams/t1`)) assert.ok(at('team:t1', t.id), `a team › ${t.label}`);
    for (const t of seasonTabs(`${BASE}/house-league/seasons/s1`, { read: true, readMoney: true, email: true })) assert.ok(at('season:s1', t.id), `a season › ${t.label}`);
    for (const t of accountingTabs(BASE, { runsRepTeams: true, hasPayouts: true })) assert.ok(at('accounting', t.id), `Accounting › ${t.label}`);
    for (const t of familiesTabs(BASE)) assert.ok(at('families', t.id), `Families › ${t.label}`);
    const orgLinks = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true });
    for (const t of orgTabs({ base: BASE, orgLinks, showsBoard: true })) assert.ok(at('org', t.id), `Organization › ${t.label}`);
    assert.ok(at('permits', 'permits'));
  });
  it('the screens with no tab row, the record pages, and the club’s Overview', () => {
    for (const k of ['calendar', 'schedules', 'schedule:x', 'public-site', 'billing', 'notifications', 'hl-seasons', 'rep-rename-slugs', 'team-history:t1', 'team-year:y1', 'club-schedule:x', 'child:c1']) {
      assert.ok(at(k, ''), k);
    }
    assert.ok(adminPageTopicAt(BASE, BASE, null, true), 'the club’s Overview');
    assert.equal(adminPageTopicAt(BASE, BASE, null, false), null, 'no Overview (a tournament-only workspace): no topic');
  });
  it('Settings & access (the Tournament plans): every tab, the three reused club screens opening the CLUB’s topics', () => {
    for (const t of tournamentSettingsTabs(BASE, { members: true, payouts: true, pdf: true })) assert.ok(adminPageTopicAt(t.href, BASE, null, false), `Settings & access › ${t.label}`);
    assert.equal(adminPageTopicAt(`${BASE}/tournaments/settings/members`, BASE, null, false), CLUB_PLACE_HELP['org/org/members']);
    assert.equal(adminPageTopicAt(`${BASE}/tournaments/settings/members/audit`, BASE, null, false), CLUB_PLACE_HELP['org/org/audit']);
    assert.equal(adminPageTopicAt(`${BASE}/tournaments/settings/pdf`, BASE, null, false), CLUB_PLACE_HELP['org/org/pdf']);
  });
  it('a record over a tab opens its own section; any other address under a tab opens the tab’s; a refusal offers none', () => {
    const fam: HelpPlace = { key: 'families', activeId: 'families', tabs: familiesTabs(BASE) };
    const acc: HelpPlace = { key: 'accounting', activeId: 'teams', tabs: accountingTabs(BASE, { runsRepTeams: true, hasPayouts: false }) };
    assert.equal(adminPageTopicAt(`${BASE}/accounting/teams/abc`, BASE, acc, false)?.sectionIds[0], 'team-account');
    assert.equal(adminPageTopicAt(`${BASE}/accounting/teams`, BASE, acc, false)?.sectionIds[0], 'teams-tab');
    assert.equal(adminPageTopicAt(`${BASE}/families/p1`, BASE, fam, false)?.sectionIds[0], 'families-family-page');
    assert.equal(adminPageTopicAt(`${BASE}/families`, BASE, fam, false)?.sectionIds[0], 'families-worklist');
    const dupes: HelpPlace = { ...fam, activeId: 'duplicates' };
    assert.equal(adminPageTopicAt(`${BASE}/families/duplicates`, BASE, dupes, false)?.sectionIds[0], 'families-duplicates');
    const bringIn: HelpPlace = { key: 'rep-teams', activeId: 'rt-bring-in', tabs: repTeamsTabs(BASE) };
    assert.equal(adminPageTopicAt(`${BASE}/org/coaches-portal-links`, BASE, bringIn, false)?.sectionIds[0], 'recipe-bring-in-coach-team', 'a tab’s second address');
    assert.equal(adminPageTopicAt(`${BASE}/accounting/bank`, BASE, null, false), null, 'refused (no place): no "?" over a refusal');
  });
});

describe('every tournament admin page has a topic, or a stated reason it has none', () => {
  // Routes that are not a screen of their own (a redirect or a door), or that no section describes.
  const NONE: Record<string, string> = {
    '': 'the tournaments address is a door to the dashboard',
    'data-tools': 'a redirect to Teams (data tools retired)',
    'settings': 'the Settings & access address is a door to its first tab',
    'settings/registration-fields': 'a redirect into Event settings',
    'settings/subscription': 'Plan & billing on a Tournament plan: no tournaments-guide section describes it (recorded as open in the plan)',
    'settings/subscription/mock-portal': 'a development stand-in for the Stripe portal',
    'preview/[tournamentSlug]': 'the public site in a frame (no chrome)',
    'preview/[tournamentSlug]/[section]': 'the public site in a frame (no chrome)',
  };
  const ROOT = 'app/[orgSlug]/admin/tournaments/';
  const pages = filesUnder(ROOT, 'page.tsx').map(f => f.slice(ROOT.length).replace(/\/?page\.tsx$/, ''));
  assert.ok(pages.includes('dashboard') && pages.includes(''), 'the walk found the tournament pages');
  for (const rel of pages) {
    it(rel || '(the tournaments address)', () => {
      const topic = adminPageTopicAt(`${BASE}/tournaments/${rel}`, BASE, null, false);
      if (rel in NONE) assert.equal(topic, null, `${rel} is listed as having no topic`);
      else assert.ok(topic, `${rel} has no "?" topic and no stated reason`);
    });
  }
  it('the Tournaments list, at its one address (its old Organization address is forwarded by the proxy, 2026-11-20)', () => {
    assert.equal(adminPageTopicAt(`${BASE}/tournaments/manage`, BASE, null, false), TOURNAMENT_PAGE_HELP.manage);
  });
  it('someone the tournament admin refuses gets no tournament "?"; the dashboard with no event has none (as before the move)', () => {
    assert.equal(adminPageTopicAt(`${BASE}/tournaments/schedule`, BASE, null, false, { opens: false, hasEvent: true }), null);
    assert.equal(adminPageTopicAt(`${BASE}/tournaments/dashboard`, BASE, null, false, { opens: true, hasEvent: false }), null);
    assert.ok(adminPageTopicAt(`${BASE}/tournaments/divisions`, BASE, null, false, { opens: true, hasEvent: false }), 'other pages keep theirs');
    assert.ok(adminPageTopicAt(`${BASE}/tournaments/settings/members`, BASE, null, false, { opens: false, hasEvent: false }), 'Settings & access keeps its own gate');
  });
  it('a typed address never finds an object’s inherited member (it would crash the chrome, /review 2026-11-13)', () => {
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      assert.equal(adminPageTopicAt(`${BASE}/tournaments/${k}`, BASE, null, false), null, k);
      assert.equal(adminPageTopicAt(`${BASE}/x`, BASE, { key: k, activeId: '', tabs: [] }, false), null, k);
    }
  });
});

describe('the chrome draws the "?"; no admin page draws its own (two "?"s would be two doors to one drawer)', () => {
  it('no file under the admin pages or the admin components renders HelpButton', () => {
    const files = ['app/[orgSlug]/admin', 'components/admin'].flatMap(d => [...filesUnder(d, '.tsx'), ...filesUnder(d, '.ts')]);
    const hits = files.filter(f => /\bHelpButton\b/.test(readCode(f)));
    assert.deepEqual(hits, [], 'a page header drew its own "?" — the strip and the phone bar draw it (lib/admin-page-help.ts)');
    assert.doesNotMatch(readCode('components/admin/tournament/TournamentAdminUI.tsx'), /\bhelp\?: HelpRequest/, 'the shared header has no help prop');
  });
  it('the help panel wraps the whole chrome, once; the channel wraps the frame', () => {
    const layout = readCode('app/[orgSlug]/admin/layout.tsx');
    assert.match(layout, /<HelpDrawerProvider>\s*<AdminChrome clubShape=\{clubShape\}>\s*\{children\}\s*<\/AdminChrome>\s*<\/HelpDrawerProvider>/);
    assert.equal((layout.match(/<HelpDrawerProvider\b/g) ?? []).length, 1);
    assert.match(readCode('app/[orgSlug]/admin/AdminChrome.tsx'), /<PageHelpChannelProvider>[\s\S]*\{frame\}[\s\S]*<\/PageHelpChannelProvider>/);
  });
  it('the strip: View site · bell · "?" · account · Workspaces — and the demo shows it (outside the sandbox gate)', () => {
    const strip = readCode('components/admin/AdminTopStrip.tsx');
    const at = (s: string) => { const i = strip.indexOf(s); assert.ok(i >= 0, s); return i; };
    assert.ok(at('<FlipPill') < at('<NotificationBell') && at('<NotificationBell') < at('<AdminPageHelpDoor') && at('<AdminPageHelpDoor') < at('<AccountMenu') && at('<AccountMenu') < at('<WorkspacesPill'));
    assert.equal((strip.match(/<AdminPageHelpDoor /g) ?? []).length, 1);
    assert.ok(strip.indexOf('<AdminPageHelpDoor') < strip.indexOf('{!inSandbox &&'));
  });
  it('the phone bar: the "?" is the row’s last control, after the globe; one per width', () => {
    const bar = readCode('components/admin/AdminEventHeader.tsx');
    const row = bar.slice(bar.indexOf('className={styles.row}'), bar.indexOf('{tabbed && <HubTabBar'));
    assert.ok(row.indexOf('<FlipPill') < row.indexOf('<AdminPageHelpDoor'), 'after the globe');
    assert.match(row, /<AdminPageHelpDoor suspended=\{suspended\} className=\{styles\.help\} spacerClassName=\{styles\.helpSpacer\} \/>\s*<\/div>\s*$/, 'last in the row');
    const css = readCode('components/admin/kit/AdminKitEventHeader.module.css');
    assert.match(css, /\.help \{ flex: none;/, 'never cut or pushed off: the line’s words give way first');
    assert.match(css, /\.header\.deskBand \.row \{ display: none; \}/, 'the bar’s row is the phone’s (the strip’s above 900)');
  });
  it('a cancelled account’s page draws none, at either end; a page’s own topic wins over the address’s', () => {
    const help = readCode('components/admin/AdminPageHelp.tsx');
    assert.match(help, /if \(suspended \|\| !currentOrg\) return null;\s*if \(published\) return published;/);
    for (const f of ['components/admin/AdminTopStrip.tsx', 'components/admin/AdminEventHeader.tsx']) assert.match(readCode(f), /<AdminPageHelpDoor suspended=\{suspended\}/, f);
  });
  it('the dashboard hands its board’s topic up (its stage is its own state)', () => {
    assert.match(readCode('app/[orgSlug]/admin/tournaments/dashboard/page.tsx'), /useHandPageHelp\(!currentTournament\?\.id \? null/);
  });
});

describe('the Coaches Portal (T6·1): the off-team pages publish to the strip; the free portal never does', () => {
  it('the paid shell hosts every page for the strip; the team layout hosts its pages for the bar too', () => {
    assert.match(readCode('components/coaches/CoachesChrome.tsx'), /<CoachPageHelpProvider host="strip">\{children\}<\/CoachPageHelpProvider>/);
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/layout.tsx'), /<CoachPageHelpProvider>/);
  });
  it('an off-team page keeps its own "?" on a phone (no bar there) and hides it above 900', () => {
    assert.match(readCode('components/coaches/CoachPageHeader.tsx'), /const helpPhoneOnly = helpOnRow && helpHost === 'strip';/);
    assert.match(readCode('app/[orgSlug]/coaches/coaches.module.css'), /@media \(min-width: 901px\) \{ \.pageHeaderHelp\.pageHeaderHelpPhone \{ display: none; \} \}/);
  });
  it('the strip holds the "?"’s width on exactly the off-team pages that publish one (a list kept honest, not by hand)', () => {
    const strip = readCode('components/coaches/CoachTopStrip.tsx');
    const list = new RegExp(/const OFF_TEAM_HELP_PAGES = \/(.+)\/;/.exec(strip)![1].replace(/\\\//g, '/'));
    // An off-team page of the paid portal (not a team's, not the guide) publishes when its header — or the component it mounts — has a topic.
    const ROOT = 'app/[orgSlug]/coaches/';
    const offTeam = filesUnder(ROOT, 'page.tsx').filter(f => !f.startsWith(`${ROOT}teams/`) && !f.startsWith(`${ROOT}help`));
    for (const f of offTeam) {
      const code = readCode(f);
      const publishes = /<CoachPageHeader[\s\S]*?\bhelp=\{/.test(code) || /CoachNotificationsPage/.test(code);
      const address = `/club/coaches/${f.slice(ROOT.length).replace(/\/?page\.tsx$/, '')}`;
      assert.equal(list.test(address), publishes, `${address}: ${publishes ? 'publishes a topic but its strip does not hold the width' : 'holds a width for a topic it never publishes'}`);
    }
  });
  it('the free portal mounts no host and no channel, so its strip never draws a "?"', () => {
    assert.doesNotMatch(readCode('components/coaches/CoachPortalShell.tsx'), /CoachPageHelpProvider|CoachStripHelpProvider|PageHelpChannelProvider/);
    assert.match(readCode('components/coaches/CoachTopStrip.tsx'), /\{!wall && !free && <CoachStripHelp reserve=\{split \|\| offTeamHelp\} holdMs=\{offTeamHelp \? OFF_TEAM_HOLD_MS : undefined\} \/>\}/);
  });
  it('ONE channel for both portals (`PageHelpChannel`): one store, the id-guarded clear', () => {
    const channel = readCode('components/help/PageHelpChannel.tsx');
    assert.equal((channel.match(/useState<Entry>/g) ?? []).length, 1);
    assert.match(channel, /prev\?\.id === id \? null : prev/);
    assert.match(readCode('components/coaches/CoachPageHelpSlot.tsx'), /from '@\/components\/help\/PageHelpChannel'/);
    assert.match(readCode('components/admin/AdminPageHelp.tsx'), /from '@\/components\/help\/PageHelpChannel'/);
  });
});
