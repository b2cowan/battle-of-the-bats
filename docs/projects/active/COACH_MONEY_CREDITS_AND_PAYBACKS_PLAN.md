# What a credit is, and what happens when you hand it back

**Status:** R1–R4 and the report side **committed `ce3fb8ab` 2026-09-07**; R5, R6 and R7 **committed
`480a008a` 2026-09-07** with **migration 281 applied to dev**. Owner QA is **§153** — walk written,
run-order step **B12**. One follow-up fix (the legacy-payback ceiling, §6d) is built and gated on dev
and awaits the owner's word to commit.
⚠ Do not re-word this as "uncommitted"/"not on prod" — a perishable negative goes stale the moment
another session ships. Deployment state lives in the release history and the Owner QA Ledger.
**Build mockup:** https://claude.ai/code/artifact/3ac033cd-e589-4220-a7b6-951e947e6dc2 · **PM brief:** `COACH_MONEY_CREDITS_AND_PAYBACKS_PM_BRIEF.md`
**Raised:** fell out of the dues-by-family project's step 2 — see §9 for what it does to that plan.
**Decision mockup (round 2):** https://claude.ai/code/artifact/0f08e331-7dda-456a-9836-c608f8a72eae

---

## 1. The defect, confirmed 2026-09-07

**When a family pays a team bill directly, the report counts the cost and forgets the settlement.**

| | |
|---|---|
| The cost | counted in **Season spending** — the query's own words: *"The report counts a family-paid cost as spending (the season spent it); cash must not."* |
| The dues credit that settled it | counted **nowhere** — dues actual is cash payments only |

**It ties to the cent on the UAT fixture, and the tie is the proof.** Family-paid spending the
Statement counts: **$1,179.98** (four expenses carrying `paid_by_player_id`) + **$200.00** (one
PAYMENT-level flag — the money-centralization P4 case where a parent fronted part of a $600 team
bill and the team paid the other $400) = **$1,379.98**. Reimbursement credits issued: **$1,379.98**.
Every dollar on one side has a match on the other, and the report counts one side.

**And a second, smaller error runs the other way.** The Statement counts all **$3,075.00** of dues
cash — including the **$300.00** returned to Casey, which is their own money and was never dues
revenue. **Revenue is overstated by $300.00.**

⚠ **THIS WAS FIRST WRITTEN AS $600.00 AND THAT WAS WRONG** (corrected 2026-09-07 on measurement).
The other $300.00 of paybacks came out of fundraiser credits, and §4 shows the Statement has
**already** netted those off fundraising — so that money is not counted twice, it is simply not
counted at all, which is R3's problem rather than this one. **The error that money handed back
creates is $300.00, and only on dues.** Two errors pointing opposite ways is why neither was
noticed; do not restate the $600.00.

⚠ **THE CASH READING IS CORRECT AND MUST NOT BE "FIXED".** No team money moved on a family-paid
cost, and the register marks those `movesCash: false`. Money handed back really did leave the
account and belongs in the returned band, where it already is. **This plan touches Season spending
only.** Nothing in it changes Cash, and nothing in it changes any Budget figure.

✅ **CONFIRMED OFF THE RENDERED REPORT, 2026-09-07.** The payload itself lists the five family-paid
costs — umpire fees $180.00, a fronted showcase instalment $200.00, a bat $700.00, socks $59.98,
team photos $240.00 — totalling **$1,379.98**, inside **$4,909.98** of Season spending, with dues
actual at **$3,075.00**, cash only. Not inferred from the records: read off the page.

## 2. The rulings (owner, 2026-09-07)

| # | Ruling |
|---|---|
| **R1** | **The budget does not move.** A family paying a bill directly does not change their dues plan and does not change the item they paid for. |
| **R2** | **A family-paid cost counts on both sides of Season spending** — as an expense on the item, and toward that family's actual dues. Owner: *"it can be viewed the same as a parent paid their dues and the team paid for the item."* |
| **R3** | **A fundraiser rebate moves from Fundraising to dues.** Fundraising actual becomes what the team kept; the rebate counts as the family's dues being paid out of money the team raised. Without this, Kai reads $270.83 short instead of $70.83. |
| **R4** | **Own money handed back comes off dues actual.** Casey sent $1,200.00 against a $900.00 bill and had $300.00 returned, so Casey contributed **$900.00** — *"their net contribution to the team."* |
| **R5** | **A payback selects the debts it settles.** Whole credits only, one or many per payment; no free-typed amount. The sum is calculated. |

