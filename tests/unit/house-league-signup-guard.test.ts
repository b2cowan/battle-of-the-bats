import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9b-1, PARTS 5–6 — ONE SIGN-UP, SEVERAL CHILDREN (owner Q5, 9b·4, 9b·5, 9b·12, F23; plan §2 CASL line).
 * The sign-up route places each child through the locked step, sends ONE email per sign-up (awaited: it carries the
 * reference and how to pay), puts ONE notice in the club's Needs attention, and files the email-consent row when ticked.
 * The family reads "Accepted", never "Approved". The family's page opens a whole sign-up — since Signed-in family
 * accounts Stage 1 by its signed link alone (the reference opens nothing; tests/unit/league-signup-link.test.ts).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTE = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
const FORM = readCode('components/league/RegisterForm.tsx');
const STATUS = readCode('app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx');
// Stage 1: the email-and-reference lookup is gone; the signed link's page and its one door are the sign-up's home.
const LINK_PAGE = readCode('app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx');
const DOOR = readCode('lib/league-signup-link.ts');
const SIGNUP_STATUS = readCode('lib/league-signup-status.ts');
const EMAIL = readCode('lib/email.ts');

describe('the sign-up route', () => {
  it('takes several children, each with its own outcome (no all-or-nothing, 9b·5)', () => {
    assert.match(ROUTE, /Array\.isArray\(body\.children\)/);
    assert.match(ROUTE, /for \(let i = 0; i < kids\.length; i\+\+\)[\s\S]*await placeLeagueRegistration\(/);
    assert.match(ROUTE, /signupRef: reference, signupPosition: \+\+position/);
  });
  it('a date of birth picks the division under the club’s cut-off; a child no division takes is not registered (9b·4)', () => {
    assert.match(ROUTE, /bornFitsDate\(\{ from: d\.bornFromYear, to: d\.bornToYear \}, cutoff, k\.dob!\)/);
    assert.match(ROUTE, /if \(d === 'nofit'\) \{ results\.push\(/);
  });
  // Signed-in family accounts Stage 3: "one email" is per sign-up PER PARENT — the second parent's copy goes through the
  // same one call, in a loop over the sign-up's addresses (tests/unit/league-second-parent.test.ts).
  it('one email per sign-up, AWAITED, and one notice for the club (F23)', () => {
    assert.equal((ROUTE.match(/sendTransactionalEmail\(/g) ?? []).length, 1);
    assert.match(ROUTE, /await sendTransactionalEmail\(\{\s*key: 'league_signup'/);
    assert.equal((ROUTE.match(/notify\(\{/g) ?? []).length, 1);
    assert.match(ROUTE, /await notify\(\{[\s\S]{0,80}eventType: 'house_league_registration_new'/);
    assert.doesNotMatch(ROUTE, /void \(async/, 'nothing is left running after the response');
  });
  it('a ticked email-consent line files one consent row for the sign-up (CASL)', () => {
    assert.match(ROUTE, /if \(emailConsent && season\.askEmailConsent\) \{\s*await recordLeagueMarketingConsent\(/);
    const helper = readCode('lib/org-people.ts');
    assert.match(helper, /scope: 'marketing'/);
  });
});

describe('the family’s words', () => {
  it('"Accepted", never "Approved", on the form, the confirmation, the status page and the sign-up email (9b·12)', () => {
    for (const [name, src] of [['form', FORM], ['status', STATUS]] as const) {
      assert.doesNotMatch(src, />[^<]*\bApproved\b|'Approved'|"Approved"|Confirmed'|Pending review'/, name);
    }
    const signup = EMAIL.slice(EMAIL.indexOf('export function leagueSignupHtml('), EMAIL.indexOf('export function leagueAdminApprovedHtml('));
    assert.doesNotMatch(signup, /approved/i);
    assert.match(readCode('lib/league-signup.ts'), /if \(status === 'active'\) return 'Accepted';/);
  });
  it('the acceptance and promotion emails now state the price and the club’s how-to-pay words', () => {
    for (const name of ['leagueAdminApprovedHtml', 'leagueWaitlistPromotedHtml']) {
      const body = EMAIL.slice(EMAIL.indexOf(`export function ${name}(`));
      assert.match(body.slice(0, 3000), /acceptedPay\(input\.fee/, name);
    }
  });
  it('12b: the confirmation draws THE one pay block while the club takes card payments, and no greyed Pay now ever (A6)', () => {
    // Not taking payments: today's words, word for word, and no button at all.
    assert.match(FORM, /Payable separately to \{orgName\}/);
    assert.doesNotMatch(FORM + STATUS, /Online payment isn’t available yet|disabled title=/);
    assert.match(FORM, /\{result\.pay \? \(\s*<LeaguePayBlock pay=\{result\.pay\}/);
    assert.doesNotMatch(FORM + STATUS, /12b|coming soon/i);
  });
  it('12b: the sign-up, approval and promotion emails carry the card words only while the club takes card payments', () => {
    const block = EMAIL.slice(EMAIL.indexOf('function payBlock('), EMAIL.indexOf('function signupButton('));
    assert.match(block, /if \(online\) \{/);
    // Signed-in family Stage 1 (ask 2): the money panel draws no button of its own; the one button is signupButton.
    assert.doesNotMatch(block, /warmEmailButton\(/);
    // Without it, today's panel: the club's words and "payable separately".
    assert.match(block, /Payable separately to \$\{escapeEmailHtml\(clubName\)\}/);
    assert.match(EMAIL, /payBlock\(toPay, input\.howToPay, input\.clubName, input\.online\)/);
    assert.equal((EMAIL.match(/input\.clubName \?\? \(input\.face\?\.club\.name \?\? 'the club'\), input\.online\)/g) ?? []).length, 2);
    // The routes ask the one helper (card words only while the club takes card payments and something is owed).
    assert.match(ROUTE, /leagueMailLink\(placedKids\[0\]\.id!\)/);
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts'), /leagueMailLink\(next\.id\)[\s\S]*leagueMailLink\(regId\)/);
  });
  it('Stage 1 (asks 2, 3; drawing tab 5): one "Your sign-up" button — always on the confirmation, else only while owed', () => {
    // The reference opens nothing: no plain status page, no "you'll need this reference and your email".
    const ref = EMAIL.slice(EMAIL.indexOf('function refBlock('), EMAIL.indexOf('export function leagueSignupHtml('));
    assert.doesNotMatch(ref, /href|\/status|You’ll need this reference/);
    assert.match(ref, /SIGNUP_LINK_WORDS\.mail\.reference\(/);
    assert.match(EMAIL, /function signupButton\(url: string \| null \| undefined\): string \{\s*return url \? warmEmailButton\(SIGNUP_LINK_WORDS\.mail\.button,/);
    assert.doesNotMatch(EMAIL, /See your registration|Check your registration any time|M\.payButton/);
    // The confirmation always (the link, owed or not); acceptance and promotion only while owed; waitlisted never.
    assert.match(ROUTE, /const signupUrl = leaguePayUrl\([^)]*version: 0 \}\);/);
    assert.match(ROUTE, /howToPay: anyAccepted \? season\.howToPay : null, signupUrl, children/);
    const regRoute = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.equal((regRoute.match(/signupUrl:\s+link\.owedUrl/g) ?? []).length, 2);
    const waitlisted = EMAIL.slice(EMAIL.indexOf('export function leagueAdminWaitlistedHtml('), EMAIL.indexOf('export function leagueWaitlistPromotedHtml('));
    assert.doesNotMatch(waitlisted, /signupButton|warmEmailButton/);
    assert.match(readCode('lib/league-pay-view.ts'), /owedUrl: f\.owingCents > 0 \? url : null/);
    // Placement and moved team: only while the sign-up owes; no plain-page fallback.
    const placement = readCode('lib/house-league-placement-mail.ts');
    assert.match(placement, /if \(!owing\.has\(reg\.id\)\) return null;/);
    assert.doesNotMatch(placement, /\/status`/);
    // Receipt: only while a balance is left. Bank debit: only while owed. The club's pay link: refused when nothing is owed.
    const receipt = readCode('lib/online-payment-receipt.ts');
    assert.match(receipt, /link && facts\.owingCents > 0 \? warmEmailButton\(SW\.mail\.button, link\)/);
    assert.match(receipt, /warmEmailButton\(SW\.mail\.button, payLink\)/);
    // (A tournament team's receipt keeps "View your receipt": out of this stage.)
    assert.doesNotMatch(receipt.slice(receipt.indexOf('async function sendLeagueReceipt('), receipt.indexOf('async function sendReceipt(')), /E\.viewReceipt/);
    assert.doesNotMatch(receipt, /L\.button/);
    assert.match(readCode('lib/bank-debit-email.ts'), /payLabel: SW\.mail\.button,\s*canPayAgain: facts\.owingCents > 0,/);
  });
});

describe('the family’s page opens the whole sign-up', () => {
  it('by the link’s anchor: its reference AND family email (or, an older registration, that one), and ONLY those rows', () => {
    // Never every child under the email: anyone can sign up under any email they type. The door hands the page only the
    // rows of the one sign-up, and the shaping reads only the rows it is handed.
    assert.match(SIGNUP_STATUS, /\.eq\('signup_ref', anchor\.signup_ref as string\)/);
    assert.match(SIGNUP_STATUS, /q = anchor\.guardian_email \? q\.eq\('guardian_email', anchor\.guardian_email as string\) : q\.is\('guardian_email', null\)/);
    assert.match(DOOR, /const rows = await signupRowsFromAnchor\(anchor\)/);
    assert.match(LINK_PAGE, /buildSignupStatus\(season, org\.name, link\.rows\)/);
    assert.match(SIGNUP_STATUS, /const registrations = rows\.map\(/);
  });
  it('shows the club’s how-to-pay words only while an accepted child owes something', () => {
    assert.match(SIGNUP_STATUS, /howToPay: owes \? season\.howToPay : null/);
  });
  it('12b: the pay block covers the whole sign-up, so only a link the door opened carries it', () => {
    assert.match(LINK_PAGE, /link\.ok\s*\? await Promise\.all\(\[buildSignupStatus\(season, org\.name, link\.rows\), buildLeaguePayView\(link\.registrationId, contactEmail\)\]\)/);
  });
  it('12b: the status page draws no greyed Pay now — THE one pay block while the club takes card payments, none otherwise (A6)', () => {
    assert.doesNotMatch(STATUS, /Online payment isn’t available yet/);
    assert.doesNotMatch(STATUS, /disabled title=/);
    assert.match(STATUS, /<LeaguePayBlock pay=\{pay\}/);
    // Not taking payments: today's words stay ("Payable separately", the club's how-to-pay text).
    assert.match(STATUS, /Payable separately to \{found\.clubName\}/);
  });
});
