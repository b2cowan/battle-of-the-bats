# Sprint 4 Implementation Plan — Tactical HUD (Phase 4)

**Date:** 2026-05-04
**Branch:** dev
**Phase:** 4 — Tactical HUD: Mobile Scorekeeper
**Prerequisite:** Sprint 3 (Phase 3 Logic-Sync Bracket) complete.

---

## 1. Pre-Implementation Findings

### 1.1 — Schema deviations from the plan spec

The plan's pseudocode (section 4.2) uses `score_a` / `score_b` as column names and `'final'` as a
status value. Both are WRONG for this codebase.

| Plan spec | Actual codebase | Source |
|---|---|---|
| `score_a` / `score_b` | `homeScore` / `awayScore` (camelCase in `Game` type; `home_score` / `away_score` in DB) | `lib/types.ts:154-155` |
| `status: 'final'` | `status: 'completed'` | `lib/types.ts:142` — `GameStatus = 'scheduled' \| 'completed' \| 'cancelled'` |

**Action:** All write paths in the Tactical HUD must use `homeScore`/`awayScore` and `'completed'`
for the FINAL action. The plan checklist item "update game status to `'final'`" is incorrect — use
`'completed'`.

---

### 1.2 — No `getGame(id)` function exists

`lib/db.ts` has `getGames(tournamentId?)` (returns all games, optionally filtered by tournament)
but **no single-game fetch by ID**. The Tactical HUD is a `'use client'` component that cannot call
the server-side `supabase` instance directly.

**Resolution:** Query Supabase in the page component using `createClient()` from
`lib/supabase-browser.ts`. Use a join to get team names in one call:
```ts
const { data } = await createClient()
  .from('games')
  .select(`
    *,
    home_team:teams!home_team_id(id, name),
    away_team:teams!away_team_id(id, name)
  `)
  .eq('id', gameId)
  .single();
```
No changes to `lib/db.ts` required.

---

### 1.3 — Nav suppression: root layout always runs

`app/layout.tsx` renders `<Navbar />`, `<Footer />`, and `<BottomNav />` unconditionally. In Next.js
App Router, the root layout always wraps every route — the score page's own `layout.tsx` stub
cannot suppress it.

**Resolution:** The score page wrapper div uses `position: fixed; inset: 0; z-index: 50;
background: #000; overflow: hidden`. This creates a true full-screen overlay that covers the global
nav, footer, and bottom nav. The plan's layout.tsx stub (returning only `{children}`) is still
useful to prevent the `[orgSlug]` layout from also wrapping, but the overlay CSS is the actual
suppression mechanism.

No changes to `app/layout.tsx` structure required (only the PWA manifest meta tags are added, as
planned).

---

### 1.4 — Broadcast channel is unnecessary

The plan spec shows both a Realtime broadcast AND a DB write on every score tap. The broadcast
channel (`game-${gameId}`) is described as the propagation path for LogicSyncBracket to receive
score updates.

However, `LogicSyncBracket` already uses `postgres_changes` on the `games` table
(`event: '*', table: 'games'`). Every DB write from the Tactical HUD will automatically trigger
that subscription. A broadcast channel is ephemeral and redundant here.

**Resolution:** Omit the broadcast channel entirely. Score write path:
1. Optimistic local state update (instant UI feedback)
2. Direct DB write via browser Supabase client
3. LogicSyncBracket picks up the change via existing `postgres_changes` listener

This also removes a race condition where broadcast fires with stale state values captured in
closure.

---

### 1.5 — Server action required for FINAL

`updateGame()` in `lib/db.ts` calls `advancePlayoffs()` when `status === 'completed'`. This bracket
advancement logic must run. Since `updateGame` uses the server-side `supabase` instance, it cannot
be called from a browser client component directly.

**Resolution (two-path write strategy):**
- **Score taps:** Browser Supabase client direct update — `{ home_score: x, away_score: y }` —
  fast, no server round-trip, no advancement logic (correct, mid-game).
- **FINAL button:** A Next.js Server Action that calls `updateGame(gameId, { homeScore, awayScore,
  status: 'completed' })` — triggers `advancePlayoffs` correctly.

The Server Action lives in the same file using the `'use server'` directive on the function, or in
a co-located `actions.ts`.

