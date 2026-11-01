# Plans & pricing + Stripe from our own admin — third pass: gaps and proposed updates

*Claude, 2026-10-31. Reviews the second-pass owner page and Part I of
`STAGE10_PLANS_PRICING_STAFF_REVIEW_FIRST_PASS.md`, the drawings (`.probe/s10-design/src.html`, published
https://claude.ai/artifact/MiNmwvyFX75jwmJoa2rdNm), `STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md` and the owner's 10-30 rulings,
against the code as of 2026-10-31. **Ruled 2026-10-31 (see §8): every ask as recommended.** Where a proposal reopens a 10-30 ruling, it says so and gives
the reason; the ruling stands until the owner changes it.*

**Owner, 2026-10-31: "go with all of your recommendations for now and redraw, once there i can get a better picture of
the user flow and ensure we move forward with the right strategy."** Recorded as **accepted for the redraw, not final**: every
§8 ask is drawn as recommended in the drawings' round 2 (tab 4 redrawn as five steps; new tabs 9 "One customer's billing" and
10 "Watching Stripe"; asks 11-19 pre-ticked). Two placeholder numbers were the drawing's, not the owner's: a 30-day reminder
and a 25% warning threshold. **Confirmed 2026-10-31:** the owner walked round 2 and pasted back all 19 asks unchanged, every recommended option kept; "Billing may stop" left unticked (open). Business points logged by `/strategy` in `BUSINESS_DECISIONS.md` 2026-10-31 ("How a price change reaches customers…"). The two numbers stay working defaults (not changed, not ruled).

Evidence tags: **[V]** opened by me this session · **[H]** reported by a delegated reader with a path:line I did not open
(a lead) · **[D]** read from the drawings source.

---

## 1. Verdict

The direction holds: Codex's mechanics (Part E3: per-target state, intent saved before the Stripe write, Stop that does not
claim an all-or-nothing undo) are sound, and the second pass's Stage 0 is right. **The gaps are where the 10-30 rulings and
the drawings left those mechanics behind**, and in a foundation (the billing webhook, tax, staff sign-in) that the plan
assumes is solid and is not. Eight gaps would let a customer be charged wrongly or without notice; each has a small design
answer.

## 2. Gaps that could charge a customer wrongly or without notice

