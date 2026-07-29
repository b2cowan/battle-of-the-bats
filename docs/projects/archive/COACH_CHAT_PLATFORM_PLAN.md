# Coach Chat Platform — Implementation Plan

**Status:** PLANNED (not started). Scoped via two deep multi-agent investigations of the codebase (infra reuse + unified design) 2026-06-18.
**Origin:** Owner LOE request — "a chat feature in the coach portal so the tournament admin can have a group chat with all participating coaches," then expanded by the owner to a multi-surface chat platform.
**PM brief:** `docs/projects/active/COACH_CHAT_PLATFORM_PM_BRIEF.md`

---

## 0. Program structure (restructured 2026-06-19) — this doc is now the UMBRELLA

The surfaces were split into **separate, independently-shippable projects**, each with its own plan + PM brief. **This document remains the canonical reference for the shared engine (§2) and the program rationale; the per-surface build details now live in the project docs below.** Sequenced so a **live chat experience ships before the Coaches Portal opens for business** (Projects 1 and 2 need no Coaches Portal).

| # | Project | Gated to | Coaches Portal needed? | Docs |
|---|---|---|---|---|
| 1 | **Tournament Chat** (builds the shared engine) | Tournament Plus | No | `TOURNAMENT_CHAT_PLAN.md` + `_PM_BRIEF.md` |
| 2 | **In-Org Coach-to-Coach Chat** (+ assistant coaches) | League / Club | No | `IN_ORG_COACH_CHAT_PLAN.md` + `_PM_BRIEF.md` |
| 3 | **Cross-Org Coach Messaging** (scrimmages) | paid coaches both sides | **Yes** (launch first) | `CROSS_ORG_COACH_MESSAGING_PLAN.md` + `_PM_BRIEF.md` |
| — | **Coach↔Parent Chat** (separate later track) | League / Club + new parent login | n/a | §3.C + §4 below (own project + legal review) |

Cross-cutting building block: **assistant coaches** — `../archive/ASSISTANT_COACHES_BUILDING_BLOCK.md` (built + shipped; archived. Introduced in Project 2, also feeds Project 1). The §3/§5/§6 phasing below is retained as the original design record; the table above is the current sequencing of record.

---

## 1. Vision — one engine, thin surfaces

Build **one generic chat engine** (rooms + room-membership + messages + per-user read watermark) and put product surfaces on top of it (three at original scoping; a fourth — cross-org messaging — added 2026-06-19, see §0). Every surface differs only in **who is resolved into a room** (a participant-resolver function) and **where the entry point lives**. The transport, RLS, plan-gating, notifications, and UI panel are shared with zero duplication.

This is deliberately NOT three bespoke chat builds. The engine is built once (Phase 1) and each surface is mostly a resolver + a route + a sidebar entry.

### Locked product decisions (owner, 2026-06-18)
1. **Tournament Chat** = ONE room per tournament for ALL participating coaches, optional **division sub-rooms**, administered by the tournament admin. Nobody else can create rooms; broad tournament-specific comms only.
2. Gated to **Tournament Plus** tournaments. Usable by **ALL their coaches with logins — both free (Basic) and paid (Premium)**. Including every coach is mandatory.
3. All coaches must be reachable.
4. ALSO wanted: **Coach↔Parent chat** (Premium) and **Coach↔Coach peer chat** (Premium) — owner asked to "figure out a way for all of this to work."
5. **Seen receipts at launch.** Full functionality at launch; no urgency, maximize wow.
6. **No email** for chat. Notifications = in-app bell + unread badges + **web push** (the chat-app model). Web push infra already exists.

---

## 2. Shared engine (Phase 1 foundation)

Four tables. Generic columns never change; surface-specific behavior lives only in the resolver layer.

- **`chat_rooms`** — `id`, `org_id`, `surface` (CHECK: `tournament` | `coach_peer` | `coach_parent`), `ref_id` (tournamentId / orgId / coachTeamId by surface), `ref_sub_id` (nullable — division_id / program_year_id for sub-rooms), `name`, `created_by_user_id`, `is_archived`, `settings` jsonb (`coach_post_enabled`, `is_read_only`, `max_retention_days`), `created_at`.
- **`chat_room_members`** — `id`, `room_id` (FK CASCADE), `user_id` (FK auth.users CASCADE), `member_role` (CHECK: `member` | `moderator`), `status` (CHECK: `active` | `pending` | `muted` | `removed`), `muted_until`, `joined_at`, **`last_read_at`** (the read watermark — no separate receipts table at launch scale).
- **`chat_messages`** — `id`, `room_id` (FK CASCADE), `sender_user_id`, `body` (NOT NULL), `deleted_at`, `deleted_by_user_id`, `metadata` jsonb, `sent_at` (default now()). Indexes: `(room_id, sent_at DESC)` for pagination, `(sender_user_id)` for moderation.

