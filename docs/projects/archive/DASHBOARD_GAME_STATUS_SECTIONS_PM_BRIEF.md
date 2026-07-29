# PM Brief — Dashboard Game-Status Sections (Now Playing / Up Next / Needs a Score)

**What it does:** Splits the tournament dashboard's single "Now Playing" board into three clear, honest sections — **Now Playing** (games actually being played right now), **Up Next** (the next games about to start), and **Needs a Score** (games that have finished but still need a result entered). Today everything gets lumped into "Now Playing," which is why an organizer saw eight "LIVE" games across three fields, including games that hadn't started and games that were already over.

**Why it matters:** On game day the dashboard is the organizer's control tower. When it labels not-yet-started and already-finished games as "live," it stops being trustworthy — the organizer can't tell at a glance what's actually happening, what's coming, or what still needs a score typed in. The preceding bug-fix stopped the false "LIVE" labels, but on its own it makes those other games simply vanish. This work brings them back in the *right* buckets, so nothing that needs attention is ever hidden.

**Who benefits:** Tournament organizers and their day-of staff/admins, on every tier that runs tournaments (Tournament, Tournament Plus, League, Club). No plan restrictions — this is core dashboard behaviour, not a gated feature.

**Expected impact:**
- "Now Playing" shows only the handful of games truly in progress — it matches reality (about one per field), so it's finally glanceable.
- "Up Next" gives a heads-up on what's starting soon, so staff can prep fields and point teams in the right direction.
- "Needs a Score" becomes the game-day to-do list — every finished game still missing a result is visible in one place with a one-tap path to enter it, instead of silently falling off the board.
- The dashboard and the Schedule screen now agree on what's live vs. next vs. overdue (they'll share one definition under the hood), so the two screens stop contradicting each other.
- Each section is a customizable panel — organizers can show, hide, or reorder them like the rest of the board.

**Priority:** Medium. The urgent correctness bug (false "LIVE") is already fixed; this is the follow-through that makes the board genuinely useful and closes the "where did those games go?" gap. Small, self-contained, no database change.

**Success criteria:**
- On a live game day, "Now Playing" shows only games inside their play window (or being scored) — roughly one per active field, never a whole day's slate at once.
- Games that haven't started appear under "Up Next," earliest first.
- Every finished-but-unscored game appears under "Needs a Score" with a direct link to enter the score — including games from an earlier day that were never scored.
- No game that should be visible is dropped from the board.
- The dashboard's live/next/overdue reads match the Schedule screen's row badges for the same games.
- Organizers can show/hide/reorder the new sections, and existing customized layouts pick them up cleanly without breaking.
