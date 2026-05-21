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
  | 'tournament_plus_feature_used';

export type PlatformEventInput = {
  eventType: PlatformEventType;
  source: 'app' | 'stripe' | 'mock' | 'platform_admin' | 'migration_053';
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

export async function writePlatformEvent(input: PlatformEventInput): Promise<void> {
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
}

export function isRecoveryTransition(previousStatus?: string | null, nextStatus?: string | null) {
  return (previousStatus === 'past_due' || previousStatus === 'canceled') &&
    (nextStatus === 'active' || nextStatus === 'trialing');
}

export function isPastDueTransition(previousStatus?: string | null, nextStatus?: string | null) {
  return previousStatus !== 'past_due' && nextStatus === 'past_due';
}
