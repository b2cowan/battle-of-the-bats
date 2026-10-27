/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 5, PART 8 - the sent-email log's screens
 * (owner Q3/Q6 2026-10-26; PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_BUILD_PROMPT.md Part 8; drawing E; threats T13-T17).
 *
 *   1. THE WORDS. A whole address is the only thing a search takes; the flag lines say what the drawing says; a Delivered
 *      that was delayed reads "after a delay"; the timeline says "2 seconds later", never a clock with seconds.
 *   2. FIND'S GROUP. "Sent emails" is searched only for the sent-log roles, only for a WHOLE address that no account owns,
 *      and the reader is handed the address lowercased (exact match). A role without the power never has its reader called.
 *   3. THE ROUTES check the `sent_log` power as their FIRST statement, before anything is read (T16). The search route
 *      keeps its words in the body: it never reads the address, never logs, never audits (A3, T14); a search is counted
 *      for the daily limit before it is read (T17) and over the limit is one fixed sentence.
 *   4. THE TRAIL. An email opened from Sent emails writes a records-opened row (kind 'email'); one opened from a person's
 *      tab does not; the asker's account number never leaves the server.
 *   5. THE STORY. A person's Story gains email rows only for a role holding `sent_log`, decided on the server; the club's
 *      Story is unchanged; the Emails tab is absent for the others.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, functionBody } from './_source-code.ts';
import { hasPlatformPower } from '../../lib/platform-areas.ts';
import { findGroupsFor, runFind, type FindReaders } from '../../lib/platform-find.ts';
import type { PlatformRole } from '../../lib/platform-auth.ts';
import { laterWords, timelineLines, whatHappenedTime } from '../../lib/sent-log-view.ts';
import {
  SENT_SEARCH_LIMIT, listFlag, looksLikeEmailAddress, windowFlag,
} from '../../lib/sent-log-words.ts';

const ROLES: PlatformRole[] = ['super_admin', 'support', 'billing', 'product', 'growth', 'read_only'];
const SENT_LOG_ROLES = ROLES.filter(r => hasPlatformPower(r, 'sent_log'));

const SEARCH_ROUTE = 'app/api/platform-admin/sent-emails/route.ts';
const EMAIL_ROUTE = 'app/api/platform-admin/sent-emails/[id]/route.ts';

