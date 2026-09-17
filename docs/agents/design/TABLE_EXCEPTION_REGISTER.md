# Table exception register

**Status: APPROVED by the owner 2026-09-06 ("proceed with your recommended updates") — every ASK
row went the recommended way; the FIX rows are being built the same day (see the changelog at the
foot for what has landed, and A-08 for the one question the build raised).**
This is the half the owner asked for. Every departure the rendered inventory found gets a row here,
and each is one of:

- **KEEP** — a real decision, now recorded with its citation. The surface may differ on the named
  axis and on **no other**.
- **FIX** — drift; bring to the standard. Ordered in the standard's §8.
- **ASK** — needs the owner; a recommendation is given, nothing is assumed.

A row names the *surface*, the *axis* it departs on, *what it does instead*, the *reason*, *who
decided and when*, and — for KEEP rows — **which axes it is explicitly NOT excepted from**. No row
here smuggles a new ruling: anything the owner already decided is a KEEP with a citation.

Evidence for every row: `TABLE_INVENTORY_2026-09-06.md` (measured at 390/1440, warm/dark). The ASK
rows are answered on the mockup artifact's decision panel:
https://claude.ai/code/artifact/0aa319dd-a6eb-4fff-b09b-df8591475fe1

---

## KEEP — documented exceptions

