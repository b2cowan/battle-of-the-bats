# Build prompt — Coach Payables Rebuild, P3: the screen

**Paste this into a fresh chat.** Everything below is code-verified as of 2026-08-20, after P2
committed (`c86532f2`). Where it says "today the product does X", that was read out of the code.

⚠⚠ **SEQUENCING — check before building.** Owner QA **§64 Parts A and B are walked against the
CURRENT screen** (Part A literally asserts "same toggle, same rows, same buttons"). If the owner
has not walked A and B yet, this phase landing on dev breaks their walk. **Ask whether A + B have
been walked before changing the screen**; if not, either wait or agree with the owner that the
ledger's Part A screen-assertions are re-read as historical.

---

## Read first

- `docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` — §3 is this phase's spec (Option B's
  list + Option C's drawer, owner-picked); §7 is the **reporting-filter convention** this phase
  must exemplify (Group by is an ARRANGEMENT, sits first, never reads as a filter; 4+ options →
  multi-select dropdown with counts). Rules R1–R6 binding as ever.
- Mockup (binding spec): `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f` — but the
  CODE outranks the mockup where they disagree; two approved mockup claims have been overturned by
  code in this project already.
- Owner QA **§64 Part C** in `OWNER_QA_LEDGER.md` — the acceptance test, already written.
- `lib/payable-standing.ts` — the one answer to "is it paid?". **P1 pre-built this phase's
  vocabulary, deliberately**: `PayableRowStatus`, `installmentStatus()`, `PAYABLE_STATUS_LABEL`,
  `PAYABLE_STATUS_ORDER`, `PAYABLE_STATUS_DEFAULT` (Outstanding + Overdue — "2 selected", never
  empty) are exported and currently have few/no consumers. Use them; do not re-derive.
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx` — the screen being rebuilt.
  One component serves two faces (`transactions` | `payables`); this phase touches the payables
  face only.

## What this phase is

Defect 3, and the screen's honesty problem: `Schedule | Commitments` presents a parent and its
children as two reports, and a fully paid row on the Schedule opens nothing. Build:

1. **One list, `Group by` first** — Commitment (group header: description, category, paid-of-total,
   still-owing) or Due date (Overdue / month headers with period totals). Same rows, same filters,
   both arrangements. Rows are INSTALLMENTS.
2. **The drawer** — every row opens it, settled or not: header (description, category + item, Edit,
   Delete), Scheduled pieces with per-piece state, Payments recorded each with Undo, Still owing,
   actions Record a payment + Add an installment.
3. **Status becomes a multi-select dropdown** (Outstanding / Overdue / Partly paid / Paid, counts
   computed BEFORE the selection narrows, default `PAYABLE_STATUS_DEFAULT`) and **Item** joins it —
   both exactly as Transactions already does them (`MultiSelectDropdown`; ⚠ its own rule is "empty
   means all", which is why the default seeds two).
4. **The toggle, the Unpaid|Paid|All pills, and the Commitments tab are deleted.**
5. **Phone at 390px**: rows become cards, group headers stay small, no sideways scroll.

**Out of scope:** recurring (P4 — including "Add an installment" beyond a second piece; see the
2-piece cap below), demo copy/moments and export column rework where not forced (P5 owns the tail;
the payables EXPORT's Deposit/Balance columns are this phase's call per the plan's shims table —
if you take it, remember coaches' spreadsheets key on column POSITIONS).

## What P2 left you — verify against the code

- **The drawer's content already exists** as the Commitments row's *Payment details* expansion in
  panel.tsx (Scheduled pieces + Payments recorded with two-tap Undo + Still owing/over + Record a
  payment). P3 is largely MOVING that into a real drawer opened from the one list — reuse its
  pieces and the `undoPayment`/`openRecordPayment`/`paying` machinery as-is.
- **The Record-a-payment modal is done** (`paying` state): date/amount/method/note + installment
  override, over-payment hint, consequence line. Open it pre-aimed (`installmentId`, remaining).
- **The row contracts are ready**: `upcoming-payables` items carry `expenseId`, `installmentId`,
  `installmentNumber`, `installmentCount`, `appliedSoFar`, `partlyPaid`, remaining-as-amount; the
  register's `RegisterRow.recordPayment` is `{ expenseId, installmentId, amount }`.
- **`GET /expenses` returns `standings`** (Record<expenseId, CommitmentStanding>) — the panel
  already holds them in state. `installmentLabel()`/`paymentLabel()` name pieces everywhere.
- **Plans are CAPPED AT TWO PIECES** (`parseInstallmentPlan`, with a coach sentence) because the
  edit form is a two-piece editor and a longer plan would be silently truncated on save. "Add an
  installment" beyond two therefore CANNOT ship in P3 unless you also replace the deposit/balance
  edit form with a real n-piece editor — that editor is P4's generator work. Either keep the
  drawer's "Add an installment" to the split case, or pull the n-piece editor forward consciously.
- **`MoneyEditRefusal`** carries coach sentences with statuses from every money writer — catch by
  `instanceof`, never message text.
- **The family credit restates under a CAS** (`restateReimbursementCreditFromPayments`) — do not
  add a new writer for it; call the existing paths.

## The traps, in the order they will bite

1. **⚠⚠ `?tab=schedule` and `?tab=commitments` are live URL contracts** — `FACE_TABS`, the
   `?tab=` reader, export labels and empty states all key on `ExpenseTab`; the UAT smoke spec
   navigates to `?tab=schedule`; Money-hub links use `moneySectionHref`. Deleting the tabs must
   decide what those URLs do (redirect into the one list, presumably with a matching Group by) —
   a 404 or a blank tab is the bug wearing a politer face.
2. **⚠ Counts before narrowing** — each Status option's count is computed over the rows the OTHER
   filters admit, not after Status itself narrows (the rule the old Overdue chip followed; plan
   §3.3). Get this wrong and the numbers chase their own tail.
3. **⚠ Group by is not a filter** — first in the strip, labelled as an arrangement, identical row
   set under both arrangements. §64 Part C walks exactly this ("nothing appears, nothing
   disappears — if the row count changes between the two arrangements, report it").
4. **⚠ A paid row opens** — defect 3's whole point. The drawer must open from settled rows with
   Edit and Delete live (no-read-only ruling, 2026-08-16).
5. **⚠ check:layout baselines move** — `coach-payables` (and `coach-transactions` if touched)
   will diff against their baselines; re-initing them is a DELIBERATE baseline edit, done the way
   P1 did `coach-expenses` → two screens. ⚠ The two money screens currently show ~20 findings
   owned by a concurrent shared-chrome session / stale baseline (filter-summary tap-floors, the
   notifications bell overflow) — do not absorb those silently as yours, and do not "fix" them in
   passing without checking whose they are.
6. **⚠ Reseed before sweeping** — `node scripts/seed-uat-coach-fixture.mjs`, and remember the
   sweep needs a fresh dev server (the memory floor aborted one mid-sweep on 2026-08-20).
7. **⚠ No year parameters** — `coach-history-endpoint-guard` fails the build if the payables
   screen or its routes learn a `?year=`. The one list is the WORKING season, always.
8. **⚠ The register face shares this component.** `tournamentPayables`, `allPayables`,
   `scheduleRows`, the export wiring and `kindForTab` all assume the current tab shape — grep the
   whole panel for `tab === 'commitments'` / `'schedule'` before deleting the union members, and
   keep the Transactions face byte-identical in behavior.

## Definition of done

- §64 Part C walks clean, including the 390px pass and the fully-paid row opening.
- The two deleted controls are GONE (no dead `ExpenseTab` members left behind), and every deep
  link that used them still lands somewhere honest.
- `npm run verify:changed` clean (schema parity still flags dev-only migrations — known state) ·
  full `npm test` green · `check:register`, `check:money-report`, `check:demos` against a running
  dev server · `check:layout --only=coach-payables,coach-transactions` with deliberately re-inited
  baselines and a note of what changed.
- Then offer `/simplify`, then `/review`, then `/docs` — the coaches guide's Payables sub-topic
  describes the toggle-era screen ("opens on the Schedule … with a Commitments list beside it")
  and will be wrong the moment this ships.
- The demo question, again, in the same breath: the coach sandbox's money tour narrates the
  payables screen — re-read the dock lines and tour steps against the rebuilt screen
  (`npm run check:demos` proves breakage, not staleness), and the open owner question "should a
  demo moment show a part payment?" is still unanswered — surface it.

## After P3

**P4 — recurring**: the generator (dues sheet's shape verbatim, `lib/coach-monthly-recurrence.ts`
reused as-is — 43 tests, no callers, on purpose), the linked series, scopes S1–S8, §64 Parts D+E —
and it LIFTS the two-piece cap. `paymentRestatements` in `lib/payable-plan.ts` is the pure seam
S2/S6 build on. Then **P5 — the tail** (help, demo moments, exports, baselines).
