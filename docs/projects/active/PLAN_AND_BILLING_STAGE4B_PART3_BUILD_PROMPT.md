# Plan & billing · Stage 4b · Part 3: the screens (build prompt)

> **Written 2026-10-31**, after Parts 1 and 2 were committed (`6969f41fe` the flip; `6d67e0bb3` the money, with the review fixes). Paste into a new chat on `dev`.
> **Re-verify every lead before building on it.** They were read in the code on 2026-10-31 by a read-only pass, and the lines that carry a
> decision were re-opened by the author. Code moves, and a plan or an audit has been wrong in this repo before. This is **Part 3 of four**
> in `PLAN_AND_BILLING_STAGE4B_PLAN.md` (§4). It is the first part a coach can SEE. Stop at this part's boundary even if you have room left.
>
> Read first, in this order: `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`; then `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`;
> then **`PLAN_AND_BILLING_STAGE4B_PLAN.md` in full** (§1-§2 are the rulings, §3.4 the return and the "Setting up" screen, §8 the risks);
> then **the drawings: `PLAN_AND_BILLING_STAGE4B_DECISIONS.html` is the one to build to** (seven tabs, true size, computer and phone). The
> first-pass file `PLAN_AND_BILLING_STAGE4B_PREMIUM_TO_CLUB_DRAWINGS.html` is reference only: the owner's second pass dropped most of its states
> on purpose. Then read what Part 2 learned: the commit message of `6d67e0bb3` and `tests/unit/workspace-move-money.test.ts` (the server contract is pinned there).
>
> **Other sessions share this working copy.** Stage explicit paths only, never `git add -A`, run `git show --stat HEAD` after every commit,
> commit only your own hunks, **ask the owner before each commit** (an earlier yes does not carry over), never push. Branch `dev`.
> `lib/console-money.ts` and `lib/console-money-stripe.ts` are another project's uncommitted work: do not touch or stage them.
>
> **Database rule.** No migration is expected. If you think you need one, stop and say why.
>
> **Do not run a browser, a UAT, or any Stripe call that touches a real account.** The owner does the browser walk (Part 4 builds it).

## What this part makes true

A Premium coach sees a **Club** row on Plan & billing and can start their club from it, on the screens the owner drew:

- **The door.** The Change plan table on the Premium page gains a Club row ("See what Club includes", "Start my club"). While Club is not on sale
  the same row reads "Contact us to move" (the shared pre-sale line Tournament Plus already uses).
- **One window, two versions.** A *paying* coach: a club-name field and the charge drawn as lines that add up to "Due today"
  (Club for the rest of the period, the credit for unused Premium time, the renewal). A *free-time* coach: the same window with the warning
  that their Premium free time ends when the club starts, the 90-day trial sentence, a Monthly/Yearly choice, "Due today $0", and a button to
  the secure payment page. A free-time portal that once paid sees the paying window with the full charge due today (ruling 8).
- **"Setting up your club"** after paying, with its two slow states, until the club is truly ready. Then the coach lands on the club's Admin
  Overview with the short setup list and their team shown. Their menu swaps Plan & billing and Tournaments you run for Admin.
- Phone parity for all of it (drawn: tab 6).
- Every word through `lib/plan-billing-words.ts`. Plan names, prices and limits are read from config, never typed.

**Nothing reaches customers until Club opens for sale** (the sale gate returns 403 today), so this ships dark in production. Say that in your report.

## The server contract you build against (committed; read the tests, do not change the server)

**[saw in code]** unless marked. Re-open each:

- `POST /api/billing/move/preview` `{orgSlug, planKey}` → up: `{direction:'up', toPlan, billingCycle, amountDueToday, currency, prorationDate,
  nextAmount, renewsAt, lines}` where `lines` is `[{kind:'charge'|'credit', plan, amount}]` (cents, always positive) or `null` (show the total
  alone). Refusals `{code, error}`: `not_a_move`, `no_live_subscription` (→ the coach has no subscription: use checkout), `band_too_small`,
  `payment_failing` (409, "update your payment method first"), `cannot_become_club` (409, "holds more than one team" / "moved into a club"),
  `price_missing`, `plan_not_on_sale` (403), `stripe_error` (502). The server's `error` sentences are already plain words.
- `POST /api/billing/move` `{orgSlug, planKey, prorationDate?, clubName}` → `{direction:'up', toPlan, movedAt, finishing?: true}`.
  `clubName` is REQUIRED for a Premium source (400 `club_name_invalid` otherwise). **`finishing: true` means the money is taken and the
  subscription moved, but a step is still to finish and the next billing event does it: show "your upgrade is going through", NEVER "try again".**
