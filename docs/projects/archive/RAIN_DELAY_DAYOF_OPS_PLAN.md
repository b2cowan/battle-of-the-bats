# Rain Delay / Day-of Operations — Implementation Plan

> **Status:** In Progress (Feature A built dev 2026-07-06; Feature B B1–B3 built dev 2026-07-07)
> **Created:** 2026-07-04
> **Branch:** dev
>
> **Scope change 2026-07-07 (post-build):** owner reversed the "today's remaining only" bound (Owner Decision "Shift scope"). The bulk tool now works for **any upcoming day** via a **day picker** (today or a future day — the engine already supported any date; this was a UI change only). The entry point was **renamed "Rain delay"** (owner's choice for discoverability) with a weather icon and now shows **whenever the event has upcoming games**, not just on game day. Multi-day / whole-event shift (tiers B & C in the comparison) was **explicitly declined** — not planned.

## Goal

Give tournament organizers a fast, safe way to manage weather- and time-driven disruption on game day, and to reach the people who care about it. Two complementary features:

- **Feature A — Broadened fan notifications + "post a day-of alert" push.** Let anyone with the app opt in to tournament notifications (not just per-team score alerts), and let an organizer's posted announcement ("Rain delay — all games pushed 1 hour") actually *push* to those fans (and to coaches), instead of being a silent visual banner.
- **Feature B — Bulk "shift the day" schedule tool.** Let an organizer select today's remaining games and shift them all by a chosen amount (e.g. +1h for rain), or cancel some and push the rest, in one operation — then hand off to Feature A to announce and notify in the same flow.

Each feature is independently shippable. Feature A is the higher-leverage, lower-risk starting point; Feature B depends on nothing in A but becomes far more valuable once A exists (a schedule shift that also notifies).

---

## PM Brief

See `RAIN_DELAY_DAYOF_OPS_PM_BRIEF.md` for the full plain-language brief. One-paragraph summary:

Today an organizer can *post* a rain-delay message on the public tournament app, but nobody gets notified — fans only receive a push when a score is submitted for a team they personally followed, and coaches get nothing on a schedule change. This project (1) lets fans opt into tournament-wide notifications and makes posted day-of alerts push to them and to coaches, and (2) adds a one-tap "shift today's games" tool so an organizer can move or cancel games in bulk and announce it in the same step.

---

## Current-State Facts (grounding — do not re-investigate)

**Notifications**
- **Fan push** is anonymous, no login. Opt-in is per-followed-team via `FollowAlertsToggle`; subscriptions live in `fan_push_subscriptions` keyed to `(endpoint, tournament_id, team_id)`; dispatch is `notifyFansForGame()` in `lib/fan-notify.ts`; today it fires **only on score submission**. Plan-gated on `fan_score_alerts` (Tournament Plus+).
- **Staff/coach push** is a separate system: `notify()` in `lib/notify.ts`, subscriptions in `push_subscriptions` keyed to `user_id`, authenticated org members only. 13 event types in `PUSH_DEFAULT_ON_EVENTS` (`lib/notification-labels.ts`) — **none is "announcement."**
- **Announcements ("site posts")** are composed at `app/[orgSlug]/admin/tournaments/communication` via `app/api/admin/communications/route.ts`, stored in the `announcements` table, shown on the public `/news` page and — if pinned — as a dismissible banner on the public Schedule (`ScheduleContent.tsx`). Posting triggers **zero push** today. Optional email channel emails accepted-team coaches.
- **Coaches** are reachable through `notify()` when they are org members / chat-room members, but no schedule-change or announcement event currently calls it.

**Schedule / games**
- Games store `game_date` (date) + `game_time` (time), stored as **wall-clock `America/Toronto`, not UTC**. `lib/timezone.ts` has `zonedWallClockToUtc()` / `utcToZonedInputs()` for any conversion.
- Single-game edit exists: `PATCH /api/admin/games` `action:'update'` (capability `update_schedule`), one game at a time. Cancel: `action:'cancel'` (reversible via `revert-to-scheduled`), one at a time. **No bulk operation exists.**
- Status enum: `scheduled | submitted | completed | cancelled | forfeit`. Cancelled games are **invisible to standings** (tie-breakers exclude them).
- Playoff advancement is by string match (`home_placeholder='Winner <bracketCode>'`) in `advancePlayoffs`; bracket dependencies are **implicit (placeholder strings), not FK edges**. Ordering validity (a game can't start before its feeders finish) is checked **client-side only** today (`findBracketSchedulingViolations`).
- Public schedule reflects changes via **30s polling only while the tournament is in progress** (`usePublicTournamentLive`); off game-day it needs a manual refresh. No realtime on games for the public page.
- Game-day reminder emails are scheduled at publish time from `game_date` and are **not recalculated** if a game is rescheduled afterward.

---

## Design Constraints (hard rules for both features)

1. **Sport-neutral.** Route all score/period/label vocabulary through `lib/sports.ts` Sport Pack helpers (`getSportPack`, `DEFAULT_SPORT`). No hard-coded "Runs"/"innings"/mercy wording in any new copy. (See `memory/feedback_sport_neutral_no_debt.md`.)
2. **Wall-clock timezone model.** Time math must go through `lib/timezone.ts`. Never assume UTC on `game_time`. A "+1 hour" shift is arithmetic on the wall-clock value with DST handled via the existing helpers; crossing midnight must roll `game_date`.
3. **Bracket integrity is server-enforced.** Any bulk time change must run the feeder-ordering check **server-side** (promote `findBracketSchedulingViolations` logic to the API), because the current guard is client-only and a bulk shift bypasses the UI path.
4. **Cancelling a playoff game is a decision, not a side effect.** The bulk tool must explicitly handle the dangling-downstream-slot case rather than silently leaving the bracket stalled.
5. **Notifications are opt-in and rate-sane.** Fans opted in; pushes are deduped and capped (reuse existing push plumbing's dead-subscription cleanup + per-send limits). Anonymous fan messaging is push-only (not email), which sidesteps CASL email consent — but note the anti-spam posture in Open Questions.
6. **Schema = dictionary, same unit of work.** Any migration updates `docs/agents/db/DATA_DICTIONARY.md` and refreshes dev+prod snapshots in the same commit (`npm run refresh:snapshots`, `npm run check:dictionary`).

---

## Phases

### Feature A — Broadened fan notifications + day-of alert push

#### Phase A1 — Announcement push to fans (core ask) — ✅ BUILT dev 2026-07-06 (unpushed, no migration)
- [x] Add a tournament-wide fan fan-out `notifyFansForAnnouncement(tournamentId, {title, body})` in `lib/fan-notify.ts` (mirrors `notifyFansForPlayoff`/`notifyFansForChampions`), reading `fan_push_subscriptions` for **all** subscribers of the tournament. Reuses the existing web-push sender + 410-dead-subscription cleanup + Plus self-gate; returns `{ sent }` so the organizer sees a count; never throws.
- [x] Wire a **new "Push to fans" channel** into the `save` action in `app/api/admin/communications/route.ts` (opt-in per post, alongside site + email; not automatic). Hard-gates to `fan_score_alerts` (403 for free), fires the fan-out after insert, writes a `tournament_plus_feature_used` platform event, returns `pushResults.sent`.
- [x] Push payload deep-links to the tournament's public `/news` page; organizer's title/body carry the notification (body whitespace-collapsed + capped for OS display).
- [x] Admin compose UI (`…/communication/page.tsx`): "Push to fans" toggle shown on Tournament Plus+, a locked upsell row on free; combined result toast ("Posted to site · pushed to N fans"), button label + disabled state updated.
- [x] Plan-gate reuses `fan_score_alerts` (Tournament Plus) — matches the ratified 2026-07-06 decision.
- [~] **Deferred to A2 (needs migration):** coach push on the same event, and pushing to fans who opted in *without* following a team. A1 reaches the fans who already enabled alerts (team-followers) + the existing free coach **email** channel already covers coaches. *(Increment 1 = the push path; the bell/tournament-wide opt-in is A2.)*
- [x] `/review` high-risk funnel passed 2026-07-06 — 4 findings folded: **push now requires the site channel** (deep-link target must exist; UI-coupled both ways + server 400 guard); fan-out returns `{sent, failed}` for honest toasts + partial/failed platform-event status; single-channel button label "Push to Fans". 1 refuted, consent-split deferred to A2.
- [ ] ⚠ Dev-server restart required before browser testing (shared module `lib/fan-notify.ts` + API route changed).

#### Phase A2 — Broaden the fan opt-in (tournament-level + categories) — ✅ BUILT dev 2026-07-06 (⚠ mig 177 DB-apply pending)
> **Built:** migration 177 (`fan_push_subscriptions`: `team_id` nullable + `notify_messages`/`notify_scores` category flags, empty-table-safe) · dictionary updated · subscribe route accepts nullable team + categories (back-compat defaults) · all four fan-outs respect categories (announcement→messages; game/playoff/champions→scores) · `lib/fan-alerts.ts` extended to a shared category state (`subscribeFanAlerts`/`disableFanAlerts`/`readFanAlertsState`) · `FollowAlertsToggle` now reads/writes the shared scores flag (off keeps messages) · new `FanNotificationBell` (top-bar bell + popover/bottom-sheet panel per the /design spec) wired into `Navbar` via `tournamentId`+`fanAlertsEnabled` threaded through `OrgNavContext`/`TournamentNavSync`/layout. Typecheck + focused lint + dictionary green. Design decision logged.
> **`/review` high-risk funnel passed 2026-07-06** (4 lenses: security/multi-tenant · category-filter correctness · shared-state/concurrency · regression/React). Category-filter logic sound (all 6 invariants hold); anonymous-subscribe gating + tournament-scoping sound (no cross-org/cross-tournament leak); no nav regressions. Folded: bell `busyRef` guard so a stale verify/event can't clobber an in-flight switch change (was HIGH), revert optimistic switch state on a failed write, filter the `storage` listener by key, reconcile the misleading "messages-only" comments (a no-team + scores-on sub correctly gets tournament-wide result moments, not per-game scores). Noted non-blocking: rapid double-toggle race is mitigated by `disabled={busy}`; no rate-limit on the anonymous subscribe route (infra-level follow-up before high-traffic launch; table empty + self-cleaning).
>
> **Migration 177 APPLIED TO DEV 2026-07-06** (via `apply-migration-api.mjs`; columns verified — `team_id` nullable, `notify_messages`/`notify_scores` NN default true) + snapshots refreshed (watermark #177, freshness gate green). Fully testable on dev now. **⚠ PROD-PENDING:** apply `177_fan_push_categories.sql --prod` BEFORE promoting this code to master (subscribe write + fan-out filters read the new columns → prod 500 otherwise; both tables EMPTY so safe). Schedule-changes category deferred to Feature B.

- [ ] **Placement (DECIDED 2026-07-06 — owner):** a **global notifications bell in the public tournament top bar** (`components/Navbar.tsx` right-actions group), present on **every public tab, mobile + desktop**, that opens a small panel/sheet with the category switches. This is the **team-independent** entry point — a fan can opt in without following a team. Only rendered when the tournament's plan includes fan push (`fan_score_alerts` tier / Tournament Plus+); no bell on free Tournament. Considered and rejected: an Overview/News-only card (not persistent) and extending the My-Team dock (only appears after following a team + game-day-only → doesn't solve the no-team case).
- [ ] Keep the **existing team "Get alerts" buttons** (My-Team dock, desktop side-rail card, Schedule strip, Overview My-Team card) as **shortcuts that write to the same preferences** — turning on team alerts flips the shared switches; no divergent state.
- [ ] Allow a **tournament-level** opt-in (subscribe with no followed team) so a fan can receive tournament messages without following a specific team. Extend the fan subscription model to allow a tournament-wide (team-agnostic) subscription + per-category preference. **Migration required** on `fan_push_subscriptions` (tournament-wide scope + category flags; confirm exact column shape at build).
- [ ] Fan-facing categories for Feature A (small set, default ON): **Tournament messages** (rain delays / day-of notices) and **Score alerts** (teams you follow). **Schedule changes** category is added **with Feature B** (when there's an automatic "a game moved" event to fire it) so we don't ship a dead toggle. *(Owner-agreed scoping.)* Score alerts still key off followed teams; message alerts are tournament-wide.
- [ ] Respect categories in both `notifyFansForGame()` (score) and the new `notifyFansForAnnouncement()` (messages).
- [ ] Update `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod) for the migration.
- [ ] `/design` polish pass on the bell + panel (net-new fan surface, no prior mockups) — optional gate before build per owner.
- [ ] `/docs` sync: the fan-facing opt-in and what each category means (user-facing flow change).

#### Phase A3 — Polish
- [ ] iOS PWA nudge parity: ensure the "enable notifications" nudge covers the tournament-wide opt-in, not just team-follow (reuse `AlertsNudge`).
- [ ] Off-game-day reflection: confirm a message posted before game day still reaches opted-in fans (push is independent of the 30s poll; verify the banner/news appears on next public load).

---

### Feature B — Bulk "shift the day" schedule tool

#### Phase B1 — Server-side bulk reschedule endpoint (foundation) — ✅ BUILT dev 2026-07-07 (mig 178)
> **Built:** `bulk-reschedule` action on the games PATCH handler (capability `update_schedule`, scoped by tournament). New pure `lib/schedule-shift.ts` (`shiftWallClock` + `planBulkReschedule`) does the wall-clock time math (DST-independent by design — it operates on the stored America/Toronto wall-clock, not an absolute instant; crossing midnight rolls `game_date`) and promotes the bracket-ordering guard **server-side** by reusing `findBracketSchedulingViolations`. Only NEWLY-introduced ordering violations **hard-block** (409) so a pre-existing quirk can't block an unrelated shift (owner: block, not warn). Already-played (`submitted`/`completed`/`forfeit`) and already-cancelled games are skipped + surfaced. Atomicity is delivered by **migration 178** `bulk_reschedule_games(uuid, jsonb, uuid[])` — a `SECURITY DEFINER` RPC locked to `service_role` that applies all shifts + cancels in one transaction (guarded to `status='scheduled'`). **Mig 178 applied to DEV + snapshots refreshed (watermark #178). ⚠ PROD-PENDING: apply 178 before promoting.** 15 unit tests (`tests/unit/schedule-shift.test.ts`) green; typecheck clean.

- [x] New action on `app/api/admin/games` (`bulk-reschedule`) accepting a set of game IDs + an operation: **shift by N minutes** and/or **cancel these IDs**. Capability `update_schedule`. (v1 is forward-only; ≤24h.)
- [x] Time math via `lib/schedule-shift.ts`: apply the offset to each game's wall-clock `game_time`, roll `game_date` on midnight crossing, DST-safe (wall-clock arithmetic).
- [x] **Server-side bracket-ordering validation** (promoted `findBracketSchedulingViolations`): **hard-block** any shift that would newly move a playoff game before its feeders. Closes the client-only gap.
- [x] Transactional: all-or-nothing via the mig-178 RPC. Block/skip `submitted`/`completed`/scored games; surface which were skipped.

#### Phase B2 — Admin "Shift the day" UI — ✅ BUILT dev 2026-07-07
> **Built:** `ShiftDayModal.tsx` opened from a conditional **"Adjust Today"** header button on the Schedule admin page (shown only when there are still-scheduled games dated today, America/Toronto). Lists today's not-yet-played games (select-all + per-row include), shift presets **+30m / +1h / +2h** + custom minutes, per-row **Cancel** toggle, live **old → new** time preview (with a "next day" tag when a game rolls past midnight), inline **bracket-order** flags (Apply disabled while any new violation exists), and an explicit **playoff-cancel warning** (allow, per locked #5). Reuses the same `planBulkReschedule` as the server, so preview and enforcement never diverge.
> **Reminder recompute (owner decision: recompute & reschedule):** built as an isolated, fire-and-forget `lib/game-day-reminders.ts` that mirrors the publish route's idempotent cancel-then-reschedule for the day's affected teams, self-guarding past send-times. ⚠ **Nuance discovered at build:** game-day reminders fire the *evening before* game day, so a same-day rain-delay's reminders have already been sent — the recompute is a correct no-op there and meaningfully re-nudges only a game pushed across midnight into a new day.

- [x] Entry point on the Schedule admin page: "Adjust Today" opening a focused modal (conditional on today's remaining games).
- [x] **Selectable list** of today's remaining games with select-all. Presets +30m / +1h / +2h + custom minutes + per-row cancel.
- [x] Live preview: old → new time per game; inline bracket-ordering flags; Apply blocked on a new violation.
- [x] **Cancel-a-playoff-game**: allow with an explicit warning (locked #5).
- [x] After apply: game-day reminders recomputed & rescheduled for affected teams (owner decision).

#### Phase B3 — Hand-off to Feature A (the end-to-end rain-delay flow) — ✅ BUILT dev 2026-07-07
> **Built:** after the shift lands, the modal advances to an **announce step** — an editable, prefilled message (sport-neutral, built from what actually changed) with a **pre-checked notify toggle** (locked #4). One confirm posts a **pinned** site announcement and fires the notify path: fan push (Plus, `channelPush`) + **new staff/coach push**. "Skip" posts nothing (the shift already applied).
> **Coach push (owner upgraded decision 3 → "also build coach push now"):** added a new `tournament_announcement` notification event type (label/description/category/section/per-tournament list, **default-on push, opt-out-able**; no migration — no DB CHECK on event_type). The communications `save` action now fires `notify()` to org staff + Coaches-Portal coach members whenever the notify intent is on — either `channelPush` (any pushed announcement reaches coaches) or a new `notifyStaff` flag (set by the hand-off so a rain delay reaches coaches on a **free** Tournament too, since day-of safety comms aren't plan-gated). **Scope note:** push reaches org-member staff/coaches; *external* team-contact coaches (Tournament tier) are reached via the pinned public banner (and the email channel in the full composer), not this push.

- [x] On confirming a bulk shift/cancel, offer a **prefilled announcement** with the notify toggle pre-checked (locked #4).
- [x] One confirm → shifts the games (already applied), posts the pinned banner, pushes fans + staff/coaches.
- [x] Sport-neutral copy (message deliberately avoids sport-specific vocabulary).
- [x] `/docs` sync (2026-07-07): Tournaments guide — "Adjust Today" added to the schedule recipe, new `faq-shift-the-day`, and `faq-rain-delay-banner` now routes to the one-step tool. Lint clean.

> **`/review` (high-risk funnel) passed 2026-07-07** — 4 lenses (correctness · security/multi-tenant · data/migration · regression). 0 Critical/0 High. Confirmed correct: atomicity + service_role-only RPC lockdown, tenant scoping, wall-clock/DST/midnight math, plan-gating separation (no fan-push leak; free staff/coach push is the operational notify() system), reminder cancel-then-reschedule idempotency (scheduled sends are stored `status='sent'` so the cancel matches), no DB CHECK rejects the new event type. One cosmetic fix applied: added the `tournament_announcement` bell icon. Advisory (not blocking): DATA_DICTIONARY `notifications.event_type` emitter prose is stale (predates this work) — minor /db cleanup.

---

## Architectural Decisions

- **Decision:** Fan announcement push reuses `fan_push_subscriptions` + the existing web-push sender rather than a new channel. **Rationale:** the plumbing (subscribe route, VAPID, dead-sub cleanup) already exists and is proven by score alerts; only a new fan-out function + event type is needed.
- **Decision:** Bracket-ordering validation moves server-side. **Rationale:** the bulk endpoint bypasses the UI where the only current check lives; a silent bracket corruption is the highest-severity risk in Feature B.
- **Decision:** Bulk reschedule is transactional/all-or-nothing. **Rationale:** a half-applied shift on game day is worse than a rejected one; organizers need a trustworthy single action.
- **Decision:** Notifications are prompted, not automatic, on a bulk shift (subject to Open Question 4). **Rationale:** not every micro-adjustment warrants buzzing every fan; the organizer decides per action, with a sensible default.
- **Decision:** Features A and B ship independently; B3 is the only coupling. **Rationale:** A delivers value alone (announcements finally notify) and de-risks B; B is usable without A (silent shift) but far better with it.
- **Decision:** The fan notifications control lives in a **global top-bar bell** (team-independent), not inside the team card. **Rationale:** the existing "Get alerts" control is welded to a followed team and (on mobile) game-day-only; a persistent bell is discoverable on every tab and lets a fan opt into tournament messages without adopting a team. Existing team toggles remain as shortcuts to the same preferences. (Owner decision 2026-07-06.)

## Owner Decisions (locked 2026-07-06 unless noted)

1. **Fan opt-in model** — ✅ **LOCKED: allow a tournament-wide opt-in** (follow the tournament, no team required) so fans can get rain-delay messages without following a team.
2. **Category granularity** — ✅ **LOCKED: a small set of categories** — Score alerts / Schedule changes / Tournament messages — **default all ON.**
3. **Plan-gating** — ✅ **DECIDED 2026-07-06: gate fan tournament-message / schedule-change push at Tournament Plus** (same tier as `fan_score_alerts`); logged Decided in `BUSINESS_DECISIONS.md`. All anonymous-fan push (scores + schedule + messages) is one bundled Plus capability; base Tournament still posts the public rain-delay banner and emails coaches free (day-of safety comms not gated away — only the push-to-fans convenience layer is). Build reuses the `fan_score_alerts` tier. `/billing` reconciles `lib/plan-config.ts` / `lib/plan-features.ts` / `PLAN_PRICING_FACTS.md` in the build unit of work + runs the drift check; guardrails = opt-in / revocable / rate-limited / operational-only (no marketing push).
4. **Notify-on-shift behaviour** — ✅ **LOCKED: prompt with a prefilled message** and the notify toggle pre-checked (organizer can opt out per action).
5. **Cancel-a-playoff-game in the bulk tool** — ✅ **LOCKED: allow with an explicit warning** + a pointer to resolve the affected downstream game (do not block).
6. **CASL / anti-spam** — Pushing tournament messages to anonymous fans is **push, not email**, so email consent rules don't directly apply; keep it opt-in, per-tournament, easily revocable, and rate-limited. Folded into the `/strategy` routing of #3 for a posture confirmation; no action needed for score alerts (already live).

## Testing / QA

- **Notifications**
  - Fan opts into tournament-wide messages (no team followed) → receives a posted announcement push; deep-link lands on the message.
  - Fan opted into *score only* (category off for messages) → does **not** receive an announcement push.
  - Coach of an accepted team → receives the announcement per their preferences; a coach who opted out does not.
  - Dead/expired subscription (410) is cleaned up, not retried forever.
  - Posting an announcement **without** the notify flag pushes to nobody (pure banner still works).
- **Schedule shift**
  - Shift all remaining by +1h: every selected `scheduled` game moves; already-played (`submitted`/`completed`) games are untouched; midnight crossing rolls the date; DST boundary correct.
  - Playoff feeder-ordering: a shift that would move a final before its semifinals is rejected/flagged **server-side** (not just in the UI).
  - Cancel last 2 + shift rest by 2h: cancelled games leave standings unaffected; remaining games move; a cancelled **playoff** game triggers the chosen warning/block path.
  - Public schedule shows new times within one 30s poll on game day; off game-day, confirm the manual-refresh behaviour and that the pushed message still arrives.
  - Transaction integrity: an induced mid-batch failure leaves **no** games changed.
- **End-to-end (B3)**
  - Rain-delay flow: one confirm shifts games + posts banner + pushes fans & coaches; message copy is sport-neutral; times shown match the shifted schedule.
- **Static:** `npm run verify:changed`; `npm run typecheck` (shared modules touched: `lib/notify.ts`, `lib/fan-notify.ts`, `lib/notification-labels.ts`, `app/api/admin/games`, `lib/timezone.ts`); `npm run check:dictionary` if a migration lands.

## Release Notes

- Migration(s) in Phase A2 (fan subscription categories/scope) and possibly none in Feature B (games columns already exist) — confirm during build. Apply any migration to prod **before** the code that reads it, per the release gate.
- `/marketing` tone review of any changelog line before release (mandatory per release process).
- `/review` high-risk funnel before treating either feature as done (auth/schedule/notification surfaces are substantive).
