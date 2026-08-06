# Platform-admin action enforcement — findings report

> Sweep run 2026-08-05/06 against the brief in
> `PLATFORM_ADMIN_ACTION_ENFORCEMENT_AUDIT_PROMPT.md`.
> Scope: all 51 routes under `app/api/platform-admin/**` plus their admin screens.
>
> **Status: ✅ RULED AND BUILT (2026-08-06).** Owner ruled **hard-block immediately** plus all four
> secondary fixes. F1–F4 and F6 are fixed on `dev` (uncommitted); F5 needs a one-minute owner check
> of the Amplify environment and cannot be closed from here.
> Implementation → `PLATFORM_ADMIN_ACTION_ENFORCEMENT_PLAN.md`. Owner QA → ledger **§1.19**.
> This document is kept as the EVIDENCE record — it deliberately still reads as it did at
> discovery, so the reasoning behind each fix stays auditable.

---

## The defect class

> An admin action whose UI promises a consequence that the data model never enforces.

Six findings survived adversarial verification. Two leads from the brief were **refuted** and are
recorded as such, with the evidence, so nobody re-opens them.

---

## Correction to the brief's §1

The brief states cancellation leaves "all ~40 gated features" open because every gate is
`hasPlanFeature`. That is **half right**, and the half it gets wrong matters for the fix.

There are **two** gate layers, and they behave differently:

