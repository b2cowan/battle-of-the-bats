# PM Brief — Unified Bracket Engine + Playoff-Only Tournaments

**What it does:** Gives FieldLogicHQ **one** playoff bracket builder that works the same way for every tournament. It handles **any number of teams** (with automatic byes), and offers **single elimination (1-game)**, **2-game guarantee** (first-round losers get a consolation game), and **double elimination**. A full tournament seeds its bracket from round-robin standings; a new **bracket-only** tournament skips round robin entirely and lets the organizer **seed teams by hand or with a Randomize button**. Same screens, same look — the only difference is where the seeds come from.

**Why it matters:** Today the bracket builder only handles 4- or 8-team brackets off pools, is single-elimination only, and can't start without a round robin. Real tournaments routinely have odd team counts, want double-elimination or a guaranteed second game, and many are pure knockout events. This unifies and levels up brackets for *all* organizers in one project instead of bolting playoff-only on as a special case.

**Who benefits:** Tournament organizers (owner/admin) on **Tournament Plus**. Coaches, players, and fans get clearer brackets (real names from the start, double-elim/consolation paths shown, a "2-game guarantee" badge) and, for bracket-only events, no empty "Round Robin" tab.

**Expected impact:**
- Every tournament's bracket builder gains **odd-team-count/bye support**, **double elimination**, and a **2-game guarantee** option — same UI for all.
- A new **"Bracket only"** tournament style with a **Seed Teams** step (drag to order, or Randomize, with bye preview).
- Winners (and losers, in 2-game/double-elim) advance automatically as scores are entered, including the double-elim grand final.
- Auto-scheduling of dates/fields and shareable bracket cards work for every format.

**Priority:** Medium-High. One project lifts brackets for the whole customer base *and* delivers the requested bracket-only format; high reuse of the advancement engine and builder keeps cost contained.

**Success criteria:**
- The same bracket builder produces correct brackets for any N (with byes) in single-elim, 2-game-guarantee, and double-elim — for both round-robin and bracket-only tournaments.
- A bracket-only tournament can be seeded (manual or random) and built without ever touching round robin; seeded names show immediately on the public bracket.
- Scoring advances winners and losers correctly, including the double-elim grand final (and reset, if enabled).
- No round-robin views or prompts appear for a bracket-only event.

**Open decisions (organizer to confirm):** double-elim "if-necessary" grand-final reset on/off; confirm the three-format menu; placement games (5th/7th) in V1; Plus-only vs a free single-elim teaser.
