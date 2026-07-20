import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { NotificationEventType } from './types';

/**
 * lib/notification-pause.ts — the account-level "Pause notifications" master switch
 * (Notification Settings; mig 194 `user_notification_settings`).
 *
 * Recipient-side and non-destructive: when a user's pause is ON, they receive NOTHING
 * except the protected floor (PAUSE_EXEMPT_EVENTS), across every pipeline. The pause never
 * edits their per-event preferences — unpausing restores exactly what they had.
 *
 * Enforced in two places: the org/coach/chat/digest chokepoint (`lib/notify.ts`, which also
 * whitelists the exempt events) and the account-routed fan pushes (`lib/fan-notify.ts`, no
 * exemption — no protected event ever flows through that pipeline).
 *
 * Service-role only (RLS-walled, zero policies) — always via supabaseAdmin.
 */

/**
 * The protected floor — event types that pierce the pause and are always delivered:
 *  - `payment_failed` : billing-critical; missing it can quietly suspend an org.
 *  - `chat_mention`   : the "@mentions always reach you" guarantee.
 * Both are dispatched ONLY through lib/notify.ts, so whitelisting them there is sufficient.
 */
export const PAUSE_EXEMPT_EVENTS: ReadonlySet<NotificationEventType> = new Set<NotificationEventType>([
  'payment_failed',
  'chat_mention',
]);

/** Is this user's master pause ON? (absent row / null timestamp = not paused) */
export async function isNotificationsPaused(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_notification_settings')
    .select('notifications_paused_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data?.notifications_paused_at;
}

/** Turn the master pause on/off. Upsert carries only the pause column + updated_at. */
export async function setNotificationsPaused(userId: string, paused: boolean): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('user_notification_settings')
    .upsert(
      {
        user_id: userId,
        notifications_paused_at: paused ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
  return paused;
}

/**
 * Dispatch-time batch filter: of these users, who is NOT paused? Missing rows count as
 * not-paused. One query per dispatch (vs a per-recipient lookup). Used by both pipelines.
 */
export async function filterUnpausedUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('user_notification_settings')
    .select('user_id, notifications_paused_at')
    .in('user_id', userIds);
  if (error) throw error;
  const paused = new Set((data ?? []).filter(r => r.notifications_paused_at).map(r => r.user_id));
  return userIds.filter(id => !paused.has(id));
}
