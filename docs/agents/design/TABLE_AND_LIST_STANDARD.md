# Table & list standard

**Status: APPROVED by the owner 2026-09-06 ("proceed with your recommended updates"), with all
seven register decisions as recommended; the §8 fix work was built on `dev` the same day (the
register's changelog says what landed). The global th/td baseline in `app/globals.css` now IS this
standard.** Commissioned by the owner out of Owner QA §146 part F3; prompt in
`docs/projects/active/APP_WIDE_TABLE_CONSISTENCY_REVIEW_PROMPT.md`. Evidence:
`TABLE_INVENTORY_2026-09-06.md` (rendered, 74 surfaces). Departures: `TABLE_EXCEPTION_REGISTER.md`.
Mockups (true-size before/after, both skins, 390 + 1440) and the owner's decision panel:
https://claude.ai/code/artifact/0aa319dd-a6eb-4fff-b09b-df8591475fe1

> **The governing rule — one axis of difference does not license the others.** A surface may
> deviate from this standard on a *named* axis, for a *stated* reason, recorded in the register.
> Every axis it did not claim an exception on follows the standard exactly. A difference between two
> tables is either in the register or it is a bug; there is no third category.

This is a living reference (it evolves in place, never archived). It is written in **tokens and
relationships**, never literal pixels, so a new screen can follow it without copying an existing file
— and so a guard can hold it (§9).

---

## 1. What this standard covers

Every surface that lays **rows of records** out for reading, in every shell: coach money and the
coach portal, club admin, tournament admin, platform admin, public and marketing tables — and each
one's phone fallback. Not covered: forms, dashboards and stat tiles, charts, navigation, card grids
(a grid of team cards is records but not rows; it gets its own treatment).

There are two physical shapes and the standard treats them as one thing:

| Shape | What it is | Where it lives today |
|---|---|---|
| **Table** | a `<table>` with a heading row | 77 files |
| **Row list** | stacked `<div>`/`<li>` rows under an optional label row | the admin shell's flat rows, the coach schedule and practice lists, the sandbox's team list |

A row list follows every rule below that applies to a row; the only thing it may lack is a heading
row, and then its first line must say what the list is. **§3.10 names the axes a row list had no
sentence for** — who paints its ground, that a row is not a card, the band row, the one lead mark —
and the test for when a row list is really a table.

## 2. Vocabulary — the row roles

Every row on every surface is exactly one of these. A recipe styles **roles**, never screens.

| Role | Job | Example |
|---|---|---|
| **Column heading** | names a column | `Player · Billed · Paid · Balance` |
| **Band heading** | names a half of a statement; carries no figures | `REVENUE` / `EXPENSES` |
| **Group row** | a parent whose figures are the sum of the items under it; folds | `Tournaments  $2,500.00` |
| **Item row** | one record | a bill, a player, a budget line, an org |
| **Sub row** | a line under an item that only exists to explain it | a dated period under a budget line |
| **Total / closing row** | the answer the table exists to give | `Season net`, `Ending balance` |
| **Meta / caption** | a quiet line about the table | `Whole season · 3 of 12 families behind` |
| **Empty state** | the table with nothing in it | `No bills yet — add one` |

## 3. The standard, axis by axis

### 3.1 Density — chosen by what a row HOLDS, never by which screen it is on

| Density | A row that holds… | Cell padding (vertical) | Rendered row (body size, one line) |
|---|---|---|---|
| **Compact** | one line — a name and its figures | `--table-pad-compact` (the money grid's `0.42rem`) | ≈ 38–40px |
| **Comfortable** | two lines (name + caption) or a worded control | `--table-pad-comfortable` (the list recipe's `0.7rem`) | ≈ 47px one-line · ≈ 65–69px two-line |
| **Register** | a season of one-line entries across ≥ 7 columns | `--table-pad-register` (`0.28rem`) | ≈ 25–28px |

Rules:
- A screen picks a density by the rule above and states it once on the table, not per row. A
  per-screen rule drifts the first time the screen gains a two-line row; a content rule cannot.
- **Register density is an exception a surface must claim** (register row K-01). It is for a
  read-across-many-rows register — the Ledger's Timeline today — and nothing else takes it without
  a register entry.
- Horizontal cell padding is one value per density; the pinned first column owns its own leading
  gutter (`--scrollx-pin-gutter`), including any hierarchy indent.
- **At touch widths (≤ 768) a row that carries a control is at least `--tap-min` tall**, because
  the control inside it is. A row with no control keeps its density.
  - ⚠ **One exception, and it is named: the admin shell and platform console keep their own 38px
    control height (K-18, owner A-08 2026-09-07).** That shell's density is an owner-ruled system
    across every control it owns; a table is not a reason to overrule it, and raising it here alone
    would put two control heights on one admin screen. The 6px is deliberate — do not "fix" it.
- Two heights on one surface are only ever *compact + comfortable by content*. Three heights side by
  side is the defect §9 of the one-surface plan made visible.

### 3.2 Type — role-named tokens, and relationships between roles

The app ladder is the eight `--type-*` tokens. **A table never mints a size.** Where a role needs a
size the ladder lacks, that is a register entry (K-02 is the only one today).

| Role | Size | Face | Weight | Case / tracking | Ink |
|---|---|---|---|---|---|
| Column heading | `--type-support` | display face (`--font-display`) | 700 | uppercase · `0.05em` | `--text-secondary` |
| Band heading | `--type-label` | body face | 700 | uppercase · `0.09em` | accent (`--primary-light`) |
| Group row | **larger than its items** (K-02: `--money-cat-size` in the money grids; `--type-body` at 700 elsewhere) | body face | 700–800 | sentence case | `--text-primary` |
| Item row | `--type-body` | body face | 400 | sentence case | `--text-primary` |
| Sub row | `--type-support` | body face | 500 | sentence case | `--text-secondary` |
| Total / closing row | **the group row's size and weight** — never a fourth rung above it | body face | 700–800 | sentence case | `--text-primary` |
| Meta / caption | `--type-support` | body face | 400 | sentence case | `--text-tertiary` |
| Badge / chip in a row | `--type-token` | data face | 700 | uppercase | semantic |

Relationships (these are what a guard asserts — §9):
1. A group row reads **larger** than the items it groups, and is never set in small caps.
2. A closing row is **the same size** as a group row — set apart by a rule, not by size (owner,
   twice, QA §146).
3. A column heading is **never the faintest text in its own table** — its ink is one step below
   the item ink, on the same ground (owner, 2026-08-15). State the heading's ratio *and* the row's;
   the gap is the finding.
4. Below `--type-support`, roles separate by **case, tracking, weight and ink**, not by size.
5. **The cell decides its own size from the ladder.** A size set on the `<table>` and left to
   inherit is not a decision — the global cell rule wins over it (see F-01). Every recipe sets its
   size on the cell.

Faces: body text is the sans face; **column headings are the condensed display face** (this is
today's de-facto rule in every shell and is kept — A-06 asks the owner to confirm it); the data face
is for badges and, in the admin shells, for figures (K-10) — and, in the coach portal, for **a
recorded measurement column only** (K-20: "8.75 / 8.33 / 8.28" lined up digit for digit, the same
ground the jersey number stands on). A date, a tick, a door or a sentence beside it takes the body
face like every other list's.

### 3.3 Colour — the ground, the tints, the hairlines, the ink

- **Ground.** A table sits on the card ground (`--card-bg`). Body rows are transparent over it;
  **pinned columns are opaque** (`--card-bg`) so scrolled money never reads through a label, and
  therefore every cell of a pinned-column table paints the ground (one declaration on the table,
  never per row type).
  - ⚠ **THE FRAME PAINTS THE CARD, and on a phone it stands down** (F-24, 2026-09-16). "Sits on
    the card ground" names a ground that something has to paint, and for ten days nothing in the
    list family did: the heading painted its own card, the rows painted nothing, the frame painted
    nothing — so Roster, Dues, Club, Fundraisers, Documents and Attendance all drew a white heading
    bar over a body the blueprint grid showed through, in both skins. The inventory *recorded* it
    (row ground: transparent) and §149 passed, because the gate verified the row's transparency —
    which this bullet asks for — and never what was behind it. **A rule that says "over X" is a
    rule about X; measure X.** The shared frame (`.tableWrap`) paints `--card-bg` now; at ≤ 640,
    where rows become cards, the frame sheds the ground with its border — the card is the ground
    there, and a slab behind a stack of tinted cards is a defect (the Development pages' private
    card class shipped exactly that).
- **Tint means structure, and only structure.** A band heading carries an accent wash
  (`rgba(var(--primary-rgb), .10)`); a group row carries the neutral wash (`--home-fill`). An item
  row is never tinted. **No zebra** (A-03 asks the owner to confirm; today's one zebra rule has
  never painted — F-04).
- **Hairlines.** Under every row: `--home-line` (1px). Under the heading row and as the cap over
  a closing row: `--home-line-strong` (1px under a heading; 2px over a total). On a table with a
  sticky column the rule is an **inset shadow, not a border** (K-06). Frame around a table:
  `--home-line`, neutral — never an accent tint (F-10).
- **Ink.** Three tiers only — `--text-primary` / `--text-secondary` / `--text-tertiary` — and the
  white-alpha ladder never dims below `/50` on a dark ground (2026-08-11). `--data-gray` is never
  faded.
- **Status colour appears in a badge, a chip, or on a figure that is genuinely bad news** (a
  negative running balance is red; expected funding is green because its sign is arithmetic). The
  unplanned dash keeps its amber (K-03). Nothing else in a row is coloured.
- **Hover** tints only a row that is a target, with `--home-olive-soft`, and the row takes
  `cursor: pointer`. A row that opens nothing does not change on hover (F-03).
- Both skins are measured for every colour decision: warm remaps `--white-05` to *paper* and
  `--white-10` to `--home-line`, so a rule that looks fine in dark can be invisible in warm (F-02).

### 3.4 Alignment and columns

- Text left; **figures right, tabular** (`font-variant-numeric: tabular-nums`, body face, not the
  data face — 2026-08-13); dates left; a status badge left in its own column.
- ⚠ **A COLUMN'S HEADING GOES WHERE ITS FIGURES GO.** Right-aligning cells and leaving the heading
  left is not half a fix, it is a new defect: the columns were at least consistent before. Every
  numeric cell class ships with a heading twin — `.thNum`/`.tdNum` in the money tables,
  `.insightsNumHead`/`.insightsNum` in the reports. (QA §149, 2026-09-07 — the table-consistency
  pass itself shipped the cell half alone.)
- ⚠ **A COLUMN EARNS RIGHT ALIGNMENT ONLY IF EVERY ROW ENDS AT THE SAME SEMANTIC PLACE.** A cell
  that is a figure followed by *varying* qualifying words — "3 IP · cap 1/g ⚠ over cap ×2",
  "4 innings · 2 games" — is a **text column that begins with a number**: right-aligning it lines
  up the end of a sentence and puts the leading digit at a different x on every row. Those stay
  left and take their tabular figures from the table. A fallback that replaces the whole cell
  ("—", "no scores yet") does not disqualify a column; a varying *suffix* does.
- ⚠ **A bar, chip or glyph drawn beside a figure owns the edge it sits on.** In a right-aligned
  column it must LEAD the figure, or the column's right edge belongs to the decoration and the
  heading no longer points at the number (the "On field" share bar, 2026-09-07).
- **Vertical alignment is centred** (`vertical-align: middle`), on every cell of every recipe
  (2026-09-16). This axis was unnamed until the Development report table top-aligned its cells and
  nothing could call it drift (F-25). Centred is what three of the four recipes already did, what
  the approved Money lists passed §149 with (a two-line Club row beside one-line figures), what card
  mode already does (`align-items: center`), and the only alignment under which a chip, a tap box or
  a control beside text lines up with it. Top alignment earns its keep only on long multi-paragraph
  cells, and this standard caps a name at two lines — so there is no exception to register.
- The **last column is the action column and is right-aligned**, with **one shape on every row** —
  the chevron — and nothing conditional beside it (K-08). **A row with two doors names the second**
  (K-19): where the lead cell is already a link to one place, the last column's door to a *different*
  place is worded on a desktop ("Progress →"), because a bare chevron beside a name-link reads as the
  same door. On a phone it is the corner chevron K-09 governs.
- A fixed-width column is allowed only for a control column or a date; a name column is elastic and
  **wraps on word boundaries, two lines at most** — never mid-word, never an ellipsis on the thing
  that identifies the row.
- The lead cell of a group row indents its items by one gutter; a sub row indents one more.
- Public standings centre their W/L/T figures — a sports-table convention, recorded as K-11.

### 3.5 Structure — what a table has, in what order

Column heading row (always, except in card mode) → optional band → group → items → sub rows → a
closing row (in `<tfoot>` when it is a column sum; as the last body row when it is an answer that
folds with its section). **One closing answer per table**; a row that merely restates another is
deleted, not styled quieter (QA §132/§142). A footnote stack under the table, in caption type, holds
the basis, the caveats and the doors — never a sentence inside a money column.

### 3.6 Interaction

- **A row that opens is a button.** An expanding row carries a real `<button aria-expanded>` named
  for its record; the row itself is the pointer/touch shortcut on top of it (K-07). A row that
  navigates has the **name as the link**, never a row-level click.
- **The chevron sits in the last column, right-aligned, and appears only where something opens.**
- **A figure that opens is a dotted-underline button, and one underline means one thing across the
  whole table** (2026-09-04). When a figure becomes a door, every other affordance that opened the
  same thing goes.
- **Expand all / Collapse all** sits at the right end of the table's toolbar, acts on the view being
  read, and exists on every table with more than one fold.
- **A link or control inside a compact row borrows its tap box from the row; it never adds to it.**
  The recipe is one marker (`.rowTapLink`: a 44px border-box, the padding that makes it 44, a
  matching negative margin, vertical only) that every in-row link composes — the shape the
  Development name link has had since Phase 1, named on 2026-09-16 because the density rule reads
  the *cell's* padding and cannot see a control's box: "Progress →" carried a 44px box with no
  negative margin and every row of Insights → Coverage stood at 58px on a 40px table (F-25). The
  last row of a table absorbs the spill (a content-based rule on the marker) so the frame never
  grows a scrollbar over it.
- **Minimum target: `--tap-min` tall AND wide at ≤ 768, including WIDTH for icon-only controls.**
  The tap-floor gate measures height only; this standard adds the width rule and §9 says how to
  gate it. ⚠ The admin shell's 38px HEIGHT exception (K-18) does **not** extend to width: an
  icon-only control there still clears `--tap-min` sideways. On a desktop there is no finger floor, but a semantic control's hit box is the **whole
  lead cell**, not the category's name — a toggle called "Gear" must be as easy to hit as one called
  "Tournament entry fees" (F-08).
- Delete is never a row action; it lives in the record's editor.

### 3.7 Empty, zero and absent

| State | Treatment |
|---|---|
| Nothing to list | one sentence saying why + one action; the heading row is **not** drawn over an empty body (F-13) |
| A real zero | `$0.00` — a zero is a fact |
| Not applicable / nothing here | an em dash, quiet ink |
| Not yet known | a dash with the amber ink **only** where the product has ruled it (K-03) |
| Loading | skeleton rows at the recipe's own row height — no layout shift when data lands |
| Error | one inline line in `--danger` above the table; the table keeps its last good rows |

### 3.8 Responsive behaviour

- **A LIST becomes cards at ≤ 640; a COMPARISON keeps its columns and scrolls** with the first
  column pinned and a swipe hint that only shows while the content overflows (K-05). The test:
  does a reader compare two figures on one row? grid. Does a reader read one record? cards.
- In card mode: headings become `data-label` lines; **the lead cell is the card's title and takes
  no label when its value is a name a human wrote**; an icon-only action is corner-pinned, a
  worded action is a full-width `--tap-min` row (K-09). ⚠ Known limit of both card recipes: the
  heading row leaves the accessibility tree at ≤ 640 and the labels are generated content, so a
  screen reader loses column association — the same on the coach lists and the console. A caption
  or an `aria-label` on the table is the cheap mitigation; not yet applied anywhere.
- **641–768 is a touch band** — the tap floor and the touch arrangement hold there; the *narrow*
  rules (scroll hint, pinned column, trimmed gutters) do not move up with them (K-12).
- The page never scrolls sideways; a wide table scrolls inside its own frame.

### 3.9 The chrome around a table

Toolbar above the table on one line: filters and search **left**, the arrangement (view / group /
lens) **centre-left**, Expand all **beside the arrangement**, **Export pinned right** (2026-08-23).
A pager sits under the table, right. The notes stack sits under the table in caption type. A create
button belongs to the nearest chrome that names what it creates — the tab's toolbar, never the hub
header.

### 3.10 Row lists — the same rows without a heading row (register F-17 → F-26–F-40, K-21–K-24)

**Status: RULED AS DRAWN 2026-09-16** (owner, on the hub's six asks: "agree with your mockups")
**and BUILT on dev the same day for the first half** — the component (`CoachRowList` / `CoachRow`),
the three gate extensions (§9), Insights → Scouting Book, the Schedule's list view, the two hubs and
Lineups → Templates (F-26–F-29, K-21). The second half (F-30–F-40, K-22–K-24: tournaments,
announcements, the player's lists, staff, the feed, the closed-season rows, Off the roster, tags) is
session B2 of `docs/projects/active/COACH_ROW_LIST_RECIPE_PLAN.md`. Hub artifact:
https://claude.ai/artifact/S78c93Zrp4U91mZTpyMsXk. Evidence:
`TABLE_INVENTORY_2026-09-16_ROWLISTS.md` (rendered, 23 targets, 1440 · 768 · 390, both skins).

A row list is a stack of item rows with no heading row (§1). It takes every rule above that a row
takes; this section names the axes on which a row list had, until now, no sentence — and the
re-measure found that "six treatments" was really **two species with a ground problem**: gapped
card stacks on the paper (the hubs, the schedule list, the scouting book, tournaments,
announcements) and hairlined rows that are already right wherever something paints a card behind
them (staff, the feed, the shelves, tags, notes) and wrong where nothing does (Off the roster).

1. **Ground — exactly one painter.** Between an item row and the paper there is exactly ONE thing
   that paints `--card-bg`: the list's own frame — **the table's frame** (`.tableWrap`: `--home-line`
   border, radius, `--card-bg`) — when the list stands on the page; the section card or shelf
   around it when the list sits inside one (then the list draws no frame of its own). **Never
   zero** (a list on the paper) and **never two** (a framed list inside a card). Rows are
   transparent over it. At ≤ 640 the frame stands down with its ground and each row is its own
   card on **the table's card recipe** (`--border-2`, radius, the `--home-olive-soft` wash) — never
   a second card recipe. ⚠ **The gate reads the ancestor:** the rendered rule asserts that the first
   painted ground behind a row IS the card token, not that the row is transparent (F-24's lesson).
2. **A row is not a card.** On a desktop a row list draws no per-row border, radius, shadow, fill
   or gap; the hairline (`--home-line`) under every row but the last is the whole separation. A
   gapped stack of bordered, shadowed cards is the phone's shape used at 1440, and one beside a
   carded table is two treatments on one screen (§194, the owner's own objection).
3. **Density by content** (§3.1), read from the same marker the tables read: compact for a
   one-line row, comfortable for a row that carries a caption (`.rowCaption`) or a worded control;
   at ≤ 768 a row that carries a control is at least `--tap-min`. No list has a private floor: a
   31px agenda row is not a density, it is the absence of one.
4. **Type** (§3.2), and **every line decides its own size** — an inherited 16px is not a decision:
   the item line is `--type-body` (600 when it names the record, 400 otherwise); the caption
   `--type-support` in `--text-tertiary` (`--text-secondary` when it carries the row's meaning — a
   recap, a note); **a date that leads a row is a date column** — `--type-body`, tabular,
   `--text-tertiary`, fixed width, left — never a tile in the display face; **the display face
   appears nowhere below a heading**; a chip or badge keeps its own recipe (§3.2's badge row, or
   the chip a ruling drew) and the row does not resize it.
5. **The label row.** A row list with no heading row must say what it is (§1): either the section
   title or shelf above the frame, or — inside the frame, where a list is grouped — a **band row**:
   uppercase `--type-support`, display face, 700, `--text-secondary`, on the paper tone
   (`--home-paper`) with `--home-line` above and below. That is the notifications feed's day
   header, already in the product and walked (§138); a month in the schedule and "Coming up /
   Recent" in the hubs are band rows. One frame with bands, not a kicker on the paper over each of
   several stacks.
6. **Interaction** (§3.6): a row that opens is a real link or button and its whole box is the
   target; it takes `--home-olive-soft` and the pointer on hover and **nothing else** — no lift, no
   shadow, no border change; a row that opens nothing does not change on hover. The door is the
   chevron, last, right — or, where a ruling worded the action ("Open the plan", "Plan this
   practice", "Edit access"), those words at `--type-body` 600 with the arrow, right (K-19's
   shape). A control inside a row borrows its tap box from the row (`.rowTapLink`).
7. **One lead mark.** A row may lead with ONE mark in a fixed-width slot — a type icon, a status
   dot, a date. A coloured rail on the row's edge is a calendar-cell idiom (K-21) and is not drawn
   in a list; the icon already carries the type's colour.
8. **Phone** (≤ 640): the frame stands down; each row is a card on the table's card recipe; the
   item line is the card's title; a date lead is the card's first meta line; the door is the
   corner chevron or a full-width worded row (K-09).
9. **The unit is a component, not a class** (owner ruling): every bin-B list renders through ONE
   row-list component (`CoachRowList` / `CoachRow` — the plan names it), whose classes
   (`.rowList`, composing `.tableWrap`; `.rowListBand`; `.rowListRow`; `.rowListCaption`, composing
   `.rowCaption`) and `data-row-list` attribute are what the guards key on (§9). A list that
   needs a different row composes the component with a different lead or trail; it does not write
   a second row class.

**When a row list is a table instead** (bin A — the Awards Leaderboard, 2026-09-16): when the
reader's question is answered by a **column** — a total, a rank, a sum — rather than by a row, it
is a `<table>` on the shared frame and needs no recipe. When the column question is already
answered above the rows (a shelf's answer strip, a section's stat boxes), the rows are a record and
stay a row list even with three same-kind columns; that is why the closed-season results shelf
and the player's "Last 10 sessions" are row lists and the leaderboard was not.

---

## 4. Which surface the standard is derived from, and why

**The coach money grid (`.moneyGrid`)** — the only recipe in the app that has been consolidated
across three surfaces under owner QA (§146), that already runs on the type ladder for its headings,
paints pinned columns opaque, draws its hairline as a token, and folds through a real button. It
was measured on 5 money views at 390 and 1440 in both skins; every number in §3 is either its value
or a relationship it already holds.

**Does it generalise?** Yes for the axes that matter — heading, hairline, ground, alignment,
interaction, chrome — and those are exactly the axes the register applies to every other shell. It
does **not** generalise on one axis: its private type ladder (`--money-cat-size` etc.) is a money
hierarchy's answer to a three-level tree and stays a documented exception (K-02). So the standard is
"the money grid's recipe with the ladder's own body step", not the money grid verbatim.

## 5. The recipes that exist today, and where each lands

| Recipe | Adopters (rendered) | Body | Heading | Hairline | Verdict |
|---|---|---|---|---|---|
| coach `.moneyGrid` | 3 files · 5 views | `--money-line-size` 13.44px 600 | 12px display · secondary · card ground | inset `--home-line` | **the standard**, ladder excepted (K-02) |
| coach `.table` (list) | 13 files · 24 renders | declared 14 · **renders 15** (F-01) | 12px display · secondary | `--white-05` → **paper in warm** (F-02) | FIX F-01 F-02 F-10; density by content (A-01) |
| coach `.insightsTable` | 3 files | renders 15 (F-01) | 12px display · secondary · **no ground** | `--home-line` | FIX F-01 F-09; heading ground |
| coach `.devBoardTable` | 3 files | renders 15 (F-01) | **11px mono · tertiary** | `--white-10` | FIX F-01 F-15 — both landed; **F-25 (top-aligned cells, 58px rows) landed 2026-09-16**; the measurement column's data face is K-20 |
| coach register (`.registerTable` on `.table`) | 1 file | 12px 700/400 · `0.28rem` | 12px display | paper (F-02); zebra never paints (F-04) | KEEP density K-01; FIX F-02 F-04 |
| coach row lists — **re-measured 2026-09-16** (`TABLE_INVENTORY_2026-09-16_ROWLISTS.md`): the two hubs, Lineups templates, the Schedule list, Scouting book, Tournaments, Announcements, the player's sessions — **gapped card stacks on the paper**; Staff, the feed, the closed-season shelves, Tags, Notes — hairlined rows on a card already; Off the roster — hairlined on the paper | 17 lists · 12 files | 14 body on all but two (16 inherited: Staff, Tags words; 14.08/12.8 literal: the feed); the hubs' day tile 20 display 800 | a kicker on the paper, or none; the feed's day band | `--home-line` on the hairlined nine; none on the card stacks; paper on the fold | §3.10 — FIX F-26–F-40 (one recipe, one component, the frame paints), KEEP K-21–K-24; bin C removed from F-17 |
| admin-shell flat row (`.row` / `.rowMain` + `.tableHeader`) | tournament admin lists | mono 12.8 / 11.5 · 36px compact / 44px comfortable | **9.3px mono** | `--border-2` | KEEP shape K-13; FIX F-07 heading |
| admin `<table>` modules (members, families, house league, accounting, rep teams, bva, budget) | 25 files · **0 rendered** (fixture gap) | 0.85–0.88rem declared | 0.63–0.7rem, `--white-30/40` | `--white-05`/blue tints | stylesheet-read only; FIX F-18 when a fixture exists |
| the **global** `th`/`td` element rule | every table with no cell rule of its own | **15px** · `0.875rem` padding | 12.8px display · `--white-60` | `--border-2` | RETIRE — it is a recipe by accident (F-01, F-11) |
| platform `.table` × 16 copies | 16 files · 14 rendered | mono · declared 0.72–0.75rem · **renders 15** on 10 (F-01) | **8.8px** display · data-gray (F-05) | white 0.04 | FIX F-01 F-05 F-06 F-12; face KEEP K-10 |
| public `.standingsTable` | standings/results | 15.2px · 16px padding | 12px display · data-gray | `--border-2`; amber leader row | KEEP K-11; A-05 |
| public pricing comparison | pricing | mono 15 (F-01) · 0 padding | 9.6px display | white 0.08 | FIX F-01; A-05 |

## 6. How to build a new table (the checklist a new screen follows)

1. Name each row's **role** (§2) before writing a class.
2. Pick the **density by content** (§3.1); state it once on the table. In the coach portal a
   caption class that renders a second line inside a cell **composes `.rowCaption`** — that one
   marker is what the density rule reads, so a new caption is comfortable the moment it composes it.
3. Take every size from the ladder **on the cell**; take every ink from the three tiers; take the
   hairline and frame from `--home-line` / `--home-line-strong`.
4. Figures right, tabular, body face. Chevron last, right, one shape.
5. Decide **cards or grid** by the comparison test; put `data-label` on every cell that cannot say
   what it is, and none on a name.
6. Every opening row gets a real button; every control clears `--tap-min` both ways at ≤ 768.
7. Write the empty state before the populated one.
8. If any axis must differ, **add a register row first** — an unrecorded difference is a bug.

## 7. Coverage of the evidence, stated plainly

Rendered at 390 and 1440, warm and dark where the shell honours a theme: **coach portal 44 screens
(+3 report views), tournament admin 14, platform admin 17, public 5, consumer 1** — 319 renders,
220 tables, 176 row lists, 92 populated desktop renders. **Not rendered:** the club-side admin
(Families, Members, Rep teams, Accounting, House League) — the only signed-in fixture org is on a
tournament-tier plan that redirects those areas, and this session was not permitted to write a
member into the club-tier fixture orgs; their recipes were read from stylesheets and are marked so.
Also unrendered: public league pages (no fixture org publishes a league), the demo's public
schedule (unpublished today → empty state). The §146 one-surface work was measured **as it sits
uncommitted** in the working copy. The full inventory: `TABLE_INVENTORY_2026-09-06.md`.

## 8. Sequenced fix work — by reader impact, not by effort

Written up as `APP_WIDE_TABLE_CONSISTENCY_PLAN.md` + PM brief **only after the owner approves this
standard and the mockups** (prompt §8.4). The order the register's FIX rows argue for:

1. **F-01 + F-11** retire the global cell recipe and put every cell on the ladder — the one change
   that reaches every shell, and the reason 15px is the most common body size in the app today.
2. **F-02 / F-10 / F-03 / F-04** the coach list family's hairline, frame, hover and the phantom
   zebra — the four money tabs a treasurer switches between in ten seconds.
3. **A-01** density by content on the coach lists (owner call).
4. **F-05 / F-06 / F-12** platform admin: one shared recipe, headings on the ladder, a phone shape.
5. **F-07 / F-16** tournament admin headings and the check-in row control.
6. **F-08 / F-19** the Months view's figure doors and the target-width rule.
7. **F-17** one row-list recipe for the coach portal's row lists — **planned and drawn
   2026-09-16 as §3.10 + register F-26–F-40 / K-21–K-24**, its own plan
   (`COACH_ROW_LIST_RECIPE_PLAN.md`) and hub artifact; the build waits on the owner's panel.
8. **F-18** the club admin `<table>` modules, once a fixture can render them.

## 9. Enforcement — how this holds after the session ends

Prefer extending a gate that exists; assert **relationships and role membership**, never pixels.

| Gate | Extension | What it holds | What it cannot see |
|---|---|---|---|
| `tests/unit/money-hierarchy-type-scale.test.ts` → generalise into **`table-recipe-guard.test.ts`** | parse every `.module.css` rule whose selector names a table part; assert every `font-size` on a th/td/row class is a `--type-*` token (or `--money-*` on the money grid, or a `table-exception: K-nn` comment on the line); every hairline/frame colour is `--home-line`/`--home-line-strong`/`--border-2`; **every `var(--x)` names a token that is defined** (this alone would have caught F-04) | a rule outranked by the cascade into another legal value; anything the sweep never renders |
| `check:layout` | (a) a **`control-width`** rule at touch widths: an icon-only control (no text) is ≥ `--tap-min` wide — the finding the prompt required; (b) a **`type-ladder`** rule at 1440: every visible `th`/`td` font-size is a ladder value — membership, not pixels; (c) sweep entries for the report **views** the default URL never shows (Months, By activity, By period) via a `storage` hook on the screen entry, which is how this review reached them | the inside of a closed fold; a control hidden behind a view the entry does not address |
| **row lists** (§3.10 — BUILT 2026-09-16, session B1; broken on purpose once and reported by name) | (a) `table-recipe-guard.test.ts` scans the `rowList*` selector family as it scans table parts — ladder membership on every `font-size`, hairline/frame colours from the line tokens, every named token defined; (b) `check:layout` `type-ladder` reads `[data-row-list] [data-row-list-row]` text as it reads `td`; (c) a new `check:layout` rule **`list-ground`**: at ≥ 641 the first painted ancestor behind every `[data-row-list-row]` computes to the card token, and at ≤ 640 the row's own ground is the card wash with no painted slab between it and `main` — **the probe reads the ancestor**, which is the rule F-24 needed and did not have | a list that never composes the component (the register's human gate; `check:css-selectors` deletes the old row classes the day their last caller goes) |
| `check:css-selectors` | no change; it already deletes dead recipes | a live recipe that is wrong |
| **the register** | human gate: a review comment that cites a register id, or adds one, is the only way a table may differ | nothing — but only if reviewers use it |

Deliberately **not** recommended: a pixel-snapshot gate. It fails on every legitimate change and is
switched off within a fortnight; this repo has proof.

## 10. Standing rulings this standard honours (cite, do not re-decide)

The closing row takes no fourth rung (QA §146) · the unplanned dash keeps its amber (§146 F1) · an
export's shape is its screen's shape (§146 F2) · one spelling everywhere a customer reads, "8:00
a.m." included · a shared component beats a shared class · the 641–768 band is touch · a hidden
control needs a reachable replacement · column heading ink and ground (2026-08-15) · list → cards,
comparison → grid (2026-07-30) · a row that opens is a button (2026-09-02) · one chevron in the last
column (2026-09-03) · the card's lead cell is its title (2026-09-03) · pinned columns are opaque and
hairlines on sticky tables are inset shadows (2026-08-24) · the answer is the loudest row, not the
subtotal (2026-08-24) · btn-data is the admin shell's control size (2026-05-24) · flat rows are the
admin list shape (2026-06-01) · no new grey token; the white-alpha ladder stops at /50 (2026-08-11).
