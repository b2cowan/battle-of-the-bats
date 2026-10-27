import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { listPayoutLinesPage, listPayoutsPage } from './stripe-connect';
import { SCOPE_WORDS } from './online-payment-words';
import { onlinePaymentsOn } from './online-payments-switch';
import {
  childrenWho, mapPayoutLines, payoutContents, payoutCounts, payoutFailReason, payoutStatus,
  type BtIn, type OurIndex, type OurPayment, type PayoutContents, type PayoutFailReason, type PayoutLine, type PayoutStatus,
} from './online-payouts-map';

/**
 * THE PAYOUTS READ (Club Tier Stage 12d-2 Part 2 — frame 3; owner ruling 1, 2026-10-27: read Stripe LIVE, held a few
 * minutes, never a stored copy). One read per screen: the club's payouts that arrive in the chosen dates and, for each
 * automatic payout Stripe has finished matching, the balance transactions inside it — so Find (a name, a receipt) and
 * Export work across every payout on screen, and opening one costs nothing more. Never a read per row.
 *
 * Stripe's limits (plan §0, 12d-2 state): reads are 25 a second in a sandbox and count against a rolling allowance per
 * connected account, so the payouts are read a few at a time and the whole read is held in this server's memory for a
 * few minutes. A failure is never held: the screen says Stripe didn't answer and offers Try again.
 */

export interface PayoutRow {
  id: string;
  sent: string;
  /** Stripe's expected arrival in the bank (`arrival_date`), what the bank statement is matched against. */
  arrives: string | null;
  status: PayoutStatus;
  failReason: PayoutFailReason;
  amount: number;
  contents: PayoutContents;
  lines: PayoutLine[];
  counts: { payments: number; refunds: number };
}

export interface PayoutsRead {
  from: string;
  to: string;
  testMode: boolean;
  /** The bank account the newest payout went to; null before the first payout. */
  last4: string | null;
  payouts: PayoutRow[];
}

const HOLD_MS = 3 * 60 * 1000;
const MAX_PAGES = 10;
const CONCURRENT = 4;
const held = new Map<string, { at: number; read: PayoutsRead }>();

/** A calendar day as Stripe's unix seconds. Stripe stamps a payout's `arrival_date` at midnight UTC of the arrival day
 *  (a date, not a moment), so the day is read in UTC, never in the club's zone. */
function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 1000);
}

async function listAll<T>(page: (startingAfter?: string) => Promise<Stripe.ApiList<T & { id: string }>>): Promise<(T & { id: string })[]> {
  const out: (T & { id: string })[] = [];
  let after: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await page(after);
    out.push(...res.data);
    if (!res.has_more || !res.data.length) break;
    after = res.data[res.data.length - 1].id;
  }
  return out;
}

async function inBatches<T, R>(xs: readonly T[], fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < xs.length; i += CONCURRENT) out.push(...await Promise.all(xs.slice(i, i + CONCURRENT).map(fn)));
  return out;
}

function sourceOf(bt: Stripe.BalanceTransaction): { sourceId: string | null; sourceCharge: string | null } {
  const s = bt.source as unknown;
  if (!s) return { sourceId: null, sourceCharge: null };
  if (typeof s === 'string') return { sourceId: s, sourceCharge: null };
  const o = s as { id: string; object?: string; charge?: string | { id: string } | null };
  const charge = o.object === 'charge' ? o.id : typeof o.charge === 'string' ? o.charge : o.charge?.id ?? null;
  return { sourceId: o.id, sourceCharge: charge };
}

