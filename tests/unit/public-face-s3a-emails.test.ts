/**
 * THE PUBLIC FACE, WARM — S3a: ONE ENVELOPE FOR EVERY EMAIL (owner Ask 9 + Ask 11, 2026-10-23; plan
 * docs/projects/active/PUBLIC_FACE_WARM_PLAN.md, build prompt PUBLIC_FACE_WARM_S3A_BUILD_PROMPT.md).
 *
 * Before: two emails wore the warm envelope and about 45 more wore a near-black card with a lime letter-spaced
 * "FIELDLOGICHQ", through `wrap()` and five more hand-built shells. After: `wrap()` is the warm document, the five shells
 * are on it, the unsubscribe footer sits inside the card, and the old dark palette is gone from every email source.
 *
 * What this pins, and why a source scan is the right tool: an email is a template string, so the colours are text, and a
 * single `rgba(241,245,249,…)` left in one builder is light-grey type on a white card. The scan names the file and line.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { readCode } from './_source-code.ts';
import {
  WARM_CARD_END, WARM_EMAIL, insertAtWarmCardEnd, warmEmailDocument, warmEmailForPreview, warmUnsubscribeFooterHtml,
} from '../../lib/email-envelope-warm.ts';
import { duesReminderEmail } from '../../lib/dues-reminder-email.ts';
import { transactionalFamilyFooterHtml } from '../../lib/family-mail-footer.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** Every file that builds an email: lib/ files named like one (scripts/check-public-type.mjs's rule), plus the two routes that render one. */
const EMAIL_NAME = /(email|notify|announcement|reminder|mail)/;
const EMAIL_SOURCES = [
  ...readdirSync(path.join(REPO, 'lib'), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && EMAIL_NAME.test(e.name))
    .map((e) => `lib/${e.name}`),
  'app/api/admin/email/preview/route.ts',
  'app/api/platform-admin/email-templates/[key]/test-send/route.ts',
];

