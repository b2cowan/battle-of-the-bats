# Plan & billing · Stage 4b · A Premium coach becomes a club, in place · build plan

**Written 2026-10-30 · screens drawn and all eight rulings made the same day (owner) · PM brief: `PLAN_AND_BILLING_STAGE4B_PM_BRIEF.md` · build prompt: `PLAN_AND_BILLING_STAGE4B_BUILD_PROMPT.md` · drawings: `PLAN_AND_BILLING_STAGE4B_DECISIONS.html` (second pass; Codex's first pass is `PLAN_AND_BILLING_STAGE4B_PREMIUM_TO_CLUB_DRAWINGS.html`) · parent plan: `PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md` §5 Stage 4b, §6 B (4)**

> Every "saw in code" line below was read from the tree on 2026-10-30 by a read-only pass and the load-bearing ones were re-opened
> before this was written. Code moves: a build session re-verifies each lead before building on it.

## 1. What this build makes true

A Premium coach taps **Start my club** on Plan & billing. A paying coach gets one window (club name + the charge as lines that
add to "Due today"); a free-time coach gets the same window with the free-days warning and the 90-day trial sentence, then a
secure payment page. After paying they see "Setting up your club" until it is truly ready, then land in the club's Admin
Overview with a short setup list and their team inside it. Their rail swaps Plan & billing and Tournaments you run for Admin.
The team, the roles and the web address do not change. Plan & billing stays owner-only.

## 2. The rulings this build carries out (owner 2026-10-30; do not reopen, record nothing they did not rule)

Money and structure: `BUSINESS_DECISIONS.md` top entry (the workspace BECOMES the club; Club's ordinary price; a paying coach swaps the
price on the one subscription with a proration preview, interval kept, no second trial; a free-time coach buys Club with the 90-day trial
and a payment method, Premium free days end at the upgrade; this is not the bridge; no way back down; no Club · Association step).
Screens: plan §6 B (4), eight rulings, all as recommended: **(1)** one window, name + charge · **(2)** no web-address question, the
workspace address stays and its change is offered on the landing · **(3)** club name empty and required · **(4)** the credit as invoice
lines that add to "Due today" when the real preview supplies them · **(5)** land on the club's Admin Overview with a setup list and the
team shown · **(6)** a draft or active hosted tournament does not block · **(7)** "Part of a club?" left as shipped · **(8)** no second trial
for a free-time portal that once paid. Words are draft until `/marketing`; the trial sentence reads "payment method" (ruling T1).

## 3. What the code says (checked 2026-10-30)

### 3.1 The workspace flip is the build; the screens are the small part

- **The portal test is an OR, copied by hand.** `isTeamWorkspaceOrg` is `accountKind === 'team_workspace' || planId === 'team'`
  (`lib/team-workspace-kind.ts:10-12`) and the same OR is hand-copied in `lib/api-auth.ts:145`, `lib/db.ts:~4170`,
  `lib/free-time.ts:383`, `lib/org-membership-policy.ts:34`, `lib/team-org-links.ts:402` and `lib/founding-season-desk.ts:180`.
  **Flipping `plan_id` alone changes none of them**, because `account_kind` still matches. About 100 production sites in about 90 files
  read the tag, in these groups: routing and landing (~16), navigation and chrome (~12), billing pages and URLs (~8), API gating (~30),
  cancel / retention / free time (~12), emails (~7), platform-admin and fixtures (~10).
- **Readers that look at `account_kind` ONLY** (break even if `plan_id` were patched): `app/[orgSlug]/coaches/layout.tsx:140`,
  `coaches/teams/[teamId]/page.tsx:1982`, `app/api/admin/org/free-time/route.ts:30`, the platform-admin cancel-subscription route
  (`:75,129`), bulk-operations (`:210`), and the directory (`lib/directory.ts:395,571`, which hides a portal from the public directory).
- **The cancellation trap** (`app/api/billing/webhook/route.ts`, `customer.subscription.deleted` ~`:546`): `syncTeamWorkspaceSubscription`
  runs FIRST and keys on `team_workspaces.stripe_subscription_id`. If that column still holds the subscription id after the flip, a
  later Club cancellation runs the Coaches Portal retention and sends the portal cancellation email. This is the risk the decisions entry
  names. A late or replayed event carrying the old Premium price can likewise re-enter the `team` arm (`:328-391`).
- **The webhook never flips the tag.** It writes plan, limit, status and period (`:412-424`) and calls `applyPlanChangeSideEffects`
  (`:454`; also called by `applyMove` and the operator route). It never touches `account_kind`, `team_workspace_status`, the
  `team_workspaces` row or `team_entitlements`. There is **no processed-events table**: retries are safe only because each write is
  state-based. The flip must therefore be idempotent on its own state.
- **The pattern to copy** is the bridge: `move_team_into_club` (`supabase/migrations/313_*`, current body in `351_*`) is one plpgsql RPC
  that locks the rows (`FOR UPDATE`), makes every write in one transaction, is idempotent (`alreadyMoved`), writes an audit-log row in
  the same transaction, and is granted only to `service_role`; Stripe is touched by the app after commit.

### 3.2 What the flip must set (a sibling RPC; the table in the build prompt is the checklist)

| Thing | On flip |
|---|---|
| `organizations.account_kind` | `'organization'` (the real tag; also un-hides the club from the directory) |
| `team_workspace_status` | NULL (the dictionary says it is set only for a workspace) |
| `plan_id`, `tournament_limit` | the Club plan and `PLAN_CONFIG` limit (the webhook writes the same values; last write wins on identical values) |
| `team_limit`, `free_floor` | stay NULL (assert it in the test) |
| `is_discoverable` | stays `false` until the coach opts in (ruled, §5; club creation defaults to true) |
| `slug` | KEEP (links, return URLs and the team's address hang on it) |
| `name` | the club name the coach typed (today it is "{team} Coaches Portal") |
| billing columns on the org | KEEP and let the real Club subscription write them; do NOT copy the bridge's "canceled + cleared ids" (a free-time coach starts as stored `canceled`, held open by an override grant) |
| `billing_suspended_*` | clear, as Keep Premium does |
| `team_workspaces` row | tombstone, never delete (`team_entitlements`, `basic_coach_teams.team_workspace_id`, `team_org_links` point at it): `workspace_state='org_owned'`, `billing_mode='club_included'`, `stripe_*` NULL, keep `rep_team_id` and `primary_owner_user_id` |
| `team_entitlements` | `status='cancelled'`, `ends_at=now` (clubs entitle their own teams; filter positively, the codebase spells it both ways) |
| free-time grant (`org_overrides`, staff-given) | revoke (`revoked_at`) and write the audit entry; reuse the grant-ending loop in `convertFreeTimePortal` (`lib/portal-keep-premium.ts:185-205`) |
| Founding comp | already revoked on any move onto Club (`applyPlanChangeSideEffects`) |
| workspace-only staff grants (`tournaments`, `registerTournaments`) | strip from the four places they are stored (see the prompt) |
| open `team_org_links` rows | revoke (as the bridge does) |
| `organization_members` owner, head-coach membership, the `basic_coach_teams` shadow | KEEP |

**The flip is gated on a settled Club subscription** (as Keep Premium is: not settled means do nothing), and runs from every entry
that can put a workspace on Club: the move apply, the webhook, the mock checkout and the operator route. All four already meet in
`applyPlanChangeSideEffects`, the one natural hook. It is idempotent: `account_kind` already `'organization'` returns "already flipped".

### 3.3 The money paths

- **Premium is not a move source.** `MOVES` (`lib/plan-move-options.ts:6-10`) has no `team` key, so `validateMove` answers `not_a_move`.
  Adding `team: { club: 'up' }` feeds the Premium profile's change list (`lib/plan-billing-profile.ts:207`) and needs the pinned table in
  `tests/unit/club-stage1-server-guard.test.ts` and the profile tests updated.
- **The preview** is a Stripe invoice preview (`proration_behavior: 'always_invoice'`, the billing anchor kept, the SAME interval read off
  the subscription item). It returns only the amount due, currency, proration date, next amount and renewal date. **The line items are
  already in the Stripe response and nothing maps them**, so "Club for the rest of the period / credit for unused Premium time / Due
  today" is a small addition (ruling 4), with the shipped total-only preview as the fallback if a line cannot be trusted.
- **Price ids** come from the `stripe_prices` table by plan, interval and Stripe environment, not env vars. The sandbox rows were
  verified for Club; **whether the live Club rows exist is contradictory in the docs** and is checked before the sale gate opens, not now.
- **A free-time coach** has no subscription id, so the live-subscription refusal does not fire and an ordinary Club checkout works on the
  same workspace (the webhook finds the org by Stripe customer, so it cannot create a second org). Gaps: the checkout's return address is
  coach-host only and does not know the club; its metadata carries no marker that this is an in-place upgrade; **no status read exists**
  for a "setting up" screen.
- **No second trial** is enforced by `hadSubscriptionBefore`, which is scoped to one Stripe customer, and `create-team-checkout` makes a
  new customer every time. **So ruling 8 cannot be enforced for a coach who cancelled a Premium subscription and bought again on a new
  customer.** That is a pre-existing platform limit, not a regression; it is reported at the end of Part 2, not fixed on the way past.
- **Club is gated.** The move and checkout routes answer 403 until Club is open for sale (Stage 8), and the Club row reads "Contact us to
  move". Dev has every plan on sale by design, so the whole flow is testable there.

### 3.4 The return and the "Setting up your club" screen

`billingReturnState` is a pure parse of `success`, `card_saved`, `next_season` and `plan`; `success=1` shows an "active" notice and strips
itself. Nothing polls. The one page-level polling pattern is the coaches checkout-complete screen (`router.refresh` every 2.5 s, up to
20 times). The new screen needs a **status read** (the org's tag and plan) and a **return address that still works before the flip and
lands correctly after it**: the coach host's billing address stops existing the moment the tag flips (`lib/billing-urls.ts:39`).

## 4. The parts (each its own commit, each only after the owner says yes in the chat)

**Part 1 · The flip (server only, nothing visible).** The RPC (migration, next free number; today's newest is 413), its TypeScript wrapper
with named refusals, the hook in `applyPlanChangeSideEffects`, the six hand-copied ORs replaced by the one function (ruled, §5), the
free-time grant ending, and the guard test (§6). Ships dark: nothing calls it until Part 2 adds the move.
**Part 2 · The money.** Premium as a move source; the preview's line items; apply (same subscription, interval kept, no trial);
the free-time path (in-place checkout, club-aware return, in-place marker, status read); ending staff-given free time; the demo and mock
paths. **The club name the coach types travels with the move or the checkout** (a paying coach: the move call; a free-time coach: the
checkout's metadata, capped at the name field's 40 characters) so the flip can write it; Part 2 proposes where it rides and waits for the
owner's word. Still no screens.
**Part 3 · The screens.** The Club row (and the pre-sale row), the one window (paying and free-time variants), the "Setting up your
club" screen and its two slow states, the landing (setup list, team shown), the rail swap (follows the flip), phone parity, and every word
through `lib/plan-billing-words.ts`. Dev server restart at the end (new files and shared modules).
**Part 4 · Verify and walk.** The census guard, a UAT spec for the whole path, the owner walk artifact (one purpose), `/review` and
`/simplify` offers, `/docs` offer (the billing help rewrite is Stage 5). Stage 5 follows.

Parts 1-2 are the heavy ones; if a session is running deep, stop at the part boundary and hand over (the prompt says so). **Parts 1 and 2
have prompts** (`PLAN_AND_BILLING_STAGE4B_BUILD_PROMPT.md`, `PLAN_AND_BILLING_STAGE4B_PART2_BUILD_PROMPT.md`); each later part gets its own,
written when the part before lands, so it carries what that part learned.

## 5. Build decisions (RULED, owner 2026-10-30: "go ahead with your recommendations on 1-4")

1. **`is_discoverable` after the flip: stays false** until the coach opts in (club creation defaults to true; this does not).
2. **The six hand-copied portal tests are replaced by the one function** (`isTeamWorkspaceOrg`), in Part 1. It touches shared files, so the
   build still shows the exact hunks in its report and the owner approves the commit as usual; the decision itself is made.
3. **The flip hook lives inside `applyPlanChangeSideEffects`**, so no entry (move apply, webhook, mock checkout, operator route) can forget it.
4. **The old 365-day retention rows** (`billing_retention_intents`, `billing_retained_records`) left by an earlier Premium cancellation are
   **left alone and reported**; they are not a live portal's data.
5. **Email audience: dropped (owner, 2026-10-30).** The owner said Founding Season is being deprecated soon, so a flipped club joining the
   "organization" Founding audience filter (`lib/email-sender.ts:510-536`) is not a question this build asks. Nothing else is ruled about
   the Founding offer; the "never reaches a Club" rule and the comp-ending behaviour stand as built.

## 6. Tests (the contract)

- **`tests/unit/workspace-flip-guard.test.ts`**, two layers (pattern: `team-move-coverage.test.ts` and
  `support-console-stage4b-inforce-guard.test.ts`). **Behavioural:** build a workspace fixture, apply the flip's column set, assert the
  portal test is false everywhere it is defined, the billing link is the admin one, the retention window and cancellation preflight are the
  Club ones, and the org is no longer hidden from the directory. **Census:** every file reading `account_kind` or
  `team_workspaces.stripe_subscription_id` is on an allowlist with a reason, and the flip resets every row in §3.2. **A late old-price
  event after the flip is a no-op** (the `team` arm finds no workspace).
- **Move rules:** update the pinned `MOVES` table and the profile tests; add `validateMove` cases for `team → club` (same interval,
  no live subscription, trialing, past due, a non-owner).
- **Preview lines:** the lines add to the amount due; a missing or untrusted line falls back to the total-only preview.
- **Free-time path:** the checkout is accepted in place, carries the marker, returns to an address that works before and after the flip,
  and a coach who leaves keeps their free time.
- **Words and spelling:** `npm run check:spelling`; "payment method" never "card"; possessives through the one helper; the clock through
  `formatTime()`.
- **Schema = dictionary, same unit of work:** update `docs/agents/db/DATA_DICTIONARY.md`, run `npm run refresh:snapshots`,
  `npm run check:dictionary` passes. A migration is applied to dev by the owner's flow; prod waits for the release.
- **Demos:** billing writes for demo orgs are blocked at the proxy; no demo work is expected. Do not re-seed anything.

## 7. Not in this build

Going back down from Club to Premium; Club · Association (the existing larger-band move reaches it afterwards); a new plan, discount or
price; changes to the Founding offer; a web-address question at the upgrade; enforcing "no second trial" across Stripe customers (reported
only); help articles (Stage 5); advertising the path.

## 8. Risks, in order of worry

1. **A missed portal reader** leaves the club behaving as a portal. Mitigation: the census guard plus the one-function consolidation.
2. **The cancellation trap** if the tombstone keeps the Stripe subscription id. Mitigation: NULL it in the RPC and test a Club cancellation.
3. **Race between the webhook, the apply and the flip.** Mitigation: idempotent on state, same values written by both, flip gated on a
   settled Club subscription.
4. **The return path** lands on an address that stops existing at the flip. Mitigation: the status read and a return that is valid on
   both sides (Part 3, proven in the UAT spec).
5. **Live Club prices not wired** (docs contradict). Mitigation: a check before the sale gate opens, not a build task.
6. **Session and client caches.** The server reads the org fresh each request; the client's org context and any stored active-org state are
   not verified. Check on the first load after a flip.

## 9. Part 3 decisions and build record — 2026-10-31

The owner answered **“Approve all recommendations”** to the Part 3 prompt's six decisions and the corrected status mapping:

1. Refuse a Premium-source upgrade while its subscription is set to end; show the date. **Refined by the owner in this session: “Use ‘Open payment settings’.”** The existing Keep Premium flow buys Premium after staff-given free time; it is not a scheduled-cancellation resume action. Offer the existing secure billing portal with that honest label; do not undo the cancellation implicitly or send a paying coach to another checkout. The portal's Stripe-side resume availability has not been verified here.
2. The Premium profile offers **Club only**. The server's move table still permits both Club bands.
3. Staff-given free time gets the identical Club row in Change plan (the drawing explicitly specifies this in tab 2). No second entry point.
4. The four-step setup card appears only after this in-place upgrade. Name confirmation and address review are new display steps; reuse the checklist's board/public destinations without treating board membership as proof that coaches were invited.
5. Confirmed readiness leaves with a **full page load** to Admin Overview, carrying the setup marker, so a fresh organization provider and menu mount. This is the **first thing the owner walk must watch**; static reasoning is not a browser verification of client caches.
6. Payment failure, workspace ineligibility and finishing use the existing in-window notice: **not drawn, built from the nearest pattern**.

Status mapping: successful not-ready reads (including `waitingOnPayment`) show Setting up, then Taking longer after 20 reads at 2.5-second intervals; a failed check shows Couldn't confirm. Check again restarts the same status check. Readiness leaves for Admin. No waiting state offers another payment.

The owner also answered **“Authorize the preview extension”** and **“Allow the exact billing-page exception”** after the required stop/report:

- The existing move preview's `no_live_subscription` refusal gains a read-only checkout quote for a Premium source buying a Club band. It reads the same customer history and effective trial configuration as checkout, server price/currency, and Stripe's invoice preview for a purchase without a trial (including customer balance). It creates no customer, session or subscription. Checkout remains authoritative at submission; the documented cross-customer trial-history limitation remains.
- Inside the existing suspended coaches frame, only an accepted workspace owner on the exact trusted billing pathname may render the billing child. Other paths and non-owners keep the wall; no coaching provider, assignment reads or working portal controls mount.

Validation and hand-off are recorded here after the implementation checks. Browser/UAT/live Stripe remain the owner's work. `check:layout` launches Playwright, so the prompt's explicit no-browser rule prevents running it in this part; the current layout fixtures also have no standalone Premium-owner session for the new window.

### Part 3 implementation hand-off — 2026-10-31

**[saw in code]** The Premium profile now offers Club only. The same table is shown during running/ending staff-given free time, with the existing Contact us to move door while the live sale gate is closed. No sale gate, plan configuration, price or migration changed. **[from the plan]** The purchase path ships dark until Club opens for sale; this session did not query the production sale gate.

**[saw in code]** Owners get the empty required club-name field, server charge/credit lines when trustworthy, total-only fallback, and renewal in one band. A subscription-free coach gets a server checkout quote: trial eligibility is read from the same Stripe history as checkout, effective trial days from config, and figures/currency from Stripe. A once-paid coach sees no second-trial promise or interval selector; checkout charges the quoted purchase without a proration credit. The free-days warning applies to either subscription-free variant. Checkout rechecks eligibility at submission.

**[saw in code]** Staff and other non-owners gain no billing access, including by typing the URL or the return marker. The suspended layout allows only the accepted workspace owner on the exact billing path, in its minimal wall frame; all other paths retain the wall and no assignment reads run there. Ended free-time and cancelled pages retain their existing early returns and recovery controls; no Club screen was added to those views. The new return marker mounts only the status screen, ahead of ordinary billing reads or payment controls.

**[saw in code]** Readiness triggers a full document load into Admin, not a client route push. Both layouts seed `OrgProvider`; its state is initialized from that seed and auth events skip fetching it when a seed exists. A full request mounts fresh identity and the existing sidebar/bottom-menu rules then choose Admin. The landing consumes the marker only after readiness, keeps the setup card for that arrival, and uses the assignment's real team ID for Open my team. Name/address are new display steps; staff/public-site destinations reuse the existing checklist. Assignment loading, failure/retry and an empty result are visible. The existing five-step checklist retains its own meaning.

**[from the plan]** Payment failing, cannot become club, and finishing are **not drawn, built from the nearest pattern** (the shipped in-window notice). The initial setup sentence avoids asserting that payment settled: the status facts alone do not establish that. Phone forms use the shipped full-screen form mode, one header back arrow and no secondary Cancel in the ordinary footer. Quiet landing/slow-state actions become symbols with accessible labels and a 44px floor.

Checks run serially:

- Focused billing families **before edits: 588/589 passed**; `plan-billing-usage.test.ts:112` already returned 503 instead of 200.
- Focused billing/money/flip/server/access/footer families **after implementation: 618/619 passed**, with the same usage failure. After the final currency-formatting adjustment, the request-contract and words families passed **42/42**.
- `npm run verify:changed`: **12,730/12,733 passed**, then stopped at its unit-test stage. Failures outside the Part 3 edits: `free-time-story.test.ts:99` (stale check before write); `plan-billing-usage.test.ts:112` (503 instead of 200); `support-console-stage3-guard.test.ts:564` (`ExpenseFormWindow.tsx` foot sentence is not a span/p). These files/behaviors were not fixed by this work. The usage failure was reproduced before edits; the build prompt already warned about free-time/support-console failures.
- `npm run typecheck`, focused ESLint on all changed runtime TypeScript/TSX, `npm run check:spelling`, and `git diff --check` passed. Windows used `npm.cmd` because PowerShell execution policy blocks `npm.ps1`.
- `npm run check:org-slug-callers` reports two callers outside this work: `app/[orgSlug]/admin/public-site/OwnAddressPanel.tsx:65` and `app/[orgSlug]/admin/public-site/useOwnAddress.ts:25`. No new billing caller was reported.
- Remaining chained gates after `npm test` in `verify:changed` were not reached. Layout/browser/UAT/live Stripe were skipped as instructed; no new sweep entries claim coverage that the current fixtures cannot reach. No hooks, settings, shared check scripts or the other project's console-money files were edited.
- Dev cache repair was needed because generated `.next/dev/types/routes.d.ts` contained duplicate/truncated declarations. The workspace server was stopped before clearing `.next`. A final stop/clear/restart ran through `npm run dev` with network access, reached Ready and returned HTTP 200 for `/platform-admin/login?next=%2Fplatform-admin`; logs were checked for Supabase EACCES failures.

**[saw in code]** State/flow checklist: empty club name (field message, no money request); loading (named line); preview/network error (notice, Check again, no confirmation); payment failing (payment portal door); cannot become club (notice/contact); finishing (no second payment); success return (status-only mount); past due (server refusal); trial (existing paid trial preserved; checkout quote uses actual eligibility); running/ending free time (same Club row); ended free time and cancelled (existing early-return views); non-owner (locked before billing reads); 390px (source/CSS inspection only). Existing empty payment-method/invoice/fee behavior was not changed. This is a code/test walk, not browser verification.

**[saw in code]** Stripe returns re-walked in source and unit contracts:

| Path | Re-walk and evidence |
| --- | --- |
| Paying move | Request includes trimmed club name and preview proration date; success/finishing sends the owner through `inPlaceReturnPath`, status polling, full Admin load, then marker consumption. Request/status/landing tests cover those pieces. |
| Checkout success | Club name and chosen cycle reach create-checkout; the existing server success path keeps `inPlace=club` on the admin billing address, and the still-portal redirect preserves the query. Before/after flip status behavior and the narrow suspension exception are tested. |
| Checkout cancel | The client still passes its host billing return; the server retains `safeReturnTo` for cancellation, without the success marker. The money tests retain the invariant that leaving checkout does not revoke free time. |
| Payment portal | The new failure/ending doors invoke the existing org-scoped portal route. That route computes its return using the current organization and ignores the caller's `returnTo`; no return-path logic was changed there. The new caller was inspected; no real portal was opened. |
| Card saved / next-season choice | No request or server return path changed. Existing parser/request tests passed; `inPlace` is not consumed by `billingReturnState`. |

**[from the plan]** Remaining verification: the owner must first watch fresh club identity/menu after the flip, then the complete paid/free-time/once-paid paths, 390px layout and slow returns. Real Stripe behavior (including portal renewal resumption), browser caches and the live suspension-return race remain unverified. The pre-existing dev mock-apply flip gap and customer-scoped trial-history limitation remain. Part 4 owns the UAT spec, census guard and owner walk; Stage 5 owns help/docs.

Exact proposed commit scope (only this session's hunks; no commit or push performed):

- `app/[orgSlug]/coaches/layout.tsx`
- `app/api/billing/move/preview/route.ts`
- `components/admin/kit/club/ClubHubKit.tsx`
- `components/billing/Billing.module.css`
- `components/billing/BillingBody.tsx`
- `components/billing/ClubUpgradeSetup.tsx` (new)
- `components/billing/PlanMoveDialog.tsx`
- `lib/plan-billing-profile.ts`
- `lib/plan-billing-words.ts`
- `lib/plan-move.ts`
- `lib/workspace-upgrade.ts`
- `lib/workspace-upgrade-preview.ts` (new)
- `tests/unit/plan-billing-actions.test.ts`
- `tests/unit/plan-billing-body.test.ts`
- `tests/unit/plan-billing-coach-host.test.ts`
- `tests/unit/plan-billing-profile.test.ts`
- `tests/unit/plan-billing-words.test.ts`
- `tests/unit/workspace-move-money.test.ts`
- `docs/projects/active/PLAN_AND_BILLING_STAGE4B_PLAN.md`
- `docs/projects/active/PLAN_AND_BILLING_STAGE4B_PM_BRIEF.md`
- `TODO.md` (the Premium → Club index line only)

Owed before treating this substantive, shared-module, money-adjacent work as reviewed: **`/simplify` first, then `/review`**. Ask the owner before each commit. Stop at Part 3.

### Part 3 simplify + review record — 2026-10-31

**Simplify (4 lenses).** Applied: one `isPremiumToClub` / `isInPlaceReturn` / `clubHomeAfterUpgradePath` home in `lib/workspace-upgrade.ts` (the route, the dialog and the billing body no longer each spell the test); the checkout quote now runs its independent reads together and reuses the move module's price and date helpers; the hub's setup list is driven by a three-entry array and shows ONE "Rep teams" card (it was up to four, each titled alike); the hub keeps one copy of the assignment rows; the status screen's copy is looked up by state and its dead `hiddenIcon` rule is gone; the suspended wall no longer reads the ended-free-time record for the one page that never renders it; the dialog's deleted header comment is restored and extended. **Skipped, on purpose:** splitting the dialog into a band-move dialog and a Premium dialog (the right shape, too large and unwalked to do inside a cleanup); reusing the pricing page's trial sentence (it says "card"; ruling T1 says "payment method"); the Monthly/Yearly radiogroup shared with the pay-cycle dialog; moving the trial rule into checkout itself (server money path, outside this part).

**Review (high-risk tier; correctness, security, contract, concurrency).** Fixed: choosing the cycle already chosen left the window on a spinner for good; a declined charge was reported as "couldn't reach the provider" and dropped the server's "nothing was changed"; a failed confirm on an ordinary band move lost its figures; the Premium-only foot sentence, panel focus rule and "form" kind reached the band move and the team-cap offer; a lost answer followed by a second try said "not a move" instead of finishing on the setup screen; the window could be closed onto the old billing page while the page was leaving; a missing checkout quote left Cancel as the only door; one failed status read ended the wait (now three in a row); the two hops that leave the page replaced nothing in history (Back bounced forward again); the hub could list one team twice. Pinned in `tests/unit/plan-move-dialog-guard.test.ts` and `plan-billing-actions.test.ts`.

**OPEN, needs the owner (found by review, confirmed by reading `proxy.ts`).** The suspended-wall billing exception, and the committed zero-team wall door before it, compare the page against the `x-pathname` header. `proxy.ts` sets that header only for the paths in its matcher, and the matcher has no `/:slug/coaches/…` entry. If that holds on a running server, then (a) the recovery door never opens for a real owner (they meet the wall), and (b) the owner of that same organization could send the header themselves and open any coaches page inside the wall frame (bounded: owner of that org only, coach APIs still closed). The unit tests mock the header, so they cannot see this. **First thing the owner walk checks.** Fix options: add the coaches path to the proxy matcher, or take the page from a source the browser cannot set. Not changed here: it is a `proxy.ts` / shared-auth change that was not approved.

**Not Part 3's, reported unchanged.** `plan-billing-usage.test.ts:112` (503, from before this stage), `support-console-stage3-guard` footer check, and `support-console-stage5-guard` (a deleted `components/FeedbackModal.tsx` in another session's tree). `check:layout` skipped (no browser per the build prompt). Production note: once promoted, every paying Premium owner sees the Club row reading "Contact us to move" until Club opens for sale (owner's pre-sale ruling).

## 10. Part 4 · verify the whole path — build record, 2026-10-31

Proof, plus the two defects it exposed, fixed on the owner's word (the proxy header, the surviving banner). Build prompt:
`PLAN_AND_BILLING_STAGE4B_PART4_BUILD_PROMPT.md`. Owed: `/simplify`, `/review`, the docs drift check, in a fresh chat
(`PLAN_AND_BILLING_STAGE4B_PART4_REVIEW_PROMPT.md`).

**The census was searching the wrong shape [saw in code].** Its workspace clause counted a file only when it named both `team_workspaces` and
`stripe_subscription_id`. The flip keeps the row as a tombstone whose `workspace_org_id` IS the club, so a lookup by org, team or owner finds it
and was invisible: **22 production readers** outside the list. The clause is now any read of the table (`workspace-flip-guard.test.ts` §4), and
each of the 22 is listed with a verdict read from its code: 3 portal-only, 9 tombstone-aware (a `platform_override` filter, `portalsInForce`'s
running entitlement, or `org_owned` read as "moved into a club"), 6 harmless reads, 1 dev, the flip's own wrapper, and **2 gaps** (below,
now fixed and tombstone-aware).
Plan-only tests (`plan_id === 'team'`) stay out by design, said in the test: both the webhook and the flip write the Club plan. No entry went
stale; one reason was incomplete and is corrected (`lib/workspace-upgrade.ts` also holds the "became the club" test, on both sides of the flip).
The Part 2-3 readers the prompt named were already covered or read nothing: `portal-retained-restore.ts`, the status route, the checkout quote
and the setup card take ids or the URL marker, not the tag; the coaches layout and `workspace-upgrade(-status).ts` were listed.

**Gap found, FIXED (owner "fix it", 2026-10-31) [saw in code]: the "Welcome to Premium" banner survived the flip.** The two upgrade-summary
routes found the workspace by org and team with no portal or tombstone test, and the flip does not clear `migration_summary`. A coach who went
free → Premium, never dismissed that banner, then became the club saw "Welcome to Premium — your team came with you" on the club's team page; if
that copy had failed, its retry kept re-copying from the free team. Fix: both reads now carry `.neq('workspace_state', 'org_owned')`. The guard
lists both as tombstone-aware, pins the filter, and holds the `known-gap` class empty.

**The `x-pathname` finding holds [saw in code].** `proxy.ts` sets the header (line 43) only on matched paths; the matcher has `/coaches/:path*`
but no `/:slug/coaches/…` entry, and nothing else sets it. So (a) the suspended owner's billing exception and the older zero-team wall door
(`coaches/layout.tsx` 144 and 256; the comment at 254 says the proxy overwrites the header, which is not true for this path) never see it and
the owner meets the wall; (b) the owner of that org can send the header themselves and open another coaches page inside the wall frame (coach APIs
stay closed). **FIXED (owner "go with what you recommend", 2026-10-31):** the matcher gains `'/:slug/coaches'` and `'/:slug/coaches/:path*'`,
and a header-only early return after the sandbox fast-path sets `x-pathname`/`x-request-id` and stops, so a coach page still pays no session
round-trip (the file's own stated reason for leaving the portal unmatched). The early return is skipped when the first segment is in
`RESERVED_ORG_SLUGS` (`/platform-admin/coaches`, `/my/…`, `/api/…` keep their own rules: a blanket `segments[1] === 'coaches'` exit would
have skipped the platform-admin session check). Pinned by calling the real proxy with a forged header (`plan-billing-coach-host`, "the page the
coaches layout trusts is the proxy's"); the UAT spec's Walk 6 tests are ordinary passing expectations now. Dev server restarted after.
⚠ Found on the way, not changed (a shared test helper): `readCode` strips block comments first, and `proxy.ts:70` has "/api/admin/*" inside a
line comment, so every guard that reads proxy.ts through `readCode` loses lines ~70-143 (the new branch included). The new pin reads raw source.

**§6, bullet by bullet, to the test that pins it.** Behavioural flip → guard §2 (three fixtures, assignments read from the SQL). Census → guard §4
(widened above). Late old-price event and a Club cancellation finding no workspace → guard §2 "a Club cancellation and a late old-price event"
and money §6 "the event that follows the swap". Pinned `MOVES` → `club-stage1-server-guard` (the `team` rows). `validateMove`: same interval
→ money §2 "keeps the billing interval"; no live subscription → §2 "a coach with no subscription is not moved"; trialing → §2 "a trialing
Premium coach moves too"; past due → §2 "REFUSES a move while the payment is failing"; non-owner → money §7 "owner-only", `plan-billing-body`
"non-owner gets no billing facts", `plan-billing-actions` marker-by-role table. Preview lines add up / fall back → money §3. Free-time path:
in place → §4 "is an in-place upgrade only for a portal"; marker → §4 "carries the marker"; both-sides address → §4 "returns to an address
that works BEFORE and AFTER the flip"; leaving keeps free time → §4 "a coach who leaves the payment page keeps their free time". Words →
`check:spelling` and money §7/§8 "plain words". **Nothing in §6 was unpinned**; the only new contract is the census widening and the known-gap pin.

**Money helper (one place for the GST/HST edit).** `tests/unit/_club-upgrade-money.ts` `dueTodayOf(lines)`; the money contract's line
expectations go through it. ⚠ The tax edit is two edits: `trustedPreviewLines` refuses ANY tax on the invoice (its own fallback test,
"tax on the invoice"), so once tax is collected every taxed coach gets the total-only window until the tax stage teaches it a tax line.

**UAT spec, written, not run: `tests/uat/scenarios/premium-to-club-path.spec.ts`.** A (read-only, walk fixtures): Club row or its pre-sale
door; the free-time window (free-days band, trial, empty required name, address, Due today, no "card"); an empty name refused with no request; a
non-owner refused at the page, the marker and the status read. B (Walk 6 fixture): the wall elsewhere; the billing exception opens; a forged
header does not. C (a coach it makes and deletes: free team → staff free time → mock billing): Setting up → Taking longer → Couldn't
confirm on a fake clock; Start my club → checkout → flip → a full document load into Admin with the setup list and the team; rows checked
against §3.2; the rail and the phone More sheet swapped. Not reachable, said in its header: the paying window (a mock subscription is never
"live"), the real webhook return, once-paid and set-to-end, a portal staff member. Found on the way: a mock-made Premium coach can never get
a quote (its fake Stripe customer fails the history read), which is why group C makes a free-time coach instead.

**Not mine, reported unchanged:** the three known-red tests; `check:org-slug-callers`' two public-site callers; the dev mock-apply flip gap;
the customer-scoped trial history. Pre-existing "card" words on the billing page (Founding and past-due copy) predate this stage.

### Stage 5 inputs from the Part 4 docs check — 2026-10-31

Audit of `lib/help-content/*` and the help hubs against what Stage 4b shipped (two read-only passes; the cited lines re-opened). **No sentence a
customer can read is now false; nothing was edited.** Everything below is for the Stage 5 prompt (`PLAN_AND_BILLING_STAGE5_BUILD_PROMPT.md`, not
edited here).

⚠ **Two briefs are stale, not the help.** `PLAN_AND_BILLING_CODEX_RULES.md` §3 and this stage's review prompt both say the owner may delegate the
`billing` capability. Commit `8d579da29` (2026-10-29, owner ruling) reversed that: `billing` and `org_settings` are inert for every role but the
owner. The help ("Only the owner sees it") is correct; do not "fix" it to mention delegates. Stage 5 should not inherit the delegate line.

**New coverage (nothing exists today):**
1. Becoming a club in place: Start my club / the Club row in Change plan; same team, roles and web address; no data copy. Home: the coaches guide
   (a Premium coach looks there), cross-linked from the club plan-and-billing topic and from "bring in a coach's team".
2. What it costs: Premium swapped for Club on the same subscription with a proration preview, interval kept, no second trial; the staff-given
   free-time variant (a payment method, the 90-day trial, free days end at the upgrade).
3. "Setting up your club", then Admin Overview with the setup list and the team inside it; the rail swaps Plan & billing and Tournaments you run
   for Admin.
4. No way back from Club to Premium. The club plan-and-billing "Change plan" topic reads as if Club-sized is the whole list.
5. "Contact us to move" on the Club row while Club is not open for sale, tied to a Premium owner.
6. A locked or suspended Premium owner can still open Plan & billing; every other coaches page keeps the wall.
7. In place vs "Join a club" (the bridge): one disambiguating line on each side. A coach searching "become a club" lands on the bridge article today.

**Existing sentences that mislead the new case (reword in the same pass, none false):**
- Coaches guide: the "Where do I see my Premium plan" FAQ and its `answerText`, and the sidebar and phone tours ("Plan & billing if you own the
  portal, and Admin if you also run the club") read as if both rows show; once the club starts, Plan & billing is replaced by Admin.
- "The club's subscription has ended — ask your club administrator" and the "ask the club admin" lines on division and starting a season: a coach
  who started the club is that administrator. Season starting moves to Admin → Rep teams for them.
- "Tournaments you run" menu directions: hosting moves under Admin once the club starts.
- The Premium intro ("if your organization later joins FieldLogicHQ…") and the Parent organization setting mention only the bridge.
- Club guide "Set up your club": a converted coach never sees the first-sign-in checklist; the list sits on Overview beside the existing team.
- Operator mirror (platform-admin help): retention is described as 365 days for a portal and 90 for an organization; a converted account is the
  second. Incomplete, low priority.

Every fix above must also reach the searchable fields (`keywords`, `searchText`, `answerText`); no anchor needs renaming.
