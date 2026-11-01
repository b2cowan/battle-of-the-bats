import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { signupLinkClockRanOut } from '../../lib/house-league-access.ts';
import { isMaskedEmail, maskEmail } from '../../lib/utils.ts';
import { rowActions, signupChildren } from '../../lib/house-league-registrations.ts';
import { readLeaguePayToken, signLeaguePayToken } from '../../lib/league-pay-link.ts';
import type { LeagueRegistration } from '../../lib/types.ts';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SIGNED-IN FAMILY ACCOUNTS STAGE 1 — THE "YOUR SIGN-UP" LINK HAS ONE DOOR (build prompt Parts 1–4; rulings 2026-11-01
 * asks 1, 5, 6). The link can now be replaced (a version in its signature, mig 419) and ends 30 days after the club
 * marks the season finished unless money is still owed. That is only true if EVERY place that reads a family token asks
 * the one door (`openSignupLink`); a second reader would open a link the page refuses. The email-and-reference lookup
 * is gone: the reference opens nothing, and "Email me my link" sends the link to the inbox, never to the screen.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const DOOR = readCode('lib/league-signup-link.ts');
const PAGE = readCode('app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx');
const PAY = readCode('app/api/pay/league/[token]/route.ts');
const POLL = readCode('app/api/pay/league/[token]/status/route.ts');
const WITHDRAW = readCode('app/api/league/[orgSlug]/[seasonSlug]/withdraw-request/route.ts');
const EMAIL_ME = readCode('app/api/league/[orgSlug]/[seasonSlug]/email-my-link/route.ts');
const MAIL = readCode('lib/league-signup-link-mail.ts');

describe('one door reads a family token', () => {
  it('only the door reads a token: no page, route or module calls readLeaguePayToken itself', () => {
    const readers = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
      .filter(f => /readLeaguePayToken\(/.test(readCode(f)))
      .filter(f => f !== 'lib/league-pay-link.ts');
    assert.deepEqual(readers, ['lib/league-signup-link.ts']);
    assert.doesNotMatch(readCode('lib/league-pay-link.ts'), /registrationFromPayToken/, 'the bypass reader is gone');
  });
  it('every door asks it: the page, the checkout, the poll and the withdraw request', () => {
    assert.match(PAGE, /await openSignupLink\(token, \{ at: \{ orgId: org\.id, seasonId: season\.id \} \}\)/);
    assert.match(PAY, /const link = await openSignupLink\(token\);\s*if \(!link\.ok\)/);
    assert.match(WITHDRAW, /await openSignupLink\(token, \{ at: \{ orgId: org\.id, seasonId: season\.id \} \}\)/);
    // The poll alone passes the season's clock: a family who paid the last dollar still sees it confirmed.
    assert.match(POLL, /openSignupLink\(token, \{ afterCheckout: true \}\)/);
    // The poll matches the session to the sign-up the door opened, never to a registration it reads itself.
    assert.match(POLL, /op\.season_id !== link\.seasonId \|\| op\.signup_key !== link\.signupKey/);
    assert.doesNotMatch(POLL, /from\('league_registrations'\)/);
    for (const [name, src] of [['page', PAGE], ['pay', PAY], ['withdraw', WITHDRAW]] as const) {
      assert.doesNotMatch(src, /afterCheckout/, name);
    }
  });
  it('the rules run in order: signature and address, then the version, then the clock with what is owed', () => {
    const at = (s: string) => { const i = DOOR.indexOf(s); assert.ok(i > 0, s); return i; };
    assert.ok(at('readLeaguePayToken(token, secret)') < at("anchor.org_id !== opts.at.orgId"));
    assert.ok(at("anchor.org_id !== opts.at.orgId") < at("read.version !== Number(anchor.link_version ?? 0)"));
    assert.ok(at("read.version !== Number(anchor.link_version ?? 0)") < at('signupLinkClockRanOut(season)'));
    assert.match(DOOR, /signupLinkClockRanOut\(season\) && !\(await signupStillOwes\(anchor\.id, anchor\.season_id\)\)/);
    // A payment in flight counts as owing: a debit clearing, or a page open on Stripe.
    assert.match(DOOR, /c\.owingCents > 0 \|\| c\.clearingCents > 0/);
    assert.match(DOOR, /\.eq\('status', 'open'\)/);
  });
  it('every link minted anywhere signs with the anchor’s current version', () => {
    // Every minting call in the code, not a list: a new email that signs a literal would be refused as replaced the
    // moment the club resets the link. The one literal is the sign-up's own success screen and its confirmation email, for
    // a row made a moment ago in the same request.
    const minted = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
      .filter(f => f !== 'lib/league-pay-link.ts');
    let calls = 0;
    for (const f of minted) {
      for (const call of readCode(f).match(/leaguePay(?:Url|Token)\([^;]*;/g) ?? []) {
        calls += 1;
        if (f === 'app/api/league/[orgSlug]/[seasonSlug]/register/route.ts') assert.match(call, /leaguePayToken\(placedKids\[0\]\.id!, 0\)|registrationId: placedKids\[0\]\.id!, version: 0 \}\)/, call);
        // The club's reset signs the version it has just written to every child of the sign-up (Part 6).
        else if (f === 'lib/league-signup-link-mail.ts' && /registrationId, version \}\)!;$/.test(call)) assert.ok(readCode(f).includes('link_version: version,'), call);
        else assert.match(call, /version: (?:f|facts)\.linkVersion|version: Number\((?:reg|anchor)\.link_version \?\? 0\)|leaguePayToken\(registrationId, f\.linkVersion\)/, `${f}: ${call}`);
      }
    }
    assert.ok(calls >= 7, `found ${calls} minting calls`);
  });
});

