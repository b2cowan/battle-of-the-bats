# Pre-Registration Schedule Builder (Pool Slot Scheduling)

> **SUPERSEDED** — This plan has been replaced by [SLOT_ROSTER_PLAN.md](SLOT_ROSTER_PLAN.md), which adopts a slot-first roster architecture where slots are auto-created on division configuration rather than requiring the generator. The DB foundation from Phase 1 of this plan (migration 041, types, db.ts) remains in place and is reused by the new plan.



## PM Brief

**The problem:** Tournament admins can't generate pool-play schedules until teams register and are assigned to pools. This blocks field/venue booking, schedule communication, and early bracket publishing — all tasks that need to happen before registration closes.

**The solution:** A new "slot-based" schedule generation mode. The admin defines how many teams a pool holds (already tracked as capacity), hits "Generate Slot Schedule," and gets a full round-robin schedule using generic slot names ("Pool A Team 1 vs Pool A Team 6"). As teams register, the admin assigns them to slots one at a time. When the last slot in a pool is filled, all games in that pool atomically flip to real team names — on both the admin and public views.

**Why it matters:** Organizers can book venues weeks before registration closes. Sponsors and parents can see the schedule structure early. Seeding decisions (who goes in Slot 1 vs Slot 2) are an explicit admin choice, not an automatic sort — giving organizers control over early matchups.

**Success criteria:**
- Admin can generate a complete pool-play schedule with zero registered teams
- Assigning a team to a slot takes one action and updates all their games instantly
- Public schedule shows slot names until all slots in a pool are filled, then flips atomically to real names
- No regression to existing team-based scheduling workflow
- Re-assigning or swapping teams between slots cascades correctly

---

## Key Design Decisions

### Two explicit generation modes

Admins choose at generation time:

| Mode | When to use | Requires teams? |
|---|---|---|
| **Slot-based** (new) | Build skeleton before or after registration; control seeding explicitly | No — uses pool capacity/slot count |
| **Team-based** (existing) | All teams registered and assigned; auto-fill names directly | Yes — all teams must be in pool |

Neither mode produces a mixed schedule. If the admin picks slot-based, every game in that pool uses slot placeholders until explicitly assigned.

### Atomic public display

