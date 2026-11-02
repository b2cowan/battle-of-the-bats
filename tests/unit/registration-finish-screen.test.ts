/**
 * THE REGISTER FORM'S FINISH SCREEN SAYS WHAT IS REALLY NEXT (Signed-in family accounts Stage 2, Part 5; ask 3 = A,
 * drawing SIGNED_IN_FAMILY_STAGE2_DRAWINGS.html tab 3). A new coach made their account on the form, so the screen no
 * longer offers to create one: the check-your-email block leads, with a heading and a quiet "Already confirmed? Sign in";
 * the already-has-an-account card gets one real Sign in; no sign-in link carries the coach's address.
 *
 * Source guards: the form is a client component that pulls next/navigation and a CSS module into the node runner.
 * Which card shows (created / exists / failed) is Part 4's and pinned in registration-one-email.test.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

const src = readCode('components/public/RegisterContent.tsx');
const card = src.slice(at(src, "{step === 'success' && confirmation && ("), at(src, '{ready && onFormStep && !notOpen && ('));

describe('the finish screen', () => {
  it('keeps its titles', () => {
    assert.match(card, /'Waitlist Request Received' : "You're In Motion"/);
  });

  it('leads with the check-your-email block: the drawing\'s heading and first line, and its sign-in foot turned on', () => {
    const start = at(card, '<VerifyEmailSent');
    const block = card.slice(start, card.indexOf('\n                    />', start));
    assert.match(block, /heading="Confirm your email to open your portal"/);
    assert.match(block, /lead=\{<>Open the link we sent\. It works for 1 hour\.<\/>\}/);
    assert.match(block, /after=\{<>You’ll hear from the organizer at this address either way\.<\/>\}/);
    assert.match(block, /signInHref=\{finishSignInHref\}/);
  });

  it('the block renders the heading in the Register look only', () => {
    const v = readCode('components/auth/VerifyEmailSent.tsx');
    const register = v.slice(at(v, 'styles[tone]'));
    assert.match(register, /\{heading && <p className=\{styles\.head\}>\{heading\}<\/p>\}/);
    assert.ok(v.indexOf('styles.head') > at(v, "if (tone === 'start')"), 'not in the start look');
  });

  it('names the confirm link in "Watch your email" only where one went', () => {
    assert.equal([...card.matchAll(/\$\{confirmation\.verifyEmail \? ' and the link to confirm your email' : ''\}/g)].length, 2, 'pending and waitlist');
  });

  it('no longer offers to create the account the coach just made', () => {
    assert.doesNotMatch(card, /Create Coaches Portal Account|Create your Coaches Portal|Set a password to track/);
  });

  it('says "open the link we sent" only when the server says a link went; one mapping for both signed-out paths', () => {
    assert.match(readCode('app/api/register/route.ts'), /account: account\?\.outcome, linkSent: !!actionLink \}\);/);
    assert.match(src, /registered\.linkSent \? \{ verifyEmail: emailNorm \}\s*: registered\.account === 'exists' \? \{ note: ACCOUNT_EXISTS_NOTE, accountExists: true \}\s*: \{ note: ACCOUNT_STEP_FAILED_NOTE \};/);
    assert.equal([...src.matchAll(/showVerifySuccess\(registered, registrationPortalPath\(registered\.id\), signedOutFinish\(registered, emailNorm\)\);/g)].length, 2);
    assert.doesNotMatch(src, /registered\.account === 'created'|registered\.account === 'failed'/, 'no second reading of the outcome');
  });

  it('the already-has-an-account card has one Sign in; a new coach gets no big button', () => {
    assert.match(src, /const ACCOUNT_EXISTS_NOTE = 'This email already has a FieldLogicHQ account\. Sign in to see this registration in your Coaches Portal\. If you never opened its verification email, we’ve sent the link again\.';/);
    const acts = card.slice(at(card, 'styles.successActions'));
    assert.match(acts, /: confirmation\.accountExists && <Link href=\{finishSignInHref\} className="btn btn-primary">Sign in<\/Link>/);
    assert.equal([...acts.matchAll(/btn-primary/g)].length, 2, 'Sign in, and the signed-in fallback\'s Open Coaches Portal');
  });

  it('signs in through the join link, with no address in it', () => {
    assert.match(src, /const finishSignInHref = confirmation \? www\(`\/auth\/login\?next=\$\{encodeURIComponent\(confirmation\.joinHref\)\}`\) : '';/);
    assert.doesNotMatch(card, /[?&]email=/);
  });
});