| Id | Surface | Axis | What it does instead | Reason | Decided | Still standard on |
|---|---|---|---|---|---|---|
| **K-01** | Ledger → Timeline (the transactions register) | Density · type size | `0.28rem` vertical padding (25–28px rows) and body at `--type-support` (12px, 700 for the lead cell) | a season of entries across eight columns is the one case where fitting more rows on a screen outranks reading comfort | one-surface plan §9.3 (2026-09-05); density ruling owner 2026-08-19 | ink · hairline · heading · hover · alignment · chrome · phone card shape. ⚠ Its zebra is **not** part of this exception — it has never painted (F-04) |
| **K-02** | Coach money grids (Budget list / by-period, Statement, By activity, Months) | Type size for group and item rows | the private ladder `--money-cat-size` 0.92rem / `--money-line-size` 0.84rem / `--money-catnum-size` 0.86rem + two weights, declared once on the coaches shell | a three-level money tree needs a step between `--type-support` (12) and `--type-body` (14) that the ladder lacks; folding it pushes line figures to 12px or categories to 16px, and the 2026-08-13 ruling that a category is the largest name in its group must hold at both | comment block on `.coachesShell`, 2026-08-13; type-scale ruling 2026-08-28 | heading · hairline · ground · alignment · interaction · chrome · density (compact) |
| **K-03** | Budget vs. Actual Statement / By activity — the unplanned row | Colour on a figure | the dash in the Plan column is amber | the owner ruled "keep it" | QA §146 F1, 2026-09-06 | everything else on the row |
| **K-04** | Every money grid's closing row (Season net, Ending balance, Net to date) | Type | same size and weight as a group row; set apart by a 2px cap | "no fourth rung above the subtotals" | owner, twice, QA §146 | — (this *is* the standard; recorded because it was asked for) |
| **K-05** | Money grids, playing-time and results tables, public standings | Phone shape | keep columns and scroll sideways with a pinned first column | a comparison read across a row loses its point as a card stack | Chunk A D1, owner-ratified 2026-07-29 | density · type · hairline · heading · tap floor on the toggle |
| **K-06** | Any table with a sticky column | Hairline mechanism | inset box-shadow instead of `border-bottom` | collapsed borders paint in the table's layer and step by a pixel against a sticky column's layer | owner-found, measured, 2026-08-24 | the hairline's colour and weight stay the token |
| **K-07** | Every folding row (Club tab, bills, fundraisers, money categories) | Interaction | a real `<button aria-expanded>` in the row, the row as the shortcut | keyboard and screen-reader reach | /review + owner 2026-09-02 | — |
| **K-08** | Every list table's last column | Alignment / structure | one chevron on every row, right-aligned, nothing conditional beside it | a control on some rows charges its width to every row | owner §134 walk, 2026-09-03 | — |
| **K-09** | Coach list tables in card mode (≤ 640) | Responsive | lead cell is the card's title with no `data-label`; an icon-only action is corner-pinned | table furniture becomes card noise | owner §134 walk with /design, 2026-09-03 | density · type · hairline |
| **K-10** | Admin shell and platform admin (the operational shells) | Face | figures and body in the data face (mono) | the shells' terminal identity; "data clarity — use `--font-data` for numeric columns" | design principles; `btn-data` ruling 2026-05-24 | size (ladder) · heading · hairline · density · hover · phone shape — **all currently FIX (F-05, F-06, F-12)** |
| **K-11** | Public standings and results | Alignment | W / L / T / PTS figures centred; leader row tinted amber | sports-table convention every fan already reads | public standings design, 2026-06 | heading tokens · hairline tokens · hover (none — rows are not targets) |
| **K-12** | Every touch surface | Responsive | the 641–768 band takes the touch arrangement; narrow rules do not move up with it | a tablet is a touch device | owner 2026-08-27 (QA §115) | — |
| **K-13** | Tournament admin lists (Teams, Schedule, Results, Check-in, Divisions) | Structure | div-based flat rows with a label row, `--admin-row-min` 36/44 compact/comfortable, `--border-2` rule | the established admin list shape; density is the user's own toggle | owner 2026-06-01 (Divisions ruling); density 2026-06-02 | heading size/ink (F-07) · control floor (F-16) · hairline token |
| **K-14** | Any figure that is a door | Interaction | dotted underline, opens a panel; one underline means one thing per table | owner QA §132 | — |
| **K-16** | Public standings, results and the pricing comparison | Density | 16px vertical cell padding (`1rem 1.5rem`) — comfortable for a fan on a phone | owner A-05, 2026-09-06 | heading type/ink/rule · body size · hairline · hover (none) · centred figures (K-11) |
| **K-17** | Tournament admin flat-row lists | Heading face and ground | the label row (`.tableHeader`) keeps the shell's data face and its `--surface-2` ground — part of the flat-row SHAPE the 2026-06-01 ruling settled | owner 2026-06-01; recorded 2026-09-06 | heading size (`--type-support`) · tracking (0.05em) · ink (`--text-secondary`) — all moved to the standard in the same pass |
| **K-19** | A list row whose lead cell is already a door (Insights → Coverage: the name opens the player's record; the last column opens their Progress report) | Structure — the last column's shape | the second door is **worded** on a desktop ("Progress →"), not the bare chevron K-08 asks for; on a phone it is the corner chevron (K-09) | a bare chevron beside a name-link reads as the same door; a row with two doors has to name the second one | owner, on the table review of 2026-09-16 (built the same day) | alignment (right) · one control per row · nothing conditional beside it · tap floor · body face for the words |
| **K-20** | Coach development tables — the column that holds a **recorded measurement** (the metric's value, the attempts, the headline, the average) | Face | the data face (mono), tabular | "8.75 / 8.33 / 8.28" lines up digit for digit, which is the column's whole job — the ground the roster's jersey number already stands on (hub F02). ⚠ **The measurement column ONLY**: the date, the In-a-plan tick, the source and the door beside it were in the data face too and are body face now (§3.4, F-25) | owner, 2026-09-16 | size (ladder) · ink · alignment · everything else on the row |
| **K-21** | The Schedule's event chip **inside a calendar cell** (the Week and Month views) | Shape | the chip as it is — the 3px event-type rail, the 12px lead, the 31px height, `--home-card` fill — **it is not a row list** (bin C): a calendar cell holds chips, and a cell is not a stack of records | the same component draws the Schedule's LIST view, which IS a row list and takes §3.10 (F-26); the chip keeps its shape where the calendar is the structure. owner Q4, 2026-09-16 ("agree with your mockups") — the list face landed the same day (F-26) | — (not a list; nothing to be standard on) |
| **K-22** | The Notifications feed — an **unread** row | Colour (a tinted item row) | an unread row carries the blueprint wash (`rgba(--blueprint-blue-rgb), .06`) and its title reads 600 where a read row's reads 500 | §3.3 says an item row is never tinted; here the tint is STATE the redraw drew and the owner walked (Notifications Redraw D1–D6, 2026-09-03; QA §138 complete 2026-09-06). owner Q4, 2026-09-16 — recorded so the row-list gate does not report it | ground (the feed's frame paints the card) · hairline · the day-header band (it IS §3.10's label row) · type — literal rems go to the ladder (F-36) · hover on a target |
| **K-23** | The closed-season shelves — the **month fold** over the results and practices rows | Structure (a group row that folds as a native `<details>`) | a month is a `<summary>` row (44px, body 600) carrying that month's fact ("4 games · 2-1-1"), its rows under it; the table recipe's group row is a `<tr>` with a real button | the shelf's answer-first-then-the-season-by-month shape is an owner gate (2026-08-18) and the whole page is ONE PAGE by ruling; the fold is that page's group row, not drift | owner Q4, 2026-09-16 | density by content · type · hairline · ground (the shelf paints it) · the rows' alignment (score right, tabular) · hover on a row that opens (F-37) |
| **K-24** | Roster → **Off the roster** — the fold's frame | Frame (dashed) | the fold's border is `1px dashed --border-2`, not the frame's solid `--home-line` | a fold of records that have LEFT the list is drawn dashed — the same code the Schedule uses for a projected tryout; the summary row is the fold's title | owner Q4, 2026-09-16 | ground (the fold paints `--card-bg` when open — F-38) · hairline · type · tap floor |
| **K-18** | The admin shell and platform console — a control **inside a table** at touch widths | Minimum target (height) | `--admin-control-h` **38px** in comfortable mode, not the standard's 44px `--tap-min` | the admin shell's density is its own owner-ruled instrument (2026-06-02), tuned as a system across every control it owns — a table is not a reason to overrule it, and raising it here alone would put two control heights on one admin screen. ⚠ The 6px is a **deliberate, named** difference, not drift: do not "fix" it to 44 | owner A-08, 2026-09-07 (QA §149) | everything else the standard asks of those tables — heading type/ink/face · hairline · ground · density by content · alignment · one chevron column (K-08) · a real button on an opening row (K-07) · **control WIDTH** (an icon-only control still clears `--tap-min` sideways) |

## FIX — drift, bring to the standard

| Id | Surface(s) | Axis | Measured | Standard | Why it drifted (the mechanism, so it does not recur) |
|---|---|---|---|---|---|
| **F-01** | **109 desktop renders** — every coach list table (13 files), `.insightsTable`, `.devBoardTable`, 10 of 16 platform tables, the pricing comparison, the admin dashboard mini-table | Type size | **15px** cells under tables declared at 14px (coach), 11.5–12px (platform), 12px (pricing) | `--type-body` on the cell | `app/globals.css` sets `td { font-size: 0.9375rem }` on the **element**; a size set on the table and left to inherit loses to it. The coach type ladder never reached a list cell; the platform recipe's "0.75rem" has been decorative since it was written |
| **F-02** | Coach list family (13 files) and the register | Hairline | `--white-05` → **paper #F8F4ED on a white card in warm** (invisible); 5% white in dark (fainter than the grid) | `--home-line` | `--white-05` is remapped to `--home-paper` in the warm skin; the recipe was written for dark |
| **F-03** | Insights tables, devBoard tables, money grids, public pricing | Hover | the **global** `tbody tr:hover` tints every row (warm: `--home-line`; dark: white 10%) including rows that open nothing; on the money grids it fires and paints nothing (cells are opaque) | hover only on a target row, `--home-olive-soft`, with pointer | a global element rule again |
| **F-04** | Ledger → Timeline register | Colour (zebra) | the even-row band references **`--white-4`, which is not defined anywhere** → paints nothing, and has never painted; one-surface plan §9.3 recorded the zebra as "earned there" from the stylesheet, not the screen | no zebra (A-03 lets the owner choose to define it instead) | an undefined token resolves to transparent in silence; no gate checks token existence |
| **F-05** | Platform admin, 14 of 16 tables | Heading type | **8.8px** (0.55rem) display uppercase, 0.12em; email's in lime at 50% | `--type-support`, `--text-secondary`/`--data-gray` | hand-copied literal below the token floor, sixteen times |
| **F-06** | Platform admin, 16 modules | Density · hairline · hover | 16 copies of one recipe: cell padding 0.45–0.85rem, hairline white 0.04 / 0.045 / 0.08, hover lime 0.02 / 0.035 / white 0.02 / white 0.1, exports on a different face | one shared recipe, one density by content, `--home-line` (dark alias `--border-2`) | copy-paste per page; no shared class exists in that shell |
| **F-07** | Tournament admin | Heading type | five treatments: `.tableHeader` 9.3px mono · health table 9.9px mono · role matrix 10.4px display 30% ink · notifications 11.2px mono · manage/dashboard 12.8px display 60% ink (the global rule) | one: `--type-support` display, secondary ink | local recipes per page |
| **F-08** | Budget vs. Actual → **Months** at 390 | Interaction (tap size) | the figure doors are **44 × 26px** — under the floor; the Statement's are 44 × 44 | `--tap-min` both ways | the month grid's `cellValue` button never took the phone floor the shared toggle has; the layout sweep never addresses the Months view so it has never been measured |
| **F-09** | Playing-time and results insights tables; devBoard tables | Alignment | figures start/centre-aligned; devBoard figures right but not tabular | right + tabular | the insights recipe sets no number treatment (the same gap `.tdNum` closed for the money lists in August) — **CLOSED 2026-09-07**, see below |
| **F-10** | Coach list tables | Frame | accent-tinted frame (`rgba(--blueprint-blue-rgb,.15)` → olive in warm) vs the grids' neutral `--home-line` | `--home-line` | noted in the one-surface plan §9.2 |
| **F-11** | Admin dashboard registration table; tournament admin Manage; Manage's team list | All | the raw **global** recipe: 12.8px `--white-60` headings, 15px cells, 14px padding (87px two-line rows, 56px one-line) | shell recipe | no class on the table at all — the global rule *is* the recipe |
| **F-12** | Platform admin at 390 | Responsive | no card shape; sideways scroll with rows wrapping to **121–392px** (orgs, email templates, customer users) | cards for a list, scroll for a comparison; A-02 asks whether the phone matters here | the shell has no `tableAsCards` equivalent |
| **F-13** | Admin → Budget (empty) | Empty state | a heading row (`ITEM · CATEGORY · TEAM · USED BY`) drawn over an empty body with no sentence | one sentence + one action, no heading row | — |
| **F-14** | Coach list tables | Structure | the frame's `.tableWrap` radius/border differs from the report card's | one frame | — |
| **F-15** | devBoard tables (development board, history, season-end shelves) | Heading type | 11px **mono**, tertiary ink, `--white-10` rule | `--type-support` display, secondary ink, `--home-line` | a per-feature recipe |
| **F-16** | Tournament admin Check-in at 390 | Interaction | row controls **34 × 38px** | `--tap-min` both ways | ⚠ not built — the admin shell sets its comfortable control height to 38px by its own ruling (2026-06-02), so this is a shell decision, not drift: **moved to A-08** |
| **F-17** | Coach row lists — **RE-MEASURED 2026-09-16** (`TABLE_INVENTORY_2026-09-16_ROWLISTS.md`) and **RESOLVED INTO F-26–F-40 below, K-21–K-24 above, one bin-A conversion (F-40) and six bin-C removals** | Density · type · hairline · **ground** | the 09-06 enumeration was stale and impure: `railItem` (22px) was the consumer account rail's class on a staff page rebuilt 09-11; `settingRow` (71px) is the Settings *form*; the tryouts `row` (176px) is the setup checklist; `howStep` a stepper; `dateRangeOption` a menu; `collapseSection` the shelves themselves. **Removed from F-17 as bin C (not records):** those six, plus the calendar-cell chips (K-21), the depth-chart board, the chat panel, the money band tiles, the Overview's one-thing card and the free portal's single tournament card. What is left is **two species**: seven gapped card stacks on the paper and nine hairlined lists, eight of which already sit on a card | §3.10 — one recipe, one component, **exactly one painter of the ground** | each list was drawn with its feature, and the standard's ground sentence named a table |
| **F-18** | Club admin `<table>` modules — members, families, house league, accounting, rep teams, budget/bva | Type · ink · hairline (from stylesheets; **not rendered**) | headings 0.63–0.7rem at `--white-30/40`; cells 0.85–0.88rem; hairlines `--white-05` / blueprint tints; cell sizes left to the global rule | the standard | no fixture can render them (standard §7); fix when one can, and re-measure first |
| **F-19** | Money grid category toggles (desktop) | Interaction (target width) | the toggle is as wide as the category's name — "Gear" exposes a far smaller keyboard/AT target than "Tournament entry fees" on the same table | the hit box is the whole lead cell | shipped 2026-08-13 with the month grid; the gate reads height only |
| **F-20** | Public pricing comparison | Density · heading | 0 vertical padding (30px rows), 9.6px headings | ladder tokens; comfortable density (public) | marketing page built before the ladder |
| **F-21** | Coach portal chrome around tables — the tab-bar scroll arrows (34px), the help "?" (34px), the Months pager (36px), the roster drag grip (23px) | Interaction (target width) | icon-only controls narrower than `--tap-min` at touch widths | `--tap-min` both ways | surfaced by the `control-width` rule the day it was born (2026-09-06); accepted into the layout baseline with this id; not a table part — each is its own fix (COACH_TOUCH_TARGET_DEBT_PLAN) |
| **F-22** | Budget vs. Actual → By activity, the "See it by month" door under the table | Interaction | a text-link button at 19px tall on a phone | `--tap-min` | pre-existing on a view the sweep first reached 2026-09-06; footnote doors take the floor |
| **F-23** | Roster, development history, attendance, bills — inline text links inside a card or row (a player's name, a tab link) | Interaction | 19–22px tall on a phone | an inline link is a control and takes the floor, or the card becomes the door and the link stops being one | pre-existing baseline debt that sat without a reason; recorded 2026-09-06 |
| **F-24** | **Every coach list table** on the shared frame — Roster, Dues (all three views), Club, Fundraisers, Documents, Attendance, the register, the season-end shelves | Ground | heading painted `--card-bg`; rows transparent; frame transparent → **the blueprint grid showed through the body under a white heading bar**, both skins (measured 1440 warm + dark, 2026-09-16: `thBg` white / `rowBg` 0,0,0,0 / wrapper 0,0,0,0). The 2026-09-06 inventory recorded the same numbers on every one of them | the frame paints the card; rows transparent over it; the frame stands down at ≤ 640 where rows become cards | the standard was derived from the money grid, which paints its own cells, and "sits on the card ground" was written without naming who paints it; the gate verified the row's transparency and never the ground behind it. The Development pages noticed Money "on white", believed it, and grew a private card class (`.devTableCard`) that also painted a white slab behind the phone's stacked cards — **LANDED 2026-09-16** (frame painted; private class retired; seven wrappers). ⚠ **The same day, the owner showed Awards and Playing Time still on the paper: the six Insights report tables sat in their OWN wrapper** (`.insightsTableWrap` — `overflow-x: auto` and nothing else: no border, no radius, no ground — F-14's "one frame" had never reached it) **and the tryout history table sat in the scroll frame** (`.scrollX`, border but no ground). Both frames paint the card now (the report wrapper composes `.tableWrap`; the bare scroll variant stands down). **Its twin:** the Playing Time share bar's track was the card tone — white — and vanished on the card; it is the neutral wash now. **The Awards Leaderboard became a TABLE** (# · Player · Awards · Total) on the same frame as the history under it — it was a div stack borrowing the Tags settings row, unmeasured by the inventory, and a reader compares its totals across rows, which is the standard's own test for a table (§3.8); as one it takes the frame, heading, density and figure twin with no recipe of its own. |
| **F-25** | Insights → Development — Coverage and the records-behind-the-chart table (`.devBoardTable`) | Vertical alignment · density · face | cells **top**-aligned (the one recipe of four that was); rows **58px** on a compact table (Dues beside it: 37) because the "Progress →" link carried a 44px tap box with no negative margin; the date, the tick, the source and the door in the **data face** | centred (§3.4, an axis the standard had not named); a link inside a row borrows its box from the row (§3.6, `.rowTapLink`); body face on everything that is not a measurement (K-20) | a per-feature recipe built the week after the standard, on an axis the standard was silent on and with a second in-row link recipe one file away from the first — **LANDED 2026-09-16**: rows 58 → 37, twelve players on one screen |
| **F-26** | **Schedule → List view** (`eventChip` under `calMonthLabel`) | Ground · density · hairline · label row · mark | sixteen 31px white chips on the paper with 6px gaps (the grid between them), no hairline, a 3px colour rail on each, month kickers on the paper above each stack; **the row is a 736 × 31 control at 768** (under `--tap-min`) | one frame on the card; compact rows (≈ 38) with `--home-line`; months as **band rows** inside the frame; the type icon is the one lead mark (the rail stays in the calendar cells — K-21); `--tap-min` at ≤ 768 | the chip was drawn for a calendar cell and then reused as the list's row; nothing in the standard said a list needs a floor or a ground. Ruled Q2a + Q4 as drawn, **LANDED on dev 2026-09-16** (session B1): one `CoachRowList` with month bands, 37px rows, the rail gone from the list face, the calendar cells untouched; the 15 baseline entries for the 31px rows at 768 pruned |
| **F-27** | **Practice plans hub and Lineups hub** — the shared event row (`CoachEventListRow` / `lineupFrontRow`) | Ground · type (face) · hairline · hover | 73px white cards on the paper, 9px gaps, blueprint/olive border, shadow, hover **lifts** −1px and tints `--white-10` (a brown line-tint in warm); the day tile at **`--type-title` in the display face, 800** — a row larger than the section heading; title `--type-heading` | one frame with "Coming up / Recent" as band rows; comfortable rows (two lines); the date as a **date column** — `--type-body` tabular tertiary, fixed width; the title `--type-body` 600; hover `--home-olive-soft` + pointer only; the worded door stays (stage 0 D3's vocabulary — K-19's shape) | the component was extracted from Lineups as a card idiom (2026-08-15) before the standard existed; the practices re-evaluation redrew the page around it four times and never the row. Ruled Q2b/Q2c/Q2d as drawn, **LANDED on dev 2026-09-16** (B1): `CoachEventListRow` renders through `CoachRow`; both hubs are one frame with two bands; the Run practice / Game day pills sit BESIDE the row inside its `<li>` |
| **F-28** | **Lineups → Templates** (`lineupTplRow`) | Ground · hairline · control size | the same card shape; Apply at 70 × **33** and two 38 × 38 icons at 768 | on the same frame as the games list; comfortable; `--tap-min` at ≤ 768 (K-12) | drawn with the games list's card. **LANDED on dev 2026-09-16** (B1): the name is the link on the roster's quiet-underline recipe, Apply · Rename · Delete clear `--tap-min` both ways at ≤ 768; the apply-to-game picker inside the modal is the same rows as buttons (inset) |
| **F-29** | **Insights → Scouting Book** (`scoutRow`) | Ground · hairline · hover | 68px white cards on the paper with 8px gaps, one tab from Results and Awards, which sit on the card frame since F-24 — two treatments on one tab bar; hover lifts | the frame; comfortable rows (name + last-met); hover tint only; the record chip keeps its recipe | "list rows follow the lineupFront idiom" (its own comment, 2026-08-04) — it inherited the card. Ruled Q1 as drawn, **LANDED on dev 2026-09-16** (B1, the first list on the component; the `list-ground` gate was broken on purpose here and reported it by name). The record chip's fill is mixed over the card token now — a translucent tint over the phone's card wash had put its red ink at 4.06:1. ⚠ **Owed to B2 (the opponent page, F-40):** its `.scoutMeetingRes` chips carry the same translucent tint, and a dozen other tone chips in the module do too — the deeper fix is one tone-fill token (`color-mix` over the card) every `data-tone` / `data-status` chip reads, decided when B2 touches the next one |
| **F-30** | **Tournaments — entries** (`CoachRegistrationCard`, shared with the free portal's Overview card) | Ground · hairline · type | `--surface` cards with `--border`, 1rem × 1.25rem padding, title `--type-heading`, gap 0.5rem; **unrendered** on the fixture (no entry), stylesheet-read | the frame; comfortable; title `--type-body` 600; the lifecycle chip / status badge keep their recipes. ⚠ The free portal's Overview shows ONE of these as a card — that is a tile (bin C) and keeps the card face; the component grows a list face | the card was "promoted to the single design" for both a list and a lone card (A3.3). Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-31** | **Email families → Recent announcements** (`AnnouncementEditor .row`) | Ground · hairline · lead mark | `--surface-2` card rows with `--border-2` and a 38 × 38 status tile, 0.5rem gaps, inside the log card (a card-on-card the file's own comment tried to avoid); **unrendered** (none sent) | hairlined rows on the log card (the card is the painter); the status icon as the one lead mark at icon size; the fold stays a real button (K-07 ✓) | drawn with its feature. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-32** | **Player → This season — Last N sessions · Awards** (`miniRow`) | Ground (a tint on an item row) · hairline | 41px pills — `--home-olive-soft` fill, `--border-2` border, 8px radius, 5px gaps — on the section card | compact hairlined rows on the section card (the card is the painter); the label line stays ("Last 10 sessions" is the list's name, §1); the attendance badge keeps its recipe. Stays a row list, not a table: the stat boxes above answer the column question (§3.10) | drawn as "compact recent-sessions list" before any list had a recipe. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` — panel Q3 |
| **F-33** | **Player → Notes — observations** (`noteRow`) | Face | the date at `--type-support` in the **data face** | body face (§3.2 — a date is not a measurement; F-25's ruling on the same axis) | the note row was drawn beside the metric grid. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-34** | **Player → Family — guardians** (`FamilyCard .row`) | Hairline | rows separated by 0.6rem margin, no rule; **unrendered** (no contact on the fixture player) | `--home-line` under every row but the last; density by content | a two-row card that grew rows. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-35** | **Coaching staff** (`CoachStaffPanel .row`) | Type · control box · frame token | the name at **16px inherited** (nothing on the row sets a size — F-01's mechanism on a list row); "Edit access ›" a 36px box on a desktop and a 44px block at ≤ 768 (its own media rule, not `.rowTapLink`); the list's frame border is `--border` (`--home-line-strong`), not `--home-line` | `--type-body` 600 on the name; the door composes `.rowTapLink`; the frame token. **Already on the recipe's shape** — the list paints its own card, rows are hairlined, two lines per person | rebuilt 2026-09-11 (pass 2) with the standard's ground and without its sizes. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-36** | **Notifications feed** (`notifications-page.module.css` — shared with the admin page) | Type (ladder) | title 0.88rem (14.08), body 0.8rem (12.8), day header 0.64rem (10.24) in the data face — literal rems in a module the admin page also renders | `--type-body` 600 · `--type-support` · the day header as §3.10's band row (`--type-support`, display face, 700, secondary). **Already on the recipe's shape** (frame, card, hairline, band, hover on a target). ⚠ The row is a `<div>` with a click handler, not a button — that is the redraw's open item R8, not this recipe's | the feed body is one module for two shells and the admin shell still uses literals. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` — a 0.08px change the guard needs, not the eye |
| **F-37** | **Closed season — the three shelves' rows** (`seasonRecordRow` · `seasonDoorRow`) | Density by content · hover · a rule | roster rows at 44px for one line (comfortable padding on a compact row); the practices rows are links with **no hover** on a row that opens; the results rows carry a 2px left rule (`--border-subtle`) no other list has | compact where one line, comfortable where `<small>` composes `.rowCaption`; `--home-olive-soft` + pointer on the practices doors; no left rule (the month fold is the structure — K-23). **Already on the ground** (the shelf paints it) and already tabular-right on the score. Stays a row list: the answer strip carries the season's comparison (§3.10) | drawn in the closed-season session (2026-08-18) before the density rule. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` — panel Q3 |
| **F-38** | **Roster → Off the roster** (`offRosterRow`) | Ground · hairline | a dashed fold on the paper under the carded roster table; the row hairline is **`--white-05` → paper on paper** in warm (F-02's bug, on a list row); the name in `--text-secondary` | the fold paints `--card-bg` when open (it is the painter — K-24 keeps its dashed edge); `--home-line` under the rows; the name at the item line's ink | the fold was drawn as a "quiet" shelf and the quiet came from the paper. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-39** | **Settings → Tags — a library's words** (`tagDrawerRow`) | Type | the word at **16px inherited** | `--type-body` 600. The libraries list above it (`tagShelfRow`) is **already on the recipe**: a real `<button aria-expanded>`, 44px, `--home-line`, olive-soft hover, on the Settings shelf card — it adopts the component and changes nothing visible | nothing on the row asks for a size. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` |
| **F-40** | **An opponent's page — their results this season** (`scoutIntelRow`: result · score · vs · date) | Shape (bin A) | four same-kind columns as flex rows, the score in the data face; **unrendered** on the fixture | a `<table>` on the shared frame when the page is next touched — a reader compares results across rows and no answer strip sits above them (§3.10's test); no recipe needed | drawn as a card's inner lines. Ruled as drawn 2026-09-16 (owner: "agree with your mockups"); the build is session B2 of `COACH_ROW_LIST_RECIPE_PLAN.md` — panel Q3; low priority, its own reader is rare |

## ASK — ALL RULED. A-01 to A-07 on 2026-09-06 and A-08 on 2026-09-07, every one the recommended way ("proceed with your recommendation")

| Id | Question | Recommendation | Alternative | What changes on screen |
|---|---|---|---|---|
| **A-01** | **Density by content** — one-line list rows (Dues season totals, Fundraising, Club, Bills) go compact (≈ 40px from 47); two-line rows stay comfortable | Yes — it is the rule the one-surface plan §9.1 argued for and the only one that cannot drift | keep every list row comfortable and record it (K-15) | ~15% shorter list tables on the four money tabs; the mockup shows both |
| **A-02** | **Platform admin body size** — cells render 15px today because of F-01; the sheets declare 12px | `--type-body` (14) in the data face | the declared 12px (`--type-support`) | every platform table gets one size instead of the two it has now |
| **A-03** | **The register's zebra** — it has never rendered | delete the rule; the product has shipped without banding for three weeks and nobody noticed | define the band (`--home-fill`) and keep it as part of K-01 | none today; a faint band on even rows if kept |
| **A-04** | **Fold memory** — the Budget list remembers what you closed; the report always opens folded (raised in the §146 docs pass) | worklists remember, reports open on their totals; the guide says which is which | one behaviour everywhere | none; a sentence in the help |
| **A-05** | **Public tables** (standings, pricing) — adopt the standard's tokens; keep fan-facing comfortable density? | adopt heading/hairline/hover tokens; keep 16px padding as K-16 (public comfort) | full standard including compact rows | headings and hairlines change; row height does not |
| **A-06** | **Column heading face** — the condensed display face is today's de-facto rule in every shell (it comes from the global `th` rule, not a decision) | keep it, and write it down | body face uppercase | none if kept |
| **A-07** | **The private money ladder (K-02)** — documented exception, or fold into the app ladder? | keep as K-02 | fold: lines to `--type-support`, categories to `--type-body` | none if kept; smaller money figures if folded |
| **A-08** ✅ RULED 2026-09-07 | **The admin shell's control height inside a table at touch widths.** The standard says a control inside a table clears `--tap-min` (44px) both ways at ≤ 768; the admin shell's own density ruling (2026-06-02) sets its comfortable control height to **38px** (`--admin-control-h`), which is what Check-in's row controls measure (F-16). Two standing rulings disagree by 6px. | keep the shell's 38px and record it as **K-18** — the admin shell's density system is its own owner-ruled instrument, and the standard should not overrule it by accident | raise `--admin-control-h` to 44px in comfortable mode, shell-wide (every admin control on touch, not only tables) | **none — the shell keeps its 38px, recorded as K-18.** ⚠ No gate changed, and that is the thing to know: `check:layout` sweeps coach and marketing screens only, so no admin control has ever been measured against the 44px floor. The conflict was between two written rules, not between a rule and a screen. **When the admin shell joins the sweep, K-18 is the reason those rows carry — not a baseline entry with a null reason.** |

## How to use this register

- Before styling a table, find its recipe in the standard's §5 and its rows here. If the surface
  needs to differ on an axis with no row, **add the row first** (KEEP with a reason, or ASK).
- A reviewer who sees a table differ from the standard asks for the register id. No id, no merge.
- A KEEP row's last column is the contract: the axes listed there follow the standard *exactly*, and
  a change to one of them is a FIX row, not part of the exception.
- Rows are never deleted. A FIX that lands moves to the changelog at the foot with its commit; an
  ASK that is ruled becomes KEEP or FIX in place.

## Changelog

- 2026-09-06 — register written from the rendered inventory.
- 2026-09-06 — owner approved the standard, the mockups and A-01–A-07 as recommended. **Built on
  `dev` the same day** (plan `docs/projects/active/APP_WIDE_TABLE_CONSISTENCY_PLAN.md`):
  - **F-01 · F-03 · F-11** — the global `th`/`td` baseline in `app/globals.css` now IS the standard
    (ladder sizes on the cell, `--text-*` ink, `--home-line` rules, compact density tokens); the
    global row hover is deleted; the light-mode heading ground override is deleted.
  - **F-02 · F-04 · F-09 (tabular half) · F-10 · F-14 · F-15 · A-01 · A-03** — the coach list
    family: neutral frame, `--home-line` row rule, density by content via `:has()` on the four
    caption classes, hover only on `.rowTappable` (Player Dues rows now carry it), the register's
    two zebra rules deleted and its `--white-4` replaced, insights tables tabular with a card
    heading ground, devBoard headings on the baseline.
  - **F-05 · F-06 · F-12 (Orgs + Users) · A-02 · K-10** — the platform console: one shell recipe
    (`.shell table` in the data face); fourteen modules stripped of every declaration the baseline
    owns; generic hover rules deleted, clickable-row hovers at lime 6%; `.table-cards` published
    as a global recipe and applied to Orgs and Users. Tail still open: cell-level literals inside
    platform cells (`.tsCell`, `.emptyCell`…) — judged by the rendered `type-ladder` rule.
  - **F-07** — tournament admin headings: the flat-row label row, the schedule health and preview
    tables, the role matrix and the notifications table all take the baseline heading (K-17 keeps
    the label row's face and ground).
  - **F-08 · F-19** — the Months view's figure doors clear `--tap-min` both ways at ≤ 768; the
    category toggle's hit box is the whole lead cell; and two touch floors gated at 640 moved to
    768 (K-12) — the by-period grid's expanders measured 20px wide at 768 the day the width rule
    was born.
  - **A-05 · F-20 · K-16** — standings, results and the pricing comparison on the ladder's heading
    and body tokens; 16px padding kept.
  - **Enforcement** — `tests/unit/table-recipe-guard.test.ts` (ladder membership + every named
    token must exist; it caught `--white-15` in the team budget items table on its first run);
    `check:layout` rules `control-width` and `type-ladder`; a `storage` hook on sweep entries and
    three new entries for By activity, Months and By period.
  - **Not built, with reasons:** F-16 → A-08 (a shell ruling, not drift); F-17 (own session, own
    frames); F-18 (no fixture); F-12 beyond Orgs and Users (twelve tables, one file each).
- **2026-09-06, after the build — `/simplify`, `/review`, `/docs` (all three run the same day).**
  - `/simplify`: one `.rowCaption` marker (the five caption classes `composes` it) replaces five
    `:has()` selectors; one `--pa-row-hover` token replaces four literal hovers; the two 768 touch
    blocks are one; the sweep's tap-floor and control-width loops are one pass; the guard reads
    each stylesheet once.
  - `/review` (high-risk tier — cascade, blast radius, gate integrity, accessibility): **the
    stylesheet guard anchored `font-size` to the start of a line** — a size written after another
    declaration on the same line passed — **and missed `.periodTh`/`.periodTd`**. Rewritten as an
    index-based scanner with a self-test of the old blind spot; on its next run it caught
    `families.module.css` (F-18, pinned). Also fixed: the dues drill-down rows had lost
    `.rowTappable` hover parity; `[data-help-surface]` had no `--text-*` aliases, so cells on the
    help surface resolved to nothing; `.table-cards` controls take `--tap-min`; the Months figure
    doors keep a visible underline where hover cannot exist; `.moneyGridToggle` width; three
    comments and two `data-touch-floor` attributes still describing the retired opt-in hook
    (dead — no stylesheet selected it; the dead-selector gate cannot see a dead attribute).
  - Rendered sweep of the 25 remaining screens at four widths: **zero `type-ladder` findings**;
    27 `control-width` and 4 shared-chrome `tap-floor` findings baselined under F-21 with the
    reason written. **49 screen-specific `tap-floor` / `content-overflow` misses left RED, not
    baselined** — none in a table, none new (25–37px controls that had simply never been measured
    in this fixture state): Coaching staff's eight row buttons at 361/390/768, "Share your season"
    on the four closed-season shelves, the opponent "Tag this observation" select, the bill room's
    item picker input, one schedule item at 768, Lineups' "Tournament", Practice plans' "Needs a
    plan", and the "Switch team" select spilling at 1440 on the closed-season pages. They belong to
    their screens, not to this register.
  - `/docs`: no help sentence describes a table the product no longer draws (the money guide's own
    keywords already say "shaded row means a heading"); the A-04 sentence gained its search terms.
    The demo dock lines and tour narration name no table furniture.
  - **Landed:** `07321b4a` on `dev`, 2026-09-07 — 50 files; the ledger and the decisions log were staged by
    hunk so no other session's work rode along.
- 2026-09-07 — **✅ OWNER QA §149 PASSED, 40/40, all ten parts.** One defect on the walk (below),
  fixed in-walk.
- 2026-09-07 — **A-08 RULED as recommended: the admin shell keeps its 38px control height inside a
  table, recorded as K-18.** The register's ASK column is now empty — A-01 to A-08 are all ruled.
  Two standing rulings had disagreed by 6px (the shell's own 2026-06-02 density ruling vs this
  standard's `--tap-min`); the shell's density is a system the owner tuned across every control it
  owns, and a table is not a reason to overrule it. ⚠ **Nothing on screen changes and no gate moved.**
  `check:layout` sweeps coach and marketing screens only — no admin control has ever been measured
  against the 44px floor — so this was a conflict between two written rules, not between a rule and
  a rendered screen. **K-18 is what those rows cite when the admin shell eventually joins the
  sweep**, instead of arriving as findings someone baselines with a null reason.
- 2026-09-07 — **F-09 CLOSED, and it took a regression from the commit above to close it** (owner
  QA §149; plan §6.1). P2 gave `.insightsNum` its `text-align: right` and gave the column headings
  nothing, so every figure column on Playing Time, Results and Which-lineup-wins was headed hard
  left over hard-right figures — columns that had at least been *consistently* left before the pass.
  Fixed with `.insightsNumHead`, the heading twin `.thNum`/`.tdNum` has had since August, written
  `.insightsTable th.insightsNumHead` so it wins on specificity rather than source order.
  - The same reading found `.insightsNum` applied to six columns that are **not figure columns**:
    the Results and Awards **Date** columns (standard §3.4 says dates left — and on Results it is
    the first column, so the date was shunted rightward into the game name), and four
    figure-plus-words columns (Playing Time's Pitching; Arm care's Season, Last outing, Your
    per-game cap). All six returned to left; the dates take the existing `.tdShrink`.
  - "On field"'s 64px share bar now **leads** its figure — trailing, it owned the column's right
    edge, so a right-aligned heading would have pointed at the bar and left the digits floating.
  - `.ptMatrixHead` dropped its `!important`; it only ever needed the specificity the new pair
    establishes.
  - **Three rules generalised into the standard §3.4:** a column's heading goes where its figures
    go; a column earns right alignment only if every row ends at the same semantic place; and a
    bar/chip/glyph beside a figure must lead it in a right-aligned column.
- 2026-09-16 — **F-24 and F-25 found and LANDED; K-19 and K-20 recorded** (owner: "the top
  alignment in the tables is not consistent… why is the roster table not following our table
  conventions and having a transparent background?"; measured on the served page at 1440 and 390,
  both skins, before and after).
  - **F-24 — the list family never sat on the card.** The standard's "table sits on the card
    ground, rows transparent over it" named a ground nothing painted: the heading painted its own,
    the rows and the frame painted nothing, and every list table drew a white heading over a body
    the blueprint grid showed through. The 2026-09-06 inventory *recorded* it and §149 passed —
    the gate checked the row's transparency and never the ground behind it. The shared frame paints
    the card now and stands down at ≤ 640 (the card is the ground there). The Development pages'
    private card class — grown a week earlier to match a Money "on white" that was not — is
    retired from seven wrappers; it had also painted a white slab behind the phone's stacked cards.
    **Second pass the same afternoon** (owner: "these don't look updated", on Awards and Playing
    Time): the six Insights report tables had their own frameless wrapper and the tryout history
    table sat in the scroll frame — neither took the list frame's fix. Both frames paint the card
    now; the Insights wrapper composes the list frame ("one frame", F-14, finally true). The Playing
    Time share bar's white track — visible only because the table sat on the paper — is the neutral
    wash now (change one half of a paired treatment, go find the twin). The Awards Leaderboard —
    a div stack the inventory never measured, borrowing the Tags settings row — is a table now
    (# · Player · Awards · Total): a reader compares its totals across rows, the standard's own test.
    ⚠ **F-17 (the row lists) is still open and its list is STALE**: the practice plans list was
    redrawn twice by the practices re-evaluation (2026-09-14 → 16), the leaderboard was never on it,
    and the inventory it cites is ten days old — re-measure before that session decides anything
    (`docs/projects/active/COACH_ROW_LIST_RECIPE_F17_PROMPT.md`).
  - **F-25 — the Development report table was the one recipe of four that top-aligned**, on an
    axis the standard had not named; its rows stood at 58px on a compact table because the
    "Progress →" link carried a 44px tap box with no negative margin, one file away from the name
    link that already borrowed its box from the row. Centred now (§3.4 names the axis), the in-row
    link recipe is one marker (`.rowTapLink`, §3.6) both links compose, the last-row spill rule
    reads the marker instead of a wrapper class, and the date / tick / source / door left the data
    face. Rows 58 → 37; twelve players on one screen.
  - **K-19** a row with two doors names the second · **K-20** a recorded measurement column may
    keep the data face — and only that column.
  - ⚠ Not touched, on purpose: the Ledger's filter-deck `control-offscreen` findings re-surfaced
    as "new" on this run because their baseline signatures carry dates ("Aug 7 – Oct 6" → "Aug 17
    – Oct 16"); re-accepting them is not a fix (the parked example the review already named).
- 2026-09-16 — **F-17 RE-MEASURED, BINNED AND DRAWN — nothing built** (the planning session the
  prompt `COACH_ROW_LIST_RECIPE_F17_PROMPT.md` commissioned; evidence
  `TABLE_INVENTORY_2026-09-16_ROWLISTS.md`, 23 targets at 1440 · 768 · 390, both skins, the
  ground read from the ancestor). The 09-06 list was stale and impure: one class had left the
  page (`railItem` — the staff list was rebuilt 09-11), four were never lists (a form, a
  checklist, a stepper, a menu), one was the shelves themselves. What is left is **two species**
  — seven gapped card stacks on the paper (the hubs, Lineups' templates, the Schedule list, the
  Scouting book, Tournaments, Announcements) and nine hairlined lists, eight already on a card
  something else paints. **Standard §3.10** writes the recipe (exactly one painter of the ground;
  a row is not a card; density and type from the tables' own markers; the band row; one lead mark;
  a component, not a class; the column test for when a list is a table). **F-26–F-40** are the
  per-list FIX rows, **K-21–K-24** the KEEPs (the calendar-cell chip, the unread tint, the month
  fold, the dashed off-roster fold), and F-17 itself now records the six bin-C removals. Every one
  is marked PROPOSED: the owner's rulings are on the hub artifact's decision panel
  (`docs/projects/active/COACH_ROW_LIST_RECIPE_HUB.html`; plan `COACH_ROW_LIST_RECIPE_PLAN.md`).
- 2026-09-16, later — **RULED AS DRAWN (Q1–Q6, "agree with your mockups") and session B1 LANDED on
  dev**: `CoachRowList` / `CoachRow`, the "THE ROW LIST" stylesheet block, the three gate extensions
  (the guard's `rowList` family; `type-ladder` over rows; the new `list-ground` rule that reads the
  first painted ancestor — broken on purpose once and reported by name), F-26 (the Schedule list),
  F-27 (both hubs), F-28 (Lineups templates + the apply picker), F-29 (the Scouting Book); K-21
  recorded; F-30–F-40 and K-22–K-24 ruled and owed to session B2. /simplify, /review (11 fixes; one
  ordering constraint: the §194 frame hunks commit first) and /docs run; ledger §197 holds the walk.
  The seven rows above read "LANDED" or "Ruled … B2" accordingly.
