# Coach Payables Rebuild — a commitment holds many payments

**Status:** approved 2026-08-19, build starting. **Owner mockup (binding spec):**
`claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`.
**PM brief:** `COACH_PAYABLES_REBUILD_PM_BRIEF.md`. **QA:** Owner QA Ledger §64.
**Origin:** owner walked QA §27 on 2026-08-19. It **passed clean** — and in passing, surfaced four
defects that §27 could not have caught, because they are absences rather than failures.

---

## 1 · Why this exists

Money going out has one boolean. A commitment is **unpaid** or **paid**, and the two-slot
deposit-and-balance split was the only concession to the fact that money arrives in pieces. Four
consequences, all found in one sitting:

| # | Defect | Severity |
|---|--------|----------|
| 1 | **You cannot pay part of something.** A $600 entry where the club takes $200 today has no home unless a deposit/balance split was set up *before* anything was paid. `Mark paid` means paid in full. | Blocking — money |
| 2 | **Mark paid cannot be undone.** There is no un-settle action anywhere in the product. A mis-tap posts real money out of the books, and the only correction is deleting the whole commitment — which also destroys the other half's dates. | Blocking — money |
| 3 | **A paid row on the Schedule is a dead end.** The record *is* fully editable (owner ruling 2026-08-16, §27 Part C), but only from the Commitments list. The Schedule row has no pencil and does not open, so the screen communicates a lock the product does not enforce. | Findability |
| 4 | **Nothing repeats.** Gym time on the first of every month can only be entered by pasting rows through Import. Dues can generate a schedule; money going out cannot. | Missing feature |

Plus the framing defect underneath them: **`Schedule | Commitments` reads as two reports and is
actually a parent and its children.**

⚠ **These are not four features.** They are four symptoms of one missing record. Fixing them
separately would mean four special cases layered onto a model that cannot express the problem.

---

## 2 · The model (owner-decided 2026-08-19)

Three layers replace one boolean.

```
Commitment              what we owe            (the existing payable record)
  └─ Installments        the plan               (NEW — dated, amounts, 1..n)
  └─ Payments           what actually happened (NEW — dated, amount, method, 0..n)
```

**This mirrors Player Dues exactly** — since migration 232 the dues side has kept a *schedule* of
installments separate from the *payments* recorded against it. Money-in and money-out finally think
the same way, and the vocabulary a coach reads is already taught on the other tab.

### 2.1 Binding rules

- **R1 — Every commitment has at least one installment.** The one-payment case is a
  one-installment commitment. ⚠ This permanently kills the current "No schedule" state — a record
  with an amount but no due date, which never reaches the payment schedule, can never be marked
  paid, and today needs a warning comment in the code to explain itself. It stops being
  representable.
- **R2 — The commitment's total is the sum of its installments.** Derived, never separately typed.
  Today the total and the two half-amounts can disagree; after this they cannot.
- **R3 — A payment is recorded against the COMMITMENT, and applied to installments oldest-unpaid
  first, spilling forward.** A coach handing over one $700 cheque covering a full month and half the
  next does not do that arithmetic. The coach may override which installment a payment lands on.
- **R4 — An installment is *settled* only when paid in full. Partly paid counts as unpaid**
  everywhere: filters, bulk scopes, the schedule, the Overview's next-30 panel.
- **R5 — Undo is deleting a payment.** The books reverse by exactly that payment's amount, reading
  its own recorded ledger entry — never a guess. (Migration 236's lesson: once descriptions became
  editable, guessing which ledger row belonged to a record stopped being safe.)
- **R6 — Over-payment is accepted, not refused.** Recording $500 against a $450 commitment saves and
  the row reads "$50 over". The money genuinely left the account; refusing it pushes coaches into
  fudging the figure, which is how a book stops matching a bank statement.

---

## 3 · The screen (mockup Option B, with Option C's drawer)

The `Schedule | Commitments` toggle is **deleted**. Payables becomes **one list of rows with a
`Group by` control** — the same "one book, narrowed by controls" shape the Transactions register
already teaches.

### 3.1 The list

- `Group by` — **Commitment** (the group header carries the commitment, its category, paid-of-total
  and still-owing) or **Due date** (headers are Overdue / month names, carrying the period total).
  Same rows, same filters, nothing added or hidden between the two — which is the whole point: it
  says out loud that these are one set of records seen two ways.
- `Group by` sits **first** in the control strip and is labelled as an arrangement, so it never
  reads as another narrowing.
- Rows are **installments**. Every row opens the drawer (§3.2). An unsettled row also offers
  **Record a payment** inline.
- ⚠ **Defect 3 closes here**: every row opens its record, settled or not. There is no dead end.

### 3.2 The drawer

