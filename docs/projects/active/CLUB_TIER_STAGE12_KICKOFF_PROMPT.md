# Club Tier Stage 12: families pay online (kickoff prompt)

> **Written 2026-10-24**, the day Stage 9's sign-up and money stages (9b-1, 9b-2) were ruled. **Paste this into a new chat on
> `dev`.** This opens Stage 12. It is a **drawing round, not a build**: a short census of where money is handled by hand today,
> the stage's own plan and PM brief (the Club plan only reserves the slot), a ladder, and the end state **drawn in one
> publish**, with the asks beside the drawings. Nothing is built in this session. Other sessions share this working copy: stage
> explicit paths only and commit only your own files.
>
> **Recommended model: Opus 5.5** (payments, legal gating and four flows that must share one checkout); helpers stay on Sonnet
> as configured.
>
> ⚖ **Draw 12a and 12b together, with 12c beside them.** 12b (a house-league sign-up paid online) sits on 12a (the club connects
> its payout account; one checkout the flows share; the payment lands in the books), and 12c (a tournament team pays its entry)
> uses the same checkout. Drawing 12b alone would draw the checkout twice. The Club plan's Stage 12 already reserves this single
> "owner mockup session".
>
> ⚖ **No release dates.** The Club release ships when every stage is complete and tested. Order the ladder by dependency and
> rework risk; write no go/no-go or launch-timing reasoning.

## 1 · What Stage 12 makes true

A club's owner or treasurer connects the club's own payout account once, from the club's settings. From then on a family that
signs up for house league can pay on their phone the moment their child is accepted, by card or bank debit, seeing the
processing fee before they pay; a tournament team pays its entry or deposit when it registers. The money goes straight to the
club (FieldLogicHQ never holds it), the club nets the full fee, the receipt comes in the club's name, and the payment appears in
the club's books **with nobody typing it**, in the same place a cash payment marked by hand lands. Marking a payment received by
hand keeps working beside online payment. A refund starts from the same window a convenor already uses to end a registration.
**No live charge happens before counsel signs off.**

## 2 · The rulings that bind this stage (do not reopen)

- **Facilitated payments, decided 2026-07-28** (`FACILITATED_PAYMENTS_SCOPING_PLAN.md`, its PM brief,
  `FACILITATED_PAYMENTS_COUNSEL_BRIEF.md`, `docs/agents/strategy/BUSINESS_DECISIONS.md`): Stripe Connect **direct charges** on the
  club's own Express account; FieldLogicHQ never holds the funds; **the family pays the processing fee and the club nets the full
  fee**; **every paid org plan**, free tiers and the standalone Coaches Portal excluded; **counsel's sign-off is the launch gate**
  (building and test mode are not gated). **The rates live in `docs/agents/strategy/PLAN_PRICING_FACTS.md` and nowhere else: never
  restate them in a doc, a drawing caption or code.** A drawing that shows a fee computes it from the Facts doc and says so; the
  build reads it from `lib/plan-config.ts`. Any pricing or packaging question goes to `/strategy`; the gate goes to `/billing`.
- **Mark-paid stays.** Online collection writes the same paid record as marking it by hand; no club is forced online.
- **No household money** (owner 2026-10-19): no sibling discount, financial assistance, payment plan, installments or household
  credit. Two children = two registrations, **one payment**.
- **Stage 9's rulings, all of them** (`docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §0, §0b, §2, §6a): a family pays **when
  accepted** (an auto-approved sign-up is accepted at once); the price is **fixed on the registration at sign-up** (early bird by
  sign-up date), and the convenor can correct one price with a reason; an accepted, unpaid registration **holds its spot** and
  the convenor sees "owing · N days"; the **promotion email carries the pay spot**; one sign-up registers **several children**
  under one sign-up reference; ending a paid registration **asks each time** (refunded or kept, with a reason) and records a
  refund as money out; fees file on the Statement as **one "House league registration fees" row** with seasons under it, in the
  fiscal year received; on League Plus the season's **Money page is the book**; "Accepted" is the family's word; the Money band
  is Owed · Received (net of refunds) · Still owing.
- **Stage 9's payments contract** (`CLUB_TIER_STAGE9_DEEP_DIVE_PROMPT.md` §4) is what 9b builds so this stage drops in. Its
  **"Do NOT build in Stage 9"** list is exactly this stage's scope: Stripe onboarding, checkout, a payments table, webhooks,
  processor refunds and disputes, payouts, online-payment emails. **One writer for money**: a card payment lands in the same
  write as mark-received (the guard test holds it).
- **Tournaments, Stage 7a:** an online tournament payment goes through 7a's one fee write; 12c's wait on that decision is over
  (Club plan, Stage 7 and Stage 12 sections).
- House rules (`memory/design_decisions.md`): "Edit autosaves, create asks" (and a change that tells families is held until ✓),
  "A record reads first, edits whole", one window for the whole product, a window's foot, a rare door ends the body, one toolbar,
  a phone's secondary action is its symbol alone, money figures in one joined band, Export is one button, one loading line,
  "8:00 a.m.", the bare possessive. Absent beats disabled: a family never sees a dead Pay button.

## 3 · The slots 12b fills (already drawn and ruled)

