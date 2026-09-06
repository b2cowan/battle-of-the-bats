# Player dues opens into the players — Budget vs. Actual, per family

**Status:** planned, not built. Raised by the owner mid-walk during QA §146 (2026-09-06).
**PM brief:** `COACH_DUES_BY_PLAYER_PLAN_PM_BRIEF.md`
**Mockup (owner gate — approve this before any build):** https://claude.ai/code/artifact/73f68f92-603f-47eb-8c1d-d12dc5bd1496

---

## 1. The ask, in the owner's words

> *"Can I not open up the player dues into the players so I can see the budget vs actual for each
> player, since the budget amounts and actual amounts are all derived from the player dues page?
> (This goes with the budget section as well as monthly/statement views in budget vs actual.) For
> some reason only actual breaks down by player."*

He is right about the asymmetry, and it is not a small one. On the **Months** view, opening the dues
group's actual lists **every family's payment by name**. The plan side deliberately opens nothing.
So the one report whose entire job is comparing two columns lets a coach drill into one of them.

## 2. ⚠ THIS REVERSES A RULING THAT IS TWO DAYS OLD, AND THE REVERSAL IS DELIBERATE

`DuesRow` in the Budget vs. Actual panel carries this note, written 2026-09-04:

> *"It is not a `CategoryGroup`, and that is deliberate. Every other row on this report opens what is
> behind it — the budget figure opens the plan lines, the actual opens the payments. This row has
> neither: dues are a SCHEDULE, not budget lines, and the payments are another screen's book.
> Rendered through the ordinary group it would offer a chevron and two figure-buttons that all open
> nothing."*

**The reasoning was sound and the conclusion was wrong, for a reason that only shows up on the built
screen.** "The payments are another screen's book" is true of *where the records live*; it is not
true of *what the coach is asking*. A coach reading `Player dues · $11,308.30 · $3,075.00` is looking
at the largest single figure on the revenue side of their season and being told, uniquely on this
report, that they may not ask what it is made of.

The old note's own premise also no longer holds: it says the chevron and the figure buttons "all open
nothing". They would now open something real — see §3.

**Do not restore the old behaviour on the strength of that comment.** It is superseded here. When
this ships, that comment must be replaced rather than left standing beside contradicting code.

## 3. What already exists (measured on the UAT fixture, 2026-09-06)

Nothing here needs to be invented. The per-player comparison **already exists on the Dues tab**, in a
Season-totals table with exactly these columns:

| Player | Total Dues | Credits | Paid | Balance | Status |
|---|---|---|---|---|---|
| Avery Test | $700.00 | ($1,128.15) | $700.00 | ($1,128.15) | In credit |
| Blake Test | $970.83 | ($176.98) | $625.00 | $168.85 | Up to date |
| Casey Test | $900.00 | ($37.50) | $900.00 | ($37.50) | In credit |
| Devon Test | $970.83 | ($27.00) | $0.00 | $943.83 | Up to date |
| … nine more, all $970.83 | | | | | |

`Total Dues` is the report's **Budgeted**; `Paid` is its **Actual**. The data exists, per player,
already grouped, already permission-scoped. This project is a **reporting** change, not a data one.

## 4. ⚠⚠ THE "UNATTACHED $850" DOES NOT EXIST — round 1 of this plan was wrong

**Round 1 asserted a reconciliation gap and proposed a `Not matched to a player` row to absorb it.
The owner refused it and asked for a circumstance that would justify a dues payment belonging to no
player. There isn't one, and the assertion was never checked against the records.** It was inferred
from two totals disagreeing. Read directly, every dues payment on the fixture carries a player on
this team in this season:

```
Avery   two payments, 2026-08-13 ............ $1,250.00
Blake   one payment,  2026-08-13 ..............  $625.00
Casey   one payment,  2026-09-01 ............ $1,200.00
                                              ─────────
report's dues Actual ....................... $3,075.00   ✓ exact
```

**What the $850 actually was: OVERPAYMENT, hidden by a cap.** Avery was billed $700 and sent $1,250;
Casey was billed $900 and sent $1,200. The Dues tab's `Paid` column stops at what each family was
billed — showing $700 and $900 — while the report counts what arrived. $550 + $300 = $850.

⚠ **The lesson is bigger than the row.** Two totals disagreeing is a QUESTION, not a finding. This
plan turned it into a design element, and a mockup went to the owner asking him to accept a concept
the product does not have. Read the records before writing the row.

⚠ **The design gets simpler, not more complicated.** No absorbing row, no new concept: every dollar
of dues belongs to a family, and the fold shows the families. It sums to its header with nothing
invented — see §5.3.

⚠ **It does leave a real question, D6:** the report counts what arrived, the Dues tab caps at what
was billed, and the fold puts the two one click apart.

## 5. The design

### 5.1 Rows, not a panel

The dues row **expands in place** into one row per family, exactly as every other category on this
report expands into its lines. It gets the same chevron, the same whole-row tap, the same indent
step, and the same four columns.

