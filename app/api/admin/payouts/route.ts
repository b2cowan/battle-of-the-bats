import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { hasPlanFeature } from '@/lib/plan-features';
import { onlineFeeRateLabel } from '@/lib/plan-config';
import { onlinePaymentsOn, stripeKeyIsTest, ONLINE_PAYMENTS_OFF_ERROR } from '@/lib/online-payments-switch';
import { canConnectPayouts, canSeePayouts } from '@/lib/online-payment-access';
import { factsFromRow, payoutsState, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow, takesBankDebit } from '@/lib/online-payment-account';
import { ONLINE_FEE_PAYERS, onlineFee, type OnlineFeePayer } from '@/lib/online-payment-fee';
import { createClubAccount, dashboardLink, onboardingLink, prefillClubProfile, retrieveAccount } from '@/lib/stripe-connect';
import { syncPayoutsAccount } from '@/lib/online-payment-landing';
import { stripeProfileFor } from '@/lib/online-payment-profile';
import { PAYMENTS_TERMS_VERSION } from '@/lib/online-payment-words';
import { effectiveOrgFactsForId } from '@/lib/entitlement-grants';
import { workspaceHoldsFoundingComp } from '@/lib/founding-season';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The Payouts card (Club Tier Stage 12a, drawn 12a §1–§4). GET reads it — the owner and the treasurer (A1). POST is the
 * owner's: connect (after "Before you set up payouts"), continue setup, open Stripe, disconnect. PATCH is the record's
 * autosave: who pays the fee (A14) and the refund-policy sentence (A9). Every door reads the launch switch and the plan.
 */

const refused = () => NextResponse.json({ error: ONLINE_PAYMENTS_OFF_ERROR }, { status: 404 });

type PayoutsContext = { ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>; isOwner: boolean };

