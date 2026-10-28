/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 4b — FREE TIME ON THE COACHES PORTAL (owner rulings Q1–Q12 and the gate, 2026-10-27;
 * build prompt §8; plan "Stage 4b build gate").
 *
 * Giving a free coach Premium makes a live twin of their free team and moves their data, so this stage is a
 * money-adjacent write AND a data migration. Part 0, the four fixes the stage's safety depends on (Q11 1–4):
 *   1. the free team's WRITE routes refuse while its Premium portal is in force (T19), on the pages' own test;
 *   2. the copy records "not finished" the moment it claims the team, so Try again can always find the work (T18/T22);
 *   3. coach cancel and staff cancel refuse a portal holding free time, before anything is archived (T15), and no
 *      free-time code can reach the cancel or retention functions;
 *   4. every bulk action skips a Coaches Portal and says so in its summary line (Q9, T8/T33).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder } from './_source-code.ts';
import { bulkPortalSkipLine, coachCancelRefusal, staffCancelRefusal } from '../../lib/portal-free-time.ts';

const FREE_TEAM_API = 'app/api/coaches/teams/[basicTeamId]';

/** Each exported handler of a route file, by verb. */
function handlers(code: string): { verb: string; body: string }[] {
  const parts = code.split(/(?=export const (?:GET|POST|PATCH|PUT|DELETE) )/);
  return parts
    .map(p => ({ verb: /^export const (GET|POST|PATCH|PUT|DELETE) /.exec(p)?.[1] ?? '', body: p }))
    .filter(h => h.verb);
}

describe('Part 0 · 1 — the free team cannot be changed underneath a live Premium portal (Q11-1, T19)', () => {
  const files = filesUnder(FREE_TEAM_API, '.ts').filter(f => f.endsWith('route.ts'));

  it('finds the free team routes (the census counted 14 write handlers)', () => {
    const writes = files.flatMap(f => handlers(readCode(f)).filter(h => h.verb !== 'GET'));
    assert.equal(writes.length, 14, 'a write handler was added or removed: re-run the census and keep this gate on it');
  });

  for (const file of files) {
    for (const { verb, body } of handlers(readCode(file))) {
      if (verb === 'GET') continue;
      it(`${verb} ${file.slice(FREE_TEAM_API.length) || '/'} uses the write gate, never the owner gate alone`, () => {
        assert.match(body, /requireBasicCoachTeamWriter\(basicTeamId\)/);
        assert.doesNotMatch(body, /requireBasicCoachTeamOwner\(/);
        assert.match(body, /guard\.status === 409 \? json\(\{ error: guard\.error \}, 409\)/, 'the refusal sentence reaches the coach');
      });
    }
  }

  it('the write gate asks the same "is Premium live?" test the pages redirect on', () => {
    const guard = readCode('lib/coach-team-guard.ts');
    const writer = guard.slice(guard.indexOf('export async function requireBasicCoachTeamWriter'));
    assert.match(writer, /requireBasicCoachTeamOwner\(basicCoachTeamId\)/, 'the owner gate runs first');
    assert.match(writer, /getActivePremiumPortal\(team\.team_workspace_id\)/);
    const page = readCode('lib/coach-team-page.ts');
    assert.match(page, /getActivePremiumPortalSlug\(team\.teamWorkspaceId\)/, 'the page redirect reads the same function');
  });
});

describe('Part 0 · 2 — a copy that stops halfway can always be repaired (Q11-3, T18/T22)', () => {
  it('the pending summary reads "not ok", so the portal offers Try again (server-only: pinned by source)', () => {
    const code = readCode('lib/coach-upgrade-migration.ts');
    const body = code.slice(code.indexOf('export function pendingMigrationSummary'), code.indexOf('function emptySummary('));
    assert.match(body, /\.\.\.emptySummary\(programYearId\)/);
    assert.match(body, /ok: false,/);
    assert.match(body, /pending: true,/);
    assert.doesNotMatch(body, /acknowledgedAt/);
  });

  it('the provisioner saves it right after winning the claim and before copying', () => {
    const code = readCode('lib/team-workspace-provisioning.ts');
    const claim = code.indexOf(".is('team_workspace_id', null)");
    const pending = code.indexOf('pendingMigrationSummary(programYear.id)');
    const copy = code.indexOf('await migrateBasicTeamIntoWorkspace(');
    assert.ok(claim > 0 && pending > claim && copy > pending, 'claim → pending summary → copy');
  });

  it('Try again runs only while the summary says "not ok" and the coach has not dismissed it', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/retry/route.ts');
    assert.match(route, /if \(!summary \|\| summary\.ok !== false \|\| summary\.acknowledgedAt\)/);
  });
});

