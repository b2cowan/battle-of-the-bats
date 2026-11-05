import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { BUYER_NAME_META, buyerNameUpdate, decideBuyerTax } from './billing-tax';
import { getStripe } from './stripe';
import { captureError } from './observability/capture';
import { paidOrPromisedToPay } from './plan-move';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { isUuid } from './utils';
import {
  BILLING_LOCATION_WORDS,
  US_DECLARATION_VERSION,
  checkBillingLocation,
  countryChangeReview,
  currentReview,
  reviewSentence,
  toStripeAddress,
  type BillingLocation,
  type BillingLocationField,
  type BillingLocationInput,
  type ConsoleBillingLocation,
  type ReviewReason,
  type StoredBillingLocation,
} from './billing-location';

/**
 * WHERE A BUYER IS BILLED, ON OUR OWN RECORDS (GST/HST Stage 1 Part 2; build prompt
 * docs/projects/active/GST_HST_STAGE1_PART2_BUILD_PROMPT.md). Server-only. Reads and writes `billing_locations`
 * (migration 433) and holds the ONE check every paid path calls before it touches Stripe.
 *
 *   · The buyer (owner ruling 6, 2026-11-03): a club buys as its organization; a coach buys Premium as a PERSON, so a
 *     Coaches Portal's address is the signed-in owner's own row, never the portal's organization row.
 *   · What a valid address is lives in lib/billing-location.ts only; this file never restates a rule or a message.
 *   · US sales are closed until US_SALES_OPEN=true (owner Ask 5): absent means closed, which is production.
 *   · Part 3 (owner rulings 2026-11-04): the address changes ONLY on our own form (Stripe's billing page no longer edits it),
 *     the card country is kept current from the billing webhook, and the card and payout evidence is worked out when read.
 *     THIS FILE IS THE ONE WRITER of `billing_locations` (tests/unit/billing-location-evidence.test.ts holds that).
 */

export type BillingBuyer =
  | { kind: 'org'; orgId: string; name: string; stripeCustomerId?: string | null }
  | { kind: 'user'; userId: string };

/** The one reading of the US switch. The client learns it from GET /api/billing/location, never from its own env. */
export function usSalesOpen(): boolean {
  return process.env.US_SALES_OPEN === 'true';
}

/** Who pays on this organization's Plan & billing: the club, or (for a Coaches Portal) the coach as a person. */
export function billingBuyerOf(
  org: { id: string; name: string; accountKind?: string | null; planId?: string | null; stripeCustomerId?: string | null },
  user: { id: string },
): BillingBuyer {
  return isTeamWorkspaceOrg(org)
    ? { kind: 'user', userId: user.id }
    : { kind: 'org', orgId: org.id, name: org.name, stripeCustomerId: org.stripeCustomerId ?? null };
}

type Row = {
  id: string;
  country: string;
  region_code: string;
  line1: string;
  line2: string | null;
  city: string;
  postal_code: string;
  confirmed_at: string;
  us_declaration_at: string | null;
  us_declaration_version: string | null;
  card_country: string | null;
  review_reason: ReviewReason | null;
  review_note: string | null;
  review_set_at: string | null;
};

const COLUMNS = 'id, country, region_code, line1, line2, city, postal_code, confirmed_at, us_declaration_at, us_declaration_version, card_country, review_reason, review_note, review_set_at';

const keyOf = (buyer: BillingBuyer) =>
  buyer.kind === 'org' ? { column: 'org_id', value: buyer.orgId } : { column: 'user_id', value: buyer.userId };

async function readRow(buyer: BillingBuyer): Promise<Row | null> {
  const { column, value } = keyOf(buyer);
  const { data, error } = await supabaseAdmin.from('billing_locations').select(COLUMNS).eq(column, value).maybeSingle<Row>();
  if (error) throw error;
  return data ?? null;
}

const toStored = (row: Row): StoredBillingLocation => ({
  country: row.country as StoredBillingLocation['country'],
  regionCode: row.region_code,
  line1: row.line1,
  line2: row.line2,
  city: row.city,
  postalCode: row.postal_code,
  confirmedAt: row.confirmed_at,
  usDeclarationAt: row.us_declaration_at,
  usDeclarationVersion: row.us_declaration_version,
});

