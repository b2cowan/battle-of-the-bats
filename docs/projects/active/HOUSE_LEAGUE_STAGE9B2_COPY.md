# House league Stage 9b-2: the words (`/marketing`, 2026-10-25)

> Copy for the 9b-2 build (`HOUSE_LEAGUE_STAGE9B2_BUILD_PROMPT.md`, "Before any code" step 2): the Registrations screen with the
> money on every row, the bulk bar, the Mark received, end-a-registration, Correct a price, Move division and Undo windows, the
> owing threshold, the season's Money page, the Overview tiles, the Budget vs. Actual row, the family's record, the status page's
> "Ask to withdraw", the emails' money lines and every refusal. The drawings (`HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`, tab "9b-2 Money",
> sections 1 to 6) are the ruled starting point; every drawn word is kept unless a house rule, a ruling in `HOUSE_LEAGUE_STAGE9_PLAN.md`
> §0e, or the code breaks it, and every change is listed in section 17 with its reason. Mirrors `HOUSE_LEAGUE_STAGE9B1_COPY.md`; its
> words (statuses, the approve, promote, waitlist and decline emails, the refusals) are reused, not rewritten. Keys are written
> `like.this` and use the prefix of their surface (`regs.`, not `reg.`, which 9b-1 spent on the season's Registration block).

## 0. Conventions

**House rules applied.** Sentence case everywhere, including a sub-line that starts a sentence ("Accepted Apr 12"). Dates through
`formatStoredDate`: "Oct 24", and "Oct 24, 2026" only when the year is not this year. Times "8:00 a.m." through `formatTime()`
(no clock time appears here). A name ending in s takes the bare apostrophe through `possessive()`: every `{name}’s` below is a
template for `possessive(name)`, never a hand-built `’s`. Apostrophes are curly. "Installment" never appears (no installments in
Stage 9). Money reads `$150` and `$150.50` only when there are cents; the Statement keeps its own two-decimal figures
(`$10,330.00`), because that table is the club's house format and is not changed by this stage. Free reads **Free**, never `$0`.
No exclamation marks, no sales voice.

**The page is "Money", never "Ledger".** The old season Ledger page's words ("Outstanding", "Ledger") leave with it.

**The payment method** is the product's one list, rendered through `DUES_PAYMENT_METHOD_LABEL` (`lib/types.ts`), never typed:
**E-Transfer · Cash · Cheque · Card · Other** (capital E, per `lib/club-money-words.ts` line 11). The dropdown is the existing
`MethodField` (`components/admin/kit/club/money/MoneyKit.tsx`), the same list Families' Record a payment uses. An empty choice
reads **Not recorded**. In a sentence the method sits in brackets after the date, the label verbatim, so no preposition is ever
built around it: "refunded $150 on Oct 24 (E-Transfer)". Where the method is **Other** or **Not recorded**, a family-facing
sentence drops the brackets (a family is told nothing by "(Other)"); staff screens show the label.

**Words that mean one thing.**

| Thing | Words | Never |
|---|---|---|
| A fee that has come in | **received** (staff button: **Mark received**) | "paid" on a staff screen's action, "settled" |
| A fee going back | **refunded** | "reversed", "returned", "voided" (a void is Undo) |
| A fee the club keeps | **kept by the club** | "forfeited", "non-refundable" |
| A fee still to come | **owing** (staff) / **to pay** (family) | "outstanding", "balance due" |
| The price on the registration | **price** ("fixed at sign-up") | "fee" for the amount, "rate" |
| Money after a rise in price | "the {amount} difference shows as still owing" | "balance" on a staff screen |
| The clock | "{n} days", counted from **accepted** | "unpaid {n} days", "overdue" |
| A child who has a spot | **Accepted** (every family screen and email, and the owing clock on staff screens too: it covers an automatic acceptance and a promotion, which Approve does not); the staff button stays **Approve** | "Approved" on a family screen |
| Ending a registration | **Decline** (the club says no), **Withdraw** (the child leaves), **Release the spot** (an unpaid spot goes back) | "Cancel", "Remove" |

**Singulars written out.** "1 day" / "{n} days", "1 player" / "{n} players", "1 family" / "{n} families", "1 registration" /
"{n} registrations", "1 has" / "{n} have".

**Name lists** as 9b-1: "Henry", "Henry and Ava", "Henry, Ava and Sam". In a result line that names children, three are named and
the rest counted: "Henry, Ava, Sam and 4 more".

**A refusal says what happened and what to do** (9b-1 §12). Where a refusal already exists in the product its words are reused and
the key points at the source.

**Not in these strings:** the team column's editing (9c), a live Pay now (12b: the ghost stays "Pay now" / "Pay link", with no stage
name and no "coming soon" on any screen), part payments typed by a person (the screens never offer a partial amount), household
credit, tax, installments, discounts, and a partial refund typed by a person (a refund is always the whole amount received on that
registration, or the difference a price change creates).

---

## 1. The Registrations screen (A)

### 1.1 Page head, tabs and toolbar

