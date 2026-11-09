import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  householdRecipients, onEveryRegistration, readSecondParentEmail, secondParentCopy, secondParentRefusalWords, secondParentsOf,
  SECOND_PARENT_WORDS as SP,
} from '../../lib/league-second-parent.ts';
import { matchesSearch } from '../../lib/house-league-registrations.ts';
import { withSecondParentStop, hasSecondParentStop } from '../../lib/league-second-parent-footer.ts';
import { verifySecondParentStopToken } from '../../lib/unsubscribe-token.ts';
import { warmEmailDocument } from '../../lib/email-envelope-warm.ts';
import { readCode, functionBody, filesUnder } from './_source-code.ts';

/**
 * Signed-in family accounts Stage 3, Parts 4–6 (build prompt SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md; asks 1–6 ruled A
 * 2026-11-03): every other email about the sign-up reaches the second parent, the club's screens and the coach read it.
 * BEHAVIOUR for the pure recipient rule, the greeting swap, the staff words and the list search; SOURCE GUARDS (comments
 * stripped) for the senders, routes and screens, which import server-only modules. Parts 1–3: league-second-parent.test.ts.
 */

describe('a household message reaches only a second parent who is on every sign-up it names (review 2026-11-03, security)', () => {
  it('one sign-up (every child carries the address): the second parent is reached', () => {
    assert.deepEqual(onEveryRegistration('priya@example.com', ['dev@example.com', 'DEV@example.com ']), ['dev@example.com']);
  });
  it('a stranger who typed the first address on their own sign-up gets none of the real family’s mail', () => {
    // The real family (no second parent) and an attacker's sign-up under the same first address, second = the attacker.
    assert.deepEqual(onEveryRegistration('victim@example.com', [null, 'attacker@example.com']), []);
    assert.deepEqual(onEveryRegistration('victim@example.com', ['attacker@example.com', null]), []);
  });
  it('two sign-ups with different second parents: neither second parent gets a message naming the other’s children', () => {
    assert.deepEqual(onEveryRegistration('priya@example.com', ['dev@example.com', 'gran@example.com']), []);
  });
  it('no second address anywhere, or an empty household, is nobody', () => {
    assert.deepEqual(onEveryRegistration('priya@example.com', [null, null]), []);
    assert.deepEqual(onEveryRegistration('priya@example.com', []), []);
  });
  it('the sender uses it (source guard)', () => {
    assert.match(functionBody(readCode('lib/league-second-parent-mail.ts'), 'sendSecondParentServiceCopies'), /onEveryRegistration\(h\.firstEmail, /);
  });
});

describe('the staff paths refuse a too-long address in words, not at the database CHECK (review 2026-11-03)', () => {
  it('201 characters is invalid; 200 is fine', () => {
    const long = (n: number) => `${'a'.repeat(n - '@example.com'.length)}@example.com`;
    assert.deepEqual(readSecondParentEmail(long(200), 'priya@example.com'), { email: long(200) });
    assert.deepEqual(readSecondParentEmail(long(201), 'priya@example.com'), { refusal: 'invalid' });
  });
  it('the staff edit is confined to the sign-up: its reference AND its first email, inside the org', () => {
    const R = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(R, /q\.eq\('signup_ref', reg\.signupRef\)\.eq\('guardian_email', reg\.guardianEmail \?\? ''\)\.eq\('org_id', ctx!\.org\.id\)/);
  });
});

describe('the one recipient rule (behaviour)', () => {
  it('the first parent first, then each distinct second address, capitals and spaces ignored', () => {
    assert.deepEqual(householdRecipients('Priya@Example.com', [{ guardianEmail2: ' Dev.Shah@example.com ' }]), ['priya@example.com', 'dev.shah@example.com']);
  });
  it('no second address is the first parent alone', () => {
    assert.deepEqual(householdRecipients('priya@example.com', [{ guardianEmail2: null }, {}]), ['priya@example.com']);
  });
  it('siblings carrying the same second address reach it once', () => {
    assert.deepEqual(householdRecipients('priya@example.com', [{ guardianEmail2: 'dev@example.com' }, { guardianEmail2: 'DEV@example.com' }]), ['priya@example.com', 'dev@example.com']);
  });
  it('a second address equal to the first never repeats', () => {
    assert.deepEqual(householdRecipients('priya@example.com', [{ guardianEmail2: 'PRIYA@example.com' }]), ['priya@example.com']);
  });
  it('secondParentsOf is only the second parents', () => {
    assert.deepEqual(secondParentsOf('priya@example.com', [{ guardianEmail2: 'dev@example.com' }, { guardianEmail2: 'priya@example.com' }]), ['dev@example.com']);
    assert.deepEqual(secondParentsOf(null, [{ guardianEmail2: 'dev@example.com' }]), ['dev@example.com']);
    assert.deepEqual(secondParentsOf('priya@example.com', []), []);
  });
});

describe('the second parent’s copy greets "Hi," (behaviour, on the builders’ two greeting shapes)', () => {
  it('"Hi <strong>name</strong>," — the status and placement builders; only the first greeting', () => {
    assert.equal(secondParentCopy('<h1>x</h1><p>Hi <strong>Priya</strong>,</p><p>Hi <strong>Again</strong>,</p>'), '<h1>x</h1><p>Hi,</p><p>Hi <strong>Again</strong>,</p>');
  });
  it('"Hi name," with attributes, an escaped name or a comma in it — the schedule and practice builders', () => {
    assert.equal(secondParentCopy('<p style="margin:0">Hi Priya &amp; Raj,</p>'), '<p style="margin:0">Hi,</p>');
    assert.equal(secondParentCopy('<p>Hi Smith, Jr,</p><p>body</p>'), '<p>Hi,</p><p>body</p>');
  });
  it('an email already greeting "Hi," is unchanged, and the body is never touched', () => {
    assert.equal(secondParentCopy('<p>Hi,</p><p>Hi there friend</p>'), '<p>Hi,</p><p>Hi there friend</p>');
  });
  it('every builder a fan-out sender uses greets in one of those two shapes (source guard)', () => {
    const E = readCode('lib/email.ts');
    for (const name of ['leagueAdminApprovedHtml', 'leagueAdminWaitlistedHtml', 'leagueWaitlistPromotedHtml', 'leagueRegistrationDeclinedHtml',
      'leagueRegistrationWithdrawnHtml', 'leagueSpotReleasedHtml', 'leagueTeamsPlacedHtml', 'leagueTeamMovedHtml']) {
      assert.match(functionBody(E, name), /<p>Hi <strong>\$\{p\.guardianFirstName\}<\/strong>,<\/p>/, `${name} greets "Hi <strong>name</strong>,"`);
    }
    for (const name of ['leagueScheduleNoticeHtml', 'leaguePracticesChangedHtml']) {
      assert.match(functionBody(E, name), /<p>\$\{p\.greeting\}<\/p>/, `${name} greets with its caller's "Hi name,"`);
    }
  });
});

describe('staff words (behaviour)', () => {
  it('the same refusal in the parent’s words and in staff words', () => {
    assert.equal(secondParentRefusalWords('same', 'parent'), SP.sameAsYours);
    assert.equal(secondParentRefusalWords('same', 'club'), 'That’s the same as the first email. Leave it empty or enter the other parent’s.');
    assert.equal(secondParentRefusalWords('invalid', 'club'), SP.invalid);
    assert.equal(SP.staff.row, 'Second parent');
    assert.equal(SP.staff.none, '—');
  });
});

describe('the list search (behaviour)', () => {
  it('finds a registration by its second parent’s email', () => {
    const reg = { playerFirstName: 'Aarav', playerLastName: 'Shah', guardianFirstName: 'Priya', guardianLastName: 'Shah', guardianEmail: 'priya@example.com', guardianEmail2: 'dev.shah@example.com' };
    assert.ok(matchesSearch(reg as never, 'dev.shah'));
    assert.ok(!matchesSearch({ ...reg, guardianEmail2: null } as never, 'dev.shah'));
  });
});

const MAIL = readCode('lib/league-second-parent-mail.ts');
const REG_ROUTE = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');

describe('the sending module (source guard)', () => {
  it('the second copy is the built-in email, its own message, with its own once-only key', () => {
    const body = functionBody(MAIL, 'sendSecondParentTransactional');
    assert.match(body, /builtInOnly: true, defaultHtml: secondCopyHtml\(opts\.defaultHtml, opts\.key, orgId, to\)/);
    assert.match(body, /idempotencyKey: `\$\{opts\.idempotencyKey\}:second:\$\{to\}`/);
    assert.match(body, /catch \(e\)/);
    assert.ok(!/\bcc\b/i.test(MAIL), 'never a Cc');
  });
  it('it follows only a first copy that went, and sends as its own batch after the first', () => {
    assert.match(functionBody(MAIL, 'sendTransactionalToBothParents'), /if \(went\(first\)\) await sendSecondParentTransactional\(reg, opts, orgId\)/);
    const svc = functionBody(MAIL, 'sendSecondParentServiceCopies');
    assert.match(svc, /filter\(\(\{ i \}\) => went\(params\.results\[i\]\)\)/);
    assert.match(svc, /sendFamilyServiceBatch\(/);
    assert.ok(!/recordOutcome|reached_count|family_count|\.update\(/.test(svc), 'it never writes a row, a status or a count');
  });
});

describe('every census sender reaches the second parent through the module (source guard)', () => {
  it('accepted, waitlisted, moved off the waitlist, released / declined / withdrawn', () => {
    assert.match(functionBody(REG_ROUTE, 'emailPromoted'), /sendTransactionalToBothParents\(next, \{\s*key: 'league_waitlist_promoted'/);
    assert.match(REG_ROUTE, /sendTransactionalToBothParents\(reg, \{\s*key: 'league_registration_approved'/);
    assert.match(REG_ROUTE, /sendTransactionalToBothParents\(reg, \{\s*key: 'league_registration_waitlisted'/);
    // The ending email: the first parent's send decides the refund's "Family emailed" stamp; the copy follows it.
    const at = REG_ROUTE.indexOf('const firstSent = await sendTransactionalEmail(ending)');
    assert.ok(at > 0);
    const after = REG_ROUTE.slice(at, at + 600);
    assert.ok(after.indexOf('stampRefundEmailed(cardRefundIds, true)') < after.indexOf('sendSecondParentTransactional(reg, ending, ctx!.org.id)'));
    assert.match(after, /if \(went\(firstSent\)\) await sendSecondParentTransactional\(reg, ending, ctx!\.org\.id\)/);
  });
  it('"Your sign-up" link: a new link reaches both; "Email me my link" answers a second parent at their own address', () => {
    const L = readCode('lib/league-signup-link-mail.ts');
    const replace = functionBody(L, 'replaceSignupLink');
    assert.match(replace, /if \(went\(sent\)\) \{\s*for \(const to of secondParentsOf\(email, kids\.map\(/);
    assert.match(replace, /first: null, secondParent: true/);
    const own = functionBody(L, 'sendSignupLinks');
    assert.match(own, /scope\(\)\.eq\('guardian_email', email\), scope\(\)\.eq\('guardian_email_2', email\)/);
    assert.ok(!/\.or\(/.test(own), 'never an or-string built from typed text');
  });
  it('the pay link reaches both — but not the refund’s answer, which carries a refund block', () => {
    const P = functionBody(readCode('lib/online-payment-receipt.ts'), 'sendLeaguePayLink');
    assert.match(P, /if \(!refunded && went\(result\)\) \{\s*const seconds = await readSecondParents\(/);
    assert.ok(P.indexOf('pay_link_sent_at') < P.indexOf('readSecondParents('), 'after the stamp');
  });
  it('placement, schedule, practice times and practice changes send the second parents’ copies', () => {
    const files: [string, RegExp][] = [
      ['lib/house-league-placement-mail.ts', /sendSecondParentServiceCopies\(\{\s*kind: 'house_league_placement'/],
      ['lib/league-schedule-mail.ts', /sendSecondParentServiceCopies\(\{\s*kind, /],
      ['lib/league-practice-tell-server.ts', /sendSecondParentServiceCopies\(\{\s*kind: 'house_league_practice_times'/],
      ['lib/club-schedule-league-mail.ts', /sendSecondParentServiceCopies\(\{\s*kind: 'house_league_practice_change'/],
    ];
    for (const [file, re] of files) assert.match(readCode(file), re, file);
  });
  it('a season’s "Email families" (its one-household door and its resend too) reaches the second address, as one family', () => {
    const A = functionBody(readCode('lib/families-audience.ts'), 'familyAudience');
    assert.match(A, /secondParentsOf\(null, rows\.map\(r => \(\{ guardianEmail2: r\.secondParentEmail \?\? null \}\)\)\)/);
    assert.match(A, /families\.push\(\{ \.\.\.family, addresses: reachable \}\)/, 'one family, several addresses');
    assert.match(A, /filter\(a => !suppressed\.has\(a\)\)/, 'suppression stays per address');
    assert.match(functionBody(readCode('lib/families-read.ts'), 'loadHouseholdReach'), /if \(opts\.seasonId\) \{/);
    const F = readCode('lib/families-email.ts');
    assert.match(F, /loadHouseholdReach\(ctx\.org\.id, personId, \{ attach: true, seasonId: season\?\.id \?\? null \}\)/);
    assert.match(functionBody(F, 'resendMissedFamilies'), /\.\.\.secondsOf\(id\)/);
  });
});

describe('receipts, refunds and bank-debit mail stay with whoever paid; consent never takes the second address (source guard)', () => {
  const SECOND = /secondParent|SecondParent|guardian_email_2|guardianEmail2/;
  it('the receipt, the refund email and the bank-debit email never reach the second address', () => {
    assert.ok(!SECOND.test(functionBody(readCode('lib/online-payment-receipt.ts'), 'sendLeagueReceipt')));
    assert.ok(!SECOND.test(readCode('lib/online-refund-email.ts')));
    assert.ok(!SECOND.test(readCode('lib/bank-debit-email.ts')));
  });
  it('the marketing consent never reads it', () => {
    assert.ok(!SECOND.test(functionBody(readCode('lib/org-people.ts'), 'recordLeagueMarketingConsent')));
  });
});

describe('the club screens and the coach (source guard)', () => {
  it('the record window: a "Second parent" row under Email, edited by the desk, through the one reader, sending nothing', () => {
    const W = readCode('components/admin/kit/club/league/registrations/RegistrationRecordWindow.tsx');
    const at = W.indexOf('[F.email,');
    assert.ok(at > 0 && W.indexOf('[SP.row, <SecondParentFact', at) > at, 'right under Email');
    assert.match(readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx'), /onSecondEmail=\{rights\.register \? async value =>/);
    const from = REG_ROUTE.indexOf("if ('guardianEmail2' in body)");
    assert.ok(from > 0);
    const edit = REG_ROUTE.slice(from, REG_ROUTE.indexOf('return NextResponse.json({ registration', from));
    assert.match(edit, /houseLeagueRefusal\(ctx, 'register', season\)/);
    assert.match(edit, /readSecondParentEmail\(/);
    assert.match(edit, /secondParentRefusalWords\(second\.refusal, 'club'\)/);
    assert.match(edit, /reg\.signupRef \? q\.eq\('signup_ref', reg\.signupRef\)\.eq\('guardian_email', reg\.guardianEmail \?\? ''\)\.eq\('org_id', ctx!\.org\.id\) : q\.eq\('id', regId\)/, 'the whole sign-up');
    assert.ok(!/send\w*Email|sendLeaguePayLink|Copies/.test(edit), 'a staff edit sends nothing');
  });
  it('the first email changed to the second parent’s is refused in words before the database refuses it', () => {
    const first = REG_ROUTE.slice(REG_ROUTE.indexOf("if ('guardianEmail' in body)"), REG_ROUTE.indexOf("if ('guardianEmail2' in body)"));
    const refuse = first.indexOf('SECOND_PARENT_WORDS.staff.firstIsSecond');
    assert.ok(refuse > 0 && refuse < first.indexOf('.update({ guardian_email: next'));
  });
  it('"Add registration" has the box, and the route reads it the same way; the server search matches it', () => {
    assert.match(readCode('components/admin/kit/club/league/registrations/AddRegistrationWindow.tsx'), /text\('guardianEmail2', SECOND_PARENT_WORDS\.label, \{ type: 'email' \}\)/);
    const add = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts');
    assert.match(add, /readSecondParentEmail\(typeof body\.guardianEmail2 === 'string' \? body\.guardianEmail2 : null, guardianEmail\)/);
    assert.match(add, /guardianEmail2: second\.email,/);
    assert.match(add, /guardian_email_2\.ilike\.%\$\{s\}%/);
  });
  it('the export column sits beside Guardian Email and is private the same way', () => {
    const X = readCode('components/admin/kit/club/league/registrations/registrationsExport.ts');
    assert.match(X, /\{ label: 'Guardian Email', key: 'guardianEmail',\s+format: 'text', sensitive: true \},\s*\{ label: 'Second Parent Email', key: 'guardianEmail2', format: 'text', sensitive: true \}/);
  });
  it('the coach’s page mails and copies both parents through the one rule', () => {
    const C = readCode('app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx');
    assert.match(C, /page\.players\.flatMap\(p => householdRecipients\(p\.guardianEmail, \[p\]\)\)/);
    assert.match(C, /href=\{`mailto:\$\{both\.join\(','\)\}`\}/);
  });
});

describe('the Stop button: every second-parent send path carries it, no first-parent path does (Stage 3b, Part 4)', () => {
  const FOOTER = readCode('lib/league-second-parent-footer.ts');
  const REG = readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts');
  const LINKS = readCode('lib/league-signup-link-mail.ts');
  const PAY = readCode('lib/online-payment-receipt.ts');

  it('ONE footer builder, whose link comes from the token and whose words come from SECOND_PARENT_WORDS', () => {
    assert.match(FOOTER, /buildSecondParentStopUrl\(orgId, to\)/);
    assert.match(FOOTER, /W\.footer\.lead/);
    assert.match(FOOTER, /W\.stop\.button/);
    assert.match(FOOTER, /if \(!url\) return '';/, 'no secret, no link, no footer');
    assert.match(FOOTER, /insertAtWarmCardEnd\(html, footer\)/, 'inside the card, before its end');
    // The footer only DRAWS the link; the stop is the removal, so nothing here (or in a sender) reads the stop table.
    assert.ok(!/second_parent_stops|supabase/.test(FOOTER));
  });

  it('only these five files draw it: the shared module, the register route, the pay link, the sign-up-link notices and the placement re-send', () => {
    const users = [...filesUnder('lib', '.ts'), ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => f !== 'lib/league-second-parent-footer.ts')
      .filter(f => /withSecondParentStop\(|secondParentStopFooterHtml\(/.test(readCode(f)))
      .sort();
    assert.deepEqual(users, [
      'app/api/league/[orgSlug]/[seasonSlug]/register/route.ts',
      'lib/house-league-placement-mail.ts',
      'lib/league-second-parent-mail.ts',
      'lib/league-signup-link-mail.ts',
      'lib/online-payment-receipt.ts',
    ]);
  });

  it('the shared point: both second-parent paths splice it in, per recipient, through the one copy function', () => {
    assert.match(MAIL, /return withSecondParentStop\(copy, orgId, to\);/);
    assert.match(functionBody(MAIL, 'sendSecondParentTransactional'), /secondCopyHtml\(opts\.defaultHtml, opts\.key, orgId, to\)/);
    assert.match(functionBody(MAIL, 'sendSecondParentServiceCopies'), /secondCopyHtml\(h\.message\.html, params\.kind, params\.orgId, to\)/);
    // The first parent's send in the same module is the caller's message, untouched.
    assert.match(functionBody(MAIL, 'sendTransactionalToBothParents'), /const first = await sendTransactionalEmail\(opts\);/);
    assert.ok(!/withSecondParentStop/.test(functionBody(MAIL, 'sendTransactionalToBothParents')));
  });

  it('every caller of the shared point names the club, so the link is signed on club + address', () => {
    for (const f of ['lib/club-schedule-league-mail.ts', 'lib/league-practice-tell-server.ts', 'lib/house-league-placement-mail.ts', 'lib/league-schedule-mail.ts']) {
      assert.match(readCode(f), /sendSecondParentServiceCopies\(\{\s*(?:kind: '[a-z_]+'|kind), orgId: (?:p\.)?org\.id,/, f);
    }
    assert.equal((REG_ROUTE.match(/\}, (?:ctx!\.)?org\.id\);/g) ?? []).length, 3, 'approve, waitlist, promote');
    assert.match(REG_ROUTE, /sendSecondParentTransactional\(reg, ending, ctx!\.org\.id\)/);
  });

  it('bypass 1: the register route draws it on the second parent’s confirmation only, and the line knows if there is a button', () => {
    assert.match(REG, /copy\.secondParentLine \? withSecondParentStop\(html, org\.id, copy\.to\) : html/);
    assert.match(REG, /defaultHtml: withSecondParentCopy\(leagueSignupHtml\(/);
    assert.match(REG, /stop: hasSecondParentStop\(org\.id, guardianEmail2\)/);
  });

  it('bypass 2: the pay link draws it on the second parents’ loop, not on the first parent’s send', () => {
    assert.match(PAY, /await sendEmail\(to, L\.subject\(names, facts\.season\.name\), withSecondParentStop\(html, facts\.org\.id, to\),/);
    assert.match(PAY, /await sendEmail\(facts\.guardianEmail, L\.subject\(names, facts\.season\.name\), html,/);
  });

  it('bypass 3: the sign-up-link notices draw it on the second parent’s notice only', () => {
    assert.match(functionBody(LINKS, 'sendLinkNotice'), /const html = n\.secondParent \? withSecondParentStop\(built, org\.id, n\.to\) : built;/);
  });

  it('bypass 4 (Stage 4a): the placement re-send to ONE address draws it on the second parent’s form only', () => {
    const R = functionBody(readCode('lib/house-league-placement-mail.ts'), 'resendPlacementInvitation');
    assert.match(R, /role === 'first'\s*\? fillInvitationSlots\(html, await mailer\.firstFill\(email, asMail\)\)\s*: await mailer\.finishSecondCopy\(email, withSecondParentStop\(secondParentCopy\(html\), params\.orgId, email\)/);
    // It sends to the one address it was asked for, never the household's other parent.
    assert.match(R, /messages\.push\(\{\s*to: email,/);
    assert.ok(!/readSecondParents|secondParentsOf|onEveryRegistration/.test(R));
  });

  it('"Email families" keeps its own per-address unsubscribe and takes none of this', () => {
    for (const f of ['lib/families-email.ts', 'lib/families-audience.ts']) assert.ok(!/withSecondParentStop|secondParentStopFooterHtml/.test(readCode(f)), f);
    assert.match(readCode('lib/families-audience.ts'), /suppressed/);
  });

  it('behaviour: the footer sits inside the card before its end, once, signed on club + address; absent without the secret', () => {
    const had = process.env.UNSUBSCRIBE_SECRET;
    try {
      process.env.UNSUBSCRIBE_SECRET = 'a-test-secret-of-some-length';
      const html = '<table><tr><td><p>Hi,</p>\n<!--fl-card-end-->\n</td></tr></table>';
      const out = withSecondParentStop(html, 'org-1', 'Dev@Example.com');
      assert.equal((out.match(/second-parent-stop\?/g) ?? []).length, 1);
      assert.ok(out.indexOf('second-parent-stop?') < out.indexOf('<!--fl-card-end-->'));
      assert.ok(out.includes(`>${SP.stop.button}</a>`) && out.includes(SP.footer.lead));
      const url = out.match(/href="([^"]+)"/)![1].replace(/&amp;/g, '&');
      const q = new URL(url).searchParams;
      assert.equal(q.get('org'), 'org-1');
      assert.equal(q.get('email'), 'dev@example.com');
      assert.equal(verifySecondParentStopToken('org-1', q.get('email')!, q.get('token')!), true);
      assert.equal(verifySecondParentStopToken('org-2', q.get('email')!, q.get('token')!), false, 'another club’s sign-ups are out of reach');
      assert.equal(hasSecondParentStop('org-1', 'dev@example.com'), true);
      delete process.env.UNSUBSCRIBE_SECRET;
      assert.equal(withSecondParentStop(html, 'org-1', 'dev@example.com'), html, 'no secret, no link, nothing changed');
      assert.equal(hasSecondParentStop('org-1', 'dev@example.com'), false);
    } finally {
      if (had === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = had;
    }
  });
});

describe('the Stop button: gaps the build can hold (review 2026-11-06)', () => {
  it('a second parent’s link notice is the built-in email, so a stored template can never drop the greeting or the footer', () => {
    assert.match(functionBody(readCode('lib/league-signup-link-mail.ts'), 'sendLinkNotice'), /builtInOnly: n\.secondParent === true,/);
  });

  it('CENSUS: the only files that can address a second parent are the ones the footer decision covers', () => {
    // A NEW file that reads a second address as a recipient fails here, so its author decides: carry the Stop footer (add the
    // file to the four above), or say why not (add it to the second list).
    const WITH_FOOTER = ['lib/league-second-parent-mail.ts', 'lib/league-signup-link-mail.ts', 'lib/online-payment-receipt.ts'];
    const NOT_A_SEND_OR_ITS_OWN_OUT = [
      'app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx', // a mailto: link on the coach's page; sends nothing
      'lib/families-audience.ts', 'lib/families-email.ts', 'lib/families-read.ts', // "Email families": its own per-address unsubscribe
      'lib/league-second-parent.ts', // the recipient rule itself
    ];
    const users = [...filesUnder('lib', '.ts'), ...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => /secondParentsOf\(|readSecondParents\(|onEveryRegistration\(|householdRecipients\(/.test(readCode(f)))
      .sort();
    assert.deepEqual(users, [...WITH_FOOTER, ...NOT_A_SEND_OR_ITS_OWN_OUT].sort());
  });

  it('behaviour: over a real envelope (plain and club-banded) the footer is the last thing inside the card, once', () => {
    const had = process.env.UNSUBSCRIBE_SECRET;
    try {
      process.env.UNSUBSCRIBE_SECRET = 'a-test-secret-of-some-length';
      const doc = warmEmailDocument('<p>Hi,</p><p>Body</p>');
      assert.ok(doc.includes('<!--fl-card-end-->'), 'the envelope still carries its card-end marker');
      const out = withSecondParentStop(doc, 'org-1', 'dev@example.com');
      assert.equal((out.match(/second-parent-stop\?/g) ?? []).length, 1);
      assert.ok(out.indexOf('second-parent-stop?') > out.indexOf('Body') && out.indexOf('second-parent-stop?') < out.indexOf('<!--fl-card-end-->'));
    } finally {
      if (had === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = had;
    }
  });
});
