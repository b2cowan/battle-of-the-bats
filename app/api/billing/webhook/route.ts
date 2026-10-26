import { stripe } from '@/lib/stripe';
import { PLAN_CONFIG, type BillingCycle } from '@/lib/plan-config';
import { getPlanFromPriceId } from '@/lib/stripe-prices';
import {
  applyCoachesPortalStripeRetention,
  restoreRetainedDowngradeTournaments,
  retentionDateLabel,
  retentionDeadline,
} from '@/lib/billing-retention';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { isPastDueTransition, isRecoveryTransition, writeGrowthEvent, writePlatformEvent } from '@/lib/platform-events';
import {
  provisionTeamWorkspaceFromCheckoutMetadata,
  syncTeamWorkspaceSubscription,
} from '@/lib/team-checkout';
import { completeOrgTeamAddonBillingFromMetadata } from '@/lib/team-org-billing';
import {
  recordCardOnFile, clearCardOnFileIfNoCardsLeft, recordNextSeasonChoice,
  clearNextSeasonChoice, orgIdForNextSeasonSubscription,
} from '@/lib/billing-setup';
import { NEXT_SEASON_CHOICE_KIND, classifyNextSeasonSubscription } from '@/lib/next-season-choice';
import { PLAN_RANK } from '@/lib/plan-features';
import { applyPlanChangeSideEffects } from '@/lib/plan-move';
import { isInAppUpMove } from '@/lib/plan-growth';
import { restoreAfterReactivation } from '@/lib/billing-reactivation';
import { trialEndingHtml, welcomeBackHtml, teamWorkspaceCancelledHtml, SITE_URL } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { teamWorkspaceDisplayName, teamWorkspaceReactivatePath } from '@/lib/coaches-portal-routes';
import { cancelScheduledEmail } from '@/lib/email-sender';
import { notify } from '@/lib/notify';
import { orgOwnerUserIds } from '@/lib/notify-recipients';
import { clearSettled } from '@/lib/needs-attention';
import type { OrgPlan } from '@/lib/types';
import type Stripe from 'stripe';
import { withObservability } from '@/lib/observability';
import { isTheRecordsSubscription, recordFollowsSubscription, subscriptionIsPaying } from '@/lib/stripe-billing-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toIso(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

/** Stripe expandable references arrive as either a plain id string or an expanded object. */
function stripeId<T extends { id: string }>(value: string | T | null | undefined): string | null {
  return typeof value === 'string' ? value : value?.id ?? null;
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  return stripeId(session.subscription);
}

function subscriptionItemId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.id ?? null;
}

async function cancelPriorTeamSubscription(subscriptionId: string | null | undefined, newSubscriptionId: string | null | undefined) {
  if (!subscriptionId || subscriptionId === newSubscriptionId || !subscriptionId.startsWith('sub_')) return;
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('[billing webhook] could not cancel prior Coaches Portal subscription:', error);
  }
}

