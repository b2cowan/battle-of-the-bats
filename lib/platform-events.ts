import { supabaseAdmin } from './supabase-admin';

export type PlatformEventType =
  | 'plan_downgraded'
  | 'subscription_canceled'
  | 'subscription_past_due'
  | 'subscription_recovered'
  | 'tournament_plus_upgrade_gate_viewed'
  | 'tournament_plus_upgrade_gate_clicked'
  | 'tournament_plus_acquisition_cta_viewed'
  | 'tournament_plus_acquisition_cta_clicked'
  | 'tournament_plus_feature_used'
  | 'tournament_registration_operation_used'
  | 'team_workspace_created'
  | 'team_org_link_requested'
  | 'team_org_link_invited'
  | 'team_org_link_approved'
  | 'team_org_link_declined'
  | 'team_org_link_invite_accepted'
  | 'team_org_link_invite_declined'
  | 'team_org_billing_requested'
  | 'team_org_billing_invited'
  | 'team_org_billing_invite_accepted'
  | 'team_org_billing_request_declined'
  | 'team_org_billing_invite_declined'
  | 'team_org_billing_checkout_started'
  | 'team_org_billing_takeover_completed'
  | 'team_org_ownership_requested'
  | 'team_org_ownership_invited'
  | 'team_org_ownership_request_approved'
  | 'team_org_ownership_invite_accepted'
  | 'team_org_ownership_request_declined'
  | 'team_org_ownership_invite_declined'
  | 'team_org_ownership_transfer_completed'
  // Free Tier Phase 6 — Free League Starter (§13 instrumentation). Reuse this store; no new
  // analytics pipeline. `platform_events.event_type` is free text (no CHECK), so no migration.
  // First five are server-fired (route handlers); last two are client-fired via /api/events/league.
  | 'free_floor_created'
  | 'existing_user_floor_added'
  | 'league_season_created'
  | 'league_schedule_generated'
  | 'scope_wall_hit'
  | 'upgrade_intent_clicked'
  | 'league_public_page_shared'
  // Unified Home Phase 5 — consumer front-door success metrics (§6). Same free-text store, no
  // migration. `home_*` are CLIENT-fired via /api/events/consumer (allowlisted so they can't be
  // forged); the rest are SERVER-fired from the route the interaction already hits.
  | 'home_ready'              // client: Home personalization resolved — carries auth state, composition, TTI ms
  | 'home_card_tapped'        // client: a Workspaces / Following card tapped (tap-through)
  | 'chat_tab_opened'         // client: Chat tab opened, by auth state (fan/logged-out included)
  | 'follow_tapped'           // client: a follow affordance tapped — { entityType, on, signedIn } (Phase 6 conversion)
  | 'directory_search'        // server (/api/public/search): a Home search ran
  | 'chat_inbox_loaded'       // server (/api/consumer/chat/inbox): member inbox loaded (coach DAU)
  | 'auth_workspace_landing'; // server (/api/auth/destination): sign-in destination resolved (fast-path health)

export type PlatformEventInput = {
  eventType: PlatformEventType;
  source: 'app' | 'stripe' | 'mock' | 'platform_admin' | 'migration_053' | 'founding_season';
  sourceEventId?: string | null;
  orgId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  previousPlanId?: string | null;
  planId?: string | null;
  previousSubscriptionStatus?: string | null;
  subscriptionStatus?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
};

// Throw-proof by contract: identical discipline to captureError/notify. Callers may `await` it on
// Lambda (so the insert flushes before the handler returns and the event isn't dropped) WITHOUT risk
// of the write affecting the request path — e.g. /api/league/create awaits this inside a try/catch
// that rolls back the org on error, so a rejection here must never escape.
export async function writePlatformEvent(input: PlatformEventInput): Promise<void> {
  try {
    if (input.sourceEventId) {
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('platform_events')
        .select('id')
        .eq('source', input.source)
        .eq('source_event_id', input.sourceEventId)
        .maybeSingle();

      if (lookupError) {
        console.error('[platform-events] lookup error:', lookupError);
        return;
      }
      if (existing) return;
    }

    const { error } = await supabaseAdmin
      .from('platform_events')
      .insert({
        event_type: input.eventType,
        source: input.source,
        source_event_id: input.sourceEventId ?? null,
        org_id: input.orgId ?? null,
        actor_user_id: input.actorUserId ?? null,
        actor_email: input.actorEmail ?? null,
        previous_plan_id: input.previousPlanId ?? null,
        plan_id: input.planId ?? null,
        previous_subscription_status: input.previousSubscriptionStatus ?? null,
        subscription_status: input.subscriptionStatus ?? null,
        metadata: input.metadata ?? {},
        occurred_at: input.occurredAt ?? new Date().toISOString(),
      });

    if (error) {
      console.error('[platform-events] write error:', error);
    }
  } catch (err) {
    // A network/fetch-layer rejection (rare) must not propagate to the caller's request path.
    console.error('[platform-events] write threw (swallowed):', err);
  }
}

export function isRecoveryTransition(previousStatus?: string | null, nextStatus?: string | null) {
  return (previousStatus === 'past_due' || previousStatus === 'canceled') &&
    (nextStatus === 'active' || nextStatus === 'trialing');
}

export function isPastDueTransition(previousStatus?: string | null, nextStatus?: string | null) {
  return previousStatus !== 'past_due' && nextStatus === 'past_due';
}