**The unifying sentence, and the one to keep:** *a credit counts as revenue only while it is still
standing.* R3 and R4 both fall out of it; only R4 needed saying separately, because a refund of a
family's own money is not a credit reversal at all — it is a payment reversal.

## 3. R5 — the payback change, and why it should go first

Today a payout carries **no link to the credit it refunded** — the schema has no such column — so
which credit a refund consumed is decided by **date order, oldest first, and nothing else**. That is
invisible while credits sit in one column. The moment each kind lands on a different row, an
accident of dates decides which row gets reduced.

**⚠⚠ PRODUCTION HAS ZERO PAYOUTS (checked 2026-09-07).** Not few — none. The only dues credits on
prod are five fundraiser credits, which is the demo sandbox. **There is no history to backfill and
no guessed link to write.** This is the cheapest this change will ever be, and it gets more
expensive every month it waits.

**⚠ ONE CASE CANNOT SELECT A CREDIT, AND THE PRODUCT ALREADY SAYS SO.** From the season-surplus
payout route: *"a settlement cheque covers a family's owed-back money AND their share of the
surplus, **and a share is not a credit**."* Money goes back to families through two doors and only
one of them is reversing something.

- **Scope R5 to the Pay out sheet** (`source = 'recorded'`). Every one of those reverses a credit.
- **Leave settlement its own door** (`source = 'season_settlement'`) — it already has one. Its
  owed-back half is credits and could carry links; its surplus half stands alone, honestly.

**⚠ BUILD THE LINK WITH AN AMOUNT ON IT even though R5 never writes a partial.** Whole-credit-only
is the right call and the owner ruled it: *"they could not partially pay back 1 debt, they can
wholely pay back 1 or more than 1 debt."* But recording *"this payout reverses this credit, for this
much"* makes a future partial a screen change; a bare link makes it a migration. Same work today.

**What R5 also removes:** the clamp that stops a coach handing back more than a family is owed. If
they are picking from what is owed, it cannot happen. That guard becomes unnecessary rather than
gaining a friend.

## 4. RULED 2026-09-07 — every credit traces back to the act that made it

**This corrects R3 as it was first written to the owner, and it was found while writing this plan.**
A coach can type a credit by hand: `MANUAL_CREDIT_TYPES` is `['contribution', 'fundraiser',
'other']`. So a **fundraiser** credit does not necessarily come from a drive.

| Kind | Traceable to money that arrived | Hand-typed |
|---|---|---|
| Fundraiser | **$1,052.65** — 11 credits, each tied to a drive entry | **$150.00** — 1 credit, tied to nothing |
| Reimbursement | **$1,379.98** — 5 credits, each tied to an expense | — (cannot be hand-typed) |
| Contribution | — | **$67.00** |

⚠⚠ **AND THE REPORT ALREADY DOES HALF OF R3 — MEASURED 2026-09-07, AND IT CHANGES WHAT R3 MEANS.**
The Statement's fundraising row **already shows what the team kept**. The Chocolate sale reads
**$916.00** on the Months CASH band and **$778.60** on the Statement, and the difference is
**$137.40** — that drive's player rebate, to the cent. Across the season: gross **$3,917.00** less
rebates **$1,052.65** = **$2,864.35**, which is exactly the Statement's fundraiser-derived revenue
($778.60 Fundraising + $2,085.75 uncategorised sponsor money).

**So R3 is HALF the change it was written as, and the other half is the wrong half to touch:**

- **Fundraising on the Statement needs NO change.** It is already net of rebates and already right.
- **The rebates land NOWHERE.** They are subtracted from fundraising and never added to anything.
  **That** is R3: the $1,052.65 becomes dues actual, because it is families' dues being paid out of
  money the team raised.

