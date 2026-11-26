import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  readSponsorDealToken, signSponsorDealToken, sponsorDealUrl, SPONSOR_DEAL_PREFIX,
} from '../../lib/sponsor-deal-link.ts';
import { readTeamPayToken, signTeamPayToken } from '../../lib/team-pay-link.ts';
import {
  bandOf, canWithdraw, dealFigures, dealPlaceUp, deliveryCount, emailBarFor, holdersOf, invoiceNumber, invoiceYearOf,
  isDelivered, isOverdue, LOGO_ITEM, parseBusinessInput, parseOfferInput, parseReasonInput, reasonFloor, reasonHolds, takenOf, BUSINESS_FIELDS,
  type ClubDeal,
} from '../../lib/club-sponsorship-deals.ts';
import { DEAL_WORDS as W } from '../../lib/club-sponsorship-deal-words.ts';
import { gstHstRateFor } from '../../lib/gst-hst-rates.ts';
import { gstHstRateFor as consoleRate } from '../../lib/console-money-needs-look.ts';
import { filesUnder, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 6, PART 2 — OFFERING A DEAL AND THE BUSINESS'S PAGE (owner rulings 2026-11-22, plan
 * BOARD_READY_PLAN.md §5 Stage 6, and Part 2's four calls the same day). The deal link's own token, the states (ask 4),
 * the logo up/down (ask 5), taken places (asks 6, 7), the figures (ask 9), who may be emailed (ask 13 + /legal), the offer
 * record (reason, date, sender) and the email's foot.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SECRET = 'x'.repeat(40);
const read = (p: string) => stripComments(readSource(p));
const DEAL = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';

describe('the deal link is its own token (build prompt guard 1)', () => {
  it('signs and reads back its deal and version', () => {
    assert.deepEqual(readSponsorDealToken(signSponsorDealToken(DEAL, SECRET), SECRET), { dealId: DEAL, version: 0 });
    assert.deepEqual(readSponsorDealToken(signSponsorDealToken(DEAL, SECRET, 3), SECRET), { dealId: DEAL, version: 3 });
  });
  it('has its own message prefix: a team pay token never opens a deal, nor a deal token a team', () => {
    assert.equal(SPONSOR_DEAL_PREFIX, 'sponsor-deal:');
    assert.equal(readSponsorDealToken(signTeamPayToken(DEAL, SECRET), SECRET), null);
    assert.equal(readTeamPayToken(signSponsorDealToken(DEAL, SECRET), SECRET), null);
  });
  it('the version is signed: an old link edited to a newer version is refused', () => {
    const v1 = signSponsorDealToken(DEAL, SECRET, 1);
    assert.equal(readSponsorDealToken(`${v1.slice(0, -1)}2`, SECRET), null);
    assert.equal(readSponsorDealToken(signSponsorDealToken(DEAL, 'y'.repeat(40)), SECRET), null);
  });
  it('no secret, no link (never a forgeable one)', () => {
    assert.equal(sponsorDealUrl('https://x.test', { orgSlug: 'club', dealId: DEAL, version: 0 }, null), null);
    assert.match(sponsorDealUrl('https://x.test/', { orgSlug: 'club', dealId: DEAL, version: 0 }, SECRET) ?? '', /^https:\/\/x\.test\/club\/sponsorship\/[\w-]{22}\.[\w-]{22}$/);
  });
  it('only the one door reads a deal token (no other file in the app or lib)', () => {
    const files = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')];
    const readers = files.filter(f => /readSponsorDealToken\(/.test(stripComments(readSource(f))));
    assert.deepEqual(readers.map(f => f.replace(/\\/g, '/')).sort(), ['lib/sponsor-deal-link.ts', 'lib/sponsor-deal-view.ts']);
  });
  it('every link route throttles before it opens the door', () => {
    const routes = filesUnder('app/api/public/sponsorship', '.ts');
    assert.ok(routes.length >= 5, 'the send, files, a file, the document hand-over, the logo, the package document');
    for (const f of routes) {
      const code = stripComments(readSource(f));
      for (const m of code.matchAll(/export const (GET|POST|DELETE) = [\s\S]*?(?=export const |$)/g)) {
        const body = m[0];
        const throttle = body.search(/throttle\w*\(/);
        const door = body.search(/dealForLink\(|dealFromLinkToken\(/);
        assert.ok(door > 0, `${f} ${m[1]} opens the door`);
        if (m[1] !== 'GET') assert.ok(throttle > 0 && throttle < door, `${f} ${m[1]} throttles first`);
      }
    }
  });
});

const deal = (over: Partial<ClubDeal> = {}): ClubDeal => ({
  id: 'd1', sponsorId: 's1', businessName: 'Harbour Dental', packageId: 'p1', packageName: 'Division sponsor',
  items: [{ id: 'banner', text: 'A field banner at Riverdale Park' }, { id: 'named', text: 'Named division' }], logoOnSite: true,
  placeKind: 'division', targetId: 't1', targetName: 'U9', endsOn: '2027-08-31', amount: 1000, chargeTax: true, state: 'offered',
  offeredOn: '2027-02-24', offeredAt: '2027-02-24T15:00:00Z', offeredByName: 'Dana Ruiz', offeredTo: 'frank@harbourdental.ca',
  emailedAt: '2027-02-24T15:00:00Z', openedAt: null, linkUnsentAt: null, formAt: null, invoice: null, withdrawn: null, done: {},
  revisedOn: null, invoiceEmailedAt: null, paidOn: null, paidHow: null, paidAmount: 0, ...over,
});

describe('the states follow the money (ask 4)', () => {
  it('Delivered = paid and every line ticked, the logo line included', () => {
    const all = { [LOGO_ITEM]: { at: 'x', byName: 'D' }, banner: { at: 'x', byName: 'D' }, named: { at: 'x', byName: 'D' } };
    assert.equal(bandOf(deal({ state: 'paid', done: all })), 'delivered');
    assert.equal(bandOf(deal({ state: 'invoiced', done: all })), 'invoiced', 'ticked but unpaid is not delivered');
    assert.equal(bandOf(deal({ state: 'paid', done: { banner: { at: 'x', byName: 'D' } } })), 'paid');
    assert.deepEqual(deliveryCount(deal({ done: { named: { at: 'x', byName: 'D' } } })), { done: 1, of: 3 });
    assert.equal(isDelivered(deal({ state: 'paid', logoOnSite: false, items: [] })), true);
  });
  it('withdraw until paid', () => {
    for (const s of ['offered', 'form_received', 'invoiced'] as const) assert.equal(canWithdraw(deal({ state: s })), true, s);
    assert.equal(canWithdraw(deal({ state: 'paid' })), false);
    assert.equal(canWithdraw(deal({ state: 'withdrawn' })), false);
  });
  it('overdue the day after its due day', () => {
    const inv = { number: '2027-014', issuedOn: '2027-03-03', dueOn: '2027-04-02', taxKind: 'HST' as const, taxRate: 13, tax: 130, total: 1130 };
    assert.equal(isOverdue(inv, '2027-04-02'), false);
    assert.equal(isOverdue(inv, '2027-04-03'), true);
  });
});

describe('the logo goes up and comes down (ask 5)', () => {
  it('up when paid, or earlier when the logo line is ticked; never on a package without the logo; never withdrawn', () => {
    assert.equal(dealPlaceUp(deal({ state: 'paid' })), true);
    assert.equal(dealPlaceUp(deal({ state: 'invoiced' })), false);
    assert.equal(dealPlaceUp(deal({ state: 'invoiced', done: { [LOGO_ITEM]: { at: 'x', byName: 'D' } } })), true);
    assert.equal(dealPlaceUp(deal({ state: 'paid', logoOnSite: false })), false);
    assert.equal(dealPlaceUp(deal({ state: 'withdrawn', done: { [LOGO_ITEM]: { at: 'x', byName: 'D' } } })), false);
  });
});

describe('taken places (asks 6, 7)', () => {
  it('paid, invoiced and offered (a form received is still an offer) take a place; withdrawn frees it', () => {
    const ds = [deal({ state: 'paid' }), deal({ state: 'invoiced' }), deal({ state: 'offered' }), deal({ state: 'form_received' }), deal({ state: 'withdrawn' }), deal({ packageId: 'other' })];
    assert.deepEqual(takenOf(ds, 'p1'), { paid: 1, invoiced: 1, offered: 2 });
  });
  it('a taken place warns with who holds it, never blocks', () => {
    const ds = [deal({ id: 'a', businessName: 'Kowalski Plumbing', state: 'invoiced' }), deal({ id: 'b', state: 'withdrawn' })];
    assert.deepEqual(holdersOf(ds, 'division', 't1'), [{ name: 'Kowalski Plumbing', state: 'invoiced' }]);
    assert.deepEqual(holdersOf(ds, 'division', 't1', 'a'), []);
  });
});

describe('the figures, to the cent (ask 9; build prompt Part 3 test, Part 2 half)', () => {
  it('$1,000 + HST 13% for an Ontario address → $1,130.00', () => {
    const f = dealFigures({ amount: 1000, chargeTax: true, registered: true, province: 'ON', on: '2027-03-03' });
    assert.deepEqual({ rate: f.rate, tax: f.tax, total: f.total }, { rate: { kind: 'HST', rate: 13 }, tax: 130, total: 1130 });
  });
  it('no tax unless the club is registered AND the switch is on', () => {
    assert.equal(dealFigures({ amount: 1000, chargeTax: true, registered: false, province: 'ON', on: '2027-03-03' }).total, 1000);
    assert.equal(dealFigures({ amount: 1000, chargeTax: false, registered: true, province: 'ON', on: '2027-03-03' }).total, 1000);
  });
  it('the rate follows the province, never a hard-coded 13%; a GST-only province is charged 5%', () => {
    assert.equal(dealFigures({ amount: 1000, chargeTax: true, registered: true, province: 'AB', on: '2027-03-03' }).total, 1050);
    assert.equal(dealFigures({ amount: 1000, chargeTax: true, registered: true, province: 'QC', on: '2027-03-03' }).rate?.kind, 'GST');
    assert.equal(dealFigures({ amount: 1000, chargeTax: true, registered: true, province: 'NS', on: '2027-03-03' }).tax, 140);
    assert.equal(dealFigures({ amount: 1000, chargeTax: true, registered: true, province: null, on: '2027-03-03' }).noRate, true);
  });
  it('tax is worked out in whole cents: a half cent rounds up, never down on a float’s error', () => {
    assert.equal(dealFigures({ amount: 1.9, chargeTax: true, registered: true, province: 'NB', on: '2027-03-03' }).tax, 0.29);
    assert.equal(dealFigures({ amount: 99.5, chargeTax: true, registered: true, province: 'ON', on: '2027-03-03' }).tax, 12.94);
  });
  it('the rate table was MOVED, not copied: the console reads the same one', () => {
    assert.equal(consoleRate, gstHstRateFor);
  });
  it('the invoice number is {year}-{seq}, seq printed to 3, the year of its issue day', () => {
    assert.equal(invoiceNumber(2027, 14), '2027-014');
    assert.equal(invoiceYearOf('2027-03-03'), 2027);
  });
  it('the Charge switch\'s hint is the ruled sentence, its rate following the province', () => {
    assert.equal(W.offer.taxHint(13, 'ON'), '13% for an Ontario address, added to the amount. A sponsorship that shows a name or logo is usually not charged tax. Turn this on only if your accountant says this deal is taxable.');
    assert.match(W.offer.taxHint(5, 'AB'), /^5% for an Alberta address, added to the amount\./);
  });
});

describe('who may be emailed an offer (ask 13; /legal §1)', () => {
  const stops = new Map([
    ['gone@x.ca', { source: 'unsubscribe' as const, on: '2027-11-02' }],
    ['phoned@x.ca', { source: 'club' as const, on: '2027-03-01' }],
  ]);
  it('an unsubscribed, Do-not-offer or family-opted-out address is barred, any casing', () => {
    assert.deepEqual(emailBarFor('Gone@X.ca', stops, new Set()), { kind: 'unsubscribed', on: '2027-11-02' });
    assert.deepEqual(emailBarFor('phoned@x.ca', stops, new Set()), { kind: 'do_not_offer', on: '2027-03-01' });
    assert.deepEqual(emailBarFor('parent@x.ca', stops, new Set(['parent@x.ca'])), { kind: 'family_opt_out' });
    assert.equal(emailBarFor('frank@harbourdental.ca', stops, new Set()), null);
  });
  const today = '2027-03-09';
  const errors = {
    business: 'b', newName: 'n', email: 'e', pkg: 'p', target: 't', amount: 'a', lastDay: 'l', reason: 'r', note: 'o',
    when: 'w', whenFuture: 'f', whenOld: (r: string) => `old:${r}`,
  };
  const base = { newName: 'Harbour Dental', email: 'frank@harbourdental.ca', packageId: '11111111-1111-4111-8111-111111111111', amount: '1,000.00' };
  it('sending needs a reason and an address', () => {
    assert.equal((parseOfferInput({ ...base }, today, errors) as { error: string }).error, 'r');
    assert.equal((parseOfferInput({ ...base, email: '', reason: 'gave_address' }, today, errors) as { error: string }).error, 'e');
    const ok = parseOfferInput({ ...base, reason: 'gave_address' }, today, errors);
    assert.ok(ok.ok && ok.value.reason === 'gave_address' && ok.value.reasonOn === today && ok.value.send);
  });
  it('"Make the link only" needs neither, and records no reason (call (c))', () => {
    const ok = parseOfferInput({ ...base, email: '', send: false, reason: 'asked_recently' }, today, errors);
    assert.ok(ok.ok && ok.value.reason === null && ok.value.reasonOn === null && !ok.value.send);
  });
});

describe('the reason keeps its own date (owner call (e), approved 3A 2026-11-23)', () => {
  const errors = { reason: 'r', when: 'w', whenFuture: 'f', whenOld: (r: string) => `old:${r}` };
  const today = '2027-03-09';
  it('paid holds two years, asked six months, to the day; a month end clamps', () => {
    assert.equal(reasonFloor('paid_recently', today), '2025-03-09');
    assert.equal(reasonFloor('asked_recently', today), '2026-09-09');
    assert.equal(reasonFloor('asked_recently', '2027-08-31'), '2027-02-28');
    assert.equal(reasonFloor('gave_address', today), null);
    assert.ok(reasonHolds('asked_recently', '2026-09-09', today));
    assert.ok(!reasonHolds('asked_recently', '2026-09-08', today));
    assert.ok(reasonHolds('paid_recently', '2025-03-09', today));
    assert.ok(!reasonHolds('paid_recently', '2025-03-08', today));
    assert.ok(!reasonHolds('asked_recently', null, today));
    assert.ok(reasonHolds('published_address', null, today), 'no clock: always');
  });
  it('a reason with a clock needs its When?, not after today, not run out; the others keep today', () => {
    assert.equal((parseReasonInput({ reason: 'asked_recently' }, today, errors) as { field: string }).field, 'reasonOn');
    assert.equal((parseReasonInput({ reason: 'asked_recently', reasonOn: '2027-03-10' }, today, errors) as { error: string }).error, 'f');
    assert.equal((parseReasonInput({ reason: 'asked_recently', reasonOn: '2026-08-04' }, today, errors) as { error: string }).error, 'old:asked_recently');
    assert.equal((parseReasonInput({ reason: 'paid_recently', reasonOn: '2025-01-15' }, today, errors) as { error: string }).error, 'old:paid_recently');
    const asked = parseReasonInput({ reason: 'asked_recently', reasonOn: '2027-02-20' }, today, errors);
    assert.ok(asked.ok && asked.value.reasonOn === '2027-02-20');
    const gave = parseReasonInput({ reason: 'gave_address', reasonOn: '2020-01-01' }, today, errors);
    assert.ok(gave.ok && gave.value.reasonOn === today, 'a given address has no clock: the offer day is kept');
  });
  it('the offer and Email the offer keep the reason\'s day; Send the link again reads it against today and emails nothing once run out', () => {
    const offer = read('app/api/admin/sponsorships/deals/route.ts');
    assert.match(offer, /parseOfferInput\(body \?\? \{\}, today, OFFER_ERRORS\)/);
    assert.match(offer, /reasonOn: v\.reasonOn!/);
    const email = read('app/api/admin/sponsorships/deals/[dealId]/email/route.ts');
    assert.match(email, /parseReasonInput\(body, today, reasonErrors\(\)\)/);
    assert.match(email, /reasonOn: why\.value\.reasonOn/);
    assert.doesNotMatch(email, /deleteUnsentDeal/, 'a link already handed over in person is never removed by a failed email');
    // One plan decides it for the page and the press (Board Ready Stage 6 fixes, B-2): never sent, then invoiced or paid, then
    // the reason, then the send rules.
    const again = read('app/api/admin/sponsorships/deals/[dealId]/again/route.ts');
    const planned = again.indexOf('await againPlan({');
    assert.ok(planned > 0 && planned < again.indexOf('await replaceDealLink('), 'asked before the old link stops working');
    const gate = again.indexOf("if (!plan.emails) return unsent(quiet && plan.outcome === 'not_emailed' ? 'not_due' : plan.outcome, plan.error);");
    assert.ok(gate > 0 && gate < again.indexOf('sendOffer({'), 'the plan is read before any email');
    const promised = again.indexOf("if (quiet) return unsent('not_due');");
    assert.ok(promised > gate && promised < again.indexOf('sendOffer({'), 'a confirm that said nothing is emailed is kept');
    assert.ok(read('components/admin/kit/club/sponsorships/DealScreen.tsx').includes("act('/again', { expectsEmail: data.againEmails })"));
    assert.match(again, /await markLinkUnsent\(org\.id, dealId\)/);
    const step = read('lib/club-sponsorship-offer-send.ts');
    const plan = step.slice(step.indexOf('export async function againPlan('), step.indexOf('export async function paidReasonRefusal('));
    const order = ["outcome: 'link_only' }", "outcome: 'not_due' }", "outcome: 'ran_out' }", 'await offerSendCheck({', 'await paidReasonRefusal(', 'emails: true, first']
      .map(s => plan.indexOf(s));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `the plan's order: ${order}`);
    assert.match(plan, /if \(!linkTakesForm\(deal\)\) return \{ emails: false, outcome: 'not_due' \};/);
    assert.match(plan, /if \(!reasonHolds\(first\.reason, first\.reasonOn, today\)\) return \{ emails: false, outcome: 'ran_out' \};/);
    assert.match(read('app/api/admin/sponsorships/deals/[dealId]/route.ts'), /await againPlan\(\{/, 'the page names its button from the same plan');
  });
  it('Email the offer keeps every Send rule: the address, a contact, no stopped or opted-out address', () => {
    // Part 4a (drawing F6): every Send rule lives in the one shared step, which this route asks before it sends.
    const email = read('app/api/admin/sponsorships/deals/[dealId]/email/route.ts');
    for (const code of ['already_emailed', 'not_open']) assert.match(email, new RegExp(`'${code}'`));
    assert.ok(email.indexOf('offerSendCheck({') > 0 && email.indexOf('offerSendCheck({') < email.indexOf('sendOffer({'), 'the checks come before the send');
    const step = read('lib/club-sponsorship-offer-send.ts');
    for (const code of ['no_mailing_address', 'no_contact', 'no_secret']) assert.match(step, new RegExp(`'${code}'`));
    assert.match(step, /emailBarFor\(input\.to, bars\.stops, bars\.family\)/);
    assert.ok(step.indexOf('recordOfferSafely(') > step.indexOf('await sendOfferEmail({'), 'the record follows the email that went');
  });
});

describe('the offer record always carries the reason, its date and who sent it (build prompt guard 3)', () => {
  const sql = stripComments(readSource('supabase/migrations/526_a_club_offers_a_sponsorship_deal.sql'));
  const table = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.club_sponsor_offers'), sql.indexOf('CREATE INDEX IF NOT EXISTS club_sponsor_offers_org_idx'));
  it('reason, reason_on, sent_by_name, email and the club are NOT NULL; the four reasons only', () => {
    for (const col of ['org_id', 'email', 'reason', 'reason_on', 'sent_by_name', 'business_name']) {
      assert.match(table, new RegExp(`\\b${col}\\s+[^,\\n]*NOT NULL`), col);
    }
    assert.match(table, /reason IN \('paid_recently', 'asked_recently', 'gave_address', 'published_address'\)/);
  });
  it('the record and the stops are insert-only: no seat can change or clear them', () => {
    assert.match(sql, /REVOKE UPDATE, DELETE ON public\.club_sponsor_offers, public\.club_sponsor_offer_stops FROM service_role;/);
    assert.match(sql, /GRANT SELECT, INSERT ON public\.club_sponsor_offers, public\.club_sponsor_offer_stops TO service_role;/);
  });
  it('an offer outlives its deal', () => {
    assert.match(table, /deal_id\s+uuid REFERENCES public\.club_sponsor_deals\(id\) ON DELETE SET NULL/);
  });
  it('every email the server sends leaves a record', () => {
    const server = stripComments(readSource('lib/club-sponsorship-deals-server.ts'));
    assert.match(server, /from\('club_sponsor_offers'\)\.insert\(\{[^}]*reason: o\.reason, reason_on: o\.reasonOn,[^}]*sent_by_name: o\.by\.name/);
  });
  it('the migration keeps every new table off the browser', () => {
    for (const t of ['club_sponsor_deals', 'club_sponsor_deal_items', 'club_sponsor_offers', 'club_sponsor_offer_stops', 'club_sponsor_invoice_counters']) {
      assert.match(sql, new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`), t);
    }
    assert.doesNotMatch(sql, /CREATE POLICY/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.club_sponsor_deal_receive\([^)]*\) FROM PUBLIC, anon, authenticated;/);
  });
});

describe('the offer email (ask 13; /legal §1; round 2 ask 8)', () => {
  const src = stripComments(readSource('lib/sponsor-offer-email.ts'));
  it('is its own sender: never Communications, never FieldLogicHQ\'s marketing sender', () => {
    assert.doesNotMatch(src, /club-group-email|email-sender/);
    assert.match(src, /kind: 'club_sponsorship_offer'/);
  });
  it('refuses to send without the club\'s mailing address or a signed unsubscribe', () => {
    assert.match(src, /if \(!input\.mailingAddress\?\.trim\(\)\) throw new OfferEmailRefused/);
    assert.match(src, /if \(!unsubscribeUrl\) throw new OfferEmailRefused/);
  });
  it('names a way to reach the club, and replies go there (/legal 2026-11-22 finding 1)', () => {
    assert.match(src, /if \(!input\.contactEmail\?\.trim\(\)\) throw new OfferEmailRefused/);
    assert.match(src, /replyTo: input\.contactEmail,/);
    assert.equal(W.email.questions(null, 'sponsors@club.ca'), 'Questions? Reply to this email, or write to sponsors@club.ca.');
    const step = stripComments(readSource('lib/club-sponsorship-offer-send.ts'));
    assert.match(step, /if \(!contactEmail\) return \{ ok: false, block: \{ error: O\.needsContact, status: 409, code: 'no_contact' \} \};/);
  });
  it('the record of an email that went is written even when the first try fails', () => {
    // Part 4a: the record is written by the one shared send step; no route writes it any other way.
    assert.match(stripComments(readSource('lib/club-sponsorship-offer-send.ts')), /recordOfferSafely\(/);
    for (const f of filesUnder('app/api/admin/sponsorships', '.ts')) {
      assert.doesNotMatch(stripComments(readSource(f)), /recordOfferEmail\(/, `${f} goes through the retrying writer`);
    }
  });
  it('the foot: the reason said back, the club\'s address alone, the sponsorship-only unsubscribe, one-click headers', () => {
    assert.match(src, /M\.because\[e\.reason\]\(e\.club\)/);
    assert.match(src, /M\.sentBy\(e\.club, e\.mailingAddress\)/);
    assert.match(src, /buildSponsorUnsubscribeUrl\(input\.orgId, to\)/);
    assert.match(src, /headers: oneClickUnsubscribeHeaders\(unsubscribeUrl\)/);
  });
  it('the drawn words', () => {
    assert.equal(W.email.subject('Riverdale Minor Ball', 'Division sponsor'), 'Sponsorship with Riverdale Minor Ball: Division sponsor');
    assert.equal(W.email.because.asked_recently('Riverdale Minor Ball'), 'You get this because you asked Riverdale Minor Ball about sponsoring.');
    assert.equal(W.email.sentBy('Riverdale Minor Ball', '200 Park Road, Riverdale ON K0A 1B0'), 'Sent by Riverdale Minor Ball, 200 Park Road, Riverdale ON K0A 1B0.');
    assert.equal(W.email.price(1000, 'HST', '2027-08-31'), '$1,000.00 plus HST, until Aug 31, 2027');
  });
});

describe('the business\'s fixed fields (ask 8)', () => {
  const words = Object.fromEntries(BUSINESS_FIELDS.map(k => [k, k])) as Record<(typeof BUSINESS_FIELDS)[number], string>;
  const provinces = new Set(['ON', 'AB']);
  const who = { name: 'Harbour Dental', contactName: 'Frank Osei', email: 'frank@harbourdental.ca' };
  it('name, contact and email are always required; phone and website never are', () => {
    const r = parseBusinessInput({}, provinces, words, { addressRequired: false });
    assert.ok(!r.ok);
    assert.deepEqual(Object.keys(r.errors).sort(), ['contactName', 'email', 'name']);
  });
  it('a deal that charges GST/HST requires the whole address (its province sets the rate)', () => {
    const r = parseBusinessInput(who, provinces, words, { addressRequired: true });
    assert.ok(!r.ok);
    assert.deepEqual(Object.keys(r.errors).sort(), ['city', 'postal', 'province', 'street']);
  });
  it('any other deal may leave the address blank: all four come back null', () => {
    const r = parseBusinessInput({ ...who, street: ' ', province: '' }, provinces, words, { addressRequired: false });
    assert.ok(r.ok);
    assert.deepEqual([r.value.street, r.value.city, r.value.province, r.value.postal], [null, null, null, null]);
  });
  it('but not half-typed: any part of the address asks for the rest', () => {
    const r = parseBusinessInput({ ...who, city: 'Riverdale' }, provinces, words, { addressRequired: false });
    assert.ok(!r.ok);
    assert.deepEqual(Object.keys(r.errors).sort(), ['postal', 'province', 'street']);
  });
  it('a website is saved as https', () => {
    const r = parseBusinessInput({ name: 'Harbour Dental', contactName: 'Frank Osei', email: 'Frank@HarbourDental.ca', website: 'harbourdental.ca', street: '41 Harbour Street', city: 'Riverdale', province: 'on', postal: 'K0A 1C2' }, provinces, words, { addressRequired: true });
    assert.ok(r.ok);
    assert.equal(r.value.website, 'https://harbourdental.ca');
    assert.equal(r.value.email, 'frank@harbourdental.ca');
    assert.equal(r.value.province, 'ON');
  });
});

describe('the words (§9, round 2 ask 6)', () => {
  const texts = ['lib/club-sponsorship-deal-words.ts', 'lib/sponsor-offer-email.ts'].map(f => stripComments(readSource(f)));
  it('never "donation", "gift", "tax receipt", nor "advertising"', () => {
    for (const t of texts) assert.doesNotMatch(t, /donation|\bgift|tax receipt|advertis/i);
  });
  it('"e-transfer" in a sentence, "E-transfer" at the start; never "E-Transfer" or "e-Transfer"', () => {
    for (const t of texts) assert.doesNotMatch(t, /E-Transfer|e-Transfer/);
  });
  it('the state callouts are round 1 tab 5\'s table', () => {
    assert.equal(W.callout.offeredOpened('Fenwick Insurance', '2027-02-27'), 'Waiting for Fenwick Insurance. They opened the link Feb 27.');
    assert.equal(W.callout.formReceived('Northside Auto'), 'Northside Auto sent their details and started to pay by card, but didn’t finish.');
    assert.equal(W.callout.overdue('2027-04-02'), 'Overdue since Apr 2.');
    assert.equal(W.callout.paid('2027-02-14', 2, 3), 'Paid Feb 14. 2 of 3 delivered. Tick each one as it happens.');
    assert.equal(W.callout.delivered, 'Paid and delivered. Nothing left to do.');
  });
});

describe('the business’s page can only act on what it was shown (/review 2026-11-23)', () => {
  const route = readFileSync('app/api/public/sponsorship/[token]/route.ts', 'utf8');
  it('a submit re-checks that the place still exists, and that the price is the one the page showed', () => {
    assert.match(route, /targetExists\(deal\.placeKind, deal\.targetId\)/);
    assert.match(route, /body\.expectedTotal/);
    assert.match(route, /code: 'terms_changed'/);
  });
  it('replacing a link says so when someone else got there first', () => {
    assert.match(readFileSync('lib/club-sponsorship-deals-server.ts', 'utf8'), /data\?\.length \? next : null/);
    assert.match(readFileSync('app/api/admin/sponsorships/deals/[dealId]/again/route.ts', 'utf8'), /version == null/);
  });
});
