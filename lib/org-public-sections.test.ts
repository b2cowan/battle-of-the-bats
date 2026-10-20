/**
 * Unit tests for the club's section tabs (Nav Unification Stage F; in the club's own bar since Club Tier Stage 4b-1).
 *
 * Runs on Node's built-in runner (see flip-twins.test.ts):  `node --test lib/org-public-sections.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orgSectionsFor,
  activeOrgSectionKey,
  ORG_SECTION_TABS_MIN,
} from './org-public-sections.ts';

test('one name per thing: the tabs say what the pages say (Club Tier Stage 4, "Names")', () => {
  assert.deepEqual(
    orgSectionsFor({ league: true, archives: true }).map(s => s.label),
    ['Home', 'House league', 'Past tournaments'],
  );
});

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
  assert.equal(activeOrgSectionKey('/ravens/league?season=2026', 'ravens'), 'league');
});

test('activeOrgSectionKey: an unnamed section highlights NOTHING rather than lying', () => {
  // A visitor on a tournament-shim route is inside the org but inside none of these sections.
  assert.equal(activeOrgSectionKey('/ravens/schedule', 'ravens'), null);
  assert.equal(activeOrgSectionKey('/storm/league', 'ravens'), null);
  // Prefix orgs must not match: `/ravens-north/league` is not inside `ravens`.
  assert.equal(activeOrgSectionKey('/ravens-north/league', 'ravens'), null);
  assert.equal(activeOrgSectionKey('/ravens/league', ''), null);
});

test('a NAMED but non-tabbable section highlights no tab either', () => {
  // `teams` resolves as a section but the tab row never offers it (no index page until 4b-2),
  // so its key matches no rendered tab — no tab reads as current on a rep-team page.
  assert.equal(activeOrgSectionKey('/ravens/teams/u14-select', 'ravens'), 'teams');
  const tabs = orgSectionsFor({ league: true, archives: true });
  assert.ok(!tabs.some(t => t.key === activeOrgSectionKey('/ravens/teams/u14-select', 'ravens')));
});
