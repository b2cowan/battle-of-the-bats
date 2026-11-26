import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { hasRecentNotification } from './db';
import { notify } from './notify';
import { clearSettled } from './needs-attention';
import { getOrganizationBySlugForServer } from './server-organizations';
import { canConnectPayouts, canRefundLeagueOnline, canRefundOnline, isPayoutsTreasurer } from './online-payment-access';
import { factsFromStripe, factsFromRow, payoutsPath, payoutsState, pausedForRefundPolicy, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow } from './online-payment-account';
import { listDisputes, listRefunds, listStripeFeeLines, requestBankDebit, retrieveAccount, retrieveChargeWithFee, retrieveCheckout, retrieveDispute, retrievePaymentIntentMetadata, retrieveRefund, refundToCard } from './stripe-connect';
import { chargeBalanceTransaction, disputeFeeCents, standaloneFeeOf, stripeFeeCents } from './online-payment-stripe-fees';
import { disputeFromStripe, isDisputeOpen, isInquiry, refundBlockedByDispute } from './online-payment-dispute';
import { disputeOpenedEmailHtml, disputeReminderEmailHtml } from './online-dispute-email';
import { sendEmail } from './email';
import { sendOnlineReceiptOnce, sendRefundEmail } from './online-payment-receipt';
import { claimRefundEmail, sendLeagueRefundEmail } from './online-refund-email';
import { childList } from './league-pay-words';
import { pinLeagueRefund, pinTeamRefund } from './online-refund-pinning';
import { bankReturnReason } from './bank-debit';
import { sendDebitReturnedEmail, sendDebitReversedEmail, sendDebitStartedEmail } from './bank-debit-email';
import { isUuid, possessive } from './utils';
import { idOf } from './charge-tax-record';
import {
  DEBIT_NOTICE_WORDS as DW, DISPUTE_WORDS, LEAGUE_ONLINE_NOTICE_WORDS as LW, OVER_WORDS as OW, cardLabel, disputeDue, leagueUnrecordedWhy,
  ONLINE_NOTICE_WORDS as W, SPONSOR_DISPUTE_WORDS, money as formatMoney, notRecordedNotice, refundFailedNotice, sponsorRefundFailedNotice,
} from './online-payment-words';
import type { NoticeFacts } from './notification-facts';
import { formatStoredDate } from './timezone';
import type { Organization, OrgRole } from './types';
import { opensSponsorships } from './club-sponsorships-place';
import { GROUP_UNSCOPED_ROLES } from './member-access';
import { syncDealPlace } from './club-sponsorship-deals-server';
import { emailDealInvoice, emailDealRefund, emailDealRefundCancelled } from './sponsor-invoice-email';
import { DEAL_WORDS } from './club-sponsorship-deal-words';

/**
 * THE LANDING (Club Tier Stage 12a). The one module through which an online payment reaches a team's record and a
 * refund reaches the card — `tests/unit/online-payments-guard.test.ts` holds that nothing else calls the mig 358
 * functions. Every write that moves money is a database function (mig 358) that calls the tournament's own writer, so a
 * card payment behaves exactly as a hand-recorded one.
 *
 * Called by the Connect webhook (the source of truth: "Paid" is never shown on the redirect alone), by the receipt page
 * when it re-reads a session the webhook has not landed yet, and by the refund route.
 */

/** The three things a card payment can be for (mig 530 `online_payments_flow_chk`). */
type OnlineFlow = 'tournament_team' | 'league_signup' | 'sponsorship';

type MemberRow = { user_id: string; role: OrgRole; capabilities: Record<string, boolean> | null };

async function orgById(orgId: string): Promise<Organization | null> {
  const { data } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).maybeSingle();
  return data?.slug ? getOrganizationBySlugForServer(data.slug as string) : null;
}

async function activeMembers(orgId: string): Promise<MemberRow[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, capabilities')
    .eq('organization_id', orgId) // ⚠ organization_id: this table predates the org_id convention
    .eq('status', 'active');
  if (error) throw error;
  return ((data ?? []) as MemberRow[]).filter(m => m.user_id);
}

/** The owner and the treasurer (A1) — who hears that Stripe needs something. */
async function payoutsPeople(org: Organization): Promise<string[]> {
  const members = await activeMembers(org.id);
  return [...new Set(members.filter(m => canConnectPayouts(m) || isPayoutsTreasurer(m, org)).map(m => m.user_id))];
}

/** Whoever may refund (A13: whoever runs tournaments; the treasurer does not refund) — who hears that a payment or a
 *  refund needs a hand. */
async function refundPeople(org: Organization): Promise<string[]> {
  const members = await activeMembers(org.id);
  return [...new Set(members.filter(m => canRefundOnline(m, org)).map(m => m.user_id))];
}

/**
 * Raise a Needs-attention item once per person: an uncleared one of the same kind and subject is never doubled. The
 * database holds that (mig 366: one open copy per person and subject) and `notify()` reads its refusal as "already
 * waiting", so this does not read the notifications table itself — a second reader would skip the bell rule.
 */
async function raiseOnce(p: {
  org: Organization; userIds: string[];
  eventType: 'payouts_need_attention' | 'online_payment_not_recorded' | 'card_refund_failed'
    | 'card_refund_whose' | 'card_refund_still_enrolled' | 'card_refund_unmatched' | 'debit_returned' | 'debit_reversed'
    | 'online_payment_over' | 'card_disputed' | 'card_dispute_lost' | 'sponsor_refund_to_finish' | 'sponsor_refund_twice';
  subjectKey: string; subjectId: string; title: string; body: string; link: string;
  /** The rows the opened notice draws; with them `body` is the one line (Notifications read at a glance, Stage 2). */
  facts?: NoticeFacts;
  /** More facts the notice's resolver reads (never part of its one-open-copy key, mig 366/374). */
  extra?: Record<string, string>;
}): Promise<void> {
  if (!p.userIds.length) return;
  await notify({
    orgId: p.org.id, userIds: p.userIds, eventType: p.eventType, title: p.title, body: p.body, link: p.link,
    // ⚠ No plan guard (12d-2, ask 4): a club wound down by a downgrade keeps its account connected, and its debits,
    // refunds and disputes still finish — their items must keep arriving. Only events on the club's own account raise
    // these, so a club that never connected never gets one.
    // `facts` is never a one-open-copy key (mig 403's COALESCE names only subject ids).
    metadata: { ...p.extra, ...(p.facts ? { facts: p.facts } : {}), [p.subjectKey]: p.subjectId },
  });
}

// ── The account ─────────────────────────────────────────────────────────────────────────────────

/**
 * Re-read a club's account from Stripe (never trusting an event: v2 account events are thin, and events arrive out of
 * order) and store the facts. Stamps Stripe's sign-up as finished the first time it is seen finished — set once and kept,
 * so a later demand from Stripe reads "needs attention", never "setting up" again — and takes a closed account as a
 * Disconnect (A1). Raises "Stripe needs something" when the card turns to needs attention, and lets it clear itself
 * otherwise.
 */
export async function syncPayoutsAccount(stripeAccountId: string): Promise<PayoutsAccountRow | null> {
  const acct = await retrieveAccount(stripeAccountId);
  const { columns, onboardingFinished, closed, bankDebitToRequest } = factsFromStripe(acct);
  // 12c: an account taking card payments that never asked for bank debit asks now; Stripe's next account event re-syncs.
  if (bankDebitToRequest) await requestBankDebit(stripeAccountId).catch(e => console.error('[online-payment-landing] bank debit request failed:', e instanceof Error ? e.message : String(e)));
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('org_payment_accounts')
    .update({ ...columns, stripe_synced_at: now, updated_at: now })
    .eq('stripe_account_id', stripeAccountId)
    .select(PAYOUTS_ACCOUNT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  let row = data as PayoutsAccountRow | null;
  if (!row) return null; // an account we do not hold (deleted club, another platform's test): acknowledged, ignored
  for (const [column, due] of [['onboarding_finished_at', onboardingFinished], ['disconnected_at', closed]] as const) {
    if (!due || row[column]) continue;
    const { data: stamped, error: stampError } = await supabaseAdmin
      .from('org_payment_accounts')
      .update({ [column]: now })
      .eq('stripe_account_id', stripeAccountId)
      .is(column, null)
      .select(PAYOUTS_ACCOUNT_COLUMNS)
      .maybeSingle();
    if (stampError) throw stampError;
    if (stamped) row = stamped as PayoutsAccountRow;
  }
  const org = await orgById(row.org_id);
  if (org && payoutsState(factsFromRow(row)) === 'needs_attention') {
    const deadline = row.requirements_deadline ? W.byDeadline(row.requirements_deadline) : '';
    // A League or Club's families pay online too (copy §20); Tournament Plus names teams.
    const teamsOnly = org.planId === 'tournament' || org.planId === 'tournament_plus';
    // Paused for the refund policy alone (owner 2026-11-17: required): the same item, its own reason. It settles itself when
    // the policy is saved (the payouts PATCH asks), as Stripe's does when Stripe is satisfied.
    const forPolicy = pausedForRefundPolicy(factsFromRow(row));
    await raiseOnce({
      org, userIds: await payoutsPeople(org), eventType: 'payouts_need_attention',
      subjectKey: 'stripeAccountId', subjectId: stripeAccountId,
      title: forPolicy ? W.policyNeedsTitle : W.stripeNeedsTitle,
      body: forPolicy ? (teamsOnly ? W.policyNeedsBody : W.policyNeedsBodyFamilies)
        : row.card_payments_status === 'active'
        ? W.stripeNeedsBodyStillOn(deadline)
        : teamsOnly ? W.stripeNeedsBodyPaused : W.stripeNeedsBodyPausedFamilies,
      link: payoutsHref(org),
    });
  }
  await clearSettled({ orgIds: [row.org_id], kinds: ['payouts_need_attention'] });
  return row;
}

/**
 * Who paid, on the ledger line (owner 2026-11-18). A landed card or bank payment's line is named for the child or the
 * team; this puts the PAYER beside it in the line's own payer slot — a family's guardian, a team's coach (the same two
 * names the dispute file already calls "the payer"). Never overwrites a name a person typed, never blocks a landing
 * (a line in a closed fiscal year refuses the write; the ledger just reads without a name), and safe to repeat — every
 * replay of a landing runs it, which also names the payments that landed before this existed.
 */
async function stampPayerOnLines(opId: string): Promise<void> {
  try {
    const { data: op } = await supabaseAdmin.from('online_payments').select('flow, team_id').eq('id', opId).maybeSingle();
    if (!op) return;
    const named: Array<{ entryId: string; payer: string }> = [];
    if (op.flow === 'tournament_team') {
      if (!op.team_id) return;
      const [{ data: team }, { data: pays }] = await Promise.all([
        supabaseAdmin.from('teams').select('coach').eq('id', op.team_id).maybeSingle(),
        supabaseAdmin.from('tournament_team_payments').select('entry_id').eq('online_payment_id', opId).not('entry_id', 'is', null),
      ]);
      const payer = typeof team?.coach === 'string' ? team.coach.trim() : '';
      if (payer) for (const p of pays ?? []) named.push({ entryId: p.entry_id as string, payer });
    } else {
      const { data: items } = await supabaseAdmin.from('online_payment_items').select('registration_id, entry_id')
        .eq('online_payment_id', opId).not('entry_id', 'is', null).not('registration_id', 'is', null);
      const regIds = [...new Set((items ?? []).map(i => i.registration_id as string))];
      if (!regIds.length) return;
      const { data: regs } = await supabaseAdmin.from('league_registrations')
        .select('id, guardian_first_name, guardian_last_name').in('id', regIds);
      const guardian = new Map((regs ?? []).map(r => [r.id as string,
        [r.guardian_first_name, r.guardian_last_name].filter(Boolean).join(' ').trim()]));
      for (const i of items ?? []) {
        const payer = guardian.get(i.registration_id as string);
        if (payer) named.push({ entryId: i.entry_id as string, payer });
      }
    }
    for (const n of named) {
      const { error } = await supabaseAdmin.from('accounting_entries').update({ payee_payer: n.payer.slice(0, 200) })
        .eq('id', n.entryId).is('payee_id', null).is('payee_payer', null);
      if (error) console.error('[online-payment-landing] couldn’t name the payer on a ledger line:', n.entryId, error.message);
    }
  } catch (e) {
    console.error('[online-payment-landing] couldn’t name the payer on a ledger line:', opId, e instanceof Error ? e.message : e);
  }
}

/** Where the Payouts card lives (A8) — `payoutsPath`, the one home of the path. */
export function payoutsHref(org: Pick<Organization, 'slug' | 'planId'>): string {
  return payoutsPath(org);
}

// ── A payment ───────────────────────────────────────────────────────────────────────────────────

type OnlineRow = {
  id: string; org_id: string; flow: OnlineFlow; team_id: string | null; tournament_id: string | null;
  season_id: string | null; status: string; landed_at: string | null;
  stripe_account_id: string; stripe_checkout_session_id: string | null; description: string; total_amount: number;
  /** 'card' | 'bank_debit' — present on the landing's own read; the notices word the refund for it. */
  rail?: string | null;
};

/** Where a payment's record lives: the team's tournament, or the season's Registrations (house league, 12b). A child's
 *  notice opens that child's record (12c F5: `reg`, at its Fee section, or at its "To the card" block). */
function recordHref(org: Organization, op: Pick<OnlineRow, 'tournament_id' | 'season_id'>, child?: { regId: string | null; at?: 'fee' | 'card' }): string {
  if (op.tournament_id) return `/${org.slug}/admin/tournaments/registrations?tournamentId=${op.tournament_id}`;
  if (op.season_id) {
    const base = `/${org.slug}/admin/house-league/seasons/${op.season_id}/registrations`;
    return child?.regId ? `${base}?reg=${child.regId}&at=${child.at ?? 'fee'}` : base;
  }
  return `/${org.slug}/admin`;
}

/** Whoever may refund a house-league payment (A13's house-league variant: the desk; the treasurer does not refund). */
async function leagueRefundPeople(org: Organization): Promise<string[]> {
  const members = await activeMembers(org.id);
  return [...new Set(members.filter(m => canRefundLeagueOnline(m, org)).map(m => m.user_id))];
}

type LeagueUnrecorded = { id: string; registration_id: string | null; land_error: string; amount: number; description: string };

/**
 * One notice per child whose share couldn't land (12b §0e a): the payment stays PAID, the refund is the way out. Read
 * from the DATABASE, not from one landing's answer, and called on every landing including a replay (review 2026-10-25):
 * a process that died between the landing's commit and its notices would otherwise leave a child unrecorded with no
 * notice for good, since every redelivery answers `already`. Only a share still waiting is raised (no line, not refunded
 * in full) — the resolver's own condition — so a settled notice is never reopened, and an open one is never doubled
 * (mig 374's one-open-copy index).
 */
async function raiseLeagueUnrecorded(op: OnlineRow): Promise<void> {
  const [{ data: items }, { data: pay }] = await Promise.all([
    supabaseAdmin.from('online_payment_items').select('id, registration_id, land_error, amount, description')
      .eq('online_payment_id', op.id).is('entry_id', null).not('land_error', 'is', null),
    supabaseAdmin.from('online_payments').select('paid_on').eq('id', op.id).maybeSingle(),
  ]);
  let unrecorded = (items ?? []) as LeagueUnrecorded[];
  if (!unrecorded.length) return;
  const { data: refunds } = await supabaseAdmin.from('online_payment_refunds')
    .select('online_payment_item_id, amount, fee_refunded').eq('status', 'succeeded').in('online_payment_item_id', unrecorded.map(u => u.id));
  const back = new Map<string, number>();
  for (const f of (refunds ?? []) as Array<{ online_payment_item_id: string; amount: number; fee_refunded: number }>) {
    back.set(f.online_payment_item_id, (back.get(f.online_payment_item_id) ?? 0) + Math.round((Number(f.amount) - Number(f.fee_refunded)) * 100));
  }
  unrecorded = unrecorded.filter(u => (back.get(u.id) ?? 0) < Math.round(Number(u.amount) * 100));
  if (!unrecorded.length) return;
  const org = await orgById(op.org_id);
  if (!org) return;
  const day = (pay?.paid_on as string | null) ?? null;
  const regIds = unrecorded.map(u => u.registration_id).filter((x): x is string => !!x);
  const { data: regs } = regIds.length
    ? await supabaseAdmin.from('league_registrations')
      .select('id, player_first_name, player_last_name, guardian_first_name, guardian_last_name').in('id', regIds)
    : { data: [] };
  const byId = new Map(((regs ?? []) as Array<Record<string, string | null>>).map(r => [r.id as string, r]));
  const people = await leagueRefundPeople(org);
  for (const u of unrecorded) {
    const reg = u.registration_id ? byId.get(u.registration_id) : undefined;
    const child = reg ? `${reg.player_first_name} ${reg.player_last_name}` : u.description;
    const guardian = reg && (reg.guardian_first_name || reg.guardian_last_name)
      ? [reg.guardian_first_name, reg.guardian_last_name].filter(Boolean).join(' ') : null;
    // 12d words §2.3: a fee already marked received reads "paid twice", and its first door is the refund to the card.
    const twice = u.land_error === 'already_received';
    const date = day ? formatStoredDate(day, { withYear: false }) : null;
    await raiseOnce({
      org, userIds: people, eventType: 'online_payment_not_recorded',
      subjectKey: 'onlinePaymentItemId', subjectId: u.id,
      title: twice ? LW.unrecordedTitleTwice(possessive(child)) : LW.unrecordedTitle(child, op.rail === 'bank_debit'),
      ...notRecordedNotice({
        amount: formatMoney(Number(u.amount)), bank: op.rail === 'bank_debit', day: date, payer: guardian, forWhat: child,
        reason: leagueUnrecordedWhy(u.land_error), team: false,
      }),
      link: recordHref(org, op, { regId: u.registration_id, at: twice ? 'card' : 'fee' }),
    });
  }
}

function cardOf(session: Stripe.Checkout.Session): { intent: string | null; charge: string | null; brand: string | null; last4: string | null; bankLast4: string | null; country: string | null } {
  const pi = session.payment_intent;
  const intent = typeof pi === 'string' ? pi : pi?.id ?? null;
  const ch = typeof pi === 'object' && pi ? pi.latest_charge : null;
  const charge = typeof ch === 'string' ? ch : ch?.id ?? null;
  const card = typeof ch === 'object' && ch ? ch.payment_method_details?.card : null;
  // 12c: a bank debit's account — on the charge once it exists, else on the payment method.
  const pm = typeof pi === 'object' && pi ? pi.payment_method : null;
  const bankLast4 = (typeof ch === 'object' && ch ? ch.payment_method_details?.acss_debit?.last4 : null)
    ?? (typeof pm === 'object' && pm ? pm.acss_debit?.last4 : null) ?? null;
  // 12d-1: the card's country (Part 4 bills Stripe's extra cost on a card issued outside the club's country from it).
  const country = (card?.country ?? '').toUpperCase();
  return { intent, charge, brand: card?.brand ?? null, last4: card?.last4 ?? null, bankLast4, country: /^[A-Z]{2}$/.test(country) ? country : null };
}

/**
 * 12c: a bank debit that finished Stripe's page is CLEARING (unpaid until the bank settles it, up to 5 business days):
 * the spot is held, nothing is in a book, no receipt number yet, and no second payment may open. Recorded once (only from
 * open); the family is told it started (not a receipt) on that first time, unless it is landing in the same breath (the
 * receipt says it all).
 */
async function startClearing(opId: string, card: ReturnType<typeof cardOf>, tell = true): Promise<boolean> {
  const { data: moved, error } = await supabaseAdmin.rpc('online_payment_clearing', {
    p_online_payment: opId, p_payment_intent: card.intent, p_bank_last4: card.bankLast4,
  });
  if (error) throw new Error(error.message);
  if (moved === true && tell) await sendDebitStartedEmail(opId);
  return moved === true;
}

/**
 * 12c: the bank returned a debit before it settled (`checkout.session.async_payment_failed`): nothing was taken and no
 * book was touched; the family is told, with a way to pay again. Idempotent: only an open or clearing debit that never
 * landed moves to returned.
 */
export async function returnDebit(stripeAccountId: string, sessionId: string): Promise<void> {
  const { data: op } = await supabaseAdmin.from('online_payments').select('id, stripe_account_id, rail').eq('stripe_checkout_session_id', sessionId).maybeSingle();
  if (!op || op.stripe_account_id !== stripeAccountId || op.rail !== 'bank_debit') return;
  // Re-read (review 2026-10-26): a failed read throws, so Stripe redelivers rather than a return recorded without its
  // reason; and a debit Stripe now says is paid lands instead of being marked returned on a stale event.
  const session = await retrieveCheckout(stripeAccountId, sessionId);
  if (session.payment_status === 'paid') { await landCheckoutSession(stripeAccountId, sessionId); return; }
  await markReturned(op.id as string, session);
}

/** A debit Stripe failed (its intent wants a new payment method, or was cancelled), as Stripe's own record says. */
function debitFailed(session: Stripe.Checkout.Session): boolean {
  const pi = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  return session.payment_status !== 'paid' && (pi?.status === 'requires_payment_method' || pi?.status === 'canceled');
}

async function markReturned(opId: string, session: Stripe.Checkout.Session): Promise<void> {
  const pi = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const code = pi?.last_payment_error?.code ?? pi?.last_payment_error?.decline_code ?? null;
  const { data: moved, error } = await supabaseAdmin.rpc('online_payment_returned', {
    p_online_payment: opId, p_reason: bankReturnReason(code), p_detail: code,
  });
  if (error) throw new Error(error.message);
  if (moved === true) {
    await sendDebitReturnedEmail(opId);
    await afterDebitBack(opId, 'returned'); // 12c Part 6: the desk's notice, any decision made while it cleared
    return;
  }
  // A redelivery after a failure past the commit: the notice is once-only, so it is owed again
  // (the family's email is not: it went before anything could fail).
  const { data: now } = await supabaseAdmin.from('online_payments').select('status').eq('id', opId).maybeSingle();
  if (now?.status === 'returned') await afterDebitBack(opId, 'returned');
}

// ── A bank debit at the desk (12c Part 6) ────────────────────────────────────────────────────────

type DebitRow = {
  id: string; org_id: string; flow: 'tournament_team' | 'league_signup'; team_id: string | null; tournament_id: string | null;
  season_id: string | null; total_amount: number; base_amount: number; bank_last4: string | null; returned_at: string | null;
  reversed_at: string | null; return_reason: string | null; receipt_no: number | null; payer_email: string | null; livemode: boolean;
};
const DEBIT_COLUMNS = 'id, org_id, flow, team_id, tournament_id, season_id, total_amount, base_amount, bank_last4, returned_at, reversed_at, return_reason, receipt_no, payer_email, livemode';

/**
 * After a debit came back (returned while clearing, or reversed after it cleared): the desk's notice (one per debit,
 * naming every child, words §3.6) and — for a return — any decision made while it cleared stamped 'returned' (nothing was
 * taken, so nothing is sent back or kept). Stripe's fee for it is taken from the club's own balance (Stripe-owned pricing,
 * Stage 4 retired the fee FieldLogicHQ used to bill back) and booked elsewhere, never here: a reversal's attached $5 by
 * `bookDisputeFee`, a failed debit's later $5 by the daily job (`takeStandaloneStripeFees`, Stage 3).
 */
async function afterDebitBack(opId: string, kind: 'returned' | 'reversed'): Promise<void> {
  const { data } = await supabaseAdmin.from('online_payments').select(DEBIT_COLUMNS).eq('id', opId).maybeSingle();
  const op = data as DebitRow | null;
  if (!op) return;
  if (kind === 'returned') {
    await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'returned', outcome_at: new Date().toISOString() })
      .eq('online_payment_id', op.id).is('outcome', null);
  }
  await raiseDebitNotice(op, kind);
}

