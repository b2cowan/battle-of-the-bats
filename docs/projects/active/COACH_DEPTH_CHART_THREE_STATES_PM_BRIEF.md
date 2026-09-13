# PM Brief — Depth Chart: Three States

> Plan: `COACH_DEPTH_CHART_THREE_STATES_PLAN.md` · Hub (mockup · brief · plan · decisions):
> https://claude.ai/code/artifact/cc825629-70fc-4293-b4bb-cb19a4ad06c6 · Proposed 2026-09-12, awaiting owner rulings

**What it does:** Every cell on the depth chart means one thing a coach can say out loud. A
position is either one of the player's **Best** spots (ranked), a **Never**, or **blank — fine
anywhere they're not Never**. The confusing fourth state ("Okay", which sat between "Not set" and
"Best" and did almost nothing a coach could see) goes away, and the game-day Auto-fill's mode
picker says plainly what each mode does with those ratings.

**Why it matters:** A coach reported that "Okay" and "Not set" behave the same. They were right
three times over. The product's own legend described them with the same words ("fill in if
needed" / "only if needed"). In the mode Auto-fill picks by default for a league game, Okay and
Best were treated as one pool and the Best ranking was ignored; in a scrimmage every rating but
Never was ignored. And once a lineup was built, nothing showed which rating put a player where —
so even where the four states did differ, the difference was invisible. A rating a coach can't
explain or observe is one they'll stop setting, and the depth chart only pays off if it's filled in.

**Who benefits:** Every coach on a plan with Lineup Intelligence (the depth chart, the Positions
picker on a player's page, and Auto-fill). No role or plan gating changes. Assistants who can view
the roster still view the depth chart; the head coach still makes the changes.

**What changes for the coach:**
- **On the depth chart** — tap a cell to cycle **blank → Best → Never → blank**. Best cells still
  number in the order you pick them; Never is a red ✕; a blank cell means "fine". The legend shows
  two swatches and one sentence — the "Not set" swatch is gone because it was never a choice.
- **The A-squad column explains itself** — a ★ line in the legend and a tap-to-read note on the
  column header say what a gold-medal starter is and that it only matters in Competitive games.
- **Pitcher rank is a dropdown** — pick Ace, #2 … #5 or "not a pitcher" in one tap instead of
  tapping through all five ranks to get back to none. The phone view already worked this way.
- **The innings cap says "IP"** — so *Ace · 3 IP* reads as three innings per game, not a mystery
  number.
- **One line under the grid tells you what Auto-fill will do** with what you set: Never is honoured
  in every mode; Best ranks matter most in Competitive; Balanced rotates anyone rated Best;
  Development rotates everyone.
- **On a player's page** — the Positions picker uses the same three states, same legend, same
  words. Reorder arrows stay there, and the grid's tip now tells you that's where to re-rank.
- **In the Auto-fill menu** — the three modes read *Competitive — Best spots first, in your rank
  order* · *Balanced — anyone rated Best, rotated evenly* · *Development — everyone rotates; only
  Never is honoured*. The help article says the same thing instead of over-promising.
- **Your existing "Okay" spots aren't lost** (recommended ruling) — each becomes a Best spot ranked
  after the ones you already had, in the order you set them. On production today that is nine
  cells on four players on one team.
- **The coach sandbox's depth chart** (recommended ruling) gains a Never and a third-choice Best so
  a prospect sees the states in use rather than an empty grid.

**Expected impact:** A coach can fill in the depth chart in half the taps and never wonder what a
blank means; the lineup builder's behaviour matches its labels, so a carefully ranked roster stops
being quietly ignored in league games without the coach knowing; one fewer support question of
the "what's the difference between…" kind.

**Trade-offs made:**
- We lose a "soft avoid" rung — "only if I'm desperate" — that the four-state model technically
  had. It is not a real loss: it was the *blank* cell, nobody knew, and it worked only in tournament
  games. If coaches ask for it, it should come back as a named state, not as the meaning of an
  empty box.
- Balanced mode keeps ignoring Best *rank* (it rotates evenly among anyone rated Best). That is
  the point of Balanced; what changes is that the label and help now say so. The owner can rule
  otherwise (D4 in the plan).
- Nothing yet shows, after Auto-fill runs, *why* a player landed where they did. That is a lineup-
  builder feature and gets its own mockup session; this project removes the rung that made the
  question unanswerable.
- The fold of existing Okay data is one-way; the owner rules on it before it runs.

**Priority:** Medium — small build, one data step, high clarity return; it also puts the first
unit tests on the lineup generator, which has none today. Sequence after the two coach-money
commits in flight, before the next coach demo re-seed so the sandbox change rides that re-seed.

**Success criteria:** A coach can state what each of the three cell states means without the
legend; a Balanced lineup built from a rated roster places a rated player at a spot before an
unrated one; a Never is never placed in any mode; the phrase "Okay" appears nowhere a coach reads
(screen, help, help search, demo); production reads zero players with an Okay list after the fold,
with the folded count recorded in the release notes.
