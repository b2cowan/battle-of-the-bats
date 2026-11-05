# GST/HST · Stage 2 Part 4: "plus applicable taxes" everywhere a price is quoted (build prompt)

> Written 2026-11-05. Parent: [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md) (read its ▶ Progress block first,
> especially the Part 3 entry: committed `12e27e094`, it already did the move windows, the plan card, the Keep window and the Keep
> email). The words and their placement are RULED: drawings [GST_HST_STAGE2_DRAWINGS.html](GST_HST_STAGE2_DRAWINGS.html)
> (published https://claude.ai/artifact/9Sw8VvzwCk4bW5ccDVc9o3), **tab 5** (the monthly-or-yearly question) and **tab 7** (every
> other price sentence), drawing asks D1–D3 ruled 2026-11-05 (D3: the monthly-or-yearly step gets words, not figures). T4 (owner
> 2026-10-31): prices are "plus applicable taxes". Recommended model: Sonnet (words-only; the one judgement call is the shared
> `PricingSection`, below).
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Everything below is [H]
> unless marked **[V 2026-11-05]**; line numbers drift.

## What this part is

Part 3 made every window that CHARGES show the tax. This part adds the three words everywhere else a price is quoted before
Stripe's own page shows the tax, so no screen or email quotes a bare price as if it were the total. Words only: no new figures, no
Stripe calls, no new behaviour. The phrase has ONE spelling and one source: `BILLING_TAX_WORDS.plusTax` (`lib/billing-tax.ts`),
re-exported as `PLAN_BILLING_WORDS.move.plusTax` (`lib/plan-billing-words.ts`, Part 3). Never type the phrase as a literal.

## Already done (do not redo) [V 2026-11-05]

Part 3: the move windows' renewal rows (`<small>` under the figure), `W.move.downHelp`, `W.move.noSubscription`,
`W.cancel.keepRenews` / `keepTrial` / `keepThenMove`, the Keep email (`lib/plan-ending-emails.ts` `kept`), and the Plan & billing
card's price line (a quiet `.plusTax` span; not on free time, a comp or a free plan).

## The list (drawing tab 7, plus tab 5) — find each, verify, change

