import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { readAllPages } from './console-money-needs-look';
import { chunked } from './supabase-paging';
import { stripeKeyIsLive } from './stripe-mode';
import { notCustomerOrgIds } from './platform-metrics';
import { getStaffFreeTime } from './free-time-list';
import { foundingCompExpiryByOrg } from './founding-season-desk';
import { listDemoOrgIdsQuietly } from './demo-org-server';
import { UNPAID_RECORD_COLUMNS, type ComingInput, type RenewalOrg, type UnpaidInput, type UnpaidRecord } from './renewals';

/**
 * RENEWALS' READS (Plans & pricing Stage 2 Part 4a). OUR OWN TABLES ONLY: no Stripe call, nothing stored (ruling 1, no local
 * mirror). Each view reads on its own and fails on its own: a view that could not be read is `null`, which the page shows as
 * "could not read", never as nothing due. The rules over these rows are `lib/renewals.ts`.
 */

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

const ORG_COLUMNS = 'id, name, plan_id, account_kind, subscription_status, current_period_end, subscription_period, '
  + 'subscription_amount_cents, subscription_currency, stripe_subscription_id';

/** Every org, every page (no 5,000-row cap), and the ids the customer counts leave out. */
async function readOrgs(): Promise<{ all: RenewalOrg[]; excluded: Set<string> }> {
  const [all, excluded] = await Promise.all([
    readAllPages<RenewalOrg>((from, to) => supabaseAdmin.from('organizations').select(ORG_COLUMNS)
      .order('id').range(from, to) as unknown as Page<RenewalOrg>),
    notCustomerOrgIds(),
  ]);
  return { all, excluded };
}

const byId = (orgs: RenewalOrg[]) => new Map(orgs.map(o => [o.id, o]));

/** Coming up's inputs, or null when any part could not be read. */
export async function readComingUp(): Promise<ComingInput | null> {
  try {
    const [{ all, excluded }, staffFreeTime, founding, demoIds, endings] = await Promise.all([
      readOrgs(),
      getStaffFreeTime(),
      foundingCompExpiryByOrg({ throwOnError: true }),
      listDemoOrgIdsQuietly(),
      supabaseAdmin.from('billing_retention_intents').select('org_id').eq('status', 'pending'),
    ]);
    if (endings.error) throw endings.error;
    const demo = new Set(demoIds);
    for (const id of demo) founding.delete(id);
    return {
      orgs: all.filter(o => !excluded.has(o.id)),
      orgsById: byId(all),
      staffFreeTime,
      foundingByOrg: founding,
      endingOrgIds: new Set(((endings.data ?? []) as Array<{ org_id: string }>).map(r => r.org_id)),
    };
  } catch (err) {
    console.warn('[platform-admin] renewals coming-up read failed:', (err as { code?: string }).code ?? 'error');
    return null;
  }
}

/** The newest event of a type for each of these orgs (`platform_events.created_at`, the reading `upcomingEnding` uses). */
async function newestEvent(eventType: string, orgIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const chunks = await Promise.all(chunked(orgIds, 100).map(async chunk => {
    const { data, error } = await supabaseAdmin.from('platform_events').select('org_id, created_at')
      .eq('event_type', eventType).in('org_id', chunk).order('created_at', { ascending: false }).limit(5000);
    if (error) throw error;
    return (data ?? []) as Array<{ org_id: string; created_at: string }>;
  }));
  // A club sits in exactly one chunk, and each chunk is newest first, so the first row seen for a club is its newest.
  for (const rows of chunks) for (const r of rows) if (!out.has(r.org_id)) out.set(r.org_id, r.created_at);
  return out;
}

/** Unpaid bills' inputs, in the site's Stripe mode, or null when any part could not be read. */
export async function readUnpaid(live: boolean = stripeKeyIsLive()): Promise<UnpaidInput | null> {
  try {
    const [{ all, excluded }, records] = await Promise.all([
      readOrgs(),
      readAllPages<UnpaidRecord>((from, to) => supabaseAdmin.from('platform_charge_tax_records')
        .select(UNPAID_RECORD_COLUMNS.join(', ')).eq('livemode', live).in('status', ['open', 'uncollectible'])
        .order('stripe_invoice_id').range(from, to) as unknown as Page<UnpaidRecord>),
    ]);
    const orgsById = byId(all);
    const pastDueOrgIds = all.filter(o => o.subscription_status === 'past_due' && !excluded.has(o.id)).map(o => o.id);
    const billOrgIds = [...new Set(records.map(r => r.org_id).filter((id): id is string => !!id && !excluded.has(id)))];
    const canceledWithBills = billOrgIds.filter(id => orgsById.get(id)?.subscription_status === 'canceled');
    const pastDueAll = [...new Set([...pastDueOrgIds, ...billOrgIds.filter(id => orgsById.get(id)?.subscription_status === 'past_due')])];
    const [pastDueSince, endedOn] = await Promise.all([
      newestEvent('subscription_past_due', pastDueAll),
      newestEvent('subscription_canceled', canceledWithBills),
    ]);
    return { records, orgsById, pastDueOrgIds, pastDueSince, endedOn, excludedOrgIds: excluded };
  } catch (err) {
    console.warn('[platform-admin] renewals unpaid read failed:', (err as { code?: string }).code ?? 'error');
    return null;
  }
}
