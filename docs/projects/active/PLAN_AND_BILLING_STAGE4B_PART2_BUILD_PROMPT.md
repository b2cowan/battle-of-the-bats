# Plan & billing · Stage 4b · Part 2: the money (build prompt)

> **Written 2026-10-30**, after Part 1 was built and walked (owner: "done and walked, just uncommitted"). Paste into a new chat on `dev`.
> **Re-verify every lead before building on it.** They were read in the code on 2026-10-30 by a read-only pass, and the lines that
> carry a decision were re-opened by the author. Code moves, and a plan or an audit has been wrong in this repo before. This is
> **Part 2 of four** in `PLAN_AND_BILLING_STAGE4B_PLAN.md` (§4). It is server-only: **no screen is built here** (Part 3 builds them).
> Stop at this part's boundary even if you have room left.
>
> Read first, in this order: `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`; then `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`;
> then **`PLAN_AND_BILLING_STAGE4B_PLAN.md` in full** (§3.3 and §3.4 are your spec; §2 and §5 are the rulings; §6 is your test contract);
> then the top entry of `docs/agents/strategy/BUSINESS_DECISIONS.md` (the "WORKSPACE FLIP" handoff, points 3-5); then the Part 1 code
> (`lib/workspace-flip.ts`, `supabase/migrations/414_*`, `tests/unit/workspace-flip-guard.test.ts`, and the hook in `lib/plan-move.ts`).
>
> **Other sessions share this working copy.** Stage explicit paths only, commit only your own hunks, **ask the owner before each commit**
> (an earlier yes does not carry over), never push, run `git show --stat HEAD` after every commit. The branch is `dev`.
>
> ⚠ **Part 1 may still be uncommitted when you start**, and it edited two files you will edit again (`lib/plan-move.ts`,
> `app/api/billing/create-checkout/route.ts`). Ask the owner first whether Part 1 is committed. If it is not, do **not** fold Part 1's
> hunks into your commit: use a partial commit of only your hunks (see the memory note "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5** (money paths, two entry routes, a shared module). Helpers stay on Sonnet; use them for broad reading
> and open every line a decision turns on yourself.
>
> **Database rule.** If you need a migration (you probably do not), write the file and **do not apply it anywhere**. Ask the owner how it
> reaches dev. Prod waits for the release.
>
> **Do not run a browser, a UAT, or any Stripe call that touches a real account.** Tests are unit tests with stubs.

## What this part makes true

A Premium coach can be moved onto Club **by the server**, in both situations the owner ruled, and the flip Part 1 built fires at the right
moment with the right club name:

- **A paying Premium coach:** the one subscription is changed to Club now, with a Stripe proration preview first, the billing interval
  kept, **no second trial**. The preview also returns the invoice's own line items (Club for the rest of the period, credit for unused
  Premium time) so Part 3 can draw "Due today" as lines that add up.
- **A free-time coach** (no real subscription): an ordinary Club checkout works **on the same workspace**, carries a marker that this is
  an in-place upgrade, returns to an address that is valid **both before and after the flip**, and can be read for "is it ready yet".
  The 90-day trial and the payment method are Stripe's ordinary checkout behavior. The staff-given free days end at the upgrade (Part 1's
  flip already does this; prove it, do not rebuild it).
- **The club name the coach typed** reaches the flip in all four entries (move, Stripe checkout, mock checkout, operator change).
- Nothing a user can see changes. Club stays gated (403 until Stage 8), so the whole thing ships dark in production.

## What you may not do

