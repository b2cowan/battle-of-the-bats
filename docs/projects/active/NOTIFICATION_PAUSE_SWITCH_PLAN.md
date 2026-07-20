# Notification "Pause" Master Switch — Implementation Plan

**Status:** In build (dev) · owner-approved 2026-07-20 · **NOT owner-tested** · joins the pending Unified Home prod bundle
**Owner decisions (2026-07-20):** Safe pause (not a hard kill-all); protected floor = **failed-payment + @mentions**; **fan score/news pushes ARE included** in the pause.

## What it is
An account-level **"Pause notifications"** master switch at the top of the notification-settings page (`/account/notifications`). Recipient-side: silences everything the platform sends this user, across all their orgs/teams/follows, **except the protected floor** — failed-payment alerts and chat @mentions. **Non-destructive:** it never edits per-event preferences; unpausing restores exactly what the user had.

## Scope of the pause (what it silences vs. what pierces it)
- **Silenced when paused:** all org/staff/coach/chat notifications, the weekly coach digest, AND account-routed fan score/news pushes for followed teams.
- **Always delivered (pierces the pause):** `payment_failed` (billing-critical) and `chat_mention` (the "@mentions always reach you" guarantee). These are the only two event types exempt.
- **Explicitly EXCLUDED from v1 (documented, not silently unsolved):** organizer **broadcast emails** — dues reminders (`lib/dues-reminders.ts`) and game-day reminders (`lib/game-day-reminders.ts`). These are keyed to a raw email address (guardian / coach email), not an authenticated `user_id`, and are already governed by a *different*, organizer-side pause (`tournaments.settings.coach_email_pause_all`, `lib/email.ts`). A recipient account pause can't cleanly reach them without an email→account resolution that doesn't exist. If wanted later, that's a v2 (needs identity resolution).
- **Naming-collision note:** do NOT confuse this recipient-side account pause with the organizer-side `coach_email_pause_all` (silences an organizer's OUTBOUND coach emails on one event). Different owner, different scope; both are informally called "master switch" in docs.

## Architecture (why it's low-risk)
The whole account-notification pipeline funnels through **one** function — `lib/notify.ts::notify()` (14 call sites: billing webhook, chat, digest, registration, games, scorekeeper, invites, etc.). Both protected event types are sent **only** through it. So the pause is a single insertion point there, with a 2-item whitelist. The fan pushes run through a second pipeline (`lib/fan-notify.ts`) — one more filter on the account-routed targets covers those. Nothing else needs touching.

### Changes
1. **Migration 194** — new `user_notification_settings` table (`user_id` PK, `notifications_paused_at timestamptz` null=not-paused, `updated_at`). RLS enabled, **zero policies** (service-role only), modeled on `user_marketing_opt_outs` (185). Update `DATA_DICTIONARY.md` + refresh dev+prod snapshots in the same unit of work. Apply to dev via `apply-migration-api.mjs`; prod NOT auto-applied (joins the bundle).
2. **`lib/notification-pause.ts`** — service-role helper: `isNotificationsPaused(userId)`, `setNotificationsPaused(userId, paused)`, `filterUnpausedUsers(userIds)` (batch, for dispatch), and `PAUSE_EXEMPT_EVENTS` = `{payment_failed, chat_mention}`.
3. **`lib/notify.ts`** — Layer 0 pause check in the per-recipient loop: batch-resolve paused users once per dispatch (skip entirely for exempt events); skip a recipient if paused and the event isn't exempt. Mirrors the existing "@mention pierces the per-room mute" pattern in `chat-service.ts`.
4. **`lib/fan-notify.ts`** — in `accountTargetsForTeams`, filter the opted-in followers through `filterUnpausedUsers`. (Anonymous device follows aren't account-tied, so they're correctly unaffected.)
5. **API + client** — `POST /api/consumer/notification-pause` (`{ paused }`), auth-gated to the caller's own user; small client helper. No device-push registration needed on toggle (pause suppresses; it never enables push).
6. **UI** — `page.tsx` loads the paused state server-side and passes it in; `AccountNotificationsClient.tsx` renders the master card at the top (icon + "Pause notifications" + sub-line + protected chips + big toggle), optimistic toggle. When paused, the workspace/fan cards show a quiet "paused" note (non-destructive — their switches stay).

## Verification
- typecheck + verify:changed (check:dictionary must reflect the new table) + lint.
- `/review` (touches billing-adjacent delivery — full funnel warranted).
- Dev-server clean restart (new files + shared-module touch).
- Owner browser test: toggle on → confirm a non-protected notification is suppressed and a failed-payment / @mention still arrives; toggle off → confirm prior per-event settings intact.

## Prod
Joins the pending Unified Home bundle. Migration 194 must be applied to prod (`apply-migration-api.mjs --prod`) **before** the code goes live, alongside migration 193.
