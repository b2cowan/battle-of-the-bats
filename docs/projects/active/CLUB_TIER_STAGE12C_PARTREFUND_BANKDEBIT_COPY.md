# Club Tier Stage 12c: the words (a team's part refund; bank debit)

> Written by `/marketing`, 2026-10-26. Scope: every customer-visible string the two last 12c drawing items need (plan §0j,
> items 2 and 3; all ten asks RULED 2026-10-26 as recommended, binding, not reopened). Inputs: the drawings
> `CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_DRAWINGS.html` (frames 1 to 5 and the reviews table; their strings were the
> draft, every departure is in §6 and §7), the refund-visibility words (`CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md`, whose
> keys this file reuses and does not rewrite), the 12b and 12a words, and today's shipped words in
> `lib/online-payment-words.ts`, `lib/registration-words.ts`, `lib/house-league-money-words.ts`, `lib/league-pay-words.ts`
> and `lib/help-content/tournaments.tsx` (~1099 to 1142).

## How to read this

- The conventions of the 12a, 12b and refund-visibility copy files apply unchanged: `key` to string tables, typographic
  `’`, `{tokens}` filled at runtime, money the house way (`$150.00`), `possessive()` for every possessive
  (`{childPossessive}`, `{teamNamePossessive}`, `{clubPossessive}`, never `{name}’s`), `formatTime()` for a clock
  ("10:15 a.m."), sentence case.
- **No rate and no computed fee is typed anywhere.** Rates print from `lib/plan-config.ts` through
  `onlineFeeRateLabel('card')` and `onlineFeeRateLabel('bankDebit')` as `{cardRate}` and `{bankRate}`. Every fee and total is
  a token. The dollar figures in the examples are the drawing's made-up fixture (Northfield Minor Ball; the Riverside Rockets
  12U, a $400.00 entry with a $100.00 deposit; Henry and Lily Grant) and say nothing about what a club is charged. Where an
  example needs a computed figure it is written as a token.
- **Dates.** A screen shows "Oct 26" (the year only when it is not this year). An email shows "Oct 26, 2026"
  (`formatStoredDate`, as the receipt and refund emails already do). A time is "Oct 27 at 10:15 a.m.".
- **Reused, not rewritten.** Where a shipped or earlier-file key is reused it is named in the note. New keys are marked
  **new**; a shipped key whose words change is marked **changes**.
- **A family-facing screen or email says "the card", "your bank" and "the secure payment page", never a bank's or the
  processor's name.** Admin screens name Stripe. (Shipped 12a lines `payBlock.confirmingBody` and `notFinishedBody` already
  say "Stripe" to a family; see §6 decision 16.)
- **A club that takes no bank debit, and every card flow, reads word for word as today** except the keys marked **changes**.
  Nothing here appears beside a payment made by card or marked by hand.
- **Bank debit and its words are one thing**: the family-facing name is "bank debit"; the desk's method word is "Online, bank
  debit" (the twin of "Online, card"); the state is **Clearing** (ask 5). "Payment processing" stays the cost line's word and
  the "Processing fee" stays the fee's word. Nothing says "Processing" for a debit on its way (§5).

### Tokens new to this file

