# In-Org Coach-to-Coach Chat — Re-scope (Project 2, v2)

> **Status: RULED 2026-07-29 — owner decisions: CH-2 (revised) = per-team staff rooms ONLY,
> build NOW (org-wide room 2B held for the Club evaluation); CH-5 = AMENDED same day: NOBODY
> inherits staff-room history — every member (replacement head coach included) sees messages only
> from their own join date.** Next gate before any code: PM brief + mockups approved (owner
> standing rule).
> Deliverable of **Step 3** of `PROGRAM_COACH_CHAT.md` (2026-07-29). Supersedes the archived
> `IN_ORG_COACH_CHAT_PLAN.md` / `IN_ORG_COACH_CHAT_PM_BRIEF.md` pair — do not build from those.
> **No code in this step.** Owner standing rule applies to the build step that follows: PM brief +
> mockups of every changed screen and state, approved, before any code.
>
> Ground truth below was established 2026-07-29 by three parallel file-content sweeps (engine
> coupling, shipped assistant-coach model, strategy paper trail) — not from status headers.

---

## 1. Why the old plan is dead — three verified corrections

### 1.1 Its centerpiece shipped without it (and is already in chat)
The archived plan's stated reason for existing was that Project 2 would "introduce the
assistant-coach concept" (its §2, §4, §7; six of its nine load-bearing assumptions). That building
block shipped independently as its own project (`docs/projects/archive/ASSISTANT_COACHES_PLAN.md`):
per-assistant capability model (`lib/coach-capabilities.ts`, mig 173), invite/accept flow with
optional org approval (`lib/assistant-invites.ts`, mig 174), nav gating, money/PII redaction —
live since early July. **Assistants are already seated in tournament chat today:**
`lib/chat-resolvers.ts:195-198` pulls *every* `rep_team_coaches` row for a team's active/draft
program year; `coach_role` is never checked. The old plan's "new in this project" feature already
works. The assistant-coach workstream (~0.5–1 week of its estimate) is **deleted from scope**.

### 1.2 Its market statement was wrong, and the market has since split
The old plan gated on "League/Club — the tiers where paid coaches exist." Two corrections:
- **Rep teams are Club-only.** `module_rep_teams` is granted only by `club` / `club_large`
  (`lib/plan-config.ts:95-137`). **League Plus has no rep teams and therefore no paid coaches.**
  An org-wide coaches' room is a *Club-tier* feature, not a "League/Club" feature.
- **A second paid-coach population now exists that the plan predates:** the standalone Premium
  Coaches Portal (`team` plan, $29/mo — $0 Founding Season until 2027-01-01, per
  `PLAN_PRICING_FACTS.md`). Each standalone team is its own workspace org, so for this population
  "in-org chat" collapses to **a per-team staff room** — which is exactly the old plan's "optional"
  deliverable. **The optional half of the old scope is the only half with a purchasable market
  today.**

### 1.3 The org-wide room's whole market is parked
League & Club are **parked and non-purchasable** (`/strategy` 2026-07-28, verbatim in
`BUSINESS_DECISIONS.md`): League re-enters only via an owner-started capability evaluation *after*
the Coach Portal work finalizes; nothing flips meanwhile. Deliverable 2B below therefore has **zero
buyers until Club unparks** — a business constraint, not an engineering one.

---

## 2. Corrected engine facts — the "central design problem" mostly isn't

`PROGRAM_COACH_CHAT.md` §1.3 warned that rooms are tournament-shaped and "an org-wide room has no
tournament to hang off — that is the central design problem." **The data layer already solved it;
the coupling is app-layer.** Verified 2026-07-29:

**Already generic (no rework):**
- `chat_rooms` has **no tournament column**: `surface` + `ref_id` + `ref_sub_id` (mig 141). The
  `coach_peer` surface value has been **reserved in the CHECK constraint since day one** — the
  schema anticipated this exact project ("ref_id = orgId for coach_peer",
  `DATA_DICTIONARY.md:5892`). Dedupe unique index (mig 150) is surface-generic.
- RLS is **membership-only** (`chat_room_members`), never referencing surface/tournament.
- Moderation primitives (mute/close/pin/delete/react/poll/self-mute/report) are room-keyed.
- `notify()` takes `tournamentId?` optional and degrades cleanly; bell/push/prefs all reused.
  **No new notification infrastructure — standing rule.**
- Consumer chat inbox grouping already falls back to a generic "Conversations" kicker for rooms
  with no event name (`ChatInbox.tsx:122`).