---

### 1.6 — IBM Plex Mono already available

`app/layout.tsx` loads IBM Plex Mono via Next.js font and exposes it as the CSS variable
`--font-mono`. The `font-mono` Tailwind class is already wired. No font changes needed.

---

### 1.7 — No existing `app/[orgSlug]/games/` directory

Confirmed via file system search: the `games/` route segment does not exist. This is a fully
additive creation — no conflicts with existing routes.

---

### 1.8 — Entry point: how admins launch the Tactical HUD

The admin results page (`app/[orgSlug]/admin/results/page.tsx`) already has an `openScore(g: Game)`
function that opens a modal for score entry. The Tactical HUD entry point should be a secondary
action on each game row: a small "HUD" link/button that opens
`/${orgSlug}/games/${game.id}/score` in a new tab.

The schedule page (`app/[orgSlug]/schedule/page.tsx`) — per AGENCY_RULES.md, its list view and
pool/tab logic must NOT be modified. No entry point is added there.

---

## 2. Route Structure

```
app/
└── [orgSlug]/
    └── games/
        └── [gameId]/
            └── score/
                ├── layout.tsx      ← suppresses [orgSlug] layout (not root)
                ├── page.tsx        ← full-screen Tactical HUD
                └── actions.ts      ← server action for FINAL status write
```

No route conflicts. The `[orgSlug]` layout is `app/[orgSlug]/admin/layout.tsx` which is scoped
under `admin/` — it does NOT wrap non-admin routes. There is no `app/[orgSlug]/layout.tsx`, so the
score route inherits only the root layout.

---

## 3. Auth Strategy — DECISION POINT

**Question for user:** Who can access `/${orgSlug}/games/${gameId}/score`?

**Option A — Open (anyone with the link):**
- Field officials get a per-game link from the admin (copy from the results page row).
- No login required. The anon Supabase key allows reads and writes via RLS.
- ⚠️ Risk: Anyone who guesses a game UUID can submit scores. Mitigated by UUID entropy.
- ✅ Simple: no session management, works on any official's phone.

**Option B — Authenticated admin only:**
- Redirect to login if no Supabase session detected (client-side check on mount).
- Officials would need an admin account, which they likely don't have.
- Less practical for tournament day.

**Option C — Read-write token (future):**
- Not implemented yet; out of scope for this sprint.

**Recommendation:** Start with Option A. Supabase UUID game IDs are 36 characters of random entropy
— effectively unguessable. Add a "⚠️ Anyone with this link can score this game" warning in the
admin entry point. This can be hardened in a future sprint.

**This is a decision point — please confirm before implementation starts.**

---

## 4. Score Write-Back — Confirmed Strategy

```
Score tap → setHomeScore(optimistic) → supabase.from('games').update({ home_score: x, away_score: y }).eq('id', gameId)
                                              ↓ postgres_changes fires
                                        LogicSyncBracket updates in bracket view ✓

FINAL tap → confirm dialog → finalizeGame() server action → updateGame(id, { homeScore, awayScore, status: 'completed' })
                                              ↓ advancePlayoffs() runs ✓
```

No Realtime broadcast channel. Score increments write `home_score` and `away_score` together on
every tap (not just the changed side) to keep the DB row consistent.

---

## 5. PWA Manifest — Impact Assessment

Adding `<link rel="manifest" href="/manifest.json" />` and apple meta tags to `app/layout.tsx`
affects all pages on the platform. Assessment:

- `manifest.json` is advisory — browsers use it only when a user adds the page to their home
  screen. Existing org pages are unaffected during normal browsing.
- The `start_url: "/"` in the plan spec is generic. Since the HUD is a specific game URL, the
  manifest's `start_url` should remain `/` (can't be per-game). The manifest is a platform-wide
  PWA declaration, not game-specific.
- The `apple-mobile-web-app-capable` meta tag enables standalone mode for Safari — harmless for
  desktop, and only activates if someone saves the page to home screen.

**Verdict:** Safe to add globally. No org pages are affected.

---

## 6. Ordered Task Checklist

