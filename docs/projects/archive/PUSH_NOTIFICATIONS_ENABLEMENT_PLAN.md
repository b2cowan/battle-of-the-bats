# Plan — Push Notifications Enablement

**Branch:** `dev` · **Built:** 2026‑07‑03 · **Migrations:** none · **PM brief:** `PUSH_NOTIFICATIONS_ENABLEMENT_PM_BRIEF.md`

## Root cause (why OS push never arrived)

The Web Push stack (service worker `push`/`notificationclick` handlers, `web-push` sender, `push_subscriptions` table, subscribe/unsubscribe routes, VAPID keys in dev) was fully built. Three gaps blocked delivery:

1. **Prod deploy config omitted VAPID.** `amplify.yml` echoes runtime secrets into `.env.production` at build time (Amplify's Next SSR runtime reads the bundled `.env.production`, not console vars directly). `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` were **not** echoed → server `sendWebPush()` hit the `!privateKey` guard and silently `return`ed; the client's `NEXT_PUBLIC_VAPID_PUBLIC_KEY` was likely not inlined either → `subscribe()` threw `unconfigured`.
2. **Opt‑in UX broken on mobile.** Enabling push was a per‑event toggle in `org/notifications`; turning it on rendered `PushPermissionPrompt` (with an "Allow" **button**) at the top of the page. On mobile that button is scrolled off‑screen, and `Notification.requestPermission()` needs a live user gesture, so an auto‑call in an effect wasn't viable.
3. **Defaults all push‑off.** `systemDefaults()` returned `push:true` only for `chat_message`/`chat_mention` (chat not shipped) → nothing pushed even once subscribed.

## Changes (this build)

| Area | File | Change |
|---|---|---|
| Deploy config | `amplify.yml` | Echo the 3 VAPID vars into `.env.production` (public key inlined at build; private key + email at runtime). |
| Shared default set | `lib/notification-labels.ts` | New `PUSH_DEFAULT_ON_EVENTS` set — single source of truth for push‑on defaults. |
| Server dispatch | `lib/notify.ts` | `systemDefaults().push` now reads `PUSH_DEFAULT_ON_EVENTS`. |
| Shared client helper | `lib/push-client.ts` | New `enablePushOnThisDevice()` = `subscribeToPush()` + POST `/api/notifications/push/subscribe`. |
| Settings page | `app/[orgSlug]/admin/org/notifications/page.tsx` | Push‑ON toggle now calls `enablePushOnThisDevice()` **directly in the click gesture** (OS dialog fires inline, always visible). Removed off‑screen `PushPermissionPrompt` flow. `systemDefault()` uses `PUSH_DEFAULT_ON_EVENTS`. Denied/unsupported/unconfigured messaging in the existing error banner. |
| One‑tap prompt | `components/notifications/EnablePushBanner.tsx` + `.module.css` | Slim, dismissible banner: shows when push supported, not denied, not already subscribed, not dismissed in last 30d. Auto‑hides on this device after enable. `subscribedEndpoint()` races a 3s timeout so dev (no SW) doesn't hang the mount check. |
| Mount | `app/[orgSlug]/admin/AdminChrome.tsx` | Render `<EnablePushBanner />` at top of `<main>` on non‑focused admin routes. |
| Bell settings link | `NotificationPanel.tsx` / `NotificationBell.tsx` (+ `notifications.module.css`) | Optional `settingsHref` prop → subtle "Notification settings" footer link in the dropdown. Passed only from the two admin mounts (`AdminSidebar`, `AdminMobileTopBar`). Omitted on the coaches bell (no coaches settings page → no dead link). |
| Tier-aware settings link | `lib/billing-urls.ts` (`getNotificationSettingsHref`) | **Bugfix (owner test):** the `/admin/org` area is walled off for Tournament/Tournament Plus tiers (org-boundary layout redirects them to the tournament dashboard), so linking to `/admin/org/notifications` bounced tournament-tier users. New helper (mirrors `getBillingHref`) routes tournament tiers → `/{slug}/admin/tournaments/settings/notifications` (the per-tournament notifications page), League/Club → `/{slug}/admin/org/notifications`. Both admin bells use it. |
| Chat notifications on the tournament page | `app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx` | **Owner-requested (gap found in test):** tournament-tier admins had chat (a Tournament Plus+ feature) but no reachable setting for it (org Messaging page walled off; per-tournament page only listed ops events). Added a **Messaging** section with a "Chat message" opt-out row, gated on `hasPlanFeature(planId,'tournament_chat')`. Folded `chat_message` into the page's channel + mute-all + opt-out batches via a memoized `eventTypes` (= `TOURNAMENT_EVENT_TYPES` + chat when enabled). @mentions stay always-delivered (not shown). Works because chat `notify()` passes `tournamentId` (Layer-2 opt-out applies) and both save routes accept any event type. No migration. |

### `PUSH_DEFAULT_ON_EVENTS` (push‑on by default)
`registration_new`, `payment_received`, `payment_failed`, `score_submitted`, `score_disputed`, `team_no_show`, `roster_change_requested`, `coach_access_requested`, `tryout_offer_response`, `assistant_coach_joined`, `assistant_coach_approval_requested`, `chat_message`, `chat_mention`.
Off by default (opt‑in): `registration_status_changed`, `registration_deadline_approaching`, `waitlist_opened`, `house_league_registration_new`.

Safe because push only sends to rows in `push_subscriptions`; near‑zero devices are subscribed today (push was broken), so no retroactive spam. Saved preference rows still override defaults.

## Production cutover (owner action — REQUIRED)

1. In the Amplify console (dev + prod branches), add env vars — values are in local `.env.local`:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_EMAIL` (e.g. `mailto:fieldlogichq@gmail.com`)
2. Deploy (`amplify.yml` now propagates them). Reusing the dev keypair in prod is fine.
3. Verify: server log shows no `[web-push] … not set` warning; installed PWA on a phone → "Turn on" → Allow → trigger a real event → home‑screen alert with app closed.

## Verification

- `npm run typecheck` — clean.
- `npm run lint:focused` on changed files — 0 errors (2 pre‑existing warnings on untouched lines).
- Push cannot be tested in local dev (SW registers only in production); banner UI is visible but the subscribe call is a no‑op without a SW.

## Restart / deploy notes

- Adds files + changes shared modules → dev server restart required before browser testing.
- No migrations. No schema/dictionary impact.

## Follow‑ups

- Coaches‑portal push enablement (mount the same banner in the coaches shell).
- Consider retiring the now‑unused `PushPermissionPrompt` component once the new flow is confirmed in prod.
- `/docs` help‑content update for "turn on phone notifications" once shipped.
