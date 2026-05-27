# Venue Conflict Prevention & Game Timing Settings — Implementation Plan

**Created:** 2026-05-26  
**Status:** Complete — shipped 2026-05-26  
**Branch:** dev  
**Related PM brief:** `docs/active/VENUE_CONFLICT_PM_BRIEF.md`

---

## Goal

Add tournament-level game duration and buffer defaults (with per-division overrides), then use those settings to perform real-time venue conflict detection in the schedule UI — blocking hard overlaps and warning on buffer-only violations.

---

## Architecture Decisions

- **Settings storage:** JSONB `settings` columns on `divisions`, `pools`, and `venue_facilities` — matching the `tournaments.settings` pattern. No typed columns for timing; validation at the application layer.
- **Conflict severity:** Hard block on true game-window overlap. Soft warn (allow + confirm) on buffer-zone-only violation.
- **Conflict scope:** Within one tournament only. Cross-tournament deferred.
- **Conflict matching:** `venueFacilityId` first (specific surface); fall back to `venueId` (parent venue). Free-text-only `location` has no conflict check.
- **Client-side detection only (V1):** All games already loaded in the schedule page; no extra API calls needed. API-side enforcement deferred.
- **Cancelled games excluded** from all conflict checks.

---

## Verified Codebase Findings

> Corrections to the draft plan based on actual file inspection:

| # | Finding | Impact on plan |
|---|---|---|
| 1 | Division edit UI is a **modal** in `divisions/page.tsx` — NOT an inline expand panel | Timing override goes in the add/edit modal |
| 2 | **No `mapDivision()` in `lib/db.ts`** for tournament divisions — mapping is inline in the API route GET handler | Must patch `app/api/admin/divisions/route.ts` GET/POST, not lib/db.ts |
| 3 | `Division` type has **no `settings` field** — needs a typed `DivisionSettings` interface (matching `TournamentSettings` pattern) | Add `DivisionSettings` interface + `settings?: DivisionSettings` to `Division` |
| 4 | Event settings page saves via `action: 'update'` for tournament fields. Timing keys go through the **separate** `action: 'patch-settings'` call | Add a third parallel fetch in `handleSave()` for timing settings |
| 5 | `patch-settings` key whitelist (`ALLOWED_SETTINGS_KEYS`) only includes `rulesLayout` and `resourcesLayout` | Add `'game_duration_minutes'` and `'buffer_minutes'` + integer validation to the whitelist |
| 6 | `TournamentSettings` interface exists in `lib/types.ts` and is typed — new timing keys must be added there | Add optional `game_duration_minutes?: number` and `buffer_minutes?: number` to `TournamentSettings` |
| 7 | `GameList` does **not** receive a `tournament` prop | Must add `tournament?: Tournament` to `GameListProps` and thread it through from `schedule/page.tsx` |
| 8 | Generator `tournament: Tournament` prop already exists | Only needs `useState(tournament.settings?.game_duration_minutes ?? 90)` init change |
| 9 | `mapTournament()` in `lib/db.ts` **already reads `settings`** (line 2465) | No lib/db.ts change needed for tournament mapping |
| 10 | `DivisionFormPayload` type in `divisions/page.tsx` must include `settings?: DivisionSettings` | Extend the local type + form state + `openEdit()` + `handleSubmit()` |

---

## DB Migrations

### Migration 097: `settings` JSONB on `divisions`, `pools`, `venue_facilities`

**File:** `supabase/migrations/097_settings_jsonb_divisions_pools_facilities.sql`

```sql
-- divisions — primary consumer (game timing overrides)
ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- pools — future: pool-level advancement/seeding rules
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- venue_facilities — future: operating hours, booking rules
ALTER TABLE venue_facilities
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
```

Apply to **dev first**, verify, then prod.

---

## Implementation Phases

### Phase 1 — Migration + Type Layer

**Step 1.1 — Write and apply migration**
- [ ] Create `supabase/migrations/097_settings_jsonb_divisions_pools_facilities.sql` (SQL above)
- [ ] Apply to dev DB via Supabase dashboard

