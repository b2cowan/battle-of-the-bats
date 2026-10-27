# Club Tier Stage 12a: the words (payouts, a team paying by card, refunds)

> Written by `/marketing`, 2026-10-25. Scope: the "words through /marketing" list in `CLUB_TIER_STAGE12A_BUILD_PROMPT.md`
> ("Before any code", step 3). Inputs: plan §0b, §0c and §3; the 12a, Checkout, 12c and Books & refunds tabs of
> `CLUB_TIER_STAGE12_DRAWINGS.html` (the drawings' strings were the draft; every departure is in the last section);
> today's words from `components/public/RegisterContent.tsx` (`PaymentPanel`) and `lib/email.ts` (`acceptanceHtml`,
> `paymentReminderHtml`). **12a is card only and teams only**: nothing here mentions bank debit, a family, or house league
> except the held table in section 20.

## How to read this

- Each table is `key` → string, grouped by surface. Keys are lowerCamelCase with the surface as the first segment, so an
  engineer can lift one table into one words file. Apostrophes are the typographic `’` the repo's UI strings already use.
- `{curly}` tokens are filled at runtime. **No rate and no computed fee example is typed anywhere in this file**: the card
  rate prints from `lib/plan-config.ts` as `{cardRate}` (the "3.5% + $1.50" shape), and every amount is a token.
- Money prints the house way (`$216.00`); dates "Oct 24" (with the year only on a receipt: "Oct 24, 2026"); times
  "8:14 p.m." via `formatTime()`; a name ending in s takes the bare apostrophe through `possessive()` (the token
  `{teamNamePossessive}` carries it, never `{teamName}’s`).
- "Stripe" is named in admin-facing copy (the owner is about to sign up there). A team-facing screen says "the secure
  payment page" and "the card", and names Stripe only where the page itself is Stripe's.
- **The payments terms are counsel's.** Wherever the terms would appear: `[PAYMENTS TERMS — counsel to write]`. This file
  writes no legal sentence and no surcharge disclosure.
- **The pay block carries no "the club receives the full fee" sentence** (owner, 2026-10-24). It appears only where the
  club is the reader (the record and the "Before you set up payouts" window), and open question 3 asks counsel about that.

### Token glossary