- `POST /api/billing/create-checkout` `{planKey, billingCycle, orgSlug, returnTo?, clubName}` for the free-time coach: 400 `club_name_required` /
  `club_name_too_long`, 409 `cannot_become_club`, 409 `subscription_exists` (a PAYING coach; carries a `move` hint, send them to the move). On success the
  session returns to `/{slug}/admin/org/billing?inPlace=club` (`inPlaceReturnPath`, `lib/workspace-upgrade.ts`); leaving the payment page returns to where they were and changes nothing.
- `GET /api/billing/club-upgrade-status?orgSlug=` → `{becameClub, waitingOnPayment}`. Owner-only, no-store, works on BOTH sides of the flip.
- `CLUB_NAME_MAX` (40) and `parseClubName` in `lib/workspace-upgrade.ts` are client-safe: use them for the field, so the screen and the server never disagree.

## Decisions this part must PROPOSE and wait on (say them in your first message, each with a recommendation)

1. **Cancel-at-period-end.** A Premium subscription already set to end can be moved onto Club today; the new club would then end at renewal.
   Not drawn, not ruled. *Recommendation:* refuse, because the coach asked to leave and silently reversing that surprises them: the window says,
   in plain words, that their Premium is set to end on {date} and offers "Keep Premium" first (the existing control). This needs ONE small server
   hunk (a new refusal code in `validateMove`, `lib/plan-move.ts`, plus its test); **you may make that one hunk only after the owner answers,
   and nothing else server-side.**
2. **Club · Association row.** `moveTargetsFor('team')` returns both `club` and `club_large`, so swapping the profile back to `checkoutAndMoves('team')`
   adds a second row. The drawing shows **Club only** (the larger band is reachable afterwards by the existing move). *Recommendation:* filter in the
   profile so the Premium page lists Club only; leave the server's MOVES table alone (it is pinned and correct).
3. **The free-time coach's door.** Today `ownBilling = !staffFree && !endedPortal` hides the whole Change plan table for staff-given free time. Tab 4 draws
   the free-time window but tab 2's prose is the only door it names. Find where the drawing says that coach reaches "Start my club". *If the drawing is
   silent, stop and ask*; do not guess a second entry point.
4. **The setup list.** The club home today has one line ("Setup: n of 5 · Continue setup", `components/admin/kit/club/ClubHubKit.tsx`, fed by
   `/api/admin/org/club-checklist`). The drawn four-step list (Name your club ✓, Check your web address [Change], Invite your staff, Set up your public site,
   plus a Rep teams card "Open my team") does not exist. Check whether the existing checklist's steps can render it. *Recommendation:* a card on the club home
   shown only to a coach who arrived with the in-place marker, built from the existing checklist where it matches, and say which steps are new.
5. **How the screen leaves the portal.** Both layouts seed their organization from the server and the provider does not refetch, so the portal's shell
   stays stale after the flip. *Recommendation:* when the status read says `becameClub`, leave with a **full page load** to `/{slug}/admin` (not a client route change),
   which mounts a fresh provider. Prove it in your own reasoning and list it as the first thing the owner walk must watch (plan §8 risk 6).
6. **Three states nobody drew.** `payment_failing`, `cannot_become_club` and `finishing` have no drawing. Reuse the nearest shipped pattern (the window's
   in-window notice, as `band_too_small` does today), put the words in the words file, and **list the three in your report as "not drawn, built from the nearest pattern"**
   so the owner can redraw. Do not invent a new component for them.

## The work

1. **The door.** Swap the Premium profile's `changes: []` back to a list that gives Club only (Decision 2), and update the tests that pin it
   (`tests/unit/plan-billing-profile.test.ts` ~66-83: it asserts `team.changes` is empty; the comment there says Part 3 swaps it; change the assertion, do not delete it).
   `BillingBody` then starts fetching `/api/billing/move` for a Premium owner (`~407`) and draws the row; check the pre-sale line, the owner-only gate
   and the staff-free-time case (Decision 3). A non-owner never sees it.
2. **The window** (`components/billing/PlanMoveDialog.tsx` and its club wrapper `components/admin/kit/club/PlanMoveDialog.tsx`; `TeamCapDialog` also mounts the dialog, so
   check it is unaffected). Its `Preview` type is hand-copied and lacks `lines`: add it. It sends no `clubName` today: add the field (required, marked required,
   `parseClubName`, the 40-character limit, `aria-invalid` and the drawn empty-name message). Draw the figures as ONE connected band, not floating tiles. Know the refusal codes
   (it knows only three today; `payment_failing`, `cannot_become_club`, `club_name_invalid`, `stripe_error` fall to a generic notice at ~227: give each its own words).
   Handle `finishing`. A sentence in the foot goes in `footerStart`, never `footer` (`tests/unit/kit-dialog-foot-text-guard.test.ts`). While you are in this file, **two shipped
   defects land on this path and are yours to fix:** `W.move.up(org.name…)` prints "{team} Coaches Portal moves to Club" for a portal, and `W.move.previewHelp` says "card" where the
   rule is "payment method" (ruling T1).
