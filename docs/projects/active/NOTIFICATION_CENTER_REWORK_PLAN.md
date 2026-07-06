# Notification Center Rework — Implementation Plan

**Status:** ✅ P0–P4 ALL BUILT + REVIEWED + DOCUMENTED on `dev` 2026-07-06 (unpushed; no migration). Feature-complete — ready for owner browser test → release. Owner-flagged 2026-07-06 via `/ux`.

**Final `/review` (P4, high-risk tier, 2026-07-06):** no correctness/pagination/auth/SSR/regression defects — refactor faithful (no import cycle; helpers moved verbatim), zones/filters partition correctly, `orgId` is a filter atop `user_id` scoping (no tenant leak), the See-all page's static "Loading…" first paint avoids the dashboard-style hydration mismatch. 1 Advisory only (Load-more cursor could skip a row on an exact-timestamp tie at a page boundary — narrow, non-destructive, acceptable for a convenience page; compound-cursor fix noted if it ever bites). Gate GREEN.

**Final `/docs` pass (2026-07-06):** fixed the now-wrong coaches-guide claim that chat "lights up the in-app bell" (section prose + FAQ answer + `answerText`) → now says chat badges the **Chat tab** (push unchanged); topped up the Org guide's Notifications section with the Unread toggle, bundling, "See all", and chat-on-its-own-tab, making those terms searchable. Light touch (self-explanatory dropdown); delivery/settings/mute docs untouched. Lint clean.

