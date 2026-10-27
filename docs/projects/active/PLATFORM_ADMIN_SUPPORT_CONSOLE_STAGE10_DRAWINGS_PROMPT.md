# Platform admin support console · Stage 10, Plans & pricing (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-27 while the owner was working Stage 7. **The owner picks this up when
> ready; where it sits in the order is not ruled** (the number only means "logged after S9", not "built after S9").
> **This session draws and asks. It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and
> then a Stage 10 build prompt (written last, like Stages 2 to 7). **Re-verify every lead against the code before you
> draw on it:** this prompt is a lead, not evidence, and so is any helper's summary. The census in §4 came from one
> helper; claims marked ✔ were re-checked by hand on 2026-10-27, the rest were not. The working copy is shared with other
> sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD` after it. Commit
> nothing without the owner's OK.

## 1 · What Stage 10 makes true (the owner's questions, 2026-10-27)

**Someone on the team can change what we sell, without a developer and without surprising a customer.** Four questions
the screens must answer:

1. **How easy is it to set up a new subscription model?** The owner ruled a **full plan builder OUT** (a rare event). What
   is wanted instead is a **checklist** for adding a plan, and a build check that fails when a piece of the checklist is
   missing, so a new plan cannot half-ship.
2. **How do we change a price, and what follows?** The whole workflow, in order: who is affected, what the policy is for
   existing customers (keep their price, move at renewal, move on a date), the new price made in Stripe, the customer
   notice, the pricing page and marketing words, and the timeline between them.
3. **How easily can a trial be added, changed or removed?** And on what: a plan, a promotion, one customer.
4. **Can the console see Stripe, so a missing or wrong product is caught before a customer hits it?** And may it write
   to Stripe (create a product and price) or only read?

## 2 · Push back before drawing (disagree out loud)

- **Stripe prices are fixed once made.** A "price change" is never an edit: it is a new price, then a switch, and the old
  price stays alive for everyone already on it. Draw it that way. A screen with a "price" box that edits in place would
  be a lie about Stripe and would orphan subscribers (see §4).
- **Writing to Stripe is a bigger step than reading it.** The console's key was kept at full strength in Stage 3 only
  because Stripe bundles refunds with other writes. Creating products from the console means one more thing that can
  go wrong in live mode. Draw read-and-verify first, create-from-console as an option with its cost (ask 5). Recommend
  read-and-verify plus a guided "do this in Stripe, then paste it here" until a price change has actually been done twice.
- **Do not let the console become a second source of truth for the dollar amounts.** Today the amounts live in code and
  the strategy Facts doc. Moving them into the database is a big change (about 65 files read them). Draw the option
  that leaves the amounts in code and the console showing, comparing and checking them (ask 2), and say what editing
  them in the console would cost.
- **Policy before screens.** The grandfathering, notice and timing rules are business decisions. The drawings put them
  to the owner as asks and, once ruled, `/strategy` logs them. Do not design a screen that quietly picks one.

## 3 · Standing rulings (do not reopen)

- The plan's "Owner rulings" sections and the standing rules **R1–R8**; **R7** (shown, not remembered) matters most here.
- **Plan names, prices, bands and gating have one home: `docs/agents/strategy/PLAN_PRICING_FACTS.md`** (kept matched to
  the plan config). Never restate a price as fresh copy; reconcile against the Facts doc and flag drift to `/strategy`.
  Any pricing or packaging change updates the Facts doc and the plan config in the same unit of work.
- **A full plan builder is out** (owner, 2026-10-27). A checklist plus a build guard is in.
- **Free time (Stage 4) and refunds (Stage 3) are as built.** Billing actions read the plan the club PAYS for, never
  the effective plan; do not draw a price change that touches free time.
- **Founding Season:** its dates, its dormant lock-in price and its September 30, 2027 end are decided elsewhere; draw
  how a price change treats them as an ask, never as a given.
- **One spelling everywhere** (`npm run check:spelling`), "8:00 a.m." clock, sport-neutral words.
- **Shared automation changes only on the owner's word**, in their own commit (`AGENCY_RULES.md`). Nothing here needs a
  scheduled job; if a design seems to, say so as an ask.
- Warm is the default; Dark follows the account setting. Draw both. Desktop only (Q4).

## 4 · What the code does today (census; ✔ = re-checked by hand 2026-10-27, the rest NOT)

- **Amounts, limits and trial days are in code** (the plan config). The database holds a gating switch, a small override
  (tournament limit, seat limit and trial days only) and the Stripe price slots. No dollar amount is stored anywhere
  else. About 65 files read the plan config, so most display surfaces follow a change; some copy does not (a help
  article reportedly hardcodes a price; the strategy and brand docs carry their own copies).
- ✔ **Stripe price IDs are rows pasted in by hand**, one per plan, billing cycle and environment (sandbox or live, chosen
  by the key's prefix). Nothing creates a Stripe product or price. A pasted ID goes through the approval queue and is
  checked against Stripe: hard-blocks an inactive, one-time or wrong-interval price; only warns on a wrong amount.
- ✔ **The webhook finds the plan from the price ID alone.** Swapping the ID in a slot orphans every subscriber on the old
  price. No runbook. (Nobody pays today, so nothing is broken. This is a trap the workflow exists to remove.)
- ✔ **Trial days apply at checkout only** and are withheld if the customer has had a subscription before. The length is
  changeable without a deploy through an approval request. No per-customer or per-promotion trial. Stripe ends a trial;
  there is no cron. A "trial ending" email is sent from Stripe's reminder event (not re-checked).
- ✔ **Pricing promotions recorded in Plans & pricing are read by nothing at checkout.** A "trial" promotion records and
  does nothing. No coupon or promotion code reaches checkout. Draw this honestly: either it becomes real (ask 4) or its
  screen stops looking like a control.
- **No price-change machinery for existing customers** (no price on the club, no effective date, no notice email, no
  grandfathering). The approval queue has request types for pricing, grandfathering and trial that are labels only.
- **No guard ties prices to the Facts doc** (only the online-payment fee rates are tested against it).
- ✔ `docs/agents/ops/stripe-setup-guide.md` is stale (Pro and Elite plans, settings no code reads).
- **The existing screen:** Plans & pricing (about 2,800 lines) and the Approval queue. It shows plan impact counts,
  gating, price slots, config overrides, a feature matrix with published-versus-live drift, an add-on catalogue and
  promotion tracking. Its writes are all request-then-approve. It cannot edit a price or add a plan.
- **S7's ask 1** (do the catalogue four belong in Stage 7?) resolves into this stage if the owner ruled A. Check the S7
  rulings in the plan before drawing; do not assume.

## 5 · Verify these leads first (the plan has been wrong before)

| Claim | Check against |
|---|---|
| Nothing in the app creates Stripe products or prices | Search the app, lib and scripts for create calls; the two audit scripts are read-only |
| Swapping a slot's ID orphans old subscribers | Read the webhook's price-to-plan path and what it does when the lookup is empty (does it ignore, error, or downgrade?). Say exactly what a subscriber on the old price sees |
| Sandbox and live can drift | Compare dev's sandbox rows with prod's live rows (read-only) and say how a mismatch is noticed today |
| Annual and monthly are separate slots, per plan | Confirm the slot list and whether a plan can have one cycle without the other |
| Add-ons and the Coaches Portal have their own prices | Where each price lives (the Coaches Portal bills on the club's own Stripe customer as a second subscription: do not call it shared) and whether one workflow covers them |
| The help article's price and the Facts doc agree with the plan config | Run the Facts doc's own drift checklist (bottom of the doc) and list every disagreement before drawing |
| A trial change reaches only NEW checkouts | Confirm a running trial is untouched by a config change |
| Promotions table is unread | Confirm again; look for any reader added since |

## 6 · The drawings (blocking: no code in this session at all)

One Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_DRAWINGS.html`, linked from the index's `stages/s10`. True size,
1440 wide, Warm and Dark. Every part drawn **from a capture of dev** (never from memory of the kit), **one example price
change followed all the way through** (one plan, one cycle, example numbers labelled "example"), every highlight
clickable with its reason.