**Step 1.2 — Update `lib/types.ts`**

File: `lib/types.ts`

Add a `DivisionSettings` interface immediately before the `Division` interface:

```ts
/**
 * Per-division scheduling/behaviour overrides stored in divisions.settings JSONB.
 * Absent keys = inherit from tournament settings or system defaults.
 */
export interface DivisionSettings {
  /** Override the tournament default game duration (minutes). */
  game_duration_minutes?: number;
  /** Override the tournament default buffer between games (minutes). */
  buffer_minutes?: number;
}
```

Extend `TournamentSettings` (line ~13) with two new optional keys:

```ts
export interface TournamentSettings {
  rulesLayout?: 'columns' | 'single';
  resourcesLayout?: 'list' | 'grid';
  /** Default game duration in minutes for all divisions. Default: 90. */
  game_duration_minutes?: number;
  /** Required gap between games at the same venue, in minutes. Default: 15. */
  buffer_minutes?: number;
}
```

Add `settings?: DivisionSettings` to the `Division` interface (after `scheduleVisibility`):

```ts
export interface Division {
  // ... existing fields ...
  scheduleVisibility?: 'unpublished' | 'published_generic' | 'published_teams';
  /** Per-division scheduling overrides. Absent keys inherit from tournament settings. */
  settings?: DivisionSettings;
}
```

Add `settings?: Record<string, unknown>` to `Pool` (future-proofing, no consumers yet):

```ts
export interface Pool {
  id: string;
  divisionId: string;
  name: string;
  order: number;
  settings?: Record<string, unknown>;
}
```

**Step 1.3 — Update divisions API route: GET handler**

File: `app/api/admin/divisions/route.ts`, lines 90–118

Add `settings` to the inline mapping object:

```ts
return Response.json((data ?? []).map(group => ({
  // ... existing fields ...
  totalFeeAmount: group.total_fee_amount ?? null,
  totalFeeDueDate: group.total_fee_due_date ?? null,
  settings: (group.settings && typeof group.settings === 'object') ? group.settings : {}, // ← ADD
  pools: ...
})));
```

**Step 1.4 — Update divisions API route: POST handler `action === 'save'`**

File: `app/api/admin/divisions/route.ts`, lines 134–170

Add `settings` to the Supabase insert:

```ts
await supabaseAdmin.from('divisions').insert({
  // ... existing fields ...
  total_fee_due_date: data.totalFeeDueDate ?? null,
  schedule_visibility: data.scheduleVisibility ?? 'unpublished',
  settings: data.settings ?? {},  // ← ADD
})
```

**Step 1.5 — Update divisions API route: POST handler `action === 'update'`**

File: `app/api/admin/divisions/route.ts`, lines 184–201

