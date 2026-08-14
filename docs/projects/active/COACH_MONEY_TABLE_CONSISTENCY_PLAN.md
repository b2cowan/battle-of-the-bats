# Coach Portal — Money Hub Table Consistency

**Status:** **Built 2026-08-13 — all four passes, owner-approved in full · ON PROD 2026-08-14 (Amplify job 256).** Owner QA pending
(`OWNER_QA_LEDGER.md` §12, Group 1C).
**Binding visual spec (once approved):** `claude.ai/code/artifact/14181bd3-93b2-4cb6-bb11-5f5eb28b14be`
(source: `docs/projects/active/COACH_MONEY_TABLE_CONSISTENCY_MOCKUP.html`)
**PM brief:** `COACH_MONEY_TABLE_CONSISTENCY_PM_BRIEF.md`
**Extends (does not reopen):** the 2026-08-13 action ruling and the two 2026-08-13 export rulings in
`memory/design_decisions.md`; the Chunk A/Chunk H mobile rulings (`.tableAsCards` vs `CoachScrollX`)

---

## 1. Trigger

Owner, on Budget vs. Actual and Budget Plan side by side, 2026-08-13: *"I am also noticing that our
formatting of tables is inconsistent across these screens, should we do something to aim for better
consistency?"*

They are right. This plan is the inventory that makes the question answerable, the rules that fall
out of it, and the work.

---

## 2. Phase A — the inventory

**Twelve table-shaped surfaces. Five treatments. Three actual jobs.**

### 2.1 Treatment 1 — the shared list table (5 surfaces)

`.tableWrap` + `.table` + `.th`/`.td` in `coaches.module.css`, wrapper carrying `.tableAsCards`.

| Surface | Cols | Card-stacks @640 | Drill |
|---|---|---|---|
| Player Dues — roster list (`dues/panel.tsx:658`) | 7 | ✅ | row → drawer |
| Expenses (`expenses/panel.tsx:634`) | 5 | ✅ (`cardStackCell` + `cardActionCell`) | row expands |
| Payment schedule (`expenses/panel.tsx:862`) | 6 | ✅ | per-row button |
| Allocations → instalments (`allocations/panel.tsx:246`) | 5 | ✅ | per-row button |
| Dues → one player's schedule (`dues/panel.tsx:995`) | 4 | ❌ **defect** | per-row button |
| Dues → refund preview (`dues/panel.tsx:844`) | 5 | ❌ **defect** | read-only |

Header: `0.72rem`, uppercase, `--white-35`, `--home-olive-soft` tint, `text-align: left`.
Cells: `.td` sets padding/colour/rule only — **no alignment, no `--font-data`**. Every money figure
is left-aligned and carries an inline `style={{ fontVariantNumeric: 'tabular-nums' }}` (≈30 call
sites). In card mode `.tableAsCards td` right-aligns, so the same figure is left on desktop and
right on a phone.

### 2.2 Treatment 2 — Budget Plan's outline (1 surface)

`budget.module.css` `.linesContainer` → `.categoryGroup` (12px radius) → `.categoryHeader` (flex,
name `0.72rem/--white-40` + total `0.82rem/--white-70`) → `.lineRow`/`.lineMain` (flex: chevron,
`.lineInfo`, right-pushed `.lineAmount`, `.lineActions`) → `.periodsTable`/`.periodRow` when
expanded. Right-aligned by virtue of `margin-left: auto`, not by a number column.

### 2.3 Treatment 3 — Budget vs. Actual's outline (1 surface)

`bva.module.css` `.tableHeader` (a loose grid head floating above the frames) → `.categoryGroup`
(10px radius) → `.categoryHeader` (grid `1fr 110px 110px 110px`, name `0.78rem/--white-50`) →
`.lineMain` (same grid) → `.periodRow` (grid `1fr 100px 110px 110px 110px`) → `.grandTotal`.
Wrapped in `<CoachScrollX sticky frame={false}>`; `.gridInner` min-width 520px @640.

**§2.2 and §2.3 are the same structure written twice** — different radius, different header layout
(flex vs grid), different name size, different muted ink, different row padding.

### 2.4 Treatment 4 — hand-built card lists (3 surfaces)

No shared class between them; every border, size and colour is an inline style at the call site.

| Surface | Shape |
|---|---|
| Fundraisers (`fundraisers/panel.tsx:224`) | `.detailSection` link cards; **3 uppercase micro-labels repeated per card** |
| Payables (`expenses/panel.tsx:726`) | `.detailSection` cards; deposit/balance printed inline |
| Payments (`payment-requests/panel.tsx:300`) | `.detailSection` cards; badges + amount inline, **no column labels at all** |

