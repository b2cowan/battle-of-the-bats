# Our own invoices, and Stripe run from our own platform admin

**Status: PLANNED, nothing built (2026-10-31).** Stripe walks 1 to 9 closed 2026-10-31; the round-2 staff drawings' 19 asks
were ruled 2026-10-31; Stage 0 no longer waits for Plan & billing Stage 5. The stages are numbered in "Stage list of record"
below. Stage 6 (customers' own invoice list) still needs its own design session. (Superseded: "planning starts after the
Plan & billing project is complete", owner 2026-10-30.) Everything under "Claude's notes" is a suggestion, not a decision.

## Stage list of record (owner, 2026-10-31)

Every piece of outstanding work in this combined program (this plan, Support console S10 and `STAGE10_PLANS_PRICING_THIRD_PASS_GAPS.md`)
has a home in one of these stages. Order is by dependency and rework risk, never by date. Item numbers (§6 …) refer to the gaps document.

0. **Stage 0 — the 12 fixes.** Fixes 1, 2, 5, 7, 8, 9, 10 built and committed `63988b38c` 2026-11-01 (build prompt Parts 1–7; migrations
   416–418 applied to dev); fixes 3 and 4 committed `ee2f55acf` 2026-11-01 (Parts 8–9); fix 6 (the daily read-only comparison, Part 11)
   committed `6d2acb568` 2026-11-01 on the owner's go (its own commit), migrations 421–422 applied to dev (dev cron job 15); fix 12 (Part 10, sign in again)
   drawn 2026-11-02, all 13 asks ruled, built, simplified and reviewed 2026-11-02, committed `1e18e9e4f`; the sign-in settings done 2026-11-03 (owner); walk §446 owed (Owner checklist O10). O5 ruled 2026-11-03 (no backfill); O3 moved into the reconciliation (R, below). O11 (the change log cannot be edited or deleted) committed `aef88a5e4` 2026-11-03: migration 429 applied to dev 2026-11-03, proved by `scripts/platform-audit-log-lock-check.sql`; prod apply pending (any time, no code depends on it). **Fix 11 (tax) is carried, not built:** it is met when the
   GST/HST plan's Stage 2 (Stripe Tax) is built; Parts 3 (our pinned portal settings) and 6 (the stored amount is the price, not a
   tax-inclusive total) were built to receive it, and Stage 0 changed nothing about tax in code (`PLANS_PRICING_STAGE0_BUILD_PROMPT.md`).
   **Owner steps that close Stage 0** (the one list, kept in the build prompt's Part 12 "Owner checklist"; the stage is not done until each is
   ticked there): simplify + review of Parts 1–7; the four dispute/refund events on the billing webhook endpoint (test, then live); dispute
   policy ruling; paid-amount backfill yes/no; first live portal open writes our settings (confirm); Part 11's daily job go; migrations to prod
   before the code; the exit walks. (1) Billing page shows what each customer actually pays; (2) old price links stay recognised;
   (3) "None" told apart from a failed read, plus the 20-subscription cap; (4) strict change log (who, what, when, why); (5) S5 webhook event log,
   ordering guard, refuse the wrong mode; (6) S6 daily read-only comparison with Stripe; (7) S7 a restricted live key reads as live everywhere;
   (8) S8 our own pinned portal settings; (9) S9 subscription disputes and refunds handled; (10) S10 one Stripe customer per buyer plus the trial-history
   rule; (11) the sales-tax decision (met by the GST/HST plan's Stripe Tax stage); (12) G8 fresh sign-in before many-customer money actions, plus an email
   to the owner. Exit check: re-run Stripe Walk 6 (recommended, not ruled). Waits on Plan & billing 4b Part 4; S5 lands before renewal Stage 1; S8 before renewal G13.
1. **Stage 1 — guards and housekeeping.** Not built. New-plan checklist enforced by the build, plus the price-agreement build check (Facts doc vs plan config,
   absorbs the H8 price guard); fix promotions so a recorded promotion is enforced at checkout (record ≠ enforce); rewrite or retire the stale
   `docs/agents/ops/stripe-setup-guide.md`. Owner ruled "Stage 0 and the checklist first". Waits on Stage 0.
2. **Stage 2 — read-only views.** Not built. One customer's billing record on our own copy of Stripe facts (drawings tab 9); webhook health and the Stripe
   settings panel (tab 10, includes the failed-payment outcome setting, S11); reports (§6 item 17: renewals this month, trials ending, failed payments,
   revenue by month, Stripe fees); replay one missed webhook event (§6 item 15). Waits on Stage 0.
3. **Stage 3 — one-customer tools** (reason required, logged). Not built. §6 items 1-9: (1) billing email, name, address, tax number synced to Stripe;
   (2) failed payment: retry now, "fix your card" link, next retry date; (3) mark an invoice paid by cheque or e-transfer, void, write off; (4) credit note and
   account credit; (5) one customer's discount with an end date; (6) move the next charge date, end a trial now, align renewal to season start; (7) End at
   renewal and its undo, staff side; (8) resend our own document; (9) merge duplicate Stripe customers. Also here: payout-failed alert for family
   payments (§6 item 19) — **owner call owed: here or Club Stage 12.** Waits on Stage 2; item 7 on renewal Stage 1.
4. **Stage 4 — catalogue.** Not built. Rename a plan in Stripe (§6 item 12); retire an old price for new sales while it stays recognised for current holders (item 13).
5. **Stage 5 — our branded invoices (staff side).** Not built. One document per payment plus a date-range statement, owner-only at first, carrying our GST/HST
   number and tax lines, Stripe's invoice reference, later refunds and credit notes; Stripe's own customer emails go off only once ours exists. Waits on tax being
   live (GST/HST Stages 2-3) and Stage 3.
6. **Stage 6 — customers' own invoice list on Plan & billing** (owner Ask A). Not designed. A planning/design session first (name, who sees it, on-demand vs
   per-payment, format, whether family payments are served), then build. Waits on Stage 5.
