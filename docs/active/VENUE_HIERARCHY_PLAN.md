# Venue Hierarchy & Org Library Plan

## Status: Ready to implement

---

## PM Brief

**What changes:** Venues become a two-tier structure. Instead of creating a separate venue record for every playing surface at a facility, admins define a **Venue** once (the facility — name, address, Maps link) and then add **Facilities** within it ("Diamond 1", "Rink North", "Court Sigma") as a named list with a Facility Type dropdown (Diamond / Field / Court / Rink / Gym / Other).

**Org-level library (League / Club plans):** A central Org Venue Library lives at Admin → Org → Venues. Org admins manage their real-world locations once. When setting up a tournament, they import from the library — a local copy lands in the tournament. Changes to that copy don't affect the library (and vice versa). Tournament staff who create local venues cannot pollute the org library.

**Tournament-only users (Tournament / Tournament Plus):** See only their tournament's venues. When setting up a new tournament, they can "Import from a past tournament" to copy venues without re-entering them.

**Schedule builder:** The venue/facility picker groups by facility — facility name as a header, surfaces indented below. Picking "Diamond 2 at Lions Park" is fast even with 12+ surfaces.

**Public schedule / scorekeeper:** Location shows as "Lions Park — Diamond 2". The Maps link uses the parent venue address — entered once, always correct.

**Terminology used throughout the UI:**
- **Venue** — the physical facility (Lions Park, Canlan Ice Sports, YMCA)
- **Facility** — the individual playing surface within a venue (Diamond 1, Rink North, Court Sigma)
- **Facility Type** — the dropdown category: Diamond / Field / Court / Rink / Gym / Other

---

## Locked Decisions

| Decision | Choice |
|---|---|
| Generic term for sub-locations | **Facility** |
| Type dropdown label | **Facility Type** |
| Facility name field | Free text (no constraint) |
| Facility Type enum | `diamond`, `field`, `court`, `rink`, `gym`, `other` |
| Org library → tournament | Copy on import (not live link); `source_org_venue_id` back-reference kept |
| Tournament-created venues | Local only — never auto-promoted to org library |
| No-org users (Tournament / Plus) | Tournament-scoped only; "Import from past tournament" flow |
| Legacy flat diamonds | Each becomes a venue + one auto-created facility with same name, type = `other` |
| `diamond_id` in games | Kept for backward compat during transition; `venue_facility_id` added and populated |

---

## Current State (all references to update)

**DB table:** `diamonds` — flat, `id / tournament_id / name / address / notes`

**Code references (full list):**
- `lib/db.ts` — `getVenues()`, `saveVenue()`, `updateVenue()`, `deleteVenue()`, `cloneTournament()`, `syncTournaments()`, seed functions
- `app/api/admin/venues/route.ts` — GET + POST, reads `diamonds`
- `app/api/official/[orgSlug]/score/route.ts` — scorekeeper API, reads `diamonds`, maps `diamond_id`
- `app/[orgSlug]/admin/org/venues/page.tsx` — tournament venue admin (uses tournament context picker)
- `app/[orgSlug]/admin/org/diamonds/page.tsx` — **duplicate** of above, to be removed
- `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx` — public schedule, `getVenue(game.venueId)`, `LocationLink`
- `app/[orgSlug]/scorekeeper/page.tsx` — `card.game.venueId`, venue filter dropdown
- `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx` — `selectedDiamonds`, `diamondId`
- `app/[orgSlug]/admin/tournaments/schedule/components/BracketBuilder.tsx` — `diamondId`
- `components/admin/AddVenueModal.tsx` — add/edit venue form
- `components/LocationLink.tsx` — Maps URL derivation
- `lib/types.ts` — `Venue` interface, `Game.venueId`

---

## New Database Schema

### New Tables

#### `org_venues` (org venue library)
```sql
CREATE TABLE org_venues (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  address       text,
  notes         text,
  is_active     bool        NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS: org_id tenancy
-- Indexes: org_venues_org_id_idx (org_id)
```

