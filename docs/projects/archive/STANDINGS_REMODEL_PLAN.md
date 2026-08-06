# Standings Page Remodel — Implementation Plan

**Status:** Planned  
**Branch:** dev  
**Files touched:** `components/public/StandingsContent.tsx`, `app/[orgSlug]/standings/standings.module.css`, new `components/public/RaceToPlayoffsView.tsx`, new `components/public/PublicBracketView.tsx`

---

## What we're building

Three layered additions to the public standings page:

1. **View toggle** — segmented "Standard / Race to Playoffs" control (only rendered when `teamsQualifying > 0`)
2. **Race to Playoffs view** — podium cards for top 3, compact list rows for the rest, playoff cutoff divider
3. **Live playoff bracket** — read-only bracket below standings; flips above standings once pool play finishes

---

## Data model notes

| Field | Source | Used for |
|---|---|---|
| `playoffConfig.teamsQualifying` | `Division` | Cutoff line position; toggle gate |
| `playoffConfig.crossover` | `Division` | `!== 'none'` → combine all pools into one race leaderboard |
| `team.color` | `Team` | Team badge background; fallback to name-hash colour |
| `game.isPlayoff` | `Game` | Bracket detection; playoff phase detection |
| `game.bracketCode` | `Game` | Round grouping (e.g. "QF1", "SF1", "SF2", "3RD", "F") |
| `followedTeamId` | localStorage | "YOU" chip in race podium |

---

## Phase A — View toggle

**Gate:** only render toggle when `currentGroup?.playoffConfig?.teamsQualifying > 0`

```
useState<'standard' | 'race'>('standard')
localStorage key: fl_standings_view_${orgSlug}_${tournamentSlug}_${divisionId}
```

**Toggle UI:** segmented control matching the existing Schedule page `segmentedControl` pattern. Sits in `.standingsControls` row alongside the division `<select>`.

---

## Phase B — Race to Playoffs view

New file: `components/public/RaceToPlayoffsView.tsx`

### Props
```ts
interface RaceToPlayoffsProps {
  standings: StandingRow[];         // already-sorted by pts/rd
  pools: Pool[];
  playoffConfig?: PlayoffConfig;    // teamsQualifying, crossover
  followedTeamId: string | null;
  teams: Team[];
}
```

### Pool merge logic
- If `playoffConfig.crossover !== 'none'` OR `pools.length <= 1`: merge all pool standings into one list, re-sort by (pts DESC, rd DESC, rf DESC), render one unified race view
- Otherwise: render a separate race section per pool (same component, different slices)

### Section header
```
<Trophy /> RACE TO PLAYOFFS · Top {teamsQualifying} of {totalTeams} advance
```
Subtitle: `"Top {n} advance"` in muted text

### Podium (positions 1–3)
Three cards in a CSS grid: `1fr 1.1fr 1fr` (centre slot is taller/elevated).
Order in DOM: 2nd · 1st · 3rd (CSS `order` property places 1st in the middle visually).

Each card contains:
- Position label ("1ST" / "2ND" / "3RD") in position-colour (gold/silver/bronze)
- Team badge: 2-letter initials, `team.color` background (fallback: `teamColorFromName(team.name)`)
- Team name (bold)
- Points (large `--font-data` number + "pts" label)
- W-L-T · RD +N record line
- "★ YOU" chip if `team.id === followedTeamId` (lime chip, same `.youChip` class)
- Card border tint for YOU team (lime, matching existing `followBar` pattern)

### Below-podium list rows (positions 4+)
Compact rows: `[rank] [badge] [name] ··· [W-L-T] [RD] [PTS badge]`
Same row structure as the existing standingsTable but without the table element — flex rows.

### Playoff cutoff divider
Rendered between position `teamsQualifying` and `teamsQualifying + 1`.
```
--- × PLAYOFF CUTOFF · TOP {n} ADVANCE ---
```
Red dashed border, centred text, `--danger` colour for the X icon and "PLAYOFF CUTOFF", `--success` colour for the advance count. Hidden if `teamsQualifying >= totalTeams` or `teamsQualifying <= 0`.

If the cutoff falls inside the podium (e.g. only top 2 advance from 6), no divider is rendered inside the podium — podium always shows all 3 cards; divider appears only below the podium between list rows.

### Team badge helper (shared)
```ts
// components/public/teamBadge.ts
export function teamInitials(name: string): string  // first letter of first 2 words
export function teamColorFromName(name: string): string  // deterministic hsl from name hash
```

---

## Phase C — Standard view follow bar redesign

The existing `.followBar` is redesigned to match the mockup's wide-card style:

**Left:** team badge + star icon + "TEAM NAME" bold + position badge ("2nd")  
**Sub-line:** W-L-T · N pts · RD +N  
**Right:** "Final · 2nd" (or "In progress · 3rd") in `--success` or muted colour

