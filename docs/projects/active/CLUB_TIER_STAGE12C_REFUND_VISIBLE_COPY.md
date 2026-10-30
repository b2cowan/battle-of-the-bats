# Club Tier Stage 12c: the words (a refund you can see)

> Written by `/marketing`, 2026-10-26. Scope: every customer-visible string the "a refund you can see" build needs
> (plan §0g, rulings of 2026-10-26: all six asks as recommended, binding, not reopened). Inputs: the drawings
> `CLUB_TIER_STAGE12C_REFUND_VISIBLE_DRAWINGS.html` (frames a–f and the Journeys tab; their strings were the draft, every
> departure is in §6), the 12b words (`CLUB_TIER_STAGE12B_COPY.md`), and today's shipped words in
> `lib/house-league-money-words.ts`, `lib/league-pay-words.ts`, `lib/online-payment-words.ts`,
> `lib/needs-attention-words.ts` and `lib/email.ts` (`noteAndMoney`).

## How to read this

- The conventions of the 12a and 12b copy files apply unchanged: `key` to string tables, typographic `’`, `{tokens}` filled
  at runtime, money the house way (`$150.00`), `possessive()` for every possessive (`{childPossessive}`, `{clubPossessive}`,
  never `{name}’s`), `formatTime()` for a clock ("2:14 p.m."), sentence case.
- **No rate and no computed fee is typed anywhere.** The figures in the examples ($150.00 fee, $6.75 processing fee,
  $156.75 card total) are the drawing's made-up fixture (Northfield Minor Ball). They are examples, filled at runtime from
  the rows, and say nothing about what a club is charged.
- **Dates.** A screen shows "Oct 26" (`regDay`; the year only when it is not this year). An email shows "Oct 26, 2026"
  (`formatStoredDate`, as the receipt and refund emails already do). A time is "Oct 26 at 2:14 p.m." (the pattern in
  `DOOR_WORDS`).
- **Reused, not rewritten.** Where a shipped key is reused it is named in the note. New keys are marked **new**.
- A family-facing screen or email says "the card", never "Stripe", except where the club's own reference is quoted. Admin
  screens name Stripe.
- **When the club takes no card payments, and for every refund marked by hand, every word is today's** (frame f). Nothing
  in this file appears beside a refund marked by hand.

### Tokens new to 12c

