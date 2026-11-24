import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeOrgAudit } from '@/lib/org-audit';
import { withObservability } from '@/lib/observability';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { hasPlanFeature } from '@/lib/plan-features';
import { onlineFeeRateLabel } from '@/lib/plan-config';
import { onlinePaymentsOn, stripeKeyIsTest, ONLINE_PAYMENTS_OFF_ERROR } from '@/lib/online-payments-switch';
import { canConnectPayouts, canSeePayouts } from '@/lib/online-payment-access';
import { factsFromRow, oldFeeSetting, payoutsState, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow, takesBankDebit, pausedForRefundPolicy } from '@/lib/online-payment-account';
import { ONLINE_FEE_PAYERS, onlineFee, SPONSOR_FEE_PAYERS, type OnlineFeePayer, type SponsorFeePayer } from '@/lib/online-payment-fee';
import { CLUB_ACCOUNT_FEES_COLLECTOR, createClubAccount, dashboardLink, onboardingLink, prefillClubProfile, retrieveAccount } from '@/lib/stripe-connect';
import { syncPayoutsAccount } from '@/lib/online-payment-landing';
import { stripeProfileFor } from '@/lib/online-payment-profile';
import { PAYMENTS_TERMS_VERSION, PAYOUTS_WORDS, TERMS_WORDS, termsStanding, termsVersionDate } from '@/lib/online-payment-words';
import { recordPaymentsTermsAgreement } from '@/lib/payments-terms-agreement';
import { isPublishedVersion } from '@/lib/legal-documents';
import { legalPageHref } from '@/lib/legal-links';
import { clearSettled } from '@/lib/needs-attention';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { endingNotice, readOutstanding, upcomingEnding } from '@/lib/online-payment-endings';
import { closeClubPayPages } from '@/lib/online-pay-pages';
import { hasBillingLocation, requireBillingLocation } from '@/lib/billing-location-server';
import { BILLING_LOCATION_WORDS, BILLING_REGION_CLOSED, isClosedRegion } from '@/lib/billing-location';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { demoBillingRefusal } from '@/lib/demo-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The Payouts card (Club Tier Stage 12a, drawn 12a §1–§4). GET reads it — the owner and the treasurer (A1). POST is the
 * owner's: connect (after "Before you set up payouts"), continue setup, open Stripe, disconnect. PATCH is the record's
 * autosave: who pays the fee (A14) and the refund-policy sentence (A9; REQUIRED since the owner's 2026-11-17 ruling — written
 * in the Before window, never cleared). Every door reads the launch switch and the plan. Every tick of the payments terms is
 * kept in `payments_terms_agreements` (mig 497) before the payouts row's standing changes.
 */

/** The refund policy as sent: trimmed, required, at most 300 characters (mig 358's CHECK). */
function refundPolicyOf(sent: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof sent === 'string' ? sent.trim() : '';
  if (text.length > 300) return { ok: false, error: 'Keep the refund policy to 300 characters.' };
  if (!text) return { ok: false, error: '' };
  return { ok: true, text };
}

const refused = () => NextResponse.json({ error: ONLINE_PAYMENTS_OFF_ERROR }, { status: 404 });
/** The payments terms moved while the window was open (/review of 12d-2): `connect` and `agree_terms` refuse alike. */
const termsChanged = () => NextResponse.json({ error: TERMS_WORDS.refuseChanged, code: 'terms_changed' }, { status: 409 });

type PayoutsContext = { ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>; isOwner: boolean; planOffers: boolean };

