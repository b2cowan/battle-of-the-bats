# Notifications & Web Push — Implementation Plan

**Status:** Planning  
**PM Brief:** [NOTIFICATIONS_PM_BRIEF.md](NOTIFICATIONS_PM_BRIEF.md)  
**Created:** 2026-05-26  
**Updated:** 2026-05-26 — preferences model revised to two-layer (global defaults + per-tournament opt-out); all open decisions resolved

---

## Overview

Three-layer notification system for FieldLogicHQ:
1. **In-app notification bell** — real-time badge + panel in the admin sidebar and coaches portal nav
2. **Notification preferences** — two-layer: global defaults per user + per-tournament opt-out within tournament settings
3. **Web Push + PWA** — OS-level phone alerts without a native app

No native app. No third-party push service. Uses the Web Push API + VAPID keys + a service worker.

---

## Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| Bell placement | Top-right corner of the logo block in the sidebar — always visible, no scroll | Phase B |
| Coaches portal | Bell ships for both admin sidebar and coaches portal in the same phase | Phase B |
| PWA icons | Generated from `public/logo.png` using a Node.js `sharp` script | Phase E |
| Cron mechanism (Phase F) | Amplify EventBridge → triggers `/api/cron/deadline-reminders` protected by `CRON_SECRET` | Phase F |
| Staff scoping | Only staff assigned to a tournament receive that tournament's event notifications | See notify() |
| Preferences architecture | Two-layer: global defaults + per-tournament opt-out | See below |
| Org-level override | "Mute this tournament" toggle — bulk opt-out, computed on read, no extra column | Phase D3 |

---

## Preferences Architecture (Two-Layer)

### Layer 1 — Global defaults (`/admin/org/notifications`)
Per-user, per-org preferences. Controls **which events** fire and on **which channels** (bell / push / email).
- Applies to all tournaments by default
- Accessible to all active org members including standalone tournament-only orgs
- Falls back to system defaults if no row exists for a given event type

### Layer 2 — Per-tournament opt-out (`/admin/tournaments/settings/notifications`)
Per-user, per-tournament overrides. A simple **opt-out boolean** per event type.
- Owners and admins can opt out of any notification for a specific tournament
- Staff see only this page for tournaments they're assigned to
- Does not change the channel — only suppresses the notification entirely for that tournament
- Org-level override (owner suppresses regardless of tournament settings) — **deferred to a future phase**

### Dispatch precedence
```
notify(eventType, tournamentId, userId)
  → check tournament_notification_preferences: if opted_out = true → SKIP
  → check notification_preferences: get channel settings (or use defaults)
  → dispatch to enabled channels
```

---

## Canonical Event Types

| Event key | Description | Default recipients |
|---|---|---|
| `registration_new` | New tournament registration received | All org admins |
| `registration_status_changed` | Registration approved / waitlisted / rejected | Registering coach (if linked user) |
| `payment_received` | Payment captured | Org owners |
| `payment_failed` | Payment failed | Org owners |
| `roster_change_requested` | Coach submitted a roster change | All org admins |
| `score_submitted` | Score submitted by team/coach | Staff assigned to that tournament |
| `score_disputed` | Score flagged for dispute | Staff assigned to that tournament |
| `registration_deadline_approaching` | 24 h before tournament reg closes (system) | All org admins |
| `waitlist_opened` | Waitlist spot opened for a coach | Specific coach user only |
| `coach_access_requested` | Coach requested portal access | Org owners |
| `house_league_registration_new` | New house league registration | All org admins |

**Default channels (if no preference row exists):**
- `bell = true` for all event types
- `push = false` for all event types (opt-in only)
- `email = false` for all event types except `payment_failed` (email = true for owners by default)

---

## Database — Migration 098

### `notifications`
```sql
CREATE TABLE notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,
  title        text        NOT NULL,
  body         text,
  link         text,         -- relative path, e.g. /{orgSlug}/admin/tournaments/registrations
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb       NOT NULL DEFAULT '{}'
);
CREATE INDEX notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX notifications_org_idx ON notifications(org_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);
```

