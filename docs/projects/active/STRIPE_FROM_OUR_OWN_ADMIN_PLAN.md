# Our own invoices, and Stripe run from our own platform admin

**Status: NOT STARTED. A planning session is owed.** Owner directed on 2026-10-30 that planning starts **after the Plan & billing
project is complete AND the Stripe end-to-end walks 1 to 9 are done**. Nothing below is designed or ruled except what the
"Owner asks" section says. Everything under "Claude's notes" is a suggestion for that session, not a decision.

## Owner asks (2026-10-30, recorded as asked)

**A. Our own invoices.**
- An invoice list inside the product, as **our own custom invoices with our own branding**.
- We take only the **facts** we need from Stripe: status, amounts, dates, real-life payments, renewal dates, and whatever else
  we decide an invoice needs. Stripe's own documents are not what the customer reads.
- It could be generated on the fly: a "generate invoice" button, working from a list of payments or months, or from a date
  range. The shape is open.
- To be taken on **at the end of the Plan & billing project** (this replaces open question C in that plan, which had left an
  in-app invoice list out of scope).

**B. A larger effort, possibly combined with A: stop navigating Stripe's dashboards by hand.**
- Build in the **platform admin** the things that update Stripe through the integration, as workflows that make sense to us.
  The Stripe dashboards hold far more than we use and are hard to navigate.
- First, understand **what in Stripe we use or plan to use** that we can send instructions to. Questions the owner raised:
  - Can we change a plan's name?
  - Can we change a plan price in our app, choose an effective date, email customers about the future change, apply it on that
    date, and start charging the new price to every affected customer, without leaving our app?
  - Can we update trial periods?
  - Can we pull the data an invoice needs?
- Plus any other things worth integrating into this project.

## What the code does today (read 2026-10-30, a census to confirm in the planning session)

The app already calls Stripe for: cancelling and updating subscriptions, **subscription schedules** (create, update, release),
reading and listing invoices (including line items, search, upcoming-invoice previews and finalize), invoice items, charges,
payment intents, refunds (create and list), **credit notes** (create and list), customers (create, update, delete), payment
methods, balance transactions, products and prices (read only), and a webhook endpoint check. Money events arrive through the
billing webhook route and the Connect webhook in `lib/stripe-connect.ts`. So most of the "read" half and part of the "write"
half exist for specific features; there is no general admin surface over them.

## Claude's notes (suggestions, not rulings)

**What Stripe's API lets us do from our own admin** (to verify against the current API in the planning session):
- Rename a product or plan name: yes. Display text only; it does not touch what customers pay.
- Change a price: **a Stripe price's amount cannot be edited.** The tool creates a new price and moves subscriptions to it.
  Doing it on a chosen date is what subscription schedules are for, and we already use them.
- Update a trial: yes, per subscription (end date, extend, end now).
- Pull invoice facts: yes, and better to **keep our own copy** (see below).
- Credits, refunds, coupons, pausing collection, cancelling at period end, resending a receipt: yes.
- Payment details: **card numbers are always entered in Stripe-hosted fields**, never in our admin.
- Stays in Stripe's dashboard: disputes evidence is possible by API but heavy; fraud rules, tax registrations, bank and payout
  settings and key management are dashboard work.

**One shared foundation for A and B: a local record of Stripe billing facts.** Invoices, charges, refunds, subscription state and
upcoming renewals written into our own tables as webhooks arrive. Our invoice list reads that, not Stripe, so it is fast, works
if Stripe is slow, and is what we brand. The platform-admin views (a customer's whole billing story on one page, failed
payments, renewals this month) read it too. This is why A and B belong in one program, with A as the first deliverable.

**Prices have to become data.** Today plan prices live in code and in the pricing facts document. A "change a price on a date"
tool needs a price book with effective dates that the app, the pricing page and Stripe all follow. That is a real change to how
the product thinks about price, and the pricing-facts rule ("one source of truth") means it must be designed once.

**The dangerous button is the bulk price change.** It touches every customer's money. It needs: a preview ("this changes N
subscriptions by $X a month"), a second admin's approval, an audit trail, a way to stop it before the date, and a rule for who
keeps the old price. It also needs customer notice before the date, sent by our own email system; check what notice
Canadian consumer rules require before choosing the lead time. Build the read-only and low-risk tools first and this one last.

**Stripe test clocks make dated changes testable.** Without them nobody can verify "applies on the 1st" without waiting. Put
them in the plan from the start; they would also help the Stripe walks.

**Other things worth folding in:**
- A "customer billing" page in the platform admin: plan, status, next charge preview, last payments, failed-payment state.
- Drift check: a daily comparison of our records with Stripe, since someone can still edit a thing by hand in the dashboard.
  It fits the existing daily health check.
- Revenue and renewals reporting from our own copy: who renews this month, trials ending, comped time ending, churn.
- Refund and credit actions with a reason, so support never opens Stripe for a routine fix.
- Family payments through Connect (club tier, Stage 12) are a different money flow. Decide whether the invoice generator also
  serves them, or whether this program covers subscription billing only.

## Questions the planning session must answer first

1. **What is the document called, and what does it have to say?** A custom branded "invoice" may need our tax registration
   number and tax lines. Do we charge GST/HST on subscriptions today? Stripe's own invoice or receipt remains the record of the
   charge; ours must not contradict it. Settle name ("invoice", "receipt", "statement") and required content with the owner's
   bookkeeping work (the GST/HST stage of the owner-bookkeeping ladder).
2. Who sees invoices: the plan owner only, as with Plan & billing, or the delegated billing person too?
3. Generated on demand for a date range, or one per payment, or both? How far back, and in what format (page, PDF)?
4. Which of the owner's Stripe actions are routine enough to build first? (Suggested order: read-only customer billing and
   invoices, then trial and credit tools, then renames, then dated price changes.)
5. Price book design and grandfathering rule.
6. Overlap with existing TODO items: Stripe price-configuration validation and the H8 price guard, and Billing and Accounting
   Coherence. Fold or keep separate.

## Dependencies

- Plan & billing Stages 3 to 5 complete.
- Stripe end-to-end walks 1 to 9 done (they prove the webhooks this program will rely on).
- Owner design sessions for every screen (house rule), including the platform-admin workflows.
- A PM brief exists beside this file; update both together.