| Key | String | Notes |
|---|---|---|
| `regs.eyebrow` | House league · {season} | The 9a title rule. |
| `regs.title` | Registrations | |
| `regs.add` | + Add registration | Desk. Phone: the + symbol alone, 44 px, `aria-label` "Add registration". Absent on a finished season. |
| `regs.tab.review` | To review | The count is the **amber pill alone**: `aria-label` "{n} registrations to review" (9a one aria string). Never "To review · 1". Absent count when 0. |
| `regs.tab.active` | Active | Count in the quiet pill: "Active 14". |
| `regs.tab.waitlist` | Waitlist | Quiet count. |
| `regs.tab.ended` | Ended | Quiet count. Holds declined, withdrawn and released. |
| `regs.scope.all` | All divisions | The scope pill. Picks one division by name. |
| `regs.search.placeholder` | Search players or parents | |
| `regs.filter` | Filter | With a filter on: "Filter · Owing" (one choice), "Filter · 2" (several). |
| `regs.filter.group.fee` | Fee | Group heading. |
| `regs.filter.owing` | Owing | |
| `regs.filter.received` | Received | |
| `regs.filter.refunded` | Refunded | Shows only in the Ended tab's filter. |
| `regs.filter.clear` | Clear filter | |
| `regs.tools` | Tools | The ⋯ menu. |
| `regs.tools.export` | Export | Sub-line (dim): Excel, CSV. One button, Excel first (the product's export rule). |
| `regs.tools.email` | Email families | **Not** the drawn "Email these families" (section 17). Opens the season's composer, as 9a §0. |

The Fee group and its filter are **absent** when no division in the season has a price (a free season: absent beats a filter that
can only say Free).

### 1.2 Columns and the three cells that change

| Key | String | Notes |
|---|---|---|
| `regs.col.player` | Player | |
| `regs.col.division` | Division | Drawn "Division · team": the team is 9c's and the cell is two lines now (below). |
| `regs.col.guardian` | Guardian | |
| `regs.col.fee` | Fee | Absent on a free season. |
| `regs.row.select.aria` | Select {name} | The checkbox. |
| `regs.row.more.aria` | More for {name} | The ⋯. Phone: the symbol alone, 44 px. |

**Player sub-line** (dim, under the name, one of):

| Key | String |
|---|---|
| `regs.player.signedUp` | Signed up Oct 24 |
| `regs.player.promoted` | Promoted from the waitlist Oct 24 |
| `regs.player.byHand` | Added by hand Oct 24 |
| `regs.player.ended.declined` | Declined Oct 24 |
| `regs.player.ended.withdrawn` | Withdrawn Oct 24 |
| `regs.player.ended.released` | Spot released Oct 24 |

The three ended lines show in the Ended tab in place of the first three (an ended row's sign-up date is in its record). A
release is stored as Withdrawn with a "spot released" mark; the row says which it was, the family's status page says **Withdrawn**
for both (section 14).

**Division cell:** the division name; the dim sub-line is the team name, or `regs.division.notPlaced` = **Not placed** (the drawn
"not placed" is sentence-cased because it now stands alone). A waitlisted or to-review child with no division: `regs.division.none` = **No division yet** (the 9a group label).

**Guardian cell:** the guardian's name; the dim sub-line is the email. `regs.guardian.noEmail` = **No email address** (amber text,
so the registrar sees it before an Email press skips the family).

### 1.3 The Fee cell: every state

One primary line (a small coloured pill: green received, amber late, neutral otherwise) and one dim sub-line. The days count uses
the **club's threshold** (section 9); under it the pill is neutral, at or past it amber.

| State | Key | Primary line | Sub-line |
|---|---|---|---|
| Free season or free division | `regs.fee.free` | Free | |
| To review (holds a spot, nothing due yet) | `regs.fee.review` | Nothing owed yet | {$150} once accepted (Free: none) |
| Waitlist (nothing due unless a spot opens) | `regs.fee.waitlist` | Nothing owed yet | |
| Owing, accepted today | `regs.fee.owingToday` | {$150} owing | Accepted today |
| Owing N days, under the threshold | `regs.fee.owingDays` | {$150} owing · {9 days} | Accepted Oct 16 |
| Owing N days, at or past the threshold | `regs.fee.owingLate` | {$150} owing · {195 days} (amber) | Accepted Apr 12 |
| Owing, acceptance date not known | `regs.fee.owingUnknown` | {$150} owing | *(none)* |
| Received | `regs.fee.received` | {$150} received | Oct 24 · E-Transfer (method **Not recorded**: the date alone) |
| Received in part, after a price rise | `regs.fee.part` | {$120} received · {$30} owing | Last received Oct 24 · E-Transfer |
| Refunded | `regs.fee.refunded` | {$150} refunded | Oct 24 · E-Transfer |
| Kept by the club | `regs.fee.kept` | {$150} kept by the club | {reason}, clipped at 60 characters; the whole reason is in the row's record |
| Ended with nothing paid | `regs.fee.endedNone` | *(no fee line)* | |

- **Never an invented day count.** A registration accepted before the accepted-at fact existed reads `regs.fee.owingUnknown`,
  never turns amber and has no sub-line (owner ruling 2026-10-25, §0e).
- **Owing and the part-paid state never carry a day count together.** A part-paid row shows `regs.fee.part` only.
- `regs.fee.corrected` (a third dim line under any fee, desk and phone) = **Price corrected · {reason}**, the reason clipped at 50
  characters. `regs.fee.corrected.tip` (the hover and tap text, the full record) = **Was {$150}, now {$120}. {Corrected by Maria Lopez} on {Oct 24}. {reason}**
- `regs.fee.aria` (read aloud with the cell) = "{name}: {primary line}. {sub-line}".

**Phone rows** carry the money in the detail line, joined by " · ": `regs.phone.line` = **{division} · {fee primary line} · {fee sub-line}**,
for example "Division B · $150 owing · Accepted today" or "Division A · Cardinals · $150 owing · 195 days". The whole row opens the
record; Approve is the one primary on a to-review row and Mark received on an owing row; the rest sit behind the ⋯.

### 1.4 Row actions

| Key | String | Where it shows |
|---|---|---|
| `regs.act.approve` | Approve | To review (the one primary). |
| `regs.act.markReceived` | Mark received | Active, owing or part-paid (the one primary). |
| `regs.act.promote` | Promote | Waitlist (the one primary). |

### 1.5 The ⋯ menu: items and their one-line descriptions

The description is the dim second line on a desk menu and in the phone sheet. The sheet's head is the child's name with the
division and the fee: `regs.sheet.head` = **{name}** / **{division} · {$150} owing**.

| Key | Label | Description | Shown for |
|---|---|---|---|
| `regs.menu.markReceived` | Mark received | Records {$150} received, with the date and how | Active owing or part-paid |
| `regs.menu.move` | Move to another division | Checks the room, then asks about the price | Any registration still open |
| `regs.menu.correct` | Correct the price | Needs a reason | Active (owing or received) |
| `regs.menu.release` | Release the spot | Frees the spot for the waitlist. Asks first, then emails the family | Active, nothing or only part received |
| `regs.menu.withdraw` | Withdraw | Asks what happened to any money | Active |
| `regs.menu.decline` | Decline | Asks what happened to any money, then emails the family | To review, Waitlist, Active |
| `regs.menu.email` | Email this family | Opens a message to the guardian | Every row |
| `regs.menu.undo` | Undo: marked received by mistake | For a fee marked received that never arrived. Not a refund | Active, received |
| `regs.menu.waitlist` | Waitlist | Moves {name} to the waitlist and emails the family | To review, Active |
| `regs.menu.promote` | Promote | Accepts {name} into {division} and emails the family | Waitlist |

Absent beats disabled: an item the row cannot use is not drawn. On a finished season the row actions that change a registration
are absent (the whole screen carries the 9a lock line); Mark received, Undo and the Money page stay (section 10).
`regs.menu.none` (a row with no items) is never drawn: **Email this family** is on every row.

### 1.6 Empty states and the foot

| Key | Title | Body |
|---|---|---|
| `regs.empty.review` | Nothing to review | New sign-ups that need your answer show here. |
| `regs.empty.review.auto` | Nothing to review | This season accepts sign-ups on its own while a division has room. |
| `regs.empty.active` | No players yet | Accepted players show here. |
| `regs.empty.waitlist` | No one is waiting | A full division sends the next child here. |
| `regs.empty.ended` | Nothing has ended | Declined, withdrawn and released registrations show here, with what happened to any money. |
| `regs.empty.all` | No registrations yet | Families sign up on the season’s page. You can also add a registration by hand. *(Existing title kept.)* |
| `regs.empty.search` | No registrations match your search. | *(Existing line kept.)* |
| `regs.empty.filter` | No registrations match this filter. | Link: **Clear filter**. |

| Key | String |
|---|---|
| `regs.foot.fixed` | The fee shown is the price fixed on each registration when the family signed up. |
| `regs.foot.more` | … {n} more | *(A load-more row, drawn.)* |

---

## 2. The bulk bar (B)

Appears when one or more rows are ticked; docked at the foot on a phone in place of the phone bar. Shows only the actions the
tab can use (absent beats disabled).

| Key | String | Notes |
|---|---|---|
| `bulk.count` | {n} selected | |
| `bulk.approve` | Approve | To review tab. |
| `bulk.promote` | Promote | Waitlist tab, in place of Approve (the row button's word). |
| `bulk.waitlist` | Waitlist | To review and Active. |
| `bulk.markReceived` | Mark received | Active. |
| `bulk.move` | Move division | |
| `bulk.email` | Email | |
| `bulk.clear` | Clear | A plain link. |
| `bulk.more.aria` | More for the selected | The phone's ⋯; the most common action stays in words. |
| `bulk.help` | Decline and Withdraw are one at a time, because each asks what happened to that family’s money. | A quiet line at the foot of the ⋯ menu only; never on the bar. |

### 2.1 The confirm lines

Every bulk press that tells families is held until the confirm; the button names it. Mark received, Move division and Email open
their windows (sections 3, 6 and below).

| Key | Title | Body | Buttons |
|---|---|---|---|
| `bulk.approve.confirm` | Approve {n} registrations? | Each family is emailed that their child is accepted, with the fee and how to pay. | Cancel · Approve {n} |
| `bulk.promote.confirm` | Promote {n} children from the waitlist? | Each family is emailed that a spot opened, with the fee and how to pay. | Cancel · Promote {n} |
| `bulk.waitlist.confirm` | Move {n} children to the waitlist? | Each family is emailed that their child is on the waitlist. | Cancel · Waitlist {n} |
| `bulk.markReceived.title` | Mark {n} fees received | *(the window: section 3.2)* | Cancel · Mark {n} received |
| `bulk.email.line` | {n} families. {m} have no email address and are skipped. | The line under the audience in the Email families window; "{n} families." alone when everyone has one. | |

### 2.2 The result line

Said in a notice at the top of the list, in the staff voice: what happened, then what stayed and **why**, grouped by reason. A clean
result is the transient word and fades; **a partial result stays until dismissed** (it names a decision for the registrar). The rows
that stayed remain ticked: `bulk.stayed` = **The {m} that stayed are still selected.**

| Key | Clean | Partial |
|---|---|---|
| `bulk.done.approve` | {n} approved. | {n} approved; {m} stay in review: {reason}. |
| `bulk.done.promote` | {n} promoted from the waitlist. | {n} promoted; {m} stay on the waitlist: {reason}. |
| `bulk.done.waitlist` | {n} moved to the waitlist. | {n} moved to the waitlist; {m} stayed: {reason}. |
| `bulk.done.markReceived` | {n} marked received. | {n} marked received; {m} skipped: {reason}. |
| `bulk.done.move` | {n} moved to {division}. | {n} moved to {division}; {m} stayed: {reason}. |
| `bulk.done.move.kept` | *(added to the sentence)* | {k} kept their price: paid. Correct one at a time. |
| `bulk.done.email` | Emailed {n} families. | Emailed {n} families; {m} has no email address. / {m} have no email address. |

**Reasons** (`{reason}`; several joined with "; ", each with its own count when the counts differ: "2 are full in Division C; 1
was already accepted"):

| Key | String |
|---|---|
| `bulk.why.full` | {Division A} is full *(several: "{Division A} and {Division B} are full")* |
| `bulk.why.alreadyDone` | already accepted *(approve)* / already on the waitlist *(waitlist)* / already moved *(move)* |
| `bulk.why.received` | already received |
| `bulk.why.free` | no fee to receive |
| `bulk.why.notAccepted` | still in review |
| `bulk.why.noDivision` | no division yet |
| `bulk.why.ended` | the registration has ended |
| `bulk.why.sameDivision` | already in {division} |

- **Approve and a full division.** From To review, Approve never meets a full division (a child in review already holds a spot,
  §0e), so `bulk.why.full` is shown for Approve only if the room changed under the press. It is the **Promote** result that meets it:
  "3 promoted; 2 stay on the waitlist: Division A is full."
- **A closed fiscal year** refuses the whole Mark received batch (every line is dated today): no partial. The result is the closed-year
  refusal in section 16 and nothing is recorded.

---

## 3. Mark received (C)

The kit's form window, medium. Used for one registration and, with the totals line, for a batch. **The amount is shown, never typed**:
Mark received always records the whole balance still owing.

### 3.1 One registration

| Key | String | Notes |
|---|---|---|
| `recv.eyebrow` | {season} · {division} | |
| `recv.title` | Mark {name}’s fee received | |
| `recv.amount.label` | Amount | A read-only line, not a field. |
| `recv.amount.value` | {$150} | The balance still owing. |
| `recv.amount.hint` | This is the whole amount still owing. | After a price rise: `recv.amount.hint.part` = **The price is {$150}; {$120} was received on {Oct 24}.** |
| `recv.date.label` | Date received | Defaults to today; never after today. The shared date field. |
| `recv.how.label` | How | Not "How it was paid": the same word as Record a payment on a family's record, which writes through the same place. Required? No. |
| `recv.how.none` | Not recorded | The empty choice. |
| `recv.foot` | Records {$150} received in the season’s book. | The foot's sentence at the left. |
| `recv.cancel` | Cancel | |
| `recv.submit` | Mark received | |
| `recv.working` | Recording… | *(Reuses Record a payment's word.)* |
| `recv.done` | Marked {name}’s fee received. | Transient. |

### 3.2 A batch

| Key | String |
|---|---|
| `recv.bulk.title` | Mark {n} fees received |
| `recv.bulk.amount.label` | Total |
| `recv.bulk.amount.value` | {$1,200} across {8} players |
| `recv.bulk.amount.hint` | Each player’s whole balance is recorded. One date and one way for all of them. |
| `recv.bulk.foot` | Records {8} payments, {$1,200} in all, in the season’s book. |
| `recv.bulk.submit` | Mark {n} received |

Refusals for this window are in section 16 (closed fiscal year, already received, ended, not accepted yet, free).

---

## 4. Ending a registration (D): Decline, Withdraw, Release the spot

One window, three titles. The kit's form window, medium. The foot's sentence at the left; Cancel and the primary at the right.

### 4.1 Titles, body and buttons

| Key | Decline | Withdraw | Release the spot |
|---|---|---|---|
| `end.title` | Decline {name}? | Withdraw {name}? | Release {name}’s spot? |
| `end.body.plain` | {name} is not accepted. The family is emailed. | {name} comes off the roster. The family is not emailed. | {name}’s family hasn’t paid, so the spot goes back to {division}. The family is emailed. |
| `end.body.money` | {name}’s family paid {$150} on {Oct 24} ({E-Transfer}). What happens to it? | *(same)* | *(same)* |
| `end.body.money.many` | {name}’s family paid {$150} in all; the last payment was on {Oct 24} ({E-Transfer}). What happens to it? | *(same)* | *(same)* |
| `end.submit` | Decline and email | Withdraw | Release and email |
| `end.working` | Declining… | Withdrawing… | Releasing… |

- The method's brackets are dropped when the method is **Not recorded** (a staff screen can show "Not recorded"; the sentence reads
  more plainly without).
- Release is offered on a registration with nothing received or only part received; with part received the money body shows.
- When the family asked for the withdrawal (section 14), a line leads the body: `end.requested` = **{Grace Kim} asked to withdraw {Henry} on {Oct 24}: “{note}”** (no note: the line ends after the date).

### 4.2 The money question (only when money was received)

| Key | String | Notes |
|---|---|---|
| `end.refunded` | Refunded | Radio. Dim line under it: `end.refunded.sub` = **Records {$150} going back to the family**. |
| `end.refunded.date` | Date refunded | Defaults to today; not after today; not before the payment. |
| `end.refunded.how` | How | The method dropdown; **Not recorded** is the empty choice. |
| `end.kept` | Kept by the club | Radio. Dim line: `end.kept.sub` = **A reason is required, for example “withdrew after the refund date”.** |
| `end.kept.reason` | Reason | Required, marked as required. A text field, 200 characters. |
| `end.kept.reason.hint` | The family reads this in their email. *(Withdraw: **The family does not see this.**)* | Says the reason is customer-facing. |

The radio starts on **Refunded** as drawn (open question 1 recommends otherwise).

### 4.3 The note, the hints, the waitlist and the foot

| Key | Decline | Withdraw | Release |
|---|---|---|---|
| `end.note.label` | Note to the family | *(absent: nobody is emailed)* | Note to the family |
| `end.hint.plain` | The family is emailed that the registration wasn’t accepted. Your note goes in the email. | The family is not emailed. Use Email this family to tell them. | The family is emailed that the spot was released. Your note goes in the email. |
| `end.hint.refunded` | The family is emailed that the registration wasn’t accepted and that {$150} was refunded on {Oct 24} ({E-Transfer}). The refund shows on the season’s Money page. | The refund shows on the season’s Money page. The family is not emailed. | The family is emailed that the spot was released and that {$150} was refunded on {Oct 24} ({E-Transfer}). The refund shows on the season’s Money page. |
| `end.hint.kept` | The family is emailed that the registration wasn’t accepted and that the club is keeping the {$150}, with your reason. | The family is not emailed. | The family is emailed that the spot was released and that the club is keeping the {$150}, with your reason. |

The hint follows the choice live (plain, refunded, kept).

| Key | String | When |
|---|---|---|
| `end.waitlist.next` | {Ava} moves up from the waitlist and is emailed. | The ended child held a spot, the season moves the waitlist up on its own (`reg.promote` on) and someone is waiting. Two or more spots never free at once, so one name. |
| `end.waitlist.manual` | The spot stays open. You move the waitlist up yourself. | The season's waitlist is manual (`reg.promote` off) and someone is waiting. |
| *(no line)* | | Nobody is waiting, or the ended child held no spot. |

| Key | String | When |
|---|---|---|
| `end.foot.refunded` | The {$150} stays in the season’s book with the refund beside it. | Refunded. |
| `end.foot.kept` | The {$150} stays in the season’s book as the club’s. | Kept. |
| `end.foot.choose` | Choose what happens to the {$150}. | No choice made (only if open question 1 is accepted). |
| *(no foot sentence)* | | No money: absent beats a sentence. |

### 4.4 Results

| Key | String |
|---|---|
| `end.done.decline` | Declined {name}. The family was emailed. |
| `end.done.withdraw` | Withdrew {name}. |
| `end.done.release` | Released {name}’s spot. The family was emailed. |
| `end.done.refunded` | *(appended)* {$150} recorded as refunded. |
| `end.done.kept` | *(appended)* The club is keeping the {$150}. |
| `end.done.moved` | *(appended)* {Ava} moved up from the waitlist. |

Refusals: section 16.

---

## 5. Correct a price (E)

The kit's form window, medium. The window **tells**, it does not ask which: a price change on a paid registration settles itself, by
the rule below, and the words change as the new price is typed (§0e).

| Key | String | Notes |
|---|---|---|
| `price.title` | Correct {name}’s price | |
| `price.signed.label` | Signed up at | A read-only line. |
| `price.signed.value` | {$150} · {regular price}, {May 10} | The kind is one of `price.kind.*`. |
| `price.kind.regular` | regular price | |
| `price.kind.early` | early bird | |
| `price.kind.corrected` | corrected price | A second correction reads "{$120} · corrected price, {Oct 24}". |
| `price.new.label` | New price | A money field. |
| `price.reason.label` | Reason | Required, marked as required. 200 characters. |
| `price.reason.placeholder` | Coach’s child, club discount agreed by the board | The drawn example, as a placeholder only. |
| `price.cancel` / `price.submit` | Cancel / Save price | `price.working` = **Saving…** |

The line under the fields, from what was received and the new price (received = what is net on the registration):

| Key | When | String |
|---|---|---|
| `price.hint.unpaid` | Nothing received | {name} hasn’t paid. The new price is what the family owes. |
| `price.hint.raise` | New price above what was received | {name}’s family has paid {$150}. The {$30} difference shows as still owing. |
| `price.hint.lower` | New price below what was received | {name}’s family has paid {$150}. The {$30} difference is recorded as a refund. |
| `price.hint.even` | New price equals what was received | {name}’s family has paid {$150}. Nothing more is owing. |
| `price.hint.noEmail` | Raise or lower on a registration with money received | The family is not emailed. Use Email this family to tell them. |

For the lower case, two fields appear under the line (the same two as the refund choice in section 4.2): `price.refund.date` = **Date refunded**,
`price.refund.how` = **How** (**Not recorded** is the empty choice).

| Key | String |
|---|---|
| `price.foot.default` | Shown on the row and in the Money page’s history. |
| `price.foot.lower` | Records a {$30} refund. Shown on the row and in the Money page’s history. |
| `price.done` | Saved {name}’s price: {$120}. |
| `price.done.lower` | Saved {name}’s price: {$120}. {$30} recorded as refunded. |

The correction is recorded (old price, new price, reason, who, when) and moves no money by itself; the refund line, when there is
one, is the money. There is no household or sibling pricing here and no discount scheme: this is a correction.

---

## 6. Move division (F)

### 6.1 One registration

| Key | String | Notes |
|---|---|---|
| `move.title` | Move {name} | Eyebrow: the season. |
| `move.to.label` | Move to | A dropdown of the season's other divisions. |
| `move.option.spot` | {Division B} · {n} spots left · {$175} | Free: "Free". One spot: "1 spot left". |
| `move.option.full` | {Division C} · full, joins the waitlist | The 9b-1 form's wording. |
| `move.full.line` | {Division C} is full. {name} joins its waitlist, {1st} in line. | Amber line under the dropdown when a full division is picked. The primary becomes `move.submit.waitlist`. |

**The price question** appears only when the destination charges a different price **and nothing has been received**. It asks once,
with the price each would be:

| Key | String |
|---|---|
| `move.price.lead` | {Division B} charges {$175}. {name} signed up at {$150}. |
| `move.price.keep` | Keep {name}’s price · {$150} |
| `move.price.use` | Use {Division B}’s price · {$175} |
| `move.price.hint` | {Division B}’s price is worked out for the day {name} signed up, so an early bird still applies. |

Keep is the starting choice: a move never changes what a family owes unless the registrar says so.

**A child who has received anything keeps their price on any move**, and the window says so and points to the way:

| Key | String |
|---|---|
| `move.paid` | {name}’s family has paid, so the price stays {$150}. To change it, use Correct the price. |

| Key | String |
|---|---|
| `move.foot` | {name} moves from {Division A} to {Division B}. The family is not emailed. |
| `move.foot.waitlist` | {name} moves from {Division A} to {Division C}’s waitlist, {1st} in line. The family is not emailed. |
| `move.foot.promoted` | *(appended)* {Ava} moves up from the waitlist in {Division A}. |
| `move.submit` / `move.submit.waitlist` | Move / Move to the waitlist |
| `move.done` | Moved {name} to {Division B}. |
| `move.err.sameDivision` | {name} is already in {Division B}. |

### 6.2 A batch

| Key | String |
|---|---|
| `move.bulk.title` | Move {n} children |
| `move.bulk.to.label` | Move to |
| `move.bulk.room` | {Division B} has room for {6}. The other {4} stay where they are. | Shown when the batch is bigger than the room; absent otherwise. |
| `move.bulk.price.lead` | {Division B} charges {$175}. Some of these children signed up at a different price. |
| `move.bulk.price.keep` | Keep each child’s price |
| `move.bulk.price.use` | Use {Division B}’s price |
| `move.bulk.paid` | {k} have paid and keep their price: {Henry, Ava and Sam}. To change one, use Correct the price. |
| `move.bulk.foot` | {n} move to {Division B}. {k} paid and keep their price. The families are not emailed. |
| `move.bulk.submit` | Move {n} |

The price question is asked **once for the batch** and only when some child who has received nothing would have a different price.
Result lines: section 2.2.

---

## 7. Approve or promote into a full division (G)

The server refuses and the screen says so beside the row, with the offer. Reuses 9b-1 (`refuse.divisionFull.staff`).

| Key | String | Where |
|---|---|---|
| `full.approve` | {Division A} is full. Add to the waitlist instead. | Approve or a hand-add into a full division. *(9b-1 words, reused.)* |
| `full.promote` | {Division A} is full. {name} stays on the waitlist until a spot frees. | Promote. |
| `full.offer` | Waitlist {name} | The link beside `full.approve`; it does the move and says nothing more. |

Moving into a full division is not a refusal: it is the waitlist offer drawn into the Move window (section 6.1).

---

## 8. Undo: marked received by mistake (H)

A mistake fix, not a refund: it voids a payment that never arrived. It is refused once that payment's fiscal year is closed.

| Key | String | Notes |
|---|---|---|
| `undo.title` | Undo {name}’s payment? | |
| `undo.body` | This takes back the {$150} marked received on {Oct 24}. {name} shows as owing again. | |
| `undo.not` | It isn’t a refund. Use it only when the money never arrived. If it did and is going back, decline or withdraw instead. | One short paragraph. |
| `undo.foot` | The line stays in the season’s history, marked as voided. | |
| `undo.submit` | Undo payment | Cancel beside it. `undo.working` = **Undoing…** |
| `undo.done` | Took back {name}’s payment. | Transient. |
| `undo.err.closed` | Recorded in {2026}, which is closed. To change it, reopen {2026}. | **Existing** `recordedInClosedYearWords`; the "To change it" half is absent for anyone who cannot reopen. |
| `undo.err.none` | {name} has no received fee to undo. | Stale menu. |

---

## 9. The owing threshold (I)

A row on the season's Registration block (9b-1 §5), absent on a free season.

| Key | String | Notes |
|---|---|---|
| `reg.owing` | Owing turns amber | Row label. Value: **after {14} days** *(1: "after 1 day")*. Sub-line: **Counted from the day the child was accepted.** |
| `reg.owing.edit.label` | Turn owing amber after | Edit-mode label; a number box with the suffix **days**. |
| `reg.owing.edit.hint` | An accepted player who hasn’t paid turns amber on Registrations after this many days. Counted from the day they were accepted. | |
| `reg.owing.err` | Enter a whole number of days, from 1 to 365. | |

The value starts at 14 and is copied forward with the season.

---

## 10. The season's Money page (J)

Opens to the registrar, the club admin and the treasurer (Club plan: the treasurer reads it; the dev League Plus club's treasurer has no
Accounting and no page, §0e). Nobody types money onto this page: it is written only by marking a payment received, recording a refund,
or correcting a price.

### 10.1 Head and band

| Key | String | Notes |
|---|---|---|
| `money.eyebrow` | House league · {season} | |
| `money.title` | Money | |
| `money.export` | Export | One button, Excel first. |
| `money.band.owed` | Owed | Value {$2,100}; sub-line **{14} players**. The price fixed on each accepted registration. |
| `money.band.received` | Received | Value {$1,500}; sub-line **{10} players · after {$150} refunded** (no refunds: **{10} players**). |
| `money.band.owing` | Still owing | Value {$600} (amber when above $0); sub-line **{4} players**. |
| `money.band.aria` | Owed {$2,100}. Received {$1,500}. Still owing {$600}. | One joined band, one aria sentence. |
| `money.finished` | This season is finished. You can still mark fees received. | **Existing** 9a line (`SeasonLockLine`), reused: Money stays open after the season is completed. If refunds and price corrections also stay open on a finished season, extend it to "…mark fees received and record refunds." |

The band is absent on a free season; the page then reads `money.empty.free`.

### 10.2 Tabs, columns and values

| Key | String | Notes |
|---|---|---|
| `money.tab.all` | Every line | Quiet count. |
| `money.tab.owing` | Still owing | Quiet count. |
| `money.tab.refunds` | Refunds | Quiet count. |
| `money.col.date` | Date | |
| `money.col.player` | Player | |
| `money.col.what` | What | |
| `money.col.how` | How | |
| `money.col.amount` | Amount | Right-aligned. |
| `money.owing.col.player` | Player | The **Still owing** tab lists players, not lines: columns Player · Division · Owing since · Owing. |
| `money.owing.col.division` | Division | |
| `money.owing.col.since` | Owing since | **Accepted Apr 12 · 195 days**; unknown: **Not known**. |
| `money.owing.col.amount` | Owing | Right-aligned; amber at or past the threshold. |

**What** values:

| Key | String | Amount |
|---|---|---|
| `money.what.fee` | Registration fee · regular price *(or "early bird", "corrected price")* | {$150} |
| `money.what.refund` | Refund · declined *(or "withdrawn", "spot released", "price corrected")* | −{$150} (red) |
| `money.what.corrected` | Price corrected {$150} → {$120} · {reason} | — *(a history line: it moves no money)* |
| `money.what.kept` | Kept by the club · {reason} | — *(a history line)* |
| `money.what.voided` | Voided · marked received by mistake | {$150}, struck through; never counted |

**How** values: the method label (E-Transfer, Cash, Cheque, Card, Other), or **Not recorded** (a catch-up line for a payment ticked
before the book existed, and any payment saved with no method). The drawn "By hand" is not a method and is not used.

### 10.3 Empty states and the hint

| Key | Title | Body |
|---|---|---|
| `money.empty.all` | No money recorded yet | A fee shows here when you mark a registration received. |
| `money.empty.owing` | Nobody owes anything | Every accepted player has paid. |
| `money.empty.refunds` | No refunds | A refund shows here when you end a registration that had paid. |
| `money.empty.free` | This season is free | There is nothing to collect. |

| Key | String | When |
|---|---|---|
| `money.hint.club` | Fees file on the club’s Budget vs. Actual under House league registration fees, in the fiscal year each one is received. | The club has the Club plan. |
| `money.hint.leaguePlus` | This page is the season’s book. | League Plus (no Budget vs. Actual to file to). |

---

## 11. The season Overview's tiles (K)

The two tiles 9b-1 left out. Each opens the Money page. Absent on a free season.

| Key | Label | Figure | Sub-line |
|---|---|---|---|
| `tile.owed` | Owed | {$2,100} | {14} players |
| `tile.owing` | Still owing | {$600} (amber above $0) | {4} players |
| `tile.aria` | Owed {$2,100}, {14} players. Open Money. | | *(and: "Still owing {$600}, {4} players. Open Money.")* |

---

## 12. Budget vs. Actual (Club) (L)

The Statement keeps its two-decimal figures. One row for all house-league fees, the seasons under it.

| Key | String | Notes |
|---|---|---|
| `bva.fees.row` | House league registration fees | The expandable row. Sub-line when closed: **{2} seasons**. |
| `bva.fees.season` | {Dev House League 2026} | A sub-row: **the season's own name**, a link to that season's Money page. |
| `bva.fees.caption` | Budget: each division’s size times its price. Actual: fees received in this fiscal year, after refunds. | Under the row, once. |
| `bva.fees.split.note` | Part of {season}’s budget. The rest is in {2027}. | On a sub-row whose budget is split. |

**The split editor** (9b·11): a season's budget sits in the fiscal year its sign-ups open; the treasurer can split it.

| Key | String | Notes |
|---|---|---|
| `bva.split.link` | Split across fiscal years | On the sub-row, treasurer and owner only. |
| `bva.split.title` | Split {season}’s budget | |
| `bva.split.help` | A season’s budget sits in the fiscal year its sign-ups open. If the sign-ups and the season fall in different fiscal years, split it. | |
| `bva.split.first` | {2026} amount | The club's fiscal-year names. |
| `bva.split.second` | {2027} amount | |
| `bva.split.total` | The season’s budget is {$6,430}. The two amounts must add up to it. | |
| `bva.split.err.sum` | The two amounts add up to {$6,000}, but the season’s budget is {$6,430}. Change an amount so they match. | |
| `bva.split.err.closed` | {2026} is closed, so its plan can’t change. To change it, reopen {2026}. | **Existing** `planClosedWords`. |
| `bva.split.submit` | Save split | Cancel beside it. |
| `bva.split.remove` | Put it back in one year | A plain link when a split exists. |

---

## 13. The family's record in Families (M)

Dues now come from the price fixed on each registration, not the season's current fee.

| Key | String | Notes |
|---|---|---|
| `family.line.fixed` | Price fixed at sign-up, {Oct 24} | The league line's sub-line (the drawn text, sentence-cased). |
| `family.line.corrected` | Price corrected · {reason} | After a correction; replaces `family.line.fixed`. |
| `family.line.refunded` | {$150} refunded {Oct 24} | On an ended registration. Dues, Paid and Balance read $0. |
| `family.line.kept` | {$150} kept by the club | On an ended registration where the club kept it. |
| `family.line.ended` | Declined {Oct 24} / Withdrawn {Oct 24} / Spot released {Oct 24} | The ended state, same words as Registrations. |
| `family.ghost` | Pay link | A disabled button beside a balance, 0.5 faded. `family.ghost.tip` = **Online payment isn’t available yet. Record the payment by hand.** The drawn "· 12b" and a "coming soon" never appear. |

**Record a payment** keeps writing through the same place as Mark received, and now carries its own **Date received** and **How** into
the book (it dropped them before). Its words are unchanged (`FAMILY_PAYMENT_WORDS`) except where a fee is part-received:

| Key | String |
|---|---|
| `family.pay.what.part` | {where} · house league · {$30} still owing of {$150} |
| `family.pay.tick.part` | Balance |

(The whole-fee tick, labelled **Whole fee**, becomes **Balance** when the line is part-received.)

---

## 14. The family's status page: Ask to withdraw (N)

### 14.1 The door and the window

| Key | String | Notes |
|---|---|---|
| `ask.door` | Ask to withdraw a child | Below the children. One child: **Ask to withdraw {Henry}**. Absent when every child has ended. |
| `ask.title` | Ask to withdraw a child | One child: **Ask to withdraw {Henry}**. |
| `ask.pick` | Which child? | A radio list of the children who have not ended. Absent for one child. |
| `ask.note.label` | Note for the club | A text area, 300 characters, not required, no "optional" tag. |
| `ask.note.hint` | For example, why. The club may use it to arrange a refund. | |
| `ask.foot` | The club reads this and replies by email. {Henry} keeps their place until then. | The foot's sentence at the left. |
| `ask.cancel` / `ask.submit` | Cancel / Send request | `ask.working` = **Sending…** |

### 14.2 After the request

| Key | String | Where |
|---|---|---|
| `ask.sent` | Request sent. The club will email {grace.kim@example.ca} when {Henry} is withdrawn. | The confirmation in the window, then closes. |
| `ask.child.line` | You asked to withdraw {Henry} on {Oct 24}. The club will confirm by email. | A sub-line under the child on the status page, until the club acts. The tag stays **Accepted**. |
| `ask.err.ended` | {Henry} is already withdrawn. | *(a child that ended while the window was open)* "This registration has already ended." when the status is Declined. |
| `ask.err.twice` | You already asked to withdraw {Henry}. The club will reply by email. | |
| `ask.err.rate` | Too many tries. Please wait a few minutes and try again. | The throttle. |
| `ask.err.generic` | Something went wrong. Please try again. | **Existing** `form.err.global`. |

### 14.3 The staff notice it raises (Needs attention)

New event kind, label **House league withdrawal request**. One per request; it clears itself when the registration ends.

| Key | String |
|---|---|
| `ask.notice.title` | Withdrawal request: {Henry Kim} |
| `ask.notice.body` | {Grace Kim} · {Dev House League 2027} · {the note, clipped at 120 characters; "No note" when empty} |

The notice opens the Registrations screen on that child, and the Withdraw window leads with `end.requested` (section 4.1).

### 14.4 How an ended registration reads to the family

| Key | String | Notes |
|---|---|---|
| `status.child.tag.declined` | Declined | **Existing** (9b-1). |
| `status.child.tag.withdrawn` | Withdrawn | **Existing.** A released spot reads Withdrawn too. |
| `status.child.fee.refunded` | {$150} refunded on {Oct 24} ({E-Transfer}) | The fee line of an ended child with a refund. Brackets dropped for **Other** and **Not recorded**. |
| `status.child.fee.kept` | The club is keeping the {$150}: {reason} | Kept. The reason is the club's own words, escaped. |
| `status.child.fee.partial` | {$30} to pay | Amber. A price rise on a part-received registration. Sub-line `status.child.fee.partial.sub` = **The price is now {$150}. {$120} received {Oct 24}.** |
| `status.child.fee.partRefund` | {$120} · paid {Oct 24} | After a price fall. Sub-line **{$30} refunded {Oct 25}.** |

An ended child has no "To pay" and no pay card, no "Ask to withdraw", and no "We’ll email you if a spot opens" line (a child who is
no longer waiting).

---

## 15. Emails (O)

The 9b-1 emails (§10) are reused word for word. Only the money lines and the release email are new.

### 15.1 Declined: the lines added

Heading, greeting, subject (`Registration update — {season}`) and the closing contact line are unchanged. Between the lead and the
contact line, in this order and each only when it applies:

| Key | String | When |
|---|---|---|
| `mail.declined.note` | {the note, verbatim, in its own paragraph} | The registrar wrote a note. Escaped. |
| `mail.declined.refunded` | We refunded the {$150} you paid on {Oct 24} ({E-Transfer}). | Refunded. Brackets dropped for **Other** and **Not recorded**. |
| `mail.declined.kept` | The club is keeping the {$150} you paid. The reason: {reason}. | Kept. The reason verbatim, escaped. |

### 15.2 Released: a new email

Sent when the registrar presses **Release and email**. Wears the club through `familyNotice` like every family email.

| Key | String |
|---|---|
| `mail.released.subject` | {Henry}’s spot was released — {season} |
| `mail.released.heading` | Spot released |
| `mail.released.lead` | The club has released {possessive(Henry Kim)} spot in **{division}** for **{season}**. {Henry} is no longer registered. |
| `mail.released.unpaid` | The {$150} fee was not received. |
| `mail.released.note` | {the note, verbatim, in its own paragraph} |
| `mail.released.refunded` | *(as `mail.declined.refunded`)* |
| `mail.released.kept` | *(as `mail.declined.kept`)* |
| `mail.released.contact` | If you think this is a mistake, contact {club} at {email}. |

`mail.released.unpaid` shows only when nothing was received. The footnote reason reads "{Henry} was signed up for {season}" as in 9b-1.

### 15.3 Withdrawn

**No email today**, and none is written: Withdraw says so in its window (`end.hint.*`). Open question 2 recommends one.

### 15.4 A flag, not a word

A saved platform override of the staff **Approve** email replaces the whole body, so it would drop the price and the how-to-pay lines
9b-1 added. The build should preview the override against the money block or leave the money block outside the override. Flagged for
the build; no copy.

---

## 16. Refusals (P)

Staff-facing unless marked. "Existing" strings are reused with their source; the others are new. The status codes are the server's.

| Key | Code | Who sees it | String |
|---|---|---|---|
| `err.notAllowed.fee` | 403 | Staff without fee rights | Only the owner, a club admin, a league admin or a league registrar marks a house-league fee paid. *(Existing: `reasonNoFeePermission`.)* |
| `err.notAllowed.run` | 403 | Staff without placement rights | Only the owner, a club admin or a league admin can do this. |
| `err.finished` | 423 | Staff on a finished season (race: the actions are absent) | This season is finished. Reopen it to change it. *(Existing: `FINISHED_SEASON_REFUSAL`.)* |
| `err.full` | 409 | Staff | {Division A} is full. Add to the waitlist instead. *(Existing; Promote uses `full.promote`.)* |
| `err.alreadyReceived` | 409 | Staff | {name}’s fee is already received. |
| `err.free` | 409 | Staff | {name}’s season is free, so there is no fee to receive. |
| `err.notAccepted` | 409 | Staff | {name} hasn’t been accepted yet, so there is no fee to receive. |
| `err.ended` | 409 | Staff | {name}’s registration has already ended. |
| `err.changed` | 409 | Staff | The money on this registration changed since the window opened. Close it and open it again. *(After Families' "Something changed since this window opened".)* |
| `err.amount` | 400 | Staff | Enter $0 or more. *(Existing `record.err.price`.)* |
| `err.price.same` | 400 | Staff | That is already the price. Enter a different amount. |
| `err.price.reason` | 400 | Staff | Say why the price is changing. |
| `err.kept.reason` | 400 | Staff | Say why the club is keeping the {$150}. |
| `err.date.future` | 400 | Staff | A payment can’t be received after today. *(Existing; "A refund can’t be dated after today." for a refund.)* |
| `err.date.beforePayment` | 400 | Staff | A refund can’t be dated before the payment it returns. |
| `err.closed.date` | 409 | Staff | {Oct 24} is in {2026}, which is closed. Date it {Jan 1, 2027} or later, or reopen {2026} first. *(Existing `yearClosedWords`; a refund or a received date in a closed year. The reopen half is absent for anyone who cannot reopen.)* |
| `err.closed.recorded` | 409 | Staff | Recorded in {2026}, which is closed. To change it, reopen {2026}. *(Existing `recordedInClosedYearWords`: Undo, and a price change on a payment in a closed year.)* |
| `err.closed.plan` | 409 | Treasurer | {2026} is closed, so its plan can’t change. To change it, reopen {2026}. *(Existing `planClosedWords`: the budget split.)* |
| `err.failed` | 500 | Staff | That didn’t go through. Please try again. *(Existing, Families' `failed`.)* |
| `err.family.ended` | 409 | Family | {Henry} is already withdrawn. *(= `ask.err.ended`.)* |

A batch refused for a closed year records nothing and says so: `err.closed.batch` = **Nothing was recorded. {Oct 24} is in {2026}, which is closed.** followed by the rest of `err.closed.date`.

---

## 17. What changed from the drawings, and why

| Drawn | Now | Why |
|---|---|---|
| Correct a price, on a paid registration: "also asks how the $30 difference is settled: refunded, or still owing" | The window **tells**: a rise reads "the $30 difference shows as still owing"; a fall reads "the $30 difference is recorded as a refund", with a date and how | §0e. With no family credit before Stage 12, a lower price can only mean a refund, so a choice offers nothing. |
| Bulk Move division: one line, no question | Asks once: **Keep each child’s price** / **Use {division}’s price**; children who have paid always keep theirs and are named | §0e and the coordinator's note: a paid child keeps their price on any move. |
| Single Move division: "Asks whether to change the price" | The question is asked only when nothing was received; a paid child sees `move.paid`, pointing to Correct the price | Same reason: a move must never reprice received money. |
| Mark received: no window drawn ("$150, today, how it was paid") | A window showing the amount (not typed), Date received and How | §0e: it records the full balance and takes a date and a way. Label **How**, not "How it was paid", to match Record a payment, which writes through the same place. |
| Method list: "e-Transfer" in running sentences | **E-Transfer · Cash · Cheque · Card · Other**, label verbatim, in brackets after the date | The product's one list (`DUES_PAYMENT_METHOD_LABEL`). Brackets avoid building a preposition around "Cash". |
| Fee sub-line "since accepted, Apr 12" and "accepted today" | **Accepted Apr 12**, **Accepted today**; the day count moved into the pill ("$150 owing · 195 days") | A sentence-case sub-line that stands alone, and the count is not said twice. |
| Registrations row "Division B · not placed" (one line, "Division · team" column) | Division cell: name, with a sub-line **Not placed** or the team | The Division column is two lines; the team's own column is 9c's. |
| "Division · team" column head | **Division** | Same reason. |
| Tab "Declined / withdrawn" (and "Pending review", and an "All" tab) | **To review · Active · Waitlist · Ended** | The drawn tabs. Ended also holds released spots. |
| "Email these families" (Tools) | **Email families** | The one name for the composer (9a §0). "These families" would promise the screen's filter; until 9d's audiences it opens the whole season's composer. |
| Bulk "Approve" on the Waitlist tab | **Promote** on the Waitlist tab | The row button's word; the bar uses what the row says. |
| Release the spot: button "Release the spot" | **Release and email** | The standing rule: a change that tells families is held until the ✓ and the button names it. |
| Release stored how? | Stored as Withdrawn with a "spot released" mark; the Ended tab says **Spot released {date}**, the family reads **Withdrawn** | The coordinator's note. A release is the club's act, so the family-facing tag stays one of the two existing words. |
| Refund "What": "Refund · declined, Division A full" | **Refund · declined** / withdrawn / spot released / price corrected | The note to the family is not a reason and is not stored on the book line; the drawn tail would invent a field. |
| "How": "By hand" | A method or **Not recorded** | "By hand" is not a payment method and 9 of the 10 fixture lines predate the method field. |
| "Shown on her row and in the Money page's history." | "Shown on the row…" | No pronouns for a child (9b-1). |
| "Maya hasn't paid. On a paid registration this window also asks…" | `price.hint.unpaid` | Replaced by the telling lines above. |
| Statement sub-rows "2026 season" | The **season's own name** | Two seasons in one year ("Summer 2026", "Fall 2026") would collide on "2026 season". |
| Money hint "(Club plan). On League Plus, this page is the book." | Two lines by plan: Club reads the filing sentence, League Plus reads "This page is the season’s book." | A customer reads only the sentence that is true for their plan, and a League Plus club is not told about a statement it does not have. |
| Pay ghost "Pay link · 12b" (family record) | **Pay link** with a tooltip | 9b-1 §13: a stage name never appears on a customer screen. The brief's "coming soon" is not used for the same reason. |
| "No fee" (a free season, in the brief) | **Free**, and the Fee column and filter are absent on a wholly free season | One word for a zero price (9b-1) and absent beats a column that can only say Free. |
| `Accepted` vs staff `Approved` in the owing sub-line | **Accepted** | An automatic acceptance and a promotion are not an Approve. |
| Withdraw hint (drawn only for Decline) | Written for all three, with the money-visible differences | Withdraw sends no email today; the window must say so. |

---

## 18. Open word questions

**All four RULED by the owner 2026-10-25, as recommended (plan §0e):** 1 · nothing picked, `end.foot.choose` shows until a choice
is made; 2 · Withdraw emails when money moved — subject `Registration update — {season}`, heading **Registration update**, lead
`mail.withdrawn.lead` = **{possessive(Henry Kim)} registration for {season} — {division} has been withdrawn.**, then the money line
(`mail.declined.refunded` / `mail.declined.kept`) and the contact line; `end.hint.refunded` / `end.hint.kept` for Withdraw become
**The family is emailed that {name} was withdrawn and that {$150} was refunded on {Oct 24} ({E-Transfer}).** / **…and that the club
is keeping the {$150}, with your reason.**, and the kept reason hint reads **The family reads this in their email.**; 3 · no refund
reason field; 4 · a raised price tells nobody this stage. The questions as asked:

1. **A pre-picked "Refunded".** The drawing starts the money question on Refunded. A refund is a line in the book going out; a mis-click records money that never went. **Recommendation:** start with neither picked and show `end.foot.choose` in the foot, the primary absent until a choice is made (absent beats disabled). One string, `end.foot.choose`, is already written for it. The owner's call; the drawing's default is built until then.
2. **Withdraw sends no email.** A family that asked to withdraw learns from the club's e-Transfer, but a family whose child the club withdrew learns from the status page. **Recommendation:** Withdraw emails the family when money was handled (a refund, or a kept fee with its reason) and stays silent otherwise, using `mail.declined.refunded` / `mail.declined.kept` under a "Registration update" heading. Not written: it changes what Withdraw does, not only what it says.
3. **A raised price tells nobody.** `price.hint.noEmail` says so and points to Email this family. **Recommendation:** accept it for 9b-2; a "tell the family" tick on a raise is a drawing, not a word.
4. **The refund line's reason.** The Money page's "Refund · declined" has no free-text tail. If the owner wants the registrar's own reason on refunds, the Refunded choice needs a field; the words would be `Refund · declined, {reason}`.

---

## 19. Checks

`npm run check:spelling` scans `app`, `components` and `lib` only, so it cannot check this file; run for completeness (below). By
eye against the enforced list: no "instalment", no "financial year" (the Statement says "fiscal year"), no clock time, no
"Ledger" (named only to retire it), no "Approved" in a family string (the staff button **Approve** and the verb "approved" in a
staff result line are the staff words), no "12b" or "coming soon" in a customer string. **Words to watch when the build writes these
into components:** "E-Transfer" with a capital E (from the label map, never typed); "cheque" (a payment method, permanent); "colour"
is not used; "refund" and "refunded" never "reimburse"; "installment" does not appear; the possessive of a name ending in s through
`possessive()` (Lopez’s family, Hughes’ spot); "8:00 a.m." through `formatTime()`. The example names, amounts and the e-Transfer line
are the dev fixture's, not product copy, and take `spelling-ok` if a build copies them into a string.
