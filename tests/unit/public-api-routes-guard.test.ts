/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SIGNED PUBLIC ADDRESSES (Support console Stage 5, threat T25).
 *
 * Every `/api/*` outside `/api/admin` passes `proxy.ts` without a session (proxy.ts ~71). Most such routes check a
 * session or a token of their own; the ones a PROVIDER calls have no session at all, and their signature is their only
 * gate. They are listed here, each with its reason, and each must refuse when its secret is unset and verify a
 * signature before it acts. A new route under app/api/webhooks/ fails this test until it is listed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { filesUnder, readCode } from './_source-code.ts';

const SIGNED_PUBLIC_ROUTES: Record<string, { reason: string; verifies: RegExp; unset: RegExp }> = {
  'app/api/webhooks/resend/route.ts': {
    reason: "the mail service's delivery callback (Stage 5, T25): Resend calls it with no session; its Svix signature is its only gate",
    verifies: /verifyCallback\(/,
    unset: /RESEND_WEBHOOK_SECRET[\s\S]*status: 503/,
  },
  'app/api/payments/connect-webhook/route.ts': {
    reason: "Stripe's events on clubs' connected accounts (Club Tier 12a): Stripe-signed",
    verifies: /constructConnectEvent\(/,
    unset: /status: 503/,
  },
  'app/api/payments/connect-account-events/route.ts': {
    reason: "Stripe's v2 account events (Club Tier 12a): Stripe-signed",
    verifies: /stripe-signature|construct\w*Event\(|parseThinEvent\(|parseEventNotification\(/i,
    unset: /status: 503/,
  },
  'app/api/billing/webhook/route.ts': {
    reason: "Stripe's billing events for a club's subscription: Stripe-signed",
    verifies: /constructEvent\(/,
    unset: /STRIPE_WEBHOOK_SECRET/,
  },
};

describe('the signed public addresses (T25)', () => {
  it('each listed route exists, verifies its signature and refuses without its secret', () => {
    for (const [file, rule] of Object.entries(SIGNED_PUBLIC_ROUTES)) {
      assert.ok(existsSync(file), `${file} exists`);
      assert.ok(rule.reason.length > 20, `${file} has a reason`);
      const src = readCode(file);
      assert.match(src, rule.verifies, `${file} verifies a signature`);
      assert.match(src, rule.unset, `${file} refuses without its secret`);
      assert.doesNotMatch(src, /requirePlatform|getSession\(|auth\.getUser\(/, `${file} is a provider's address, not a session's`);
    }
  });
  it('every route under app/api/webhooks/ is listed', () => {
    const routes = filesUnder('app/api/webhooks', 'route.ts');
    for (const r of routes) assert.ok(SIGNED_PUBLIC_ROUTES[r], `${r} is a public address: list it here with its reason`);
  });
});
