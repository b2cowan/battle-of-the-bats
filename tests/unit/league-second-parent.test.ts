import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSecondParentEmail, SECOND_PARENT_WORDS as SP } from '../../lib/league-second-parent.ts';
import { readCode, readSource, functionBody } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 3, Parts 1–3 (build prompt SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md; asks 1–6 ruled A
 * 2026-11-03): a second parent's email on the house-league sign-up. BEHAVIOUR for the pure reader and the words; SOURCE
 * GUARDS (comments stripped) for the route, the placement and the email builder, which import server-only modules.
 */

describe('reading the second address (behaviour)', () => {
  it('empty is none and changes nothing', () => {
    for (const raw of [null, undefined, '', '   ']) assert.deepEqual(readSecondParentEmail(raw, 'priya@example.com'), { email: null });
  });
  it('a malformed address is refused in the first email’s words', () => {
    assert.deepEqual(readSecondParentEmail('dev.shah@', 'priya@example.com'), { refusal: 'invalid' });
    assert.equal(SP.invalid, 'Enter a valid email address.');
  });
  it('the first parent’s own address is refused, capitals and spaces ignored', () => {
    assert.deepEqual(readSecondParentEmail('  Priya@Example.COM ', 'priya@example.com'), { refusal: 'same' });
    assert.deepEqual(readSecondParentEmail('priya@example.com', ' PRIYA@example.com'), { refusal: 'same' });
  });
  it('a good address is normalised exactly as guardian_email is', () => {
    assert.deepEqual(readSecondParentEmail('  Dev.Shah@Example.com ', 'priya@example.com'), { email: 'dev.shah@example.com' });
  });
});

describe('the second parent’s words (behaviour)', () => {
  it('the drawn words, curly apostrophes, no "(optional)" tag', () => {
    assert.equal(SP.label, 'Second parent’s email');
    assert.ok(!/optional/i.test(SP.label));
    assert.equal(SP.sameAsYours, 'That’s the same email as yours. Leave this empty or enter the other parent’s.');
    assert.equal(SP.greeting, 'Hi,');
    assert.match(SP.coachLine, /and the second parent’s email if you add one\.$/);
  });
  it('the "who added you" line: one child, several, and a club with no contact address', () => {
    assert.equal(
      SP.addedYou('Priya Shah', ['Aarav'], { name: 'Riverdale Minor Ball', contact: 'info@riverdale.example' }),
      'Priya Shah added your email to Aarav’s sign-up so you get the same updates. If you aren’t Aarav’s parent or guardian, tell the club at info@riverdale.example and we’ll remove your address.',
    );
    assert.equal(
      SP.addedYou('Priya Shah', ['Aarav', 'Maya'], { name: 'Riverdale Minor Ball', contact: null }),
      'Priya Shah added your email to Aarav and Maya’s sign-up so you get the same updates. If you aren’t their parent or guardian, tell Riverdale Minor Ball and we’ll remove your address.',
    );
  });
});

const ROUTE = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');

