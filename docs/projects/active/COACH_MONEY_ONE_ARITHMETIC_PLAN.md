# Coach Money — one home for the arithmetic

**Status: ALL THREE PHASES BUILT ON DEV 2026-08-17. Awaiting owner QA — Owner QA Ledger §51.**
No migration. Direction approved by the owner 2026-08-17 (in conversation).

**§1's table was re-derived from the code before any work started and again after it finished — see
§1c for what that found, including two rows that were narrower than the truth and two adjacent
defects the table does not mention.**

**Evidence, diagrams and the numbers behind every claim below:**
https://claude.ai/code/artifact/bd12805c-98a5-465a-931b-1273b8adcb70
**PM brief:** [COACH_MONEY_ONE_ARITHMETIC_PM_BRIEF.md](COACH_MONEY_ONE_ARITHMETIC_PM_BRIEF.md)
**Build prompt:** `COACH_MONEY_ONE_ARITHMETIC_BUILD_PROMPT.md` (fresh chat)
**Found by:** the money redesign P4 `/review` (2026-08-17), which caught the third instance of one
mechanism. `COACH_MONEY_TAB_REDESIGN_PLAN.md` §10 P4 carries the retraction and the restated debt.

---

## 0. The problem in one paragraph

**Budget vs. Actual works out "what we actually spent" three separate times**, from three
independent walks of the same raw records: the statement (via the rollup), the Months grid, and the
cumulative chart. Nothing connects them. Adding a kind of money means finding all three by memory;
getting two of three produces no error, no failing test, and a screen that simply reads low.
**Two of the three already disagree, and both predate any club money.**

---

## 1. ⚖ What is actually wrong — proven, with numbers

| # | Divergence | Statement | Months grid | Chart |
|---|---|---|---|---|
| 1 | **Money back is never netted on the chart** ($500 hire, $200 back) | $300 ✅ | $300 ✅ | **$500 ❌** |
| 2 | **A split commitment collapses into its deposit's month** ($200 Apr + $400 Jul) | $600 season ✅ | Apr $200 / Jul $400 ✅ | **Apr $600 / Jul $0 ❌** |
| 3 | **Club money reached only two feeds** | ✅ | ✅ | ❌ → **fixed 2026-08-17** |
| 4 | **Categories bucket differently**: the grid groups by NAME (lower-cased), the statement by ID | by id | **by name** | n/a |

⚠ **#1 and #2 are live today.** #3 is the one P4's review caught — the third instance of one
mechanism, which is why this plan exists rather than a patch.

⚠ **The chart is rendered ABOVE the statement on the same view.** A coach reads both totals at once.

## 1b. ⚠⚠ What is NOT wrong — a retraction, kept so nobody "fixes" it

P4 first logged the report's two date rules as inconsistent — `paidDate()` slicing UTC while the
club feeds use `orgDayKey()`. **That was wrong, and the refactor moves NO rows between months.**
`expense_paid_at` / `deposit_paid_at` / `balance_paid_at` are written at **ORG NOON**
(`orgDayAsStoredInstant`), precisely so a naive UTC slice lands on the coach's own calendar day —
twelve hours from either midnight, which no timezone this platform serves can cross. Club
timestamps are click-time instants with no such anchoring, which is exactly why they need
`orgDayKey()`. **Two treatments of two differently-stored columns, both correct.** The read path
looks inconsistent and only the writer explains why it isn't.

## 1c. ⚖ §1 RE-VERIFIED AGAINST THE CODE (2026-08-17, before and after the work)

Every row above was re-derived from the route and the two pure modules rather than taken on trust,
because this document has already been wrong once about this exact subject (§1b). **All four rows
held. Two were narrower than the truth, and two live defects of the same family were not in the
table at all.**

| Row | Verdict | What the code actually said |
|---|---|---|
| **#1** money back never nets on the chart | ✅ **confirmed** | `actualByMonth` summed paid costs and club costs and nothing else. |
| **#2** a split commitment collapses into its deposit's month | ✅ confirmed — **and WIDER than stated** | The merged record was dated by the *earliest* payment, and it reached **two** surfaces: the chart, **and the statement's own expand-a-row payment schedule**, which reported "Apr $600 / Jul $0" beneath a row whose season total was right. The table's "Statement ✅" is true of the season total and silent about the drill-in directly under it. **A third figure changes, not two** — recorded in Ledger §51 §B. |
| **#3** club money reached only two feeds | ✅ genuinely fixed, verified | |
| **#4** the grid buckets by NAME, the statement by ID | ✅ confirmed — **and REACHABLE, not theoretical** | `budget_categories.name` carries **no unique index**, and an org's list is platform defaults ∪ its own customs (DATA_DICTIONARY, that table's `name`) — so one name with two ids is a shape the product cannot reject, and the POST route's duplicate-name branch is dead code for categories. |

