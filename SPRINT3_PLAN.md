# Sprint 3 Implementation Plan — Logic-Sync Bracket (Phase 3)

**Date:** 2026-05-04  
**Branch:** dev  
**Phase:** 3 — Logic-Sync Bracket (SVG Blueprint public bracket view)  
**Prerequisite:** Sprint 2 complete and deployed.

---

## 1. Pre-Implementation Findings

### Exact file path of the public bracket view

There is **no dedicated bracket page or route**. The bracket is embedded in:

```
app/[orgSlug]/schedule/page.tsx
```

The `PublicBracketColumns` function and `buildBracketColumns` helper are defined at the top of
that file. The bracket view is rendered when `viewMode === 'playoff' && bracketLayout === 'bracket'`.
There is no separate `bracket/page.tsx` — the entire schedule+bracket experience lives in one
large `'use client'` page component.

### Realtime subscriptions — status

**None.** The page fetches data once on mount via `useEffect` calling `getGames(tournamentId)` and
`getTeams(tournamentId)` from `lib/db`. There is no Supabase Realtime channel anywhere in the file.

→ **Realtime subscription must be added as part of Phase 3.**

### Current data shape

Games are loaded via `getGames(tournamentId)` which queries `games` filtered by `tournament_id`.
The returned `Game` objects have:

| Type field     | DB column       | Notes                                      |
|----------------|-----------------|--------------------------------------------|
| `homeTeamId`   | `home_team_id`  | UUID or nil-UUID for TBD slots             |
| `awayTeamId`   | `away_team_id`  |                                            |
| `homeScore`    | `home_score`    | nullable                                   |
| `awayScore`    | `away_score`    | nullable                                   |
| `status`       | `status`        | `'scheduled' \| 'completed' \| 'cancelled'` |
| `isPlayoff`    | `is_playoff`    |                                            |
| `bracketCode`  | `bracket_code`  | e.g. `QF1`, `SF2`, `FIN`, `3RD`           |
| `homePlaceholder` | `home_placeholder` | e.g. `"Winner QF1"` for TBD slots    |
| `awayPlaceholder` | `away_placeholder` |                                       |

### Team names — resolved or not?

**Resolved.** The schedule page loads a `teams` array via `getTeams(tournamentId)` and the
`getTeamDisplay(game, isHome)` helper looks up team names from that array. Team names are NOT on
the games table — the join happens in application code, not the DB query.

### Critical schema deviations from the implementation plan

The `FIELDLOGIC_IMPLEMENTATION_PLAN.md` Phase 3 section was written before confirming the real
schema. The following fields referenced in the plan **do not exist** and must be adapted:

| Plan field          | Reality                              | Fix                                         |
|---------------------|--------------------------------------|---------------------------------------------|
| `score_a`, `score_b`| `homeScore`, `awayScore` in Game type | Use correct field names                     |
| `status === 'live'` | No `'live'` status — only `'scheduled' \| 'completed' \| 'cancelled'` | `is_live` = transient client state (5s flash on Realtime update) |
| `winner_id`         | No `winner_id` column                | Compute: `homeScore > awayScore ? homeTeamId : awayTeamId` |
| `team_a_name`, `team_b_name`, `winner_team_name` | Not on games table | Resolve via teams array (already loaded)   |
| `org_id=eq.{orgId}` Realtime filter | No `org_id` on games table | Filter by `tournament_id=eq.{tournamentId}` |

### Critical filter bug in schedule/page.tsx

The `filtered` array currently includes only `status === 'scheduled'` games:

```typescript
const filtered = games.filter(g =>
  g.ageGroupId === activeGroup &&
  g.status === 'scheduled' &&          // ← BUG: excludes completed bracket games with scores
  (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
);
```

Completed bracket games (with `homeScore`/`awayScore` set) are entirely invisible to the bracket
view today. A separate `bracketGames` computation that includes all non-cancelled statuses is
required to display scores in the bracket.

### Structural risks