- **A · The catalogue, read.** Plans & pricing as a place to SEE what is sold: each plan and cycle, its amount in code,
  its Stripe price, whether they agree, whether the environment rows agree, which clubs are on it. Anything not agreeing
  is a plain sentence with one thing to do.
- **B · A price change, end to end.** The guided workflow: choose the plan and cycle, see who is affected (counts by
  status), choose the policy for existing customers, create the new price (in Stripe, or from the console per ask 5),
  verify it, schedule or flip it, and see the notice. Each step says what it does and what cannot be undone. Draw the
  timeline as dates, not as "when it ships".
- **C · The customer notice.** What an existing customer reads, by policy (keep their price / moves at renewal / moves
  on a date): the email, the line on their billing page, the pricing page change. `/marketing` writes the words; the
  drawing shows where each lands and who sends it. A notice is customer-facing and cannot be taken back: say so in the
  window.
- **D · Trials.** Add, change and remove a trial length on a plan; what it applies to (new checkouts only); a promotion
  trial if ask 4 makes it real; a one-customer trial as the existing free-time door, not a new thing. The rule "no
  second trial" drawn in words.
- **E · The Stripe link.** What the console reads from Stripe and when (on open, like Status); the sandbox-versus-live
  comparison; what a missing price looks like before a customer finds it; the two options for creating a price (guided
  paste, or create from the console) with the cost of each.
- **F · The adding-a-plan checklist.** Not a builder: a checklist page, written in plain words, each item with its
  state: the plan config, the type, the gating row, the price slots in both environments, the Facts doc, the pricing
  page card, help content, demo, tests. Beside it, the **build check** that fails when an item is missing and the
  words it prints. This is the answer to "how easy is it to add a plan".