**Two live defects of the #4 family that the table did not name.** Both fixed here, both empirically
confirmed on the fixture before and after:

- **Spending with NO category appeared as TWO rows on the Months grid.** The statement called the
  bucket `No category` (`NO_CATEGORY_LABEL`); the grid filed the money under `Uncategorized`, because
  events arrived with a null name while the grid's own rows arrived from the rollup already
  normalised. On the UAT fixture that was an approved **$200** club payment under one heading and the
  **−$125** refund netting against it under the other. The season total still reconciled, which is
  why nobody saw it. Now one row at **$75** on both sides.
- **That cell's drill-in was dead.** Detail was filed under a *third* spelling (`''`) while the grid
  asked for its own key, so the panel resolved to an empty list and the cell was not even clickable.
  Silent, and only ever wrong for the one bucket nobody seeds.

**Two adjacent defects found and deliberately NOT fixed** — reported rather than bundled in, both in
Ledger §51 §F: the month cell's *"edit this line's payment dates"* link never resolves (the grid's row
id stopped being a budget line id in 2026-08-15, and **which** of two summed lines it should open is
an owner decision, not a patch); and `unbudgetedActuals` ships a full list of unplanned costs to the
browser that nothing renders.

**§1b stands untouched.** `rep_team_money_in.received_date` is **NOT NULL** and club stamps fall back
to `created_at`, so no refund can arrive undated; the org-noon slice and `orgDayKey()` remain two
treatments of two differently-stored columns. **No row moved between months.**

---

## 2. The three money arithmetics, and which are meant to be one

The owner's framing — *"a standard place where calcs and rollups live"* — is wider than this report.
The inventory, checked against the code:

| Arithmetic | Where | Status |
|---|---|---|
| **Cash on hand** | `cashOnHandCents` in `lib/coach-register.ts` | ✅ **Already one.** The register and `money-summary` both call it (P3). A source added to one and not the other is a visibly missing argument, not a silent drift. |
| **The season close-out pot** | `lib/season-settlement.ts` | ⚠ **Deliberately separate, and stays that way.** It is a pure, dependency-free module that runs under plain `node --test`; P3's `/simplify` explicitly skipped folding it in as *"a bigger, riskier change than the finding was worth."* This plan does not revisit that. |
| **The report** | the rollup + the grid + the chart | ❌ **Three, should be one.** This plan. |

⛔ **Do not merge the close-out pot into anything.** Its isolation is the reason it is the
best-tested money module in the repo. Naming it here is so a reader knows it was considered.

---

## 3. Phases — each leaves the product correct

### Phase A — make the three prove they agree, then fix the two that don't
**Small. Ships alone. Changes numbers (correctly).**

1. A check that loads the report for a seeded team and asserts the identity:
   **statement season total == grid months summed == chart's final cumulative point**, and per-month
   where both the grid and the chart carry a month axis.
   - ⚠ Model it on `npm run check:register` — same shape, same spirit, and **it must refuse to pass
     over a fixture too thin to fail**: a team with no refund and no split commitment cannot
     disagree, so a green run there proves nothing. Require at least one refund, one split
     commitment paid across two months, and (on a club team) club money.
2. It will fail immediately on divergences #1 and #2. **Fix both directly** — a few lines each.
3. ⚠ The chart's numbers change. That is the point; say so in the QA section.

### Phase B — one home for the arithmetic
**The refactor. Number-neutral except what Phase A already fixed — and Phase A proves it.**

1. **Emit one movement per PAID HALF of a commitment** where records are handed to the rollup,
   instead of one merged record dated by the earliest payment. This is what makes #2 impossible
   rather than fixed, and it is a change at the caller, not inside the rollup.
2. **Derive the grid's actual figures from the rollup's per-item movements** rather than a second
   walk of raw rows. Those movements already carry amount, date and description — the grid's refund
   rows already read them, which is exactly why refunds never drifted.
3. **Derive the chart from the same movements**, summed per month.
4. **Give the grid the category's identity**, not just its name — closing #4.
5. ⚠ **`Scheduled` keeps its own raw feed, deliberately.** The rollup only knows money that has
   MOVED, and the statement has no such column; growing a third dimension it exists not to have is
   worse than one honest exception. **Say so in code** rather than leaving it as an omission.

