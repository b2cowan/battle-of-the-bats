import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

const ROUTE = readCode('app/api/admin/teams/rep-team-link/route.ts');
// The link guard was rewritten by mig 345 (it reads payments now); its sentences are the same ones 342 first wrote.
const MIGRATION = readCode('supabase/migrations/345_a_team_payment_is_a_dated_record.sql');
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
  it('a check-in undo can only remove a payment, and only one the same person recorded on this team (mig 345)', () => {
    const undo = CHECK_IN.slice(CHECK_IN.indexOf("case 'unmark_paid'"), CHECK_IN.indexOf("case 'confirm_roster'"));
    assert.match(undo, /\.eq\('team_id', teamId\)\.eq\('tournament_id', tournamentId\)\.eq\('status', 'posted'\)\.eq\('created_by', ctx\.user\.id\)/);
    assert.match(undo, /removeTeamPayment\(/);
    // No amount comes from the browser: a volunteer with check-in rights alone can never raise a paid figure.
    assert.doesNotMatch(undo, /depositPaid|totalPaid|deposit_paid:|total_paid:/);
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
    // The refusal words come from the one payment error response, which maps the closed fiscal year (mig 345).
    assert.match(SHARED, /paymentErrorResponse\(error, ctx\.org\.id, \[p_day\]\)/);
    assert.match(readCode('lib/team-payments-server.ts'), /isClosedYearError\(error\)/);
    assert.match(SHARED, /'completed'/, 'a finished event takes no new transfer');
  });
});
