# Coach Payables Rebuild — a commitment holds many payments

**Approved 2026-08-19 from mockups. Build starting.** Plan:
`docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` · PM brief: `_PM_BRIEF.md` ·
Owner QA **§64** · Mockup (binding spec): `claude.ai/code/artifact/da11c0eb-07e4-4da4-bf8f-f27eb3b5cf7f`

## ⚠⚠ The origin is the lesson: A PASSING QA WALK FOUND FOUR DEFECTS

QA **§27 passed CLEAN** on 2026-08-19 — everything it checks, the product does correctly. The owner
then found four things the product **cannot do at all**. A checklist of existing behaviour cannot
find an absence; only a person trying to do real work can. **This is the strongest argument in the
repo for owner walks over test coverage**, and it is why §64 exists.

The four, all one root cause — money going out had ONE boolean:

1. **Cannot pay part of a commitment** unless a deposit/balance split was set up *before* any money
   moved. `Mark paid` means paid in full.
2. **Mark paid cannot be undone.** No un-settle exists anywhere; the only correction is deleting the
   whole commitment, which also destroys the other half's dates.
3. **A paid row on the Schedule is a dead end** — no pencil, not clickable — while the same record
   is fully editable from Commitments. The ruling was honoured; the *door* was missing.
4. **Nothing repeats.**

Underneath: `Schedule | Commitments` presented a **parent and its children as two reports**.

## The model

```
Commitment              what we owe
  └─ Installments        the plan               (1..n, dated)
  └─ Payments           what actually happened (0..n, dated, method)
```

Mirrors **Player Dues since migration 232** (schedule separate from payments recorded against it).

- **Every commitment has ≥1 installment** ⇒ the "No schedule" state (amount, no date, invisible to the
  schedule, can never be marked paid) **stops being representable**.
- **Total = sum of installments**, derived. Today total/deposit/balance can disagree.
- **A payment attaches to the COMMITMENT and applies oldest-unpaid-first, spilling forward.** One
  $700 cheque over $450 installments settles the first and part-pays the second — the coach does no
  arithmetic.
- **Settled = paid IN FULL. Partly paid counts as UNPAID** everywhere.
- **Undo = deleting a payment**, reversing by its own recorded ledger entry — never a guess
  (migration 236's lesson: editable descriptions made guessing unsafe).
- **Over-payment is ACCEPTED, not refused** — the money genuinely left; refusing teaches coaches to
  type a wrong number.

## ⚠⚠ The scope rules (recurring, linked series) — the load-bearing part

Three scopes on every installment edit and delete: **this payment only · this and later payments ·
all unpaid payments**.

- **S1 — bulk scopes NEVER touch an installment settled in full.** This is what makes a linked series
  safe, and it is the answer to the archived plan's own objection to a three-way scope.
- **⚠⚠ S2 — "this payment only" STILL EDITS a settled installment**, books following. Standing owner
  ruling 2026-08-16 (*"once it is edited the new value should permeate to the books"*), tested by
  §27 Part C, passed 2026-08-19. **Locking it reverses a live ruling** and restores the read-only
  branches deleted with it.
- **S4 — the scope picker HIDES when it has one answer** (five of six settled ⇒ just save).
- **S5 — a bulk date change SHIFTS, it does not SET.** Dec 1 → Dec 8 moves later ones by 7 days each.
- **S6 — lowering below what is paid ROLLS FORWARD**, naming every installment touched; blocks only
  when there is nowhere to go (last/only installment).

## ✅ What was already built, and what was reversed

**`COACH_RECURRING_PAYABLES_PLAN.md` (2026-08-15) is SUPERSEDED and archived 2026-08-19.**

⚠ **The owner was right that "we built a way to do that" and an agent told him otherwise** — always
search `docs/projects/{active,archive}/` before claiming a feature does not exist.

**Carries forward:** `lib/coach-monthly-recurrence.ts` + 43 tests, committed `c404bd4b` 2026-08-15
with **no callers, deliberately**, so the form could be built against a proven generator. **P4 calls
`generateMonthlyOccurrences` — do not re-invent month arithmetic.** The ceiling counts the **series,
not the request** (24), refused by generator AND route in ONE shared sentence (`tooManyInstallments`),
and the importer's duplicate-description reviewer must **not** be reused (every occurrence shares one
description by design).

