import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { isUuid } from './utils';
import { writePlatformAuditLogStrict } from './platform-audit';
import { InFlightError, type PriceMap, type RefundRecord, type RefundStore } from './console-money-stripe';

/**
 * The Money tab's database half (Support console Stage 3): our refunds record (mig 380, server-only) and the club's
 * Stripe facts. The refund route hands `refundStore` to `makeRefund`; the guards hand it a fake.
 */

const RECORD_COLUMNS = 'id, status, actor_email, created_at, amount_cents, currency, reason, stripe_refund_id';

export const refundStore: RefundStore = {
  async openFor(chargeId) {
    const { data, error } = await supabaseAdmin.from('platform_refunds').select(RECORD_COLUMNS)
      .eq('stripe_charge_id', chargeId).in('status', ['started', 'unknown']).order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as RefundRecord[];
  },
  async countByActorSince(actorEmail, sinceIso) {
    const { count, error } = await supabaseAdmin.from('platform_refunds').select('id', { count: 'exact', head: true })
      .eq('actor_email', actorEmail).gte('created_at', sinceIso).in('status', ['started', 'done', 'unknown']);
    if (error) throw error;
    return count ?? 0;
  },
  async insertStarted(row) {
    const { data, error } = await supabaseAdmin.from('platform_refunds').insert(row).select('id').single();
    if (error?.code === '23505') throw new InFlightError();
    if (error || !data) throw error ?? new Error('refund record not written');
    return { id: (data as { id: string }).id };
  },
  async complete(id, patch) {
    const { data, error } = await supabaseAdmin.from('platform_refunds')
      .update({ ...patch, completed_at: new Date().toISOString() }) // utc-intentional
      .eq('id', id).in('status', ['started', 'unknown']).select('id');
    if (error) throw error;
    return (data ?? []).length > 0;
  },
  async audit(entry) {
    await writePlatformAuditLogStrict(entry.actorEmail, entry.orgId, entry.action, 'charge', null, entry.value, { reason: entry.reason });
  },
};

/**
 * The club's Stripe customer, and whether another club shares it (a shared customer is never read or refunded). A Coaches
 * Portal the club pays for bills on the club's OWN customer, as its own subscription: those subscriptions are the club's,
 * named as such (never "two live subscriptions"), and they do not make the customer shared.
 */
export async function clubStripeFacts(orgId: string): Promise<{ name: string; customerId: string | null; customerShared: boolean; subscriptionId: string | null; portalSubscriptionIds: string[] } | null> {
  if (!isUuid(orgId)) return null; // a malformed address is "not found", never a database error
  const { data: org, error } = await supabaseAdmin.from('organizations')
    .select('name, stripe_customer_id, stripe_subscription_id').eq('id', orgId).maybeSingle();
  if (error) throw error;
  if (!org) return null;
  const row = org as { name: string; stripe_customer_id: string | null; stripe_subscription_id: string | null };
  const customerId = row.stripe_customer_id && !row.stripe_customer_id.startsWith('mock_') ? row.stripe_customer_id : null;
  let customerShared = false;
  let portalSubscriptionIds: string[] = [];
  if (customerId) {
    const [orgs, workspaces] = await Promise.all([
      supabaseAdmin.from('organizations').select('id', { count: 'exact', head: true }).eq('stripe_customer_id', customerId),
      supabaseAdmin.from('team_workspaces').select('billing_owner_org_id, stripe_subscription_id').eq('stripe_customer_id', customerId),
    ]);
    if (orgs.error) throw orgs.error;
    if (workspaces.error) throw workspaces.error;
    const ws = (workspaces.data ?? []) as Array<{ billing_owner_org_id: string | null; stripe_subscription_id: string | null }>;
    customerShared = (orgs.count ?? 0) !== 1 || ws.some(w => w.billing_owner_org_id !== orgId);
    portalSubscriptionIds = ws.map(w => w.stripe_subscription_id).filter((v): v is string => !!v);
  }
  return { name: row.name, customerId, customerShared, subscriptionId: row.stripe_subscription_id, portalSubscriptionIds };
}

/** Stripe price → our plan and cycle, from the prices we configured (both modes: a price id is unique to its mode). */
export async function priceMap(): Promise<PriceMap> {
  const { data, error } = await supabaseAdmin.from('stripe_prices').select('price_id, plan_id, billing_cycle').not('price_id', 'is', null);
  if (error) throw error;
  return new Map(((data ?? []) as Array<{ price_id: string; plan_id: string; billing_cycle: string }>)
    .map(r => [r.price_id, { planId: r.plan_id, cycle: r.billing_cycle }] as const));
}

export type ConsoleRefund = { id: string; chargeId: string; stripeRefundId: string | null; status: string; amountCents: number; currency: string; actorEmail: string; createdAt: string };

/** The console's refunds of one charge (the charge window's "who"). Never the card, and not the reason (the Story has it). */
export async function clubRefunds(orgId: string, chargeId: string): Promise<ConsoleRefund[]> {
  const { data, error } = await supabaseAdmin.from('platform_refunds')
    .select('id, stripe_charge_id, stripe_refund_id, status, amount_cents, currency, actor_email, created_at')
    .eq('org_id', orgId).eq('stripe_charge_id', chargeId).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; stripe_charge_id: string; stripe_refund_id: string | null; status: string; amount_cents: number; currency: string; actor_email: string; created_at: string }>)
    .map(r => ({ id: r.id, chargeId: r.stripe_charge_id, stripeRefundId: r.stripe_refund_id, status: r.status, amountCents: r.amount_cents,
      currency: r.currency, actorEmail: r.actor_email, createdAt: r.created_at }));
}
