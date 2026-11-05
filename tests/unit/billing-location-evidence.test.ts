import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';
import { billingTestLoader } from './_billing-test-loader.ts';
import { REVIEW_CONSEQUENCE } from '../../lib/billing-location.ts';

/**
 * GST/HST Stage 1 Part 3 (build prompt docs/projects/active/GST_HST_STAGE1_PART3_BUILD_PROMPT.md; owner rulings 2026-11-04):
 *   · Stripe's billing page no longer edits the address, so nothing reads a Stripe customer's address back;
 *   · the billing webhook keeps the card country current (newest card, read from Stripe's current list);
 *   · "needs review" is worked out when read: the one stored flag (a Canada↔US change after paying, which stays) or the card
 *     and payout evidence as it stands, so an evidence flag sets and clears with the facts and never goes stale (Ask 1);
 *   · a Founding next-season choice counts as paying for that flag, and only for it (Ask 3);
 *   · a "Start your club" address reaches Stripe only once the move is accepted (Ask 2);
 *   · platform admin reads it, read only, on the Money tab.
 */

const codeFiles = (dirs: string[]) => dirs.flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')]);

const CLUB = '00000000-0000-4000-8000-000000000001';
const PORTAL = '00000000-0000-4000-8000-000000000002';
const ORPHAN = '00000000-0000-4000-8000-000000000003';

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const writes: Array<{ table: string; op: string; payload: Row }> = [];
  const from = (table: string) => {
    let op = 'select';
    let payload: Row = {};
    const filters: Array<(r: Row) => boolean> = [];
    const run = () => {
      const rows = (tables[table] ?? []).filter(r => filters.every(f => f(r)));
      if (op === 'update') {
        rows.forEach(r => Object.assign(r, payload));
        writes.push({ table, op, payload });
        return rows;
      }
      if (op === 'insert') {
        const r = { id: `new-${(tables[table] ?? []).length}`, card_country: null, review_reason: null, review_note: null, review_set_at: null, ...payload };
        (tables[table] ??= []).push(r);
        writes.push({ table, op, payload });
        return [r];
      }
      return rows.map(r => ({ ...r })); // a read is a copy, as from a real database
    };
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { filters.push(r => r[c] !== v); return q; },
      not: (c: string) => { filters.push(r => r[c] !== null && r[c] !== undefined); return q; },
      is: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q; },
      limit: () => q,
      update: (p: Row) => { op = 'update'; payload = p; return q; },
      insert: (p: Row) => { op = 'insert'; payload = p; return q; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: run()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok, bad),
    };
    return q;
  };
  return { db: { from }, writes };
}

let tables: Record<string, Row[]>;
let cards: Record<string, Array<{ created: number; card: { country: string } }>>;
let stamps: Array<{ id: string; address: Row }>;
let paid: boolean;
let customerMeta: Record<string, Record<string, string>>;
let onList: (() => void) | null;
let lists: number;
let db: ReturnType<typeof fakeDb>;

function server() {
  db = fakeDb(tables);
  const load = billingTestLoader({
    './supabase-admin': { supabaseAdmin: db.db },
    './stripe': { getStripe: () => ({
      paymentMethods: { list: async ({ customer }: { customer: string }) => {
        lists++;
        const hook = onList;
        onList = null;
        hook?.();
        return { data: [...(cards[customer] ?? [])].sort((a, b) => b.created - a.created).slice(0, 1) };
      } },
      customers: {
        update: async (id: string, p: { address: Row }) => { stamps.push({ id, address: p.address }); },
        retrieve: async (id: string) => ({ id, metadata: customerMeta[id] ?? {} }),
      },
    }) },
    './plan-move': { paidOrPromisedToPay: async () => paid },
    './observability/capture': { captureError: async () => {} },
  });
  return load('lib/billing-location-server.ts') as typeof import('../../lib/billing-location-server.ts');
}

