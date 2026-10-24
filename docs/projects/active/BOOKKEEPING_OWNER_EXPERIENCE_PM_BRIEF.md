# Owner bookkeeping: easier daily work — PM brief

**Status:** Proposal and [browser review](BOOKKEEPING_OWNER_EXPERIENCE_REVIEW.html) written 2026-10-24; the owner approved the Stage 0 direction for dates, tax, categories, receipts and first reports that day. [Implementation plan](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md). The previous bookkeeping build's [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md) remains authoritative for its completed and unfinished gates.

## Proposed experience

A sole proprietor opens a private Overview, sees recorded expenses and what needs attention, and adds a purchase through a short, plain-language form. The form asks when the expense was incurred; payment date starts as the same day, and a checkbox reveals a different payment date only when needed. An expense opens to its receipt, details and correction history. Reports show recorded expenses for a chosen period and let the owner open the purchases behind each total. We propose using the incurred date for that period and will confirm it during the owner walk. The technical source-file preview moves out of the daily path.

The first release stays honest about its expense-only data. Profit, cash balance and a full ledger arrive when income, owner movements and Stripe sources are accepted and reconciled. Club and coach accounts are visual/interaction references only; their money remains separate.

## Why it matters

The current page makes a normal CAD purchase feel like an accounting import: the owner sees the fixture CSV preview first and must work through a long form, including two amount fields for one CAD total. A recent expense is at the bottom of the page. Simplifying that daily job makes existing expense and receipt features useful without weakening their history or accountant export.

## Priority and stages

**Priority: high for the tool's usability.** Review the five-screen owner mockup and the approved date/tax direction. Select the first category labels and decide how ambiguous legacy dates appear before migration. Build the expense flow and list first, then actionable reports. Add the proprietor ledger after the Revenue workstream accepts its source contract; finish with backup, restore and accountant handoff proof.

## Customer impact and success

The authorized bookkeeping owner can record a CAD purchase once, attach or later add its receipt, find and correct it, and obtain a period report whose figures open to the underlying expenses. A USD purchase asks for conversion evidence only when needed. Exports agree with the report, and the interface makes clear which financial figures are available from recorded expenses.