#### `org_venue_facilities` (facilities within org venues)
```sql
CREATE TABLE org_venue_facilities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_venue_id    uuid        NOT NULL REFERENCES org_venues(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id),
  name            text        NOT NULL,
  facility_type   text        NOT NULL DEFAULT 'other',
  display_order   int         NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- CHECK: facility_type IN ('diamond','field','court','rink','gym','other')
-- RLS: org_id tenancy
```

#### `venue_facilities` (facilities within tournament venues)
```sql
CREATE TABLE venue_facilities (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              uuid        NOT NULL REFERENCES diamonds(id) ON DELETE CASCADE,
  tournament_id         uuid        NOT NULL REFERENCES tournaments(id),
  name                  text        NOT NULL,
  facility_type         text        NOT NULL DEFAULT 'other',
  display_order         int         NOT NULL DEFAULT 0,
  notes                 text,
  source_org_facility_id uuid       REFERENCES org_venue_facilities(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);
-- CHECK: facility_type IN ('diamond','field','court','rink','gym','other')
-- RLS: via tournament_id → tournaments.org_id
-- Indexes: venue_facilities_venue_id_idx, venue_facilities_tournament_id_idx
```

### Columns Added to Existing Tables

```sql
-- diamonds: add import tracking
ALTER TABLE diamonds ADD COLUMN source_org_venue_id uuid REFERENCES org_venues(id);

-- games: add facility reference (keeps diamond_id for backward compat)
ALTER TABLE games ADD COLUMN venue_facility_id uuid REFERENCES venue_facilities(id);
```

---

## Migrations

| # | File | Description |
|---|---|---|
| 094 | `migration_094_org_venues.sql` | Create `org_venues` + `org_venue_facilities` tables with RLS |
| 095 | `migration_095_venue_facilities.sql` | Create `venue_facilities`, add `games.venue_facility_id`, add `diamonds.source_org_venue_id` |
| 096 | `migration_096_venue_data_migration.sql` | For each `diamonds` row → insert one `venue_facilities` row (same name, type='other'); populate `games.venue_facility_id` from `games.diamond_id` lookup |

All three migrations apply to **dev then prod** after UI is tested.

---

## Implementation Phases

### Phase 1 — DB Migrations
- [ ] Write + apply migration 094 (dev)
- [ ] Write + apply migration 095 (dev)
- [ ] Write + apply migration 096 (dev) — data backfill
- [ ] Verify: every existing `diamonds` row has exactly one `venue_facilities` child; all `games` with a `diamond_id` have a matching `venue_facility_id`

### Phase 2 — Type System + `lib/db.ts`
Files: `lib/types.ts`, `lib/db.ts`

- [ ] Update `Venue` type → add `facilities?: VenueFacility[]`
- [ ] Add `VenueFacility` type: `{ id, venueId, tournamentId, name, facilityType, displayOrder, notes, sourceOrgFacilityId? }`
- [ ] Add `OrgVenue` type: `{ id, orgId, name, address, notes, isActive, facilities?: OrgVenueFacility[] }`
- [ ] Add `OrgVenueFacility` type: `{ id, orgVenueId, orgId, name, facilityType, displayOrder, notes }`
- [ ] Add `FACILITY_TYPES` constant: `['diamond','field','court','rink','gym','other']`
- [ ] Add `FACILITY_TYPE_LABELS` map: `{ diamond: 'Diamond', field: 'Field', court: 'Court', rink: 'Rink', gym: 'Gym', other: 'Other' }`
- [ ] Update `getVenues()` → return venues with nested `facilities[]` from `venue_facilities`
- [ ] Update `saveVenue()` → accept parent venue + initial facility list
- [ ] Update `updateVenue()` / `deleteVenue()` to handle cascade correctly
- [ ] Add `addVenueFacility()`, `updateVenueFacility()`, `deleteVenueFacility()` helpers
- [ ] Add `getOrgVenues()`, `saveOrgVenue()`, `updateOrgVenue()`, `deleteOrgVenue()` for library
- [ ] Add `importOrgVenueToTournament(orgVenueId, tournamentId)` — copies venue + all facilities, sets `source_org_venue_id` / `source_org_facility_id`
- [ ] Update `cloneTournament()` and `syncTournaments()` to include `venue_facilities` in copy

### Phase 3 — API Layer
Files: `app/api/admin/venues/route.ts`, new `app/api/admin/org/venues/route.ts`