`{cardRate}` · `{bankRate}` (the two labels) · `{debitTotal}` (what the debit takes: the base plus its processing fee while the
family pays it, the base alone when the club does) · `{debitFee}` · `{last4}` (the family's account's last four digits; if
Stripe does not give them, the fallback keys in §2 apply) · `{started}` / `{cleared}` / `{returnedDay}` (screen dates) ·
`{reasonFull}` and `{reasonShort}` (the bank's reason, mapped in §2.3; empty when unmapped) · `{siblingList}` (the other
children on the same debit, first names: "Lily", "Lily and Zoe") · `{childList}`, `{childFirst}`, `{childPossessive}`,
`{teamName}`, `{teamNamePossessive}`, `{tournamentName}`, `{seasonName}`, `{guardianName}`, `{guardianEmail}`,
`{payerEmail}`, `{clubName}`, `{contactEmail}`, `{howToPay}` (all as 12a and 12b) · `{scope}` ("deposit", "balance",
"payment"; a payment's label as the row shows it, lowercase in a sentence) · `{left}` (what is still refundable on that
payment) · `{rest}` (what stays paid) · `{entry}` (the team's entry fee after any adjustment) · `{owes}` · `{paid}` ·
`{lowered}` · `{reason}` · `{bankDays}` (how long a refund to a bank account takes: **a Stripe fact the build fills from
Stripe's docs; until then no number is printed**, §7 question 6) · `{saveCard}` / `{saveBank}` (computed savings) ·
`{owesAgain}` ("Henry owes $150.00 again", "Henry owes $150.00 and Lily owes $150.00 again") · `{spotsHeld}` ("Henry’s spot is",
"both spots are", "all three spots are").

---

## 1 · A team's part refund (tournaments; whoever runs tournaments, never the treasurer, §0f)

### 1.1 The refund window

One window per payment row, opened from the row's ⋯ › **Refund to the card** (shipped `TEAM_ROW_WORDS.menuRefund`, unchanged).
It opens with nothing picked. The processing-fee box and "Who is ending this?" appear only with **All of it** (ask 1) and
only while the team paid the fee. A part refund needs a reason (ask 2).

| key | words | where / notes |
|---|---|---|
| `refund.title` | Refund {teamNamePossessive} {scope}? | **changes** `REFUND_WORDS.title` ("Refund {team}’s payment?"). `{scope}` is the row's label: deposit, balance, payment (an entry paid whole). Example: "Refund Riverside Rockets 12U’s deposit?" |
| `refund.paidTeams` | Paid {total} on {day} (receipt {receiptNo}): the {base} {scopeNoun} and a {procFee} processing fee. | **changes** `paidTeams`. `{scopeNoun}` is "deposit", "balance" or "entry fee". The team's name leaves the sentence (the title carries it) |
| `refund.paidClub` | Paid {base} on {day} (receipt {receiptNo}): the {scopeNoun}. | **changes** `paidClub`. The club paid the fee: no fee clause, no box |
| `refund.choice.all` | All of it to the card, {cardLabel} | **new.** First choice. Sub-line: `refund.arrives` "Arrives in 5 to 10 business days" (shipped). Not offered once the payment has a part refund on it (§7 question 3) |
| `refund.choice.part` | Part of it | **new.** Second choice. Sub-line `refund.choice.partSub`: "An amount up to {left}, with a reason" (12b's `end.cardPartSub` shape; the drawing's bare "Up to $100.00" lost the reason) |
| `refund.foot.choose` | Choose how much to refund. | **new.** The foot sentence, left, while nothing is picked; no button yet (the button appears once a choice is made, as 12b) |
| `refund.part.amount` | Amount to refund | Reuses 12b `end.cardPartAmount`. Required, with the asterisk |
| `refund.part.rest` | {rest} stays paid | **new.** Live, under the amount field. Not "The club keeps": the team paid it and it counts toward the entry |
| `refund.part.limit` | Up to {left}. | **new.** Hint under the field |
| `refund.part.feeNote` | The processing fee isn’t part of a part refund. | **new.** Added after the limit, only while the team paid a fee. Same sentence as `rec.card.amountPart`'s second half |
| `refund.part.reason` | Reason | Reuses 12b `end.cardPartReason`. Required. Hint `refund.part.reasonHint`: "The team reads this in the refund email." (12b's "The family reads this in their email." with the team) |
| `refund.noteLabel` / `refund.noteHint` | Note to the team / Goes in the refund email. | Shipped 12a, unchanged, under Reason |
| `refund.err.amount` | Enter an amount above $0 and up to {left}. | **Reuses 12b `cardPartAmountError`.** The drawing's "A part refund is more than zero and no more than $100.00." is retired: one refusal, one wording, in both flows |
| `refund.err.reason` | Say why only part is refunded. | **Reuses 12b `cardPartReasonError`.** The drawing's "Say why you’re refunding part of it." is retired for the same reason |
| `refund.part.already` | {refunded} already refunded on {day}. Up to {left}. | **new.** Hint line when the payment has a part refund on it; the field is capped at `{left}`. With more than one: "{refunded} already refunded in {n} refunds. Up to {left}." |
| `refund.part.bigger` | Up to {left} on this payment. Refund the rest from the {otherPossessive} ⋯. | **new.** Inline, when the typed amount is more than this payment holds and the team has another card payment (`{otherPossessive}` = `possessive("balance")` or `possessive("deposit")`). With no other payment: `refund.err.amount` |
| `refund.button` | Refund and email | Shipped. "All of it" |
| `refund.part.button` | Refund {amount} and email | **new.** Appears when the amount is valid |
| `refund.foot` | The team’s contact is emailed. | **new.** The foot sentence once a choice is made, left; Cancel and the button right (window-foot ruling). No address on file: "No email address on file. Tell the team yourself." (`refund.footNoEmail`) |
| `refund.working` | Refunding… | Shipped |
| `refund.doneToast` | Refunded {amount} to the card. We emailed {payerEmail}. | Shipped, transient |
| `refund.part.doneToast` | Refunded {amount} to the card. {rest} stays paid. We emailed {payerEmail}. | **new.** Without an address, "Refunded {amount} to the card. {rest} stays paid." |
| `refund.failed` | The refund didn’t go through. Nothing was refunded. Try again. | Shipped, inline and persistent |
| `refund.alreadyRefunded` | This payment was already refunded. | Shipped 12a. A second press, or a payment refunded in full |

**Choices that stay as shipped (12a).** `refund.whoLabel` "Who is ending this?", `refund.whoOrganizer` "The organizer is ending it",
`refund.whoTeam` "The team asked to leave", `refund.feeCheckbox` "Include the {fee} processing fee · {total} back" and its
three why lines. They show only under **All of it**. Part refunds that add up to the whole payment never give the fee back
(ask 1): only **All of it** can.

**A payment paid by bank debit** refunds to the bank account: the first choice reads "All of it to the bank account ending
{last4}" with the sub-line "Arrives in {bankDays} business days"; every "to the card" in the toasts and in this table
becomes "to the bank account" (the rail table, §3.9).

### 1.2 The payment row (the team's record › Received)

The row's date, label and amount stay as today ("Sep 18 · Deposit · Online, card · receipt 1061 · In ledger · $100.00"); the
tag sits under the label, and on a phone wraps to its own line. A part refund never strikes the row through.

| key | words | where / notes |
|---|---|---|
| `teamRow.refundedPart` | {amount} refunded to card, {day} | **new.** A part refund Stripe has finished. Quiet, no chip. The reason is in View the payment |
| `teamRow.refundedPartMore` | {amount} refunded to card · last {day} | **new.** Two or more part refunds on the row; `{amount}` is the sum |
| `teamRow.refundPendingPart` | Refunding {amount} to card… | **new.** Info chip, while Stripe works on it. The entry is already lowered (§1.3) |
| `teamRow.refundedPartStripe` | {amount} refunded to card, {day} · made in Stripe | **new.** A part refund made in the club's Stripe dashboard and recorded by itself (ask 4) |
| `teamRow.refundFailed` | Refund didn’t reach the card | Shipped, unchanged. Amber chip. A part refund adds the second line `teamRow.refundFailedSub` "{amount} sent back {day}" (**new**) |
| `teamRow.refunded` | Refunded to card, {day} | Shipped, unchanged. Struck through. A refund in full, whether at once or in parts that add up to the whole. `{day}` is the last one |
| `teamRow.menuRefund` | Refund to the card | Shipped. Stays in the ⋯ while something is left on the payment; hidden once it is refunded in full |
| `teamRow.menuAnotherWay` | Record the refund sent another way | **changes** (F6, already specified in the refund-visibility file). Offered on a refund that came back, part or whole |

### 1.3 The team's record: the entry adjustment (ask 3)

A part refund lowers that team's entry by the same amount, shown on the record with its reason. A full refund does not
(the team usually leaves), as today. The adjustment is the refund's own: nobody types a new fee.

| key | words | where / notes |
|---|---|---|
| `teamRec.entry` | Entry {entry} for this team, lowered {lowered} on {day} · {reason} | **new.** A line under the Payment summary, one adjustment. Example: "Entry $360.00 for this team, lowered $40.00 on Oct 27 · One game cancelled for weather" |
| `teamRec.entryHead` | Entry {entry} for this team | **new.** Two or more adjustments: the head line, then one `teamRec.entryLowered` per change |
| `teamRec.entryLowered` | Lowered {lowered} on {day} · {reason} | **new** |
| `teamRec.entryStripe` | Lowered {lowered} on {day} · made in Stripe | **new.** An adjustment from a refund made in Stripe, which has no reason to show (§7 question 4) |
| (summary) | Owes {owes} · paid {paid} of {entry} | Reuses `TEAM_RECORD_WORDS.owes` and `paidOf`, with the adjusted entry |
| (summary, paid whole) | Paid in full · {entry} | Reuses `paidInFull`. A team that had paid in full and got $40.00 back reads "Paid in full · $360.00" |
| `teamRec.owesFailed` | Owes {owes} · {amount} refund didn’t reach the card | **new.** The summary while a part refund is returned and not yet recorded as sent another way. Plain text; the amber chip is on the row |
| `teamRec.markPaid` | Mark paid · {owes} | Reuses `markPaid` with the adjusted figure |

⚠ **The drawing's example arithmetic does not add up** (the drawing writes "Owes $260.00 · paid $60.00 of $360.00", which
is $320.00, not $360.00). The words above are tokens and read right under either rule; the example figures in the build and
the walk need the owner's answer first (§7 question 1).

The team's pay page reuses `balanceHeading` ("Pay the balance, {balance}") and `paidSoFar` with the adjusted figures.

### 1.4 "View the payment" gets the refund block

The window (480 wide) shows each refund of the payment below its facts: the same block as the house-league record's "To the
card" (refund-visibility §2), with the team's nouns. Everyone who can open the record reads it; the treasurer reads it and
gets no button (§0f). **In this smaller window, the reference's Copy is the symbol alone** (owner note, 2026-10-26).

| key | label | words | where / notes |
|---|---|---|---|
| `payView.refund.heading` | (heading) | To the card | Reuses `rec.card.heading`. Status pill beside it: Refunded / Pending / Refund didn’t reach the card (reuses `rec.card.pill.*`); tag "Made in Stripe" (`rec.card.tag.stripe`) |
| `payView.refund.amount` | Amount | {amount} to {cardLabel} | Reuses `rec.card.amount`. Under it, a part refund: "Part of the {scopeNoun}. A part refund never includes the processing fee." (`payView.refund.amountPart`, **new**, the same second sentence as `rec.card.amountPart`) |
| `payView.refund.fee` | Processing fee | Given back with the whole payment · Not refunded. A part refund never includes it. | Reuses `rec.card.fee.whole` and `rec.card.fee.keptPart`; only while the team paid a fee |
| `payView.refund.reason` | Reason | {reason} | A part refund. Always present when pressed here |
| `payView.refund.entry` | Entry | Lowered {lowered} to {entry} | **new.** A part refund |
| `payView.refund.by` | Refunded by | {who}, {day} at {time} | Reuses `rec.card.by`; made in Stripe: `rec.card.byStripe` |
| `payView.refund.ref` | Stripe reference | {reference} ⧉ | The ⧉ is the symbol alone; accessible name `rec.card.copyAria` "Copy the Stripe reference"; transient `rec.card.copied` "Copied" |
| `payView.refund.emailed` | Team emailed | {payerEmail}, {day} | **new.** None on file: "No email address on file. Tell the team yourself." Failed refund: "Not emailed. Contact the team to arrange another way." (the refund-visibility ruling 6, never for a failed refund) |
| `payView.refund.button` | | Record the refund sent another way | The failed block's button, 44px on a phone (F6) |

### 1.5 The team's refund email (the part variant, with the new balance)

Subject, envelope, reply-to and "Questions" are 12a's. The block is the refund-visibility block (`refundEmail.block.*`),
unchanged, so the team and a family read the same thing.

| key | words | where / notes |
|---|---|---|
| `refundEmail.subject` | Refund from {clubName} | Shipped. `[Test] ` prefix in test mode |
| `refundEmail.preheader` | {amount} refunded to your card. | Refund-visibility key, reused |
| `refundEmail.lead` | {teamNamePossessive} payment for {tournamentName} was refunded. | Shipped. Full refund |
| `refundEmail.leadPart` | {amount} of {teamNamePossessive} {scope} for {tournamentName} was refunded. | **new** (the house-league `refundEmail.leadPart` says "registration fee"; a team's payment is a deposit, a balance or an entry fee). Example: "$40.00 of Riverside Rockets 12U’s deposit for the Northfield Fall Classic was refunded." |
| `refundEmail.reason` | {clubPossessive} reason: {reason} | Reuses 12b. A part refund; the club's name, as the house-league email |
| `refundEmail.note` | {note} | Shipped. The organizer's note, verbatim, in its own paragraph |
| block | Refunded · To · On · Refund reference · Your receipt | Reuses `refundEmail.block.*`. "Your receipt" reads "1061 (paid Sep 18)" |
| `refundEmail.feeKept` | The {procFee} processing fee isn’t part of this refund. | Shipped 12a. On a part refund whenever the team paid a fee. `feeIncluded` ("This includes the {procFee} processing fee.") on a refund in full with the box ticked |
| `refundEmail.arrives` | It takes 5 to 10 business days to appear. | Refund-visibility key. Own line under the block (the drawing's one sentence "… isn’t part of this refund. It takes 5 to 10 business days to appear." is the same words on two lines) |
| `refundEmail.balanceNow` | The balance is now {balance}, due {date}. | **new.** Part refund; a balance is still to pay. No date: "A {balance} balance is still to pay." (shipped `receiptBalance`) |
| `refundEmail.entryNow` | The entry fee is now {entry}. | **new.** Added before the balance line, so the team sees what changed |
| `refundEmail.paidInFull` | {teamName} is paid in full. | **new.** Instead of the balance line when nothing is left |
| `refundEmail.questions` | Questions: {contactEmail}. | Shipped. Without a contact: "Questions go to {clubName}." |
| `refundEmail.testNote` | Test mode: no money moved. | Shipped, last, in test mode |

The email's date in the block is the refund's own date, never the day it was sent (refund-visibility decision 9; the code
finding on `sendRefundEmail` holds here too).

### 1.6 Needs attention

Goes to whoever runs tournaments, never the treasurer.

| key | words | where / notes |
|---|---|---|
| `attention.refund.title` | {teamNamePossessive} refund didn’t reach the card | 12a words (`attention.refund.title`), carried by a part refund too |
| `attention.refund.body` | {refundAmount} to {cardLabel} was returned, for example because the card was closed. Send {teamName} the money another way, then record the refund. | **changes** shipped `refundFailedBody`, which names no amount. A team can now have a part refund and a later one, so the item names which |
| `attention.refund.button` | Record the refund sent another way | **changes** (F6). Opens the team's record at that payment's refund block |
| `attention.refund.settled` | Refund recorded | Shipped |
| `ONLINE_NOTICE_WORDS.partialInStripeBody` | "{description}: {amount} was refunded in Stripe, which is only part of the payment. Record the change by hand." | **Retired.** A part refund made in Stripe records itself (ask 4); nothing is asked of a person |

### 1.7 Help: `lib/help-content/tournaments.tsx`, "Refunding a card payment" and its neighbours (for `/docs` to apply)

| where | old | new |
|---|---|---|
| line ~1114, the lead | Refunds to the card are **full refunds only**. Whoever runs tournaments can make them; the treasurer doesn’t refund. | You can refund all of a card payment or part of it. Whoever runs tournaments can make them; the treasurer doesn’t refund. |
| step 2 | The window, titled for the team (for example *Refund Thunder’s payment?*), says what the team paid and the card it goes back to. It arrives in 5 to 10 business days. | The window, titled for the payment (for example *Refund Thunder’s deposit?*), says what the team paid and the card it goes back to. It arrives in 5 to 10 business days. |
| step 3 | If the team paid the processing fee, answer **Who is ending this?** and decide the fee box (below). | Choose **All of it** or **Part of it**. For all of it, if the team paid the processing fee, answer **Who is ending this?** and decide the fee box (below). For part of it, type the amount and a reason: the processing fee is never part of a part refund. |
| new definition in the `HelpDefs` | | **Part of it**: the amount is up to what is left on that payment. The reason goes in the team’s refund email. A refund bigger than one payment is made from each payment’s ⋯ in turn. |
| line ~1128, "What changes afterward" | …no longer counts toward what the team has paid, so the team shows as owing again. | For a refund in full, … (unchanged). **Add:** A part refund lowers that team’s entry by the same amount, and the record shows the new entry with your reason. The team’s email gives the new balance. |
| line ~1138, refund trouble | …choose **Record a refund made another way** from the row’s **…** and press **Record the refund**… A full refund you make in the Stripe dashboard lands in the record by itself. | …choose **Record the refund sent another way** from the row’s **…** and press **Record the refund**… A refund you make in the Stripe dashboard, whole or part, lands in the record by itself, tagged *made in Stripe*. |
| line ~1139, the warning | …A full refund made there is recorded here for you; a part refund raises a Needs attention item to record by hand. | …A refund made there, whole or part, is recorded here for you. |
| line ~1105 | …**View the payment**, a read-only window with the day, the card, the entry fee, the processing fee (and whether the team or the club paid it), the total, and who it came from. | …and, once there is a refund, each refund with its amount, status, reason and Stripe reference. |
| `searchText` / keywords | | add: part refund, refund part of a payment, entry lowered, made in Stripe |

Found while reading, not this round's: line ~1104 still says the treasurer can email the pay link; §0f ruled that the
treasurer does not (a drift for `/docs`). The bank-debit help (a new article) is `/docs`'s own task once the words in §2 and
§3 are accepted; §6 decision 15 lists its lines.

---

## 2 · Bank debit: what the family sees

Rail words: **card** keeps every shipped word. **Bank debit** is a second button in the same pay block, in the club's
colour, outlined, with the bank icon. A pay button's label is **one row**; the fee is the note under it (owner note,
2026-10-26). A bank debit takes days, so the family sees the state it is in, and never a Pay button while it is on its way
(ask 6).

### 2.1 The pay block: two buttons

The block is the shared 12a/12b component: the team pay page and the family status page read the same keys.

| key | words | where / notes |
|---|---|---|
| `payBlock.button` | Pay {total} by card | Shipped, unchanged. One row |
| `payBlock.buttonFeeNote` | Includes a {procFee} processing fee. | **changes** shipped "includes a {fee} processing fee": a note line under the button is a sentence, and the bank note beside it carries a second sentence (§6 decision 3). Only while families pay the fee (A14) |
| `payBlock.buttonBank` | Pay {debitTotal} by bank debit | **new.** One row, bank icon. Outlined |
| `payBlock.buttonBankNote` | Includes a {debitFee} processing fee. Takes up to 5 business days. | **new.** Note under the bank button, family-pays |
| `payBlock.buttonBankNoteClubPays` | Takes up to 5 business days. | **new.** The club pays the fee (A14, ask 9): both buttons stay, the label is the base amount ("Pay $150.00 by card", "Pay $150.00 by bank debit"), the card has no note, the bank one keeps this note |
| `payBlock.opening` | Opening the secure payment page… | Shipped. Replaces the pressed button's label; both buttons disabled |
| `payBlock.refundPolicyLink` / `otherWays` | Refund policy / Or pay another way: {howToPay} | Shipped, under the buttons. Not shown while a debit clears (below) |

The debit agreement the family accepts is on the processor's own page, as card details are; no word of it is written here.
A family who closes that page without finishing sees today's owing block (`payBlock.notFinishedTitle`, shipped); coming
back before we have been told, "Confirming your payment" (`payBlock.confirmingTitle`, shipped).

### 2.2 The states of a bank debit

| key | words | where / notes |
|---|---|---|
| **Clearing** | | The block's state heading in the info colour, then a sentence |
| `payBlock.clearingTitle` | Bank debit clearing | **new.** Heading |
| `payBlock.clearingBody` | {debitTotal} from the account ending {last4}, started {started}. Banks take up to 5 business days. We’ll email you when it clears. | **new.** Then the held line and the contact line. No last four: `payBlock.clearingBodyNoAccount` "{debitTotal} by bank debit, started {started}. Banks take up to 5 business days. We’ll email you when it clears." |
| `payBlock.clearingHoldOne` | {childPossessive} spot is held. | **new.** A team: "{teamNamePossessive} place is held." |
| `payBlock.clearingHoldMany` | Spots are held for {childList}. | **new.** One debit for brothers and sisters (12b, one checkout): every child on it clears or comes back together |
| `payBlock.clearingContact` | Wrong account, or a question? Contact {clubName} at {contactEmail}. | **new.** The page's exit; without a contact, "Wrong account, or a question? Contact {clubName}." |
| `famPay.lineClearing` | {childName} · {divisionName} · {fee} clearing | **new.** A line in the family block for a child on a clearing debit, beside `linePaid` and `lineChild`. A child on the sign-up who is not on the debit keeps `lineChild` and the buttons |
| `status.childClearing` | Fee {fee} · clearing | **new.** The status page's child line, beside `childOwing` and `childPaid` (12b) |
| **Cleared** | | The receipt, in the club's colour |
| `receipt.title` | Paid, thank you | Shipped, unchanged (the drawing's "Paid" is not used) |
| `receipt.methodBank` | Bank debit, account ending {last4} · started {started}, cleared {cleared} · receipt {receiptNo} | **new**, beside `receipt.method`. The receipt number is given now, not at the start |
| `receipt.lineFee` / `lineTotal` | Processing fee / Paid | Shipped. The drawing's "Total" row label is not used (§6 decision 12) |
| **Returned while clearing** | | |
| `payBlock.returnedTitle` | The bank debit didn’t go through | **new.** Heading |
| `payBlock.returnedBody` | Your bank returned it on {returnedDay}{reasonFull}. Nothing was taken. | **new.** `{reasonFull}` is ": the account is closed" and so on, or empty, giving "…returned it on Oct 29." Then the held line. The owing block follows, with both buttons |
| **Reversed after it cleared** | | A bank can reverse a debit after the receipt has gone out |
| `payBlock.reversedTitle` | A bank payment was returned | **new.** Heading above the owing block |
| `payBlock.reversedBody` | Your bank reversed the {debitTotal} debit on {returnedDay}{reasonFull}. Receipt {receiptNo} no longer counts, so {owesAgain}. | **new.** The family's page reads "owing" again and the buttons come back |
| `receipt.reversedTitle` | Returned by the bank | **new.** The old receipt page's heading once reversed. Line: "Reversed {returnedDay}. This receipt no longer counts." |

### 2.3 The bank's reason

The bank's return code is mapped to these words by the build; **anything it cannot map prints no reason** (the sentence
ends after the date). Two forms: a sentence form after a colon, and the short form in the Fee cell.

| the bank says | `{reasonFull}` | `{reasonShort}` |
|---|---|---|
| not enough money | : there wasn’t enough money in the account | not enough money |
| account closed | : the account is closed | account closed |
| details wrong or account not found | : the account details weren’t valid | invalid account |
| not authorized or stopped by the account holder | : the debit wasn’t authorized | not authorized |
| anything else, or no reason given | (nothing) | (nothing) |

### 2.4 The four emails (ask 8)

In the club's name, on the warm envelope with the club's identity (S3b), reply-to the club's contact. `[Test] ` prefix and
"Test mode: no money moved." last, in test mode. Dates "Oct 26, 2026". A team's version swaps `{childList}` for
`{teamName}`, `{seasonName}` for `{tournamentName}` and "spot" for "place".

| key | words | where / notes |
|---|---|---|
| **1 · The debit starts** (not a receipt) | | |
| `debitEmail.started.subject` | Your bank debit to {clubName} has started | |
| `debitEmail.started.preheader` | {debitTotal} from the account ending {last4}. It takes up to 5 business days. | |
| `debitEmail.started.lead` | Your bank debit for {childList} in {seasonName} has started. | |
| block | Amount {debitTotal} · From account ending {last4} · Started {started} | The warm envelope's small table; "From" is dropped without a last four |
| `debitEmail.started.notReceipt` | This isn’t your receipt. We’ll send it when the debit clears. | |
| `debitEmail.started.takes` | Banks take up to 5 business days. | |
| `debitEmail.started.held` | {childPossessive} spot is held. | Plural: "Spots are held for {childList}." |
| `payBlock.clearingContact` | Wrong account, or a question? Contact {clubName} at {contactEmail}. | Reused as the last line |
| **2 · It clears** (the receipt) | | |
| `receiptEmail.subject` / `thanks` / `lineItem` | Receipt {receiptNo} from {clubName} · Thanks, {payerName}. {clubName} received your payment. · {child} · {season} · {division} · {base} | Shipped, unchanged. The receipt number is given now |
| `receiptEmail.lineTotalBank` | Total paid · {debitTotal} · Bank debit, account ending {last4} · {cleared} | **new**, beside `lineTotal` |
| `receiptEmail.bankDates` | Your bank debit started on {started} and cleared on {cleared}. | **new** |
| `receiptEmail.questions` | Questions about this payment or a refund go to {clubName}: {contactEmail}. | Shipped |
| **3 · Returned while clearing** | | |
| `debitEmail.returned.subject` | Your bank debit didn’t go through | |
| `debitEmail.returned.lead` | Your bank returned your {debitTotal} debit for {childList} on {returnedDay}{reasonFull}. | |
| `debitEmail.returned.nothing` | Nothing was taken from your account. | |
| `debitEmail.returned.held` | {childPossessive} spot is still held. | Plural: "Spots are still held for {childList}." |
| `debitEmail.returned.pay` | Pay now | Button to the status page, where both buttons are back. Then `otherWays`: "Or pay another way: {howToPay}" when the club wrote one |
| **4 · Reversed after it cleared** | | |
| `debitEmail.reversed.subject` | A payment to {clubName} was returned | |
| `debitEmail.reversed.lead` | Your bank reversed a {debitTotal} payment to {clubName} on {returnedDay}. | |
| `debitEmail.reversed.reason` | Your bank’s reason{reasonFull}. | Only when the bank gave one, so the sentence reads "Your bank’s reason: the account is closed." |
| `debitEmail.reversed.owes` | Receipt {receiptNo} no longer counts, so {owesAgain}. | |
| `debitEmail.reversed.pay` | Pay now | Button to the status page |

### 2.5 A team pays: the pay page's saving line (ask 10) and states

| key | words | where / notes |
|---|---|---|
| `teamPay.savingLine` | {saveCard} less in processing fees by card, or {saveBank} less by bank debit, than paying the deposit and the balance separately. | **changes** `PAY_WORDS.savingLine` ("{saving} less in processing fees than paying the deposit and the balance separately."), which it extends: one sentence, both rails, both computed. Shown only while teams pay the fee, and only the rails the page offers; with card alone, today's sentence. The drawing's "Paying in full saves $X by card, or $Y by bank debit." drops what it saves against |
| `teamPay.clearingBalance` | The {balance} balance is due {date}. | Reuses `chooseDepositHint`, read as text beneath "Bank debit clearing" while the deposit clears: no Pay buttons, so the team can’t also pay in full |
| `teamPay.paidSoFar` | {teamName} has paid {paid} so far. | Shipped, unchanged. A debit still clearing is not in "paid" |
| (the clearing, returned and reversed states) | | §2.2 with `{teamName}` and "place" |

### 2.6 When the route refuses

| key | words | where / notes |
|---|---|---|
| `payError.clearing` | A bank debit for {childList} is clearing. You don’t need to pay again: {clubName} will email you when it clears. | **new.** The pay route's refusal, page and JSON. A team: "A bank debit for {teamName} is clearing…" |

### 2.7 Test mode

No new words: the shipped marks carry over. `test.payBlock` "Test payment: no money moves." on the pay block and receipt page;
`test.receiptPage` "Test payment · no money moved"; `test.emailSubjectPrefix` `[Test] ` on all four emails;
`test.emailLine` "This was a test payment. No money moved." as the first line of a test receipt. The desk's team-row tag
"Test, no money moved" (`TEAM_ROW_WORDS.test`) also sits on a test debit.

---

## 3 · Bank debit: what the desk sees

**Who.** House league: owner, club admin, league admin, registrar. Tournaments: whoever runs tournaments. The treasurer
reads Money and the rows and never gets a door (§0f).

### 3.1 The Fee cell (Registrations, and a phone row's detail lines)

The first line keeps the fee figure (the refund-visibility ruling 2); the debit's total is on the second.

| key | words | where / notes |
|---|---|---|
| `regs.fee.clearing` | {fee} clearing | **new.** First line, an info chip. Example: "$150.00 clearing" |
| `regs.fee.clearingSub` | Bank debit · {debitTotal} · started {started} | **new.** Second line. (The drawing runs "Bank debit · $154.75 started Oct 26" together; the separator is added) |
| `regs.fee.clearingSubSibling` | Part of one {debitTotal} bank debit with {siblingList} · started {started} | **new** |
| `regs.fee.clearingTip` | A bank debit of {debitTotal} started on {started}. The registration fee is {fee}; the rest is the processing fee. Banks take up to 5 business days. It goes in the season’s book when it clears. | **new.** Tap-for-detail. The fee clause is dropped when the club pays the fee |
| `regs.fee.returned` | Bank debit returned {returnedDay} · {reasonShort} | **new.** Second line under today's `F.owingDays` (amber, "$150.00 owing · 12 days"). No reason: "Bank debit returned {returnedDay}" |
| `regs.fee.reversed` | Returned by the bank {returnedDay} · receipt {receiptNo} | **new.** Second line after a debit that had cleared; the first line is owing again |
| `regs.fee.aria` | {name}: {primary}. {sub} {third} | Shipped, reused |

### 3.2 What is absent while it clears, and what is refused

While a debit clears, **Mark received**, **Email the pay link** and the bulk "Email families who owe" are not offered for
that row (absent, not dimmed). So there are no words for them. The words are only where a person or a route runs into it.

| key | words | where / notes |
|---|---|---|
| `regs.bulk.emailLinkPartial` | {n} pay links sent; {m} skipped: {why}. | Shipped (12b). `{why}` gains **"a bank debit is clearing"** beside "nothing owing" and "no email" |
| `err.clearing` | A bank debit for {name} is clearing, so there’s nothing to mark received yet. If the family also paid another way, record it after the debit clears or comes back. | **new.** The writer's refusal (a stale window, a bulk action) |
| `err.clearingLink` | A bank debit for {name} is clearing, so there’s no pay link to send yet. | **new** |
| `teamErr.clearing` | A bank debit for {teamName} is clearing, so Mark paid isn’t available yet. It goes in the record when it clears. | **new.** A team's version |

### 3.3 Decline and Withdraw while a debit clears (ask 7)

The ending happens now and the window asks up front what happens to the money **when it clears**. Nothing is picked when it
opens, and the button appears once a choice is made (as 12b). A card payment lands in seconds, a debit takes days, so this
is the common case. The window's title is today's ("Decline Henry Kim?", "Withdraw Henry Kim?").

| key | words | where / notes |
|---|---|---|
| `end.clear.lead` | A bank debit of {debitTotal} is still clearing. It isn’t in the season’s book yet. When it clears: | **new.** Lead |
| `end.clear.leadSibling` | {childPossessive} {base} share of a {debitTotal} bank debit with {siblingList} is still clearing. It isn’t in the season’s book yet. When it clears: | **new.** The child's share is named; then `end.clear.siblingNote` |
| `end.clear.siblingNote` | The rest of the debit stays with {siblingList}. | **new.** Declining one child sends back that child's share only |
| `end.clear.sendBack` | Send it back to the bank account | **new.** First choice. Nothing picked on open |
| `end.clear.sendBackSubDeclined` | With the processing fee, because the club is declining. It goes back by itself when it clears, in your name. | **new.** The drawing's "(A2)" is not customer copy and is dropped. Club pays the fee: "The {base} goes back by itself when it clears, in your name." |
| `end.clear.sendBackSubWithdrawn` | Without the processing fee, because the family asked to leave. It goes back by itself when it clears, in your name. | **new.** Not drawn; follows A2's default for a Withdraw (§7 question 5 asks whether the box returns) |
| `end.clear.keep` | Keep it | **new.** Second choice. Sub-line `end.clear.keepSub`: "Say why. It goes in the book as kept by the club." Choosing it opens today's required "Say why" field (`keptReasonHint`, shipped) |
| `end.clear.footChoose` | Choose what happens to the {base}. | Reuses `END_WORDS.footChoose`'s shape. Foot, left, until a choice is made |
| `end.clear.footBack` | The family is emailed that {name} was {notAcceptedOrWithdrawn} and that {backAmount} goes back to their account if the debit clears. | **new.** Foot, left. `{notAcceptedOrWithdrawn}` = "not accepted" / "withdrawn", as shipped `hintCard` |
| `end.clear.footKept` | The family is emailed that {name} was {notAcceptedOrWithdrawn} and that the club keeps the {base} if the debit clears. | **new** |
| `end.clear.submit` | Decline, send it back and email · Withdraw, send it back and email | **new.** After "Send it back". "Keep it": today's `Decline and email` and `Withdraw` labels, unchanged |
| `end.clear.working` | Declining… · Withdrawing… | **new** |
| `end.clear.doneBack` | Declined {name}. {backAmount} goes back to the account if the debit clears. We emailed {guardianEmail}. | **new.** Transient. "Withdrew {name}." for a Withdraw. Without an address: "…There’s no email address on file, so tell the family yourself." |
| `end.clear.doneKept` | Declined {name}. The club keeps the {base} if the debit clears. We emailed {guardianEmail}. | **new** |
| `endMail.clearBack` | Your {debitTotal} bank debit is still clearing. If it clears, we’ll send {backAmount} back to the same account. It takes {bankDays} business days to appear. | **new.** The ending email's money sentence, in place of "We refunded…". `{bankDays}` per §7 question 6 |
| `endMail.clearKept` | Your bank debit is still clearing. If it clears, {clubName} is keeping the {base}. The reason: {reason}. | **new.** Reuses the shape of `endMail.keptRest` |

The send-back happens **when the debit clears**, by itself, in the person's name who declined ("Refunded by"). If the debit is
**returned** instead, nothing happens: nothing was taken, and the family was told at the decline that the money goes back
only if it cleared. If the send-back **fails** when it is sent, it raises the refund-didn’t-reach item (§3.6), worded for a
bank account.

A team's version (tournaments): the same keys with `{name}` the team, "the family" "the team’s contact", "Withdraw" the
team's own. The tournament's refund window is not the ending window, so a declined or withdrawn team's clearing debit asks
this question in the team's record (ask 7).

### 3.4 The Money band: the Clearing tile (A11, ask 5)

A fourth figure, **Clearing**, only while a bank debit is on its way, so the band still adds up (owed = received + clearing +
still owing). The figure is plain like every total on the band; the caption carries the meaning.

| key | words | where / notes |
|---|---|---|
| `band.clearing` | Clearing | **new.** The tile's label. Not "Processing" (§5) |
| `band.clearingCaption` | {n} players · bank debits | **new.** One: "1 player · bank debit". The same words on a phone (the drawing's phone "4 · bank debits" dropped "players" while its neighbours kept it) |
| `band.afterRefunds` | after {amount} refunded | Shipped, now alone under Received |
| `band.byCard` | {amount} of it by card | **changes**: leaves the Received caption (it was too long beside "after $515.00 refunded") and moves to the band's note, below |
| `band.note.card` | {card} of what’s received came by card. | **new.** The note under the band, card only (today's content, moved) |
| `band.note.bank` | {bank} of what’s received came by bank debit. | **new.** Bank only |
| `band.note.both` | {card} of what’s received came by card and {bank} by bank debit. | **new** |
| `band.note.clearing` | Clearing counts the registration fees only, before processing fees. It moves to Received as each bank debit clears. | **new.** Added only while the tile shows. The drawing's "Clearing shows only while a bank debit is on its way, and counts fees only" is the same, in plainer words |
| `band.aria` | Owed {owed}. Received {received}. Clearing {clearing}. Still owing {owing}. | **changes** shipped `band.aria`; "Clearing" only while shown |

The Overview's two money tiles are not drawn for this round and are not worded here.

### 3.5 The book

A clearing debit is not in the book (it is not received). Receipts and reversals are:

| key | words | where / notes |
|---|---|---|
| `money.line.bank` | Registration fee · online, bank debit · receipt {receiptNo} | **new**, beside `money.line.card` |
| `money.how.bank` | Online, bank debit · receipt {receiptNo} | **new.** The How column. The method word is `paymentMethodWord("online_bank")` = "Online, bank debit" |
| `money.line.reversed` | Returned by the bank · receipt {receiptNo} | **new.** The What column of a reversal: a returned line, out of the book (never by deleting the receipt). On Every line and Still owing; not in Refunds, which is the club's own act. With a reason: "Returned by the bank · {reasonShort} · receipt {receiptNo}" |
| `money.line.refundBank` | Refund to the bank account · {why} | **new**, beside `money.line.refundCard`. The refund-visibility How words swap by rail (§3.9) |
| `money.line.processing` | Payment processing · {childName} | Shipped. The cost line, unchanged |
| `money.line.processingReturned` | Payment processing · returned debit · {childName} | **Held.** Only if Stripe's current terms (the build checks, then `/billing`) charge the club for a returned debit; if not, never built |

### 3.6 Needs attention (to the desk; each clears itself)

| key | words | where / notes |
|---|---|---|
| `attention.debitReturned.title` | A bank debit for {childList} was returned | **new.** One item per debit, naming every child on it. A team: "{teamNamePossessive} bank debit was returned", to whoever runs tournaments |
| `attention.debitReturned.body` | {debitTotal} from the account ending {last4} didn’t go through ({returnedDay}{reasonFull}). Nothing was taken, and {spotsHeld} still held. We emailed the family a way to pay. | **new.** No reason: "({returnedDay})". No address on file: "…There’s no email address on file, so tell the family yourself." A team: "…{teamNamePossessive} place is still held. We emailed the team’s contact a way to pay." |
| `attention.debitReturned.button` | Open {childPossessive} record | **new.** One child. Siblings: "Open the registrations". Plus Done |
| `attention.debitReturned.settled` | Paid in full. | Reuses `SETTLED_WORDS.paidInFull` when the family pays; `SETTLED_WORDS.withdrawDone` "The registration has ended." if the desk ends it |
| `attention.debitReversed.title` | {childPossessive} bank payment was returned after it cleared | **new.** Siblings: "A bank payment for {childList} was returned after it cleared" |
| `attention.debitReversed.body` | The bank reversed receipt {receiptNo} ({debitTotal}) on {returnedDay}. It’s out of the season’s book, and {owesAgain}. We emailed the family a way to pay. | **new** |
| `attention.debitReversed.button` | Open {childPossessive} record | **new.** Plus Done |
| `attention.refund.title` | {childPossessive} refund didn’t reach the bank account | **changes by rail** (§3.9). A send-back that failed when the debit cleared |
| `attention.refund.body` | {refundAmount} to the account ending {last4} was returned, for example because the account was closed. Send the family the money another way, then record the refund. | **changes by rail.** The button is the one name, "Record the refund sent another way" (F6) |
| `kind.debitReturned.label` | A bank debit was returned | **new.** Notification kind, only if the build makes one |
| `kind.debitReturned.desc` | A bank debit was returned while it was clearing. Nothing was taken. The family was emailed a way to pay. | **new** |
| `kind.debitReversed.label` | A bank payment was returned after it cleared | **new** |
| `kind.debitReversed.desc` | The bank reversed a payment that had cleared. It’s out of the book and the amount is owing again. | **new** |

### 3.7 A team's record while a debit clears

| key | words | where / notes |
|---|---|---|
| `teamRow.methodBank` | Online, bank debit · receipt {receiptNo} | **new**, beside `TEAM_ROW_WORDS.method`. After it clears |
| `teamRow.clearing` | Clearing | **new.** An info chip on the row |
| `teamRow.clearingSub` | Started {started} · up to 5 business days | **new.** Under the chip. Example: "Oct 26 · Deposit · Online, bank debit · Clearing · Started Oct 26 · up to 5 business days · $100.00 ⋯" |
| `teamRec.owesClearing` | Owes {owes} · {amount} clearing | **new.** The summary. "Owes" stays plain, not amber: the only thing owing is on its way |
| `teamRec.balanceClearing` | {amount} clearing | **new.** Replaces "past due" on a balance whose due date passes while it clears |
| `teamRow.debitReturned` | Bank debit returned {returnedDay}{reasonShortDot} | **new.** On the due row after a return while clearing. `{reasonShortDot}` = " · account closed", or nothing |
| `teamRow.debitReversed` | Returned by the bank, {returnedDay} | **new.** Struck through, as `refunded` is, after a debit that had cleared; the team owes it again |
| `payView.bank` | Bank account | **new.** The view's label in place of "Card"; value "Account ending {last4}". Rows "Started" and "Cleared" with their dates |
| (absent) | | Mark paid is not offered while a debit clears; `teamErr.clearing` (§3.2) for a stale window |

A returned debit raises `attention.debitReturned` (§3.6) to whoever runs tournaments. The tournament Money view gets no new
figure: it is a list of payments, and the clearing row says it.

### 3.8 "Disconnect payouts?"

| key | words | where / notes |
|---|---|---|
| `disconnect.clearing` | {n} bank debits are still clearing. They’ll finish, and their money still reaches you. | **new.** Between `disconnect.owing` and `disconnect.past`. Not shown at 0 |
| `disconnect.clearingOne` | 1 bank debit is still clearing. It’ll finish, and its money still reaches you. | **new** |

A debit chosen to **send back** after payouts are disconnected is a question for §7 (question 5).

### 3.9 The rail table: one set of words, two rails

Everything the refund-visibility file wrote for a refund to a card reads the same for a refund to a bank account, with these
swaps. `{target}` below is the account's own label.

| string (keys in the refund-visibility and 12a files) | for a bank account |
|---|---|
| `rec.card.heading` "To the card" | To the bank account |
| `regs.fee.toCard` "{refundAmount} to the card" · `money.how.toCard` "To the card" | {refundAmount} to the bank account · To the bank account |
| `regs.fee.refundFailed` / `rec.card.pill.failed` "Refund didn’t reach the card" | Refund didn’t reach the bank account |
| `rec.card.amount` "{refundAmount} to {cardLabel}" | {refundAmount} to the account ending {last4} |
| `rec.card.reached` "Reached the card" | Reached the bank account. Sub-line: "It takes {bankDays} business days to appear on the family’s statement." |
| `rec.card.status` "…waiting on the card’s bank…" | Stripe accepted it {day} at {time} and is waiting on the bank. It’s already in the season’s book. Nothing to do. |
| `rec.card.what` "…the card’s bank sent it back…for example because the card was closed…" | Sent {day}; the bank sent it back {day}, for example because the account was closed. The club still owes it. |
| `refundEmail.preheader` "…refunded to your card." | {refundAmount} refunded to your bank account. |
| `refundEmail.block.to` "{cardLabel}" | Bank account ending {last4} |
| `refundEmail.arrives` "It takes 5 to 10 business days to appear." | It takes {bankDays} business days to appear. |
| `end.cardFull` / `refund.choice.all` "…to the card, {cardLabel}" | …to the bank account ending {last4} |
| `refund.doneToast`, `end.doneCard` | "…to the card" becomes "…to the bank account" |
| `attention.refund.*` | §3.6 |

---

## 4 · Payouts: both rates, everywhere a rate prints

Every line is printed from the two labels, never typed. The same words on League and Club ("families and teams") and
Tournament Plus ("teams") as 12b set them. A club whose account does not take bank debit prints today's card-only line.

| key | words | where / notes |
|---|---|---|
| `payouts.ratesLine` | Processing fee: {cardRate} per card payment, {bankRate} per bank debit. | **changes** `PAYOUTS_WORDS.ratesLine`. On the card in every state but Disconnected |
| `payouts.notSetUp.body` | Payments go straight to your bank account through Stripe. A card payment has a processing fee of {cardRate} and a bank debit {bankRate}, and you choose who pays it. Stripe will ask for your legal name, a signing officer and your bank account. | **changes** `notSetUpBody`. The not-set-up line |
| `before.costRate` | {cardRate} per card payment · {bankRate} per bank debit | **changes** `before.costRate`. Under "What it costs", each on its own line on a phone |
| `before.costExample` | On a {exampleBase} fee, the processing fee is {exampleCardFee} by card and {exampleBankFee} by bank debit. | **changes** `costExample` ("On a {base} fee, the card fee is {fee}."). Three tokens computed on the server, never typed |
| `record.feeRates` | {cardRate} per card payment · {bankRate} per bank debit | **changes** `record.feeRates`. Beside the who-pays choice (A14), reading and editing |
| `before.whoTeamsHint` / `whoClubHint` | (unchanged) | The hints say who pays, not how much; the fee differs by rail and the page shows each rail's fee before paying. No new words |
| `record.choiceTeamsHint` | Added to what the family or team pays. You receive the full fee. | Shipped 12b, unchanged. True on both rails |

Not changed: `payouts.taking.body`, the Disconnected state (no rate line), and the club's `How to pay` text.

---

## 5 · The rename: A11's "Processing" becomes "Clearing"

Ruled (ask 5): **Clearing** replaces **Processing** for a bank debit on its way, everywhere (the Money figure, the row, the
family's page). **"Payment processing" stays** the cost line's word, and "Processing fee" stays the fee's.

**Shipped code:** nothing says "Processing" for a debit; nothing about a debit is built. There is nothing in `lib/` or
`components/` to change. The only shipped "Processing" strings are the fee's and the cost line's (`MONEY_PAGE_WORDS.what.processing`
"Payment processing · …", `processingBack`), all unchanged. The Stripe-side value `processing` on an online payment's state is
an identifier (the processor's own word); it stays, and no screen prints it.

**Documents that still say "Processing" for a debit (list only; none edited here):**

- `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` — A4 (line 40, "'Processing' is a state of the payment"); A11 (line 50, "a fourth
  figure, 'Processing'"); §0i (line 327); §0j item 3 (line 342, "the 'Processing' state, the fourth Money figure"); §3 Design
  (line 422 "six states: owing, processing, paid…", line 436 "Payment state (owing / processing / paid…)", line 453 "Money
  band gains 'Processing'"); §4 ladder, the 12c row (line 463, "Processing until it clears… a fourth 'Processing'
  figure"); §5 Asks (line 472, A4 "processing state"). The ruled ask 5 itself (line 356) already says "Clearing".
- `CLUB_TIER_STAGE12_DRAWINGS.html` (the October drawings): "PROCESSING · paid by bank debit", "Bank debit processing"
  (pay block and receipt), "$165 processing · bank debit, started Oct 24" (the row), the band tile "Processing $150 · 1 bank
  debit clearing", the note "Processing is a fact about the payment", the state list "Owing, processing, paid, failed,
  refunded", and the A11 checkbox "A fourth figure, Processing, only while there is some".
- `CLUB_TIER_STAGE12B_BUILD_PROMPT.md` — line 40 ("A4/A11/L2 bank debit and 'Processing' are 12c") and line 197.
- `CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_DRAWINGS.html` — only in the paragraph that proposes the rename (kept as the
  record of it) and the sentence under frame 3's band.
- Not renamed and correct: every "Payment processing" (cost line), every "Processing fee", and the 12a copy file's
  `payouts` and `refund` strings, which are the fee.

---

## 6 · Decisions

1. **"Clearing" is the one word for a debit on its way**, on the Fee cell chip, the band tile, the pay block's heading, the
   team row's chip and the status page's child line. "Processing" is left to the fee and the cost line (ask 5).
2. **A pay button is one row; the fee is the note under it** (owner note). Card: "Pay {total} by card"; bank: "Pay
   {debitTotal} by bank debit". The note is a sentence ("Includes a {procFee} processing fee."), and the bank note adds
   "Takes up to 5 business days." on the same note line.
3. **The shipped card note changes from a lowercase fragment to a sentence.** `payBlock.buttonFeeNote` reads "includes a {fee}
   processing fee" today; it is its own line under the button now, and sitting beside a bank note that has two sentences, a
   fragment would read as unfinished. Capital and full stop.
4. **The club paying the fee keeps both buttons** and says the base on each; only the bank button carries a note, because
   the wait is the one thing that differs (ask 9).
5. **A part refund (tournaments) reuses house league's rules and words, not the drawing's second wording.** The amount
   refusal, the reason refusal, the "Amount to refund" label and "An amount up to {left}, with a reason" are 12b's shipped
   strings. The drawing's own refusals and its bare "Up to $100.00" are retired, so two flows never say one thing two ways.
6. **A part refund's line says "{rest} stays paid"; house league says "The club keeps {rest}."** Both are right: the team paid
   it and it counts toward the entry; the club's keeping is the family-refund idea.
7. **The record says "Entry {entry} for this team, lowered {lowered} on {day} · {reason}",** with the reason on the record
   itself, so a part refund never reads as a debt (ask 3). A refund in full does not lower the entry.
8. **The pay block, not the status line, says why a family cannot pay again:** "Bank debit clearing" with the held line and
   the contact line. A link that dead-ends would be the bug the drawing named.
9. **A returned debit says "Nothing was taken."** as drawn. The build confirms, against Stripe's current docs, that this is
   always true of a return while clearing; if it is not, the sentence changes to "You haven’t been charged." before shipping.
10. **A reversal after it cleared is a returned line, never a deleted receipt.** The family's old receipt page says "Returned
    by the bank", and the family block says owing again.
11. **The email's spot sentence never promises how long a spot stays held.** How long is the club's call today. The desk
    withdraws if the family never pays.
12. **Shipped receipt words win over the drawing's:** the page is "Paid, thank you" with a "Paid" total, not "Paid" and
    "Total". One component serves both rails.
13. **The bank's reason is mapped, and unmapped prints nothing.** The sentence ends after the date rather than guessing.
14. **The Money band's card/bank split moves to its note**, which changes the Received caption 12b and the refund-visibility
    file called unchanged. The drawing's review found it far too long beside "after $515.00 refunded".
15. **Bank-debit help is `/docs`'s task** once these words are accepted. Its lines: how a family pays by bank debit and why
    it takes days; what Clearing means on a row and on the band; why Mark received and the pay link are not offered while it
    clears; what Decline or Withdraw asks; what a returned debit and a reversed debit do (item, email, book line); "Before
    you set up payouts" now names both rates.
16. **This file never says "Stripe" to a family.** Two shipped 12a lines do (`payBlock.confirmingBody`, "Stripe has your
    payment…"; `notFinishedBody`, "You left Stripe’s page…"), against 12b's own rule. Not changed here; a one-line sweep
    for the build prompt.
17. **The treasurer reads every new row, band figure and item and never gets a button** (§0f).
18. **A club that does not offer bank debit reads today's words.** Nothing in §2 or §3 appears for it, and §4 prints the
    card-only line.

## 7 · Open word questions for the owner

**RULED 2026-10-26 (owner): all as recommended.** Question 1 was settled as a correction, not a new rule: "entry less net
paid" was the ruled intent (the refund is never owed back), the drawing's $260.00 was an arithmetic slip, and the drawing now
reads "Owes $300.00 · paid $60.00 of $360.00" (plan §0j ruling 3 carries the correction). Questions 2–8 accepted as
recommended. The questions as asked, for the record:

Each has a recommendation. None reopens a ruling.

1. **The drawing's team-record arithmetic is wrong, so one number rule is needed before the words are used in a walk.** Frame
   1, option A, reads "Owes $260.00 · paid $60.00 of $360.00" (and "the team's pay page asks $260.00 for the balance"). Those
   do not add up ($60.00 + $260.00 = $320.00). Ruling 3 says "a deposit-only team's balance drops". Taken literally, a team
   that paid a $100.00 deposit and got $40.00 back has net paid $60.00; against the lowered entry of $360.00 it owes
   $300.00, **the same balance as before**, not $260.00. The balance only drops when the refund came out of money beyond the
   entry (a team paid in full: "Paid in full · $360.00", which is right). **Recommendation:** keep the words as tokens (they
   are right either way) and have the build prompt state the rule as "entry less net paid", so a deposit-only team's
   example reads "Owes $300.00 · paid $60.00 of $360.00". If the owner meant the balance to fall by the refund, that is a
   different rule (the refund counted as credit against the balance) and ruling 3 needs its words.
2. **"All of it to the card" or "Refund to the card".** The ruled drawing's first choice in the team window is "All of it to
   the card, Visa •••• 4242" with "Part of it" (and the ruling names "All of it"). The shipped house-league window says
   "Refund to the card, {card}" and "Refund part of it", because its third choice, "Kept by the club", is what the first
   contrasts with. **Recommendation:** tournaments take the drawing's pair (a window of two choices reads as "all or part");
   house league keeps its shipped words. Same act, two phrasings, each right in its own window. If the owner wants one phrasing
   everywhere, "Refund to the card" and "Refund part of it" in both is the smaller change.
3. **After a part refund, is "All of it" still offered on that payment?** The drawing says only "All of it" can give the
   processing fee back, and a payment with a part refund on it has no "all" left. **Recommendation:** no: it opens straight
   on the part form capped at what is left, the fee never goes back, and the "All of it" row is absent (not dimmed).
4. **A part refund made in Stripe has no reason to show.** Ask 4 records it ("made in Stripe") and lowers the entry, but the
   reason is required when the refund is pressed here and absent when it is made there. **Recommendation:** the entry line
   reads "Lowered {lowered} on {day} · made in Stripe" (`teamRec.entryStripe`), the team gets the same refund email without a
   reason line, and the desk can add context in the club's Stripe notes. Say if a made-in-Stripe refund should not email the
   team.
5. **Decline or Withdraw while a debit clears: is the fee box back?** A2 says the convenor can change the fee each time, and
   the card window has the box under its refund choice. The drawing shows only a sub-line that states the fee by mode, no
   box. **Recommendation:** add the same box (`end.feeBox`, reused) under "Send it back", defaulted as A2 (on for Decline, off
   for Withdraw), and let the sub-line become the box's why line. If the owner wants the drawing as drawn, the words in §3.3
   stand.
6. **How long a refund to a bank account takes, and "up to 5 business days" for a debit.** The drawings leave both to a Stripe
   fact the build checks (plan §0j). No number is printed here for a refund (`{bankDays}`). **Recommendation:** the build
   confirms both against Stripe's current docs before any word ships; if the refund time cannot be stated honestly, the
   sentence goes ("It takes {bankDays} business days to appear.") rather than shipping a guess.
7. **After payouts are disconnected, can a clearing debit still be sent back?** `disconnect.past` says refunds of past
   payments are made in Stripe, and "Refund to the card" is hidden once disconnected (12a question 5). A debit chosen to "Send
   it back" would be refunded after the disconnect, by the platform, with nobody to press it. **Recommendation:** while a
   debit is clearing, Disconnect warns it first (`disconnect.clearing` above) and the "Send it back" row is not offered once
   disconnected, so the window shows only "Keep it" and says "Payouts are disconnected. Refund it in Stripe when it
   clears." (`end.clear.disconnected`, to word once this is ruled).
8. **A team row says "to card"; house league says "to the card".** Shipped tournament words ("Refunded to card, Oct 27"),
   walked and ruled, against the house-league Fee cell's "{amount} to the card". **Recommendation:** leave both. A row tag is
   a fragment and the shipped words are the walked ones; the sentences (windows, emails) all say "to the card".

**Contradictions found between the drawing's provisional words, the shipped words and the rulings** (each is handled above;
listed for the walk):

- The team-record example arithmetic (question 1).
- The drawing's refusals ("A part refund is more than zero and no more than $100.00."; "Say why you’re refunding part of it.")
  against 12b's shipped `cardPartAmountError` and `cardPartReasonError` (decision 5).
- The drawing's pay-block note "Includes a processing fee." against the shipped lowercase `buttonFeeNote` (decision 3).
- The drawing's "Paid" and "Total" on the cleared receipt against the shipped "Paid, thank you" and "Paid" (decision 12).
- The drawing's Received caption (it carried "of it by card" and the new split) against 12b's shipped `band.byCard` and the
  refund-visibility file's "The band's captions are unchanged" (decision 14).
- The drawing's phone Clearing caption "4 · bank debits" against its own "84 players" neighbours (§3.4).
- The drawing's Fee-cell second line "Bank debit · $154.75 started Oct 26", which runs two facts together (§3.1).
- A11's "Processing" against ruling 5's "Clearing" (§5, already ruled).
