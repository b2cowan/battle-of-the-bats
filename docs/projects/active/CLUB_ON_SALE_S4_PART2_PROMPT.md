# Build prompt — On-sale pages S4, Part 2: the move to League Plus

> Paste everything below the line into a new chat on `dev` (`/clear` first). Written 2026-11-21, after S4 Part 1 was
> committed (`28df8d79b`, owner "commit"). **Model: Opus** (money: a new plan move). Helpers read on Sonnet.
> Do not overlap a Plan & billing build session: check the board (`plan-billing`) and `git log` and say so in your first
> message.

---

You are building **Part 2 of S4 of the on-sale pages** for FieldLogicHQ: a paying Tournament Plus organization moves to
League Plus on the subscription it already has. Part 1 (the starts on Plan & billing) is committed as `28df8d79b`. Parts 3
(free time falls back) and 4 (the second-subscription alert, the onboarding words, the /for-tournament-organizers line) come
after this one, each in its own session.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md`.
2. **The S4 build prompt, `docs/projects/active/CLUB_ON_SALE_S4_BUILD_PROMPT.md`, in full.** Its "binding constraints",
   "Proofs", "Tests and checks", "Reviews" and "Rules" sections apply to this part unchanged. **Part 2 is its section
   "Part 2 — the move to League Plus".** Do not build Parts 3 or 4.
3. The plan, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: S4, its "S4 drawing round" (calls 35–46, all ruled) and
   the "Part 1 of 4" entry under S4 (what Part 1 built and decided). Owner asks are ruled; do not re-open one.
4. The drawing, `docs/projects/active/CLUB_ON_SALE_S4_DRAWINGS.html`, **tab 5** (desk and phone, both gate states, every
   numbered note). The move window's words there are the build target.
5. `git show 28df8d79b --stat` and the Part 1 diff of `components/billing/BillingBody.tsx`: closed rows now read "Coming
   soon" on the name and "Contact us" (a Premium coach keeps "Contact us to move").

## What the code showed (leads from the Part 1 session's census, 2026-11-21 — open each line before building on it)

- The move table has no `tournament_plus → league` row (`lib/plan-move-options.ts:6-12`); adding it adds the "Move to
  League Plus" row to Plan & billing by itself (`lib/plan-billing-profile.ts` `checkoutAndMoves`).
- The window's first sentence is `move.up` (`lib/plan-billing-words.ts` ~:365), rendered for every band move except
  Premium → Club (`components/billing/PlanMoveDialog.tsx` ~:414); League Plus's team limit is 9999, so today it would read
  "can hold up to 9999 teams". The hint is `previewHelp` (~:368).
- Past due: only a Premium owner is refused a move (`lib/plan-move.ts` ~:199, `payment_failing`, reading both the org's
  stored status and Stripe's). `tests/unit/workspace-move-money.test.ts` ~:353 requires "a past-due Tournament Plus owner is
  moved as before" — call 46 reverses it.
- Neither `/api/billing/move` nor `/api/billing/move/preview` has the `legal_pages_unpublished` refusal;
  `create-checkout` has it (~:105-111, `isStartPaidPlan`, `legalPagesMode()`, `stripeKeyIsTest`). The "census" for it is a
  single regex in `tests/unit/on-sale-doors-s2.test.ts` (~:249); the Terms census is `GATED` / `NEVER_GATED` in
  `tests/unit/legal-acceptance-gates.test.ts` (the preview is `NEVER_GATED` for the Terms by design).
- Tests that pin the move table and will need the new row: `tests/unit/club-stage1-server-guard.test.ts` ~:182 (exact
  `[from, to, want]` table), `tests/unit/plan-billing-profile.test.ts` (the sorted list of changes),
  `tests/unit/workspace-move-money.test.ts`, `tests/unit/plan-billing-actions.test.ts`, `tests/unit/plan-move-dialog-guard.test.ts`,
  `tests/unit/billing-location-checkout-guard.test.ts`.
- `/pricing`'s questions say "Tournament Plus can move up to Club or Club · Association… League Plus can't be moved to
  another plan yet" (`app/pricing/page.tsx` ~:313). The first half becomes false with this move; the second stays true
  (League Plus → Club is after launch). Fix the false half; words through `/marketing`.
- A paying Tournament Plus organization also lists League Plus as a shelf card today — Part 1 already removed it (call 35).

## Two owner calls — ask at the start, before code (the Part 1 session raised them; neither is ruled)

1. **Does call 46 refuse every Tournament Plus move up while its payment is failing (League Plus, Club and Club ·
   Association), or only League Plus?** Recommendation: every move up. The reason behind the ruling (do not add a charge to a
   failing card) applies to all three, and refusing only League Plus would make two moves on one page behave differently.
   The old "moved as before" rule existed only because a Premium portal's flip refuses an unsettled subscription.
2. (Not Part 2's to build, only to carry forward) Part 3's fall-back email — leave it for the Part 3 session.

## Build (in order)

1. `MOVES.tournament_plus.league = 'up'`. Everything else is the shipped move-up rule (prorated today from Stripe's preview
   with its `proration_date`, same cycle, no second trial, a trialing subscription keeps its trial). No new charge logic.
2. The window's first sentence per plan (decided; drawing tab 5 note 3):
   - League Plus: "{org} moves to League Plus today. Your events, teams and staff stay where they are."
   - Club / Club · Association: "{org} moves to {plan} today and can hold up to {limit} teams with a Premium Coaches
     Portal. Your events, teams and staff stay where they are."
   - The hint gains "No second trial." (after today's sentence).
   - A Premium coach's Club move keeps its own sentence (no coach surface changes).
3. Call 46: a past-due Tournament Plus organization is refused **before the window** with "Your last payment didn't go
   through. Update your payment method first, then move." (scope per the owner's answer above), on the server (move and
   preview) and as the window's refusal, with the shipped payment-method door. Rewrite the "moved as before" test to the ruling.
4. Legal pages off on a live key: `/api/billing/move` AND its preview refuse `league`, `club`, `club_large` before the address
   work, with checkout's words and code (`legal_pages_unpublished`, 503). **This newly covers the existing Tournament Plus →
   Club move: say so in the commit message.** Add both routes to the census (a test that lists every route that sells the three
   plans and fails when one lacks the refusal).
5. The window's other states stay the shipped ones (loading, no address, check failed, charge changed, region closed) —
   check each renders with League Plus's name.
6. `/pricing`'s question answer (above), through `/marketing`.

## Proofs (dev, Stripe TEST mode, with teardown — the S4 prompt's "Proofs" rules)

On `uat-test-org` (a real Stripe test subscription; record its state first, restore it after — or use a throwaway
organization and customer): Tournament Plus → League Plus **monthly** and **yearly**, the invoice showing the credit line,
the charge line and tax at the address; a **mid-trial** move invoicing $0 with no tax; a past-due organization refused before
any preview is priced; the move and preview refusing with the legal pages off on a live-key simulation (unit level is enough —
never touch a live key). Teardown proved with `invoices.search` / per-customer lists (memory
`reference_stripe_list_hides_test_clock_objects`).

## Tests and checks

Unit: the new move row (open and closed), the three first sentences and the hint, the past-due refusal (server and window),
the move + preview legal-pages refusal in the census, the `/pricing` answer, a Premium coach's move window unchanged.
`npm run verify:changed` (other sessions' work can fail `npm test`: the Part 1 session saw three not its own —
`account-first-signup` "sits in Workspaces…", `workspace-move-money` "…a different reason tag", and a type error in
`layout-run-journal.test.ts`; re-check before calling one yours), `npm run typecheck` with
`NODE_OPTIONS=--max-old-space-size=8192`, the spelling gate, `check-layout-invariants.mjs --changed` on the move window.
After-shots with the S4 capture script (tab 5: desk and phone, both gate states).

## Reviews before handing off (run them)

`/review` **high-risk** on Part 2's diff (and Part 1's, which went in on the owner's word ahead of its review); `/billing`
(the move's gates, past due, the legal-pages refusal); `/accounting` (the move invoice: credit, charge, tax, mid-trial $0,
yearly — call 39 "correct and complete"); `/marketing` (the three sentences, the hint, the `/pricing` answer); `/design` on
the move window and the new row against tab 5. Offer `/docs` (help for moving plans).

## Rules

The S4 prompt's "Rules" section. Branch `dev`; explicit pathspecs; **no commit without the owner's yes**; the plan and the
board carry other sessions' uncommitted edits — stage only your hunks on HEAD (`git hash-object -w` + `git update-index
--cacheinfo`, memory `reference_partial_commit_shared_tree`). Record Part 2 in the plan's S4 entry and the board's
`club-tier` line in the same commit.

## Hand-back

What a paying Tournament Plus owner sees differently (product-owner voice), how to see both gate states on dev (Dev tools ›
Plan gates › "Show as closed"), the proofs' results, the reviews' findings and what was applied, and what Part 3 inherits.
The walk is written once, for the whole of S4, after Part 4.