`{booked}` (the figure the season's book carries for the refund: what the first line says) · `{refundAmount}` (what the card
got, fee included when it went back; 12b's token) · `{cardLabel}` ("Visa •••• 4242", `cardLabel()`) · `{base}` (what the card
paid for the child, before the processing fee) · `{procFee}` · `{day}` (screen date) · `{date}` (email date with year) ·
`{time}` · `{who}` (the person who pressed Refund) · `{receiptNo}` · `{reference}` (Stripe's refund id) · `{child}`,
`{childFirst}`, `{childPossessive}`, `{childList}`, `{guardianName}`, `{guardianEmail}`, `{clubName}`, `{contactEmail}`,
`{reason}` · `{why}` (12b's `attention.unrecorded.why*` words, reused below).

---

## 1 · The Fee cell (Registrations, desktop, and the phone row's detail lines)

The cell keeps its two lines. A refund by card changes only what the second line says: today's "Online, card" becomes the
amount the card got, plus a status when there is one. The first line keeps the fee figure (ruling 2). The by-hand states
are untouched. On a phone the same words sit on the row's detail lines (design decides the line breaks; the words do not
change).

`F` below is `REGS_WORDS.fee`. The second line is `F.on(day, how)`, so `how` is what changes.

| key | words | where / when |
|---|---|---|
| `regs.fee.toCard` | {refundAmount} to the card | **new.** The `how` of a card refund, replacing "Online, card" on a refund's second line only. A payment's own line still reads "Online, card · receipt 1046" |
| `regs.fee.pending` | pending | **new.** Last on the second line while Stripe hasn't finished: "Oct 26 · $156.75 to the card · pending". Quiet, not amber: it needs nobody |
| `regs.fee.madeInStripe` | made in Stripe | **new.** Last on the second line when the club refunded in its Stripe dashboard and we recorded it |
| `regs.fee.sentAnotherWay` | sent another way | **new.** The second line after a failed refund was recorded as sent another way: "Oct 30 · sent another way" |
| `regs.fee.refundFailed` | Refund didn’t reach the card | **new, same words as `TEAM_ROW_WORDS.refundFailed`.** The amber pill, in place of the first line. A button on the desk (opens the window F6 settles), display-only on a phone |
| `regs.fee.refundFailedSub` | {refundAmount} to the card · sent back {day} | **new.** The pill's second line. `{day}` is the day the card's bank sent it back |
| `regs.fee.refundFailedAria` | Refund didn’t reach the card. Record the refund sent another way. | **new.** The pill's accessible name and title where it is a button |
| `regs.fee.keptAndRefunded` | {kept} kept by the club · {refunded} refunded | **new.** First line of a part refund with the rest kept. Built from `F.kept` and `F.refunded`, joined with " · ". Second line: "Oct 19 · $50.00 to the card". The reason moves to the record (today it was the second line) |

Every other card state reads on those parts:

| state | first line | second line |
|---|---|---|
| Refunded in full, in the book | `F.refunded` "$150.00 refunded" | "Oct 26 · $156.75 to the card" |
| Pending at the bank | "$150.00 refunded" | "Oct 26 · $156.75 to the card · pending" |
| Failed (the card sent it back) | amber pill "Refund didn’t reach the card" | "$156.75 to the card · sent back Oct 23" |
| Part refund, rest kept | "$100.00 kept by the club · $50.00 refunded" | "Oct 19 · $50.00 to the card" |
| Made in Stripe, recorded by itself | "$150.00 refunded" | "Oct 27 · $156.75 to the card · made in Stripe" |
| Sent another way after a failure | "$150.00 refunded" | "Oct 30 · sent another way" |
| Never in the book (see third lines) | "$150.00 refunded" (the child's share of what the card paid) | "Oct 26 · $156.75 to the card" |
| By hand, unchanged | "$150.00 refunded" / "$100.00 kept by the club" | "Oct 12 · Cheque" / the kept reason |
| Never paid | "—" | none |

The figure on the first line is the fee, never the card total (ruling 2): a parent quoting a statement finds their number
on the second line, and the fee on the first.

### The third line (the dotted line that already carries a price correction)

| key | words | where / when |
|---|---|---|
| `regs.fee.neverBooked.ended` | Paid after the registration ended | **new.** Third line when the card payment couldn't go on the registration because it had ended (the walk's case) |
| `regs.fee.neverBooked.received` | Also paid by card · that payment was refunded | **new.** `why` = the fee was already marked received. The cell reads as it did (received by hand); the card refund is named here, because it is in no book line |
| `regs.fee.neverBooked.over` | Paid more than was owing · the extra was refunded | **new.** `why` = more than what was owing |
| `regs.fee.neverBooked.notAccepted` | Paid before the registration was accepted | **new** |
| `regs.fee.neverBooked.other` | Card payment not on this registration | **new.** Any other reason, or the registration is gone |
| `regs.fee.neverBookedTip` | Paid by card on {day} at {time}, but it couldn’t go on this registration: {why}. Refunded to the card on {day} at {time}. | **new.** The line's tap-for-detail, like `F.correctedTip`. `{why}` is 12b's `attention.unrecorded.why*` (reused, below) |
| `regs.fee.notMatched` | {amount} refunded in Stripe on this family’s payment · not matched yet | **new.** Third line on every child of a payment while a part refund made in Stripe waits for "whose was it?" |
| `regs.fee.notMatchedTip` | {amount} was refunded in Stripe on the payment for {childList}. It goes on one registration once the club says whose it was. | **new** |
| `regs.fee.correctedCard` | Price corrected · {amount} back to the card | **new.** The correction line when the difference went to the card. Replaces `F.corrected(reason)` on that row; the reason is in the tip |
| `regs.fee.correctedCardPending` | Price corrected · {amount} back to the card · pending | **new** |
| `regs.fee.correctedCardFailed` | Price corrected · {amount} refund didn’t reach the card | **new.** Amber, and the same button as the failed pill. The row's first line stays "$135.00 received" |
| `regs.fee.correctedCardTip` | Was {was}, now {now}. Corrected on {day}. {reason} {amount} went back to the card on {day}. | **new.** Extends `F.correctedTip` (reused for the first sentences) |

The part refund of a price correction never includes the processing fee (12b §6.2), so its second-line amount equals its
book amount.

### Accessible name

`F.aria` is reused and also reads the third line: "{name}: {primary}. {sub} {third}".

---

## 2 · The record window: the "To the card" block

The record reads first and has no edit state of its own. The block sits under the Fee section's facts: one block per card
refund, newest first. Everyone who can open the record sees it. Only the desk (owner, club admin, league admin, registrar)
sees the button (§0f). It appears only beside a card refund.

### Heading and status

| key | words | where / when |
|---|---|---|
| `rec.card.heading` | To the card | **new.** The block's heading, every state but "sent another way" |
| `rec.card.pill.refunded` | Refunded | **new.** Stripe confirmed |
| `rec.card.pill.pending` | Pending | **new** |
| `rec.card.pill.failed` | Refund didn’t reach the card | **new.** Amber. Same words as the Fee cell's pill |
| `rec.card.tag.stripe` | Made in Stripe | **new.** A tag beside the status pill, never a status of its own |
| `rec.card.heading.another` | Sent another way | **new.** The heading of a failed refund the club then sent another way, with the pill "Refunded" (the money went, not to the card) |

### The facts (label then value)

`{who}` is the person who pressed Refund, as the record already names people. All three statuses show the facts they have.

| key | label | value pattern | where / when |
|---|---|---|---|
| `rec.card.amount` | Amount | {refundAmount} to {cardLabel} | Always |
| `rec.card.amountSplit` | (under Amount) | {base} fee + {procFee} processing fee | When the fee went back with it |
| `rec.card.amountPart` | (under Amount) | Part of the {fee} fee. A part refund never includes the processing fee. | A part refund (12b §0e) |
| `rec.card.amountWhole` | (under Amount) | The whole payment, so the processing fee went back too. | A refund made in Stripe for the whole payment |
| `rec.card.fee` | Processing fee | see below | Only while the family paid the fee (A14) and a fee exists |
| `rec.card.fee.declined` | | Given back, because the club declined | Decline's default |
| `rec.card.fee.included` | | Given back, because the club chose to include it | A Withdraw with the box ticked |
| `rec.card.fee.whole` | | Given back with the whole payment | A whole-payment refund (the door; made in Stripe) |
| `rec.card.fee.keptAsked` | | Not refunded, because the family asked to leave | A Withdraw with the box off |
| `rec.card.fee.keptPart` | | Not refunded. A part refund never includes it. | A part refund and a price correction |
| `rec.card.fee.book` | (under Processing fee) | In the season’s book as Payment processing | Only when it was given back. Dropped on a phone (the treasurer reads it on Money) |
| `rec.card.by` | Refunded by | {who}, {day} at {time} | A refund pressed here |
| `rec.card.byStripe` | Refunded by | Someone in the club’s Stripe dashboard, {day} at {time} | Made in Stripe. Sub-line: "Recorded here by itself at {time}" (`rec.card.byStripeSub`) |
| `rec.card.reached` | Reached the card | {day} at {time} | Refunded only. Sub-line `rec.card.reachedSub`: "It takes 5 to 10 business days to appear on the family’s statement." |
| `rec.card.status` | Status | Stripe accepted it {day} at {time} and is waiting on the card’s bank. It’s already in the season’s book. Nothing to do. | Pending only |
| `rec.card.what` | What happened | Sent {day}; the card’s bank sent it back {day}, for example because the card was closed. The club still owes it. | Failed only. "For example because the card was closed" is `attention.refund.body`'s own phrase |
| `rec.card.ref` | Stripe reference | {reference} + Copy | Always. The club pastes it into its Stripe dashboard to find the refund |
| `rec.card.paidWith` | Paid with | Receipt {receiptNo}, {day} | Always |
| `rec.card.reason` | Reason | {reason} | A part refund. Required when it was made, so always present |
| `rec.card.kept` | Kept by the club | {kept} | A part refund |
| `rec.card.before` | Before it | The club had kept the fee: “{reason}” | A refund made in Stripe on a fee the club had marked kept. Without a reason: "The club had kept the fee." |
| `rec.card.beforeFailed` | Before it | The card refund ({reference}) was sent back {day} | The "sent another way" block |
| `rec.card.anotherAmount` | Amount | {refundAmount}, recorded by {who} on {day} | The "sent another way" block |
| `rec.card.why.ended` | Why | Paid {day} at {time}, after the club {declinedOrWithdrawn} {child} at {time}. It never went on this registration. | Never in the book, the registration had ended. `{declinedOrWithdrawn}` = "declined" / "withdrew"; a released spot: "after the club released {childPossessive} spot" |
| `rec.card.why.other` | Why | Paid {day} at {time} by card, but it couldn’t go on this registration: {why}. | Never in the book, any other reason. `{why}` reused from 12b |
| `rec.card.book` | Season’s book | No fee line. The {procFee} given back is in it as Payment processing. | Never in the book. Without a fee given back: "No fee line." Treasurer's line; dropped on a phone |

### Copy, the family emailed, the button

| key | words | where / when |
|---|---|---|
| `rec.card.copy` | Copy | Beside the reference, a text link on a desk |
| `rec.card.copied` | Copied | Replaces "Copy" for two seconds. Transient (the autosave rule: it fades) |
| `rec.card.copyAria` | Copy the Stripe reference | The phone's symbol-alone button, 44px (screen-reader name; no visible word) |
| `rec.card.copyFailed` | Selected. Press and hold to copy. | When the copy is refused (some in-app views). The reference is selected so a long press copies it. On a desk: "Selected. Press Ctrl+C to copy." (`rec.card.copyFailedDesk`) |
| `rec.card.emailed` | Family emailed | The label |
| `rec.card.emailed.sent` | {guardianEmail}, {day} | Happy state |
| `rec.card.emailed.none` | No email address on file. Tell the family yourself. | No address |
| `rec.card.emailed.waits` | Not yet. It goes when you answer on Needs attention. | A refund made in Stripe waiting on "whose was it?" or "still enrolled" |
| `rec.card.emailed.failed` | Couldn’t be sent {day} | The send failed |
| `rec.card.emailed.notFailed` | Not emailed. Contact the family to arrange another way. | The failed block (ruling 6: never for a failed refund) |
| `rec.card.emailed.anotherWay` | Not emailed by us. You told the family. | After "sent another way" |
| `rec.card.button` | Record the refund sent another way | The failed block's button, full width at 44px on a phone. The same name as the row's ⋯ item and the Needs-attention item (F6, §5) |

### The History line

The History keeps the book's figure first, as the Fee section does, and adds the card's. Today it reads "Refunded
$150.00 · Online, card".

| key | words | where / when |
|---|---|---|
| `rec.hist.refund` | Refunded {booked} · {refundAmount} to {cardLabel} | A refund that is in the book |
| `rec.hist.refund.reached` | Refunded {booked} · {refundAmount} to {cardLabel} · reached the card | After Stripe confirms |
| `rec.hist.refund.pending` | Refunded {booked} · {refundAmount} to {cardLabel} · pending | |
| `rec.hist.refund.stripe` | Refunded {booked} · {refundAmount} to {cardLabel} · made in Stripe | |
| `rec.hist.failed` | Refund didn’t reach the card · {refundAmount} to {cardLabel} | A second line, dated the day it came back |
| `rec.hist.anotherWay` | Refund sent another way · {refundAmount} | A third line, dated the day it was recorded |
| `rec.hist.neverBooked` | Card refund {refundAmount} to {cardLabel} · not on this registration | A refund that never entered the book (no booked figure to lead with) |

---

## 3 · Money › Refunds

The tab stays the season's book. Only the How column's words change, and one closing line names what never entered it.

| key | words | where / when |
|---|---|---|
| `money.how.toCard` | To the card | **new.** How, on a card refund (replaces "Online, card" on a refund line only) |
| `money.how.toCardPending` | To the card · pending | **new** |
| `money.how.failed` | Refund didn’t reach the card | **new.** Amber text, no pill: a book line |
| `money.how.anotherWay` | Sent another way | **new.** After a failed refund was recorded as sent another way |
| `money.what.stripe` | Refund · made in Stripe | **new.** The What column, built on `what.refund(why)` with `why` = "made in Stripe". Existing whys (declined, withdrawn, price corrected, spot released) are unchanged |
| `money.neverBooked` | One card refund isn’t in this book, because its payment never went on a registration: {name}, {refundAmount} on {day}. {feeSentence} | **new.** Closing line under the Refunds list, only when a card refund has no book line. `{name}` opens that registration's record at its Fee section |
| `money.neverBookedMany` | {n} card refunds aren’t in this book, because their payments never went on a registration: {list}. {feeSentence} | **new.** `{list}` = "{name}, {refundAmount} on {day}" joined with "; ", names each a link, at most three, then "and {m} more" (plain text) |
| `money.neverBookedMore` | and {m} more. See them under Ended on Registrations. | **new.** The tail of the list past three |
| `money.neverBookedFee` | Its {procFee} processing fee is under Payment processing. | **new.** `{feeSentence}`, one refund with a fee given back. Plural: "Their processing fees are under Payment processing." (`money.neverBookedFeeMany`). Omitted when no fee went back |
| `money.phone.neverBookedHead` | Not in this book | **new.** The phone's dashed closing row's small heading, once |
| `money.phone.neverBookedLine` | {name} · {refundAmount} card refund, {day}. The payment never went on a registration. | **new.** One dashed row per child under the heading; each opens that record (44px, with a ›) |

The band's captions are unchanged: "after {amount} refunded" and "{amount} of it by card".

---

## 4 · The family's refund email, in the club's name

One refund block, the same in every email that carries a refund. One email per act (12b departure 9): an ending sends its own
email with the block in it, a price correction sends the refund email alone, and the two silent cases (the door, a refund
made in Stripe) send the refund email. The email is in the club's identity on the warm envelope (S3b), as every 12b family
email. When it is sent and not sent is ruling 6 and the drawing's table; the words below do not restate it.

### The refund email

| key | words | where / when |
|---|---|---|
| `refundEmail.subject` | Refund from {clubName} | 12b `refundEmail.subject`, reused. `[Test] ` prefix in test mode |
| `refundEmail.preheader` | {refundAmount} refunded to your card. | **new.** The inbox's preview line |
| `refundEmail.lead` | {childPossessive} registration fee for {seasonName} was refunded. | 12b, reused. A full refund of one child's fee, the heading |
| `refundEmail.leadPart` | {amount} of {childPossessive} registration fee for {seasonName} was refunded. | 12b, reused. A part refund, a price correction, a one-child part refund made in Stripe |
| `refundEmail.leadMany` | Your payment for {childList} in {seasonName} was refunded. | **new.** A whole refund of a payment for two or more children |
| `refundEmail.leadManyPart` | {amount} of your payment for {childList} in {seasonName} was refunded. | **new.** A part refund on a payment for two or more children (split or not) |
| `refundEmail.leadNeverBooked` | A payment for {childPossessive} registration for {seasonName} was refunded. | **new.** The door's refund. Not "registration fee": no fee was recorded |
| `refundEmail.why.ended` | Your payment arrived after {childPossessive} registration had ended, so the club sent it back. | **new.** Under the lead |
| `refundEmail.why.received` | {childPossessive} fee had already been paid another way, so the club sent this payment back. | **new** |
| `refundEmail.why.over` | The payment was more than {child} owed, so the club sent the extra back. | **new** |
| `refundEmail.why.notAccepted` | {childPossessive} registration hadn’t been accepted yet, so the club sent this payment back. | **new** |
| `refundEmail.why.other` | The club couldn’t put this payment on {childPossessive} registration, so it sent it back. | **new** |
| `refundEmail.reason` | {clubPossessive} reason: {reason} | 12b, reused. A part refund |
| `refundEmail.priceChanged` | The price changed from {from} to {to}. | 12b, reused. A price correction |
| `refundEmail.stillEnrolled` | {childFirst} is still registered and owes {owing}. | **new.** The "keep enrolled" variant: the club chose to leave the child registered |
| `refundEmail.note` | {note} | 12b, reused. The convenor's note, verbatim |

**The block** (label then value, the club's colours, the warm envelope's small table):

| key | label | value | where / when |
|---|---|---|---|
| `refundEmail.block.amount` | Refunded | {refundAmount} | Always |
| `refundEmail.block.for` | For | {childName} · {amount} (one row per child) | Only when the payment covered two or more children, so each child is named with their part |
| `refundEmail.block.to` | To | {cardLabel} | Always |
| `refundEmail.block.on` | On | {date} | The refund's own date, never the day we heard of it. A Stripe event that arrives late still reads right |
| `refundEmail.block.ref` | Refund reference | {reference} | Always. The club's search key: the family can quote it. Labelled as the refund's, not "Reference", which a sign-up already uses |
| `refundEmail.block.receipt` | Your receipt | {receiptNo} (paid {date}) | Always |

Under the block:

| key | words | where / when |
|---|---|---|
| `refundEmail.feeIncluded` | This includes the {procFee} processing fee. | 12b, reused. When it went back |
| `refundEmail.feeKept` | The {procFee} processing fee isn’t part of this refund. | 12b, reused. Only while families paid it and it did not go back |
| `refundEmail.arrives` | It takes 5 to 10 business days to appear. | **new key, shipped words.** Today's second half of `refundEmail.amount`/`ONLINE_EMAIL_WORDS.refundAmount`, now its own line under the block (see §6 decision 8) |
| `refundEmail.questions` | Questions: {contactEmail}. | 12b, reused (`ONLINE_EMAIL_WORDS.refundQuestions`). Without a club contact, "Questions go to {clubName}." |
| `refundEmail.testNote` | Test mode: no money moved. | 12a, reused, last, in test mode |

**Retired:** 12b's `refundEmail.amount` ("{refundAmount} refunded to {brand} •••• {last4} on {date}. It takes 5 to 10 business
days to appear."), which the block replaces; and `LEAGUE_PAY_WORDS.refundEmail.amount` ("is on its way back to the card…"),
which shipped differently from the 12b file and is replaced by the same block.

**Two-child whole refund, as sent** (example): heading "Your payment for Theo and Lily in 2026 Fall House League was
refunded." Block: Refunded $312.00 · For Theo Grant · $150.00 and Lily Grant · $150.00 · To Visa •••• 4242 · On Oct 27, 2026 ·
Refund reference re_… · Your receipt 1052 (paid Oct 20). Then "This includes the $12.00 processing fee. It takes 5 to 10
business days to appear." then "Questions: …".

### The variants that ride inside other emails

| key | words | where / when |
|---|---|---|
| `endMail.refundLead` | We refunded your payment. | **new.** In the ending email (decline, withdraw, release), in place of the money sentence, with the block under it. A part refund: `endMail.refundLeadPart` "We refunded {amount} of your payment." The club's note and `refundEmail.reason` follow |
| `endMail.keptRest` | The club is keeping the {rest} you paid. The reason: {reason}. | Today's `kept` sentence, reused for the rest of a part refund |
| `endMail.refundByHand` | We refunded {amount} on {day}{method}. | **new.** The ending email's refund sentence for a refund marked by hand. **Replaces** "We refunded the {amount} you paid on {day}{method}." (see below) |
| `linkEmail.bodyRefunded` | {clubName} refunded {childPossessive} fee for {seasonName}, and {childFirst} is still registered, so {owing} is due. | **new.** The pay-link email sent from "still enrolled". Block under it, then Pay now. Replaces `linkEmail.body` for this send |

**The ending email's misdated sentence.** Today: "We refunded the $150.00 you paid on Oct 26 (Online, card)." The date is the
refund's, so it says the family paid on the day we refunded them, and "the $X you paid" is wrong for a part refund. The
replacement says only what is true: **"We refunded $150.00 on Oct 26 (Cheque)."** The fix applies to every refund sentence,
card or not, because the sentence is wrong whatever the method (frame f). The `{method}` brackets are today's
`methodInBrackets` (nothing for Other or Not recorded). A card refund replaces the sentence with `endMail.refundLead` and the
block.

---

## 5 · Needs attention

Who receives these: the house-league desk (owner, club admin, league admin, registrar), never the treasurer (§0f). Each
clears itself when settled. A clean refund made in Stripe raises nothing.

### Whose was it? (a part refund in Stripe on a payment for two or more children)

| key | words | where / when |
|---|---|---|
| `attention.whose.title` | {refundAmount} was refunded in Stripe on {guardianPossessive} payment | **new.** Title. `{guardianPossessive}` is `possessive(guardianName)`; with no name, "the family’s payment" |
| `attention.whose.body` | It paid for {childList} ({total}, receipt {receiptNo}), so we can’t tell whose fee it was. Choose the child, and it goes on that registration. Until then it isn’t in the season’s book. | **new.** Body |
| `attention.whose.button` | Choose the child | **new.** Opens the window. No Done (it would leave the refund out of the book for good) |
| `attention.whose.settled` | Refund recorded | Reuses `SETTLED_WORDS.refundRecorded`. Then-line `attention.whose.settledThen`: one child, "It’s on {childPossessive} registration."; split, "It’s on their registrations." |
| `whose.title` | Whose fee was the {refundAmount} refund? | **new.** Window title |
| `whose.lead` | Refunded in Stripe on {day} to {cardLabel}, reference {reference}. | **new** |
| `whose.option` | {childName} | **new.** One radio per child of the payment. Sub-line: "{division} · {fee} received" |
| `whose.split` | Split it between them | **new.** The last radio. Sub-line `whose.splitSub`: "Amounts that add up to {refundAmount}" |
| `whose.splitAmount` | Amount for {childFirst} | **new.** One field per child, when Split is chosen |
| `whose.reason` | Reason | **new, 12b `end.cardPartReason`.** Required, with the asterisk. Hint: "The family reads this in their email." (12b `cardPartReasonHint`) |
| `whose.err.choose` | Choose a child, or split it between them. | **new** |
| `whose.err.sum` | The amounts add up to {sum}. They need to add up to {refundAmount}. | **new.** Inline, persistent, when Save is pressed (or the amounts are all filled) |
| `whose.err.over` | {childPossessive} amount can’t be more than {fee}. | **new.** A part refund never includes the processing fee |
| `whose.err.reason` | Say why only part is refunded. | Reuses `END_WORDS.cardPartReasonError` |
| `whose.foot` | The family is emailed once you save. | **new.** The foot sentence, left; `Cancel` and `Save` right (the window-foot ruling) |
| `whose.save` | Save | |
| `whose.working` | Saving… | |
| `whose.done` | Recorded the {refundAmount} refund for {childList}. We emailed {guardianEmail}. | **new.** Toast, transient. Without an address: "Recorded the {refundAmount} refund for {childList}. There’s no email address on file, so tell the family yourself." (`whose.doneNoEmail`) |

### Still enrolled (the fee went back in Stripe and the child is still registered)

| key | words | where / when |
|---|---|---|
| `attention.enrolled.title` | {childPossessive} fee was refunded in Stripe, and {childFirst} is still enrolled | **new.** Title |
| `attention.enrolled.body` | {refundAmount} went back to {cardLabel} on {day}. It’s recorded, and {childFirst} owes {owing} again. Withdraw {childFirst}, email the family the pay link, or keep {childFirst} enrolled. The family is emailed once you choose. | **new.** Body. The money is recorded at once; only the registration is asked about |
| `attention.enrolled.withdraw` | Withdraw {childFirst} | **new.** Opens today's ending window, its money question already answered ("refunded in Stripe"). The ending email carries the block, so the family gets one email |
| `attention.enrolled.link` | Email the pay link | **new, 12b `regs.menu.emailLink`.** Sends the block with the pay link (`linkEmail.bodyRefunded`) |
| `attention.enrolled.keep` | Keep {childFirst} enrolled | **new.** Sends the refund email with `refundEmail.stillEnrolled` |
| `attention.enrolled.doneWithdraw` | Withdrew {childFirst}. We emailed {guardianEmail}. | **new.** Toast |
| `attention.enrolled.doneLink` | Emailed {guardianEmail} the refund and a pay link. | **new.** Toast |
| `attention.enrolled.doneKeep` | {childFirst} stays enrolled. We emailed {guardianEmail} about the refund. | **new.** Toast |
| `attention.enrolled.settled` | one of the three: reuses `SETTLED_WORDS.withdrawDone` "The registration has ended." · `You emailed the pay link` / "Pay link emailed by {who}" (new, in the `did()` shape) · `You kept {childFirst} enrolled` / "{who} kept {childFirst} enrolled" (new) | Settled lines. If the family then pays, `SETTLED_WORDS.paidInFull` "Paid in full." |

### A refund that matches no payment we recorded

| key | words | where / when |
|---|---|---|
| `attention.noMatch.title` | A refund in Stripe matches no payment we recorded | **new.** Replaces the title "A house-league card payment couldn’t be recorded" for this case (its wrong title was F4) |
| `attention.noMatch.body` | {refundAmount} was refunded in Stripe on {day}, on a payment we haven’t recorded yet. It goes on the registration as soon as that payment arrives. If it’s still here tomorrow, the club’s owner can check the payment in Stripe. | **new.** Rare; Stripe's events arrive out of order. The page's own Done stays |
| `attention.noMatch.settled` | Refund recorded | Reuses `SETTLED_WORDS.refundRecorded`; then-line reuses `SETTLED_WORDS.onlineItemRecorded` "It’s on the registration now." |

### The failed refund (body unchanged)

| key | words | where / when |
|---|---|---|
| `attention.refund.title` | {childPossessive} refund didn’t reach the card | 12b, shipped (`refundFailedTitle`) |
| `attention.refund.body` | {refundAmount} to {cardLabel} was returned, for example because the card was closed. Send the family the money another way, then record the refund. | 12b, shipped, unchanged |
| `attention.refund.button` | Record the refund sent another way | **changes** (F6, below). The item opens {childPossessive} record at the To the card block, where the button lives |
| `attention.refund.settled` | Refund recorded | 12b, shipped |

### The notification kinds' own labels (only if the build makes new kinds for these items)

| key | words |
|---|---|
| `kind.whose.label` | A refund in Stripe needs you to say whose it was |
| `kind.whose.desc` | A part refund was made in Stripe on a payment for more than one child. Choose whose fee it was. |
| `kind.enrolled.label` | A refunded child is still enrolled |
| `kind.enrolled.desc` | A child’s fee was refunded in Stripe, but the registration is still active. Withdraw them, email the pay link or keep them enrolled. |
| `kind.noMatch.label` | A refund in Stripe matches no payment we recorded |
| `kind.noMatch.desc` | A refund was made in Stripe on a payment that isn’t recorded yet. It clears when the payment arrives. |

**Retired:** `LEAGUE_ONLINE_NOTICE_WORDS.refundedInStripeBody` ("Record the refund by hand on Registrations so the season’s
book matches"), whose instruction has no door on an ended row (F4).

---

## F6 · One name for the window: "Record the refund sent another way"

**Today** the same act has two names: the house-league row's ⋯ says **"Record the refund sent another way"**
(`REGS_WORDS.menu.refundAnotherWay.label`), while the Needs-attention button (12b's `attention.refund.button`) and the
whole tournament side say **"Record a refund made another way"** (`TEAM_ROW_WORDS.menuAnotherWay`,
`REFUND_WORDS.titleAnotherWay`).

**The choice: "Record the refund sent another way", for house league, and the tournament side follows.**
- "The refund": the act is offered only on one refund that came back, never a new refund. "A refund" invites reading it as
  "a second, new one". The tournament route already refuses it unless the last refund failed.
- "Sent": it is what the club did (it sent the family money). "Made" belongs to the other tag, "made in Stripe", and the two
  would read as one idea.
- One spelling rule: one act, one name, on the row, the record's button, the pill's door and the Needs-attention button, in
  both products. The house-league window's title keeps its confirm shape ("Record the refund for {name} as sent another
  way?") because it names the child on a money-out confirm; it holds the same words.

**Keys and strings that change** (tournament side included):

| where | string | becomes |
|---|---|---|
| `TEAM_ROW_WORDS.menuAnotherWay` (`lib/online-payment-words.ts`) | Record a refund made another way | Record the refund sent another way |
| `REFUND_WORDS.titleAnotherWay` | Record a refund made another way | Record the refund sent another way |
| the 409 in `app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts` | "Record a refund made another way only when that refund came back." | "Record the refund sent another way only when that refund came back." |
| 12b `attention.refund.button` (house-league Needs-attention button) | Record a refund made another way | Record the refund sent another way |
| 12a copy (the same window) | any "Record a refund made another way" | the same change |
| `lib/help-content/tournaments.tsx` (the `searchText` ~line 985, the bold button names ~lines 1138 and 1163) | record a refund made another way | record the refund sent another way |
| `lib/help-content/house-league.tsx` (the Registrations article's `keywords`/`searchText`) | (has "refunded another way" only) | add "record the refund sent another way", "sent another way" |

**Not changed:** `REFUND_WORDS.buttonAnotherWay` "Record the refund" (it already agrees); `REFUND_WORDS.anotherWayLead`
("Record the money you sent the team another way"); `PRICE_WORDS.lowerOtherChoice` "Refunded another way" (a choice
recording what already happened on a price correction, a different act); the notification line "Send the team the money
another way, then record the refund."

---

## 6 · Decisions

1. **The Fee cell keeps its two lines; the card's amount replaces "Online, card" on a refund's second line only** (ruling 1,
   2). A payment's own line still says "Online, card". One new `how` word: "{amount} to the card".
2. **One status vocabulary on every surface:** pending, refund didn’t reach the card (amber), made in Stripe, sent another
   way. The row and the Money tab's How say it in lowercase fragments, the record in capitalized pills. "In Stripe" alone
   is never used as the label; in a sentence it is "refunded in Stripe".
3. **The first line keeps the fee figure; the card total is never the cell's headline.** A parent quoting a statement finds
   it on the second line.
4. **A part refund with the rest kept reads "kept first, refunded second",** and its reason leaves the cell (it lives in the
   record). A by-hand "kept" keeps today's reason as its second line.
5. **A never-in-the-book refund names its reason in a third line, by reason** (ended, already received, over, not accepted,
   other), not one sentence for all. The drawing wrote only the ended case. The four 12b `why*` words are reused for the tip
   so the reasons never drift apart.
6. **A price correction's line trades its reason for the card's amount** ("Price corrected · $15.00 back to the card"); the
   reason moves to the tip and the record. The other way round (reason on the line) loses the one fact the refund changed.
7. **The refund email's lead says "registration fee" only when a fee was recorded.** The door's refund says "a payment for
   {childPossessive} registration" and then why the club sent it back, in family terms, by the same four reasons.
8. **The email keeps the shipped "It takes 5 to 10 business days to appear."** The drawing wrote "to appear on your
   statement". The tournament refund email and 12a already say the shipped words; one sentence in both products. The
   record, which speaks to the club, may say "on the family’s statement".
9. **The email's date is the refund's own date** (`{date}` = the refund's, not the send's). The tournament refund email's
   code builds that date from the moment of sending (`sendRefundEmail`); it is the same class of misdating as F3 and should
   read the refund's date too. A code finding, not a word change.
10. **The History keeps the book figure first** ("Refunded $150.00 · $156.75 to Visa •••• 4242"), the same order as the
    Fee section's summary. The drawing's History led with the card total, which disagreed with "Refunded $150.00" three lines
    above it in the same window.
11. **"Whose was it?" names the payer, not a family name:** "{guardianName}’s payment", through `possessive()`. The drawing
    wrote "the Grant family’s", which guesses a family name from a child's surname. The body still names the children.
12. **The "no payment we recorded" item says "the club’s owner can check"**, not "ask the club’s owner": the owner is one of
    its readers.
13. **"Made in Stripe" says who it wasn't:** "Someone in the club’s Stripe dashboard". We know it wasn't a person here; we do
    not know who.
14. **Everything above is shown only beside a card refund.** A club taking no card payments, and a refund marked by hand,
    read word for word as today (frame f). The one change both see is the ending email's fixed refund sentence (decision
    in §4).
15. **The treasurer reads every block and line and never gets a button** (§0f). Their book sub-lines stay on Money, and drop
    from the phone record.

## 7 · Open word questions for the owner

**RULED 2026-10-26 (owner): all three as recommended** — keep both third lines; F6 changes both flows, the tournament's
12a words included; no "Email the family" door for now. The questions as asked, for the record:

1. **A third line on the Fee cell in two new places.** Ruling 1 says "the cell's existing two lines". The drawing adds a
   dotted third line for a never-in-the-book refund ("Paid after the registration ended") and for a refund "not matched
   yet", where the price correction already owns one. **Recommendation: keep both.** They answer "why isn't it in the
   book?" and "did anyone see my refund?" on the row, before a call. Without them the row reads like the "—" this round
   exists to remove. If the owner wants strictly two lines, the reasons move to the tip alone and the cell shows nothing
   third.
2. **F6 reaches the tournament screens.** Changing the tournament menu item, window title and help article is a change
   to shipped, already-walked 12a words. **Recommendation: change them** (one spelling rule; the cost is five strings and
   two help lines). If the owner would rather not touch 12a, the house-league side still takes the new name and the
   tournament side keeps its own, which is the two-names problem again.
3. **A failed refund can't be emailed to the family from here.** The drawing named an "Email the family" door with the
   reference filled in and a Resend door as not drawn (new acts, beyond ruling 6). **Recommendation: not now.** The record's
   "Not emailed. Contact the family to arrange another way." tells the desk what to do. Say the word if a refund that came
   back should offer one.
