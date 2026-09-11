# PM brief — Coaching staff: four roles, access set before the invite, and every door honest

**Plan:** `COACH_STAFF_ACCESS_PLAN.md` · **Review:** `COACH_STAFF_ACCESS_REVIEW.md` · **Mockup:**
`https://claude.ai/code/artifact/c8982bc5-6d0c-4063-bc82-400850600b1d` · **Approved:** owner,
2026-09-10 · **Priority:** high — pass 1 closes two real data exposures.

## What a head coach sees and does differently

- **The Staff page is a list of people** — you, every assistant, helpers, managers, treasurers, and
  anyone you have invited who has not accepted yet. One row each, with a role chip and a one-line
  summary of what they can open; the sensitive grants (money, family contacts, emailing families,
  notes, tryouts) are marked so "who can see the money?" is one glance. The whole staff fits on a
  laptop screen and on a phone.
- **Inviting is one sheet:** their email, who they are (a dropdown of four roles, each with a
  sentence), and what they will be able to open — prefilled from the role, adjustable before you
  send. Anything sensitive is confirmed once, at send. They land on their first sign-in with the
  right doors already open; you do not have to remember to come back.
- **Pending invites are visible**, with the days left on the link, Resend and Cancel — and their
  starting access is still editable until they accept. Today an invite disappears the moment it is
  sent, and on a standalone team nobody can see it at all.
- **Four roles instead of two:** Assistant coach · Team manager (money, forms, family email — not
  the lineup) · Team treasurer (the books and nothing else) · Helper (one station at practice).
  The role is a label you chose; adjusting a switch afterwards never renames the person. Today a
  helper you give attendance to is silently relabelled "Assistant".
- **Moving people between roles is one pick** in the role dropdown on their sheet, in either
  direction. **"Make head coach"** exists in the portal for the first time — a standalone team can
  finally hand itself over; a team can have two head coaches; the last one cannot be removed.
- **Schedule is one control** (Hidden / View / View + edit) like Money and Documents; the
  impossible state (can change the schedule but not see it) goes away.
- **Assistants with "Schedule: View + edit" can write practice plans.** Today only the head coach
  can, even for the assistant who runs Tuesday practice. This widens every existing assistant on
  deploy — deliberate, flagged.

## What a helper, assistant or treasurer sees differently

- A helper opening a game from the schedule sees the game and, when there is an opponent, the
  Scouting tab — no Attendance or Lineup tab, no "Build lineup", no score form, no award button.
  Today all of those show and every one of them dead-ends.
- Any page a person's access does not cover says so in the portal's standard way ("Lineups aren't
  turned on for you · Ask your head coach") instead of an empty-looking screen that claims the team
  has no roster, no documents, or no lineup, or a Retry button that can only fail again.
- **Two things a helper can read today and should not — every email sent to families this season
  (with a compose form), and the team's tournament records — are closed.**

## Role-based differences

| | Head coach | Assistant coach | Team manager | Team treasurer | Helper |
|---|---|---|---|---|---|
| Starts with | everything | schedule (edit), attendance, lineups, staff chat, documents (view) | schedule (edit), staff chat, documents (manage), money (edit), contacts, email families | schedule (view), money (edit) | schedule (view), practice plans |
| Can be adjusted | — | any switch | any switch | any switch | any switch, and stays "Helper" |
| Sees Insights | yes | yes | no (no player duty) | no | no |
| In staff chat | yes | yes | yes | no (unless added) | never by default |

## Why it matters

Staff access is the one screen where a mistake exposes children's details to the wrong adult, and
today the screen is both too tall to review and, in two places, not actually enforced. Pass 1 is a
safety fix; pass 2 makes the model match how rep teams are really staffed (a manager and a
treasurer are more common than a second coach) and takes the "remember to come back and grant
things" step out of the head coach's life.

## Trade-offs made

- **A label is stored** (helper / manager / treasurer / assistant). It never decides access; it only
  decides defaults, the word on the row and the email. This departs from the "preset, not a role"
  decision on the ground that decision was made to protect — one place answers "what can this
  person see?" — and that place is unchanged.
- **Treasurer starts without family contacts and without the staff chat.** Dues reminders go out
  without exposing addresses; both are one tap to add.
- **Practice-plan writing widens** for existing assistants. The alternative (grant it only to new
  assistants) creates two kinds of "Schedule: View + edit" nobody can tell apart.
- **No "compare" matrix** — the chips carry its one benefit; the matrix does not survive a phone.

## How to test (owner QA §168 pass 1, §169 pass 2)

Pass 1: sign in as a helper — open a game from the schedule (only Scouting, if an opponent), paste
the roster, documents, money, tournaments, email-families and Insights URLs (each refuses in the
standard way). Sign in as a default assistant — nothing you could do yesterday is gone.
Pass 2: from Staff, invite one of each role from the sheet; read the four emails; accept each with
a second account and check the first screen; resend and cancel a pending invite; change a helper to
an assistant and back; make an assistant head coach, then try to remove the only remaining head
coach (refused); repeat the sheet on a phone.

## Success criteria

- A schedule-only helper cannot reach any family email, tournament record or season report by any
  path — pinned by unit tests, not by memory.
- A head coach can invite a treasurer and a manager whose first sign-in needs no follow-up grant.
- The staff list, at six people, is readable without scrolling on a 1366×768 laptop and on a
  390px phone.
- No existing assistant loses anything; every existing helper still reads "Helper".
