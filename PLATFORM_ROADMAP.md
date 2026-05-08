# Platform Roadmap (Consolidated)

Authoritative source for all remaining and planned work on FieldLogicHQ. Supersedes four source plan files that are archived in place — consult them for historical context on shipped features.

**Supersedes (archived to `docs/archive/`):**
- [`ADMIN_HUB_NAVIGATION_PLAN.md`](docs/archive/ADMIN_HUB_NAVIGATION_PLAN.md) — all tasks complete
- [`ARCHIVES_EXPANSION_PLAN.md`](docs/archive/ARCHIVES_EXPANSION_PLAN.md) — Phase A complete; deferred items carried forward here
- [`MODULE_CAPABILITIES_PLAN.md`](docs/archive/MODULE_CAPABILITIES_PLAN.md) — Phase A complete; Phase B is a standing pattern (see Module Build Checklist)
- [`PLATFORM_IMPROVEMENTS_PLAN.md`](docs/archive/PLATFORM_IMPROVEMENTS_PLAN.md) — Phases 1–3 complete; Phase 4 items reconciled here

---

## Status Legend
- [ ] Not started
- [x] Complete
- [~] In progress
- [!] Blocked on decision

---

## What's Shipped (Foundation Summary)

| Area | What landed | Source |
|---|---|---|
| Forgot password / password reset | Full forgot + reset flow; PASSWORD_RECOVERY handler; role-aware post-reset redirect | PLATFORM_IMPROVEMENTS_PLAN.md Phase 1 |
| Invite and re-invite flow | Accept-invite page, PKCE callback, display names on accept, re-invite endpoint + UI, existing-user notification email, invite branding fix | PLATFORM_IMPROVEMENTS_PLAN.md Phases 1–2 |
| Member suspension | `status` column migration, suspend/reinstate API + UI, suspended members blocked from all API routes | PLATFORM_IMPROVEMENTS_PLAN.md Phase 2 |
| Officials and seat limits | Officials excluded from seat count on Pro/Elite; seat meter on billing page; 80% nudge banner | PLATFORM_IMPROVEMENTS_PLAN.md Phases 2–3 |
| Onboarding flow | 3-step checklist, `onboarding_completed_at` column, new signup redirect, skip logic | PLATFORM_IMPROVEMENTS_PLAN.md Phase 3 |
| Audit log | `org_audit_log` table, writes on invite/remove/role/cap changes, read-only admin view at `/admin/org/members/audit` | PLATFORM_IMPROVEMENTS_PLAN.md Phase 3 |
| Display names | `display_name` column, surface in members list, capture during invite acceptance | PLATFORM_IMPROVEMENTS_PLAN.md Phase 3 |
| Org offboarding (minimal) | "Request Account Deletion" form in Org Settings sends email to support address | PLATFORM_IMPROVEMENTS_PLAN.md Phase 3 |
| Module capabilities — Phase A | 7 module caps in `Capability` type, ROLE_DEFAULTS updated, module/action sections in cap override UI, `userCapabilities` in OrgContext | MODULE_CAPABILITIES_PLAN.md Phase A |
| Admin hub navigation | Hub tile grid at `/admin/`, org admin pages under `/admin/org/`, section-aware sidebar (hub/org/tournament modes), smart tournament redirect | ADMIN_HUB_NAVIGATION_PLAN.md |
| Admin archives ("Past Tournaments") | Admin archives page at `admin/archives/` — two-section layout (Sealed Records + Pending Seal), seal flow, seal API extended to accept `archived` status. Labeled "Past Tournaments" in tournament operations sidebar. | ARCHIVES_EXPANSION_PLAN.md Phase A |

---

## Conflict Resolution Log

### 1. Archives A2 — ORG_NAV placement
**Conflict:** ARCHIVES_EXPANSION_PLAN A2 specified adding Archives to `ORG_NAV` in the sidebar. ADMIN_HUB_NAVIGATION_PLAN step 1.5 similarly planned to move the page to `/admin/org/archives/`.

