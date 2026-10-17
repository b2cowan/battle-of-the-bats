# Sidebar Strip & Grid Width, Stage 3: draw the tournament Timeline using the room it has

> Paste into a fresh session on `dev`. Written 2026-10-17. **This is a MOCKUP session, not a build.** No product code
> changes, no commit unless the owner says. The output is drawings and asks on the project hub for the owner to rule on.
>
> **The ruling being exercised:** Ask 10 (2026-10-17, *"I agree with your recommendations, go ahead"*): the tournament
> Timeline filling the screen is **drawn as a mockup before anything is built**. Plan
> `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md` §10; design log 2026-10-17 ("A TIME GRID FILLS THE SCREEN
> ONLY WHERE THE WIDTH SHOWS…").
>
> **The hub is the record:** https://claude.ai/artifact/5s1QP7HHsctVso78u5tUjC (source
> `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_HUB.html`, version 8). Screen 12 holds the measurements this
> session starts from; screen 10 holds Asks 1–11 (all ruled). Add new screens after 12, never a second artifact.

## Where things stand (re-check each against the code before you repeat it)

- The tournament Schedule page stops at **1,200** since `6fd32fac` (2026-10-17; walks QA §327 ✅ 5 of 5). It used to
  stop at 1,100.
- The **Timeline** is the Schedule's only time grid (Day and All games are lists; the Bracket's columns are rounds).
  As measured: a 52 time gutter, then one **fixed 190** column per field, hours running down, then a 132 "add a field"
  column. The grid is as wide as its content, at least the box (`min-width: 100%`), inside a scroller capped at 70% of
  the window's height. More width adds whole fields before the grid scrolls sideways and never widens a field. A start
  time ("11:30 a.m.") is on one line everywhere; **a game's team names take up to 4 lines in a 190 column.**
- Fields side by side before sideways scrolling (the strip, 1,200 / filling): a 1,530 window 6 / 7, a 1,920 window
  6 / 9. Filling only matters for an event with **six or more fields**.
- The owner's window is about **1,530 × 680** (a 1,920 display at 125%).

## Widen the question first (do this before drawing)

The ruling asked for a fill to be drawn. The evidence is wider than that ask:

1. **An event with FEW fields wastes the room today.** With 4 fields at 1,200 the grid is 52 + 4 × 190 + 132 = 944 wide
   in a box of about 1,198, so roughly 250 sits empty to the right, while team names wrap to as many as 4 lines. If the
   field columns shared the box (a floor of 190, growing to fill it), every event with five fields or fewer would get
   shorter game blocks and fewer wrapped names, at 1,200, with no exception to the two page widths. Measure that
   (lines of team names, block heights, games in view inside the 70% scroller) before you assume the fill is the
   bigger lever.
2. **How many fields do real events have?** Count the fields per tournament in the dev database and the demo seed
   (`riverdale-minor-ball`). **Ask the owner before reading production.** If almost no event has six or more fields,
   say so: a fill would then serve almost nobody.
3. Then put both to the owner as asks. This could turn out to be the wrong question; if so, say that plainly.

## What to draw (whole-screen before / after, true size, the product's fonts, Warm and Dark)

At 1,530 × 680 and 1,920 × 950, full sidebar and strip, for a 4-field and an 8-field event (realistic names, real team
names of realistic length):

- **Today** — the Timeline at 1,200, fixed 190 columns.
- **A · Columns share the room** — inside 1,200, field columns grow from a 190 floor to fill the box. No page-width change.
- **B · The Timeline breaks out** — the page (title, toolbar, filters) stays 1,200 and centred; only the Timeline's
  scroller widens toward the window's edges. Switching views never changes the page's width.
- **C · The page fills on the Timeline** — the whole page fills while the Timeline is the view (for comparison; it
  changes width as you switch views, which is why Ask 10 asked for a drawing).
- A and B combine; say whether that is the recommendation.

Each drawing's readout is MEASURED by the browser from the drawn layout (as the hub's screen 4 does): field column width,
lines of team names, game blocks fully in view inside the scroller, fields side by side before sideways scrolling.

## Preconditions

1. On `dev`; read `git log` and `git status` fresh. Nothing in this session edits product code.
2. **Ask the owner before any probe against the dev server**, and say how long it holds it. Never a whole-product sweep.
3. **Read first:** plan §10 (whole plan if time allows), the PM brief, the hub's screens 10 and 12 and its Decisions tab;
   the Timeline's component and stylesheet (`app/[orgSlug]/admin/tournaments/schedule/components/ScheduleTimeline*`) and
   how the page switches views; the Tournament admin redesign plan's Stage 3 (it owns the schedule screen — check
   nothing in flight there collides); `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` (where a fill would be logged);
   memory `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`,
   `feedback_project_hub_single_artifact`, `feedback_portal_is_the_formatting_benchmark`,
   `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`, `reference_probe_scratch_dir`.

## Output

- **On the hub, at the same address** (read the live copy in full first; parse every script and dry-render before
  publishing): new screens after 12 with the drawings and their measured readouts, the field-count finding, and a
  new asks block on screen 10 (Ask 12 onward): which option, with a recommendation and its measured reason, including
  "none of them" if the evidence says so. **Run `/design` on the drawings before handing them over.**
- **The plan:** a §11 "Timeline drawn"; the PM brief's status line; the TODO line (`Sidebar Strip & Grid Width`).
- **A reply in the owner's voice:** what each option does for a tournament director, the recommendation, the asks. No
  file paths in it.
- **Commit only when the owner says** (explicit paths; the TODO and ledger hold other sessions' lines — build those as
  HEAD + your edits in a private index, memory `reference_partial_commit_shared_tree`).
