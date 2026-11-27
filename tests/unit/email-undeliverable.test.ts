/**
 * A reserved test or demo address never reaches the mail service (2026-11-26: a walk's `.example.test` families used up
 * the day's sending quota by 9:30 a.m.). Both senders ask lib/email-undeliverable.ts before a request leaves; the senders
 * are run here against a stand-in for the mail service, so nothing is sent.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { billingTestLoader } from './_billing-test-loader.ts';
import { isUndeliverableAddress } from '../../lib/email-undeliverable.ts';

describe('an address that can never receive mail', () => {
  it('holds back every reserved name, bare or inside a display name', () => {
    for (const to of [
      'lucie@kb.example.test', 'president@kestrel-bay.example.test', 'a@x.test', 'a@s4a.example', 'a@example.invalid',
      'a@dev.local', 'first.last@miltonfamilies.local', 'a@mail.localhost', 'a@localhost', 'a@test',
      'a@example.com', 'a@example.net', 'a@example.org', 'a@mail.example.com',
      'A@EXAMPLE.TEST', '  a@x.test  ', 'a@x.test.', 'Lucie Martin <lucie@kb.example.test>', 'Lucie <lucie@x.test >',
    ]) assert.equal(isUndeliverableAddress(to), true, to);
  });

  it('lets a real address through, including one that only looks like a test one', () => {
    for (const to of [
      'someone@gmail.com', 'hello@fieldlogichq.ca', 'delivered@resend.dev', 'a@dev.club.ca', 'a@club.ca.',
      'a@myexample.com', 'a@example.ca', 'a@example.com.au', 'a@test.com', 'a@club.testing', 'test@club.ca',
      'a@contest', 'a.local@club.ca', 'Test Example <a@club.ca>', 'x.test <a@club.ca>',
    ]) assert.equal(isUndeliverableAddress(to), false, to);
  });
});

describe('neither sender hands a reserved address to the mail service', () => {
  /** What each request to the mail service carried, as the list of its recipients. */
  const requests: string[][] = [];
  const rowStatuses: string[] = [];
  const logOutcomes: object[] = [];
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.RESEND_API_KEY;

  before(() => {
    process.env.RESEND_API_KEY = 'test-not-a-key';
    globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { to: string } | { to: string }[];
      requests.push([body].flat().map(e => e.to));
      return new Response('{"id":"re_1"}', { status: 200 });
    }) as unknown as typeof fetch;
  });
  after(() => {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });

  const load = billingTestLoader({
    '@/lib/preview-org-server': { isPreviewOrgId: async () => false },
    './email-log': {
      ROW_TAG: 'flhq_row', DB_TAG: 'flhq_db', logDatabaseRef: () => 'local',
      openSentEmailRow: async () => 'log-1',
      settleSentEmailRow: async (_id: string, outcome: object) => { logOutcomes.push(outcome); },
    },
    '@/lib/supabase-admin': { supabaseAdmin: { from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'send-1' }, error: null }) }) }),
      update: (row: { status: string }) => ({ eq: async () => { rowStatuses.push(row.status); return { error: null }; } }),
    }) } },
  });
  type Sent = { status: string };
  const transport = load('lib/email.ts') as {
    sendEmail: (to: string, subject: string, html: string, opts: object) => Promise<Sent>;
    sendEmailBatch: (emails: object[], orgId: null) => Promise<Sent>;
  };
  const marketing = load('lib/email-sender.ts') as { sendMarketingEmail: (opts: object) => Promise<string> };

  const opts = { kind: 'house_league_games_changed', orgId: null };
  const mail = (to: string) => ({ kind: 'house_league_games_changed', to, subject: 's', html: '<p>h</p>' });
  const send = (toEmail: string) => marketing.sendMarketingEmail({ emailKey: 'k', orgId: 'o', toEmail, subject: 's', html: '<p>h</p>', skipOptOutCheck: true });

  it('one email: held back and answered sent; a real one goes', async () => {
    requests.length = 0;
    assert.equal((await transport.sendEmail('a@kb.example.test', 's', '<p>h</p>', opts)).status, 'sent');
    assert.deepEqual(requests, []);
    await transport.sendEmail('real@club.ca', 's', '<p>h</p>', opts);
    assert.deepEqual(requests, [['real@club.ca']]);
  });

  it('the account-email log says Not sent for a held-back address, while the caller is answered sent', async () => {
    logOutcomes.length = 0;
    const result = await transport.sendEmail('a@kb.example.test', 's', '<p>h</p>', { kind: 'org_invite', orgId: null });
    assert.equal(result.status, 'sent');
    assert.deepEqual(logOutcomes, [{ state: 'not_sent' }]);
  });

  it('a batch: only the real addresses go, and an all-reserved batch makes no request', async () => {
    requests.length = 0;
    assert.equal((await transport.sendEmailBatch([mail('a@kb.example.test'), mail('b@dev.local')], null)).status, 'sent');
    assert.deepEqual(requests, []);
    await transport.sendEmailBatch([mail('a@kb.example.test'), mail('real@club.ca')], null);
    assert.deepEqual(requests, [['real@club.ca']]);
  });

  it('a marketing email: held back and recorded sent; a real one goes', async () => {
    requests.length = 0;
    rowStatuses.length = 0;
    assert.equal(await send('a@kb.example.test'), 'sent');
    assert.deepEqual(requests, []);
    assert.deepEqual(rowStatuses, ['sent']);
    await send('real@club.ca');
    assert.deepEqual(requests, [['real@club.ca']]);
  });
});