Opening any row shows the whole commitment in one panel:

- Header: description, category + budget item, **Edit** and **Delete**.
- **Scheduled** — every installment, dated, each with its own state (Settled / Part paid /
  In N days / N days overdue).
- **Payments recorded** — every payment, dated, with method, each with **Undo**.
- **Still owing** — the single figure, prominent.
- Actions: **Record a payment**, **Add an installment**.

### 3.3 Filters

The `Unpaid | Paid | All` pills are replaced by a multi-select **Status** dropdown matching
Transactions:

| Option | Meaning |
|--------|---------|
| Outstanding | Not settled, due date ahead |
| Overdue | Not settled, due date past |
| Partly paid | Some money applied, not settled |
| Paid | Settled in full |

Counts on every option, computed before the selection narrows further — the rule the old Overdue
chip already followed, so the numbers never chase their own tail. **Defaults to Outstanding +
Overdue**, reading "2 selected" rather than pretending nothing is filtered. `Item` (budget item)
joins it, as on Transactions.

---

## 4 · Recurring — a linked series (owner-decided 2026-08-19, revising the mockup)

The mockup recommended generate-then-independent. **The owner chose the linked series with a
modification that removes the objection**: bulk scopes may never touch settled money.

⚠⚠ **This supersedes `COACH_RECURRING_PAYABLES_PLAN.md` (2026-08-15), archived 2026-08-19.** That
plan solved recurrence on top of the one-boolean model and would have needed two further mechanisms
beside it. Read its archived header for the full carry-forward/reversal list. The two things to know
here:

- ✅ **The month engine is already built and is reused as-is** — `lib/coach-monthly-recurrence.ts`
  plus 43 unit tests, committed `c404bd4b` 2026-08-15 with no callers, deliberately, so the form
  could be built against a proven generator. **P4 calls it. Do not re-invent month arithmetic.**
  With it come three rules that carry forward unchanged: the **ceiling counts the series, not the
  request** (24 monthly occurrences, refused by generator *and* route with the same message); the
  **server regenerates from the rule** and refuses any date the rule cannot produce; and the
  importer's **duplicate-description reviewer must NOT be reused** (every occurrence of a repeat
  shares one description by design).
- ⚠ **Its §5.1 explicitly rejected the three-way scope** this plan adopts. The objection was that a
  bulk edit could reach money that already moved — which is precisely what **S1** now forbids. The
  concern is honoured, not overruled.

### 4.1 The generator

Re-uses the **Generate installments** sheet's shape from Player Dues **verbatim** — that consistency
was the owner's explicit instruction:

- A numbered `Installment 1..n` list.
- `+ Add` appends; every row has `Remove`.
- Every row has its own **due date** and **amount**.
- Amounts fill in automatically from the repeat rule, are badged **Auto**, and can be over-typed
  (the December rate rise drawn in the mockup is exactly this case).
- A plain-language reconcile line stating count and total — **a sentence, never a barrier**
  (owner ruling 2026-08-13, carried across).

Repeat controls above the list: **Repeat** (Weekly / Every 2 weeks / Monthly), **On the** (day),
**Until** (date) or **times** (count), **Amount each** (or a total, divided evenly).

### 4.2 The three scopes

Every installment edit, and every installment delete, offers:

1. **This payment only**
2. **This and later payments**
3. **All unpaid payments**

### 4.3 ⚠⚠ The scope rules — this is the load-bearing part

- **S1 — Scopes 2 and 3 NEVER touch a settled installment.** Not to change an amount, not to change
  a date, not to delete. This is what removes the danger that made a linked series risky in the
  first place: no bulk edit can re-post money that already left the account.
- **S2 — "This payment only" remains available on a settled installment**, and the books follow.
  ⚠⚠ This is the standing owner ruling of 2026-08-16 — *"once it is edited the new value should
  permeate to the books and everything be in sync"* — and it is tested by §27 Part C, which
  **passed on 2026-08-19**. **Do not lock a settled installment. That reverses a live ruling** and
  re-introduces the read-only branches that were deleted with it.
- **S3 — Partly paid counts as unpaid** (R4) and IS reachable by scopes 2 and 3.
- **S4 — The scope picker is hidden when it has one answer.** If the scope would affect exactly one
  installment (five of six already settled, say), save directly. A three-way question with one
  possible outcome makes a careful feature feel bureaucratic.
- **S5 — A bulk date change SHIFTS, it does not SET.** Moving installment 3 from Dec 1 to Dec 8 under
  "this and later" moves 4, 5 and 6 by seven days each. Setting them all to one date is nonsense on
  a monthly series.
