import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { clearSettled } from './needs-attention';
import { getOrganizationBySlugForServer } from './server-organizations';
import { canConnectPayouts, canRefundLeagueOnline, canRefundOnline, isPayoutsTreasurer } from './online-payment-access';
import { factsFromStripe, factsFromRow, payoutsPath, payoutsState, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow } from './online-payment-account';
import { listRefunds, retrieveAccount, retrieveCheckout, refundToCard } from './stripe-connect';
import { sendOnlineReceiptOnce, sendRefundEmail } from './online-payment-receipt';
import { claimRefundEmail, sendLeagueRefundEmail } from './online-refund-email';
import { childList } from './league-pay-words';
import { pinLeagueRefund, pinTeamRefund } from './online-refund-pinning';
import { LEAGUE_ONLINE_NOTICE_WORDS as LW, cardLabel, leagueUnrecordedWhy, ONLINE_NOTICE_WORDS as W, money as formatMoney } from './online-payment-words';
import { formatStoredDate } from './timezone';
import type { Organization, OrgRole } from './types';

/**
 * THE LANDING (Club Tier Stage 12a). The one module through which an online payment reaches a team's record and a
 * refund reaches the card — `tests/unit/online-payments-guard.test.ts` holds that nothing else calls the mig 358
 * functions. Every write that moves money is a database function (mig 358) that calls the tournament's own writer, so a
 * card payment behaves exactly as a hand-recorded one.
 *
 * Called by the Connect webhook (the source of truth: "Paid" is never shown on the redirect alone), by the receipt page
 * when it re-reads a session the webhook has not landed yet, and by the refund route.
 */

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
    | 'card_refund_whose' | 'card_refund_still_enrolled' | 'card_refund_unmatched';
  subjectKey: string; subjectId: string; title: string; body: string; link: string;
  /** More facts the notice's resolver reads (never part of its one-open-copy key, mig 366/374). */
  extra?: Record<string, string>;
}): Promise<void> {
  if (!p.userIds.length) return;
  await notify({
    orgId: p.org.id, userIds: p.userIds, eventType: p.eventType, title: p.title, body: p.body, link: p.link,
    metadata: { ...p.extra, [p.subjectKey]: p.subjectId }, requiredFeature: 'online_payments',
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
  const { columns, onboardingFinished, closed } = factsFromStripe(acct);
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
    await raiseOnce({
      org, userIds: await payoutsPeople(org), eventType: 'payouts_need_attention',
      subjectKey: 'stripeAccountId', subjectId: stripeAccountId,
      title: W.stripeNeedsTitle,
      body: row.card_payments_status === 'active'
        ? W.stripeNeedsBodyStillOn(deadline)
        // A League or Club's families pay online too (copy §20); Tournament Plus names teams.
        : org.planId === 'tournament' || org.planId === 'tournament_plus' ? W.stripeNeedsBodyPaused : W.stripeNeedsBodyPausedFamilies,
      link: payoutsHref(org),
    });
  }
  await clearSettled({ orgIds: [row.org_id], kinds: ['payouts_need_attention'] });
  return row;
}

/** Where the Payouts card lives (A8) — `payoutsPath`, the one home of the path. */
export function payoutsHref(org: Pick<Organization, 'slug' | 'planId'>): string {
  return payoutsPath(org);
}

// ── A payment ───────────────────────────────────────────────────────────────────────────────────

type OnlineRow = {
  id: string; org_id: string; flow: 'tournament_team' | 'league_signup'; team_id: string | null; tournament_id: string | null;
  season_id: string | null; status: string; landed_at: string | null;
  stripe_account_id: string; stripe_checkout_session_id: string | null; description: string; total_amount: number;
};

/** Where a payment's record lives: the team's tournament, or the season's Registrations (house league, 12b). A child's
 *  notice opens that child's record (12c F5: `reg`, at its Fee section, or at its "To the card" block). */
function recordHref(org: Organization, op: Pick<OnlineRow, 'tournament_id' | 'season_id'>, child?: { regId: string | null; at?: 'fee' | 'card' }): string {
  if (op.tournament_id) return `/${org.slug}/admin/tournaments/registrations?tournament=${op.tournament_id}`;
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
    await raiseOnce({
      org, userIds: people, eventType: 'online_payment_not_recorded',
      subjectKey: 'onlinePaymentItemId', subjectId: u.id,
      title: LW.unrecordedTitle(child),
      body: LW.unrecordedBody(guardian, formatMoney(Number(u.amount)), day ? formatStoredDate(day, { withYear: false }) : null, child, leagueUnrecordedWhy(u.land_error)),
      link: recordHref(org, op, { regId: u.registration_id }),
    });
  }
}

