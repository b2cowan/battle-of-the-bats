import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9b-2 — EVERY HOUSE-LEAGUE MONEY PATH GOES THROUGH THE ONE WRITE (plan §2 "one money writer", §0e).
 *
 * The one write is lib/league-fee-paid.ts: `writeLeagueMoney` (→ `club_league_money`: received, refund, undo, price) and
 * `endLeagueRegistration` (→ `league_registration_close`: an ending's money answer), mig 368. This guard fails the build
 * when any other app or lib file calls those database functions, writes a house-league book line, or flips the paid flag —
 * the shape of the second copy that 5c's guard was written to stop. The behaviour itself is proven on the database by
 * scripts/house-league-money-check.sql (DEV, rolled back) and the Stage 7a check.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const WRITER = 'lib/league-fee-paid.ts';
const CODE = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
  .filter(f => !f.endsWith('.test.ts'));
/** Dev-only seeders write fixtures through the same database function (no signed-in member to pass the write). */
const DEV_TOOLS = new Set(['app/api/dev/seed/house-league/route.ts']);
// The latest definition of each function wins (mig 369 replaced three of 368's after /review; mig 374 the writer, for 12b).
const MIG = ['368_house_league_money_honest.sql', '369_house_league_money_review_fixes.sql', '374_a_family_pays_house_league_fees_by_card.sql']
  .map(f => readSource(`supabase/migrations/${f}`)).join('\n').replace(/--.*$/gm, '');

const body = (fn: string) => {
  const at = MIG.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  assert.ok(at >= 0, `${fn} is gone from migs 368-374`);
  const rest = MIG.slice(at);
  return rest.slice(0, rest.indexOf('END $$;'));
};

describe('1 · one write, and nobody else touches house-league money', () => {
  const MONEY_RPC = /\.rpc\('(club_league_money|league_registration_close|club_league_fee_set|league_registration_end|club_league_fee_end|club_fee_post)'/;
  it('only the one write calls the money functions', () => {
    const offenders = CODE.filter(f => f !== WRITER && !DEV_TOOLS.has(f) && MONEY_RPC.test(readCode(f)));
    assert.deepEqual(offenders, [], 'a second door writes house-league money; go through lib/league-fee-paid.ts');
  });
  it('no file flips the paid flag or writes a house-league line itself', () => {
    const offenders = CODE.filter(f => {
      const code = readCode(f);
      return /registration_fee_paid\s*:/.test(code) || /fee_entry_id\s*:/.test(code)
        || /source_module:\s*'league_registration'/.test(code)
        || /from\('accounting_entries'\)\s*\.(insert|update|upsert)\(\{[^}]*league_registration/.test(code);
    });
    assert.deepEqual(offenders, [], 'house-league money written outside the one write');
  });
  it('the doors call the one write: Registrations, the ending, Record a payment', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(route, /await writeLeagueMoney\(ctx!, \{ seasonId, regId \}, move\)/);
    assert.match(route, /await endLeagueRegistration\(ctx!, \{ seasonId, regId \}/);
    assert.match(functionBody(readCode('lib/families-payment.ts'), 'recordFamilyPayment'), /await writeLeagueMoney\(ctx, \{/);
  });
  it('the write takes an amount, a day and a method (the signature Stage 12b calls)', () => {
    const lib = readCode(WRITER);
    assert.match(lib, /kind: 'receive'; day: string; method: string \| null; amount\?: number \| null/);
    assert.match(lib, /'online_card'/, 'the card method 12b writes is allowed');
  });
});

describe('2 · the book is honest (mig 368)', () => {
  it('a refund is its own line going out, never a void', () => {
    const money = body('club_league_money');
    assert.match(money, /'expense', 'posted', 'registration_refund'/);
    // The only void in the writer is Undo (a payment marked by mistake).
    assert.equal((money.match(/club_fee_void\(/g) ?? []).length, 1);
    assert.match(money.slice(money.indexOf("ELSIF p_action = 'undo'")), /club_fee_void\(v_line\.id/);
  });
  it('an ending never voids: it asks, and refunds through the writer', () => {
    const close = body('league_registration_close');
    assert.doesNotMatch(close, /club_fee_void\(|status\s*=\s*'void'/);
    assert.match(close, /IF v_money IS NULL THEN RETURN QUERY SELECT v_reg\.status, NULL::uuid, 'money'::text/);
    assert.match(close, /club_league_money\(p_org, p_season, p_registration, 'refund'/);
    assert.match(close, /IF v_money = 'kept' AND v_reason IS NULL THEN/);
  });
  it('the old ending refuses money instead of voiding it', () => {
    assert.match(body('league_registration_end'), /money_unsettled/);
  });
  it('the old tick routes through the writer', () => {
    const set = body('club_league_fee_set');
    assert.match(set, /club_league_money\(p_org, p_season, p_registration, 'receive'/);
    assert.match(set, /club_league_money\(p_org, p_season, p_registration, 'undo'/);
  });
  it('only an accepted child owes; a paid child keeps their price on a move', () => {
    assert.match(body('club_league_money'), /IF v_reg\.status <> 'active' THEN RETURN QUERY SELECT NULL::uuid, 'not_accepted'::text/);
    assert.match(body('league_registration_move_division'), /IF league_reg_received\(p_registration\) > 0 THEN\s*v_kept := v_price IS DISTINCT FROM v_old;/);
  });
  it('a correction needs a reason and settles a lower paid price as a refund', () => {
    const money = body('club_league_money');
    const price = money.slice(money.indexOf('IF v_price = v_fee THEN'));
    assert.match(price, /IF v_reason IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'reason'::text/);
    assert.match(price, /IF v_got > v_price THEN[\s\S]*'registration_refund'/);
    assert.match(price, /INSERT INTO league_registration_price_changes/);
  });
  it('a card payment is Stripe’s: only the online-payment write may say "online_card", and it has no Undo (12b, mig 374)', () => {
    const money = body('club_league_money');
    assert.match(money, /IF v_method = 'online_card' AND coalesce\(current_setting\('flhq\.online_payment_write', true\), 'off'\) <> 'on' THEN\s*RETURN QUERY SELECT NULL::uuid, 'method'::text/);
    const undo = money.slice(money.indexOf("ELSIF p_action = 'undo'"));
    assert.match(undo, /FROM online_payment_items i WHERE i\.entry_id = v_line\.id\) THEN\s*RETURN QUERY SELECT NULL::uuid, 'card'::text/);
    // The refusal sits before the void.
    assert.ok(undo.indexOf("'card'::text") < undo.indexOf('club_fee_void('));
    // The hand paths refuse it before the database is asked.
    assert.match(readCode(WRITER), /method === 'online_card'\)\) return 'method'/);
  });
  it('accepted-at is set by a trigger on every door, never invented for an old row', () => {
    assert.match(MIG, /BEFORE INSERT OR UPDATE OF status ON public\.league_registrations/);
    assert.doesNotMatch(MIG, /UPDATE public\.league_registrations[^;]*SET accepted_at/, 'no backfill: an old acceptance has no day count (§0e)');
  });
});
