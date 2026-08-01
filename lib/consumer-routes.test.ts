/**
 * Unit tests for the chrome-gating route predicates (lib/consumer-routes).
 *
 * The two org-facing predicates are complementary and MUST NOT overlap: a path that shows
 * tournament chrome must never also show org-public chrome, or a tournament page would grow a
 * second bottom bar. That mutual exclusion is the property most worth pinning down here.
 *
 * Runs on Node's built-in runner:  `node --test lib/consumer-routes.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  showsTournamentChrome,
  showsOrgPublicChrome,
  isOrgOperatorShellPath,
  isConsumerShellPath,
} from './consumer-routes.ts';

test('D1: the org root and its public sections take the phone bar', () => {
  assert.equal(showsOrgPublicChrome('/ravens'), true);
  for (const s of ['league', 'teams', 'archives', 'news', 'schedule', 'standings', 'results', 'rules', 'register']) {
    assert.equal(showsOrgPublicChrome(`/ravens/${s}`), true, s);
  }
  // Depth doesn't change the answer — a season page is still the org's public site.
  assert.equal(showsOrgPublicChrome('/ravens/league/spring-2026/standings'), true);
  assert.equal(showsOrgPublicChrome('/ravens/archives/abc-123'), true);
});

test('D1: operator and day-of shells never take the bar — they own their chrome', () => {
  for (const s of ['admin', 'coaches', 'scorekeeper', 'check-in', 'official']) {
    assert.equal(showsOrgPublicChrome(`/ravens/${s}`), false, s);
    assert.equal(isOrgOperatorShellPath(`/ravens/${s}`), true, s);
  }
  assert.equal(showsOrgPublicChrome('/ravens/admin/tournaments/dashboard'), false);
});

test('D1: real top-level routes are never mistaken for an org', () => {
  for (const p of ['/discover', '/scores', '/pricing', '/auth/login', '/chat', '/account', '/start']) {
    assert.equal(showsOrgPublicChrome(p), false, p);
  }
  assert.equal(showsOrgPublicChrome('/'), false);
});

test('the two chrome predicates are MUTUALLY EXCLUSIVE — no path gets both bars', () => {
  const paths = [
    '/', '/ravens', '/ravens/league', '/ravens/league/spring-2026', '/ravens/archives',
    '/ravens/teams', '/ravens/admin', '/ravens/coaches', '/ravens/scorekeeper',
    '/ravens/spring-classic', '/ravens/spring-classic/schedule',
    '/ravens/admin/tournaments/preview/spring-classic',
    '/discover', '/scores', '/auth/login',
  ];
  for (const p of paths) {
    assert.ok(
      !(showsTournamentChrome(p) && showsOrgPublicChrome(p)),
      `${p} claimed BOTH tournament and org-public chrome`,
    );
  }
});

test('a tournament page keeps its own chrome, not the org treatment', () => {
  assert.equal(showsTournamentChrome('/ravens/spring-classic'), true);
  assert.equal(showsOrgPublicChrome('/ravens/spring-classic'), false);
  // The admin PREVIEW carries a tournamentSlug param but must never take public chrome.
  assert.equal(showsTournamentChrome('/ravens/admin/tournaments/preview/spring-classic'), false);
  assert.equal(showsOrgPublicChrome('/ravens/admin/tournaments/preview/spring-classic'), false);
});

test('consumer-shell routes are unaffected by the org predicates', () => {
  assert.equal(isConsumerShellPath('/discover'), true);
  assert.equal(showsOrgPublicChrome('/discover'), false);
});
