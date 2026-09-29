# Tournament admin redesign · Stage 1 build — game day (the board, Results, Check-in), built to hub v5

> Paste into a fresh session on `dev` **after the defects pass (`TOURNAMENT_ADMIN_REDESIGN_DEFECTS_PROMPT.md`)
> is committed**: both touch the dashboard. Written 2026-09-29, the day the owner ruled Stage 1 and every ask
> "I agree with your recommendations".
>
> **The spec is the hub:** https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM → **Stage 1** tab (v5 or later).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW / RESTYLED /
>   UNCHANGED tag note on the tab is a requirement; open each one.
> - The tab's last section, **"The formatting check"**, is your checklist, all 16 rows.
> - Where you must depart, say so at build time and record why; never silently.
> - The two in-frame boxes marked **Reserved** (the Big Board, and "Teams itself is redrawn in Stage 2") are
>   hub annotations. **Build nothing for them.**
>
> **Read first:** plan `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §2 (the rulings kept, and A12's amendment), §6
> (G1–G8 as drawn), §7 (A11, A12), §8 (the amended build order), §9 (verification), §11 (the formatting
> check). Memory: `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_build_to_approved_mockups`, `project_admin_design_continuity`, `feedback_mobile_icon_only_actions`,
> `feedback_form_selects_are_dropdowns`, `decision_drawer_layers_form_vs_menu`,
> `feedback_shared_component_over_shared_class`, `reference_code_gotchas_index`. The in-repo
> `memory/design_decisions.md` entries of 2026-09-29 (row actions olive; Check-in's filter).

## Preconditions (check before code)

0. **⚠ Largely answered since this was written (noted 2026-09-29 by the defects pass):** Part B STARTED
   (area 1 `f6d36059` — the one-revert rollback is over) and was RE-SCOPED the same day
   (`ADMIN_DESIGN_CONTINUITY_PLAN.md` §3a "PART B RE-SCOPED", owner "sure"): Part B no longer covers the screens a
   redesign rebuilds, and "retire the old look as you rebuild" is part of every stage's definition of done —
   Stage 1 deletes the `useAdminKit()` false branches, `kx()` legacy halves, `legacy` props and kit layers of the
   files it rebuilds. Read that section, confirm with the owner in one line, and skip step 1's "if not yet".
1. **Ask the owner: is the new admin look staying?** It was released 2026-09-28 (flip `74f45113`), and its
   rollback ("revert the flip") is valid until Part B starts.
   - **If yes:** build on the released kit, as Club Tier Stage 2 did. Add one line to
     `ADMIN_DESIGN_CONTINUITY_PLAN.md`'s Part B section saying **Part B skips the screens this build
     replaces**: the dashboard's game-day board, Results, and Check-in, both the organizer's and the gate's.
     The redesign removes their old look as it rebuilds them.
   - **If not yet:** stop. The build waits for Part B's pass over those screens (plan §8 as first written).
2. **The dev server works.** It was down on 2026-09-29 from another session's in-progress code. **Don't fix
   another session's code**; tell the owner. Start it only with `npm run dev`, with network access.
3. **`/marketing` confirms the words before you build them.** The placement is ruled; the words are
   `/marketing`'s. Take this list in one `/marketing` run:
   - G5's five state words: *Needs a score · Pending Review · Final · Forfeit · Tie*.
   - The board's top note: *"The event's dates have passed. Once every score is in, you can mark it
     complete."*
   - The door card: *"Rain delay"* and *"Running late?"*, with its line.
   - The Tournament plan's lock line.
   - The tie line in the editor.
   - Check-in's *"13 of 18 teams still owe"*.
   - The "N Pending Review" words that replace Results' bare waiting dot.
4. **Ask the owner whether another session is measuring** before any probe or auth-setup run. Run one browser
   tester at a time, and scope sweeps with `--only=`.
5. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short, because the drawings are ruled:
   what the organizer and the gate volunteer each see differently, and any departure.

## What to build (all ruled 2026-09-29)

**G1 · One event, named once, with one status.**
- Code: `components/admin/AdminEventHeader.tsx` and `components/admin/kit/AdminKitEventHeader.module.css`.
- **One chip from one rule, the board's:** the event's dates, or its first game having started, until it
  is marked complete. Take that rule from the dashboard's own game-day logic (`dashboard/page.tsx` around
  `isGameDay` / the status label, ~1054–1094); don't write a second one. Today the header uses the dates
  alone, so after the last day it says Open while the board says game day.
- The chip goes on the dates line. On a phone the organization's name shows on the desk header only, so
  the header is two lines.
- **Pages name only themselves.** The event-name eyebrow under the header goes, on the 16 of 23 screens
  that show it.
- On a phone a title's icon actions join its line (44px, help last).
- **The dashboard keeps a "Dashboard" title band**, in the title face at 20px. Its second event-name header
  and its ACTIVE and LIVE tags go. Customize moves to the foot of the board.

**G2 · G3 · The board** (`app/[orgSlug]/admin/tournaments/dashboard/page.tsx`).
- **Four lists, in this order, each hidden when empty:**
  - To finalize: submitted scores, taken out of Now playing.
  - Needs a score: overdue games, with the day in the caption when it isn't today.
  - Playing now: live games only.
  - Up next.
- Each heading carries its count, once. Rows say nothing about their state.
- Dates and times go through the product's formatters only ("Fri, Jun 12 · 1:00 p.m.").
- **The top note** shows only for a step the lists can't say. It has no counts and no button. It is the
  kit's card with its olive accent edge, not an alert, and it is absent on a live afternoon.
- **Below the lists:**
  - The "Running late?" door card (G8).
  - One summary card: games final · teams arrived · by division. Figures at the kit's 24px; the champion
    still appears on its division's line.
  - Schedule health as a row that expands in place, with a down chevron.
  - Customize.
- **Every row opens Results with that game's score editor open.** Results already reads `?gameId=`
  (`results/page.tsx` ~219–224), but it only snaps the division and stage to the game. Extend it to open
  that game's editor, still once per id.
- **Phone:** ONE white frame, with the list headings as band rows inside it and a hairline between rows
  (the portal's S.7 phone frame, `CoachRowList phoneFrame`). No gaps, no stack of cards.
  - Prefer the portal's `CoachRowList` / `CoachRow` if they compose inside the admin kit. If they can't,
    match that recipe exactly and say why. **Never a second row recipe.**
- **Desk:** the lists as one row list (a date lead column, the game with its field and division as the
  caption, the score, the chevron; no heading row), in a wide column. The summary, the door, health and
  Customize go in a narrow column. The whole board fits in 900px on the fixture.

**G4 · Results** (`results/page.tsx`, `results-admin.module.css`).
- **It opens on Needs you:** waiting and unscored games across every division. **All games** is one tap
  away. The lens is the kit's pill with its count: 12px, 44px on a phone, 38px at a desk.
- The division, stage and search stay where they are today: in the view sheet on a phone, as toolbar
  dropdowns at a desk.
- **Rows:**
  - Each row is a button that opens the score editor in place, inside the frame, outlined while open.
  - A chevron ends every row.
  - Rows in the To finalize band carry one worded **Finalize** beside the chevron: **olive on white** (A12),
    44px on a phone, 38px at a desk.
  - The 22px pencil and the bare tick go.
- **The editor:**
  - Steppers are 44px, and the numeral box is 52px wide.
  - **Save is the screen's one lime.** Forfeit keeps its red.
  - A tie says **Tie**, and a playoff game still refuses a tie.
- The waiting count gets its words.
- **Phone:** one frame, as the board. **Desk:** a row list.

**G5 · One word per game state:** *Needs a score · Pending Review · Final · Forfeit · Tie* (as `/marketing`
confirms). They go everywhere the state is shown:
- the board and Results;
- the schedule's tags (`schedule/components/GameList.tsx`, `ScheduleTimeline.tsx`);
- the scorekeeper's filters (`app/[orgSlug]/scorekeeper/page.tsx`).

Also update the help articles' words **and their `keywords` / `searchText`** (`lib/help-content/tournaments.tsx`)
through `/docs`. The spelling gate must pass.

**G6 · Game day stays current.** Results and Check-in refresh every 30 s while the page is visible, the same
way the board does (`dashboard/page.tsx` ~912–928). An open score editor or team sheet is never refreshed
out from under the organizer. There is no indicator. Results' "no refresh needed" line was removed by the
defects pass; confirm it's gone.

**G7 · Check-in.** The board is `components/admin/CheckInBoard.tsx`. **It IS the gate volunteer's board**
(`app/[orgSlug]/check-in/page.tsx` mounts it with `pinnedFilters`), so every change reaches the gate.
- **Row:** one worded **Check in** (olive, 44px) and the chevron. The row opens the team sheet.
  **No-show lives only in the sheet**; the sheet is unchanged, and its big Check in is the screen's one
  lime. A checked-in row shows the "In · 9:58 a.m." chip and a worded **Undo**.
- **The filter is the gate's own bucket bar** (`DayOfFilterBar` / `DayOfFilterButton` in
  `components/volunteer/DayOfBottomBars.tsx`, owner Option C, 2026-08-07):
  - Four equal single-choice buttons: **All** · Not arrived · Checked in · No-show.
  - **All** comes first and is the default, as today.
  - On a phone the count leads (46px, one line at 390). At a desk it reads "Not arrived 16" on one line
    at 38px.
  - The organizer's board places the bar inline at the top. **The gate keeps its bar pinned at the bottom,
    as ruled.**
  - The three count tiles and the 24px segmented filter retire.
- **Payment is not a bucket.** "N of M teams still owe" is a caption under the bar. Each row keeps "Owes
  $475" in amber and "Paid" in plain ink.
- **Phone:** one frame with division band rows, and the button in the row beside the chevron (A11 Option 1,
  **not** K-09's card form). **Desk:** a table with its heading row (Team · Roster · Payment) and the
  divisions as band rows.

**G8 · The "Running late?" door.** The kit's door card, with a lift and the arrow in its eyebrow.
- It opens **today's** rain-delay window (`schedule/components/ShiftDayModal.tsx` on the schedule page). Add
  a parameter the schedule reads to open it, the way Results reads `gameId`.
- **Tournament Plus only.** A Tournament-plan organizer sees the door with a lock and the plan's name, and
  it opens Plan & billing's Tournament Plus panel.
- No price appears and no gate changes. Reconcile against `docs/agents/strategy/PLAN_PRICING_FACTS.md`.

## Don't

- Don't build Storm Mode, the Big Board, the admin frame, rail, bar or strip (F39 is the foundation's), public
  pages, the Club seams, or anything in Teams beyond G1's title line.
- Don't change prices, plan names or gates.
- Don't write customer copy yourself.
- Don't add a second card or row recipe.
- Don't use a multi-select dropdown anywhere.
- **Keep the demo tour anchors:**
  - `now-playing` on the Playing now list (it still renders only while a demo game is live);
  - `schedule-health` on the board's health row and on the schedule's panel;
  - `registration-health` and `post-event-summary`, untouched.

  The tour-anchor guard must stay green.

## Verification

- `npm run verify:changed`, and `npm run typecheck`, because shared admin chrome and a volunteer component
  are touched.
- **The layout sweep's `admin-t-*` and `guest-*` entries** at 390 / 360 / 768 / 1440, in both themes. Run
  one runner at a time, scoped with `--only=`, and never beside another session's sweep. Contrast must be
  0/0 in both themes.
- **Probes** (in `.probe/`), asserting on state and never on a guessed delay:
  - board → score editor is **1 tap**;
  - finalizing from the board is **2 taps**;
  - the first waiting game is on Results' **first screen** in every division;
  - a check-in is **1 tap**;
  - a second browser context's check-in appears on the first within **30 s**, without a reload;
  - nothing an organizer taps on these screens is under 38px tall at touch widths, or under 44px wide for
    an icon-only control.
- **The gate:** the volunteer walk still passes (sign in as the dev UAT gate account, reading its password
  from `.env.local`); its bottom bar is unchanged.
- **The measured figures** on the hub (first rows, board height, teams on screen one) come from the drawing.
  Re-measure the built screens and report any gap.

## Close-out

- **Offer `/simplify`, then `/review`**, before the commit (a new shared use of the row recipe inside the admin).
- **Commit only when the owner says.** On `dev`, in a private index, with explicit pathspecs, then
  `git show --stat HEAD`. One commit per logical part is fine.
- **Help:** `/docs` for the game-day articles, since the flow changes.
- **An owner walk:** a checkable Artifact on the project hub's QA tab. The hub is ONE artifact, so republish
  the same URL. Give it one purpose ("game day from a phone"), a numbered Owner QA Ledger §, and pin
  identities, not figures.
- **Record:**
  - the plan's status header and §6 as built with commits;
  - the hub's stage strip (Build);
  - the TODO line;
  - memory `project_tournament_admin_redesign`;
  - `PROGRAM_TOURNAMENTS.md`'s pointer.
- **Migrations:** none expected. If one appears, update the data dictionary in the same unit of work.