⚠ **DO NOT "FIX" FUNDRAISING TO $2,864.35 — IT IS ALREADY $2,864.35.** An earlier draft of this plan
said the Statement showed $3,917.00 and had to be reduced. **$3,917.00 is the MONTHS CASH figure**,
and it is correct there — cash is gross both ways. Applying a Statement rule to a Cash figure is the
same class of error as the three this plan exists to fix, and it was made while writing the plan
that names it.

⚠ **THE STATEMENT AND THE MONTHS BANDS FILE THIS MONEY DIFFERENTLY, AND A BUILDER MUST KNOW IT.** The
Statement groups revenue by budget category — so sponsor money with no category lands in a row
called *No category* ($2,085.75), and a concession record lands under *Tournaments*. The Months bands
group by KIND — Fundraising $916.00, Sponsorships $3,001.00, Other income $400.00, Money back
$125.00. Neither is wrong; they answer different questions. **Read the right one.**

**A hand-typed fundraiser credit is in neither.** Blake's $150.00 was never inside the $3,917.00, so
it is not inside the $2,864.35 either — it reduces a family's bill while sitting in no revenue figure
anywhere. It is the same problem as the contribution, and it needs the same answer.

### R6 — a contribution is a PAYMENT, not a credit *(owner, 2026-09-07)*

Someone handing the coach money toward a family's dues is **cash arriving against that family's
schedule**. Recorded as a payment it is traceable, it counts as dues actual, the family's balance is
right, and it appears in Cash where it belongs. As a credit it is an assertion the records cannot
check.

### R7 — a fundraiser credit may not be typed by hand *(owner, 2026-09-07)*

Owner: *"should we even allow the hand typed fundraising credit? seems like that should always come
from fundraisers."*

**The product already argues for this in its own words** — from the manual-credit list: *"NEITHER
EXCLUDED KIND IS A MANUAL CREDIT, and that is the product rule rather than a limitation: forgiveness
is granted from the settlement sheet, and a reimbursement is minted by an out-of-pocket expense.
**One door each, so a credit's story always traces back to the act that made it.**"* `forgiven` and
`reimbursement` have always worked this way and `overpayment` joined them on 2026-09-07.
**`fundraiser` is the last outlier**, and R7 brings it in line rather than inventing a new rule.

**⚠⚠ AND IT STRANDS NOTHING — MEASURED 2026-09-07, BOTH DATABASES.**

| | Fundraiser credits | Linked to a drive entry | Hand-typed |
|---|---|---|---|
| **Production** | 5 | **5** | **0** |
| **Dev, every team** | 33 | 32 | **1** |

The single hand-typed row anywhere is Blake's **$150.00** on the UAT fixture. **Re-seed it as a real
drive entry** — the fixture becomes more realistic, and no legacy case exists on either database.

**What is left on the manual list: `other` alone.** With `contribution` gone to payments and
`fundraiser` gone to drives, a hand-typed credit is one thing — an adjustment — so **the kind picker
comes off the form entirely.** That is a simplification, not a new control.

### ⚠ THE CONSEQUENCE R7 FORCES, AND IT NEEDS CONFIRMING

Once every credit either traces to money or is an adjustment, the report can finally tell them
apart — and it must:

| | Backed by money that arrived | Counts as dues actual |
|---|---|---|
| Fundraiser / sponsorship (from a drive or arrival) | yes | **yes** |
| Reimbursement (from an out-of-pocket expense) | yes | **yes** |
| Contribution (now a payment) | yes | **yes**, as cash |
| **Forgiven** (settlement sheet) | **no** | **no** |
| **Other** (an adjustment) | **no** | **no** |

**A write-off is not revenue.** A coach who forgives $150.00 of a family's dues planned $970.83 and
will collect $820.83, and the report should say so — that forgiveness cost the season money is
exactly what a treasurer needs to see. Dev already carries a **$600.00** `forgiven` credit on another
team, so this case is real and already seeded.

⚠ **THIS QUALIFIES THE TWELVE-OF-TWELVE GATE IN §5, AND THE QUALIFICATION MUST BE ASSERTED RATHER
THAN TOLERATED.** A family's variance equals their Player Dues balance **where every credit they hold
is money-backed**. Where a write-off exists the two differ by **exactly the write-off** — a number
the test can compute and assert, never an unexplained gap. Two screens answering two different
questions (*what did we collect* vs *what does this family still owe*) is correct; two screens
disagreeing by an amount nobody can name is the defect this whole plan exists to remove.

