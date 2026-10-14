# Register Your Existing Team — plan

**Hub:** {{HUB_URL}} (Walk · Stage 1 drawing · PM Brief · this plan · Decisions — one URL).
**Opened:** 2026-10-13, from a production report: a Premium coach said they "had to make a new team" when
registering for a tournament.

## 1. What happened (production, read-only lookup, 2026-10-13)

The coach owns one live Premium Coaches Portal, called **Milton Bats U13 Purple**. Under every Premium team
sits a free team that the registration form reads (its "twin"). His twin is the free team he made in June
when he registered for last season's Battle of the Bats, and it still carries that team's name, **Milton Bats
U13 White**. When the portal was set up on 08-25 it was given the Purple name; the twin kept White.

| Time (Oct 13) | What the coach did | What the product did |
|---|---|---|
| 9:45 p.m. | Opened the 2027 registration link from WhatsApp, filled in the form, tapped Submit | The chat app's browser was signed out. The form tried to make an account, found one, signed him in, and sent him back to the form with a team picker |
| — | Saw one team offered: **Milton Bats U13 White · Coaches Portal** | That is his Purple portal, labelled with the twin's old name |
| 9:46 p.m. | Chose **New Team** | Made a second free team, "Milton Bats Purple - Jackson", and linked the entry to it |

The organizer has already accepted the entry. The stray team is empty: no roster, schedule, fees or messages,
just the one entry. The Purple portal does not show the 2027 tournament anywhere. The portal also has five
other staff, and none of them could ever have seen the team in that picker.

Whether White and Purple are the same team is the coach's to say. The picker should use the name his portal
shows either way.

## 2. Findings

**F1 — The form opens as a new-team form for a signed-out coach.** Its first box is a blank Team Name and its
last is "Create a Password — this sets up your free Coaches Portal". The only hint for a returning coach is one
grey line under the password box. Links shared in WhatsApp, Facebook, Instagram and mail apps open in the
app's own browser, which does not share the phone's sign-in, so most coaches arrive signed out.

**F2 — The account is recognized last.** The email is checked only when the coach taps Submit on the Review
step. A match signs them in and sends them back to the form to pick a team, then Review and Submit again. A
wrong password ends on an error card.

**F3 — The picker names a Premium team by the free team underneath it.** The picker lists the account's free
teams and labels a Premium team's twin with the twin's own name. The twin is named once, when it is made, and
never follows the portal. This is what happened to this coach.

**F4 — "New Team" gives no warning.** Choosing it makes a separate free team that the Premium portal never sees.
Nothing on the form says so.

**F5 — Only the portal's owner sees the team.** The twin has one member, the portal's primary owner. A head
coach who took over the team, a team manager or an assistant gets an empty picker and can only make a new team.

**F6 — Sign in loses the form.** The public bottom bar's Sign in sends the coach to sign in and then to their own
portal, not back to the registration they were on.

**F7 — A misfiled entry cannot be moved.** Once an entry is linked to a team it stays linked. The coach has no
way to move it, and the organizer side links only to its own club's teams.

## 3. Rulings so far

- **D1 (owner, 2026-10-13):** who may register a Premium team is a permission, and it defaults to the head
  coach and the team manager.
- **A1–A6 (owner, 2026-10-13, "I agree with your recommendations"):** A1 email first · A2 the name in this
  tournament is editable, filled in with the portal's name · A3 existing team managers get the switch · A4 ship
  the picker-name and Sign In fixes now · A5 move this coach's entry to his Premium team and remove the empty
  stray team · A6 "Register for tournaments", in Sensitive, under Run tournaments.

**Where it is built** (the owner asked; my recommendation, not a ruling): the A4 fixes and the A5 data fix in the
drawing session, Stage 1 in a new session from `COACH_REGISTER_EXISTING_TEAM_BUILD_PROMPT.md`.

**A5 applied to production 2026-10-13.** The entry's coach-side link now points at the Premium team's twin; the empty
stray team and its one membership are deleted; the organizer's entry is unchanged (same name, still accepted). Every
precondition was re-checked before the write, and the removed rows are kept (`.probe/brett-a5-backup.json`). Checked
in the data, not on the coach's screen: his Purple portal's Tournaments page should now list the 2027 tournament.

**A4 committed `eb150914` 2026-10-13, after /review (four lenses).** The review added two things: the event strip's
Sign In on a computer (a third link the first pass missed) and the club's own header now return too, and only the free
team the portal itself points at takes the portal's name (a second free team with the same link would otherwise show as
a second identical row; it stays an ordinary team, which is honest, since the portal never sees entries filed under it).

**A4's Sign In fix is narrower than the drawing said.** It returns the coach to the page only when they sign in from
a registration page. Every public page doing it would end the deliberate "one workspace → straight into it" landing
for anyone who signs in from a public page, and that landing is measured (sign-in platform events). Sign-in honours
the return only for an account that has a team or workspace, which every returning coach does.

## 4. The ladder

