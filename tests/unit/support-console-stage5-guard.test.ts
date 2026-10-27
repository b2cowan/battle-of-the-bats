/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 5 — HEALTH (owner rulings Q1–Q10 + G1–G4, 2026-10-26; build prompt §8; drawing H).
 *
 * A reply is the first customer-facing send the console makes and the delivery callback is a new public address, so
 * both are guarded as security changes. No network, no database here: the callback's checks and the Status lines are
 * pure and run for real; the routes are held to their ORDER by reading their source. The database half (one change
 * per callback, forward only, one reply per click) is proven live on dev by scripts/support-console-stage5-check.sql.
 *   1. the fake mail service (signatures, time, size, tags, our words only);
 *   2. the sender (a kind on every send, which kinds are logged, what a row may hold);
 *   3. Status (fixed answer shape, never cached, failures as fixed sentences, Today never calls a provider);
 *   4. the settings (passed to the server, never public, never AWS_, never in a browser file);
 *   5. powers (reply, sent log, every new route asks first);
 *   6. the migration (grants, RLS, the health function's banned columns);
 *   7. the reply (the server's address, one line of subject, the words, the order);
 *   8. the public address (T25) and the 27 threats, each named to its guard.
 * The sent-log screens, Find's group and the Story rows have their own suite (support-console-stage5-sentlog-guard);
 * the clock has support-console-stage5-clock-guard.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readCode, readSource, filesUnder } from './_source-code.ts';
import { MAX_CALLBACK_BYTES, parseCallback, verifyCallback } from '../../lib/resend-webhook.ts';
import { EMAIL_KINDS, LOGGED_EMAIL_KINDS, STORY_EMAIL_KINDS, emailKindLabel, isLoggedKind, type EmailKind } from '../../lib/email-kinds.ts';
import {
  buildLine, countsLine, errorsLine, failedLine, gatewayLine, servicesLine, stagingSiteLine, summarize, connectionsLine,
  jobsLine, dbAnswersLine, errorRateLine, trafficLine, usual, type CountsFacts, type StatusLine,
} from '../../lib/platform-status-lines.ts';
import { PLATFORM_AREAS, PLATFORM_POWERS, hasPlatformPower } from '../../lib/platform-areas.ts';

// ── 1. The fake mail service ──────────────────────────────────────────────────────────────────────

// The Standard Webhooks / Svix published example (the same "v1,g0hM9S…" value Resend's docs show).
const SVIX = {
  secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: '1614265330',
  body: '{"test": 2432232314}',
  signature: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};
const AT = Number(SVIX.timestamp);

function sign(secret: string, id: string, ts: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;
}

const DB = 'npgnrxaitgbtbtvvykto';
const ROW = '4ef9a2b3-0c1d-4e5f-9a8b-7c6d5e4f3a21';
const event = (type: string, extra: Record<string, unknown> = {}, tags: unknown = { flhq_row: ROW, flhq_db: DB }) => ({
  type,
  created_at: '2026-10-26T13:20:02.000Z',
  data: { email_id: 'abc', to: ['sam.lee@example.com'], subject: 'Invitation to UAT Rep Club', tags, ...extra },
});

describe('1 · the fake mail service: a callback is checked before it is read (T8-T12)', () => {
  it('accepts the published example signature', () => {
    assert.equal(verifyCallback({ id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature }, SVIX.body, SVIX.secret, AT), true);
  });
  it('refuses a valid old signature with a changed time (the time is inside what is signed)', () => {
    const later = String(AT + 60);
    assert.equal(verifyCallback({ id: SVIX.id, timestamp: later, signature: SVIX.signature }, SVIX.body, SVIX.secret, AT + 60), false);
  });
  it('accepts several signatures on one call when one matches, and refuses when none does', () => {
    const many = `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${SVIX.signature} v2,whatever`;
    assert.equal(verifyCallback({ id: SVIX.id, timestamp: SVIX.timestamp, signature: many }, SVIX.body, SVIX.secret, AT), true);
    assert.equal(verifyCallback({ id: SVIX.id, timestamp: SVIX.timestamp, signature: 'v1,AAAA v1,BBBB' }, SVIX.body, SVIX.secret, AT), false);
  });
  it('refuses a missing header, a changed body, an old or future call, an oversize body and a wrong secret', () => {
    const ok = { id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature };
    assert.equal(verifyCallback({ ...ok, id: null }, SVIX.body, SVIX.secret, AT), false);
    assert.equal(verifyCallback({ ...ok, signature: null }, SVIX.body, SVIX.secret, AT), false);
    assert.equal(verifyCallback({ ...ok, timestamp: null }, SVIX.body, SVIX.secret, AT), false);
    assert.equal(verifyCallback(ok, `${SVIX.body} `, SVIX.secret, AT), false);
    assert.equal(verifyCallback(ok, SVIX.body, SVIX.secret, AT + 301), false, 'more than 5 minutes old');
    assert.equal(verifyCallback(ok, SVIX.body, SVIX.secret, AT - 301), false, 'more than 5 minutes in the future');
    assert.equal(verifyCallback(ok, SVIX.body, 'whsec_c29tZXRoaW5nZWxzZQ==', AT), false);
    const big = 'x'.repeat(MAX_CALLBACK_BYTES + 1);
    const ts = String(AT);
    assert.equal(verifyCallback({ id: 'msg_big', timestamp: ts, signature: sign(SVIX.secret, 'msg_big', ts, big) }, big, SVIX.secret, AT), false);
  });
  it('reads our row, our state and a reason from a fixed list — never the subject, the addresses or the provider words', () => {
    const p = parseCallback(event('email.bounced', { bounce: { type: 'Permanent', subType: 'NoEmail', message: 'The email account that you tried to reach does not exist' } }), DB);
    assert.deepEqual(p, { rowId: ROW, state: 'bounced', at: '2026-10-26T13:20:02.000Z', reason: 'address_does_not_exist' });
    assert.deepEqual(Object.keys(p!).sort(), ['at', 'reason', 'rowId', 'state']);
    assert.equal(parseCallback(event('email.bounced', { bounce: { type: 'Permanent', subType: 'General' } }), DB)?.reason, 'other', 'a General bounce never claims the address does not exist');
    assert.equal(parseCallback(event('email.suppressed'), DB)?.reason, 'suppressed');
    assert.equal(parseCallback(event('email.delivery_delayed'), DB)?.state, 'delayed');
    assert.equal(parseCallback(event('email.complained'), DB)?.state, 'complained');
  });
  it("keeps nothing for another site's row, an untagged (family or campaign) email, a malformed tag, or an untracked event (T11)", () => {
    assert.equal(parseCallback(event('email.delivered', {}, { flhq_row: ROW, flhq_db: 'qcttcboqysynwcdyghil' }), DB), null);
    assert.equal(parseCallback(event('email.delivered', {}, {}), DB), null);
    assert.equal(parseCallback(event('email.delivered', {}, { flhq_row: "1' or '1'='1", flhq_db: DB }), DB), null);
    assert.equal(parseCallback(event('email.opened'), DB), null, 'opens are never subscribed and never read');
    assert.equal(parseCallback(event('email.clicked'), DB), null);
    assert.equal(parseCallback(null, DB), null);
  });
  it('accepts the send API\'s array form of tags too', () => {
    assert.equal(parseCallback(event('email.delivered', {}, [{ name: 'flhq_row', value: ROW }, { name: 'flhq_db', value: DB }]), DB)?.rowId, ROW);
  });
  it('the route: no secret = not ready; size and signature before the body is parsed; nothing logged (T8, T12)', () => {
    const src = readCode('app/api/webhooks/resend/route.ts');
    const at = (s: string) => { const i = src.indexOf(s); assert.ok(i >= 0, `route has ${s}`); return i; };
    assert.match(src, /status: 503/);
    assert.ok(at('RESEND_WEBHOOK_SECRET') < at('readCapped(req'), 'the secret is checked before the body is read');
    assert.ok(at('readCapped(req') < at('verifyCallback('), 'the body is capped before it is checked');
    assert.ok(at('verifyCallback(') < at('JSON.parse('), 'the signature holds before the body is parsed');
    assert.ok(at('JSON.parse(') < at("rpc('platform_account_email_event'"), 'one database step, last');
    for (const file of ['app/api/webhooks/resend/route.ts', 'lib/resend-webhook.ts']) {
      assert.doesNotMatch(readCode(file), /console\.|captureError/, `${file} writes nothing to the server log`);
    }
  });
});

// ── 2. The sender ─────────────────────────────────────────────────────────────────────────────────

/** Every `sendEmail(` call's argument text in app/ and lib/ (balanced parentheses; the definition excluded). */
function sendCalls(): { file: string; args: string }[] {
  const out: { file: string; args: string }[] = [];
  const files = ['app', 'lib'].flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')]);
  for (const file of files) {
    const src = readCode(file);
    const re = /\bsendEmail\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const before = src.slice(Math.max(0, m.index - 20), m.index);
      if (/function\s+$/.test(before)) continue;
      let depth = 0;
      let i = m.index + m[0].length - 1;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')' && --depth === 0) break;
      }
      out.push({ file, args: src.slice(m.index, i + 1) });
    }
  }
  return out;
}

