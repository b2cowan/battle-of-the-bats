# PM brief — GST/HST return worksheet (Stage 4b)

**Build prompt:** [GST_HST_STAGE4B_BUILD_PROMPT.md](GST_HST_STAGE4B_BUILD_PROMPT.md) · **Plan:** [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §Stage 4 · **Status:** the numbers and the view committed 2026-11-07; "Mark as filed" built and reviewed 2026-11-07, its storage on development the same day (committed `27c03ff78` 2026-11-08; owner walk §488 closed 2026-11-08); the accountant package next
**Priority:** must exist before the first GST/HST return that has sales on it. Owner-only (platform admin).

## What the owner gets
A new choice in Reports, **"GST/HST return"**. Pick a year or any dates and read the return's lines 101 to 109 in the order the CRA screen asks for them.
Each figure opens the invoices or expenses behind it. Sales come from the record of each invoice we issue (by the date it was issued, paid or not);
credits come from the expenses already entered. It uses the regular method for an annual filer.

## Why it matters
The first return will be filed from these figures. Without the worksheet the owner would add up invoices, credit notes, bad debts and expense credits by hand, and a
missed credit note or an unpaid invoice leaves the return wrong. The worksheet also shows what it cannot know, so a wrong total never looks right.

## What it does for the owner
- **"Before you file"** lists everything unresolved: receipts of $100 or more missing a GST/HST number, expenses with unknown tax, suppliers whose registration was not checked,
  every sale with no GST/HST answer (even one marked "looked at", and including a customer shared by two portals), and any voided invoice that has no credit note.
- **It never shows a zero it does not know.** Sales unreadable reads "Not available" with a reason and a Try again; an empty period reads "Nothing sold"; a period that starts before
  the sales record reads "Sales are recorded from…".
- **"Mark as filed…"** freezes a period once it has ended (the lines shown, the date you filed). It warns, never blocks, on open "Before you file" items. The
  period then reads **FILED**, with "Figures as you filed them" and a "Changed since you filed" box that says what to do with each change: a credit released
  late is claimed on a later return (it appears there on line 106 as "Credits from earlier periods", once), anything that raises the tax for the filed
  period means adjusting the filed return, and a few cases go to the accountant. Marking it again is an amended filing with a reason; the history stays.
- **The accountant package** gains three files beside the invoice file it already has (built and committed `b44a22e7a` 2026-11-08; walk §494 owed): the **worksheet** (lines 101 to 109 for the package's dates, the same figures as the screen,
  "Not available" with its reason and never a zero), the **credits** (every expense behind line 106 and whether its credit counted, is held for a supplier's number or can't be claimed, plus any credit carried from
  a return already filed, with a note when a credit is not on the return you filed or is smaller than you claimed) and, only when you marked a return as filed inside those dates, the **as-filed** record
  (every filing and revision exactly as saved, with its reason). Suppliers by name only; no address, email or buyer name. One call for the owner: the as-filed file includes any filed return inside the dates, not only an exact match.
- **Phone:** each line is a card; only "Copy lines" stays in the toolbar. **Nothing tax-related ever appears on the Overview.**

## What is built first
A small **View control** in Reports, hidden until there are two views, so Reports looks exactly as it does today until the worksheet arrives. The other drawn views (By month, Compare,
Money position, Tax year) join the same control later, when their own prerequisites exist.

## Success looks like
- The owner can produce lines 101 to 109 for any dates and trace each figure to its invoices or expenses.
- Nothing is double counted: a credit note and a bad debt reduce tax once, on line 107; a recovery adds back once, on line 104.
- A period marked as filed never changes silently.
- The accountant can recompute every line from the package alone.

## Open for the accountant, not for the build
What tax applies if CRA backdates registration and an invoice exists in the gap (likely none); how a voided invoice without a credit note is handled; which return period the 2026
stub belongs to; whether a credit note reduces line 101; a credit note recorded late but dated inside a filed period; the four-year window for a
carried credit, worked out for an annual filer.
