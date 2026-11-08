import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { canViewPlatformArea, isPlatformAreaReadOnly, PLATFORM_POWERS } from '../../lib/platform-areas.ts';
import { visibleMenuGroups } from '../../app/platform-admin/console-menu.ts';
import { EXPORT_CATALOG } from '../../lib/export/catalog.ts';
import {
  RW, buildComingView, buildUnpaidView, byCurrencyWords, comingBand, comingExportRows, compedNotCountedWords, isStaleTrial,
  isTrialEnding, paramsFrom, paramsQuery, priceCell, priceTileNote, priceTileValue, rangeFace, rangeFor, rangeWords, unpaidBand,
  unpaidExportRows, unpaidRows,
  type ComingInput, type RenewalOrg, type UnpaidInput, type UnpaidRecord,
} from '../../lib/renewals.ts';

/**
 * PLANS & PRICING STAGE 2 PART 4 · RENEWALS (drawings PqUgoHqg57j1SGSo2YypjP; owner ruled all ten asks 2026-11-07). Read only,
 * from our own records. A total never adds two currencies, a price to a tax, or test to live; a figure that could not be read
 * is "—", never 0; the list price never stands in for a missing price on file; F2: a passed trial is not "ending".
 */

const TODAY = '2026-11-07';
const org = (over: Partial<RenewalOrg> = {}): RenewalOrg => ({
  id: 'o1', name: 'Northshore Minor Baseball', plan_id: 'club', account_kind: 'organization', subscription_status: 'active',
  current_period_end: '2026-11-09T15:00:00Z', subscription_period: 'monthly', subscription_amount_cents: 21900,
  subscription_currency: 'cad', stripe_subscription_id: 'sub_1', ...over,
});
const coming = (orgs: RenewalOrg[], over: Partial<ComingInput> = {}): ComingInput => ({
  orgs, orgsById: new Map(orgs.map(o => [o.id, o])), staffFreeTime: [], foundingByOrg: new Map(), endingOrgIds: new Set(), ...over,
});
const P = paramsFrom(() => null);
const rec = (over: Partial<UnpaidRecord> = {}): UnpaidRecord => ({
  stripe_invoice_id: 'in_1', org_id: 'o1', buyer_kind: 'club', kind: 'subscription', invoice_number: 'A1B2-0007', issued_at: '2026-10-14T16:00:00Z',
  currency: 'cad', amount_before_tax_cents: 8900, tax_total_cents: 1157, total_cents: 10057, cad_amount_before_tax_cents: 8900,
  cad_tax_total_cents: 1157, cad_total_cents: 10057, status: 'open', uncollectible_at: null, ...over,
});
const unpaid = (records: UnpaidRecord[], orgs: RenewalOrg[], over: Partial<UnpaidInput> = {}): UnpaidInput => ({
  records, orgsById: new Map(orgs.map(o => [o.id, o])),
  pastDueOrgIds: orgs.filter(o => o.subscription_status === 'past_due').map(o => o.id),
  pastDueSince: new Map(), endedOn: new Map(), excludedOrgIds: new Set(), ...over,
});