function cardOf(session: Stripe.Checkout.Session): { intent: string | null; charge: string | null; brand: string | null; last4: string | null } {
  const pi = session.payment_intent;
  const intent = typeof pi === 'string' ? pi : pi?.id ?? null;
  const ch = typeof pi === 'object' && pi ? pi.latest_charge : null;
  const charge = typeof ch === 'string' ? ch : ch?.id ?? null;
  const card = typeof ch === 'object' && ch ? ch.payment_method_details?.card : null;
  return { intent, charge, brand: card?.brand ?? null, last4: card?.last4 ?? null };
}

/**
 * A Checkout Session on a club's account completed and paid → land it. Idempotent (the database function answers
 * `already`). A landing that throws — an "our team" link made after the page opened, a deleted team — keeps the payment
 * PAID and numbered, with the reason, and raises "isn't in the team's record" for whoever may refund. Stripe has the
 * money either way; nothing is lost.
 */
export async function landCheckoutSession(stripeAccountId: string, sessionId: string): Promise<'landed' | 'already' | 'not_paid' | 'unknown' | 'not_recorded'> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .select('id, org_id, flow, team_id, tournament_id, season_id, status, landed_at, stripe_account_id, stripe_checkout_session_id, description, total_amount')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  const op = data as OnlineRow | null;
  if (!op || op.stripe_account_id !== stripeAccountId) return 'unknown';
  if (op.landed_at) {
    // A replay still owes any child's notice a crash after the landing's commit missed (raiseLeagueUnrecorded).
    if (op.flow === 'league_signup') await raiseLeagueUnrecorded(op);
    return 'already';
  }
  const session = await retrieveCheckout(stripeAccountId, sessionId);
  if (session.payment_status !== 'paid') return 'not_paid';
  const card = cardOf(session);
  const paidAt = new Date(((typeof session.payment_intent === 'object' && session.payment_intent?.created) || session.created) * 1000).toISOString();
  // Stripe's own figures must be the ones the payment was opened for; anything else is recorded by a person, not by us.
  const expected = Math.round(Number(op.total_amount) * 100);
  const mismatch = session.amount_total !== expected || (session.currency ?? '').toLowerCase() !== 'cad'
    ? `Stripe took ${(session.amount_total ?? 0) / 100} ${(session.currency ?? '').toUpperCase()}, not the ${expected / 100} CAD the page asked for`
    : null;
  if (op.flow === 'league_signup') return landLeague(op, paidAt, card, mismatch);

  const { data: landed, error: landError } = mismatch
    ? { data: null, error: { message: mismatch } }
    : await supabaseAdmin.rpc('online_payment_land', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand, p_last4: card.last4,
    });
  const error = landError;
  if (error) {
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
        body: W.notRecordedBody(op.description, formatMoney(Number(op.total_amount)), error.message),
        link: recordHref(org, op),
      });
    }
    await sendOnlineReceiptOnce(op.id);
    return 'not_recorded';
  }
  await sendOnlineReceiptOnce(op.id);
  if (!(landed as { already?: boolean } | null)?.already) await reconcileDashboardRefunds(stripeAccountId, op.id);
  return (landed as { already?: boolean } | null)?.already ? 'already' : 'landed';
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
        title: LW.unrecordedSignupTitle,
        body: LW.unrecordedSignupBody(op.description, formatMoney(Number(op.total_amount)), error.message),
        link: recordHref(org, op),
      });
    }
    await sendOnlineReceiptOnce(op.id);
    return 'not_recorded';
  }
  const result = landed as { already?: boolean; unrecorded?: unknown[] } | null;
  // Notices are read from the database (a replay included), so a crash between the commit and here loses none.
  await raiseLeagueUnrecorded(op);
  if (result?.already) return 'already';
  await clearSettled({ orgIds: [op.org_id], kinds: ['online_payment_not_recorded'] });
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

