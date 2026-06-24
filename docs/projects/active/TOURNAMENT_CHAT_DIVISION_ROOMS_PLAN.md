# Tournament Chat — Division Rooms ("Channels")

**Status:** PLANNED (scoped 2026-06-23). Deferred item from Tournament Chat Phase 3. **No database migration required** (the engine was built for sub-rooms). Ships as its own wave behind `/review`, after the current chat work deploys.
**PM brief:** `TOURNAMENT_CHAT_DIVISION_ROOMS_PM_BRIEF.md`
**Builds on:** the Tournament Chat engine (mig 141), the surface build, and Phase 3 (reactions/polls). Reuses `ChatPanel`, `lib/chat-service.ts`, `lib/chat-resolvers.ts`, the coach multi-room list (`CoachChatView`), and the admin chat surface.

---

## 1. What this is

Today a tournament has **one** chat room — "All coaches." Big multi-division tournaments want to split coordination by division (a U12 channel, a U14 channel, a Championship channel) so a coach only sees what's relevant. This adds organizer-created, division-scoped rooms on top of the always-present "All coaches" room — a **Slack/Discord "channels"** model.

## 2. The model (proposed — owner instinct, confirm at build)

**A flexible, anchored model:**

1. **Default "All coaches" room — always present, zero-config, undeletable.** Exactly today's behavior; chat works out of the box with no setup. It's the everyone/announcements channel and the safety net. (It may be *archived* like any room, but never deleted — there is always a home room.)
2. **Organizers create additional rooms, each scoped to one or more DIVISIONS.** A room = a name + the set of divisions it covers. Membership = organizers (moderators) + every coach whose team is in a covered division.
3. **Membership AUTO-MAINTAINS from the division set** (not one-time invites): when a new team registers into a covered division, its coach is auto-added to that room. No manual upkeep, no rot.
4. **Coaches are auto-placed and never manage rooms.** A coach sees the rooms they belong to (All-coaches + any room covering their team's division) in the existing room list; they can be in several. Organizers moderate every room from the admin chat.

**Deliberately OUT of V1** (add later if asked): adding *individual* coaches/teams to a room by hand; rooms spanning multiple tournaments; coaches creating rooms.

**Why this over "one room per division" (rigid):** the flexible model lets organizers group divisions or make cross-cutting rooms, costs only modestly more, and matches how organizers actually think ("a channel for the older kids," "a champs channel"). Why over "manual invites": division-scoping is self-maintaining as teams register.

## 3. Engine readiness — why this is an ADD, not a rebuild

Most of the foundation already exists (this is the big LOE reducer):

- **Storage, no migration:** `chat_rooms.ref_sub_id` distinguishes sub-rooms (the new uniqueness guard from mig 149 already keys on it), and `chat_rooms.settings` (jsonb) can hold the room's covered-division set. A created room gets a unique `ref_sub_id` (its own opaque sub-identity) + `settings.divisionIds = [...]`; the "All coaches" room stays `ref_sub_id = NULL`.
- **Participant routing already scopes by division:** `resolveTournamentChatParticipants(refId, divisionId)` already filters teams by `division_id` (the `teams` spine carries it). Extend it to accept a SET of divisions (`.in('division_id', divisionIds)`) — small change.
- **Sync already accepts a division:** `syncTournamentChatRoom({ room, divisionId })` already exists; generalize to a room's division set.
- **Everything else is room-agnostic:** messages, reactions, polls, pins, mute, read-state, realtime/RLS, notifications all key on `room_id` and work per-room unchanged. The coach **multi-room list + sidebar** was just built/polished. The new room-uniqueness guard prevents duplicates.

## 4. What needs building

**Server (~2–2.5d)**
- Room CRUD: create an additional room (name + divisionIds → `ref_sub_id = new uuid`, `settings.divisionIds`); rename; archive/reopen; **the All-coaches room is protected from delete**.
- Generalize the resolver to a division SET; per-room sync (members = organizers + coaches in the room's divisions); coach self-heal extended to ensure membership in **every** matching room (today it heals only the All-coaches room).
- List rooms for a tournament (admin) with member/pending counts per room.

**Organizer admin UI (~3d — the bulk)**
- The admin chat screen becomes **multi-room**: a room switcher/list (All-coaches + created rooms), open + moderate each independently (reuse the existing Manage panel per room), and a **"New room"** composer (name + division multi-select, with an at-a-glance "covers N teams / M coaches"). Archive/reopen + rename per room. Empty-room state (a division with no teams yet).

**Coach side (~0.5d)**
- Mostly works via the existing room list. Ensure created rooms surface with a clear name; confirm the auto-placement + the "Your tournament chats" labeling reads well with several rooms.

**Decisions + `/review` + testing (~1–1.5d)**
- Confirm the open decisions (below); proving-slice is unaffected (no new realtime table); adversarial review on the new write paths (room CRUD + membership routing) + the multi-room organizer UI.

## 5. Open decisions (recommendations in **bold**)

1. **Flexible (admin-composed, multi-division) vs rigid (one room per division)?** → **Flexible** (this plan).
2. **Membership auto-maintained from the division set, or one-time invite?** → **Auto-maintained.**
3. **Keep "All coaches" always (undeletable)?** → **Yes** (archivable, not deletable).
4. **Can a room cover multiple divisions?** → **Yes** (the flexible model's point).
5. **Individual coach/team add beyond divisions, in V1?** → **No** (defer).
6. **Can a coach be in several rooms at once?** → **Yes** (expected; the list handles it).
7. **Notifications per room?** → **Yes**, reuse the existing per-room notify (no new infra).

## 6. LOE & phasing

**≈ M–L, ~6–8 working days (~1.5 weeks). No migration.** The flexible model is ~1–2 days more than the rigid one (the room composer + multi-division resolver); recommended given the value and the modest delta. Independently shippable behind `/review`. Suggested order: server room-model + routing → organizer multi-room UI → coach-side polish → review.

## 7. Verification & guardrails

- No new schema/realtime table → the existing proving slice still covers the engine; add focused tests for division→room routing + the protected All-coaches room.
- `/review` (high-risk: new write paths + membership routing) on the room CRUD + the resolver generalization + the organizer UI.
- Same Tournament Plus gate; no new in-chat paywall. Tokens-only UI; reuse the bounded-pane chat design + the multi-room list pattern.
- Offer `/docs` (new organizer-facing flow: creating division rooms).
