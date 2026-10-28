# House league — Club Tier Stage 9 (plan)

> **Deep dive walked and 9a drawn 2026-10-24.** Hub https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7 (walk · standing back · ladder · 9a drawn · asks):
> source `docs/projects/active/HOUSE_LEAGUE_STAGE9_HUB.html` (captures as `{{IMG:…}}` placeholders; the published copy
> inlines them). PM brief: `HOUSE_LEAGUE_STAGE9_PM_BRIEF.md`. Kickoff prompt: `CLUB_TIER_STAGE9_DEEP_DIVE_PROMPT.md`.
> The Club plan (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 9) reserves the slot; this file is the stage's plan.
> Nothing is built. The next stage is drawn only once the one before it is ruled.

## 0 · Owner rulings 2026-10-24 (paste-back from the deep-dive hub)

26 of 27 asks ruled, every one as recommended. Q10, Q16 and Q17 are recorded as the option text the owner saw: the
paste-back's stored value for those three was the pre-review wording (the label was updated after the /ux review, the value
was not).

- **9a (all ruled):** 9a·1 grouped rows (Running now · Getting ready only when one exists · Past seasons shelf);
  9a·2 rail season block = switcher + Overview · Registrations · Teams & draft · Schedule · Standings · Money · Email
  families; 9a·3 phone = season header + scrolling page strip on every season page; 9a·4 a getting-ready season leads with
  a checklist and a primary Open registration, Complete and Archive are a rare door, every status change asks;
  9a·5 on a phone Add registration is a + and Approve is the one primary; 9a·6 section headings stay inside the card;
  9a·7 a season taking sign-ups shows in Open now and in its program section, on purpose. S1·b the dead fee switch is
  removed in 9a. Q14 every live season shows, labelled by what's happening. Q16 a finished season reads in place, locked
  through the one gate, Money still open, "Finished" in the switcher. Q17 club admin = league admin; registrar =
  registrations, fees and refunds, add by hand, email families, reads the rest; treasurer reads Money; a coach (if Q7) is a
  column of the same gate in 9c. Q18 "Money". Q12 "Email families" — **with an owner note: evaluate whether two ways of
  emailing families in one portal are needed, and whether there is a better organization** (answered in the 9b round).
- **Payments boundary:** Q1 a family pays when accepted (an auto-approved sign-up is accepted at once). Q2 the price is
  frozen at sign-up, early bird follows the sign-up date, the convenor can correct one registration's price with a reason.
  Q3 an accepted unpaid registration holds its spot; the convenor sees "unpaid N days" and decides. Q4 the promotion email
  carries the pay spot (ghost in 9b, live in 12b). Q5 one sign-up registers several children. Q6 ending a paid registration
  asks each time: refund recorded, or kept with a reason. Q10 one "House league registration fees" row with the seasons
  under it; budget = the sum of each division's cap × price; a fee files in the fiscal year it was received. Q15 the season
  Money page is the book on League Plus; Club also files to the Statement.
- **Scope:** S1·a Create season asks name, sport, dates; the rest lives on the season's Overview blocks. Q7 light coach
  accounts (invite by email, own team only, roster contacts + schedule + scores). Q8 a light 1–5 rating feeding a balanced
  snake draft. Q9 volunteers are their own project, not Stage 9. Q11 the schedule health score (the tournament's button,
  window and engine).
