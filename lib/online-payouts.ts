import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { listPayoutLinesPage, listPayoutsPage } from './stripe-connect';
import { SCOPE_WORDS } from './online-payment-words';
import { onlinePaymentsOn } from './online-payments-switch';
import { toCents } from './coach-register';
import { fetchAllIn } from './supabase-paging';
import {
  childrenWho, mapPayoutLines, payoutContents, payoutCounts, payoutFailReason, payoutStatus,
  type BtIn, type DisputeFacts, type OurIndex, type OurPayment, type PayoutEntryIndex, type PayoutContents, type PayoutFailReason, type PayoutLine, type PayoutStatus,
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
  /** The bank account THIS payout went to (a club can change its account inside the chosen dates; /review). */
  last4: string | null;
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
const MAX_PAGES = 20;
const CONCURRENT = 4;
/** How many ids one `.in()` filter carries: a long list overruns the request. */
const ID_CHUNK = 100;
/** A payout on its way arrives after today: the read looks this far past the chosen end for one (/review). */
const ON_ITS_WAY_DAYS = 21;
const held = new Map<string, { at: number; read: PayoutsRead }>();
/** A read in flight, shared by a second screen asking the same thing (the card's summary and its list; /review). */
const inFlight = new Map<string, Promise<PayoutsRead>>();

/** Rows of one table whose column is in `ids`, read 100 ids at a time; a failed read throws (never a silent "not ours"). */
async function rowsWhereIn<T>(ids: readonly string[], read: (chunk: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await read(ids.slice(i, i + ID_CHUNK));
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

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

type PaymentRowForEntries = { id: string; flow: 'tournament_team' | 'league_signup'; rail: 'card' | 'bank_debit'; status: string; processing_cost_entry_id: string | null };

/**
 * The bank check's extra read (Bank reconciliation R2a): the club-book lines behind our payments, refunds and disputes
 * (`PayoutEntryIndex` in lib/online-payouts-map.ts says where each lives). Only `readPayouts({ withEntries: true })`
 * asks, so the Payouts tab reads exactly what it read before.
 */
async function entryIndex(orgId: string, payments: readonly PaymentRowForEntries[], refundIds: readonly string[], disputeIds: readonly string[]): Promise<PayoutEntryIndex> {
  const teamIds = payments.filter(p => p.flow === 'tournament_team').map(p => p.id);
  const leagueIds = payments.filter(p => p.flow === 'league_signup').map(p => p.id);
  const reversed = payments.filter(p => p.status === 'reversed' && p.rail === 'bank_debit');
  const reversedTeams = reversed.filter(p => p.flow === 'tournament_team').map(p => p.id);
  const reversedLeagueIds = new Set(reversed.filter(p => p.flow === 'league_signup').map(p => p.id));
  // Paged (`fetchAllIn`): one league payment carries many children, and a plain `.in()` read stops silently at 1,000 rows.
  const [teamRows, itemRows, refundRows, disputeRows, teamReturned] = await Promise.all([
    fetchAllIn<{ online_payment_id: string; entry_id: string | null }>(teamIds, (c, a, b) =>
      supabaseAdmin.from('tournament_team_payments').select('online_payment_id, entry_id').in('online_payment_id', c).order('id').range(a, b)),
    fetchAllIn<{ online_payment_id: string; entry_id: string | null; registration_id: string | null }>(leagueIds, (c, a, b) =>
      supabaseAdmin.from('online_payment_items').select('online_payment_id, entry_id, registration_id').in('online_payment_id', c).order('id').range(a, b)),
    fetchAllIn<{ stripe_refund_id: string; refund_entry_id: string | null; processing_cost_entry_id: string | null }>(refundIds, (c, a, b) =>
      supabaseAdmin.from('online_payment_refunds').select('stripe_refund_id, refund_entry_id, processing_cost_entry_id').eq('org_id', orgId).in('stripe_refund_id', c).order('stripe_refund_id').range(a, b)),
    fetchAllIn<{ stripe_dispute_id: string; amount: number | string; stripe_fee: number | string | null;
      taken_back: { entryId?: string | null; children?: { entryId?: string | null }[] } | null;
      won_back: { back?: { entryId?: string | null }[] } | null }>(disputeIds, (c, a, b) =>
      supabaseAdmin.from('online_payment_disputes').select('stripe_dispute_id, amount, stripe_fee, taken_back, won_back').eq('org_id', orgId).in('stripe_dispute_id', c).order('stripe_dispute_id').range(a, b)),
    // A team's debit reversed after it landed: its "Returned by the bank · …" line (the writer does not keep the id). The
    // text is fixed inside the database function that books it (migrations 387/388), not in app wording; scripts/online-payments-12c-check.sql matches it the same way.
    fetchAllIn<{ id: string; source_entity_id: string }>(reversedTeams, (c, a, b) =>
      supabaseAdmin.from('accounting_entries').select('id, source_entity_id').eq('source_module', 'online_payment')
        .like('description', 'Returned by the bank · %').in('source_entity_id', c).order('id').range(a, b)),
  ]);
  // A child's debit reversed after it landed: the child's `registration_returned` line (keyed by the registration).
  // The line is keyed by the registration alone, so it is tied to a payment only when exactly one REVERSED payment carried
  // that registration; a child paid twice and returned twice is ambiguous and is left unmatched (the gap shows, no wrong member).
  const reversedOf = new Map<string, Set<string>>();
  for (const i of itemRows) {
    if (!i.registration_id || !i.entry_id || !reversedLeagueIds.has(i.online_payment_id)) continue;
    const set = reversedOf.get(i.registration_id) ?? new Set<string>();
    set.add(i.online_payment_id);
    reversedOf.set(i.registration_id, set);
  }
  const regOf = new Map([...reversedOf].filter(([, ops]) => ops.size === 1).map(([reg, ops]) => [reg, [...ops][0]] as const));
  const regIds = [...regOf.keys()];
  const leagueReturned = await fetchAllIn<{ id: string; source_entity_id: string }>(regIds, (c, a, b) =>
    supabaseAdmin.from('accounting_entries').select('id, source_entity_id').eq('source_module', 'league_registration')
      .eq('category', 'registration_returned').in('source_entity_id', c).order('id').range(a, b));

  const push = (m: Record<string, string[]>, k: string, v: string | null | undefined) => { if (v) (m[k] ??= []).push(v); };
  const pay: Record<string, string[]> = {};
  for (const r of teamRows) push(pay, r.online_payment_id, r.entry_id);
  for (const r of itemRows) push(pay, r.online_payment_id, r.entry_id);
  for (const p of payments) push(pay, p.id, p.processing_cost_entry_id);
  const refunds: Record<string, string[]> = {};
  for (const r of refundRows) { push(refunds, r.stripe_refund_id, r.refund_entry_id); push(refunds, r.stripe_refund_id, r.processing_cost_entry_id); }
  const reversals: Record<string, string[]> = {};
  for (const e of teamReturned) push(reversals, e.source_entity_id, e.id);
  for (const e of leagueReturned) { const op = regOf.get(e.source_entity_id); if (op) push(reversals, op, e.id); }
  const disputes: Record<string, DisputeFacts> = {};
  for (const d of disputeRows) {
    const lost = [d.taken_back?.entryId, ...(d.taken_back?.children ?? []).map(c => c.entryId)].filter((x): x is string => !!x);
    const won = (d.won_back?.back ?? []).map(b => b.entryId).filter((x): x is string => !!x);
    disputes[d.stripe_dispute_id] = { amountCents: toCents(d.amount), feeCents: toCents(d.stripe_fee), lostEntryIds: lost, wonEntryIds: won };
  }
  return { payments: pay, refunds, reversals, disputes };
}

/** Our rows behind every source a payout names, already named (who, what) for the screen. */
async function ourIndex(orgId: string, bts: readonly BtIn[], withEntries = false): Promise<OurIndex> {
  const ids = new Set<string>();
  for (const b of bts) { if (b.sourceId) ids.add(b.sourceId); if (b.sourceCharge) ids.add(b.sourceCharge); }
  const all = [...ids];
  const charges = all.filter(i => i.startsWith('ch_') || i.startsWith('py_'));
  const refundIds = all.filter(i => i.startsWith('re_') || i.startsWith('pyr_'));
  const disputeIds = all.filter(i => i.startsWith('du_') || i.startsWith('dp_'));
  if (!all.length) {
    const none = { payments: [], refunds: {}, disputes: {} };
    return withEntries ? { ...none, entries: { payments: {}, refunds: {}, reversals: {}, disputes: {} } } : none;
  }

  const [refunds, disputes] = await Promise.all([
    rowsWhereIn<{ stripe_refund_id: string; online_payment_id: string }>(refundIds, c =>
      supabaseAdmin.from('online_payment_refunds').select('stripe_refund_id, online_payment_id').eq('org_id', orgId).in('stripe_refund_id', c)),
    rowsWhereIn<{ stripe_dispute_id: string; online_payment_id: string }>(disputeIds, c =>
      supabaseAdmin.from('online_payment_disputes').select('stripe_dispute_id, online_payment_id').eq('org_id', orgId).in('stripe_dispute_id', c)),
  ]);
  const refundMap: Record<string, string> = {};
  for (const r of refunds) refundMap[r.stripe_refund_id] = r.online_payment_id;
  const disputeMap: Record<string, string> = {};
  for (const d of disputes) disputeMap[d.stripe_dispute_id] = d.online_payment_id;

  const byIdWanted = [...new Set([...Object.values(refundMap), ...Object.values(disputeMap)])];
  const cols = 'id, flow, rail, scope, receipt_no, stripe_charge_id, stripe_payment_intent_id, stripe_dispute_id, tournament_id, team_id, description, status, processing_cost_entry_id';
  type Row = {
    id: string; flow: 'tournament_team' | 'league_signup'; rail: 'card' | 'bank_debit'; scope: 'deposit' | 'balance' | 'full' | null;
    receipt_no: number | null; stripe_charge_id: string | null; stripe_payment_intent_id: string | null; stripe_dispute_id: string | null;
    tournament_id: string | null; team_id: string | null; description: string; status: string; processing_cost_entry_id: string | null;
  };
  const rows = new Map<string, Row>();
  const reads = await Promise.all([
    rowsWhereIn<Row>(charges, c => supabaseAdmin.from('online_payments').select(cols).eq('org_id', orgId).in('stripe_charge_id', c)),
    rowsWhereIn<Row>(disputeIds, c => supabaseAdmin.from('online_payments').select(cols).eq('org_id', orgId).in('stripe_dispute_id', c)),
    rowsWhereIn<Row>(byIdWanted, c => supabaseAdmin.from('online_payments').select(cols).eq('org_id', orgId).in('id', c)),
  ]);
  for (const r of reads.flat()) rows.set(r.id, r);
  const list = [...rows.values()];

  const teamIds = [...new Set(list.map(r => r.team_id).filter((x): x is string => !!x))];
  const tourIds = [...new Set(list.map(r => r.tournament_id).filter((x): x is string => !!x))];
  const leagueIds = list.filter(r => r.flow === 'league_signup').map(r => r.id);
  const [teams, tours, itemRows] = await Promise.all([
    rowsWhereIn<{ id: string; name: string }>(teamIds, c => supabaseAdmin.from('teams').select('id, name').in('id', c)),
    rowsWhereIn<{ id: string; name: string }>(tourIds, c => supabaseAdmin.from('tournaments').select('id, name').in('id', c)),
    rowsWhereIn<{ online_payment_id: string; registration_id: string | null; description: string }>(leagueIds, c =>
      supabaseAdmin.from('online_payment_items').select('online_payment_id, registration_id, description').in('online_payment_id', c)),
  ]);
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  const tourName = new Map(tours.map(t => [t.id, t.name]));
  const regIds = [...new Set(itemRows.map(i => i.registration_id).filter((x): x is string => !!x))];
  const regs = await rowsWhereIn<{ id: string; player_first_name: string | null; player_last_name: string | null }>(regIds, c =>
    supabaseAdmin.from('league_registrations').select('id, player_first_name, player_last_name').in('id', c));
  const regName = new Map(regs.map(r => [r.id, { first: r.player_first_name ?? '', last: r.player_last_name ?? '' }]));

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
  const entries = withEntries ? await entryIndex(orgId, list, refundIds, disputeIds) : undefined;
  return { payments, refunds: refundMap, disputes: disputeMap, ...(entries ? { entries } : {}) };
}

/** Read a club's payouts that arrive between two club days (inclusive). Throws when Stripe doesn't answer. `withEntries`
 *  (the bank check, R2a) also names the club-book lines behind each payout line (`PayoutLine.entryIds`); that read holds
 *  only Stripe's half for a few minutes and reads OUR side fresh every time, since a book line can change within them. */
export interface ReadPayoutsArgs { orgId: string; accountId: string; livemode: boolean; from: string; to: string; withEntries?: boolean }

export async function readPayouts(args: ReadPayoutsArgs): Promise<PayoutsRead> {
  if (args.withEntries) return readWithEntries(args);
  const key = `${args.accountId}:${args.from}:${args.to}`;
  const now = Date.now();
  for (const [k, v] of held) if (now - v.at >= HOLD_MS) held.delete(k);
  const hit = held.get(key);
  if (hit) return hit.read;
  const running = inFlight.get(key);
  if (running) return running;
  const read = readFromStripe(args).finally(() => inFlight.delete(key));
  inFlight.set(key, read);
  const done = await read;
  held.set(key, { at: Date.now(), read: done });
  if (held.size > 200) held.delete(held.keys().next().value as string);
  return done;
}

/** What Stripe said, before our side is joined to it. */
interface StripeHalf {
  payouts: Stripe.Payout[]; inRange: Stripe.Payout[]; contents: Map<string, PayoutContents>; btsBy: Map<string, BtIn[]>;
}
const heldHalf = new Map<string, { at: number; half: StripeHalf }>();
const halfInFlight = new Map<string, Promise<StripeHalf>>();

/** The bank check's read: Stripe's half shared and held like the Payouts tab's, our book lines read fresh. */
async function readWithEntries(args: ReadPayoutsArgs): Promise<PayoutsRead> {
  const key = `${args.accountId}:${args.from}:${args.to}`;
  const now = Date.now();
  for (const [k, v] of heldHalf) if (now - v.at >= HOLD_MS) heldHalf.delete(k);
  let half = heldHalf.get(key)?.half;
  if (!half) {
    const running = halfInFlight.get(key) ?? readStripeHalf(args).finally(() => halfInFlight.delete(key));
    halfInFlight.set(key, running);
    half = await running;
    heldHalf.set(key, { at: Date.now(), half });
    if (heldHalf.size > 200) heldHalf.delete(heldHalf.keys().next().value as string);
  }
  return shapePayouts(args, half, await ourIndex(args.orgId, [...half.btsBy.values()].flat(), true));
}

async function readFromStripe(args: ReadPayoutsArgs): Promise<PayoutsRead> {
  const half = await readStripeHalf(args);
  return shapePayouts(args, half, await ourIndex(args.orgId, [...half.btsBy.values()].flat(), false));
}

async function readStripeHalf(args: ReadPayoutsArgs): Promise<StripeHalf> {
  // Arrival is what a bank statement shows: filtered by it, and trimmed to the chosen days below — except a payout still
  // on its way, which arrives after today and is the card's "is money coming?" (/review): kept whenever it was sent.
  const ahead = dayStart(args.to) + ON_ITS_WAY_DAYS * 86_400;
  const payouts = await listAll<Stripe.Payout>(after => listPayoutsPage(args.accountId, { gte: dayStart(args.from), lte: ahead }, after));
  const inRange = payouts.filter(p => {
    const day = new Date(p.arrival_date * 1000).toISOString().slice(0, 10);
    const onItsWay = p.status === 'pending' || p.status === 'in_transit';
    return day >= args.from && (day <= args.to || onItsWay);
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

  return { payouts, inRange, contents, btsBy };
}

function shapePayouts(args: ReadPayoutsArgs, half: StripeHalf, index: OurIndex): PayoutsRead {
  const { payouts, inRange, contents, btsBy } = half;
  const rows: PayoutRow[] = [...inRange]
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
        last4: last4Of(p.destination),
      };
    });
  return { from: args.from, to: args.to, testMode: !args.livemode, last4: rows[0]?.last4 ?? last4Of(payouts[0]?.destination), payouts: rows };
}

function last4Of(dest: Stripe.Payout['destination'] | undefined): string | null {
  return dest && typeof dest !== 'string' && 'last4' in dest ? (dest as { last4: string }).last4 : null;
}

/** Whether the club has connected payouts at some time (the Payouts tab's condition, words §7 question 6), while online
 *  payments are offered at all. A failed read hides the tab rather than failing Accounting. */
export async function clubHasPayouts(orgId: string): Promise<boolean> {
  if (!onlinePaymentsOn()) return false;
  const { data, error } = await supabaseAdmin.from('org_payment_accounts').select('org_id').eq('org_id', orgId).maybeSingle();
  return !error && !!data;
}
