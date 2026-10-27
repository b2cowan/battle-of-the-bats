import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { factsFromRow, payoutsState, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow, type PayoutsState } from './online-payment-account';
import { OPEN_DISPUTE_STATUSES } from './online-payment-dispute';
import { PAYMENTS_TERMS_VERSION, disputeWhyShort, termsStanding, termsVersionDate } from './online-payment-words';
import { readOutstanding, type PaymentsOutstanding } from './online-payment-endings';
import { effectiveOrgFactsForId } from './entitlement-grants';
import { hasPlanFeature } from './plan-features';
import { PLAN_CONFIG } from './plan-config';
import type { OrgPlan } from './types';

/**
 * THE CONSOLE'S ONLINE PAYMENTS, READ ONLY (Club Tier Stage 12d-2 Part 5 — frame 6, words §6; owner rulings ask 7 and
 * 2026-10-27 ruling 3: Super admin, Billing and Support read it). Two reads: one club's tab (the account, its terms, the
 * last 30 days, clearing debits, open disputes, Stripe messages we couldn't process) and the one Health list across
 * clubs ("Needs a look"). ⚠ NOTHING here writes. A child's name is never in either read: the tab names a dispute by its
 * receipt, and "Show the player" is its own logged read. Never a card or bank number anywhere.
 */

const DAY = 86_400_000;
/** A Stripe message still failing after this long moves under "Stopped retrying" (words §6.1). */
export const MESSAGE_STOP_DAYS = 30;

export interface ClubOnlinePayments {
  testMode: boolean;
  account: {
    state: PayoutsState;
    connectedAt: string; connectedBy: string | null;
    disconnectedAt: string | null; disconnectedBy: string | null;
    /** Stripe closed it (a disconnect nobody pressed). */
    stripeClosed: boolean;
    /** Online payments ended by the plan while the account stays connected (ask 4). */
    ended: { day: string | null; why: 'plan'; targetPlan: string } | { day: string | null; why: 'suspended' } | null;
  };
  terms: { standing: ReturnType<typeof termsStanding>; agreedAt: string | null; versionDate: string | null } | null;
  volume: { total: number; payments: number; refunds: number };
  clearing: number;
  disputes: {
    feesSoFar: number;
    rows: { id: string; onlinePaymentId: string; receiptNo: number | null; home: string; why: string; answerBy: string | null; held: number }[];
  };
  messages: { failing: MessageRow[]; stopped: MessageRow[] };
  outstanding: PaymentsOutstanding | null;
  /** The tab's count: what is open on it (words §6.1 `pa.tab`). */
  openItems: number;
}

export type MessageRow = { id: string; type: string; error: string; receivedAt: string; tries: number };

async function nameOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return (data?.user?.user_metadata?.full_name as string | undefined) ?? data?.user?.email ?? null;
}

function splitMessages(rows: MessageRow[], now: number): { failing: MessageRow[]; stopped: MessageRow[] } {
  const cut = now - MESSAGE_STOP_DAYS * DAY;
  return {
    failing: rows.filter(m => new Date(m.receivedAt).getTime() >= cut),
    stopped: rows.filter(m => new Date(m.receivedAt).getTime() < cut),
  };
}

