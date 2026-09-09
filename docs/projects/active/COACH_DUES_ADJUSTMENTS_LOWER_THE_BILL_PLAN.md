# A bill lowered is not a collection

**Status:** rulings taken 2026-09-09, **not built**. No code written. The UAT fixture it was measured
on **was re-seeded 2026-09-09** (§7) — that part is done and in the database.
**Sequencing:** lands after the money work currently in flight (§8), because it edits the same
surfaces.
**Decision mockup:** https://claude.ai/code/artifact/b529dd67-a2e1-4f00-95ce-b246d6cc086c ·
**PM brief:** `COACH_DUES_ADJUSTMENTS_LOWER_THE_BILL_PM_BRIEF.md`
**Raised:** owner, reading the Player Dues band beside Budget vs. Actual and asking why two reports
describing one season disagreed by $134.00.

---

## 1. The defect, in one sentence

**A credit that lowers a bill with no money behind it was being counted as money.**

`Collected` on the Player Dues band is cash capped at each family's bill — a figure that answers
neither the bank's question nor the bill's, and needs two clauses of small print to survive. Beneath
it, an *adjustment* (the one credit a coach may still type by hand) and a *forgiven* bill reduce what
a family owes without a dollar existing anywhere. The band therefore does not add up, and the
Statement — which correctly refuses to call those credits revenue — reports a different figure for
the same season.

**Measured on the UAT team before any of this:** `11,308.30 − 2,225.00 = 9,083.30`, while Balance
owing read `7,349.32`. Two footnote clauses existed solely to explain the gap.

## 2. The rulings *(owner, 2026-09-09)*

### R1 — a credit with no money behind it lowers the BILL, not Collected

Owner: *"I am 'adjusting' the amount of dues a player needs to pay, not explicitly or even implicitly
collecting anything."*

An **adjustment** and a **forgiven** bill reduce `Dues`, and therefore `Balance owing`, and never
appear in `Collected`. ⚠ **BOTH KINDS, ONE RULE.** They are the same animal — debt relief with no
money — and letting one lower the bill while the other counted as a collection would have been the
next defect on this screen. `forgiven` is minted from the settlement sheet and `other`
(**"Adjustment"**) is typed by hand; different doors, identical meaning here.

### R2 — Collected is money, and uncapped

Everything families put in: **cash they sent and have not had back**, **team bills they paid a vendor
directly**, and **fundraising credited to their dues**. It is not capped at the bill, so its caption
names what went beyond — which is how a coach reaches `Balance owing` from it.

### R3 — the installment ladder does not change

Owner: *"better to see the list of installments and the adjustment/forgiveness next to it to see a
complete picture (they were charged x but we only received y because of their forgiveness amount of
n)."*

Installments keep showing **what the family was charged**. The adjustment sits beside them as its own
line. ⚠ **THIS IS A REFUSAL, NOT AN OMISSION** — do not "tidy" the ladder to match the net figure
later; the whole point is that both numbers are readable at once.

### R4 — the Money Overview's Collections card becomes **Bills settled**

With `Collected` uncapped, the card that reads it as *progress toward the bill* would show 45% while
$7,349.32 was owed, and its bar would pass 100% the first time a team fundraises hard. Renamed and
capped, its segments add to `Balance owing` exactly and it can never exceed 100%. Two questions, two
names: `Collected` answers *what came in*, `Bills settled` answers *how much of the bill is settled*.

### R5 — the figures say when they are net

The `Dues` tile caption names whichever kinds are present — *"after $17.00 of adjustments"*, *"after
$250.00 forgiven"*, *"after $267.00 of adjustments and forgiveness"* — and **is absent when there are
neither**, which is most seasons. The Statement says the same thing about its **plan** side in the
footnote stack, which is the only version that survives the download.

## 3. The arithmetic — state it exactly, or it double-counts

Per family, with `adj` = standing no-money credits (adjustment + forgiven):

```
money    = cappedPaid + (netCredits − adj)      ← Collected
duesNet  = dues − adj                            ← Dues
balance  = dues − netCredits − cappedPaid  ≡  duesNet − money
settled  = min(duesNet, money)                   ← Bills settled
```

⚠⚠ **`balance` IS UNCHANGED BY CONSTRUCTION, AND THAT IS THE WHOLE SAFETY OF THIS CHANGE.** Substitute
and the two expressions are identical. **No family's balance moves, no bill is recalculated, nothing
is owed that was not owed before.** An implementer who "helpfully" also subtracts the adjustment from
the balance has counted it twice — that is the one way to get this wrong, and it is the reason the
identity is written here rather than left to be re-derived.

Season identities, all four asserted per case:

| | |
|---|---|
| `Dues − (Collected − owed back) = Balance owing` | the band closes |
| `Dues − Balance owing = Bills settled` | the Overview card ties to the band |
| `Collected ≡ the Statement's Player dues actual` | **two screens, one number** |
| money handed back is in **none** of them | it stopped being a contribution |

## 4. Two screens, one number — the payoff

Strip no-money credits out of *everything families put in* and what remains is **exactly** Budget vs.
Actual's definition of dues revenue, arrived at from the opposite direction. This is not a
coincidence of one fixture: the report's exclusion is *write-offs + untraced*, and since R7 closed
the hand-typed door there are **no untraced credits on either database** (§7). So the two figures are
one derivation and cannot drift apart again.

