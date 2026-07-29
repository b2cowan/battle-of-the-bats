# Program — Coach Chat

> **Consolidated 2026-07-28.** Replaces 17 separate chat plan/brief/prompt files (listed in §5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.

---

## 0. Ground truth (re-verified 2026-07-29 — by file content, not commit counts)

The chat **engine** and the **tournament chat surface** are built, reviewed, and **live in
production**. Migrations 141 (foundation), 147 (reactions), 148 (poll votes) are applied. The
retired source files' `⚠ prod-pending` markers are stale.

> **Method correction (2026-07-29).** The 2026-07-28 version of this section inferred "live in
> production" from *"`dev` is only 8 commits ahead of `origin/master`"*. That number was already
> **20** a day later, and a commit count is not evidence about any specific feature anyway. The
> conclusion happened to be right; the method was not. **Everything below was re-checked by
> comparing file content between `dev` and `origin/master` and by confirming the introducing commit
> is an ancestor of `origin/master`.** Do the same before trusting any status line here.

The program was originally scoped as four surfaces on one engine. **Surface 1 (Tournament Chat) is
done. Surfaces 2, 3 and 4 have never been started.**

---

## 1. Outstanding work

### 1.1 Division Rooms ("Channels") — built + live; walkthrough ISSUED 2026-07-29, awaiting owner pass
Organizer-created, division-scoped rooms on top of an always-present undeletable "All coaches" room.
All 7 design decisions were confirmed at the recommended set. No migration. Built 2026-06-24 and
shipped in `cb428b30`. **Shipped status re-verified 2026-07-29 by file content — `dev` is identical
to `origin/master` for every room surface. This part of the doc was accurate.**

**Walkthrough issued 2026-07-29** (artifact `9a2ed199`) — 22 checks across three real dev events
(`/dev-test-org/live-demo` 2 divisions · `/milton-softball-organization/battle-of-the-bats` 5
divisions + finished · `/free-test-org/free-cup` free-tier lock). Note: **dev currently has zero
chat rooms**, so the walkthrough exercises a true cold start. **Remaining: owner pass, then close.**

**Seven findings surfaced by mapping the shipped behaviour** (8-agent map + adversarial verify —
these are NOT the original 7 design decisions; they are new, and none blocks sign-off):

| # | Finding | Recommendation |
|---|---------|----------------|
| **F4** | **A staff-role member can moderate a room they cannot read or post in** — capability grants create/delete/mute/close, but auto-sync only makes owners/admins members. They see "Couldn't load this conversation" and "You are not a member of this conversation" while still holding full moderation power. | **Real defect — needs an owner ruling.** Prefer putting staff in the rooms they moderate. |
| F1 | A room's **divisions can never be changed after creation** (rename only); recovery = delete while empty, else close and recreate | Leave; record as a known limitation |
| F2 | Coaches get **no division label** — the organizer's free-text room name is the only signal | Small fix, bundle with F3/F5 |
| F3 | **"All coaches" is pinned on the admin side but sorts by recency for coaches**, so it can sink below a busy division room | Pin it for coaches too |
| F5 | **No duplicate-name check** — two identically-named rooms are indistinguishable to a coach (compounds F2) | Cheap warning; bundle |
| F6 | **Membership only re-syncs when someone opens a chat surface** — same root cause as the Step 1 "in the chat" staleness | Fix once, for both |
| F7 | A failed rename reports only a generic error (rename box has no length cap; server rejects) | Trivial; fold into any future chat touch |

### 1.2 Chat Adoption Dashboard — ✅ SHIPPED (was never "half-built"); Step 1 hardening built 2026-07-29
A "Coach sign-ups & chat" panel on the admin tournament dashboard showing the adoption funnel —
teams with a coach email → coaches signed up → coaches in the room — plus one-click "remind the
not-yet-joined" (reuses the existing coach access-link email) and a tier-aware locked upsell.

**Status correction (2026-07-29).** The previous status — *"IN PROGRESS on dev, not finished"* /
*"half-built"* — was **wrong**. The panel shipped in commit `82cb34cb` on **2026-07-07** and has
been **live in production for three weeks**; all five files behind it are byte-identical between
`dev` and `origin/master`. Every element of the original plan was built: all three funnel stages
(stage 3 is a real `chat_room_members` read, not a placeholder), the remind action, the locked
upsell, and the empty / all-joined / no-email / room-not-open states. Verified by content across a
43-agent evidence sweep with adversarial verification, not by reading a status header.

**What was genuinely missing** — found by that sweep and **built 2026-07-29** under the owner's
PM-brief-and-mockups gate (mockups = binding spec, artifact `ce88e12a`):

| Fix | Problem | Resolution |
|-----|---------|------------|
| 01 | Remind button had **no brake and no record** — repeat clicks re-mailed the same coaches; nothing recorded any send, ever | 24h **per-tournament** cooldown (**S1-A**) + audit trail (**S1-B**), mig 206. Claimed atomically **before** sending so a co-organizer double-click loses the race; released if the batch reaches nobody |
| 02 | Staff without registration access saw the button and got the bare word **"Forbidden"** | Button hidden for them; funnel still shown; explanatory sentence instead. Server gate unchanged + authoritative |
| 03 | **Loading and failure were the same sentence** | Skeleton while loading; distinct error card with panel-level "Try again" |
| 04 | Reminder email never mentioned chat | One added sentence, **only** on this batch path (the single-team resend path must not promise a chat that may not exist) |
| CH-1 | — | Finished/archived events stop chasing sign-ups; the room stays readable. Enforced client + server |

Two adversarial review rounds (18 + 9 agents) found and closed: success counted **settled promises
instead of deliveries** (a dead mail key would have reported "sent to 40 teams" and armed a 24h
lockout having delivered nothing); a TOCTOU race across the send; a stranded-claim phantom lockout;
a regression where the panel **vanished entirely** on any dashboard-wide error. Claim/release
verified against the dev DB across all six branches including the concurrent race.

⚠ **Release gate: migration 206 MUST be applied to prod BEFORE this code promotes** — the dashboard
and send routes both SELECT the new columns. `npm run check:migrations` blocks the release until
then. **Not yet committed; owner QA pending.**

**Known, deliberately deferred:** the "in the chat" count only refreshes when someone opens the chat
tab (a passive read; no sync is triggered from the dashboard), so it can read 0 while coaches sign
up. Needs a different fix than the five above. **The funnel also blends free-portal and paid coaches
into one number** — judged not worth splitting, since the organizer pays for chat either way.

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
| ~~CH-1~~ | ~~**Does a tournament's chat room stay readable after the tournament archives, or close at archival?**~~ | ✅ **RESOLVED 2026-07-29 — read-only persistence.** Ratified by the owner with the Step 1 brief. Built: a `completed`/`archived` event keeps its room readable but **stops chasing sign-ups** — the reminder button retires and the send route refuses (409). |
| CH-2 | **Coach peer chat (Project 2): one org-wide room, per-team rooms, or both?** | Design the room-list UX first; lean org-wide only at launch. |
| CH-3 | **Which paid entitlements qualify for cross-org messaging** — paid Coaches Portal only, or also Premium coaches inside League/Club, and does a Tournament Plus admin who also coaches count? | Paid Coaches Portal + Premium-in-org; exclude admin-who-coaches. |
| CH-4 | **Do cross-org threads persist indefinitely, or auto-archive after inactivity?** | Auto-archive after inactivity — reduces PII surface. |
| CH-5 | **When a coach is replaced mid-season, does the new coach inherit prior message history?** | No, for coach↔parent. Yes, for coach↔coach team rooms. Privacy asymmetry is deliberate. |
| CH-6 | **Coach↔parent MVP: rep teams only, or also free-tier basic-coach teams?** | Rep teams only — free-tier doubles resolver + dedup complexity for no revenue. |
| CH-7 | **Parent invite TTL — expire-and-resend, or valid indefinitely?** | Expire and resend. |
| ~~CH-8~~ | ~~Is Project 2/3/4 still wanted at all?~~ | ✅ **RESOLVED 2026-07-29 — YES, the program is KEPT and GREENLIT to start.** Owner considered retiring it (including the live Tournament Chat surface) and explicitly declined: *"don't kill it."* CH-1…CH-7 are therefore live decisions again. |

---

## 3. Sequencing — ✅ PROGRAM STARTED 2026-07-29

Projects 2–4 were scoped **before** the Coaches Portal launch program existed. The portal is now the
active front, and cross-org messaging carries a legal dependency. Ratified order:

1. ~~**Finish the adoption dashboard**~~ — ✅ **DONE 2026-07-29.** The premise ("half-built") was
   false: it had been live in production since 2026-07-07. Step 1 became a **defect-fix pass** on a
   shipped feature instead of a build — see §1.2. The stated purpose still holds and is now served:
   there is an honest adoption read, and the reminder that drives it can no longer spam a coach.
2. **Close division rooms** — built and shipped; needs a walkthrough, not a build. **Walkthrough
   ISSUED 2026-07-29** (artifact `9a2ed199`); awaiting the owner pass + a ruling on finding **F4**.
3. **Re-scope Project 2 (in-org coach-to-coach)** against the shipped assistant-coach model — its plan
   predates that work and is stale.
4. **Hold Projects 3 and 4** — cross-org needs real standalone paid coaches to exist first, and its
   directory is blocked on a privacy-law review; coach↔parent is entirely unscoped and carries the
   heaviest privacy load in the program.

**Working rule for this program (owner, 2026-07-29): every step presents a PM brief AND mockups for
approval before any code is written.** No exceptions for "small" steps — the approved mockup is the
binding visual spec.

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
