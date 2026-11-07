import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { GST_HST_RATES_SOURCE, LOOK_PAGE, gstHstRateFor, needsLook, readAllPages, type NeedsLookRecord } from '../../lib/console-money-needs-look.ts';
import { NEEDS_LOOK_WORDS } from '../../lib/console-money-sales.ts';
import type { StoredTaxLine } from '../../lib/charge-tax-record.ts';
import { readCode } from './_source-code.ts';

/**
 * GST/HST Stage 3 Part 3a, "Needs a look" (drawing tab 5, owner Asks 4 and 8 = A; the four undrawn states ruled 2026-11-06 as
 * recommended). One block per check: it fires, it does not fire. Then the sales that are never on the list, the order, the
 * all-pages read, and the guards (the rate table's source, the role gate).
 */

const REG = '2026-09-26';

const line = (over: Partial<StoredTaxLine> = {}): StoredTaxLine => ({
  source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: null,
  rate: 13, effective_rate: 13, taxable_cents: 8850, cents: 1151, taxability_reason: 'standard_rated', tax_rate_id: 'txr_1', tax_behavior: 'exclusive',
  ...over,
});

/** A clean Ontario sale: taxed at HST 13%, an Ontario address, no review, no refund. */
const rec = (over: Partial<NeedsLookRecord> = {}): NeedsLookRecord => ({
  stripe_invoice_id: 'in_1', issued_at: '2026-10-14T10:00:00.000Z', status: 'paid', currency: 'cad',
  gst_hst_position: 'taxed', gst_hst_position_why: null, tax_lines: [line()],
  review_reason: null, review_note: null, evidence_missing: false, evidence_country: 'CA', evidence_region: 'ON', refunded_cents: 0,
  ...over,
});

const ctx: Parameters<typeof needsLook>[1] = { registration: REG, hasCreditNote: false };
const codes = (r: NeedsLookRecord, c = ctx) => needsLook(r, c).map(x => x.code);
const missing = (why: NonNullable<NeedsLookRecord['gst_hst_position_why']>) =>
  rec({ gst_hst_position: 'missing', gst_hst_position_why: why, tax_lines: [line({ cents: 0, taxability_reason: 'not_collecting' })] });

describe('a clean sale', () => {
  it('needs no look', () => {
    assert.deepEqual(needsLook(rec(), ctx), []);
  });
  it('a zero-rated sale with its proof needs no look', () => {
    assert.deepEqual(needsLook(rec({ gst_hst_position: 'zero_rated', evidence_country: 'US', evidence_region: 'NY', tax_lines: [] }), ctx), []);
  });
});

describe('check 1 · Stripe did not work out the tax', () => {
  it('fires on missing / stripe_did_not_work_out, with the drawn sentence', () => {
    const [r] = needsLook(missing('stripe_did_not_work_out'), ctx);
    assert.equal(r.code, 'not_worked_out');
    assert.equal(r.text, 'Stripe did not work out the tax on this invoice.');
  });
  it('does not fire on a taxed sale', () => assert.ok(!codes(rec()).includes('not_worked_out')));
});

describe('check 1.5 · an unexpected reason (undrawn state (a): the window’s own words)', () => {
  it('fires with the shipped sentence', () => {
    const [r] = needsLook(missing('unexpected_reason'), ctx);
    assert.equal(r.code, 'unexpected');
    assert.equal(r.text, 'Stripe gave the GST/HST line a reason we do not expect.');
  });
});

describe('check 2 · a Canadian buyer was not charged', () => {
  it('fires', () => assert.equal(needsLook(missing('canadian_buyer_not_charged'), ctx)[0].text, 'a Canadian buyer was not charged GST/HST.'));
  it('does not fire on a zero-rated sale', () => assert.deepEqual(codes(rec({ gst_hst_position: 'zero_rated', evidence_country: 'US', tax_lines: [] })), []));
});

