# Opponent Scouting Book — PM Brief

**Status:** Proposed · **Plan:** `COACH_OPPONENT_SCOUTING_BOOK_PLAN.md` · **Date:** 2026-08-03

## What it is

A page per opponent: your whole history against them — every meeting across every season,
your record, the last score — plus the coach's own scouting notes ("their #4 bunts on the
first pitch", "lefty ace, sits our righties"). It shows up in three places: an **Opponents**
section inside Insights, a **Scouting tab** right on the game in the schedule, and eventually
in Game-Day Mode's header. Today every rep coach keeps exactly this in a phone notes app; we
have the game history and they don't.

## How the coach's loop works (redesigned per owner direction 2026-08-04)

**Log by game → aggregates automatically → read in game week.** Right after entering a final
score, the "Saved" message quietly offers *"Add to the book on Thunder?"* — a 20-second sheet
where the coach jots one-line observations ("their SS cheats up with runners on"), each
optionally tagged (Pitching · Hitting · Defense · Baserunning). Skippable forever. Every
observation files itself under that opponent with the game and date attached — the coach
never organizes anything. There is deliberately **no separate scouting section to remember to
visit**: capture lives where scores are entered, reading lives in Insights and on the
schedule.

## What a coach sees and does differently

- Insights gains an **Opponents** tile: a list of every team you've faced, with your all-time
  record against each and when you last met. Open one and you get the book: record, runs
  for/against (in the sport's own words), and a timeline of every meeting with the
  observations logged after each game nested beneath it, filterable by tag. On top sits **the
  book line** — the coach's one-sentence distilled read, which is what every glance surface
  shows first.
- In game week, the masthead nudges once: "You play Thunder Saturday — 6 observations in the
  book."
- On the schedule, any game against a team you've played before quietly shows your record
  next to their name (`vs Thunder · 2-1`). Opening the game reveals a Scouting tab with the
  record, the last meeting, and the notes — readable and editable right there, the night
  before.
- Two spellings of the same team ("Thunder 12U" vs "Oakville Thunder")? One "Same team as…"
  merge and the history unifies; scores and games are never edited to make that happen.
- Scrimmages are listed but never pollute the official record — the record uses the same
  counting rule as Season Wrapped, so numbers agree everywhere.

## The whole bench scouts (deep-dive additions, 2026-08-04)

Anyone on staff — assistants *and* helpers — can log observations, because the best eyes are
often the parent keeping the book. Every entry is signed with who wrote it, appears
immediately (no approval queue — friction kills the habit), and the head coach can remove
any entry while authors can remove their own. The **book line** — the program's official
one-sentence read — stays head-coach territory. Capture microcopy sets one cultural rule:
opposing players are referred to by jersey number, never by name (they're other people's
kids), and photos are never part of this feature.

## The edge features

- **The numbers vs them (automatic):** insight lines computed from data already in the
  product — home/away splits, "all three meetings decided by 2 or less," biggest win — and
  the self-scouting gem: "In both wins, Maya started at pitcher; in the loss she didn't."
  Every line says how many games it's based on.
- **Tournament intel (the moat):** for a game inside a tournament that runs on FieldLogicHQ,
  the scouting tab automatically shows the opponent's other results *from that same
  tournament* — "their day so far" — before you face them. No coach app can copy this,
  because no coach app runs the tournament. Public scoreboard data only.
- **Share the game plan:** one tap posts a snapshot (book line + observations + numbers)
  into the existing staff chat, so assistants arrive Saturday already briefed.
- Later: the practice planner shows the week's opponent book while you plan Tuesday's
  practice, and Game-Day Mode opens the book from the bench.

## Why it matters

- Pure head-coach territory — not manager or treasurer work — and it makes the portal feel
  like a professional program's system rather than an admin tool.
- Exceptional value for effort: the games, scores, and seasons are already in the product;
  we're organizing memory the coach already wants and owns nowhere else. It also deepens the
  moat — a multi-season scouting book is the kind of accumulated value that makes leaving
  the platform expensive.

## Role differences & boundaries

- Premium portal, no new billing gate. Writing notes follows the same permission that guards
  coach notes today (head coaches by default; assistants only if granted); we propose
  assistants who can see the schedule may *read* the book.
- Notes are about opposing *teams* — never about individual children; nothing here is
  family-visible.
- The book is a live-season instrument: it remembers past seasons *for* the current one, but
  archived seasons don't grow a scouting page (consistent with the archive-is-opt-in rule).
  Past games themselves remain visible in the archives exactly as today.

## Tradeoffs made

- Opponent identity is by name, with a coach-controlled merge — not a heavyweight registry.
  A misspelled opponent simply shows as a separate row until merged; nothing breaks.
- Observations are one-line fragments with an optional tag — not a structured scouting form.
  Coaches write in fragments at 10pm; forms would kill the habit the score-toast door is
  trying to build.
- The book line updates in place (live intelligence, like the drill library) rather than
  freezing a copy per season; the dated observation log underneath preserves the history
  anyway.

## Success criteria

- Coaches write notes for their frequent opponents (≥3 booked opponents per active premium
  team within a season) and return to them in game week (tab opens on game days).
- The record chip appears on schedule rows with zero added load time.
- Zero data edits to any game row caused by this feature (by construction).

## How to test (owner QA)

On a team with a couple of seasons of games: open Insights → Opponents, check a rival's
record matches Wrapped's counting, write a note, then find that rival's next game on the
schedule — the record chip and Scouting tab should be there with your note. Merge a
duplicate spelling and watch the two histories become one. Confirm a brand-new opponent and
a "TBD" bracket slot show nothing scouting-related, and an archived season has no Opponents
tile.
