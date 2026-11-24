import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { PAYMENTS_TERMS_VERSION, TERMS_WORDS, termsStanding, termsVersionDate } from '../../lib/online-payment-words.ts';
import { PAYMENTS_TERMS_VERSIONS, isPublishedVersion, publishedVersions } from '../../lib/legal-documents.ts';

/**
 * CLUB TIER STAGE 12d-2 PART 4: THE PAYMENTS TERMS (frame 5, words §5; ask 6). The read-out, a notice and an owner item
 * when the version changes (payments stay on), the current version required to set up again, reconnect or change who
 * pays the fee, and Agree absent until the box is ticked in both windows. Published 2026-11-24: the text is a frozen legal page
 * (`lib/legal-documents/payments/<date>.md`, registered in `PAYMENTS_TERMS_VERSIONS`), and the version constant names its date.
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
  it('the version a tick records is the newest published Payments Terms (published 2026-11-24, replacing the placeholder)', () => {
    assert.ok(termsVersionDate(PAYMENTS_TERMS_VERSION), 'the version is a date, not the placeholder');
    assert.ok(isPublishedVersion('payments', PAYMENTS_TERMS_VERSION), 'the version has a registered, frozen text');
    assert.equal(PAYMENTS_TERMS_VERSION, publishedVersions('payments')[0], 'the version is the NEWEST published text');
    assert.ok(PAYMENTS_TERMS_VERSIONS.length > 0);
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
    // GST/HST Stage 2 Part 2b: the press goes through the billing-address gate first (ensure → go); still absent until ticked.
    // Club Stage 12 (owner 2026-11-17): and absent until the refund policy is written.
    assert.match(card, /\{agreed && !!policy\.trim\(\) && \(\s*<button type="button" className="btn btn-lime" onClick=\{\(\) => address\.ensure\(\(\) => void go\(\)\)\} disabled=\{busy\}>/);
    assert.doesNotMatch(card, /disabled=\{!agreed/);
  });
  it('the new terms window’s Agree', () => {
    assert.match(card, /\{agreed && \(\s*<button type="button" className="btn btn-lime" onClick=\{\(\) => void agree\(\)\}/);
  });
  it('the window leaves out an empty "What changed" and links the published terms, never a copy', () => {
    assert.match(card, /\{PAYMENTS_TERMS_SUMMARY && \(/);
    assert.doesNotMatch(card, /TERMS_PLACEHOLDER/);
    // Both windows open the version being agreed to, built by the server; the agreed row opens the version agreed to.
    assert.equal(card.match(/href=\{(?:view\.)?termsHref\} target="_blank" rel="noopener noreferrer"/g)?.length, 2);
    assert.match(card, /href=\{terms\.agreedHref\} target="_blank"/);
    const route = readCode(ROUTE);
    assert.match(route, /termsHref: legalPageHref\('payments', PAYMENTS_TERMS_VERSION\),/);
    assert.match(route, /isPublishedVersion\('payments', row\.terms_version\) \? legalPageHref\('payments', row\.terms_version\) : null/);
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
    // Behind includes a club with no version recorded; every club is reached, in pages (/review).
    assert.match(notices, /filter\(a => a\.terms_version !== current\)/);
    assert.match(notices, /\.order\('org_id'\)\.range\(from, from \+ 999\)/);
    // Claimed before it is sent, and never for a club with nobody to tell (/review).
    assert.match(notices, /if \(!people\.userIds\.length\) continue;/);
    assert.ok(notices.indexOf('if (!claimed?.length) continue;') < notices.indexOf("eventType: 'payments_terms_changed'"));
  });
  it('the item clears itself when the club agrees (no Done)', () => {
    const na = readCode('lib/needs-attention.ts');
    assert.match(na, /payments_terms_changed: paymentsTermsChanged,/);
    assert.match(na, /payments_ending: paymentsEnding,/);
  });
});

describe('the daily job runs the owners’ two steps (owner ruling 4, its own commit)', () => {
  it('after the 12d-1 steps, each in its own try so one failure never stops the next', () => {
    const route = readCode('app/api/platform-admin/stripe-fees-daily/route.ts');
    const lost = route.indexOf("await run('lost_disputes'");
    const terms = route.indexOf("await run('terms_notices', () => sendTermsNotices(now));");
    const ending = route.indexOf("await run('ending_warnings', () => sendEndingWarnings(now));");
    assert.ok(lost > 0 && terms > lost && ending > terms);
  });
});

describe('the /review of 12d-2 (the terms)', () => {
  it('agreeing — and connecting (GST/HST 6.3 A6) — names the version the window showed; a change while it was open is refused', () => {
    const route = readCode('app/api/admin/payouts/route.ts');
    // Both doors refuse through the one helper: `connect` and `agree_terms`.
    assert.equal(route.match(/if \(body\.termsVersion !== PAYMENTS_TERMS_VERSION\) return termsChanged\(\);/g)?.length, 2);
    assert.match(route, /code: 'terms_changed' \}, \{ status: 409 \}/);
    assert.match(route, /if \(agreeError\) throw agreeError;/);
    const card = readCode('components/admin/kit/club/PayoutsCard.tsx');
    assert.match(card, /action: 'agree_terms', agreeToTerms: true, termsVersion: PAYMENTS_TERMS_VERSION/);
    assert.match(card, /action: 'connect', feePayer, refundPolicy: policy\.trim\(\), agreeToTerms: true, termsVersion: PAYMENTS_TERMS_VERSION/);
  });
  it('an ending warning is claimed before it is sent, and compared as a moment', () => {
    const notices = readCode('lib/online-payment-owner-notices.ts');
    assert.match(notices, /new Date\(a\.ending_warned_for\)\.getTime\(\) === new Date\(ending\.at\)\.getTime\(\)/);
    assert.match(notices, /\.or\(`ending_warned_for\.is\.null,ending_warned_for\.neq\."\$\{ending\.at\}"`\)/);
  });
});
