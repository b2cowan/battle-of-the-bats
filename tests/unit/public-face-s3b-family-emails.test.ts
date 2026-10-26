/**
 * THE PUBLIC FACE, WARM — S3b: FAMILY EMAILS IN THE CLUB'S NAME (owner Asks 1–9, 2026-10-23; plan
 * docs/projects/active/PUBLIC_FACE_WARM_PLAN.md, build prompt PUBLIC_FACE_WARM_S3B_BUILD_PROMPT.md, words
 * PUBLIC_FACE_WARM_S3B_COPY.md).
 *
 * What this pins: a family email wears its club (a band in the club's colour holding its name as text, a logo-or-initials
 * tile, a thin accent rule, a quiet platform line, one reply line) and goes out as "{Club} via FieldLogicHQ" — and every
 * email that is NOT a family email stays exactly what S3a shipped. Pure pieces are rendered; the senders (which import the
 * server) are held by source scans, the way the S3a and guard tests hold them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readCode } from './_source-code.ts';
import { contrastRatio } from '../../lib/color-contrast.ts';
import { warmEmailBody, warmEmailDocument } from '../../lib/email-envelope-warm.ts';
import { htmlToText } from '../../lib/email-plain-text.ts';
import { duesReminderEmail } from '../../lib/dues-reminder-email.ts';
import { accountNoticeFootnoteHtml, transactionalFamilyFooterHtml } from '../../lib/family-mail-footer.ts';
import { familyTemplateSample, isFamilyTemplateKey } from '../../lib/email-family-template-sample.ts';
import {
  clubBand, eyebrowRepeatsBand, familyReplyPlan, familySenderName, isEmailableLogoUrl, isLimeLike, platformLineWords,
  type ClubEmailFacts,
} from '../../lib/email-club-identity.ts';

const HOST = 'abc.supabase.co';
const PNG = `https://${HOST}/storage/v1/object/public/logos/riverdale.png`;
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** The nine clubs the drawings show, plus the long name. */
const DRAWN: [string, ClubEmailFacts][] = [
  ['ocean preset', { name: 'Riverdale Minor Ball', themePreset: 'ocean' }],
  ['soft yellow', { name: 'Riverdale Minor Ball', themePrimary: '#FFE9A8' }],
  ['cream', { name: 'Riverdale Minor Ball', themePrimary: '#F3F0E6' }],
  ['pink', { name: 'Riverdale Minor Ball', themePrimary: '#E0457B' }],
  ['grey', { name: 'Riverdale Minor Ball', themePrimary: '#808080' }],
  ['night navy', { name: 'Riverdale Minor Ball', themePrimary: '#0F1B33' }],
  ['no colours', { name: 'Riverdale Minor Ball' }],
  ['green with a yellow accent', { name: 'Riverdale Minor Ball', themePrimary: '#15803D', themeAccent: '#FACC15' }],
  ['a 53-character name', { name: 'The Northern Peninsula Amateur Baseball Association X', themePreset: 'ocean' }],
];

describe('S3b — an email with no club is exactly what S3a shipped', () => {
  it('the document and the body hash to the S3a output (computed from the S3a envelope at 26f5bdb0c)', () => {
    assert.equal(sha(warmEmailDocument('<p>Hello</p>')), 'dbc3af085ee794f4');
    assert.equal(sha(warmEmailBody('<p>Hello</p>')), '6350b4a85641daf6');
  });
  it('null and undefined are "no club"', () => {
    assert.equal(warmEmailDocument('<p>x</p>', null), warmEmailDocument('<p>x</p>'));
    assert.equal(warmEmailDocument('<p>x</p>', undefined), warmEmailDocument('<p>x</p>'));
  });
  it('a plain document carries none of the club parts', () => {
    const html = warmEmailDocument('<p>Hello</p>');
    assert.match(html, /class="fl-card"/);
    assert.doesNotMatch(html, /fl-flush|fl-band|fl-pad|data-fl-tile|Sent through/);
  });
  it('a dues reminder with no club is the plain card with the legal words and nothing new', () => {
    const plain = duesReminderEmail({ teamName: 'Ridge 11U', orgName: 'Riverdale Minor Ball', window: 7, guardianFirst: 'Sam', items: [] });
    assert.match(plain.html, /class="fl-card"/);
    assert.doesNotMatch(plain.html, /fl-band|Sent through|Replies to this email|Reply to this email/);
    assert.match(plain.html, /sent even if you\s+have unsubscribed/);
  });
  it('the free-tier coach announcement, notify() and the generic "View" email are left alone (owner Ask 7)', () => {
    for (const f of ['lib/basic-coach-announcements.ts', 'lib/notify.ts']) {
      const code = readCode(f);
      assert.doesNotMatch(code, /email-club-identity|club-email-context|fromName|familySenderName/, `${f} stays as S3a left it`);
    }
  });
});

