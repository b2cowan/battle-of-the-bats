# Owner bookkeeping: easier daily work — PM brief

**Owner hold (2026-10-30):** Stage 1 Parts 1–2 are committed and checked: foundations `cbdd5ccde`, lettering guard `bf8ba972c`, restore mapping `86fd8c5e2`, and shared form/USD evidence `974fc7208`. The owner asked to stop before Part 3 until he is ready. On resume, the next deliverable is the dense Expenses table, its toolbar and attention filter, and amount search that agrees with exports. The [plan §13](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md#13-stage-1-execution-2026-10-30) records the exact resume checklist and evidence. The full six-stage scope remains the owner's [ruled hub](https://claude.ai/artifact/6zJfxoAFpi9uZKqYDUfnNx) and plan §3/§12.

**Part 1 experience:** Bookkeeping has the console's shorter heading, four linked tabs, an Add button on their right (a + in the phone heading), readable console lettering and familiar dates. A purchase opens in the standard record window and has a shareable address. Access stays private to the allowlisted owner. Reload and Back preserve the view or record at both phone and desktop widths. Part 2 adds the completed shared form; the dense table is the next deliverable in Part 3.

**Part 2 committed and checked (2026-10-30, `974fc7208`):** Adding and correcting a purchase now use the standard window, with Save always visible. The common CAD fields are compact; extra details start closed and show a summary. A USD purchase asks what the receipt says and what the card charged, calculates the rate and lets the owner pick where the CAD figure came from. Earlier notes are kept, with their source choice left for the owner to confirm. The development storage update preserved every existing revision. Access stays with the same allowlisted owner. Checks passed: 69 focused tests, 53 save/receipt/correction/draft browser assertions at desktop/phone widths, plus the earlier 35 navigation checks. The backup restore's field mapping was committed separately as `86fd8c5e2`. Parts 3–6 still deliver the table/search, compact Overview, final pencil/Void/transfer interactions, duplicate/copy features, review and owner walk. Work resumes at Part 3 on the owner's word.

## The re-evaluation (owner, 2026-10-27)

**What was wrong:** an ordinary purchase needed 732px of scrolling on a phone just to reach Save. Most of that was page headings, not fields. Voiding opened the entire correction form. The Ledger was a plain list with no account, no balance and no filters. Reports answered only "what did I spend in this period".

**What changes, in order:**
1. **Easy to use.** One short page heading and four tabs. Adding, correcting and viewing an expense happen in the product's standard window, with Save always on screen. Expenses becomes a scannable table with search by amount. A repeat purchase can be copied, and a likely duplicate gets a warning. Void becomes a one-question confirmation. US-dollar purchases take the receipt's amount and what the card charged, and the rate is worked out and kept. Bookkeeping takes the console's look.
2. **Real books now.** The business pays from a personal card or account. Each one gets a register of only its business purchases, ticked against its statement, and a month can be closed. A running "your money in the business" figure shows what the owner has funded. Adding a business account or card later is one step, and it then gets a full running balance.
3. **Reports that answer questions.** Month by month, period against period, money position, and a tax-year statement laid out by the self-employment form's lines (it also becomes the accountant package's first page).
4. **GST/HST capture**, in its own design session.
5. **The real books go live:** production storage and backups, the May–October backfill, and October closed.
6. **Stripe income**, once the Revenue contract is accepted and before the first live charge.

**Why it matters:** nothing that moves the business's money today is outside the tool, so the books can be complete now instead of waiting for Stripe. The everyday task, recording a purchase, stops fighting the owner.

**Success:** a purchase is recorded without scrolling on a phone; every business line on a statement is ticked; October is closed; and the tax-year statement can be handed over with its receipts.