- **Open:** S2·b (do the open/close dates run the form) — unanswered, carried into the 9b round.
- **Raised by the owner with the rulings:** bulk-adding seasons per age group ("U13, U15, U17, U10 opened at the same
  time") — answered in the 9b round (see §6a).

## 0b · Owner rulings 2026-10-24, round 2 ("I agree with your recommendations")

All 15 round-2 asks ruled as recommended (§6a). 9a and 9b are fully ruled.
- **Q19** one season, age groups as divisions, added several at once by "Add age groups"; the club picks birth years.
- **Q12b** one composer: the Families window, opened from the season already set to it; division/team/status/"Selected"
  audiences added in 9d; the old Notifications page and Message registrants window retire; the season keeps its own sent
  history. **Q12c** automatic notices never count toward a cap; each season has its own 3 typed sends a day; club-wide sends
  keep the club's 3.
- **S2·b** the dates run the form; the convenor can close early or reopen until a new date.
- **9b·1** required before Open registration: age groups, prices, dates, and how-to-pay whenever a price is above $0; the
  waiver is optional. **9b·2** one early-bird date per season, an early amount per division. **9b·4** a birth year no
  division fits: the form says so and shows the club's contact; nothing is registered. **9b·5** each child's outcome shown
  before Submit; no all-or-nothing. **9b·7** bulk Approve, Waitlist, Mark received, Move division, Email; Decline and Withdraw
  one at a time; partial results said plainly. **9b·8** "owing" turns amber after a number of days the club sets (starts at
  14). **9b·9** how-to-pay text required whenever a price is above $0, one per season, copied forward; a free season says
  "Free". **9b·10** the Money band is Owed · Received (net of refunds) · Still owing, refunds listed below. **9b·11** a
  season's budget sits in the fiscal year its sign-ups open; the treasurer can split it. **9b·12** "Accepted" on every family
  screen and email; staff keep the Approve button. **9b·13** two divisions for one age group: the family picks, seeing each
  division's note and room.

## 0c · Owner rulings 2026-10-24, the 9a build session (all as recommended)

- **Part 6:** in 9a "Email families" is a rename only; it keeps opening the season's own composer. The switch to the
  Families window, Q12c's per-season allowance, the 9d audiences, the season's sent history and retiring the old page and
  modal all land together in 9d.
- **Email on a finished season stays open** (the gate's one addition to Q16): the convenor and registrar can still email a
  completed season's families. A note to families is not a change to the season's record, and the Families window's
  season audience cannot reach a finished season.
- **Reopen registration** is offered only while the season is in Registration closed (play has not started). Once it is
  Playing now, late players are added by hand; reopening sign-ups mid-season is S2·b's dates work (9b).
- **Archive** stays a label-only door in 9a, said plainly in its window; what Archive does is 9f's. ⚠ The option's
  description as asked said Archive "moves the season off your Past seasons list"; that was the asking session's error —
  in the code an archived season stays under Past seasons, and the copy (`HOUSE_LEAGUE_STAGE9A_COPY.md` §4.6) says so. The
  build follows the code and the copy (it stays on the shelf); the owner was told of the correction the same day.
- **Part 1 committed `29b1618c3`** (the one gate, the two backward status steps, the guard). Until Part 4 builds the status
  windows, the old screens show edit controls on a finished season that the server refuses: Part 4 must land with Part 1
  before any promote.

## 0d · Owner rulings 2026-10-25, the 9b-1 build session (all four as recommended)

- **A child's price is recorded at sign-up.** The build prompt resolved the price from today's prices and the sign-up
  date; a price edit would then have changed what an earlier family owes, against the drawn hint ("A price change applies
  to new sign-ups only"). Ruled: the amount (with the early bird, by the sign-up date) is written on the registration when
  the child signs up and never moves; existing registrations take the season price they owed. The correction window and
  "Move division asks to re-price" stay 9b-2's.
- **An existing division edits as drawn** (§3 of the drawing): the pencil flips the whole record in place, every field
  autosaves, "Remove this division" only while nobody is in it. Add age groups is the create door and asks. This replaces
  the 9a walk's accepted call "a division still saves when you press Save in its window".
  **⚖ Revised by the owner 2026-10-25, on first sight in the walk (§375 C):** the record opens in a **window**, not in
  the table. A row that opens a FORM opens a window (the table standard; a short read is what folds in place), and the
  table stays whole behind it. The whole row is the door; the window is the kit's record window (reads first, the head's
  pencil ↔ ✓ flips it whole, autosaves, Previous · Next through the divisions, full screen on a phone), and "Remove this
  division" ends its body, red, asking first, only while nobody is in it. Autosave and Add age groups are unchanged.
- **Order of work:** the price foundation and the race-proof sign-up first; the themed date picker commits before setup,
  dates and the form (it did, `a8342ff0a`, before Part 2 started).
- **On a review-first season a received child holds a spot**: once accepted and received children fill the size, the next
  child goes to the waitlist and is told so before signing up.

## 0e · Owner rulings 2026-10-25, the 9b-2 build session (all seven as recommended)

- **The book: a payment is a line in; a refund is its own line out, beside the payment it returns.** A price correction is
  recorded on the registration (old price, new price, reason, who, when) and shown in Money's history; it moves no money
  itself. On a PAID registration, raising the price leaves the difference owing; lowering it records a refund of the
  difference (a date and how). The Correct-a-price window **tells** which, it does not offer both: with no family credit
  (Stage 12) there is nothing else a lower price can mean.
- **"Undo: marked received by mistake" stays** on a paid row: it voids a payment that never happened (not a refund), and is
  refused once that payment's fiscal year is closed. Q6's "never a silent void" is about ending a registration.
- **Mark received records the full balance still owed.** The screens never offer a partial amount (Stage 12); the writer
  itself takes an amount, a date and a method, so a price rise is settled by a second line in.
- **"Owing N days" counts from a new accepted-at fact.** A registration accepted before the fact existed reads "owing" with
  no day count and never turns amber; no date is invented.
- **Old paid ticks with no book line get a one-time catch-up line** (the frozen price, dated the registration's last change,
  method "not recorded"). No club is on production (owner), so this is fixture hygiene, not a historical-data rule; the
  dev seeds go through the one writer from now on.
- **Bulk Move division asks once for the batch:** "Keep each child's price" or "Use {division}'s price". A child who has
  paid always keeps their price and is listed ("kept their price: paid; correct one at a time").
- **"Approve respects room" is tested where it can bite:** approving from To review never meets a full division (a child in
  review already holds a spot); the refusal shows on promoting from the waitlist, reviving an ended registration, and moving.
- **The Statement half is walked on `uat-rep-club`** (Club plan). The dev league is League Plus: no Accounting, so its
  treasurer reads no Money, and its Money page is the book (Q15).
- **9b·11's split is built as a per-season split** (today a budget line belongs to one fiscal year); it is the last part.
- **The words' four open questions (copy §18), owner 2026-10-25, all as recommended:** the ending window's money question
  starts with **nothing picked** (the primary is absent until Refunded or Kept is chosen); **Withdraw emails the family only
  when money moved** (a refund, or a kept fee with its reason), silent otherwise; a refund line carries **no typed reason**
  ("Refund · declined" etc.); a raised price **tells nobody** this stage (the window says so).

## 0f · Owner rulings 2026-10-26, the 9c drawings (all fourteen as recommended, by paste-back)

Drawings https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk (source `HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`).

- **9c·1** A house-league coach gets **a team page of its own**: one screen with the roster and contacts, then schedule (9d)
  and scores (9e). The coach's sign-in card opens it directly. **The Coaches Portal is untouched.**
- **9c·2a** The registrar **does not see ratings**: absent from every screen and export a registrar opens. They see the
  teams, not the ratings.
- **9c·2b** A rating lives with **this season's registration only**, erased automatically when the season finishes. Next
  year starts fresh; carrying ratings forward is Stage 14's question.
- **9c·2c** A rating is **a number from 1 to 5 with no comment box**, never shown on a family screen; if a parent asks, the
  club reads it from the child's record and answers them.
- **9c·3** **Lock a child to a team before the draft, in 9c.** On the board, "Lock to this team" on a child; the draft deals
  everyone else around locked children and counts their ratings.
- **9c·4** Placement notices go **in 9c, through the club's existing batched sender**: one email per household, never
  counted toward a cap. A family who unsubscribed from club news still gets it.
- **9c·5** **Retire "Draft mode", and Randomize with it.** The balanced draft and dragging cover both.
- **9c·6** **Publish one division at a time.** U8 can be told while U14 is still being drafted.
- **9c·7** A child **still to review is not drafted**. The setup window and Publish name them with a link to Registrations;
  once accepted, they appear under "Not on a team".
- **9c·8** Unrated children in a partly rated division **count as a 3**; the setup window says how many.
- **9c·9** A coach sees each family's **guardian name, email and phone**, plus one line on the sign-up form: "Your child's
  coach will see your name, email and phone to reach you about the team."
- **9c·10** The coach's invite goes **at Publish**, so a coach never sees a roster the families haven't been told. A coach
  added after publishing is invited when the convenor confirms.
- **9c·11** The family's status page **names the coach**. The club's "Coaches on team pages" setting keeps governing public
  pages.
- **9c·12** Moving a child after publishing **asks first, then emails the family the new team**; both coaches' pages change at
  once.

## 0g · Owner rulings 2026-10-26, the 9d-1 drawings (all twelve as recommended, by paste-back)

Drawings: https://claude.ai/artifact/Xy8ENL1KbUZVbWpDthD9EB.
- **9d1·1** One window, two doors (option C). The Families window's face is the only composer; the door decides its Who list.
  The season's old page and Email window are deleted.
- **9d1·2** The season's door is gated by the season's email gate (the runners plus the registrar), on every season status,
  showing only that season's families. Families stays a grant and is never needed for a season.
- **9d1·3** The old sent history is shown read-only on the season's history under "Earlier sends · counted per child", saying
  where the audience wasn't recorded. Nothing is converted; the old log stays where it is and nothing writes to it again.
- **9d1·4** The season's history shows notices that go to many families at once (Publish teams now, schedule notices in 9d-2),
  one row each, tagged Automatic. One-family status emails (accepted, waitlisted, declined) stay off it; each belongs to its
  registration.
- **9d1·5** A one-family email never counts toward the season's 3, the same as the club, and has the same limit of 3 a day to
  that family. Its history row keeps the date, sender and family, never the words. Ticking two or more families counts.
- **9d1·6** The allowance follows the audience: a season picked from Families counts toward that season's 3, never the club's.
  The picker lists every season with families, whatever its status. Divisions, teams and statuses stay on the season's door.
- **9d1·7** Families › Emails is the club's book of typed sends to families and lists season sends with the season named. The
  season's page lists only its own.
- **9d1·8** The allowance is always shown: one line in the window's foot and the page's subtitle, on the club's door too. The
  refusal names the time.
- **9d1·9** "Copy the team's coaches" is offered when the audience is a team, unticked. A copied coach isn't counted as a
  family.
- **9d1·10** A stopped send's row window offers "Send to the N it missed": the same words to the families it hadn't reached,
  not counted (it is the same send). The club's Families › Emails gets it too.
- **9d1·11** A season send's footer names the season ("Sent by {club} because your family is registered in {season}.");
  Families' club sentence stays for club-wide sends.
- **9d1·12** The allowance is any 24 hours, the same rule as the club's, so one engine counts both and the refusal's time is
  exact. The words say so; /marketing settles them. (9d1·8's example sentence said "left today"; 9d1·12 governs its words.)

## 0h · Owner rulings 2026-10-27, the 9d-2 + 11b drawings (by paste-back; 13 as recommended, ask 2 the alternative; one amendment)

Drawings: https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU (version 4).

**⚖ The amendment, in the owner's words (2026-10-27), which governs 9d2·3 and 9d2·5:** *"the club needs to have a single
place to control times, they might get a permit for a diamond 5 days a week but only want to allocate 2 to house league, we
can't have the house league people allowed to click any day or time before the club allocates the time they choose to
allocate to them."* So, of the text below as pasted: a convenor's Generate games step 1 never gives a division time the club
has not allocated to house league, and a league admin does **not** change *open* time in the club's schedules (9d2·5's "open
and" is struck). **How** the club allocates to house league (to the program as a whole, or straight to each division and
team) was not ruled: it is ask **9d2·15**, open.

- **9d2·1** C: a division's schedule is a draft until Publish schedule, which emails its families once. After that, changes
  wait under Changes to send and go live and are emailed together on ✓. An urgent cancel or postpone sends at once from the
  game. No unpublish.
- **9d2·2** As recommended, but a practice change also emails that team's families. (Recommended was: games — a new date or
  time, a new place, cancelled, postponed, given a new date, added after publishing — email the families of the game's two
  teams and copy their coaches; one email per household per Send, one part per child; scores and notes don't email.)
- **9d2·3** Generate games reads the division's game time from the club's schedule (step 1 gives it some if it has none, saved
  there — **within the amendment above**) and only pairs teams: once or twice through, byes and home and away balanced, game
  length = the slot's. Blocks: not enough game time. Warns: outside the permit, a booking outside the club's schedule at the
  place, a team twice in a day, byes back to back. Saves a draft.
- **9d2·4** B: the same button and window, and the same engine with a league rule set: games per team against the plan, home
  and away, byes, slot share, twice in a day, and clashes across games and practices. Movement is dropped.
- **9d2·5** As drawn (**within the amendment above**). A slot can be given to a division as game time, or to a team as
  practice time. The convenor gives time and hands out practices from the house-league schedule (Generate games step 1;
  Practice time); the owner sees it all in the club's schedule. A club practice reads "From {schedule}" and changes only there.
  A league admin opens the club's schedules and changes only ~~open and~~ house-league time; a rep team's slot reads, with no
  controls and no "ask for it" step. A division is a sharing group. A house-league coach can't hand a practice back.
- **9d2·6** Three builds, in order. **11b**: house league in the club's schedule (game time for divisions, practice time handed
  to teams, Practice time from the house-league screen, the league admin's door, sharing groups, the coach's practice email;
  walk §L-b). **9d-2a**: List · Week · Month with games and practices, read-first windows, Generate games, health, the public
  schedule, permit links (no migration). **9d-2b**: Publish schedule, Changes to send, the family email, the history's
  Automatic rows, the coach's page (migrations; needs mig 385 on production).
- **9d2·7** The coach's team page lists the team's published games and its practices, from today on, in 9d-2b.
- **9d2·8** Publish schedule is offered only once the division's teams are published.
- **9d2·9** Before publishing, Delete. After, Cancel only; the game stays struck through and families hear.
- **9d2·10** A postponed game leaves its week for "Needs a new date" (an amber count on the admin list, words on the public
  page) and offers "Give it a new date"; it then reads Moved.
- **9d2·11** The generator lists only divisions with no published games. A published division adds games one at a time.
- **9d2·12** List · Week · Month (Week and Month on a phone), games and practices together, a Show filter (games, practices) on
  the right; a night of practices folds into one row in List. (Drawn, round 3, on the house view switch.)
- **9d2·13** The owner moves a division's game time after its games are published: the games move with the time and wait in
  the division's Changes to send; the club's Send the changes tells the league admins, and families hear once, from the
  convenor's send.
- **9d2·14** The free League plan (parked): Generate games asks when and where once and keeps only the games (no club time is
  stored); practices by hand. Decided again if the plan is unparked.
- **9d2·15 — RULED 2026-10-27: House league as a whole.** The owner's words: *"I agree with giving it to house league as a
  whole, I wouldn't expect them to ever break it out by division at the club level, that is the job of the house league
  admins/convenors."* The club gives time to the program; dividing it into division game time and team practice time is the
  convenor's job alone. Drawn the same day as frames k1–k5 on the same page. The question as asked: the owner
  or an admin gives time to **House league as a whole** (days, hours and places, from a permit), and the convenor divides it
  into division game time and team practice time; a convenor with none sees that the club hasn't given house league time yet,
  and who can; an owner or admin running the league allocates and divides in one step (Generate games step 1 stays for them).
  The alternative: the owner or an admin gives time straight to each division and team, and the convenor only pairs teams and
  hands out what each was given.
- **Deferred, not ruled (owner 2026-10-27):** whether families hear when a team is first given its practice time (raised by
  9d2·2's alternative: a practice *change* emails families, but practices are never on the public page). 11b's coach practice
  email stands as drawn. **Its home is 9d-3** (§4), with house league's calendars (the owner asked for both to be followed up).
- **11b·D — RULED 2026-10-27, as recommended** (raised by the Part 4 build): Practice time's **Practices a week** (1, 2 or 3,
  starting at 1). Every team gets the pick, or as many as the time holds when that is fewer (said in the result line); the
  rest of the division's practice time stays open, and the earliest evenings fill first. Not taken: "as many as fit" (Part
  4 as first built: 2 teams at once doubled every team's practices instead of freeing time), or the time given as the only
  control.
- **9d2·16 — RULED 2026-10-27, as recommended** ("i agree with your recommendations"; raised by drawing 9d2·15, frame k5).
  The club takes back house-league time with games or practices on it: the window names what is on it first; published games leave their week for Needs a new date
  and wait in the division's Changes to send (families hear once, from the convenor; 9d2·10, ·13); draft games come off the
  draft; until the league admin sends, families see the old dates; games already played stay; practices on it go, and their
  coaches and families hear in Send the changes (9d2·2). Unused time goes back with no
  question. (Not taken: refuse while published games are on it.)
- **Follow-up homed 2026-10-27 (owner: "did you make note to follow up on family notifications and calendar access and
  when to address that?"):** the first-practice notice and house league's calendars are **9d-3** in §4, drawn after 9d-2b
  is built and before 9e. The earlier note pointed at "the families-connection work", which had no plan; 9d-3 replaces it.
- **11b build-start rulings, 2026-10-27 (all three as recommended, plus the UX summary's yes):**
  - **11b·A** House league's time is **never billed**: house league's share appears on no bill.
  - **11b·B** A slot is held by house league **or** by rep teams, **never both**. The club's sharing rules do not name House
    league; "teams at once" inside house league's time is Practice time's. The drawn h5 is not built.
  - **11b·C** 11b puts the team's **practices** on the house-league coach's team page (upcoming, club ones reading "From
    {schedule}", hand-booked ones too). 9d-2b adds the games beside them (9d2·7's games half).
- **9d-2a build-start rulings, 2026-10-27 (all six as recommended; words in `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` "Stage 9d-2a"):**
  - **9d2a·A A Save is live, and 9d-2a releases normally.** Until 9d-2b's publish state, a saved game is on the public
    schedule at once, as on production today; the drawn "Published…" / "draft" lines are dropped and the screen says what is
    true. Not taken: holding every promote of `dev` until 9d-2b (one shared branch: it would hold Stage 12, the support
    console and bookkeeping too, and protect nothing — production's generator already publishes unannounced); hiding Generate
    behind a switch.
  - **9d2a·B The free League plan's branch in Generate stays exactly as it is** (9d2·14 parked; decided again if unparked).
  - **9d2a·C "See the permit" is in 9d-2a** (the permit id carried through to the page; `PermitWindow` opened from b4, c3, i).
  - **9d2a·D No "Moved" in 9d-2a.** A game holds one date and no history (`league_games` has no earlier date and no moved
    status), so a postponed game given its new date reads as an ordinary game in its new week. "Moved" and "Was {old date}"
    on a re-dated game come with 9d-2b's change record. A postponed game still reads "Was {its date}" (Postpone keeps it).
  - **9d2a·E "Put it back on"** for a cancelled game (today's Status dropdown could un-cancel; the read-first window keeps it).
  - **9d2a·F "Families aren't emailed."** on Postpone, Cancel and Generate's Save — true until 9d-2b rewrites those lines.
  - **9d2a·G Schedule health SAYS its rules, 2026-10-27 (step 6, as recommended).** No column holds a season's rules, so
    the window's foot states the three rules the score uses and has no "Adjust the rules" door; the door and its save
    come with 9d-2b's migrations.
  - **9d2a·H The permit line says when a permit ENDED — on every surface, one rule, 2026-10-27 (step 7, as recommended).**
    The copy file's frame-i case ("Outside the club's permit for {facility}: the permit ended {Sep 30, 2026}.") did not
    exist: the shipped rule said NOTHING once the club's permits at a venue had all ended (the drawing marked it as
    existing). Ruled into the ONE permit rule, so the coach's Where form, the club calendar, rep saves, the tournament
    generator's count and house league all say it. Not taken: house league only (a second permit rule — a coach booking
    the same field that evening would hear nothing); leaving it out (Draft Test 2027's permit warning would stay silent).

## 1 · Scope (binding, from the Club plan and the kickoff)

- The trust list re-verified (§3); the coupling check for a standalone League Plus club; the ledger seam under D1 (C18);
  venues under Stage 6's book; confirms on one-click season changes; the League Plus un-park (D11, Proposed — run
  `/strategy` to confirm when this stage opens); the old look retired in the screens this stage rebuilds.
- **Fees reach the Budget vs. Actual Statement** (owner 2026-10-21). Walk 7a step 7.6 is updated, and the stage does not
  close until the Statement and the season books agree.
- **The Stage 6c calendar recipe C1–C12**, admin and public (`TABLE_AND_LIST_STANDARD.md` C1–C13).
- **11b**, the scheduler's house-league half (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md`): a house-league writer for the club
  schedule (move, cancel), the Practices view's "From {schedule}", the club-admin role path (Walk §L-b).
- **No household money** (owner 2026-10-19): one fee per child; two children = two registrations, one payment.
- **Facilitated payments**: see `FACILITATED_PAYMENTS_SCOPING_PLAN.md` and `PLAN_PRICING_FACTS.md`. No price, rate or
  inclusion is restated here.
- The public team page is games only; practices are never public.
- **Ruled (§0, 2026-10-24):** the house-league schedule health score is the tournament's button, window and engine (Q11). The 9d-2 drawings found the engine unchanged scores the real 2026 season 97, Healthy (a cancelled game not replayed, a postponed game undated); ask 9d2·4 asks for a league rule set inside that engine, not a reopening.

## 2 · The payments contract (12b drops in without rework)

The 14 lines are in the kickoff §4 and are mapped to stages on the hub's Standing back tab (card 4). Summary of where each
lands: price per division + early bird + one resolver (9b-1, mirroring the tournament's `registrationFee` /
`fee_schedule_mode='division'` rule in `lib/registration-amount-due.ts`); real open/close dates (9b-1); price frozen on the
registration with which price applied (9b-2, Q2); capacity atomic + waitlist constraint (9b-1); paid is its own fact read
through one function, **no "payment pending" status** (9b-2); one money writer — `setLeagueFeePaid` → RPC
`club_league_fee_set`, guarded by `tests/unit/club-stage5c-families-guard.test.ts` §1 (kept, every stage); honest ending
with refunds as money out (9b-2, Q6); several children with a shared sign-up reference (9b-1, Q5); CASL consent beside the
waiver writing a `family_consents` row (9b-1); payer = the guardian, linked to the Families person, no family account
(kept); Statement filing by source, the family's processing fee never in the club's book (9b-2, Q10/Q15); ghost pay spots
on status page, emails and Families book (9b-2); "payable separately" kept until 12b.

**Not in Stage 9** (Stage 12 owns): Stripe onboarding, checkout, a payments table, webhooks, processor refunds/disputes,
payouts, tax on a fee, installments/discounts/assistance/household credit (cancelled), online-payment emails.

## 3 · Re-verified census (2026-10-24, against the code on `dev`)

**Already fixed — no fix drawn:** email injection (all seven templates escape fields — the trust plan said six); rate limits
on register and status lookup; reply-to is the convenor and the declined email uses the club's contact; unsubscribe and
suppression; the Waitlist/Pending audiences (J3-058); schedule exports' UTC dates; the cross-tenant IDs (I01,
`lib/league-season-scope.ts` + guard test); the venue library lockout for league admins (I05); the "Cancel game" misclick
(J3-051); the C18 fee seam (fees post on the paid tick through one RPC, decline/withdraw void in one transaction); the
mobile standings clip; withdrawal no longer emails "not approved".

**Corrections to the kickoff:** there are **no** browser `confirm()` calls in house league (the windows are in-page); the
real gap is one-click status changes (F05). C18 is fixed in code, but the Statement half is open (F15).

**Open, with evidence** (findings as on the hub; paths relative to the repo root):

| # | Finding | Evidence |
|---|---|---|
| F01 | Club admin reads everything, saves nothing (D8 vs hard-coded roles) | `lib/roles.ts:54-61` (D8); every write in `app/api/admin/house-league/seasons/**` checks `ctx.role !== 'owner' && ctx.role !== 'league_admin'` (16 route files); fee/status allow `LEAGUE_FEE_ROLES` (`lib/league-fee-paid.ts:27`) incl. registrar, never admin; `email` GET refuses admin |
| F02 | Overview + Ledger not in the rail; switcher never renders; no season pages on a phone | `components/admin/kit/AdminKitRail.tsx:388-397` (five rows), `:116-140` reads `d.seasons[].id` but the route returns `{ seasons: [{ season, … }] }` (`app/api/admin/house-league/seasons/route.ts:24-26`, `lib/db.ts:2960`), so the list is always empty and `seasons.length > 1` never holds; `lib/nav-tiles.ts` (no season block on the phone) |
| F03 | Seasons in creation order; no Past seasons | `lib/db.ts:2425-2431`; `lib/admin-kit-nav.ts:138-147` |
| F04 | Index and club home show one live season (newest-created) | `app/[orgSlug]/league/page.tsx:51-55`; `lib/club-site-home.ts:23-25`; `app/[orgSlug]/page.tsx:121` |
| F05 | One-click status moves | `app/[orgSlug]/admin/house-league/page.tsx` (Mark complete, Close registration); `seasons/[seasonId]/page.tsx:520-529` (Archive) |
| F06 | Old look | `scripts/lib/admin-old-look.mjs:50`; `scripts/.admin-old-look-baseline.json` (9 files); `scripts/check-public-tokens.mjs:527` |
| F07 | Create season asks slug + free-text Division; dead `auto_generate_fees`; age band not editable | `seasons/route.ts:91` stores it, nothing reads it; `divisions/[divisionId]/route.ts` PATCH takes name + capacity only |
| F08 | Dates decorative | `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts:53` (status only) |
| F09 | One child; no CASL; DOB optional | `components/league/RegisterForm.tsx` (waiver only, `:458-460` "payable separately") |
| F10 | Capacity race; waitlist count+1; approve ignores capacity; no uniqueness | `register/route.ts:120-148`; `registrations/[regId]/route.ts:213-216, 251-257`; `supabase/migrations/020_house_league.sql:107-110` (indexes only) |
| F11 | Fee read live | RPC `club_league_fee_set` posts `v_season.registration_fee` (`supabase/migrations/342_club_tournament_fee_book.sql:174-178`); `lib/families-read.ts:211` |
| F12 | Ending a paid registration voids silently | RPC `club_league_fee_end` (`342…sql:187-203`) via `voidLeagueRegistrationFee` |
| F13 | No Withdraw / bulk / fee filter; phone actions off-screen | `registrations/page.tsx:553-615`; measured: table 851 px in a 358 px scroller, actions at x=644 |
| F14 | Ledger "Outstanding" = pending entries (always $0.00) | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:101-110`; `ledger/route.ts:57` |
| F15 | Fees file nowhere | `lib/club-ledger.ts:157` (`house_league_fees` → null); `lib/club-money-figures.ts:635-640` |
| F16 | No ratings; coach is a typed name | `league_teams.coach_name`; `app/[orgSlug]/coaches/page.tsx:56-67` ("No team assignments yet") |
| F17 | Generator thin | `schedule/generate/route.ts:77-128, 153-167` |
| F18 | Admin schedule off-recipe; reader gets a greyed form | `schedule/page.tsx:141, 146, 411-473` |
| F19 | Public schedule: no place; cancelled hidden; postponed as on | `lib/db.ts:2766`; `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:49-55, 150-230` |
| F20 | No family notices; season email one-by-one, no dedupe, no cap | `email/route.ts:91-139`; batched sender `lib/family-email.ts:210` + `CLUB_EMAIL_CAP` (`lib/families-email.ts`) |
| F21 | Standings hard-coded W2/T1 | `lib/db.ts:2944`; sport pack `lib/sports.ts:125-131` unused |
| F22 | Finished season shows live tools; no copy forward | `seasons/[seasonId]/page.tsx` (Add division on a completed season); no clone route |
| F23 | Public sign-up notifies no staff; mails fire-and-forget; status lookup omits team | `registrations/route.ts:143-150` (manual add only); `register/route.ts:185`; `status-lookup/route.ts` |
| F24 | Permit not reachable from the schedule; generator one venue | `schedule/page.tsx:202`; `schedule/generate/route.ts:94-103` |

Also open from the trust plan, carried into the stages: the `':00Z'` suffix on registration open/close in two places
(`house-league/page.tsx:180-181`, `seasons/[seasonId]/page.tsx:231-232`) — 9b-1; the green "0 delivered" (9d); one
draft per season and no reserved-slug guard (9c / 9b-1); `league_email_log` has no CREATE TABLE in the migrations (trap,
check the snapshot before touching it); the org home's empty-tournaments hero (Stage 13 input).

## 4 · The ladder (dependency and rework order, never dates)

| Stage | Covers | Asks | Size |
|---|---|---|---|
| **9a** The frame and who can do what — **BUILT 2026-10-24** (§9; walk §372 ✅ 2026-10-25) | Home (Running now · Getting ready · Past seasons shelf); season block with Overview, Money, Email families and a working switcher; phone season header + tab strip inside house league's frame; two live seasons (admin, index, club home); every status change asks (rare door + window); one write gate matched to D8 + registrar/treasurer; dead fee switch removed; old look retired on home and overview | Q12 Q14 Q16 Q17 Q18 S1·b 9a·1–4 | M |
| **9b-1** Sign-up, payments-ready — **BUILT 2026-10-25** (§0d, §9; walk §375 owed) | Create reshaped (Setup = the Overview's Divisions and Registration blocks, extended); price per division + early bird, one resolver; real dates; atomic capacity + waitlist constraint; no duplicate child; approve respects capacity; several children; CASL; DOB picks division; staff notice on every public sign-up. Server and public form only — the Registrations screen is rebuilt once, in 9b-2 | Q5 S1·a S2·b | L |
| **9b-2** Money, honest — **BUILT 2026-10-25** (§0e, §9; walk §378 ✅ 2026-10-25, 51 of 51) | Frozen price (per-registration correction with a reason; Move division asks to re-price); one ending path with refunds as money out; Money band; Money stays open after Complete; Registrations on the kit (Withdraw, Move division, Release the spot, bulk, Paid/Owing filter, phone rows); the club's own payment instructions until 12b; "Ask to withdraw" on the status page; Statement filing + Walk 7a 7.6; ghost pay spots; Families balance from the frozen price. **12b drawn right after this is ruled.** | Q1 Q2 Q3 Q4 Q6 Q10 Q15 | L |
| **9c** Teams and people — **RULED 2026-10-26 · BUILT 2026-10-26** (commits in the status log; walk §381 ✅ 2026-10-26, 42 of 42) (§0f; drawings https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk, source `HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`; §9) | Ratings (convenor-only) + balanced snake draft; draft per division; coach accounts (if Q7) as a column of 9a's gate; Publish teams with placement notices; the status page shows the team | Q7 Q8 Q9 | M–L |
| **9d-1** One email composer — **split from 9d 2026-10-26 (owner)** · **DRAWN · RULED · BUILT 2026-10-26** (commits in the status log; walk §388 ✅ 10-26, 35/35) (§0g, all twelve as recommended; drawings https://claude.ai/artifact/Xy8ENL1KbUZVbWpDthD9EB, source `HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html`; build prompt `HOUSE_LEAGUE_STAGE9D1_BUILD_PROMPT.md`; §9) | The season's email onto the Families window and the batched sender (Q12b): opened from the season already set to it; division / team / status / "Selected" audiences; the season's own 3 typed sends a day, automatic notices never counted (Q12c); the season's own sent history (the registrar has no Families access); the old Notifications page and "Message registrants" window retire; the green "0 delivered" goes with them | Q12b Q12c (ruled) | M |
| **9d-2** The schedule — **split from 9d 2026-10-26 (owner)** · **DRAWN 2026-10-26 · RULED 2026-10-27** (§0h: 13 as recommended, ask 2 the alternative, the owner's amendment that house league never picks time the club has not allocated to it; 9d2·15 ruled the same day: the club gives time to House league as a whole, the convenor divides it) (with 11b, one round; drawings https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU, source `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`; round 2 the same day: the club's schedule owns every hour, Generate games is match-ups only, List · Week · Month with games and practices together; recommended order now 11b → 9d-2a → 9d-2b, ask 9d2·6; §9) | Generator rebuilt; C1–C12 admin + public; health (Q11); 11b; venue/permit links; Publish schedule + change notices (sent through 9d-1's composer path) | Q11 (ruled) | L |
| **9d-3** House league's families: practice notices and calendars — **logged 2026-10-27 (owner), not drawn** | The first practice notice to a team's families (deferred from 9d2·2: a practice *change* already emails them). A house-league team's calendar to subscribe to, for its coach and its families: Stage 6d built the feed for rep teams only, so a house-league coach or family has none. What a family's own calendar carries (the public team page stays games-only, ruled; a private family feed is the question 6d parked on its family view, which waits for counsel). | — (drawn after 9d-2b is built: it needs published games, handed-out practices and the change notices; sequenced before 9e) | M |
| **9e** Game day | Standings by sport pack; score entry (coaches if Q7); rainout as one action | — | S–M |
| **9f** Season end | Archive; the finished-season record (Q16); Start next season copies forward. Returning families with a pre-filled form wait on Stage 14 | — | M |

Changes from the kickoff's proposal (argued on the hub's Ladder tab): 9b split into 9b-1 and 9b-2; the season email moves
onto the batched sender in 9d (its change notices need it); the season Money page must be right on its own because a League
Plus club has no Statement (Q15).

## 5 · Reviews run before the hand-off (2026-10-24)

- **/ux** (flows): Complete keeps Money open; Setup lives on the Overview; a getting-ready season leads with "Open registration"; Q3/Q4 conditional on Q1, with "Release the spot"; Q2 per-registration correction + Move division; Publish teams / Publish schedule steps; payment instructions, Ask to withdraw and a staff notice for the family path; the batched sender in 9d everywhere; a coach column of the 9a gate in 9c; Q16 keeps "in place, locked" with the coaches-portal ruling's reason stated (the cost here is one gate input, not a branch per screen).
- **/design** (drawings): fit-to-width with a true-size button; 44 px phone floor; symbol-alone secondary actions; the amber pill inside tabs fixed; underline status tabs; outline icons; a full-screen phone window for D; a phone frame and whole-row links for E; tags positioned so they don't shift figures; a registrar's view showing absent controls; the role table's "no access"; the empty Getting ready group dropped; "Registration" as the one word. Three owner calls added as asks 9a·5–9a·7. Recorded on the hub's Formatting check card, not in the design log.
- The "before" captures were re-shot after one caught a dev-server restart mid-load.

## 6a · Round 2: 9b drawn, and the owner's two questions (2026-10-24)

Drawings: https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT (source `docs/projects/active/HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`;
built by `.probe/hl/build9b.mjs` from `.probe/hl/src9b/` + round 1's kit CSS and script). /ux and /design run and applied
before publish; their changes are listed on the page's asks tab.

- **Several age groups at once (owner's question) → Q19.** Recommended: one season with each age group as a division, added
  several at once by "Add age groups" (the tournament wizard's chip pattern; groups the season already has are marked; the
  club picks birth years per the 4c-2 ruling — no guess from "U13"). Separate seasons per age group would break Q5 (one
  sign-up for siblings in different age groups), and multiply Money pages, status changes and public rows. An age group on
  its own calendar is a different season, copied by 9f's Start next season. Verified: generator, standings, teams and draft
  are already per division.
- **Two ways to email families (owner's note on Q12) → Q12b + Q12c.** There are three: the season's Notifications page, the
  Registrations "Message registrants" window (same send path), and Families › Email families (Stage 7c, `lib/families-email.ts`
  batched, one per household, `CLUB_EMAIL_CAP` = 3 club-wide/day, Families › Emails log). Recommended: one composer, the
  Families window, opened from the season already set to it; division/team/status/"Selected" audiences added in 9d; the old
  page and window retire; the season shows its own sent history (the registrar has no Families access:
  `lib/roles.ts:73-75`). Cap (Q12c): automatic notices never count; each season gets its own 3 typed sends a day. Rulings
  cited: design_decisions "one club send" (10-11, deferred not rejected), E6 (chat pause), 7c "not in scope".
- **New asks:** Q19 · Q12b · Q12c · S2·b (still open) · 9b·1 required before Open registration · 9b·2 early-bird date ·
  9b·4 a birth year no division fits · 9b·5 two children, one waitlisted · 9b·7 bulk actions · 9b·8 owing turns amber ·
  9b·9 how-to-pay text (required when a price > $0) · 9b·10 Money band (re-recommended: Owed · Received net · Still owing) ·
  9b·11 which fiscal year carries a season's budget · 9b·12 "Accepted" as the family word · 9b·13 two divisions for one age.
- **Build notes the reviews surfaced (not asks):**
  - Q17's "treasurer reads Money" needs the Money page opened to `module_accounting`; the treasurer has no house-league
    capability (`lib/roles.ts:76-79`).
  - "Owing N days" counts from acceptance, which nothing records today; 9b-2 adds an accepted-at fact.
  - A correction or a division move on a paid registration must settle the difference (refund or still owing), because the
    fee writer is a paid/unpaid tick today.
  - A refund after a fiscal year closes files in the year it is paid out.
  - A hand-added child is not linked to the guardian's person (Ava Kim, `person_id` null); 9b-1 links it.
  - 12b needs a "no longer payable" page for pay links on ended registrations.
  - The fixture's 9 pre-writer paid ticks need backfilling into the season book before the Money page is honest on it.
  - The form keeps "payable separately" (contract line 14); the club's own how-to-pay text appears after acceptance.

## 6 · Asks (round 1, ruled in §0 except S2·b)

Payments boundary: Q1 when a family pays · Q2 when the price is frozen (and early bird's date) · Q3 does an accepted unpaid
registration hold its spot · Q4 pay-later link on promotion · Q5 several children in one sign-up · Q6 refund on ending ·
Q10 Statement shape and budget side · Q15 League Plus without accounting.
Scope: Q7 coaches as people · Q8 evaluations · Q9 volunteers · Q11 health score vs clash box · Q12 the composer's name ·
Q14 two live seasons · Q16 a finished season · Q17 who may do what · Q18 the money page's name · S1·a Create season ·
S1·b the dead fee switch · S2·b dates run the form · 9a·1 home shape · 9a·2 season block · 9a·3 phone navigation ·
9a·4 status changes · 9a·5 Approve as the only phone primary · 9a·6 section headings · 9a·7 a season twice on the club home.

## 7 · Fixture (dev only)

`dev-league-org` (League plan), owner `league-owner@dev.local` / `devpass123` (sign-in does not reset passwords). Extended
2026-10-24 through the app's own routes where one exists (`.probe/hl/extend.mjs`, idempotent): 2026 Division B capacity
14; 2027 U10 Division B capacity 10; 2027 "U12 Division" capacity 16, born 2015–2016; Henry Kim marked paid (a real season
book line); Ethan Brown marked paid then declined (shows F12; the decline auto-promoted Zoe Leblanc); Ava Kim added under
Henry's guardian (two children); venue "Maple Grove Park" with Diamond 1 and 2 and permit "Maple Grove diamonds 2026"
(service role, no app path); all 2026 games linked to the venue; one game cancelled. Fixture artifacts: game times read
6:00 a.m. (seeded at 10:00 UTC), and 9 of 10 paid ticks in 2026 predate the fee writer and have no book line.
Added 2026-10-24 for the 9a walk (`.probe/hl/roles9a.mjs`, idempotent, creates new accounts only and never resets a
password): `league-clubadmin@dev.local` (admin), `league-registrar@dev.local` (league_registrar), `league-treasurer@dev.local`
(treasurer), all `devpass123`. ⚠ The League plan carries no Accounting, so this club's treasurer reads no Money (the
gate's rule); a treasurer's Money read needs a Club-plan club.

## 8 · Stage 13 inputs (found outside house league's block; not drawn here)

The League-plan phone bar (Overview · Calendar · House league · Families · More); "Notifications" meaning three things;
the org home's empty-tournaments hero for a league-only club. **From the 9a build:** a treasurer (Accounting only) has no
menu door to a season's Money — the gate opens Money to them (Q17) but the menu lists House league only for people who
open it, and the menu's top level is Stage 13's.

## 9 · Status log

- 2026-10-24 — deep dive walked (12 stations, desk + phone), ladder proposed, 9a drawn, /ux and /design applied; published https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7; Club index row s9 → in-progress (log 2026-10-24-01); 24 asks open.
- 2026-10-24 — owner ruled 26 of 27 (§0), committed fa1528058; round 2 (9b + the two questions) drawn, /ux and /design
  applied, published https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT; 15 asks open.
- 2026-10-24 — 9a build prompt written (`HOUSE_LEAGUE_STAGE9A_BUILD_PROMPT.md`; recommends the Email families switch-over move to 9d with Q12c) and the Stage 12 kickoff prompt (`CLUB_TIER_STAGE12_KICKOFF_PROMPT.md`; 12a + 12b drawn together, 12c beside).
- 2026-10-24 — **9a BUILT**, dev only, four rulings in §0c. Commits: `29b1618c3` Part 1 the one gate
  (`lib/house-league-access.ts` + `lib/house-league-gate.ts`, every route, the two backward status steps, reviewed in three
  lenses) · `0f6ac568f` the words (`HOUSE_LEAGUE_STAGE9A_COPY.md`) · `53184dbf5` Part 2 the season frame (rail block +
  switcher, phone header + strip, Money at /money, Email families) · `eb3aff61b` Part 3 the home · `d0180b8e2` Part 4 the
  season page and the status windows · `52dffe9eb` Part 5 every live season public · `313d736b0` fixes from `/review` on
  the whole (three lenses, no Critical/High) · `b7944619b` help. Part 6: the rename only, as ruled. Guards:
  `house-league-gate-guard`, `-season-frame`, `-home`, `-season-page`, `-public-seasons`. Walk: §372,
  https://claude.ai/artifact/M3mkiar1SGya4jifLbQJjh.
  **Not run:** `check:layout` — the UAT club the sweep uses now forwards to its own web address (another session's 4e
  live-run), so every fixture page leaves the dev server; a per-role probe (`.probe/hl/gate9a.mjs`) checked the matrix
  against the server instead. The layout baseline is unrefreshed for the rebuilt screens until it runs.
  **Left open:** the Registrations screen's old buttons and windows (9b-2 rebuilds it); the club site's team bands and the
  editor's House league line still name one live season (`runningLeagueSeason` in `lib/club-public-teams.ts`,
  `lib/public-site-editor-facts.ts`); the record blocks' checkboxes read the saved value until the re-read lands;
  `house-league.module.css` stays on the colour-debt list (the sub-pages still use it). Promote note: Part 1 locks finished
  seasons, and Part 4 brings their reopen door, so the two promote together (they do, as one branch).
- 2026-10-25 — 9a walk §372 came back clean (W11's second check called unneeded by the owner); 9a follow-ups committed (a season no
  longer carries a free-text division, mig 360 on dev with its prod drop held; the club home's Open now drops the fee). **9b-1 build
  prompt written** (`HOUSE_LEAGUE_STAGE9B1_BUILD_PROMPT.md`; code leads re-verified: capacity counts active only so a review-first
  season never fills, staff approve never checks capacity, the fee RPC posts the season fee only, no staff notice on a public
  sign-up; two ruled states (9b·4, 9b·13) were never drawn and need copy; the §6a note that 9b-1 links a hand-added child to its
  person is probably wrong, since linking is lazy by design).
- 2026-10-25 — **9b-1 BUILT** (dev; owner rulings §0d). Committed `395d5fe67` (Part 1: the price recorded at sign-up,
  one rule in `lib/league-price.ts`, mig 361, every money reader) · `920a44b33` (Part 3: a spot is taken once — sign-up,
  approve, waitlist, division moves and promotion in one locked database step, mig 362; nobody jumps the waitlist; the same
  child once a season; race-tested on dev with `scripts/house-league-signup-race.mjs`; /review four lenses, findings fixed)
  · `d792bc004` (Part 2: three-answer Create, Add age groups, a division's record in place, the Registration block, the
  checklist enforced on the server) · `9796f3418` (Part 4: the dates run the form, `lib/league-registration-state.ts`, mig
  363 remembers when the convenor closed it; Reopen until…; a season its date closed can start) · `965d34919` (Parts 5–6:
  several children in one sign-up with each outcome shown first, the no-division-fits and two-divisions states, one email
  per sign-up, one Needs attention notice, the email-consent row, the status page by reference). Words
  `HOUSE_LEAGUE_STAGE9B1_COPY.md` (/marketing). Findings that changed the plan: the hand-added child IS linked to its person
  (Families attaches by email when it loads; checked on dev — the §6a note was wrong, nothing added); the prompt's "resolve
  the price from today's prices" would have repriced earlier families (ruled §0d). Left for 9b-2 as drawn: moving a child to
  another division now respects room and the waitlist but keeps its price (re-pricing is 9b-2's). Migrations 361 and 362
  are prod-pending in `MANUAL_PROD_STEPS.json` and MUST precede the promote (the code calls 362's functions); 363 is a column.

- **2026-10-25 — 9b-2 BUILT (Money, honest).** From `HOUSE_LEAGUE_STAGE9B2_BUILD_PROMPT.md`; the owner ruled the build
  session's seven asks and the words' four open questions as recommended (§0e). Commits: `ecbca10f5` (Parts 1–2 server:
  ONE money writer `club_league_money` — receive with an amount, a day and a method; refund as its own line out; undo; price
  with a reason — and `league_registration_close`, an ending that asks about money, mig 368; the old call shapes route
  through it; the accepted-at trigger; a one-time catch-up for paid ticks with no line) · `1d770f13e` (/review: an
  ending's money answer reached the money branch and could never run; Undo names its payment; mig 369) · `549948077`
  (Parts 3, 4, 6: Registrations rebuilt on the kit with the money on every row, bulk and partial results, the record window,
  the owing threshold on the Registration block; the season's Money page as its book and the Overview's Owed / Still owing;
  Families reads the book; the status page reads the book and carries "Ask to withdraw a child" with a Needs-attention
  notice that clears itself, mig 370) · `fec381566` (Part 5: real budget words per season — the hosted-tournament
  precedent — stamped on every house-league line, refunds netting the fees row and the band's Collected, a starting budget
  of size × price planned once when registration opens, mig 371; walk 7a step 7.6 updated) · `1869e3b53` (/review of
  the whole: a deadlock between a payment and an ending fixed with advisory locks, the Mark received window's crash after
  a refusal, the opening date read as typed, mig 372; /docs help guides). Proven on dev: `scripts/house-league-money-check.sql`
  18/18, `check:club-money-atomicity`, `check-club-money-arithmetic`. Migrations 368–372 are prod-pending in
  `MANUAL_PROD_STEPS.json` and MUST follow 361–363 at the promote. **12b is unblocked:** the writer's signature is
  `writeLeagueMoney(ctx, { seasonId, regId }, { kind: 'receive', day, method: 'online_card', amount })`. Findings that
  changed the plan: approving from To review never meets a full division (a child in review holds a spot — the refusal
  lives on Promote, revive and move); the split of a season's budget needs no new editor (a line in another year under the
  same word on the Budget page); the Statement's word is a real budget word, not a synthetic row (the split, the Budgeted
  door and the plan checks come free). Known gaps: a child holding a spot can't move into a FULL division to join its
  waitlist; the Statement's season sub-row has no link to Money; `check:layout` could not measure (the UAT club's admin
  pages render "Page not found" in its browser session). Walk §378.

- **2026-10-25 — 9c DRAWN, asks open (Teams and people).** From `HOUSE_LEAGUE_STAGE9C_DRAWING_PROMPT.md`. Drawings
  https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk (source `HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`, built by
  `.probe/hl/build9c.mjs` from `.probe/hl/src9c/`; captures by `.probe/hl/cap9c.mjs`). Frames (a)–(i) drawn at desk and
  phone; /ux and /design ran and their changes are listed on the page's asks tab. **Push-backs on the page:** (1) a
  house-league coach gets a team page of its own, not the Coaches Portal (a `coach` member today lands on the portal's
  "No team assignments yet", or on nothing without an active subscription; the volunteer-official card is the precedent);
  (2) Q8 "convenor-only" vs Q17 "registrar reads the rest" collide on ratings — recommended absent for the registrar;
  ratings erased at season end; a 1–5 number with no comment box; (3) the balanced draft ignores the coach's own child —
  "lock a child before the draft" put as an ask, not drawn; (4) placement notices go through the existing batched sender
  (`lib/family-email.ts`, built in 7c) in 9c — they need not wait for 9d, and never count toward a cap (Q12c). **Asks
  9c·1–12** (2 split a/b/c; 14 boxes), all with recommendations. **Findings that change the plan:** T01 today's draft is a
  rotation, not a snake (`draft/route.ts` `advance`); T02 already-placed children re-enter the draft list after the first
  pick (start filters `teamId`, `getRemainingPlayers` does not); T08 an ended registration keeps its `team_id` (fixture:
  Avery Macdonald, declined, still on the Cardinals); T09 a received (to-review) child holds a spot but is invisible on
  Teams; the draft lives on `league_seasons.draft_state`, so one division at a time. **Build notes, not asks:** seasons
  whose teams pre-date 9c count as published with no emails; confirm the batched sender's suppression list does not drop a
  service message to a family who unsubscribed from club news; the season phone header is drawn in the body face (D1).

- **2026-10-26 — 9c RULED; words and build prompt written.** The owner ruled all fourteen 9c asks as recommended (§0f, by
  paste-back). `/marketing` wrote `HOUSE_LEAGUE_STAGE9C_COPY.md`: staff counts say "players", families "child"; the Publish
  foot no longer mentions a daily cap (it arrives with 9d); the coach page's Schedule slot links to the season's public
  schedule and Scores says "The club enters scores for now"; the coach invite mirrors the rep invite (7-day link); lock words
  added (9c·3, ruled, not drawn). Two open word questions (§15: warn or block when publishing with unplaced players; no "the"
  before a team name in templates) go to the owner in the build's UX-summary step. Build prompt:
  `HOUSE_LEAGUE_STAGE9C_BUILD_PROMPT.md` (seven parts; argues the coach link as its own table separate from the club role,
  ratings in their own table so no registrar read leaks one, the draft as a tested pure function with locks, Publish as a fact
  before an email, and the published-at backfill for seasons already on teams).

- **2026-10-26 — 9c BUILT and committed** (`6405c1d66` (data + gate, mig 377) · `c4a4080de` (draft, screen, publish, mig 378) · `f34507180` (coach's door) · `1670dbe7d` (family side) · `758f4036b` (review fixes, mig 379) · `b2123aad5` (help)). Build-session rulings (owner, 2026-10-25, recorded as ruled): the
  batched sender gains a SERVICE mode for the placement and move emails (they reach a family who unsubscribed from club news;
  no unsubscribe link; the club's footnote says why); no bounced line (the product cannot see a bounce); unplaced players at
  Publish warn, never block; no "the" before a team name. Built as argued: a team–coach row (`league_team_coaches`) is the
  coach's access truth and accepting creates NO club membership (a `coach` member would get a Coaches Portal card); its own
  token on the row, hashed as the rep invite's (the rep invite table's team is a NOT NULL FK to rep teams); ratings in their
  own table, erased by the season-finish trigger (and, from the review, when a registration ends); the draft a tested pure
  function (sizes first: a team skips its turn while bigger than the smallest); Publish one transaction then the send, each
  family's email a row with its outcome and a claim against double-sends; the backfill marked every division already on teams
  published with no email and took ended children off their teams. Found while building and fixed: the registration's own
  save could change a team silently after publishing; "Email a team" could email a draft team before Publish. Migrations
  377–379 (dev, prod-pending; 377 renumbered from 376, a peer took 376). /review (high-risk, 5 lenses) fixed in `758f4036b`;
  recorded, not fixed: a coach keeps their page while the club is suspended; a timed-out provider batch could be resent; an
  unsendable address stays failed; an unverified guardian email gets service notices it can't suppress; the board JSON
  carries lock/move flags the registrar's screen hides; a twice-moved child's unsent move email names the latest team.
  Walk §381 owed (https://claude.ai/artifact/KbRNQVwYV4tzbp5xTMaTHh); `check:layout` on Teams & draft not run (UAT fixture
  stale for every house-league screen).

- **2026-10-26 — 9c WALKED, §381 ✅ 42 of 42, no defects** (owner paste-back). Three owner asks were fixed during the walk
  and committed before the pass: `301860bd9` (rating window spacing, "Add a coach" before the first, one-team default after
  the first set, trash can on an empty team's card), `1810c081d` (a card's pencil opens the team in edit; a coach is added
  with first and last name that pre-fill the invite's sign-up; the moved tag under the player's facts), `1807c1800` (a
  mistyped coach's first name, last name and email are editable). The five /review items named for the owner above stand,
  unruled. **9c is closed.**
- **2026-10-26 — 9d SPLIT into 9d-1 and 9d-2 (owner).** 9d as written held more than 9b did when 9b was split. 9d-1 is the
  one email composer (Q12b/Q12c, already ruled; it is also what 9d-2's change notices are sent through), 9d-2 the schedule.
  9d-1 drawing prompt written: `HOUSE_LEAGUE_STAGE9D1_DRAWING_PROMPT.md`.
- **2026-10-26 — 9d-1 DRAWN, asks open (one email composer).** From `HOUSE_LEAGUE_STAGE9D1_DRAWING_PROMPT.md`. Drawings
  https://claude.ai/artifact/Xy8ENL1KbUZVbWpDthD9EB (source `HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html`, built by
  `.probe/hl/build9d1.mjs` from `.probe/hl/src9d1/`; captures by `.probe/hl/cap9d1.mjs`; republish the BUILT
  `.probe/hl/house-league-9d1.html`). Frames (a)–(i) at desk and phone; /ux and /design ran and their changes are listed
  on the page's asks tab. **Push-backs on the page:** (1) "the Families window" is the wrong noun: the season's own Email
  window already has every ruled audience; what it lacks is the engine. Recommended one window, two doors: the Families
  window's face, its Who list set by the door; (2) Families is a grant for every role, so the season's door is gated by the
  season's email gate and reaches every status (the Families season audience reaches open/playing only, so Draft Test 2027
  in Registration closed, 101 families, is unreachable from Families today); (3) one record, two views: the season's
  history lists its own sends, Families › Emails lists all; the old log shown read-only under "Earlier sends", nothing
  converted; (4) show only the allowance that applies; a one-family message doesn't count, matching the club's 2026-10-22
  ruling. **Asks 9d1·1–12**, all with recommendations (composer shape · the season door's gate · old history · which
  automatic notices the history shows · one-family counts · a season picked from Families · season sends on Families ›
  Emails · when the allowance shows · copy a team's coaches · finish a stopped send · the footer names the season ·
  calendar day vs any 24 hours). **Census corrections (re-verified 2026-10-26):** the season route already honours the
  unsubscribe list and adds the unsubscribe link (the gap is per-child sends, no batches, no lock, no limit); "By team" lists
  every team and refuses an unpublished one only after Send (409), and counts declined/withdrawn children; the season
  window's "guardians" count is registrations (2026: 11 children, 10 families); the club's one-minute double-press guard
  is club-wide; the old log keeps no body and no division/team (the bare scope word), "skipped" mixes three reasons, and
  the dev fixture has no rows (count production at build). **Build notes on the page:** the claim function must count by
  season (a migration) and the double-press guard by audience; the season audience can't reuse `isCurrentLeagueSeason`;
  retire the rail page, the Registrations Email window, the per-child loop and its writes to `league_email_log`; 9d-2's
  notices call the engine as automatic; 9c's placement rows need a per-Publish record for the history; the Families
  window's audience list becomes a door input.
- **2026-10-26 — 9d-1 RULED; build prompt written.** The owner ruled all twelve 9d-1 asks as recommended (§0g, by paste-back).
  9d1·12 (any 24 hours) governs the allowance's words over 9d1·8's example sentence ("left today"). Build prompt
  `HOUSE_LEAGUE_STAGE9D1_BUILD_PROMPT.md` (six parts; the words through /marketing before code, into
  `HOUSE_LEAGUE_STAGE9D1_COPY.md`). Three gaps the drawings didn't show, argued in the prompt: "Send to the N it missed" needs a
  per-family outcome that nothing records today (`family_email_sends` keeps counts only); a Publish has no record of itself as
  one act (`league_placement_emails` is one row per family, a late placement the same kind), so the Automatic rows need a season
  notices record that 9d-2 will also write; `family_messages` has no season, so the season's one-family rows need one. The
  season audience needs each child's status, division and team, which the Families world doesn't carry today.
- **2026-10-26 — 9d-1 BUILT, committed in six parts** (`65d637854` data · `7135e8875` engine · `0a197222f` window ·
  `7210e5948` Registrations' doors · `7f36efa5b` history and Families › Emails · `b62d54281` help · `510fd3137` test).
  **The build session's ruling (owner):** a season's "everyone" is families with an ACTIVE child from both doors (the Families
  season choice used to reach to-review and waitlisted children too). **Mig 385** (dev; prod pending): the claim counts and
  guards by bucket (a season's own 3, the club's 3); `family_email_recipients` (people and last name, never addresses);
  `league_season_notices` written by `league_division_publish` in its transaction; `family_messages.season_id`.
  **Built as argued:** the season audience reads each person's season rows of every status beside Families' household rule;
  one send (`deliverFamilyEmail`) for both doors; one household goes through the household door (`messageOneFamily`, moved
  out of the Families route); the season's door is the season's email right, never the Families grant. **Retired:** the rail's
  old composer page, the Registrations Email window, the per-child route and every write to `league_email_log` (read only for
  "Earlier emails"; dev and prod held 0 rows on 2026-10-26). **Found and recorded:** the admin header has no subtitle (F3), so
  the allowance is the page's first line; the drawn footnote overclaimed (a status email isn't shown on the registration); the
  old help said the season log held approvals and waitlist notices, which it never did; Families' 7c email had no help section
  (added). **Walked 2026-10-26, §388 35/35, no changes asked.** **Owed:** mig 385 at the promote that ships
  9d-1; /review on the whole.
- **2026-10-26 — 9d-2 and 11b DRAWN together, asks open (the schedule, and house league's share of the club's time).**
  From `HOUSE_LEAGUE_STAGE9D2_DRAWING_PROMPT.md` (owner: one drawing round, build 9d-2 first, then 11b). Drawings
  https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU (source `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html`, built by `.probe/hl/build9d2.mjs` from `.probe/hl/src9d2/`;
  captures by `.probe/hl/cap9d2.mjs` and `cap9d2b.mjs`; republish the BUILT `.probe/hl/house-league-9d2.html`). Frames
  (a)–(k) at desk and phone, 11b's included; /ux and /design ran and their changes are listed on the page's asks tab.
  **Push-backs on the page:** (1) "Publish schedule" was defined nowhere; recommended C: a division's schedule is a draft
  until Publish (one email per family), then changes wait under "Changes to send" and go live and are emailed together on
  ✓ (the club scheduler's "Send the changes" precedent), an urgent cancel sends at once, no unpublish. (2) 11b drawn on the
  same screen now, built after; 9d-2 recommended as two builds (9d-2a screen/generator/health/public, no migration;
  9d-2b publish/notices/coach page, needs mig 385 on prod). (3) The tournament engine run unchanged on Dev House League
  2026 returns 97, Healthy, no issues (`.probe/hl/h9d2.mts`); recommended the same button, window and engine with a
  league rule set. (4) Change notices: the game's two teams' families + coaches, one email per household per Send;
  practice changes reach coaches only (Ask 6, "nothing for families yet"). (5) The generator blocks on a checked-surface
  clash, a team double-booked, or too few slots; everything else warns (the permit rule unchanged).
  **Asks 9d2·1–11** (publish, notices, generator, health, 11b design, the split, the coach's page lists games and
  practices, teams before schedule, no delete after publish, postponed needs a date, generator only on unpublished
  divisions). **Census corrections:** the public query that drops cancelled games is `getGamesForSeason` at
  `lib/db.ts` ~:2711 (not :2766); §3's "Optional, unruled" Q11 line was stale (fixed above); the club plan's "Not
  ruled" on the health option is stale (noted there); the coach's team page says "Your games aren't listed on this
  page yet"; `isScheduleBuilder` admits owner and admin only, so a league admin is refused today although Stage 11
  Ask 3 rules otherwise (11b's role path). **Fixture notes:** dev games are stored at 10:00 UTC (6:00 a.m. Eastern),
  a seed artefact; Draft Test 2027 (one U12 division, 10 teams, 101 families, teams published 10-26) is the real
  generator case; the club's only permit ended 2026-09-30. **Next:** the owner rules the eleven asks, then /marketing
  on the words, then the 9d-2a build prompt.
- **2026-10-26 — 9d-2 + 11b drawings ROUND 2 (owner's questions), republished to the same link (version 2).** The owner
  asked why the generator can't make practices, why games and practices are a toggle, why no Month, and whether two
  generators duplicate. Answered on the page: round 1's generator had its own days/times/diamonds table, **a second
  model of the club's time, which Stage 11 forbids** (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §5.1), and the convenor would
  type the same hours twice. **Redrawn:** the club's schedule owns every hour: it gives a division **game time** and its
  teams **practice time** (practices are generated there, by the tool that already makes them); **Generate games** only
  pairs teams into the division's game time (step 1 gives a division time if it has none, saved into the club's
  schedule); **Practice time** hands a division's practice time to its teams from the house-league screen; the views are
  **List · Week · Month**, games and practices together, a Show filter on the right (as the club calendar and the
  coach's schedule). **Consequences:** the build order flips to **11b → 9d-2a → 9d-2b** (Generate games reads the time
  11b gives); `league_games` needs the same slot link as `league_practices`; a slot can go to a division (game time) or a
  team (practice time); moving a division's game time moves its games into the convenor's Changes to send (ask 9d2·13).
  **New asks:** 9d2·12 the views, 9d2·13 the owner's game-time move, 9d2·14 the parked free League plan (house league with
  no club's schedule: ask when and where once, keep only the games). Asks 3, 5, 6 rewritten. Asks now 14, all open.
- **2026-10-27 — 9d-2 drawings ROUND 3 (owner: "we do not toggle the list/week/month view with pills"), version 3.**
  Rounds 1 and 2 drew the views as separate rounded pills with a dark fill (the round-1 /design pass). Redrawn to the
  house switch every calendar renders (`CalendarViewSwitch` → the kit's `ViewSwitch`, §289): one white rounded track on
  the strong line, the chosen view soft olive, leading the toolbar line with the dates after it; on a phone the current
  view's glyph in the toolbar row opens a drawer titled View (Week · Month). Show is a quiet `MultiSelectDropdown`
  (its name alone at rest, as the club calendar's Venue · Program · Team); the generator's Once / Twice is a dropdown
  field. **Build note:** 9d-2a renders `CalendarViewSwitch` and the phone `CoachToolbarMenu` view drawer, never its own.
- **2026-10-27 — 9d-2 + 11b RULED by paste-back (§0h).** Thirteen as recommended; 9d2·2 took the alternative (a practice
  change also emails that team's families). The owner added a rule with the paste: the club has one place to control time,
  and house league never picks a day or time before the club allocates it (a 5-day permit, 2 days given to house league). That
  narrows 9d2·3's step 1 and strikes "open" from 9d2·5's league-admin line. It opens **9d2·15**: how the club allocates time to
  house league (recommended: to House league as a whole, the convenor divides it). **Next:** draw the allocation step
  (9d2·15), then /marketing on the words, then the 11b build prompt. Permits' place in the navigation went to Stage 13 (the
  readiness plan).
- **2026-10-27 — 9d2·15 RULED (House league as a whole) and drawn.** The club never divides house league's time by division;
  that is the convenor's job. Frames k1–k5 added on the same page (the owner gives House league time in the club's
  Schedules; the convenor's House league's time window divides it; Generate games step 1 picks from it; the empty state; the
  owner who runs the league; k5 the club taking time back, **ask 9d2·16 open**). The drawing also corrects h4 to 9d2·2 (a
  practice change reaches that team's families) and the gate table (giving or taking house league's time is owner and admin
  only; dividing it is the league admin's too). The first-practice family notice is deferred to the families-connection work. **Next:**
  /marketing on the words, then the 11b build prompt.
- **2026-10-27 — 9d2·16 RULED as recommended; 9d-3 logged.** All sixteen 9d-2 asks are ruled. The owner asked where family
  notifications and calendar access are followed up: they had no real home (the note said "the families-connection work",
  which has no plan). Logged as **9d-3** in §4 (the first practice notice, a house-league team's calendar for its coach and
  families, what a family's own calendar carries), drawn after 9d-2b and before 9e. **Next:** /marketing on the words, then
  the 11b build prompt.
- **2026-10-27 — 11b's words settled by /marketing:** `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` (the build cites it; it wins over
  the drawings). One shipped word changes for rep teams too: a slot's "Change team" becomes **Give it to**, because the list
  now holds House league. Sentences say **facility**, never a sport's name for one; screens say **league admin**. The
  house-league coach's practice-change email takes the rep coach's shape ("{schedule}: {team}'s practices changed"); the
  families' practice-change email is new and stands on its own (no link: no family page shows practices).
- **2026-10-27 — 11b build prompt written:** `CLUB_TIER_STAGE11B_BUILD_PROMPT.md` (leads from a helper census, the three
  load-bearing ones re-read by hand: the slot holder is a rep team in the database floor, mig 326; `resolveScheduler` says
  "11b — not here"; `league_practices` / `league_games` have no slot link; highest migration 390). Eight arguments before
  code, among them: house league as its own holder table, never a fake team; the league admin's division uses on their own
  table, owned by a season; **house league not billed** (not asked: the owner's yes in the UX summary); **League Plus becomes
  schedulable**; and **frame h5 contradicts 9d2·15** (it lets the club pair a division with a rep team): the prompt says not to
  build it, the club's sharing rules name House league as one party.
- **2026-10-27 · 11b Parts 1–2 built and reviewed** (build prompt `CLUB_TIER_STAGE11B_BUILD_PROMPT.md`; rulings 11b·A–C in
  §0h). Committed `076d4551d` (Part 1, mig 392: the program holder, `league_slot_uses`, `league_practice_time`,
  `league_practices.club_schedule_slot_id`, the league admin's two SQL steps), `ac5d68c5e` (Part 2: House league as a holder in
  New schedule and a slot's Give it to; all of it = no drafts, saved and finalized in one request; never billed; League Plus
  schedules), `d60c30d3a` (the /review of both, mig 393: a use waits for Send the changes; rep teams stay closed to a member who
  can't open them; house league offered only while a season runs). Migs 392 + 393 applied to DEV 2026-10-27, prod pending in
  `MANUAL_PROD_STEPS.json`; `scripts/club-stage11b-check.sql` passes T1–T11. **Owed to Part 5 (recorded by the review):** house
  league's half of Send the changes in the app (`p_league` — no practice can exist before Part 4, and until it lands a send
  over a taken slot with practices to come refuses `changed`); the take-back question also on Clear this week, a drag and
  Regenerate. **Recorded, not built:** Fair shares' measures and the .ics export read house league as a team; a give-it-all
  whose send is refused lands on the draft without a sentence. **Next: Part 3** (House league's time, the league admin's door).
- **2026-10-27 · 11b Part 3: drawn, RULED, first half built** (continuation prompt `CLUB_TIER_STAGE11B_PART3_PROMPT.md`).
  The owner ruled three forks before building: the undrawn parts are **drawn first**; the league admin's view of the club's
  schedule is **built second, after its drawing**; k4's empty states are **adapted** to House league's time (they were drawn
  for Generate games). Drawings `HOUSE_LEAGUE_STAGE11B_PART3_DRAWINGS.html`, https://claude.ai/artifact/C7ZbiDmmcxFgKUBte3qrDe
  (v3; /design + /ux + /marketing ran on v1). **RULED "all recommendations" (owner 2026-10-27), the decisions tab's 11 cards:**
  (1) a division's piece saves with **one Save** (ticks stage; no autosave per tick); (2) the piece is the **one editor**, a
  LEVEL inside House league's time with "← House league's time"; Give it to still gives a whole row in one pick and gains
  **Choose parts…** (asks division + kind in one small step, then opens that piece with nothing new ticked) — Option B not
  built; (3) **group ticks** per weekday and per stretch, tri-state; (4) a **mixed part** reads "8 of 12 dates" with a half
  tick; (5) a part another division holds has **no box**, its holder a link to that piece; (6) giving back time with practices
  still to come **asks first, in red**, names the teams, never promises a notice (Part 5 tells them); (7) Export inside Tools
  (already ruled in 9d-2); (8) the **time line shows only** when the club has house-league time in a final schedule or the
  viewer builds Schedules; (9) **hours only** until a length exists (amends the copy file's "hours · count"); (10) the empty
  states as corrected (an owner/admin whose club gave nothing: "The club hasn't given house league any time yet." + lime "Give
  house league time"; "no time left" + "Give house league more time" only when all is divided); (11) the league admin's
  club-schedule view: rep team names never reach them ("A rep team"), a one-date **Use** saving on the spot, no bill / asks /
  replies / send history, no rail entry. Open points taken as drawn: Save fades until a change. **Owner 2026-10-27, the
  toolbar:** Part 3 adds **only Tools and the time line** to the house-league Schedule page; the views (List · Week · Month,
  Week · Month on a phone), the Show filter and the phone's symbol buttons come with **9d-2a's** toolbar rebuild, as 9d2·12
  ruled — never built twice. **First half committed `cd5d32472`:** the read and the give (`from` required — a give over
  time someone else changed refuses `changed`), the k2 window with the corrected empty states, the route gated
  read / run-on-the-season, 14 tests. **Next:** `CLUB_TIER_STAGE11B_PART3_BUILD_PROMPT.md` (the second half: one atomic Save
  as a new SQL step, the piece level, Choose parts, Tools + the time line, then the league admin's club-schedule view).
- **2026-10-27 · 11b Part 3: second half BUILT, words settled, /review done** (prompt `CLUB_TIER_STAGE11B_PART3_BUILD_PROMPT.md`).
  Commits: `9e3b703d2` (mig 394 `league_slot_uses_apply` — every change of a Save or none, `from` checked under the lock;
  `league_slot_uses_set` KEPT unchanged for the SQL checks, the window writes only through the new step) · `89d10dbab` (the
  piece level, Choose parts, Tools ⋯ with Export inside and its free-floor case, the time line, `?time=1`) · `c639761a1`
  (the league admin in the club's schedule: a new read route answering an allow-list projection, never `scheduleView`;
  rep team names only for a viewer who can open Rep teams; the one-date Use) · `34c2952cf` (/marketing's words, appended to
  `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` "Part 3"; the k2 row-figures row amended per ruling 9) · `ef76f6cdc` (/review, mig 397:
  a Save waits out Send the changes by locking the schedules first, the season held, both keys required, no-ops change
  nothing; group-scoped rep names; stale ticks pruned; the week grid follows the answered week). **Migs 394 + 397 applied to
  DEV only**; both pending for prod in `MANUAL_PROD_STEPS.json`, before the promote that ships 11b. **Found and fixed in the
  words pass:** the free League floor's export lock named "League" (the free plan) — exports are League Plus's; fixed on the
  Schedule page and the Registrations badge. **Builder's calls:** the question on Save shows only when practices still to
  come sit on the time (none exist until Part 4; tested with fixtures); Cancel and Back drop a piece's ticks, × asks first;
  a phone reads the club's schedule as a list of days, Use is desk-only. **Recorded, not changed (/review Low):** the club's
  schedule is readable by URL for any final schedule house league holds a slot in (wider than the listed sources, no leak);
  rep slots' times and places show by ruling; the season-date check is TypeScript's (club days need the club's zone);
  Tools' trigger sits outside `tb.toolbar` (a visual check owed); a member without house league gets a blank club-schedule
  page. **Owed:** the dev server restart before the owner tests (new files); `/docs` (Part 6); the 11b walk at the end of 11b.
  **Next:** Part 4 (Practice time), `CLUB_TIER_STAGE11B_PART4_BUILD_PROMPT.md`. Offered to the owner 2026-10-27, not ruled:
  walk Parts 3 and 4 together right after Part 4 (the prompt asks at hand-off).
- **2026-10-27 · 11b Part 4 (Practice time): BUILT, /review done** (prompt `CLUB_TIER_STAGE11B_PART4_BUILD_PROMPT.md`; no
  migration — migs 392–393's step was already there). Commits: `6b61e109b` (the planner, `lib/league-practice-time.ts`, pure,
  tested with the drawing's numbers; `partsShapes` split out of `partsWords`) · `f64c23958` (the route: GET `read`, POST `run`
  on the season; the server re-reads, refuses `changed` unless it is what the window `saw` — slots and teams — and plans
  again; the client's rows are never sent) · `20d7c2b70` (the window, h1; Tools › Practice time after House league's time;
  "+ Give U12 more time" opens House league's time on that piece, new `openOn`, and Practice time comes back) · `42f77b4c6`
  (h2 a practice's window, read first, one component for 9d-2a's views; "From {schedule}" on the card; a hand-booked
  practice's pencil, a series asking This practice only / This & future first; the clash line checks exactly the dates an
  edit moves) · `ddf7b76fa` (11b·C, the coach's team page lists practices from today on; the page itself gained only its
  import and one line — another session's roster edits to it stayed uncommitted) · `fb86d7c96` (guards: league-season-scope,
  a record window's width) · `60aee2636` (the /review fixes). **Verified on DEV end to end** (`.probe/11b4/e2e.ts`, rolled
  back): the drawing's numbers wrote 40 practices in their slots, a second hand-out wrote nothing twice, 2 at once replaced
  the plan, and **Part 3's red question for real** — giving back Wednesdays on one facility removed exactly the 20 practices
  on it. Dev holds no house-league time, so the window itself has not been seen with data.
  **Found and fixed on the way:** today's cancel route would cancel a practice handed out from the club's time; it (and the
  new edit) now refuses one (9d2·5). **/review (4 lenses) — fixed:** High: the planner counted every part that ever appears
  as a week's time, so a slot moved mid-season promised 1 a week while each team practised half the weeks — each run of
  weeks with the same parts is now planned on its own, the window's figures the typical week's; a slot ending at midnight;
  "Every Monday" only when weekly; a series edit keeps each practice's own notes unless changed; an impossible date is
  refused in words; a failed series edit re-reads; the scope step's width and Cancel; House league's time on a piece shows
  only loading until read; Tools never reopens Practice time. **Recorded, not changed (Low):** a slot that starts in the
  seconds between the read and the step is still planned over; the `saw` check compares ids, not a slot's times (the club's
  edits remove and re-add slots); a hand-out re-run revives a club practice the club cancelled only if that slot is still the
  division's practice time; the series edit is a loop, not one transaction (a retry heals); the coach page lists at most 200.
  **Builder's calls, said at hand-off:** short time is one ring over every seat (every team goes without equally; a team
  moves parts while time is short) rather than naming teams; h2's source line and hint reuse the rep coach's words ("Only the
  club can move or remove this practice") — the drawing's caption asks for one spelling; the clubs' slots are the unit, so
  a 60-minute practice on the club's 90-minute slots fits once per slot. **Owner asks:** (1) ~~teams at once FILLS the time~~
  **RULED 2026-10-27 as recommended** ("i agree with yoru recommendation"): Practice time gains a third dropdown, **Practices a
  week** (1–3, starting at 1); every team gets the pick or what fits, the rest stays open; the earliest parts fill first so
  spare time is whole evenings (2 at once + 1 a week = Mondays, Wednesdays free). Built `29cfecb71`
  (no migration: the window reopens on what is handed out now, read from the practices). Not drawn — its words are
  [marketing] drafts; (2) walk Parts 3 and 4 together now — **declined 2026-10-27** (owner: Part 5 already underway); the one 11b walk stays at the end of 11b. **Owed:** /marketing's one pass on the [marketing] words, then the settled
  set appended to `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`; the k2 row figure's practice count ("12 hours · 10 practices a week",
  copy ruling 9) is not built; the dev server restart (new files); `/docs` (Part 6). **Next:** Part 5 (Send the changes'
  house-league rows and the emails), `CLUB_TIER_STAGE11B_PART5_BUILD_PROMPT.md`. **⚠ Found writing it (dev only):** the club's
  Send the changes never passes the step's house-league argument, so a send that moves, clears or takes back house-league time
  with practices on it is refused as stale on every try — unreachable until Part 4 made practices; Part 5 fixes it first.
- **2026-10-27 · 11b Part 5 (Send the changes and the emails): BUILT, /review done** (prompt
  `CLUB_TIER_STAGE11B_PART5_BUILD_PROMPT.md`). Commits: `e1e40b78f` (**mig 400**, applied to DEV 2026-10-27, prod pending in
  MANUAL_PROD_STEPS: `league_season_notices.kind` gains `practices_changed` + `club_schedule_send_id`; SQL check T14 feeds the
  step the TS plan's exact `p_league`) · `2372797d4` (the plan, the preview, the send, the emails, the bell) · `5a352df33`
  (the window and sample hunks re-placed — a zero-context partial commit had put three insertions in the wrong place; the
  working tree was right) · `84869d691` (the /review fixes). **The stale refusal is fixed:** the send passes `p_league` from
  the plan the preview showed (a fingerprint compared at the press — a league admin's hand-out moves no schedule version).
  **The plan** (`lib/club-schedule-league-plan.ts`, pure): `diffAgainstSent` with house league as the one holder and each USE
  as what was sent — a use on a removed slot pairs with a house-league slot **made since the last send** in the same week
  (an older one with no use is Not given yet, never a move); time taken back or cleared never carries (9d2·16); practices
  move by the slot's shift if they fit and the use covers them, else are cancelled (the plan never asks a refused move); a
  same-time-and-place replacement tells nobody; held practices untouched. **Who hears, after the step:** the house-league
  coach's email (h4, settled; kind `club_schedule_league_coach`); the families' service notice, one per household per season
  (kind `house_league_practice_change`, `lib/club-schedule-league-mail.ts`), with **one Automatic row per season** on Email
  families (argument 7 taken as recommended: a row per send would put another season's families on this season's history);
  a bell to the club's `league_admin` members (`club_schedule_league_changes`, 9d2·13), so k5's foot says "U12's league
  admins are told then" again. **Also fixed:** the "Changed since sent" callout counted rep teams only — a change touching
  only house league read "nothing waits to be sent" with no Send the changes button; the send log names house-league teams.
  **Verified on DEV end to end** (`.probe/11b5/e2e.ts`, rolled back, h4's numbers): the old send (no `p_league`) refused
  `changed`; the new one moved 6, cancelled 1, carried 3 uses, wrote the notice row. Dev sends no email: the walk reads the
  send log, the Email families history row and the server log. **Step 5 (check, don't build):** not yet looked at in a
  browser — Practices view "From {schedule}", the coach's team page, House league's time and the slot window after a send.
  **Builder's calls:** "Sundays from Nov 8" only when the change runs to the team's last practice on that pattern, else a
  range ("Sundays, Nov 8 – 15") — a family must never read later Sundays as moved; unticking a house-league row stops its
  emails, never its move (the send is the schedule's); a family with children in two seasons hears once per season.
  **/review (4 lenses) — fixed:** the misplaced commit hunks (Critical/High); pairing onto older undivided time; no-op moves
  told; a practice with no end cancelled; the callout's read could fail the schedule page and read every family; teams
  scoped to the club's seasons before coaches and families are read; a real family's names sent to the browser unused;
  households counted twice; families never tried counted as nothing; ": 2 practices moved"; the statement's verb.
  **Recorded, not changed (Low/Advisory):** the fingerprint covers the plan, not the audience (a coach removed between
  preview and press is simply not emailed); the bell reports the plan's counts, not the step's (a practice deleted in the
  seconds between is still counted); the bell goes to `league_admin` members only — a club whose owner runs house league
  with no league admin gets no bell, and k5's half-sentence is then untrue (**owner ask**); house-league practices a send
  moves are not run through the clash check (`checkWritten` reads rep practices); the Families tab's bundle now pulls the
  scheduler's words module (tree-shaking may or may not drop it); two children with the same first name read alike.
  **Owed:** /marketing's one pass (`changesStatement`, a cancel's row in both emails, the league admins' bell, the
  Automatic row's tag words, "Questions? Ask the Reds or Blues coach", a team with nobody to email) then appended to
  `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`; the dev server restart (new files); Part 6 (`/docs`); the walk at the end of 11b.
  ⚠ Deploy order: the send now always passes `p_league`, so prod needs migs 392–393 (and 400) before this code serves.
- **2026-10-27 · after Part 5 (owner):** (1) the bell reaches **owners and admins as well as league admins**, never the
  sender — built `b88d488f0`; (2) the dev server restarted; (3) **the 11b walks written now, not after Part 6** (Part 6 is
  help only) — **§399–§403**, five one-purpose walks in `OWNER_QA_LEDGER.md` (give the time · divide it · Practice time ·
  Send the changes · a League Plus club), on UAT Rep Club with a league admin and two house-league coaches made for them
  (`.probe/11b-walk/fixture.mjs`). **Found writing walk 4, fixed `9e1b83a17`:** a drag on the club's grid is a holder swap,
  so Part 5 read a dragged house-league slot as time taken back and would have cancelled its practices; and time-order
  pairing let a take-back steal a moved slot's new time. **Next:** Part 6, `CLUB_TIER_STAGE11B_PART6_BUILD_PROMPT.md` (help
  only; it starts by correcting the Schedules guide's "Only the teams with changes are told").
- **2026-10-27 · 11b Part 6 (help): WRITTEN** (`CLUB_TIER_STAGE11B_PART6_BUILD_PROMPT.md`; help only, no product code). The club's
  Schedules guide (`org.tsx`) gained "Giving time to house league", "Taking time back from house league" and "Send the changes,
  with house league in it"; "Only the teams with changes are told" (the Changes sub-topic and its FAQ) and "Do families get an
  email" now say a house-league team's coaches and families are told; "house league is never billed" and an FAQ; "Who sees what"
  no longer says a club with no rep teams has no Schedules row. The house-league guide gained "House league's time" (5
  sub-topics: what the club gave · dividing it · Practice time · the club's schedule as a league admin reads it · what coaches and
  families hear) and the league admin's role article now says what a league admin may do in the club's Schedules; both help hubs'
  League admin path link to it. **Screen differs from the copy file (the screen is the truth; the help follows the screen):**
  the repeating-form take-back (k5 "Give every Thursday…") is NOT built, the slot window changes one slot; k5's foot DOES carry
  "U12's league admins are told then"; "Who, and how much" is on New schedule's step 1; k4 for a league admin has no "Take time
  back from another division" link and no "no time left" line; "Practices a week" (11b·D) is a third field the copy file's h1
  table lacks; the house-league coach's email drops "Your families get this change too." when the team has no households; the
  families' email omits "Sent by {club} because…" when the club's mail face is unavailable; "Times in Eastern time." is the
  platform default zone, not the club's own; the h4 game rows ("games move") are not built (9d-2b). **Found, not changed:**
  `lib/club-schedule-gate.ts`'s header still says a door that starts a schedule needs rep teams (Part 2 made a house league
  season enough). **Hand-off:** 11b is complete pending its walks (§399–§403) and prod migs 392–394, 397, 400.
- **2026-10-27 — 9d-2a STEP 1 BUILT (the three pure parts, tested; no screen yet).** Rulings 9d2a·A–F (§0h, above); words
  settled by /marketing into the copy file's "Stage 9d-2a" section. **The generator** (`lib/league-game-generator.ts`):
  match-ups only over the division's game slots, one game per slot in date order, the circle method once or twice through
  (the second with ends swapped), home and away by a ring rule that keeps every team within one (the old greedy left 9 teams
  at 3–5), each round's rarest time shared out first (10 teams: every team 1 or 2 Saturday mornings), never twice in a day
  unless the slots leave no other way (then warned), never two slots at once; blocks `teams` / `short` ("90 games need 90
  slots") / `crowded`. The drawing's U12 case gives 45 games on the earliest 45 of 65 slots, Jun 1 – Aug 3 (the drawing's
  "Aug 7" was a placeholder). The permit and club-booking warnings are the route's (step 5). **The bookings**
  (`lib/league-season-calendar.ts`): the season's games and practices as the club calendar's `CalendarBooking` (argued in
  its header: no fourth calendar), postponed out of its week into `needsDate`, cancelled struck in place, "Final 7–4",
  "Time from {schedule}" only on an EXACT slot match (same division, start and facility; otherwise nothing — there is no
  link to guess from), a night of one division's practices folded for List. **Health** (`lib/league-schedule-health.ts`): a
  league rule set — games on plan 30, clashes 30 (games AND practices, house league's own rule; a typed place is "not
  checked"; two teams on one club slot are not a clash), twice in a day 15, home and away 15, byes 10 (weights argued in its
  header); the plan is the division's own (the games most of its teams were given — nowhere to store a target without a
  migration); a postponed game is not had, a cancelled one is not had and is named "not replayed". On Dev House League 2026
  it finds the drawing's four issues and scores **65, Needs work** where the tournament engine says 97 (`.probe/9d2a/
  health-dev.mts`). **Open for step 6 (owner ask): "Adjust the rules" has nowhere to save** — no settings column on a season
  or a division; recommended: show the rules as words in 9d-2a and add the door with 9d-2b's migrations. 33 unit tests.
- **2026-10-27 — 9d-2a STEP 2 BUILT (the public schedule, g1 + g2's this-week frame).** The read that dropped cancelled
  games (`getGamesForSeason`, this page its only caller) is replaced by `getSeasonGamesEveryStatus` (throws on a failed
  read); the page draws through step 1's `seasonCalendar`, so the public words are the convenor's: Cancelled struck in its
  week, Postponed under "Needs a new date" with "Was {day}", "{Venue} · {Facility}" on every game (a closed venue still
  named: `getOrgPlaceNames` reads every venue), "Times in Eastern time." once, games only. It opens on this week; earlier
  weeks fold behind "Show {n} earlier weeks" (a disclosure, no script); a season wholly behind today folds nothing (the
  whole season is the record). **Argued:** the page does not wear the calendar's view switch (the drawing gives the public
  one list, and `club-stage6c-screens-guard`'s switch assertions are for the three staff calendars, so they did not move).
  A game saved with no date at all reads **"Date to come"** (a build word; it is not postponed, so it has no "Was").
  Checked on Dev House League 2026 and a rolled-back five-game fixture around today.
- **2026-10-27 — 9d-2a STEP 3 BUILT and committed `58ecf0ee6` (the admin screen, b1–b3).** The Week · List · Practices pills
  are gone: **List · Week · Month** on the shared `CalendarViewSwitch`, the phone's View drawer (Week, Month), the shared
  `ScheduleDateNav` (Week and Month only — List is the season, R1), **Division** as the leading scope pill, **Show** (games,
  practices) as the quiet `MultiSelectDropdown`, then Export · Add · Tools. Games and practices together; the Practices
  view is retired and a practice opens the existing `PracticeWindow` (h2 — already editable by hand since 11b Part 4; a club
  practice stays read-only). **Add** asks "a game or a practice", and a practice now asks its team (the practice form gained
  a Team field on create). **Generate games** moved into Tools (step 5 rebuilds it). The page reads the **whole season
  once** — teams, games and practices (the practices read returns the season's when no team is named) — and the division
  is a scope over it, so its clash marks (`seasonClashes`, house league's own rule) see another division's booking on the
  same facility. **Argued, the recipe's line over the drawing (§11's own rule):** the List is the row list (C5 — no column
  in the drawn When · What · Place table is compared or totalled), and the phone's Week is the stacked week (C13), not the
  drawn one-day pager. Week reuses the club calendar's `WeekView`; Month is the season's own (a division's day holds a few
  bookings, so it NAMES them, R2's reason — the coach's grid and `CellChip`, exported for it); a postponed game shows in
  Month on the day it had ("· Postponed"), never in List or Week. Week and Month open on the season's own day (C3,
  `seasonOpeningDay`). A practice is spelled "Tigers practice" (the club calendar's). **Kept for later steps:** the game
  window (4), Generate games (5), the old health strip (6). Export stays the division's games (Home / Away / Score columns,
  as before) — practices were never in the file. **Checks:** typecheck clean; 11,211 unit tests pass (`seasonClashes`,
  `seasonOpeningDay` new); guards moved with the reason (`org-week-clock`, `club-stage6a`); the retired views' 18 unused
  styles deleted and the old-look / lettering baselines lowered. The three reads probed on UAT Rep Club as a league admin
  and a registrar (200; a foreign team still 404). **Not run:** `check:layout --changed` widened itself to every screen
  (shared calendar parts touched) — a whole-product sweep, which runs on staging, never the dev server (owner 2026-10-13).
- **2026-10-27 — 9d-2a STEP 4 BUILT (the game window, b4).** The page's Edit Game form is gone; every game opens one
  window, read first (`components/admin/kit/club/league/schedule/GameWindow.tsx`, on `KitDialog`): eyebrow "{Division} ·
  a game", title "{Home} vs {Away}", the state under it ("Final 7–4", "Cancelled", "Needs a new date"), then When · Where
  · Home · Away · Time from · Notes. A reader (the registrar; anyone on a finished season) gets the facts and nothing else.
  Whoever runs the season gets the pencil (a game that's on or played) and the doors at the end of the body
  (`gameWindowDoors`): on → Postpone this game · Cancel this game; postponed → Give it a new date · Cancel this game;
  cancelled → Put it back on (9d2a·E, said "Put back on the schedule."); Delete this game on every state. Postpone, Cancel
  and Delete ask first as a level in the window, "Keep it" against the act, with the copy file's sentences ("Families
  aren't emailed.", 9d2a·F). **Argued, five calls:**
  1. **✓ saves; nothing saves as you type.** Until 9d-2b every saved game is on the public schedule at once (9d2a·A), the
     ruled exception to "edit autosaves" holds a change families can see until ✓ (2026-10-09), and the league's refusal
     needs the whole when and where. 9d-2b's draft games are where autosave would return, if anywhere.
  2. **The save sends only what changed.** The old form sent every field, so the route always saw "the time moved" and
     re-checked — a score on a game that already clashed was refused (the route's own comment says it must never be).
  3. **The Status dropdown is gone, so the score is the pencil's:** two boxes, asked once the game has started or when
     it has a score (`asksScores`); both in = played, both empty = on again, one alone is held ("Enter both scores, or
     neither." — a **build word**, /marketing did not settle it). Add › A game no longer offers a score: a past game is
     added, then scored with the pencil (one more step than the old dropdown).
  4. **Delete stays on every state** (9d2·9 is "Delete before publishing, Cancel after"; nothing is published until
     9d-2b, which takes Delete off a published game).
  5. **"Give it a new date" is the same form, opened on the old date; its ✓ puts the game back on** (even unchanged —
     "it's on again at its old time" is a true thing to say). It then reads as an ordinary game (no Moved, 9d2a·D).
  **"Time from {schedule}, the club's schedule"** (editor only) needed the season's game slots, past ones too — the
  window's read has a `now` filter — so `seasonGameSlots` (lib/league-time-server.ts) rides the page's existing
  schedule read (no new route, no year: the season's own). Matched by step 1's exact rule; otherwise nothing. Probed on
  dev's "2026 Fall House League" (13 game slots from "Walk · House league weeknights"; its 3 games sit on none, so all
  three say nothing). The live check moved out of the page into `useLeagueLine.tsx` beside the window, so the window and
  the practice forms share it. **Not in step 4:** the read window's permit line and "See the permit" (step 7 — the line
  needs a permit read per game the page does not have yet, and the id). **⚠ OWNER ASK (raised by the build):** the
  drawing's caption limits moving a game to time the division holds ("time the division doesn't hold is offered only if
  it is free"). **Not built:** the pencil moves a game to any date and time, as the old form and Add › A game did. The
  amendment's words govern Generate and handing out time; a game has no slot link until 9d-2b; and every season with no
  house-league time (all of production today, the free League plan) could not move a game at all. **Recommended:** build
  it with 9d-2b's slot link, for a division that has game time. **Checks:** typecheck clean; guards moved with the reason
  (`house-league-game-window-guard` rewritten for the read-first window — Delete's rules kept, the old look's sticky bands
  retired with it; `club-stage6a` — the window joins WEARS_THE_FIELD / SHOWS_THE_PERMIT, the live line asserted in its own
  file, the page's Create counts now one); old-look baseline lowered (helpers 8 → 7); `check:spelling` clean. **Not run:**
  `check:layout --changed` (it measures pages, not an open window; the page around it is step 3's, unchanged).
- **2026-10-27 — 9d-2a STEP 5 BUILT and committed `ed6c34db3` (Generate games, c1–c4 + k3/k4; step 4's tidy committed
  separately just before it, `8dbc2dc01`).** One window (`components/admin/kit/club/league/schedule/GenerateGamesWindow.tsx`), two steps
  and a check, on one route with three steps (`generate/route.ts` `plan` · `check` · `save`; `lib/league-generate-server.ts`).
  **Step 1** reads the division's game time from House league's time (its rows, "{n} games a week", "{dates} · {n} game
  slots in all.", "Each game is 90 minutes, the length of a slot.", door "Change it in House league's time"). With none
  (k3), house league's time not given yet, a row at a time, ticked; **Next gives it** (House league's time's own write) and
  goes on. With nothing to give (k4), the league admin is told who can (and "Take time back from another division" when
  another division holds time); an owner or an admin gets "Give house league more time" to Schedules. **Step 2** is Once /
  Twice with the server's exact plan for both (counts, the hints). **The check** is passing / warning / blocking, with
  "Checking…" and "The check didn't finish. Your choices are kept." · Try again. Save puts the games on the public schedule
  at once and says so, "Families aren't emailed." (9d2a·A, ·F), then "Saved {n} games. They're on the public schedule now."
  with the shipped `permitAfterSave` when games fall outside a permit. **Argued, eight calls:**
  1. **The free League plan's branch (9d2a·B) is the club's schedule, not the free floor by name.** The route and the page
     both ask `clubSchedulerOn(planId)`; League Plus and both Club bands carry it, so today the old generator is exactly the
     free League floor's, kept verbatim below the new path. An org with house league and no club's schedule would otherwise
     open a Generate that can never have time.
  2. **k3 gives whole rows; part of a row is House league's time's job** (the hint's door). Next writes before the games, so
     a convenor who then closes keeps the game time — it is undone in House league's time, and Step 2 plans against real
     slots rather than a promise.
  3. **"Has any games" is 9d2·11's test until 9d-2b** (recommended in the prompt): any `league_games` row, whatever its
     state. Tools › Generate games is absent when no division qualifies (b3); "Every division already has games…" shows only
     if the list empties while the window is open.
  4. **Save plans again and refuses a check it no longer matches** (`changed`, when the slots differ from the check's).
     ⚠ **Not atomic across two people:** two league admins who both pass the check before either saves would both insert.
     The fix is a database step (a lock on the division), and 9d-2a adds no migration — **for 9d-2b's migrations.**
  5. **The check's "Schedule health {score}" is the division's planned games against its own practices** (step 1's league
     rule set). Another program's booking and the permit are warnings, never points, as the health header already says.
  6. **"Prime time" is counted as it is said** — a weekday and its part of the day. Found on the dev probe: all games on
     Sunday mornings at 8:00 and 9:30 read "Every team gets 1 or 2 Sunday mornings"; now nothing is shared out there.
  7. **"See the permit" in the permit warning is step 7's** (with the permit id and the ended-permit line, frame i); the
     warning carries `permitLine` as shipped meanwhile. The phone (c4) is the same window (the dialog fills a phone); c4's
     shorter phone sentences were not built.
  8. **⚠ A behaviour change on production, as ruled:** a club with the club's schedule (League Plus, Club) that has given
     house league no time can no longer generate games — it reads k4 and is sent to Schedules. That is the owner's
     amendment ("we can't have the house league people allowed to click any day or time before the club allocates"), and
     today's production generator still asks a date, a clock and a field. Say it at the walk and in `/docs`.
  **Build words** (marked `[build]` in `GENERATE_WORDS`): "{dates} · {n} game slots in all.", "Each game is the length of its
  slot." (mixed lengths), "Only {placed} of the {n} games fit without a team playing two games at once." (crowded), "{Division}
  needs at least 2 teams.", "{Division}'s game time changed while you were looking. Check the games again.", "{Division} has
  games now. Add more one at a time, with Add.", "Loading the match-ups…". **Checks:** typecheck clean; 11,318 unit tests pass
  (6 new: the window's sentences, the spoken prime time); `club-stage6a`'s writer census gains `lib/league-generate-server.ts`
  (it checks the proposed games and what it wrote); `check:spelling`, `check:org-slug-callers` (the two windows' base `api`
  props marked: each window adds `orgQuery`) and the restyle gates clean on these files. **End to end on dev**
  (`.probe/9d2a/step5-e2e.mjs`, UAT Rep Club as its league admin, a probe division and ten probe slots, all removed after):
  no time → short; the slots read Not given yet; given; once fits (6 of 10, 1 or 2 home each), twice blocks (12 need 12,
  10 by Dec 6); the check names a permit warning (Kinsmen Park's permit ends Nov 19) with health 100; a stale Save → 409
  `changed`; Save → 6 games, each exactly on its slot, venue and facility, every pairing once; again → 409 `has_games`; a
  foreign division → 404. **Not run:** `check:layout --changed` (an open window, not a page).
- **2026-10-27 — 9d-2a STEP 6 BUILT and committed `c9a03a4bc` (Schedule health, d1–d4).** **Owner ruling, step 6 (the owed ask):** the foot SAYS the
  rules ("The score uses this season's rules." · Games per team · A team can play twice in a day: No · Home and away can
  differ by: 1 game) and has **no "Adjust the rules" door** until 9d-2b's migrations can hold them. The old warning strip
  above the views is gone; the header carries the tournament's `HealthButton` ("—" until a game has a time, the amber
  issue count) and it opens `LeagueHealthWindow` (components/admin/kit/club/league/schedule/), on the tournament's own
  parts: its frame (`HealthWindowFrame`, split out of `ScheduleHealthWindow` so the two cannot drift), its tiles (`Metric`)
  and issue rows (`IssueRow`, now exported; a row with no title says only its sentence). Tiles: Games · Home/away · Byes ·
  Clashes; then the issues in step 1's order, each with its door; Team detail (Games · Home–away · Byes · Prime time ·
  Places); the rules. **Argued, five calls:**
  1. **Health is worked out in the browser from the season the page already reads** (every division's games and
     practices), not by a route. It follows every write with no second read, and the clash pool is the season's. The old
     `schedule/health` route (clashes by the text match too, no score) had this page as its only caller and is deleted;
     `scanLeagueBookingConflicts` / `countUncheckedBookings` are now used only by their tests (left for /simplify).
  2. **The doors.** "Show them" / "Show it" close the window on the issue's division and day, in List (Week on a phone),
     with Show cleared so the booking is drawn — a cancelled game not replayed, a clash, twice in a day, byes (the first
     week), a typed place (the first one). "Give it a new date" opens the postponed game's window on its division (a
     reader's door says "Show it" and the window opens read-only). A short team with no cancelled game, and home and away,
     open Team detail in the window (there is no team filter on the schedule to show "them" with).
  3. **Prime time** is the generator's measure, said: each division's rarest time as a weekday and its part of the day;
     the cell is "even" when every team's share is within one (or the division plays at one time), else the team's share
     ("0 Saturday mornings"). It is a fact in team detail, never points.
  4. **The phone (d4)** shows two issues, then "{n} more. Show all"; the desk shows all of them (the drawing's four).
  5. **Games per team is said per division** when the divisions differ ("U10 4 · U12 6"), with the sentence that it is
     the number most of a division's teams were given — there is no target to set until 9d-2b.
  **Build words** (marked `[build]` in `LEAGUE_HEALTH_WORDS`): the Byes tile's "back to back" detail, the Clashes tile's
  "all checked", "{n} more." / "Show all", "Nothing to look at. Every team has its games, and nothing clashes.", a lone short
  team ("{Team} has {a} of {b} games." / "Its … game was cancelled"), home and away past two games ("all 3 games at home",
  "1 game at home and 4 away"), an undated game ("{Home} vs {Away} still needs a date."), and the games-per-team hint.
  **Checks:** typecheck clean (the one error is another session's untracked public-tournament test); 11,362 unit tests
  pass (10 new in `league-schedule-health.test.ts`: the sentences, prime time, the page's rows, and the page wearing the
  button and window with no route read and no strip); `schedule-health-one-number` unchanged and passing; old-look baseline
  lowered (kx 7 → 4, helpers 7 → 6); `check:spelling` clean. **On dev** (`.probe/9d2a/step6-health.mts`, UAT Rep Club as
  its league admin, a clash practice and a postponed game, both removed after): health from the page's three reads equals
  health from the database rows (60, the same issues and team detail), and reads "Reds and Blues have 2 of 4 games. Their
  Oct 25 game was cancelled and not replayed." · "Blues vs Reds was postponed from Nov 15 and still needs a new date." ·
  "Kinsmen Park · Diamond B is booked twice on Thu, Oct 22 at 6:00 p.m.: Reds vs Blues and Reds practice."; the page serves
  200. **Not run:** `check:layout --changed` (it widens to every screen once the tournament's shared health parts are
  touched — a whole-product sweep, which runs on staging, never the dev server).
- **2026-10-27 — 9d-2a STEP 7 BUILT and committed `7c2f0c0d2` (Permit links, frames b4, c3, i).** **Owner ruling, step 7
  (raised by the build): 9d2a·H** — the "ended" line, in the one rule, everywhere (§0h). The rule's answer (`permitAnswer`,
  lib/permit-time.ts) gains `ended` and `permitId`; `namePermitOutside` carries both onto the wire (`PermitOutside`), so
  every check and save reply has them. "See the permit" is one component (`SeePermitDoor`, beside `useLeagueLine`), on the
  quiet line through `WhereLine`'s new `door` slot. **Argued, five calls:**
  1. **Ended is the last permit there to end, with no time to move inside.** When no permit holds the venue that day and
     some had ended before it, the answer is outside, `covers` empty, `until` the last one's last day; a venue whose only
     permits start later still says nothing. No time limit: a club that stops using a venue stops booking it, and the
     line is quiet, never a refusal. A series says "It ended {date}." after its count (the copy file's phone sentence).
     The year is said when it isn't the booking's, as the shipped "until" is ("ended Oct 29" in the same year).
  2. **The permit id is the one permit the line is about, or none.** A date off: its permit. Otherwise the permits whose
     blocks the line describes; two or more (two permits holding one diamond) = null = no door, never a guess. An ended
     line: the last to end (two ending the same day = no door).
  3. **The read now reaches a venue's earlier permits** (`checkClubPermits` reads by venue up to the last day, without the
     `ends_on` floor). A club keeps a handful a year, so the history costs little; the read is still one per check.
  4. **Who sees it:** the season's schedule read (`GET …/schedule`) sends each game's answer only to someone who runs the
     season (owner, admin, league admin on a live season) — frame i's "A reader doesn't see the line". Every runner opens
     the Venue library, and the permits route refuses only a coach login, so a runner's door always opens (proved for the
     league admin on dev; without Accounting the window carries no cost, Stage 10's own rule). A finished season reads.
  5. **The permit window opens RAISED over the window that asked** (KitDialog's `raised`, the kit's one form-over-form):
     the game window or Generate's check waits underneath and is there, unchanged, when the permit closes. `PermitWindow`
     gains a `raised` prop; nothing else of Stage 10's window changed ("opens as it is"). A change to the permit reads
     the season again. The game window shows the line in the record (from the season read) and under Where in the form
     (the live check's answer), each with the door; Generate's permit warning carries `permitId` and the door.
  **Not built:** the door on the practice window's line (11b's `PracticeWindow`; not in b4/c3/i), and on the after-save
  notice (`permitAfterSave`, a notice, not a line). **Checks:** typecheck clean; 11,400 unit tests, the only failures in
  another session's in-flight files (support console 4b: `portal-keep-premium` audit reason; sign-up / plan door earlier,
  cleared); new tests in `permit-time.test.ts` (ended, the id, the words) and `house-league-game-window-guard` §5 (the read
  is a runner's, the record's line and door, the raised window); `check:spelling` clean; `lint:focused` no errors; the PDF
  set's coverage hook named the season page (it now reaches the renderers through the permit window) — it joins
  `NO_PDF_SCREENS` beside `PermitWindows.tsx`, same reason. **On dev** (`.probe/9d2a/step7-e2e.mjs`, UAT Rep Club, a probe
  division and two games at Kinsmen Park, removed after): a 2 a.m. game inside "Fall diamonds 2026" is outside, not ended,
  with that permit's id; a game a month after it ended (Nov 19) is ENDED, until 2026-11-19, the same id, no covers; the
  league admin opens the permit window's read (200, no cost); the registrar reads the season's games and no permit answer.
  **Not run:** `check:layout --changed` (an open window, not a page). **⚠ For the walk and `/docs`:** a coach booking a
  practice at a field whose club permit has ended now sees the quiet line — a behaviour change outside house league, as
  ruled.
