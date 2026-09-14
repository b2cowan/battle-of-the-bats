# PM Brief — Your team, in your own tournament

> Plan: `COACH_HOST_OWN_TEAM_ENTRY_PLAN.md` · Hub (mockup · brief · plan · decisions):
> `COACH_HOST_OWN_TEAM_ENTRY_HUB.html` → https://claude.ai/code/artifact/b776ee02-eb4f-4336-b46e-1281769130f4 ·
> Raised by the owner 2026-09-13 from a hosted tournament's Teams page inside his own coaches
> portal; the proposal was accepted the same day, the five open decisions ruled as recommended, and it was
> **built on dev the same day** (one data-only migration, prod-owed). Reviewed, documented and **committed `6cb8d01d` 2026-09-13**; awaiting the owner QA walk.

**What it does:** A coach who runs a tournament from their own coaches portal gets an **Add my
team** button on the Teams page. One click, pick the division, and their own team is in the
tournament — already connected to their portal, so it shows up on their Tournaments page right away
(under *This season* as an entry, and under *Tournaments you run* as the host — both are true). No
typing their own name, no emailing themselves, no accepting their own invitation.

The ordinary **Add Team** form, on every organization's tournaments, learns one thing: when the
email you type belongs to a coach who already uses FieldLogicHQ, the form says so and turns on the
notification for you — because that notification *is* how the coach accepts the entry and gets it
in their portal. If the email is new to the platform, the form says what happens instead (the email
becomes their sign-in and the entry lands in a free Coaches Portal). Nothing else about the form
changes.

Underneath, one repair: a coaches portal that was started from scratch — never upgraded from a free
team, never claimed a tournament entry — has no way today to recognize an entry its coach makes on
someone else's public registration page. The entry is created, the coach's portal never sees it.
That gets fixed for every such portal, existing ones included.

**What it deliberately does not do:** there is **no search of other clubs' teams** from the
organizer's side. Every connection between a tournament entry and a real team on this platform is
made by that team's own coach — registering, or accepting. An organizer picking a team from a
directory would attach a roster, a schedule and a chat to a team that never agreed to it, and would
open a window onto every club's teams that the product has nowhere else. The worry behind the ask —
"my Add Team entry is an orphan even though the coach is right here on the platform" — is answered
by the two parts above, from the two people who actually own the fact.

**Why it matters:** The portal has been able to host tournaments since the delegation work landed
(2026-09-13). The hosting coach is the one person on the platform who is obviously the team they
want in the list, and they are the only one with no door: the club-side "link to rep team" control
is deliberately not shown to a coaches portal, and both coach-side doors assume the coach is a guest
of someone else's tournament. Today the honest workaround is to register on your own public page
like a stranger, or add yourself and then accept your own email.

**Who benefits:** Every Premium coach who hosts (the *Add my team* door, and the from-scratch
repair); every organizer on every plan who adds teams by hand (the email-aware form); every coach
who gets added by hand and is already on the platform (their entry stops being an orphan the moment
they accept).

**Two things found on the way, put to you separately:** the coach-side Tournaments list can show
an entry the record page then refuses to open — once for entries a club links to its rep team, and
once for every assistant or team manager on a Premium team (only the coach who personally
registered can open a record today). Same root cause, one fix; the plan carries it as **Part D**
for your ruling, with one data question (whose roster a Premium team submits) flagged for deferral
rather than solved in passing.

**Decisions open (recommendations in the plan):** the host's own team defaults to *Paid* (it owes
its own event nothing); a staff member you've handed *Run tournaments* to can click *Add my team*
(the entry is recorded under the head coach regardless); the email check is a real yes/no lookup
rather than a conditional sentence; existing from-scratch portals are repaired on production; Part D
is in.

**Priority:** the *Add my team* door is small and unblocks the owner's own portal today; the form
change is copy plus one check; the from-scratch repair is a prerequisite for the door and a standing
defect on its own. Part D is a day if the roster question is deferred.

**Success criteria:** a hosting coach gets their team into their own tournament in one click and
sees it on their Tournaments page without leaving the portal; an organizer adding a coach who is
already on FieldLogicHQ is told so before they save; a from-scratch standalone portal sees the
entries its coach makes elsewhere; no organizer can attach an entry to another club's team.

**How to try it (once built):** sign in to a coaches portal that hosts a tournament → Tournaments →
*Tournaments you run* → Manage → Teams → **Add my team**. Then open the portal's Tournaments page and
find the entry under *This season*.
