/**
 * CLUB TIER 4e, PART 5: THE LINK CENSUS. Once a club's own web address is handed out, every link the product gives a volunteer
 * to copy or print for the club's PUBLIC pages must use it (`useClubPublicOrigin` + `publicHref`, lib/use-club-public-origin.ts).
 * The easy way to break that is a new screen that builds `${window.location.origin}/${orgSlug}/…` by hand, and a build
 * cannot tell a public link from a staff one. So every file in app/ components/ lib/ that reads `window.location.origin` or
 * `window.location.host` must be named below, in ONE of two lists, with its reason:
 *
 *   CONVERTED            hands out a link to a club's PUBLIC page: must use useClubPublicOrigin.
 *   STAYS_ON_FIELDLOGICHQ is a STAFF link (scorekeeper kit, tryout evaluator, chat invite, a coach's private calendar), a
 *                        same-origin check, or a PUBLIC page's own button that already runs on the visitor's own address.
 *
 * A new file that reads the origin is in neither list and fails here: choose which it is, then add it with a reason.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SCANNED = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);
const ORIGIN_READ = /window\.location\.(origin|host)\b/;

/** Files that hand out a link to a club's PUBLIC page. Each must contain `useClubPublicOrigin` (it may or may not still read the origin). */
const CONVERTED: Record<string, string> = {
  'lib/use-club-public-origin.ts': 'the hook itself: falls back to the address the person is on',
  'app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx': 'Admin > Rep teams > a team > Tryouts: Copy link of the team\'s tryout page',
  'app/[orgSlug]/admin/tournaments/dashboard/DraftBoard.tsx': 'Admin > Tournaments > a draft > Activate: the Public link',
  'components/admin/tournament/AfterEventParts.tsx': 'Summary and the finished board: Copy champions link / Copy standings link',
  'app/[orgSlug]/admin/tournaments/summary/page.tsx': 'Summary\'s printed foot: the tournament\'s address on paper',
  'app/[orgSlug]/admin/tournaments/branding/page.tsx': 'the Public site door ("See your public site"): the address it names and opens',
  'components/admin/TournamentSetupWizard.tsx': 'New tournament wizard: the Public link field\'s address line',
  'components/admin/TournamentCreationPreview.tsx': 'New tournament wizard: the live preview\'s address',
  'app/[orgSlug]/admin/tournaments/settings/event/page.tsx': 'Event settings: the Public URL line and its words',
  'app/[orgSlug]/admin/tournaments/settings/WebAddressWindow.tsx': 'the Web address window: the connected-state hint and asking body',
  'components/coaches/CoachPublicPageDoor.tsx': 'Coach > Team settings > Sharing: Your team\'s public page, Copy link, Open',
  'components/coaches/CoachTournamentRecordParts.tsx': 'Coach > a tournament > Share this tournament',
  'components/public/SharePageButton.tsx': 'takes `club` from the coach welcome banner; the public pages leave it off and keep the visitor\'s own origin',
};

