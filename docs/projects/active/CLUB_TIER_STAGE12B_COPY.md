# Club Tier Stage 12b: the words (a family pays house-league fees by card, refunds in full and in part)

> Written by `/marketing`, 2026-10-25. Scope: the "words through /marketing" gaps in `CLUB_TIER_STAGE12B_BUILD_PROMPT.md`
> ("Before any code", step 2). Inputs: plan §0b–§0e; the 12b House league (b1–b6), Checkout (k1–k3) and Books & refunds
> (m1–m3) tabs of `CLUB_TIER_STAGE12_DRAWINGS.html` (the drawings' strings were the draft; every departure is in the last
> section); today's words in `components/league/RegisterForm.tsx`, the status page's `StatusLookupForm.tsx`,
> `lib/email.ts` (`payBlock`, `acceptedPay`), `lib/house-league-money-words.ts` and the shipped 12a words in
> `lib/online-payment-words.ts`. **12b is card only**: nothing here mentions bank debit or "Processing" (12c).

## How to read this

- The conventions of `CLUB_TIER_STAGE12A_COPY.md` "How to read this" apply unchanged: `key` → string tables, typographic
  `’`, `{tokens}` filled at runtime, **no rate and no computed fee typed anywhere** (`{cardRate}` from
  `lib/plan-config.ts`), money the house way, "Oct 24" dates (year only on a receipt), `formatTime()` for a clock,
  `possessive()` for every possessive (`{childPossessive}`, never `{childName}’s`).
- **Reused, not rewritten:** 12a §8's opening, confirming, not-finished and refund-policy strings; §13–§14's receipt
  shape; §17's refund-email lines; §18's refusals (with "team" → the child, below). Where a 12a key is reused it is named.
- **§20's eight held labels ship in 12b** on League and Club exactly as that table writes them. Tournament Plus keeps
  every 12a word. Section 9 adds the four record/edit hints §20 didn't list (same setting, same swap).
- A family-facing screen says "the secure payment page" and "the card", never "Stripe" except on Stripe's own page.
  Admin-facing copy names Stripe.
- **The payments terms are counsel's:** `[PAYMENTS TERMS — counsel to write]` wherever they would appear. No legal
  sentence, no surcharge disclosure.
- **When the club is not taking payments, every family surface keeps today's words verbatim and draws no button** (A6).
  The disabled "Pay now" and its tooltip go in every state.

### Token glossary (new to 12b)

`{childName}` (first and last) · `{childFirst}` · `{childPossessive}` · `{childList}` (first names joined "Ava and
Henry", "Ava, Henry and Zoe") · `{divisionName}` · `{seasonName}` ("2026 Season") · `{fee}` (the registration fee, the
child's price) · `{owing}` · `{base}` (the sum being paid, before any processing fee) · `{procFee}` (the processing
fee) · `{total}` · `{refundAmount}` · `{rest}` (what the club keeps after a partial refund) · `{diff}` · `{diffTotal}`
(the difference plus its processing fee) · `{from}` / `{to}` (prices) · `{guardianName}` · `{guardianEmail}` ·
`{reference}` · `{reason}` · `{note}` · `{n}` / `{m}` (counts) · `{why}` (a skip reason) · plus 12a's `{brand}`,
`{last4}`, `{receiptNo}`, `{date}`, `{paidAt}`, `{clubName}`, `{contactEmail}`, `{howToPay}`.

---

## 1 · The family pay block (sign-up confirmation and status page)

One block per sign-up (b1 note): every child of the sign-up is listed, and one button pays everything owing. The same
component as the team pay block (plan §0e d); only the "what you are paying for" lines differ. In the club's theme.

