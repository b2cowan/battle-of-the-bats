# Prompt — The Schedule deep dive · stage 1 BUILD (the event sheet, attendance in its own room) + the calendar fix

> Paste everything below the line into a fresh Claude Code session on `dev`. Written 2026-09-25 by the
> drawing session, after the owner ruled stage 1 **as drawn** the same day. The rulings are made — do not
> re-ask them. Build in **three parts, in order**, each verified before the next.

---

You are building **stage 1 of "The Schedule deep dive"**. The hub is the spec:
**https://claude.ai/artifact/5yvmCESNKNWnpFiHg8b7Lc**. The "1 · The event sheet" tab has the drawings, so build to
them. The walk tab has the measurements. The plan is
`docs/projects/active/COACH_SCHEDULE_DEEP_DIVE_PLAN.md` (§4 is stage 1, §6 the defects), with the brief beside it.

## The rulings (owner paste-back, 2026-09-25 — verbatim)

```
E1: As drawn
E2: As drawn (full-screen room)
E3: As drawn (rows; the peek retires)
E4: As drawn
E5: As drawn
E6: As drawn
S6: Split first, a pure move
D1: Fix now
```

**NOT ruled, do not build:** Q 1.1 (the desktop list opening on today), Q 2.1 (Month at a desk), Q 6.1 / Q 6.2
(Edit details and the form's leftovers), Q 7.1 (Tournaments) and Q 8.2 (a calendar subscription). Those are
stages 2–5, and they are re-asked when those stages are drawn. **Edit details keeps working exactly as today.**

## Read first (in this order, and only these)

1. The plan: §0 (method, fixture), §4 (stage 1: E1–E6, the tap cost, every kind under the one shape, the split,
   verification, not reopened) and §6 (the defects).
2. The hub's "1 · The event sheet" tab. Every after-frame is drawn in the portal's materials with the fixture's
   real names. Match the order, the words and the row anatomy. A drawing that the code shows is wrong is a
   finding to raise out loud, not something to quietly re-draw.
3. `CLAUDE.md`, `AGENTS.md` and `AGENCY_RULES.md` (the dev-server rules, the branch and staging rules,
   "8:00 a.m.", one spelling). The memory notes behind the standing rules: the drawer layers (a form covers
   the nav, a menu sits on top), back goes up ONE level (§219), the open game is a PLACE (§222), the transient
   Saved pill, "a table when a column answers the question", every delete asks first.
4. The code, by name. The line numbers below were correct on 2026-09-25 and drift, so grep for the name:
   - `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (4,211 lines).
     - The event sheet: `renderEventSheet(ev)`, with its blocks named once (`header`, `whereBlock`,
       `scoreBlock` ~2849, `awardsBlock` ~2944, `practiceBlock` ~3046, `actionsBlock`, `peekWarnBlock` ~3167,
       `tabsBlock` ~3182, `attendanceTab` ~3209, `lineupTab` ~3339, `scoutingTab`, `tabContent` ~3427) and the
       three JSX orders in `body` (~3430: the desk; the phone score-first; the phone tabs-first).
     - The clock: `scoreLeads` / `sheetOrder({ started, hasScore })` (~2723) and `gameHasStarted`.
     - The sheet's addressability: `sheetAddress` + `useDialogFloor(... { address })` (~830) and the deep-link
       reader (`sp.get('tab')`, ~1113).
     - The RSVP sheet: `CoachRsvpSheet` (~3645) with `rsvpEditId`.
     - The export: `handleExportICS` (~2140).
   - `lib/coach-schedule-doors.ts`: `scheduleDrawerDoors`, the one answer for which doors show. Every door
     still mirrors its route's gate.
   - `components/coaches/useBackStep.ts`, `useDialogFloor.ts`, `CoachRowList` / `CoachRow` (the portal's one
     row recipe), `CoachRsvpSheet`, `OpponentScoutingPanel`, `SaveStatusPill`, and `lineupBuilderHref` in
     `lib/lineups-address.ts`.
   - `lib/export/ics.ts`: `downloadICS` (local date + time) and `composeICSFromInstants` (from an instant;
     the family feed uses it).
   - The house-league admin schedule's export (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx`,
     ~1149). It has the same defect; see part 0.

