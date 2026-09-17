# PM brief — Team progress: a team-level read for Skills & Goals

**16 September 2026 · Ruled "Build as drawn" and built on dev the same day; committed `e88e31f5` 2026-09-17; your QA walk (§196) is on the hub's QA Walk tab · Plan: [COACH_TEAM_PROGRESS_VIEW_PLAN.md](COACH_TEAM_PROGRESS_VIEW_PLAN.md) · Hub artifact `1omqXRfxFi8UsrCKXCcjN6`**

**The one thing to check first: nothing in this proposal ranks or compares individual players.** The new report's rows are *metrics*, not players; every figure is a count of *how many* players, never *which*; and no family surface — the development handout, the season recap — reads it. A parent cannot reach it and a coach cannot sort it.

## What a coach can now see that they couldn't before

Insights → Development gains a fourth report beside Coverage, Player progress and Practice review: **Team progress**. One row per metric the team measures. Each row says how many players have a result this season and — of those with two or more, the players *compared* — how many sit lower or higher than their own first result, in the test's unit with the aim stated: *"60-yd sprint · 4 of 12 · 3 compared · 2 lower · 1 higher · lower is the aim · last recorded 15 Sept."* (The first build drew "two or more" as its own column; on the built screen the owner asked what it meant, and it is now said inside the cell it belongs to.) A last column says when a result on that metric was last taken. A metric's row opens Coverage on that metric, where the names are, in roster order. On a phone it is one two-line card per metric.

The Skills & Goals Overview does not change. Its "Reports in Insights" row already counts the reports a coach can open, so it reads 4.

## Why it matters

Today a coach can see who has a result (Coverage) and how one player has changed (Player progress), but not whether the thing they are coaching is moving across the group. Answering "is the sprint work landing?" means opening Player progress once per player — twelve times on a twelve-player roster, for one test. Development is the one Insights tab with no team-level read; Results, Attendance and Playing Time all have one. And "when did we last measure throwing?" has no answer short of reading a column per metric.

## What was deliberately not proposed, and why

- **A team average or a trend line.** On the fixture's real records the 60-yd sprint's session average reads 8.62 → 8.42 "since May" — but May is one child and September is four different children, and one newcomer's first result moves the figure by itself while another player's time went up. A team average on a roster this size is a child's number wearing a team label. Counts carry their denominator in the sentence; an average hides it.
- **Anything on the Overview.** It was ruled state, not analysis (D7), and that holds on its merits: the Overview counts what a coach acts on today.
- **A per-player change column on Coverage.** A column of changes beside names is a ranking by eye.
- **A count per skill descriptor.** A distribution of children across a coach's judgment words is a rating table without names.
- **A sentence on the Insights Dashboard's "What stands out" strip** — not in this version; a nudge needs a threshold and a tone the report has not earned yet.

## Customer impact

Every coach with record access on a Premium Coaches Portal team — head coach and assistants alike — the same audience as Coverage. Read at a few natural moments a season: mid-season, before planning a session, at the season's close. If we do nothing, the product stays complete and the coach keeps touring Player progress; the cost is time and an unanswered question, not a broken flow.

## Priority

Low-cost and self-contained: no migration, no new data read (the counts come from a walk the product already makes), one table on the existing list recipe, no change to any screen a family sees. Fits between larger work; it does not block anything and nothing blocks it. **"Not now" is a legitimate ruling** — the plan weighs it as one, and the honest caveat is that a young season reads thin ("none has two results yet" on most rows) until a few sessions are in.

## Success criteria

- A coach answers "how many of my players have moved on X, and which way" from one screen, without opening a player.
- A coach answers "when did we last record X" from the same screen.
- No development surface — this one included — carries a figure beside one child that another child's figure can be read against.
- Team progress, Coverage, Player progress and the Overview never disagree on a count, because they read one denominator and one series.

## Decisions for the owner

Eight, lettered T1–T8, on the hub's Decisions tab with a paste-back: T1 build as a fourth report (or nothing) · T2 rows are metrics, four columns, the row a door · T3 counts of direction, never an average · T4 no floor · T5 the season window, no Compare · T6 skills are coverage only · T7 the Overview unchanged · T8 record access reads it, no family surface ever does.
