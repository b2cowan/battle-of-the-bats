# PM brief — GST/HST return worksheet (Stage 4b)

**Build prompt:** [GST_HST_STAGE4B_BUILD_PROMPT.md](GST_HST_STAGE4B_BUILD_PROMPT.md) · **Plan:** [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §Stage 4 · **Status:** build prompt written 2026-11-07, not built
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
- **"Mark as filed…"** freezes a period. Later changes read "Changed since you filed", and a credit released late moves to the next return.
- **The accountant package** gains the worksheet and the lists behind it.
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
stub belongs to; whether a credit note reduces line 101.
