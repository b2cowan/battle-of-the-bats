# Coach Money — one home for the arithmetic

**Status: DIRECTION APPROVED by the owner 2026-08-17 (in conversation).** He agreed with the
proposal and said there is appetite for the refactor now. No code yet.

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
