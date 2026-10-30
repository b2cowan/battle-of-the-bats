# Our own invoices, and Stripe run from our own platform admin: PM brief

**Status:** not started. Planning is owed after Plan & billing is complete and Stripe walks 1 to 9 are done. Owner direction,
2026-10-30.

## What it is
Two linked pieces. First, customers get an invoice list inside the product, with invoices we generate and brand ourselves from
the real payment facts. Second, the platform admin learns to run routine Stripe work for us (change a plan's name, schedule a
price change with an effective date and the customer emails, adjust trials, issue credits and refunds, see a customer's whole
billing story) so the team rarely opens Stripe's dashboards.

## Why it matters
- Stripe's dashboards show far more than we use, so routine tasks are slow and easy to get wrong.
- Customers should read our brand and our wording, not Stripe's.
- A planned price change today would mean many manual steps across several systems. That is the riskiest kind of work to do by hand.

## What a customer would see
An "Invoices" place on Plan & billing listing their payments, with a button to generate an invoice for a payment, a month or a
date range. No change to how they pay; card entry stays on Stripe's secure screens.

## What the team would see
A platform-admin area for billing: a customer's plan, status, next charge, last payments and failed payments on one page, with
the common actions on that page. Later, a guarded tool for dated price changes: it shows who is affected and the dollar effect
first, needs a second admin's approval, emails customers ahead of time, and applies on the chosen day.

## Priority and risk
Start the planning session at the end of the billing project. The invoice list is the natural first deliverable. The bulk
price-change tool is the highest-risk piece and comes last.

## Success looks like
- A customer can get a correct, branded invoice for any real payment without contacting us.
- Routine billing support never needs the Stripe dashboard.
- A price change can be scheduled, previewed, approved, announced and applied in our app, and tested before it goes live.

## Open for the owner
What the document is called and what it must show (tax details), who may see invoices, and which Stripe actions come first.