const usRow = (extra: Row = {}): Row => ({
  id: 'loc-coach', user_id: 'coach-1', org_id: null, country: 'US', region_code: 'NY', line1: '88 Delaware Avenue', line2: null,
  city: 'Buffalo', postal_code: '14202', confirmed_at: '2026-11-01T12:00:00Z', us_declaration_at: '2026-11-01T12:00:00Z',
  us_declaration_version: 'us-2026-11-provisional', card_country: null, review_reason: null, review_note: null, review_set_at: null, ...extra,
});
const clubRow = (extra: Row = {}): Row => ({
  id: 'loc-club', org_id: CLUB, user_id: null, country: 'CA', region_code: 'ON', line1: '120 Elm Street', line2: null,
  city: 'Guelph', postal_code: 'N1H 4H2', confirmed_at: '2026-11-01T12:00:00Z', us_declaration_at: null, us_declaration_version: null,
  card_country: null, review_reason: null, review_note: null, review_set_at: null, ...extra,
});

beforeEach(() => {
  process.env.US_SALES_OPEN = 'true';
  tables = {
    billing_locations: [usRow(), clubRow()],
    team_workspaces: [
      { workspace_org_id: PORTAL, stripe_customer_id: 'cus_coach', billing_owner_user_id: 'coach-1', billing_mode: 'team_direct', workspace_state: 'independent' },
      { workspace_org_id: ORPHAN, stripe_customer_id: null, billing_owner_user_id: null, billing_mode: 'team_direct', workspace_state: 'independent' },
    ],
    organizations: [
      // The portal's own organization row carries the coach's customer too: the coach (a person) must win.
      { id: PORTAL, name: 'Falcons Coaches Portal', account_kind: 'team_workspace', plan_id: 'team', stripe_customer_id: 'cus_coach' },
      { id: ORPHAN, name: 'Orphan Coaches Portal', account_kind: 'team_workspace', plan_id: 'team', stripe_customer_id: null },
      { id: CLUB, name: 'Riverdale Minor Ball', account_kind: 'organization', plan_id: 'club', stripe_customer_id: 'cus_club' },
    ],
    org_payment_accounts: [],
  };
  cards = {};
  stamps = [];
  paid = false;
  customerMeta = {};
  onList = null;
  lists = 0;
});

const coachRow = () => tables.billing_locations.find(r => r.id === 'loc-coach')!;
const theClubRow = () => tables.billing_locations.find(r => r.id === 'loc-club')!;