### G1 · Release day: current customers can pay the new price while the pricing page still sells the old one
- **What the drawing does [D]:** the release date starts the move for current customers automatically (Stripe schedules
  fire on each renewal), while the new-customer price waits on two manual steps (ship the release, press "Switch
  checkout"). The drawing's own "Overdue · 3 days" frame says: "New customers are still paying $600.00 … Current customers
  who bill from Jan 3 are already moving to $660.00."
- **Harm:** a current customer is charged $660 while the public pricing page, help article and checkout say $600. That is
  the complaint-and-chargeback case, and it happens by default if the owner is late or away.
- **The drawing also contradicts itself:** Release-day frame 1 says checkout is "closed on purpose" between the steps;
  Overdue frame 2 says new customers are still paying $600.
- **Proposal (reopens part of the 10-30 "release date applies to current and new customers" ruling):** switch the
  **new-customer price first, on the notification date** (same release-then-button order, done on the day the owner is
  already attending to the change). The release date then concerns current customers only, and nothing manual remains on
  it. The Overdue state and its daily alert disappear. If the owner keeps one shared date: **no current-customer move may
  arm until checkout has switched** — the failure must fall toward the old price.

### G2 · People who sign up between the notice and the release
- **Ruled [D]:** "The new price applies to every bill on or after this date, for current customers and new ones." The
  send-day recheck lists a "new subscriber" for the owner "instead of emailed".
- **Gap:** a monthly customer who signs up Dec 15 at $600 got no notice and is not in the audience snapshot. Either they
  stay on $600 indefinitely (an untracked grandfathered cohort) or they are moved without notice. The drawing does not say
  which.
- **Proposal:** G1's fix removes the case (they buy at the new price). Otherwise checkout must state "this price becomes
  $X on {date}" and the buyer joins the change with that as their notice.

### G3 · An unattended job writes to live customer subscriptions
- **What the drawing does [D]:** History row "Moves scheduled for 10 customers. Dec 1, early morning · automatic". So the
  daily job both emails customers **and** arms Stripe schedules, with nobody watching.
- **Harm:** the riskiest automation in the product (live money writes, many customers, partial failure normal per E3)
  runs while the owner is asleep. A half-run leaves some customers armed and some not, discovered later.
- **Proposal:** the daily job **only sends** (notices, heads-up, confirmation). Arming is a button on the Change —
  "Schedule the 10 delivered moves" — available from the day after notices until the day before the release date, with
  per-customer results on screen. A customer is armed only if their notice was delivered. **If the button is never
  pressed, nobody pays more.** Rule for the whole program: *every failure falls toward the old price.*

### G4 · Annual customers are told a year early and never reminded
- **The drawing's own row [D]:** Riverside Association, annual — notice Dec 1, 2026, first bill at the new price
  Dec 14, 2027.
- **Gap:** a notice thirteen months before the charge is easy to forget, and nothing re-notifies before the charge.
  The Change also stays open for up to thirteen months; "Done" is drawn only as a stepper label.
- **Proposal:** a per-customer reminder a set number of days before *their* first bill at the new price (same safeguards
  as the first notice; the owner sets the number). "Done" means every target has been billed at the new price, held or
  released. Decide whether Stripe's own upcoming-renewal email stays on (a dashboard setting) or ours replaces it, so the
  customer does not get two different messages.

### G5 · A customer's own plan action can silently erase a scheduled move — or a move can erase their downgrade
- **Code [H, review A1/B28]:** an up-move releases any schedule; a down-move rewrites any schedule with no ownership check.
  Plan-ends-at-renewal (Stage 1 prompt written 2026-10-31, not built; held until this rule is written into it — owner
  sequence ruling 3, 2026-10-31) also has to release schedules first.
- **The drawing [D]:** holds out customers with a downgrade already scheduled *at draft time*; the legend says customer
  plan moves "stay as built". Nothing covers actions *after* arming.
- **Harm, both directions:** (a) a customer sets cancel-at-renewal, then presses "Keep my plan" — the price move was
  released and is not restored, so they stay on the old price and no screen says so; (b) a later move rewrites a
  customer's scheduled downgrade, and they are charged for the plan they left.
- **Proposal:** one rule for "who owns a subscription's future": any customer or staff action that meets a scheduled
  price move either carries it forward or refuses with plain words — never drops it. Watch it gains a
  **"Changed by the customer"** state. Design this **now, with Plan-ends-at-renewal Stage 1**, because that build is
  creating the schedule interactions this program will collide with.

### G6 · With one admin and no second approver, nothing catches a wrong number
- **Gap:** the verify step blocks when Stripe and the app disagree. If the release ships $6,600 and the pasted Stripe price
  is $6,600, every check passes.
- **Proposal:** the schedule confirmation shows the percentage change and each customer's before/after yearly cost, warns
  above a threshold the owner sets, and asks him to **type the new amount** to confirm. After the first real renewal at the
  new price, email the owner the actual invoice amount, so a mistake surfaces at customer one, not eleven. Stop's
  "correct them one at a time" needs a drawn **refund-the-difference** correction for applied customers.

### G7 · No sales tax exists anywhere, and the plan treats it as an invoice footnote
- **Code [V]:** no tax rates, automatic tax or tax-ID collection on any checkout or subscription. Stripe Tax is read only by
  a manual audit script [H].
- **Why it is bigger than the invoice placeholder:** if the adviser says GST/HST must be charged, **adding tax is a price
  change for every customer** and needs this same notice machinery. Every amount in notices, the pricing page and Plan &
  billing must say whether it includes tax. A notice that says "$660 a year" and a first bill of $745.80 is G1's harm
  again.
- **Proposal:** the tax decision (adviser + owner bookkeeping ladder) is a **precondition for the first customer notice and
  the first branded invoice**, not a later tab-6 detail.

### G8 · Staff sign-in has no second step, and one session can do everything
- **Code [V, by search]:** I found no two-step sign-in or "confirm it's you" check in the platform-admin auth paths.
- **Why it matters here:** the 10-30 ruling removes the second approver. The remaining control is that only the owner can
  act — which holds only if only the owner can sign in as him.
- **Proposal:** a fresh sign-in (or a second step) before any money action that touches more than one customer and before
  switching a live price; an email to the owner on every such action (he is the only admin, so an unexpected email is the
  alarm). Ask-level decision; it touches auth, so `/review` and the owner's go.

## 3. The foundation is weaker than the plan assumes — add to Stage 0

The second pass's four fixes stand (billing page shows the paid amount; old price links stay recognised; "None" versus a
failed read and the 20-subscription cap; strict log). Add:

