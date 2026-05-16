# Rep Teams Enhancements Plan

Phases 1 and 2 complete. Phase 3 (per-team billing) has moved to [STRIPE_INTEGRATION_PLAN.md](STRIPE_INTEGRATION_PLAN.md) Phase E, consolidated with all other Stripe work.

---

## PM Brief

### Rep Team Groups

Org admins define a list of named groups for their rep program (e.g. "AA", "A", "Select", "Elite"). Each rep team is assigned to one group. Groups are org-specific and fully configurable — the platform doesn't dictate naming conventions.

Once groups are set up:
- **Owners, admins, and treasurers** see all groups everywhere, plus a group filter dropdown on team lists, the accounting overview, budget vs. actual, and payment requests.
- **Staff members** can optionally be scoped to a single group. A scoped staff member sees only teams in their assigned group — they get a hard 403 on any other team's pages and those teams don't appear in any list or nav.
- Team cards and list rows show a group badge alongside the existing age group label.
- Groups can be reordered for consistent display across the platform.

**Why it matters:** A Club org with 10–15 teams and dedicated group coordinators currently has no way to partition responsibility or reporting. This lets the "AA coordinator" manage their 4 teams without seeing or being confused by the other 11.

### Rep Team Per-Team Billing

Club plan orgs get their first 3 active rep teams included in their subscription. Each additional active team costs $20/month or $200/year (matching the subscription frequency already on file).

When an admin adds a team that crosses the threshold:
- A billing preview modal appears before the team is created, showing the prorated charge for the current billing cycle remainder and the new recurring amount.
- On confirmation, the team is created and the Stripe subscription quantity is updated atomically.
- When a program year is marked complete or archived, that team stops counting and the subscription quantity decrements automatically (no more charge at next renewal).

The billing page shows a clear breakdown: Club base plan + "Additional rep teams (N) — $X/period" with a total.

**Why it matters:** Teams using the rep portal (coaching portal, per-team ledger, dues/installment tracking, document management, scheduling) generate real support surface area. Pricing per active team aligns revenue to that load while keeping the first three teams free as a compelling entry point.

---

## Architecture Decisions

- **Groups table** (`rep_team_groups`): org-scoped, ordered, unique name per org. Teams reference it via `group_id` (nullable — existing teams are ungrouped).
- **Staff scoping**: `rep_group_id` on `organization_members` (nullable = all groups). Enforced in all rep team admin API routes — if requester has `rep_group_id` set, validate that the target team's `group_id` matches.
- **Billing**: Stripe quantity-based subscription item on the Club subscription. Quantity = `max(0, active_team_count - 3)`. Active = program year status is `draft` or `active`. Use `stripe.invoices.createPreview` for the billing preview modal.
- **Stripe product setup**: Two prices (monthly $20, annual $200) on one "Additional Rep Team" product. Price IDs stored in env vars: `STRIPE_REP_TEAM_PRICE_MONTHLY` and `STRIPE_REP_TEAM_PRICE_ANNUAL`.

---

## Phase 1 — Rep Team Groups (table + assignment + display)

**Migration 035:**
```sql
CREATE TABLE rep_team_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 50),
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lower(name))
);

ALTER TABLE rep_teams
  ADD COLUMN group_id uuid REFERENCES rep_team_groups(id) ON DELETE SET NULL;
```

**RLS:** `rep_team_groups` readable by any authenticated member of the org; writable by owner/admin only.

**DB helpers (lib/db.ts):**
- `getRepTeamGroups(orgId)` → `RepTeamGroup[]`
- `createRepTeamGroup(orgId, name, displayOrder)` → `RepTeamGroup`
- `updateRepTeamGroup(id, fields)` (name, display_order)
- `deleteRepTeamGroup(id)` — only if no teams are assigned
- `setRepTeamGroup(teamId, groupId | null)` — assign/unassign

**Types (lib/types.ts):**
```typescript
export interface RepTeamGroup {
  id: string;
  orgId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
}
// RepTeam gets: groupId: string | null; groupName: string | null
```

**API routes:**
- `GET/POST /api/admin/rep-teams/groups` — list and create
- `PATCH/DELETE /api/admin/rep-teams/groups/[groupId]` — update and delete
- `PATCH /api/admin/rep-teams/teams/[teamId]` — already exists, extend to accept `groupId`

