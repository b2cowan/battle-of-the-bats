# Public Teams Pages — Card Grid Remodel

**Status:** Built 2026-06-02 · Awaiting browser verification

---

## Scope

Redesign two public pages:
1. **Teams list** (`/{orgSlug}/{tournamentSlug}/teams`) — was a flat text-row list per pool; now a card grid with inline stats.
2. **Individual team** (`/{orgSlug}/{tournamentSlug}/teams/{id}`) — was a sidebar/main two-column layout; now a hero card + stat tiles + form section.

---

## Files changed

| File | Change |
|------|--------|
| `lib/public-tournament-data.ts` | Teams section now also fetches `games` (needed for standings + live detection) |
| `app/api/public/team-profile/route.ts` | **New** — returns team, division, pool name, game duration, computed standings, and team's games for the detail page |
| `components/public/TeamsContent.tsx` | Full rewrite — card grid layout, standings computation, live detection, no "All Divisions" option |
| `app/[orgSlug]/teams/teams.module.css` | Full rewrite — team card grid, avatar, live badge, follow button, pool section headers |
| `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx` | Full rewrite — hero card, stat tiles (2×2), form section (W/L/T bubbles + next game), schedule list |
| `app/teams/[id]/team-profile.module.css` | Full rewrite — hero card with watermark, stat tiles, form card, schedule & results |

---

## Design decisions

### Team avatars
- Auto-generated from team name: deterministic hash → pick from a 12-color palette
- 2-letter initials (first letter of first word + first letter of last word)
- No admin configuration in V1; noted for future (coaches may pick colors later)

### Division filter
- Removed "All Divisions" option entirely
- Defaults to first division or the user's saved division preference (cookie)
- Within the active division: pool sections with grid per pool (if `poolCount >= 2`); otherwise flat grid

### Live badge
- Shown when: `game.status === 'scheduled'` AND today's date AND current time is past game start AND within `game_duration_minutes` from start AND no score submitted
- Duration sourced from `division.settings?.game_duration_minutes` → `tournament.settings?.game_duration_minutes` → 90 min default
- Shows "● LIVE vs [opponent initials]" on team list card; "● LIVE" badge on schedule row

### Standings on teams list
- Computed client-side from the `games` array now included in the teams section data
- Only pool-play games (non-playoff, completed or submitted) count toward rank
- Pool rank derived from standings filtered to the team's pool

### Form section (individual team page)
- Shows last 5 completed/submitted games (pool play + playoffs), oldest to newest
- W/L/T coloured bubbles
- "NEXT GAME" callout row below form if a future game exists
- Replaced by "LIVE" tag if a game is currently in the time window

### Roster section
- Removed entirely from the public team profile (per user decision 2026-06-02)

---

## Known future work
- Coach/admin ability to set a team color (replaces auto-generated avatar color)
- LIVE badge could be enhanced if a dedicated 'live' game status is added to the schema
- `color-mix()` CSS fallback for older browsers (currently requires Chrome 111+ / Safari 16+)
