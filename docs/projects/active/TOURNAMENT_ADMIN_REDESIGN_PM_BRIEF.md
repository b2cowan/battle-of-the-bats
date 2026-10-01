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
> (§252 and §254, with the follow-ups'), so no walk is open on this project.
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