### `push_subscriptions`
```sql
CREATE TABLE push_subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL UNIQUE,
  keys_p256dh   text        NOT NULL,
  keys_auth     text        NOT NULL,
  device_label  text,         -- auto-detected from UA, e.g. "Chrome on iPhone"
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions(user_id);
```

### `notification_preferences` (global defaults, Layer 1)
```sql
CREATE TABLE notification_preferences (
  user_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid    NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  event_type    text    NOT NULL,
  channel_bell  boolean NOT NULL DEFAULT true,
  channel_push  boolean NOT NULL DEFAULT false,
  channel_email boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, event_type)
);
```

### `tournament_notification_preferences` (per-tournament opt-out, Layer 2)
```sql
CREATE TABLE tournament_notification_preferences (
  user_id       uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id uuid    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  event_type    text    NOT NULL,
  opted_out     boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tournament_id, event_type)
);
CREATE INDEX tournament_notif_prefs_tournament_idx
  ON tournament_notification_preferences(tournament_id);
```

**Apply to:** dev → prod (same pattern as prior migrations)

---

## Phase A — Core Infrastructure

### A1. `lib/notify.ts` — central dispatch function

```typescript
interface NotifyOptions {
  orgId: string;
  tournamentId?: string;     // if provided, checked against tournament-level opt-outs
  eventType: NotificationEventType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** If provided, only notify these users. Otherwise, notify all active org members. */
  userIds?: string[];
}

export async function notify(opts: NotifyOptions): Promise<void>
```

**Dispatch logic:**
1. Resolve recipient user IDs:
   - If `userIds` provided, use them directly
   - For tournament events with staff scoping: query `tournament_members` (or equivalent) for users assigned to that tournament
   - For org-wide events: query `org_members WHERE org_id = opts.orgId AND status = 'active'`
2. For each recipient:
   a. If `tournamentId` provided: check `tournament_notification_preferences` for `(user_id, tournament_id, event_type)` — if `opted_out = true`, **skip this recipient entirely**
   b. Query `notification_preferences` for `(user_id, org_id, event_type)` — fall back to system defaults if no row
   c. If `channel_bell`: INSERT into `notifications`
   d. If `channel_push`: call `sendWebPush()` for all subscriptions for this user
   e. If `channel_email`: call `sendEmail(recipientEmail, title, body)`
3. Errors in push/email are logged but do not throw (fire-and-forget after bell write)

**File:** `lib/notify.ts`  
**Depends on:** migration 098, `lib/web-push.ts` (Phase E), `lib/email.ts` (exists)

---

### A2. `app/api/notifications/route.ts`

**GET** — returns notifications for `auth.uid()` in the current org
- Params: `orgSlug`, `limit=20`, `unreadOnly=true`
- Returns: `{ notifications: AppNotification[], unreadCount: number }`

**POST** — actions: `mark-read`, `mark-all-read`
- `{ action: 'mark-read', id: string }` — sets `read_at = now()` on one row
- `{ action: 'mark-all-read', orgId: string }` — bulk update for user × org

---

## Phase B — In-App Bell UI

### B1. `components/notifications/NotificationBell.tsx`
- Placed in the **top-right corner of the logo block** in the admin sidebar (and coaches portal nav header)
- Bell icon (Lucide `Bell` / `BellDot`) with a red badge showing unread count (capped at "9+")
- On mount: fetches initial unread count via `/api/notifications?unreadOnly=true`
- Subscribes to **Supabase Realtime** `postgres_changes` INSERT on `notifications` filtered by `user_id` for live badge updates
- Click: toggles `NotificationPanel`