**UI changes:**
- New "Groups" section in rep teams admin settings (below or alongside team list header)
- Group create/edit/reorder/delete inline list
- Team create and edit forms: add group selector dropdown
- Team list cards: group badge (pill) alongside age group
- Team list header: group filter dropdown (shows all groups + "All")
- `mapRepTeam` in db.ts: join `rep_team_groups` to include `group_name`

---

## Phase 2 — Staff Group Scoping

**Migration 036:**
```sql
ALTER TABLE organization_members
  ADD COLUMN rep_group_id uuid REFERENCES rep_team_groups(id) ON DELETE SET NULL;
```

**AuthContext extension:**
- `getAuthContextWithRole()` already returns `capabilities`
- Add `repGroupId: string | null` to the resolved context by joining `organization_members.rep_group_id`

**API route gating pattern (all rep team admin routes with [teamId]):**
```typescript
// After resolving ctx:
if (ctx.repGroupId) {
  const team = await getRepTeam(teamId);
  if (team.groupId !== ctx.repGroupId) return forbidden();
}
```

**List route gating:**
```typescript
// getRepTeams(orgId, groupId?) — add optional groupId filter
if (ctx.repGroupId) query = query.eq('group_id', ctx.repGroupId);
```

**Routes to gate:**
- All routes under `/api/admin/rep-teams/teams/[teamId]/...`
- `/api/admin/rep-teams/teams` (list filter)
- Accounting routes that surface team data (budget-vs-actual, payment-requests, upcoming-payables) — filter by group when scoped

**Staff member UI:**
- In org settings → Members, when editing a member with `module_rep_teams` capability: add "Rep group access" selector (All groups / specific group)
- Saving updates `organization_members.rep_group_id`

**Sidebar nav:**
- Rep teams team-picker: already filtered via API list — scoped staff will naturally only see their teams since the list route filters by group

---

## Phase 3 — Per-Team Billing

**Prerequisites:** Stripe product + two prices created manually; IDs in env vars.

**Active team count logic:**
- Active = `rep_program_years.status IN ('draft', 'active')` for teams belonging to the org
- Billable quantity = `max(0, active_count - 3)`
- Recompute on: team creation, program year status change

**New DB helper:**
```typescript
getActiveRepTeamCount(orgId): Promise<number>
// counts distinct team_ids with an active/draft program year
```

**New API routes:**
- `GET /api/admin/rep-teams/billing-preview?proposedCount=N`
  - Fetches current active count + proposes new count
  - Calls `stripe.invoices.createPreview` with updated subscription item quantity
  - Returns `{ currentCount, newCount, immediateCharge, newRecurring, billingPeriod }`
- Extend `POST /api/admin/rep-teams` (team creation) or `POST /api/admin/rep-teams/teams`:
  - After team creation, recompute active count and sync Stripe quantity
  - Return `billingChanged: true/false` so the UI can show a confirmation

**Program year status change hook:**
- In the program year PATCH route, when status changes to `completed` or `archived`:
  - Call `syncRepTeamBilling(orgId)` — recomputes active count and updates Stripe quantity

**Billing preview modal (team creation flow):**
- Before submitting create-team form, if `active_count >= 3`: fetch billing preview
- Modal copy:
  - Monthly: *"Adding this team will add $X to your current bill (prorated for N days remaining) and $20/month going forward."*
  - Annual: *"Adding this team will add $X to your current bill (prorated for N days remaining) and $200/year going forward."*
- Cancel or Confirm → create team

**Billing page (admin/org/billing):**
- New section: subscription breakdown
  - Fetch subscription from Stripe, parse line items
  - Show: base plan line + additional teams line (if quantity > 0)
  - Show total
  - If on annual: show renewal date

**Platform admin:**
- Org detail page: show active rep team count and whether they have a teams subscription item

---

## Build Order

1. Phase 1 migration + DB helpers + types + group management UI + team assignment (no staff scoping yet)
2. Phase 2 migration + auth context extension + route gating + staff assignment UI
3. Phase 3 Stripe env vars confirmed → billing preview endpoint + modal + program year hook + billing page

---

## Decisions

- **Group deletion:** Blocked if any teams are assigned to the group — admin must reassign first. Renaming a group is always allowed.
- **Billable moment:** Teams are billable from the moment of creation (not tied to program year status). Draft-state gaming is unlikely at team 4+, and billing simplicity outweighs the edge case.
- **Stripe env vars:** `STRIPE_REP_TEAM_PRICE_MONTHLY_ID` and `STRIPE_REP_TEAM_PRICE_ANNUAL_ID`
