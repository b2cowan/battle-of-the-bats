import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder } from './_source-code.ts';
import { kitCountText } from '../../lib/admin-kit-nav.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 13a · DOORS BY PERSON (Session B — "Yours": Asks 8 and 9, owner 2026-11-06; build prompt
 * docs/projects/active/CLUB_TIER_STAGE13A_BUILD_PROMPT.md). Session A's pins live in club-stage13a-doors-guard.
 *
 *   B2  ONE waiting count for house league: `pending_review` across the club's live seasons, read by the attention summary
 *       (the Overview's waiting line) and the club brief (the rail row, the phone tab, the Overview's card). ⚠ The line could
 *       never show before: the summary asked for 'pending', a state no registration holds (found and fixed 2026-11-06).
 *       The kit's amber count shows the real number to 99, then "99+".
 *   B1  House league leads for a person whose only program it is (the nav half: nav-standard-guard's Ask 8 table); their
 *       Overview card says "No season yet" and who starts one.
 *   B3  "View site" (nav-standard-guard's Ask 9 cases).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const WAITING = 'lib/league-registrations-waiting.ts';
const SUMMARY = 'app/api/admin/attention-summary/route.ts';
const BRIEF = 'app/api/admin/club-brief/route.ts';
const PROVIDER = 'components/admin/kit/club/ClubBriefProvider.tsx';
const HUB = 'components/admin/kit/club/ClubHubKit.tsx';

describe('B2 · the one waiting count', () => {
  it('counts pending_review — never the state that does not exist — on the seasons that are not finished', () => {
    const read = readCode(WAITING);
    assert.equal((read.match(/\.eq\('status', 'pending_review'\)/g) ?? []).length, 2, 'the count and the season door');
    assert.doesNotMatch(read, /\.eq\('status', 'pending'\)/);
    assert.equal((read.match(/\.not\('league_seasons\.status', 'in', FINISHED\)/g) ?? []).length, 2);
    // The finished set is the house-league gate's own list (a finished season refuses `register`), never a second copy.
    assert.match(read, /const FINISHED = `\(\$\{FINISHED_LEAGUE_SEASON_STATUSES\.join\(','\)\}\)`;/);
    assert.doesNotMatch(read, /'completed'|'archived'/);
    const gate = readCode('lib/house-league-access.ts');
    assert.match(gate, /export const FINISHED_LEAGUE_SEASON_STATUSES = \['completed', 'archived'\] as const/);
    assert.match(gate, /return \(FINISHED_LEAGUE_SEASON_STATUSES as readonly string\[\]\)\.includes\(season\?\.status \?\? ''\);/);
    // ONE head count, by the registrations' org index: no rows come back on the hot brief.
    assert.match(read, /\.select\('id, league_seasons!inner\(status\)', \{ count: 'exact', head: true \}\)\s*\.eq\('org_id', orgId\)/);
  });

  it('the attention summary reads it (its own league count is gone) for whoever can work registrations', () => {
    const summary = readCode(SUMMARY);
    assert.doesNotMatch(summary, /from\('league_registrations'\)/, 'no second copy of the count');
    assert.doesNotMatch(summary, /from\('league_seasons'\)/);
    // One query answers the line's number and its door (the season with the oldest waiting registration).
    assert.match(summary, /leagueRegistrationsWaitingLine\(orgId\)/);
    assert.match(summary, /pendingLeagueCount: league\.count,\s*openLeagueSeasonId: league\.oldestSeasonId,/);
    assert.match(summary, /const canSeeHouseLeague = canHouseLeague\(ctx, ctx\.org, 'register'\);/);
  });

  it('the club brief carries it as counts.leagueRegistrations, only for the desk, absent on a failed read', () => {
    const brief = readCode(BRIEF);
    assert.match(brief, /if \(canHouseLeague\(ctx, org, 'register'\)\) \{\s*reads\.push\(\(async \(\) => \{\s*try \{ counts\.leagueRegistrations = await countLeagueRegistrationsWaiting\(org\.id\); \} catch/);
    assert.match(brief, /'familyChildDuplicates' \| 'leagueRegistrations', number>>/);
  });

  it('the rail row, the phone tab and the Overview card all read that key through briefProgramCount', () => {
    const provider = readCode(PROVIDER);
    assert.match(provider, /'house-league': 'leagueRegistrations',/);
    assert.match(provider, /\| 'leagueRegistrations';/);
    assert.match(readCode('components/admin/kit/AdminKitRail.tsx'), /count=\{briefProgramCount\(brief, p\.key\)\}/);
    assert.match(readCode('components/admin/kit/AdminKitBottomNav.tsx'), /return program \? briefProgramCount\(brief, program\.key\) : 0;/);
    const hub = readCode(HUB);
    assert.match(hub, /const waiting = briefProgramCount\(brief, p\.key\);/);
    // Any program with a waiting count wears the pill (one with no count answers 0), the House league card included.
    assert.match(hub, /const chip = waiting > 0\n/);
    assert.match(hub, /aria-label=\{`\$\{waiting\} waiting`\}>\{kitCountText\(waiting\)\}<\/span>/);
  });

  it('the kit count: the real number to 99, then 99+', () => {
    for (const [n, text] of [[1, '1'], [9, '9'], [10, '10'], [15, '15'], [99, '99'], [100, '99+'], [250, '99+']] as const) {
      assert.equal(kitCountText(n), text, String(n));
    }
  });

  it('no club-kit waiting pill stops at "9+" any more (chat, notifications and the coaches portal keep theirs)', () => {
    const pills = [
      'components/admin/kit/AdminKitRail.tsx', 'components/admin/kit/club/ClubHubKit.tsx',
      'components/admin/kit/club/league/registrations/RegistrationsScreen.tsx', 'components/admin/kit/club/SeasonPhoneFrame.tsx',
      'components/admin/kit/club/money/MoneyKit.tsx', 'app/[orgSlug]/admin/house-league/page.tsx',
    ];
    for (const f of pills) {
      const code = readCode(f);
      assert.doesNotMatch(code, /> 9 \? '9\+'/, f);
      assert.match(code, /kitCountText\(/, f);
    }
    const sheet = readCode('components/admin/kit/AdminKitBottomNav.tsx');
    assert.match(sheet, /className=\{styles\.tabCount\}>\{kitCountText\(t\.count!\)\}/, 'the phone bar’s program tabs');
    assert.match(sheet, /const badge = \(n: number\): string => \(n > 9 \? '9\+' : String\(n\)\);/, 'the unread badges keep their rule');
    // Nothing else in the club kit grew a private copy of the rule.
    const kitFiles = filesUnder('components/admin/kit', '.tsx');
    assert.ok(kitFiles.length > 50, 'the scan reads the kit');
    const strays = kitFiles
      .filter(f => /> 9 \? '9\+'/.test(readCode(f)))
      // The time window's count of teams is not a waiting pill; the phone bar's `badge` is the unread rule (pinned above).
      .filter(f => !f.endsWith('PracticeTellWindow.tsx') && !f.endsWith('AdminKitBottomNav.tsx'));
    assert.deepEqual(strays, []);
  });
});

describe('B1 · the House league card for a person whose only program it is', () => {
  it('says "No season yet" and, for someone who cannot start one, who does — by name, never a guess while loading', () => {
    const hub = readCode(HUB);
    // From the brief's answer only — the fallback shape reads a Club plan's running league as "not running" (/review).
    assert.match(hub, /const leagueNotRunning = !!brief && !brief\.shape\.runsHouseLeague && canOpen\('module_house_league'\);/);
    assert.match(hub, /if \(!leagueNotRunning\) return 'Seasons, registrations, the draft, schedules and standings';/);
    assert.match(hub, /const starter = canRunLeague \? 'start the first one here' : board \? seasonStarterShort\(board\) : null;\s*return `No season yet\$\{starter \? ` · \$\{starter\}` : ''\}`;/);
  });

  it('the board is read for the person who sees that line (one fetch, Session A’s hook, no second read)', () => {
    const hub = readCode(HUB);
    assert.match(hub, /const board = useBoardPeople\(\s*userRole === 'admin'\s*\|\| \(!!userRole && !LEAGUE_RUNNER_ROLES\.includes\(userRole\) && leagueNotRunning\),\s*\);/);
    assert.equal((hub.match(/useBoardPeople\(/g) ?? []).length, 1);
    assert.doesNotMatch(hub, /fetch\(`\/api\/admin\/board/);
    // Every hook above the Overview's first early return.
    const firstReturn = hub.indexOf('return <LoadingState');
    assert.ok(hub.indexOf('useBoardPeople(') < firstReturn && hub.indexOf('useClubBrief()') < firstReturn);
  });
});
