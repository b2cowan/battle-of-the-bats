# Paid club events, round 3, team sign-ups: the club's bill to its own team, an outside team's sign-up, our fee
**Last verified:** 2026-11-25 (code read today; NO new CRA or Justice Laws page read this round, it rests on the round-2 reads in `BOARD_READY_STAGE5_PAID_EVENTS_REVIEW.md`; the one point of tax law that is new, who pays versus who is supplied, is stated at summary level and NOT read)
**Re-verify by:** before team sign-ups are built; a team can pay a club bill by card inside the product; a club event outside the club's province; the owner rules on tax-included vs tax-added (round 2); Québec or US club opens
**Depends on facts:** registered for GST/HST, annual filer, regular method; R1 (tax inside our fee); Canada first. Read `BOARD_READY_STAGE5_PAID_EVENTS_REVIEW.md` first: this file only says what a team buyer changes. Product research, NOT our books, except §5.

## Question(s) this answers
- A) A club bills its own rep team for banquet tickets through the existing club-to-team bill: taxable supply or internal transfer? Tax line on the bill? Where does it land in the club's books and the team's? Team receipt?
- B) An outside team's "For a team" sign-up (card or e-transfer): same as a family? Place of supply with a team from another province?
- C) Outside teams in an "invite only, not listed" tournament: any change to entry-fee treatment?
- D) FieldLogicHQ fee points.

## Verdict table
| # | Question | Verdict |
|---|---|---|
| A1 | Taxable or internal transfer? | **Tax follows the tickets, not who pays.** Default: the event's own tax setting applies to the team bill unchanged. No separate "team bill" tax switch. Words in §1 |
| A2 | Tax as its own line on the bill? | **Yes for a taxable event** ("Includes $X.XX HST (13%)", once on the whole bill). Lands under "Club events" (Event tickets, GST/HST collected), NOT under "From the teams". **Build change: today's bill has no tax handling at all** (§2) |
| A3 | Team's own book | An expense to the club, one all-in figure, no tax split on the team's side (§3) |
| A4 | Team receipt | Yes: "Bill for event tickets" when issued, "Receipt for event tickets" when the club records the payment; team name, counts by kind, no names (§4) |
| B | Outside team "For a team" | **Same as a family**, addressed to the team; ONE charge, ONE receipt, ONE fixed fee; the buyer's province or country does not change the tax (§5) |
| C | Invite-only tournament | **No change.** Who may enter is not what is supplied (§6) |
| D | Our fee | Club-bill path: **nothing, it never touches our payment code**. Outside team by card: the same R1 fee, `event` record, once per team (§7) |

## 1. A1: is a banquet ticket billed to the club's own team a taxable supply?
**Facts from the code and the owner's rulings.**
- The product words a team's cash as **"Held by the teams · not the club's money"** (`lib/club-money-words.ts:412`), and the owner ruled the team's books stay the team's own (2026-11-06, club sees one cash figure). So the product itself does not say a team is the club.
- Whether a rep team is a separate legal person is NOT the product's to know. It varies by club: a program of one non-profit corporation (not a person apart from the club), or a parent-run unincorporated team with its own bank account (its own person for GST/HST purposes). The product cannot find out which.

**Why the answer does not depend on it.** Two readings, same outcome for the ticket:
1. Team is a separate person: the club supplies tickets to the team. A taxable supply if the event is Taxable.
2. Team is part of the club: the club's money moves within one person, but the dinner is still eaten by individual players, parents and siblings. The supply is the banquet seat to each of them; the team's pot is only the way it is paid.
Only an Exempt event (round 2: Camp, Clinic, Champs day) removes the tax. "Internal transfer" is not a way for a banquet to be tax-free: it would make the club collect nothing on dinners that are taxable when a family buys them directly. Under-collecting is the costly mistake (round 2 §3). Who pays versus who is supplied: stated at summary level, **not read**, accountant to confirm.

**Recommended default:** the team bill uses the event's tax setting exactly as a family's ticket does (Banquet, AGM, Other: Taxable; Camp, Clinic, Champs day: Exempt). One switch per event, none on the bill.
**Screen words, under the event's tax switch** (add one sentence to round 2's hint): "Teams pay the same tax as families. Tax follows the tickets, not who pays for them."
Safe words: "follows the tickets". Not safe: "internal", "your teams are part of your club" (not true of every team), "transfer", "no tax between your own accounts".

