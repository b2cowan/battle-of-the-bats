import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { functionBody, readCode, readSource } from './_source-code.ts';
import { hasOrgVenueLibrary } from '../../lib/plan-features.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 10a — PERMITS: THE TIME THE CLUB HOLDS (ratified 2026-10-11; plan
 * docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md; hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11).
 *
 * 1. ONE MODEL OF THE CLUB'S TIME (Stage 11 Ask 2): a block is the only record of time the club holds or hands out. No
 *    second table holds weekly club time — Stage 11a's schedule becomes the block's second OWNER (a column and a CHECK
 *    on org_time_blocks), never a second slot model. This list only grows by a decision.
 * 2. THE PLAN (Ask 4, BUSINESS_DECISIONS 2026-10-11): permits ride the Venue library's gate — League Plus and both Club
 *    bands — checked on the SERVER by every permit route, never only by a page.
 * 3. WHO (owner, 10a build): a coach never reads a permit; a permit's money reads only to those who hold the club's
 *    Accounting, stripped on the server for anyone else; the quiet line a coach reads carries a facility, days and hours.
 * 4. THE HOUSE FORMAT (Ask 26): the club's Excel reports read the club's paper settings (its logo, its branding switch).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.join(import.meta.dirname, '..', '..');

describe('one model of the club\'s time (Stage 11 Ask 2)', () => {
  /** The tables that hold the club's weekly time. ⚠ Only grows by a decision: 11a adds an OWNER here, never a table. */
  const HOLDS_CLUB_TIME = ['org_time_blocks'];
  const migrations = readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter(f => f.endsWith('.sql'));

  it('no migration creates a second table of weekly time (weekdays + a start and an end of day)', () => {
    const found: string[] = [];
    for (const f of migrations) {
      const sql = readSource(`supabase/migrations/${f}`).toLowerCase();
      for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/g)) {
        const [, table, body] = m;
        if (/\bweekdays?\b/.test(body) && /\b(start_time|starts_at_time)\b/.test(body) && /\b(end_time|ends_at_time)\b/.test(body)) found.push(table);
      }
    }
    assert.deepEqual([...new Set(found)].sort(), HOLDS_CLUB_TIME,
      'a second table of weekly club time — make it an owner of org_time_blocks instead (one model of time)');
  });
  it('the block\'s owner is the permit today; 11a adds the schedule as the second owner', () => {
    const sql = readSource('supabase/migrations/322_the_club_holds_its_time.sql');
    assert.match(sql, /permit_id\s+uuid not null references public\.org_permits\(id\) on delete cascade/);
    assert.match(sql, /Stage 11a adds `schedule_id` and a one-owner CHECK/);
  });
});

describe('permits ride the Venue library\'s plans, checked on the server (Ask 4)', () => {
  it('League Plus and both Club bands carry them; no Tournament plan does', () => {
    for (const p of ['league', 'club', 'club_large'] as const) assert.equal(hasOrgVenueLibrary(p), true, p);
    for (const p of ['tournament', 'tournament_plus', 'team'] as const) assert.equal(hasOrgVenueLibrary(p as never), false, p);
  });
  it('every permit route refuses a plan without the Venue library, before anything else', () => {
    for (const f of ['app/api/admin/org/permits/route.ts', 'app/api/admin/org/permits/document/route.ts']) {
      const code = readCode(f);
      const gates = (code.match(/if \(!hasOrgVenueLibrary\(ctx\.org\.planId\)\) return/g) ?? []).length;
      assert.ok(gates >= 1, `${f} has no plan gate`);
    }
    // Both verbs of the permits route.
    assert.equal((readCode('app/api/admin/org/permits/route.ts').match(/if \(!hasOrgVenueLibrary\(ctx\.org\.planId\)\) return/g) ?? []).length, 2);
  });
  it('the venue window\'s permits come only through the library\'s own gated read', () => {
    assert.match(readCode('app/api/admin/org/venues/route.ts'), /readVenuePermits\(ctx\.org\.id, venues\.map\(v => v\.id\), tournamentToday\(\)\)/);
  });
});

