# Handoff Prompt: Schedule/Results Revamp

## Project context

Next.js 16 App Router tournament management platform called FieldLogic. Multi-tenant (`/[orgSlug]/` routing). TypeScript, Supabase, AWS Amplify. Package manager: pnpm. Branch convention: all work on `dev`, never push `master` without explicit user request.

Key reference files before touching anything:
- `AGENTS.md` / `AGENCY_RULES.md` — workspace rules (planning first, no browser testing by agent)
- `memory.md` — project state and data models
- `lib/plan-config.ts` — `OrgPlan` type: `'starter' | 'pro' | 'elite'` (no 'free' plan)

---

## Task: Revamp the public schedule and results pages

### Current state (two separate pages, both feel redundant)

| Route | Label | Content |
|-------|-------|---------|
| `/[orgSlug]/schedule` | Schedule | Games in scheduled state only — pool play list, playoff list, bracket view. No scores shown. |
| `/[orgSlug]/results` | Results | Standings tables + completed/submitted game results. Separate page, but covers much of the same game data. |

Users have to navigate between two pages to see "what's happening" and "what happened." The data model already supports unified display.

### Target state (two focused pages)

| Route | Nav label | Content |
|-------|-----------|---------|
| `/[orgSlug]/schedule` | **Schedule** | All games in all modes, with inline status + scores. Replaces both old schedule and results game lists. |
| `/[orgSlug]/standings` | **Standings** | Pool play standings only. Replaces the standings section from the old results page. |

The old `/[orgSlug]/results` route should **301 redirect** to `/[orgSlug]/standings` for backward compatibility.

Update `NAV_KEYS` in `components/Navbar.tsx`:
```ts
// Before
{ key: 'schedule', label: 'Schedule' },
{ key: 'results',  label: 'Results'  },

// After
{ key: 'schedule',  label: 'Schedule'  },
{ key: 'standings', label: 'Standings' },
```

---

## Detailed feature spec

### 1. `/[orgSlug]/schedule` — Schedule (combined schedule + results)

This page becomes the single source of truth for "what's happening / what happened."

#### 1a. Show ALL games, not just scheduled ones

Currently the page filters `status === 'scheduled'`. Remove that filter. Every game appears regardless of status, in all view modes (pool play list, playoff list, bracket).

#### 1b. Inline game status badges

Every game card/row shows a status indicator:

| DB `status` value | Badge to show | Visual style |
|-------------------|--------------|--------------|
| `'scheduled'`     | *(none)*     | No badge — clean, uncluttered |
| `'submitted'`     | **Pending**  | Amber pill — scores submitted but not yet finalized by admin |
| `'completed'`     | **Final**    | Green pill — scores confirmed |
| `'cancelled'`     | **Cancelled**| Muted/grey pill |

No "Live" badge. The `'scheduled'` state simply shows no badge regardless of the game's date/time.

#### 1c. Scores on submitted/completed games

When `status === 'submitted'` or `status === 'completed'`, display `homeScore – awayScore` on the game card. Winner gets bold/highlighted treatment (same logic as the current results page: compare scores, bold the higher). If tied, both bold.

Show scores in:
- Pool play list mode
- Playoff list mode
- Bracket view (already does this via `LogicSyncBracket` — verify it continues to work)

For scheduled games (no score yet), show the usual "TBD" or leave the score area blank.

#### 1d. Team filter

Add a team search/filter control to the page header (alongside the existing pool play / playoff toggle):

- A single-select dropdown or search input listing all teams in the active age group
- Default: "All Teams" (no filter)
- When a team is selected:
  - **List modes (pool play list, playoff list)**: Hide games where neither `homeTeamId` nor `awayTeamId` matches the selected team. Show a "Showing games for: [Team Name]" label. Preserve date groupings (if a date group becomes empty after filtering, omit it).
  - **Bracket mode**: Do NOT remove nodes. Instead, **highlight** game nodes where the team is playing (bright border, full opacity) and **dim** all other nodes (50% opacity, desaturated). This lets the user trace the team's bracket path without destroying the bracket structure.
- The filter persists when switching between pool/playoff toggle and list/bracket toggle.
- Clear filter button (×) when a team is active.

#### 1e. All existing layout modes still work

The page retains all current view modes:
- Pool play → list (games grouped by date, then pool if multi-pool)
- Playoff → list (games grouped by date, then bracket code)
- Playoff → bracket (LogicSyncBracket SVG component)

No modes are removed. The only additions are: inline scores/status + the team filter.

---

### 2. `/[orgSlug]/standings` — Standings

This page is a focused extraction of the standings section from the current results page.

Content:
- One standings table per pool (if `pools.length >= 2`) or one "All Teams" table (single-pool)
- Columns: Team, W, L, T, RF, RA, RD (green if positive, red if negative), PTS
- First-place row: trophy icon, subtle highlight
- Asterisk (*) on teams with `hasPendingGame === true`
- Tie-breaker footnote in table header
- Pending-game warning footer if any team has pending games
- Age group tabs (same as existing pattern: U11, U13, U15, etc.)
- YearSelector for multi-tournament orgs

