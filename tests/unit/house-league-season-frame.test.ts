import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { filesUnder, readCode } from './_source-code.ts';
import {
  orderSeasons, seasonGroup, seasonPageAt, seasonPageHref, seasonPagesFor, seasonSegment, seasonState, SEASON_PAGES, toReviewLabel,
} from '../../lib/house-league-season.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9a, PART 2 — THE SEASON FRAME (owner 9a·2, 9a·3, Q14, Q16, Q18, Q12; words HOUSE_LEAGUE_STAGE9A_COPY.md §2, §7).
 *   1. One season, one set of words: the pill, the group, the switcher's order, the pages and who sees them.
 *   2. The frame is wired: the rail reads the seasons route's SUMMARIES (F02), the season layout mounts the phone frame,
 *      Money is the old Ledger (whose path redirects), Email families is the old Notifications.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-10-24';
/** The season's Registrations: its route is thin (Club Tier 9b-2 Part 3); the screen asks the gate and titles the page. */
const REGISTRATIONS_SCREEN = 'components/admin/kit/club/league/registrations/RegistrationsScreen.tsx';
const at = (status: string, seasonStartDate: string | null = null, seasonEndDate: string | null = null) =>
  seasonState({ status, seasonStartDate, seasonEndDate }, TODAY);

describe('1 · what is happening in a season (the pill, copy §2)', () => {
  it('status decides, dates pick the word on a running season', () => {
    assert.deepEqual(at('draft'), { label: 'Getting ready', tone: 'neutral' });
    assert.deepEqual(at('registration_open'), { label: 'Registration open', tone: 'green' });
    assert.deepEqual(at('registration_closed'), { label: 'Registration closed', tone: 'neutral' });
    assert.deepEqual(at('completed'), { label: 'Finished', tone: 'neutral' });
    assert.deepEqual(at('archived'), { label: 'Finished', tone: 'neutral' });
    assert.deepEqual(at('active', '2026-05-31', '2026-12-30'), { label: 'Playing now', tone: 'green' });
    assert.deepEqual(at('active', '2026-05-31', '2026-08-30'), { label: 'Ended Aug 30', tone: 'amber' });
    assert.equal(at('active', '2027-05-31', '2027-08-30').label, 'Starts May 31, 2027');
  });
  it('the end day itself is still playing; no dates reads as playing now', () => {
    assert.equal(at('active', '2026-05-01', TODAY).label, 'Playing now');
    assert.equal(at('active').label, 'Playing now');
  });
  it('the group is status alone, never the date (9a·1)', () => {
    assert.equal(seasonGroup({ status: 'draft' }), 'ready');
    for (const s of ['registration_open', 'registration_closed', 'active']) assert.equal(seasonGroup({ status: s }), 'running');
    for (const s of ['completed', 'archived']) assert.equal(seasonGroup({ status: s }), 'past');
  });
  it('the switcher lists live seasons first, newest first, then the finished ones (copy §7)', () => {
    const order = orderSeasons([
      { id: '2025', status: 'completed', seasonStartDate: '2025-05-31' },
      { id: '2026', status: 'active', seasonStartDate: '2026-05-31' },
      { id: '2027', status: 'registration_open', seasonStartDate: '2027-05-31' },
      { id: '2024', status: 'archived', seasonStartDate: '2024-05-31' },
    ]).map(s => s.id);
    assert.deepEqual(order, ['2027', '2026', '2025', '2024']);
  });
  it('the amber count is said in words', () => {
    assert.equal(toReviewLabel(1), '1 registration to review');
    assert.equal(toReviewLabel(3), '3 registrations to review');
  });
});