| key | string | note |
|---|---|---|
| **Owing** | | |
| `famPay.heading` | To pay now | |
| `famPay.lineChild` | {childName} · {divisionName} · {owing} | One line per child with something owing |
| `famPay.lineChildPart` | {childName} · {divisionName} · {owing} left of {fee} | A part payment was received by hand |
| `famPay.lineWaitlisted` | {childName} is on the waitlist. Nothing to pay unless a spot opens. | Inside the block, under the owing lines, no amount (k1 drew "$0.00"; departure 2) |
| `famPay.linePending` | {childName} is waiting for the club to review. Nothing to pay yet. | |
| `famPay.linePaid` | {childName} · {divisionName} · paid | A paid sibling, so the family sees the whole sign-up |
| `famPay.button` | Pay {total} by card | 12a `payBlock.button`; the label is the amount, always |
| `famPay.buttonFeeNote` | includes a {procFee} processing fee | 12a `payBlock.buttonFeeNote`; only while families pay the fee (A14) |
| `famPay.refundPolicyLink` | Refund policy | 12a; absent when the club wrote none |
| `famPay.otherWays` | Or pay another way: {howToPay} | 12a; nothing added when the club wrote no "How to pay" text |
| **Opening · Confirming · Not finished** | | 12a `payBlock.opening`, `payBlock.confirming*`, `payBlock.notFinished*` verbatim. The confirming state never says "Paid" on the redirect alone |
| **Paid** (everything owing is paid) | | |
| `famPay.paidTitle` | Everything is paid. Thank you. | Today's status-page sentence, kept |
| `famPay.paidLine` | {brand} •••• {last4} · {date} · receipt {receiptNo} | Only for a payment made online; a by-hand payment shows no line (the family never sees how it was recorded, b1) |
| `famPay.paidLink` | View receipt | |
| **No longer payable** (b5) | | |
| `famPay.endedTitle` | Nothing to pay | |
| `famPay.endedWithdrawn` | {childPossessive} registration was withdrawn on {date}, so there is nothing to pay. | |
| `famPay.endedDeclined` | {childPossessive} registration wasn’t accepted, so there is nothing to pay. | |
| `famPay.endedQuestions` | Questions go to {clubName}: {contactEmail}. | "Questions go to {clubName}." without a contact |
| `famPay.endedReference` | Reference {reference} | |
| **Not taking payments** = today's words verbatim, no button | | |
| `famPay.notTakingHeading` | To pay | Today's label |
| `famPay.notTakingKids` | {childFirst} · {fee}; … | Today's per-child line on the sign-up confirmation (two or more children) |
| `famPay.notTakingStatusKids` | {childName} · {divisionName}; … | Today's status-page line, with "{names} is paid." / "are paid." after it |
| `famPay.notTakingHow` | How to pay: {howToPay} | Today's line |
| `famPay.notTakingFoot` | Payable separately to {clubName}. | Today's line |
| `famPay.notTakingPending` | Nothing to pay yet | Today's confirmation heading and sentence, unchanged |

Card failures happen on Stripe's page, where the family stays and tries another card. If they leave, the block shows
"Payment not finished" (12a). The plan's "failed" state is the bank-debit return, which is 12c (departure 3).

## 2 · The status page: each child's line

Under each child's name and division, today's status line stays. The fee line becomes:

| key | string | note |
|---|---|---|
| `status.childOwing` | Fee {fee} · owing | |
| `status.childPart` | Fee {fee} · {owing} owing | |
| `status.childPaid` | Fee {fee} · paid {date} | Paid by card or by hand alike (b1: the family never sees how it was recorded) |
| `status.childReceipt` | View receipt | Only beside a payment made online |
| `status.childRefunded` | {refundAmount} refunded {date} | After a refund, either kind |

## 3 · The sign-up, approval and promotion emails: Pay now

Every headline, greeting and sentence in the three emails stays as today (12a departure 8 again). Only the "To pay" panel
changes, and only while the club is taking payments.