/** One club's tab. Null when the club never connected (no tab at all, words §6.1). Throws on a failed read. */
export async function readClubOnlinePayments(orgId: string, now: Date = new Date()): Promise<ClubOnlinePayments | null> {
  const { data: acctRow, error } = await supabaseAdmin.from('org_payment_accounts')
    .select(`${PAYOUTS_ACCOUNT_COLUMNS}, livemode, connected_at, connected_by, disconnected_by, terms_version, terms_agreed_at`)
    .eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!acctRow) return null;
  const acct = acctRow as PayoutsAccountRow & {
    livemode: boolean; connected_at: string; connected_by: string | null; disconnected_by: string | null;
    terms_version: string | null; terms_agreed_at: string | null; stripe_account_id: string;
  };
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const [paid, refunds, clearing, disputes, messages, org, facts, outstanding] = await Promise.all([
    supabaseAdmin.from('online_payments').select('total_amount').eq('org_id', orgId)
      .in('status', ['paid', 'partly_refunded', 'refunded', 'reversed']).gte('paid_at', since).limit(5000),
    supabaseAdmin.from('online_payment_refunds').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      .eq('status', 'succeeded').gte('succeeded_at', since),
    supabaseAdmin.from('online_payments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'clearing'),
    supabaseAdmin.from('online_payment_disputes').select('id, online_payment_id, reason, due_by, held, amount, status, stripe_fee, fee_paid_from')
      .eq('org_id', orgId).in('status', [...OPEN_DISPUTE_STATUSES]).order('due_by', { ascending: true, nullsFirst: false }),
    supabaseAdmin.from('stripe_connect_events').select('id, type, error, received_at, attempts')
      .eq('account', acct.stripe_account_id).is('processed_at', null).not('error', 'is', null).order('received_at', { ascending: false }).limit(200),
    supabaseAdmin.from('organizations').select('subscription_status, billing_suspended_at').eq('id', orgId).maybeSingle(),
    effectiveOrgFactsForId(orgId),
    readOutstanding(orgId).catch(() => null),
  ]);
  for (const r of [paid, refunds, clearing, disputes, messages, org]) if (r.error) throw r.error;

  const disputeRows = (disputes.data ?? []) as Array<{ id: string; online_payment_id: string; reason: string | null; due_by: string | null; held: number; amount: number; status: string; stripe_fee: number | null }>;
  const payIds = [...new Set(disputeRows.map(d => d.online_payment_id))];
  const { data: pays } = payIds.length
    ? await supabaseAdmin.from('online_payments').select('id, receipt_no, flow, tournament_id').in('id', payIds)
    : { data: [] };
  const tourIds = [...new Set((pays ?? []).map(p => p.tournament_id as string | null).filter((x): x is string => !!x))];
  const { data: tours } = tourIds.length ? await supabaseAdmin.from('tournaments').select('id, name').in('id', tourIds) : { data: [] };
  const tourName = new Map((tours ?? []).map(t => [t.id as string, t.name as string]));
  const payById = new Map((pays ?? []).map(p => [p.id as string, p]));

  const state = payoutsState(factsFromRow(acct));
  const planOffers = facts ? hasPlanFeature(facts.planId, 'online_payments') : true;
  let ended: ClubOnlinePayments['account']['ended'] = null;
  if (!acct.disconnected_at && org.data?.subscription_status === 'canceled') {
    ended = { day: (org.data.billing_suspended_at as string | null) ?? null, why: 'suspended' };
  } else if (!acct.disconnected_at && !planOffers && facts) {
    const { data: moved } = await supabaseAdmin.from('platform_events').select('created_at').eq('org_id', orgId)
      .in('event_type', ['plan_downgraded', 'subscription_canceled']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    ended = { day: (moved?.created_at as string | undefined) ?? null, why: 'plan', targetPlan: PLAN_CONFIG[facts.planId as OrgPlan]?.label ?? facts.planId };
  }

  const msgRows: MessageRow[] = ((messages.data ?? []) as Array<{ id: string; type: string; error: string; received_at: string; attempts: number }>)
    .map(m => ({ id: m.id, type: m.type, error: m.error, receivedAt: m.received_at, tries: m.attempts }));
  const split = splitMessages(msgRows, now.getTime());
  const feesSoFar = disputeRows.reduce((s, d) => s + Number(d.stripe_fee ?? 0), 0);

  return {
    testMode: !acct.livemode,
    account: {
      state,
      connectedAt: acct.connected_at, connectedBy: await nameOf(acct.connected_by),
      disconnectedAt: acct.disconnected_at ?? null, disconnectedBy: await nameOf(acct.disconnected_by),
      stripeClosed: !!acct.disconnected_at && !acct.disconnected_by,
      ended,
    },
    terms: acct.terms_agreed_at ? {
      standing: termsStanding(acct.terms_version), agreedAt: acct.terms_agreed_at, versionDate: termsVersionDate(acct.terms_version),
    } : null,
    volume: {
      total: Math.round(((paid.data ?? []) as Array<{ total_amount: number }>).reduce((s, p) => s + Number(p.total_amount), 0) * 100) / 100,
      payments: (paid.data ?? []).length,
      refunds: refunds.count ?? 0,
    },
    clearing: clearing.count ?? 0,
    disputes: {
      feesSoFar: Math.round(feesSoFar * 100) / 100,
      rows: disputeRows.map(d => {
        const p = payById.get(d.online_payment_id);
        return {
          id: d.id, onlinePaymentId: d.online_payment_id, receiptNo: (p?.receipt_no as number | null) ?? null,
          home: p?.flow === 'league_signup' ? 'house league' : (p?.tournament_id && tourName.get(p.tournament_id as string)) || 'a tournament',
          why: disputeWhyShort(d.reason), answerBy: d.due_by, held: Number(d.held) > 0 ? Number(d.held) : Number(d.amount),
        };
      }),
    },
    messages: split,
    outstanding,
    openItems: disputeRows.length + split.failing.length
      + (outstanding ? outstanding.feesFailed + outstanding.invoicesUnpaid : 0),
  };
}

// ── Health › Online payments, every club (words §6.2) ──────────────────────────────────────────────────────────────

export type HealthKind = 'dispute' | 'disconnected' | 'closed' | 'messages' | 'terms' | 'invoice' | 'fee_failed';

export interface HealthRow {
  orgId: string; club: string;
  kind: HealthKind;
  /** The count the words need (disputes, messages). */
  n: number;
  /** The soonest answer-by, for a dispute row. */
  due: string | null;
  /** Since when it has needed a look. */
  since: string;
  /** Most urgent first: an instant to sort by (a due date, else the moment it began). */
  sortAt: string;
}

/** Most urgent first (builder's call, stated to the owner 2026-10-27): disputes by answer-by, then the rest by age. */
const KIND_ORDER: Record<HealthKind, number> = { dispute: 0, disconnected: 1, closed: 2, messages: 3, fee_failed: 4, invoice: 5, terms: 6 };

/** Every club's online payments that need a look. A row leaves when it clears. Throws on a failed read. */
export async function readOnlinePaymentsHealth(now: Date = new Date()): Promise<HealthRow[]> {
  const cut = new Date(now.getTime() - MESSAGE_STOP_DAYS * DAY).toISOString();
  const [accounts, disputes, messages, invoices, failedFees] = await Promise.all([
    supabaseAdmin.from('org_payment_accounts').select('org_id, stripe_account_id, disconnected_at, disconnected_by, terms_version, connected_at').limit(5000),
    supabaseAdmin.from('online_payment_disputes').select('org_id, due_by, opened_at').in('status', [...OPEN_DISPUTE_STATUSES]).limit(5000),
    supabaseAdmin.from('stripe_connect_events').select('account, received_at').is('processed_at', null).not('error', 'is', null).gte('received_at', cut).limit(5000),
    supabaseAdmin.from('platform_fee_invoices').select('org_id, due_at').in('status', ['open', 'uncollectible']).lt('due_at', now.toISOString()).limit(5000),
    supabaseAdmin.from('platform_stripe_fees').select('org_id, created_at').is('billed_at', null).is('exempt_reason', null).not('bill_error', 'is', null).limit(5000),
  ]);
  for (const r of [accounts, disputes, messages, invoices, failedFees]) if (r.error) throw r.error;
  type Acct = { org_id: string; stripe_account_id: string; disconnected_at: string | null; disconnected_by: string | null; terms_version: string | null; connected_at: string };
  const accts = (accounts.data ?? []) as Acct[];
  const byAccount = new Map(accts.map(a => [a.stripe_account_id, a]));
  const rows: Omit<HealthRow, 'club'>[] = [];

  const disputesByOrg = new Map<string, { n: number; due: string | null; since: string }>();
  for (const d of (disputes.data ?? []) as Array<{ org_id: string; due_by: string | null; opened_at: string }>) {
    const cur = disputesByOrg.get(d.org_id) ?? { n: 0, due: null, since: d.opened_at };
    cur.n += 1;
    if (d.due_by && (!cur.due || d.due_by < cur.due)) cur.due = d.due_by;
    if (d.opened_at < cur.since) cur.since = d.opened_at;
    disputesByOrg.set(d.org_id, cur);
  }
  for (const a of accts) {
    const open = disputesByOrg.get(a.org_id);
    if (a.disconnected_at && !a.disconnected_by) rows.push({ orgId: a.org_id, kind: 'closed', n: 0, due: null, since: a.disconnected_at, sortAt: a.disconnected_at });
    if (open && a.disconnected_at) rows.push({ orgId: a.org_id, kind: 'disconnected', n: open.n, due: open.due, since: a.disconnected_at, sortAt: open.due ?? a.disconnected_at });
    else if (open) rows.push({ orgId: a.org_id, kind: 'dispute', n: open.n, due: open.due, since: open.since, sortAt: open.due ?? open.since });
    // Not on the current terms: joins once counsel's dated version exists (words §6.2).
    if (!a.disconnected_at && termsVersionDate(PAYMENTS_TERMS_VERSION) && termsStanding(a.terms_version) === 'stale') {
      rows.push({ orgId: a.org_id, kind: 'terms', n: 0, due: null, since: `${PAYMENTS_TERMS_VERSION}T00:00:00.000Z`, sortAt: `${PAYMENTS_TERMS_VERSION}T00:00:00.000Z` });
    }
  }
  const msgByOrg = new Map<string, { n: number; since: string }>();
  for (const m of (messages.data ?? []) as Array<{ account: string | null; received_at: string }>) {
    const a = m.account ? byAccount.get(m.account) : null;
    if (!a) continue;
    const cur = msgByOrg.get(a.org_id) ?? { n: 0, since: m.received_at };
    cur.n += 1;
    if (m.received_at < cur.since) cur.since = m.received_at;
    msgByOrg.set(a.org_id, cur);
  }
  for (const [orgId, m] of msgByOrg) rows.push({ orgId, kind: 'messages', n: m.n, due: null, since: m.since, sortAt: m.since });
  const firstOf = (list: Array<{ org_id: string; at: string }>) => {
    const out = new Map<string, string>();
    for (const x of list) if (!out.has(x.org_id) || x.at < out.get(x.org_id)!) out.set(x.org_id, x.at);
    return out;
  };
  for (const [orgId, at] of firstOf(((invoices.data ?? []) as Array<{ org_id: string; due_at: string }>).map(i => ({ org_id: i.org_id, at: i.due_at })))) {
    rows.push({ orgId, kind: 'invoice', n: 0, due: null, since: at, sortAt: at });
  }
  for (const [orgId, at] of firstOf(((failedFees.data ?? []) as Array<{ org_id: string; created_at: string }>).map(f => ({ org_id: f.org_id, at: f.created_at })))) {
    rows.push({ orgId, kind: 'fee_failed', n: 0, due: null, since: at, sortAt: at });
  }
  if (!rows.length) return [];
  const orgIds = [...new Set(rows.map(r => r.orgId))];
  const { data: orgs, error } = await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds.slice(0, 1000));
  if (error) throw error;
  const name = new Map((orgs ?? []).map(o => [o.id as string, o.name as string]));
  return rows
    .map(r => ({ ...r, club: name.get(r.orgId) ?? '' }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.sortAt < b.sortAt ? -1 : a.sortAt > b.sortAt ? 1 : 0));
}