⚠⚠ **ONE CARRY-FORWARD RULE WAS WRONG AND IS STRUCK (P4, 2026-08-20): "the server regenerates from
the rule and refuses any date the rule cannot produce".** It **contradicts QA §64 Part D**, which
requires the coach to `+ Add` a row with a date of their own, and it contradicts **S8**, which stores
no rule at all. It was the right rule for the schedule generator it came from, whose dates are not
editable, and the wrong one for a sheet whose whole point is that they are. **The rule fills the list
and gets out of the way; the LIST is validated and saved.** So `reviewMonthlyOccurrences` — the
engine's other half — is deliberately NOT called. A reviewer will ask why a 43-test module is
half-used; this is the answer.

**Reversed:** its §5.1 rejection of the three-way scope (S1 answers the objection); its frozen
part-paid and paid rows; its "deposit half or invisible" rule; monthly-only; and its shape of twelve
**separate linked payables** — twelve months of gym time is now ONE commitment with twelve
installments.

## Phases

**P1** the model lands invisibly (⚠ acceptance test = the books do not move by one cent and no screen
changes) · **P2** record a payment + undo · **P3** the screen (one list, `Group by`, the drawer) ·
**P4** recurring · **P5** help, both demo sandboxes, exports, baselines.

**⚠⚠ /review CAUGHT A MONEY DEFECT IN P4, and three lenses reached it independently.** `planInstallmentWrites` matched a desired plan to stored rows **by POSITION**. Remove a non-trailing piece and every row below slides up — the row carrying a settled $200 deposit is rewritten to hold the $400 balance while the payment recorded against it still points at that row, and `paymentRestatements` then restates that payment to $400 **with its ledger entry**. Real cash movement under a sentence that only promised to remove a row. **THE LESSON GENERALISES: a positional key is a silent liar the moment a list can be edited in the MIDDLE** — it was correct while a plan held two pieces and could only be collapsed wholesale, and P4 is what made a mid-list removal reachable. Fixed by having an EDITED plan name its rows (`PlanPiece.id`); a CREATED plan names nothing and keeps the positional rule. ⚠ The SQL order is load-bearing — DELETE → renumbering UPDATEs (ascending) → INSERT, because `(expense_id, installment_number)` is UNIQUE and an early append would hit the upsert conflict target and OVERWRITE a row. ⚠ Verified with a live dev-DB round trip, which is the only evidence that can see a unique constraint or an FK action. Also fixed: a **date-only bulk edit rewrote every amount in scope** (send only what changed, and send the same object the preview used), and **missing double-submit latches** (release in `finally`, never in a function the render path can reach).

**✅ P5 CLOSED 2026-08-20 by two owner calls.** The coach sandbox now shows a **repeating dome bill** (5 payments, 2 settled) — a judgement no check could make, since `check:demos` proves breakage and never absence. And the **shared touch-target fix** landed: the filter pills cleared the 44px floor, so all four money screens pass and three stale entries were pruned. ⚠⚠ Two lessons: the obvious fix was wrong twice by adding WIDTH to solve a HEIGHT problem (an `inline-flex` link stops wrapping; moving a media guard dropped the register’s compact sizing) — add height only, never width; and `--init` **silently baselined a regression I had just caused**, caught only by diffing the baseline against HEAD. **Audit what `--init` ADDED, not the count.**

**⚠ P1–P5 ARE ALL ON DEV.** §64 Parts A+B walked 2026-08-20; **C+D walked 2026-08-21**; E, F, G, H owed.

**⚠⚠ THE C+D WALK FOUND FIVE THINGS AND EVERY ONE WAS AN ABSENCE OR A FALSE SENTENCE** — never a
broken control. Three lessons worth more than the fixes:

