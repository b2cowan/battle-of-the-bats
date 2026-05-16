# Slot-First Roster & Schedule Architecture

## PM Brief

**The problem:** Tournament admins currently can't build a schedule until teams register, and the existing "slot scheduling" feature required running the auto-generator to create slot placeholders — putting a paywallable automation feature in the critical path of basic schedule building.

**The solution:** Slots become the division roster from day one. When an admin configures a division with a capacity, team slots are created immediately (Team 1, Team 2, ... Team N). Registration fills slots automatically on a first-come-first-served basis. Admins build schedules against slots at any time — games show a team name if that slot is filled, or "Team N" if not. Publishing is an explicit admin decision with three clear states: unpublished, generic names, or real team names.

**Why it matters:** Admins can book venues and build schedules before a single team registers. The slot/schedule structure is free and always available. Automation (auto-schedule generation, playoff brackets, auto-assign) can be paywalled without blocking basic workflows.

**Success criteria:**
- Slots exist immediately when a division is configured with capacity — no generator required
- New registration auto-claims the lowest available slot; full division goes to waitlist
- Admin can reorder slots, randomize assignments, promote from waitlist
- Schedule always built against slots — no mode switching
- Admin explicitly publishes per division (or all at once): unpublished → generic names → team names
- Team names publish only available when registration is closed for that division
- Admin can revert to unpublished at any time (no data loss)
- No partial publish states — it's all-or-nothing per division

---

## Key Design Decisions

### Slots are the roster, not a schedule artifact
Pool slots are created when an admin configures capacity on a division. They represent expected teams, not scheduled games. Registration is the act of a team claiming a slot. The schedule is built on top of the slot structure.

### Auto-assignment on registration
- Registration submitted → lowest empty slot claimed, status: pending
- Division at capacity → waitlist queue (no slot number)
- Rejection/withdrawal → slot freed; admin manually promotes from waitlist
- Randomize: shuffles team-to-slot assignments (within pool boundaries)

### Publishing is explicit and reversible
`schedule_visibility` on each `age_group`:
- `unpublished` (default): admin-only, public sees "coming soon"
- `published_generic`: public sees "Team 1 vs Team 4" — available any time
- `published_teams`: public sees real names — only available when `isClosed = true`

No partial publish: a division is either all-generic or all-real-names publicly. Admin always sees true current state. Reverting to `unpublished` is the same operation as publishing — just selecting the value from a dropdown.

### Publishing with partial slots or pending teams
- Generic: always available regardless of how many slots are filled
- Team names: available when `isClosed = true`, even if some slots are still empty (those show "Team N" publicly)

### Waitlist
Waitlisted teams have a queue position but no slot number. When a slot opens, admin promotes manually (no auto-promotion). Waitlist section appears below the slot board on the registrations page.

### Automation stays optional (and paywallable)
- Auto-schedule generation (round-robin from slots) → automation, can be paywalled
- Playoff bracket generator → automation, can be paywalled
- Auto-assign teams to slots → automation, can be paywalled
- Manual slot assignment, manual schedule creation, manual promotion → always free

---

## Database Migration (`supabase/migrations/042_slot_first_roster.sql`)

```sql
-- Publishing control per division
ALTER TABLE age_groups
  ADD COLUMN IF NOT EXISTS schedule_visibility TEXT NOT NULL DEFAULT 'unpublished'
    CHECK (schedule_visibility IN ('unpublished', 'published_generic', 'published_teams'));

-- Waitlist position on registrations
-- NULL = not on waitlist; positive integer = queue position
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS waitlist_position INT DEFAULT NULL;

-- Explicit slot reference on a registration
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES pool_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_slot_id ON teams(slot_id);
```

Apply to dev and prod after writing.

Update `supabase/dev_combined_schema.sql` to include all new columns.

---

## TypeScript Type Changes (`lib/types.ts`)

### Updated `AgeGroup` interface
```typescript
scheduleVisibility?: 'unpublished' | 'published_generic' | 'published_teams';
```

### Updated `Team` interface (registration record)
```typescript
waitlistPosition?: number | null;
slotId?: string | null;
```

---

## Phase 2 — Auto-Slot Creation on Pool Configuration

**Files:** `app/api/admin/age-groups/route.ts`, `app/api/admin/pool-slots/route.ts`

### `sync-capacity` action (pool-slots API)
```
POST { action: 'sync-capacity', tournamentId, ageGroupId, pools: [{ poolId, slotCount, namePrefix }] }
```
- For each pool: insert missing slots up to `slotCount` (idempotent)
- Remove slots above `slotCount` where `team_id IS NULL` only
- If filled slots exceed new capacity: return a warning, do not delete filled slots
- Returns final slot list

### Hook into age-groups save
After saving an age group (POST/PUT), if capacity or pool config changed:
- Call `sync-capacity` for all pools in the division
- Slot names default to `{poolName} Team {N}` (e.g. "Pool A Team 1") for multi-pool, "Team {N}" for single-pool

---

## Phase 3 — Registration Auto-Assignment

**File:** `app/api/admin/teams/route.ts`

### On new registration submit
1. Fetch all pools for the age group, ordered by pool slot_number ascending
2. Find lowest slot where `team_id IS NULL` (across all pools in order)
3. If found: set `pool_slots.team_id = newTeamId`, set `teams.slot_id = slotId`, status = `pending`
4. If no empty slot: set `teams.waitlist_position = MAX(existing waitlist_position) + 1`, no slot assigned

