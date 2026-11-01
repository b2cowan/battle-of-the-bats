# Plan & billing · Stage 4b · Part 4: verify the whole path (build prompt)

> **Written 2026-10-31**, after Parts 1-3 were committed (`6969f41fe` the flip; `6d67e0bb3` the money; `d6adade6b` the screens). Paste into a new chat on `dev`.
> **Re-verify every lead before building on it.** They were read on 2026-10-31 and the lines that carry a decision were re-opened by the author. Code moves,
> and a plan or an audit has been wrong in this repo before. This is **Part 4 of four** in `PLAN_AND_BILLING_STAGE4B_PLAN.md` (§4, §6, §9). It builds
> **proof, not features**: nothing a coach sees changes unless the proof finds a defect. Stop at this part's boundary.
>
> Read first, in this order: `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`; then `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`;
> then **`PLAN_AND_BILLING_STAGE4B_PLAN.md` in full** (§5 build rulings, §6 the test contract, §8 risks, §9 the Part 3 build record and hand-off);
> then `tests/unit/workspace-flip-guard.test.ts` (Part 1's guard: read its header and all three layers) and `tests/unit/workspace-move-money.test.ts`
> (Part 2's server contract). The owner's Part 3 walk is `PLAN_AND_BILLING_STAGE4B_PART3_OWNER_WALK.html` (ledger §433, published at
> `claude.ai/artifact/5ASHQVP25LggMDFHKohEuV`); read it so your proof covers what the owner is about to watch, not something else.
>
> **Other sessions share this working copy.** Stage explicit paths only, never `git add -A`, run `git show --stat HEAD` after every commit, commit only your
> own hunks, **ask the owner before each commit** (an earlier yes does not carry over), never push. Branch `dev`. `lib/console-money.ts` and
> `lib/console-money-stripe.ts` belong to another project's uncommitted work: do not touch or stage them. Several other files show as modified in the tree
> (`PlanPanelDrawer.tsx`, `MockPortalClient.tsx`, other plans and docs): they are not yours either.
>
> **Database rule.** No migration is expected. If you think you need one, stop and say why.
>
> **Do not run a browser, a UAT, or any Stripe call that touches a real account.** You WRITE the UAT spec; the owner (or `/uat`) runs it.

## Where this sits in the order

This is step 1 of the five-plan order on `BILLING_TAX_PRICING_SEQUENCE_INDEX.html` (live at `claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a`). Step 2 is Plans & pricing
Stage 0, **not** Plan & billing Stage 5: the help rewrite waits until renewal and tax land, so **do not start Stage 5** and do not edit its prompt.
Two facts change how you build:

- **GST/HST will add a tax line to the Premium→Club "Due today" window later (GST/HST plan Stage 2).** Write every money expectation in your tests through
  ONE helper or fixture so that change is one edit, not a hunt. Do not add tax now.
- **Club is not on sale** (the sale gate returns 403), so everything here ships dark. Coaches Portal and Tournament Plus are on sale and must not change.

## What this part makes true

1. **The census still covers every reader.** `workspace-flip-guard.test.ts` has a census layer from Part 1 (every production file reading the portal tag or a workspace's
   Stripe id is allowlisted with a reason). Parts 2 and 3 added readers: the move apply, `lib/portal-retained-restore.ts`, the status route
   (`/api/billing/club-upgrade-status`), the checkout quote, the suspended-wall exception, the landing and its setup card. **Re-run the census logic against the tree as it is now;
   prove nothing is unlisted, nothing listed is stale, and every allowlist reason is still true.** If the guard cannot see a new reader because it searches the wrong shape, fix the guard
   and say so. Do not widen an allowlist just to go green.
2. **A UAT spec for the whole path** under `tests/uat/scenarios/`, patterned on `org-return-flip-smoke.spec.ts` and the existing fixtures (read how they sign in and how they skip when a fixture is
   missing). It covers, as far as the current fixtures can reach: the Club row and its pre-sale line; the one window for a paying coach and for a free-time coach; the club-name field;
   the refusal states; "Setting up your club" and its slow states; the full page load to Admin and the menu swap; a non-owner typing the billing URL. Anything the fixtures cannot reach
   (a standalone Premium-owner session does not exist yet, per the Part 3 record) is **listed in the spec's header as not covered and why**, not faked. Spec only: you do not run it.
3. **A whole-path unit contract** where the UAT cannot go: the money (preview lines add to the amount due, a missing line falls back to the total), the free-time path
   (accepted in place, carries the marker, returns to an address valid on both sides of the flip, leaving keeps the free time), the late-old-price-event no-op after the flip,
   and a Club cancellation finding no workspace. Many of these exist in Parts 1-2; **map each §6 bullet to the test that pins it and add only what is missing.**
4. **The words.** `npm run check:spelling`; "payment method" never "card"; possessives through the one helper; the clock through `formatTime()`.
5. **A review-ready diff.** Offer `/simplify` (if you added a helper), then `/review` (substantive, money-adjacent, shared-module) before asking to commit.

## An open owner decision you must NOT settle

Part 3's review found that the suspended-account billing exception compares the `x-pathname` header, which `proxy.ts` sets only for paths in its matcher, and the matcher has **no**
`/{slug}/coaches/...` entry; the unit tests mock the header, so they cannot see it. **Re-verify this yourself in `proxy.ts` (the header is set near line 43; read the matcher at the bottom)
and in `app/[orgSlug]/coaches/layout.tsx` (~130-165).** If it holds, a free-time-ended coach returning from paying may meet the suspension wall instead of "Setting up your club".
The owner decides (sequence item "sign-in header gap", their walk 6 step 1 shows it). **Report it with the smallest fix you would make (probably one matcher entry) and wait.**
`proxy.ts` is shared infrastructure: make no change to it without the owner's yes, and if the owner says yes, restart the dev server (stop, delete `.next`, `npm run dev`, wait for Ready).
If the owner has already pasted back walk results, fix the defects they found first; do not wait for results that have not arrived.

## What you may not do

Change the server's move, checkout, webhook, flip or status logic, or the screens, except to fix a defect your proof exposes (say what it exposed first and ask); change prices, plan names,
gates, `lib/plan-config.ts` or the sale gate; add tax anywhere; build any of Stage 5 (help, `/docs`) or touch its prompt; edit hooks, settings or shared check scripts; re-write the owner walk
(it exists; if the proof changes what the owner should watch, tell the owner and offer a follow-up, do not silently rewrite a walk they may be partway through); fix the three
`verify:changed` failures that were red before this part (below). **Disagree out loud before building** if the code conflicts with the plan.

## Checks (focused, serial; report anything skipped)

`npm run verify:changed`; `npm run typecheck` if a shared module or the guard's search changed; the billing test families before and after (`plan-billing-*`, `workspace-move-money`,
`workspace-flip-guard`, `club-stage1-server-guard`, `org-billing-access-guard`, `plan-move-dialog-guard`); `npm run check:spelling`. Known red BEFORE this part, other work, report as unchanged:
`free-time-story.test.ts:99`, `plan-billing-usage.test.ts:112` (503 instead of 200), `support-console-stage3-guard.test.ts:564`. Known and not yours: `check:org-slug-callers` lists two callers in
`app/[orgSlug]/admin/public-site/` (`OwnAddressPanel.tsx`, `useOwnAddress.ts`); the dev mock-apply flip gap; the customer-scoped trial-history limitation. Windows needs `npm.cmd`
(PowerShell blocks `npm.ps1`). Restart the dev server only if you add files the running server must load or change a shared module (stop it BEFORE deleting `.next`).

## Report back (your final message)

For the product owner, in plain words: what is now proven and what is still unproven; the census result (readers found, added, removed, any reason that was wrong);
the §6 contract mapped bullet by bullet to a named test (existing or new); what the UAT spec covers and what it cannot reach and why; the `x-pathname` finding with your proposed smallest fix;
the tests' money helper (one place for the later tax edit); files changed; checks run and skipped; what you could not verify (a real browser, live Stripe, client caches after a flip).
Tag every statement about the product **[saw in code]**, **[from the plan]** or **[my guess]**. Name the exact files you want to commit and wait for the owner's yes.
**Stop. When the owner has walked §433 and the decision above is made, 4b is closed and the order moves to Plans & pricing Stage 0.**
