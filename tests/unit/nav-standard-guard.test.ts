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
import {
  kitPrograms, kitOrgLinks, kitCalendarLink, kitSchedulesLink, clubProgramOrder, personClubShape, clubSheetGroups, orgTabs,
  placeGroupHeading, showsOrgBoard,
} from '../../lib/admin-kit-nav.ts';
import { CLUB_BASE, CLUB_PEOPLE, clubNavFor, RUNS_BOTH, RUNS_NEITHER } from './_club-people.ts';
import { hasCapability } from '../../lib/roles.ts';
import type { OrgRole } from '../../lib/types.ts';
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

  // 13i (N7): the groups are the sidebar's places, drawn from one list (Programs · Also on your plan · Club).
  it('the admin sheet: Notifications, the places, You (Account, Home, Coaches Portal, Plan & billing), then the foot', () => {
    order(readCode(ADMIN_SHEET), [
      'id="admin-mob-notifications"', '{sheetGroups.map(group)}', '>You</div>',
      'id="admin-mob-account"', 'id="admin-mob-home"', 'id="admin-mob-coaches-portal"', 'id="admin-mob-billing"', '<MoreSheetFoot',
    ], ADMIN_SHEET);
  });

  it('the Premium coach sheet: Notifications, the tiles, the groups, You (Account, Home, Plan & billing, Admin), then the foot', () => {
    order(readCode(COACH_SHEET), [
      'id="coaches-mob-notifications"', '<MoreSheetTiles', '>You</div>',
      'id="coaches-mob-account"', 'id="coaches-mob-home"', 'id="coaches-mob-billing"', 'id="coaches-mob-tournaments"', 'id="coaches-mob-back-to-admin"', '<MoreSheetFoot',
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

  it('the admin sidebar’s foot: Help, the Coaches Portal; no Public site, Sign out or Send feedback', () => {
    const rail = readCode(ADMIN_RAIL);
    const foot = rail.slice(rail.indexOf('<div className={styles.foot}>'), rail.indexOf('<CollapseSidebarRow'));
    order(foot, ['billingLink.href', 'helpHref', 'coachDoor.href'], ADMIN_RAIL);
    assert.match(foot, /billingLink && <Link/);
    assert.match(foot, /styles\.footItem/);
    assert.match(foot, /<billingLink\.icon size=\{14\}/);
    assert.match(readCode(ADMIN_SHEET), /billingLink && <Link[\s\S]*?<billingLink\.icon size=\{17\}/);
    const hook = readCode('components/admin/kit/useAdminKitNav.ts');
    assert.match(hook, /const billingLink = kitBillingLink\(\{ orgSlug, planId: currentOrg\?\.planId, accountKind: currentOrg\?\.accountKind, role: userRole, capabilities: userCapabilities, isSandbox \}\)/);
    assert.ok(foot.indexOf('helpHref') < foot.indexOf('coachDoor.href'));
    assert.doesNotMatch(rail, /Sign out|<FeedbackLauncher|signOut/);
  });

  // ⚖ Ask 9 = A (Club Tier Stage 13a, owner 2026-11-06): the header's "View site" pill is on every screen the sidebar and the
  // phone bar are (a cancelled club, which has no pill, has neither nav), so the foot door and the More sheet's door of the
  // same name were the same place twice (F-NAV-5). Neither nav draws a live-site door; the pill names the club case.
  it('Ask 9: no "Public site" foot door or More-sheet door; the admin pill reads "View site" on club AND tournament screens (a draft keeps "Preview site")', () => {
    const rail = readCode(ADMIN_RAIL);
    const foot = rail.slice(rail.indexOf('<div className={styles.foot}>'), rail.indexOf('<CollapseSidebarRow'));
    assert.doesNotMatch(foot, /Public site<\/span>/);
    const sheet = readCode(ADMIN_SHEET);
    assert.doesNotMatch(sheet, /admin-mob-view-site|useAdminFlip|siteInNav/);
    assert.doesNotMatch(readCode('components/admin/kit/useAdminKitNav.ts'), /siteInNav/);
    const flip = readCode('lib/use-admin-flip.ts');
    assert.match(flip, /label: 'View site' \}/);
    assert.doesNotMatch(flip, /onTournamentScreen \? 'Public site'/);
    // A live event's twin is renamed in the admin shell only; a draft keeps "Preview site".
    assert.match(flip, /resolution\.target\.label === 'Public site'[\s\S]*?label: 'View site'/);
    assert.match(flip, /const toPublic = viewSiteWord\(resolveFlip\(/);
    // flip-twins' own words are untouched (the coach / scorekeeper doors still read them).
    assert.match(readCode('lib/flip-twins.ts'), /return ctx\.isDraft \? 'Preview site' : 'Public site';/);
  });

  it('Ask 9: the live site’s way back shows its word at a desk, the bare icon at 900 px and under', () => {
    const bar = readCode('components/public/ClubBar.tsx');
    assert.match(bar, /\{door && <FlipPill resolution=\{door\} variant="inline" className=/, 'not mounted compact: the word shows where there is room');
    assert.doesNotMatch(bar, /<FlipPill[^>]*\bcompact\b/);
    const css = readCode('components/shared/FlipPill.module.css');
    // The pill's own narrow rule hides the word and draws the 44 px icon door, the club look included.
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.inline \.labelText \{ display: none; \}\s*\.inline \.pill,\s*\.clubLook \.pill \{/);
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

  it('a tournament’s nav has no Accounting row: the club’s book is not an event page (owner 2026-10-30)', () => {
    const groups = kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'club' });
    assert.ok(!groups.some(g => g.items.some(i => i.key === 'accounting')));
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

  // ⚖ Ask 8 = A (Club Tier Stage 13a, the one exception to N10): a person whose ONLY program is house league sees it lead
  // before the club has a season. The table is role × season state on a Club plan (every program carried), through the
  // same two calls the hook makes (`personClubShape` → `clubProgramOrder`).
  // The person's nav through the hook's own calls (`_club-people.ts`, the 13i guards' fixture too).
  const personNav = (shape: { runsHouseLeague: boolean; hostsTournaments: boolean }, role: OrgRole, extra: Record<string, boolean> | null = null) => {
    const n = clubNavFor(role, shape, extra);
    return { lead: n.programs.map(p => p.key), also: n.alsoOnPlan.map(p => p.key), bar: keys(n.phone.tabs) };
  };
  const noSeason = { runsHouseLeague: false, hostsTournaments: false };
  const running = { runsHouseLeague: true, hostsTournaments: false };

  it('Ask 8: the league admin and the registrar, no season yet → House league leads the rail and takes the bar’s third slot', () => {
    for (const role of ['league_admin', 'league_registrar'] as const) {
      const n = personNav(noSeason, role);
      assert.deepEqual(n.lead, ['house-league'], role);
      assert.deepEqual(n.also, [], `${role}: not "Also on your plan"`);
      assert.deepEqual(n.bar, ['calendar', 'house-league'], `${role}: Overview · Calendar · House league · More`);
      assert.deepEqual(personNav(running, role).lead, ['house-league'], `${role}, season running: unchanged`);
    }
  });

  it('Ask 8: the owner, an admin and the treasurer with no season → unchanged (N10 as written)', () => {
    for (const role of ['owner', 'admin'] as const) {
      const n = personNav(noSeason, role);
      assert.ok(!n.lead.includes('house-league') && n.also.includes('house-league'), `${role}: House league stays a quiet row`);
      assert.deepEqual(n.bar, ['calendar', 'rep-teams', 'accounting'], role);
    }
    const treasurer = personNav(noSeason, 'treasurer');
    assert.deepEqual(treasurer.lead, ['accounting']);
    assert.ok(!treasurer.also.includes('house-league'), 'the treasurer cannot open house league at all');
  });

  it('Ask 8 is decided by what the person OPENS, never the role’s name', () => {
    // A league admin who was also given Accounting opens two programs: N10 as written.
    const both = personNav(noSeason, 'league_admin', { module_accounting: true });
    assert.deepEqual(both.lead, ['accounting']);
    assert.deepEqual(both.also, ['house-league']);
    // The club's own shape is never rewritten: the Members role guide reads it as a fact about the org.
    assert.deepEqual(personClubShape(noSeason, c => hasCapability('owner', null, c)), noSeason);
    const hook = readCode('components/admin/kit/useAdminKitNav.ts');
    assert.match(hook, /const order = clubProgramOrder\(personClubShape\(club\.shape, canUse\)\);/, 'one place, the hook every surface shares');
    assert.match(readCode('components/admin/kit/club/MembersKit.tsx'), /runsHouseLeague=\{shape\.runsHouseLeague\}/);
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

/**
 * ⚖ CLUB TIER STAGE 13i (owner 2026-11-06: Asks 1–3 and 5–9 = A, Ask 4 = B): places in the sidebar, pages on the page.
 * N2, N3, N4, N7 and N11 as rewritten that day, and the phone parity the build owes (B7): for each of the five people the
 * sidebar's places = the bar's tabs + the tiles + the sheet's rows, nothing twice, nothing missing — and the bar and the
 * tiles are IDENTICAL to before 13i (the snapshot below was taken from the pre-Session-B code, 2026-11-06).
 */
describe('13i · places in the sidebar, pages on the page', () => {
  const rail = readCode(ADMIN_RAIL);
  const clubBody = rail.slice(rail.indexOf('export default function AdminKitRail('), rail.indexOf('function TournamentRail('));
  const tourBody = rail.slice(rail.indexOf('function TournamentRail('));

  it('N2: no club heading folds; a heading only over two or more rows (a lone row keeps the space, no word)', () => {
    assert.doesNotMatch(clubBody, /groupHeader|aria-expanded|toggleGroup/, 'a club heading folds');
    assert.match(clubBody, /const heading = placeGroupHeading\(group\);/);
    assert.match(clubBody, /<div className=\{styles\.label\} aria-hidden=\{heading \? undefined : true\}>\{heading \?\? '\\u00a0'\}<\/div>/, 'the lone row’s heading space');
    // The tournament's own groups still fold (Ask 8: tournament mode unchanged).
    assert.match(tourBody, /onClick=\{\(\) => toggleGroup\(g\.key\)\}/);
  });

  it('N3: no chevron anywhere in the club body; the tournament group headings keep theirs', () => {
    assert.doesNotMatch(clubBody, /<ChevronRight|styles\.chevron|opensPages/);
    assert.match(tourBody, /<ChevronRight size=\{12\} className=\{`\$\{styles\.chevron\}\$\{open \? ` \$\{styles\.chevronOpen\}` : ''\}`\} aria-hidden \/>/);
  });

  it('N4: the foot as built, unchanged by 13i — Plan & billing first (its fee pill on it), Help, the other portal, then Collapse', () => {
    const foot = rail.slice(rail.indexOf('<div className={styles.foot}>'), rail.indexOf('<SidebarStripTip'));
    const at = ['billingLink.href', 'feeAlert && <WaitingCount', 'helpHref', 'coachDoor.href', '<CollapseSidebarRow'].map(m => foot.indexOf(m));
    at.forEach((i, n) => assert.ok(i > 0 && (n === 0 || i > at[n - 1]), `foot order at ${n}`));
  });

  it('N7: the club sheet lists the sidebar’s places once — Organization one row — and You keeps Plan & billing', () => {
    const sheet = readCode(ADMIN_SHEET);
    assert.match(sheet, /const sheetGroups: SheetGroup\[\] = clubSheetGroups\(placeGroups, club\)\.map\(g => \(\{ \.\.\.g, heading: placeGroupHeading\(g\) \}\)\);/);
    assert.match(sheet, /\{sheetGroups\.map\(group\)\}/);
    assert.doesNotMatch(sheet, /orgPageLink|\.\.\.orgLinks|group\('Organization'/, 'Organization’s pages are sheet rows again');
    const you = sheet.slice(sheet.indexOf('>You</div>'), sheet.indexOf('<MoreSheetFoot'));
    assert.match(you, /id="admin-mob-billing"[\s\S]*feeAlert && <span className=\{`\$\{styles\.dropCount\} \$\{feeTone\}`\}/, 'Plan & billing and its fee pill left You');
  });

  it('N11: every place’s tab row is the shared HubTabBar, through one frame; Organization’s tabs never include Plan & billing', () => {
    const frame = readCode('components/admin/kit/club/PlaceFrame.tsx');
    assert.match(frame, /import HubTabBar, \{ type HubTab \} from '@\/components\/shared\/HubTabBar';/);
    for (const f of ['RepTeamsFrame', 'TeamFrame', 'SeasonFrame', 'OrgFrame']) {
      assert.match(readCode(`components/admin/kit/club/${f}.tsx`), /<PlaceFrame\b/, f);
    }
    for (const [, role] of CLUB_PEOPLE) {
      const { orgLinks } = clubNavFor(role, RUNS_BOTH);
      const tabs = orgTabs({ base: CLUB_BASE, orgLinks, showsBoard: showsOrgBoard({ role, orgLinks, isTeamWorkspace: false }) });
      assert.ok(!tabs.some(t => t.href.includes('/org/billing')), `${role}: Plan & billing is an Organization tab`);
    }
  });

  // The snapshot: each person's bar (after Overview) and tiles, read from the code BEFORE Session B changed anything.
  const BEFORE: Record<string, { bar: string[]; tiles: string[] | null }> = {
    'both owner': { bar: ['calendar', 'rep-teams', 'accounting'], tiles: ['schedules', 'house-league', 'families'] },
    'both admin': { bar: ['calendar', 'rep-teams', 'accounting'], tiles: ['schedules', 'house-league', 'public-site'] },
    'both league admin': { bar: ['calendar', 'house-league'], tiles: null },
    'both registrar': { bar: ['calendar', 'house-league'], tiles: null },
    'both treasurer': { bar: ['accounting'], tiles: null },
    'neither owner': { bar: ['calendar', 'rep-teams', 'accounting'], tiles: ['schedules', 'families', 'public-site'] },
    'neither admin': { bar: ['calendar', 'rep-teams', 'accounting'], tiles: null },
    'neither league admin': { bar: ['calendar', 'house-league'], tiles: null },
    'neither registrar': { bar: ['calendar', 'house-league'], tiles: null },
    'neither treasurer': { bar: ['accounting'], tiles: null },
  };

  it('the phone parity: the sidebar’s places = the bar + the tiles + the sheet, nothing twice, nothing missing; the bar and tiles as before 13i', () => {
    for (const [shapeName, shape] of [['both', RUNS_BOTH], ['neither', RUNS_NEITHER]] as const) {
      for (const [name, role] of CLUB_PEOPLE) {
        const who = `${shapeName} ${name}`;
        const n = clubNavFor(role, shape);
        const bar = n.phone.tabs.map(d => d.key);
        const tiles = n.phone.tiles?.map(d => d.key) ?? null;
        assert.deepEqual({ bar, tiles }, BEFORE[who], `${who}: the bar or the tiles moved`);
        const sheet = [
          ...(n.phone.schedulesRow ? [n.phone.schedulesRow.key] : []),
          ...clubSheetGroups(n.groups, n.phone).flatMap(g => g.places.map(p => p.key)),
        ];
        const phone = ['overview', ...bar, ...(tiles ?? []), ...sheet];
        assert.equal(new Set(phone).size, phone.length, `${who}: a place is reached twice on a phone (${phone.join(', ')})`);
        assert.deepEqual([...phone].sort(), [...n.sidebarRows].sort(), `${who}: the phone and the sidebar reach different places`);
      }
    }
  });

  it('the owner’s sheet: the place rows are Tournaments (no heading), then Club: Public site, Organization — 19 entries become 14', () => {
    const n = clubNavFor('owner', RUNS_BOTH);
    const groups = clubSheetGroups(n.groups, n.phone);
    assert.deepEqual(groups.map(g => [placeGroupHeading(g), g.places.map(p => p.key)]), [[null, ['tournaments']], ['Club', ['public-site', 'org']]]);
    // Notifications 1 + tiles 3 + places 3 + You (Account, Home, Plan & billing) 3 + the foot (Help, Send feedback,
    // Download app, Sign out) 4 = 14; before 13i the Organization group added its five pages and the Programs group was one.
    assert.equal(1 + n.phone.tiles!.length + groups.flatMap(g => g.places).length + 3 + 4, 14);
  });
});