export async function readBillingLocation(buyer: BillingBuyer): Promise<StoredBillingLocation | null> {
  const row = await readRow(buyer);
  return row ? toStored(row) : null;
}

const real = (id: string | null | undefined): id is string => !!id && !id.startsWith('mock_');

/** A coach's OWN portals: the one rule both directions here read (customer→buyer and buyer→customers), the same portals
 *  lib/team-checkout-customer.ts treats as theirs — not one a club pays for, not one that moved into or became a club. */
const coachOwnPortals = (columns: string) =>
  supabaseAdmin.from('team_workspaces').select(columns).neq('billing_mode', 'org_team_addon').neq('workspace_state', 'org_owned');

/** The Stripe customers this buyer pays through (a club's one; a coach's on the portals they are billing owner of). */
async function buyerCustomerIds(buyer: BillingBuyer): Promise<string[]> {
  if (buyer.kind === 'org') {
    if (buyer.stripeCustomerId !== undefined) return real(buyer.stripeCustomerId) ? [buyer.stripeCustomerId] : [];
    const { data } = await supabaseAdmin.from('organizations').select('stripe_customer_id').eq('id', buyer.orgId).maybeSingle();
    const id = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    return real(id) ? [id] : [];
  }
  const { data, error } = await coachOwnPortals('stripe_customer_id')
    .eq('billing_owner_user_id', buyer.userId).not('stripe_customer_id', 'is', null);
  if (error) throw error;
  return [...new Set(((data ?? []) as unknown as Array<{ stripe_customer_id: string }>).map(r => r.stripe_customer_id).filter(real))];
}

/**
 * The Stripe customer carries the same address we hold, so its invoices and Stripe Tax read the same place. With `buyerName`
 * (a paying path), the buyer's name too, unless the buyer typed their own on Stripe's page (`buyerNameUpdate`).
 */
export async function stampStripeCustomerAddress(customerId: string, location: BillingLocation, buyerName?: string | null): Promise<void> {
  if (!real(customerId)) return;
  const stripe = getStripe();
  let naming: ReturnType<typeof buyerNameUpdate> = null;
  if (buyerName?.trim()) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer && customer.deleted)) naming = buyerNameUpdate(customer as Stripe.Customer, buyerName);
  }
  await stripe.customers.update(customerId, { address: toStripeAddress(location), ...(naming ?? {}) });
}

async function stampCustomers(customerIds: string[], location: BillingLocation): Promise<void> {
  try {
    await Promise.all(customerIds.map(id => stampStripeCustomerAddress(id, location)));
  } catch (stripeError) {
    void captureError(stripeError, { route: 'billing-location:stripe-copy' });
  }
}

/**
 * The buyer's saved address onto the Stripe customers they pay through, AFTER a purchase is accepted (owner Part 3 Ask 2,
 * 2026-11-04). A Premium coach's "Start your club" saves the CLUB's address with the move, but until the move is accepted
 * that portal's Stripe customer is still the coach's own Premium billing: copying it at save time put a club that was never
 * made onto the coach's billing (and Stage 2 taxes by the Stripe customer's address). Never fails the caller.
 * Stage 2 (Ask 2, 2026-11-05): the Premium → Club move no longer copies through here; it stamps BEFORE its Stripe update with
 * `withClubAddressOnStripe`, because the move's prorated invoice is taxed by the customer's address.
 */
export async function copyBillingLocationToStripe(buyer: BillingBuyer, location: BillingLocation): Promise<void> {
  const ids = await buyerCustomerIds(buyer).catch((error) => {
    void captureError(error, { route: 'billing-location:stripe-copy' });
    return [];
  });
  await stampCustomers(ids, location);
}

const upperCountry = (code: string | null | undefined): string | null => (code ? code.toUpperCase() : null);

/**
 * The issuing country of the buyer's NEWEST card, read from Stripe's current card list (not from the event that asked):
 * a card swap fires "detached" for the old card, often after the new one attached, so reading the list as it stands now
 * is right in either order. The same "newest card" rule support's card on file follows (lib/billing-setup.ts). No card
 * left = null = no evidence.
 */
async function newestCardCountry(customerIds: string[]): Promise<string | null> {
  const lists = await Promise.all(customerIds.map(customer => getStripe().paymentMethods.list({ customer, type: 'card', limit: 1 })));
  const newest = lists.flatMap(list => list.data).sort((a, b) => b.created - a.created)[0];
  return upperCountry(newest?.card?.country);
}

