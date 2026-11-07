import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder, functionBody } from './_source-code.ts';
import { kitOrgLinks, orgTabs, showsOrgBoard } from '../../lib/admin-kit-nav.ts';
import { canOpenModule } from '../../lib/member-access.ts';
import { hasCapability } from '../../lib/roles.ts';
import { memberHome, programHomePath } from '../../lib/member-home.ts';
import { NOT_YOURS_PAGES, NOT_YOURS_WORDS, notYoursWhoSentence } from '../../lib/not-yours-words.ts';
import {
  BOARD_ROLES, boardLine, boardOwnerName, roleWithArticle, seasonCreatorsSentence, seasonStarterShort, type BoardPerson,
} from '../../lib/board-people.ts';
import { getUserPersonName } from '../../lib/user-display.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';
import type { OrgRole } from '../../lib/types.ts';
import type { User } from '@supabase/supabase-js';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 13a · DOORS BY PERSON (Session A — Asks 6 and 7, owner 2026-11-06; build prompt
 * docs/projects/active/CLUB_TIER_STAGE13A_BUILD_PROMPT.md, drawing: the Stage 13 hub tab 15)
 *
 *   A1  ONE "not yours" screen: every refusal in the club admin renders it; the old wordings are gone.
 *   A2  The Organization hub lists the doors the person holds, from the rail's own list.
 *   A3  The Overview's locked rows are an admin's only, and name the owner.
 *   A4  The empty Seasons page tells a non-runner who creates the season, by name.
 *   A5  "Start a season" / "Run a tournament" only to someone who can.
 *   A6  Accounting › Teams does not send the treasurer to Rep teams.
 *   ⚖  The board read is NAMES ONLY: no email ever leaves it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = (planId: string): EntitlementOrg => ({ planId, subscriptionStatus: 'active', enabledAddons: [], freeFloor: null } as unknown as EntitlementOrg);
const CLUB = ORG('club');
const SLUG = 'harbourtown';
const BASE = `/${SLUG}/admin`;

