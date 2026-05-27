# Platform Admin Improvements Plan

## Context & Motivation

The platform admin section at `/platform-admin` currently supports three superuser workflows: viewing global stats, overriding an org's plan and tournament limit, and generating password reset links for users. As FieldLogicHQ adds reserved add-on modules (Phase 3+), customer support complexity increases: superusers need to manage module entitlements, handle billing anomalies, track internal support context, and have a clear view of each org's state.

This plan closes the gap between what exists today and what a FieldLogicHQ superuser needs to troubleshoot client issues effectively.

---

## Decisions Recorded

| # | Question | Decision |
|---|---|---|
| Q1 | `enabled_addons` toggle: hardcoded cap list vs. derived | Hardcoded: `module_public_site`, `module_accounting`, `module_house_league`, `module_rep_teams` |
| Q2 | Comp period storage model | Option B — `org_overrides` table with type, value, expires_at, reason, created_by |
| Q3 | Impersonation / "sign in as org" | Not in scope — troubleshooting via Q&A and help/tooltip improvements |
| Q4 | Subscription status override mechanism | Via `org_overrides` table (same mechanism as comp period, with optional `expires_at`) |
| Q5 | Subscription status override allowed values | All four: `active`, `trialing`, `past_due`, `canceled` — allows extending trial periods |

---

## Gap Analysis

| Gap | Severity | Notes |
|---|---|---|
| No UI for `enabled_addons` | Critical — blocks Phase 3 | Column, type, and helper all exist; management surface completely absent |
| No subscription status override | High — customer-impacting if webhook misfires | Status shown as read-only badge; no way to extend a trial |
| No comp period / billing grace | High — no structured way to comp a client | No data model, no UI, no concept |
| No internal notes per org | Medium | Support context lives nowhere |
| No org drill-down | Medium | Can't see members, tournaments, or entitlements per org from platform-admin |
| Users page has no org context | Medium | Flat list makes support lookups very slow |
| No platform audit log | Medium | Zero record of what superusers changed or when |
| No direct admin jump link | Low | One-click to `/{slug}/admin/`; trivially small fix |
| No search/filter on org table | Low | Fine at current scale; important before 50+ orgs |
| Users page pagination gap | Low | `listUsers({ perPage: 1000 })` silently drops users beyond 1000 |

---

## Phase A — Quick Wins (no migration required)

**Goal:** Unblock `module_public_site` production enablement and add zero-cost ergonomics. Do this session.

### A1 — `enabled_addons` Toggle

**Files:**
- `app/platform-admin/orgs/page.tsx` — add `enabled_addons` to fetched columns; pass through to client
- `app/platform-admin/orgs/OrgsClient.tsx` — add `enabledAddons` to `OrgRow` type; add add-on toggle group per org row
- `app/api/platform-admin/orgs/[id]/addons/route.ts` — new PATCH route

**Behavior:**
- Show the 4 reserved module caps as labeled toggles/checkboxes inline with each org row (collapsible panel or inline toggle group below the existing plan/limit/status controls)
- Labels: "Public Site" (`module_public_site`), "Accounting" (`module_accounting`), "House League" (`module_house_league`), "Rep Teams" (`module_rep_teams`)
- On toggle, PATCH `/api/platform-admin/orgs/[id]/addons` with `{ enabledAddons: string[] }`
- Route writes to `organizations.enabled_addons` (jsonb array) via `supabaseAdmin`
- Stub a `// TODO: write platform_audit_log` comment in the route — fill in once Phase E1 ships
- Route gated by `getPlatformAuthContext()`

**API route signature:**
```
PATCH /api/platform-admin/orgs/[id]/addons
Body: { enabledAddons: string[] }
Auth: getPlatformAuthContext() required
```

### A2 — Direct Admin Link

**Files:**
- `app/platform-admin/orgs/OrgsClient.tsx`

**Behavior:**
- Add an `↗ Admin` link to each org row pointing to `/{org.slug}/admin/`
- Opens in a new tab (`target="_blank"`)
- Lives in the actions cell alongside the existing Save button

---

## Phase B — Users Page Enrichment (no migration required)

**Goal:** Give superusers org context on every user so support lookups take seconds, not minutes.

### B1 — Org membership join

**Files:**
- `app/platform-admin/users/page.tsx` — server-side join `organization_members` → `organizations` using `supabaseAdmin`
- `app/platform-admin/users/UsersClient.tsx` — extend `UserRow` type and table

**New columns added to the table:** Org (name, linked to `/{slug}/admin/`), Role, Member Status (`active` / `suspended` / `invited`)

**Behavior:**
- Join `organization_members` on `user_id`, join `organizations` on `organization_id`, to resolve org name/slug, role, and member status per user
- Users with no org membership row show "—" in the Org column
- All data fetched server-side; no new API route needed

