# Founding Season 2027 — Phase 2: the desk, the card, and the 2028 choice

**Status:** ✅ **committed `6eda3722` on `dev` 2026-09-08** after owner approval of the mockups (artifact `587fbd15`), rulings D1–D4, and `/simplify` + `/review` (§13 — the review overturned §4.1's schema design). Scope = `FOUNDING_SEASON_2027_PLAN.md` §3 Phase 2, built from
`FOUNDING_SEASON_2027_PHASE2_BUILD_PROMPT.md`. Runs in parallel with the Phase 1 chat (campaign
copy, demos, help) in one shared working copy — the ownership split is at the foot of this file.
**PM brief:** `FOUNDING_SEASON_2027_DESK_PM_BRIEF.md`. **Mockups:** artifact `587fbd15` (source `FOUNDING_SEASON_2027_DESK_MOCKUP.html`). **Owner QA §155**, walk artifact `29258882` (source `FOUNDING_SEASON_2027_DESK_WALK.html`). Ruling this serves:
`docs/agents/strategy/BUSINESS_DECISIONS.md` 2026-09-07.

> **The one sentence this phase exists for:** on October 1, 2027 the owner must be able to turn a
> free season into a paid one — or off — for every account, without a spreadsheet and without a
> surprise charge landing before that date.

---

## 1. What the code actually says today (verified, not re-derived)

Everything below was read out of the working tree or queried against the live dev/prod databases on
2026-09-07. Where this contradicts a plan or a comment, the code wins.

### 1.1 A founding coach workspace is already a founding ORG row

`provisionCompTeamWorkspaceFromCheckout` (`lib/team-checkout.ts` ~:868) provisions the workspace with
`billing_mode = 'platform_override'`, NULL Stripe ids and `current_period_end = FOUNDING_SEASON_END`,
**and then calls `ensureFoundingSeasonCompPeriod` on the workspace's shadow org** (~:886). So every
comped coach workspace already carries the same `org_overrides` comp row an organization does.

**Consequence for the desk:** "orgs AND coach workspaces in one list" is *one query* over
`organizations` joined to the comp row, with `account_kind` telling the reader which kind it is —
not two lists stitched together. The desk's row key is the **organization**; the workspace row only
supplies the coach-specific figures (roster size, workspace state).

### 1.2 Card-on-file must be its own fact — deriving it from `stripe_customer_id` is unsafe

`reactivateCompTeamWorkspace` (`lib/team-checkout.ts` ~:711 and ~:723) sets `stripe_customer_id =
null` on **both** the workspace and its org when a comp is reactivated. A coach who saved a card in
June and then had their comp reactivated would silently read as "no card" — and the operator would
chase them. The same is true of the `subscription.deleted` arms in the webhook, which null the Stripe
columns.

So card-on-file is recorded as **its own columns**, written at webhook time, and **never inferred**
from the presence of a customer id. The reactivation paths must be taught not to clear them.

### 1.3 The Orgs page's "Founding" badge uses a different rule from everything else

`app/platform-admin/orgs/page.tsx` ~:11 matches `expires_at >= '2026-12-31'` — a hand-typed date, not
`FOUNDING_SEASON_COMP_EXPIRIES`. Any comp expiring after 2026 (a support comp, a manual extension) is
badged "Founding" and lands in the Founding filter. That is live drift in a surface this phase owns;
it is fixed here.

### 1.4 The final-notice email is hardcoded to "no card"

`app/api/admin/email/send/route.ts` ~:271 — `case 'founding_final': return { firstName, hasCard: '',
billingUrl }` with the comment "Stripe not yet live — always the 'add a payment method' branch". Once
card-on-file is recorded the variable can be honest, and the copy's `hasCard` branch starts working.
**The var is Phase 2's; the copy around it is Phase 1's.**

### 1.5 The dev Stripe environment has no prices at all

`select * from stripe_prices` on dev: every `environment = 'sandbox'` row has `price_id = null`.
Production has live price ids for `tournament_plus`, `team`, `league`, `club`, `club_large`.
**Nothing that opens a real Stripe session can be walked on dev** — the routes 400 with "checkout is
not configured". The QA walk therefore runs through `ENABLE_BILLING_MOCK_PORTAL` / the runtime
override (`lib/billing-mock.ts`), and **every new billing route ships its mock arm in the same unit
of work**, exactly as `create-checkout` and `setup-payment-method` already do.

### 1.6 The 2028 choice menu is smaller than it looks

`plan_gating` on prod: `tournament`, `tournament_plus` and `team` are **live**; `league`, `club` and
`club_large` are **early_access** and `create-checkout` 403s on them. A founding organization's real
2028 choice is *Tournament Plus (annual or monthly)* or *drop to the free Tournament plan*; a
founding coach's is *Premium Coaches Portal (annual or monthly)* or *nothing*. The checkout does not
need to solve the Club/League question, and must not pretend to.

### 1.7 The org billing page is ALSO the coach billing page — and it hides the whole block

`/{slug}/admin/org/billing` serves both kinds (`isTeamWorkspaceBilling`, billing `page.tsx` ~:439),
but `showFoundingSeasonBanner = isFoundingSeason && !isTeamWorkspaceBilling` (~:455) suppresses the
banner **and** the "Billing" block that carries the card ask. A comped coach today sees no Founding
Season statement at all beyond a `$0` price on their plan card. That suppression was correct when the
block's only copy said "keep Tournament Plus running"; it is what item 3 exists to replace.

A coach reaches that page through the portal sidebar's **Admin** link (`CoachesSidebar.tsx` ~:408) →
org billing. It is reachable but not one tap, which is why the summer emails must deep-link straight
to it.

### 1.8 There is no "last activity" fact in the product

Nothing on `organizations` records activity. The nearest honest signal is the **owner's last
sign-in** (`auth.users.last_sign_in_at`), which the Orgs page already reads through
`supabaseAdmin.auth.admin.listUsers` (`orgs/page.tsx` ~:33). The desk uses the same source and
**names the column what it is** — "Owner last seen" — rather than implying a page-view metric the
product does not keep.

---

## 2. Where I disagree with the brief

Stated before the work, per AGENCY_RULES.

**2.1 Item 4 (the 2028 plan-choice checkout) is being built nine months before it can be used, and
its safest design depends on a decision that is not due until May 2027.** The checkout cannot open
until June 1, 2027 (`isFoundingSeasonCardWindowOpen`), cannot charge until October 1, 2027, and the
Phase 3 decision (hand-run runbook vs. job) changes what the October conversion needs from it. Nine
months is long enough for the Stripe API to move underneath it — this repo already carries
`current_period_end moved to SubscriptionItem in API 2026-04-22.dahlia` as a comment on a line that
broke that way once.

**I am building it, because the owner asked and because the alternative — deciding the mechanics
without code to argue from — is worse.** But the plan pins three things so the delay is survivable:
a single constant is the only thing that decides when money moves (§4.4), a unit test asserts the
first-charge instant is `FOUNDING_SEASON_END` and that no Stripe object is created with a sooner one,
and §7 carries a **May 2027 re-verification gate** that is part of the deliverable, not a hope.

**2.2 "Reminder sends" is one audience but arguably two questions.** The brief scopes the audience to
*no card yet*. The desk also has a *no 2028 choice yet* filter, and after June 1 those are different
people: an account can save a card and choose nothing. I am building the **`founding_no_card`**
audience as asked and **not** minting a second one, because the copy that would use it is Phase 1's
and does not exist. §8 D3 asks the owner to settle which of the summer sends targets which.

---

## 3. What the owner sees when this ships

Four surfaces. Three of them are asleep until June 1, 2027.

| Surface | Who | When it is live |
|---|---|---|
| **The Founding Season desk** — one list, every founding account | platform admin | immediately |
| **The card ask on a coach's billing page** | founding coach owner | June 1 – Sept 30, 2027 |
| **The 2028 plan choice** on both billing pages | founding org + coach owner | June 1 – Sept 30, 2027 |
| **The "no card yet" audience** in Email Campaigns | platform admin | immediately (nothing sends) |

---

## 4. The build

### 4.1 Schema — six columns on `organizations` (one migration)

The shadow-org design (§1.1) means one table answers for both account kinds.

| Column | Type | Meaning |
|---|---|---|
| `card_on_file_at` | timestamptz, null | when a usable card was first recorded. NULL = no card. **Never derived from `stripe_customer_id`** (§1.2) |
| `card_on_file_brand` | text, null | `visa`, `mastercard`… — display only |
| `card_on_file_last4` | text, null | display only, so support can tell one card from another on the phone |
| `next_season_plan_id` | text, null | the plan chosen for the season after the comp. A plan KEY, never a year — the year is derived (`FOUNDING_SEASON_NEXT_YEAR_LABEL`) |
| `next_season_billing_cycle` | text, null | `annual` or `monthly` |
| `next_season_chosen_at` | timestamptz, null | when the choice was made |

No CHECK on `next_season_plan_id` (the plan key domain lives in code and has moved twice); the
writer validates against `PLAN_CONFIG` + `plan_gating` before writing. `DATA_DICTIONARY.md` gains a
`dict:col` entry per column and the snapshots are refreshed in the same commit.

**Why columns and not a `founding_season_accounts` table:** card-on-file is a general billing fact
about an account, not a Founding Season one — the September 2027 runbook is its first reader, not
its only one. A side table would need the same identity, the same joins, and would go stale the
first time a card is saved outside the promo.

### 4.2 Recording card-on-file at webhook time

`app/api/billing/webhook/route.ts` gains one shared writer (`recordCardOnFile` / `clearCardOnFile` in
`lib/billing-setup.ts`) called from:

- **`checkout.session.completed`, `mode === 'setup'`** — the existing arm already retrieves the
  SetupIntent and promotes the payment method to the customer default. It now also reads the
  method's `card.brand` / `card.last4` and stamps the three columns. This is the primary path.
- **`payment_method.attached`** — catches a card added through the Stripe billing portal, which the
  setup arm never sees.
- **`payment_method.detached`** — clears the stamp **only when the customer has no remaining card**
  (one `paymentMethods.list` call). A customer swapping cards must not read as "no card".

All three resolve the account by `stripe_customer_id` on `organizations`, falling back to the
`orgId` in session metadata. Writes are idempotent (a second attach does not move
`card_on_file_at`).

**The reactivation paths stop clearing the fact.** `reactivateCompTeamWorkspace` and the
`subscription.deleted` arms keep nulling the Stripe ids — that is correct — but leave the three card
columns alone, with a comment saying why.

### 4.3 The backfill (presented, not run)

Three live production accounts (plan §2). The backfill is a **read-only Stripe pass**: for each
founding org with a `stripe_customer_id`, list payment methods, and stamp the columns for any that
has one. Delivered as `scripts/backfill-card-on-file.mjs` with a mandatory `--dry-run` default that
prints the intended writes and changes nothing. **The plan and the dry-run output go to the owner
before anything is run against production.** Accounts with no Stripe customer (all three, most
likely — the comp paths write NULL) simply have no card, which the desk will show honestly.

### 4.4 The 2028 plan choice — mechanics, and the one constant that decides when money moves

**Recommended: a Stripe subscription created at choice time with `trial_end` pinned to
`FOUNDING_SEASON_END`.**

| Option | What it is | Why not |
|---|---|---|
| **A — subscription with `trial_end = FOUNDING_SEASON_END`** (recommended) | Checkout in `subscription` mode, `subscription_data.trial_end` = the constant. Stripe charges the saved card at that instant and not before | — |
| B — subscription schedule starting Oct 1 | A `SubscriptionSchedule` with a future `start_date` | No subscription exists until October, so the desk cannot read plan/status/cycle back from Stripe; a second object family to handle in the webhook; and the October start still has to be right |
| C — record the choice in our DB only, create subscriptions in the October runbook | Zero Stripe objects before October | The strongest no-early-charge guarantee, but it moves the whole risk to a manual step on one day, and Phase 3 has not yet decided whether that day is hand-run. It also gives the customer no confirmation that anything happened |

**Why A wins:** it makes *Stripe* responsible for not charging early, it fires
`customer.subscription.created` immediately so the desk shows the choice through a real webhook
rather than a hopeful DB write, and it means an account that has chosen needs **no October action at
all** — which is the entire point of the desk. Annual-first works naturally: a $390 charge on
October 1, 2027 covers the 2028 season.

**The safety rails, all three of them:**
1. `trial_end` is `FOUNDING_SEASON_END` and nothing else — one constant, no arithmetic, no
   `trial_period_days`.
2. `proration_behavior: 'none'` and no `billing_cycle_anchor`, so no invoice can be raised at
   creation.
3. `tests/unit/founding-season-choice.test.ts` asserts the session builder emits
   `trial_end === FOUNDING_SEASON_END`, emits no `trial_period_days`, and **refuses to build a
   session at all if `FOUNDING_SEASON_END` is in the past** — the failure mode that would charge
   someone immediately.

**Recording the choice:** the checkout carries
`metadata: { choiceKind: 'founding_next_season', orgId, planKey, billingCycle }`. The webhook writes
`next_season_plan_id` / `_billing_cycle` / `_chosen_at` from that metadata on
`checkout.session.completed` **and** on `customer.subscription.created`, so a customer who completes
Checkout out-of-band is still recorded. The desk reads the columns; it never asks Stripe.

**Coach workspaces need a new binding.** `syncTeamWorkspaceSubscription` finds a workspace *by
`stripe_subscription_id`* (`lib/team-checkout.ts` ~:260) — a brand-new subscription on an existing
comped workspace matches nothing and would be silently dropped. The webhook gains a
`choiceKind === 'founding_next_season'` arm that binds by `teamWorkspaceId` from the metadata,
flipping `billing_mode` from `platform_override` to `team_direct` and writing the Stripe ids. This is
the single riskiest piece of the phase and gets its own `/review` lens.

**⚠ Open decision the owner must settle before this is switched on — §8 D2:** an org that chooses a
*bigger* plan in June gets that plan's entitlements the moment Stripe says `trialing`, because the
existing webhook arm writes `plan_id` from the price. Given §1.6 the realistic menu is same-plan, so
this is mostly theoretical — but "mostly" is not a design.

### 4.5 The card door for coach workspaces

`showFoundingSeasonBanner` stops excluding team-workspace billing. The banner and the Billing block
take **product-aware copy** — the same shape the marketing surfaces already use
(`foundingSeasonOfferCore(product)`), so a coach reads "the Premium Coaches Portal" and an
organization reads "Tournament Plus", from one set of derived labels. `createCardSetupSession`
already works for any org row (it takes `{ id, slug, stripeCustomerId }`), so the coach path is the
same route; what changes is that the button is rendered.

For a workspace org the customer id is written to **both** `organizations.stripe_customer_id` and
`team_workspaces.stripe_customer_id`, so the eventual subscription and the saved card sit on one
Stripe customer.

### 4.6 The desk

`/platform-admin/founding-season`, new area `founding_season`, in the **Billing & Product** group
(it is a billing instrument, not a growth one), `viewRoles: super_admin, billing, product`,
`writeRoles: []` — **the desk reads; it does not act.** Every action it implies already exists
elsewhere (bulk operations, per-org plan change, the email dashboard) and the desk links to them.
That is a deliberate narrowing: a read-only desk cannot mis-convert an account, and the October
turn-off is Phase 3's decision to make.

**Columns** (the table is on the standard, `TABLE_AND_LIST_STANDARD.md`; the shell's own K-10 data
face and K-18 38px control height are the two named exceptions it inherits):

| Column | Source |
|---|---|
| Account (name, link to the org) | `organizations.name` / `slug` |
| Kind (Organization · Coaches Portal) | `account_kind` |
| Plan | `plan_id` |
| Free through | the comp row's `expires_at` — **and a "legacy" chip when it is still the pre-2026-09-07 instant**, because that is a row migration 279 has not reached |
| Card on file | `card_on_file_at` + brand/last4, or an em dash |
| 2028 choice | `next_season_plan_id` + cycle + date, or an em dash |
| Owner last seen | `auth.users.last_sign_in_at`, most recent owner (§1.8) |
| Used it for | orgs: non-archived tournaments · coaches: roster size |
| Billing contact | owner email |

**Filters:** *No card yet* · *No 2028 choice yet* · kind · a search box. **Export** (xlsx + csv,
server-side, respecting filters) with an `EXPORT_CATALOG` entry — `check:export-catalog` fails
without one.

**The empty list is a real risk and the walk fixture answers it** (§6): a desk over an empty table
proves nothing, and dev today has two founding orgs and **zero** founding coach workspaces.

### 4.7 The "no card yet" audience

`lib/email-sender.ts` gains `MarketingAudience = … | 'founding_no_card'` and a matching count query;
`app/api/admin/email/send/route.ts` gains the recipient fetcher (founding orgs, not opted out,
`card_on_file_at is null`) and routes **one new campaign key, `founding_card_reminder`**, to it.
The Email Campaigns dashboard shows its count like every other key.

**Coordination with Phase 1 is through that key and nothing else.** Phase 1 owns the words behind
`founding_card_reminder` in `lib/marketing-email-defaults.ts` and the re-seed migration; Phase 2 owns
the key's existence, its audience and its recipient count. Until Phase 1 writes copy the key has no
template row and the send route returns its existing "content not found" 500 — which is the correct
behaviour for a campaign with no words, and **nothing sends this autumn either way**.

`founding_final`'s hardcoded `hasCard: ''` (§1.4) becomes the real value.

---

## 5. Verification

- `npm test` · `npm run typecheck` · `npm run verify:changed` · `npm run check:migrations` ·
  `npm run check:dictionary` · `npm run check:export-catalog`.
- **Rendered check:** `check:layout` sweeps coach and marketing screens only — no platform-admin
  screen is in `scripts/layout-screens.mjs`, and no admin control has ever been measured against a
  tap floor (register note, A-08/K-18). **The desk's phone shape is measured by hand at 361/390/768
  and recorded here.** Adding the desk to the sweep was considered and rejected for this phase: the
  first platform-admin entry would measure the whole shared console chrome and produce findings that
  belong to no screen.
- New unit tests: the first-charge invariant (§4.4), the audience query's exclusions (revoked comps,
  opt-outs, cards present), and the founding-recognition fix in §1.3.