7. **Stage 7 — new-customer price change.** Not built. New customers switch to the new price on the notification date, and notices wait for that switch;
   "Mark release live" read automatically. Waits on tax live, Stages 0 and 2, and the marketing wording for "plus applicable taxes".
8. **Stage 8 — moving existing customers, last.** Not built. Notices, then the owner's button schedules the delivered moves (the daily job only sends);
   annual reminder; type-the-amount confirmation, size-of-change warning, first-charge email, Stop with refund-the-difference; held-out reasons and missing
   states; the program's own Stripe test-clock rehearsal; the "Approval queue becomes Changes" screen and, if S7 ask 1 = A, the S7 catalogue takeover
   (Plans & pricing, Approval queue, Templates, Export registry). Open rulings to settle here: whether Billing may stop a move; the 30-day reminder and
   25% warning (working defaults); Founding holders (drawn as held out). Waits on Stage 7, renewal Stage 1 (the G5 rule), and tax live.
9. **Stage 9 — closeout.** Not built. Help articles and `/docs` for the new staff screens and notices; demo check; the migration (price-change record) applied to
   production with the data dictionary and dev+prod snapshots refreshed; the `/accounting` review; final owner walk; confirmed on production.

R. **Stripe test ↔ live reconciliation (owner ask 2026-11-03).** Not planned yet. Owner: "at the end of this billing project we
   will have to do a full reconciliation of dev and prod in stripe. I would like to clean up anything that is old or inconsistent in
   both environments and make sure we are set up for success; I have made many changes in dev only over the past few weeks and will
   need to do this final check in prod before we go live with club." **Placed by Claude** (the owner may move it): in the cross-plan
   order, right before step 6 "Club on sale". Not one of Stages 0–9 and not a code stage at heart: a read-only comparison of the two
   Stripe accounts and our two databases first, the owner's list of what to keep, archive or fix, then the owner makes the dashboard
   changes (Stripe settings stay the owner's; Claude never changes them). Starting list, to confirm in its planning session:
   products and prices against the Facts doc (names, amounts, intervals; old ones archived); our price slots (test on dev, Production
   on prod) pointing at those prices; webhook destinations (billing + both Connect: URLs, events incl. O3's four, API version, no
   stale endpoints); the customer portal (our pinned settings, older configurations off); customer emails, retries and invoice
   settings; tax settings once GST/HST Stage 2 is built; Connect platform settings; which key each site uses and what it may do;
   coupons and promotions; walk leftovers in test mode. Ends with a live purchase on production (Stage 0's O6 test, repeated).
   A good use of Stage 2's read-only views if they exist by then; it does not wait for them.

**Done when** Stages 0–9 are complete (R is its own owner ask).
Open questions, not stages (to `/strategy`): pay by invoice (net 30) for Club and Association; pause billing for the off-season.

## Owner rulings (2026-10-30, later the same day) — these update the status above

1. **DESIGN starts after Support console Stage 4b is finished; BUILDING waits for the Stripe end-to-end walks 1 to 9.**
   (This loosens the gate in the status line for design only; building keeps it.)
2. **This program is combined with Support console Stage 10, Plans & pricing** (`PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`,
   "Stage 10 findings"). They share one foundation: prices as data with effective dates, a local record of Stripe facts,
   Stripe write access for the console, and Stripe test clocks. The owner's 2026-10-27 ruling stands: **no full plan
   builder**; adding a plan stays a code change guarded by a build-enforced checklist.
3. **The opening design session is a full review of the staff experience of managing plans and pricing**: many real use
   cases walked end to end, ending in simple, easy-to-understand paths for the Super admin and other staff roles to do
   their jobs.
4. **No second approver, for this first go.** The owner is the only admin. Anyone who can change anything does not need
   another person's approval; instead **every change is logged: who did what, when, and why** (an audit history). This
   replaces the "second admin's approval" in Claude's notes below.

## Owner rulings (2026-10-31, round 2 of the Stage 10 drawings) — all 19 asks, as recommended

Asks and reasons: `STAGE10_PLANS_PRICING_THIRD_PASS_GAPS.md` §8. Drawings: https://claude.ai/artifact/MiNmwvyFX75jwmJoa2rdNm
(round 2). Business points logged in `BUSINESS_DECISIONS.md` 2026-10-31 ("How a price change reaches customers…"). Summary:
amounts stay in code and the console only verifies them. Current customers move at their next renewal after a delivered
notice, with no proration. New customers switch on the notification date, and the notices wait for that switch. The daily job
only sends emails; the owner's button schedules the moves after delivery. Annual customers get a reminder before their first
new-price bill. A wrong number is caught by showing the size of the change, a warning above a threshold, typing the amount, a
first-charge email and a refund-the-difference path. A customer's own plan change carries the move forward or is refused, never
dropped (designed with Plans end at renewal). Tax is in place before the first notice or invoice. Many-customer money actions
need a fresh sign-in and send an email. Stage 0 grows to twelve fixes, and it comes first. The first dashboard jobs to move in
are drawings tab 9 (one customer's billing) and tab 10 (watching Stripe).
**Order:** Stage 0 (12 fixes) and the GST/HST plan's Stripe Tax stage come before the price-change workflow.
**Gate, 2026-10-31:** Stripe walks 1 to 9 are closed (Owner QA Ledger §419 ✅). Building now waits only for Plan & billing
Stages 3 to 5 (see Dependencies).
**Still open:** whether Billing may stop a move (unticked; Super admin only until ruled); the 30-day reminder and the 25%
warning are working defaults from the drawing, to confirm at build; Founding holders are drawn as held out, not ruled on
their own.

**Not ruled (suggestions from the planning chat, for the design session to settle):** the program as two tracks (customer
invoices; staff plans-and-pricing) with the UX review covering the staff track only; a preview, a waiting period and a
one-click stop before a price change applies (offered in place of a second approver); which staff role may do which job
(there is no "marketing" role today: the roles are Super admin, Billing, Support, Product, Growth, Read only); build order
(read-only customer billing and invoices, then trial and credit tools, then renames, then dated price changes last); and the
price-source decision (prices as data versus code plus the facts document), which needs `/strategy`.

## Sequence rulings (owner, 2026-10-31, all as recommended)

From the cross-plan review of this program, GST/HST, Plan & billing, Plans end at renewal and Revenue readiness. Index
(checkable): https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a (source `BILLING_TAX_PRICING_SEQUENCE_INDEX.html`).
- **(1) Portal settings live in our code.** Stage 0 S8 stands: the app creates and pins its own portal configuration
  (cancel at period end, no plan switching). Plans end at renewal's G13 check asserts on that configuration instead of the
  Dashboard default. This overrides that plan's "no configuration is created in code; fix the Dashboard setting".
- **(2) S5 lands first.** The billing-webhook event log, ordering guard and live/test check land before, or in the same
  session as, Plans end at renewal Stage 1's webhook rewrite, so that stage does not build a replay workaround S5 replaces.
- **(3) One rule for a subscription's future (G5)** is written into Plans end at renewal Stage 1 before it is built: a
  customer or staff action that meets a scheduled price move carries it forward or refuses in plain words, never drops it.
  The Plan & billing Premium→Club move obeys the same rule.
**Set 2026-10-31** (the owner asked Claude to set the order): this program's Stage 0 is OFF the "Plan & billing Stage 5" gate
(Stage 0 is back-end fixes; Stage 5 is the help rewrite, which now waits for the renewal and tax changes).

**Order across the five plans (set by Claude at the owner's request 2026-10-31; the owner may reverse it on the index):** 0 owner desk → 1 finish Plan & billing
4b Part 4 → **2 this program's Stage 0 (S5 first, then S8 — see rulings 1 and 2)** → 3 Plans end at renewal Stages 1–3 + GST/HST
Stage 1 → 4 tax live (GST/HST Stages 2–3 + Terms) → 5 ONE help pass → **5b Stripe test ↔ live reconciliation (R, owner ask 2026-11-03)** → 6 Club on sale (Coaches Portal and Tournament Plus already selling; "launch together" dropped 2026-10-31) → **7 the rest of this
program (invoices, plan and price changes)**. (The numbered stages of this program are in "Stage list of record" near the top.) Step 2 needs the Plan & billing Stage 5 gate taken off Stage 0, the one change
in this list the owner has not yet ruled.

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
subscriptions by $X a month"), ~~a second admin's approval~~ (ruled out for the first go, see Owner rulings), an audit trail (who, what, when, why), a way to stop it before the date, and a rule for who
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

- **For BUILDING:** Plan & billing Stages 3 to 5 complete, and Stripe end-to-end walks 1 to 9 done (they prove the webhooks
  this program will rely on). **The walks part is MET, 2026-10-31:** the owner closed every walk (Owner QA Ledger §419 ✅).
  Walk 4 (Founding card) and Walk 6 (webhook hardening) were skipped, not walked. So replayed and out-of-order webhook
  events are still unproven, and Stage 0 item S5 (event log, ordering, live/test check) carries that risk. *Claude's
  suggestion, not ruled:* re-run Walk 6 as Stage 0's exit check. **Plan & billing Stage 5 no longer gates Stage 0 (order set 2026-10-31); it still comes before the program's later stages (step 5 before step 7).** **For DESIGN:** only Support console Stage 4b finished (owner, 2026-10-30).
- Combined with Support console Stage 10 (Plans & pricing); keep the two records pointing at each other.
- Owner design sessions for every screen (house rule), including the platform-admin workflows.
- A PM brief exists beside this file; update both together.
