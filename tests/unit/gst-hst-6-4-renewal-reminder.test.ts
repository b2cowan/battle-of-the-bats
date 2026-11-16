/**
 * GST/HST Stage 6 step 6.4 Part B — the yearly reminder and the Québec refusal (build prompt
 * docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md §4.1, §4.2 and the words of §6; owner rulings 2026-11-13 Q5, Q6).
 *   1 · the window: 37 days sends, 38 doesn't, 29 sends as late;
 *   2 · once per charge date: a second run the same day sends nothing; a definite failure gives the stamp back, an unknown keeps it;
 *   3 · each exclusion sends nothing; a failed preview sends nothing;
 *   4 · the words (§6): renewal, trial, next-season, the move-down line, no tax → the estimate sentence drops;
 *   5 · the wiring: the daily step, the stored pre-filter, Stripe's preview (never amount_due), every owner;
 *   6 · Québec: the rule, the words, the screens (the purchase doors themselves: billing-location-every-path-guard.test.ts).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source-code.ts';
import {
  PURCHASE_NOTICE_DAYS, REMINDER_WORDS, onePerAccount, planLineFigures, reminderTiming, renewalReminderEmail, runRenewalReminder,
  type ReminderCandidate, type ReminderEmailInput, type ReminderRunDeps, type ReminderStripeFacts,
} from '../../lib/renewal-reminder.ts';
import { BILLING_LOCATION_WORDS, BILLING_REGION_CLOSED, checkBillingLocation, isClosedRegion } from '../../lib/billing-location.ts';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const DAY = 86_400_000;
const NOW = new Date('2027-03-01T11:15:00.000Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString();

// ── 1 · the window ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('1 · the window (37 days sends, 38 doesn’t, 29 sends as late)', () => {
  it('reads each edge', () => {
    assert.equal(reminderTiming(inDays(38), NOW), null);
    assert.equal(reminderTiming(inDays(37), NOW), 'on_time');
    assert.equal(reminderTiming(inDays(30), NOW), 'on_time');
    assert.equal(reminderTiming(inDays(29), NOW), 'late');
    assert.equal(reminderTiming(inDays(1), NOW), 'late');
    assert.equal(reminderTiming(inDays(0), NOW), null, 'a date that has come is past telling');
    assert.equal(reminderTiming(inDays(-3), NOW), null);
  });

  it('one reminder per account, the earlier date, the same every day (two dates would trade the stamp and both send daily)', () => {
    const a: ReminderCandidate = { orgId: 'o1', subscriptionId: 'sub_a', kind: 'renewal', chargeIso: inDays(35), remindedFor: null };
    const b: ReminderCandidate = { ...a, subscriptionId: 'sub_b', kind: 'next_season', chargeIso: inDays(33) };
    const c: ReminderCandidate = { ...a, orgId: 'o2' };
    assert.deepEqual(onePerAccount([a, b, c]).map(x => x.subscriptionId).sort(), ['sub_a', 'sub_b']);
    assert.equal(onePerAccount([a, b]).length, 1);
    assert.equal(onePerAccount([a, b])[0].subscriptionId, 'sub_b');
    assert.equal(onePerAccount([b, a])[0].subscriptionId, 'sub_b');
  });
});

// ── the fake world the run is driven in ─────────────────────────────────────────────────────────────────────────────
type World = {
  stamp: Map<string, string | null>;
  sent: Array<{ to: string; subject: string; key: string; vars: Record<string, string> }>;
  logged: string[];
  previews: number;
};

function world(over: {
  chargeIso?: string; pending?: boolean; purchaseEmailAt?: string | null; stripe?: Partial<ReminderStripeFacts>;
  stripeThrows?: boolean; result?: { status: string; refused?: boolean } | null; owners?: string[]; planId?: string;
} = {}) {
  const w: World = { stamp: new Map(), sent: [], logged: [], previews: 0 };
  const chargeIso = over.chargeIso ?? inDays(34);
  const deps: ReminderRunDeps = {
    pendingEnding: async () => over.pending ?? false,
    purchaseEmailAt: async () => over.purchaseEmailAt ?? null,
    async readStripe() {
      w.previews += 1;
      if (over.stripeThrows) throw new Error('Stripe preview failed');
      return {
        status: 'active', cancelSet: false, chargeIso, previewPlan: { planId: over.planId ?? 'tournament_plus', cycle: 'annual' },
        beforeTaxCents: 39000, taxLines: [{ label: 'HST (ON) 13%', cents: 5070 }], totalCents: 44070, currency: 'cad', taxOff: false,
        ...over.stripe,
      };
    },
    recipients: async () => (over.owners ?? ['a@club.ca', 'b@club.ca']).map((email, i) => ({ userId: `u${i}`, email })),
    async claim(orgId, iso) {
      const held = w.stamp.get(orgId) ?? null;
      if (held !== null && new Date(held).getTime() === new Date(iso).getTime()) return false;
      w.stamp.set(orgId, iso);
      return true;
    },
    async release(orgId, iso, before) {
      if (w.stamp.get(orgId) === iso) w.stamp.set(orgId, before);
    },
    account: async () => ({ orgName: 'Guelph Minor Ball', planId: 'tournament_plus', billingUrl: 'https://x.test/guelph/admin/billing' }),
    planLabel: id => ({ tournament_plus: 'Tournament Plus', league: 'League', club: 'Club' } as Record<string, string>)[id ?? ''] ?? 'your plan',
    async send(to, email, key) {
      w.sent.push({ to: to.email, subject: email.subject, key, vars: email.vars });
      return over.result === undefined ? { status: 'sent' } : over.result;
    },
    log: m => { w.logged.push(m); },
  };
  return { w, deps, chargeIso };
}

const candidate = (over: Partial<ReminderCandidate> = {}): ReminderCandidate =>
  ({ orgId: 'org1', subscriptionId: 'sub_1', kind: 'renewal', chargeIso: inDays(34), remindedFor: null, ...over });

// ── 2 · once per charge date ─────────────────────────────────────────────────────────────────────────────────────────
describe('2 · once per charge date, every owner', () => {
  it('sends to every owner, one once-only key each, and stamps the date', async () => {
    const { w, deps, chargeIso } = world();
    const r = await runRenewalReminder(candidate(), deps, NOW);
    assert.deepEqual(r, { outcome: 'sent', late: false });
    assert.deepEqual(w.sent.map(s => s.to), ['a@club.ca', 'b@club.ca']);
    assert.equal(new Set(w.sent.map(s => s.key)).size, 2, 'one key per owner (the mail service refuses one key for two addresses)');
    assert.equal(w.stamp.get('org1'), chargeIso);
  });

  it('a second run the same day sends nothing (the stamp holds the date), and a claim lost to a racing run sends nothing', async () => {
    const { w, deps, chargeIso } = world();
    await runRenewalReminder(candidate(), deps, NOW);
    const again = await runRenewalReminder(candidate({ remindedFor: chargeIso }), deps, NOW);
    assert.deepEqual(again, { outcome: 'skipped', reason: 'already' });
    // The row was read before the other run stamped it: the conditional claim refuses.
    const raced = await runRenewalReminder(candidate({ remindedFor: null }), deps, NOW);
    assert.deepEqual(raced, { outcome: 'skipped', reason: 'claimed_elsewhere' });
    assert.equal(w.sent.length, 2);
  });

  it('next year’s date is a new reminder (the stamp names last year’s)', async () => {
    const { w, deps } = world();
    const r = await runRenewalReminder(candidate({ remindedFor: inDays(34 - 365) }), deps, NOW);
    assert.equal(r.outcome, 'sent');
    assert.equal(w.sent.length, 2);
  });

  it('29 days away and untold: it goes anyway, counted late', async () => {
    const { deps } = world({ chargeIso: inDays(29) });
    assert.deepEqual(await runRenewalReminder(candidate({ chargeIso: inDays(29) }), deps, NOW), { outcome: 'sent', late: true });
  });

  it('a definite refusal of every owner gives the stamp back (to what it held); an unknown keeps it and tells a person', async () => {
    const before = inDays(34 - 365);
    const refused = world({ result: { status: 'provider_error', refused: true } });
    assert.equal((await runRenewalReminder(candidate({ remindedFor: before }), refused.deps, NOW)).outcome, 'not_sent');
    assert.equal(refused.w.stamp.get('org1'), before);
    const unknown = world({ result: { status: 'provider_error' } });
    assert.equal((await runRenewalReminder(candidate(), unknown.deps, NOW)).outcome, 'unknown');
    assert.equal(unknown.w.stamp.get('org1'), unknown.chargeIso);
    assert.equal(unknown.w.logged.length, 1);
  });
});

// ── 3 · the exclusions ───────────────────────────────────────────────────────────────────────────────────────────────
describe('3 · each exclusion sends nothing', () => {
  const skipped = async (c: ReminderCandidate, opts: Parameters<typeof world>[0], reason: string) => {
    const { w, deps } = world(opts);
    assert.deepEqual(await runRenewalReminder(c, deps, NOW), { outcome: 'skipped', reason });
    assert.equal(w.sent.length, 0);
    assert.equal(w.stamp.size, 0, 'nothing claimed');
  };

  it('38 days away', () => skipped(candidate({ chargeIso: inDays(38) }), { chargeIso: inDays(38) }, 'outside_window'));
  it('a dev mock subscription', () => skipped(candidate({ subscriptionId: 'mock_sub_1' }), {}, 'not_billing'));
  it('a waiting cancel or move to the free plan', () => skipped(candidate(), { pending: true }, 'ending'));
  it('a cancel set in Stripe', () => skipped(candidate(), { stripe: { cancelSet: true } }, 'ending'));
  it('a status other than active or trialing', () => skipped(candidate(), { stripe: { status: 'past_due' } }, 'not_billing'));
  it('a move down to a monthly plan: the next charge is not yearly', () =>
    skipped(candidate(), { stripe: { previewPlan: { planId: 'tournament_plus', cycle: 'monthly' } } }, 'not_yearly'));
  it('a price that is not ours', () => skipped(candidate(), { stripe: { previewPlan: null } }, 'not_yearly'));
  it('Stripe’s date has moved out of the window', () => skipped(candidate(), { stripe: { chargeIso: inDays(60) } }, 'outside_window'));

  it(`a trial whose purchase email went out under ${PURCHASE_NOTICE_DAYS} days before its first charge (it gave the date)`, async () => {
    const trial = candidate({ kind: 'trial', chargeIso: inDays(29) });
    // League's 30-day trial, bought yesterday: the purchase email said "Your first payment … on {date}".
    await skipped(trial, { chargeIso: inDays(29), purchaseEmailAt: inDays(-1) }, 'told_at_purchase');
    // A 60-day trial's purchase email is not the notice.
    const { w, deps } = world({ chargeIso: inDays(34), purchaseEmailAt: inDays(-26) });
    assert.equal((await runRenewalReminder(candidate({ kind: 'trial' }), deps, NOW)).outcome, 'sent');
    assert.equal(w.sent.length, 2);
  });

  it('a renewal never asks for the purchase email (a year-old stamp is not a notice)', async () => {
    const { w, deps } = world({ purchaseEmailAt: inDays(-5) });
    assert.equal((await runRenewalReminder(candidate(), deps, NOW)).outcome, 'sent');
    assert.equal(w.sent.length, 2);
  });

  it('a 100% coupon: nothing charged, so no "$0.00" notice', () => skipped(candidate(), { stripe: { beforeTaxCents: 0, taxLines: [], totalCents: 0 } }, 'nothing_charged'));

  it('a subscription that works no tax out: the email goes, and a person is told once', async () => {
    const { w, deps } = world({ stripe: { taxOff: true, taxLines: [], totalCents: 39000 } });
    assert.equal((await runRenewalReminder(candidate(), deps, NOW)).outcome, 'sent');
    assert.deepEqual(w.logged, ['the subscription works no tax out, so its renewal will be charged none']);
  });

  it('no owner to tell: nothing claimed', () => skipped(candidate(), { owners: [] }, 'no_recipient'));

  it('a failed preview sends nothing and claims nothing (the next day retries, still in the window)', async () => {
    const { w, deps } = world({ stripeThrows: true });
    await assert.rejects(runRenewalReminder(candidate(), deps, NOW), /preview failed/);
    assert.equal(w.sent.length, 0);
    assert.equal(w.stamp.size, 0);
  });
});

// ── 4 · the words ────────────────────────────────────────────────────────────────────────────────────────────────────
const input = (over: Partial<ReminderEmailInput> = {}): ReminderEmailInput => ({
  kind: 'renewal', orgName: 'Guelph Minor Ball', planLabel: 'Tournament Plus', nextPlanLabel: null,
  chargeIso: '2027-10-01T04:00:00.000Z', currency: 'cad', beforeTaxCents: 39000,
  taxLines: [{ label: 'HST (ON) 13%', cents: 5070 }], totalCents: 44070, billingUrl: 'https://x.test/billing', ...over,
});

describe('4 · the words (§6, copied exactly)', () => {
  it('a renewal', () => {
    const e = renewalReminderEmail(input());
    assert.equal(e.subject, 'Tournament Plus renews on October 1, 2027');
    assert.equal(e.vars.headingLine, 'Your yearly plan renews on October 1, 2027');
    assert.equal(e.vars.lead, 'Guelph Minor Ball’s yearly Tournament Plus plan renews on October 1, 2027. We’ll charge the card on file $390.00 '
      + 'plus applicable taxes. Based on today’s tax rates and your billing address on file, that’s HST (ON) 13% $50.70, for a total of '
      + '$440.70 CAD. If either changes, the tax will too.');
    assert.equal(e.vars.moveDownLine, '');
    assert.ok(e.html.includes(REMINDER_WORDS.keepOrStop('October 1, 2027').replace(/’/g, '’')));
    assert.ok(e.html.includes('Your billing page'));
  });

  it('a trial ending, and a next-season choice’s first charge', () => {
    const t = renewalReminderEmail(input({ kind: 'trial' }));
    assert.equal(t.subject, 'Your first yearly payment for Tournament Plus is on October 1, 2027');
    assert.equal(t.vars.headingLine, 'Your first yearly payment is on October 1, 2027');
    assert.match(t.vars.lead, /^Guelph Minor Ball’s free trial of yearly Tournament Plus ends on October 1, 2027\. We’ll then charge the card on file \$390\.00 plus applicable taxes\./);
    const n = renewalReminderEmail(input({ kind: 'next_season' }));
    assert.equal(n.subject, 'Your first yearly payment for Tournament Plus is on October 1, 2027');
    assert.match(n.vars.lead, /^Guelph Minor Ball’s yearly Tournament Plus plan starts on October 1, 2027\. We’ll charge the card on file \$390\.00 plus applicable taxes\./);
  });

  it('a waiting move down names the plan it renews into, at that plan’s price', async () => {
    const e = renewalReminderEmail(input({ planLabel: 'Club', nextPlanLabel: 'League' }));
    assert.equal(e.vars.moveDownLine, 'On October 1, 2027, Guelph Minor Ball moves to League, so this is the price of League.');
    assert.ok(e.html.includes('moves to League'));
    // Through the run: the preview's plan differs from today's.
    const { w, deps } = world({ planId: 'league' });
    await runRenewalReminder(candidate(), deps, NOW);
    assert.match(w.sent[0].vars.moveDownLine, /moves to League, so this is the price of League\.$/);
  });

  it('no tax on the preview: only the estimate sentence drops; the email still goes', () => {
    const e = renewalReminderEmail(input({ taxLines: [], totalCents: 39000 }));
    assert.equal(e.vars.lead, 'Guelph Minor Ball’s yearly Tournament Plus plan renews on October 1, 2027. We’ll charge the card on file $390.00 plus applicable taxes.');
  });

  it('a price in another currency names its code (CAD, ours, does not)', () => {
    const e = renewalReminderEmail(input({ currency: 'usd', taxLines: [] }));
    assert.ok(e.vars.lead.endsWith('card on file $390.00 USD plus applicable taxes.'), e.vars.lead);
    assert.ok(renewalReminderEmail(input()).vars.lead.includes('card on file $390.00 plus applicable taxes.'));
  });

  it('two taxes are named each', () => {
    const e = renewalReminderEmail(input({ taxLines: [{ label: 'GST 5%', cents: 1950 }, { label: 'PST (BC) 7%', cents: 2730 }], totalCents: 43680 }));
    assert.match(e.vars.lead, /that’s GST 5% \$19\.50 and PST \(BC\) 7% \$27\.30, for a total of \$436\.80 CAD\./);
  });

  it('transactional: the billing page is the only link; never "paid", "receipt" or an upsell', () => {
    const e = renewalReminderEmail(input({ nextPlanLabel: 'League' }));
    assert.deepEqual([...e.html.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['https://x.test/billing']);
    for (const w of [/\bpaid\b/i, /receipt/i, /payment received/i, /upgrade/i, /pricing/i]) assert.doesNotMatch(e.html, w);
  });

  it('the template row carries the same variables the email fills (mig 478)', () => {
    const mig = read('supabase/migrations/478_a_purchase_is_told_its_details.sql');
    const row = mig.slice(mig.indexOf('$k$yearly_renewal_reminder$k$'));
    const declared = JSON.parse(row.match(/'(\[[^\]]+\])'::jsonb/)![1]) as string[];
    assert.deepEqual([...declared].sort(), Object.keys(renewalReminderEmail(input()).vars).sort());
    assert.ok(row.includes('To keep it, there’s nothing to do. To stop it, cancel from your billing page before {{date}}; your plan stays active until then.'));
  });
});

// ── the figures: the plan's lines only (/accounting 2026-11-13) ──────────────────────────────────────────────────────
describe('4b · the figures are the plan’s own lines, never a queued fee riding the same invoice', () => {
  const tax = (amount: number, exclusive = true) => ({ amount, exclusive, taxRateId: 'txr_on' });
  const plan = { parentType: 'subscription_item_details', amount: 39000, discountCents: 0, priceId: 'price_tp_year', taxes: [tax(5070)] };
  const fee = { parentType: 'invoice_item_details', amount: 1250, discountCents: 0, priceId: null, taxes: [tax(163)] };
  const returned = { ...fee, amount: -400, taxes: [tax(-52)] };

  it('a recovered fee and a returned one change nothing', () => {
    assert.deepEqual(planLineFigures([plan, fee, returned]), planLineFigures([plan]));
    assert.deepEqual(planLineFigures([plan]), { beforeTaxCents: 39000, taxes: [{ amount: 5070, exclusive: true, taxRateId: 'txr_on' }], totalCents: 44070, priceId: 'price_tp_year' });
  });

  it('a discount comes off before tax, so price + tax = total', () => {
    const f = planLineFigures([{ ...plan, discountCents: 3900, taxes: [tax(4563)] }]);
    assert.equal(f.beforeTaxCents, 35100);
    assert.equal(f.totalCents, 35100 + 4563);
  });

  it('a tax inside the price is not added again', () => {
    assert.equal(planLineFigures([{ ...plan, taxes: [tax(4487, false)] }]).totalCents, 39000);
  });

  it('the server reads the lines through it, and the preview’s whole-invoice totals are not read', () => {
    const server = stripComments(read('lib/renewal-reminder-server.ts'));
    assert.ok(server.includes('planLineFigures((preview.lines?.data ?? [])'));
    for (const whole of ['preview.total', 'preview.subtotal', 'preview.total_taxes', 'preview.total_excluding_tax', 'amount_due']) {
      const at = server.indexOf(whole);
      assert.ok(at < 0 || /[\w_]/.test(server[at + whole.length]), `${whole} is the whole invoice, fees included`);
    }
  });
});

// ── 5 · the wiring ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('5 · the wiring', () => {
  const route = read('app/api/platform-admin/stripe-fees-daily/route.ts');
  const server = read('lib/renewal-reminder-server.ts');

  it('the daily job runs the reminder in its own step, after the purchase emails', () => {
    const purchase = route.indexOf("await run('purchase_emails',");
    const reminder = route.indexOf("await run('renewal_reminders', () => sendRenewalReminders(now));");
    assert.ok(purchase >= 0 && reminder > purchase);
  });

  it('the pre-filter reads the stored rows before any Stripe read: yearly, active or trialing, a subscription, at most 37 days out', () => {
    for (const s of [".eq('subscription_period', 'annual')", ".not('stripe_subscription_id', 'is', null)",
      ".in('subscription_status', ['active', 'trialing'])", ".lte('current_period_end', at(REMINDER_WINDOW.latestDays))",
      ".eq('next_season_billing_cycle', 'annual')"]) assert.ok(server.includes(s), s);
  });

  it('a row with no cycle on record is read only while its charge is over 31 days away (never a monthly plan’s), so Stripe decides', () => {
    assert.ok(server.includes('const NO_CYCLE_MIN_DAYS = 31;'));
    assert.ok(server.includes("billing(NO_CYCLE_MIN_DAYS).is('subscription_period', null)"));
  });

  it('the amount is Stripe’s preview of the next invoice (its plan lines, above); it writes no tax record', () => {
    assert.ok(server.includes('stripe.invoices.createPreview({ subscription: c.subscriptionId }, STRIPE_OPTS)'));
    assert.ok(server.includes('taxOff: !preview.automatic_tax?.enabled'));
    assert.doesNotMatch(server, /platform_charge_tax_records'\)\.(insert|upsert|update)/, 'it writes no tax record');
  });

  it('every owner (demo addresses skipped there); the claim is conditional; a time budget; the template key', () => {
    assert.ok(server.includes('recipients: orgOwnerEmails'));
    assert.ok(server.includes(".or(`renewal_reminded_for.is.null,renewal_reminded_for.neq.\"${chargeIso}\"`)"));
    assert.ok(server.includes("key: 'yearly_renewal_reminder'"));
    assert.match(server, /if \(Date\.now\(\) > stopAt\) break;/);
  });
});

// ── 6 · Québec ───────────────────────────────────────────────────────────────────────────────────────────────────────
describe('6 · Québec', () => {
  it('the rule: a Canadian address in Québec, typed or stored, any spelling of case', () => {
    assert.equal(isClosedRegion({ country: 'CA', regionCode: 'QC' }), true);
    assert.equal(isClosedRegion({ country: 'ca', regionCode: ' qc ' }), true);
    assert.equal(isClosedRegion({ country: 'CA', regionCode: 'ON' }), false);
    assert.equal(isClosedRegion({ country: 'US', regionCode: 'QC' }), false);
    assert.equal(isClosedRegion({}), false);
  });

  it('saving a Québec address still works: the validator accepts it (only a purchase from it is refused)', () => {
    const checked = checkBillingLocation({ country: 'CA', regionCode: 'QC', line1: '100 rue Sainte-Catherine', city: 'Montréal', postalCode: 'H2X 1Z4' }, { usSalesOpen: false });
    assert.equal(checked.ok, true);
  });

  it('the words (§6, copied exactly) and the code', () => {
    assert.equal(BILLING_LOCATION_WORDS.regionClosed, 'We’re not selling in Québec yet, so we can’t take a purchase with a billing address there. '
      + 'If the province is wrong, correct it on your billing page and try again.');
    assert.equal(BILLING_LOCATION_WORDS.qcClosed, 'We’re not selling in Québec yet.');
    assert.equal(BILLING_REGION_CLOSED, 'billing_region_closed');
  });

  it('the address form shows the notice under Province when Québec is chosen, and never as an error', () => {
    const form = read('components/billing/BillingAddressFields.tsx');
    assert.ok(form.includes('const qcClosed = isClosedRegion(draft);'));
    assert.match(form, /errors\.regionCode \? err\('regionCode'\) : qcClosed\s*\? <p id=\{id\('region-closed'\)\} className=\{styles\.amberLine\} role="status">\{BILLING_LOCATION_WORDS\.qcClosed\}<\/p>/);
    // It never blocks the save: the form's own check is checkBillingLocation, which accepts Québec (above).
    assert.doesNotMatch(form, /qcClosed[^\n]*setErrors|qcClosed[^\n]*disabled/);
  });

  it('the move window offers no "Check again" on the refusal (a retry cannot change the answer)', () => {
    const dialog = read('components/billing/PlanMoveDialog.tsx');
    assert.match(dialog, /const retryable = [^\n]*BILLING_REGION_CLOSED\]\.includes\(refusal\.code\)/);
  });

  it('the refusal does not follow the legal-pages switch (Q1: live in every state)', () => {
    const gate = read('lib/billing-location-server.ts');
    const body = gate.slice(gate.indexOf('export async function requireBillingLocation('), gate.indexOf('export async function withClubAddressOnStripe'));
    assert.doesNotMatch(body, /legalPagesMode|LEGAL_PAGES/);
  });
});

describe('Québec in the Premium → Club window (review 2026-11-13)', () => {
  it('the refusal keeps the address fields on screen, so the buyer can correct the province and ask again', () => {
    const dialog = read('components/billing/PlanMoveDialog.tsx');
    // Start your club is two steps (owner 2026-11-16): the form is step 1's body, shown whenever there is a charge OR this refusal,
    // and a refusal never gets a Next (the foot says why), so the buyer stays on the address.
    assert.ok(dialog.includes('const formShown = inPlace && (preview !== null || !!quote || refusal?.code === BILLING_REGION_CLOSED);'));
    assert.ok(dialog.includes('{clubStep && <>'));
    assert.ok(dialog.includes('const canNext = clubStep && !clubHold && !regionHold && stepMissing === null;'));
  });

  it('the gate and the in-place preview answer with the one Québec body', () => {
    assert.ok(read('lib/billing-location-server.ts').includes('export function regionClosedResponse('));
    assert.ok(read('app/api/billing/move/preview/route.ts').includes("regionClosedResponse('club')"));
  });
});