- Admin view: always shows true current state (e.g. "Milton Heat vs Pool A Team 2" during partial assignment — the admin knows what they're doing)
- Public view: shows slot names ("Pool A Team 1 vs Pool A Team 6") until **every slot in that pool is assigned**. At that point, all game records for the pool are updated with real team IDs in a single batch operation. If any slot is later unassigned, the pool reverts to slot-name display for the public.

This is implemented via a cascade: when the last slot in a pool is assigned, the API bulk-updates `home_team_id`/`away_team_id` on all games for that pool. No display-layer logic change needed — the existing "teamId → placeholder → TBD" resolution chain handles it automatically.

### Slot records are persistent

Pool slots are stored as rows in `pool_slots`. They are created when the admin generates a slot-based schedule (or can be auto-created when a pool is configured with capacity). They persist until the game schedule for that pool is deleted. This allows re-assignment, swapping, and tracking without regenerating the schedule.

---

## Database Schema Changes

### Migration: Add `pool_slots` table

```sql
CREATE TABLE pool_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  tournament_id   uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  age_group_id    uuid NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  slot_number     int  NOT NULL,
  display_name    text NOT NULL, -- e.g. "Pool A Team 1", customizable
  team_id         uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(pool_id, slot_number)
);

CREATE INDEX idx_pool_slots_pool_id       ON pool_slots(pool_id);
CREATE INDEX idx_pool_slots_tournament_id ON pool_slots(tournament_id);
CREATE INDEX idx_pool_slots_team_id       ON pool_slots(team_id);
```

### Migration: Add slot FK columns to `games`

```sql
ALTER TABLE games
  ADD COLUMN home_slot_id uuid REFERENCES pool_slots(id) ON DELETE SET NULL,
  ADD COLUMN away_slot_id uuid REFERENCES pool_slots(id) ON DELETE SET NULL;

CREATE INDEX idx_games_home_slot_id ON games(home_slot_id);
CREATE INDEX idx_games_away_slot_id ON games(away_slot_id);
```

---

## TypeScript Type Changes (`lib/types.ts`)

### New `PoolSlot` interface

```typescript
export interface PoolSlot {
  id: string;
  poolId: string;
  tournamentId: string;
  ageGroupId: string;
  slotNumber: number;
  displayName: string;   // e.g. "Pool A Team 1"
  teamId?: string | null;
  teamName?: string;     // Joined from teams table for convenience
}
```

### Updated `Game` interface

```typescript
// Add to existing Game interface:
homeSlotId?: string;   // FK to pool_slots — set for slot-based games
awaySlotId?: string;
```

---

## Phase 1 — Database Migration

**File:** `supabase/migrations/040_pool_slots.sql`

- [x] Create `pool_slots` table (see SQL above)
- [x] Add `home_slot_id`, `away_slot_id` to `games` table (see SQL above)
- [x] Apply migration to dev DB and prod — applied 2026-05-16
- [x] Add `PoolSlot` interface to `lib/types.ts`
- [x] Update `Game` interface in `lib/types.ts` to include `homeSlotId`, `awaySlotId`
- [x] Update `lib/db.ts` — extend `getGames()`, `saveGame()`, `updateGame()` to map `homeSlotId`/`awaySlotId`
- [x] Update `supabase/dev_combined_schema.sql` with new tables/columns
- [x] Update `app/api/admin/games/route.ts` bulk-save to pass slot FK columns (also fixed missing playoff fields in bulk-save)

---

## Phase 2 — Slot-Mode Schedule Generator

**Files:** `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx`, `app/api/admin/games/route.ts`, new `app/api/admin/pool-slots/route.ts`

### Generator UI changes (`Generator.tsx`)

- [x] Add "Generation Mode" radio/toggle at top of generator form
- [x] In slot-based mode, show per-pool slot count input (default: ageGroup.capacity ÷ poolCount, fallback 4)
- [x] Warning if no pools configured for division (error banner directing admin to Division Settings)

### Slot-based generation algorithm (`Generator.tsx`)

- [x] Slot-based generation: round-robin from slot count, double-booking checked by slot key
- [x] BYE handling: odd slot count adds BYE, games involving it are skipped
- [x] Preview shows slot names with SLOT SCHEDULE badge and info callout
- [x] Commit flow: delete-division-games → delete-unassigned slots → ensure slots → bulk-save with resolved slot IDs

### New API route (`app/api/admin/pool-slots/route.ts`)

- [x] `GET ?tournamentId=&ageGroupId=` — returns all pool slots with joined team name
- [x] `POST action:'ensure'` — idempotent slot creation per pool
- [x] `POST action:'rename'` — renames slot + cascades to game placeholders
- [x] `POST action:'assign'` — assigns team, atomic cascade when pool fully assigned
- [x] `POST action:'unassign'` — clears team + reverts all game team IDs in pool
- [x] `POST action:'swap'` — swaps two slots, re-evaluates and cascades
- [x] `POST action:'delete-unassigned'` — cleans up unassigned slots before regeneration

### Games API update (`app/api/admin/games/route.ts`)

- [x] `bulk-save` action: accepts and persists `homeSlotId`, `awaySlotId`, and all playoff fields

---

## Phase 3 — Slot Assignment UI

**Files:** `app/[orgSlug]/admin/tournaments/teams/page.tsx` (new panel), or new tab `schedule/slots/page.tsx`

Recommendation: add a **"Slot Assignments" tab** within the existing teams admin page (alongside the team list). This keeps team and slot management co-located.

### Slot Assignments panel

- [x] Per-pool section: pool name + progress badge (amber → green when complete)
- [x] Slot table: Slot # | editable display name | assigned team dropdown | swap button
- [x] Dropdown excludes teams already assigned to other slots
- [x] **Assign/Unassign**: unified via dropdown change (empty = unassign)
- [x] **Swap**: click swap icon on slot A → banner appears → click ↔ on slot B → confirmed
- [x] **Rename**: inline input, saves on blur, cascades to game placeholders
- [x] Info callout when pool hits 100%: "Public schedule shows real team names for this pool"

### Teams page integration

- [x] "Slot Assignments" tab added alongside "Registrations" tab
- [x] Tab uses existing `.tab-btn` / `.tab-btn.active` global styles
- [x] Division selector in controls bar drives both tabs
- [x] Empty state guides admin to Schedule page if no slots exist for the division

---

## Phase 4 — Display & Polish

**Files:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx`

### Admin schedule page

- [x] Fixed `getTeamName()` bug in GameList.tsx and schedule/page.tsx — now returns `null` for unresolved IDs so `resolveTeam(id, placeholder)` correctly falls through to placeholder text
- [x] Added SLOT badge on slot-based non-playoff game rows in admin GameList
- [x] Search and CSV export now use `resolveTeam()` (shows slot names instead of 'TBD')
- [x] Manual "Add Game" modal: slot dropdowns when division is in slot mode; team dropdowns otherwise. Mode inferred from presence of pool_slots for the division. Slot IDs/placeholders saved on game record.

### Public schedule page

- [x] No display logic change needed — atomic cascade means `homeTeamId` is only populated once all slots assigned. Existing `getTeamDisplay()` chain (teamId → placeholder → 'TBD') already handles it.
- [x] Verified: public schedule shows slot names via `homePlaceholder` until pool is fully assigned.

### Schedule Generator UX

- [ ] If admin tries to run "Team-based" generation for a pool that already has slot-based games: show a warning "This pool has a slot-based schedule. Switching to team-based will delete slot records and game assignments. Proceed?"
- [ ] If admin tries to run "Slot-based" generation for a pool that already has team-based games: show a warning "This will replace existing games with a slot-based schedule. Team names will not appear publicly until all slots are assigned."

### Division mode indicator (schedule page)

- [x] "◎ Slot Schedule" chip in filtersRow — visible when current division has slot records; clicking opens "Switch to team-based" danger confirm modal
- [x] `switchToTeamBased()` calls new `clear-division` API action which deletes all pool_slots + games for the division, then refreshes
- [x] `clear-division` action added to `app/api/admin/pool-slots/route.ts`
- [x] All tournament's pool_slots fetched in `refresh()` and stored in `allSlots` state; mode derived per-division from this array (no separate effect needed)

---

## Build Order

1. Phase 1 (DB + types) — no UI, unblocks everything else
2. Phase 2 (Generator + pool-slots API) — enables creating slot schedules
3. Phase 3 (Assignment UI) — enables assigning teams to slots
4. Phase 4 (Display polish) — verifications and admin UX refinement

Phases 2 and 3 can be built in parallel once Phase 1 is done.

---

## Open Questions (decide before Phase 2)

1. **Slot count source**: should slot count default to `pool.capacity` (if set) or `ageGroup.capacity ÷ poolCount`? Or always require admin to enter it manually in the generator? Recommendation: auto-fill from capacity but allow override.
2. **Slot naming convention**: default to "Pool A Team 1" / "Pool A Team 2"? Or just "Team 1" / "Team 2" with pool grouping implied? Recommendation: include pool name in the slot label for clarity on the public schedule.
3. **Existing tournaments migration**: slot records only exist for newly-generated slot schedules. Existing team-based games are unaffected. No backfill needed.