Stage 9's round-2 drawings, https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT, show **dashed "ghost" slots** exactly where
online payment goes. Draw into them; do not move them:
- the **confirmation screen after Sign up** (one pay block per sign-up, for the accepted children);
- the **status page** (one pay block per sign-up under the children's cards);
- the **approval and waitlist-promotion emails** ("To pay" with the club's own how-to-pay text, which becomes Pay now);
- the **family record** in Families (a child's balance: "Pay link sent" / "Paid online, reference …");
- the **Money page** lines (a payment's "How": by hand today, online with a reference);
- the **end-a-registration window** (a refund of a card payment goes back to the card first);
- the **form itself keeps "payable separately"** until this stage replaces it (contract line 14).

## 4 · What this session produces

**One drawing Artifact, one first publish**, plus the plan pair:

1. **A short census, re-verified** (helpers; their summaries are leads, open the cited lines yourself): where money is marked
   by hand today (house league's fee writer, the tournament's 7a fee write and the Registration Command Center's paid and deposit
   fields, the Families "Record a payment" window, the coaches portal's dues record), what Stripe already does in the product
   (subscriptions only: the billing routes and webhook), the plan gate (`lib/plan-config.ts`, `lib/plan-features.ts`), and the
   club settings page where "Payouts" would live. Capture today's screens at 1440 and 390 on the fixtures (house league:
   `dev-league-org`, `league-owner@dev.local` / `devpass123`; a club with a tournament and accounting: `dev-club-org`,
   `owner@dev.local`). A seed's password reset signs that account out everywhere: check saved sign-ins first, never seed mid-walk.
2. **The end state drawn**, before = capture, after = drawn, NEW / RESTYLED / UNCHANGED tags, desk and phone, Warm and Dark,
   true size with a fit toggle:
   - **12a · payouts:** the club's settings row for payouts in each state (not connected, setting up, connected, needs
     attention / restricted, disconnected), who may connect (owner or treasurer, per the plan; confirm), the hand-off to Stripe's
     onboarding and back, and what every family-facing surface shows while a club is **not** connected (absent, never dead).
   - **The checkout** (one, shared): at 390 first. A house-league sign-up of two children (one accepted, one waitlisted → pays
     for one), and a tournament team's entry or deposit. Card and bank debit; the processing fee shown before paying (computed
     from the Facts doc, cited); the total; the club's name; the receipt screen and the receipt email in the club's name.
   - **12b · house league:** every ghost slot from §3 filled; the waitlist-promotion pay link; a pay link for a registration that
     has ended ("no longer payable"); a corrected price after a card payment (the difference refunded to the card or still owing).
   - **12c · tournaments:** the team's pay step at registration (entry or deposit), and the Registration Command Center's paid
     and deposit fields filled by an online payment.
   - **In the club's books:** the season Money page and the Statement with an online payment beside a cash one; the processing
     fee **never** in the club's book.
   - **A refund:** from the end-a-registration window (card first), and what the family receives.
   - **Pay by hand beside online:** the convenor's "Mark received" unchanged, on the same record.
3. **Standing back:** the rules across the flows (one checkout, one money writer, paid as its own fact, the fee never in the
   club's book, absent when not connected, counsel's gate, test mode).
4. **A ladder** to test against the drawings (the Club plan's proposal: 12a foundation → 12b house league → 12c tournaments →
   12d hardening), sized, with migrations named (payment records; the club's connected account).
5. **Asks**, each with a recommendation and one checkbox per option, beside the drawing that answers it, and a paste-back. At
   least:
   - **Who carries the processing fee on a refund** (the family-pays fee is not returned by the processor: does the club absorb
     it, does the family lose it, or does it depend on who ends the registration?).
   - **Can a family save a card** for a later payment?
   - **Bank debit takes days to clear:** what do the family and the convenor see meanwhile? (Payment stays its own fact,
     never a registration status: contract line 6.)
   - **Who may connect payouts:** owner only, or owner and treasurer?
   - **A rep team's dues paid online** through a Club org's account (open since 2026-07-28; the standalone Coaches Portal stays
     excluded).
   - **What a family sees when the club hasn't connected payouts** (the plan's lean: absent, never a dead button; confirm the
     words).
   - **A tournament deposit:** pay the deposit only, or offer the full amount at once?
   - Anything the census turns up that the rulings don't cover. Do **not** re-ask what §2 already rules.
6. **A paste-back summary.**

Also write `docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` and `CLUB_TIER_STAGE12_PAYMENTS_PM_BRIEF.md` (the Club plan
says the pair is written when the stage opens, from the scoping plan's effort model). Add one TODO line, update the Club index
row `s12` and add a news row (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`; read the row first and pin `if_version`).
Run **`/ux`** on the flows and **`/design`** on the drawings **before** the hand-off, apply their changes, and list them on the
drawing page. Run **`/billing`** on the plan gate and **`/strategy`** only if a pricing or packaging question comes up.

## 5 · Owner steps that are not code (list them; do not wait on them)

- **The counsel session** (memo ready: RPAA, FINTRAC, terms): no live charge before it. Check the records before calling it owed;
  the owner may have booked it with another session.
- **The accountant's GST/HST confirmation** (the "+ tax" display rider, 12d).
- **The insurance broker quote.**
- **A Stripe platform account in test mode** is an external sign-up: ask the owner before creating anything with Stripe.

## 6 · Do not

- Build anything, create any Stripe account or key, or charge anything.
- Restate a rate, a price or a plan inclusion. Point at `PLAN_PRICING_FACTS.md`.
- Add a "payment pending" registration status, a second fee writer, or any household money.
- Move a ghost slot Stage 9 drew; if one can't hold the checkout, bring it to the owner drawn.
- Reopen a ruling in §2, or settle an ask by drawing only one option.
- Draw navigation outside the payments surfaces (Stage 13's).
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit. Commit the plan, the PM brief and the drawing source
once the owner has seen the first publish, or sooner if the owner says so.
