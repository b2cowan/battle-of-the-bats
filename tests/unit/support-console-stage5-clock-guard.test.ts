/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 5 — Errors restyled, and the house clock without a leading zero
 * (owner Q4 and Q9, 2026-10-26; PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_BUILD_PROMPT.md Part 5 and Part 9; threats T26, T27).
 *
 *   1. THE CLOCK GATE. The house clock is "6:18 p.m." Errors and Feedback printed "06:18 p.m." because the time is BUILT at
 *      runtime (`hour: '2-digit'`), so a gate that only reads literals could not see it. The spelling gate now reads the
 *      options object around every `hour: '2-digit'` (a 24-hour axis label stays legal) and a written-out leading-zero time.
 *      The rules live in scripts/lib/clock-spelling.mjs; the gate itself runs clean over the repo.
 *   2. NO SECOND CLOCK ON THE TWO SCREENS. Errors (list and issue) and the Feedback list print times through
 *      lib/console-dates.ts, and never through fmtAbsoluteDateTime, which has no time zone and printed UTC on the server.
 *   3. THE ISSUE'S TITLE reads as a sentence; the exact route stays in its column.
 *   4. THE PERSON LINK (Q4, T26): five honest states, a staff account links for Super admin only, and the rule is the
 *      person record's own, not a second one. No IP address or browser anywhere on the way (T27).
 *   5. THE CAVEAT is one sentence with no number in it, so it cannot go stale.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readCode, readSource } from './_source-code.ts';
import { LEADING_ZERO_CLOCK, twoDigitTwelveHourHits } from '../../scripts/lib/clock-spelling.mjs';
import { issueSentence, routeInWords } from '../../lib/observability/issue-title.ts';
import { decideWho, personHref, clubHref, type SampleWho } from '../../lib/observability/sample-who.ts';

const LIST = 'app/platform-admin/observability/page.tsx';
const ISSUE = 'app/platform-admin/observability/[groupId]/page.tsx';
const SAMPLES = 'app/platform-admin/observability/[groupId]/SamplesTable.tsx';
const FEEDBACK = 'app/platform-admin/feedback/page.tsx';

// ── 1 · The clock gate ───────────────────────────────────────────────────────────────────────────────────────────────
describe('1 · the spelling gate learns the leading zero', () => {
  it('catches hour: \'2-digit\' on a twelve-hour clock (single quotes, double quotes, multi-line, a bare 2-digit minute beside it)', () => {
    assert.equal(twoDigitTwelveHourHits(`d.toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit' });`).length, 1);
    assert.equal(twoDigitTwelveHourHits(`d.toLocaleString("en-CA", { hour: "2-digit", minute: "2-digit" });`).length, 1);
    const multi = `const OPTS = {\n  year: 'numeric',\n  hour: '2-digit',\n  minute: '2-digit',\n};`;
    const hits = twoDigitTwelveHourHits(multi);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 3);
  });

  it('leaves a 24-hour label alone (hour12: false, hourCycle h23 / h24) and the numeric hour', () => {
    assert.equal(twoDigitTwelveHourHits(`d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });`).length, 0);
    assert.equal(twoDigitTwelveHourHits(`x({\n  hour: '2-digit',\n  hourCycle: 'h23',\n})`).length, 0);
    assert.equal(twoDigitTwelveHourHits(`x({ hour: '2-digit', hourCycle: "h24" })`).length, 0);
    assert.equal(twoDigitTwelveHourHits(`d.toLocaleString('en-CA', { hour: 'numeric', minute: '2-digit' });`).length, 0);
  });

  it('judges each options object on its own (a 24-hour one beside a 12-hour one)', () => {
    const two = `const a = { hour: '2-digit', hour12: false };\nconst b = { hour: '2-digit', minute: '2-digit' };`;
    const hits = twoDigitTwelveHourHits(two);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 2);
  });

  it('catches a written-out leading-zero time, and only that', () => {
    const bad = ['06:18 p.m.', '06:18 PM', '09:05 am', '01:00 p.m.', 'at 08:30 a.m. sharp'];
    const good = ['6:18 p.m.', '12:30 p.m.', '10:15 a.m.', '06:00', '16:18', '2026-06-18 12:06:18'];
    for (const t of bad) {
      LEADING_ZERO_CLOCK.pattern.lastIndex = 0;
      assert.ok(LEADING_ZERO_CLOCK.pattern.test(t), `should catch "${t}"`);
    }
    for (const t of good) {
      LEADING_ZERO_CLOCK.pattern.lastIndex = 0;
      assert.ok(!LEADING_ZERO_CLOCK.pattern.test(t), `should leave "${t}" alone`);
    }
  });

  it('the gate runs clean over the repo (every hit it found was fixed, not waived)', () => {
    execFileSync('node', ['scripts/check-spelling-consistency.mjs'], { cwd: new URL('../..', import.meta.url), stdio: 'pipe' });
  });

  it('the shared formatter can no longer print a leading zero', () => {
    const code = readCode('lib/format-date.ts');
    assert.doesNotMatch(code, /hour:\s*'2-digit'/);
  });
});

