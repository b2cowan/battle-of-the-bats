# PM Brief — Public Bracket: Venues, Clickable Cards, Standings Parity

**Status:** Built, pending owner browser check. No migration. 2026-06-29.

## What changed for the fan
- **Bracket cards show the field.** On the public playoff bracket (Schedule tab and Standings page), each upcoming game now shows its diamond/field next to the date and time ("Jul 5 · 9:00 AM · Diamond 2"), so a fan knows where to go without leaving the bracket.
- **Bracket cards are tappable.** Clicking any game in the bracket opens the full game page (teams, score, location with a Get Directions link, what's at stake) — the same page the schedule List already linked to.
- **Standings bracket now matches the Schedule bracket.** Previously the Standings page crammed every playoff game into one messy diagram (duplicate finals, merged tiers). It now splits by tier/pool exactly like the Schedule tab, so both pages look identical.
- **Renamed facilities show correctly everywhere.** When an organizer renames a facility (e.g. "2" → "Diamond 2"), the new name now shows on the team page, schedule, results, and the "my tournament" card immediately — not just on the game-detail page.

## Why it matters
Wayfinding is a top fan need at a multi-field event; the bracket is where fans look ahead to later rounds. The clickable cards remove a dead end. The Standings parity fixes a visibly broken view. The facility fix removes a confusing inconsistency the owner hit directly.

## Roles
Public/fan-facing only. No admin, coach, or billing change. No new data, no migration.

## How to test
1. Open a tournament's public **Schedule → Playoffs → Bracket** and the **Standings** page; confirm both show the same tier-separated brackets with a field label on upcoming cards.
2. Click a bracket card → lands on the game-detail page.
3. Open a **team page**; confirm a renamed facility shows the new name (e.g. "Diamond 2", not "2").

## Success criteria
- Standings and Schedule brackets render identically (tiers separate, no duplicate finals).
- Field label visible on upcoming bracket cards; cards navigate to the game page.
- No stale facility names on team/schedule/results/home surfaces.
