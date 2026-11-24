# Club schedules: open slots and short teams — plan

**Owner rulings 2026-11-24** (all binding; drawings [SCHEDULE_GAPS_DRAWINGS.html](SCHEDULE_GAPS_DRAWINGS.html), artifact
https://claude.ai/artifact/V5Wz6Jg2eSWCxphptmQHEw, version 3). PM brief: [SCHEDULE_GAPS_PM_BRIEF.md](SCHEDULE_GAPS_PM_BRIEF.md).

## 0. Why this exists

On Milton Bats' winter dome schedule the page listed twenty amber lines ("Milton Bats U11 Rep Purple is 3 short these
Sundays"). Traced the same day:

1. **The lines measured the wrong thing.** Each compared a team with its season share pro-rated over the seven dates on
   screen. Rotation decides who looks behind on any seven Sundays, so the list named teams that had their full share and
   missed teams that were short, and it counted Sundays another booking held as time owed.
2. **The generator had a real bug.** Its weekly quota (`needsFor`) capped each team by what that team could place, never
   by what its group could. With two fields kept for Select, Rep was promised 10 of a Sunday's 12 seats when only 8 were
   Rep's to use; 2 Select-field seats stayed open while Select teams owed time were free (8 open, 8 short, a season).
3. **Some open time is the settings, not a bug.** On the owner's 60-minute run, 60% for Rep is 11 slots a team, and one
   practice a week over 10 usable Sundays allows 10. Rep is promised 108 and can use 100; 8 slots stay open.

## 1. Rulings

| # | Ruling |
|---|---|
| 1 | **A team's share is the limit.** Time nobody is owed stays open. The generator never hands a team more than its share; the screen says why the time is open and what would change it. (A "spill" pass that fills open time past shares was tested and rejected: it breaks the split the coordinator set and moves the bill.) |
| 2 | **One line above the grid; the per-team week lines are removed.** The same sentence on every set of Sundays: how many teams are short and by how much, how many slots are open and where. Only the "where" clause follows the screen. No line when nothing is short or open. |
| 3 | **The band's Short tile is a door** to the same window (arrow after the label, as the band draws a door). Not a door at 0. |
| 4 | **Doors go to Settings; nothing applies itself.** Each door opens the schedule's Settings with that rule or share in view; the coordinator changes it and regenerates. |
| 5 | **"Give it to ▾"** appears only where a free team that is owed time and allowed on that field can take an open slot. On a draft it assigns; on a sent schedule it becomes one of the changes to send. |
| 6 | **No swap suggestion now** (ideas backlog). |
| 7 | **Team names keep the club's name** in this build (a product-wide question, ideas backlog). |
| 8 | **The unit word is "slot"** ("10 of 11 slots"), matching the band's "172 of 180". |

## 2. Stages

### S1 — Generator: the last pass (BUILT 2026-11-24, uncommitted)
`lastPass` in `planWeek` (`lib/club-schedule-engine.ts`): a seat the week's quota left open goes to a team still under its
season share, free that week and allowed on that field, furthest behind first, one whole slot at a time. Never past a
share or the week's cap; skipped under "A set number a week" and for prime seats while prime time has its own share.
Test: `tests/unit/club-schedule-engine.test.ts` "a slot the week's quota left open…" (fails with the pass switched off).
Milton 90-minute data: 8 open → 2 (4 at most, by team order).

### S2 — Drafts step (BUILT 2026-11-24, uncommitted, except the notice)
- Card line folds past 3 short teams (`draftShortLine`, `lib/club-schedule-words.ts`). BUILT.
- By team row "10 of 11 slots" in amber for a short team (`rowSlotsOf`). BUILT.
- **To build:** the notice above the cards (today only the one-a-day reason, `draftsShortWhy`) learns the other reasons —
  one a week, a kept field — saying the cause only (the card says who), with its "Change the rules ›" door.

### S3 — The schedule page
- **Remove** the per-team week lines (`weekShortfalls` lines in `FairShares.tsx`; the 2026-11-24 rewording, fold and Show
  all built earlier the same day go with them).
- **Add** the one line (ruling 2), from the season figures (`fairness.teams` results + open seats), with "See why ›" as
  the shipped `sch.door`.
- **Short tile** becomes a door (ruling 3).

### S4 — The "why" window
`KitDialog` `kind="form"` `size="wide"`, eyebrow = the schedule's name, title "Open slots and short teams", identity line
"Jan 3 – Mar 7 · 180 slots to hand out". **No footer** (a reader window). Groups by reason, each: a white callout with a
coloured edge (amber; olive when someone can take it) holding the reason sentence and doors; under it, unboxed, "Short
for the season" (Team · Has · Share, a Why column only when rows differ; folds at 6 with "Show all N") and "Open slots"
(When · Where · Who could take it · Give it to ▾ in the last column). Phone: full screen, tables become rows, 44px doors
and control.

The reasons, each worked out from data the page already reads:
- **Weekly cap:** a team's share is above `maxPerWeek × weeks with time`.
- **Daily cap:** the existing `draftsShortWhy` reasoning.
- **Kept field:** every open seat is on a kept facility, and every team of the keeping group(s) has its share.
- **Someone can take it:** a free, eligible team under its share (the last pass's own test, on a saved schedule).
- Anything else: a plain "No team that is short can play then" with the rule that stops each, never silence.

### S5 — Records
Help guide (`lib/help-content/org.tsx` §1502: "a team short of its share this week" is wrong after S3) via `/docs`; demo
check via `/demos` at the cycle; `/review` on S1–S4 before commit.

## 3. Open questions

- The owner's 60-minute run showed 8 Rep teams "10 of 11"; a rebuild of the same input showed the targets capped at 10
  (no team short). Pin down which is right before S4 states "11" anywhere: a target above what the weekly cap allows
  should probably read as the cap, with the reason saying so.

## 4. Built 2026-11-24 (uncommitted at the time of writing; commit at the owner's word)

S1–S5 built in one session, then `/review` (high-risk tier, four lenses). What the review changed:
- **The last pass spends only the week's own budget** (`toHand`, what the week meant to hand out, less what it holds). A
  first version owed each team its whole season and front-loaded any split under 100% (48%: weeks 1–6 full, 7–12 empty);
  a per-team pace instead left Milton's gap open. With the budget: a 48% schedule stays even week to week (test "shares
  under 100% stay paced") and Milton's 90-minute data still goes 8 → 2 open. Teams in a sharing rule are left out of it.
- **Has · Share counts units** for a team that shares ("4½ of 7", never "10 of 12"); the gap stays whole slots.
- **The held-back test counts slots** (what a practices-a-day or -a-week rule counts), not units.
- **"Every team allowed there has its share"** is said only when no short team may play on that field.
- A slot a team handed back is never offered back to it; a slot of an added part has no "Give it to" (only that part's
  teams may have it); a door keeps its setting through the which-part question; phone rows label each figure.
- Help guide (`lib/help-content/org.tsx`, schedule page article) rewritten for the one line and the window.
