# Venue Hierarchy & Org Library Plan

## Status: ✅ Complete — migrations applied dev + prod 2026-05-25

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

### Phase 1 — DB Migrations ✅
- [x] Write + apply migration 094 (dev + prod 2026-05-25)
- [x] Write + apply migration 095 (dev + prod 2026-05-25)
- [x] Write + apply migration 096 (dev + prod 2026-05-25) — data backfill

### Phase 2 — Type System + `lib/db.ts` ✅
Files: `lib/types.ts`, `lib/db.ts`

- [x] `FacilityType`, `FACILITY_TYPES`, `FACILITY_TYPE_LABELS` added to `lib/types.ts`
- [x] `VenueFacility`, `OrgVenueFacility`, `OrgVenue` interfaces added
- [x] `Venue` updated: `facilities?: VenueFacility[]`, `sourceOrgVenueId?`
- [x] `Game.venueFacilityId?: string` added
- [x] `getVenues()` returns nested `facilities[]`; `getGames()` maps `venue_facility_id`
- [x] `saveGame()` + `updateGame()` write `venue_facility_id`
- [x] `saveVenue()`, `updateVenue()`, `deleteVenue()` use `supabaseAdmin`
- [x] `getVenueFacilities()`, `addVenueFacility()`, `updateVenueFacility()`, `deleteVenueFacility()` added
- [x] `getOrgVenues()`, `saveOrgVenue()`, `updateOrgVenue()`, `deleteOrgVenue()` added
- [x] `addOrgVenueFacility()`, `updateOrgVenueFacility()`, `deleteOrgVenueFacility()` added
- [x] `importOrgVenueToTournament()` added
- [x] `cloneTournament()` copies `venue_facilities` for cloned venues

### Phase 3 — API Layer ✅
Files: `app/api/admin/venues/route.ts`, `app/api/admin/org/venues/route.ts`, `app/api/admin/games/route.ts`

- [x] `GET /api/admin/venues?tournamentId=` — returns venues with nested `facilities[]`
- [x] `GET /api/admin/venues?scope=past` — past-tournament import with facilities
- [x] `POST /api/admin/venues` — `save-venue`, `update-venue`, `delete-venue`, `add-facility`, `update-facility`, `delete-facility`, `import-from-org`, `import-from-past`; backward-compat `save/update/delete` kept
- [x] `GET /api/admin/org/venues` — org library with nested facilities
- [x] `POST /api/admin/org/venues` — `save-venue`, `update-venue`, `delete-venue`, `add-facility`, `update-facility`, `delete-facility`
- [x] `PATCH /api/admin/games` — `update` action now persists `venue_facility_id`

### Phase 4 — Org Venue Library UI ✅
Files: `app/[orgSlug]/admin/org/venues/page.tsx`, `venues-admin.module.css`

- [x] Rebuilt as Org Venue Library (no tournament picker)
- [x] Expandable venue cards with ChevronRight rotation, facility list, type badges
- [x] Inline `AddFacilityRow` (Enter key, type dropdown)
- [x] `VenueModal` for add/edit; delete confirm
- [x] Empty states: library empty + venue has no facilities yet
- [x] Sidebar label updated: "Venues" → "Venue Library"

### Phase 5 — Tournament Venue UI ✅
Files: `app/[orgSlug]/admin/tournaments/venues/page.tsx`

- [x] Rebuilt as full `TournamentVenuesPage` (was a re-export of org/venues)
- [x] Expandable `TournamentVenueCard` with inline `AddFacilityRow` (tournament-scoped)
- [x] "Import from Library" modal (org venues with facilities, checkbox import)
- [x] "Import from Past Tournament" flow
- [x] `AddVenueModal` (backward compat) for local venue creation
- [x] Import button shown only for org users

### Phase 6 — Schedule Builder + Game Editing ✅
Files: `GameList.tsx`, `BracketBuilder.tsx`, `PlayoffWizard.tsx`, `schedule/page.tsx`

- [x] Game inline edit: venue dropdown → grouped `<optgroup>` by venue name, options = facilities
- [x] `EditFields` + `onSave` callback include `venueFacilityId`
- [x] `getVenueName()` returns "Lions Park — Diamond 1" format
- [x] Modal add/edit combobox: search across all facilities ("Lions Park — Diamond 1" as searchable options)
- [x] `BracketBuilder` dropdown uses `<optgroup>` with facilities; `Matchup.venueFacilityId` added
- [x] `PlayoffWizard` builds location string with facility name when available
- [x] Exports (XLSX, CSV, ICS) carry the full "Venue — Facility" display string
- [x] Backward compat: venues without facilities fall through as flat options

### Phase 7 — Public Schedule + Scorekeeper ✅
Files: `LocationLink.tsx`, `schedule/page.tsx` (public), `scorekeeper/page.tsx`

- [x] `LocationLink.tsx` — already correct: uses `location` prop (full display string) + `venue.address` for Maps URL
- [x] Public schedule — `game.location` carries "Lions Park — Diamond 1" automatically; no code change needed
- [x] Scorekeeper card display — changed to `game.location || card.venue?.name` (prefers full location string)
- [x] Scorekeeper filter — works at venue level (unchanged); facility-level filter deferred

### Phase 8 — DB Migrations to Prod ✅
- [x] Applied migrations 094–096 to production (2026-05-25)

---

## Deferred / Future Enhancements

- **Scorekeeper facility filter** — dropdown currently filters by venue; filtering by individual facility is a future enhancement
- **Generator facility assignment** — schedule generator currently works at venue level; letting it assign specific facilities per round is a future enhancement  
- **Scorekeeper API `venueFacilityId`** — `app/api/official/[orgSlug]/score/route.ts` doesn't yet return `venueFacilityId`; low priority since `game.location` carries the display string
- **Facility drag-to-reorder** — `display_order` column exists; drag UI not implemented

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