async function raiseDebitNotice(op: DebitRow, kind: 'returned' | 'reversed'): Promise<void> {
  const org = await orgById(op.org_id);
  if (!org) return;
  const total = formatMoney(Number(op.total_amount));
  const day = formatStoredDate(kind === 'returned' ? op.returned_at : op.reversed_at, { withYear: false });
  const emailed = !!op.payer_email;
  const receiptNo = op.receipt_no != null ? String(op.receipt_no) : '';
  const eventType = kind === 'returned' ? 'debit_returned' as const : 'debit_reversed' as const;
  // One wording per kind (Notifications read at a glance, Stage 2): both senders pass facts to the kind's one entry.
  const words = (who: { team: string } | { children: string; one: boolean }, owed: string) => (kind === 'returned'
    ? DW.returned({ who, total, last4: op.bank_last4, day, reason: op.return_reason, emailed })
    : DW.reversed({ who, receiptNo, total, day, owed, emailed }));
  if (op.flow === 'tournament_team' && op.team_id) {
    const { data: team } = await supabaseAdmin.from('teams').select('name').eq('id', op.team_id).maybeSingle();
    const name = (team?.name as string | null) ?? '';
    await raiseOnce({
      org, userIds: await refundPeople(org), eventType, subjectKey: 'onlinePaymentId', subjectId: op.id,
      title: kind === 'returned' ? DW.returnedTitleTeam(possessive(name)) : DW.reversedTitleTeam(possessive(name)),
      ...words({ team: name }, formatMoney(Number(op.base_amount))),
      link: recordHref(org, op), extra: { teamId: op.team_id },
    });
    return;
  }
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('registration_id, amount').eq('online_payment_id', op.id);
  const kids = ((items ?? []) as Array<{ registration_id: string | null; amount: number }>).filter(i => i.registration_id);
  if (!kids.length) return;
  const { data: regs } = await supabaseAdmin.from('league_registrations').select('id, player_first_name').in('id', kids.map(k => k.registration_id!));
  const first = new Map(((regs ?? []) as Array<{ id: string; player_first_name: string }>).map(r => [r.id, r.player_first_name]));
  const names = kids.map(k => first.get(k.registration_id!) ?? '').filter(Boolean);
  const one = kids.length === 1;
  const owed = formatMoney(kids.reduce((s, k) => s + Number(k.amount), 0));
  await raiseOnce({
    org, userIds: await leagueRefundPeople(org), eventType, subjectKey: 'onlinePaymentId', subjectId: op.id,
    title: kind === 'returned' ? DW.returnedTitle(childList(names))
      : one ? DW.reversedTitleOne(possessive(names[0] ?? '')) : DW.reversedTitleMany(childList(names)),
    ...words({ children: childList(names), one }, owed),
    link: recordHref(org, op, one ? { regId: kids[0].registration_id } : undefined),
    extra: { registrationIds: kids.map(k => k.registration_id!).join(',') },
  });
}

/**
 * `charge.dispute.created` on a club's account (12c Part 6, §0k answer 4): a BANK DEBIT the bank reversed after it
 * cleared — a returned line beside the receipt (house league per child; a tournament team's row out of the paid figure),
 * the family emailed, the desk's notice, the fee recorded. A card dispute is 12d's: left alone. Idempotent.
 */
export async function reverseDebit(stripeAccountId: string, dispute: Stripe.Dispute): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const intentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!chargeId && !intentId) return;
  const COLS = 'id, stripe_account_id, rail, landed_at, status';
  // The charge is stored only when the debit LANDS; a debit still clearing has its payment intent and no charge yet, so a
  // dispute that beats the landing is found by the intent (review 2026-10-26: found by charge alone it matched nothing, was
  // answered 200 and consumed, and the debit later landed as paid).
  let op = chargeId ? (await supabaseAdmin.from('online_payments').select(COLS).eq('stripe_charge_id', chargeId).maybeSingle()).data : null;
  if (!op && intentId) op = (await supabaseAdmin.from('online_payments').select(COLS).eq('stripe_payment_intent_id', intentId).maybeSingle()).data;
  if (!op || op.stripe_account_id !== stripeAccountId || op.rail !== 'bank_debit') return;
  if (!op.landed_at) {
    // Still on its way to landing: throw, so Stripe redelivers the dispute once the landing is in.
    if (op.status === 'open' || op.status === 'clearing') throw new Error('This bank debit has not landed yet; the dispute will be retried.');
    // Paid but never recorded (its landing failed): there is no book line to return, and Stripe retrying for days cannot
    // change that — the "isn't in the record" item is already with the desk. Acknowledged, and said in the log.
    console.error('[online-payment-landing] a dispute on a bank debit that never landed in a record:', op.id, dispute.id);
    return;
  }
  const { data: res, error } = await supabaseAdmin.rpc('online_payment_reverse', {
    p_online_payment: op.id, p_dispute: dispute.id, p_reason: bankReturnReason(dispute.reason), p_detail: dispute.reason ?? null,
  });
  if (error) throw new Error(error.message);
  // A redelivery owes the notice again (once-only); never the family's email twice.
  if (!(res as { already?: boolean } | null)?.already) await sendDebitReversedEmail(op.id as string);
  await afterDebitBack(op.id as string, 'reversed');
}

// ── A card dispute (12d-1 Part 3) ───────────────────────────────────────────────────────────────

type DisputedPay = {
  id: string; org_id: string; flow: OnlineFlow; team_id: string | null; tournament_id: string | null; sponsor_deal_id: string | null;
  season_id: string | null; stripe_account_id: string; rail: string; status: string; landed_at: string | null;
  receipt_no: number | null; total_amount: number; paid_on: string | null; description: string; livemode: boolean;
};
const DISPUTED_PAY_COLUMNS = 'id, org_id, flow, team_id, tournament_id, sponsor_deal_id, season_id, stripe_account_id, rail, status, landed_at, receipt_no, total_amount, paid_on, description, livemode';

type DisputeRow = {
  id: string; status: string; reason: string | null; amount: number; held: number; due_by: string | null; answered: boolean;
  stripe_fee: number | null; fee_paid_from: string | null; opened_emailed_at: string | null;
  lost_booked_at: string | null; won_back_at: string | null; taken_back: { amount?: number; children?: Array<{ registrationId: string; amount: number }> } | null;
  /** A sponsor's win (mig 534) keeps what now stands past the invoice in `extra`. */
  won_back: { extra?: number } | null;
};

/**
 * Who answers a dispute (words §1, ask 3): the person who set up payouts — only they can sign in to Stripe — the owner in
 * the usual case (`canConnectPayouts`). The owner who connected leads when there is more than one. `name` is how the club
 * holds them; `email` their sign-in.
 */
export async function disputeAnswerer(orgId: string): Promise<{ ids: string[]; userId: string | null; name: string | null; email: string | null }> {
  const [members, { data: acct }] = await Promise.all([
    activeMembers(orgId),
    supabaseAdmin.from('org_payment_accounts').select('connected_by').eq('org_id', orgId).maybeSingle(),
  ]);
  const ids = [...new Set(members.filter(m => canConnectPayouts(m)).map(m => m.user_id))];
  const lead = ids.find(id => id === acct?.connected_by) ?? ids[0] ?? null;
  if (!lead) return { ids, userId: null, name: null, email: null };
  const [{ data: m }, { data: u }] = await Promise.all([
    supabaseAdmin.from('organization_members').select('display_name').eq('organization_id', orgId).eq('user_id', lead).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(lead),
  ]);
  const email = u?.user?.email ?? null;
  const metaName = (u?.user?.user_metadata as { full_name?: string; name?: string } | undefined);
  // Never the sign-in email as a name (/review 2026-10-27): every reader of the record sees this name.
  const name = (m?.display_name as string | null) || metaName?.full_name || metaName?.name || null;
  return { ids, userId: lead, name: name ?? null, email };
}

/** The words' "who": a child, the children, or the team; and the payer whose bank it is. */
async function disputeWho(op: DisputedPay): Promise<{
  name: string; who: string; many: string | null; payer: string; record: string; team: boolean; regIds: string[]; firstReg: string | null;
  /** The guardian's name as a row reads it ("Paid by · Pat Doe"), or null when it isn't known (a team's cardholder). */
  payerName: string | null;
}> {
  if (op.flow === 'tournament_team') {
    const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id).maybeSingle() : { data: null };
    const name = (team?.name as string | undefined) ?? op.description.split(' · ')[0];
    return { name, who: possessive(name), many: null, payer: DISPUTE_WORDS.payerUnknown, record: possessive(name), team: true, regIds: [], firstReg: null, payerName: null };
  }
  const { data: items } = await supabaseAdmin.from('online_payment_items').select('registration_id').eq('online_payment_id', op.id).order('created_at');
  const regIds = [...new Set(((items ?? []) as Array<{ registration_id: string | null }>).map(i => i.registration_id).filter((x): x is string => !!x))];
  const { data: regs } = regIds.length
    ? await supabaseAdmin.from('league_registrations').select('id, player_first_name, player_last_name, guardian_first_name, guardian_last_name').in('id', regIds)
    : { data: [] };
  const byId = new Map(((regs ?? []) as Array<Record<string, string | null>>).map(r => [r.id as string, r]));
  const kids = regIds.map(id => byId.get(id)).filter((r): r is Record<string, string | null> => !!r);
  const first = kids[0];
  const full = first ? `${first.player_first_name ?? ''} ${first.player_last_name ?? ''}`.trim() : op.description.split(' · ')[0];
  const guardian = first ? [first.guardian_first_name, first.guardian_last_name].filter(Boolean).join(' ') : '';
  const many = kids.length > 1 ? childList(kids.map(k => k.player_first_name ?? '').filter(Boolean)) : null;
  return {
    name: full, who: possessive(full), many, payer: guardian ? possessive(guardian) : DISPUTE_WORDS.payerUnknown,
    record: possessive(full), team: false, regIds, firstReg: regIds[0] ?? null, payerName: guardian || null,
  };
}

/**
 * A card dispute's event (`charge.dispute.*`, any order, any replay): the dispute is re-read from Stripe, never trusted
 * from the event, and written by THE one function (`online_payment_dispute_apply`, mig 391): stale reads change nothing,
 * a loss is booked once, a win after a loss is put back once. A bank debit's dispute is 12c's (`reverseDebit`) and is left
 * alone here. Then: the items (§1.4), the email to the person who answers (§1.6, once), and a new extra on a team after a
 * loss turned to a win (Part 2's item).
 */
export async function applyCardDispute(stripeAccountId: string, event: Pick<Stripe.Dispute, 'id' | 'charge' | 'payment_intent'>): Promise<void> {
  // Which payment: the event's charge or intent (never changes). Its STATE is re-read below.
  const chargeId = typeof event.charge === 'string' ? event.charge : event.charge?.id;
  const intentId = typeof event.payment_intent === 'string' ? event.payment_intent : event.payment_intent?.id;
  if (!chargeId && !intentId) return;
  const findPayment = async (): Promise<DisputedPay | null> => {
    let found = chargeId ? (await supabaseAdmin.from('online_payments').select(DISPUTED_PAY_COLUMNS).eq('stripe_charge_id', chargeId).maybeSingle()).data as DisputedPay | null : null;
    if (!found && intentId) found = (await supabaseAdmin.from('online_payments').select(DISPUTED_PAY_COLUMNS).eq('stripe_payment_intent_id', intentId).maybeSingle()).data as DisputedPay | null;
    return found;
  };
  let op = await findPayment();
  if (!op) {
    // Walk §541 step 17: a test dispute card disputes at the instant it is charged, so its events can beat the landing, which is
    // when the payment's charge and intent ids are first stored. Finding nothing then is "not yet", not "never ours": retry
    // while this account has a card payment started moments ago and still unlanded; a dispute on anything else is let go.
    if (await hasFreshUnlandedCardPayment(stripeAccountId)) throw new Error('No payment holds this dispute’s charge yet, and one is landing; the dispute will be retried.');
    // The landing may have finished between the first look and that check (it then reads as "none landing"): look once more.
    op = await findPayment();
    if (!op) return;
  }
  if (op.stripe_account_id !== stripeAccountId || op.rail !== 'card') return;
  // Part 3b, after the walk (mig 532): a sponsor's card dispute goes through the same writer; a loss reverses the payment's
  // receipt lines (no credit note) and puts the deal back to owing, a win puts it back (/accounting 2026-11-24).
  // Paid at Stripe but not landed yet: throw, so Stripe redelivers once the landing is in (the line a loss takes back must
  // exist). A payment whose landing failed is recorded as it stands: the "isn't in the record" item already has the desk.
  if (!op.landed_at && op.status === 'open') throw new Error('This card payment has not landed yet; the dispute will be retried.');
  const dispute = await retrieveDispute(stripeAccountId, event.id);
  const read = disputeFromStripe(dispute);
  if (!read) {
    console.error('[online-payment-landing] a dispute in a status this code doesn’t know:', dispute.id, dispute.status);
    return;
  }
  // The dispute's fee is the one Stripe took from the club's own balance (Stripe-owned pricing; Stage 4 retired the fee
  // FieldLogicHQ used to read off its own balance and bill back to the club).
  const { data: res, error } = await supabaseAdmin.rpc('online_payment_dispute_apply', {
    p_online_payment: op.id, p_dispute: dispute.id, p_status: read.status, p_reason: read.reason, p_amount: read.amount,
    p_held: read.held, p_due_by: read.dueBy, p_answered: read.answered, p_stripe_fee: read.stripeFee,
    p_fee_paid_from: read.feePaidFrom, p_livemode: read.livemode, p_opened_at: read.openedAt,
  });
  if (error) throw new Error(error.message);
  const out = res as { disputeId: string; lostNow?: boolean; wonBack?: boolean; over?: number };
  await afterDisputeApplied(op.id, out);
}

/** How long after a card payment starts a dispute that names no known charge is still waited for (minutes). */
const DISPUTE_BEFORE_LANDING_MINUTES = 30;