Change prices, plan names, gates or `lib/plan-config.ts`; build any screen or any client component (Part 3), including the move
dialog's wiring; add a way back down from Club to Premium; touch the Founding offer, the Founding audience filter or the comp-ending
rules; enforce "no second trial" across Stripe customers (see the limit below: **report it, do not build it**); delete the
`team_workspaces` row; change Part 1's RPC unless a test proves it wrong (then stop and say so); apply any migration; edit hooks,
settings or shared check scripts (owner's 2026-09-26 ruling). Do not "tidy" anything the plan does not name.

## Rulings already made (owner, 2026-10-30; plan §2, §5; do not reopen, record nothing they did not rule)

The workspace BECOMES the club; Club's ordinary price, no middle rung, no discount; a paying coach swaps the price on the one
subscription with a proration preview, interval kept, no second trial; a free-time coach buys Club with the 90-day trial and a payment
method, and the Premium free days end at the upgrade; this is not the bridge (the bridge's "won't be charged again" words do not apply);
no way back down; no Club · Association step; ruling 6: a draft or active hosted tournament does not block; ruling 8: no second trial for a
free-time portal that once paid. The preview's lines come from the real Stripe preview or the shipped total-only preview stays.

## Decisions this part must PROPOSE and wait on (not yet ruled; say them in your first message with a recommendation)

1. **Where the club name rides.** The plan says "Part 2 proposes where it rides and waits for the owner's word." *Recommendation:* a paying
   coach sends it in the move call's body; the move writes it nowhere durable except the flip (it is also put on the subscription's
   metadata so a webhook retry can read it); a free-time coach sends it in the checkout request and it travels in the session and
   subscription metadata under one key; the webhook reads it back. **The name field is capped at 40 characters** (plan §3.3); the
   lead found no existing length rule on `organizations.name`, so validate it on the server in one shared helper and trim it.
   Empty means "keep today's name" (the RPC already does that), but the screen will require it (ruling 3), so the server should
   **refuse an empty or over-long name on the in-place routes** rather than silently keeping "{team} Coaches Portal".
2. **Past-due Premium coach.** A move is allowed while the subscription is `past_due` (the paying set includes it), but Part 1's flip
   refuses anything other than `active` or `trialing` (`not_settled`). So a past-due Premium coach would be swapped to Club's price and
   left **not flipped** until a later settled event. *Recommendation:* refuse `team → club` while `past_due`, with a plain refusal the
   screen can word ("update your payment method first"), rather than flipping a card that is failing. This is a new refusal code, so say
   so.
3. **The return address.** `getBillingHref` returns the coach host while the org is a workspace and the admin host after the flip, so a
   return address fixed at session creation can land on a page that no longer exists. *Recommendation:* for the in-place Club checkout,
   return to the **admin** Plan & billing address with the in-place marker (it is the page that exists after the flip); the "Setting up
   your club" screen (Part 3) polls the status read until the flip lands. Confirm, or propose another.

## The work

1. **Premium as a move source.** Add `team: { club: 'up', club_large: 'up' }` to `MOVES` (`lib/plan-move-options.ts:6-10`; the file must
   stay pure, `tests/unit/plan-billing-profile.test.ts:149-151` forbids imports). Ask whether `club_large` belongs: the ruling says
   "Club's ordinary price", and the existing `tournament_plus` row offers both. *Recommendation:* both, because the band move afterwards
   already exists and a larger club should not have to buy twice. The Premium profile's change list picks the new rows up by itself
   (`lib/plan-billing-profile.ts:190-215`), which also makes the billing page start fetching `/api/billing/move` for a Premium coach
   (`components/billing/BillingBody.tsx:~407`): **check that this does not paint a move control before Part 3** (it must stay hidden
   while Club is gated; if it would show, hold the entry back behind the same gate, do not build the screen).
   Update the pinned tables: `tests/unit/plan-billing-profile.test.ts:~69-79` (the sorted change list and the `team.changes === []`
   assertion) and `tests/unit/club-stage1-server-guard.test.ts:~185-195` (add `['team','club','up']`, `['team','club_large','up']`).
   Also read `lib/team-cap.ts:~19` (`teamLimitRefusal` picks a move-up target from `MOVES`) and
   `app/api/billing/create-checkout/route.ts:~119` (the 409 `subscription_exists` now carries a `move` for a Premium source) and say what
   each now does.
2. **`validateMove` for a `team` source** (`lib/plan-move.ts:~129-165`, not exported; called by preview and apply). It already refuses
   `no_live_subscription` (including a `mock_` id and a free-time portal), so a free-time coach cannot be moved: that is intended, they
   go through checkout. Add the proposed past-due refusal. Cases for the unit tests: same interval kept (monthly stays monthly, annual
   stays annual), a free-time portal (no subscription), trialing, past due, canceled, a non-owner, an organization that is not a
   workspace but carries plan `team`.
3. **The preview's line items.** `previewMove` (`lib/plan-move.ts:~177-212`) returns the total only. The line items are already in the
   Stripe response (`invoice.lines.data`) and nothing maps them. Add a small mapping (description, amount, kind: charge or credit) to the
   preview result and to the client-visible shape (`MovePreview`, `lib/plan-move.ts:54-77`; the only client consumer today is the
   hand-copied `Preview` in `components/billing/PlanMoveDialog.tsx:29-32`: **do not edit the dialog**, say that it will need the new
   field in Part 3). **A line that cannot be trusted falls back to the total-only preview:** define "trusted" (the lines sum to the
   amount due, one currency, no tax line you cannot name) and test the fallback. Do not guess at Stripe's line `description` wording;
   map the type of the line, not its text, and let Part 3 supply the words through `lib/plan-billing-words.ts`.
4. **The club name through `applyPlanChangeSideEffects`.** The signature (`lib/plan-move.ts:~225-231`) has no name; add an optional
   `clubName` and forward it to `flipWorkspaceIntoClub` (it already accepts one, `lib/workspace-flip.ts:~83`). Then deliver it at the
   four entries once the owner has answered Decision 1:
   (a) the move apply (`POST /api/billing/move` body, `applyMove` options, `lib/plan-move.ts:~271-325`);
   (b) the Stripe checkout (request body, session **and** subscription metadata, `create-checkout/route.ts:~353-364`; the webhook reads
   the subscription's metadata at `app/api/billing/webhook/route.ts:~454`);
   (c) the mock checkout (`create-checkout/route.ts:~137-170`);
   (d) the operator route (`lib/operator-plan-change.ts:~226`): no name expected, say so and add a test that omitting it keeps the
   current name.
   One shared helper validates and trims the name for all of them (the 40-character rule above), with one test file.
5. **The free-time checkout in place** (`create-checkout/route.ts`). The lead found nothing that blocks a free-time portal from an
   ordinary Club checkout (no account-kind refusal for a non-`team` plan; no real subscription id, so the live-subscription 409 does
   not fire), and that the webhook then finds the org by Stripe customer. Prove each of these with a test rather than assume:
   - the checkout is accepted for a workspace on a free-time (stored `canceled`, override-held) org, and refused with the 409 + move
     hint for a paid one (the move path handles them);
   - it carries an **in-place marker** and the club name in the metadata (both session and subscription);
   - the return address follows Decision 3, passes `safeReturnTo` (`:~132-135`, which today admits only `/{slug}/admin/...` or the exact
     coach billing address), and a coach who leaves the payment page keeps their free time (cancel return changes nothing);
   - the trial rule: `hadSubscriptionBefore` (`lib/plan-move.ts:~378-384`) is scoped to **one Stripe customer**, so a free-time portal
     that once paid under a customer that was later nulled passes it and gets a second trial. **Ruling 8 cannot be fully enforced
     (plan §3.3). Report this limit at the end of your message; do not fix it on the way past.** You may read prior history from both
     `organizations.stripe_customer_id` and `team_workspaces.stripe_customer_id` only if the owner asks for it after you report.
6. **The webhook arm for a Club checkout on a workspace org** (`webhook/route.ts:~393-470`). The lead says the plan resolves to Club, so
   it takes the org branch, writes the plan, status and period, then calls `applyPlanChangeSideEffects` (the flip) **before**
   `restoreAfterReactivation`. ⚠ A stored-`canceled` free-time portal satisfies `restoreAfterReactivation`'s condition (stored status
   `canceled` and the new status `active`/`trialing`), and the mock path guards that with `!isTeamWorkspaceOrg(...)` (`:~161`) while the
   webhook does not. **Read `restoreAfterReactivation` and decide, with a test, whether running it on a freshly flipped org does harm**
   (it restores tournaments, retention records and cancellation intent). If it is harmless, say so and add the test that pins it; if
   it is not, propose the smallest guard and wait. Also test the **paid-move metadata**: `applyMove` merges its metadata onto the
   existing subscription, so the old Premium `checkoutKind`/team keys stay on it. Prove that the `customer.subscription.updated`
   event that follows the swap does not re-enter the Premium (`team`) arm after the flip (plan §3.1 "a late event carrying the old
   Premium price"; Part 1's guard covers the late old-price event; yours covers this exact event with the merged metadata).
7. **A status read** for the "Setting up your club" screen (plan §3.4). None exists. Add one route that answers, for the signed-in
   owner of that organization only, whether the workspace has become the club (the tag, `team_workspaces.workspace_state =
   'org_owned'` and `billing_mode = 'club_included'`, which is Part 1's own idempotency test), plus whether a refusal is pending
   (`not_settled`) so the screen can show its slow state. It must work **before and after the flip** (the caller's session and org
   resolution may differ on either side: test both). Owner-only, no data beyond the state. Name it in line with the existing billing
   routes; say where it lives.
8. **The demo and mock paths.** Billing writes for demo orgs are blocked at the proxy: do not touch demos. The mock checkout reaches
   the flip (Part 1). `app/api/billing/mock-apply/route.ts` writes `plan_id` directly and does **not** call
   `applyPlanChangeSideEffects`, so a dev mock-apply to Club leaves the portal unflipped: **report it, do not fix it** (a dev tool,
   not in the plan).
9. **The guard test** `tests/unit/workspace-flip-guard.test.ts` gains the Part 2 cases (extend it; do not fork a second file unless the
   owner prefers), plus a new `tests/unit/workspace-move-money.test.ts` for the move rules, preview lines, name helper and status read.
   Copy the stub style of the existing move tests (`tests/unit/club-stage1-server-guard.test.ts`, `tests/unit/plan-move*.test.ts`).
   Each new test must **fail without the change** (say how you checked).
10. **Schema = dictionary, same unit of work.** Only if you add a column or change a field's meaning (you should not need to). Otherwise
    say "no schema change" in the report.

## Checks (focused, serial; report anything skipped)

`npm run verify:changed` and the focused tests for every file you touched; `npm run typecheck` (shared modules changed); the billing,
move, profile and Part 1 flip test families before and after; `npm run check:spelling` (every refusal message a coach could read goes
through the words module or reads in plain words: "payment method" never "card"). Do not restart the dev server (no screen changed);
say so. No browser, no live Stripe.

## Report back (your final message)

What you proved and how (tests that fail without the change); the answers to Decisions 1-3 as the owner gave them; the exact `MOVES`
and pinned-test hunks; the preview's line mapping and its fallback rule; the `restoreAfterReactivation` verdict; the status read's
address and shape; the trial limit and the dev-only mock-apply gap, **listed and not fixed**; anything in the shipped code that looked
wrong, listed and **not** fixed; what you could not verify (live Stripe, a real workspace, the real shape of Stripe's line items,
client-side org caches after a flip). Tag every statement about the product **[saw in code]**, **[from the plan]** or **[my guess]**.
Then offer `/review` (substantive, shared-module, money-adjacent) and, if you added a helper, `/simplify` first. Name the exact files
you want to commit and wait for his yes. **Stop. Part 3 (the screens) has its own prompt.**
