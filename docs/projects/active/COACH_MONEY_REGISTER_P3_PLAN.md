# The Register — money redesign P3, and the cash figure it forced

**Status: BUILT ON DEV 2026-08-17 — Owner QA §46, migration 247 applied to dev.** Phase 3 of
`COACH_MONEY_TAB_REDESIGN_PLAN.md` (§4 ruled 2026-08-16, carried verbatim). Build prompt:
`COACH_MONEY_SPLIT_P3_BUILD_PROMPT.md`. The umbrella plan's §10 P3 carries the full build record.
**PM brief:** [COACH_MONEY_REGISTER_P3_PM_BRIEF.md](COACH_MONEY_REGISTER_P3_PM_BRIEF.md)

This file exists because P3 turned out not to be a screen. §4's build-blocking rule — *the running
balance at Today equals Cash on hand* — could not be met by any register, because **Cash on hand was
already wrong**. Everything in §1 below was found by reading the code before building, and put to
the owner before a line was written.

---

## 0. ⚖ The ruling log

**Raised before the build, 2026-08-17, arguing from the code rather than from §4:**

Four things stopped the balance from ever equalling Cash on hand.

1. ⚠⚠ **Recorded Income and Refunds were not in Cash on hand at all.** `money-summary/route.ts`
   never read `rep_team_money_in`. A coach recorded $500 of income and the headline cash figure did
   not move. It reached Budget vs. Actual as revenue and nothing else. **A live money defect,
   independent of P3.**
2. **An out-of-pocket cost is a recorded expense that moves no team cash** (`expenseTotals().cashPaid`
   excludes it, correctly). The ruled column set had nowhere to say so.
3. **Money handed back to families** (`rep_dues_payouts`) lowers Cash on hand and was not in §4's
   list of derived rows.
4. **Club money had no season.** `rep_team_payment_requests` carried no `program_year_id`, so the
   hub summed approved requests **team-lifetime** into a figure every other part of which is
   season-scoped. `lib/coach-season-settlement.ts` already refused to count them for exactly this
   reason and named the fix (*"a program year on the payment-requests table"*) as the open question.

**Owner rulings, 2026-08-17:**

1. **The register's balance becomes the definition of cash.** Recorded income and refunds move Cash
   on hand, **and the season close-out pot follows the same definition.** Accepted with the cost
   stated out loud: a headline Overview figure changes, and family refund amounts at season
   close-out change — both were understating what the team holds.
2. **Club money gets a real season, now, in P3** — migration + backfill — rather than the register
   showing out-of-season rows or printing a caveat. This closes the open question
   `lib/coach-season-settlement.ts` has carried since 2026-08-14, so club money **enters the
   close-out pot** and `clubMoneyUncounted` retires.

**Nothing is open.**

---

## 1. What the register IS

**One dated book of every dollar this season, with the balance beside it.** Newest first.
**Date · What · Category · Item · Money out · Money in · Balance.** Each row's balance is the balance
*after* that row. Amounts always in their direction's column — no signed single column, ever.

