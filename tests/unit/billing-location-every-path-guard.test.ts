/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY STRIPE CHARGE IS ON ONE LIST — GST/HST Stage 1 Part 4, the guard
 * (build prompt docs/projects/active/GST_HST_STAGE1_PART4_BUILD_PROMPT.md; plan GST_HST_COLLECTION_PLAN.md §4 Stage 1, §7).
 *
 * Stage 2 turns tax on and promises that every paid checkout knows where the buyer is. A missing address does not fail
 * loudly: it silently becomes the wrong tax. Parts 1–3 made the promise true for the paths that existed;
 * billing-location-checkout-guard pins those five one by one. This file is what that one cannot be: a CENSUS of every Stripe
 * call that can charge or open a charge, anywhere in `app/`, `lib/` and `components/`, each on CHARGING_CALLS below as either
 *   · `checked` — the buyer's address is required before it (`requireBillingLocation`, lib/billing-location-server.ts), or
 *   · `allowed` — with the one-sentence reason it needs no address, and the facts that reason rests on.
 * A call on no list fails the build with a sentence that says what to do. So does a list entry whose call is gone, so a
 * deleted path leaves no stale allowance behind. And one level down: a shared helper that charges (`applyMove`) has every
 * caller pinned, because the address check lives in the caller, not the helper.
 *
 * EVERY STRIPE CHARGE CARRIES TAX, TOO — GST/HST Stage 2 Part 5 (build prompt GST_HST_STAGE2_PART5_BUILD_PROMPT.md; owner
 * 2026-11-05: one list, not a second file). Each entry also answers the TAX question, read from that call's own arguments:
 *   · `taxed` — every call of it (each one, not "somewhere in the file") carries the named setting from lib/billing-tax.ts;
 *   · `inherits` — it can set no tax itself and takes it from a taxed call the list also holds; its arguments may hold only the
 *     keys named, so it cannot quietly start changing a price;
 *   · `untaxed` — deliberately, with the reason (the short list: card setup, the club's own sale, the dead add-on, the cancel
 *     toggles, the operator's read of the next charge).
 * Quotes (`invoices.createPreview`) are on the list for tax alone: a quote that disagrees with the charge is plan §7's risk.
 * The recovered Stripe fees are TAXED (Ask 3, owner 2026-11-05: on top, at the club's province rate), not exempt.
 *
 * Left out ON PURPOSE: `scripts/` (the seed scripts create Stripe TEST subscriptions for owner walks and never run for a
 * buyer) and `tests/`. Not charges, so not matched: `subscriptions.cancel`, schedule `release`, `billingPortal.sessions.create`
 * (edits no address since Part 3), the dev-only `/api/billing/mock-apply` toggle (no Stripe call; it answers "not found" in
 * production). Reductions, not charges, so not matched: `creditNotes.create` / `.preview` (lib/platform-stripe-fees.ts reverses
 * the tax by crediting the original LINE on a taxed invoice — Part 2; the matrix proves it, Part 6), `refunds.create` (platform
 * admin's refund, and the club's own on its account), `invoiceItems.del` (a pending fee line withdrawn). `subscriptionItems.del` has
 * no caller. Tax-changing edits (`invoices.update` / `addLines` / `updateLines`, `invoiceItems.update`) ARE matched, with no caller
 * today: the day one appears it needs its entry here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AUTOMATIC_TAX, RECOVERED_FEE_TAX, TAXED_CHECKOUT } from '../../lib/billing-tax.ts';
import { CHARGE_TAX_CREDIT_NOTE_EVENTS, CHARGE_TAX_INVOICE_EVENTS } from '../../lib/charge-tax-record.ts';
import { between, filesUnder, readCode, sourceExists, stripComments } from './_source-code.ts';

/** Every Stripe method that charges, opens a charge, or quotes one, by its path on the client. */
const CHARGING_METHODS = [
  'checkout.sessions.create',
  'subscriptions.create', 'subscriptions.update', 'subscriptions.resume',
  'subscriptionSchedules.create', 'subscriptionSchedules.update',
  'subscriptionItems.create', 'subscriptionItems.update',
  'invoices.createPreview', 'invoices.create', 'invoices.update', 'invoices.addLines', 'invoices.updateLines',
  'invoices.pay', 'invoices.finalizeInvoice',
  'invoiceItems.create', 'invoiceItems.update',
  'paymentIntents.create',
  'paymentLinks.create',
] as const;

/**
 * Any reach of a charging method: `stripe.…`, `getStripe().…`, `stripe?.…`, a destructured `invoiceItems.create(`, and a
 * chain split across lines. `createPreview(` is not `create(`. Read comment-stripped code (`readCode`) only.
 */
const CHARGING = new RegExp(
  `(?<![\\w$])(${CHARGING_METHODS.map(m => m.split('.').join('\\s*\\??\\.\\s*')).join('|')})\\s*\\(`,
  'g',
);

/** The charging calls in `code`, in order, each as its method path with the spacing removed and the text of its arguments. */
function chargingCalls(code: string): { call: string; index: number; args: string }[] {
  return [...code.matchAll(CHARGING)].map(m => ({
    call: m[1].replace(/[\s?]/g, ''), index: m.index!, args: argumentsAt(code, m.index! + m[0].length - 1),
  }));
}

/**
 * The index just past the end of the literal opening at `i` (a string, a template, or a regex literal), or -1 when `i` opens
 * none. A regex is told from division by the character before it, so `s.replace(/'/g, '')` and `/\)/` do not unbalance the scan.
 */
function literalEnd(code: string, i: number): number {
  const c = code[i];
  if (c === '"' || c === "'" || c === '`') {
    for (let j = i + 1; j < code.length; j++) {
      if (code[j] === '\\') j++;
      else if (code[j] === c) return j + 1;
    }
    return code.length;
  }
  if (c === '/' && code[i + 1] !== '/' && code[i + 1] !== '*' && /[(,=:[!&|?{};]$|^$/.test(code.slice(0, i).trimEnd().slice(-1))) {
    let inClass = false;
    for (let j = i + 1; j < code.length && code[j] !== '\n'; j++) {
      if (code[j] === '\\') j++;
      else if (code[j] === '[') inClass = true;
      else if (code[j] === ']') inClass = false;
      else if (code[j] === '/' && !inClass) return j + 1;
    }
  }
  return -1;
}

/** The text between the bracket at `open` and its match (`(`…`)`, `{`…`}`), stepping over string, template and regex literals. */
function argumentsAt(code: string, open: number): string {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const end = literalEnd(code, i);
    if (end > 0) { i = end - 1; continue; }
    const c = code[i];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      depth--;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  throw new Error(`a Stripe call's arguments never close (from ${code.slice(open, open + 60)}…): the matcher is broken`);
}

/** `text` with every string, template and regex literal emptied, so a word inside one is never read as code. */
function blankLiterals(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const end = literalEnd(text, i);
    if (end > 0) { out += "''"; i = end - 1; } else out += text[i];
  }
  return out;
}

/** `text` split at its top-level commas (a comma inside brackets belongs to the part around it). Literals already blanked. */
function topLevelParts(text: string): string[] {
  const parts: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(text.slice(from, i)); from = i + 1; }
  }
  return [...parts, text.slice(from)].map(p => p.trim()).filter(Boolean);
}