## 2. A2: the bill, and how it lands in the club's books
**What the code does today.** `createClubAllocation` (`lib/club-budget-writes.ts:403`) takes a description, a split method and per-team amounts and installments. It has **no tax field, no event link and no line kinds**. Money received on a bill is written by its SOURCE, never by a word chosen by the club: an allocation received files under **"From the teams"** (`FROM_THE_TEAMS_WORD`, "what the club billed its teams from the year's cost lines"), badge Team (`lib/club-ledger.ts`). Nothing posts GST/HST collected from it. `isPassedOnTax` (`lib/club-money-figures.ts:791`) only knows the item "GST/HST remitted".
**Recommended shape.**
- A team's ticket bill is a **new kind of bill tied to an event**: its lines are the counts ("6 adults at $40.00, 4 children at $15.00"), the tax is worked out ONCE on the bill's total, tax included in the price (round 2's all-in rule).
- Bill words (taxable): "Bill for event tickets" · the event's name and date · "6 adults at $40.00 · 4 children at $15.00" · "Total $300.00" · **"Includes $34.51 HST (13%)"** ($300 x 13/113, to the cent) · "Billed to {team}" · due date · the club's name, address and GST/HST number. Exempt: no tax line, no number. The bill is the tax invoice (the tax point is the invoice date, `CLUB_SPONSOR_INVOICE_REVIEW.md`), so it always carries the full over-$100 set, and a team's name counts as the buyer's name for the $500 rule (accountant to confirm).
- **When the club records the payment, split it as a family's ticket is:** "Event tickets" $265.49 and "GST/HST collected" $34.51 under the **"Club events"** heading, naming the event ("Year-end banquet 2026") and the team ("11U AA"), never a person. Part payments split in proportion, the last one taking the remainder (as sponsorships). Default to pay in full (one installment).
- **Why not "From the teams":** it is the cost-recovery row, with no tax line and no event; the banquet would be missing from "what did the banquet make" and its tax from GST/HST collected, which is the figure the club files from. The team's standing with the club (billed, paid, overdue on Accounting > Teams) is unchanged: that stays read from the bill, as the owner ruled.
- **Do not bolt a tax switch onto every club allocation.** A team bill for shared ice or fees is a separate question that the code does not tax today (lead for the club's accountant: whether billing a team for a shared cost is a supply; not researched here, outside this stage).
- **Reducing a bill after it is issued** (two players drop out): taxable event, a credit note dated that day, tax in proportion to the part removed, nearest cent (round 2 §6); never edit the original. Exempt: reduce it, no note.
**Gap I did not check:** the posting code of `club_allocation_create` and the receipt step (mig 317) is in SQL; the "split the payment into two ledger lines" is a build question for `/plan`.

## 3. A3: the team's own book
- The team records an **expense to the club**, one all-in figure ($300.00), filed in the team's own words (the existing "from Club" register kind, `lib/coach-register.ts`). Nothing new on the team's side.
- **Show no tax split in the team's book.** A team is not registered, so it cannot claim the tax (no input tax credit), and a GST/HST row in a volunteer treasurer's book invites a claim that will be refused. The tax is on the bill, where the club's accountant and the family's questions go.
- The team recovering the cost from its families (dues, a separate collection of $40 and $15) is the team's own business. Nothing in this proposal should print "HST" on a family's dues line.
- Money moves by the club's "Record received" (e-transfer, cheque, cash), as every bill today.

## 4. A4: a team receipt
Yes. It is the same document family as round 2's, two moments:
- **When issued:** "Bill for event tickets" (above).
- **When paid:** **"Receipt for event tickets"**: paid by the team's name, then "Contact: {person who paid}" (the payer on the receipt must be the person who handed over the money); the event's name, date, start time, venue; the counts by kind and prices; amount paid; date and "Paid by e-transfer" / "Paid by cheque" / "Paid by cash"; club name, address, issue date, named issuer; taxable only: the club's GST/HST number and "Includes $X.XX HST (13%)". Reissue net after a credit note, never edit.
- **No names of players, parents or siblings.** Counts only. A child's name is not needed for any tax purpose. (A guest list for the dinner is the club's separate operational need: which names the club may hold about a team's members is a `/legal` privacy question, not an accounting one.)
- Footer, verbatim from round 2: "This is a receipt for tickets you bought. It is not a donation receipt and it is not an income tax receipt."

## 5. B: an outside team's "For a team" sign-up
- **Same treatment as a family's sign-up**, and a simpler one: the buyer is the team (a person for GST/HST purposes whether or not it is incorporated), the supply is the tickets. Tax by the event's setting, tax included, once on the whole sign-up.
- **One charge, one receipt, one fixed fee** (round 2 §5): a 25-person team is one charge, not 25. The receipt names the team, the contact who paid, and counts by kind. A later addition is a second charge and a second receipt.
- **E-transfer:** recorded by the club, no card fee, no per-fee record; the tax is owed all the same and the receipt follows the recording.
- **Place of supply:** an admission is intangible personal property (round 2); the expected answer is the **province where the event is held**, the same as a family's. A team from another province, or a US team that attends in person, makes no difference to the rate or the tax. **Do not zero-rate or drop the tax for a US team** (the zero-rating for US customers in `ZERO_RATED_SALES_TO_US_CUSTOMERS.md` is about OUR sales, not a club's dinner). The place-of-supply text for admissions is still not read; re-read it before a club holds an event outside its own province (round 2).
- Team buying more than $500: the receipt must name the buyer and describe what was bought (round 2 §4); the team name plus contact covers it.
- Currency: the club charges in CAD; a US team's card is converted by its bank. Nothing for the club's books but the CAD figure.

## 6. C: outside teams in an "invite only, not listed" tournament
**No change.** An entry fee is the club's supply of a place in the competition. Making the tournament invite only, not listed changes who may enter and how they find it, not what is supplied or by whom. The tax class of a tournament's entry fee is its own question (tournaments; the sports-registration exemptions for a non-profit are a separate reading from camps and dinners), not drawn in this round. I found no tax field on tournament entry in the `lib` files searched (not an exhaustive search). Nothing in "invite only" needs a new tax word.

## 7. D: FieldLogicHQ fee points
- **A team paying its club's bill: nothing for us.** The club bill is recorded by hand: `lib/club-money-moves.ts` and `lib/coach-club-bills.ts` contain no Stripe, application fee or checkout call. No fee, no per-fee record, no GST/HST of ours. The product has no card button on that path, so no screen needs a word about card fees there. **If a later build lets a team pay its bill by card in the product, it is a new payment path**: the R1 fee on the club's payout, an `event` per-fee record, the club's province, no `automatic_tax`, and a rule for who bears the card fee (a team has no family; follow the club's Payouts choice, as round 2 §7). Re-verify then.
- **An outside team paying by card at a "For a team" sign-up:** as a family's: R1 fee (base = our application fee only, tax inside it, place of supply = the CLUB's billing-address province), a per-fee record with source `event`, no `automatic_tax` on the session, our name and number never on the club's receipt. The fixed fee falls once per team sign-up (a saving to the club, nothing to change on our side). The passed-on card fee line, if the team pays it, carries the club's tax on a Taxable event and none on an Exempt one (round 2 §7).
- A club refund (or a credit note) does not refund our fee (unchanged).