⚠ **THE `includes`/`excludes` TRAP DIED WITH THE OLD MODEL, AND THAT IS WORTH KNOWING.** An earlier
draft had `Collected` *including* the adjustment while the report *excluded* it — two true sentences
with opposite verbs about one dollar, which the next reader would have "fixed". R1 removes the
contradiction rather than documenting it.

## 5. What changes, by surface

| Surface | Change |
|---|---|
| **Player Dues band** | `Dues` reads net, with the R5 caption. `Collected` is redefined and drops to a one-clause caption. `Balance owing` and `Past due` are untouched. |
| **Player Dues table + export** | An adjustment moves out of the credits column and into the bill: a row reads charged, adjusted, paid, balance. The foot row follows. |
| **Money Overview** | The Collections card becomes **Bills settled**, capped (R4). |
| **Budget vs. Actual** | The dues **plan** side becomes net of adjustments — today it plans revenue that was written off, so the variance on that row is overstated by exactly the adjustments. The **actual** side does not change; it already excludes them. Footnote per R5. |
| **Help guide** | Two paragraphs defend the current meaning, including *"Collected counts what settled a bill, so it can never run past Dues."* Under R2 it can, and on this fixture it does. |
| **Coach demo** | The sandbox's money narration — stale across three consecutive releases, so it gets re-read rather than patched. |

## 6. Out of scope — and one of these is a refusal

- **Cash on hand and the Ledger do not move.** They are the bank answer, and leaving them alone is
  precisely what lets `Collected` answer a different question honestly.
- **No migration, no data change.** Adjustments stay credits in the records. This changes what the
  figures *read*, never how a bill is settled or how a credit is applied to an installment.
- **The ladder (R3).**
- ⚠ **Do not make `Collected` capped "so it matches Bills settled".** They are two questions. The
  moment they are one figure, one of the two screens is lying.

## 7. The fixture — re-seeded 2026-09-09, done

The UAT team held three records the product can no longer create, which is why the two reports
disagreed by $134.00 rather than by the $17.00 this plan is about.

| Record | Was | Now |
|---|---|---|
| Fundraiser credit $150.00 | typed by hand, traced to nothing | a real **Bottle drive** entry — $750.00 raised at the drive's own 20% rebate |
| Contribution credit $67.00 | typed by hand | a **$67.00 payment** (R6, 2026-09-07: a contribution is money arriving) |
| Adjustment $17.00 | described "test" | kept, renamed — **the demonstration case for this whole plan** |

**Verified after:** untraceable credits on that program year are **zero** (12 of 12 fundraiser
credits and 5 of 5 reimbursements traced). Balance owing `$7,349.32`, past due `$97.09` and money
owed back `$1,182.65` all came through **unchanged** — the check that the re-seed moved
classification, not money.

⚠⚠ **IT DID MOVE MONEY IN ONE PLACE, AND THE FIRST WRITE-UP OF THIS MISSED IT.** Tracing the credit
to a drive means the drive raised something: $750.00 at a 20% rebate leaves the team **$600.00** it
did not have before, and the report counts a drive's revenue as receipts less the rebate. So that
team's **Fundraising actual is $600.00 higher**, and **Player dues actual went $5,007.63 →
$5,124.63**. Total revenue +$717.00. Both are correct consequences — a drive that rebated $150.00
must have raised more than $150.00 — but any figure captured from that team before 2026-09-09 is
stale, and "the re-seed moved classification, not money" was true only of the dues side.

⚠ The seed script now mints that credit through a drive entry, so a fresh database never recreates
the impossible state. The $100.00 payback is sized under it deliberately; the two are a pair.

**The season as it now stands** — every figure recomputed family by family from the records:

| | |
|---|---|
| Dues (gross) | 11,308.30 |
| Adjustments | 17.00 |
| **Dues (net)** | **11,291.30** |
| Cash sent and kept | 2,842.00 |
| Team bills families paid | 1,379.98 |
| Fundraising credited to dues | 902.65 |
| **Collected** | **5,124.63** |
| of which beyond the bills | 1,182.65 *(550.00 over-sent + 632.65 credit overhang)* |
| **Bills settled** | **3,941.98** |
| **Balance owing** | **7,349.32** · past due 97.09 |
| Statement's Player dues actual | **5,124.63** — identical to Collected |

## 8. Sequencing

Four other sessions were editing coach money on 2026-09-09 (the category-is-the-shelf work, the
figure drill-ins, the credits/paybacks set, and money-in row naming). This plan edits the same band,
the same report and the same rollup. **It starts after those land**, against committed code — not
against a working tree three sessions are mid-way through.

## 9. Verification

- **The four identities in §3**, asserted per family and per season on the fixture, plus synthetic
  cases the fixture cannot show: a family forgiven in full; an adjustment larger than the remaining
  bill; an adjustment on a family already in credit (the fixture's own case — it must change
  `Collected` and `Dues` while leaving `Balance owing` alone).
- **`Collected == the Statement's Player dues actual`** on every case. Two derivations, one number —
  the strongest single signal the rulings are right, and the assertion most likely to catch a
  regression later.
- **No balance moves.** Diff every family's balance before and after: twelve unchanged.
- The R5 caption **absent** on a season with neither adjustments nor forgiveness.
- Owner QA walk — a new ledger section, run after the build.
