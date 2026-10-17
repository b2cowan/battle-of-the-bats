# Sidebar Strip & Grid Width, Stage 3: build the ruled Schedule and Results widths and the new game row

> Paste into a fresh session on `dev`. Written 2026-10-17. **This is a BUILD session.** The design is ratified: Asks
> 12–17 ruled 2026-10-17, *"I agree with your recommendations"* (all as recommended). Commit only when the owner says.
>
> **The hub is the spec:** https://claude.ai/artifact/5s1QP7HHsctVso78u5tUjC (source
> `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_HUB.html`, version 12). Screens 13–15 are the drawings (live
> configurators, every readout measured), screen 10 holds Asks 12–17, screen 11 the `/design` changes, the Decisions tab
> the rulings. Plan `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md` §11 (incl. "C2 drawn" and "The Day view
> and Results redrawn") holds every number and source reference. Design log 2026-10-17 entry "THE TOURNAMENT SCHEDULE
> FILLS THE SCREEN IN EVERY VIEW …".

## What was ruled (build exactly this)

1. **C2 · the tournament Schedule page fills the screen in every view** (Ask 15). Title, toolbar and every view (Day,
   All games, Timeline, Bracket) use the full page area; nothing changes width when the view changes. Phones unchanged.
2. **A · the Timeline's field columns share the room** (Asks 12 + 14): each field column grows from today's 190 to fill
   the box, never below 190, **at most 280**. An event that already scrolls sideways is exactly today. Desktop only:
   the phone's one-field pager is untouched.
3. **A new game row** for the Schedule's **Day** and **All games** views and the **Results** page (Ask 16), at computer
   width only (above 640). Columns: **When · Game · Field · Division · Status · arrow**, under **one heading row** per
   list frame (before the first band) in the standard's column-heading face (12px condensed display, 700, uppercase,
   0.05em, secondary ink). Game = the two teams stacked, each score right-aligned at the end of a Game column capped at
   300 (plus 14 of space before Field, so the score reads as the game's). Field = venue over facility/diamond; Division
   = division over pool or round. Status = a fixed-width, left-aligned, headed column holding what the trail holds
   today (Day: the existing state chips; Results: the Finalize row action, or the Forfeit / Tie chip). Rows 60 tall vs
   81 today. **Phones keep today's stacked row exactly.**
4. **Widths of those lists** (Ask 17): the Schedule's Day and All games lists fill the page (they line up with the C2
   toolbar). **Results stays a centred page at 1,200** (it moves from the older 1,100: `s.page` → `s.page s.pageWide`).
5. **Kept as today, on purpose** (inside Ask 16): the chip word "Playing now" (the standard's C9 word is "Live"; not
   this build); a win shown by a green score as today; Results' bands (To finalize · Needs a score · Playing now, and
   the All games lens's bands), its Finalize button, and opening a row to score it in place.
6. **Ask 13** (count production's fields) was overtaken by C2 — the build no longer depends on it. Do not read
   production.

## Where things stand (re-check each against the code before you rely on it)

- The Schedule page wrapper is `s.page s.pageWide` (`app/[orgSlug]/admin/admin-common.module.css`: `.page` 1,100,
  `.pageWide` 1,200 directly after it — **same file, source order wins**; never a second module's single class, which
  resolves by bundle order). C2 needs a fill modifier there (e.g. `.pageFill { max-width: none }` after `.pageWide`).
- Timeline: `app/[orgSlug]/admin/tournaments/schedule/components/ScheduleTimeline.module.css` — `.col` is a fixed
  `width: 190px`, `.grid` is `width: max-content; min-width: 100%`. A = `flex-grow: 1; max-width: 280px` on `.col` at
  desktop (the `data-mobile` rules already make `.col` `flex: 1`). Drag and drop identifies columns by droppable, not
  width; confirm the drop preview and the refused-drop band still sit in the right column after a column re-sizes.
- Today's row: `ScheduleDayList.tsx` (`ScheduleGameRow`, `stateChip`) and `results/ResultsList.tsx` (`ResultRow`,
  `GameTeams`, `ScoreEditor`) render the kit's `ClubRow` (`components/admin/kit/club/RepKit.tsx`). **`ClubRow` has
  ~40 importers — do NOT change it.** Build the game row as its own component (reusing `GameTeams` / `.teams` inside
  the Game column). `GameTeams` is also used by the generators, the playoff generator, the bracket's phone bands and
  the game window: those keep today's look.
- Results' row is one button that opens `ScoreEditor` in place (outlined). The new row keeps that: the open editor spans
  the whole row width (drawn on screen 15).
- **Build-start check, not a silent choice:** the drawing's When column is 92 (a clock, "10:45 a.m."). Results shows the
  date for a game that is not today ("Fri, Jun 12 · 1:00 p.m.", today's 10.5rem lead). Size Results' When column for
  that (10.5rem) or keep 92 only where every row is today's — say which at the build start.
- **Accessibility:** a heading row over rows must associate with them — a real table structure or
  `role="table"/"row"/"columnheader"/"cell"` while each row stays one activatable control. Never an `aria-hidden`
  label row (the drawing's is a drawing).
- Measuring traps: **headless Chromium hides scrollbars** — launch probes with `ignoreDefaultArgs: ['--hide-scrollbars']`
  or every width count is one field high. Probes live in `.probe/` (gitignored), removed afterwards.

## Records the build owes

- `docs/agents/design/TABLE_EXCEPTION_REGISTER.md`: two KEEP rows, added first (the register's rule): (a) the tournament
  Schedule page fills the screen in every view — axis: page width; reason: its Timeline and Bracket columns are fields
  and rounds, so width shows more of the event, and one width in every view means nothing moves on a view switch;
  (b) the game row on the Schedule's Day / All games and on Results — axis: Shape (an exception to the standard's §11.1
  **C5 "One booking row"**, which names the Day view) — reason: on a busy game day the field and the division are read
  down a column; rows 60 vs 81 tall; still standard on: every other booking list, and phones.
- Plan §12 "Stage 3 as built", the PM brief's status, the hub (status, plan tab, a QA walk tab section), TODO, a new
  QA ledger section (take the next free § in `OWNER_QA_LEDGER.md`), walks one purpose each.

## Preconditions and gates

1. On `dev`; fresh `git log` / `git status`. Other sessions share the tree: explicit pathspecs only; TODO and the
   ledger hold other sessions' lines (build those commits as HEAD + your edits in a private index).
2. **Present a short PM UX summary first** (what a director sees differently, by view and page; phones unchanged) —
   the hub is the detailed spec; this is the blocking step.
3. Ask before any probe against the dev server and say how long it holds it; never a whole-product sweep.
4. Gates: focused lint, `npm run typecheck` (shared CSS module + new component), `check:spelling`, the CSS purity and
   old-look/selector gates, `check:layout --changed` on the tournament Schedule screens (all views, both sidebar
   states) and Results, at computer widths and 390. The demo build fails if a tour anchor disappears: check the
   tournament demo's Schedule / Results tour anchors survive the new row.
5. Then `/simplify` (a new component), `/review`, a `/design` capture pass against screens 13–15 (Warm and Dark), and
   offer `/docs` (the guides describe the Schedule views and Results rows).
6. Commit only when the owner says.
