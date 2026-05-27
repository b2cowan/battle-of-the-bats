> **DEPRECATED** — Superseded by [PLATFORM_ROADMAP.md](../../PLATFORM_ROADMAP.md). Phase A complete; Phase B standing pattern documented in the roadmap's Module Build Checklist. This file is retained for historical context only.

# Module-Level Capabilities Plan (2A)

Implements the `module_*` capability tier from the Platform Improvements Plan. Covers the foundation needed now and the per-module pattern to follow when each new module is built.

Reference: `PLATFORM_IMPROVEMENTS_PLAN.md` §2A

---

## Status Legend
- [ ] Not started
- [x] Complete

---

## Background and Motivation

### Current state
The capability system is **action-scoped** (e.g. `create_tournaments`, `manage_members`). There is no coarser gate that says "this member cannot see or use the Tournaments module at all." Without module-level capabilities, every capability inside a module must be individually revoked to block access — fragile and easy to miss when new capabilities are added.

### Product vision
FieldLogicHQ is expanding beyond tournament management into a multi-module platform for sports organizations. Modules will be selectively enabled per organization based on their subscription plan and optional add-ons. The `module_*` capability tier provides the access control foundation for this model:

- Each product area gets a single boolean gate per member.
- If a member lacks `module_house_league`, they cannot access any house league pages or API routes regardless of their action capabilities.
- Modules the org hasn't purchased are unavailable to all members, regardless of role — plan entitlement is checked at the org level before per-member capabilities are evaluated.
- This system is additive: existing action capability checks are unchanged.

---

## Module Catalog

All modules defined for this platform. Modules marked **Reserved** have no routes or sidebar items yet — the capability name is defined now to prevent naming ambiguity as the platform grows.

| Capability | Product Area | Scope | Plan Availability | Status |
|---|---|---|---|---|
| `module_tournaments` | Tournament lifecycle, schedule, results, age groups, contacts, rules | All current admin Tournament section | Core — all plans | Active (Phase A) |
| `module_communications` | Announcements, email communications | Cross-module comms tools | Core — all plans | Active (Phase A) |
| `module_members` | Members management (invite, suspend, remove, cap overrides) | Org admin Members section | Core — all plans | Active (Phase A) |
| `module_public_site` | Public website / landing page editor for the org | Org-branded public presence | Add-on | Reserved |
| `module_accounting` | Financial tracking, invoicing, payment collection for teams/registrations | Org financial management | Add-on | Reserved |
| `module_house_league` | House league season management: registrations, team placement, scheduling | Season-long recreational league ops | Add-on | Reserved |
| `module_rep_teams` | Rep/travel team management: coaches portal, rosters, tryouts, documents, accounting links | Competitive team program ops | Add-on | Reserved |

**Note on `module_communications`:** Today this covers tournament-scoped announcements and email blasts. As house league and rep team modules are built, communication tools scoped to those modules may need to be split out (e.g., house league newsletters, rep team parent comms). Evaluate at build time whether `module_communications` remains cross-cutting or is replaced by per-module comms caps.

### Module scope notes and open questions

Each reserved module requires a dedicated plan file before implementation begins. These are the questions that must be resolved before writing that plan file — not during implementation.

**`module_public_site`**
Scope: org-branded public landing page editor within the admin shell — custom hero, org description, social links, tournament listing, registration CTAs.
- Is this a full content editor (markdown/blocks) or structured fields only (name, hero image, description, links)?
- Does the org's existing tournament/schedule data appear automatically, or is the public site manually curated?
- Is there a custom domain option, or always `fieldlogichq.ca/[orgSlug]`?

**`module_accounting`**
Scope: the org's own financial layer — income/expense tracking, team invoicing (rep teams, house league), payment reconciliation, reporting. Distinct from `billing` (Stripe subscription management).
- Does FieldLogicHQ facilitate payment collection (Stripe Connect), or does accounting just track payments made outside the platform?
- What roles manage accounting — owner-only, or a designatable `treasurer` role?
- Is reporting org-level only, or also per-module (tournament P&L, season P&L)?
- Is this standalone or must it integrate with house league and rep team modules to auto-generate invoices from registrations?

