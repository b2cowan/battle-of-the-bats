import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOOK_WHY_MAX, currentMark, lookKey, lookKeysOf, looksHold, lookWhyRefusal, settleLooks, type LookRow,
} from '../../lib/console-money-looks.ts';
import { needsLook, type NeedsLookRecord } from '../../lib/console-money-needs-look.ts';
import { NEEDS_LOOK_WORDS } from '../../lib/console-money-sales.ts';
import type { StoredTaxLine } from '../../lib/charge-tax-record.ts';
import { filesUnder, readCode, readSource } from './_source-code.ts';

/**
 * GST/HST Stage 3 Part 3b, "Mark as looked at" (drawing tab 5, owner Ask 6; the 2026-11-06 ruling that a mark holds by reason
 * CODE plus a small fingerprint). The rule on fixtures: holds / re-lists on a new code, a changed province or a growing refund /
 * undo / the chain. Then the routes, Today's row and the Clubs filter, and the guard that nothing which sums tax reads a mark.
 */

const REG = '2026-09-26';

const line = (over: Partial<StoredTaxLine> = {}): StoredTaxLine => ({
  source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: null,
  rate: 13, effective_rate: 13, taxable_cents: 8850, cents: 1151, taxability_reason: 'standard_rated', tax_rate_id: 'txr_1', tax_behavior: 'exclusive',
  ...over,
});

/** A clean Ontario sale; each test makes it need a look the way it means to. */
const rec = (id: string, over: Partial<NeedsLookRecord> = {}): NeedsLookRecord => ({
  stripe_invoice_id: id, issued_at: '2026-10-14T10:00:00.000Z', status: 'paid', currency: 'cad',
  gst_hst_position: 'taxed', gst_hst_position_why: null, tax_lines: [line()],
  review_reason: null, review_note: null, evidence_missing: false, evidence_country: 'CA', evidence_region: 'ON', refunded_cents: 0,
  ...over,
});
/** HST 13% charged to an address in Alberta: check 4 (rate_mismatch). */
const albertaAtHst = (id: string, region = 'AB') => rec(id, { evidence_region: region });
/** Refunded in Stripe's dashboard, no credit note: check 7. */
const refunded = (id: string, cents: number) => rec(id, { refunded_cents: cents });

let seq = 0;
const row = (invoice: string, over: Partial<LookRow> = {}): LookRow => ({
  id: `look-${++seq}`, seq, stripe_invoice_id: invoice, looked_keys: [], put_back_of: null,
  looked_by: 'sam@fieldlogichq.example', looked_at: '2026-11-08T15:15:00.000Z', why: 'Checked with the buyer; the address was wrong.', ...over,
});
const markFor = (record: NeedsLookRecord, ctx = { registration: REG, hasCreditNote: false }): LookRow =>
  row(record.stripe_invoice_id, { looked_keys: lookKeysOf(record, needsLook(record, ctx)) });
const rowsOf = (...rows: LookRow[]) => {
  const m = new Map<string, LookRow[]>();
  for (const r of rows) m.set(r.stripe_invoice_id, [...(m.get(r.stripe_invoice_id) ?? []), r]);
  return m;
};
const settle = (records: NeedsLookRecord[], rows: LookRow[] = [], issued: string[] = []) =>
  settleLooks(records, { registration: REG, issued: new Set(issued) }, rowsOf(...rows));

describe('the key a reason is marked by', () => {
  it('a plain reason is its code', () => {
    const r = rec('in_1', { review_reason: 'country_mismatch', review_note: 'The card was issued in Canada.' });
    assert.deepEqual(lookKeysOf(r, needsLook(r, { registration: REG, hasCreditNote: false })), ['review']);
  });
  it('a rate mismatch also keeps the province of the address looked at', () => {
    assert.equal(lookKey({ evidence_region: 'AB', refunded_cents: 0 }, 'rate_mismatch'), 'rate_mismatch:AB');
    assert.equal(lookKey({ evidence_region: null, refunded_cents: 0 }, 'rate_mismatch'), 'rate_mismatch:unknown');
  });
  it('a refund with no note also keeps the amount refunded so far', () => {
    assert.equal(lookKey({ evidence_region: 'ON', refunded_cents: 5000 }, 'refund_no_note'), 'refund_no_note:5000');
  });
  it('a province with odd characters is cleaned to what the table accepts', () => {
    assert.match(lookKey({ evidence_region: "Al'berta; DROP", refunded_cents: 0 }, 'rate_mismatch'), /^rate_mismatch:[A-Za-z0-9_.-]{0,40}$/);
  });
  it('the keys of a sale are sorted and without repeats', () => {
    const r = rec('in_1', { evidence_region: 'AB', refunded_cents: 1000, review_reason: 'x' });
    const keys = lookKeysOf(r, needsLook(r, { registration: REG, hasCreditNote: false }));
    assert.deepEqual(keys, [...keys].sort());
    assert.equal(new Set(keys).size, keys.length);
  });
  it('rewording a sentence never changes a key (a key has no sentence in it)', () => {
    const r = albertaAtHst('in_1');
    const keys = lookKeysOf(r, needsLook(r, { registration: REG, hasCreditNote: false }));
    assert.ok(keys.every(k => !k.includes(' ')), 'no sentence in a key');
  });
});