async function context(orgSlug: string | null): Promise<PayoutsContext | Response> {
  const ctx = await getAuthContextWithRole({ orgSlug: orgSlug ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!onlinePaymentsOn()) return refused();
  // 12d-2 (ask 4): a plan without online payments still has its account connected — the card stays as the wind-down card
  // (Open Stripe, Disconnect, the record, the payouts list); only setting up (connect) needs the plan. A club that never
  // connected on such a plan has no card at all.
  // Who may see payouts is asked FIRST, so a role without it learns nothing about the account (/review of Part 3).
  const member = { role: ctx.role, capabilities: ctx.capabilities };
  if (!canSeePayouts(member, ctx.org)) return forbidden();
  const planOffers = hasPlanFeature(ctx.org.planId, 'online_payments');
  if (!planOffers) {
    const { data } = await supabaseAdmin.from('org_payment_accounts').select('org_id').eq('org_id', ctx.org.id).maybeSingle();
    if (!data) return refused();
  }
  return { ctx, isOwner: canConnectPayouts(member), planOffers };
}

async function readAccount(orgId: string): Promise<PayoutsAccountRow & {
  connected_at: string; disconnected_by: string | null; terms_agreed_at: string | null; country: string | null;
  terms_version: string | null; terms_agreed_by: string | null; terms_agreed_by_email: string | null;
  sponsor_fee_payer: SponsorFeePayer;
} | null> {
  const { data } = await supabaseAdmin
    .from('org_payment_accounts')
    .select(`${PAYOUTS_ACCOUNT_COLUMNS}, connected_at, disconnected_by, terms_agreed_at, country, terms_version, terms_agreed_by, terms_agreed_by_email, sponsor_fee_payer`)
    .eq('org_id', orgId)
    .maybeSingle();
  return data as never;
}

/** Through the one writer (it used to read no answer at all). */
async function audit(orgId: string, actorId: string, action: string, payload: Record<string, unknown>) {
  await writeOrgAudit(orgId, actorId, null, action, payload);
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
  // on an account that takes it; an account that doesn't prints today's card-only line. A club setting up again (its account
  // disconnected, or on the old fee setting, Stripe-owned pricing Stage 2) is setting up a NEW account, so it reads as before
  // setup: its "Before you set up payouts" window printed the card rate alone (found writing the Stages 2–5 walk, 2026-11-18).
  const bank = !facts || !!facts.disconnectedAt || oldFeeSetting(facts) || takesBankDebit(facts);
  const bankExample = onlineFee(16_500, facts?.feePayer ?? 'family', 'bankDebit');
  // 12d-2 (words §4.1, ask 11): the Disconnect window's counts — the owner's, while connected. One read for every ending.
  // A failed count leaves the window's counts out rather than failing the card (the window never says "nobody owes" then).
  const out = isOwner && facts && !facts.disconnectedAt ? await readOutstanding(ctx.org.id).catch(() => null) : null;
  return NextResponse.json({
    state: payoutsState(facts),
    isOwner,
    testMode: row ? !row.livemode : stripeKeyIsTest(),
    rateLabel: onlineFeeRateLabel('card'),
    bankRateLabel: bank ? onlineFeeRateLabel('bankDebit') : null,
    // The "Before" window's one worked line, computed from config — never typed (copy §3).
    example: { baseCents: example.baseCents, feeCents: example.feeCents, bankFeeCents: bank ? bankExample.feeCents : null },
    feePayer: facts?.feePayer ?? 'family',
    // Board Ready Stage 6 (ask 3, ruled 2026-11-22; round 2 tab 1): the second, separate choice for sponsorships — shown only
    // on a plan that carries Sponsorships. The club pays it by default; the registration choice never decides it.
    sponsorshipsOnPlan: hasModuleEntitlement(ctx.org, 'module_sponsorships'),
    sponsorFeePayer: row?.sponsor_fee_payer ?? 'club',
    refundPolicy: facts?.refundPolicy ?? '',
    requirementsDue: facts?.requirementsDue.length ?? 0,
    deadline: facts?.requirementsDeadline ?? null,
    paymentsOn: takesPayments(facts),
    // Paused for the refund policy alone (owner 2026-11-17): the card's reason and button, and the treasurer's line.
    pausedForPolicy: pausedForRefundPolicy(facts),
    connectedAt: row?.connected_at ?? null,
    disconnectedAt: row?.disconnected_at ?? null,
    disconnectedBy: row?.disconnected_at ? await nameOf(row.disconnected_by) : null,
    teamsStillOwing: out?.teamsOwing ?? null,
    debitsClearing: out?.debitsClearing ?? null,
    familiesOwing: out?.familiesOwing ?? null,
    openPages: out?.openPages ?? null,
    openDisputes: out?.openDisputes ?? null,
    firstDisputeDue: out?.firstDisputeDue ?? null,
    // 12d-2 Part 4 (words §5.1, ask 6): who agreed, when, to which version — the owner's read-out. An owner who has left
    // keeps their name: the stored email stands in once the user is gone.
    terms: isOwner && row?.terms_agreed_at ? {
      standing: termsStanding(row.terms_version),
      agreedBy: (await nameOf(row.terms_agreed_by)) ?? row.terms_agreed_by_email ?? '',
      agreedAt: row.terms_agreed_at,
      agreedVersionDate: termsVersionDate(row.terms_version),
      currentVersionDate: termsVersionDate(PAYMENTS_TERMS_VERSION),
      // The published page of the version this owner agreed to (2026-11-24); null for the draft, which has no page.
      agreedHref: row.terms_version && isPublishedVersion('payments', row.terms_version) ? legalPageHref('payments', row.terms_version) : null,
    } : null,
    // The Payments Terms a tick records now: that version's own page, so the words read are the words agreed to.
    termsHref: legalPageHref('payments', PAYMENTS_TERMS_VERSION),
    // 12d-2 (words §3.3, ask 5): a club without Accounting reads its payouts on the owner's card instead of a tab.
    hasAccounting: hasModuleEntitlement(ctx.org, 'module_accounting'),
    everConnected: !!row,
    // 12d-2: the plan no longer offers online payments while the account stays connected — the wind-down card.
    windDown: !c.planOffers,
    // 12d-2 (words §4.2): an ending the owner didn't choose is told on the card (the item and email are the daily job's).
    ending: isOwner && facts && !facts.disconnectedAt && c.planOffers
      ? await upcomingEnding(ctx.org.id).then(e => (e ? endingNotice(e, ctx.org.name, out) : null)).catch(() => null)
      : null,
    // GST/HST Stage 2 Part 2b (owner ruling A), kept by Stripe-owned pricing Stage 4 call (a), 2026-11-18: a club connected
    // without a billing address on our records (the one setting up requires) — the GST/HST inside our fee needs its province.
    // The owner's, while connected. A failed read leaves the line off.
    addressMissing: isOwner && facts && !facts.disconnectedAt
      ? !(await hasBillingLocation({ kind: 'org', orgId: ctx.org.id, name: ctx.org.name }).catch(() => true))
      : false,
  });
}, { route: '/api/admin/payouts' });