| key | string | note |
|---|---|---|
| `mail.payTotal` | To pay: {owing}. | Today's line |
| `mail.payButton` | Pay now | The primary button, inside the panel. Opens the status page through the pay link |
| `mail.payLine` | Pay online by card, or pay another way below. | Under the total, while the club wrote "How to pay" text |
| `mail.payLineOnly` | Pay online by card. | Without it |
| `mail.feeShown` | The processing fee is shown before you pay. | Only while families pay the fee (b2) |
| `mail.otherWaysLabel` | Other ways to pay | Above the club's `{howToPay}`, verbatim |
| `mail.notTaking` | (today's panel, verbatim) | "To pay: …", the club's text or "{clubName} will tell you how to pay.", "Payable separately to {clubName}." |

"Payable separately to {clubName}." is dropped when the club is taking payments: next to a Pay button it reads as "not
here". The waitlisted email keeps "You pay nothing unless a spot opens." with no button.

## 4 · The pay-link email ("Email the pay link")

Sent by the convenor from a row or the bulk bar, and by a price raise (§6.2). Needs no news consent (b3): it is about
money the family owes.

| key | string | note |
|---|---|---|
| `linkEmail.subject` | Pay for {childList} in {seasonName} | |
| `linkEmail.body` | {clubName} sent you a link to pay for {childList} in {seasonName}. | |
| `linkEmail.bodyRaised` | {childPossessive} price for {seasonName} changed from {from} to {to}. {diff} is left to pay. | After a price raise, in place of the line above |
| `linkEmail.amount` | Amount due: {owing} | No processing fee (the pay page shows it) |
| `linkEmail.button` | Pay now | |
| `linkEmail.otherWays` | Or pay another way: {howToPay} | |
| `linkEmail.reference` | Reference {reference} | |

## 5 · The convenor's rows, menus and the family record

The row's existing "Last received {day} · {how}" already prints "Online, card" for a card payment, so the Fee column needs
only the receipt and the link trace.

| key | string | note |
|---|---|---|
| `regs.fee.receipt` | receipt {receiptNo} | After "Last received Oct 24 · Online, card" |
| `regs.fee.linkSent` | Pay link sent {date} | On an owing row, under "owing" |
| `regs.menu.emailLink` | Email the pay link | Owing rows only, while taking payments |
| `regs.menu.emailLinkHint` | Opens their status page to pay by card | |
| `regs.menu.emailLinkHintSent` | Last sent {date} | Replaces the hint once one was sent |
| `regs.menu.view` | View the payment | On a row with a card payment |
| `regs.menu.correctHintCard` | Settles any difference on the card | Replaces "Needs a reason" on a card-paid row |
| `regs.menu.withdrawHintCard` | Refunds to the card first | On a card-paid row |
| `regs.linkSentToast` | Pay link sent to {guardianEmail}. | 12a shape |
| `regs.linkFailedToast` | Couldn’t send the pay link. Try again. | 12a |
| `regs.bulk.emailLink` | Email the pay link | Bulk bar |
| `regs.bulk.emailLinkDone` | {n} pay links sent. | One per family, not per child |
| `regs.bulk.emailLinkPartial` | {n} pay links sent; {m} skipped: {why}. | `{why}`: "nothing owing", "no email" |
| `regs.undoCard` | A card payment comes off only by a refund. Use Withdraw or Correct the price. | If Undo is reached on a card line; the item is not offered there |
| `payView.title` | Payment {receiptNo} | 12a |
| `payView.base` | Registration fee | Replaces 12a's "Entry fee" |
| `payView.feeFamily` | Processing fee, paid by the family | |
| `payView.feeClub` | Processing fee, paid by the club | 12a |
| `payView.siblings` | Paid together with {childList} | When one payment covered more than one child |
| `families.paidOnline` | Paid online {date} · card · receipt {receiptNo} | Families › a child's money line (b4) |
| `families.paidByHand` | Received by hand {date} · {how} | The same line for Mark received / Record a payment |

The processing fee is never shown as dues on Families (b4).

## 6 · Refunds

### 6.1 The ending window (Decline, Withdraw) on a card-paid child

The mode answers A2's "who is ending this?": **Decline** is the club ending it (the fee box on), **Withdraw** is the
family leaving (off). So 12a's "Who is ending this?" question is not drawn here (departure 5). Release the spot only ever
applies to an unpaid child.

| key | string | note |
|---|---|---|
| `end.cardFull` | Refund to the card, {brand} •••• {last4} | The first choice. Sub-line: "Arrives in 5 to 10 business days" (12a `refund.arrives`) |
| `end.cardPart` | Refund part of it | |
| `end.cardPartSub` | An amount up to {base}, with a reason | `{base}` = what the card paid for this child |
| `end.cardPartAmount` | Amount to refund | |
| `end.cardPartReason` | Reason | Required. Hint: "The family reads this in their email." (today's `keptReasonHint`) |
| `end.cardPartRest` | The club keeps {rest}. | Live under the amount |
| `end.kept` | Kept by the club | Today's choice and sub-line, unchanged |
| `end.feeBox` | Include the {procFee} processing fee · {total} back | 12a `feeCheckbox`. **Only with "Refund to the card"** (plan §0e) and only while families pay the fee |
| `end.feeOnWhy` | On because the club is ending it. The {procFee} comes from the club and shows in your books as Payment processing. | Decline's default |
| `end.feeOffWhy` | {base} back. Off because the family asked to leave; you can include it. | Withdraw's default |
| `end.feeOnChanged` | The {procFee} comes from the club and shows in your books as Payment processing. | Ticked on a Withdraw |
| `end.submitDeclined` | Decline, refund and email | |
| `end.submitWithdrawn` | Withdraw, refund and email | A card refund always emails the family, even on a Withdraw |
| `end.working` | Refunding… | |
| `end.doneDeclined` | Declined {childName}. Refunded {refundAmount} to the card; we emailed {guardianEmail}. | Transient |
| `end.doneWithdrawn` | Withdrew {childName}. Refunded {refundAmount} to the card; we emailed {guardianEmail}. | |
| `end.failed` | The refund didn’t go through, so nothing was changed. Try again. | Inline, persistent. Stripe refused at once: the registration is not ended |
| `end.hintCard` | The family is emailed that {childName} was {declinedOrWithdrawn} and that {refundAmount} is on its way back to the card. | Replaces today's `hintRefunded` for a card refund. `{declinedOrWithdrawn}` = "not accepted" / "withdrawn" |
| `end.footCard` | The {fee} stays in the season’s book with the refund beside it. | Today's `footRefunded` shape |

### 6.2 Correct the price after a card payment (b6)

| key | string | note |
|---|---|---|
| `price.lowerCard` | {childPossessive} family paid {fee} by card. {diff} goes back to them. | Replaces `hintLower` on a card-paid child |
| `price.lowerCardChoice` | Refund {diff} to the card | Pre-selected. Sub-line: "Arrives in 5 to 10 business days" |
| `price.lowerOtherChoice` | Refunded another way | Today's date and "How" fields |
| `price.lowerFeeNote` | The {procFee} processing fee they paid isn’t recalculated. | Only while families pay the fee |
| `price.submitLowerCard` | Save and refund | |
| `price.higherCard` | {childPossessive} family will owe {diff} more. We’ll email them a pay link for it. | A raise, while taking payments |
| `price.higherCardFee` | {diffTotal} by card, with the processing fee. | Only while families pay the fee |
| `price.submitHigherCard` | Save and email | |
| `price.doneLowerCard` | Price saved. Refunded {diff} to the card; we emailed {guardianEmail}. | |
| `price.doneHigherCard` | Price saved. Pay link sent to {guardianEmail}. | |

### 6.3 The refund email (house league)

One email per act. An ending sends today's ending email with the refund lines in it, never a second email.
A price correction sends this email alone.

| key | string | note |
|---|---|---|
| `refundEmail.subject` | Refund from {clubName} | 12a; `[Test] ` prefix in test mode |
| `refundEmail.lead` | {childPossessive} registration fee for {seasonName} was refunded. | Full refund |
| `refundEmail.leadPart` | {refundAmount} of {childPossessive} registration fee for {seasonName} was refunded. | Partial refund or a price correction |
| `refundEmail.amount` | {refundAmount} refunded to {brand} •••• {last4} on {date}. It takes 5 to 10 business days to appear. | 12a |
| `refundEmail.feeIncluded` | This includes the {procFee} processing fee. | 12a |
| `refundEmail.feeKept` | The {procFee} processing fee isn’t part of this refund. | 12a; only while families paid the fee |
| `refundEmail.reason` | {clubPossessive} reason: {reason} | A partial refund's reason |
| `refundEmail.priceChanged` | The price changed from {from} to {to}. | A price correction |
| `refundEmail.note` | {note} | The convenor's note, verbatim |
| `refundEmail.questions` | Questions: {contactEmail}. | 12a |

## 7 · Needs attention (two items, both self-clearing)

The owner, club admin, league admin, registrar and treasurer receive both (A13, house-league variant).

### A card payment couldn't be recorded

| key | string | note |
|---|---|---|
| `attention.unrecorded.title` | A card payment for {childName} couldn’t be recorded | One item per child whose share couldn't land |
| `attention.unrecorded.body` | {guardianName} paid {base} by card on {date} for {childName}, but it couldn’t go on the registration: {why}. The money is in the club’s Stripe balance. Refund it to the card. | `{why}` below |
| `attention.unrecorded.whyEnded` | the registration had already ended | |
| `attention.unrecorded.whyReceived` | the fee was already marked received | |
| `attention.unrecorded.whyOver` | it was more than what was owing | |
| `attention.unrecorded.whyNotAccepted` | the registration isn’t accepted | |
| `attention.unrecorded.whyOther` | something went wrong on our side | Any other refusal or error |
| `attention.unrecorded.button` | Refund to the card | Opens the refund for that child's share |
| `attention.unrecorded.settled` | Refunded | Clears when the share is refunded |

### A refund didn't reach the card

| key | string | note |
|---|---|---|
| `attention.refund.title` | {childPossessive} refund didn’t reach the card | |
| `attention.refund.body` | {refundAmount} to {brand} •••• {last4} was returned, for example because the card was closed. Send the family the money another way, then record the refund. | 12a with "the family" |
| `attention.refund.button` | Record a refund made another way | 12a's shipped label |
| `attention.refund.settled` | Refund recorded | |

## 8 · The season's Money page

| key | string | note |
|---|---|---|
| `money.quiet.line` | Families pay you directly, outside FieldLogicHQ. | §20's held `quiet.line`, house-league wording. Owner only, while not set up (departure 6) |
| `money.quiet.link` | Let them pay online | |
| `money.quiet.path` | Settings › Payouts | |
| `money.band.online` | {amount} of it by card | Under Received, only when something was paid online |
| `money.line.card` | Registration fee · online, card · receipt {receiptNo} | |
| `money.line.refundCard` | Refund to the card · {why} | `{why}` as today's refund line ("declined", "withdrawn", "price corrected") |
| `money.line.refundCardPart` | Part refund to the card · {reason} | |
| `money.line.processing` | Payment processing · {childName} | A club-paid fee (A14) or a fee the club gave back on a refund |
| `money.hintTaking` | Families pay by card from their status page. Fees are marked received, refunded and corrected on Registrations. | Replaces `registrations` while taking payments |

The treasurer's status line is 12a §6 verbatim, with §20's "Families and teams" in `status.offBody`.

## 9 · The who-pays setting (League and Club)

§20's held labels ship. These four hints were not in §20 but belong to the same setting:

| key | 12a | 12b (League and Club) |
|---|---|---|
| `before.whoTeamsHint` | Added to what the team pays. | Added to what the family or team pays. |
| `before.whoClubHint` | The team pays the entry fee alone; the processing fee comes out of each payment. | Families and teams pay the fee alone; the processing fee comes out of each payment. |
| `record.feeRead.family` | Teams pay it: it’s added to what they pay | Families and teams pay it: it’s added to what they pay |
| `record.edit.family` | Added to what the team pays. You receive the full entry fee. | Added to what the family or team pays. You receive the full fee. |
| `record.edit.club` | Teams pay the entry fee alone. The processing fee comes out of each payment and shows in your books as Payment processing. | Families and teams pay the fee alone. The processing fee comes out of each payment and shows in your books as Payment processing. |

## 10 · Receipt page and receipt email (house league)

12a §13–§14 with these line items. The receipt page's revisit line changes because the family's page is the status page.

| key | string | note |
|---|---|---|
| `receipt.season` | {seasonName} | Under "Paid, thank you" |
| `receipt.lineChild` | {childName} · {divisionName} · Registration fee | One per child paid |
| `receipt.waitlisted` | {childName} is on the waitlist. If a spot opens, we’ll email you a link to pay. | k3 |
| `receipt.revisit` | Your status page shows this receipt any time you open your pay link. | |
| `receiptEmail.lineChild` | {childName} · {seasonName} · {divisionName} · {base} | |

## 11 · The pay route's refusals (family wording of 12a §18)

| key | string |
|---|---|
| `payError.notAccepted` | {childName} hasn’t been accepted yet. You can pay once the club accepts them. |
| `payError.ended` | {childPossessive} registration has ended, so there’s nothing to pay. |
| `payError.alreadyPaid` | {childName} is already paid. |
| `payError.nothingOwed` | There’s nothing to pay right now. |
| `payError.clubNotTaking` | {clubName} isn’t taking online payments right now. (12a, followed by "How to pay") |
| `payError.linkInvalid` | This payment link doesn’t work. Ask {clubName} to email you a new one. |
| `payError.amountChanged` | 12a verbatim |
| `payError.couldntOpen` | 12a verbatim |
| `payError.unrecorded` | A payment for this sign-up is being checked by {clubName}. Contact them before paying again: {contactEmail}. |

---

## Departures from the drawings, and why

1. **Every rate and amount is a token.** The drawings' $156.75 / $6.75 / $27.38 are computed at runtime.
2. **A waitlisted child shows no "$0.00"** in the pay block (k1). A zero beside a name reads like a price. The line says
   what is true: nothing to pay unless a spot opens.
3. **No "failed" card state of our own.** A declined card is handled on Stripe's page. The k1 FAILED state is a returned
   bank debit (12c).
4. **"Processor keeps $4.85" is gone** from the ending window and the Money page (m1, m3), per plan §0c. When the box is
   ticked, the club gives back the whole fee, and it shows as Payment processing.
5. **No "Who is ending this?" question in house league.** Decline and Withdraw already say who is ending it, so the A2
   default follows the mode. The convenor can still change the box.
6. **The quiet line doesn't name e-Transfer or cash** (m1 drew "Families pay by e-Transfer or cash today"). The product
   doesn't know how a club takes money. §20's sentence is true for every club.
7. **"Spot is held for you" is not added to the promotion email** (b2). Today's email keeps its words; only the pay
   strings join it (12a departure 8).
8. **A Withdraw with a card refund emails the family**, though a plain Withdraw doesn't. The refund needs telling (m3:
   "Withdraw, refund and email").
9. **One email per act.** An ending and its refund arrive as one email, not two.
10. **"Payable separately to {clubName}." is dropped while taking payments**, because next to a Pay button it reads as
    "not here". It stays verbatim when not taking.

## Open questions (for the build, not the owner unless it gets stuck)

1. **A child paid partly by card and partly by hand, then ended.** Recommendation: "Refund to the card" returns the card
   payment, and the by-hand part keeps today's Refunded/Kept choice under it, in the same window. Rare; draw it only if
   the build finds it awkward.
2. **Price raise emails at once (b6, "Save and email").** As drawn. If a convenor needs to correct without telling the
   family, that's a later checkbox, not 12b.