/** True while the account has a card payment opened within the last half hour that has not landed (its ids are not stored yet). */
async function hasFreshUnlandedCardPayment(stripeAccountId: string): Promise<boolean> {
  const since = new Date(Date.now() - DISPUTE_BEFORE_LANDING_MINUTES * 60_000).toISOString();
  const { data, error } = await supabaseAdmin.from('online_payments').select('id')
    .eq('stripe_account_id', stripeAccountId).eq('rail', 'card').is('landed_at', null).in('status', ['open', 'paid'])
    .gte('created_at', since).limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Everything after the dispute's write, each step once-only or read from the rows, so a replay owes nothing twice. */
async function afterDisputeApplied(onlinePaymentId: string, out: { disputeId: string; lostNow?: boolean; wonBack?: boolean; over?: number }): Promise<void> {
  const [{ data: opData }, { data: dData }] = await Promise.all([
    supabaseAdmin.from('online_payments').select(DISPUTED_PAY_COLUMNS).eq('id', onlinePaymentId).maybeSingle(),
    supabaseAdmin.from('online_payment_disputes')
      .select('id, status, reason, amount, held, due_by, answered, stripe_fee, fee_paid_from, opened_emailed_at, lost_booked_at, won_back_at, taken_back, won_back')
      .eq('id', out.disputeId).maybeSingle(),
  ]);
  const op = opData as DisputedPay | null;
  const d = dData as DisputeRow | null;
  if (!op || !d) return;
  const org = await orgById(op.org_id);
  if (!org) return;
  // An inquiry that became a dispute keeps its id (mig 396): its "nothing has been taken" notice is settled first, or the open
  // copy would block the dispute's own and the club would never hear "don't refund" (B-3, owner 2026-11-25).
  if (isDisputeOpen(d.status) && !isInquiry(d.status)) await clearSettled({ orgIds: [op.org_id], kinds: ['card_disputed'] });
  if (op.flow === 'sponsorship') { await afterSponsorDispute(org, op, d); return; }
  if (isDisputeOpen(d.status)) {
    await raiseDisputed(org, op, d);
    if (!d.opened_emailed_at) await sendDisputeOpenedEmail(org, op, d);
  }
  // Read from the rows, not this call's answer (/review 2026-10-27): a failure after the commit would otherwise lose the item
  // for good, since a redelivery finds the loss already booked. Raised once ever per dispute, so an item the child or team
  // already settled is never raised again by a later event.
  if (d.lost_booked_at && !d.won_back_at && !(await disputeLostRaised(op.org_id, d.id))) await raiseDisputeLost(org, op, d);
  // A loss later turned to a win puts the money back; what the team paid again meanwhile is extra (Part 2's item, which
  // raises only while the extra still stands, so a replay never reopens it).
  if (d.won_back_at && op.flow === 'tournament_team') await raiseOverpaid(op.id);
  await clearSettled({ orgIds: [op.org_id], kinds: ['card_disputed', 'card_dispute_lost', 'online_payment_over'] });
}

/**
 * "A card payment is disputed" (§1.4), while it is open: the answerer's copy (`answerer: 'yes'`, raised only while
 * unanswered — it settles once the answer is sent) and the desk's quiet copy with the answerer's name (raised while open;
 * it settles on the bank's decision). Raised only under the rule's own "waiting" condition, so a settled copy is never
 * reopened, and `raiseOnce` never doubles an open one (one copy per person per dispute, mig 390).
 */
async function raiseDisputed(org: Organization, op: DisputedPay, d: DisputeRow): Promise<void> {
  const [answerer, who, members] = await Promise.all([disputeAnswerer(org.id), disputeWho(op), activeMembers(org.id)]);
  const desk = members.filter(m => (op.flow === 'tournament_team' ? canRefundOnline(m, org) : canRefundLeagueOnline(m, org)) && !answerer.ids.includes(m.user_id)).map(m => m.user_id);
  const inquiry = isInquiry(d.status);
  const title = who.many
    ? (inquiry ? DISPUTE_WORDS.itemTitleManyInquiry(who.many) : DISPUTE_WORDS.itemTitleMany(who.many))
    : (inquiry ? DISPUTE_WORDS.itemTitleInquiry(who.who) : DISPUTE_WORDS.itemTitle(who.who));
  const receipt = String(op.receipt_no ?? '');
  const amount = formatMoney(Number(d.amount));
  const link = recordHref(org, op, who.firstReg && !who.many ? { regId: who.firstReg } : undefined);
  const extra: Record<string, string> = {
    ...(op.team_id ? { teamId: op.team_id } : who.regIds.length ? { registrationIds: who.regIds.join(',') } : {}),
    ...(inquiry ? { inquiry: 'yes' } : {}),
  };
  // One wording for the four cases (dispute or inquiry, the answerer's copy or the desk's): the facts, passed once.
  const words = (answers: string | null) => DISPUTE_WORDS.item({
    payer: who.payerName, receiptNo: receipt, amount, reason: d.reason, held: formatMoney(disputeHeld(d)), inquiry,
    due: disputeDue(d.due_by, { clock: true }), dueDay: disputeDue(d.due_by), answers,
  });
  if (!d.answered) {
    await raiseOnce({
      org, userIds: answerer.ids, eventType: 'card_disputed', subjectKey: 'onlineDisputeId', subjectId: d.id, title, link,
      ...words(null),
      extra: { ...extra, answerer: 'yes' },
    });
  }
  await raiseOnce({
    org, userIds: desk, eventType: 'card_disputed', subjectKey: 'onlineDisputeId', subjectId: d.id, title, link,
    ...words(answerer.name ?? 'The owner'),
    extra,
  });
}

/** Was the lost item ever raised for this dispute (open or settled)? It is raised once, never reopened. Read through the
 *  one dedupe helper (`hasRecentNotification`, keyed by org AND event type), never the notifications table here. */
async function disputeLostRaised(orgId: string, disputeId: string): Promise<boolean> {
  return hasRecentNotification(orgId, 'card_dispute_lost', { onlineDisputeId: disputeId }, '1970-01-01T00:00:00Z');
}

/** "The dispute was lost" (§1.4): to the desk and the owner, once, when the loss is booked. It clears itself when the child
 *  or team is paid in full or ended, or at once if the bank later turns it into a win. */
async function raiseDisputeLost(org: Organization, op: DisputedPay, d: DisputeRow): Promise<void> {
  const [answerer, who, members] = await Promise.all([disputeAnswerer(org.id), disputeWho(op), activeMembers(org.id)]);
  const people = [...new Set([...answerer.ids,
    ...members.filter(m => (op.flow === 'tournament_team' ? canRefundOnline(m, org) : canRefundLeagueOnline(m, org))).map(m => m.user_id)])];
  const taken = d.taken_back ?? {};
  const kids = (taken.children ?? []).filter(c => c.registrationId);
  const day = formatStoredDate(d.lost_booked_at, { withYear: false });
  const receipt = String(op.receipt_no ?? '');
  if (op.flow === 'tournament_team') {
    const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id).maybeSingle() : { data: null };
    const name = (team?.name as string | undefined) ?? op.description.split(' · ')[0];
    await raiseOnce({
      org, userIds: people, eventType: 'card_dispute_lost', subjectKey: 'onlineDisputeId', subjectId: d.id,
      title: DISPUTE_WORDS.lostTitle(who.who),
      ...DISPUTE_WORDS.lostNotice({ who: { team: name }, receiptNo: receipt, amount: formatMoney(Number(taken.amount ?? d.amount)), day, owed: formatMoney(Number(taken.amount ?? d.amount)) }),
      link: recordHref(org, op), extra: op.team_id ? { teamId: op.team_id } : {},
    });
    return;
  }
  if (!kids.length) return;
  const { data: regs } = await supabaseAdmin.from('league_registrations').select('id, player_first_name').in('id', kids.map(k => k.registrationId));
  const firstName = new Map(((regs ?? []) as Array<{ id: string; player_first_name: string }>).map(r => [r.id, r.player_first_name]));
  const names = kids.map(k => firstName.get(k.registrationId) ?? '').filter(Boolean);
  const one = kids.length === 1;
  await raiseOnce({
    org, userIds: people, eventType: 'card_dispute_lost', subjectKey: 'onlineDisputeId', subjectId: d.id,
    title: one ? DISPUTE_WORDS.lostTitle(who.who) : DISPUTE_WORDS.lostTitleMany(childList(names)),
    ...DISPUTE_WORDS.lostNotice({
      who: { children: childList(names), one }, receiptNo: receipt, day,
      amount: formatMoney(kids.reduce((s, k) => s + Number(k.amount), 0)), owed: formatMoney(kids.reduce((s, k) => s + Number(k.amount), 0)),
    }),
    link: recordHref(org, op, one ? { regId: kids[0].registrationId } : undefined),
    extra: { registrationIds: kids.map(k => k.registrationId).join(',') },
  });
}

/**
 * The email to the person who answers when a dispute opens (§1.6, FieldLogicHQ's own envelope). Once: sent under a
 * once-only key, then stamped; a failure is logged and the next event tries again. No family is ever emailed (ask 2).
 * The reminder three days before it is due is the daily job's (Part 4).
 */
async function sendDisputeOpenedEmail(org: Organization, op: DisputedPay, d: DisputeRow): Promise<void> {
  try {
    const answerer = await disputeAnswerer(org.id);
    if (!answerer.email) return;
    const who = await disputeWho(op);
    const forWhom = who.many ?? who.name;
    const html = disputeOpenedEmailHtml({
      club: org.name, payer: who.payer, forWhom, record: who.many ? null : who.record, receiptNo: String(op.receipt_no ?? ''),
      day: formatStoredDate(op.paid_on, { withYear: true }), status: d.status, reason: d.reason, held: disputeHeld(d),
      dueBy: d.due_by, stripeFee: d.fee_paid_from === 'club' ? d.stripe_fee : null,
      link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${recordHref(org, op, who.firstReg && !who.many ? { regId: who.firstReg } : undefined)}`,
      test: !op.livemode,
    });
    const sent = await sendEmail(answerer.email, html.subject, html.html, { kind: 'card_dispute_opened', orgId: org.id, idempotencyKey: `dispute-opened:${d.id}` });
    if (sent.status !== 'sent') return;
    await supabaseAdmin.from('online_payment_disputes').update({ opened_emailed_at: new Date().toISOString() }).eq('id', d.id).is('opened_emailed_at', null);
  } catch (e) {
    console.error('[online-payment-landing] the dispute email was not sent:', d.id, e instanceof Error ? e.message : String(e));
  }
}

/**
 * §1.6 email 2 (12d-1 Part 4, the daily job): the person who answers is reminded three days before the answer is due, once,
 * and only while the dispute is open and unanswered. Decided from the rows (open, unanswered, due within three days, never
 * reminded), so a rerun sends nothing twice. Stripe's own read of "answered" is the dispute row's, kept by every event.
 */
export async function sendDisputeReminders(now: Date = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + 3 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin.from('online_payment_disputes')
    .select('id, org_id, online_payment_id, status, due_by, answered')
    .in('status', ['warning_needs_response', 'needs_response']).eq('answered', false).is('reminder_emailed_at', null)
    .gt('due_by', now.toISOString()).lte('due_by', soon).limit(200);
  let sent = 0;
  for (const d of (data ?? []) as Array<{ id: string; org_id: string; online_payment_id: string; status: string; due_by: string }>) {
    try {
      const [org, { data: opData }, answerer] = await Promise.all([
        orgById(d.org_id),
        supabaseAdmin.from('online_payments').select(DISPUTED_PAY_COLUMNS).eq('id', d.online_payment_id).maybeSingle(),
        disputeAnswerer(d.org_id),
      ]);
      const op = opData as DisputedPay | null;
      if (!org || !op || !answerer.email) continue;
      // The reminder email is worded for a team or a child. A sponsor's dispute has its notice (open, lost, won) and no email yet.
      if (op.flow === 'sponsorship') continue;
      const who = await disputeWho(op);
      const html = disputeReminderEmailHtml({
        club: org.name, forWhom: who.many ?? who.name, record: who.many ? null : who.record, receiptNo: String(op.receipt_no ?? ''),
        dueBy: d.due_by, status: d.status, test: !op.livemode,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${recordHref(org, op, who.firstReg && !who.many ? { regId: who.firstReg } : undefined)}`,
      });
      const res = await sendEmail(answerer.email, html.subject, html.html, { kind: 'card_dispute_reminder', orgId: org.id, idempotencyKey: `dispute-reminder:${d.id}` });
      if (res.status !== 'sent') continue;
      await supabaseAdmin.from('online_payment_disputes').update({ reminder_emailed_at: new Date().toISOString() }).eq('id', d.id).is('reminder_emailed_at', null);
      sent += 1;
    } catch (e) {
      console.error('[online-payment-landing] the dispute reminder was not sent:', d.id, e instanceof Error ? e.message : String(e));
    }
  }
  return sent;
}

/** What Stripe holds: its own figure, or — read before Stripe attached the withdrawal — the disputed amount, which a
 *  dispute (never an inquiry) always withdraws (/review 2026-10-27: the item and the one email said "$0.00"). */
const disputeHeld = (d: Pick<DisputeRow, 'held' | 'amount' | 'status'>) =>
  (Number(d.held) > 0 || isInquiry(d.status) ? Number(d.held) : Number(d.amount));

/**
 * Refunds wait while a dispute is open (words §1.2 `dispute.noRefund`): Stripe already took the money back, and a refund
 * on top would pay the family or team twice. Asked by every refund to the card before it opens.
 */
export class DisputeOpenError extends Error {}
async function refuseWhileDisputed(onlinePaymentId: string): Promise<void> {
  const { data, error } = await supabaseAdmin.from('online_payment_disputes').select('status, online_payments!inner(flow)').eq('online_payment_id', onlinePaymentId);
  // Closed, never open (/review 2026-10-27): a failed read must not let a second payment out on a disputed one.
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{ status: string; online_payments: { flow: string } | { flow: string }[] }>;
  if (!refundBlockedByDispute(rows)) return;
  const pay = rows[0]?.online_payments;
  const flow = Array.isArray(pay) ? pay[0]?.flow : pay?.flow;
  throw new DisputeOpenError(DISPUTE_WORDS.noRefund(flow === 'tournament_team'));
}

/** A send-back that couldn't go: the refund-didn't-reach item, for the bank account, to whoever may refund. It was never
 *  sent (Stripe refused it, or no refund could be opened), so it says "couldn’t be sent", never "came back".
 *  ⚖ The amount is the send-back's own (Stage 2, owner Q6: "confirm whether that is the refund's amount; fix it if not"):
 *  the refund row's when one was opened; otherwise what the send-back would have been — a team's whole payment with the
 *  payment fee when it goes back and the family paid it (mig 382's `online_payment_refund_open`), a child's share. Until
 *  2026-11-14 a team's said the payment's base amount alone, short by the fee whenever the fee went back. */
async function raiseSendBackFailed(onlinePaymentId: string, itemId: string | null, refundId: string | null, feeBack: boolean): Promise<void> {
  const [{ data: op }, { data: refund }] = await Promise.all([
    supabaseAdmin.from('online_payments')
      .select('org_id, season_id, tournament_id, team_id, bank_last4, base_amount, fee_amount, fee_payer, description').eq('id', onlinePaymentId).maybeSingle(),
    refundId ? supabaseAdmin.from('online_payment_refunds').select('amount').eq('id', refundId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const org = op ? await orgById(op.org_id as string) : null;
  if (!op || !org) return;
  const refunded = refund?.amount != null ? Number(refund.amount) : null;
  const notice = (amount: number, whose: { team: string } | { child: string }) => refundFailedNotice({
    amount: formatMoney(amount), bank: true, card: null, bankLast4: (op.bank_last4 as string | null) ?? null, whose, sent: false,
  });
  const extra: Record<string, string> = refundId ? { refundId } : { onlinePaymentId };
  if (itemId) {
    const { data: item } = await supabaseAdmin.from('online_payment_items').select('description, registration_id, amount').eq('id', itemId).maybeSingle();
    const child = ((item?.description as string | undefined) ?? '').split(' · ')[0];
    const { title, body, facts } = notice(refunded ?? Number(item?.amount ?? 0), { child });
    await raiseOnce({
      org, userIds: await leagueRefundPeople(org), eventType: 'card_refund_failed', subjectKey: 'onlinePaymentItemId', subjectId: itemId,
      title, body, facts,
      link: recordHref(org, { tournament_id: null, season_id: (op.season_id as string | null) ?? null }, { regId: (item?.registration_id as string | null) ?? null, at: 'card' }),
      extra,
    });
    return;
  }
  const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id as string).maybeSingle() : { data: null };
  const name = (team?.name as string | undefined) ?? (op.description as string).split(' · ')[0];
  const fee = feeBack && op.fee_payer === 'family' ? Number(op.fee_amount ?? 0) : 0;
  const { title, body, facts } = notice(refunded ?? Number(op.base_amount) + fee, { team: name });
  await raiseOnce({
    org, userIds: await refundPeople(org), eventType: 'card_refund_failed', subjectKey: 'onlinePaymentId', subjectId: onlinePaymentId,
    title, body, facts,
    link: recordHref(org, { tournament_id: (op.tournament_id as string | null) ?? null, season_id: null }), extra: refundId ? { refundId } : {},
  });
}

/**
 * The decisions made while a debit cleared (12c Part 6, words §3.3), carried out once it has landed: "send it back" is a
 * refund in the name of whoever decided, with A2's box as they set it (a failure raises the refund-didn't-reach item,
 * worded for an account, like any refund); "keep it" was answered by the landing itself (house league) or is stamped here
 * (a team). Read from the DATABASE, so a replay finds what a crash left; each decision is claimed before Stripe is asked,
 * so two deliveries never refund twice.
 */
async function carryOutDecisions(onlinePaymentId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('online_payment_clear_decisions')
    .select('id, online_payment_item_id, choice, fee_back, decided_by').eq('online_payment_id', onlinePaymentId).is('outcome', null);
  for (const d of (data ?? []) as Array<{ id: string; online_payment_item_id: string | null; choice: string; fee_back: boolean; decided_by: string | null }>) {
    const now = new Date().toISOString();
    if (d.choice === 'keep') {
      if (!d.online_payment_item_id) await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'kept', outcome_at: now }).eq('id', d.id).is('outcome', null);
      continue;
    }
    if (d.online_payment_item_id) {
      // Only a child whose share is in the book (the landing ran), and still ended (the landing voids a child put back).
      const { data: item } = await supabaseAdmin.from('online_payment_items').select('entry_id, registration_id').eq('id', d.online_payment_item_id).maybeSingle();
      if (!item?.entry_id) continue;
      const { data: reg } = item.registration_id
        ? await supabaseAdmin.from('league_registrations').select('status').eq('id', item.registration_id as string).maybeSingle() : { data: null };
      if (reg && reg.status !== 'declined' && reg.status !== 'withdrawn') {
        await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'void', outcome_at: now }).eq('id', d.id).is('outcome', null);
        continue;
      }
    } else {
      // A team put back (accepted again) before its debit cleared has simply paid (review 2026-10-26).
      const { data: pay } = await supabaseAdmin.from('online_payments').select('team_id').eq('id', onlinePaymentId).maybeSingle();
      const { data: t } = pay?.team_id ? await supabaseAdmin.from('teams').select('status').eq('id', pay.team_id as string).maybeSingle() : { data: null };
      if (t?.status === 'accepted') {
        await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'void', outcome_at: now }).eq('id', d.id).is('outcome', null);
        continue;
      }
    }
    const { data: claimed } = await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'sent_back', outcome_at: now })
      .eq('id', d.id).is('outcome', null).select('id').maybeSingle();
    if (!claimed) continue;
    try {
      let refundId: string | null = null;
      if (d.online_payment_item_id) {
        const { data: item } = await supabaseAdmin.from('online_payment_items').select('registration_id').eq('id', d.online_payment_item_id).maybeSingle();
        const { data: reg } = item?.registration_id
          ? await supabaseAdmin.from('league_registrations').select('status').eq('id', item.registration_id as string).maybeSingle() : { data: null };
        const r = await refundLeagueToCard({
          itemId: d.online_payment_item_id, amount: null, feeIncluded: d.fee_back,
          reason: reg?.status === 'withdrawn' ? 'family_left' : 'club_ended', partialReason: null, note: null,
          actorId: d.decided_by as string,
        });
        refundId = r.refundId;
        if (r.state === 'failed') throw Object.assign(new Error(r.message ?? 'Stripe refused the refund'), { refundId: r.refundId });
      } else {
        const { data: team } = await supabaseAdmin.from('online_payments').select('team_id').eq('id', onlinePaymentId).maybeSingle();
        const { data: t } = team?.team_id ? await supabaseAdmin.from('teams').select('status').eq('id', team.team_id as string).maybeSingle() : { data: null };
        const r = await refundOnlinePayment({
          onlinePaymentId, feeIncluded: d.fee_back, reason: t?.status === 'withdrawn' ? 'team_left' : 'organizer_ended', note: null,
          actorId: d.decided_by as string,
        });
        refundId = (r as { refundId?: string }).refundId ?? null;
        if (r.state === 'failed') throw Object.assign(new Error('Stripe refused the refund'), { refundId });
      }
      if (refundId) await supabaseAdmin.from('online_payment_clear_decisions').update({ refund_id: refundId }).eq('id', d.id);
    } catch (err) {
      // The send-back could not go (Stripe refused it, or no refund could be opened): the decision reads failed and the
      // desk gets the refund-didn't-reach item, worded for a bank account (words §3.3, §3.6) — the family was told it
      // goes back, so a person sends it another way.
      const refundId = (err as { refundId?: string | null } | null)?.refundId ?? null;
      await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'failed', outcome_at: new Date().toISOString(), refund_id: refundId }).eq('id', d.id);
      await raiseSendBackFailed(onlinePaymentId, d.online_payment_item_id, refundId, !!d.fee_back).catch(() => null);
      console.error('[online-payment-landing] a send-back after clearing failed:', err instanceof Error ? err.message : String(err));
    }
  }
}


/**
 * A desk's answer saved while a debit was clearing may land AFTER the debit did (the desk checked "clearing", then the
 * webhook landed it, then the answer was written): the landing's own carry-out then found nothing, and the UI stops
 * showing an answer once the debit is not clearing, so it would wait forever (review 2026-10-26). Called right after the
 * answer is saved: if the debit has since landed it is carried out now, if it came back it is stamped like the others.
 * A debit still clearing is left to the landing. Safe beside the webhook — every decision is claimed before it acts.
 */
export async function settleDecisionAfterSave(onlinePaymentId: string): Promise<void> {
  const { data: op } = await supabaseAdmin.from('online_payments').select('status, landed_at').eq('id', onlinePaymentId).maybeSingle();
  if (!op || op.status === 'clearing') return;
  if (op.status === 'returned') {
    await supabaseAdmin.from('online_payment_clear_decisions').update({ outcome: 'returned', outcome_at: new Date().toISOString() })
      .eq('online_payment_id', onlinePaymentId).is('outcome', null);
    return;
  }
  if (op.landed_at) await carryOutDecisions(onlinePaymentId);
}

/**
 * A Checkout Session on a club's account completed and paid → land it. Idempotent (the database function answers
 * `already`). A landing that throws — an "our team" link made after the page opened, a deleted team — keeps the payment
 * PAID and numbered, with the reason, and raises "isn't in the team's record" for whoever may refund. Stripe has the
 * money either way; nothing is lost.
 */
