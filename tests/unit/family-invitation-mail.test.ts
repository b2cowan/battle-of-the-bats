import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptUrl, connectedLineHtml, EMPTY_FILL, fillInvitationSlots, FAMILY_HOME_PATH, INVITE_PANEL_SLOT, INVITE_WHO_SLOT, moneyBlock,
  invitationPanelHtml, repInvitationHtml, secondSenderFootnote, whoAddedHtml, type MailChild,
} from '../../lib/family-invitation-panel.ts';
import { FAMILY_INVITATION_WORDS as W } from '../../lib/family-invitation-words.ts';
import { coachInvitationSenderName, familySenderName } from '../../lib/email-club-identity.ts';
import { functionBody, readCode, readSource } from './_source-code.ts';
import type { InvitationSender } from '../../lib/family-invitation.ts';

/**
 * Signed-in family accounts Stage 4a, Parts 4–5 (build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md;
 * drawing tabs 1–2; /legal draft GUARDIAN_CONSENT_STAGE4.md v0.1 (c) and its six conditions; owner O1 = A, O3, O4).
 * Real output where the code is pure; the source where the rule is "this path never does X".
 */

const CLUB: InvitationSender = {
  clubName: 'Riverdale Minor Ball League', teamWorkspace: false, contact: 'info@riverdaleminor.example',
  mailingAddress: '12 Park Rd, Riverdale ON', privacyNoticeUrl: null, ready: true,
};
const AARAV: MailChild[] = [{ registrationId: 'r1', firstName: 'Aarav', team: 'Otters' }];
const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz0123456789';

