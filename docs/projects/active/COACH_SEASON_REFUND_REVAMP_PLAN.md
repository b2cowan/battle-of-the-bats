# Coach Money — credits meet the bills, money goes out, and the refund sheet derives

**Status:** approved from mockups 2026-08-14 (owner) · **NOT STARTED**
**PM brief:** [COACH_SEASON_REFUND_REVAMP_PM_BRIEF.md](COACH_SEASON_REFUND_REVAMP_PM_BRIEF.md)
**Binding mockups:** `claude.ai/code/artifact/eae663d0-56e5-46e9-a2e2-9f7220468be2`
(source `COACH_CREDIT_APPLICATION_MOCKUP.html` — tagged NEW/RESTYLED/UNCHANGED; the mockups ARE
the spec)
**Kickoff prompt:** `COACH_SEASON_REFUND_REVAMP_KICKOFF_PROMPT.md` (its listening phase is complete;
this plan supersedes it)
**Depends on:** `COACH_DUES_PAYMENT_RECORD_PLAN.md` (mig 232 — payments as facts). That project is
on `dev` awaiting commit; **this build must not start until it is committed**, since every pass
here edits files it owns.

> **Scope note.** The kickoff scoped "the Season Refund Calculator gets a real model." The owner's
> walkthrough grew it: a refund is the *last* act of a system that must first let credits meet
> bills and let money leave the team. The refund screen is Pass 3, and cannot be built first.

---

## 1 · The model, in one sentence

**A credit is money the team owes a family.** It is settled in exactly one of three ways — it
lowers their remaining bills, it is paid out in cash, or it is handed back at season's end — and
every dollar is always in exactly one of those states.

That single idea replaces four things that exist today: an undifferentiated credit pile, a hand
typed surplus pot, a refund that pays credits it has already spent, and no outbox at all.

### The distribution rule (owner, 2026-08-14), stated once

> Owed-back money is paid to whoever earned it. Amounts already settled — forgiven, or handed
> over — count as that family's share, already received. Whatever is left divides evenly among the
> families still taking one.

Debt joining the pot (Call 7), a departed player stepping out (Call 8), forgiveness and hand-set
amounts (Call 10) are all that one sentence. It is why the sheet can always show its work and
always balance.

---

## 2 · What was verified before planning (re-verify before changing)

Measured against the live dev database and the real routes, not against plan headers.

| Claim | Verified |
|---|---|
| `QA Season End U15` fixture intact | 10 players, $600 dues each, 30 installments all covered, 30 payment rows totalling **$6,050**, credits **$675** ($625 fundraiser + $50 overpayment), Cookie Dough Drive closed at 25%, raised **$2,500**, budget $7,000, **$6,350** paid spending |
| The fundraiser flow posts **the full amount raised** to the team ledger | `fundraisers/[fundraiserId]/entries/route.ts` — income entry `amount: raised`, then a separate rebate credit. The team share is **never** the posted figure |
| `money-summary` money-in uses **raised**, not the team share | `moneyInTotal = duesCollected + fundraisingRaised + orgFunding` |
| `duesCollected` is **capped** at each schedule total | via `duesPaidAmount` — so it silently excludes Umar's $50 overpayment |
| The season-surplus route is **already season-aware** | it calls `resolveCoachSeasonRead`, and `'season-surplus'` is in `APPROVED_SEASON_AWARE_ROUTES`; `Money` is an approved archive door |
| The U15 fixture wrote rows directly | no ledger entries exist for it — the fixture cannot be used to prove ledger-derived figures without re-seeding through the app or extending the seeder |

### ⚠ 2.1 The double-subtraction — the reason the pot must be derived

The figure in circulation for this team was **$1,575**, reached as dues + *the team's 75% share* of
fundraising − spending. But the books receive the **full $2,500**; the players' $625 is a credit,
not a deduction from income. So $1,575 already had the rebates removed — and today's calculator
then subtracts **all** credits again, taking the same $625 out twice.

