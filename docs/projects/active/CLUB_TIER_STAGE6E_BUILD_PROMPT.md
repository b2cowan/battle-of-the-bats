# Club Tier Stage 6e — the coach event form's last corrections (build prompt)

> **Written 2026-11-06.** Paste this into a new chat on `dev`. Size **S**, no migration expected, one session.
> Plan of record: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 "Stage 6e" (holds the release since 2026-10-12).
> Origin: the Schedule deep dive's stage 5 (`COACH_SCHEDULE_DEEP_DIVE_PLAN.md` §5, defect D-6), merged into the Club plan 2026-10-09.

## Why this exists

The deep dive walked the coach's Schedule in September and left four small form corrections. On 2026-10-09 the event window and
the form changed under them (the window reads first and its pencil opens the form with a held save; a change that tells families
is held until ✓; a series edit asks its scope at the pencil), so **some of the four are probably already fixed.** This stage
re-reads each against the product, fixes only what is still true, and closes. It is a gap-filler, not a redesign.

## Read first, in this order

1. Plan §6 "Stage 6e" (this prompt restates it) and the deep dive plan §5 "Stage 5" + §6 defect D-6.
2. `AGENCY_RULES.md`, `CLAUDE.md` (the coaches-portal sections: a live-season surface takes **no year parameter**; do not touch
   `HISTORY_ENDPOINTS`).
3. `docs/agents/design/` — the coach row/forms conventions, and `memory/design_decisions.md` for any ruling on these forms.
4. The code (leads only — a helper's or this prompt's reading is a lead, open the lines yourself):
   `components/coaches/ScheduleEventForm.tsx`, `ArrivalSelect.tsx`, `ScheduleEventSheet.tsx`, `PracticeSheetChrome.tsx`,
   `OpponentCombobox.tsx`, `lib/coach-arrival.ts`, `tests/unit/coach-arrival-and-places.test.ts`.

Reading and searching go to helpers (Sonnet). Do the edits yourself.

## Part 0 — re-read the four items against today's code (no edits yet)

For each, write down **fixed / still open / changed meaning**, with the line you opened:

- **F13a · the practice's "More" label promising an address.** Today the label is built at `ScheduleEventForm.tsx` ~1222: it names
  the field noun only for a type that has a field; a practice reads "More — links, notes" unless it carries a field/place. Confirm
  what a practice, a game, a tournament game and a team event each show, and that the label never names something the opened
  section does not hold.
- **F13b · the series' per-date opponent boxes use the Opponent Picker.** The single-event form uses `OpponentCombobox`; the
  series' per-date boxes (`occurrenceOpponents`) may still be plain text. Check each date's box, including a game series with a
  per-date edit.
- **D-6 / F12 · an arrival after the start is flagged.** The sheet (`ScheduleEventSheet`) and the practice header
  (`PracticeSheetChrome`) already add `ARRIVAL_AFTER_START_NOTE` through `arrivalIsAfterStartAt`. The plan also asked for the flag
  **under the field** in the form (`ArrivalSelect.tsx` line ~90 shows only "Arrive by … shows on the event and the calendar export").
  Confirm whether the under-the-field half exists.
- **R6 · "Edit details keeps its Save."** Likely settled by the 2026-10-09 held-save work; confirm and say so.

**Stop and report to the owner after Part 0** with the four verdicts. If all four are fixed, the stage closes with a note and no
code. If something is open, the owner gets the plain-language UX summary (AGENCY_RULES: required before any code) and says go.

## Part 1 — fix what is open (only what Part 0 found)

- Build to the existing patterns; no new component unless the series box genuinely needs a variant of the picker.
- The flag under the arrival field uses the same words and the same predicate as the sheet — one source (`lib/coach-arrival.ts`),
  never a second copy of the sentence.
- **Customer-visible words:** one spelling everywhere; the clock is "8:00 a.m." built only with `formatTime()`; run
  `npm run check:spelling`. Any new sentence goes past `/marketing` if it is more than a restatement of an existing one.
- Both devices: every change is checked at 390 and 1440. Phone tap floor 44 px.
- Tests: red first for each fix (the arrival predicate already has a test file to extend).

## Part 2 — checks, review, close

- `npm run verify:changed`; `npm run typecheck` only if a shared module changed. No whole-product layout sweep on the dev server;
  `check:layout --changed` on the screens touched.
- Offer `/review`, and `/docs` if help text for the form changes (`lib/help-content/*`). Browser verification is the owner's:
  write him a **short checkable walk** (one purpose: the event form) as a Claude Artifact and add a § to `OWNER_QA_LEDGER.md`
  (check the ledger's last § right before writing).
- Update: plan §6 Stage 6e (positive facts with commit hashes, never "uncommitted"), the TODO line, this file's Progress block.
- Commit with explicit pathspecs only; confirm with `git show --stat HEAD` that only your files landed. Branch `dev`.

## Push-backs to raise at Part 0

1. If three of the four are already fixed, say so and close rather than inventing work to fill the stage.
2. If the series' per-date boxes need a different control than the picker (a series of ten dates, ten pickers), that is a design
   choice — ask the owner; do not decide it in code.

## ▶ Progress (update after each Part)

- **Part 0 done 2026-11-06 — all four items already fixed; stage closed on records, no code.** The stage was built and committed
  `7597695a5` on 2026-11-04 (two days before this prompt was written; the plan, TODO and ledger had lost their records of it).
  - F13a · fixed (settled before the build): `ScheduleEventForm.tsx` ~1220–1223 names a field noun only for a mirrored game; a
    practice or team event reads "More — links, notes"; a game "uniform, tags, links, notes"; the opened section holds each.
  - F13b · fixed `7597695a5`: per-date boxes of a weekly game use `OpponentCombobox` (~808–818).
  - D-6 / F12 · fixed `7597695a5`, both halves: under the field (`ArrivalSelect.tsx` ~93–98) and beside "Arrive …" on the sheet
    and the practice header. 18/18 tests in `coach-arrival-and-places.test.ts` pass (re-run 2026-11-06).
  - R6 · settled by the 2026-10-09 held-save work; confirmed by the 11-04 build.
  - Owner said "go ahead with your recommendations" 2026-11-06: records restored (plan §6 Stage 6e, TODO line, ledger **§470**
    — the walk was §452 on 11-04 but that number is now Stage 14 S1's; the walk page was re-labelled §470). The walk's 22 steps are
    still owed; no record shows it walked.
  - **Records closed (`c5c06896a`), then the wording call built 2026-11-06 — committed `6410ee31c`.** Owner said yes to one shared
    sentence; `/marketing` proposed Option A and the owner agreed: the phrase "(after the start)", no clock inside it, the same on
    the form's "Arrive by …" line (the separate "That's after the … start." sentence is gone, which also ends the screen-reader
    Low), the event window, the game page and the practice header. One helper (`arrivalNoteSuffix` in `lib/coach-arrival.ts`)
    words it for all four. Red test first (19/19 now), lint 0 errors, `check:spelling` and full `typecheck` clean; the walk page
    was rewritten and re-published. `check:layout` not run (the 11-04 UAT fixture gap stands; the change is a few words on an
    existing line). `/docs` not needed: no help article mentions the note.
  - **Left open, not built:** the practice "send to families" message does not carry the note (left alone). `/review` is
    offered, not run. Browser check is the owner's: walk §470.
