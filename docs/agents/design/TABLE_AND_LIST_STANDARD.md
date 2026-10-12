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

- **A band row may carry a total IN ITS WORDS** (owner, Club Tier Stage 3a Ask 5d, 2026-09-30):
  "Overdue · 2 · $900.00", "Waiting on you · 3 · $555.00". The band is still a label — the figure
  is part of its sentence, never a figure column inside the band, and never a second closing row.
  Use it when the band answers "how much is waiting in this group", which a closing row cannot
  (bands with different questions do not sum to one answer). Shared with the tournament redesign,
  which draws money tables too.
- **A void row** (same ruling). A voided line is **off the book until a Status filter asks for
  it**; then it sits in place, at its own date: struck through in the **faintest** ink, a **Void**
  chip after its name, the **reason** (and who) as its detail, **no balance**, and it counts
  **nowhere** — not in a band, a closing row, a figure card or an export total. A void is a
  correction, not money, so a book opens without it; an auditor asks for it, so it stays one pick
  away. First drawn on the club's Ledger (Stage 3a specimen 1); the tournament redesign's voided
  fees and refunds use the same recipe.
- **A column the screen reads but does not own** (owner, Club Tier Stage 3b Ask 4e, 2026-10-06).
  When a table shows a figure that belongs to someone else — the club's board summary reading each
  team's cash on hand from its coaches' books — that column says so and is never added in:
  - its heading carries a **lock** and **the owner's name** ("Cash on hand · held by the team");
  - its cells carry **no coloured edge** (owner, 2026-10-07: a blue edge on the cells was added when
    this rule was written down, never ruled or drawn, and came out). The heading row and every group
    band break it, so it reads as a stray divider, and a coloured edge is a callout card's mark, not
    a column's. The lock and the heading's words carry the meaning;
  - the table's **closing row is blank under it** — the closing row is the screen's own totals, and
    a figure it does not own is never one of them;
  - its own total, when the reader needs one, sits in a **separate band under the closing row**,
    worded as not the screen's ("Held by the teams: $32,234.35 across 9 teams — the coaches' own
    books, never part of the club's figures above");
  - on a phone, where no column heading carries the label, **every row's figure carries the
    owner's words** ("Held by the team $4,215.60"), and the total closes the list on its own line.
  The export follows the screen: the same heading, a blank under it in the closing row, the total
  on its own row. Shared with the tournament redesign: a team's figure read from its coach (an
  entry fee a team says it paid) is the same case.

### 3.6 Interaction

