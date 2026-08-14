# Coach Money — credits meet the bills, money goes out, and the refund sheet derives

**Status:** approved from mockups 2026-08-14 (owner) · **PASS 1 committed `8fb37066` 2026-08-14**
(mig 233 on dev) · **PASS 2 committed `cfb3a5f7` 2026-08-14** (mig 234 on dev) · **PASS 3 built on
dev 2026-08-14** (mig 235 on dev; owner QA §21) — **all three passes complete**
⚠ **Migrations 233, 234 and 235 are on dev; every one of them must reach production before this
code ships** (they join 230–232 in that queue).
⚠ **The Pass 3 `/docs` help edits are NOT in `735c9ae2`** — the same situation Pass 1 hit, for the
same reason: a concurrent session was mid-flight in the coaches guide, so committing it would have
swept up work that was not this project's to commit. The new **Season settlement** sub-topic, its
popular FAQ, its search terms and the re-captured Player Dues screenshot's alt/caption sit on disk
and ride that session's next commit. (The screenshot itself, and the manifest entry, ARE in this
commit — only the guide prose is held back.)

⚠ **The `/docs` help edits are NOT in `8fb37066`.** A concurrent session was mid-flight in the
same guide file, so committing it would have swept up work that was not this project's to commit
(it did, once — caught by the post-commit stat check, unwound, re-committed without it). The
Money-guide copy sits on disk and rides that session's next commit.
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

### 5.3 The default — RESOLVED (owner, 2026-08-14)

The concern was that switching existing seasons to `last_first` would change live customers'
reminder amounts overnight. **Owner: there are no teams on production, so choose what makes most
sense.** Accordingly:

**`credit_application` defaults to `last_first` for every season, new and existing. No
split-default, no staged backfill, no one-time nudge** — all of which existed only to protect
customers who do not exist. The simplest migration is now also the correct one, and every team
starts on the behaviour the product wants to demonstrate.

⚠ Two consequences to carry: the **demo and QA seasons on dev will pick this up**, which is
desirable (the demos should show fundraising lowering a bill) but means their narration and
`check:demos` must be re-read in the same pass; and `keep_separate` is now a **choice a coach
makes**, never a state anyone is silently left in — so its first real exercise is a test, not a
customer.

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

### Pass 1 build log (2026-08-14) — BUILT on dev

**Step 0, the refactor, first as specified.** `lib/dues-credits.ts` is the credit half of the
model (sibling of `lib/dues-payments.ts`, integer cents, no database): `creditsTotal`,
`creditsTotalByPlayer`, `groupByPlayer`, `applyCreditsToBills`, `deriveDuesPosition`,
`normalizeCreditApplicationMode`. All five hand-copied credit sums (§7.1) moved onto it.

**Migration 233** (dev): `rep_program_years.credit_application` (CHECK
`last_first|next_first|keep_separate`, default `last_first` for every season — §5.3) and
`rep_dues_credits.credit_type` CHECK widened with `forgiven` + `reimbursement`. Dictionary +
`refresh:snapshots` in the same unit of work; `check:dictionary` green.

**The derivation reaches every reader** — dues route (payload gains `remainingAmount` as the NET
figure, `creditApplied`, `creditSettled`, `creditSources`, `leftToSend`, `owedBack`), mark-paid
shortcut (records the NET ask), money-summary, upcoming-payables, Ask, the weekly digest,
`getDueReminderCandidates`, `getUnpaidDuesReminderTargets`, the fundraiser entries route,
InstallmentBreakdown, the dues panel. All six server sites go through **one** assembly
(`deriveDuesPosition`) — that seam is where Pass 2 wires `paidOut`.

