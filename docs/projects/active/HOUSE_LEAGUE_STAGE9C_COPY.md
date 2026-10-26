# House league Stage 9c: the words (`/marketing`, 2026-10-26)

> Copy for the 9c build (`HOUSE_LEAGUE_STAGE9C_BUILD_PROMPT.md`, "Before any code"): Teams & draft (steps, board, Tools),
> the team window and its coaches, the rating window, the draft and its locks, moving a child, Publish teams, the placement,
> move and coach-invite emails, the coach's sign-in card and team page, the family status page's Team and Coach rows, the
> sign-up form's coach line, and every refusal. The drawings (`HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`,
> https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk) are the ruled starting point, with the owner's rulings in
> `HOUSE_LEAGUE_STAGE9_PLAN.md` §0f. Every drawn word is kept unless a house rule, a ruling or the code breaks it, and every
> change is listed in section 14 with its reason. The 9b-1 and 9b-2 words (statuses, money, the ending window, "Ask to
> withdraw") are reused, not rewritten. Keys are written `like.this` with the prefix of their surface.

## 0. Conventions

**House rules applied, as 9b-2 §0.** Sentence case everywhere. Dates through `formatStoredDate` ("Oct 25", with the year only
when it is not this year). A clock time through `formatTime()` ("8:14 p.m."), which appears once, in a refusal (§7.5). Every
`{name}’s` below is a template for `possessive(name)` ("Jays’ coach", "Nora’s team"), never a hand-built `’s`. Apostrophes are
curly. No exclamation marks, no sales voice, no stage names or "coming soon" on any screen.

**Words that mean one thing.**

| Thing | Words | Never |
|---|---|---|
| The 1–5 number | **rating**, verb **rate** ("Rate players") | "score", "skill level", "grade" |
| A child with no rating | **not rated**; in the draft they **count as a 3** | "unrated", "default" |
| Making the teams from ratings | **the draft**: **Run the draft**, **Draft again** | "auto-assign", "generate teams", "randomize" |
| Keeping a child on a team through the draft | **lock** / **Lock to this team** / **Locked** / **Unlock** | "pin", "fix", "reserve" |
| A child placed by hand after a draft | **Moved by you** | "manual", "override" |
| A child on no team | **Not on a team** | "unassigned", "player pool" |
| Telling families the teams | **Publish** / **Published {Oct 25}** | "release", "send teams", "finalize" |
| The family email that names the team | the **placement email** (staff word in help only; never shown to a family) | "notification" |
| A person who coaches a house-league team | **coach** (lowercase in a sentence; "Coach Pat Volunteer" before a name on a team card) | "volunteer", "manager", "head coach" (house league has no head/assistant split) |
| A count of kids, staff side | **players** ("1 player" / "{n} players") | "children" on a count, "kids" |
| A kid, family side | **child** / **children** | "player" in a family sentence |
| Families counted | "1 family" / "{n} families" (a household = one guardian email) | "households", "recipients" |

**Name lists** as 9b-1: "Nora", "Nora and Jaya", "Nora, Jaya and Liam"; a result line names three and counts the rest.

**Not in these strings:** a schedule or scores on the coach page (9d, 9e), a coach messaging families from the product, ratings
carried between seasons (Stage 14), siblings or "with a friend" kept together, a live draft night, any money on a coach's
screen, and the season email's daily cap (it arrives with 9d's composer; nothing in 9c counts toward it or mentions it).

---

## 1. Teams & draft: the page (A)

### 1.1 Head and division tabs

| Key | String |
|---|---|
| `teams.title` | Teams & draft |
| `teams.sub` | {season} · {3} divisions · {nothing published yet \| 1 of 3 published \| all published} |
| `teams.tab` | {division} {count of accepted players, in the count chip} |

### 1.2 The division's state (pill in the division head; clicking it says what is left)

| Key | Pill | Click says |
|---|---|---|
| `teams.state.noTeams` | No teams | Make the teams first. |
| `teams.state.notDrafted` | Not drafted | Run the draft, or drag players onto teams. Nothing is sent until you publish. |
| `teams.state.drafted` | Drafted · not published | Publish tells {3 families} their child’s team. |
| `teams.state.published` | Published {Oct 25} | Families were told on {Oct 25}. A move now emails that family. |

`teams.state.drafted` also shows when teams were filled by hand without a draft (the state means "on teams, not published").

