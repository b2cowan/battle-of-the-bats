# Coach row lists — ONE recipe (register F-17) · PLANNING + MOCKUP PROMPT

**Status:** commissioned by the owner 2026-09-16, on the table-standard follow-up walked as ledger
§194. **This session PLANS and DRAWS. It does not build.** Its output is a re-measured inventory, a
row-list recipe written into the standard, a register row per list, ONE hub artifact (mockups ·
decision panel · brief · plan · QA walk as tabs) and the plan + PM brief pair. The build is a later
session, gated on the owner's decisions on the panel.
This document is the **prompt** for that session, not the plan.

**Origin.** The app-wide table standard (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`, approved
2026-09-06) treats a `<table>` and a **row list** (stacked `<div>`/`<li>` rows of records) as one
thing (§1), and its register (`TABLE_EXCEPTION_REGISTER.md`) recorded **F-17**: *six row treatments
for one job* across the coach portal — schedule 31px/12px · practice plans and lineups 73px/20px
display 800 · closed-season shelves 38/44 · tags 71 · notifications 102 · scouting 68 — to be
brought to *one row-list recipe: comfortable density, `--type-body`, `--home-line`, an uppercase
`--type-support` label row when present.* It was deliberately not built with the rest ("own session,
own mockups — each list was drawn with its feature"). Everything table-shaped is now done: the
frame paints the card (F-24, 2026-09-16), cells are centred, the Development tables are on the
standard (F-25), and the Awards **Leaderboard** — a div stack the inventory never measured — became
a table the same day because a reader compares its totals across rows. **The row lists are what is
left, and they are now the only records surfaces in the portal that sit on the paper beside carded
tables.** The Awards screen showed the owner exactly that before the leaderboard moved.

---

## 1. What the owner asked, and the rule that governs the answer

> *"what is the scope of F-17?"* → *"write me a prompt for another session to do the
> planning/mockups for F-17."*

> **One axis of difference does not license the others.** A list may deviate from the recipe on a
> *named* axis, for a *stated* reason, recorded in the register. Every axis it did not claim an
> exception on follows the recipe exactly. A difference is in the register or it is a bug.

And the lesson this fortnight taught, which this session must not repeat:

> **A rule that says "over X" is a rule about X — measure X.** The standard said tables sit on the
> card ground with rows transparent *over it*; the gate verified the transparency and never the
> ground, and every list table shipped on the paper for ten days with a 40/40 walk behind it.
> **A recipe for row lists must name who paints the ground, and the probe must read the ancestor.**

---

## 2. Scope — and the three sorts of thing F-17's list actually contains

F-17's enumeration is **stale and impure**. Re-measure before deciding anything (§5), then sort every
candidate into one of three bins. The bin is the first decision on each row of the panel.

| Bin | Test | What happens to it |
|---|---|---|
| **A · It is a table wearing divs** | A reader **compares across rows** — a figure, a date, a status — or the rows have the same 3+ columns of the same kinds | Becomes a `<table>` on the shared frame: the frame, heading row, density, ground and figure twins arrive for free and it needs **no recipe**. The Awards Leaderboard is the worked example (2026-09-16). Say so; do not draw a row-list recipe around it |
| **B · It is a genuine row list** | A reader reads **one record at a time** — an event, a notification, an observation, a document — and a heading row would add nothing | Takes the **one row-list recipe** this session writes (§4); any departure is a register row |
| **C · It is not records at all** | A menu, a stepper, a chip rail, a rail of doors, a tile grid | **Out of scope** — remove it from F-17 with a sentence. The Ledger's `dateRangeOption` (a menu, 26px) and Tryouts' `howStep` (a stepper) are already on the list by detector accident |

Known candidates, from the 2026-09-06 inventory (1440 warm, `kind = list`) — **every row height and
size here is ten days old and some of these screens have been redrawn since**:

| Screen (sweep id) | Recipe class | Rows · height · body | First read |
|---|---|---|---|
| `coach-schedule` | `eventChip` | 5–6 · 31 · 12px | B — but the chip IS the schedule's idiom; is 12px a decision? |
| `coach-practice-plans` | `lineupFrontRow` | 6 · 73 · 20px display 800 | ⚠ redrawn by the practices re-evaluation (stages 1–4, 2026-09-14 → 16, owner-ruled D1–D14, L1–L9). Re-read the screen, not this row. A hub card that is a **door to a document** may be a tile (C), not a row |
| `coach-lineups` | `lineupFrontRow` | 5 · 73 · 20px display 800 | same class as above — decide them together |
| `coach-season-end` / the three finished shelves | `seasonRecordRow` 38 · `seasonDoorRow` 44 · `collapseSection` 55 | 14px | the closed-season ONE PAGE (owner ruling 2026-08-18) — shelves are the surface; the rows inside them are B, the shelves themselves are C |
| `coach-settings-tags` | `settingRow` 71 · `tagShelfLib` 45 | 14px | B (`settingRow`) — and the Awards Leaderboard borrowed this class until today: check nothing else does |
| `coach-notifications` | `item` | 3 · 102 · 16.8px | B — ⚠ the Notifications Redraw is BUILT with its walk owed; read `memory`/TODO before touching its numbers |
| `coach-history-scouting` | `scoutRow` | 6 · 68 · 14px | B (an observation is read one at a time) |
| `coach-player` | `miniRow` | 10 · 41 · 14px | likely A (a player's own rows of figures) or C (a summary rail) — decide |
| `coach-staff` | `railItem` | 11 · 22 · 14px | C? a rail of doors; 22px is under every floor — if it is a list of people it is B and short |
| `coach-tryouts` | `row` 176px · `howStep` 42 | 14 / 12px | `row` at 176px is a **card** (Tryouts One-Room ✅) — probably C; `howStep` is C |
| `coach-transactions` | `dateRangeOption` | 7 · 26 · 12px | C — a menu |
| `coach-roster` | `row` | 3 · 43 · 14px | the "Off the roster" fold — B, or A (it has the roster's columns) |

**Not on the list and must be looked for:** the Tournaments page ("Tournaments you run" / entered),
the Documents page if any part is not the table, the Overview's lists (One Thing — probably C), the
Depth chart, the practice library tabs (now `LibraryRow.tsx` — tables), the chat panel (not records),
the sponsor/drive rooms' non-table lists, anything under `components/coaches/` that maps records to
`<div>` rows. Grep is the method: `grep -rln "\.map(" app/[orgSlug]/coaches components/coaches |
xargs grep -L "<table"` narrows it; the rendered probe (§5) is the authority.

**Explicitly out of scope:** every `<table>` (done); the money grids (the standard's source);
the closed-season page's *shape* (ruled 2026-08-18); the practice plan **document/sheet** and the
library's circuit/station rooms (practices re-evaluation, ruled); the Notifications redraw's
*content* (walk owed); anything platform-admin or club-admin (F-12 / F-18, their own rows).

---

## 3. The questions the session must answer (these are the decision panel)

1. **Does a row list sit on the card?** The standard's ground sentence names *a table*. After
   2026-09-16 a list on the paper beside a carded table is two treatments on one screen — the exact
   thing the owner objected to. Recommendation to test in the mockups: **yes, a row list of records
   takes the same frame and card as a table** (border, radius, `--card-bg`, standing down at ≤ 640
   where the rows are already cards), and a list that should *not* (a schedule day's chips inside a
   calendar cell) is a register row with the reason. Draw both and let the owner pick.
2. **What is the recipe?** As tokens and relationships, never pixels (the standard's §3 discipline):
   density (comfortable by default — a row list's rows usually carry two lines — with compact by
   content via the same `.rowCaption` marker the tables read), type (`--type-body` item line,
   `--type-support` caption, the display face nowhere below a heading), hairline (`--home-line`),
   the optional label row (uppercase `--type-support`, secondary ink, the table heading's recipe),
   hover only on a row that opens (`--home-olive-soft` + pointer — F-03's rule), the door (name as
   the link or a real button, chevron last — K-07/K-08), the tap floor at ≤ 768 (K-12), and the
   card behaviour at ≤ 640 (a row list is already one record per row — does it change at all?).
3. **Which lists are really tables (bin A)?** Each one is a build with no design in it. Name them.
4. **Which lists keep a named exception (KEEP)?** The likely honest ones: the schedule's event chip
   (a calendar idiom, 12px by design?), the practice-plan / lineup hub cards if they are doors to a
   document (then they are tiles, bin C, and the question dissolves), the closed-season shelves'
   rows (a record is read, never edited — density may be compact). Each KEEP names its axis and its
   reason and the axes it is **still standard on**.
5. **How does it hold?** The table-recipe guard scans selectors that name a table part; a row list
   has no `th`/`td` to key on. Propose the marker (a `.rowList` / `.rowListRow` family the
   recipe lives on, or a `data-row-list` attribute) that both the stylesheet guard and
   `check:layout`'s `type-ladder` rule can find. **A recipe nothing can find will drift by
   Christmas.** Prefer extending a gate that exists (standard §9).

---

## 4. Constraints that bind the drawing (cite, do not re-decide)

- **Current season is the primary focus; history is quiet** (owner, binding design constraint on
  every shelf session). A recipe that makes the schedule or the plan hub noisier is a failed design
  regardless of how consistent it is.
- **A closed season is ONE PAGE** (2026-08-18) — the shelves are the surface; the recipe touches
  the rows inside them, never the page's shape.
- **The practices re-evaluation's rulings stand** (D1–D14 stage 1–3, L1–L9 the library, 2026-09-14
  → 16). Read `COACH_PRACTICES_REEVALUATION_PLAN.md` before drawing the plan hub. If the hub's
  cards are doors to a document, say they are tiles and leave them.
- **A shared component beats a shared class** (owner ruling): if two lists render the same record
  row, the recipe is a component, not two classes composing one marker.
- **One spelling, "8:00 a.m.", `formatTime()`** — a schedule row that shows a time is a customer
  surface; the mockup's times are house style.
- **No new grey token; the white-alpha ladder stops at /50** (2026-08-11). **No zebra** (A-03).
- **Every highlight in a mockup is clickable** and opens its explanation; **PIN IDENTITIES, not
  figures**, in the walk (the seed's numbers move).
- **Mockups are true-size, whole-screen, before/after, both skins, 390 + 1440**, on ONE artifact
  with tabs (mockup · decisions · brief · plan · QA walk) — the project-hub rule.

---

## 5. Method — measure first, on the served page

1. **Re-inventory.** The model is `scripts/.tmp-tablereview/measure-tables.mjs` (+ `dump-rows.mjs`,
   `aggregate.mjs`) — untracked scratch, the inventory's own probe; its list detector is what put a
   menu and a stepper on F-17, so **read every candidate's markup as well**. Sweep ids live in
   `scripts/layout-screens.mjs`; the coach session is `tests/uat/.auth/coach.json` on
   `uat-test-org`; theme via `localStorage.fl_user_theme`. Widths 390 and 1440, both skins.
   Record per list: rows · row height · item size/face/weight · caption size · label row · hairline
   colour · **the ground behind the row** (the ancestor's computed background — the lesson) · hover
   · what opens and how · tap size at 390/768. Write it as a dated section of
   `docs/agents/design/TABLE_INVENTORY_2026-09-06.md` or a sibling file — do not overwrite the
   09-06 numbers; the drift *between* the two dates is itself evidence.
2. **Bin every candidate (A/B/C)** with one sentence each. Bin A and C are decisions the panel
   confirms; bin B is what the recipe is drawn for.
3. **Write the recipe** into the standard as a new §3.10 "Row lists" (or fold it into §1 + §3 if
   that reads better) — tokens and relationships, with the ground sentence naming who paints it.
4. **Draw** the bin-B lists before/after on the recipe, plus question 1 both ways. The artifact's
   decision panel carries questions 1–5 as checkable asks with a recommendation each and a
   paste-back block.
5. **Register rows**: a FIX row per bin-B list (measured → recipe → why it drifted), a KEEP row per
   exception with its reason and its "still standard on" column, one line each for the bin-A
   conversions and the bin-C removals.
6. **Plan + PM brief** (`COACH_ROW_LIST_RECIPE_PLAN.md` / `_PM_BRIEF.md`) — sequenced by reader
   impact, the gate extension in the plan, the build's own §-walk sketched. Add the TODO line.
   **Do not build.**

---

## 6. What would make this session a failure

- Drawing a recipe for something that is a table (bin A) — the leaderboard was one; look for more.
- A recipe that does not say who paints the ground, or a probe that reads the row and not what is
  behind it (the F-24 failure, repeated on lists).
- Re-opening a ruled shape (the closed-season page, the practice document, the notifications
  redraw) because a consistent row would be tidier there.
- Pixels in the standard; per-screen classes in the recipe; a marker no gate can find.
- Answering the owner's question narrowly. If measurement shows the schedule's chips or the plan
  hub's cards are a different species, say so out loud before drawing them into the recipe.
- Building anything.

---

## 7. Suggested opening move

Read, in this order: the standard (§1, §3, §9), the register (F-17, F-24, F-25, K-07/K-08/K-09/K-12,
A-01/A-03), the 09-06 inventory's list rows, ledger §194, `COACH_PRACTICES_REEVALUATION_PLAN.md`'s
ruling tables, and the notifications-redraw entry in TODO. Then run the probe on the twelve screens
above at 1440 warm and put the twelve numbers beside the 09-06 numbers before forming a view.
Then bin. Then draw.
