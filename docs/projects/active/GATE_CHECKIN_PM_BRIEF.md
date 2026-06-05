# PM Brief — Gate / Team Check-In + Coach Roster

**One line:** Give organizers a fast game-day check-in board (who's here, who owes, who's a
no-show) and let coaches submit their roster ahead of time so the gate is just a confirmation.

## Proposed functionality
- **Coach roster (ahead of time):** Once a team's registration is accepted, the coach can
  enter their roster — player names, jersey numbers, dates of birth — from the coach portal.
  Optional, editable up to game day.
- **Gate check-in (game day):** A mobile-first board lists accepted teams by division. For
  each team, staff can: mark **Present** (or **No-show**), **collect an outstanding fee** if
  the team still owes, and **confirm the roster** the coach submitted — or **type the roster
  in on the spot** if the coach didn't use the app.
- **At-a-glance status:** Header shows arrived / total, fees collected, and a no-show list.
- **Who can run it:** Organizers from the admin **Check-in** page; plus a stripped-down
  **gate-volunteer view** (like the scorekeeper screen) so a volunteer with a phone can check
  teams in without full admin access.

## Why it matters
Check-in is the first chaotic 30 minutes of every tournament — clipboards, "did they pay?",
"where's their roster?", "did Team X even show?". This replaces the clipboard with one screen,
turns roster collection into a pre-game-day task for coaches, and gives the organizer a live
picture of who's actually on site.

## Customer impact
- **Organizers:** faster, calmer mornings; instant no-show + unpaid visibility; no re-keying
  rosters.
- **Coaches:** submit the roster once, on their own time; nothing to print.
- **Volunteers:** a single-purpose check-in screen they can't get lost in.

## Priority & sequencing
Phase D "bigger bet" of the admin redesign. Build order: **1** data foundation → **2** admin
check-in board → **3** coach roster submission → **4** gate-volunteer view → **5** dashboard
integration. Each phase is independently shippable; the admin board (Phases 1–2) delivers value
even before coach submission exists (staff can capture rosters at the gate).

## Success criteria
- An organizer can check a team in (present / no-show) and see arrived/total update live.
- An unpaid team can be marked paid at the gate; the amount owed is visible beforehand.
- A coach can submit a roster after acceptance; at the gate it shows as "submitted" and is
  one tap to confirm; a no-submission team can have its roster entered on the spot.
- A non-admin volunteer with the new capability can run check-in and nothing else.

## Tiering
Tournament + Tournament Plus (organizer ops). Not a paywalled add-on within those tiers;
gate-volunteer seats follow existing member/role management.