- **Scope of schedule/page.tsx changes**: The schedule page is a large monolithic component
  (~554 lines). We are only touching the bracket data filter and the bracket render block —
  all list-view logic, pool inference, date grouping, and tab controls are untouched.
- **Supabase Realtime filter**: Must use `tournament_id=eq.{tournamentId}` not `org_id`. This
  is different from the LiveLogicProvider (which uses `org_id`). Phase 3's filter is correct
  only when `tournamentId` is known.
- **Winner computation**: Must guard against null/zero scores —
  `homeScore !== null && awayScore !== null && homeScore !== awayScore`.
- **No `winner_id` → bracket advancement**: The SVG component shows the winner visually
  (highlighted team name + score) but does not set advancement placeholders — that is handled
  by the admin results flow, not this component.

---

## 2. Goals and User-Facing Purpose

### Problem this solves

Spectators and coaches attending a tournament currently see a list of playoff games. The bracket
view exists but shows only scheduled games with no scores, no visual advancement, and no live
updates. Once a QF game ends, the score appears only on the Results page — coaches must navigate
away and refresh manually.

### Before vs. after

**Before:**
- Bracket view shows cards with date/time/location only — no scores, no winner highlight
- Static: data loaded once on page mount, never updates
- Completed games are invisible in the bracket (filtered to status=scheduled only)
- Per-org purple theme (`var(--primary)` tokens), rounded card corners, inline styles

**After:**
- SVG blueprint layout with Blueprint Blue connector lines and HUD-surface match nodes
- Scores displayed in IBM Plex Mono; winning team highlighted in Logic Lime
- Completed games visible in bracket with final scores
- LIVE badge (Logic Lime) flashes on a game node for 5 seconds after a Realtime score update
- Logic Lime animated dash runs along connector lines from a game with a winner
- No page refresh required — bracket state updates in real-time as scores are entered

### What "live" means in practice

When an admin enters a score via the results panel or Tactical HUD, a Supabase Postgres Changes
event fires. `LogicSyncBracket` receives it, updates the affected game node's scores and winner,
pulses the LIVE badge on that node for 5 seconds, and the connector line to the next round
animates the Logic Lime dash. No spinner, no flash-of-loading — the bracket updates in place.

---

## 3. Full Task Checklist

### Build order (dependencies flow top to bottom)

```
Step 1 — lib/types/bracket.ts            (new — schema-corrected types)
Step 2 — components/bracket/LogicSyncBracket.tsx  (new — SVG component + Realtime)
Step 3 — app/[orgSlug]/schedule/page.tsx (modify — fix filter bug + wire component)
Step 4 — Update FIELDLOGIC_IMPLEMENTATION_PLAN.md checklists
Step 5 — Update TODO.md
```

---

### Step 1 — `lib/types/bracket.ts` *(new file)*

Schema-corrected version of the plan's types. Differences from plan:
- Field names use app-layer camelCase (`homeScore` not `score_a`)
- `is_live` is a client-only transient field, not a DB column
- `winner_id` replaced with `winnerId` computed from scores

```typescript
export interface BracketNode {
  id: string;
  round: number;
  position: number;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerId: string | null;   // computed — not a DB column
  bracketCode: string;
  isLive: boolean;           // transient client state — 5s flash on Realtime update
}
```

---

### Step 2 — `components/bracket/LogicSyncBracket.tsx` *(new file)*

New `'use client'` SVG bracket component. Extracted from the inline `PublicBracketColumns`
logic, upgraded to SVG layout, HUD styling, and Realtime subscription.

**Props:**
```typescript
interface LogicSyncBracketProps {
  games: Game[];             // playoff games for this age group (all statuses)
  teams: Team[];             // all teams for this tournament
  tournamentId: string;
}
```

**Internals:**
- Builds `BracketNode[]` from `games` + `teams` using `buildBracketColumns` column logic adapted
  from the existing schedule page
- `winnerId` computed: `homeScore !== null && awayScore !== null && homeScore !== awayScore`
  → higher score wins