/** Files that read the origin and must keep doing so. */
const STAYS_ON_FIELDLOGICHQ: Record<string, string> = {
  'components/shared/UnsavedChangesGuard.tsx': 'compares a clicked link\'s origin with ours; no link is handed out',
  'components/billing/PlanPanelHost.tsx': 'same-origin check on a clicked link; no link is handed out',
  'components/notifications/NotificationMessage.tsx': 'compares a notification\'s path with the current page; no link is handed out',
  'app/team/TeamSignupClient.tsx': 'same-origin guard on a sign-up redirect; no link is handed out',
  'lib/push-client.ts': 'names this site in a browser permission message',
  'app/[orgSlug]/admin/public-site/SitePreview.tsx': 'postMessage origin check between the editor and its preview',
  'app/[orgSlug]/admin/public-site/preview/PreviewClicks.tsx': 'postMessage origin for the preview frame',
  'app/[orgSlug]/admin/public-site/page.tsx': 'the Public site editor: shows the FieldLogicHQ address beside the club\'s own, which comes from useOwnAddress',
  'app/[orgSlug]/admin/tournaments/staff-kit/page.tsx': 'the scorekeeper kit: STAFF links, FieldLogicHQ by design',
  'components/rep-teams/TryoutEvaluatorsCard.tsx': 'a tryout evaluator\'s scoring link: staff, signs in on FieldLogicHQ',
  'components/chat/ChatManagePanel.tsx': 'a chat invite to the coaches portal: staff, FieldLogicHQ',
  'app/[orgSlug]/admin/tournaments/chat/page.tsx': 'a chat invite to the coaches portal: staff, FieldLogicHQ',
  'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx': 'a coach\'s private calendar file: its links go to the coaches portal, which lives on FieldLogicHQ',
  'components/public/ShareScoreButton.tsx': 'a PUBLIC page\'s share button: runs on the visitor\'s own address already',
  'components/public/TeamSubscribeButton.tsx': 'a PUBLIC page\'s calendar subscribe: runs on the visitor\'s own address already',
  'components/public/RegisterContent.tsx': 'a PUBLIC page\'s Add to calendar: runs on the visitor\'s own address already',
  'lib/team-calendar.ts': 'the calendar file a visitor downloads from a PUBLIC tournament page: the visitor\'s own address',
};

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const posix = (p: string) => p.split(sep).join('/');

function filesReadingTheOrigin(): string[] {
  const all: string[] = [];
  for (const d of SCANNED) if (existsSync(join(ROOT, d))) walk(join(ROOT, d), all);
  return all.map(f => posix(relative(ROOT, f))).filter(f => ORIGIN_READ.test(read(f))).sort();
}

describe('club share census: every link handed out for a club\'s public pages', () => {
  it('names no file twice', () => {
    for (const f of Object.keys(CONVERTED)) assert.equal(f in STAYS_ON_FIELDLOGICHQ, false, `${f} is in both lists`);
  });

  it('every file that reads window.location.origin or .host is in one list', () => {
    const unknown = filesReadingTheOrigin().filter(f => !(f in CONVERTED) && !(f in STAYS_ON_FIELDLOGICHQ));
    assert.deepEqual(
      unknown,
      [],
      `These files read window.location.origin/.host and are in neither list of tests/unit/club-share-census.test.ts:\n  ${unknown.join('\n  ')}\n` +
      'Choose: a link to a club\'s PUBLIC page that an admin or coach copies, prints or shares -> use useClubPublicOrigin + publicHref ' +
      '(lib/use-club-public-origin.ts) and add the file to CONVERTED; a staff link (scorekeeper kit, evaluator, chat invite, a private ' +
      'calendar), a same-origin check, or a public page\'s own button -> add it to STAYS_ON_FIELDLOGICHQ with the reason.',
    );
  });

  it('every CONVERTED entry exists and uses useClubPublicOrigin', () => {
    for (const f of Object.keys(CONVERTED)) {
      assert.ok(existsSync(join(ROOT, f)), `${f} is listed as CONVERTED but no longer exists`);
      assert.match(read(f), /useClubPublicOrigin/, `${f} is listed as CONVERTED but does not use useClubPublicOrigin`);
    }
  });

  it('every STAYS entry exists and still reads the origin (no stale entries)', () => {
    for (const f of Object.keys(STAYS_ON_FIELDLOGICHQ)) {
      assert.ok(existsSync(join(ROOT, f)), `${f} is listed as STAYS_ON_FIELDLOGICHQ but no longer exists; remove the entry`);
      assert.match(read(f), ORIGIN_READ, `${f} no longer reads window.location.origin/.host; remove the entry`);
    }
  });

  it('the coach welcome banner hands its share the club, so the link is spelled for the club\'s own address', () => {
    assert.match(read('components/coaches/CoachWelcomeBanner.tsx'), /<SharePageButton[\s\S]*?club=\{/);
  });
});