export async function landCheckoutSession(stripeAccountId: string, sessionId: string): Promise<'landed' | 'already' | 'not_paid' | 'unknown' | 'not_recorded' | 'clearing' | 'returned'> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .select('id, org_id, flow, team_id, tournament_id, season_id, status, landed_at, stripe_account_id, stripe_checkout_session_id, description, total_amount, rail')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  const op = data as (OnlineRow & { rail?: string | null }) | null;
  if (!op || op.stripe_account_id !== stripeAccountId) return 'unknown';
  // Part 3b: a sponsor's card payment owes only its place and its receipt on a replay (each once-only).
  if (op.landed_at && op.flow === 'sponsorship') { await afterSponsorLanding(op.id); return 'already'; }
  if (op.landed_at) {
    // A replay still owes any child's notice a crash after the landing's commit missed (raiseLeagueUnrecorded), and the
    // answer a desk gave while the debit cleared plus the receipt (review 2026-10-26: a crash between the landing's commit
    // and those steps left a "send it back" answer waiting forever). Each is once-only, so a plain replay changes nothing.
    if (op.flow === 'league_signup') await raiseLeagueUnrecorded(op);
    else await raiseOverpaid(op.id); // 12d-1: the row is the truth, so a replay still owes the item a crash missed
    await stampPayerOnLines(op.id);
    await carryOutDecisions(op.id);
    await sendOnlineReceiptOnce(op.id);
    await bookDisputesLostBeforeLanding(stripeAccountId, op.id).catch(lostBookingFailed); // 12d-1 Part 4b: a crash before it is caught here
    return 'already';
  }
  if (op.status === 'returned') return 'returned'; // 12c: a returned debit never lands
  const session = await retrieveCheckout(stripeAccountId, sessionId);
  const card = cardOf(session);
  const bank = op.rail === 'bank_debit';
  if (session.payment_status !== 'paid') {
    // 12c: a bank debit that finished Stripe's page is clearing (completed, unpaid) — or, read after the bank said no
    // (a missed async_payment_failed), returned.
    if (bank && session.status === 'complete' && debitFailed(session)) { await markReturned(op.id, session); return 'returned'; }
    if (bank && session.status === 'complete') { await startClearing(op.id, card); return 'clearing'; }
    return 'not_paid';
  }
  // 12c: a debit that settles before its "completed" arrived is recorded clearing first (its account kept), then lands.
  if (bank && op.status === 'open') await startClearing(op.id, card, false);
  // A card is paid when its intent was made; a bank debit (12c) the day it CLEARED — it lands now, at Stripe's
  // async_payment_succeeded (review 2026-10-26: the intent's time is the day it started, days earlier).
  const paidAt = bank
    ? new Date().toISOString()
    : new Date(((typeof session.payment_intent === 'object' && session.payment_intent?.created) || session.created) * 1000).toISOString();
  // Stripe's own figures must be the ones the payment was opened for; anything else is recorded by a person, not by us.
  const expected = Math.round(Number(op.total_amount) * 100);
  const mismatch = session.amount_total !== expected || (session.currency ?? '').toLowerCase() !== 'cad'
    ? `Stripe took ${(session.amount_total ?? 0) / 100} ${(session.currency ?? '').toUpperCase()}, not the ${expected / 100} CAD the page asked for`
    : null;
  // 12d-1: the card's country, written once Stripe says it is paid, before the landing (kept as a fact of the payment; Stripe
  // takes its own extra for a card from outside the club's country from the club's balance since Stripe-owned pricing).
  await writeCardCountry(op.id, card);
  // Part 3b (mig 530): a sponsor's card payment lands on its deal through its own function, never the team writer.
  if (op.flow === 'sponsorship') return landSponsorship(op, paidAt, card, mismatch, session);
  if (op.flow === 'league_signup') {
    const result = await landLeague(op, paidAt, card, mismatch);
    await bookDisputesLostBeforeLanding(stripeAccountId, op.id).catch(lostBookingFailed);
    if (result === 'landed' || result === 'already') await recordStripeFee(op.id, session);
    return result;
  }

  const { data: landed, error: landError } = mismatch
    ? { data: null, error: { message: mismatch } }
    : await supabaseAdmin.rpc('online_payment_land', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand, p_last4: card.last4,
    });
  const error = landError;
  if (error) {
    // A passing conflict (a deadlock victim, a lock wait, a cancelled statement) is Stripe's to retry, exactly as the
    // house-league landing does: stamped "not recorded" it would be answered 200 and never landed (review 2026-10-26).
    if (isTransientDbError(error)) throw new Error(`Team payment landing will retry: ${error.message}`);
    await supabaseAdmin.rpc('online_payment_land_failed', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand,
      p_last4: card.last4, p_error: error.message,
    });
    const org = await orgById(op.org_id);
    if (org) {
      await raiseOnce({
        org, userIds: await refundPeople(org), eventType: 'online_payment_not_recorded',
        subjectKey: 'onlinePaymentId', subjectId: op.id,
        title: W.notRecordedTitle,
        ...notRecordedNotice({ amount: formatMoney(Number(op.total_amount)), bank, day: null, payer: null, forWhat: op.description, reason: error.message, team: true }),
        link: recordHref(org, op),
      });
    }
    await sendOnlineReceiptOnce(op.id);
    return 'not_recorded';
  }
  await stampPayerOnLines(op.id);
  if (!(landed as { already?: boolean } | null)?.already) await tellPaymentReceived(op);
  await sendOnlineReceiptOnce(op.id);
  await carryOutDecisions(op.id); // 12c Part 6: a team declined while its debit cleared
  // 12d-1 (ask 10): booked in full, and flagged when it was past what the team owed. Read from the row, never from the
  // landing's answer (a replay answers `already` without it).
  await raiseOverpaid(op.id);
  if (!(landed as { already?: boolean } | null)?.already) await reconcileDashboardRefunds(stripeAccountId, op.id);
  await bookDisputesLostBeforeLanding(stripeAccountId, op.id).catch(lostBookingFailed);
  await recordStripeFee(op.id, session);
  return (landed as { already?: boolean } | null)?.already ? 'already' : 'landed';
}

/**
 * Stripe-owned pricing Stage 3 (mig 501): Stripe's own fee on a landed payment, stored once, and the part above Stripe's
 * standard cost (a foreign card, a conversion) booked as "Stripe's extra". Never blocks the landing: the figure is often
 * not there yet (the probe saw it about a second after the payment), and the daily job catches it up
 * (`catchUpStripeFees`). An old 'application' account is skipped by the database (its row stays NULL).
 */
async function recordStripeFee(onlinePaymentId: string, session: Stripe.Checkout.Session): Promise<void> {
  const intent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const cents = stripeFeeCents(chargeBalanceTransaction(intent?.latest_charge));
  if (cents === null) return;
  await setStripeFee(onlinePaymentId, cents);
}

/** True only when this call stored the fee (not a skip, not already, not an error), so the daily job's count is honest. */
async function setStripeFee(onlinePaymentId: string, cents: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('online_payment_stripe_fee_set', { p_online_payment: onlinePaymentId, p_stripe_fee: cents / 100 });
  if (error) { console.error('[online-payment-landing] Stripe’s fee not recorded yet (the daily job retries):', onlinePaymentId, error.message); return false; }
  const r = data as { already?: boolean; skipped?: string } | null;
  return !!r && r.already === false;
}

/** How far back the daily job looks for a landed payment still without Stripe's fee. */
const STRIPE_FEE_CATCH_UP_DAYS = 35;

/**
 * The daily job (Stage 3): every landed payment on a Stripe-owned account in the last 35 days whose Stripe fee is still
 * unread is read from its charge and recorded. Returns how many were recorded.
 */
export async function catchUpStripeFees(): Promise<{ read: number; recorded: number; failed: number; disputeFees: number }> {
  const since = new Date(Date.now() - STRIPE_FEE_CATCH_UP_DAYS * 86_400_000).toISOString();
  const { data: accounts, error: aErr } = await supabaseAdmin.from('org_payment_accounts').select('stripe_account_id').eq('fees_collector', 'stripe');
  if (aErr) throw new Error(aErr.message);
  const ids = (accounts ?? []).map(a => a.stripe_account_id as string).filter(Boolean);
  if (!ids.length) return { read: 0, recorded: 0, failed: 0, disputeFees: 0 };
  // Hardening (owner 2026-11-18): only connected accounts; newest first, so a payment Stripe keeps refusing can't hold the
  // batch's slots ahead of fixable ones; one payment's failure is counted and the rest go on.
  const { data: live, error: lErr } = await supabaseAdmin.from('org_payment_accounts').select('stripe_account_id')
    .in('stripe_account_id', ids).is('disconnected_at', null);
  if (lErr) throw new Error(lErr.message);
  const connected = (live ?? []).map(a => a.stripe_account_id as string);
  if (!connected.length) return { read: 0, recorded: 0, failed: 0, disputeFees: 0 };
  const { data: rows, error } = await supabaseAdmin.from('online_payments').select('id, stripe_account_id, stripe_charge_id')
    .in('stripe_account_id', connected).not('landed_at', 'is', null).gte('landed_at', since)
    .is('stripe_fee_amount', null).not('stripe_charge_id', 'is', null).order('landed_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  let recorded = 0; let failed = 0;
  for (const r of rows ?? []) {
    try {
      const charge = await retrieveChargeWithFee(r.stripe_account_id as string, r.stripe_charge_id as string);
      const cents = stripeFeeCents(chargeBalanceTransaction(charge));
      if (cents === null) continue;
      if (await setStripeFee(r.id as string, cents)) recorded++;
    } catch (e) {
      failed++;
      console.error('[online-payment-landing] Stripe’s fee not read (the daily job retries):', r.id, e instanceof Error ? e.message : e);
    }
  }
  return { read: rows?.length ?? 0, recorded, failed, disputeFees: await catchUpDisputeFees(connected, since) };
}

/**
 * A card dispute's fee whose event came before its payment landed (`bookDisputeFee` waits for the landing, and Stripe
 * does not send that event again): booked from the dispute's stored fee once the payment is in (hardening, owner
 * 2026-11-18). Inquiries carry no fee. Returns how many were booked.
 */
async function catchUpDisputeFees(accounts: readonly string[], since: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from('online_payments')
    .select('id, online_payment_disputes!inner(stripe_fee, status)')
    .in('stripe_account_id', [...accounts]).not('landed_at', 'is', null).gte('landed_at', since)
    .is('dispute_fee_entry_id', null).gt('online_payment_disputes.stripe_fee', 0)
    .not('online_payment_disputes.status', 'like', 'warning%').limit(200);
  if (error) throw new Error(error.message);
  let booked = 0;
  for (const op of data ?? []) {
    const rows = (op.online_payment_disputes ?? []) as { stripe_fee: number | string | null }[];
    const fee = Math.max(0, ...rows.map(d => Number(d.stripe_fee) || 0));
    if (fee <= 0) continue;
    const { data: res, error: bErr } = await supabaseAdmin.rpc('online_payment_dispute_fee_book', { p_online_payment: op.id, p_fee: fee });
    if (bErr) { console.error('[online-payment-landing] a dispute fee not booked (the daily job retries):', op.id, bErr.message); continue; }
    if ((res as { already?: boolean } | null)?.already === false) booked++;
  }
  return booked;
}

/**
 * Stage 3, owner ruling (b): the fee Stripe attached to a dispute (its withdrawal's "Dispute fee": $15 card, $5 bank
 * debit) is booked once on the payment's own book as "Dispute fee · receipt N" (a bank debit's: "Returned debit fee · receipt N",
 * since the product calls that dispute "Returned by the bank"). Any dispute event, either rail; a no-op
 * until the payment has landed, and on an old account.
 */
export async function bookDisputeFee(stripeAccountId: string, dispute: Stripe.Dispute): Promise<void> {
  const cents = disputeFeeCents(dispute);
  if (cents <= 0) return;
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const intentId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
  const COLS = 'id, stripe_account_id, landed_at, dispute_fee_entry_id';
  let op = chargeId ? (await supabaseAdmin.from('online_payments').select(COLS).eq('stripe_charge_id', chargeId).maybeSingle()).data : null;
  if (!op && intentId) op = (await supabaseAdmin.from('online_payments').select(COLS).eq('stripe_payment_intent_id', intentId).maybeSingle()).data;
  if (!op || op.stripe_account_id !== stripeAccountId || !op.landed_at || op.dispute_fee_entry_id) return;
  const { error } = await supabaseAdmin.rpc('online_payment_dispute_fee_book', { p_online_payment: op.id, p_fee: cents / 100 });
  if (error) throw new Error(error.message);
}

/** How far back the daily job reads each club's stand-alone Stripe fee lines (they arrive hours after the event). */
const STANDALONE_FEE_LOOKBACK_DAYS = 10;

/**
 * Stage 3, owner ruling (d): each club's stand-alone Stripe fee lines (no source; billed later) are recorded once and, when
 * exactly one payment of its kind sits near its day, booked on that payment's book. The rest stay recorded unmatched for
 * the bank check to name. Returns counts for the job's audit.
 */
export async function takeStandaloneStripeFees(): Promise<{ lines: number; booked: number; unmatched: number; retried: number; failed: number }> {
  const { data: accounts, error } = await supabaseAdmin.from('org_payment_accounts').select('org_id, stripe_account_id, livemode')
    .eq('fees_collector', 'stripe').is('disconnected_at', null);
  if (error) throw new Error(error.message);
  const gte = Math.floor(Date.now() / 1000) - STANDALONE_FEE_LOOKBACK_DAYS * 86_400;
  let lines = 0; let booked = 0; let unmatched = 0; let retried = 0; let failed = 0;
  // Hardening (owner 2026-11-18): one club's Stripe read, or one line's refusal, is counted and the rest go on.
  for (const a of accounts ?? []) {
    let fees: Stripe.BalanceTransaction[];
    try { fees = await listStripeFeeLines(a.stripe_account_id as string, gte); }
    catch (e) {
      failed++;
      console.error('[online-payment-landing] a club’s Stripe fee lines not read (the daily job retries):', a.org_id, e instanceof Error ? e.message : e);
      continue;
    }
    for (const bt of fees) {
      if (bt.source) continue; // a fee with a source belongs to its charge or dispute, booked there
      const { kind, day } = standaloneFeeOf(bt.description, bt.created);
      const { data: res, error: tErr } = await supabaseAdmin.rpc('online_payment_stripe_fee_line_take', {
        p_org: a.org_id, p_stripe_account: a.stripe_account_id, p_txn: bt.id, p_livemode: !!a.livemode, p_amount: bt.amount / 100,
        p_description: bt.description ?? '', p_created: new Date(bt.created * 1000).toISOString(), p_kind: kind, p_day: day,
      });
      if (tErr) {
        failed++;
        console.error('[online-payment-landing] a stand-alone Stripe fee not taken (the daily job retries):', bt.id, tErr.message);
        continue;
      }
      const r = res as { already?: boolean; retried?: boolean; matched?: boolean } | null;
      if (r?.already) continue;
      // A line tried again counts only when it is now booked; one still unmatched was counted the day it was first read.
      if (r?.retried) { if (r.matched) { retried++; booked++; } continue; }
      lines++;
      if (r?.matched) booked++; else unmatched++;
    }
  }
  return { lines, booked, unmatched, retried, failed };
}

/**
 * 12d-1 Part 4b: a card dispute lost while its payment was not in the record ("isn't in the record") took nothing back —
 * there was no line to take. Once the payment lands, each such dispute is re-read from Stripe and applied, so the loss is
 * taken back beside the receipt and the lost item is raised. Booked once (`online_payment_dispute_apply`); a no-op for
 * every payment that never had one. A payment the desk records by hand another way is not linked to it, so it stays the
 * desk's (the record shows the lost dispute).
 */
async function bookDisputesLostBeforeLanding(stripeAccountId: string, onlinePaymentId: string): Promise<void> {
  const { data: lost, error } = await supabaseAdmin.from('online_payment_disputes').select('stripe_dispute_id')
    .eq('online_payment_id', onlinePaymentId).eq('status', 'lost').is('lost_booked_at', null);
  if (error) throw new Error(error.message);
  if (!lost?.length) return;
  const { data: op } = await supabaseAdmin.from('online_payments').select('landed_at, stripe_charge_id, stripe_payment_intent_id')
    .eq('id', onlinePaymentId).maybeSingle();
  if (!op?.landed_at || (!op.stripe_charge_id && !op.stripe_payment_intent_id)) return;
  for (const d of lost) {
    await applyCardDispute(stripeAccountId, {
      id: d.stripe_dispute_id as string,
      charge: (op.stripe_charge_id as string | null) ?? '',
      payment_intent: (op.stripe_payment_intent_id as string | null) ?? null,
    });
  }
}

/**
 * "Payment received" for the organizer: the first time an online payment lands in the record, the people who run the
 * money get the same bell (and email, where their settings ask for it) a hand-recorded payment gives. A tournament tells
 * whoever the host's own rule tells (every member, staff scoped to their tournaments, the per-tournament switch honoured);
 * a house-league payment tells the registration desk. Never throws: the payment is already in the book and the family's
 * receipt is still to go, so a failed notice is logged, not retried (a replay answers `already` and never raises it again).
 */
async function tellPaymentReceived(op: OnlineRow): Promise<void> {
  try {
    const org = await orgById(op.org_id);
    if (!org) return;
    const amount = formatMoney(Number(op.total_amount));
    const bank = op.rail === 'bank_debit';
    if (op.flow === 'league_signup') {
      const userIds = await leagueRefundPeople(org);
      if (!userIds.length) return;
      await notify({
        orgId: org.id, userIds, eventType: 'payment_received',
        title: LW.receivedTitle, body: LW.receivedBody(op.description, amount, bank), link: recordHref(org, op),
      });
      return;
    }
    const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id).maybeSingle() : { data: null };
    const name = (team?.name as string | undefined) ?? op.description.split(' · ')[0];
    await notify({
      orgId: org.id, tournamentId: op.tournament_id ?? undefined, eventType: 'payment_received',
      title: W.receivedTitle(name), body: W.receivedBody(amount, bank), link: recordHref(org, op),
    });
  } catch (e) {
    console.error('[online-payment-landing] couldn’t tell the organizer a payment landed:', op.id, e instanceof Error ? e.message : String(e));
  }
}

/** At a landing the booking never fails the landing (/review 4b: a family's receipt check read "unknown", and Stripe
 *  retried the landing for days); the daily job's sweep books what it missed. */
function lostBookingFailed(e: unknown): void {
  console.error('[online-payment-landing] a dispute lost before landing wasn’t booked; the daily job retries:', e instanceof Error ? e.message : String(e));
}

/**
 * The daily job's sweep (12d-1 Part 4b): a card dispute lost before its payment landed, on a payment that has landed since,
 * whose booking at the landing failed. Bounded to payments landed in the last week (the landing books it; this only
 * catches a failure), so a loss that can never book is not re-read from Stripe for ever.
 */
export async function bookLostDisputesSweep(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin.from('online_payment_disputes')
    .select('online_payment_id, online_payments!inner(stripe_account_id, rail, landed_at)')
    .eq('status', 'lost').is('lost_booked_at', null)
    .eq('online_payments.rail', 'card').gte('online_payments.landed_at', since).limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{ online_payment_id: string; online_payments: { stripe_account_id: string } }>;
  let n = 0;
  for (const id of new Set(rows.map(r => r.online_payment_id))) {
    const acct = rows.find(r => r.online_payment_id === id)!.online_payments.stripe_account_id;
    try { await bookDisputesLostBeforeLanding(acct, id); n += 1; }
    catch (e) { lostBookingFailed(e); }
  }
  return n;
}

/**
 * THE HOUSE-LEAGUE LANDING (Stage 12b, §0e b): each child's fee goes through THE house-league writer
 * (`club_league_money`, inside `online_payment_league_land`) in ONE transaction, with no person behind it. Idempotent: a
 * replayed webhook or the receipt page's own re-read answers `already` and writes nothing. A child the writer refuses
 * (declined or marked received meanwhile) keeps the payment PAID and raises its own notice with the refund door; a
 * landing that throws as a whole keeps it paid and numbered (`online_payment_land_failed`, as the tournament's).
 */
async function landLeague(
  op: OnlineRow, paidAt: string, card: ReturnType<typeof cardOf>, mismatch: string | null,
): Promise<'landed' | 'already' | 'not_recorded'> {
  const { data: landed, error } = mismatch
    ? { data: null, error: { message: mismatch } }
    : await supabaseAdmin.rpc('online_payment_league_land', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand, p_last4: card.last4,
    });
  if (error) {
    // A passing conflict (a deadlock victim, a serialization or lock wait, a cancelled statement, the server busy) is
    // Stripe's to retry: throw, so the webhook answers 500 and the event is redelivered. Marked "not recorded" it would
    // be answered 200 and never landed (review 2026-10-25).
    if (isTransientDbError(error)) throw new Error(`House-league landing will retry: ${error.message}`);
    await supabaseAdmin.rpc('online_payment_land_failed', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand,
      p_last4: card.last4, p_error: error.message,
    });
    const org = await orgById(op.org_id);
    if (org) {
      await raiseOnce({
        org, userIds: await leagueRefundPeople(org), eventType: 'online_payment_not_recorded',
        subjectKey: 'onlinePaymentId', subjectId: op.id,
        title: op.rail === 'bank_debit' ? LW.unrecordedSignupTitleBank : LW.unrecordedSignupTitle,
        ...notRecordedNotice({ amount: formatMoney(Number(op.total_amount)), bank: op.rail === 'bank_debit', day: null, payer: null, forWhat: op.description, reason: error.message, team: false }),
        link: recordHref(org, op),
      });
    }
    await sendOnlineReceiptOnce(op.id);
    return 'not_recorded';
  }
  const result = landed as { already?: boolean; unrecorded?: unknown[] } | null;
  // Notices are read from the database (a replay included), so a crash between the commit and here loses none.
  await raiseLeagueUnrecorded(op);
  await stampPayerOnLines(op.id);
  await carryOutDecisions(op.id); // 12c Part 6
  if (result?.already) return 'already';
  await clearSettled({ orgIds: [op.org_id], kinds: ['online_payment_not_recorded'] });
  // A child left off the registrations has its own notice, which already says the money came; this one would contradict it.
  if (!result?.unrecorded?.length) await tellPaymentReceived(op);
  await sendOnlineReceiptOnce(op.id);
  await reconcileDashboardRefunds(op.stripe_account_id, op.id);
  return result?.unrecorded?.length ? 'not_recorded' : 'landed';
}

/** Postgres classes a retry can cure: 40 (transaction rollback: deadlock, serialization), 53 (insufficient resources),
 *  55P03 (lock not available), 57 (operator intervention: a cancelled statement, a restart). */
function isTransientDbError(error: { code?: string | null; message?: string }): boolean {
  const code = error.code ?? '';
  return /^(40|53|57)/.test(code) || code === '55P03';
}