describe('2 · the sender: a kind on every send (Q8, T13, T24)', () => {
  it('every sendEmail call in app/ and lib/ names its kind (the build fails on a send without one)', () => {
    const calls = sendCalls();
    assert.ok(calls.length >= 40, `found ${calls.length} send calls`);
    // `log` is sendTransactionalEmail's `{ kind: opts.key, … }` (its key is typed EmailKind).
    const missing = calls.filter(c => !/\bkind\b/.test(c.args) && !/(\.\.\.\s*log\b|,\s*log\s*\)$)/.test(c.args));
    assert.deepEqual(missing.map(c => c.file), [], 'sends without a kind');
  });
  it('the sender requires the kind at the type level and the batch takes only unlogged kinds', () => {
    const src = readCode('lib/email.ts');
    assert.match(src, /opts: SendEmailOptions,\n\): Promise<SendEmailResult>/, 'opts is required (no default)');
    assert.match(src, /kind: EmailKind;/);
    assert.match(src, /kind: UnloggedEmailKind; to: string/);
  });
  it('account and registration kinds are logged; team, family, inbox, alert and test kinds never are (G2)', () => {
    for (const [kind, e] of Object.entries(EMAIL_KINDS)) {
      assert.equal(isLoggedKind(kind as EmailKind), e.klass === 'account' || e.klass === 'registration', kind);
    }
    assert.equal(LOGGED_EMAIL_KINDS.length, 37, 'the 37 kinds the owner approved (G1)');
    assert.equal(isLoggedKind('league_signup'), false, "a league sign-up names a child: it is the club's email, never ours");
    assert.equal(isLoggedKind('ops_alert'), false);
    assert.deepEqual([...STORY_EMAIL_KINDS].sort(), [
      'club_coach_invite', 'coach_access_reminder', 'feedback_reply', 'house_league_coach_invite', 'org_invite',
      'password_reset', 'signup_verification', 'staff_invite', 'team_invitation',
    ]);
  });
  it('a label is fixed words: no placeholder, no name, and an unknown key reads as "Email"', () => {
    for (const [kind, e] of Object.entries(EMAIL_KINDS)) {
      assert.doesNotMatch(e.label, /[{}$<>@]|\d/, `${kind} label is fixed words`);
    }
    assert.equal(emailKindLabel('password_reset'), 'Password reset link');
    assert.equal(emailKindLabel('drop table'), 'Email');
  });
  it('the log writer accepts no subject, body or link, and a failure goes to the server log only (T13, T24)', () => {
    const src = readCode('lib/email-log.ts');
    assert.doesNotMatch(src, /\bsubject\b|\bhtml\b|\btext\b|\blink\b/i);
    assert.doesNotMatch(src, /captureError|observability/);
    assert.match(src, /console\.warn\('\[email-log\] a sent-email row could not be written'\)/);
  });
  it('the row is written before the send; no key = Not sent, a refusal = Failed, no answer = Not confirmed', () => {
    const src = readCode('lib/email.ts');
    const open = src.indexOf('openSentEmailRow(');
    assert.ok(open > 0 && open < src.indexOf('await fetch(RESEND_API, {\n      method'), 'row first');
    assert.match(src, /settleSentEmailRow\(logId, \{ state: 'not_sent' \}\)/);
    assert.match(src, /settleSentEmailRow\(logId, \{ state: 'failed' \}\)/);
    assert.match(src, /settleSentEmailRow\(logId, \{ state: 'unconfirmed' \}\)/);
  });
  // (lib/email.ts imports through the @/ alias, which the unit runner cannot load; its order is held above by source.)
});

