# Coach Lineup Builder — PM Brief

**What this is:** A rework of the Premium lineup tool (Schedule → open a game → Lineup) from
a tedious position grid into a real lineup *assistant* — fast to build, hard to get wrong,
and easy to post in the dugout.

**What the coach sees that's new:**
- **Mistakes are caught for you** — two players in the same position in one inning are
  flagged, each inning shows how many spots are filled, and a per-player tally shows who's
  played and who's sat (with a warning if a kid would sit two innings in a row).
- **One-click "auto-generate"** builds a starting rotation: choose **Competitive** (everyone
  in their best position), **Balanced** (use second positions to spread people around), or
  **Development** (rotate everyone everywhere). Fair playing time — even bench rotation, no
  back-to-back sits — is built into every option. You can fill only the empty spots (keep the
  pitchers you've set) or regenerate the whole thing.
- A **Clear** button to start fresh, and a clear distinction between a spot that's *blank*
  (undecided) and a player who's *benched* (a real choice).
- **Saved templates** — keep a named lineup like "Gold medal game" and start any future game
  from it.
- A **dugout-wall PDF** — a big, readable poster of the batting order and positions by inning,
  with blank boxes a coach can fill in by hand when they only set the first couple of innings.

**Why it matters:** Setting a fair, legal lineup is one of the most repetitive, error-prone
chores a coach does every game. This turns ~35 manual dropdowns into a few clicks, prevents
the embarrassing mistakes, and gives a printout the whole bench can read — a standout reason
the paid portal is worth it.

**Defaults that should be obvious to the coach:**
- Innings default to the sport (softball 7, baseball 9), still changeable.
- Batting order starts in **roster order** — to change it, reorder the roster (we tell them
  where).
- Auto-generate and templates always land as an **editable starting point** — saving is
  explicit, and a saved lineup is never silently overwritten.

**Priority:** High — a marquee Premium coach feature surfaced during the portal walkthrough.

**Sequencing:** Phase 1 mistake-checking + fair-play, Phase 2 auto-generate, Phase 3 dugout
PDF, Phase 4 named templates (the only part needing a database change). Each phase ships on
its own.

**Success criteria:** A coach can build a fair, conflict-free lineup in well under a minute,
reuse a saved one, and print a dugout poster — without hand-filling a grid.
