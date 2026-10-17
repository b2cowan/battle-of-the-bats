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
**Built 2026-10-15 and committed `9fe3c4f6` the same day**, after /design, /simplify and /review; the owner's walk is §314, on the hub's QA walk 1b
tab. As built (plan §13): a team manager's registration is listed under the head coach and the organizer's emails go
to the head coach; the person who registered gets the confirmation, addressed to them; every coach email says
"Hi Coach" when no name is on file.

**Success criteria.**

- A Premium team registered by its team manager is listed with its head coach's name, everywhere the organizer and the
  public see it.
- No one who picks a Premium team with a named head coach sees a name box.
- No signed-in coach is asked for their name.
- When a team manager registers, the organizer's emails reach the head coach, addressed to the head coach.

## One team, one entry (ruled and built 2026-10-16)

**What changes.** A team already in a tournament can't be registered into it again, by anyone on its staff, in any
division. On the form, that team's card is greyed and says where it already is, for example "Already registered as
“No Metrics - Walk” · U12 · Pending Review", with a link to the registration. If someone else registers the team while
the form is open, Submit says so and nothing is sent. A registration the organizer rejected still counts (owner,
2026-10-16): the card says "Not Accepted", and only the organizer lets the team back in, by accepting it or deleting
it so a new registration can be made. A team typed in by hand keeps today's rule: no two teams with the same name in
one division.

**Why it matters.** On 2026-10-16 a head coach and an assistant entered the same team five minutes apart, under two
names, and the organizer got two entries for one team. The only check compared names, and two things Stage 1 shipped
made that easy: a team may use another name in a tournament, and its staff may register it. On a real team, the head
coach and the team manager both registering the same weekend is a likely way for this to happen. An organizer who
accepts both schedules one team twice.

**Customer impact.** Organizers stop receiving duplicate entries for a portal team. Coaches see that their team is
already in and can open the registration, instead of making a second one.

**Success criteria.**

- No tournament has two entries for the same coach-portal team, rejected ones included.
- A staff member who opens the form after a colleague registered sees the team as already registered, without submitting.
- A form opened before the colleague submitted is refused at Submit, with the reason, and nothing reaches the organizer.

The owner's walk is §317, on the hub's "QA walk · one entry" tab. Plan §14.

## Stage 2 — misfiled entries, counted (2026-10-16)

**What we found.** No tournament entry on production is filed under the wrong team. All 30 real entries and the 10
coach links behind them were read, in five shapes (a stray team beside a Premium portal, one team entered twice, an
entry filed by someone not on the team, an unclaimed entry whose coach has an account, and a coach with a second
account). Three cases came up and each one, read by hand, is filed correctly. The one known case was fixed on
2026-10-13 and now reads correctly.

**What we recommend.** Build no repair screen and write no fixes, because there is nothing to fix. Count again on
2026-11-16: no coach has registered through the new form since it reached production this afternoon, so the data
cannot yet show the cause is closed, only the code can. Separately, bring the claim page coaches reach from their
emails in line with the registration form. It still offers "New Team" beside "Existing Team" with no warning, which is
how the original case happened. Once the free Tournament plan's invite-only events ship, that page is how most coaches
attach their entries.

**Customer impact.** None today. The claim-page fix closes the last coach-tappable way to split a Premium team from its
own tournament.

**Priority.** Low for the count, medium for the claim page (small, and it rides on the next registration build).

**Success criteria.**

- The 2026-11-16 re-count finds no entry filed in the wrong place after 2026-10-16.
- A Premium coach claiming an organizer-added entry sees their team first, and "New Team" says it makes a separate team
  their portal won't show.

Owner calls E1–E3 are on the hub's Stage 2 tab. Plan §15.