`{cardRate}` · `{base}` · `{fee}` · `{total}` · `{deposit}` · `{balance}` · `{saving}` · `{refundAmount}` ·
`{processorKept}` · `{exampleBase}` · `{exampleFee}` (the "Before" window's one worked line, computed at runtime, never
typed) · `{date}` · `{paidAt}` ("Oct 24, 2026, 8:14 p.m.") · `{deadline}` · `{last4}` · `{brand}` ("Visa") ·
`{receiptNo}` · `{reference}` · `{clubName}` (the organization's name) · `{tournamentName}` · `{teamName}` ·
`{teamNamePossessive}` · `{divisionName}` · `{payerName}` · `{payerEmail}` · `{contactEmail}` · `{howToPay}` (the
organizer's own text, verbatim) · `{count}` · `{requirement}` (Stripe's own description of what it needs) · `{name}` (the
person who acted) · `{path}` (the settings path, section 1).

---

## 1 · Where the owner finds it (placement words)

| key | string | note |
|---|---|---|
| `where.pathClub` | Settings › Payouts | League and Club owners: the card is on the club Settings page, after the public-site door and before Delete organization |
| `where.pathTournamentPlus` | Settings & access › Payouts | Tournament Plus owners: a tile at the end of tournament Settings & access (plan §0c). Never "Settings › Payouts" for them |
| `hubTile.title` | Payouts | The tile on the Settings & access hub; opens the card on its own page |
| `hubTile.subNotSetUp` | Let teams pay online by card | |
| `hubTile.subSettingUp` | Setup isn’t finished | |
| `hubTile.subTaking` | Taking payments | |
| `hubTile.subNeedsAttention` | Needs attention | The amber pill, not a count in the name (standing ruling) |
| `hubTile.subDisconnected` | Online payments are off | |

## 2 · The Payouts card: five states

Card eyebrow is always `Payouts`; the status pill beside it reads the state name in the first column. Both homes use the
same words: they say "your" and "you", never "the club’s", so a Tournament Plus host that isn't a club reads them
naturally. In 12a the only payer is a team, so every variant says "teams" (families come back in section 20).

| key | string | note |
|---|---|---|
| `payouts.eyebrow` | Payouts | |
| `payouts.testChip` | Test mode | See section 7 |
| **Not set up** | | |
| `payouts.notSetUp.pill` | Not set up | |
| `payouts.notSetUp.title` | Let teams pay online | |
| `payouts.notSetUp.body` | Payments go straight to your bank account through Stripe. Each card payment has a processing fee of {cardRate}, and you choose who pays it. Stripe will ask for your legal name, a signing officer and your bank account. | Dropped the drawing's "Takes about 10 minutes": we can't promise Stripe's time |
| `payouts.notSetUp.button` | Set up payouts | Opens section 3 |
| **Setting up** (came back before finishing) | | |
| `payouts.settingUp.pill` | Setting up | |
| `payouts.settingUp.title` | Stripe needs a few more details | |
| `payouts.settingUp.body` | You started on {date}. Teams keep seeing your “How to pay” text until setup is finished. | |
| `payouts.settingUp.button` | Continue setup | |
| **Taking payments** | | |
| `payouts.taking.pill` | Taking payments | |
| `payouts.taking.title` | Teams can pay online | |
| `payouts.taking.body` | Payouts go to your bank account on Stripe’s schedule. Receipts go out in the name “{clubName}”. | Dropped the drawing's "two business days": the schedule is Stripe's setting, not ours |
| `payouts.taking.button` | Open Stripe | |
| **Needs attention** | | |
| `payouts.needsAttention.pill` | Needs attention | |
| `payouts.needsAttention.title` | Online payments are paused | |
| `payouts.needsAttention.body` | Stripe needs {requirement} by {deadline}. Until then teams see your “How to pay” text instead of Pay now. Nothing already paid is affected. | Use when Stripe gives a deadline |
| `payouts.needsAttention.bodyNoDeadline` | Stripe needs {requirement}. Until then teams see your “How to pay” text instead of Pay now. Nothing already paid is affected. | |
| `payouts.needsAttention.bodyUnknown` | Stripe needs something more from you. Until then teams see your “How to pay” text instead of Pay now. Nothing already paid is affected. | When Stripe names nothing we can print |
| `payouts.needsAttention.button` | Fix in Stripe | |
| `payouts.needsAttention.titleStillOn` | Stripe needs something more from you | Derived (walk 2026-10-25): Stripe asks while card payments stay **on**. The rows above are the **paused** case only — the card used to say "paused" while teams still saw Pay now |
| `payouts.needsAttention.bodyStillOn` | Online payments are still on. Do it by {deadline} to keep them on. Nothing already paid is affected. | Use when Stripe gives a deadline |
| `payouts.needsAttention.bodyStillOnNoDeadline` | Online payments are still on. Nothing already paid is affected. | |
| `payouts.stripeProductDescription` | {club} runs community sports programs. Families and teams pay registration, team and tournament fees online through FieldLogicHQ, and find the club through its members, schools and local sports groups. | Derived (walk 2026-10-25): filled into Stripe's sign-up when the club has no public site Stripe can open; the owner can change it on Stripe's form |
| **Disconnected** | | |
| `payouts.disconnected.pill` | Disconnected | |
| `payouts.disconnected.title` | Online payments are off | |
| `payouts.disconnected.body` | Disconnected {date} by {name}. Payments already made stay in your books; refunds of them are made in Stripe. Teams see your “How to pay” text. | |
| `payouts.disconnected.button` | Set up payouts again | |
| **The rates line** | | |
| `payouts.ratesLine` | Processing fee: {cardRate} per card payment. | Printed from config on the card (all states except Disconnected) and beside the A14 choice |
| `payouts.rare.disconnect` | Disconnect payouts | The rare door at the end of the Taking-payments and Needs-attention bodies; opens section 5 |

## 3 · "Before you set up payouts" (the window)

Stripe's own sign-up never shows our fee, so this is where the club learns it. Foot: buttons only; the drawing's
"Next, Stripe asks for…" sentence is dropped because the button already says it.

| key | string | note |
|---|---|---|
| `before.title` | Before you set up payouts | |
| `before.costLabel` | What it costs | |
| `before.costRate` | {cardRate} per card payment | |
| `before.costExample` | On a {exampleBase} fee, the card fee is {exampleFee}. | Both tokens computed on the server from config; never typed |
| `before.whoLabel` | Who pays it | |
| `before.whoTeams` | Teams pay it | Label for 12a, both homes (open question 1) |
| `before.whoTeamsHint` | Added to what the team pays. | |
| `before.whoClub` | The club pays it | |
| `before.whoClubHint` | The team pays the entry fee alone; the processing fee comes out of each payment. | |
| `before.whoChangeLater` | You can change this later on the Payouts card. | |
| `before.moneyLabel` | Where the money goes | |
| `before.moneyBody` | Straight to your bank account through Stripe. FieldLogicHQ never holds it. | |
| `before.refundsLabel` | Refunds | |
| `before.refundsBody` | You set your own refund policy, and refunds come out of your Stripe balance. | |
| `before.termsCheckbox` | I agree to the FieldLogicHQ payments terms for {clubName}. | The consent label only; recorded with who agreed and when |
| `before.termsLink` | Read the terms | Opens `[PAYMENTS TERMS — counsel to write]` |
| `before.termsText` | [PAYMENTS TERMS — counsel to write] | Placeholder. No legal sentence is written here |
| `before.cancel` | Cancel | |
| `before.continue` | Continue to Stripe | |

## 4 · The record: who pays the fee (A14) and the refund policy (A9)

Reads first; the pencil flips the whole record. The choice autosaves and tells nobody.

| key | string | note |
|---|---|---|
| `record.feeLabel` | Processing fee | Reading label |
| `record.feeReadTeams` | Teams pay it: it’s added to what they pay | |
| `record.feeReadClub` | The club pays it: it comes out of each payment | |
| `record.feeRates` | {cardRate} per card payment | |
| `record.feeEditLabel` | Who pays the processing fee | Editing label; two choices below |
| `record.choiceTeams` | Teams pay it | |
| `record.choiceTeamsHint` | Added to what the team pays. You receive the full entry fee. | The "receive the full fee" sentence lives here, where the club is the reader. Counsel check, question 3 |
| `record.choiceClub` | The club pays it | |
| `record.choiceClubHint` | Teams pay the entry fee alone. The processing fee comes out of each payment and shows in your books as Payment processing. | |
| `record.feeChangeNote` | A change applies to payments started from now on. Anything already paid stays as it was. | Dropped the drawing's worked dollar example |
| `record.policyLabel` | Refund policy | |
| `record.policyHint` | One or two sentences teams see beside Pay. | |
| `record.policyPlaceholder` | For example: refunded in full until {date}, then not refunded. | The only example is a shape with a token; the club writes its own |
| `record.policyEmpty` | None written. Teams won’t see a Refund policy link. | Reading state when blank (A9: absent when blank) |
| `record.bank` | (not built: owner ruled the bank account’s last digits out, 2026-10-25) | |
| `record.openStripe` | Open Stripe | |

## 5 · Disconnect (the window)

| key | string | note |
|---|---|---|
| `disconnect.title` | Disconnect payouts? | |
| `disconnect.stops` | Teams stop seeing Pay now right away, and pay links already emailed show your “How to pay” text instead. | |
| `disconnect.owing` | {count} teams still owe money; they can pay you another way. | Shown when {count} is 2 or more |
| `disconnect.owingOne` | 1 team still owes money; it can pay you another way. | |
| `disconnect.owingNone` | No team owes anything right now. | When the count is 0 |
| `disconnect.past` | Payments already made stay in your books. Refunds of them are made in Stripe. | Matches A1 and the build prompt; see question 5 |
| `disconnect.cancel` | Cancel | |
| `disconnect.confirm` | Disconnect | |
| `disconnect.done` | Payouts disconnected. | Autosave-style toast, transient |

## 6 · The treasurer's status line, and the quiet line for whoever can connect

Placement (plan §0c): a **tournament-only** club's line sits on the Teams page's payments line; a **League or Club**
treasurer's sits on the Accounting overview. Same words either way. Only the treasurer sees the status line; only whoever
can connect (the owner) sees the quiet line. Setting-up and Not-set-up draw no status line for the treasurer: there is
nothing to tell them yet.

| key | string | note |
|---|---|---|
| `status.takingLead` | Taking payments | Bold lead |
| `status.takingBody` | Online payments go to the club’s bank account. | |
| `status.takingLink` | Open Stripe | |
| `status.needsLead` | Needs attention | Amber pill, not text in a name |
| `status.needsBody` | Online payments are paused: Stripe needs something from the owner. | Stripe's requirement is the owner's to read, so no `{requirement}` here |
| `status.needsBodyDeadline` | Online payments are paused: Stripe needs something from the owner by {deadline}. | |
| `status.needsBodyStillOn` | Online payments are still on. Stripe needs something from the owner. | Derived (walk 2026-10-25): payments still on. The two rows above are the paused case, which now carries no deadline |
| `status.needsBodyStillOnDeadline` | Online payments are still on. Stripe needs something from the owner by {deadline}. | |
| `status.needsOwnerHintClub` | The owner fixes it in Settings › Payouts. | Treasurer on a League or Club plan |
| `status.needsOwnerHintTournamentPlus` | The owner fixes it in Settings & access › Payouts. | Treasurer on Tournament Plus |
| `status.offLead` | Online payments are off | |
| `status.offBody` | The owner disconnected payouts on {date}. Teams see the organizer’s payment instructions. | |
| `quiet.line` | Teams pay you directly, outside FieldLogicHQ. | Today's own sentence, softened to the reader |
| `quiet.link` | Let them pay online | The link text; it opens the card |
| `quiet.pathClub` | Settings › Payouts | Printed after the link, as the drawing shows |
| `quiet.pathTournamentPlus` | Settings & access › Payouts | |

The registrar-type roles who cannot connect see the page without this line (A6): it would only be a dead end.

## 7 · Test mode

| key | string | note |
|---|---|---|
| `test.cardChip` | Test mode | On the Payouts card |
| `test.cardLine` | No real money moves while payouts are in test mode. | On the card, under the title |
| `test.payBlock` | Test payment: no money moves. | On the team pay page and the receipt page |
| `test.receiptPage` | Test payment · no money moved | A line above the receipt number |
| `test.emailSubjectPrefix` | [Test]  | Prefix to the receipt and refund subjects |
| `test.emailLine` | This was a test payment. No money moved. | First line of a test receipt or refund email |
| `test.recordRow` | Test, no money moved | A tag on the team-record payment row |

---

## 8 · The pay block (the team's pay page): every state

One component, shown in the tournament's theme. Every button that opens Stripe turns into `payBlock.opening` and disables
both buttons on press.

| key | string | note |
|---|---|---|
| **Owing** | | |
| `payBlock.heading` | To pay now | Used when one thing is owed |
| `payBlock.lineTeam` | {teamName} · {divisionName} | The line item above the total |
| `payBlock.button` | Pay {total} by card | The label is the amount, always |
| `payBlock.buttonFeeNote` | includes a {fee} processing fee | Sub-line under the button, only while teams pay the fee (A14). Never under the club-pays version |
| `payBlock.refundPolicyLink` | Refund policy | Opens the club's A9 sentence; absent when blank |
| `payBlock.otherWays` | Or pay another way: {howToPay} | Shown when the organizer wrote "How to pay" text; nothing is added when they didn't |
| **Opening** | | |
| `payBlock.opening` | Opening the secure payment page… | Replaces the button's label; both buttons disabled |
| **Confirming** (back from Stripe, before it confirms) | | |
| `payBlock.confirmingTitle` | Confirming your payment | |
| `payBlock.confirmingBody` | Stripe has your payment; we’re waiting for it to confirm. This usually takes a few seconds and the page updates by itself. Don’t pay again. | Never says "Paid" on the redirect alone |
| `payBlock.confirmingSlow` | This is taking longer than usual. You don’t need to pay again: we’ll email your receipt to {payerEmail} as soon as it confirms. | After a threshold the engineer picks |
| **Not finished** (left Stripe's page) | | |
| `payBlock.notFinishedTitle` | Payment not finished | |
| `payBlock.notFinishedBody` | You left Stripe’s page before paying. Nothing was charged. | The owing block shows underneath |
| **Paid** | | |
| `payBlock.paidTitle` | Paid | With the amount |
| `payBlock.paidLine` | {brand} •••• {last4} · {date} · receipt {receiptNo} | |
| `payBlock.paidLink` | View receipt | |
| **Nothing to pay** (no fee is set for this team) | | |
| `payBlock.nothingTitle` | Nothing to pay | |
| `payBlock.nothingBody` | There’s no entry fee to pay for {teamName}. | |
| **Already paid** (paid in full, by card or by hand) | | |
| `payBlock.alreadyTitle` | {teamName} is paid in full | |
| `payBlock.alreadyBody` | There’s nothing left to pay. | |
| `payBlock.alreadyReceipt` | View receipt | Only when the payment was online |
| **Not taking payments** = today's words verbatim | | |
| `payBlock.notTakingHeader` | Payment handled by organizer | Today's header in `PaymentPanel` |
| `payBlock.notTakingTotal` | Total fee | Today's label |
| `payBlock.notTakingDeposit` | Deposit | Today's label |
| `payBlock.notTakingDue` | Due {date} | Today's per-line due |
| `payBlock.notTakingNoSchedule` | The organizer has not published a fee schedule for this division yet. | Today's sentence |
| `payBlock.notTakingHowLabel` | How to pay | Today's label above the organizer's text |
| `payBlock.notTakingFoot` | Payments are made directly to the organizer, outside the platform. | Today's closing sentence |

## 9 · The team's pay page: deposit or full (A7)

The deposit is pre-selected. The saving line shows only while teams pay the fee and only when the saving is above zero.
The page header is the tournament's own (name, dates); under it:

| key | string | note |
|---|---|---|
| `teamPay.who` | {teamName} · {divisionName} | |
| `teamPay.accepted` | Accepted {date} · reference {reference} | |
| `teamPay.chooseDeposit` | Pay the deposit, {deposit} | Pre-selected |
| `teamPay.chooseDepositHint` | The {balance} balance is due {date}. | |
| `teamPay.chooseDepositHintNoDate` | The {balance} balance is paid later. | When the schedule has no balance date |
| `teamPay.chooseFull` | Pay in full, {total} | `{total}` here is the entry fee. The button below carries the amount including any processing fee |
| `teamPay.savingLine` | {saving} less in processing fees than paying the deposit and the balance separately. | Only while teams pay the fee; the deposit and its balance are two payments, so the flat part is paid twice |
| `teamPay.noDepositHeading` | Pay the entry fee, {total} | Fee schedule has no deposit: no choice shown |
| `teamPay.balanceHeading` | Pay the balance, {balance} | After a deposit is paid |
| `teamPay.balanceDue` | Due {date}. | |
| `teamPay.balancePastDue` | Was due {date}. | Past the date: no scolding, just the fact |
| `teamPay.paidSoFar` | {teamName} paid {deposit} on {date}. | Above the balance heading |

Buttons, refund-policy link, other-ways line and states come from section 8.

---

## 10 · The review step (the public registration form)

Heading and fee rows stay as today. Only the explanation changes, and only when the organization is taking payments.

| key | string | note |
|---|---|---|
| `review.heading` | Payment | Connected state. The drawing's heading; today's "Payment handled by organizer" is no longer true when the card is on |
| `review.rows` | Total fee · Deposit · Due {date} | Unchanged rows |
| `review.connected` | Once the organizer accepts your team, we’ll email you a link to pay online by card. You can also pay the organizer directly. | Replaces today's last sentence |
| `review.connectedWithHow` | Once the organizer accepts your team, we’ll email you a link to pay online by card. You can also pay another way: {howToPay} | When the organizer chose to show "How to pay" on the form |
| `review.notConnected` | Payments are made directly to the organizer, outside the platform. | **Today's words verbatim** (with today's header "Payment handled by organizer", rows and `How to pay` block, section 8's `payBlock.notTaking*` keys) |

---

## 11 · The acceptance email: Pay now

Today's subject ("Your Team Has Been Accepted — {tournamentName}"), greeting, headline ("Team Accepted!"), sentence
("Great news! {teamName} has been accepted into the {divisionName} division for {tournamentName}."), the "Amount due" line
and the "View Your Registration Dashboard" button are **untouched** (restyling the email is not 12a). When the
organization is taking payments, the Payment panel gains these, in this order:

| key | string | note |
|---|---|---|
| `acceptEmail.payButton` | Pay now | The primary button, above the dashboard button |
| `acceptEmail.payLine` | Pay online by card, or pay another way below. | Under the Amount due line. Without a "How to pay" text the second half goes: "Pay online by card." |
| `acceptEmail.payLineOnly` | Pay online by card. | |
| `acceptEmail.otherWaysLabel` | Other ways to pay | Above the organizer's `{howToPay}` text, which stays verbatim |
| `acceptEmail.notConnected` | If payment is required, the tournament organizer will follow up with instructions for paying outside FieldLogicHQ. | **Today's fallback, verbatim**, when not taking payments and no text is set. Dropped when connected (see departures) |

## 12 · The balance reminder: Pay the balance

Today's headline "Tournament Payment Reminder", the "friendly reminder" sentence and the Payment Details panel are
untouched.

| key | string | note |
|---|---|---|
| `reminderEmail.payButtonBalance` | Pay the balance | When a payment has already landed |
| `reminderEmail.payButtonNow` | Pay now | When nothing has been paid yet (a reminder can go to a team that never paid the deposit) |
| `reminderEmail.footNotConnected` | FieldLogicHQ records payment status for the organizer but does not process tournament payments online. | **Today's footer, verbatim**, when not taking payments |
| `reminderEmail.footConnected` | Paid by another way already? Tell the organizer and they’ll update your record. | Replaces the footer when connected (today's footer would now be false) |

## 13 · The receipt page (where Stripe sends the team back)

In the tournament's theme. It waits for the webhook: until then it shows `payBlock.confirming*`.

| key | string | note |
|---|---|---|
| `receipt.title` | Paid, thank you | |
| `receipt.to` | {total} to {clubName} | |
| `receipt.method` | {brand} •••• {last4} · {paidAt} · receipt {receiptNo} | |
| `receipt.tournament` | {tournamentName} | Under the title |
| `receipt.lineDeposit` | {teamName} · {divisionName} · Deposit | Label picks Deposit, Balance or Entry fee |
| `receipt.lineBalance` | {teamName} · {divisionName} · Balance | |
| `receipt.lineFull` | {teamName} · {divisionName} · Entry fee | |
| `receipt.lineFee` | Processing fee | Only when the team paid it |
| `receipt.lineTotal` | Paid | |
| `receipt.balanceLeft` | The {balance} balance is due {date}. | Only after a deposit |
| `receipt.balanceLink` | Pay the balance | |
| `receipt.emailed` | A receipt was emailed to {payerEmail}. | |
| `receipt.revisit` | This page shows your receipt any time you open your pay link. | Replaces the drawing's "Your reference… shows this any time" |

## 14 · The receipt email (the club's name on the envelope)

From name is the club's (`{clubName}`) through our email stack; reply-to is the club's contact; Stripe's own receipt is
off. The warm envelope, the club's identity, and no tax line (the GST/HST question waits on the accountant).

| key | string | note |
|---|---|---|
| `receiptEmail.fromName` | {clubName} | The display name of the sender |
| `receiptEmail.subject` | Receipt {receiptNo} from {clubName} | `[Test] ` prefix in test mode |
| `receiptEmail.thanks` | Thanks, {payerName}. {clubName} received your payment. | When the payer's name isn't known: "Thanks. {clubName} received your payment." |
| `receiptEmail.lineItem` | {teamName} · {tournamentName} · {divisionName} · {base} | Deposit / Balance / Entry fee added before the amount where it applies |
| `receiptEmail.lineFee` | Processing fee · {fee} | Only when the team paid it |
| `receiptEmail.lineTotal` | Total paid · {total} · {brand} •••• {last4} · {date} | |
| `receiptEmail.number` | Receipt {receiptNo} | |
| `receiptEmail.statement` | Your card statement shows {statementDescriptor}. | **Only if the build can read the descriptor from Stripe**; drop the line otherwise (question: engineers) |
| `receiptEmail.balance` | The {balance} balance is due {date}. | After a deposit |
| `receiptEmail.balanceButton` | Pay the balance | |
| `receiptEmail.viewButton` | View your receipt | Opens the receipt page |
| `receiptEmail.questions` | Questions about this payment or a refund go to {clubName}: {contactEmail}. | |

## 15 · The team's record: the rows and the ⋯ menu

| key | string | note |
|---|---|---|
| `teamRow.method` | Online, card · receipt {receiptNo} | Under the row's date and label (Deposit / Balance / Payment) |
| `teamRow.refunded` | Refunded to card, {date} | After a full refund; the paid figure goes back down |
| `teamRow.refundPending` | Refunding to card… | While Stripe works on it |
| `teamRow.refundFailed` | Refund didn’t reach the card | See section 19 |
| `teamRow.test` | Test, no money moved | |
| `teamRow.menuView` | View the payment | |
| `teamRow.menuRefund` | Refund to the card | Hidden for a refunded or club-disconnected row (question 5) |
| `teamRow.menuEmailLink` | Email the pay link | In the **balance** row's ⋯, and on a team that owes anything |
| `teamRow.linkSent` | Pay link sent {date} | Replaces the menu item's trace on the row; the item stays so it can be sent again |
| `teamRow.linkSentToast` | Pay link sent to {payerEmail}. | Transient |
| `teamRow.linkFailedToast` | Couldn’t send the pay link. Try again. | |
| `teamRow.noPencil` | (no string) | An online row has no pencil: the amount and date are the bank's |

### The pay-link email (derived from "Email the pay link")

| key | string | note |
|---|---|---|
| `linkEmail.subject` | Pay for {teamName} in {tournamentName} | |
| `linkEmail.body` | {clubName} sent you a link to pay for {teamName} in the {divisionName} division. | |
| `linkEmail.amount` | Amount due: {total} | The fee schedule's amount, no processing fee |
| `linkEmail.button` | Pay now | "Pay the balance" when a deposit has landed |
| `linkEmail.otherWays` | Or pay another way: {howToPay} | |

### "View the payment" (a small window; derived)

| key | string | note |
|---|---|---|
| `payView.title` | Payment {receiptNo} | |
| `payView.rows` | Paid {paidAt} · {brand} •••• {last4} · Entry fee {base} · Processing fee {fee} · Total {total} · From {payerEmail} | A read-only list; the fee row says "paid by the team" or "paid by the club" |
| `payView.feeTeam` | Processing fee, paid by the team | |
| `payView.feeClub` | Processing fee, paid by the club | |
| `payView.receipt` | Open the receipt | |

---

## 16 · The refund window (a full refund to the card)

A13: whoever runs tournaments, and the treasurer. Foot: buttons only.

| key | string | note |
|---|---|---|
| `refund.title` | Refund {teamNamePossessive} payment? | |
| `refund.paidTeams` | {teamName} paid {total} online on {date}: the {base} entry fee and a {fee} processing fee. | The team paid the fee |
| `refund.paidClub` | {teamName} paid {base} online on {date}. | The club paid the fee: no checkbox shown |
| `refund.target` | Refund to the card, {brand} •••• {last4} | |
| `refund.arrives` | Arrives in 5 to 10 business days | Stripe's published range |
| `refund.whoLabel` | Who is ending this? | Shown only while the team paid the fee |
| `refund.whoOrganizer` | The organizer is ending it | Default |
| `refund.whoTeam` | The team asked to leave | |
| `refund.feeCheckbox` | Include the {fee} processing fee · {total} back | Shown only while the team paid the fee (A2) |
| `refund.feeOnWhy` | On because the organizer is ending it. Stripe keeps {processorKept} of its fee on a refund; that comes from the club and shows in your books as Payment processing. | Default when the organizer is ending it. The `{processorKept}` is computed, never typed |
| `refund.feeOffWhy` | {base} back. Off because the team asked to leave; you can include it. | Default when the team asked to leave |
| `refund.feeOnChanged` | Stripe keeps {processorKept} of its fee on a refund; that comes from the club and shows in your books as Payment processing. | If the organizer ticks it on after choosing "The team asked to leave" |
| `refund.noteLabel` | Note to the team | No "optional" tag; the form marks only what is required |
| `refund.noteHint` | Goes in the refund email. | |
| `refund.button` | Refund and email | |
| `refund.cancel` | Cancel | |
| `refund.working` | Refunding… | Button label while the request runs |
| `refund.doneToast` | Refunded {refundAmount} to the card. We emailed {payerEmail}. | Transient |
| `refund.failed` | The refund didn’t go through. Nothing was refunded. Try again. | Inline, persistent until retried |
| `refund.alreadyRefunded` | This payment was already refunded. | If a second press arrives |

## 17 · The refund email to the payer

| key | string | note |
|---|---|---|
| `refundEmail.fromName` | {clubName} | |
| `refundEmail.subject` | Refund from {clubName} | `[Test] ` prefix in test mode |
| `refundEmail.lead` | {teamNamePossessive} payment for {tournamentName} was refunded. | |
| `refundEmail.amount` | {refundAmount} refunded to {brand} •••• {last4} on {date}. It takes 5 to 10 business days to appear. | |
| `refundEmail.feeIncluded` | This includes the {fee} processing fee. | When the box was ticked |
| `refundEmail.feeKept` | The {fee} processing fee isn’t part of this refund. | When it wasn't; a plain fact, no explanation |
| `refundEmail.note` | {note} | The organizer's note, verbatim, in its own paragraph |
| `refundEmail.questions` | Questions: {contactEmail}. | |

## 18 · Refused or failed: the pay route's messages

Both the page and the JSON `error` use the same sentence. Page versions show the club name at the top and, where the
organizer wrote one, `payBlock.otherWays` underneath.

| key | string | note |
|---|---|---|
| `payError.notAccepted` | {teamName} hasn’t been accepted yet. You can pay once the organizer accepts it. | Submitted or pending review |
| `payError.ended` | {teamName} is no longer in {tournamentName}, so there’s nothing to pay. | Declined, withdrawn or cancelled |
| `payError.alreadyPaid` | {teamName} is already paid in full. | |
| `payError.clubNotTaking` | {clubName} isn’t taking online payments right now. | Followed by the "How to pay" text, or by the next key |
| `payError.clubNotTakingNoHow` | Contact the organizer to arrange payment: {contactEmail}. | |
| `payError.nothingOwed` | There’s nothing to pay for {teamName} right now. | The re-read found a zero balance (a hand payment landed meanwhile) |
| `payError.linkInvalid` | This payment link doesn’t work. Ask the organizer to email you a new one. | Unknown, mistyped or revoked token; pay links never expire on their own |
| `payError.amountChanged` | The amount to pay has changed. Check it below and try again. | The server re-read differs from what the page showed |
| `payError.couldntOpen` | We couldn’t open the secure payment page. Nothing was charged. Try again. | Stripe refused or timed out |
| `payError.switchOff` | Online payments aren’t available yet. | Launch switch off. Never reachable in a normal flow; the pay button isn't rendered |

## 19 · Needs attention (two new items)

Both clear themselves. The owner and the treasurer both receive them; the treasurer sees the title and body, with no
button for the first (the owner fixes it).

### Stripe needs something

| key | string | note |
|---|---|---|
| `attention.stripe.title` | Stripe needs something to keep online payments on | |
| `attention.stripe.body` | Online payments are paused. Stripe needs {requirement}{byDeadline}. Teams see your “How to pay” text until it’s done. Nothing already paid is affected. | `{byDeadline}` = " by {deadline}" or empty |
| `attention.stripe.bodyUnknown` | Online payments are paused. Stripe needs something more from you. Teams see your “How to pay” text until it’s done. Nothing already paid is affected. | |
| `attention.stripe.button` | Fix in Stripe | Owner only |
| `attention.stripe.treasurerHintClub` | The owner fixes it in Settings › Payouts. | Treasurer |
| `attention.stripe.treasurerHintTournamentPlus` | The owner fixes it in Settings & access › Payouts. | |
| `attention.stripe.settled` | Online payments are back on | The settled outcome line, matching `needs-attention-words.ts` |

### A refund couldn't reach the card

| key | string | note |
|---|---|---|
| `attention.refund.title` | {teamNamePossessive} refund didn’t reach the card | |
| `attention.refund.body` | {refundAmount} to {brand} •••• {last4} was returned, for example because the card was closed. Send {teamName} the money another way, then record the refund. | |
| `attention.refund.button` | Record a refund | Opens the typed refund (Stage 7a path). Label placeholder if that path's own button is named differently |
| `attention.refund.settled` | Refund recorded | Clears when that refund is recorded |

---

## 20 · Held for 12b: families and house league (do not ship in 12a)

Copy says only what ships (the 2026-10-19 truth rule), so the League and Club card says "teams" in 12a. These are the
variants that replace the 12a words when house league's online payments land. Listed so 12b doesn't reinvent them.

| key | 12a (ships) | 12b (held) |
|---|---|---|
| `payouts.notSetUp.title` | Let teams pay online | Let families and teams pay online |
| `payouts.taking.title` | Teams can pay online | Families and teams can pay online |
| `payouts.settingUp.body` | …Teams keep seeing your “How to pay” text… | …Families and teams keep seeing your “How to pay” text… |
| `payouts.needsAttention.body` | …teams see your “How to pay” text… | …families and teams see… |
| `payouts.disconnected.body` | …Teams see your “How to pay” text. | …Families and teams see… |
| `before.whoTeams` / `record.choiceTeams` | Teams pay it | Families and teams pay it (League and Club); Tournament Plus keeps "Teams pay it" |
| `disconnect.stops` | Teams stop seeing Pay now… | Families and teams stop seeing Pay now… |
| `quiet.line` | Teams pay you directly, outside FieldLogicHQ. | Families and teams pay you directly… (house-league Money page: "Families pay by e-Transfer or cash today. Let them pay online · Settings › Payouts", as drawn) |

---

## Departures from the drawings, and why

1. **Bank debit removed everywhere** (rate, buttons, window rows, disconnect line, receipts): 12a is card only.
2. **Families removed from every 12a string**, replaced by "teams": only teams can pay in 12a (truth rule). The held
   variants are in section 20.
3. **No computed example in the "Before" window or the record.** The drawing's "On a $165 fee: $7.28" and "$165 becomes
   $172.28" are tokens now (`{exampleBase}`, `{exampleFee}`).
4. **"Takes about 10 minutes" dropped**, and **"two business days after a payment" replaced by "on Stripe's schedule"**: both
   are promises about Stripe's process that we do not control or measure.
5. **"Holds your spot" dropped from the deposit line.** It states an organizer rule the product does not enforce; the line
   gives the balance and its date.
6. **"Your" instead of "the club's"** on the Payouts card and the Before window, so a Tournament Plus host that isn't a club
   reads them without a wrong noun.
7. **The registrar-style roles are not named** on the quiet line; it just doesn't render for them (as drawn).
8. **The acceptance email keeps today's words.** The drawing re-headlined it ("Sample Thunder is in — …"); that restyle is
   not 12a, so only the pay strings were added. Likewise the reminder keeps today's headline.
9. **Reminder button has two labels** ("Pay the balance" after a payment, "Pay now" when nothing was paid) because a
   reminder can reach a team that never paid its deposit and "balance" would be wrong.
10. **Today's reminder footer ("does not process tournament payments online") and the acceptance email's "paying outside
    FieldLogicHQ" fallback are replaced when the club is connected**, because they would be false next to a Pay button.
    Both stay verbatim when it is not.
11. **The foot sentences in both windows are dropped** (the one-window ruling hides them): the buttons already name the
    action ("Continue to Stripe", "Refund and email").
12. **"Processor" became "Stripe"** in the refund window: the reader is the organizer, who already met Stripe's name.
13. **The refund window gains a "Who is ending this?" question** (A2 = C needs it; the drawing only drew the two outcomes).
14. **A refund and the typed refund's button label ("Record a refund") are placeholders** until the Stage 7a path's own
    wording is confirmed in code.

## Open questions for the owner

1. **What does the A14 choice say, for teams and later for families?** A14's label is "Families pay it". A team isn't a
   family. Recommendation: **"Teams pay it" everywhere in 12a**, and at 12b **"Families and teams pay it"** for League and
   Club orgs, while Tournament Plus keeps "Teams pay it". The stored value never changes; only the label. The alternative is
   one neutral label such as "The payer pays it", which never needs changing but reads like a form.
2. **Does "Refund to the card" also end the team's place (decline or withdraw it)?** The copy assumes it does **not**: the
   window names the refund only, and the A2 question "who is ending this?" just chooses the fee default. If the refund
   should also change the team's status, the title and the button have to say so.
3. **Which lines go to counsel?** Beyond the terms: (a) "You receive the full entry fee" on the record (kept off the pay
   block per your ruling, but it is still a statement of how the fee works); (b) the refund email's plain line that a
   processing fee "isn’t part of this refund"; (c) whether anything near the buttons must say the fee is a surcharge.
   Recommendation: send all three with the terms memo; do not write around them.
4. **Do we tell the club that Stripe covers its unrecoverable losses?** It is ruled (plan §0c) but it is a liability
   statement, so I have said nothing about it in the Before window or the card. Recommendation: say nothing until counsel's
   terms say it.
5. **After a disconnect, should "Refund to the card" stay on past online payments?** A1 says refunds of past payments are
   made in Stripe, so the ⋯ item is hidden once disconnected (as written). If you would rather the organizer could still
   refund from the team's record, `disconnect.past` and `teamRow.menuRefund` change.