// ── 1 · The words ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('1 · the words the screens use', () => {
  it('a search takes a whole address and nothing else', () => {
    for (const ok of ['sam.lee@example.com', ' Sam.Lee+x@example.co.uk ']) assert.equal(looksLikeEmailAddress(ok), true, ok);
    for (const no of ['sam', 'sam@', 'sam@example', '@example.com', 'sam lee@example.com', 'sam@example.com, jo@example.com', '']) {
      assert.equal(looksLikeEmailAddress(no), false, no);
    }
  });

  it('the over-the-limit sentence is the drawing\'s, and carries no number', () => {
    assert.equal(SENT_SEARCH_LIMIT, "You have reached today's limit of searches. It resets within 24 hours.");
  });

  it('flag lines: Bounced and Not sent carry their reason in a list; Marked as spam only in the window', () => {
    assert.equal(listFlag('bounced', 'address_does_not_exist'), 'This address does not exist');
    assert.equal(listFlag('not_sent', null), 'This address bounced or reported spam before');
    assert.equal(listFlag('delivered', null), null);
    assert.equal(listFlag('complained', null), null);
    assert.equal(windowFlag('bounced', 'address_does_not_exist'), 'Bounced: the receiving mail server says this address does not exist.');
    assert.match(windowFlag('complained', null) ?? '', /^Marked as spam: the person reported it as spam/);
    assert.equal(windowFlag('delivered', null), null);
    assert.equal(windowFlag('delayed', null), null);
  });

  it('a Delivered that was delayed first says so; nothing else does', () => {
    const at = '2026-10-02T22:41:00.000Z';
    assert.match(whatHappenedTime({ state: 'delivered', stateAt: at, wasDelayed: true }), /, after a delay$/);
    assert.doesNotMatch(whatHappenedTime({ state: 'delivered', stateAt: at, wasDelayed: false }), /delay/);
    assert.doesNotMatch(whatHappenedTime({ state: 'bounced', stateAt: at, wasDelayed: true }), /delay/);
  });

  it('"later" is relative words, seconds only here, and there is no clock with seconds', () => {
    const t = (s: number) => new Date(Date.UTC(2026, 9, 26, 13, 20, s)).toISOString();
    assert.equal(laterWords(t(0), t(0)), 'straight away');
    assert.equal(laterWords(t(0), t(1)), '1 second later');
    assert.equal(laterWords(t(0), t(2)), '2 seconds later');
    assert.equal(laterWords(t(0), t(90)), '2 minutes later');
    assert.equal(laterWords(t(0), t(7200)), '2 hours later');
  });

  it('drawing E4: Sent, then Bounced 2 seconds later, for good, with the reason', () => {
    const sentAt = '2026-10-26T13:20:00.000Z';
    const lines = timelineLines({
      sentAt, state: 'bounced', stateAt: '2026-10-26T13:20:02.000Z', bounceReason: 'address_does_not_exist',
      timeline: [{ state: 'bounced', at: '2026-10-26T13:20:02.000Z', bounceReason: 'address_does_not_exist' }],
    });
    assert.equal(lines.length, 2);
    assert.equal(lines[0].text, 'Sent to the mail service');
    assert.equal(lines[1].word, 'Bounced');
    assert.equal(lines[1].text, '2 seconds later, for good. The address does not exist at that mail provider.');
    for (const l of lines) assert.doesNotMatch(l.time, /\d:\d\d:\d\d/, 'a clock never shows seconds');
  });

  it('Not sent and Failed never claim to have been handed to the mail service; Not confirmed says it was', () => {
    const base = { sentAt: '2026-10-26T13:20:00.000Z', stateAt: '2026-10-26T13:20:00.000Z', bounceReason: null, timeline: [] };
    assert.deepEqual(timelineLines({ ...base, state: 'not_sent' }).map(l => l.text.startsWith('Sent to')), [false]);
    assert.deepEqual(timelineLines({ ...base, state: 'failed' }).map(l => l.text.startsWith('Sent to')), [false]);
    assert.equal(timelineLines({ ...base, state: 'unconfirmed' })[0].text, 'Sent to the mail service');
    assert.equal(timelineLines({ ...base, state: 'sent' }).length, 1);
  });
});

// ── 2 · Find's group ─────────────────────────────────────────────────────────────────────────────────────────────────
function spy(opts: { accountEmail?: string } = {}) {
  const calls: { reader: string; arg?: string }[] = [];
  const readers: FindReaders = {
    async clubs() { calls.push({ reader: 'clubs' }); return { rows: [], total: 0 }; },
    async people() {
      calls.push({ reader: 'people' });
      return opts.accountEmail
        ? { rows: [{ id: 'p1', email: opts.accountEmail, name: null, lastSignInAt: null, banned: false }], total: 1 }
        : { rows: [], total: 0 };
    },
    async personClubs() { return new Map(); },
    async stripe() { return []; },
    async sentEmails(address) {
      calls.push({ reader: 'sentEmails', arg: address });
      return { rows: [{ id: 'e1', label: 'Invitation to a club', to: address, orgName: 'UAT Rep Club', sentAt: '2026-10-26T13:20:00.000Z', state: 'bounced' }], total: 1 };
    },
  };
  return { readers, calls };
}

