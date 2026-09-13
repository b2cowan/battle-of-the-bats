# PM Brief — Run tournaments, delegated

**Plan:** `COACH_TOURNAMENT_DELEGATION_PLAN.md` · **Hub:** `COACH_TOURNAMENT_DELEGATION_HUB.html`
**Owner direction:** 2026-09-13 (two rulings: delegate with one switch; centralize hosting on the existing Tournaments page) · **Priority:** ships after "Manage staff, delegated" (same staff sheet)

## What changes for the coach

**Today.** Every Premium Coaches Portal can run one tournament — a round robin, an exhibition
weekend. Only the head coach can actually do it. Every staff member sees the same "Your team can
run local tournaments here too — Open setup" invitation on the team Overview, follows it into a
tournament page that looks fully theirs, fills in the form, and is refused with a bare "Forbidden"
at the last step. And the head coach has no way, anywhere in the portal, to let a manager run the
weekend for them.

**After.**

1. **One Tournaments page, both halves.** The page that already lists this season's entries gains
   a second section underneath, *Tournaments you run*. With nothing yet it offers *Set up a
   tournament*; once one exists it shows the tournament's name, dates, status and teams
   registered, with a *Manage* door. The section appears only for people who hold the right —
   everyone else sees the entries and nothing more. The "run local tournaments here too" banner
   on the Overview goes away, and the "Admin" link at the foot of the menu is untouched. Nobody is
   walked to a refusal, and there is one place to look.
2. **The staff sheet gains one switch: *Run tournaments*.** It sits in the Sensitive group with
   Team money and Contacts, because a tournament's registrations hold other teams' coaches'
   details and payments. Turning it on asks once and says what it hands over; turning it off is
   instant. Whoever holds it can do **everything** on the tournament page — set it up,
   registrations, schedule, scores, announcements, what visiting teams see. There are no
   finer-grained tournament permissions in the coach portal, on purpose.
3. **Defaults follow the role.** A new *Team manager* starts with it on (their invite email says
   so); an assistant coach, treasurer or helper starts with it off. Managers already on a team are
   not changed — it is one tap on their sheet.
4. **Running it happens where it always has.** *Manage* opens the tournament's own Dashboard —
   Teams, Schedule, Results, Check-in and the rest, in the admin look, the same screen a standalone
   tournament account works in. *Set up* opens the create wizard directly and finishes on that
   Dashboard. Neither path stops at a list page. A delegate lands on the tournament and nothing
   else: no Members, no settings, no billing.
5. **Premium workspaces only.** In a club, the tournaments belong to the club; club coaches don't
   get the switch, and the section shows only for club admins who also coach (listing the club's
   tournaments).

## Why it matters

The head coach who bought Premium is a volunteer with a job. "Run the exhibition weekend" is the
most delegable thing on the team, and today it is the one thing the portal will not let them hand
off — while simultaneously advertising it to the very people who can't do it. Fixing both halves
turns a dead end into the reason a manager logs in.

## Customer impact

- **Head coach:** one switch, one confirm, done. Nothing else on their screen moves.
- **Team manager:** invited from today, they can run the weekend the day they accept.
- **Assistant / helper / treasurer:** a misleading banner disappears; nothing they had is taken.
- **Everyone:** one Tournaments page for both halves of the season — the ones you enter and the
  one you run — instead of a banner, a menu link and a page.
- **Club coaches / club admins:** no change.
- **Do nothing:** every assistant keeps hitting "Forbidden", and the head coach keeps running the
  tournament themselves or handing over their login.

## Trade-offs made

- **All-or-nothing on purpose.** No per-area tournament permissions in the coach portal (the
  owner's call). A head coach who needs finer control than "run it" is running a tournament
  business, not a team, and that product exists.
- **The switch is per person, not per team**, because the tournament belongs to the workspace.
  Someone on two of your teams gets one answer.
- **Existing managers are not switched on retroactively** — widening access silently on ship is
  the one thing this portal's access model has never done.

## Success criteria

- Nobody reaches a "Forbidden" from the coach portal; a person without the right sees no
  hosting section at all.
- A head coach can grant *Run tournaments* to a manager from the staff sheet and that manager
  creates and runs the workspace's tournament without any admin-side help.
- A newly invited Team manager has the section without a second step; a newly invited assistant
  does not.
- Taking the switch back, or removing the person from their last team, removes the section and
  the right together.