**Real gaps — all app-layer, all enumerable (this is the build's true shape):**
1. **Participant resolver** — `lib/chat-resolvers.ts` is 100% tournament-walked. No query anywhere
   returns "all coaches in an org" (`getOrgAssistantCoaches` excludes heads by design). Net-new
   resolver(s): per-team staff (trivial: `rep_team_coaches` on draft/active year — same population
   tournament chat already seats) and org-wide (new org-spanning query).
2. **Organizer/moderator entitlement** — the F4 rule (`getHostModeratorUserIds`,
   `chat-service.ts:463-524`) is `module_tournaments` + tournament-assignment-scoped. A
   tournament-less room needs its own explicit rule. Proposed: org-wide room → admins holding
   `module_rep_teams` (the org-scoped analogue of F4); per-team room → **head coach** moderates,
   Club org admins retain oversight. Same invariants: organizer standing is derived → revokes and
   returns with role; a removed coach stays removed (moderation decision).
3. **Room list + self-heal** — `listRoomsForUser` hardcodes `.eq('surface', TOURNAMENT)`
   (`chat-service.ts:828`) and self-heals only tournament rooms. Until relaxed + branched, a
   coach_peer room is invisible to every surface.
4. **Roster "not yet joined"** — `getRoomRoster` (`:1780`) resolves pending members via the
   tournament resolver; needs a branch (or omission) for coach_peer.
5. **Admin routes + plan feature** — the manage/moderate routes live under
   `/api/admin/tournaments/[tournamentId]/chat/*` gated by `hasPlanFeature('tournament_chat')`. A
   coach_peer room needs a new route home and a new `PlanFeature` key (`coach_peer_chat` was
   envisioned in the umbrella plan but **never added** to `lib/plan-features.ts`). Gating stays on
   the org's plan, mirroring tournament chat (readers/posters are never plan-checked; membership is
   the gate).
6. **Coach-portal UI** — the paid portal's `CoachChatView` is hardcoded tournament-only in copy and
   framing, renders a flat list (F3 clustering was consumer-inbox only), and **the portal has no
   org-wide surface at all** (every nav link is per-team). The org-wide room needs a decided home;
   the per-team room slots naturally into the existing per-team shell.

---

## 3. Re-scoped shape — two separable deliverables

### 2A — Per-team staff room (head coach + assistants of one team)
- **Market: live today.** Premium Coaches Portal teams (Founding-Season cohort growing now) and,
  later, every Club rep team. Adds standing in-app value to the $29 portal ahead of the January
  2027 comp-cohort conversion.
- Membership = the team's `rep_team_coaches` on the draft/active program year — the exact
  population tournament chat already seats, minus the tournament. Self-heals on read like
  tournament rooms.
- Moderator = head coach (org admins retain oversight in Club orgs). CH-5 governs history.
- Honest value note: staffs are small (often 2–4 people who also text each other). The case is
  keeping team comms where the roster/schedule/announcements already live — a retention feature,
  not a growth feature.

### 2B — Org-wide coaches' room (all coaches in a Club org + org admins)
- **Market: parked with Club.** Zero purchasable buyers until the League/Club evaluation concludes.
- Membership = all coaches across the org's active program years (net-new resolver). Moderators =
  org admins holding `module_rep_teams`. Standing season-long channel — moderation model (per-room
  mute/close) inherits as-is and is judged adequate.
- Needs the new admin manage surface + the org-wide UI home (gap 6).

**Shared plumbing** (~half the total work): surface plumbing in list/self-heal/roster, the new
`PlanFeature`, notification pass-through. Building either deliverable pays most of the cost of the
other.

**Explicitly out of scope:** cross-org messaging (Project 3, legal-gated), coach↔parent (Project 4,
unscoped), any change to the assistant capability model, any new notification infrastructure,
typing indicators / file / voice (still deferred program-wide).

**Coarse LOE** (old plan said 2–3 weeks incl. building assistant coaches): 2A alone ≈ 1 week +
review; 2B alone ≈ 1–1.5 weeks (admin surface + resolver + UI home); both together ≈ 2 weeks.

---

## 4. Decisions — ✅ RULED by owner 2026-07-29

| # | Ruling |
|---|--------|
| **CH-2 (revised) + timing** | **Per-team staff rooms only, build NOW.** Org-wide room (2B) held for the League/Club evaluation. |
| **CH-5** | **AMENDED (owner, later same day): NOBODY inherits staff-room history.** Every member — assistants AND a replacement head coach — sees messages only from their own join date. The initial "yes, inherit" ruling was reconsidered when the owner weighed a new assistant walking into months of candid staff talk; offered a role-based rule and a head-coach toggle, the owner chose the flat rule: simplest story, strongest privacy, at the cost of the season record not transferring across coaching changes. Tournament chat is UNTOUCHED (full history on join — shipped behavior; an event room is a bulletin board, a staff room is candid). Coach↔parent history stays an open Project-4 question. |

