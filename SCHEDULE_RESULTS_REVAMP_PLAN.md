# Schedule / Results Revamp — Implementation Plan

## Goals
- Consolidate two confusing pages (Schedule + Results) into two focused pages: **Schedule** (all game data) and **Standings** (pool standings only).
- Add inline scores + status badges to every game card on the schedule page.
- Add a team filter to the schedule page (list mode hides non-matching games; bracket mode dims non-matching nodes).
- 301-redirect `/[orgSlug]/results` → `/[orgSlug]/standings` for backward compatibility.
- Update navbar: replace `results` link with `standings`.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `components/Navbar.tsx` | Modify — `NAV_KEYS`: `results` → `standings` |
| `app/[orgSlug]/standings/page.tsx` | **Create** — standings-only page |
| `app/[orgSlug]/standings/standings.module.css` | **Create** — CSS for standings page |
| `app/[orgSlug]/results/page.tsx` | Modify — replace body with 301 redirect |
| `app/[orgSlug]/schedule/page.tsx` | Modify — remove status filter; add scores/badges; add team filter; wire `highlightTeamId` |
| `app/[orgSlug]/schedule/schedule.module.css` | Modify — status badge styles, score display styles, team filter styles |
| `components/bracket/LogicSyncBracket.tsx` | Modify — `highlightTeamId?: string` prop; dim non-matching nodes |

---

## Build Order

### Step 1 — Navbar (`components/Navbar.tsx`)
Change `NAV_KEYS`:
```ts
// Before
{ key: 'results',  label: 'Results'  },
// After
{ key: 'standings', label: 'Standings' },
```

---

### Step 2 — Create `/standings` page

**`app/[orgSlug]/standings/page.tsx`**
- Client component, same data-fetching pattern as `results/page.tsx`.
- Imports: `getStandings`, `getAgeGroups`, `getOrganizationBySlug`, `getTournamentsByOrg`.
- State: `tournaments`, `selectedTournament`, `ageGroups`, `activeGroup`, `standings`.
- Renders:
  - Page header (eyebrow: "Standings", h1: "Pool Standings").
  - `YearSelector`.
  - Age-group tab bar.
  - Per-pool standings tables (same structure as current `results/page.tsx` standings section, lines 130–207).
    - Trophy icon + highlight on first-place row.
    - Asterisk (*) + footnote when `hasPendingGame`.
    - Tie-breaker info in header.
  - **No playoff results section** — that belongs on `/schedule`.
  - **No game results list** — removed entirely.

**`app/[orgSlug]/standings/standings.module.css`**
- Copy the standings-related CSS blocks verbatim from `results.module.css`:
  - `.pageHeader`, `.summarySection`, `.summaryHeader`, `.rulesInfo`, `.standingsTable`, `.standingsTable th`, `.standingsTable td`, `.teamCell`, `.statValue`, `.poolLabel`, `.stickyCol`, `.topRow`, `.topRow .stickyCol`.

---

### Step 3 — Replace `/results` with redirect

**`app/[orgSlug]/results/page.tsx`** — replace entire file body:
```ts
import { redirect } from 'next/navigation';

export default async function ResultsRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/standings`);
}
```
This is a server component (no `'use client'`), which is correct for Next.js App Router redirects.

---

### Step 4 — Modify `/schedule` page

#### 4a. New state variables
```ts
const [requireFinalization, setRequireFinalization] = useState(true);
const [selectedTeamId, setSelectedTeamId] = useState<string>('');
```

#### 4b. Read `requireScoreFinalization` from org
In the existing `init` useEffect, after `const org = await getOrganizationBySlug(orgSlug)`:
```ts
setRequireFinalization(org?.requireScoreFinalization ?? true);
```

#### 4c. Remove `status === 'scheduled'` filter from `filtered`
Current `filtered` (lines 225–236):
```ts
const filtered = games
  .filter(g =>
    g.ageGroupId === activeGroup &&
    g.status === 'scheduled' &&          // ← REMOVE this line
    (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
  )
```
After:
```ts
const filtered = games
  .filter(g =>
    g.ageGroupId === activeGroup &&
    (viewMode === 'playoff' ? g.isPlayoff : !g.isPlayoff)
  )
```

#### 4d. Helper: `getStatusBadge(game)`
```ts
function getStatusBadge(game: Game): { label: string; cls: string } | null {
  if (game.status === 'cancelled') return { label: 'Cancelled', cls: 'badge-cancelled' };
  if (game.status === 'completed') return { label: 'Final', cls: 'badge-success' };
  if (game.status === 'submitted') {
    return requireFinalization
      ? { label: 'Pending', cls: 'badge-warning' }
      : { label: 'Final', cls: 'badge-success' };
  }
  return null; // 'scheduled' → no badge
}
```

#### 4e. Helper: `getWinner(game)`
```ts
function getWinner(game: Game): 'home' | 'away' | 'tie' | null {
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore > game.awayScore) return 'home';
  if (game.awayScore > game.homeScore) return 'away';
  return 'tie';
}
```

#### 4f. Score + team display in game cards
Replace the `<div className={styles.teams}>` block across all three list-view paths with a shared helper or inline logic:

```tsx
const hasScore = (game.status === 'completed' || game.status === 'submitted') &&
  game.homeScore != null && game.awayScore != null;