/**
 * Every key a call's arguments write in an object literal at their top level (the `{ … }` arguments, and both sides of a
 * `cond ? { … } : { … }`). Anything the guard cannot read as a plain `key: value` is returned AS WRITTEN so the entry fails on
 * it: a shorthand `items`, a quoted or computed key, a spread. Arguments with no object literal at all — a variable built
 * elsewhere — return `(no object literal: the arguments are built elsewhere)`, because then the keys cannot be read here.
 */
function keysIn(args: string): string[] {
  const bare = blankLiterals(args);
  const keys: string[] = [];
  let literals = 0, depth = 0;
  for (let i = 0; i < bare.length; i++) {
    const c = bare[i];
    if (c === '{' && depth === 0) {
      literals++;
      const body = argumentsAt(bare, i);
      for (const part of topLevelParts(body)) {
        const key = part.match(/^([A-Za-z_$][\w$]*)\s*:/);
        keys.push(key ? key[1] : part.slice(0, 40));
      }
      i += body.length + 1;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
  }
  return literals ? keys : ['(no object literal: the arguments are built elsewhere)'];
}

/**
 * The ONE object literal `fn` (in `home`) returns, read to its matching brace — not "the function's text", which ran on into the
 * next exported function and could be satisfied by it. A builder with two returned objects fails: the guard would not know
 * which one Stripe gets.
 */
function returnedLiteral(code: string, fn: string, home: string): string {
  const start = code.indexOf(`function ${fn}(`);
  assert.ok(start >= 0, `${home}: function ${fn} is gone — the guard reads the checkout it builds there`);
  const params = argumentsAt(code, code.indexOf('(', start));
  const bodyOpen = code.indexOf('{', code.indexOf('(', start) + params.length + 2);
  const body = argumentsAt(code, bodyOpen);
  const returns = [...body.matchAll(/\breturn \{/g)].map(m => argumentsAt(body, m.index! + 'return '.length));
  assert.equal(returns.length, 1, `${home}: ${fn} must return ONE object literal (it returns ${returns.length}); the guard reads its tax there`);
  assert.match(returns[0], /mode: 'subscription'/, `${home}: ${fn} builds a subscription checkout; the guard reads it as one`);
  return returns[0];
}

/** The keys that decide tax. A taxed call writes each exactly as often as its `needs` do, so nothing later in it overrides them. */
const TAX_KEYS = ['automatic_tax', 'tax_behavior', 'tax_code'];
const keyCount = (text: string, key: string) => (text.match(new RegExp(`(?<![\\w$.])${key}\\s*:`, 'g')) ?? []).length;
/** `need` written as code in `text` (literals blanked), not as a prefix of a longer name. */
const writes = (text: string, need: string) =>
  new RegExp(`${need.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`).test(blankLiterals(text));

/** `checked` with a `helper`: the check lives in that helper's callers (HELPER_CALLERS), not in the file. */
type Entry = { file: string; call: string; count: number; facts?: RegExp[]; tax: Tax } & (
  | { checked: string; helper?: keyof typeof HELPER_CALLERS }
  | { allowed: string }
);

/**
 * The tax answer (Part 5). `taxed.needs`: text EVERY call's own arguments must hold (the shared settings, by name). `builtBy`: the
 * call is handed a variable built elsewhere, so the guard follows it there — checking the call alone would check nothing.
 * `onlyKeys`: the only object keys its arguments may write (no spread). `facts`: what the reason rests on, in the same file.
 */
type Tax =
  | { taxed: string; needs: string[]; builtBy?: { file: string; fn: string; arg: string }; facts?: RegExp[] }
  | { inherits: string; onlyKeys: string[] }
  | { untaxed: string; onlyKeys?: string[] };

const MOVE_DOWN = 'a move DOWN, at renewal and with no proration: it renews a subscription the buyer already bought through a checked path, and charges nothing new';
const FEE_RECOVERY = 'the monthly Stripe-fee recovery: it bills a club that may have no paid plan. Since Part 2b (owner, Ask 8, 2026-11-05) a club gives '
  + 'its billing address before it can take online payments, and a club with none still WAITS — its fees stay unbilled until it adds one '
  + '(`placeable`, pinned in the Part 2b block below). So no fee goes out without an address, though the check is the invoice’s own, not `requireBillingLocation`';
const QUOTE = 'a quote: charges nothing, so it needs no address of its own. It is on this list for its tax answer';

const TAXED_CHECKOUT_SPREAD = { needs: ['...TAXED_CHECKOUT'] };
/**
 * ⚠ A fee line's setting is its OWN tax treatment (exclusive, the general-services code); whether tax is worked out at all is
 * the invoice it lands on — the club's own fee invoice (taxed, its entry below) or the live subscription's next invoice. A fee
 * rides a subscription only when that subscription has tax on (`subscriptionToRide`, pinned in the fee block below), so a
 * subscription made before Stage 2 sends its club's fees to the club's own taxed invoice (/review 2026-11-05).
 */
const FEE_LINE: Tax = { taxed: 'a recovered Stripe fee, taxed on top at the club’s province rate (Ask 3)', needs: ['...RECOVERED_FEE_TAX'] };

/** THE LIST. A new charge goes on it in the same commit: its address answer (`checked` / `allowed`) and its tax answer. */
const CHARGING_CALLS: Entry[] = [
  // ── checked: the address is required before the call ──
  { file: 'app/api/billing/create-checkout/route.ts', call: 'checkout.sessions.create', count: 1,
    checked: 'paths A + B, a club plan and a Premium portal becoming the club in place',
    tax: { taxed: 'a subscription checkout', ...TAXED_CHECKOUT_SPREAD } },
  { file: 'app/api/billing/create-team-checkout/route.ts', call: 'checkout.sessions.create', count: 1,
    checked: 'path C, coach Premium: new, reactivate and Keep Premium (the buyer is the person)',
    tax: { taxed: 'a subscription checkout', ...TAXED_CHECKOUT_SPREAD } },
  { file: 'app/api/billing/choose-next-season/route.ts', call: 'checkout.sessions.create', count: 1,
    checked: 'path D, the Founding next-season choice',
    tax: { taxed: 'a subscription checkout whose first charge is later: tax is set now, the rate follows the address at the charge',
      ...TAXED_CHECKOUT_SPREAD, builtBy: { file: 'lib/next-season-choice.ts', fn: 'buildNextSeasonCheckoutParams', arg: 'params' } } },
  { file: 'lib/plan-move.ts', call: 'subscriptions.update', count: 1, helper: 'applyMove',
    checked: 'path E, a move UP on a live subscription (a prorated invoice): checked in each caller of applyMove, pinned below',
    tax: { taxed: 'a move up, which turns tax on for its prorated invoice and every renewal after', needs: ['automatic_tax: AUTOMATIC_TAX'] } },

  // ── allowed: no address needed, and why ──
  { file: 'lib/plan-move.ts', call: 'subscriptionSchedules.create', count: 1, allowed: MOVE_DOWN, facts: [/proration_behavior: 'none'/],
    tax: { inherits: 'made FROM the live subscription (Stripe takes nothing else beside `from_subscription`); the schedule update right '
      + 'after it sets its tax', onlyKeys: ['from_subscription'] } },
  { file: 'lib/plan-move.ts', call: 'subscriptionSchedules.update', count: 1, allowed: MOVE_DOWN, facts: [/proration_behavior: 'none'/],
    tax: { taxed: 'the smaller plan’s renewal: its phases set no tax of their own and inherit this', needs: ['default_settings: { automatic_tax: AUTOMATIC_TAX }'] } },
  { file: 'lib/plan-move.ts', call: 'invoices.createPreview', count: 1, allowed: QUOTE,
    tax: { taxed: 'the move-up quote, the same builder as the press-time check', needs: ['automatic_tax: AUTOMATIC_TAX'],
      // With no address yet ("wait") it asks Stripe without tax, and shows no figure: the window asks for the address instead.
      facts: [/tax: place\.kind === 'wait' \? \{ status: 'needs_address' \}/] } },
  { file: 'lib/workspace-upgrade-preview.ts', call: 'invoices.createPreview', count: 1, allowed: QUOTE,
    tax: { taxed: 'the Premium → Club "Due today" quote, for the club address typed', needs: ['automatic_tax: AUTOMATIC_TAX'],
      facts: [/place\.kind === 'wait' \? \{ status: 'needs_address' \}/] } },
  { file: 'lib/console-money-stripe.ts', call: 'invoices.createPreview', count: 1, allowed: 'platform admin’s read of the next charge: charges nothing',
    tax: { untaxed: 'the operator’s read of a live subscription’s next charge AS STRIPE WILL MAKE IT: setting tax here would show a '
      + 'figure Stripe will not charge. The subscription’s own tax decides it', onlyKeys: ['customer', 'subscription'] } },
  { file: 'lib/plan-ending-server.ts', call: 'subscriptions.update', count: 2,
    allowed: 'cancel at renewal, and Keep {Plan} withdrawing it: the same subscription, only its cancel fields, no new charge',
    facts: [
      /subscriptions\.update\(id, \{ cancel_at_period_end: true \}\)/,
      /subscriptions\.update\(id, clear === 'period_end' \? \{ cancel_at_period_end: false \} : \{ cancel_at: '' \}\)/,
    ],
    tax: { untaxed: 'a cancel and its withdrawal charge nothing; an update that touched items, price or quantity would need tax', onlyKeys: ['cancel_at_period_end', 'cancel_at'] } },
  { file: 'lib/billing-setup.ts', call: 'checkout.sessions.create', count: 1,
    allowed: 'saves a card for later (setup mode): charges nothing', facts: [/checkout\.sessions\.create\(\{\s*mode: 'setup',/],
    tax: { untaxed: 'setup mode saves a card and charges nothing' } },
  { file: 'lib/team-org-billing.ts', call: 'checkout.sessions.create', count: 1,
    allowed: 'DEAD: startOrgTeamAddonCheckout (a club paying for a coach’s team) has no caller, and the pin below fails the day one '
      + 'appears without the address check. Left in place on purpose (owner, Ask 1, 2026-11-04); its deletion is on the dead-code report',
    tax: { untaxed: 'DEAD, and untaxed: the pin below fails the day anything calls it. Do not revive it without the address check AND tax' } },
  { file: 'lib/stripe-connect.ts', call: 'checkout.sessions.create', count: 1,
    allowed: 'a family paying a CLUB, on the club’s own Stripe account: the club is the seller, not FieldLogicHQ. Our payment fee on it '
      + 'is a later stage’s tax question (owner, Ask 2a, 2026-11-04)',
    facts: [/mode: 'payment'/, /\{ \.\.\.on\(args\.accountId\), idempotencyKey: args\.idempotencyKey \}/],
    tax: { untaxed: 'the club’s own sale on the club’s own Stripe account, not ours (Club Stage 12; our payment fee’s tax is plan Stage 5)' } },
  { file: 'lib/platform-stripe-fees.ts', call: 'invoiceItems.create', count: 3, allowed: FEE_RECOVERY, tax: FEE_LINE },
  { file: 'lib/platform-stripe-fees.ts', call: 'invoices.create', count: 1, allowed: FEE_RECOVERY,
    tax: { taxed: 'the club’s own monthly fee invoice (Ask 3)', needs: ['automatic_tax: AUTOMATIC_TAX'] } },
  { file: 'lib/platform-stripe-fees.ts', call: 'invoices.finalizeInvoice', count: 1, allowed: FEE_RECOVERY,
    tax: { inherits: 'finalizes the club’s own fee invoice, made with automatic tax by the invoices.create above', onlyKeys: ['auto_advance'] } },
];

/**
 * One level down: every file that names a shared charging helper, and why that caller is safe. A file not on its list fails,
 * because the helper itself does not check the address.
 */
const HELPER_CALLERS = {
  applyMove: {
    home: 'lib/plan-move.ts',
    callers: {
      'app/api/billing/move/route.ts': (code: string, file: string) => {
        const post = between(code, 'export const POST', 'export const DELETE', `${file} POST`);
        const check = post.indexOf('requireBillingLocation(');
        assert.ok(check >= 0 && check < post.indexOf('applyMove('), `${file}: the address check must come before applyMove (path E)`);
      },
      // Keep {Plan} rebuilding a waiting move: only ever DOWN, refused before applyMove otherwise, so it never charges.
      'lib/plan-ending-server.ts': (code: string, file: string) => {
        const body = between(code, 'async rescheduleMove(', 'applyMove({', `${file} rescheduleMove`);
        assert.match(body, /if \(moveDirection\(account\.ownPlan, plan\) !== 'down'\) return /,
          `${file}: rescheduleMove must refuse anything but a move DOWN before it calls applyMove, or it can charge with no address check`);
      },
    } as Record<string, (code: string, file: string) => void>,
  },
} as const;

/** A helper that charges with no check of its own and that nothing calls (Ask 1): the day something does, this fails. */
const UNCALLED_CHARGING_HELPERS = [{ name: 'startOrgTeamAddonCheckout', home: 'lib/team-org-billing.ts' }];

const SOURCE_FILES = [...new Set(['app', 'lib', 'components'].flatMap(dir => ['.ts', '.tsx', '.js', '.mjs'].flatMap(ext => filesUnder(dir, ext))))];
const CODE = new Map(SOURCE_FILES.map(file => [file, readCode(file)]));

const unlisted = (file: string, call: string) =>
  `${file} opens a Stripe charge or quote (\`${call}\`) that isn't on the charging list. Call \`requireBillingLocation\` before it `
  + '(see GST_HST_STAGE1_BUILD_PROMPT.md Part 2) and turn tax on in it (spread `TAXED_CHECKOUT` into a checkout, or set '
  + '`automatic_tax: AUTOMATIC_TAX`, from lib/billing-tax.ts), then add it to CHARGING_CALLS in this file with both answers: '
  + '`checked` (or `allowed` and the reason it needs no address), and `taxed` (or `untaxed` and the reason it must stay untaxed).';

const untaxed = (file: string, call: string, n: number, count: number, why: string) =>
  `${file}: \`${call}\`${count > 1 ? ` (call ${n} of ${count})` : ''} charges our customer without tax — ${why}. Add automatic `
  + 'tax to it (the setting named in CHARGING_CALLS, from lib/billing-tax.ts), or, if it must stay untaxed, change its entry in this '
  + 'file to `untaxed` with the reason.';

describe('the matcher (proved on fixtures, so the census can fail without planting a call in the tree)', () => {
  const calls = (src: string) => chargingCalls(stripComments(src)).map(c => c.call);

  it('finds the shared client, the getter, optional chaining and a destructured client', () => {
    assert.deepEqual(calls('await stripe.checkout.sessions.create({ mode: "payment" })'), ['checkout.sessions.create']);
    assert.deepEqual(calls('return getStripe().subscriptions.update(id, {})'), ['subscriptions.update']);
    assert.deepEqual(calls('client?.invoices?.pay(id)'), ['invoices.pay']);
    assert.deepEqual(calls('const { invoiceItems } = stripe;\ninvoiceItems.create({})'), ['invoiceItems.create']);
  });

  it('finds a chain split across lines', () => {
    assert.deepEqual(calls('stripe.checkout\n    .sessions\n    .create({\n  mode: "subscription" })'), ['checkout.sessions.create']);
    assert.deepEqual(calls('stripe\n  .subscriptionSchedules\n  .update(s.id, {})'), ['subscriptionSchedules.update']);
  });

  it('ignores a call inside a comment', () => {
    assert.deepEqual(calls('// stripe.checkout.sessions.create({})\n/* stripe.invoices.create({}) */\nconst x = 1;'), []);
  });

  it('finds a quote (Part 5: it must carry tax), and tells it from invoices.create', () => {
    assert.deepEqual(calls('stripe.invoices.createPreview({})\nstripe.invoices.create({})'), ['invoices.createPreview', 'invoices.create']);
  });

  it('reads each call’s own arguments, nested and stringy, and the keys they write', () => {
    const [one, two] = chargingCalls(stripComments(
      "stripe.invoiceItems.create({ a: f(1), b: ')', ...RECOVERED_FEE_TAX }, { k: `x${y}` });\nstripe.invoiceItems.create({ a: 2 })"));
    assert.match(one.args, /\.\.\.RECOVERED_FEE_TAX \}, \{ k: `x\$\{y\}` \}$/);
    assert.equal(two.args, '{ a: 2 }');
    assert.deepEqual(keysIn(one.args), ['a', 'b', '...RECOVERED_FEE_TAX', 'k']);
    assert.deepEqual(keysIn("id, clear === 'a:b' ? { cancel_at_period_end: false } : { cancel_at: '' }"), ['cancel_at_period_end', 'cancel_at']);
  });

  it('a key it cannot read is returned as written, so an `onlyKeys` entry fails on it (/review 2026-11-05)', () => {
    assert.deepEqual(keysIn('id, { cancel_at_period_end: true, items }'), ['cancel_at_period_end', 'items']);
    assert.deepEqual(keysIn(`id, { 'items': [1], [k]: v }`), ["'': [1]", '[k]: v']);
    assert.deepEqual(keysIn('id, patch'), ['(no object literal: the arguments are built elsewhere)']);
    assert.deepEqual(keysIn('id, { a: { items: [] } }'), ['a'], 'only the top level is read; a nested key is its parent’s value');
  });

  it('steps over a regex literal, and reads a tax setting only as code (/review 2026-11-05)', () => {
    const [call] = chargingCalls("stripe.invoices.create({ memo: s.replace(/'/g, '').replace(/\\)/g, ''), automatic_tax: AUTOMATIC_TAX });\nnext();");
    assert.match(call.args, /automatic_tax: AUTOMATIC_TAX \}$/);
    assert.ok(writes(call.args, 'automatic_tax: AUTOMATIC_TAX'));
    assert.ok(!writes('{ automatic_tax: AUTOMATIC_TAX_OFF }', 'automatic_tax: AUTOMATIC_TAX'), 'a longer name is not the setting');
    assert.ok(!writes("{ note: 'automatic_tax: AUTOMATIC_TAX' }", 'automatic_tax: AUTOMATIC_TAX'), 'text inside a string is not the setting');
    assert.equal(keyCount(blankLiterals('{ automatic_tax: AUTOMATIC_TAX, ...o, automatic_tax: undefined }'), 'automatic_tax'), 2);
  });

  it('reads a builder’s ONE returned object, not the function after it', () => {
    const code = "export function build(input: { a: string }): P {\n  if (x) throw new Error('no');\n  return { mode: 'subscription', a: 1 };\n}\n"
      + 'export function other() { return { ...TAXED_CHECKOUT }; }';
    assert.equal(returnedLiteral(code, 'build', 'fixture').trim(), "mode: 'subscription', a: 1");
  });

  it('ignores what charges nothing: a cancel, a release, Stripe’s billing page, a read', () => {
    assert.deepEqual(calls([
      'stripe.subscriptions.cancel(id)',
      'stripe.subscriptions.retrieve(id)',
      'stripe.subscriptionSchedules.release(id)',
      'stripe.billingPortal.sessions.create({})',
      'mySubscriptions.update(1)',
    ].join('\n')), []);
  });
});

describe('every Stripe charge in app/, lib/ and components/ is on the list', () => {
  const found = new Map<string, Map<string, { count: number; first: number; args: string[] }>>();
  for (const [file, code] of CODE) {
    for (const { call, index, args } of chargingCalls(code)) {
      const byCall = found.get(file) ?? new Map();
      const seen = byCall.get(call);
      byCall.set(call, { count: (seen?.count ?? 0) + 1, first: seen?.first ?? index, args: [...(seen?.args ?? []), args] });
      found.set(file, byCall);
    }
  }

  it('the census sees the charges it is meant to (a matcher that found nothing would pass everything)', () => {
    assert.ok(found.size >= 5, `only ${found.size} files with a Stripe charge: the matcher or the walk is broken`);
  });

  it('no charge is missing from the list, and none appeared beside a listed one', () => {
    for (const [file, byCall] of found) {
      for (const [call, { count }] of byCall) {
        const entry = CHARGING_CALLS.find(e => e.file === file && e.call === call);
        assert.ok(entry, unlisted(file, call));
        assert.equal(count, entry.count, `${file} now has ${count} \`${call}\` calls and CHARGING_CALLS says ${entry.count}. `
          + `${unlisted(file, call)} If the extra one is the same kind as the listed one, change the count.`);
      }
    }
  });

  it('no entry outlives its call (a deleted path leaves no stale allowance)', () => {
    for (const entry of CHARGING_CALLS) {
      assert.ok(sourceExists(entry.file), `${entry.file} is gone: remove its \`${entry.call}\` entry from CHARGING_CALLS`);
      assert.ok(found.get(entry.file)?.has(entry.call), `${entry.file} no longer calls \`${entry.call}\`: remove it from CHARGING_CALLS`);
    }
  });

  for (const entry of CHARGING_CALLS) {
    if (!('checked' in entry)) continue;
    it(`checked · ${entry.file} (${entry.checked})`, () => {
      if (entry.helper) {
        assert.equal(HELPER_CALLERS[entry.helper].home, entry.file, `${entry.helper} must live in ${entry.file}`);
        return; // its callers are pinned in the next block
      }
      const code = CODE.get(entry.file)!;
      const check = code.indexOf('requireBillingLocation(');
      assert.ok(check >= 0 && check < found.get(entry.file)!.get(entry.call)!.first,
        `${entry.file}: \`requireBillingLocation\` must come before \`${entry.call}\``);
    });
  }

  for (const entry of CHARGING_CALLS) {
    if (!entry.facts) continue;
    it(`allowed · ${entry.file} \`${entry.call}\` still is what its reason says`, () => {
      for (const fact of entry.facts!) {
        assert.match(CODE.get(entry.file)!, fact, `${entry.file}: the reason it needs no address rests on ${fact}, which is gone. `
          + `Re-check the call: if it can charge now, call \`requireBillingLocation\` before it and move it to \`checked\`.`);
      }
    });
  }

  // ── Part 5: the tax answer, read from each call's own arguments ──
  for (const entry of CHARGING_CALLS) {
    const { tax, file, call } = entry;
    const label = 'taxed' in tax ? `taxed · ${tax.taxed}` : 'inherits' in tax ? `inherits · ${tax.inherits}` : `untaxed · ${tax.untaxed}`;
    it(`tax · ${file} \`${call}\` (${label})`, () => {
      const calls = found.get(file)?.get(call);
      if (!calls) return; // the stale-entry test above names it
      calls.args.forEach((args, i) => {
        const n = i + 1;
        if ('taxed' in tax) {
          let text = args;
          if (tax.builtBy) {
            // The call is handed a variable: follow it to the function that builds it, or this would check nothing.
            const { file: home, fn, arg } = tax.builtBy;
            assert.equal(args.trim(), arg, `${file}: \`${call}\` must be handed \`${arg}\` from ${fn} (${home}), where its tax is checked. `
              + `If the arguments are built here now, put the tax setting in them and drop builtBy from its entry.`);
            const assigned = CODE.get(file)!.match(new RegExp(`(?<![\\w$.])${arg}\\s*=(?![=>])`, 'g')) ?? [];
            assert.ok(assigned.length === 1 && new RegExp(`\\b${arg} = ${fn}\\(`).test(CODE.get(file)!),
              `${file}: \`${arg}\` must be set once, from ${fn}, where its tax is checked — a second assignment could take the tax back out`);
            text = returnedLiteral(CODE.get(home)!, fn, home);
          }
          for (const need of tax.needs) {
            assert.ok(writes(text, need), untaxed(tax.builtBy?.file ?? file, call, n, calls.count, `it is ${tax.taxed}, and \`${need}\` is gone from it`));
          }
          const needed = blankLiterals(tax.needs.join(' '));
          for (const key of TAX_KEYS) {
            assert.equal(keyCount(blankLiterals(text), key), keyCount(needed, key), untaxed(tax.builtBy?.file ?? file, call, n, calls.count,
              `it writes \`${key}\` beside the shared setting, which can take the tax back out`));
          }
          for (const fact of tax.facts ?? []) {
            assert.match(CODE.get(file)!, fact, `${file}: \`${call}\` may ask Stripe without tax only while the quote then shows no figure (${fact}), which is gone`);
          }
          return;
        }
        if (tax.onlyKeys) {
          const extra = keysIn(args).filter(k => !tax.onlyKeys!.includes(k));
          assert.deepEqual(extra, [], ('inherits' in tax)
            ? `${file}: \`${call}\`${calls.count > 1 ? ` (call ${n} of ${calls.count})` : ''} takes its tax from another call, so it may `
              + `write only ${tax.onlyKeys.join(', ')}. It now writes ${extra.join(', ')}: if that can change a price, set the tax in it and make its entry \`taxed\`.`
            : untaxed(file, call, n, calls.count, `its entry allows it untaxed only while it writes ${tax.onlyKeys.join(', ')}, and it now writes ${extra.join(', ')}`));
        }
      });
    });
  }

  it('the shared tax settings still turn tax on (every `taxed` entry names them)', () => {
    assert.deepEqual(AUTOMATIC_TAX, { enabled: true });
    assert.deepEqual(TAXED_CHECKOUT.automatic_tax, AUTOMATIC_TAX);
    assert.deepEqual(RECOVERED_FEE_TAX, { tax_behavior: 'exclusive', tax_code: 'txcd_90050001' });
  });

  it('nothing turns tax off, and nothing defines its own copy of the shared settings', () => {
    for (const [file, code] of CODE) {
      assert.doesNotMatch(code, /automatic_tax\s*:\s*\{\s*enabled\s*:\s*false/, `${file} turns Stripe's automatic tax OFF. Every charge of ours is taxed; `
        + 'a deliberately untaxed call sets no tax at all and is on CHARGING_CALLS as `untaxed` with its reason.');
      if (file === 'lib/billing-tax.ts') continue;
      assert.doesNotMatch(code, /(?:const|let|var)\s+(?:AUTOMATIC_TAX|TAXED_CHECKOUT|RECOVERED_FEE_TAX)\b/,
        `${file} defines its own tax setting under a shared name: import it from lib/billing-tax.ts, the one the guard pins`);
    }
  });
});

describe('one level down: the callers of a helper that charges', () => {
  for (const [helper, { home, callers }] of Object.entries(HELPER_CALLERS)) {
    const named = new RegExp(`\\b${helper}\\b`);
    const mentions = [...CODE].filter(([file, code]) => file !== home && named.test(code)).map(([file]) => file);

    it(`every file that reaches ${helper} is a pinned caller`, () => {
      for (const file of mentions) {
        assert.ok(callers[file], `${file} calls ${helper}, which charges and does not check the address itself. Call `
          + `\`requireBillingLocation\` before it (see app/api/billing/move/route.ts), then add ${file} to HELPER_CALLERS.${helper} in this file.`);
      }
    });

    for (const [file, pin] of Object.entries(callers)) {
      it(`${helper} · ${file}`, () => {
        assert.ok(mentions.includes(file), `${file} no longer calls ${helper}: remove it from HELPER_CALLERS.${helper}`);
        pin(CODE.get(file)!, file);
      });
    }
  }

  for (const { name, home } of UNCALLED_CHARGING_HELPERS) {
    it(`${name} (dead, no address check) has no caller`, () => {
      const named = new RegExp(`\\b${name}\\b`);
      for (const [file, code] of CODE) {
        if (file === home) continue;
        assert.doesNotMatch(code, named, `${file} reaches ${name}, a paid Stripe checkout with no billing-address check and no tax. `
          + `Call \`requireBillingLocation\` before it (see GST_HST_STAGE1_BUILD_PROMPT.md Part 2) and spread \`TAXED_CHECKOUT\` into its `
          + `session, then change ${home}'s \`checkout.sessions.create\` entry in this file from \`allowed\` to \`checked\` and from \`untaxed\` to \`taxed\`.`);
      }
      const homeCode = CODE.get(home);
      assert.ok(homeCode, `${home} is gone: remove ${name} from UNCALLED_CHARGING_HELPERS and its entry from CHARGING_CALLS`);
      assert.equal((homeCode.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) ?? []).length, 1,
        `${home} calls ${name} itself now: treat that caller like any other (check the address first)`);
    });
  }
});

/**
 * GST/HST Stage 2 Part 2b (Ask 8, owner 2026-11-05): turning on online payments is a door to an INVOICE, not a charge, so the
 * census above cannot see it. The club's Stripe fees are invoiced and taxed by its billing address, and Stripe refuses a taxed
 * invoice it cannot place. So `connect` (a new account and a reconnect alike) asks for the club's own address before any
 * Stripe call, and the Payouts card opens the Billing address window on the refusal instead of showing an error.
 */
describe('turning on online payments asks for the club’s billing address first (Part 2b)', () => {
  const ROUTE = 'app/api/admin/payouts/route.ts';
  const CARD = 'components/admin/kit/club/PayoutsCard.tsx';

  it(`${ROUTE}: connect checks the address before it touches Stripe or the payout account`, () => {
    const connect = between(CODE.get(ROUTE)!, "case 'connect':", "case 'agree_terms':", `${ROUTE} connect`);
    const check = connect.indexOf('requireBillingLocation(');
    assert.ok(check >= 0, `${ROUTE}: connect must call requireBillingLocation (GST_HST_STAGE2_PART2B_BUILD_PROMPT.md Part 1)`);
    for (const after of ['createClubAccount(', 'retrieveAccount(', "from('org_payment_accounts')", 'onboardingLink(']) {
      const at = connect.indexOf(after);
      assert.ok(at === -1 || check < at, `${ROUTE}: the address check must come before ${after} — a refusal creates and changes nothing`);
    }
    assert.match(connect, /if \(!address\.ok\) return address\.response;/, `${ROUTE}: connect must return the address refusal as is (409)`);
    assert.match(connect, /kind: 'org'/, `${ROUTE}: connect checks the CLUB's own row, the one the fee invoice reads`);
  });

  it(`${CARD}: the Before window asks first, and opens the window on the server's refusal`, () => {
    const before = between(CODE.get(CARD)!, 'function BeforeWindow(', 'function TermsRow(', `${CARD} BeforeWindow`);
    assert.match(before, /useBillingAddressGate\(\{ orgSlug \}\)/, `${CARD}: the Before window needs the billing-address gate`);
    assert.match(before, /address\.ensure\(\(\) => void go\(\)\)/, `${CARD}: the connect button must go through ensure(go)`);
    assert.match(before, /if \(isAddressRefusal\(e\)\) \{ address\.refused\(\(\) => void go\(\)\); return; \}/,
      `${CARD}: billing_address_required must open the window and retry the connect, not show an error`);
    assert.match(before, /if \(address\.open && address\.dialog\) return address\.dialog;/,
      `${CARD}: the address window replaces the Before window (which stays mounted, so the fee choice and the tick survive) — `
      + 'only once it can draw, or a failed address read blanks the window with no way out (/review 2026-11-05)');
  });

  it(`${CARD}: a club connected without an address sees the line (owner ruling A), by the fee invoice's own test`, () => {
    assert.match(CODE.get(ROUTE)!, /addressMissing: isOwner && facts && !facts\.disconnectedAt\s*\? !\(await clubFeeInvoicePlaceable\(ctx\.org\)/,
      `${ROUTE}: addressMissing must use clubFeeInvoicePlaceable, the test invoiceOneClub waits on`);
    assert.match(CODE.get(CARD)!, /isOwner && view\.addressMissing && <AddressMissingLine /, `${CARD}: the card must show the address line to the owner`);
    assert.match(between(CODE.get(CARD)!, 'function AddressMissingLine(', 'function PayoutsRecord(', `${CARD} AddressMissingLine`),
      /if \(address\.location\) return null;[\s\S]*onClick=\{\(\) => address\.edit\(\)\}/,
      `${CARD}: the line's button opens the Billing address window, and the line goes once the address is saved`);
    assert.match(CODE.get('lib/platform-stripe-fees.ts')!, /if \(!\(await placeable\(location, existingCustomer\)\)\) \{/,
      'lib/platform-stripe-fees.ts: invoiceOneClub must wait on placeable(), the same test the card reads');
  });

  it('lib/platform-stripe-fees.ts: a fee rides only a subscription that works tax out', () => {
    const ride = between(CODE.get('lib/platform-stripe-fees.ts')!, 'async function subscriptionToRide(', 'async function lineFor(',
      'lib/platform-stripe-fees.ts subscriptionToRide');
    const check = ride.indexOf('if (!sub.automatic_tax?.enabled) return null;');
    assert.ok(check >= 0 && check < ride.indexOf('return { customer:'),
      'lib/platform-stripe-fees.ts: subscriptionToRide must send a club whose subscription has tax off to its own fee invoice — '
      + 'a fee on that subscription’s invoice would go out without tax (Ask 3)');
  });
});

/**
 * EVERY CHARGE LEAVES A TAX RECORD — GST/HST Stage 3 Part 1 (build prompt GST_HST_STAGE3_BUILD_PROMPT.md; owner rulings 2026-11-06).
 * The same list, a third answer: does the charge this call opens leave a record in `platform_charge_tax_records`? Only a Stripe
 * INVOICE on our own account does, through the billing webhook's writer (and the daily catch-up). So each entry above is either
 *   · `invoice` — what it opens is billed by a Stripe invoice on our account (a subscription's, or the club's fee invoice), or
 *   · `none` — with the reason: it charges nothing (a quote, a card saved, a cancel), or it is not our sale (a family paying a club).
 * A charge that is ours and opens no invoice (a payment intent, a payment link, a one-time Checkout on our account) cannot claim
 * `invoice`, so it fails here until the writer learns it. A new entry above with no answer here fails too.
 */
const RECORD_NONE = {
  quote: 'a quote: charges nothing',
  setup: 'saves a card and charges nothing',
  cancel: 'a cancel and its withdrawal charge nothing',
  club: 'the club’s own sale on the club’s own Stripe account (not ours: it never reaches our invoices)',
  dead: 'DEAD: nothing calls it (its pin above)',
} as const;
const TAX_RECORD: Record<string, { invoice: string } | { none: string }> = {
  'app/api/billing/create-checkout/route.ts checkout.sessions.create': { invoice: 'a subscription Checkout: every charge is a subscription invoice' },
  'app/api/billing/create-team-checkout/route.ts checkout.sessions.create': { invoice: 'Premium: a subscription invoice billed to the coach' },
  'app/api/billing/choose-next-season/route.ts checkout.sessions.create': { invoice: 'the Founding next-season subscription: its first invoice comes later' },
  'lib/plan-move.ts subscriptions.update': { invoice: 'a move up: its prorated invoice' },
  'lib/plan-move.ts subscriptionSchedules.create': { invoice: 'a move down: the renewal invoice at the date' },
  'lib/plan-move.ts subscriptionSchedules.update': { invoice: 'a move down: the renewal invoice at the date' },
  'lib/plan-move.ts invoices.createPreview': { none: RECORD_NONE.quote },
  'lib/workspace-upgrade-preview.ts invoices.createPreview': { none: RECORD_NONE.quote },
  'lib/console-money-stripe.ts invoices.createPreview': { none: RECORD_NONE.quote },
  'lib/plan-ending-server.ts subscriptions.update': { none: RECORD_NONE.cancel },
  'lib/billing-setup.ts checkout.sessions.create': { none: RECORD_NONE.setup },
  'lib/team-org-billing.ts checkout.sessions.create': { none: RECORD_NONE.dead },
  'lib/stripe-connect.ts checkout.sessions.create': { none: RECORD_NONE.club },
  'lib/platform-stripe-fees.ts invoiceItems.create': { invoice: 'a fee line, billed on the club’s fee invoice or its subscription’s next invoice' },
  'lib/platform-stripe-fees.ts invoices.create': { invoice: 'the club’s own fee invoice' },
  'lib/platform-stripe-fees.ts invoices.finalizeInvoice': { invoice: 'the club’s own fee invoice' },
};
const NEVER_AN_INVOICE = ['paymentIntents.create', 'paymentLinks.create'];
const WEBHOOK = 'lib/billing-webhook-handler.ts';
const REPO_ROOT = path.join(import.meta.dirname, '..', '..');

describe('every charge leaves a tax record (GST/HST Stage 3 Part 1)', () => {
  it('every entry on the charging list answers the record question, and no answer outlives its entry', () => {
    for (const e of CHARGING_CALLS) {
      assert.ok(TAX_RECORD[`${e.file} ${e.call}`], `${e.file} \`${e.call}\` has no tax-record answer: add it to TAX_RECORD — \`invoice\` `
        + '(billed by a Stripe invoice on our account, so the billing webhook records it) or `none` with the reason.');
    }
    for (const key of Object.keys(TAX_RECORD)) {
      assert.ok(CHARGING_CALLS.some(e => `${e.file} ${e.call}` === key), `TAX_RECORD names \`${key}\`, which is no longer on the charging list: remove it`);
    }
  });

  it('a charge that opens no invoice cannot claim one', () => {
    for (const [key, answer] of Object.entries(TAX_RECORD)) {
      if (!('invoice' in answer)) continue;
      assert.ok(!NEVER_AN_INVOICE.some(m => key.endsWith(` ${m}`)), `${key} opens no Stripe invoice, so no tax record is written for it: `
        + 'teach lib/charge-tax-record-server.ts to record it before calling it `invoice`.');
      if (key.endsWith(' checkout.sessions.create')) {
        const file = key.slice(0, -' checkout.sessions.create'.length);
        const tax = CHARGING_CALLS.find(e => e.file === file && e.call === 'checkout.sessions.create')?.tax;
        const builder = tax && 'builtBy' in tax && tax.builtBy ? tax.builtBy.file : null;
        const code = (CODE.get(file) ?? '') + (builder ? CODE.get(builder) ?? '' : '');
        assert.match(code, /mode: 'subscription'/, `${file}: a Checkout recorded as \`invoice\` must be a subscription Checkout (a one-time payment has no invoice)`);
      }
    }
  });

  it(`${WEBHOOK}: every invoice event is recorded AFTER the plan's own work, whatever it answered; every credit-note event is recorded`, () => {
    const code = CODE.get(WEBHOOK)!;
    const run = between(code, 'async function runVerifiedBillingEvent(', 'async function runPlanWork(', `${WEBHOOK} runVerifiedBillingEvent`);
    const plan = between(code, 'async function runPlanWork(', 'switch (event.type)', `${WEBHOOK} runPlanWork`);
    const notes = run.indexOf('(CHARGE_TAX_CREDIT_NOTE_EVENTS as readonly string[]).includes(event.type)');
    const work = run.indexOf('const outcome = await runPlanWork(event, customerId);');
    const invoices = run.indexOf('(CHARGE_TAX_INVOICE_EVENTS as readonly string[]).includes(event.type)');
    assert.ok(notes >= 0 && run.indexOf('recordCreditNoteTax(noteId)', notes) > notes, `${WEBHOOK}: every credit-note event must reach recordCreditNoteTax`);
    // The plan's work comes first (a club's plan never waits on our bookkeeping), and nothing between it and the record returns.
    assert.ok(work > notes && invoices > work, `${WEBHOOK}: the invoice's tax record must be written after runPlanWork`);
    assert.ok(run.indexOf('recordInvoiceTax(invoiceId)', invoices) > invoices, `${WEBHOOK}: every invoice event must reach recordInvoiceTax`);
    assert.ok(!run.slice(work + 1, invoices).includes('return'), `${WEBHOOK}: nothing may return between the plan's work and the tax record`);
    // Every early return (no customer, the fee invoice's own route, the stray subscription) is inside the plan's work, so a fee
    // invoice and a customer-less event still reach the record.
    for (const early of ['if (!customerId) return', 'FEE_INVOICE_META']) {
      assert.ok(plan.includes(early), `${WEBHOOK}: \`${early}\` must live in runPlanWork, or the events it returns for are never recorded`);
      assert.ok(!run.includes(early), `${WEBHOOK}: \`${early}\` in runVerifiedBillingEvent would skip the tax record`);
    }
    assert.ok(!/await recordInvoiceTax\(|await recordCreditNoteTax\(/.test(run), `${WEBHOOK}: the writers run inside recordTaxOrReport, so a failed record never fails the event`);
  });

  it(`${WEBHOOK}: a charge alert and its tax record name the same club (one shared owner rule)`, () => {
    assert.match(CODE.get(WEBHOOK)!, /async ownerOf\(subscriptionId, customerId\) \{\s*const owner = await orgOfSubscription\(subscriptionId, customerId\);/,
      `${WEBHOOK}: ownerOf must use orgOfSubscription (lib/charge-tax-record-server.ts), the tax record's own rule`);
  });

  it('the refund handler keeps what was refunded on the invoice’s record, before it decides the charge is not a subscription’s', () => {
    const handler = between(CODE.get('lib/stripe-subscription-charges.ts')!, 'export async function handleSubscriptionChargeEvent(', 'const customerId =', 'handleSubscriptionChargeEvent');
    const record = handler.indexOf('deps.recordRefunded(invoice.id, charge.amount_refunded)');
    assert.ok(record >= 0 && record < handler.indexOf("return 'not_ours'", handler.indexOf('invoiceForPaymentIntent')), 'the refunded figure must be recorded before the not-a-subscription return');
    assert.match(CODE.get(WEBHOOK)!, /recordRefunded: \(invoiceId, refundedCents\) =>\s*recordTaxOrReport\(/, `${WEBHOOK}: the webhook must hand the refund handler its recorder`);
  });

  it('every place that makes a credit note writes its record at once', () => {
    const makers = SOURCE_FILES.filter(f => /(?<![\w$])creditNotes\s*\.\s*create\s*\(/.test(CODE.get(f) ?? ''));
    assert.ok(makers.length >= 2, `only ${makers.length} credit-note makers found: the census is broken`);
    const writes: Record<string, string> = {
      'lib/console-money-stripe.ts': 'store.recordCreditNote(made.note.id)',
      'lib/platform-stripe-fees.ts': 'recordCreditNoteTax(madeNote.id)',
    };
    for (const f of makers) {
      assert.ok(writes[f], `${f} makes a credit note with no tax record written: call recordCreditNoteTax (inside recordTaxOrReport) after it, and pin it here`);
      assert.ok(CODE.get(f)!.includes(writes[f]), `${f}: \`${writes[f]}\` is gone`);
    }
    assert.match(CODE.get('lib/console-money-store.ts')!, /async recordCreditNote\(noteId\) \{\s*await recordTaxOrReport\(\{ kind: 'credit_note', id: noteId \}, \(\) => recordCreditNoteTax\(noteId\)\);/,
      'lib/console-money-store.ts: the refund store must write the note’s record');
  });

  it('the daily online-payments job runs the catch-up, then the backfill (owner, Stage 4 Ask 11)', () => {
    const job = CODE.get('app/api/platform-admin/stripe-fees-daily/route.ts')!;
    const catchUp = job.indexOf("await run('tax_records', () => catchUpChargeTaxRecords(now));");
    const backfill = job.indexOf("await run('tax_records_backfill', () => backfillChargeTaxRecords(now));");
    assert.ok(catchUp >= 0 && backfill > catchUp, 'the daily job must run the tax-record catch-up and then the backfill');
  });

  it('every event the writer needs is on the Stripe setup guide (the live endpoint must be sent each one)', () => {
    const guide = readFileSync(path.join(REPO_ROOT, 'docs/agents/ops/stripe-setup-guide.md'), 'utf8');
    for (const type of [...CHARGE_TAX_INVOICE_EVENTS, ...CHARGE_TAX_CREDIT_NOTE_EVENTS]) {
      assert.ok(guide.includes(`\`${type}\``), `docs/agents/ops/stripe-setup-guide.md does not list \`${type}\`, which the tax record needs`);
    }
  });

  it('deleting a club or a person deletes no tax record: the live schema links neither table to anything', () => {
    const constraints = JSON.parse(readFileSync(path.join(REPO_ROOT, 'docs/agents/db/schema-snapshots/schema-dump-constraints-dev.json'), 'utf8')) as
      Array<{ table_name: string; constraint_type: string; constraint_name: string }>;
    for (const table of ['platform_charge_tax_records', 'platform_credit_note_tax_records']) {
      const mine = constraints.filter(c => c.table_name === table);
      assert.ok(mine.some(c => c.constraint_type === 'PRIMARY KEY'), `${table} is not in the dev schema snapshot: apply migration 451 and refresh the snapshots`);
      const links = mine.filter(c => c.constraint_type === 'FOREIGN KEY');
      assert.deepEqual(links.map(c => c.constraint_name), [], `${table} must keep plain ids (no foreign key): a key to organizations or users would `
        + 'cascade or empty them when the club or person is deleted, and CRA needs the record for six years');
    }
  });
});
