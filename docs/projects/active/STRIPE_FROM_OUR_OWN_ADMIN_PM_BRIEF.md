# Our own invoices, and Stripe run from our own platform admin: PM brief

**Status:** not started. Planning is owed after Plan & billing is complete and Stripe walks 1 to 9 are done. Owner direction,
2026-10-30. **2026-10-31: the Stripe walks are done** (the owner closed all of them; the Founding card and webhook-replay
walks were skipped, so the webhook checks come back as an early fix). **2026-10-31: the round-2 design asks are all ruled
(see the plan).** Building now waits only for Plan & billing to finish.

**Update 2026-10-30 (owner):** design starts after Support console Stage 4b; building waits for the Stripe walks. The
program is combined with Support console Stage 10 (Plans & pricing), and opens with a full review of how staff manage plans
and pricing, walking many real jobs to a simple path per role. For this first go there is **no second approver**: the owner
is the only admin, and every change is instead logged (who, what, when, why).

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
first, is logged with who and why (no second approver for now), emails customers ahead of time, and applies on the chosen day.

## The stages, in plain words (owner, 2026-10-31)
The full list is in the plan ("Stage list of record"). In order: **0** fix twelve weak spots in how we talk to Stripe today (including a fresh
sign-in before money actions that reach many customers); **1** safety guards so a new plan or a price cannot be added wrongly, and a promotion that
actually does what it says; **2** read-only views of a customer's billing and of Stripe's health, plus reports; **3** one-customer tools (billing
details, failed-payment help, cheque payments, credits, discounts, trial and charge-date changes, merging duplicates); **4** renaming a plan and
retiring an old price; **5** our own branded invoices for staff, with our tax number; **6** the customer's own invoice list in Plan & billing
(designed first); **7** the new price for new customers; **8** moving existing customers to the new price, last and most careful; **9** closeout:
help articles, demo check, going live on production. The program is done when all ten are done.

## Stage 0, Part 10: "sign in again" (drawn 2026-11-02; all 13 asks ruled 2026-11-02, as recommended; built, reviewed and committed 2026-11-02; walk owed)
Drawings: https://claude.ai/artifact/QJ3t9cHTLPski7xvL2uFcX (source `PLANS_PRICING_STAGE0_PART10_SIGN_IN_AGAIN_DRAWINGS.html`).
- **What staff see:** when they press the last button of a bulk change, or approve a Production price switch, and their
  password was last typed more than 10 minutes ago, the product's small question window asks for it. Once accepted, the
  change goes ahead with no second press. Each screen says so beforehand in one fixed sentence. One-customer work
  (refunds, cancels, plan changes, free time) never asks.
- **What the owner gets:** one email after each run: who did it, what happened (including a partial result), the reason,
  and a link to the audit log. If the email cannot be sent, the change still stands, the audit log says "Owner email: not
  sent", and the person who ran it is told on the screen.
- **Why it matters:** with one admin and no second approver, an open session should not be enough to change many
  customers at once or what every new customer pays. The email is the alarm when it is not you.
- **Tradeoffs called out:** Bulk changes is covered because it reaches up to 100 accounts, not because it moves money.
  A browser that saves the password fills the window in, so this stops a stolen session but not someone at an unlocked
  computer; a second sign-in factor is its own later project. Campaigns "Send now" is the next door, drawn separately.
- **Success looks like:** no bulk change or Production price switch runs on a session whose password is more than 10
  minutes old; every one produces an email or an "Owner email: not sent" row; no staff member types a password only
  to be refused.
- **Done by the owner 2026-11-03:** both settings are on in dev and production; a new invite and a password reset were tried on dev and both worked. (Original note follows.) Turn on "Secure password change" in the sign-in service on both projects. Without it, someone
  holding a copied session could set a new password and then pass the check (found in review, 2026-11-02). That setting
  covers a session more than a day old only; "Require current password when changing password" closes the rest, once a
  dev test shows invites and password resets still work with it on (2026-11-03).
- **Walk owed:** Owner QA Ledger §446 (written 2026-11-03). **Next small build:** the change log cannot be edited
  (O11, build prompt `PLANS_PRICING_STAGE0_O11_AUDIT_LOCK_BUILD_PROMPT.md`).
- **Before Club goes on sale (owner ask, 2026-11-03):** one full Stripe test ↔ live reconciliation. Compare both Stripe
  accounts and both of our databases, clean up what is old or inconsistent, and finish with a real purchase on production.
  The live dispute events (O3) are done there. What existing customers pay is not looked back on (O5, ruled no). The first
  live portal test (O6) is recommended for the day Stage 0 reaches production, and is repeated in the reconciliation.

## Priority and risk
Start the planning session at the end of the billing project. The invoice list is the natural first deliverable. The bulk
price-change tool is the highest-risk piece and comes last.

## Success looks like
- A customer can get a correct, branded invoice for any real payment without contacting us.
- Routine billing support never needs the Stripe dashboard.
- A price change can be scheduled, previewed, approved, announced and applied in our app, and tested before it goes live.

## Open for the owner
What the document is called and what it must show (tax details), who may see invoices, and which Stripe actions come first.
