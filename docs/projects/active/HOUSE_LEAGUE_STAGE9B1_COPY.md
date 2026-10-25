# House league Stage 9b-1: the words (`/marketing`, 2026-10-25)

> Copy for the 9b-1 build (`HOUSE_LEAGUE_STAGE9B1_BUILD_PROMPT.md`, "Before any code" step 2): season set-up, the family's sign-up
> form, the confirmation, the status page, the emails, the staff notice and the refusals. The drawings (`HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`,
> tab "9b-1 Sign-up" and the Add age groups window on "Your two questions") are the ruled starting point; every drawn word is kept
> unless a house rule or the code breaks it, and every change is listed in section 13 with its reason. The rulings in
> `HOUSE_LEAGUE_STAGE9_PLAN.md` §0, §0b, §0c and the six owner rulings of 2026-10-25 (section 0) are not reopened.
> Mirrors the shape of `HOUSE_LEAGUE_STAGE9A_COPY.md`. Each string has a key a developer can grep, written `like.this`.

## 0. Conventions and the day's rulings

**House rules applied.** Sentence case everywhere (including panel labels and email headings: "Registration details", never
"Registration Details"). Times read "8:00 a.m." through `formatTime()` (no clock time appears in 9b-1's strings; the rule is here
because the form's dates could grow one). Dates read as the club's stored days through `formatStoredDate`: "Jun 1", and
"Jun 1, 2028" only when the year is not this year. A name ending in s takes the bare apostrophe through `possessive()`, never a
hand-built `’s`. Apostrophes are curly `’`. Canadian spelling per the gate: "installment", no "-ise", never "financial year".
No sales voice: nothing here says "unlock", "powerful" or "seamless". Money reads `$165`, and `$165.50` only when there are cents.
Free reads **Free** (never "$0").

**Pluralization.** `{n}` strings pluralize and the singular is written out: "1 spot left" / "{n} spots left", "1 child" /
"{n} children", "1 division" / "{n} divisions", "1 registered child no longer fits" / "{n} registered children no longer fit".

**Ordinals** (`{ord}`): 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. One function for the form, the confirmation, the status
page and the emails. The waitlist position is always an ordinal in family copy ("Waitlist · 1st"), never "#1" (the old emails
said "#1": changed, section 13).

**Name lists** (`{names}`): "Henry", "Henry and Ava", "Henry, Ava and Sam" (no comma before "and"). First names in sentences, full
names in detail rows.

**One word per thing.**

| Thing | Family word | Staff word | Never |
|---|---|---|---|
| The whole submission (one or more children) | **sign-up** (noun), "sign up" (verb) | sign-up | "submission", "application" |
| One child's record in it | **registration** | registration | "entry", "enrolment" |
| A child who has a spot | **Accepted** | Approved (the button is **Approve**; 9b·12) | family copy: "Approved", "Confirmed" |
| A child waiting for the club's review | **Received** | To review | "Pending", "Pending review" on a family screen |
| A child waiting for room | **Waitlist** / "on the waitlist" | Waitlist | "Waitlisted" as a tag |
| Room in a division | **spots** ("7 spots left") | Players ("5 / 12") | "seats", "places" |
| What the family owes | **To pay** | Owed | "due now", "balance" |
| The code that finds a sign-up | **reference** | reference | "reference code", "confirmation number", "#" |
| The club's payment words | **How to pay** | How to pay | "payment instructions" |

**The six owner rulings of 2026-10-25, as the copy keeps them.**

1. A child's price is recorded at sign-up and never moves when the convenor edits prices. The hint "A price change applies to
   new sign-ups only: each registration keeps the price it signed up at." is now literally true and is kept.
2. An existing division edits as drawn (pencil flips the whole record, every field autosaves, "Remove this division" only
   while nobody is in it). Add age groups is the create door and asks, with a footer button.
3. On a review-first season a received child holds a spot; once accepted and received children fill the size, the next child
   goes to the waitlist. Copy says "holds a spot" wherever review-first is described.
4. Close and reopen: "Close registration" closes the form now, and the block then says the convenor closed it, with the day.
   "Reopen until…" sets a new close date and opens it. When the close date passes, the page says "Closed Aug 1". The page always
   says whether the date or the convenor closed it. Before the open date: "Opens Jun 1".
5. Staff approving or hand-adding into a full division are refused; promotion from the waitlist happens only when a spot frees.
6. Email consent is an unticked line beside the waiver, recorded once per sign-up.

**Not in these strings (so a developer does not add them):** the team on the status page (9c), "Ask to withdraw a child" (9b-2),
the Overview's Owed / Still owing tiles (9b-2), a live Pay now (12b), tax, installments, discounts, household credit. The
internal stage name **"12b" never appears on a customer screen or in an email**: the drawings' "Pay now · 12b" is a drawing
annotation; the customer string is "Pay now" (section 7.9).

---

## 1. Create window

| Key | String | Notes |
|---|---|---|
| `create.title` | Create a house-league season | Drawn. The adjective takes the hyphen; the module name is "House league". |
| `create.name.label` | Name | |
| `create.name.placeholder` | Summer 2027 | Drawn value as the placeholder, not as a default. |
| `create.sport.label` | Sport | A dropdown (form selects are dropdowns). |
| `create.dates.label` | Season dates | |
| `create.dates.start.aria` | First day of the season | |
| `create.dates.end.aria` | Last day of the season | |
| `create.hint` | Next, on the season’s page: age groups and prices, when the form opens and closes, the waiver and how families pay. Its web address is made from the name. | Drawn hint listed "the form’s dates and waiver"; it left out how to pay, which is now a required step (9b·1). |
| `create.cancel` | Cancel | |
| `create.submit` | Create season | Drawn. |
| `create.err.nameRequired` | Give the season a name. | |
| `create.err.nameTaken` | You already have a season with this name. Give this one a different name. | Slug collision after the reserved/duplicate guard. |
| `create.err.nameReserved` | That name can’t be used. Try another. | Reserved slug. No explanation of the list. |
| `create.err.datesOrder` | The last day can’t be before the first day. | |

Whether the season dates are required is the build's call (the 9a home already has a "Dates not set" line, so they are optional
today); no "required" string is written.

---

## 2. Divisions block (the season's Overview)