describe('who sees it', () => {
  it('Super admin, Billing and Support read it (the find_stripe roles); Product, Growth and Read only do not', () => {
    for (const role of ['super_admin', 'billing', 'support'] as const) assert.equal(canViewPlatformArea(role, 'renewals'), true, role);
    for (const role of ['product', 'growth', 'read_only'] as const) assert.equal(canViewPlatformArea(role, 'renewals'), false, role);
    assert.deepEqual([...PLATFORM_POWERS.find_stripe].sort(), ['billing', 'super_admin', 'support']);
  });
  it('nothing on it writes, so no role sees the eye', () => {
    for (const role of ['super_admin', 'billing', 'support'] as const) assert.equal(isPlatformAreaReadOnly(role, 'renewals'), false, role);
  });
  it('the menu: Customers, right after Free time, for its readers only', () => {
    const customers = (role: Parameters<typeof visibleMenuGroups>[0]) =>
      visibleMenuGroups(role, false, false).find(g => g.label === 'Customers')!.items.map(i => i.label);
    assert.deepEqual(customers('billing'), ['Clubs & portals', 'People', 'Free time', 'Renewals', 'Retention']);
    assert.ok(!customers('product').includes('Renewals'));
  });
  it('the page and the export guard on the area; the export writes the audit entry before the file', () => {
    assert.match(readCode('app/platform-admin/renewals/page.tsx'), /requirePlatformAreaView\('renewals'\)/);
    const route = readCode('app/api/platform-admin/renewals/export/route.ts');
    assert.match(route, /requirePlatformAreaApi\('renewals', 'view'\)/);
    assert.ok(route.indexOf('writePlatformAuditLogStrict') < route.indexOf('generateCSV(headers'), 'audit first');
    assert.match(route, /formulaSafeRow/);
  });
  it('no Stripe call and nothing stored: the reads touch our own tables only', () => {
    const read = readCode('lib/renewals-read.ts');
    assert.doesNotMatch(read, /getStripe|from 'stripe'|\.insert\(|\.update\(|\.upsert\(/);
    assert.doesNotMatch(readCode('app/platform-admin/renewals/RenewalsClient.tsx'), /method: 'POST'|sendJson|fetch\(/);
  });
  it('the registry holds both exports as included_justified, in /legal\'s words', () => {
    for (const id of ['platform-admin-renewals-coming-up', 'platform-admin-renewals-unpaid']) {
      const e = EXPORT_CATALOG.find(x => x.id === id)!;
      assert.equal(e.sensitiveFieldPolicy, 'included_justified', id);
      assert.match(e.sensitiveFieldJustification!, /No person name, email, address or card details\. Audited before the file is sent\./);
      assert.deepEqual(e.formats, ['xlsx', 'csv']);
    }
  });
  it('the words never call an unpaid bill lost', () => {
    assert.doesNotMatch(JSON.stringify(RW), /lost revenue|failed revenue|churn/i);
  });
});

describe('F2 · trial ending', () => {
  it('from today to 14 days out, in Ontario days', () => {
    assert.equal(isTrialEnding('trialing', '2026-11-07T04:30:00Z', TODAY), false, '11:30 p.m. Nov 6 in Toronto is yesterday');
    assert.equal(isTrialEnding('trialing', '2026-11-07T15:00:00Z', TODAY), true);
    assert.equal(isTrialEnding('trialing', '2026-11-22T03:00:00Z', TODAY), true, '10 p.m. Nov 21 is day 14');
    assert.equal(isTrialEnding('trialing', '2026-11-22T15:00:00Z', TODAY), false);
    assert.equal(isTrialEnding('active', '2026-11-08T15:00:00Z', TODAY), false);
  });
  it('a passed trial is stale, not ending', () => {
    assert.equal(isStaleTrial('trialing', '2026-10-29T15:00:00Z', TODAY), true);
    assert.equal(isTrialEnding('trialing', '2026-10-29T15:00:00Z', TODAY), false);
  });
  it('Today, Business numbers and Clubs & portals read the one rule', () => {
    assert.match(readCode('lib/platform-metrics.ts'), /isTrialEnding\(status, org\.current_period_end, today\)/);
    assert.match(readCode('app/platform-admin/orgs/page.tsx'), /trialEndingSoon:\s+isTrialEnding\(/);
  });
});

describe('F1 · comped clubs leave the monthly figure', () => {
  it('a running comp period is not added, and the pages say how many were left out', () => {
    const metrics = readCode('lib/platform-metrics.ts');
    assert.match(metrics, /if \(compedOrgIds\.has\(org\.id\) && !org\.stripe_subscription_id\) compedNotCounted \+= 1;\s+else estimatedMrr \+=/);
    assert.match(metrics, /row\.type === 'comp_period'/);
    for (const f of ['app/platform-admin/business-numbers/page.tsx', 'app/platform-admin/page.tsx']) {
      assert.match(readCode(f), /compedNotCountedWords\(stats\.totals\.compedNotCounted\)/, f);
    }
    assert.equal(compedNotCountedWords(0), '');
    assert.equal(compedNotCountedWords(1), ' · 1 comped club not counted');
    assert.equal(compedNotCountedWords(3), ' · 3 comped clubs not counted');
  });
});

describe('dates', () => {
  it('forward only, Ontario days', () => {
    assert.deepEqual(rangeFor('this_month', TODAY), { from: '2026-11-07', to: '2026-11-30' });
    assert.deepEqual(rangeFor('next_month', TODAY), { from: '2026-12-01', to: '2026-12-31' });
    assert.deepEqual(rangeFor('next_14', TODAY), { from: '2026-11-07', to: '2026-11-21' });
    assert.deepEqual(rangeFor('next_30', TODAY), { from: '2026-11-07', to: '2026-12-07' });
    assert.deepEqual(rangeFor('custom', TODAY, { from: '2026-10-01', to: '2026-12-15' }), { from: '2026-11-07', to: '2026-12-15' }, 'a past start starts today');
    assert.deepEqual(rangeFor('custom', TODAY, { from: '2027-01-10', to: '2027-01-05' }), { from: '2027-01-10', to: '2027-01-31' });
  });
  it('the face and the empty sentence as drawn', () => {
    assert.equal(rangeFace({ from: '2026-11-07', to: '2026-11-30' }), 'Nov 7 to 30');
    assert.equal(rangeFace({ from: '2026-11-07', to: '2026-12-07' }), 'Nov 7 to Dec 7');
    assert.equal(rangeWords({ from: '2026-11-07', to: '2026-11-30' }), 'Nov 7 to Nov 30');
    assert.equal(RW.coming.empty(rangeWords({ from: '2026-11-07', to: '2026-11-30' })), 'Nothing renews or ends from Nov 7 to Nov 30.');
  });
  it('the address round-trips, defaults left out (Today\'s doors read the same list)', () => {
    assert.equal(paramsQuery(P), '');
    const p = paramsFrom(k => ({ dates: 'next_14', what: 'trial_ends' } as Record<string, string>)[k]);
    assert.equal(paramsQuery(p), 'dates=next_14&what=trial_ends');
    assert.equal(paramsQuery(paramsFrom(k => (k === 'view' ? 'unpaid' : null))), 'view=unpaid');
    const waiting = readCode('lib/platform-waiting.ts');
    assert.match(waiting, /href: '\/platform-admin\/renewals\?view=unpaid'/);
    assert.match(waiting, /href: '\/platform-admin\/renewals\?dates=next_14&what=trial_ends'/);
    assert.match(waiting, /readerDoor && canViewPlatformArea\(role, readerDoor\.area\) \? readerDoor\.href : q\.href/);
  });
});

describe('the price on file', () => {
  it('before tax, in its own currency; the cycle only when the record holds it', () => {
    assert.deepEqual(priceCell(org()), { kind: 'price', cents: 21900, currency: 'cad', per: 'a month' });
    assert.deepEqual(priceCell(org({ subscription_period: 'annual', subscription_amount_cents: 219000 })), { kind: 'price', cents: 219000, currency: 'cad', per: 'a year' });
    assert.deepEqual(priceCell(org({ subscription_period: null, subscription_amount_cents: 3900 })), { kind: 'price', cents: 3900, currency: 'cad', per: null });
  });
  it('no price on file is said, never the list price', () => {
    assert.deepEqual(priceCell(org({ subscription_amount_cents: null })), { kind: 'no_price' });
  });
});

describe('Coming up', () => {
  const orgs = [
    org(),
    org({ id: 'o2', name: 'Maple Ridge Ball Association', plan_id: 'league', subscription_status: 'trialing', current_period_end: '2026-11-12T15:00:00Z', subscription_amount_cents: 8900 }),
    org({ id: 'o3', name: 'Fairview U11 Comets', plan_id: 'team', account_kind: 'team_workspace', subscription_status: 'trialing', current_period_end: '2026-10-29T15:00:00Z' }),
    org({ id: 'o4', name: 'No price yet', current_period_end: '2026-11-20T15:00:00Z', subscription_amount_cents: null, subscription_currency: null }),
    org({ id: 'o5', name: 'Founding club', plan_id: 'tournament_plus', stripe_subscription_id: null, current_period_end: '2027-10-01T03:59:59Z' }),
    org({ id: 'o6', name: 'Past due club', subscription_status: 'past_due', current_period_end: '2026-11-10T15:00:00Z' }),
    org({ id: 'o7', name: 'Next year', current_period_end: '2027-02-01T15:00:00Z' }),
    org({ id: 'o8', name: 'Leaving', current_period_end: '2026-11-15T15:00:00Z' }),
    org({ id: 'o9', name: 'Eastgate', current_period_end: '2026-11-25T15:00:00Z', subscription_currency: 'usd', subscription_amount_cents: 5000 }),
  ];
  const input = coming(orgs, {
    staffFreeTime: [{ orgId: 'o10', name: 'Hillcrest U13 Hawks', kind: 'portal', freeOn: 'Premium Coaches Portal', lastDay: '2026-11-18' }],
    orgsById: new Map([...orgs, org({ id: 'o10', name: 'Hillcrest U13 Hawks', plan_id: 'team', account_kind: 'team_workspace' })].map(o => [o.id, o])),
    endingOrgIds: new Set(['o8']),
  });
  const view = buildComingView(input, P, TODAY);

  it('every kind, soonest first, the stale trial first whatever the dates', () => {
    assert.deepEqual(view.rows.map(r => [r.kind, r.name]), [
      ['stale_trial', 'Fairview U11 Comets'],
      ['renews', 'Northshore Minor Baseball'],
      ['trial_ends', 'Maple Ridge Ball Association'],
      ['plan_ends', 'Leaving'],
      ['free_time_ends', 'Hillcrest U13 Hawks'],
      ['renews', 'No price yet'],
      ['renews', 'Eastgate'],
    ]);
  });
  it('a Founding comp never "renews"; a past-due club is on Unpaid bills; a canceled-at-end plan does not renew', () => {
    assert.ok(!view.rows.some(r => r.orgId === 'o5' || r.orgId === 'o6'));
    assert.deepEqual(view.rows.find(r => r.orgId === 'o8')!.price, { kind: 'no_renewal' });
  });
  it('a Coaches Portal shows the team\'s name, marked as a portal; doors go to the Money tab or Free time', () => {
    const fairview = view.rows.find(r => r.orgId === 'o3')!;
    assert.equal(fairview.isPortal, true);
    assert.equal(fairview.door.href, '/platform-admin/orgs/o3?tab=money');
    assert.equal(view.rows.find(r => r.orgId === 'o10')!.door.href, '/platform-admin/free-time?view=staff');
  });
  it('the band: counts, the price per currency (never added across), the missing prices apart', () => {
    const b = view.band!;
    assert.equal(b.renewals, 4);
    assert.equal(b.trials, 1);
    assert.equal(b.freeTime, 1);
    assert.equal(b.stale, 1);
    assert.deepEqual(b.price, { cad: 21900 + 8900, usd: 5000 });
    assert.equal(b.noPrice, 1);
    assert.equal(byCurrencyWords(b.price), '$308.00 CAD · $50.00 USD');
    assert.equal(priceTileNote(b), '2 renewals · 1 trial · 1 has no price on file');
    assert.equal(priceTileNote(comingBand(view.rows.filter(r => r.kind === 'trial_ends'))), 'CAD · 1 trial');
    assert.equal(priceTileNote(comingBand(view.rows.filter(r => r.kind === 'renews' && r.price.kind === 'price' && r.price.currency === 'cad'))), 'CAD · 1 renewal');
  });
  it('a pick narrows the rows, never the band', () => {
    const trials = buildComingView(input, { ...P, what: 'trial_ends' }, TODAY);
    assert.deepEqual(trials.rows.map(r => r.orgId), ['o2']);
    assert.equal(trials.band!.renewals, 4);
    assert.deepEqual(buildComingView(input, { ...P, what: 'free_or_founding' }, TODAY).rows.map(r => r.orgId), ['o10']);
    assert.deepEqual(buildComingView(input, { ...P, plan: 'league' }, TODAY).rows.map(r => r.orgId), ['o2']);
  });
  it('a Plan pick the rows do not offer reads as All plans, not as an empty list', () => {
    const stale = buildComingView(input, { ...P, plan: 'club_gone' }, TODAY);
    assert.equal(stale.rows.length, view.rows.length);
  });
  it('the price tile says "—" when nothing in the dates has a price on file, never a made-up $0.00', () => {
    const none = comingBand(buildComingView(coming([org({ subscription_amount_cents: null, subscription_currency: null })]), P, TODAY).rows);
    assert.equal(none.priced, 0);
    assert.equal(none.noPrice, 1);
    assert.equal(priceTileValue(none), '—');
    assert.equal(priceTileValue(view.band!), '$308.00 CAD · $50.00 USD');
    assert.equal(priceTileValue(comingBand([])), '$0.00', 'nothing renewing at all is a true zero');
  });
  it('could not read is not nothing due: no rows, no band', () => {
    const v = buildComingView(null, P, TODAY);
    assert.equal(v.read, false);
    assert.equal(v.band, null);
  });
  it('the export holds the rows on screen, a number in its own currency, no person', () => {
    const rows = comingExportRows(view.rows);
    assert.deepEqual(rows[1], ['2026-11-09', 'Renews', 'Northshore Minor Baseball', 'Club', 'Club', 219, 'CAD', 'a month']);
    assert.equal(rows[0][3], 'Coaches Portal');
  });
});

describe('Unpaid bills', () => {
  const orgs = [
    org({ id: 'o1', name: 'Lakeview Girls Softball', plan_id: 'league', subscription_status: 'past_due' }),
    org({ id: 'o2', name: 'Eastgate Rep Fastpitch', subscription_status: 'active' }),
    org({ id: 'o3', name: 'Cedar Park Softball', subscription_status: 'past_due' }),
    org({ id: 'o4', name: 'Gone', subscription_status: 'canceled' }),
    org({ id: 'demo', name: 'Riverdale', subscription_status: 'past_due' }),
  ];
  const records = [
    rec(),
    rec({ stripe_invoice_id: 'in_2', org_id: 'o2', invoice_number: 'C9D4-0011', issued_at: '2026-11-03T16:00:00Z', amount_before_tax_cents: 21900, tax_total_cents: 2847, total_cents: 24747 }),
    rec({ stripe_invoice_id: 'in_3', org_id: 'o4', status: 'uncollectible', uncollectible_at: '2026-06-01T16:00:00Z', issued_at: '2026-05-10T16:00:00Z' }),
    rec({ stripe_invoice_id: 'in_4', org_id: null, buyer_kind: 'person', kind: 'premium', invoice_number: null, issued_at: '2026-10-01T16:00:00Z', currency: 'usd', amount_before_tax_cents: 500, tax_total_cents: 0, total_cents: 500, cad_amount_before_tax_cents: null, cad_tax_total_cents: null, cad_total_cents: null }),
    rec({ stripe_invoice_id: 'in_5', org_id: 'demo' }),
    rec({ stripe_invoice_id: 'in_6', org_id: 'deleted', status: 'uncollectible', uncollectible_at: '2025-12-01T16:00:00Z' }),
  ];
  const input = unpaid(records, orgs, {
    pastDueSince: new Map([['o1', '2026-10-14T16:00:00Z']]),
    endedOn: new Map([['o4', '2026-10-31T16:00:00Z']]),
    excludedOrgIds: new Set(['demo']),
  });

  it('open bills by issue day, then the past-due club with no bill here; sandbox left out', () => {
    const rows = unpaidRows(input, 'open');
    assert.deepEqual(rows.map(r => [r.name, r.bill?.invoiceId ?? 'no bill']), [
      ['Coach', 'in_4'], ['Lakeview Girls Softball', 'in_1'], ['Eastgate Rep Fastpitch', 'in_2'], ['Cedar Park Softball', 'no bill'],
    ]);
  });
  it('the plan chips: past due since, date not recorded, plan ended, active', () => {
    const all = unpaidRows(input, 'all');
    const chip = (name: string) => all.find(r => r.name === name)!.chip?.text;
    assert.equal(chip('Lakeview Girls Softball'), 'Past due since Oct 14');
    assert.equal(chip('Cedar Park Softball'), 'Past due, date not recorded');
    assert.equal(chip('Eastgate Rep Fastpitch'), 'Active');
    assert.equal(all.find(r => r.name === 'Gone')!.chip?.text, 'Written off');
  });
  it('Written off lists the bad debts only, and no no-bill rows', () => {
    assert.deepEqual(unpaidRows(input, 'uncollectible').map(r => r.name), ['Gone', 'A club no longer on file'], 'by issue day');
  });
  it('a bill bought by an individual reads "Coach"; a club since deleted says so; neither has a door or a plan chip', () => {
    const coach = unpaidRows(input, 'open')[0];
    assert.equal(coach.name, 'Coach');
    assert.equal(coach.door, null);
    assert.equal(coach.chip, null);
    const gone = unpaidRows(input, 'uncollectible').find(r => r.key === 'in_6')!;
    assert.equal(gone.name, 'A club no longer on file');
    assert.equal(gone.door, null);
    const unmatched = unpaidRows(unpaid([rec({ stripe_invoice_id: 'in_7', org_id: null, buyer_kind: 'unknown' })], []), 'open')[0];
    assert.equal(unmatched.name, 'Not matched to a club');
  });
  it('the band never adds a price to a tax or two currencies', () => {
    const b = unpaidBand(input, TODAY);
    assert.equal(b.bills, 3);
    assert.equal(b.clubs, 3);
    assert.deepEqual(b.owed, { cad: 8900 + 21900, usd: 500 });
    assert.deepEqual(b.tax, { cad: 1157 + 2847, usd: 0 });
    assert.equal(b.noBill, 1);
    assert.deepEqual(b.writtenOffYear, { cad: 8900 });
    assert.equal(b.writtenOffYearCount, 1);
  });
  it('the no-bill tile narrows to those rows', () => {
    const v = buildUnpaidView(input, { ...paramsFrom(() => null), view: 'unpaid', noBill: true }, TODAY);
    assert.deepEqual(v.rows.map(r => r.name), ['Cedar Park Softball']);
  });
  it('the export: CAD beside the bill\'s own currency; a USD bill with no CAD value says so', () => {
    const rows = unpaidExportRows(unpaidRows(input, 'open'));
    assert.deepEqual(rows[0].slice(5, 12), [5, 0, 5, 'USD', 'not yet valued in CAD', 'not yet valued in CAD', 'not yet valued in CAD']);
    assert.deepEqual(rows[1].slice(5, 12), [89, 11.57, 100.57, 'CAD', 89, 11.57, 100.57]);
    assert.equal(rows[3][3], 'No bill in our record');
  });
  it('the export calls only a person\'s bill "Coach"; an unmatched bill is not a coach', () => {
    const withUnmatched = unpaid([...records, rec({ stripe_invoice_id: 'in_7', org_id: null, buyer_kind: 'unknown' })], orgs, { excludedOrgIds: new Set(['demo']) });
    const kinds = unpaidExportRows(unpaidRows(withUnmatched, 'open')).map(r => [r[1], r[2]]);
    assert.ok(kinds.some(([n, k]) => n === 'Coach' && k === 'Coach'));
    assert.ok(kinds.some(([n, k]) => n === 'Not matched to a club' && k === ''));
  });
  it('a Plan pick the rows do not offer reads as All plans', () => {
    const v = buildUnpaidView(input, { ...P, view: 'unpaid', plan: 'nope' }, TODAY);
    assert.equal(v.rows.length, unpaidRows(input, 'open').length);
  });
  it('could not read is not nothing owed', () => {
    const v = buildUnpaidView(null, { ...P, view: 'unpaid' }, TODAY);
    assert.equal(v.read, false);
    assert.equal(v.band, null);
  });
});