export type SaveBillingLocationResult =
  | { ok: true; location: StoredBillingLocation }
  | { ok: false; kind: 'invalid'; errors: Partial<Record<BillingLocationField, string>>; usClosed: boolean }
  | { ok: false; kind: 'failed' };

/**
 * Save what the buyer typed. A Canada↔US change by a buyer who has already paid is SAVED and flagged (owner Ask 4:
 * Stage 2 taxes a flagged buyer as Canadian); nothing here blocks. A US address stamps the declaration with today's
 * date and the wording version every time it is confirmed. Copying to Stripe never fails the save (it is reported).
 */
export async function saveBillingLocation(
  buyer: BillingBuyer,
  input: BillingLocationInput,
  /** False when the address came with a purchase that is not accepted yet: the caller copies it after (Ask 2). */
  opts: { copyToStripe?: boolean } = {},
): Promise<SaveBillingLocationResult> {
  const checked = checkBillingLocation(input, { usSalesOpen: usSalesOpen() });
  if (!checked.ok) return { ok: false, kind: 'invalid', errors: checked.errors, usClosed: checked.usClosed };
  const next = checked.value;

  try {
    // The row and the buyer's Stripe customers (the country-change check, the card reading and the copy below need them).
    const [existing, customers] = await Promise.all([readRow(buyer), buyerCustomerIds(buyer)]);
    const now = new Date().toISOString();

    let countryChange: ReviewReason | null = null;
    if (existing && existing.country !== next.country) {
      // A Stripe problem here must not fail the save (owner Ask 3/4: never blocks). When we cannot tell, flag it: the flag's
      // only effect is that Stage 2 taxes the buyer as Canadian until looked at, the same hold a known payer gets. A Founding
      // next-season choice counts as paying here (Part 3 Ask 3), and only here.
      let hasPaid: boolean;
      try {
        hasPaid = (await Promise.all(customers.map(paidOrPromisedToPay))).some(Boolean);
      } catch (paidCheckError) {
        void captureError(paidCheckError, { route: 'billing-location:paid-check' });
        hasPaid = true;
      }
      countryChange = countryChangeReview(existing.country, next.country, hasPaid);
    }

    // A card already on the row is the webhook's reading; a row without one (a first save, or a card added before any address)
    // asks Stripe. Failing to read is no evidence, never a failed save. The card and payout EVIDENCE is not stored: it is worked
    // out whenever it is read (`currentReview`), so it can never go stale.
    let cardCountry = existing?.card_country ?? null;
    if (!cardCountry) {
      cardCountry = await newestCardCountry(customers).catch((cardError) => {
        void captureError(cardError, { route: 'billing-location:card-country' });
        return null;
      });
    }
    // The one STORED flag (owner Part 3 Ask 1): a change found by this save is written fresh, so its sentence names this change;
    // an older one stays (nothing in Stage 1 answers it); the retired invalid-Stripe-edit flag is answered by this valid save.
    const review = countryChange
      ? { review_reason: countryChange, review_note: reviewSentence(countryChange, { country: next.country, previousCountry: existing?.country }), review_set_at: now }
      : existing?.review_reason === 'stripe_edit_invalid' ? { review_reason: null, review_note: null, review_set_at: null } : null;

    const fields = {
      country: next.country,
      region_code: next.regionCode,
      line1: next.line1,
      line2: next.line2,
      city: next.city,
      postal_code: next.postalCode,
      confirmed_at: now,
      us_declaration_at: next.country === 'US' ? now : null,
      us_declaration_version: next.country === 'US' ? US_DECLARATION_VERSION : null,
      updated_at: now,
      ...(cardCountry !== (existing?.card_country ?? null) ? { card_country: cardCountry } : {}),
      ...(review ?? {}),
    };

    const { column, value } = keyOf(buyer);
    let saved: Row | null = null;
    if (existing) {
      const { data, error } = await supabaseAdmin.from('billing_locations').update(fields).eq('id', existing.id).select(COLUMNS).single<Row>();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabaseAdmin.from('billing_locations').insert({ ...fields, [column]: value }).select(COLUMNS).single<Row>();
      if (error?.code === '23505') {
        // Two saves raced (a double press across two tabs): the other one made the row, so this one updates it.
        const { data: again, error: updateError } = await supabaseAdmin.from('billing_locations').update(fields).eq(column, value).select(COLUMNS).single<Row>();
        if (updateError) throw updateError;
        saved = again;
      } else if (error) {
        throw error;
      } else {
        saved = data;
      }
    }

    if (opts.copyToStripe !== false) await stampCustomers(customers, next);

    return { ok: true, location: toStored(saved as Row) };
  } catch (error) {
    void captureError(error, { route: 'billing-location:save' });
    return { ok: false, kind: 'failed' };
  }
}

