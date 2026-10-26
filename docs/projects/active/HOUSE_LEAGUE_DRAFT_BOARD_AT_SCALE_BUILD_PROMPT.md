# House league: the draft board at real size (build prompt)

> **Written 2026-10-26**, the day the owner ruled all twelve asks as recommended and added the steps drawer (plan §2).
> **Paste this into a new chat on `dev` and re-verify every lead first.** The leads were read in the code during the
> drawing session (2026-10-26), but code moves, and another session has **uncommitted edits in this screen's files**:
> re-open each lead before building on it. Other sessions share this working copy: stage explicit paths only, commit only
> your own hunks, use a temporary index when a file is shared (memory: "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5.** It changes the draft's dealing rule and starts showing families' sign-up notes (data
> about children) on a new surface. Helpers stay on Sonnet as configured.
>
> Built in **parts, each committed locally after its own checks**. Part 5 (families together in the draft) is a change
> to the dealing rule and goes in its own commit, after the layout parts.

## What this makes true

A convenor can draft a real division (120 players, 10 teams) on one screen:
- The players waiting for a team sit in their own column that stays in the window.
- Every team is a drop target beside it.
- Any child can be found by name in one step.
- Brothers and sisters show as a family, and the draft keeps them together.
- The notes families wrote at sign-up are one click away.
- The setup steps fold away.

A six-player season gets the same screen, only shorter.

## The spec

- **The drawing is the spec**: https://claude.ai/artifact/D8WBeMERFDdBpVNHcdUQMz (source
  `docs/projects/active/HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE.html`).
  - Its frames are true size and scroll like the real page, and they are built from the real fixture.
  - Every numbered dot carries a NEW / RESTYLED / UNCHANGED note.
  - Build what the frames show. Where a frame and this prompt disagree, stop and ask.
- **Plan:** `HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE_PLAN.md`. §2 is the rulings table. §1 has the measurements.
- **PM brief:** `HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE_PM_BRIEF.md`.

## The rulings (do not reopen; record nothing they did not rule)

**Owner 2026-10-26, A1–A12 all as recommended, plus the steps drawer:**

- **A1 · The pool's own column.** It leaves the teams' grid and becomes a 344 px left column. Once scrolled past the
  steps it is sticky; its list scrolls inside it.
  - Teams sit in their own `auto-fill minmax(264px,1fr)` grid.
  - Beside the pool that is 2 across at every width, because the screen is in `moneyFrame` (max 1200 px).
- **A2 · One row everywhere:** rating · name · marks · age · ⋯.
  - Height: 40 px on desk (house compact), 44 px at ≤768, 52 px on a phone.
  - A state (Locked · Moved by you · Asked to withdraw) takes a second line spanning the row, only on that row.
  - A long name wraps; it is never clipped.
  - Column headings follow the table recipe.
- **A3 · Search** (a player, or a family by guardian name). The one rounded search.
- **A4 · Filter menu.** Ticks, with counts at the row ends; the button marks itself on.
  - Options: Not rated · Has player notes · Owing · Has a sibling here.
  - No chip row.
- **A5 · Sort**, a pick-one olive pill: Last name · Rating (strongest first) · Age · Family. Not sortable headings.
- **A6 · Family mark.**
  - A household is the same normalized guardian email, never a surname.
  - The count is that household's children in **this division**.
  - Clicking it opens a list of where each child is and lights them in olive (`--home-olive-soft` + 3 px inset
    `--home-olive`). No new colour.
- **A7 · Families together in the draft.** The draft keeps a household's children in one division together.
  - On by default, with a switch by Run the draft.
  - Part 5, its own commit.
- **A8 · Note mark.** Opens the family's sign-up note, **only for a reader who can already open that registration**.
- **A9 · Owing mark.** An amber `$` that opens the amount, replacing "owes $X" on the row. Words via /marketing.
- **A10 · One home for averages:** "12 players · avg 3.1" at the top of each team card, moved from the foot.
  - The balance line keeps only "Moved by hand" (shown only when above 0, as built).
- **A11 · Fold when empty.** When nobody is left, the pool folds to one sticky line: "Everyone is on a team · 120 of 120".
  - It is still a drop target.
  - The teams take the full width (3 across at 1440, 4 wider).
  - It reopens when anyone is off a team.
- **Drawer (owner, round 3).** The steps become a drawer. It starts open; Hide steps folds it to one 48 px line:
  "Steps · N of 4 done · Next: …".
  - The closed line carries the next step's own button only when that button lives nowhere else (Rate players).
    Run the draft and Publish teams already sit in the division head.
  - The step rows themselves are unchanged.
- **A12 · The drawer remembers.** A closed drawer stays closed for that person on that division until reopened.
  - Browser storage keyed by division.
  - Every read and write in try/catch; a failure means open.

**Unchanged, and drawn as built:**
- the division card and its head
- drag on desk and Move to… on a phone
- the "Moved by you" tag and its Put back menu, Locked, Asked to withdraw
- the 44 px pencil and trash
- the dashed "–" for an unrated player
- the phone's list of groups
- who sees ratings: anyone without access sees no Rating column, sort or average

