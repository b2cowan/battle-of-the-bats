# The free tournament tier — session 2 prompt ("draw it": the mockups)

> Paste into a fresh session on `dev`. Written 2026-10-12, after the owner ruled the review the same day. **This session
> draws and asks. It changes no gate, no plan setting, no screen, no copy and no help.** It ends when the owner has
> ruled the mockups; the build prompt is written after that, and **the build waits for the tournament admin redesign's
> close-out** (its final walk §306, 6c's calendar findings, the close-out), because it changes locks on the same screens.

## What was ruled (2026-10-12) — the brief you are drawing

Read `FREE_TOURNAMENT_TIER_REVIEW_PLAN.md` §6 in full (R1–R10, the area table, "details the mockup session settles").
The short form:

- **Free is the invite-only event.** The host adds the teams; each coach gets an invitation email and claims their team.
  Not on free: public registration, the review queue, the waitlist, fees and payment tracking, payment tools, check-in,
  the Staff kit and every volunteer job, and Tournament Chat. Any style; no size cap. One event at a time; 3 staff seats.
- **One lock shape, only where a free organizer reaches for a paid tool** (the padlock line with the plan's name, opening
  the Tournament Plus panel); whole areas an invite-only event never uses are **absent**, not locked. Never a wall
  reached from the nav; never a control that works and then refuses.
- **A Premium coach's event follows free**, keeps PDF exports and PDF settings, and its public pages carry the free
  Powered-by badge and sign-up banner.
- **Founding Season:** offer unchanged; on 2027-10-01 a non-paying organization keeps everything, open registration
  closes, recorded payments go read-only, Plus tools lock; one still on free sees its locks say Tournament Plus is free
  for it through September 30, 2027.
- **Events created before the build keep today's tools until they finish.**
- **The owner overrode two recommendations:** all volunteers leave free (the host and up to two staff enter scores), and
  Chat is hidden rather than shown as one lock line. Draw what was ruled; do not re-argue it.

## Read first

- The plan (§3 what exists, §5 findings, §6 rulings) and the PM brief.
- **The project hub — the ONE artifact:** https://claude.ai/artifact/VEXd9cimTQaSN9jmXfK6hU, source
  `docs/projects/active/FREE_TOURNAMENT_TIER_REVIEW_HUB.html`. Read it with the Artifact tool's `read` before your first
  publish (if the result says a full Read is needed, Read the saved copy through its last line). Its Findings tab holds
  **28 captures of today's free-plan screens**, published as `captures/<screen>-desk.jpg` / `-phone.jpg` — those are your
  BEFORE images. Its inline header comment says how the Plan and Brief tabs are mirrored (`node .probe/ftr-md2html.cjs`).
- `BUSINESS_DECISIONS.md` 2026-10-12 ("The free Tournament plan is the INVITE-ONLY event") and the Facts doc's
  free-plan inclusions bullet — the list the drawings must match.
- `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §2 (the formatting rules every tournament screen follows: a plan lock shows the
  plan's name, an inapplicable part is absent, no dashed box for a lock, the reorder standard, autosave words) and the
  as-built screens of Stages 3–6; `components/admin/tournament/PlanLockLine.tsx` is the lock shape.
- Memory: `feedback_mockups_as_claude_artifacts`, `feedback_project_hub_single_artifact`,
  `feedback_clickable_design_annotations`, `feedback_always_run_design_on_mockups`,
  `feedback_portal_is_the_formatting_benchmark`, `feedback_build_to_approved_mockups`,
  `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`, `project_free_tournament_tier_review`.

## The gate (blocking, in order)

1. **Mockups, published on the hub as a new "Mockups" tab, before anything else.** Same artifact, same file path — never
   a second artifact. Each screen: **BEFORE** (today's capture, already on the hub) and **AFTER**, at **true size**
   (desk 1280 px and phone 390 px frames that do not reflow), built from the product's real warm admin kit (match the
   captures; the hub's own chrome stays visibly separate from the specimen frames). Every NEW / RESTYLED / UNCHANGED tag
   and every finding flag opens its explanation on click.
2. **`/design` reviews the mockups before the hand-off** (not offered — run). Apply what it finds, republish.
3. **A short ask list** for the details only the drawings can settle (below), each with a recommendation, on the hub's
   Mockups tab with a paste-back (checkboxes in `localStorage`, as the Questions tab does).
4. Hand-off: tell the owner to open the hub **on a phone** and on a computer. Record the owner's rulings in the plan,
   the brief and the hub's Decisions tab; then write the build prompt.

## Draw the DECISIONS, not every control — the specimen list

Whole screens before/after first (the cumulative effect is what a specimen can't show), then the specimens.

**Whole screens (desk + phone, before and after):**
1. **Teams** on free — no registration line, no Payment column, no waitlist; Add team as the primary; pools stay; Tools
   and Export with the one lock line. Draw **a coach's Teams** too: Add my team, and Export with PDF open (R1) while
   Excel/CSV take the lock line.
2. **A team's record** on free — what remains once the Payment and Registration sections go (team, coach and email,
   placement, notes, remove).
3. **Event settings** on free — the cards that remain (Overview, Roster requirements, Contact, Coach emails reduced to
   what applies, Schedule rules); Registration questions and Fees & payments are absent, not locked.
4. **The board before the event** (Dashboard) on free — no Payments card, no Coaches/Chat card; what the Registration
   card becomes for invite-only teams.
5. **The navigation** on free — desktop rail, phone bar **and the phone More sheet** (the sheet is easy to miss): no
   Check-in, Staff kit or Chat; Summary's row absent when the event finishes; which tabs the phone bar shows for a draft
   event and for a live one once Check-in and Chat are gone.
6. **Public site (admin)** on free — the Registration switch gone from Pages; one lock line in place of the "Unlock
   Advanced Branding" box and six Locked cards.
7. **The public event page** a fan sees — no "Registration is open" and no Register page; the Powered-by badge and
   banner; **the same page for a Premium coach's event** (the free badge, R6).

**Specimens:**
8. **The one lock line** in each place it appears (a Tools row, an Export row, the finished board's Summary and Reuse, the
   Tournaments list's "More events", the New tournament window's reuse step, Public site's branding line), and its
   **Founding Season variant** (an organization still on free: "free for you through September 30, 2027").
9. **Add team** — the coach's email as the invitation (what the window says when the coach is already on FieldLogicHQ,
   when they aren't, and when no email is given and the team can never be claimed).
10. **Scores from the field on a phone with no scorekeeper job** — the host's path (Results on a phone, or the
    scorekeeper screen opened to staff seats). Recommend one.
11. **The composer** — the free email limit stated before Send; targeting and fan push as lock lines (unchanged shape).
12. **Finished board + Summary** — one lock line each; no Summary nav row.
13. **The 2027-10-01 state** of a Founding Season event still open: registration closed, payments readable not editable,
    Plus tools locked (R2).
14. **An event created before the build** (R8) — what tells the organizer this event keeps today's tools (or nothing
    does; recommend).

Tournament Plus screens do not change: do not draw them, say so once.

## The asks this session should settle (each with a recommendation)

- What Select many keeps on free once its registration actions go (pools and remove? or absent).
- A coach's Teams export: PDF open, Excel/CSV locked (recommended by R1) — confirm in the drawing.
- The host's score-entry path on a phone (specimen 10).
- What an event made before the build shows (specimen 14).
- The Coach emails card's free contents (game-day reminder; the publish email as a lock line; nothing about
  registration or payments).
- The phone bar's tabs on free (whole screen 5).
- Anything the drawings reveal that the rulings didn't foresee — ask, don't decide.

## Working beside the other sessions

- **The tournament redesign** is closing (§306 walk, 6c's calendar findings, the close-out) and may edit its plan and
  hub. Read them; never edit or publish them. Its rulings stand (§2 formatting, one at a time, Event settings' seven
  cards as drawn, the playoff generator, the Divisions step).
- **Club Tier sessions** share the dev server, the test clubs and the browser.
- **One browser tester at a time.** Before any capture or `auth-setup`, ask the owner whether another session is
  measuring. Captures are read-only (`.probe/ftr-capture.mjs` shows the pattern: the free test club's owner, its
  upcoming event, open menus and windows, save nothing). **Never create an event in `uat-test-org`** (the free club has
  one slot). Never reset a test club without asking.
- **Your files:** the hub, the plan and brief (rulings and the mockup record only), this project's TODO line, memory.
  No code, no gates, no copy, no help, no Facts doc, no decisions log (the mockups decide presentation, not packaging;
  if a drawing reveals a packaging question, hand it to `/strategy`).
- **Git:** private index and explicit pathspecs; a shared file is HEAD plus your own hunks, re-read HEAD right before
  committing; after committing run `git reset -q -- <paths>` on the shared index. **Commit only when the owner says.**

## Do not

- Reopen a ruling (R1–R10), including the two the owner made against the recommendation.
- Draw a second artifact, or a mockup outside the hub.
- Draw a lock where the ruling says absent, or an area as absent where it says lock.
- Draw Tournament Plus changes, or prices.
- Treat a capture as a mockup or a mockup as built.