describe('Part 0 · 3 — a cancel never runs on free time (Q11-4, T15)', () => {
  it('the coach cancel refuses before it writes its retention intent', () => {
    const code = readCode('app/api/billing/cancel/confirm/route.ts');
    const refuse = code.indexOf('runningPortalFreeTime(ctx.org.id)');
    assert.ok(refuse > 0 && refuse < code.indexOf("from('billing_retention_intents')"));
    assert.match(code, /coachCancelRefusal\(freeTime\.lastDay\)/);
  });

  it('the staff cancel refuses, in its window and its save, before "already cancelled" and before any write', () => {
    const code = readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts');
    for (const verb of ['GET', 'POST']) {
      const body = handlers(code).find(h => h.verb === verb)!.body;
      const refuse = body.indexOf('runningPortalFreeTime(orgRow.id)');
      assert.ok(refuse > 0, `${verb} reads the free time`);
      assert.ok(refuse < body.indexOf("orgRow.subscription_status === 'canceled'"), `${verb}: before "already cancelled"`);
      assert.match(body, /staffCancelRefusal\(orgRow\.name, freeTime\.lastDay\)/);
    }
  });

  it('no free-time code can reach a cancel, a retention clock, Stripe or an email (T15, T27)', () => {
    const freeTimeFiles = ['lib/portal-free-time.ts', 'lib/portal-free-time-server.ts', 'lib/portal-free-time-give.ts'];
    for (const file of freeTimeFiles) {
      const imports = [...readCode(file).matchAll(/from '([^']+)'/g)].map(m => m[1]);
      for (const spec of imports) {
        assert.doesNotMatch(spec, /billing-retention|cancel|operator-plan-change|stripe|email/i, `${file} imports ${spec}`);
      }
    }
  });

  it('the words', () => {
    assert.equal(coachCancelRefusal('2026-12-26'),
      "There's nothing to cancel. Your Premium Coaches Portal is free through December 26, 2026, then goes back to the free Coaches Portal by itself.");
    assert.equal(staffCancelRefusal('UAT Free Team Coaches Portal', '2026-12-26'),
      'UAT Free Team Coaches Portal has free time through Dec 26, 2026. End it now from its Access list instead of cancelling.');
  });
});

describe('Part 0 · 4 — every bulk action skips a Coaches Portal (Q9, T8/T33)', () => {
  it('the skip comes before any action runs, for every action type', () => {
    const code = readCode('app/api/platform-admin/bulk-operations/route.ts');
    assert.match(code, /enabled_addons, account_kind'\)/, 'the kind is read');
    const loop = code.slice(code.indexOf('for (const org of (orgs as OrgRow[]))'));
    const skip = loop.indexOf("org.account_kind === 'team_workspace'");
    assert.ok(skip > 0 && skip < loop.indexOf('try {'), 'skipped before the try that runs any action');
    assert.match(code, /portalSkipLine/);
  });

  it('the summary line, one and many', () => {
    assert.equal(bulkPortalSkipLine(0), null);
    assert.equal(bulkPortalSkipLine(1), 'Skipped 1 Coaches Portal: its plan and free time can only be changed on its own record.');
    assert.equal(bulkPortalSkipLine(2), "Skipped 2 Coaches Portals: their plan and free time can only be changed on each portal's own record.");
  });
});