**Steps already hidden once published:** owner 2026-10-26, in the other session's uncommitted hunk. Keep it.

## Read first

- The drawing (above). Open every frame and click every dot.
- `docs/agents/design/TABLE_AND_LIST_STANDARD.md`: compact density, column headings, the row recipe §3.10.
- The in-repo `memory/design_decisions.md`: one toolbar, the one rounded search, and the pick-one sort pill.
- Claude memory:
  - `decision_one_toolbar_rare_tools_behind_tools`
  - `feedback_clickable_design_annotations`
  - `feedback_mobile_icon_only_actions`
  - `project_house_league_draft_board_at_scale`
  - `project_club_stage9_house_league`
- The 9c build prompt and words: `HOUSE_LEAGUE_STAGE9C_BUILD_PROMPT.md`, `HOUSE_LEAGUE_STAGE9C_COPY.md`.
- The Registrations filter's drawing (`HOUSE_LEAGUE_REGISTRATIONS_FILTER_DRAWINGS.html`, committed `1546977e9`). The
  pool's Filter must match it.

## Leads to re-verify (read in the code 2026-10-26)

**The screen and the board**
- **The grid.** `components/admin/kit/club/league/teams/Teams.module.css` `.board` is
  `repeat(auto-fill, minmax(240px,1fr))`. The pool is `DropCard id="pool"`, the first child
  (`TeamsBoard.tsx` ~193); the team cards follow.
- **Row and card markup.** `PlayerRow` (~63–120) draws the sentence sub-line, the Locked badge, Asked to withdraw and
  the Moved menu. `TeamHead` / `CardFoot` (~131–169) carry the count and average in the foot.
- **Phone.** `PhoneBoard` (~219–271) is the list of groups. `MoveWindow.tsx` is the phone's Move sheet.
- **Steps and balance.** The steps are built in `TeamsScreen.tsx` (~217–240) and rendered (~294–306). The balance line
  is ~311–320. Rights are `run / seeRatings / rate` (~106).
- **Width.** The frame is `repKit.moneyFrame`, capped at 1200 (`RepKit.module.css` ~33).
- **Words.** The screen's words are `lib/house-league-teams-screen-words.ts`. `step.ratings` already says "the other N
  count as a 3", so drop that from the rows.
- **Filter words.** "Owing" and "Has player notes" already exist in `lib/house-league-money-words.ts` (~164, ~175).
  Reuse; one spelling.

**The data**
- **The board read** is `lib/house-league-teams.ts`. `BOARD_REG_COLUMNS` (~134) has `guardian_email` and the money
  lines, so owes is already computed.
- **It does NOT read `player_notes`.** Add it **only** for a reader allowed to open registrations; argument 1 below.

**The draft**
- `lib/house-league-draft.ts` `runDraft(players, teamIds, seed)` (~71).
- It is a snake by rating; unrated counts as 3; locks seed totals; a team skips its turn while it is bigger than the
  smallest.
- Tests: `tests/unit/house-league-draft.test.ts`. Guards: `house-league-ratings-guard`, `house-league-place-guard`,
  `house-league-gate-guard`, `house-league-coach-read-guard`.

**Shell and environment**
- The phone switch is `useIsPhone` at 640 px. A tablet (641–768) gets the desk board, so rows go to 44 px there.
- Drag is @dnd-kit (desk, `run` only). A sticky pool dragging to a card 2,000 px down needs window auto-scroll while
  dragging. Check that dnd-kit's autoScroll does it from a sticky source. If not, the Move to… menu is the fallback;
  say so in the walk.
- **Sticky offset:** find whether the admin top bar is fixed or sticky and set the pool's `top` to clear it. The
  document scrolls on desktop; `.adminMain` scrolls only ≤900.
- **⚠ Uncommitted hunks from another session** in `TeamsScreen.tsx`, `TeamWindow.tsx` and `Teams.module.css` (steps
  hidden once published; TeamWindow only for `run`). `git diff` them first, build on top, never revert. If that
  session has committed by then, fine.

**The fixture**
- Dev League Org → **Draft Test 2027** (U12, 120 accepted, 101 households, 10 teams, 80 paid, nobody placed, no
  ratings). Small case: any 9c walk season.
- Rebuild any time: `node --env-file=.env.local scripts/seed-draft-scale-fixture.mjs`. Dev only and deterministic; it
  clears the season's payments first. The season id changes on each rebuild.

## Things to argue before building (disagree out loud)

1. **Who sees a note.** "Can already open that registration" has to name a real gate: the house-league registrations
   read.
   - Find it; don't invent one.
   - A light house-league coach and anyone who sees the board without registrations access must not receive the note,
     **in the payload, not just the UI**. Add a guard test.
   - Allergy notes are medical. If the registrar can open registrations, they see notes. That is the ruling, not a leak.
2. **The household unit in the draft (A7).** Define it before coding, and write the cases as tests first:
   - A household deals as one unit: summed rating (unrated = 3), and its size against the "smaller team first" rule.
   - If any child is locked, the siblings follow that team.
   - Two siblings locked to different teams: the locks win, and the household is not forced together.
   - A household of 3 joining a team at 11 of 12: say what the size rule does.
   - The switch off gives today's dealing, byte for byte. Same seed, same result; there is a test for that.