export const PATCH = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const c = await context(typeof body.orgSlug === 'string' ? body.orgSlug : null);
  if (c instanceof Response) return c;
  if (!c.isOwner) return forbidden();
  const { ctx } = c;
  // Names its club only in the body, so the proxy cannot see it, and the demo organizer is an owner (the shared refusal).
  const demoRefusal = demoBillingRefusal(ctx.user);
  if (demoRefusal) return demoRefusal;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('feePayer' in body || 'sponsorFeePayer' in body) {
    // 12d-2 (ask 6): changing who pays the fee needs the current terms; agreeing again is the terms window's.
    const { data: agreed } = await supabaseAdmin.from('org_payment_accounts').select('terms_version').eq('org_id', ctx.org.id).maybeSingle();
    if (agreed && termsStanding(agreed.terms_version as string | null) === 'stale') {
      return NextResponse.json({ error: TERMS_WORDS.refuseFee, code: 'terms_stale' }, { status: 409 });
    }
    if ('feePayer' in body) {
      if (!ONLINE_FEE_PAYERS.includes(body.feePayer)) return NextResponse.json({ error: 'Choose who pays the fee.' }, { status: 400 });
      update.fee_payer = body.feePayer as OnlineFeePayer;
    }
    // Board Ready Stage 6 (ask 3): the sponsorships row, its own column; never a plan without Sponsorships.
    if ('sponsorFeePayer' in body) {
      if (!hasModuleEntitlement(ctx.org, 'module_sponsorships') || !SPONSOR_FEE_PAYERS.includes(body.sponsorFeePayer)) {
        return NextResponse.json({ error: 'Choose who pays the fee.' }, { status: 400 });
      }
      update.sponsor_fee_payer = body.sponsorFeePayer as SponsorFeePayer;
    }
  }
  if ('refundPolicy' in body) {
    // Required (owner 2026-11-17): it can be changed, never cleared — a blank one would close every pay page.
    const policy = refundPolicyOf(body.refundPolicy);
    if (!policy.ok) return NextResponse.json({ error: policy.error || PAYOUTS_WORDS.record.policyRequired, code: 'refund_policy_required' }, { status: 400 });
    update.refund_policy = policy.text;
  }
  const { data, error } = await supabaseAdmin.from('org_payment_accounts').update(update).eq('org_id', ctx.org.id).select('org_id').maybeSingle();
  if (error) throw error;
  if (!data) return NextResponse.json({ error: 'Set up payouts first.' }, { status: 409 });
  if ('fee_payer' in update) await audit(ctx.org.id, ctx.user.id, 'payouts_fee_payer_changed', { feePayer: update.fee_payer });
  if ('sponsor_fee_payer' in update) await audit(ctx.org.id, ctx.user.id, 'payouts_sponsor_fee_payer_changed', { sponsorFeePayer: update.sponsor_fee_payer });
  // A club paused for want of a policy is back on: its Needs-attention item settles now, not at Stripe's next event.
  if ('refund_policy' in update) await clearSettled({ orgIds: [ctx.org.id], kinds: ['payouts_need_attention'] });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/payouts' });

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const c = await context(typeof body.orgSlug === 'string' ? body.orgSlug : null);
  if (c instanceof Response) return c;
  if (!c.isOwner) return forbidden();
  const { ctx } = c;
  const demoRefusal = demoBillingRefusal(ctx.user);
  if (demoRefusal) return demoRefusal;
  // Not `new URL(req.url).origin`: on the hosted site that is the server's internal address (localhost).
  const origin = resolveTrustedAppOrigin(req);
  const back = (refresh: boolean) =>
    `${origin}/api/admin/payouts/return?orgSlug=${encodeURIComponent(ctx.org.slug)}${refresh ? '&refresh=1' : ''}`;
  const row = await readAccount(ctx.org.id);
  const now = new Date().toISOString();

  switch (body.action) {
    case 'connect': {
      // Setting up (or up again) is a NEW payment door: the plan must offer online payments (12d-2, ask 4).
      if (!c.planOffers) return refused();
      // "Before you set up payouts": the who-pays choice and the terms, recorded before Stripe (owner 2026-10-24).
      if (body.agreeToTerms !== true) return NextResponse.json({ error: TERMS_WORDS.refuseSetup }, { status: 400 });
      // The version the window showed, as `agree_terms` checks it (GST/HST Stage 6 step 6.3 A6): terms published while the
      // window was open are never agreed unread, and the row below stamps only the version the person read.
      if (body.termsVersion !== PAYMENTS_TERMS_VERSION) return termsChanged();
      // The refund policy is written in the same window, before Stripe (owner 2026-11-17: required; payments terms §6).
      const policy = refundPolicyOf(body.refundPolicy);
      if (!policy.ok) return NextResponse.json({ error: policy.error || PAYOUTS_WORDS.before.policyRequired, code: 'refund_policy_required' }, { status: 400 });
      // GST/HST Stage 2 Part 2b (Ask 8): the club's billing address, before ANY Stripe call — a new account and a reconnect
      // alike. Kept by Stripe-owned pricing Stage 4 call (a), owner 2026-11-18: the GST/HST inside our application fee is
      // worked out from the club's province, which must be known before its first fee. A refusal (`billing_address_required`,
      // or a held US address) creates and changes nothing; the card opens the window. The club's OWN row (kind 'org'), the
      // one the Payouts card's address line reads (`hasBillingLocation`), never the payout account's.
      const address = await requireBillingLocation({ kind: 'org', orgId: ctx.org.id, name: ctx.org.name, stripeCustomerId: ctx.org.stripeCustomerId ?? null });
      if (!address.ok) return address.response;
      // Online payments are not offered in Québec (payments terms §14, Terms of Service §17; owner 2026-11-17 over Q6's
      // "payouts untouched"): setting up, and setting up again, refuse a Québec address as a purchase does — the address on
      // file, same code, before any Stripe call. A club already taking payments is not touched.
      if (isClosedRegion(address.location)) {
        return NextResponse.json({ error: BILLING_LOCATION_WORDS.regionClosedPayouts, code: BILLING_REGION_CLOSED, buyer: 'club' }, { status: 409 });
      }
      // Where the club's money is paid out to (Board Ready two-step, Part 2): a fresh code first, after every check above.
      const stale = await requireFreshCode();
      if (stale) return stale;
      const feePayer: OnlineFeePayer = ONLINE_FEE_PAYERS.includes(body.feePayer) ? body.feePayer : 'family';
      const terms = { terms_version: PAYMENTS_TERMS_VERSION, terms_agreed_by: ctx.user.id, terms_agreed_by_email: ctx.user.email ?? 'unknown', terms_agreed_at: now };
      let accountId = row?.stripe_account_id ?? null;
      // An account made under the old fee setting is REPLACED, never reused (owner 2026-11-18, Stripe-owned pricing Stage 2):
      // the setting is immutable at Stripe, so setting up again makes a new Stripe-owned account in its place.
      const replacing = !!row && oldFeeSetting(factsFromRow(row));
      if (!accountId || replacing) {
        // The tick is kept before anything is created (mig 497): it is true even if Stripe then refuses.
        await recordPaymentsTermsAgreement({ org: ctx.org, user: ctx.user, action: 'set_up', at: now });
        const acct = await createClubAccount({ orgId: ctx.org.id, email: ctx.user.email ?? null, businessName: ctx.org.name });
        accountId = acct.id;
        if (replacing) {
          // The old account's Stripe facts are not the new one's: emptied here, read afresh by the sync below. Only the row
          // still holding the old account is changed, so two presses cannot both replace it.
          const { data: replaced, error } = await supabaseAdmin.from('org_payment_accounts').update({
            stripe_account_id: acct.id, fees_collector: CLUB_ACCOUNT_FEES_COLLECTOR, livemode: !stripeKeyIsTest(),
            card_payments_status: null, card_payments_reason: null, bank_debit_status: null, onboarding_finished_at: null,
            requirements_due: [], requirements_deadline: null, country: null, stripe_synced_at: null,
            disconnected_at: null, disconnected_by: null,
            fee_payer: feePayer, refund_policy: policy.text, connected_by: ctx.user.id, connected_at: now, updated_at: now, ...terms,
          }).eq('org_id', ctx.org.id).eq('stripe_account_id', row!.stripe_account_id).select('org_id');
          if (error) throw error;
          // Nothing matched: a second press replaced it first. Its account is this one (the same idempotency key), so go on;
          // anything else changed the row under us, and the club presses again rather than linking a stray account.
          if (!replaced?.length && (await readAccount(ctx.org.id))?.stripe_account_id !== acct.id) {
            return NextResponse.json({ error: 'Your payouts changed while this was saving. Please try again.' }, { status: 409 });
          }
        } else {
          const { error } = await supabaseAdmin.from('org_payment_accounts').upsert({
            org_id: ctx.org.id, stripe_account_id: acct.id, fees_collector: CLUB_ACCOUNT_FEES_COLLECTOR, livemode: !stripeKeyIsTest(),
            fee_payer: feePayer, refund_policy: policy.text, connected_by: ctx.user.id, connected_at: now, ...terms,
          }, { onConflict: 'org_id', ignoreDuplicates: true });
          if (error) throw error;
        }
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
        await recordPaymentsTermsAgreement({ org: ctx.org, user: ctx.user, action: 'reconnect', at: now });
        const { error: reconnectError } = await supabaseAdmin.from('org_payment_accounts').update({
          disconnected_at: null, disconnected_by: null, fee_payer: feePayer, refund_policy: policy.text, connected_by: ctx.user.id, connected_at: now, updated_at: now, ...terms,
        }).eq('org_id', ctx.org.id);
        if (reconnectError) throw reconnectError;
      }
      await audit(ctx.org.id, ctx.user.id, 'payouts_connected', { stripeAccountId: accountId, feePayer, termsVersion: PAYMENTS_TERMS_VERSION, ...(replacing ? { replacedAccount: row!.stripe_account_id, replacedFor: 'old_fee_setting' } : {}) });
      const synced = await syncPayoutsAccount(accountId);
      if (payoutsState(factsFromRow(synced)) === 'taking_payments') return NextResponse.json({ url: null });
      return NextResponse.json({ url: await onboardingLink(accountId, back(true), back(false)) });
    }
    case 'agree_terms': {
      // 12d-2 Part 4 (words §5.3, ask 6): agree to the current version. Payments stayed on throughout; nothing else moves.
      if (body.agreeToTerms !== true) return NextResponse.json({ error: TERMS_WORDS.refuseSetup }, { status: 400 });
      if (!row) return NextResponse.json({ error: 'Set up payouts first.' }, { status: 409 });
      // The version the window showed (/review of 12d-2): terms published while it was open are never agreed unread.
      if (body.termsVersion !== PAYMENTS_TERMS_VERSION) return termsChanged();
      await recordPaymentsTermsAgreement({ org: ctx.org, user: ctx.user, action: 'agree_again', at: now });
      const { error: agreeError } = await supabaseAdmin.from('org_payment_accounts').update({
        terms_version: PAYMENTS_TERMS_VERSION, terms_agreed_by: ctx.user.id, terms_agreed_by_email: ctx.user.email ?? 'unknown',
        terms_agreed_at: now, updated_at: now,
      }).eq('org_id', ctx.org.id);
      if (agreeError) throw agreeError;
      await audit(ctx.org.id, ctx.user.id, 'payouts_terms_agreed', { termsVersion: PAYMENTS_TERMS_VERSION });
      return NextResponse.json({ ok: true });
    }
    case 'continue': {
      if (!row || row.disconnected_at) return NextResponse.json({ error: 'Set up payouts first.' }, { status: 409 });
      // Stripe's sign-up is where the bank account is typed: a fresh code first.
      const stale = await requireFreshCode();
      if (stale) return stale;
      return NextResponse.json({ url: await onboardingLink(row.stripe_account_id, back(true), back(false)) });
    }
    case 'dashboard': {
      // Stripe refuses a dashboard sign-in until its sign-up is finished; an account taking card payments has finished it.
      if (!row?.onboarding_finished_at && row?.card_payments_status !== 'active') return NextResponse.json({ error: 'Finish setting up payouts first.' }, { status: 409 });
      // Stripe's dashboard is where the bank account is changed: a fresh code first.
      const stale = await requireFreshCode();
      if (stale) return stale;
      return NextResponse.json({ url: await dashboardLink(row.stripe_account_id) });
    }
    case 'disconnect': {
      if (!row || row.disconnected_at) return NextResponse.json({ ok: true });
      const stale = await requireFreshCode();
      if (stale) return stale;
      // A1: stops new payments. Past payments stay in the books; their refunds are made in Stripe.
      await supabaseAdmin.from('org_payment_accounts').update({ disconnected_at: now, disconnected_by: ctx.user.id, updated_at: now }).eq('org_id', ctx.org.id);
      // 12d-2 (ask 11): every ending closes the club's open pay pages. A debit already submitted is no open page.
      const pagesClosed = await closeClubPayPages(ctx.org.id, 'disconnect');
      await audit(ctx.org.id, ctx.user.id, 'payouts_disconnected', { stripeAccountId: row.stripe_account_id, pagesClosed });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}, { route: '/api/admin/payouts' });
