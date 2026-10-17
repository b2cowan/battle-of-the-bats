# Sidebar Strip & Grid Width — plan

**Status:** mockups RATIFIED 2026-10-12 (hub v3) — all seven asks as recommended, Fair shares B, the `/design` pass's nine drawing changes with the drawings; logged in `memory/design_decisions.md` 2026-10-12. **Stage 1 (Fair shares B) BUILT + COMMITTED 2026-10-16 inside Club Tier Stage 11d part B** (`40df0587`; owner at that build's start: "one pass over one panel"): the band four across above the toolbar with "Fair shares by team ↓", the week's lines above the grid, the team card under the grid with the bill's door in its title row; at that width Moved around carries the Bill column again; its walks are QA §322 (club hub, Stage 11d part B). **Stage 2 (the strip) BUILT 2026-10-16** in all three sidebars — club and tournament, Premium coach, and the free coach portal (owner at the build start: yes) — after `/simplify`, `/review` (high-risk tier) and a `/design` capture pass; committed `dedf55a3` (records `e94e1765`) 2026-10-17; walks QA §325 **✅ PASSED 2026-10-17, 29 of 29**. As built: §9. **Stage 3 MEASURED + RULED 2026-10-17** (§10; hub version 7, screens 10 + 12): filling changes what a person sees only on the tournament Timeline, for events with six or more fields. Asks 8–11 ruled as recommended (owner: "I agree with your recommendations, go ahead"); the tournament Schedule moved 1,100 → 1,200 the same day (`6fd32fac`; walks QA §327 **✅ PASSED 2026-10-17, 5 of 5**). Next: a mockup of the Timeline filling the screen, in its own session (`SIDEBAR_STRIP_STAGE3_TIMELINE_MOCKUP_PROMPT.md`).
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

1. Fair shares on the Schedules screen — **BUILT 2026-10-16** (`40df0587`, with Club Tier Stage 11d part B; walks QA §322).
2. The strip — `AdminKitRail`, then `CoachesSidebar`, then the free coach rail (`CoachPortalShell`, owner 2026-10-16) — **BUILT 2026-10-16**, committed `dedf55a3` 2026-10-17 (§9; walks QA §325 ✅ passed 2026-10-17).
3. Fill width, one screen at a time (if ruled). **2026-10-17:** on the hub's measurements the club Schedules grid no longer gains anything a person sees from filling (with B and the strip every time is on one line at every measured width; filling adds width inside slots that already fit) — **recommended parked, not ruled**. The club Calendar week and the tournament Schedule are measured next: `SIDEBAR_STRIP_STAGE3_MEASURE_PROMPT.md`. **Measured + ruled 2026-10-17 (§10)**: Schedules and the Calendar week stay at 1,200; the tournament Schedule onto 1,200 (built, §327); the Timeline fill → a mockup.

Each: drawing ratified → build → `/review` → owner walk.

## 8. Rollout

No database change, no migration, no plan gating. Setting in the browser. Demos open on the full sidebar.

## 9. Stage 2 as built (2026-10-16)

