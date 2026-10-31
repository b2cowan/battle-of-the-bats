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