**UI, to the binding mockups:** "$X to send" and "Covered by fundraising" (never Paid — Paid
stays cash), the covered-by line naming the earning, **Left to send** replacing Balance in the
drawer stat grid, an owed-back strip ("the team is holding $X of this family's money"), the
three-way **Credits reduce** setting at the foot of Player Dues, and the fundraiser sheet's
**Where it lands** preview (built from the real `applyCreditsToBills`, never a re-derivation).
`duesStatusLabel` gains **Settled** (credits did part of the work) beside **Fully paid** (cash).
Reminder emails open with the earning and quote the net ask; a family whose credits settled
everything is never a candidate.

**Fixtures (§9.1 closed):** the money lab gains **QA Mid Season U14** — the drive-closed-mid-season
world, one player per rule (paid-in-full-first so their rebate is owed back; last-bill-first
application + cascade; part-paid and behind; earned-but-paid-nothing; a forgiven balance; a
departed player). The UAT sweep fixture gained a fundraiser credit, without which every new
element had zero geometry.

**Gates:** typecheck ✓ · 1,765 unit tests ✓ (new: 17 credit-module tests incl. a 500-run
randomised property test pinning `issued = applied + paidOut + owedBack` in every mode, plus
cash-claims-first, the mode-aware status label, and the net-remainder lens) · guard test extended
with a credit-sum rule and **verified by breaking it** (both offender shapes) · focused lint 0
errors · rendered `check:layout` on dues/fundraisers/overview × 4 widths, no new findings, run on
a restarted server against a fixture with real data ✓ · `check:demos` ✓ · `verify:changed` green
except the known schema-parity failure (prod behind on migs 230–233).

**`/simplify` (4 lenses):** the assembly seam + `groupByPlayer` (eight hand-written groupings and
six hand-composed allocate→apply→map sequences collapsed), `installmentToSend` exported as the one
remainder rule, `creditSettled` served by the server instead of re-derived in the client, the
credits-mode option list driven from `CREDIT_APPLICATION_MODES`, two dead fallbacks dropped, and a
credits fetch folded into an existing `Promise.all`.

**`/review` (high-risk, 5 lenses) earned its keep — 1 Critical + 3 High, all fixed:**
- **Critical — `duesStatusLabel` was mode-blind.** On a `keep_separate` team an unapplied credit
  made `rollingBalance` zero, so the row read **Settled** (and, past the balance, "in credit —
  in their favour") beside bills the family still owed in full. The label is now mode-aware from
  the derived figures, with the legacy branch kept only for pre-model callers; six new tests pin it.
- **High — the Ask "who owes" answer mixed arithmetics**: the family headline summed the
  credit-blind figure while its own receipt lines quoted the net one, so a credit-settled family
  could be told they "owe $X" with no receipts to show for it. `computeFamilyDues` now takes
  `leftToSend`.
- **High — the digest's "$X outstanding across the team"** was gross beside a credit-aware count;
  now net.
- **High — a mark-paid race**: `toSend` was derived *before* the atomic claim, so a concurrent
  Record-payment could make it stale and the click double-record. The claim now comes first and
  the money is read after it (and one `claimStamp` serves both the claim and its revert — the two
  separate `new Date()` calls meant the failure revert could never match its own row).
- Also fixed: the overdue count on both the Overview tile and the panel counted credit-covered
  bills as late; the Overview dues tile quoted the gross ask; a superseded credit-mode failure
  could stomp a newer choice; `paidOut: NaN` could poison the reported totals.
- **Refuted/verified-safe:** email escaping (every interpolation goes through `esc`), the
  capability/tenant scoping on the new and reworked routes, the migration's CHECK widening
  (strict superset) and default, cents rounding, and the `remainingDues → leftToSend` rename
  (no live consumer of the old name).

**Report-only residual for the owner:** `rep_dues_credits.description`/`notes` are coach-entered
free text visible to a money-view coach without the roster-PII grant — **pre-existing**, not
introduced here, and the same open question the payment-note fence raised on 2026-08-13.

**Demos — the judgment the rule asks for, recorded rather than skipped.** The coach sandbox has
**no fundraiser rows at all**, so Pass 1 falsifies nothing in its narration (`check:demos` green).
The gap is absence, not breakage: the demo cannot yet show fundraising lowering a bill — the most
sympathetic thing this product does. Building it means a seeded fundraiser + credit whose date
shifts with the nightly re-anchor, a `check-demo-coach` pin, and a tour sentence; **deliberately
deferred to Pass 3**, where the Season's End demo story is rebuilt anyway, so the demo world is
re-seeded and re-narrated once rather than twice.

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

### Pass 2 build log (2026-08-14) — BUILT on dev

**Migration 234** (dev): `rep_dues_payouts` (the outbox — the mirror of `rep_dues_payments`,
RLS-enabled-no-policies), `rep_team_expenses.paid_by_player_id`, and — added during `/simplify` —
`rep_dues_credits.expense_id` (CASCADE), so a reimbursement credit can never outlive the cost it
was repaying. Dictionary + snapshots in the same unit of work.

**Delivered:** a **Pay out** sheet on the player's record (amount · the day the money LEFT · method
· note) posting one money-out ledger line dated that day; a payouts receipt list with per-row
remove that **voids** the entry and returns the money to being owed; **Paid by** on an expense
(Team ▾ / a family, out of pocket) creating a `reimbursement` credit and **no cash entry**; and
`paidOut` threaded through the single shared assembly, so every reader learned the third state at
once.

