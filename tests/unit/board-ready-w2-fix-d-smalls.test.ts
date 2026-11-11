import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trustedClientIp } from '../../lib/trusted-client-ip.ts';

/**
 * Board Ready W2 fix D — the small items of the third access sweep (docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md, § Small).
 * Item 1 (demo billing) is pinned in demo-sandbox-write-guard.test.ts, item 2 (team pay links) in team-pay-link-version.test.ts.
 */
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const req = (headers: Record<string, string>) => new Request('https://www.fieldlogichq.ca/api/feedback', { method: 'POST', headers });
/** The text of one top-level function, from its signature to the next top-level `export`/`function`/`async function` line. */
function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `${signature} not found`);
  const rest = src.slice(start + signature.length);
  const next = rest.search(/\n(?:export |async function |function )/);
  return rest.slice(0, next < 0 ? undefined : next);
}

describe('item 3 — the feedback form keys its limit on the address our own edge saw', () => {
  it('a caller cannot choose their address by starting x-forwarded-for', () => {
    // The old reader (lib/rate-limit.ts clientIpFrom) takes the FIRST entry, which a caller sets; this takes the one our edge appended.
    const forged = req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });
    assert.equal(trustedClientIp(forged), '203.0.113.9');
    assert.equal(trustedClientIp(req({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 203.0.113.9' })), '203.0.113.9');
    assert.equal(trustedClientIp(req({ 'x-forwarded-for': ' 203.0.113.9 ' })), '203.0.113.9');
  });

  it('prefers the address CloudFront wrote itself over any list', () => {
    assert.equal(trustedClientIp(req({ 'cloudfront-viewer-address': '203.0.113.9:4711', 'x-forwarded-for': '1.2.3.4' })), '203.0.113.9');
    assert.equal(trustedClientIp(req({ 'cloudfront-viewer-address': '[2001:db8::1]:4711' })), '2001:db8::1');
    // A value with no port loses nothing (it used to lose its last character).
    assert.equal(trustedClientIp(req({ 'cloudfront-viewer-address': '203.0.113.9' })), '203.0.113.9');
  });

  it('falls back safely: x-real-ip, then one shared "unknown" bucket (never a caller-chosen value)', () => {
    assert.equal(trustedClientIp(req({ 'x-real-ip': '203.0.113.9' })), '203.0.113.9');
    assert.equal(trustedClientIp(req({})), 'unknown');
    assert.equal(trustedClientIp(req({ 'x-forwarded-for': ' , ' })), 'unknown');
  });

  it('the route uses it, and the daily cap is checked after validation and before the slot is committed and the row written', () => {
    const route = read('app/api/feedback/route.ts');
    assert.match(route, /const ip = trustedClientIp\(req\)/);
    assert.ok(!route.includes('x-forwarded-for'), 'the route no longer reads the header itself');
    const cap = route.indexOf('feedbackOverDailyCap(');
    assert.ok(cap > route.indexOf('validateFeedbackInput('), 'after validation (a bad body costs no query)');
    assert.ok(cap < route.indexOf('globalCount += 1'), 'before the in-memory slot is committed');
    assert.ok(cap < route.indexOf(".from('feedback_submissions').insert"), 'before the row is written');
    assert.match(route, /feedbackOverDailyCap\(\{ userId: user\?\.id \?\? null, ip \}\)\) return throttled\(\)/, 'answers the same soft 202 as every other limit');
  });

  it('the cap counts what the database saved, per address and in total for anonymous, per account when signed in', () => {
    const src = read('lib/feedback-daily-cap.ts');
    assert.match(src, /ANON_PER_IP_PER_DAY = \d+/);
    assert.match(src, /ANON_ALL_PER_DAY = \d+/);
    assert.match(src, /USER_PER_DAY = \d+/);
    assert.match(src, /\.eq\('user_id', who\.userId\)/);
    assert.match(src, /\.is\('user_id', null\)\.eq\('context->>ip', who\.ip\)/);
    assert.match(src, /\.gte\('created_at', since\)/);
    // A failed read lets the report through: the insert would fail too if the database were down.
    assert.match(src, /catch \(e\)[\s\S]*return false;/);
  });
});

describe('item 4 — the dev seed guard refuses in production, as its sibling does', () => {
  const src = read('lib/platform-auth.ts');
  const dev = fnBody(src, 'export async function requireDevToolPlatformAdmin()');
  const sibling = fnBody(src, 'export async function requireDevToolUserAuth()');

  it('the platform-admin dev guard has the same production refusal as requireDevToolUserAuth', () => {
    assert.match(sibling, /NODE_ENV === 'production'/);
    assert.match(dev, /NODE_ENV === 'production'/);
  });

  it('refuses (404) before it asks who is signed in', () => {
    assert.ok(dev.indexOf("NODE_ENV === 'production'") < dev.indexOf('await requirePlatformAdmin()'));
    assert.ok(dev.indexOf("NODE_ENV === 'production'") > dev.indexOf('NEXT_PUBLIC_ENABLE_DEV_TOOLS'));
  });
});

describe('item 5 — defence in depth', () => {
  it('a family claim also needs a confirmed email, checked before anything is claimed or written', () => {
    const inv = read('lib/family-invitation.ts');
    const accept = fnBody(inv, 'export async function acceptInvitation(');
    assert.match(accept, /if \(!params\.emailConfirmedAt\) return \{ kind: 'email_unconfirmed' \}/);
    assert.ok(accept.indexOf('params.emailConfirmedAt') < accept.indexOf('.update({ used_at'), 'before the invitation is claimed');
    assert.ok(accept.indexOf('emailMatches(') < accept.indexOf('params.emailConfirmedAt'));
    // The new-account path created the account already confirmed (email_confirm: true) and passes the account's own stamp.
    assert.match(inv, /emailConfirmedAt: data\.user\.email_confirmed_at,/);
    const route = read('app/api/family/claim/[token]/route.ts');
    assert.match(route, /emailConfirmedAt: user\.email_confirmed_at/);
    assert.match(route, /outcome\.kind === 'email_unconfirmed'\) return NextResponse\.json\(\{ error: 'email_unconfirmed' \}, \{ status: 403 \}\)/);
  });

  it('payouts/return builds every redirect on a trusted origin, never the request’s own', () => {
    const src = read('app/api/admin/payouts/return/route.ts');
    // The same-request resolver: keeps the admin on the host they arrived at (our own hosts only), so their cookie still travels.
    assert.match(src, /const origin = resolveSameHostOrigin\(req\)/);
    assert.ok(!/\$\{url\.origin\}|, url\.origin\)/.test(src), 'no redirect is built on url.origin');
    assert.match(src, /new URL\(payoutsHref\(ctx\.org\), origin\)/);
    assert.match(src, /new URL\(`\/auth\/login\?next=.*, origin\)/);
  });

  it('a Stripe "session expired" event closes only the payment on the account it came from', () => {
    const landing = read('lib/online-payment-landing.ts');
    const expire = fnBody(landing, 'export async function expireCheckoutSession(');
    assert.match(landing, /expireCheckoutSession\(sessionId: string, stripeAccountId: string\)/);
    assert.match(expire, /\.eq\('stripe_checkout_session_id', sessionId\)\.eq\('stripe_account_id', stripeAccountId\)/);
    assert.match(read('app/api/payments/connect-webhook/route.ts'), /expireCheckoutSession\(\(event\.data\.object as Stripe\.Checkout\.Session\)\.id, account\)/);
    assert.match(read('lib/online-pay-pages.ts'), /expireCheckoutSession\(r\.stripe_checkout_session_id, r\.stripe_account_id\)/);
  });

  it('the deletion request’s operator email escapes everything a customer typed or named', () => {
    const email = read('lib/email.ts');
    const body = fnBody(email, 'export function orgDeletionRequestHtml(');
    // Take away every escaped interpolation; nothing else of the payload may remain in a cell.
    const rest = body.replace(/escapeHtml\(p\.\w+\)/g, '');
    assert.ok(!/p\.(orgName|orgSlug|orgId|ownerEmail|planLabel|requestedAt)/.test(rest), 'every field is escaped: ' + rest.match(/p\.\w+/g));
    assert.match(body, /p\.reason \? escapeHtml\(p\.reason\) : '<em>No reason provided<\/em>'/);
  });
});