Fundraisers is the repeated-label trap the owner already ruled on for the Export menu: 3 labels ×
N rows.

### 2.5 Treatment 5 — the 2-D money grid (2 surfaces)

| Surface | Implementation |
|---|---|
| Budget Plan → By period (`budget/panel.tsx:209`, `.periodGrid`) | real `<table>` in `CoachScrollX sticky`; two-row head (year band over periods); head **not** sticky-top; no `--font-data` |
| Budget vs. Actual → Months (`components/coaches/MoneyMonthGrid.tsx`) | real `<table>` in `CoachScrollX sticky`; sticky `thead`; `0.66rem` + `--font-data`; opaque pinned lead column; `wrap640` on labels |

Both correct in behaviour; **MoneyMonthGrid is the better-specified of the two.**

### 2.6 What the inventory turned up

1. **⚠ No number treatment exists in the shared table.** Five surfaces left-align money. The
   portal's own design principles already require `--font-data` for numeric columns; none of the
   five use it. Highest visible payoff, smallest change.
2. **⚠ Two tables scroll sideways on a phone with no hint** — Dues' per-player schedule and the
   refund preview sit in a bare `.tableWrap` (`overflow-x: auto`) with neither `.tableAsCards` nor
   `CoachScrollX`. This is a silent sideways scroll, the exact defect `CoachScrollX` exists to
   prevent.
3. **⚠ Three lists have no shared class at all.** They resemble each other by coincidence, not by
   contract.

### 2.7 Noted outside scope (fix nothing)

The same five-treatment split exists on Roster (`.rosterTable`, its own `@640` fork rather than the
shared primitive), Schedule, Attendance and Results, and on the admin side. **Recorded, not
touched.** The shared pieces in §4 are designed to be liftable to them later.

---

## 3. Phase B — the rule

**Consistency here is not one table. It is at most one treatment per JOB — and there are three
jobs.**

| Job | What it is | Surfaces |
|---|---|---|
| **List** | many records of one kind, one row each, read down a column, act on a row | 8 |
| **Outline** | categories → lines → periods, a figure at every level, expand in place | 2 |
| **Grid** | a comparison read *across* (time, or plan vs actual) | 2 |

Five treatments collapse to three. Every surface must be able to name its job.

### 3.1 Shared across all three (the liftable piece)

1. **One number cell** — right-aligned, `font-variant-numeric: tabular-nums`, `--font-data`, one
   size. Retires ≈30 inline `fontVariantNumeric` styles.
2. **One column-heading recipe** — uppercase, letter-spaced, one muted ink, one tint; with a
   documented **dense** variant for grids carrying 12+ columns (a 12-month grid cannot use the
   list's 0.72rem).
3. **One category bar** (outline + grid).
4. **One row rule and one hover.**

These land in `coaches.module.css` beside `.tableAsCards`/`.scrollX`, so the primitive list at the
top of that file stays the single index — the Chunk A lesson that produced three duplicate `@640`
rules in one commit.

### 3.2 The exceptions, defended

- **Budget Plan stays a card stack.** It is an editable outline with nested instalments and per-row
  actions, not a report. It adopts the shared chrome; it does not become a list.
- **The month grid scrolls sideways on a phone with the first column pinned.** Standing ruling
  (`memory/design_decisions.md`, Chunk H). Untouched.
- **Card-stacking on phones, one label per stacked cell.** Untouched. A desktop table that becomes
  an unreadable phone table is a regression.
- **Payables' deposit/balance nesting** becomes an expand-in-place sub-row (the outline's own
  idiom), not a card printing both inline. The Payment schedule sub-tab already tabulates exactly
  these rows, which is the argument.

---

## 4. Phase C — the passes

| Pass | Outcome | Surfaces touched |
|---|---|---|
| **1** | **Money lines up.** Shared number cell + column heading. No layout or control moves. | all 5 list tables + both grids |
| **2** | **One outline.** Budget Plan List and BvA Categories render from one frame/bar/row. | 2 |
| **3** | **The three card lists become lists.** Fundraisers, Payables, Payments. | 3 |
| **4** | **The two grids agree; the phone gaps close.** By-period adopts the month grid's head/type; the two orphan Dues tables get a phone treatment. | 4 |

