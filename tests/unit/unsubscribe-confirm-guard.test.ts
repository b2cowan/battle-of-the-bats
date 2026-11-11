/**
 * A PLAIN VISIT TO /unsubscribe NEVER WRITES (Board Ready sweep 3, finding 7).
 *
 * Mail scanners pre-open every link in an email, so the old GET route opted people (and whole clubs) out of mail they
 * never asked to stop. The link now opens a confirm page that reads and writes nothing; only the button's POST writes,
 * exactly as /second-parent-stop and /invitation-stop do. These guards read the source as code (comments stripped).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, sourceExists } from './_source-code.ts';
import * as T from '../../lib/unsubscribe-token.ts';

const WRITES = /\.(upsert|insert|update|delete)\(|\.rpc\(/;

describe('GET /unsubscribe writes nothing', () => {
  it('there is no route handler at /unsubscribe any more, so no GET can write', () => {
    assert.equal(sourceExists('app/unsubscribe/route.ts'), false);
    assert.equal(sourceExists('app/unsubscribe/page.tsx'), true);
  });
  it('the confirm page makes no database write of any kind', () => {
    assert.doesNotMatch(readCode('app/unsubscribe/page.tsx'), WRITES);
  });
  it('the page verifies the signed token BEFORE it reads anything, in each of the three branches', () => {
    const page = readCode('app/unsubscribe/page.tsx');
    for (const verify of ['verifyUserUnsubscribeToken', 'verifyGuardianUnsubscribeToken', 'verifyUnsubscribeToken']) {
      const call = page.indexOf(`${verify}(`, page.indexOf('const viewOf'));
      assert.ok(call > 0, `${verify} is called`);
      assert.ok(page.indexOf('.from(', call) > call, `${verify} comes before the branch's first read`);
    }
  });
  it('the button is a plain form POST to the one route that writes', () => {
    const page = readCode('app/unsubscribe/page.tsx');
    assert.match(page, /<form method="post" action="\/api\/unsubscribe"/);
    assert.match(page, /SystemAction kind="primary" submit/);
  });
  it('the family-address page shows the address masked, and the words never promise more than "emails like the one you received" (/legal)', () => {
    assert.match(readCode('app/unsubscribe/page.tsx'), /WORDS\.guardian\(club\.data\.name, maskEmail\(guardian\)\)/);
    const words = readCode('lib/unsubscribe-words.ts');
    assert.match(words, /emails like the one you received/);
    assert.doesNotMatch(words, /scanner/i);
  });
  it('a link we cannot use, our failure and an address already opted out all go to the existing result page', () => {
    const page = readCode('app/unsubscribe/page.tsx');
    assert.match(page, /redirect\('\/unsubscribe\/confirmed\?error=invalid'\)/);
    assert.match(page, /redirect\('\/unsubscribe\/confirmed\?error=db'\)/);
    assert.match(page, /redirect\('\/unsubscribe\/confirmed'\)/);
  });
});

describe('POST /api/unsubscribe is the only writer', () => {
  const route = readCode('app/api/unsubscribe/route.ts');
  it('exports a POST, and a GET that only redirects to the confirm page (it is the mail header\'s address)', () => {
    assert.match(route, /export const POST = /);
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const POST'));
    assert.ok(get.length > 0, 'a GET exists');
    assert.doesNotMatch(get, WRITES);
    assert.doesNotMatch(get, /supabaseAdmin/);
    assert.match(get, /NextResponse\.redirect\(target, 303\)/);
    assert.match(get, /new URL\('\/unsubscribe', request\.url\)/);
  });
  it('checks the token before any database call, in every branch', () => {
    for (const verify of ['verifyUserUnsubscribeToken', 'verifyGuardianUnsubscribeToken', 'verifyUnsubscribeToken']) {
      const call = route.indexOf(`${verify}(`, route.indexOf('const token'));
      assert.ok(call > 0, `${verify} is called`);
      assert.ok(route.indexOf('supabaseAdmin', call) > call, `${verify} comes before the branch's write`);
    }
  });
  it('keeps the old branch order: user, then guardian, then the whole organization', () => {
    const user = route.indexOf('if (userId)');
    const guardian = route.indexOf('if (guardianEmail)');
    const org = route.indexOf('verifyUnsubscribeToken(orgId');
    assert.ok(user > 0 && guardian > user && org > guardian);
  });
  it('writes the same three tables the old route wrote, and answers with a 303 to the result page', () => {
    for (const table of ['user_marketing_opt_outs', 'family_email_optouts', 'organizations']) assert.ok(route.includes(`'${table}'`), table);
    assert.match(route, /NextResponse\.redirect\(new URL\(`\/unsubscribe\/confirmed\$\{query\}`, request\.url\), 303\)/);
  });
  it('can also answer a mail client\'s one-click POST, which carries the link\'s query string', () => {
    assert.match(route, /query\.get\(name\)/);
  });
});

describe('a mail client\'s own Unsubscribe button (RFC 8058 one-click)', () => {
  it('the header is the footer link\'s own address on the route that writes, with the one-click marker', () => {
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-for-the-guard-xxxxxxxxxxxxxxxx';
    for (const url of [T.buildUnsubscribeUrl('org-1'), T.buildUserUnsubscribeUrl('user-1'), T.buildGuardianUnsubscribeUrl('org-1', 'a+b@example.test')]) {
      const h = T.oneClickUnsubscribeHeaders(url);
      assert.equal(h['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
      const target = new URL(h['List-Unsubscribe'].slice(1, -1));
      assert.equal(target.pathname, '/api/unsubscribe');
      assert.equal(target.search, new URL(url!).search, 'same query, same signed token');
      assert.doesNotMatch(h['List-Unsubscribe'], /[\r\n]/);
    }
  });
  it('no link, no header', () => {
    assert.deepEqual(T.oneClickUnsubscribeHeaders(null), {});
    assert.deepEqual(T.oneClickUnsubscribeHeaders(undefined), {});
    assert.deepEqual(T.oneClickUnsubscribeHeaders('https://example.test/somewhere-else'), {});
  });
  it('the three senders that put an unsubscribe footer in a mail also put the header on it, and a transactional send gets neither', () => {
    const marketing = readCode('lib/email-sender.ts');
    assert.match(marketing, /!skipOptOutCheck && unsubscribeUrl \? \{ headers: oneClickUnsubscribeHeaders\(unsubscribeUrl\) \}/);
    const family = readCode('lib/family-email.ts');
    assert.equal((family.match(/headers: oneClickUnsubscribeHeaders\(buildGuardianUnsubscribeUrl\(params\.orgId, to\)\)/g) ?? []).length, 2, 'single and batch');
    // The service batch (placement and moved-team emails) carries no unsubscribe link, so it carries no header either.
    const service = family.slice(family.indexOf('export async function sendFamilyServiceBatch'));
    assert.doesNotMatch(service, /oneClickUnsubscribeHeaders/);
    const transport = readCode('lib/email.ts');
    assert.match(transport, /headers: opts\.headers/);
    assert.match(transport, /headers: e\.headers/);
  });
});

describe('every link already sent still lands on the confirm page', () => {
  it('the three builders still point at /unsubscribe with the same parameters', () => {
    process.env.UNSUBSCRIBE_SECRET = 'test-secret-for-the-guard-xxxxxxxxxxxxxxxx';
    for (const url of [T.buildUnsubscribeUrl('org-1'), T.buildUserUnsubscribeUrl('user-1'), T.buildGuardianUnsubscribeUrl('org-1', 'A@b.test')]) {
      assert.ok(url, 'a link is built');
      assert.equal(new URL(url!).pathname, '/unsubscribe');
    }
  });
});
