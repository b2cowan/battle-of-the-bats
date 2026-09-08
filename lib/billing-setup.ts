import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CardDetails } from '@/lib/billing-format';
import type Stripe from 'stripe';

/**
 * Org-level Stripe provisioning shared by the billing endpoints
 * (create-checkout, setup-payment-method, portal, the next-season choice). Server-only.
 */

/**
 * Mirror the Stripe customer onto the team_workspaces row behind a workspace org.
 *
 * A comped Premium Coaches Portal is a shadow organization AND a `team_workspaces` row, and the two
 * carry the customer id separately: the org row is what `ensureStripeCustomer` and the portal read,
 * the workspace row is what the Coaches Portal subscription paths read. If a coach saves a card
 * through the billing page we create the customer on the ORG — and unless it is mirrored here, the
 * eventual 2028 subscription would be raised against a different customer and the saved card would
 * be invisible to it.
 *
 * No-op for an ordinary organization (no workspace row) and for a workspace that already has one
 * (first-writer-wins, matching the org-side guard).
 */
async function linkWorkspaceStripeCustomer(orgId: string, customerId: string): Promise<void> {
  await supabaseAdmin
    .from('team_workspaces')
    .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('workspace_org_id', orgId)
    .is('stripe_customer_id', null);
}

/**
 * Get the org's Stripe customer id, creating and persisting one if missing.
 *
 * ⚠ ONE EXIT, DELIBERATELY. This function has four paths (already linked · won the create race ·
 * lost it · no row came back) and each of them has to mirror the id onto the workspace row. Written
 * as four returns, each repeating the mirror call, a fifth path added later silently skips it — and
 * a skipped mirror is exactly the defect the mirror exists to prevent. So every path resolves a
 * `customerId` and the mirror + return happen once, at the bottom.
 */
export async function ensureStripeCustomer(
  org: { id: string; stripeCustomerId?: string | null; accountKind?: string | null },
  email: string | undefined,
): Promise<string> {
  let customerId: string;

  if (org.stripeCustomerId) {
    customerId = org.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { orgId: org.id },
    });
    // First-writer-wins link: concurrent requests (e.g. two billing buttons clicked
    // back-to-back before the org has a customer) each create a candidate customer.
    // Only one may become the customer of record — an unguarded overwrite would let
    // a later card-save land on an orphaned customer the org row no longer points at.
    const { data: linked } = await supabaseAdmin
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', org.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .maybeSingle();

    if (linked?.stripe_customer_id === customer.id) {
      customerId = customer.id;
    } else {
      // Lost the race (or the caller's auth context was stale): use the customer
      // already linked and discard ours — nothing has been attached to it yet.
      const { data: row } = await supabaseAdmin
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', org.id)
        .single();
      if (row?.stripe_customer_id && row.stripe_customer_id !== customer.id) {
        await stripe.customers.del(customer.id).catch(() => {});
        customerId = row.stripe_customer_id;
      } else {
        customerId = customer.id;
      }
    }
  }

  // Only a coach workspace has a row to mirror onto. Callers carry `accountKind` from their auth
  // context; when it is absent we cannot tell, so we ask — a no-op UPDATE is cheaper than a wrong
  // "no card" reading later. An ordinary organization with a known kind skips the round trip.
  if (org.accountKind !== 'organization') {
    await linkWorkspaceStripeCustomer(org.id, customerId);
  }
  return customerId;
}

/**
 * Create a Checkout session in mode='setup' — saves a card on file, charges
 * nothing, and starts no subscription or trial. The webhook's setup-mode branch
 * promotes the saved card to the customer's default payment method AND records the
 * card-on-file fact on the account (see recordCardOnFile), so the September 2027
 * conversion (FOUNDING_SEASON_2027_DESK_PLAN.md) can charge it — never before.
 * Success bounces back to the billing page with ?card_saved=1.
 *
 * Works for an organization and for a coach workspace alike: both are `organizations` rows with a
 * slug, and both reach the same billing page.
 */
export async function createCardSetupSession(
  org: { id: string; slug: string; stripeCustomerId?: string | null },
  email: string | undefined,
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const billingPath = `/${org.slug}/admin/org/billing`;
  const customerId = await ensureStripeCustomer(org, email);
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: { orgId: org.id, purpose: 'founding_season_card_on_file' },
    success_url: `${appUrl}${billingPath}?card_saved=1`,
    cancel_url: `${appUrl}${billingPath}`,
  });
  if (!session.url) throw new Error('Stripe did not return a setup session URL');
  return session.url;
}