describe('Part 5 — the invitation panel (drawing 1b, 1d, 1e; /legal draft c)', () => {
  const first = invitationPanelHtml({ who: 'first', children: AARAV, email: 'priya.shah@example.com', url: acceptUrl(TOKEN), sender: CLUB });

  it('the first parent’s fine print is /legal draft (c), word for word', () => {
    assert.ok(first.includes(
      'This invitation is for priya.shah@example.com and works for 30 days. If you aren’t Aarav’s parent or guardian, ignore it and ' +
      'tell Riverdale Minor Ball League at info@riverdaleminor.example. Joining is your choice. You’ll get emails about Aarav’s team ' +
      'either way, and joining doesn’t add you to any newsletter.'));
  });

  it('names what the parent gets and has ONE button, to the accept page for this token only', () => {
    assert.ok(first.includes('See Aarav’s team in the app'));
    assert.ok(first.includes('Practices, games and your sign-up in one place, and the schedule in your phone’s calendar.'));
    assert.ok(first.includes('Join Aarav’s team'));
    assert.equal((first.match(/href="/g) ?? []).length, 1);
    assert.match(first, new RegExp(`href="[^"]*/family/claim/${TOKEN}"`));
  });

  it('no address rides in the link (Stage 2 ruling 2)', () => {
    const href = /href="([^"]*)"/.exec(first)![1];
    assert.ok(!href.includes('@') && !href.includes('%40'), href);
  });

  it('promotes nothing (/legal condition 6): no plan, price, offer or FieldLogicHQ pitch', () => {
    // What the parent reads (the link's own web address is ours, and is not a pitch).
    const text = first.replace(/<[^>]*>/g, ' ');
    assert.ok(!/\bplan\b|price|\$|premium|upgrade|trial|offer|FieldLogicHQ/i.test(text), text);
  });

  it('the second parent’s panel: no "tell the club" line, the ignore line under the button, pointing at the Stop footer', () => {
    const second = invitationPanelHtml({ who: 'second', children: AARAV, email: 'dev.shah@example.com', url: acceptUrl(TOKEN), sender: CLUB });
    assert.ok(second.includes('This invitation is for dev.shah@example.com and works for 30 days. If you aren’t Aarav’s parent or guardian, ignore it.'));
    assert.ok(second.includes('Use “Stop these emails” below.'));
    assert.ok(!second.includes('tell Riverdale'));
    assert.ok(!second.includes('Practices, games'), 'the second parent’s panel is drawn without the body line');
    assert.ok(second.indexOf('Join Aarav’s team') < second.indexOf('This invitation is for'));
  });

  it('the second parent’s who-added line and sender line (O3: the club’s mailing address)', () => {
    assert.ok(whoAddedHtml('Priya Shah', AARAV).includes('Priya Shah added your email to Aarav’s sign-up so you get the same updates.'));
    assert.ok(secondSenderFootnote(CLUB).includes('Sent by Riverdale Minor Ball League, 12 Park Rd, Riverdale ON, info@riverdaleminor.example, through FieldLogicHQ.'));
  });

  it('siblings: one panel names each; two teams say "teams"', () => {
    const two = [{ registrationId: 'a', firstName: 'Leo', team: 'Otters' }, { registrationId: 'b', firstName: 'Ava', team: 'Otters' }];
    assert.ok(invitationPanelHtml({ who: 'first', children: two, email: 'p@example.com', url: acceptUrl(TOKEN), sender: CLUB }).includes('See Leo and Ava’s team in the app'));
    const split = [{ registrationId: 'a', firstName: 'Leo', team: 'Otters' }, { registrationId: 'c', firstName: 'Maya', team: 'Falcons' }];
    assert.ok(invitationPanelHtml({ who: 'first', children: split, email: 'p@example.com', url: acceptUrl(TOKEN), sender: CLUB }).includes('Join Leo and Maya’s teams'));
  });

  it('already in the app: one line and a plain link to the family page, no button and no invitation', () => {
    const two = [{ registrationId: 'a', firstName: 'Leo', team: 'Otters' }, { registrationId: 'b', firstName: 'Ava', team: 'Otters' }];
    const line = connectedLineHtml(two);
    assert.ok(line.includes('Leo and Ava’s team is in your app.'));
    assert.match(line, new RegExp(`href="[^"]*${FAMILY_HOME_PATH}"`));
    assert.ok(!line.includes('/family/claim/') && !line.includes('<table'));
  });

  it('escapes every value it is handed', () => {
    const html = invitationPanelHtml({ who: 'first', children: [{ registrationId: 'x', firstName: '<b>Al</b>', team: 'T' }], email: 'a@b.co', url: acceptUrl(TOKEN), sender: { ...CLUB, clubName: 'A & B <League>' } });
    assert.ok(!html.includes('<b>Al</b>') && html.includes('&lt;b&gt;Al&lt;/b&gt;'));
    assert.ok(html.includes('A &amp; B &lt;League&gt;'));
  });

  it('the slots: filled per address, and nothing at all when an address gets nothing', () => {
    const built = `<p>Hi,</p>${INVITE_WHO_SLOT}<ul></ul>${INVITE_PANEL_SLOT}<p>Questions?</p>`;
    assert.equal(fillInvitationSlots(built, EMPTY_FILL), '<p>Hi,</p><ul></ul><p>Questions?</p>');
    assert.equal(fillInvitationSlots(built, { who: 'W', panel: 'P' }), '<p>Hi,</p>W<ul></ul>P<p>Questions?</p>');
    assert.equal(fillInvitationSlots(built, { who: '$&', panel: '$1' }), '<p>Hi,</p>$&<ul></ul>$1<p>Questions?</p>', 'no replace() patterns');
  });

  // Owner 2026-11-09: two same-looking green buttons ("Your sign-up", then "Join Sam’s team") left a first-time parent guessing.
  describe('the money link beside the invitation (one big button per email)', () => {
    const PAY = 'https://example.test/pay/abc';
    const BUTTON = `<table role="presentation"><tr><td><a href="${PAY}">Your sign-up</a></td></tr></table>`;
    const LINE = `<p>There’s still a payment due on your sign-up. <a href="${PAY}">See what’s owed</a></p>`;
    // The order the builders use: the panel slot, then the money block (nothing when the family owes nothing).
    const built = (owes: boolean) => `<p>Teams</p>${INVITE_PANEL_SLOT}${owes ? moneyBlock(BUTTON, LINE) : ''}<p>Questions?</p>`;
    const panel = invitationPanelHtml({ who: 'first', children: AARAV, email: 'p@example.com', url: acceptUrl(TOKEN), sender: CLUB });
    const buttons = (html: string) => (html.match(/<table role="presentation"/g) ?? []).length;

    it('the two builders draw the block after the panel slot, and only a family that owes gets a link', () => {
      const src = readCode('lib/email.ts');
      for (const name of ['leagueTeamsPlacedHtml', 'leagueTeamMovedHtml', 'leagueTeamChangesHtml']) {
        assert.match(functionBody(src, name), /\$\{slot\(INVITE_PANEL_SLOT\)\}\$\{input\.invitationSlots \? signupBlock\(input\.signupUrl\) : signupButton\(input\.signupUrl\)\}/, name);
      }
      assert.match(functionBody(src, 'signupBlock'), /if \(!url\) return ''/);
    });

    it('an invited, owing parent gets ONE big button (Join) and the money as a line under it', () => {
      const html = fillInvitationSlots(built(true), { who: '', panel });
      assert.equal(buttons(html), 1);
      assert.ok(html.includes('There’s still a payment due on your sign-up.'));
      assert.ok(html.includes('See what’s owed'));
      assert.ok(html.includes(PAY));
      assert.ok(html.indexOf('Join Aarav’s team') < html.indexOf('See what’s owed'), 'the app first, the money after');
      assert.ok(!html.includes('fl-money'), 'no marker is left behind');
    });

    it('a parent with no panel, or only the connected line, keeps today’s "Your sign-up" button', () => {
      for (const fill of [EMPTY_FILL, { who: '', panel: connectedLineHtml(AARAV) }]) {
        const html = fillInvitationSlots(built(true), fill);
        assert.equal(buttons(html), 1);
        assert.ok(html.includes('>Your sign-up<'));
        assert.ok(!html.includes('See what’s owed') && !html.includes('fl-money'));
      }
    });

    it('a family that owes nothing gets no money link at all, whichever panel they get', () => {
      for (const fill of [EMPTY_FILL, { who: '', panel }]) {
        const html = fillInvitationSlots(built(false), fill);
        assert.ok(!html.includes('Your sign-up') && !html.includes('See what’s owed') && !html.includes(PAY));
      }
    });
  });
});

describe('Part 5.3 — the rep coach’s invitation (drawing 1f; /legal draft c, the commercial-message standard)', () => {
  const base = { coach: 'Sam Ortiz', team: 'Riverdale Hawks U13', child: 'Maya', email: 'grace.chen@example.com', url: acceptUrl(TOKEN), stopUrl: 'https://x.example/invitation-stop?i=1&token=t' };

  it('a club team: the sender, the club’s mailing address and contact, the ignore line and the stop link', () => {
    const html = repInvitationHtml({ ...base, sender: CLUB });
    assert.ok(html.includes('Sam Ortiz, coach of the Riverdale Hawks U13, invited this address to see Maya’s team in the app: practices, games and the coach’s updates.'));
    assert.ok(html.includes('This invitation is for grace.chen@example.com and works for 30 days. If you aren’t Maya’s parent or guardian, ignore it.'));
    assert.ok(html.includes('Don’t send me invitations'));
    assert.ok(html.includes('Sent by Sam Ortiz for Riverdale Minor Ball League, 12 Park Rd, Riverdale ON, through FieldLogicHQ. Contact: info@riverdaleminor.example.'));
    assert.equal(W.repMail.subject('Maya', 'Riverdale Hawks U13'), 'Join Maya’s team, the Riverdale Hawks U13');
  });

  it('a coach team with no club (O4): the coach’s own email is the contact, and no address is printed', () => {
    const html = repInvitationHtml({ ...base, sender: { ...CLUB, clubName: 'Hawks', teamWorkspace: true, contact: 'sam@example.com', mailingAddress: null } });
    assert.ok(html.includes('Sent by Sam Ortiz for a FieldLogicHQ coach team, through FieldLogicHQ. Contact: sam@example.com.'));
    assert.ok(!html.includes('12 Park Rd'));
  });

  it('the stop link is signed on the invitation, never the address', () => {
    const body = functionBody(readCode('lib/unsubscribe-token.ts'), 'buildInviteStopUrl');
    assert.ok(!/email/i.test(body), body);
    assert.match(body, /\/invitation-stop\?i=\$\{encodeURIComponent\(invitationId\)\}&token=/);
  });

  it('the sender name: "Sam Ortiz via Riverdale…", "via FieldLogicHQ" with no club, cleaned for the header', () => {
    assert.equal(coachInvitationSenderName('Sam Ortiz', 'Riverdale Minor Ball League'), 'Sam Ortiz via Riverdale Minor Ball League');
    assert.equal(coachInvitationSenderName('Sam Ortiz', null), 'Sam Ortiz via FieldLogicHQ');
    assert.equal(coachInvitationSenderName('Sam "<x@y>" Ortiz', 'A, B'), 'Sam xy Ortiz via A B');
    assert.equal(coachInvitationSenderName(null, 'Riverdale'), familySenderName('Riverdale'));
    assert.equal(familySenderName('Riverdale'), 'Riverdale via FieldLogicHQ', 'the family sender name is unchanged');
  });

  it('an invitation that did not send is cancelled again; a club that cannot be named is refused before anything is issued', () => {
    const S = functionBody(readCode('lib/family-invitation-mail.ts'), 'sendRepInvitation');
    assert.ok(S.indexOf('if (!sender.ready) throw new FamilyInvitationRefusal(\'no_contact\'') < S.indexOf('issueRepInvitation('));
    assert.match(S, /update\(\{ cancelled_at: new Date\(\)\.toISOString\(\) \}\)\.eq\('id', issued\.invitationId\)/);
    const E = functionBody(readCode('lib/family-invitation-mail.ts'), 'emailRepInvitation');
    assert.match(E, /if \(!stopUrl\) throw/, 'no way to refuse, no invitation');
  });

  it('the coach route sends through the mailer (no bare issue that emails nothing)', () => {
    const R = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/guardians/route.ts');
    assert.match(R, /await sendRepInvitation\(\{/);
    assert.ok(!/issueRepInvitation\(/.test(R));
  });
});

describe('Part 9 guard (a) — with the tier off, the placement email is today’s, byte for byte', () => {
  const EMAIL = readCode('lib/email.ts');
  it('the builders draw the slots only when asked', () => {
    for (const name of ['leagueTeamsPlacedHtml', 'leagueTeamMovedHtml']) {
      const B = functionBody(EMAIL, name);
      assert.match(B, /const slot = \(marker: string\) => \(input\.invitationSlots \? marker : ''\);/, name);
      assert.ok(!/INVITE_(?:WHO|PANEL)_SLOT(?!\))/.test(B.replace(/slot\(INVITE_(?:WHO|PANEL)_SLOT\)/g, '')), `${name}: a slot outside slot()`);
    }
  });
  it('the sender asks for slots only through the mailer, which is null while the tier is off or the club cannot be named', () => {
    const MAILER = functionBody(readCode('lib/family-invitation-mail.ts'), 'placementInviteMailer');
    assert.match(MAILER, /^[^{]*\{\s*if \(!GUARDIAN_TIER_ENABLED\) return null;/);
    assert.match(MAILER, /if \(!sender\.ready\) return null;/);
    const SEND = readCode('lib/house-league-placement-mail.ts');
    assert.equal((SEND.match(/invitationSlots: !!mailer/g) ?? []).length, 3, 'placed, moved and team changes');
  });
  it('an invitation is never the reason a placement email did not go', () => {
    assert.match(functionBody(readCode('lib/house-league-placement-mail.ts'), 'sendClaimed'), /placementInviteMailer\(org\.id, named\.map\(r => r\.id\)\)\.catch\(/);
    assert.match(functionBody(readCode('lib/family-invitation-mail.ts'), 'placementInviteMailer'), /issuePlacementInvitation\([^)]*\)\.then\([^)]*\)\.catch\(/);
  });
  it('Publish refuses for a missing contact or mailing address ONLY while the tier is on (O1 = A, O3)', () => {
    const P = readCode('app/api/admin/house-league/seasons/[seasonId]/publish/route.ts');
    assert.match(P, /if \(GUARDIAN_TIER_ENABLED && !\(await invitationSenderOf\(ctx!\.org\.id\)\)\.ready\)/);
  });
  it('the public site’s Mailing address box shows only while the tier is on', () => {
    assert.match(readCode('app/api/admin/public-site/route.ts'), /asksMailingAddress: GUARDIAN_TIER_ENABLED/);
    assert.match(readCode('app/[orgSlug]/admin/public-site/page.tsx'), /\{asksMailingAddress && textField\('mailingAddress'/);
  });
  it('every new route answers 404 while the tier is off', () => {
    for (const f of ['app/api/family/claim/[token]/email/route.ts', 'app/api/family/claim/[token]/resend/route.ts', 'app/api/invitation-stop/route.ts']) {
      assert.match(readCode(f), /if \(!GUARDIAN_TIER_ENABLED\) return NextResponse\.json\(\{ error: 'guardian_tier_unavailable' \}, \{ status: 404 \}\);/, f);
    }
    for (const f of ['app/invitation-stop/page.tsx', 'app/(consumer)/family/claim/[token]/page.tsx']) {
      assert.match(readCode(f), /if \(!GUARDIAN_TIER_ENABLED\) notFound\(\);/, f);
    }
  });
});

describe('O3 — the mailing address is the club’s own, never the billing address', () => {
  it('read only from the public site’s mailing_address', () => {
    const M = functionBody(readCode('lib/club-email-context.ts'), 'clubContactAndMailingAddress');
    assert.match(M, /getOrgPublicSiteContent\(orgId\);[\s\S]*row\?\.mailingAddress/);
    assert.ok(!/billing/i.test(M));
  });
});

describe('Part 4 — the accept page', () => {
  const INV = readCode('lib/family-invitation.ts');

  it('guard (f): the token never signs anyone in — no session is made on the server, anywhere on the invitation’s path', () => {
    const files = ['lib/family-invitation.ts', 'lib/family-invitation-mail.ts', 'lib/family-invitation-panel.ts',
      'app/api/family/claim/[token]/route.ts', 'app/api/family/claim/[token]/email/route.ts', 'app/api/family/claim/[token]/resend/route.ts',
      'app/(consumer)/family/claim/[token]/page.tsx'];
    for (const f of files) assert.ok(!/signInWithPassword|setSession|verifyOtp|generateLink|exchangeCodeForSession/.test(readCode(f)), f);
    // The page's own sign-in is the parent's password, in the browser — never the token.
    const CLIENT = readCode('app/(consumer)/family/claim/[token]/ClaimClient.tsx');
    for (const m of CLIENT.matchAll(/signIn\(([^)]*)\)/g)) assert.equal(m[1], 'email, password');
  });

  it('ruling 15: a new account is created confirmed ONLY after every refusal was checked, and removed again if the join loses', () => {
    const N = functionBody(INV, 'acceptWithNewAccount');
    const create = N.indexOf('auth.admin.createUser(');
    for (const before of ['emailMatches(inv.email, params.typedEmail)', 'params.guardianBox !== true', 'NEW_ACCOUNT_PASSWORD_MIN', 'authAccountExistsForEmail(inv.email)', 'connect.length === 0']) {
      assert.ok(N.indexOf(before) > -1 && N.indexOf(before) < create, before);
    }
    assert.match(N, /email: inv\.email,\s*password: params\.password,\s*email_confirm: true,/);
    assert.match(N, /if \(result\.kind !== 'joined'\) await removeNewAccount\(userId\)/);
    // Only the address-taken codes answer "account exists" (Auth answers 422 for a refused password too).
    assert.ok(!/status === 422/.test(N), 'a 422 alone is not "account exists"');
    assert.match(N, /error\?\.code === 'email_exists'/);
    // A join that failed part-way: the account is removed only while it holds no connection (a removed account would leave
    // its link verified with no account behind it), and acceptInvitation gives the invitation back.
    assert.match(N, /if \(!countError && count === 0\) await removeNewAccount\(userId\)/);
    assert.match(functionBody(INV, 'acceptInvitation'), /catch \(e\) \{\s*await releaseClaim\(inv\.id, params\.userId\);\s*throw e;/);
    assert.match(functionBody(INV, 'releaseClaim'), /\.eq\('used_by_user_id', userId\)/);
  });

  it('the page never receives the invited address in full; a stranger learns only whether what they typed matches', () => {
    // (functionBody ends at the next un-exported function; the next one here is exported, so cut at the function's own close.)
    const V = functionBody(INV, 'inspectInvitation').split('\n}\n')[0];
    assert.ok(!/maskedEmail: inv\.email|email: inv\.email/.test(V));
    const C = functionBody(INV, 'invitationEmailCheck');
    // Only an open invitation answers; a used, cancelled or expired link learns nothing about its address.
    assert.match(C, /if \(!inv \|\| invitationState\(asRow\(inv\), new Date\(\)\.toISOString\(\), null\) !== 'open'\) return \{ match: false \};/);
    assert.match(C, /if \(!emailMatches\(inv\.email, typed\)\) return \{ match: false \};/);
    assert.ok(C.indexOf('emailMatches') < C.indexOf('authAccountExistsForEmail'), 'account existence only after a match');
    // The address check and the new-account submit spend a per-INVITATION budget, never a parent's per-address mail budget
    // (a stranger with a made-up link must not lock a parent out of registration).
    for (const f of ['app/api/family/claim/[token]/email/route.ts', 'app/api/family/claim/[token]/route.ts']) {
      const code = readCode(f);
      assert.match(code, /throttleInvitationAttempt\(token\)/, f);
      assert.ok(!code.includes('throttlePublicFormRecipient'), f);
    }
  });

  it('an older link cannot undo a Cancel, and a re-send names only a coach still on the team', () => {
    assert.match(functionBody(INV, 'invitationToResend'), /if \(await replacementWasCancelled\(inv\.replaced_by\)\) return null;/);
    const MAIL = readCode('lib/family-invitation-mail.ts');
    assert.match(functionBody(MAIL, 'resendRepInvitation'), /seats\.some\(a => a\.teamId === repTeamId && a\.capabilities\.rosterPii\)\) return;/);
  });

  it('D answers the same whatever happened (ask 9): one body, and the per-address limit is silent', () => {
    const R = readCode('app/api/family/claim/[token]/resend/route.ts');
    const bodies = [...R.matchAll(/NextResponse\.json\((\{[^)]*\})/g)].map(m => m[1]);
    assert.deepEqual(bodies.filter(b => !b.startsWith("{ error: 'guardian_tier_unavailable' }")), ['{ ok: true }', '{ ok: true }']);
    assert.match(R, /if \(inv && !throttlePublicFormRecipient\(inv\.email\)\)/);
    assert.match(functionBody(INV, 'invitationToResend'), /!== 'expired_or_replaced'\) return null;/);
  });

  it('F never says why; C on a rep invitation names the coach, not the club', () => {
    assert.equal(W.accept.gone.body('Riverdale', 'info@r.example'), 'If you think that’s wrong, contact Riverdale at info@r.example.');
    assert.ok(W.accept.another.body('p•••@e.com', 'd•••@e.com', 'coach').includes('ask the coach to send it'));
    const CLIENT = readSource('app/(consumer)/family/claim/[token]/ClaimClient.tsx');
    assert.ok(!/cancelled|withdrawn|stopped|removed/i.test(CLIENT.slice(CLIENT.indexOf('W.gone.title'), CLIENT.indexOf('W.gone.title') + 300)));
  });

  it('no age question anywhere on the page (ruling 12)', () => {
    assert.ok(!/age band|ageBand|How old|date of birth/i.test(readCode('app/(consumer)/family/claim/[token]/ClaimClient.tsx')));
  });

  it('the "Don’t send me invitations" page writes nothing; only its POST does', () => {
    const PAGE = readCode('app/invitation-stop/page.tsx');
    assert.ok(!/\.(insert|upsert|update|delete|rpc)\(/.test(PAGE));
    assert.match(PAGE, /<form method="post" action="\/api\/invitation-stop"/);
    const POST = readCode('app/api/invitation-stop/route.ts');
    assert.ok(POST.indexOf('verifyInviteStopToken(i, token)') < POST.indexOf("from('family_invitations')"), 'the token is checked first');
    assert.ok(!/second_parent_stops|family_email_optouts/.test(POST));
  });
});