// ── Paid twice (12d-1 Part 2, ask 10) ───────────────────────────────────────────────────────────

/** 12d-1: the card's country, written once after landing (outside the landing's write flag; mig 390 leaves it open). */
async function writeCardCountry(opId: string, card: ReturnType<typeof cardOf>): Promise<void> {
  if (!card.country) return;
  const { error } = await supabaseAdmin.from('online_payments').update({ card_country: card.country })
    .eq('id', opId).is('card_country', null);
  if (error) console.error('[online-payment-landing] couldn’t store the card’s country:', opId, error.message);
}

/**
 * The extra still standing on each team payment (`online_payment_over_left`, read live): 0 once it is refunded, a refund
 * is recorded another way, the entry is raised, or the club kept it. Read here only (the online-payments guard), for
 * the landing, the team's record and the item's rule.
 */
export async function overLeft(onlinePaymentIds: readonly string[]): Promise<Map<string, number>> {
  const ids = [...new Set(onlinePaymentIds)];
  if (!ids.length) return new Map();
  // The SQL shares the team's surplus out across its extras (mig 396), each capped by what of its own payment is still
  // received; a payment that no longer counts is answered here without the call.
  const { data: gone, error: goneError } = await supabaseAdmin.from('online_payments').select('id')
    .in('id', ids).in('status', ['refunded', 'reversed', 'returned']);
  if (goneError) throw new Error(goneError.message);
  const none = new Set((gone ?? []).map(g => g.id as string));
  const read = await Promise.all(ids.map(async id => {
    if (none.has(id)) return [id, 0] as const;
    const { data, error } = await supabaseAdmin.rpc('online_payment_over_left', { p_online_payment: id });
    if (error) throw new Error(error.message);
    return [id, Math.round(Number(data ?? 0) * 100)] as const;
  }));
  return new Map(read);
}

/** Whoever runs tournaments and the owner: who hears that a team paid past what it owed (words §2.2). */
async function overPeople(org: Organization): Promise<string[]> {
  const members = await activeMembers(org.id);
  return [...new Set(members.filter(m => canRefundOnline(m, org) || canConnectPayouts(m)).map(m => m.user_id))];
}

/** Where the item opens: the team's record, with the refund window set to the extra (`refund`). */
export function overHref(org: Pick<Organization, 'slug'>, op: { id: string; tournament_id: string | null; team_id: string | null }, refund = true): string {
  const q = new URLSearchParams({ tournamentId: op.tournament_id ?? '', ...(op.team_id ? { team: op.team_id } : {}), ...(refund ? { refund: op.id } : {}) });
  return `/${org.slug}/admin/tournaments/registrations?${q.toString()}`;
}

/**
 * Raise "paid twice" / "paid more than it owed" once, while the extra still stands. Called after every landing of a team
 * payment, a replay included: the row is the truth, and `raiseOnce` never doubles an open copy. Nothing when nothing was
 * extra, or the extra is already settled (the item's own rule clears a copy that is still up).
 */
export async function raiseOverpaid(onlinePaymentId: string): Promise<void> {
  // Never throws (/review 2026-10-27): it runs inside the landing, before steps a replay owes (the receipt, a clearing
  // answer, dashboard refunds). A failure here is logged; the item's rule and the next landing read the row again.
  try {
    await raiseOverpaidNow(onlinePaymentId);
  } catch (e) {
    console.error('[online-payment-landing] couldn’t raise the paid-twice item:', onlinePaymentId, e instanceof Error ? e.message : String(e));
  }
}

async function raiseOverpaidNow(onlinePaymentId: string): Promise<void> {
  const { data: op } = await supabaseAdmin.from('online_payments')
    .select('id, org_id, flow, team_id, tournament_id, total_amount, receipt_no, paid_on, rail, over_amount, over_whole, description')
    .eq('id', onlinePaymentId).maybeSingle();
  if (!op || op.flow !== 'tournament_team' || op.over_amount == null) return;
  const left = (await overLeft([op.id as string])).get(op.id as string) ?? 0;
  if (left <= 0) return;
  const org = await orgById(op.org_id as string);
  if (!org) return;
  const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id as string).maybeSingle() : { data: null };
  const name = (team?.name as string | undefined) ?? (op.description as string).split(' · ')[0];
  const extra = formatMoney(left / 100);
  const amount = formatMoney(Number(op.total_amount));
  const receipt = String(op.receipt_no ?? '');
  const day = op.paid_on ? formatStoredDate(op.paid_on as string, { withYear: false }) : '';
  const bank = op.rail === 'bank_debit';
  await raiseOnce({
    org, userIds: await overPeople(org), eventType: 'online_payment_over',
    subjectKey: 'onlinePaymentId', subjectId: op.id as string,
    title: op.over_whole ? OW.titleTwice(name, extra) : OW.titleMore(name, extra),
    ...OW.notice({ amount, receiptNo: receipt, day, extra, bank, whole: !!op.over_whole }),
    link: overHref(org, { id: op.id as string, tournament_id: (op.tournament_id as string | null) ?? null, team_id: (op.team_id as string | null) ?? null }),
  });
}

/**
 * "Keep it" (§7 ruling 5): the club keeps the extra, with a reason, as a NOTE: no credit, no money moved, no book line.
 * Only while some of it is still extra. The item clears for everyone it went to.
 */
export async function keepOverpayment(p: { onlinePaymentId: string; reason: string; actorId: string }): Promise<'kept' | 'nothing_extra' | 'refund_pending'> {
  const left = (await overLeft([p.onlinePaymentId])).get(p.onlinePaymentId) ?? 0;
  if (left <= 0) return 'nothing_extra';
  // A refund on its way may be taking the extra back: the club can't also keep it (/review 2026-10-27).
  const { count: pending } = await supabaseAdmin.from('online_payment_refunds').select('id', { count: 'exact', head: true })
    .eq('online_payment_id', p.onlinePaymentId).eq('status', 'pending');
  if ((pending ?? 0) > 0) return 'refund_pending';
  const { data, error } = await supabaseAdmin.from('online_payments')
    .update({ over_kept_reason: p.reason, over_kept_by: p.actorId, over_kept_at: new Date().toISOString() })
    .eq('id', p.onlinePaymentId).not('over_amount', 'is', null).is('over_kept_at', null).select('org_id').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return 'nothing_extra';
  await clearSettled({ orgIds: [data.org_id as string], kinds: ['online_payment_over'] });
  return 'kept';
}

/** A Checkout Session expired unpaid: the payment closes, so the team can open a new one. Bound to the account the event came
 *  from, like every sibling here: another connected account's event can never close this club's open payment. */
export async function expireCheckoutSession(sessionId: string, stripeAccountId: string): Promise<void> {
  await supabaseAdmin.from('online_payments').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId).eq('stripe_account_id', stripeAccountId).eq('status', 'open');
}

// ── A refund ────────────────────────────────────────────────────────────────────────────────────

type RefundOutcome = { state: 'succeeded' | 'pending' | 'failed'; refundId: string };

/** The returned-refund item's words for a team (12c words §1.6): which refund, to which card, whose team. */
async function teamRefundFailedWords(refundId: string, onlinePaymentId: string, sent: boolean): Promise<{ org_id: string; tournament_id: string | null; title: string; body: string; facts: NoticeFacts } | null> {
  const [{ data: op }, { data: r }] = await Promise.all([
    supabaseAdmin.from('online_payments').select('org_id, tournament_id, team_id, description, card_brand, card_last4, bank_last4, rail').eq('id', onlinePaymentId).maybeSingle(),
    supabaseAdmin.from('online_payment_refunds').select('amount').eq('id', refundId).maybeSingle(),
  ]);
  if (!op) return null;
  const { data: team } = op.team_id ? await supabaseAdmin.from('teams').select('name').eq('id', op.team_id as string).maybeSingle() : { data: null };
  const name = (team?.name as string | undefined) ?? (op.description as string).split(' · ')[0];
  const bank = op.rail === 'bank_debit';
  return {
    org_id: op.org_id as string, tournament_id: (op.tournament_id as string | null) ?? null,
    ...refundFailedNotice({
      amount: formatMoney(Number(r?.amount ?? 0)), bank, card: cardLabel(op.card_brand as string | null, op.card_last4 as string | null),
      bankLast4: (op.bank_last4 as string | null) ?? null, whose: { team: name }, sent,
    }),
  };
}

async function refundFailed(refundId: string, stripeRefundId: string | null, reason: string, onlinePaymentId: string): Promise<void> {
  await supabaseAdmin.rpc('online_payment_refund_failed', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_reason: reason });
  const data = await teamRefundFailedWords(refundId, onlinePaymentId, stripeRefundId != null);
  const org = data ? await orgById(data.org_id) : null;
  if (!org || !data) return;
  await raiseOnce({
    org, userIds: await refundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentId', subjectId: onlinePaymentId,
    title: data.title,
    body: data.body,
    facts: data.facts,
    link: data.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournamentId=${data.tournament_id}` : `/${org.slug}/admin`,
  });
}

async function landRefund(refundId: string, stripeRefundId: string | null): Promise<void> {
  const { data: landed, error } = await supabaseAdmin.rpc('online_payment_refund_land', { p_refund: refundId, p_stripe_refund: stripeRefundId });
  if (error) throw error;
  // One email per refund: only the first landing sends it (a repeat answers already).
  // Not for a refund made another way: that email would say the card was refunded.
  if (!(landed as { already?: boolean } | null)?.already && stripeRefundId) await sendRefundEmail(refundId);
  const { data } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_id, org_id').eq('id', refundId).maybeSingle();
  if (data) await clearSettled({ orgIds: [data.org_id as string], kinds: ['card_refund_failed', 'online_payment_not_recorded'] });
}

/**
 * Refund an online payment to the card, in full (12a, A12). The refund is opened in the database FIRST (one live refund
 * per payment), then asked of Stripe. FieldLogicHQ's fee is never refunded (§0c); with A2's box ticked, the club pays
 * the payer's fee back out of its own balance.
 */
export async function refundOnlinePayment(p: {
  onlinePaymentId: string; feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null; actorId: string;
}): Promise<RefundOutcome> {
  await refuseWhileDisputed(p.onlinePaymentId);
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: p.onlinePaymentId, p_fee_included: p.feeIncluded, p_reason: p.reason, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
  });
  if (error) throw new Error(error.message);
  const id = refundId as string;
  const [{ data: op }, { data: r }] = await Promise.all([
    supabaseAdmin.from('online_payments').select('stripe_account_id, stripe_payment_intent_id').eq('id', p.onlinePaymentId).single(),
    supabaseAdmin.from('online_payment_refunds').select('amount').eq('id', id).single(),
  ]);
  let refund: Stripe.Refund;
  try {
    refund = await refundToCard({
      accountId: op!.stripe_account_id as string,
      paymentIntentId: op!.stripe_payment_intent_id as string,
      amountCents: Math.round(Number(r!.amount) * 100),
      refundId: id,
      metadata: { online_payment_id: p.onlinePaymentId, refund_id: id },
    });
  } catch (e) {
    // A refusal is a failure; a lost connection is not — Stripe may have the refund, and its event will settle it.
    const type = (e as { type?: string } | null)?.type;
    if (type === 'StripeConnectionError' || type === 'StripeAPIError') return { state: 'pending', refundId: id };
    await refundFailed(id, null, e instanceof Error ? e.message : 'Stripe refused the refund', p.onlinePaymentId);
    return { state: 'failed', refundId: id };
  }
  await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id, stripe_created_at: stripeMoment(refund), updated_at: new Date().toISOString() }).eq('id', id);
  return applyStripeRefund(refund, id, p.onlinePaymentId);
}

/**
 * A team's PART refund to the card (12c, §0j 1–2): opened with its amount and reason (never the processing fee), asked of
 * Stripe, booked the moment Stripe accepts it — the payment row, the "Refunds" line and the team's lowered entry, so the
 * refund is never owed back — and the team's contact emailed once. A refusal changes nothing; a lost connection is pending
 * and its event books it.
 */
export async function refundTeamPart(p: {
  onlinePaymentId: string; amount: number; partialReason: string; note: string | null; actorId: string;
}): Promise<RefundOutcome> {
  await refuseWhileDisputed(p.onlinePaymentId);
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: p.onlinePaymentId, p_fee_included: false, p_reason: null, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
    p_item: null, p_amount: p.amount, p_partial_reason: p.partialReason,
  });
  if (error) throw new Error(error.message);
  const id = refundId as string;
  const { data: op } = await supabaseAdmin.from('online_payments').select('stripe_account_id, stripe_payment_intent_id').eq('id', p.onlinePaymentId).single();
  let refund: Stripe.Refund;
  try {
    refund = await refundToCard({
      accountId: op!.stripe_account_id as string, paymentIntentId: op!.stripe_payment_intent_id as string,
      amountCents: Math.round(p.amount * 100), refundId: id, metadata: { online_payment_id: p.onlinePaymentId, refund_id: id },
    });
  } catch (e) {
    const type = (e as { type?: string } | null)?.type;
    if (type === 'StripeConnectionError' || type === 'StripeAPIError') return { state: 'pending', refundId: id };
    await teamPartRefundFailed(id, null, e instanceof Error ? e.message : 'Stripe refused the refund', p.onlinePaymentId);
    return { state: 'failed', refundId: id };
  }
  await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id, stripe_created_at: stripeMoment(refund), updated_at: new Date().toISOString() }).eq('id', id);
  return applyStripeRefund(refund, id, p.onlinePaymentId);
}

// ── A house-league refund (Stage 12b Part 5, mig 375) ───────────────────────────────────────────

/** Stripe accepted (or finished) a house-league refund → its lines, once (`online_payment_league_refund_book`). */
async function bookLeagueRefund(refundId: string, stripeRefundId: string | null, succeeded: boolean): Promise<void> {
  const { error } = await supabaseAdmin.rpc('online_payment_league_refund_book', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_succeeded: succeeded });
  if (error) throw new Error(error.message);
  const { data } = await supabaseAdmin.from('online_payment_refunds').select('org_id').eq('id', refundId).maybeSingle();
  if (data) await clearSettled({ orgIds: [data.org_id as string], kinds: ['card_refund_failed', 'online_payment_not_recorded'] });
}

/** A booked house-league refund Stripe returned: the line stays (the club still owes it), the desk sends it another way. */
async function leagueRefundFailed(refundId: string, stripeRefundId: string | null, reason: string): Promise<void> {
  await supabaseAdmin.rpc('online_payment_refund_failed', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_reason: reason });
  const { data: r } = await supabaseAdmin.from('online_payment_refunds')
    .select('online_payment_id, online_payment_item_id, amount, booked_at').eq('id', refundId).maybeSingle();
  if (!r?.booked_at) return; // refused before it was booked: nothing changed, and the window said so
  const [{ data: op }, { data: item }] = await Promise.all([
    supabaseAdmin.from('online_payments').select('org_id, season_id, card_brand, card_last4, rail, bank_last4').eq('id', r.online_payment_id as string).maybeSingle(),
    supabaseAdmin.from('online_payment_items').select('description, registration_id').eq('id', r.online_payment_item_id as string).maybeSingle(),
  ]);
  const org = op ? await orgById(op.org_id as string) : null;
  if (!org || !op) return;
  const child = ((item?.description as string | undefined) ?? '').split(' · ')[0];
  await raiseOnce({
    org, userIds: await leagueRefundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentItemId', subjectId: r.online_payment_item_id as string,
    ...refundFailedNotice({
      amount: formatMoney(Number(r.amount)), bank: op.rail === 'bank_debit', card: cardLabel(op.card_brand as string | null, op.card_last4 as string | null),
      bankLast4: (op.bank_last4 as string | null) ?? null, whose: { child }, sent: stripeRefundId != null,
    }),
    link: recordHref(org, { tournament_id: null, season_id: (op.season_id as string | null) ?? null },
      { regId: (item?.registration_id as string | null) ?? null, at: 'card' }),
    extra: { refundId },
  });
}

/** `booked`: the refund's lines are in the season's book (Stripe accepted it). An unbooked refund is still in flight —
 *  the act that follows (an ending, a price) must wait (/review 2026-10-25). */
export type LeagueCardRefund = { state: 'succeeded' | 'pending' | 'failed'; refundId: string; amountCents: number; booked: boolean; message?: string };

/**
 * Refund one child's card payment, in full or in part (12b, L1; owner §0e: the fee share only on a full refund, with
 * A2's box, while the family paid it). Opened in the database FIRST (the payment's lock caps it at what is left), then
 * asked of Stripe, then BOOKED the moment Stripe accepts it — so the ending or the price correction that follows reads
 * the money already back. A refusal changes nothing; a lost connection is pending and its event books it.
 */
export async function refundLeagueToCard(p: {
  itemId: string; amount: number | null; feeIncluded: boolean; reason: 'club_ended' | 'family_left' | 'price_corrected' | null;
  partialReason: string | null; note: string | null; actorId: string;
}): Promise<LeagueCardRefund> {
  const { data: item } = await supabaseAdmin.from('online_payment_items').select('online_payment_id').eq('id', p.itemId).maybeSingle();
  if (!item) throw new Error('That card payment couldn’t be found.');
  const onlinePaymentId = item.online_payment_id as string;
  await refuseWhileDisputed(onlinePaymentId);
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: onlinePaymentId, p_fee_included: p.feeIncluded, p_reason: p.reason, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
    p_item: p.itemId, p_amount: p.amount, p_partial_reason: p.partialReason,
  });
  if (error) throw new Error(error.message);
  const id = refundId as string;
  const [{ data: op }, { data: r }] = await Promise.all([
    supabaseAdmin.from('online_payments').select('stripe_account_id, stripe_payment_intent_id').eq('id', onlinePaymentId).single(),
    supabaseAdmin.from('online_payment_refunds').select('amount').eq('id', id).single(),
  ]);
  const amountCents = Math.round(Number(r!.amount) * 100);
  let refund: Stripe.Refund;
  try {
    refund = await refundToCard({
      accountId: op!.stripe_account_id as string, paymentIntentId: op!.stripe_payment_intent_id as string,
      amountCents, refundId: id, metadata: { online_payment_id: onlinePaymentId, refund_id: id },
    });
  } catch (e) {
    const type = (e as { type?: string } | null)?.type;
    if (type === 'StripeConnectionError' || type === 'StripeAPIError') return { state: 'pending', refundId: id, amountCents, booked: false };
    const message = e instanceof Error ? e.message : 'Stripe refused the refund';
    await leagueRefundFailed(id, null, message);
    return { state: 'failed', refundId: id, amountCents, booked: false, message };
  }
  await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id, stripe_created_at: stripeMoment(refund), updated_at: new Date().toISOString() }).eq('id', id);
  if (refund.status === 'failed' || refund.status === 'canceled') {
    await leagueRefundFailed(id, refund.id, refund.failure_reason ?? refund.status);
    return { state: 'failed', refundId: id, amountCents, booked: false, message: refund.failure_reason ?? refund.status };
  }
  const state = refund.status === 'succeeded' ? 'succeeded' as const : 'pending' as const;
  try {
    await bookLeagueRefund(id, refund.id, refund.status === 'succeeded');
  } catch (e) {
    // Stripe has sent it; the book refused. Said to the desk (record it by hand), never swallowed (/review 2026-10-25).
    console.error('[online-payment-landing] a card refund could not be booked:', e instanceof Error ? e.message : String(e));
    return { state, refundId: id, amountCents, booked: false, message: `${formatMoney(amountCents / 100)} went back to the card, but it couldn’t go in the season’s book. Record the refund by hand.` };
  }
  return { state, refundId: id, amountCents, booked: true };
}

/** A house-league refund Stripe returned, sent another way by the club: the booked refund is marked done. */
export async function resolveLeagueRefundAnotherWay(refundId: string, actorId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('online_payment_league_refund_resolve', { p_refund: refundId, p_actor: actorId });
  if (error) throw new Error(error.message);
  const { data } = await supabaseAdmin.from('online_payment_refunds').select('org_id').eq('id', refundId).maybeSingle();
  if (data) await clearSettled({ orgIds: [data.org_id as string], kinds: ['card_refund_failed'] });
}

/**
 * The child's card shares still refundable, newest first (the ending window's "Refund to the card"; the price
 * correction). A share that never landed is the Needs-attention item's to refund, not the child's.
 */
export async function leagueCardShares(registrationId: string): Promise<Array<{
  itemId: string; leftCents: number; feeShareCents: number; untouched: boolean; familyPaidFee: boolean; brand: string | null; last4: string | null;
  /** 12c (review of the whole): a cleared bank debit refunds to the bank account. */
  rail: 'card' | 'bank_debit'; bankLast4: string | null;
}>> {
  const { data: items } = await supabaseAdmin.from('online_payment_items')
    .select('id, amount, fee_share, created_at, online_payments!inner(fee_payer, card_brand, card_last4, status, rail, bank_last4)')
    .eq('registration_id', registrationId).not('entry_id', 'is', null).order('created_at', { ascending: false });
  const rows = (items ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return [];
  const { data: refunds } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_item_id, amount, fee_refunded, status, booked_at')
    .in('online_payment_item_id', rows.map(i => i.id as string));
  const back = new Map<string, number>();
  for (const f of (refunds ?? []) as Array<{ online_payment_item_id: string; amount: number; fee_refunded: number; status: string; booked_at: string | null }>) {
    if (f.status !== 'pending' && f.status !== 'succeeded' && !f.booked_at) continue;
    back.set(f.online_payment_item_id, (back.get(f.online_payment_item_id) ?? 0) + Math.round((Number(f.amount) - Number(f.fee_refunded)) * 100));
  }
  type Op = { fee_payer: string; card_brand: string | null; card_last4: string | null; status: string; rail: string | null; bank_last4: string | null };
  const opOf = (i: Record<string, unknown>) => (Array.isArray(i.online_payments) ? i.online_payments[0] : i.online_payments) as Op;
  return rows
    // A debit the bank reversed after it cleared is already out of the book: nothing left to refund (review 2026-10-26).
    .filter(i => opOf(i).status !== 'reversed')
    .map(i => {
      const op = opOf(i);
      const amount = Math.round(Number(i.amount) * 100);
      const done = back.get(i.id as string) ?? 0;
      return {
        itemId: i.id as string, leftCents: amount - done, feeShareCents: Math.round(Number(i.fee_share) * 100), untouched: done === 0,
        familyPaidFee: op.fee_payer === 'family', brand: op.card_brand, last4: op.card_last4,
        rail: op.rail === 'bank_debit' ? 'bank_debit' as const : 'card' as const, bankLast4: op.bank_last4,
      };
    }).filter(s => s.leftCents > 0);
}

async function applyStripeRefund(refund: Stripe.Refund, refundId: string, onlinePaymentId: string): Promise<RefundOutcome> {
  // A house-league refund books when Stripe accepts it and only settles here (12b).
  const { data: flowRow } = await supabaseAdmin.from('online_payments').select('flow').eq('id', onlinePaymentId).maybeSingle();
  if (flowRow?.flow === 'league_signup') {
    if (refund.status === 'failed' || refund.status === 'canceled') {
      await leagueRefundFailed(refundId, refund.id, refund.failure_reason ?? refund.status);
      return { state: 'failed', refundId };
    }
    await bookLeagueRefund(refundId, refund.id, refund.status === 'succeeded');
    return { state: refund.status === 'succeeded' ? 'succeeded' : 'pending', refundId };
  }
  const { data: rRow } = await supabaseAdmin.from('online_payment_refunds').select('part_refund').eq('id', refundId).maybeSingle();
  if (rRow?.part_refund) {
    if (refund.status === 'failed' || refund.status === 'canceled') {
      await teamPartRefundFailed(refundId, refund.id, refund.failure_reason ?? refund.status, onlinePaymentId);
      return { state: 'failed', refundId };
    }
    await bookTeamRefund(refundId, refund.id, refund.status === 'succeeded');
    return { state: refund.status === 'succeeded' ? 'succeeded' : 'pending', refundId };
  }
  if (refund.status === 'succeeded') {
    await landRefund(refundId, refund.id);
    return { state: 'succeeded', refundId };
  }
  if (refund.status === 'failed' || refund.status === 'canceled') {
    await refundFailed(refundId, refund.id, refund.failure_reason ?? refund.status, onlinePaymentId);
    return { state: 'failed', refundId };
  }
  return { state: 'pending', refundId };
}

/** Stripe's own moment for a refund (the email's "On", 12c words §4). */
const stripeMoment = (refund: Stripe.Refund) => new Date(refund.created * 1000).toISOString();

/**
 * A team's part refund Stripe accepted (12c, mig 382): the payment row's refunded amount, the "Refunds" line and the team's
 * lowered entry — once (the booking answers the same on a replay). The team's contact is emailed once (claimed).
 */
async function bookTeamRefund(refundId: string, stripeRefundId: string | null, succeeded: boolean): Promise<void> {
  const { error } = await supabaseAdmin.rpc('online_payment_team_refund_book', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_succeeded: succeeded });
  if (error) throw new Error(error.message);
  const { data } = await supabaseAdmin.from('online_payment_refunds').select('org_id').eq('id', refundId).maybeSingle();
  if (data) await clearSettled({ orgIds: [data.org_id as string], kinds: ['card_refund_failed', 'online_payment_not_recorded'] });
  if (await claimRefundEmail(refundId)) await sendRefundEmail(refundId);
}

/** A team's booked part refund Stripe returned: its line and lowered entry stay (the club still owes it); the desk sends it
 *  another way (`online_payment_league_refund_resolve`, flow-blind). */
async function teamPartRefundFailed(refundId: string, stripeRefundId: string | null, reason: string, onlinePaymentId: string): Promise<void> {
  await supabaseAdmin.rpc('online_payment_refund_failed', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_reason: reason });
  const [{ data: r }, op] = await Promise.all([
    supabaseAdmin.from('online_payment_refunds').select('booked_at').eq('id', refundId).maybeSingle(),
    teamRefundFailedWords(refundId, onlinePaymentId, stripeRefundId != null),
  ]);
  if (!r?.booked_at || !op) return; // refused before it was booked: nothing changed, and the window said so
  const org = await orgById(op.org_id);
  if (!org) return;
  await raiseOnce({
    org, userIds: await refundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentId', subjectId: onlinePaymentId,
    title: op.title, body: op.body, facts: op.facts,
    link: op.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournamentId=${op.tournament_id}` : `/${org.slug}/admin`,
    extra: { refundId },
  });
}