/** The subscription an invoice bills, when it bills one (a one-off invoice made in Stripe's dashboard bills none). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription ?? null);
}

export const POST = withObservability(async (req: Request) => {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventObject = event.data.object as { customer?: string | { id?: string } | null };
  const customerId = typeof eventObject.customer === 'string'
    ? eventObject.customer
    : eventObject.customer?.id ?? null;

  if (!customerId) {
    return new Response('ok', { status: 200 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Founding Season card-on-file (mode='setup'): no subscription exists — the
      // session only saved a payment method. Promote it to the customer's default
      // so the end-of-Founding-Season conversion (September 2027) can charge it, and defensively persist
      // stripe_customer_id on the org. Nothing is billed here. The Stripe chain and
      // the org update are independent — run them concurrently.
      if (session.mode === 'setup') {
        const setupIntentId = stripeId(session.setup_intent);
        const setupOrgId = session.metadata?.orgId;
        await Promise.all([
          (async () => {
            if (!setupIntentId) return;
            // Expanded, so the card's brand and last4 arrive with the SetupIntent — otherwise
            // recording the card below would fetch back the payment method we already have.
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
              expand: ['payment_method'],
            });
            const paymentMethod = typeof setupIntent.payment_method === 'object'
              ? setupIntent.payment_method
              : null;
            const paymentMethodId = stripeId(setupIntent.payment_method);
            if (paymentMethodId) {
              await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: paymentMethodId },
              });
            }
            // ⚠ Record the card as a FACT ON THE ACCOUNT (mig 283). Until now this lived only in
            // Stripe, so "who still has no card?" — the question the September 2027 conversion runs
            // on — could not be asked of the database at all. Never derived from stripe_customer_id:
            // comp reactivation and subscription deletion both NULL that column.
            await recordCardOnFile({
              customerId,
              paymentMethod,
              paymentMethodId,
              fallbackOrgId: setupOrgId ?? null,
            });
          })(),
          setupOrgId
            ? supabaseAdmin
                .from('organizations')
                .update({ stripe_customer_id: customerId })
                .eq('id', setupOrgId)
                .is('stripe_customer_id', null)
            : Promise.resolve(),
        ]);
        break;
      }

      // The next-season plan choice (Founding Season: the 2028 choice). Recorded from the SESSION as
      // well as from the subscription event, because the two arrive independently and the desk must
      // never show "no choice yet" for an account that has just made one.
      if (session.metadata?.choiceKind === NEXT_SEASON_CHOICE_KIND && session.metadata.orgId) {
        await recordNextSeasonChoice({
          orgId: session.metadata.orgId,
          planKey: session.metadata.planKey ?? '',
          billingCycle: session.metadata.billingCycle ?? 'annual',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionIdFromSession(session),
          teamWorkspaceId: session.metadata.teamWorkspaceId ?? null,
        });
        break;
      }

      // RETIRING (Club Repackaging 2026-06-22): org_team_addon checkouts are no longer
      // initiated (the takeover is retired). Kept only to settle any in-flight pre-cutover
      // session — 0 exist in dev/prod. Remove this arm post-cutover.
      if (session.metadata?.checkoutKind === 'org_team_addon') {
        const subscriptionId = subscriptionIdFromSession(session);
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        const result = await completeOrgTeamAddonBillingFromMetadata({
          metadata: session.metadata,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionItemId: sub ? subscriptionItemId(sub) : null,
          subscriptionStatus: sub?.status ?? 'active',
          currentPeriodEnd: sub ? toIso(sub.items?.data?.[0]?.current_period_end) : null,
          sourceEventId: `${event.id}:org_team_addon_completed`,
        });
        if (result.ok) {
          await cancelPriorTeamSubscription(result.previousTeamSubscriptionId, subscriptionId);
        }
        break;
      }

      if (session.metadata?.checkoutKind === 'standalone_team') {
        const subscriptionId = subscriptionIdFromSession(session);
        const sub = subscriptionId
          ? await stripe.subscriptions.retrieve(subscriptionId)
          : null;

        await provisionTeamWorkspaceFromCheckoutMetadata({
          metadata: session.metadata,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionItemId: sub ? subscriptionItemId(sub) : null,
          subscriptionStatus: sub?.status ?? 'active',
          billingCycle: session.metadata.billingCycle ?? null,
          currentPeriodEnd: sub ? toIso(sub.items?.data?.[0]?.current_period_end) : null,
          eventSource: 'stripe',
          sourceEventId: `${event.id}:team_workspace_created`,
        });
        break;
      }

      const orgId = session.metadata?.orgId;
      if (orgId && customerId) {
        // Defensively ensure stripe_customer_id is set — create-checkout sets it before
        // redirect but this covers any race or retry scenarios.
        await supabaseAdmin
          .from('organizations')
          .update({ stripe_customer_id: customerId })
          .eq('id', orgId)
          .is('stripe_customer_id', null);
      }
      break;
    }

    // ── A card arrived or left, by a door the setup session never sees ──────────
    // A founding org's billing portal ("Payment method & invoices") can attach a card without any
    // checkout session at all, so the setup arm alone would miss it.
    case 'payment_method.attached': {
      const pm = event.data.object as Stripe.PaymentMethod;
      if (pm.type === 'card') {
        // The event delivers the whole payment method — passing it saves a Stripe round trip
        // inside a webhook handler, which is the one place latency has a consequence (Stripe
        // retries a slow endpoint).
        await recordCardOnFile({ customerId, paymentMethod: pm });
      }
      break;
    }

    // ⚠ A SWAP IS NOT A REMOVAL. Replacing a card fires `detached` for the old one, frequently AFTER
    // the new one has attached — clearing unconditionally would drop the account into the "no card
    // yet" reminder audience and chase somebody who had just updated their card. The writer asks
    // Stripe whether any card remains, and fails CLOSED if it cannot ask.
    case 'payment_method.detached': {
      const pm = event.data.object as Stripe.PaymentMethod;
      if (pm.type === 'card') {
        await clearCardOnFileIfNoCardsLeft(customerId, pm);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId: string = sub.items?.data?.[0]?.price?.id ?? '';

      // ── The next-season plan choice ───────────────────────────────────────────
      // The subscription exists from the moment the customer chooses, but its first charge is the
      // Founding Season's end instant and it sits in `trialing` until then.
      //
      // ⚠⚠ THE PLAN DOES NOT MOVE WHILE IT IS TRIALING (owner ruling D2, 2026-09-07). Falling
      // through to the arm below would write `plan_id` from the price the moment somebody chose in
      // June — handing a bigger plan over free for four months and making the free season worth
      // different amounts to different accounts. Once the trial ends and Stripe reports a real
      // status, the same event DOES fall through and the plan applies exactly as any other
      // subscription's would.
      if (sub.metadata?.choiceKind === NEXT_SEASON_CHOICE_KIND && sub.metadata.orgId) {
        const state = classifyNextSeasonSubscription(sub.status);

        // ⚠⚠ WITHDRAWN IS NOT A CANCELLATION OF THE ACCOUNT. Falling through here with a dead
        // subscription would write `subscription_status: 'canceled'` from it and suspend an account
        // whose Founding Season comp still has months to run. Clear the choice; touch nothing else.
        if (state === 'withdrawn') {
          await clearNextSeasonChoice(sub.metadata.orgId);
          break;
        }

        await recordNextSeasonChoice({
          orgId: sub.metadata.orgId,
          planKey: sub.metadata.planKey ?? '',
          billingCycle: sub.metadata.billingCycle ?? 'annual',
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          teamWorkspaceId: sub.metadata.teamWorkspaceId ?? null,
        });
        // Still before the first charge — the plan does not move (ruling D2). Once it converts,
        // this falls through and the plan applies exactly as any other subscription's would.
        if (state === 'pending') break;
      }

      const matchedPlan = await getPlanFromPriceId(priceId);
      if (matchedPlan) {
        // RETIRING (Club Repackaging 2026-06-22): org_team_addon is retired; kept only to
        // settle any in-flight pre-cutover subscription (0 exist). Remove post-cutover.
        if (matchedPlan.planId === 'org_team_addon') {
          const result = await completeOrgTeamAddonBillingFromMetadata({
            metadata: sub.metadata,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId(sub),
            subscriptionStatus: sub.status,
            currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            sourceEventId: `${event.id}:org_team_addon_completed`,
          });
          if (result.ok) {
            await cancelPriorTeamSubscription(result.previousTeamSubscriptionId, sub.id);
          }
          break;
        }

        const planKey = matchedPlan.planId as OrgPlan;
        const billingCycle = matchedPlan.billingCycle as BillingCycle;
        if (planKey === 'team') {
          const provisionResult = await provisionTeamWorkspaceFromCheckoutMetadata({
            metadata: sub.metadata,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId(sub),
            subscriptionStatus: sub.status,
            billingCycle,
            currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            eventSource: 'stripe',
            sourceEventId: `${event.id}:team_workspace_created`,
          });

          if (!provisionResult.provisioned && provisionResult.reason === 'not_team_checkout') {
            // Snapshot previous status before sync for reactivation detection
            const { data: prevWs } = await supabaseAdmin
              .from('team_workspaces')
              .select('workspace_org_id, subscription_status')
              .eq('stripe_subscription_id', sub.id)
              .maybeSingle();

            await syncTeamWorkspaceSubscription({
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              stripeSubscriptionItemId: subscriptionItemId(sub),
              subscriptionStatus: sub.status,
              billingCycle,
              currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
            });

            // Welcome back email when a canceled team workspace reactivates
            if (
              prevWs?.workspace_org_id &&
              prevWs.subscription_status === 'canceled' &&
              (sub.status === 'active' || sub.status === 'trialing')
            ) {
              const [wsOwnerEmail, wsOrg] = await Promise.all([
                getOrgOwnerEmail(prevWs.workspace_org_id),
                supabaseAdmin
                  .from('organizations')
                  .select('name, slug')
                  .eq('id', prevWs.workspace_org_id)
                  .maybeSingle()
                  .then(r => r.data),
              ]);
              if (wsOwnerEmail && wsOrg) {
                await sendTransactionalEmail({
                  key: 'welcome_back',
                  to: wsOwnerEmail,
                  vars: { orgName: wsOrg.name, planLabel: 'Team', dashboardUrl: `${SITE_URL}/${wsOrg.slug}/coaches` },
                  defaultSubject: `Welcome back — ${wsOrg.name}`,
                  defaultHtml: welcomeBackHtml({
                    orgName: wsOrg.name,
                    planLabel: 'Team',
                    restoredTournaments: 0,
                    dashboardUrl: `${SITE_URL}/${wsOrg.slug}/coaches`,
                  }),
                });
              }
            }
          }
          break;
        }

        const cfg = PLAN_CONFIG[planKey];
        if (!cfg) break;
        // current_period_end moved to SubscriptionItem in API 2026-04-22.dahlia
        const currentPeriodEnd = toIso(sub.items?.data?.[0]?.current_period_end);
        const { data: currentOrg } = await supabaseAdmin
          .from('organizations')
          .select('id, plan_id, subscription_status, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        // ⚠⚠ A SECOND SUBSCRIPTION DOES NOT TAKE THE RECORD OVER (see recordFollowsSubscription). Asked of Stripe
        // only when a different one is on file; a failed ask throws, so Stripe retries rather than guessing.
        const onFileId = currentOrg?.stripe_subscription_id ?? null;
        if (onFileId && onFileId !== sub.id && !onFileId.startsWith('mock_')
          && !recordFollowsSubscription({ onFileId, incomingId: sub.id, onFileIsPaying: await subscriptionIsPaying(onFileId, currentOrg?.subscription_status ?? null, id => stripe.subscriptions.retrieve(id)) })) {
          console.warn(`[billing webhook] ignored ${sub.id}: ${currentOrg?.id} already follows live subscription ${onFileId}`);
          break;
        }

        const { data: updatedOrg } = await supabaseAdmin
          .from('organizations')
          .update({
            plan_id: planKey,
            tournament_limit: cfg.tournamentLimit,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
            subscription_period: billingCycle,
            current_period_end: currentPeriodEnd,
          })
          .eq('stripe_customer_id', customerId)
          .select('id, name, slug')
          .maybeSingle();

        if (updatedOrg) {
          const previousPlan = currentOrg?.plan_id as OrgPlan | undefined;
          const previousStatus = currentOrg?.subscription_status as string | null | undefined;

          // The growth half of the Billing events card: a first subscription, or a paying org moving up.
          // Written FIRST, before the side effects below: if one of them throws, Stripe retries this event,
          // and the retry finds the org already updated, so the move would never be classified again.
          // A subscription starts once, so its start is keyed on the subscription, not on this event: two
          // different events for one new subscription (created + updated, or a late stale one) count once.
          await writeGrowthEvent({
            source: 'stripe',
            sourceEventId: event.id,
            startSourceEventId: sub.id,
            orgId: updatedOrg.id,
            previousPlanId: previousPlan ?? null,
            previousStatus,
            previousSubscriptionId: currentOrg?.stripe_subscription_id ?? null,
            planId: planKey,
            status: sub.status,
            ignoreUpgrade: isInAppUpMove(sub.metadata, planKey),
            metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
          });

          const restoreResult = await restoreRetainedDowngradeTournaments(updatedOrg.id, cfg.tournamentLimit);

          // Club Tier Stage 1b — what only the webhook sees change the plan (a scheduled down-move
          // reaching its renewal, a checkout onto Club): a custom team limit set for the old band is
          // cleared, and a move onto Club revokes the Founding Season comp (⚖ D6).
          await applyPlanChangeSideEffects({
            orgId: updatedOrg.id,
            fromPlan: currentOrg?.plan_id ?? null,
            toPlan: planKey,
            actor: 'stripe-webhook',
          });
          // A07: coming back from a cancellation restores what it took — the site, the retained
          // tournaments and records (so the retention emails stop), and the cancellation intent.
          const reactivation = currentOrg?.subscription_status === 'canceled'
            && (sub.status === 'active' || sub.status === 'trialing')
            ? await restoreAfterReactivation(updatedOrg.id, cfg.tournamentLimit)
            : null;

          // Moved onto a paid plan — cancel any pending free-tier upsell email so the
          // org doesn't get a now-stale "you're missing Tournament Plus" nudge.
          if (planKey !== 'tournament') {
            await cancelScheduledEmail(updatedOrg.id, 'tournament_plus_upsell');
          }

          if (previousPlan && PLAN_RANK[planKey] < PLAN_RANK[previousPlan]) {
            await writePlatformEvent({
              eventType: 'plan_downgraded',
              source: 'stripe',
              sourceEventId: `${event.id}:plan_downgraded`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }

          if (isPastDueTransition(previousStatus, sub.status)) {
            await writePlatformEvent({
              eventType: 'subscription_past_due',
              source: 'stripe',
              sourceEventId: `${event.id}:subscription_past_due`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan ?? null,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });
          }

          // A failed payment's notice leaves Needs attention for everyone once billing is good again, or the plan ended —
          // never on `unpaid` / `incomplete`, which still aren't paying (/review 2026-10-16).
          if (['active', 'trialing', 'canceled'].includes(sub.status)) await clearSettled({ orgIds: [updatedOrg.id], kinds: ['payment_failed'] });

          if (isRecoveryTransition(previousStatus, sub.status)) {
            await writePlatformEvent({
              eventType: 'subscription_recovered',
              source: 'stripe',
              sourceEventId: `${event.id}:subscription_recovered`,
              orgId: updatedOrg.id,
              previousPlanId: previousPlan ?? null,
              planId: planKey,
              previousSubscriptionStatus: previousStatus,
              subscriptionStatus: sub.status,
              metadata: { stripeSubscriptionId: sub.id, priceId, billingCycle },
            });

            // Welcome back email — only for resubscriptions (canceled → active/trialing),
            // not for payment recovery (past_due → active) which is a different context.
            if (previousStatus === 'canceled') {
              const ownerEmail = await getOrgOwnerEmail(updatedOrg.id);
              if (ownerEmail) {
                const planLabel = PLAN_CONFIG[planKey]?.label ?? planKey;
                const dashboardUrl = `${SITE_URL}/${updatedOrg.slug}/admin`;
                await sendTransactionalEmail({
                  key: 'welcome_back',
                  to: ownerEmail,
                  vars: { orgName: updatedOrg.name, planLabel, dashboardUrl },
                  defaultSubject: `Welcome back to FieldLogicHQ — ${updatedOrg.name}`,
                  defaultHtml: welcomeBackHtml({
                    orgName: updatedOrg.name,
                    planLabel,
                    restoredTournaments: restoreResult.restoredCount + (reactivation?.restoredTournamentIds.length ?? 0),
                    dashboardUrl,
                  }),
                });
              }
            }
          }
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;

      // ⚠⚠ A WITHDRAWN NEXT-SEASON CHOICE IS NOT AN ACCOUNT CANCELLATION, AND EVERYTHING BELOW
      // ASSUMES IT IS. The 2028 choice creates a real Stripe subscription months before it charges,
      // and the billing page hands the customer a portal link — where the obvious thing to do with
      // a choice you have changed your mind about is cancel it. Falling through would run the
      // Stripe-initiated-deletion path: archive every tournament, hide the public site, stamp
      // `billing_suspended_at`, and 402 the org out of the product — or, for a coach workspace,
      // revoke Premium entitlements and email them a cancellation notice — all while the account's
      // Founding Season comp still has months to run.
      //
      // Recognised by the subscription's own metadata AND by the id we recorded at choice time, so
      // a stripped-metadata event (a Dashboard action, an old event replayed) still lands here.
      const choiceOrgId = sub.metadata?.choiceKind === NEXT_SEASON_CHOICE_KIND && sub.metadata.orgId
        ? sub.metadata.orgId
        : await orgIdForNextSeasonSubscription(sub.id);
      if (choiceOrgId) {
        await clearNextSeasonChoice(choiceOrgId);
        // The chooser reappears on the billing page and the desk counts the account as "no choice
        // yet" again — which is exactly what it now is.
        break;
      }

      const syncedTeamWorkspace = await syncTeamWorkspaceSubscription({
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripeSubscriptionItemId: subscriptionItemId(sub),
        subscriptionStatus: 'canceled',
        currentPeriodEnd: toIso(sub.items?.data?.[0]?.current_period_end),
      });

      if (syncedTeamWorkspace) {
        await writePlatformEvent({
          eventType: 'subscription_canceled',
          source: 'stripe',
          sourceEventId: `${event.id}:team_subscription_canceled`,
          planId: 'team',
          subscriptionStatus: 'canceled',
          metadata: { stripeCustomerId: customerId, stripeSubscriptionId: sub.id, scope: 'team_workspace' },
        });

        const { data: cancelledWs } = await supabaseAdmin
          .from('team_workspaces')
          .select('id, workspace_org_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle();
        if (cancelledWs?.workspace_org_id) {
          // Retention first — the email states its deadline. When the in-app or platform-admin
          // cancel already retained this workspace, that door sent its own email: do not send a
          // second one.
          const retention = await applyCoachesPortalStripeRetention({
            workspaceOrgId: cancelledWs.workspace_org_id,
            teamWorkspaceId: cancelledWs.id,
          });
          if (!retention.applied || !retention.retentionUntil) break;
          const retentionUntil = retentionDateLabel(retention.retentionUntil);

          const [wsOwnerEmail, wsOrg] = await Promise.all([
            getOrgOwnerEmail(cancelledWs.workspace_org_id),
            supabaseAdmin
              .from('organizations')
              .select('name, slug')
              .eq('id', cancelledWs.workspace_org_id)
              .maybeSingle()
              .then(r => r.data),
          ]);
          if (wsOwnerEmail && wsOrg) {
            // Team name alone (the copy supplies "Coaches Portal"); Resubscribe reactivates THIS
            // workspace rather than opening the new-portal signup.
            const workspaceName = teamWorkspaceDisplayName(wsOrg.name);
            const resubscribeUrl = `${SITE_URL}${teamWorkspaceReactivatePath(wsOrg)}`;
            await sendTransactionalEmail({
              key: 'team_workspace_cancelled',
              to: wsOwnerEmail,
              vars: { workspaceName, resubscribeUrl, retentionUntil },
              defaultSubject: `Your ${workspaceName} Coaches Portal has been cancelled`,
              defaultHtml: teamWorkspaceCancelledHtml({ workspaceName, resubscribeUrl, retentionUntil }),
            });
          }
        }
        break;
      }

      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, plan_id, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      // ⚠⚠ ONLY THE SUBSCRIPTION ON FILE CAN END THE CLUB'S PLAN. A stray one deleted in Stripe's dashboard (or the old
      // one after a new one took over) used to run everything below: blank the record, and with no cancellation on
      // file archive the tournaments and suspend a club that was still paying.
      if (org && !isTheRecordsSubscription(org.stripe_subscription_id, sub.id)) {
        console.warn(`[billing webhook] ignored deletion of ${sub.id}: ${org.id} follows ${org.stripe_subscription_id}`);
        break;
      }

      if (org) {
        // Check whether an in-app confirm route (cancel or downgrade-to-free) already
        // applied a retention intent. Select intent_type so we can differentiate the
        // update applied below.
        const { data: existingIntent } = await supabaseAdmin
          .from('billing_retention_intents')
          .select('id, intent_type')
          .eq('org_id', org.id)
          .eq('status', 'applied')
          .in('intent_type', ['cancellation', 'downgrade'])
          .order('applied_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!existingIntent) {
          // Stripe-initiated deletion (payment failure, portal cancel, etc.) — run full
          // retention logic and suspend the org.
          const retentionUntil = retentionDeadline();
          const { data: intent } = await supabaseAdmin
            .from('billing_retention_intents')
            .insert({
              org_id: org.id,
              intent_type: 'cancellation',
              status: 'applied',
              from_plan: org.plan_id,
              target_plan: null,
              retention_until: retentionUntil,
              reason: 'Stripe subscription deleted',
              created_by_email: 'stripe-webhook',
              applied_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          const { data: tournaments } = await supabaseAdmin
            .from('tournaments')
            .select('id, name, slug, status, year, start_date, end_date')
            .eq('org_id', org.id)
            .neq('status', 'archived');

          if (intent && tournaments && tournaments.length > 0) {
            await supabaseAdmin
              .from('tournaments')
              .update({ status: 'archived', is_active: false })
              .eq('org_id', org.id)
              .in('id', tournaments.map(t => t.id));

            await supabaseAdmin
              .from('billing_retained_records')
              .insert(tournaments.map(t => ({
                intent_id: intent.id,
                org_id: org.id,
                record_type: 'tournament',
                record_id: t.id,
                display_name: t.name,
                retained_state: 'retained_inactive',
                retention_until: retentionUntil,
                metadata: {
                  previousStatus: t.status,
                  slug: t.slug,
                  year: t.year,
                  startDate: t.start_date,
                  endDate: t.end_date,
                  retentionReason: 'stripe_subscription_deleted',
                  fromPlan: org.plan_id,
                },
              })));
          }

          if (intent) {
            await supabaseAdmin
              .from('billing_retained_records')
              .insert({
                intent_id: intent.id,
                org_id: org.id,
                record_type: 'account',
                record_id: null,
                display_name: org.name,
                retained_state: 'retained_inactive',
                retention_until: retentionUntil,
                metadata: {
                  retentionReason: 'stripe_subscription_deleted',
                  fromPlan: org.plan_id,
                },
              });
          }

          // Stripe-initiated: full suspension update.
          await supabaseAdmin
            .from('organizations')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              subscription_period: null,
              current_period_end: null,
              is_public: false,
              billing_suspended_at: new Date().toISOString(),
              billing_suspension_reason: 'Stripe subscription deleted',
            })
            .eq('stripe_customer_id', customerId);

          await writePlatformEvent({
            eventType: 'subscription_canceled',
            source: 'stripe',
            sourceEventId: `${event.id}:subscription_canceled`,
            orgId: org.id,
            previousPlanId: org.plan_id,
            planId: org.plan_id,
            previousSubscriptionStatus: org.subscription_status,
            subscriptionStatus: 'canceled',
            metadata: { stripeCustomerId: customerId, reason: 'Stripe subscription deleted' },
          });
        } else if (existingIntent.intent_type === 'cancellation') {
          // In-app cancellation already applied — org is already suspended. Clear the
          // Stripe subscription fields that only become accurate once Stripe confirms
          // the deletion. subscription_status, is_public, and billing_suspended_at
          // were already set correctly by the cancel/confirm route.
          await supabaseAdmin
            .from('organizations')
            .update({
              stripe_subscription_id: null,
              subscription_period: null,
              current_period_end: null,
            })
            .eq('stripe_customer_id', customerId);
        } else {
          // intent_type === 'downgrade' (downgrade-to-free): confirm route already set
          // plan_id='tournament' and subscription_status='active'. Clear Stripe fields
          // only — do NOT set subscription_status='canceled' or is_public=false.
          await supabaseAdmin
            .from('organizations')
            .update({
              stripe_subscription_id: null,
              subscription_period: null,
              current_period_end: null,
            })
            .eq('stripe_customer_id', customerId);
        }
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const currentPeriodEnd = toIso(invoice.period_end);
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, plan_id, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      // A stray subscription's payment (or a Coaches Portal's) says nothing about the club's own.
      if (currentOrg && !isTheRecordsSubscription(currentOrg.stripe_subscription_id, invoiceSubscriptionId(invoice))) break;
      await supabaseAdmin
        .from('organizations')
        .update({
          subscription_status: 'active',
          ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
        })
        .eq('stripe_customer_id', customerId);

      // This handler can flip a first subscription from `incomplete` to `active` before the subscription's
      // own update arrives, which would then see "already active" and never count the start. Count it here
      // too — keyed on the subscription, so whichever event gets there first counts it once. Only once the
      // subscription is on the org row; before that the subscription event itself counts it.
      if (currentOrg?.stripe_subscription_id) {
        await writeGrowthEvent({
          source: 'stripe',
          sourceEventId: event.id,
          startSourceEventId: currentOrg.stripe_subscription_id,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          previousStatus: currentOrg.subscription_status,
          previousSubscriptionId: currentOrg.stripe_subscription_id,
          planId: currentOrg.plan_id,
          status: 'active',
          ignoreUpgrade: true,
          metadata: { stripeCustomerId: customerId, invoiceId: invoice.id },
        });
      }

      // A failed payment's notice leaves Needs attention for everyone once billing is good again.
      if (currentOrg) await clearSettled({ orgIds: [currentOrg.id], kinds: ['payment_failed'] });

      if (currentOrg && isRecoveryTransition(currentOrg.subscription_status, 'active')) {
        await writePlatformEvent({
          eventType: 'subscription_recovered',
          source: 'stripe',
          sourceEventId: `${event.id}:subscription_recovered`,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          planId: currentOrg.plan_id,
          previousSubscriptionStatus: currentOrg.subscription_status,
          subscriptionStatus: 'active',
          metadata: { stripeCustomerId: customerId, invoiceId: invoice.id },
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object as Stripe.Invoice;
      const { data: currentOrg } = await supabaseAdmin
        .from('organizations')
        .select('id, slug, plan_id, subscription_status, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (currentOrg && !isTheRecordsSubscription(currentOrg.stripe_subscription_id, invoiceSubscriptionId(failedInvoice))) break;
      await supabaseAdmin
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);

      if (currentOrg && isPastDueTransition(currentOrg.subscription_status, 'past_due')) {
        await writePlatformEvent({
          eventType: 'subscription_past_due',
          source: 'stripe',
          sourceEventId: `${event.id}:subscription_past_due`,
          orgId: currentOrg.id,
          previousPlanId: currentOrg.plan_id,
          planId: currentOrg.plan_id,
          previousSubscriptionStatus: currentOrg.subscription_status,
          subscriptionStatus: 'past_due',
          metadata: { stripeCustomerId: customerId },
        });
      }
      // Tell the club's OWNERS — billing is owner-only, so they are who can act on it (Needs attention clears itself,
      // 2026-10-16: with no list it reached every member, coaches included). Their email default stays on (systemDefaults
      // reads each one's real role). An empty list must never reach notify(): that means every member.
      if (currentOrg) {
        const owners = await orgOwnerUserIds(currentOrg.id).catch(e => { console.error(e); return [] as string[]; });
        if (owners.length) {
          notify({
            orgId: currentOrg.id,
            eventType: 'payment_failed',
            title: 'Subscription payment failed',
            body: 'Your subscription payment could not be processed. Please update your billing information.',
            link: `/${currentOrg.slug}/admin/org/billing`,
            userIds: owners,
          }).catch(console.error);
        }
      }
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, plan_id, stripe_subscription_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (!org || !isTheRecordsSubscription(org.stripe_subscription_id, sub.id)) break;

      const ownerEmail = await getOrgOwnerEmail(org.id);
      if (!ownerEmail) break;

      const planLabel = PLAN_CONFIG[org.plan_id as OrgPlan]?.label ?? org.plan_id;
      const trialEndDate = sub.trial_end
        ? new Date(sub.trial_end * 1000).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'soon';
      const billingUrl = `${SITE_URL}/${org.slug}/admin/org/billing`;

      await sendTransactionalEmail({
        key: 'trial_ending',
        to: ownerEmail,
        vars: { orgName: org.name, planLabel, trialEndDate, billingUrl },
        defaultSubject: `Your ${planLabel} trial ends ${trialEndDate}`,
        defaultHtml: trialEndingHtml({ orgName: org.name, planLabel, trialEndDate, billingUrl }),
      });
      break;
    }
  }

  return new Response('ok', { status: 200 });
}, { route: '/api/billing/webhook' });
