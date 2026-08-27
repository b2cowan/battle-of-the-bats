# P4 — A payment learns who paid it · PM BRIEF

**Status: GATE 1 — awaiting owner approval. No code written.**
Drawings: `claude.ai/code/artifact/4873ab46-4e1e-4726-b856-d361ecc0e017`
Plan section: `COACH_MONEY_CENTRALIZATION_PLAN.md` §8c

---

## In one paragraph

A parent pays the $200 tournament deposit straight to the tournament. The team's cash never
moves, and the team now owes that family $200. Today the coach can record that only if the
family fronted the **whole** cost — a parent who covers one piece of a bill the team is paying
the rest of cannot be recorded at all. P4 lets a **payment** carry who paid it, exactly as a whole
cost already can, with the family's credit created, kept honest and removed again on undo.

---

## Two things found in the code that change what this phase is

**1. The question is already on the screen, and it does nothing.** The record-a-payment form
already shows a "Paid by" dropdown listing every family, inside the fold whose own label
advertises it ("More — paid by, payee, tags, notes"). A coach can pick a family, press Save, and
the answer is **silently thrown away** — and the sentence above the button tells them the team's
cash left, because nothing ever tells it otherwise. That is a live defect of exactly the shape
ruled against on 2026-08-23, and it means P4 is not adding a question to a crowded screen — it is
honouring one the screen already asks. **The cost to the layout is zero.**

**2. There is no payment editor, so most of the feared unwind is not reachable.** A recorded
payment has two operations: record, and undo. There is no edit route and no edit screen —
correcting a payment is undo-and-record-again, which is what the product already tells coaches.
The build prompt asked for the unwind drawn three ways (change the amount, change the payer,
delete); only the third exists. **Recommendation: P4 does not build a payment editor.** That is a
larger decision than this phase and taking it in passing would reopen questions the paid/owed
ruling closed.

---

## What a coach does differently

- Recording a payment against a bill, they can say **a family paid this one directly**. The
  answer is now kept.
- Before saving, one sentence states the consequence in dollars: *"When you save: no team cash
  moves. Spring classic entry drops to $400.00 still owing, and the team owes Avery Test's family
  $200.00 — saved as a credit you can put against their dues or pay out any time."*
- The payment list on the bill says who paid it, so the fact survives without opening anything.
- The family's Player Dues screen and their statement show the credit, named the same way an
  out-of-pocket cost already names one: *"Paid out of pocket — Spring classic entry"*.
- Undoing the payment removes the credit again, and says so before it does.

**Nobody is asked a new question.** The default stays "The team", and a coach who never fronts a
cost never notices anything changed.

---

## Who can see it

- **Recording** needs the money-write capability, as it does today.
- **Reading** it does not. The payer appears on the bill's payment list and the register — the two
  surfaces a read-only money assistant sees — because that account never gets an Edit button to
  look behind. The §104 walk found details that existed only behind a button such an account never
  gets; this avoids repeating that.
- Naming a family here is a **player name**, which is baseline information in this portal, not
  guardian contact detail. No new privacy question.

---

## What it costs, honestly

| | |
|---|---|
| New screens | None |
| New fields on screen | None — the field exists and is inert |
| Genuinely new UI | One badge on a payment row ("Family paid") |
| New words a coach must learn | None — the credit reuses the existing wording exactly |
| Database | One column, on the payment record |
| Highest-risk work | Three reports that currently ask "did a family pay this?" of the whole cost and must now ask it of each payment |

**The three readers are where the money is.** The register's running balance, the season
settlement pot (the figure that sets every family's end-of-season refund) and Budget vs. Actual's
cash strip all decide *per cost* whether team cash moved. After P4 a single bill can have one
payment that moved team cash and one that did not, so each of them has to decide *per payment*.
Getting the settlement pot wrong would misstate every family's refund — it is the reason this is
its own phase.

---

## Open questions, with a recommendation each

**Q1 — Should P4 build a payment editor?**
**Recommendation: no.** Undo-and-record-again is the existing, working answer, and it is what the
product already tells coaches to do. Building an editor is a bigger change than this phase, and
it would drag the paid/owed questions back open.

**Q2 — Can the payer on a saved payment be changed?**
**Recommendation: no — refuse it, in the words the product already uses.** Moving an out-of-pocket
*cost* to a different family is already refused ("Who paid can't be changed after saving — it
decides which family the team owes. Delete this and enter it again."). Following that precedent
rather than inventing a second answer deletes this phase's worst failure mode outright: there is
no "reverse one household's credit and mint another's" operation to get wrong, because there is no
such operation. It costs the coach one extra tap on a rare correction.

**Q3 — The collision: a cost that already names a fronting family, receiving a payment that names
one.** **Recommendation: don't ask the question twice.** The cost states its payer; the payment
inherits it; the field renders as a locked fact ("A family, out of pocket — Avery Test · Set on the
cost") rather than an editable choice. No family can be credited twice, by construction. The
alternative — letting the payment override the cost — would work arithmetically but would put two
answers to one question a few inches apart, which is the defect the 2026-08-26 filter-count ruling
named. A cost genuinely split between two fronting families is a *third* thing and should be
recorded as two costs.

**Q4 — A hazard the build prompt does not name: a credit that has already been handed back in
cash.** A reimbursement credit can be paid out. If it is later reduced below what has already been
handed over, the arithmetic does not go negative — it goes **silent**: the figure clamps at zero
and the team is simply out the money with nothing on any screen saying so.
**Recommendation: refuse any act that would lower a family's credit below what has already been
paid out, and add that guard to the existing whole-cost path in the same change.** This is
reachable today; P4 makes it much easier to reach. It is small, and it is the strongest argument
for running P4 as its own careful phase.

**Q5 — On the phone, the consequence sentence runs to five lines above the buttons.** The drawing
trims its closing clause at phone width only.
**Recommendation: accept the trim,** but it is one string behind one breakpoint — say the word and
it stays whole.

---

## Success criteria

1. A coach can record a family fronting one installment of a bill the team is paying the rest of,
   and the team's cash figure does not move by that amount.
2. That family is owed the money on Player Dues and on their statement, in the same words the
   product already uses for a whole cost fronted out of pocket.
3. Undoing the payment removes the credit, and the confirmation says so in dollars first.
4. Changing who paid is refused with a sentence that names the next step.
5. The register's balance, the settlement pot and Budget vs. Actual all agree about how much cash
   the team actually spent — on a bill where some payments were fronted and some were not.
6. Nothing about a dues **schedule** changes. What changes is what a family is asked to send.
7. A read-only money assistant can see who paid without an Edit button.

---

## Priority

**Medium-high, and it is a correctness item as much as a feature.** The inert field is shipping
today: a coach who finds it and uses it gets a wrong answer in their books and a family who is
never repaid. That is true whether or not P4's feature is built, so the finding does not wait for
the phase even if the phase does.
