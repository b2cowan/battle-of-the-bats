import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
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
    assert.equal(seasonPageHref(s, ''), s);
    assert.equal(seasonPageHref(s, 'money'), `${s}/money`);
  });
});

describe('2 · the frame is wired', () => {
  it('the season list reads the route’s summaries (F02: the switcher never rendered)', () => {
    const hook = readCode('components/admin/kit/useHouseLeagueSeasons.ts');
    assert.match(hook, /\(d\.seasons \?\? \[\]\)\.map\(\(\{ season: s, pendingReviewCount \}\)/, 'reads the summaries’ season');
    assert.match(hook, /useSyncExternalStore\(/, 'one shared list per page, not one request per reader');
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    assert.match(rail, /from '\.\/useHouseLeagueSeasons'/);
    assert.doesNotMatch(rail, /function useHouseLeagueSeasons/, 'the rail grew its own season fetch again');
    assert.match(rail, /seasonPagesFor\(access\)/, 'the rail lists the pages the gate opens');
    assert.match(rail, /seasons\.some\(s => s\.id === seasonId\) && \(/, 'the switcher shows whenever the season is in the list');
  });
  it('every season page sits under the season layout, which mounts the phone frame', () => {
    const layout = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/layout.tsx');
    assert.match(layout, /<SeasonPhoneFrame \/>/);
    const frame = readCode('components/admin/kit/club/SeasonPhoneFrame.tsx');
    assert.match(frame, /aria-label="Switch season"/);
    assert.match(frame, /seasonPagesFor\(access\)/);
    assert.match(frame, /scrollLeft/, 'the page you are on is scrolled into view');
  });
  it('the phone frame is phone-only, its pills and switch at the 44 px floor', () => {
    const css = readCode('components/admin/kit/club/SeasonPhoneFrame.module.css');
    assert.match(css, /^\.frame \{ display: none; \}/m);
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.frame \{\s*display: block;/);
    assert.match(css, /\.pill \{[^}]*min-height: var\(--tap-min, 44px\);/);
    assert.match(css, /\.switch \{[^}]*width: var\(--tap-min, 44px\);[^}]*height: var\(--tap-min, 44px\);[^}]*border: none;[^}]*background: none;/);
  });
  it('Money is the old Ledger, and the old path redirects', () => {
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx'), /title="Money"/);
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx'), /redirect\(`\/\$\{orgSlug\}\/admin\/house-league\/seasons\/\$\{seasonId\}\/money`\)/);
  });
  it('Email families is the composer’s one name (Q12)', () => {
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx'), /title="Email families"/);
    const regs = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx');
    assert.doesNotMatch(regs, /Message registrants/);
  });
  it('the season screens decide their controls through the gate, never a role list', () => {
    for (const f of [
      'app/[orgSlug]/admin/house-league/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx',
      'app/[orgSlug]/admin/house-league/seasons/[seasonId]/standings/page.tsx',
    ]) {
      const code = readCode(f);
      assert.doesNotMatch(code, /userRole|hasCapability\(|'league_admin'|'league_registrar'/, f);
      assert.match(code, /useHouseLeagueAccess\(/, `${f} decides what to render without the gate`);
    }
  });
});