### B2. `components/notifications/NotificationPanel.tsx`
- Fixed-position panel: dropdown below the bell on desktop, slides in from top-right on mobile
- Shows last 20 notifications, newest first
- Each row: event-type icon, bold title, relative timestamp ("2 min ago"), dimmed background if read
- Click a row: mark as read → navigate to `notification.link`
- "Mark all read" button at top of panel
- Empty state: "You're all caught up" + checkmark icon
- "Load more" link for older items

### B3. Wire into `components/admin/AdminSidebar.tsx`
- Add `<NotificationBell />` inside the logo block, positioned top-right with `position: absolute` or flex row
- No sidebar width change — bell is inside the existing logo container

### B4. Wire into coaches portal nav
- Identify the coaches portal layout nav component (check `app/[orgSlug]/coaches/` layout)
- Add the same `<NotificationBell />` — coaches see only their own team-scoped notifications

---

## Phase C — Wire Events into Existing APIs

Add `notify()` calls at the point of action in each route. All are fire-and-forget (`notify(...).catch(console.error)`).

| Event | Route to modify | `link` value |
|---|---|---|
| `registration_new` | `app/api/admin/tournaments/route.ts` (POST create registration) | `/{orgSlug}/admin/tournaments/registrations?tournamentId=<id>` |
| `registration_status_changed` | `app/api/admin/tournaments/registrations/route.ts` (status update) | same as above |
| `score_submitted` | `app/api/admin/games/route.ts` (score update action) | `/{orgSlug}/admin/tournaments/results?tournamentId=<id>` |
| `house_league_registration_new` | `app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts` | `/{orgSlug}/admin/house-league/seasons/<id>/registrations` |
| `coach_access_requested` | coach join/request API route | `/{orgSlug}/admin/org/coaches-portal-links` |

For `score_submitted` and `registration_status_changed` — pass `tournamentId` to `notify()` so the tournament opt-out check runs.

---

## Phase D — Notification Preferences UI

### D1. Global defaults page — `app/[orgSlug]/admin/org/notifications/page.tsx`

Title: **"My Notification Preferences"**  
Subtitle: "These preferences apply to you only. Other members have their own settings."

Accessible to **all active org members** — not just owners. This is the central notification hub for both club org users and standalone tournament org users.

Layout — grouped table per module:

```
Tournaments
┌──────────────────────────────────┬──────┬──────┬───────┐
│ Event                            │ Bell │ Push │ Email │
├──────────────────────────────────┼──────┼──────┼───────┤
│ New registration                 │  ✓   │  ○   │  ○    │
│ Registration status changed      │  ✓   │  ○   │  ○    │
│ Score submitted                  │  ✓   │  ○   │  ○    │
│ Score disputed                   │  ✓   │  ○   │  ○    │
│ Deadline approaching (24h)       │  ✓   │  ○   │  ○    │
└──────────────────────────────────┴──────┴──────┴───────┘

Payments
  Payment received     Bell ✓  Push ○  Email ○
  Payment failed       Bell ✓  Push ○  Email ✓

Coaches Portal
  Coach access requested    Bell ✓  Push ○  Email ○

House League
  New registration     Bell ✓  Push ○  Email ○
```

- Push column shows "Not enabled" with an "Enable →" CTA if push permission not yet granted
- Changes auto-save (debounced 800ms PUT to preferences API) — no explicit save button; "Saved" flash on success
- iOS callout: if UA is iOS Safari and not in PWA mode, show: "To receive push notifications on iPhone, tap Share → Add to Home Screen first."

### D2. `app/api/admin/notification-preferences/route.ts`

**GET** — returns all preference rows for `(auth.uid(), orgId)`. Client fills defaults for missing event types.

**PUT** — upserts a single row:
```json
{ "orgId": "...", "eventType": "registration_new", "channelBell": true, "channelPush": false, "channelEmail": false }
```

### D3. Per-tournament opt-out page — `app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx`

Title: **"My Notifications for This Tournament"**  
Subtitle: "Opt out of specific notifications for this tournament. Your global channel preferences still apply to the ones you keep on."