describe('A1 · one "not yours" screen', () => {
  // Every place the club admin refuses a member a page, and the screen it now renders.
  const SITES: [string, RegExp][] = [
    ['app/[orgSlug]/admin/families/layout.tsx', /<NotYoursScreen \{\.\.\.await notYoursScreenProps\(ctx, limited \? 'familiesLimited' : 'families'\)\} \/>/],
    ['app/[orgSlug]/admin/accounting/layout.tsx', /<NotYoursScreen \{\.\.\.await notYoursScreenProps\(ctx, 'accounting'\)\} \/>/],
    ['app/[orgSlug]/admin/rep-teams/layout.tsx', /<NotYoursScreen \{\.\.\.await notYoursScreenProps\(ctx, 'repTeams'\)\} \/>/],
    ['app/[orgSlug]/admin/public-site/page.tsx', /<NotYours page="publicSite" \/>/],
    ['app/[orgSlug]/admin/house-league/page.tsx', /if \(!access\?\.read\) return <NotYours page="houseLeague" \/>/],
    ['app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx', /<NotYours page="houseLeague" \/>/],
    ['app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx', /<NotYours page="seasonMoney" \/>/],
    ['app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx', /<NotYours page="houseLeague" \/>/],
    ['app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx', /<NotYours page="houseLeague" \/>/],
    ['components/admin/kit/club/league/registrations/RegistrationsScreen.tsx', /<NotYours page="houseLeague" \/>/],
    ['components/admin/kit/club/league/teams/TeamsScreen.tsx', /<NotYours page="houseLeague" \/>/],
    ['components/admin/kit/club/league/email/SeasonEmailsScreen.tsx', /<NotYours page="seasonEmails" \/>/],
    ['app/[orgSlug]/admin/org/settings/pdf/page.tsx', /<NotYours page="pdfSettings" \/>/],
    ['components/admin/kit/club/SettingsKit.tsx', /<NotYours page="settings" \/>/],
    ['components/admin/kit/club/BillingKit.tsx', /<NotYours page="billing" \/>/],
    ['components/admin/kit/club/AuditLogKit.tsx', /<NotYours page="auditLog" \/>/],
    ['components/admin/kit/club/MembersKit.tsx', /<NotYours page="members" title=\{pageTitle\} \/>/],
    ['app/[orgSlug]/admin/schedules/page.tsx', /<NotYours page="schedules" \/>/],
    ['app/[orgSlug]/admin/calendar/page.tsx', /<NotYours page="calendar" \/>/],
    ['app/[orgSlug]/admin/org/page.tsx', /<NotYours page="organization" \/>/],
  ];

  for (const [file, screen] of SITES) {
    it(`${file} renders the shared screen`, () => assert.match(readCode(file), screen));
  }

  it('a server layout renders the screen in place of its CHILDREN (the frame and nav still show), and still goes home on a plan that lacks the page', () => {
    for (const [file, cap] of [
      ['app/[orgSlug]/admin/families/layout.tsx', 'module_families'],
      ['app/[orgSlug]/admin/accounting/layout.tsx', 'module_accounting'],
      ['app/[orgSlug]/admin/rep-teams/layout.tsx', 'module_rep_teams'],
    ] as const) {
      const code = readCode(file);
      assert.match(code, new RegExp(`!hasModuleEntitlement\\(ctx\\.org, '${cap}'\\)`), `${file}: the plan's own answer stays a return home`);
      assert.match(code, /return <NotYoursScreen /, `${file}: the screen is RETURNED by the layout, instead of its children`);
    }
  });

  it('the old wordings are gone from the club admin (the words file is their one home now)', () => {
    const files = [...filesUnder('app/[orgSlug]/admin', '.tsx'), ...filesUnder('components/admin', '.tsx')];
    const OLD = [/Access restricted/, /don[’']t have access/, /don&apos;t have access/, /isn’t turned on for you/, /Owner only/];
    const hits = files.flatMap(f => OLD.filter(re => re.test(readCode(f))).map(re => `${f}: ${re}`));
    assert.deepEqual(hits, []);
    for (const css of ['app/[orgSlug]/admin/house-league/house-league.module.css', 'app/[orgSlug]/admin/rep-teams/rep-teams.module.css', 'app/[orgSlug]/admin/public-site/public-site.module.css']) {
      assert.doesNotMatch(readCode(css), /\.accessDenied/, `${css}: the duplicated refusal block went with the refusals`);
    }
  });

  it('the who-sentence names the owner, says the reader’s role in words, and never says an admin can grant access', () => {
    assert.equal(notYoursWhoSentence('grant', 'Morgan Ellis', 'treasurer'), 'Morgan Ellis (owner) can give a treasurer access.');
    assert.equal(notYoursWhoSentence('grant', null, 'admin'), 'The club’s owner can give an admin access.');
    assert.equal(notYoursWhoSentence('grant', 'Morgan Ellis', null), 'Morgan Ellis (owner) can give you access.');
    assert.equal(notYoursWhoSentence('owner', 'Morgan Ellis', 'admin'), 'Only Morgan Ellis, the owner, opens it.');
    assert.equal(notYoursWhoSentence('owner', null, 'admin'), 'Only the club’s owner opens it.');
    assert.equal(notYoursWhoSentence('ownerOrAdmin', 'Morgan Ellis', 'treasurer'), 'Morgan Ellis (owner) and the club’s admins open it.');
    assert.equal(notYoursWhoSentence('ownerOrAdmin', null, 'treasurer'), 'The club’s owner and its admins open it.');
    assert.equal(roleWithArticle('league_registrar'), 'a league registrar');
    for (const [page, w] of Object.entries(NOT_YOURS_PAGES)) {
      if (w.who !== 'grant') continue;
      assert.doesNotMatch(notYoursWhoSentence(w.who, 'Morgan Ellis', 'treasurer'), /admin/, `${page}: only the owner changes what a member opens`);
    }
  });

  it('the door home is the landing sign-in resolves to: one rule, shared', () => {
    assert.deepEqual(memberHome(SLUG, 'treasurer', CLUB), { href: `${BASE}/accounting`, label: 'Accounting' });
    assert.deepEqual(memberHome(SLUG, 'league_admin', CLUB), { href: `${BASE}/house-league`, label: 'House league' });
    assert.deepEqual(memberHome(SLUG, 'league_registrar', CLUB), { href: `${BASE}/house-league`, label: 'House league' });
    assert.deepEqual(memberHome(SLUG, 'admin', CLUB), { href: BASE, label: 'Overview' });
    // The door never opens the page just refused: a treasurer refused Accounting goes to the Overview, not to Accounting.
    assert.deepEqual(memberHome(SLUG, 'treasurer', CLUB, 'accounting'), { href: BASE, label: 'Overview' });
    assert.deepEqual(memberHome(SLUG, 'league_registrar', CLUB, 'houseLeague'), { href: BASE, label: 'Overview' });
    assert.deepEqual(memberHome(SLUG, 'league_registrar', CLUB, 'seasonMoney'), { href: `${BASE}/house-league`, label: 'House league' });
    assert.equal(notYoursWhoSentence('wholeClub', 'Morgan Ellis', 'coach'), 'It opens only for people who aren’t limited to certain teams.');
    assert.equal(programHomePath(SLUG, 'treasurer', ORG('league')), null, 'a League plan has no Accounting: the treasurer starts on the hub');
    assert.match(functionBody(readCode('lib/user-contexts.ts'), 'getDestinationForMembership'), /programHomePath\(slug, role, entitlementOrg\)/);
  });
});

describe('⚖ the board by name is NAMES ONLY', () => {
  it('a person with no name on their account is never shown by their email', () => {
    const user = (meta: Record<string, string>) => ({ email: 'dana@example.com', user_metadata: meta } as unknown as User);
    assert.equal(getUserPersonName(user({ full_name: 'Dana Kowalski' })), 'Dana Kowalski');
    assert.equal(getUserPersonName(user({ first_name: 'Dana', last_name: 'K' })), 'Dana K');
    assert.equal(getUserPersonName(user({})), '');
  });

  it('the read selects no contact field and the route hands back name and role only', () => {
    const read = functionBody(readCode('lib/member-names.ts'), 'boardNames');
    assert.match(read, /\.select\('user_id, role, display_name, invited_at'\)/);
    assert.doesNotMatch(read, /getUserDisplayName|email|phone/, 'the email fallback is getUserDisplayName’s: never here');
    assert.match(readCode('app/api/admin/board/route.ts'), /people\.map\(p => \(\{ name: p\.name, role: p\.role \}\)\)/);
    assert.deepEqual([...BOARD_ROLES], ['owner', 'admin', 'league_admin', 'league_registrar', 'treasurer']);
  });

  it('the sentences built from it', () => {
    const board: BoardPerson[] = [
      { name: 'Morgan Ellis', role: 'owner' }, { name: 'Dana Kowalski', role: 'admin' },
      { name: 'Jules Moreau', role: 'league_admin' }, { name: 'Avery Chen', role: 'treasurer' },
    ];
    assert.equal(boardOwnerName(board), 'Morgan Ellis');
    assert.equal(boardOwnerName([]), null);
    assert.equal(boardLine(board), 'Morgan Ellis (owner), Dana Kowalski (admin), Jules Moreau (league admin), Avery Chen (treasurer)');
    assert.equal(seasonCreatorsSentence(board),
      'Jules Moreau (league admin), Morgan Ellis (owner) or Dana Kowalski (admin) creates the season. Registrations arrive here once it exists.');
    assert.equal(seasonCreatorsSentence([]), 'The club’s owner, an admin or a league admin creates the season. Registrations arrive here once it exists.');
    assert.equal(seasonStarterShort(board), 'Jules Moreau or Morgan Ellis starts one');
    assert.doesNotMatch(seasonCreatorsSentence(board), /Avery Chen/, 'the treasurer does not start a season');
  });
});

// ⚖ Club Tier Stage 13i (Ask 3 = A, Ask 4 = B, owner 2026-11-06): the tile hub RETIRED. 13a's rule — one list of doors per
// person, a tile only where its page opens — is now Organization's TAB list (`orgTabs` over the same `kitOrgLinks`), minus
// Tournaments (a program), Plan & billing (the foot) and the Coaches Portal (the foot). The board by name (R1) moved to a
// "The board" tab for anyone without Members (owner 2026-11-06). `/org` goes to the first tab; none is the "not yours" screen.
describe('A2 · Organization lists the doors the person holds, as its tabs', () => {
  // The person, as the rail sees them: their role's defaults on a Club plan.
  const tabsFor = (role: OrgRole, planId = 'club') => {
    const org = ORG(planId);
    const member = { role, capabilities: null };
    const canSeeMembers = (role === 'owner' || hasCapability(role, null, 'module_members')) && canOpenModule(member, org, 'module_members');
    const orgLinks = kitOrgLinks({ base: BASE, role, isCanceled: false, canSeeMembers, hasVenueLibrary: true });
    return orgTabs({ base: BASE, orgLinks, showsBoard: showsOrgBoard({ role, orgLinks, isTeamWorkspace: false }) }).map(t => t.label);
  };

  it('role × tab, Club plan', () => {
    assert.deepEqual(tabsFor('owner'), ['Members', 'Audit log', 'Settings', 'Venue library', 'PDF settings'],
      'F-O1-15: the owner keeps the Audit log; no Tournaments, no Plan & billing (Ask 4 B: the foot)');
    assert.deepEqual(tabsFor('admin'), ['Members', 'Venue library', 'PDF settings']);
    assert.deepEqual(tabsFor('league_admin'), ['Members', 'Venue library'], 'F-NAV-7: no Tournaments into a failing tournament admin');
    assert.deepEqual(tabsFor('league_registrar'), ['The board', 'Venue library'], 'F-NAV-8: no Members tab that refuses them; the board in its place (R1)');
    assert.deepEqual(tabsFor('treasurer'), ['Members', 'Venue library']);
  });

  it('the door reads the shared list, sends the person to their first tab, and never lists a tile by hand', () => {
    const door = readCode('app/[orgSlug]/admin/org/page.tsx');
    assert.match(door, /useOrgTabs\(\)/);
    assert.match(door, /tabs\[0\]\?\.href/);
    assert.match(door, /router\.replace\(first\)/);
    assert.match(door, /<NotYours page="organization" \/>/);
    assert.doesNotMatch(door, /Manage org members|label: 'Tournaments'|label: 'PDF settings'|className="card/, 'no tile left');
    assert.doesNotMatch(door, /Lock\b|rowLocked/, 'locked tiles are never added');
  });

  it('the board tab says names and roles only', () => {
    const board = readCode('app/[orgSlug]/admin/org/board/page.tsx');
    assert.match(board, /useBoardPeople\(/);
    assert.match(board, /boardInRankOrder\(people\)/);
    assert.doesNotMatch(board, /email|phone/i, 'names only (R1)');
  });
});

describe('A3 · the Overview’s Organization section', () => {
  const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');

  it('locked rows are an admin’s only; the section shows only when it holds a door, or the reader is an admin', () => {
    assert.match(hub, /const showsLockedRows = userRole === 'admin' && currentOrg\.planId !== 'tournament';/);
    assert.match(hub, /\{!isOwner && \(canSeeMembers \|\| showsLockedRows\) && \(/);
    assert.match(hub, /\{showsLockedRows && \(canManageBilling \? \['Settings'\] : \['Plan & billing', 'Settings'\]\)\.map\(label => \(\s*<div key=\{label\}/);
  });

  it('the chip names the owner, from the words file', () => {
    assert.match(hub, /NOT_YOURS_WORDS\.askChip\(boardOwnerName\(board\)\)/);
    assert.match(hub, /aria-label=\{NOT_YOURS_WORDS\.lockedRowLabel\(label\)\}/);
    assert.equal(NOT_YOURS_WORDS.askChip('Morgan Ellis'), 'Ask Morgan Ellis');
    assert.equal(NOT_YOURS_WORDS.askChip(null), 'Ask the owner');
    assert.equal(NOT_YOURS_WORDS.lockedRowLabel('Plan & billing'), 'Plan & billing, the owner’s');
  });
});

describe('A4 · A5 · A6 — said only to someone who can', () => {
  it('A4: the empty Seasons page branches on `run`', () => {
    const page = readCode('app/[orgSlug]/admin/house-league/page.tsx');
    assert.match(page, /\{canRun \? 'Create one to get started\.' : seasonCreatorsSentence\(board\)\}/);
    assert.match(page, /useBoardPeople\(!!access\?\.read && !canRun && !loading && summaries\.length === 0\)/);
  });

  it('A5: "Start a season" is gated on the league’s runners, "Run a tournament" on create_tournaments', () => {
    const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');
    assert.match(hub, /const canRunLeague = LEAGUE_RUNNER_ROLES\.includes\(userRole\);/);
    assert.match(hub, /\{canRunLeague \? <Link href=\{p\.href\} className=\{ck\.link\}>Start a season<\/Link> : board \? seasonStarterShort\(board\) : null\}/);
    assert.match(hub, /const canCreateTournaments = hasCapability\(userRole, userCapabilities, 'create_tournaments'\);/);
    assert.match(hub, /\{canCreateTournaments \? <Link href=\{p\.href\} className=\{ck\.link\}>Run a tournament<\/Link> : NOT_YOURS_WORDS\.tournamentStarterShort\}/);
  });

  it('A6: Accounting › Teams names who adds a team for someone without Rep teams', () => {
    const page = readCode('app/[orgSlug]/admin/accounting/teams/page.tsx');
    assert.match(page, /canOpen\('module_rep_teams'\) \? NOT_YOURS_WORDS\.teamsEmpty : NOT_YOURS_WORDS\.teamsEmptyNoRepTeams/);
  });
});