### Phase A — Route scaffolding (purely additive, no existing file changes)
- [ ] Create `app/[orgSlug]/games/[gameId]/score/layout.tsx` — empty wrapper (suppresses any
  intermediate layout, returns `{children}`)
- [ ] Create `app/[orgSlug]/games/[gameId]/score/actions.ts` — server action `finalizeGame()`
  that calls `updateGame(id, { homeScore, awayScore, status: 'completed' })`
- [ ] Create `app/[orgSlug]/games/[gameId]/score/page.tsx` — Tactical HUD UI (full spec below)

### Phase B — Tactical HUD page.tsx implementation
- [ ] `'use client'` component; params: `{ orgSlug: string; gameId: string }`
- [ ] On mount: fetch game via browser Supabase client with home/away team name join
- [ ] Display: identity strip (division · round, LIVE indicator, game time)
- [ ] Display: Team A column (name, score in `text-[7rem] font-mono text-logic-lime`)
- [ ] Display: Team B column (mirror of Team A)
- [ ] `+1` button per team: `h-36 min-h-[144px]`, Blueprint Blue background, Logic Lime label
- [ ] `UNDO` button per team: `h-16`, reduces score (floor 0), same DB write pattern
- [ ] Score tap writes `home_score` + `away_score` together via browser Supabase client
- [ ] PERIOD toggle button (bottom-left): cycles 1 → 2 → OT (local state only, not persisted)
- [ ] FINAL button (bottom-right): opens confirmation `window.confirm()` → calls `finalizeGame()`
  server action → shows "FINAL — scores saved" toast → disables further taps
- [ ] Full-screen overlay: `position: fixed; inset: 0; z-index: 50; background: #000; overflow: hidden`
- [ ] Loading state: show game ID in mono while fetching
- [ ] Error state: if game not found, show "Game not found" with back link

### Phase C — PWA assets
- [ ] Create `public/manifest.json` (name, short_name, display: fullscreen, background: #000,
  theme: #000, orientation: portrait)
- [ ] Add `<link rel="manifest">` + `<meta apple-mobile-web-app-capable>` +
  `<meta apple-mobile-web-app-status-bar-style>` to `app/layout.tsx` `<head>` section

### Phase D — Admin entry point (minimal change to results page only)
- [ ] Add "HUD ↗" icon button next to each game row in `app/[orgSlug]/admin/results/page.tsx`
  that opens `/${orgSlug}/games/${game.id}/score` in a new tab (`target="_blank"`)
- [ ] Tooltip or small label: "Open Tactical HUD"

### Phase E — Post-implementation
- [ ] Update Phase 4 checklist in `FIELDLOGIC_IMPLEMENTATION_PLAN.md` (mark items complete)
- [ ] Update `TODO.md` Phase 4 line to `[x]`
- [ ] Commit to `dev` branch

---

## 7. Files Created or Modified

| File | Action | Notes |
|---|---|---|
| `app/[orgSlug]/games/[gameId]/score/layout.tsx` | Create | New |
| `app/[orgSlug]/games/[gameId]/score/actions.ts` | Create | New — server action |
| `app/[orgSlug]/games/[gameId]/score/page.tsx` | Create | New — HUD UI |
| `public/manifest.json` | Create | New |
| `app/layout.tsx` | Modify | Add 3 meta/link tags to `<head>` only |
| `app/[orgSlug]/admin/results/page.tsx` | Modify | Add HUD link button to game rows |

**Not touched:** `BracketBuilder.tsx`, `schedule/page.tsx`, any existing admin pages except
results, any existing CSS modules, `lib/db.ts`, `lib/types.ts`.

---

## 8. Open Questions for User Before Implementation

1. **Auth (Section 3):** Confirm Option A (open link) vs Option B (admin login required).
2. **PERIOD button:** Should the period number be persisted to the DB (add to game notes?), or
   stay as local-only state (no persistence — resets if page refreshes)?
3. **UNDO scope:** Should UNDO only work on the last tap (single step), or be a full decrement
   (tap to subtract 1, no tap history)?
4. **Team names for placeholder games:** When `homeTeamId` / `awayTeamId` are empty (bracket
   placeholder game), the join returns null. Fall back to `homePlaceholder` / `awayPlaceholder`
   (e.g., "Winner SF1"). Confirm this fallback is correct.
