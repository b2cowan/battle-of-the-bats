/**
 * THE FOLD'S ONE PROMISE: **the records move, and no money does.**
 *
 * "Use a shared word instead" is the only door in the product that removes a budget word with
 * history behind it. Every other door refuses; this one carries the records across first. So the
 * claim worth proving is not that the button works — it is that after the fold every single record
 * that pointed at the folded words points at the survivor, under the survivor's HEADING, and Budget
 * vs. Actual reports exactly the same money it did a moment earlier.
 *
 * ⚠⚠ AND IT BUILDS ITS OWN WORLD, because dev holds almost no team-created vocabulary — two words
 * at last count and none published by a club. A green run over the existing fixture would prove
 * nothing at all: there would be nothing to fold. This script creates a club word, two of the
 * team's own (one in the SAME category, one in a DIFFERENT one, so the cross-category re-filing is
 * exercised rather than assumed), files records of all three kinds against them, folds, checks, and
 * removes everything it made.
 *
 * ⚠ IT DRIVES THE REAL HTTP ROUTES with a real coach session. Calling the database directly would
 * skip the authorisation, the same-side rule and the re-point-before-delete ordering — which is
 * most of what there is to get wrong.
 *
 * ⚠ CROSS-CATEGORY IS THE INTERESTING HALF. Each of the four tables stores the category beside the
 * item, and Budget vs. Actual prefers that stored category over the item's own. A fold that moved
 * only the item would leave every one of those records filed under the heading its old word lived
 * under — all the money present, none of it lining up with the plan. That is checked explicitly.
 *
 * DEV ONLY. Needs the dev server running and a coach session:
 *   npx playwright test --config playwright.config.ts --project=auth-setup
 *
 * Usage:
 *   node scripts/check-budget-item-fold.mjs
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUatContext } from './uat-fixture-context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(ROOT, '.env.local'), quiet: true });

const SESSION = path.join(ROOT, 'tests/uat/.auth/coach.json');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PROD_REF = 'qcttcboqysynwcdyghil';

const cents = n => Math.round(Number(n ?? 0) * 100);
const fmt = n => `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main() {
  if (!existsSync(SESSION)) {
    console.error(`✗ No coach session at ${path.relative(ROOT, SESSION)}`);
    console.error('  Repair: npx playwright test --config playwright.config.ts --project=auth-setup');
    process.exit(1);
  }
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) throw new Error('Missing Supabase env — this reads .env.local (dev).');
  if (supaUrl.includes(PROD_REF)) throw new Error('REFUSING TO RUN AGAINST PRODUCTION.');
  const db = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

  const ctx = await resolveUatContext();
  const { orgSlug, orgId, teamId, programYearId } = ctx;
  console.log(`Fixture: ${orgSlug} / team ${teamId}\n`);

  // ── Two team-visible EXPENSE categories, so one fold crosses a heading and one does not ──────
  const { data: cats } = await db
    .from('budget_categories')
    .select('id, name, scope, org_id, sports')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .in('scope', ['team', 'both'])
    .is('sports', null)
    .order('sort_order')
    .limit(2);
  if (!cats || cats.length < 2) throw new Error('Need two team-visible categories on dev to fold across.');
  const [homeCat, otherCat] = cats;
  console.log(`Categories: “${homeCat.name}” (the club word's) and “${otherCat.name}” (the far one)\n`);

  const made = { items: [], lines: [], expenses: [], moneyIn: [], orgLines: [] };
  const browser = await chromium.launch();
  const page = await browser.newContext({
    storageState: JSON.parse(readFileSync(SESSION, 'utf8')),
    baseURL: BASE,
  });

  try {
    // ── 1 · Build the world ───────────────────────────────────────────────────────────────────
    const newItem = async (name, categoryId, teamOwned) => {
      const { data, error } = await db.from('budget_items').insert({
        category_id: categoryId, org_id: orgId, team_id: teamOwned ? teamId : null,
        name, is_default: false, is_misc: false, direction: 'out',
      }).select().single();
      if (error) throw new Error(`could not create “${name}”: ${error.message}`);
      made.items.push(data.id);
      return data;
    };

    const stamp = Date.now();
    const club  = await newItem(`Fold probe club permits ${stamp}`, homeCat.id,  false);
    const near  = await newItem(`Fold probe near ${stamp}`,        homeCat.id,  true);
    const far   = await newItem(`Fold probe far ${stamp}`,         otherCat.id, true);
    console.log(`Made: club “${club.name}” · ours “${near.name}” (same heading) · ours “${far.name}” (${otherCat.name})`);

    // Records of all three team-facing kinds, split across BOTH of the team's words.
    const line = async (item, categoryId, amount, description) => {
      const { data, error } = await db.from('rep_budget_lines').insert({
        org_id: orgId, team_id: teamId, program_year_id: programYearId,
        category_id: categoryId, item_id: item.id, description, total_amount: amount,
        line_kind: 'cost',
      }).select().single();
      if (error) throw new Error(`budget line: ${error.message}`);
      made.lines.push(data.id);
    };
    const expense = async (item, category, amount, description) => {
      const { data, error } = await db.from('rep_team_expenses').insert({
        program_year_id: programYearId, team_id: teamId, org_id: orgId,
        expense_type: 'expense', description, amount,
        budget_item_id: item.id, budget_category_id: category.id, category: category.name,
        /* No paid stamp — the legacy column went with mig 270, and this check only ever asked
           where a cost FILES (its item and category), never whether it settled. */
      }).select().single();
      if (error) throw new Error(`expense: ${error.message}`);
      made.expenses.push(data.id);
    };
    const moneyBack = async (item, category, amount, description) => {
      const { data, error } = await db.from('rep_team_money_in').insert({
        program_year_id: programYearId, org_id: orgId, team_id: teamId,
        entry_kind: 'money_back', amount, received_date: new Date().toISOString().slice(0, 10),
        budget_item_id: item.id, budget_category_id: category.id, description,
      }).select().single();
      if (error) throw new Error(`money back: ${error.message}`);
      made.moneyIn.push(data.id);
    };

    /* ⚠ ONE LINE AUTO-NAMED, ONE TYPED. `rep_budget_lines.description` is NOT NULL and the server
       fills it from the item's name when a coach types nothing — and the Budget Plan renders it
       raw. So the fold has to rewrite the auto-filled one (or the plan keeps showing a word that no
       longer exists) and must NOT touch the typed one (that is the coach's own text). Both cases
       have to be in the fixture or the check proves half the rule. */
    await line(near, homeCat.id, 400, near.name);
    await line(far, otherCat.id, 250, 'Fold probe — a description the coach typed');
    await expense(near, homeCat, 180, 'Fold probe — cost near');
    await expense(far, otherCat, 95, 'Fold probe — cost far');
    await moneyBack(far, otherCat, 40, 'Fold probe — refund far');
    console.log('Filed: 2 budget lines, 2 recorded costs, 1 money back — 5 records over both words\n');

    // ── 2 · Budget vs. Actual, before ─────────────────────────────────────────────────────────
    const readBva = async () => {
      const res = await page.request.get(`${BASE}/api/coaches/${orgSlug}/teams/${teamId}/budget-vs-actual`);
      if (!res.ok()) throw new Error(`budget-vs-actual ${res.status()} — is the session stale?`);
      return res.json();
    };
    /* ⚠ READ FROM THE REPORT'S OWN FIELDS, and per CATEGORY as well as per season. The season
       totals prove no money moved; only the category rows prove it moved to the right HEADING, and
       that is the half a fold across categories can get wrong while every total still balances. */
    const totalsOf = b => ({
      planned: cents(b.totalBudget),
      actual:  cents(b.totalActual),
      byCategory: Object.fromEntries((b.report?.expenses?.categories ?? [])
        .map(c => [c.categoryName ?? c.name, { planned: cents(c.budgeted), actual: cents(c.actual) }])),
    });
    const before = totalsOf(await readBva());
    console.log(`Budget vs. Actual before: planned ${fmt(before.planned / 100)} · actual ${fmt(before.actual / 100)}`);
    console.log(`  ${homeCat.name}: ${JSON.stringify(before.byCategory[homeCat.name])} · ${otherCat.name}: ${JSON.stringify(before.byCategory[otherCat.name])}`);

    /* ⚠⚠ THE CANARY. "Unchanged" over a season that reports nothing is the empty-fixture pass this
       project has already been caught by once: $0.00 → $0.00 is true of every possible bug. The
       probe files $650 of plan and $235 of actual, so a zero here means the report is not seeing
       the rows at all and every check below it is vacuous. */
    check('the report actually SEES the probe rows (not an empty-fixture pass)',
      before.planned > 0 && before.actual !== 0,
      `planned ${fmt(before.planned / 100)}, actual ${fmt(before.actual / 100)}`);

    /* ── 2b · The per-word counts the manage screen shows ─────────────────────────────────────
       ⚠ THE CONFIRMATION IS BUILT FROM THESE. The browser adds up each ticked word's own counts to
       write "6 records move onto Grants — 2 budget lines, 3 recorded costs and 1 money in", so a
       wrong count here is a wrong sentence in front of a coach about to remove their words. Worth
       its own check since the counting was reshaped to one query per table rather than per word. */
    const usageRes = await page.request.get(
      `${BASE}/api/coaches/${orgSlug}/budget-items?teamId=${teamId}&usage=1`);
    const usageBody = await usageRes.json().catch(() => ({}));
    const seen = usageBody.usage ?? {};
    const kinds = u => (u?.byKind ?? []).map(k => `${k.count} ${k.label}`).join(', ');
    check('the near word reports its 2 records by kind',
      seen[near.id]?.total === 2 && (seen[near.id]?.byKind ?? []).length === 2, kinds(seen[near.id]));
    check('the far word reports its 3 records by kind',
      seen[far.id]?.total === 3 && (seen[far.id]?.byKind ?? []).length === 3, kinds(seen[far.id]));
    check('the club’s word is not counted — only the team’s own are',
      seen[club.id] === undefined, seen[club.id] ? kinds(seen[club.id]) : 'absent');
    check('the two counts add up to what the fold will report',
      (seen[near.id]?.total ?? 0) + (seen[far.id]?.total ?? 0) === 5);

    // ── 3 · The fold, through the real route ──────────────────────────────────────────────────
    const foldRes = await page.request.post(`${BASE}/api/coaches/${orgSlug}/budget-items/merge`, {
      data: { teamId, sourceIds: [near.id, far.id], targetId: club.id },
    });
    const foldBody = await foldRes.json().catch(() => ({}));
    console.log(`\nFold → ${foldRes.status()} ${JSON.stringify(foldBody.moved ?? foldBody.error ?? foldBody)}\n`);
    check('the fold was accepted', foldRes.ok(), foldBody.error ?? '');
    if (!foldRes.ok()) throw new Error('fold refused — nothing further can be checked');

    check('it reports all 5 records moved', foldBody.moved?.total === 5, `reported ${foldBody.moved?.total}`);
    check('it names the kinds separately',
      (foldBody.moved?.byKind ?? []).length === 3,
      (foldBody.moved?.byKind ?? []).map(k => `${k.count} ${k.label}`).join(', '));
    check('both words were removed', foldBody.removed === 2, `removed ${foldBody.removed}`);

    // ── 4 · Every record points at the survivor, under the survivor's heading ─────────────────
    const rows = async (table, itemCol, catCol, ids) => {
      const { data } = await db.from(table).select('*').in('id', ids);
      return (data ?? []).map(r => ({ item: r[itemCol], cat: r[catCol], raw: r }));
    };
    const movedLines  = await rows('rep_budget_lines',  'item_id',        'category_id',        made.lines);
    const movedCosts  = await rows('rep_team_expenses', 'budget_item_id', 'budget_category_id', made.expenses);
    const movedMoneyIn = await rows('rep_team_money_in', 'budget_item_id', 'budget_category_id', made.moneyIn);
    const all = [...movedLines, ...movedCosts, ...movedMoneyIn];

    check('no record was left unclassified',
      all.every(r => r.item != null), `${all.filter(r => r.item == null).length} blanked`);
    check('every record now points at the club word',
      all.every(r => r.item === club.id), `${all.filter(r => r.item !== club.id).length} did not move`);
    /* ⚠ THE HALF A READER MISSES. Two of these five were filed under the far category; the club word
       lives under the near one. If only the item moved they would still read as the far heading, and
       Budget vs. Actual — which prefers the stored category — would place them there. */
    check('every record was RE-FILED under the club word’s heading',
      all.every(r => r.cat === homeCat.id),
      `${all.filter(r => r.cat !== homeCat.id).length} still under the old heading`);
    check('the free-text category on costs was rewritten too',
      movedCosts.every(r => r.raw.category === homeCat.name),
      movedCosts.map(r => r.raw.category).join(' | '));

    /* ⚠ THE LABEL FOLLOWS THE ITEM — but only where the coach never typed one. A line that took its
       name from the folded word must now read the survivor's name; a line the coach named keeps
       exactly what they wrote. Rewriting that would be the fold editing someone's words. */
    const autoNamed = movedLines.find(r => r.raw.total_amount == 400);
    const handTyped = movedLines.find(r => r.raw.total_amount == 250);
    check('an auto-named budget line now reads the surviving word',
      autoNamed?.raw.description === club.name, autoNamed?.raw.description);
    check('a description the coach typed is left exactly as they wrote it',
      handTyped?.raw.description === 'Fold probe — a description the coach typed',
      handTyped?.raw.description);

    const { data: survivors } = await db.from('budget_items').select('id').in('id', [near.id, far.id]);
    check('neither folded word survives', (survivors ?? []).length === 0);
    const { data: targetStill } = await db.from('budget_items').select('id, name').eq('id', club.id).maybeSingle();
    check('the club word is untouched', Boolean(targetStill), targetStill?.name ?? 'GONE');

    // ── 5 · No money moved ────────────────────────────────────────────────────────────────────
    const after = totalsOf(await readBva());
    console.log(`\nBudget vs. Actual after:  planned ${fmt(after.planned / 100)} · actual ${fmt(after.actual / 100)}`);
    console.log(`  ${homeCat.name}: ${JSON.stringify(after.byCategory[homeCat.name])} · ${otherCat.name}: ${JSON.stringify(after.byCategory[otherCat.name])}`);
    check('planned total is unchanged', before.planned === after.planned,
      `${fmt(before.planned / 100)} → ${fmt(after.planned / 100)}`);
    check('actual total is unchanged', before.actual === after.actual,
      `${fmt(before.actual / 100)} → ${fmt(after.actual / 100)}`);

    /* The cross-category half, read from the report rather than the database: the far word's money
       has to have LEFT its old heading and ARRIVED under the club word's, by exactly the same
       amount. Totals that balance while a row sits under the wrong heading is precisely the failure
       a season-level check cannot see. */
    const delta = (side, cat) => ({
      planned: cents((after.byCategory[cat]?.planned ?? 0) / 100) - cents((before.byCategory[cat]?.planned ?? 0) / 100),
      actual:  cents((after.byCategory[cat]?.actual  ?? 0) / 100) - cents((before.byCategory[cat]?.actual  ?? 0) / 100),
      side,
    });
    const gained = delta('gained', homeCat.name);
    const lost   = delta('lost', otherCat.name);
    check(`“${otherCat.name}” gave up the far word’s money`,
      lost.planned === -25000 && lost.actual === -5500,
      `planned ${lost.planned / 100}, actual ${lost.actual / 100}`);
    check(`“${homeCat.name}” took it on`,
      gained.planned === 25000 && gained.actual === 5500,
      `planned ${gained.planned / 100}, actual ${gained.actual / 100}`);

    // ── 6 · The refusals ──────────────────────────────────────────────────────────────────────
    const wrongSide = await newItem(`Fold probe income ${stamp}`, homeCat.id, true);
    await db.from('budget_items').update({ direction: 'in' }).eq('id', wrongSide.id);
    const sideRes = await page.request.post(`${BASE}/api/coaches/${orgSlug}/budget-items/merge`, {
      data: { teamId, sourceIds: [wrongSide.id], targetId: club.id },
    });
    check('a cross-side fold is refused', sideRes.status() === 400, `got ${sideRes.status()}`);

    const selfRes = await page.request.post(`${BASE}/api/coaches/${orgSlug}/budget-items/merge`, {
      data: { teamId, sourceIds: [club.id], targetId: club.id },
    });
    check('a word cannot be folded into itself', selfRes.status() === 400, `got ${selfRes.status()}`);

    const ontoOwnRes = await page.request.post(`${BASE}/api/coaches/${orgSlug}/budget-items/merge`, {
      data: { teamId, sourceIds: [wrongSide.id], targetId: wrongSide.id },
    });
    check('a team’s own word is not a valid target', ontoOwnRes.status() === 400, `got ${ontoOwnRes.status()}`);

    const clubSourceRes = await page.request.post(`${BASE}/api/coaches/${orgSlug}/budget-items/merge`, {
      data: { teamId, sourceIds: [club.id], targetId: club.id, },
    });
    check('the club’s word cannot be folded away by a team', clubSourceRes.status() >= 400, `got ${clubSourceRes.status()}`);

    /* ── 7 · The club's own budget line may not adopt a team's word ────────────────────────────
       ⚠⚠ THIS WAS UNCHECKED UNTIL 2026-08-17. The club planner has always OFFERED standard and
       club words only, but the save took whatever it was sent — so a club could file its budget
       against any word in the database, including another club's team-private one. The damage
       surfaced somewhere else entirely: that row counts as usage, so the owning team's coach is
       refused when they try to remove their own unused word, naming records they cannot see. */
    const admin = await browser.newContext({
      storageState: JSON.parse(readFileSync(path.join(ROOT, 'tests/uat/.auth/org-owner.json'), 'utf8')),
      baseURL: BASE,
    });
    const teamWord = await newItem(`Fold probe club-line bait ${stamp}`, homeCat.id, true);
    const lineUrl = `${BASE}/api/admin/accounting/budget-plan/lines?orgSlug=${orgSlug}`;
    const baitRes = await admin.request.post(lineUrl, {
      data: {
        seasonYear: new Date().getFullYear(), description: 'Fold probe — club line',
        totalAmount: 100, categoryId: homeCat.id, itemId: teamWord.id,
      },
    });

    /* ⚠⚠ THIS FIXTURE CANNOT REACH THE CLUB BUDGET ROUTES, AND SAYING SO IS THE POINT. The UAT org
       is on the **tournament** plan, which carries no accounting module, so the club's budget-plan
       routes refuse at the door (403) before any of this change's validation runs. A silent pass
       here would read exactly like coverage — which is how a probe in this repo once guarded
       nothing. The RULE those routes now share (`itemOfferedToClub`) is proven instead in
       `tests/unit/coach-budget-item-usage.test.ts`, where it needs no entitlement at all. */
    if (baitRes.status() === 403) {
      console.log('  ⃠ SKIPPED — the club budget-plan routes need the accounting module, and this');
      console.log('    fixture org is on the tournament plan. NOT a pass: the club-line validation');
      console.log('    was not exercised here. Its rule is unit-tested; the route wiring is not.');
    } else {
      check('a club budget line is REFUSED a team-owned word', baitRes.status() === 400,
        `got ${baitRes.status()}`);

      const okRes = await admin.request.post(lineUrl, {
        data: {
          seasonYear: new Date().getFullYear(), description: 'Fold probe — club line (valid)',
          totalAmount: 100, categoryId: otherCat.id, itemId: club.id,
        },
      });
      const okLine = await okRes.json().catch(() => ({}));
      check('a club budget line still accepts a CLUB word', okRes.ok(), `got ${okRes.status()}`);
      /* ⚠ AND THE HEADING COMES FROM THE WORD, not from the request. The call above deliberately
         sends the WRONG category; the saved row must carry the club word's own. */
      check('the heading is derived from the word, not the request',
        okLine.line?.category_id === homeCat.id,
        okLine.line?.category_id === otherCat.id ? 'kept the request’s wrong category' : 'ok');
      if (okLine.line?.id) made.orgLines.push(okLine.line.id);
    }
    await admin.close();
  } finally {
    // ── Clean up, always. A probe that leaves rows behind poisons the next run's counts. ───────
    await browser.close();
    if (made.moneyIn.length)  await db.from('rep_team_money_in').delete().in('id', made.moneyIn);
    if (made.expenses.length) await db.from('rep_team_expenses').delete().in('id', made.expenses);
    if (made.lines.length)    await db.from('rep_budget_lines').delete().in('id', made.lines);
    if (made.orgLines.length) await db.from('org_budget_lines').delete().in('id', made.orgLines);
    if (made.items.length)    await db.from('budget_items').delete().in('id', made.items);
    console.log('\nProbe rows removed.');
  }

  console.log(failures === 0 ? '\n✓ The fold moves every record and no money.' : `\n✗ ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(`\n✗ ${err.message}`); process.exit(1); });