/**
 * THE CHECK every paid path calls before its first Stripe call (paths A–E, Part 0's list). Refuses with 409 and the
 * stable code `billing_address_required` when the buyer has no valid address on file; the screen opens the Billing
 * address window on that code instead of showing an error. Free, comped and trial-only paths never call it.
 */
export async function requireBillingLocation(buyer: BillingBuyer, sentAddress?: BillingLocationInput | null): Promise<
  | { ok: true; location: BillingLocation }
  | { ok: false; response: Response }
> {
  // An address that came with the purchase (the "Start your club" window) is saved to the buyer's own row first, but NOT copied
  // to Stripe: the purchase is not accepted yet. The caller copies it once it is (Ask 2): the move after its move is made, a
  // checkout through the customer the checkout itself charges.
  if (sentAddress) {
    const saved = await saveBillingLocation(buyer, sentAddress, { copyToStripe: false });
    if (!saved.ok) return { ok: false, response: saveRefusalResponse(saved) };
  }
  // GST/HST Stage 2: the row as it stands (after any save above), and HOW this buyer is taxed (lib/billing-tax.ts). The review
  // is `currentReview`, worked out now, and only a US address needs it (Ask 1: a flagged Canadian address is taxed by it).
  const row = await readRow(buyer);
  const review = row?.country === 'US'
    ? currentReview({
      country: row.country, cardCountry: row.card_country, payoutCountry: await payoutCountryOf(buyer),
      storedReason: row.review_reason, storedNote: row.review_note,
    })
    : null;
  const tax = decideBuyerTax({ stored: row ? toStored(row) : null, review, usSalesOpen: usSalesOpen() });
  if (tax.ok) return { ok: true, location: tax.location };
  return {
    ok: false,
    response: Response.json(
      { error: tax.error, code: tax.code, buyer: buyer.kind === 'org' ? 'club' : 'person' },
      { status: 409 },
    ),
  };
}

/**
 * Premium → Club in place (GST/HST Stage 2 Ask 2, owner 2026-11-05): the move's prorated invoice is taxed by the Stripe
 * customer's address, so the CLUB's address goes onto that customer BEFORE the move's Stripe update, and the address the customer
 * carried before (the coach's home address) is put back if the move is refused or throws. A refused move still leaves the coach
 * exactly as they were (Stage 1 Part 3 Ask 2's reason; only its order changed). A stamp that fails refuses the move: charging it
 * at the coach's home address is the one outcome this exists to stop.
 */
export async function withClubAddressOnStripe<T>(
  buyer: Extract<BillingBuyer, { kind: 'org' }>,
  location: BillingLocation,
  isRefused: (result: T) => boolean,
  move: () => Promise<T>,
): Promise<{ ok: true; result: T } | { ok: false; response: Response }> {
  const refusal = () => ({
    ok: false as const,
    response: Response.json({ error: BILLING_LOCATION_WORDS.stampFailed, code: 'billing_address_stamp_failed' }, { status: 503 }),
  });
  const ids = await buyerCustomerIds(buyer).catch((error) => { void captureError(error, { route: 'billing-location:club-stamp' }); return null; });
  if (!ids) return refusal();
  const stripe = getStripe();
  const before = new Map<string, Before>();
  try {
    for (const id of ids) {
      const customer = await stripe.customers.retrieve(id);
      const live = 'deleted' in customer && customer.deleted ? null : customer as Stripe.Customer;
      before.set(id, { address: live?.address ?? null, name: live?.name ?? null, ourName: live?.metadata?.[BUYER_NAME_META] ?? null });
    }
    // The club's name with its address: the move's invoice is the CLUB's (accounting 6b), and both go back on a refusal.
    await Promise.all(ids.map(id => stampStripeCustomerAddress(id, location, buyer.name)));
  } catch (error) {
    void captureError(error, { route: 'billing-location:club-stamp' });
    await putBack(before);
    return refusal();
  }
  let result: T;
  try {
    result = await move();
  } catch (error) {
    await putBack(before);
    throw error;
  }
  if (isRefused(result)) await putBack(before);
  return { ok: true, result };
}