### Phase C — the standing rule
**Mostly words and one guard, so this cannot regrow.**

1. Write the rule down where a reader will meet it: **money arithmetic has one home per question**,
   and name the three (cash on hand · the close-out pot · the report), including why the pot is
   exempt.
2. A guard test in the spirit of the existing ones: a new feed added to the report that does not go
   through the rollup fails the build. If a clean mechanical form isn't available, the Phase A check
   IS the guard — say that plainly rather than inventing a weak one.

---

## 4. 🔒 Constraints

- **No coach-visible behaviour changes except the two corrected chart figures.** Not a door, not a
  label, not a flow.
- **The statement's and the grid's current numbers must not move** — Phase A's check is what proves
  it, which is why it comes first.
- ⛔ **The grid's month-splitting of a commitment is CORRECT today.** A careless derivation regresses
  the one feed that gets it right. This is the single biggest risk in Phase B.
- **The close-out pot is not in scope** (§2).
- **The report still shows no variance on the register and no row labels** — every rule from the
  money redesign survives untouched.
- Working season only; no `?year=` anywhere near this.

---

## 4b. ✅ What was actually built, and the one place the phasing changed

**Phase A took over Phase B's step 1, and that was deliberate.** The plan said to fix divergence #2
"directly — a few lines each". Doing that *in the chart* means writing a **fourth** independent walk
of the deposit/balance stamps and then deleting it in Phase B. Instead #2 was fixed where B.1 already
said it belonged — **one movement per PAID HALF**, emitted once at the point records are handed to the
rollup (`paidMovements`). Fewer lines, nothing thrown away, and it corrected the statement's payment
schedule in the same stroke. Everything else ran in the planned order.

| Phase | Shipped |
|---|---|
| **A** | `npm run check:money-report` — statement = Months grid = chart, per month **and** per category, with a thinness gate that **exits non-zero over a fixture that cannot disagree**. The UAT fixture gained the shape it lacked: a commitment paid **$300 in May + $600 in July** (fixed dates at ORG NOON — relative offsets would land in one month for most of any month and the case would vanish). `paidMovements` replaced the `paidAmount()` + `paidDate()` pair; the chart's actual series now reads `report.expenses`. |
| **B** | The grid's actuals derive from the same movements — its three raw loops (expense stamps, club costs by hand, refunds) collapsed into one walk of `report.expenses`. `categoryKey` is **exported from the rollup** and the grid keys on it, closing #4 and both defects in §1c. `Scheduled` keeps its raw feed **with the reason written in the code**. |
| **C** | The rule in `lib/coach-budget-rollup.ts`'s header + `memory/coach-money-one-arithmetic.md`. `tests/unit/money-one-arithmetic-guard.test.ts` — **two independent rules**: the paid stamps have exactly one reader, and the grid may not derive category identity privately. **Proven to bite**: a second stamp reader was added temporarily and the guard failed on it. |

⚠ **The guard caught a bug in itself while being written** — it located `paidMovements`'s body by
brace balance and the signature's inline return type made the first `{` the *type's*, so it read a
type as a body and reported the route clean while pointing at its own reason for existing. The route
now names that type (`PaidMovement`) and the guard asserts both that the signature carries no brace
and that the extracted block actually reads a paid stamp.

⚠ **One self-inflicted defect, found by the gates:** the new cross-module import broke
`npm run check:demos`, which loads `coach-budget-months` under plain Node where an extensionless
specifier does not resolve — the demo check died with `ERR_MODULE_NOT_FOUND` and said nothing about
money. Fixed with the explicit `.ts` extension the other pure `lib/coach-*` modules already use, and
the reason is written at the import.

## 4c. `/simplify` (2026-08-17) — four fixes applied, two findings reported instead

Four cleanup lenses ran on the finished work. **Three of the four independently found the same thing**,
and the altitude lens found the most valuable one.

