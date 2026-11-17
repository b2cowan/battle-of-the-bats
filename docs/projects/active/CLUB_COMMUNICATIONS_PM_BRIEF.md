# PM brief — Club Communications

**Proposed functionality.** The club gets one place for the email it sends to groups of people. It is called
**Communications** and sits in the Club group of the sidebar, after Families. It holds:
- **one list of what the club sent**: emails to families, emails to coaches, and (in later stages) the automatic emails
  and tournament announcements, newest first, each opening the record of who it reached;
- **one New email button**: in the first stage it offers "to families", "to coaches" or "to the board" (the board added
  at the owner's request, 2026-11-16: the people on Organization's board tab); in the second it is one window where any
  mix of groups can be ticked and each person gets one copy;
- **the same buttons the club already uses elsewhere**: a season's Email families, "Email these families" on a filtered
  list, the ticked rows on Registrations. They stay where they are, open the same window, and land in the same list.

Automatic emails and one-off messages keep firing from the action that causes them. The list shows them so the picture
is complete.

**Why it matters.** After the coach email ships as first drawn, a club would have three places to write a group email
(Families, a house-league season, Organization), three sent lists, and three different sets of people who may open
each. Nobody, the owner included, could see everything the club sent. A president who is an admin could not email
every family without also being given the Families book, which opens every child's medical note. A message meant for
two kinds of people had to be written twice. The owner raised this on reading the coach email drawing, and had raised
the same question on 2026-10-22 about where the Club notice belongs.

**Expected customer impact.**
- "Where do I go to email people?" has one answer.
- A president sees every email the club sent. A league registrar sees every email that reached house-league people,
  whoever sent it, so a season's families don't hear the same thing twice.
- Sending no longer depends on holding the Families book. The book keeps guarding household records.
- Later groups (board, volunteers, people who owe a document) arrive as more rows in the same window. No new screens.

**Who it is for.** Club owners and admins (everything), league admins and league registrars (house-league families and
coaches). Treasurers, staff, volunteers and coaches get no Communications place. The plans that carry each kind of
email do not change: see `docs/agents/strategy/PLAN_PRICING_FACTS.md` and Business Decisions 2026-11-10 for the coach
email's gate.

**Priority.** High, and first in order: the coach email (Board Ready Stage 2) is built inside this home. Building it as
an Organization tab first would mean moving the tab, its help page and its list a second time.

**Success criteria.**
- An owner opens one list and finds every group email the club sent, with who sent it and who it reached.
- An admin without the Families book can email every family, and sees counts and names only, never a household record.
- A registrar can see a club-wide email that included their season before writing their own.
- The coach email works exactly as its drawing describes, with its door and history in Communications.
- No seat sees an email address, or a named person, it could not see before.

**Rulings.** All 12 asks on the evaluation (https://claude.ai/artifact/6wvN7LEUw3mfUEdSXYSryY) ruled as recommended,
owner 2026-11-16. Plan: `CLUB_COMMUNICATIONS_PLAN.md`.

**Where it stands (2026-11-17).** Session 2, the place, is built on dev and reviewed (commit and the owner's walk
owed): Communications in the sidebar and the phone's More sheet; one list of family, coach and board emails, each
person seeing only their share; the owner and admins email families without the Families book; Families down to two
tabs, its old Emails address forwarding; the Communications switch on by default for league admins, registrars and
treasurers, and off meaning no group email from any screen. The owner ruled two things that session: the club-wide
family window is the owner's and admins' only (someone else holding the Families book loses it), and a league admin or
registrar keeps the place between seasons with no New email button. Session 3 adds the coach and board windows.

Session 1, the engine, is committed (no screens). It covers who
can email whom, who can read what was sent, the email itself, and the clean-up of old emails. The owner ruled four
things that session:
- **How long sent emails are kept.** The words go 12 months after sending and the names 24 months after, removed
  automatically every night; the date, sender, group and counts stay.
- **A sender with no name on their account is asked to add one** before sending.
- **Replies go to the club's own inbox by default**, and the email names the club rather than the person; the sender
  can choose "Replies come to me" instead. This covers all three windows.
- **No typed CC or BCC.** A "Send a copy to the club's inbox" tick takes their place.

Nothing reaches production until the clock, the nightly job and the privacy-policy
sentences go together.