- **G · Promotions made honest.** Either wire promotions into checkout (a coupon or promotion code, who may make one,
  how it stacks with free time) or rename and re-skin the screen so it reads as a record, never a control. Ask 4.
- **H · When it cannot work.** A price pasted for the wrong plan; an inactive price; sandbox set and live not; a plan
  with one cycle only; a customer mid-checkout when the price flips; a customer on free time when the price changes; a
  club on the dormant Founding lock-in; a change nobody approved; a role that may read but not change (draw each role).
- **I · The threat list and test plan.** Over the design: a write to live Stripe from a browser, a customer notice sent
  to the wrong audience or twice, a price made live without a second approver, a promotion code that stacks without
  limit, an approval someone gave themselves. Run **`/review`**'s security lens over the design. State the tests.
- **K · Money rules around the price.** The pieces a person running pricing needs beside the change itself: what a
  customer is charged on an upgrade or downgrade mid-period and what they are told; what happens when a card fails (the
  reminders, how long a club keeps access) and whether there is a returning-customer offer; and a **trial-end report**
  (trials ended, converted, lapsed) read live with the same "converted" definition Stage 7 uses. Check what Stripe and
  the webhook already do before drawing; draw only what is missing or invisible today.
- **J · The boundary.** NEW / RESTYLED / UNCHANGED / LATER on one page. Nothing may imply a plan builder.
- Run **`/design`** before the hand-off, apply its fixes, and list any written-rule conflict for the owner. Run
  **`/billing`** over the policy, **`/marketing`** over the words, and **`/strategy`** for the decisions to log.

## 7 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **The policy for existing customers.** Keep their price for good; move them at their next renewal; move them on a date
   with notice. Recommend: keep until their next renewal, with the notice sent before it, because it is the least
   surprising. State the notice length as an ask, and tell the owner to check Canadian consumer and tax rules with the
   person who advises them (do not assert the law).
2. **Where the dollar amounts live.** Stay in code with the console showing and checking them (recommended), or move to
   the database and edit in the console. State the cost of the second.
3. **Who approves.** The existing request-then-approve loop for a price change, who may ask, who may approve, and whether
   a second person is required. Rulebook change if any.
4. **Promotions.** Make them real (a code or a promotion at checkout) or rename and re-skin the screen as a record.
   Recommend: decide with `/marketing` whether any promotion is planned; if none, make the screen honest and defer.
5. **Create in Stripe from the console, or guided paste.** Recommend guided paste plus verify now; create-from-console
   after a first real price change shows the paste is the pain.
6. **What a price change does to a trial, a promotion in flight, a free-time club and a Founding club.**
7. **The checklist's build check:** what it blocks (a plan missing a price slot, a Facts mismatch, a pricing card with no
   plan) and who sees the failure.
8. **Add-ons and the Coaches Portal in or out of this stage.** Recommend: in the read (A, E), out of the workflow (B) until
   the plans are done.
9. **Stale and drifting things found on the way** (the setup guide, the hardcoded help price, the drift list): fix in this
   stage or log. Report, do not decide.
10. **Anything the drawings surface** that the census missed.
11. **Money rules around the price (drawing K).** Mid-period upgrade and downgrade charges, failed-payment handling and a
    win-back offer, and the trial-end report: which are in this stage, which are only made visible, which are later.
    Recommend: make what exists visible and draw only the gaps.

The plan's Stage 10 findings carry a numbered list of twelve further things a person running pricing would want
(raised by the owner's questions, 2026-10-27). **Every one must be answered in the drawings or put to the owner as an
ask; none may be silently dropped.** End the drawings with a one-page coverage table: item, where drawn, which ask.

## 8 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what the team sees and does, what changes for customers
  (the notice is the only customer-facing thing), what the checklist protects, Warm and Dark, roles.
- Update the index (`stages/s10` state + anchor + a `log/` row), the plan's S10 row and Status, the PM brief and the
  auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it
  did not rule.
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_BUILD_PROMPT.md` in Stage 3's shape (verified
  state, scope is / is not, parts, gate, guards, verify, hand-off, do not). A migration, a public route or a new Stripe
  permission ruled in is a release item: say so. Prod already owes migrations 365, 367, 373, 380 and 389 (Stage 7 may add
  one).

## 9 · Do not

- Write or change code, schema, `proxy.ts`, hooks, env settings or any watched script. Never call Stripe with a write, send
  an email, or run a write against either database from a probe. Do not run `apply-migration-api` for a read query.
- Draw a plan builder, or a price box that edits a Stripe price in place.
- Restate a plan price anywhere except as example data labelled "example".
- Redraw what Stages 1–5 ruled, or S7's growth screens.
- Draw a screen from memory of the kit: capture it from dev first (never overwrite `tests/uat/.auth/platform-admin.json`;
  one page at a time, Warm first).
- Decide an ask for the owner, or tick a box for them.