- **A row that opens is a button.** An expanding row carries a real `<button aria-expanded>` named
  for its record; the row itself is the pointer/touch shortcut on top of it (K-07). A row that
  navigates has the **name as the link** — the one real control, which a keyboard, a reader and a new
  tab use — and **the row is the pointer/touch shortcut on top of it**, exactly as for an expanding
  row. Never a row-level click *instead of* a real control.
  - **Amended 2026-09-29 (owner).** This sentence used to end "never a row-level click", and the
    Club Tier Stage 2 formatting ruling (Ask 8 ruling 5, "a table's link is the name") was copied
    from it. Read literally, it left the club's tables tinting the whole row on hover while only the
    name and chevron opened — a tint that promises a click the row does not keep (F-03's rule read
    backwards). The portal benchmark already did the shortcut on navigating tables (Development's
    sessions, the budget's dues row); only the club tables had taken the old words literally.
  - **The recipe:** the row's click runs the same door as the name, and returns early when the
    click ends a text selection (a copy gesture — a guardian's email, a coach's name); the name's
    own click stops propagation so one gesture never opens twice; the chevron is a mark
    (`aria-hidden`), not a second control. A control inside the row that goes somewhere *else*
    stops propagation too (K-19's second door).
  - **Known limit, accepted:** a middle-click or Ctrl+click on the row's blank area opens in the same
    tab; only the name opens a new one. The portal has the same limit.
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
- **A form table — a table whose rows are a create form's fields** (owner, Club Tier Stage 3c Ask 6,
  2026-10-07; **shared with the tournament redesign**, which draws entry forms). The one place a cell
  holds a control, and allowed **only inside a create form** (a window or page whose foot carries the
  create) — never on a table that displays records, where "no control in a cell" stands.
  - Each row is one record the create will make (New allocation: one team's share), and its cells
    are that record's fields: a **tick** in the lead cell (the row is in or out), and an **input only
    where the form's own choice asks for one** (New allocation's Share under By amount, By
    percentage or By sessions; under Evenly it is a plain figure). A row that cannot be in is still
    listed — unticked and dim, its reason across the cells it would have filled.
  - **A form table whose rows are all in carries no tick** (owner, tournament redesign, the
    Divisions step's round 3, 2026-10-12). Where a create form lists only records the person has
    added (the New tournament window's Divisions), every row is in, so the lead cell holds the name
    alone and the closing row sums every row. A row leaves from its own form, by the record's rare
    door at the end of its body (`RecordAction`), never by an untick or a mark on the row. The add
    control sits above the table and is never a row. An empty list is no table at all: the form
    draws the table once a row exists, so no heading row stands over nothing (§3.7) — the caller's
    rule, not the component's. It is a table-level option of the one component (`allIn`).
  - The rows **open nothing**: no row-end chevron, no row click, no name link. A form table is
    filled, not navigated. (The one exception is the Divisions step's phone row, below: it opens
    that row's own form, never a place.)
  - A row may **expand in place** (a down chevron — a real `<button aria-expanded>` in the last cell)
    to give that record its own exception (a team's own installments); what opens is the row's form,
    inside the table. The chevron shows **only while the row is ticked** — a row out of the create has
    no form of its own — and its column stays drawn, so a first tick moves nothing (2026-10-11); on a
    form table whose rows are all in, every row carries it.
  - Its **closing row states the sum of the ticked rows and the difference** from what the form
    says they must add up to ("nothing left over", "$0.50 short") — never a separate warning above
    or below the table.
  - On a phone it is **one frame of short records**: the tick and the lead, the row's other fields
    as one line under it, the figure at the row's end; a row opens in place the same way, **except the
    New tournament window's Divisions step, whose rows open their own window full screen (§3.10.8):
    the form table's one full-screen row** (owner, 2026-10-11, walk §290 Ask 6). There every row,
    heading or record, shares one 48px box column; a ticked row is two targets that touch and never
    overlap — its box alone unticks it, and one button (the name, its summary line under it, the
    house row chevron last) opens its window; an unticked row stays one label that ticks wherever it
    is tapped, with no line and no chevron. At a desk it changes nothing. It is a table-level option
    of the one component (`phoneRowWindows`), never markup beside it; New allocation's rows keep
    opening in place.
  - **One shared component** (`components/shared/FormTable.tsx`), never a class copied per form;
    `club-stage3c-screens-guard` holds New allocation to it.

### 3.7 Empty, zero and absent

| State | Treatment |
|---|---|
| Nothing to list | one sentence saying why + one action; the heading row is **not** drawn over an empty body (F-13) |
| A real zero | `$0.00` — a zero is a fact |
| Not applicable / nothing here | an em dash, quiet ink |
| The empty side of a PAIRED money column (Money out / Money in) | **blank** — the column a figure sits in is its direction, and a dash on every row of a pair doubles the ink and reads as data (owner, Club Tier Stage 3a Ask 5d, 2026-09-30; the coach's Register already drew it). The em dash stays for "nothing here" everywhere else. A figure in a money cell always carries its dollar sign. |
| Not yet known | a dash with the amber ink **only** where the product has ruled it (K-03) |
| Loading | skeleton rows at the recipe's own row height — no layout shift when data lands |
| Error | one inline line in `--danger` above the table; the table keeps its last good rows |

### 3.8 Responsive behaviour

- **First: does it FIT?** (owner 2026-09-24, coaching from a phone · stage 6 · R1.) A table whose
  columns fit the frame at 360 — **every figure on one line, the lead (a name) allowed two** — stays
  a table on a phone, whatever kind it is. Fit means ON ONE LINE: a table that "fits" only by wrapping
  its cells grows taller than its own cards (Insights → Coverage: 80px rows, 1,014px, against 550 as
  cards). Attendance (Player · Games · Practices, 291 of 326px) is the case that forced this sentence —
  it had been carded as a list, twelve × 148px, for a comparison down one column.
- **If it does not fit: a LIST OF LABELLED RECORDS becomes cards at ≤ 640; a COMPARISON keeps its columns and scrolls**
  with the first column pinned and a swipe hint that only shows while the content overflows (K-05) —
  the portal's `CoachScrollX` (sticky), every cell on one line inside it. The test: does a reader
  compare figures — **along a row or down a column**? grid. Does a reader read one record at a time,
  and does each record carry LABELLED lines (a ledger entry: Date · Category · Money in · Balance)?
  cards. ⚠ **A record with no labelled line is not a card** (owner P1, 2026-09-29, "Phone lists in
  one frame"): where the columns fold into one line under the title (`.cardPhoneLine`), the frame
  STAYS and the rows are hairlined (`.cardsFramed`) — the Coverage report, the practice libraries.
  The roster used to be this bullet's example of cards; it fits (S.7), so it is a table on a phone.
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
   transparent over it. **The same at every width** (owner P1, 2026-09-29): a phone keeps the frame
   and the hairlines — it never breaks a row list into cards (see 8). ⚠ **The gate reads the ancestor:** the rendered rule asserts that the first
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
8. **Phone** (≤ 640) — **ONE FORM: the frame stays, the rows are hairlined** (owner ruling P1,
   2026-09-29, "Phone lists in one frame"; register F-41). Only the row's ARRANGEMENT changes: the
   item line leads; a date lead moves onto the caption's line; the door is the corner chevron and a
   worded door hides (K-09); the whole row is the target. Until 2026-09-29 the frame stood down and
   each row became a card unless the list declared `phoneFrame` (S.7) — five lists did, and the owner
   chose the frame every time the two were side by side; the card form and the prop are gone.
   **A row that opens a FORM opens it full-screen** (the portal's modal: back arrow, the phone's back
   closes it — the depth chart's player, D1); **a row that opens a SHORT READ folds in place**, its
   detail on the paper tone (Player Dues, M1). A separate card on a phone is kept only for a record
   that carries labelled lines (K-25 Ledger, K-26 Club).
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

---

## 11. Calendars — the recipe, the register and the shared parts (Club Tier Stage 6c, ruled 2026-10-10)

**Ruled by the owner 2026-10-10** (*"I agree with your recommendations"* — all twenty asks and the `/design` review's eleven
drawing changes), from nine calendars compared side by side at 1440, 768 and 390 in both skins: club hub
https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 6c (v78), plan
`docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 6c. **The rule this section carries: a shared part
travels WITH its reason.** A calendar that lacks a line's reason leaves the line out instead of copying it (the club
calendar's phone copied two coach choices whose reasons it didn't share, §288 W4). Each line names its reason so that test
can be run. Where a drawing and a line seem to disagree, the line's reason decides.

### 11.1 The recipe — C1–C13

| Line | The rule | Why |
|---|---|---|
| **C1 · Views mean one thing** | **Week** is seven days, Monday to Sunday, stepped with arrows. **Month** is a month grid that says what and when (a team's calendar) or how much (the club's). **List** is the surface's natural range — a team's season, the club's week, a tournament's day — and the date row says which. **Day** is one day. A phone drops a view that only repeats another. | A person moves between these screens in one evening; if "Week" is seven days on one and a season on another, the word stops meaning anything. |
| **C2 · Monday first, in every grid** | Week views, Month grids, week headings and jump lists all start on Monday. | Every week the product files already starts Monday; a Sunday-first Month splits a weekend tournament across two rows and disagrees with the Week one click away. |
| **C3 · Open on today, at every width** | A calendar opens on today when its range holds today; otherwise on the next day with something on it; a finished range on its last day. A season list opens with today at the top of its frame and the finished games a scroll above. | The question every visit asks is "what's next"; the phone already answered it and the desk was the last exception (the coach schedule deep dive's F01, rule R3). |
| **C4 · One toolbar line** | Under the title, one line: a scope that doesn't depend on the view leads (the olive pill), then the view switch, then — wider than 900 px — the date arrows and range (they follow the view because the view sets their unit), then filters, Search and Tools where the surface has them, then Export and the create button at the right end. A rare door (Import) lives in the create button's menu or in Tools, never on the line. At 900 px and narrower the dates take their own row. On a phone the view switch is the glyph in the title row; Filter and Export share a row, and with no filter row Export is an icon in the title row. | Three rows of controls stood above the coach's first day; the tournament's schedule built the one-line form. "One Export and one create, above what they act on" (2026-09-01; 2026-10-09). |
| **C5 · One booking row** | A list of bookings is the product's row list (§3.10 — the portal's `CoachRow` and the admin kit's `ClubRow`, one recipe): one frame, a band per day or month, hairlined rows. **Lead** the time (with the date when the list has no day bands); **title** who and what; **caption** where, "Venue · Facility", with the program's word on a page that shows more than one program; **trail** the state and the score, then the chevron. A clash is 6a's amber line under the place. | The coach's List and the tournament's Day already wear it; a table whose columns answer no column question (no total, nothing compared down it) is a fourth shape for the same row. |
| **C6 · One calendar-cell chip** | Inside a Week column or a Month cell a booking is one chip: the time on its first line, the title on its second, the kind's colour on a one-team calendar and the team's on the club's, the amber flag for a clash. A desk Month cell shows up to three, then "+N more", which opens the day. From 641 to 768 px and on a phone a Month is the **touch Month**: dots, the whole day taps, the chosen day's rows underneath. | A Month that can't say when isn't worth opening (F09). At 641–768 the tap floor is 44 px (K-12) and a chip in a 104 px cell can't be 44 tall, so the day itself is the target. |
| **C7 · One today mark** | Today is the olive edge **and is said in words wherever a day is headed** — never colour alone: a Week column's border and top line under "Today · Sat, Oct 10"; a Month cell's ring; a phone day's frame. In a list it is the day band "Today · Sat, Oct 10"; in a **season list with nothing on today, a now line** between the last finished row and the next — never a band, which would head rows that aren't today's. Empty days: "—" in a Week column, a bare Month cell, a run folded into one quiet line on a phone (today never folds into it), nothing in a list. | Today was drawn five ways and the coach's Week marked nothing. ⚠ The hub's "Not written yet" table, row (a), still proposes "a quiet olive band"; the design review replaced it with the now line, and the review's reason (a band heads the rows under it) decides. |
| **C8 · One spelling for a day, a week, a range** | A day **"Sat, Oct 10"** — over a Week column, on a band, as a phone day's heading, as a day label; a heading or band wears the condensed display face in capitals (the 2026-09-28 ruling 1), so the words stay one spelling and the style does the rest. In a sentence **"Saturday, October 10"**. A row whose list has no day bands leads **"Sat, Oct 10 · 2:00 p.m."**. A week **"Oct 5 – 11, 2026"**, **"Oct 26 – Nov 1, 2026"**, **"Dec 28, 2026 – Jan 3, 2027"** (no year on a phone). A month **"October 2026"**. No "Week of …". A place **"Venue · Facility"**. | One day was spelled seven ways, three on the club calendar alone; "Sat, Oct 10" is the spelling most screens already used, and the club's range words are the shortest that can't be misread. |
| **C9 · One word per state; nothing hidden** | A scheduled booking says nothing. Otherwise one chip, one spelling: **Moved, Postponed, Cancelled, Live, Final** (where no team is "ours"), **Win · Loss · Tie** (a team's own calendar, beside the score), **Scrimmage, Forfeit**. Cancelled is struck through and dimmed; postponed says Postponed. **Neither is ever hidden from a schedule a person reads, and neither ever counts as a clash.** | "Is it on?" is what a schedule exists to answer; hidden, a called-off game looks like an empty evening. Two spellings of one result (Win / Won) is the spelling ruling's bug. |
| **C10 · The booking's own clock, said once** | Every date and time reads in the club's zone (or a tournament game's own stored clock), never the device's; times "2:00 p.m.", ranges "5:30–7:30 p.m.". The zone is said once, on the date row, in one sentence ("Times in Eastern time."), **read from the club's zone**, wherever a reader may sit outside it. | A calendar entry is the event's own time (the deep dive's R5); four screens read the device's clock and three said three different things about which clock it was. |
| **C11 · Export: one button, Calendar wherever bookings are listed** | One Export (no chevron), Excel first, then CSV and Calendar (.ics) for any list of dated bookings, a PDF where a printed schedule exists; one line in the menu names what the file holds. A public or family schedule subscribes instead (6d). | The 2026-10-01 and 2026-10-08 Export rulings applied to calendars: the calendar file is the format a schedule needs most. |
| **C12 · A booking opens a window that reads first** | It reads first (the record standard), says when, where and the state, and has one door to the booking's own schedule. A reader who can't change it gets **no foot at all** — no Done, no greyed form. | The 2026-10-01 record standard and the 2026-10-09 rulings that took Done out of record windows. |
| **C13 · On a phone: one frame per day; every tool reachable** | A week stacks its days, each one frame with its heading inside and its bookings as hairlined rows (§3.10.8, P1); a run of empty days folds into one quiet line; Month is the touch Month; every control ≥ 44 px; Export is reachable from every view. | The coach's and the club's phone weeks ran the same grouping two ways; the standard's phone ruling is one frame, never a card per row. |

### 11.2 The register — what differs on purpose, R1–R12

A difference between two calendars is on this list or it is a bug.

| | What differs | Where | Why it stays |
|---|---|---|---|
| **R1** | List is a season on a team's calendar, a week on the club's, a day on a tournament's | coach, admin team · club · tournament | Each is that reader's unit of planning; the date row says which range is on screen. |
| **R2** | The club's Month counts bookings instead of naming them | club calendar | A club's day can hold twenty bookings; a count and an amber clash count answer "which days are busy, and which are broken". A team's day holds one or two, so its Month names them. |
| **R3** | The tournament's Timeline: one day, the fields across, the hours down | tournament schedule | Placing games on fields is its own job. ⚖ Trued 2026-10-11 (Stages 10 + 11 Ask 12, P11-01): this row once said Stage 11's grid “shares its shape (fields down, time across)”, which described neither the Timeline nor the drawing ratified. The club scheduler's grid takes the Timeline's question and behaviour (place time by facility and clock; drag with a dashed preview, a refusal with its reason, Undo) and not its axes: facilities down, a week across, each day's slots in clock order, every open slot drawn (6c specimen 4) — never the Week's shape either. |
| **R4** | Colour: the kind on a one-team calendar, the team on the club's | coach, admin team · club | On one team's calendar the question is what each event is; on the club's, whose (2026-10-09). The kind is said in words on the club's. |
| **R5** | Family and public schedules read and never edit: no create, no Export, no clash marks | family app, team page, public league, public tournament, Scores | A family asks "when and where"; a clash is the club's question; a family takes the schedule with them by subscribing (6d). |
| **R6** | The public tournament steps by game day, not by week | public tournament | An event is a few dense days with no empty days; a strip of game days replaces arrows. |
| **R7** | No Export on the admin team schedule, and its window has no edit | a team's schedule (admin) | The coaches keep that schedule (D3); the club calendar's Team filter exports a range. A club admin doesn't edit a team's events. |
| **R8** | Search, Filter and Tools on the tournament's schedule only | tournament schedule | An event holds hundreds of games across divisions; a season is about forty events, and the club calendar filters by venue, program and team. |
| **R9** | A club-wide row shows the time as a range; a team's shows the start | club calendar (and Stage 11) · coach, tournament | On the club's page the question is overlap, so the end matters; on a team's or an event's, the start is what a person arrives for. |
| **R10** | The family reads sentences, not chips (" · Cancelled", "W 4–2") | family app, team page | A family list is read, not scanned for states; the words are the recipe's words in a sentence. |
| **R11** | Date-grouped lists that are not calendars wear the words, not the views | the game-day board, the scorekeeper, the Overview's tiles, the helper home, the club board's next event, Scores | They answer "what needs me now", not "what's when"; they take C8–C10 and nothing else. |
| **R12** | A schedule whose time falls on one weekday reads that day's dates across, seven at a time | the club scheduler's grid | A Sundays-only dome schedule laid on a week leaves six columns empty; its Sundays across ("Oct 4 – Nov 15, 2026", C8) show seven weeks at once, the facilities still down (Stages 10 + 11 Ask 27, ratified 2026-10-11). |

### 11.3 The shared parts — each with its question

**A screen that doesn't ask the question doesn't wear the part.**

| Part | The question it answers | Who asks it, so who wears it |
|---|---|---|
| The toolbar line | How do I change what I'm reading? | Every calendar with views or filters |
| The view switch (a phone: the View drawer) | Which arrangement am I reading? | Every calendar with more than one view. **The olive face chooses what is read**: a switch for up to three views, the olive View pill for four or more; the admin kit's black fill leaves the calendars (a team's Tryouts page and the tournament's Communication page keep theirs — open, not ruled). **One control, not one colour** (owner 2026-10-10, §289: *"I prefer the white"*): the switch is the white card on the strong line and the arrows are white boxes on it, on every calendar — `CalendarViewSwitch` and `ScheduleDateNav`, never a page's own (the build had matched only the olive, and the coach kept a see-through switch beside the club's white one) |
| The date row (arrows, range, day label) | Which stretch of time is on screen, and how do I step? | Every view that is a stretch of time: Week, Month, the club's List, the tournament's Day — never a season list |
| The day band | Which day is this? | Every list grouped by day or month |
| The booking row | What's on, when, where, and is it on? | Every list of bookings |
| The calendar-cell chip | What's in this day's cell? | Week columns and desk Month cells on a team's calendar; the club's Week (register K-21) |
| The phone week stack (one frame a day; empty days folded) | What's on this week, on a phone? | Coach, club, admin team |
| The touch Month (dots, the chosen day's rows) | Which days have something, and what's on this one? | Coach and admin team at 768 and narrower (the club's Month counts instead, R2) |
| The clash line and flag (6a), the amber count | Does this booking collide with another program's? | Every admin calendar that lists club-venue bookings |
| The today mark | Where is today? | Every calendar |
| The booking's window | Tell me everything about this booking. | Every calendar whose bookings open |
| The Export menu and the calendar file | Take this schedule with me. | Every schedule an admin or a coach keeps |
| Subscribe (the Subscribe window; on a phone its tall menu sheet) | Keep this schedule current in my own calendar. | A schedule a person reads again and again: behind the one Export at a desk (a row under a hairline at the dialog's foot) and the phone's calendar mark (Subscribe on this phone · Download a copy (.ics)); on the schedule heading's line where a page has no Export (the public team page). Never on the toolbar line (6d, ruled 2026-10-11) |
| The zone sentence | Which clock are these times in? | Wherever a reader may sit outside the club's zone |
| The state chips | Is it on, moved, called off, played? | Every booking row |
| The family's schedule words | What's next for my child's team? | The family app, the public team page, the event window's subtitle |

Not on the list on purpose: the tournament's Timeline and Bracket (one surface each), the public tournament's day strip
(R6), house league's Practices view (Stage 9 decides whether practices join its season list). **Built by** the 6c build
(Part A the date arrows, C6-01–03; then the coach's desk schedule, the club calendar and a team's schedule). Every other
calendar's delta is a finding handed to the project that owns it (the hub's "Not drawn" screen); Stage 8 confirms every
calendar against this section.

### 11.4 The feed — what a calendar entry says, F1–F10 (Club Tier Stage 6d, ruled 2026-10-11)

**Ruled by the owner 2026-10-11** (*"yes fold it into the hub and write the build prompt"*, after asking what live feeds
cost to serve): club hub https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 6d, specimen 5 (v91), plan
`docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 6d. **The 6c recipe (C8–C10) and Stage 11's slots
(`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §5.8), applied to a calendar entry.** One home in the build, read by every team
feed (a coach's, the public team page's, a connected family's) **and the coach's calendar download**, so a file and a
subscription never say one event two ways. A feed's whole job is the moment someone opens their own calendar and reads a
block they didn't type; the calendar app draws it (Apple strikes a cancelled entry through, Google draws no strike), so
the words have to carry what the app might not.

| Line | The rule | Why |
|---|---|---|
| **F1 · Title** | The team leads: **"13U AAA · Practice"**, **"13U AAA vs Oakridge Hawks"**, **"13U AAA @ Ridgeview Owls"** ("@" away; "vs" at home, at a neutral site or when the side isn't known), **"13U AAA · Team photo day"** (anything else by its name), a tryout day **"13U AAA · Tryouts"**, an organizer's game "13U AAA vs/@ {opponent}" with the tournament's name in the notes. The deferred club feed: the booking's own words, as its file writes them. | A calendar holds many things — the person's own, other teams' — so the team must lead or two teams' practices read alike; "@" is the recipe's away (6c). The family's page keeps its sentence ("at Fairhaven Falcons", R10): a sentence is read, a title is scanned. |
| **F2 · Cancelled** | Kept. **"Cancelled · "** leads the title; marked cancelled the calendar file's own way (`STATUS:CANCELLED`); shown as free time (`TRANSP:TRANSPARENT`). | Google draws no strike and its handling of a cancelled entry in a subscribed feed is undocumented, so without the word a called-off game looks like a game on; dropped, it looks like an empty evening (C9: never hidden). Apple's strike makes the word redundant there, and harmless. Free time, so it never blocks the person's own evening. |
| **F3 · Postponed** | Never written at its old time. A team's schedule has no postponed state today (an event is scheduled or cancelled); the rule is written for the deferred club feed's league games. | As 6b's file: a game at a time it won't be played is worse than no entry. |
| **F4 · When** | The event's own **instant**, so every calendar shows it at its own moment in its own zone. No end entered: a game two hours, a practice an hour and a half. An outside tournament (its days, no time) is an **all-day** entry across its days in the club's zone. | A calendar entry is an instant; slicing one for its date put every evening event on the next day (the deep dive's D-1). One default per kind — the download wrote two hours for everything. A tournament drawn as a two-hour block at its start (S6D-08) hides the weekend it takes. |
| **F5 · Where** | **"Kinsmen Park · Diamond 2, 15 Main St"**: the place, its facility (the sport's own word), then the street address. | The recipe's place (C8); the address is what lets a phone open directions from the entry. |
| **F6 · Notes** | **"Arrive by 5:30 p.m. (Eastern time)"** — the arrival read from either stored form ("17:30" or "5:45 PM") and spelled in the house clock, the zone's name read from the club. A coach's feed and the download add **"Uniform: …"** and the event's notes; a family's carries arrival only. A club slot adds nothing. | The clock's spelling (agency rules); the zone said because the reader may sit elsewhere while the arrival is the club's clock (C10). A family's entry carries what the family list carries — its allow-list leaves out uniform and the coach's notes — and a coach's carries what the coach's screen shows. |
| **F7 · A link back** | A coach's entry → the event in the portal; the public feed's → the team page; the deferred club feed's → the booking on the club calendar. | One tap from the calendar to the whole story. |
| **F8 · The calendar** | Named **"13U AAA · UAT Rep Club"** (the club's: "UAT Rep Club calendar") **even when empty**; a refresh hint of **four hours** (`REFRESH-INTERVAL` and `X-PUBLISHED-TTL`). | Two teams' feeds must never read alike in a family's list of calendars, and a feed with nothing in it yet still needs a name (S6D-11). Apple and Outlook read the hint; Google ignores it, so help says "up to a day". Four hours, not one: the cost ruling — a dial, lowered only with the stack-health numbers in hand. |
| **F9 · What it spans** | A team's feed: **the live season only**. The deferred club feed: four weeks back to six months ahead. | A closed season is one page (the 2026-08-18 ruling), so its events leave a subscribed calendar and the next season's arrive when it starts (S6D-12); the window says so in one line. |
| **F10 · When it stops** | A link that stops — reset, the person removed or their schedule access taken away, the team closed to the public, the club cancelled, the season closed with none after it — answers with an **empty calendar under its name**, so its events leave. A link never issued answers "not found". Every entry keeps the event's id as its identity. | A calendar app keeps the last copy of a feed that won't answer, frozen (S6D-04); an empty answer is the only way to take events back out. A stable identity is what makes a moved event move rather than arrive twice. |

**Where the door goes, and what the window holds** are the design log's 2026-10-11 Stage 6d entry (one Subscribe window;
a link that is a credential is shown again until Reset). A feed is never how an urgent change reaches anyone: a game moved
two hours before it starts may not reach Google in time, so the app and its notices stay the source.