// ── 3. Status ─────────────────────────────────────────────────────────────────────────────────────

const clock = () => '8:14 a.m.';
const when = () => 'Oct 26 at 8:14 a.m.';
const COUNTS: CountsFacts = {
  errorsByHour: [21, 2, 1, 3, 2, 2, 4, 1], callsByHour: [312, 280, 290, 270, 300, 260, 280, 285],
  callsByDay: [4557, 4000, 4100, 3900, 4200, 4300, 4000, 4050], errorsByDay: [18, 12, 12, 11, 13, 12, 12, 12],
  topGroup: { id: '0b8c1e1e-1111-4a4a-9b9b-222222222222', n: 19 }, countsAgeMinutes: 3,
};

function everyLine(): StatusLine[] {
  const health = { ms: 41, inUse: 21, max: 60, stuck: 0, jobs: [{ name: 'metrics_fold', failed24h: 0 }] };
  return [
    buildLine('prod_build', { latest: { passed: true, at: '2026-10-26T12:14:00Z', build: '412' }, lastPassed: null, running: false }, when, clock),
    buildLine('staging_build', { latest: { passed: false, at: '2026-10-26T14:05:00Z', build: '1,038' }, lastPassed: { at: '2026-10-26T12:14:00Z' }, running: true }, when, clock),
    stagingSiteLine({ ok: true, ms: 400 }),
    errorsLine(COUNTS), errorRateLine(COUNTS), trafficLine(COUNTS), countsLine(COUNTS),
    dbAnswersLine(health), connectionsLine(health), jobsLine(health),
    servicesLine('db_services', ['auth']), gatewayLine(12), servicesLine('staging_db', []),
    failedLine('db_services', 'Supabase', 'refused'), failedLine('prod_build', 'Amplify', 'no_key'),
    failedLine('staging_build', 'Amplify', 'timeout'),
  ];
}

