import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { PLATFORM_AREAS, PLATFORM_POWERS, canViewPlatformArea, isPlatformAreaReadOnly } from '../../lib/platform-areas.ts';
import { PA_WORDS } from '../../lib/online-payment-words.ts';

/**
 * CLUB TIER STAGE 12d-2 PART 5: THE CONSOLE'S ONLINE PAYMENTS (frame 6, words §6; ask 7: read only; owner ruling 3,
 * 2026-10-27: Super admin, Billing and Support). A club's Online payments tab and one Health list across clubs.
 */
describe('console access by role (owner ruling 3)', () => {
  it('Super admin, Billing and Support read it; Product, Growth and Read-only do not', () => {
    for (const role of ['super_admin', 'billing', 'support'] as const) assert.equal(canViewPlatformArea(role, 'online_payments'), true, role);
    for (const role of ['product', 'growth', 'read_only'] as const) assert.equal(canViewPlatformArea(role, 'online_payments'), false, role);
  });
  it('one rulebook: the area holds exactly the Stripe-reading power’s roles, and carries no power (read only)', () => {
    assert.equal(PLATFORM_AREAS.online_payments.viewRoles, PLATFORM_POWERS.find_stripe);
    assert.deepEqual([...PLATFORM_AREAS.online_payments.powers], []);
    assert.equal(isPlatformAreaReadOnly('support', 'online_payments'), false, 'no controls, so never the eye');
  });
  it('the routes ask the same power, and the page the same area', () => {
    assert.match(readCode('app/api/platform-admin/orgs/[id]/online-payments/route.ts'), /requirePlatformPower\('find_stripe'\)/);
    assert.match(readCode('app/api/platform-admin/orgs/[id]/online-payments/player/route.ts'), /requirePlatformPower\('find_stripe'\)/);
    assert.match(readCode('app/platform-admin/online-payments/page.tsx'), /requirePlatformAreaView\('online_payments'\)/);
    assert.match(readCode('app/platform-admin/orgs/[id]/page.tsx'), /const onlinePayments = readsStripe \? await readClubOnlinePayments\(id\)/);
  });
  it('the Health menu entry and Today’s count', () => {
    assert.match(readCode('app/platform-admin/console-menu.ts'), /\{ href: '\/platform-admin\/online-payments', label: 'Online payments', icon: 'payments', area: 'online_payments' \}/);
    const waiting = readCode('lib/platform-waiting.ts');
    assert.match(waiting, /key: 'online_payments', group: 'health'/);
    assert.match(waiting, /readOnlinePaymentsHealth\(\)\.then\(r => r\.length\)\.catch\(\(\) => null\)/);
  });
});

describe('read only (ask 7): nothing writes, never a card or bank number, a name only on request and logged', () => {
  it('the reads write nothing', () => {
    const lib = readCode('lib/platform-online-payments.ts');
    assert.doesNotMatch(lib, /\.(insert|update|upsert|delete)\(/);
    assert.doesNotMatch(lib, /card_last4|bank_last4|player_first_name/);
    const tab = readCode('app/platform-admin/orgs/[id]/OnlinePaymentsTab.tsx');
    assert.match(tab, /<StripeFeesPanel orgId=\{orgId\} canRetry=\{false\} \/>/);
    assert.doesNotMatch(tab, /'(PATCH|DELETE)'/);
  });
  it('Show the player logs every opening, and reads only this club’s payment', () => {
    const player = readCode('app/api/platform-admin/orgs/[id]/online-payments/player/route.ts');
    assert.match(player, /\.eq\('id', paymentId\)\.eq\('org_id', id\)/);
    assert.match(player, /writePlatformAuditLog\([^)]*'online_payment_player_shown'/);
    assert.doesNotMatch(player, /card_last4|bank_last4/);
  });
  it('a club that never connected has no tab', () => {
    assert.match(readCode('lib/platform-online-payments.ts'), /if \(!acctRow\) return null;/);
    assert.match(readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx'), /TABS\.filter\(t => t\.key !== 'payments' \|\| props\.onlinePayments !== null\)/);
  });
});

describe('the Health list (words §6.2)', () => {
  const H = PA_WORDS.health;
  it('its rows', () => {
    assert.equal(H.dispute(1, 'Nov 3'), '1 open dispute, due Nov 3');
    assert.equal(H.dispute(2, 'Nov 3'), '2 open disputes, first due Nov 3');
    assert.equal(H.disconnected(2), 'Disconnected with 2 disputes open');
    assert.equal(H.messages(1), '1 Stripe message failed');
    assert.equal(H.empty, 'Nothing needs a look.');
  });
  it('most urgent first; the terms row only once counsel’s dated version exists; messages older than 30 days stop', () => {
    const lib = readCode('lib/platform-online-payments.ts');
    assert.match(lib, /const KIND_ORDER: Record<HealthKind, number> = \{ dispute: 0,/);
    assert.match(lib, /termsVersionDate\(PAYMENTS_TERMS_VERSION\) && termsStanding\(a\.terms_version\) === 'stale'/);
    assert.match(lib, /\.gte\('received_at', cut\)/);
  });
  it('the Story gains the online-payment events', () => {
    const story = readCode('lib/platform-story.ts');
    for (const a of ['payouts_fee_payer_changed', 'payouts_terms_agreed', 'payouts_closed_by_stripe']) assert.ok(story.includes(`'${a}'`), a);
    assert.match(readCode('app/api/payments/connect-account-events/route.ts'), /action: 'payouts_closed_by_stripe'/);
  });
});