**Resolution:** The design decision was made that archives are **per-module**, not org-level. Tournament archives remain in the Tournament Operations sidebar as `{ key: 'archives', label: 'Past Tournaments' }` at the path `admin/archives/`. The org admin sidebar has no archives entry. Step 1.5 of ADMIN_HUB_NAVIGATION_PLAN was intentionally not executed. When future modules are built, each gets its own historical section within its module sidebar (e.g., "Past Seasons" in house league). **Both A2 and step 1.5 are resolved as superseded by the per-module archives pattern.**

### 2. PLATFORM_IMPROVEMENTS_PLAN 2A.4 — Hide sidebar items for inaccessible modules
**Conflict:** Task 2A.4 ("hide sidebar items for modules the user cannot access") shows as unchecked.

**Resolution:** The hub navigation implements this intent more robustly — the hub tile grid gates entire sections using `hasCapability()` before the user enters a section. The sidebar is section-scoped and only renders nav items for the active section. A user without `module_tournaments` sees no tournament operations tile and cannot enter that section. When new modules are added, each module's hub tile is already gated by its cap. **2A.4 is resolved via hub nav architecture.**

### 3. MODULE_CAPABILITIES_PLAN Phase B — Per-module checklist
**Conflict:** Phase B appears as a discrete future project in the source plan.

**Resolution:** Phase B is a **standing pattern**, not a scheduled phase. It is represented in this plan as the Module Build Checklist section below. Every new module must apply all checklist items; it is not batched or scheduled independently.

---

## Phase 1 — Near-Term Polish

**Goal:** Close the one remaining minor navigation gap from the archives work.

### [x] Archives B2 — Back-to-Admin Link (~30 min)

**Problem:** An admin who navigates from the "Past Tournaments" admin page to a public archive detail page (`/{orgSlug}/archives/{archiveId}`) has no way back to the admin shell. The back link on the public detail page goes to the public ledger, not to the admin section.

**Fix — server-side auth check on the public detail page:**

```tsx
// In app/[orgSlug]/archives/[archiveId]/page.tsx
const ctx = await getAuthContextWithScope().catch(() => null);
const isAdmin = ctx?.org?.id === org.id;
// Render: {isAdmin && <Link href={`/${orgSlug}/admin/archives`}>← Past Tournaments</Link>}
```

No URL pollution, no state management. The detail page is already a server component.

**Also:** Add the same check to `app/[orgSlug]/archives/page.tsx` (public ledger) to show an `Admin →` link in the header when the viewer is an authenticated org member.

---

### Archives B1 — Public Ledger Year Grouping (deferred)

**Problem:** When an org runs multiple age groups as separate tournament rows (e.g., "Battle 2024 U11" and "Battle 2024 U13"), the public ledger shows two unrelated rows with the same `season`.

**Approach:** Group the `archives` array by `season` before rendering. Within each year group, render a visually separated sub-section. All data is available from `getArchivesByOrg` — pure display change.

**Effort:** ~2–3 hours. **Hold for:** After real sealed data exists in production to confirm the grouping need. Not urgent today.

---

## Phase 2 — Plan Entitlements Architecture (~1 hour)

**Goal:** Create the org-level commercial enforcement layer that gates reserved modules by plan and add-on status. This is a **hard prerequisite** before any reserved module's routes go live. No user-facing change.

Source: MODULE_CAPABILITIES_PLAN.md §C1, §Plan Entitlements Architecture

### [x] 2E.1 — Add `moduleEntitlements` to `PlanConfig`

**File:** `lib/plan-config.ts`

Add to `PlanConfig` interface:
```ts
moduleEntitlements: Capability[];
```

Populate per plan:
- `starter`, `pro`, `elite`: `['module_tournaments', 'module_communications', 'module_members']` (the three core modules — included in all plans)
- Reserved modules (`module_public_site`, `module_accounting`, `module_house_league`, `module_rep_teams`) are NOT in any base plan's `moduleEntitlements` — they require the `enabled_addons` flag on the org.

### [x] 2E.2 — Migration: add `enabled_addons` to `organizations`

New migration file (next sequential number after `012_audit_log.sql`):
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS enabled_addons jsonb NOT NULL DEFAULT '[]';
```

### [x] 2E.3 — Create `hasModuleEntitlement()` helper

**File:** `lib/module-entitlements.ts` (new)

```ts
import { PLAN_CONFIG } from './plan-config';
import { Capability } from './roles';
import { Organization } from './types';

