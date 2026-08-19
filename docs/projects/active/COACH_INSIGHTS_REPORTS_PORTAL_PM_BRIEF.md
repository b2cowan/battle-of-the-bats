# PM Brief — Insights becomes a Reports & Analytics Portal

**Status:** P1 + P2 + P3 all built on dev · P3 (the charts) shipped 2026-08-19, owner QA §62 owed
**Plan:** `COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md` · **Mockups (the spec):**
https://claude.ai/code/artifact/7d02e402-fd59-4b11-8d88-33fe95fffd8c

## What the coach sees and does differently

Today, Insights is a stack of question-styled tiles ("Who's showing up?", "Where is playing time
going?") with a search-lookalike bar that only accepts six canned questions. After this project,
Insights is a **reports portal**: a permanent row of tabs — Dashboard · Results · Attendance ·
Playing Time · Development · Awards · Scouting Book — that the coach can flip between without ever
losing their place, exactly like the Money hub. The Dashboard opens first: the season scoreboard,
a momentum chart, "What stands out," and a rail listing every report with one live stat each.

Three of those tabs also gain a small chart, sitting above the numbers they summarize: the Dashboard
shows the season's scoring trend as a line, Results shows the same trend with each game's win/loss
marked beneath it, and Attendance breaks the season's turnout rate down by month. Nothing is invented
to draw them — a brand-new season, or a stretch with no score entered yet, shows an honest "not
enough yet" note instead of a misleading line, and a chart never disagrees with the table sitting next
to it about which games count.

The question bar is **removed**. In a world where coaches use real AI every day, a search box that
only accepts six pre-written questions makes the product look less capable than it is. Nothing it
answered is lost — every answer becomes permanently visible in its report: "who hasn't played a
position lately" is now a recency grid in Playing Time, "whose arm needs a rest" is an arm-care
panel there too, "who's missed the most practices" is a highlighted row in Attendance with a
click-to-see-the-missed-events drill-in.

## The rulings this bakes in

- **No money in Insights, anywhere.** Insights is player/team stats for coaches, not treasurers.
  The dues tile, money call-outs, and past-season dollar figures all leave; money lives on the
  team Overview and in the Money hub. (Side effect: an assistant whose only duty is money no
  longer sees Insights at all — their home is the Money hub.)
- **Two "Development"s become one.** The nav workbench is renamed **Skills & Goals** (set focus
  areas, record measurables, keep drills); the word "Development" now belongs only to the coverage
  report inside Insights — the read-only check that no player is slipping through. The report
  links to the workbench; the checklist-never-a-ranking rule is unchanged.
- **Scouting Book** keeps its true name as a tab. **Tryout reporting stays in Tryouts.** The
  portal stays **live-season-only** — a closed season remains one page, untouched by this project.

## Why it matters

Coaches evaluate the portal by whether it feels like a real analytics product. Tabs they can see
and flip between read as "this is a reports suite"; buried tiles and a fake search read as a demo.
The drill-ins also change the coach's conversations: every claim ("she's missed 4 of 5 practices")
comes with the actual dated records behind it, which is what a coach needs when talking to a family.

## Tradeoffs

- Removing the question bar retires a shipped feature (and its parked AI extension) — accepted;
  its machinery is reused by the drill-ins.
- Renaming a nav item coaches have learned ("Development" → "Skills & Goals") costs a little
  relearning once, and travels with help guides, the tour, and demo narration in the same release.

## Phasing & success

Three owner QA walks: **P1** the tabbed shell, renames, and removals (bar, money); **P2** the
drill-ins and absorbed answers (recency matrix, arm care, attendance receipts, reply rate);
**P3** the charts. Success: every old link lands on the right tab, no money renders anywhere in
Insights, all six retired questions are answerable at a glance inside their reports, and every
chart's edge cases — no data, one data point, a game with no score, a failed load — read honestly
rather than only ever being demoed on a full season.
