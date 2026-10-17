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
import { kitPrograms, kitOrgLinks, kitCalendarLink, kitSchedulesLink } from '../../lib/admin-kit-nav.ts';
import { COACH_TEAM_TOOLS } from '../../lib/coach-team-tools.ts';
import { clubSheetTiles, tournamentSheetTiles, CLUB_TILE_KEYS, TOURNAMENT_TILE_KEYS } from '../../lib/nav-tiles.ts';
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
  const order = (code: string, marks: string[], f: string) => {
    const at = marks.map(m => code.indexOf(m));
    at.forEach((i, n) => assert.ok(i > 0, `${f}: ${marks[n]} is drawn`));
    for (let n = 1; n < at.length; n++) assert.ok(at[n] > at[n - 1], `${f}: ${marks[n - 1]} comes before ${marks[n]}`);
  };

  it('the admin sheet: Notifications, the groups, You (Account, Home, Coaches Portal), then Help, Send feedback, Download app, Sign out', () => {
    order(readCode(ADMIN_SHEET), [
      'id="admin-mob-notifications"', "group('Programs'", "group('Organization'", '>You</div>',
      'id="admin-mob-account"', 'id="admin-mob-home"', 'id="admin-mob-coaches-portal"',
      'id="admin-mob-help"', 'id="admin-mob-feedback"', 'id="admin-mob-download-app"', 'id="admin-mob-logout"',
    ], ADMIN_SHEET);
  });

  it('the Premium coach sheet: Notifications, the tiles, the groups, You (Account, Home, Admin), then the foot', () => {
    order(readCode(COACH_SHEET), [
      'id="coaches-mob-notifications"', '<MoreSheetTiles', '>You</div>',
      'id="coaches-mob-account"', 'id="coaches-mob-home"', 'id="coaches-mob-back-to-admin"',
      '<span>Help</span>', 'id="coaches-mob-feedback"', 'id="coaches-mob-download-app"', 'id="coaches-mob-logout"',
    ], COACH_SHEET);
  });

  it('the free sheet’s foot: Help, Send feedback, Download app, Sign out — and the install prompt only inside the portal', () => {
    order(readCode(FREE_SHEET), ['id="free-mob-help"', 'id="free-mob-feedback"', 'id="free-mob-download-app"', 'id="free-mob-logout"'], FREE_SHEET);
    const shell = readCode(FREE_SHELL);
    // Mounted after the shell's early returns (not a portal page, the focused help), never in the layout.
    assert.ok(shell.indexOf('<InstallAppPrompt') > shell.indexOf('if (!showShell) return'));
    assert.doesNotMatch(readCode('app/coaches/layout.tsx'), /InstallAppPrompt|manifest/);
  });

  it('the admin sidebar’s foot: Help, the Coaches Portal, Public site; no Sign out or Send feedback (the account menu has them)', () => {
    const rail = readCode(ADMIN_RAIL);
    const foot = rail.slice(rail.indexOf('<div className={styles.foot}>'), rail.indexOf('<CollapseSidebarRow'));
    assert.ok(foot.indexOf('helpHref') < foot.indexOf('coachDoor.href') && foot.indexOf('coachDoor.href') < foot.indexOf('Public site'));
    assert.doesNotMatch(rail, /Sign out|<FeedbackLauncher|signOut/);
    assert.match(foot, /!siteRowShown/, 'the foot’s Public site only where no program row is it');
  });

  it('the demo sandbox never shows Sign out or Send feedback on a sheet (a shared demo user is never signed out)', () => {
    for (const [f, flag] of [[ADMIN_SHEET, 'isSandbox'], [COACH_SHEET, 'inSandbox']] as const) {
      const code = readCode(f);
      for (const id of ['-mob-feedback"', '-mob-logout"']) {
        const at = code.indexOf(id);
        assert.ok(at > 0 && code.lastIndexOf(`{!${flag} && (`, at) > code.lastIndexOf('</button>', at), `${f}: ${id} sits inside the sandbox gate`);
      }
    }
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
    assert.deepEqual([...CLUB_TILE_KEYS], ['calendar', 'schedules', 'families']);
    assert.deepEqual([...TOURNAMENT_TILE_KEYS], ['check-in', 'staff-kit', 'registrations']);
  });

  it('the club: all three or none — and none when Families is a tab on the bar', () => {
    assert.deepEqual(clubSheetTiles({ calendar: t('calendar'), schedules: t('schedules'), families: t('families'), familiesOnBar: false })?.map(x => x.key), [...CLUB_TILE_KEYS]);
    assert.equal(clubSheetTiles({ calendar: t('calendar'), schedules: null, families: t('families'), familiesOnBar: false }), null);
    assert.equal(clubSheetTiles({ calendar: t('calendar'), schedules: t('schedules'), families: null, familiesOnBar: false }), null);
    assert.equal(clubSheetTiles({ calendar: t('calendar'), schedules: t('schedules'), families: t('families'), familiesOnBar: true }), null);
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

  it('fixed club tiles leave their rows; the tournament’s stay listed in Operations', () => {
    const sheet = readCode(ADMIN_SHEET);
    assert.match(sheet, /clubTiles\s*\?\s*<MoreSheetTiles/, 'Calendar and Schedules rows only when there are no tiles');
    assert.match(sheet, /filter\(p => !\(clubTiles && p\.key === 'families'\)\)/, 'Families leaves Programs');
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
