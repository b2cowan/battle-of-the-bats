# Club Tier Stage 12d: the words (online-payments hardening)

> Written by `/marketing`, 2026-10-27. Scope: every customer-visible string the 12d build needs (plan §0 state, "12d drawn"
> bullet; all 13 asks RULED 2026-10-26, plus the owner ruling of 2026-10-27 that a club with no subscription invoice is sent
> **its own invoice**). Binding, not reopened. Inputs: the drawings `CLUB_TIER_STAGE12D_DRAWINGS.html` (frames 1 to 6, the
> decision pages and the reviews table; their strings were the draft, every departure is in "Contradictions"), the two 12c
> words files (`CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md`, `CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md`, whose keys
> this file reuses and does not rewrite), the Business Decisions Log (the two 2026-10-26 entries), and today's shipped words
> in `lib/online-payment-words.ts`, `lib/league-pay-words.ts`, `lib/house-league-money-words.ts`,
> `lib/registration-words.ts`, `lib/needs-attention-words.ts` and `lib/platform-debit-fee.ts`.
>
> **Out of these words on purpose:** GST/HST (ask 8, paused: no tax word on any screen, email or invoice). **Cards from
> outside Canada are IN, as a cost to the club and nothing else** (owner ruling 2026-10-27, replacing ask 9's gated
> surcharge): Stripe's extra cost on a card issued outside Canada is one more line on the club's Stripe-fees bill, from
> Stripe's own figure. The family is never charged more: no surcharge, no "issued in" line on a pay page or receipt, no extra
> pay-button note. The terms TEXT is counsel's (the owner: "let's just make sure our terms explain that these additional
> charges are possible"); this file words only the product's chrome around it.

## How to read this

- The conventions of the 12a, 12b and 12c copy files apply unchanged: `key` to string tables, typographic `’`, `{tokens}`
  filled at runtime, money the house way (`$150.00`), `possessive()` for every possessive (`{childPossessive}`,
  `{teamNamePossessive}`, `{clubPossessive}`, `{guardianPossessive}`, never `{name}’s`), `formatTime()` for a clock
  ("7:59 p.m."), sentence case.
- **No rate and no Stripe amount is typed anywhere.** `{disputeFee}`, `{answeringFee}` and `{foreignCardFee}` are **Stripe's own figures at the
  time**, read from the dispute's fee as Stripe reports it; they are not constants and are never typed in a string or a
  test fixture's expected copy. `{returnedDebitFee}` is `RETURNED_BANK_DEBIT_FEE_CENTS` in `lib/plan-config.ts`, formatted
  with `formatMoney`. `{cardRate}` / `{bankRate}` are `onlineFeeRateLabel('card')` / `onlineFeeRateLabel('bankDebit')`. The
  other dollar figures in the examples ($150.00 fee, $300.00 balance, $1,284.50 payout) are the drawing's made-up fixture
  (Northfield Minor Ball; Henry Kim, receipt 1041; the Riverside Rockets 12U) and say nothing about what a club is charged.
- **Dates.** A screen shows "Nov 11" (the year only when it is not this year). An email shows "Nov 11, 2026"
  (`formatStoredDate`). A time is "Nov 11 at 7:59 p.m.". A window that already shows a long month (the plan-move windows
  do today) keeps "November 30".
- **Reused, not rewritten.** Where a shipped or earlier-file key is reused it is named in the note. New keys are marked
  **new**; a shipped key whose words change is marked **changes**; a draft the owner has not ruled is marked **held**.
- **A family-facing screen or email never names Stripe** and, under ask 2, **nothing here is sent to a family**. Every
  string in this file is read by a club's people (the desk, the owner, the treasurer) or by the platform team. Admin
  screens name Stripe.
- **Who answers.** Only the person who set up payouts can sign in to Stripe (`{answererName}`; the owner in the usual
  case). Amber, a button that opens Stripe, and an email go to that person alone. Everyone else who can see the same fact
  reads it in the quiet info colour, with the person's name (ask 3, review table).
