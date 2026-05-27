# Divisions UX Rework & Tournament Settings Inheritance Model

## Overview

This plan covers three interconnected improvements:

1. **Tournament-level scope controls** — fees, game timing, and tie-breakers are now configured at the tournament level first. Each setting has an explicit scope decision (tournament-wide / allow division override / per-division / free). The dashboard activation gate enforces that all three are explicitly configured before the tournament goes live.

2. **Divisions modal inheritance model** — the modal responds to each scope decision. Settings that are "tournament-wide" are hidden entirely on Divisions. Settings that "allow override" show a pre-filled override toggle. Settings that are "per-division" are required on each division.

3. **Divisions page table and UI polish** — design system violations fixed, table restructured for clarity (Age Range column, Teams fill column, Order column removed), empty state upgraded, header migrated to shared component.

## PM Brief

**What changes for the organizer:**

Today, admins set fees, game timing, and tie-breakers division-by-division, often duplicating the same values across every division. There's no system enforcement — if they forget, nothing warns them until something breaks at game day.

After this change, the organizer configures each of these once at the tournament level during setup. The dashboard has a required checklist — before the tournament can go live, each setting must be explicitly addressed (set, configured with overrides, or marked as not applicable). This turns "I hope I got everything" into a structured walkthrough.

For organizers who run a scrimmage with no payments, they explicitly mark fees as "Free — not tracking payments" and the system stops asking. For multi-division tournaments where U11 has different game lengths, they set the tournament default and mark "Allow division override" — the division form then shows the override toggle only where it's relevant.

The Divisions page table gains a fill-rate column (registered teams vs. capacity) so organizers don't have to navigate to Registrations just to see if a division is nearly full.

**Why it matters:** Setup confidence at activation time; less cognitive load for simple tournaments; clear override path for complex ones.

---

## Scope Modes (all three setting categories)

| Mode | Event Settings | Division modal behaviour |
|---|---|---|
| `tournament` | Set once, applies to all divisions | Setting completely hidden on Divisions |
| `allow_override` | Set tournament default | Shows with tournament value pre-filled; admin can override |
| `per_division` | No tournament value | Required field on each division; blocks activation until all divisions have it set |
| `free` | Fees only — no payment tracking | Fee fields hidden on both Event Settings and Divisions |

**"Not set" (null) is distinct from any mode.** Null means the admin has not made a decision yet — it blocks activation. Explicit `tournament` / `free` / `per_division` / `allow_override` means the decision was made.

---

## Tie-Breaker Rules

- **No `free` / N/A mode** — tie-breakers are always required. If the organizer doesn't care, the default `['h2h', 'rd', 'rf', 'ra']` is pre-populated and they accept it with zero work.
- Tie-breakers apply to standings throughout round-robin and to playoff seeding. Source of truth is `division.playoffConfig.tieBreakers`, populated from the tournament default (or division override).
- The `PlayoffWizard` currently duplicates tie-breaker editing with no effect on bracket generation — this is removed in Phase 1.

## Fee "Free" Toggle

- `free` is stored as `fee_scope = 'free'` in `tournaments.settings`.
- When `free`, the organizer explicitly chose "no payment tracking." This is different from null (not yet decided).
- On the Divisions modal, fee fields are hidden when `free` — no noise, no confusion.
- The dashboard checklist treats `free` as a valid confirmed state (green, not blocking).

---

## Phases

### Phase 1 — PlayoffWizard: Remove tie-breaker step ✅
**Files:** `app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx`

- [x] Remove Step 2 "Seeding Hierarchy (Tie-Breakers)" section entirely
- [x] Remove `moveBreaker()` function
- [x] Remove `breakerLabels` record
- [x] Remove `tieBreakers` from the local `config` state / `PlayoffConfig` wizard usage (keep it in `lib/types.ts` — still used by standings)
- [x] Renumber/remove step label if steps are numbered (Step 3 → Step 2 "Game Slots & Scheduling"; "Configure Brackets" button moved outside section, stays after Step 1)
- [x] Verify: bracket generation API call does not reference `tieBreakers` — confirmed safe to remove from wizard

