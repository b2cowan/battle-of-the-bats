# Register Your Existing Team — PM brief

## What changes for the coach

A coach who already has a team on FieldLogicHQ registers that team for a tournament instead of making a new
one. The registration form starts by asking for their email. If they have an account, they sign in right there
and their team is offered first, under the name their Coaches Portal shows, already chosen. Making a separate
team is still possible, and the form says plainly what that means. After they submit, the tournament shows up in
their Coaches Portal.

On a Premium team, the head coach and the team manager can register the team. The head coach can give that to
anyone else on staff from the Staff page, one switch per person, and whoever holds it also sees and looks after
those entries on the team's Tournaments page. Staff without it see the team on the form with who to ask, rather
than an empty list.

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

## Stage 1b — the head coach comes from the portal (ruled 2026-10-15)

**What changes.** A coach who picks their Premium team types no names. The team's head coach comes from the portal's
staff list, and the review step shows it ("From your Coaches Portal") along with who the organizer's emails will go to:
the head coach. When a team has two head coaches, the person registering picks one. A signed-in coach never sees name
boxes: no real account lacks a name (a production count, 2026-10-15), and every sign-up asks for one.

**Why it matters.** Today whoever presses Submit becomes the team's listed coach: on the organizer's list, in their
emails, and on the tournament's public Teams page. Since Stage 1, a team manager can register, so a manager gets listed
as the coach. The owner found the unexplained name boxes on the 2026-10-15 walk and asked why a Premium team doesn't
send its own details.

**Customer impact.** Premium teams register with fewer fields and the organizer sees the right head coach every time.
Free teams and brand-new coaches are unchanged, except that a signed-in coach never sees name boxes.

**Priority.** Medium-high: small, and it follows straight on from Stage 1. All three owner calls ruled 2026-10-15.
**Built 2026-10-15** on dev, after /design, /simplify and /review; the owner's walk is §314, on the hub's QA walk 1b
tab. As built (plan §13): a team manager's registration is listed under the head coach and the organizer's emails go
to the head coach; the person who registered gets the confirmation, addressed to them; every coach email says
"Hi Coach" when no name is on file.

**Success criteria.**

- A Premium team registered by its team manager is listed with its head coach's name, everywhere the organizer and the
  public see it.
- No one who picks a Premium team with a named head coach sees a name box.
- No signed-in coach is asked for their name.
- When a team manager registers, the organizer's emails reach the head coach, addressed to the head coach.
