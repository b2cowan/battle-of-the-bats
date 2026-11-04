import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getStripe } from './stripe';
import { captureError } from './observability/capture';
import { hadSubscriptionBefore } from './plan-move';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import {
  BILLING_ADDRESS_REQUIRED,
  BILLING_LOCATION_WORDS,
  US_DECLARATION_VERSION,
  checkBillingLocation,
  countryChangeReview,
  reviewSentence,
  storedLocationStillValid,
  toStripeAddress,
  type BillingLocation,
  type BillingLocationField,
  type BillingLocationInput,
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
  review_reason: string | null;
};

const COLUMNS = 'id, country, region_code, line1, line2, city, postal_code, confirmed_at, us_declaration_at, us_declaration_version, review_reason';

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

/** The Stripe customers this buyer pays through (a club's one; a coach's on the portals they are billing owner of). */
async function buyerCustomerIds(buyer: BillingBuyer): Promise<string[]> {
  if (buyer.kind === 'org') {
    if (buyer.stripeCustomerId !== undefined) return real(buyer.stripeCustomerId) ? [buyer.stripeCustomerId] : [];
    const { data } = await supabaseAdmin.from('organizations').select('stripe_customer_id').eq('id', buyer.orgId).maybeSingle();
    const id = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    return real(id) ? [id] : [];
  }
  // The same portals lib/team-checkout-customer.ts treats as the coach's own: not one a club pays for, not one that became a club.
  const { data, error } = await supabaseAdmin.from('team_workspaces').select('stripe_customer_id')
    .eq('billing_owner_user_id', buyer.userId).neq('billing_mode', 'org_team_addon').neq('workspace_state', 'org_owned')
    .not('stripe_customer_id', 'is', null);
  if (error) throw error;
  return [...new Set(((data ?? []) as Array<{ stripe_customer_id: string }>).map(r => r.stripe_customer_id).filter(real))];
}

/** The Stripe customer carries the same address we hold, so its invoices and (in Stage 2) Stripe Tax read the same place. */
export async function stampStripeCustomerAddress(customerId: string, location: BillingLocation): Promise<void> {
  if (!real(customerId)) return;
  await getStripe().customers.update(customerId, { address: toStripeAddress(location) });
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
export async function saveBillingLocation(buyer: BillingBuyer, input: BillingLocationInput): Promise<SaveBillingLocationResult> {
  const checked = checkBillingLocation(input, { usSalesOpen: usSalesOpen() });
  if (!checked.ok) return { ok: false, kind: 'invalid', errors: checked.errors, usClosed: checked.usClosed };
  const next = checked.value;

  try {
    const existing = await readRow(buyer);
    const now = new Date().toISOString();

    // The buyer's Stripe customers, looked up once: the country-change check and the copy of the address below both need them.
    const customers = await buyerCustomerIds(buyer);
    let review: { review_reason: string | null; review_note: string | null; review_set_at: string | null } | null = null;
    if (existing && existing.country !== next.country) {
      // A Stripe problem here must not fail the save (owner Ask 3/4: never blocks). When we cannot tell, flag it: the flag's
      // only effect is that Stage 2 taxes the buyer as Canadian until looked at, the same hold a known payer gets.
      let hasPaid: boolean;
      try {
        hasPaid = (await Promise.all(customers.map(hadSubscriptionBefore))).some(Boolean);
      } catch (paidCheckError) {
        void captureError(paidCheckError, { route: 'billing-location:paid-check' });
        hasPaid = true;
      }
      const reason = countryChangeReview(existing.country, next.country, hasPaid);
      if (reason) {
        review = {
          review_reason: reason,
          review_note: reviewSentence(reason, { country: next.country, previousCountry: existing.country }),
          review_set_at: now,
        };
      }
    }
    // The buyer just confirmed a valid address on our own form, which answers an invalid edit made on Stripe's page.
    if (!review && existing?.review_reason === 'stripe_edit_invalid') {
      review = { review_reason: null, review_note: null, review_set_at: null };
    }

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

    try {
      await Promise.all(customers.map(id => stampStripeCustomerAddress(id, next)));
    } catch (stripeError) {
      void captureError(stripeError, { route: 'billing-location:stripe-copy' });
    }

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
  // An address that came with the purchase (the "Start your club" window) is saved to the buyer's own row first.
  if (sentAddress) {
    const saved = await saveBillingLocation(buyer, sentAddress);
    if (!saved.ok) return { ok: false, response: saveRefusalResponse(saved) };
  }
  const stored = await readBillingLocation(buyer);
  const location = stored ? storedLocationStillValid(stored, usSalesOpen()) : null;
  if (location) return { ok: true, location };
  return {
    ok: false,
    response: Response.json(
      { error: BILLING_LOCATION_WORDS.required, code: BILLING_ADDRESS_REQUIRED, buyer: buyer.kind === 'org' ? 'club' : 'person' },
      { status: 409 },
    ),
  };
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