1. **A BEHAVIOUR LIVES IN MORE THAN THE CODE THAT COMPUTES IT.** "Spending is matched to a
   category, so line rows read —" was written down in **FOUR** places: the arithmetic, the grid
   component, the **export**, and the **note under the grid**. Each was fixed and declared done
   while three copies were still live, across three separate replies. **After changing what a
   screen MEANS, sweep the user-facing copy, the export and the help — not just the logic.**
   The help then turned out to hold a fifth copy ("teams in their second season also get a last
   season column — often the most useful part"), found only by an adversarial review lens.
2. **THE REPORTED REASON CAN BE WRONG WHILE THE CONCLUSION IS RIGHT.** The money-tag filter was
   reported as doing nothing. It worked — measured, four figures moved. It went anyway, because
   it narrowed SPENDING while the PLAN stayed whole (a budget line carries no tag), so
   **Headroom ROSE as you filtered** ($8,905 → $10,900 on the fixture). ⚖ **A comparison report
   cannot half-filter a comparison.** It looked inert because the unfiltered plan holds every
   category row open, so figures leave rows that stay on screen — and on the Budget lens nothing
   changes at all. Tag filtering stays on Transactions, which lists rather than compares.
3. **THE PRIOR-SEASON COLUMN IS GONE** (with its "in last season's plan" list and its query).
   A bare year at the head of a row of months read as a month of THIS season, and it ignored the
   Showing lens — so under Scheduled it stood last year's budget beside this year's remaining
   debt. **Budget vs. Actual evaluates THIS season only.** Cross-season wants its own view; do
   not reinstate it in that grid.

**⚠ Three fixes landed AFTER the step that prompted them and are walked-but-not-re-walked** (the
grid note's wording, the undo double-tap guard, the undated-money key). They are listed in §64's
header for the next sitting.
P4 lifted the two-piece cap, and **four things had to move in one change**: the cap in
`parseInstallmentPlan`, the deposit/balance form editor that forced it, `Add an installment`'s
one-piece restriction, and the export's four Deposit/Balance columns. `/review`'s rule is why —
**a raised cap with the old editor still in place re-creates the silent truncation the cap
prevented.** A commitment's typed `Total Amount` went with them (R2). **Monthly is the only cadence
and there is no cadence control** — §4.1's Weekly / Every 2 weeks were written before anyone read
the engines. The three-way scope lives on each scheduled payment in the DRAWER (`Change` / `Remove`),
not on the form, which states the whole plan and so has nothing to ask; **nothing is greyed out on a
settled row.** S1–S7 are `lib/payable-scope-edit.ts`, run in the browser and again on the server so
the sentence a coach reads and the write that follows are one decision. **S6's roll-forward is not
implemented** — `commitmentStanding()` already re-applies payments, so the module re-runs the
standing over the proposed plan and reads off what moved.

⚠ ~20 coach-side readers touch the deposit/balance pair — the schedule, Overview's next-30, Budget
vs. Actual (incl. Months), the register, exports, season close, club allocations, the importer, the
status model, the admin-side panel, and both demos.

## ⚠⚠ WHAT COMES AFTER THIS PROJECT — one PLANNING session, owner-called 2026-08-21

**Opens when Payables closes. PLANNING ONLY — the owner is reviewing the money screens themselves
first and will bring the detail. Do NOT pre-empt it with a plan file or a build.** Brief lives in
**§9 of `COACH_PAYABLES_REBUILD_PLAN.md`**; TODO carries a one-line pointer.

The owner, verbatim: *"we are getting closer to a centralized model and this project in particular
has helped us make a lot of ground, but I still feel like I have to go to too many places to log
different transactions, and as a user it feels confusing."*

**⚠⚠ THE ROOT, NAMED WHILE LOGGING IT, AND THE PART WORTH CARRYING FORWARD: THE MODEL CONVERGED
AND THE DOORS DID NOT.** Money-in and money-out now think identically — a plan of dated
installments plus payments recorded against it — on the dues side since mig 232 and the payables
side since this project. **That was the hard half and it is done.** What never converged is how a
coach REACHES those records: **Transactions, Payables, Player Dues, Fundraising and Club each grew
their own add-door at a different time**, so one act ("money moved — what, when, who") is five
different conversations.

**⚠ IT CARRIES §64’s ABSENCE AS ITS CONCRETE INSTANCE, AND THEY ARE ONE QUESTION — do not let the
session split in two.** A family can front a WHOLE cost but not ONE payment of a multi-payment bill
(a parent covering the $200 deposit on a $600 tournament entry has nowhere honest to go: record it
as a team payment and the team’s cash did not move and that family is owed nothing; split it off as
its own plain cost and the entry loses the schedule it really has). The reason is the same
mismatch in miniature: **a payer is a field on the COST FORM, and a payment record has no payer at
all** — built by different phases, for different screens, and nobody has yet asked what a payment
is supposed to carry.


**⚠ A THIRD INPUT (added 2026-08-21, both found by the owner walking the built screen):** the
money-tag filter **never becomes a dropdown — there is no threshold at all**. Every tag renders as a
chip, so fifteen tags is fifteen chips wrapping the toolbar. **It is the ONE narrowing on these
screens that the reporting convention this project set never reached** (§7: a narrowing is a
labelled pill that opens a list, with counts) — and nobody noticed because the QA fixture had no
tags until the owner created one. ⚠ The test is the owner’s own §7 wording, not a number: *“count
what is on screen, not what is behind a click.”* And **“Manage tags” sits on at least three toolbars
for two libraries** — Transactions AND Payables (the same button twice inside one hub), Budget Plan,
and the schedule for event tags — each placement locally reasoned as “manage the words where you use
them”, with Team Settings considered and deliberately refused. ⚠⚠ **The question is not who put it in
four places; it is whether that rule still produces a good experience once four screens have applied
it** — the five-add-doors question at a smaller scale, which is exactly why it belongs to the same
session. ⚠ **Do not fix either before the session**: the chip-to-pill change is small enough to be
tempting and would pre-empt the conversation about what these controls should be.


**⚠ A SIBLING SESSION, deliberately kept SEPARATE (owner-raised 2026-08-21):** on the rebuilt
Payables at phone width — *“I don’t really like the phone version where it is still a dropdown with
huge tiles, this will become a ton of scrolling.”* **The cause is shared, not local:** every table in
the portal reflows to cards through ONE rule (`.tableAsCards`), which gives every column its own
labelled line because it cannot know which fields matter on which screen. On a money list that is
mostly noise — an installment card spends ~330px saying DUE / WHAT / OWING / STATUS when the values
already say what they are. **It reaches 9 files** (Payables + Transactions, Dues ×2, Club,
Fundraising ×2, development board, two history screens). ⚠ **Kept out of the centralization session
on purpose**: that one is navigation and vocabulary, this is presentation and touches screens with
nothing to do with logging — mixing them buries the phone work behind the model discussion. ⚠ **But
SEQUENCE them**: if centralization retires or merges screens there are fewer card tables to rework.
Own TODO entry.

**Two standing constraints for that session:**
- **Do not add a sixth door that unifies the other five.** A hub over five inconsistent forms is
  six things to learn, not one. The strongest version RETIRES screens.
- **Do not touch the MODEL to fix the DOORS.** Installments-and-payments is settled, tested and
  about to ship; the complaint is navigational and vocabulary-level.

**⚠ How the absence was found is itself the lesson**: the owner asked a plain question of the
screen — *"how do I say a family paid for a payable out of pocket?"* — and the answer was "you
cannot". Same class as the four defects that started this project: **a passing QA walk cannot find
an absence.** It also caught a mistake in flight — a walk step had been written asking the owner to
do that impossible thing, and a branch of the undo confirmation existed for a case that can never
occur. Both removed.

Related: [[project_coach_expenses_edit_delete]] · [[project_coach_money_table_consistency]] ·
[[project_owner_qa_ledger]] · [[design_decisions]] · [[reference_coach_money_check_then_act]]