## 5. What the numbers do

**Measured off the live report, 2026-09-07.** Season spending only.

| Statement, actual column | Today | Why it moves |
|---|---|---|
| Dues | **$3,075.00** | cash only |
| Fundraising + sponsor money | **$2,864.35** | already net of rebates — **does not move** |
| Season spending (expenses) | **$4,909.98** | includes $1,379.98 families paid — **does not move** |
| Budget, every line | — | **does not move** (R1) |
| Cash, every figure | — | **does not move** |

**Only ONE figure changes: dues actual.** It gains what already happened and was never counted:

| | |
|---|---|
| + Costs families paid (R2) | **$1,379.98** |
| + Drive rebates, still standing (R3) | from **$1,052.65** issued, less any handed back |
| − Own money handed back (R4) | **$300.00** — Casey |
| + Contributions, once they are payments (§4) | **$67.00** on this fixture |

**MEASURED 2026-09-07, running the built module over the real twelve families:** dues actual becomes **$5,007.63** against $3,075.00 today. Every family balance it derives matched the Player Dues screen live — **12 of 12** — compared against the ladder the coach actually reads, not against a field hoped to mean the same thing. ⚠ The figure excludes **$117.00** still held back on Blake (a hand-typed fundraiser credit part-refunded, plus the contribution) — that is R6/R7 territory and it moves once those doors close.
| ⚠ Hand-typed fundraiser credit | **$150.00** — counted nowhere until §4 is applied to it too |

⚠ **QUOTE NO SINGLE SEASON-NET FIGURE UNTIL §4 IS BUILT.** $217.00 of this fixture's credits reduce
a family's bill with no money behind them. The arithmetic is not in doubt; what those two rows
**are** is, and the answer changes the total.

**⚠⚠ THE GATE THAT MATTERS: every family's variance equals their Balance on the Player Dues screen,
to the cent — TWELVE of twelve.** Kai reads $70.83. Casey reads $37.50 in credit. Two screens, two
independent derivations, the same numbers. The dues-by-family plan hoped for eleven of twelve and
treated the twelfth as an explainable exception; under these rulings there is no exception, and that
is the strongest evidence the rulings are right.

⚠ The fixture's own figures drifted while this was being written — the sentence under the table now
reads *plan needs $11,671.00 − dues billed $11,308.30 = $362.70*, not the $11,650.00/$341.70 quoted
in the dues-by-family plan and the decision mockup. **Re-measure before quoting; do not copy a
figure forward.**

## 6. Build order

1. ✅ **DONE 2026-09-07 — read off the rendered report.** $1,379.98 across five costs, inside
   $4,909.98 of Season spending, against $3,075.00 of dues actual.
2. ✅ **RULED 2026-09-07 — a contribution is a PAYMENT.** ⚠ Still open by extension: a hand-typed
   FUNDRAISER credit has the same problem and the same answer (it should be a drive entry). Confirm
   before building, because it decides whether `MANUAL_CREDIT_TYPES` keeps anything but `other`.
3. **R5 — the payback selects its debts.** Independent of the reporting change, and the reason to do
   it first is that prod has nothing to backfill *yet*.
4. ✅ **DONE — R1–R4 on Season spending.** The Statement's dues actual is now what families
   CONTRIBUTED, not the cash strip's arrivals: **$3,075.00 → $5,007.63**, Total revenue
   $6,339.35 → $8,271.98. **Cash, budget and Season spending are byte-for-byte unchanged** — the
   money-report guard proves all four of its cash identities still hold.
   ⚠ THE ARITHMETIC IS A PURE MODULE (`lib/coach-dues-actual.ts`) WITH THE ALLOCATION NAMED AND
   REPLACEABLE — `allocatePayoutsOldestFirst` is an assumption wearing a function's name, and R5
   deletes it rather than editing it.
   **Gates:** typecheck · 3,150 unit tests (15 new) · `verify:changed` · `check:money-report` ·
   lint. **Measured twice:** the module run over the twelve real families reproduced **12/12**
   balances against the live Player Dues ladder, and the rendered report was re-read afterwards.
   ⚠ THE FIRST RUN OF THAT GATE REPORTED 12/12 WHILE COMPARING NOTHING — the balance field was read
   from the wrong key and every live value came back null, so the check passed vacuously. The
   rehearsal now refuses to run on zero rows. **A gate that cannot fail is not a gate**, and this
   one looked green for a whole run.