Sequential, each independently shippable. Pass 1 is the largest perceived change for the least risk;
Pass 3 is the only one where a coach sees a different desktop shape.

---

## 5. Traps carried in from the build prompt

- **`npm run check:layout` aborts on memory on this machine.** Run sliced:
  `--only=coach-accounting,coach-budget,coach-budget-vs-actual,coach-expenses,coach-dues`.
  **An aborted sweep exits 0 through a pipe — read the output, never the exit code.** Never lower
  `DEV_FREE_FLOOR_MB`.
- **The tap-target baseline is a ratchet with reasons** (`scripts/.layout-baseline.json`). Prune
  only entries proved fixed — an entry can stop reproducing because the seed changed.
- **Anything drawn beside every row is drawn as many times as the list is long.** Multiply before
  adding a per-row affordance. (This is also the argument *for* Pass 3.)
- **Colour/contrast are guarded** — `check:tokens`, `check:contrast`, `check:text-contrast`. No raw
  hex; third text tier is the white-alpha ladder capped at /50.
- **`composes` is NOT transitive under Turbopack**; warm-portal literals must be tokenized.
- **Money panels stay mounted** (`display:none` while inactive). Nothing here may remount a panel.
- **`verify:changed` currently fails on schema parity** (prod behind dev on migrations 230/231) —
  pre-existing, not ours.

---

## 6. Verification

- Rendered sweep sliced across the Money hub between passes, measured at 390 / 640 / 834 / 900 /
  1024 / 1280 / 1440. The portal's sidebar makes card width non-monotonic in viewport width, so one
  width proves nothing.
- `npm run typecheck` + `npm test` + `npm run verify:changed` after each pass.
- `/simplify` then `/review` on each pass (shared-class extraction is exactly the diff shape
  `/simplify` exists for).
- **`/docs`** — the in-app Money guide (`lib/help-content/coaches.tsx`, `premium-money`) describes
  these screens; same unit of work.
- **Demo check** — the coach sandbox (`riverdale-ridge`) tour steps and moments dock are grepped for
  any sentence describing a money table.
- Owner QA rides `OWNER_QA_LEDGER.md` §12 (Group 1C).

---

## 7. Blocking decisions — ALL RESOLVED 2026-08-13

Owner approved the three-job model, the conversion of all three card lists, and all four passes.

---

## 8. ⚠ THE RENDERED GATE WAS MEASURING EMPTY STATES

The single most consequential thing this pass found, and it is not about tables.

**Every Money screen in `check:layout` had been sweeping a "nothing here yet" card.** The UAT layout
fixture (`scripts/seed-uat-coach-fixture.mjs`) had **zero** budget lines, dues schedules, expenses,
payables, fundraisers and payment requests. `coach-budget`, `coach-budget-vs-actual`, `coach-dues`
and `coach-expenses` were green because there was nothing on them to measure. This is the same
failure the seeder's own docstring already records for the Game-Day console ("a fixture with only a
practice cannot reach that screen at all, which is how three phases of it shipped with no rendered
layout check") — it had simply never been noticed for Money.

**Three tabs had no coverage at all.** Fundraisers, Payments and Allocations are hub tabs, and the
hub keeps inactive panels mounted at `display: none`, which has zero geometry. `coach-accounting`
proves only whichever tab opens by default. Their standalone routes are now swept as
`coach-fundraisers` / `coach-payment-requests` / `coach-allocations`.

**Fixed in this pass:** the seeder gained a Money section shaped to make each surface render its
FULL structure (a funding line, one line split across periods, dues in three states, a payable with
both halves, a fundraiser active and closed, a request per status), and the three routes joined the
screen list. With data present the sweep immediately found four real defects — see §9.

⚠ **Generalises: a green sweep over an empty fixture is not evidence.** Before trusting this gate on
any surface, check that the fixture actually populates it.

---

## 9. What the sweep caught once it could see

Four defects, none of which any file-reading gate could have found:

1. **Budget Plan line names spilled the page** — up to 39px of document sideways scroll at 361px.
   Two causes, both in the new shared ledger: a bare `1fr` track floors at `min-content` (now
   `minmax(0, 1fr)`), and `.ledgerDesc` had no `display: block`, so its `overflow`/`text-overflow`
   did nothing on an inline box. It read as blockified in Budget vs. Actual (direct flex child) and
   not in Budget Plan (inside a stacked name+note cell) — exactly the difference source-reading
   misses.
