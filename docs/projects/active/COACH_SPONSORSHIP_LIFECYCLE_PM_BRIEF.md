# PM Brief — Coach Sponsorship Lifecycle

**One sentence:** sponsorships grow up from "one number typed once" into a record a treasurer can
actually run a season with — every cheque dated the day it arrived, more than one family credited,
a promise that can be chased, and corrections that can no longer quietly take back money a family
already received.

## What changes for the coach/treasurer

- **Every cheque gets its day.** Recording sponsor money now asks *when it arrived*, so a July
  cheque recorded in August lands in July's books — monthly income and Budget vs. Actual stop
  lying by a month. (Today every sponsor dollar is silently dated "whenever I typed it.")
- **A sponsor can pay in pieces.** $250 now, $250 at mid-season — each arrival is recorded
  against the same sponsor with its own date and method, and a part-kept promise finally reads
  honestly: "$250 in · $250 to come."
- **More than one family can be credited** (owner-requested). Two families who land a sponsor
  together each get their share — dollars or percent per family, always previewed in dollars,
  never exceeding the sponsor's amount. Works the same from both recording doors.
- **Clicking a sponsor opens its story** — the promise, each arrival, each family's credit, and
  what's still to come — instead of today's thin screen that restates the list row.
- **Pledges can be chased.** An optional "expected by" date; once it passes, one plain sentence
  on the list and the Money overview. No emails, no nagging.
- **Corrections become safe.** Shrinking or removing a sponsor after a family's credit was
  already paid back in cash is refused with the same sentence Payables uses — today it silently
  leaves the books owing a family less than they've received. A dead delete button in the dues
  drawer stops pretending, too.
- **A mistake can be deleted** — with a confirmation that says exactly what reverses, in dollars.
- **The export tells the truth**: Received and Pledged in separate columns, so a spreadsheet
  pivot can't count a promise as raised money.
- Housekeeping the owner ruled with it: the creation modal gets a real title ("New fundraiser or
  sponsor"), the kind question reads "Which kind?", the settings sheet is named for what it is,
  and the family's credit is labelled "Sponsorship" where they see it.

## Why it matters
The treasurer is the coach portal's most detail-burdened user; sponsorship money is the one money
flow that still loses dates, histories and safety on its way to the books. This closes the last
unguarded money-correction path in the portal.

## Tradeoffs
- The single-cheque, single-family sponsor — the common case — stays visually and procedurally
  identical: one form, one step.
- We deliberately do NOT add sponsor contact/CRM fields or thank-you tracking (backlog).

## Success criteria
- A backdated cheque lands in its own month everywhere months are shown.
- A part-paid pledge shows "in / to come" on the list, record page, and overview.
- The paid-out refusal fires on every correcting door (edit, flip, delete) before anything writes.
- Two credited families see the right dollars on their dues, and season settlement still pays out
  of received money only.

## QA / navigation
Money → Fundraising: create a sponsor (pledged with an expected-by; received with a date), record
a second arrival from its record page and from the hub Record button, split a credit across two
families, correct an amount after paying out a credit (expect the refusal), delete one (expect the
dollar-named confirmation), export and check the two columns. Owner QA ledger § assigned at build
completion.