| Where | Today | After (ruled) |
|---|---|---|
| Monthly-or-yearly question (`components/billing/PlanCycleDialog.tsx`, `W.pay`) [H] | each choice: price, then its help line | a quiet `plus applicable taxes` line under EACH price, above the help line; same on the phone stack (tab 5) |
| Founding: your choice is set (`W.founding.chosenBody`, `lib/plan-billing-words.ts` ~:270 [V]) | "$2,190 will be charged to Visa … on September 1, 2027 — your first charge…" | "$2,190 plus applicable taxes will be charged …" |
| Founding: choice buttons (`BillingBody.tsx` ~:426 [V]) | "Choose Club · yearly · $2,190 CAD / year" | buttons UNCHANGED; one quiet line under them: **"Prices are plus applicable taxes."** |
| Change plan table (`BillingBody.tsx`, the plan table) [H] | Monthly and Yearly columns | one quiet line under the table: **"Prices are plus applicable taxes."** |
| Plan panel price strip (`PlanPanelDrawer` / `PlanArticlePanel`) [H] | "$379 CAD / month" | "$379 CAD / month plus applicable taxes" (the phrase quiet, as on the plan card) |
| Coach Premium sign-up (`app/team/TeamSignupClient.tsx`, the plan step's price line) [H] | the price line | … plus applicable taxes |
| Onboarding PlanStep (`app/[orgSlug]/admin/onboarding/PlanStep.tsx`) [H] | its price | … plus applicable taxes (see `PricingSection` below) |
| Billing address window hint (`BILLING_ADDRESS_FORM_WORDS` / the window's intro, `lib/billing-location.ts` ~:93 [V]) | the intro sentence | one added sentence: **"Your next charge is taxed for this address."** (so a buyer who moves before a trial ends knows the address decides the tax) |
| Plan-ending and renewal emails (`lib/plan-ending-emails.ts` other than `kept`, `lib/email.ts`, `lib/marketing-email-defaults.ts`) [H] | each sentence that names a charge | … plus applicable taxes |
| `W.plan.fromPrice` "From $X CAD / month", `W.plan.price` uses, `W.coverage` Premium lines, `ClubUpgradeSetup.tsx` [H] | find every one a CUSTOMER reads | add the phrase where a price is quoted to a buyer; leave a price inside a button short ("Upgrade to Club · $219 / month": the screen around it carries the phrase, tab 7 footnote) |

Rules from the drawing: a **button keeps its short price**; "Prices are plus applicable taxes." is the ONE new sentence; everything
else adds the three words; no phrase on a free, comped or "Free through" price (nothing to tax); the phrase is quiet (tertiary ink)
where it rides a figure, plain prose inside a sentence. A new sentence goes into the words file next to its screen's other words.

## ⚠ The shared `PricingSection` (decide, then say which)

`components/PricingSection.tsx` [V 2026-11-05] is used by the marketing home page (`app/page.tsx`) AND by onboarding's PlanStep and
`app/pricing/ViewerAwarePlans.tsx`. The marketing pages' copy is **`/marketing`'s**, not this session's (parent prompt Part 4). So:
the product surfaces get the phrase, and the public pages do not change in this session. Recommended: a prop (or the caller's own
line under it) so onboarding shows the phrase and the marketing render is untouched until `/marketing` rules; say which you chose and
why. Do NOT write marketing copy.

## Out to other agents (route, do not write)

- **`/marketing`**: the public pages (`app/pricing`, `for-clubs`, `for-coaches`, `for-leagues`, `for-tournament-organizers`,
  `FoundingSeasonPanel`, the home page's `PricingSection`) get "plus applicable taxes" — hand it the ruled phrase and the drawing's
  tab 7 rule; it decides the copy.
- **`/strategy`**: record "Prices are plus applicable taxes" (T4) in `docs/agents/strategy/PLAN_PRICING_FACTS.md` (T4 is ruled; the
  Facts doc is the canonical home; it owes the T2 + T4 log too, per memory).
- Offer both to the owner at the end; do not run them unasked.

## Before any code (AGENCY_RULES)

1. Present this list as a plain-language PM summary (what a buyer reads differently, screen by screen) and the `PricingSection`
   choice, then go ahead: the words are ruled, nothing here is a new ask unless you find a price surface the drawing did not list
   (then bring it back as an ask with a recommendation, before changing it).
2. **Another session may be building Part 2b** in `components/admin/kit/club/PayoutsCard.tsx`, `app/api/admin/payouts/route.ts`,
   `lib/platform-stripe-fees.ts` and the Billing address window it opens. The Billing address hint above is the one shared spot:
   read the file fresh, add your sentence only, and commit around their edits. Stage explicit pathspecs; partial-commit method in
   memory for any file that carries another session's hunks (`components/billing/Billing.module.css` has one: `.waitCallout`).
3. `npm run check:spelling` must stay green (one spelling everywhere, incl. help `keywords` / `searchText` and the demos).
4. A demo sentence that quotes a price is computed from the config or it is not in the sentence (demos rule): check the demo tours
   for a price sentence that now needs the phrase.
5. Tests: update any test pinning an old sentence; add a guard (house style, reads source text) that every customer-facing price
   function in `lib/plan-billing-words.ts` that quotes a charge either includes `PLUS_TAX` or is on a short commented list of
   deliberate exceptions (button labels, free prices). Mutate-and-fail it.
6. `npm run typecheck` needs `NODE_OPTIONS=--max-old-space-size=8192`.

## Closeout

`npm run verify:changed`, typecheck; offer `/review` (standard tier: words), `/docs` only if a help article quotes a price; the
Progress block of the parent prompt (Part 4 done, hash), memory. Do not push. Ask before committing. The owner walk is NOT in this
part: Stage 2's single walk comes after Part 6 (parent Part 7).

## Out of scope

Figures (Part 3 did the windows that charge), the guard on charging calls (Part 5), the Stripe test matrix (Part 6), the public
marketing copy (`/marketing`), anything Part 2b builds.