async function context(orgSlug: string | null): Promise<PayoutsContext | Response> {
  const ctx = await getAuthContextWithRole({ orgSlug: orgSlug ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!onlinePaymentsOn() || !hasPlanFeature(ctx.org.planId, 'online_payments')) return refused();
  const member = { role: ctx.role, capabilities: ctx.capabilities };
  if (!canSeePayouts(member, ctx.org)) return forbidden();
  return { ctx, isOwner: canConnectPayouts(member) };
}

async function readAccount(orgId: string): Promise<PayoutsAccountRow & {
  connected_at: string; disconnected_by: string | null; terms_agreed_at: string | null; country: string | null;
} | null> {
  const { data } = await supabaseAdmin
    .from('org_payment_accounts')
    .select(`${PAYOUTS_ACCOUNT_COLUMNS}, connected_at, disconnected_by, terms_agreed_at, country`)
    .eq('org_id', orgId)
    .maybeSingle();
  return data as never;
}

/** 12c Part 6 (words §3.8): the club's bank debits still clearing — they finish after a Disconnect, and the window says so. */
async function debitsClearing(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin.from('online_payments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'clearing');
  return count ?? 0;
}

/** Teams that still owe on an event that isn't over — the disconnect window's count. */
async function teamsStillOwing(orgId: string): Promise<number> {
  const { data: ts } = await supabaseAdmin.from('tournaments').select('id').eq('org_id', orgId).in('status', ['draft', 'active']);
  const ids = (ts ?? []).map(t => t.id as string);
  if (!ids.length) return 0;
  const { count } = await supabaseAdmin.from('teams').select('id', { count: 'exact', head: true })
    .in('tournament_id', ids).eq('status', 'accepted').neq('payment_status', 'paid');
  return count ?? 0;
}

async function audit(orgId: string, actorId: string, action: string, payload: Record<string, unknown>) {
  await supabaseAdmin.from('org_audit_log').insert({ org_id: orgId, actor_id: actorId, action, payload });
}

async function nameOf(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const u = data?.user;
  return (u?.user_metadata?.full_name as string | undefined) ?? u?.email ?? null;
}

export const GET = withObservability(async (req: Request) => {
  const c = await context(new URL(req.url).searchParams.get('orgSlug'));
  if (c instanceof Response) return c;
  const { ctx, isOwner } = c;
  const row = await readAccount(ctx.org.id);
  const facts = factsFromRow(row);
  const example = onlineFee(16_500, facts?.feePayer ?? 'family');
  // 12c Part 6 (words §4): both rates print wherever a rate does — before setup (a new account asks for bank debit too), and
  // on an account that takes it; an account that doesn't prints today's card-only line.
  const bank = !facts || takesBankDebit(facts);
  const bankExample = onlineFee(16_500, facts?.feePayer ?? 'family', 'bankDebit');
  return NextResponse.json({
    state: payoutsState(facts),
    isOwner,
    testMode: row ? !row.livemode : stripeKeyIsTest(),
    rateLabel: onlineFeeRateLabel('card'),
    bankRateLabel: bank ? onlineFeeRateLabel('bankDebit') : null,
    // The "Before" window's one worked line, computed from config — never typed (copy §3).
    example: { baseCents: example.baseCents, feeCents: example.feeCents, bankFeeCents: bank ? bankExample.feeCents : null },
    feePayer: facts?.feePayer ?? 'family',
    refundPolicy: facts?.refundPolicy ?? '',
    requirementsDue: facts?.requirementsDue.length ?? 0,
    deadline: facts?.requirementsDeadline ?? null,
    paymentsOn: takesPayments(facts),
    connectedAt: row?.connected_at ?? null,
    disconnectedAt: row?.disconnected_at ?? null,
    disconnectedBy: row?.disconnected_at ? await nameOf(row.disconnected_by) : null,
    teamsStillOwing: isOwner && facts && !facts.disconnectedAt ? await teamsStillOwing(ctx.org.id) : null,
    debitsClearing: isOwner && facts && !facts.disconnectedAt ? await debitsClearing(ctx.org.id) : null,
    // 12d-1 Part 4 (words §3.4): a club that pays nothing for its plan reads "Your plan doesn't change" beside the
    // other-fees line, so a Stripe fee is never read as its comp being withdrawn. An extra read: a failure omits it.
    planFree: await planIsFree(ctx.org.id),
  });
}, { route: '/api/admin/payouts' });

async function planIsFree(orgId: string): Promise<boolean> {
  const [facts, founding] = await Promise.all([
    effectiveOrgFactsForId(orgId).catch(() => null),
    workspaceHoldsFoundingComp(orgId).catch(() => false),
  ]);
  return !!facts?.freeTime || founding;
}

export const PATCH = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const c = await context(typeof body.orgSlug === 'string' ? body.orgSlug : null);
  if (c instanceof Response) return c;
  if (!c.isOwner) return forbidden();
  const { ctx } = c;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('feePayer' in body) {
    if (!ONLINE_FEE_PAYERS.includes(body.feePayer)) return NextResponse.json({ error: 'Choose who pays the fee.' }, { status: 400 });
    update.fee_payer = body.feePayer as OnlineFeePayer;
  }
  if ('refundPolicy' in body) {
    const text = typeof body.refundPolicy === 'string' ? body.refundPolicy.trim() : '';
    if (text.length > 300) return NextResponse.json({ error: 'Keep the refund policy to 300 characters.' }, { status: 400 });
    update.refund_policy = text || null;
  }
  const { data, error } = await supabaseAdmin.from('org_payment_accounts').update(update).eq('org_id', ctx.org.id).select('org_id').maybeSingle();
  if (error) throw error;
  if (!data) return NextResponse.json({ error: 'Set up payouts first.' }, { status: 409 });
  if ('fee_payer' in update) await audit(ctx.org.id, ctx.user.id, 'payouts_fee_payer_changed', { feePayer: update.fee_payer });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/payouts' });

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const c = await context(typeof body.orgSlug === 'string' ? body.orgSlug : null);
  if (c instanceof Response) return c;
  if (!c.isOwner) return forbidden();
  const { ctx } = c;
  const origin = new URL(req.url).origin;
  const back = (refresh: boolean) =>
    `${origin}/api/admin/payouts/return?orgSlug=${encodeURIComponent(ctx.org.slug)}${refresh ? '&refresh=1' : ''}`;
  const row = await readAccount(ctx.org.id);
  const now = new Date().toISOString();

  switch (body.action) {
    case 'connect': {
      // "Before you set up payouts": the who-pays choice and the terms, recorded before Stripe (owner 2026-10-24).
      if (body.agreeToTerms !== true) return NextResponse.json({ error: 'Agree to the payments terms first.' }, { status: 400 });
      const feePayer: OnlineFeePayer = ONLINE_FEE_PAYERS.includes(body.feePayer) ? body.feePayer : 'family';
      const terms = { terms_version: PAYMENTS_TERMS_VERSION, terms_agreed_by: ctx.user.id, terms_agreed_by_email: ctx.user.email ?? 'unknown', terms_agreed_at: now };
      let accountId = row?.stripe_account_id ?? null;
      if (!accountId) {
        const acct = await createClubAccount({ orgId: ctx.org.id, email: ctx.user.email ?? null, businessName: ctx.org.name });
        accountId = acct.id;
        const { error } = await supabaseAdmin.from('org_payment_accounts').upsert({
          org_id: ctx.org.id, stripe_account_id: acct.id, livemode: !stripeKeyIsTest(),
          fee_payer: feePayer, connected_by: ctx.user.id, connected_at: now, ...terms,
        }, { onConflict: 'org_id', ignoreDuplicates: true });
        if (error) throw error;
        // What Stripe's sign-up would otherwise ask (walk 2026-10-25): the club's public site, or a description. Never blocks.
        // The app's own address only — never the request's Host, which a client can name (/review 2026-10-25).
        const profile = await stripeProfileFor(ctx.org, process.env.NEXT_PUBLIC_APP_URL ?? '').catch(() => null);
        if (profile) await prefillClubProfile(acct.id, profile);
      } else {
        // Reconnecting reuses the club's account (a Stripe-covered account is never deleted) — unless Stripe has closed
        // it. Checked BEFORE the row changes: clearing the disconnect first would let a pay page open on a dead account.
        if ((await retrieveAccount(accountId)).closed) {
          return NextResponse.json({ error: 'Stripe has closed this club’s payouts account, so it can’t be reconnected. Contact FieldLogicHQ support to set up a new one.' }, { status: 409 });
        }
        await supabaseAdmin.from('org_payment_accounts').update({
          disconnected_at: null, disconnected_by: null, fee_payer: feePayer, connected_by: ctx.user.id, connected_at: now, updated_at: now, ...terms,
        }).eq('org_id', ctx.org.id);
      }
      await audit(ctx.org.id, ctx.user.id, 'payouts_connected', { stripeAccountId: accountId, feePayer, termsVersion: PAYMENTS_TERMS_VERSION });
      const synced = await syncPayoutsAccount(accountId);
      if (payoutsState(factsFromRow(synced)) === 'taking_payments') return NextResponse.json({ url: null });
      return NextResponse.json({ url: await onboardingLink(accountId, back(true), back(false)) });
    }
    case 'continue': {
      if (!row || row.disconnected_at) return NextResponse.json({ error: 'Set up payouts first.' }, { status: 409 });
      return NextResponse.json({ url: await onboardingLink(row.stripe_account_id, back(true), back(false)) });
    }
    case 'dashboard': {
      // Stripe refuses a dashboard sign-in until its sign-up is finished; an account taking card payments has finished it.
      if (!row?.onboarding_finished_at && row?.card_payments_status !== 'active') return NextResponse.json({ error: 'Finish setting up payouts first.' }, { status: 409 });
      return NextResponse.json({ url: await dashboardLink(row.stripe_account_id) });
    }
    case 'disconnect': {
      if (!row || row.disconnected_at) return NextResponse.json({ ok: true });
      // A1: stops new payments. Past payments stay in the books; their refunds are made in Stripe.
      await supabaseAdmin.from('org_payment_accounts').update({ disconnected_at: now, disconnected_by: ctx.user.id, updated_at: now }).eq('org_id', ctx.org.id);
      await audit(ctx.org.id, ctx.user.id, 'payouts_disconnected', { stripeAccountId: row.stripe_account_id });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}, { route: '/api/admin/payouts' });