No structural change to the data — just CSS + minor JSX rearrangement.

---

## Phase D — Public playoff bracket

New file: `components/public/PublicBracketView.tsx`

### Props
```ts
interface PublicBracketViewProps {
  games: Game[];        // all games for the division, filter to isPlayoff internally
  teams: Team[];
  requireFinalization: boolean;
}
```

### Round detection
Parse `game.bracketCode` to extract round and position:
- Codes like "QF1"/"QF2" → Quarterfinals
- "SF1"/"SF2" → Semi-Finals
- "3RD" → Third Place
- "F" → Final
- Unknown codes → grouped by prefix letter(s)

Round order derived from code prefix: QF < SF < 3RD < F (Finals always last).

### Desktop layout — visual bracket tree
CSS grid columns, one per round. Each matchup is a card with:
- Away team row: badge + name + score (dimmed if lost, `--success` if won)
- Home team row: badge + name + score
- Connector lines via CSS `::before`/`::after` pseudo-elements on right edge of each non-final matchup

Connecting lines: right-centre of each matchup card draws a horizontal line → vertical line → horizontal line to next-round matchup. Pure CSS, no SVG.

TBD slots (no team assigned yet): render "TBD" in `--white-30`.

### Mobile layout — rounds list
Rounds as sections with a header label. Each game as a flat row matching the existing `scoreCard` pattern (status badge, teams, score). No connecting lines.

### Bracket position logic

```ts
const playoffGames = activeGames.filter(g => g.isPlayoff);
const hasPlayoffGames = playoffGames.length > 0;
const poolPlayComplete = activeGames
  .filter(g => !g.isPlayoff && g.status === 'scheduled').length === 0;
// poolPlayComplete = true → bracket moves above standings
```

Render order in `StandingsContent`:
- `poolPlayComplete`: `[BracketSection] [StandingsSection]`
- `!poolPlayComplete`: `[StandingsSection] [BracketSection]`
- `!hasPlayoffGames`: no bracket rendered

Both sections always render in the same outer `.standingsStack` flex column.

---

## Phase E — CSS additions to standings.module.css

New classes needed:

**Toggle**
- `.viewToggle` — segmented control matching `segmentedControl` in schedule.module.css

**Race view**
- `.raceSection` — wrapper
- `.raceHeader` — trophy icon + title + subtitle
- `.podium` — 3-column grid `1fr 1.12fr 1fr`, align-items: flex-end
- `.podiumCard` — card for each of the 3 positions
- `.podiumCard[data-pos="1"]` — `min-height: 240px` (taller)
- `.podiumCard[data-pos="2"]`, `.podiumCard[data-pos="3"]` — `min-height: 200px`
- `.podiumPosition` — position label ("1ST"), per-position colour vars
- `.podiumBadge` — 56px square team badge with 2-letter initials
- `.podiumBadgeSm` — 36px variant for list rows
- `.podiumName` — team name
- `.podiumPts` — large `--font-data` points number
- `.podiumRecord` — W-L-T · RD line
- `.youChip` — "★ YOU" lime pill
- `.raceList` — list of below-podium teams
- `.raceRow` — single below-podium team row
- `.raceRank` — rank number
- `.playoffCutoff` — red dashed divider bar
- `.playoffCutoffInner` — centred content inside bar

**Bracket**
- `.bracketSection` — wrapper with section header
- `.bracketTree` — desktop grid (hidden ≤640px)
- `.bracketRound` — one column per round
- `.bracketRoundLabel` — round name header
- `.bracketMatchup` — matchup card
- `.bracketTeam` — team row inside matchup
- `.bracketTeamWon` — winner colour (`--primary-light`)
- `.bracketTeamBadge` — tiny 24px badge
- `.bracketConnector` — right-side connector lines (CSS pseudo-elements)
- `.bracketList` — mobile rounds list (hidden >640px)
- `.bracketListRound` — mobile round section
- `.bracketListGame` — mobile game row (reuses scoreCard visual language)

---

## File change summary

| File | Change |
|---|---|
| `components/public/StandingsContent.tsx` | Add view toggle, import RaceToPlayoffsView + PublicBracketView, bracket position logic |
| `app/[orgSlug]/standings/standings.module.css` | All new CSS classes from Phase E |
| `components/public/RaceToPlayoffsView.tsx` | **New** — race view with podium + list + cutoff |
| `components/public/PublicBracketView.tsx` | **New** — bracket visual tree (desktop) + rounds list (mobile) |
| `lib/teamBadge.ts` | **New** — `teamInitials()` + `teamColorFromName()` helpers |

---

## Out of scope
- No auto-refresh / polling
- No changes to the admin bracket builder
- No changes to score entry or data model
- Recent Scores section stays below everything, unchanged