**Mute toggle (top of page):**
A prominent "Mute all notifications for this tournament" toggle sits above the event list. When on, it bulk-upserts `opted_out = true` for all relevant event types in `tournament_notification_preferences`. The toggle reads as active when ALL relevant event types for this user + tournament have `opted_out = true` — computed on the read side, no extra column needed.

```
┌──────────────────────────────────────────────────────────┐
│  🔕  Mute all notifications for this tournament   [ ON ] │
│      You won't receive any alerts for River Hawks Cup.   │
└──────────────────────────────────────────────────────────┘

Individual events (disabled / dimmed when muted):

┌──────────────────────────────────┬───────────────┐
│ Event                            │ Notify me     │
├──────────────────────────────────┼───────────────┤
│ New registration                 │  ✓ On         │
│ Registration status changed      │  ✓ On         │
│ Score submitted                  │  ✓ On         │
│ Score disputed                   │  ✓ On         │
│ Deadline approaching (24h)       │  ○ Off        │
└──────────────────────────────────┴───────────────┘
```

- When muted, individual event toggles are dimmed and non-interactive (mute takes precedence)
- Unmuting restores the previous per-event settings (individual rows are not reset — they retain whatever they were before mute)
- Staff who are not org owners/admins see only the events relevant to their role for this tournament
- Changes auto-save (same debounce pattern as global page)
- Note at bottom: "To change how you receive notifications (bell, push, email), go to → My Notifications" with a link

### D4. `app/api/admin/tournament-notification-preferences/route.ts`

**GET** — returns rows for `(auth.uid(), tournamentId)`

**PUT** — upserts a single event type:
```json
{ "tournamentId": "...", "eventType": "registration_new", "optedOut": false }
```

**PUT** with `action: "mute"` — bulk-upserts all tournament event types to `opted_out = true`:
```json
{ "action": "mute", "tournamentId": "..." }
```

**PUT** with `action: "unmute"` — bulk-upserts all tournament event types to `opted_out = false`:
```json
{ "action": "unmute", "tournamentId": "..." }
```

The "is muted" state is derived on GET: if every event type for `(user_id, tournament_id)` has `opted_out = true`, the client renders the mute toggle as active. The API does not store a separate `muted` flag.

### D5. Wire into AdminSidebar

**Org admin nav** — add "My Notifications" (Bell icon) between Coaches Portal Links and Settings:
```
Organization Admin
  ├ Members
  ├ Venue Library
  ├ Subscription         (owners only)
  ├ Coaches Portal Links (owners/admins)
  ├ My Notifications     ← NEW — all active members
  └ Settings             (owners only)
```

**Tournament Setup nav** — add "Notifications" to the Setup group in `TOUR_GROUPS`:
```javascript
{ key: 'settings/notifications', icon: Bell, label: 'Notifications' }
```
Position: after `settings/event` (Event Settings).

---

## Phase E — PWA + Web Push

### E1. PWA icons — generate from `public/logo.png`

Run a one-time Node.js script using `sharp`:
```bash
npm install --save-dev sharp
node scripts/generate-pwa-icons.js
```

Script creates:
- `public/icons/pwa-192.png` (192×192, letterboxed on `#0a0a0f` background)
- `public/icons/pwa-512.png` (512×512, same treatment, `purpose: any maskable`)
- `public/icons/badge-72.png` (72×72, monochrome white logomark for Android notification tray)

### E2. `public/manifest.json`

```json
{
  "name": "FieldLogicHQ",
  "short_name": "FieldLogicHQ",
  "description": "Sports club and league management platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0f",
  "theme_color": "#0a0a0f",
  "icons": [
    { "src": "/icons/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/pwa-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### E3. Add to `app/layout.tsx`

```tsx
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0a0a0f" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

Register service worker (in a `'use client'` component or in layout via `useEffect`):
```tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
}, []);
```

### E4. `public/sw.js`

