# Club schedule daily practice limit — Implementation Plan

**Owner direction (2026-10-17):** a club schedule should start with one practice per team per day, with an adjustable control visible in Settings. Back-to-back 90-minute practices should not appear as an unexplained default.

## Outcome

A club schedule admin starting a blank schedule sees the daily practice limit with the other basic scheduling choices. It starts at one practice per team per day. The admin can raise it to two, three, or four, or select no daily limit. The existing optional weekly cap stays under Rules.

The generator already enforces the daily cap. This change uses that behavior without changing sent schedules or existing assignments. Opening or copying a saved schedule retains its saved limit, including no limit.

## Task list

1. Set the blank schedule form's daily limit to one. Keep the settings reader's legacy no-limit behavior for saved values.
2. Put the daily limit above the team list in the visible Settings section. Explain that one practice prevents back-to-back sessions and may leave slots open when there are more slots than teams.
3. Leave the weekly cap as an optional rule and remove the duplicate daily control from folded Rules.
4. Warn during a grid drag if a move or swap to another day would newly exceed the saved daily limit. Preserve the existing hand-edit override convention and the hard refusal for overlapping times.
5. Verify new default, saved no-limit round trip, generator enforcement, optional rule count, and drag warning with focused tests, lint, and typecheck. The owner performs browser visual verification.

## Capacity and access

The example dome schedule has eight teams and 12 slots each Sunday. At one practice per team, at least four slots per Sunday remain open unless more teams are added or the limit is raised. This is a deliberate visible tradeoff, not a generator failure.

The same Settings choice is available to club schedule admins who can generate schedules. Accounting permissions and billing values do not change.

## Success criteria

- A blank schedule shows “1 practice” before generation, outside folded Rules.
- A copied or existing schedule with no daily limit still shows “No daily limit.”
- One-per-day drafts never place the same team in two slots on a date.
- A drag that would newly exceed the cap warns before the admin drops it; a same-day swap does not warn solely for the cap.
- The optional Rules count changes only for optional rules; the weekly cap remains adjustable.