describe('check 3 · zero-rated with no proof', () => {
  it('fires', () => {
    assert.equal(needsLook(missing('no_evidence_for_zero_rating'), ctx)[0].text,
      'zero-rated, but there is no proof the buyer is outside Canada (no US address or no US declaration).');
  });
});

describe('check 4 · the rate contradicts the kept address', () => {
  it('HST 13% on an Alberta address fires, in the drawn words', () => {
    const [r] = needsLook(rec({ evidence_region: 'AB' }), ctx);
    assert.equal(r.code, 'rate_mismatch');
    assert.equal(r.text, 'taxed at HST 13%, but the address kept with the sale is in Alberta (GST 5%).');
  });
  it('the right rate for the province does not fire (Ontario 13, Nova Scotia 14, Alberta 5, Québec GST 5 beside its QST)', () => {
    assert.deepEqual(codes(rec()), []);
    assert.deepEqual(codes(rec({ evidence_region: 'NS', tax_lines: [line({ rate: 14 })] })), []);
    assert.deepEqual(codes(rec({ evidence_region: 'AB', tax_lines: [line({ name: 'GST', tax_type: 'gst', rate: 5 })] })), []);
    assert.deepEqual(codes(rec({ evidence_region: 'QC', tax_lines: [
      line({ name: 'GST', tax_type: 'gst', rate: 5 }), line({ name: 'QST', tax_type: 'qst', rate: 9.975 }),
    ] })), [], 'only the GST/HST line is compared');
  });
  it('BC’s PST line (not collecting) is not GST/HST and never compared', () => {
    assert.deepEqual(codes(rec({ evidence_region: 'BC', tax_lines: [
      line({ name: 'GST', tax_type: 'gst', rate: 5 }), line({ name: 'PST', tax_type: 'pst', rate: 7, cents: 0, taxability_reason: 'not_collecting' }),
    ] })), []);
  });
  it('Nova Scotia at 15% before its April 1, 2025 cut is right, and wrong after', () => {
    assert.deepEqual(gstHstRateFor('NS', '2025-03-31T12:00:00.000Z'), { kind: 'HST', rate: 15 });
    assert.deepEqual(gstHstRateFor('NS', '2025-04-01T12:00:00.000Z'), { kind: 'HST', rate: 14 });
    assert.equal(needsLook(rec({ evidence_region: 'NS', tax_lines: [line({ rate: 15 })] }), ctx)[0].text,
      'taxed at HST 15%, but the address kept with the sale is in Nova Scotia (HST 14%).');
  });
  it('no address, a US address or an unknown code cannot contradict a rate (check 6 speaks for a missing one)', () => {
    assert.ok(!codes(rec({ evidence_missing: true, evidence_country: null, evidence_region: null })).includes('rate_mismatch'));
    assert.deepEqual(codes(rec({ evidence_country: 'US', evidence_region: 'NY' })), []);
    assert.deepEqual(codes(rec({ evidence_region: 'ZZ' })), []);
  });
});

describe('check 5 · flagged for review when it was sold', () => {
  it('fires with the review’s own sentence after it', () => {
    const note = 'The address is in the United States, but the card was issued in Canada.';
    assert.equal(needsLook(rec({ review_reason: 'card_country_mismatch', review_note: note }), ctx)[0].text, `flagged for review when it was sold. ${note}`);
  });
  it('a review with no sentence kept still fires, without one', () => {
    assert.equal(needsLook(rec({ review_reason: 'card_country_mismatch' }), ctx)[0].text, 'flagged for review when it was sold.');
  });
});

describe('check 6 · no billing address could be read', () => {
  it('fires', () => {
    assert.deepEqual(needsLook(rec({ evidence_missing: true, evidence_country: null, evidence_region: null }), ctx),
      [{ code: 'no_evidence', text: 'no billing address could be read when it was sold.' }]);
  });
});