```
Dues received (uncapped)      $6,050.00
Fundraising raised            $2,500.00
Spent                        −$6,350.00
                             ──────────
Cash the team holds           $2,200.00
Owed to families (credits)      −$675.00
                             ──────────
Surplus to share              $1,525.00      ÷ 10 = $152.50 each
```

**Not $90.** Every downstream number in the kickoff prompt's walkthrough moved.

### ⚠ 2.2 The pot must be built from UNCAPPED receipts

`duesCollected` caps at the schedule total so an auto-credited overpayment isn't counted twice in a
*balance*. For the **pot** that cap is wrong — the $50 physically arrived and the team is holding
it. The pot's money-in reads raw payment dollars; the credit side then accounts for the $50 as owed
back. Using the existing tile figure would understate the pot by exactly the overpayment excess,
which is the trap the kickoff prompt already flagged from the coach's side.

---

## 3 · Owner rulings

| # | Question | Ruling |
|---|---|---|
| 1 | Cover the bill, or rewrite its amount? | **Cover** — face amount survives, the credit is shown paying it down |
| 2 | Which bill first, and who chooses? | Team-wide setting, three values: **last payment first** (default) · next payment first · **keep separate** (credits never touch bills) |
| 3 | Do hand-entered credits behave the same? | **Yes** — one rule for every credit kind |
| 4 | Does the family hear why the bill dropped? | **Yes** — reminders name the fundraising |
| 5 | Is a parent's out-of-pocket cost a credit? | **Yes** — a reimbursement credit, same lifecycle, no parallel system |
| 6 | Does money-out ride with this build? | **Yes** — three passes, one model |
| 7 | Does a family that still owes get a share? | **Yes, and their debt counts as money coming in.** Pot grows by it, every share rises, their share cancels most of the debt |
| 8 | Who is in the even split? | Owed-back follows **whoever earned it** (active or departed); the even share goes to the **season's-end roster**. Anyone left out **raises everyone else's share** — never a stranded share |
| 9 | Team can't cover what it owes? | **State it, share nothing, pro-rate nothing** |
| 10 | Forgive a balance / set an amount by hand | Both. A settled amount **counts as that family's share, already received**; whatever's left splits among the rest. **No free-text override of a refund total** |

Ratified by "looks good" on the mockups, 2026-08-14. Calls 1–6 were recommendations drawn in the
mockups and are adopted as drawn; **if any is wrong, correct it before Pass 1 starts** — Call 2's
default and Call 6's scope are the two with real consequences.

---

## 4 · The arithmetic, specified

Everything below is **derived on read**. Nothing about where a credit landed is ever stored — the
same discipline `lib/dues-payments.ts` already applies to payment coverage, and for the same
reason: a stored allocation goes stale the moment dues change, a payment is removed, or a credit is
resized.

### 4.1 Coverage order

- **Payments fill installments oldest-first** — unchanged, `lib/dues-payments.ts`.
- **Credits fill newest-first** (default) — the opposite end, so the two never contest a dollar.
- **Cash always claims a bill before a credit does.** If a family pays everything in cash anyway,
  the credit finds nothing to lower and becomes owed-back. This is the rule that makes the model
  self-correcting; it must be pinned by test.
- Setting `next_first` reverses the credit direction only. Setting `keep_separate` skips credit
  application entirely — every credit dollar is owed-back from birth.

### 4.2 The three states of a credit dollar

```
credits issued = applied to bills + paid out + owed back
```

This identity must hold for every player, in every mode, at all times. **It is the single best
test assertion in the project** and should be asserted over the whole seeded world, not just unit
fixtures.

`credit_type = 'forgiven'` (new — §5.1) is the one exclusion: a forgiveness lowers bills like any
credit but is **never** owed back and can **never** be paid out. It is debt relief, not the
family's money.

### 4.3 The pot

```
cashHeld   = Σ payments received (UNCAPPED)
           + Σ fundraising raised
           + org funding received
           − Σ cash money out
owedBack   = Σ credits − Σ credits applied to bills − Σ payouts made
             (excluding credit_type 'forgiven')
expectedIn = Σ (each player's outstanding balance − amount forgiven)
surplus    = cashHeld − owedBack + expectedIn − holdBack
```