5. Exports and the PDF follow the screen. The by-activity export has diverged once before and is the
   standing lesson.
6. ✅ **DONE — the two-truths note.** It named the expense gap only; after R2–R4 a coach can see a
   dues gap it never mentioned. Rewritten to carry both, split "on **expenses** … on **player
   dues** …". ⚠ This note broke exactly this way on 2026-09-02 — a cause named that no longer
   existed — so growing it WITH the change was not optional.
7. Help + demo. The demo's money narration has gone stale across three consecutive releases and this
   changes what two revenue rows mean.

## 6a. ✅ BUILT 2026-09-07 — the explanation, and the revenue doors

**The dues figure explains itself.** A caption under the row name (it quotes no figure, so it cannot
go stale against one) and the figure OPENS into three lines that add up to it: cash families sent and
kept **$2,775.00**, team bills families paid **$1,379.98**, fundraising credited to dues
**$852.65**. Money handed back is in NONE of them — it is not a fourth line to subtract, it is simply
absent, which is what lets three lines reach the total instead of four lines nearly reaching it.

⚠⚠ **THE CAPTION PARTLY REVERSES THE §146 RULING THAT THE SET ROW SAYS NOTHING, AND THE OWNER WAS
TOLD.** That ruling killed a caption reading *"N families · set on Player Dues"* — a family count is
not a money fact, and naming the screen told a coach what they had just done. Both true of THAT
sentence. What is said now is a money fact about a figure that has stopped meaning what a coach
expects. It is still a caption on the row he cleared, and two lines rather than one.

⚠⚠ **A REAL DEFECT WAS CAUGHT BY THE LIVE FIXTURE, NOT BY THE TESTS.** The first cut allocated a
payback OLDEST-FIRST; the shipped dues screen assumes the family's OWN MONEY first and says so at the
line. Casey's rebate is dated 2026-08-20 and their overpayment 2026-09-01, so oldest-first ate the
rebate. **The total was identical either way and the panel still added up** — but the door would have
told a coach $37.50 of their cash was fundraising while the dues screen told them the reverse. The
unit tests could not see it: they hand-built the allocation. Three tests now name Casey.

**The revenue doors open into real records.** The derived pools pushed ONE row each, described *"From
your sponsors"* — the code's own words: *"a derived pool is a name with no record behind it at all."*
True of the pool, never of the money. Now one row per drive and sponsor, each carrying what it kept
of what it took: *ZZ QA Hilltop — $800 of $1,000, $200 to families*. **Placement and totals are
untouched**; only what a coach finds behind the figure changes.

**And the row takes the name its door already knew.** *"No category → Not itemized"* is right for a
COST with no item — it still opens into records, and the blank name is a prompt to go and plan one.
Applied to the derived pool it said nothing twice, on the season's second-largest revenue line. Now
**"Not in the plan → Sponsor money"**. ⚠ The rollup's item bucket forced `Not itemized` whenever
there was no item id; a supplied name now wins and `null` still falls back, so every cost behaves
exactly as before.

**Gates:** typecheck · **3,172 unit tests** · `verify:changed` · `check:money-report` (all four cash
identities still hold) · `check:layout --changed` · lint. Cash, budget and Season spending
byte-for-byte unchanged, re-read off the rendered report after every step.

## 6b. ⚠ STILL OPEN ON THE BUILT HALF

~~The dues actual figure has no explanation beside it.~~ **CLOSED — built, see §6a.** The caption
and the door were approved on the build mockup and shipped together.

~~**⚠ WHAT IS LEFT:** R5, R6, R7.~~ **CLOSED — committed `480a008a` 2026-09-07, see §6c.**

## 6c. ✅ BUILT 2026-09-07 — R5, R6 and R7 (committed `480a008a`, migration 281 on dev)

