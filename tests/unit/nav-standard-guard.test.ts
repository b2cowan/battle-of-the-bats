/**
 * THE NAV STANDARD, HELD (Nav Consistency, owner 2026-10-17 — `docs/agents/design/NAV_STANDARD.md`).
 *
 * The standard is checked the way a table is checked against the table standard: a new nav row, sheet row, icon or tile
 * is compared with it. These are the parts a build can hold without a browser:
 *   1. every nav config row wears its idea's icon from the dictionary (N5) — one icon per idea, one idea per icon;
 *   2. no nav label starts "Back to" (N6: a door is named by where it goes);
 *   3. the admin and the Premium coach More sheets end with You, then Help, Send feedback, Download app, Sign out (N7);
 *   4. the tile sets and their gates (N8);
 *   5. headings are 11px in the rails and the sheet, in the sidebar's face (N1).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Gauge, Medal, Globe, Trophy, ChartGantt, IdCard, CalendarClock, Calendar, DollarSign, Megaphone, UserCheck,
} from 'lucide-react';
import { TOUR_GROUPS } from '../../components/admin/admin-nav-config.ts';
import { kitTournamentGroups } from '../../components/admin/kit/kit-tournament-groups.ts';
import { kitPrograms, kitOrgLinks, kitCalendarLink, kitSchedulesLink, clubProgramOrder } from '../../lib/admin-kit-nav.ts';
import { COACH_TEAM_TOOLS } from '../../lib/coach-team-tools.ts';
import { clubPhoneNav, tournamentSheetTiles, CLUB_BAR_KEYS, CLUB_TILE_KEYS, TOURNAMENT_TILE_KEYS } from '../../lib/nav-tiles.ts';
import { readCode } from './_source-code.ts';

const ADMIN_SHEET = 'components/admin/kit/AdminKitBottomNav.tsx';
const ADMIN_RAIL = 'components/admin/kit/AdminKitRail.tsx';
const COACH_SHEET = 'components/coaches/CoachesBottomNav.tsx';
const COACH_RAIL = 'components/coaches/CoachesSidebar.tsx';
const FREE_SHEET = 'components/coaches/CoachFreeBottomNav.tsx';
const FREE_SHELL = 'components/coaches/CoachPortalShell.tsx';

describe('N5 · the icon dictionary', () => {
  const tour = new Map(TOUR_GROUPS.flatMap(g => g.items).map(i => [i.key, i.icon]));
  it('the tournament: Dashboard a gauge, Results a medal, Public site a globe, the Tournaments list a trophy', () => {
    assert.equal(tour.get('dashboard'), Gauge);
    assert.equal(tour.get('results'), Medal);
    assert.equal(tour.get('branding'), Globe);
    assert.equal(tour.get('manage'), Trophy);
    assert.equal(tour.get('check-in'), UserCheck);
  });

  it('no two tournament rows share an icon', () => {
    const icons = [...tour.values()];
    assert.equal(new Set(icons).size, icons.length);
  });

  it('the club: Calendar, Schedules (a timeline, not Tryouts’ clipboard), Members (a card, not the portal door’s)', () => {
    const canUse = () => true;
    assert.equal(kitCalendarLink({ base: '/o/admin', canUse, isCanceled: false, tournamentTier: false })?.icon, CalendarClock);
    assert.equal(kitSchedulesLink({ base: '/o/admin', canUse, isCanceled: false, role: 'owner', planId: 'club' })?.icon, ChartGantt);
    const members = kitOrgLinks({ base: '/o/admin', role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true })
      .find(l => l.key === 'org/members');
    assert.equal(members?.icon, IdCard);
    const programs = new Map(kitPrograms({ base: '/o/admin', canUse }).map(p => [p.key, p.icon]));
    assert.equal(programs.get('tournaments'), Trophy);
    assert.equal(programs.get('public-site'), Globe);
    assert.equal(programs.get('accounting'), DollarSign);
  });

  it('the free coach’s tools: Schedule the plain calendar, Fees the dollar sign, Announcements the megaphone', () => {
    const tools = new Map(COACH_TEAM_TOOLS.map(t => [t.key, t.Icon]));
    assert.equal(tools.get('schedule'), Calendar);
    assert.equal(tools.get('fees'), DollarSign);
    assert.equal(tools.get('announcements'), Megaphone);
  });

  it('the coaches portal: Overview the grid, Season’s End an archive box, Email families an envelope', () => {
    for (const f of [COACH_RAIL, COACH_SHEET]) {
      const code = readCode(f);
      assert.match(code, /label: 'Overview'[^}]*icon: LayoutGrid|icon: LayoutGrid, label: 'Overview'/, `${f}: Overview`);
      assert.match(code, /(href|key): '\/season-end',\s*icon: Archive/, `${f}: Season's End`);
      assert.match(code, /'\/announcements',\s*icon: Mail/, `${f}: Email families`);
      assert.doesNotMatch(code, /LayoutDashboard|Megaphone/, `${f}: an icon the dictionary gave to another idea`);
    }
    assert.match(readCode(FREE_SHELL), /key: 'overview', label: 'Overview', icon: LayoutGrid/);
    assert.match(readCode(FREE_SHEET), /key: 'overview', sub: '', icon: LayoutGrid/);
  });

  it('the Coaches Portal door is the people icon in the admin’s sidebar and sheet (Check-in owns the check mark)', () => {
    for (const f of [ADMIN_RAIL, ADMIN_SHEET]) {
      assert.match(readCode(f), /<Users2 size=\{\d+\} aria-hidden \/>\s*(<span[^>]*>)?\s*Coaches Portal|<Users2 size=\{\d+\} aria-hidden \/><span>Coaches Portal/, f);
    }
    assert.doesNotMatch(readCode(ADMIN_SHEET), /UserCheck/);
  });
});

describe('N6 · a door is named by where it goes', () => {
  it('no nav label starts "Back to"', () => {
    for (const f of [ADMIN_RAIL, ADMIN_SHEET, COACH_RAIL, COACH_SHEET, FREE_SHEET, FREE_SHELL]) {
      assert.doesNotMatch(readCode(f), />\s*Back to|label: ['"]Back to/, f);
    }
    assert.match(readCode(ADMIN_SHEET), /<span>Club overview<\/span>/);
  });

  it('"Rep teams", in sentence case', () => {
    assert.equal(kitPrograms({ base: '/o/admin', canUse: () => true }).find(p => p.key === 'rep-teams')?.label, 'Rep teams');
  });

  it('the admin top strip names its portal from the Workspaces list’s own word', () => {
    assert.match(readCode('components/admin/AdminTopStrip.tsx'), /\{WORKSPACE_KIND_LABEL\.organization\}/);
  });
});

describe('N4 + N7 · one foot, one More-sheet order', () => {
  const FOOT = 'components/coaches/MoreSheetFoot.tsx';
  const order = (code: string, marks: string[], f: string) => {
    const at = marks.map(m => code.indexOf(m));
    at.forEach((i, n) => assert.ok(i > 0, `${f}: ${marks[n]} is drawn`));
    for (let n = 1; n < at.length; n++) assert.ok(at[n] > at[n - 1], `${f}: ${marks[n - 1]} comes before ${marks[n]}`);
  };

  it('ONE foot for every sheet: Help, Send feedback, Download app, Sign out — in that order', () => {
    order(readCode(FOOT), ['`${idPrefix}-help`', '`${idPrefix}-feedback`', '`${idPrefix}-download-app`', '`${idPrefix}-logout`'], FOOT);
    // Download app only where a phone browser can install the app — the one definition of install eligibility.
    assert.match(readCode(FOOT), /useSyncExternalStore\(noSubscribe, isInstallEligibleBrowser, \(\) => false\)/);
    for (const f of [ADMIN_SHEET, COACH_SHEET, FREE_SHEET]) {
      assert.match(readCode(f), /<MoreSheetFoot idPrefix="(admin|coaches|free)-mob"/, `${f} wears the one foot`);
      assert.doesNotMatch(readCode(f), /-mob-logout"|-mob-feedback"|flhq:show-install/, `${f}: no foot row of its own`);
    }
  });

  it('the admin sheet: Notifications, the groups, You (Account, Home, Coaches Portal), then the foot', () => {
    order(readCode(ADMIN_SHEET), [
      'id="admin-mob-notifications"', "group('Programs'", "group('Organization'", '>You</div>',
      'id="admin-mob-account"', 'id="admin-mob-home"', 'id="admin-mob-coaches-portal"', '<MoreSheetFoot',
    ], ADMIN_SHEET);
  });

  it('the Premium coach sheet: Notifications, the tiles, the groups, You (Account, Home, Admin), then the foot', () => {
    order(readCode(COACH_SHEET), [
      'id="coaches-mob-notifications"', '<MoreSheetTiles', '>You</div>',
      'id="coaches-mob-account"', 'id="coaches-mob-home"', 'id="coaches-mob-back-to-admin"', '<MoreSheetFoot',
    ], COACH_SHEET);
  });

  it('the free sheet: You, then the foot — and the install prompt only inside the portal', () => {
    order(readCode(FREE_SHEET), ['>You</div>', 'id="free-mob-account"', '<MoreSheetFoot'], FREE_SHEET);
    const shell = readCode(FREE_SHELL);
    // Mounted after the shell's early returns (not a portal page, the focused help), never in the layout.
    assert.ok(shell.indexOf('<InstallAppPrompt') > shell.indexOf('if (!showShell) return'));
    assert.doesNotMatch(readCode('app/coaches/layout.tsx'), /InstallAppPrompt|manifest/);
    // One prompt per page: the tournament record's live schedule no longer mounts its own.
    assert.doesNotMatch(readCode('components/coaches/CoachLiveSchedule.tsx'), /<InstallAppPrompt/);
  });

  it('the admin sidebar’s foot: Help, the Coaches Portal, Public site; no Sign out or Send feedback (the account menu has them)', () => {
    const rail = readCode(ADMIN_RAIL);
    const foot = rail.slice(rail.indexOf('<div className={styles.foot}>'), rail.indexOf('<CollapseSidebarRow'));
    assert.ok(foot.indexOf('helpHref') < foot.indexOf('coachDoor.href') && foot.indexOf('coachDoor.href') < foot.indexOf('Public site'));
    assert.doesNotMatch(rail, /Sign out|<FeedbackLauncher|signOut/);
    assert.match(foot, /!siteInNav/, 'the foot’s Public site only where no program row is it');
  });

  it('the demo sandbox never shows Sign out or Send feedback on a sheet (a shared demo user is never signed out)', () => {
    const code = readCode(FOOT);
    for (const id of ['`${idPrefix}-feedback`', '`${idPrefix}-logout`']) {
      const at = code.indexOf(id);
      assert.ok(at > 0 && code.lastIndexOf('{!inSandbox && (', at) > code.lastIndexOf('</button>', at), `${id} sits inside the sandbox gate`);
    }
  });

  it('nor Account, Home or Download app: each leads out of the demo (arriving ends it; the installed app opens outside it)', () => {
    for (const [f, flag, prefix] of [[ADMIN_SHEET, 'isSandbox', 'admin'], [COACH_SHEET, 'inSandbox', 'coaches']] as const) {
      const code = readCode(f);
      for (const id of [`id="${prefix}-mob-account"`, `id="${prefix}-mob-home"`]) {
        const at = code.indexOf(id);
        assert.ok(at > 0 && code.lastIndexOf(`{!${flag} && (`, at) > code.lastIndexOf('>You</div>', at), `${f}: ${id} sits inside the sandbox gate`);
      }
    }
    assert.match(readCode('components/coaches/MoreSheetFoot.tsx'), /\{canInstall && !inSandbox && \(/);
  });

  it('tournament Accounting is the Admin group’s last row, the same list for the sidebar and the sheet (B4)', () => {
    const groups = kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'club', accountingHref: '/o/admin/accounting?tournamentId=t' });
    const admin = groups.find(g => g.key === 'admin')!;
    assert.equal(admin.items.at(-1)?.key, 'accounting');
    assert.equal(admin.items.at(-1)?.href, '/o/admin/accounting?tournamentId=t');
    const without = kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'club', accountingHref: null });
    assert.ok(!without.some(g => g.items.some(i => i.key === 'accounting')));
    assert.doesNotMatch(readCode(ADMIN_RAIL), /label="Accounting"/, 'no lone Accounting row after the groups');
  });
});

describe('N8 · the tiles', () => {
  const t = (key: string) => ({ key, label: key, href: `/${key}` });
  it('the sets, in order', () => {
    assert.deepEqual([...CLUB_BAR_KEYS], ['calendar', 'rep-teams', 'accounting']);
    assert.deepEqual([...CLUB_TILE_KEYS], ['schedules', 'house-league', 'families']);
    assert.deepEqual([...TOURNAMENT_TILE_KEYS], ['check-in', 'staff-kit', 'registrations']);
  });

  // The club as the frame reads it: the programs it runs and this person can open, in the sidebar's order.
  const clubNav = (shape: { runsHouseLeague: boolean; hostsTournaments: boolean }, can: (c: string) => boolean, schedules = true) => {
    const order = clubProgramOrder(shape);
    return clubPhoneNav({
      calendar: t('calendar'),
      schedules: schedules ? t('schedules') : null,
      programs: kitPrograms({ base: '/o/admin', canUse: can, order: order.lead }),
      alsoOnPlan: kitPrograms({ base: '/o/admin', canUse: can, order: order.also }),
    });
  };
  const keys = (doors: { key: string }[] | null) => doors?.map(d => d.key) ?? null;
  const club = () => true; // a Club plan's owner: every program

  it('one bar for every club: Overview · Calendar · Rep teams · Accounting · More, tiles Schedules · House league · Families', () => {
    const n = clubNav({ runsHouseLeague: true, hostsTournaments: true }, club);
    assert.deepEqual(keys(n.tabs), ['calendar', 'rep-teams', 'accounting']);
    assert.deepEqual(keys(n.tiles), ['schedules', 'house-league', 'families']);
    assert.deepEqual(keys(n.morePrograms), ['public-site', 'tournaments'], 'what the bar and the tiles took never lists twice');
    assert.equal(n.schedulesRow, null, 'a fixed tile leaves its row');
  });

  it('House league is a tile only once the club runs it; its slot is filled from Programs', () => {
    const n = clubNav({ runsHouseLeague: false, hostsTournaments: true }, club);
    assert.deepEqual(keys(n.tabs), ['calendar', 'rep-teams', 'accounting']);
    assert.deepEqual(keys(n.tiles), ['schedules', 'families', 'public-site']);
    assert.deepEqual(keys(n.morePrograms), ['tournaments', 'house-league'], 'the unrun program stays a quiet row, last');
  });

  it('a door this plan cannot open is filled by the next program the club runs (League Plus: no Rep teams, Accounting, Schedules)', () => {
    const league = (c: string) => !['module_rep_teams', 'module_accounting'].includes(c);
    const n = clubNav({ runsHouseLeague: true, hostsTournaments: true }, league, false);
    assert.deepEqual(keys(n.tabs), ['calendar', 'house-league', 'families']);
    assert.equal(n.tiles, null, 'two doors left (Public site, Tournaments): none, or three — they stay rows');
    assert.deepEqual(keys(n.morePrograms), ['public-site', 'tournaments']);
  });

  it('without three for the tiles, Schedules stays a full row', () => {
    const fewer = (c: string) => ['module_rep_teams', 'module_accounting'].includes(c);
    const n = clubNav({ runsHouseLeague: false, hostsTournaments: false }, fewer);
    assert.deepEqual(keys(n.tabs), ['calendar', 'rep-teams', 'accounting']);
    assert.equal(n.tiles, null);
    assert.equal(n.schedulesRow?.key, 'schedules');
  });

  it('the tournament: game day only, and only with all three rows (none on a plan without Check-in or Staff kit)', () => {
    const ops = ['dashboard', 'registrations', 'check-in', 'staff-kit'].map(t);
    assert.deepEqual(tournamentSheetTiles('gameday', ops)?.map(x => x.key), [...TOURNAMENT_TILE_KEYS]);
    for (const phase of ['draft', 'open', 'completed', 'archived'] as const) assert.equal(tournamentSheetTiles(phase, ops), null, phase);
    assert.equal(tournamentSheetTiles('gameday', ops.filter(o => o.key !== 'staff-kit')), null);
    // From the real groups: an invite-only event (the free tournament tier) has no Check-in or Staff kit, so no tiles.
    const free = kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'tournament' })
      .find(g => g.key === 'operations')!.items.map(i => t(i.key));
    assert.equal(tournamentSheetTiles('gameday', free), null);
  });

  it('the sheet draws the one rule; the tournament tiles stay listed in Operations', () => {
    const sheet = readCode(ADMIN_SHEET);
    // A helper the tabs call while they are built must be declared above them: a later `const` crashed every club page
    // (temporal dead zone — the typecheck cannot see it inside a callback; the design pass caught it, 2026-10-17).
    assert.ok(sheet.indexOf('const programCount') > 0 && sheet.indexOf('const programCount') < sheet.indexOf('const tabs: Tab[]'));
    assert.match(sheet, /clubPhoneNav(<\w+>)?\(/);
    assert.match(sheet, /\.\.\.club\.tabs\.map\(/, 'the bar\'s slots are the rule\'s, not the first three programs');
    assert.doesNotMatch(sheet, /programs\.slice\(0, 3\)/);
    assert.doesNotMatch(sheet, /primaryKeys\.has\(i\.key\) \|\| .*tourTiles/, 'the tournament tiles are not filtered out of Operations');
  });
});

describe('N1 · one heading', () => {
  it('11px capitals in the admin rail, the coach rail and every More sheet; the sheet in the sidebar’s face', () => {
    const block = (css: string, sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)));
    const kit = readCode('components/admin/kit/AdminKitFrame.module.css');
    for (const sel of ['.label', '.groupHeader', '.subLabel']) assert.match(block(kit, sel), /font-size: var\(--type-label\)/, sel);
    assert.match(block(readCode('app/[orgSlug]/coaches/coaches.module.css'), '.sidebarGroupHeader'), /font-size: var\(--type-label\)/);
    const sheet = block(readCode('components/coaches/CoachesBottomNav.module.css'), '.dropSectionLabel');
    assert.match(sheet, /font-size: var\(--type-label\)/);
    assert.doesNotMatch(sheet, /font-family/);
  });
});

describe('N9 · one row style', () => {
  it('the free sidebar draws the paid sidebar’s row: 14px, full width, no pill, the olive tint with no bar; 14px icons', () => {
    const css = readCode('components/coaches/CoachPortalShell.module.css');
    const block = (sel: string) => css.slice(css.indexOf(`\n${sel} {`), css.indexOf('}', css.indexOf(`\n${sel} {`)));
    const row = block('.railLink');
    assert.match(row, /font-size: var\(--type-body\)/);
    assert.match(row, /padding: 0\.5rem 1\.25rem/);
    assert.doesNotMatch(row, /border-radius|font-family|font-weight/);
    assert.match(block('.railLinkActive'), /background: rgba\(var\(--blueprint-blue-rgb\), 0\.1\)[\s\S]*font-weight: 600/);
    // The bar on the page you're on lives in the folded strip only (it keeps its own look).
    const stripAt = css.indexOf(":global(html[data-sidebar='strip']) .shell");
    assert.ok(stripAt > 0);
    assert.doesNotMatch(css.slice(0, stripAt), /\.railLinkActive::before/);
    assert.doesNotMatch(readCode(FREE_SHELL).slice(readCode(FREE_SHELL).indexOf('<nav className={styles.railNav}')), /size=\{17\}/);
  });
});