### 1.3 The steps

| Key | Title | Line |
|---|---|---|
| `teams.step.teams` | Teams | {2} teams: {Cardinals and Jays} · {no coach yet for Jays \| every team has a coach} |
| `teams.step.teams.none` | Teams | Make the teams first. You can name them now and add coaches any time before you publish. |
| `teams.step.ratings` | Ratings | {3} of {5} rated · the other {2} count as a 3 |
| `teams.step.ratings.all` | Ratings | All {5} rated |
| `teams.step.ratings.none` | Ratings | Nobody is rated. The draft still runs: it deals the players at random, evenly. Rate them first if you want balanced teams. |
| `teams.step.ratings.empty` | Ratings | No players yet · {10} spots |
| `teams.step.draft` | Draft | Deals the {5} players across the {2} teams by rating, strongest first. Nothing is sent. |
| `teams.step.publish` | Publish | Tells {3 families} their child’s team and invites each coach to their team page. |

Buttons: **+ Create teams** (no teams yet), **+ Add teams**, **Rate players** (phone: **Rate**), **Run the draft** (phone: **Run**),
**Draft again**, **Publish teams**. Each is absent until it can be pressed. The phone's short labels are the same verbs.

Under the steps, only when it applies: `teams.notDrafted` = **Not on the board: {1} still to review, {2} on the waitlist.**
**Review on Registrations** (the link). Either half drops when it is zero; the line drops when both are.

### 1.4 The board