**R5 — a payback SELECTS the debts it settles.** The amount box on the Pay-out sheet is gone. A coach
ticks whole debts and **the server sums them**; a claimed amount that disagrees with the ticked set is
**REFUSED, never reconciled** (`PAYBACK_AMOUNT_DISAGREES`, alongside `PAYBACK_NO_SELECTION`,
`PAYBACK_UNKNOWN_CREDIT`, `PAYBACK_CREDIT_NOT_PAYABLE`, `PAYBACK_ALREADY_SETTLED`). Migration **281**
adds the link table so a payback records *which* debts it settled — the link is a stored fact instead
of an allocation guess.

⚠⚠ **281 REVERSES A DOCUMENTED "THERE MUST NEVER BE ONE" NOTE on `rep_dues_payouts`, and the owner
was told before it was written.** The old sentence is preserved **verbatim** in `DATA_DICTIONARY.md`
next to why it changed — a reversed rule that quietly disappears is how the next session re-derives
the wrong conclusion. **Production has ZERO payouts**, which is why this was the moment: there is no
backfill to get wrong, in either direction.

**R6 — a contribution is a PAYMENT.** `MANUAL_CREDIT_TYPES` narrowed to `other` alone. **R7 — a
fundraiser credit may not be typed by hand**; it arrives from the drive. `other` reads **Adjustment**
everywhere a customer meets it, and the labels moved out of the dues panel so one map serves every
surface (a guard test holds the two maps equal — it caught an invented `sponsorship` kind on the way
through; sponsor credits are stored as `fundraiser`).

**`/review` ran high-risk over `ce3fb8ab` AND the working tree**, because reviewing only `git diff`
would have skipped the committed half and reported a clean pass over a deliberately narrower surface.
**Four findings, all fixed:** a payback already recorded could be counted past the credit it settled
(now clamped); the Pay-out sheet's ceiling check and its consequence sentence still read the retired
amount box rather than the ticked total; two unplanned derived pools from different sources merged
into one report row; and 281's uniqueness was `(payout_id, credit_id)` when the rule is **one payback
per debt**, so it is `unique (credit_id)`.

## 6d. ⚠ ONE FIX BUILT AFTER THE COMMIT — awaiting the owner's word

**A payback recorded BEFORE 281 says nothing about what it settled**, so the new tick-list read those
credits as fully standing: Logan was offered a **$300.00** debt when **$100.00** was owed, and the
server's ceiling would have refused the coach after they ticked it. Fixed by spreading legacy payouts
across a family's credits the **same own-money-first way the report does** — the rule and the reason
live in `settledPerCredit` in `lib/coach-dues-actual.ts`, which is now a `DEFINITION_HOMES` entry so
the dues route cannot hand-roll the sum again.

**Verified against live data:** all ten families in credit reconcile exactly; families whose tick-list
can overshoot the ceiling: **0**. Three files, gated, uncommitted pending the owner's go.

## 6e. ✅ BUILT 2026-09-08 — the two modals' shape (design review; owner: "i agree with your mockups, go ahead and build")