## What must change in the drawing's shape
1. The team's ticket bill is a new kind of bill tied to an event, with its own tax line, not the existing cost allocation with a note.
2. Payment received on it files under "Club events" (Event tickets, GST/HST collected), not "From the teams".
3. The team's tax comes from the event's switch; no second switch on the bill.
4. Show the tax on the bill and receipt, never in the team's own book.
5. "For a team" is one charge and one receipt; the buyer's location changes nothing.
6. No words that call a team a part of the club.

## Sources
- No new primary sources this round. Round 2's reads stand: RC4081, RC4082, ETA Sch. V Parts V.1 and VI, Memo 5-1, Memo 3-3-6-2 (see `BOARD_READY_STAGE5_PAID_EVENTS_REVIEW.md`).
- Code read 2026-11-25: `lib/club-budget-writes.ts` (`createClubAllocation`), `lib/club-ledger.ts`, `lib/club-money-words.ts`, `lib/club-money-figures.ts` (`isPassedOnTax`), `lib/club-money-moves.ts`, `lib/coach-club-bills.ts`, `lib/coach-club-money.ts`, `lib/coach-register.ts`; memory `decision_coach_books_stay_the_teams.md`.
- Existing: `CLUB_SPONSOR_INVOICE_REVIEW.md`, `BOARD_READY_STAGE7_CAMPS_REVIEW.md`, `PLATFORM_FEE_TAX_COLLECTION_METHOD.md`, `CREDIT_NOTES_ON_REFUNDS.md`.

## Professional sign-off needed?
Our books: no new item. A club's accountant: whether a given club's rep teams are part of the club or separate persons (and so whether the club's own sale to them is one supply or two); the "who pays versus who is supplied" rule; whether billing a team for a shared cost (ice) is a supply; the $500 buyer-name rule when the buyer is a team; place of supply for an event outside the club's province. `/legal`: guest-list names held about a team's members.