This is essentially the standings section cut out of `results/page.tsx` and placed on its own page. Reuse the existing standings data-fetching logic (`getStandings()` from `lib/db.ts`) and the existing CSS/markup patterns from results.

No playoff results section on this page — that now lives on the schedule page.

---

### 3. Redirect `/[orgSlug]/results` → `/[orgSlug]/standings`

Create `app/[orgSlug]/results/page.tsx` (or a `route.ts`) that issues a 301 redirect to `/${orgSlug}/standings` so any bookmarked or externally linked results URLs continue to work.

In Next.js App Router the cleanest approach is a server component with `redirect()`:
```ts
// app/[orgSlug]/results/page.tsx
import { redirect } from 'next/navigation';
export default async function ResultsRedirect({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/standings`);
}
```

---

## Technical context the agent needs

### Game data shape (from `lib/db.ts` / `getGames()`)
```ts
interface Game {
  id: string;
  ageGroupId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  date: string;           // 'YYYY-MM-DD'
  time: string;           // 'HH:MM'
  location: string | null;
  diamondId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'submitted' | 'completed' | 'cancelled';
  isPlayoff: boolean;
  bracketId: string | null;
  bracketCode: string | null;   // 'QF1', 'SF2', 'FIN', '3RD', etc.
  homePlaceholder: string | null;  // 'Winner QF1', '1st Pool A'
  awayPlaceholder: string | null;
  notes: string | null;
}
```

### Standings data shape (from `getStandings()`)
```ts
interface StandingRow {
  teamId: string;
  teamName: string;
  poolId: string | null;
  gp: number;
  w: number; l: number; t: number;
  pts: number;
  rf: number; ra: number; rd: number;
  hasPendingGame: boolean;
}
```

### `require_score_finalization` flag
The org settings have a `requireScoreFinalization` flag. When **disabled**, `'submitted'` games are treated as final immediately — in that case the "Pending" badge should not be shown (show "Final" instead). The `getStandings()` already handles this; the schedule page game cards should respect the same logic. Check `org.requireScoreFinalization` from context or the org settings API.

### LogicSyncBracket component
Lives at `components/bracket/LogicSyncBracket.tsx`. Already renders scores when available. Already subscribes to real-time Supabase updates. The team highlight feature (dimming non-matching nodes) will require passing a `highlightTeamId?: string` prop to this component and applying CSS opacity/filter in its node rendering logic.

### CSS patterns
The schedule page uses `schedule.module.css` and results page uses `results.module.css`. The new standings page can reuse the standings-related CSS from results. Status badge styles should be added to `schedule.module.css` (or a shared module).

### Existing status badge CSS (from results page — reuse these)
```css
/* 'completed' → green */
/* 'submitted' → amber */
/* 'cancelled' → muted grey */
```
Check `results.module.css` for existing badge styles before creating new ones.

---

## Files to create / modify

| File | Action |
|------|--------|
| `app/[orgSlug]/schedule/page.tsx` | Modify — remove scheduled-only filter; add scores/badges; add team filter; pass highlightTeamId to bracket |
| `app/[orgSlug]/schedule/schedule.module.css` | Modify — add status badge styles, team filter styles |
| `app/[orgSlug]/standings/page.tsx` | Create — standings-only page (cut from results/page.tsx) |
| `app/[orgSlug]/standings/standings.module.css` | Create — styles for standings page (copy standings section from results.module.css) |
| `app/[orgSlug]/results/page.tsx` | Create/modify — redirect to `/[orgSlug]/standings` |
| `components/bracket/LogicSyncBracket.tsx` | Modify — add optional `highlightTeamId` prop, dim non-matching nodes |
| `components/Navbar.tsx` | Modify — update `NAV_KEYS`: replace `results` with `standings` |

Do NOT delete `results/page.tsx` — replace its content with the redirect.

---

## Build order

1. **Read** all current source files before writing any code: `schedule/page.tsx`, `results/page.tsx`, `schedule/schedule.module.css`, `results/results.module.css`, `LogicSyncBracket.tsx`, `Navbar.tsx`
2. **Update `NAV_KEYS`** in `Navbar.tsx` (`results` → `standings`)
3. **Create `/standings` page** by extracting the standings section from `results/page.tsx`
4. **Replace `/results/page.tsx`** with the redirect
5. **Modify `/schedule/page.tsx`**:
   a. Remove scheduled-only filter (show all games)
   b. Add inline scores + status badges to game cards
   c. Add team filter control and filtering/highlighting logic
6. **Modify `LogicSyncBracket`** to accept and apply `highlightTeamId`
7. **CSS additions** for badges and filter control

---

## What the user expects

- Write an implementation plan (new `.md` file) and summary line in `TODO.md` **before** writing any code, per `AGENCY_RULES.md`
- Present the plan to the user for approval
- After approval, implement in the order above
- Do NOT perform browser testing — provide a test case list for the user instead
- All work on `dev` branch