- **S6 — Lowering an amount below what is already applied rolls the excess FORWARD** to the next
  unpaid installment, stated in a sentence naming every installment it touched. **Block only when
  there is nowhere for it to go** — the last installment, or the only one — and then the message
  names the figure and the reason.
- **S7 — Deleting an installment that has money applied** rolls that money forward under "this
  payment only". Under a bulk scope, settled installments are skipped (S1), and a partly-paid
  installment's applied money rolls forward before its row goes.
- **S8 — The series is the commitment's installments.** There is no cross-commitment series, and no
  series record of its own to keep in sync with anything.

---

## 5 · Phases

Each phase is independently shippable and independently walkable.

### P1 — The model lands, invisibly ✅ BUILT 2026-08-19 (dev; QA §64 Part A ✅ PASSED 2026-08-20)
New installment and payment records. **Every existing commitment migrates**: a deposit/balance split
becomes a two-installment commitment; an un-split payable becomes one installment; each settled half
becomes one recorded payment **carrying its existing ledger entry**. Every reader moves to the new
shape — the payment schedule, the Overview's next-30 panel, Budget vs. Actual (including Months),
the Transactions register, the exports, season close/settlement, club allocations, the bulk importer,
and the admin-side upcoming-payables panel.

⚠ **The screen does not change in this phase, and the books must not move by one cent.** That is the
phase's entire acceptance test.

#### ⚠⚠ What P1 turned out to need that this plan did not say — read before P2

**The writers had to move too, and leaving them out would have shipped a broken product.** The build
prompt scoped P1 as "the readers only", excluding the payables form, the mark-paid route and the
delete path on the grounds that touching them would show write controls the server refuses. That is
true of the SCREEN and false of the SERVER: once every reader is on the new records, a commitment
created or settled after P1 that has no installment and no payment is **invisible on every money
surface** — absent from the payment schedule, $0 in Budget vs. Actual, uncounted in next-30, and
unable to be marked paid. Marking one paid would post a real ledger entry no screen could see.

The fix keeps the screen untouched: `lib/payable-legacy-plan.ts` re-derives the plan and the payments
from the deposit/balance columns using **migration 255's own arithmetic**, and every save runs it
(`reconcileCommitmentRecords`, lib/db.ts). It writes no accounting entry and **carries** the ledger
entry each settled half already created. Verified against dev: all 50 existing commitments
re-derive **byte-identical** to what the migration wrote — 54 installments, 49 payments, zero
corrections.

**⚠ The three fixture seeders needed the same thing**, and none of them can call the app's writer:
they insert `rep_team_expenses` with their own Supabase client. `scripts/lib/backfill-commitment-records.mjs`
gives them the same DECISION (the planning functions are shared and unit-tested) with their own I/O.
Without it the coach demo — public on prod — would render every money screen empty, and
`check:money-report` would report the UAT fixture as lacking the split-month commitment it requires.

**⚠ Five of the build prompt's thirteen "readers" were false positives** from a grep on the word
`deposit`: `lib/coach-status-model.ts`, `lib/basic-coach-teams.ts`, `lib/email.ts`,
`lib/demo-moments.ts` and `components/coaches/CoachTournamentRecord.tsx` are all TOURNAMENT
REGISTRATION fees (`tournaments.deposit_amount`, `teams.deposit_paid`), as is `lib/mark-paid.ts`,
which the prompt listed as deliberately deferred. The admin-side upcoming-payables route reads
allocations and payment requests only and never touches `rep_team_expenses`. **Two readers the prompt
missed** were found instead: `budget/route.ts` and `lib/coach-season-settlement.ts`, both callers of
`expenseTotals`.

**⚠ Two defects fixed on the way past:** `upcoming-payables/route.ts` used `getCommitmentStandings`
without importing it (committed in P1's first half — the build was broken on dev), and migration 255
indexed everything except its own `org_id` tenancy anchor (migration 256, caught by
`check:index-coverage`).

#### ⚠⚠ TWO SHAPES TO CHECK ON PROD **BEFORE** MIGRATION 255 IS APPLIED THERE

Both are absent from dev (verified 2026-08-19, 0 rows each), so neither affects the §64 walk. Both
would make a reported dollar figure **rise** on prod, and in both cases the new figure is the correct
one — but "identical to the cent" is P1's acceptance test, so they must be known about first, not
discovered as a surprise.

```sql
-- 1 · A settled half with NO amount of its own. The OLD arithmetic counted it as $0 spent while the
--     ledger entry it posted carried the commitment's FULL amount, so a season's spending was
--     understated by the difference. It now counts what actually went out.
SELECT id, description, amount FROM rep_team_expenses
 WHERE expense_type = 'tournament_payable'
   AND ((deposit_paid_at IS NOT NULL AND deposit_amount IS NULL)
     OR (balance_paid_at IS NOT NULL AND balance_amount IS NULL));

-- 2 · THE WRONG-DOOR RECORDS — a payable carrying `expense_paid_at`, settled through a hole closed
--     on 2026-08-16. Its money has been on the books and invisible to every screen ever since.
SELECT id, description, amount FROM rep_team_expenses
 WHERE expense_type = 'tournament_payable' AND expense_paid_at IS NOT NULL;
```

Any row from either query is money the product was already spending and not showing. Reconcile it by
hand before applying, so the before/after comparison stays falsifiable.

**Two visible changes that are corrections, not regressions,** and are written into §64 Part A so the
walk does not read them as defects: a fully-settled commitment with **no balance leg** used to count
as unpaid forever on the Money hub's outstanding count (the old test required *both* halves stamped,
and an un-split payable has no balance stamp to give); and the payables export's `Paid` column now
distinguishes **Partly paid**, which the old two-word sentence could not express.

