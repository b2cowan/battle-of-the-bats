# Signed-in family accounts · Stage 4b · In / Out / Maybe and the coach's headcount (DRAWING session first, build prompt after)

> Written 2026-11-12 (on the owner's request, after the Stage 4a walk §498 passed 55/55). Paste into a **fresh chat on `dev`**:
> `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is one published drawing (a Claude
> Artifact), the owner's rulings on it, and then a **build prompt** for Stage 4b. Recommended model: Opus. Run `/ux` and `/design` before the
> hand-off; run `/legal` too (this stage emails parents about their children, and the parent's answer is a record about a child). It touches no
> code, so it can run beside any build.
>
> Plan of record: [COACH_AVAILABILITY_RSVP_PLAN.md](COACH_AVAILABILITY_RSVP_PLAN.md) (rewritten 2026-11-08 to the app channel; §3.3 is the
> undrawn coach side, §9 the open questions) and its [PM brief](COACH_AVAILABILITY_RSVP_PM_BRIEF.md); parent project
> [SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md](SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md) (Stage 4). Inputs: the Stage 4 drawings, **the 4b parent sheet is already
> drawn there** ([SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html](SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html)); the Stage 4 build prompt's Progress block
> ([SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md](SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md)); the consent words
> ([GUARDIAN_CONSENT_STAGE4.md](../../agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md)). Mark each fact **[V]** (you opened it this session, with
> file:line) or **[H]** (handed to you here, unverified). Everything below is [H] unless marked. Branch `dev`; explicit pathspecs; ask before
> committing; never push.

## Where things stand (say it at the top of the hand-off)

- **Stage 4a is built and walked** (§498 passed 55/55, 2026-11-12). A parent can accept an invitation, see every child's team, and has a signed
  calendar address. The guardian tier (`GUARDIAN_TIER_ENABLED`) is **off** everywhere shared and stays off.
- **4b is not built.** The parent's side (the In / Out / Maybe sheet on the family team page) was drawn in the Stage 4 drawings and ruled.
  **The coach's side was never drawn.** That is this session's job.
- **[V] Before drawing, open the code and confirm** what the family team page's schedule rows and the coach's schedule page (attendance tab,
  RSVP editor, lineup builder) look like **today**. The plan's table in §2 was verified 2026-11-08 and may have drifted.

## What is already ruled (do not re-ask)

- **One door: the signed-in family page.** No emailed answer link, no no-login response page, no token. An email may *tell* a parent to open the
  app; it never carries the answer (owner 2026-10-31).
- **No chat.** The note is one line on the answer, nothing a parent types goes to other families.
- **A parent never sees teammates**: no roll-up of other families' answers in any family payload.
- **The coach's attendance record is untouched.** Family answers land in a new, separate record; the coach's book stays authoritative and is
  *pre-filled by one tap*, never silently overwritten. No `maybe` is added to the attendance statuses.
- **The answer belongs to the child**, either connected parent may answer, latest answer wins (plan §3.1; question 5 below reopens only the
  display of a disagreement).
- **No push to families** (delivery unproven): bell and email only. **Live-season-only**: no archived-season availability UI (the coaches portal's
  closed-season rule: a closed season is one page, so this adds no shelf and no year parameter).
- Native app vs installed web app stays **open**; draw screens that hold either way.

## What to draw (the questions to settle)

Coach side first, on a phone first, then the desktop where it differs. Warm coaches-portal look; read the portal's row-list recipe and the RSVP
palette before drawing so nothing is invented.

1. **Schedule list rows:** the headcount chip per upcoming event (`9 in · 2 out · 1 maybe · 3 ?`), what it does when too few are in, and what a
   row shows when the coach has not asked yet, when nobody has a connected parent, and when the team is not on the family layer at all.
2. **The event drawer's attendance tab:** each player row shows the family's answer, note and who/when beside the coach's own status pills;
   one-tap **Accept** per row and **Accept all answers**; what the drift looks like when the coach's pill and the family's answer disagree.
3. **Asking:** the coach's "ask for availability" (per event, and the event-creation toggle), and the per-team switch that keeps all of this dark
   ("Availability requests", default off). Where each lives and what it says when off.
4. **Nudge non-responders:** one bulk button, the 24-hour limit, an honest send report ("3 nudged, 1 unreachable"), who it reaches (only a
   connected account's own address or an address on the child's sign-up; a stopped address never), and what the email says (open the app, no
   answer link).
5. **The lineup builder:** "family said Out" in the Not-playing pool, the Maybe dot, and the "2 marked Out since you built this lineup" warning.
6. **The coach's bell:** when a family answer notifies the coach (Out, or a change inside 48 hours of the event, never a routine In) and how it
   reads.
7. **The parent's side, only where the coach's drawing forces a change:** reread the drawn sheet against the coach's screens (a cancelled event,
   an event already started, a nudge arriving, two parents answering differently). Redraw only the frames that change; say which.
8. **House league:** do house-league teams get the control and a headcount? (The house-league coach's page was left unchanged in 4a.) Recommend
   one answer and draw it, or say why one drawing covers both.

## Disagree out loud (settle these in the drawing, with a recommendation each)

- **Two truths for one fact.** The ruled design keeps the family's answer and the coach's attendance as separate records, joined by an Accept tap.
  Argue from the code whether that costs the coach more taps than it saves (a coach who just wants a headcount), and whether a lighter shape
  (the answer shown, the pill pre-set, no Accept step) is honest to the "never silently overwritten" ruling. Do not reverse the ruling; give the
  owner the trade.
- **Is a headcount worth a coach's attention when most families will not have signed in yet?** Read how many connected parents a typical team will
  have at first (the 4a records) and draw the "3 of 14 families connected" state honestly, since a chip that says `0 in · 0 out` reads as "nobody
  is coming".
- **A nudge is an email about a child.** Say which side of the transactional/marketing line it sits on and what the CASL second-parent flags in
  `docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md` mean for it. List the open flags for the owner; do not decide them.
- **Do not widen by accident.** The coach portal and the club admin are other people's screens; read the shared components (schedule rows, the
  drawer, the lineup pool) before promising any change to them, and list every screen a change would reach.
- **Open owner questions from the plan §9** (house league; practices auto-ask; the "enough players" floor, `fieldPositions.length` vs
  configurable; two parents answering differently): turn each into a numbered ask with a recommendation. Do not fold in unrelated asks.

## Steps

1. **Read** the plan (§2, §3.3, §9), the PM brief, the Stage 4 drawings' 4b sheet frame, the Stage 4 build prompt's Progress block (what 4a
   actually built and any decision made on the way), and the code for the coach's schedule page, attendance PATCH route, lineup builder and the
   family team page's schedule rows.
2. **Settle the facts from the code** (what the schedule rows, drawer and lineup pool look like today; what notification kinds and the family
   email chokepoint offer; how reach is derived for a parent).
3. **Draw** (Claude Artifact, not the design canvas; house layout: sticky numbered tabs, minimal scroll, an *Everything / Show only what differs*
   toggle; whole-screen before/after at true size; controls drawn from their shipped components; NEW / RESTYLED / UNCHANGED tags; every highlight
   clickable). Phone first. Email drawn at the width a phone mail app shows.
4. **Asks** for the owner, each with a recommendation and the alternative, numbered; **put the ones that change the shape of the stage first**.
5. **Run `/ux`, `/design` and `/legal`**, and apply what they find before publishing; say in the hand-off what each changed. A copy or privacy
   gap you cannot fix is an owner question, not softer wording.
6. **Publish** the Artifact once. Do not edit product code.
7. **Hand off in product-owner voice**: what a coach sees and does differently, what a parent sees, the asks, and the order. Record it in the
   plan (one status entry with the Artifact link, §3.3 turned from "not drawn" to "drawn, asks pending"), the TODO line for this project and the
   auto-memory note for it.

## After the owner rules

Write the **Stage 4b build prompt** (`SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md`), in sessions following the plan's P1 / P2 / P3, with: the migration
(if any) and the production-apply order, the guards (a family payload never carries a teammate's answer; reach re-derived on every write; the
control absent with the tier off; no send path that ignores a stop or an opt-out; nudge recipients never returned to a caller without roster
access), the `GUARDIAN_TIER_ENABLED` switch stays off, the per-team switch defaulting off, help articles (`/docs`), a QA walk (its own Owner QA
Ledger section), UAT specs, and `/legal` and `/marketing` before hand-off. Carry forward what is still owed from 4a (privacy page, R1 to R3).

## Do not

- Build or edit product code, or switch the guardian tier on.
- Propose an emailed answer link, a no-login response page, push to families, or chat.
- Write a family answer into the coach's attendance record, or add `maybe` to its statuses.
- Add a year parameter or a closed-season shelf for availability.
- Re-ask a ruled question, or decide native vs installed web app.
- Record the owner's answers as anything but what they said.
