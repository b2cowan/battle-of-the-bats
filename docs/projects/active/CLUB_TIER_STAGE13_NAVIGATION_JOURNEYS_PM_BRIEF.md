# PM brief — How people move through the club (Club Tier Stage 13, expanded)

**Plan:** `CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md` · **Opened** 2026-11-06 · **Priority:** inside the Club release, the
last stage before the go/no-go.

## What it is

A review of the club side from the chair of each person who runs a club: the owner, the club admin, the house league
convener (league admin), the registrar and the treasurer. Each of them walks five real tasks start to finish, on real screens:
their first day, and the jobs they will do most or find hardest. The owner named three of them: everyone's first login, the
winter dome from permit to the teams' bills, and house league scheduling from the permit to the public site. The navigation
bar is reviewed person by person on a computer and a phone: whether each person can find their work and tell what is theirs.

## Why it matters

The club side has grown stage by stage: programs, money, families, permits, schedules, payments. Each stage placed its own
doors. Nobody has yet walked a whole job across them as the person who has to do it. The risks are the ones a customer
meets on day one: a permit hidden in Venues when it is the first step of scheduling; a volunteer shown tools that aren't
theirs; a task that ends with no clear next step; a hand-off (club → league convener → coach → family) where the next person
never learns it is their turn.

## What the owner gets

One page to review: each person's journeys with what they saw, what got in their way and what I would change; the navigation
measured against the product's own rules; a short list of stages that fix what the walk found; and the end state drawn, so
the proposals are pictures, not paragraphs. The owner rules it, and the build follows the ladder.

## Customer impact

A club's volunteers find their work without training, see only what is theirs, and finish a job without hunting for the next
step. The club owner can hand a role to a new volunteer and trust what that person will see.

## Success criteria

- Every one of the 25 journeys can be finished by its person on day one, from where they would naturally start.
- Each person's nav shows their work first, and nothing they cannot use.
- Every hand-off reaches the next person, and they can tell it is theirs.
- The same thing has one name on every screen and device.
- A click in the sidebar always does what the row suggests, exactly one row says where you are, and the sidebar fits the
  screen inside a team or a season (stage 13i, added 2026-11-06 after the owner found the side navigation clunky).
- Every departure from the nav standard is either fixed or written down with its reason.

## Stage 13a · Doors by person (build prompt written 2026-11-06)

**What changes for people:** a page that isn't yours now says so the same way everywhere (what it is, who opens it by name, a button
back to your own home) instead of bouncing you silently or showing one of eight different refusals. The Organization page lists only
what you can open, and a person with one door goes straight to it. The league admin and the registrar see House league first, on day
one, before any season exists. The registrar sees who creates the season, and sees how many registrations are waiting on the House
league row. The header button on the club's screens reads "View site", and the live site's way back is labelled.
**Found on the way:** the Overview's "League registrations waiting for review" line has never been able to show (it counted a state that
doesn't exist). It is fixed first, because the registrar's waiting count depends on it.
**Priority:** High: it sets the rules every later stage follows. **Success:** each of the five people, on a fresh club, sees only
doors they can open, finds their own work first, and never meets a dead end. Built in two sessions, one walk.

## Stage 13i · The sidebar's shape (ruled 2026-11-06; built in three sessions, committed `f279e6963` and `403341b71` 2026-11-06 with the help words in Session C; owner walk §476 published 2026-11-06)