/** Our rows behind every source a payout names, already named (who, what) for the screen. */
async function ourIndex(orgId: string, bts: readonly BtIn[]): Promise<OurIndex> {
  const ids = new Set<string>();
  for (const b of bts) { if (b.sourceId) ids.add(b.sourceId); if (b.sourceCharge) ids.add(b.sourceCharge); }
  const all = [...ids];
  const charges = all.filter(i => i.startsWith('ch_') || i.startsWith('py_'));
  const refundIds = all.filter(i => i.startsWith('re_') || i.startsWith('pyr_'));
  const disputeIds = all.filter(i => i.startsWith('du_') || i.startsWith('dp_'));
  if (!all.length) return { payments: [], refunds: {}, disputes: {} };

  const [{ data: refunds }, { data: disputes }] = await Promise.all([
    refundIds.length
      ? supabaseAdmin.from('online_payment_refunds').select('stripe_refund_id, online_payment_id').eq('org_id', orgId).in('stripe_refund_id', refundIds)
      : Promise.resolve({ data: [] }),
    disputeIds.length
      ? supabaseAdmin.from('online_payment_disputes').select('stripe_dispute_id, online_payment_id').eq('org_id', orgId).in('stripe_dispute_id', disputeIds)
      : Promise.resolve({ data: [] }),
  ]);
  const refundMap: Record<string, string> = {};
  for (const r of (refunds ?? []) as Array<{ stripe_refund_id: string; online_payment_id: string }>) refundMap[r.stripe_refund_id] = r.online_payment_id;
  const disputeMap: Record<string, string> = {};
  for (const d of (disputes ?? []) as Array<{ stripe_dispute_id: string; online_payment_id: string }>) disputeMap[d.stripe_dispute_id] = d.online_payment_id;

  const byIdWanted = [...new Set([...Object.values(refundMap), ...Object.values(disputeMap)])];
  const cols = 'id, flow, rail, scope, receipt_no, stripe_charge_id, stripe_payment_intent_id, stripe_dispute_id, tournament_id, team_id, description';
  const reads = [
    charges.length ? supabaseAdmin.from('online_payments').select(cols).eq('org_id', orgId).in('stripe_charge_id', charges) : null,
    disputeIds.length ? supabaseAdmin.from('online_payments').select(cols).eq('org_id', orgId).in('stripe_dispute_id', disputeIds) : null,
    byIdWanted.length ? supabaseAdmin.from('online_payments').select(cols).eq('org_id', orgId).in('id', byIdWanted) : null,
  ];
  type Row = {
    id: string; flow: 'tournament_team' | 'league_signup'; rail: 'card' | 'bank_debit'; scope: 'deposit' | 'balance' | 'full' | null;
    receipt_no: number | null; stripe_charge_id: string | null; stripe_payment_intent_id: string | null; stripe_dispute_id: string | null;
    tournament_id: string | null; team_id: string | null; description: string;
  };
  const rows = new Map<string, Row>();
  for (const res of await Promise.all(reads.map(r => r ?? Promise.resolve({ data: [] as Row[], error: null })))) {
    if (res.error) throw res.error;
    for (const r of (res.data ?? []) as Row[]) rows.set(r.id, r);
  }
  const list = [...rows.values()];

  const teamIds = [...new Set(list.map(r => r.team_id).filter((x): x is string => !!x))];
  const tourIds = [...new Set(list.map(r => r.tournament_id).filter((x): x is string => !!x))];
  const leagueIds = list.filter(r => r.flow === 'league_signup').map(r => r.id);
  const [{ data: teams }, { data: tours }, { data: items }] = await Promise.all([
    teamIds.length ? supabaseAdmin.from('teams').select('id, name').in('id', teamIds) : Promise.resolve({ data: [] }),
    tourIds.length ? supabaseAdmin.from('tournaments').select('id, name').in('id', tourIds) : Promise.resolve({ data: [] }),
    leagueIds.length ? supabaseAdmin.from('online_payment_items').select('online_payment_id, registration_id, description').in('online_payment_id', leagueIds) : Promise.resolve({ data: [] }),
  ]);
  const teamName = new Map(((teams ?? []) as Array<{ id: string; name: string }>).map(t => [t.id, t.name]));
  const tourName = new Map(((tours ?? []) as Array<{ id: string; name: string }>).map(t => [t.id, t.name]));
  const itemRows = (items ?? []) as Array<{ online_payment_id: string; registration_id: string | null; description: string }>;
  const regIds = [...new Set(itemRows.map(i => i.registration_id).filter((x): x is string => !!x))];
  const { data: regs } = regIds.length
    ? await supabaseAdmin.from('league_registrations').select('id, player_first_name, player_last_name').in('id', regIds)
    : { data: [] };
  const regName = new Map(((regs ?? []) as Array<{ id: string; player_first_name: string | null; player_last_name: string | null }>)
    .map(r => [r.id, { first: r.player_first_name ?? '', last: r.player_last_name ?? '' }]));

  const payments: OurPayment[] = list.map(r => {
    let who = r.description;
    let what = 'House league';
    if (r.flow === 'tournament_team') {
      who = (r.team_id && teamName.get(r.team_id)) || r.description;
      const tour = (r.tournament_id && tourName.get(r.tournament_id)) || '';
      what = `${tour}${tour ? ' ' : ''}${SCOPE_WORDS.noun[r.scope ?? 'full']}`.trim();
    } else {
      const kids = itemRows.filter(i => i.online_payment_id === r.id).map(i => (i.registration_id && regName.get(i.registration_id)) || null)
        .filter((k): k is { first: string; last: string } => !!k && !!(k.first || k.last));
      if (kids.length) who = childrenWho(kids);
    }
    return { id: r.id, chargeId: r.stripe_charge_id, paymentIntentId: r.stripe_payment_intent_id, disputeId: r.stripe_dispute_id, receiptNo: r.receipt_no, rail: r.rail, who, what };
  });
  return { payments, refunds: refundMap, disputes: disputeMap };
}