const winner = getWinner(game);

// Inside teams div:
{hasScore ? (
  <>
    <span className={`${styles.teamA} ${winner === 'home' ? styles.winTeam : winner === 'tie' ? styles.tieTeam : ''}`}>
      {getTeamDisplay(game, true)}
    </span>
    <div className={styles.scoreChip}>
      <span className={winner === 'home' ? styles.scoreWin : ''}>{game.homeScore}</span>
      <span className={styles.scoreSep}>—</span>
      <span className={winner === 'away' ? styles.scoreWin : ''}>{game.awayScore}</span>
    </div>
    <span className={`${styles.teamB} ${winner === 'away' ? styles.winTeam : winner === 'tie' ? styles.tieTeam : ''}`}>
      {getTeamDisplay(game, false)}
    </span>
  </>
) : (
  <>
    <span className={styles.teamA}>{getTeamDisplay(game, true)}</span>
    <span className={styles.vsChip}>VS</span>
    <span className={styles.teamB}>{getTeamDisplay(game, false)}</span>
  </>
)}
```

The status badge appears in `gameMeta` alongside the existing division/bracketCode badge:
```tsx
<div className={styles.gameMeta}>
  {(() => { const b = getStatusBadge(game); return b ? <span className={`badge ${b.cls}`}>{b.label}</span> : null; })()}
  <span className="badge badge-primary">...</span>
  <LocationLink ... />
</div>
```

#### 4g. Team filter control
Add above the tab bar (below `YearSelector`):

```tsx
<div className={styles.filterRow}>
  <div className={styles.teamFilter}>
    <select
      className="form-select form-select-sm"
      value={selectedTeamId}
      onChange={e => setSelectedTeamId(e.target.value)}
    >
      <option value="">All Teams</option>
      {teams
        .filter(t => t.ageGroupId === activeGroup)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
      }
    </select>
    {selectedTeamId && (
      <button className={styles.clearFilter} onClick={() => setSelectedTeamId('')}>×</button>
    )}
  </div>
  {/* existing pool/playoff segmented control stays here */}
</div>
```

Reset `selectedTeamId` to `''` when `activeGroup` changes (add to group-switch handler or via `useEffect`).

#### 4h. Apply team filter to list views
After computing `filtered`, add:
```ts
const teamFiltered = selectedTeamId
  ? filtered.filter(g => g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId)
  : filtered;
```
Use `teamFiltered` everywhere `filtered` is used in list rendering. The `byDate` grouping should also use `teamFiltered`.

Add a label when a team filter is active:
```tsx
{selectedTeamId && (
  <p className={styles.filterLabel}>
    Showing games for: <strong>{teams.find(t => t.id === selectedTeamId)?.name}</strong>
  </p>
)}
```

#### 4i. Pass `highlightTeamId` to `LogicSyncBracket`
```tsx
<LogicSyncBracket
  games={bracketGames}
  teams={teams}
  tournamentId={selectedTournament!.id}
  highlightTeamId={selectedTeamId || undefined}
/>
```

---

### Step 5 — Modify `LogicSyncBracket`

#### 5a. Add prop to interface
```ts
interface LogicSyncBracketProps {
  games: Game[];
  teams: Team[];
  tournamentId: string;
  highlightTeamId?: string;   // ← new
}
```

#### 5b. Pass `highlightTeamId` and `isHighlightMode` to `MatchNode`
In the `MatchNode` render call:
```tsx
<MatchNode
  key={node.id}
  node={node}
  x={...}
  y={...}
  isHighlighted={!highlightTeamId || node.homeTeam?.id === highlightTeamId || node.awayTeam?.id === highlightTeamId}
