import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9b-1, PARTS 5–6 — ONE SIGN-UP, SEVERAL CHILDREN (owner Q5, 9b·4, 9b·5, 9b·12, F23; plan §2 CASL line).
 * The sign-up route places each child through the locked step, sends ONE email per sign-up (awaited: it carries the
 * reference and how to pay), puts ONE notice in the club's Needs attention, and files the email-consent row when ticked.
 * The family reads "Accepted", never "Approved". The status page finds a whole sign-up by its reference.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTE = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
const FORM = readCode('components/league/RegisterForm.tsx');
const STATUS = readCode('app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx');
const LOOKUP = readCode('app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts');
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
  it('the form keeps "payable separately" and draws no live Pay now (that is online payment, later)', () => {
    assert.match(FORM, /Payable separately to \{orgName\}/);
    assert.match(FORM, /disabled title="Online payment isn’t available yet/);
    assert.doesNotMatch(FORM + STATUS, /12b|coming soon/i);
  });
});

describe('the status page finds the whole sign-up', () => {
  it('by its reference or (an older registration) its own, and ONLY the registrations that reference names', () => {
    assert.match(LOOKUP, /const named = rows\.filter\(\(r: any\) => r\.signup_ref === refCode \|\| registrationReference\(String\(r\.id\)\) === refCode\)/);
    // Never every child under the email: anyone can sign up under any email and get a reference for it. The shaping is
    // shared with the pay link's page (12b) and reads only the rows it is handed.
    assert.match(LOOKUP, /buildSignupStatus\(season, org\.name, named as SignupStatusRow\[\]\)/);
    assert.doesNotMatch(LOOKUP, /rows\.map\(\(r: any\) => \{/);
    assert.match(SIGNUP_STATUS, /const registrations = rows\.map\(/);
  });
  it('shows the club’s how-to-pay words only while an accepted child owes something', () => {
    assert.match(SIGNUP_STATUS, /howToPay: owes \? season\.howToPay : null/);
  });
  it('12b: the pay block covers the whole sign-up, so a child’s own code opens no pay block', () => {
    assert.match(LOOKUP, /const wholeSignup = named\.every\(\(r: any\) => r\.signup_ref === refCode \|\| !r\.signup_ref\)/);
    assert.match(LOOKUP, /wholeSignup \? buildLeaguePayView\(/);
  });
  it('12b: the status page draws no greyed Pay now — THE one pay block while the club takes card payments, none otherwise (A6)', () => {
    assert.doesNotMatch(STATUS, /Online payment isn’t available yet/);
    assert.doesNotMatch(STATUS, /disabled title=/);
    assert.match(STATUS, /<LeaguePayBlock pay=\{pay\}/);
    // Not taking payments: today's words stay ("Payable separately", the club's how-to-pay text).
    assert.match(STATUS, /Payable separately to \{found\?\.clubName\}/);
  });
});