describe('a sale is looked at only while every reason it has now is inside the mark', () => {
  it('holds when the reasons are the ones marked', () => {
    const r = albertaAtHst('in_1');
    assert.equal(settle([r], [markFor(r)]).standing.length, 0);
    assert.ok(settle([r], [markFor(r)]).looked.in_1);
  });
  it('holds when a marked reason has since gone away (fewer reasons than marked)', () => {
    const r = rec('in_1', { evidence_region: 'AB', refunded_cents: 1000 });
    const mark = markFor(r);
    assert.deepEqual(mark.looked_keys.length, 2);
    const fixed = rec('in_1', { evidence_region: 'AB', refunded_cents: 1000 });
    // the credit note arrives: the refund reason is gone, the province one is still inside the mark
    assert.equal(settle([fixed], [mark], ['in_1']).standing.length, 0);
  });
  it('a NEW reason on the same sale puts it back on the list', () => {
    const before = albertaAtHst('in_1');
    const mark = markFor(before);
    const now = rec('in_1', { evidence_region: 'AB', review_reason: 'country_mismatch', review_note: 'x' });
    const out = settle([now], [mark]);
    assert.equal(out.standing.length, 1);
    assert.deepEqual(out.reasons.in_1.map(x => x.code), ['rate_mismatch', 'review']);
  });
  it('a changed province is a new problem (the fingerprint), though the code is the same', () => {
    const mark = markFor(albertaAtHst('in_1', 'AB'));
    assert.equal(settle([albertaAtHst('in_1', 'AB')], [mark]).standing.length, 0);
    assert.equal(settle([albertaAtHst('in_1', 'BC')], [mark]).standing.length, 1);
  });
  it('a second refund in Stripe’s dashboard is a new problem (the amount grew), though the code is the same', () => {
    const mark = markFor(refunded('in_1', 5000));
    assert.equal(settle([refunded('in_1', 5000)], [mark]).standing.length, 0);
    assert.equal(settle([refunded('in_1', 7000)], [mark]).standing.length, 1);
  });
  it('a sale nobody marked stays on the list', () => {
    assert.equal(settle([albertaAtHst('in_1')]).standing.length, 1);
  });
  it('a sale that needs no look is in neither list, marked or not', () => {
    const out = settle([rec('in_1')], [row('in_1', { looked_keys: ['review'] })]);
    assert.deepEqual([out.standing.length, Object.keys(out.looked).length, Object.keys(out.allReasons).length], [0, 0, 0]);
  });
  it('a looked-at sale is out of `standing` and `reasons`, in `looked`, and still in `allReasons` (the mark door reads it)', () => {
    const r = albertaAtHst('in_1');
    const out = settle([r], [markFor(r)]);
    assert.equal(out.reasons.in_1, undefined);
    assert.equal(out.looked.in_1.by, 'sam@fieldlogichq.example');
    assert.deepEqual(out.allReasons.in_1.map(x => x.code), ['rate_mismatch']);
  });
  it('a credit note issued after the mark does not bring the sale back (it only clears a reason)', () => {
    const r = refunded('in_1', 5000);
    const mark = markFor(r);
    assert.equal(settle([r], [mark], ['in_1']).standing.length, 0);
  });
});

