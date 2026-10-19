# Sidebar Strip & Grid Width, Stage 3: measure the two remaining time grids before anything moves

> Paste into a fresh session on `dev`. Written 2026-10-17. **This is a MEASUREMENT session, not a build.** No product
> code changes, no baselines written, no commit unless the owner says. The output is findings and a recommendation per
> screen, on the project hub, for the owner to rule on.
>
> **The ruling being exercised:** Ask 4 (2026-10-12, *"as recommended"*): a grid whose columns are days or times
> *may* fill the screen (a third page width beside 960 and 1,200), **the club Schedules grid first; the club Calendar
> week and the tournament Schedule each checked before they move.** Plan
> `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md` §5 and §6; design log 2026-10-12
> ("THE SIDEBAR COLLAPSES TO AN ICON STRIP…", point 2).
>
> **The hub is the record:** https://claude.ai/artifact/5s1QP7HHsctVso78u5tUjC (source
> `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_HUB.html`, version 5). Its screen 4 ("Every width, measured") is the
> method to copy; its measured table is in the plan §1.

## What changed since the ruling (read it as the starting point, and re-check it)

- **Fair shares B (Stage 1, `40df0587`) and the sidebar strip (Stage 2, `dedf55a3`, QA §325 ✅ 29/29) are built.**
- **On the hub's own measurements, the club Schedules grid no longer has a case for filling the screen:** with B and
  the strip, every time is on one line at every measured width (1,280 / 1,366 / 1,440 / 1,530 / 1,920); filling adds
  0–16 per Sunday column on laptops and 28–84 on big screens, inside slots whose text already fits — no line count
  changes, no slot gets shorter, no more fields fit above the fold. **Recommended to the owner 2026-10-17: park the
  fill width for Schedules. NOT RULED** — record it as a recommendation, and put it to the owner as an ask in this
  session's output. Re-measure the BUILT page once (both sidebar states, 1,280 and 1,920) to confirm the drawing's
  numbers hold on the real screen before repeating them.
- The owner's window: about **1,530 × 680** (a 1,920 display at 125%).

## The two screens to measure

1. **The club Calendar, Week view** — `/{clubSlug}/admin/calendar` (UAT Rep Club), the club's 1,200 page (`ClubKit`
   `.pageWide`). Sweep screen ids `admin-calendar` (+ `-list`, `-month` for its other views — read
   `scripts/layout-screens.mjs` for how the sweep picks a view).
2. **The tournament Schedule** — `/{orgSlug}/admin/tournaments/schedule` on a Tournament Plus event with a published
   schedule (the `orgOwner` fixture). It has several views (Day, Timeline, Bracket — `pickTournamentScheduleView` in the
   sweep's screen list); **decide from the code which views are columns of days or times** and measure only those.
   ⚠ **It caps at 1,100, not 960 or 1,200** (`admin-common.module.css` `.page`, an older shared class). Confirm that
   in the browser and REPORT it as a finding against the two-width rule (the club pages' page-frame benchmark,
   owner 2026-10-07: *"match the portal"*) — **do not change it**; whether it moves to 1,200 or fills is the owner's call.

## What to measure, per screen and view

At **1,280 × 680, 1,366 × 650, 1,440 × 780, 1,530 × 680, 1,920 × 950** (the hub's widths), each in **three states**:
the full sidebar at today's cap · the strip (`flhq-sidebar` = `strip`) at today's cap · the strip with the cap lifted
(simulated in the probe only, by injecting a style that removes the page wrapper's `max-width`; never in product code).

- **The column width** of one day or time column (for a timeline: the width of one hour or slot), with the browser's
  real fonts — never typed numbers.
- **Whether the text in a slot or event wraps** — lines taken by the longest real time label ("9:30–11:00 a.m." style)
  and by an event's title — and how many events or rows are fully visible above the window's bottom edge.
- **Anything cut off or scrolling sideways**, and what the page does with the room it gets (does the extra width reach
  the grid, or become margin?).
- Then the honest question per screen: **does filling change anything a person sees** (fewer lines, more rows or games
  in view, no sideways scroll)? A gain only in empty width is not a gain.

**Method (binding, as in the sweep's header):** read computed styles and real geometry with Playwright; never eyeball a
screenshot. Probes live in a gitignored `.probe/` at the repo root (add `.probe/` to `.gitignore` while you work, then
`git checkout -- .gitignore && rm -rf .probe` when done — memory `reference_probe_scratch_dir`); reuse the sweep's
screen addresses and sessions (`resolveUatContext` / `resolveAdminContext` from `scripts/uat-fixture-context.mjs`,
`SCREENS` from `scripts/layout-screens.mjs`, the sessions in `tests/uat/.auth/`). Use the real UAT data; never write to
the database. One page at a time (`--workers=1` spirit), and watch free memory (`scripts/memory-guard.mjs`).

## Preconditions

1. On `dev`; read `git log` and `git status` fresh. Nothing in this session edits product code.
2. **Ask the owner before any probe, capture, `check:layout` run or `auth-setup`**, and say how long it will hold the
   dev server (one browser tester at a time). If a sign-in has expired, `auth-setup` is the repair — ask first. Never a
   whole-product sweep on the dev server.
3. **Read first:** the plan whole, the PM brief, the hub's screens 1–4 and its Decisions tab; memory
   `project_sidebar_strip_grid_width`, `feedback_portal_is_the_formatting_benchmark`,
   `feedback_mockups_as_claude_artifacts`, `feedback_project_hub_single_artifact`,
   `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`; and
   `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` (where an approved fill width would be logged).

## Output

- **On the hub, at the same address** (read the live copy in full first; parse every script before publishing): a new
  measured screen **12 · "The other time grids, measured"** — one table per screen and view in the shape of screen 4
  (width × state, column width, lines, rows in view, the gain vs today), the re-measured Schedules row from the built
  page, and the 1,100 finding. Then the asks on screen 10 (or a new asks block): per screen, **fill / leave at its width
  / move to 1,200 / needs a mockup** (only where filling would change what the screen shows, e.g. more days at once),
  with a recommendation and its measured reason; and **park the Schedules fill width?** Add the rows to the Decisions
  tab only once the owner rules.
- **The plan:** a §10 "Stage 3 measured" with the numbers, the method and the recommendation per screen; the PM brief's
  status line; the TODO line (`Sidebar Strip & Grid Width`).
- **A reply in the owner's voice:** what each screen gets from filling, in plain terms, the recommendation, the asks.
  No file paths in it.
- **Commit only when the owner says** (explicit paths; the TODO and ledger hold other sessions' lines — build those as
  HEAD + your edits in a private index, memory `reference_partial_commit_shared_tree`).