describe('3 · Status: verdict words, numbers and times only (T2, T6)', () => {
  it('holds no web address, key name, log line, commit message or provider words', () => {
    const json = JSON.stringify(everyLine());
    assert.doesNotMatch(json, /https?:|www\.|\.ca\b|\.com\b/i, 'no web address');
    assert.doesNotMatch(json, /STATUS_|RESEND_|AWS_|SUPABASE_|sbp_|whsec_|AKIA/, 'no key or key name');
    assert.doesNotMatch(json, /commit|stack|Error:|Exception|status_code|select |edge_logs/i, 'no log line, commit message or provider error');
  });
  it('a missing key, a refused key and a 5-second timeout are Not checked with fixed sentences, never Fine', () => {
    assert.deepEqual(failedLine('prod_build', 'Amplify', 'no_key'), {
      id: 'prod_build', verdict: 'unchecked', says: 'This site has no key for Amplify.', todo: 'An owner step; see the help.', headline: null, door: null,
    });
    assert.equal(failedLine('gateway', 'Supabase', 'refused').says, 'Supabase refused our token. It may have expired or been removed.');
    assert.equal(failedLine('staging_build', 'Amplify', 'timeout').says, 'Amplify did not answer within 5 seconds.');
  });
  it('the drawing\'s morning reads as drawn (thresholds G3)', () => {
    const e = errorsLine(COUNTS);
    assert.equal(e.verdict, 'look');
    assert.equal(e.says, '21 in the last hour; a usual hour has 2. 19 of them are one issue.');
    assert.deepEqual(e.door, { to: 'issue', id: COUNTS.topGroup!.id });
    assert.equal(trafficLine(COUNTS).says, '312 calls in the last hour; a usual hour has 280');
    assert.equal(countsLine(COUNTS).says, 'Brought up to date 3 minutes ago; it runs every 5');
    assert.equal(usual([9, 1, 2, 3, 4, 5, 6, 7]), 4);
    assert.equal(connectionsLine({ ms: 1, inUse: 21, max: 60, stuck: 0, jobs: [] }).says, '21 of 60 in use; nothing stuck');
  });
  it('a late counting job says the counts may be out of date, and the lines built on them carry their age', () => {
    const late = { ...COUNTS, countsAgeMinutes: 47 };
    assert.equal(countsLine(late).verdict, 'look');
    assert.match(countsLine(late).says, /may be out of date/);
    assert.match(errorRateLine(late).says, /counts 47 minutes old$/);
  });
  it('a failed production build is Act now; a failed staging build is Look at it', () => {
    const failed = { latest: { passed: false, at: '2026-10-26T14:05:00Z', build: '413' }, lastPassed: { at: '2026-10-26T12:14:00Z' }, running: false };
    assert.equal(buildLine('prod_build', failed, when, clock).verdict, 'act');
    assert.equal(buildLine('staging_build', failed, when, clock).verdict, 'look');
  });
  it('the verdict line counts as drawn ("1 to act on now, 1 to look at, 3 not checked.")', () => {
    const lines: StatusLine[] = [
      buildLine('prod_build', { latest: { passed: false, at: '2026-10-26T14:05:00Z', build: '413' }, lastPassed: null, running: false }, when, clock),
      countsLine({ ...COUNTS, countsAgeMinutes: 47 }),
      failedLine('staging_build', 'Amplify', 'timeout'), failedLine('db_services', 'Supabase', 'refused'), failedLine('gateway', 'Supabase', 'refused'),
      stagingSiteLine({ ok: true, ms: 300 }),
    ];
    const s = summarize(lines);
    assert.equal(s.tone, 'act');
    assert.equal(s.lead, '1 to act on now, 1 to look at, 3 not checked.');
    assert.equal(s.headline, 'The production build failed.');
    assert.equal(summarize([failedLine('gateway', 'Supabase', 'no_key')]).tone, 'look', 'Not checked alone is never shown as fine');
  });
  it('the route asks its power first and is never cached by the browser', () => {
    const src = readCode('app/api/platform-admin/status/route.ts');
    assert.ok(src.indexOf("requirePlatformAreaApi('status', 'view')") < src.indexOf('readStatus()'));
    assert.match(src, /'Cache-Control': 'no-store, private'/);
  });
  it('Today reads the cheap lines only and never calls a provider', () => {
    const today = readCode('app/platform-admin/page.tsx');
    assert.match(today, /readCheapLines\(\)/);
    assert.doesNotMatch(today, /readStatus|peekStatus|client-amplify|api\.supabase\.com/);
    const lib = readCode('lib/platform-status.ts');
    const cheap = lib.slice(lib.indexOf('export async function readCheapLines'), lib.indexOf('const PROVIDER_IDS'));
    assert.doesNotMatch(cheap, /fetch\(|AmplifyClient|supabaseGet|STATUS_/, 'the cheap lines call no provider');
  });
  it('the AWS key only lists builds, and the build list keeps no commit message, address or log link (T3)', () => {
    const lib = readCode('lib/platform-status.ts');
    assert.match(lib, /ListJobsCommand/);
    assert.doesNotMatch(lib, /GetJobCommand|GetArtifactUrl|ListArtifacts|commitMessage|sourceUrl|logUrl/);
  });
  it('the Supabase token never runs a query: the only log question is the fixed count (T4, T5)', () => {
    const lib = readCode('lib/platform-status.ts');
    assert.doesNotMatch(lib, /database\/query/);
    assert.match(lib, /const GATEWAY_SQL =\n  'select count\(\*\) as n from edge_logs/);
  });
});

// ── 4. The settings ───────────────────────────────────────────────────────────────────────────────

const NEW_SETTINGS = ['RESEND_WEBHOOK_SECRET', 'STATUS_AMPLIFY_ACCESS_KEY_ID', 'STATUS_AMPLIFY_SECRET_ACCESS_KEY', 'STATUS_SUPABASE_TOKEN'];

describe('4 · the settings: passed to the server, never public, never where a browser loads (T1)', () => {
  it('each new setting is passed to the server by the build, and none is named public or AWS_', () => {
    const yml = readFileSync('amplify.yml', 'utf8');
    for (const name of NEW_SETTINGS) {
      assert.ok(yml.includes(`echo "${name}=$${name}" >> .env.production`), `${name} reaches the server`);
      assert.doesNotMatch(name, /^AWS_|^NEXT_PUBLIC_/, `${name} is a name the hosting allows and keeps private`);
    }
  });
  it('no browser file names a key', () => {
    const files = ['app', 'components', 'lib'].flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')]);
    for (const file of files) {
      const src = readSource(file);
      if (!/^\s*['"]use client['"]/.test(src)) continue;
      for (const name of NEW_SETTINGS) assert.ok(!src.includes(name), `${file} names ${name}`);
    }
    // The keys are read in exactly two server files.
    const readers = files.filter(f => NEW_SETTINGS.some(n => readCode(f).includes(`process.env.${n}`)));
    assert.deepEqual(readers.sort(), ['app/api/webhooks/resend/route.ts', 'lib/platform-status.ts']);
  });
});

// ── 5. Powers ─────────────────────────────────────────────────────────────────────────────────────

describe('5 · powers: reply and the sent log in the one rulebook (Q3, Q5, T16, T23)', () => {
  it('reply is Super admin and Support; the sent log is Super admin, Support and Billing', () => {
    assert.deepEqual([...PLATFORM_POWERS.reply].sort(), ['super_admin', 'support']);
    assert.deepEqual([...PLATFORM_POWERS.sent_log].sort(), ['billing', 'super_admin', 'support']);
    for (const role of ['billing', 'product', 'growth', 'read_only'] as const) assert.equal(hasPlatformPower(role, 'reply'), false, role);
    for (const role of ['product', 'growth', 'read_only'] as const) assert.equal(hasPlatformPower(role, 'sent_log'), false, role);
  });
  it('Sent emails opens for exactly the sent-log roles; Status for every role; Feedback carries the reply power', () => {
    assert.deepEqual([...PLATFORM_AREAS.sent_emails.viewRoles].sort(), [...PLATFORM_POWERS.sent_log].sort());
    assert.equal(PLATFORM_AREAS.status.viewRoles.length, 6);
    assert.ok(PLATFORM_AREAS.feedback.powers.includes('reply'));
  });
  it('the triage routes ask triage itself, not "any power on the Feedback page"', () => {
    for (const f of ['app/api/platform-admin/feedback/[id]/status/route.ts', 'app/api/platform-admin/feedback/[id]/escalate/route.ts']) {
      assert.match(readCode(f), /requirePlatformPower\('feedback_triage'\)/, f);
    }
  });
});

// ── 6. The migration ──────────────────────────────────────────────────────────────────────────────

describe('6 · migration 389: closed to the browser, the health function reads counts only (T7)', () => {
  const sql = readSource('supabase/migrations/389_support_console_health_and_sent_email_log.sql').replace(/--[^\n]*/g, '');
  it('every new table has RLS on, no browser grant, and an explicit server grant', () => {
    const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)].map(m => m[1]);
    assert.equal(tables.length, 5);
    for (const t of tables) {
      assert.match(sql, new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`), t);
      assert.match(sql, new RegExp(`REVOKE ALL ON TABLE public\\.${t} FROM anon, authenticated`), t);
      assert.match(sql, new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${t} TO service_role`), t);
      assert.doesNotMatch(sql, new RegExp(`CREATE POLICY[^;]*${t}`), `${t} has no policy`);
    }
  });
  it('every function is the server\'s only, and only the health function runs as its owner', () => {
    const fns = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(m => m[1]).filter(n => !n.endsWith('_guard'));
    for (const fn of fns) {
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC;`), fn);
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon, authenticated;`), fn);
      assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role;`), fn);
    }
    // Two run as their owner, both because they must read what the server role cannot: the health counts (every
    // session, the cron schema) and which addresses have an account (auth.users; it returns the matching addresses only).
    assert.equal((sql.match(/SECURITY DEFINER/g) ?? []).length, 2);
    const accounts = sql.slice(sql.indexOf('FUNCTION public.platform_accounts_for_emails'), sql.indexOf('REVOKE ALL ON FUNCTION public.platform_accounts_for_emails'));
    assert.match(accounts, /RETURNS SETOF text/);
    assert.match(accounts, /SELECT DISTINCT lower\(u\.email\)\s+FROM auth\.users u/, 'it returns the address and nothing else');
    assert.match(accounts, /p_emails\[1:200\]/);
    assert.doesNotMatch(sql, /GRANT[^;]*TO (anon|authenticated|PUBLIC)/);
  });
  it("the health function never names a job's command, a run's message, or a session's query, user or address", () => {
    const body = sql.slice(sql.indexOf('FUNCTION public.platform_health_counts()'), sql.indexOf('REVOKE ALL ON FUNCTION public.platform_health_counts'));
    assert.match(body, /SECURITY DEFINER\s+SET search_path = ''/);
    for (const banned of ['command', 'return_message', 'query', 'usename', 'usesysid', 'client_addr', 'client_hostname', 'application_name', 'username', 'database']) {
      assert.ok(!new RegExp(`\\b${banned}\\b`, 'i').test(body), `names ${banned}`);
    }
  });
  it('the log keeps no subject, body or link column (T13)', () => {
    const table = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.platform_account_emails'), sql.indexOf('CREATE INDEX IF NOT EXISTS platform_account_emails_recipient_idx'));
    assert.doesNotMatch(table, /\bsubject\b|\bbody\b|\bhtml\b|\blink\b|\burl\b/);
  });
});

// ── 7. The reply ──────────────────────────────────────────────────────────────────────────────────

describe('7 · the reply: the server chooses the address, the words are fixed, one send (T18-T23)', async () => {
  const words = await import('../../lib/feedback-reply.ts');
  it('the subject is one line of "Re: " and the title, whatever line breaks the title holds (T21)', () => {
    const LS = String.fromCharCode(0x2028);
    assert.equal(words.replySubject(`Line one\r\nBcc: x@y.com${LS}three\u0000`), 'Re: Line one Bcc: x@y.com three');
    assert.equal(words.replySubject(''), 'Re: your feedback');
    assert.ok(words.replySubject('x'.repeat(400)).length <= 154);
  });
  it('signed with a first name, or "FieldLogicHQ support" alone (G4)', () => {
    assert.equal(words.signedFirstName('Alex Morgan'), 'Alex');
    assert.equal(words.signedFirstName('alex@fieldlogichq.ca'), '');
    assert.equal(words.signedFirstName(null), '');
    const text = words.replyText({ body: 'Hi Jamie', signedName: '', feedbackAt: '2026-10-26T13:15:00Z', feedbackBody: 'It broke\nagain' });
    assert.match(text, /^Hi Jamie\n\nFieldLogicHQ support\n\nOn Oct 26, 2026 at 9:15 a\.m\., you wrote:\n> It broke\n> again\n\n/);
    assert.ok(text.endsWith(words.REPLY_FOOT));
  });
  it('New and Triaged move to Acknowledged; Acknowledged and Resolved stay (Q5, G4)', () => {
    assert.equal(words.stateAfterReply('new').next, 'acknowledged');
    assert.equal(words.stateAfterReply('triaged').next, 'acknowledged');
    assert.equal(words.stateAfterReply('acknowledged').next, null);
    assert.equal(words.stateAfterReply('resolved').next, null);
  });
  const route = readCode('app/api/platform-admin/feedback/[id]/reply/route.ts');
  it('the reply power is asked before anything is read (T23)', () => {
    const power = route.indexOf("requirePlatformPower('reply')");
    assert.ok(power > 0 && power < route.indexOf('await supabaseAdmin') && power < route.indexOf('req.json()'));
  });
  it('the browser names no recipient and no header (T18, T21)', () => {
    assert.doesNotMatch(route, /input\.(to|email|address|subject|from|replyTo|headers)/);
    assert.match(route, /sendEmail\(row\.to_email, replySubject\(feedback\.title/);
    assert.match(route, /const target = await replyTarget\(feedback\)/);
  });
  it('one claim, one once-only key, a day to retry, an audit entry; never Resolved (T20, T22)', () => {
    assert.match(route, /\.eq\('status', row\.status\)\n    \.select\('id'\)/, 'the claim is a conditional update');
    assert.match(route, /idempotencyKey: `feedback-reply-\$\{row\.id\}-\$\{attempt\}`/);
    assert.match(route, /RETRY_WINDOW_MS/);
    assert.match(route, /writePlatformAuditLog\(staffEmail/);
    assert.match(route, /\.in\('status', \['new', 'triaged'\]\)/);
    assert.doesNotMatch(route, /'resolved'/);
    assert.match(route, /REPLIES_PER_DAY/);
  });
  it('only the request holding the claim finishes it; a stall is timed from the claim, not the first send (/review)', () => {
    assert.match(route, /claimed_at: myClaim/);
    assert.match(route, /\.eq\('status', 'sending'\)\n\s+\.eq\('claimed_at', myClaim\)/, 'finish is conditional on our claim');
    assert.match(route, /const claimedAt = existing\.claimed_at \?\? existing\.sending_at;/);
    assert.match(route, /logId = await openSentEmailRow\(/, 'the attempt keeps one log row from its claim');
  });
  it('only a definite refusal is "nothing was sent"; an ambiguous answer is Not confirmed and retries the same key (/review)', () => {
    assert.match(route, /result\.status === 'provider_error' && !result\.refused/);
    const sender = readCode('lib/email.ts');
    assert.match(sender, /const DEFINITE_REFUSALS = new Set\(\[400, 401, 403, 404, 422\]\);/);
  });
});

// ── 8. The public address and the threat list ─────────────────────────────────────────────────────

describe('8 · the 27 threats, each named to its guard (drawing H)', () => {
  const THREATS: Record<string, string> = {
    T1: '4 · no browser file names a key',
    T2: '3 · holds no web address, key name, log line, commit message or provider words',
    T3: '3 · the AWS key only lists builds',
    T4: '3 · the Supabase token never runs a query (token scope itself: the release step)',
    T5: '3 · the only log question is the fixed count',
    T6: 'the 30-second claim: platform_status_claim (live check, scripts/support-console-stage5-check.sql)',
    T7: "6 · the health function never names a job's command…",
    T8: '1 · signatures, time, size',
    T9: 'live check: the same callback twice = one change',
    T10: 'live check: delivered and bounced = bounced',
    T11: "1 · keeps nothing for another site's row…",
    T12: '1 · the route: nothing logged',
    T13: '2 · the log writer accepts no subject… and 6 · no subject column',
    T14: 'support-console-stage5-sentlog-guard: the Story rows follow the sent-log power',
    T15: 'lib/sent-log.ts staffEmailList filter (sentlog guard)',
    T16: 'sentlog guard: every sent-log route asks sent_log first',
    T17: 'sentlog guard: search limit and records-opened row',
    T18: '7 · the browser names no recipient',
    T19: '7 · replyTarget (gone, changed, unconfirmed, blocked, too old)',
    T20: '7 · the daily limit and the audit entry',
    T21: '7 · the subject is one line',
    T22: '7 · one claim, one once-only key + live check',
    T23: '7 · the reply power is asked first',
    T24: '2 · a log failure goes to the server log only',
    T25: 'public-api-routes-guard: the callback is a known public address',
    T26: 'support-console-stage5-clock-guard / Errors person link (staff = Super admin only)',
    T27: 'unchanged from today: no IP address or browser shown (Errors pages)',
  };
  it('lists all 27, in order, each with a guard or a named reason', () => {
    assert.deepEqual(Object.keys(THREATS), Array.from({ length: 27 }, (_, i) => `T${i + 1}`));
    for (const [id, guard] of Object.entries(THREATS)) assert.ok(guard.length > 10, id);
  });
});