**RLS** (the single most important correctness item):
- `chat_messages` SELECT: `EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid() AND status = 'active')`.
- INSERT: same membership check + room `is_archived = false`.
- Moderator soft-delete: UPDATE gated on `member_role = 'moderator'`.
- Service-role bypass for the resolver/room-create API.

**Realtime:** add `chat_messages` to the `supabase_realtime` publication; set `REPLICA IDENTITY FULL` on it BEFORE the publication add (lesson from migration 132 on `games`).

**⚠ Top risk — Realtime + RLS silent no-op:** if the SELECT policy is wrong at subscribe time, the client receives nothing and no error (this bug previously hit `games`, migrations 130/132). **Phase 1 must validate the SELECT policy with a real anon-key Realtime subscription before any UI is built.** This is a blocking gate before Phase 2.

**Resolvers** (`lib/chat-resolvers.ts`, the only per-surface code):
- `resolveTournamentChatMembers(tournamentId, divisionId?)` — UNION of claimed Basic coaches (`team_workspace_claims` status=claimed) and Premium coaches (`rep_team_coaches` via that tournament's teams). **Must DEDUPLICATE on `user_id`** (a coach can appear in both).
- `resolveCoachPeerChatMembers(orgId, programYearId?)` — DISTINCT `user_id` from `rep_team_coaches` JOIN `rep_program_years` WHERE status IN (`draft`,`active`).
- `resolveCoachParentChatMembers(teamId, guardianUserId)` — two-participant rooms (coach + parent).

**Notifications:** add `chat_message` to `NotificationEventType`. New `systemDefaults()` entry: `bell=true, push=true` (chat is the exception that defaults push ON), `email=false` (locked off). On message insert, `POST /api/chat/messages` calls `notify({ orgId, eventType: 'chat_message', userIds: [members except sender], title, body: preview, link })`. Reuses the existing bell INSERT + `push_subscriptions` fan-out in `notify.ts` verbatim. Parents use the same `push_subscriptions` table (they have real `auth.users` rows).

**Seen receipts:** `last_read_at` watermark per member per room. Open room → `PATCH /api/chat/rooms/[roomId]/read`. Unread badge = `COUNT(*) FROM chat_messages WHERE room_id=$rid AND sent_at > last_read_at AND deleted_at IS NULL` (O(messages-since-read), index-backed). Admin moderation panel shows `last_read_at` per member ("last seen"). No per-message "read by N of M" tick at launch (would require a per-message receipts table; deferred).

---

## 3. Surfaces

### A. Tournament Chat (Phase 2 — the core ask)
- Participants: ALL tournament coaches with a completed login — Basic (claimed) + Premium. Unclaimed registrations become `pending` member rows shown as "Not yet joined" in the admin panel; auto-activate on claim. Tournament admin auto-added as moderator. Division sub-rooms opt-in per tournament.
- Admin: Chat tab on tournament settings; delete any message, mute a participant (≤72h), close room (read-only).
- Gating: `tournament_chat` PlanFeature → `tournament_plus`. Host org needs T+; coaches need no plan. `UpgradeGate` on the entry point for non-T+ orgs.
- Identity challenge: the mixed-identity union query is net-new and must dedupe; the "Not yet joined" surfacing is required so "all coaches reachable" doesn't silently fail.

### B. Coach Peer Chat (Phase 3)
- Participants: all Premium coaches in the org on an active/draft program year. One org-wide room auto-created; optional per-team sub-rooms on demand. Admin auto-moderator on the org-wide room.
- Gating: `coach_peer_chat` PlanFeature → `league` (or team-entitlement for team-plan orgs).
- Identity: no gap — all participants have known `user_id`. New `getRepTeamCoachesForOrg(orgId)` helper + new `app/[orgSlug]/coaches/chat/page.tsx` + `CoachesSidebar` entry. Reuses the ChatPanel verbatim.

### C. Coach↔Parent Chat (Phase 4 — the big one)
- Participants: one Premium coach + the guardian(s) of players on that team. One persistent thread per (coach_team, guardian) pair. Only guardians who accepted a parent invite are active.
- Gating: `coach_parent_chat` PlanFeature → `league`. Parents are free.
- **Identity challenge — parents have ZERO identity today.** Requires a brand-new login tier (see §4).

---

## 4. Parent identity (Phase 4 — net-new login population)

Parents/guardians exist in the schema ONLY as plain-text contact fields (`rep_roster_players.guardian_email`, `basic_coach_team_players.contact_email`, also `league_registrations`, `rep_tryout_registrations`) used for admin-read + one-way email blasts. No login, no role, no portal, no invite flow.

**Approach — clone the `team_workspace_claims` blueprint; give parents NO OrgRole / `organization_members` row.**

New tables:
- `parent_identities` (`user_id` UNIQUE FK auth.users, `created_at`).
- `parent_player_links` (`parent_identity_id` FK CASCADE, `player_source` CHECK `rep_roster`|`basic_coach_team`, `player_id`, `linked_at`) — app-layer FK to the right roster table (avoids cross-table DB FK).
- `parent_invite_tokens` (`guardian_email` indexed lower(), `token_hash` SHA-256 unique, `player_source`, `player_id`, `invited_by_user_id`, `status`, `expires_at`, `accepted_at`).

Flow: coach hits "Invite to Chat" on roster → `POST /api/coaches/parent-invite` mints token, emails guardian via Resend → guardian clicks `/parent/invite/[token]` → if no account, `generateLink({type:'invite'})` creates auth user → accept page links `user_id` to `parent_identities` + `parent_player_links`, marks token accepted. **Dedup:** on accept, if a `parent_identities` row already exists for that user, add only a new `parent_player_links` row (one account, many players, across orgs — no one-org constraint because parents aren't org members).

Minimal parent portal: `/parent/inbox` only (room list + ChatPanel + web-push prompt). No dashboard. **Must be architecturally isolated** from the org-context resolution chain so it can't leak admin data.

**⚠ Legal — PIPEDA/CASL:** guardian emails were collected for sports admin, not for creating accounts on the guardian's behalf. Inviting them to create a FieldLogicHQ login needs fresh informed consent disclosure on the invite email + accept page. This is a legal dependency, not engineering — must be answered before Phase 4 code starts.

---

## 5. Phasing & LOE

One experienced engineer familiar with the codebase. All ranges include the mandatory ~1–1.5 day-per-migration process overhead (apply dev+prod, refresh snapshots, DATA_DICTIONARY anchors, check:dictionary, check:migrations) + the `/review` gate at each phase end.

| Phase | Name | LOE | Notes |
|---|---|---|---|
| 1 | Generic chat engine (schema, RLS, Realtime, notify type, generic routes) | **5–7 d** | All 3 tables in one migration (1× overhead). Realtime+RLS validation is a blocking gate. |
| 2 | **Tournament Chat (the core ask)** | **8–11 d** | Mixed-identity resolver + pending-member surfacing + division sub-rooms + admin Chat tab + ChatPanel + UpgradeGate. |
| 3 | Coach Peer Chat | **6–9 d** | Reuses engine + ChatPanel; only new resolver + route + sidebar. No identity gap. |
| 4 | Parent identity + Coach↔Parent chat | **14–19 d** | Largest. 2 migrations (~3 d overhead) + invite/accept flow + dedup + roster UI + minimal parent portal. Legal dependency. |

**Totals:** Phases 1+2 (owner's core tournament chat) = **13–18 dev-days (~3–4 weeks)**. Full platform = **33–46 dev-days (~7–10 weeks)**.

Excludes: PIPEDA/CASL legal review (external, Phase 4); billing changes (parent tier is free — none needed).

---

## 6. Recommendation

Ship **Phases 1+2 first** as a complete, releasable deliverable (clear requirement, existing plan gate, proven infra, no new identity work, delivers "all coaches in one room"). **Phase 3** follows immediately (reuses the engine, no identity gap). **Phase 4** is a separate project with its own PM brief + legal review + kickoff — it's the riskiest, longest workstream with an external (consent) dependency. Do NOT put Phase 4 on the critical path of the well-scoped tournament chat.

---

## 7. New risks (carry into build)

1. **Realtime+RLS silent no-op** — validate SELECT policy with a live subscription before Phase 2 UI. Blocking gate.
2. **Basic coach identity gap** — unclaimed coaches have no login; the admin panel must surface "Not yet joined" + re-invite, or "all coaches reachable" silently fails.
3. **Mixed-identity dedup** — union of claim + rep_team_coaches must dedupe on user_id or coaches get double notifications.
4. **Parent email dedup across modules** — same email in multiple roster tables must resolve to ONE parent account.
5. **One-org constraint** — parents must never get an `organization_members` row; any path that does collides with the one-org rule.
6. **PIPEDA/CASL** — consent disclosure required before first parent invite. Legal exposure if skipped.
7. **Parent portal scope creep** — keep `/parent/inbox` minimal + isolated; product pressure to add schedules/payments will be immediate.

---

## 8. Open decisions (still swing scope)

1. Does the tournament room persist (read-only) after the tournament archives, or close/delete at archival?
2. Division sub-rooms opt-in per tournament, or auto-created when divisions exist? (Opt-in safer.)
3. Coach peer chat default: org-wide room, per-team rooms, or both? (Room-list UX must be designed first.)
4. Parent invite TTL — expire + resend (claim model) or indefinite?
5. Coach↔parent MVP modules — rep teams only, or also free-tier basic coach teams? (Basic doubles resolver + dedup complexity.)
6. Coach turnover — does a new coach inherit prior message history (privacy concern, esp. coach↔parent)?
