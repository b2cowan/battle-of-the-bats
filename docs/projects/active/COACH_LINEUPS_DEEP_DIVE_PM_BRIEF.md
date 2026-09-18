# Coach Lineups Deep Dive — PM Brief

**Status:** Recommendation and mockup ready for review (2026-09-18). No production behaviour changed.

## What changes for the coach

Lineups becomes a guided preparation flow instead of three quiet tables and a row of equal-looking controls.

The coach still works through Batting order, Positions, and Playing time, but the page now shows where they are in the process and what remains. Auto-fill is the clear primary action and names the mode it will use. The position grid and dropdowns sit on a solid, high-contrast surface. Blank decisions say `Open`; deliberate sits say `Bench`; required roles that are not covered are named by inning and can be jumped to directly.

The games list stops calling any partly filled lineup “set.” It shows Not started, Draft, Ready, or Needs review. The recommended version lets a coach mark the lineup ready and records who did it; any later edit returns it to Draft.

Playing time shifts from a colour-heavy count matrix to a review surface: field and bench totals, consecutive-sit attention, position variety, and pitching innings against the cap the team set. Season trends remain in Insights.

## Why it matters

The current tool is functionally rich but visually under-signalled. On the warm theme, page grid lines show through both tables, headings and controls use quiet gray ink, and translucent dropdowns look disabled. A first-time coach has to discover the workflow and the meaning of blanks by trial.

More seriously, the product currently calls a lineup “set” after any single assignment is saved. Its incomplete-lineup warning also guesses that a Never preference caused the hole even though the analysis has no eligibility or cap data.

In the attached Milton lineup, inning 7 genuinely has two open field roles (`P` and `LF`). The two blank player cells belong to pitchers, but that does not assign either pitcher to `P`; both are still eligible under their caps, and one can cover LF. The useful message is therefore “Inning 7 is a draft with P and LF open,” not an amber claim that a Never setting made the inning impossible.

## Customer impact

This affects every head or assistant coach who can edit lineups, especially a coach building one for the first time or making changes on a tablet at the field.

The benefits are:

- faster first-use comprehension;
- fewer incomplete lineups presented as ready;
- fewer false or unhelpful warnings;
- clearer position controls in both coach themes;
- safer manual overrides because real cap/Never conflicts are named;
- better staff handoff through ready-by/time;
- faster playing-time and pitching review before game day.

Access does not change. Any coach who can edit lineups can complete the flow. In the recommended readiness model, the product records who marked it ready; it does not create a new head-coach-only gate.

## Priority

**P0 for truth and legibility; P1 for workflow and analysis; P2 for the inning inspector.**

The warning cause, false “Lineup set” state, translucent table grounds, and low-contrast controls undermine trust in a marquee Premium feature and should be fixed together. The inning-first inspector is valuable but should follow the shared truth model rather than delay it.

## Success criteria

- A partly filled lineup is never labelled Ready or Lineup set.
- An open-role message names the inning and roles without inventing a reason.
- Proven cap, Never, or position-conflict issues point to the exact player cells.
- The blueprint grid does not show through positions or playing-time tables.
- Headings, values, and dropdowns meet the approved table and semantic-ink standards in warm and dark themes.
- A first-time coach can build, review, and mark a lineup ready without needing Help.
- Playing time answers who sits, who sits consecutively, where players rotate, and pitcher cap headroom.
- Any edit after readiness visibly returns the lineup to Draft.

## Recommended delivery

1. Shared validation/readiness model plus regression tests.
2. Solid table/control treatment and actionable inning completeness.
3. Draft/Ready workflow and hub/game-day status updates.
4. Playing-time and Auto-fill explanation improvements.
5. Inning inspector and Sport Pack position vocabulary as follow-on work.