/** A Checkout Session expired unpaid: the payment closes, so the team can open a new one. */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  await supabaseAdmin.from('online_payments').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId).eq('status', 'open');
}

// ── A refund ────────────────────────────────────────────────────────────────────────────────────

type RefundOutcome = { state: 'succeeded' | 'pending' | 'failed'; refundId: string };

async function refundFailed(refundId: string, stripeRefundId: string | null, reason: string, onlinePaymentId: string): Promise<void> {
  await supabaseAdmin.rpc('online_payment_refund_failed', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_reason: reason });
  const { data } = await supabaseAdmin.from('online_payments').select('org_id, description, tournament_id').eq('id', onlinePaymentId).maybeSingle();
  const org = data ? await orgById(data.org_id as string) : null;
  if (!org || !data) return;
  await raiseOnce({
    org, userIds: await refundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentId', subjectId: onlinePaymentId,
    title: W.refundFailedTitle,
    body: W.refundFailedBody(data.description as string),
    link: data.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournament=${data.tournament_id}` : `/${org.slug}/admin`,
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
    supabaseAdmin.from('online_payments').select('org_id, season_id, card_brand, card_last4').eq('id', r.online_payment_id as string).maybeSingle(),
    supabaseAdmin.from('online_payment_items').select('description, registration_id').eq('id', r.online_payment_item_id as string).maybeSingle(),
  ]);
  const org = op ? await orgById(op.org_id as string) : null;
  if (!org || !op) return;
  const child = ((item?.description as string | undefined) ?? '').split(' · ')[0];
  await raiseOnce({
    org, userIds: await leagueRefundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentItemId', subjectId: r.online_payment_item_id as string,
    title: LW.refundFailedTitle(child),
    body: LW.refundFailedBody(formatMoney(Number(r.amount)), cardLabel(op.card_brand as string | null, op.card_last4 as string | null)),
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
}>> {
  const { data: items } = await supabaseAdmin.from('online_payment_items')
    .select('id, amount, fee_share, created_at, online_payments!inner(fee_payer, card_brand, card_last4, status)')
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
  return rows.map(i => {
    const op = (Array.isArray(i.online_payments) ? i.online_payments[0] : i.online_payments) as { fee_payer: string; card_brand: string | null; card_last4: string | null };
    const amount = Math.round(Number(i.amount) * 100);
    const done = back.get(i.id as string) ?? 0;
    return {
      itemId: i.id as string, leftCents: amount - done, feeShareCents: Math.round(Number(i.fee_share) * 100), untouched: done === 0,
      familyPaidFee: op.fee_payer === 'family', brand: op.card_brand, last4: op.card_last4,
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
  const [{ data: r }, { data: op }] = await Promise.all([
    supabaseAdmin.from('online_payment_refunds').select('booked_at').eq('id', refundId).maybeSingle(),
    supabaseAdmin.from('online_payments').select('org_id, description, tournament_id').eq('id', onlinePaymentId).maybeSingle(),
  ]);
  if (!r?.booked_at || !op) return; // refused before it was booked: nothing changed, and the window said so
  const org = await orgById(op.org_id as string);
  if (!org) return;
  await raiseOnce({
    org, userIds: await refundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentId', subjectId: onlinePaymentId,
    title: W.refundFailedTitle, body: W.refundFailedBody(op.description as string),
    link: op.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournament=${op.tournament_id}` : `/${org.slug}/admin`,
    extra: { refundId },
  });
}

