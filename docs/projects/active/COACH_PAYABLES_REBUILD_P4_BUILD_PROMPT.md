# Build prompt — Coach Payables Rebuild, P4: a cost that repeats

**Paste this into a fresh chat.** Everything below was code-verified on 2026-08-20, after P3
committed (`61821c2f`). Where it says "today the product does X", that was read out of the code,
not out of a plan. ⚠ **Plans in this repo have been wrong repeatedly — including this project's own
§7, which recorded a rule the owner had never given and then had it quoted back to him as his
ruling.** Trust the code; correct the plan when it disagrees.

**Status going in:** P1, P2 and P3 are on `dev`. **QA §64 Parts A and B PASSED**; **Part C is built
and awaiting its walk.**

> ⚠⚠ **CHECK BEFORE YOU BUILD: has the owner walked §64 Part C?**
> Part C's last three steps walk the **Months grid change** ("Scheduled means what is still owed"),
> and the owner was explicitly told that is *"the one change here you might want back"* — the
> Scheduled row now shrinks as a season pays down. **If that ruling comes back, P4's generator is
> being built on a figure that is about to move.** Ask. If Part C has not been walked, either wait
> or get the owner to confirm the Scheduled ruling stands on its own.

---

## Read first

- `docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` — **§4 is this phase's whole spec** (the
  generator, the linked series, and the scope rules S1–S8). §5's P3 section records the four rulings
  P3 took and what they cost; read it, because two of them constrain you.
- **Owner QA §64 Parts D and E** in `OWNER_QA_LEDGER.md` — the acceptance test, already written.
  ⚠ **Part E is the one that matters.** It walks every way a bulk edit can go wrong, and its
  settled-installment step is a standing owner ruling that this feature could reverse by accident.
- `lib/coach-monthly-recurrence.ts` — the generator engine, **already built, 43 tests, no callers,
  deliberately**. Read its header before writing a line of month arithmetic.
- `lib/payable-standing.ts` — `installmentsInScope()` and `scopeChoiceIsMeaningful()` are **S1 and
  S4 already implemented and unit-tested**. Use them; do not re-derive.