// ══ THE ACCOUNT'S BILLING FACTS ═══════════════════════════════════════════════════════════════
//
// ⚠⚠ THESE LIVE IN THEIR OWN SERVICE-ROLE-ONLY TABLE, AND THAT IS THE WHOLE POINT (mig 283).
// `organizations` is anon-readable for every public org — RLS is ROW-level, its only SELECT policy
// admits `is_public = true`, and both anon and authenticated hold the table grant on prod. Anything
// added there is published to anyone holding the key that ships in the page bundle. So a card's
// brand and last four, and an account's commitment for next season, are kept off it.
//
// ⚠ CARD ON FILE IS ITS OWN FACT, NOT `stripe_customer_id != null`. Comp reactivation (both the
// workspace and its org) and the webhook's subscription.deleted arms all NULL the customer id on
// accounts that may well have a card — deriving from it would make a coach who saved one in June
// read as "no card", and the operator would chase somebody who had already acted.
//
// Recorded from three Stripe events, because a card can arrive by more than one door:
//   • checkout.session.completed with mode='setup' — the "Add payment method" button;
//   • payment_method.attached — a card added inside the Stripe billing portal;
//   • payment_method.detached — cleared, but only once no card remains.

/** Reads the display details off a Stripe payment method. Absent brand/last4 is fine — the
 *  timestamp is the fact; the label is a courtesy for whoever answers the phone. */
function cardDetailsFrom(pm: Stripe.PaymentMethod | null | undefined): CardDetails {
  return { brand: pm?.card?.brand ?? null, last4: pm?.card?.last4 ?? null };
}

/** Every billing fact this module keeps about one account. All optional — a row starts empty. */
export type OrgBillingFacts = {
  orgId: string;
  cardOnFileAt: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  nextSeasonPlanId: string | null;
  nextSeasonBillingCycle: string | null;
  nextSeasonChosenAt: string | null;
  nextSeasonSubscriptionId: string | null;
};

const FACT_COLUMNS =
  'org_id, card_on_file_at, card_on_file_brand, card_on_file_last4, next_season_plan_id, next_season_billing_cycle, next_season_chosen_at, next_season_subscription_id';

function toFacts(row: Record<string, unknown> | null | undefined): OrgBillingFacts | null {
  if (!row) return null;
  return {
    orgId: row.org_id as string,
    cardOnFileAt: (row.card_on_file_at as string | null) ?? null,
    cardBrand: (row.card_on_file_brand as string | null) ?? null,
    cardLast4: (row.card_on_file_last4 as string | null) ?? null,
    nextSeasonPlanId: (row.next_season_plan_id as string | null) ?? null,
    nextSeasonBillingCycle: (row.next_season_billing_cycle as string | null) ?? null,
    nextSeasonChosenAt: (row.next_season_chosen_at as string | null) ?? null,
    nextSeasonSubscriptionId: (row.next_season_subscription_id as string | null) ?? null,
  };
}

/** One account's billing facts, or null when nothing has ever been recorded for it. */
export async function getOrgBillingFacts(orgId: string): Promise<OrgBillingFacts | null> {
  const { data } = await supabaseAdmin
    .from('organization_billing_facts')
    .select(FACT_COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle();
  return toFacts(data);
}

/** Billing facts for many accounts at once, keyed by org id — the desk's read. */
export async function getOrgBillingFactsBulk(orgIds: string[]): Promise<Map<string, OrgBillingFacts>> {
  if (orgIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from('organization_billing_facts')
    .select(FACT_COLUMNS)
    .in('org_id', orgIds);
  const byOrg = new Map<string, OrgBillingFacts>();
  for (const row of data ?? []) {
    const facts = toFacts(row as Record<string, unknown>);
    if (facts) byOrg.set(facts.orgId, facts);
  }
  return byOrg;
}

/** Upsert one account's facts row, always touching `updated_at`. */
async function writeFacts(orgId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('organization_billing_facts')
    .upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'org_id' });
  if (error) throw error;
}