```javascript
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FieldLogicHQ', {
      body: data.body,
      icon: '/icons/pwa-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.link ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data.url;
      const existing = clientList.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
```

### E5. VAPID keys — one-time setup

```bash
npx web-push generate-vapid-keys
```

Add to `.env.local` **and** Amplify environment variables:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_EMAIL=mailto:fieldlogichq@gmail.com
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be public because the browser's `pushManager.subscribe()` call requires it client-side.

### E6. `lib/web-push.ts`

```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export interface PushPayload { title: string; body?: string; link?: string; }

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<void> {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
```

**Install:** `npm install web-push` + `npm install --save-dev @types/web-push`

### E7. Push subscription API routes

**`app/api/notifications/push/subscribe/route.ts`** — POST
```json
{ "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." }, "deviceLabel": "Chrome on iPhone" }
```
Upserts into `push_subscriptions`. Updates `last_used_at` if endpoint already exists.

**`app/api/notifications/push/unsubscribe/route.ts`** — DELETE
Removes subscription by endpoint. Called when user toggles push OFF in preferences.

### E8. `components/notifications/PushPermissionPrompt.tsx`

Used inside the preferences page when user toggles the Push column ON:
1. Check `Notification.permission`:
   - `'granted'` → subscribe silently via `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
   - `'default'` → show inline message: "Click Allow when your browser prompts you"
   - `'denied'` → show: "Notifications are blocked — [how to unblock]" (link to browser-specific instructions)
2. On successful subscription: POST to `/api/notifications/push/subscribe`
3. On failure: revert the toggle, show inline error

### E9. Update `lib/notify.ts` — add push dispatch

Add to the per-recipient dispatch loop:
```typescript
if (prefs.channel_push) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', recipientId);

  for (const sub of subs ?? []) {
    try {
      await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        { title: opts.title, body: opts.body, link: opts.link },
      );
      await supabaseAdmin.from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('endpoint', sub.endpoint);
    } catch (err: any) {
      // 410 = subscription expired (device reset / cleared site data) — clean it up
      if (err?.statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      console.error('Push send failed:', err);
    }
  }
}
```

**410 handling is critical** — stale subscriptions must be deleted or every subsequent push silently fails.

### E10. Add push toggle to preferences pages (D1 update)

After push infrastructure ships, add the Push column to both:
- Global defaults page (D1) — with `PushPermissionPrompt` on first toggle
- Per-tournament opt-out page (D3) — Push column shows current status (from global prefs), read-only with a "Change in My Notifications →" link

---

## Phase F — Scheduled Deadline Reminders

### Implementation: Amplify EventBridge → Next.js API route

**EventBridge rule:** Daily at 9:00 AM UTC, triggers an Amplify function (or HTTP POST) to `/api/cron/deadline-reminders` with `Authorization: Bearer <CRON_SECRET>`.

**`app/api/cron/deadline-reminders/route.ts`**

```typescript
// Protected by CRON_SECRET header
// Queries tournaments WHERE registration_deadline BETWEEN now() AND now() + interval '25 hours'
// Calls notify() for each tournament's org admins
// Returns { triggered: number } for CloudWatch logging
```

**Env var:** `CRON_SECRET` — generate a random string, add to `.env.local` and Amplify

---

## TypeScript Types (add to `lib/types.ts`)

```typescript
export type NotificationEventType =
  | 'registration_new'
  | 'registration_status_changed'
  | 'payment_received'
  | 'payment_failed'
  | 'roster_change_requested'
  | 'score_submitted'
  | 'score_disputed'
  | 'registration_deadline_approaching'
  | 'waitlist_opened'
  | 'coach_access_requested'
  | 'house_league_registration_new';