**`module_house_league`**
Scope: seasonal recreational league management — individual player registration, waitlists, team placement/draft, league scheduling, standings, results. Different model from tournaments: ongoing seasons, individuals register (not teams).
- Is a "season" (Fall 2024, Winter 2025) the structural equivalent of a tournament, or a different entity?
- Does the org collect registration fees through FieldLogicHQ (Stripe Connect) or externally?
- Are there parent/guardian records linked to player registrations? (registrants are often minors)
- What roles does this module introduce? Options: `league_admin` (manages whole season), `league_registrar` (handles registrations/waitlists only), or existing admin/staff model is sufficient.
- Multi-division support: can a player register for multiple age groups? What happens when a division is full?

**`module_rep_teams`**
Scope: competitive team program management — coaches portal (separate UX from admin shell), persistent team entities, rosters, tryout management, player documents (waivers, medical), season scheduling, accounting integration for team invoicing.
- Is the coaches portal a role-based view within the existing admin shell, or a fully separate route tree (`/[orgSlug]/coaches/`) with its own layout?
- Are teams sport-agnostic or initially softball/baseball specific?
- Are teams persistent year-round entities or recreated each season?
- How are tryouts managed: public registration form, or invite/coach-managed?
- What level of file storage is required for documents? (Supabase Storage not yet wired into the app)
- How granular is accounting integration: per-team ledger, or just invoice generation?
- Parent/guardian communications — in-app messaging or email only?

---

## Recommended Implementation Order

| Order | Module | Rationale |
|---|---|---|
| 1 | Phase A foundation | Unblocks everything; ~65 min, no risk, no migrations |
| 2 | `module_public_site` | Validates the add-on model with the lowest-complexity module; no new roles or role model changes, no financial primitives, editor lives entirely in the existing admin shell |
| 3 | `module_accounting` | Shared financial dependency for house league and rep teams; better to design once as a standalone module than have both later modules build their own financial primitives independently |
| 4 | `module_house_league` | Individual registration is a new pattern; needs accounting for fee collection; seasonal league model introduces new entity types before the more complex rep team structure |
| 5 | `module_rep_teams` | Most complex; needs accounting (team invoicing); may share scheduling components with house league; triggers the Site User Admin redesign and the coaches portal decision |

---

## Cross-Cutting Architectural Decisions

These decisions span multiple modules and must be resolved before the module that first triggers them is built. None are prerequisites for Phase A.

| ID | Decision | Trigger point | Notes |
|----|----------|---------------|-------|
| C1 | Plan entitlement implementation — `moduleEntitlements` in `PlanConfig`, `enabled_addons` column on `organizations`, `hasModuleEntitlement()` helper | Before any reserved module's routes go live (Public Site build) | Architecture is already sketched in the Plan Entitlements section above; no design work needed, just implementation |
| C2 | Role model expansion — how new roles (`coach`, `league_admin`, `treasurer`) are added to the `OrgRole` type and `ROLE_DEFAULTS` | Before any module introducing a new role (likely House League or Rep Teams) | Recommendation: extend `OrgRole` with new values as needed; the existing capability system already handles per-role defaults and no new infrastructure is required |
| C3 | Communications architecture — does `module_communications` remain a cross-cutting cap or split into per-module comms caps as house league and rep teams add their own email/messaging tools? | House League plan phase | Do not split prematurely; evaluate at house league plan time based on whether comms tools are truly module-specific or shared |
| C4 | File storage — Supabase Storage wiring for rep team player documents, waivers, medical forms | Rep Teams plan phase | Supabase Storage exists but hasn't been used yet; design the storage pattern once (bucket structure, RLS policies, upload API) as part of the rep teams plan rather than bolting it on per-feature |
| C5 | Public registration forms — a shared pattern for public-facing forms (house league player registration, rep team tryout signups) that work without a login, collect payment, and feed into the relevant module | House League plan phase | Both house league and rep teams need this; design as a shared capability during the house league plan rather than each module building its own form system |

---

## Plan Entitlements Architecture

### Two-axis access control

Access to a module requires passing **both** checks:

1. **Org-level entitlement** — does this org's plan or add-on set include this module?
2. **Per-member capability** — does this member have the `module_X` capability (via role default or owner override)?

