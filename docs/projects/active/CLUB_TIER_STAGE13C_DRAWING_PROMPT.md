# Club Tier Stage 13c · The club's time in one place (DRAWING session first, build prompt after)

> Written 2026-11-08 (by `/tasks`, on the owner's request), after 13b was walked and the Admin header Phase 2 passed. Paste into a
> **fresh chat on `dev`**: `execute @docs/projects/active/CLUB_TIER_STAGE13C_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is one published drawing (a
> Claude Artifact), the owner's rulings on it, and then a **build prompt** for 13c. Recommended model: Opus. Run `/ux` and `/design`
> before the hand-off. It touches no code, so it can run beside any build, including the Admin header Phase 2D build.
>
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) (the ladder, §11.1 F-XR-5 and F-XR-6,
> §11.5, and the status log). Hub of the earlier drawings: https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY (source
> [CLUB_TIER_STAGE13_JOURNEYS_HUB.html](CLUB_TIER_STAGE13_JOURNEYS_HUB.html)): the tab "Drawn: the club's time in one place" and the Asks tab (Asks 1, 12, 13).
> Standing rules: `docs/agents/design/NAV_STANDARD.md`. Mark each fact **[V]** (you opened it this session, with file:line or the shot's name)
> or **[H]** (handed to you here, unverified). Everything below is [H] unless marked. Branch `dev`; explicit pathspecs; ask before committing; never push.

## What 13c is

The ladder's line: **the club's time in one place.** A club's time runs **Permit → Schedule → Fair shares and the bill → Send**, and today a
person cannot see that as one path, and a change at one end does not tell the other. The owner's own opinion was that permits are hidden inside
Venues. Stage 13 found, on the hub's walks:

1. **High (F-A4-3).** Pulling dates off a permit warns about nothing: the form, the saved permit, the Permits list and the Overview stay silent
   while bookings (rep practices, hand-entered games) sit on a day the club no longer holds. Direction on file: on save, list the bookings that now sit on the pulled dates, with a door to each.
2. **High (F-A4-4).** No screen says "the city took these dates". The permit's dates off and the schedule's own "Dates off" are two lists that are not linked.
3. **Med (F-O6-3).** Permits (held / booked / unused) sit two levels down, under Organization › Venue library; nothing on the Overview or Calendar points to them. Direction on file: a Permits door at the level of Calendar and Schedules, or a held-and-used line on the Overview. (13i was to add a Permits row: **read what 13i actually shipped before drawing**.)
4. **Med (F-XR-6 / F-O6-12).** An empty Calendar week shows seven dashes and a disabled Export; it should name the next event. The Overview has no "this week / what's next" line.
5. **Unverified lead (R-F-05).** A tournament's "+ New venue" may write a venue outside the club's venue book. **Check it in the code first**; it is a finding or it is nothing.
6. Left for 13c by the fix-now session: the **Slots column per team** at 1 a day, and the time window's own "… in Schedules." sentence for a league admin.
7. Related and **out of scope here, but the drawing must not contradict them:** F-XR-5 (Ask 12 ruled that "cancel this day across programs" gets its own plan; that plan was never written, so name where it will attach and stop), and F-O6-4 (a free-time view by week across permits is a product gap, not navigation: say whether 13c leaves room for it, do not draw it unless you recommend it).
8. The hub's Asks list names 13c as **Large, Asks 1, 12, 13**. Read their wording on the hub's Asks tab and record what each was ruled (the plan's status log says Asks 1 and 13 are "ruled"; Ask 12 is the cancel-a-day one). Do not re-ask a ruled question.

## Why a fresh drawing round, and what the baseline is

The earlier 13c drawing was made before the club frame changed. Draw the baseline as **today, with these already built or ruled**: 13a (doors by
person), 13i (the sidebar's shape: places in the rail, pages on the page), 13b (each person's home, including the Overview band and its Calendar line),
the Admin header Phase 2 (the pinned bar names the place, its tabs pinned inside it) and Phase 2D's ruling (the desktop strip, option B:
https://claude.ai/artifact/A1W443obR8aJd8PjUZEgUx version 2). **Do not redraw any of those**; 13c adds to them. If one of them already delivered a 13c item, say so and drop it.

## Disagree out loud (settle these in the drawing, with a recommendation each)

- **Is "the club's time" a place or a path?** A new sidebar row (Permits, or "Time") fixes discoverability but 13i's rule is places in the rail, pages on the page. Draw both: a Permits tab inside an existing place, and a new place; recommend one with the reason from 13i's own rule.
- **Where does the warning live?** The pulled-dates warning (items 1 and 2) must reach the person who is **not** on the permit screen: the Overview's Still-to-do, the Schedules page, the team's page. Draw who gets told, where, and what the door says. "Warns, never blocks" is the standing pattern for clashes between programs (Stage 6a): keep it unless you can show why not.
- **Five people see different time.** Owner, club admin, league admin, registrar, treasurer. Which of them hold permits at all? Draw the owner and the one who sees the least, so a one-door person is not lost.
- **Phone.** Draw every new thing at 390 with the bottom bar and the More sheet. If the path cannot be one thing on a phone, say so and propose the phone's own shape.
- **Do not widen by accident** to the tournament admin or the coach portals. Find out from the code whether the Calendar and the Schedules page are shared with them before promising either.

## Steps

1. **Read** the plan's 13c rows, the hub's "time" tab and Asks tab, `NAV_STANDARD.md`, `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` (what permits, dates-off and the scheduler already do) and the 13i / 13b records of what shipped. The hub's findings live in `.probe/nav-journeys/hub/content.cjs` and the captures in `.probe/nav-journeys/shots/` (git-ignored scratch; the A4 and O6 shots are the evidence).
2. **Settle the facts from the code** before drawing: where permits live in the nav today, what a permit's "dates off" does to existing bookings, what the schedule's "Dates off" does, what reads the venue book, what the Calendar shows on an empty week, and how the Overview band already carries the calendar line.
3. **Re-open the evidence** for items 1 to 4 and capture anything missing from a **local production build** (`node .probe/p5-prodbuild.cjs start`, port 3100); never the :3000 dev server. Put real counts in the drawing.
4. **Draw** (Claude Artifact, not the design canvas; house layout: sticky numbered tabs, minimal scroll, an *Everything / Show only what differs* toggle; whole-screen before/after at true size; controls drawn from their shipped components; NEW / RESTYLED / UNCHANGED tags; every highlight clickable):
   - Permit → Schedule → Fair shares and the bill → Send as one visible path, today and after.
   - Pulling dates off a permit: the save, the warning, the list of bookings now on pulled dates with a door to each, and where the schedule shows the same dates.
   - The Permits door (both placements), the Overview line, and an empty Calendar week naming the next event.
   - The same at 390, the owner and the smallest-access person, and the Slots column / league-admin sentence.
5. **Asks** for the owner, each with a recommendation and the alternative, numbered so the paste-back is short.
6. **Run `/ux`, then `/design`** and apply what they find before publishing. Say in the hand-off what each changed.
7. **Publish** the Artifact once. Do not edit product code.
8. **Hand off in product-owner voice**: what a person sees and does differently, how it feels on a phone, the asks, and where 13c sits (before 13d). Record one status-log entry in the plan with the Artifact link and add the link to the TODO Stage 13 line.

## After the owner rules

Write the **13c build prompt** (`CLUB_TIER_STAGE13C_BUILD_PROMPT.md`): the screens, the guards, the help articles and demo-tour anchors that name a moved row, one QA walk (its own Owner QA Ledger section) and the staging layout sweep. It is **Large**: split it into sessions and say which screens each touches (it shares the schedule page and Fair shares with any scheduler build, so sequence against those).

## Do not

- Build or edit product code. Redraw 13a, 13i, 13b or the header bar. Draw "cancel this day across programs" (F-XR-5 has its own plan to come).
- Invent a number: counts and heights come from the captures or the database.
- Record the owner's answers as anything but what they said.
