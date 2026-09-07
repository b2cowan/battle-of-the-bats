# What a credit is, and what happens when you hand it back

**Status:** R1–R4 **BUILT + MEASURED** 2026-09-07 (uncommitted) · R5/R6/R7 awaiting the mockup gate
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

**⚠ WHAT IS LEFT:** R5 (a payback selects the debts it settles — needs a migration), R6 (a
contribution becomes a payment), and R7 (a fundraiser credit may not be typed by hand, and `other`
becomes **Adjustment** — a sweep across every surface a customer reads it on, not a one-line change).

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