describe('who reads a permit, and who reads its money (owner, 10a build)', () => {
  it('a coach never reads a permit or its document', () => {
    assert.match(readCode('app/api/admin/org/permits/route.ts'), /if \(ctx\.role === 'coach'\) return forbidden\(\);/);
    assert.match(readCode('app/api/admin/org/permits/document/route.ts'), /if \(ctx\.role === 'coach'\) return \{ error: forbidden\(\) \};/);
  });
  it('the money is stripped on the server for a reader without Accounting', () => {
    const server = readCode('lib/permit-server.ts');
    assert.match(functionBody(server, 'readPermitsYear'), /if \(canMoney\) row\.cost = p\.cost;/);
    assert.match(functionBody(server, 'readPermitWindow'), /if \(opts\.canMoney\) \{\s*view\.cost = p\.cost;/);
    assert.match(functionBody(server, 'readPermitWindow'), /if \(opts\.canMoney\) view\.hour = prices\.hourOf\(pl\.unit\);/);
    // The budget line is read at all only for a money reader.
    assert.match(functionBody(server, 'readPermitWindow'), /opts\.canMoney && p\.budgetLineId/);
  });
  it('a save from a reader without Accounting keeps the money stored', () => {
    assert.match(readCode('app/api/admin/org/permits/route.ts'), /if \(!canMoney\) \{ payload\.cost = keep\?\.cost \?\? null; payload\.budgetLineId = keep\?\.budgetLineId \?\? null; \}/);
  });
  it('the money reads and writes ask the club\'s one money rule', () => {
    assert.match(readCode('app/api/admin/org/permits/route.ts'), /const canMoney = canMoveClubMoney\(ctx, ctx\.org\);/);
  });
  it('the quiet line a coach reads names a facility, days and hours — never a cost, issuer or reference', () => {
    const words = readSource('lib/permit-words.ts');
    const shape = words.slice(words.indexOf('export interface PermitOutside'), words.indexOf('}\n', words.indexOf('export interface PermitOutside')));
    assert.doesNotMatch(shape, /\b(cost|issuer|reference|budget|name)\b\s*:/, 'the coach\'s wire shape grew a field it must not carry');
  });
  it('the venue\'s bookings contact stays off the pickers\' list (a coaching-staff login reads it)', () => {
    assert.match(readCode('app/api/admin/org/venues/route.ts'), /venues\.map\(v => \(\{ \.\.\.v, bookingsEmail: undefined \}\)\)/);
  });
});

describe('a closed fiscal year locks a permit\'s money, never its time', () => {
  it('the route refuses a money change in the closed stretch, in the money windows\' words', () => {
    const route = readCode('app/api/admin/org/permits/route.ts');
    assert.match(route, /refuseIfClosed\(setting, \[draftIn\.startsOn\], \{ canMove: canMoney, kind: 'plan' \}\)/);
  });
  it('the database is the floor', () => {
    const sql = readSource('supabase/migrations/322_the_club_holds_its_time.sql');
    assert.match(sql, /raise exception 'year_closed: the permit "%" starts in a closed fiscal year'/);
    assert.match(sql, /raise exception 'permit_line_year:/);
  });
  it('a permit carrying money in a closed year can\'t be deleted — the route, and the floor under it (/review 10a)', () => {
    const route = readCode('app/api/admin/org/permits/route.ts');
    assert.match(route, /const carriesMoney = permit\.cost != null \|\| permit\.budgetLineId != null;/);
    assert.match(route, /refuseIfClosed\(s, \[permit\.startsOn\], \{ canMove: canMoney, kind: 'plan' \}\)/);
    const sql = readSource('supabase/migrations/322_the_club_holds_its_time.sql');
    assert.match(sql, /create trigger org_permits_check\s+before insert or update or delete on public\.org_permits/);
    assert.match(sql, /if tg_op = 'DELETE' then[\s\S]*?carries money in a closed fiscal year[\s\S]*?return old;/);
  });
});

describe('a venue a permit holds, and the club\'s own removal (/review 10a)', () => {
  const sql = readSource('supabase/migrations/322_the_club_holds_its_time.sql');
  it('the venue and facility links are NO ACTION, never RESTRICT — the club\'s own removal still cascades', () => {
    assert.doesNotMatch(sql, /on delete restrict/i);
    assert.match(sql, /org_venue_id\s+uuid not null references public\.org_venues\(id\),/);
    assert.match(sql, /facility_id\s+uuid not null references public\.org_venue_facilities\(id\),/);
  });
  it('a delete that clears the club\'s facilities first clears its held time before them', () => {
    for (const f of ['app/api/platform-admin/orgs/[id]/delete/route.ts', 'scripts/seed-club-fixture.mjs']) {
      const code = readCode(f);
      const blocks = code.indexOf("from('org_time_blocks').delete()");
      const facilities = code.indexOf("from('org_venue_facilities').delete()");
      assert.ok(blocks > 0 && blocks < facilities, `${f}: org_time_blocks go before org_venue_facilities`);
    }
  });
  it('the venue\'s bookings contact never reaches a member\'s own session', () => {
    assert.match(sql, /revoke select on public\.org_venues from anon, authenticated;/);
    const grant = /grant select \(([^)]+)\) on public\.org_venues to authenticated;/.exec(sql);
    assert.ok(grant, 'a column-list grant on org_venues');
    assert.doesNotMatch(grant![1], /bookings_email/);
  });
});

describe('the house format reaches the club\'s Excel reports (Ask 26)', () => {
  it('the club\'s money export reads its paper settings for every file with letterhead, not the PDF alone', () => {
    const code = readCode('components/admin/kit/club/money/ClubMoneyExport.tsx');
    assert.match(code, /const pdfSettings = format !== 'csv'/);
    assert.doesNotMatch(code, /format === 'pdf'\s*\?\s*await fetchResolvedPdfSettings/);
  });
  it('the new workbooks set print setup and the page footer; the FieldLogicHQ mark stays the last row', () => {
    // One helper holds the branded parts, on the club's own switch…
    const brand = functionBody(readCode('components/admin/kit/club/PermitWindows.tsx'), 'permitWorkbookBrand');
    assert.match(brand, /const branded = settings\?\.showBranding \?\? true;/);
    assert.match(brand, /logoDataUrl: settings\?\.logoDataUrl/);
    assert.match(brand, /footer: branded \? \{ text: BRANDING_TEXT/);
    assert.match(brand, /print: \{ landscape: true, fitToWidth: true, pageFooter: pageFooterText\(branded\) \}/);
    // …and both workbooks wear all three.
    for (const f of ['components/admin/kit/club/PermitWindows.tsx', 'app/[orgSlug]/admin/org/venues/page.tsx']) {
      const code = readCode(f);
      assert.match(code, /const brand = await permitWorkbookBrand\(q\);/, f);
      for (const part of [/logoDataUrl: brand\.logoDataUrl/, /footer: brand\.footer/, /print: brand\.print/]) assert.match(code, part, f);
    }
  });
});
