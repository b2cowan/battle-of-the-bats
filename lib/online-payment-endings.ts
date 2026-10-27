import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { closeClubPayPages, countClubPayPages } from './online-pay-pages';
import { effectiveOrgFactsForId } from './entitlement-grants';
import { hasPlanFeature } from './plan-features';
import { addCalendarDays, daysBetweenDateStrings, formatStoredDate, tournamentToday } from './timezone';
import type { OrgPlan } from './types';
import { PLAN_CONFIG } from './plan-config';
import { LEAVING_WORDS } from './online-payment-words';
import { OPEN_DISPUTE_STATUSES } from './online-payment-dispute';

/**
 * LEAVING ONLINE PAYMENTS (Club Tier Stage 12d-2 Part 3 — frame 4, words CLUB_TIER_STAGE12D_COPY.md §4; asks 4 and 11).
 *
 * The one rule (ask 4): stopping online payments never disconnects the club's Stripe account. Pay now stops being
 * offered; debits already clearing, refunds and disputes still finish; the owner is told what is outstanding; payouts
 * stay connected. Every ending — Disconnect, a downgrade on its date, a cancel, a deletion — closes the club's open pay
 * pages (ask 11) and its window counts them.
 *
 * This is the ONE count every ending window reads (Disconnect, the downgrade and cancel windows, the operator's plan
 * change and cancel, the deletion request) and the one list the operator's Delete refuses on (owner ruling 2,
 * 2026-10-27): money in flight is an open card dispute, a bank debit clearing, a Stripe fee not yet billed or whose
 * billing failed, and the club's own Stripe-fee invoice unpaid. A failed read throws — a window that says "nobody owes
 * anything" because a count failed would be a lie, and a Delete that cannot count must not go ahead.
 */

export interface PaymentsOutstanding {
  /** The club has (or had) a payments account at all. Nothing below is read without one. */
  connected: boolean;
  disconnected: boolean;
  /** House-league families with a child still owing in a season that isn't finished (a child on a clearing debit owes
   *  nothing new). The Disconnect window's correction: it used to count tournament teams only. */
  familiesOwing: number;
  /** Accepted teams still owing on a tournament that isn't over. */
  teamsOwing: number;
  openPages: number;
  debitsClearing: number;
  openDisputes: number;
  /** The soonest answer-by date of an open dispute (an instant), when Stripe gives one. */
  firstDisputeDue: string | null;
  /** Stripe fees not on any invoice yet (waiting for the next one), and those whose billing failed. */
  feesUnbilled: number;
  feesFailed: number;
  /** The club's own Stripe-fee invoices still unpaid. */
  invoicesUnpaid: number;
}

export const NOTHING_OUTSTANDING: PaymentsOutstanding = {
  connected: false, disconnected: false, familiesOwing: 0, teamsOwing: 0, openPages: 0, debitsClearing: 0,
  openDisputes: 0, firstDisputeDue: null, feesUnbilled: 0, feesFailed: 0, invoicesUnpaid: 0,
};