describe('the chain: mark, put back, mark again', () => {
  it('the newest row decides', () => {
    const m1 = row('in_1', { looked_keys: ['rate_mismatch:AB'] });
    const back = row('in_1', { put_back_of: m1.id });
    const m2 = row('in_1', { looked_keys: ['rate_mismatch:AB', 'review'] });
    assert.equal(currentMark([m1])?.id, m1.id);
    assert.equal(currentMark([m1, back]), null, 'put back = not marked');
    assert.equal(currentMark([m2, back, m1])?.id, m2.id, 'order of arrival does not matter; seq does');
    assert.equal(currentMark([]), null);
  });
  it('a put-back puts the sale back on the list', () => {
    const r = albertaAtHst('in_1');
    const m = markFor(r);
    const back = row('in_1', { put_back_of: m.id });
    assert.equal(settle([r], [m, back]).standing.length, 1);
    assert.equal(settle([r], [m, back]).looked.in_1, undefined);
  });
  it('looksHold: no mark, or no current reasons, is not looked at', () => {
    assert.equal(looksHold(null, ['review']), false);
    assert.equal(looksHold({ looked_keys: ['review'] }, []), false);
    assert.equal(looksHold({ looked_keys: ['review', 'no_evidence'] }, ['review']), true);
    assert.equal(looksHold({ looked_keys: ['review'] }, ['review', 'no_evidence']), false);
  });
});

describe('Today’s count and a club’s strip are one rule', () => {
  // Three clubs' sales through the one function: what a club shows is the standing sales of its customer; Today counts them all.
  const sales = [albertaAtHst('in_a1'), refunded('in_a2', 5000), rec('in_a3'), albertaAtHst('in_b1', 'BC'), rec('in_c1', { evidence_missing: true, evidence_country: null, evidence_region: null })];
  const marks = [markFor(sales[0]), markFor(sales[4])];
  const out = settle(sales, marks);
  it('the platform count is the sum of the clubs’ counts on the same data', () => {
    const club = (prefix: string) => out.standing.filter(r => r.stripe_invoice_id.startsWith(prefix)).length;
    assert.equal(out.standing.length, club('in_a') + club('in_b') + club('in_c'));
    assert.deepEqual(out.standing.map(r => r.stripe_invoice_id).sort(), ['in_a2', 'in_b1']);
  });
  it('a looked-at sale drops out of the count, and its mark is kept for the window', () => {
    assert.deepEqual(Object.keys(out.looked).sort(), ['in_a1', 'in_c1']);
  });
});

describe('the why', () => {
  it('is required, and a blank is refused with the words for the door that was used', () => {
    assert.equal(lookWhyRefusal('   '), NEEDS_LOOK_WORDS.mark.refusals.whyBlank);
    assert.equal(lookWhyRefusal(undefined), NEEDS_LOOK_WORDS.mark.refusals.whyBlank);
    assert.equal(lookWhyRefusal('', true), NEEDS_LOOK_WORDS.mark.refusals.whyBlankPutBack);
  });
  it('is capped at the refund reason’s length', () => {
    assert.equal(LOOK_WHY_MAX, 500);
    assert.equal(lookWhyRefusal('a'.repeat(500)), null);
    assert.equal(lookWhyRefusal('a'.repeat(501)), NEEDS_LOOK_WORDS.mark.refusals.whyLong(500));
  });
  it('refuses a card number, as a refund’s reason does', () => {
    assert.equal(lookWhyRefusal('they paid with 4242 4242 4242 4242'), NEEDS_LOOK_WORDS.mark.refusals.whyCard);
    assert.equal(lookWhyRefusal('Checked with the buyer; the address was wrong.'), null);
  });
});

describe('the words', () => {
  it('say what the drawing says', () => {
    const W = NEEDS_LOOK_WORDS.mark;
    assert.equal(W.title('Oct 1'), 'Mark the Oct 1 sale as looked at');
    assert.equal(W.looked('Nov 8, 10:15 a.m.', 'sam@fieldlogichq.example', 'Fixed.'), 'Looked at Nov 8, 10:15 a.m. by sam@fieldlogichq.example: Fixed.');
    assert.equal(W.done, 'Marked as looked at.');
    assert.equal(W.putBack, 'Put it back on the list');
    assert.equal(W.supportLine, 'Billing or Super admin marks a sale as looked at.');
    assert.equal(W.whyPlaceholder, 'What did you find, and what was done? Never a card number.');
    assert.equal(W.foot, 'Goes in the audit log and on the sale’s window.');
    assert.equal(W.sentenceBold, 'Its record and its tax do not change');
  });
});

