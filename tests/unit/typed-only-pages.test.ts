/**
 * The typed-only club pages send a Premium Coaches Portal and a tournament-only organization home; clubs and leagues are
 * untouched (Retire the old tournament-only menu, step 3, owner call 3 + the Calendar call, 2026-11-20).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { typedOnlyPageHome, type TypedOnlyOrg, type TypedOnlyPage } from '../../lib/typed-only-pages.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');

const org = (planId: string, extra: Partial<TypedOnlyOrg> = {}): TypedOnlyOrg =>
  ({ planId, subscriptionStatus: 'active', enabledAddons: [], ...extra }) as TypedOnlyOrg;

const PAGES: TypedOnlyPage[] = ['houseLeague', 'calendar', 'schedules', 'publicSite', 'board', 'venues'];
const LAYOUTS: Record<TypedOnlyPage, string> = {
  houseLeague: 'app/[orgSlug]/admin/house-league/layout.tsx',
  calendar: 'app/[orgSlug]/admin/calendar/layout.tsx',
  schedules: 'app/[orgSlug]/admin/schedules/layout.tsx',
  publicSite: 'app/[orgSlug]/admin/public-site/layout.tsx',
  board: 'app/[orgSlug]/admin/org/board/layout.tsx',
  venues: 'app/[orgSlug]/admin/org/venues/layout.tsx',
};

describe('typed-only pages — who is sent home', () => {
  it('a Premium Coaches Portal goes to its portal from all six', () => {
    for (const page of PAGES) {
      assert.equal(typedOnlyPageHome(page, org('team')), 'portal', page);
      assert.equal(typedOnlyPageHome(page, org('tournament', { accountKind: 'team_workspace' })), 'portal', `${page} (team workspace on a tournament plan)`);
      assert.equal(typedOnlyPageHome(page, org('team', { subscriptionStatus: 'canceled' })), 'portal', `${page} (ended)`);
    }
  });

  it('a Tournament or Tournament Plus organization goes to its Tournaments page from the four outside Organization', () => {
    for (const planId of ['tournament', 'tournament_plus']) {
      for (const page of ['houseLeague', 'calendar', 'schedules', 'publicSite'] as const) {
        assert.equal(typedOnlyPageHome(page, org(planId)), 'tournaments', `${planId} ${page}`);
      }
      // Its org layout already sends it from every Organization page; this rule does not restate that.
      assert.equal(typedOnlyPageHome('board', org(planId)), null);
      assert.equal(typedOnlyPageHome('venues', org(planId)), null);
    }
  });

  it('a club or a league is never sent — whatever it lacks, even cancelled', () => {
    for (const planId of ['league', 'club', 'club_large']) {
      for (const page of PAGES) {
        assert.equal(typedOnlyPageHome(page, org(planId)), null, `${planId} ${page}`);
        assert.equal(typedOnlyPageHome(page, org(planId, { subscriptionStatus: 'canceled' })), null, `${planId} ${page} (cancelled)`);
      }
    }
  });

  it('a Premium workspace whose plan grows (a free-time grant to Club) keeps every page its plan now carries', () => {
    const granted = org('club', { accountKind: 'team_workspace' });
    for (const page of PAGES) assert.equal(typedOnlyPageHome(page, granted), null, page);
  });

  it('a tournament-only organization that DOES carry the program (an add-on) keeps the page', () => {
    assert.equal(typedOnlyPageHome('publicSite', org('tournament_plus', { enabledAddons: ['module_public_site'] } as Partial<TypedOnlyOrg>)), null);
    assert.equal(typedOnlyPageHome('houseLeague', org('tournament', { enabledAddons: ['module_house_league'] } as Partial<TypedOnlyOrg>)), null);
  });
});

describe('typed-only pages — each layout asks the rule, server-side', () => {
  for (const page of PAGES) {
    it(`${page}: its layout sends the workspace home before the page mounts`, () => {
      const src = read(LAYOUTS[page]);
      assert.doesNotMatch(src, /^'use client'/m);
      assert.match(src, new RegExp(`await redirectWorkspaceWithoutProgram\\((\\(await params\\)\\.orgSlug|orgSlug), '${page}'\\)`));
    });
  }

  it('the resolver is the suspended-safe one and lands a Premium workspace where sign-in does', () => {
    const lib = read('lib/coach-portal-request.ts');
    const fn = lib.slice(lib.indexOf('export async function redirectWorkspaceWithoutProgram'));
    assert.match(fn, /getCoachPortalAuth\(orgSlug\)/);
    assert.match(fn, /typedOnlyPageHome\(page, auth\.org\)/);
    assert.match(fn, /redirect\(`\/\$\{auth\.org\.slug\}\/admin\/tournaments`\)/);
    assert.match(fn, /getStandaloneAdminHref\(/);
  });
});
