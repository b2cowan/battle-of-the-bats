# Money arithmetic has one home per question

**Standing rule, 2026-08-17.** The platform works out three money questions, and each has exactly
one answer in code:

| Question | Its one home | Status |
|---|---|---|
| How much cash do we have? | `cashOnHandCents` in `lib/coach-register.ts` | Already one — the register and `money-summary` both call it, so a source added to one and not the other is a missing argument, not a silent drift. |
| What is left to settle at season's end? | `lib/coach-season-settlement.ts` | ⛔ **Deliberately separate and staying that way.** Pure and dependency-free, it runs under plain `node --test`, which is why it is the best-tested money module in the repo. **Do not fold it in** — this was considered and declined twice. |
| How did we do against plan? | `lib/coach-budget-rollup.ts` | One as of this date. Was three. |

**On Budget vs. Actual specifically: a feed that walks the raw records for itself is a defect.** That
report answered "what did we actually spend?" three times — the statement, the Months grid, and the
cumulative chart rendered directly above the statement — from three independent walks. Adding a kind
of money meant finding all three from memory; getting two of three produced no error, no failing
test, and a screen that simply read low. Two of the three already disagreed before any club money
existed.

**The one honest exception:** the report's **Scheduled** lens keeps its own raw feed, because the
rollup only knows money that has MOVED and the statement has no committed column to grow one from.
Stated in the route so it reads as a decision, not an oversight.

## What enforces it

- `tests/unit/money-one-arithmetic-guard.test.ts` — the rule over the source. Two independent
  rules: the paid stamps (`expense_paid_at` / `deposit_paid_at` / `balance_paid_at`) have exactly
  one reader, and the Months grid must key categories with the rollup's own `categoryKey`.
- `npm run check:money-report` — the rule over a real season's numbers: statement total = Months
  grid total = the chart's last cumulative point, month by month and category by category.
  **It exits non-zero over a fixture too thin to disagree** (needs money back, a commitment paid
  across two months, and club money). A green run over a thin fixture is not evidence.

## Two things not to "fix"

1. **The two date rules are both correct.** `rep_team_expenses.*_paid_at` is written at ORG NOON
   (`orgDayAsStoredInstant`), so a naive UTC date slice lands on the coach's own day. Club money
   carries click-time instants with no such anchoring and needs `orgDayKey()`. Making them "the
   same" reintroduces the off-by-one the convention prevents. (Logged once as a defect, retracted.)
2. **The Months grid's month-splitting of a commitment was always right.** It read the deposit and
   balance stamps separately while the other two feeds collapsed them into the earlier month. Any
   derivation must preserve that — which is why `paidMovements` emits one movement per paid half.

Plan: `docs/projects/active/COACH_MONEY_ONE_ARITHMETIC_PLAN.md`.