| # | Today [V/H] | Why a price move needs it | Proposal |
|---|---|---|---|
| S5 | Subscription webhook keeps no record of events received, does not guard against events arriving out of order, and does not check live vs test [V webhook route; no `livemode`]. A payment-succeeded event sets the account active without checking order [V :795-812]. | A renewal wave produces many subscription and invoice events at once; a stale one can overwrite the new price or status. | Copy what the family-payments webhook already does [H connect-webhook :40-46,90-95]: an event log, re-read the subscription before writing, refuse the wrong mode. |
| S6 | No job compares our subscription records with Stripe [H]. | A move that applied in Stripe but not in our record (or the reverse) is invisible. | A daily **read-only** comparison; report, never repair. Watched automation — owner's explicit go, its own commit. |
| S7 | Three places decide live/test by the `sk_live_` prefix only; a restricted live key reads as test [V stripe-prices.ts:19, stripe-price-validation.ts:69, platform-stripe-fees.ts:34]. | The review recommends a restricted key for console writes (E5). Following it before this fix makes production checkout pick **test** prices. | One shared live/test decision that accepts both, before any key change. |
| S8 | The hosted Stripe portal runs on the dashboard's default settings [V billing/portal route]. The audit script expects plan switching, cancel and pause **off** [H]. | If anyone turns plan switching on in the dashboard, customers bypass every app flow, including price-move holds. | The app creates and pins its own portal configuration, so a dashboard toggle cannot change product behaviour. |
| S9 | Disputes and refunds on **subscription** charges are not handled — the account stays active and nobody is told [H]. | Price increases are the classic trigger for chargebacks. | Handle them on the subscription webhook; show on Today and the customer's Money tab. |
| S10 | Coaches Portal checkout creates a new Stripe customer on every click [V create-team-checkout :324] and grants any set trial with no prior-subscription check [V :339]. Portal trial is 0 today, so no leak yet. | Duplicate customers break "find everyone on a price". The drawn Trials tab tells staff "people who have had a subscription before do not get a second trial" [D] — false for this plan. | Reuse the customer; apply the same trial-history rule as the club checkout before the Trials tab can set a portal trial. |
| S11 | Final failed payment outcome (cancel vs "unpaid") is a dashboard setting; "unpaid" does not suspend [H]. | Decides what a failed renewal at the new price does. | Read-only "Stripe settings" panel (from the existing audit script) so drift is visible in our admin. |

## 4. Drawing fixes (inconsistencies and missing states)

- The confirm dialog "Send 11 notices? Customers are emailed straight away" contradicts the scheduled send. → "Schedule 11
  notices for Dec 1".
- Dates: tab 7 log "Oct 30 … notices sent"; tab 6 "Notified Oct 30" — both should follow the Dec 1 notice date.
- Release-day "closed on purpose" vs Overdue "still paying $600" (G1).
- **Held-out reasons are incomplete.** Drawn: Founding price chosen, downgrade scheduled, past due. Add: cancel pending at
  renewal, in a trial, has a discount or a non-standard price, free time (said in a note, not in the band), more than one
  item or a quantity above one, a Coaches Portal paid by the club, a Premium→Club move in flight, unrecognised price.
- **Missing states:** Stopped; Applied, showing the amount actually charged; Changed by the customer (G5); new arrivals
  "listed for you" and what happens to them (G2); Done (G4); the correction email; the "See who" lists.
- "Mark release live" is a self-declared tick. The console can read the amount the running app shows; make it automatic.
- Name the exposure the 10-30 ruling accepts: a monthly customer who switches to annual the day before the release locks the
  old price for a year.

## 5. Invoices (Ask 9) — two additions

- Stripe already emails its own receipts and invoices for subscriptions. Two documents with different numbers for one payment
  will contradict each other. Our document should carry Stripe's invoice number as its reference, show later refunds and credit
  notes, and Stripe's customer emails go off only once ours exists.
- Tax comes first (G7).

