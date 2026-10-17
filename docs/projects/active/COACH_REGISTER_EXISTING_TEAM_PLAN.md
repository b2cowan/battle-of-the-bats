# Register Your Existing Team — plan

**Hub:** {{HUB_URL}} (Walk · QA walks · Stage 1 drawing · Stage 1b drawing · Stage 2 count · PM Brief · this plan ·
Decisions — one URL).
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
- **B1 (owner, 2026-10-15, "I agree, go ahead with A"):** Register for tournaments also opens the team's
  Tournaments page — its list of entries and each entry's record, with the roster sent to the organizer and the
  entry's contact. Whoever may enter the team is the organizer's contact for that entry, and a switch that commits
  the team to dates and fees but hides the entry is a dead switch. Raised by /review: without it, a person given
  the switch who cannot edit the schedule (a treasurer, say) registered and then met "not found". Team money stays
  on its own switch; team settings and running the workspace's own tournaments are unchanged.

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
| 1 | The registration form, email first: F1, F2, F4; the form honours D1 (F5); the new switch on the Staff sheet | A1, A2, A3, A6, B1 | Drawn and ratified 2026-10-13; built after /design, /simplify and /review (§9) and committed `8e318e4f` 2026-10-15; walk §312 ✅ passed 2026-10-16 (33 of 33; the read-back's two questions are in the ledger); migration 329 waiting on the owner's go |
| 1b | Who the organizer sees: the head coach comes from the portal, and the name boxes say why they are there (G1–G4, §10) | C1, C2, C3 | Drawn 2026-10-15 on the hub's Stage 1b tab; C1–C3 ruled 2026-10-15; UAT accounts named on dev 2026-10-15; build prompt `COACH_REGISTER_EXISTING_TEAM_STAGE1B_BUILD_PROMPT.md` written 2026-10-15; built (§13) and committed `9fe3c4f6` 2026-10-15; walk §314 ✅ passed 2026-10-16 (20 of 20; the read-back found W2's and W3's entries never made, see §13) |
| 1c | One team, one entry: a team already in a tournament cannot be registered into it again (§14) | owner 2026-10-16 | Ruled 2026-10-16; committed `2b1fe65a` (records `a2e57e3a`) 2026-10-16 (§14); walk §317 (the hub's "QA walk · one entry" tab, W4 = §318) ✅ passed 2026-10-16, 15 of 15 on the paste-back; the dev read-back finds no trace of W3–W4 (no notice ever named their entry), asked, see the ledger |
| 2 | Misfiled entries (F7): count how many exist, then a repair door or one-off fixes | E1, E2, E3 | Counted 2026-10-16 on dev and, on the owner's go, production (§15): **none misfiled**, before or after the release; recommended: no door, no fixes, a re-count on 2026-11-16, and the join page's New Team brought in line with the form (E3); asks open on the hub's Stage 2 tab |
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

## 9. Stage 1 as built (2026-10-15, committed `8e318e4f` 2026-10-15)

**What the coach sees** is §5, built to the hub's drawings, with three /design corrections on the built screens
(2026-10-14): the radio is the drawn hollow ring (the browser's own was a solid white disc on Dark), a greyed card's
dashed edge is visible on Dark, and Review's two buttons meet the 44px phone floor. Measured at 390 and 1280 on dev:
no sideways scroll, every phone field 16px and 44px tall.

**One computation decides who may register which team** (`lib/registrable-teams.ts`, pure and unit-tested; its
loader `lib/registrable-teams-server.ts`). The form's cards, the join page's list and the server's refusal all read
it, so the form cannot offer a team the server then refuses. It replaced A4's labelling helper (the A4 rule — only
the portal's own twin takes the portal's name — lives on inside it). On a standalone Premium team the staff
permission decides and membership of the free team underneath confers nothing; a team moved into a club keeps
today's behaviour.

**The server agrees with the form.** `/api/register` asks before it creates the entry (a refused team gets a 403
and nothing is written) and hands the same answer to the link, so it is computed once. The join link asks the same
question. Nobody is added to the free team as a side effect: staff reach the entry through the portal.

**After Submit.** Today's redirect sent a Premium coach to the FREE portal's record (and a staff member who is not a
member of the free team underneath could not open that at all). The fix sits at the free record itself: it
forwards to the portal's record exactly when the portal's record will open for that person (the Premium page's own
gate) — so Submit, the confirmation email's link, a bookmark and the join page all arrive at the same place.

**Step 1's account check** is its own rate-limited request (per IP, a global ceiling, per address). It reveals nothing
the form did not already reveal at Submit (the create-account request answers the same question, unlimited). When it
cannot answer (busy, or the lookup failed) the form falls back to how it worked before email-first, never a dead end.

**Forgot password comes back to the registration.** The return path rides on our own confirm link, not on the auth
provider's redirect (whose allow-list is not this code's to widen), and is honoured only for a public registration
page and only within two hours. A reset link opened in a different browser lands as it always has.

**The switch and the managers.** "Register for tournaments" is on the Staff sheet under Run tournaments (Sensitive:
asks before granting; a Manage-staff delegate hands it out only while holding it), on for head coaches always and in
the Team manager preset, written off in a club, and named in the Team manager invite email. B1 (2026-10-15): it also
opens the team's Tournaments page. Migration 329 switches it on for existing team managers on standalone teams (A3),
plus their live-season copies and open manager invites. It is data-only, committed with the code in `8e318e4f` and
**not applied anywhere yet** (the apply was held for the owner's go; its plan was checked on dev without writing;
`MANUAL_PROD_STEPS.json` records prod as pending). Production has one such manager.

**What /review found and fixed beyond the feature** (2026-10-14, five lenses):

- **The password-reset confirm page followed any link it was handed** — a crafted link could run script on our site or
  send a coach to a look-alike page. It now follows only the auth provider's own link (pre-existing; this stage
  rewrote that page).