| Layer | Function | Reads `subscription_status`? |
|---|---|---|
| Module (whole subsystems) | `hasModuleEntitlement` — [lib/module-entitlements.ts:27](../../../lib/module-entitlements.ts#L27) | **Yes** — `if (org.subscriptionStatus === 'canceled') return false;` |
| Feature (~40 individual features) | `hasPlanFeature` — [lib/plan-features.ts:135-138](../../../lib/plan-features.ts#L135-L138) | **No** — pure plan-rank + grants |

So cancellation **does** correctly shut down accounting, house league, rep-teams and public-site
*module* checks. The failure is that the two largest surfaces in the product — the **Coaches Portal**
and the **tournament operations API** — never call the module gate at all. They authorise on
*role*, and role has nothing to do with billing.

This is why the defect is invisible: the gate that works is not on the path that matters.

---

## Findings, ranked

### F1 — CRITICAL · The Coaches Portal survives cancellation intact

**The promise.** The cancel dialog renders a literal **"Will shut down:"** list
([OrgDetailClient.tsx:2033-2042](../../../app/platform-admin/orgs/%5Bid%5D/OrgDetailClient.tsx#L2033-L2042)).
For a Club org that list contains, verbatim:

> *Rep Teams tryouts, rosters, **coach portal**, and player documents*

([lib/billing-retention.ts:87](../../../lib/billing-retention.ts#L87))

**The write.** `subscription_status: 'canceled'`, `is_public: false`, `billing_suspended_at`,
`billing_suspension_reason`. **`plan_id` is not touched**
([cancel-subscription/route.ts:200-208](../../../app/api/platform-admin/orgs/%5Bid%5D/cancel-subscription/route.ts#L200-L208)).

**The reader — the grep that proves nothing gates on it.**

```
$ grep -rl "hasModuleEntitlement" app/api/coaches | wc -l
0
$ find app/api/coaches -name route.ts | wc -l
150
```

Zero of 150 coach API routes consult the module gate. Each defines a local `resolveCoachContext`
that checks org membership + a coaching assignment and nothing else
([roster/route.ts:14-33](../../../app/api/coaches/%5BorgSlug%5D/teams/%5BteamId%5D/roster/route.ts#L14-L33)).
`app/[orgSlug]/coaches/layout.tsx` contains no cancellation gate. The `CancellationGuard` that
protects the admin UI mounts only inside `AdminChrome`
([AdminChrome.tsx:50-53](../../../app/%5BorgSlug%5D/admin/AdminChrome.tsx#L50-L53)), i.e. only under
`/{orgSlug}/admin/*` — the coaches portal is a different route tree.

**Blast radius.** Every coach on every rep team, **forever** — there is no expiry, no nightly job,
no token to run out. Rosters, attendance, lineups, development plans, practice plans, team budgets,
player documents, the Club Shared Book, Game-Day Mode. The 90-day retention window archives
*tournaments*; it never touches coach access.

**Severity — revenue.** This is the most expensive part of the Club plan and it keeps working after
payment stops.

---

### F2 — HIGH · Tournament operations survive cancellation; the scorekeeper PWA keeps taking scores

**The promise.** Two more verbatim lines from the same "Will shut down" list
([lib/billing-retention.ts:196-199](../../../lib/billing-retention.ts#L196-L199)):

> *Tournament setup, scheduling, communications, and **score updates***
> *Member and staff access to tournament workflows*

**The write.** Same as F1.

**The reader.** Only **2** of ~40 tournament-admin routes call `hasModuleEntitlement`
(`tournament-dashboard`, `tournament-worklist` — both read-only). The write paths that the copy
names gate on `hasCapability` alone:

- [games/route.ts](../../../app/api/admin/games/route.ts) — scheduling **and score submission**
- [setup-tournament/route.ts](../../../app/api/admin/setup-tournament/route.ts)
- [communications/route.ts](../../../app/api/admin/communications/route.ts)
- [schedule-publish/route.ts](../../../app/api/admin/schedule-publish/route.ts), `teams/route.ts`

`hasCapability` is purely role-based and `role === 'owner'` returns `true` unconditionally
([lib/roles.ts:82-91](../../../lib/roles.ts#L82-L91)). It cannot see billing.

**Partial mitigation, and the hole in it.** The admin *browser* UI does bounce a cancelled org to
billing — but via a **client-side** `router.replace()` in `CancellationGuard`, mounted only in the
admin shell. Two live surfaces sit outside that shell with no gate of their own:

- **`/{orgSlug}/scorekeeper`** — the score-entry PWA. Its own layout, its own manifest, **installed
  on volunteers' phones**. Its API (`/api/scorekeeper/[orgSlug]/score`) checks the `submit_scores`
  capability only.
- **`/{orgSlug}/check-in`** — the volunteer check-in surface. No billing gate.

**Blast radius.** Indefinite. Worth noting the perverse part: public tournament pages **are**
correctly dark ([layout.tsx:90](../../../app/%5BorgSlug%5D/%5BtournamentSlug%5D/layout.tsx#L90),
`notFound()` on cancelled; same in
[public-tournament-data.ts:110](../../../lib/public-tournament-data.ts#L110) and
[register/route.ts:309](../../../app/api/register/route.ts#L309)). So volunteers keep entering
scores that no parent can see. Silent failure, not a locked door.

**Severity — access + credibility.**

---

### F3 — HIGH · Publishing the plan feature matrix changes nothing for any customer

The purest instance of the class in the sweep.

**The promise.** A full governance ceremony: raise a catalog change request → get it **approved by a
second person** → publish. The screen reports *"Feature matrix published"* and immediately re-renders
the matrix with the new values
([PlansPricingClient.tsx:1013-1023](../../../app/platform-admin/plans-pricing/PlansPricingClient.tsx#L1013-L1023)).

**The write.** Upserts `platform_plan_module_entitlements`
([lib/plan-module-entitlements.ts:121-141](../../../lib/plan-module-entitlements.ts#L121-L141)).

**The reader.**

```
$ grep -rn "platform_plan_module_entitlements" --include=*.ts --include=*.tsx . | grep -v node_modules
./lib/plan-module-entitlements.ts:81    (getEffectivePlanModuleEntitlements)
./lib/plan-module-entitlements.ts:137   (publishPlanModuleEntitlements — the writer)
```

The single reader, `getEffectivePlanModuleEntitlements`, is called by exactly two things: the publish
route's own diff, and `getFeatureMatrixRows` → **the platform-admin plans-pricing screen**. The
runtime gate reads the hard-coded TypeScript constant instead:

```ts
// lib/module-entitlements.ts:29-30
const plan = PLAN_CONFIG[org.planId];
if (plan.moduleEntitlements.includes(cap)) return true;
```

**The published table is a mirror that reflects only itself.** Adding a module to a plan grants
nothing; removing one revokes nothing. Real packaging changes require a code edit to
`lib/plan-config.ts` and a deploy.

**Blast radius.** Every packaging change ever made this way, permanently. Aggravating factor: the
approval ceremony is what makes it *read* as authoritative.

**Severity — revenue + governance.**

---

### F4 — MEDIUM · Platform-admin plan downgrade leaves over-cap tournaments running

**The promise.** *"✅ Plan and access updated. Access changes are live now."*
([OrgDetailClient.tsx:1516-1518](../../../app/platform-admin/orgs/%5Bid%5D/OrgDetailClient.tsx#L1516-L1518)).
Implicit rather than itemised — this screen is otherwise unusually honest about what it does and
doesn't touch in Stripe.

**The write.** `plan_id` + `tournament_limit`. The route *counts* the org's non-archived tournaments
and writes that count **into the audit log only**
([plan/route.ts:61-65, 114](../../../app/api/platform-admin/orgs/%5Bid%5D/plan/route.ts#L61-L65)) —
recorded, never applied.

**The reader.** `tournamentLimit` is enforced only at **creation** time
([setup-tournament/route.ts:183](../../../app/api/admin/setup-tournament/route.ts#L183),
[clone/route.ts:307](../../../app/api/admin/tournaments/%5BtournamentId%5D/clone/route.ts#L307)).
Nothing sweeps existing rows when the cap drops.

**The asymmetry that proves it's a bug.** The self-serve downgrade path archives the excess
([downgrade/confirm/route.ts:99-106](../../../app/api/billing/downgrade/confirm/route.ts#L99-L106)).
The platform-admin path does not. Same shape as F1: the operator path skips what the customer path does.

Bulk Operations `plan_change` has the identical gap, across many orgs at once.

---

### F5 — MEDIUM · Timed entitlement overrides may be inert in production *(needs one env check)*

Enforcement of every `org_overrides` grant is behind a flag that **defaults off**:

```ts
// lib/entitlement-grants.ts:23
const GRANTS_ENABLED = process.env.ENTITLEMENT_GRANTS_ENABLED === 'true';
// :95  if (!GRANTS_ENABLED) return org;
```

`.env.local` sets it `true` for dev. **I cannot read the Amplify environment from here.** If it is
unset in production, then every *Feature Access Trial (timed)* and *Subscription Status* override an
operator grants writes a row that nothing reads — and the UI gives no hint, it just says saved.

**Action: check `ENTITLEMENT_GRANTS_ENABLED` in the Amplify env before treating overrides as working.**
If it is on, this finding closes; the reader is otherwise correct (it filters `revoked_at`, and the
revoke route flips only live rows).

---

### F6 — LOW · Bulk Operations promises a comp-period grant the single-org screen explicitly denies

The single-org override form carries an explicit warning
([OrgDetailClient.tsx:1617-1625](../../../app/platform-admin/orgs/%5Bid%5D/OrgDetailClient.tsx#L1617-L1625)):

> ⚠ Comp Period is a **billing/founding-season tag only — it grants no section or plan access.**

The Bulk Operations screen, for the same action, says only:

> *"Grant a comp period through {date}."*
> ([BulkOperationsClient.tsx:118-119](../../../app/platform-admin/bulk-operations/BulkOperationsClient.tsx#L118-L119))

Not the defect class — `comp_period` is *deliberately* records-only, and that's documented. It's a
copy asymmetry that invites the exact mistake the other screen works hard to prevent. Copy fix.

---

## Refuted — do not re-open

### ✗ Lead 1: "Ban may not evict a signed-in user" — **REFUTED**

Banning **does** evict on the next request, and the enforcement is external (Supabase), which the
brief's §2 says to name explicitly rather than report.

Every server-side auth path calls `supabase.auth.getUser()`, which is a **network revalidation
against the Supabase Auth server, not a cookie decode** — documented in-repo at
[lib/supabase-server.ts:35-37](../../../lib/supabase-server.ts#L35-L37). GoTrue rejects a banned user
at that endpoint. Verified callers: `lib/api-auth.ts:84`, `lib/platform-auth.ts:86`,
`lib/auth.ts:76`, `lib/coach-team-guard.ts:24,46`, `proxy.ts:130`. There is no local-JWT fast path
for authorization.

**Two residual notes (not findings, but worth knowing):**
1. Nothing in our code reads banned state — the only reader is one admin *display* page
   ([customer-users/page.tsx:34](../../../app/platform-admin/customer-users/page.tsx#L34)). So there
   is **no backstop**: if any auth path ever migrates to local claim verification (`getClaims()`) for
   performance, bans silently stop evicting and no test would catch it.
2. `revoke-sessions` remains useful and distinct — it kills refresh tokens rather than blocking the
   account.

### ✗ Lead 2: "`billing_suspended_at` gates only checkout" — **TRUE BUT BY DESIGN**

Correct that `lib/team-checkout.ts` is the only reader, but `subscription_status` is the access
signal and `billing_suspended_at` is an audit stamp — as the Data Dictionary already states
(`DATA_DICTIONARY.md:92`). Not a defect. Pre-existing note worth carrying: recovery paths never
clear the stamp, so a resubscribed org keeps a stale `billing_suspended_at` forever — harmless today,
a trap for any future consumer.

---

## Swept and clean

Verified: the write has a real reader at a real enforcement point, **or** the action is deliberately
records-only (§2 exclusion).

**Readers verified to exist and enforce**
- `orgs/[id]/addons` → `enabled_addons` → `hasModuleEntitlement` ✅
  *(minor: the route does not validate addon keys against `ADDON_KEYS` the way `overrides` does — over-permissive input, not the defect class)*
- `orgs/[id]/overrides` (POST) + `overrides/[oid]` (revoke) → `applyEntitlementGrants`, filters `revoked_at` ✅ *(subject to F5)*
- `orgs/[id]/delete` → hard delete; correctly refuses while a live Stripe subscription exists ✅
- `orgs/[id]/identity` → slug/name with uniqueness check ✅
- `orgs/[id]/transfer-ownership` + `team-ownership-transfers/[linkId]/complete` → cancels Stripe, suspends members, reassigns; `team_workspaces.subscription_status` is genuinely read at [lib/coach-team-page.ts:30,57](../../../lib/coach-team-page.ts#L30) ✅
- `plan-gating` → `plan_gating` table read by `lib/plan-gating-server.ts` ✅
- `plan-config` → `plan_config_overrides` read by both checkout routes ✅
- `email-templates/[key]` → `platform_email_templates` read by `sendTransactionalEmail`, hard-coded HTML only as fallback ✅
- `users/[id]/ban` / `revoke-sessions` / `reset` / `update` / `confirm-email` / `delete` → enforced by Supabase auth ✅
- `retention/process`, `retention/[recordId]/extend` → `billing_retained_records` drives the retention job ✅

**Deliberately records-only (§2 exclusion — correctly so)**
`orgs/[id]/notes`, `users/[id]/notes`, `feedback/[id]/status`, `feedback/[id]/escalate`,
`early-access/[leadId]`, `observability/[groupId]/status`, `comp_period` overrides.

**No state change (read/export/trigger only)**
`audit/export`, `feedback/export`, `early-access` + `/export`, `observability/issues/export`,
`observability/sweep`, `metrics/snapshot`, `visits`, `me`, `company-users` (+`/[id]`),
`email-templates` (list), `email-templates/[key]/test-send`,
`product-catalog/change-requests/validate-price`, `insights-digest`, `dues-reminders`,
`schedule-change-notices`, `coach-sandbox-tick`, `demo-sandbox-tick`.

**Dormant, no promise made**
`org_overrides.suppress_billing` — accepted by the API, written to the row, **read by nothing**, and
never set by any UI. No operator is misled today. Flagged so it isn't mistaken for a working control
later (the DBA review already anticipated this — `DB_ARCHITECTURE_REVIEW.md` #24).

## Deliberately not examined

Scanned for writes and cleared at that level, but **not** traced reader-by-reader:
`product-catalog/campaigns`, `product-catalog/change-requests` (beyond confirming the approval gate
is enforced by `requireApprovedCatalogChangeRequest`), `bulk-operations` beyond its `plan_change`
and `comp_period` paths, and the internals of the job-trigger routes listed above.

---

## Baseline (established before the sweep, per §6)

- Branch `dev`, ~83 uncommitted files from other sessions. **Nothing committed by this session.**
- `npm run typecheck` → **1 pre-existing failure**, not mine:
  `tests/unit/demo-sandbox-door-and-chrome.test.ts(172,29): error TS2345`.
- No source files were modified by this audit — findings only.

---

## The ruling required before any fix

Per §4, what cancellation *should* do is a pricing/packaging decision, not an implementation detail.
Options and recommendation are in the PM brief. **Nothing will be built until the owner rules.**

Reconcile any plan/price fact written during the fix against
`docs/agents/strategy/PLAN_PRICING_FACTS.md` — never restate one from memory.