describe('the card country, from the billing webhook\'s card events (Part 3 B)', () => {
  it('a coach\'s portal customer is the coach as a PERSON, even though the portal\'s organization row carries it too', async () => {
    cards.cus_coach = [{ created: 1, card: { country: 'ca' } }];
    await server().recordCardCountry('cus_coach');
    assert.equal(coachRow().card_country, 'CA', 'stored upper case');
    assert.equal(coachRow().review_reason, null, 'the evidence is never stored as a flag');
  });

  it('the newest card is the one read', async () => {
    cards.cus_coach = [{ created: 1, card: { country: 'CA' } }, { created: 2, card: { country: 'US' } }];
    await server().recordCardCountry('cus_coach');
    assert.equal(coachRow().card_country, 'US');
  });

  it('a swap whose "detached" arrives last reads Stripe\'s list as it stands, so the new card stays', async () => {
    cards.cus_coach = [{ created: 2, card: { country: 'US' } }]; // the old card is already gone from Stripe's list
    await server().recordCardCountry('cus_coach'); // attached (new card)
    await server().recordCardCountry('cus_coach'); // detached (old card), arriving after
    assert.equal(coachRow().card_country, 'US');
  });

  it('the last card removed empties the reading; a retried event writes nothing the second time', async () => {
    tables.billing_locations[0] = usRow({ card_country: 'CA' });
    await server().recordCardCountry('cus_coach');
    assert.equal(coachRow().card_country, null);
    const s = server();
    await s.recordCardCountry('cus_coach');
    assert.equal(db.writes.length, 0);
  });

  it('a customer that is no one\'s, or a portal that moved into or became a club, is not the coach\'s', async () => {
    const s = server();
    await s.recordCardCountry('cus_nobody');
    assert.equal(db.writes.length, 0);
    assert.equal(await s.buyerOfStripeCustomer('mock_cus_1'), null);
    tables.team_workspaces[0].workspace_state = 'org_owned';
    tables.organizations[0].account_kind = 'organization'; // the portal became the club
    tables.organizations[0].plan_id = 'club';
    assert.deepEqual(await server().buyerOfStripeCustomer('cus_coach'), { kind: 'org', orgId: PORTAL, name: 'Falcons Coaches Portal', stripeCustomerId: 'cus_coach' });
  });

  it('a first-time coach\'s card can attach before their portal exists: the customer says whose it is', async () => {
    assert.equal(await server().buyerOfStripeCustomer('cus_unlinked'), null);
    customerMeta.cus_unlinked = { ownerUserId: 'coach-9' };
    assert.deepEqual(await server().buyerOfStripeCustomer('cus_unlinked'), { kind: 'user', userId: 'coach-9' });
  });

  it('two card events at once: the slower write never puts back the older reading', async () => {
    cards.cus_coach = [{ created: 2, card: { country: 'US' } }];
    // Another event's write lands between this one's read and its write.
    onList = () => { coachRow().card_country = 'GB'; };
    await server().recordCardCountry('cus_coach');
    assert.equal(coachRow().card_country, 'US', 'the write missed, read again, and wrote what Stripe holds now');
    assert.equal(lists, 2);
  });

  it('a club\'s own customer is the club; a buyer with no address yet is skipped', async () => {
    cards.cus_club = [{ created: 1, card: { country: 'US' } }];
    await server().recordCardCountry('cus_club');
    assert.equal(theClubRow().card_country, 'US');
    tables.billing_locations = [];
    const s = server();
    await s.recordCardCountry('cus_club');
    assert.equal(db.writes.length, 0);
  });
});

describe('the save keeps the one stored flag (Part 3 Ask 1) and counts a promise to pay (Ask 3)', () => {
  const guelph = { country: 'CA', regionCode: 'ON', line1: '120 Elm Street', city: 'Guelph', postalCode: 'N1H 4H2' };
  const coach = { kind: 'user' as const, userId: 'coach-1' };

  it('a Canada↔US change by a buyer who has paid, or promised to (a Founding next-season choice), is flagged', async () => {
    paid = true;
    await server().saveBillingLocation(coach, guelph);
    assert.equal(coachRow().review_reason, 'country_changed_after_paying');
    assert.equal(coachRow().review_note, 'The country changed from the United States to Canada after paying.');
    assert.ok(coachRow().review_set_at);
  });

  it('no payment, no flag; a stored country-change flag stays through a later save; the retired flag clears', async () => {
    await server().saveBillingLocation(coach, guelph);
    assert.equal(coachRow().review_reason, null);
    tables.billing_locations[0] = usRow({
      country: 'CA', region_code: 'ON', us_declaration_at: null, us_declaration_version: null,
      review_reason: 'country_changed_after_paying', review_note: 'n', review_set_at: '2026-11-02T00:00:00Z',
    });
    await server().saveBillingLocation(coach, guelph);
    assert.equal(coachRow().review_reason, 'country_changed_after_paying');
    tables.billing_locations[0] = usRow({ country: 'CA', region_code: 'ON', us_declaration_at: null, us_declaration_version: null, review_reason: 'stripe_edit_invalid', review_note: 'n', review_set_at: '2026-11-02T00:00:00Z' });
    await server().saveBillingLocation(coach, guelph);
    assert.equal(coachRow().review_reason, null);
  });

  it('the first save of a buyer reads the card from Stripe', async () => {
    tables.billing_locations = [];
    cards.cus_coach = [{ created: 1, card: { country: 'US' } }];
    assert.ok((await server().saveBillingLocation(coach, guelph)).ok);
    assert.equal(tables.billing_locations[0].card_country, 'US');
  });

  it('a save on our own form copies the address to the buyer\'s Stripe customers', async () => {
    await server().saveBillingLocation(coach, guelph);
    assert.deepEqual(stamps.map(s => s.id), ['cus_coach']);
  });
});

