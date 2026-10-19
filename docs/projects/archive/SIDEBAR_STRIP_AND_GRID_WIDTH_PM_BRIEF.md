# Sidebar Strip & Grid Width — PM brief

**✅ Closed 2026-10-17.** Every part is built, committed and walked. Still open, none of it owed here: your call on widening the layout check to the new game rows (recommended yes); three tournament pages (Check-in, Communications, PDF settings) widen when next worked on; the Timeline's headings show a one-field venue twice (the tournament admin redesign's list); and on a very large screen the game list has a wide gap between Field and Division (a fix only if it looks loose to you).

**Status:** mockups ratified 2026-10-12 (every ask as recommended; Fair shares B). **Stage 1, Fair shares B, built 2026-10-16** with the club scheduler's Stage 11d part B (its figures in one band above the toolbar, its teams in a card under the grid, the grid the page's full width; walks QA §322). **Stage 2, the sidebar strip, built 2026-10-16** in every portal: club and tournament, the Premium Coaches Portal and the free Coaches Portal (owner: yes, the same strip), after its reviews; on the free portal, while collapsed, the team's header shows on team pages so its name stays on screen (owner). Committed 2026-10-17; your walks (QA §325) passed the same day, 29 of 29. **Stage 3 measured 2026-10-17** on the real screens: filling the screen changes what a person sees only on the tournament Timeline, and only for events with six or more fields (more whole fields side by side before it scrolls sideways). On the Schedules grid it changes nothing; on the Calendar week it shows one more booking on a big screen. The tournament Schedule also stops at 1,100, not at one of the two page widths. Your four calls (Asks 8–11) were ruled the same day as recommended: the Schedules fill is parked, the Calendar stays at 1,200, the tournament Schedule now stops at 1,200 (built; your walks, QA §327, passed the same day, 5 of 5), and the Timeline is drawn before it fills. **The Timeline drawn 2026-10-17** (hub screens 13 and 14): filling the screen would help only events with six or more fields, and none of our test events or the demo has more than four. Letting the Timeline's field columns share the room they already have (option A) helps almost every event instead: team names on 2 lines rather than 4, with no wider page. **Ruled the same day, all as recommended:** the Schedule fills the screen in every view (your idea), the Timeline's fields share the room up to 280, the Day view, All games and Results get a new game row in columns (scores beside their teams, two more games in view), the Schedule's lists fill the page and Results stays a centred 1,200 page. Phones are unchanged. **Built 2026-10-17** on `dev`: the Schedule fills the screen in every view; the Timeline's fields share the room (257 each for a 4-field event on a 1,530 window, 280 at most); the Day view, All games and Results read down columns, rows 60 tall instead of 81; Results is a centred 1,200 page. Two calls at the build, said before the code: on Results a game that is not today shows its day under the clock (the column keeps its drawn width), and the new row shows wherever the list is wide enough for its columns (about 900) — a tablet or a small laptop with the sidebar open, like a phone, keeps today's row. Reviewed (one real catch fixed: a sidebar fold while typing a score no longer loses it) and checked against the drawings in Warm and Dark: no drift. Committed 2026-10-17; your walks (QA §328) passed the same day, 18 of 18. Plan: [SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md](SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md). Hub: `SIDEBAR_STRIP_AND_GRID_WIDTH_HUB.html` (published as an Artifact).

## What changes

- **Every portal's sidebar can collapse to a strip of icons.** Club, tournament and Coaches Portal sidebars get a "Collapse sidebar" row at the bottom. Collapsed, the sidebar is a narrow strip with the same doors in the same order. Waiting counts and chat counts sit on the icons, and each icon shows its name on hover. A program with several pages opens a small menu from its icon.
- **It is always the person's choice, remembered on that device.** Nothing collapses by itself. Phones and upright tablets are unchanged.
- **The Schedules screen gives its grid the room.** Fair shares moves out of the grid's row: its four figures sit in one band above the toolbar, and the team table moves below the grid (option B, ruled).
- **Screens whose columns are days may fill the screen** instead of stopping at 1,200 (ruled; the Schedules grid first, other time grids checked one by one).

## Why it matters

Dense screens are squeezed. On the owner's own screen the Schedules grid gets about 109 per Sunday, so every time wraps onto two lines and only three fields fit above the fold. Measured, the sidebar is only a small part of the cause. The page already stops at 1,200, and Fair shares takes 316 of it. Moving Fair shares helps every customer on every screen. The sidebar strip helps small laptops, and helps bigger screens only together with a fill width.

## Customer impact

Club schedulers and treasurers on laptops, tournament directors on the schedule, and coaches on laptops. A collapsed sidebar affects only the person and device that chose it.

## Priority

Fair shares rides with the club scheduler stage already in its walk. The sidebar strip is a small cross-portal project after that. The fill width is decided screen by screen.

## Success criteria

- On a 1,366 laptop the Schedules grid shows every time on one line.
- A first-time user finds "Collapse sidebar", and gets back, without help.
- No count, dot, badge or door is lost in the strip, in any portal or role.
- Nobody who never collapses sees the sidebar move.
