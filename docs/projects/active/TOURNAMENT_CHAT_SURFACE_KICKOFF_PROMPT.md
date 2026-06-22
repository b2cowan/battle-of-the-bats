# Kickoff Prompt — Tournament Chat SURFACE build (Coach Chat · Project 1, phase 2)

> **How to use:** open a fresh chat in this repo and paste everything below the line. It is self-contained. The shared chat ENGINE is already built, reviewed, and proven on dev; this builds the organizer- and coach-facing screens on top of it.

---

You are building the **Tournament Chat surface** for FieldLogicHQ — the actual screens on top of an already-built, already-validated chat engine. This is phase 2 of **Project 1** of the Coach Chat program.

## What already exists (do NOT rebuild it)

The shared chat **engine** shipped as migration **141** (`supabase/migrations/141_chat_foundation.sql`), applied to **dev** (⚠ prod-pending) and committed. Three tables: `chat_rooms`, `chat_room_members` (with a `last_read_at` read watermark), `chat_messages` (append-only, soft-delete). Access is **membership-based**: a user reads/posts in a room only if they hold an `active` row in `chat_room_members`. `chat_messages` is realtime-published (REPLICA IDENTITY FULL → `supabase_realtime`).

It was validated 12/12 on the live dev DB by `scripts/validate-chat-slice.mjs` (re-runnable: `node --env-file=.env.local scripts/validate-chat-slice.mjs`). Read these before starting:
- `docs/projects/active/TOURNAMENT_CHAT_PLAN.md` (this surface's plan)
- `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md` §2 (the canonical engine spec)
- `docs/agents/db/DATA_DICTIONARY.md` → the **Chat** domain (table/column meanings + the security posture)

## Hard-won lessons from building the engine — honor these or you WILL reintroduce bugs

1. **Load history, then stream.** A realtime channel reports `SUBSCRIBED` a beat *before* it actually starts streaming; a message sent into that gap is silently missed. The UI MUST fetch existing messages via a normal API call, then treat realtime `postgres_changes` INSERTs as *post-connection* updates. (Precedents: `components/live-logic/LiveLogicProvider.tsx`, `components/notifications/NotificationBell.tsx`. Subscribe with `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: \`room_id=eq.${roomId}\` }, cb)`.)
2. **Writes are column-scoped on purpose — do NOT loosen the grants.** A `/review` caught a privilege-escalation hole and we fixed it with column-level grants. `authenticated` may ONLY: `UPDATE(last_read_at)` on `chat_room_members`; `INSERT(room_id, sender_user_id, body, metadata)` + `UPDATE(deleted_at, deleted_by_user_id)` on `chat_messages`. **Everything else — creating rooms, adding/removing/muting members, the admin moderation actions — MUST go through service-role API routes** (`lib/supabase-admin.ts`). Never grant broader column access to close a feature gap; route it server-side instead. An RLS `WITH CHECK` cannot compare old-vs-new, so RLS alone can't police which columns change — that's why writes are server-side.
3. **`chat_room_members` SELECT is own-rows-only** (`user_id = auth.uid()`) to avoid RLS recursion. The full member roster is read **server-side via the service role**, never from a member's own client.
4. **On removal, drop the client channel.** Supabase realtime does NOT re-check RLS on a live socket — a removed member keeps receiving until they reconnect. When the admin removes/mutes someone, the client must `removeChannel`/refetch; design the removal flow to signal the client.
5. **Membership RLS is org-agnostic by design** (cross-org Project 3 reuses it) — don't add `org_id` checks into the message policies.

## Owner-locked product decisions (do not relitigate)

- **One room per tournament**, containing **all participating coaches — free (claimed) AND paid**. Optional **division sub-rooms, opt-in per tournament**.
- **Tournament admin** is auto-moderator: mute a participant (≤72h), delete any message (soft-delete), close the room to read-only.
- **Gated to Tournament Plus** (the host org). Participating coaches need no plan of their own.
- **Room stays readable (read-only) after the tournament archives** (don't delete).
- **Seen = "last seen" watermark** (`last_read_at`), not per-message read ticks.
- **Notifications = in-app bell + web push only. NO email.** (Chat is the one event type that defaults push ON.)

## Scope to build

1. **Participant resolver** (new `lib/chat-resolvers.ts`): `resolveTournamentChatMembers(tournamentId, divisionId?)` = the UNION of claimed free/Basic coaches (`team_workspace_claims` status=claimed) and paid/Premium coaches (`rep_team_coaches` via that tournament's teams). **MUST dedupe on `user_id`** (a coach can appear in both). Coaches with no completed login become `pending` member rows surfaced as **"Not yet joined"** with a re-invite, and auto-activate on claim. Verify the exact source tables against the live schema before coding.
2. **Service-role API routes** (under `app/api/...`, follow the coaches-portal route pattern + `resolveCoachContext()` where coach-facing): create/sync the room + memberships from the resolver; list rooms; fetch message history (paginated, `(room_id, sent_at DESC)`); post a message (or let the client INSERT directly — it has the column-scoped grant — but the history fetch + room/member management are server-side); mark-read (PATCH `last_read_at`); admin moderation (mute / soft-delete / close) — all service-role.
3. **ChatPanel UI** (shared component, reused by every future surface): history load → live stream → composer → unread badge driven by `last_read_at`. Mobile-first, matches the coaches-portal + admin design conventions.
4. **Admin Chat tab** on the tournament (admin shell): the moderation surface (member list incl. "Not yet joined", mute/delete/close). Tournament admin auto-added as moderator.
5. **Coach entry point**: a Chat item in the coaches portal sidebar with an unread badge.
6. **Tournament Plus gating**: add a `tournament_chat` PlanFeature → `tournament_plus` (`lib/plan-features.ts` `FEATURE_MIN_PLAN`), and `UpgradeGate` the entry point for non-T+ hosts. Note: the standalone `team` plan shares rank 0 with free `tournament`, so if any coach-side gate is ever rank-based, use an account-kind-aware check (not relevant for tournament-host gating, which is T+).
7. **Notification wiring** (`chat_message` event): add `'chat_message'` to `NotificationEventType` (`lib/types.ts`); add entries to `NOTIFICATION_EVENT_LABELS` + `NOTIFICATION_EVENT_DESCRIPTIONS` (`lib/notification-labels.ts` — exhaustive Records, tsc fails if missing); add a `systemDefaults()` branch in `lib/notify.ts` returning `{ bell: true, push: true, email: false }` (the one type that defaults push ON); optional icon in `NotificationPanel`. On message insert, call `notify({ orgId, eventType: 'chat_message', userIds: [members except sender], title, body: preview, link })`.
8. **Division sub-rooms** (opt-in per tournament) — last, once the single-room flow works.

## Conventions & guardrails (this repo is strict)

- **This is Next.js 16 with the `proxy.ts` convention** — read `node_modules/next/dist/docs/` for anything framework-level; do not assume training-data Next.js. Do not create `middleware.ts`.
- **Coaches portal architecture** (`memory/project_coaches_portal_architecture.md`): coach-facing code lives under `app/[orgSlug]/coaches/` + `app/api/coaches/[orgSlug]/`, gated by `rep_team_coaches`, never inside the admin shell.
- **If you need a new migration** (the engine likely covers tournament chat, so you may not): next number after the current highest in `supabase/migrations/`; apply to dev with `node scripts/apply-migration-api.mjs <file>` (NOT prod); then `npm run refresh:snapshots`, update the DATA_DICTIONARY (same unit of work), and `npm run verify:changed`. Prod apply is a deliberate release-time step.
- **Shared-module edits** (`lib/types.ts`, `lib/notify.ts`, etc.) and **new files** require a **dev-server restart** (`stop → rm -rf .next → npm run dev → wait for Ready`) before browser testing — batch and restart once near handoff.
- **Verification split:** you write code + run `npm run verify:changed` / focused lint / `npm run typecheck` (shared modules touched); the **user does browser testing**. Provide a short "what to click" handoff.
- **Branch:** work on `dev`. It's a SHARED working copy with other agents — stage **explicit pathspecs only**, never `git add -A`, and after any commit run `git show --stat HEAD` to confirm only your files landed (concurrent commits can collide). Commit only when the user asks.
- **Run `/review`** (the high-risk adversarial funnel) before treating it done — this is auth/RLS/shared-module/realtime territory. Then offer `/docs` since it changes a user-facing flow.

## Definition of done (this phase)

A Tournament Plus organizer sees a Chat tab with every participating coach (incl. "Not yet joined"); coaches see a live chat with unread badges + push; the admin can mute/delete/close; messages load-then-stream with no missed-first-message race; non-members and removed members are fully walled off (re-run `scripts/validate-chat-slice.mjs` to confirm the engine still passes, and add surface-level checks). No prod migration applied; no broadening of the column-scoped grants. Lead your handoff summary to the owner in plain product-owner language.