/** Resolve the account a Stripe customer belongs to. */
async function orgIdForCustomer(customerId: string, fallbackOrgId?: string | null): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (data?.id) return data.id as string;
  if (!fallbackOrgId) return null;
  // ⚠ The fallback is only trusted when the named org has no OTHER customer id. Session metadata is
  // written server-side today, but a future caller passing a less-verified id must not be able to
  // stamp one account's card onto another.
  const { data: named } = await supabaseAdmin
    .from('organizations')
    .select('id, stripe_customer_id')
    .eq('id', fallbackOrgId)
    .maybeSingle();
  if (!named?.id) return null;
  const linked = named.stripe_customer_id as string | null;
  return !linked || linked === customerId ? (named.id as string) : null;
}

/**
 * Stamp "this account has a card on file".
 *
 * `card_on_file_at` is the date the FIRST card was recorded and never moves again — a swap is not a
 * new relationship, and the desk's "no card yet" filter only cares that it is set. Brand and last4
 * follow the newest card so support reads the one that would actually be charged.
 */
export async function recordCardOnFile(params: {
  customerId: string;
  /**
   * The payment method itself where the caller already has it — every Stripe event that triggers
   * this delivers or can expand the object, so passing the id alone would fetch back what we were
   * just handed. A round trip inside a webhook handler is the one waste that costs something real:
   * Stripe retries a slow endpoint.
   */
  paymentMethod?: Stripe.PaymentMethod | null;
  /** Fallback when only an id is to hand — costs one Stripe read. */
  paymentMethodId?: string | null;
  fallbackOrgId?: string | null;
}): Promise<void> {
  const [orgId, details] = await Promise.all([
    orgIdForCustomer(params.customerId, params.fallbackOrgId),
    (async (): Promise<CardDetails> => {
      if (params.paymentMethod) return cardDetailsFrom(params.paymentMethod);
      if (!params.paymentMethodId) return { brand: null, last4: null };
      return cardDetailsFrom(await stripe.paymentMethods.retrieve(params.paymentMethodId).catch(() => null));
    })(),
  ]);
  if (!orgId) return;

  const existing = await getOrgBillingFacts(orgId);
  await writeFacts(orgId, {
    card_on_file_at: existing?.cardOnFileAt ?? new Date().toISOString(),
    card_on_file_brand: details.brand,
    card_on_file_last4: details.last4,
  });
}

/**
 * Clear the card-on-file stamp — but only once Stripe says the customer has no card left.
 *
 * ⚠⚠ THE CLEAR IS CONDITIONAL AT WRITE TIME, NOT ONLY AT READ TIME, AND THAT IS THE FIX.
 * A card swap fires `detached` for the old card and `attached` for the new one in an order Stripe
 * does not guarantee, and the two are processed concurrently. Ask Stripe "any cards left?", get an
 * honest "no" because the new one has not attached yet, and by the time this UPDATE lands the
 * attach handler has already recorded the new card — which an unconditional clear then wipes,
 * leaving the account reading "no card" while Stripe holds one. So the delete only fires while the
 * stored card is still the one being detached, and it fails CLOSED everywhere else.
 */
export async function clearCardOnFileIfNoCardsLeft(
  customerId: string,
  detached?: Stripe.PaymentMethod | null,
): Promise<void> {
  const [orgId, remaining] = await Promise.all([
    orgIdForCustomer(customerId),
    stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 }).catch(() => null),
  ]);
  if (!orgId) return;

  // FAIL CLOSED: if Stripe cannot be asked, keep the stamp. A stale "has a card" costs one wasted
  // conversation; a wrong "no card" chases somebody who has already acted.
  if (!remaining || remaining.data.length > 0) return;

  const clear = supabaseAdmin
    .from('organization_billing_facts')
    .update({
      card_on_file_at: null,
      card_on_file_brand: null,
      card_on_file_last4: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);

  // The write-time guard: only clear while the recorded card is still the detached one. A newer
  // card recorded in the meantime changes last4, the condition misses, and the newer card survives.
  const last4 = detached?.card?.last4 ?? null;
  await (last4 ? clear.eq('card_on_file_last4', last4) : clear.is('card_on_file_last4', null));
}