**Note:** The existing `listUsers({ page: 1, perPage: 1000 })` hard limit will silently miss users beyond 1000. Add a `// TODO Phase F2: add pagination` comment at the fetch site.

---

## Phase C — Org Notes & Drill-Down (migration 016 required)

**Goal:** Give superusers a detail view per org and a persistent place to log support context.

### C1 — Internal notes column

**Migration (016):**
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS internal_notes text;
```

**API route:**
```
PATCH /api/platform-admin/orgs/[id]/notes
Body: { notes: string }
Auth: getPlatformAuthContext() required
```

Notes are surfaced on the detail page (C2), not inline in the org table row. The org table can show a "has note" indicator (e.g. a small icon) when `internal_notes` is non-null.

### C2 — Org detail page

**Route:** `/platform-admin/orgs/[id]`

**Files:**
- `app/platform-admin/orgs/[id]/page.tsx` — server component; fetches all sections
- `app/platform-admin/orgs/[id]/OrgDetailClient.tsx` — client component for notes textarea
- `app/api/platform-admin/orgs/[id]/notes/route.ts` — PATCH route

**Page sections (all read-only except notes):**

1. **Identity** — org name, slug, created date, `↗ Admin` link
2. **Plan & Entitlements** — current plan, tournament limit, active add-ons derived from `enabled_addons` + `PLAN_CONFIG.moduleEntitlements`. Read-only here; edit via the org table on the list page.
3. **Active Overrides** — lists `org_overrides` rows that are active and not expired (Phase D data; shows "None" until Phase D ships)
4. **Members** — `organization_members` joined with `auth.users`: display name, email, role, status, last sign-in
5. **Active Tournaments** — non-archived tournaments for this org (name, status, start/end date)
6. **Internal Notes** — editable textarea; saves via PATCH to `/api/platform-admin/orgs/[id]/notes`

**Navigation:**
- "← Organizations" back-link at the top
- Add a "View →" button to each org row in the org table linking to `/platform-admin/orgs/[id]`

---

## Phase D — Billing Grace / Subscription Overrides (migration 017 required)

**Goal:** Give superusers a structured, auditable way to comp a module, extend a trial, or override subscription status, with optional expiry.

### D1 — `org_overrides` migration

**Migration (017):**
```sql
CREATE TABLE org_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('subscription_status', 'comp_period')),
  value       text,
  expires_at  timestamptz,
  reason      text        NOT NULL,
  created_by  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  revoked_by  text
);

CREATE INDEX idx_org_overrides_org ON org_overrides(org_id, created_at DESC);
```

**Override types:**
- `subscription_status` — `value` is one of `'active' | 'trialing' | 'past_due' | 'canceled'`. Applied by writing to `organizations.subscription_status` AND recording the override entry for history and expiry tracking.
- `comp_period` — marks the org as explicitly comped for a defined period. `value` is an optional label (e.g., "Pro plan comped per owner agreement"). Typically paired with a `subscription_status = active` override.

**Expiry enforcement:**
Use the **lazy check** approach: when assembling the `Organization` object in `getAuthContext()`, query `org_overrides` for any active, non-expired, non-revoked records and apply them. The query is indexed on `org_id` and the table will be sparse, so the overhead is acceptable at current scale. Add a TODO comment to revisit if auth context latency becomes a concern.

### D2 — Override API routes

All routes gated by `getPlatformAuthContext()`.

```
POST   /api/platform-admin/orgs/[id]/overrides        — create override
DELETE /api/platform-admin/orgs/[id]/overrides/[oid]  — revoke (sets revoked_at, revoked_by)
GET    /api/platform-admin/orgs/[id]/overrides         — list all (active + historical)
```

**POST body:**
```ts
{
  type: 'subscription_status' | 'comp_period';
  value?: string;       // required for subscription_status; the new status value
  expires_at?: string;  // ISO datetime; omit for permanent
  reason: string;       // required; free text
}
```

On `subscription_status` create: write `value` to `organizations.subscription_status` then insert the override record.
On revoke: set `revoked_at = now()`, `revoked_by = superuser email`. If type was `subscription_status`, do NOT automatically revert `organizations.subscription_status` — superuser must set a new override or let the next Stripe webhook normalize it.

### D3 — Override panel in org detail page

**Location:** "Active Overrides" section in `/platform-admin/orgs/[id]` (C2)

**Behavior:**
- List active (non-revoked, non-expired) overrides: type, value, expires, reason, created-by, created date
- "Add Override" inline form:
  - Type select: `Subscription Status` / `Comp Period`
  - Value select (only shown for Subscription Status): `active` / `trialing` / `past_due` / `canceled`
  - Expires date-picker (optional — leave blank for permanent)
  - Reason textarea (required)
  - Submit button
- Revoke button per active override (requires confirmation — "Revoke this override?")
- Historical (revoked/expired) overrides in a collapsible section below

---

## Phase E — Platform Audit Log (migration 018 required)

**Goal:** Record every superuser action — what changed, who changed it, when, on which org.

### E1 — Migration

**Migration (018):**
```sql
CREATE TABLE platform_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text        NOT NULL,
  org_id      uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  field       text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_audit_org    ON platform_audit_log(org_id, created_at DESC);
