/**
 * THE FIRST LOOK, STAGE 2a — the warm email envelope and the two account emails (owner Ask 1 + Ask 8 2026-10-19; U5, U6,
 * U8 2026-10-20 with `/marketing`'s read and the owner's two calls; plan docs/projects/active/FIRST_LOOK_SIGNUP_PLAN.md).
 *
 * Pins: the envelope is the drawing's; the confirmation email names the right next step for every way in and never
 * promises Home to someone its link takes elsewhere; a customised template for either key wears the warm envelope on
 * every render path (send, preview, the editor, test-send) while every other key keeps the dark `wrap()`; and the
 * dark markup look is untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';
import {
  WARM_EMAIL, emailLookFor, wearsWarmEnvelope, warmEmailBody, warmEmailButton, warmEmailDocument,
} from '../../lib/email-envelope-warm.ts';
import { renderHeadingAndBody, renderMarkupToHtml } from '../../lib/email-markup.ts';
import { VERIFICATION_NEXT_STEP, verificationNextStep } from '../../lib/verification-next-step.ts';
import { startDoorLinkPath } from '../../lib/start-door.ts';

describe('the warm envelope (D-F11, U8)', () => {
  const doc = warmEmailDocument('<p>inner</p>');
  it('is the drawing: 600px ground with its edge, the white card, the wordmark, the footer word', () => {
    // table cells, not divs, carry them (Outlook's desktop app drops a div's padding)
    assert.match(doc, /style="width:100%;max-width:600px;margin:0 auto;border-collapse:separate;">\n<tr><td class="fl-ground" style="background:#f6f1ea;border:1px solid #c9c1b2;border-radius:10px;padding:28px 20px;/);
    assert.match(doc, /<td class="fl-card" style="background:#ffffff;border:1px solid #dad3c9;border-radius:12px;padding:28px 26px;">/);
    assert.doesNotMatch(doc, /<div/, 'no div carries the layout');
    assert.match(doc, /font-family:'Courier New',Courier,monospace;font-size:15px;[^"]*font-weight:700;[^"]*">FIELD<span style="color:#55641c;">LOGIC<\/span><span style="color:#4b463f;">HQ<\/span><\/p>/);
    assert.match(doc, /font-size:12px;[^"]*text-align:center;">FieldLogicHQ<\/p>/);
    assert.ok(doc.indexOf('<p>inner</p>') > doc.indexOf('LOGIC'), 'the content sits in the card, under the wordmark');
  });
  it('asks mail apps for light only and tightens the padding on a phone', () => {
    assert.match(doc, /<meta name="color-scheme" content="light only">/);
    assert.match(doc, /<meta name="supported-color-schemes" content="light only">/);
    assert.match(doc, /@media \(max-width: 480px\) \{\s*\.fl-ground \{ padding: 16px 12px !important; \}\s*\.fl-card \{ padding: 22px 18px !important; \}/);
    assert.match(doc, /<!--\[if mso\]><table role="presentation" width="600"/, 'Outlook’s desktop app gets a fixed width');
  });
  it('the button is lime with its olive edge, in a cell Outlook draws', () => {
    assert.equal(
      warmEmailButton('Go', 'https://x.test/'),
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;border-collapse:separate;"><tr><td style="background:#d9f99d;border:1px solid #55641c;border-radius:10px;mso-padding-alt:14px 26px;"><a href="https://x.test/" style="display:inline-block;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.2;font-weight:700;color:#211c15;text-decoration:none;border-radius:10px;">Go</a></td></tr></table>',
    );
  });
  it('a preview gets the envelope without a document, so no head or style reaches the page around it', () => {
    const body = warmEmailBody('<p>inner</p>');
    assert.doesNotMatch(body, /<head|<style|<html|<!doctype/i);
    assert.ok(doc.includes(body), 'the document is the same envelope');
  });
  it('wears only on the two account emails', () => {
    assert.ok(wearsWarmEnvelope('signup_verification') && wearsWarmEnvelope('password_reset'));
    assert.equal(emailLookFor('password_reset'), 'warm');
    for (const k of ['registration_received', 'founding_welcome', '', null, undefined]) {
      assert.equal(wearsWarmEnvelope(k), false, String(k));
      assert.equal(emailLookFor(k), 'house', String(k));
    }
  });
});

describe('the markup in the warm look (a customised template)', () => {
  it('reads in ink on the white card, and its button is the envelope’s', () => {
    const html = renderHeadingAndBody({ heading: 'Confirm your email', body: 'Hi.\n\n::button Confirm my email | {{verifyUrl}}', vars: { verifyUrl: 'https://x.test/' }, look: 'warm' });
    assert.match(html, new RegExp(`<h2 style="[^"]*font-size:24px;[^"]*color:${WARM_EMAIL.ink};">Confirm your email</h2>`));
    assert.match(html, new RegExp(`<p style="[^"]*font-size:16px;line-height:1.55;color:${WARM_EMAIL.ink};">Hi.</p>`));
    assert.ok(html.includes(warmEmailButton('Confirm my email', 'https://x.test/')));
    assert.doesNotMatch(html, /rgba\(241,245,249/, 'no light text from the dark look');
  });
  it('the house look is unchanged, and is the default', () => {
    assert.equal(
      renderMarkupToHtml('Hello **there**.\n\n::button Go | {{u}}\n::link More | {{u}}', { u: 'https://x.test/' }),
      '<p style="margin:0 0 1.1rem;line-height:1.7;color:rgba(241,245,249,0.85);">Hello <strong>there</strong>.</p>\n'
        + '<a href="https://x.test/" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;margin:0.5rem 0 1rem;">Go</a>\n'
        + '<a href="https://x.test/" style="display:inline-block;color:#D9F99D;text-decoration:none;font-weight:700;font-size:0.85rem;padding:0.4rem 0;">More</a>',
    );
  });
});

describe('the confirmation email’s next step (U6)', () => {
  it('a start door names its step 2 when the link returns there', () => {
    for (const door of ['team', 'league', 'organization', 'premium'] as const) {
      assert.equal(verificationNextStep({ door, next: startDoorLinkPath(door) }), door);
    }
  });
  it('a door account whose link goes elsewhere (a resend from a sign-in headed to another page) is told where it goes', () => {
    assert.equal(verificationNextStep({ door: 'team', next: '/coaches' }), 'onward');
    assert.equal(verificationNextStep({ door: 'league', next: '/home' }), 'home');
    assert.equal(
      verificationNextStep({ door: 'team', next: '/coaches/join?registered=1&registrationId=abc', registration: true }),
      'registration', 'a waiting team-door account that then registers a team for a tournament',
    );
  });
  it('a registration: the sender says so, or the join page’s return carries it', () => {
    assert.equal(verificationNextStep({ next: '/coaches/tournaments/abc', registration: true }), 'registration');
    assert.equal(verificationNextStep({ next: '/coaches/join?registered=1&registrationId=abc&verified=1' }), 'registration');
    assert.equal(verificationNextStep({ next: '/coaches/start?claim=t' }), 'onward', 'a Premium team claim is not a registration');
  });
  it('an account alone: Home only when the link goes Home, "you’re in" anywhere else', () => {
    assert.equal(verificationNextStep({ next: '/discover' }), 'home');
    assert.equal(verificationNextStep({ next: '/home' }), 'home');
    assert.equal(verificationNextStep({ next: '/riverdale/summer-classic' }), 'onward', 'a fan back to a followed tournament');
    assert.equal(verificationNextStep({ next: '/auth/accept-invite?token=t' }), 'onward', 'an invitation');
    assert.equal(verificationNextStep({ next: '/coaches' }), 'onward');
  });
  it('the ruled sentences, with curly apostrophes (owner calls 2026-10-20: the league names its league)', () => {
    assert.deepEqual(VERIFICATION_NEXT_STEP, {
      team: 'Then you’ll name your team.',
      league: 'Then you’ll name your league.',
      organization: 'Then you’ll name your organization and pick a plan.',
      premium: 'Then you’ll name your team and choose its sport.',
      registration: 'Then we’ll connect you to your team’s registration.',
      home: 'Then you’ll land on your Home page.',
      onward: 'Then you’re in.',
    });
  });
});

describe('the two emails and their render paths', () => {
  const email = readCode('lib/email.ts');
  const lib = readCode('lib/signup-verification.ts');
  const templates = readCode('lib/platform-email-templates.ts');
  it('the confirmation email: the drawn words, its next step, the hour (owner call 2)', () => {
    for (const w of ["warmEmailHeading('Confirm your email')", 'Hi ${p.firstName}, welcome to FieldLogicHQ.',
      'Confirm your email to finish your account. ${VERIFICATION_NEXT_STEP[p.nextStep]}', "warmEmailButton('Confirm my email', p.verifyUrl)",
      "warmEmailSmall('The link works for 1 hour.')", "warmEmailSmall('If you didn’t create this account, you can ignore this email.')"]) {
      assert.ok(email.includes(w), w);
    }
    assert.match(lib, /defaultSubject: 'Confirm your FieldLogicHQ email',/);
  });
  it('the reset email: U5’s words', () => {
    for (const w of ["warmEmailHeading('Reset your password')", "'We got a request to reset the password for your FieldLogicHQ account.'",
      "'Use the button to choose a new one. The link works for 1 hour.'", "warmEmailButton('Reset my password', resetLink)",
      "'If you didn’t ask for this, ignore this email. Your password won’t change.'"]) {
      assert.ok(email.includes(w), w);
    }
  });
  it('a customised template wears the warm envelope on every path; every other key keeps wrap()', () => {
    assert.match(templates, /key: string;\s*\}\): string \{\s*const look = emailLookFor\(p\.key\);[\s\S]*mode: p\.mode, look \}\);\s*return \(look === 'warm' \? warmEmailDocument : wrap\)\(/);
    assert.match(templates, /footerHtml: opts\?\.footerHtml,\s*key: row\.key,/, 'renderTemplateEmail (the preview route)');
    assert.match(templates, /body: bodyWithCta\(row\),\s*vars,\s*key,\s*\}\);/, 'renderResolvedEmail (the send)');
    assert.match(readCode('app/api/platform-admin/email-templates/[key]/test-send/route.ts'), /renderPlatformEmailHtml\(\{ heading, body: bodyMarkup, vars, footerHtml: testNote, key \}\)/);
    const editor = readCode('app/platform-admin/email-templates/[key]/EmailTemplateEditor.tsx');
    assert.match(editor, /const look = emailLookFor\(fields\.key\);[\s\S]*if \(look === 'warm'\) return warmEmailBody\(inner\);/);
    assert.match(editor, /buildPreviewHtml\(\{ key: templateKey,/);
  });
  it('the shared dark wrap() is not the warm one, and the plain-text part skips the head', () => {
    assert.match(email, /export const wrap = \(content: string\) => `\n<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;/);
    assert.match(email, /\.replace\(\/<head\\b\[\\s\\S\]\*\?<\\\/head>\/i, ''\)/);
  });
  it('every sender says where its link returns, so the step is chosen from facts', () => {
    assert.match(readCode('app/api/auth/coach-signup/route.ts'), /actionLink: linkData\.properties\.action_link, next, door: startDoor, registration: !!continueName,/);
    assert.match(readCode('app/api/auth/resend-verification/route.ts'), /actionLink: link\.properties\.action_link,\s*next,\s*door,[\s\S]*registration: typeof body\.continueName === 'string' && body\.continueName\.trim\(\) !== '',/);
    // Coach Premium's fixed "your Coaches Portal" is a template variable only: it never makes a claim a registration
    assert.match(readCode('app/api/auth/team-signup/route.ts'), /next: safeNext, door: startRecord\?\.door \?\? null,\s*firstName: first \|\| undefined, continueName: 'your Coaches Portal',\s*\}\);/);
    assert.match(lib, /nextStep: verificationNextStep\(\{ door: p\.door, next: p\.next, registration: p\.registration \}\),/);
  });
});