type PayForRefund = {
  id: string; org_id: string; flow: OnlineFlow; status: string; total_amount: number; base_amount: number;
  fee_amount: number; fee_payer: string; stripe_account_id: string; description: string; tournament_id: string | null;
  season_id: string | null; landed_at: string | null; receipt_no: number | null; card_brand: string | null; card_last4: string | null;
  bank_last4: string | null; rail: string; stripe_payment_intent_id: string | null;
};
const PAY_FOR_REFUND = 'id, org_id, flow, status, total_amount, base_amount, fee_amount, fee_payer, stripe_account_id, description, tournament_id, season_id, landed_at, receipt_no, card_brand, card_last4, bank_last4, rail, stripe_payment_intent_id';
const toCents = (n: number) => Math.round(Number(n) * 100);

/**
 * A refund event from Stripe (refund.created / refund.updated / refund.failed, or charge.refunded). Ours lands, books or
 * fails — every row of it (a split refund made in Stripe is a row per child, one Stripe id). One made in the club's own
 * Stripe dashboard RECORDS ITSELF whenever it can be pinned (12c, plan §0g ruling 5, §0j ask 4); a person is asked only
 * "whose was it?" (a part refund on a payment for two or more children) or "what now?" (a child still enrolled). A refund on
 * a payment we haven't recorded yet waits ("matches no payment") and is recorded when the payment lands.
 */
export async function applyRefundEvent(stripeAccountId: string, refund: Stripe.Refund): Promise<void> {
  const intent = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id ?? null;
  if (!intent) return;
  const { data, error: opError } = await supabaseAdmin.from('online_payments').select(PAY_FOR_REFUND).eq('stripe_payment_intent_id', intent).maybeSingle();
  if (opError) throw new Error(opError.message); // not swallowed: Stripe redelivers the event
  const op = data as PayForRefund | null;
  if (!op) {
    // A sponsor's card payment not landed yet (Stage 6 fixes Part A, ask 4): no family-worded notice is raised (it also held
    // the one-open-copy key and hid the sponsor's). The event is NOT answered as done: Stripe sends it again, and once the
    // payment is on its deal (or stamped "not recorded") it is handled there, so a refund read the landing misses is never
    // the only chance. A read that fails here raises the notice as before: the sponsor's clears it once it is recorded.
    if (await isSponsorshipIntent(stripeAccountId, intent)) {
      throw new Error(`A sponsor's card payment is not recorded yet; Stripe sends its refund again: ${refund.id}`);
    }
    await raiseUnmatched(stripeAccountId, refund);
    return;
  }
  if (op.stripe_account_id !== stripeAccountId) return;
  // Part 3b: a sponsor's card refund lives in club_sponsor_deal_refunds, never online_payment_refunds.
  if (op.flow === 'sponsorship') { await applySponsorRefundEvent(op, refund); return; }
  // Ours carries our refund's id in its metadata (set when we asked Stripe), or Stripe's id once recorded. A refund made
  // in the club's own Stripe dashboard has neither and is never taken for one of ours.
  // The metadata is the club's to write (a dashboard refund can carry anything), and it goes into a filter string: only a
  // real id is used (review 2026-10-26: a value like "x,id.neq.0" widened the filter to every refund on the payment).
  const metaId = refund.metadata?.refund_id;
  const ourId = typeof metaId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(metaId) ? metaId : null;
  const { data: ours } = await supabaseAdmin.from('online_payment_refunds')
    .select('id, status').eq('online_payment_id', op.id)
    .or(ourId ? `id.eq.${ourId},stripe_refund_id.eq.${refund.id}` : `stripe_refund_id.eq.${refund.id}`);
  const rows = (ours ?? []) as Array<{ id: string; status: string }>;
  if (rows.length) {
    for (const row of rows) {
      if (row.status !== 'pending') continue;
      await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id }).eq('id', row.id).is('stripe_refund_id', null);
      await applyStripeRefund(refund, row.id, op.id);
    }
    return;
  }
  // A refund made in Stripe that failed or was cancelled moved no money: nothing to record. One that was already waiting
  // for "whose was it?" comes off the list, or it would sit there to be booked later (review 2026-10-26).
  if (refund.status !== 'succeeded' && refund.status !== 'pending') {
    await supabaseAdmin.from('online_refunds_unassigned').delete().eq('stripe_refund_id', refund.id).is('assigned_at', null);
    return;
  }
  const { data: waiting } = await supabaseAdmin.from('online_refunds_unassigned').select('id').eq('stripe_refund_id', refund.id).maybeSingle();
  if (waiting) return; // already waiting for "whose was it?"
  if (op.flow === 'league_signup') await recordLeagueDashboardRefund(op, refund);
  else await recordTeamDashboardRefund(op, refund);
}

/** A payment just landed: any refund made in Stripe before it did is recorded on it now (events out of order). */
export async function reconcileDashboardRefunds(stripeAccountId: string, onlinePaymentId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('online_payments').select('stripe_payment_intent_id, flow').eq('id', onlinePaymentId).maybeSingle();
  const intent = (data?.stripe_payment_intent_id as string | null) ?? null;
  if (!intent) return;
  const refunds = await listRefunds(stripeAccountId, intent).catch(() => [] as Stripe.Refund[]);
  // A sponsor's: oldest first (Stripe lists newest first), since the sponsorship goes back first and the fee last (mig 542).
  const inOrder = data?.flow === 'sponsorship' ? [...refunds].sort((a, b) => a.created - b.created) : refunds;
  for (const r of inOrder) await applyRefundEvent(stripeAccountId, r);
  const { data: org } = await supabaseAdmin.from('online_payments').select('org_id').eq('id', onlinePaymentId).maybeSingle();
  if (refunds.length && org) await clearSettled({ orgIds: [org.org_id as string], kinds: ['card_refund_unmatched'] });
}

/** "A refund in Stripe matches no payment we recorded" (words §5): to both desks, since the flow can't be told yet. */
async function raiseUnmatched(stripeAccountId: string, refund: Stripe.Refund): Promise<void> {
  if (refund.status !== 'succeeded' && refund.status !== 'pending') return;
  const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('org_id').eq('stripe_account_id', stripeAccountId).maybeSingle();
  const org = acct ? await orgById(acct.org_id as string) : null;
  if (!org) return;
  // Whoever opens Sponsorships hears it too: a refund made in the dashboard before a sponsor's card payment landed has no payment to name yet.
  const people = [...new Set([...(await leagueRefundPeople(org)), ...(await refundPeople(org)), ...(await sponsorshipPeople(org))])];
  await raiseOnce({
    org, userIds: people, eventType: 'card_refund_unmatched', subjectKey: 'unmatchedStripeRefundId', subjectId: refund.id,
    title: LW.noMatchTitle, body: LW.noMatchBody(formatMoney(refund.amount / 100), formatStoredDate(stripeMoment(refund), { withYear: false })),
    link: payoutsHref(org),
  });
}

/** Is this refund's payment a sponsor's card payment we opened and have not yet written Stripe's payment on (its checkout's
 *  metadata names a sponsorship payment of ours)? One that already carries another payment's id is nothing to wait for. */
async function isSponsorshipIntent(stripeAccountId: string, intent: string): Promise<boolean> {
  try {
    const meta = await retrievePaymentIntentMetadata(stripeAccountId, intent);
    // The metadata is the club's to edit in its dashboard: only a real id, and only one that is a sponsorship payment ON THIS ACCOUNT.
    if (!isUuid(meta.online_payment_id)) return false;
    const { data } = await supabaseAdmin.from('online_payments').select('flow, stripe_account_id, stripe_payment_intent_id').eq('id', meta.online_payment_id).maybeSingle();
    return data?.flow === 'sponsorship' && data.stripe_account_id === stripeAccountId && !data.stripe_payment_intent_id;
  } catch {
    return false;
  }
}

type ItemForRefund = { id: string; registration_id: string | null; amount: number; fee_share: number; entry_id: string | null; description: string };

/**
 * A house-league refund made in Stripe (12c, §0g ruling 5). Pinned on one child — any amount on a one-child payment, or
 * the whole of what is left of a payment — it is recorded and booked at once: a refund counts against the fee first, and
 * anything above it is the processing fee given back. A part refund on a payment for two or more children waits for
 * "whose was it?". A child still enrolled whose fee went back raises "what now?" and the family's email waits for it;
 * otherwise the family is emailed now (ruling 6: Stripe accepted it).
 */
async function recordLeagueDashboardRefund(op: PayForRefund, refund: Stripe.Refund): Promise<void> {
  const org = await orgById(op.org_id);
  if (!org) return;
  const { data: its } = await supabaseAdmin.from('online_payment_items')
    .select('id, registration_id, amount, fee_share, entry_id, description').eq('online_payment_id', op.id).order('created_at').order('id');
  const items = (its ?? []) as ItemForRefund[];
  const { data: back } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_item_id, amount, fee_refunded, status, booked_at')
    .eq('online_payment_id', op.id);
  const used = new Map<string, number>();
  for (const f of (back ?? []) as Array<{ online_payment_item_id: string | null; amount: number; fee_refunded: number; status: string; booked_at: string | null }>) {
    if (!f.online_payment_item_id || (f.status !== 'pending' && f.status !== 'succeeded' && !f.booked_at)) continue;
    used.set(f.online_payment_item_id, (used.get(f.online_payment_item_id) ?? 0) + toCents(f.amount) - toCents(f.fee_refunded));
  }
  const familyFee = op.fee_payer === 'family';
  const shares = items.map(i => {
    const done = used.get(i.id) ?? 0;
    return { item: i, left: toCents(i.amount) - done, fee: familyFee && done === 0 ? toCents(i.fee_share) : 0 };
  }).filter(x => x.left > 0);
  const x = refund.amount;
  const pin = pinLeagueRefund(shares.map(sh => ({ itemId: sh.item.id, leftCents: sh.left, feeCents: sh.fee })), x);
  if (pin.kind === 'whose') {
    // "Whose was it?" — held out of the book until a person answers.
    const { data: held, error } = await supabaseAdmin.from('online_refunds_unassigned')
      .insert({ org_id: op.org_id, online_payment_id: op.id, stripe_refund_id: refund.id, amount: x / 100, stripe_created_at: stripeMoment(refund) })
      .select('id').maybeSingle();
    if (error || !held) return; // a replay met the one-per-refund key
    const regIds = shares.map(sh => sh.item.registration_id).filter((v): v is string => !!v);
    const { data: regs } = await supabaseAdmin.from('league_registrations')
      .select('id, player_first_name, guardian_first_name, guardian_last_name').in('id', regIds);
    const regRows = (regs ?? []) as Array<{ id: string; player_first_name: string; guardian_first_name: string | null; guardian_last_name: string | null }>;
    const g = regRows[0];
    const guardian = g && (g.guardian_first_name || g.guardian_last_name) ? [g.guardian_first_name, g.guardian_last_name].filter(Boolean).join(' ') : null;
    await raiseOnce({
      org, userIds: await leagueRefundPeople(org), eventType: 'card_refund_whose', subjectKey: 'unassignedRefundId', subjectId: held.id as string,
      title: LW.whoseTitle(formatMoney(x / 100), guardian),
      ...LW.whose({ children: regRows.map(r => r.player_first_name), total: formatMoney(Number(op.total_amount)), receiptNo: String(op.receipt_no ?? '') }),
      link: `/${org.slug}/admin/house-league/seasons/${op.season_id}/registrations?whose=${held.id as string}`,
      // Never onlinePaymentId: the one-open key reads it first, and a second refund on this payment is its own question.
      extra: { stripeRefundId: refund.id },
    });
    return;
  }
  if (pin.kind !== 'record') { await raiseUnmatched(op.stripe_account_id, refund); return; }
  await recordLeagueRefundRows(org, op, refund.id, stripeMoment(refund), refund.status === 'succeeded', pin.plan, null, null);
}

/**
 * Record and book a refund Stripe already made, one row per child (a dashboard refund pinned on its own, or "whose was
 * it?" answered), then tell the family — or, for a child still enrolled whose fee went back, ask the desk first.
 */
export async function recordLeagueRefundRows(
  org: Organization, op: Pick<PayForRefund, 'id' | 'org_id' | 'season_id' | 'card_brand' | 'card_last4' | 'bank_last4' | 'rail'>,
  stripeRefundId: string, stripeCreatedAt: string, succeeded: boolean,
  plan: Array<{ itemId: string; base: number; fee: number }>, reason: string | null, actorId: string | null,
): Promise<{ ids: string[]; emailed: boolean }> {
  const ids: string[] = [];
  for (const row of plan) {
    const { data: id, error } = await supabaseAdmin.rpc('online_payment_refund_record_dashboard', {
      p_online_payment: op.id, p_item: row.itemId, p_base: row.base / 100, p_fee: row.fee / 100, p_stripe_refund: stripeRefundId,
      p_stripe_created: stripeCreatedAt, p_partial_reason: reason, p_actor: actorId,
    });
    if (error) throw new Error(error.message);
    await bookLeagueRefund(id as string, stripeRefundId, succeeded);
    ids.push(id as string);
  }
  // Who is still enrolled with a fee that went back: "what now?" — their email waits for the answer.
  const { data: rows } = await supabaseAdmin.from('online_payment_refunds')
    .select('id, amount, fee_refunded, created_at, stripe_created_at, online_payment_items!inner(registration_id, entry_id)').in('id', ids);
  const regIds = ((rows ?? []) as Array<Record<string, unknown>>).map(r => {
    const it = (Array.isArray(r.online_payment_items) ? r.online_payment_items[0] : r.online_payment_items) as { registration_id: string | null };
    return it.registration_id;
  }).filter((v): v is string => !!v);
  const { data: regs } = regIds.length
    ? await supabaseAdmin.from('league_registrations').select('id, status, player_first_name, player_last_name').in('id', regIds)
    : { data: [] };
  const regById = new Map(((regs ?? []) as Array<{ id: string; status: string; player_first_name: string; player_last_name: string }>).map(g => [g.id, g]));
  const toEmail: string[] = [];
  const people = await leagueRefundPeople(org);
  for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
    const it = (Array.isArray(r.online_payment_items) ? r.online_payment_items[0] : r.online_payment_items) as { registration_id: string | null; entry_id: string | null };
    const g = it.registration_id ? regById.get(it.registration_id) : undefined;
    const enrolled = !!g && !!it.entry_id && (g.status === 'active' || g.status === 'pending_review' || g.status === 'waitlisted');
    if (!enrolled) { toEmail.push(r.id as string); continue; }
    const base = Number(r.amount) - Number(r.fee_refunded);
    const card = op.rail === 'bank_debit' ? (op.bank_last4 ? `the account ending ${op.bank_last4}` : 'the bank account') : cardLabel(op.card_brand, op.card_last4);
    const at = (r.stripe_created_at as string | null) ?? (r.created_at as string);
    await raiseOnce({
      org, userIds: people, eventType: 'card_refund_still_enrolled', subjectKey: 'enrolledRefundId', subjectId: r.id as string,
      title: LW.enrolledTitle(`${g!.player_first_name} ${g!.player_last_name}`, g!.player_first_name),
      ...LW.enrolled({ amount: formatMoney(Number(r.amount)), to: card, day: formatStoredDate(at, { withYear: false }), childFirst: g!.player_first_name, owing: formatMoney(base) }),
      link: recordHref(org, { tournament_id: null, season_id: op.season_id }, { regId: g!.id, at: 'card' }),
      extra: { registrationId: g!.id, childFirst: g!.player_first_name },
    });
  }
  if (toEmail.length) await sendLeagueRefundEmail(toEmail, { kind: 'stripe' });
  await clearSettled({ orgIds: [op.org_id], kinds: ['online_payment_not_recorded', 'card_refund_whose', 'card_refund_unmatched'] });
  return { ids, emailed: toEmail.length === ids.length };
}