export interface AppNotification {
  id: string;
  orgId: string;
  eventType: NotificationEventType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface NotificationPreference {
  eventType: NotificationEventType;
  channelBell: boolean;
  channelPush: boolean;
  channelEmail: boolean;
}

export interface TournamentNotificationPreference {
  eventType: NotificationEventType;
  optedOut: boolean;
}
```

---

## Complete File Map

```
lib/
  notify.ts                                              ← Phase A1 (new)
  web-push.ts                                            ← Phase E6 (new)
  types.ts                                               ← add 4 new types

scripts/
  generate-pwa-icons.js                                  ← Phase E1 (new, run once)

app/api/
  notifications/
    route.ts                                             ← Phase A2 (new) — list + mark-read
    push/
      subscribe/route.ts                                 ← Phase E7 (new)
      unsubscribe/route.ts                               ← Phase E7 (new)
  admin/
    notification-preferences/route.ts                    ← Phase D2 (new)
    tournament-notification-preferences/route.ts         ← Phase D4 (new)
  cron/
    deadline-reminders/route.ts                          ← Phase F (new)

app/[orgSlug]/admin/
  org/notifications/page.tsx                             ← Phase D1 (new) — global defaults
  tournaments/settings/notifications/page.tsx            ← Phase D3 (new) — per-tournament opt-out

components/notifications/
  NotificationBell.tsx                                   ← Phase B1 (new)
  NotificationPanel.tsx                                  ← Phase B2 (new)
  PushPermissionPrompt.tsx                               ← Phase E8 (new)

components/admin/
  AdminSidebar.tsx                                       ← Phase B3, D5 (modify)

public/
  manifest.json                                          ← Phase E2 (new)
  sw.js                                                  ← Phase E4 (new)
  icons/
    pwa-192.png                                          ← Phase E1 (generated)
    pwa-512.png                                          ← Phase E1 (generated)
    badge-72.png                                         ← Phase E1 (generated)

app/
  layout.tsx                                             ← Phase E3 (modify)
```

---

## Build Order (strict)

| Step | Phase | Deliverable |
|---|---|---|
| 1 | DB | Migration 098 — all four tables |
| 2 | A1 | `lib/notify.ts` — bell + opt-out check (push placeholder) |
| 3 | A2 | `app/api/notifications/route.ts` |
| 4 | B1+B2 | `NotificationBell.tsx` + `NotificationPanel.tsx` |
| 5 | B3+B4 | Wire bell into `AdminSidebar.tsx` + coaches portal nav |
| 6 | C | Add `notify()` to 5 existing API routes |
| 7 | D2 | `app/api/admin/notification-preferences/route.ts` |
| 8 | D4 | `app/api/admin/tournament-notification-preferences/route.ts` |
| 9 | D1 | Global defaults page — bell + email toggles only |
| 10 | D3 | Per-tournament opt-out page |
| 11 | D5 | Add "My Notifications" to org nav + "Notifications" to tournament Setup nav |
| 12 | E1 | `scripts/generate-pwa-icons.js` → run → generate PNGs |
| 13 | E2+E3 | `public/manifest.json` + layout.tsx `<link>` + meta tags |
| 14 | E4 | `public/sw.js` + SW registration in layout |
| 15 | E5 | VAPID key generation + add to env |
| 16 | E6 | `lib/web-push.ts` + install `web-push` |
| 17 | E7 | Push subscribe/unsubscribe API routes |
| 18 | E8 | `PushPermissionPrompt.tsx` |
| 19 | E9 | Update `lib/notify.ts` with push dispatch |
| 20 | E10 | Add push toggle to both preferences pages |
| 21 | F | Amplify EventBridge rule + `/api/cron/deadline-reminders/route.ts` |

---

## Open Decisions

All decisions from the initial plan have been resolved. One remaining deferred item:

1. **Coaches portal nav component** — Identify the exact layout file to modify before starting Phase B4. (Check `app/[orgSlug]/coaches/` layout file.)

The org-level override has been included as the **mute toggle** in Phase D3 — a "Mute all notifications for this tournament" button that bulk-opts-out all event types for the current user + tournament, computed on read with no extra column.