Original decision framing kept below for the record:

| # | Decision | Recommendation |
|---|----------|----------------|
| **CH-2 (revised)** | What ships: (A) org-wide only — the old standing rec; (B) per-team staff rooms only; (C) both; (D) neither yet — park Project 2 until the League/Club evaluation | The old rec ("lean org-wide only") predates the tier discovery: it now means shipping only the half nobody can buy. **If building now: B** (live market, natural per-team home, smallest slice), with 2B held for the Club evaluation. **If not: D** — this plan is the ready blueprint either way. |
| **CH-5** | Does a replacement/new coach see the room's prior history? | **Yes for coach↔coach rooms** (2A and 2B): the room belongs to the team/org, and season continuity is the point. The "no" half of the old recommendation applies to coach↔parent (Project 4) only. |
| **Timing** | Build now (as a Coach Portal value-add) or after the League/Club evaluation? | Genuine owner call. For now: the portal launch batches are the active front and 2A competes with them for the same build/QA attention. For later: 2A is the only chat piece that serves the founding cohort before January 2027 conversion. **Do not assume a League launch date either way.** |

---

## 5. Build gate — ✅ APPROVED by owner 2026-07-29 (artifact `50a9d5aa` v2 = BINDING SPEC)

> **✅ BUILT ON DEV 2026-07-29** to this spec (uncommitted; owner QA pending). Migration landed as
> **208** (not "one, small" — exactly that: the watermark column + the two RLS predicates). Current
> status + verification record: `PROGRAM_COACH_CHAT.md` §1.3.

Owner standing rule (2026-07-29): **PM brief + mockups of every changed screen and state, approved
before any code.** The 2A mockup set covers: portal chat list (heading "Your tournament chats" →
"Your chats"; staff room pinned first with a STAFF tag — F3's All-coaches pinning precedent),
mobile list, staff conversation, the NEW staff-of-one nudge state (invite CTA → existing Staff
page), and the consumer inbox clustering under the team name. On approval, the mockups are the
binding visual spec.

**V1 behavior spec proposed with the mockups (approve/adjust with them):**
- **Auto-created, undeletable, one per premium team** — ensured on first chat read by any of the
  team's coaches (mirrors tournament-room self-heal). Name: `"<Team name> staff"`, sub-line "Your
  coaching staff" (F2 disambiguation rule; avatar/colour derive from the name as today).
- **Membership** = the team's `rep_team_coaches` on the draft/active program year; seat follows the
  staff assignment. **Chat is NOT an assistant capability toggle** — every staff member is seated,
  matching tournament chat.
- **Per-member history watermark (CH-5 as amended)** — every member sees messages only from their
  own join date; no role exception, no setting. Enforced everywhere content surfaces: history
  fetch, in-conversation search, pinned messages (a pin whose message predates the member is hidden
  from them), and reply quotes (a visible reply quoting a pre-join message renders the quote as
  "not visible to you", never the content). A member who leaves and returns sees from the most
  recent join. Moderator tools operate on visible messages only. **Staff rooms only** — tournament
  chat keeps its shipped full-history-on-join behavior.
- **Moderator = head coach**, derived from `coach_role` (F4 invariant: derived, revokes/returns
  with the role). Existing in-panel moderator tools only (pin, delete) — **no ChatManagePanel, no
  admin surface, no mute UI in V1** (a head coach manages staff on the Staff page, not in chat).
- **Season end** (program year completed/archived): room goes read-only, stays readable — the CH-1
  ruling applied to staff rooms. A new draft/active year reopens it.
- **Gating**: new `PlanFeature` (e.g. `coach_peer_chat`) on `team` + `club`/`club_large`; enforced
  at room-ensure only — readers/posters stay membership-gated, mirroring tournament chat. Free
  basic teams excluded (program's locked rule).
- **Retired for premium coaches**: the "No tournament chats yet" empty state can no longer occur
  (the list is never empty once the staff room exists).
- Migration expected: **one, small** — the CH-5 amendment needs a per-member history watermark on
  `chat_room_members` (join-visibility timestamp) and the message SELECT policy extended to honor
  it for the `coach_peer` surface (RLS must enforce it, not just the app — otherwise a realtime
  subscriber or direct query bypasses the cutoff). Rooms themselves need no schema change
  (`coach_peer` surface + generic schema already live; verify the dedupe index covers the chosen
  ref shape before build). LOE +1–2 days over the original estimate.

Held for 2B (unchanged): admin manage/moderate surface outside the tournament shell, org-wide
resolver, portal home for an org-wide room.
