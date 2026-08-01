/**
 * Unit tests for the org public-site section crumb (Nav Unification Stage E.3).
 *
 * Runs on Node's built-in runner (see flip-twins.test.ts):  `node --test lib/org-public-sections.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orgSectionCrumb,
  orgSectionsFor,
  activeOrgSectionKey,
  ORG_SECTION_TABS_MIN,
} from './org-public-sections.ts';

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

// ── Stage F: the section table drives BOTH the crumb and the tab row ────────────────────────────

test('orgSectionsFor: Home is always present; the rest follow availability', () => {
  assert.deepEqual(
    orgSectionsFor({ league: true, archives: true }).map(s => s.key),
    ['', 'league', 'archives'],
  );
  assert.deepEqual(orgSectionsFor({ league: true, archives: false }).map(s => s.key), ['', 'league']);
  assert.deepEqual(orgSectionsFor({ league: false, archives: true }).map(s => s.key), ['', 'archives']);
});

test('orgSectionsFor: an org with nothing else falls below the render floor', () => {
  const sections = orgSectionsFor({ league: false, archives: false });
  assert.deepEqual(sections.map(s => s.key), ['']);
  // A row holding only "Home" is chrome that says nothing — the gate is what stops it rendering.
  assert.ok(sections.length < ORG_SECTION_TABS_MIN);
});

test('activeOrgSectionKey: the org root is the Home tab, sections match at any depth', () => {
  assert.equal(activeOrgSectionKey('/ravens', 'ravens'), '');
  assert.equal(activeOrgSectionKey('/ravens/league', 'ravens'), 'league');
  assert.equal(activeOrgSectionKey('/ravens/league/spring-2026/standings', 'ravens'), 'league');
  assert.equal(activeOrgSectionKey('/ravens/archives/abc-123', 'ravens'), 'archives');
});

test('activeOrgSectionKey: an unnamed section highlights NOTHING rather than lying', () => {
  // A visitor on a tournament-shim route is inside the org but inside none of these sections.
  assert.equal(activeOrgSectionKey('/ravens/schedule', 'ravens'), null);
  assert.equal(activeOrgSectionKey('/storm/league', 'ravens'), null);
});

test('a NAMED but non-tabbable section highlights no tab either', () => {
  // `teams` resolves as a section (so the crumb can name it) but the tab row never offers it,
  // so its key matches no rendered tab — no tab reads as current on a rep-team page.
  assert.equal(activeOrgSectionKey('/ravens/teams/u14-select', 'ravens'), 'teams');
  const tabs = orgSectionsFor({ league: true, archives: true });
  assert.ok(!tabs.some(t => t.key === activeOrgSectionKey('/ravens/teams/u14-select', 'ravens')));
});

test('the crumb and the tab row read ONE table — a section is in both or neither', () => {
  // Every section the tab row can render must also produce a crumb label (and vice versa), or the
  // two wayfinding devices would disagree about what a section is called.
  for (const s of orgSectionsFor({ league: true, archives: true })) {
    if (!s.key) continue; // the root deliberately has no crumb
    assert.equal(orgSectionCrumb(`/ravens/${s.key}`, 'ravens'), s.label, s.key);
  }
  // `teams` is NAMEABLE but not NAVIGABLE: the rep-team page still gets a crumb pointing home,
  // while the tab row refuses to offer a destination that is only a redirect shim.
  assert.equal(orgSectionCrumb('/ravens/teams/u14-select', 'ravens'), 'Teams');
  assert.ok(!orgSectionsFor({ league: true, archives: true }).some(s => s.key === 'teams'));
});
