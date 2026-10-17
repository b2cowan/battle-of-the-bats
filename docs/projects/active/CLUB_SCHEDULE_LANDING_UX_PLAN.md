# Club schedule landing UX — Implementation Plan

**Owner direction (2026-10-17):** build the reviewed [interactive mockup](CLUB_SCHEDULE_LANDING_REVIEW_MOCKUP.html) in this chat. This revises the earlier Fair shares B placement and the ask ordering deliberately; the existing grid and its edit behaviour remain available.

## Outcome

A club admin opening a sent recurring schedule sees what needs attention, what coaches have already received, the repeating assignments, and every exception before working in the full date grid. A busy queue stays short until expanded. Fair shares is a visible view, so there is no separate jump link or duplicate table after the grid.

## Task list

1. Group waiting hand-back asks and the unsent change in one Needs attention panel. Show the three asks whose affected Sundays come soonest, then allow the reader to reveal the rest. Keep the unsent change visible. Show all change lines on demand. Preserve the Answer and Send windows, the one primary action, and Accounting permissions.
2. Add a desktop Overview for sent, single-weekday recurring schedules. For the dates currently selected, group matching facility/time/team/status assignments and name each differing date. A date off or open slot must remain visible. Overview is read-only; its rows open the existing grid for inspection and editing. Drafts and schedules without a one-weekday recurrence still open on Grid.
3. Move the existing Fair shares by team card into a visible desktop view. Keep the four whole-schedule figures above the view switch and their existing money gate. Keep Grid, By team, and By group available. Remove the duplicate Fair shares jump link.
4. Preserve the phone's Day and By team behaviour. Check role-dependent copy and controls, queue expansion, schedule exceptions, and view changes with focused tests and type/lint checks. The owner performs browser visual verification under `AGENCY_RULES.md`.
5. Add a Group filter beside Facility and Team in the desktop Grid. Group choices come from teams on this schedule. Selecting a group narrows the Team choices, and the two filters apply to the same team even in a shared slot. Switching groups clears team choices that are no longer available; clearing Group retains any specific team choice.
6. Name the specific existing time and facility when a drag would put a team in two overlapping slots. A valid swap at different times remains allowed; the overlap rule stays in place. Use the same reason in the drag preview and the refused-drop notice.

## Data and access boundaries

- The existing schedule read supplies all information. No API, schema, or billing arithmetic changes.
- A person without Accounting access never receives money figures from the route and cannot answer a hand-back ask. The new presentation must not infer or reveal those figures.
- One unsent change item represents the send batch, even when it contains multiple changed slots. Its full list remains reachable before sending.
- For a late ask without a future Sunday, order by its recorded hand-back day; otherwise order by the nearest affected club day, then request age. This departs from the previous oldest-first presentation because the next practice is the practical deadline.

## Success criteria

- Ten pending items do not produce ten open cards above the schedule; the default shows at most three ask rows plus the change item, with truthful counts and a reveal control.
- Every affected Sunday and every schedule exception remains reachable; grouping never hides a slot or creates a bulk edit affordance.
- Fair shares is reachable in one visible view choice and does not repeat below Grid.
- Existing schedule mutations, bills, exports, and phone actions retain their behaviour and permissions.
- A Group selection such as Senior highlights all Senior assignments, with Team available to narrow within that group. Open slots and other groups dim as the Team filter already does.