## 6. Owner QA

Section claimed at the **tail** of `OWNER_QA_LEDGER.md` at commit time (Phase 1 claims one too —
never renumber). Walk delivered as a checkable Claude Artifact: checkboxes, saved state, verdict +
notes per step, Copy findings, the Sign-in-as card (**dev platform-admin account only**).

**Fixture, seeded before the walk** — the desk must not be walked over an empty list: a founding
organization **with** a card, a founding organization **without**, and a founding **coach workspace**
(dev has none today — §1.1's provisioning path is the model). Because the dev Stripe environment has
no prices (§1.5), the card is stamped through the mock/setup path, and the walk states plainly which
steps are mock-backed.

## 7. The May 2027 re-verification gate (part of the deliverable)

Before the card window opens on June 1, 2027, and named on the Phase 3 to-do:
1. Re-check the Stripe API version pinned in `lib/stripe.ts` against `trial_end` semantics.
2. Run the first-charge invariant test and one live sandbox rehearsal of the choice checkout.
3. Confirm `NEXT_PUBLIC_FOUNDING_SEASON_*` is not overridden in the Amplify environment
   (`FOUNDING_SEASON_2027_PLAN.md` §4 already flags this).

## 8. Decisions for the owner (presented, not taken)

- **D1 · The coach read-only window (plan D4).** When is it built, and what does a lapsed coach see
  until it exists? Options and trade-offs go to the owner with the mockups; until it is built the
  coach consequence copy stays on its fallback line.
- **D2 · Does a June choice take effect in June, or on October 1?** (§4.4.)
- **D3 · Do account notices to founding accounts honour the marketing opt-out or bypass it as
  service messages?** Argued from what the code does today, both sides, at the mockup gate.
- **D4 · Anything in the choice checkout that could charge before October 1, 2027** — the answer
  proposed is "nothing, and here is the test that says so" (§4.4), for the owner to accept or reject.

## 9. Ownership boundary (shared working copy)

**Phase 2 owns:** `app/platform-admin/**`, `app/api/admin/**`, `app/api/billing/**`,
`lib/billing-setup.ts`, `lib/founding-season.ts`, `lib/email-sender.ts` (audiences),
`lib/platform-areas.ts`, `lib/export/catalog.ts`, the org/coach billing page's summer ask, the
migration, `DATA_DICTIONARY.md` + snapshots.

**Phase 2 does NOT touch:** `lib/marketing-email-defaults.ts`, campaign copy in `lib/email.ts`, the
re-seed migration, `lib/demo-*.ts`, `lib/help-content/*.tsx`, marketing pages.

Migration number claimed when the file is written and re-checked immediately before commit. Explicit
pathspecs only; shared files (TODO.md, the ledger, the decisions log, the dictionary) staged by hunk.

---

## 10. What was built (2026-09-07, after owner approval of the mockups and D1–D4)

**Rulings taken, all as recommended:** D1 the coach read-only window is built in the spring with
Phase 3 (the copy stays on its honest fallback until then) · D2 a choice does NOT move the plan; the
plan changes at the first charge · D3 the season-ending notice is a service message, not a campaign ·
D4 the no-early-charge design accepted, and the voluntary mid-season upgrade path is left alone.

**Landed:**
- **Migration 283** — six columns on `organizations` (card on file ×3, next-season choice ×3) with
  two partial indexes on the ABSENCE, which is the side both the desk filter and the audience select
  for. Applied to dev; dictionary + snapshots refreshed in the same unit of work. **PROD-OWED.**
- **The desk** — `/platform-admin/founding-season`, new read-only area `founding_season`
  (super_admin · billing · product), nav entry under Billing & Product, four figures, four filters,
  xlsx/csv export with an `EXPORT_CATALOG` entry, and the amber **Legacy** chip for a comp row
  migration 279 never reached.
- **Card on file, recorded at the webhook** — the setup-mode arm, plus `payment_method.attached` and
  `payment_method.detached` (which clears only when Stripe says no card remains, and fails CLOSED if
  it cannot ask).
- **The coach card door** — see §11: the door already existed and was ungated; it is now gated,
  named and explained.
- **The next-season choice** — `POST /api/billing/choose-next-season`, a pure params builder in
  `lib/next-season-choice.ts`, the webhook binding (including the coach-workspace binding that
  `syncTeamWorkspaceSubscription` would otherwise drop), and the billing page's chooser / confirmed /
  "if you choose nothing" states.
- **The founding-recognition fix** on the Organizations page (§1.3).
- **`scripts/backfill-card-on-file.mjs`** — dry-run by default, read-only against Stripe, refuses
  `--apply --prod` with a sandbox key. Dev dry run verified (6 accounts, 6 cards found). **The prod
  dry run cannot run until migration 283 is applied there** — the columns do not exist yet.
- **`scripts/seed-founding-season-fixture.mjs`** — the four states the walk must be able to see, dev
  only, refuses `--prod`.

**Verification:** `npm run typecheck` ✓ · `npm test` **3,214 ✓** (11 new, all on the no-early-charge
invariant) · focused lint ✓ · `check:dictionary` ✓ · `check:index-coverage` ✓ · `check:export-catalog`
✓ · `check:css-selectors` ✓ · `check:admin-org-context` ✓ · `check:demos` ✓ · `check:root-files` ✓ ·
`check:observability` ✓. **`check:schema-parity` FAILS** — dev is ahead of prod by migrations 280–284
(280–282 and 284 belong to other sessions, 283 is this one). That is the normal pre-release state,
not a defect, and it is the only red gate.

**Rendered check, by hand** (no platform-admin screen is in `scripts/layout-screens.mjs`, so the
sweep would not open this page at all). Desk at 361 / 390 / 768 / 1440, signed in as the dev platform
admin: 200 at every width, **no horizontal page overflow at any width**, the list becomes cards at
≤640 (headings leave the flow, cells stack), and columns are kept with an inner scroll at 768 and
1440. One finding fixed: the account-name link measured **23px** at 768 and now clears the console's
38px floor (K-18). Two findings left, both **shared console chrome, not this screen's**: the layout's
"Sign out" at 35px, and the shared `ExportMenu` at 26–32px tall with its icon-only "more formats"
control 29–32px wide — under the 44px WIDTH floor that K-18 explicitly does NOT except. Fixing
`ExportMenu` changes all 34 export surfaces at once and does not belong in a billing commit; recorded
here for the register.

## 11. What the code said that the brief did not

**The coach card door already existed, ungated and unexplained.** The brief scoped item 3 as "coach
workspaces need the same door". They had one: a comped Coaches Portal counts as a paid plan
(`hasPaidPlan = planKey !== 'tournament'`), so the page rendered the ordinary **Billing tools** block
whose "Payment method & invoices" button calls the portal route — which, for an account with no
Stripe customer, falls back to a card-setup session. In January. With no Founding Season copy
anywhere on the page. The fix was to stop suppressing the Founding Season block for coach accounts,
which retires that generic block for them and gates the card ask to the summer window exactly as an
organization's is.

⚠ **Consequence worth knowing:** the "Cancel Premium access" card is also keyed on
`!showFoundingSeasonBanner`, so a comped coach no longer sees it during the free season. That now
matches how a comped organization has always behaved, and it agrees with the offer copy ("there is
nothing to cancel"). It is a deliberate side effect, not an oversight.

## 12. ⚠ NOT BUILT — the "no card yet" audience (scope item 5)

**Blocked by a boundary collision, and stopped rather than forced.** Between this plan being written
and the build starting, the Phase 1 chat moved `MarketingAudience` and `MARKETING_EMAIL_AUDIENCE` out
of `lib/email-sender.ts` and **into `lib/marketing-email-defaults.ts`** — a file this phase is
explicitly forbidden to touch — and has uncommitted edits in `app/api/admin/email/send/route.ts` and
`app/platform-admin/email/EmailDashboardClient.tsx`, both nominally this phase's files. Adding the
audience now means either editing their in-flight files or declaring a union member in a file that is
theirs.

**What this costs, precisely: nothing an operator cannot already do.** The desk's *No card yet*
filter is built, is the same rule, and exports — so the list exists today. What is missing is the
wiring that turns that list into a batch-email audience, and **nothing was going to send this autumn
anyway.**

**To finish it, one of two things:** the Phase 1 chat adds `'founding_no_card'` to `MarketingAudience`
and maps a `founding_card_reminder` key to it (this phase supplies the query), or the two changes are
merged in one session after Phase 1 commits. `founding_final`'s hardcoded `hasCard: ''` (§1.4) is in
the same blocked file and is unfixed for the same reason.

## 13. `/simplify` and `/review`, 2026-09-07 — and the design decision `/review` overturned

**`/simplify`** (four lenses, all four returned): a single-exit `ensureStripeCustomer` (the mirror
call was restated before all four returns — the exact shape that produces the bug it exists to
prevent) · one `formatCardOnFile` in a new pure `lib/billing-format.ts`, shared by the desk and the
billing page, replacing two independent copies · the console's existing `planLabel` and `pluralize`
instead of local re-implementations · `showFoundingSeasonBanner` deleted (it had become a pure alias
for `isFoundingSeason`) · the confirmation card's three `PLAN_CONFIG` lookups with three different
fallbacks hoisted to one · two byte-identical CSS classes deleted in favour of the ones already in
the file · a Stripe round trip removed from two webhook arms by passing the payment method the event
already delivers. **Skipped, with reasons:** the `.mjs` scripts' duplicated Supabase plumbing (a
repo-wide pattern across ~11 scripts, not this diff's to fix) and a `.noticeBox` CSS consolidation
(same).

**`/review`, high-risk tier, five lenses.** Four of the five independently reported the same
Critical. Everything below was verified in the main loop before it was fixed.

### 13.1 ⚠⚠ The design in §4.1 was WRONG, and this is the finding that mattered most

**Six columns on `organizations` would have published every founding account's card and 2028
commitment to the open internet.** Verified against LIVE PROD, not migration files: `anon` and
`authenticated` both hold the SELECT grant on `public.organizations`; RLS is enabled; its only SELECT
policy is `org_read USING (is_org_member(id) OR is_public = true)`; `is_public` defaults true and
**four of prod's five organizations are public**. RLS is ROW-level, never column-level — so anything
added to that table is readable by anyone holding the anon key, which ships in every page's JS
bundle.

The facts now live in **`organization_billing_facts`**, RLS enabled with **no policies** — the
platform's service-role-only posture, and the same door migration 212 closed for roster PII.
Migration 283 was rewritten in place (it had never left dev) and the dev columns were dropped.
It also removes the index-build objection: a fresh small table indexes instantly, where two partial
indexes on `organizations` would have scanned a table nearly every request touches.

⚠ **The wider finding is not this phase's to fix and the owner should see it:** `organizations`
already carries `stripe_customer_id`, `internal_notes` and `billing_suspension_reason` under that
same anon-readable policy. Today's leak is small (no public prod org has a Stripe customer id yet),
but it is a standing exposure that a billing commit is the wrong place to change.

### 13.2 The other four confirmed, and what changed

| | What it did | Fix |
|---|---|---|
| **Critical** | **Cancelling the 2028 choice tore the account down.** The choice creates a real Stripe subscription months before it charges, and the billing page hands the customer a portal link — where cancelling it is the obvious thing to do after a change of mind. The webhook read that as "this account cancelled": archive every tournament, hide the public site, suspend the org — or, for a coach, revoke Premium and email a cancellation notice — all while the comp still had months to run. Reachable by a second path too (a non-`trialing` status on `subscription.updated`) | A three-way classifier (`pending` / `converted` / `withdrawn`) replaces the boolean, and **both** the `deleted` arm and the `updated` arm consult it. A withdrawn choice clears the choice and nothing else; the chooser reappears and the desk counts the account as "no choice yet" again. Recognised by metadata **and** by the recorded subscription id, so a stripped-metadata event still lands there |
| **Critical** | **A second choice charged twice.** A double-click, a back button, or a change of mind created a second live subscription with the same first-charge instant while the first stayed live. The account row holds one id, so the older one became invisible to us and perfectly visible to Stripe | The choice route cancels the prior choice subscription before creating a new one (the paid Coaches Portal path has had this guard since it was built), and refuses rather than proceeding if the cancel fails for any reason but "already gone". The id is recorded for that purpose |
| **High** | **A card swap could end as "no card".** Detach and attach are delivered in no guaranteed order; the "any cards left?" read could honestly say no, and the clear then landed after the new card had been recorded | The clear is conditional **at write time** on the stored card still being the detached one, not only on the earlier read |
| **High** | **Any org member could read the card fingerprint and the 2028 commitment** by calling the status endpoint directly — no billing capability required, unlike every sibling billing route | The comp status stays open to any member (the shell renders it); the card and the choice are gated on the `billing` capability |
| **High** | **The success message and the chooser rendered together** after returning from Checkout, because the webhook loses the race with the redirect — inviting the customer to choose again, which is the on-ramp to the double charge | The chooser and the consequence card are suppressed while the return flag is present |

**Also fixed:** a five-minute margin on the first-charge guard (the old check could pass with
milliseconds to spare and be overtaken by network latency, which is the one failure that charges
someone early) · a plan key can no longer be written as `''` (a third state SQL reads as "chosen" and
JavaScript reads as "not chosen"), backed by a CHECK · the choice route re-asserts promo membership
so a drifted `plan_id` cannot widen its own menu · the customer fallback in the card writer is only
trusted when the named account has no conflicting Stripe customer · the fixture's walk password is
read from the environment instead of being committed · the status-refresh on the comp path merges
rather than replaces.

**Refuted / accepted with a reason:** the `product` platform role seeing billing contacts (owner-ruled
2026-09-07, in the area's own comment) · the desk's per-kind usage branch (there is no shared "usage"
abstraction to bolt onto — this is the first surface listing both kinds) · `chosen_at`'s
read-then-write being millisecond-racy (both writers set the same value; the guarantee that matters
is that a four-month stream of Stripe events cannot move it) · the scripts' duplicated plumbing.

**Verification after the fixes:** typecheck ✓ · **3,229 unit tests ✓** (18 new — the no-early-charge
invariant, the margin, and the three-way classifier whose `withdrawn` case is the one that tears an
account down if it is wrong) · focused lint ✓ · `check:dictionary` ✓ · `check:index-coverage` ✓ ·
`check:export-catalog` ✓ · `check:css-selectors` ✓ · `check:css-module-purity` ✓ ·
`check:admin-org-context` ✓ · `check:spelling` ✓ · `check:root-files` ✓ · desk re-rendered at
361/390/768/1440, still no horizontal overflow at any width, cards at ≤640.