⚠ **Paying out puts the bills back up** — and the sheet is offered whenever a family has credit
left, *including* credit currently sitting on a bill (binding mockup §5). Gating it on owed-back
hid the button in exactly the case the mockup draws; caught in review.

**Gates:** typecheck ✓ · 1,773 tests ✓ · rendered `check:layout` (dues/expenses/overview × 4
widths) no new findings ✓ · `check:demos` ✓ · dictionary ✓ · 0 lint errors. Schema parity fails
only on the known dev-ahead migrations (230–234).

**`/simplify` (4 lenses):** `amountsTotal` as the neutral sum with `creditsTotal` as its
credit-domain alias (payout totals stopped reading as credit sums), `creditsTotalByPlayer` →
`totalsByPlayer` (it serves both), the payout sheet's derived values declared once instead of
three divergent copies, a typed `PayoutExceedsOwedError` carrying its ceiling (no second
round-trip on the refusal path), the roster fetch made lazy to match the panel's own convention,
and `createOutOfPocketExpense` as the one door that writes the expense and its debt together.

**`/review` (high-risk, 5 lenses) earned its keep — 2 Critical + 3 High, all fixed:**
- **Critical — a payout double-spend race.** Two Pay out clicks could each pass the ceiling check
  against the same pre-write snapshot and both go through, handing a family more cash than the
  team owed. The payment path had learned this exact lesson in the 2026-08-13 review; the payout
  path had no equivalent. Now the write **re-checks against the true post-write state** and the
  loser undoes itself (voids its entry, deletes its row, refuses).
- **Critical — the season-end sheet could overpay across families.** Each row clamped at zero
  while the pool total was built from unclamped figures, so one family's over-payout silently
  cancelled another family's real credit. The per-player figure is now the definition and the
  total is its sum — one operation — and forgiveness is excluded from both.
- **High — an out-of-pocket expense marked paid posted a phantom cash entry.** The normal workflow
  would have booked money out of an account it never left, putting the coach's cash on hand at
  odds with the org ledger. Out-of-pocket expenses are now created **already settled**, and the
  Mark-paid action refuses them with a plain reason.
- **High — the Credits and Balance columns (and the dues export) still showed money already handed
  back**, telling a coach a family's dues were lowered by cash they had already received.
- **High — a credit could be deleted after being paid out**, leaving the books owing a family less
  than they had received (and inflating everyone else's season-end share). The delete now refuses
  with the reason and points at the payout.
- Also fixed: the refund card's "Individual credits" label (the figure had quietly become *credits
  still owed*), a silent orphan if the out-of-pocket credit write failed (the expense now undoes
  itself), and a stale symbol name in the guard test's message.
