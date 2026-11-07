import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';
import { canOpenModule, canOpenRepMoney } from '../../lib/member-access.ts';
import { canOpenFamilies } from '../../lib/families-access.ts';
import { canHouseLeague } from '../../lib/house-league-access.ts';
import type { EntitlementOrg } from '../../lib/module-entitlements.ts';
import type { OrgRole } from '../../lib/types.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB BAND (Club Tier Stage 13b, A1; owner Asks 2 and 4, decisions 2026-11-07).
 *
 * Three things hold the band to the rule it was drawn under — "built only from figures the product already has":
 *   1. it CALLS the club's existing definitions (cash on hand, owed by the teams, a season's money) and owns no money
 *      query of its own — F-T2-4 / F-O6-5 found two "Outstanding" figures; the band must not be a third;
 *   2. it never reads a coach's books (D1, owner 2026-11-06: the club sees one cash figure per team, the team's standing
 *      WITH the club);
 *   3. each tile is read only for a reader who holds the gate of the page it opens — a tile they cannot open is ABSENT.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const read = readCode('lib/club-band-read.ts');
const route = readCode('app/api/admin/club-band/route.ts');
const brief = readCode('app/api/admin/club-brief/route.ts');
const screen = readCode('components/admin/kit/club/ClubBand.tsx');
const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');