| Stage | Covers | Asks | State |
|---|---|---|---|
| Now | F3 (picker uses the portal's name, Premium team first), F6 (Sign in returns to the page), and this coach's entry moved to his Premium team | A4, A5 | A5 applied to prod 2026-10-13; A4 committed `eb150914` 2026-10-13 |
| 1 | The registration form, email first: F1, F2, F4; the form honours D1 (F5); the new switch on the Staff sheet | A1, A2, A3, A6 | Drawn and ratified 2026-10-13; build prompt `COACH_REGISTER_EXISTING_TEAM_BUILD_PROMPT.md` |
| 2 | Misfiled entries (F7): count how many exist, then a repair door or one-off fixes | after a count | — |
| Later | A one-time emailed code as a second way to sign in; teams that live in a club's account | not asked yet | — |

## 5. Stage 1 — what the coach sees

**Step 1, your email.** The form opens with one question. If the email already has an account, the next screen
asks for the password right there (with Forgot password). If not, the coach goes on to today's form, with the
email already filled in.

**Step 2, which team.** A signed-in coach sees the teams they can register, as cards. A Premium team is listed
first, under the name the portal shows, with a Coaches Portal tag, and it is already chosen when it is the only
one. "A different team" is last and says plainly that it makes a separate team the portal won't show. Below
the cards: the name the team goes by in this tournament, the division and the organizer's own questions.

**Staff and D1.** Staff who hold the permission see the team like the head coach does. Staff without it see the
team greyed with who can register it, so they never mistake the empty space for "I have to make a new team".

**Step 3, review.** Says which team the entry joins and that the tournament will show in that portal.

**A coach who is already signed in** (the same browser, or arriving from their portal) starts at Step 2.

**Staff sheet.** A new switch, **Register for tournaments**, sits under Run tournaments in the Sensitive group.
The head coach always holds it. The Team manager role starts with it on; Assistant coach, Team treasurer and
Helper start with it off. It applies to Premium teams only (a club's teams are out of scope).

## 6. Asks

**A1 — Email first, or a sign-in door above today's form?** Recommend **email first**. A door only helps a coach
who reads it; this coach typed a new team name into the first box. Email first finds the account before any
team name is typed. It reveals nothing new: today's form already tells anyone at Submit that an email has an
account. Cost: a brand-new coach answers one extra screen.

**A2 — May the coach edit the name the team goes by in this tournament?** Recommend **yes, filled in with the
portal's name**. This coach typed "Milton Bats Purple - Jackson", which may be how the organizer asks teams to
be named. Today, picking a saved team replaces whatever was typed with the saved name. The portal keeps its own
name either way.

**A3 — Do existing team managers get the switch?** Recommend **yes**. The 09-13 ruling that managers are not
backfilled was about Manage staff, the master key, which is never widened by default. Registering for a
tournament is not a master key, and without a backfill your "default to team manager" is false on every team
that exists today, this coach's included.

**A4 — Ship the two small fixes now, ahead of the redraw?** Recommend **yes**. The picker naming the portal's
team correctly would have saved this coach on its own, and Sign in returning to the page is a one-line change.
Neither needs a drawing.

**A5 — Move this coach's entry to his Premium team now?** Recommend **yes**. It is one entry and an empty stray
team. The organizer's entry does not change (same team name, same status); only the coach side moves. Then
remove the empty stray team. A data fix on production, done only with your OK.

## 7. Design review of the Stage 1 drawings (/design, 2026-10-13)

Checked against the written rules and the decisions log. The in-repo design system, principles and Milton palette
files named by the design agent do not exist; the review used the decisions log and the product's own styles.

**Applied to the drawings before hand-off (proposals until ruled):**

- **Input text is 16px on a phone.** The drawing had 15px; the consumer rule (2026-07-13) is 16px so iOS does not
  zoom on focus.
- **"Change" and "Not you?" sit in a row at least 44px tall**, the consumer tap floor.
- **The greyed staff card names the people who can register**, "Brett Jackson (head coach) or Alex Morgan (team
  manager)", instead of "your team manager" (a team may not have one) and the switch's name (staff-sheet wording on a
  public page).
- **Drawing notes inside the staff sheet read as notes**, not product copy, and the new row's green band is labelled
  as the drawing's highlight.

**Checked and kept:**

- **Team cards, not a dropdown.** The 2026-08-22 ruling that a pick-one field is a dropdown exempts rows that carry a
  sentence under each option. These do, and the sentence under "A different team" is the fix for F4, so it must be
  visible without opening anything.
- **The greyed card for staff without the switch.** The 2026-10-01 ruling keeps locked rows off everyday menus but
  keeps them on a page someone surveys, where "is this missing, or just not mine?" needs an answer. A registration
  form is that kind of page.
- **The organizer's purple on the buttons and the chosen card**, as today's form uses the event's theme colour.
- **Title Case buttons** ("Continue", "Sign In", "Review Registration") match the public form as built.

## 8. Build notes (for the build session)

- The picker list today is "free teams the account belongs to". Stage 1 needs "teams this person may register":
  their free teams, plus every live Premium team where they are the head coach or hold the new switch, labelled
  with the portal team's current name.
- The registration server check must agree with the form: a person may attach an entry to a Premium team only
  when they hold D1's permission for it. Today it checks free-team membership only.
- The account check on Step 1 is a new request; rate-limit it like sign-in.
- After submitting for a Premium team, land in that portal's record for the tournament. Check where today's
  post-submit redirect sends a Premium coach before assuming.
- The Team manager role's invite email lists what the role grants. Add the new switch to that list.
- Help: the coach registration article and the staff-access article both change (offer /docs).
- Demo: the coach demo's staff list carries a Team manager; check the tour's staff sentence once Stage 1 lands.
- Prod data fix (A5): repoint the entry's coach-side link from the stray free team to the Premium team's twin,
  then delete the stray team and its membership. Record it in the release history.