⚠ **"cash money out" excludes out-of-pocket expenses** (§6.2). A cost a family paid directly never
left the team's account; counting it would subtract money the team still holds. It counts in the
budget and in Budget vs. Actual exactly as before — only the *cash* line excludes it.

⚠ `holdBack` is capped at `surplus` before hold-back, and is refused against owed-back money: a
coach may not hold back money the team owes families. The field states that reason inline.

### 4.4 Distributing the surplus — water-filling

Each participating player has `settled_i` (amount forgiven; hand-set amounts are removed from the
split entirely and come off the top first). Solve for the level `B` where the cash available
exactly covers topping everyone up to it:

```
Σ over participants of max(0, B − settled_i)  =  surplus
```

- `cashShare_i = max(0, B − settled_i)`
- `refund_i = owedBack_i + cashShare_i − outstanding_i`
- A negative refund means **still owes** — shown as such, never as a payout.

Worked, on the owner's own numbers (surplus $1,525, ten players):

| Scenario | Result |
|---|---|
| No debts, no forgiveness | B = $152.50 each |
| Zeb owes $200, expected to pay | pot $1,725 → B = **$172.50**; Zeb nets **−$27.50** (still owes) |
| Zeb's $20 balance forgiven | B = **$154.50**; Zeb receives $134.50 cash, others $154.50 |
| Zeb's $200 balance forgiven | $200 > a share ⇒ Zeb drops out; **$169.44** each to nine |
| Vera declines her share | $169.44 each to nine; **Vera still receives her $125 owed-back** |

**Rounding:** integer cents throughout (the existing `lib/dues-payments.ts` discipline). The
remainder lands on the last row so the rows re-add to the pot exactly — the same rule the
installment splitter already uses.

### ⚠ 4.5 The cash-timing consequence — must be surfaced, not hidden

A forward-looking split spends money that has not arrived. With Zeb owing $27.50 after netting,
nine payouts total $1,552.50 while the team holds $1,525.00. The arithmetic balances the moment
Zeb pays; the cheques cannot all be written until then. **The sheet says which family's money the
others are waiting on** (drawn in the mockups). Silently letting a coach discover this at the bank
is the failure mode.

---

## 5 · Data model

Migrations are **dev-first**; prod ordering rides the release runbook. Dictionary +
`npm run refresh:snapshots` in the **same unit of work** (`check:dictionary` gates it).

### 5.1 Changes

| Change | Why |
|---|---|
| `rep_program_years.credit_application` (text, CHECK `last_first\|next_first\|keep_separate`) | Call 2. Joins the existing coach-side fields (`budget_amount`, `auto_reminders_enabled`, `lineup_settings`) |
| `rep_dues_credits.credit_type` CHECK gains **`forgiven`** and **`reimbursement`** | Forgiveness (Call 10) and out-of-pocket (Call 5) — one mechanism, per CLAUDE.md's standing constraint |
| **`rep_dues_payouts`** (new) — program_year_id, player_id, amount, paid_date, method, note, accounting_entry_id, source, created_by | The outbox. Deliberately the mirror of `rep_dues_payments`, including its RLS-with-no-policies (service-role) treatment |
| `rep_team_expenses.paid_by_player_id` (FK → `rep_roster_players`, nullable) | Out-of-pocket. Presence means: budget yes, cash no, credit created |
| `rep_season_refund_adjustments` (new) — program_year_id, player_id, kind (`fixed`\|`no_share`), amount, note | Hand-set amounts (Call 10). Forgiveness is **not** here — it is a credit |
| `rep_season_surplus` — add `hold_back_amount`, `distribution_state`; **`total_surplus` becomes legacy** | The typed pot dies. The row survives as the season's distribution settings |

### 5.2 Decisions recorded

- **Credit application is derived, never stored.** No `installment_id` on a credit. (§4)
- **Forgiveness is a credit, not a write-off record.** It genuinely reduces what a player owes,
  which is precisely what a credit does — so it reuses the one mechanism and lowers bills like any
  other. It is excluded from owed-back by type.
