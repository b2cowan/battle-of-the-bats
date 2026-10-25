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
 * ⚠ The two Connect webhooks are the ONLY doors exempt from the switch: money Stripe already took must still land, a
 * refund already asked for must still record, and an account Stripe closed must stop taking payments, even if the switch
 * is turned off in between. Payments arrive on one (v1 snapshot events), the account's own changes on the other (v2 thin
 * events, plan §0d).
 */

const LANDING = 'lib/online-payment-landing.ts';
const WEBHOOKS = ['app/api/payments/connect-webhook/route.ts', 'app/api/payments/connect-account-events/route.ts'];
const MIG = 'supabase/migrations/358_a_club_takes_payments_online.sql';
const LAND_RPCS = ['online_payment_land', 'online_payment_land_failed', 'online_payment_refund_open', 'online_payment_refund_land', 'online_payment_refund_failed'];

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
    for (const fn of ['online_payment_land', 'online_payment_refund_land']) {
      const body = new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?\\nEND \\$\\$;`).exec(sql)?.[0] ?? '';
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