describe('the routes', () => {
  const mark = readCode('app/api/platform-admin/orgs/[id]/money/looks/route.ts');
  const back = readCode('app/api/platform-admin/orgs/[id]/money/looks/put-back/route.ts');
  for (const [name, code] of [['mark', mark], ['put-back', back]] as const) {
    it(`${name}: the refund power is asked before anything is read, and the same club gate as the Money route`, () => {
      assert.match(code, /const auth = await requirePlatformPower\('refund'\);\s*if \(auth\.response\) return auth\.response;/);
      assert.ok(code.indexOf("requirePlatformPower('refund')") < code.indexOf('clubStripeFacts('));
      assert.match(code, /!club\?\.customerId \|\| club\.customerShared/);
    });
    it(`${name}: writes one audit row with the why, and never touches the tax records`, () => {
      assert.match(code, /writePlatformAuditLog\(actorEmail, id, 'sale_look_(mark|put_back)'[^;]*\{ reason: String\(body\.why\)\.trim\(\) \}\)/);
      assert.doesNotMatch(code, /platform_charge_tax_records|supabaseAdmin|getStripe/);
    });
  }
  it('the reasons a mark is made for are the SERVER’s: the body carries no keys or codes', () => {
    assert.doesNotMatch(mark, /body\.(keys|codes|reasons)/);
    assert.match(mark, /\{ invoiceId\?: unknown; why\?: unknown \}/);
  });
  it('the put-back names the mark it saw (a stale one is a 409), and the store checks it is the newest', () => {
    assert.match(back, /lookId/);
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store, /if \(!mark \|\| mark\.id !== ask\.lookId\) return \{ ok: false, status: 409/);
  });
  it('the store: a blank/card/long why is a 400 before any read; a stale or already-marked sale is a 409; a lost race (23505) is a 409', () => {
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store, /const refusal = lookWhyRefusal\(ask\.why\);\s*if \(refusal\) return \{ ok: false, status: 400/);
    assert.match(store, /if \(!now\.reasons\.length\) return \{ ok: false, status: 409/);
    assert.match(store, /if \(mark && looksHold\(mark, now\.keys\)\) return \{ ok: false, status: 409/);
    assert.match(store, /error\.code === '23505'\) return \{ ok: false, status: 409/);
  });
  it('a mark and a put-back clear the Today memo, and a lost race is told in the words of the door that was used', () => {
    for (const code of [mark, back]) assert.match(code, /forgetSalesTaxWaiting\(\);\s*return NextResponse\.json\(\{ ok: true \}/);
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store, /\}, REFUSE\.alreadyMarked\);/);
    assert.match(store, /\}, REFUSE\.cannotPutBack\);/);
  });
  it('a sale whose reasons have gone can still be put back (its marks are read for it alone)', () => {
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store, /judgeSales\(\[one\.sale\], registration\), allLooksFor\(\[ask\.invoiceId\]\)/);
  });
  it('chunks of invoices are read one at a time (no unbounded fan-out from Today’s count)', () => {
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store, /for \(const chunk of chunked\(\[\.\.\.new Set\(invoiceIds\)\], IN_CHUNK\)\) out\.push\(\.\.\.await readAllPages/);
    assert.doesNotMatch(store, /Promise\.all\(chunked/);
  });
  it('the audit entry is hidden, like a refund’s, from the roles that do not read Stripe, and has a label', async () => {
    const { isMoneyEntry } = await import('../../lib/platform-audit-reason.ts');
    assert.equal(isMoneyEntry('sale_look_mark'), true);
    assert.equal(isMoneyEntry('sale_look_put_back'), true);
    assert.match(readSource('app/platform-admin/audit/page.tsx'), /sale_look_mark: 'Marked a sale as looked at'/);
  });
});