Built from `SIDEBAR_STRIP_STAGE2_BUILD_PROMPT.md` to the ratified hub (screens 2, 8, 9, 11). Walks: QA §325 (the hub's QA tab) — ✅ passed 2026-10-17, 29 of 29, no notes.

### Rulings at the build start (owner, 2026-10-16, all as recommended)

- **The free Coaches Portal's rail gets the strip too, with the same setting** ("all portals"; the coach drawing, screen 9, is its spec).
- **On the free portal, while collapsed, the team header band shows on every team page.** The rail was where a computer read the team's name on a team page (the band is hidden there on purpose), so folding the rail would have taken the name off the screen. The band shows on every page whose ADDRESS names a team, so it is there from the first paint.
- **Proceed before "Needs attention clears itself" committed** — it shared no code file with this build (its drawer covers the whole screen and is not tied to the rail's width). It committed (`37d0fe49`) during the build.

### What the code does

- **One setting, every portal** — `lib/sidebar-strip.ts` (key `flhq-sidebar`, value `strip`). The root no-flash script (`lib/no-flash-script.ts`) sets `html[data-sidebar="strip"]` before the first paint, and `NoFlashRestore` puts it back after a root rebuild (the theme's own pattern; the bundled Next guide "preventing flash before hydration" recommends exactly this). **Why this and not a layout effect:** a layout effect holds for client navigation but a cold load paints the server's full sidebar and then snaps; the attribute is there before anything paints, so a strip user never watches the sidebar move. Every rail renders the SAME markup in both states and its stylesheet narrows it under the attribute (all inside `@media (min-width: 901px)` — phones untouched). JavaScript decides behaviour only (a menu row's click, read live), plus the few accessibility attributes a strip row adds (rendered after hydration). Blocked storage: the choice holds for the page and is forgotten on reload. Another tab's change follows live (the `storage` event).
- **Shared parts** — `components/shared/SidebarStrip.tsx` + `.module.css`: the collapse row, the name bubble (reads each row's own accessible name), the program menu, the picker tile, and the class recipe each rail wears (`rowLabel` — the label clipped, never `display: none`, so every icon keeps its name; `fullOnly`, `stripRule`, `foldedGroup`, `cornerCount`, `cornerDot`, `stripLayer`, `collapseRow`). The bubble and the menu are `position: fixed` INSIDE the sidebar, not portaled: a tall strip scrolls and would clip them, and a portal would leave the sidebar's warm/dark palette scope. The menu's keyboard is the house menu's (`rovingMenuKey` in `lib/overlay-hooks.ts`, now ONE copy shared with `CoachToolbarMenu`): focus moves in on open (to the page you are on), arrows / Home / End rove, Space activates a link row, Tab closes and hands focus back to the icon, Escape closes and returns focus, a press outside closes.
- **Widths** — each sidebar's width is ONE variable, with no fallback copies: `--admin-rail-w` (240 → 64, declared on `.adminShell`), `--coach-sidebar-w` (Premium, 220 → 64; read by `.sidebar` and `.saveBar`), `--coach-rail-w` (free, 248 → 64; read by the rail, the header band's margin and the content's padding). The plan's "Coach: `--coach-rail-w` in three places" described the free shell; the Premium sidebar is 220, not 248 (build prompt, corrected).
- **Layers** — in the strip the club/tournament and Premium sidebars take `z-index: 70`: over every sticky bar a page pins (the event header and masthead at 40, the kit's sticky toolbar at 55, the tab row `HubTabBar` at 60, in both portals), under the top strip (80) and every window and form (200+). The free rail is already 110. Inside, the menu sits over the bubble.
- **The sweep learned the strip** — `check:layout --sidebar=strip` seeds the setting and measures desktop widths only, against the SAME baseline (a finding known with the full sidebar is not new; a deliberate strip-only one is recorded under `<width>@strip`, which only a strip run writes, prunes or reads). `--width=<px>` takes an unlisted desktop width (1280) for an ad-hoc run with `--dump`, never baselined.

### Departures from the drawings (each said at build time)

1. **Organization's menu leads with the Organization page itself.** Its full-sidebar row opens that page, which is not one of its listed pages, so the drawn menu would have lost it from the strip.
2. **A tournament-only (or cancelled) account's Account rows draw their icons in the strip** (the ones the phone's More menu gives them). The full sidebar lists them by name alone, unchanged.
3. **House league inside a season** opens a menu (Seasons, the season's five pages) — the drawing shows no season block — and the full sidebar's season switcher becomes **"Other seasons"** rows in it (each opens the page you are on), only when the club has two or more seasons.
4. **Page counts ride on the menu's rows**, as they do on the full sidebar's page rows; an open program keeps its count on its icon in the strip (its pages are in the menu).
5. **A hairline under the Premium coach's team tile** — the full sidebar's divider between the picker and Overview, narrowed. Screen 9 goes straight from tile to Overview; this follows the shipped sidebar.
6. **The free rail's identity block** (the team's name or picker, the status chip, the event line) and its "Live on FieldLogicHQ" line are the full rail's only; in the strip the header band carries the team, the chip and the next event on team pages (the ruling above). A one-team coach's portal home page and all-tournaments list show no team name while collapsed — the ruling said team pages, and widening it would make the band arrive after the team data, a jump on every load. Owner's call if wanted.
7. **The tile's text** — an age-group first word stands ("13U AAA" → 13U), else the first two lettered words' initials ("Spring Classic 2027" → SC); `stripTileText` beside `teamInitials` in `lib/team-color.ts`, a different rule on purpose.
8. **The sweep's content-overflow rule exempts the strip's corner marks** (one reasoned entry, `OVERFLOW_EXEMPT`, strip only, rows and their plain group wrappers — never a scroll box) rather than one baseline entry per admin screen: the drawn count overhangs its 40 target by 7, inside the 64 strip. A clip that would quiet the rule (`overflow-clip-margin`) does not reach Safari and would cut the pill there.

### Passes and gates

- **`/simplify`** (4 lenses): the bubble reads each row's own name (≈25 duplicated name attributes removed); one roving-keys helper for both menus (it closed a real gap — Space on a link row did nothing in the strip's menu); the collapse row's hairline, a folded group and the layer each defined once; smaller tidy-ups. Skipped on purpose: per-rail row geometry (≈20 call sites for ≈10 declarations), the coach rail's spacer, icons for the Account rows at source (would change the full sidebar).
- **`/review`, high-risk tier** (correctness, regression/hydration, accessibility/keyboard/layers, spec conformance): 8 confirmed and fixed — **a full-sidebar regression** (an open program with a count lost its right-aligned chevron: a `display: none` sibling still matched `.count + .chevron`; now `.count:not(.countWhenOpen) + .chevron`, guarded), the layer raised 45 → 70 over the sticky tab rows, the menu never above the sidebar's top, the bubble never over an open menu and Escape dismisses it, focus back to the tile after a switch, a held or modified Space ignored, "Send feedback" keeps its hover title in the full sidebar, menus open on the page you are on. 4 refuted, 5 advisory.
- **`/design`** against the hub at 1280 / 1440, Warm and Dark (8 captures): matches the drawings. One defect found and fixed in the pass — the Premium team picker's empty box showed under the tile (the shared hide rule tied the rail's own strip rule and lost on bundle order; now a doubled class, guarded).
- **Gates:** `tests/unit/sidebar-strip-guard.test.ts` (22: one setting in every portal, no width hard-coded outside its variable, every row keeps its name, every count/dot/door kept, phones untouched, the chevron and the picker-box fixes); the nav guards (`admin-kit-nav`, `coach-nav-groups`, the free bar guard, the club stage guards) and `sheet-frame-guard` (one assertion re-pointed to the shared keys); typecheck and focused lint clean; spelling, contrast, text contrast, CSS-module purity, demos green. **`check:layout`** on 8 screens (club Overview, Schedules, a rep team's Roster, Accounting, a tournament Dashboard, the coach Overview, Lineups, a closed-season team) at 1440 in both states, Warm and Dark, and 1280 in both states (dumped and diffed): **no new findings**. The free portal is not in the sweep's screen list (no fixture there) — its strip is the walks'.
- **Found and not this build's** (pre-existing on `dev`, reported): `club-stage6c-screens-guard`'s scrollbar assertion expects a fallback the committed file does not have; `coach-semantic-ink` flags `.occGroupPermit` (another session's commit); dev/prod schema parity (migration 332, dev only); the house-league old-look ratchet; a `GuidanceRail.module.css` selector clash.
- **Dev-server note for the walks:** Next's round "N" developer badge sits in the bottom-left corner over the sidebar's last row; it is not in the product. If it covers "Collapse sidebar" or the expand icon, click it — its menu can move it to another corner or hide it for the session.

## 10. Stage 3 measured (2026-10-17)

From `SIDEBAR_STRIP_STAGE3_MEASURE_PROMPT.md`. A measurement session (no product code changed, no baseline written), then the rulings and the one build they called for. Numbers on the hub's screen 12 ("The other time grids, measured"); the asks are Asks 8–11 on screen 10. **All four RULED 2026-10-17 as recommended** (owner: "I agree with your recommendations, go ahead"; hub Decisions tab, version 7).

### Method

A read-only Playwright probe against the dev server (the sweep's own screen addresses, `interact` steps and saved sessions — `rep-club-owner`, `org-owner`), real UAT data, the product's fonts, `memory-guard` preflight + watchdog (low-water 5,106 MB free). Five windows — 1,280 × 680, 1,366 × 650, 1,440 × 780, 1,530 × 680, 1,920 × 950 — each in three states: the full sidebar; the strip (`html[data-sidebar="strip"]`); the strip with every `max-width` between the grid and `<body>` lifted by an inline style in the probe's page. Text lines are counted from a Range's client rects; "in view" = wholly above the window's bottom edge, page scrolled to the top. For the Timeline, whose test event has 4 fields, extra field columns were cloned in the probe's page (inserted before the 132-wide "add a field" column) to count how many fit before the grid scrolls sideways. Nothing saved.

### What the code does (read before measuring)

- **Club Calendar, Week view** (`ClubCalendarViews.tsx` `WeekView`, `ClubCalendar.module.css` `.week`): seven `minmax(0,1fr)` day columns inside `ClubKit` `.pageWide` (1,200). The view is component state (no URL).
- **Tournament Schedule** (`app/[orgSlug]/admin/tournaments/schedule/page.tsx`): four views. **Day** and **All games** are row lists (`ScheduleDayList`), the **Bracket**'s columns are rounds — none is a time grid. **Timeline** (`components/ScheduleTimeline.module.css`): a 52 time gutter, one **fixed 190** column per field, hours down, `.grid { width: max-content; min-width: 100% }` in a scroller, then a 132 "add a field" column. More width adds whole fields, never width to a field. The page wears `admin-common.module.css` `.page` → **1,100**.

### Findings

| Screen | What filling changes | Recommendation |
|---|---|---|
| **Schedules grid** (built page) | Drawing's numbers hold within 0.6 (strip 148 / 155 / 155 / 155 / 155 per Sunday; fill 148 / 160 / 171 / 183 / 239). Times one line at every width with the strip; fill adds 0–16 per Sunday on laptops, 29–85 on big screens; no line, field row (1 / 1 / 2 / 2 / 4) or slot in view (28 / 26 / 40 / 28 / 56) changes. At 1,280 with the full sidebar 36 of 84 times wrap (123 per Sunday) — the strip fixes that; filling cannot (page under 1,200). | **Park the fill** (Ask 8) |
| **Calendar, Week** (15 bookings, 12 on Sunday) | Times never wrap (narrowest day 133). The place line ("Lakeshore Dome · Field 5") wraps until a day is ~190. Strip + fill at 1,530: 165 → 193 per day, place on one line, cards 81 → 66, 8 of 15 bookings in view (was 7), busy day 1,117 → 914 (still taller than any window). At 1,920: 249, 12 of 15 (was 10). At 1,440: +16, 9 (was 8). | **Stay at 1,200** (Ask 9): real but small; the week scrolls either way |
| **Tournament Timeline** | Fields fully in view before sideways scroll (full · 1,100 / 1,200 / fill — strip · 1,100 / 1,200 / fill): 1,280 4/4/4 — 5/5/5; 1,366 5/5/5 — 5/6/6; 1,440 5/5/5 — 5/6/6; **1,530 5/6/6 — 5/6/7**; 1,920 5/6/8 — 5/6/9. Start time one line everywhere; team names up to 4 lines at every width (the column never widens). Matters only for events with 6+ fields. | **1,200 first (Ask 11), then a mockup** before any fill (Ask 10): three of the page's four views are lists, so filling the page stretches them, and filling only the Timeline makes the page change width between views |

### F03 — The tournament Schedule stops at 1,100

Measured 1,100 in both sidebar states (unused each side, full / strip: 1,280 0 / 26 · 1,366 0 / 69 · 1,440 18 / 106 · **1,530 63 / 151** · 1,920 258 / 346). Not one of the two page widths (960 / 1,200; the page-frame benchmark, owner 2026-10-07: "match the portal"). In the code `admin-common.module.css` `.page` also wraps the tournament **Results** and **Check-in** pages and the organization's **PDF settings** page, and `communication.module.css` gives the tournament **Communications** page its own 1,100 (code only, not measured in the browser). **Reported, not changed.** Recommended (Ask 11): the Schedule moves to 1,200 in Stage 3; the other four take 960 or 1,200 the next time each is worked on.

### Ruled 2026-10-17, and what followed

- **Ask 8 · park** → Stage 3 for the Schedules grid closes with no build; nothing for `TABLE_EXCEPTION_REGISTER.md`.
- **Ask 9 · stay at 1,200** → nothing to build or register.
- **Ask 11 · yes** → **built 2026-10-17**: `admin-common.module.css` gains `.pageWide { max-width: 1200px }` directly after `.page` (same file, so it wins on source order — never a second module's single class, which resolves by bundle order); the tournament Schedule's wrapper wears `s.page s.pageWide`. No exception (1,200 is one of the two widths). Results, Check-in and the PDF settings page keep `.page` (1,100), and Communications its own 1,100 — each moves when next worked on. Gates: focused lint (0 errors), CSS purity, the old-look and selector gates (their two failures are pre-existing and name other files: the house-league ratchet, `GuidanceRail` `.context`); `check:layout --only=<all 11 admin-t-schedule screens>` at every width and `--sidebar=strip` at 1,440: **no new findings**. Committed `6fd32fac` (records `27d2cabc`) 2026-10-17. Walk: QA §327 (T1–T3, the hub's QA walk tab) **✅ PASSED 2026-10-17, 5 of 5**, no notes.
- **Ask 10 · a mockup first** → next, in its own session (`SIDEBAR_STRIP_STAGE3_TIMELINE_MOCKUP_PROMPT.md`): a drawing session for "the Timeline fills the screen" (per-view width, or a wider Timeline inside a 1,200 page); a fill, if then ratified, is logged in `TABLE_EXCEPTION_REGISTER.md` with its measured reason.
