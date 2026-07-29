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
these are NOT the original 7 design decisions; they are new). **Owner ratified the recommendations
2026-07-29; F2–F6 BUILT the same day** (brief + mockups = binding spec, artifact `b7209f2e`).

| # | Finding | Outcome |
|---|---------|---------|
| **F4** | **A staff-role member could moderate a room they could not read or post in** — capability granted create/delete/mute/close, but membership sync only covered owners/admins. | ✅ **BUILT.** Room organizer membership is now **capability-driven + tournament-scoped**, matching what the admin chat routes already enforce. See the access gap below — fixing F4 properly closed two live bugs it was sitting on top of. |
| F2 | Coaches got **no division label** — the organizer's free-text room name was the only signal | ✅ BUILT. Both coach surfaces + the conversation header. Admin header unchanged. |
| F3 | **"All coaches" pinned on the admin side but sorted by recency for coaches** | ✅ BUILT. Rooms cluster by event (clusters by recency, id tie-break); All-coaches pins within its own event. Single-event coaches see only the pinning. |
| F5 | **No duplicate-name check** — two identically-named rooms are indistinguishable to a coach | ✅ BUILT. Warns (never blocks) on create AND rename; case/whitespace-insensitive; compares display names. Admin-side — the walkthrough mis-filed it as coach-facing. |
| F6 | **Membership only re-synced when someone opened a chat surface** — same root cause as the Step 1 "in the chat" staleness | ✅ BUILT. Refreshes at the WRITE (accept/reject/waitlist, division/status change, roster import). Deliberately **not** from a coach read: that would let a coach's page load create a room, contradicting the portal's own "only the organizer can open a chat". |
| F1 | A room's **divisions can never be changed after creation** | Left, per ratification. Known limitation. |
| F7 | A failed rename reports only a generic error | Left; fold into a future chat touch. |

#### ⚠ A live access gap found while building F4 — closed in the same change

The chat decided who counted as an organizer from a hardcoded `role IN ('owner','admin')` list that
**ignored tournament assignments entirely**. Two consequences, both live in production and neither
introduced by this program:

1. **A member restricted to one tournament could read every tournament's coach chat.** The members
   screen showed the restriction; chat disregarded it and seated them in every event's rooms, with
   notifications. `scopeGuard` would have 403'd them at the route layer — membership disagreed with
   the routes.
2. **Demoting, restricting or removing someone did not revoke their chat seat.** Sync only *demoted*
   an ex-organizer who still resolved as a coach and otherwise left the row untouched — so a departed
   admin kept a live, notification-receiving seat indefinitely, and could not even be muted (the
   moderate route refuses to mute a `moderator`).

Entitlement now asks the same question the routes ask (`module_tournaments` + assignment scope), and
a seat whose holder is no longer entitled is demoted to member if they independently resolve as a
coach, else removed. **Coach membership rules are untouched** — a removed coach stays removed,
because that is a moderation decision; organizer standing is a derived permission, so it revokes and
returns with the member's actual role. Verified against dev: on the test org, 2 staff gained the
access they were already exercising, 0 members lost access, coach/official correctly excluded.

**Review caught and fixed before commit:** the refresh was originally fire-and-forget, which this
repo has documented as silently droppable on Amplify (no `waitUntil` bridge) — now awaited at all
three write points, and gated in the roster path so a rename or payment edit doesn't reconcile every
room for nothing. Also fixed: the division label was *replacing* the event name in the coach
portal's flat cross-event switcher (two concurrent events could show two identical "Championship /
U11" rows), a non-deterministic sort tie-break when several events are silent, a duplicated label
rule, and a colour token that never existed.

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

### 1.3 In-Org Coach-to-Coach Chat (Project 2) — NOT STARTED · **NEXT (Step 3): RE-SCOPE, don't build**

Paid coaches inside ONE org talking to each other: an org-wide room plus optional per-team rooms,
League/Club gated, reusing the Project-1 engine.

> **Handoff written 2026-07-29** after Steps 1 and 2, for whoever picks this up in a fresh chat.
> Start here, not at the archived plan. **Step 3's deliverable is a re-scope, not code** — and the
> owner's standing rule applies to every step: **PM brief + mockups of every changed screen and
> state, approved, before any code.** If a step needs no visual change, say so explicitly and get
> that confirmed rather than skipping the gate.

**Why the old plan is stale — verified, not assumed.** `docs/projects/archive/IN_ORG_COACH_CHAT_PLAN.md`
§2 argues this project is *"the natural place to introduce **assistant coaches**, which in-org chat
depends on to be useful."* **That building block shipped independently and is live** — a full
per-assistant capability model exists (invites, capability toggles, nav visibility, money redaction,
and a completed assistant permission sweep). The plan's own stated reason for its shape is gone.
**Expect the scope to shrink; re-derive it from what shipped rather than editing the old plan.**

**Two traps this program has already sprung twice — do not skip:**
1. **Status headers in this repo lie.** §1.2's "half-built on dev" described something that had been
   live in production for three weeks. Establish ground truth from file content and commit ancestry.
2. **Commit counts are not evidence about a feature.** §0's original "8 commits ahead, therefore
   live" was stale by 12 commits within a day. Check the actual files.

**Engine facts that constrain the design** (verified 2026-07-29; re-verify before relying on them):
- Rooms are **tournament-shaped**: a room hangs off a tournament, and membership is resolved from
  *teams in that tournament* (optionally narrowed to divisions). **An org-wide coaches' room has no
  tournament to hang off** — that is the central design problem, not a detail. Decide it before
  anything else.
- **Who counts as an organizer in a room** is now capability-driven and **tournament-scoped** (the
  F4 change above). An org-wide room has no tournament to scope against, so that rule does not
  transfer as-is — it needs an explicit answer.
- Coach membership self-heals on read; **organizer standing revokes** when role/capability/assignment
  changes. A removed coach stays removed (moderation decision) — do not break that invariant.
- Everything rides the existing notification/bell/push infrastructure. **No new notification
  infrastructure has ever been needed for chat — don't add any.**
- Moderation is **per room** (mute, close, reports, pins). An org-wide room inherits that, which may
  or may not be what you want for a standing, season-long channel.

**Decisions this step actually depends on — surface these two, not all seven:**
- **CH-2** — one org-wide room, per-team rooms, or both? *(Standing recommendation: design the
  room-list UX first; lean org-wide only at launch.)*
- **CH-5** — does a replacement coach inherit prior message history? *(Standing recommendation: yes
  for coach↔coach team rooms; the "no" half of that recommendation applies to coach↔parent, which is
  Project 4 and out of scope here.)*
  **A recommendation is not a ruling — get them ratified.**

**Commercial context, binding:** League and Club are **parked** (`/strategy`, 2026-07-28) and
non-purchasable pending a full League capability evaluation. **This project's entire target market
currently cannot buy.** That does not forbid scoping it — but the re-scope must say plainly what it
is for and when, and must not assume a League launch date. Confirm with the owner before assuming
this is worth building now rather than after the League evaluation.

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
   predates that work and is stale. **← NEXT. Handoff for a fresh chat is in §1.3;** start there, not
   at the archived plan. Deliverable is a re-scope, not code. Note that League/Club — this project's
   whole market — is currently parked and non-purchasable.
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