- **Comped and free clubs read every billing line.** A comp covers the subscription and nothing else (owner,
  2026-10-26, verbatim: "comped clubs do not get any reprieve on stripe fees in any capacity, we are only comping their
  subscription."). Wherever a line says a fee is passed on, the club's plan is not in the sentence's way: it reads the same
  for a club on Club, a comp and a free plan, except for which invoice carries it (`{invoiceWhere}`, §1.7).

### Tokens new to this file

`{answererName}` (who set up payouts) · `{due}` / `{dueFull}` (the dispute's answer-by: "Nov 11" / "Nov 11, 2026"; with a
clock, "Nov 11 at 7:59 p.m.") · `{held}` (what Stripe says it took, never our arithmetic) · `{whyFull}` / `{whyShort}` (the
cardholder's stated reason, mapped in §1.2; empty when unmapped) · `{disputeFee}` · `{answeringFee}` · `{foreignCardFee}` · `{returnedDebitFee}` ·
`{receiptNo}` · `{reference}` (Stripe's dispute id) · `{signupDay}` · `{n}` / `{m}` (counts) · `{families}` / `{teams}`
(counts of who still owes) · `{extra}` (the amount paid past what was owed) · `{howPaid}` ("by e-transfer", "by cheque",
"online"; the earlier payment's method, lowercase in a sentence) · `{targetPlan}` (a plan's label from `PLAN_CONFIG`,
never typed) · `{date}` / `{dateLong}` · `{invoiceNo}` · `{invoiceWhere}` ("on your next FieldLogicHQ invoice" for a club
with a live subscription, "on a FieldLogicHQ invoice of its own" for a club without one) · `{supportEmail}` (the platform's
club-facing contact address; the build fills it from the one constant the other emails use) · `{counselSummary}` /
`{counselTerms}` (counsel's text; empty slots until it exists) · plus 12a to 12c's `{childName}`, `{childPossessive}`,
`{childFirst}`, `{childList}`, `{teamName}`, `{teamNamePossessive}`, `{guardianName}`, `{guardianPossessive}`,
`{payerEmail}`, `{clubName}`, `{contactEmail}`, `{tournamentName}`, `{seasonName}`, `{cardLabel}`, `{last4}`, `{owesAgain}`,
`{refundAmount}`, `{scope}`.

---

## 1 · A card payment is disputed (frame 1)

**Who sees what.** House league: the desk (owner, club admin, league admin, registrar). Tournaments: whoever runs
tournaments. Both: the owner. The treasurer reads the row, the Money note and a read-only record block and gets no door
(§0f). The family is never told by us (ask 2): their bank started it and tells them. A bank debit's dispute is 12c's and is
not touched here.

### 1.1 The Fee cell through a dispute's life (Registrations, a phone row's detail lines, a team's payment row)

The first line keeps the fee figure. The book line stays while a dispute is open (ask 3). One quiet chip for everyone but the
person who can answer; that person's chip is amber.

| key | words | where / who |
|---|---|---|
| `regs.fee.disputed` | Disputed | **new.** Chip on the first line, after "$150.00 paid". Info colour for everyone; amber for `{answererName}` only |
| `regs.fee.disputedAnswerBy` | {answererName} answers by {due} | **new.** Second line, for everyone but the answerer. The person's full name as the record names people |
| `regs.fee.disputedAnswerByYou` | Answer by {due} | **new.** Second line for the answerer. A date, not a button: the button is on the record |
| `regs.fee.inquiry` | Bank asking | **new.** The chip when the bank is only asking (no money taken). Second line is the same `AnswerBy` pair |
| `regs.fee.withBank` | Disputed · with the bank | **new.** After the club answered. Second line `regs.fee.answered` |
| `regs.fee.answered` | Answered {day} | **new** |
| `regs.fee.notAnswered` | Disputed · not answered | **new.** Past the due date with no answer. Second line `regs.fee.wasDue` |
| `regs.fee.wasDue` | Was due {day} | **new** |
| `regs.fee.disputeWon` | dispute won {day} | **new.** Joins the second line of a plain-paid cell: "Card · receipt 1041 · dispute won Dec 14". Last, lowercase, like "made in Stripe". Also used when the cardholder withdrew it (Stripe closes it as won) |
| `regs.fee.disputeLost` | {fee} owing · dispute lost | **new.** First line after a lost dispute, amber: the desk has something to do. `{fee}` is the registration fee, as `F.owing` reads it |
| `regs.fee.disputeLostSub` | Taken back by the bank {day} · receipt {receiptNo} | **new.** Second line. The same shape as 12c's `regs.fee.reversed` ("Returned by the bank {returnedDay} · receipt {receiptNo}"); the receipt is never shown as deleted |
| `regs.fee.disputeTip` | The cardholder’s bank is disputing this payment. Stripe is holding {held} from the club’s Stripe balance until the bank decides. The payment stays in the season’s book. | **new.** Tap-for-detail. After the club answered: "…Nothing is left for the club to do; the bank decides, and this can take weeks." |
| `regs.fee.aria` | {name}: {primary}. {sub} {third} | Shipped, reused |

A team's payment row (tournaments) wears the same words: the chip "Disputed" / "Bank asking" under the row's label, the
second line `AnswerBy`, and on a lost dispute the struck-through row "Taken back by the bank, {day}"
(`teamRow.disputeLost`, **new**, the twin of 12c's `teamRow.debitReversed`) with the team owing again.

### 1.2 The record block: "The cardholder’s bank is disputing this payment"

A new block in the Fee section of a house-league record and in the Payments section of a team's record, under the payment
facts. **Everyone who can open the record reads it.** The two buttons show to the people who refund in that flow and the
owner; **Answer in Stripe** is the answerer's alone and is absent (not dimmed) for anyone else. The treasurer reads the
same facts with no buttons.

| key | label | words | where / who |
|---|---|---|---|
| `dispute.heading` | (heading) | The cardholder’s bank is disputing this payment | **new.** Pill beside it: `dispute.pill.answerBy` "Answer by {due}" (amber for the answerer, info for the rest); inquiry: "The cardholder’s bank is asking about this payment" with the pill unchanged |
| `dispute.opened` | Opened | {day} | **new** |
| `dispute.why` | Why | {whyFull without its leading colon} | **new.** Omitted when the reason is unmapped. The words below |
| `dispute.held` | Held by Stripe | {held}, taken from the club’s Stripe balance until the bank decides | **new.** Omitted for a bank asking (nothing taken): `dispute.heldNone` "Nothing taken yet" |
| `dispute.answerBy` | Answer by | {dueFull} | **new.** Full date with the clock: "Nov 11 at 7:59 p.m." After the club answered: label "Answered", value `{day}`. Past due and unanswered: label "Was due" |
| `dispute.fee` | Dispute fee | see §1.7 | **new.** The owner only |
| `dispute.ref` | Stripe reference | {reference} ⧉ | Reuses `rec.card.ref`'s shape; the ⧉ is the symbol alone, aria `rec.card.copyAria` |
| `dispute.button.answer` | | Answer in Stripe | **new.** The answerer only. Opens Stripe (`PAYOUTS_WORDS.opening` "Opening Stripe…" while it opens). If it doesn’t: `dispute.openFailed` "Stripe didn’t open. Try again." in place |
| `dispute.button.copy` | | Copy the facts | **new.** Beside Answer in Stripe, everyone who refunds in that flow and the owner. Accessible name `dispute.copyAria` "Copy the facts for Stripe". One button, in the desk window and on a phone alike (ask 13). It is a labelled act, not a reference, so the symbol-alone rule for Copy in a small window does not apply |
| `dispute.copied` | | Copied | Replaces the label for two seconds (transient, as `rec.card.copied`). Refused: `rec.card.copyFailed` / `copyFailedDesk` reused |
| `dispute.factsLead` | | Stripe asks for your side, with evidence. Copy the facts holds what we have: {factsList}. | **new.** Under the buttons. `{factsList}` joins only the parts that exist, with commas and "and": "the sign-up on Sep 14 by Grace Kim", "the refund policy shown beside Pay", "receipt 1041 emailed to grace.kim@example.ca on Oct 2". A team: "the team’s registration on {day} by {contactName}" |
| `dispute.onlyAnswerer` | | Only {answererName}, who set up payouts, can sign in to Stripe. We emailed {answererName} on {day}. If the family calls, they can withdraw it with their bank. | **new.** Shown to everyone who is not the answerer, under the buttons. A team: "…If the team calls, they can withdraw it with their bank." |
| `dispute.answererGone` | | {answererName} set up payouts and is no longer a member. Only Stripe can change who signs in. | **new.** Replaces `onlyAnswerer`. The line is held for the build to confirm how Stripe changes an Express account's representative before it ships |
| `dispute.noRefund` | | No refund while it’s open: Stripe has already taken the money back, and a refund on top would pay the family twice. | **new.** In place of the "Refund to the card" item, which is absent from the row's ⋯ while a dispute is open. A team: "…would pay the team twice." |
| `dispute.refunded` | | This payment was refunded on {day}. Tell Stripe that in your answer. | **new.** The block's extra line when the payment was already refunded in full; the book does not change |
| `dispute.won` | (pill and line) | Won {day}. The money is back in the club’s Stripe balance. | **new.** The block after a win (the heading becomes "Dispute won"; nothing for anyone to do) |
| `dispute.lost` | (pill and line) | Lost {day}. The bank took back receipt {receiptNo}. It’s out of the season’s book, and {owesAgain}. | **new.** Heading "Dispute lost"; amber pill "Owing again". A team: "…and {teamName} owes {owes} again." |
| `dispute.siblings` | | This is one payment for {childList}. The dispute is on the whole payment. | **new.** When the payment covered two or more children; each child's cell carries the chip. A lost dispute returns every share |
| `dispute.againAfterOther` | | {childFirst} paid again another way after the dispute was lost. If this dispute is now won, {childFirst} has paid twice. | **new.** The drawing's "lost, collected another way, then turned to won" edge. Opens the paid-twice item (§2.3) |

**The cardholder's reason** (Stripe's reason, mapped by the build against Stripe's current list; **anything it cannot map
prints no reason**, and the sentence ends after the date):

| Stripe says | `{whyFull}` (after a colon) | `{whyShort}` |
|---|---|---|
| the cardholder doesn’t recognise or didn’t make the payment (fraud, unrecognized) | : the cardholder says they didn’t make this payment | didn’t make it |
| charged twice (duplicate) | : the cardholder says they were charged twice | charged twice |
| a refund never arrived (credit not processed) | : the cardholder says a refund never arrived | refund never arrived |
| did not get what they paid for (product not received) | : the cardholder says they didn’t get what they paid for | not received |
| what they got wasn’t as described (product unacceptable) | : the cardholder says it wasn’t as described | not as described |
| anything else, or no reason given | (nothing) | (nothing) |

"Recognise" in the first row is the mapping's description only; the screen says "didn’t make this payment". The words above
never say "fraud" to a club, which would read as an accusation of the family.

### 1.3 "Copy the facts": the text it puts on the clipboard

This is the one string in this file the club pastes into Stripe, where a bank reads it. It is written in plain statements
of fact, in the club's voice, and every line is dropped when its fact is missing (nothing is guessed or padded). Nothing is
submitted from the product (ask 13).

```
Disputed payment: receipt {receiptNo}, {amount}, paid {day} by card{cardEnding}.
Paid by {guardianName}{payerEmailInBrackets}.
For: {childName}, {divisionName}, {seasonName} with {clubName}.
Registered {signupDay} by {guardianName}.
The payer entered the card on Stripe’s secure payment page.
Refund policy shown beside Pay: “{refundPolicy}”
Receipt {receiptNo} was emailed to {payerEmail} on {day}.
Contact: {clubName}, {contactEmail}.
```

A team's version: "For: {teamName}’s {scope} for {tournamentName}." and "Registered {day} by {contactName}." Test mode adds a
first line "Test mode: no money moved." The child's name travels to the bank in this text; the build may drop it if counsel
asks (not a word choice).

### 1.4 Needs attention (each clears itself; no Done anywhere in this set)

| key | words | where / who |
|---|---|---|
| `attention.dispute.title` | {childPossessive} card payment is disputed | **new.** To the answerer. Siblings: "A card payment for {childList} is disputed". A team: "{teamNamePossessive} card payment is disputed" |
| `attention.dispute.body` | {guardianPossessive} bank is disputing receipt {receiptNo} ({amount}){whyFull}. Stripe has taken {held} from the club’s Stripe balance until the bank decides. Answer in Stripe by {due}. | **new.** The answerer's copy. Inquiry: "…is asking about receipt {receiptNo}{whyFull}. Nothing has been taken. Answering can stop it becoming a dispute. Answer in Stripe by {due}." |
| `attention.dispute.button.answer` | Answer in Stripe | **new.** The answerer's item only, first |
| `attention.dispute.button.record` | Open {childPossessive} record | **new.** Every copy. A team: "Open the team". Siblings: "Open the registrations" |
| `attention.dispute.titleOthers` | {childPossessive} card payment is disputed | **new.** Same title, info colour, for the rest of the desk |
| `attention.dispute.bodyOthers` | {guardianPossessive} bank is disputing receipt {receiptNo} ({amount}). {answererName} answers it in Stripe by {due}. If the club wins, nothing changes here. | **new.** Inquiry: "…is asking about receipt…{answererName} answers it in Stripe by {due}." |
| `attention.dispute.settled.won` | The club won the dispute. | **new.** Settled line when the item clears. Also for a withdrawn dispute |
| `attention.dispute.settled.answered` | Answered in Stripe. The bank decides. | **new.** The item clears when the answer is sent, for the answerer; the other copies stay until the outcome |
| `attention.dispute.lostTitle` | {childPossessive} dispute was lost | **new.** To the desk and the owner, amber. Siblings: "The dispute for {childList} was lost". A team: "{teamNamePossessive} dispute was lost" |
| `attention.dispute.lostBody` | The bank took back receipt {receiptNo} on {day}. It’s out of the season’s book, and {owesAgain}. We haven’t emailed the family. | **new.** A team: "…and {teamName} owes {owes} again. We haven’t emailed the team." |
| `attention.dispute.lostButton` | Open {childPossessive} record | **new.** No Done (review table): the item clears itself when the child is paid or excused. Settled lines reuse `SETTLED_WORDS.paidInFull` "Paid in full." and `SETTLED_WORDS.withdrawDone` "The registration has ended." |
| `kind.dispute.label` | A card payment was disputed | **new.** Notification kind, only if the build makes one |
| `kind.dispute.desc` | A cardholder’s bank is disputing a card payment. Only the person who set up payouts can answer it in Stripe. | **new** |
| `kind.disputeLost.label` | A dispute was lost | **new** |
| `kind.disputeLost.desc` | The bank took back a payment. It’s out of the book and the amount is owing again. | **new** |

### 1.5 Money: the band, the book, and the reminder email's skip

| key | words | where / who |
|---|---|---|
| `band.disputed` | {n} card payment is disputed. Stripe is holding {held} from the club’s balance until the bank decides; it stays in Received until then. | **new.** The note under the Money band while one is open. Plural: "{n} card payments are disputed. Stripe is holding {held} from the club’s balance until the banks decide; they stay in Received until then." The treasurer reads it |
| `money.line.disputeLost` | Dispute lost · receipt {receiptNo} | **new.** The What column of a lost dispute's returned line, out of the book (never by deleting the receipt). On Every line and Still owing; not in Refunds, which is the club's own act. With a reason: "Dispute lost · {whyShort} · receipt {receiptNo}" |
| `money.how.disputeLost` | Taken back by the bank | **new.** The How column |
| `regs.bulk.why.disputeLost` | a dispute was lost | **new.** A skipped reason in `regs.bulk.emailLinkPartial` ("{n} pay links sent; {m} skipped: {why}."). "Email families who owe" leaves that child out until paid or excused, so a family that took its money back through its bank hears from a person, not a reminder |
| `regs.payLink.anyway.title` | Email the pay link anyway? | **new (owner ruling 5, 2026-10-27; /marketing 2026-10-27).** A question window after ONE "Email the pay link" for a family whose card dispute was lost (its own child or a sibling, the server says). Warns, never skips; the bulk send still leaves the family out. The registrar or treasurer |
| `regs.payLink.anyway.body` | The bank took this family’s card payment back, and the club lost the dispute. Email families who owe leaves them out so someone can talk to them first. You can still send the pay link. | **new.** Same window |
| `regs.payLink.anyway.go` | Email the pay link | **new.** Primary button, beside Cancel |
| `team.payLink.anyway.*` | Title and button as above. Body: The bank took this team’s card payment back, and the club lost the dispute. Payment reminders leave the team out so someone can talk to them first. You can still send the pay link. | **new.** The same question on a tournament team’s record (builder’s call: ruling 5’s rule, the team’s side) |

### 1.6 Emails to the person who answers (the owner; FieldLogicHQ's own envelope, not the club's identity)

Sent from FieldLogicHQ to `{answererName}`, the one person who can answer. Dates "Nov 11, 2026". `[Test] ` prefix and "Test
mode: no money moved." last, in test mode. A suspended club's owner cannot open the product, so the first email is that
owner's only notice (frame 4c).

**1 · A dispute opens**

| key | words | notes |
|---|---|---|
| `disputeEmail.subject` | A card payment to {clubName} is disputed | Inquiry: "A bank is asking about a card payment to {clubName}". A team: same subject (the club's name leads) |
| `disputeEmail.preheader` | Answer in Stripe by {dueFull}. | |
| `disputeEmail.lead` | {guardianPossessive} bank is disputing a card payment for {childName} (receipt {receiptNo}, {day}).{whyFullSentence} | `{whyFullSentence}` = " The cardholder says they didn’t make this payment." or empty. A team: "…a card payment for {teamName}…". Inquiry: "{guardianPossessive} bank is asking about a card payment for {childName} (receipt {receiptNo}, {day}).{whyFullSentence} Nothing has been taken." |
| block | Held by Stripe · {held} / Answer by · {dueFull} | The warm envelope's small table. Inquiry: "Held by Stripe · Nothing taken" |
| `disputeEmail.act` | Answer it in Stripe with your evidence. {childPossessive} record has the facts to copy. | A team: "{teamNamePossessive} record has the facts to copy." |
| `disputeEmail.fee` | Stripe charges a fee for a dispute. We pass it on to you {invoiceWhere}; it isn’t a change to your plan. | **new.** Read plainly, not as a penalty. Inquiry: line dropped (an inquiry has no fee) |
| `disputeEmail.button` | Open {childPossessive} record | Button to the record. There is no "Answer in Stripe" button in an email, since Stripe's dashboard needs a fresh sign-in |
| `disputeEmail.noChange` | If the club wins, nothing changes in your books. | |

**2 · Three days before the answer is due** (only while unanswered)

| key | words | notes |
|---|---|---|
| `disputeEmail.reminder.subject` | Answer by {due}: a card dispute for {clubName} | |
| `disputeEmail.reminder.lead` | The dispute on receipt {receiptNo} for {childName} is due to be answered in Stripe on {dueFull}. | |
| `disputeEmail.reminder.after` | If it isn’t answered by then, the bank decides without the club’s side. | The drawing's "it usually ends lost" is dropped: it is a claim about outcomes this file cannot source (Contradictions) |
| `disputeEmail.reminder.button` | Open {childPossessive} record | |

There is **no email when a dispute is won or lost**: the lost item reaches the desk and the owner in the product (§1.4), the
family is never emailed (ask 2), and nothing in the frames draws one.

### 1.7 What the club is invoiced: dispute fees, the returned bank debit fee, the extra fee on a card from outside your country, and the comped club's own invoice

**The rule these words carry.** Every Stripe fee a club causes is the club's, on every plan: a card dispute's two fees, the
returned bank debit fee, and the extra fee on a card issued outside your country. The comped and free exemption in `lib/platform-debit-fee.ts` is removed (12c's `exempt_reason =
'comped'` and `'no_subscription'` stop existing; `'test_mode'` stays). A club with a live subscription is billed on its next
subscription invoice; a club without one (comped, free, cancelled) is sent **an invoice of its own**, which it pays through
Stripe and which platform admin tracks like other payments. What an unpaid one does beyond showing in platform admin was not
ruled, so no word below threatens a consequence.

**The dispute fee sentence on the record (owner only).** Two fee lines, then the "where":

| key | words | where / when |
|---|---|---|
| `dispute.fee.next` | Stripe’s dispute fee, {disputeFee}, goes on your next FieldLogicHQ invoice. | A club with a live subscription |
| `dispute.fee.own` | Stripe’s dispute fee, {disputeFee}, goes on a FieldLogicHQ invoice. Your plan doesn’t change; Stripe’s fees are passed on to every club. | A club with no subscription invoice (comped, free). The second sentence is the comped owner's answer to "is my comp being withdrawn?" |
| `dispute.fee.answer` | Answering adds a second Stripe fee. It comes back if you win. | Before the club answers. **No amount is printed:** Stripe's answering figure is known when it is charged, and an amount typed earlier would be a number this file invented |
| `dispute.fee.answered` | Answering added {answeringFee}. It comes back if you win. | After Stripe charges it |
| `dispute.fee.won` | You won: the {answeringFee} answering fee is taken off your bill. | After a win. For a club whose invoice was already paid: "…is credited to you." (the build decides the mechanism; the sentence is true either way) |
| `dispute.fee.lost` | You lost: {disputeFee} and {answeringFee} are on your bill. | After a loss |
| `dispute.fee.unanswered` | Not answered: only the {disputeFee} dispute fee applies. | After a missed due date |

**Invoice line descriptions** (the text Stripe prints on the invoice; the same on a subscription invoice and an invoice of its
own; dates by `formatStoredDate`, no year inside a line):

| key | words | notes |
|---|---|---|
| `invoice.line.dispute` | Card dispute fee · receipt {receiptNo} · {day} | **new.** The receipt is the club's own number, so the owner can match a line to a payment; no child's name is ever on an invoice |
| `invoice.line.answering` | Card dispute answering fee · receipt {receiptNo} · {day} | **new.** Added when Stripe charges it |
| `invoice.line.answeringReturned` | Card dispute answering fee returned · receipt {receiptNo} · {day} | **new.** The credit line on a win: a negative amount on the club's bill |
| `invoice.line.foreignCard` | Extra fee for a card issued outside your country · receipt {receiptNo} · {day} | **new** (owner ruling 2026-10-27). One line per payment, amount `{foreignCardFee}` from Stripe's own figure at the time, never typed. The family paid the ordinary price and is never told; the club reads what Stripe charged on that payment. Whether Stripe returns this fee when such a payment is refunded is a Stripe fact the build checks; if it does, a credit line `invoice.line.foreignCardReturned` "Extra fee for a card issued outside your country returned · receipt {receiptNo} · {day}" follows the answering-fee-returned shape; if not, there is no such line |
| `invoice.line.returnedDebit` | Returned bank debit · receipt {receiptNo} · {day} | **changes** shipped `RETURNED_DEBIT_FEE_WORDS.invoiceLine` ("Returned bank debit · {day}"), so the three lines on one invoice read in one shape. Optional if the receipt number is not at hand when it is billed; then the shipped words stand and the other two drop the receipt |

**The invoice of its own** (a club with no subscription invoice). Stripe's invoice fields and the email that carries it:

| key | words | notes |
|---|---|---|
| `ownInvoice.memo` | Stripe fees on {clubName}’s online payments. Your plan doesn’t change; Stripe’s fees are passed on to every club. | Stripe's invoice description |
| `ownInvoice.footer` | Questions: {supportEmail}. | Stripe's invoice footer |
| `ownInvoice.email.subject` | Invoice {invoiceNo} from FieldLogicHQ: Stripe fees for {clubName} | **new.** From FieldLogicHQ to the owner. Stripe's own invoice email is switched off for these (§7 question 2) |
| `ownInvoice.email.preheader` | {amount} in Stripe fees on your online payments. Due {dueFull}. | |
| `ownInvoice.email.lead` | Stripe charged FieldLogicHQ {amount} in fees on {clubName}’s online payments, and we pass them on to every club, on every plan. Your plan doesn’t change. | One fee: "Stripe charged FieldLogicHQ a {amount} fee on a payment to {clubName}, and we pass it on…" |
| block | one row per line: {lineDescription} · {amount} (a credit shows "−{amount}") · Total {amount} · Due {dueFull} | The warm envelope's small table |
| `ownInvoice.email.why` | Stripe charges these fees when a card payment is disputed, a bank debit comes back, or a card issued outside your country is used. | **changes** (adds the third reason). The reason, in one sentence; no blame. Lists only the kinds actually on this invoice: "…when a card payment is disputed." / "…when a card issued outside your country is used." / two or three joined with commas and "or" |
| `ownInvoice.email.button` | Pay the invoice | Button to Stripe's hosted invoice page. `ownInvoice.email.secure` "You pay on Stripe’s secure page." under it |
| `ownInvoice.email.questions` | Questions: {supportEmail}. | |
| `ownInvoice.reminder.*` | **Held.** Not ruled. If the owner wants one: subject "Reminder: invoice {invoiceNo} from FieldLogicHQ", lead "Invoice {invoiceNo} for {amount} was due on {dueFull}. You can pay it on Stripe’s secure page.", button "Pay the invoice". Nothing in it says what happens next | §7 question 3 |
| `billing.fees.billed.returned` | Returned {Nov 3} | **new (owner ruling 7, 2026-10-27; /marketing 2026-10-27).** The Plan & billing Stripe fees list’s status line under a returned answering fee given back as a credit note against the invoice that carried the answering fee (lowering it while open, refunded to the card once paid). The club’s only notice: Stripe’s credit-note email is off. A credit that nets with its answering fee on an invoice still to come keeps "On your {Dec 1} invoice" |

---

## 2 · Paid twice (frame 2)

Two halves: stop it at the desk (ask 12) and catch it when it lands anyway (ask 10). House league already refuses a second
payment and raises an item; it only gets a plain label.

### 2.1 Stop it: recording by hand while a pay page is open (ask 12)

The team's record › Payments records in place (no window); the house-league **Mark received** window is the same act on the
family side. Neither is blocked: the desk is warned, and recording closes the open page.

| key | words | where / who |
|---|---|---|
| `payOpen.notice` | {contactName} opened a pay page for {amount} at {time}. Recording this closes it, so the team can’t pay twice. | **new.** Info notice above the "Record the balance" form, the amount and the time of the open page. Whoever runs tournaments, and the treasurer who records. A house-league window: "{guardianName} opened a pay page for {amount} at {time}. Recording this closes it, so the family can’t pay twice." |
| `payOpen.noticeNoName` | The team’s contact opened a pay page for {amount} at {time}. Recording this closes it, so the team can’t pay twice. | **new.** When the contact's name is not on file (the drawing's wording) |
| `payOpen.noticeMany` | {n} pay pages are open for this team. Recording this closes them, so the team can’t pay twice. | **new.** Two or more. House league: "…for {childFirst}. Recording this closes them, so the family can’t pay twice." |
| `payOpen.doneToast` | Recorded {amount} for {teamName}. The open pay page is closed. | **new.** Transient. Plural: "…The open pay pages are closed." |
| `payOpen.partNote` | The team’s pay link still works for the {left} still owing. | **new.** Under the toast, or in the record, when the hand payment was part of what the page asked for. Nothing else changes for the contact |
| (the contact’s side) | | **No new family words.** A contact who returns to the closed page lands on the team's own pay page, which says what it says today ("Paid in full", or the balance still owing). Stripe's bare "expired" page is only seen from an old browser tab |

### 2.2 Catch it: a team payment lands on a team that owes less (ask 10)

The payment is booked (the book says what Stripe says), flagged on the record and as an item, and the refund door is set to
the extra. Whole means the payment landed after the team had already paid in full; part means the team owed less than the
payment.

| key | words | where / who |
|---|---|---|
| `teamRec.twice` | {extra} paid twice | **new.** The pill under "Paid" in the summary, whole: "Paid · $700.00 received of $400.00" then the pill. On a phone the pill wraps to its own line. Replaces `TEAM_RECORD_WORDS.overFee` ("$300.00 over the fee") only when the extra came from an online payment |
| `teamRec.more` | {extra} more than owed | **new.** The pill when only part of the payment was extra (owed $100.00, paid $300.00 by card). The drawing's "$200.00 paid twice" is retired for this case: the team did not pay that $200.00 twice (Contradictions) |
| `teamRow.twiceTag` | Paid after the team had already paid in full. Refund it from ⋯. | **new.** Under the extra payment's row; the row stays "In ledger". The ⋯ glyph is the row's own menu |
| `teamRow.moreTag` | Paid more than the team owed. Refund the extra {extra} from ⋯. | **new.** Part |
| `teamRow.menuKeep` | Keep it as a credit | **new.** In that row's ⋯, with "Refund to the card" and "Record the refund sent another way" (12c). Not offered for a Stripe refund that failed |
| `attention.twice.title` | {teamName} paid {extra} twice | **new.** To whoever runs tournaments and the owner |
| `attention.twice.body` | A card payment of {amount} (receipt {receiptNo}) landed on {day} after the team had already paid in full. The money is in the club’s Stripe balance. Refund it to the card. | **new.** Bank debit rail: "A bank debit of {amount}… Refund it to the bank account." |
| `attention.more.title` | {teamName} paid {extra} more than it owed | **new** |
| `attention.more.body` | A card payment of {amount} (receipt {receiptNo}) landed on {day}, {extra} more than the team owed. The money is in the club’s Stripe balance. Refund the extra {extra} to the card. | **new** |
| `attention.twice.refund` | Refund to the card | **new.** The item's first button; opens the refund window (below). Bank debit: "Refund to the bank account" |
| `attention.twice.open` | Open the team | **new** |
| `attention.twice.settled` | Refunded {extra} to the card | **new.** Settled lines clear the pill and item together: this one; `SETTLED_WORDS.refundRecorded` "Refund recorded"; `attention.twice.settledCredit` "Kept as a credit"; `attention.twice.settledEntry` "The entry was raised, so nothing is extra." (the drawing: "or the entry is raised so nothing is extra") |

**The refund window it opens** is 12c's, already set (`refund.*` in the part-refund words), with these differences only:

| key | words | where / notes |
|---|---|---|
| `refund.twice.allSub` | Paid twice: the team had already paid {howPaid} | **new.** The sub-line of "All of it to the card, {cardLabel}" when the whole payment was extra |
| `refund.twice.prefill` | Paid twice | **new.** The reason field, prefilled and editable, on "Part of it" when only the extra is refunded. The team reads this in the refund email as "{clubPossessive} reason: Paid twice." |
| `refund.more.prefill` | Paid more than the team owed | **new.** The same, for the part case; the window opens on "Part of it" at `{extra}` |
| `refund.twice.feeWhy` | The processing fee comes back too, because the team shouldn’t pay a fee on money it didn’t owe. | **new.** The fee box's why line, ticked by default when the whole payment was extra; unticking stays the refunder's call. A part refund never includes the fee (12c) |
| `keep.title` | Keep {extra} as a credit for {teamName}? | **new.** The window opened by "Keep it as a credit" |
| `keep.body` | {teamName} paid {extra} more than it owed. The club keeps the money, and the team’s record shows it as a credit. Say why. | **new.** The build defines what the credit does; the sentence stays true if it is only a record |
| `keep.reason` / `keep.reasonError` | Reason / Say why the club keeps it. | **new** |
| `keep.button` / `keep.working` | Keep it as a credit / Saving… | **new** |
| `keep.doneToast` | Kept {extra} as a credit for {teamName}. | **new.** Transient |

### 2.3 House league: the item gets a plain label

Only the case where the fee was already marked received changes (12b's `already_received` reason); every other reason keeps
"couldn’t be recorded" and its words.

| key | words | notes |
|---|---|---|
| `attention.unrecorded.titleTwice` | {childPossessive} fee was paid twice | **changes** `LEAGUE_ONLINE_NOTICE_WORDS.unrecordedTitle` for this reason. Bank rail: same title |
| `attention.unrecorded.bodyTwice` | {guardianName} paid by card on {day}, after {childPossessive} fee was already marked received. The money is in the club’s Stripe balance. Refund it to the card. | **changes** `unrecordedBody` for this reason. Bank debit: "paid by bank debit… Refund it to the bank account." No guardian name: "The family paid…" |
| `attention.unrecorded.buttonRefund` | Refund to the card | **new.** First button, opens `refundCard` (shipped); bank debit: "Refund to the bank account". Then "Open {childPossessive} record" (shipped) |

---

## 3 · The payouts list (frame 3)

A **Payouts** tab at the end of the Accounting tab row (Overview · Budget · Ledger · Budget vs. Actual · Payouts), read by
everyone who reads Accounting, so the treasurer matching a bank statement needs neither Stripe nor the owner. A club without
Accounting has the same list collapsed on the owner's Payouts card (Settings). Read only, newest first. Amounts are what
reached the club.

### 3.1 The tab

| key | words | where / who |
|---|---|---|
| `payouts.tab` | Payouts | **new.** The tab label |
| `payouts.dates` | Since {from} | **new.** The shared date field's default label ("Since Sep 1, 2026"); a range reads "{from} to {to}" |
| `payouts.find` | Find an amount, a name or a receipt | **new.** The search field's placeholder. "1284.50" finds the payout of that amount |
| `payouts.dest` | Paid out to the bank account ending {last4} | **new.** The line above the list; test mode adds the Test mode chip (`PAYOUTS_WORDS.testChip`) |
| `payouts.col.sent` / `arrives` / `status` / `amount` | Sent / Arrives / Status / Amount | **new.** The list's columns; on a phone each row reads "{amount} · {arrives or paid day}  {status}" |
| `payouts.status.onItsWay` | On its way | **new.** Info chip |
| `payouts.status.paid` | Paid | **new.** Beside it, quiet: `payouts.counts` "{n} payments, {m} refund" (singular/plural for each; "{n} payments" alone when no refund; "1 payment") |
| `payouts.status.failed` | Didn’t arrive | **new.** See §3.2 |
| `payouts.col.date` / `who` / `what` / `receipt` / `amount` | Date / Who / What / Receipt / Amount | **new.** The opened payout's columns. On a phone: "{day} {who} · {receiptNo} · {amount}" |
| `payouts.what.league` | House league · card | **new.** The What of a family's card payment. Bank debit: "House league · bank debit" |
| `payouts.what.tournament` | {tournamentName} {scope} · card | **new.** A team's payment, `{scope}` "balance", "deposit" or "entry fee" lowercase. Bank debit: "…· bank debit" |
| `payouts.what.refund` | Refund to the card | **new.** A negative row (−$150.00). Bank account: "Refund to the bank account" |
| `payouts.what.disputeTaken` | Dispute | **new.** "{who} · dispute · −{amount}" on the day Stripe took the money |
| `payouts.what.disputeWon` | Dispute won | **new.** "{who} · dispute won · +{amount}" in a later payout |
| `payouts.what.notFromUs` | Not from FieldLogicHQ | **new.** A payment made in Stripe directly. We name what we know and never guess a person |
| `payouts.total` | Paid to the bank account ending {last4} on {day} | **new.** The closing line of an opened payout, with its amount |
| `payouts.note` | Amounts are what reached the club: after the processing fee when the club pays it. | **new.** Under the opened payout |
| `payouts.noManual` | Stripe lists what’s inside automatic payouts only. | **new.** An opened manual payout (one pressed in Stripe) shows this in place of its rows; Stripe's own limit, said plainly |
| `payouts.export` | Export | The page's one Export button (decision_export_is_one_button); one row per payment with its payout's date and amount beside it. Failure: `payouts.exportFailed` "The export didn’t finish. Try again." |
| `payouts.loading` | Loading payouts | The screen's one loading line (`LoadingState` names the screen) |
| `payouts.error` | Stripe didn’t answer. Try again. | **new.** Persistent, with a **Try again** button; nothing stale is shown as current |
| `payouts.empty` | No payouts yet. Stripe sends the first one on its schedule after the first payment. | **new.** Connected, nothing paid out |
| `payouts.emptyNotConnected` | Online payments aren’t set up, so there are no payouts. {ownerOnly} | **new.** Reuses `PAYOUTS_WORDS.ownerOnly(home)` as the second sentence. Not ruled whether the tab hides for a club that never connected; these words work if it shows (Contradictions) |
| `payouts.emptyDates` | No payouts in these dates. | **new** |

### 3.2 A payout that didn't arrive

| key | words | where / who |
|---|---|---|
| `payouts.fail.info` | Didn’t arrive{failReason} · {answererName} fixes it in Stripe | **new.** The treasurer and anyone but the owner: info colour, because the fix is not theirs. Amount beside it |
| `payouts.fail.owner` | Didn’t arrive{failReason} | **new.** The owner (the person who set up payouts): an amber pill that opens Stripe; accessible name `payouts.fail.ownerAria` "Payout didn’t arrive. Fix in Stripe." |
| `payouts.fail.reason` | : the bank account is closed · : the bank account details aren’t valid · (nothing) | **new.** `{failReason}`, mapped by the build from Stripe's failure code; **unmapped prints no reason** |
| `payouts.fail.tip` | It clears itself when Stripe’s next payout to a working account goes through and carries this money. | **new.** Tap-for-detail |

### 3.3 The owner's Payouts card, for a club without Accounting

| key | words | where / who |
|---|---|---|
| `payouts.card.heading` | Payouts to your bank | **new.** A closed disclosure on the card, closed every time the card opens; the same list opens inside it. Disconnect still ends the card's body |
| `payouts.card.summary` | {amount} on its way · last paid {amount} on {day} | **new.** The disclosure's summary line, so a closed card still answers "is money coming?". Only one half when only one is true: "Last paid {amount} on {day}"; none: `payouts.empty` |

### 3.4 One plain line near the rates: other Stripe fees can be billed to the club (owner ruling 2026-10-27; §7 question 7)

The terms TEXT is counsel's. This is the product's own chrome: a single sentence wherever a rate prints, so a club reads it
before it agrees and not only after the first invoice. Held until the owner answers §7 question 7.

| key | words | where / who |
|---|---|---|
| `before.otherFees` | Stripe may charge other fees on your payments, such as for a card dispute, a returned bank debit or a card issued outside your country. FieldLogicHQ passes them on to you on an invoice. | **new, held.** In "Before you set up payouts", directly under the rates in "What it costs" (before the example). The owner who sets up payouts, so also the host of a tournament who may meet a team from another country |
| `record.otherFees` | Other Stripe fees, such as for disputes, returned bank debits and cards issued outside your country, are billed to the club. | **new, held.** On the Payouts card's record, under the rates line and before "Who pays the processing fee". Shorter: the owner has already read the window |
| `record.otherFeesPlan` | Your plan doesn’t change. | **new, held.** Appended to either line for a club that pays nothing for its plan (comped or free), so it is never read as the comp being withdrawn. The same words as the second sentence of `ownInvoice.memo` |

---

## 4 · Leaving: disconnect, downgrade, cancel, delete (frame 4)

**The one rule (ask 4):** stopping online payments never disconnects the club's Stripe account. Pay now stops being offered;
debits already clearing, refunds, and disputes still finish; the owner is told what is outstanding; payouts stay connected,
so moving back up turns online payments on again. **Every ending (disconnect, downgrade on its date, cancel) closes open
pay pages (ask 11), and its window counts them.** Only the owner does any of these.

### 4.1 Disconnect payouts? (changes the shipped window)

| key | words | notes |
|---|---|---|
| `disconnect.title` | Disconnect payouts? | Shipped |
| `disconnect.stops` | Families and teams stop seeing Pay now right away, and pay links already emailed show your “How to pay” text instead. | Shipped (Tournament Plus: "Teams stop…") |
| `disconnect.owing` | {families} and {teams} still owe. They can pay you another way. | **changes** shipped `disconnect.owing`, which counts teams only and so said "No team owes anything right now" beside 23 families still owing. The clauses: "23 families still owe a house-league fee", "1 family still owes a house-league fee", "2 teams still owe a tournament fee", "1 team still owes a tournament fee", joined with ", and ". Only families: "23 families still owe a house-league fee. They can pay you another way." Only teams, on a club: "2 teams still owe a tournament fee. They can pay you another way." |
| `disconnect.owingNone` | Nobody owes anything right now. | **changes** shipped "No team owes anything right now." for the club home. Tournament Plus keeps "No team owes anything right now." |
| `disconnect.owingTournament` | 1 team still owes money; it can pay you another way. · {n} teams still owe money; they can pay you another way. | Shipped, kept for Tournament Plus, where only teams exist |
| `disconnect.pages` | {n} pay pages are open right now. They close when you disconnect. | **new.** Not shown at 0. One: "1 pay page is open right now. It closes when you disconnect." |
| `disconnect.clearing` | {n} bank debits are still clearing. They’ll finish, and their money still reaches you. | Shipped (12c), unchanged; singular `clearingOne` |
| `disconnect.disputes` | 1 card dispute is open. Answer it in Stripe by {due}; Stripe holds its money until the bank decides. | **new.** Not shown at 0. Plural: "{n} card disputes are open. Answer them in Stripe by their due dates; Stripe holds their money until the banks decide." |
| `disconnect.past` | Payments already made stay in your books. Refunds of them are made in Stripe, and your Stripe account stays yours. | **changes** shipped `disconnect.past` (adds the account is the club's) |
| `disconnect.emptyHow` | Your “How to pay” text is empty, so families and teams will see no way to pay. | **new.** Above the list, only when the text is empty. Tournament Plus: "…so teams will see no way to pay." |
| `disconnect.writeNow` | Write it now | **new.** Link in that line, opens the card's How to pay field |
| `disconnect.cancel` / `confirm` | Cancel / Disconnect | Shipped. The confirm is the red destructive button |

### 4.2 Moving to a plan without online payments (the section added under the shipped plan-move text)

Shown only when the club has payouts connected and the plan it is moving to does not include online payments. `{targetPlan}`
is the plan's label, never typed. The shipped paragraph ("{club} moves to {targetPlan} on {dateLong} and can hold up to the
plan's team limit from then. You keep {currentPlan} until then…") is unchanged.

| key | words | notes |
|---|---|---|
| `move.payments.heading` | Online payments stop on {dateLong} | **new.** Section heading |
| `move.payments.stops` | Families and teams see your “How to pay” text instead of Pay now, and any pay pages still open then close. {owe} | **new.** `{owe}` = "23 families and 2 teams still owe today.", "23 families still owe today.", "2 teams still owe today.", or nothing. No count of open pages: they cannot be counted a month ahead |
| `move.payments.finish` | Bank debits still clearing finish and reach you. Refunds and disputes of payments already made keep working here, as now. | **new** |
| `move.payments.connected` | Your payouts stay connected, so moving back up turns online payments on again. | **new** |
| `move.payments.emptyHow` | `disconnect.emptyHow` + `disconnect.writeNow` | Reused above the section, only when empty |

**An ending the owner did not choose** (a comped period ending; a suspension for a failed subscription payment) sends the
owner the same section as a notice and one email seven days before, because the owner clicked nothing:

| key | words | notes |
|---|---|---|
| `ending.notice.title` | Online payments stop on {dateLong} | **new.** A Needs attention item to the owner, and a notice on the Payouts card |
| `ending.notice.body` | {endingSentence} Families and teams will see your “How to pay” text instead of Pay now. {owe} Your payouts stay connected. | **new.** `{endingSentence}` is the billing page's own existing sentence for that ending (for a comp: "Your organization moves to the free {targetPlan} plan on {dateLong}."), reused and not reworded here. For a suspension: "{clubName} will be suspended on {dateLong} unless the subscription payment goes through." |
| `ending.email.subject` | Online payments for {clubName} stop on {dateLong} | **new.** From FieldLogicHQ to the owner, seven days ahead |
| `ending.email.lead` | {endingSentence} | Reused as above |
| `ending.email.body` | From then, families and teams see your “How to pay” text instead of Pay now, and pay pages still open close. {owe} Bank debits still clearing finish and reach you, and your Stripe account stays yours. | **new** |
| `ending.email.button` | Open billing | **new.** Button to Settings › Billing |

### 4.3 Cancel and suspend (the section added under the shipped notice)

The shipped red notice and "Keep {plan} / Cancel and suspend" are unchanged. The section appears only when payouts are
connected:

| key | words | notes |
|---|---|---|
| `cancel.payments.heading` | Online payments stop now | **new** |
| `cancel.payments.stops` | Nobody can pay you online; pay pages still open close. {owe} | **new.** `{owe}` as §4.2, "today" form: "23 families and 2 teams still owe today." The window also counts the open pages: "{n} pay pages are open right now." (`cancel.payments.pages`, **new**, not shown at 0) |
| `cancel.payments.clearing` | {n} bank debits are still clearing. They finish and reach your bank. | **new.** One: "1 bank debit is still clearing. It finishes and reaches your bank." |
| `cancel.payments.stripe` | Your Stripe account stays yours: money in it keeps paying out to your bank. Refunds and the {n} open {disputeWord} are handled in Stripe while you’re suspended. | **new.** `{disputeWord}` = "dispute" / "disputes"; with none open: "…Refunds are handled in Stripe while you’re suspended." While suspended the owner cannot open the product, so the dispute email (§1.6) is the owner's notice |

### 4.4 Ask us to delete

| key | words | notes |
|---|---|---|
| `delete.payments.heading` | Your online payments | **new.** Section heading, only when payouts are connected or were |
| `delete.payments.waiting` | 1 card dispute is open and 2 bank debits are still clearing. We wait for them before deleting. | **new.** Built from the counts; each clause drops at 0; plural forms as above. With neither: omitted |
| `delete.payments.owe` | {owe} Their pay pages close when we disconnect. | **new.** Inferred from ask 11, which names the ending windows; deletion is an ending too, and its window shows the same count (Contradictions) |
| `delete.payments.disconnect` | We disconnect your payouts before deleting. Your Stripe account stays yours, with any money in it. | **new** |
| `delete.payments.export` | Your payment records here are deleted with everything else. Export them first from Accounting. | **new** |

---

## 5 · The payments terms: who agreed, and agreeing again (frame 5)

The agree box, the refusal without it and the stored who, when and version are built. Settings is the owner's, so the
read-out is the owner's too; the platform team reads it on frame 6. The terms' TEXT is counsel's; its slot stays empty here.

### 5.1 The read-out on the Payouts card

| key | words | where / who |
|---|---|---|
| `terms.row.label` | Payments terms | **new.** The card's record row, after "Refund policy" |
| `terms.row.agreed` | Agreed by {name} on {dateLong}, version of {versionDate} · Read the terms | **new.** "Read the terms" is the shipped link (`before.termsLink`) |
| `terms.row.draft` | Agreed by {name} on {dateLong}, to the draft. You’ll be asked again when the final terms are ready. | **new.** Every club that connects before counsel's text exists reads this (the version is the placeholder one) |
| `terms.row.stale` | Agreed by {name} on {dateLong}, version of {versionDate}. There are newer terms to read. · Read and agree | **new.** The owner after a change, before they agree |

### 5.2 The terms changed (ask 6): payments stay on

| key | words | where / who |
|---|---|---|
| `terms.notice.body` | The payments terms changed on {dateLong}. Online payments stay on. Agree to the new terms before you set up payouts again or change who pays the fee. | **new.** A notice on the Payouts card, the owner only |
| `terms.notice.button` | Read and agree | **new.** Opens the window (§5.3) |
| `terms.item.title` | New payments terms to agree to | **new.** The owner's Needs attention item. Owner only |
| `terms.item.body` | FieldLogicHQ’s payments terms changed on {dateLong}. Online payments stay on while you read them. | **new** |
| `terms.item.button` | Read and agree | **new.** The item clears itself when the owner agrees; no Done |
| `terms.item.settled` | Agreed by {name} | **new.** Settled line (the `did()` shape: "You agreed" for the owner) |
| `terms.refuse.fee` | Agree to the new payments terms to change who pays the processing fee. | **new.** Inline above the fee choice's save, with a **Read and agree** link, while the owner has not agreed to the current version |
| `terms.refuse.setup` | Agree to the payments terms first. | Shipped refusal text, unchanged (API and window), also for reconnect |

**The email** (FieldLogicHQ to the owner; the day the terms change, and one reminder 14 days after if still not agreed):

| key | words | notes |
|---|---|---|
| `terms.email.subject` | New payments terms for {clubName} | **new** |
| `terms.email.lead` | FieldLogicHQ’s payments terms changed on {dateLong}. Online payments for {clubName} stay on while you read them. | **new** |
| `terms.email.body` | Please read and agree. You’ll need the new terms to set up payouts again, to reconnect, or to change who pays the processing fee. | **new** |
| `terms.email.button` | Read and agree | **new.** Button to the Payouts card |
| `terms.reminder.subject` | Reminder: new payments terms for {clubName} | **new.** 14 days later, only if not agreed |
| `terms.reminder.lead` | You haven’t agreed to the new payments terms yet. Online payments for {clubName} are still on. | **new.** Then `terms.email.body` and the button |

### 5.3 The window (both windows follow one rule)

| key | words | notes |
|---|---|---|
| `terms.window.title` | The new payments terms | **new.** The set-up window ("Before you set up payouts") keeps its title |
| `terms.window.changedHeading` | What changed | **new.** The body is `{counselSummary}` (counsel's). Empty slot: the section is omitted, not shown blank |
| `terms.window.termsHeading` | The terms | **new.** The body is `{counselTerms}`; until it exists, `TERMS_PLACEHOLDER` shows as today |
| `terms.window.checkbox` | I agree to the FieldLogicHQ payments terms for {clubName}. | Shipped (`before.termsCheckbox`) |
| `terms.window.later` | Not now | **new.** Plain button; leaves the notice and item as they are |
| `terms.window.agree` | Agree | **new.** **Absent until the box is ticked** (absent beats disabled). The set-up window's **Continue to Stripe** follows the same rule: its words are unchanged, its behaviour changes from disabled to absent in the same build |
| `terms.window.working` / `done` | Agreeing… / Agreed. Thank you. | **new.** Transient |

---

## 6 · Platform admin: Online payments (frame 6)

Read only (ask 7). The platform team, answering a club that says "a family paid and it isn't there", and checking each
morning that nothing is stuck. Platform-admin words are internal but still product words: sentence case, house clock,
bare apostrophe for a name ending in s, no "Stripe error" jargon where a plain sentence does. A club that never connected has
no tab. The tab shows after a downgrade or cancel, because that is when its open disputes matter most.

### 6.1 The club's tab

| key | words | where |
|---|---|---|
| `pa.rail` | Online payments | The console rail entry; count = the length of the Health list below |
| `pa.tab` | Online payments | The club record's fifth tab; its count is the club's open items |
| `pa.tile.account` | Account | Tile label. Value: `PAYOUTS_WORDS.pill` ("Taking payments", "Setting up", "Needs attention", "Disconnected"); sub-line `pa.tile.connected` "Connected {day} by {name}" / "Disconnected {day} by {name}" / "Online payments ended {day}: the plan moved to {targetPlan}" / "…: the organization was suspended" |
| `pa.tile.stripeClosed` | Stripe closed this account on {day} | Amber line on the tile |
| `pa.tile.terms` | Terms | Tile label. Value: "Draft" / "Version of {versionDate}" / "Out of date"; sub-line `pa.tile.termsSub` "Agreed {day} · ask again at final" for the draft, "Agreed {day}" otherwise, "Agreed {day} · newer terms exist" when stale |
| `pa.tile.volume` | Last 30 days | Tile label. Value the total; sub-line `pa.tile.volumeSub` "{n} payments · {m} refunds" (singular forms) |
| `pa.tile.clearing` | Clearing | Tile label. Sub-line "{n} bank debits" (the 12c word) |
| `pa.tile.disputes` | Open disputes | Tile label. Sub-line `pa.tile.disputesSub` "{disputeFee} in Stripe’s fees so far" with the real sum, never typed. Tiles link to their panel |
| `pa.panel.disputes` | Open disputes | Panel heading. Columns Payment · Why · Answer by · Held. Row: "Receipt {receiptNo} · {home}" with a **Show the player** link (below); `{home}` "house league" or the tournament's name |
| `pa.panel.messages` | Stripe messages we couldn’t process | Panel heading, shown only when one is failing (the panel is absent, not an empty table). Columns Message · Error · Received · Tries |
| `pa.panel.messagesStopped` | Stopped retrying | A collapsed list under it for messages still failing after 30 days, so the panel never becomes permanent noise |
| `pa.panel.fees` | Fees billed to the club | Panel heading. Columns For · Billed · Date · Fee |
| `pa.fee.for` | Returned bank debit · receipt {receiptNo} · Card dispute · receipt {receiptNo} · Card dispute answering fee · receipt {receiptNo} · Card dispute answering fee returned · receipt {receiptNo} · Extra fee for a card issued outside the club's country · receipt {receiptNo} | The For column, the same words as the invoice lines (§1.7) |
| `pa.fee.billed.next` | On the {month} invoice | A club with a live subscription |
| `pa.fee.billed.own` | Invoice {invoiceNo} · due {day} | Its own invoice, unpaid. Paid: "Invoice {invoiceNo} · paid {day}". Overdue: "Invoice {invoiceNo} · unpaid since {day}" (info colour; nothing switches off by itself) |
| `pa.fee.billed.credit` | Credited | A returned answering fee |
| `pa.fee.billed.test` | Not billed: test mode | The one exemption left |
| `pa.fee.billed.error` | Couldn’t be billed | Amber; the stored billing error is the detail on tap |
| `pa.player.show` | Show the player | The child's name opens only here; the view is logged. Never a card or bank number anywhere |
| `pa.player.logged` | Opening a name is logged. | Under the revealed name, small |
| `pa.test` | Test mode. Nothing here is real money. | The tab says so first, in test mode |
| `pa.empty.none` | Nothing is open. | A connected club with no disputes, clearing debits or fees |

### 6.2 Health › Online payments, every club

| key | words | where |
|---|---|---|
| `pa.health.title` | Online payments | The Health list heading |
| `pa.health.needs` | Needs a look | The list's section heading. Columns Club · What · Since |
| `pa.health.dispute` | 1 open dispute, due {due} | **What.** Plural: "{n} open disputes, first due {due}" |
| `pa.health.disconnected` | Disconnected with 1 dispute open | **What.** Plural: "Disconnected with {n} disputes open" |
| `pa.health.closed` | Stripe closed the account | **What** |
| `pa.health.messages` | 2 Stripe messages failed | **What.** One: "1 Stripe message failed" |
| `pa.health.terms` | Not on the current payments terms | **What.** Joins once counsel's version exists |
| `pa.health.invoice` | An invoice for Stripe fees is unpaid | **What.** An invoice of its own past due. Not ruled as a Health row (§7 question 3); held until then |
| `pa.health.empty` | Nothing needs a look. | The empty state. A row leaves when it clears (the dispute closes, the message is processed, the account reconnects, the invoice is paid) |

---

## H · Help articles the build must change (for `/docs`; in the same build, never before it)

Today's help is true to today's code. The three that say a comped club isn't billed come out when the exemption does:

| where | old | new |
|---|---|---|
| `lib/help-content/house-league.tsx` ~908, the bank-debit article | …it is billed to the club as a *Returned bank debit* line on its next FieldLogicHQ invoice, and a club on a complimentary plan isn't billed. | …it is billed to the club as a *Returned bank debit* line on its next FieldLogicHQ invoice. A club with no subscription invoice, such as a complimentary or free plan, is sent an invoice of its own. Stripe’s fees are passed on to every club on every plan. Cards issued outside your country carry an extra Stripe fee, passed on the same way. |
| `lib/help-content/org.tsx` ~1074, the Payouts article (and its `searchText` ~1063: remove "complimentary plan not billed") | …it is billed to the club as a *Returned bank debit* line on its next FieldLogicHQ invoice, and a club on a complimentary plan isn’t billed. | The same replacement. Add the dispute sentence: *A card dispute costs the club Stripe’s dispute fee, and a second fee if you answer it that Stripe gives back if you win; both go on the same invoice. A payment made with a card issued outside your country costs Stripe more, and that extra fee is billed to the club on the same invoice; the family pays the ordinary price.* `searchText` add: card dispute fee, card issued outside your country, card from another country, foreign card, extra fee, invoice of its own, Stripe fees passed on, every club |
| `lib/help-content/tournaments.tsx` ~1142, the `HelpNote` "Stripe charges a fee when a debit comes back" (and its `searchText` ~985: "comped club not billed" out) | That fee is billed to the club as a *Returned bank debit* line on its next FieldLogicHQ invoice. A club on a complimentary plan isn’t billed for it. | That fee is billed to the club as a *Returned bank debit* line on its next FieldLogicHQ invoice. A club with no subscription invoice is sent an invoice of its own. Stripe’s fees are passed on to every club on every plan. Cards issued outside your country carry an extra Stripe fee, passed on the same way. |

Lines that **change** in articles that already exist:

| where | change |
|---|---|
| `org.tsx` Payouts article, *Disconnect payouts?* | It now counts families and teams who still owe, open pay pages, bank debits clearing and open card disputes, and it closes the pay pages that are open. Replace "says how many bank debits are still clearing" with the full list. *A downgrade or a cancel stops online payments too, and never disconnects your Stripe account.* |
| `org.tsx` Payouts article | Add the read-out: *Payments terms shows who agreed and when. When the terms change you get a notice and an email; online payments stay on, and you agree to the new version before you set up payouts again or change who pays the fee.* |
| `tournaments.tsx` online-payments article and `house-league.tsx` bank-debit article | Add *Paid twice*: a team (or a family) that pays after already paying is booked and flagged, with a refund door; recording a payment by hand closes any pay page that is open. |
| `tournaments.tsx`, `house-league.tsx` | Refund articles: *There is no refund on a payment while a dispute on it is open.* |
| `searchText` / keywords | add: dispute, disputed, chargeback, answer in Stripe, copy the facts, paid twice, paid more than owed, keep it as a credit, payouts tab, payout didn’t arrive, payments terms, read and agree |

New articles (their words are in §1 to §6; `/docs` writes the prose):

- **A card payment is disputed** (house league and tournaments): what Disputed means on a row, who can answer (only the
  person who set up payouts), the due date, Answer in Stripe, Copy the facts, what a win and a loss do to the book, why no
  refund is offered, why the family is not emailed, the fees (§1.7).
- **Payouts** (Accounting): the tab, matching a bank line, a payout that didn't arrive, a manual payout's limit, Export.
- **Leaving** (Settings › Billing and Payouts): disconnect, downgrade, cancel and delete, and the rule that none of them
  disconnects your Stripe account.

Found while reading, not this round's: the Business Decisions Log's handoff asks `/marketing` to check that no Founding
Season surface sold the comp as covering payment fees. A search of `app/`, `components/`, `lib/` and `docs/agents/brand/` for
"founding" next to "processing fee", "payment fee", "Stripe fee" and "online payment" found none. The comp reads as the
subscription only everywhere it is sold; no surface needs correcting.

---

## D · Decisions

1. **"Disputed" is the one word on a row** (chip), "dispute" the noun, "dispute fee" the Stripe charge. The cardholder is
   "the cardholder"; the word "fraud" is never printed, since a club reads it as an accusation of a family.
2. **Nothing is sent to a family** (ask 2), and the lost item says so: "We haven’t emailed the family."
3. **Amber is for the person who can act.** The answerer's chip, button and date are amber/active; everyone else reads the
   same facts in the info colour with the answerer's name. A lost dispute is amber for the desk (it has something to
   collect). A payout that didn't arrive is amber for the owner and info for the treasurer.
4. **One Copy.** "Copy the facts" sits beside "Answer in Stripe" (ask 13) and does one thing. Nothing is submitted.
5. **No Stripe amount is typed.** The answering fee's amount is printed only once Stripe has charged it.
6. **Stripe's fees are the club's on every plan, said plainly.** Wherever it is said the sentence also says the plan does
   not change, so a comped owner never reads it as the comp being withdrawn.
7. **A dispute's reason is the cardholder's, mapped, or nothing.** The sentence ends after the date rather than guessing.
8. **Paid twice and paid more than owed are different sentences.** The first when the whole payment was extra, the second
   when only part was. "Paid twice" is never used for a team that simply owed less.
9. **The desk is warned, not blocked** (ask 12): recording closes the open page, the contact lands on the pay page as it
   stands, and the link still works for what is left.
10. **No ending disconnects** (ask 4), and every ending's window counts what is outstanding (ask 11).
11. **Absent beats disabled, in both terms windows** (ask 6).
12. **Platform admin shows what a person can do nothing about as information.** Read only; nothing in it writes.

## C · Contradictions with the drawing (each is handled above; listed for the walk)

- **"Copy the facts for Stripe"** (the drawing's button) against the ruling's "Copy the facts": the button reads **Copy the
  facts**; the longer words are its accessible name (§1.2).
- **"Answering adds $15.00, which comes back if you win"** (the record block): retired. Ask 1 says the amount is Stripe's own
  figure at the time, so no amount is printed until Stripe charges it (`dispute.fee.answer`).
- **"The fee line: $15.00 goes on your next FieldLogicHQ invoice"**: a comped club has no next invoice, so the line splits
  into `dispute.fee.next` and `dispute.fee.own` (the 2026-10-27 ruling).
- **"Lost dispute, receipt 1041 returned to the card"**: retired. A card dispute is the bank taking money back, not a refund
  to a card, so "returned to the card" reads as a refund. Now "Taken back by the bank {day} · receipt {receiptNo}", the shape
  of 12c's reversed line.
- **"…Stripe sends it to the bank without the club's side; it usually ends lost."** and the reminder's "usually ends lost":
  the outcome claim is dropped (not sourced); the words say the bank decides without the club's side.
- **"$200.00 paid twice"** (part overpayment): a team that owed $100.00 and paid $300.00 did not pay $200.00 twice; it paid
  $200.00 more than it owed. Two pills (`teamRec.twice`, `teamRec.more`).
- **The drawing's "Paid · $700.00 received of $400.00"** is not the shipped summary: the code prints "Paid {amount}" with
  "{amount} over the fee" (`TEAM_RECORD_WORDS.paidAmount`, `overFee`). The new pill replaces `overFee` only when the extra
  came from an online payment; a hand-recorded overage keeps "over the fee".
- **Ask 12 is drawn for the team's record only.** The ruling says "recording a payment by hand while a pay page is open"
  without limiting it, and the code path (`Mark received`) is the same act on the family side, so §2.1 words both.
- **Ask 11 names disconnect, downgrade, cancel.** The deletion frame (4d) carries the counts too; `delete.payments.owe` is
  inferred from it, and deletion already disconnects first.
- **The downgrade window cannot count open pay pages** (the move can be a month away); it counts who owes and says pages
  open on the day close (ask 11, honoured in kind).
- **The disconnect window's "No team owes anything right now" beside families still owing** is the shipped bug the frame
  fixes; the owing sentence is rebuilt, and Tournament Plus (teams only) keeps its shipped words.
- **The plan's CA$5 returned-debit rule changes.** §0k answer 2 (comped clubs exempt) is superseded by ask 1's widening;
  `invoice.line.returnedDebit` and the three help articles change with it. The 12c copy file's mention that a comped club
  is not billed (help only) falls with them.
- **D2 and ask 9 are superseded by the owner's ruling of 2026-10-27.** Ask 9's option (b) charged the family more for a
  foreign card (a surcharge, gated on Stripe and counsel); the ruling instead bills the club for Stripe's extra cost on that
  card, as one more invoice line, and the family is never charged more. So there is **no** pay-button note, no card-origin
  line, no surcharge and no family word. D2's "(a) Cards from outside Canada: 4 this month" Health count is not worded (the
  Fees-billed panel shows the lines). The plan's ask 9 text and the Business Decisions Log entry of 2026-10-26 (GST/HST and
  foreign cards) still say "charge more for a foreign card": `/strategy` needs to record the 2026-10-27 supersession.
- **Not ruled, so held:** whether the Payouts tab hides for a club that never connected; whether an unpaid own invoice
  gets a reminder or a Health row; whether a lost dispute also gives the club its FieldLogicHQ fee back (the drawing's own
  build check: does Stripe take the whole payment, our fee included, from the club?); whether a refunded payment returns the
  extra fee on a card from outside Canada. The words stay true under either
  answer.
- **Cannot be honoured as drawn:** ask 1's "the answering fee Stripe returns on a win comes off the club's bill" has no bill
  to come off when the club's own invoice was already paid. `dispute.fee.won` says "taken off your bill" and the build adds
  "…or credited to you" for that case; the mechanism (a credit note or a credit on the next invoice) is the build's call,
  and `/billing` should confirm it.

## 7 · Word questions for the owner: RULED 2026-10-27

> **⚖ Owner 2026-10-27: all as recommended, except 7's wording.** For 7 (yes, both lines), say **"a card issued outside
> your country"**, not "outside Canada" ("we may have club owners from the US"). That wording applies everywhere a club
> reads the foreign-card cost: invoice lines, the own-invoice email, `before.otherFees`, `record.otherFees` and the three
> help rows. Platform admin's `pa.fee.for` reads "outside the club's country". So:
> 1 "credited to your account" everywhere · 2 our email, Stripe's own invoice email off for these invoices · 3 one
> reminder email plus a Health row · 4 "fraud" never printed · 5 a note only: the button reads "Keep it" and the body is
> "The club keeps the money. Say why." · 6 the Payouts tab is hidden for a club that never connected · 7 both lines, as
> above. `before.otherFees` and `record.otherFees` are no longer "held".
> **Two held items, ruled the same day as recommended:** a lost dispute does **not** return FieldLogicHQ's processing fee
> (the same rule as every refund, §0c); a refunded payment made with a card from outside the club's country leaves Stripe's
> extra fee the club's (Stripe does not return its fees on a refund; the build confirms, and if Stripe ever does, the
> credit line in §1.7 applies).

Each had a recommendation. None reopens a ruling.

1. **How does a won dispute's returned fee read when the club's own invoice is already paid?** Ask 1 says it "comes off the
   bill", and a paid invoice has nothing to come off. **Recommendation:** the record says "is credited to you" for that
   club and "taken off your bill" for a club still on an open invoice; the invoice line reads the same either way
   ("answering fee returned"). If the owner prefers one sentence everywhere, "is credited to your account" fits both.
2. **Whose email carries a comped club's own invoice: ours or Stripe's?** Stripe can send an invoice email itself.
   **Recommendation:** ours (`ownInvoice.email.*`), with Stripe's switched off for these invoices. A bare Stripe invoice for
   a small fee from a company a comped owner has barely heard of reads as a stranger's bill; ours says why it exists and that
   the plan doesn't change. If the owner would rather not maintain a second email, Stripe's own invoice with our memo and
   footer (`ownInvoice.memo`, `ownInvoice.footer`) is the fallback.
3. **Does an unpaid own invoice get a reminder email and a Health row?** Not ruled; the log says "nothing switches off by
   itself". **Recommendation:** one plain reminder (drafted, held) and a Health row (`pa.health.invoice`), so an unpaid fee
   is visible without a consequence being invented. Say no and both are deleted from the build.
4. **Does the dispute email, or the item, ever name the family's reason as "fraud"?** **Recommendation:** never; the
   cardholder "says they didn’t make this payment", as drawn.
5. **Where does a team that paid past its entry see the credit, if the club keeps it?** The words say "the team’s record
   shows it as a credit" (`keep.body`). **Recommendation:** keep the sentence only if the build gives the credit a place on the
   team's record; if it is a note only, the button reads "Keep it" and the body says "The club keeps the money. Say why."
6. **Should the Payouts tab show for a club that has never connected payouts?** Not ruled. **Recommendation:** hide it, since
   an empty tab teaches nothing and the owner's Payouts card already says online payments aren't set up. The
   `payouts.emptyNotConnected` words exist if the owner wants it visible.
7. **Should the product’s own chrome near the rates say that other Stripe costs may be billed to the club?** The owner’s ruling wants the terms to explain it; the terms text is counsel’s and is not written here. The question is whether the product also carries one plain sentence where a rate prints: in “Before you set up payouts” under “What it costs” (`before.otherFees`), and shorter on the Payouts card’s record (`record.otherFees`, §3.4). **Recommendation: yes, both.** A club that reads two rates and nothing else meets a dispute or a foreign-card line as a surprise, and a Tournament Plus host who invites a team from another country has the most to lose from not knowing; the sentence names the three costs and does not replace counsel’s text. If the owner would rather rely on the terms alone, the cheapest cut is the card’s line, keeping the set-up window’s.