type PayForRefund = {
  id: string; org_id: string; flow: 'tournament_team' | 'league_signup'; status: string; total_amount: number; base_amount: number;
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
  const { data } = await supabaseAdmin.from('online_payments').select(PAY_FOR_REFUND).eq('stripe_payment_intent_id', intent).maybeSingle();
  const op = data as PayForRefund | null;
  if (!op) { await raiseUnmatched(stripeAccountId, refund); return; }
  if (op.stripe_account_id !== stripeAccountId) return;
  // Ours carries our refund's id in its metadata (set when we asked Stripe), or Stripe's id once recorded. A refund made
  // in the club's own Stripe dashboard has neither and is never taken for one of ours.
  const ourId = typeof refund.metadata?.refund_id === 'string' ? refund.metadata.refund_id : null;
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
  // A refund made in Stripe that failed or was cancelled moved no money: nothing to record.
  if (refund.status !== 'succeeded' && refund.status !== 'pending') return;
  const { data: waiting } = await supabaseAdmin.from('online_refunds_unassigned').select('id').eq('stripe_refund_id', refund.id).maybeSingle();
  if (waiting) return; // already waiting for "whose was it?"
  if (op.flow === 'league_signup') await recordLeagueDashboardRefund(op, refund);
  else await recordTeamDashboardRefund(op, refund);
}

/** A payment just landed: any refund made in Stripe before it did is recorded on it now (events out of order). */
export async function reconcileDashboardRefunds(stripeAccountId: string, onlinePaymentId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('online_payments').select('stripe_payment_intent_id').eq('id', onlinePaymentId).maybeSingle();
  const intent = (data?.stripe_payment_intent_id as string | null) ?? null;
  if (!intent) return;
  const refunds = await listRefunds(stripeAccountId, intent).catch(() => [] as Stripe.Refund[]);
  for (const r of refunds) await applyRefundEvent(stripeAccountId, r);
  const { data: org } = await supabaseAdmin.from('online_payments').select('org_id').eq('id', onlinePaymentId).maybeSingle();
  if (refunds.length && org) await clearSettled({ orgIds: [org.org_id as string], kinds: ['card_refund_unmatched'] });
}

/** "A refund in Stripe matches no payment we recorded" (words §5): to both desks, since the flow can't be told yet. */
async function raiseUnmatched(stripeAccountId: string, refund: Stripe.Refund): Promise<void> {
  if (refund.status !== 'succeeded' && refund.status !== 'pending') return;
  const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('org_id').eq('stripe_account_id', stripeAccountId).maybeSingle();
  const org = acct ? await orgById(acct.org_id as string) : null;
  if (!org) return;
  const people = [...new Set([...(await leagueRefundPeople(org)), ...(await refundPeople(org))])];
  await raiseOnce({
    org, userIds: people, eventType: 'card_refund_unmatched', subjectKey: 'unmatchedStripeRefundId', subjectId: refund.id,
    title: LW.noMatchTitle, body: LW.noMatchBody(formatMoney(refund.amount / 100), formatStoredDate(stripeMoment(refund).slice(0, 10), { withYear: false })),
    link: payoutsHref(org),
  });
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
      body: LW.whoseBody(childList(regRows.map(r => r.player_first_name)), formatMoney(Number(op.total_amount)), String(op.receipt_no ?? '')),
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
    const card = op.rail === 'bank_debit' ? `the account ending ${op.bank_last4 ?? ''}` : cardLabel(op.card_brand, op.card_last4);
    const at = (r.stripe_created_at as string | null) ?? (r.created_at as string);
    await raiseOnce({
      org, userIds: people, eventType: 'card_refund_still_enrolled', subjectKey: 'enrolledRefundId', subjectId: r.id as string,
      title: LW.enrolledTitle(`${g!.player_first_name} ${g!.player_last_name}`, g!.player_first_name),
      body: LW.enrolledBody(formatMoney(Number(r.amount)), card, formatStoredDate(at.slice(0, 10), { withYear: false }), g!.player_first_name, formatMoney(base)),
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
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: p.onlinePaymentId, p_fee_included: p.feeIncluded, p_reason: p.reason, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
  });
  if (error) throw new Error(error.message);
  await landRefund(refundId as string, null);
  return { state: 'succeeded', refundId: refundId as string };
}
