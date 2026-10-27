import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { PAYMENTS_TERMS_VERSION, TERMS_WORDS, termsStanding, termsVersionDate } from '../../lib/online-payment-words.ts';

/**
 * CLUB TIER STAGE 12d-2 PART 4: THE PAYMENTS TERMS (frame 5, words §5; ask 6). The read-out, a notice and an owner item
 * when the version changes (payments stay on), the current version required to set up again, reconnect or change who
 * pays the fee, and Agree absent until the box is ticked in both windows. The text is counsel's; changing the one
 * version constant is the whole act of publishing.
 */
const CARD = 'components/admin/kit/club/PayoutsCard.tsx';
const ROUTE = 'app/api/admin/payouts/route.ts';

describe('the version', () => {
  it('a published version is its date; the placeholder is the draft', () => {
    assert.equal(termsVersionDate('2027-01-15'), '2027-01-15');
    assert.equal(termsVersionDate('placeholder-counsel-pending'), null);
    assert.equal(termsVersionDate(null), null);
  });
  it('a club stands agreed, on the draft, behind, or never agreed', () => {
    assert.equal(termsStanding('placeholder-counsel-pending', 'placeholder-counsel-pending'), 'draft');
    assert.equal(termsStanding('2027-01-15', '2027-01-15'), 'agreed');
    assert.equal(termsStanding('placeholder-counsel-pending', '2027-01-15'), 'stale');
    assert.equal(termsStanding('2027-01-15', '2027-06-01'), 'stale');
    assert.equal(termsStanding(null, '2027-01-15'), 'none');
  });
  it('the product never publishes terms: the version is still counsel’s placeholder', () => {
    assert.equal(PAYMENTS_TERMS_VERSION, 'placeholder-counsel-pending');
  });
  it('the read-out words (§5.1)', () => {
    assert.equal(TERMS_WORDS.rowAgreed('Sam Patel', 'October 27, 2026', 'January 15, 2027'), 'Agreed by Sam Patel on October 27, 2026, version of January 15, 2027');
    assert.match(TERMS_WORDS.rowDraft('Sam Patel', 'October 27, 2026'), /to the draft\. You’ll be asked again when the final terms are ready\.$/);
    assert.match(TERMS_WORDS.rowStale('Sam Patel', 'October 27, 2026', null), /, to the draft\. There are newer terms to read\.$/);
  });
});

describe('the current version is required (ask 6), and payments stay on', () => {
  const route = readCode(ROUTE);
  it('setting up again and reconnecting record the current version, and refuse without the box', () => {
    assert.match(route, /case 'connect': \{[\s\S]*?if \(body\.agreeToTerms !== true\) return NextResponse\.json/);
    assert.match(route, /const terms = \{ terms_version: PAYMENTS_TERMS_VERSION,/);
  });
  it('changing who pays the fee is refused while the club is behind', () => {
    assert.match(route, /termsStanding\(agreed\.terms_version as string \| null\) === 'stale'\) \{\s*return NextResponse\.json\(\{ error: TERMS_WORDS\.refuseFee, code: 'terms_stale' \}, \{ status: 409 \}\);/);
  });
  it('agreeing again records who, when and the version, and audits it — nothing else moves', () => {
    const agree = /case 'agree_terms': \{[\s\S]*?\n    \}/.exec(route)?.[0] ?? '';
    assert.match(agree, /if \(body\.agreeToTerms !== true\)/);
    assert.match(agree, /terms_version: PAYMENTS_TERMS_VERSION, terms_agreed_by: ctx\.user\.id/);
    assert.match(agree, /'payouts_terms_agreed'/);
    assert.doesNotMatch(agree, /disconnected_at|fee_payer|card_payments/);
  });
  it('the read-out is the owner’s and keeps the name of an owner who has left (the stored email)', () => {
    assert.match(route, /terms: isOwner && row\?\.terms_agreed_at \? \{/);
    assert.match(route, /agreedBy: \(await nameOf\(row\.terms_agreed_by\)\) \?\? row\.terms_agreed_by_email \?\? ''/);
  });
});

describe('Agree is ABSENT until the box is ticked, in both windows (ask 6)', () => {
  const card = readCode(CARD);
  it('the set-up window’s Continue to Stripe', () => {
    assert.match(card, /\{agreed && \(\s*<button type="button" className="btn btn-lime" onClick=\{\(\) => void go\(\)\} disabled=\{busy\}>/);
    assert.doesNotMatch(card, /disabled=\{!agreed/);
  });
  it('the new terms window’s Agree', () => {
    assert.match(card, /\{agreed && \(\s*<button type="button" className="btn btn-lime" onClick=\{\(\) => void agree\(\)\}/);
  });
  it('the window leaves out an empty "What changed" and shows counsel’s text, never ours', () => {
    assert.match(card, /mode === 'agree' && PAYMENTS_TERMS_SUMMARY && \(/);
    assert.match(card, /<p className=\{pc\.termsText\}>\{TERMS_PLACEHOLDER\}<\/p>/);
  });
  it('the fee choice gives way to the refusal and its Read and agree while behind', () => {
    assert.match(card, /\{!stale && \(\['family', 'club'\] as const\)\.map/);
  });
});

describe('the owner item and the emails clear and send once (the daily job)', () => {
  const notices = readCode('lib/online-payment-owner-notices.ts');
  it('nothing is sent while the current version is the draft', () => {
    assert.match(notices, /if \(!changedOn\) return \{ skipped: 'draft' \};/);
  });
  it('once per version, and one reminder at 14 days while still behind', () => {
    assert.match(notices, /if \(a\.terms_notice_version !== current\) \{/);
    assert.match(notices, /terms_notice_version: current, terms_notice_at: now\.toISOString\(\), terms_reminded_at: null/);
    assert.match(notices, /!a\.terms_reminded_at && a\.terms_notice_at/);
    assert.match(notices, /\.neq\('terms_version', current\)/);
  });
  it('the item clears itself when the club agrees (no Done)', () => {
    const na = readCode('lib/needs-attention.ts');
    assert.match(na, /payments_terms_changed: paymentsTermsChanged,/);
    assert.match(na, /payments_ending: paymentsEnding,/);
  });
});
