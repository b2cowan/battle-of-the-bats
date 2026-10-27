import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { sendEmail, orgClosedHtml } from '@/lib/email';
import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import { withObservability, captureError } from '@/lib/observability';
import { stopClubDomain } from '@/lib/club-domain-service';
import { clubDomainDeps } from '@/lib/club-domain-deps';
import { inFlightRefusal, moneyInFlight, readOutstanding } from '@/lib/online-payment-endings';
import { closeClubPayPages } from '@/lib/online-pay-pages';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
};

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('delete_records');
  if (auth.response) return auth.response;

  const { id } = await params;

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, subscription_status, stripe_subscription_id, stripe_customer_id')
    .eq('id', id)
    .single<OrgRow>();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
  }

  const [memberCount, tournamentCount, coachesLinkCount, retentionCount] = await Promise.all([
    supabaseAdmin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id),
    supabaseAdmin
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', id)
      .neq('status', 'archived'),
    supabaseAdmin
      .from('team_org_links')
      .select('*', { count: 'exact', head: true })
      .eq('linked_org_id', id),
    supabaseAdmin
      .from('billing_retained_records')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', id)
      .eq('retained_state', 'retained_inactive'),
  ]);

  const hasActiveSubscription =
    !!org.stripe_subscription_id && org.subscription_status !== 'canceled';
  // 12d-2 (owner ruling 2): the window names the money in flight before Delete is pressed, as the refusal will.
  const outstanding = await readOutstanding(id).catch(() => null);
  const inFlight = outstanding ? moneyInFlight(outstanding) : [];

  return NextResponse.json({
    orgName: org.name,
    orgSlug: org.slug,
    planLabel: PLAN_CONFIG[org.plan_id as OrgPlan]?.label ?? org.plan_id,
    subscriptionStatus: org.subscription_status,
    stripeSubscriptionId: org.stripe_subscription_id,
    stripeCustomerId: org.stripe_customer_id,
    hasActiveSubscription,
    memberCount: memberCount.count ?? 0,
    tournamentCount: tournamentCount.count ?? 0,
    coachesLinkCount: coachesLinkCount.count ?? 0,
    retentionRecordCount: retentionCount.count ?? 0,
    paymentsInFlight: !outstanding ? 'Couldn’t read this club’s online payments. Try again.' : inFlight.length ? inFlightRefusal(inFlight) : null,
  });
}, { route: '/api/platform-admin/orgs/[id]/delete' });

