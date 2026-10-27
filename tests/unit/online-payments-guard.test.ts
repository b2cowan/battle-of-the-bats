import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * ONE ONLINE-PAYMENT RECORD, NO NEW WRITER (Club Tier Stage 12a; plan §3 and §0c; build prompt Part 1).
 *
 * An online payment lands in a team's record through ONE named landing (`lib/online-payment-landing.ts`), which calls the
 * database functions of mig 358 — and those call the tournament's own writer, `tournament_team_payment_record` (mig 345).
 * So the team's paid figure, its payment rows and the tournament's book move exactly as a hand-recorded payment does, and
 * no route can write a payment cache, a payment row or a book line of its own. Every door that opens a payment, connects
 * an account or refunds reads the launch switch (`lib/online-payments-switch.ts`).
 *
 * Stage 12b adds the SECOND landing, house league (mig 374): `online_payment_league_land` runs each child's fee through
 * THE house-league writer `club_league_money` (mig 369) inside one transaction. This guard lists both landings; the
 * house-league side's own guard (house-league-money-guard) still holds that no app file calls that writer but its one TS face.
 *
 * ⚠ The two Connect webhooks are the ONLY doors exempt from the switch: money Stripe already took must still land, a
 * refund already asked for must still record, and an account Stripe closed must stop taking payments, even if the switch
 * is turned off in between. Payments arrive on one (v1 snapshot events), the account's own changes on the other (v2 thin
 * events, plan §0d).
 */

const LANDING = 'lib/online-payment-landing.ts';
const WEBHOOKS = ['app/api/payments/connect-webhook/route.ts', 'app/api/payments/connect-account-events/route.ts'];
const MIG = 'supabase/migrations/358_a_club_takes_payments_online.sql';
const MIG_12B = 'supabase/migrations/374_a_family_pays_house_league_fees_by_card.sql';
/** Both landings and the refund functions: only the named landing module calls them. */
const LAND_RPCS = ['online_payment_land', 'online_payment_league_land', 'online_payment_land_failed', 'online_payment_refund_open',
  'online_payment_refund_land', 'online_payment_refund_failed',
  // The house-league money-out line and its word are called from inside the landing's SQL only, never from app code.
  'online_payment_league_post_out', 'club_league_out_word',
  // 12b Part 5 (mig 375): a house-league refund's booking and its "sent another way".
  'online_payment_league_refund_book', 'online_payment_league_refund_resolve',
  // 12c Part 1 (mig 382): a team's part refund, and a bank debit clearing or coming back.
  'online_payment_team_refund_book', 'online_payment_clearing', 'online_payment_returned',
  // 12d-1 (migs 390–391): a dispute's state, the extra still standing on a team payment, and a payment reversed.
  'online_payment_dispute_apply', 'online_payment_over_left', 'online_payment_reverse'];