### On rejection / withdrawal
1. If team had a slot: `pool_slots.team_id = NULL`, `teams.slot_id = NULL`
2. Slot becomes available — admin promotes from waitlist manually

### New action: `promote-from-waitlist`
```
POST /api/admin/teams { action: 'promote-from-waitlist', teamId, slotId? }
```
- If `slotId` provided: assign that specific slot
- If not: assign lowest empty slot
- Clear `waitlist_position`, set `slot_id`, update `pool_slots.team_id`
- Reorder remaining waitlist positions (close the gap)

### New action: `swap-slots` (reorder on registrations page)
```
POST /api/admin/teams { action: 'swap-slots', slotAId, slotBId }
```
- Swap `team_id` values between the two pool_slots records
- Update `teams.slot_id` for both affected teams
- Does not affect games (games reference slot IDs, not team IDs directly)

---

## Phase 4 — Registrations Page Redesign

**File:** `app/[orgSlug]/admin/tournaments/teams/page.tsx`

### Remove
- `SlotAssignmentsPanel.tsx` — functionality merged into main registrations view
- "Slot Assignments" tab

### Slot Board (main view)
- One row per slot, ordered by slot number within pool
- Pool divider headers for multi-pool divisions
- Each row: `#N | Team Name (or — empty —) | ● STATUS | ↕ reorder | actions`
- Status badges: ACCEPTED (green) / PENDING (amber) / EMPTY (muted)
- Actions per row: Accept, Reject (for pending); Remove (for accepted); none for empty
- Reorder: swap arrows between adjacent rows; or click swap icon → select target row
- **Randomize** button: shuffles team assignments randomly across all slots in division (within pool boundaries); randomizes pending AND accepted teams

### Waitlist Section
- Shown below slot board only when `waitlist_position IS NOT NULL` teams exist
- One row per waitlisted team: `#queue | Team Name | ● PENDING | [Promote]`
- Promote: assigns to lowest empty slot; disabled if no empty slots (tooltip: "No empty slots")
- Reorder: allow admin to adjust queue position by swapping rows

### Summary counts (top of page, not filter tabs)
- `N slots filled of M capacity` — accepted count
- `N pending` — pending count in slots
- `N waitlisted` — waitlist count
- `N empty slots` — unfilled slot count

---

## Phase 5 — Schedule Page Simplification

**File:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`

### Remove
- `allSlots` state and fetch (slots fetched only when needed for game modal)
- `isSlotMode`, `isModalSlotMode`, `modalUseTeams` state and all mode-detection logic
- `switchToTeamBased` function and "◎ Slot Schedule" chip
- Empty-slot message in Add Game modal
- Game type toggle in Add Game modal

### Add Game modal
- Always shows slot dropdowns (slots always exist for configured divisions)
- Fetch slots for selected division on modal open (lazy fetch, not global)
- If division has no pools configured yet: show info callout "Configure pools in Division Settings first"

### Publish Control (new, in controls bar)
Per-division dropdown next to the division selector:
```
[ ○ Unpublished ▼ ]
  ○ Unpublished
  ● Generic names
  ● Team names  (greyed + tooltip if !isClosed: "Close registration first")
```
"Publish all divisions" button: sets all divisions in tournament to same state (team names gated if ANY division is still open).

**File:** `app/api/admin/age-groups/route.ts` — PATCH to update `schedule_visibility`

---

## Phase 6 — Public Schedule Respects Visibility

**File:** `app/[orgSlug]/[tournamentSlug]/schedule/page.tsx`

- Fetch `schedule_visibility` per age group alongside games
- Filter games by division visibility:
  - `unpublished`: exclude from public view entirely
  - `published_generic`: show `pool_slots.display_name` (never resolve team names)
  - `published_teams`: show team names via existing resolution chain
- If ALL divisions are `unpublished`: show "Schedule coming soon" callout
- If SOME divisions are `unpublished`: show those divisions in division selector but with "Coming soon" placeholder instead of game list

---

## Phase 7 — Cleanup

- Delete `SlotAssignmentsPanel.tsx`
- Remove `clear-division` API action (no longer needed — slots never wiped on mode switch)
- Remove generator's slot-creation step (call `ensure` idempotently but slots pre-exist)
- Remove `delete-unassigned` action from pool-slots API (slots are permanent roster records)
- Update `SCHEDULE_SLOT_PLAN.md` header noting it is superseded by this file
- Update `supabase/dev_combined_schema.sql`
- Update `TODO.md`
- Archive old plan to `docs/archive/`

---

## Build Order

1. Phase 1 — DB migration (unblocks everything)
2. Phase 2 — Auto-slot creation on pool save (needed before 3 and 4)
3. Phase 3 — Registration auto-assignment (parallel with 2)
4. Phase 4 — Registrations page redesign (after 2 + 3)
5. Phase 5 — Schedule simplification + publish control (after 2)
6. Phase 6 — Public schedule visibility (after 5)
7. Phase 7 — Cleanup (last)

---

## Open Items / Deferred

- Drag-and-drop reorder on slot board (deferred — use swap arrows for now)
- Auto-promote from waitlist when slot opens (deferred — manual promotion only)
- Backfill: existing tournaments with no pool_slots need admin to visit Division Settings to trigger slot creation (no automated backfill)
- Automation features (auto-schedule, playoff wizard, auto-assign) remain as-is for now; paywall gating is a future billing phase