2. **The pinned first column was trapped.** `.ledgerGroup`'s `overflow: hidden` became the nearest
   clipping ancestor of the pinned cell inside Budget vs. Actual's scroller, so the category label
   would sail away on the first swipe instead of sticking. The category bar rounds its own corners
   now; the frame does not clip.
3. **`.cardActionCell` never had a tap floor.** Its docstring has promised a "full-width,
   full-touch-target button" since Chunk A, but nothing set a height — Fundraisers' Open, Payments'
   Details and Cancel, and the Dues instalments' Mark Paid were all 28–32px on a phone. Now
   `min-height: var(--tap-min)`. ⚠ This reaches every list table in the portal, not only Money's —
   deliberately, since the promise was portal-wide.
4. **A pre-existing AA contrast failure on Budget vs. Actual.** `.summaryHint` ("under budget",
   "incl. $X not itemized yet") used `--white-30`, which the warm portal remaps to a **hairline**
   token — rgba(70,55,30,0.2) on its own ground. Invisible to `check:text-contrast`, which reads
   declared colours rather than rendered ones. Now `--white-45`.

**Baseline:** 181 entries added, **every one with a written reason** (portal chrome newly covered ·
pre-existing Money controls newly visible · the fundraiser name link, whose row carries a 44px Open
control · SVG chart labels). **Nothing was pruned** — the 42 entries that "no longer reproduced"
during the empty-fixture run all reproduced again once the fixture had data, which is precisely the
trap the plan warned about.

---

## 10. Log

- **2026-08-13** — Phase A inventory taken across all 12 Money-hub table surfaces; three defects
  found; three-job model and four-pass phasing drawn as the binding mockup.
- **2026-08-13** — **owner approved in full; all four passes BUILT on dev.** Delivered: the shared
  `.thNum`/`.tdNum` number column across all five list tables (≈30 inline styles retired) and a
  settled balance dropped to muted ink; the shared **ledger** (`.ledgerList` / `.ledgerGroup` /
  `.ledgerGroupHead` / `.ledgerRow` / `.ledgerSubRow` / `.ledgerNum` / `.ledgerTotal`, column count
  carried as `--ledger-cols`) replacing Budget Plan's and Budget vs. Actual's two independent
  outlines; Fundraisers, Payables and Payments converted from hand-built card lists to the shared
  list table, with Payables' deposit/balance pair moving one click in behind **Payment details** and
  a derived status pill; the two money grids unified on one heading recipe (the plan grid's, which
  carried the reasoned 2026-08-12 size-up — the month grid moved to it, and gave the plan grid its
  sticky heading in return); and the two Dues tables that scrolled sideways in silence given the
  card-stacking every other list has. `.cardActionLabel` added to the shared mobile primitives.
  Four cascade collisions were pre-empted with doubled selectors (`.fundingGroup`, `.fundingAmount`,
  the Budget-vs-Actual pin gutters) — see `memory/reference_cascade_collisions_coach_budget.md`.
  **The fixture and sweep-coverage work in §8 is part of this unit and is the more durable half.**
  `/docs` run: the Money guide gained the Payables row-and-details description and new keywords.
  Demo check: the coach sandbox's money narration ("line by line", "the report says so rather than
  hiding it") is still true and its tour anchor survives; `check:demos` passes.
  ⚠ `verify:changed` fails only on **schema parity** — prod behind dev on migrations 230/231,
  pre-existing and out of scope.

- **2026-08-13 (later, owner review of the render)** — ⚠ **PASS 4 HAD UNDER-DELIVERED AND WAS
  REPORTED AS DONE.** It unified the two grids' heading row and pinned-column width only; their
  bodies were never touched, and the owner said so on sight: *"these still look like 2 differently
  formatted tables."* Finished in this round, with two owner rulings recorded in
  `memory/design_decisions.md` — **a parent row is the LARGEST name in its group** (the category was
  drawn smaller than the lines it grouped, on both screens, in opposite directions from each other),
  and **every hierarchy in a table is collapsible** (the By-period grid and the Budget Plan List view
  gained chevrons; closed-set not open-set, so a category added later arrives open).

  **The defect underneath it:** globals.css styles a bare `<th>` as a COLUMN heading — uppercase,
  letter-spaced, condensed display face — and a ROW heading is also a `<th>`. Budget Plan's grid had
  cancelled that LOCALLY; **Budget vs. Actual's month grid never did**, so every line name the coach
  typed, its closing total and its whole cash-flow strip rendered as `WINTER DOME BLOCK` in a face
  used nowhere else for a coach's own words. Measured with computed styles, not screenshots. The
  reset now lives in a shared `.moneyGrid` treatment both grids read. Also fixed: the month grid
  printed **two** minus signs on negatives, and its closing total sat quieter than the rows it summed.
  **Negative money stays red** (owner) — distinct from expected funding, whose minus is arithmetic
  and stays green.

  Verified by reading computed styles: both grids now measure identically (category 14.72px/800,
  line 13.44px/600, total 14.72px/800, sentence case, body face) and the negative running balance is
  `#B03A22`. Sweep green across all eight Money screens; **4 baseline entries pruned — the only ones
  in this whole pass — because the same padding change provably fixed them.**

