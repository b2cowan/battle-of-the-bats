/**
 * lib/notify.ts — Central notification dispatch
 *
 * Call notify() from any API route when an event occurs.
 * It resolves recipients, checks opt-outs and preferences,
 * then writes to the bell table and (later) sends push/email.
 *
 * Push dispatch is a Phase E stub — the TODO comment marks the insertion point.
 */

import { supabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';
import { sendWebPush } from './web-push';
import { hasPlanFeature, type PlanFeature } from './plan-features';
import type { NotificationEventType, OrgPlan } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { NotificationEventType };

export interface NotifyOptions {
  orgId: string;
  /** Pass when the event is scoped to a specific tournament (enables opt-out check + staff scoping). */
  tournamentId?: string;
  eventType: NotificationEventType;
  title: string;
  body?: string;
  /** Relative path for deep-link, e.g. /slug/admin/tournaments/registrations */
  link?: string;
  metadata?: Record<string, unknown>;
  /**
   * Optional plan-feature gate (defense-in-depth). When set, notify() skips the
   * entire dispatch if the org's plan does not include this feature — so a call
   * site that forgets its own gate cannot leak a higher-tier notification.
   */
  requiredFeature?: PlanFeature;
  /**
   * Explicit recipient user IDs. If omitted, all active org members are notified
   * (with staff scoped to the tournament when tournamentId is provided).
   */
  userIds?: string[];
  /**
   * User IDs to exclude from dispatch — typically the user who performed the action.
   * Nobody should be notified about their own actions.
   */
  excludeUserIds?: string[];
}

interface ChannelPrefs {
  bell: boolean;
  push: boolean;
  email: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** System defaults applied when no preference row exists for a user+org+event. */
function systemDefaults(eventType: NotificationEventType, role: string): ChannelPrefs {
  return {
    bell:  true,
    // Chat is the chat-app model: push ON by default (chat message + @mention), email OFF.
    push:  eventType === 'chat_message' || eventType === 'chat_mention',
    // payment_failed defaults to email=true for owners and admins
    email: eventType === 'payment_failed' && (role === 'owner' || role === 'admin'),
  };
}

function notificationEmailHtml(title: string, body?: string, link?: string, appUrl = '') {
  const linkHtml = link
    ? `<p style="margin:1rem 0 0;"><a href="${appUrl}${link}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.6rem 1.25rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;">View →</a></p>`
    : '';
  const bodyHtml = body
    ? `<p style="margin:0 0 0.5rem;color:rgba(241,245,249,0.75);line-height:1.6;">${body}</p>`
    : '';
  return `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
  </div>
  <h2 style="color:#fff;font-size:1.1rem;font-weight:700;margin:0 0 0.75rem;">${title}</h2>
  ${bodyHtml}
  ${linkHtml}
</div>`;
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

export async function notify(opts: NotifyOptions): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  try {
    // ── 0. Optional plan-feature guard (defense-in-depth) ───────────────────────
    if (opts.requiredFeature) {
      const { data: orgRow } = await supabaseAdmin
        .from('organizations')
        .select('plan_id')
        .eq('id', opts.orgId)
        .maybeSingle();
      if (!orgRow || !hasPlanFeature(orgRow.plan_id as OrgPlan, opts.requiredFeature)) {
        return;
      }
    }

    // ── 1. Resolve recipients ──────────────────────────────────────────────────

    type Recipient = { userId: string; email: string; role: string };
    const recipients: Recipient[] = [];

    if (opts.userIds && opts.userIds.length > 0) {
      // Explicit list
      for (const userId of opts.userIds) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (data?.user?.email) {
          recipients.push({ userId, email: data.user.email, role: 'member' });
        }
      }
    } else {
      // All active org members
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('id, user_id, role')
        .eq('organization_id', opts.orgId)
        .eq('status', 'active');

      for (const member of members ?? []) {
        // For tournament-scoped events, restrict staff to their assigned tournaments.
        // Owners/admins are always unrestricted (no assignment rows needed).
        if (
          opts.tournamentId &&
          member.role === 'staff'
        ) {
          const { data: assignments } = await supabaseAdmin
            .from('org_member_tournament_assignments')
            .select('tournament_id')
            .eq('org_member_id', member.id);

          // Absence of rows = unrestricted. Rows present = must match.
          if (assignments && assignments.length > 0) {
            const assigned = assignments.some(a => a.tournament_id === opts.tournamentId);
            if (!assigned) continue;
          }
        }

        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
        if (authUser?.user?.email) {
          recipients.push({
            userId: member.user_id,
            email:  authUser.user.email,
            role:   member.role as string,
          });
        }
      }
    }

    // ── 2. Filter excluded users (actors should not receive their own actions) ──

    const excludeSet = new Set(opts.excludeUserIds ?? []);
    const filteredRecipients = excludeSet.size > 0
      ? recipients.filter(r => !excludeSet.has(r.userId))
      : recipients;

    // ── 3. Dispatch per recipient ──────────────────────────────────────────────

    for (const recipient of filteredRecipients) {

      // 2a. Tournament-level opt-out check (Layer 2)
      if (opts.tournamentId) {
        const { data: tournamentPref } = await supabaseAdmin
          .from('tournament_notification_preferences')
          .select('opted_out')
          .eq('user_id', recipient.userId)
          .eq('tournament_id', opts.tournamentId)
          .eq('event_type', opts.eventType)
          .maybeSingle();

        if (tournamentPref?.opted_out === true) continue;
      }

      // 2b. Global channel preferences (Layer 1) — fall back to system defaults
      const { data: globalPref } = await supabaseAdmin
        .from('notification_preferences')
        .select('channel_bell, channel_push, channel_email')
        .eq('user_id', recipient.userId)
        .eq('org_id', opts.orgId)
        .eq('event_type', opts.eventType)
        .maybeSingle();

      const prefs: ChannelPrefs = globalPref
        ? {
            bell:  globalPref.channel_bell,
            push:  globalPref.channel_push,
            email: globalPref.channel_email,
          }
        : systemDefaults(opts.eventType, recipient.role);

      // 2c. Bell — write to notifications table
      if (prefs.bell) {
        const { error: insertErr } = await supabaseAdmin
          .from('notifications')
          .insert({
            org_id:     opts.orgId,
            user_id:    recipient.userId,
            event_type: opts.eventType,
            title:      opts.title,
            body:       opts.body   ?? null,
            link:       opts.link   ?? null,
            metadata:   opts.metadata ?? {},
          });

        if (insertErr) {
          console.error('[notify] Bell insert failed:', insertErr.message);
        }
      }

      // 2d. Push — dispatch to all active subscriptions for this user
      if (prefs.push) {
        const { data: subs } = await supabaseAdmin
          .from('push_subscriptions')
          .select('id, endpoint, keys_p256dh, keys_auth')
          .eq('user_id', recipient.userId);

        for (const sub of subs ?? []) {
          try {
            await sendWebPush(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys_p256dh,
                  auth:   sub.keys_auth,
                },
              },
              {
                title: opts.title,
                body:  opts.body,
                link:  opts.link,
              }
            );

            // Update last_used_at so stale subscriptions can be identified later
            await supabaseAdmin
              .from('push_subscriptions')
              .update({ last_used_at: new Date().toISOString() })
              .eq('id', sub.id);

          } catch (pushErr: unknown) {
            // 410 = subscription expired or revoked — remove it
            const status = (pushErr as { statusCode?: number })?.statusCode;
            if (status === 410) {
              await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
              console.info('[notify] Removed expired push subscription:', sub.endpoint);
            } else {
              // Log but never rethrow — push is best-effort
              console.error('[notify] Push send failed for', sub.endpoint, pushErr);
            }
          }
        }
      }

      // 2e. Email
      if (prefs.email) {
        try {
          const html = notificationEmailHtml(opts.title, opts.body, opts.link, appUrl);
          await sendEmail(recipient.email, opts.title, html);
        } catch (emailErr) {
          console.error('[notify] Email send failed for', recipient.email, emailErr);
        }
      }
    }
  } catch (err) {
    // notify() must never throw — it's fire-and-forget from API routes
    console.error('[notify] Dispatch error:', err);
  }
}