/**
 * A tournament team's refund made in Stripe (12c, §0j ask 4). The whole payment lands through 12a's full path; a PART
 * records itself as a part refund — booked at once, lowering the team's entry by the same amount ("made in Stripe").
 */
async function recordTeamDashboardRefund(op: PayForRefund, refund: Stripe.Refund): Promise<void> {
  if (op.status !== 'paid' && op.status !== 'partly_refunded') return;
  const { data: back } = await supabaseAdmin.from('online_payment_refunds').select('amount, fee_refunded, status, booked_at').eq('online_payment_id', op.id);
  let used = 0;
  for (const f of (back ?? []) as Array<{ amount: number; fee_refunded: number; status: string; booked_at: string | null }>) {
    if (f.status === 'pending' || f.status === 'succeeded' || f.booked_at) used += toCents(f.amount) - toCents(f.fee_refunded);
  }
  const pin = pinTeamRefund({ baseCents: toCents(op.base_amount), wholeCents: toCents(op.total_amount), usedCents: used, landed: !!op.landed_at }, refund.amount);
  if (pin.kind === 'whole') {
    if (refund.status !== 'succeeded') return; // 12a's full refund lands when Stripe finishes it (its next event)
    const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
      p_online_payment: op.id, p_fee_included: true, p_reason: null, p_note: null, p_actor: null, p_origin: 'stripe_dashboard',
    });
    if (error) return; // a refund of ours opened in between: its own event lands it
    await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id, stripe_created_at: stripeMoment(refund) }).eq('id', refundId as string);
    await landRefund(refundId as string, refund.id);
    return;
  }
  if (pin.kind !== 'part') { await raiseUnmatched(op.stripe_account_id, refund); return; }
  const { data: id, error } = await supabaseAdmin.rpc('online_payment_refund_record_dashboard', {
    p_online_payment: op.id, p_item: null, p_base: pin.base / 100, p_fee: 0, p_stripe_refund: refund.id,
    p_stripe_created: stripeMoment(refund), p_partial_reason: null, p_actor: null,
  });
  if (error) throw new Error(error.message);
  await bookTeamRefund(id as string, refund.id, refund.status === 'succeeded');
}

/**
 * The club sent the money back another way after a refund to the card was returned (the "card_refund_failed" item's way
 * out): the refund is recorded with no Stripe refund behind it, so the team's paid figure falls and the book reads
 * "Refunded another way". The same refund window's answers decide the fee (A2).
 */
export async function recordRefundAnotherWay(p: {
  onlinePaymentId: string; feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null; actorId: string;
}): Promise<RefundOutcome> {
  await refuseWhileDisputed(p.onlinePaymentId);
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: p.onlinePaymentId, p_fee_included: p.feeIncluded, p_reason: p.reason, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
  });
  if (error) throw new Error(error.message);
  await landRefund(refundId as string, null);
  return { state: 'succeeded', refundId: refundId as string };
}

// ── A sponsor's card payment (Board Ready Stage 6 Part 3b, mig 530) ───────────────────────────────────

const dealHref = (org: Organization, dealId: string | null): string =>
  (dealId ? `/${org.slug}/admin/sponsorships/${dealId}` : `/${org.slug}/admin/sponsorships`);

/** Whoever opens Sponsorships (`opensSponsorships`): who hears that a sponsor's card payment or refund needs a hand. */
async function sponsorshipPeople(org: Organization): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('id, user_id, role, capabilities')
    .eq('organization_id', org.id).eq('status', 'active');
  if (error) throw error;
  const rows = ((data ?? []) as (MemberRow & { id: string })[]).filter(m => m.user_id);
  const { data: scoped } = rows.length
    ? await supabaseAdmin.from('org_member_rep_group_scopes').select('member_id').in('member_id', rows.map(m => m.id))
    : { data: [] as { member_id: string }[] };
  const limited = new Set(((scoped ?? []) as { member_id: string }[]).map(x => x.member_id));
  return [...new Set(rows.filter(m => opensSponsorships({
    role: m.role, capabilities: m.capabilities, limited: !GROUP_UNSCOPED_ROLES.includes(m.role) && limited.has(m.id),
  }, org)).map(m => m.user_id))];
}

/**
 * Land a sponsor's card payment (`club_sponsor_card_land`): the invoice when this payment issues it, the deal payment with its
 * lines, Paid. Then the place goes up and the "Paid in full" receipt goes, once (`afterSponsorLanding`), and Stripe's fee is
 * stored. A deal that can't take it (withdrawn, invoiced another way, paid already) is stamped "not recorded" and said to
 * whoever opens Sponsorships: the money is in the club's Stripe balance, to refund there.
 */
async function landSponsorship(op: OnlineRow, paidAt: string, card: ReturnType<typeof cardOf>, mismatch: string | null, session: Stripe.Checkout.Session): Promise<'landed' | 'already' | 'not_recorded'> {
  const { data, error } = mismatch
    ? { data: null, error: { message: mismatch } }
    : await supabaseAdmin.rpc('club_sponsor_card_land', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand, p_last4: card.last4,
    });
  if (error) {
    if (isTransientDbError(error)) throw new Error(`Sponsorship payment landing will retry: ${error.message}`);
    await supabaseAdmin.rpc('online_payment_land_failed', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand,
      p_last4: card.last4, p_error: error.message,
    });
    const org = await orgById(op.org_id);
    if (org) {
      const { data: row } = await supabaseAdmin.from('online_payments').select('sponsor_deal_id').eq('id', op.id).maybeSingle();
      await raiseOnce({
        org, userIds: await sponsorshipPeople(org), eventType: 'online_payment_not_recorded',
        subjectKey: 'onlinePaymentId', subjectId: op.id,
        title: DEAL_WORDS.card.notRecordedTitle,
        ...notRecordedNotice({ amount: formatMoney(Number(op.total_amount)), bank: false, day: null, payer: null, forWhat: op.description, reason: error.message, team: false }),
        link: dealHref(org, (row?.sponsor_deal_id as string | null) ?? null),
      });
    }
    return 'not_recorded';
  }
  const landed = data as { already: boolean };
  await afterSponsorLanding(op.id);
  await recordStripeFee(op.id, session);
  // A refund made in the club's Stripe dashboard before this payment landed is looked at now, as the team and league landings do.
  if (!landed.already) await reconcileDashboardRefunds(op.stripe_account_id, op.id).catch(e => console.error('[online-payment-landing] a sponsor payment landed, but the refunds made in Stripe before it were not read:', op.id, e instanceof Error ? e.message : String(e)));
  return landed.already ? 'already' : 'landed';
}

/** After a sponsor's card payment landed: the place (and its logo) up, then the "Paid in full" receipt — claimed first, so the
 *  webhook and the page's own check never send two; a send that didn't go releases the claim. Never throws: the money stands. */
async function afterSponsorLanding(onlinePaymentId: string): Promise<void> {
  try {
    const { data: op } = await supabaseAdmin.from('online_payments').select('org_id, sponsor_deal_id, landed_at').eq('id', onlinePaymentId).maybeSingle();
    const dealId = (op?.sponsor_deal_id as string | null) ?? null;
    if (!op?.landed_at || !dealId) return;
    const orgId = op.org_id as string;
    await syncDealPlace(orgId, dealId).catch(e => console.error('[online-payment-landing] a sponsor’s card payment landed, but its place did not sync:', dealId, e instanceof Error ? e.message : String(e)));
    const { data: claimed } = await supabaseAdmin.from('club_sponsor_deals').update({ receipt_emailed_at: new Date().toISOString() })
      .eq('id', dealId).eq('state', 'paid').is('receipt_emailed_at', null).select('id');
    if (!claimed?.length) return;
    const org = await orgById(orgId);
    const sent = org ? await emailDealInvoice(orgId, org.slug, dealId, 'paid') : false;
    if (!sent) await supabaseAdmin.from('club_sponsor_deals').update({ receipt_emailed_at: null }).eq('id', dealId);
  } catch (e) {
    console.error('[online-payment-landing] the steps after a sponsor’s card payment did not finish:', onlinePaymentId, e instanceof Error ? e.message : String(e));
  }
}

/** An answer Stripe GAVE (a refusal), as opposed to a lost connection or a timeout that may still have made the refund. */
const stripeRefused = (e: unknown): boolean =>
  ['StripeInvalidRequestError', 'StripeCardError', 'StripePermissionError'].includes((e as { type?: string } | null)?.type ?? '');

/** Fail a sponsor refund Stripe refused (nothing was booked): the one place the database is told. Answers the reason. */
async function failSponsorRefund(refundId: string, e: unknown): Promise<string> {
  const message = e instanceof Error ? e.message : 'Stripe refused the refund';
  const { error } = await supabaseAdmin.rpc('club_sponsor_card_refund_failed', { p_refund: refundId, p_stripe_refund: null, p_reason: message });
  // A refund the database did not mark failed is still pending (the sweep asks again): never say "failed" over a lost write.
  if (error) throw new Error(error.message);
  return message;
}

/** Why a sponsor's card refund was refused before Stripe was asked (the window says each in words). */
export type SponsorRefundRefusal = 'nothing_left' | 'amount' | 'not_card' | 'reason' | 'disputed';

export type SponsorRefund =
  | { ok: true; state: 'succeeded' | 'pending' | 'failed'; refundId: string; amount: number; endsDeal: boolean; emailedTo: string | null; message?: string }
  | { ok: false; why: SponsorRefundRefusal };

/**
 * Refund a sponsor's card payment, all of what is left or part of it, never the fee (the card-refund drawing's tab 2, RULED
 * 2026-11-23). Opened in the database FIRST (the payment's lock caps it at what is left and works out its tax share), then
 * asked of Stripe; BOOKED when Stripe says it succeeded — its two lines, the credit note's number on a taxed invoice, and the
 * deal Withdrawn when it gave back the last of the deal's money (ask 3) — then the place syncs and the business is emailed.
 * A refusal changes nothing; a lost connection or a refund Stripe holds is pending, and its event books it.
 */
export async function refundSponsorCard(p: {
  orgId: string; paymentId: string; amount: number | null; reason: string; actorId: string; actorName: string;
}): Promise<SponsorRefund> {
  // No refund while the sponsor's bank is disputing the charge: Stripe has already taken the money back, and a refund on top
  // would pay it twice (the team and league refunds' rule). Stripe is asked, not the dispute row: an open dispute may be older
  // than our last event, and a read that fails refuses — closed, never open (/review 2026-10-27). A LOST one is refused by the
  // database (mig 532).
  const { data: pay } = await supabaseAdmin.from('club_sponsor_deal_payments')
    .select('online_payments(stripe_account_id, stripe_payment_intent_id)').eq('id', p.paymentId).eq('org_id', p.orgId).maybeSingle();
  const online = (Array.isArray(pay?.online_payments) ? pay?.online_payments[0] : pay?.online_payments) as { stripe_account_id: string; stripe_payment_intent_id: string | null } | null | undefined;
  if (online?.stripe_payment_intent_id && refundBlockedByDispute(await listDisputes(online.stripe_account_id, online.stripe_payment_intent_id))) {
    return { ok: false, why: 'disputed' };
  }
  const { data, error } = await supabaseAdmin.rpc('club_sponsor_card_refund_open', {
    p_org: p.orgId, p_payment: p.paymentId, p_amount: p.amount, p_reason: p.reason, p_actor: p.actorId, p_actor_name: p.actorName,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    const msg = (error as { message?: string }).message ?? '';
    if (code === 'SP002') return { ok: false, why: msg.includes('nothing_left') ? 'nothing_left' : msg.includes('disputed') ? 'disputed' : 'not_card' };
    if (code === 'SP003') return { ok: false, why: msg.includes('reason') ? 'reason' : 'amount' };
    throw new Error(msg);
  }
  const o = data as { refundId: string; amount: number; endsDeal: boolean; dealId: string; onlinePaymentId: string; stripeAccountId: string; paymentIntent: string };
  const amount = Number(o.amount);
  const base = { ok: true as const, refundId: o.refundId, amount, endsDeal: o.endsDeal };
  let refund: Stripe.Refund;
  try {
    refund = await refundToCard({
      accountId: o.stripeAccountId, paymentIntentId: o.paymentIntent, amountCents: Math.round(amount * 100), refundId: o.refundId,
      metadata: { online_payment_id: o.onlinePaymentId, refund_id: o.refundId },
    });
  } catch (e) {
    // Only an answer Stripe GAVE is a failure. Anything else (a lost connection, a timeout, an error we did not expect) may
    // have reached Stripe and created the refund, so it stays pending: a later event, or the sweep, settles it.
    if (!stripeRefused(e)) return { ...base, state: 'pending', emailedTo: null };
    return { ...base, state: 'failed', emailedTo: null, message: await failSponsorRefund(o.refundId, e) };
  }
  const outcome = await settleSponsorRefund(p.orgId, o.refundId, refund);
  return { ...base, state: outcome.state, emailedTo: outcome.emailedTo };
}

/** A deal's place on the club's site follows the deal's state; a failed sync is logged and never stops the money step that asked for it. */
async function syncSponsorPlace(orgId: string, dealId: string | null): Promise<void> {
  if (!dealId) return;
  await syncDealPlace(orgId, dealId).catch(e => console.error('[online-payment-landing] a sponsor deal changed state, but its place did not sync:', dealId, e instanceof Error ? e.message : String(e)));
}

/** Stripe's answer on one of our sponsor refunds: book it (succeeded), fail it, or keep it pending with Stripe's id. */
async function settleSponsorRefund(orgId: string, refundId: string, refund: Stripe.Refund): Promise<{ state: 'succeeded' | 'pending' | 'failed'; emailedTo: string | null }> {
  if (refund.status === 'failed' || refund.status === 'canceled') {
    const { data, error } = await supabaseAdmin.rpc('club_sponsor_card_refund_failed', { p_refund: refundId, p_stripe_refund: refund.id, p_reason: refund.failure_reason ?? refund.status });
    if (error) throw new Error(error.message); // not swallowed: Stripe redelivers the event, and the lines stay posted until this lands
    const r = data as { already: boolean; wasBooked: boolean; dealId: string } | null;
    if (r?.wasBooked) {
      // The deal may have gone back to Paid (a payment revived) or stay ended: its place on the club's site follows the deal.
      await syncSponsorPlace(orgId, r.dealId);
      // Both are done from the failed state every time Stripe says it again, each once only on its own record (the notice
      // once per refund; the business's email on its own stamp), so one lost to a crash after the database committed, or a
      // send that failed, is done on the replay. The business is told its credit note is cancelled; the email goes whether
      // or not the club's notice could be raised.
      try { await raiseSponsorRefundFailed(refundId); } finally { await emailDealRefundCancelled(orgId, r.dealId, refundId); }
    }
    return { state: 'failed', emailedTo: null };
  }
  if (refund.status !== 'succeeded') {
    await supabaseAdmin.from('club_sponsor_deal_refunds').update({ stripe_refund_id: refund.id }).eq('id', refundId).is('stripe_refund_id', null);
    return { state: 'pending', emailedTo: null };
  }
  const { data, error } = await supabaseAdmin.rpc('club_sponsor_card_refund_book', { p_refund: refundId, p_stripe_refund: refund.id });
  if (error) throw new Error(error.message);
  const b = data as { already: boolean; dealId: string; endsDeal: boolean; owingAgain?: boolean };
  // A refund that ended the deal, or put it back to owing (a payment given back beside a cheque), takes its place down.
  if (b.endsDeal || b.owingAgain) await syncSponsorPlace(orgId, b.dealId);
  const emailedTo = await emailDealRefund(orgId, refundId);
  return { state: 'succeeded', emailedTo };
}

/** A refund event from Stripe on a sponsor's card payment: one of ours (made from the deal) settles; one made in the club's
 *  Stripe dashboard is recorded on the deal by itself (mig 542, Stage 6 fixes Part A): `recordStripeSponsorRefund`. */
async function applySponsorRefundEvent(op: PayForRefund, refund: Stripe.Refund): Promise<void> {
  const metaId = refund.metadata?.refund_id;
  const ourId = isUuid(metaId) ? metaId : null;
  // Only the app's own refunds settle here. A refund made in Stripe carries Stripe's id too once recorded, and is never ours:
  // the retry and the settle must never ask Stripe about it (they would refund it a second time).
  const { data: ours, error: oursError } = await supabaseAdmin.from('club_sponsor_deal_refunds').select('id, status, stripe_refund_id').eq('online_payment_id', op.id).eq('origin', 'app')
    .or(ourId ? `id.eq.${ourId},stripe_refund_id.eq.${refund.id}` : `stripe_refund_id.eq.${refund.id}`);
  // Not swallowed: read as "none of ours", the app's own refund would be recorded a second time as one made in Stripe.
  if (oursError) throw new Error(oursError.message);
  // The metadata is the club's to edit: an app row already tied to another Stripe refund is not this one.
  const rows = ((ours ?? []) as { id: string; status: string; stripe_refund_id: string | null }[])
    .filter(r => !r.stripe_refund_id || r.stripe_refund_id === refund.id);
  if (rows.length) {
    for (const r of rows) {
      // A succeeded one only changes when Stripe later says it failed ("Refund didn't reach the card").
      // A failed one is left alone EXCEPT when Stripe says it failed again (a redelivery): the settle then answers "already" and
      // finishes what a crash or a failed send left undone (the club's notice, the business's correction email).
      if (r.status === 'failed' && refund.status !== 'failed' && refund.status !== 'canceled') continue;
      // A replay of a succeeded one runs the settle again: booking answers "already", and the place sync and the email are
      // each once-only, so a crash after the booking that left them undone is finished here (the landing's replay does the same).
      if (r.status === 'succeeded' && refund.status !== 'succeeded' && refund.status !== 'failed' && refund.status !== 'canceled') continue;
      await settleSponsorRefund(op.org_id, r.id, refund);
    }
    return;
  }
  // A payment that arrived but could not be recorded, given back IN FULL from Stripe's own dashboard (mig 531): it is refunded,
  // and its "not recorded" notice clears. Without this the deal stayed wedged: card refused, invoice refused, Withdraw the only way out.
  if (refund.status === 'succeeded' && op.status === 'paid' && !op.landed_at && op.stripe_payment_intent_id) {
    // Neither read is swallowed: a failure here would leave the deal wedged with nothing to try again.
    const all = await listRefunds(op.stripe_account_id, op.stripe_payment_intent_id);
    const back = all.filter(x => x.status === 'succeeded').reduce((s, x) => s + x.amount, 0) / 100;
    const { data: done, error: doneError } = await supabaseAdmin.rpc('club_sponsor_card_unlanded_refunded', { p_online_payment: op.id, p_refunded: back });
    if (doneError) throw new Error(doneError.message);
    if ((done as { handled?: boolean } | null)?.handled) {
      await clearSettled({ orgIds: [op.org_id], kinds: ['online_payment_not_recorded', 'card_refund_unmatched'] });
      return;
    }
  }
  await recordStripeSponsorRefund(op, refund);
}

/** What `club_sponsor_card_stripe_refund` answers that the caller acts on (it says more; nothing else reads it). */
type StripeSponsorRefundOutcome = {
  ours?: boolean; already?: boolean; failed?: boolean; wasBooked?: boolean; refundId?: string; dealId?: string; status?: 'pending' | 'succeeded' | 'failed';
};

/**
 * A refund made in the club's own Stripe dashboard on a sponsor's card payment (mig 542, Stage 6 fixes Part A, RULED 2026-11-25):
 * recorded by Stripe's refund id (`club_sponsor_card_stripe_refund`; safe to say twice). On its way, it holds what the deal can
 * refund; through, the books take it by themselves (ask 1) and whoever opens Sponsorships is told to finish it on the deal (the
 * reason, the credit note, the email, and on the last money what happens to the deal: ask 2). Failed before it went through, it
 * is let go; failed after, the shipped "Refund didn't reach the card". On a payment the sponsor's bank already took back, nothing
 * is booked and the club is told it went back twice. A payment not recorded on its deal yet records nothing: its landing reads
 * the refunds back (`reconcileDashboardRefunds`), and a payment that is never recorded keeps its own notice.
 */
async function recordStripeSponsorRefund(op: Pick<PayForRefund, 'id' | 'org_id' | 'stripe_account_id'>, event: Stripe.Refund): Promise<void> {
  // Read from Stripe now: events state no order, and an old "succeeded" arriving after a "failed" never seen here would book
  // money that never reached the card.
  const refund = await retrieveRefund(op.stripe_account_id, event.id);
  const { data, error } = await supabaseAdmin.rpc('club_sponsor_card_stripe_refund', {
    p_online_payment: op.id, p_stripe_refund: refund.id, p_amount: refund.amount / 100, p_status: refund.status ?? 'pending',
    p_created: stripeMoment(refund), p_stripe_reason: refund.reason ?? null,
  });
  if (error) {
    // More than the payment holds (only drifted data could): the books can't take it by themselves, so the club records it by hand.
    if ((error as { code?: string }).code === 'SP002' && (error.message ?? '').includes('club_sponsor_stripe_refund_over')) {
      await raiseStripeSponsorRefundByHand(op, refund);
      return;
    }
    throw new Error(error.message); // not swallowed: Stripe redelivers the event
  }
  const o = (data ?? {}) as StripeSponsorRefundOutcome;
  // No payment on its deal yet, a failed one never seen, or the app's own refund: nothing for this path to do.
  if (o.ours || !o.refundId) return;
  if (o.failed || (o.already && o.status === 'failed')) {
    // A replay of a failed one finishes what a crash left undone, as the app's own refunds do; the database says whether it had
    // been booked only when it fails now, so a replay reads its lines.
    let wasBooked = !!o.wasBooked;
    if (!o.failed) {
      const { data: r } = await supabaseAdmin.from('club_sponsor_deal_refunds').select('income_entry_id, fee_refund_entry_id, tax_entry_id').eq('id', o.refundId).maybeSingle();
      wasBooked = !!(r && (r.income_entry_id || r.fee_refund_entry_id || r.tax_entry_id));
    }
    if (wasBooked) {
      await syncSponsorPlace(op.org_id, o.dealId ?? null);
      // As a refund from the deal that bounced: the notice once, and the correction only when the business was emailed (it was finished).
      try { await raiseSponsorRefundFailed(o.refundId); } finally { if (o.dealId) await emailDealRefundCancelled(op.org_id, o.dealId, o.refundId); }
    }
    // Its "needs finishing" notice (if any) clears: there is nothing to finish.
    if (o.failed) await clearSettled({ orgIds: [op.org_id], kinds: ['sponsor_refund_to_finish', 'sponsor_refund_twice'] });
    return;
  }
  await raiseStripeSponsorRefundNotice(op.org_id, o.refundId);
}

/**
 * Through (now, or earlier and replayed): the club hears a refund made in Stripe, once per refund and per kind (mig 542's two kinds,
 * keyed on the refund row) — "needs finishing", or "paid back twice" while the sponsor's bank has the payment (a later win settles
 * that one and raises the first). An older notice about the same refund (the family's "matches no payment", raised before its
 * payment landed) clears itself now that the refund is on its deal.
 */
async function raiseStripeSponsorRefundNotice(orgId: string, refundId: string): Promise<void> {
  const { data: row, error } = await supabaseAdmin.from('club_sponsor_deal_refunds')
    .select('status, finished_at, after_lost_dispute, amount, refunded_on, stripe_created_at, stripe_refund_id, deal_id, club_sponsor_deals(business_name)')
    .eq('id', refundId).eq('origin', 'stripe').maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.status !== 'succeeded' || row.finished_at) return;
  const twice = !!row.after_lost_dispute;
  const kind = twice ? 'sponsor_refund_twice' : 'sponsor_refund_to_finish';
  // Once ever per refund and kind (open, settled or Done): a replay stops here, as the failed-refund notice does.
  if (await hasRecentNotification(orgId, kind, { sponsorRefundId: refundId }, '1970-01-01T00:00:00Z')) return;
  await clearSettled({ orgIds: [orgId], kinds: ['card_refund_unmatched', 'sponsor_refund_twice'] });
  const org = await orgById(orgId);
  if (!org) return;
  const deal = (Array.isArray(row.club_sponsor_deals) ? row.club_sponsor_deals[0] : row.club_sponsor_deals) as { business_name: string | null } | null;
  const business = deal?.business_name || DEAL_WORDS.card.theSponsor;
  const amount = formatMoney(Number(row.amount));
  const on = formatStoredDate(row.stripe_created_at ?? row.refunded_on ?? new Date().toISOString(), { withYear: false });
  await raiseOnce({
    org, userIds: await sponsorshipPeople(org), eventType: kind, subjectKey: 'sponsorRefundId', subjectId: refundId,
    title: twice ? DEAL_WORDS.card.twiceNoticeTitle(business) : DEAL_WORDS.card.finishNoticeTitle,
    body: twice ? DEAL_WORDS.card.twiceNoticeBody(amount, business, on) : DEAL_WORDS.card.finishNoticeBody(amount, business, on),
    link: dealHref(org, row.deal_id as string),
  });
}

