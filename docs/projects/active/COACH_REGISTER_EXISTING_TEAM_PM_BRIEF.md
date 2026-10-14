# Register Your Existing Team — PM brief

## What changes for the coach

A coach who already has a team on FieldLogicHQ registers that team for a tournament instead of making a new
one. The registration form starts by asking for their email. If they have an account, they sign in right there
and their team is offered first, under the name their Coaches Portal shows, already chosen. Making a separate
team is still possible, and the form says plainly what that means. After they submit, the tournament shows up in
their Coaches Portal.

On a Premium team, the head coach and the team manager can register the team. The head coach can give that to
anyone else on staff from the Staff page, one switch per person. Staff without it see the team on the form with
who to ask, rather than an empty list.

## Why it matters

On 2026-10-13 a Premium coach registered for a tournament through a WhatsApp link and ended up with a second,
separate team. The form offered his Premium team under an old name he didn't recognize, so he made a new one.
His Premium portal now can't see that tournament: not on its schedule, not on its Tournaments page, and roster
submission reads the wrong team.

The way in is the problem. Organizers share registration links in group chats, and chat apps open links in
their own browser, signed out. Today's form treats every signed-out visitor as new, and only finds out who they
are when they press Submit.

## Customer impact

- Every Premium coach who registers from a shared link. They are our paying coaches, and the tournament is the
  first thing their portal should light up with.
- Every assistant coach and team manager on a Premium team. Today none of them can register their own team.
- Organizers get entries linked to the coach's real team, so roster submission and the coach's schedule work.
- Doing nothing means more stray teams, more Premium portals that don't show their own tournaments, and support
  fixes by hand.

## Priority

High, and partly now. Two small fixes (the right team name on the form, and Sign in returning to the page) can
ship ahead of the redraw, and the affected coach's entry can be moved today. The redraw follows once the
drawing is ruled.

## Success criteria

- A Premium coach who opens a registration link signed out registers their existing team without being sent
  back to the form.
- No new free team is created for a coach who has a Premium team, unless they choose "A different team".
- A team manager on a Premium team can register the team with no change from the head coach.
- Every new entry by a Premium coach appears in their portal's Tournaments page the moment they submit.