## Part 0 · The calendar defects (D1 — ruled "fix now"). One small unit, its own commit.

**Verified by running it (2026-09-25, `TZ=America/Toronto`).** The coach schedule's `.ics` takes the date from
`startsAt.slice(0, 10)` (the UTC date) and the clock from `new Date(startsAt).toTimeString()` (the device's
clock). Then `downloadICS` hands `[y, m, d, h, min]` to the `ics` package as device-local. So any event whose
UTC date differs from the local one lands a day late: 2026-09-22T02:45Z (Mon 21 Sep, 10:45 p.m.) exports as
Tue 22 Sep, 10:45 p.m. That is every event at 8 p.m. or later in summer, 7 p.m. in winter; 8 of 238 dev events.
A cancelled event also exports as CONFIRMED, because `cancelled` is never passed.

**Widened on the evidence:** the house-league admin schedule export does the same thing
(`scheduledAt.slice(0, 10)` + `isoToTimeInput`, which is the ORG's zone): a UTC date paired with a zoned clock.
The tournament record's export (`CoachTournamentRecord`) and the free team calendar (`lib/team-calendar.ts`)
read local `game_date` / `game_time` fields and are correct. Leave them alone, but say in the hand-off that you
checked them.

**Fix:** build the entries from the **instant**, the way `composeICSFromInstants` already does (UTC in, UTC out,
so the device's zone never matters), and pass the cancellation (`cancelled: e.status === 'cancelled'`) so the
entry carries `STATUS:CANCELLED`. Keep what each entry carries today: the title, "Arrive by …" and the uniform
in the description, the place and diamond (`surfaceLabel`) and the address in the location, and the real end
time where one exists. Add a small browser-side download wrapper beside `downloadICS` rather than
hand-rolling a second blob path.

**Pin it:** unit tests covering (a) an evening event in `America/Toronto` exports on its org-local day (assert
on the DTSTART instant), (b) a cancelled event carries `STATUS:CANCELLED`, and (c) the house-league export gets
the same treatment. Run the test file under two `TZ` values (Toronto, Vancouver) and confirm the output is
identical. This is a live-customer defect, so keep it separate from the redesign and commit it first (on the
owner's say-so).

## Part 1 · The split (S6 — "split first, a pure move"). Nothing a coach can see changes.

Move code out of the 4,211-line page, with no behaviour change:
- `ScheduleEventSheet` (the sheet, its blocks and its current orders) and its CSS usage;
- `ScheduleEventForm` (the QuestionShell add/edit form);
- the calendar views (list / week / month).

The page keeps the data (events, the book, capabilities, the fetches) and passes it down.

**Proof that nothing changed:**
- **Re-run the walk's probe before and after and diff the JSON.** The probe is `.probe/sdd-walk.mjs` (read-only;
  `--only=phone,desk,tab,p360`). Keep the pre-split JSON as the baseline. Every number must match.
- `npx next typegen` then `npm run typecheck`, and the full unit suite.
- ⚠ **Many source-scan guards read `schedule/page.tsx` by path:** `coach-schedule-phone-guard`,
  `coach-schedule-doors`, `coach-lineup-phone-guard`, `coach-opponent-picker`, `coach-awards-any-event`,
  `coach-award-edit`, `coach-call-ups-guard`, `coach-page-actions-guard`, `coach-read-gates-guard`,
  `coach-save-pill-guard`, `export-masthead-guard`, `practice-vocabulary-guard` and `back-step-verdict`. Re-point
  each one at the file its code moved to. **Never weaken an assertion to make it pass.** If a guard's meaning
  no longer fits the new structure, say so in the hand-off.
- `npm run check:layout -- --only=coach-schedule,coach-schedule-attendance,coach-schedule-past,coach-schedule-week,coach-schedule-month,coach-schedule-rsvp`
  (with the equals sign; **never a full sweep**, because the owner tests on the shared dev server). It must end
  "✓ No new layout findings".
- New files mean a **dev-server restart** before the owner looks (AGENTS.md: stop it, then restart with
  `npm run dev`).

## Part 2 · Stage 1 (E1–E6 as drawn)

**One shape at every width.** The sheet's three JSX orders become **two, by the clock, at both widths**:
- **Before first pitch** (and every non-game): the summary (header · title · when · place row · the kind's own
  block) · **door rows** · the quiet "+ Add final score" (a game, as C3 ruled) · the foot row.
- **From first pitch or once scored:** the summary · the score · awards (the 2026-09-25 awards placement
  stands) · **door rows** · the foot row.

Update `data-sheet-order`, which the sweep and tests read, deliberately.

- **E1 · door rows.** Use the portal's row recipe (`CoachRow as="button"` or its sibling). Each row is 64px:
  icon · label · a **second line that says where the job stands** · chevron, and the whole row is the tap.
  - Rows per kind (plan §4.8): a game or tournament game gets Attendance · Lineup · Scouting; an organizer's
    game gets the same three (no Cancel/Delete, as today); a tournament gets its games + Attendance; a
    practice gets the **plan row** (it replaces the "PRACTICE PLAN" kicker + summary + "Open the plan →" with the
    same destination and summary) + Attendance; a team event gets Attendance; a tryout session gets none
    (read-only, as today).
  - Door visibility still comes from `scheduleDrawerDoors`. A door a person can't use doesn't render.
- **E2 · the attendance room.** Build it as **a view inside the event overlay**, not a second overlay:
  - On a phone the sheet already covers the whole screen, bottom bar included; confirm that. On the desk the
    dialog's body swaps to the room, with "← {event name}" at its head.
  - Contents, all moved from today's tab rather than redrawn: the five filter chips (44px), All in, Reset, the
    player rows (the row is the tap → `CoachRsvpSheet` on top, **unchanged**), the transient Saved pill, and
    `data-field-floor`.
  - The room is **one Back level** (`useBackStep`): Back goes room → event → wherever the coach came from.
  - Escape closes the RSVP sheet first, then the room, then the sheet.
  - Drawn target: **12 of 12 players on screen one at 390×844 and at 360×780**. Measure it.
- **The Attendance row's words** (the hub's frames are the spec):
  - the head carries the counts ("Attendance · 10 in · 1 late · 1 out");
  - the second line names **out first, then late, then no reply**, e.g. "Out: #12 Logan · Late: #11 Kai",
    with the tones as drawn;
  - before anyone answers: "12 haven't replied — Avery, Blake, Casey and 9 more";
  - once everyone is in: "All 12 in".
  - Decide and **pin** a length rule (how many names before "and N more") so it never wraps past two lines at
    360.
- **E3 · Lineup and Scouting rows; the tabs and the peek go.**
  - **Lineup** reads "Has a lineup", "No lineup yet" or "Needs a look" (E4). Its door turns **by the clock at
    both widths**: before first pitch it goes to the builder (`lineupBuilderHref` with the return address), and
    from first pitch to **Game day**. This fixes the desk's "Edit in Lineups →" on a started game.
  - **Delete the look-only peek** (the inning flip, `peekInning`, its styles). `check:css-selectors` will name
    any dead rules; remove them.
  - **Scouting** reads "2-1 vs them · 3 notes" or "No games against them yet" (from the book: `bookRecordFor` +
    the observation count) and opens `OpponentScoutingPanel` as a view like the room.
  - A game with a TBD opponent has no Scouting row (today's rule).
- **E4 · the lineup warning joins the Lineup row.** `lineupMismatch` becomes the Lineup row's second line in the
  warning tone. The fixture's own case (vs Ridgeview, 4 May) should read "Kai and Logan are in, but not in the
  lineup"; the other direction reads "{names} are Out but in the lineup".
  - **Delete `peekWarnBlock`**, its 97×15px link, and every "Fix the attendance below". Grep the help content
    too.
- **E5 · the addresses.**
  - `?event=…&tab=attendance` opens the event **with the room open**. That covers the Overview's four links
    ("10 of 12 in", "1 late", "1 out", the tile), Insights' "Take attendance" and the next-step card. Keep their
    hrefs and verify each one lands in the room.
  - `tab=lineup` (the builder's return address, §222) opens the event, with the Lineup row on screen one.
  - `tab=scouting` opens the Scouting view.
  - The room and the scouting view write their own address through §222's machinery, and Back pops it.
    **Re-drive §222's three paths and §219's in a real browser**, as those sections did.
- **E6 · the desk.** The same summary and rows in the 720px dialog, with the action row under the rows. The
  pre-game "Enter a final score to unlock awards" goes: `awardsBlock` follows the clock at every width, not
  `!isPhone`.

**Verification (plan §4.10):**
- **Before → after with the probe at 390, 360, 768 and 1440** on every fixture event. Targets:
  - a game ahead **fits one phone screen**;
  - the room shows **12 of 12** at 390×844 and 360×780;
  - **0 controls under 44** on touch;
  - the rows sit on screen one on the scored game;
  - the tap counts match plan §4.7.
- `check:layout --only=` the six schedule screens. The attendance and RSVP screens' baseline keys will change
  with the room. Read the siblings' reasons before calling anything new; a new fixture LABEL mints a new key
  (§222's lesson).
- Unit tests pinning:
  - the address grammar (`tab=attendance` → the room);
  - the names-line (order, the cap, "All 12 in", no-reply);
  - the Lineup door's clock at both widths;
  - the warning-in-the-row;
  - no tablist left on the sheet.
- `demo-destinations-guard` must stay green.
- `verify:changed`, focused lint, and `typecheck` (shared modules change).

## Afterwards (offer, don't skip)

- **`/simplify`, then `/review`**: a new abstraction (the door row, the room view) on the largest surface in the
  portal.
- **`/docs`**: the help articles `recipe-premium-schedule` and `game-day-details` describe the Attendance /
  Lineup / Scouting **tabs**. Grep for "Attendance tab", "Lineup tab", "Scouting tab" and "tab" near attendance.
- **The QA walk** is a new tab on the SAME hub:
  - edit `.probe/sdd-hub.src.html`, then run `node .probe/sdd-hub-build.mjs https://claude.ai/artifact/5yvmCESNKNWnpFiHg8b7Lc`,
    and republish the repo hub path;
  - read the live version first and merge.
  - What the walk carries: checkboxes persisted in `localStorage`, a verdict per part, notes, a paste-back
    button, the "Sign in as" card (the dev UAT coach, password from `.env.local`), and one checkbox per option
    for any call.
  - **Pin identities, never figures that move.**
  - Write it against the stage the fixture is in. The probe game re-anchors 30 minutes into the past on every
    probe run, and "UAT probe game · no lineup" is fixed on Sun 27 Sep.
- **Add a ledger §** (the next number after the ledger's highest at that moment; never renumber) and update the
  hub's stage strip with anchored facts only ("Built on dev <date>", "Committed <hash> <date>").

## Working rules

- **`dev` only. Stage your own files, in a private index.** Other sessions have uncommitted work in the same tree
  (the portal stylesheet, TODO, the ledger, help content). Read `git diff HEAD` before assuming a file is clean,
  and check `git show --stat HEAD` after every commit. **Commit only on the owner's say-so**, as three commits:
  part 0, part 1, part 2.
- **Before any code, present the PM UX summary in chat** (AGENCY_RULES). It's a restatement of what was ruled, not
  a re-ask.
- **Push back out loud** if the code contradicts a drawing. Argue from what the code does.
- No migration and no new route are expected; if one appears, stop and say so. No year parameter anywhere
  (`coach-history-endpoint-guard`).
- **Out of scope:** stages 2–5 (above), the console's inside, the builder's inside, the practice plan's inside,
  Money, the closed-season page, and family RSVP.
- Replies are in product-owner voice; file paths belong in the plan and the commits.
