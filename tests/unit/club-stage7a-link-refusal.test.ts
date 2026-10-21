import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

const ROUTE = readCode('app/api/admin/teams/rep-team-link/route.ts');
const MIGRATION = readCode('supabase/migrations/342_club_tournament_fee_book.sql');
const CHECK_IN = readCode('app/api/admin/check-in/route.ts');
const SHARED = readCode('app/api/admin/tournaments/[tournamentId]/registrations/shared-payment/route.ts');
const FILING = readCode('app/api/admin/tournaments/[tournamentId]/fee-filing/route.ts');

describe('Stage 7a · a refused link or unlink says why (owner 2026-10-20)', () => {
  it('both the link and the unlink send the database’s own sentence as a 409', () => {
    assert.match(ROUTE, /NextResponse\.json\(\{ error: e\.message \}, \{ status: 409 \}\)/);
    assert.equal((ROUTE.match(/refusalOf\(err\)/g) ?? []).length, 2, 'POST and DELETE both translate the refusal');
  });

  it('only the deliberate refusals are relayed; any other failure keeps throwing', () => {
    assert.match(ROUTE, /DELIBERATE_REFUSALS\.some/);
    assert.equal((ROUTE.match(/throw err;/g) ?? []).length, 2);
  });

  it('every sentence on the allow-list is one the migration writes for the club admin', () => {
    assert.match(MIGRATION, /Undo this team''s paid status before removing its club-team link/);
    assert.match(MIGRATION, /Undo the recorded entry fee before linking this as our team/);
    assert.match(MIGRATION, /The rep team and tournament must belong to the same club/);
  });
});

describe('Stage 7a · review fixes (2026-10-20)', () => {
  it('a check-in undo can only lower a team’s paid amounts, never raise them', () => {
    const undo = CHECK_IN.slice(CHECK_IN.indexOf("case 'unmark_paid'"), CHECK_IN.indexOf("case 'confirm_roster'"));
    assert.match(undo, /Math\.min\(sent, Number\(current \?\? 0\)\)/);
    assert.doesNotMatch(undo, /typeof p\.totalPaid === 'number' \? p\.totalPaid/);
  });

  it('both new club-money routes honour a member’s tournament assignment', () => {
    for (const src of [SHARED, FILING]) {
      assert.match(src, /getAuthContextWithScope/);
      assert.match(src, /scopeGuard\(ctx, tournamentId\)/);
    }
  });

  it('a shared payment is bounded, rounded to cents, and a closed fiscal year gets the Reopen words', () => {
    assert.match(SHARED, /MOST_PER_TEAM/);
    assert.match(SHARED, /Math\.round\(Number\(a\.amount\) \* 100\) \/ 100/);
    assert.match(SHARED, /isClosedYearError\(error\)/);
  });
});
