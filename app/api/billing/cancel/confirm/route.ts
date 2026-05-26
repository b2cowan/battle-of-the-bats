import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import {
  buildCancellationPreflight,
  retentionDeadline,
  writeOrgBillingAudit,
} from '@/lib/billing-retention';
import { writePlatformEvent } from '@/lib/platform-events';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, cancellationConfirmationHtml, teamWorkspaceCancelledHtml, SITE_URL } from '@/lib/email';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import type { OrgPlan } from '@/lib/types';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;

  const preflight = await buildCancellationPreflight(ctx.org);
  const retentionUntil = retentionDeadline();
  const actorEmail = ctx.user.email ?? null;
  const isTeamWorkspaceCancellation = isTeamWorkspaceOrg(ctx.org);

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('billing_retention_intents')
    .insert({
      org_id: ctx.org.id,
      intent_type: 'cancellation',
      status: 'applied',
      from_plan: ctx.org.planId,
      target_plan: null,
      keep_tournament_ids: [],
      retention_until: retentionUntil,
      reason,
      created_by: ctx.user.id,
      created_by_email: actorEmail,
      applied_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (intentError) return Response.json({ error: intentError.message }, { status: 500 });

  if (isTeamWorkspaceCancellation) {
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('team_workspaces')
      .select('id, stripe_subscription_id, billing_mode')
      .eq('workspace_org_id', ctx.org.id)
      .maybeSingle<{
        id: string;
        stripe_subscription_id: string | null;
        billing_mode: string | null;
      }>();
    if (workspaceError) return Response.json({ error: workspaceError.message }, { status: 500 });
    if (!workspace) return Response.json({ error: 'Coaches Portal workspace was not found.' }, { status: 404 });

    if (preflight.tournaments.length > 0) {
      const retainedIds = preflight.tournaments.map(t => t.id);
      const { error: archiveError } = await supabaseAdmin
        .from('tournaments')
        .update({ status: 'archived', is_active: false })
        .eq('org_id', ctx.org.id)
        .in('id', retainedIds);
      if (archiveError) return Response.json({ error: archiveError.message }, { status: 500 });

      await supabaseAdmin
        .from('billing_retained_records')
        .update({ retained_state: 'purged' })
        .eq('org_id', ctx.org.id)
        .in('record_id', retainedIds)
        .in('retained_state', ['retained_inactive', 'pending_purge']);

      const { error: tournamentRecordError } = await supabaseAdmin
        .from('billing_retained_records')
        .insert(preflight.tournaments.map(t => ({
          intent_id: intent.id,
          org_id: ctx.org.id,
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
            retentionReason: 'coaches_portal_cancellation',
            fromPlan: ctx.org.planId,
          },
        })));
      if (tournamentRecordError) return Response.json({ error: tournamentRecordError.message }, { status: 500 });
    }

    const { error: accountRecordError } = await supabaseAdmin
      .from('billing_retained_records')
      .insert({
        intent_id: intent.id,
        org_id: ctx.org.id,
        record_type: 'account',
        record_id: null,
        display_name: `${ctx.org.name} Premium workspace`,
        retained_state: 'retained_inactive',
        retention_until: retentionUntil,
        metadata: {
          retentionReason: 'coaches_portal_cancellation',
          fromPlan: ctx.org.planId,
          teamWorkspaceId: workspace.id,
          premiumToolsInactive: preflight.shutsDown,
          basicTournamentRecordsRemainAvailable: true,
        },
      });
    if (accountRecordError) return Response.json({ error: accountRecordError.message }, { status: 500 });

    const now = new Date().toISOString();
    const [{ error: workspaceUpdateError }, { error: entitlementError }, { error: orgError }] = await Promise.all([
      supabaseAdmin
        .from('team_workspaces')
        .update({ subscription_status: 'canceled', updated_at: now })
        .eq('id', workspace.id),
      supabaseAdmin
        .from('team_entitlements')
        .update({ status: 'canceled', updated_at: now })
        .eq('team_workspace_id', workspace.id),
      supabaseAdmin
        .from('organizations')
        .update({
          subscription_status: 'canceled',
          billing_suspended_at: now,
          billing_suspension_reason: reason,
        })
        .eq('id', ctx.org.id),
    ]);
    if (workspaceUpdateError) return Response.json({ error: workspaceUpdateError.message }, { status: 500 });
    if (entitlementError) return Response.json({ error: entitlementError.message }, { status: 500 });
    if (orgError) return Response.json({ error: orgError.message }, { status: 500 });

    await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'coaches_portal_cancellation_confirmed', {
      fromPlan: ctx.org.planId,
      teamWorkspaceId: workspace.id,
      retainedTournamentIds: preflight.tournaments.map(t => t.id),
      retentionUntil,
    });

    await writePlatformEvent({
      eventType: 'subscription_canceled',
      source: 'app',
      orgId: ctx.org.id,
      actorUserId: ctx.user.id,
      actorEmail,
      previousPlanId: ctx.org.planId,
      planId: ctx.org.planId,
      previousSubscriptionStatus: ctx.org.subscriptionStatus,
      subscriptionStatus: 'canceled',
      metadata: {
        scope: 'coaches_portal',
        teamWorkspaceId: workspace.id,
        retainedTournamentIds: preflight.tournaments.map(t => t.id),
        retentionUntil,
        reason,
      },
    });

    const stripeSubscriptionId = ctx.org.stripeSubscriptionId ?? workspace.stripe_subscription_id ?? null;
    if (stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
      } catch (stripeErr) {
        const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        console.error('[cancel/confirm] Coaches Portal Stripe reconciliation failed:', message);
        await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_stripe_reconciliation_failed', {
          action: 'coaches_portal_cancellation',
          stripeSubscriptionId,
          error: message,
        });
        return Response.json(
          {
            error:
              'Your Coaches Portal was canceled in FieldLogicHQ but the Stripe subscription could not be stopped. ' +
              'Contact support to cancel your billing.',
            retainedCount: preflight.tournaments.length + 1,
            retentionUntil,
          },
          { status: 500 },
        );
      }
    }

    if (actorEmail) {
      await sendEmail(
        actorEmail,
        `Your ${ctx.org.name} Coaches Portal has been cancelled`,
        teamWorkspaceCancelledHtml({
          workspaceName: ctx.org.name,
          resubscribeUrl: `${SITE_URL}/coaches/start`,
        }),
      );
    }

    return Response.json({
      ok: true,
      retainedCount: preflight.tournaments.length + 1,
      retentionUntil,
    });
  }

  if (preflight.tournaments.length > 0) {
    const retainedIds = preflight.tournaments.map(t => t.id);
    const { error: archiveError } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'archived', is_active: false })
      .eq('org_id', ctx.org.id)
      .in('id', retainedIds);
    if (archiveError) return Response.json({ error: archiveError.message }, { status: 500 });

    // Supersede any existing active retained records for these tournaments before
    // inserting fresh ones — prevents unique constraint violations if a prior retention
    // event left stale rows (e.g. after a test reset or a resubscription that did not
    // clean up billing_retained_records).
    await supabaseAdmin
      .from('billing_retained_records')
      .update({ retained_state: 'purged' })
      .eq('org_id', ctx.org.id)
      .in('record_id', retainedIds)
      .in('retained_state', ['retained_inactive', 'pending_purge']);

    const { error: recordError } = await supabaseAdmin
      .from('billing_retained_records')
      .insert(preflight.tournaments.map(t => ({
        intent_id: intent.id,
        org_id: ctx.org.id,
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
          fromPlan: ctx.org.planId,
        },
      })));
    if (recordError) return Response.json({ error: recordError.message }, { status: 500 });
  }

  const { error: accountRecordError } = await supabaseAdmin
    .from('billing_retained_records')
    .insert({
      intent_id: intent.id,
      org_id: ctx.org.id,
      record_type: 'account',
      record_id: null,
      display_name: ctx.org.name,
      retained_state: 'retained_inactive',
      retention_until: retentionUntil,
      metadata: {
        retentionReason: 'account_cancellation',
        fromPlan: ctx.org.planId,
        moduleShutdown: preflight.shutsDown,
      },
    });
  if (accountRecordError) return Response.json({ error: accountRecordError.message }, { status: 500 });

  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .update({
      subscription_status: 'canceled',
      is_public: false,
      billing_suspended_at: new Date().toISOString(),
      billing_suspension_reason: reason,
    })
    .eq('id', ctx.org.id);
  if (orgError) return Response.json({ error: orgError.message }, { status: 500 });

  await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_cancellation_confirmed', {
    fromPlan: ctx.org.planId,
    retainedTournamentIds: preflight.tournaments.map(t => t.id),
    retentionUntil,
  });

  await writePlatformEvent({
    eventType: 'subscription_canceled',
    source: 'app',
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorEmail,
    previousPlanId: ctx.org.planId,
    planId: ctx.org.planId,
    previousSubscriptionStatus: ctx.org.subscriptionStatus,
    subscriptionStatus: 'canceled',
    metadata: {
      retainedTournamentIds: preflight.tournaments.map(t => t.id),
      retentionUntil,
      reason,
    },
  });

  // — D4: Stripe reconciliation —
  // All DB writes have succeeded. Cancel the Stripe subscription immediately so
  // billing stops at the same moment the in-app suspension takes effect.
  // customer.subscription.deleted will fire; the dedup guard in the webhook will
  // find this intent (status='applied', intent_type='cancellation') and skip the
  // retention logic (already applied here) while still clearing Stripe fields.
  const stripeSubscriptionId = ctx.org.stripeSubscriptionId ?? null;
  if (stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch (stripeErr) {
      const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      console.error('[cancel/confirm] Stripe reconciliation failed:', message);
      await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_stripe_reconciliation_failed', {
        action: 'cancellation',
        stripeSubscriptionId,
        error: message,
      });
      return Response.json(
        {
          error:
            'Your account was canceled in FieldLogicHQ but the Stripe subscription could not be stopped. ' +
            'Contact support to cancel your billing.',
          retainedCount: preflight.tournaments.length + 1,
          retentionUntil,
        },
        { status: 500 },
      );
    }
  }

  if (actorEmail) {
    const planLabel = PLAN_CONFIG[ctx.org.planId as OrgPlan]?.label ?? ctx.org.planId;
    const retentionDate = new Date(retentionUntil).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const resubscribeUrl = `${SITE_URL}/${ctx.org.slug}/admin/org/billing`;
    await sendEmail(
      actorEmail,
      `Your ${ctx.org.name} subscription has been cancelled`,
      cancellationConfirmationHtml({
        orgName: ctx.org.name,
        planLabel,
        retentionUntil: retentionDate,
        retainedTournaments: preflight.tournaments.length,
        resubscribeUrl,
      }),
    );
  }

  return Response.json({
    ok: true,
    retainedCount: preflight.tournaments.length + 1,
    retentionUntil,
  });
}
