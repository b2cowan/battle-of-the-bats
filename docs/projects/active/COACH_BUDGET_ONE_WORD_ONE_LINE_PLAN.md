# One Word, One Line — collapsing the Budget plan's third level

> **Status:** BUILT on dev 2026-09-09 — migration 286 applied to dev and verified there; owner QA walk and `check:layout` OWED. **Migration 286 is PROD-PENDING** (declared in `MANUAL_PROD_STEPS.json`).
> **Created:** 2026-09-09
> **Branch:** dev
> **Walk:** Artifact `444d13c4` · source `docs/projects/active/COACH_BUDGET_ONE_WORD_ONE_LINE_WALK.html`
> **Mockup (round 1):** Artifact `a6a3b078` · source `docs/projects/active/COACH_BUDGET_ONE_WORD_ONE_LINE_MOCKUP.html`
> **PM brief:** `docs/projects/active/COACH_BUDGET_ONE_WORD_ONE_LINE_PM_BRIEF.md`

## Goal

A team's season budget is four levels deep: **category → budget word (item) → line → payment period**.
This plan removes the third. A budget word may carry **exactly one line per season plan**; picking a
word that is already on the plan **adds to** the line that is there instead of starting a twin. The
consequence is that the plan, the by-period grid, Budget vs. Actual and the exported file all describe
the plan at the same depth — which they do not today.

Nothing this plan does changes a total. Planned costs, Planned funding, Player installments and every
variance are identical before and after.

---

## Why (argue from what the code does, not from the screens)

1. **Money never moves at the line level.** Actual spending and money back are matched to the plan by
   **item**, never by line (`rollupMoneyReport` in `lib/coach-budget-rollup.ts` keys `ItemRow` on
   `itemId`). Two lines on one word are, to every figure the product prints, one thing wearing two
   labels — there is no variance, no match, no report that can tell them apart.

2. **Three of the four surfaces already merge them, and one cannot show them at all.**
   - Plan list (`…/accounting/budget/panel.tsx`) — merges into an item row, opens to sub-lines.
   - By-period grid (`lib/coach-budget-periods-view.ts`) — merges into one row, and the row **cannot
     be opened** (the accepted casualty recorded in `memory/decision_no_line_count_on_a_row.md`).
   - Budget vs. Actual (`…/budget-vs-actual/panel.tsx`, `RecordsBehind`) — merges, and lists the lines
     behind the planned figure only when the panel is opened.
   - Export (`lib/coach-money-exports.ts`) — merges, and prints the lines as indented sub-rows.

3. **The level fails silently.** A note-less second line is named by its own month, which is also
   printed in the When column beside it. On this repo's own fixture "Entry Fees" printed three times in
   one column for weeks and nobody reported it, because the rows still added up (the defect that
   produced `mergedSubLineName`).

4. **Nesting is where the file keeps breaking.** The §156 `/review` found estimate rows exported as
   indented items were hidden in Excel and re-imported as phantom lines; a HIGH from the §158 review is
   still open (money-in lines re-import as new cost lines). A flat one-row-per-word file removes the
   shape those defects live in.

### The counter-argument that was rejected, and why it is recorded here

"If a coach wants two rows, they make a new item" is **not** the escape hatch. Items are the shared
vocabulary (`lib/coach-budget-item-tiers.ts` — platform / club / team tiers, and publishing no longer
deletes). A one-season, one-event word would persist in the picker, would be offered to every team in
the club if made at club tier, and — because the item is the join key between plan and actuals — a
coach who invents a word must pick the same word when recording the expense or the report shows the
money as "moved, never budgeted". The standing vocabulary cleanup (`COACH_BUDGET_CATEGORY_IS_THE_SHELF_PLAN.md`
§7 — two seed generations, seven overlapping words) is the reason not to add a generator of one-off
words.

**The escape hatch is the schedule, which is already built:** two entry fees at different times are one
line with two dated periods — the exact shape the by-period grid and the cash-flow view want. The only
case that does not cover is two of the same word in the same month, where a single sum is honest.

---

## §0 — BLOCKING GATE (nothing below starts until these are done, in order)