/** The one refund made in Stripe the books can't take by themselves (larger than the payment holds): recorded by hand, as before. */
async function raiseStripeSponsorRefundByHand(op: Pick<PayForRefund, 'id' | 'org_id'>, refund: Stripe.Refund): Promise<void> {
  const org = await orgById(op.org_id);
  if (!org) return;
  const { data: row } = await supabaseAdmin.from('online_payments').select('sponsor_deal_id').eq('id', op.id).maybeSingle();
  await raiseOnce({
    org, userIds: await sponsorshipPeople(org), eventType: 'card_refund_unmatched', subjectKey: 'unmatchedStripeRefundId', subjectId: refund.id,
    title: DEAL_WORDS.card.dashboardRefundTitle,
    body: DEAL_WORDS.card.dashboardRefundBody(formatMoney(refund.amount / 100), formatStoredDate(stripeMoment(refund), { withYear: false })),
    link: dealHref(org, (row?.sponsor_deal_id as string | null) ?? null),
  });
}

/**
 * THE ONE-TIME CATCH-UP (Part A, ask 5, RULED 2026-11-25): a refund made in Stripe before this shipped sits as an open
 * "refund made in Stripe" notice and is in nobody's books. Each one's refund is read back from Stripe and goes through the same
 * code as a new event (`applyRefundEvent`), so it is recorded the new way, its old notice clears and "needs finishing" goes up.
 * Safe to run twice: the record is keyed on Stripe's refund id, and a refund already recorded answers "already". Only sponsors'
 * payments are touched; a family's or a team's notice is left as it is. Run by hand on dev (scripts/catch-up-stripe-sponsor-refunds.mjs).
 * `write: false` only counts them (the script's look).
 */
export async function catchUpStripeSponsorRefunds({ write }: { write: boolean }): Promise<{ looked: number; recorded: number; notSponsor: number; failed: number }> {
  const { data, error } = await supabaseAdmin.from('notifications').select('org_id, metadata')
    .eq('event_type', 'card_refund_unmatched').is('cleared_at', null).limit(1000);
  if (error) throw error;
  const seen = new Map<string, string>(); // Stripe refund id → org
  for (const n of (data ?? []) as { org_id: string; metadata: Record<string, unknown> | null }[]) {
    const m = n.metadata ?? {};
    const id = typeof m.unmatchedStripeRefundId === 'string' ? m.unmatchedStripeRefundId : null;
    if (id && !seen.has(id)) seen.set(id, n.org_id);
  }
  let recorded = 0;
  let notSponsor = 0;
  let failed = 0;
  if (!write) return { looked: seen.size, recorded, notSponsor, failed };
  // Read them all first: they are recorded oldest first (the sponsorship goes back first and the fee last).
  const found: { refundId: string; account: string; refund: Stripe.Refund }[] = [];
  const note = (refundId: string, e: unknown) => {
    failed++;
    console.error('[online-payment-landing] a refund made in Stripe could not be caught up; run again:', refundId, e instanceof Error ? e.message : String(e));
  };
  for (const [refundId, orgId] of seen) {
    try {
      const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('stripe_account_id').eq('org_id', orgId).maybeSingle();
      const account = (acct?.stripe_account_id as string | null) ?? null;
      if (!account) { failed++; continue; }
      found.push({ refundId, account, refund: await retrieveRefund(account, refundId) });
    } catch (e) { note(refundId, e); }
  }
  for (const { refundId, account, refund } of found.sort((a, b) => a.refund.created - b.refund.created)) {
    try {
      const intent = idOf(refund.payment_intent);
      const { data: op } = intent ? await supabaseAdmin.from('online_payments').select('flow').eq('stripe_payment_intent_id', intent).maybeSingle() : { data: null };
      if (op?.flow !== 'sponsorship') { notSponsor++; continue; }
      await applyRefundEvent(account, refund);
      recorded++;
    } catch (e) {
      note(refundId, e);
    }
  }
  return { looked: seen.size, recorded, notSponsor, failed };
}

export type SponsorRefundFinishRefusal = 'reason' | 'outcome' | 'outcome_changed' | 'already' | 'nothing' | 'not_found';

/**
 * The club finishes a refund made in Stripe (Part A, ask 2): its reason, and on the last money what happens to the deal ("It has
 * ended" withdraws it; "They still owe it" puts it back to owing). The credit note is issued (dated today), the ledger lines take
 * the reason and the note's number, and the business is emailed with the shipped refund email. Then the deal's place follows it.
 */
export async function finishStripeSponsorRefund(p: {
  orgId: string; refundId: string; reason: string; outcome: 'ended' | 'owing' | null; actorId: string; actorName: string;
}): Promise<{ ok: true; dealId: string; endsDeal: boolean; owingAgain: boolean; emailedTo: string | null } | { ok: false; why: SponsorRefundFinishRefusal }> {
  const { data, error } = await supabaseAdmin.rpc('club_sponsor_card_refund_finish', {
    p_org: p.orgId, p_refund: p.refundId, p_reason: p.reason, p_outcome: p.outcome, p_actor: p.actorId, p_actor_name: p.actorName,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('needs_a_reason')) return { ok: false, why: 'reason' };
    if (msg.includes('needs_an_outcome')) return { ok: false, why: 'outcome' };
    // The screen offered a choice the deal no longer allows (another refund moved it): it re-reads, as above.
    if (msg.includes('outcome_not_asked') || msg.includes('owing_needs_fee') || msg.includes('owing_noted')) return { ok: false, why: 'outcome_changed' };
    if (msg.includes('nothing_to_finish')) return { ok: false, why: 'nothing' };
    if (msg.includes('refund_not_found')) return { ok: false, why: 'not_found' };
    throw new Error(msg);
  }
  const f = data as { already: boolean; dealId: string; endsDeal: boolean; owingAgain?: boolean };
  if (f.already) return { ok: false, why: 'already' };
  // The three follow-ups each stand alone once the finish committed (each swallows its own failure; the email never throws).
  const [emailedTo] = await Promise.all([
    emailDealRefund(p.orgId, p.refundId),
    f.endsDeal || f.owingAgain ? syncSponsorPlace(p.orgId, f.dealId) : Promise.resolve(),
    clearSettled({ orgIds: [p.orgId], kinds: ['sponsor_refund_to_finish'] }).catch(() => undefined),
  ]);
  return { ok: true, dealId: f.dealId, endsDeal: f.endsDeal, owingAgain: !!f.owingAgain, emailedTo };
}

/** A booked sponsor refund the card's bank sent back: "Refund didn't reach the card" (the ONE wording), to Sponsorships. Keyed on
 *  the REFUND (a second refund that bounces on the same payment raises its own), and safe to call again: `raiseOnce` never doubles. */
async function raiseSponsorRefundFailed(refundId: string): Promise<void> {
  const { data: r } = await supabaseAdmin.from('club_sponsor_deal_refunds').select('org_id, deal_id, online_payment_id, amount, ends_deal, club_sponsor_deals(business_name, state)').eq('id', refundId).maybeSingle();
  if (!r) return;
  // Raised once ever per refund (open or settled): a replay stops here, before the member reads.
  if (await hasRecentNotification(r.org_id as string, 'card_refund_failed', { sponsorRefundId: refundId }, '1970-01-01T00:00:00Z')) return;
  const deal = (Array.isArray(r.club_sponsor_deals) ? r.club_sponsor_deals[0] : r.club_sponsor_deals) as { business_name: string | null; state: string } | null;
  const org = await orgById(r.org_id as string);
  if (!org) return;
  const { data: op } = await supabaseAdmin.from('online_payments').select('card_brand, card_last4').eq('id', r.online_payment_id as string).maybeSingle();
  await raiseOnce({
    org, userIds: await sponsorshipPeople(org), eventType: 'card_refund_failed', subjectKey: 'sponsorRefundId', subjectId: refundId,
    ...sponsorRefundFailedNotice({
      amount: formatMoney(Number(r.amount)), card: cardLabel((op?.card_brand as string | null) ?? null, (op?.card_last4 as string | null) ?? null),
      business: deal?.business_name || DEAL_WORDS.card.theSponsor, dealEnded: !!r.ends_deal && deal?.state === 'withdrawn',
    }),
    link: dealHref(org, r.deal_id as string),
  });
}

/**
 * After a sponsor's dispute was written (mig 532): the notices, each once and read from the rows (a replay owes nothing twice).
 * OPEN: whoever opens Sponsorships, and whoever answers in Stripe, hears it (answer it; never refund meanwhile). LOST: told once,
 * with what the books did (or, for a part dispute that was left alone, to record it by hand). WON: the lost notice clears itself.
 */
async function afterSponsorDispute(org: Organization, op: DisputedPay, d: DisputeRow): Promise<void> {
  const dealId = op.sponsor_deal_id;
  const [{ data: deal }, answerer, people] = await Promise.all([
    dealId ? supabaseAdmin.from('club_sponsor_deals').select('business_name').eq('id', dealId).maybeSingle() : Promise.resolve({ data: null }),
    disputeAnswerer(org.id), sponsorshipPeople(org),
  ]);
  const business = (deal?.business_name as string | null | undefined) || DEAL_WORDS.card.theSponsor;
  const link = dealHref(org, dealId);
  const amount = formatMoney(Number(d.amount));
  const everyone = [...new Set([...people, ...answerer.ids])];
  const extra: Record<string, string> = dealId ? { sponsorDealId: dealId } : {};
  if (isDisputeOpen(d.status)) {
    // A bank only asking takes nothing and leaves refunds open: it never reads as a dispute.
    const inquiry = isInquiry(d.status);
    await raiseOnce({
      org, userIds: everyone, eventType: 'card_disputed', subjectKey: 'onlineDisputeId', subjectId: d.id, link,
      extra: inquiry ? { ...extra, inquiry: 'yes' } : extra,
      title: inquiry ? SPONSOR_DISPUTE_WORDS.inquiryTitle(business) : SPONSOR_DISPUTE_WORDS.openTitle(business),
      body: (inquiry ? SPONSOR_DISPUTE_WORDS.inquiryBody : SPONSOR_DISPUTE_WORDS.openBody)(amount, disputeDue(d.due_by)),
    });
  }
  if (d.status === 'lost' && !d.won_back_at && !(await disputeLostRaised(op.org_id, d.id))) {
    const day = formatStoredDate(d.lost_booked_at ?? new Date().toISOString(), { withYear: false });
    await raiseOnce({
      org, userIds: everyone, eventType: 'card_dispute_lost', subjectKey: 'onlineDisputeId', subjectId: d.id, link, extra,
      title: SPONSOR_DISPUTE_WORDS.lostTitle(business),
      // A loss that was booked says what the books did; one the writer left alone (a part dispute) says to record it.
      body: d.lost_booked_at ? SPONSOR_DISPUTE_WORDS.lostLine(amount, day) : SPONSOR_DISPUTE_WORDS.partialBody(amount),
    });
  }
  // A win after a refund made in Stripe had returned the money a second time (mig 542): that refund now goes in the books (its
  // lines were held back while the loss had the money out) and is the club's to finish. Once only (the flag clears).
  if (d.won_back_at) {
    const { error: twiceErr } = await supabaseAdmin.rpc('club_sponsor_card_twice_settle', { p_online_payment: op.id });
    if (twiceErr) throw new Error(twiceErr.message); // the dispute's event is redelivered; the settle is once-only
    // Each refund waiting to be finished hears it (its "paid back twice" notice settles, and "needs finishing" goes up). Read
    // on every replay, not only when this call settled something: the raise is once ever, so a crash after the settle is made up.
    const { data: held, error: heldErr } = await supabaseAdmin.from('club_sponsor_deal_refunds').select('id').eq('online_payment_id', op.id)
      .eq('origin', 'stripe').eq('status', 'succeeded').eq('after_lost_dispute', false).is('finished_at', null);
    if (heldErr) throw new Error(heldErr.message);
    for (const h of (held ?? []) as { id: string }[]) await raiseStripeSponsorRefundNotice(op.org_id, h.id);
  }
  // A loss puts the deal back to owing and a win to paid again: its place on the club's site follows (a void does the same).
  if (d.lost_booked_at || d.won_back_at) await syncSponsorPlace(org.id, dealId);
  // A win after the sponsor paid again another way leaves more standing than the invoice asks (mig 534): the club is told, once, to refund it.
  const extraStanding = Number(d.won_back?.extra ?? 0);
  if (d.won_back_at && extraStanding > 0) {
    await raiseOnce({
      org, userIds: everyone, eventType: 'card_dispute_lost', subjectKey: 'sponsorExtraDisputeId', subjectId: d.id, link,
      extra: { ...extra, sponsorExtra: 'yes' },
      title: SPONSOR_DISPUTE_WORDS.wonExtraTitle(business), body: SPONSOR_DISPUTE_WORDS.wonExtraBody(formatMoney(extraStanding)),
    });
  }
  await clearSettled({ orgIds: [op.org_id], kinds: ['card_disputed', 'card_dispute_lost'] });
}

/**
 * The retry sweep for a sponsor's card refund stuck "on its way" (walk §564 owner call (h); mig 531's companion). A refund opens
 * in the database BEFORE Stripe is asked, so a crash or a lost connection between the two leaves it pending with no Stripe id,
 * and no event will ever arrive for it; it holds back the payment's refundable amount for good. Each one older than 15 minutes
 * is looked for in Stripe by the id we put in its metadata: found, it is settled as Stripe says; not found, Stripe is asked again
 * with the same idempotency key (so a refund Stripe already made is returned, never doubled). An answer Stripe GAVE (a refusal)
 * fails it; anything else leaves it for the next run. Run by the daily online-payments job; safe to run any time.
 */
export async function sweepStuckSponsorRefunds(now: Date = new Date()): Promise<{ looked: number; settled: number; stillStuck: number; corrected: number }> {
  const before = new Date(now.getTime() - 15 * 60_000).toISOString();
  const { data, error } = await supabaseAdmin.from('club_sponsor_deal_refunds')
    .select('id, org_id, amount, online_payments(id, stripe_account_id, stripe_payment_intent_id)')
    // ⚠ Only the app's OWN refunds (origin 'app'). A refund made in the club's Stripe dashboard (mig 542) already exists at
    // Stripe: asking for it again would refund the sponsor twice. It always carries Stripe's id, so the id test alone would
    // keep it out; the origin test says so on purpose and survives a change to either.
    .eq('origin', 'app').eq('status', 'pending').is('stripe_refund_id', null).lt('created_at', before).order('created_at').limit(50);
  if (error) throw error;
  type Row = { id: string; org_id: string; amount: number | string; online_payments: OpRef | OpRef[] | null };
  type OpRef = { id: string; stripe_account_id: string; stripe_payment_intent_id: string | null };
  let settled = 0;
  let stillStuck = 0;
  const listed = new Map<string, Promise<Stripe.Refund[]>>(); // one Stripe list per payment, however many of its refunds are stuck
  for (const row of (data ?? []) as unknown as Row[]) {
    const op = Array.isArray(row.online_payments) ? row.online_payments[0] : row.online_payments;
    if (!op?.stripe_payment_intent_id) { stillStuck++; continue; }
    try {
      const key = op.stripe_payment_intent_id;
      if (!listed.has(key)) listed.set(key, listRefunds(op.stripe_account_id, key));
      // Looking is not asking: an error from the LIST (a revoked account, an intent not found) says nothing about whether our
      // refund exists, so it leaves the row stuck. Only Stripe's answer to the refund REQUEST can fail it.
      const existing = (await listed.get(key)!).find(x => x.metadata?.refund_id === row.id);
      let refund = existing;
      if (!refund) {
        try {
          refund = await refundToCard({
            accountId: op.stripe_account_id, paymentIntentId: key, amountCents: Math.round(Number(row.amount) * 100), refundId: row.id,
            metadata: { online_payment_id: op.id, refund_id: row.id },
          });
        } catch (e) {
          if (stripeRefused(e)) { await failSponsorRefund(row.id, e); settled++; } else stillStuck++;
          continue;
        }
      }
      await settleSponsorRefund(row.org_id, row.id, refund);
      settled++;
    } catch {
      stillStuck++; // a list that failed, or a settle that did not finish: the next run looks again
    }
  }
  // A booked refund that bounced, whose correction email never went (a failed send released its stamp, or the failure's own
  // redelivery never came): tried again here, each on its own stamp (mig 533), so a sent one is never doubled.
  let corrected = 0;
  try {
    const { data: bounced } = await supabaseAdmin.from('club_sponsor_deal_refunds').select('id, org_id, deal_id')
      .eq('status', 'failed').not('emailed_at', 'is', null).not('credit_seq', 'is', null).is('cancel_emailed_at', null).limit(50);
    for (const b of (bounced ?? []) as { id: string; org_id: string; deal_id: string }[]) { await emailDealRefundCancelled(b.org_id, b.deal_id, b.id); corrected++; }
  } catch (e) {
    console.error('[online-payment-landing] the refund corrections still owed could not be read; the next run tries again:', e instanceof Error ? e.message : String(e));
  }
  return { looked: (data ?? []).length, settled, stillStuck, corrected };
}
