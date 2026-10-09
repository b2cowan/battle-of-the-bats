# Tournament admin redesign — PM brief

> **Status:** build. The walk, the stage ladder and Stage 1 (game day) are drawn on the project hub
> (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM), 2026-09-28; Stage 1 redrawn 2026-09-29 after a check
> against the portal's written formatting rules, and ruled the same day. The defects pass is built and
> committed (2026-09-29); its owner walk (§251) PASSED the same day, 24 of 24. **Stage 1 (game day) is built and
> committed (2026-09-30)**, measured against the drawings (within a few pixels on every first-screen figure); its owner
> walk (§253) PASSED on 2026-09-30, 31 of 31, every step in both looks. Two things differ from the drawings on purpose: the "Running late?"
> card shows only while there are games left to play (the test event's are all past), and a waiting score's
> editor offers Finalize until the organizer changes a number. **Stage 2 (Teams and Communications) was drawn
> and ruled on 2026-09-30**, every question as recommended, **and built and committed the same day**: first the
> email that reached every registered team (it now reaches the accepted teams, and each email's record lists who it
> reached, from now on), then the form window's named Previous / Next, then Teams and Communications themselves,
> reviewed before the commit. **On 1 October the owner's notes from walking the pool board (§252) were ruled and
> built the same day:** one toolbar in every division (the division, Search, Filter and a Tools menu holding Select
> many, Swap, Randomize and Registration questions), a team's record that opens for reading and edits whole from
> its pencil, the waiting count as the amber pill, and Export as one button; /marketing kept every new word,
> including the review's "Enter a full email address to save it.". **The owner closed every walk on 1 October**
> (§252 and §254, with the follow-ups'), so no walk is open on this project. **Stage 4 (after the event) was drawn on
> 5 October** on the hub's Stage 4 tab; its first question (who draws the dashboard before an event) was ruled the
> same day — Stage 5 — and a design review tightened the drawing in thirteen places (below), all applied on the
> owner's "go ahead". **The owner ruled the rest on 6 October, all as drawn and recommended.** **Stage 4 was built
> and committed the same day**, after the owner settled five small questions at its start (all as recommended) and
> after a cleanup pass, a five-way review and the screen probes fixed a dozen things first — the biggest, the board staying blank after
> Mark complete until a reload. **Two owner walks are open:** the morning after, from a phone (§275), and statuses
> and the way back, at a desk (§276), on the hub's QA tab. **Stage 6 (the volunteers — the scorekeeper and the
> gate) was drawn on 7 October** on the hub's Stage 6 tab and **ruled the same day, every drawing as drawn and every
> question as recommended**; the build prompt is written and asks two small placements at its start.
> **Stage 6 was built on 7 October** (three commits, after a cleanup pass and a five-way review): a volunteer now
> lands on the job they were given, the organizer can change that job later in Members, the score sheet and the
> install banner no longer cover anything, and the Staff kit prints one clean page. Its owner walk, a
> volunteer's game day from a phone (§282), **passed on 8 October 2026**.
> **Stage 3 (the schedule) was drawn on 9 October** on the hub's Stage 3 tab, measured on the demo's live game day:
> eight drawings and fourteen questions, **ruled the same day, every drawing as drawn and every question as
> recommended**. A small defects pass runs first, then the build. **The defects pass was built on 9 October** (`279f1e5d`): a
> generator draft never deletes a played game and saves in one step, drafts avoid every diamond already in use, a refused
> save says why, a moved bracket game tells its teams, and the reminder sentence is true. Its owner walk is §286 (walk 8).
> One database change goes to production before this code.
> Plan: `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`.

## What this is

The tournament screens got a new look on 28 September (the coaches portal's look, Warm and Dark). Their
layouts didn't change. This project changes the layouts: what each screen shows first, how few taps a job
takes, and what can go. It runs in stages, and each stage is drawn, ruled by the owner, built, and walked.

## What an organizer sees and does differently in Stage 1 (game day)

- **The board opens on what needs them.** Scores waiting to be finalized come first, then games that
  still need a score (with the day, when it isn't today), then what's playing and what's next. The
  summary figures move below them. The "you can mark this complete" line appears at the top only when it
  is true, instead of sitting at the bottom of three phone screens. Each list says its count once, and on a
  phone the lists sit in one frame, as at a desk and as the coaches portal's own lists do.
- **Tapping a game opens that game.** Today, tapping a game on the board opens the Results list on the
  first division, and the organizer searches for it again: five taps to the score box. After: one.
- **Results opens on the work.** Unscored and waiting games in every division, not the first division's
  full list. The whole row is the target; the 22px pencil and the unlabelled tick go. A waiting score
  keeps one worded Finalize button, now olive rather than lime (the owner's call: lime marks the one main
  action on a screen). A tie says Tie.
- **The screens stay current by themselves.** Results and Check-in refresh on their own, as the board
  already does. A second gate volunteer's check-ins and a scorekeeper's submissions appear without a reload.
- **Check-in puts the word on the button used most.** One worded "Check in" per row on a phone; No-show
  moves into the team's sheet, which already asks it well. The counts at the top become the filter, as
  the gate volunteer's own row of four buttons (All, Not arrived, Checked in, No-show), with All chosen
  when the page opens, as today. Who still owes money is a count under it, not a button. Whether that button sits in the row beside its arrow (the coaches
  portal's own phone form) or across a card of its own (six teams on a phone's first screen against four)
  is the owner's open question.
- **The event is named once, with one status.** The pinned header names the event and says "Game day" by
  one rule; the pages below stop repeating it, and the dashboard stops saying the status four ways. The
  dashboard keeps its own "Dashboard" title, like every coaches portal screen.
- **One word per game state** on every screen: Needs a score, Pending Review, Final, Forfeit, Tie.
- **A place for what's next.** A "Running late?" door opens today's rain-delay tool, and is where Storm
  Mode will live; a reserved spot marks where the Big Board's "show on a screen" will go. Neither is built
  here.

## What an organizer would see and do differently in Stage 2 (Teams and Communications) — ruled 2026-09-30, build next

- **Teams opens on the teams.** Today, on a phone, no team is on the first screen: the money summary opens by
  default and pushes the list down to 783px, behind the phone's bottom bar (on the demo's 15-team event, a screen
  and a half down). After: registration health, money and "registration open" become three one-line rows under an
  "At a glance" heading, each opening when tapped (closing registration moves inside its row, with a sentence
  saying what it does), and the first team is at about 469px, with three teams on the first screen. At a desk the
  first team moves from 687px to about 519px.
- **A team waiting for a decision is on the screen, with its Accept.** Today, in a division with pools, a new
  registration isn't shown at all; the organizer reaches it through the health panel, and accepting takes five
  taps. After: the waiting teams are the first group in their division, each with an Accept button, and Teams
  opens on the division that has one. Two taps (Accept, then the confirm that says whether the coach is emailed).
- **Tapping a team opens the team.** Today a small arrow folds details open in the list, with tiny icon buttons
  and Delete among them. After: the whole row opens the team's page — full screen on a phone — with payment first,
  a one-tap "Mark paid" as at the gate, details that save as you type, and Delete at the bottom, asking first.
  Its foot names the previous and next team, so recording a run of payments is "Mark paid, Next" for each team,
  with no going back to the list and no typing.
- **One frame, one colour per status, words not letters.** Each pool is a heading inside one list instead of its
  own card; a team's status is said once, by the group it sits in; payment reads "Paid" or "Owes $475", as at the
  gate, instead of coloured letters and dollar signs.
- **Communications says who a message reaches.** One list of messages instead of four tabs. The email line says
  "18 teams" and the email reaches those 18 (today it says 18 and reaches 22, including a team the organizer
  rejected — the owner decides whether that is fixed now). Choosing which teams get an email, which Tournament
  Plus already sells, is drawn as a real choice for Plus and a lock with the plan's name for the free plan — or the
  owner drops the promise until it's built.

**The owner's five questions for Stage 2, ruled 2026-09-30:** a waiting team's row carries Accept, and a waitlisted
team's carries Promote only when a spot is open; email targeting is built for Tournament Plus (it is already sold),
locked with the plan's name on the Tournament plan; the email-to-everyone problem is fixed first, on its own; a
waiting team shows at the top of its own division; and selecting many teams stays Teams' own until a club screen
needs the same thing. One small placement is left for the build's first message: what the Tournament plan sees
where Promote would be.

## What an organizer would see and do differently in Stage 4 (after the event) — drawn 2026-10-05, ruled 2026-10-06

The morning after a tournament an organizer does four things: sees who won, sets up next year, shares and prints
the results, and tidies up. Measured on the demo's finished Season Opener (the only finished event in any test
data) and the free test club.

- **The board says how it finished.** Today a finished event's board says "Tournament complete" twice and has two
  lime buttons to the same summary; the one champion sits at 547px on a phone, and a division that never played a
  final isn't mentioned. After: each division in one card at the top (about 196px) — the champion with the final it
  won ("beat Riverdale Rapids 5–4"), and a division without a final with where its top team finished — then the
  weekend in one line (the teams that played, games, money).
- **Next year is one button.** Today the only way is an 18px "Did you know?" link that opens Summary, where the
  button sits in a closed card at the bottom: four taps and a different window from the one the Tournaments list
  uses. After: "Reuse this setup" is the board's one main button (about 513px on a phone), and every door — the
  board, Summary, Past tournaments, the event's own page — opens the same short form with the event already chosen:
  two taps and the dates. Summary's own version goes. On the free plan the button is a plain lock line with the
  plan's name.
- **Summary fits a phone, shares the champions page and prints clean.** Four figures in one card instead of four
  tall cards; "Next year" open instead of closed 1,553px down; Share copies the public champions page (today it
  copies the standings); Print prints the recap only (today it prints the admin's menu and header around it). The
  page goes from 1,755px to about 875px on a phone. The free plan sees one line saying what Summary holds, not a
  full-page upsell.
- **Status changes ask first, and the way back from an archive is where people look.** Today the Tournaments list
  changes a status the moment a menu changes — moving a live event to Draft takes its public site down with no
  question — and bringing an archived event back fails after the tap when the plan is full. After: each event opens
  its own page (its status in words, what each change does to the public site, Reuse, Seal, Delete), and every
  change asks first. Each event lives on one list: the Tournaments list shows what's ahead (live and draft), and
  Past tournaments — already in the menu — holds every finished event (completed, archived, sealed) and opens the same
  page, so "bring it back" and "reuse" live where people look after the event.
- **One name per page.** "Tournaments" everywhere (the browser tab and the help say "Manage Tournaments");
  "Past tournaments" everywhere (its title says "Archives"); "Summary" everywhere (today also "Post-event summary",
  "event summary" and "post-tournament summaries").

**The design review (5 October), applied:** the recap counts the 8 teams that played, not the 9 that registered (the
first drawing carried today's registration count, which the printed standings beneath it contradicted); the phone's
"Review event summary" strip steps aside on the board, where the Summary card already is, and never invites a free
organizer into a locked page; the finished events moved off the Tournaments list so no event sits on two lists; win–loss
records read "3-0-0" as everywhere else in the product; and smaller wording and sizing fixes (the record says the year
once, a full plan names the event holding its slot, the confirm repeats the button's own words, desk window buttons at
the computer's height).

**What the measuring found that nobody had asked about:** inside an event there is **no link to the Tournaments
list at all** — not in the menu, the phone's More, or the account menu — though status, reuse, sealing and delete
live there. And on the free plan, **setting up next year's event takes this year's public results offline**: the
one slot stays taken by the finished event until it is archived, and archiving takes its site down. That one is a
packaging question for the business, not a screen; the drawing just makes the board say it. The questions
(A19–A24 on the hub's Stage 4 tab) were ruled on 6 October, all as recommended: the finished events move to Past
tournaments (in the menu), so the missing link matters less, and the free-plan question goes to the business owner of
pricing.

**As built (6 October).** Everything above shipped as drawn, plus a handful of calls made while building, each on
the hub's "Built" part for the walk to question: a sealed event can never be reopened; Bring back says before any
tap when the plan is full or another event took its link; changing a public link asks first; at the slot limit New
tournament becomes the plan's lock line; an event nobody played in shows its figures instead of an empty list; and
the money shows whenever anything was collected, fees or not. Measured: sharing the champions page is one tap,
printing is one tap plus the browser's (one page, nothing of the admin on it), next year's draft is a tap, the dates
and a tap, and bringing an archived event back is three taps and its question. The help now describes the new
board, Summary, reuse, the two lists and every status change, and old searches (Manage Tournaments, Archives,
Post-event summary) still find it.

**One Tournaments list, drawn and ruled 6 October after the build (the owner's question).** Ruled: one list as
drawn, every band open, and the door in the Admin section where "Past tournaments" sits today rather than at the top
of the menu (the list is visited now and then; switching events and starting a new one already have their own
buttons). The drawing below described the first version. **Built the same day:** the list, the Admin entry on
a desk and on a phone, the old Past tournaments address opening the list, and the wording and help that pointed
people to Past tournaments. A status change now keeps the tournament's page open while it moves group behind it.
The desk walk (§276) is rewritten for one list. Walking the desk walk,
the owner couldn't find the Tournaments list (there is still no way to it from inside an event) and asked why there
are two lists at all. Drawn on the hub's Stage 4 tab: **one page, "Tournaments"**, with what's ahead on top and what's
finished below it (Active · Draft · Completed · Archived · Sealed records), each band saying once whether its public
sites are up; and **one door, "Tournaments"**, at the top of the side menu and of the phone's More, on every page,
replacing "Past tournaments". It also fixes something the drawing found: on the free plan the morning after, the list
says the plan's one slot is full and shows no event, because the finished event holding the slot sits on the other
page. With one list it's the first row under that line. Nothing about statuses, slots or data changes; the wording
that points people to "Past tournaments" changes with it, and the desk walk (§276) waits for the ruling.

## What a volunteer would see and do differently in Stage 6 (the scorekeeper and the gate) — drawn and ruled 2026-10-07

A parent handed a phone and a link — or a QR code taped to the scoring table — does one job, fast. These two screens
were already the strongest in the tournament product, and the measuring agrees: from the code to a submitted score is
three taps and the typing, checking a team in is one tap, and switching between scoring and the gate is one tap. So
the stage keeps every shape the owner ruled (the game cards, the counts under the thumb, the jobs as tabs) and removes
only what gets in the way. Measured on the test clubs' volunteer accounts on 7 October, read-only.

- **Nothing covers the controls.** On an iPhone today the "Install FieldLogicHQ" banner arrives with the first screen
  and sits on top of the four count buttons — a tap on "To score" hits the banner — and it stays on top of an open score
  sheet, hiding the note that says whether the score goes to the organizer for review. After: it sits above the bars
  and every sheet covers it.
- **Every button is thumb-sized.** Cancel and Submit, Today, Filters and Refresh are 42px today; on a tablet at the
  scoring table the link to the gate is 19px tall and Sign out 15px. After: 44px, phone and tablet.
- **A waiting score is visible.** The Review count wears the same amber mark the organizer sees for waiting work; after
  submitting, a short notice ("Sent for review · Wolves 7, Royals 4") floats and fades instead of pushing the list down
  and staying. If the organizer sends a score back while the screen is open, a notice says so.
- **The screens read cleanly.** The bars stop showing the page through them; "11:30 A.M." becomes "11:30 a.m." as
  everywhere else; the score sheet and the gate's team sheet take the same sheet shape as the rest of the product.
- **A gate volunteer lands on the gate.** Today a volunteer invited "for the gate" lands on the scorekeeper after
  accepting the invite and every time they sign in again (the QR code works; the invite and the next morning don't).
  The recommendation: what the organizer picks when inviting ("helping with the gate") becomes what the volunteer can
  do, and every landing follows it — a change to the roles the Club tier shares, so it is the owner's call with them.
- **Staff keeps its home.** June's walk said a `staff` member lands on the full dashboard. True — but staff is the
  organizer's helper (it runs the schedule and posts too), so the board is the right home; the gate parent's real
  problem is the role they were given, which the point above fixes.
- **The organizer's Staff kit prints one clean page** for the volunteer table (today it prints the whole admin around
  the QR codes), with white buttons and an "Invite a volunteer" door.

**Why it matters:** volunteers are the least-trained people on the busiest day, often on a borrowed phone. Every
covered button or wrong landing becomes a question for the organizer at the worst moment. **Ruled 7 October, all as recommended:**
A25–A32 on the Stage 6 tab; two (where staff lands, and the volunteer's job) touch roles shared with the Club tier.
The build starts with two small questions the drawing does not show: who may change a volunteer's jobs after the
invite (today only an owner), and what happens to a volunteer with no job left. **Not affected:** scoring rules, the review policy, check-in itself (Stage 1's board stays
as built), prices and plans.

**Built 7 October.** The owner answered the two starting questions as recommended: anyone who may invite can change
a volunteer's job later, in Members, and a volunteer always keeps at least one job (to end their access, remove
them). The pricing pages now call these people "volunteers" too — the word changed, the free-seat rule did not.
**Success, measured on the build:** a gate volunteer's next-morning sign-in lands on the gate from every door; nothing
a volunteer taps is under the thumb size; the first score card sits where it was drawn, and the list no longer jumps
after a score; the banner covers none of the buttons; the Staff kit prints on one page. The owner's walk (§282)
passed on 8 October 2026.

## What an organizer would see and do differently in Stage 3 (the schedule) — drawn and ruled 2026-10-09

A director builds the schedule at a desk the week before and fixes it from a phone on the Saturday. Measured on the
demo's own game day (9 October), the screen fights the second job: it opens on a round robin whose games are all
played, today's semifinals and final sit behind a switch, the bracket names no team and no score, and a game dragged on
the timeline saves at once with no way back.

**On the Saturday, from a phone:**
- **The schedule opens on today** — every game of the day in time order, every division, the round robin and the
  playoffs together, played games with their scores and the game being played marked. Today's games from the board:
  **8 taps today, 1 drawn.** Before the event it opens on the first day, after it on the last.
- **A game opens that game.** One window reads the game first (when, where, the score, the bracket, who sees it) and its
  pencil edits the whole thing. Today a row folds into a cramped form and the score lives on another page.
- **Every move can be taken back.** After a drag, the phone's move sheet, the game window or the rain delay, a notice
  offers **Undo** for a few seconds. A game that is published asks once before it moves, because its teams are told — and
  an Undo inside the first ten minutes tells nobody (the product already holds those alerts back).
- **Two games can't be put on one diamond at once inside the tournament**: every way of moving a game refuses it, with a
  red line that names the other game. A booking of the club's other programs only warns, in the amber line the club
  stage built.
- **A rained-out afternoon** is still one tap from the board ("Running late?") and two from the schedule, now with a check
  that no pushed game lands on another, and Undo. Storm Mode's place is reserved at the top of that window.
- **The bracket shows who played, the score, who won and the champion** — as the public bracket already does.

**The week before, at a desk:**
- **One name** for each generator ("Round-robin generator", "Playoff generator") instead of thirteen.
- **The generator sees the other divisions** (today it can put U13 on top of U11's games) and **never deletes a played
  game** (today its default choice deletes final scores). Before saving, the window says in one sentence what saving
  adds, replaces and keeps.
- **Publishing says what it does:** what families see, that registration closes, that each linked coach team gets the
  games on its own schedule, and what a later move does. It stops promising a reminder email it never sends.

**Club coaches** see nothing new: the amber line on their side is the club stage's, unchanged. **The club's scheduler**
(Club Tier Stage 11) starts from the parts of the generator tagged "shared candidate" — the settings, the ranked drafts,
the statement of what saving does, adjusting with Undo, publishing — and not from today's generator.

**Fourteen questions, ruled 9 October, all as recommended** (A33–A46). Two departed from what the prompt proposed, and
both stand: one game length everywhere (the
dashboard's 60 minutes is the same question as the schedule's), and fixing the generators' two defects **now**, as a small
pass of its own, instead of waiting for the build.

**First, the defects pass** (before the build, its own release-ready change): no generator deletes a played game or
double-books another division's diamond, a save the server refuses says so, a game moved in the bracket editor tells its
teams, and the Publish window tells the truth about the game-day reminder. It starts with one small question for the
owner: how "replace these games" becomes one step.

**Built 9 October.** The owner chose a database step for the one-step save, so a draft either saves whole or not at all,
and a second save of the same draft (or a second organizer saving at once) is refused rather than doubling the round
robin. The drafts now avoid every game the save keeps — the division's own kept games too, which they never avoided
before. Building it found three more things hidden behind the old default, all fixed: two kinds of kept game crashed the
draft, and a round-robin game between two teams who also met in a playoff was deleted and never redrawn. Help now says
each division is published on its own. **Success, measured on the demo:** a division whose games are all played saves
nothing ("There is nothing to save."); a U13 draft squeezed onto U11's diamonds took exactly the two slots U11 leaves
free; a refused move puts the game back and says why.

**Success for this stage:** today's games in 1 tap from the board on a phone; a game's score on the schedule without
leaving it; every move undoable in 1 tap; no overlap inside a tournament can be saved by any door; no generator deletes a
played game or double-books another division; the organizer's bracket names the winner and the champion.

## Why it matters

Game day is the weekend a director is judged on, and it's run from a phone at a diamond. It's also where
the June walk and the new-look release both found the most friction. There are no customers yet, so
changing these screens now costs nobody a relearning; changing them after the first director has learned
them would.

## Who is affected

Every tournament organizer and the staff they delegate to. The gate volunteer's board is the same board
as the organizer's Check-in, so it changes with Stage 1. Tournament and Tournament Plus see the same
screens; where a Tournament organizer meets a Plus feature (the rain-delay tool, Chat), the lock is shown
with words, placement only, words by marketing. No price, plan or gate changes.

## Priority

After the new look settles, and after the look's cleanup (Part B) passes over the game-day screens. The
drawings don't wait for either; the build does. A short list of defects found on the walk shouldn't wait
for any stage (a confirm box that promises a restore that doesn't exist; a Teams button pushed off a
phone's screen): the owner decides whether they're fixed now.

**The defects pass — built and committed 2026-09-29, ahead of Stage 1 (owner walk §251).** Fourteen small fixes, each a false
sentence, an unreachable control or a wrong answer: the archive confirm tells the truth (the public site goes
offline; bring it back from the Tournaments list if a slot is free); every Teams button fits a phone; Accept and
Reject say an email goes only when one will, and to whom; Results stops promising it refreshes itself; Summary's
leader is the team the public standings put first, and no leader shows before a game is played; no "0 champions
detected", no empty activity box, no bare-text notices; and the phone's action strip never points at the page you
are on. Nothing was restyled or rearranged beyond the fix. Two notices it redrew can't be reached on any current
plan — reported for the create and reuse stages. **The owner's walk passed on 2026-09-29, every step in both looks.**

**One more, found after the walk (2026-09-29, walk §252):** on Teams, each pool's team rows showed the page's
beige paper and grid behind them under a white heading; the Waitlist too. Every pool is one white card again,
heading and rows together, as the plain team list on the same page already was. Nothing moved.

## Success criteria

- From the board, the score box of any game is **one tap** away (today five).
- On a phone, the first game that needs the organizer sits on the **first screen** of the board and of
  Results, in every division.
- Nothing on the game-day screens an organizer taps is under **38px tall**, and nothing icon-only sits
  beside an opposite action.
- Results and Check-in show a scorekeeper's or a second volunteer's change within **30 seconds**, without
  a reload.
- One status word per state across the four game-day screens, passing the one-spelling gate.
- The first real director runs game day from a phone without asking where a game went (evidence we
  don't have yet: the first real tournament decides whether this held).
- **Stage 2:** on a phone the first team is on the **first screen** of Teams; a team waiting for a decision is
  **visible and accepted in two taps**; no Teams control an organizer taps is under 38px tall or under 44px wide as
  an icon; an announcement's count is the number of teams it reaches.
- **Stage 4:** from a finished event's board, next year's draft is **two taps and the dates**, through the same form
  from every door; how each division finished is on the **first screen** of the board and of Summary on a phone;
  Share links the champions page and Print prints the recap alone; no status change is written without a question
  that says what it does to the public site.
- **Stage 6:** on a phone and a tablet nothing a volunteer taps is under **44px** and nothing covers the count buttons
  or an open sheet; from a QR code to a submitted score stays **three taps and the typing**; a volunteer invited for
  the gate **lands on the gate** every time; the Staff kit prints **one page** with nothing of the admin on it.
