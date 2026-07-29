# Program — Coach Chat

> **Consolidated 2026-07-28.** Replaces 17 separate chat plan/brief/prompt files (listed in §5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.

---

## 0. Ground truth (verified 2026-07-28)

The chat **engine** and the **tournament chat surface** are built, reviewed, and — because `dev` is
only 8 commits ahead of `origin/master` — **live in production**. Migrations 141 (foundation), 147
(reactions), 148 (poll votes) are applied. The retired source files' `⚠ prod-pending` markers are stale.

The program was originally scoped as four surfaces on one engine. **Surface 1 (Tournament Chat) is
done. Surfaces 2, 3 and 4 have never been started.**

---

## 1. Outstanding work

### 1.1 Division Rooms ("Channels") — built, needs sign-off only
Organizer-created, division-scoped rooms on top of an always-present undeletable "All coaches" room.
All 7 design decisions were confirmed at the recommended set. No migration. Built 2026-06-24 and
shipped. **Remaining: owner walkthrough, then close.**

### 1.2 Chat Adoption Dashboard — in progress, unfinished
A "Coach sign-ups & chat" panel on the admin tournament dashboard showing the adoption funnel —
teams with a coach email → coaches signed up → coaches in the room — plus one-click "remind the
not-yet-joined" (reuses the existing coach access-link email) and a tier-aware locked upsell.
Status: **IN PROGRESS on dev, not finished.** Smallest remaining piece of the shipped chat surface.

### 1.3 In-Org Coach-to-Coach Chat (Project 2) — NOT STARTED
Paid coaches inside ONE org talking to each other: an org-wide room plus optional per-team rooms,
League/Club gated, reusing the Project-1 engine. **This project is where the assistant-coach concept
was originally introduced** — but assistant coaches have since been built and shipped independently,
so re-scope before building.

### 1.4 Cross-Org Coach Messaging (Project 3) — NOT STARTED
A coach in one org messages a coach in another (e.g. to arrange a scrimmage). Locked constraints:
free coaches excluded; **both sides need a paid coaching entitlement**; start with invite-by-link,
**not** a directory. The opt-in directory is V2 and is **blocked on a CASL/PIPEDA legal review** —
do not build discovery without it.

### 1.5 Coach ↔ Parent chat (Project 4) — NOT STARTED, unscoped
Named in the umbrella plan; never given its own plan. Carries the heaviest privacy load in the
program (minors, guardians, message retention). Treat as unscoped.

### 1.6 Phase 3 conversational depth — residual
Tier-1 set (pinned, reply/quote, @mentions, emoji picker, delete-own, in-conversation search,
"read by N"/"last seen") plus reactions and polls are built and reviewed. Deliberately **deferred and
still deferred**: typing indicators, per-message "seen by [names]" list, file/voice/calls.

### 1.7 UX review residue
Phases 1 and 2 of the 90-finding chat UX review are built. A small set of findings needed backend
changes and were parked out of presentational scope — re-check the review's "Deferred" section before
the next chat touch.

---

## 2. Decisions required from you

These have been open since June and **block Projects 2–4 from being scoped**:

| # | Decision | Recommendation |
|---|----------|----------------|
| CH-1 | **Does a tournament's chat room stay readable after the tournament archives, or close at archival?** | Read-only persistence — coaches reference it after the event. |
| CH-2 | **Coach peer chat (Project 2): one org-wide room, per-team rooms, or both?** | Design the room-list UX first; lean org-wide only at launch. |
| CH-3 | **Which paid entitlements qualify for cross-org messaging** — paid Coaches Portal only, or also Premium coaches inside League/Club, and does a Tournament Plus admin who also coaches count? | Paid Coaches Portal + Premium-in-org; exclude admin-who-coaches. |
| CH-4 | **Do cross-org threads persist indefinitely, or auto-archive after inactivity?** | Auto-archive after inactivity — reduces PII surface. |
| CH-5 | **When a coach is replaced mid-season, does the new coach inherit prior message history?** | No, for coach↔parent. Yes, for coach↔coach team rooms. Privacy asymmetry is deliberate. |
| CH-6 | **Coach↔parent MVP: rep teams only, or also free-tier basic-coach teams?** | Rep teams only — free-tier doubles resolver + dedup complexity for no revenue. |
| CH-7 | **Parent invite TTL — expire-and-resend, or valid indefinitely?** | Expire and resend. |
| CH-8 | **Is Project 2/3/4 still wanted at all?** They've sat untouched for 5 weeks while the coach portal absorbed all attention. | **Answer this one first** — CH-1…CH-7 only matter if the answer is yes. |

---

## 3. Sequencing note

Projects 2–4 were scoped **before** the Coaches Portal launch program existed. The portal is now the
active front, and cross-org messaging carries a legal dependency. Recommended order if you continue:
**finish the adoption dashboard → close division rooms → re-scope Project 2 against the shipped
assistant-coach model → hold 3 and 4 until there are real standalone paid coaches to talk to each other.**

---

## 4. Shipped — reference only

- **Chat engine** — rooms, members, messages, read-watermark; Supabase Realtime; membership-based RLS with column-scoped grants; reuses the existing `notify()` / bell / push infrastructure (no new notification infrastructure). Proving slice validated 12/12 against the live dev DB.
- **Tournament Chat surface** — one room per tournament for ALL coaches (free + paid), across both coach portals, admin moderator mode, "not yet joined" surfacing for unclaimed coaches.
- **Phase 3 conversational depth** — pinned messages, reply/quote, @mentions, emoji picker, delete-own, in-conversation search, read-by-N/last-seen, emoji reactions, real polls.
- **Chat UX & design review** — 12-dimension adversarial review benchmarked against iMessage/WhatsApp/Slack/Discord; 90 verified findings; Phases 1 + 2 built (one shared dark style, coloured sender initials, new-message marker).
- **Division Rooms** — organizer-created, division-scoped channels with an undeletable "All coaches" room.

---

## 5. Source files consolidated (archive candidates)

`COACH_CHAT_PLATFORM_PLAN.md` · `COACH_CHAT_PLATFORM_PM_BRIEF.md` · `TOURNAMENT_CHAT_PLAN.md` ·
`TOURNAMENT_CHAT_PM_BRIEF.md` · `TOURNAMENT_CHAT_SURFACE_KICKOFF_PROMPT.md` ·
`TOURNAMENT_CHAT_UX_REVIEW.md` · `TOURNAMENT_CHAT_UX_REVIEW_PM_BRIEF.md` ·
`TOURNAMENT_CHAT_UX_REVIEW_KICKOFF_PROMPT.md` · `TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PLAN.md` ·
`TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PM_BRIEF.md` · `TOURNAMENT_CHAT_PHASE3_KICKOFF_PROMPT.md` ·
`TOURNAMENT_CHAT_DIVISION_ROOMS_PLAN.md` · `TOURNAMENT_CHAT_DIVISION_ROOMS_PM_BRIEF.md` ·
`IN_ORG_COACH_CHAT_PLAN.md` · `IN_ORG_COACH_CHAT_PM_BRIEF.md` · `CROSS_ORG_COACH_MESSAGING_PLAN.md` ·
`CROSS_ORG_COACH_MESSAGING_PM_BRIEF.md` · `CHAT_ADOPTION_DASHBOARD_PLAN.md` ·
`CHAT_ADOPTION_DASHBOARD_PM_BRIEF.md`
