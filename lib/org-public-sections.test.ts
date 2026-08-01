/**
 * Unit tests for the org public-site section crumb (Nav Unification Stage E.3).
 *
 * Runs on Node's built-in runner (see flip-twins.test.ts):  `node --test lib/org-public-sections.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orgSectionCrumb } from './org-public-sections.ts';

test('the org root keeps today\'s plain identity — no crumb', () => {
  assert.equal(orgSectionCrumb('/ravens', 'ravens'), null);
  assert.equal(orgSectionCrumb('/ravens/', 'ravens'), null);
});

test('the three named sections each get their label', () => {
  assert.equal(orgSectionCrumb('/ravens/league', 'ravens'), 'League');
  assert.equal(orgSectionCrumb('/ravens/teams', 'ravens'), 'Teams');
  assert.equal(orgSectionCrumb('/ravens/archives', 'ravens'), 'Archives');
});

test('depth does not change the label — the trail stays the same word all the way down', () => {
  assert.equal(orgSectionCrumb('/ravens/league/spring-2026', 'ravens'), 'League');
  assert.equal(orgSectionCrumb('/ravens/league/spring-2026/standings', 'ravens'), 'League');
  assert.equal(orgSectionCrumb('/ravens/teams/u14-select', 'ravens'), 'Teams');
  assert.equal(orgSectionCrumb('/ravens/archives/abc-123', 'ravens'), 'Archives');
});

test('unnamed sections render nothing rather than guessing a label', () => {
  // The tournament-shim routes and anything added later must fall through silently.
  for (const section of ['schedule', 'standings', 'results', 'rules', 'register', 'news', 'official']) {
    assert.equal(orgSectionCrumb(`/ravens/${section}`, 'ravens'), null, section);
  }
});

test('a path outside this org never produces a crumb', () => {
  assert.equal(orgSectionCrumb('/storm/league', 'ravens'), null);
  // Prefix orgs must not match: `/ravens-north/league` is not inside `ravens`.
  assert.equal(orgSectionCrumb('/ravens-north/league', 'ravens'), null);
  assert.equal(orgSectionCrumb('/discover', 'ravens'), null);
});

test('a missing org slug is a no-op, never a crash', () => {
  assert.equal(orgSectionCrumb('/ravens/league', ''), null);
});

test('query and hash fragments do not defeat the section match', () => {
  assert.equal(orgSectionCrumb('/ravens/league?season=2026', 'ravens'), 'League');
  assert.equal(orgSectionCrumb('/ravens/archives#top', 'ravens'), 'Archives');
});