| Key | String | Notes |
|---|---|---|
| `divisions.title` | Divisions | |
| `divisions.add` | + Add age groups | Desk. Phone: the + symbol alone, 44 px, `aria-label` "Add age groups". |
| `divisions.col.division` | Division | |
| `divisions.col.born` | Born in | |
| `divisions.col.players` | Players | Staff word for room. Cell: "5 / 12". |
| `divisions.col.price` | Price | |
| `divisions.col.early` | Early bird | |
| `divisions.col.edit.aria` | Edit {division} | The pencil. |
| `divisions.cell.born` | 2017–2018 | A single year reads "2017". En dash, no spaces. |
| `divisions.cell.born.empty` | Not set | Amber. A draft division saved without years. |
| `divisions.cell.players` | 5 / 12 | `{taken} / {size}`. Taken = accepted plus received. |
| `divisions.cell.players.noSize` | 5 / — | Size not yet set. |
| `divisions.meter.aria` | 5 of 12 spots taken | |
| `divisions.cell.price` | $165 | **Free** when 0. |
| `divisions.cell.price.empty` | Not set | Amber. |
| `divisions.cell.early` | $145 through Jun 30 | The early-bird date is the last day the amount applies, so it reads "through" (section 13). |
| `divisions.cell.early.none` | — | |
| `divisions.cell.early.noDate` | $145, needs a date | Amber. An early amount with no season early-bird date does nothing. |
| `divisions.phone.line` | Born 2017–2018 · 5 of 12 players · $165 | Phone row detail. Free: "· Free". With early bird: "· $165, $145 through Jun 30". |
| `divisions.hint` | A price change applies to new sign-ups only: each registration keeps the price it signed up at. | Drawn, kept. It sits under the table at every width. |
| `divisions.empty.title` | No age groups yet | |
| `divisions.empty.body` | Add the age groups you run. Each becomes a division with its own birth years, size and price. | Mirrors the Add age groups intro. |
| `divisions.empty.cta` | Add age groups | The same door as the header button. |

The drawing's second sentence under the table ("Early bird amounts and the U12 price are examples; the fixture has one season
fee of $165.") is a drawing note, not product copy, and is not written.

---

## 3. Add age groups window (desk and phone)

A create door: it asks, and its footer button commits. KitDialog on a desk; full-screen with a back arrow on a phone. Sentence at
the foot's left (`footerStart`), then Cancel, then the primary.

### 3.1 Words in the window

| Key | Desk | Phone | Notes |
|---|---|---|---|
| `add.title` | Add age groups to {season} | Add age groups | Phone: the season name is bold, the first line of the body (the 9a title rule). |
| `add.intro` | Tap the groups you run, or type your own name. Each becomes a division with its own birth years, size and price. | same | Drawn. |
| `add.chip.on.aria` | {group}, selected | same | The chip shows "U8 ✓". |
| `add.chip.had` | U10 · 2 already / U12 · already | U10 · 2 / U12 | A group the season already has. 1 existing reads "already"; 2 or more read "{n} already". Tapping it again adds another division. |
| `add.chip.type` | + Type a name | + Name | |
| `add.chip.type.placeholder` | Age group name | same | The text field the chip opens. |
| `add.chip.type.add` | Add | same | |
| `add.col.division` | Division | (row title) | |
| `add.col.born` | Born in | | |
| `add.col.players` | Players | | |
| `add.col.price` | Price | | |
| `add.born.placeholder` | Pick | | A dropdown of years; blank on purpose (the 4c-2 ruling: the club picks, we never guess from "U13"). |
| `add.born.to.aria` | Last birth year for {group} | | And `add.born.from.aria`: "First birth year for {group}". |
| `add.remove.aria` | Remove {group} | | The row × (a plain glyph). |
| `add.row.pick` | Pick the birth years | | Phone row line, amber, while the years are blank. |
| `add.row.summary` | Born 2019–2020 · 12 players · $165 | | Phone row line when complete. Free: "· Free". |
| `add.row.edit.aria` | Edit {group} | | Phone pencil; opens that row's fields. |
| `add.cancel` | Cancel | Cancel | |
| `add.submit` | Add {n} divisions / Add 1 division | Add {n} / Add 1 | Fades to 0.5 while the foot sentence names what is missing. |

### 3.2 The hints under the table

Three short hints replace the drawn paragraph (one idea each; the old one carried four).

| Key | String |
|---|---|
| `add.hint.cutoff` | Birthdays count from {Sep 1} for {sport}, the club’s cut-off. (Absent when the club has no cut-off set.) |
| `add.hint.years` | The birth years are yours to pick. We don’t guess them from the name. |
| `add.hint.twice` | To run two divisions for one age group, such as U10 A and U10 B, tap its chip again. |

### 3.3 Warnings (amber, one sentence each, never blocking)

| Key | String | When |
|---|---|---|
| `add.warn.gap` | No division takes children born in {years}. A child born then won’t fit any division. | A year between the lowest and highest covered year that no division (new or existing) holds. `{years}`: "2016" or "2016–2017". |
| `add.warn.overlap` | {A} and {B} both take {years}. A child born then can choose either. | Two groups whose years partly overlap. **Two groups with exactly the same years raise no warning**: that is the deliberate A and B pair. |
| `add.warn.sameName` | Two divisions are named {name}. Rename one, for example {name} A and {name} B, so families can tell them apart. | Two rows (or a row and an existing division) with the same name. Blocks nothing; the family's pick screen needs distinct names. |
| `add.err.yearsOrder` | The first year can’t be after the last. | Inline on the row; blocks the row. |
| `add.err.size` | Give {group} its number of players. | Blocks. Defaults start from the season, so this is rare. |
| `add.err.price` | Give {group} a price. Enter 0 if it is free. | Blocks. |

### 3.4 The foot sentence and the button

The foot names the **first** missing thing only, in this order: birth years, then size, then price. Names are listed when there
are one or two; three or more are counted.

| State | Desk foot (`add.foot.*`) | Phone foot |
|---|---|---|
| Nothing tapped | Tap the age groups you run. | Tap the groups you run. |
| All rows complete | 2 new divisions *(1 new division)* | 2 new *(1 new)* |
| One row missing years | 2 new divisions · U14 still needs its birth years | 2 new · U14 still needs its birth years |
| Two rows missing years | 3 new divisions · U14 and U16 still need their birth years | same |
| Three or more | 4 new divisions · 3 still need their birth years | 4 new · 3 still need birth years |
| Years done, size missing | 2 new divisions · U14 still needs a size | same |
| Years and size done, price missing | 2 new divisions · U14 still needs a price | same |

---

## 4. Division record (reads first, edits whole)

Pencil flips the whole record to its form; every field autosaves; the check flips it back. "Saved" is the transient word (it
fades; only an error persists).