**Opening balance is zero, and that is a fact rather than a convention:** every figure behind Cash on
hand is scoped to the working season (once §3's migration lands), so the season's book starts empty
and the last settled row's balance *is* Cash on hand.

### 1.1 The rows

| Row | Where it comes from | Date | Direction | Tap |
|---|---|---|---|---|
| Expense | `rep_team_expenses` (`expense`, paid) | paid day | out | the money form |
| Payable half | `rep_team_expenses` (`tournament_payable`, half paid) | half's paid day | out | the money form |
| Income | `rep_team_money_in` `income` | received | in | the money form |
| Refund | `rep_team_money_in` `money_back` | received | in | the money form |
| From Dues — payment | `rep_dues_payments` | received | in | Player Dues |
| From Dues — paid back | `rep_dues_payouts` | paid | out | Player Dues |
| From Fundraising — drive | realised `rep_fundraiser_entries` | recorded day | in | Fundraising |
| From Fundraising — sponsor | realised sponsor entries | recorded day | in | Fundraising |
| From Club — allocation paid | `rep_allocation_installments` | paid day | out | Club |
| From Club — funding / payment | approved `rep_team_payment_requests` | reviewed day | in / out | Club |

⚠ **A fundraising entry has no date column** (`rep_fundraiser_entries` carries only `created_at`) —
so the book dates it by when the coach recorded it, which is the only honest answer available and is
said on the row's own chip.

⚠ **Nothing is ever CREATED in the register.** It is a view; "one row, one source" holds because it
cannot grow a create path. Recorded rows open the money form; derived rows navigate to their
workspace.

### 1.2 ⚠⚠ The out-of-pocket row — the one place a column and the balance disagree on purpose

A cost a family paid direct is a real expense and belongs on the book, but **no team cash moved.** So
the row shows its amount in **Money out**, carries a *"family paid direct — no team cash"* chip, and
its **Balance cell repeats the previous balance, muted.** A reader sees the amount, sees the balance
stand still, and the chip says why. Excluding the row would lose a record; moving the balance would
break the identity in §0. Non-colour cue by construction (chip + repeated figure).

### 1.3 Filters, not sub-tabs

One strip: **type** (All · Expenses · Income · Refunds · from Dues · from Fundraising · from Club),
**category/item**, and the **scheduled toggle**.

⚠ **When a filter hides rows, the Balance column hides with it.** A running balance over a subset is
a number that looks like cash and isn't.

### 1.4 The scheduled overlay — default ON

Above Today, soonest first, projected balances **visually distinct from settled ones and never by
colour alone** (a dashed rule, an italic figure and a *Scheduled* chip).

- **Qualifies:** unpaid commitment halves by due date, unpaid plain expenses (dateless — they sort
  last inside the block and carry Mark paid), upcoming dues installments (the *remainder* to send,
  never a face value), recorded sponsor **pledges**, unpaid club allocation installments.
- ⛔ **Never qualifies: anything pending a decision.** A pending club request appears nowhere.
- Scheduled money-out rows offer **Mark paid**, which opens the money form pre-filled and asks when
  — the same one door P1 built.

---

## 2. What it replaces and feeds

- The **Expenses** and **Money in** views retire into it. Their exports become **filtered exports of
  the register** (the type filter names the file).
- ⚖ **The name "Money in" retires** — P1 kept it deliberately against §6 because the list held income
  AND refunds. The register's separate **Income** and **Refunds** filters make the word true of the
  rows under it, so this is the release that retires it (mockup `eca99e68`).
- The **Overview's next-30-days panel becomes a window into the register** — every row deep-links in
  with the overlay on and the type pre-filtered.
- **Payables is untouched** as a workspace. The register is where commitments appear in context.

---

## 3. 🔒 The cash-truth correction (the §0 rulings, as code)

### 3.1 Migration 247 — club money gets a season

`rep_team_payment_requests` gains `program_year_id` (FK → `rep_program_years`).

**Backfill, in order:** the team's program year whose `year` matches the request's `created_at`
year → the team's `active` year → the team's newest year. (`rep_program_years` carries no date
range — only `year` — so a year match is the finest grain available.)

⚠ **The column is then `NOT NULL`.** A request that cannot be attributed to a season is exactly the
bug being fixed, so the migration **fails loudly** rather than leaving a nullable column the readers
assume is populated. Every team is created with a program year, so the expected orphan count is
zero — **the release manager checks it before promoting** (the migration reports the count first).

### 3.2 Cash on hand

`money-summary` gains recorded income and money back, and scopes club requests by season. Both
directions of club money were already there; only their scope changes.

### 3.3 The close-out pot

`SettlementCashInput` gains `recordedIn`; `orgFunding` becomes real (it was hard-coded `0`) and
`clubMoneyUncounted` retires with the caveat it printed on screen. The property test
(`Σ refunds + what stays + hold-back = cash held`) is extended, not weakened.

---

## 4. 🔒 Constraints carried from the umbrella plan §8

Money back ≠ paid out of pocket (exactly one credit) · nothing ever changes a payment schedule, and
the register *displays* dues movements without touching one · one row, one source · never both ·
brackets never a minus sign **on the report** (the register needs neither — its columns carry
direction) · the register shows **no variance** · working season only, no `?year=` anywhere
(`coach-history-endpoint-guard` is the contract) · sport-neutral vocabulary · nothing on a saved
record is read-only.

---

## 5. Concurrency

`COACH_BUDGET_ITEM_INTEGRITY_PLAN.md` runs beside this deliberately; its §6 tabulates the file
boundary. **This work takes migration 247** — that project's uniqueness migration takes the next
free number.

⚠ Both sessions share one working copy and one `dev` branch. Stage explicit pathspecs; `git show
--stat HEAD` after every commit.