CREATE INDEX idx_platform_audit_actor  ON platform_audit_log(actor_email, created_at DESC);
```

**Action vocabulary:**
- `update_plan` — planId or tournamentLimit changed
- `update_addons` — enabled_addons array changed
- `update_notes` — internal_notes changed
- `create_override` — org_overrides row created
- `revoke_override` — org_overrides row revoked
- `generate_reset_link` — password reset link generated for a user

### E2 — Write helper + retrofit

**File:** `lib/platform-audit.ts`

```ts
export async function writePlatformAuditLog(
  actorEmail: string,
  orgId: string | null,
  action: string,
  field?: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  await supabaseAdmin.from('platform_audit_log').insert({
    actor_email: actorEmail,
    org_id: orgId,
    action,
    field: field ?? null,
    old_value: oldValue !== undefined ? oldValue : null,
    new_value: newValue !== undefined ? newValue : null,
  });
}
```

Retrofit all existing and Phase A/B/C/D platform-admin PATCH/POST routes to call this helper. The Phase A route stubs become real writes.

### E3 — Audit log read page

**Route:** `/platform-admin/audit`

**Files:**
- `app/platform-admin/audit/page.tsx` — server component
- Add `{ href: '/platform-admin/audit', label: 'Audit Log', Icon: ScrollText }` to `NAV` in `layout.tsx`

**Behavior:**
- Latest 200 entries across all orgs, newest first
- Columns: timestamp, superuser email, org (name linked to drill-down), action, field, old value, new value
- Read-only; no editing
- Filter by org (optional, Phase F)

---

## Phase F — Scale & Hygiene (deferred)

Do when count or UX pain makes it necessary.

### F1 — Org search and filter

Client-side filter over already-loaded org list (no backend changes until ~200 orgs):
- Text search field (name / slug)
- Plan filter dropdown
- Status filter dropdown

### F2 — Users page pagination

Replace `listUsers({ page: 1, perPage: 1000 })` with cursor-based pagination using `supabaseAdmin.auth.admin.listUsers({ page, perPage: 50 })`. Add prev/next navigation to the users page.

---

## API Route Manifest

| Route | Method | Auth | Status | Phase |
|---|---|---|---|---|
| `/api/platform-admin/orgs/[id]/plan` | PATCH | `getPlatformAuthContext()` | Existing | — |
| `/api/platform-admin/users/[id]/reset` | POST | `getPlatformAuthContext()` | Existing | — |
| `/api/platform-admin/orgs/[id]/addons` | PATCH | `getPlatformAuthContext()` | New | A1 |
| `/api/platform-admin/orgs/[id]/notes` | PATCH | `getPlatformAuthContext()` | New | C1 |
| `/api/platform-admin/orgs/[id]/overrides` | GET | `getPlatformAuthContext()` | New | D2 |
| `/api/platform-admin/orgs/[id]/overrides` | POST | `getPlatformAuthContext()` | New | D2 |
| `/api/platform-admin/orgs/[id]/overrides/[oid]` | DELETE | `getPlatformAuthContext()` | New | D2 |

---

## DB Migration Checklist

| # | File | What |
|---|---|---|
| 016 | `016_org_internal_notes.sql` | Add `internal_notes text` to `organizations` |
| 017 | `017_org_overrides.sql` | Create `org_overrides` table |
| 018 | `018_platform_audit_log.sql` | Create `platform_audit_log` table |

---

## Recommended Build Order

| Phase | Effort | Blocks anything? | When |
|---|---|---|---|
| A (add-ons toggle + admin link) | ~2 hrs | `module_public_site` cannot go live without A1 | This session |
| B (users enrichment) | ~1 hr | Nothing | Bundle with A |
| E1 + E2 (audit table + helper) | ~1 hr | Nothing, but every route written before this ships is unlogged | Bundle with A — so Phase A routes log from day one |
| C (notes + drill-down) | ~4 hrs | Nothing | Next session after A/B/E confirmed |
| D (overrides) | ~3–4 hrs | Nothing (until a billing situation arises) | After C |
| E3 (audit log UI) | ~1 hr | Nothing | Bundle with D |
| F (search, pagination) | ~2 hrs | Nothing | When scale demands it |