- [ ] **`GET /api/admin/venues?tournamentId=`** — return venues with nested `facilities[]`; used by schedule admin + game editing
- [ ] **`GET /api/admin/venues?scope=org`** — updated org-wide view with nested facilities
- [ ] **`POST /api/admin/venues`** — extend actions: `save-venue`, `update-venue`, `delete-venue`, `add-facility`, `update-facility`, `delete-facility`, `import-from-org`, `import-from-past-tournament`
- [ ] **`GET /api/admin/org/venues`** — org library CRUD (list with nested facilities)
- [ ] **`POST /api/admin/org/venues`** — actions: `save`, `update`, `delete`, `add-facility`, `update-facility`, `delete-facility`
- [ ] Update `app/api/official/[orgSlug]/score/route.ts` — query `venue_facilities` via `games.venue_facility_id`; return parent venue address for Maps; return facility name for display

### Phase 4 — Org Venue Library UI
Files: `app/[orgSlug]/admin/org/venues/page.tsx`, new modal components

- [ ] Rebuild `admin/org/venues/page.tsx` as **Org Venue Library**
  - Remove tournament context picker (this page is org-level, not tournament-scoped)
  - Expandable venue rows: venue name + address collapsed, expand to show facility list
  - Inline facility list: name, facility type badge, notes, reorder handle (drag or up/down arrows), delete
  - "Add Facility" inline row at bottom of expanded venue
  - "Edit Venue" button → `EditOrgVenueModal` (name, address, notes)
  - "Delete Venue" → confirm if it has been imported into any tournaments; warn but allow
  - Empty state: "Your org venue library is empty — add venues here and import them into any tournament"
- [ ] `AddOrgVenueModal.tsx` — name, address (street/city/province/postal), notes; on save → goes back to library
- [ ] `AddFacilityRow.tsx` (inline, no modal) — name (text), Facility Type (dropdown), notes (optional), Save / Cancel
- [ ] Delete `app/[orgSlug]/admin/org/diamonds/page.tsx` — redirect `admin/org/diamonds` → `admin/org/venues`

### Phase 5 — Tournament Venue UI
Files: `app/[orgSlug]/admin/org/venues/page.tsx` (tournament tab or separate context)

The current `admin/org/venues` page showed tournament-scoped venues using the tournament context picker. After Phase 4 takes that page as the org library, tournament venue management needs a new home.

**Decision:** Add a **"Venues" tab or section within the tournament admin** — either as part of the tournament setup flow or as a dedicated page at the existing location gated by whether a tournament is selected. For now, use the existing page with tournament picker as the **Tournament Venues** page and move it to `admin/org/tournament-venues` while `admin/org/venues` becomes the library.

- [ ] Rename current `admin/org/venues/page.tsx` → `admin/org/tournament-venues/page.tsx` (or equivalent)
- [ ] Rebuild tournament venue page:
  - Tournament picker at top (existing pattern)
  - Venue list — expandable rows showing facilities
  - "Add Venue" → `AddTournamentVenueModal` (creates local copy, not in org library)
  - "Add from Org Library" button (org admins only) → `ImportFromOrgLibraryModal`
  - "Import from Past Tournament" (for no-org Tournament/Plus users) → `ImportFromPastTournamentModal`
  - Inline facility management per venue (same as org library)
- [ ] `AddTournamentVenueModal.tsx` — name, address, notes → creates local tournament-scoped venue with one initial facility
- [ ] `ImportFromOrgLibraryModal.tsx` — searchable list of org venues; select one or more; "Import Selected" → copies venue + facilities into tournament
- [ ] `ImportFromPastTournamentModal.tsx` — dropdown of past tournaments from same org/user; select venue(s) to copy

### Phase 6 — Schedule Builder + Game Editing
Files: `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx`, `BracketBuilder.tsx`, game edit forms

- [ ] Update Generator.tsx diamond picker → `<optgroup>`-grouped facility selector
  - Group by parent venue name
  - Show facility name + type badge in each option
  - Keep "select all / deselect all" per-venue group