describe('a "Start your club" address reaches Stripe only once the move is accepted (Part 3 Ask 2)', () => {
  const club = { kind: 'org' as const, orgId: PORTAL, name: 'Falcons Baseball Club', stripeCustomerId: 'cus_coach' };
  const address = { country: 'CA', regionCode: 'ON', line1: '9 Field Road', city: 'Guelph', postalCode: 'N1H 4H2' };

  it('the purchase saves the club\'s row and copies nothing; the copy after acceptance does', async () => {
    const s = server();
    const located = await s.requireBillingLocation(club, address);
    assert.ok(located.ok);
    assert.equal(tables.billing_locations.some(r => r.org_id === PORTAL), true, 'saved to the club\'s own row');
    assert.equal(stamps.length, 0, 'the coach\'s Premium customer still carries the coach\'s home address');
    if (located.ok) await s.copyBillingLocationToStripe(club, located.location);
    assert.deepEqual(stamps.map(x => [x.id, x.address.line1]), [['cus_coach', '9 Field Road']]);
  });

  it('the move route copies after applyMove, never before; the check saves without copying', () => {
    const move = readCode('app/api/billing/move/route.ts');
    const applied = move.indexOf('await applyMove(');
    const copied = move.indexOf('copyBillingLocationToStripe(');
    assert.ok(applied > 0 && copied > applied, 'the club address is copied to Stripe only after the move is made');
    assert.ok(move.indexOf("if ('code' in result) return refusalResponse(result);") < copied, 'a refused move returns before the copy');
    const server = readCode('lib/billing-location-server.ts');
    assert.match(server, /if \(sentAddress\) \{\s*const saved = await saveBillingLocation\(buyer, sentAddress, \{ copyToStripe: false \}\)/);
  });
});

describe('platform admin reads it, read only (Part 3 D)', () => {
  it('a club\'s own row; a portal\'s billing owner\'s person row; a portal with no owner says so', async () => {
    tables.billing_locations[0] = usRow({ card_country: 'CA' });
    const s = server();
    const club = await s.readBillingLocationForConsole(CLUB);
    assert.ok(club && club.buyer === 'club' && club.location?.line1 === '120 Elm Street' && club.review === null);
    const portal = await s.readBillingLocationForConsole(PORTAL);
    assert.ok(portal && portal.buyer === 'person' && portal.location?.city === 'Buffalo');
    assert.deepEqual(portal.review, { reason: 'card_country_mismatch', note: 'The address is in the United States, but the card was issued in Canada.', setAt: null });
    assert.deepEqual(await s.readBillingLocationForConsole(ORPHAN), { buyer: 'none' });
    tables.team_workspaces[0].billing_mode = 'org_team_addon'; // a club pays for this portal: no coach's home address
    assert.deepEqual(await server().readBillingLocationForConsole(PORTAL), { buyer: 'none' });
    assert.equal(await s.readBillingLocationForConsole('00000000-0000-4000-8000-000000000999'), null);
    assert.equal(await s.readBillingLocationForConsole('not-a-uuid'), null);
  });

  it('the payout evidence is read live: a Canadian club paid out in the US shows it, a disconnected account does not', async () => {
    tables.org_payment_accounts = [{ org_id: CLUB, country: 'US', disconnected_at: null }];
    const club = await server().readBillingLocationForConsole(CLUB);
    assert.ok(club && club.buyer === 'club');
    assert.equal(club.review?.reason, 'payout_country_mismatch');
    assert.equal(club.review?.note, 'The address is in Canada, but the club’s payouts go to the United States.');
    tables.org_payment_accounts[0].disconnected_at = '2026-11-04T00:00:00Z';
    const after = await server().readBillingLocationForConsole(CLUB);
    assert.ok(after && after.buyer === 'club' && after.review === null);
  });

  it('a stored flag shows with the day it was set, whatever the evidence says', async () => {
    tables.billing_locations[1] = clubRow({ card_country: 'CA', review_reason: 'country_changed_after_paying', review_note: 'The country changed from the United States to Canada after paying.', review_set_at: '2026-11-02T00:00:00Z' });
    const club = await server().readBillingLocationForConsole(CLUB);
    assert.ok(club && club.buyer === 'club');
    assert.deepEqual(club.review, { reason: 'country_changed_after_paying', note: 'The country changed from the United States to Canada after paying.', setAt: '2026-11-02T00:00:00Z' });
  });

  it('the block is on the Money tab, has no door of its own, and states the consequence', () => {
    const tab = readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx');
    assert.match(tab, /<BillingAddressPanel answer=\{billing\} \/>/);
    // A flag that needs a person is the FIRST thing on the tab (above Stripe's "agree" line), and shows as a dot on the tab.
    assert.match(tab, /\{reviewStrip\}\s*\{head\}/);
    assert.match(readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx'), /moneyNeedsReview[\s\S]*kit\.tabDot/);
    const panel = readCode('app/platform-admin/orgs/[id]/BillingAddressPanel.tsx');
    assert.doesNotMatch(panel, /<button|'PUT'|'POST'|'PATCH'|'DELETE'/, 'read only');
    assert.match(panel, /REVIEW_CONSEQUENCE/);
    assert.equal(REVIEW_CONSEQUENCE, 'Until this is looked at, the buyer is treated as Canadian.');
    const route = readCode('app/api/platform-admin/orgs/[id]/money/billing-address/route.ts');
    assert.match(route, /requirePlatformPower\('find_stripe'\)/);
    assert.doesNotMatch(route, /export const (PUT|POST|PATCH|DELETE)/);
  });
});

describe('the wiring (Part 3 source guards)', () => {
  it('Stripe\'s billing page cannot edit the address, and nothing reads one back', () => {
    assert.match(readCode('lib/stripe-portal-settings.ts'), /allowed_updates: \['name', 'email', 'tax_id'\]/);
    assert.doesNotMatch(readCode('app/api/billing/webhook/route.ts'), /case 'customer\.updated'/);
  });

  it('the webhook\'s card events record the card country; the payouts module knows nothing of billing', () => {
    const webhook = readCode('app/api/billing/webhook/route.ts');
    assert.match(webhook, /case 'payment_method\.attached': \{[\s\S]*?recordCardCountry\(customerId\)[\s\S]*?break;/);
    assert.match(webhook, /case 'payment_method\.detached': \{[\s\S]*?recordCardCountry\(customerId\)[\s\S]*?break;/);
    assert.doesNotMatch(readCode('lib/online-payment-landing.ts'), /billing-location/);
  });

  it('a promise to pay counts for the country-change flag ONLY, never for a trial', () => {
    const users = codeFiles(['app', 'lib']).filter(f => /paidOrPromisedToPay\(|paidOrPromisedToPay\)/.test(readCode(f)));
    assert.deepEqual(users.sort(), ['lib/billing-location-server.ts', 'lib/plan-move.ts'], 'its home, and its one user');
  });

  it('only the billing-location server module writes billing_locations', () => {
    const writers = codeFiles(['app', 'lib', 'components'])
      .filter(f => /from\('billing_locations'\)\s*\.(update|insert|upsert|delete)\(/.test(readCode(f)));
    assert.deepEqual(writers, ['lib/billing-location-server.ts']);
  });
});