Mockup `COACH_MONEY_MODAL_STATED_KIND_MOCKUP.html` (artifact
https://claude.ai/code/artifact/4fe1a703-5661-4cc8-9111-5b847367bf44). **Add a credit:** the kind is
the stated band Record money wears under a locked door, at the top of the form with no label; its
second line is the kind's sentence; the hint that points at the three other doors is one quiet line
beneath; Notes takes the whole row. **We paid a family back:** the tick-list takes the full row (it
had 229px of 472px, Date paid alone opposite), titles and amounts sit on the ladder at `--type-body`,
and "Paying back" is the list's own footer row; Date paid and How pair on one row. Both defects had
one cause — text placed in a modal with no type token inherited the browser's 16px. Logged in
`memory/design_decisions.md` 2026-09-08. Uses the shared band classes; `.readonlyValue` is retired.

## 6f. ✅ BUILT 2026-09-09 — the OTHER door never got 6d's fix

**6d fixed the list and not the save, and §6d's own verification line is how it hid.** "Families whose
tick-list can overshoot the ceiling: 0" was measured against `settledPerCredit` — the rule the SHEET
is built from. The write door never called it: `dues-payouts/route.ts` fed `selectPayback` the mig-281
LINKS alone, so it valued a legacy-touched credit at its full issued amount, summed a payback the
family is not owed, and its own ceiling refused it. Every one of the six dev families that has ever
been paid back was dead-ended — measured before and after:

| Family | Team holds | Old save asked | Now asks |
|---|---|---|---|
| Blake Test | $176.98 | $276.98 ✗ | $176.98 ✓ |
| Gus Ledger | $0.00 | $20.00 ✗ | — ✓ |
| Ash Ledger | $75.00 | $150.00 ✗ | $75.00 ✓ |
| Casey Test | $37.50 | $337.50 ✗ | $37.50 ✓ |
| Logan Test | $100.00 | $300.00 ✗ | $100.00 ✓ |
| Gio Ledger | $0.00 | $120.00 ✗ | — ✓ |

**⚠⚠ IT IS REACHABLE ON PROD, and "production has zero payouts" is not the shield it reads as.** The
season settlement writes paybacks with no links **by design** (a settlement cheque covers a family's
share of the surplus, and a share is not a credit) — so *settle the season, then pay a family back*
walks straight into it, and that sequence sits inside the standing ruling that a season stays live
after the last game precisely so money can be settled afterwards.

**Two more breaks of the same invariant, found while confirming the first.** The invariant is now
written on `settledPerCredit` and asserted per case in the tests: **what the tick-list offers may
never exceed what the ceiling allows.**

1. **The order was the caller's and the caller had it backwards.** "Oldest first" was a contract
   stated in a comment; the dues route holds its credits **newest-first** (`credit_date` descending),
   so the spread ate the wrong end and this sheet named a different credit from the one the Statement
   named — R5's own defect class, rebuilt one level down. The dates are inputs now and the rule sorts
   them itself, so no caller can get it wrong again.
2. **A written-off balance could absorb a legacy payback.** `payoutCeiling` excludes `forgiven` — debt
   relief is never the family's money — but the spread did not, so a write-off soaked up money that
   should have come off a payable credit and the credit beside it read fuller than the save allows.
   Forgiven credits absorb nothing now. Fixed with it: a credit its own links had already settled
   could swallow the remainder and then have it clamped away, leaving the NEXT credit reading fully
   standing. **Capacity is what is still STANDING**, not what was issued.

**⚠ AND THE REPORT'S SPREAD DELIBERATELY DID *NOT* NARROW WITH IT.** `allocatePayouts` still gives
every credit — forgiven included — its full issued amount as capacity, and the reason is written on
it: the identity `actual = dues − balance − excluded` holds only while every paid-out dollar lands on
some credit, because the shipped balance subtracts the payout total from ALL credits at the family
level. Narrowing it there would have made a family's Statement balance disagree with their dues-screen
balance — the §148 defect shape, arriving disguised as a consistency fix. The two functions now share
their ORDER (`spreadOwnMoneyFirst`, one home) and differ only on capacity, with the divergence
documented at both ends.

**Gated:** `settledPerCredit` gains nine cases, each asserting the invariant as well as its figure,
and the three modules the save runs through are composed in `dues-payback-selection.test.ts` — the
shape a per-module test cannot see, and the shape that let this through.

⚠ **A CLAIM THIS SECTION MADE AND HAD TO WITHDRAW: "every new case fails against the pre-fix rule".**
It does not, and the correction is the interesting part. **All three COMPOSITION cases fail** on the
pre-fix wiring — that is the defect. But four of the rule-level cases pass on the OLD rule too,
**including the one named "Logan"** — because at that layer the old rule was already right: the
sheet showed 00.00 correctly, and only the save disagreed. A test named after the defect, sitting
at the layer the defect was not in, is exactly the reassurance that let this ship. The claim was
generalised from the four cases actually re-run. Load-bearing on the old rule: the ordering case,
the forgiven case, both capacity cases, the same-day tiebreak, and all three compositions.

## 6g. ⚠ FOUND BY THE §6f REVIEW, NOT FIXED — two report defects the fix made visible

Both live in `buildFamilyDuesInputs` / `allocatePayouts` — the **report** side, which §6f deliberately
did not touch. Both are **pre-existing**: they were there before §6f and are unchanged by it. What
§6f did was produce the correct answer next to them, which is why they are now legible at all. Both
move figures a coach reads, so both want an owner's word before anyone touches them.

**1. A write-off can absorb a payback, and it changes the season's dues actual.** A payout allocated
onto a `forgiven` credit erases a write-off instead of reducing a real credit — and because
forgiveness flows through the CLAMPED `excluded` term rather than a symmetric pot, `actual` moves
with it. Measured on one family, billed $1,000.00, holding a $100.00 write-off and a $200.00 rebate,
handed back $100.00:

| Write-off dated… | Statement's dues actual | Fundraising credited | Write-offs |
|---|---|---|---|
| **older** than the rebate | **$200.00** | $200.00 | $0.00 |
| **newer** than the rebate | **$100.00** | $100.00 | $100.00 |

Same money, same family, two different report figures decided by nothing but the DATE ORDER of a
write-off. The module header's claim that the allocation *"only moves money between kinds, never the
total"* is false wherever a forgiven credit is in play. **$100.00 is the right answer** — the team
handed back cash, and cash can only come out of money the family was owed, never out of forgiveness.
The balance identity holds in both rows, which is why nothing caught it.

**2. A partially-linked credit drops payback money on the floor, and the two balances part.**
`buildFamilyDuesInputs` offers the assumption only credits with NO link at all, so when the unnamed
remainder exceeds what those credits can hold, the leftover is simply lost. Measured: a $300.00
credit carrying a $250.00 link, beside a $100.00 unlinked credit, with $400.00 of payouts — the
report accounts for $350.00 of it and the Statement's balance reads **$950.00 while the dues screen
renders $1,000.00.** That is the §148 shape — a balance a coach chases families on, disagreeing with
itself across two screens — and it is live today.

**⚠ THE FIX FOR BOTH IS ONE CHANGE, AND IT IS NOT THE OBVIOUS ONE.** Do not simply exclude forgiven
credits from `allocatePayouts`: in the tail where payouts exceed the payable credits, the leftover
must still land somewhere or `netCredits` stops matching the shipped family-level balance and the
Statement desyncs — which is defect 2 arriving from the other direction. The shape that satisfies
both: **spread over payable credits' STANDING capacity first, then let anything still unplaced fall
to the write-offs** — truthful wherever it can be, arithmetically closed always. That is also what
would bring the report into line with `settledPerCredit`, collapsing seam 1 to nothing.

**Blast radius before anyone builds it:** it moves the Statement's Player-dues actual and its
three-part split for any family holding a write-off or a part-linked credit alongside a payback.
On the UAT fixture today: **no family holds both**, so the headline $5,007.63 does not move — but
that is a fact about the fixture, not a property of the fix, and it must be re-measured against the
data of the day.

## 7. Gates

- **Twelve of twelve** — each family's variance equals their dues Balance, asserted in a unit test
  on the pure derivation, not by eye. This is the gate that matters.
- Cash figures **identical** before and after — the change must not reach that reading.
- Every Budget figure unchanged (R1), asserted the same way.
- Fundraising actual equals the Fundraising tab's own **Team keeps**, so two screens cannot part.
- `check:money-report` gains a claim for the new revenue identity.
- A payout that cannot find its credit fails loudly rather than falling back on date order.

## 8. What this is not

It is not a change to Cash, to any Budget figure, or to what a coach does day to day beyond R5's one
extra step when handing money back. **No dues are recalculated and no balance moves** — every
family's balance is already correct today, which is precisely why the report disagreeing with it is
a report defect rather than a money defect.

## 9. What this does to the dues-by-family project

**It removes step 2.** That step exists to net outside credits off the *planned* dues figure so each
family's row reads honestly. Under R1–R4 the rows read honestly from the **actual** side with the
budget untouched — so there is nothing to net, no reconciling line, no Season-net movement, and none
of the arbitrary payout allocation the netting would have inherited.

`COACH_DUES_BY_PLAYER_PLAN.md` §7.2 is superseded; its D8, D9 and D10 point here. The fold itself
(steps 3–6 of that plan) is unaffected and still wanted — it just opens onto figures that are
already right.
