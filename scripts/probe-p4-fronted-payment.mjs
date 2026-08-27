/**
 * P4 integration probe — a payment learns who paid it (mig 267).
 *
 * ⚠⚠ IT DRIVES THE REAL HTTP ROUTES, with a real coach session, exactly as the coach's own button
 * does — auth, capability check, season re-assertion and writer all included. The unit tests beside
 * it pin the PURE arithmetic (`effectivePayerId`, `expenseTotals`, `ledgerReversalPreview`), and no
 * pure test can tell you that a credit actually lands in `rep_dues_credits`, that a second household
 * gets its own row rather than a merged one, or that the paid-out floor actually refuses. This can.
 *
 * ⚠ IT CANNOT IMPORT `lib/db.ts` DIRECTLY, and that is a fact worth recording rather than working
 * around: `lib/db.ts` uses a TypeScript parameter property, which Node's strip-only TS mode refuses
 * outright. So the money writers are unreachable from a plain script — the same shape as the
 * `server-only` import that kept `lib/rep-season-rollover.ts` untested until a real defect shipped
 * through it. Going through the routes is the honest way in, and it tests more.
 *
 * Writes to DEV only, and removes every row it creates on the way out — including on failure.
 *
 *   node scripts/probe-p4-fronted-payment.mjs [orgSlug] [teamId]
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = path.join(ROOT, 'tests/uat/.auth/coach.json');
const BASE = process.env.UAT_BASE_URL ?? 'http://localhost:3000';
const PROD_REF = 'qcttcboqysynwcdyghil';

function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    const k = line.slice(0, at).trim();
    if (!process.env[k]) process.env[k] = line.slice(at + 1).trim();
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (url.includes(PROD_REF)) {
  console.error('❌ Refusing to run against PRODUCTION.');
  process.exit(1);
}
if (!existsSync(SESSION)) {
  console.error(`✗ No coach session at ${path.relative(ROOT, SESSION)} — run the UAT auth setup first.`);
  process.exit(1);
}

const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let failures = 0;
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures += 1;
};
const cents = n => Math.round(Number(n) * 100);

const [argOrg, argTeam] = process.argv.slice(2);
const { data: org } = await db.from('organizations').select('id, slug')
  .eq('slug', argOrg ?? 'uat-test-org').single();
const { data: team } = argTeam
  ? await db.from('rep_teams').select('id, name, org_id').eq('id', argTeam).single()
  : await db.from('rep_teams').select('id, name, org_id').eq('org_id', org.id).limit(1).single();
const { data: py } = await db.from('rep_program_years')
  .select('id').eq('team_id', team.id).eq('status', 'active').limit(1).single();
const { data: players } = await db.from('rep_roster_players')
  .select('id, player_first_name').eq('program_year_id', py.id).eq('status', 'active')
  .order('display_order').limit(2);

const today = new Date().toISOString().slice(0, 10);
const created = { expenseId: null, payoutIds: [] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: JSON.parse(readFileSync(SESSION, 'utf8')), baseURL: BASE });
const api = `${BASE}/api/coaches/${org.slug}/teams/${team.id}`;

const post = async (path, body) => {
  const res = await ctx.request.post(`${api}${path}`, { data: body });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
};
const del = async path => {
  const res = await ctx.request.delete(`${api}${path}`);
  return { status: res.status(), body: await res.json().catch(() => ({})) };
};
const creditFor = async playerId => {
  const { data } = await db.from('rep_dues_credits')
    .select('id, amount').eq('expense_id', created.expenseId)
    .eq('credit_type', 'reimbursement').eq('player_id', playerId).maybeSingle();
  return data;
};

async function cleanup() {
  for (const id of created.payoutIds) await db.from('rep_dues_payouts').delete().eq('id', id);
  if (created.expenseId) await db.from('rep_team_expenses').delete().eq('id', created.expenseId);
  await browser.close();
}

try {
  console.log(`\nP4 probe — ${team.name} / ${org.slug}`);

  /* ⚠ THE COST MUST NAME AN ITEM. The route refuses one that does not ("Pick a category and item")
     whenever the team has any categories at all — so the probe borrows the filing an existing cost
     already uses rather than inventing one. Reaching for the route's own refusal here is the point:
     a probe that bypassed it would not be exercising the door a coach uses. */
  const { data: filed } = await db.from('rep_team_expenses')
    .select('budget_item_id, budget_category_id, category')
    .eq('program_year_id', py.id).not('budget_item_id', 'is', null).limit(1).maybeSingle();

  // A throwaway two-piece commitment: the owner's own case, $200 + $400.
  const made = await post('/expenses', {
    expenseType: 'tournament_payable',
    description: 'P4 PROBE — delete me',
    budgetItemId: filed?.budget_item_id ?? null,
    category: filed?.category ?? null,
    installments: [{ amount: 200, dueDate: today }, { amount: 400, dueDate: today }],
  });
  if (made.status !== 201 && made.status !== 200) {
    throw new Error(`could not create the probe commitment (${made.status}): ${JSON.stringify(made.body)}`);
  }
  created.expenseId = made.body.expense?.id ?? made.body.id;
  if (!created.expenseId) throw new Error(`no expense id came back: ${JSON.stringify(made.body)}`);
  const pay = `/expenses/${created.expenseId}/payments`;

  // ── 1. A fronted payment mints the credit and posts NO ledger entry ─────────────────────────
  const deposit = await post(pay, {
    amount: 200, paidDate: today, method: 'etransfer', paidByPlayerId: players[0].id,
  });
  check(deposit.status === 201, 'the route accepts a payer on a payment', `HTTP ${deposit.status} ${JSON.stringify(deposit.body)}`);
  const depositId = deposit.body.payment?.id;
  const { data: depRow } = await db.from('rep_payable_payments')
    .select('accounting_entry_id, paid_by_player_id').eq('id', depositId).maybeSingle();
  check(depRow?.accounting_entry_id === null,
    'a fronted payment posts NO ledger entry — the team\'s cash never moved',
    `entry ${depRow?.accounting_entry_id}`);
  check(depRow?.paid_by_player_id === players[0].id, 'the payment remembers who paid it');
  check(cents((await creditFor(players[0].id))?.amount ?? 0) === 20000,
    'the household is owed $200.00 on Player Dues');

  // ── 2. The team's own payment on the SAME bill still posts one ──────────────────────────────
  const balance = await post(pay, { amount: 400, paidDate: today, method: 'etransfer' });
  const { data: balRow } = await db.from('rep_payable_payments')
    .select('accounting_entry_id').eq('id', balance.body.payment?.id).maybeSingle();
  check(!!balRow?.accounting_entry_id,
    'the team\'s own payment on the SAME bill DOES post one — one bill, both kinds');
  check(cents((await creditFor(players[0].id))?.amount ?? 0) === 20000,
    'and it did NOT grow the family\'s credit');

  // ── 3. A second household fronting the same bill gets its OWN credit ────────────────────────
  const extra = await post(pay, {
    amount: 50, paidDate: today, method: 'cash', paidByPlayerId: players[1].id,
  });
  check(cents((await creditFor(players[1].id))?.amount ?? 0) === 5000,
    'a SECOND household fronting the same bill gets its own credit, not a merged one');
  check(cents((await creditFor(players[0].id))?.amount ?? 0) === 20000,
    'and the first household\'s figure is untouched');

  // ── 4. A payer disagreeing with a COST-level payer is refused ───────────────────────────────
  {
    const { data: oop } = await db.from('rep_team_expenses')
      .select('id').eq('program_year_id', py.id).not('paid_by_player_id', 'is', null).limit(1).maybeSingle();
    if (oop) {
      const clash = await post(`/expenses/${oop.id}/payments`, {
        amount: 5, paidDate: today, paidByPlayerId: players[1].id,
      });
      check(clash.status === 409,
        'a payment naming a DIFFERENT household than the cost is refused, not silently overruled',
        `HTTP ${clash.status}`);
    } else {
      console.log('  · no out-of-pocket cost on this fixture — collision case not probed');
    }
  }

  // ── 5. Undo takes the credit back ───────────────────────────────────────────────────────────
  const undone = await del(`${pay}/${extra.body.payment?.id}`);
  check(undone.status === 200, 'undo succeeds', `HTTP ${undone.status}`);
  check(!(await creditFor(players[1].id)),
    'undoing the only fronted payment REMOVES that household\'s credit entirely');

  /* ── 6. ⚠⚠ THE PAID-OUT FLOOR ───────────────────────────────────────────────────────────────
     ⚠ THE GUARD IS PER HOUSEHOLD, NOT PER CREDIT, and the first draft of this probe got that
     wrong — it handed the family $200 and expected a refusal, but that family was owed $380 in
     OTHER credits, so their remaining balance still covered the payout and letting the undo
     through was CORRECT. Payouts are not linked to individual credits (rep_dues_payouts has no
     credit_id and must never have one), so the only exact question is "would this household's
     remaining credits still cover what has already gone out?". To make the answer no, the payout
     has to exceed everything they are owed apart from this deposit. */
  const { data: otherCredits } = await db.from('rep_dues_credits')
    .select('amount, credit_type, expense_id')
    .eq('program_year_id', py.id).eq('player_id', players[0].id);
  const otherCents = (otherCredits ?? [])
    .filter(c => c.credit_type !== 'forgiven')
    .filter(c => !(c.credit_type === 'reimbursement' && c.expense_id === created.expenseId))
    .reduce((s, c) => s + cents(c.amount), 0);
  const payoutAmount = (otherCents + 20000) / 100; // everything they are owed, this deposit included

  const { data: payout, error: payoutErr } = await db.from('rep_dues_payouts').insert({
    program_year_id: py.id, player_id: players[0].id, org_id: org.id, team_id: team.id,
    amount: payoutAmount, paid_date: today, method: 'cash',
  }).select('id').single();
  if (payoutErr) {
    console.log(`  · payout insert failed (${payoutErr.message}) — floor case not probed`);
    failures += 1;
  } else {
    created.payoutIds.push(payout.id);
    const refused = await del(`${pay}/${depositId}`);
    check(refused.status === 409,
      '⚠⚠ undoing a payment whose credit was ALREADY PAID OUT is refused',
      `HTTP ${refused.status} — ${refused.body.error ?? 'it went through, and the team is silently out the money'}`);
    check(!!(await creditFor(players[0].id)),
      'the refusal came BEFORE anything was written — the credit still stands');
    const { data: survived } = await db.from('rep_payable_payments')
      .select('id').eq('id', depositId).maybeSingle();
    check(!!survived, 'and the payment itself survived it — nothing is half-undone');

    /* ── 6b. THE SAME FLOOR ON DELETE, which had NO gate at all until `/review` found it ────────
       Deleting the whole cost cascades every reimbursement credit it carries away. Without this
       check a family already handed that money back in cash was left with the payout pointing at
       nothing, and the loss clamped silently to zero. */
    const deleted = await ctx.request.delete(`${api}/expenses/${created.expenseId}`);
    check(deleted.status() === 409,
      '⚠⚠ DELETING the whole cost is refused on the same grounds — the credit would cascade away',
      `HTTP ${deleted.status()}`);
    const { data: costSurvived } = await db.from('rep_team_expenses')
      .select('id').eq('id', created.expenseId).maybeSingle();
    check(!!costSurvived, 'and the cost itself survived the refusal — the books were not touched');

    await db.from('rep_dues_payouts').delete().eq('id', payout.id);
    created.payoutIds = [];
    const nowOk = await del(`${pay}/${depositId}`);
    check(nowOk.status === 200 && !(await creditFor(players[0].id)),
      'once the payout is undone the same undo goes through — a gate, not a wall');
  }
} catch (e) {
  console.error('\n✗ probe threw:', e?.message ?? e);
  failures += 1;
} finally {
  await cleanup();
}

console.log(failures === 0
  ? '\n✓ P4 write paths behave — credit minted, split per household, unwound, and the payout floor holds.\n'
  : `\n✗ ${failures} P4 check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