- [x] **1. Mockups, published as an Artifact, reviewed by the owner.** Done — round 1 is Artifact
      `a6a3b078`, seven specimens: the add form, the plan list row, the by-period grid (unchanged),
      the Budget vs. Actual panel, the exported file, the **whole plan screen before/after**, and the
      legacy-twins A/B.
- [x] **2. Count the twins on BOTH databases — DONE 2026-09-09, and the number decided Q3.**
      Queried live on both databases, never read off a plan:
      **dev** — 60 lines, 8 with no word, **5 twin groups (10 lines), 4 of them carrying a note**,
      biggest group 2, affecting 3 of 11 plans. **prod** — 21 lines, 0 without a word, **1 twin group
      (2 lines), neither carrying a note**, affecting 1 of 4 plans. Six lines rewritten on dev, one on
      prod: Option B was close to free, exactly as the mockup argued it would be.
- [x] **3. Owner rulings Q1–Q5 — ALL TAKEN AS RECOMMENDED, 2026-09-09.** Q1 yes · Q2 add-to with
      the "Open that line instead" door · Q3 Option B (join once, now) · Q4 allow a partly-undated
      line, materialised as an undated period · Q5 keep the panel, showing the schedule.

---

## What was built (dev, 2026-09-09)

### Phase 3 — the one-time join (ran FIRST, so everything after it could assume the invariant)

- [x] **Migration 286** `286_one_word_one_line_on_a_plan.sql` — applied to dev, **prod pending**.
      Part 1 joins the twins (earliest line survives; amounts summed; notes joined with `; `;
      periods re-sorted date-first); part 2 adds the partial unique index
      `rep_budget_lines_one_line_per_item on (program_year_id, team_id, item_id) where item_id is not null`.
- [x] **Both foreign keys re-pointed BEFORE any delete** — `rep_budget_periods` (CASCADE) and
      `rep_player_dues_schedules` (SET NULL). This was the plan's headline risk and the migration
      does it in order; do not reorder those statements.
- [x] **Q4 in the data too:** after the join, an unscheduled remainder is materialised as a real
      undated period labelled "No date yet", so every joined line still satisfies "the split sums to
      the total" and the coach's next edit of it can save.
- [x] **Verified on dev by query, not by a gate:** 0 twin groups left, 0 splits that do not sum,
      0 orphaned periods, 1 undated period created (the Q4 rule fired once).
- [x] `refresh:snapshots` run; `DATA_DICTIONARY.md` updated (the `item_id` entry now carries the
      uniqueness rule and its reasoning; gotcha 7's "two lines on one item SUM" note is corrected to
      say it survives only for the word-less bucket).

### Phase 1 — the form

- [x] The **"already on this plan"** panel under the picker: the word, what it already holds, its
      schedule, and **"Open that line instead"**.
- [x] **"Amount to add"**, the When question naming the amount being added, and two quiet preview
      rows above the footer: `$600.00 planned + $900.00 → $1,500.00` and the joined schedule.
- [x] Primary button reads **"Add to {word}"** — a save that creates no line must not say "Add Line".
- [x] Notes is **"Notes"** again, pre-filled from the existing line and never over anything typed.
      `itemSiblingCount`, the conditional label, its placeholder and its hint are gone, and
      **nothing explains the pre-filled note** (`decision_no_line_count_on_a_row`).
- [x] Save PATCHes the existing line. The join rule is extracted as `joinPeriodSplits`
      (`lib/coach-budget-periods-payload.ts`) so it sits beside the "split sums to the total" checker
      it has to satisfy, and is unit-tested against that checker.
- [x] **Editing** a line onto a word another line holds is refused and the line in the way is NAMED —
      client-side as a blocking problem, server-side as a 409. Merging two saved lines would destroy
      one from a control that only says "change the word".

### Phase 2 — the other doors

- [x] Create route: 409 naming the word, with `existingLineId` in the body.
- [x] Edit route: the same 409 when the chosen word is taken, checked before the update so the coach
      gets a word rather than a raw constraint error.
- [x] Import route: a row whose word is already on the plan — or already written **earlier in the same
      file** — is **skipped with the word named**, not summed and not overwritten. Summing would
      invent an amount nobody typed; overwriting is what used to happen when two rows shared a match.
- [x] Carry: no guard needed, and the reason is written where it would go — both callers copy into an
      empty plan, and the index covers every season.

### Phase 4 — the nesting comes out

