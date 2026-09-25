# Prompt — The Schedule deep dive · analysis and design phase (phone and desktop)

> Paste everything below the line into a fresh Claude Code session on `dev`. Written 2026-09-25 from
> a portal-wide survey; the owner named this project the same day, at the close of Awards at any
> event: *"I plan on doing a deep dive on the schedules mobile and desktop experience on the next
> project so location of attendance can be addressed then."* **Design only: no product code until the
> owner rules.** One exception, step 0 below: a consolidated QA walk for five schedule changes that
> are built and not yet walked — assembling it is documentation, not code.

---

You are opening a NEW project: **"The Schedule deep dive"** — the analysis and DESIGN phase for the
coach's schedule at BOTH widths: the list, Week and Month, the event sheet on every kind of event, the
add and edit forms, the doors out of an event (attendance, the lineup, the game console, the scouting
book), the Tournaments list and record, and the coach's own calendar. Your deliverable is a
consolidated walk for the owner, measurements, true-size drawings on a new project hub, and a short
list of decisions. You build nothing in this session.

## Read first (in this order, and only these)

1. `docs/projects/active/COACH_MOBILE_EXPERIENCE_PLAN.md` — §2 (the seven standing rules), **§8
   (stage 2 · Schedule: C1–C4, the rulings, "Built as", and the one question it left open — "C1 · the
   desktop": the desktop keeps its toolbar, toggle and April at open, to be re-asked after the walk;
   that question is now yours)**, §9.3 (the road in and back out of the lineup builder), §13 (the two
   drawer layers). Hub https://claude.ai/artifact/WqHGTXUmrns81UN6e2PJvC, tab "2 · Schedule" — match
   its visual identity; you are starting a new hub, not adding a tab to this one.