describe('check 7 · a refund with no credit note (Ask 8)', () => {
  it('fires with no issued note, naming the amount', () => {
    assert.equal(needsLook(rec({ refunded_cents: 5000 }), ctx)[0].text,
      'refunded $50.00 in Stripe’s dashboard with no credit note, so the tax was not reduced.');
  });
  it('any issued note clears it, a partial one too (owner 2026-11-06, as drawn)', () => {
    assert.deepEqual(needsLook(rec({ refunded_cents: 5000 }), { ...ctx, hasCreditNote: true }), []);
  });
  it('no refund, no flag', () => assert.deepEqual(codes(rec({ refunded_cents: 0 })), []));
});

describe('never on the list', () => {
  it('a void sale, whatever is wrong with it', () => {
    assert.deepEqual(needsLook({ ...missing('canadian_buyer_not_charged'), status: 'void', refunded_cents: 100, evidence_missing: true }, ctx), []);
  });
  it('a sale issued before the registration took effect, whatever is wrong with it', () => {
    assert.deepEqual(needsLook({ ...missing('canadian_buyer_not_charged'), issued_at: '2026-09-01T10:00:00.000Z', review_reason: 'card_country_mismatch' }, ctx), []);
  });
  it('the registration day itself is on it (Toronto day)', () => {
    assert.equal(codes({ ...missing('canadian_buyer_not_charged'), issued_at: '2026-09-26T05:00:00.000Z' }).length, 1);
  });
  it('open and written-off sales ARE on it (undrawn state (c))', () => {
    assert.equal(codes({ ...missing('canadian_buyer_not_charged'), status: 'open' }).length, 1);
    assert.equal(codes({ ...missing('canadian_buyer_not_charged'), status: 'uncollectible' }).length, 1);
  });
});

describe('the registration date could not be read', () => {
  const unread = { registration: null, hasCreditNote: false };
  it('nothing is called missing (checks 1 to 3)', () => {
    for (const why of ['stripe_did_not_work_out', 'unexpected_reason', 'canadian_buyer_not_charged', 'no_evidence_for_zero_rating'] as const) {
      assert.deepEqual(needsLook(missing(why), unread), [], why);
    }
  });
  it('the checks that do not turn on the date still run', () => {
    assert.deepEqual(codes(rec({ evidence_region: 'AB', review_reason: 'card_country_mismatch', refunded_cents: 100 }), unread),
      ['rate_mismatch', 'review', 'refund_no_note']);
  });
  it('a sale before our records begin is still never on it', () => {
    assert.deepEqual(needsLook(rec({ issued_at: '2026-04-01T10:00:00.000Z', refunded_cents: 100 }), unread), []);
  });
});

describe('one reason shows, the window lists all', () => {
  it('reasons come in the drawn order', () => {
    const r = { ...missing('canadian_buyer_not_charged'), review_reason: 'card_country_mismatch', evidence_missing: true, evidence_country: null,
      evidence_region: null, refunded_cents: 100 } as NeedsLookRecord;
    assert.deepEqual(codes(r), ['buyer_not_charged', 'review', 'no_evidence', 'refund_no_note']);
    assert.deepEqual(codes(rec({ evidence_region: 'AB', review_reason: 'card_country_mismatch' })), ['rate_mismatch', 'review']);
  });
});

describe('the words', () => {
  it('the strip, the count and both empty states say what is drawn', () => {
    assert.equal(NEEDS_LOOK_WORDS.strip(2), '2 sales need a look at their tax.');
    assert.equal(NEEDS_LOOK_WORDS.strip(1), '1 sale needs a look at its tax.');
    assert.equal(NEEDS_LOOK_WORDS.count(2), '2 sales need a look, newest first');
    assert.equal(NEEDS_LOOK_WORDS.count(0), 'No sales need a look');
    assert.equal(NEEDS_LOOK_WORDS.emptyText(REG),
      'Every sale since Sep 26, 2026, when our GST/HST registration took effect, has a GST/HST answer that matches what was kept with it.');
    assert.equal(NEEDS_LOOK_WORDS.emptyText(null), 'Every sale has a GST/HST answer that matches what was kept with it.');
  });
});