| Applied | Finding |
|---|---|
| ✅ **`categoryKey` normalises the nameless case itself.** | ⚠⚠ **The best finding.** `categoryKey(null, null)` and `categoryKey(null, NO_CATEGORY_LABEL)` were **two identities for one fact** — and the split-bucket fix in §1c only landed on the right one because a route helper remembered to pre-normalise. **The fix was a convention**, so the next caller that forgot would reintroduce the defect invisibly. Deciding it inside `categoryKey` makes forgetting impossible. `gridCategory` survives as display only. |
| ✅ **One flat movement list, read twice.** | Found by simplification, efficiency AND altitude. The chart and the grid each walked `report.expenses.categories` in their own triple-nested loop 140 lines apart, each restating the refund-netting rule in its own comment. `actualMovements` is flattened once; both feeds sum it. ⚠ The runtime saving is trivial (tens of microseconds) — the point is that a third consumer cannot become a third copy. |
| ✅ **`displayCategoryName` exported — one owner for one display rule.** | "What a nameless category is called" was written out **four times**, twice in code this change touched. All four agreed, which is exactly how the last one got away with being different. |
| ✅ **`RollupSpend`'s own doc comment was describing deleted behaviour.** | It still said *"a payable's deposit and balance arrive summed, on the earliest date"* — the fiction this project retired. A future reader would trust the type's contract over route-local prose and merge them back. **This project exists because a document and the code disagreed; shipping with a stale contract comment would have been the same mistake in the same release.** |
| ✅ **The guard now covers the seam it missed.** | Its first draft only handed both sides a name that had already been through the rollup, so it **passed while the two-identity bug above was live** — testing a convention's obedience rather than the rule. |

**Two findings reported rather than acted on**, both in Ledger §51 §F:

- ⚠⚠ **"A payable has two halves" is encoded three times** (`paidLedgerLegs`, this route's
  `paidMovements`, `upcoming-payables`). They are **not** duplicates — they answer three different
  questions, and two disagree on the amount fallback when a half's own figure is null. Unifying them
  means resolving that disagreement inside money-**writing** code, which is an owner-visible decision,
  not a mechanical extraction. Cross-referenced at `paidMovements` so nobody merges them by mistake.
- **The `.mjs` check scripts hand-carry ~30 lines of identical setup**, now across three of them.
  Extracting a harness means rewriting two unrelated build-blocking gates — one guarding the register's
  cash figure — and a shared module with only the new script calling it would be worse than the
  duplication. Worth doing when a fourth arrives.

**Number-neutral, proven:** the report still lands on the same $1,995.00 across all three feeds, every
month and every category; every detail panel key is still reachable from a grid row (**0 orphans**,
checked directly after the identity change); `check:register` and `check:demos` unaffected;
`check:layout` still **0 new** findings.

## 4d. `/review` (2026-08-17, high-risk tier) — one Critical, against a safeguard I built

Four finders: correctness · data-contract & blast-radius · security & multi-tenancy ·
**verification-integrity** (the only question of that last one: *can the new safeguards pass while the
product is wrong?*). It found the most important thing in the whole project.

### ⚠⚠ Critical — CONFIRMED. The identity check got weaker as the refactor succeeded.

`check-money-report-arithmetic.mjs` was designed when the statement, the grid and the chart were
**three independent walks of the database** — then their agreeing was evidence. §4b's consolidation
made them **three readings of one list.** So the check proves the feeds are CONSISTENT and can no
longer prove they are CORRECT: mis-date a movement at the root and all three agree on the wrong
answer, green. A July balance charted in May would pass. **And the root had no test at all**, because
`paidMovements` lived inside the route handler where nothing could import it.

**This is this project's own disease, inside the safeguard built to prevent it.** Fixed properly:

- the rule moved to **`lib/coach-expense-movements.ts`** — a pure module, so it is testable;
- **`tests/unit/coach-expense-movements.test.ts`** (18 cases) asserts the root directly: both halves in
  their own months and never merged onto the earlier one, balance-paid-first, both on one day, a
  missing half figure that must NOT fall back to the full amount, a negative or zero half, an
  out-of-pocket cost, and org-noon stamps in both DST halves;
- all three safeguards now **state what they do not prove**. The check guards the PLUMBING, the unit
  test guards the ROOT, the guard test owns the source rules. None is evidence for another's claim.

### Also confirmed and fixed

| Fix | Finding |
|---|---|
| **A skipped claim no longer reads as a pass.** | Months the grid had no column for were `console.log`-ed and the run still exited 0. That is the repo's own historical failure — a probe that skips itself reports green. Now **exit 2** with the likely cause named. |
| **The thinness message no longer misdirects a regression.** | If a payable stopped splitting, its evidence vanishes with the behaviour and the check said "fixture too thin" → reseed, which cannot help. It now names **both** causes and points at the root test first. |
| **The guard's select exemption was un-anchored.** | Any line merely *containing* `.select(` was exempt, so a one-liner doing both a select and stamp arithmetic would pass. Anchored to line start; the route's two Scheduled calls were reformatted to keep the exemption honest rather than loosening it. |
| **Rule 2 never fed the grid a RAW null name** — the exact live shape. | It only ever handed both sides an already-normalised label, so a change to the grid's own wrapper could break the null path with every test green. |
| **The category label merge is now case-insensitive.** | Exact-match merged "No category" and left "no category" as its own near-identical heading. |
| **The check script refuses a non-local server on every path.** | Its inherited prod refusal was skipped whenever an org and team were passed as arguments — the file's own documented usage. It now requires a localhost target outright (a rule, not a hostname blocklist). Verified: exit 1 non-local, 0 local, 2 thin. |