describe('when the link ends (ask 1)', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
  it('a running season never closes a link', () => {
    assert.equal(signupLinkClockRanOut({ status: 'open', finished_at: null }, now), false);
    assert.equal(signupLinkClockRanOut(null, now), false);
  });
  it('a finished season keeps links for 30 days, then closes them (only money owed keeps one open)', () => {
    assert.equal(signupLinkClockRanOut({ status: 'completed', finished_at: daysAgo(10) }, now), false);
    assert.equal(signupLinkClockRanOut({ status: 'completed', finished_at: daysAgo(31) }, now), true);
    assert.equal(signupLinkClockRanOut({ status: 'archived', finished_at: daysAgo(400) }, now), true);
  });
  it('a reopened season (its finish time cleared) opens the links again', () => {
    assert.equal(signupLinkClockRanOut({ status: 'open', finished_at: null }, now), false);
  });
});

describe('the reference opens nothing; "Email me my link" sends to the inbox', () => {
  it('the email-and-reference lookup is gone', () => {
    assert.equal(existsSync('app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts'), false);
    assert.doesNotMatch(WITHDRAW, /refCode|guardian_email/);
  });
  it('the answer never carries a sign-up: one body, a time floor, whether or not anything was sent', () => {
    assert.match(EMAIL_ME, /return NextResponse\.json\(\{ ok: true \}\);/);
    assert.equal((EMAIL_ME.match(/NextResponse\.json\(\{ ok/g) ?? []).length, 1);
    assert.doesNotMatch(EMAIL_ME, /buildLeaguePayView|buildSignupStatus|leaguePayToken|leaguePayUrl|openSignupLink/);
    // Forgot password's floor, never a shorter local one: the match path reads the sign-ups AND sends (review 2026-11-01).
    assert.match(EMAIL_ME, /await holdUntilFloor\(started\);\s*return NextResponse\.json\(\{ ok: true \}\)/);
    assert.doesNotMatch(EMAIL_ME, /ANSWER_FLOOR_MS|holdUntilFloor\(started, /);
    // A failed send answers like a sent one.
    assert.match(EMAIL_ME, /catch \(e\) \{\s*console\.error\('\[email-my-link\] send failed:'/);
    assert.match(EMAIL_ME, /checkNoLoginRateLimit\('signup_link_email', req\)/);
    assert.match(EMAIL_ME, /throttlePublicFormRecipient\(email\)/);
  });
  it('it sends only links that would open, to the address typed, never a closed season’s', () => {
    assert.match(MAIL, /\.eq\('guardian_email', email\)/);
    // The door's own rule 3, never a copy of it: the same "still owes" (an open Stripe payment included).
    assert.match(MAIL, /!clockRanOut \|\| signupStillOwes\(kids\[0\]\.id, season\.id\)/);
    assert.doesNotMatch(MAIL, /owingCents|clearingCents/);
    // To the address typed, through the account-notice frame (the transactional door, never the unsubscribe list).
    assert.match(MAIL, /await sendLinkNotice\(org, \{\s*key: 'league_signup_link', to: email,/);
    assert.match(MAIL, /return sendTransactionalEmail\(\{\s*key: n\.key,\s*to: n\.to,/);
  });
});

describe('the family page names children by first name only', () => {
  it('no last name reaches the page, its pay block or its receipts', () => {
    assert.doesNotMatch(readCode('lib/league-signup-status.ts'), /playerLastName/);
    assert.doesNotMatch(readCode('app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx'), /playerLastName|lastName/);
    const view = readCode('lib/league-pay-view.ts');
    assert.doesNotMatch(view, /childName: `\$\{c\.firstName\} \$\{c\.lastName\}`/);
    assert.match(view, /label: firstNameLabel\(l\.description/);
    // The stored name never reaches the page (review 2026-11-01): a child renamed after paying, or a line with no
    // registration of this sign-up, kept its full stored name when the label matched by prefix.
    const label = view.slice(view.indexOf('export function firstNameLabel'), view.indexOf('function kindOf'));
    assert.match(label, /const rest = cut >= 0 \? label\.slice\(cut \+ 3\) : ''/);
    assert.doesNotMatch(label, /return label|startsWith|lastName/);
  });
  it('the pay route’s refusals name a child by first name: they reach the family’s browser as JSON', () => {
    assert.match(readCode('lib/league-pay-facts.ts'), /const name = first \? first\.firstName : '';/);
    const pay = readCode('app/api/pay/league/[token]/route.ts');
    // `who` (full names) is the club's record; the clearing answer the family reads gets first names.
    assert.equal((pay.match(/openSessionFor\(facts\.season\.id, facts\.signupKey, rail, fee\.totalCents, whoFirst,/g) ?? []).length, 2);
    assert.doesNotMatch(pay, /openSessionFor\([^)]*, who,/);
  });
  it('the withdraw note shows keyboard focus (ClubForm’s textarea), and a duplicate points at the link, not the reference', () => {
    const page = readCode('app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx');
    assert.match(page, /className=\{form\.textarea\}/);
    assert.doesNotMatch(page, /outline: 'none'/);
    assert.doesNotMatch(readCode('app/api/league/[orgSlug]/[seasonSlug]/register/route.ts'), /Use your reference/);
  });
});

describe('Part 5b (owner rulings 2026-11-01): first names on Stripe, the address masked on the family page', () => {
  it('Stripe’s checkout lines name each child by first name; the club’s record keeps the full description', () => {
    // From the child's own fields, never by re-parsing the club's description.
    assert.match(PAY, /name: \[c\?\.firstName, c\?\.divisionName, facts\.season\.name\]/);
    assert.doesNotMatch(PAY, /s\.description\.split\(' · '\)\.slice\(1\)/);
    assert.doesNotMatch(PAY, /name: `\$\{s\.description\}/);
    assert.match(PAY, /const description = \[who, facts\.season\.name\]\.join\(' · '\);/);
  });
  it('masks an address: first character, •••, the domain; a one-character name hidden whole', () => {
    assert.equal(maskEmail('maya.parent@gmail.com'), 'm•••@gmail.com');
    assert.equal(maskEmail('m@gmail.com'), '•••@gmail.com');
    assert.ok(isMaskedEmail(maskEmail('priya@example.ca')));
    assert.ok(!isMaskedEmail('priya@example.ca'));
    // A half-edited mask is still a mask (it would reach Stripe as a receipt address otherwise).
    assert.ok(isMaskedEmail('m••@gmail.com'));
    assert.ok(isMaskedEmail('m•@gmail.com'));
  });
  it('the [token] page and the pay block hand the browser only the masked address', () => {
    assert.match(PAGE, /emailShown=\{link\.rows\[0\]\?\.guardian_email \? maskEmail\(link\.rows\[0\]\.guardian_email\) : null\}/);
    assert.doesNotMatch(PAGE, /guardianEmail=/);
    assert.match(readCode('lib/league-pay-view.ts'), /payerEmail: f\.guardianEmail \? maskEmail\(f\.guardianEmail\) : null,/);
    // Left untouched, the field sends no address; a masked one sent anyway is refused as a receipt address.
    assert.match(readCode('components/public/LeaguePayBlock.tsx'), /email: email === pay\.payerEmail \? '' : email/);
    assert.match(PAY, /!isMaskedEmail\(body\.email\)/);
  });
});

describe('Part 6: the club’s "Send a new link" (drawing tab 4; asks 4 and 6)', () => {
  const REGS = readCode('lib/house-league-registrations.ts');
  const REG_ROUTE = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
  const SCREEN = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
  const kid = (over: Partial<LeagueRegistration>): LeagueRegistration => ({
    id: 'r1', playerFirstName: 'Maya', guardianEmail: 'p@x.ca', signupRef: 'ABC12345', status: 'active', ...over,
  } as LeagueRegistration);
  const RIGHTS = { register: true, takeFees: false, run: false, email: false };
  const OWING = { kind: 'owing', owing: 185 } as unknown as Parameters<typeof rowActions>[1];

  it('is offered to anyone who can change registrations, whatever the child’s status, while there is an email', () => {
    for (const status of ['pending_review', 'active', 'waitlisted', 'withdrawn', 'declined'] as const) {
      assert.ok(rowActions(kid({ status }), OWING, [], RIGHTS).all.includes('newLink'), status);
    }
    assert.ok(!rowActions(kid({}), OWING, [], { ...RIGHTS, register: false, takeFees: true }).all.includes('newLink'), 'not the desk alone');
    assert.ok(!rowActions(kid({ guardianEmail: ' ' }), OWING, [], RIGHTS).all.includes('newLink'), 'no email, no row');
  });
  it('covers the sign-up: the same reference AND family email (the door’s set), else the one child', () => {
    const all = [kid({}), kid({ id: 'r2', playerFirstName: 'Leo' }), kid({ id: 'r3', playerFirstName: 'Ava', guardianEmail: 'other@x.ca' })];
    assert.deepEqual(signupChildren(all[0], all).map(k => k.playerFirstName), ['Maya', 'Leo']);
    assert.deepEqual(signupChildren(kid({ signupRef: null }), all).map(k => k.id), ['r1']);
    // The menu hint and the confirm name the same children, through one helper.
    assert.match(SCREEN, /function signupKids\(reg: LeagueRegistration, all: readonly LeagueRegistration\[\]\) \{\s*const kids = signupChildren\(reg, all\);/);
    assert.match(SCREEN, /case 'newLink': return \{ key, label: M\.newLink\.label, hint: M\.newLink\.hint\(signupKids\(reg, read\?\.registrations \?\? \[\]\)\.names\) \};/);
    assert.match(SCREEN, /const newLinkFor = act\?\.kind === 'newLink' \? signupKids\(act\.reg, read\?\.registrations \?\? \[\]\) : null;/);
  });
  it('one update moves every child of the sign-up to the next version, so a sibling’s old link stops and the new one opens', () => {
    const reset = MAIL.slice(MAIL.indexOf('export async function replaceSignupLink('));
    assert.match(reset, /\.update\(\{ link_version: version, link_replaced_at: new Date\(\)\.toISOString\(\) \}\)\.in\('id', kids\.map\(k => k\.id\)\)/);
    assert.equal((reset.match(/\.update\(/g) ?? []).length, 1, 'one statement');
    assert.match(reset, /q\.eq\('signup_ref', anchor\.signup_ref as string\)\.eq\('guardian_email', anchor\.guardian_email as string\)/);
    // Refused BEFORE anything moves when no new link could be sent.
    assert.ok(reset.indexOf("return { error: 'no_secret' }") < reset.indexOf('.update('));
    assert.ok(reset.indexOf("return { error: 'no_email' }") < reset.indexOf('.update('));
    // After the update the old link is stopped: a send that throws is the plain "couldn't send", never a 500.
    assert.match(reset, /\}\)\.catch\(\(\) => null\);\s+return !sent \|\| sent\.status === 'provider_error' \? \{ error: 'send_failed' \}/);
    // The token layer: version n opens only at version n.
    const secret = 'test-secret';
    const SIB = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
    assert.equal(readLeaguePayToken(signLeaguePayToken(SIB, secret, 1), secret)?.version, 1);
    assert.equal(readLeaguePayToken(signLeaguePayToken(SIB, secret), secret)?.version, 0);
    assert.match(DOOR, /if \(read\.version !== Number\(anchor\.link_version \?\? 0\)\) return \{ ok: false, ended: 'replaced' \};/);
  });
  it('the route asks `register` first (a member without it is refused), and the history line has no actor', () => {
    const branch = REG_ROUTE.slice(REG_ROUTE.indexOf('if (body.newLink === true) {'));
    assert.match(branch, /^if \(body\.newLink === true\) \{\s*const refused = houseLeagueRefusal\(ctx, 'register', season\);\s*if \(refused\) return refused;/);
    assert.match(REGS, /add\(reg\.linkReplacedAt, H\.newLink\);/);
    assert.equal((REG_ROUTE.match(/sendLeaguePayLink\(/g) ?? []).length, 3, 'the pay link’s three callers, unchanged');
  });
});

describe('Part 7: no unsubscribe secret, no unsubscribe link', () => {
  it('signing returns no link and every token is refused without the secret; with it, a link round-trips', async () => {
    const T = await import('../../lib/unsubscribe-token.ts');
    const had = process.env.UNSUBSCRIBE_SECRET;
    try {
      delete process.env.UNSUBSCRIBE_SECRET;
      assert.equal(T.buildUnsubscribeUrl('org-1'), null);
      assert.equal(T.buildUserUnsubscribeUrl('user-1'), null);
      assert.equal(T.buildGuardianUnsubscribeUrl('org-1', 'p@x.ca'), null);
      assert.equal(T.verifyUnsubscribeToken('org-1', '0'.repeat(32)), false);
      process.env.UNSUBSCRIBE_SECRET = 'a-test-secret-of-some-length';
      const token = T.generateGuardianUnsubscribeToken('org-1', 'P@x.ca')!;
      assert.equal(T.verifyGuardianUnsubscribeToken('org-1', 'p@x.ca', token), true);
      assert.equal(T.verifyUnsubscribeToken('org-1', token), false, 'token families never cross');
    } finally {
      if (had === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = had;
    }
    assert.ok(!readCode('lib/unsubscribe-token.ts').includes('insecure-dev-fallback'));
    // The secret signs exactly as set: trimming it would change every token already in an inbox.
    assert.ok(!readCode('lib/unsubscribe-token.ts').includes('UNSUBSCRIBE_SECRET?.trim()'));
    // A marketing send that could carry no link is not sent; a family email draws none.
    assert.ok(readCode('lib/email-sender.ts').includes("suppressionReason: 'no_unsubscribe_secret'"));
    assert.ok(readCode('lib/family-email.ts').includes('${unsubscribeUrl ? `<a href="${unsubscribeUrl}"'));
  });
});
