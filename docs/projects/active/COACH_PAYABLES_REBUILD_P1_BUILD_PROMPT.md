# Build prompt — Coach Payables Rebuild, finish P1

**Paste this into a fresh chat.** Everything below is code-verified as of commit `27fc6a70`
(2026-08-19), not carried from a plan header.

---

## Read first

- `docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` — the spec. **Rules R1–R6 and S1–S8 are
  binding**; they were settled with the owner and each one is a defect if skipped.
- `lib/payable-standing.ts` — the one answer to "is it paid?". Read its header before touching a
  money reader.
- Owner QA **§64** in `OWNER_QA_LEDGER.md` — Part A is exactly this phase's acceptance test.
- Mockup (binding spec): `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`

## Where P1 got to (all committed, `27fc6a70`, dev)

✅ **Migration 255 applied to dev**, not prod. Two tables — `rep_payable_installments` (the plan)
and `rep_payable_payments` (what happened) — plus a backfill of every existing commitment that
**carries each settled half's existing ledger entry** rather than posting a new one.

✅ **Verified on dev after applying:** 50 commitments → 54 installments + 49 payments; **0** without
a schedule, **0** orphaned ledger entries, **0** duplicated, **0** totals disagreeing, **0**
wrong-door records.

✅ `lib/payable-standing.ts` + 28 unit tests. ✅ `getCommitmentStandings()` etc. in `lib/db.ts`.
✅ The payment schedule (`upcoming-payables/route.ts`) reads installments. ✅ Data dictionary.

⚠ **A QA-lab fixture was repaired on dev** — "Fall Showdown entry" disagreed three ways ($600 total,
$400 scheduled, $200 on the books). Seeded data, not a product bug. Now $400 everywhere. Do not be
surprised that a team's cash on hand is $200 lower than an older screenshot.

## What is left — the readers

Each currently reads the deposit/balance/expense-paid columns and must read the standing instead.
**Nothing on screen may change.** Counts are hits of the old field names, not lines of work:

| File | Hits | The trap in this one |
|---|---|---|
| `app/api/coaches/[orgSlug]/teams/[teamId]/budget-vs-actual/route.ts` | 4 | ⚠⚠ **Months files a cost by the date it was PAID**, which is now a payment's `paid_date`, not a half's stamp. A part-paid commitment contributes only what was actually paid. |
| `app/api/coaches/[orgSlug]/teams/[teamId]/register/route.ts` | 6 | ⚠⚠ **§41 Part D: a settle must leave ONE transaction and no second row beside the commitment.** Payments are now their own records — do not emit both. The running balance depends on this. |
| `app/api/coaches/[orgSlug]/teams/[teamId]/money-summary/route.ts` | 4 | Cash on hand and the unpaid counts. ⚠ R4 — a partly-paid installment counts as UNPAID here, for its **remaining** amount. |
| `lib/coach-expense-movements.ts` | 12 | The movements feed. ⚠ `memory/coach-money-one-arithmetic.md`: a feed that walks raw records for itself is a **defect**. |
| `lib/season-settlement.ts` | 7 | Season close. ⚠ Unsettled money **WARNS, never blocks** (standing ruling). |
| `lib/coach-status-model.ts` · `lib/basic-coach-teams.ts` | 6 · 6 | Team summaries + free-tier. Cheap; do them together. |
| `lib/coach-money-exports.ts` | 3 | Export columns. Add installment/payment columns; keep existing headers stable. |
| `lib/coach-budget-import.ts` · `budget-plan/import/route.ts` | 3 · 3 | ⚠ **R1** — an imported payable must now create at least one installment. |
| `lib/email.ts` · `lib/demo-moments.ts` · `lib/demo-coach-reconcile-core.ts` | 2 · 1 · 10 | Reminder copy + the demo world's reconcile. |
| `components/coaches/CoachTournamentRecord.tsx` | 4 | Read-only surface. |
| `app/api/admin/rep-teams/upcoming-payables` + `components/accounting/UpcomingPayablesPanel.tsx` | — | The **admin-side** panel. Easy to miss — it is not under `coaches/`. |

**Deliberately NOT in P1** (they are P2/P3, and changing them now would show write controls the
server refuses): `expenses/panel.tsx`, `expenses/route.ts`, `expenses/[expenseId]/route.ts`,
`lib/mark-paid.ts`, `lib/expense-ledger.ts`. Leave them writing the old columns — that is the
`⚠ THE OLD COLUMNS ARE NOT DROPPED HERE` note in migration 255, and it is what keeps Part A's
before/after comparison falsifiable.

`components/public/RegisterContent.tsx` is **tournament registration deposits**, an unrelated
`deposit_amount`. Do not touch it.

## ⚠⚠ Traps, in the order they will bite

1. **The books must not move by one cent.** Before starting, record cash on hand, the Budget vs.
   Actual total and the next-30 figure for the QA Money lab team. Re-check after every reader.
2. **Settled means paid IN FULL. Partly paid counts as UNPAID** — filters, schedule, next-30, bulk
   scopes. Getting this backwards understates what a team owes.
3. **Never re-derive the arithmetic.** If a screen needs "is it paid" or "how much is left", it calls
   `commitmentStanding()`. A second implementation is the defect
   `tests/unit/money-one-arithmetic-guard.test.ts` exists to catch.
4. **A null `accounting_entry_id` on a payment means two different things** — an out-of-pocket cost a
   family paid (no team cash moved, mig 234) or a record settled before mig 236. Anything that
   reverses money must tell them apart.
5. **Dates:** `formatStoredDate()` only, org day not UTC (`memory/reference_timezone_date_math_gotcha`).
6. **A parallel session is working in `expenses/panel.tsx`, `MultiSelectDropdown.tsx` and
   `coaches.module.css`** (the §63 date-range work). Re-check the branch before committing, stage
   explicit pathspecs only, and `git show --stat HEAD` afterwards. Bracket paths need
   `:(literal)` — `memory/reference_git_bracket_pathspec.md`.

## Definition of done for P1

- Every reader above reads the standing; nothing on screen changed.
- The four reconciliation queries at the foot of migration 255 still return zero.
- `npm run verify:changed` clean; full `npm test` green.
- Then offer `/simplify` (a new shared module was added, so the diff shape warrants it) and
  `/review` — in that order, per CLAUDE.md.
- **Do not apply migration 255 to prod** without an explicit owner instruction.

## After P1

**P2 — recording a payment, and undo.** The two defects that actually cost the owner time. Separate
session; the plan's §5 has the shape.