- **`total_surplus` is retained, not dropped.** Dropping loses history on both databases; the
  dictionary records it as legacy-read-only and nothing new reads it. ⚠ A live column nothing
  reads is itself a drift smell — the dictionary entry must say so explicitly.
- **Out-of-pocket posts nothing to the cash ledger.** The alternative (post an income entry from
  the family *and* an expense) nets to zero but invents money-in from a family that sent none.

### ⚠ 5.3 OPEN QUESTION 1 — the default for existing teams

Setting `credit_application` to `last_first` on existing seasons **changes live customers' reminder
amounts overnight**. Recommended: the column defaults `last_first` for **new** program years, and
the migration **backfills every existing row to `keep_separate`** (today's behaviour), so nothing
moves under a coach without them choosing it. A one-time in-product nudge offering the switch is
proposed but not scoped here. **Needs an owner call before the migration is written.**

---

## 6 · The passes

Each pass is independently shippable and ends green. `/simplify` then `/review` on each (§9).

### Pass 1 — Credits land on bills

0. **First, before any feature work:** build `lib/dues-credits.ts` and move all five existing
   credit-summing copies (§7.1) onto it, as a behaviour-preserving refactor with tests. The new
   three-state logic then lands in **one** place instead of five. Doing this second would mean
   getting the same new rule right five times, with no regression net (§7.7).
1. Credit application lives in that module — pure, integer cents, no database — and it joins the
   definition guard's `DEFINITION_HOMES` (§8).
2. Installment views gain **"to send"** and a covered-by line; a fully covered installment reads
   **"Covered by fundraising"**, deliberately **not "Paid"** — Paid stays cash.
3. Player drawer gains the **Left to send** stat (dues − cash − credits).
4. Fundraiser entry sheet gains the **"Where it lands"** preview (the payment sheet's language).
5. The three reminder paths quote the net remainder and name the fundraising; a zero-remainder
   installment is never a candidate. Composes with part-payments: *"$100.00 to send of $800.00 —
   $200.00 received, $500.00 covered by fundraising."*
6. Money settings gain the three-way credits control.

**Definition of done:** the identity in §4.2 holds across the seeded world; a family whose credit
covers a bill is never chased for the gross amount anywhere.

### Pass 2 — Money out

1. **Pay out** sheet — mirror of Record payment (amount · date paid · method · note), opened from
   the drawer and from a credit row. Partial payouts supported; the remainder keeps covering bills.
2. Removing a payout re-derives everything, exactly as removing a payment does.
3. Ledger: one money-out entry per payout, dated the day the money left; removal **voids** the
   entry first (never orphans, never rewrites — the standing rule).
4. Expenses gain **Paid by** (Team ▾ / a family, out of pocket → player). Creates a
   `reimbursement` credit; **no cash ledger entry**; Budget vs. Actual unchanged.
5. Every reader that sums credits learns the three states.

**Definition of done:** paying a rebate out in cash puts that family's bills back up, in the same
session, with the books balancing.

### Pass 3 — The refund sheet

1. **Delete** the Calculate button, the typed pot, and the collapsible's current body.
2. The derived pot card, showing its work (§4.3), with the hold-back control.
3. The refund table — four columns (Player · Owed back · Even share · Refund), a row that **opens**
   to its breakdown, family grouping so siblings are paid once, and per-row + bulk **Pay out**
   (Pass 2's sheet, pre-filled).
4. Row menu: *an even share* / *a set amount* / *no share* / *forgive balance owing*.
5. The shortfall state (§4, Call 9) and the cash-timing strip (§4.5).
6. **It renders whenever any family is owed anything** — not gated on season end. In October the
   share column is simply empty and the section reads "the team is holding $675 of families'
   money."

**Definition of done:** no typed input anywhere; rows always re-add to the pot; every number
explicable by opening one row.

---

## 7 · Every reader that must change — full inventory

Verified against the source tree, 2026-08-14.

### 7.1 ⚠ There is no shared owner of credit arithmetic — there are five copies

`lib/dues-payments.ts` owns payment allocation; **nothing owns credits.** Summing
`rep_dues_credits.amount` grouped by player is re-implemented independently in four server call
sites, each with its own query and its own `reduce`, plus a fifth re-aggregation in the UI:

| # | Where | Lines |
|---|---|---|
| 1 | `lib/db.ts` → `getRepPlayerDuesSummary` (serves the player profile) | 5501-5528 |
| 2 | `dues/route.ts` GET — the dues table's credit map | 79-129 |
| 3 | `season-surplus/route.ts` → `buildRefundBreakdown` | 42-97 |
| 4 | `fundraisers/[fundraiserId]/entries/route.ts` GET | 92-129 |
| 5 | `accounting/dues/panel.tsx` — client-side season totals | 586-606 |

This is the exact pattern `lib/dues-payments.ts`'s own header warns about ("Five hand-copied reduce
loops preceded this helper") — the helper was simply never built for credits. **Pass 1's first act
is to build it** (`lib/dues-credits.ts`) and move all five onto it. Doing the feature work first
would mean applying the new three-state logic five times and getting it right five times.

### 7.2 Credit writers

- Manual credit POST — `players/[playerId]/dues-credits/route.ts` (103-116)
- Fundraiser entry POST — `fundraisers/[fundraiserId]/entries/route.ts` (263-278)
- Fundraiser entry PATCH — creates when a rebate goes 0 → positive (91-109)
- `reconcileOverpaymentCredits` — `lib/db.ts` (9032-9097), the one genuinely shared credit
  mechanism today, scoped to overpayment credits only
- Deletes: manual DELETE route; the PATCH path when a rebate drops to 0; the reconciler's
  shrink/delete; plus DB cascades from player/program-year/payment

### 7.3 Credit renderers

Dues panel (roster Credits column, footer, drawer list, Add/Delete form) · player profile Credits
stat · fundraiser list "Credits" · fundraiser detail "Credits Issued" · `InstallmentBreakdown`'s
"In credit" states · the dues export's **Credits** column and the fundraiser export's **Player
credits** column (`lib/coach-money-exports.ts`)

### 7.4 Confirmed NOT credit readers — do not "fix" them

`budget-vs-actual` (dues counted paid-only, deliberately) · `lib/insights-digest.ts` (credits
deliberately excluded, matching the dashboard) · the Ask routes (no credit references at all).
Leave these alone; their exclusion of credits is a ruling, not an oversight.

### ⚠ 7.5 A second, independent "credits" number

`money-summary` reports `fundraisers.creditsIssued` by summing
`rep_fundraiser_entries.rebate_amount` **directly — bypassing the credits table entirely.** Today
the two agree by construction. Under this model they will **diverge**, because a fundraiser credit
can be applied, paid out, or forgiven while the entry's `rebate_amount` never moves. This figure
must either move onto the new shared reader or be relabelled to what it actually is (what the drive
awarded, not what is owed).

### ⚠ 7.6 A naming collision to resolve

`fundraisers/entries` computes `outstanding = totalDues − paid − credits` and clamps at 0 — that is
**not** the shared `outstandingForSchedule` (which deliberately *excludes* credits and does not
clamp). Two different numbers wear one word across two screens. Fold into the shared reader with an
honest name; the dictionary already flags the clamping inconsistency as gotcha 3.

### ⚠ 7.7 The coverage gap

**No test anywhere exercises the credits table's reads or sums** — not `getRepPlayerDuesSummary`,
not the dues route's credit map, not `buildRefundBreakdown`, not the fundraiser entries map, and
nothing at all touches `rep_season_surplus`. Existing coverage is only on the pure helpers in
`lib/dues-payments.ts`. Every one of the five call sites is being rewritten with **zero regression
safety net today**; the shared module plus §8's tests are what create one.

⚠ **Assume every credit sum in the tree is a defect until re-read.** A credit that already lowered
a bill must not also reduce a balance a second time — the same shape as the defect the
payment-record project found in five readers.

---

## 8 · Anti-drift

- Extend `tests/unit/dues-definition-guard.test.ts`: add `lib/dues-credits.ts` to
  `DEFINITION_HOMES`, and add a rule banning hand-rolled credit summing outside it — the same
  treatment that stopped stamp-sums. **Verify the new rule by breaking it**; a green test never
  shown to fail is not evidence (the lesson from the money-hierarchy test).
- Pin the §4.2 identity as a property test across the seeded world.
- Pin **cash-claims-first** explicitly: a family who pays everything in cash frees their credit to
  owed-back.
- Pin the water-filling solver against all five §4.4 scenarios plus the degenerate ones (one
  player; everyone forgiven; surplus zero; surplus negative).
- Pin that rows re-add to the pot to the cent across randomised rosters.

---

## 9 · Verification

- `npm run typecheck` (shared modules + API contracts change) — ⚠ `npx next typegen` first.
- `npm run verify:changed` per pass. Known: schema parity fails while prod is behind on
  migs 230/231/232 — pre-existing, resolves at release.
- Full unit suite per pass.
- **Rendered** `npm run check:layout --only=coach-dues` — ⚠ on a **restarted** dev server, and
  ⚠ **against a fixture with real data**: the empty-fixture finding from the table-consistency
  pass means a green sweep over an empty Money screen proves nothing.
- `npm run check:demos` + demo copy re-read (§10).
- Owner QA: new section in `OWNER_QA_LEDGER.md`.

### ⚠ 9.1 The fixture needs a second scenario

On `QA Season End U15` every family paid in full **before** the drive closed, so all $675 lands in
owed-back and **nothing exercises the applied / paid-out distinction** — the fixture cannot tell
the new model from the old one. The seeder needs a second team where the drive closes mid-season
(credits applied to real bills), plus a family still owing, a forgiven balance, and a departed
player. **Without it, Pass 1 and Pass 3 are untestable end-to-end.**

---

## 10 · Demos, help, archive

- **Demos.** The coach sandbox's Season's End team (`riverdale-ridge` 13U) shows a settled Money
  door; the mid-season team has a part-paid family. Both narrations must be re-read against the new
  screens, and a demo moment showing fundraising lowering a bill is worth considering — that is the
  most sympathetic thing this product does. `check:demos` catches breakage, never absence.
- **Help docs.** `/docs` in the same unit of work as each pass — the Money guide describes credits
  as balance reductions, which Pass 1 makes false.
- **Archive.** ⚠ `season-surplus` is **already** in `APPROVED_SEASON_AWARE_ROUTES` and `Money` is
  an approved archive door, so the refund sheet is **already readable in a finished season**. No
  list gains an entry — but Pass 3 must ensure an archived season renders the **record** with
  **no payout controls, no hold-back, no row menu**, and Pass 2's write routes must resolve the
  ACTIVE year only (the default, and the safe one). The frozen-season smoke sweep covers it.

---

## 11 · Risks and traps

1. **Every existing credit sum is suspect** (§7) — the single largest source of defects here.
2. **Behaviour change for live teams** (§5.3) — unresolved, blocks the migration.
3. **Money panels stay mounted**; any new modal takes the caller's `tabActive` or its
   unsaved-changes guard hijacks clicks app-wide (paid for twice already).
4. **Timezone** — "the day money left" is an org-timezone date (`lib/timezone.ts`), like
   `received_date`.
5. **Non-transactional multi-writes** — the payout path writes a ledger entry and a payout row; the
   payment path's documented failure windows apply equally. Secure the row before the side-effect.
6. **Colour** — negative money stays red; a family "still owes" is amber, not danger. ⚠ The
   olive↔danger ΔE 1.0 deutan finding stands: **never colour alone**.
7. **Shared modules change ⇒ dev server restart** before browser testing.
8. `check:layout` aborting on the memory floor is a **failure**, not a pass; the exit code seen
   through a pipe is `tail`'s.

---

## 12 · Out of scope

Org allocations and payment requests (different domain, no payment record) · the free Basic coach
fee ledger · family-facing money screens (reminders remain the only figure a family sees) ·
distributing anything other than cash · tax/receipting.
