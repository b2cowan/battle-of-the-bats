# Build prompt — Coach Payables Rebuild, P2: recording a payment, and undoing one

**Paste this into a fresh chat.** Everything below is code-verified as of 2026-08-19, after P1
completed on dev. Where it says "today the product does X", that was read out of the code, not
carried from a plan.

⚠⚠ **P1's build prompt was WRONG in one structural way and it cost a rebuild mid-session.** It scoped
the phase as "move the readers, leave the writers alone", which is true of the SCREEN and false of the
SERVER — every bill created after that change would have been invisible. **Read §"What P1 actually
left you" below before trusting any file list, including this one, and check it against the code.**

---

## Read first

- `docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` — the spec. **Rules R1–R6 are binding**;
  R3, R5 and R6 are this phase's whole substance.
- `lib/payable-standing.ts` — the one answer to "is it paid?". Read its header before touching a
  money reader. `commitmentStanding()` already returns `payments[]`, each carrying `landedOn`.
- `memory/coach-money-one-arithmetic.md` — one home per money question. A screen that walks the raw
  records to answer something this module answers is a defect.
- `memory/reference_coach_money_check_then_act.md` — **every condition a money route checks in a
  SELECT must be re-asserted in the WHERE of the write.** This phase adds two new write paths; both
  are exactly the shape that rule exists for.
- Owner QA **§64 Part B** in `OWNER_QA_LEDGER.md` — the acceptance test, already written.
- Mockup (binding spec): `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`.

---

## What this phase is

The two **blocking** defects from the QA §27 sitting, and nothing else:

1. **You cannot pay part of something.** `Mark paid` means paid in full. A $600 bill the club takes
   $200 of today has nowhere to go.
2. **Mark paid cannot be undone.** There is no un-settle action anywhere in the product. A mis-tap
   posts real money out of the books, and the only correction is deleting the whole commitment —
   which also destroys the other piece's dates.

**Out of scope, deliberately:** the screen rebuild (P3 — the `Schedule | Commitments` toggle, the
`Group by` control, the drawer, the Status dropdown) and recurring (P4). Do not start them. This
phase changes one form and adds one action.

---

## What P1 actually left you — verify each of these against the code

✅ **Migrations 255 + 256 are applied to DEV ONLY. Not prod.** Do not apply them without an explicit
owner instruction. Before they ever go to prod, the two reconciliation queries in the plan's
"⚠⚠ TWO SHAPES TO CHECK ON PROD" section must be run and their rows reconciled by hand.

✅ **Every money READER is on the new records** — Budget vs. Actual (statement, Months grid,
cumulative chart, Scheduled column), the Transactions register, the Money hub's cash and counts, the
season close-out pot, the budget summary, the payables export, the payment schedule, and the demo
world's nightly re-anchor. `check:register` and `check:money-report` both pass live.

