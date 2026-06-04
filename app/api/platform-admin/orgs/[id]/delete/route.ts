import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { sendEmail, orgClosedHtml } from '@/lib/email';
import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
};

async function requireSuperAdmin(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth.response) return { auth: null, response: auth.response };
  if (auth.role !== 'super_admin') {
    return {
      auth: null,
      response: NextResponse.json(
        { error: 'Organization deletion requires super admin access.' },
        { status: 403 }
      ),
    };
  }
  return { auth, response: null };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, response } = await requireSuperAdmin(_req);
  if (response) return response;

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
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, response } = await requireSuperAdmin(req);
  if (response) return response;

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
      );
    }
  }

  // Write the audit record with org_id: null so it doesn't create a FK reference
  // to the org row we're about to delete. The org details are preserved in new_value.
  await writePlatformAuditLog(
    auth!.user.email!,
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
      reason,
      notifyOwner,
    },
  );

  // Purge tables whose org_id FKs are NO ACTION (confirmed via schema check).
  await supabaseAdmin.from('org_venue_facilities').delete().eq('org_id', id);

  // Purge billing records before the org delete — FK on org_id may not cascade.
  await supabaseAdmin.from('billing_retained_records').delete().eq('org_id', id);
  await supabaseAdmin.from('billing_retention_intents').delete().eq('org_id', id);

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
        auth!.user.email!,
        null,
        'delete_organization_stripe_customer_failed',
        'stripe_customer_id',
        org.stripe_customer_id,
        { error: message, orgId: id, orgSlug: org.slug },
      );
      stripeCustomerWarning = message;
    }
  }

  return NextResponse.json({ ok: true, deletedSlug: org.slug, stripeCustomerWarning });
}