**P2 deletes `lib/payable-legacy-plan.ts` (the rule), `lib/payable-legacy-sync.ts` (the writes) and
the seeder helper** — once `Record a payment` writes
these tables directly they become the source of truth, and a one-way copier pointed the wrong way
would overwrite real records.

### P2 — Recording a payment, and undoing one ✅ BUILT 2026-08-20 (dev; QA §64 Part B ✅ PASSED 2026-08-20)
The **Record a payment** form (date, amount, method, note, which installment). Partial payment.
Over-payment (R6). **Undo** on any recorded payment, reversing the books by its own entry.
⚠ Closes defects 1 and 2 — the two blocking ones.

#### What P2 actually did — read before P3
- **The bridge is gone and the cutover is complete**: `payable-legacy-plan.ts`,
  `payable-legacy-sync.ts`, `reconcileCommitmentRecords` and the seeder backfill helper are
  deleted; every writer (create form, edit form, delete, the bulk importer, all three fixture
  seeders, the demo seed and nightly re-anchor) writes installments and payments directly, and
  **nothing writes the legacy deposit/balance/paid columns any more**. The one legacy column still
  written is `amount`, kept equal to the sum of the installments (R2). Dropping the dead columns
  remains a separate migration and a separate decision (mig 255's note).
- The three PATCH mark-paid actions are removed; a stale tab's `action` gets a sentence pointing at
  the new door. The register and payment schedule offer **Record a payment** on every unsettled
  piece — including part-paid ones, which the old door structurally could not offer.
- The still-needed pure logic moved to `lib/payable-plan.ts` (plan diffing; pre-mig-236 ledger-entry
  description candidates). Undo reverses by the payment's own entry (R5); a null entry forks into
  the out-of-pocket credit case (mig 234) vs. the description match that refuses ambiguity.
- **The 2026-08-16 "books follow the edit" ruling is carried**: editing a settled figure restates
  the payment that settled it and its ledger entry — where that is unambiguous (one payment on the
  record, or one payment targeted at the piece at its old figure). Multi-payment records leave the
  payments as the honest record and the standing re-reads; P4's scope rules take over from there.
- P2's UI is deliberately minimal (the screen is P3): the commitment row's **Payment details**
  expansion is the drawer's content — Scheduled pieces, Payments recorded each with Undo,
  Still owing — and Record a payment is its own small modal.
- ⚠ `scripts/check-demo-coach.mjs` was a P1 false negative — a money reader still on the legacy
  columns that failed only when the first legacy-free reseed ran. Its four money assertions now
  read installments/payments. If any other script asserts money off `rep_team_expenses` columns,
  it is wrong the same way.
- Verified on dev: full unit suite, `check:register`, `check:money-report`, `check:demos` (both
  worlds reseeded through the new path), and a live API round trip — part payment moved cash by
  exactly its amount, over-payment saved and read "$50 over", undo returned cash exactly, a
  double-tapped undo refused without double-reversing, and the family case moved the credit and
  never the cash.

### P3 — The screen rebuild ✅ BUILT 2026-08-20 (dev; QA §64 Part C awaiting the walk)
Option B's single list with `Group by`, Option C's drawer, the Status dropdown, `Item`.
The `Schedule | Commitments` toggle is deleted. ⚠ Closes defect 3.

#### The four rulings this phase took, and what they changed

Design pass run as an artifact the owner walked twice
(`claude.ai/code/artifact/407c8427-95b7-4832-bc50-5d7356644b1f`). All four are owner calls.

1. **⚠⚠ "Scheduled" means WHAT IS STILL OWED, everywhere** — resolving the open question this
   section used to carry. Owner, verbatim: *"budget is the overall plan, actual is what was already
   paid, scheduled is what we are currently obligated to pay in the future"*, **past due included**.
   Budget vs. Actual's Months grid was the one surface disagreeing: it quoted the plan at face
   value, so a settled month never fell and a part-paid piece read its full amount. It now drops
   settled pieces entirely and quotes remainders. **The recommended option (keep both semantics,
   rename the lens) was NOT taken** — the owner's argument for one semantics is that plan-vs-actual
   was never a sound comparison anyway, because most of what lands in Budget and Actual is not a
   payable. ⚠ The stated cost stands and was accepted: **the Scheduled row now shrinks as a season
   pays down.**
1b. **⚠ THE LIST OPENS FOLDED (bills), AND EXPANDED (periods)** — owner, later the same day:
   *"can we make the dropdowns default to closed so users can see the list easier and open what
   they want to open?"* This **reverses an earlier call in this same phase**, and the reversal is
   worth recording because the original argument was sound *and then stopped being true*: the first
   version defaulted open on the grounds that "a list that opens folded hides the very numbers it
   exists to show", which was correct of the mockup's original header and **false of the rebuilt
   one** — it carries the next due date, what is still owing and the urgency, so a folded bill hides
   nothing. ⚠ **Periods are the exception and stay open:** a band carries only a month name and a
   total, so folding it hides everything, and it would put *which bills are late* behind the word
   "Overdue". Stored as a flip against the arrangement's default rather than as a set of shut keys,
   so a bill arriving after a write takes the default instead of inheriting a stale state.

2. **Every bill is a folding header, including a one-payment bill.** The build first tried the
   cheaper shape (a one-off bill as a bare row, no chevron) and the owner killed it with the case
   that breaks it: *"one of them has 1 installment left and so do we make it the same as the single
   installment one or the multi? its confusing."* Any rule keyed on what is LEFT also changes a
   bill's shape as it is paid down. **One behaviour, redundancy accepted** — a one-payment bill
   states itself twice, as a header and as its only row.
3. **⚠⚠ Partly paid CUTS ACROSS the date axis** (`installmentStatuses`). `installmentStatus`
   returned one bucket per piece, so a late part-paid piece was `overdue` and nothing else. Two
   consequences; the second is why it was ruled rather than noted: ticking Partly paid hid every
   late one, **and the default Outstanding + Overdue view lost a part-paid not-yet-due bill
   entirely** — money the team owed, absent from the screen's opening view, which is R4 broken in
   the first place R4 names. Counts on the dropdown now overlap, deliberately.
4. **One control shape across the reports** — see §7, which also **strikes a rule that was never the
   owner's**. Budget vs. Actual's `View` and `Showing` became pills in the same unit of work; seven
   segmented buttons became two.

#### What P3 actually did — read before P4

- **The row source is split by concern.** Team bills are built from `expenses` + `standings` — the
  same object the drawer reads, so the list and the drawer cannot disagree about what a bill has
  paid. The `upcoming-payables` feed is still fetched but is read for its **club lane only**; its
  team lane is parsed and unused (deliberate, and commented as such).
- **⚠ `?tab=schedule` and `?tab=commitments` survive as ARRANGEMENTS**, not views. `ExpenseTab`
  collapsed to `'register' | 'payables'`; `TAB_AS_GROUP_BY` maps the retired names onto `Group by`.
  Every deep link — the Money hub's "See full schedule", the Months grid's Scheduled drill-in,
  `legacyMoneyAddress`, the UAT spec — still lands honestly. `moneySectionHref(…, { tab: 'schedule' })`
  callers were left alone on purpose: they still say what they mean.
- **⚠ THE COMMITMENTS EXPORT NOW FOLLOWS THE FILTERS**, which is a behaviour change to a file
  coaches keep. It used to carry every bill regardless; the arrangement now picks the dataset
  (`payables` grouped by commitment, `payment-schedule` grouped by due date) and Status narrows
  both. Written into §64 Part C so the walk does not read it as a lost record. **Its COLUMNS are
  untouched** — Deposit/Balance still describe the first two pieces truthfully and coaches' own
  spreadsheets address columns by position; they retire in P4 with the two-piece cap.
- **"Add an installment" is offered only on a one-piece bill**, opening the record's own form with
  the split already on. The two-piece cap (`parseInstallmentPlan`) is untouched — a button that is
  refused is worse than a button that is not there. **P4 lifts both together.**
- **A club allocation is a bill on this list but not a record here.** It groups and folds like any
  other; its door is the Club tab, not the drawer, because it is not the team's record to edit.
- ⚠ **A piece's words are on two lines now** — the bill's name, then "Installment 1 of 2" in the
  row's meta line — where the single-column schedule joined them with an em dash. `installmentLabel`
  still joins them on the register, the drill-ins and the exports; only this grouped list has two
  lines to spend.
- `payableStatus()` is deleted: it reduced a whole commitment to one adjective for a list that no
  longer exists.

#### `/simplify` pass, 2026-08-20 — what it caught

Four cleanup lenses (reuse · simplification · efficiency · altitude). Eight findings applied:

- **⚠⚠ The screen's main memo was being defeated on every keystroke.** `allPayablesRaw` was a bare
  `.filter()` in the render body and a dependency of the `payBills` memo, so React compared a fresh
  array reference every render and recomputed the whole list — every commitment, every installment,
  the org grouping, the two-pass Status narrowing and the sort — on each character typed into the
  money form that shares this component. That is precisely the cost the memo's own header says it
  exists to avoid; the memo was there and one line was quietly cancelling it. **The single most
  valuable finding of the four lenses.**
- **The club-bill feed now asks for the one lane it reads.** `upcoming-payables` takes a `lanes=`
  parameter (absent = all, so every existing caller is untouched) and the Payables list passes
  `lanes=org_payables`. P3 had made this worse before it made it better: the old Schedule sub-tab
  fetched all three lanes only when opened, and the rebuilt face fetched them on every visit **and
  after every write** — including a second full `getCommitmentStandings` for an answer the panel
  already holds, and a dues lane never parsed at all. Fixed at the source rather than at the caller.
- **The sub-view concept is gone entirely.** `ExpenseTab`, `FACE_TABS`, the `tab` state and
  `goToTab` survived the rebuild as a union each face mapped to exactly ONE member of — so `tab`
  could not diverge from `face`, and the file tested the same boolean in two vocabularies. A dead
  abstraction that *looks* load-bearing is the worst kind; both the altitude and simplification
  lenses found it independently.
- Item names come from a Map built once, not a nested scan per bill · club instalments group by
  `push` rather than an O(n²) spread · `toggleFold` calls the shared `toggleKey` (the module that
  exists because six copies of that three-line Set flip had already drifted) · the month key uses
  the shared `monthKeyOf` · a draft type replaces seven placeholder fields that were written twice
  and always overwritten.

**Skipped, deliberately: extracting a `PayablesList` component.** P3 adds ~500 lines of
Payables-only code to `MoneyRecordsPanel`, which also serves Transactions — a real altitude problem
and a real restructure. It is skipped because **P4 lands in this same area**, and a same-behaviour
extraction across freshly-written, still-settling code would have its boundary redrawn twice.
⚠ **Do it once P4's shape is known** — not later than that, because P4 adds the n-piece generator to
the same function.

#### Verification, and the one thing left red

Full unit suite (2282) · `verify:changed` (schema parity flags the dev-only migrations — known
state; every check behind it run individually and clean) · `check:register`, `check:money-report`,
`check:demos` green against a restarted dev server · fixture reseeded first.

**⚠⚠ A THIRD SWEEP SCREEN WAS ADDED, because the folded default creates the exact blind spot this
file has been bitten by twice.** `coach-payables` now opens grouped by commitment and **folded**, so
it draws the bill headers and **no installment rows at all** — a green check over a collapsed list,
the same trap as the closed settlement sheet and the collapsed team-settings groups.
**`coach-payables-schedule`** (`?tab=schedule`, the dated arrangement, which defaults open) is the
twin that actually measures the rows, the period bands and their totals — and, as a bonus, proves
the live `?tab=schedule` URL contract still lands on something real. Both entries are needed; drop
either and half the screen goes unmeasured.

**Baseline edits — four kinds, each deliberate and attributable. The rule applied throughout: fix
what this change introduced; carry forward an acceptance where a control was REPLACED like for like;
absorb nothing that fails on a screen this phase does not touch.**

- **FIXED, not accepted** — the `Group by` pick buttons and the fold chevron, both new controls
  under the 44px touch floor.
- **PRUNED (15 dead entries)** — the retired `Schedule`/`Commitments` toggle, the
  `Unpaid`/`Paid`/`All` pills, Budget vs. Actual's nine `Statement`/`By activity`/`Months`
  segmented-button entries, and one `coach-transactions` entry whose element an earlier release had
  already renamed.
- **CARRIED to the new screen id (7)** — `coach-payables-schedule` is the same screen in its dated
  arrangement; those elements were already accepted under `coach-payables` and were only "new"
  because the id is.
- **CARRIED as like-for-like replacements (9)** — the three arrangement pills (`View`, and
  `Group by` on both payables screens). Each directly replaces a segmented control whose
  under-floor height was already accepted on the same screen at the same width, and each is
  **31px against the 27–29px it replaces** — measurably better, not worse. Every one carries a
  written reason.

**What is left is RED and deliberately NOT baselined:** the **Status / Show / Date filter pills**,
the **checkbox inside their panel**, three `.compactAction` links and one button, and the
**notifications-bell overflow**. Every one of them fails identically on `coach-transactions`, a
screen this phase does not touch — they are the shared-chrome set, not this work's.
⚠ **The unification did widen their reach**: the same pill now appears on Budget vs. Actual too, so
the shared-chrome fix is worth more than it was. It is one change (a 44px floor on the shared pill
at touch widths) and it resizes every reporting strip in the portal at once, which is exactly why it
belongs to that work rather than being smuggled in here. **All four screens go green together when
it lands.**

> ✅ **RESOLVED 2026-08-20 — one semantics, "still owed", everywhere.** See P3's ruling 1 above for
> the decision and its accepted cost. The write-up below is kept because it states the two
> semantics precisely and a future reader will want to know the grid's face-value reading was
> reasoned, not accidental. **Option 1 (keep both, rename the lens) was recommended and NOT taken.**

**⚠ ~~OPEN QUESTION~~ for this phase (owner-raised 2026-08-20, during the §64 A+B walk): "Scheduled"
means two different things, and the owner read one of them as a defect.** On Budget vs. Actual's
Months grid, a Scheduled cell is **the plan at face value** — every installment in its due month,
paid or not (a September holding a paid $200 piece and an unpaid $400 piece reads $600, which the
owner read as "the whole commitment's total"). On the Payment schedule and Next 30 days,
"scheduled" means **what is still owed** — a part-paid piece shows only its remainder. Both
semantics are internally reasoned (the grid's row must not erode toward zero as the season pays
down, or plan-vs-actual per month stops meaning anything; the schedule is a to-do list, so it
quotes the remainder), and the grid behaves exactly as it did before the rebuild — **but the
product's own words disagree with themselves**, and even an internal comment in the grid component
describes its Scheduled cell as "money still owed". Decide in P3's design pass, as one ruling:
1. **Keep both, and make the grid SAY what it is** (recommended): the plan-at-face semantics stay,
   and the cell/drill-in treatment makes "includes what you've already paid" legible without a
   click — e.g. the settled share rendered quietly within the cell, or the lens relabelled
   (*Planned*?) so it stops sharing a word with the to-do surfaces.
2. **One semantics everywhere ("still owed")**: cheap to build, but the Months grid's Scheduled row
   then shrinks as payments land and the month-by-month plan comparison is lost — state that cost
   out loud before choosing it.
The drill-in already labels paid pieces today; whatever is ruled, the §64 Part C walk should
include opening a Scheduled cell that contains a paid piece and reading it without help.

### P4 — Recurring
The generator (§4.1), and the linked series with the three scopes and rules S1–S8.
⚠ Closes defect 4.

### P5 — The tail
In-app help content; **both demo sandboxes** (the coach sandbox's dock copy and tour narration talk
about money and will go stale — CLAUDE.md's standing warning, and the 2026-08-17 release already
changed this exact surface once); export columns; the layout and memory baselines.

> ✅ **CLOSED 2026-08-20 — "should a demo moment show a part payment?" NO** (owner: *"the demo
> doesn't have to show a part payment"*). It had been open since P2 as the most persuasive thing the
> rebuild added. **P5 no longer owes the sandboxes a new moment.**
>
> ⚠ **What P5 still owes them is the STALENESS check, which is a different question.** Checked
> during P3 and clean at that moment: neither sandbox's dock copy nor its tour narration names the
> Payables screen, the `Schedule | Commitments` toggle or the retired pills, so the rebuild broke no
> demo sentence — and `check:demos` passes. ⚠ That is a fact about 2026-08-20, not a standing
> exemption: CLAUDE.md's warning is precisely that `check:demos` proves breakage and cannot tell us
> the demo is missing something the product gained. **Re-read them on the next coach-money change.**
>
> ✅ **The in-app help is DONE (`/docs`, 2026-08-20)** — it was the live half of this item. The
> Payables topic was rewritten against the shipped screen (one list, `Group by`, the folded default,
> the four-status dropdown *with its overlap explained*, the drawer opening on a paid bill,
> `Add an installment`'s one-piece limit, club bills on the list, and the export's new
> filter-following behaviour). Budget vs. Actual's **Scheduled** definition and its cash-flow
> sentence were rewritten to "what you still owe". Two stale cross-references to a "Payment
> schedule" view were corrected. 59 keywords and a searchText block were added, because the new
> vocabulary — *group by, fold, partly paid overlap, why did Scheduled drop* — is unfindable
> otherwise (rendered prose is not searched).
>
> ⚠ **The Months screenshot was re-taken in the same unit of work**, per the standing rule: its
> controls became dropdowns *and* its Scheduled figures changed, so the old picture was wrong twice
> over. Its capture steps needed updating too — the view is two clicks away now, not one.

---

## 6 · What this touches beyond the screen

Roughly twenty coach-side readers currently read the deposit/balance pair directly. Named here so
none is discovered late:

- The payment schedule, and the Overview's **next 30 days** panel
- **Budget vs. Actual**, including the Months view (a payment's date decides its month)
- The **Transactions register** — a settled half is a row in the one book, and carries the running
  balance
- **Exports** — the payables and register files, and their column sets
- **Season close / settlement**, and the closed-season page's money shelf
- **Club allocations** (org-funded installments on a club-run team)
- The **bulk importer** and its payables template
- The **status model** and the free-tier basic-coach team summaries
- The **admin-side** upcoming-payables panel
- The two **demo sandboxes**

---

## 7 · New standing convention — reporting filters

Owner instruction 2026-08-19: *"I would like this to be the convention on reporting going forward
unless there is a good reason for something else."* Logged in `memory/design_decisions.md`.

> ⚠⚠ **CORRECTED 2026-08-20 — one bullet here was never the owner's, and it was quoted back at him
> as though it were.** This section originally carried *"Two or three fixed, permanent options →
> pills stay. A dropdown for two things is a click tax."* The owner's instruction was the sentence
> above it and nothing more; the rule was written by whoever drafted this plan. During the P3 design
> pass it was cited to him as his own standing rule, he did not recognise it, and it is struck.
> **The lesson is `AGENCY_RULES.md`'s own: argue from what the code does, never from what a plan
> claims** — and a plan quoting itself back as an owner ruling is the same failure wearing a
> politer face. His replacement wording is below.

- **One control shape across the reports:** a labelled pill that opens a small list. A narrowing is
  multi-select with **counts on every option**, and its summary reads "2 selected" when a real
  default is in force rather than pretending nothing is filtered. An arrangement is single-select.
- **A control that chooses an ARRANGEMENT is not a filter** — it says `Group by` (or `View`), sits
  **first** in the strip, and carries the accent so it can never read as another narrowing.
- **Short lists are a judgement, not a rule** (owner, 2026-08-20): *"for small lists we can review
  on a case by case basis but no need for a hard rule. There is value to less clutter too — 5 pills
  of 2 each shows 10 items vs. 5 dropdowns might look cleaner."* Count what is on screen, not what
  is behind a click. Payables' `Group by` has exactly **two** options and is a dropdown for that
  reason, not in spite of it.
- **Never a tab row where a filter would do.** Two tabs over the same records is the mistake this
  whole project exists to correct.

**Done so far:** Transactions (2026-08-19) · **Payables** and **Budget vs. Actual's `View` /
`Showing`** (2026-08-20 — seven segmented buttons became two pills).
**Screens this sweeps next:** Player Dues, Fundraising, Club, and the Reports portal when it is
built. The shared primitives are `MultiSelectDropdown`, `SingleSelectDropdown` and
`DateRangeDropdown` — one family, one look; do not hand-roll a fourth.

---

## 8 · Risks

| Risk | Mitigation |
|------|------------|
| **P1 moves the books by a cent.** The migration re-expresses settled money; an arithmetic slip is a wrong bank balance on a live site. | P1's acceptance test is cash-on-hand and Budget vs. Actual identical before and after, on a team carrying every shape. Existing ledger entries are **carried, never recreated**. |
| **A settled installment gets locked**, reversing the 2026-08-16 ruling by accident. | S2, stated twice above, and walked explicitly in §64. |
| **Roll-forward (S6) cascades confusingly** across several installments. | The sentence names every installment it touched, not just the next one. |
| **Demo copy goes stale.** The coach sandbox narrates money screens that are being rebuilt. | ✅ **Largely retired 2026-08-20.** The judgement call it existed for — *should a demo moment show a part payment?* — was answered **no** by the owner, and the staleness half came back clean through the P3 rebuild: no dock line or tour step names this screen, so there was nothing to go stale. `check:demos` passes. ⚠ What survives is the standing CLAUDE.md warning, not a P5 task: the check proves breakage and can never tell us the demo is missing something the product gained, so **re-read the sentences on the next coach-money change**. |
| **The register's running balance** depends on one row per settled half; payments are now their own records. | ⚠ §41 Part D's rule holds — a settle must leave ONE transaction and no second row beside the commitment. Re-assert it in P2. |
| **Scope rules are cheap to state and expensive to get right** across paid/unpaid combinations. | S1–S8 are individually walkable in §64 Part E, and each gets a unit test rather than only a QA step. |