The alternative — a drill-in panel behind the figures, matching the "plan figure opens its budget
lines / actual opens the payments" pattern — is **rejected**, and the owner's own words are the
reason: he asked to *"see the budget vs actual for each player"*. Two panels, each showing one
column, is the thing he is already complaining about. Rows put both columns side by side for free,
because that is what a table row is.

**Cost, stated plainly:** a 12-family team adds 12 rows to the revenue band when opened; a 20-player
team adds 20. Mitigated by shipping it **collapsed by default** — but see D3.

### 5.2 Where it appears

| Surface | Behaviour |
|---|---|
| **Statement** | The `Player dues` row gains a chevron and folds open into family rows. |
| **By activity** | Same row, same fold — it is the same component. |
| **Months** | The dues group folds into family rows across the month columns, matching how every other revenue group already behaves there. |
| **Budget tab → List** | `Player installments` gains the same fold, showing each family's scheduled total. Plan only — the Budget tab has no actual column. |

### 5.3 The columns inside the fold, and the credit rule

Same four columns as the row above, and **the planned figure is net of credits from anyone other
than the family, less anything already handed back** (owner ruling 2026-09-06, D4 + D7):

    Player dues                     $8,958.67    $3,075.00    -$5,883.67
      Avery      $578.15 covered by others - sent $550.00 more than billed
                                      $121.85    $1,250.00    +$1,128.15
      Blake      $176.98 covered, after $100.00 was handed back
                                      $793.85      $625.00      -$168.85
      Kai        $900.00 covered by credits
                                       $70.83        $0.00       -$70.83

**Why netting, in the owner's words:** *"if you show the original amount in budget and the actual
amount not including fundraising credits in actual it reads as underpaid — once the user pays 70 it
looks like they are 900 short."* Kai is billed $970.83 with $900 covered, so Kai owes **$70.83**;
the report reads that group as $970.83 planned against $0.00 in.

⚠⚠ **THE RULE IS NARROWER THAN "NET THE CREDITS", AND BOTH NARROWINGS WERE FOUND THE HARD WAY:**

1. **Not the family's own overpayment.** When a family sends more than their bill the excess is
   auto-converted to a credit (owner ruling 2026-08-13). Netting that off the plan would reduce it
   by money already sitting in the Actual column — the same dollar twice. **Only EXTERNAL credits
   come off**: fundraiser, sponsorship, reimbursement, contribution.
2. **Net of anything handed back.** A credit refunded in cash stops reducing what a family owes —
   the Dues tab already does this (a /review finding, 2026-08-14) and the fold must match, or a
   family is credited for money they have been given. On the fixture this is Blake $100, Casey $300,
   Logan $200. **Missing it made two of the mockup's figures wrong** and would have chased two
   families for money they do not owe.

⚠ **THE CROSS-CHECK THAT PROVES IT, and it must be a test.** With the rule right, **eleven of twelve
families' variance equals their Balance on the Dues tab to the cent** — two screens, independent
derivations, same numbers. The twelfth is Casey, and the difference is exactly the $300 handed back
to them, because this report shows money returned in its own place rather than subtracting it from
dues. **That is stated on the row, never adjusted away.** Getting eleven of twelve is what told us
the rule was right; getting nine of twelve is what told us it was wrong.

⚠⚠ **THIS CHANGES THE FACE OF THE REPORT, AND THE OWNER APPROVED IT KNOWING SO.** Dues planned goes
from **$11,308.30 to $8,958.67**; **Total revenue and Season net both move by $2,349.63**; the dues
shortfall goes from -$8,233.30 to **-$5,883.67**. The new figure is the true one — a coach cannot
chase a credit, and the fundraising that produced it is already counted in its own row — but it
**reverses "budgeted dues = the instalments"** from 2026-09-04, and that note must be replaced.

⚠ **THE CREDIT NEVER BECOMES "ACTUAL".** Netting is on the PLAN side only. Adding credits to the
actual column reaches the same variance and breaks the register's identity — *gross fundraising +
actual dues receipts* — by counting cash that never arrived.

⚠ **NO FLOOR IS NEEDED.** An earlier round floored Avery at zero with $428.15 of unusable credit.
With overpayment excluded, Avery's plan is a real $121.85. If a floor ever does bite, the residue is
said in the note, never shown as a negative plan.

## 6. Decisions — settled 2026-09-06, one open

| # | Question | Answer |
|---|---|---|
| **D1** | Family or player? | **Family**, siblings named together. |
| **D2** | Honour "To date"? | **Yes** — instalments due so far, net of external credits. |
| **D3** | Does "Expand all" open it? | **YES — owner overruled the recommendation.** *"Clicking expand all and keeping anything closed deviates from what that button means."* Still collapsed by default. |
| **D4** | Credits: note, or netted? | **Netted into the planned figure, AND a note** — external credits only, net of payouts (§5.3). |
| **D5** | Who may open it? | **Anyone with money access.** Owner: *"anyone with money access can see every money screen."* No new permission concept; the fold inherits money access like every other money surface. |
| **D6** | Two screens, one family, two numbers | **BUILT on dev 2026-09-06.** See below. |
| **D7** | The Credits column vs the records | **CLOSED — not a bug.** See below. |