async function count(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

async function teamsOwing(orgId: string): Promise<number> {
  const { data: ts, error } = await supabaseAdmin.from('tournaments').select('id').eq('org_id', orgId).in('status', ['draft', 'active']);
  if (error) throw error;
  const ids = (ts ?? []).map(t => t.id as string);
  if (!ids.length) return 0;
  return count(supabaseAdmin.from('teams').select('id', { count: 'exact', head: true })
    .in('tournament_id', ids).eq('status', 'accepted').neq('payment_status', 'paid'));
}

/** Families, not children: one sign-up is one family (its reference, else its guardian's email). The registration's
 *  derived `registration_fee_paid` is false while the posted lines don't cover a price above $0 (mig 368). */
async function familiesOwing(orgId: string): Promise<number> {
  const { data: seasons, error } = await supabaseAdmin.from('league_seasons').select('id, registration_fee').eq('org_id', orgId).is('finished_at', null);
  if (error) throw error;
  if (!seasons?.length) return 0;
  const seasonFee = new Map(seasons.map(s => [s.id as string, Number(s.registration_fee ?? 0)]));
  const { data: regs, error: regError } = await supabaseAdmin.from('league_registrations')
    .select('id, season_id, fee_amount, signup_ref, guardian_email')
    .in('season_id', [...seasonFee.keys()]).eq('status', 'active').eq('registration_fee_paid', false);
  if (regError) throw regError;
  const owing = (regs ?? []).filter(r => Number(r.fee_amount ?? seasonFee.get(r.season_id as string) ?? 0) > 0);
  if (!owing.length) return 0;
  // A child whose fee is on a bank debit still clearing owes nothing new until it clears or comes back (12c).
  const { data: items, error: itemError } = await supabaseAdmin.from('online_payment_items')
    .select('registration_id, online_payments!inner(status)').in('registration_id', owing.map(r => r.id as string))
    .eq('online_payments.status', 'clearing');
  if (itemError) throw itemError;
  const clearing = new Set((items ?? []).map(i => i.registration_id as string));
  return new Set(owing.filter(r => !clearing.has(r.id as string))
    .map(r => (r.signup_ref as string | null) ?? (r.guardian_email as string | null)?.toLowerCase() ?? (r.id as string))).size;
}

/** What is still outstanding for the club's online payments. Throws on a failed read. */
export async function readOutstanding(orgId: string): Promise<PaymentsOutstanding> {
  const { data: acct, error } = await supabaseAdmin.from('org_payment_accounts').select('disconnected_at').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!acct) return NOTHING_OUTSTANDING;
  const [families, teams, pages, clearing, disputes, unbilled, failed, invoices] = await Promise.all([
    familiesOwing(orgId),
    teamsOwing(orgId),
    countClubPayPages(orgId),
    count(supabaseAdmin.from('online_payments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'clearing')),
    supabaseAdmin.from('online_payment_disputes').select('due_by').eq('org_id', orgId).in('status', [...OPEN_DISPUTE_STATUSES]),
    count(supabaseAdmin.from('platform_stripe_fees').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      .is('billed_at', null).is('exempt_reason', null).is('bill_error', null)),
    count(supabaseAdmin.from('platform_stripe_fees').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      .is('billed_at', null).is('exempt_reason', null).not('bill_error', 'is', null)),
    count(supabaseAdmin.from('platform_fee_invoices').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'open')),
  ]);
  if (disputes.error) throw disputes.error;
  const dues = (disputes.data ?? []).map(d => d.due_by as string | null).filter((d): d is string => !!d).sort();
  return {
    connected: true,
    disconnected: !!acct.disconnected_at,
    familiesOwing: families,
    teamsOwing: teams,
    openPages: pages,
    debitsClearing: clearing,
    openDisputes: (disputes.data ?? []).length,
    firstDisputeDue: dues[0] ?? null,
    feesUnbilled: unbilled,
    feesFailed: failed,
    invoicesUnpaid: invoices,
  };
}

/** What the operator's Delete waits for (owner ruling 2): money in flight, each named. Empty = nothing in flight. */
export type InFlight = 'disputes' | 'clearing' | 'fees_unbilled' | 'fees_failed' | 'invoices_unpaid';

export function moneyInFlight(o: PaymentsOutstanding): { kind: InFlight; n: number }[] {
  const out: { kind: InFlight; n: number }[] = [];
  if (o.openDisputes) out.push({ kind: 'disputes', n: o.openDisputes });
  if (o.debitsClearing) out.push({ kind: 'clearing', n: o.debitsClearing });
  if (o.feesUnbilled) out.push({ kind: 'fees_unbilled', n: o.feesUnbilled });
  if (o.feesFailed) out.push({ kind: 'fees_failed', n: o.feesFailed });
  if (o.invoicesUnpaid) out.push({ kind: 'invoices_unpaid', n: o.invoicesUnpaid });
  return out;
}

/** The operator's Delete refusal, naming what is in flight (console words, derived; owner ruling 2). */
export function inFlightRefusal(items: readonly { kind: InFlight; n: number }[]): string {
  const say: Record<InFlight, (n: number) => string> = {
    disputes: n => (n === 1 ? '1 card dispute is open' : `${n} card disputes are open`),
    clearing: n => (n === 1 ? '1 bank debit is still clearing' : `${n} bank debits are still clearing`),
    fees_unbilled: n => (n === 1 ? '1 Stripe fee isn’t billed yet' : `${n} Stripe fees aren’t billed yet`),
    fees_failed: n => (n === 1 ? '1 Stripe fee couldn’t be billed' : `${n} Stripe fees couldn’t be billed`),
    invoices_unpaid: n => (n === 1 ? '1 invoice for Stripe fees is unpaid' : `${n} invoices for Stripe fees are unpaid`),
  };
  const parts = items.map(i => say[i.kind](i.n));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `This club’s online payments still have money in flight: ${list}. Wait for them to finish, then delete. Its Online payments tab shows each.`;
}

/**
 * An ending reached by the plan (a downgrade on its date, an operator's move, a comp or free time running out, a cancel
 * or a suspension): when the club can no longer take payments online, its open pay pages close (ask 11). New pages are
 * already refused by the pay side's plan gate; this closes the ones already open. The account stays connected (ask 4).
 * `ended` forces it (a cancel or a suspension stops online payments whatever the plan says). Never throws.
 */
export async function closePagesIfPaymentsEnded(orgId: string, where: string, opts: { ended?: boolean } = {}): Promise<number> {
  try {
    if (!opts.ended) {
      const facts = await effectiveOrgFactsForId(orgId);
      if (!facts || (hasPlanFeature(facts.planId, 'online_payments') && facts.subscriptionStatus !== 'canceled')) return 0;
    }
    return await closeClubPayPages(orgId, where);
  } catch (e) {
    console.error(`[online-payment-endings] couldn’t close the open pay pages at ${where}:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}

/** What an ending window shows about online payments (words §4.2–§4.4): null when the club has no connected account,
 *  or when the plan it moves to still offers online payments. `counted` is false when the count failed: the window
 *  then says the rule without numbers, never "nobody owes". */
export type EndingSection = { counted: boolean; outstanding: PaymentsOutstanding };

export async function endingSection(orgId: string, opts: { targetPlan?: string; includeDisconnected?: boolean } = {}): Promise<EndingSection | null> {
  if (opts.targetPlan && hasPlanFeature(opts.targetPlan as Parameters<typeof hasPlanFeature>[0], 'online_payments')) return null;
  const { data, error } = await supabaseAdmin.from('org_payment_accounts').select('disconnected_at').eq('org_id', orgId).maybeSingle();
  // The deletion window shows for a club that connected at any time (words §4.4): a dispute can be open after a Disconnect.
  if (error || !data || (data.disconnected_at && !opts.includeDisconnected)) return null;
  try {
    return { counted: true, outstanding: await readOutstanding(orgId) };
  } catch (e) {
    console.error('[online-payment-endings] couldn’t count for an ending window:', e instanceof Error ? e.message : String(e));
    return { counted: false, outstanding: { ...NOTHING_OUTSTANDING, connected: true } };
  }
}

/**
 * An ending the owner did NOT choose (words §4.2 `ending.*`; owner 2026-10-27): free time running out onto a plan
 * without online payments, warned seven days before its first day off; or a subscription payment that failed, warned
 * the day it failed (that suspension has no known date). `at` is the instant it is about (mig 401 `ending_warned_for`).
 * ⚠ The Founding comp is not read here: its turn-off is not built (its plan is stored, not granted), so warning a date
 * the product doesn't act on would be false. Null when nothing is coming.
 */
export type UpcomingEnding =
  | { kind: 'comp'; at: string; firstDayOff: string; targetPlan: OrgPlan }
  | { kind: 'failed'; at: string };

export const ENDING_WARN_DAYS = 7;

/** The ending's notice words (words §4.2 `ending.notice.*`): the card's notice, the owner's item and the email share them. */
export function endingNotice(e: UpcomingEnding, clubName: string, o: PaymentsOutstanding | null): { title: string; body: string } {
  const owe = o ? LEAVING_WORDS.oweToday(o.familiesOwing, o.teamsOwing) : '';
  if (e.kind === 'failed') return { title: LEAVING_WORDS.ending.failedTitle, body: LEAVING_WORDS.ending.body(LEAVING_WORDS.ending.failedSentence(clubName), owe) };
  const dateLong = formatStoredDate(e.firstDayOff, { longMonth: true });
  return {
    title: LEAVING_WORDS.ending.title(dateLong),
    body: LEAVING_WORDS.ending.body(LEAVING_WORDS.ending.compSentence(PLAN_CONFIG[e.targetPlan]?.label ?? e.targetPlan, dateLong), owe),
  };
}

export async function upcomingEnding(orgId: string, now: Date = new Date()): Promise<UpcomingEnding | null> {
  const facts = await effectiveOrgFactsForId(orgId);
  if (!facts) return null;
  if (facts.subscriptionStatus === 'past_due' && hasPlanFeature(facts.planId, 'online_payments')) {
    const { data } = await supabaseAdmin.from('platform_events').select('created_at').eq('org_id', orgId)
      .eq('event_type', 'subscription_past_due').order('created_at', { ascending: false }).limit(1).maybeSingle();
    return { kind: 'failed', at: (data?.created_at as string | undefined) ?? now.toISOString() };
  }
  const ft = facts.freeTime;
  if (ft && hasPlanFeature(ft.plan, 'online_payments') && !hasPlanFeature(facts.ownPlanId, 'online_payments')) {
    const firstDayOff = addCalendarDays(ft.lastDay, 1);
    const days = daysBetweenDateStrings(tournamentToday(now), firstDayOff);
    if (days >= 0 && days <= ENDING_WARN_DAYS) return { kind: 'comp', at: `${firstDayOff}T00:00:00.000Z`, firstDayOff, targetPlan: facts.ownPlanId };
  }
  return null;
}