- **2026-08-13 (third round) — ⚠ THE SAME MISS, A THIRD TIME, AND NOW GUARDED.** Owner:
  *"shouldn't we also be consistent between list and by period?"* The ruling that a category is the
  largest name in its group had been applied to the GRID treatment and not to the OUTLINE, so one
  toggle on Budget Plan turned "Tournaments" into "TOURNAMENTS" and inverted the hierarchy straight
  back. The category band was a different colour between the two views as well.

  **The pattern is now unmistakable and is the real lesson of this project: each time, the fix went
  to the half being looked at.** Heading rows but not bodies; grids but not outlines. A comment
  asking the next contributor to change both had already failed twice.

  **So the third fix is a test, not a comment.** `tests/unit/money-hierarchy-type-scale.test.ts`
  parses the real stylesheet and fails the build if the outline and the grid disagree on the size or
  weight of a category, a line or a closing total — plus two rules with teeth: a category must
  measure LARGER than its own lines, and neither treatment may set a category in small caps. It
  asserts EQUALITY, not values, so the scale can be re-ratified freely; it just cannot fork.
  **Verified by BREAKING it** (reinstating the old small-caps category turns it red, 4 failures) —
  a green test never shown to fail is not evidence.

  Confirmed on screen with computed styles: List and By period now both read category 14.72px/800,
  line 13.44px/600, total 14.72px/800, sentence case, same ink. Suite 1680/1680; sweep green across
  all eight Money screens.

- **2026-08-13 — `/review` (high-risk tier, 5 lenses) and `/simplify` (4 lenses) both run.**
  **11 defects fixed, all introduced by this work.** The consequential ones: a Payables control with
  **no accessible name on desktop** (its only text sat in a span hidden above 640px); `.cardActionLabel`
  **never rendering at any width** (a media rule declared before the unconditional one it had to
  beat); the **pinned category label going see-through in BOTH grids** — the Chunk A D3 defect
  reintroduced by a `background` shorthand out-ranking the month grid's local opaque override; a
  payable reading **"Overdue" with nothing owed** (the overdue check reads a due date and knows
  nothing about whether an amount exists); line notes not wrapping on phones; a phone indent
  regression; three dangling class references; and the seeder's **category filter matching nothing**
  (`scope: 'rep'` does not exist — every seeded line landed in "Uncategorized", and the probes said
  so without anyone reading it) plus two silent half-seed paths.
  ⚠ **The wrap fix had to be measured twice** — the first attempt landed the override above one of
  the declarations it needed to beat, i.e. it fell into the very trap it was fixing.
  ⚠ **One review recommendation was REFUSED**: replacing a shared overdue helper with an inline date
  comparison to save a formatter rebuild would have reintroduced the four-way duplication that
  helper's own docstring was written to end. Sub-millisecond gain, documented decision — declined.
  ⚠ **One `/simplify` finding was WRONG and nearly shipped**: an "empty, removable" rule turned out to
  be the ancestor in three live selectors (the pinned header corner and two column-heading colours).
  Verified by rendering before and after; the class token is back with a note.

  **Cleanup applied:** the type scale moved into **CSS custom properties** both families read, so
  four of the guard test's six assertions are now structurally impossible to violate rather than
  merely watched (re-verified by breaking it two ways); one shared `toggleKey` replaced six
  byte-identical copies that had already drifted into two spellings; ~55 lines of dead CSS deleted
  after checking every importer; a comment asserting a false constraint corrected.
  **Deliberately skipped, with reasons:** parallelising the seeder (a rarely-run fixture script just
  hardened for correctness — terseness is not worth re-risking it), memoising two pre-existing
  render-body computations (dep-array risk against a negligible gain), and merging the two class
  families into one component (a multi-day rewrite of two already-QA'd screens for no user-facing
  benefit — the type-scale test is the cheap answer to the only thing genuinely shared).