3. **Family count scope.** The count shows the household's children in this division only. A sibling in another
   division is not on this board. Confirm the drawing's "Has a sibling here" wording carries that.
4. **Filter and sort state.** Keep them per visit, as the Registrations filter does. Do not persist unless that screen
   does.
5. **Performance at 120.** One board read; marks computed in it; no per-row fetch.
   - The family popover and note popover read from the board data already loaded, gated as in argument 1.

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking), in plain words.
   - What the convenor, a person without ratings access, a light coach and a phone user see differently.
   - The five arguments above, with your answers.
   - Get the owner's yes.
2. **Words through /marketing first** (owner 2026-10-26):
   - the owing mark's label and its opened amount line
   - "Has a sibling here"
   - the family popover's title and line
   - the note popover's footer
   - the drawer's "Hide steps" / "Show steps" / "Steps · N of 4 done · Next: …" and each Next phrase
   - "Everyone is on a team · N of N"

   Write them into the screen words file. One spelling against the house checks (`check:spelling`).

## What to build, in parts

**Part 1 · The board's shape.**
- The board becomes a flex row: the sticky pool column plus the teams grid.
- The one-row recipe for pool and cards, with column headings: 40 / 44 (≤768) / 52 (phone).
- The state second line; names wrap.
- Count and average move to the card head (A10). The balance line keeps "Moved by hand" only.
- Fold-when-empty (A11), as a sticky drop target.

**Part 2 · The pool's tools.**
- Search, the Filter menu with counts, and the Sort pick, on desk and in the phone's opened pool group.
- On the phone: Search on its own row, then Filter and Sort; the Sort pill opens a sheet.

**Part 3 · The marks.**
- Family mark, popover and highlight (A6).
- Note mark and popover, behind the registrations gate, with its guard test (A8).
- Owing mark (A9).
- Every mark is a real button with an accessible name and opens on click (hover is not enough).

**Part 4 · The steps drawer** (+ A12). A header row, Hide/Show, the closed line with the next step's button, and the
per-division remembered state.

**Part 5 · Families together in the draft** (A7).
- The household unit in `runDraft`, tests first (argument 2).
- The switch by Run the draft, on by default. "Draft again" honours it.
- The Move sheet's "avg X → Y" still reads true when a household moves one child at a time by hand. Moving by hand
  never drags siblings along.

**Part 6 · Help and records.**
- `/docs`: the Teams & draft guide (the pool, search, filter and sort, families, notes, the drawer, families together).
- The plan's §2/§5 and a status log; the PM brief; TODO with commit anchors; memory
  `project_house_league_draft_board_at_scale` and `project_club_stage9_house_league`.

## Definition of done

- **Checks.** Parts 1–6 committed. `npm run verify:changed` and `npm run typecheck` clean.
- **Tests.** The draft tests (old cases unchanged, the new household cases, switch-off identical) and the note-gate
  guard pass. The existing house-league guards stay green.
- **Layout.** `check:layout --changed` on the Teams screen. A tab screen needs the real `--only=` id; see the row-list
  lesson in memory.
- **Review.** `/review` on Part 3 (the notes gate), on Part 5 (the dealing rule), and on the whole. Findings fixed or
  recorded.
- **The walk.** A checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (§386 was the last when this was written;
  check). One purpose. Re-seed the fixture first. Cover:
  - **At 120:** the pool stays put while scrolling; drag from the stuck pool to the 10th team; search a name;
    Filter → Owing (40); Sort → Rating.
  - **Families and notes:** a family mark (the list and the highlight); a note mark as the convenor, then as a reader
    without registrations access (no mark, and nothing in the payload).
  - **The drawer:** close it, reload (stays closed), open a different division (open).
  - **The draft:** Run the draft with families together (every household of 2–3 on one team); Draft again with the
    switch off (households may split).
  - **States and edges:** fold when empty, and reopen after taking one child off; Locked / Moved by you / Asked to
    withdraw on the second line.
  - **Other views:** the phone's opened pool (Search, Filter, Sort, 52 px rows, 44 px ⋯); a 768 px tablet (44 px rows,
    drag); the six-player season; dark theme.

## Carried in, not yours to build

- **The page scrollbar fix** (Warm admin/coach/guest `<html>` tokens in `app/globals.css`). Done 2026-10-26 in the
  drawing session; it may already be committed.
- **Not ruled:** "play with a friend" grouping, a live coach draft room (TODO "Coach Draft Room"), ratings following a
  returning player (Stage 14), and an unpublish.

## Do not

- Reopen a ruling. Change who sees ratings. Show a note to anyone who can't open that registration, or send it in a
  payload they receive.
- Add a chip row, sortable headings, a new colour or a new radius. Clip a name.
- Revert or restage the other session's hunks. Touch the Coaches Portal, the phone bar or the More sheet. Change the
  Publish flow, placement emails, or any money writer.
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit. Use a temporary index when a file carries
another session's hunks. Part 5 is its own commit. No push and no promote without the owner's word.