| Key | String | Notes |
|---|---|---|
| `record.edit.aria` | Edit {division} | Pencil. |
| `record.done.aria` | Done | The check. |
| `record.saved` | Saved | Transient. |
| `record.saveError` | Couldn’t save. Try again. | Persists until the next successful save. |
| `record.name.label` | Name | |
| `record.born.label` | Born in | Two year dropdowns. |
| `record.born.hint` | Birthdays count from {Sep 1}. Changing the years never moves a child who is already registered. | Drawn hint, split into two plain sentences. |
| `record.born.warn` | {n} registered child no longer fits these years. They stay where they are. / {n} registered children no longer fit these years. They stay where they are. | The "n no longer fit" warning. Amber, under the field, appears after the change autosaves. Counts accepted, received and waitlisted. Warns, never blocks. |
| `record.players.label` | Players | The size. |
| `record.players.hint` | {n} signed up. A lower number never removes anyone. | |
| `record.price.label` | Price | |
| `record.price.hint` | The season’s price unless you change it. | Drawn. |
| `record.early.label` | Early bird | |
| `record.early.hint` | Through {Jun 30}, the season’s early-bird date. | When the season has no early-bird date: "Set the early-bird date under Registration first." |
| `record.note.label` | Note for families | **New field, needed by 9b·13.** |
| `record.note.hint` | Shown on the sign-up form when a child fits more than one division, for example “Tuesday nights”. | Maximum 60 characters. |
| `record.note.placeholder` | Tuesday nights | |
| `record.remove.link` | Remove this division… | A rare door at the foot of the body. **Present only while nobody is in it** (accepted, received or waitlisted); otherwise absent, with no line. The ellipsis because it asks. |
| `record.remove.title` | Remove {division}? | |
| `record.remove.body` | Nobody has signed up for it. Families will no longer see it on the sign-up form. | |
| `record.remove.foot` | You can add it again later. | |
| `record.remove.confirm` | Remove division | Primary. Cancel beside it. |
| `record.err.nameRequired` | Give the division a name. | |
| `record.err.nameTaken` | Another division in this season has this name. | |
| `record.err.price` | Enter $0 or more. | |
| `record.err.early` | The early-bird amount can’t be more than the price. | |
| `record.err.remove` | This division has registrations, so it can’t be removed. | Server refusal if the door is stale. |

---

## 5. Registration block

Title **Registration**; pencil `aria-label` "Edit registration settings" flips the whole block; fields autosave.

### 5.1 Rows (reading state)

| Key | Label | Value |
|---|---|---|
| `reg.dates` | Registration dates | See 5.2. |
| `reg.early` | Early bird | Set: **Through Jun 30.** with the sub-line "The last day the early-bird price applies, in the club’s time." Not set: **Not set.** with "Set a date to offer an early-bird price." |
| `reg.waiver` | Waiver | On: **On** · “I acknowledge that softball involves risk…” (the first 60 characters, then an ellipsis). Off: **None** with "Families sign up without one." |
| `reg.consent` | Email consent | **Asked on the form, unticked, beside the waiver.** with the sub-line "Emails about a registration are sent either way." No edit control (see note below). |
| `reg.pay` | How to pay | The club's text, in quotes. Free season: **Not needed: this season is free.** A price above $0 and nothing written: **Required before registration can open.** (amber) |
| `reg.new` | New registrations | Automatic: **Approved while a division has room. A full division starts a waitlist.** Review-first: **Held for your review. A child waiting for review holds a spot.** (The waitlist clause follows in both: see `reg.promote`.) |
| `reg.promote` | Waitlist | On: **Moves up on its own when a spot frees.** Off: **You move it up yourself.** |

The two switches that moved off Create live in edit mode as:

| Key | Edit-mode label | Hint |
|---|---|---|
| `reg.new.edit` | Approve new registrations while a division has room | Off: every registration waits for your review, and a child waiting for review holds a spot. |
| `reg.promote.edit` | Move the waitlist up on its own | When a spot frees, the first child waiting is accepted and emailed. |

Edit-mode fields for the other rows:

| Key | String |
|---|---|
| `reg.dates.open.label` / `reg.dates.close.label` | Form opens / Form closes |
| `reg.early.edit.label` | Early-bird date |
| `reg.early.edit.hint` | The last day the early-bird price applies. Each division has its own early-bird amount. |
| `reg.waiver.edit.label` | Waiver text |
| `reg.waiver.edit.hint` | Families tick a box to agree. Leave it empty if you don’t need one. |
| `reg.pay.edit.label` | How families pay |
| `reg.pay.edit.hint` | Shown to families once a child is accepted, and in their email. For example: “e-Transfer to treasurer@devleague.ca within 14 days of acceptance, with your child’s name in the message.” |
| `reg.pay.err.required` | Add how to pay. At least one division has a price. |
| `reg.pay.err.clear` | Registration is open and a division has a price, so how to pay can’t be empty. |
| `reg.err.datesOrder` | The form can’t close before it opens. |
| `reg.warn.earlyAfterClose` | The early-bird date is after the form closes, so it never applies. (amber, warns) |

**Email consent has no edit control.** The consent line is always asked (the drawing gives it no switch). If the owner wants the
line switchable, that is an ask, not copy.

### 5.2 The dates row: state words

The state comes from the status and the dates together, in the club's day (stored as typed, never re-zoned). The row always says
whether the date or the convenor closed registration.

| State | Value line | Sub-line | Door |
|---|---|---|---|
| Dates not set | Not set | Set when the form opens and closes. | Set dates |
| Getting ready (draft), dates set | Jun 1 – Aug 1 | The form opens on Jun 1 once you open registration. | |
| Open, open date still ahead | Jun 1 – Aug 1 | Opens Jun 1. | Close registration |
| Open | Jun 1 – Aug 1 | Open until Aug 1. | Close registration |
| Closed by the date | Closed Aug 1 | The close date passed. | Reopen until… |
| Closed by the convenor | You closed registration on Oct 3. | The close date was Aug 1. *(omitted if no close date was set)* | Reopen until… |

`reg.dates.state.*` keys, in that order: `notSet`, `draft`, `opensAhead`, `open`, `closedByDate`, `closedByYou`. Door labels:
`reg.dates.close` "Close registration", `reg.dates.reopen` "Reopen until…" (the ellipsis because it asks), `reg.dates.set` "Set dates".

### 5.3 Where the same state shows elsewhere (one function, no second wording)

