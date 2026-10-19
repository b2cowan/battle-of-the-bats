# Coach schedule — a weekly series' dates, grouped by what they say (PLAN, as built)

> **Status:** CLOSED 2026-10-11 (owner: *"looks good, close this project"*), then reviewed, documented and committed on
> dev 2026-10-11 (owner: *"Review, docs, commit"*; see `git log -- lib/series-date-groups.ts`). Owner QA: §299 in
> `docs/projects/active/OWNER_QA_LEDGER.md`, walks on the decision sheet's QA tab — ✅ marked complete 2026-10-16 on the owner's word.
> **Decision sheet (mockup + QA walks, one URL):** https://claude.ai/artifact/NKSa5J2q25Rm13aEXFwk2G — v1 Asks 1–4,
> v2 Ask 5 (the owner's question). Source `docs/projects/archive/COACH_SERIES_DATE_GROUPS_MOCKUP.html`.
> **PM brief:** `COACH_SERIES_DATE_GROUPS_PM_BRIEF.md`. **Design log:** `memory/design_decisions.md` 2026-10-11
> "A SERIES' DATES ARE GROUPED BY WHAT THEY SAY, AND THE LIST COMES AFTER WHAT IT DEPENDS ON".

## 1. Why

The owner, on a screenshot of Add Practice → Repeat weekly: thirteen 56px rows, nine of them repeating "6:00 p.m." (the
start time typed above) and four repeating "Outside the club's permit" — the sentence under Venue already said "4 of 13
dates are outside…", but it sat below all thirteen rows. Asked whether it could summarise like the permit window's price
rows (one row per price, `priceGroups`, same day). Then: *"does it make sense to have this list above the venue selection
if it is dependent on that selection?"* — it did not.

## 2. Rulings (all five as recommended; `/design` and `/marketing` run before hand-off)

| Ask | Ruling |
|---|---|
| 1 | A series without an opponent reads as one group per note (outside the permit, a date off, each booking holding the place), said once in the Venue line's tone and icon; the plain dates last as "The other dates" (no heading when nothing is marked). Each date a chip — the portal's removable pill, the WHOLE chip the tap, 32px / 44px ≤768; a removed date stays in its group, faded and struck, × → put-back arrow. The repeated start time is gone. |
| 2 | Marked groups first, by their first date; the plain group last. |
| 3 | A marked group of two or more has one door: "Remove these N" while two or more are in, "Put these N back" once all are out, none otherwise (one left in, or a group of one — the chip is the one tap). |
| 4 | A This & future / All edit groups the same way, its dates as words (nothing there can be tapped). |
| 5 | The list moves after Where and Who — the last thing before More and Save. A game series keeps a row per date (each row its own Opponent box); a blank box shows, in grey, the Opponent field's value it will be saved with. |

**Not built (rejected on the sheet):** a literal copy of the price rows ("Oct 28 – Nov 18 · 4 practices") — it hides
the dates the list exists to show and puts a step in front of removing one; moving Venue above the dates.

## 3. As built

- `lib/series-date-groups.ts` (new, pure): `seriesDateGroups(dates, noteOf)`, `groupDoor(size, kept)`,
  `SERIES_LIST_WORDS` (signed off by /marketing 2026-10-11).
- `components/coaches/ScheduleEventForm.tsx`:
  - **The check asks about EVERY date of Add's series** (`checkDates`), a removed one too, so it keeps its mark and its
    group, and removing a date no longer re-asks. **The Venue lines and Save's own check count only the kept dates**
    (`keptOnly`, and the hook's count function) — exactly the numbers they gave before. An edit's dates are unchanged.
  - The list renders game rows (`gameRows`, unchanged rows + the grey fallback placeholder) or groups (chips on Add,
    words on an edit). `{dateList}` is drawn once, in its own section after Who.
- `app/[orgSlug]/coaches/coaches.module.css`: `.occList` loses its top margin (own section); new `.occGroup*`,
  `.occChips`, `.occChip*` with the ≤768 44px floor. `.occRow` and friends stay for the game rows.
- Tests: `tests/unit/series-date-groups.test.ts` (new — grouping, order, the door, one verb, the form's placement and
  check wiring, the pill and its floor); `tests/unit/coach-series-scope.test.ts` re-pinned to the new placement and
  check. The Stage 6a/10a guard (`club-stage6a-guard`) passes unchanged.

## 4. Verification run

Focused unit run 81/81 (the two files above + `club-stage6a-guard`, `coach-opponent-picker`); `tsc --noEmit` clean;
eslint clean on the four files; spelling, CSS module purity, both contrast checks and date-correctness clean.
`check-css-selectors` reports one dead class in the tournament schedule (`generatorModal`) — another session's work, not
this change. Not run: the layout sweep (`check:layout`) and a browser pass — the owner walks §299.

## 5. Side finding (report only, not built)

The permit sentence under Venue names a permit's days and hours and its last day, never when a PART of it starts or
ends (a block's own dates). A booking can read "outside" beside "It covers Wed, 6:00–9:00 p.m." with no way to tell why.
The owner's screenshot was NOT this case — the §296 fixture's permit covers Tue and Thu, so Wednesdays are simply
outside. If wanted: add the part's dates to the sentence (`coversSentence` in `lib/permit-words.ts`).

## 6. `/review` (2026-10-11, high-risk tier, four lenses) and `/docs`

- **Fixed — Low:** the remove taps (a chip, a group's door, a game row's ✕) are held while the form saves. The save
  sends the dates as they stood at the press, so a tap during Save's own check could show one list and save another
  (and, removing a clashing date mid-check, pass the check on a count the payload didn't match). Guarded in
  `series-date-groups.test.ts`.
- **Refuted, then guarded:** "a series over 60 dates misaligns the permit line" — a series is capped at 60
  (`MAX_RECURRENCE_OCCURRENCES`), the same number the clash route answers (`MAX_OCCURRENCES`), so every asked date is
  answered. The two caps live apart; a test now fails if the series cap ever exceeds the route's.
- **Advisory, accepted:** putting a date back no longer re-asks the check (removing never did after this change), so
  a booking made on that date since the last answer shows only when Save asks again — which it does, and the form
  stops once on it, as for any new booking.
- **Advisory, as ruled:** a marked group whose dates are all removed keeps its heading while the Venue lines (kept
  dates only) say nothing about it — Put these N back is right there.
- **Data lens, no findings:** the grey placeholder is true — the events route saves a blank date with the Opponent
  field's value (`occ.opponent ?? body.opponent`); removed dates are never sent; a series edit's path is unchanged.
- **Docs:** the help's repeating-schedule article (grouped dates, removing and putting back, Remove these 4, the list
  after Venue, a blank game box taking the Opponent above), its opponent FAQ (answer and search text), and the
  club-diamond-clash answer's two series lines. New search terms: remove these, put these back, the other dates,
  outside the permit, blank opponent.
- **The commit:** the form file was this change's alone by then (the other session's `kinds` edit had committed). The
  design log, the memory index, the QA ledger and TODO held other sessions' lines; only this change's were committed.