⚠⚠ **The FORMS still write the old columns**, and a transitional bridge keeps the new records true:
`lib/payable-legacy-plan.ts` (the rule — mirrors migration 255's own arithmetic) and
`lib/payable-legacy-sync.ts` (the writes), called from `reconcileCommitmentRecords()` in `lib/db.ts`
after `createRepTeamExpense` and **before** the row write in `updateRepTeamExpense`.
`scripts/lib/backfill-commitment-records.mjs` gives the three fixture seeders the same thing.

**⚠⚠⚠ P2 DELETES ALL FOUR OF THOSE.** Once `Record a payment` writes `rep_payable_payments`
directly, the new tables are the source of truth and a one-way copier pointed the wrong way would
**overwrite real payments with whatever the legacy columns still say**. That is the single most
dangerous thing in this phase. See §"The cutover" below.

⚠ **The ordering in `updateRepTeamExpense` is load-bearing** and was set by `/review`: the schedule
is written FIRST, the row LAST, because every write in the sync is an absolute value, so a failed
reconcile leaves the record untouched and the coach's retry converges. The opposite order left a
permanent silent divergence that the mark-paid 409 guard made unfixable. Whatever replaces it must
keep a recovering order.

---

## The traps, in the order they will bite

### 1 · ⚠⚠ A settle must leave ONE transaction, and no second row beside the commitment

§41 Part D, and the register's running balance depends on it. Today `markDepositPaid` posts one
ledger entry and stamps the row. After P2 a payment is its own record — **do not emit both.** The
register already renders one recorded row per payment plus one scheduled row per still-owing piece
(`register/route.ts`); a payment written twice, or a legacy stamp left behind beside a new payment
row, shows the money twice on the book and in cash on hand.

### 2 · ⚠⚠ Undo reverses by the payment's OWN recorded entry, never by a guess

R5. `rep_payable_payments.accounting_entry_id` exists for exactly this. **Do not reach for
`matchLegacyLedgerEntry`** (description + amount matching) on a payment this product created —
migration 236 exists because editable descriptions made that guess unsafe.

⚠ **A NULL entry id means two different things and they need opposite handling:**
- an **out-of-pocket** cost a family paid — no team cash moved, so there is nothing to reverse, but
  the team **owes that family a credit** which must move with it (mig 234, owner Call 5);
- a record **settled before mig 236** recorded the link — the legacy description match is the only
  way to find it, and it **refuses an ambiguous pair rather than voiding a guess**.

`removeRepDuesPayment` in `lib/db.ts` is the shape to copy: void the entry, delete the row, then
reconcile whatever the deletion made stale.

### 3 · ⚠ Over-payment is ACCEPTED, never refused (R6)

$500 against a $450 commitment saves, and the row reads "$50 over". There is deliberately no CHECK
tying payments to the total. Refusing it teaches coaches to type a figure that is not what happened,
which is how a book stops matching a bank statement. `commitmentStanding().over` is already the
figure; do not derive a second one.

### 4 · ⚠ The application rule is already built and must not be re-implemented

R3 — money fills the earliest unfilled piece and spills forward; a coach's explicit "this one was for
March" decides where the pour STARTS. `commitmentStanding()` owns it, `landedOn` says where each
payment actually landed, and `tests/unit/payable-standing.test.ts` covers the multi-payment cases.
**The form records a payment against the COMMITMENT.** The installment picker is an override, stored
in `installment_id`, and is null for the ordinary case.

### 5 · ⚠ Check-then-act

Two concurrent `Record a payment` submissions, or a double-tapped Undo, are the live threat model
(`memory/reference_coach_money_check_then_act.md`). Re-assert org + team + the payment's own id in
the WHERE of every write, use `.select()` and treat zero rows as the same refusal the pre-check
gives. The delete especially: deleting a payment whose entry was already voided must not void
something else.

### 6 · ⚠ Dates

`formatStoredDate()` only, org day never raw UTC (`memory/reference_timezone_date_math_gotcha`).
`rep_payable_payments.paid_date` is a **`date` column**, so no org-noon stamp trick is needed — that
is a real simplification over the legacy `*_paid_at` timestamps. `whyPaidDateIsRefused()` in
`lib/expense-ledger.ts` already validates "real date, not in the future" and its sentence is written
for a coach; reuse it.

### 7 · ⚠ Capabilities

`canWriteMoney` gates recording and undoing; `canViewMoney` gates seeing them. A read-only money
assistant must see no Record a payment, no Undo, and no row that offers them — §64 Part B walks this
explicitly.

---

## The cutover — the most dangerous part of this phase

The bridge makes the new records say **whatever the legacy columns say**. The moment a coach can
record a $200 payment against a $600 bill, the legacy columns cannot express it — so leaving the
bridge running would have the next ordinary save silently rewrite that payment back into a
deposit-shaped fiction.

**Sequence it deliberately.** A defensible order:

1. Write the new payment/undo paths against `rep_payable_payments` directly.
2. Move the **writers** off the legacy columns in the same unit of work — the create form, the edit
   form, and the delete path (`createRepTeamExpense` / `updateRepTeamExpense` /
   `deleteRepTeamExpense` / the PATCH route's three mark-paid actions).
3. **Delete** `lib/payable-legacy-plan.ts`, `lib/payable-legacy-sync.ts`,
   `reconcileCommitmentRecords`, `scripts/lib/backfill-commitment-records.mjs`, and the three
   seeder call sites — in the same commit as step 2, never before it and never after a release.
4. Only then consider dropping the old columns. **That is a separate migration and a separate
   decision** — migration 255's note says why keeping them made P1's "books did not move" test
   falsifiable, and the same argument applies to P2's.

⚠ **The seeders and the demo world write commitments too.** They currently rely on the bridge. Once
it is gone they must write installments and payments themselves — `seed-demo-coach.mjs`,
`seed-uat-coach-fixture.mjs`, `seed-qa-day-fixtures.mjs`, and the nightly restate in
`lib/demo-coach-reconcile-core.ts`. `npm run check:money-report` **refuses to pass** unless the UAT
fixture still contains a commitment paid across two calendar months; that shape must survive.

---

## The deposit/balance shims P1 left behind, and what happens to them

Each is documented in place with its removal phase. P2 owns the first three:

| Where | What it does | P2 |
|---|---|---|
| `expenses/[expenseId]/route.ts` — `markDepositPaid` / `markBalancePaid` / `markExpensePaid` | The only settle door. Posts an entry, stamps a legacy column. | **Replaced** by Record a payment. |
| `register/route.ts` — `markPaidAction()` | Offers a settle button only for pieces 1–2 of a ≤2-piece commitment, and never on a part-paid one, because the old door cannot express anything else. | **Replaced** — every unsettled piece can offer it once payments are real. |
| `upcoming-payables/route.ts` — the `half` field | `'deposit'`/`'balance'` kept so the panel's mark-paid door and the register's row keys keep working during P1. | **Retire it** with the door. |
| `coach-money-exports.ts` — `Deposit` / `Deposit due` / `Balance` / `Balance due` columns | Read the first two pieces; blank on a plain cost. | **P3**, with the screen. Column positions are load-bearing for coaches' own spreadsheets. |
| `expense-ledger.ts` — `paidLedgerLegs` | What posted to the books, from the legacy stamps. Used by delete and by `syncExpenseBooksForEdit`. | **Moves in P2** — it is money-writing code and its inputs are about to change. |

---

## What the coach sees (the PM summary this phase owes)

- On any commitment that still owes something: **Record a payment** — date, amount, method, note,
  and optionally which installment it was for. It saves a **part** payment, and the row then reads
  what has been paid of what is owed with the remainder still scheduled.
- The status a coach reads becomes three-way: **Paid** when it is settled in full, **Partly paid**
  when some money has landed, **Unpaid** otherwise. R4 — partly paid counts as unpaid in every
  filter, the schedule, and the Overview's next-30 panel.
- Every recorded payment can be **undone**, and the books go back by exactly that payment's amount.
- Over-paying is allowed and stated, not refused.

---

## Definition of done

- §64 Part B walks clean, including the read-only assistant and the out-of-pocket case.
- The bridge modules are **gone**, and nothing writes the legacy columns any more.
- `npm run verify:changed` clean (schema parity will still flag dev-only migrations — that is the
  known state, not a regression). Full `npm test` green.
- `npm run check:register` and `npm run check:money-report` pass against a running dev server, and
  `npm run check:demos` reports both worlds presentable.
- A live round trip on dev: create a commitment → record a part payment → check cash on hand moved by
  exactly that amount → undo it → check cash on hand returned. **Do this rather than trusting the
  unit tests**; it is what caught two real defects in P1.
- Then offer `/simplify`, then `/review`, then `/docs` — in that order, per CLAUDE.md. The help guide
  already describes the mark-paid door in the Payables sub-topic of the coaches guide and will be
  wrong the moment this ships.
- Both demo sandboxes: ask whether a demo **moment** should show a part payment. P1 judged not (the
  product could not do it); P2 is exactly the change that earns one.

## After P2

**P3 — the screen.** One list with `Group by`, the drawer, the Status dropdown, `Item`. Closes
defect 3 (a paid row on the Schedule is a dead end). The plan's §3 has the shape, and the mockup is
binding.