export function hasModuleEntitlement(org: Organization, cap: Capability): boolean {
  const plan = PLAN_CONFIG[org.planId];
  if (plan.moduleEntitlements.includes(cap)) return true;
  const addons: string[] = (org as any).enabledAddons ?? [];
  return addons.includes(cap);
}
```

Also update the `Organization` type to include `enabledAddons: string[]` if not already present.

### [x] 2E.4 — Document the two-axis check pattern

Update the inline comment in `MODULE_CAPABILITIES_PLAN.md` Phase B (§2A.3) and this file's Module Build Checklist to show the combined check pattern that route handlers must use once this helper exists:

```ts
if (!hasCapability(ctx.role, ctx.capabilities, 'module_X')) return forbidden();
if (!hasModuleEntitlement(ctx.org, 'module_X')) return forbidden();
```

---

## Module Build Checklist (Standing Pattern)

Apply all layers when adding any new module. Missing any one layer creates a gap (API exposed, broken page, or orphaned URL).

| Layer | Where | What to add |
|---|---|---|
| Route handler gate | `app/api/...` | `hasCapability(ctx.role, ctx.capabilities, 'module_X')` + `hasModuleEntitlement(ctx.org, 'module_X')` before action-level checks |
| Page component guard | `app/[orgSlug]/admin/[module]/page.tsx` | After `useOrg()`, if `!hasCapability(userRole, userCapabilities, 'module_X')` → render `<AccessDenied />` |
| Sidebar nav item | `AdminSidebar.tsx` | Add section detection (`pathname.startsWith(base/[module-slug])`) + nav group, gated by `hasCapability` |
| Hub tile | `app/[orgSlug]/admin/page.tsx` | Add tile entry with `hasCapability` gate — already has placeholder slots for all 4 reserved modules |
| Org admin layout passthrough | `app/[orgSlug]/admin/[module]/layout.tsx` | Minimal passthrough layout; `OrgProvider` + `TournamentProvider` already in parent `admin/layout.tsx` |

**Testing module gating (owner cannot test their own revocation):**
1. As owner: Manage modal → Capability Overrides → Module Access → set module to Revoke → Save
2. Sign in as that admin in an incognito session
3. Confirm the hub tile is hidden and the direct URL renders the access-denied state

Source: MODULE_CAPABILITIES_PLAN.md §Enforcement Pattern, §Phase B

---

## Phase 3 — `module_public_site` (Lowest Complexity Add-on)

**Goal:** Validate the entire add-on model (plan entitlements, org add-on flag, hub tile, sidebar section, three-layer enforcement) at the lowest complexity point before modules with new roles, new entities, or financial primitives are built.

**Pre-implementation open questions — resolve before writing the plan file:**

| # | Question |
|---|---|
| Q1 | Is this a full content editor (markdown/blocks) or structured fields only (name, hero image, description, links)? |
| Q2 | Does tournament/schedule data appear automatically on the public page, or is the public site manually curated? |
| Q3 | Custom domain option, or always `fieldlogichq.ca/[orgSlug]`? |

**Required plan file:** `PUBLIC_SITE_MODULE_PLAN.md`

**Scope at a glance:**
- Content editor within the existing admin shell under `/admin/public-site/`
- Org-branded public page at `/{orgSlug}/` (or a dedicated route)
- Structured fields: hero image, description, social links; dynamic content from live tournament data
- No new roles, no new entity types, no financial primitives
- First module to exercise `hasModuleEntitlement()` in production

**Module Build Checklist:** Apply all five layers from the standing pattern above.
**Plan Entitlements prerequisite:** Phase 2 must be complete before routes go live.

---

## Phase 4 — `module_accounting` (Financial Backbone)

**Goal:** Build the org's own financial management layer before house league and rep team modules need it. Designing financial primitives once as a shared module avoids each later module building incompatible implementations.

**Pre-implementation open questions — resolve before writing the plan file:**

| # | Question |
|---|---|
| Q1 | Does FieldLogicHQ facilitate payment collection (Stripe Connect), or does accounting just track payments made outside the platform? |
| Q2 | What roles manage accounting — owner-only, or a designatable `treasurer` role? (If treasurer: triggers role model expansion C2) |
| Q3 | Is reporting org-level only, or also per-module (tournament P&L, season P&L)? |
| Q4 | Is this standalone in Phase 4, or must it integrate with house league and rep team to auto-generate invoices? |

**Required plan file:** `ACCOUNTING_MODULE_PLAN.md`

**Scope at a glance:**
- Income/expense ledger scoped to the org
- Team invoicing tools (initially manual; later auto-generated from league/rep registrations)
- Basic reporting (org-level summary, per-module P&L)
- Payment reconciliation tracking
- Distinction from `billing` cap must be clear in UI copy: `billing` = FieldLogicHQ charges the org; accounting = the org's own money

**Dependencies:** Phase 2 (plan entitlements), Phase 3 (public site validates the add-on model end-to-end)

---

## Phase 5 — `module_house_league` (Recreational League Management)

**Goal:** Add seasonal recreational league management — the first module introducing new entity types (season, individual registration), new roles, and public-facing registration forms.

**Pre-implementation open questions — resolve before writing the plan file:**

| # | Question |
|---|---|
| Q1 | Is a "season" the structural equivalent of a tournament, or a fundamentally different entity? |
| Q2 | Does the org collect registration fees through FieldLogicHQ (Stripe Connect) or externally? |
| Q3 | Are there parent/guardian records linked to player registrations? (Registrants are often minors) |
| Q4 | What roles does this module introduce? Options: `league_admin` (manages whole season), `league_registrar` (registrations/waitlists only), or existing model is sufficient. |
| Q5 | Multi-division support: can a player register for multiple age groups? What happens when a division is full? |
| Q6 | Does `module_communications` remain cross-cutting, or does house league need its own scoped comms cap? (C3) |

**Required plan file:** `HOUSE_LEAGUE_MODULE_PLAN.md`

**Scope at a glance:**
- Season entity + lifecycle (registration open → draft → active → past)
- Individual player registration with waitlists and division capacity controls
- Team placement / draft tools
- League scheduling, standings, results
- Public registration forms (designed here as a shared pattern — see C5)
- Each season's history appears as "Past Seasons" within the house league module sidebar
- First module to trigger role model expansion (C2) if new roles are introduced

**Dependencies:** Phase 2 (plan entitlements), Phase 4 (accounting for fee collection), C5 (public registration forms — design once here)
**Cross-cutting decisions triggered:** C2 (role model expansion), C3 (communications architecture), C5 (public registration forms)

---

## Phase 6 — `module_rep_teams` (Competitive Team Management)

**Goal:** Add competitive team program management — the most complex module, introducing persistent team entities, a coaches portal, player documents, and the deepest integration with accounting and scheduling.

**Pre-implementation open questions — resolve before writing the plan file:**

| # | Question |
|---|---|
| Q1 | Coaches portal: a role-based view within the existing admin shell, or a separate route tree (`/[orgSlug]/coaches/`) with its own layout? |
| Q2 | Are teams sport-agnostic or initially softball/baseball specific? |
| Q3 | Are teams persistent year-round entities or recreated each season? |
| Q4 | How are tryouts managed: public registration form, or invite/coach-managed? |
| Q5 | What level of file storage is required for documents? (Supabase Storage not yet wired into the app) |
| Q6 | How granular is accounting integration: per-team ledger, or just invoice generation? |
| Q7 | Parent/guardian communications — in-app messaging or email only? |

**Required plan file:** `REP_TEAMS_MODULE_PLAN.md`

**Scope at a glance:**
- Persistent team entities (not recreated per season)
- Coaches portal: role-based view or separate route tree (answer Q1 in plan file)
- Tryout management: public registration → admin review queue → offer/decline
- Roster management with player documents via Supabase Storage (first use — C4)
- Parent/guardian communications
- Accounting integration for team invoicing (dues, tournament fees)
- Possible shared scheduling components with house league
- Each team's history appears within the rep teams module section
- Triggers "Site User Admin" evolution: coach role scoped to specific teams (team-level scope assignment)

**Dependencies:** Phase 2 (plan entitlements), Phase 4 (accounting), Phase 5 (may share scheduling), C2 (role model expansion for `coach` role), C4 (Supabase Storage), C5 (public registration forms)
**Cross-cutting decisions triggered:** C2 (role model — `coach`), C4 (file storage)

---

## Cross-Cutting Architectural Decisions (C2–C5)

These span multiple modules. Each must be resolved at the trigger point listed, not earlier.

| ID | Decision | Trigger | Status |
|----|----------|---------|--------|
| C2 | Role model expansion — how new roles (`coach`, `league_admin`, `treasurer`) are added to `OrgRole` type and `ROLE_DEFAULTS` | Before any module introducing a new role (likely House League or Rep Teams) | Open — design during that module's plan phase |
| C3 | Communications architecture — does `module_communications` remain cross-cutting or split into per-module caps as house league and rep teams add comms tools? | House League plan phase | Open — do not split prematurely |
| C4 | File storage — Supabase Storage wiring for rep team player documents, waivers, medical forms | Rep Teams plan phase | Open — design the storage pattern (bucket structure, RLS policies, upload API) once as part of the rep teams plan |
| C5 | Public registration forms — shared pattern for public-facing forms (house league player registration, rep team tryout signups) that work without a login, collect payment, and feed into the module | House League plan phase | Open — design as a shared capability during house league plan; both modules need this |

---

## Deferred / Dropped Items

These items from prior plans have been resolved as no-build.

| Item | Source | Resolution |
|---|---|---|
| 5B.1 — Ownership transfer | PLATFORM_IMPROVEMENTS_PLAN.md | D-4 resolved as support-only. The "contact support" note in the Role Guide stands. No engineering work. |
| 5D.1 — Pending invite seat exclusion | PLATFORM_IMPROVEMENTS_PLAN.md | D-5 resolved as "pending invites count." This task is a no-op. |
| 5G.2 — Automated org deletion | PLATFORM_IMPROVEMENTS_PLAN.md | D-6 resolved as manual. The "Request Account Deletion" form (5G.1, already built) is the full solution. |
| Hub nav step 1.5 — move archives to `org/archives/` | ADMIN_HUB_NAVIGATION_PLAN.md | Design decision: archives are per-module. Tournament archives stay at `admin/archives/` as "Past Tournaments" in the tournament operations sidebar. Future modules each get their own history section. |

---

## Open Business Decisions (Module-Level)

| ID | Decision | Status |
|----|----------|--------|
| D-M1 | Which modules are core (all plans) vs. add-on (purchasable)? | Open — define full feature scope of each module first; pricing follows functionality. Revisit after each module has its plan file. |
| D-M2 | Add-on pricing model — flat monthly per add-on, bundled tiers, or both? | Open — follows D-M1. No implementation impact until first reserved module build. |
| D-M3 | What roles does each new module introduce? | Open — define roles per module during that module's plan phase. |
| D-M4 | How does the User Admin area evolve as module-specific roles are added (e.g., coach scoped to a specific team)? | Direction set — the Phase A capability foundation is the correct starting point. Full module-scoped role assignment (team-level, league-level) is deferred to the rep teams plan phase. |
| D-M5 | How does `module_accounting` relate to the existing `billing` action cap? | Resolved — `billing` = FieldLogicHQ charges the org (Stripe subscription). `module_accounting` = the org's own financial operations. Entirely separate concerns. |

---

## Recommended Build Order

| Phase | Goal | Effort | Key Dependency |
|---|---|---|---|
| 1 | Archives B2 back-to-admin link | ~30 min | None |
| 2 | Plan entitlements architecture | ~1 hour | None — do before any reserved module |
| 3 | `module_public_site` | ~2–3 days | Phase 2 + plan file |
| 4 | `module_accounting` | ~3–5 days | Phase 2 + plan file |
| 5 | `module_house_league` | ~1–2 weeks | Phases 2 + 4 + plan file + C5 design |
| 6 | `module_rep_teams` | ~2–3 weeks | Phases 2 + 4 + 5 + plan file + C2/C4/C5 |