type Before = { address: Stripe.Address | null; name: string | null; ourName: string | null };

/** The addresses (and names) the customers carried before, put back. Reported, never thrown: the caller's own answer is what matters. */
async function putBack(before: Map<string, Before>): Promise<void> {
  await Promise.all([...before].map(async ([id, { address, name, ourName }]) => {
    try {
      await getStripe().customers.update(id, {
        address: address
          ? { line1: address.line1 ?? '', line2: address.line2 ?? '', city: address.city ?? '', state: address.state ?? '', postal_code: address.postal_code ?? '', country: address.country ?? '' }
          : '',
        name: name ?? '',
        metadata: { [BUYER_NAME_META]: ourName ?? '' },
      });
    } catch (error) {
      void captureError(error, { route: 'billing-location:club-stamp-restore' });
    }
  }));
}

/** The address a checkout sends with it (the "Start your club" window), saved to the CLUB's own row before the check. */
export function billingAddressFromBody(value: unknown): BillingLocationInput | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : null);
  return {
    country: s('country'), regionCode: s('regionCode'), line1: s('line1'), line2: s('line2'),
    city: s('city'), postalCode: s('postalCode'), usDeclared: v.usDeclared === true,
  };
}

/** A save refused by the check, as the route answers it: one red line per field, or the save-failed sentence. */
export function saveRefusalResponse(result: Exclude<SaveBillingLocationResult, { ok: true }>): Response {
  return result.kind === 'invalid'
    ? Response.json({
      error: Object.values(result.errors)[0] ?? BILLING_LOCATION_WORDS.saveFailed,
      code: 'invalid_billing_address', errors: result.errors, usClosed: result.usClosed,
    }, { status: 400 })
    : Response.json({ error: BILLING_LOCATION_WORDS.saveFailed, code: 'billing_address_save_failed' }, { status: 500 });
}

/**
 * Which buyer pays through this Stripe customer: the reverse of `buyerCustomerIds`, on the same `coachOwnPortals` rule. A
 * coach's own portal is looked at FIRST, because the portal's organization row carries the same customer and a coach buys as
 * a person. Null when the customer is no one's, or is ambiguous (two people, two organizations): nothing is then written.
 */
export async function buyerOfStripeCustomer(customerId: string): Promise<BillingBuyer | null> {
  if (!real(customerId)) return null;
  const { data: portals, error } = await coachOwnPortals('billing_owner_user_id')
    .eq('stripe_customer_id', customerId).not('billing_owner_user_id', 'is', null).limit(10);
  if (error) throw error;
  const owners = [...new Set(((portals ?? []) as unknown as Array<{ billing_owner_user_id: string }>).map(p => p.billing_owner_user_id))];
  if (owners.length === 1) return { kind: 'user', userId: owners[0] };
  if (owners.length > 1) return null;

  // The webhook's own customer→club rule (`ownerOf`): exactly one organization, and not a portal's row.
  const { data: orgs, error: orgError } = await supabaseAdmin.from('organizations').select('id, name, account_kind, plan_id')
    .eq('stripe_customer_id', customerId).limit(2);
  if (orgError) throw orgError;
  const rows = (orgs ?? []) as Array<{ id: string; name: string; account_kind: string | null; plan_id: string | null }>;
  if (rows.length > 1) return null;
  if (rows.length === 1) {
    return isTeamWorkspaceOrg({ accountKind: rows[0].account_kind, planId: rows[0].plan_id })
      ? null
      : { kind: 'org', orgId: rows[0].id, name: rows[0].name, stripeCustomerId: customerId };
  }

  // No row names this customer YET: a first-time coach's card attaches during checkout, before the webhook makes their portal
  // (Stripe does not order events). Every customer our checkouts create carries whose it is: a coach's `ownerUserId`
  // (lib/team-checkout-customer.ts), a club's `orgId` (ensureStripeCustomer). One Stripe read, only on this path.
  const customer = await getStripe().customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) return null;
  const meta = (customer as { metadata?: Record<string, string> }).metadata ?? {};
  if (meta.ownerUserId) return { kind: 'user', userId: meta.ownerUserId };
  return null;
}