- **A race could delete a Premium portal's free team** when two people loaded the form at once (pre-existing; the
  form made it reachable). The losing side now checks before it deletes.
- **A former staff member could be made owner of a live portal's free team** through the old "adopt an orphaned team"
  path, which would seat them in every tournament chat its entries reach. A live portal's free team is never adopted.

**Open — for the owner:**

- **Staff who register are not seated in that tournament's coach chat.** The chat seats the free team's members (the
  portal's owner) and staff of portals that came from a claim, but does not follow a Premium team's free team to its
  staff — true today for every Premium team's staff, not new here; this stage makes it visible because staff now file
  entries. Recommendation: seat every staff member who can open the team's Tournaments page and holds Staff chat.
- **Roster submission for a Premium team still reads the free team's roster** (the Part D deferral, unchanged).

**Not covered on dev:** the reset email itself (dev mail cannot reach the UAT addresses), so Forgot password is
walked up to "check your inbox".

## 10. Stage 1b — the head coach comes from the portal (drawn 2026-10-15)

**Where it came from.** Walking §312 W1 on 2026-10-15, the owner reached the First and Last Name boxes on Step 2 (the
UAT account had no name; the UAT accounts were named 2026-10-15) and asked: *"is it the contact person for the tournament? the form here isn't very clear how
this differs from the name on my account."* Then: *"if a team has a premium coaches portal, shouldn't that
automatically pass in the head coach contact name/details from that portal? … they login, select their team, once
selected information like team name, head coach name, primary contact name, etc. automatically get sent."* Asked
whether to draw it as a stage to rule on: *"yes"*.

**Findings (read from the code, 2026-10-15):**

- **G1 — The name boxes don't say whose name they want, or why they appeared.** A signed-in coach sees First and Last
  Name only when their account has no name on file. Nothing says so, so the boxes read as a second person (a contact)
  next to the account.
- **G2 — What is typed is thrown away.** It goes on the entry and is never saved to the account, so the next
  registration asks again.
- **G3 — Whoever presses Submit becomes the team's coach.** The name is stored as the entry's coach. It shows on the
  organizer's list and team record ("Coach"), in the organizer's new-registration email, in the greeting of every email
  to the team, and on the public Teams and team pages ("Coach: …"). Since Stage 1 lets staff register, a team manager
  who registers is listed as the coach.
- **G4 — "Registering as" changes while you type.** It shows the email until you type in First Name, then follows the
  boxes letter by letter.

**What already exists.** The portal's staff list knows each person's role, and the team's own name for them. An entry
already keeps the head coach (a name, plus an optional email) apart from the person who registered (their email, which
is also how the entry is claimed). The portal's tournament page already edits the head coach part ("Head coach name",
"Coach contact email … leave it blank to use your registration email"). The emails that follow an entry (accepted,
declined, payment, payment reminders, schedule published, and the organizer's announcements) go to the coach's email
when one is set, otherwise to the registration email, and all but the announcements greet the coach by name. The form never fills the head coach part from the
portal.

**What the coach sees (proposed):**

- **A Premium team whose head coach the portal can name:** no name boxes. Step 2 is the team, the name in this
  tournament, the division and the organizer's questions. Review adds **Head coach** ("From your Coaches Portal") and
  **Organizer emails go to** (the portal tournament page's own words). When you are the head coach, it says so, and nothing
  else changes for you.
- **Nobody has a name for you**: *not built* (C3, 2026-10-15: a signed-in account never sees name boxes). As drawn
  for the ruling (your account has none, the portal has none, and you are the coach being listed): one
  pair of boxes, **Your first name** and **Your last name**, with a line saying why: "Your account doesn't have a name
  yet. The organizer sees it as your team's head coach, and we'll save it to your account." Asked once.
- **The portal has no name for a different head coach:** *not built* (C3). The entry's coach is left empty instead
  (build notes).
- **A free team, "A different team", or a team that has moved into a club:** you are the coach, as today. No name
  boxes for a signed-in account (C3).
- **A new coach:** unchanged. The name sets up their new account.
- **"Registering as"** stays put: your account's name, or your email.

## 11. Stage 1b asks

**Rulings (owner, 2026-10-15, pasted from the hub):**

- **C1 → the head coach** (name and email both come from the portal), as recommended.
- **C2 → the person registering picks on Step 2.** Not the recommendation; the owner chose the second option. Drawn as
  "2 · Two head coaches" on the hub (a Head coach dropdown on Step 2, shown only when the team has two or more head
  coaches). Nothing is chosen for the person in the drawing; that detail is the drawing's reading of "picks", not part of
  the ruling.
- **C3 → no name boxes for a signed-in account.** The owner first asked how an account could have no name (answered
  under C3 below), then, on the production count: *"ok, then for C3 we don't need the name fields, you can go ahead
  and add names to the UAT accounts so the tests will match prod, then write the build prompt."* A brand-new coach
  still gives a name: that form creates the account, and C3 was about signed-in accounts.
- **The UAT accounts were named 2026-10-15** (dev): the ten that had none carry person names (Chris Hadley is
  `uat-coach`; the list is in `scripts/seed-uat-coach-fixture.mjs` and `tests/uat/create-uat-accounts.sql`, which now
  create them named and fill an empty name on a re-run). The club's own names for them ("UAT Coach") are unchanged, so
  open walks that use those still read true; the standalone portals carry no club name, so there the person name shows.

**C1 — When a staff member registers, who gets the organizer's emails about the entry?** Recommend **the head coach**:
the head coach's name and email both come from the portal. I recommended the opposite in chat before I had read the
emails. The emails after Submit (accepted, declined, payment, reminders, schedule) greet the coach by name, so filling
in only the name would send "Hi Brett Jackson" to the team manager's inbox, and the organizer's record would show Brett's name beside Alex's address as if it were his.
The person who registered still gets the confirmation (addressed to them, saying where updates go) and sees the entry
on the portal's Tournaments page, which their switch opens (B1). One edit on that page sends the emails back to them.
Other options: the person who registered (only the name comes from the portal, and the greetings need changing); both
(a wider change, since every kind of organizer email goes to one address today).

**C2 — A team with two head coaches: whose name goes on the entry?** Recommend **the person registering, if they are
one of them; otherwise the one who has been on the team longest.** A team has two while one hands over ("You will both
be head coaches until one of you steps down"). The organizer's Coach field and the portal's tournament page each hold
one name. Other options: the person registering picks on Step 2; both names in the one field.

**C3 — A signed-in account with no name: ask once and save it?** Recommend **yes: ask once, with the line saying why,
and save it to the account.** It fills an empty name only, never changes a name someone already has, and never writes
to anyone else's account. Other option: ask with the line but don't save (asked at every registration, as today).

*The owner's question (2026-10-15): how can a signed-in account have no name, if sign-up requires one?* Read from the
code: **every sign-up screen requires a first and last name today** (the registration form, the Premium team sign-up,
the coach join page, the staff invite, the club invite, the fan account). It became true one door at a time: the coach
sign-up stored names from 2026-06-09 (the route dates from 2026-05-25), the Premium team sign-up from 2026-07-21, and
accepting a club invitation asked for a name from 2026-09-26. So a nameless account is one of three kinds: an account
made through one of those doors before its date, an account the platform team creates by hand (email only), or a test
or demo account, like the UAT account the owner walked with. **Production count (read-only, totals only, run
on the owner's go 2026-10-15): 18 accounts, 3 of them test or internal; of the 15 real accounts, none has no name** (none
has half a name either). Every sign-up path requires a name now, so the boxes are reached only by test accounts and any
account the platform team creates by hand.

**Recommendation revised on the count: don't build saving.** Keep the boxes as the fallback, with the clearer labels and
the why-line minus "we'll save it to your account". Saving is new write logic on a public route for a case no customer
is in. Separately, give the UAT test accounts names, so walks show what a real customer sees (the §312 walk met the
boxes only because those accounts have none).

**What Stage 1b deliberately leaves alone:**

- **No live link to the portal after Submit.** The entry records the head coach when it is made. The organizer can edit
  that field too, so syncing could overwrite one side's change without anyone noticing. The team changes it on the
  tournament's page in the portal, as today.
- **The organizer's screens keep their layout.** Their record already shows Coach, Email and, when it differs, Coach's
  email; only the values change.

**Build notes (for the build session):**

- The team card carries the head coach's name and whether it is you, never their email. The server finds the head coach
  again at Submit from the same staff list the D1 check reads, and never trusts the browser's copy.
- `/api/register` writes the portal's head coach as the entry's coach and (C1 as ruled) their email as the coach's
  email, only when it differs from the registrant's. A name typed on the form is used only when the portal has none.
- The confirmation email greets the person who registered (it greets the coach today) and, when the head coach is
  someone else, says the organizer's updates go to them. The organizer's new-registration email names who registered
  when that isn't the head coach.
- C3 as ruled: a signed-in person never sees name boxes. Their own name is the account's. **If a name is missing
  anyway** (only test accounts and hand-made platform accounts; no real one on 2026-10-15), the entry's coach is the
  portal's head coach when there is one, else left empty. Never the email: the public Teams page prints the coach.
  Every email that greets the coach falls back to "Coach" when it is empty (one template already does). This fallback
  is the plan's proposal, not part of the ruling; the build session states it in its UX summary.
- A staff member's name is the team's name for them, else their account's name. The loader that names the people on a
  locked card already reads it that way (`resolveCoachUserIdentities`).
- **Precondition:** the free coach header session's "registered" notice also edits `/api/register`
  (`FREE_COACH_HEADER_PARITY_REGISTERED_BUILD_PROMPT.md`). Build after that change is committed and `git status` shows
  the route clean; never edit around another session's open file.
- C2 as ruled: when the portal has two or more head coaches, Step 2 shows a Head coach dropdown listing them by name
  (never their emails), required before Review. The server checks the pick is a current head coach of that team at
  Submit. With one head coach there is no dropdown. Help: the coach registration article changes (offer /docs).
- Customers read "registration" on this form, never "entry". The plan says "entry"; the screens must not.

## 12. Design review of the Stage 1b drawings (/design, 2026-10-15)

Checked against the decisions log (412 entries) and the product's own form. The design system, principles and Milton
palette files the design agent names do not exist in the repo; the review used the log and the built form.

**Applied to the drawings before hand-off (a proposal until ruled):**

- **The new Review row reads "Organizer emails go to", not "Emails about this entry".** This form never shows customers
  the word "entry"; it says "registration" throughout. "Organizer emails go to" is the sentence the portal's tournament
  page already shows for the same setting ("Organizer emails for this team will go to …"), so the setting has one name
  on both screens.

**Fixed in the session's own formatting check:** "Not you?" no longer wraps onto two lines beside a flag, and the
organizer specimen's labels line up from block to block.

**Checked and kept:**

- **16px input text and 46px boxes** on the phone, the consumer floor (2026-07-13); the "Registering as" row is 44px.
- **A plain asterisk** marks the required name boxes (2026-08-25).
- **The why-line sits under the pair**, as every hint on this form sits under its field. The labels ("Your first name",
  "Your last name") already answer whose name; the line answers why and what happens, which a coach can read after.
- **Review's labels stay the form's quiet uppercase kickers**, and the source ("From your Coaches Portal") is a muted
  line under the name, the same treatment as the registrant's email under theirs.
- **Registered by drops out when the head coach registers**, because it would repeat the row above it (2026-08-14: a row
  that repeats the headline says the least).
- **The drawing note on Step 2 reads as a note** (dashed, italic, "Drawing note:"), never as product copy (the Stage 1
  review's rule).
- **The organizer's record is drawn as values only.** Its layout does not change, so a whole-screen redraw would show
  nothing new.
- **Every flag and tag opens its explanation**, checked by clicking each kind in a render from disk at 390 and 1280.

**The C2 drawing ("2 · Two head coaches", added after the 2026-10-15 rulings), checked the same way:** a dropdown, as
the pick-one rule (2026-08-22) asks of a choice whose options carry no sentence; 16px text in a 46px box; the plain
asterisk; names only, never emails; the line under it states the consequence (who the organizer sees and writes to).

## 13. Stage 1b as built (2026-10-15, committed `9fe3c4f6` 2026-10-15)

**Before the build** (owner, 2026-10-15): §312 was still open, and this build changes the Review step two of its
steps check. The owner chose *"build now, reword 2 steps"*: §312 W1-7 and W3-4 now describe the new Review rows, their
ticks kept. The two proposals the rulings did not cover were accepted as put: **no name anywhere** leaves the entry's
coach empty (NULL, never the email) and the emails say "Hi Coach"; **the C2 dropdown starts with nothing chosen**.

**What the coach sees** is the hub's Stage 1b drawings, as drawn:

- **A signed-in coach never sees name boxes** (C3). "Registering as" is the account's name, else the email, and never
  follows typing (G4). A brand-new coach still gives a name: that form creates the account.
- **A standalone Premium team's coach is its head coach**, whoever presses Submit (C1). Review shows **Head coach** ("From
  your Coaches Portal" under it, "(you)" when it is you), **Registered by** with the email under it only when that is
  someone else, and **Organizer emails go to** (the head coach by name, or your own address when you are the head coach).
  The note at the bottom of Review adds "You can change the head coach or where emails go from there."
- **Two or more head coaches** (C2): a **Head coach** dropdown on Step 2, nothing chosen, names only, with the drawn line
  under it; the form will not reach Review without a pick. One reading of an undrawn case: when the person registering
  is one of the head coaches, their option reads "Name (you)", matching Review.
- **A free team, "A different team", a club-owned team**: today's Review rows; the person registering is the coach.

**What the organizer and the emails see.** The entry records the head coach's name as the coach and, when the head coach
is someone else, their address as the coach's email, so the organizer's record shows Coach, Email (the registrant's,
still the claim key) and Coach's email, and every later email goes to the head coach. The organizer's new-registration
email names the coach, gives the head coach's address as Contact, and adds "Registered by" (name and email) when someone
else registered. The confirmation goes to the person who registered, greets them, and, when the head coach is someone
else, says "Organizer emails about this registration go to **Name**, your team's head coach. You can change that on the
tournament's page in your Coaches Portal." Every coach email that greets the coach says "Hi Coach" when no name is on
file, and the names in those greetings are now escaped.

**How it holds** (`lib/registrable-teams.ts`, pure and unit-tested): each open standalone Premium card carries its head
coaches as `{ id, name, isYou }` — the staff membership id and the name, **never an email** (Stage 1's /review rule);
`pickEntryHeadCoach` decides who (one: that one; two or more: the pick must be one of them; none: the registrant);
`entryCoachRecord` decides what the entry records. `/api/register` asks both on the card the D1 check just computed
(never a name from the browser), reads the head coach again at Submit (`getEntryHeadCoachIdentity`: still active,
still head coach), and refuses with "has NOT been registered" and nothing written when the head coach changed or their
account could not be read, rather than send the organizer's emails to the wrong person. The form sends a pick only when
there were two to choose between, so a second head coach added while the form was open is refused, never decided for
the person. A FieldLogicHQ staff address is never written as the coach's email (the portal's editor refuses the same).
The form's account name and the server's are one rule (`nameFromAccountMetadata`, which `/api/coaches/basic-teams` now
uses too).

**Words** (/marketing, 2026-10-15): the confirmation's sentence uses "Organizer emails", the name Review and the portal's
head-coach editor already give the setting; the refusal for a changed staff list reads "Your team’s head coaches changed
while this page was open, so your team has NOT been registered. Reload the page and try again."; a head coach with no
name on file reads "Head coach (no name on file)" in the dropdown and "No name on file" on Review.

**Checked.** Unit 47/47 (`tests/unit/registrable-teams.test.ts`); typecheck and lint clean; an end-to-end run on dev
through the real form (`.probe/reg-1b-look.mjs`): the head coach, the team manager and a temporary second head coach
registered and the entries read back (coach, coach's email, email as ruled), a submit with no pick refused with nothing
written, a different team and a new coach unchanged; at 390 and 1280, dark and the light look: no sideways scroll, every
phone field 16px and 44px. Every probe write was undone. /simplify (four lenses: the decision moved into one tested
function, the staff read reuses the existing reader, the account name is one rule), /design on the built screens (no
departures; the "(you)" option noted above), /review at high (four lenses; three fixed: the organizer's registrations
search broke on an entry with no coach, which imports already made and this stage made reachable from the public form;
the confirmation could promise the head coach the emails when a staff address was refused; a pick made before a second
head coach was added was accepted).

**Walked.** Owner QA §314 ✅ passed 2026-10-16, 20 of 20 on the paste-back. The dev read-back found only W1's entry
(*1b Walk Head*, coach Chris Hadley). W2's and W3's Submits never reached the server: the owner's "one team, one entry"
rule (2026-10-16, another session's build) went live on the dev server at 12:41 p.m., mid-walk, when both standalone
teams were already in the walk's tournament, so their cards read "Already registered". The registrant-is-not-the-head-
coach record is still on dev from §312 W3's entry; the picked second head coach rests on the unit tests and the
end-to-end run above. The ledger has the full read-back.

**The emails on dev.** Dev mail cannot reach the UAT addresses, so the emails were checked as rendered: the dev email
preview (`/dev/email-preview`) now shows "Registration received — someone else is the head coach" and "New registration
— to the organizer" with Registered by.

**The registered notice** (Free coach header parity, `c3ba568f`) runs on the same route, unchanged: it names the team as
entered and the host club, and reaches the free team's other coaches — a Premium team's staff, nobody.

**Open — for the owner:**

- **The portal's head-coach editor says "(your registration email)"** when the coach's email is blank — wrong for a staff
  member reading a head coach's registration. True since Stage 1 let staff open the record; Stage 1b makes it more common.
- **A platform-customised confirmation template** greets the right person but cannot carry the new "Organizer emails go
  to …" sentence (the customised path has no variable for it).
- **Head coach emails carry a claim link pre-filled with the registrant's email** (existing design: the link is the
  claim key, `teams.email`).
- **The other coach emails still insert team, division and tournament names unescaped** (older code; only their
  greetings changed here).

## 14. One team, one entry (ruled and built 2026-10-16)

**What happened.** During the §312 walk on 2026-10-16 the owner saw *UAT Import Smoke Tournament* twice on a team's
Tournaments page. The dev data: the head coach (uat-coach) entered *UAT Standalone Team (No Metrics)* in U12 at 12:26
p.m. under the name *No Metrics - Walk*. At 12:31 p.m. a staff member holding the Register for tournaments switch
(uat-asst-money) entered the **same team** in U12 again, under its own name. The only duplicate rule compared **names**
within a division (`findDuplicateTournamentTeam`). It dates from when every entry was a name typed by a stranger. Two
things this project shipped together opened the gap: A2 (a team may go by another name in a tournament) and D1 (its staff
may register it). The plan never considered the case.

**Ruled** (owner, 2026-10-16: *"I agree, go ahead and build that"*): a team already in a tournament cannot be entered
again, **anywhere in the tournament**, not only in the same division. One team entered in two divisions of one event is
rare, the organizer can still add it by hand, and a same-division rule would leave this exact accident open whenever
someone picks the wrong age group.

**Ruled the same day: a rejected registration still counts** (owner, 2026-10-16: *"I think rejected should not be allowed
to register again, if the organizers want them to be allowed back in they can change the status to accepted or delete the
team and allow a new registration"*). This reverses the build's first reading, "a rejected entry does not count". The
card and the refusal name it in the portal's words ("· Not Accepted"). Letting the team back in is the organizer's: they
change its status to accepted, moving its division if that was the problem (their Teams page already moves a team), or
delete the entry so a new registration can be made. It now agrees with "Add my team" and the name rule, which already
counted a rejected entry. Walk: §318 (the hub's rewritten W4).

**What the coach sees.**

- **Step 2's card for a team already in this tournament** is greyed (the locked card's look) with a tick instead of a
  lock, and cannot be chosen: *"Already registered · U12 · Pending Review"*, or *"Already registered as “No Metrics -
  Walk” · U12 · Pending Review"* when it went in under another name (the name the person will find on the schedule).
  The status words are the portal's (`REGISTRATION_STATUS_LABEL`). It is shown rather than hidden for F5's reason: an
  empty space reads as "make a new team".
- **"View registration"** follows the line on a card the person may register: the record the form itself lands on after
  Submit. A locked card gets no link: schedule editing opens the record too (B1), and the card cannot tell whether this
  person holds it, so a link there might refuse them.
- **"Where it already is" beats "who can register it"**: a locked card whose team is already in shows the entry line.
- **The one-team preselect** (§9) counts only choosable teams, so a team already in is never picked for anyone. A choice
  that comes back already registered on a reload is dropped, as a locked one was, and is never swapped for another team.
- **Submit refuses a second entry** with the same facts: *"UAT Standalone Team (No Metrics) is already registered in this
  tournament as “No Metrics - Walk” (U12 · Pending Review), so it has NOT been registered again. It’s on your team’s
  Tournaments page."* (409, code `team_already_registered`). On that code the form reloads its cards and clears the name
  and head coach it held for that team, so **Try Again** shows the team as already registered, with nothing chosen.

**What counts as "already in"** (`matchTeamEntries`, `lib/registrable-teams.ts`; its read `findTeamEntriesInTournament`,
`lib/team-registration-duplicates.ts`):

- An entry reaches a team by **either bridge**: the free team's (`basic_coach_team_registrations`, the twin for a Premium
  team; the register form and the claim write it) or the portal's rep team's (`rep_team_tournament_registrations`; "Add
  my team" and a club's link write it). This is the same pair `findHostRegistrationInTournament` reads for the host's own
  team. Every portal card carries its rep team (`repTeamId`): a standalone portal's, a club-owned twin's, and one whose
  slug could not be read.
- **A rejected entry counts** (owner, 2026-10-16, above). When a team has both a live entry and a rejected one, the
  live one is named, so the card never says "Not Accepted" while the team is in.
- **Two entries already in** (made before this rule): the earliest is named, the one the second copied.
- **A team typed in by hand** ("A different team", a new coach, a signed-out registrant) has no identity to match; the
  name rule is still its only rule, and it still runs for every entry.

**Where it is asked.** The form's team read (`GET /api/coaches/basic-teams?orgSlug=&tournamentSlug=`) marks each
card's `alreadyIn`. The page names its tournament by its own address, and the route resolves it with the page's own
resolver (`getPublicTournamentPageData`), beside the team load, so the form's two loads still run side by side. It is
fail-soft: an unreadable mark leaves the plain cards, and Submit asks again. `/api/register` asks afresh after D1 and
before the insert. The read is one request per bridge, the two at once, each joined to its entry and kept to this
tournament (`!inner`), never a list of every entry the team ever made.

**/simplify (2026-10-16, four lenses).** Applied:
- the shared `sameKey` (name matching, which also replaced the name rule's own normalizer) and no hand-rolled id check;
- one joined read per bridge;
- the form's load back in parallel (the first build made it wait for the tournament);
- one `cardState` deciding how a card reads;
- a private `entryWhere` for the two wordings;
- `alreadyIn` optional only (not also null);
- the test guards loosened to behaviour.

Skipped as owner calls, not cleanups: guarding the join link (above), and folding "Add my team"'s older identity check
(`findHostRegistrationInTournament`) into this one. That check counts rejected entries and finds a host with no free
team by its rep team alone, so merging would change what "Add my team" does. A database constraint was judged
disproportionate: neither bridge stores the tournament or the entry's status, so it would take two triggers and an
insert-and-link RPC to close a same-second race.

**/review (2026-10-16, four lenses: correctness, security, state, regression).** Fixed:
- **Medium:** after a refusal, the reload swapped the dropped choice for the one remaining Premium team (the preselect).
  It also kept the refused team's name, which "A different team" would then file as a new team, re-entering the same
  real team. Now the choice is dropped, never swapped, and the name and head-coach pick are cleared. Verified in a
  browser with Submit intercepted and nothing written (`.probe/dup-refusal-look.mjs`).
- **Low:** a club-owned twin and a portal with no readable slug were matched by the twin alone (now `repTeamId`).
- **Low:** "which came first" compared timestamps as text (now as times).
- **Low:** two help sentences were wrong. Staff with neither schedule editing nor the switch get no Tournaments page, not
  a list (that one predates this change). The help's "a rejected team can register again" was then superseded the same
  day by the ruling above: it now says a rejected registration still counts and only the organizer lets the team back in.

Accepted: locked staff see their own team's entry line, and the response carries its id, which opens nothing for them.
Locked assistants who could open the record get no link.

**Not covered, said plainly:**

- **Two Submits in the same instant can both pass**, exactly as with the name rule (a check, then an insert). Closing it
  would need a database constraint across the entry and its bridge; not proposed for a race between two staff members
  pressing Submit in the same second.
- **The join link** (the confirmation email's "add to your team" for an entry made signed out) can still file an entry
  under a team already in the tournament. That entry already exists at the organizer, so refusing the link would only
  leave it unreachable. Not built; an owner call if it is ever seen.

**Dev data** (owner, 2026-10-16: *"314 is done, you can update the data so it is only registered once or not at
all"*): the staff member's duplicate (*UAT Standalone Team (No Metrics)*, 12:31 p.m.) and §314's *1b Walk Head* (12:37
p.m.) were removed the way the organizer's delete removes an entry (neither had games, a slot or a bell notice; both rows
are recorded in `.probe/dup-team-removed-rows.json`). *No Metrics - Walk* stays, so No Metrics is in once and UAT
Standalone Team is not in at all. That is the state walk §317 starts from. Dev held no *1b Walk Manager* or *1b Walk
Two*: §314's W2 and W3 saved no entry. This rule reached the dev server while §314 was being walked, so they may have
been refused by it; that is for §314's record.

**Verified:** unit 56/56 in `tests/unit/registrable-teams.test.ts` (the matching, the words, choosability, and a guard
that the server asks after D1 and before the insert). The dev read through the real loader marked exactly the one team
in, for all three UAT staff accounts. A Playwright probe on the dev server (`.probe/dup-team-look.mjs`) signed in as
uat-coach at 1280 and 390 (light and dark) and found the greyed card with its line and link, a click on it choosing
nothing, and no horizontal overflow. The same probe got the API marking only with a valid tournament id, and the server's
refusal (409, the sentence above) with nothing written. Typecheck clean, focused lint clean. `npm test`: 7,407 of 7,409;
the two failures are already on HEAD and not in this change (club Stage 6c's rail scrollbar, the coach portal's
`.occGroupPermit` ink), as are `check:admin-old-look` (house league), `check:css-selectors` (GuidanceRail `.context`)
and `check:snapshot-freshness` (migration 329, owed since Stage 1).

## 15. Stage 2 · the count (2026-10-16)

**The question** (ladder row 2, F7): how many entries are filed in the wrong place, does it still happen, and is the
answer a repair door or one-off fixes? Counted read-only on dev, then on production on the owner's go (2026-10-16,
"Yes, run it"). Nothing was written anywhere. The script is `.probe/reg-stage2-count.mjs dev|prod`; its detail, with
identities, stays in `.probe/reg-stage2-{dev,prod}.json` (local only). The case reads are `.probe/reg-stage2-prod-*.mjs`.

**The line between before and after** is master job 280, 2026-10-16 at 3:48 p.m. ET, when Stages 1, 1b and 1c reached
production (`8e318e4f`, `9fe3c4f6`, `2b1fe65a`, `9ca06ceb`; checked as ancestors of `85a5428d`).

### The definitions

An entry reaches a coach team by one of two links: the free team's (which the register form, the join page and "Add my
team" write) or the portal's own rep-team link (which an organizer's "Link to rep team" and "Add my team" write). A
Premium team is one team whichever link reached it.

- **1 · A stray team beside a Premium portal** (A5's shape). The entry is linked to a free team that is not a portal's own
   free team, and the person who linked it, or a member of that team, is on a live standalone portal (as staff, as a
   member of the portal's free team, or as its owner). Split two ways: whether they were on the portal when the entry
   was filed (a coach's free team from before their Premium team is not misfiled), and whether the stray team is
   otherwise empty (no players, events, fees, announcements or other entries, A5's preconditions). Counted beside it:
   **1b**, a second free team that points at a portal without being its own (A4's shape).
- **2 · One team entered twice in one tournament**, by either link, a rejected entry counted (owner, 2026-10-16). Counted
   beside it: **2b**, two different coach teams in one tournament with a person in common (the head coach and assistant
   double entry that started 1c), and any entry whose two links point at different teams.
- **3 · An entry filed by someone not on the team.** The person who linked it is not an active member of the free team
   and, for a portal's free team, not active staff or the owner either. Split: nobody recorded, since removed, never on
   the team. A staff member filing under the portal's free team without being a member of it is correct since D1 and
   is not counted. The rep-team link is the organizer's own, so it is not asked.
- **4 · An entry with no coach-side link** whose contact email (or coach email) belongs to an account that has a coach
   team. This is unfiled, not misfiled: an organizer's import or hand-added team is unlinked until its coach claims it
   (the invite-only claim exists for that). Each case is read to tell which.
- **5 · A second account** (added after reading production): a Premium staff member's surname on the coach name or in the
   team name of an entry filed under a different account. Every other check matches people by account, so this is the
   only way to see a staff member who registered under another email. Production only, read by hand.

**Proved on dev first.** Dev holds only test data. Definition 1 found 7 fixture entries, all filed before their coach
joined a portal (correctly not counted as misfiled at the time); 2b found 21 pairs, all one fixture account that linked 7
seeded teams; 3 found 8 backfill or seed links; 4 found 62 demo seeds (entries seeded before their accounts). Because
dev no longer holds a staff-filed entry (the 12:31 p.m. one was removed 2026-10-16), the script's `--selftest` adds
synthetic rows in memory and checks each definition: a staff-filed entry is left alone, an outsider-filed one is caught,
the same team twice is caught, an A5-shaped stray is caught as empty and held at the time, the stray and the portal
sharing a person is caught, and a link under a portal's own free team is never a stray. 6 of 6 pass.

### The counts (production, 2026-10-16 9:42 p.m. ET)

Production holds 62 entries: 30 real ones, in three tournaments run by one organizer (Battle of the Bats, completed in
July; U11 Battle of the Bats, completed in July; U13 Battle of the Bats 2027, open), and 32 in the two demo sandboxes.
There are 10 coach-side links, all through the free team (none through the rep-team link), one live Premium portal
(*Milton Bats U13 Purple*, six staff) and 18 accounts, 4 of them test or internal.

| Definition | Real, before | Real, after | Test |
|---|---|---|---|
| 1 · stray team beside a Premium portal | 1 found, not misfiled | 0 | 0 |
| 1b · a second free team pointing at a portal | 0 | 0 | 0 |
| 2 · one team twice in one tournament | 0 | 0 | 0 |
| 2b · two teams with a person in common | 0 | 0 | 0 |
| 3 · filed by someone not on the team | 0 | 0 | 0 |
| 4 · unlinked, contact has a coach team | 1 found, not misfiled | 0 | 0 |
| 5 · a second account | 1 found, a false positive | 0 | — |

**The three cases, read one by one:**

- **"Milton Bats White" in U11 Battle of the Bats** (definition 1). The organizer imported all twelve U11 teams on
  2026-07-05 between 5:58 and 6:04 p.m. ET. A coach claimed this entry into a new free team of their own on 07-09. That
  coach joined the Purple U13 portal as an assistant later; the portal itself was set up on 08-25. A U11 team, filed
  under its own team six weeks before the portal existed. **Correct as filed.**
- **"Milton Bats Purple" in U11 Battle of the Bats** (definition 4). Part of the same import, never claimed. Its contact
  made an account on 2026-10-14 to register a different team (*Milton Bats White - Gutcher*, U13) for 2027, which sits
  under its own new free team. That person is not on any portal's staff. The tournament ended in July. **Nothing to
  move.**
- **"Milton Bats White - Gutcher" in U13 Battle of the Bats 2027** (definition 5). A Purple staff member's surname is
  White, which matched the colour in the team name. Nobody on the Purple staff is named Gutcher, by account or by the
  portal's own name for them. **A false positive.**

**A5's entry reads correctly**: *Milton Bats Purple - Jackson* sits under the Purple portal's own free team, linked by
its active head coach. Every other 2027 entry made through the form sits under a free team made with it.

**After the release**, one entry arrived: *Barrie Storm (Weekes)* at 7:53 p.m., accepted at once, with no coach-side link
and no account for its email, which is how an organizer's hand-added team looks. **No coach has registered through the
form since the release**, so the "after" column cannot show whether the cause is closed. The code says it is (the form
and the server ask one computation, unit-tested, walked in §312, §314 and §317); the data has not been asked yet.

### Where a misfiled entry can still come from

- **The join page's New Team** (`/coaches/join`). Every coach email that carries the claim link lands there: the
  registration confirmation, the organizer's resend-access and chat sign-up reminder, and, on the free Tournament plan
  (`d82c4118`, committed 2026-10-16, not yet on production), the team-added email that is the invitation. It still offers
  **Existing Team** and **New Team** as two equal buttons with no sentence under New Team, the shape F4 named on the old
  form. It picks Existing Team when the coach has a team to choose, but its team list starts on "Select a team", nothing
  chosen. A Premium coach
  claiming an organizer-added entry who taps New Team makes A5's shape again. Once the free plan's invite-only events
  ship, this page is how most coaches attach their entries. (E3.)
- **"A different team", chosen on purpose.** The form says plainly that it makes a separate team the portal won't show.
  Definition 1 counts it, marked as held at the time.
- **A second email.** Email first cannot recognize a coach who signs up again under another address. Definition 5 is the
  only check, and it is by hand.
- **The join link and one team, one entry, on production until the next release.** The claim's refusal of a team already
  in the tournament is in `d82c4118`, not in `85a5428d`, so on production today the join page can still file an entry
  under a team that is already in. Definition 2 would count it.

### What a move must carry (for a one-off fix on A5's pattern)

The script pattern is `.probe/brett-a5-move-entry.mjs`: preconditions re-checked, a backup written first, a dry run, then
`--apply` on the owner's go, named case by case.

- **Re-check before writing:** the entry has exactly one coach-side link, to the stray team; the target portal is live
  and standalone and the person is on it; the stray team is otherwise empty (players, events, fees, announcements,
  other entries), or the fix stops; **the target team is not already in that tournament** (one team, one entry, new
  since A5, and the move must refuse rather than make a duplicate).
- **Moves with the one link**, because each of these reads through it: the portal's Tournaments page and the entry's
  record; the team notices; roster submission, which then reads the portal's free team (the Part D deferral; a stray's
  own roster would be left behind, which is why "empty" is a precondition); the tournament coach chat, whose seats are
  re-synced from the link, so the portal's coaches join at the next sync. The sync never removes anyone, so the stray
  team's members keep their seat. That is harmless in A5's shape, where they are the same coach, and a decision to make
  when they are not.
- **Stays, because it is the organizer's:** the entry itself (its name, division, status, payments, slot, check-in, the
  roster already sent), its contact email (the claim key), and the coach and coach email recorded at registration. A
  moved entry keeps the head coach it was registered with; the coach changes it on the portal's tournament page. Any
  claim rows for the entry stay as they are.
- **Afterwards:** the stray team and its membership are removed only when empty, as A5 did.

### The recommendation

**No repair door and no one-off fixes: nothing is misfiled.** A door is a new surface with drawings, a build and a walk,
for a case production does not have. There are no fix scripts to write, because there are no cases.

**But "the cause is closed" is not yet a fact the data can show.** Not one coach has registered through the form since
the release. So close Stage 2 as counted, and re-count once coaches have used the new form (E2). The 2027 tournament is
still open, so more entries will arrive. If a re-count finds a case filed after 2026-10-16, Stage 2
reopens with the door question, and "whose door" (the coach's, the organizer's, or support's after the Club release) is
asked then.

**The one change worth making now is the join page (E3)**, the remaining coach-tappable way back to A5's shape. It is
copy and order, the same treatment Stage 1 gave the form (New Team last, with the sentence that says what it makes),
and it is small enough for the next registration build session. Not built here.

### Asks (open, on the hub's Stage 2 tab)

- **E1 — Stage 2 with nothing to fix.** Recommend **close it as counted: no door, no fixes.** Other options: draw the
  coach's repair door anyway; keep Stage 2 open until the re-count.
- **E2 — When to count again.** Recommend **on 2026-11-16, a month after the release**, run by a session with your go
  for the production read. Other options: when the 2027 registration closes; only if a coach or organizer reports one.
- **E3 — The join page's New Team.** Recommend **give it the form's treatment** (last, with the sentence saying it makes
  a separate team the portal won't show), in the next registration build. Other options: leave it; remove New Team from
  the join page when the coach has a Premium team they may register.