describe('1b · the season’s pages (9a·2) and who sees them (frame F)', () => {
  const labels = (a: { read: boolean; readMoney: boolean; email: boolean }) => seasonPagesFor(a).map(p => p.label);
  it('the rail order is the drawn order, Money and Email families by their ruled names', () => {
    assert.deepEqual(SEASON_PAGES.map(p => p.label),
      ['Overview', 'Registrations', 'Teams & draft', 'Schedule', 'Standings', 'Money', 'Email families']);
  });
  it('the convenor and the registrar see every page; a reader without email does not see Email families', () => {
    assert.equal(labels({ read: true, readMoney: true, email: true }).length, 7);
    assert.ok(!labels({ read: true, readMoney: true, email: false }).includes('Email families'));
  });
  it('the treasurer sees Money alone', () => {
    assert.deepEqual(labels({ read: false, readMoney: true, email: false }), ['Money']);
  });
  it('a path names its page, and the old Ledger path reads as Money', () => {
    const s = '/club/admin/house-league/seasons/abc';
    assert.equal(seasonPageAt(s), 'overview');
    assert.equal(seasonPageAt(`${s}/registrations`), 'registrations');
    assert.equal(seasonPageAt(`${s}/ledger`), 'money');
    assert.equal(seasonSegment(`${s}/teams?division=1`), 'teams');
    // A club schedule opened from the season's time window lights Schedule (Stage 13 fix-now 8: no page is left unlit).
    assert.equal(seasonSegment(`${s}/club-schedule/xyz`), 'schedule');
    assert.equal(seasonPageAt(`${s}/club-schedule/xyz`), 'schedule');
    assert.equal(seasonPageHref(s, ''), s);
    assert.equal(seasonPageHref(s, 'money'), `${s}/money`);
  });
});