/**
 * Record what an account chose for next season, and bind the subscription that will charge for it.
 *
 * ⚠ DOES NOT MOVE `plan_id` (owner ruling D2, 2026-09-07). The plan changes when the first charge
 * lands, not when the choice is made — so the free season is worth the same to every account, and
 * "free season, then the plan you chose" stays one sentence a customer can hold.
 *
 * ⚠⚠ A COACH WORKSPACE NEEDS ITS BINDING WRITTEN HERE OR IT IS LOST ON THE FLOOR.
 * `syncTeamWorkspaceSubscription` finds a workspace BY `stripe_subscription_id`, so a brand-new
 * subscription raised against an EXISTING comped workspace matches nothing and is silently dropped.
 * `billing_mode` deliberately stays `platform_override` until the charge — the account is still
 * comped.
 */
export async function recordNextSeasonChoice(params: {
  orgId: string;
  planKey: string;
  billingCycle: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  teamWorkspaceId?: string | null;
}): Promise<void> {
  // ⚠ A plan key is never an empty string. The webhook arms take it from Stripe metadata, and a
  // replayed or hand-made event with `choiceKind` but no `planKey` would otherwise write '' — which
  // SQL reads as "has chosen" and JavaScript reads as "has not", so the desk filter and the email
  // audience would disagree about the same account. A CHECK backs this up in the database.
  if (!params.planKey) return;

  const existing = await getOrgBillingFacts(params.orgId);

  // ⚠⚠ `chosen_at` IS WRITTEN ONCE. Stripe fires `customer.subscription.updated` many times over a
  // subscription's life for reasons that have nothing to do with the customer (invoice previews,
  // trial housekeeping, retried deliveries), and a choice sits in `trialing` for up to FOUR MONTHS.
  // Re-stamping would quietly turn "when you chose" into "whenever Stripe last touched it" — on
  // the desk, in the export, and in the customer's own confirmation. Plan and cycle DO follow a
  // change of mind; the moment of the first decision does not move.
  const writes: Promise<unknown>[] = [
    writeFacts(params.orgId, {
      next_season_plan_id: params.planKey,
      next_season_billing_cycle: params.billingCycle,
      next_season_chosen_at: existing?.nextSeasonChosenAt ?? new Date().toISOString(),
      ...(params.stripeSubscriptionId ? { next_season_subscription_id: params.stripeSubscriptionId } : {}),
    }),
  ];

  if (params.stripeCustomerId) {
    writes.push(
      Promise.resolve(
        supabaseAdmin
          .from('organizations')
          .update({ stripe_customer_id: params.stripeCustomerId })
          .eq('id', params.orgId),
      ),
    );
  }
  if (params.teamWorkspaceId) {
    writes.push(
      Promise.resolve(
        supabaseAdmin
          .from('team_workspaces')
          .update({
            ...(params.stripeCustomerId ? { stripe_customer_id: params.stripeCustomerId } : {}),
            ...(params.stripeSubscriptionId ? { stripe_subscription_id: params.stripeSubscriptionId } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.teamWorkspaceId),
      ),
    );
  }
  await Promise.all(writes);
}

/**
 * The customer withdrew their next-season choice — put the account back where it was.
 *
 * ⚠⚠ THIS IS THE OTHER HALF OF THE CHOICE, AND WITHOUT IT CANCELLING ONE TEARS AN ACCOUNT DOWN.
 * The choice creates a real Stripe subscription months before it charges, and the billing page
 * hands the customer a portal link. Cancel there and Stripe fires `customer.subscription.deleted` —
 * which the ordinary arm reads as "this account cancelled", archiving every tournament, hiding the
 * public site and suspending the org, or revoking a coach's Premium entitlements. All of it while
 * the account's actual Founding Season comp still has months to run.
 *
 * So a withdrawn choice clears the choice and nothing else. The comp is untouched, the chooser
 * reappears on the billing page, and the desk counts the account as "no choice yet" again — which
 * is exactly what it now is.
 */
export async function clearNextSeasonChoice(orgId: string): Promise<void> {
  await supabaseAdmin
    .from('organization_billing_facts')
    .update({
      next_season_plan_id: null,
      next_season_billing_cycle: null,
      next_season_chosen_at: null,
      next_season_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId);
}

/** Find the account whose next-season choice this subscription is, if any. */
export async function orgIdForNextSeasonSubscription(subscriptionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('organization_billing_facts')
    .select('org_id')
    .eq('next_season_subscription_id', subscriptionId)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}
