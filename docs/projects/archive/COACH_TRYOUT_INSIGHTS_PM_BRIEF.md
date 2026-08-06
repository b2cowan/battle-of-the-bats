# PM Brief — Tryout Insights (Report · Development Baseline · Candidate Memory)

**Date:** 2026-08-02 · **Status:** Direction ratified; mockups v1 awaiting owner review
**Plan:** `COACH_TRYOUT_INSIGHTS_PLAN.md`

## What we're building, in one sentence

The tryout stops being a one-day tool: when it ends, the coach gets a professional report they can
hand to their board, every new player's development page starts the season already populated with a
baseline and agreed focus areas, and next year the coach sees each returning candidate's growth at
the exact moment they're deciding on them.

## What the coach sees and does differently

**1. The Tryout Report** (on the tryout hub's "Build your team" stage)
- A live report grows as the tryout runs — the signup-to-roster funnel, turnout compared to last
  season, where the incoming class is strong and thin, and how many roster spots went to returning
  vs. new players. When every candidate has a decision, it stamps itself final.
- One tap exports a **board-safe PDF**: aggregates and roster names only — no child's scores or cut
  decisions. A full-detail version (every candidate, every score) exists but only behind a deliberate
  "this is for coaching staff only" confirmation.
- The report includes a **fairness receipt**: a plain statement that N players were scored by M
  independent evaluators on one shared scorecard before names were revealed. For the coach facing a
  skeptical parent or club board, this document is the answer — and no competitor gives them one.

**2. Development baseline** (after acceptances)
- A guided ten-minute pass: for each new roster player, the coach sees their tryout snapshot and the
  product suggests one or two focus areas from their weakest categories. The coach confirms, edits,
  or skips — nothing is ever written automatically.
- Each player's development page then opens the season with a clearly labeled "Tryout snapshot"
  card. The development hub — our premium retention feature — starts alive instead of empty.
- Hard rule: tryout scores are coach-eyes-only, forever. Families can be told a player earned their
  spot; they never see a number.

**3. Candidate memory** (next season's decision board)
- A confirmed returning candidate shows last year beside this year — "Last Aug: 3.1, waitlisted ·
  this year: 3.8 (+0.7)". The kid who was cut, trained all year, and came back better is finally
  visible at the moment it matters.
- Deliberately invisible during scoring: evaluators stay blind; memory appears only after names are
  revealed, so the fairness story stays true.
- The report can then honestly claim "returning candidates improved on average" — a program-quality
  line clubs will quote.

## Why it matters

- **Wow at the moment of adoption.** The first tryout is how standalone premium coaches meet us. The
  report is shareable proof of value aimed at exactly the people who influence renewal (boards,
  parents, other coaches).
- **Acquisition feeds retention.** Today tryout data dies when the tryout ends. The baseline hands
  that data to the development hub — the feature that keeps coaches subscribed all season.
- **A moat that compounds.** Candidate memory only exists for coaches whose history lives with us.
  Every season on the platform makes leaving more expensive in the most human way possible: the
  growth stories of their own players.

## Tradeoffs made (and why)

- Printables default to the safe version; richness costs one extra deliberate click. Protecting
  children's evaluation data from accidental circulation outweighs convenience.
- Tryout ratings are kept out of the measurables/trends system on purpose — a subjective panel
  rating pretending to be a measurement would quietly corrupt the honesty rules the recap already
  enforces.
- Suggestions require coach confirmation, always — slightly slower than auto-tagging, but it keeps
  the coach the author of their own development vocabulary.

## Role/access differences

Premium portal, tryouts capability (head-coach-only in V1, unchanged). Assistants and evaluators see
nothing new. Families see nothing, ever — by binding rule.

## Priority & sequencing

Report → Baseline → Memory. Each is independently shippable; the report is the most visible win and
defines the data format the other two reuse.

## Success criteria

- A coach can produce the board-safe PDF within one tap of the Build stage, and the full-detail
  export never ships without the explicit confirmation.
- ≥ half of accepted players on a team get a confirmed baseline within a week of acceptance
  (adoption signal for the seeding walkthrough).
- Memory renders on confirmed returning candidates at Decide, and provably never on the blind
  scoring surfaces (automated probes assert its absence).
- Zero family-facing surface ever includes evaluation content (guarded by tests, not convention).