/** Read a club's payouts that arrive between two club days (inclusive). Throws when Stripe doesn't answer. */
export async function readPayouts(args: { orgId: string; accountId: string; livemode: boolean; from: string; to: string }): Promise<PayoutsRead> {
  const key = `${args.accountId}:${args.from}:${args.to}`;
  const hit = held.get(key);
  if (hit && Date.now() - hit.at < HOLD_MS) return hit.read;

  // Arrival is what a bank statement shows: filtered by it, and trimmed to the chosen days below.
  const payouts = await listAll<Stripe.Payout>(after => listPayoutsPage(args.accountId, { gte: dayStart(args.from), lte: dayStart(args.to) }, after));
  const inRange = payouts.filter(p => {
    const day = new Date(p.arrival_date * 1000).toISOString().slice(0, 10);
    return day >= args.from && day <= args.to;
  });

  const contents = new Map<string, PayoutContents>(inRange.map(p => [p.id, payoutContents({
    status: p.status, automatic: p.automatic, reconciliationStatus: (p as { reconciliation_status?: string }).reconciliation_status ?? null,
  })]));
  const listed = inRange.filter(p => contents.get(p.id) === 'listed');
  const btsBy = new Map<string, BtIn[]>();
  await inBatches(listed, async p => {
    const bts = await listAll<Stripe.BalanceTransaction>(after => listPayoutLinesPage(args.accountId, p.id, after));
    btsBy.set(p.id, bts.map(b => ({
      id: b.id, type: b.type, reportingCategory: b.reporting_category ?? null, net: b.net, created: b.created, ...sourceOf(b),
    })));
  });

  const index = await ourIndex(args.orgId, [...btsBy.values()].flat());
  const rows: PayoutRow[] = inRange
    .sort((a, b) => b.created - a.created)
    .map(p => {
      const lines = mapPayoutLines(btsBy.get(p.id) ?? [], index);
      return {
        id: p.id,
        sent: new Date(p.created * 1000).toISOString(),
        arrives: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString().slice(0, 10) : null,
        status: payoutStatus(p.status),
        failReason: payoutFailReason(p.failure_code),
        amount: p.amount / 100,
        contents: contents.get(p.id) ?? 'none',
        lines,
        counts: payoutCounts(lines),
      };
    });
  const dest = inRange[0]?.destination ?? payouts[0]?.destination;
  const last4 = dest && typeof dest !== 'string' && 'last4' in dest ? (dest as { last4: string }).last4 : null;
  const read: PayoutsRead = { from: args.from, to: args.to, testMode: !args.livemode, last4, payouts: rows };
  held.set(key, { at: Date.now(), read });
  if (held.size > 200) held.delete(held.keys().next().value as string);
  return read;
}

/** Whether the club has connected payouts at some time (the Payouts tab's condition, words §7 question 6), while online
 *  payments are offered at all. A failed read hides the tab rather than failing Accounting. */
export async function clubHasPayouts(orgId: string): Promise<boolean> {
  if (!onlinePaymentsOn()) return false;
  const { data, error } = await supabaseAdmin.from('org_payment_accounts').select('org_id').eq('org_id', orgId).maybeSingle();
  return !error && !!data;
}