describe('the sign-up route (source guard)', () => {
  it('reads the second address through the one reader and refuses with its words', () => {
    assert.match(ROUTE, /readSecondParentEmail\(str\(body\.guardianEmail2, 200\), guardianEmail\)/);
    assert.match(ROUTE, /errors\.guardianEmail2 = secondParentRefusalWords\(second\.refusal, 'parent'\)/);
  });
  it('throttles the second address on its own, after the first and before anything is placed', () => {
    const first = ROUTE.indexOf('throttlePublicFormRecipient(guardianEmail!)');
    const second = ROUTE.indexOf('throttlePublicFormRecipient(guardianEmail2)');
    const place = ROUTE.indexOf('placeLeagueRegistration(');
    assert.ok(first > 0 && second > first && place > second, 'first throttle, then the second, then the placement');
  });
  it('every placed child carries the second address', () => {
    assert.match(ROUTE, /guardianEmail: guardianEmail!, guardianEmail2, guardianPhone/);
  });
  it('ask 3: the marketing consent takes the FIRST address only', () => {
    const at = ROUTE.indexOf('recordLeagueMarketingConsent(');
    const call = ROUTE.slice(at, ROUTE.indexOf('});', at));
    assert.ok(at > 0);
    assert.match(call, /normalizeGuardianEmailRequired\(guardianEmail!\)/);
    assert.ok(!/guardianEmail2|second/.test(call), 'the second address never reaches a consent row');
  });
  it('ask 2: the second parent’s confirmation is the built-in email, its own message, each copy in its own try', () => {
    const at = ROUTE.indexOf('const copies = [');
    assert.ok(at > 0);
    const block = ROUTE.slice(at, ROUTE.indexOf('notify(', at));
    assert.match(block, /\{ to: guardianEmail!, secondParentLine: null \}/);
    assert.match(block, /guardianEmail2 \? \[\{\s*to: guardianEmail2,\s*secondParentLine: SP\.addedYou\(/);
    assert.match(block, /for \(const copy of copies\) \{[^]*?try \{\s*const result = await sendTransactionalEmail\(\{/);
    // The second copy follows only a first copy that went (the rule every other sender holds).
    assert.match(block, /if \(copy\.secondParentLine && !firstWent\) break;/);
    assert.match(block, /if \(!copy\.secondParentLine\) firstWent = went\(result\);/);
    assert.match(block, /to: copy\.to,/);
    assert.match(block, /builtInOnly: copy\.secondParentLine != null/);
    assert.match(block, /catch \(e\)/);
    assert.ok(!/\bcc\b/i.test(block), 'never a Cc');
  });
  it('the response names the second address for the finish screen', () => {
    assert.match(ROUTE, /guardianEmail: guardianEmail!,\s*guardianEmail2,/);
  });
});

describe('the placement and the migration (source guard)', () => {
  it('the one placement step passes the second address in the child', () => {
    const body = functionBody(readCode('lib/league-registration-place.ts'), 'placeLeagueRegistration');
    assert.match(body, /guardianEmail2: normalizeGuardianEmail\(c\.guardianEmail2\) \?\? ''/);
  });
  it('mig 430 writes it, and the duplicate rule still keys on the FIRST address only', () => {
    const sql = readSource('supabase/migrations/430_a_second_parent_gets_the_signup_emails.sql');
    assert.match(sql, /league_is_duplicate\(p_season, NULL, v_first, v_last, v_dob, v_email\)/);
    assert.ok(!/league_is_duplicate\([^)]*v_email2/.test(sql));
    assert.match(sql, /guardian_email, guardian_email_2, guardian_phone/);
    assert.match(sql, /v_email, v_email2, nullif/);
    assert.match(sql, /guardian_email_2 <> lower\(btrim\(guardian_email\)\)/);
  });
});

describe('the confirmation email (source guard)', () => {
  const EMAIL = readCode('lib/email.ts');
  const signup = EMAIL.slice(EMAIL.indexOf('export function leagueSignupHtml('), EMAIL.indexOf('export function leagueAdminApprovedHtml('));
  it('the second parent’s copy greets "Hi," and carries the escaped line; the first parent’s is unchanged', () => {
    assert.match(signup, /p\.secondParentLine\s*\?\s*`<p>\$\{escapeEmailHtml\(SECOND_PARENT_WORDS\.greeting\)\}<\/p>/);
    assert.match(signup, /<p>\$\{p\.secondParentLine\}<\/p>/);
    assert.match(signup, /: `<p>Hi <strong>\$\{p\.guardianFirstName\}<\/strong>,<\/p>`/);
    assert.match(signup, /const p = escapeEmailFields\(input\)/);
  });
  it('builtInOnly skips the customised template and nothing else', () => {
    const send = functionBody(readCode('lib/platform-email-templates.ts'), 'sendTransactionalEmail');
    assert.match(send, /opts\.builtInOnly\s*\?\s*\{ subject: opts\.defaultSubject, html: opts\.defaultHtml \}/);
  });
});

describe('the form (source guard)', () => {
  const FORM = readCode('components/league/RegisterForm.tsx');
  it('the box has a bare label, its hint and its error; the body sends it; the coach line says so', () => {
    assert.match(FORM, /htmlFor="g-email2">\{SP\.label\}<\/label>/);
    assert.match(FORM, /\{SP\.hint\}/);
    assert.match(FORM, /errors\.guardianEmail2 && <p className=\{formKit\.errorMsg\}>/);
    assert.match(FORM, /guardianEmail2: guardian\.email2 \|\| undefined/);
    assert.match(FORM, /\{SP\.coachLine\}/);
  });
  it('the finish sentence names both addresses, and reads as before with one', () => {
    assert.match(FORM, /We’ve emailed this to <strong>\{result\.guardianEmail\}<\/strong>\{result\.guardianEmail2 && <> and <strong>\{result\.guardianEmail2\}<\/strong><\/>\}\. Keep/);
  });
});
