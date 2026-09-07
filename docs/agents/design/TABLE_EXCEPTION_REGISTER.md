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
| **F-09** | Playing-time and results insights tables; devBoard tables | Alignment | figures start/centre-aligned; devBoard figures right but not tabular | right + tabular | the insights recipe sets no number treatment (the same gap `.tdNum` closed for the money lists in August) |
| **F-10** | Coach list tables | Frame | accent-tinted frame (`rgba(--blueprint-blue-rgb,.15)` → olive in warm) vs the grids' neutral `--home-line` | `--home-line` | noted in the one-surface plan §9.2 |
| **F-11** | Admin dashboard registration table; tournament admin Manage; Manage's team list | All | the raw **global** recipe: 12.8px `--white-60` headings, 15px cells, 14px padding (87px two-line rows, 56px one-line) | shell recipe | no class on the table at all — the global rule *is* the recipe |
| **F-12** | Platform admin at 390 | Responsive | no card shape; sideways scroll with rows wrapping to **121–392px** (orgs, email templates, customer users) | cards for a list, scroll for a comparison; A-02 asks whether the phone matters here | the shell has no `tableAsCards` equivalent |
| **F-13** | Admin → Budget (empty) | Empty state | a heading row (`ITEM · CATEGORY · TEAM · USED BY`) drawn over an empty body with no sentence | one sentence + one action, no heading row | — |
| **F-14** | Coach list tables | Structure | the frame's `.tableWrap` radius/border differs from the report card's | one frame | — |
| **F-15** | devBoard tables (development board, history, season-end shelves) | Heading type | 11px **mono**, tertiary ink, `--white-10` rule | `--type-support` display, secondary ink, `--home-line` | a per-feature recipe |
| **F-16** | Tournament admin Check-in at 390 | Interaction | row controls **34 × 38px** | `--tap-min` both ways | ⚠ not built — the admin shell sets its comfortable control height to 38px by its own ruling (2026-06-02), so this is a shell decision, not drift: **moved to A-08** |
| **F-17** | Coach row lists — schedule (31px, 12px), practice plans / lineups (73px, 20px display 800), season-end shelves (38/44px), tags (71px), notifications (102px), scouting (68px) | Density · type · hairline | six row treatments for one job (a stacked list of records) | one row-list recipe: comfortable density, `--type-body`, `--home-line`, uppercase `--type-support` label row when present | each list was drawn with its feature |
| **F-18** | Club admin `<table>` modules — members, families, house league, accounting, rep teams, budget/bva | Type · ink · hairline (from stylesheets; **not rendered**) | headings 0.63–0.7rem at `--white-30/40`; cells 0.85–0.88rem; hairlines `--white-05` / blueprint tints; cell sizes left to the global rule | the standard | no fixture can render them (standard §7); fix when one can, and re-measure first |
| **F-19** | Money grid category toggles (desktop) | Interaction (target width) | the toggle is as wide as the category's name — "Gear" exposes a far smaller keyboard/AT target than "Tournament entry fees" on the same table | the hit box is the whole lead cell | shipped 2026-08-13 with the month grid; the gate reads height only |
| **F-20** | Public pricing comparison | Density · heading | 0 vertical padding (30px rows), 9.6px headings | ladder tokens; comfortable density (public) | marketing page built before the ladder |
| **F-21** | Coach portal chrome around tables — the tab-bar scroll arrows (34px), the help "?" (34px), the Months pager (36px), the roster drag grip (23px) | Interaction (target width) | icon-only controls narrower than `--tap-min` at touch widths | `--tap-min` both ways | surfaced by the `control-width` rule the day it was born (2026-09-06); accepted into the layout baseline with this id; not a table part — each is its own fix (COACH_TOUCH_TARGET_DEBT_PLAN) |
| **F-22** | Budget vs. Actual → By activity, the "See it by month" door under the table | Interaction | a text-link button at 19px tall on a phone | `--tap-min` | pre-existing on a view the sweep first reached 2026-09-06; footnote doors take the floor |
| **F-23** | Roster, development history, attendance, bills — inline text links inside a card or row (a player's name, a tab link) | Interaction | 19–22px tall on a phone | an inline link is a control and takes the floor, or the card becomes the door and the link stops being one | pre-existing baseline debt that sat without a reason; recorded 2026-09-06 |

## ASK — A-01 to A-07 RULED 2026-09-06, every one the recommended way (owner: "proceed with your recommended updates"); A-08 raised by the build and OPEN

| Id | Question | Recommendation | Alternative | What changes on screen |
|---|---|---|---|---|
| **A-01** | **Density by content** — one-line list rows (Dues season totals, Fundraising, Club, Bills) go compact (≈ 40px from 47); two-line rows stay comfortable | Yes — it is the rule the one-surface plan §9.1 argued for and the only one that cannot drift | keep every list row comfortable and record it (K-15) | ~15% shorter list tables on the four money tabs; the mockup shows both |
| **A-02** | **Platform admin body size** — cells render 15px today because of F-01; the sheets declare 12px | `--type-body` (14) in the data face | the declared 12px (`--type-support`) | every platform table gets one size instead of the two it has now |
| **A-03** | **The register's zebra** — it has never rendered | delete the rule; the product has shipped without banding for three weeks and nobody noticed | define the band (`--home-fill`) and keep it as part of K-01 | none today; a faint band on even rows if kept |
| **A-04** | **Fold memory** — the Budget list remembers what you closed; the report always opens folded (raised in the §146 docs pass) | worklists remember, reports open on their totals; the guide says which is which | one behaviour everywhere | none; a sentence in the help |
| **A-05** | **Public tables** (standings, pricing) — adopt the standard's tokens; keep fan-facing comfortable density? | adopt heading/hairline/hover tokens; keep 16px padding as K-16 (public comfort) | full standard including compact rows | headings and hairlines change; row height does not |
| **A-06** | **Column heading face** — the condensed display face is today's de-facto rule in every shell (it comes from the global `th` rule, not a decision) | keep it, and write it down | body face uppercase | none if kept |
| **A-07** | **The private money ladder (K-02)** — documented exception, or fold into the app ladder? | keep as K-02 | fold: lines to `--type-support`, categories to `--type-body` | none if kept; smaller money figures if folded |
| **A-08** ⚠ OPEN | **The admin shell's control height inside a table at touch widths.** The standard says a control inside a table clears `--tap-min` (44px) both ways at ≤ 768; the admin shell's own density ruling (2026-06-02) sets its comfortable control height to **38px** (`--admin-control-h`), which is what Check-in's row controls measure (F-16). Two standing rulings disagree by 6px. | keep the shell's 38px and record it as **K-18** — the admin shell's density system is its own owner-ruled instrument, and the standard should not overrule it by accident | raise `--admin-control-h` to 44px in comfortable mode, shell-wide (every admin control on touch, not only tables) | none if kept; every admin control on a phone grows 6px if raised |

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