// ── 2 · One clock on Errors and Feedback ─────────────────────────────────────────────────────────────────────────────
describe('2 · Errors and Feedback print times through the console\'s house clock', () => {
  for (const file of [LIST, ISSUE, SAMPLES, FEEDBACK]) {
    it(`${file} builds no clock of its own`, () => {
      const code = readCode(file);
      assert.doesNotMatch(code, /fmtAbsoluteDateTime|fmtDateTime|fmtAbsoluteDate\b/);
      assert.doesNotMatch(code, /toLocale(?:Time|Date)?String\([^)]*(?:hour|timeStyle)/);
      assert.doesNotMatch(code, /hour\s*:\s*['"]2-digit['"]/);
    });
  }

  for (const file of [LIST, ISSUE, FEEDBACK]) {
    it(`${file} imports consoleWhen / consoleClock from lib/console-dates`, () => {
      assert.match(readCode(file), /from '@\/lib\/console-dates'/);
    });
  }

  it('the issue page reads "Oct 26" over "at 9:02 a.m." in its band, and the samples carry the house form', () => {
    const code = readCode(ISSUE);
    assert.match(code, /consoleDay\(g\.first_seen_at\)/);
    assert.match(code, /at \{consoleClock\(g\.first_seen_at\)\}/);
    assert.match(code, /when: consoleWhen\(ev\.occurred_at\)/);
  });
});

// ── 3 · The title as a sentence ──────────────────────────────────────────────────────────────────────────────────────
describe('3 · an issue\'s title reads as a sentence', () => {
  it('names the error and the page in words', () => {
    assert.equal(
      issueSentence('TypeError @ /[orgSlug]/admin/house-league/seasons/[seasonId]/registrations'),
      'TypeError on the Registrations page',
    );
    assert.equal(issueSentence('ReferenceError @ /[orgSlug]/admin/org/settings'), 'ReferenceError on the Settings page');
    assert.equal(issueSentence('Error @ /api/coaches/teams'), 'Error in the Teams call');
    assert.equal(issueSentence('HTTP 500 (returned) @ /api/admin/teams'), 'HTTP 500 in the Teams call');
  });

  it('skips a trailing id, and rebuilds from the group\'s own columns when the title is empty', () => {
    assert.equal(issueSentence('TypeError @ /dev-league-org/admin/house-league/seasons/12345'), 'TypeError on the Seasons page');
    assert.equal(issueSentence(null, 'TypeError', '/[orgSlug]/admin/teams'), 'TypeError on the Teams page');
  });

  it('never invents a sentence: a title of another shape, or a route with no name, is shown as stored', () => {
    assert.equal(issueSentence('Payment webhook failed'), 'Payment webhook failed');
    assert.equal(issueSentence('TypeError @ /[orgSlug]'), 'TypeError @ /[orgSlug]');
    assert.equal(issueSentence(null, null, null), 'Untitled error');
    assert.equal(issueSentence('', 'RangeError', null), 'RangeError');
    assert.equal(routeInWords('/'), null);
  });

  it('the list and the record both use it, and the exact route keeps its own column', () => {
    assert.match(readCode(LIST), /issueSentence\(row\.title, row\.errorName, row\.route\)/);
    assert.match(readCode(ISSUE), /issueSentence\(g\.title, g\.error_name, g\.route\)/);
    assert.match(readCode(LIST), /<th>Route<\/th>/);
  });
});

// ── 4 · The person link ──────────────────────────────────────────────────────────────────────────────────────────────
describe('4 · the person link on a sample (Q4, T26)', () => {
  const ada = { id: 'u-1', email: 'ada@example.com', displayName: 'Ada Lovelace' };
  const staff = { id: 'u-2', email: 'staff@fieldlogichq.ca', displayName: null };
  const staffEmails = new Set(['staff@fieldlogichq.ca']);
  const viewer = (role: Parameters<typeof decideWho>[2]['role'], mayOpenPeople = true) => ({ role, mayOpenPeople });
  const row = { user_id: 'u-1', user_email: 'ada@example.com', user_role: 'administrator' };

  it('a customer is a link to their record, with name, address and role', () => {
    const who = decideWho(row, ada, viewer('support'), staffEmails);
    assert.deepEqual(who, { kind: 'person', name: 'Ada Lovelace', email: 'ada@example.com', role: 'administrator', href: personHref('u-1') });
    assert.equal(personHref('u-1'), '/platform-admin/customer-users/u-1');
    assert.equal(clubHref('o-1'), '/platform-admin/orgs/o-1');
  });

  it('a customer with no name reads as their address', () => {
    const who = decideWho(row, { ...ada, displayName: null }, viewer('product'), staffEmails) as Extract<SampleWho, { kind: 'person' }>;
    assert.equal(who.name, 'ada@example.com');
  });

  it('a staff account links for Super admin only; everyone else reads "A staff account" with no name, address or link', () => {
    const staffRow = { user_id: 'u-2', user_email: 'staff@fieldlogichq.ca', user_role: 'owner' };
    assert.deepEqual(decideWho(staffRow, staff, viewer('support'), staffEmails), { kind: 'staff' });
    assert.deepEqual(decideWho(staffRow, staff, viewer('product'), staffEmails), { kind: 'staff' });
    const forSuper = decideWho(staffRow, staff, viewer('super_admin'), new Set()) as Extract<SampleWho, { kind: 'person' }>;
    assert.equal(forSuper.kind, 'person');
    assert.equal(forSuper.href, personHref('u-2'));
  });

  it('a role that cannot open people still reads the name, with no link', () => {
    const who = decideWho(row, ada, viewer('billing', false), staffEmails) as Extract<SampleWho, { kind: 'person' }>;
    assert.equal(who.kind, 'person');
    assert.equal(who.href, null);
  });

  it('a deleted account (a user id, no account behind it) shows the stored address as plain text, no link', () => {
    assert.deepEqual(decideWho(row, undefined, viewer('support'), staffEmails), { kind: 'gone', email: 'ada@example.com' });
  });

  it('a deleted STAFF account is still not named to a role that may not open staff records', () => {
    const staffRow = { user_id: 'u-9', user_email: 'staff@fieldlogichq.ca', user_role: null };
    assert.deepEqual(decideWho(staffRow, undefined, viewer('support'), staffEmails), { kind: 'staff' });
  });

  it('nobody signed in says so; a stored address with no account number is plain text', () => {
    assert.deepEqual(decideWho({ user_id: null, user_email: null, user_role: null }, undefined, viewer('support'), staffEmails), { kind: 'nobody' });
    assert.deepEqual(
      decideWho({ user_id: null, user_email: 'pat@example.com', user_role: 'coach' }, undefined, viewer('support'), staffEmails),
      { kind: 'text', email: 'pat@example.com', role: 'coach' },
    );
    assert.deepEqual(
      decideWho({ user_id: null, user_email: 'staff@fieldlogichq.ca', user_role: null }, undefined, viewer('product'), staffEmails),
      { kind: 'staff' },
    );
  });

  it('an unreadable sign-in record is a fixed sentence, never a guess', () => {
    assert.deepEqual(decideWho(row, undefined, viewer('support'), staffEmails, true), { kind: 'unread' });
  });

  it('follows the person record\'s OWN rule: the same two functions, not a second rule', () => {
    const resolver = readCode('lib/observability/sample-people.ts');
    assert.match(resolver, /isPlatformAdminEmail/);
    assert.match(resolver, /canViewPlatformArea\(viewerRole, 'customer_users'\)/);
    assert.match(resolver, /peopleByIds/); // Stage 2's batched lookup, one call for the page
    const record = readCode('app/platform-admin/customer-users/[id]/page.tsx');
    assert.match(record, /auth\.role !== 'super_admin' && await isPlatformAdminEmail\(person\.email\)/);
  });

  it('never reads or shows an IP address or a browser (T27)', () => {
    for (const file of ['lib/observability/dashboard.ts', 'lib/observability/sample-people.ts', 'lib/observability/sample-who.ts', SAMPLES, ISSUE]) {
      assert.doesNotMatch(readCode(file), /ip_address|user_agent/, file);
    }
  });

  it('the sample table links the person and the club, and the window carries the foot sentence', () => {
    const code = readCode(SAMPLES);
    assert.match(code, /<th>When<\/th>[\s\S]*<th>Who<\/th>[\s\S]*<th>Club<\/th>[\s\S]*<th>Source<\/th>[\s\S]*Status code/);
    assert.match(code, /size="medium"/); // 640
    assert.match(readSource(SAMPLES), /Emails in the message are removed before it is kept\./);
  });

  it('Related feedback opens the feedback\'s own record', () => {
    assert.match(readCode(ISSUE), /href=\{`\/platform-admin\/feedback\/\$\{f\.id\}`\}/);
  });
});

// ── 5 · The caveat ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('5 · the caveat is one sentence that cannot go stale', () => {
  it('says what the rate counts without quoting a route count, and drops the promise that coverage "expands"', () => {
    const src = readSource(LIST);
    assert.match(src, /The error rate counts API calls\. Errors on pages and in browsers are in Captured errors but have no call count to\s+divide by\./);
    assert.doesNotMatch(src, /591|616|later phases/);
  });
});