- `lib/payable-plan.ts` — `planInstallmentWrites()` (what to insert/update/delete given a desired
  plan) and `paymentRestatements()` (the pure seam S2 and S6 build on).
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/GenerateInstallmentsModal.tsx` — the dues sheet
  you are copying. **Verbatim was the owner's explicit instruction**; §64 Part D's last step is
  literally *"if it has learned different words or a different layout for the same job, report it."*

## What this phase is

**Defect 4, the last one: nothing repeats.** Gym time on the first of every month can only be
entered by pasting rows through Import. Dues can generate a schedule; money going out cannot.

1. **The generator** — repeat controls plus a numbered `Installment 1..n` list, the dues sheet's
   shape verbatim: `+ Add` appends, every row has `Remove`, every row carries its own due date and
   amount, amounts fill in automatically and are badged **Auto** but can be over-typed, and a
   plain-language reconcile line states count and total — **a sentence, never a barrier**.
2. **The linked series** — every installment edit and delete offers *This payment only* / *This and
   later payments* / *All unpaid payments*, under rules S1–S8.
3. **⚠ THE TWO-PIECE CAP LIFTS**, and three things are waiting on it (below).

---

## ⚠⚠ Four things the plan says that the CODE does not support yet

Each of these is a real gap, not a nuance. Resolve each one deliberately.

### 1. The engine is MONTHLY ONLY. The plan promises Weekly and Every 2 weeks.

`lib/coach-monthly-recurrence.ts` exports `MonthlyRecurrenceRule` — `dayOfMonth` (1–31 or `'last'`),
`startDate`, and `end: { until } | { count }`. There is **no weekly anything**, and the plan's §4.1
lists **Weekly / Every 2 weeks / Monthly** in the Repeat control.

Weekly is genuinely easier than monthly (no clamping, no short-February question), but it is a
second generator, a second review function and a second set of tests — and the plan's own
carry-forward rules (the ceiling, server-side regeneration, the refusal of dates the rule cannot
produce) all have to hold for it too.

**Decide with the owner before building:** ship **monthly only** and drop the other two from the
control, or build all three. ⚠ Do **not** render a Weekly option that generates monthly dates, and
do not leave a disabled option with no explanation — P3's standing call was that *a control which is
refused is worse than one that is not there.*

### 2. `MAX_MONTHLY_OCCURRENCES` is 24. Nothing else in the product knows that.

The ceiling counts **the series, not the request** — `reviewMonthlyOccurrences(rule, submitted,
existingInSeries)` requires the existing count and is deliberately not defaulted, because a route
that never had to answer it silently allows a 26-row series. ⚠ **`exceedsCeiling` empties every
other field**, so a route that writes `accepted` without reading the flag writes nothing — it fails
closed. Read the flag to tell the coach *why* nothing happened, and make the generator and the route
refuse with **the same sentence**.

### 3. The two-piece cap is enforced in THREE places, and lifting one is not lifting it.

- `parseInstallmentPlan()` in `lib/expense-ledger.ts` refuses `raw.length > 2` with a coach
  sentence. **Both** the create and the edit route call it.
- The money form's split is a literal **deposit/balance two-field editor** — four inputs, no list.
  This is the actual reason for the cap: a longer plan created through the API would be **silently
  truncated to two** the first time a coach saved an unrelated rename.
- The drawer's **"Add an installment"** is offered only on a one-piece bill, for the same reason.

⚠ **Lift the cap and replace the editor in the same change, or not at all.** A raised cap with the
two-field editor still in place re-creates exactly the silent-truncation defect the cap was added to
prevent (`/review`, 2026-08-20).

### 4. Three things are queued behind the cap and are P4's to finish.

- **The payables export's `Deposit` / `Deposit due` / `Balance` / `Balance due` columns.** They
  describe a two-piece plan truthfully today and become a lie the moment six-piece plans exist.
  ⚠ Coaches' own spreadsheets address our columns **by position**, so removing four columns shifts
  everything after them — do it once, here, with the release that makes them wrong.
- **"Add an installment"** in the drawer becomes available on any bill, not just a one-piece one.
- **The help guide's** *"Paying the same thing every month? There's no repeat option yet"* callout,
  and the P3 note that `Add an installment` only appears on single-payment bills. Both in
  `lib/help-content/coaches.tsx`, both false the day this ships.

---

## ⚠⚠ The scope rules — the load-bearing part

S1–S8 are in the plan's §4.3 in full. **Read them there.** Four things the code already decides for
you, and three traps:

**Already built and tested — use these, do not re-derive:**
- `installmentsInScope(standing, targetId, scope)` **is S1**: scopes 2 and 3 never return a settled
  installment. The target itself is included even when settled, because the coach picked it.
- `scopeChoiceIsMeaningful(standing, targetId)` **is S4**: the three-way question is only asked when
  it has more than one answer.
- `planInstallmentWrites()` turns a desired plan into insert/update/delete, and **only deletes
  pieces nothing has been paid against**.
- `paymentRestatements()` is the pure seam for S2 and S6.

**The traps:**
1. **⚠⚠ S2 — DO NOT LOCK A SETTLED INSTALLMENT.** *This payment only* still edits one and the books
   follow. This is the standing owner ruling of 2026-08-16, tested by §27 Part C which passed
   2026-08-19, and walked again in §64 Part E. Locking it reverses a live ruling and re-introduces
   the read-only branches that were deleted with it. **If your scope picker greys out a settled row,
   you have broken this.**
2. **⚠ S3/R4 — partly paid counts as UNPAID and IS reachable by scopes 2 and 3.** P3 made this
   sharper: `installmentStatuses()` now treats partly-paid as **cutting across** the date axis, after
   the single-bucket version was found to be losing a part-paid bill from the default view entirely.
   Keep the same rule here.
3. **⚠ S5 — a bulk date change SHIFTS, it does not SET.** Moving installment 3 from Dec 1 to Dec 8
   under *this and later* moves 4, 5 and 6 by seven days each. Setting them all to one date is
   nonsense on a monthly series, and §64 Part E walks exactly this.

**S6 is the fiddly one:** lowering an amount below what is already applied rolls the excess
**forward** to the next unpaid installment, and **the sentence names every installment it touched**,
not just the next one. Block only when there is nowhere for it to go — the last installment, or the
only one — and then the message names the figure and the reason.

---

## What P3 left you — verify against the code

- **The screen is ONE list** with a `Group by` arrangement (Commitment / Due date). The
  `Schedule | Commitments` toggle and the `Unpaid | Paid | All` pills are gone; `?tab=schedule` and
  `?tab=commitments` survive as URL contracts mapped onto the arrangement.
- **Every bill is a folding header** carrying its next due date, what is still owing and how late it
  is. **The list opens folded** grouped by commitment, **expanded** grouped by due date. A
  one-payment bill folds too — that redundancy is a deliberate owner ruling; do not re-litigate it.
- **The drawer is where a bill is managed**: scheduled pieces, payments recorded with Undo, still
  owing, Edit, Delete, Record a payment. **Your generator's editor and your scope picker land
  here**, not on a new screen.
- **Status is a four-option dropdown with overlapping counts.** Adding a repeating cost must not
  need a fifth option — a repeat is a shape of plan, not a state of a bill.
- **`upcoming-payables` takes `lanes=`** (absent = all). The Payables list asks for
  `lanes=org_payables` only. If P4 needs more from it, add to the request, don't widen the default.
- **⚠ The Payables code lives inside `MoneyRecordsPanel`, which also serves Transactions**, and P3
  deliberately deferred extracting it *because P4 lands in the same area.* **That deferral was made
  for you: decide early whether to extract first.** It is ~500 lines and the plan records it as owed.

## The traps, in the order they will bite

1. **⚠⚠ Do not re-invent month arithmetic.** `generateMonthlyOccurrences` handles the Gregorian leap
   rule in full, clamps short months, and treats `'last'` as a first-class value rather than sugar
   for 31. It has 43 tests and no callers **on purpose** — the form was built against a proven
   generator. Call it.
2. **⚠ The importer's duplicate-description reviewer must NOT be reused.** Every occurrence of a
   repeat shares one description **by design**. This is a carry-forward rule from the archived
   2026-08-15 plan and it will look like a bug to a reviewer who has not read it.
3. **⚠ No migration is expected.** S8: *the series IS the commitment's installments* — there is no
   cross-commitment series and no series record of its own. The rule is used at creation/extension
   time and reconciled against a fresh generation; nothing stores it. **If you find yourself adding
   a table, stop and re-read S8** — you may be building the thing the plan explicitly refused.
4. **⚠ The books must not move.** §64 Part D's step: saving a six-month series leaves **cash on hand
   unchanged** and adds six payments to the schedule. A generator that posts anything is wrong.
5. **⚠ check:layout baselines.** `coach-payables`, `coach-payables-schedule` and
   `coach-transactions` all currently fail on **one shared control family** (the filter pills, the
   checkbox in their panel, the small compact actions, the notifications bell) which is **NOT this
   project's** — it fails identically on Transactions. Do not absorb it, do not baseline it, and do
   not report it as yours. Fix and account for only what P4 introduces, the way P3 did.
6. **⚠ Reseed before sweeping** — `node scripts/seed-uat-coach-fixture.mjs` — and the sweep needs a
   dev server that is not also being used for something else.
7. **⚠ No year parameters.** `coach-history-endpoint-guard` fails the build if the payables screen
   or its routes learn a `?year=`. The one list is the WORKING season, always.

## Definition of done

- **§64 Parts D and E walk clean**, Part E's settled-installment ruling check included.
- The two-piece cap, the two-field editor, the export columns and the three help sentences all move
  **in the same change** — see gap #3 and #4.
- Every scope rule gets a **unit test, not only a QA step** (the plan's own risk-table mitigation).
- `npm run verify:changed` clean (schema parity flags the dev-only migrations — known state; run the
  checks behind it individually) · full `npm test` green · `check:register`, `check:money-report`,
  `check:demos`, `check:help-shots` against a running dev server · `check:layout` on the three money
  screens with any new findings fixed or deliberately accounted for.
- Then offer `/simplify`, then `/review`, then `/docs`.
- **The demo question is CLOSED** — the owner ruled 2026-08-20 that the sandboxes do not need a
  part-payment moment. ⚠ The **staleness** check is not closed and is a different question: neither
  sandbox currently names this screen, but a repeating cost is exactly the kind of thing the coach
  demo's money story might want, and `check:demos` proves breakage, never absence.

## After P4

**P5 — the tail**, and it is small now: the memory baselines, plus whatever the export and help work
above does not already absorb. The in-app help was brought current in P3; the demo sandboxes were
checked and were clean.
