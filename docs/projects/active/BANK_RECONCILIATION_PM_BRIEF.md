# PM brief: checking the books against the bank (both portals)

**Plan:** `BANK_RECONCILIATION_PLAN.md` · **Priority:** High (inside the Club release, owner 2026-10-12; planned and
drawn before Stage 8) · **Status:** planned; all twelve asks (B1–B12) ruled A by the owner 2026-11-04, as recommended.
Drawings approved 2026-11-04. **R1 built 2026-11-04** (behind the scenes, nothing a customer sees yet): the bank account, the statement and the tick are stored; the arithmetic is proven against both example statements; a Stripe payout was measured to add up to the cent when the family pays the fee (the club-pays case still needs one test payment). **R2, the club's Bank tab, built 2026-11-04 to 2026-11-05 (complete
at its last commit)**: under Accounting → Bank a club treasurer names the bank account, enters where the books stood, then
checks statements to a $0.00 difference, with a Stripe payout ticked as one line, bank fees added from the check, Undo
with a reason, a second account and books moved between accounts. It works at a desk and on a phone (the difference
stays pinned at the top and the main button stays in reach at the bottom). Members who can open Accounting but not move
money read the same tab with no buttons. Before it reaches customers: the database changes go to production, and one
club-pays payout is seen in a browser. Next: R3, where the bank check shows elsewhere in the club's money screens.

---

## What it does

Once a month, a club treasurer, or a team's coach or team treasurer, opens their bank statement beside FieldLogicHQ. They
type the statement's end date and closing balance, tick off each line the bank shows, and watch the difference fall to
$0.00. Then they mark the statement checked. The club and the team each carry a quiet "Bank checked through March 31",
and the club can see that line for every one of its teams.

## Why it matters

- **It's the one money job the product makes a treasurer do somewhere else.** Today every club and team keeps its books
  here and then checks them against the bank in a spreadsheet, or doesn't check at all.
- **Associations require it.** Canadian minor-hockey associations commonly require every team to hand in a monthly bank
  reconciliation, and a final one at season end. Today that's a spreadsheet emailed to the club. After this, the club
  sees each team's "checked through" date without asking.
- **It's the claim we took off the Club page.** "Payment reconciliation" was removed from every Club page on 2026-10-19
  because nothing did it. This is what makes the claim true again.
- **The comparable tools don't do it.** The team apps we looked at (TeamSnap, Jersey Watch) track payments but don't
  check a bank statement. Accounting tools (QuickBooks, Wave) do, but a volunteer doesn't run their team in QuickBooks.

## What the treasurer and the coach see differently

- **Club:** a new **Bank** tab in Accounting. The first visit sets up the account: a name, a starting balance, and which
  books belong to it (all of them by default). Each statement is one check. A Stripe deposit arrives as **one** line that
  ticks every family payment inside it at once, instead of thirty lines to hunt for.
- **Coach:** a fourth way to view the Ledger, **Bank**, beside Timeline, Bills and Payment schedule. It's the same book
  arranged against the statement. A line paid in cash that never went to the bank can be marked "Didn't go through the
  bank", so a team that pays refs in cash can still balance.
- **When it doesn't balance:** three plain helpers: add a bank fee or interest, find a line by its amount, or finish later.
  No bookkeeping vocabulary.
- **Nothing locks.** Changing a line already matched to a statement gives a warning, and the checked statement then says
  "Changed since it was checked" until someone re-checks. Only the latest check can be undone, with a reason.
- **Elsewhere, quietly:** one line on each Overview; each team's date on the club's Teams tab; a printable one-page
  report to hand the board or the association; a reminder in the fiscal-year close and the season close (a warning,
  never a block).

## Who it's for

- **Club:** whoever can already move club money (owner; admin and treasurer by default). Everyone who can open Accounting
  can read the checks.
- **Coach:** whoever has money **write** on the team. Money **read** sees the checks.
- **Plans (ruled 2026-11-04, B11):** the Club plan, as part of Accounting; the Premium Coaches Portal, both standalone
  and Club-included. The free portal has no Ledger and gets nothing. No price changes.

## What it deliberately leaves out of the first release

Uploading a statement file, a live connection to the bank, a second person's sign-off, a "send to the club for review"
flow, and anything on a closed season's page. Each is written down in the plan so it's a decision, not a gap.

## Success criteria

- A treasurer with a real month of club activity, including a Stripe deposit, reaches $0.00 and marks it checked in one
  sitting, without help.
- A coach whose team handled some cash reaches $0.00 using "Didn't go through the bank".
- A club with five teams can see, on one screen, which teams have checked their bank this month.
- A cheque written before the season's rollover can still be ticked when it cashes after it.
- No figure on any existing money screen changes because of this feature.
- "Bank reconciliation" goes back on the Club page only after the owner walk passes.
