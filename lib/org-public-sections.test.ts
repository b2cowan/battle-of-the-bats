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
    orgSectionsFor({ league: true, archives: true, teams: true }).map(s => s.label),
    ['Home', 'Teams', 'House league', 'Past tournaments'],
  );
});

test('orgSectionsFor: Home is always present; the rest follow availability', () => {
  assert.deepEqual(
    orgSectionsFor({ league: true, archives: true, teams: true }).map(s => s.key),
    ['', 'teams', 'league', 'archives'],
  );
  assert.deepEqual(orgSectionsFor({ league: true, archives: false, teams: false }).map(s => s.key), ['', 'league']);
  assert.deepEqual(orgSectionsFor({ league: false, archives: true, teams: false }).map(s => s.key), ['', 'archives']);
  assert.deepEqual(orgSectionsFor({ league: false, archives: false, teams: true }).map(s => s.key), ['', 'teams']);
});

test('orgSectionsFor: an org with nothing else falls below the render floor', () => {
  const sections = orgSectionsFor({ league: false, archives: false, teams: false });
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

test('a team page reads as inside the Teams tab (Club Tier Stage 4b-2a, End state 3)', () => {
  // Until 4b-2a `teams` was named but never a tab (no index page); a team's page is now one level under the Teams page.
  assert.equal(activeOrgSectionKey('/ravens/teams/u14-select', 'ravens'), 'teams');
  const tabs = orgSectionsFor({ league: true, archives: true, teams: true });
  assert.ok(tabs.some(t => t.key === activeOrgSectionKey('/ravens/teams/u14-select', 'ravens')));
});

test('a team tryout page lights Tryouts while the club shows that tab, Teams while it does not (2026-10-21)', () => {
  const inSeason = orgSectionsFor({ league: false, archives: false, teams: true, tryouts: true });
  const offSeason = orgSectionsFor({ league: false, archives: false, teams: true, tryouts: false });
  for (const path of ['/ravens/teams/u14-select/tryouts', '/ravens/teams/u14-select/tryouts/register', '/ravens/teams/u14-select/tryouts?x=1']) {
    assert.equal(activeOrgSectionKey(path, 'ravens', inSeason), 'tryouts', path);
    assert.equal(activeOrgSectionKey(path, 'ravens', offSeason), 'teams', path);
  }
  // The team page itself stays under Teams in season; only its tryout pages move.
  assert.equal(activeOrgSectionKey('/ravens/teams/u14-select', 'ravens', inSeason), 'teams');
  // A team whose slug happens to be "tryouts" is still a team page.
  assert.equal(activeOrgSectionKey('/ravens/teams/tryouts', 'ravens', inSeason), 'teams');
});