| Surface | Opens ahead | Open | Closed by the date | Closed by the convenor |
|---|---|---|---|---|
| Season header pill (staff) and public chip | Opens Jun 1 | Registration open | Closed Aug 1 | Registration closed |
| Public season page, line under the chip | Registration opens Jun 1. | Registration closes Aug 1. | Registration closed Aug 1. | Registration for this season has closed. |
| Home row second line (replaces 9a's "Registration was set to close {date}") | Opens Jun 1 | Registration closes Aug 1 | Registration closed Aug 1 | Registration is closed. Start the season from its page. *(registrar: Registration is closed.)* |
| Club home "Open now" | not listed | Registration open · $165 per player | not listed | not listed |

The public page never says who closed it. "Open now" row prices: one price "$165 per player"; a range "$165–$175 per player";
all free "Registration open · Free"; no price yet "Registration open".

### 5.4 The close and reopen windows (changes to 9a's §4.2 and §4.3)

**Close registration** (title, lead, foot and buttons stay as 9a §4.2). Changed change-lines:

| Key | String |
|---|---|
| `closewin.changes.form` | The sign-up form closes now, whatever the close date says. |
| `closewin.changes.page` | The season page says “Registration for this season has closed.” |

**Reopen registration** replaces 9a §4.3's body. It becomes "Reopen until…".

| Part | String |
|---|---|
| `reopen.link` | Reopen until… |
| `reopen.title` | Reopen registration for {season}? |
| `reopen.lead` | The sign-up form opens again now and stays open until the date you pick. |
| `reopen.field` | Close date |
| `reopen.field.hint` | The last day families can sign up. |
| `reopen.changes.1` | Families can sign up again, and the season shows under Open now. |
| `reopen.changes.2` | People already on the waitlist keep their place. |
| `reopen.changes.3` | Families are not emailed. |
| `reopen.foot` | You can close it again at any time. |
| `reopen.confirm` | Reopen registration |
| `reopen.err.past` | Pick a day that hasn’t passed. |
| `reopen.err.empty` | Pick the day the form should close. |

The field starts as the existing close date when that is still ahead, and blank when it has passed. This replaces 9a's amber
loose end ("Your close date, {date}, has passed. Pick a new date so the form stays open."): the field is now the answer.

### 5.5 Open registration window (changes to 9a's §4.1)

Only the change-lines that the new rules make false:

| Key | String | When |
|---|---|---|
| `openwin.changes.form` | The sign-up form goes live on {Jun 1}. | The open date is ahead. |
| `openwin.changes.form.now` | The sign-up form goes live, and the season shows under Open now. | The open date is today or has passed (9a's line). |
| `openwin.changes.new.auto` | New registrations are approved while a division has room, and a full division starts a waitlist. | Unchanged from 9a. |
| `openwin.changes.new.review` | New registrations wait for your review and hold a spot. A full division starts a waitlist. | Replaces 9a's review-first line (ruling 3). |

---

## 6. The checklist

Heading **Before you open registration** (the 9a heading, built and tested; the drawing's "Before families can sign up" is not
used: section 13). Each line has a tick that is a state, not a control (`aria-label` "Done" / "Not done"; the optional line's
dash reads "Optional"). A registrar reads the lines as facts and sees no button.

| Key | Title | Not done | Done | Door |
|---|---|---|---|---|
| `check.ageGroups` | Age groups | Add your age groups, each with birth years and a size | 3 divisions, each with birth years and a size *(1 division)* | Add age groups |
| `check.ageGroups.partial` | Age groups | 2 divisions still need birth years or a size *(1 division still needs)* | | Edit the division |
| `check.prices` | Prices | Set a price for each age group. Enter 0 if it is free. | $165 – $175 · early bird through Jun 30 | |
| `check.dates` | Registration dates | Set when the form opens and closes | Jun 1 – Aug 1 | Set dates |
| `check.pay` | How to pay | Tell families how to pay. They see it once a child is accepted. | The first 60 characters of the text | Add instructions |
| `check.waiver` | Waiver | Optional. Families sign up without one. | On. Families agree on the form. | |

Done-state variants for prices: one price "$165"; every price 0 "Free"; a mix "Free – $175"; the early-bird tail ("· early bird
through Jun 30") only when an early amount and the season date are both set.

- **`check.pay` appears only when some price is above $0.** On a free season the line is absent (the prices line already
  says Free, and absent beats a sentence). The waiver is the only line that can never block.
- **Foot line** (`check.foot`), only while a required line is not done; absent once all are done, when the primary button
  **Open registration** appears beside the heading:

| Missing | String |
|---|---|
| Age groups only | Add age groups to open registration. |
| Prices only | Set the prices to open registration. |
| Dates only | Set the dates to open registration. |
| How to pay only | Add how to pay to open registration. |
| Two or more | Finish {n} more steps to open registration. |

(The drawn foot sentence continued "'Open registration' appears here once they're set." That says what the absent button already
says; it is dropped, as 9a dropped its own helper line.)

---

## 7. The family's form

Public form on the club's warm face. One column, 640 px on a desk (the side column carries section 7.10).

### 7.1 Page head

| Key | String |
|---|---|
| `form.eyebrow` | {season} · {May 31 – Aug 30} |
| `form.title` | Sign up |
| `form.intro` | Sign up one child or several. Each child’s date of birth finds their division. |

### 7.2 Child block

| Key | String | Notes |
|---|---|---|
| `form.child.heading` | Child 1 / Child 2 | |
| `form.child.remove` | Remove | Shown from the second child on. `aria-label` "Remove child {n}" (`form.child.remove.aria`). No confirm: nothing is saved. |
| `form.child.first.label` | First name | The drawing has one "First and last name" field; two fields avoid guessing a name's parts (section 13). |
| `form.child.last.label` | Last name | |
| `form.child.dob.label` | Date of birth | Required, marked as required. The shared date field. |
| `form.child.dob.required` | Enter a date of birth so we can find the right division. | The "DOB required" message. Says why. |
| `form.child.division.label` | Division | **Only** on a season with no age bands (the date of birth cannot pick). A dropdown. Options: "{division} · {n} spots left" / "{division} · full, joins the waitlist". |
| `form.child.more.toggle` | Jersey number, position and notes | The drawn expander. |
| `form.child.jersey.label` | Jersey number preference | Existing. |
| `form.child.position.label` | Position preference | Existing. |
| `form.child.notes.label` | Additional notes | Existing. |
| `form.child.notes.hint` | Up to 500 characters. | |
| `form.child.err.first` | Enter a first name. | |
| `form.child.err.last` | Enter a last name. | |
| `form.addChild` | + Add another child | |
| `form.addChild.max` | You can sign up {max} children at once. Sign up again for more. | Only if the build caps the form. |

### 7.3 The fit line (shown before anyone presses Sign up)

One line under the child's date of birth, from the division the child fits.

| Key | String | When |
|---|---|---|
| `form.fit.spot` | {division} · born {2017–2018} · {7 spots left} · {$165} | A spot. One spot: "1 spot left". A division with no size: the spots part is dropped. Free: "Free" replaces the price. |
| `form.fit.early.applied` | {division} · born {2017–2018} · {7 spots left} · {$145} early bird through Jun 30 | Today is on or before the early-bird date. The full price follows in the total line only if it differs. |
| `form.fit.early.ended` | The early-bird price ({$145}) ended {Jun 30}. | A second, dim line under `form.fit.spot`. Shown only for a division that has an early amount and a date that has passed. |
| `form.fit.review` | The club reviews each sign-up. Nothing is due until {Henry} is accepted. | A review-first season, under the spot line. |
| `form.fit.waitlist` | {division} is full · {Ava} joins the waitlist, {1st} in line · {Ava} pays nothing unless a spot opens | Replaces the spot line. The drawn "(position 1)" becomes the ordinal used everywhere else. Position is the form's forecast; the confirmation shows the real one. |
| `form.fit.waitlist.review` | {division} is full · {Ava} joins the waitlist, {1st} in line · nothing to pay unless a spot opens | Same, on a review-first season (nothing about acceptance is promised). |

### 7.4 Two divisions for one age group (9b·13, never drawn)

The child fits more than one division (the same birth years twice, or years that overlap). The family picks, sees each
division's note and room, and sees a full one as full. A full division is still pickable; it then reads as the waitlist line.

| Key | String | Notes |
|---|---|---|
| `form.pick.legend` | {Henry} fits more than one division. Choose one. | A radio group; one card per division. |
| `form.pick.option.spot` | **{U10 A}** · {Tuesday nights} · {7 spots left} · {$165} | The note is the division's `Note for families`; absent when blank (no dash left behind). |
| `form.pick.option.full` | **{U10 B}** · {Thursday nights} · Full · joins the waitlist | A full division. Price is dropped (nothing to pay unless a spot opens). |
| `form.pick.empty` | Choose a division to see what happens next. | The child's fit line until a card is chosen. The total excludes this child until then. |
| `form.pick.err` | Choose a division for {Henry}. | On Sign up. |

### 7.5 No division fits (9b·4, never drawn)

The child's birth year is outside every division. The form says so plainly and shows the club's contact; nothing is registered
for that child. This is an answer, not a field error: it is a card, not red text.

| Key | String | Notes |
|---|---|---|
| `form.nofit.title` | {Henry} doesn’t fit a division this season | |
| `form.nofit.body` | No division takes children born in {2012}. {Dev League Org} can tell you what is available. | The year is the child's birth year. |
| `form.nofit.contact` | Contact {Dev League Org}: {email} · {phone} | Whichever of the two the club has published. Email is a `mailto:` link. |
| `form.nofit.contact.none` | Contact {Dev League Org} to ask what is available. | The club has published no contact. |
| `form.nofit.excluded` | Nothing is signed up for {Henry}. | Final line of the card. Recommended: the child is left out of the count and the button, and the other children can still sign up (no all-or-nothing, 9b·5). If the build blocks the whole form instead, use `form.nofit.blocked`: "Remove {Henry} or change the date of birth to continue." |

When it is the only child, the Sign up button is absent (absent beats disabled) and the card stands alone.

### 7.6 Parent or guardian

| Key | String | Notes |
|---|---|---|
| `form.guardian.heading` | Parent or guardian | Existing heading kept. |
| `form.guardian.first.label` / `.last.label` | First name / Last name | |
| `form.guardian.email.label` | Email | |
| `form.guardian.email.hint` | We’ll send the confirmation here. You’ll need this email and your reference to check your status later. | |
| `form.guardian.phone.label` | Phone | Not required; no "optional" tag (required fields carry the mark). |
| `form.guardian.err.first` / `.last` | Enter your first name. / Enter your last name. | |
| `form.guardian.err.email` | Enter your email address. | A malformed address: "Enter a valid email address." (existing). |

### 7.7 Waiver and email consent

| Key | String | Notes |
|---|---|---|
| `form.waiver.heading` | Waiver and agreement | Existing. Only when the season has a waiver. |
| `form.waiver.check` | I have read and agree to the waiver. | Drawn. The club's waiver text sits above it. |
| `form.waiver.err` | Agree to the waiver to sign up. | |
| `form.consent.check` | {Dev League Org} may email me about future seasons and club news. You can unsubscribe at any time. | Unticked by default. One line, recorded once per sign-up. |
| `form.consent.hint` | Emails about this sign-up are sent either way. | Small, under the line. Says plainly that declining costs nothing. |

### 7.8 The total line and the button

The total counts only children who will be accepted. "To pay" is the one word for what is owed (the drawn "due now" is dropped:
nothing is due until the child is accepted, and the instructions arrive with the confirmation).

| Key | String | When |
|---|---|---|
| `form.total.one` | **$165 to pay** for Henry. Payable separately to {Dev League Org}. How to pay is on the next screen and in your email. | One child accepted, price above $0. |
| `form.total.many` | **$310 to pay** for 2 children. Payable separately to {Dev League Org}. How to pay is on the next screen and in your email. | Several accepted. A dim breakdown line follows: "Henry $165 · Ava $145". |
| `form.total.mixed` | **$165 to pay** for Henry. Payable separately to {Dev League Org}. How to pay is on the next screen and in your email. | Plus the waitlisted children's dim line (below). |
| `form.total.waitlistLine` | Ava pays nothing unless a spot opens. | One dim line per waitlisted child. |
| `form.total.allWaitlist` | **Nothing to pay.** Henry and Ava pay nothing unless a spot opens. We’ll email you if one does. | Every child waitlisted. |
| `form.total.review` | **Nothing to pay yet.** The club reviews each sign-up, and you pay once a child is accepted. If all are accepted: **$310**. | Review-first; the "if all are accepted" sum omits waitlisted children. Absent when the sum is $0. |
| `form.total.free` | **Free.** There is nothing to pay. | Free season, and asks nothing about payment. |
| `form.submit.one` | Sign up | |
| `form.submit.many` | Sign up {n} children | |
| `form.submit.busy` | Signing up… | |
| `form.err.global` | Something went wrong. Please try again. | Existing. Also used when the network fails ("An unexpected error occurred" is retired: one sentence). |

### 7.9 The 12b slot

The drawn greyed "Pay now" is kept on the confirmation and status page, not on the form (the form keeps "payable separately").

| Key | String |
|---|---|
| `pay.ghost` | Pay now |
| `pay.ghost.title` | Online payment isn’t available yet. Use the instructions above. |

It is a disabled `.btn` (fades to 0.5, one global rule). **No "12b" or "coming soon" on screen.**

### 7.10 Desk side column (season facts)

| Key | String |
|---|---|
| `form.side.title` | This season |
| `form.side.dates` | {May 31 – Aug 30, 2027} · {Softball} |
| `form.side.price` | {U10 Division A} · born {2017–2018} · {$165} (one row per division; "Free" for 0) |
| `form.side.early` | Early bird: {$145} through {Jun 30} (shown when the date and at least one amount are set; the amount is part of each row where it differs) |
| `form.side.closes` | Registration closes {Aug 1}. |

---

## 8. Confirmation (the moment after Sign up)

| Key | String | Notes |
|---|---|---|
| `confirm.eyebrow` | {season} | |
| `confirm.title.signedUp` | You’re signed up | Any child accepted. |
| `confirm.title.received` | We’ve received your sign-up | No child accepted, at least one received. |
| `confirm.title.waitlist` | You’re on the waitlist | Every child waitlisted. |
| `confirm.reference` | Your reference: **7C2A91F0** (one for this sign-up) | Drawn. |
| `confirm.child.tag.accepted` | Accepted | Green. |
| `confirm.child.tag.received` | Received | Neutral. |
| `confirm.child.tag.waitlist` | Waitlist · 1st | Amber. Ordinal. |
| `confirm.child.row.label` | Division | |
| `confirm.child.row.accepted` | {U10 Division A} · {$165} | Free: "· Free". |
| `confirm.child.row.received` | {U10 Division A} · {$165} once accepted | Free: "· Free". |
| `confirm.child.row.waitlist` | {U12 Division} · nothing to pay unless a spot opens | |
| `confirm.changed` | A spot filled while you were signing up, so {Henry} joined the waitlist. | When the real outcome is worse than the form forecast. The reverse (a spot opened) needs no line. |
| `confirm.duplicate` | {Henry Kim} is already signed up for this season, so nothing changed for {Henry}. | Per-child result of a duplicate. No pronouns. |
| `confirm.pay.title` | To pay | The amount sits at the right: **$165**. |
| `confirm.pay.breakdown` | {Henry} · {$165} | One line per accepted child, shown only when there are two or more. |
| `confirm.pay.how` | How to pay: {the club's text} | The club's own words, escaped. |
| `confirm.pay.separately` | Payable separately to {Dev League Org}. | |
| `confirm.pay.ghost` | Pay now | `pay.ghost` (greyed). |
| `confirm.review.title` | Nothing to pay yet | Review-first variant, replaces the pay card. |
| `confirm.review.body` | The club will review {this sign-up}. Once {a child} is accepted, we’ll email you what to pay and how. | `{this sign-up}` / `{each child}` by count; the club's how-to-pay text is not shown until a child is accepted. |
| `confirm.free` | This season is free. There is nothing to pay. | Free variant; no pay card. |
| `confirm.waitlistOnly` | Nothing to pay unless a spot opens. We’ll email you if one does. | Every child waitlisted; no pay card. |
| `confirm.emailed` | We’ve emailed this to {grace.kim@example.ca}. Keep your reference to check your status. | Drawn. |
| `confirm.spam` | Didn’t get it? Check your spam folder, or look up your status with your reference. | |
| `confirm.statusLink` | Check your status → | |

The drawn "To pay now" is shortened to "To pay" so the form, confirmation, status page and emails use one phrase. The old
"What happens next" callout (pending and waitlisted) is retired: each child's row now says what happens.

---

## 9. Status page

Finds the whole sign-up by reference and email; works in every season status.

### 9.1 Lookup form

| Key | String | Notes |
|---|---|---|
| `status.eyebrow` | {season} | |
| `status.title.lookup` | Check your registration | |
| `status.intro` | Enter the email you signed up with and your reference. | |
| `status.email.label` | Parent or guardian email | Replaces "Guardian email address" (the form says "Parent or guardian"). |
| `status.ref.label` | Reference | Replaces "Reference code". |
| `status.ref.hint` | The 8 characters on your confirmation screen and in your email. | |
| `status.ref.placeholder` | e.g. 069806EA | Existing. |
| `status.submit` | Look up | Existing; busy "Looking up…". |
| `status.err.notFound` | We couldn’t find a sign-up with that email and reference. | |
| `status.err.notFound.help` | Check both against your confirmation email, or {contact the club}. | Link is `mailto:` when the club has one; otherwise "contact {club}". |
| `status.err.network` | Network error. Please try again. | Existing. |

### 9.2 The found view

| Key | String | Notes |
|---|---|---|
| `status.title.found` | Your registration / Your registrations | By child count. |
| `status.reference` | Reference: 7C2A91F0 | Shown once at the top when every child shares it. A per-child "Reference" row appears only for an older sign-up whose children carry different references. |
| `status.child.tag.*` | Accepted · Received · Waitlist · 1st · Declined · Withdrawn | Replaces today's "Confirmed" / "Pending review" / "Waitlisted". |
| `status.child.division` | Division | Row label; value is the division name. |
| `status.child.fee.label` | Fee | |
| `status.child.fee.toPay` | $150 to pay | Amber. |
| `status.child.fee.paid` | $150 · paid Oct 24 | |
| `status.child.fee.free` | Free | |
| `status.child.fee.received` | $150 once accepted | Received child. |
| `status.child.fee.waitlist` | Nothing to pay unless a spot opens | |
| `status.child.waitlist` | We’ll email you if a spot opens. | Sub-line on a waitlisted child. |
| `status.pay.title` | To pay | Amount at right. Absent when nothing is owed. |
| `status.pay.for` | {Ava Kim} · {Division B}. {Henry} is paid. | Names the children owed, and who is already paid. |
| `status.pay.how` | How to pay: {the club's text} | |
| `status.pay.separately` | Payable separately to {club}. | |
| `status.pay.ghost` | Pay now | `pay.ghost`. |
| `status.pay.allPaid` | Everything is paid. Thank you. | Replaces the pay card when every accepted child is paid. |
| `status.review` | Received. Nothing to pay until the club accepts. | Review-first; replaces the pay card. |

No Team row (9c) and no "Ask to withdraw a child" (9b-2) in 9b-1.

---

## 10. Emails

**One email per sign-up**, sent to the guardian, listing every child with its outcome and price. All fields are escaped, as
today. Each wears the club (band and footnote) through `familyNotice`; the footnote reason reads "{First} was signed up for
{season}" (several children: "your children were signed up for {season}"). The panel label is sentence case.

Shared blocks:

| Key | String |
|---|---|
| `mail.greeting` | Hi {guardianFirst}, |
| `mail.panel.details` | Registration details |
| `mail.panel.waitlist` | Waitlist |
| `mail.row.player` | {Henry Kim} · {U10 Division A} · {$165} |
| `mail.row.player.free` | {Henry Kim} · {U10 Division A} · Free |
| `mail.row.player.received` | {Henry Kim} · {U10 Division A} · {$165} once accepted |
| `mail.row.player.waitlist` | {Ava Kim} · {U12 Division} · {1st} on the waitlist |
| `mail.total` | **To pay: $310.** *(many accepted: one total; one child: "To pay: $165.")* |
| `mail.how` | {the club's text} |
| `mail.how.separately` | Payable separately to {Dev League Org}. |
| `mail.how.fallback` | {Dev League Org} will tell you how to pay. *(only when a legacy season has a price and no text)* |
| `mail.ref` | Reference: **7C2A91F0** |
| `mail.status` | Check your registration any time: {link to the status page}. You’ll need this reference and your email. |
| `mail.close.accepted` | We look forward to seeing {Henry} on the field. |
| `mail.pay.ghost` | *(Recommended: omit the greyed button from the email. A dead button in a mail reads as broken. Leave a comment where 12b's Pay now goes. If the owner keeps the drawn slot, the label is `pay.ghost` and nothing else.)* |

Subject pattern: `{headline} — {season}` (the existing em dash; a heading in the body is the same as the headline).

### 10.1 All accepted (one or several)

| Key | String |
|---|---|
| `mail.accepted.subject.one` | {Henry} is accepted — {season} |
| `mail.accepted.subject.many` | {n} children accepted — {season} |
| `mail.accepted.heading` | You’re signed up |
| `mail.accepted.lead.one` | {possessive(Henry Kim)} registration for **{season}** is accepted. |
| `mail.accepted.lead.many` | Your sign-up for **{season}** is accepted for {Henry and Ava}. |
| body | Registration details panel (one `mail.row.player` per child) → `mail.total` → `mail.how` + `mail.how.separately` → `mail.ref` → `mail.status` → `mail.close.accepted` |
| free season | The panel rows use `.free`; no total, no how-to-pay; the line "There is nothing to pay: this season is free." |

### 10.2 Mixed: accepted and waitlisted (or received and waitlisted)

A review-first season can produce received plus waitlisted; an automatic one accepted plus waitlisted. Accepted and received
never share a sign-up.

| Key | String |
|---|---|
| `mail.mixed.subject` | Your sign-up for {season}: {1 accepted, 1 on the waitlist} |
| `mail.mixed.subject.review` | Your sign-up for {season}: {1 received, 1 on the waitlist} |
| `mail.mixed.heading` | You’re signed up *(any accepted)* / We’ve received your sign-up *(received plus waitlist)* |
| `mail.mixed.lead` | {Henry} is accepted. {Ava} is on the waitlist for {U12 Division}, {1st} in line. *(received: "{Henry} is received and waiting for the club’s review.")* |
| body | Details panel with `.row.player`, `.row.player.waitlist` → total for **accepted only** → how to pay → `mail.waitlist.note` → reference → status → close |
| `mail.waitlist.note` | {Ava} pays nothing unless a spot opens. We’ll email you if one does. |

### 10.3 All received (review-first)

| Key | String |
|---|---|
| `mail.received.subject` | We’ve received your sign-up — {season} |
| `mail.received.heading` | We’ve received your sign-up |
| `mail.received.lead` | The club will review it and email you as each child is accepted. Nothing is due until then. |
| body | Panel with `mail.row.player.received` for each child → reference → status link. **No how-to-pay**: the club's words arrive with acceptance. |

### 10.4 All waitlisted

| Key | String |
|---|---|
| `mail.waitlist.subject` | You’re on the waitlist — {season} |
| `mail.waitlist.heading` | You’re on the waitlist |
| `mail.waitlist.lead.one` | {Henry Kim} is on the waitlist for **{U12 Division}**, {1st} in line. The division is full right now. |
| `mail.waitlist.lead.many` | {Henry and Ava} are on the waitlist for **{season}**. |
| body | Waitlist panel (one `mail.row.player.waitlist` per child) → "You pay nothing unless a spot opens. We’ll email you if one does." → reference → status |

The old line "No payment is required until your registration is approved." is retired (it contradicts "Accepted" and promised nothing
about a spot).

### 10.5 Staff approves a received registration (to the family)

Sent per approval, on the staff's action (so one email per child; the "one per sign-up" rule is for the moment of sign-up). The
button on the staff screen stays **Approve**; the family reads **accepted**. The email now states the fee and how to pay.

| Key | String |
|---|---|
| `mail.approved.subject` | {Henry} is accepted — {season} |
| `mail.approved.heading` | {Henry} is accepted |
| `mail.approved.lead` | {possessive(Henry Kim)} registration for **{season}** — {division} is accepted. |
| body | Panel: Player, Season, Division, **Price**, Reference (the price the registration signed up at) → `mail.total` + `mail.how` + `mail.how.separately` → status → close |
| free | "There is nothing to pay: this season is free." in place of the total. |

### 10.6 A spot opens: promotion from the waitlist

Carries the same fee and how-to-pay block (Q4) and the pay slot.

| Key | String |
|---|---|
| `mail.promoted.subject` | A spot opened: {Ava} is accepted — {season} |
| `mail.promoted.heading` | A spot opened for {Ava} |
| `mail.promoted.lead` | {Ava Kim} has moved off the waitlist and is accepted into **{U12 Division}**. Welcome. |
| body | Panel: Player, Season, Division, Price, Reference → `mail.total` + `mail.how` + `mail.how.separately` → status → close |

(Drawn "You're off the waitlist" heading is kept as a phrase in the lead; the headline now says the news first.)

### 10.7 Staff moves a child to the waitlist

| Key | String |
|---|---|
| `mail.staffWaitlist.subject` | {Ava} is on the waitlist — {season} |
| `mail.staffWaitlist.heading` | Added to the waitlist |
| `mail.staffWaitlist.lead` | {Ava Kim} is on the waitlist for **{U12 Division}**, {1st} in line. |
| body | Waitlist panel → "You pay nothing unless a spot opens. We’ll email you if one does." → reference → status |

### 10.8 Declined (unchanged except one word)

Heading **Registration update**; subject `Registration update — {season}`; contact line unchanged. The only change is the family
word:

| Key | String |
|---|---|
| `mail.declined.lead` | We’re sorry: {possessive(Henry Kim)} registration for **{season}** — {division} was not accepted. |

---

## 11. Staff notice (Needs attention)

One notice per sign-up, not per child. Existing event kind `house_league_registration_new` (label "House league registration").
Staff words: approved, to review, waitlist.

| Key | String | Notes |
|---|---|---|
| `notice.title.one` | New sign-up: {Henry Kim} | |
| `notice.title.two` | New sign-up: {Henry Kim} and {Ava Kim} | |
| `notice.title.many` | New sign-up: {Henry Kim} and {2} more | 3 or more children. |
| `notice.body` | {Grace Kim} · {Dev House League 2027} · {1 approved, 1 on the waitlist} | The outcomes joined with commas, only the non-zero parts: "approved", "to review", "on the waitlist". All to review: "2 to review". |
| `notice.link` | the season's Registrations screen | No link text. Clicking the notice opens it. |

---

## 12. Refusals and messages

Family-facing words say what happened and the next step; staff-facing words say what to do. "Accepted" in every family message.

| Key | Who sees it | String |
|---|---|---|
| `refuse.notOpen.title` | Family (form page) | Registration isn’t open yet |
| `refuse.notOpen.body` | Family | Registration for {season} opens {Jun 1}. *(no dates set: "This season hasn’t opened for registration.")* |
| `refuse.notOpen.api` | Family (form send, race) | Registration for this season isn’t open yet. |
| `refuse.closed.title` | Family | Registration is closed |
| `refuse.closed.body.date` | Family | Registration for {season} closed {Aug 1}. |
| `refuse.closed.body.convenor` | Family | Registration for this season has closed. |
| `refuse.closed.help` | Family | Already signed up? Check your status. Questions? Contact {club}. |
| `refuse.closed.api` | Family (race) | Registration for this season has closed. |
| `refuse.ended.body` | Family | This season is no longer taking registrations. (Existing line, kept: playing, completed, archived.) |
| `refuse.seasonFull` | Family | {season} is full. Contact {club} to ask about a place. *(Only if the build refuses once every division is full. While a full division sends a child to the waitlist, this string is unused and the form shows `form.fit.waitlist` instead.)* |
| `refuse.divisionFull.staff` | Staff (hand-add, Approve) | {Division} is full. Add to the waitlist instead. |
| `refuse.divisionFull.family` | Family (race on a single-child, no waitlist) | *Not written: a full division sends the child to the waitlist, never refuses.* |
| `refuse.duplicate.family` | Family | {Henry Kim} is already signed up for this season. Use your reference to check their status. |
| `refuse.duplicate.staff` | Staff (hand-add) | {Henry Kim} already has a registration this season. |
| `refuse.noFit.api` | Family (server) | No division takes children born in {2012}. Contact {club} to ask what is available. |
| `refuse.dob.api` | Family (server) | Enter a date of birth so we can find the right division. |
| `refuse.waiver.api` | Family (server) | Agree to the waiver to sign up. |
| `refuse.open.pay` | Staff (Open registration, server) | Add how to pay before you open registration. At least one division has a price. |
| `refuse.open.checklist` | Staff (Open registration, server) | Registration can’t open yet. Still to do: {age groups, prices and how to pay}. |
| `refuse.dates.order` | Staff | The form can’t close before it opens. |
| `refuse.division.hasRegistrations` | Staff (remove division) | This division has registrations, so it can’t be removed. |
| `refuse.division.cap` | Staff (plan limit) | Existing string from the divisions route; unchanged. |

`refuse.open.checklist` lists only the unfinished required lines, from: "age groups", "prices", "registration dates",
"how to pay", joined with commas and "and". It replaces 9a's fallback "Add at least one division before opening registration",
which 9a kept only because the checklist made it unreachable; now the server enforces all of it.

---

## 13. What changed from the drawings, and why

| Drawn | Now | Why |
|---|---|---|
| Checklist heading "Before families can sign up" | "Before you open registration" | The 9a heading is built and tested, and it names the button beneath it. One checklist, one heading. The owner may reverse this; it is one string. |
| Checklist: "Waiver and how to pay" as one optional line | Two lines: Waiver (optional), How to pay (required when a price is above $0) | The 9b·1 ruling makes how-to-pay required; one optional line would contradict it. |
| Foot line "…'Open registration' appears here once they're set." | "Set the dates to open registration." (specific to what is missing) | The second clause repeats what the absent button already says (9a made the same cut). |
| Registration row "Dates" | "Registration dates" | "Dates" sits under a header that also shows the season dates; one name per thing. |
| "Until Jun 30" / "$145 until Jun 30" (early bird) | "Through Jun 30" | The ruling gives the early price to sign-ups **on or before** the date. "Until" reads either way, and this is money. Family copy "ended Jun 30" is kept (the last day was Jun 30). |
| Early bird ended line in the form's total block | A dim line under that child's fit line | The early amount and date are per division; the line belongs to the child it describes. |
| Total "due now: Henry has a spot" | "$165 to pay for Henry" | Nothing is due until the child is accepted and the instructions arrive; "to pay" is the one phrase on every screen. |
| "To pay now" (confirmation) | "To pay" | Same reason. "Pay now" stays as the greyed button's label only. |
| "Pay now · 12b" | "Pay now" with a hover/tooltip "Online payment isn’t available yet. Use the instructions above." | "12b" is an internal stage name; a customer never sees it. |
| Greyed Pay now in the email | Recommended omitted | A dead button in a mail reads as broken. A comment where 12b's button goes is enough. |
| "(position 1)" on the form; "#1" in today's emails | "1st in line" / "Waitlist · 1st" everywhere | One ordinal; the drawn tag was already "Waitlist · 1st". |
| "Ava is in — Dev House League 2026" (subject) | "Ava is accepted — Dev House League 2026" | 9b·12: "Accepted" is the one family word; "is in" is a second. |
| "Registration approved" subject and heading (today's emails) | "{First} is accepted" | 9b·12. |
| "Registration Details", "Waitlist Status", "Waitlist Position" (panel labels) | Sentence case | House rule. |
| Status chips "Confirmed", "Pending review", "Waitlisted" (today's lookup) | Accepted, Received, Waitlist · {ord} | 9b·12 and one word per state. |
| "Reference code" (labels) vs "Reference" (confirmation) | "Reference" | One word. |
| "Guardian email address" (lookup) | "Parent or guardian email" | The form's own heading. |
| "First and last name" (one field) | "First name" and "Last name" | Avoids splitting a name by guessing; the registration stores both. A hand-off call; one field is acceptable if the build parses. |
| "Birthdays count from Sep 1…" one paragraph | Three single-idea hints | The paragraph carried four ideas and a warning rule. |
| "gap or overlap with another group is pointed out" | Gap warns; **partial** overlap warns; **identical** years do not | Two divisions with exactly the same years is the deliberate A and B pair (9b·13). Warning on it would fight the ruled design. |
| "Message: Approved while a division has room" (Registration block) | "Approved while a division has room" (staff word kept) | Staff keep Approve/Approved; only family screens say Accepted (9b·12). |
| Declined email "was not approved" | "was not accepted" | 9b·12; the only change to that email. |
| Division record had no note field | "Note for families" added | 9b·13 requires a note on each division; there is no column today (a build question the prompt raised). |
| "No division fits" and "Two divisions, family picks" | Written new (section 7.4, 7.5) | Never drawn. They are copy only: the layouts reuse the fit line and the radio cards. |

---

## 14. Checks

`npm run check:spelling` scans `app`, `components` and `lib` only, so it cannot check this file; skipped. By eye against the
enforced list: no "instalment", no "financial year", no "Approved" in any family string (the one staff use is in section 5.1 and
13, labelled staff), no clock time with "AM/PM", no "12b" in any customer string. The words enter the gate's reach when the
build writes them into components; the example amounts and names (Henry and Ava Kim, Grace Kim, Dev League Org, the e-Transfer
line) are the dev fixture's, not product copy, and take `spelling-ok` if a build copies them into a string.