describe('S3b — the band', () => {
  for (const [what, facts] of DRAWN) {
    it(`${what}: the club's name stays readable on the band (4.5 : 1 or better)`, () => {
      const b = clubBand(facts, { storageHost: HOST });
      assert.ok(contrastRatio(b.onFill, b.fill) >= 4.5, `${what}: ${b.onFill} on ${b.fill} is ${contrastRatio(b.onFill, b.fill).toFixed(2)}`);
      assert.ok(contrastRatio(b.tileInk, b.tileBackground) >= 3, `${what}: the initials read on their tile`);
    });
  }

  const club: ClubEmailFacts = { name: 'Riverdale Minor Ball', themePrimary: '#075985', themeAccent: '#38BDF8' };
  it('is a table cell with bgcolor and background, the name as TEXT, and no image when there is no usable logo', () => {
    const html = warmEmailDocument('<p>x</p>', club);
    assert.match(html, /<td class="fl-band" bgcolor="#075985" style="background:#075985;/);
    assert.match(html, />Riverdale Minor Ball<\/td>/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, />RM<\/td>/, 'the initials tile');
  });
  it('the card cell is fl-flush, not fl-card, and the padding moves onto fl-pad', () => {
    const html = warmEmailDocument('<p>x</p>', club);
    assert.match(html, /<td class="fl-flush" style="[^"]*padding:0;/);
    assert.doesNotMatch(html, /class="fl-card"/, 'the phone rule fl-card beats an inline padding:0');
    assert.match(html, /<td class="fl-pad" style="padding:22px 26px 26px;">/);
    assert.match(html, /\.fl-band \{ padding: 12px 18px !important; \}/);
    assert.match(html, /\.fl-pad \{ padding: 18px 18px 22px !important; \}/);
  });
  it('the accent rule is a border-bottom on the band cell, never an empty row', () => {
    const html = warmEmailDocument('<p>x</p>', club);
    assert.match(html, /class="fl-band"[^>]*border-bottom:3px solid #38BDF8;/);
    assert.doesNotMatch(html, /<tr><td[^>]*height="3"/);
  });
  it('the rule is dropped when the accent is the fill, and when it is a lime or yellow-green', () => {
    assert.equal(clubBand({ name: 'X', themePrimary: '#E0457B' }).accent, null, 'a pink with no accent: the accent IS the fill');
    assert.equal(clubBand({ name: 'X', themePrimary: '#075985', themeAccent: '#D9F99D' }).accent, null, 'platform lime');
    assert.equal(clubBand({ name: 'X', themePrimary: '#075985', themeAccent: '#84CC16' }).accent, null, 'a lime');
    assert.equal(clubBand({ name: 'X', themePrimary: '#075985', themeAccent: '#38BDF8' }).accent, '#38BDF8', 'a sky accent stays');
    assert.ok(isLimeLike('#D9F99D') && isLimeLike('#A3E635') && !isLimeLike('#FACC15') && !isLimeLike('#075985'));
    assert.doesNotMatch(warmEmailDocument('<p>x</p>', { name: 'X', themePrimary: '#075985', themeAccent: '#D9F99D' }), /border-bottom:3px/);
  });
  it('a long name wraps beside the tile: break-word, a middle-aligned name cell, and a full-width inner table', () => {
    const html = warmEmailDocument('<p>x</p>', DRAWN[8][1]);
    assert.match(html, /<td valign="middle" style="[^"]*word-break:break-word;">The Northern Peninsula Amateur Baseball Association X<\/td>/);
    assert.match(html, /<table role="presentation" width="100%"[^>]*><tr><td data-fl-tile/);
  });
  it('the club name is escaped', () => {
    const html = warmEmailDocument('<p>x</p>', { name: 'A <b>&</b> "Club"' });
    assert.doesNotMatch(html, /<b>&<\/b>/);
    assert.match(html, /A &lt;b&gt;&amp;&lt;\/b&gt; &quot;Club&quot;/);
  });
  it('ends with the quiet platform line, once, inside the card', () => {
    const html = warmEmailDocument('<p>x</p>', club);
    const w = platformLineWords(club.name);
    assert.equal(html.split(w.lead).length, 2);
    assert.ok(html.indexOf(w.lead) < html.indexOf('<!--fl-card-end-->'));
    assert.match(html, /font-size:12px[^>]*>Sent through <span[^>]*font-size:12px/, 'the name line is drawn at 12 px');
  });
});

describe('S3b — the logo rule', () => {
  const size = { width: 400, height: 200 };
  it('a PNG or JPEG on our storage with a known size is used, at its real aspect inside 36 px', () => {
    const b = clubBand({ name: 'X', logoUrl: PNG, logoSize: size }, { storageHost: HOST });
    assert.deepEqual(b.logo, { src: PNG, width: 36, height: 18 });
    const tall = clubBand({ name: 'X', logoUrl: PNG.replace('.png', '.JPG'), logoSize: { width: 100, height: 300 } }, { storageHost: HOST });
    assert.deepEqual(tall.logo && [tall.logo.width, tall.logo.height], [12, 36]);
  });
  it('a WebP, an SVG, a stock-logo path, another host, plain http, or an unknown size means the initials tile', () => {
    const cases: [string, ClubEmailFacts][] = [
      ['webp', { name: 'X', logoUrl: PNG.replace('.png', '.webp'), logoSize: size }],
      ['svg', { name: 'X', logoUrl: PNG.replace('.png', '.svg'), logoSize: size }],
      ['relative stock logo', { name: 'X', logoUrl: '/stock-logos/ball.png', logoSize: size }],
      ['another host', { name: 'X', logoUrl: 'https://evil.example/logo.png', logoSize: size }],
      ['http', { name: 'X', logoUrl: PNG.replace('https:', 'http:'), logoSize: size }],
      ['no size', { name: 'X', logoUrl: PNG }],
      ['null size', { name: 'X', logoUrl: PNG, logoSize: null }],
      ['zero size', { name: 'X', logoUrl: PNG, logoSize: { width: 0, height: 10 } }],
    ];
    for (const [what, facts] of cases) assert.equal(clubBand(facts, { storageHost: HOST }).logo, null, what);
    assert.equal(isEmailableLogoUrl(PNG, null), false, 'with no storage host configured nothing is ours');
  });
  it('a logo draws a white tile holding the image, alt text = the initials, display:block; no data URI', () => {
    const html = warmEmailDocument('<p>x</p>', clubBandFacts());
    function clubBandFacts(): ClubEmailFacts { return { name: 'Riverdale Minor Ball', logoUrl: PNG, logoSize: size }; }
    // the document reads the host from the environment, so draw the band the way the envelope would when it is configured
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${HOST}`;
    const withLogo = warmEmailDocument('<p>x</p>', clubBandFacts());
    assert.match(withLogo, /<td data-fl-tile="1"[^>]*bgcolor="#ffffff"[^>]*><img src="[^"]+riverdale\.png" width="36" height="18" alt="RM" style="display:block;/);
    assert.doesNotMatch(withLogo, /data:image/);
    assert.doesNotMatch(html, /<img/, 'without the storage host the same club shows its initials');
  });
  it('the plain-text part starts with the club’s name and carries no stray alt text or initials', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${HOST}`;
    for (const facts of [{ name: 'Riverdale Minor Ball' }, { name: 'Riverdale Minor Ball', logoUrl: PNG, logoSize: size }] as ClubEmailFacts[]) {
      const text = htmlToText(warmEmailDocument('<h1>Picture day</h1><p>Hello</p>', facts));
      assert.ok(text.startsWith('Riverdale Minor Ball\n'), `starts with the name: ${JSON.stringify(text.slice(0, 40))}`);
      assert.doesNotMatch(text.split('\n')[0], /RM/);
      assert.doesNotMatch(text, /\bRM\b/);
      assert.match(text, /Sent through FieldLogicHQ, the software Riverdale Minor Ball uses\./);
    }
  });
});

describe('S3b — the sender name (copy item 1)', () => {
  it('is "{Club} via FieldLogicHQ"', () => {
    assert.equal(familySenderName('Riverdale Minor Ball'), 'Riverdale Minor Ball via FieldLogicHQ');
  });
  it('removes quotes, angle brackets, @, commas, semicolons, colons and backslashes', () => {
    assert.equal(familySenderName('Riverdale "Minor", Ball <x@y.ca>; Inc: \\ North'), 'Riverdale Minor Ball xy.ca Inc North via FieldLogicHQ');
  });
  it('removes line breaks and control characters, and collapses spaces', () => {
    assert.equal(familySenderName('Riverdale\r\nMinor\tBall   \n\n'), 'Riverdale Minor Ball via FieldLogicHQ');
    assert.equal(familySenderName('  A    B  '), 'A B via FieldLogicHQ');
  });
  it('a name of only removed characters or only punctuation falls back to FieldLogicHQ alone', () => {
    for (const n of ['"<>@,;:\\', '   ', '', '---', '!!!', '. . .']) assert.equal(familySenderName(n), 'FieldLogicHQ', JSON.stringify(n));
    assert.equal(familySenderName(null), 'FieldLogicHQ');
    assert.equal(familySenderName(undefined), 'FieldLogicHQ');
  });
  it('caps the club part at 48 characters, ending with an ellipsis, so "via FieldLogicHQ" is never the part lost', () => {
    const out = familySenderName('A'.repeat(200));
    assert.ok(out.endsWith('… via FieldLogicHQ'));
    assert.equal(Array.from(out.replace(' via FieldLogicHQ', '')).length, 48);
    const exact = 'B'.repeat(48);
    assert.equal(familySenderName(exact), `${exact} via FieldLogicHQ`, '48 exactly is not cut');
  });
  it('keeps an accented name whole, and never cuts a letter in half', () => {
    assert.equal(familySenderName('Club de baseball Saint-Étienne'), 'Club de baseball Saint-Étienne via FieldLogicHQ');
    const long = familySenderName('É'.repeat(60));
    assert.equal(Array.from(long.replace(' via FieldLogicHQ', '')).length, 48);
    assert.doesNotMatch(long, /�/);
  });
  it('the club can never be the whole sender name', () => {
    for (const n of ['Riverdale', 'PayPal', 'FieldLogicHQ']) assert.ok(familySenderName(n).endsWith(' via FieldLogicHQ') || familySenderName(n) === 'FieldLogicHQ');
  });
  it('the transport builds the From header from RESEND_FROM’s address (inside <> if present) and the cleaned name', () => {
    const email = readCode('lib/email.ts');
    assert.match(email, /const FROM_ADDRESS = \(FROM\.match\(\/<\(\[\^>\]\+\)>\/\)\?\.\[1\] \?\? FROM\)\.trim\(\);/, 'the address is parsed once');
    assert.match(email, /return fromName \? `"\$\{fromName\}" <\$\{FROM_ADDRESS\}>` : FROM;/);
    assert.match(email, /from: fromHeader\(opts\.fromName\)/, 'one send');
    assert.match(email, /from: fromHeader\(e\.fromName\)/, 'each message of a batch builds its own');
  });
});

describe('S3b — the reply line (copy items 3–5)', () => {
  it('person-sent mail replies to its sender and names them', () => {
    assert.deepEqual(familyReplyPlan({ kind: 'person', clubName: 'Riverdale', senderEmail: 'dana@riverdale.ca', senderName: 'Dana' }),
      { replyTo: 'dana@riverdale.ca', line: 'Reply to this email to reach Dana.' });
  });
  it('person-sent mail falls back to "the sender" when no name is usable (none, an address, or the club’s own name)', () => {
    for (const senderName of [null, '', 'dana@riverdale.ca', 'Riverdale']) {
      assert.equal(familyReplyPlan({ kind: 'person', clubName: 'Riverdale', senderEmail: 'dana@riverdale.ca', senderName }).line, 'Reply to this email to reach the sender.');
    }
  });
  it('person-sent mail with no address on file promises nothing', () => {
    const p = familyReplyPlan({ kind: 'person', clubName: 'Riverdale', senderEmail: null, senderName: 'Dana' });
    assert.equal(p.replyTo, null);
    assert.match(p.line, /won't reach anyone/);
  });
  it('system mail with a club contact replies to it and says so', () => {
    assert.deepEqual(familyReplyPlan({ kind: 'system', clubName: 'Riverdale Minor Ball', clubContact: 'info@riverdale.ca' }),
      { replyTo: 'info@riverdale.ca', line: 'Reply to this email to reach Riverdale Minor Ball.' });
  });
  it('system mail without a contact says nobody reads replies, and sends the family to the club', () => {
    for (const clubContact of [null, undefined, '', 'not an address']) {
      assert.deepEqual(familyReplyPlan({ kind: 'system', clubName: 'Riverdale Minor Ball', clubContact }),
        { replyTo: null, line: "Replies to this email won't reach anyone. To get in touch, contact Riverdale Minor Ball directly." });
    }
  });
  it('the Message door and Email families still reply to their sender (the guard’s pin), and the two person-sent sends are new', () => {
    // The Message door's send lives in lib/families-email.ts since 9d-1 (both doors call `messageOneFamily`).
    assert.match(readCode('lib/families-email.ts'), /replyTo:\s*ctx\.user\.email/);
    assert.match(readCode('lib/families-email.ts'), /replyTo: senderEmail/);
    assert.match(readCode('lib/rep-team-announcements.ts'), /replyTo: reply\.replyTo/, 'the rep-team announcement now replies to the coach');
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/email/route.ts'), /replyTo: reply\.replyTo/, 'the season email replies to the admin');
  });
  it('the public contact is read from the public site, once per send or run — never Organization.contactEmail', () => {
    const ctx = readCode('lib/club-email-context.ts');
    assert.match(ctx, /getOrgPublicSiteContent\(orgId\)\)\?\.contactEmail/);
    assert.doesNotMatch(ctx, /org\.contactEmail|\.contactEmail\s*\?\?\s*null/);
    assert.match(readCode('lib/dues-reminders.ts'), /faces = new Map<string, Promise<ClubFace>>\(\)/, 'the sweep reads each club once');
    assert.match(readCode('lib/family-notify.ts'), /const face = orgFields\s*\? await systemMailFace\(/);
  });
});

describe('S3b — the foot of the card (copy items 2, 7, 8)', () => {
  it('the dues reminder keeps its legal sentence and puts the reply line after "speak to your coach"', () => {
    const html = transactionalFamilyFooterHtml({ orgName: 'Riverdale Minor Ball', teamName: 'Ridge 11U', noticeKind: 'Dues reminders', about: 'player dues', replyLine: 'Reply to this email to reach Riverdale Minor Ball.' });
    assert.match(html, /have unsubscribed from Riverdale Minor Ball’s emails\. If you believe you received this in error, please\s+speak to your coach\.<br>\s*Reply to this email to reach Riverdale Minor Ball\./);
  });
  it('the tryout receipt and the registration emails name the club, say why, and carry the reply line — and no unsubscribe', () => {
    const tryout = accountNoticeFootnoteHtml({ clubName: 'Riverdale Minor Ball', reason: 'Alex applied for a tryout with 12U AAA 2026-27', replyLine: 'Reply to this email to reach Riverdale Minor Ball.' });
    assert.match(tryout, /Sent by <strong>Riverdale Minor Ball<\/strong> because Alex applied for a tryout with 12U AAA 2026-27\.<br>\s*Reply to this email to reach Riverdale Minor Ball\./);
    assert.doesNotMatch(tryout, /nsubscribe/);
    const email = readCode('lib/email.ts');
    assert.match(email, /\$\{input\.playerFirstName\} was registered for \$\{input\.seasonName\}/);
    assert.match(email, /\$\{input\.playerFirstName\} applied for a tryout with \$\{input\.teamName\} \$\{input\.yearName\}/);
  });
  it('the footnote escapes what a family typed', () => {
    const html = accountNoticeFootnoteHtml({ clubName: 'A <b>Club</b>', reason: 'Al <i>x</i> was registered for S', replyLine: null });
    assert.doesNotMatch(html, /<b>|<i>/);
  });
  it('the family envelope puts the reply line between the reason and the unsubscribe link, and drops an eyebrow that repeats the band', () => {
    const code = readCode('lib/family-email.ts');
    assert.match(code, /\$\{footer\.sentBy\}<br>\s*\$\{reply\}<a href="\$\{unsubscribeUrl\}"/);
    assert.match(code, /eyebrowRepeatsBand\(content\.teamName, content\.club\.name\)/);
    assert.match(code, /familySenderName\(content\.club\.name\)/);
  });
  it('the eyebrow rule: dropped when it is the club’s name, kept for a team or a season', () => {
    assert.equal(eyebrowRepeatsBand('Riverdale Minor Ball', 'Riverdale Minor Ball'), true);
    assert.equal(eyebrowRepeatsBand('  riverdale   minor ball ', 'Riverdale Minor Ball'), true);
    assert.equal(eyebrowRepeatsBand('Ridge 11U', 'Riverdale Minor Ball'), false);
    assert.equal(eyebrowRepeatsBand('Fall 2026', 'Riverdale Minor Ball'), false);
  });
});

describe('S3b — a dues reminder wears the club', () => {
  const club: ClubEmailFacts = { name: 'Riverdale Minor Ball', themePrimary: '#075985', themeAccent: '#38BDF8' };
  const dues = duesReminderEmail({
    teamName: 'Ridge 11U', orgName: club.name, window: 7, guardianFirst: 'Sam', club,
    replyLine: "Replies to this email won't reach anyone. To get in touch, contact Riverdale Minor Ball directly.",
    items: [{ playerFirstName: 'Ava', playerLastName: 'Lee', amount: 100, remainingAmount: 100, dueDate: '2026-11-01', installmentNumber: 1, totalInstallments: 3 }],
  });
  it('has the band, the legal sentence, the reply line and the platform line, in that order', () => {
    const h = dues.html;
    const order = ['class="fl-band"', 'Hi Sam,', 'sent even if you', "Replies to this email won't reach anyone", 'Sent through'].map(s => h.indexOf(s));
    assert.ok(order.every(i => i > 0), JSON.stringify(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.doesNotMatch(h, /\$\{|undefined|NaN/);
  });
  it('the module stays pure: nothing server-only enters the dues email', () => {
    const code = readCode('lib/dues-reminder-email.ts');
    assert.doesNotMatch(code, /server-only|supabase|from '\.\/db'|from '\.\/email'|club-email-context/);
  });
});

describe('S3b — the words (copy items 10, 11)', () => {
  const email = readCode('lib/email.ts');
  /** One builder's source, from its `export function` to the next one. */
  const builder = (name: string) => {
    const at = email.indexOf(`export function ${name}(`);
    assert.ok(at >= 0, name);
    return email.slice(at, email.indexOf('\nexport function ', at + 10));
  };
  // Club Tier 9b-1 (Part 6): the three public-form notices became ONE sign-up email (its headline comes from
  // lib/league-signup.ts signupHeadline); the family reads "accepted", never "approved" (9b·12).
  it('the house-league headlines are sentence case with no emoji', () => {
    const headlines: [string, string, string][] = [
      ['leagueAdminApprovedHtml', '${p.playerFirstName} is accepted', 'Registration Approved!'],
      ['leagueAdminWaitlistedHtml', 'Added to the waitlist', 'Added to Waitlist'],
      ['leagueWaitlistPromotedHtml', 'A spot opened for ${p.playerFirstName}', "You're Off the Waitlist!"],
      ['leagueRegistrationDeclinedHtml', 'Registration update', 'Registration Update'],
      ['leagueSignupHtml', '${escapeEmailHtml(signupHeadline(kids))}', 'Registration Approved!'],
    ];
    for (const [name, now, old] of headlines) {
      const src = builder(name);
      assert.ok(src.includes(`margin:0 0 1rem;">${now}</h2>`), `${name}: ${now}`);
      assert.ok(!src.includes(old), `${name} still says “${old}”`);
      assert.doesNotMatch(src, /✅|🎉/u, `${name} still has an emoji`);
    }
    // the coach-facing tournament registration email is not a family email and keeps its own headline
    assert.ok(builder('registrationConfirmationHtml').includes('margin:0 0 1rem;">Registration Received!</h2>'));
  });
  it('the game-change link loses its arrow and stays an olive text link', () => {
    const code = readCode('lib/family-notify.ts');
    assert.match(code, /label: 'See the full schedule' \}/);
    assert.doesNotMatch(code, /See the full schedule →/);
  });
  it('the declined email names the club (and its address when it has one), not the platform’s inbox', () => {
    assert.match(email, /Please contact \$\{club \? `\$\{club\} at ` : ''\}<a href="mailto:\$\{contact\}"/);
    assert.match(email, /`Please contact \$\{club\} for more information\.`/);
  });
  it('no help article still quotes an old headline or the arrow', () => {
    const help = ['lib/help-content/org.tsx', 'lib/help-content/coaches.tsx', 'lib/help-content/admin.tsx'];
    for (const f of help) {
      let code = '';
      try { code = readCode(f); } catch { continue; }
      for (const old of ['Registration Approved!', "You're Off the Waitlist!", 'Added to Waitlist', 'See the full schedule →']) assert.ok(!code.includes(old), `${f} quotes “${old}”`);
    }
  });
});

describe('S3b — the senders thread the club', () => {
  it('the five family emails go through the choke point with a club and a reply line', () => {
    const sites: [string, RegExp][] = [
      ['lib/families-email.ts', /club, replyLine: reply\.line/],
      ['app/api/admin/families/[personId]/message/route.ts', /club,\s*replyLine: reply\.line/],
      ['lib/rep-team-announcements.ts', /club, replyLine: reply\.line/],
      ['app/api/admin/house-league/seasons/[seasonId]/email/route.ts', /club,\s*replyLine: reply\.line/],
      ['lib/family-notify.ts', /club: face\?\.club,\s*replyLine: face\?\.replyLine/],
    ];
    for (const [f, re] of sites) assert.match(readCode(f), re, f);
  });
  it('the dues senders (the sweep, the coach route, the admin wave) pass the club and keep the raw transport on purpose', () => {
    for (const f of ['lib/dues-reminders.ts', 'app/api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders/route.ts', 'app/api/admin/rep-teams/dues/send-automated-reminders/route.ts']) {
      const code = readCode(f);
      assert.match(code, /club: face\?\.club/, f);
      assert.match(code, /face\?\.sendOpts/, `${f}: Reply-To and the sender name travel together`);
      assert.doesNotMatch(code, /sendFamilyEmail/, `${f}: dues mail is transactional and stays outside the family guard`);
    }
  });
  it('the registration emails and the tryout receipt pass their face, and name the sender', () => {
    for (const f of ['app/api/league/[orgSlug]/[seasonSlug]/register/route.ts', 'app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts',
      'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts']) {
      const code = readCode(f);
      assert.match(code, /systemMailFace\(/, f);
      assert.match(code, /family: /, `${f} hands the face to the send`);
    }
    assert.match(readCode('lib/platform-email-templates.ts'), /fromName: familySenderName\(opts\.family\.face\.club\.name\)/);
  });
  it('a customised template wears the band and the foot too; the operator’s words stay theirs', () => {
    const code = readCode('lib/platform-email-templates.ts');
    assert.match(code, /\.\.\.familyTemplateParts\(opts\.family\),\s*heading: row\.heading,\s*body: bodyWithCta\(row\)/);
  });
  it('the template editor’s preview and test-send show the six family keys on a sample club', () => {
    for (const key of ['league_registration_approved', 'league_registration_pending', 'league_registration_waitlisted', 'league_waitlist_promoted', 'league_registration_declined', 'tryout_application_received']) {
      assert.ok(isFamilyTemplateKey(key), key);
      const s = familyTemplateSample(key)!;
      assert.equal(s.club.name, 'Riverdale Minor Ball');
      assert.match(s.footerHtml, /Sent by <strong>Riverdale Minor Ball<\/strong> because /);
    }
    assert.equal(familyTemplateSample('billing_receipt'), null, 'other keys keep the plain card');
    assert.equal(isFamilyTemplateKey('toString'), false);
  });
  it('the sender name reaches both transports; a non-family send passes none', () => {
    const fam = readCode('lib/family-email.ts');
    assert.match(fam, /fromName: familyFromName\(params\.content\)/, 'one send');
    assert.match(fam, /const fromName = familyFromName\(params\.content\);/, 'a batch works the name out once');
  });
});

describe('S3b — the sample and the email show the same band', () => {
  it('Families’ “See the email” draws its band from clubBand(), the one the envelope draws from', () => {
    const parts = readCode('components/admin/kit/club/SendParts.tsx');
    assert.match(parts, /const b = clubBand\(club\);/);
    for (const field of ['b.fill', 'b.onFill', 'b.accent', 'b.tileBackground', 'b.tileInk', 'b.logo', 'b.initials', 'b.name']) assert.ok(parts.includes(field), field);
    assert.match(readCode('lib/email-envelope-warm.ts'), /const band = clubBand\(club\);/);
    assert.match(parts, /platformLineWords\(clubName\)/);
    assert.match(readCode('lib/email-envelope-warm.ts'), /platformLineWords\(clubName\)/);
  });
  it('both windows draw the band and the reply line from the preview, and keep the kicker for a club that has no face', () => {
    for (const f of ['components/admin/kit/club/families/EmailFamiliesWindow.tsx', 'components/admin/kit/club/families/MessageFamilyWindow.tsx']) {
      const code = readCode(f);
      assert.match(code, /<SampleBand club=/, f);
      assert.match(code, /<SamplePlatformLine clubName=/, f);
      assert.match(code, /replyLine/, f);
    }
  });
  it('the same facts give the same band in the sample’s and the email’s eyes', () => {
    for (const [, facts] of DRAWN) {
      const html = warmEmailDocument('<p>x</p>', facts);
      const b = clubBand(facts);
      assert.ok(html.includes(`bgcolor="${b.fill}"`));
      assert.ok(html.includes(`color:${b.onFill};word-break`));
      assert.equal(html.includes('border-bottom:3px solid'), b.accent !== null);
    }
  });
  it('the dues preview reads the face from the route the real send reads it from, and waits for it rather than flashing a plain sample', () => {
    const modal = readCode('components/coaches/DuesReminderPreviewModal.tsx');
    assert.match(modal, /club-email-face/);
    assert.match(modal, /face === 'loading'/);
    assert.match(modal, /__html: warmEmailForPreview\(/, 'S3a’s rule: a page that shows an email strips the head');
    assert.match(readCode('app/api/coaches/[orgSlug]/club-email-face/route.ts'), /systemMailFace\(ctx\.org\)/);
  });
});