describe('every page is read', () => {
  const table = Array.from({ length: 2345 }, (_, i) => i);
  it('past PostgREST’s 1000-row answer, every row once', async () => {
    const asked: Array<[number, number]> = [];
    const all = await readAllPages<number>(async (from, to) => { asked.push([from, to]); return { data: table.slice(from, to + 1), error: null }; });
    assert.equal(all.length, 2345);
    assert.deepEqual(new Set(all).size, 2345);
    assert.deepEqual(asked[1], [LOOK_PAGE, 2 * LOOK_PAGE - 1]);
  });
  it('a project capped below the page size (short pages that are not the last) still loses nothing', async () => {
    const all = await readAllPages<number>(async (from, to) => ({ data: table.slice(from, Math.min(to + 1, from + 500)), error: null }));
    assert.equal(all.length, 2345);
  });
  it('an error on any page fails the whole read (never a short list)', async () => {
    await assert.rejects(readAllPages<number>(async from => (from > 0 ? { data: null, error: new Error('boom') } : { data: table.slice(0, 1000), error: null })));
  });
});

describe('guards', () => {
  it('the rate table cites the /accounting research, and that file still says the rates the code holds', () => {
    const doc = readFileSync(GST_HST_RATES_SOURCE.doc, 'utf8');
    assert.match(doc, new RegExp(`page dated ${GST_HST_RATES_SOURCE.ratesAsOf}`), 'the CRA page date the code cites');
    assert.match(doc, new RegExp(`\\*\\*Last verified:\\*\\* ${GST_HST_RATES_SOURCE.verified}`), 're-verified? move the date in the code with it');
    assert.match(doc, /ON 13% HST · NB, NL, PE 15% HST · \*\*NS 14% HST \(cut from 15% on\s+2025-04-01\)\*\* · AB, NT, NU, YT 5% GST · BC, MB, SK, QC 5% GST/);
    for (const [code, rate] of [['ON', 13], ['NB', 15], ['NL', 15], ['PE', 15], ['NS', 14], ['AB', 5], ['NT', 5], ['NU', 5], ['YT', 5], ['BC', 5], ['MB', 5], ['SK', 5], ['QC', 5]] as const) {
      assert.equal(gstHstRateFor(code, '2026-10-01T12:00:00.000Z')?.rate, rate, code);
    }
  });
  it('the needs-a-look route asks the same Stripe-reading power as the Money route, before it reads anything', () => {
    const route = readCode('app/api/platform-admin/orgs/[id]/money/needs-look/route.ts');
    const money = readCode('app/api/platform-admin/orgs/[id]/money/route.ts');
    for (const code of [route, money]) assert.match(code, /const auth = await requirePlatformPower\('find_stripe'\);\s*if \(auth\.response\) return auth\.response;/);
    assert.ok(route.indexOf("requirePlatformPower('find_stripe')") < route.indexOf('readNeedsLook('));
    assert.doesNotMatch(route, /\.insert\(|\.upsert\(|\.update\(|getStripe/, 'it reads our records only');
    assert.match(route, /if \(club\.customerShared\) return/, 'a shared customer is refused, as on the Money route');
  });
  it('the club record reads it only for the Stripe-reading roles, and the one dot is both reviews', () => {
    const tab = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
    assert.match(tab, /useNeedsLook\(org\.id, props\.money\.readsStripe\)/);
    assert.match(tab, /const moneyNeedsReview = !!reviewOf\(billing\) \|\| lookCount\(needsLook\.look\) > 0;/);
  });
  it('the reader reads every page, never voids, and never writes the records', () => {
    const store = readCode('lib/console-money-sales-store.ts');
    const reader = store.slice(store.indexOf('export async function readNeedsLook'), store.indexOf('export async function registrationDateOrNull'));
    assert.match(reader, /readAllPages<SaleRecord>/);
    assert.match(reader, /\.neq\('status', 'void'\)/);
    assert.match(reader, /\.order\('issued_at', \{ ascending: false \}\)\.order\('stripe_invoice_id'\)\.range\(from, to\)/, 'a unique order under the pages');
    assert.doesNotMatch(store, /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  });
});