- Realtime subscription on `games` table, filter `tournament_id=eq.{tournamentId}`, event `UPDATE`
- On Realtime update: merge new `home_score`/`away_score`/`status` into local node state,
  set `isLive = true`, clear after 5s via `setTimeout`
- Uses `createClient` from `@/lib/supabase-browser`

**SVG layout:**
- Layout constants match plan: `ROUND_WIDTH=240`, `NODE_HEIGHT=80`, `NODE_GAP=20`,
  `NODE_WIDTH=200`, `CONNECTOR_STUB=40`
- `getNodeY(position, round)` formula from plan: `(NODE_HEIGHT + NODE_GAP) * 2^round * position`
- SVG `<defs>` with `glow-lime` and `glow-blue` filters (exactly as plan)
- `ConnectorPath`: Blueprint Blue base line + Logic Lime animated dash when `isLive || winnerId`
- `MatchNode`: HUD surface rect, divider line, IBM Plex Mono team names and scores, LIVE badge
- Winner team name color: Logic Lime; losing team: `var(--data-gray)` / `#94A3B8`
- Horizontal scroll wrapper for wider brackets (same `overflowX: auto` pattern as existing)

**Pool split support:**
- If `hasPoolPlaceholders`, render one `<LogicSyncBracket>` per pool with filtered games
- Pool detection logic reused from schedule page (same `inferPool` helper — moved or referenced)

**HUD tokens used (two-namespace rule enforced):**
- `var(--hud-surface)` — match node background (`#111827`)
- `var(--blueprint-blue)` — connector lines, node border at rest (`#1E3A8A`)
- `var(--logic-lime)` — score text, winner highlight, LIVE badge, animated dash (`#D9F99D`)
- `var(--data-gray)` — losing team name, meta text (`#94A3B8`)
- `var(--fl-text)` — team name default color (`#F1F5F9`)
- `var(--font-data)` — IBM Plex Mono for scores/labels
- **NOT used:** `var(--surface)`, `var(--border)`, `var(--radius)`, `var(--primary)` or any
  org-theme tokens

**Loading / empty states:**
- `<HudSkeleton message="COMPUTING BRACKET MATRIX..." rows={4} />` while data loads
- Trophy + `"No playoff games scheduled yet."` empty state (existing copy preserved)

---

### Step 3 — `app/[orgSlug]/schedule/page.tsx` *(modify)*

**Two surgical changes only. Do not touch list view, pool inference, tabs, or any other logic.**

**Change A — Fix bracket games filter (add `bracketGames` array):**
```typescript
// Add alongside the existing `filtered` const:
const bracketGames = games.filter(g =>
  g.ageGroupId === activeGroup &&
  g.status !== 'cancelled' &&          // include scheduled + completed
  g.isPlayoff
);
```

**Change B — Replace `PublicBracketColumns` usage with `LogicSyncBracket`:**

In the bracket-view block (`viewMode === 'playoff' && bracketLayout === 'bracket'`), replace
the `<PublicBracketColumns ... />` JSX with `<LogicSyncBracket>`:

```tsx
// Before (single flat bracket):
<div style={bracketWrap}>
  <PublicBracketColumns
    columns={buildBracketColumns(filtered)}
    getTeamDisplay={getTeamDisplay}
    formatDateShort={formatDateShort}
  />
</div>

// After:
<LogicSyncBracket
  games={bracketGames}
  teams={teams}
  tournamentId={selectedTournament.id}
/>
```

Same swap for the pool-split case (replace inner `<PublicBracketColumns>` with per-pool
`<LogicSyncBracket games={poolGames} ... />`).

**Do NOT remove `PublicBracketColumns`, `buildBracketColumns`, or `bracketPriority`** from the
file until `LogicSyncBracket` is confirmed working — leave them as dead code temporarily so
the fallback exists during testing.

**Imports to add:**
```typescript
import { LogicSyncBracket } from '@/components/bracket/LogicSyncBracket';
```

---