- [x] Plan list, cost side: rows branch on `item.itemId`, not on line count, so the one group that
      remains is visibly the word-LESS bucket rather than a twin case someone might re-add.
- [x] Plan list, money-in side: one row per word, no summed head.
- [x] `mergedSubLineName` and `BudgetLineRow`'s `hideWhen` deleted, each with a headstone.
- [x] Budget vs. Actual: the planned figure opens onto the **schedule** plus the word's note, with the
      footer as the door back to the plan; "These are shown as one row because they name the same
      item" retired.
- [x] Export: no indented sub-rows on either side; `subLineLabel` deleted with a headstone carrying
      the rule that outlived it — never print a name the library could not match back.

### Phase 5 — everything that described the old behaviour

- [x] Help: the coach money guide's budget paragraph rewritten; the retired question removed from its
      `keywords`, and eleven terms added for what a coach would now type.
- [x] Demo seed: the **deliberate twin** on "Entry Fees" removed — it would now fail the unique index —
      **with its $400 folded into the word** so the demo's season total does not quietly drop.
- [x] UAT fixture: the second-line block becomes a fold-and-remove repair, and "Spring classic entry"
      is seeded at the joined $2,500.
- [x] New tests `tests/unit/coach-budget-line-join.test.ts`: the join rule (including both one-sided
      cases, asserted **through the write door's own checker**) and a source guard that the retired
      question is gone from the screen, the help and the demo seed.
- [x] Export tests rewritten to the flat shape; the old ones' reasoning kept as the argument for the
      change rather than deleted.

### `/simplify` — 2026-09-09, four lenses in parallel

**Applied (seven):**
1. **`joinPeriodSplits` imports the undated label instead of taking it as a parameter.** The "this
   module imports nothing" boundary was false — its own sibling `coach-budget-periods-view.ts`
   imports two lib modules by relative path with the extension for exactly the `node --test` reason
   the parameter cited. **Passing a label across a module boundary is the shape that lets a second
   spelling in**, which is the one thing the one-spelling rule exists to stop.
2. **Both write doors write first and read the clash out of the failure**, rather than pre-checking.
   A pre-check is check-then-act: it cost a round trip on every ordinary save and still lost the race
   it existed for, handing the loser a raw constraint error. Now the index refuses, and a shared
   helper turns that refusal into a sentence naming the line in the way — one path covering the
   common case and the race.
3. **One home for the server half** — `findLineHoldingItem`, `isDuplicateItemLineError` and
   `duplicateItemLineResponse` in `lib/coach-budget-items.ts`, where the other budget-word write-path
   rules already live. The two routes had the same query and the same 409 body written out twice.
4. **`whenMonthsText` beside `whenSummaryText`** — the "months only, never `whenSummaryText`, because
   its undated tail is a FIGURE that goes stale against the next cell" reasoning used to live inside
   the deleted `mergedSubLineName`. It was re-inlined twice by this build; now it has a home again.
5. **One predicate for "which line holds this word"**, used by both the render-time derivation and the
   picker's note pre-fill, which had restated the `.find` by hand.
6. **The single-use `itemTakenByOtherLine` alias is gone** — the rule now reads at the refusal itself.
   `isEdit` derives from `targetId` rather than re-testing the same thing; one nested ternary off the
   remembered split mode; the report panel reads its one plan line once instead of four times.
7. **The test uses the repo's shared, string-aware comment stripper** (`tests/unit/_source-code.ts`)
   instead of a fourth hand-rolled copy — that helper exists precisely because a naive stripper both
   false-fails on a doc comment and, far worse, **passes when the code is deleted and the paragraph
   explaining it survives**.

**Skipped, with reasons:**
- **The two hand-typed "No date yet" literals in `components/coaches/MoneyMonthGrid.tsx`** should now
  import `NO_DATE_LABEL`. Real drift, but **pre-existing** (it predates this change) and that file was
  another session's uncommitted work at the time. Left for whoever owns it — noted here so it is not lost.
- **The money-in list's `flatMap` was not narrowed to `.map`.** The index does guarantee one line per
  group, so the flatten is vestigial — but if that invariant were ever violated, `flatMap` renders both
  rows (money visible) while `.map` would render the first and silently hide the rest. **Prefer the
  shape that cannot hide money over the one that is one word shorter.**
- **The importer's `lineIdByItem` map was not replaced by the new helper.** A batch import wants one
  map, not a query per sheet row; the reviewing lens said so itself.

### `/review` — 2026-09-09, high-risk tier, five lenses

Deterministic gate first: 3,363 unit tests · typecheck clean · lint 0 errors · migration + snapshot +
dictionary + spelling + selectors + export catalog + date-correctness all green.
`check:schema-parity` red by design (the dev-only index). **`check:layout` NOT run** — shared dev server.

**Eight defects confirmed and fixed.**

1. **HIGH — a coach's honest save could be refused.** Each side of a join is only ever held to ±$0.02
   of its OWN total (the tail an even split leaves), so two splits that were each accepted on save
   could concatenate to $0.04 from the joined total — **past the tolerance the write door then
   enforces.** The coach would have met *"Period amounts must sum to the line total"* on a save the
   product built for them. `joinPeriodSplits` now reconciles the tail in both directions; two tests
   pin it, asserted through the write door's own checker.
2. **HIGH — a QA fixture script would have crashed outright.** `scripts/seed-qa-day-fixtures.mjs`
   still seeded two lines on *Entry Fees*; against the new index the second insert 23505s and the
   script's `die()` aborts the whole run — taking `--practice` (which requires `--money` to have run)
   with it. Joined, exactly as the migration joins.
3. **MEDIUM — the printed budget-plan exhibit would have gone blank in two columns.** The PDF
   fixture is untyped `.mjs`, so tsc could not see that its items lacked the now-required identity —
   every cost row would have read as the word-less bucket and printed an empty Schedule and Notes. It
   also still carried the retired two-lines-on-one-word shape. Both fixed. ⚠ **And it was missing
   `costsLessFunding` from an EARLIER project (§156's ladder)** — the same failure class the file's
   own comment two lines above documents. Adopted and fixed rather than left beside my own.
4. **MEDIUM — a pre-filled note outlived the word it came from.** Pick a word already on the plan
   (note pre-fills), reconsider, pick a different word — the note stayed, and a brand-new line saved
   wearing another word's words. A pre-fill is now replaced on every pick unless the coach has
   actually typed in the field.
5. **MEDIUM/HIGH — two writers could silently erase each other.** A join sends an ABSOLUTE total read
   from a snapshot; two tabs (or a coach and a money assistant) each adding to one word meant the
   second save overwrote the first with no error — the index guards a second LINE, never a stale
   figure. The join now sends the figure it was computed against and the server refuses if the line
   has moved, naming what it now reads. ⚠ **Sent only by a join:** an ordinary edit shows the coach the
   number they are replacing; a join merges a figure they may never have looked at.
6. **LOW/MEDIUM — the refusal named a line the coach could not open.** Both doors returned the id of
   the line already holding the word, and nothing read it — *"open that line"* was an instruction to
   go hunting. The panel now opens it.
7. **LOW — the importer showed a raw constraint error** on the one race its map cannot close. It
   speaks the coach's words now.
8. **LOW — the UAT fixture's twin repair dropped the dues-schedule re-point** the migration calls its
   whole risk. Inert today (nothing writes that column) and added anyway: an omission that is only
   safe because of a fact somewhere else is the one that breaks the day that fact changes.

**Accepted, named rather than hidden:**
- **Migration 286's remainder rule is one-sided** — it tops up an under-scheduled join but does
  nothing for an over-scheduled one, so a legacy pair that had each drifted the same way could leave a
  line already outside the tolerance. **Measured zero on both databases** (no line on dev or prod has
  a split that fails to sum, before or after), so it is unreachable on the actual data. The live path
  is fixed by finding 1. **Verify the same query on prod after applying.**
- **A join's period replace is two statements, not a transaction** (pre-existing). If the delete lands
  and the insert fails, the line keeps its joined total with no schedule — and a join risks the
  *pre-existing* line's dates as collateral, where an ordinary edit risks only what the coach just
  typed. The modal stays open on the error and a retry is idempotent.
- **A concurrent NOTE-only change is still overwritten** by a stale pre-fill. The total guard does not
  see it. Low.
- **The migration's keeper row is not locked** across its statements. A concurrent delete of exactly
  that row aborts the migration loudly rather than corrupting anything.
- **The security and tenancy lens came back clean**, and said why: every scope reaching the new helper
  is session-derived, the only caller-supplied value is an item id already authorised, and the join's
  group key includes the team so it cannot merge across tenants.

### Deviations from the mockup, flagged at build time

1. **The exported file keeps its statement shape.** The mockup's "after" specimen drew a flat table
   with Category and Item columns and no band/category/subtotal rows — which would have deleted the
   closing ladder §156 added on the owner's own instruction ("with no grouping or subtotals it
   doesn't read like x + y = plan"). What shipped removes **only the indented sub-rows**; bands,
   category rows, both subtotals and the ladder stay. That is the part of the specimen that carried
   the argument (nesting is what breaks the round trip); the column redesign was over-drawn.
2. **The import skips a duplicate row rather than adding to the line.** The form adds because the
   coach is watching; a file is not, and a sheet holding one word twice is a mistake only the coach
   can resolve.

### Owed

- [x] Owner QA walk written — ledger **§162**, instrument published as artifact `444d13c4` (twenty steps in five parts; Part E is four rulings, one checkbox per option so the tick IS the answer). Logged on the run order as step **B20** (B19 was claimed by a peer session mid-write).
- [ ] The walk taken, findings fixed, §162 closed.
- [ ] `check:layout` rendered sweep (not run in this session; the dev server is shared).
- [ ] **Migration 286 on prod**, at promote time. ⚠ **Do not apply it ahead of the code**: the index
      would make the CURRENTLY deployed form 500 when a coach adds a second line on the public demo.
      Part 1 alone would be safe early; the file does both.
- [ ] `check:schema-parity` reads RED until then — one divergence, the dev-only index. Deliberately
      **not** re-baselined: it is owed, not accepted, and that ratchet is at zero.

## Architectural decisions

- **Decision:** the unit of the season plan is the **budget word**, not the line.
  **Rationale:** it is already the unit of every roll-up, every variance and every match against real
  money. The line is a record behind it, not a level of it.
- **Decision:** a second use of a word **adds to** the existing line rather than being refused.
  **Rationale:** adding is what the coach came to do. Refusing and pointing elsewhere is a worse form
  for the same outcome. The "Open that line instead" door covers the coach who meant to correct.
- **Decision:** per-piece words become the word's **note**, not new items.
  **Rationale:** items are shared, persistent vocabulary and the plan↔actual join key; generating
  one-off event words there degrades the picker, the report and any club-level reading.
- **Decision:** the plan row still opens — onto the **schedule**.
  **Rationale:** it keeps a real answer behind the chevron and preserves the one thing the third level
  was genuinely carrying (when the money moves), which the grid also reads.
- **Accepted loss:** a coach can no longer delete one piece of a word's money; they edit the total and
  the dates. Recorded so it is not rediscovered in QA.

---

## Open questions (the decision sheet — owner rulings needed)

- [ ] **Q1 — the change itself.** One word, one line on a plan? *Recommendation: yes.*
- [ ] **Q2 — the form.** "Add to it" (recommended) or "go open the line"?
- [ ] **Q3 — the existing plans.** Leave the twins readable (Option A — the form changes and nothing
      else gets simpler, ever) or join them once (Option B, recommended, and cheapest now while no
      customer keeps a real budget on production). **Blocked on the §0 count.**
- [ ] **Q4 — schedules that do not line up.** May one line's money be partly undated?
      *Recommendation: yes, materialised as an undated period.*
- [ ] **Q5 — the report's panel.** Keep the panel showing the schedule (recommended), or link the
      planned figure straight to the plan line?

---

## Risks

1. **The prize shrinks to nothing if Q3 lands on Option A.** The nesting must stay in every screen, the
   file and the importer for as long as one plan anywhere holds twins. Say this plainly when presenting
   Option A — it is a form change wearing a simplification's clothes.
2. **The join is one-way.** A coach cannot un-join the pieces afterwards.
3. **Two foreign keys make a naive join destructive** (§Phase 3) — one drops payment periods, one
   silently unlinks a dues schedule.
4. **This is the fourth change to the coach money vocabulary in a month.** Help and demo narration are
   already behind; doing them in the same unit of work is not optional here.