## 6. Other Stripe dashboard work to bring into our admin (the owner's second ask)

From the code census: what staff can only do in the Stripe dashboard today, grouped by job. **Bold** = highest value.

**One customer's billing (Billing + Super admin, reason required, logged):**
1. **Change the billing email, name, address or tax number, synced to Stripe.** Today a staff change to the owner email does
   not reach Stripe, so receipts and failed-payment emails go to the old address.
2. **Failed payment: retry now, email a "fix your card" link, see Stripe's next retry date.**
3. **Mark an invoice paid by cheque or e-transfer, void it, or write it off.** Common for Canadian clubs paying once a year.
4. **Credit note** (correct an invoice without moving money) and **account credit** (goodwill applied to the next bill) —
   separate tools from Refund.
5. One customer's discount (e.g. 20% for three months) as a real Stripe discount with an end date. Today the only lever is
   free time, which does not change what Stripe charges.
6. Move the next charge date (drawn, Ask 8); end a trial now; align the renewal to the season start.
7. End at renewal and undo, staff side (Plan-ends-at-renewal).
8. Resend a receipt or invoice — our own document.
9. Merge or clean up duplicate Stripe customers (S10).
10. Pay by invoice (net 30) for Club and Association, instead of card — a `/strategy` question first.
11. Pause billing for the off-season — a `/strategy` question; not recommended now (the audit script expects pause off and
    the app does not model it).

**The catalogue (Super admin + Product):**
12. Rename the plan in Stripe too (Stripe's product name appears on its receipts and portal).
13. Retire an old price for new sales while it stays recognised for the people still on it.
14. Create the Stripe price from the console (Ask 7) — the review recommends paste-and-verify first; with all five checks
    blocking, that is acceptable.

**Watching Stripe (read-only panels, no writes):**
15. **Webhook health:** last event per endpoint, failures, replay one missed event.
16. **Stripe settings check:** portal, retry outcome, branding, webhook event list, tax — the manual audit script as a page.
17. **Reports:** renewals this month, trials ending, failed payments, revenue by month for the accountant, Stripe fees, and our
    own payouts reconciled to the bank.
18. Sandbox rehearsal with Stripe test clocks (E4).

**Family payments (Connect):**
19. **Payout failed alert** — not handled today; a club's money can be stuck with no notice in the product.
20. Account requirements due — send the club a fresh onboarding link from support.
21. Family disputes — the club answers in Stripe today; an in-product evidence upload is later and lower value.

**Stays in the Stripe dashboard on purpose:** API keys, our own bank account and payout settings, tax registrations,
fraud rules, webhook endpoint registration, account verification, dispute evidence (at first).

## 7. Proposed order (by dependency and rework risk)

1. **Stage 0, expanded:** the four second-pass fixes + S5–S10, the tax decision (G7) and the sign-in step (G8).
2. The customer billing record on our own copy of Stripe facts (E2), with the read-only panels (15–17).
3. One-customer tools (1–8).
4. Invoices — after tax.
5. New-customer price (tab 3).
6. Current-customer price move, last, with G1–G6 designed in, and G5 designed with Plan-ends-at-renewal now.

## 8. Asks for the owner

**RULED 2026-10-31, all as recommended (drawings tab 11 paste-back, asks 1-19).** Ask 3 below: reminder kept at the drawn 30 days, ask 4: warning kept at the drawn 25%, both working defaults to confirm at build. Ask 5 is answered by the GST/HST rulings the same day (prices "plus applicable taxes", Stripe Tax); this ask sets the order (tax live before the first notice). Ask 8 ruled as the drawings' tab 9 and tab 10 first. Open: whether Billing may stop a move.

1. **G1 / G2:** new-customer price switches on the notification date (reopens part of 10-30). Recommended.
2. **G3:** moves armed by your button after the notices are delivered, never by the daily job. Recommended.
3. **G4:** a reminder before each annual customer's first new-price bill; how many days ahead.
4. **G6:** type the amount to confirm; warn above what percentage?
5. **G7:** tax is decided before the first notice or invoice.
6. **G8:** fresh sign-in or a second step before many-customer money actions, plus an email to you on each.
7. **Stage 0** grows by S5–S10.
8. Which of the §6 tools come first (recommended: 1–4, 15–17, 19).