describe('the reader applies the mark; the rules stay pure', () => {
  it('the pure rules never import the looks module (a mark is applied by the reader, never by the checks)', () => {
    assert.doesNotMatch(readCode('lib/console-money-needs-look.ts'), /console-money-looks|platform_charge_tax_looks/);
  });
  it('a club’s read and Today’s count both come through judgeSales, and neither runs the checks itself', () => {
    const store = readCode('lib/console-money-sales-store.ts');
    assert.match(store.slice(store.indexOf('export async function readNeedsLook')), /await judgeSales\(records, registration\)/);
    const wait = readCode('lib/console-money-sales-tax-wait.ts');
    assert.match(wait, /await judgeSales\(records, registration\)/);
    assert.doesNotMatch(wait, /needsLook\(/);
    assert.match(wait, /registrationDateOrNull\(\)/, 'the same registration rule as the strip: the date unread turns checks 1-3 off, 4-7 run');
  });
  it('Today counts only sales a club’s Money tab would show (one organization, not shared), once per invoice', () => {
    const wait = readCode('lib/console-money-sales-tax-wait.ts');
    assert.match(wait, /customerSharing\(ids\[0\], ids\.length, /, 'customerSharing owns the one-organization rule');
    assert.match(wait, /new Map\(paged\.filter\(r => shown\.has\(r\.stripe_customer_id\)\)\.map\(r => \[r\.stripe_invoice_id, r\]\)\)/);
    assert.match(wait, /\.order\('stripe_invoice_id'\)\.range\(from, to\)/, 'a unique order under the pages');
    assert.match(wait, /\.neq\('status', 'void'\)/);
  });
});

describe('Today’s row and the Clubs filter', () => {
  const waiting = readCode('lib/platform-waiting.ts');
  it('is a Sales tax row beside Past due, in Customers, opening the Clubs filter, for the Stripe-reading roles only', () => {
    const row = waiting.split('\n').find(l => l.includes("key: 'sales_tax'"))!;
    assert.match(row, /group: 'customers', label: 'Sales tax'/);
    assert.match(row, /why: 'A sale whose GST\/HST answer is missing or doesn’t match what was kept with it'/);
    assert.match(row, /href: '\/platform-admin\/orgs\?filter=sales_tax'/);
    assert.match(row, /entry: 'organizations', power: 'find_stripe'/);
    assert.ok(waiting.indexOf("key: 'past_due'") < waiting.indexOf("key: 'sales_tax'") && waiting.indexOf("key: 'sales_tax'") < waiting.indexOf("key: 'trials_ending'"));
  });
  it('queuesFor checks the power as well as the area, and the count is read only when a role sees the row', () => {
    assert.match(waiting, /canViewPlatformArea\(role, q\.entry\) && \(!q\.power \|\| hasPlatformPower\(role, q\.power\)\)/);
    assert.match(waiting, /wants\('sales_tax'\) \? readSalesTaxWaiting\(\)/);
    assert.match(waiting, /q\.key === 'sales_tax' && salesTax === null \? \{ notRead: true \}/);
  });
  it('the power the row asks is exactly the Money tab’s Stripe-reading power', async () => {
    const { PLATFORM_POWERS } = await import('../../lib/platform-areas.ts');
    assert.deepEqual([...PLATFORM_POWERS.find_stripe].sort(), ['billing', 'super_admin', 'support']);
    assert.deepEqual([...PLATFORM_POWERS.refund].sort(), ['billing', 'super_admin'], 'marking is narrower: Support reads the list');
  });
  it('the Clubs list has the filter only for roles that read Stripe, and a club opens on its Money tab with Needs a look chosen', () => {
    const page = readCode('app/platform-admin/orgs/page.tsx');
    assert.match(page, /const canFilterSalesTax = hasPlatformPower\(auth\.role, 'find_stripe'\);/);
    assert.match(page, /wantsSalesTax \? readSalesTaxWaiting\(\) : Promise\.resolve\(null\)/, 'the platform count is read only when the filter is asked for');
    assert.match(page, /initialFilter=\{filter === 'sales_tax' && !canFilterSalesTax \? '' : filter \?\? ''\}/);
    const client = readCode('app/platform-admin/orgs/OrgsClient.tsx');
    assert.match(client, /\?tab=money&show=needs_look/);
    const record = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
    assert.match(record, /search\.get\('show'\) === 'needs_look'/);
    const tab = readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx');
    assert.match(tab, /useState<SaleFilter>\(startOnLook \? 'look' : 'all'\)/);
  });
});

describe('the window', () => {
  const tab = readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx');
  it('shows the door only to a role that may mark, and says so in one line to the rest (never a dead button)', () => {
    assert.match(tab, /canMark\s*\?\s*<p className=\{kit\.caption\}><button[^>]*onClick=\{\(\) => setLooking\('mark'\)\}>\{NEEDS_LOOK_WORDS\.mark\.door\}<\/button><\/p>\s*:\s*<p className=\{kit\.caption\}>\{NEEDS_LOOK_WORDS\.mark\.supportLine\}<\/p>/);
    const page = readCode('app/platform-admin/orgs/[id]/page.tsx');
    assert.match(page, /marksLooks: hasPlatformPower\(auth\.role, 'refund'\)/);
  });
  it('the door is on a sale that needs a look and ends the body; the put-back is only for a role that may mark', () => {
    assert.match(tab, /record && reasons\.length > 0 && \(canMark/);
    assert.match(tab, /\{canMark && <>\{' '\}<button[^>]*onClick=\{\(\) => setLooking\('putback'\)\}/);
  });
  it('after a mark or an undo the one answer is read again (the dot, strip, list and window follow it)', () => {
    assert.match(tab, /onLooksChanged=\{needsLook\.readAgain\}/);
    assert.match(tab, /setDone\(success\);\s*onLooksChanged\(\);/);
  });
  it('a looked-at sale shows no flag line in the list (the list takes its flag from reasons, which a held sale is not in)', () => {
    assert.match(tab, /const lookReason = reasonsOf\(row\.key\)\[0\];/);
  });
  it('keeps the last good answer when a re-read fails (3a’s guard, not regressed)', () => {
    assert.match(tab, /next\?\.state === 'failed' && prev\?\.look\?\.state === 'read' \? prev\.look : next/);
  });
});

describe('the table', () => {
  const sql = readSource('supabase/migrations/452_a_sale_can_be_marked_looked_at.sql');
  it('is server-only, append-only, with no foreign key to a club or a person', () => {
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.platform_charge_tax_looks FROM anon, authenticated;/);
    assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.platform_charge_tax_looks TO service_role;/);
    assert.doesNotMatch(sql, /CREATE POLICY/);
    assert.doesNotMatch(sql, /REFERENCES (public\.)?(organizations|auth\.users)/);
    assert.match(sql, /org_id\s+uuid,/);
    assert.match(sql, /IF TG_OP = 'UPDATE' THEN\s+RAISE EXCEPTION/);
  });
  it('requires a non-blank, capped why, and a put-back names the newest mark', () => {
    assert.match(sql, /btrim\(why\) <> '' AND length\(why\) <= 500/);
    assert.match(sql, /put_back_of IS NULL OR put_back_of = after_id/);
    assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS platform_charge_tax_looks_chain_idx/);
  });
});

describe('GUARD · a mark never takes a sale out of the return', () => {
  // The GST/HST return (Stage 4's worksheet) reads the kept tax records and NOTHING about marks. The marks are read by the
  // needs-a-look reader alone; the routes, Today's count and the window reach them only through it.
  const scan = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx'), ...filesUnder('components', '.ts')];
  it('the looks module is imported by the needs-a-look reader and nothing else', () => {
    const importers = scan.filter(f => /from ['"][^'"]*console-money-looks['"]/.test(readCode(f)));
    assert.deepEqual(importers.sort(), ['lib/console-money-sales-store.ts']);
  });
  it('the marks table is named in the reader and nowhere else in the product', () => {
    const users = scan.filter(f => readCode(f).includes('platform_charge_tax_looks'));
    assert.deepEqual(users.sort(), ['lib/console-money-sales-store.ts']);
  });
  it('the reader’s look functions are used by the two routes, Today’s count and the Money tab’s read, and by no tax total, export or report', () => {
    const users = scan.filter(f => /\b(judgeSales|markSaleLooked|putSaleBack)\b/.test(readCode(f)));
    assert.deepEqual(users.sort(), [
      'app/api/platform-admin/orgs/[id]/money/looks/put-back/route.ts',
      'app/api/platform-admin/orgs/[id]/money/looks/route.ts',
      'lib/console-money-sales-store.ts',
      'lib/console-money-sales-tax-wait.ts',
    ]);
  });
  it('the module that totals and exports tax records, once it exists, imports neither (this lists every reader of the records)', () => {
    const needsALook = new Set(['lib/console-money-sales-store.ts', 'lib/console-money-sales-tax-wait.ts']);
    const readers = scan.filter(f => !needsALook.has(f) && (readCode(f).includes("'platform_charge_tax_records'") || readCode(f).includes("'platform_credit_note_tax_records'")));
    for (const f of readers) {
      assert.doesNotMatch(readCode(f), /console-money-looks|platform_charge_tax_looks|markSaleLooked|putSaleBack/, f);
    }
  });
});