An org on Starter cannot access `module_house_league` even if an owner manually grants that cap to a member. A plan check is the outer gate.

### Core vs. add-on modules

| Module | Core (included in base plan) | Add-on (purchasable separately) |
|---|---|---|
| `module_tournaments` | ✓ All plans | — |
| `module_communications` | ✓ All plans | — |
| `module_members` | ✓ All plans | — |
| `module_public_site` | — | ✓ |
| `module_accounting` | — | ✓ |
| `module_house_league` | — | ✓ |
| `module_rep_teams` | — | ✓ |

> **Business decision required (D-M1):** Confirm which modules are core vs. add-on and what the add-on price points are. Recommendation above is a starting point only. See [Business Decisions Required](#business-decisions-required).

### Plan config changes (deferred to first new module build)

Before any reserved module's routes are built, add `moduleEntitlements` to `PlanConfig` in `lib/plan-config.ts`:

```ts
export interface PlanConfig {
  // ... existing fields ...
  moduleEntitlements: Capability[];  // modules included in base plan
}
```

Add-on enablement requires a schema addition to track which add-ons an org has purchased:

```sql
-- Future migration (do not add now)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS enabled_addons jsonb NOT NULL DEFAULT '[]';
```

A combined entitlement helper will then be used in all module route handlers:

```ts
// lib/module-entitlements.ts (future — do not create now)
export function hasModuleEntitlement(
  org: Organization,
  cap: Capability,
): boolean {
  const plan = PLAN_CONFIG[org.planId];
  if (plan.moduleEntitlements.includes(cap)) return true;
  const addons: string[] = (org as any).enabledAddons ?? [];
  return addons.includes(cap);
}
```

Phase A does not implement this helper — it is a prerequisite for the first reserved module build.

---

## Default-On vs. Default-Off Policy

**Default-on** — add to `ROLE_DEFAULTS` for appropriate roles:
- Use when the module covers functionality the role already had.
- Existing admins/staff get the cap automatically at deploy — no data migration, no regression.
- Applies to: `module_tournaments`, `module_communications`, `module_members`.

**Default-off** — do NOT add to `ROLE_DEFAULTS`:
- Use when the module covers new premium functionality.
- The feature doesn't exist yet; no existing members had access.
- Access requires plan entitlement + explicit owner grant.
- Applies to: `module_public_site`, `module_accounting`, `module_house_league`, `module_rep_teams`.

**Rule for future modules:** if the module covers functionality a role already had → default-on. If it is a new premium feature → default-off. Do not add a new premium module to `ROLE_DEFAULTS` and inadvertently give it away on all plans.

Note: owners always pass `hasCapability` regardless of `ROLE_DEFAULTS` (the `if (role === 'owner') return true` short-circuit in `lib/roles.ts`). Default-on/off policy applies to admin, staff, and official only.

---

## Enforcement Pattern (all three layers required)

Every module must be enforced at all three layers. Missing any one layer creates a gap:

| Layer | Where | Method | Gap if missing |
|---|---|---|---|
| 1. Route handler | `app/api/...` | `hasCapability(ctx.role, ctx.capabilities, 'module_X')` + plan entitlement check | API is accessible; data is exposed |
| 2. Page component | `app/[orgSlug]/admin/...` | `hasCapability(userRole, userCapabilities, 'module_X')` → render `<AccessDenied />` | Direct URL navigation shows broken page (all API calls 403 but shell renders) |
| 3. Sidebar nav item | `AdminSidebar.tsx` | `hasCapability(userRole, userCapabilities, 'module_X')` → conditional render | Link is hidden but URL is accessible; not a security gap but a UX one |

**Pattern for the page-level check (layer 2):**

```tsx
// At top of page component, after loading
const { userRole, userCapabilities, loading } = useOrg();

if (!loading && !hasCapability(userRole ?? 'official', userCapabilities, 'module_house_league')) {
  return (
    <div className={styles.page}>
      <div className={styles.accessDenied}>
        <Lock size={32} />
        <h2>Module Not Available</h2>
        <p>Your account does not have access to House League Management.</p>
      </div>
    </div>
  );
}
```

**Avoid the redundant-query trap:** Route handlers that already call `getAuthContextWithScope()` should use `hasCapability(ctx.role, ctx.capabilities, 'module_X')` directly — do NOT call `requireCapability(ctx, 'module_X')` afterward, as that function issues a second identical DB query.

```ts
// CORRECT — reuse the already-fetched scope context
const ctx = await getAuthContextWithScope();
if (!ctx) return unauthorized();
if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
// ...plan entitlement check here when module is built...

// WRONG — fires a redundant DB query
const ctx = await getAuthContextWithScope();
const guard = await requireCapability(ctx, 'module_house_league');  // ← extra round-trip
if (guard) return guard;
```

---

## What Changes Now vs. When a Module is Built

**Build now (Phase A — foundation):**
- 2A.1 — Add all 7 module capabilities to `lib/roles.ts` (Capability union + ROLE_DEFAULTS for default-on modules only)
- 2A.2 — Expose in capability override UI with section grouping
- 2A.4.a — Add `userCapabilities` to `OrgContext`

**Build when each new module is added (Phase B):**
- 2A.3 — Gate the module's route handlers (capability + plan entitlement)
- 2A.4.b — Gate the sidebar nav item
- 2A.4.c — Gate the page component (access-denied render)
- Also: add `moduleEntitlements` to `PlanConfig` and `enabled_addons` schema if this is the first add-on module

---

## Phase A — Foundation (build now)

### [x] 2A.1 — Add module capabilities to `lib/roles.ts`

**File:** `lib/roles.ts`

Extend the `Capability` union to include all 7 module caps:

```ts
export type Capability =
  // --- existing action capabilities ---
  | 'create_tournaments'
  | 'manage_registrations'
  | 'manage_schedule_structure'
  | 'update_schedule'
  | 'submit_scores'
  | 'manage_contacts'
  | 'post_announcements'
  | 'post_rules'
  | 'send_communications'
  | 'seal_tournaments'
  | 'manage_members'
  | 'org_settings'
  | 'billing'
  // --- module-level gates (coarser, checked before action caps) ---
  // Default-on: cover existing functionality
  | 'module_tournaments'
  | 'module_communications'
  | 'module_members'
  // Default-off: reserved for future premium modules (no ROLE_DEFAULTS entry)
  | 'module_public_site'
  | 'module_accounting'
  | 'module_house_league'
  | 'module_rep_teams';
```

Update `ROLE_DEFAULTS` — add **only the three default-on modules** to the appropriate roles. Do not add `module_public_site`, `module_accounting`, `module_house_league`, or `module_rep_teams` to any role's defaults:

```ts
owner: new Set<Capability>([
  // all existing action caps...
  'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
  'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
  'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  'org_settings', 'billing',
  // default-on module caps
  'module_tournaments', 'module_communications', 'module_members',
]),
admin: new Set<Capability>([
  'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
  'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
  'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  // default-on module caps
  'module_tournaments', 'module_communications', 'module_members',
]),
staff: new Set<Capability>([
  'update_schedule', 'submit_scores', 'post_announcements',
  // default-on module cap
  'module_tournaments',
]),
official: new Set<Capability>(['submit_scores']),
```

**Why owner's ROLE_DEFAULTS omits the add-on modules:** The `if (role === 'owner') return true` short-circuit in `hasCapability()` means owners always pass any capability check. Adding reserved caps to owner's `ROLE_DEFAULTS` is only cosmetic (affects the "Role default" display column in the cap override table, which is never shown for owners). Keeping them out makes the intent explicit: add-on modules require org-level entitlement, not just role default.

**No schema change.** The `capabilities` column in `organization_members` is `jsonb` and already stores arbitrary string keys.

---

### [x] 2A.2 — Add module capabilities to the cap override UI

**File:** `app/[orgSlug]/admin/members/page.tsx`

Add all 7 module capabilities to `CAPABILITY_LABELS`:

```ts
const CAPABILITY_LABELS: Record<Capability, string> = {
  // --- Module access ---
  module_tournaments:    'Tournament management access',
  module_communications: 'Communications access',
  module_members:        'Member management access',
  module_public_site:    'Public website access',
  module_accounting:     'Accounting access',
  module_house_league:   'House league management access',
  module_rep_teams:      'Rep team management access',
  // --- existing action capabilities ---
  create_tournaments:        'Create / delete tournaments',
  manage_registrations:      'Manage registrations',
  manage_schedule_structure: 'Manage schedule & brackets',
  update_schedule:           'Update game times & diamonds',
  submit_scores:             'Submit & finalize scores',
  manage_contacts:           'Manage contacts & diamonds',
  post_announcements:        'Post announcements',
  post_rules:                'Post / edit rules documents',
  send_communications:       'Send email communications',
  seal_tournaments:          'Seal tournament (archive)',
  manage_members:            'Manage members',
  org_settings:              'Org settings & branding',
  billing:                   'Billing & subscription',
};
```

Split `CAPABILITY_KEYS` into two ordered groups:

```ts
const MODULE_CAP_KEYS: Capability[] = [
  'module_tournaments', 'module_communications', 'module_members',
  'module_public_site', 'module_accounting', 'module_house_league', 'module_rep_teams',
];
const ACTION_CAP_KEYS: Capability[] = [
  'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
  'update_schedule', 'submit_scores', 'manage_contacts', 'post_announcements',
  'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  'org_settings', 'billing',
];
```

In the cap table `<tbody>`, replace the single `{CAPABILITY_KEYS.map(...)}` with two groups separated by section header rows:

```tsx
<>
  {/* Section: Module Access */}
  <tr>
    <td colSpan={3} style={{ /* section divider style */ }}>Module Access</td>
  </tr>
  {MODULE_CAP_KEYS.map(cap => {
    const roleDefault = ROLE_DEFAULTS[manageDraftRole as OrgRole]?.has(cap);
    const currentValue = getCapValue(cap);
    return (
      <tr key={cap}>
        <td>
          {CAPABILITY_LABELS[cap]}
          {/* Warn on high-blast-radius module revocations */}
          {cap === 'module_tournaments' && currentValue === 'revoke' && (
            <div style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '0.2rem' }}>
              Removes access to all tournament pages for this member.
            </div>
          )}
        </td>
        <td style={{ textAlign: 'center' }}>
          {roleDefault
            ? <span className={styles.matrixCheck}>✓</span>
            : <span className={styles.matrixDash}>—</span>}
        </td>
        <td style={{ textAlign: 'right' }}>
          <select
            className={styles.capSelect}
            value={currentValue}
            onChange={e => setCapValue(cap, e.target.value as 'grant' | 'revoke' | 'default')}
            aria-label={`Override ${CAPABILITY_LABELS[cap]}`}
          >
            <option value="default">Role default</option>
            <option value="grant">Grant</option>
            <option value="revoke">Revoke</option>
          </select>
        </td>
      </tr>
    );
  })}

  {/* Section: Action Capabilities */}
  <tr>
    <td colSpan={3} style={{ /* section divider style */ }}>Action Capabilities</td>
  </tr>
  {ACTION_CAP_KEYS.map(cap => /* same row renderer as above */)}
</>
```

Section header row style: `padding: 0.35rem 0.75rem`, `fontSize: 0.6rem`, `fontWeight: 700`, `letterSpacing: 0.1em`, `textTransform: uppercase`, `color: var(--white-20)`, `background: var(--bg-3, rgba(255,255,255,0.03))`, `borderTop: 1px solid var(--border)`, no `cursor`.

**Also update the page-level access guard** — currently `members/page.tsx` checks `userRole !== 'owner' && userRole !== 'admin'`. Once Phase A ships, this should use the module cap so explicitly revoked admins are also blocked:

```tsx
// Replace the existing role-only check with a capability check
if (!loading && !hasCapability(userRole ?? 'official', userCapabilities, 'module_members')) {
  return (
    <div className={styles.page}>
      <div className={styles.accessDenied}>
        <Users2 size={32} className={styles.accessDeniedIcon} />
        <h2>Access Denied</h2>
        <p>Only organization owners and admins can manage members.</p>
      </div>
    </div>
  );
}
```

Import `hasCapability` from `@/lib/roles` and destructure `userCapabilities` from `useOrg()`.

---

### [x] 2A.4.a — Expose `userCapabilities` in OrgContext

**File:** `lib/org-context.tsx`

The `AdminSidebar` currently knows only the user's `role` (from `useOrg()`). For sidebar and page-level module gating, it needs the `capabilities` override object so `hasCapability()` can be called client-side.

**Changes:**

1. Add to `OrgContextType`:
```ts
userCapabilities: Record<string, boolean> | null;
```

2. Add state in `OrgProvider`:
```ts
const [userCapabilities, setUserCapabilities] = useState<Record<string, boolean> | null>(null);
```

3. Update the `load` function — extend the existing select to include the `capabilities` column:
```ts
const { data: memberData } = await supabase
  .from('organization_members')
  .select('role, capabilities, organizations(*)')  // add capabilities
  .eq('user_id', authUser.id)
  .single();

// ...after setting role:
setUserCapabilities((memberData as any)?.capabilities ?? null);
```

4. Clear on logout:
```ts
setUserCapabilities(null);
```

5. Add to `OrgContext.Provider value`:
```ts
value={{ user, currentOrg, userRole, userCapabilities, loading, refresh }}
```

**Impact:** All existing consumers of `useOrg()` are unaffected (new field, backward-compatible). The `AdminSidebar` and page components can now call `hasCapability(userRole, userCapabilities, 'module_X')` without an additional fetch.

---

## Phase B — Per-Module Steps (implement with each new module)

These are not tasks to build now — they are the required checklist when any new admin module is added. All three layers must be implemented together.

### 2A.3 — Gate the module's API routes

In the module's route handler, after `getAuthContextWithScope()`, add the module cap check **before** any action-level checks. Reuse the already-fetched context — do not call `requireCapability()`:

```ts
const ctx = await getAuthContextWithScope();
if (!ctx) return unauthorized();

// Layer 1: module cap check (per-member)
if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();

// Layer 1b: plan entitlement check (org-level) — implement once hasModuleEntitlement() exists
// if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();

// Then: action-level caps, scope guards, business logic...
```

### 2A.4.b — Gate the module's sidebar nav item

In `AdminSidebar.tsx`, when adding a new entry to `ORG_NAV` or `TOURNAMENT_NAV`:

```ts
const { userRole, userCapabilities } = useOrg();

// In the nav renderer:
{hasCapability(userRole ?? 'official', userCapabilities, 'module_house_league') && (
  navLink('house-league', Users, 'House League', `${base}/house-league`, pathname.startsWith(`${base}/house-league`))
)}
```

Import `hasCapability` from `@/lib/roles` in the sidebar.

### 2A.4.c — Gate the module's page component

At the top of the page component, after `useOrg()`, render an access-denied state if the user lacks the module cap:

```tsx
const { userRole, userCapabilities, loading } = useOrg();

if (!loading && !hasCapability(userRole ?? 'official', userCapabilities, 'module_house_league')) {
  return (
    <div className={styles.page}>
      <div className={styles.accessDenied}>
        <Lock size={32} className={styles.accessDeniedIcon} />
        <h2>Access Denied</h2>
        <p>You do not have access to House League Management.</p>
      </div>
    </div>
  );
}
```

This prevents a broken UI when a user navigates directly to the URL with no sidebar link visible.

### Testing module gating

Because `hasCapability()` short-circuits to `true` for the `owner` role, owners cannot test module revocation on their own account. Test path:
1. As owner, open Manage modal for an admin member.
2. In Capability Overrides → Module Access, set the target module to `Revoke`. Save.
3. Sign in as that admin in a separate browser/incognito session.
4. Confirm the sidebar link is hidden and the direct URL shows the access-denied state.

---

## Build Order (Phase A)

| Step | Task | File(s) | Effort |
|---|---|---|---|
| 1 | 2A.1 — Extend Capability type + ROLE_DEFAULTS | `lib/roles.ts` | ~10 min |
| 2 | 2A.2 — CAPABILITY_LABELS + grouped cap table + update page guard | `app/[orgSlug]/admin/members/page.tsx` | ~40 min |
| 3 | 2A.4.a — Add userCapabilities to OrgContext | `lib/org-context.tsx` | ~15 min |

Total estimated effort: ~65 min. No migrations required. No breaking changes.

---

## Business Decisions Required

| ID | Decision | Status | Resolution |
|----|----------|--------|------------|
| D-M1 | Which modules are core (included in all plans) vs. add-on (purchasable)? | 🔜 Deferred | Define the full feature scope of each module first, then determine packaging. Pricing and tier assignments follow functionality, not the other way around. Revisit after each module has its own plan file. |
| D-M2 | What is the add-on pricing model — flat monthly per add-on, bundled tiers, or both? | 🔜 Deferred | Follows D-M1. No implementation impact until the first reserved module build. |
| D-M3 | What roles does each new module introduce (e.g., `league_admin` for house league, `coach` for rep teams)? | 🔜 Deferred | Define roles per module during that module's plan phase. The existing 4-role model (owner/admin/staff/official) is tournament-centric and will need to expand. Each new module plan must include a roles section before implementation begins. |
| D-M4 | How should the User Admin area evolve as modules and module-specific roles are added? | ✅ Direction set | The current Members page is tournament-adjacent framing. Long-term, org-level user management becomes a standalone "Site User Admin" where owners assign users to modules and module-specific roles (e.g., coach role scoped to the U13 Senior team). The Phase A capability foundation (module caps + per-member overrides) is the correct starting point. Full module-scoped role assignment (team-level, league-level) is deferred to the rep team plan phase when a `coach` role is designed. No architectural change needed before that. |
| D-M5 | How does `module_accounting` relate to the existing `billing` action cap? | ✅ Resolved | `billing` = FieldLogicHQ charges the org (Stripe subscription management, owner-only). `module_accounting` = the org's own financial operations — tracking income/expenses, invoicing teams for fees, reconciling registration payments. Entirely separate concerns, no overlap. |

### Site User Admin — architectural direction note

The current Members page handles user management within the framing of the tournament admin shell. As the platform adds modules, user management needs to expand to:
- Assigning users to specific modules (already handled by the module cap system being built in Phase A)
- Assigning module-specific roles (coach, league registrar, treasurer) when those modules exist
- Scoping users within a module (coach of the U13 Senior team, not the U11 team) — an extension of the existing tournament assignment system

**The Phase A foundation is correct.** The current members page + module caps + per-member overrides are the right groundwork. The "Site User Admin" evolution is not a separate implementation now — it is what the members page naturally becomes as each module adds its own roles and scope assignments. The structural decision about how to present this in the UI (dedicated top-level section vs. evolved members page) should be revisited when building the first module that introduces a new role (likely rep teams).

---

## Open Questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should `org_settings` and `billing` action capabilities be renamed to `module_settings` / `module_billing`? | No. They pre-date this system, are enforced via `userRole === 'owner'` sidebar checks, and renaming requires a data migration for existing overrides. Keep as-is. |
| Q2 | Should `module_members` gate who can see the Members sidebar link for non-owners? | Yes — after Phase A ships, the page guard uses `hasCapability(userRole, userCapabilities, 'module_members')` which covers both the sidebar and the page for any admin whose module cap is explicitly revoked. |
| Q3 | Should `hasCapability()` automatically check the module cap before action caps? | No. Explicit module cap checks in route handlers are clearer and easier to audit. Do not add implicit chaining. |
| Q4 | Will `module_communications` remain a cross-cutting cap or become per-module? | Evaluate when house league or rep teams are built. If those modules have separate comms tools, split into `module_hl_communications` and `module_rt_communications`. If comms remain a shared tool, the single cap is fine. |

---

## What This Does NOT Change

- Existing action capability behavior — no existing checks are removed or changed
- RLS policies — module gating is app-level only; RLS is unchanged
- The `[memberId]/route.ts` `VALID_CAPABILITIES` set — automatically includes new caps via `ROLE_DEFAULTS` union
- The audit log — module cap changes are stored as `capabilities_changed` events, same as any other cap override
- Plan config — `PlanConfig` in `lib/plan-config.ts` is not changed in Phase A; `moduleEntitlements` is deferred to the first reserved module build
