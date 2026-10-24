# Start the parallel internal-bookkeeping project

Use this prompt in a separate chat in the same workspace:

Build FieldLogicHQ's own small private bookkeeping tool. The owner accepted a custom build on 2026-10-23 and wants this project to run in parallel with Stripe/revenue readiness. Start with B0, then implement the first independent expense/receipt/reporting slice as its design becomes concrete. Do not stop after repeating the existing plan; complete authorized independent work and record actual evidence, while clearly identifying unresolved owner/advisor questions.

Read AGENTS.md and AGENCY_RULES.md first, then:

- [Custom bookkeeping plan](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PLAN.md)
- [PM brief](../archive/REVENUE_ACCOUNTING_BOOKKEEPING_PM_BRIEF.md)
- [Own progress register](../archive/BOOKKEEPING_PROGRESS.json)
- [Own review artifact](../archive/BOOKKEEPING_REVIEW.html#index)
- [Stripe/revenue project](../active/REVENUE_ACCOUNTING_READINESS_PLAN.md), especially its bookkeeping boundary and launch dependencies
- [Synthetic money examples](../active/REVENUE_ACCOUNTING_PHASE0_FIXTURES.csv)

Confirmed scope: Ontario sole proprietor; fewer than 50 historical expense receipts since May 1, 2026 and under ten new expenses monthly. Manual expense entry, attached private receipts, correction history, customizable income/expense/tax reports, CSV imports and accountant exports are the MVP. The former Wave/QuickBooks recommendation is superseded. Do not open or buy accounting SaaS as an assumed requirement.

The proposed home is the existing app's private platform-admin area; validate its actual auth, receipt storage and schema boundaries. Club admins, coaches and families must not access proprietor records. Audit existing ledger/reversal/export helpers before reuse; their current club/team assumptions need review. Consult current database dictionary/snapshots before proposing schema; follow all migration, data-dictionary and verification rules. Read the relevant local Next.js guides before code. Stay on shared dev and preserve other agents' work.

First package: current-code/reuse audit; minimal transaction/posting rules; private receipt/access and backup approach; owner-oriented expense/report screens; sample import contract agreed with the Stripe project's source model. Present the required plain-language UX summary before code. Owner performs browser/visual QA unless explicitly delegated. Follow the dev-server network/restart rules if a server is used.

B1/B2 can proceed using manual/synthetic entries while tax/provider decisions remain open. Do not assume a GST/HST effective date of May 1 or claim all earlier purchase tax. The owner has not applied for registration yet and reported no other self-employed revenue. CIBC's published personal-account restriction and the owner's proposed periodic payout interpretation remain a separate banking discussion; expense capture does not require resolving that first.

Stripe/revenue owns checkout, Connect, tax/fee/seller decisions, payment events and source exports. Bookkeeping owns the importer, expense/receipt records, reports and accountant package. Start with a versioned CSV mapping and stable source/movement identities. Do not duplicate Stripe event ingestion or charge customers from this tool. Subscription and application-fee import acceptance depends on the actual revenue/tax model; organizer gross registrations are not automatically proprietor income. Coordinate API/schema contract changes with the other stream.

Track each B-stage in BOOKKEEPING_PROGRESS.json with dated evidence only when its named work is complete. Revenue's historical 1.6–1.13 rows are linked dependency references, not a second task list. Refresh the own artifact with node scripts/build-bookkeeping-review.mjs and the parent artifact with node scripts/build-revenue-review.mjs when relevant. Update the bookkeeping TODO item and PM brief alongside significant plan changes. No deployment or public artifact upload is requested.