- **Verified safe:** RLS posture on the new table, capability gating and active-year-only
  resolution on both new routes, cross-team player validation, amount validation, and the
  derived-read model (no stamped state to go stale).

**⚠ A seeder bug found and fixed while re-seeding, worth recording:** marking the departed player
inactive shifted every roster index on the *second* run, because the roster helper returns active
players only — the fixture crashed on the eighth player and had quietly deactivated two others
first. The block now reads the whole roster in its own order and **asserts who is inactive both
ways**, so a half-finished run repairs itself. A seeder that applies a delta to whatever it finds
is not a seeder.

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

### Pass 3 build log (2026-08-14) — BUILT on dev

**The arithmetic has one home, and it is pure.** `lib/season-settlement.ts` (sibling of
`dues-payments` / `dues-credits`, integer cents, no database): `deriveSettlement`, the
water-filling `solveEvenLevel`, `expenseTotals`, and the sheet's shapes. `lib/coach-season-
settlement.ts` is the one assembly — it fetches, hands the pure module figures the shared credit
model derived, and is what BOTH the screen and every write path read. A settlement payout's
ceiling and the number the coach read on screen come from the same call, by construction.

**The promise, stated once and pinned by property test:**

```
Σ every row's refund  +  what stays with the team  +  hold-back  =  the cash the team holds
```

**⚠ The design problem the plan did not anticipate, and how it is solved.** Paying one family
takes cash out of the team's hands, so a pot read naively from the balance would shrink every
remaining share the moment the first cheque was written — the numbers would be an opinion that
changed while the coach worked down the list. So the pot is measured as it stood BEFORE
distribution: the SHARE portion of money already handed back (`sharePaid` — the part of a payout
beyond that family's credits) is added back to the pot and subtracted again from that family's own
row. Owed-back payouts need no such treatment; they lower the cash and the debt by the same
dollar. Verified end-to-end against the live fixture: paying a family their whole $213.33 left
every other row at $213.33 and the surplus at $2,560.00, while cash held fell by exactly $213.33
and the rows still re-added to it.

**Migration 235** (dev): `rep_season_surplus.hold_back_amount`, and
`rep_season_refund_adjustments` (`fixed` | `no_share`, UNIQUE per player, RLS-on-no-policies).
`total_surplus` is now **legacy, read by nothing** — a new guard-test rule fails the build if any
file reads it, and that rule was **verified by finding three real offenders** (the route, the
panel and `lib/types.ts`), all removed. Dictionary + `refresh:snapshots` same unit of work.
⚠ `distribution_state` from §5.1 was **deliberately not built** — nothing reads it, and §5.2's own
warning about a live column nothing reads applies to a new one just as much as an old one.

**Delivered, to the binding mockups §7–§8:** the derived pot card showing its work, with the
hold-back as the only control (capped at the surplus and refused against owed-back money, with the
reason); the four-column settlement table (Player · Owed back · Even share · Refund) where a row
**opens** to a line-by-line breakdown that sums to its own number; families grouped so siblings are
one heading and one cheque; **every row payable from there** through the *same* Pay out sheet the
drawer uses (extracted to `components/coaches/DuesPayoutSheet`), plus **Pay all**; the row menu (an
even share / a set amount / no share / forgive the balance owing); the shortfall state (say it,
share nothing, pro-rate nothing) and the cash-timing strip that **names the families the others are
waiting on**. A paid row reads "Paid — Aug 14" and stops asking.

**Two judgement calls, recorded rather than buried:**
1. **The footer's Refund total is the SUM OF THE ROWS**, not the sum of the two columns above it.
   Where a family still owes, those differ — the mockup's second table adds the columns and lands
   $200 high. Rows re-adding to the cash on hand is the promise the sheet rests on, so the rows win.
2. **A season still spending is not a season with a surplus.** The arithmetic is untouched (the
   owner's $1,525 stands), but where planned costs remain unspent a quiet line under the pot says
   so and points at hold-back — otherwise October's sheet invites a coach to share money the season
   still needs.

**Also built, because the sweep would otherwise have proved nothing:** the sheet's open state rides
the URL (`?settlement=open`), exactly as the By-installment lens does — so a coach can send the
settlement sheet rather than the page it is folded into, and `check:layout` can address it open.
A `coach-dues-settlement` screen joined the sweep; its first run found **new tap-floor findings on
every control this pass added**, all fixed to the 44px floor rather than baselined (only the
screen's inherited product-wide nav/toolbar debt was baselined, 38 entries, nothing lost).

**Gates:** typecheck ✓ · **1,800** unit tests ✓ (+27: the owner's five §4.4 scenarios on his own
numbers, debt joining the pot, a departed player, the shortfall, hold-back clamping, hand-set
amounts redistributing, paying-one-moves-nobody, degenerates, and a 500-run randomised property
test of the identity above) · focused lint 0 errors · **rendered** `check:layout` on
dues + dues-settlement × 4 widths, on a restarted server against a fixture with real data, real
exit code 0 ✓ · `check:demos` ✓ · dictionary ✓ · `verify:changed` green except the known
schema-parity failure (prod behind on migs 230–235).

**End-to-end smoke against the live fixture** (written, then undone, leaving it as found): the
hold-back refuses above the cap with its reason and reshapes every row when set; a hand-set amount
redistributes immediately with nothing unallocated; "no share" raises the others rather than
stranding one; a payout beyond a row is refused naming the row's true figure; a real payout settles
its row, moves nobody else, and its removal **voids** the ledger entry (confirmed `status: void`)
and restores the sheet exactly.

**`/simplify` (4 lenses) — and it found a MONEY BUG while the fixes were being re-verified.**
Applied: the settlement `<tfoot>` was missing `.tableFoot`, so the totals row rendered without the
divider every other Money-hub footer has (a half-reused recipe); `expenseTotals` claimed in its own
docstring that the Money hub read it — it did not, so **money-summary and the budget summary were
moved onto it** (the budget copy had no notion of an out-of-pocket cost at all — the copies had
already begun to differ); the payout path collapsed from **four full derivations per click to two**
by giving the module the whole request (who is paid and how much are one question) and returning
the post-write sheet it already computed; the assembly's second wave of queries now runs as one
`Promise.all` instead of three sequential awaits; a bulk settle resolves the team ledger **once**
instead of per cheque; the per-player position and payout total are derived once instead of twice;
the settlement row became its own component (`components/coaches/SettlementRow.tsx`) instead of 170
lines at ten levels of indentation; and the guard's importer list grew to cover both new write
routes.

⚠ **The bug, found by settling a WHOLE team and re-reading** — something no earlier test did.
Paying everyone can take more cash out than the team is holding (a forward-looking split spends
money families still owe — the sheet says so). The shortfall question was asked of the raw bank
balance, so it flipped to "the team is short of what it owes families", collapsed **every** share
to zero under Call 9, and turned all ten families the coach had just paid into families who
suddenly owed the money back. **The pot is measured before distribution, so the shortfall test must
be too.** Fixed and pinned by a new test that settles the whole team and asserts every row lands
square.

Skipped, with reasons: parallelising the payout writes (irreversible cash, and the post-write check
reads the settled state of the whole batch — a little latency is worth the clearer failure story);
the hold-back save's two derivations (inherent — it needs the post-write truth); folding the
Set-refund modal's two state fields into one object (cosmetic); the per-route `resolveCoachContext`
duplication (the established convention in ~52 coach routes).

**`/review` (high-risk, 5 lenses) earned its keep — 1 Critical + 1 High + 5 lesser, all fixed:**

- **Critical — the pot counted club money that belongs to no season.** `rep_team_payment_requests`
  carries a team but **no program year**, so approved club funding and payments to the club were
  summed TEAM-LIFETIME into a single season's pot. The Money hub has always done this and says so
  in a comment — a fair trade for a live-season dashboard. It is not fair here, for two reasons
  this sheet has and the hub does not: the figure sets a **cash payout ceiling** (a team in its
  third season could hand families money an earlier season received), and this sheet is **readable
  in a finished season**, so approving a request next year would silently rewrite last year's
  settled pot. Now **excluded from the pot and stated on the card** when non-zero, rather than
  swallowed. ⚠ **OPEN OWNER QUESTION:** how should club funding be attributed to a season?
  Answering it properly needs a program year on that table — a migration and a backfill, beyond
  this pass.
- **High — the guardian's email address shipped to the browser as the family grouping key.** Money
  access and the guardian-PII grant are independent, so a treasurer with money-but-no-contacts read
  every family's real email in the settlement payload — the gate the rest of the product enforces,
  defeated by a field nobody thought of as PII. The key is now derived from the address, never the
  address: siblings still group, unrelated families still can't collide, and the coach learns
  nothing they could not already see.
- **Medium — the post-write safety check asked the wrong question.** It undid a just-written cheque
  whenever a family's refund went negative — but that also happens when something UNRELATED lands
  in the same window (another coach invoicing that family). A perfectly good payout would be
  reversed, and the coach told they had double-paid when they had not. It now asks the question it
  actually means: **did more money go out to this family than this batch meant to send?**
- **Medium — forgiving a balance had no re-check**, the one money write in this feature built
  without the safety net its siblings carry; two clicks left a duplicate forgiveness in a family's
  permanent record (harmless to the arithmetic — the extra evaporates — but a real audit-trail
  defect). The loser now deletes itself.
- **Also fixed:** a failed *undo* was reported as a generic 500, leaving an uncoverable payout
  standing with nothing saying so — it now has its own error naming the amounts to remove by hand;
  a partial bulk failure left the screen showing pre-click totals, inviting the coach to pay
  already-paid families twice (the sheet now re-reads on failure); "Pay all" and a single row's
  payout sheet could both be in flight at once; `settled` read true on a row that had gone into
  debt after being paid; a de-minimis pot handed its stray cents to whoever sorted last on the
  roster; and this module's `toCents` would have silently zeroed a `numeric` column arriving as a
  string, where its sibling coerces.
- **Refuted (dropped):** a claimed race in which the player drawer's credit-only ceiling undoes a
  legitimate payout — traced through, the settlement payout in that interleaving already contains
  the drawer's amount, so the total genuinely IS an overpay and the self-undo is correct.
- **Verified safe:** org/team scoping on all three routes (a player id from another team cannot
  produce a row); capability gates (no path lets money:read write); active-year-only resolution on
  every write; the forgiven amount is server-derived, never client-supplied; "undo forgiveness"
  cannot touch a family's earned rebate; the new table's RLS posture matches its siblings; the
  migration is idempotent and its constraints match the upserts; `expenseTotals` is
  behaviour-identical for both routes it now serves (including that the budget route always counted
  out-of-pocket costs and still does); and no consumer of the deleted types or the old payload
  shape survives anywhere in the tree.

**The demo obligation, now paid.** The coach sandbox gains the **Bottle Drive** on the 12U:
closed, 50% back, five families, and one rebate that covers a whole $120 instalment so the demo
finally shows a bill reading "covered by fundraising". The nightly re-anchor now shifts fundraiser
dates and credit dates with the bills they lower — without it the demo's credits would stand still
while its schedule walked forward. `check-demo-coach` pins three things: the drive is closed and
behind today, one rebate covers a whole instalment, and **no rebate reaches an overdue family** —
the entry list excludes Dmitri and Imani precisely so a credit cannot clear the "$240 across
exactly two families" story from the side, and the part-paid family is excluded so the "$90 of
$120" showcase survives. The guided tour's money beat gained the sentence; the seven-beat spine is
unchanged (it is owner-approved and pinned by test).

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