/**
 * The billing webhook's card events (`payment_method.attached` / `detached`): the issuing country of the buyer's newest card
 * onto their row. Decides from Stripe's list as it stands, never from the event, so a retried or out-of-order event writes the
 * same answer. A buyer with no address yet is skipped (their first save reads the card itself). Reported, never thrown: the
 * event's own work (the card on file) does not depend on it.
 */
export async function recordCardCountry(customerId: string): Promise<void> {
  try {
    const buyer = await buyerOfStripeCustomer(customerId);
    if (!buyer) return;
    // Two card events run at once (a swap's attach and detach): each reads Stripe's list, and the slower write could put back
    // the older reading. So the write only lands on the value it read; when another write got there first, read both again.
    for (let attempt = 0; attempt < 2; attempt++) {
      const [row, cardCountry] = await Promise.all([readRow(buyer), buyerCustomerIds(buyer).then(newestCardCountry)]);
      if (!row || row.card_country === cardCountry) return;
      const update = supabaseAdmin.from('billing_locations')
        .update({ card_country: cardCountry, updated_at: new Date().toISOString() }).eq('id', row.id);
      const { data, error } = await (row.card_country === null ? update.is('card_country', null) : update.eq('card_country', row.card_country))
        .select('id');
      if (error) throw error;
      if ((data ?? []).length > 0) return;
    }
  } catch (error) {
    void captureError(error, { route: 'billing-location:card-country' });
  }
}

/** The country Stripe verified for a club's payouts (a coach has none), read live. A disconnected account no longer receives
 *  the club's money, so it is no evidence. */
async function payoutCountryOf(buyer: BillingBuyer): Promise<string | null> {
  if (buyer.kind !== 'org') return null;
  const { data, error } = await supabaseAdmin.from('org_payment_accounts').select('country, disconnected_at')
    .eq('org_id', buyer.orgId).maybeSingle<{ country: string | null; disconnected_at: string | null }>();
  if (error) throw error;
  return data && !data.disconnected_at ? data.country : null;
}

/**
 * Platform admin's read of an organization's billing address (Part 3; the Money tab's one read-only block). A club's is its
 * own row; a Coaches Portal's is its billing owner's PERSON row (a coach buys as a person), the same row billingBuyerOf
 * gives the owner on Plan & billing. "Needs review" is `currentReview`: the stored flag, or the card and payout evidence as it
 * stands right now. Null when there is no such organization.
 */
export async function readBillingLocationForConsole(orgId: string): Promise<ConsoleBillingLocation | null> {
  if (!isUuid(orgId)) return null;
  const { data: org, error } = await supabaseAdmin.from('organizations').select('id, name, account_kind, plan_id')
    .eq('id', orgId).maybeSingle<{ id: string; name: string; account_kind: string | null; plan_id: string | null }>();
  if (error) throw error;
  if (!org) return null;
  let buyer: BillingBuyer;
  if (isTeamWorkspaceOrg({ accountKind: org.account_kind, planId: org.plan_id })) {
    // Only a portal the coach pays for themselves (the same `coachOwnPortals` rule the card and the copy to Stripe read): one a
    // club pays for, or one that moved into a club, is not billed to a coach, so no home address is shown for it.
    const { data: ws, error: wsError } = await coachOwnPortals('billing_owner_user_id')
      .eq('workspace_org_id', orgId).not('billing_owner_user_id', 'is', null).limit(1).maybeSingle();
    if (wsError) throw wsError;
    const ownerId = (ws as unknown as { billing_owner_user_id?: string } | null)?.billing_owner_user_id;
    if (!ownerId) return { buyer: 'none' };
    buyer = { kind: 'user', userId: ownerId };
  } else {
    buyer = { kind: 'org', orgId, name: org.name };
  }
  const [row, payoutCountry] = await Promise.all([readRow(buyer), payoutCountryOf(buyer)]);
  const review = row && currentReview({
    country: row.country, cardCountry: row.card_country, payoutCountry, storedReason: row.review_reason, storedNote: row.review_note,
  });
  return {
    buyer: buyer.kind === 'org' ? 'club' : 'person',
    location: row ? toStored(row) : null,
    review: review && row ? { ...review, setAt: row.review_reason ? row.review_set_at : null, country: row.country } : null,
  };
}