describe('the band calls the existing definitions', () => {
  it('reads cash, the teams’ owed and house league’s owing through the money definitions', () => {
    assert.match(read, /clubCashOnHand\(/);
    assert.match(read, /owedByTheTeams\(/);
    assert.match(read, /seasonMoney\(/);
    assert.match(read, /from '\.\/club-money-figures'/);
    assert.match(read, /from '\.\/league-money'/);
  });

  it('holds no database read of its own beyond the team list (the only table it names)', () => {
    const tables = [...read.matchAll(/\.from\('([a-z_]+)'\)/g)].map(m => m[1]);
    assert.deepEqual([...new Set(tables)], ['rep_teams']);
  });

  it('the missing-forms count reuses the Families list’s rule, not a second one', () => {
    assert.match(read, /clubFormsMissing\(/);
    const families = readCode('lib/families-read.ts');
    const fn = families.slice(families.indexOf('export async function clubFormsMissing'));
    assert.match(fn, /templatesForTeam\(/);
    assert.match(fn, /formOnFile\(/);
  });
});

describe('the band never reads a coach’s books (D1)', () => {
  it('imports no team-cash or coach-money module', () => {
    for (const source of [read, route]) {
      assert.doesNotMatch(source, /club-team-cash|teamCashHeld|coach-dues|coach-register|coach-money|bank-coach|teamsCash/);
    }
  });
});

describe('the band is its own read, after This morning', () => {
  it('is not folded into the brief, which loads on every club screen', () => {
    assert.doesNotMatch(brief, /club-band|readClubBand/);
  });

  it('the Overview asks only once the brief has answered, and only for the owner and a club admin', () => {
    assert.match(hub, /<ClubBand/);
    assert.match(hub, /ready=\{status !== 'loading' \|\| !!brief\}/);
    assert.match(hub, /\{club && \(isOwner \|\| isAdmin\) && <ClubBand/);
    assert.match(screen, /if \(!ready \|\| !slug\) return/);
  });

  it('the route refuses anyone but the owner and a club admin on a Club plan', () => {
    assert.match(route, /isClubPlan\(ctx\.org\.planId\)/);
    assert.match(route, /ctx\.role !== 'owner' && ctx\.role !== 'admin'/);
  });

  it('a tile built from two reads says "Didn’t load" when either failed, never a silently low figure', () => {
    assert.match(screen, /band\.owed && !readFailed\('owed'\)/);
    assert.match(screen, /n && !readFailed\('needs'\)/);
  });

  it('the setup checklist is read by the owner and an admin, never by a group-limited admin', () => {
    const checklist = readCode('app/api/admin/org/club-checklist/route.ts');
    assert.match(checklist, /ctx\.role !== 'owner' && ctx\.role !== 'admin'/);
    assert.match(checklist, /ctx\.role === 'admin' && ctx\.repGroupIds\) return forbidden\(\)/);
  });

  it('puts the band ABOVE This morning, never instead of it', () => {
    assert.ok(hub.indexOf('<ClubBand') < hub.indexOf('id="hub-brief"'));
    assert.ok(hub.includes('id="hub-programs"'));
  });
});

describe('each part is read only for the gate of the page it opens', () => {
  it('names the gate of every part in the read', () => {
    assert.match(read, /canOpenModule\(ctx, org, 'module_accounting'\)/);
    assert.match(read, /canOpenRepMoney\(ctx, org\)/);
    assert.match(read, /calendarPrograms\(ctx, org\)/);
    assert.match(read, /canOpenFamilies\(ctx, org\)/);
    assert.match(read, /canOpenModule\(ctx, org, 'module_rep_teams'\)/);
    assert.match(read, /canHouseLeague\(ctx, org, 'read'\)/);
  });

  const club: EntitlementOrg = { planId: 'club', subscriptionStatus: 'active', enabledAddons: [], freeFloor: null };
  const person = (role: OrgRole, capabilities: Record<string, boolean> | null = null, repGroupIds: string[] | null = null) =>
    ({ role, capabilities, repGroupIds });
  const gates = (m: ReturnType<typeof person>) => ({
    books: canOpenModule(m, club, 'module_accounting'),
    teamsOwed: canOpenModule(m, club, 'module_accounting') && canOpenRepMoney(m, club),
    calendar: ['module_rep_teams', 'module_house_league', 'module_tournaments'].some(k => canOpenModule(m, club, k as 'module_rep_teams')),
    coachGaps: canOpenModule(m, club, 'module_rep_teams'),
    families: canOpenFamilies(m, club),
    leagueMoney: canHouseLeague(m, club, 'read'),
  });

  it('owner: every tile and every line', () => {
    assert.deepEqual(gates(person('owner')), { books: true, teamsOwed: true, calendar: true, coachGaps: true, families: true, leagueMoney: true });
  });

  it('club admin: the money and the calendar, but not Families (no role holds it by default)', () => {
    const g = gates(person('admin'));
    assert.equal(g.books, true);
    assert.equal(g.calendar, true);
    assert.equal(g.families, false);
  });

  it('an admin whose Accounting is off sees no money tile', () => {
    const g = gates(person('admin', { module_accounting: false }));
    assert.equal(g.books, false);
    assert.equal(g.teamsOwed, false);
    assert.equal(g.calendar, true);
  });

  it('an admin granted Families sees the forms line; one limited to a team group does not', () => {
    assert.equal(gates(person('admin', { module_families: true })).families, true);
    assert.equal(gates(person('admin', { module_families: true }, ['g1'])).families, false);
  });

  it('the treasurer reads the money but has no calendar and no Families (and the route refuses their role anyway)', () => {
    const g = gates(person('treasurer'));
    assert.equal(g.books, true);
    assert.equal(g.calendar, false);
    assert.equal(g.families, false);
  });

  it('the registrar and league admin open neither Accounting nor Families', () => {
    for (const role of ['league_registrar', 'league_admin'] as OrgRole[]) {
      const g = gates(person(role));
      assert.equal(g.books, false, role);
      assert.equal(g.families, false, role);
      assert.equal(g.coachGaps, false, role);
    }
  });
});

/**
 * STILL TO DO (Club Tier Stage 13b, A2; Ask 11 = A; R-F-11: read-only, never "the admin completes them").
 */
describe('the admin reads the owner’s setup steps, and can change none', () => {
  const checklistRoute = readCode('app/api/admin/org/club-checklist/route.ts');
  const stillToDo = readCode('components/admin/kit/club/ClubStillToDo.tsx');

  it('the checklist route lets the owner and a club admin read it, and no one else', () => {
    assert.match(checklistRoute, /ctx\.role !== 'owner' && ctx\.role !== 'admin'\) return forbidden\(\)/);
  });

  it('the route has no write: reading it ticks or changes nothing', () => {
    assert.doesNotMatch(checklistRoute, /export const (POST|PUT|PATCH|DELETE)/);
  });

  it('only an admin sees “Still to do”; the owner keeps their own “Setup: n of 5” line', () => {
    assert.match(hub, /isAdmin && club && checklist && \(\s*<ClubStillToDo/);
    assert.match(hub, /isOwner && checklist && !checklist\.allDone/);
  });

  it('the block goes when setup is done, and a step the admin cannot open is text, not a door', () => {
    assert.match(stillToDo, /if \(checklist\.allDone\) return null/);
    assert.match(stillToDo, /canOpenStep\(step\.key\)/);
    assert.doesNotMatch(stillToDo, /fetch\(|method:|onClick/);
  });

  it('a step has one name: the setup page and “Still to do” read the same words', () => {
    assert.match(readCode('components/admin/kit/club/ClubSetupKit.tsx'), /from '@\/lib\/club-setup-words'/);
    assert.match(stillToDo, /from '@\/lib\/club-setup-words'/);
  });
});

/**
 * THE INSTALL BANNER'S FIRST LANDING (Club Tier Stage 13b, A4; hub tab-11 L1). No column: the browser's own storage.
 */
describe('the install banner waits one visit on the admin', () => {
  const prompt = readSource('components/InstallAppPrompt.tsx');
  const layout = readCode('app/[orgSlug]/admin/layout.tsx');

  it('only the admin opts in, and the explicit “Download app” ask is never held back', () => {
    assert.match(layout, /skipFirstLanding: true/);
    assert.match(prompt, /skipFirstLanding = false/);
    const manual = prompt.slice(prompt.indexOf("window.addEventListener('flhq:show-install'") - 1200, prompt.indexOf("window.addEventListener('flhq:show-install'"));
    assert.doesNotMatch(manual, /firstLandingRef/);
  });

  it('decides once per mount, so the install event arriving late cannot show it within the first landing', () => {
    assert.match(prompt, /firstLandingRef\.current === null/);
    assert.match(prompt, /localStorage\.setItem\(landedKey/);
  });
});
