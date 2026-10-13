# Sidebar Strip & Grid Width — plan

**Status:** mockups RATIFIED 2026-10-12 (hub v3) — all seven asks as recommended, Fair shares B, the `/design` pass's nine drawing changes with the drawings; logged in `memory/design_decisions.md` 2026-10-12. Nothing built. Next: Stage 1 (Fair shares B).
**Hub (mockups · brief · plan · decisions):** `docs/projects/active/SIDEBAR_STRIP_AND_GRID_WIDTH_HUB.html` — published as a Claude Artifact (URL in the PM brief and the auto-memory project file).
**PM brief:** [SIDEBAR_STRIP_AND_GRID_WIDTH_PM_BRIEF.md](SIDEBAR_STRIP_AND_GRID_WIDTH_PM_BRIEF.md)

## The ask (owner, 2026-10-12)

> "should we add an option to have the nav not pinned to the side so if a user unpins they can see more of the screen? screens like [the club Schedules grid] have a lot of data … this would apply to all portals, coach/club/tournament"

Follow-up rulings the same day: **per device**, **always a choice** (never automatic), and **draw the Fair shares options**.

## 1. What the code does today (measured)

- **Club + tournament sidebar** — `components/admin/kit/AdminKitRail.tsx`, 240px (`AdminKitFrame.module.css` `.rail`), sticky under the top strip, a flex sibling of `.adminMain`; hidden ≤900px (phone bar). One component serves the club and every tournament (`TournamentRail` inside it).
- **Coach sidebar** — `components/coaches/CoachesSidebar.tsx`, 248px, width from `--coach-rail-w` (`CoachPortalShell.module.css`), which `.content` padding-left and `.mhead` margin-left also read. Groups (Season, Progress, Money, Communication, Team) collapse; key `flhq-coach-nav-groups`.
- **Page widths** — `ClubKit.module.css` `.page` 960 / `.pageWide` 1200, centred; the coach kit the same (the portal is the benchmark). `.mainPad` 2rem.
- **Schedules screen** (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`, `pageWide`) — `ScheduleGrid` = `7.25rem repeat(7, minmax(0,1fr))`; `FairShares` = a fixed 300px card + 1rem gap (`Schedules.module.css` `.body`), one column ≤1100px viewport.
- **Owner's window** ≈ 1530 × 680 CSS px (1920 display at 125%), measured from the screenshot.

### F01 — The page stops at 1,200, so a narrower sidebar cannot widen it on bigger screens

A 1,200 page needs a viewport of about 1,504 beside the full sidebar (240 + 64 padding + 1,200). The owner's is 1,530: the page is already at its cap with 13 unused each side. Collapsing to a 64 strip adds 176 of empty margin and **nothing** to the grid. Measured (hub screen 4): the strip alone adds +26 / +19 / +9 per Sunday column at 1,280 / 1,366 / 1,440, and 0 from ~1,500 up. It pays on wide screens only if time grids may fill the screen (Ask 4).

### F02 — Fair shares takes 316 beside the grid at every width

Inside the 1,200 page the grid keeps 884 → ~109 per Sunday → "9:30–11:00 a.m." wraps in every slot, even on a 1,920 monitor. Option B returns all 316 at every width (+46 per Sunday; times on one line from 1,366 up).

### Measured gains (per Sunday column; the hub computes these live)

| Width | Today | Strip | Fair shares B | Strip + B | Strip + B + fill |
|---|---|---|---|---|---|
| 1,280 | 77 (3 lines) | 103 (2) | 123 (2) | 148 (1) | 148 (1) |
| 1,366 | 90 (3) | 109 (2) | 135 (1) | 155 (1) | 160 (1) |
| 1,440 | 100 (2) | 109 (2) | 145 (1) | 155 (1) | 171 (1) |
| 1,530 (owner) | 109 (2) | 109 (2) | 155 (1) | 155 (1) | 183 (1) |
| 1,920 | 109 (2) | 109 (2) | 155 (1) | 155 (1) | 239 (1) |

## 2. Scope

- **Part 1** — Fair shares placement on the Schedules screen (ruling: A, B or C).
- **Part 2** — the sidebar strip: `AdminKitRail` (club + tournament) and `CoachesSidebar`.
- **Part 3** (if Ask 4 is yes) — a third page width, "fills the screen", for time grids only.

**Out of scope:** phones and portrait tablets (bottom bar, unchanged — ≤900px); the public site's `TournamentSideRail`; the volunteer shells; the help guide's own contents rail; the tournament public preview.

## 3. Part 2 — the strip, as drawn

- 64 wide; 40×40 targets; 18px icons. `.label` / group headings → hairlines. Every page is an icon, in today's order (the coach rail's "position is a function of grants" rule).
- Counts keep their look on the icon's corner: the amber waiting pill (ruled), the chat count; `ReleaseDot` on Help.
- Name on hover **and** keyboard focus; each icon keeps its accessible name.
- A program with **2+ pages** opens a menu beside its icon **on click** (Enter/Space; Escape closes; focus returns). Inside a rep team / house-league season, that block sits in the menu. A one-page program (House league, Public site) navigates. Same threshold as the phone's `AdminKitProgramRow` ("a program with one page has nothing to add").
- Tournament picker and coach team picker → initials tiles that open their lists (coach list keeps the "No live season" optgroup).
- **"Collapse sidebar"** is the last row (under Sign out / Admin); in the strip it is the expand icon. "Sidebar" is the help articles' word (39 uses; "side menu" ×1). One setting per device, **shared by both portals**, in `localStorage` (a per-viewer convenience — wrap in try/catch, render full when unreadable). Never automatic (ruled).
- Layers: the program menu is a menu → above the sidebar; windows/forms cover the strip as they cover the full sidebar (the ruled form-covers-nav, menu-on-top order).
- Closed-season gate: a team with no live season shows its one door in the strip too; never the live tools.

### Risks to check in the build

- Anything pinned to the sidebar's edge must follow its width. Admin: nothing beyond `.rail` is tied to 240 (searched). Coach: `--coach-rail-w` in three places — make the strip a value of that variable.
- `check:layout` baselines need a strip-mode pass.
- Demo tours start on the default full sidebar and the strip keeps every door, so anchors hold; no demo change.
- Help: one short "Collapse the sidebar" section via `/docs`.
- The tournament strip is ~1,000 tall and scrolls (`railScroll` already scrolls).

## 4. Part 1 — Fair shares

- **A — fold to a narrow column:** folded, a 150 column of the four figures stacked (one joined band) ending in "Show teams"; unfolded, a 34 fold button in the title row (one control per state). Remembered per device. Grid +150.
- **B — figures above, teams below (recommended):** the four tiles become one joined band (the money-figures ruling), four across, **above the toolbar** — they answer for the whole schedule, and the 2026-10-07 money-tab order puts such a band above the toolbar so a lens changes only what is under it (the `/design` pass's application of that ruling's reason; owner to confirm). A week's clash/short sentences sit under the toolbar, above the grid (they change with the week). The team table moves to a card under the grid, the bill door in its title row; a door "Fair shares by team ↓" at the band's end. Same at ≤1100. Phone By-team view unchanged. Grid +316 at every width. On the owner's screen the same three fields fit above the fold (the band's ~72 of height ≈ what the shorter one-line slots save).
- **C — figures above, teams in a window:** the band above the toolbar; "Fair shares by team" is an outlined button (it opens a window — 2026-10-01 rule) opening the admin's standard centred window (`KitDialog`), which covers the grid while open. Grid +316 while closed.

`/design` pass 2026-10-12: nine drawing changes, listed on the hub's screen 11 (Formatting check) — proposals until ruled, not in the design log.

The Schedules screen is Club Tier Stage 11 work whose walk is open (§300) — Part 1 rides into that stage.

## 5. Part 3 — grids that fill the screen (if ruled)

A third page width for screens whose columns are days or times. Candidates, each checked before it moves: club Schedules grid; club Calendar week; tournament Schedule. Logged in `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` as an exception to the 960/1,200 rule, with its reason. Record tables keep 1,200.

## 6. Asks (hub screen 10) — ALL RULED 2026-10-12 as recommended

Owner: *"I like fair shares B, other than that I agree with your recommendations."*

1. Collapse to icons, not away — **ruled:** the 64 strip.
2. Where the switch sits — **ruled:** last row, "Collapse sidebar".
3. A program's pages in the strip — **ruled:** click-to-open menu for 2+ pages; a one-page program navigates.
4. May a time grid fill the screen — **ruled:** yes, time grids only (log the exception in the register at build).
5. Fair shares A / B / C — **ruled:** B, as drawn (band above the toolbar).
6. Coach strip groups — **ruled:** every page as an icon (945 tall vs today's 885 with every group open; scrolls on a laptop, accepted).
7. Order — **ruled:** Fair shares first, then the strip, then fill screen by screen.

Earlier the same day: remembered **per device**; **always a choice** (never automatic).

⚠ **Stage 1 touches files another session holds uncommitted** (the schedule page and `Schedules.module.css`, Club Tier 11 / §300 work, 2026-10-12). Build Fair shares B after that session commits, or hand it to that session — never stage half a file.

## 7. Stages

1. Fair shares on the Schedules screen.
2. The strip — `AdminKitRail`, then `CoachesSidebar`.
3. Fill width, one screen at a time (if ruled).

Each: drawing ratified → build → `/review` → owner walk.

## 8. Rollout

No database change, no migration, no plan gating. Setting in the browser. Demos open on the full sidebar.