describe('2 · the frame is wired', () => {
  it('the season list reads the route’s summaries (F02: the switcher never rendered)', () => {
    const hook = readCode('components/admin/kit/useHouseLeagueSeasons.ts');
    assert.match(hook, /\(d\.seasons \?\? \[\]\)\.map\(\(\{ season: s, pendingReviewCount \}\)/, 'reads the summaries’ season');
    assert.match(hook, /useSyncExternalStore\(/, 'one shared list per page, not one request per reader');
    // ⚖ 13i Session B (owner 2026-11-06): the rail lists places only — no season block, no season switcher. The season's
    // frame reads the same shared list (its title's switch) and lists the pages the gate opens (its tab row).
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    assert.doesNotMatch(rail, /useHouseLeagueSeasons|seasonPagesFor|SeasonBlock|hl-season-select/, 'the rail grew a season block again');
    const seasonFrame = readCode('components/admin/kit/club/SeasonFrame.tsx');
    assert.match(seasonFrame, /from '\.\.\/useHouseLeagueSeasons'/);
    assert.doesNotMatch(seasonFrame, /function useHouseLeagueSeasons/, 'the frame grew its own season fetch');
    // The row is `clubPlaceAt`'s (Admin header bar Phase 2), the one statement the pinned bar asks too.
    assert.match(seasonFrame, /const place = useClubPlaceAt\(\);/, 'the tab row lists the pages the gate opens');
    assert.match(readCode('components/admin/AdminBarPlace.tsx'), /const seasonAccess = useHouseLeagueAccess\(null\);/);
    assert.match(readCode('lib/admin-kit-nav.ts'), /seasonTabs\(seasonPath, seasonAccess\)/);
  });
  // ⚖ Club Tier Stage 13i (A4, owner 2026-11-06): a season is a place. Its frame draws the one header and the tab row on a
  // desk and a phone alike; the phone's season card and pill strip (`SeasonPhoneFrame`) retired, its switch moved to the title.
  it('every season page sits under the season layout, which mounts the season frame', () => {
    const layout = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/layout.tsx');
    assert.match(layout, /<SeasonFrame>/);
    assert.ok(!existsSync(join(process.cwd(), 'components/admin/kit/club/SeasonPhoneFrame.tsx')), 'the phone strip is back');
    const frame = readCode('components/admin/kit/club/SeasonFrame.tsx');
    assert.match(frame, /const place = useClubPlaceAt\(\);/, 'the tabs are the pages the gate opens');
    assert.match(readCode('lib/admin-kit-nav.ts'), /back: \{ href: league, label: 'Seasons' \}/, '"← Seasons", named by where it goes');
    assert.match(frame, /face="chevron"\s*label="Switch season"/, 'the switch is the title’s chevron, the shipped pick-one menu');
    assert.match(frame, /switcher: season && seasons\.length > 1 \? \(/, 'drawn only when there is another season');
    assert.match(frame, /seasonPageHref\(`\$\{league\}\/seasons\/\$\{id\}`, seasonSegment\(pathname\)\)/, 'a pick keeps the page you are on');
  });
  it('the switch’s chevron is a 44 px square at every width', () => {
    const css = readCode('components/shared/FilterPill.module.css');
    assert.match(css, /\.multiSelectChevronFace \{[^}]*width: var\(--tap-min, 44px\); height: var\(--tap-min, 44px\); border: none; background: none;/);
  });
  it('Money is the old Ledger, and the old path redirects', () => {
    // 9b-2 rebuilt the page; 13i: its name is its tab's (SEASON_PAGES), the same word as the words module's title.
    assert.equal(SEASON_PAGES.find(p => p.key === 'money')?.label, 'Money');
    assert.match(readCode('lib/house-league-money-words.ts'), /MONEY_PAGE_WORDS = \{[\s\S]*?title: 'Money',/);
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx'), /redirect\(`\/\$\{orgSlug\}\/admin\/house-league\/seasons\/\$\{seasonId\}\/money`\)/);
  });
  it('Email families is the composer’s one name (Q12)', () => {
    // 9d-1: the season's page is its sent history, a thin route over its screen; 13i: the tab names it.
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx'), /<SeasonEmailsScreen \/>/);
    assert.equal(SEASON_PAGES.find(p => p.key === 'notifications')?.label, 'Email families');
    assert.match(readCode('lib/families-words.ts'), /historyTitle: 'Email families',/);
    const regs = readCode(REGISTRATIONS_SCREEN);
    assert.doesNotMatch(regs, /Message registrants/);
  });
  it('one composer (9d1·1): the season’s old window, page composer and per-child loop are gone, and nothing writes the old log (9d1·3)', () => {
    assert.ok(!existsSync(join(process.cwd(), 'components/admin/kit/club/league/registrations/EmailWindow.tsx')), 'the Registrations Email window is back');
    assert.ok(!existsSync(join(process.cwd(), 'app/api/admin/house-league/seasons/[seasonId]/email/route.ts')), 'the per-child season send is back');
    assert.match(readCode(REGISTRATIONS_SCREEN), /<EmailFamiliesWindow/);
    assert.doesNotMatch(readCode('components/admin/kit/club/league/email/SeasonEmailsScreen.tsx'), /sendFamilyEmail|league_email_log/);
    assert.doesNotMatch(readCode('lib/db.ts'), /insertLeagueEmailLog|from\('league_email_log'\)\.insert/);
    assert.doesNotMatch(readCode('lib/house-league-money-words.ts'), /REGS_EMAIL_WORDS|guardian\(s\)|Sent to \$\{pluralize\(sent, 'guardian'\)\}/);
    // The old log is read in one place only: the season history's "Earlier emails" (lib/families-emails-log.ts, via
    // lib/db.ts's reader) — besides the season delete's own count.
    const readers = filesUnder('app', '.ts').concat(filesUnder('app', '.tsx'), filesUnder('lib', '.ts'), filesUnder('components', '.tsx'))
      .filter(f => /league_email_log|getLeagueEmailLog/.test(readCode(f)));
    assert.deepEqual(readers.sort(), ['lib/db.ts', 'lib/families-emails-log.ts']);
  });
  it('the season screens decide their controls through the gate, never a role list', () => {
    for (const f of [
      'app/[orgSlug]/admin/house-league/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx',
      // Email families is a thin route over its screen (9d-1).
      'components/admin/kit/club/league/email/SeasonEmailsScreen.tsx',
      // Registrations is a thin route over its screen (Club Tier 9b-2 Part 3): the gate is asked in the screen.
      REGISTRATIONS_SCREEN,
      // Teams & draft too (Club Tier 9c Part 3).
      'components/admin/kit/club/league/teams/TeamsScreen.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx',
    ]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /userRole|hasCapability\(|'league_admin'|'league_registrar'/, f);
      assert.match(code, /useHouseLeagueAccess\(/, `${f} decides what to render without the gate`);
    }
  });
});