### D6 — split the family's own money out of "Credits" *(BUILT on dev 2026-09-06, uncommitted)*

The round-2 recommendation ("the Dues tab should stop capping") is **withdrawn**. The cap is
deliberate: an overpayment is auto-converted to a credit, and the cap stops it being counted as both
paid and credited. Nothing is hidden.

**What is actually wrong is the word.** Avery's $1,128.15 of "credits" is three unrelated things:
$550.00 their own overpayment, $380.00 the club owes them for costs they paid, $198.15 they raised.
Those need three different actions, and the row also says Avery paid $700 when they sent $1,250.

**Proposal:** "Credits" comes to mean *money from someone other than this family*, so the overpayment
leaves it; "Paid" then shows what the family actually sent. **The Balance is unchanged** —
$700.00 − $578.15 − $1,250.00 = ($1,128.15), what the row says today. ⚠ **The two changes only work
as a pair**: uncapping Paid while the overpayment is still a credit counts it twice.

**Built.** One shared helper does the re-split for both producers of these figures — the dues route
and the roster player's own money panel — so the two screens cannot drift. Avery now reads
`$700.00 · ($578.15) · $1,250.00 · ($1,128.15) · Overpaid` on both, with *"sent $550.00 more than
billed"* under the name. **"Overpaid" is a new status distinct from "In credit"**: a family whose
sponsor covered their dues is in credit without having overpaid a cent, and a coach can hand the
first one their money back but can do nothing for the second.

⚠⚠ **THE BUILD SHIPPED A REAL DEFECT FOR ONE ROUND AND ONLY THE RENDERED SCREEN CAUGHT IT.** The
balance is `outstanding − credits` where `outstanding` is built from the CAPPED paid figure — so
pairing it with the narrowed credit column double-counted the money that had just moved, and Avery's
balance read ($578.15) instead of ($1,128.15). **The one number D6 promised not to move.** Neither
the typecheck nor the new unit test could see it: the helper's invariant is about `paid + credits`,
and that line was quietly using a different pair. The fix and the reasoning are written at the line.

**Verified by reading all twelve rows off the rendered page against their pre-change values** —
every balance identical, the season-totals band still ties (Collected $2,225 → $2,775 and credits
$2,899.63 → $2,349.63, sum unchanged), and the roster player panel agrees with the dues table to the
cent. Gates: typecheck · 3,058 unit tests (13 new, pinning the invariant over the awkward cases) ·
full `verify:changed` · rendered layout sweep at 361/390/768/1440 with no new findings.

### D7 — chased to the bottom before any build, and it was never a bug *(closed)*

Owner: *"shouldn't we review and remediate D7 before beginning work?"* — and it moved two figures.

Three of twelve families' Credits column disagreed with the credit records. **The column is shown
net of money already handed back**: Blake $100, Casey $300, Logan $200 had been paid out. Deliberate
and documented — a credit refunded in cash must stop reducing what that family owes.

**Consequence:** Blake's planned dues are $793.85 (not $693.85) and Logan's $870.83 (not $670.83);
the fold total moves to $8,958.67 and Total revenue to $10,908.67. **Built on the earlier numbers,
two families would have been chased for money they do not owe.**

## 7. Build order

1. **Split the family's own money out of "Credits" on the Dues tab (D6, pending yes).** The two
   screens must agree on what a family sent before either starts showing it per family.
2. **Net external credits into the dues row on the report — on its own, shipped as its own change.**
   Total revenue moves by $2,349.63; that must be visible as one thing rather than buried inside a
   new feature. Replace the 2026-09-04 "budgeted dues = the instalments" note in the same commit.
3. Statement + By activity fold.
4. Months fold.
5. Budget tab `Player installments` fold (plan only).
6. Exports follow the screen — the by-activity export already diverged once and is the standing lesson.
7. Help + demo sweep. The coach demo's money narration has gone stale across three consecutive
   releases, and this one changes Total revenue.

## 8. Gates

- The fold's rows **sum to the row above them**, asserted in a unit test on the pure rollup, not by
  eye. This is the gate that matters.
- Per-family plan under `To date` equals the sum of instalments due to date, asserted the same way.
- Rendered layout sweep on all four surfaces at 361 / 390 / 768 / 1440 — the fold adds rows to a
  pinned-column table, which is where this report's phone problems already live (QA §146 found the
  name column is a third chevron at 390).
- The permission rule proved on the **built screen** with a read-only assistant session.

## 9. Related

- QA §146 — where this was raised (`OWNER_QA_LEDGER.md`).
- `COACH_MONEY_ONE_SURFACE_PLAN.md` — the pass that made all three reports one table, which is what
  makes a fold here cheap to build and consistent to read.
- The 2026-09-04 ruling this supersedes, in the Budget vs. Actual panel's `DuesRow`.
