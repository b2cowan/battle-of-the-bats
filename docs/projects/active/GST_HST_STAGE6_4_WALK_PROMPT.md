# GST/HST 6.4 walk — write the checkable walk, publish it, then wait for the owner's paste-back

> Written 2026-11-13 by the Part B close session. Run as ONE fresh session on `dev`. Parts A and B are COMMITTED
> (Part A `8bb8ac32f`, Part B `4a0444c03`). Plan of record: [GST_HST_STAGE6_4_BUILD_PROMPT.md](GST_HST_STAGE6_4_BUILD_PROMPT.md)
> §8, and its **Progress** block (read the Part A and Part B entries first: what was built, the test-mode answers, the hand-over notes).
> **This session builds a WALK, not product.** No product code changes unless the walk finds a defect and the owner says to fix it.
> **Do not re-raise the calls settled in [GST_HST_STAGE6_4_PART_B_CLOSE_PROMPT.md](GST_HST_STAGE6_4_PART_B_CLOSE_PROMPT.md) §5**
> (editable reminder template, Québec accounts renewing at GST only, Terms 0.3, the unused `team_workspaces.renewal_reminded_for`,
> Part A's six calls). They are owner calls carried forward; a walk step may *show* one, it does not reopen it.

## 0. Rules for the walk (the repo's, read them)
- **A checkable Artifact, paste-back, ONE purpose** (memory: QA walks = checkable Artifacts; one purpose per walk). The purpose here:
  *the three deliverables of 6.4 on dev in Stripe test mode with Canadian test cards* — (1) the purchase email, (2) the yearly
  reminder, (3) no purchase from a Québec billing address. Nothing else rides along.
- Number it in the Owner QA Ledger (`docs/projects/active/OWNER_QA_LEDGER.md`): never re-sort existing §numbers; take the next one.
  Before rewriting any walk, grep every walk for the text you change.
- Publish with the Artifact tool (load `artifact-design` and `artifact-capabilities` first; the walk keeps its ticks with a
  capability, not browser storage). Give the owner the link and the one-line state. Record the walk in TODO.md (one line).
- Run `/design` on the Artifact before hand-off (the repo's rule for every Artifact mockup) and `/uat`-style fixtures are the
  session's job to build and to list for teardown.
- Dev has every plan on sale by design; test cards: `4000 0012 4000 0000` (Canada). Stripe is in TEST mode; dev webhooks fire into
  dev (a trial or an extra subscription made here is real to dev's rows: list every one for teardown).

## 1. The cases (each one a numbered, tick-able step with what to click, what to expect, what to paste back)
1. **A first purchase** — a new owner buys a paid plan; the purchase email ("The details of your purchase") arrives once per
   owner; figures: price before tax, taxes by name, total; the invoice number row; the Terms line (see 12).
2. **A League 30-day trial** — and **answer build prompt §6's open question here**: does a trialing subscription's invoice preview
   carry tax lines? Read the preview for the trialing subscription (Stripe test mode, or the reminder's own Stripe read), paste the
   answer back, and write it into the build prompt's Progress block. (The code is safe either way: it drops only the estimate
   sentence when the preview carries no tax.)
3. **An upgrade** (move up, prorated) — purchase email for the proration invoice.
4. **Premium → Club in place** — the typed club address in the window; the email after.
5. **A comeback** (a returning account) — the Welcome back folded into the purchase email.
6. **A next-season choice** — the yearly choice and, later, its reminder (case 8).
7. **A two-owner club** — both owners get the purchase email; the reminder goes to both.
8. **The reminder** — a fixture yearly subscription whose period end is set inside the 30–37-day window (a Stripe test clock, or a
   yearly subscription with a trial end ~33 days out; verify what Stripe allows and say which you used). Run the daily job's
   `renewal_reminders` step (the daily route `app/api/platform-admin/stripe-fees-daily/route.ts`; check how it is triggered in dev
   and by what credential — do not paste secrets into the walk). Expect: one email per owner, the plan's own price before tax, its
   tax lines, the total, the date, the cancel sentence; **run it a second time the same day and expect nothing** (once per charge
   date). Include **a club with a queued fee item** on the subscription and expect the reminder to ignore it (the price is the
   plan's only). Also: a subscription with a cancel set in Stripe sends nothing; a monthly plan sends nothing.
9. **Each Québec door** — a buyer with a Québec billing address is refused at every purchase door with the stable answer
   (409 `billing_region_closed`) and nothing is saved: a new plan or trial, coach Premium, a move up and its preview, Premium →
   Club (the window keeps the address fields so the buyer can correct the province — a review fix in Part B), a next-season
   choice. **And Stripe Checkout's own page:** confirm it offers no address field that changes the customer (Part B read 40 of 40
   recent sessions: none; look at the page itself).
10. **The stored-Québec club** — an account that already has Québec on file: its move DOWN, cancel, payouts, fee invoices and
    saving the address all still work (untouched by the gate); a move UP is refused.
11. **Premium → Club typed Québec address** — refused before any quote is shown.
12. **The Terms line** — in preview (legal pages switch on in preview) vs off: the line appears in the email only when the switch
    is on, and is absent with it off.
13. **Teardown** — listed at the END of the walk: every fixture subscription, test clock, org, user and email-queue row made, how
    to remove each, and a final "put everything back" tick row (as the §506 walk did).

## 2. Finish
- Publish, give the owner the link, and update: the build prompt's Progress ("6.4 walk PUBLISHED, ledger §N"), TODO.md (one line,
  positive fact with the hash), the Claude memory file `project_gst_hst_collection.md` and its line in that folder's `MEMORY.md`.
- When the owner pastes results back: fix nothing silently — each failed step is a finding for the owner; then **6.6** reviews
  (6.5 can run any time). The migration-478 prod step and the other prod steps stay in MANUAL_PROD_STEPS; the walk does not apply
  anything to production.