/** The old dark card's palette. Each is a role that does not exist on a white card. */
const OLD_DARK_PALETTE: [string, RegExp][] = [
  ['the dark card ground #111827', /#111827/i],
  ['light text rgba(241,245,249,…)', /rgba\(\s*241\s*,\s*245\s*,\s*249/i],
  ['the blue tint rgba(30,58,138,…)', /rgba\(\s*30\s*,\s*58\s*,\s*138/i],
  ['the blue button #1E3A8A', /#1e3a8a/i],
  ['the dark panel #0F172A', /#0f172a/i],
  ['lime used as TEXT (E3: lime is a fill, never text on paper)', /(?:^|[;"'\s{])color:\s*#d9f99d/i],
  ['the lime tint rgba(217,249,157,…)', /rgba\(\s*217\s*,\s*249\s*,\s*157/i],
];

describe('S3a — no email source holds the old dark palette', () => {
  it('finds the email sources it is meant to scan', () => {
    for (const f of ['lib/email.ts', 'lib/notify.ts', 'lib/family-email.ts', 'lib/dues-reminder-email.ts',
      'lib/practice-plan-email.ts', 'lib/basic-coach-announcements.ts', 'lib/email-sender.ts', 'lib/feedback-email.ts']) {
      assert.ok(EMAIL_SOURCES.includes(f), `${f} is scanned`);
    }
  });
  it('names the file and line of anything left from the dark card', () => {
    const found: string[] = [];
    for (const file of EMAIL_SOURCES) {
      readCode(file).split('\n').forEach((line, i) => {
        for (const [what, re] of OLD_DARK_PALETTE) if (re.test(line)) found.push(`${file}:${i + 1}  ${what}`);
      });
    }
    assert.deepEqual(found, [], 'every email wears the warm envelope: take the colour from WARM_EMAIL by its role');
  });
});

describe('S3a — wrap() and the hand-built shells are the warm envelope', () => {
  it('wrap() IS the warm document', () => {
    const email = readCode('lib/email.ts');
    assert.match(email, /export const wrap = \(content: string\) => warmEmailDocument\(content\);/);
    assert.doesNotMatch(email, /FIELDLOGICHQ/, 'the lime spaced banner is gone; the wordmark line is the envelope’s');
  });
  it('each own-shell builder builds on the envelope, not a div of its own', () => {
    for (const f of ['lib/notify.ts', 'lib/basic-coach-announcements.ts', 'lib/family-email.ts',
      'lib/dues-reminder-email.ts', 'lib/practice-plan-email.ts']) {
      const code = readCode(f);
      assert.match(code, /warmEmailDocument\(/, `${f} wears the envelope`);
      assert.doesNotMatch(code, /max-width:600px;margin:0 auto;padding:2/, `${f} has no shell of its own`);
    }
  });
  it('feedback and the club schedule send still go through wrap()', () => {
    assert.match(readCode('lib/feedback-email.ts'), /return wrap\(/);
    assert.match(readCode('lib/club-schedule-send.ts'), /return wrap\(/);
  });
  it('every button is the envelope’s one button: none is a hand-built filled link, and none sits inside a paragraph', () => {
    for (const f of EMAIL_SOURCES) {
      const lines = readCode(f).split('\n');
      lines.forEach((l, i) => {
        assert.doesNotMatch(l, /<a [^>]*display:inline-block;[^"]*background:/, `${f}:${i + 1} hand-built button (Outlook draws a padded link as plain text)`);
        assert.doesNotMatch(l, /<p[^>]*>\s*\$\{warmEmailButton\(/, `${f}:${i + 1} a button is a table and cannot sit inside a <p>`);
      });
    }
  });
});

describe('S3a — the footers', () => {
  it('the unsubscribe footer keeps its legal words and its link, and sits INSIDE the card', () => {
    const footer = warmUnsubscribeFooterHtml('https://x.test/u?t=1');
    assert.match(footer, /You're receiving this because you signed up for FieldLogicHQ\./);
    assert.match(footer, /<a href="https:\/\/x\.test\/u\?t=1" style="[^"]*">Unsubscribe<\/a>/);
    assert.match(footer, /FieldLogicHQ · Canada/, 'Held by the copy pass until the owner supplies a mailing address');
    const doc = insertAtWarmCardEnd(warmEmailDocument('<p>Hello</p>'), footer);
    assert.ok(doc.indexOf('Unsubscribe') > doc.indexOf('Hello'), 'after the content');
    assert.ok(doc.indexOf('Unsubscribe') < doc.indexOf('</td></tr>\n</table>'), 'before the card closes');
    assert.equal(doc.split(WARM_CARD_END).length, 2, 'the marker stays, once, so a second footer would also land in the card');
  });
  it('a document that is not the envelope still gets the footer (before </body>, else at the end)', () => {
    assert.equal(insertAtWarmCardEnd('<html><body>x</body></html>', 'F'), '<html><body>xF\n</body></html>');
    assert.equal(insertAtWarmCardEnd('x', 'F'), 'xF');
  });
  it('the marketing send injects it through the envelope, and its text part skips the head', () => {
    const sender = readCode('lib/email-sender.ts');
    assert.match(sender, /return insertAtWarmCardEnd\(html, warmUnsubscribeFooterHtml\(unsubscribeUrl\)\);/);
    assert.match(sender, /\.replace\(\/<head\\b\[\\s\\S\]\*\?<\\\/head>\/i, ''\)/);
    assert.match(readCode('app/api/admin/email/preview/route.ts'), /SAMPLE_FOOTER = warmUnsubscribeFooterHtml\('#'\)/, 'the preview shows the footer the email carries');
  });
  it('the family notice footer keeps its words, in the envelope’s fine print', () => {
    const html = transactionalFamilyFooterHtml({ orgName: 'Riverdale Minor Ball', teamName: 'Ridge 11U', noticeKind: 'Dues reminders', about: 'player dues' });
    assert.match(html, /Sent by <strong>Riverdale Minor Ball<\/strong> about player dues for Ridge 11U\./);
    assert.match(html, /are account notices rather than announcements, so they are sent even if you\s+have unsubscribed from Riverdale Minor Ball’s emails\./);
    assert.match(html, new RegExp(`color:${WARM_EMAIL.secondary}`));
    assert.doesNotMatch(readCode('lib/family-mail-footer.ts'), /tone/, 'there is no dark tone to pick');
  });
  it('every page that injects a whole email into itself strips the head first', () => {
    // a document’s <style> survives innerHTML: its colour-scheme request would reach the whole admin or coach screen
    for (const f of ['app/platform-admin/email/EmailDashboardClient.tsx', 'components/coaches/DuesReminderPreviewModal.tsx']) {
      assert.match(readCode(f), /__html: warmEmailForPreview\(/, f);
    }
  });
  it('a page that shows an email inline gets the words, not the document head', () => {
    const shown = warmEmailForPreview(warmEmailDocument('<p>Hello</p>'));
    assert.match(shown, /<p>Hello<\/p>/);
    assert.doesNotMatch(shown, /<style|color-scheme|<title|<head/i, 'a colour-scheme request must never reach the page around the preview');
    assert.equal(warmEmailForPreview('<p>no body tag</p>'), '<p>no body tag</p>');
  });
});

describe('S3a — a reader’s emails, rendered', () => {
  const dues = duesReminderEmail({
    teamName: 'Ridge 11U', orgName: 'Riverdale Minor Ball', window: 7, guardianFirst: 'Sam',
    items: [{ playerFirstName: 'Ava', playerLastName: 'Lee', amount: 100, remainingAmount: 100, dueDate: '2026-11-01', installmentNumber: 1, totalInstallments: 3 }],
  });
  it('the dues reminder is the warm document, with its words and its transactional footer intact', () => {
    assert.match(dues.html, /^<!doctype html>/);
    assert.match(dues.html, /class="fl-card"/);
    assert.match(dues.html, /Hi Sam,/);
    assert.match(dues.html, /sent even if you\s+have unsubscribed/);
    assert.doesNotMatch(dues.html, /rgba\(|#111827/);
  });
  it('no builder prints a literal template placeholder or the word undefined', () => {
    assert.doesNotMatch(dues.html, /\$\{|undefined|NaN/);
  });
  it('the practice plan’s time column is Arial with tabular figures, not the typewriter face', () => {
    const code = readCode('lib/practice-plan-email.ts');
    assert.match(code, /font-variant-numeric:tabular-nums/);
    assert.doesNotMatch(code, /monospace|ui-monospace|Courier/);
  });
});