2. `docs/projects/active/OWNER_QA_LEDGER.md`: **§216** (stage 2, walked 35/35 — the schedule's phone
   baseline), and the five sections that are BUILT and NOT walked, all on this surface:
   - **§212** the Add / Edit Event form held to the portal's form rules (committed `aa1421a0`;
     hub https://claude.ai/artifact/VzYmNKQ2DTqXRFaPiWKgKx);
   - **§214** Arrival & Places — arrival as a lead time, a location as a place the team keeps
     (hub https://claude.ai/artifact/GHsg5ucCcPnr9USu3E5std);
   - **§219** Back goes up ONE level inside every sheet (committed `9076426e`);
   - **§222** the open game is a PLACE — Back from the lineup builder returns to the game;
   - the **Opponent Picker** — the Opponent field reads the Scouting Book (committed `606a6861`, no
     § yet; hub https://claude.ai/artifact/7BJir7hhGj6C39eVrXGXcn).
   Also **§224** (the bench console redrawn, walk owed) — read it to know what the console IS now;
   the console is its own project and is NOT yours (below).
3. The owner's notes carried into this project — the attendance-as-a-door input, recorded 2026-09-25
   in `docs/projects/active/COACH_AWARDS_AT_ANY_EVENT_PLAN.md` (line 39, "Deferred to the schedule
   deep dive") and its hub's Decisions data (https://claude.ai/artifact/SbdfdYBKa2rxd35xXRmXTe).
   Their substance:
   - the owner asked *"can attendance be a button that opens a drawer rather than in this main
     practice page?"* — deferred to you, NOT ruled;
   - **every event, not practices only** — the triggering complaint was a practice/game DIFFERENCE;
     on a game, attendance is one of three tabs (Attendance · Lineup · Scouting): if it leaves, decide
     whether Lineup and Scouting stay tabs or become the same kind of door row;
   - **it revisits C3** (stage 2, ruled 2026-09-21), whose REASON was that attendance is the job
     before an event: C3 moved the first player from 626px to 356px, ten on screen one. A door costs
     one tap on the most frequent field action; it is worth it only if the summary row NAMES who is
     out or has not replied, and the attendance screen opens full-screen with All in, Reset, the
     filters and the per-player RSVP sheet;
   - **three deep links** open an event's attendance today (`?event=…&tab=attendance`: the team
     home's "Take attendance", Insights attendance's "Take attendance", the next-step card) — they
     must open the new screen directly;
   - **the lineup warning** reads "fix the attendance below";
   - stacking: event sheet → attendance → player RSVP sheet is three layers; a full-screen room for
     attendance keeps the RSVP sheet the second visible one.
4. Prior art, so you don't re-derive it: `docs/projects/archive/SCHEDULE_EVENT_UX_PLAN.md` (the
   2026-06-28 evaluation — one generic form and one over-stacked detail panel for six event types;
   P1–P3 built) and `docs/projects/archive/COACH_PORTAL_CHUNK_C_SCHEDULE_INTELLIGENCE_PLAN.md`
   (recurrence preview and import, built 2026-07-31: a recurring series and an imported file are the
   same thing, a set of proposed events reviewed before any exist). Skim for findings; the shapes
   they settled are settled.
5. The surfaces:
   - `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` — **4,211 lines, 60 state variables,
     the largest route in the portal**; the event sheet is `renderEventSheet(ev)` rendered in one of
     three JSX orders (desktop; phone before first pitch; phone after); `lib/coach-schedule-doors.ts`
     decides every tab and door; `RsvpSheet`, `ScheduleImportSheet`, `GiveAwardModal`,
     `OpponentScoutingPanel` beside it; `lib/hooks/useIsPhone.ts` is the ≤640 hook;
   - the Tournaments list `app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx` (322 lines,
     no phone code, one ≤640 rule on the card, **not in the layout sweep**, borrows the tryouts flow
     header's stylesheet) and the record `.../tournaments/[registrationId]/page.tsx` mounting
     `components/coaches/CoachTournamentRecord.tsx` (951; + `CoachLiveSchedule` 471,
     `TournamentRosterSubmit` 383, `TeamHQ` 460) — breakpoints at 600px and 901px (off the portal's
     640 / 768 / 900), **not in the sweep**, **no help "?"**, and shared with the FREE portal through
     flag props (`suppressUpsell` / `moneyRedacted` / `allowAssignmentAccess`) — a change here changes
     both portals;
   - the game console `app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx` — read only far
     enough to know the door into it;
   - help: `lib/help-content/coaches.tsx` sections `recipe-premium-schedule`, `game-day-details`,
     `tournaments`.
6. The sweep and the fixture: `scripts/layout-screens.mjs` entries `coach-schedule`,
   `coach-schedule-attendance`, `coach-schedule-past`, `coach-schedule-week`, `coach-schedule-month`,
   `coach-schedule-rsvp` (11 accepted entries after C4's prune); `scripts/uat-fixture-context.mjs`
   (the UAT team's "UAT probe practice", "UAT probe game" — **re-anchored 30 minutes into the past on
   every run, so the sheet is score-first on it by design; a before-first-pitch read needs the game
   nudged ahead inside the fixture's 30-minute lead** — and "UAT probe game · no lineup");
   `.probe/uat-events.mjs` if it is still there; `tests/uat/scenarios/coach-schedule-smoke.spec.ts`.

## What is known before you measure

- **Event kinds on this calendar:** game · practice · tournament · team event; a **scrimmage is a
  flag on a game**, not a kind; **tryout sessions** are projected read-only; **real tournament
  games** are mirrored read-only (gold accent) and no bulk path may ever touch a mirrored event.
  Measure the list row and the sheet for EVERY kind at both widths — the earlier evaluation's
  finding was one generic sheet for six kinds, and C3 re-ordered the sheet for a game.
- **The coach's own calendar:** the schedule exports the whole season as a one-time `.ics` download
  (the quiet foot row, C1) and as CSV / Excel. The team-level calendar-feed issuer
  (`ensureTeamCalendarToken` in `lib/family-access.ts`) has **no caller** since the family link was
  removed on 2026-09-12; the family feed route still exists. A subscribable feed for the COACH's own
  phone calendar is a schedule question, independent of families.
- **The desktop:** the drawer keeps the pre-C3 order at ≥641; the list opens on April with the kit
  toolbar and the List / Week / Month toggle; C1's "phone first" left the desktop's open position
  as an explicit re-ask. The desktop has not had a schedule-wide look since Chunk C (2026-07-31)
  and the shell review (2026-08-01).
- **Edit vs create:** "Edit autosaves, create asks" was ruled 2026-09-24 and other edit screens were
  NOT yet audited. The schedule's Edit details is an edit screen; the Add Event form is a create.
- **The console is fresh.** §224 redrew game day at phone width on 2026-09-22 (the score demoted,
  scouting promoted, the board editing like the lineup builder). You own the DOOR to the console
  from the sheet, not the console.

## Rulings to build ON, not reopen

- **C1–C4 as built and walked (§216):** on a phone the list is the scroller and opens on today, the
  month header pins, one white frame, the view menu beside "+"; Week without blanks; Month as dots
  with the selected day's rows beneath; the sheet by the clock (tabs before first pitch, the score
  first from first pitch on); every control at 44; "Season attendance" removed at BOTH widths; the
  score door's two places. A deep-dive finding may amend these with a reason; it may not quietly
  undo them.
- **Q 0.2 (the four bottom tabs)** was re-asked after stage 2 and stands: Overview · Schedule · Chat
  · Roster. Not yours.
- **§212, §214, §219, §222 and the Opponent Picker** are ruled and built. A finding on the walk is a
  finding; it is not a reopening.
- **Family RSVP is OUT.** There is no family identity: the guardian tier is switched off pending
  counsel, the follower tier and the team family link were removed on 2026-09-12, and
  `COACH_AVAILABILITY_RSVP_PLAN.md` is stranded behind that. The coach records answers on families'
  behalf through the RSVP sheet — the attendance screen keeps that sheet. Do not draw a family reply.
- **A closed season is ONE page** (CLAUDE.md). The schedule is a live-season surface; no year
  parameter, no season picker, no history layer. The closed season's results shelf is where a past
  schedule is read.
- **Standing rules:** the field floor on attendance-taking (`data-field-floor`, A4); the drawer rule
  (a FORM covers the nav, a MENU sits on top of it); back goes up one level inside every sheet;
  header glyphs borderless on a phone; icon-only mobile actions; the transient Saved pill; every
  delete asks first; a place is a PLACE the team keeps; arrival is a lead time; the Opponent field
  takes the book's spelling; **"8:00 a.m."**; one spelling everywhere a customer reads it; every
  highlight on a drawing is clickable; a row list is a table when a COLUMN answers the question.
- **Out of scope:** the game console's inside (§224), the lineup builder's inside (stage 3 and D12 /
  D13), Money, the practice plan's inside, the closed-season page, and a family-facing schedule.

## What to produce

0. **The consolidated walk, first.** Five built changes on this surface are unwalked, and their
   findings are inputs to the deep dive. Read the five ledger sections; where a project hub already
   carries a QA Walk tab (§212, §214, the Opponent Picker) reuse its steps; where none exists (§219,
   §222) write them from the ledger section. Publish ONE walk artifact — source
   `docs/projects/active/COACH_SCHEDULE_FIVE_CHANGES_WALK.html` — ordered as a coach meets them
   (Add a game → arrival and the place → the opponent → open the game and edit its lineup → Back),
   phone parts then desktop parts, checkboxes persisted to `localStorage`, a progress count, a
   three-way verdict and notes per part, a paste-back summary button, and the **"Sign in as" card**
   (dev URL, the UAT coach account, the password read from `.env.local`, the team). Put the URL in
   each of the five ledger sections (append a line; never renumber; the Opponent Picker has no § yet —
   give it the next number after the ledger's highest, §235 today) and in your reply. **Then stop and hand it to the owner.** Measure and
   draw only after the owner has walked it or has said to skip it — a walk finding on the Add Event
   form changes what the sheet should show.
1. **Measure before drawing.** A Playwright probe in the gitignored `.probe/` folder (never
   `test-results/`; a plain `npm test` wipes it), signed in with `tests/uat/.auth/coach.json`, at
   **390×844 and 360×780** and at **1440×900 and 768×1024** — the desktop is in scope this time.
   Read every number from the browser's own geometry, never from a screenshot. Record: the list at
   open (both widths; where today sits on the desktop); the sheet on EVERY event kind before and
   after its start (nudge the probe game ahead for the before-first-pitch read, inside the fixture's
   lead); the first player's position and the count on screen one with attendance inline (C3's
   baseline) — that is the number a door must beat; the taps from the sheet to a saved attendance
   answer today; the three deep links' landing; the Tournaments list and the record at all four
   sizes, including every control under 44 and every off-grid breakpoint's effect; the Edit details
   form (does it ask or autosave; what it does at 390); the export row and what the `.ics` carries.
   ⚠ The fixture has a handful of events — say where a real season (40+ events, a tournament weekend,
   three kinds in one week) changes the answer, and seed nothing without asking.
2. **Open the project hub.** Copy `docs/agents/design/PROJECT_HUB_TEMPLATE.html` to
   `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_HUB.html`, read its instructional comment block,
   fill the placeholders, load the `artifact-design` skill and publish it with the Artifact tool. One
   URL for the project's whole life; republish the SAME path to stack a version. Tabs: Mockup (the
   numbered walk sub-nav, one section per screen, the phone/desktop toggle wired) · PM Brief · Full
   Plan · Decisions (the DECISIONS array — append a row per ruling) · QA Walk (hidden until a walk
   exists; the step-0 walk is its own artifact and is linked, not merged). The stage strip carries
   anchored positives only.
3. **Draw at true size, BOTH widths** — 390px frames that do not reflow and 1440 frames beside them,
   a **whole-screen before/after** per screen that changes, every finding flag and fix chip clickable
   with its per-instance explanation, every element tagged NEW / RESTYLED / UNCHANGED. Say which
   "before" frames are captures and which are drawn. Screens to draw, at minimum:
   - **the event sheet with attendance as a door** — a practice and a game, before and after first
     pitch, phone and desktop drawer; the summary row naming who is out / has not replied; the
     attendance room full-screen (All in · Reset · the filters · a player's RSVP sheet on top);
     what Lineup and Scouting become on a game;
   - **the desktop list at open** — as today (April) and opening on today, so the C1-desktop
     question is answered on a picture;
   - **one row and one sheet per event kind** where the measurement shows a kind reads wrong;
   - **the Tournaments list and the record** at 390 and 1440 (a tournament is where a block of games
     comes from — draw how a coach gets from a tournament to its games and back);
   - **the coach's calendar** — where a subscribable feed would live if the owner wants one (the foot
     row today), drawn as a row, not a feature.
4. **Decisions**, each with options, a recommendation and its tradeoff, and a paste-back box with one
   checkbox per option. At minimum:
   - **S1 · attendance as a door, on every event.** Inline (C3 as built) vs a door row that names
     who is out / has not replied and opens a full-screen room; on a game, whether Lineup and
     Scouting become door rows too; the three deep links; the lineup warning's wording; the tap cost
     against C3's measured 356px / ten-on-screen-one.
   - **S2 · the desktop schedule.** Open on today or keep April; whether the desktop drawer takes
     the phone's clock order; whether the doors from S1 are the same rows at 1440.
   - **S3 · Tournaments in the schedule family.** The list and the record at phone width; one help
     door; the off-grid breakpoints; the free-portal twin (a change lands on both — say so).
   - **S4 · the coach's own calendar.** A subscribable feed vs the one-time download; where it lives;
     what it carries (every kind? mirrored tournament games? tryout sessions?).
   - **S5 · the edit form.** Edit details autosaves (the 2026-09-24 ruling) or asks; the Cancel and
     Delete doors on the sheet.
   - **S6 · the page itself.** Not a design question, but the plan must budget it: any build on this
     surface is the moment to split the 4,211-line route (the sheet, the forms, the calendar views
     into their own files) — propose the seams and say whether the split goes before or with the
     first stage. Do not propose it as a separate project.
   - Anything the measurement shows that this list misses: say so, don't force-fit.
5. **Write the plan and the PM brief** — `docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_PLAN.md` (the
   findings with measurements, the rulings above as "not reopened", the decisions, a stage ladder —
   this project will want stages; the sheet and the attendance room are one, the desktop is one,
   Tournaments is one, the calendar is one — verification at build, migrations: none expected; say so
   if one appears, and remember a year parameter is a DECISION guarded by
   `tests/unit/coach-history-endpoint-guard.test.ts`) and `COACH_SCHEDULE_DEEP_DIVE_PM_BRIEF.md`
   (plain language: what a coach sees and does differently on the schedule, why, success criteria).
   Render both on the hub's tabs. Add ONE summary line to `TODO.md` under Active Tasks linking the
   plan; the `project_schedule_deep_dive_inputs` memory note is now this project's. No ledger § until
   something is built.

## Working rules for this owner

- **Push back out loud** when a premise is wrong — argue from what the code does, not from what a plan
  says. Don't manufacture disagreement. If the measurement says a door costs more than it saves,
  say so before drawing it; the owner asked a question, not for an answer.
- **Product-owner voice** in every reply: what a coach sees and does differently, and the tradeoffs.
  File paths and code stay out of chat; they belong in the plan.
- **Mockups are Claude Artifacts, on the project's ONE hub.** Before every publish, read the live
  version, merge, then publish from your file — never overwrite a newer version. ⚠ When editing a
  hub by script, anchor on the tab: step ids repeat across tabs.
- **Stage only your own files**, on `dev`, in a private index. Other sessions have uncommitted work in
  the same working copy (the portal stylesheet, the ledger, TODO, the help content, the billing
  files; read `git diff HEAD` before you assume any file is clean) and may have STAGED files in the
  shared index. Don't commit without the owner's say-so.
- **Don't launch a full layout sweep.** The owner tests on the shared dev server. Scope it with
  `--only=` (with the equals sign); an abort on the memory floor is a failure, not a pass.
- **Never touch prod, and never a prod account in an artifact.** Walk cards name the dev UAT coach
  and read the password from `.env.local`.
- **No code** until the owner pastes back the rulings.
