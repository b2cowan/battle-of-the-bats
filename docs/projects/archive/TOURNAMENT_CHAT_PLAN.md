# Tournament Chat — Implementation Plan (Coach Chat · Project 1)

**Status:** PLANNED (not started). **First** project in the Coach Chat program. Ships the shared chat engine **and** the tournament-chat surface. **No Coaches Portal dependency** — can ship before the Coaches Portal opens for business.
**Engine spec (canonical):** `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md` (umbrella) §2.
**PM brief:** `docs/projects/active/TOURNAMENT_CHAT_PM_BRIEF.md`
**Origin:** the owner's original ask — "a chat feature so the tournament admin can have a group chat with all participating coaches."

---

## 1. Why this is first

- Sits on **Tournament Plus**, a tier that already exists — needs no new paid-coach population and no Coaches Portal launch.
- Includes **every coach in the tournament, free and paid**, so it's immediately useful to a real customer.
- **Builds the shared chat foundation once**; Projects 2 (In-Org Coach Chat) and 3 (Cross-Org Messaging) reuse it with no rebuild.
- Highest-value, lowest-risk slice — proves the live-chat engine in front of real users early.

## 2. Scope

**a. Shared engine (built here, per umbrella §2):** rooms, room-membership, messages, per-person read watermark, Supabase Realtime, the notification event (in-app bell + web push, no email), and the membership-based access rule. This is the foundation the whole program stands on.

**b. Tournament-chat surface:**
- One room per Tournament Plus tournament containing all participating coaches.
- Tournament admin is the moderator (mute a participant ≤72h, delete a message, close the room to read-only).
- Optional **division sub-rooms**, opt-in per tournament.
- **"Not yet joined" surfacing**: coaches who haven't finished signing up appear as pending with a re-invite, so nobody is silently left out; they auto-activate when they claim their team.
- **Gating:** the host org needs **Tournament Plus**; participating coaches need no plan of their own.

## 3. The participants challenge

The room must include two kinds of coach — those who claimed a free team and those who are paid coaches — merged into one list with no duplicates, and it must visibly flag coaches who haven't completed signup (rather than silently dropping them). This mixed-list resolution is the main net-new logic of this project.

## 4. Top risk — blocking gate

**Live messages silently not arriving** (the Realtime + access-rule "silent no-op" that previously bit the live-scores feature). Validate the access rule with a real live subscription **before** any chat UI is built. This is a hard gate before the surface work starts.

## 5. LOE

~**3–4 weeks** (shared engine ~5–7 days + tournament-chat surface ~8–11 days), one experienced engineer, including migration overhead and the `/review` gate.

## 6. Open decisions

1. Does the tournament room stay readable (read-only) after the tournament archives, or close at archival?
2. Division sub-rooms — opt-in per tournament (recommended) or auto-created when divisions exist?

## 7. Dependencies

None external. This is the program's foundation; everything else depends on **it**, not the other way around.

---

## 8. Surface build (Phase 2) — BUILT on dev (2026-06-20)

**Status:** Core single-room experience BUILT on `dev`, end-to-end, across BOTH coach portals (owner decisions 2026-06-20: *both portals*, *core single-room first then check in*). **No schema change** — the surface rides migration 141 (engine), which is still ⚠ prod-pending. Division sub-rooms deferred to a follow-up pass.

### What shipped
- **Participant resolver** (`lib/chat-resolvers.ts`) — `resolveTournamentChatParticipants(tournamentId, divisionId?)` unions three coach populations and dedupes on `user_id`, plus the inverse `resolveTournamentsForCoach(userId)` for coach-side self-heal:
  1. **CLAIM** — `team_workspace_claims` (status=`claimed`) → `claimed_by_user_id`.
  2. **BASIC** — `basic_coach_team_registrations` → `basic_coach_team_users` (status=`active`). *This is the population the original kickoff under-specified* — free coaches who signed up directly / via email-match never go through the claim funnel.
  3. **REP** (best-effort, guarded) — claim's `team_workspaces.rep_team_id` → `rep_team_coaches` (assistant + co-head coaches of upgraded teams).
  - Teams with **no** logged-in coach → "Not yet joined" (pending), keyed on `teams.email`. A directly-registered Premium coach who hasn't signed in has no schema link to the tournament until they log in, so they correctly appear as pending until then (auto-joins on sign-in via the inverse resolver).