/>
```

#### 5c. Update `MatchNode` signature and rendering
```tsx
function MatchNode({ node, x, y, isHighlighted = true }: {
  node: BracketNode; x: number; y: number; isHighlighted?: boolean;
}) {
  // ... existing code ...
  return (
    <g transform={`translate(${x},${y})`} style={{ opacity: isHighlighted ? 1 : 0.3, filter: isHighlighted ? undefined : 'saturate(0)' }}>
      {/* Highlight ring when this team is selected */}
      {isHighlighted && /* highlightTeamId is truthy — add bright border */}
      ...existing rect, text, etc...
    </g>
  );
}
```

For the highlight ring, add a second `<rect>` on top with a bright border when `isHighlighted && highlightTeamId`:
```tsx
{isHighlighted && highlightRingActive && (
  <rect
    width={NODE_WIDTH} height={NODE_HEIGHT} rx={8}
    style={{ fill: 'none', stroke: 'var(--primary-light)', strokeWidth: '2' }}
  />
)}
```
Pass `highlightRingActive` as a prop from the parent (true when `highlightTeamId` is set and this node matches).

---

### Step 6 — CSS additions to `schedule.module.css`

```css
/* Status badges */
.badge-cancelled {
  background: rgba(255,255,255,0.06);
  color: var(--white-40);
  border: 1px solid rgba(255,255,255,0.1);
}

/* Score display (replaces VS chip when game has a result) */
.scoreChip {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--white-60);
  white-space: nowrap;
}

.scoreWin { color: var(--primary-light); }
.scoreSep { color: var(--white-30); font-size: 0.9rem; }

/* Winner / tie team name treatments */
.winTeam { color: var(--white) !important; }
.tieTeam { color: var(--white-80); font-style: italic; }

/* Team filter */
.teamFilter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.clearFilter {
  background: none;
  border: 1px solid var(--border);
  color: var(--white-60);
  border-radius: 4px;
  padding: 0.1rem 0.4rem;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.clearFilter:hover { color: var(--white); border-color: var(--primary); }

.filterLabel {
  font-size: 0.8rem;
  color: var(--white-60);
  margin-bottom: 1rem;
}
```

Note: `badge-warning` (amber/Pending) and `badge-success` (green/Final) are global badge classes already in the design system — no new CSS needed for those.

---

## Data Flow Notes

- `requireScoreFinalization` is already available on the `Organization` type (`org.requireScoreFinalization?: boolean`). The schedule page's `init` effect already calls `getOrganizationBySlug(orgSlug)` — we just need to also read this field and store it in state.
- `getStandings()` is already used in `results/page.tsx` — the standings page just calls it directly.
- Team filtering resets when the active age group changes (add a `useEffect` that calls `setSelectedTeamId('')` when `activeGroup` changes).
- `bracketGames` already excludes `cancelled` games — no change needed there.

---

## What is NOT changing
- Admin pages.
- `getGames()`, `getStandings()`, `getTeams()` — no DB changes.
- The `PublicBracketColumns` fallback component (it's a static fallback, not used alongside `LogicSyncBracket`).
- Any CSS outside the files listed above.

---

## Test Cases (for user verification)

1. **Navbar**: "Results" link gone; "Standings" link appears and routes to `/[orgSlug]/standings`.
2. **Old results URL**: `/[orgSlug]/results` → redirected to `/[orgSlug]/standings` (browser should show standings page, URL bar should update).
3. **Standings page**: Pool standings tables render correctly. Trophy on first row. Asterisk on teams with pending games.
4. **Schedule — all statuses visible**: Games with `completed`, `submitted`, `scheduled`, `cancelled` status all appear in pool play and playoff list views.
5. **Schedule — status badges**: `completed` → green "Final". `submitted` + finalization on → amber "Pending". `submitted` + finalization off → green "Final". `cancelled` → grey "Cancelled". `scheduled` → no badge.
6. **Schedule — scores**: Games with scores show `homeScore — awayScore` between team names. Winner team name highlighted. VS chip only shows for scheduled games.
7. **Team filter — list mode**: Select a team → only that team's games visible; date groups with no matching games omitted. "Showing games for: [Name]" label appears. × clears the filter.
8. **Team filter — bracket mode**: Select a team → matching nodes bright, non-matching nodes dimmed/desaturated. Bracket structure preserved. Switching back to list mode retains the filter.
9. **Team filter — persistence**: Filter persists when toggling pool/playoff and list/bracket toggles. Filter resets when switching age group tabs.
10. **Bracket — LogicSyncBracket unchanged behavior**: Scores still show in bracket nodes. LIVE badge still pulses. Connectors still render. Real-time updates still work.
11. **Multi-pool org**: Standings page shows per-pool tables. Schedule page splits pool play and playoff lists by pool as before.
12. **Single-pool org**: Standings page shows single "All Teams" table. Schedule page shows flat list as before.