const MIG_12B_REFUNDS = 'supabase/migrations/375_a_house_league_refund_goes_back_to_the_card.sql';
const fnBody = (sql: string, fn: string) => new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\nEND \\$\\$;`).exec(sql)?.[0] ?? '';

const appCode = () => [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('lib', '.tsx'), ...filesUnder('components', '.tsx'), ...filesUnder('components', '.ts')]
  .filter(f => !f.endsWith('.test.ts'));

describe('the landing is the only way an online payment reaches a team’s record', () => {
  it('only the named landing calls the landing and refund functions', () => {
    for (const f of appCode()) {
      if (f === LANDING) continue;
      const code = readCode(f);
      for (const rpc of LAND_RPCS) {
        assert.ok(!new RegExp(`['"\`]${rpc}['"\`]`).test(code), `${f} calls ${rpc} — only ${LANDING} may`);
      }
    }
  });

  it('the landing function calls the tournament writer, with no method of its own', () => {
    const sql = readCode(MIG);
    const land = /FUNCTION public\.online_payment_land\([\s\S]*?\nEND \$\$;/.exec(sql)?.[0] ?? '';
    assert.match(land, /tournament_team_payment_record\(v_op\.team_id, v_op\.base_amount, v_day, v_label, NULL, NULL\)/);
    assert.doesNotMatch(land, /INSERT INTO tournament_team_payments/i, 'the landing must not insert a payment row itself');
    assert.doesNotMatch(land, /UPDATE teams/i, 'the landing must not write the payment cache');
  });

  it('the house-league landing runs each child through THE house-league writer, once, as Stripe (mig 374, §0e b)', () => {
    const land = fnBody(readCode(MIG_12B), 'online_payment_league_land');
    assert.match(land, /club_league_money\(v_op\.org_id, v_op\.season_id, v_it\.registration_id, 'receive', v_it\.amount, v_day,\s*'online_card', NULL, NULL\)/,
      'the writer, the child’s amount, the card method, no person');
    assert.doesNotMatch(land, /INSERT INTO accounting_entries/i, 'the landing must not write a fee line itself');
    assert.doesNotMatch(land, /UPDATE league_registrations/i, 'the landing must not flip a registration itself');
    // Idempotent: "already" before and after the locks, and only children with no line yet are landed.
    assert.equal((land.match(/RETURN jsonb_build_object\('already', true/g) ?? []).length, 2);
    assert.match(land, /i\.entry_id IS NULL/);
    // The ending's lock order (mig 369): the season, then the registrations, then the payment.
    const season = land.indexOf('FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE');
    const regs = land.indexOf('ORDER BY r.id FOR UPDATE');
    const pay = land.indexOf('FROM online_payments WHERE id = p_online_payment FOR UPDATE');
    assert.ok(season > 0 && regs > season && pay > regs, 'season → registrations → payment');
  });

  it('a club-paid fee is a COST, never a house-league refund line (A14; isFeeRefund nets those)', () => {
    const out = fnBody(readCode(MIG_12B), 'online_payment_league_post_out');
    assert.match(out, /'expense', 'posted', NULL, 'online_payment'/);
    assert.doesNotMatch(out, /'league_registration'/);
  });

  it('a house-league refund goes out through THE writer as a card refund; a fee given back is a cost (mig 375)', () => {
    const sql = readCode(MIG_12B_REFUNDS);
    const book = fnBody(sql, 'online_payment_league_refund_book');
    assert.match(book, /club_league_money\(v_op\.org_id, v_op\.season_id, v_it\.registration_id, 'refund', v_r\.amount - v_r\.fee_refunded, v_today,\s*'online_card'/);
    assert.match(book, /online_payment_league_post_out\(v_op\.season_id, 'Payment processing'/);
    assert.doesNotMatch(book, /INSERT INTO accounting_entries/i);
    // Idempotent: a booked refund only moves to succeeded.
    assert.match(book, /IF v_r\.booked_at IS NULL THEN/);
    const open = fnBody(sql, 'online_payment_refund_open');
    // A team's card payment keeps 12a's rule: the whole payment, one live refund.
    assert.match(open, /IF p_item IS NOT NULL OR p_amount IS NOT NULL THEN RAISE EXCEPTION 'A team''s card payment is refunded in full\.'/);
    assert.match(open, /This payment is already being refunded\./);
    // The fee share only on a FULL refund of an untouched share, while the family paid it (owner §0e).
    assert.match(open, /IF p_fee_included AND v_op\.fee_payer = 'family' AND v_amt = v_it\.amount AND v_back = 0 THEN v_fee := v_it\.fee_share;/);
    assert.match(open, /A partial refund needs a reason\./);
    assert.match(sql, /DROP INDEX IF EXISTS public\.online_payment_refunds_one_full_refund;/);
  });

  it('a card refund comes first, as one act: before the ending, before a lower price (12b Part 5)', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.ok(route.indexOf('await refundChildToCard(regId, ctx!.user.id, newStatus') < route.indexOf('await endLeagueRegistration(ctx!'),
      'the card refund is booked before the ending reads the money');
    assert.ok(route.indexOf("await refundChildToCard(regId, ctx!.user.id, 'price_corrected'") < route.indexOf('await writeLeagueMoney(ctx!, { seasonId, regId }, move)'),
      'the difference goes back to the card before the correction, so it never refunds by hand too');
  });

  it('the refund never voids the receipt: it marks the row refunded and adds a money-out line', () => {
    const sql = readCode(MIG);
    const refund = /FUNCTION public\.online_payment_refund_land\([\s\S]*?\nEND \$\$;/.exec(sql)?.[0] ?? '';
    assert.doesNotMatch(refund, /tournament_team_payment_(remove|change)|club_fee_void/, 'a refund keeps the receipt (Stage 7a)');
    assert.match(refund, /team_payments_refresh\(/);
    assert.match(refund, /online_payment_post_out\(v_op\.tournament_id, 'Refunds'/);
  });

  it('a hand change to an online row is refused by the database, not just the screen', () => {
    const sql = readCode(MIG);
    assert.match(sql, /CREATE TRIGGER tournament_team_payments_online_guard\s+BEFORE INSERT OR UPDATE ON public\.tournament_team_payments/);
    assert.doesNotMatch(sql, /BEFORE[^;]*DELETE ON public\.tournament_team_payments/, 'never on DELETE: teams and tournaments cascade');
    // Every function that opens the write flag closes it again before returning.
    for (const [file, fn] of [[sql, 'online_payment_land'], [sql, 'online_payment_refund_land'],
      [readCode(MIG_12B), 'online_payment_league_land'], [readCode(MIG_12B), 'online_payment_league_open'],
      [readCode(MIG_12B_REFUNDS), 'online_payment_league_refund_book'], [readCode(MIG_12B_REFUNDS), 'online_payment_league_refund_resolve']] as const) {
      const body = fnBody(file, fn);
      assert.equal((body.match(/'flhq\.online_payment_write', 'on'/g) ?? []).length, 1, fn);
      assert.equal((body.match(/'flhq\.online_payment_write', 'off'/g) ?? []).length, 1, fn);
    }
  });

  it('the database refuses a hand write to an online payment or a refund (mig 359, review M4)', () => {
    const sql = readCode('supabase/migrations/359_an_online_payment_changes_only_through_its_landing.sql');
    assert.match(sql, /CREATE TRIGGER online_payments_guard BEFORE INSERT OR UPDATE ON public\.online_payments/);
    assert.match(sql, /CREATE TRIGGER online_payment_refunds_guard BEFORE INSERT OR UPDATE ON public\.online_payment_refunds/);
    assert.doesNotMatch(sql, /BEFORE[^;]*DELETE ON public\.online_payment/, 'never on DELETE: organizations cascade');
    // The one function that marks a payment paid without landing it opens and closes the flag too.
    const failed = /FUNCTION public\.online_payment_land_failed\([\s\S]*?\nEND \$\$;/.exec(sql)?.[0] ?? '';
    assert.match(failed, /'flhq\.online_payment_write', 'on'/);
    assert.match(failed, /'flhq\.online_payment_write', 'off'/);
    // Mig 374 keeps both guards and adds the children's; none fires on DELETE.
    const sql12b = readCode(MIG_12B);
    assert.match(sql12b, /CREATE TRIGGER online_payment_items_guard BEFORE INSERT OR UPDATE ON public\.online_payment_items/);
    assert.doesNotMatch(sql12b, /BEFORE[^;]*DELETE ON public\.online_payment/, 'never on DELETE: organizations cascade');
  });

  it('no app code writes an online-payment book line or marks an online payment paid itself', () => {
    for (const f of appCode()) {
      if (f === LANDING) continue;
      const code = readCode(f);
      assert.doesNotMatch(code, /source_module:\s*['"]online_payment['"]/, `${f} writes an online-payment book line`);
      assert.doesNotMatch(code, /from\(['"]online_payments['"]\)[\s\S]{0,200}\.update\([^)]*status:\s*['"](paid|refunded)['"]/,
        `${f} marks an online payment paid or refunded — only the landing does`);
    }
  });

  it('FieldLogicHQ’s fee is never refunded (owner 2026-10-25, plan §0c)', () => {
    for (const f of appCode()) {
      const code = readCode(f);
      assert.doesNotMatch(code, /refund_application_fee/, `${f} refunds the application fee`);
      assert.doesNotMatch(code, /applicationFees\.createRefund/, `${f} refunds the application fee`);
    }
  });
});

describe('every online-payments door reads the launch switch', () => {
  it('a route that talks to Stripe Connect or the landing asks onlinePaymentsOn() first — except the two webhooks', () => {
    const doors = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx')].filter(f => {
      const code = readCode(f);
      return /from ['"]@\/lib\/(stripe-connect|online-payment-landing)['"]|from ['"](\.\.\/)+lib\/(stripe-connect|online-payment-landing)['"]/.test(code);
    });
    for (const f of doors) {
      if (WEBHOOKS.includes(f)) continue;
      assert.match(readCode(f), /onlinePaymentsOn\(/, `${f} opens an online-payments door without reading the switch`);
    }
  });

  it('Stripe Connect is reached only through lib/stripe-connect.ts', () => {
    for (const f of appCode()) {
      if (f === 'lib/stripe-connect.ts') continue;
      const code = readCode(f);
      assert.doesNotMatch(code, /stripeAccount:\s/, `${f} calls Stripe on a connected account directly`);
      assert.doesNotMatch(code, /\.accountLinks\.create|\.accounts\.(create|createLoginLink)\(/, `${f} creates Connect objects directly`);
      // Accounts v2 (plan §0d): the accounts, their links, event destinations and thin events.
      assert.doesNotMatch(code, /\bv2\.core\.(accounts|accountLinks|eventDestinations)\b/, `${f} calls Stripe's v2 accounts directly`);
      assert.doesNotMatch(code, /\.parseEventNotification(Async)?\(/, `${f} reads a thin Connect event directly`);
    }
  });

  it('only account creation uses the preview API version; every other Connect call stays on the pinned one', () => {
    const code = readCode('lib/stripe-connect.ts');
    assert.equal((code.match(/apiVersion: CONNECT_ACCOUNT_API_VERSION/g) ?? []).length, 1);
    const create = /export async function createClubAccount[\s\S]*?\n}\n/.exec(code)?.[0] ?? '';
    assert.match(create, /apiVersion: CONNECT_ACCOUNT_API_VERSION/, 'the preview version belongs to account creation');
    // The v2 onboarding link: on the pinned version `configurations` is required (probe 2026-10-25).
    assert.match(code, /configurations: \['merchant'\]/);
  });

  it('the four account rulings are in the one creation call (plan §0c, §0d)', () => {
    const create = /export async function createClubAccount[\s\S]*?\n}\n/.exec(readCode('lib/stripe-connect.ts'))?.[0] ?? '';
    assert.match(create, /dashboard: 'express'/);
    assert.match(create, /fees_collector: 'application'/);
    assert.match(create, /losses_collector: 'stripe'/);
    assert.match(create, /idempotencyKey: `club-account:\$\{args\.orgId\}`/);
    // One fixed body under that key: what Stripe's form is handed goes in a separate call (/review 2026-10-25).
    assert.doesNotMatch(create, /profile/);
  });
});