**What changes for people:** the sidebar lists places, and a place's pages are tabs across the top of its page, the way Accounting
already works. The sidebar never grows: the owner sees the same ten rows on every screen (today up to 21 inside a team, with
Organization falling off a laptop screen), the registrar four, the treasurer three. One row is lit, the place you are in. Rows have
no arrows that look like folds. Inside a team or a season there is one way back, named ("← Teams", "← Seasons"), and the season
switch sits on the season's title. Organization becomes tabs instead of a page of tiles. The sidebar's foot (Plan & billing, Help,
Collapse sidebar) stays exactly as it is. The headings become "Programs" and "Club". On a phone the same tabs scroll sideways, the
bottom bar is unchanged, and the More sheet shrinks from 19 entries to 14. Tournaments and both coach portals don't change.
**Tradeoff:** a program's pages are no longer visible in the sidebar before you go in; its first page shows them all at once. This
reverses half of a 2026-09-30 ruling (Rep teams' pages stayed in the sidebar) for that ruling's own reason: on a phone, tabs reach
every page in one tap.
**Priority:** High: the owner finds the side navigation clunky, and every later stage (13c's Permits, 13g's phone, 13h's names) builds
on this shape. **Success:** each of the five people can tell where they are and get back on every screen, desk and phone; no phone
bar changes; the nav standard describes what ships. Built in three sessions, one walk.

## An outside review, cross-checked (2026-11-07)

An outside reviewer's first look at the Club tier (23 findings) was checked against the product and our plans (plan §11).
Most of it confirms work already staged here; several items question rulings we made for stated reasons. **Two new problems
matter:** (1) coaches are told the club never sees their families' payments, but the club's Families page shows each rep
family's dues and balance, so the product breaks its own promise; (2) a treasurer, league admin or registrar who also coaches
has no way back from the Coaches Portal to the club. **Proposed:** a small "fix-now 2" session (the way back, the promise's
words once the owner rules, a setup step that ticks too early, one explanatory line). Three walk findings nobody owned now have
homes. **Ruled 2026-11-07:** keep Families as it is and make the coach's sentence true; the new words passed a legal review.
**Built 2026-11-07 (fix-now 2, awaiting the owner's walk):** the promise now tells coaches what the club sees; every role the
club admin admits (bar a coach-only member) has a door back from the portal, landing on their own home; setup step 4 ticks only
with a tagline and a contact email; and someone who coaches house league and rep is told where the rep team lives.
Fix-now 2 is written and ready to build. **Success:** every person who reaches the club admin can get back to it from the portal; no screen promises what
another screen contradicts.

**Fix-now 2 walked 2026-11-07 (§480, 23 of 23).**

**13b, each person's home and first day (build prompt written 2026-11-07, two sessions).** The owner opens the club and sees one
band of today's figures above the morning counts: cash on hand, what is owed to the club, what is booked this week, and who needs
someone. A new club admin is shown the owner's open setup steps (read only) instead of an empty page. The league admin and the
registrar get a morning list of their own. A person invited to the club is told what their role opens, in the email as well as on the
page, chooses a role instead of being given Staff, and lands on their own home from either route. **Why:** today the president's first
screen shows doors and counts but no figure, a new admin sees nothing to do, and every invite email reads the same. **Open for the
owner:** the drawing assumed every band figure already existed; two do not (a club-wide house league total, and counts of families
owing and forms missing), so four choices go to the owner before the build. **Success:** the owner can answer "how is the club today"
from the Overview without opening a second screen; a new admin knows what is theirs on the first day; no invite arrives with a role the
inviter did not choose.

**13b Session A, the homes (built 2026-11-07, awaiting the owner's walk §485).** The owner and a club admin now open the Overview on
"The club today": cash on hand, what is owed to the club (teams plus house league), what is booked in the next seven days, and who needs
someone (teams with no head coach, players who owe house league fees, rep-team forms missing). A tile a person cannot open is simply not
there, so an admin with Accounting off sees no money. A new club admin sees the owner's open setup steps as "Still to do", with a button on
the ones they can do and "Ask the owner" on the rest; it disappears when setup is done. The league admin and the registrar get a morning
list at the top of the live season's page. The install banner no longer greets a person on their first visit. **Why:** the president's
first screen showed doors and counts but no figures, and a new admin saw an empty page. **Success:** the owner answers "how is the club
today" without opening a second screen; a new admin knows what is theirs on day one; nobody sees a figure they cannot open.

**13b Session B, the arrival (built 2026-11-07, awaiting the owner's walk §489).** Inviting someone no longer picks a role for you: the
field starts on "Choose a role" and Send waits for one, so a treasurer can't go out as Staff by accident. Every invitation, and the "You've
been added" email for someone who already has an account, now says what the role opens and what FieldLogicHQ is, using the role's screen
name. Both ways in now land a person where their work starts (a treasurer in Accounting, a league role in House league), including the
"added" email's Sign in, which used to open the Overview for everyone. Help opens on the reader's own first steps. **Why:** a volunteer
treasurer couldn't tell from the email what this was, and the two arrival paths disagreed. **Success:** no one is invited with the wrong
role by default; an invitee knows what they are joining before they click; every role's first screen is their own.

**13c Session A, the permit (committed `27e958f1a` 2026-11-08).** Permits is its own row in the sidebar, between
Calendar and Schedules, for everyone who could read permits before (owner, admin, league admin, registrar, treasurer, and staff), and the
a row in the phone's More sheet; Venue library keeps the venues. A permit whose dates off still have bookings on them says so on its
row ("2 dates off · 8 bookings on them") and, when opened, lists them by day with a door to where each is fixed, each door only for
someone who can open it. Adding a date off now says what is already booked that day as you pick it. **Why:** pulling a date off a permit
used to leave its bookings standing with no word to anyone. **Success:** after a date comes off, the person who pulled it can see every
booking it left standing and reach the place to move it in two clicks; nobody sees a door they can't open; nothing is moved or blocked.

**13c Session B, telling people away from the permit (committed `13e5f6085` 2026-11-09).** The owner and admins
see "Outside the permit · 8" under This morning on the Overview, and the same 8 on Permits in the sidebar and the phone's More
sheet, only while something sits on a permit's date off; it opens that permit. The Calendar marks such a day "Outside the permit",
with "See the permit ›" and a warning beside each booking still standing. A house-league season's Schedule health names each game on
the day with "Give it a new date". An empty Calendar week now names the next event and jumps to it. A booking that has already ended
no longer counts, and a booking two permits both took counts once. **Why:** the people who must act on a pulled date (the owner,
the league admin) were not the ones who pulled it, and nothing told them. **Success:** after a date comes off, the owner sees it on
the Overview without opening Permits, the league admin sees their games in Schedule health, and the count costs a club with no
date off ahead one small read; nothing is moved, blocked or sent to anyone.

**13c Session C, the schedule page is the path (committed `40e86b8dd` 2026-11-09; the stage's walk §502 published).** A schedule's top line opens the permit it
came from ("From the permit Saturday diamonds, December 2026 ›"). While that permit's dates off still hold the schedule's slots,
Needs attention says so first. It names the practices and teams on those days and any house-league games there (for the league
admins, "See them ›"). Its **Take Dec 5 and Dec 12 off** opens today's Regenerate with the days added; nothing changes until the
admin keeps a draft. The band's Bill tile ("Open" for someone without the club's money) opens **Fair shares and the bill** in a
window, and Fair shares left the View menu. In New schedule, at one practice a day, each team's Slots read "25 of 65", and a short
draft says why, with a way back to the setting. A league admin is no longer pointed "in Schedules", which they cannot open. There is
no "was" bill figure: the product keeps no earlier bill to quote, and a sent bill never moves when a date comes off. The phone,
coaches and families are unchanged. **Why:** the permit, the schedule and its bill were three places that did not point at each
other, so a pulled date reached the schedule only if someone remembered it. **Success:** from a schedule, one click reaches its
permit, its pulled dates and their fix, and its bill; nothing is moved or sent until the admin chooses.
