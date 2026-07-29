# Build Prompt — Free Coach Portal: B2.3 (schedule-change alerts)

Paste everything below this line into a fresh chat.

---

Run **B2.3** of the Free Coach Portal Experience — schedule-change alerts. This is the
last real capability in the program and it is **platform-wide, not coach-only**.

## Context to load first, in this order

- `docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` — read the **header (the
  PROCESS GATE is binding)**, then the **B2 RE-BASE + DECISIONS** section and the **B2.1
  BUILD RECORD** directly above it. Everything B2.3 needs to know is there.
- `docs/agents/strategy/BUSINESS_DECISIONS.md` — the **two 2026-07-27 entries** at the top:
  the pressure ladder (binding; alerts inherit its no-ask rule) and the alerts/gating entry
  (◆Q/◆R/◆S). **Do not re-litigate either.**
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` — **canonical** for every price/gate. Note
  the **Decided / not-yet-built** line from **2026-07-06**: *"Fan tournament-message push =
  Tournament Plus… organizer day-of messages + schedule changes."* **B2.3 IS that item** —
  you are building an already-decided thing, not scoping a new one.
- Auto-memory: `project_free_coach_portal_experience`, `project_push_delivery_diagnosis`,
  `project_notification_settings`, `reference_timezone_date_math_gotcha`.
- `docs/projects/active/RAIN_DELAY_DAYOF_OPS_PLAN.md` — Feature A is the sibling half of
  the same decided capability. Read it before designing; do not duplicate it.

## The state of the world (verified 2026-07-27/28 — re-verify, don't trust)

1. **A single-game edit notifies NOBODY.** `app/api/admin/games/route.ts`, `action ===
   'update'`, writes and returns. `notifyFansForGame` is called **only** from
   `lib/tournament-scoring-service.ts` (score/status), never from a schedule edit. So an
   opted-in FAN who deliberately followed the team gets nothing either. This is the gap.
2. **Coaches are already in the follow system.** A3's auto-highlight calls
   `saveFollowedTeam` → `syncFollowToAccount` → `POST /api/consumer/follows`, writing a real
   **account-level `fan_follows` row**. Every signed-in free coach whose event is live
   already follows their own team. **You are extending an existing pipeline, not building a
   recipient model.** Do NOT add a `coaches_basic` shape to `notify()` — that was rejected
   (◆Q1): `notify()` is org-membership-shaped, org-less coaches can't reach it, and it
   would leave families with nothing.
3. **Prod push works.** Confirmed by the owner via "Test this device" on 2026-07-28. It had
   been dead since 2026-07-04. **Re-test before the release**, don't assume.
4. **B2.1 already shipped the in-app half** (uncommitted at time of writing): the coach's
   game-day schedule raises its own "Schedule updated" bar from the live poll. B2.3 is the
   half that reaches a phone that isn't open. Don't rebuild B2.1's copy — reuse its voice.

## Scope

- **Fire on a real schedule change:** time, date, venue, or cancellation of a game. From the
  **single-game edit path** (the gap) — and check whether the bulk rain-delay tool should
  route through the same sender rather than keeping two paths.
- **Recipients:** everyone following that team — the coach (already followed) and families,
  in the **same send**. Gate the push at the already-decided `tournament_plus` tier; reuse
  the existing `fan_score_alerts`-family gate rather than adding a key (confirm with
  `/billing`, run the drift check).
- **◆S1 — same unit of work:** the single-game edit must also call
  `syncGameDayRemindersAfterReschedule`. It exists and is currently only called from
  `bulk-reschedule`, so a hand-moved game leaves the "your first game is tomorrow" email
  stating a time that is no longer true.

## Three design inputs that are NOT decided — resolve these in planning

1. **Batching.** An organizer building a schedule can move 20 games in 10 minutes. Whatever
   this sends must arrive as **one message, not twenty**. The window is undecided and is a
   real design input, not an implementation detail. Consider: debounce per tournament? per
   team? a digest after N minutes of quiet?
2. **Horizon.** Does a change to a game three weeks out alert the same way as one two hours
   out? Same message, very different tolerance for interruption.
3. **Privacy posture.** This would be the first **operational** push to a family-side
   follower (today's fan pushes are scores). It's an existing follow relationship, but it's
   a new kind of message — worth a PIPEDA/CASL look before it ships, same class as the
   parked family-features review.

## Binding rules

- **A schedule-change alert is a SERVICE message. It carries NO Premium ask on any
  channel** — not the push, not the email, not the in-app notice. Where the organizer's
  plan means we can't send, say so plainly and stop; **never aim an upgrade prompt at a
  coach**, who isn't the party who could buy it. (Pressure ladder, 2026-07-27.)
- **`dev` branch only.** This working copy is SHARED with concurrent sessions — at time of
  writing another was mid-flight on DB/schema work and a third on a Premium coach portal
  launch batch. Re-check `git rev-parse --abbrev-ref HEAD` before committing, stage
  **explicit pathspecs only** (`:(literal)` for `[bracketed]` route dirs), and verify
  `git show --stat HEAD` after every commit.
- **Never commit without the owner's explicit per-action OK.**
- Report to the owner in **product-owner voice**: UX outcomes, not file paths.

## Process

1. **Mockups FIRST** for anything visible (the notification itself, any settings surface) —
   the PROCESS GATE applies. Show BOTH themes and the free-organizer state.
2. Present the **plain-language PM/UX summary** before implementing (AGENCY_RULES).
3. Update the **PM brief** + add a build record to the plan doc in the same unit of work.
4. `npm run typecheck` (shared modules + notification types), focused lint, token + date
   guardrails. `verify:changed` may fail on FOREIGN work — attribute before chasing.
5. Run `/review` before calling it done, with a lens on **who receives the message**
   (a wrong recipient here is a privacy incident, not a bug) and on **send volume**.
6. Full dev-server restart before handoff (stop the server BEFORE deleting `.next`).
7. Offer `/docs` (this changes what a coach and a family are told) and `/strategy` only if a
   NEW durable decision gets made — the gating is already logged.

## After B2.3

- **B2.2 — the alerts panel.** Deliberately last: there's little to describe until B2.3
  exists. Honest framing required — coaches are ALREADY followed, so the panel says *"here's
  what you're set up to receive, and here's the off switch"*, not "turn on alerts".
- Then the Free Coach Portal Experience program is **complete**. A1–B1 are already on prod;
  B3 and B2.1 are on `dev` awaiting release.

## Known open items (not B2.3 — don't silently absorb them)

- **`getStandings` reads platform-wide** — takes no tournament id, scans games/teams and
  narrows client-side. B1.6 added a high-frequency caller. Its own unit of work.
- **Admin animation bug** — `schedule-admin.module.css` animates `adminSlideDown`, defined
  in `admin-common.module.css`. A CSS Module can't see another module's keyframes, so it
  silently no-ops. One-line fix, different area.
- **B2.1 placement follow-up** — the change bar renders inside the schedule block rather
  than at page level (the approved sketch showed page level). Lifting it needs a portal or
  context indirection; owner was informed and it is NOT approved work.
- **`docs/projects/active/` holds ~170 files**, mostly finished work never archived. Makes
  "what's in flight?" unanswerable by inspection. Worth a cleanup pass.