### Step 4 — `FIELDLOGIC_IMPLEMENTATION_PLAN.md`

Check off completed Phase 3 items as implementation finishes.

### Step 5 — `TODO.md`

Add one-line summary entry linking to this file. Mark Phase 3 in progress.

---

## 4. Scope Decision

**Recommendation: Full SVG rewrite as a new extracted component — NOT a styling pass on the existing `PublicBracketColumns`.**

Rationale:
1. The existing `PublicBracketColumns` displays zero scores, uses per-org theme tokens, has no
   Realtime capability, and uses `position: absolute` divs as connectors. A styling pass would
   require gutting nearly every line.
2. The plan explicitly specifies SVG connectors and a blueprint layout — this is not achievable
   with the existing absolute-positioned divs approach.
3. The existing component is embedded inline in the schedule page — extracting it as a proper
   component (with its own Realtime subscription and state) is the right architectural boundary.
4. The schedule page's data loading (`games`, `teams`) is reused as props — we're not changing
   how data is fetched, only how the bracket is rendered once we have it.
5. The filter bug (completed games hidden) must be fixed regardless of approach.

The schedule page is otherwise left completely unchanged — all list view logic, pool inference,
year selector, tab controls, and page structure stay exactly as-is.

---

## 5. Questions and Blockers

### 5.1 — Supabase Realtime on `games` table (BLOCKER — user action required)

The `LogicSyncBracket` Realtime subscription will not receive events until the `games` table
has Postgres replication enabled. This is the same requirement as Sprint 2's `LiveEventLog` and
`LiveLogicProvider`.

**User action:** Supabase Dashboard → Database → Replication → enable `games` table.  
(If Sprint 2 Realtime has already been enabled and tested, this is already done.)

### 5.2 — No `winner_id` column — visuals only

The bracket will correctly show which team has more runs (Logic Lime highlight), but it does
NOT advance teams to the next round automatically. Winner advancement is handled by the admin
results workflow (which calls `updateBracketFromResult` in `lib/db.ts`). The bracket is a
read-only display — no DB writes happen from this component.

### 5.3 — No `'live'` status in DB — LIVE badge is cosmetic only

Since `GameStatus` has no `'live'` value, the LIVE badge uses a 5-second timeout triggered by
Realtime updates. A game being actively scored shows LIVE momentarily; it's removed when the
timeout fires. This matches the intent of the plan (visual feedback on score changes) without
requiring a DB schema change.

### 5.4 — Connector line layout for Finals + 3rd Place column

The `Finals` column in the existing data often contains both a `FIN` game and a `3RD` game.
The SVG Y-position algorithm assumes each round has `2^(rounds - round - 1)` games. With mixed
FIN/3RD in one column, vertical centering needs care. The `LogicSyncBracket` will use the
`buildBracketColumns` logic from the existing page to group games into columns, then apply
Y positions per column, not globally — this is safer than a global tree algorithm for
irregular brackets (split pools, custom round codes).

### 5.5 — No confirmation needed

No user questions are blocking the plan. The scope is clear, the deviations are handled
internally (schema corrections, filter fix), and the Realtime table replication is a
prerequisite the user has already been informed of. Ready to proceed on user approval.

---

## 6. File Map

| File | Action | Type |
|------|--------|------|
| `lib/types/bracket.ts` | Create new | New types |
| `components/bracket/LogicSyncBracket.tsx` | Create new | New SVG component + Realtime |
| `app/[orgSlug]/schedule/page.tsx` | Modify (2 surgical changes) | Filter fix + component swap |
| `FIELDLOGIC_IMPLEMENTATION_PLAN.md` | Update checklists | Docs |
| `TODO.md` | Add Sprint 3 summary line | Docs |

**Files explicitly NOT modified:**
- `app/[orgSlug]/admin/schedule/components/BracketBuilder.tsx` — admin tool, must not be touched
- `app/[orgSlug]/schedule/schedule.module.css` — list view styling unaffected
- All other schedule page logic (list view, pool inference, tabs, year selector)