Add `settings` to the Supabase update (merge strategy: caller owns full settings object, no server-side merge needed since it's always small and admin-only):

```ts
await supabaseAdmin.from('divisions').update({
  // ... existing fields ...
  total_fee_due_date: data.totalFeeDueDate ?? null,
  schedule_visibility: data.scheduleVisibility,
  ...(data.settings !== undefined && { settings: data.settings }),  // ← ADD
}).eq('id', id);
```

**Step 1.6 — Add `game_duration_minutes` and `buffer_minutes` to `patch-settings` key whitelist**

File: `app/api/admin/tournaments/route.ts`, lines 513–523

```ts
const ALLOWED_SETTINGS_KEYS = new Set([
  'rulesLayout',
  'resourcesLayout',
  'game_duration_minutes',  // ← ADD
  'buffer_minutes',         // ← ADD
]);
const RULES_LAYOUT_VALUES     = new Set(['columns', 'single']);
const RESOURCES_LAYOUT_VALUES = new Set(['list', 'grid']);

const sanitized: Record<string, unknown> = {};
for (const [k, v] of Object.entries(data.settings as Record<string, unknown>)) {
  if (!ALLOWED_SETTINGS_KEYS.has(k)) continue;
  if (k === 'rulesLayout'          && !RULES_LAYOUT_VALUES.has(String(v))) continue;
  if (k === 'resourcesLayout'      && !RESOURCES_LAYOUT_VALUES.has(String(v))) continue;
  // Integer validation for timing keys
  if (k === 'game_duration_minutes' && (!Number.isInteger(v) || (v as number) < 1)) continue;  // ← ADD
  if (k === 'buffer_minutes'        && (!Number.isInteger(v) || (v as number) < 0)) continue;  // ← ADD
  sanitized[k] = v;
}
```

---

### Phase 2 — Shared Conflict Utilities

**New file:** `lib/schedule-conflict.ts`

```ts
import type { Division, Game, Tournament } from './types';

export interface GameTiming {
  durationMinutes: number;
  bufferMinutes: number;
}

export const SYSTEM_TIMING_DEFAULTS: GameTiming = {
  durationMinutes: 90,
  bufferMinutes: 15,
};

/** Resolves effective timing for a game, falling back to tournament then system defaults. */
export function resolveGameTiming(
  division: Division | null | undefined,
  tournament: Tournament | null | undefined,
): GameTiming {
  const d = division?.settings ?? {};
  const t = tournament?.settings ?? {};
  return {
    durationMinutes:
      (d.game_duration_minutes ?? t.game_duration_minutes ?? SYSTEM_TIMING_DEFAULTS.durationMinutes) as number,
    bufferMinutes:
      (d.buffer_minutes ?? t.buffer_minutes ?? SYSTEM_TIMING_DEFAULTS.bufferMinutes) as number,
  };
}

/** Converts "HH:MM" to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Converts minutes since midnight to "HH:MM". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type ConflictKind = 'overlap' | 'buffer';

export interface ConflictResult {
  kind: ConflictKind;
  conflictingGame: Game;
  conflictingDivisionName: string;
  /** Suggested safe start time as "HH:MM". */
  availableAt: string;
}

/**
 * Checks a proposed game slot against all existing games for venue conflicts.
 *
 * Matching rules:
 *   venueFacilityId set → match on venueFacilityId only (specific surface)
 *   venueId only        → match on venueId (no facility set on either game)
 *   no venueId          → return null (free-text location, no check possible)
 *   cancelled games     → ignored
 *   excludeGameId       → skip self (for edit mode)
 *
 * Returns the first (chronologically earliest) conflict found.
 */
export function checkVenueConflict(params: {
  proposed: {
    date: string;
    time: string;
    venueId?: string;
    venueFacilityId?: string;
    divisionId: string;
  };
  existingGames: Game[];
  divisions: Division[];
  tournament: Tournament | null;
  excludeGameId?: string;
}): ConflictResult | null {
  const { proposed, existingGames, divisions, tournament, excludeGameId } = params;

  // No venue = no check
  if (!proposed.venueId) return null;
  if (!proposed.date || !proposed.time) return null;

  const findDivision = (id: string) => divisions.find(d => d.id === id) ?? null;

  const proposedDivision = findDivision(proposed.divisionId);
  const proposedTiming   = resolveGameTiming(proposedDivision, tournament);
  const proposedStart    = timeToMinutes(proposed.time);
  const proposedEnd      = proposedStart + proposedTiming.durationMinutes;

  // Collect candidates: same date, same venue/facility, not cancelled, not self
  const candidates = existingGames.filter(g => {
    if (g.id === excludeGameId) return false;
    if (g.status === 'cancelled') return false;
    if (g.date !== proposed.date) return false;
    if (!g.venueId) return false;

    if (proposed.venueFacilityId) {
      // Facility-level match — only conflict with games at the exact same facility
      return g.venueFacilityId === proposed.venueFacilityId;
    } else {
      // Venue-level match — only conflict with games that also have no facility set
      return g.venueId === proposed.venueId && !g.venueFacilityId;
    }
  });

  // Sort candidates chronologically so we return the earliest conflict
  candidates.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  for (const existing of candidates) {
    const existingDivision = findDivision(existing.divisionId);
    const existingTiming   = resolveGameTiming(existingDivision, tournament);
    const existingStart    = timeToMinutes(existing.time);
    const existingEnd      = existingStart + existingTiming.durationMinutes;
    const existingClear    = existingEnd   + existingTiming.bufferMinutes;
    const divisionName     = existingDivision?.name ?? 'Unknown Division';

    // Hard overlap: play windows touch or cross
    if (proposedStart < existingEnd && proposedEnd > existingStart) {
      return {
        kind: 'overlap',
        conflictingGame: existing,
        conflictingDivisionName: divisionName,
        availableAt: minutesToTime(existingEnd),
      };
    }

    // Buffer-only violation: proposed starts before the existing game's buffer clears
    if (proposedStart >= existingStart && proposedStart < existingClear) {
      return {
        kind: 'buffer',
        conflictingGame: existing,
        conflictingDivisionName: divisionName,
        availableAt: minutesToTime(existingClear),
      };
    }

    // Also check if an EXISTING game starts inside the proposed game + proposed buffer window
    if (existingStart >= proposedStart && existingStart < proposedEnd + proposedTiming.bufferMinutes) {
      // Determine kind
      const kind = existingStart < proposedEnd ? 'overlap' : 'buffer';
      return {
        kind,
        conflictingGame: existing,
        conflictingDivisionName: divisionName,
        availableAt: minutesToTime(proposedEnd + proposedTiming.bufferMinutes),
      };
    }
  }

  return null;
}
```

**Tasks:**
- [ ] Create `lib/schedule-conflict.ts` with all exports above
- [ ] (Optional) Write unit tests in `lib/__tests__/schedule-conflict.test.ts` if test infra exists — cover: no conflict, hard overlap, buffer-only, same-game exclusion, cancelled-game exclusion, facility matching, reverse-order candidates

---

### Phase 3 — Event Settings Page (Tournament-Level Timing)

File: `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`

**3.1 — Add state variables** (alongside existing state):
```ts
// Scheduling
const [gameDurationMinutes, setGameDurationMinutes] = useState(90);
const [bufferMinutes, setBufferMinutes]             = useState(15);
```
Add to `saved` initial object: `gameDurationMinutes: 90, bufferMinutes: 15`

**3.2 — Initialize from tournament data** in the `useEffect` fetch (line ~100):
```ts
// Inside the `.then(([tournaments, ...]) => {` block, after reading `t`:
const gdm = typeof t.settings?.game_duration_minutes === 'number'
  ? t.settings.game_duration_minutes : 90;
const bm  = typeof t.settings?.buffer_minutes === 'number'
  ? t.settings.buffer_minutes : 15;
setGameDurationMinutes(gdm);
setBufferMinutes(bm);
setSaved(s => ({ ...s, gameDurationMinutes: gdm, bufferMinutes: bm }));
```

**3.3 — Add to `isDirty` check:**
```ts
const isDirty =
  // ... existing comparisons ...
  || gameDurationMinutes !== saved.gameDurationMinutes
  || bufferMinutes !== saved.bufferMinutes;
```

**3.4 — Add `patch-settings` call in `handleSave()`:**  
The timing keys go through `patch-settings`, not `action: 'update'`. Add a third parallel fetch inside `Promise.all`:

```ts
const [tournamentRes, brandingRes, timingRes] = await Promise.all([
  fetch(/* existing tournament update */),
  fetch(/* existing branding PATCH */),
  fetch(`/api/admin/tournaments${orgQuery}`, {      // ← ADD
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'patch-settings',
      id: tournamentId,
      data: {
        settings: {
          game_duration_minutes: gameDurationMinutes,
          buffer_minutes: bufferMinutes,
        },
      },
    }),
  }),
]);
// Add check: if (!timingRes.ok) throw ...
```

**3.5 — UI — New "Scheduling" section** (between the date range section and the Fees section):

```
─── SCHEDULING ──────────────────────────────────────────

  Game Duration         [ 90 ] minutes
  Buffer Between Games  [ 15 ] minutes

  ℹ These defaults apply to all divisions.
    Individual divisions can override them in Division Settings.

─────────────────────────────────────────────────────────
```

Inputs: `type="number"` `min="1"` `max="480"` `step="5"` for duration; `min="0"` `max="120"` `step="5"` for buffer. Both inline with their unit label.

**Tasks:**
- [ ] Add `gameDurationMinutes` and `bufferMinutes` state + saved tracking
- [ ] Initialize from `t.settings` in the useEffect
- [ ] Extend `isDirty`
- [ ] Add `patch-settings` fetch to `handleSave()` 
- [ ] Add "Scheduling" section UI between Dates and Fees
- [ ] Update `setSaved` to include timing values on success

**3.6 — Generator pre-population**

File: `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx`, lines 34–35

```ts
// Before (hardcoded):
const [gameLength, setGameLength]   = useState(90);
const [breakLength, setBreakLength] = useState(15);

// After (reads from tournament settings; user can still override per-run):
const [gameLength, setGameLength]   = useState(
  tournament.settings?.game_duration_minutes ?? 90
);
const [breakLength, setBreakLength] = useState(
  tournament.settings?.buffer_minutes ?? 15
);
```

- [ ] Update `Generator.tsx` lines 34–35 to initialize from `tournament.settings`

---

### Phase 4 — Division-Level Timing Overrides

File: `app/[orgSlug]/admin/tournaments/divisions/page.tsx`

> **Correction from draft:** Division editing uses a **modal** (not an inline panel). Timing fields go in the existing Add/Edit modal.

**4.1 — Extend `DivisionFormPayload` type** (lines 19–36):
```ts
type DivisionFormPayload = {
  // ... existing fields ...
  settings?: import('@/lib/types').DivisionSettings;  // ← ADD
};
```

**4.2 — Extend form state** (line ~76):
```ts
const [form, setForm] = useState({
  // ... existing fields ...
  overrideTiming: false,          // ← ADD
  gameDurationMinutes: '90',      // ← ADD
  bufferMinutes: '15',            // ← ADD
});
```

**4.3 — Initialize in `openEdit()`** (line ~117):
```ts
overrideTiming: !!(g.settings?.game_duration_minutes || g.settings?.buffer_minutes),
gameDurationMinutes: g.settings?.game_duration_minutes
  ? String(g.settings.game_duration_minutes) : '90',
bufferMinutes: g.settings?.buffer_minutes
  ? String(g.settings.buffer_minutes) : '15',
```

**4.4 — Initialize in `openAdd()`** (line ~106):
```ts
overrideTiming: false, gameDurationMinutes: '90', bufferMinutes: '15',
```

**4.5 — Build `settings` in `handleSubmit()`** (before building `data`):
```ts
const divisionSettings: import('@/lib/types').DivisionSettings = form.overrideTiming ? {
  game_duration_minutes: Number(form.gameDurationMinutes),
  buffer_minutes:        Number(form.bufferMinutes),
} : {};
// Add to data payload:
const data: DivisionFormPayload = {
  // ... existing fields ...
  settings: divisionSettings,  // ← ADD
};
```

**4.6 — Add "Game Timing" section to the modal UI** (inside the modal `<form>`, after the playoff/fees sections and before the footer):

```
─── GAME TIMING ─────────────────────────────────────

  ○ Use event defaults  (90 min + 15 min buffer)
  ● Override for this division
       Game Duration [ 70 ] min   Buffer [ 10 ] min

─────────────────────────────────────────────────────
```

- Inherited values shown in the "Use event defaults" label derive from `currentTournament.settings`
- Radio toggle: `form.overrideTiming` controls visibility of the number inputs
- Both inputs: `type="number" min="1" max="480" step="5"` (duration); `min="0" max="120" step="5"` (buffer)

**Tasks:**
- [ ] Extend `DivisionFormPayload` with `settings?`
- [ ] Extend form state with `overrideTiming`, `gameDurationMinutes`, `bufferMinutes`
- [ ] Update `openEdit()` to initialize timing fields from `g.settings`
- [ ] Update `openAdd()` to initialize timing fields to defaults
- [ ] Build `settings` object in `handleSubmit()` and include in payload
- [ ] Add Game Timing UI section to the division modal

---

### Phase 5 — Add/Edit Game Modal (Conflict Detection)

File: `app/[orgSlug]/admin/tournaments/schedule/page.tsx`

**5.1 — Add conflict state** near other modal state:
```ts
const [modalConflict, setModalConflict] = useState<import('@/lib/schedule-conflict').ConflictResult | null>(null);
const [conflictDismissed, setConflictDismissed] = useState(false);
```

**5.2 — Compute conflict reactively** (inside a `useEffect` or `useMemo` in the modal context):
```ts
useEffect(() => {
  if (!form.venueId || !form.date || !form.time || !currentTournament) {
    setModalConflict(null);
    return;
  }
  const result = checkVenueConflict({
    proposed: {
      date: form.date,
      time: form.time,
      venueId: form.venueId,
      venueFacilityId: form.venueFacilityId || undefined,
      divisionId: form.divisionId,
    },
    existingGames: games,
    divisions,
    tournament: currentTournament,
    excludeGameId: editing?.id,
  });
  setModalConflict(result);
  setConflictDismissed(false);
}, [form.venueId, form.venueFacilityId, form.date, form.time, form.divisionId, games, divisions, currentTournament, editing?.id]);
```

**5.3 — Reset `conflictDismissed`** when venue/date/time changes (handled by the effect above).

**5.4 — Conflict UI** (inside the modal `<form>`, immediately after the time input `<div>`):

**Hard overlap (`kind === 'overlap'`):**
```jsx
<div style={{ /* red panel */ }}>
  🚫 Venue in use — {conflict.conflictingDivisionName}
  <br />
  {resolveTeam(conflict.conflictingGame.homeTeamId, conflict.conflictingGame.homePlaceholder)} vs{' '}
  {resolveTeam(conflict.conflictingGame.awayTeamId, conflict.conflictingGame.awayPlaceholder)} runs here until {formatTime(conflict.availableAt)}.
  <br />
  <button onClick={() => setForm(f => ({ ...f, time: conflict.availableAt }))}>
    Use {formatTime(conflict.availableAt)} ↑
  </button>
</div>
```
Save button: add `disabled={modalConflict?.kind === 'overlap' && !conflictDismissed}` — overlap is hard-blocked, dismissed flag not applicable here (no Save anyway).

**Buffer warn (`kind === 'buffer'`):**
```jsx
<div style={{ /* amber panel */ }}>
  ⚠ Tight turnaround — {conflict.conflictingDivisionName}
  ...ends at ... Starting before the {bufferMinutes}-min buffer clears.
  Recommended: {formatTime(conflict.availableAt)}
  <button onClick={() => setForm(f => ({ ...f, time: conflict.availableAt }))}>Use {formatTime(conflict.availableAt)}</button>
  <button onClick={() => setConflictDismissed(true)}>Save anyway →</button>
</div>
```
Save button: remains enabled. "Save anyway" sets `conflictDismissed = true` and submits.

**Tasks:**
- [ ] Import `checkVenueConflict`, `ConflictResult`, `formatTime` at top of schedule/page.tsx
- [ ] Add `modalConflict` and `conflictDismissed` state
- [ ] Add conflict-detection `useEffect` triggered by venue/date/time/division changes
- [ ] Add conflict UI panel below time input in the modal form
- [ ] Disable Save button on `kind === 'overlap'`; keep enabled on `kind === 'buffer'`
- [ ] "Use [time]" button snaps form.time and re-runs check
- [ ] "Save anyway" button for buffer violations

---

### Phase 6 — GameList Inline Edit (Conflict Detection)

File: `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`

**6.1 — Add `tournament` prop** to `GameListProps`:
```ts
interface GameListProps {
  // ... existing props ...
  tournament?: Tournament | null;  // ← ADD (optional for backward compat)
}
```

**6.2 — Thread `tournament` through** from `schedule/page.tsx`:
```tsx
<GameList
  // ... existing props ...
  tournament={currentTournament}  // ← ADD
/>
```

**6.3 — Conflict check on inline field change:**  
In the `EditFields` inline save handler and on time/venue field changes, run `checkVenueConflict()` against the full `games` prop with `excludeGameId: g.id`.

**6.4 — Compact inline conflict warning** below the time input in the row editor:
- Overlap: red, "Venue in use — [Division] until [time]. [Use [time]]", disable row Save
- Buffer: amber, "Tight — [time] buffer. [Use [time]] [Save anyway]"

**Tasks:**
- [ ] Add `tournament?: Tournament | null` to `GameListProps`
- [ ] Thread `tournament` from `schedule/page.tsx`
- [ ] Import `checkVenueConflict` in `GameList.tsx`
- [ ] Add per-row conflict state (`Record<string, ConflictResult | null>`)
- [ ] Run check on time/venue field change in inline editor
- [ ] Show compact conflict panel below time input
- [ ] Block Save on overlap, allow on buffer with "Save anyway"

---

### Phase 7 — Conflict Badges on Game List Rows (Read Mode)

File: `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`

**7.1 — Compute conflict map** at the GameList level:
```ts
const conflictMap = useMemo(() => {
  if (!tournament) return new Map<string, ConflictResult>();
  const map = new Map<string, ConflictResult>();
  for (const game of games) {
    if (!game.venueId || !game.date || !game.time) continue;
    const result = checkVenueConflict({
      proposed: {
        date: game.date, time: game.time,
        venueId: game.venueId,
        venueFacilityId: game.venueFacilityId,
        divisionId: game.divisionId,
      },
      existingGames: games,
      divisions,
      tournament,
      excludeGameId: game.id,
    });
    if (result) map.set(game.id, result);
  }
  return map;
}, [games, divisions, tournament]);
```

**7.2 — Render conflict badge** in each row's time cell (read mode):
- `kind === 'overlap'` → red `⊘` icon, title: `Overlaps [Division] — [Home] vs [Away]`
- `kind === 'buffer'`  → amber `⚠` icon, title: `Within buffer of [Division] — [Home] vs [Away]`

**Tasks:**
- [ ] Add `conflictMap` useMemo (Phase 7.1 above)
- [ ] Render conflict badge icon in time column of read-mode rows
- [ ] Use `title` attribute for tooltip text (upgrade to custom tooltip later if /design recommends)

---

## Migration Apply Order

1. Write `097_settings_jsonb_divisions_pools_facilities.sql`
2. Apply to **dev** DB
3. Complete Phases 1–7
4. Browser verify (user): division timing save, event timing save, conflict block, conflict warn, conflict badges
5. Apply migration to **prod** DB

---

## Out of Scope (Deferred)

- Auto-generator conflict highlighting (separate generator upgrade project)
- API-side conflict enforcement (server-side rejection of overlapping saves)
- Cross-tournament conflict scope
- Free-text location conflict matching
- `pools.settings` and `venue_facilities.settings` UI consumers (columns added, no feature yet)

---

## Success Criteria

- [ ] Admin scheduling at an occupied venue sees a hard block with one-click time fix
- [ ] Admin scheduling in the buffer zone sees an amber warning with "Save anyway" option
- [ ] Conflict badges appear on game list rows for pre-existing overlaps
- [ ] Tournament-level game duration and buffer settings persist in `tournaments.settings`
- [ ] Division-level overrides persist in `divisions.settings` and are reflected in conflict calculations
- [ ] Generator initializes from tournament settings instead of hardcoded values
- [ ] Zero regression on existing schedule CRUD (add, edit, cancel, delete, publish)
- [ ] Migration 097 applied cleanly to both dev and prod