describe('2 · Find\'s "Sent emails" group', () => {
  it('is searched by the sent-log roles and no one else', () => {
    assert.deepEqual(ROLES.filter(r => findGroupsFor(r).includes('sent_emails')), SENT_LOG_ROLES);
    assert.deepEqual(SENT_LOG_ROLES, ['super_admin', 'support', 'billing']);
  });

  for (const role of ROLES) {
    it(`${role}: a whole address with no account ${SENT_LOG_ROLES.includes(role) ? 'gets the group' : 'gets no group and its reader is never called'}`, async () => {
      const { readers, calls } = spy();
      const answer = await runFind(role, 'Sam.Lee@Example.com', readers);
      const allowed = SENT_LOG_ROLES.includes(role);
      assert.equal('sentEmails' in answer, allowed);
      assert.equal(calls.some(c => c.reader === 'sentEmails'), allowed);
      if (allowed) assert.equal(calls.find(c => c.reader === 'sentEmails')?.arg, 'sam.lee@example.com', 'exact match: the reader gets the address lowercased');
    });
  }

  it('words that are not a whole address never start the search', async () => {
    for (const words of ['sam.lee', 'sam.lee@', 'sam.lee@example', 'Sam Lee', 'cus_QF3kR8mZ2vXb1L']) {
      const { readers, calls } = spy();
      await runFind('super_admin', words, readers);
      assert.ok(!calls.some(c => c.reader === 'sentEmails'), words);
    }
  });

  it('an address that HAS an account is found as that person; the group stays away', async () => {
    const { readers, calls } = spy({ accountEmail: 'jamie.rivera@example.com' });
    const answer = await runFind('super_admin', 'jamie.rivera@example.com', readers);
    assert.ok(!('sentEmails' in answer));
    assert.ok(!calls.some(c => c.reader === 'sentEmails'));
  });

  it('an address with no emails recorded adds no group', async () => {
    const { readers } = spy();
    readers.sentEmails = async () => ({ rows: [], total: 0 });
    const answer = await runFind('super_admin', 'nobody@example.com', readers);
    assert.ok(!('sentEmails' in answer));
  });

  it('the panel opens an email by its id, never by its address', () => {
    const box = readCode('app/platform-admin/FindBox.tsx');
    assert.match(box, /SENT_EMAIL_HREF = \(id: string\) => `\/platform-admin\/sent-emails\?email=\$\{encodeURIComponent\(id\)\}`/);
    assert.doesNotMatch(box, /sent-emails\?[^`]*\$\{(trimmed|words|e\.to|answered)/);
    assert.match(box, /SENT_EMAIL_HREF\(e\.id\)/);
  });

  it('Find still keeps nothing it was typed: no audit, no trail, no limit row, no address read', () => {
    const route = readCode('app/api/platform-admin/find/route.ts');
    const lib = readCode('lib/platform-find.ts');
    for (const src of [route, lib]) assert.doesNotMatch(src, /searchParams|req\.url|nextUrl|new URL\(|console\.(log|warn|error|info)/);
    assert.doesNotMatch(route, /writePlatformAuditLog|recordOpened|takeSentEmailSearch/);
  });
});

// ── 3 · The routes ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('3 · each route checks the sent-log power first and reads nothing before it', () => {
  const reads = ['getSentEmail(', 'listSentLogRows(', 'listSentEmails(', 'takeSentEmailSearch(', 'recordOpened(', 'addressesWithAccounts(', 'askedByLine(', 'supabaseAdmin'];

  for (const [name, file] of [['search', SEARCH_ROUTE], ['email', EMAIL_ROUTE]] as const) {
    it(`${name}: requirePlatformPower('sent_log') comes before every read`, () => {
      const code = readCode(file);
      const gate = code.indexOf("requirePlatformPower('sent_log')");
      assert.ok(gate > 0, 'the sent_log power is checked');
      for (const r of reads) {
        const at = code.indexOf(r);
        if (at >= 0) assert.ok(gate < at, `${r} is read only after the power is checked`);
      }
      assert.match(code, /if \(auth\.response\) return json\(\{ error: 'Forbidden' \}, auth\.response\.status\);/);
      assert.match(code, /'Cache-Control': 'no-store'/);
    });
  }

  it('search: the words ride in the body - the route never reads the address, never logs, never audits', () => {
    const code = readCode(SEARCH_ROUTE);
    assert.match(code, /export const POST/);
    assert.doesNotMatch(code, /export const GET/);
    assert.doesNotMatch(code, /searchParams|req\.url|nextUrl|new URL\(/);
    assert.doesNotMatch(code, /console\.(log|warn|error|info)/);
    assert.doesNotMatch(code, /writePlatformAuditLog|recordOpened/);
    assert.match(code, /captureError\(new Error\(SENT_LOG_FAILED\)/, 'a failure is one fixed sentence before it is recorded');
    assert.doesNotMatch(code, /catch \((err|error|e)\)/, 'the caught error is never kept, let alone recorded');
  });

  it('search: an address is counted for the daily limit BEFORE it is read; over the limit is the one fixed sentence', () => {
    const code = readCode(SEARCH_ROUTE);
    const take = code.indexOf('takeSentEmailSearch(auth.user.id)');
    assert.ok(take > 0);
    assert.ok(take < code.indexOf('listSentLogRows('), 'the search is counted before the list is read');
    assert.match(code, /if \(typed && !\(await takeSentEmailSearch\(auth\.user\.id\)\)\) return json\(\{ error: SENT_SEARCH_LIMIT \}, 429\);/,
      'only an address is a search; browsing the newest is not counted');
    assert.match(code, /looksLikeEmailAddress\(typed\)/, 'a whole address only');
  });

  it('search: the screen sends a POST with the address in the body, to an address with no query, and keeps it nowhere', () => {
    const client = readCode('app/platform-admin/sent-emails/SentEmailsClient.tsx');
    assert.match(client, /fetch\('\/api\/platform-admin\/sent-emails', \{\s*method: 'POST'/);
    assert.match(client, /body: JSON\.stringify\(\{ to: to \|\| null/);
    assert.doesNotMatch(client, /\/api\/platform-admin\/sent-emails\?/);
    assert.doesNotMatch(client, /useSearchParams|localStorage|sessionStorage|handListSearch|rememberConsoleRecent/);
    // The only place a router writes an address here takes an email's id out of it again - never the words.
    assert.deepEqual([...client.matchAll(/router\.(?:push|replace)\(([^)]*)\)/g)].map(m => m[1]), ["'/platform-admin/sent-emails'"]);
    assert.match(client, /looksLikeEmailAddress\(typed\)/, 'half an address is not a search');
  });

  it('the page is the sent_emails area, and opens a window only for a well-formed id', () => {
    const page = readCode('app/platform-admin/sent-emails/page.tsx');
    assert.match(page, /requirePlatformAreaView\('sent_emails'\)/);
    assert.match(page, /\[0-9a-f-\]\{36\}/);
    assert.doesNotMatch(page, /searchParams\)?\.?(q|to|address|words)\b/);
  });
});

// ── 4 · The trail ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('4 · an email opened from Sent emails writes a records-opened row', () => {
  const code = readCode(EMAIL_ROUTE);

  it('every open writes kind \'email\' by the email\'s id; a browser-sent \'from\' never decides it (the /review)', () => {
    assert.doesNotMatch(code, /searchParams\.get\('from'\) === 'log'/);
    assert.match(code, /recordOpened\(\{ actorUserId: auth\.user\.id, actorEmail: auth\.user\.email, kind: 'email', recordId: id, viaFind: false \}\)/);
    assert.equal(code.split('recordOpened(').length - 1, 1);
    assert.ok(code.indexOf('getSentEmail(') < code.indexOf('recordOpened('), 'an email that is not there writes no row');
  });

  it('the window passes where it was opened from: the Sent emails page \'log\', a person\'s tab \'person\'', () => {
    assert.match(readCode('app/platform-admin/sent-emails/SentEmailsClient.tsx'), /<SentEmailWindow key=\{openId\} id=\{openId\} from="log"/);
    assert.match(readCode('app/platform-admin/sent-emails/SentParts.tsx'), /<SentEmailWindow key=\{openId\} id=\{openId\} from="person"/);
  });

  it('the record kind is widened and the Audit log names an email row', () => {
    assert.match(readCode('lib/platform-record-opens.ts'), /export type RecordKind = 'club' \| 'person' \| 'email';/);
    const audit = readCode('app/platform-admin/audit/RecordsOpened.tsx');
    assert.match(audit, /r\.kind === 'email'/);
    assert.match(audit, /platform_account_emails/);
  });

  it('the window is given named fields: the asker\'s account number and the club\'s id never leave the server', () => {
    assert.doesNotMatch(code, /askedBy: email\.askedBy|\.\.\.email\b/);
    assert.match(code, /const shown: SentWindowEmail = \{/);
  });

  it('the email window is a 640 record window', () => {
    assert.match(readCode('app/platform-admin/sent-emails/SentParts.tsx'), /<KitDialog\s+kind="form"\s+size="medium"\s+record/);
  });
});

// ── 5 · The Story and the Emails tab ─────────────────────────────────────────────────────────────────────────────────
describe('5 · email rows and the Emails tab exist only for the sent-log roles, decided on the server', () => {
  const story = readCode('lib/platform-story.ts');
  const person = functionBody(story, 'buildPersonStory');
  const page = readCode('app/platform-admin/customer-users/[id]/page.tsx');

  it('the person Story reads the log only when handed a role that holds sent_log (and re-checks it)', () => {
    assert.match(person, /const emailsAs = opts\.emailsAs && hasPlatformPower\(opts\.emailsAs, 'sent_log'\) \? opts\.emailsAs : null;/);
    assert.match(person, /emailsAs \? listSentEmails\(emailsAs, \{ to: email, storyOnly: true/);
    assert.equal(person.split('listSentEmails(').length - 1, 1, 'one read, behind the gate');
    assert.match(person, /kind: 'emails', title: `\$\{e\.label\} sent`/);
  });

  it('the club Story is unchanged: it never reads the sent log', () => {
    // (functionBody stops at the next unexported function, so the club's body is cut at the person's by hand.)
    const club = story.slice(story.indexOf('function buildClubStory('), story.indexOf('function buildPersonStory('));
    assert.ok(club.length > 1000, 'the club Story was found');
    assert.doesNotMatch(club, /listSentEmails|sent-log/);
  });

  it('the page decides from the power, hands the Story the role only when it holds it, and the tab only then', () => {
    assert.match(page, /const sentLog = hasPlatformPower\(auth\.role, 'sent_log'\);/);
    assert.match(page, /\{ emailsAs: sentLog \? auth\.role : null \}/);
    assert.match(page, /sentLog \? readPersonEmails\(auth\.role, person\.email\) : Promise\.resolve\(null\)/);
    assert.match(page, /listSentEmails\(role, \{ to: address, limit: 100 \}\)/, 'by the person\'s current address');
  });

  it('the Emails tab is absent without the data, not disabled', () => {
    const record = readCode('app/platform-admin/customer-users/[id]/PersonRecord.tsx');
    assert.match(record, /\.\.\.\(emails \? \[\['emails', 'Emails', emails\.total\] as const\] : \[\]\)/);
    assert.match(record, /tab === 'emails' && emails && <PersonEmailsTab emails=\{emails\} \/>/);
  });

  it('the Story\'s foot no longer lists "the emails themselves"', () => {
    const record = readCode('app/platform-admin/customer-users/[id]/PersonRecord.tsx');
    assert.doesNotMatch(record, /the emails themselves/);
    assert.match(record, /Not in the Story yet: sign-in history \(only the last sign-in is kept\)\./);
  });

  it('only the Story kinds reach the Story (the filter is the kind list, not a label match)', () => {
    assert.match(person, /storyOnly: true/);
    assert.match(readCode('lib/sent-log.ts'), /if \(opts\.storyOnly\) q = q\.in\('kind', \[\.\.\.STORY_EMAIL_KINDS\]\);/);
  });
});
