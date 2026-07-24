import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import {
  buildCancellationPreflight,
  retentionDeadline,
} from '@/lib/billing-retention';
import { stripe } from '@/lib/stripe';
import { cancellationConfirmationHtml, SITE_URL } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { PLAN_CONFIG, getEffectiveTeamLimit } from '@/lib/plan-config';
import type { OrgPlan, Organization } from '@/lib/types';
import { withObservability, captureAndJson } from '@/lib/observability';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  enabled_addons: string[] | null;
  account_kind: string | null;
  tournament_limit: number | null;
  team_limit: number | null;
};

function mapOrgRow(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    planId: row.plan_id as OrgPlan,
    subscriptionStatus: (row.subscription_status ?? 'active') as Organization['subscriptionStatus'],
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    enabledAddons: row.enabled_addons ?? [],
    accountKind: (row.account_kind ?? 'org') as Organization['accountKind'],
    tournamentLimit: row.tournament_limit ?? 1,
    teamLimit: getEffectiveTeamLimit(row.plan_id as OrgPlan, row.team_limit),
    isPublic: false,
    createdAt: new Date().toISOString(),
    isDiscoverable: false,
  };
}

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id } = await params;

  const { data: orgRow, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, subscription_status, stripe_subscription_id, enabled_addons, account_kind, tournament_limit, team_limit')
    .eq('id', id)
    .single<OrgRow>();

  if (orgError || !orgRow) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (orgRow.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 });
  }

  const org = mapOrgRow(orgRow);
  const preflight = await buildCancellationPreflight(org);

  return NextResponse.json({
    subscriptionStatus: orgRow.subscription_status,
    stripeSubscriptionId: orgRow.stripe_subscription_id,
    planId: orgRow.plan_id,
    planLabel: PLAN_CONFIG[orgRow.plan_id as OrgPlan]?.label ?? orgRow.plan_id,
    ...preflight,
  });
}, { route: '/api/platform-admin/orgs/[id]/cancel-subscription' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    reason?: string;
    notifyOwner?: boolean;
  };
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;
  const notifyOwner = body.notifyOwner === true;

  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }

  const { data: orgRow, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, subscription_status, stripe_subscription_id, enabled_addons, account_kind, tournament_limit, team_limit')
    .eq('id', id)
    .single<OrgRow>();

  if (orgError || !orgRow) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  if (orgRow.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'Subscription is already canceled' }, { status: 400 });
  }

  const org = mapOrgRow(orgRow);
  const preflight = await buildCancellationPreflight(org);
  const retentionUntil = retentionDeadline();

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .insert({
      org_id: id,
      intent_type: 'cancellation',
      status: 'applied',
      from_plan: orgRow.plan_id,
      target_plan: null,
      keep_tournament_ids: [],
      retention_until: retentionUntil,
      reason,
      created_by: null,
      created_by_email: auth.user.email,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (intentError) {
    return captureAndJson(intentError, { error: intentError.message }, 500);
  }

  if (preflight.tournaments.length > 0) {
    const retainedIds = preflight.tournaments.map(t => t.id);

    await supabaseAdmin
      .from('tournaments')
      .update({ status: 'archived', is_active: false })
      .eq('org_id', id)
      .in('id', retainedIds);

    await supabaseAdmin
      .from('billing_retained_records')
      .update({ retained_state: 'purged' })
      .eq('org_id', id)
      .in('record_id', retainedIds)
      .in('retained_state', ['retained_inactive', 'pending_purge']);

    await supabaseAdmin
      .from('billing_retained_records')
      .insert(preflight.tournaments.map(t => ({
        intent_id: intent.id,
        org_id: id,
        record_type: 'tournament',
        record_id: t.id,
        display_name: t.name,
        retained_state: 'retained_inactive',
        retention_until: retentionUntil,
        metadata: {
          previousStatus: t.status,
          slug: t.slug,
          year: t.year,
          startDate: t.startDate,
          endDate: t.endDate,
          retentionReason: 'account_cancellation',
          fromPlan: orgRow.plan_id,
          initiatedBy: 'platform_admin',
          adminEmail: auth.user.email,
        },
      })));
  }

  await supabaseAdmin
    .from('billing_retained_records')
    .insert({
      intent_id: intent.id,
      org_id: id,
      record_type: 'account',
      record_id: null,
      display_name: orgRow.name,
      retained_state: 'retained_inactive',
      retention_until: retentionUntil,
      metadata: {
        retentionReason: 'account_cancellation',
        fromPlan: orgRow.plan_id,
        moduleShutdown: preflight.shutsDown,
        initiatedBy: 'platform_admin',
        adminEmail: auth.user.email,
      },
    });

  const { error: updateError } = await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      is_public: false,
      billing_suspended_at: new Date().toISOString(),
      billing_suspension_reason: reason,
    })
    .eq('id', id);

  if (updateError) {
    return captureAndJson(updateError, { error: updateError.message }, 500);
  }

  await writePlatformAuditLog(
    auth.user.email!,
    id,
    'cancel_subscription',
    'subscription_status',
    orgRow.subscription_status,
    {
      status: 'canceled',
      reason,
      retentionUntil,
      retainedTournamentIds: preflight.tournaments.map(t => t.id),
      stripeSubscriptionId: orgRow.stripe_subscription_id,
    },
  );

  let stripeWarning: string | null = null;
  const stripeSubscriptionId = orgRow.stripe_subscription_id;
  if (stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[platform-admin cancel-subscription] Stripe cancel failed:', message);
      await writePlatformAuditLog(
        auth.user.email!,
        id,
        'cancel_subscription_stripe_failed',
        'stripe_subscription_id',
        stripeSubscriptionId,
        { error: message },
      );
      stripeWarning = message;
    }
  }

  if (notifyOwner) {
    const ownerEmail = await getOrgOwnerEmail(id);
    if (ownerEmail) {
      const planLabel = PLAN_CONFIG[orgRow.plan_id as OrgPlan]?.label ?? orgRow.plan_id;
      const retentionDate = new Date(retentionUntil).toLocaleDateString('en-CA', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      await sendTransactionalEmail({
        key: 'cancellation_confirmation',
        to: ownerEmail,
        vars: { orgName: orgRow.name, planLabel, retentionUntil: retentionDate, resubscribeUrl: `${SITE_URL}/${orgRow.slug}/admin/org/billing` },
        defaultSubject: `Your ${orgRow.name} subscription has been cancelled`,
        defaultHtml: cancellationConfirmationHtml({
          orgName: orgRow.name,
          planLabel,
          retentionUntil: retentionDate,
          retainedTournaments: preflight.tournaments.length,
          resubscribeUrl: `${SITE_URL}/${orgRow.slug}/admin/org/billing`,
        }),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    retainedCount: preflight.tournaments.length + 1,
    retentionUntil,
    stripeWarning,
    shutsDown: preflight.shutsDown,
    tournaments: preflight.tournaments,
  });
}, { route: '/api/platform-admin/orgs/[id]/cancel-subscription' });