- [ ] Update game add/edit → venue dropdown uses grouped `<optgroup>` by venue name
- [ ] Update game save/update API calls to write `venue_facility_id` (alongside or replacing `diamond_id`)
- [ ] `PlayoffWizard.tsx` — same grouped dropdown for playoff game venue assignment

### Phase 7 — Public Schedule + Scorekeeper
Files: `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx`, `app/[orgSlug]/scorekeeper/page.tsx`, `components/LocationLink.tsx`

- [ ] Update `LocationLink.tsx` → accept optional `parentVenue` (with address); use parent address for Maps URL if available; display as "Venue — Facility" format
- [ ] Update public schedule `getVenue()` → resolve facility's parent venue for address; display "Lions Park — Diamond 2"
- [ ] Update scorekeeper venue filter dropdown → grouped `<optgroup>` by parent venue
- [ ] Update scorekeeper card display → show "Venue — Facility" format
- [ ] Update scorekeeper API → return parent venue info alongside facility

### Phase 8 — DB Migrations to Prod
- [ ] Apply migrations 094–096 to production
- [ ] Verify data integrity on prod (spot-check venue + facility counts)
- [ ] Monitor for any `diamond_id`-related errors in logs

---

## Nav Changes Summary

| Route | Before | After |
|---|---|---|
| `admin/org/venues` | Tournament venue list (with tournament picker) | **Org Venue Library** (no tournament picker) |
| `admin/org/diamonds` | Duplicate of above | **Redirect → admin/org/venues** |
| `admin/org/tournament-venues` | (new) | Tournament venue manager (with tournament picker + import) |

Update sidebar nav to include both entries for org-plan users; Tournament/Plus users only see tournament venues.

---

## Type Reference (final)

```typescript
// lib/types.ts

export type FacilityType = 'diamond' | 'field' | 'court' | 'rink' | 'gym' | 'other';

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  diamond: 'Diamond',
  field:   'Field',
  court:   'Court',
  rink:    'Rink',
  gym:     'Gym',
  other:   'Other',
};

export interface VenueFacility {
  id: string;
  venueId: string;
  tournamentId: string;
  name: string;                   // free text: "Diamond 1", "Court Sigma"
  facilityType: FacilityType;
  displayOrder: number;
  notes?: string;
  sourceOrgFacilityId?: string;   // set if imported from org library
}

export interface Venue {
  id: string;
  tournamentId: string;
  name: string;                   // facility name: "Lions Park"
  address: string;                // full address for Maps
  notes?: string;
  sourceOrgVenueId?: string;      // set if imported from org library
  facilities?: VenueFacility[];   // populated when fetched with ?includeFacilities=true
}

export interface OrgVenueFacility {
  id: string;
  orgVenueId: string;
  orgId: string;
  name: string;
  facilityType: FacilityType;
  displayOrder: number;
  notes?: string;
}

export interface OrgVenue {
  id: string;
  orgId: string;
  name: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  facilities?: OrgVenueFacility[];
}

// Game: add alongside existing venueId (deprecated alias for diamond_id)
// Game.venueFacilityId → references venue_facilities.id
```

---

## Dropdown Display Pattern

In all dropdowns where a facility is selected (schedule generator, game edit, playoff wizard):

```html
<select>
  <option value="">— No venue assigned —</option>
  <optgroup label="Lions Park">
    <option value="[facilityId]">Diamond 1</option>
    <option value="[facilityId]">Diamond 2</option>
    <option value="[facilityId]">Diamond 3</option>
  </optgroup>
  <optgroup label="Rotary Park">
    <option value="[facilityId]">Field A</option>
    <option value="[facilityId]">Field B</option>
  </optgroup>
</select>
```

The value stored is always the `venue_facility.id`, not the parent `venue.id`.

---

## Public Display Pattern

```
📍 Lions Park — Diamond 2   [Maps ↗]
    ↑ parent venue name   ↑ facility name
    Maps URL uses parent venue address
```

If a game has only a `location` text field (legacy, no venueId), show that text as-is.

---

## Build Order

1. Phase 1 (migrations) → required before all other phases
2. Phase 2 (types + db.ts) → required before API and UI
3. Phase 3 (API) → required before UI
4. Phases 4–7 can proceed in order, each independently testable
5. Phase 8 (prod migrations) → last, after full browser verification