**P4 build note (2026-07-06):** the "See all" full notifications page. (1) Extracted shared display logic into `lib/notification-view.ts` (EVENT_ICONS/iconFor, relativeTime, DAY_ORDER/dayBucket, BUNDLE_NOUN, `groupActivityItems`) — the dropdown now imports these (removed its local copies) so the page + dropdown group/bundle/label identically (single source, mirrors the P3 drift-guard lesson). (2) New `components/notifications/NotificationsPageContent.tsx` + `notifications-page.module.css` — full-width Needs-attention/Activity zones + date grouping + bundling (one-tap clear), an **Unread/All toggle** (defaults to All — it's the archive view), **zone filter chips** (All / Needs attention / Activity), **Mark all read**, and **Load-more pagination**. (3) API `GET /api/notifications` gained a `before` created_at cursor + returns `hasMore`; count/list chat-exclusion unchanged. (4) Two thin routes — `app/[orgSlug]/admin/notifications/page.tsx` + `app/[orgSlug]/coaches/notifications/page.tsx` — render the shared component (both shells share `useOrg`); auth via the existing admin/coaches layouts (unauth curl → 307). (5) `seeAllHref` prop threaded through `NotificationBell`→`NotificationPanel`; a "See all" footer link added and wired at all 3 bell mounts (AdminSidebar, AdminMobileTopBar, CoachesSidebar). **No by-tournament filter** — the notifications table carries no tournament_id (org-scoped rows), so that plan item is honestly dropped. No migration. typecheck ✓, focused lint 0 errors (accepted warn-level navigate/effect idioms), verify:changed GREEN; dev restarted (new files + shared module) — login 200, /admin/notifications 307 (auth-gated, compiles), notification APIs 200. ⚠ Observed a PRE-EXISTING hydration warning on the admin **dashboard** page (`currentOrg?.name ?? 'Admin'` SSR/client mismatch) from a reconnecting tab — NOT P4 (untouched file); flag separately if it matters.

**P3 build note (2026-07-06):** chat off the bell (decision §5a = ALL chat off, Option A). Code check found step 1 already done — the Chat-tab unread badge is already wired on both shells (`AdminSidebar`/`AdminBottomNav`/`AdminMobileTopBar` + coaches), counted independently off `chat_messages` via `useChatUnread`. So P3 = (1) `lib/notify.ts` now skips the bell-write for `chat_message` + `chat_mention` via a `BELL_SUPPRESSED_EVENTS` set (push/email untouched — a muted-chat user still gets @mention push); (2) `/api/notifications` GET excludes the `talk` events from BOTH the list and the `head` unread-count, derived from `NOTIFICATION_CATEGORY` (drift guard) via a single `BELL_EXCLUDE_IN` so badge + panel share one source (kills the divergence trap + hides pre-P3 chat rows). Net effect: the bell is pure operations, and today's chat double-count (bell badge + Chat-tab badge) collapses to just the Chat-tab badge. **Verified live against seed data:** unread count drops by exactly the 1 unread chat row, 0 chat rows in the excluded list (the `not in` filter works). typecheck ✓, focused lint 0 errors, `verify:changed` GREEN; dev server restarted clean (shared-module change) — login 200, notification APIs 200, no Supabase errors. **`/review` done (high-risk tier):** channel-scoping (push/email untouched, guard exact to the 2 chat types), injection safety (exclusion derived from a compile-time constant, empty-list guarded), badge↔panel consistency (sole writer = notify, sole consumers = bell+panel, both chat-excluded), deep-link/mark-read, and mention-still-pushes all Confirmed (live DB check corroborated). 1 Low fixed in-pass — the drift guard was half-implemented (API derived exclusion from `NOTIFICATION_CATEGORY`, but notify.ts hardcoded the 2 types); notify.ts now derives `BELL_SUPPRESSED_EVENTS` from the same `category==='talk'` source (identical set today → no behavior change; a future talk type now auto-suppresses on BOTH sides). Gate re-run GREEN.

**P2 build note (2026-07-06):** bundle + Unread toggle (decisions §3.2 / §3a). (1) **"Unread" toggle** at the top of the panel, **ON by default** — a pure client filter over the fetched window (instant, no refetch); ON shows only unread (reading anything drops it from view = "inbox you empty"), OFF shows all with read dimmed. Empty state adapts ("You're all caught up" vs "No notifications yet"). (2) **Same-type bundling** in the Activity feed: high-volume `know` types (`registration_new`, `registration_status_changed`, `payment_received`, `score_submitted`, `house_league_registration_new` — a `BUNDLE_NOUN` map) roll up per `(event_type, day)` when 2+ → one "N noun" summary row with a chevron; Needs-attention (act) + chat (talk) + singletons never bundle. (3) **One-tap bundle clear** — tapping a bundle marks all members read (optimistic + parallel writes) and opens the type's list; with the Unread view on it then disappears. Bundle placed at its newest member's position, order preserved. Fetch window raised to 40 for bundle headroom. No migration; HMR-safe. Verified: typecheck ✓, focused lint 0 errors (3 accepted warn-level patterns — the reused navigate/effect idioms), `verify:changed` GREEN. Seed script updated (`scripts/seed-botb-test-notifications.mjs`) to 5 unread registrations + 2 payments so both bundles show by default. **`/review` done (standard tier):** no correctness/count/regression defects across bundling (skip-loop never drops a non-bundled item; per-day scoping; unique keys), the unread filter, one-tap clear, and optimistic updates; panel-vs-badge divergence confirmed pre-existing + reduced by the 30→40 window. 1 Low a11y fixed in-pass — the Unread/All toggle now uses `aria-pressed` toggle-button semantics instead of the misused `role=tablist/tab` (no tabpanel/roving). Gate re-run GREEN.

**P1 build note (2026-07-06):** categorize + group. New `NOTIFICATION_CATEGORY` (act/know/talk) in `lib/notification-labels.ts` — a total `Record<NotificationEventType, …>` so a new event type fails typecheck until categorized (drift guard) + a `notificationCategory()` helper defaulting unknown types to `know`. `NotificationPanel.tsx` restructured into two zones: **"Needs attention"** (unread Act items only — pinned on top with an amber `--warning` header, count, and a subtle amber left-edge on each row; clears itself as items are read, including via Mark-all-read) and an **Activity feed** (everything else) grouped under **Today / Yesterday / Earlier** (local-day buckets, newest-first preserved). Each notification renders in exactly one zone. No bundling yet (P2), chat still in the bell (P3). No migration; no new files (shared module only gained exports → HMR-safe, no dev restart). Verified: typecheck ✓ (exhaustive map), focused lint 0 new issues, `verify:changed` GREEN (tokens/snapshots/dictionary/org-context). **`/review` done (standard tier):** no correctness/reconciliation/consistency/regression defects across all 5 focus areas (partition strictly complementary, ordering newest-first preserved, mark-read/mark-all-read re-partition clean, badge/panel consistent for P1, no a11y/mobile regression); 1 Low cosmetic FIXED in-pass (DST-exact "Yesterday" boundary via calendar `date-1` instead of `−86_400_000ms`); 1 optional a11y advisory (heading roles) noted, not done. **`/docs` done:** no existing help described the bell *layout* (only "in-app bell" as a delivery channel, unchanged); made one proportionate edit to the Org guide Notifications section orienting users to Needs attention / Activity + made "needs attention"/"activity feed" searchable. Deliberately did not over-document (self-evident widget) or touch the coaches guide.

**P0 build note (2026-07-06):** completed the notification event-icon map (8 missing types: `team_no_show` 🚫, `chat_message` 💬, `chat_mention` 📣, `tryout_offer_response` 🤝, `assistant_coach_joined` 🧑‍🏫, `assistant_coach_approval_requested` ✋, `playoffs_set` 🥊, `champions_crowned` 👑 — every type now distinct, 🔔 fallback only) + fixed the phone "square" push icon. `/design` pass done + logged (design_decisions 2026-07-06): new `public/brand/logo-badge.svg` (transparent centered white chevron) drives `badge-72.png` — regenerated to **84.5% transparent / 15.5% opaque chevron** (was a fully-opaque tile → white square); new `public/brand/logo-B-maskable.svg` (borderless, corner-clean, centered FL) drives `pwa-512-maskable.png`; `scripts/generate-pwa-icons.js` extended to a four-mark system (+badge +maskable sources); `sw.js` `CACHE_VERSION` v1→v2 so installed devices pick up the new badge. `pwa-192`/`pwa-512` unchanged. Verified: badge composited on dark = clean centered chevron; focused lint 0 errors (2 pre-existing warnings). No dev-server restart needed (static assets + leaf-component edit). **`/review` done (standard tier):** 1 Medium confirmed + fixed — editing the build script surfaced pre-existing CJS `require()` lint errors that turned `verify:changed` red; fixed with a scoped `eslint.config.mjs` override for `scripts/**` (also clears the latent trap in `generate-favicon-ico.js`); gate now GREEN. 2 by-design advisories (SW no-skipWaiting ⇒ new badge applies after the installed app is fully closed once; badge filename not content-hashed). Blast radius cleared: `pwa-192`/`pwa-512` byte-identical (git); the per-tournament maskable fallback route improves, not regresses. **Follow-up (not P0):** wire branded `payload.icon` (org/tournament logo) into notification dispatch — see §7.4.
**Owner decisions locked (2026-07-06):**
- Scope = **Full Act / Know / Talk** (needs-action vs FYI split + same-type bundling + date grouping + "See all" page).
- Chat = **move off the bell onto the Chat tab's own unread badge** (@mentions may still mirror into the bell).

Branch: `dev`. No per-feature branch.

---

## 1. Problem

The notification bell ([components/notifications/NotificationPanel.tsx](../../../components/notifications/NotificationPanel.tsx)) renders a single reverse-chronological list of up to 30 rows, with no grouping, no bundling, no priority, and no filtering. On a busy tournament day this becomes an undifferentiated wall (see owner screenshot: six separate "New registration: X" rows + a buried "Playoffs are set"). The bell is simultaneously acting as an **action inbox**, an **activity feed**, and a **message center** — three different jobs in one flat list.

The phone push icon shows as a **white/dark square** — two asset defects (below).

The delivery layer is **not** the problem: [lib/notify.ts](../../../lib/notify.ts) already fans one event to bell/push/email with per-event channel prefs, per-tournament opt-out, mute-all, and sensible push-on defaults. This rework is almost entirely **presentation + taxonomy + two icon assets**.

## 2. Mental model — Act / Know / Talk

Classify every `NotificationEventType` into one of three buckets. **Derived in code from `event_type` — no migration** (there is no CHECK on `notifications.event_type`, and `metadata` jsonb already exists if we later want server-side rollup keys).

| Bucket | Events | Treatment |
|---|---|---|
| **Act** (needs a decision) | `payment_failed`, `score_disputed`, `coach_access_requested`, `roster_change_requested`, `assistant_coach_approval_requested`, `tryout_offer_response`, `team_no_show` | Pinned "Needs attention" section at top, count, amber accent, persists prominently until read |
| **Know** (FYI) | `registration_new`, `registration_status_changed`, `payment_received`, `score_submitted`, `playoffs_set`, `champions_crowned`, `waitlist_opened`, `registration_deadline_approaching`, `assistant_coach_joined`, `house_league_registration_new` | Bundled + date-grouped activity stream below |
| **Talk** (conversation) | `chat_message`, `chat_mention` | **Off the bell** → Chat tab unread badge (see §5) |

New export: `NOTIFICATION_CATEGORY: Record<NotificationEventType, 'act' | 'know' | 'talk'>` in [lib/notification-labels.ts](../../../lib/notification-labels.ts) — single source of truth, consumed by the panel and the "See all" page.

## 3. The bell panel rework

Rebuild [NotificationPanel.tsx](../../../components/notifications/NotificationPanel.tsx) around three zones:

1. **Needs attention** (Act) — pinned at top, only shows when non-empty. Each row is an individual, tappable, deep-linked item. Never bundled (each needs its own decision).
2. **Activity** (Know) — grouped under **Today / Yesterday / Earlier** headers, with **same-type bundling** (P2):
   - Bundle rule (client-side over the fetched window): group rows sharing `(event_type, tournament, calendar day)` when count ≥ 2 → one summary row ("6 new registrations · U11").
   - **Bundle clear = one tap** (owner decision 2026-07-06): tapping the bundle marks **all** its members read at once and navigates to the type's list (e.g. registrations). No expand/accordion. Singletons render + behave as today (tap = read + open).
3. **Footer** — existing "Notification settings" link + a new **"See all"** link → the overflow page (§6).

### 3a. Unread toggle — the read/view model (owner decision 2026-07-06)

The bell has an **"Unread" toggle at the top, ON by default.**
- **ON (default):** the panel shows only unread items — so reading/handling something (tap, bundle one-tap, or Mark-all-read) drops it out of view. This is the "inbox you empty" behavior; "Needs attention" still pins unread Act items on top.
- **OFF:** show everything, read items dimmed, same Needs-attention + Today/Yesterday/Earlier structure. Nothing is ever destroyed — read is non-destructive, just filtered.
- Implementation: the toggle drives the existing `unreadOnly` API param (or a client filter over the fetched window); the bell badge count is unchanged (already unread-only). No migration.

Complete the icon map: [NotificationPanel.tsx](../../../components/notifications/NotificationPanel.tsx#L11) currently maps 11 event types; 8 newer ones (`team_no_show`, `chat_message`, `chat_mention`, `tryout_offer_response`, `assistant_coach_joined`, `assistant_coach_approval_requested`, `playoffs_set`, `champions_crowned`) fall through to the generic 🔔. Add all missing entries. (Visual accent/token choices → route to `/design`.)

Keep "Mark all read." Add per-row/per-bundle dismiss is **out of scope** for V1 (mark-read on tap already exists); revisit if owner wants a "clear" affordance.

## 4. Data / API

- **No migration.** Bundling + categorization are code-derived.
- [app/api/notifications/route.ts](../../../app/api/notifications/route.ts) GET: raise the panel fetch window (currently `limit=30`, hard cap 50) and **exclude Talk events** from the bell list + unread count (belt-and-suspenders alongside §5). Add optional `?category=` and `?before=<createdAt>` params for the "See all" page pagination + filtering.
- Unread count query already independent (`head:true`) — update it to also exclude Talk events so the badge matches what the panel shows.

## 5. Move chat off the bell (Talk)

**REVISED after code check (2026-07-06): step 1 is already DONE.** The Chat-tab unread badge is already wired on **both** shells — coaches (`CoachPortalShell`) AND admin (`AdminSidebar` line 64/214 via `useChatUnread(isTournaments)` + `ChatUnreadBadge`; also `AdminBottomNav`/`AdminMobileTopBar`). `useChatUnread` counts unread from `chat_messages` directly (`/api/chat/unread`, auth-scoped) — **completely independent of the `notifications` table**. So chat is already surfaced on the Chat tab; the bell rows are redundant and cause a **double-count today** (a new chat message bumps both the Chat-tab badge and the ops-bell badge).

Chat reaches the bell via `notify()` in `lib/chat-service.ts`: `postMessage` fires `chat_message` (general recipients) + `chat_mention` (mentioned users); a poll post also fires `chat_message`. Both default push-ON.

Remaining work (smaller than first planned):
1. ~~Admin-shell chat badge~~ — **already exists.** No work.
2. **notify.ts / dispatch** — stop writing the **bell** channel for `chat_message` (keep push unchanged). `chat_mention` handling = the one open decision (§5a).
3. **Bell API (list + unread count)** — exclude `chat_message` from BOTH the list and the `head`-count so pre-P3 chat rows disappear consistently and the badge can't diverge from the panel (the count-divergence trap). Exclude `chat_mention` too **iff** decision §5a routes mentions off the bell.

### 5a. Decision LOCKED (owner 2026-07-06) — ALL chat off the bell (Option A)

Both `chat_message` AND `chat_mention` leave the bell entirely. A mention still reaches the user via push + the Chat-tab badge + in-thread highlight — no bell row. Bell = pure operations, zero chat double-count.

**Finalized P3 work:**
1. ~~Admin-shell chat badge~~ — already exists (both shells). No work.
2. **notify.ts** — skip the **bell** channel for `chat_message` and `chat_mention` (keep push unchanged for both; the mention still delivers to the person who muted general chat). Simplest: a small `BELL_SUPPRESSED_EVENTS` set (the two talk types) that the bell-write step skips. Email behaviour unchanged.
3. **Bell API (`/api/notifications` GET)** — exclude `chat_message` + `chat_mention` from BOTH the list query and the `head` unread-count, so pre-P3 chat rows vanish consistently and the badge can't diverge from the panel. (Equivalent to "exclude Talk events" — `notificationCategory(eventType) === 'talk'`, or the two event types explicitly.)
4. The panel's `talk` category becomes dead-in-practice (no talk rows returned) — leave the P1 category machinery in place; it's harmless and documents intent.

**Count divergence trap (the one real risk):** the bell badge (`NotificationBell`) counts via the API `head` query; the panel filters client-side. If the API excludes chat but a client filter didn't (or vice-versa), badge ≠ panel. Mitigation: do the exclusion **server-side in the API** (both list + count) so the two are driven by the same source. No client-side chat filter needed.

## 6. "See all" overflow page

New route `/{orgSlug}/admin/notifications` (and coaches equivalent if the coaches portal surfaces the bell): full-height list, filter chips (All / Needs attention / Activity, and by tournament), unread-only toggle, `?before=` cursor pagination. Reuses the same category + bundling helpers as the panel.

## 7. Phone push icons (the "square")

Two distinct defects — **asset swaps, code already supports them**:

1. **Status-bar badge = white square.** Android's small icon uses **alpha only** → any opaque shape becomes a solid white fill. [public/icons/badge-72.png](../../../public/icons/badge-72.png) is a green chevron on a **filled dark square** → white square. Fix: badge PNG = **transparent background, single-color (white) silhouette of the chevron mark only**, generous safe padding. Referenced at [sw.js:226](../../../public/sw.js#L226) (`badge`).
2. **Tray large icon = dark square.** [public/icons/pwa-192.png](../../../public/icons/pwa-192.png) is a near-black tile → reads as a square on the dark notification shade. Fix: a higher-contrast, circular-safe notification icon (or brighten the mark). Referenced at [sw.js:225](../../../public/sw.js#L225) (`icon`, default fallback).
3. **Maskable cleanup (same pass):** [public/icons/pwa-512-maskable.png](../../../public/icons/pwa-512-maskable.png) draws a border inside the mask safe-zone → launchers clip it awkwardly. Redraw full-bleed background + centered mark.

The actual redraws are a **`/design` task**; this plan specifies the technical requirements (alpha-only silhouette for the badge; safe-zone for maskable).

## 8. Phasing

- **P0 — Quick wins (low risk, high visible impact):** icon assets (§7) + complete the event-icon map (§3). Ship independently of the bell rework.
- **P1 — Categorize + group:** `NOTIFICATION_CATEGORY` map, Needs-attention/Activity zones, Today/Yesterday/Earlier headers. (No bundling yet.)
- **P2 — Bundle + Unread toggle:** same-type roll-up rows in the Activity zone (one-tap-clears-all, §3.2) + the **"Unread" toggle** (default ON, §3a) that makes the bell an inbox you empty. Decisions locked 2026-07-06.
- **P3 — Chat off the bell:** admin-shell chat badge + notify.ts routing + bell query exclusion (§5).
- **P4 — "See all" page:** overflow route + filters + pagination (§6).

Each phase is independently shippable and reviewable. P0 can go first as a standalone quick win.

## 9. Verification

- `npm run verify:changed` (tokens/dictionary/org-context) — no schema change so dictionary untouched.
- `npm run typecheck` — touches shared `lib/notification-labels.ts` + `lib/notify.ts`.
- Restart dev server after the shared-module + notify.ts edits before browser testing.
- Manual: busy-tournament bell (many registrations) reads as bundled; Act items pin; chat no longer appears in the bell; Chat nav badges instead; real Android push shows the chevron, not a square.
- Offer `/review` (notify.ts + shared module = substantive) and `/docs` (user-facing bell behavior change).

## 10. Risks / notes

- **Bundling only covers the fetched window** — if 50 registrations exist and the panel fetches 40, the bundle count reflects the window, not the true total. Mitigate by labeling honestly ("6 new registrations" = what's shown) and leaning on the "See all" page for the full history. Do **not** claim a total we didn't fetch.
- **Realtime unread** ([NotificationBell.tsx](../../../components/notifications/NotificationBell.tsx#L49)) increments on any INSERT for the user in this org — once Talk stops writing bell rows this naturally stops counting chat, but verify the realtime filter still matches the panel's exclusion.
- Chat `chat_mention` intentionally has no user toggle (always delivered) — preserve that; only its bell-vs-chat surface changes.