### Refuted — and in two cases the *old* code was the inconsistent one

- **"Merging a category named 'No category' loses information"** (raised by two lenses). The previous
  behaviour produced **two statement rows both labelled "No category"** with nothing to tell them
  apart — the duplicate-heading defect this release removes. Merging is correct. The lenses were right
  about something else though: my justification only covered one of the two paths that arrive carrying
  the label, so a future reader would find it didn't explain theirs and "fix" it back. Comment widened.
- **"A negative stored half-amount changes the total."** True, and it is a *convergence*: the grid
  always dropped it while the statement summed it in, so one screen reported two totals for one row.
  They now share the grid's rule, which is also the safe one.
- **"An undated cost movement diverges between grid and chart."** Unreachable today, and if it became
  reachable the identity check catches it — the chart would under-report against the statement.

**The route refactor itself came back security-neutral**: org, team and season scoping intact, the
money gate still ahead of all data assembly and still resolved per-team, no new PII in the payload.

## 4e. The two dead links — approved from a mockup and built (2026-08-17)

**Mockup:** https://claude.ai/code/artifact/8859dc90-62f9-4612-bb1c-37da695249fa — **owner approved**,
and it is the spec. Walk it at Ledger §51 §F.

**It was two affordances, not the one first reported.** The month figure ("Edit this line's payment
dates") *and* the **No date yet** figure ("Give this money a date") are one link with two labels. Both
handed the budget page the composite ROW id, which stopped naming a budget line on 2026-08-15 when the
rows began coming from the rollup; the page looked for a line, found none, and **returned silently.**
The second is the worse one — it is the grid's only route out of undated budget.

**The rule: the link addresses the ITEM, and the item answers for its lines.** One line → open its
dates (exactly the pre-break behaviour). Two or more → a chooser, using the panel the grid already
opens for Actual cells. Rejected: opening the first line (a coach would silently edit a line they were
not looking at — the "looks right, is wrong" class this project just removed) and hiding the control on
two-line rows (it strands the teams with the most complex plans). Deferred: a scroll-and-highlight
landing on the budget page, which needs new behaviour there and its own answer for the un-itemised
bucket.

⚠⚠ **The fixture had never rendered a two-line item, and the seeder's own comment claimed it had.** It
said the shape was *"the ruling this fixture has to be able to prove"* while mapping every line to its
own item — so the owner's 2026-08-15 SUM ruling had **no rendered coverage anywhere** for two months,
and the new chooser would have had none either. Corrected in place, with the false claim rewritten
rather than deleted.

⚠ **A guard caught the fix and was obeyed rather than exempted.** `budget-line-kind-guard` flagged
`coach-budget-months.ts` for naming the budget-lines table — in a *comment*. Taking the offered
exemption would have switched that guard off for the module permanently, including for a future change
that really did read the table. The comment was reworded instead.

**Verified:** 2,103 tests, typecheck, every static gate, both money checks, and `check:layout` on the
report **and** the plan screen — zero new findings on the report; two on the plan screen are the same
accepted desktop-compact Edit button surfacing under line names, recorded with that reason. ⚠ **The
chooser panel is behind a click, so no rendered sweep can open it** — stated in the QA section rather
than left to look like coverage.

## 5. Done means

- The new check passes, and **fails when pointed at a thin fixture**.
- `npm run check:register` still passes — the register identity is a different claim and must not
  move.
- `verify:changed`, `typecheck`, the unit suite.
- `check:layout` on the report screen (its own baseline entry already exists).
- A **new Owner QA Ledger section** naming the two chart figures that changed and the one thing only
  eyes can check: that the chart, the statement and Months tell one story.
- The plan's own §1 table re-verified against the code at the end — this project exists because a
  document said one thing and the code did another.

## 6. ⚖ Disagree out loud, before the work

Argue from what the code does. **This plan has already been wrong once about this exact subject**
(§1b), and the correction came from reading the WRITE path after the read path looked wrong. If a
phase here rests on a premise the code contradicts, say so before building it.