| Key | String |
|---|---|
| `teams.pool.title` | Not on a team |
| `teams.pool.empty` | Everyone in this division is on a team. |
| `teams.pool.hint` | A player accepted after you publish appears here. |
| `teams.card.coach` | Coach {Pat Volunteer} · two coaches: Coaches {Pat Volunteer} and {Sam Lee} |
| `teams.card.noCoach` | No coach yet (amber; clicking opens the team window at the coach fields) |
| `teams.card.empty` | Drag players here, or run the draft |
| `teams.card.foot` | {2} players · avg {3.5} (avg absent when nobody on the team is rated) |
| `teams.kid.age` | Age {9} · "Age not given" when there is no date of birth |
| `teams.kid.notRated` | counts as a 3 |
| `teams.kid.owes` | owes {$165} (staff only, from 9b-2's money read) |
| `teams.kid.asked` | Asked to withdraw {Oct 30} |
| `teams.kid.moved` | Moved by you (clicking offers **Put back on {Cardinals}**) |
| `teams.kid.locked` | Locked (with the lock symbol; see §5) |
| `teams.kid.left` | {Avery Macdonald} left the team on {Nov 1} (one quiet line at the foot of the team card) |
| `teams.balance` | Average rating **{Cardinals 3.5 · Jays 3.0}** · Sizes **{2 and 3}** · Moved by hand **{1}** |

The rating chip reads the number, or a dashed **–** for not rated (aria-label "Not rated").

### 1.5 Tools (⋯)

| Key | String | When |
|---|---|---|
| `teams.tools.export` | Export | Always. The registrar's export has no rating column. |
| `teams.tools.clear` | Take all players off teams | Before publishing, when anyone is on a team |
| `teams.tools.clear.confirm` | Take all {5} players in {division} off their teams? Locks and moves by hand go too. Nothing is sent. | |
| `teams.tools.clear.button` | Take them off | |

---

## 2. The team window (B)

Create teams keeps today's fields and words ("Number of teams", "Create {n} teams"); only the title changes to sentence case:
**Create teams for {division}**. The free plan's team limit message is unchanged (its number lives in `PLAN_PRICING_FACTS.md`).

The edit window reads first and edits whole (pencil, then ✓).

| Key | String |
|---|---|
| `team.name` | Name |
| `team.colour` | Colour |
| `team.coach` | Coach |
| `team.coachEmail` | Coach’s email |
| `team.addCoach` | + Add another coach |
| `team.removeCoach` | Remove {Pat Volunteer} as coach (the × on a coach's row; asks only after publishing, §2.1) |
| `team.hint.before` | {Pat} gets an invite to the team page when you publish {division}. The page shows this team’s players and each family’s name, email and phone. |
| `team.hint.after` | {Pat} is invited when you press ✓. |
| `team.err.email` | Enter an email address, like name@example.com. (reuse the product's one email-format refusal) |
| `team.err.dupe` | {Pat Volunteer} is already a coach of this team. |

### 2.1 After publishing: the held saves

| Key | String |
|---|---|
| `team.confirmInvite.title` | Send {Pat} the invite? |
| `team.confirmInvite.body` | {Pat} gets an email with a link to the {Jays} team page, which shows the team’s players and each family’s name, email and phone. |
| `team.confirmInvite.button` | Send invite |
| `team.confirmRemove.title` | Remove {Pat Volunteer} as coach? |
| `team.confirmRemove.body` | {Pat} loses the {Jays} team page at once. Families aren’t told. |
| `team.confirmRemove.button` | Remove |

### 2.2 A coach's state (under the coach's name on the card and in the window)

| Key | String |
|---|---|
| `coach.state.waiting` | Invited when you publish |
| `coach.state.invited` | Invited {Oct 25} |
| `coach.state.joined` | Signed in |
| `coach.state.bounced` | Invite didn’t arrive · **Fix the email** (amber) |
| `coach.state.expired` | Invite expired · **Send again** (amber) |

---

## 3. Rating a division (C)

| Key | String |
|---|---|
| `rate.title` | Rate {division} |
| `rate.intro` | 1 is newest to the sport, 5 is among the strongest in the age group. The draft uses these to balance the teams. Only the people who run the league see ratings; families, coaches and the registrar never do. |
| `rate.filter.all` | All {5} |
| `rate.filter.unrated` | Not rated {2} (amber count) |
| `rate.col` | Player · Age · Rating |
| `rate.bulk` | {2} selected · Rate them [1 2 3 4 5] |
| `rate.hint` | On a keyboard, type 1 to 5 to rate and move to the next player. Tap a chosen number again to clear it. |
| `rate.foot` | {3} of {5} rated · erased when the season finishes |
| `rate.done` | Done |
| `rate.empty` | No players to rate. Ratings are for accepted players in this division. |
| `rate.err` | That rating didn’t save. Check your connection and tap it again. |

Each number has an aria-label: "Rate {Nora Test} {4} of 5".

---

## 4. The draft (D)

### 4.1 Run the draft

| Key | Label | Line |
|---|---|---|
| `draft.title` | Run the draft for {division} | |
| `draft.players` | Players | **{5} accepted**, including {Liam Chen}, who still owes. Every accepted player holds their spot. (The owing clause drops when nobody owes; three named, then "and {n} more".) |
| `draft.notDrafted` | Not drafted | **{Maya Singh}** is still to review and isn’t drafted. **Review on Registrations** · **{2} on the waitlist** aren’t drafted; a player who gets a spot later appears under Not on a team. · "Nobody to review and nobody on the waitlist." when both are zero |
| `draft.teams` | Teams | {Cardinals 3 · Jays 2} ({5} players don’t divide evenly by {2}) — the bracket only when they don't |
| `draft.locked` | Locked | {2} locked: they stay on their team and count toward its average. (row absent when none) |
| `draft.ratings` | Ratings | {3} of {5} rated · the other {2} count as a 3 · "Nobody is rated, so players are dealt at random, evenly." |
| `draft.how` | How it deals | Strongest first, and the order reverses each round. Ties and the first pick are drawn at random. |
| `draft.foot` | | Nothing is sent. Families hear when you publish. |
| `draft.button` | Run the draft | |

### 4.2 Draft again

| Key | String |
|---|---|
| `draftAgain.title` | Draft {division} again? |
| `draftAgain.body` | This deals all {5} players again and replaces the current teams{, including your 1 move by hand ({Jaya Test} to {Jays})}. Locked players stay where they are. |
| `draftAgain.button` | Draft again |

The move clause names up to three moves and counts the rest.

### 4.3 Refusals

| Key | String |
|---|---|
| `draft.err.tooFew` | {division} has {5} players and {6} teams, so one team would have nobody. Remove a team, or wait for more players to be accepted. (the window has only **Close**) |
| `draft.err.noTeams` | Make the teams first. (the step shows it; no window opens) |
| `draft.err.noPlayers` | No players to draft yet. |
| `draft.err.lockedFull` | Every player is locked, so there is nothing to deal. Unlock some, or publish as it is. |
| `draft.err.changed` | {division} changed while this window was open. Close it and look again. |
| `draft.err.published` | {division} is published, so it can’t be drafted again. Move players one at a time; each family is told. |

---

## 5. Locks (E), ruled 9c·3

| Key | String |
|---|---|
| `lock.menu` | Lock to this team (in a player's ⋯ on a team, before publishing) |
| `lock.menuOff` | Unlock |
| `lock.badge` | Locked (with the lock symbol, beside the player's name) |
| `lock.hint` | A locked player stays on this team when you run the draft, and their rating counts toward the team’s average. |
| `lock.err.noTeam` | Put {Nora} on a team first, then lock them there. (never shown in practice: the item is absent for a player not on a team) |

Locks end at publish: after publishing, "Locked" and the menu items are absent (there is no draft left to hold anyone against).

---

## 6. Moving a player (F)

### 6.1 Before publishing

Desk: drag. Phone: the ⋯ on a player opens the sheet.

| Key | String |
|---|---|
| `move.sheet.title` | Move {Jaya Test} to… |
| `move.sheet.sub` | Rated {2} · {division} · "Not rated · {division}" |
| `move.sheet.team` | {Cardinals} · {2} players · avg {3.5} → {3.0} with {Jaya} |
| `move.sheet.current` | {Jays} · Now here |
| `move.sheet.off` | Not on a team · Take {Jaya} off the team |
| `move.sheet.lock` | Lock to this team (also offered here, as §5) |

A move before publishing is immediate and says nothing.

### 6.2 After publishing (held)

| Key | String |
|---|---|
| `move.confirm.title` | Move {Liam Chen} to {Cardinals}? |
| `move.confirm.body` | The {Chen} family gets an email saying {Liam} is now on {Cardinals}{, coach Pat Volunteer}. Both teams’ pages change for their coaches. |
| `move.confirm.offTeam` | The {Chen} family isn’t emailed: {Liam} goes back to Not on a team until you place them. |
| `move.confirm.foot` | 1 email |
| `move.confirm.button` | Move and email |
| `move.place.title` | Put {Ava Kim} on {Tigers}? (a player accepted after publishing) |
| `move.place.body` | The {Kim} family gets an email with {Ava}’s team and coach. |
| `move.place.button` | Place and email |

---

## 7. Publish teams (G)

### 7.1 The window

| Key | String |
|---|---|
| `publish.title` | Publish the {division} teams |
| `publish.body` | Each family gets one email naming their children’s teams and coaches, and each child’s team shows on the family’s status page. {Pat Volunteer} is invited to the {Cardinals} team page. (the coach sentence lists up to three coaches, then "and {n} more coaches") |
| `publish.check.placed` | ✓ All {5} accepted players are on a team |
| `publish.check.unplaced` | ! {2} accepted players aren’t on a team. They’re told when you place them. (warns, does not block; §15) |
| `publish.check.noCoach` | ! No coach for {Jays} yet · Their families read “Coach to be announced”. Add one any time; they’re invited then. |
| `publish.check.review` | ! {Maya Singh} is still to review · Not on a team, so not emailed now. **Review on Registrations** |
| `publish.preview` | Preview the email to the {Test} family ({3} children) — the family shown is the one with the most children |
| `publish.foot` | {3} emails, one per family |
| `publish.button` | Publish and email {3} families · "Publish and email 1 family" |
| `publish.sending` | Sending to {3} families… (the button reads **Publishing…** and can't be pressed again) |

### 7.2 Results (the line at the top of the published division)

| Key | String |
|---|---|
| `publish.done` | Published {Oct 25} · {3} families emailed · {Pat Volunteer} invited to coach {Cardinals}. (the coach clause drops when nobody was invited) |
| `publish.bounced` | 1 email didn’t arrive: the {Macdonald} family (the address bounced). {Avery}’s team shows on their status page. **Open {Avery}’s registration** |
| `publish.failed` | The teams are published, but {2} of {3} emails couldn’t be sent. Their status pages show the team. **Send the {2} again** |
| `publish.after` | Moving a player now emails their family. There is no unpublish: families already have the email. |

"The {Macdonald} family" takes the guardian's last name; with no last name it reads "the family of {Avery Macdonald}".

### 7.3 Refusals

| Key | String |
|---|---|
| `publish.err.notReady` | Put players on teams first. (no window opens; the step's button is absent) |
| `publish.err.changed` | {division} changed while this window was open. Close it and look again. |
| `publish.err.already` | {Sam Lee} published {division} at {8:14 p.m.}. Nothing more was sent. (the one clock time; through `formatTime()`) |

---

## 8. After publishing (H)

| Key | String |
|---|---|
| `after.pool` | Not on a team {1} (amber count) |
| `after.left` | as `teams.kid.left` |
| `after.ended.note` | (none: ending a registration on Registrations takes the player off their team; 9b-2's ending email covers the family) |

---

## 9. Emails (I)

All three are family or coach mail on the club's envelope (`familyNotice` for the two family emails; the coach invite on the warm
envelope with the club's name, as the club's rep coach invite does). The family emails are **service messages**: a family who
unsubscribed from club news still gets them.

### 9.1 The placement email (one per family, per division published)

| Key | String |
|---|---|
| `mail.placed.subject` | The teams are set — {season} |
| `mail.placed.heading` | The teams are set |
| `mail.placed.greeting` | Hi {Priya}, |
| `mail.placed.lead` | The {division} teams for {season} are set. |
| `mail.placed.line` | **{Nora Test}**: {Cardinals}, coach {Pat Volunteer} · two coaches: "coaches {Pat Volunteer} and {Sam Lee}" · none: "coach to be announced" |
| `mail.placed.next` | The coach will be in touch about getting started. (one child or one coach) · "Each coach will be in touch about getting started." (two teams) · drops when no listed team has a coach |
| `mail.placed.button` | See your registration (the status page, reference filled in) |
| `mail.placed.contact` | Questions? Contact {club} at {email}. |

A late placement (a player accepted after publishing) sends the same email with one line.

### 9.2 Moved after publishing

| Key | String |
|---|---|
| `mail.moved.subject` | {Liam}’s new team — {season} |
| `mail.moved.heading` | A new team for {Liam} |
| `mail.moved.lead` | {Liam Chen} has moved from {Jays} to {Cardinals} in {division}. |
| `mail.moved.coach` | Coach: {Pat Volunteer} · "Coach to be announced." |
| `mail.moved.button` | See your registration |
| `mail.moved.contact` | Questions? Contact {club} at {email}. |

### 9.3 The coach invite

Mirrors the club's rep coach invite (`clubCoachInviteHtml`): the same button pattern and the same 7-day foot.

| Key | String |
|---|---|
| `mail.coach.subject` | You’re coaching {Jays} — {season} |
| `mail.coach.heading` | {club} added you as a coach of {Jays} |
| `mail.coach.line` | Your team page lists your {3} players in {division} and how to reach their families. The season’s schedule is on {club}’s site. |
| `mail.coach.button` | Accept and open your team |
| `mail.coach.foot` | This link works for 7 days and signs in with {pat.volunteer@example.com}. If you don’t have a FieldLogicHQ account, you’ll set one up first. If you weren’t expecting this, you can safely ignore this email. |

---

## 10. The coach's door (J)

### 10.1 The sign-in card

| Key | String |
|---|---|
| `coachCard.title` | {Jays} |
| `coachCard.sub` | {club} · {division} |
| `coachCard.badge` | Coach |

### 10.2 The team page

| Key | String |
|---|---|
| `coachPage.eyebrow` | {division} · {season} |
| `coachPage.title` | {Jays} |
| `coachPage.coaches` | Coach {Pat Volunteer} · "Coaches {Pat Volunteer} and {Sam Lee}" |
| `coachPage.players` | Players {3} |
| `coachPage.copy` | Copy emails |
| `coachPage.copied` | Copied {3} emails. · fallback: "Select the emails below to copy them." |
| `coachPage.family` | {Parent Patel} · {email} · {phone} (a missing phone is left out, never "—") |
| `coachPage.email.aria` | Email {Parent Patel} |
| `coachPage.call.aria` | Call {Parent Patel} |
| `coachPage.schedule.title` | Schedule |
| `coachPage.schedule.body` | Your games aren’t listed on this page yet. **See the season’s schedule** (the club's public schedule) |
| `coachPage.scores.title` | Scores |
| `coachPage.scores.body` | The club enters scores for now. |
| `coachPage.foot` | Fees, ratings and other teams aren’t shown here. Questions about the team? Contact {club} at {email}. |
| `coachPage.empty` | No players on this team right now. |
| `coachPage.switch` | Your teams (the switcher, only for a coach of two or more) |

### 10.3 When the page isn't there

| Key | String |
|---|---|
| `coachPage.gone` | You’re no longer a coach of {Jays}. Questions? Contact {club} at {email}. |
| `coachPage.finished` | {season} has finished. This page stays until {Dec 1}. (30 days after the season finishes, then the card goes) |
| `coachPage.wrongUser` | This invite was sent to {pat.volunteer@example.com}. Sign out, then open the link again and sign in with that address. (reuse the rep invite's refusal if its words match; see §15) |

---

## 11. The family status page (K)

| Key | Label | Value |
|---|---|---|
| `status.team` | Team | {Cardinals} · before publishing: "Not set yet" |
| `status.team.wait` | (sub-line under the rows, before publishing) | We’ll email you when the teams are set. |
| `status.coach` | Coach | {Pat Volunteer} · two: "{Pat Volunteer} and {Sam Lee}" · none: "To be announced" (row absent before publishing) |
| `status.moved` | (sub-line under the rows) | Moved from {Jays} on {Nov 2}. |

The Team and Coach rows show only for an accepted child. A child to review, waitlisted, declined or withdrawn keeps 9b-2's card
unchanged.

---

## 12. The sign-up form (L), ruled 9c·9

Under the **Parent or guardian** fields, in the form's dim note style, every season:

| Key | String |
|---|---|
| `signup.coachSees` | Your child’s coach will see your name, email and phone to reach you about the team. |

---

## 13. What the registrar reads (M)

The registrar reads the board with no rating chips, no averages, no balance line, no lock, no "Moved by you", and no buttons
(Rate, Run, Draft again, Publish, Tools' "Take all players off teams", pencils, ⋯). Their Export has no rating column. Their
state pill and its click line are the same as the convenor's. No new strings.

---

## 14. What changed from the drawings, and why

1. **"children" became "players" on staff counts** ("Deals the 5 players", "2 players · avg 3.5", "Not on a team"), matching 9b-2's
   staff singulars. Families still read "child".
2. **The Publish foot no longer mentions "the season's 3 sends a day".** That cap arrives with 9d's composer; in 9c the season
   email has no cap, so the line described a rule that doesn't exist yet. It now reads "3 emails, one per family".
3. **The coach page's Schedule slot** said "The club hasn't published the schedule yet", which is false for a club that has one
   (the season's public schedule exists today; the coach page just doesn't list it until 9d). It now says the games aren't on
   this page yet and links to the season's schedule. **Scores** says "The club enters scores for now", which is true today.
4. **The coach invite** follows the club's rep invite (button "Accept and …", the 7-day foot, "you can safely ignore this
   email") rather than the drawing's "Reply and it reaches the club", which wasn't true of an invite.
5. **The family emails close with "Questions? Contact {club} at {email}."**, the 9b-1 contact line, instead of "Reply to this
   email", which depends on a reply-to the build would have to confirm.
6. **"Clear all assignments" became "Take all players off teams"**: it says what happens, and "assignments" is a system word.
7. **Lock words were added** (not drawn; ruled 9c·3).
8. **The status page's Coach is its own row** (from /design, matching today's label-left, value-right rows).
9. **A coach's state** gained **Invite expired · Send again** (the invite link lasts 7 days, as the rep invite's does).

## 15. Open word questions

1. **Publishing with accepted players not on a team.** Not ruled. **Recommendation:** warn, don't block
   (`publish.check.unplaced`), because a player accepted after publishing is placed later by the ruled path. If the owner
   prefers a block, the button is absent and the line reads "Put every accepted player on a team first."
2. **"the" before a team name.** "Move Liam to the Cardinals?" reads well for plural names; "to the U10 Red" doesn't. Neither
   the data nor the drawing settles it. **Recommendation:** never write "the" in a template; write "Move {Liam Chen} to
   {Cardinals}?" and "on {Cardinals}". It reads slightly flat for "Cardinals" and right for every other kind of name.
   The templates above are written this way.

## 16. Checks

`npm run check:spelling` scans the code only; by eye: "colour" (the team's Colour field, Canadian and permanent), no
"installment", no "financial year", one clock time through `formatTime()`, the possessive through `possessive()` (Jays’ coach,
Nora’s team), no "Approved" in a family string, no "coming soon" or stage names on a screen. The fixture names, emails and
phone numbers above are examples and take `spelling-ok` if copied into a test string.