3. **The free-time variant.** Preview answers `no_live_subscription`; the window then offers checkout. It must send the club name, the Monthly/Yearly choice and the drawn
   copy, and it must show the "once paid" paying variant (ruling 8) when the server says so: **find how the screen knows** (it is the server's job to say; if the preview or
   checkout does not tell you, stop and report rather than computing it in the browser).
4. **"Setting up your club"** and its two slow states (tab 5): read `?inPlace=club` in the shared `BillingBody` (it renders on BOTH sides of the flip; the admin page redirects a
   still-portal org to the coach billing page with the query intact). `billingReturnState` strips only `success`, `card_saved` and `next_season`, so `inPlace` survives; **do not
   consume it until the club is ready**, and update the pinned test (`tests/unit/plan-billing-body.test.ts` ~141). Poll the status read on the pattern in
   `app/coaches/checkout/complete/CheckoutProvisioning.tsx` (every 2.5 s, 20 tries, "Check again" restarts) but with a client `fetch` of the status route. Map the three drawn
   cards to the two facts the route gives (`becameClub`, `waitingOnPayment`): *propose the mapping in your first message.* Never offer a second payment while it is waiting.
   ⚠ **Unverified:** a free-time-ended coach returning from paying meets the billing-suspension wall in `app/[orgSlug]/coaches/layout.tsx` (~130-165) BEFORE any page. Check whether
   they can reach the Setting up screen at all; if not, report it and propose the smallest fix, do not just build around it.
5. **The landing and the menu swap** (Decisions 4 and 5). The menu choice is made from the client's organization (`CoachesSidebar`, `CoachesBottomNav`, `isTeamWorkspaceOrg`); once the
   page loads fresh as a club, they follow by themselves. Do not add a second source of truth.
6. **Phone** (tab 6): Change plan as cards, the window full-screen with one back arrow and the primary alone in the foot. Secondary actions are symbols at a 44 px floor.
7. **Words.** Everything through `lib/plan-billing-words.ts`; extend `tests/unit/plan-billing-words.test.ts` for the new vocabulary (possessives through the one helper, the clock through
   `formatTime()`, no typed plan name/price). Run `npm run check:spelling`.
8. **Request-contract tests.** `tests/unit/plan-billing-actions.test.ts` pins the exact request bodies: add `clubName`. A new route is not expected; if you add a client caller, pass `orgSlug`
   (`npm run check:org-slug-callers`).
9. **Layout.** Add sweep entries only if `scripts/layout-screens.mjs` can reach the new windows and screens (an `interact` hook exists for windows); otherwise say so. Run `check:layout -- --changed`
   on the already-running dev server for the few screens touched; the whole sweep is not yours.

## What you may not do

Change the server's move, checkout, webhook, flip or status logic (the single Decision 1 hunk excepted); change prices, plan names, gates, `lib/plan-config.ts` or the sale gate; add a way back
down from Club; add a web-address question to the window (ruling 2); prefill the club name (ruling 3); touch the Founding offer or "Part of a club?" (ruling 7); build the billing help rewrite
(Stage 5) or a UAT spec or the census guard (Part 4); edit hooks, settings or shared check scripts; restyle `.btn` or invent a component where a shipped one fits; add a cancelled-portal Club
screen (the cancelled page returns early and is not drawn); restart anything except as below. **Disagree out loud before building** if the code conflicts with a drawing.

## Checks (focused, serial; report anything skipped)

`npm run verify:changed`; `npm run typecheck` (shared modules change); the billing test families before and after (`plan-billing-*`, `workspace-move-money`, `workspace-flip-guard`,
`club-stage1-server-guard`, `org-billing-access-guard`); `npm run check:spelling`. Three `verify:changed` failures were already red at the start of this stage and are other sessions'
work (two free-time usage tests, one support-console footer check): report them as unchanged, do not fix them. **Restart the dev server at the end** (new files and shared modules): stop it,
delete `.next`, `npm run dev`, wait for Ready, per `AGENTS.md`.

## Report back (your final message)

What each role sees (owner, staff, non-owner typing the URL, a free-time coach, a once-paid free-time coach); the owner's answers to Decisions 1-6 as given; files changed; checks run and
skipped; the state checklist (empty, loading, error, preview failed, payment failing, cannot become club, finishing, success return, past due, trial, free time, cancelled, non-owner, 390 px);
**for every Stripe return path you touched, which you re-walked**; what you could not verify (a real browser, live Stripe, client caches after a flip, the suspension wall). Tag every statement
about the product **[saw in code]**, **[from the plan]** or **[my guess]**. Offer `/review` (substantive, shared-module, money-adjacent) and, if you added a helper, `/simplify` first; `/docs`
is Stage 5. Name the exact files you want to commit and wait for the owner's yes. **Stop. Part 4 (verify and walk) has its own prompt.**