**Earlier status (2026-10-25):** A stand-in accountant reviewed the whole build on 2026-10-25 and the owner accepted the review the same day ([review](https://claude.ai/artifact/Stn2GmaBENDZYSUwmVkhCS)). The reviewed build is committed as a baseline. Next: a short set of fixes, then the outside accountant, then the owner's decisions on the business account and where the real books live. [Browser review and live checklist](BOOKKEEPING_OWNER_EXPERIENCE_REVIEW.html) · [implementation plan](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) · [fixes build prompt](BOOKKEEPING_ACCOUNTANT_FIXES_BUILD_PROMPT.md). The previous bookkeeping build's [closure record](../archive/BOOKKEEPING_CLOSURE_RECORD.md) remains authoritative for its completed and unfinished gates.

## What the accountant review changed (owner, 2026-10-25)

- **Nothing is ever deleted.** "Permanently delete" goes away; voiding is the only way a record leaves the totals, and its history always stays. This reverses the 23 October choice to keep delete: the bookkeeping store only ever let the app add records, so the button could never have worked, and an accountant wants a record that only grows.
- **The first real close is October 2026, for expenses and the owner's own money only.** It no longer waits for Stripe income.
- **The outside accountant comes first.** Their answers decide the tax fields, including GST/HST split by type, the supplier's GST/HST number and a flag for a foreign supplier who charged tax, before last summer's purchases are backfilled.
- **The accountant package gets a printable summary as its first page,** built after the accountant answers.
- **Bank matching is split in two:** a simple tick-off against the statement of the card or account that pays expenses (before the first close), and Stripe payout matching (before the first live charge).
- **The owner walks happen once, after the fixes,** in one sitting that includes the owner ledger.
- **The Support Console's accounting review (S9) becomes two moments:** after the first close goes to the accountant, and after the first full month with live Stripe income.

**Corrected:** the owner-transfer Ledger was described as ready for the group walkthrough. It could not save a single transfer: the server refused every one. The fixes build repairs it.

**The fixes build (next):** owner transfers save; a form mistake shows beside Save and names the field; Permanently delete is removed; the unfinished Stripe preview tab is hidden; Reports gains Last month, Last quarter and Last calendar year; a purchase dated in the future gets a gentle warning.

**Raised by the review, not yet built** (each waits for the accountant and its own mockup session): a "closed through" date, the package summary page, an owner balance, copy-as-new, a duplicate warning, search by amount, the statement tick-off, and deciding where the real books live.

## Proposed experience

A sole proprietor opens a private Overview, sees recorded expenses and what needs attention, and adds a purchase through a short, plain-language form. The form asks when the expense was incurred; payment date starts as the same day, and a checkbox reveals a different payment date only when needed. An expense opens to its receipt, details and correction history. Reports show recorded expenses for a chosen period and let the owner open the purchases behind each total. The owner approved incurred dates for expense periods and a separate group for old dates whose meaning is unknown.

The expense reports stay honest about their expense-only data. Profit, cash balance and a complete reconciled ledger wait until Stripe sources and owner-movement classifications are accepted. Club and coach accounts are visual/interaction references only; their money remains separate.

**Stage 3 progress, 2026-10-24:** The Ledger draft shows recorded expenses beside owner money put in, money taken out and repayments of purchases paid personally. (Correction 2026-10-25: it could not save a transfer at review; see above.) Revenue still needs to accept real Stripe identities and payment, fee, refund and payout examples before income import and reconciliation can be built.

**Stage 4 progress, 2026-10-24:** The owner can download one Accountant package with expense history, owner-transfer history, receipts, a receipt index and a plain-language scope note. A recovery rehearsal replayed the current development expense revisions and receipts into isolated storage and cleaned up after itself. The owner still needs to choose separate backup custody; the current package does not contain bank statements or accepted Stripe income.

## Why it matters

The previous page made a normal CAD purchase feel like an accounting import: the owner saw the fixture CSV preview first and had to work through a long form, including two amount fields for one CAD total. A recent expense sat at the bottom of the page. Simplifying that daily job makes existing expense and receipt features useful without weakening their history or accountant export. The accountant review moves the project from "built" to "usable for a real close": the fixes remove the parts that could not work, and putting the accountant ahead of the tax build avoids building tax fields twice.

## Priority and stages

**Priority: high for reliable daily use and handoff.** Order (owner, 2026-10-25): the fixes → the outside accountant → the business-account and real-books decisions, then the production store and backups → the build the accountant's answers call for → one owner walk → backfill and the October close → Stripe before the first live charge. Success means October 2026 can be traced to its original records, exported, recovered from a retained copy and handed to the accountant with exceptions accounted for.

## Customer impact and success

The authorized bookkeeping owner can record a CAD purchase once, attach or later add its receipt, find and correct it, and obtain a period report whose category and supplier figures open to the underlying expenses. A USD purchase asks for conversion evidence only when needed. The worklist points to missing evidence and unknown facts. Unknown purchase tax stays distinct from a confirmed $0; no report claims a tax credit. Money the owner puts in, takes out or pays themselves back is recorded beside the expenses. CSV and receipt-package exports carry period and date/tax status, with owner comparison still to be walked.
