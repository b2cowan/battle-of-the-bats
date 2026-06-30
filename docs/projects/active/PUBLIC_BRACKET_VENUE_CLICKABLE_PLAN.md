# Public Bracket — Venues, Clickable Cards, Standings Parity

**Status:** BUILT on `dev` (typecheck + verify:changed green) — pending browser verification. No migration.
**Date:** 2026-06-29

## Problem (owner-reported)
1. Public playoff bracket cards don't show **where** a game is played.
2. Bracket cards aren't clickable — a dead end for "more details" (the List view links each game to a detail page; the bracket didn't).
3. The **Standings** page bracket looked "different and worse" than the **Schedule** tab bracket — it dumped every playoff game into ONE diagram, so a multi-tier event rendered duplicate finals / merged tiers.
4. Renamed facilities ("2" → "Diamond 2") still showed the **old** label on the team page (and siblings), while the game-detail page showed the new name.

## Root cause (4)
`game.location` is a denormalized snapshot saved when a game is scheduled. Renaming a facility updates the live venue record but not the snapshot baked onto existing games. Surfaces that print `game.location` go stale; surfaces that resolve from the live venue records stay correct.

## Solution
One shared bracket component + live venue resolution everywhere.

- **`components/bracket/TieredBracket.tsx`** (new) — encapsulates the pool→tier→single split; used by BOTH Schedule and Standings (parity).
- **`lib/playoff-bracket.ts` `inferGamePool`** (new) — single source of truth for pool attribution (was duplicated in ScheduleContent).
- **`lib/venue-label.ts` `resolveGameFieldLabel`** (new) — short, live field/diamond label for the compact card.
- **`LogicSyncBracket`** — venue field on the meta line (yields to status badge), whole card wrapped in a native SVG `<a>` to the game-detail page, `.hoverRing` border affordance, drag-pan `preventDefault`. New props: `venues`, `orgSlug`, `tournamentSlug`.
- **Stale-facility fix** — team-profile API resolves venue label live (server/admin, facilities loaded); `app/schedule`, `app/results`, and `MyTournamentCard` switched from `game.location` to `resolveGameVenueLabel` (client pages also request `includeFacilities`).

Design decision recorded in `memory/design_decisions.md` (2026-06-29). Card treatment: field-only label, text-only (no icon), 8.5px `--white-45`, yields to status badge; hover/focus = primary border ring, no transform.

## Verification
- `npm run typecheck` — pass (0 errors).
- `npm run verify:changed` — 0 errors, 30 pre-existing warnings; token-debt / snapshot / dictionary / org-context guards green.
- Browser (owner): bracket on both Schedule + Standings shows tiers separated, field label on upcoming cards, card click → game detail; team page now shows the renamed facility.

## Follow-ups / risks
- `app/schedule` + `app/results` are client pages loading venues with the browser client; if anon RLS blocks `venue_facilities`, they degrade to the live VENUE name (still not stale) rather than the field. Confirm in browser.
- Dev server restart required before browser testing (new file + shared-module changes).
