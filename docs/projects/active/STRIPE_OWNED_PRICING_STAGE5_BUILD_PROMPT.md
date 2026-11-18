# Stripe-owned pricing, Stage 5: words, help, terms (and the close, once Stage 3 is in). Build prompt

Paste this into a fresh session. Written 2026-11-18 by the Stage 4 session (Stage 4 committed `6dc9c6119`). **Stage 3 (the
club's books record Stripe's real fee) is not built and has no prompt yet.** Most of Stage 5 does not depend on it and can
run first. The parts that do depend on it are marked **after Stage 3** below. Do those, and the close, only once Stage 3
is on dev.

---

You are building **Stage 5 of Stripe-owned pricing**. The plan of record is
`docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md` ("Stage 5", and "Help articles to rewrite (found in Stage 2)"), with
its PM brief beside it. The board project is `payments` (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`), and status
lives on the board.

**This stage changes what we tell customers.** The terms, the privacy policy, the product's words and the help must
describe the model that Stages 2 and 4 built:
- Stripe charges the club for its own processing and its extras, from the club's own Stripe balance.
- FieldLogicHQ's application fee is only our margin.
- We bill nothing else.

Online payments are off in production. Nothing here reaches a customer without the owner's yes.

**What is ruled (do not reopen):**
- **Stripe-owned pricing.** R3 and rate design A (2026-11-17, top entry of `BUSINESS_DECISIONS.md`). Families see the same
  rates. Our fee is what is left after Stripe's standard Canadian cost, and it is stored per payment
  (`online_payments.application_fee_amount`, mig 498).
- **Stage 4 (2026-11-18, `6dc9c6119`).** No recovered fee and no fee invoice. The billing address before payouts is kept,
  because we need the club's province for the GST/HST inside our fee. Sales by month keeps "Fees billed back to clubs" as
  history. The `'fee'` tax-kind CHECK stays.
- **Payments terms v0.1** were owner-approved on 2026-11-17 (O1 to O3) and are not published. This stage rewrites them, so
  the result is **v0.2 and needs the owner's approval again**. The approval is his word in your session; you do not decide
  it.
- **Whether our fee is taxable** is the accountant's question D1, which is open. Don't resolve it. The terms follow
  `/accounting`'s method: tax included where it applies, by the club's billing address (plan, Stage 5 `/accounting`
  review).
- **No professional is a gate.** UAT Rep Club's old account is **not** replaced before the payout test's payout steps (on or
  after 2026-11-25; owner, "split the pass").

**What exists (2026-11-18; verify each before you rely on it):**
- **The payments terms draft:** `docs/agents/legal/drafts/PAYMENTS_TERMS.md`.
  - §4 "Our processing fee" says "out of it we pay Stripe's own processing fee".
  - §5 "Other Stripe fees we bill to your organization" describes the machinery Stage 4 removed.
  - §3, §6 ("the whole fee comes out of your balance"), §7, §10 and §12 also mention billed fees.
  - Its "Before this can be published" list (~L302) does **not** yet carry `/legal`'s Stage 2 warning: never publish §4/§5
    as they stand.
- **The published privacy policy:** `lib/legal-documents/privacy/2026-11-17.md`.
  - ~L34 is the billing address's purpose.
  - ~L48's email list names "a club's monthly invoice for its Stripe fees".
  - ~L174's Stripe row says "our invoices for Stripe fees".
  - `/legal` ruled this a **MUST-FIX in the next version before any production club sets up payouts**
    (`docs/agents/legal/STRIPE_FEE_INVOICE_RETIREMENT.md`; the "Carry-forward" table at the end of `LEGAL_INDEX.md`).
  - The payments terms' Before list item 7 (the retention row names the Payments Terms) belongs in the same version.
- **Product words** live in `lib/online-payment-words.ts`.
  - The Before window's and the Payouts card's `otherFees` (~397, ~428) already say Stripe takes its extras from the
    balance.
  - Missing, per `/legal` Stage 2:
    - Stripe's own agreement and pricing apply.
    - Stripe can change its fees.
    - A negative balance is the club's to cover, and Stripe may debit the club's bank. Promise nothing about Stripe's
      backstop.
  - The billing-address line ("FieldLogicHQ needs it for the fee it charges") stays true.
- **Help: the plan's Rewrite-5 list.** Stage 4 did every Retires-4 item and rewrote the dispute "The fees." paragraphs and
  the returned-debit notes. Line numbers drift, so re-grep by article id. Still open:
  - `tournaments.tsx`:
    - `online-payments-setup` "What it costs" (~1032)
    - `online-payments-fee` "Who pays the processing fee" (~1087-1095)
    - `online-payments-refunds` (~1230)
    - `online-payments-dispute-ends` "Lost" (~1272)
  - `house-league.tsx`:
    - `registrations-refund-card` (~1547)
    - `registrations-dispute-ends` "Lost" (~1611)
  - `org.tsx`: `settings-t-payouts` (~1699), a check only.
  - `accounting.tsx` (**after Stage 3**):
    - `payouts-tab-inside` (~848 "Processing fee returned", ~850 "Stripe fee")
    - ~112
    - ~833
  - `platform-admin.tsx`:
    - `bookkeeping-stripe-fees` (~798-817), our own bookkeeping, with `/accounting`
    - `bookkeeping-sales` (~725/786): check that the "Fees billed back to clubs" row reads as history
- **Records still describing the old model:**
  - `CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` §0d "Accounts v2" (~L554).
  - `memory/project_pricing_strategy.md:19` ("GST/HST goes on top of the payment fee").
  - `RPAA_FINTRAC_MONEY_SERVICES_STATUS.md`: its re-verify triggers lack `fees_collector` / `losses_collector`.
  - `CARD_SURCHARGE_PAYER_FEE.md`: the family fee now sits above Stripe's real cost, with our margin as the gap. That
    sharpens the "no more than the cost of acceptance" point; flag it for a lawyer's eye.
  - `PLAN_PRICING_FACTS.md`: Stage 4 replaced its riders with one sentence. Re-read it against the terms.

**First, check Stage 3.**
- Does the plan's "Stage 3" say Built, with a commit on dev? If yes, include every **after Stage 3** item.
- If not, leave every sentence about what the **club's books, the Payouts tab or the refund window's cost line** record.
  That covers tournaments ~1230's "shows in your books as Payment processing", the `accounting.tsx` items above, and
  Stage 2's "Left for Stage 3" list.
  - List them in the plan under Stage 3 as that stage's help, so its session writes them with its code.
  - Skip step 6 (the close).

**Do, in order (plan first; give the PM UX summary before any code):**
1. **The payments terms, with `/legal`.**
   - Add the Stage 2 warning to the Before list: §4/§5 are rewritten for Stripe-owned pricing, and the owner re-approves.
   - **§4:**
     - Cut "out of it we pay Stripe's own processing fee". Stripe takes its fee from the club's balance, and ours
       separately.
     - "Not refunded" now covers our margin only. Stripe also keeps its own fee on a refund.
     - A returned debit gives both fees back.
     - State the club's net in each payer mode.
     - Write the tax sentence to D1-open.
   - **§5 becomes "Stripe charges your organization directly":**
     - Stripe's agreement and pricing apply.
     - Disputes (the plan's Stage 1 probe figures; check them against Stripe's current page, and say a win does not
       return them).
     - Foreign cards and currency conversion.
     - The club's net varies.
     - A negative balance comes off the club first, and Stripe can debit its bank.
     - Stripe can change its fees.
   - **§3, §6, §7, §10 and §12:** the same change wherever they mention billed fees.
   - **Version:** bump to v0.2 with a change-log line.
   - **Approval:** show the owner the changed sections for his approval, and record it as O4 if he gives it. **Do not
     publish.** Publishing waits on the Before list's dependencies (D1, the rate-change notice, the Terms of Service
     version, the privacy version).
2. **The privacy policy's next version, with `/legal`.**
   - Draft it the way `LEGAL_INDEX.md` "Drafts the dev preview reads" sets out.
   - Fix ~L34/48/174. The billing address's data stays; its purpose changes.
   - Add the Payments Terms retention row.
   - Recommend publishing it with the payments terms (owner call b).
   - Mark the `LEGAL_INDEX` carry-forward row as drafted. Don't delete it until the version is published.
3. **Product words.**
   - Add `/legal`'s missing lines to the Before window, with `/marketing` for voice. Keep it short: the Before window is a
     decision screen, not the terms.
   - Grep `online-payment-words.ts` for any claim that our fee pays Stripe's. Have `/legal` check "covers Stripe's charge
     and FieldLogicHQ's" against the new §4.
   - Run `check:spelling` (one spelling everywhere).
4. **Help, with `/docs`**, from the list above.
   - Same rules as Stage 4: no dead anchors, and `keywords` / `searchText` / `answerText` in the same pass.
   - `bookkeeping-stripe-fees` with `/accounting`: under the new model, most card-processing fees never reach our
     statement.
5. **The record:**
   - The Facts doc, then `/strategy` runs the drift check.
   - Stage 12 §0d.
   - `memory/project_pricing_strategy.md:19`, through `/strategy`'s memory pass. It is the in-repo memory, so keep its
     index rule.
   - The RPAA triggers and the card-surcharge flag.
   - `/accounting` decides which of its topic files the new §4 makes stale.
   - The PM brief and the board line, in the same commit as the work.
6. **The close (after Stage 3 only).**
   - Write the owner walk for the whole project (Stages 2 to 5) as a checkable Artifact under the walk rules: 20 to 50
     boxes, one action per step, one purpose.
   - The walk needs the dev clubs re-created on Stripe-owned accounts. `milton-bats` and `dev-club-org` can be re-created
     at any time. UAT Rep Club only after the payout test's payout steps.
   - Record the walk in the QA ledger.
   - Don't close the project or archive the plan: the owner's word closes it. Without Stage 3, record "walk and close
     after Stage 3" on the board line instead.
7. **Reviews before hand-off:**
   - `/legal` on the whole stage.
   - `/accounting` on §4's tax sentence and the bookkeeping help.
   - `/review` if code changed (the words file counts).

**Owner calls to carry:**
- **(a) Approve payments terms v0.2**: §4, §5 and the touched sections.
- **(b) When the privacy version publishes.** Recommendation: with the payments terms, at switch-on. The published one
  over-describes, which is the safe direction while payments are off.
- **(c)** Any wording that `/legal` and `/marketing` disagree on.

**Not this stage:**
- Stage 3's code (the club's books record Stripe's fee; its prompt is still to be written).
- GST/HST Stage 5: the tax inside our fee, recorded per paid fee, and the fee statement. It builds on the final fee shape.
- Publishing the terms, and switching payments on. Both are the owner's, after the Before list's dependencies.
- The payout test (on or after 2026-11-25).

**Process (repo rules):**
- Stage explicit pathspecs only. Commit only on the owner's word.
- The board line changes in the same commit as the work.
- Online payments stay off in production. A prod read needs the owner's yes in that session.
- Other sessions edit `MANUAL_PROD_STEPS.json`, the board file, the QA ledger, `LEGAL_INDEX.md` and the snapshots at the
  same time, so commit only your hunks from them.