export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('delete_records');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    reason?: string;
    confirmSlug?: string;
    notifyOwner?: boolean;
    deleteStripeCustomer?: boolean;
  };
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;
  const confirmSlug = typeof body.confirmSlug === 'string' ? body.confirmSlug.trim() : '';
  const notifyOwner = body.notifyOwner === true;
  const deleteStripeCustomer = body.deleteStripeCustomer === true;

  if (!reason) {
    return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, subscription_status, stripe_subscription_id, stripe_customer_id')
    .eq('id', id)
    .single<OrgRow>();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
  }

  if (confirmSlug !== org.slug) {
    return NextResponse.json(
      { error: `Slug confirmation does not match. Expected "${org.slug}".` },
      { status: 400 }
    );
  }

  if (org.stripe_subscription_id && org.subscription_status !== 'canceled') {
    return NextResponse.json(
      {
        error:
          'This organization has an active Stripe subscription. Cancel it first using ' +
          'Cancel Subscription in the Billing & Access tab, then return here to delete.',
      },
      { status: 400 }
    );
  }

  // 12d-2 (owner ruling 2, 2026-10-27): money in flight waits — an open card dispute, a bank debit clearing, a Stripe fee
  // not billed or whose billing failed, the club's own Stripe-fee invoice unpaid. A count that can't be read refuses too:
  // the money record of a club that still owes must never vanish silently.
  const outstanding = await readOutstanding(id).catch(() => null);
  if (!outstanding) {
    return NextResponse.json({ error: 'Couldn’t read this club’s online payments. Try again.' }, { status: 503 });
  }
  const inFlight = moneyInFlight(outstanding);
  if (inFlight.length) {
    return NextResponse.json({ error: inFlightRefusal(inFlight), inFlight }, { status: 409 });
  }
  // We disconnect before deleting (words §4.4): the club's open pay pages close first, so no family pays a club that is
  // gone. The Stripe account itself stays the club's, with any money in it (ask 4).
  if (outstanding.connected) {
    await closeClubPayPages(id, 'operator delete');
    // Counted AGAIN after the close (/review of Part 3): a page Stripe was slow to close, or one a family finished a
    // moment ago (its payment not landed yet), is still open here — deleting now would leave that payment with no
    // record. So would a dispute or a debit that arrived since the first count. Refuse, naming it; try again later.
    const again = await readOutstanding(id).catch(() => null);
    if (!again) return NextResponse.json({ error: 'Couldn’t read this club’s online payments. Try again.' }, { status: 503 });
    if (again.openPages > 0) {
      return NextResponse.json({ error: `${again.openPages === 1 ? 'A pay page is' : `${again.openPages} pay pages are`} still open or finishing. Try the delete again in a few minutes.` }, { status: 409 });
    }
    const late = moneyInFlight(again);
    if (late.length) return NextResponse.json({ error: inFlightRefusal(late), inFlight: late }, { status: 409 });
  }

  // Notify the org owner before deletion so they get one last email while the
  // org data (and owner lookup) still exists.
  if (notifyOwner) {
    const ownerEmail = await getOrgOwnerEmail(id);
    if (ownerEmail) {
      const planLabel = PLAN_CONFIG[org.plan_id as OrgPlan]?.label ?? org.plan_id;
      await sendEmail(
        ownerEmail,
        `Your ${org.name} account has been closed`,
        orgClosedHtml({ orgName: org.name, planLabel, contactEmail: 'support@fieldlogichq.ca' }),
        { kind: 'org_closed', orgId: id, askedBy: auth.user.id },
      );
    }
  }

  // Write the audit record with org_id: null so it doesn't create a FK reference
  // to the org row we're about to delete. The org details are preserved in new_value.
  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'delete_organization',
    'org_slug',
    org.slug,
    {
      orgId: id,
      orgName: org.name,
      planId: org.plan_id,
      subscriptionStatus: org.subscription_status,
      stripeCustomerId: org.stripe_customer_id,
      notifyOwner,
    },
    { reason },
  );

  // Purge tables whose org_id FKs are NO ACTION (confirmed via schema check). The club's held time first (mig 322): its
  // blocks name the facilities. Blocks, never permits — a permit carrying money in a closed year refuses a delete.
  // The club's schedules too (Club Tier 11a, mig 326): their slots name the facilities (NO ACTION), and the schedule takes
  // its slots, its blocks, its replies and its sends with it.
  await supabaseAdmin.from('club_schedules').delete().eq('org_id', id);
  await supabaseAdmin.from('org_time_blocks').delete().eq('org_id', id);
  await supabaseAdmin.from('org_venue_facilities').delete().eq('org_id', id);

  // Purge billing records before the org delete — FK on org_id may not cascade.
  await supabaseAdmin.from('billing_retained_records').delete().eq('org_id', id);
  await supabaseAdmin.from('billing_retention_intents').delete().eq('org_id', id);

  // A club's own web address (Club Tier Stage 4e): let the host release the name BEFORE the row cascades away with the org, or
  // the association would be left holding the domain (and a slot of our domain limit) with nothing in our database naming it.
  // Best effort: a host that cannot be reached must not block closing an account; the cause is reported and the delete goes on.
  try {
    const stopped = await stopClubDomain(clubDomainDeps(), id);
    if (!stopped.ok && stopped.reason === 'failed') {
      await captureError(new Error(`org delete: the host did not release the club's own address for org ${id}`));
    }
  } catch (e) {
    await captureError(e);
  }

  // Hard-delete. DB cascade handles members, tournaments, overrides, notes,
  // org_audit_log entries (if FK is CASCADE — validated before prod use).
  const { error: deleteError } = await supabaseAdmin
    .from('organizations')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('[platform-admin] delete-org error:', deleteError);
    return NextResponse.json(
      { error: deleteError.message ?? 'Delete failed.' },
      { status: 500 }
    );
  }

  // Optional GDPR: delete the Stripe customer object after the org row is gone.
  // Run after the DB delete so a Stripe failure doesn't block an already-complete deletion.
  let stripeCustomerWarning: string | null = null;
  if (deleteStripeCustomer && org.stripe_customer_id) {
    try {
      await stripe.customers.del(org.stripe_customer_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[platform-admin] delete-org Stripe customer deletion failed:', message);
      await writePlatformAuditLog(
        auth.user.email!,
        null,
        'delete_organization_stripe_customer_failed',
        'stripe_customer_id',
        org.stripe_customer_id,
        { error: message, orgId: id, orgSlug: org.slug },
        { reason },
      );
      stripeCustomerWarning = message;
    }
  }

  return NextResponse.json({ ok: true, deletedSlug: org.slug, stripeCustomerWarning });
}, { route: '/api/platform-admin/orgs/[id]/delete' });