- **Service layer** (`lib/chat-service.ts`) — ensure/sync room (membership reconcile respects admin moderation: never re-activates a removed/muted member, org owners+admins become moderators), paginated history, post-with-notify, mark-read, moderation (mute ≤72h / unmute / soft-delete / close / reopen), display-name hydration, coach room list + unread.
- **API** — shared membership-authorized message routes (`/api/chat/rooms`, `/api/chat/rooms/[roomId]/messages` GET+POST, `.../read` PATCH, `/api/chat/unread`) + admin routes (`/api/admin/tournaments/[tournamentId]/chat` roster, `.../chat/moderate`). Posting is server-side (rate-limited 30/min/user + global, mute/closed/removed enforced in code; the engine's column-scoped grants are untouched).
- **ChatPanel** (`components/chat/ChatPanel.tsx`) — load-history-then-stream (handles the SUBSCRIBED-≠-streaming race; dedupe by id; live soft-delete via UPDATE), composer, mute/closed banners, moderator inline delete, "load earlier". Reused by every surface via `CoachChatView`.
- **Surfaces** — admin Chat tab (`app/[orgSlug]/admin/tournaments/chat`, nav under Operations, `UpgradeGate` on `tournament_chat`); coach Chat entry in **both** portals (org-less `CoachPortalShell` Tier-1 + org-based `CoachesSidebar` `TEAM_NAV`), each with an unread badge (`lib/use-chat-unread.ts`); coach chat pages in both portals rendering the shared `CoachChatView`.
- **Notifications** — `chat_message` event added to `NotificationEventType` + labels + a "Messaging" prefs section; `systemDefaults()` returns push=ON (the one event that does), email=OFF. `notify()` fires bell+push to active members except the sender (works for non-org-member free coaches).
- **Plan gating** — `tournament_chat` PlanFeature → `tournament_plus` (host org only; coaches need no plan). The standalone `team` plan correctly fails this check (rank 0 < tournament_plus rank 1).

### Deliberately deferred / V1 trade-offs
- **Division sub-rooms** — not built (resolver already accepts `divisionId`; needs room-per-division + a picker).
- **Reactive mute/remove teardown** — V1 enforces mute/closed on the next post attempt + room-data refetch (no per-user socket teardown needed, since mute keeps read access and there is no per-coach "remove" action in V1). `chat_room_members` is not realtime-published; a future "remove a coach" action would need the publish + teardown signal (engine lesson #4).
- **Notification deep-link** — omitted in V1 (recipients span two portals + admins; a single link would mis-route most). The unread badge guides users to Chat.
- **"Re-invite"** — surfaced as a client-side *copy join link* + `mailto` on each "Not yet joined" row (the real free self-discovery path), not a new claim-email flow (which would wrongly push free coaches toward paid checkout).

### Verification
- `npm run typecheck` ✅ · ESLint on chat files ✅ (0 errors) · engine proving-slice `scripts/validate-chat-slice.mjs` **12/12** ✅ (foundation intact). Dev server restarted (new files + shared modules) → serves HTTP 200, no Supabase EACCES. ⚠ `npm run verify:changed` shows ONE **pre-existing, foreign** failure — the public-CSS token ratchet on `app/[orgSlug]/check-in/check-in-volunteer.module.css` (committed by another agent, commit `01243f5`); unrelated to this work. Browser testing pending (owner).

### Adversarial review (31-agent funnel, applied)
A scoped 4-dimension review (auth/RLS, resolver, realtime, moderation) + per-finding verification confirmed 16 issues; the real ones are FIXED on dev (re-typechecked + re-linted clean):
- **[high] Former-season coaches reachable via the rep path** — both resolvers now filter `rep_team_coaches` to `draft`/`active` seasons (mirrors `getCoachingAssignmentsForUser`); a coach from a completed/archived season no longer lands in the room.
- **[high] Rejected coaches self-healing in** — the inverse resolver now excludes `rejected` registrations (symmetric with the forward resolver), so an organizer's rejection sticks.
- **[med] Room-creation race could break a tournament's chat** — `getTournamentChatRoom` now resolves deterministically (oldest, `limit(1)`) so a duplicate room can never make the lookup throw.
- **[med] Membership helper made self-guarding** — `ensureCoachMembership` verifies participation before inserting (safe for any future caller); the hot path uses an unchecked internal helper to avoid double-resolution.
- **[med] Admin-vs-admin mute** — an organizer/moderator can no longer be muted; sync clears any stale mute when re-asserting a moderator.
- **[med] Load-then-stream history overwrite** — history now merges with (not overwrites) realtime arrivals during the fetch window; moderator-delete revert restores only the targeted message.
- **[low, fixed] perf** — parallelized the per-room unread/last-message loops + display-name hydration; **[dev] StrictMode channel nonce**; **muted composer** hides on a 403; **unread hook** no longer double-fires on refocus.
- **[low, accepted V1 trade-offs]** — realtime doesn't re-check RLS on a live socket (mute keeps read access by design; no per-coach "remove" action in V1; room-close is enforced on next send); a removed coach who re-registers stays out until an organizer re-adds them; the schema's `muted` status value is unused (mute is tracked by expiry).

---

## 9. Mobile chat-first UX pass (2026-06-22)

Owner feedback (with screenshots): the admin Chat tab stacked the conversation + Members + "Not yet joined" as cards, so on a phone the chat was a cramped box rather than a messaging app — and Chat was buried under "More". Changes (dev, no migration / no engine change):

- **Full-screen conversation (organizer):** the chat fills the content area; the roster (Members + "Not yet joined") and the room controls (mute / close / reopen) moved into a **"Manage" panel** behind a top-right button — a slide-over on mobile, a docked side panel on desktop. The stacked cards are gone.
- **Full-screen treatment for coaches** in BOTH portals: a self-sizing full-height view (heavy page band / breadcrumb chrome dropped); a **"Rooms" switcher** appears in the chat header when a coach belongs to more than one room.
- **Room-switcher-ready header:** the conversation header carries the room name (+ the coach-side Rooms switcher), so **per-division rooms** drop in later with no redesign.
- **Lifecycle-aware tournament bottom nav (mobile):** Chat is now ALWAYS a primary tab; the bar leans setup before the event and game-day once live. **Refined (owner, same session):** Dashboard moved OFF the bottom bar onto the **mobile top-bar title** — the tournament name is now a "home" link to the dashboard (house glyph signals it's tappable), and the tournament switcher lives only in "More". That freed a slot, so BOTH phase-specific slots are lifecycle-aware:
  - **Before live:** Teams · Divisions · Schedule · Chat · More
  - **Once live / after:** Results · Check-in · Schedule · Chat · More
  - Everything else — including Dashboard, as a safety net — stays under "More". (Pre-live's **Divisions** stands in for the "launch checklist", which now lives on the dashboard/home tap; trivially repointable to any setup page.) Desktop sidebar unchanged (all tabs incl. Chat).

typecheck + chat/nav lint clean. Dev server restarted. Owner browser testing pending.