**Scope:** Wizard UI only. No API or DB changes. No effect on standings or seeding (standings reads directly from `division.playoffConfig.tieBreakers`, not the wizard's local state).

---

### Phase 2 — DB & Type layer: Extend settings schema ✅
**Files:** `lib/types.ts`, `lib/db.ts`, `app/api/admin/tournaments/route.ts`, new migration file

#### New `tournaments.settings` JSONB fields

```jsonb
{
  // existing
  "game_duration_minutes": 90,
  "buffer_minutes": 15,

  // new
  "game_timing_scope": "tournament" | "allow_override" | "per_division" | null,
  "tie_breakers": ["h2h", "rd", "rf", "ra"],
  "tie_breaker_scope": "tournament" | "allow_override" | "per_division" | null,
  "fee_scope": "tournament" | "allow_override" | "per_division" | "free" | null
}
```

#### Fee scope vs. existing `fee_schedule_mode` column

The existing `tournaments.fee_schedule_mode` column has values `'tournament'` and `'division'`. Map going forward:
- `fee_schedule_mode = 'tournament'` → `fee_scope = 'tournament'` (same meaning)
- `fee_schedule_mode = 'division'` → `fee_scope = 'per_division'` (rename for clarity)
- New: `fee_scope = 'allow_override'` and `fee_scope = 'free'`

**Decision:** Store `fee_scope` in `tournaments.settings` JSONB alongside the other new scope fields. Keep `fee_schedule_mode` column for backward compat with any existing queries that read it; sync the two values on save. Long-term, `fee_schedule_mode` is deprecated in favour of `fee_scope`.

#### Migration

- [x] Write migration `102_tournament_settings_scope.sql` (migration 101 is claimed by Notifications Phase A)
- [x] Migration sets default `game_timing_scope = 'tournament'` for any existing tournament that already has `game_duration_minutes` explicitly set in settings (non-null)
- [x] Migration sets default `fee_scope` from existing `fee_schedule_mode`: `'tournament'` → `'tournament'`, `'division'` → `'per_division'`
- [x] Migration leaves `tie_breaker_scope = null` for all existing tournaments (requires explicit decision — shown as incomplete on dashboard)
- [x] Apply to dev DB first, then prod — applied 2026-05-27

#### Type changes (`lib/types.ts`)

- [x] Add `game_timing_scope`, `tie_breakers`, `tie_breaker_scope`, `fee_scope` to `TournamentSettings` type
- [x] Add `TieBreakerScope`, `GameTimingScope`, `FeeScope` union types

#### API changes (`app/api/admin/tournaments/route.ts`)

- [x] Add `game_timing_scope`, `tie_breakers`, `tie_breaker_scope`, `fee_scope` to `patch-settings` action handler
- [ ] Update `publishChecklist` computation to include:
  - `hasGameTimingConfigured`: `game_timing_scope` is not null
  - `hasTieBreakerConfigured`: `tie_breaker_scope` is not null AND (if scope ≠ `per_division`) `tie_breakers` array is set
  - `hasFeeConfigured`: `fee_scope` is not null (replaces the existing `hasFees` check, or extends it)
  - **Note:** publishChecklist is in `app/api/admin/tournament-dashboard/route.ts` — deferred to Phase 4

#### `lib/db.ts` standings

- [x] Update `getStandings()` to read from `division.playoffConfig.tieBreakers` first (existing), then fall back to `tournament.settings.tie_breakers`, then hardcoded default `['h2h', 'rd', 'rf', 'ra']`

---

### Phase 3 — Event Settings: Scope controls ✅
**Files:** `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`, `branding.module.css`

#### New "Match & Competition Rules" section

Replace the existing "Game Timing" section (just two number inputs) with an expanded "Match & Competition Rules" card that contains both game timing and tie-breakers, each with a scope selector.

**Layout per setting:**
```
[Scope selector: segmented or select — Tournament-wide | Allow division override | Per-division]
↓ (when scope ≠ per_division, show value fields)
[Value inputs — duration / buffer OR tie-breaker reorder list]
```

- [x] Add `game_timing_scope` state variable; initialize from `settings.game_timing_scope`
- [x] Add `tie_breakers` state (array); initialize from `settings.tie_breakers` with fallback to `['h2h', 'rd', 'rf', 'ra']`
- [x] Add `tie_breaker_scope` state; initialize from `settings.tie_breaker_scope`
- [x] Scope selector: three-option segmented control — "Tournament-wide" / "Allow override" / "Per division"
- [x] Game timing value fields: hidden when scope = `per_division`; visible with current inputs when `tournament` or `allow_override`
- [x] Tie-breaker reorder list: hidden when scope = `per_division`; shows up/down button list when `tournament` or `allow_override`
- [x] Help text under tie-breakers when `per_division`: "Each division must set its own tie-breaker order before the tournament can be activated."
- [x] Renamed "Scheduling" section → "Match & Competition Rules" card with both sub-sections

#### Fee section updates

- [x] Extend `FeeScope` type: `'tournament' | 'allow_override' | 'per_division' | 'free'` (using types.ts FeeScope)
- [x] Add "Free" option to fee mode selector (4-option segmented control)
- [x] When `free`: hide all deposit/total fee inputs; show "No payment schedule" message
- [x] When `allow_override`: show fee fields as tournament defaults; help text "Divisions can override them individually."
- [x] Add `fee_scope` to save payload (`patch-settings`)
- [x] Keep `fee_schedule_mode` column in sync on save (`feeScopeToScheduleMode` helper)

#### Save payload

- [x] Add to `patch-settings` body: `{ game_timing_scope, tie_breakers, tie_breaker_scope, fee_scope }`
- [x] Add to `isDirty` comparison: `game_timing_scope`, `tie_breakers`, `tie_breaker_scope`, `fee_scope`

---

### Phase 4 — Dashboard: Checklist gate ✅
**Files:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, `app/api/admin/tournament-dashboard/route.ts`

#### `PublishChecklist` type additions

```typescript
type PublishChecklist = {
  // existing
  hasDates: boolean;
  hasDivisions: boolean;
  hasPublicContact: boolean;
  hasOpenDivision: boolean;
  hasBranding: boolean;
  hasVenues: boolean;
  hasRules: boolean;
  hasFees: boolean;        // repurposed: now = hasFeeConfigured
  // new
  hasGameTiming: boolean;  // game_timing_scope is not null
  hasTieBreakers: boolean; // tie_breaker_scope is not null
  ready: boolean;
};
```

#### Checklist item rendering

- [x] Add "Game timing configured" checklist item linking to Event Settings
- [x] Add "Tie-breaker rules configured" checklist item linking to Event Settings
- [x] Existing `hasFees` item: repurpose as "Payment setup confirmed" (covers `free` as a valid state)
- [x] All three are required items (not optional) — they block `ready = true`
- [x] For existing active tournaments: treat as grandfathered (don't retroactively fail the checklist for already-active tournaments)

**Grandfathering rule:** If `status = 'active'` or `status = 'completed'`, skip new checklist requirements. Only apply to `draft` status tournaments.

---

### Phase 5 — Divisions modal: Inheritance model + restructure ✅
**Files:** `app/[orgSlug]/admin/tournaments/divisions/page.tsx`, `admin-page.module.css`

#### Data requirements

- [x] Load tournament settings (scopes + default values) alongside divisions on mount (reads from `currentTournament.settings` via context)
- [x] Pass tournament settings into the modal so it can apply inheritance logic

#### Modal structure — two sections

**Section 1 — Core setup (always visible)**
- Division Name (required)
- Age Range: Min Age + Max Age (2-col, combined label "Age Range")
- Capacity (Max Teams) + "Close Registration" toggle (2-col, same as today)

**Section 2 — Advanced Settings accordion (collapsed by default)**
- Division Contact override
- Display Order (edit modal only — hidden on Add)
- Fee override (conditional on `fee_scope`):
  - Hidden if `fee_scope = 'tournament'` or `'free'`
  - Optional override inputs if `fee_scope = 'allow_override'` (tournament defaults shown as placeholder)
  - Required inputs if `fee_scope = 'per_division'`
- Game Timing override (conditional on `game_timing_scope`):
  - Hidden if `game_timing_scope = 'tournament'`
  - Inherit toggle + optional inputs if `game_timing_scope = 'allow_override'`
  - Required inputs if `game_timing_scope = 'per_division'`
- Tie-Breaker override (conditional on `tie_breaker_scope`):
  - Hidden if `tie_breaker_scope = 'tournament'`
  - Shows tournament default order as read-only; toggle to override if `allow_override`
  - Required reorder list if `tie_breaker_scope = 'per_division'`

**Advanced accordion behaviour:**
- Collapsed on Add (zero overrides set)
- Auto-expanded on Edit if any override value differs from tournament default
- Show count of active overrides in accordion header when collapsed: e.g., "Advanced (2 overrides)"

#### Display Order on Add

- [x] Remove Display Order from Add modal (auto-assign `groups.length + 1`)
- [x] Keep Display Order in Edit modal under Advanced accordion
- [x] Note in Edit: "Adjust to change position in the divisions list"

#### Pools section — copy fix

- [x] Rename "Registrant picks pool" sub-label → "Allow registrants to self-select a pool"
- [x] Add help text: "When off, you assign pools manually from the Registrations page."

---

### Phase 6 — Divisions table: Column restructure + design system fixes ✅
**Files:** `app/[orgSlug]/admin/tournaments/divisions/page.tsx`, `admin-page.module.css`

#### Header migration

- [x] Replace hand-rolled `pageHeader / headerLeft / headerIcon / pageTitle / pageSub` with `TournamentAdminHeader` component
- [x] Fix Add Division button: `btn-primary btn-sm` → `btn btn-lime btn-data`

#### Table column restructure

Remove columns: ORDER
Merge columns: MIN AGE + MAX AGE → AGE RANGE
Add column: TEAMS (fill rate)

**New column order:** DIVISION | TEAMS | AGE RANGE | POOLS | STATUS | ACTIONS

- [x] `AGE RANGE` cell helper: `formatAgeRange(min, max)` → `"9–11"` / `"Any–11"` / `"Open"` / `"9+"`
- [x] `TEAMS` cell: show `{accepted} / {capacity}` if capacity is set; `{accepted} teams` if no limit. Added `acceptedCount` to Division type and divisions API GET (parallel team count query)
- [x] Mobile card: ORDER removed; AGE RANGE is single merged column

#### Action buttons

- [x] Edit: `btn-ghost btn-sm` → `btn-ghost btn-data`
- [x] Delete: `btn-danger btn-sm` → `btn-danger btn-data`

#### Empty state

- [x] Removed the `<td colSpan={8}>` passive empty state
- [x] Render a `.empty-state` block outside the table when `groups.length === 0` and not loading (Tag icon, "No divisions yet", CTA `btn btn-lime`)

#### Loading state

- [x] Added `loading` boolean state, set true during initial fetch
- [x] Render a loading row while `loading = true` to prevent false empty-state flash

#### Modal save button

- [x] Fixed `btn-primary btn-data` → `btn-lime btn-data` on modal footer Save button

#### Other fixes

- [x] Display Order removed from Add modal (auto-assign `groups.length + 1`); kept in Edit modal under a note
- [x] "Registrant picks pool" → "Allow registrants to self-select a pool" with updated help text

---

## Build Order

1. Phase 1 (PlayoffWizard cleanup) — standalone, no dependencies, quick
2. Phase 2 (DB + types + API) — must precede Phases 3, 4, 5
3. Phase 3 (Event Settings) + Phase 6 (table polish) — can run in parallel after Phase 2
4. Phase 4 (Dashboard checklist) — depends on Phase 2 API changes
5. Phase 5 (Divisions modal inheritance) — depends on Phases 2 + 3

---

## Files Changed Summary

| File | Phase | Change |
|---|---|---|
| `app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx` | 1 | Remove tie-breaker step |
| `lib/types.ts` | 2 | Add scope types, extend TournamentSettings |
| `lib/db.ts` | 2 | getStandings fallback chain for tie-breakers |
| `app/api/admin/tournaments/route.ts` | 2 | patch-settings + publishChecklist |
| `migrations/101_tournament_settings_scope.sql` | 2 | New JSONB fields + backfill defaults |
| `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` | 3 | Scope selectors, tie-breaker section, fee_scope |
| `app/[orgSlug]/admin/tournaments/branding/branding.module.css` | 3 | New scope selector + tie-breaker styles |
| `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` | 4 | PublishChecklist additions, checklist items |
| `app/[orgSlug]/admin/tournaments/divisions/page.tsx` | 5 + 6 | Full modal + table rework |
| `app/[orgSlug]/admin/tournaments/divisions/admin-page.module.css` | 6 | Table + empty state styles |
