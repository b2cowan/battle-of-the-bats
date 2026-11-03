# House league Stage 9e: the words (`/marketing`, 2026-11-01)

> **ACCEPTED by the owner 2026-11-01** ("accepted", to the file as written, including the recommendation on each open word
> question in §14: a coach may clear both boxes; the held rainout's line is kept with the held changes; "Level with" over
> "Level on RF"). No string was changed on acceptance.

> Copy for the three 9e builds: **9e-1** standings and the score rule, **9e-2** rainout, **9e-3** coach scores. Source: the
> drawings (`HOUSE_LEAGUE_STAGE9E_DRAWINGS.html`, https://claude.ai/artifact/V9exKafSgmHc3XuFFar5Qo), with the owner's rulings
> 9e·1 to 9e·14 in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0i. **None is reopened.** Every drawn word is kept unless a house rule, a ruling
> or the code breaks it; every change is listed in section 13 with its reason. **9e·15 (plan gate) is undecided, so this file
> has no plan-gate, upgrade, price or lock wording and names no plan.** Keys are written `like.this`. Words the code already
> says (the pencil's "Enter both scores, or neither.", "Changes to send", "Needs a new date", "Give it a new date", "Put it
> back on", the Games changed email's "Postponed: … A new date is to come.") are reused, not rewritten.

## 0. Conventions

**House rules applied, as 9c.** Sentence case everywhere. Dates through `formatStoredDate` ("Jun 17"). Every clock time through
`formatTime()` ("6:00 p.m."), no "today at": a time is always a date and a time. Every `{name}’s` is `possessive(name)`
("Twins’ coach"). Apostrophes are curly. A score is written with an en dash ("7–4"). "cancelled" has two Ls (`Canceled` is
build-gated). "house league" is lowercase in prose (`House League` is build-gated). No exclamation marks, no sales voice, no stage
names or "coming soon" on any screen. Numbers are written as numerals and pluralised with `pluralize` ("1 game", "12 games").

**"the" before a team name is never written in a template** (9c §15.2): "Twins’ coach", not "the Twins’ coach".

**Words that mean one thing.**

| Thing | Words | Never |
|---|---|---|
| A game's result | **score** (verb **enter**: "Enter the score"); a finished one reads **Final 7–4** | "result" (as a button), "submit", "record" |
| The 1–5 draft number | **rating** (9c). Never the word "score". | "score" for a rating |
| A game that has both scores | **counts** ("A game counts once both scores are in") | "completed", "played" in a sentence a family reads |
| The table | **standings** (the page, the switch); **the table** only when pointing at the grid | "leaderboard", "ladder" |
| A team's place | **1st of 6**; level teams **T-3** (screen) / **Tied for 3rd** (tooltip, coach line) | "joint", "equal" |
| Two teams with the same points | **level** ("teams level on points"); a **tie** is a game that ended even | "tied on points", "draw" |
| A coach telling the club a score is wrong | **report** ("Report this score"); the state is **Reported** | "flag", "dispute", "challenge" (the record may be called a flag in code; no screen says it) |
| The club person who fixes a score | **the league admin** on a coach's screen; the person's **name** on the club's screen | "the club" for who corrects |
| Changing a score on the club side | **correct** ("Correct the score") | "override", "edit" (edit is the pencil) |
| Calling off a day | **Rainout** (the button, the window, the title) | "rain delay" (that is the tournament's), "weather cancel" |
| What a rainout does to a game | **postpone** (default) / **cancel** | "reschedule", "call off" as a button |
| People counted in an email send | **families**: "1 family" / "{n} families" (9d-2b rule; a family = one guardian email) | "households" (the drawing used it; see §13.1) |
| The cheque for emails you cannot recall | **Emails can’t be taken back.** | "irreversible", "final" |
| Undoing a held rainout | **Put all {n} back** | "Undo" as the button word |
| The held list | **Changes to send** (exact, as built) | "outbox", "queue" |

**Not in these strings:** a plan gate, a lock, an upgrade line or a price (9e·15); a coach messaging families; any email about a
score or a correction (ruled 9d2·13: scores and notes never email); a make-up date picked in the rainout window (9e·11); a
per-season points door (9e·2); a coin toss (9e·3); the "Final standings" tag (9f).

---

# Part A · 9e-1: Standings and the score rule

## 1. The public standings page

Where: `/{org}/league/{season}/standings`, read by families and anyone with the link. Light, club-themed.

### 1.1 Head and the table

| Key | String | Tag |
|---|---|---|
| `stand.title` | Standings | keep as built |
| `stand.sub` | {Season name} | keep as built |
| `stand.tab` | {Division name} | keep as built |
| `stand.col.rank` | # | keep as built |
| `stand.col.team` | Team | keep as built |
| `stand.col.gp` | GP | keep (tooltip below is new) |
| `stand.col.w` / `l` / `t` | W · L · T | keep |
| `stand.col.pts` | Pts | keep |
| `stand.col.for` | **RF** (ball). From the sport: `score.forAbbr` | RESTYLED: was GF for every sport |
| `stand.col.against` | **RA** (ball). From the sport: `score.againstAbbr` | RESTYLED: was GA |
| `stand.col.diff` | **RD** (ball). Sport's differential abbreviation | RESTYLED: was Diff |
| `stand.col.record` | W-L-T (phone's one record column; basketball would read W-L) | NEW, drawn |
| `stand.tied` | T-3 (a shared place; the next team takes the place after, so T-3, T-3, 5) | NEW |
| `stand.dash` | – (a dash, not 0, before a team has a counted game) | NEW |

**Plain-words key (the tooltips on the column heads, and the screen-reader name).** Sentence case; the sport's own words
(the sport pack's labels are Title Case, so the build lowers the tail: "Runs for").

| Key | Tooltip (ball) |
|---|---|
| `stand.tip.gp` | Games played |
| `stand.tip.w` / `l` / `t` | Wins · Losses · Ties |
| `stand.tip.pts` | Points |
| `stand.tip.for` | Runs for |
| `stand.tip.against` | Runs against |
| `stand.tip.diff` | Run differential (runs for minus runs against) |
| `stand.tip.record` | Wins-losses-ties |
| `stand.tip.tied` | Tied for {3rd} |
| `stand.tip.dash` (aria-label) | No games scored yet |

Phone line under the table, keep as drawn: **Swipe the table for GP, RF and RA.** (the three names follow the sport).

### 1.2 The ranking box (the one source for the public page, the admin page and the phone)

The footer text typed twice today ("Pts: W=2, T=1, L=0 · Tiebreaker: run differential, then runs for") is replaced by this.
The numbers come from the same rules the table sorts by, so the words cannot disagree with the order.

| Key | String | Tag |
|---|---|---|
| `rank.title` | How the table is ranked | keep as drawn |
| `rank.points` | A win is {2} points, a tie {1}, a loss 0. Teams level on points are ordered by: | keep as drawn (`pluralize`: "1 point") |
| `rank.1` | The game between them, when exactly two teams are level | keep as drawn |
| `rank.2` | Run differential (RD) | keep as drawn (the abbreviation follows the sport) |
| `rank.3` | Runs for (RF) | keep as drawn |
| `rank.shared` | Teams still level share a place, shown as “T-3”. A game counts once both scores are in. | CHANGED: was "Only played games count." (§13.2) |
| `rank.short` | A win is {2} points, a tie {1}. Level on points: the game between them (when exactly two teams are level), then run differential, then runs for. Still level: a shared place. | CHANGED: the phone's one-paragraph form; was "head-to-head between two" (§13.3) |

### 1.3 Before there is a table to show (9e·4)

| Key | State | String | Tag |
|---|---|---|---|
| `stand.unpub` | The division's schedule is not published | Standings show here once the schedule is up and the first scores are in. | CHANGED: was "…once the schedule is published and games are played." Families say "up" (§13.4) |
| `stand.noScore` | Published, no counted game yet | Standings start with the first score. Teams are in alphabetical order until then. | keep as drawn (rows: team name, – , –; no rank) |
| `stand.off` | The division's switch is off (§3), reached by a link | {Division} doesn’t keep standings. Its games are on the Schedule. | CHANGED: was "doesn’t keep a table" (the switch is called Show standings) |
| `stand.offAll` | Every division is off | This league doesn’t show standings. The games are on the Schedule. | NEW |
| `stand.schedule` | The link in both lines above | Schedule | keep (the page's existing schedule link) |

Replaces today's "No games have been completed yet. Check back once the season is underway."

### 1.4 The score rule, as families and staff read it

| Key | Where | String | Tag |
|---|---|---|---|
| `rule.counts` | The ranking box (above) and the game window's score hint | A game counts once both scores are in. | NEW |
| `rule.hint` | Under the pencil's score boxes in the game window (staff) | A game counts in the standings once both scores are in. Clear both to put it back to scheduled. | NEW (a hint; the help article already says this) |
| `rule.both` | The pencil, one box filled | Enter both scores, or neither. | keep as built (`GAME_WINDOW_WORDS.bothScores`) |
| `rule.whole` | The pencil, not a whole number | A score must be a whole number, 0 or more. Enter both scores, or neither. | keep as built |
| `rule.clearedSaid` | After a save with both boxes empty | Back to scheduled. | NEW (the server now does this for a direct call too; the window's own wording is unchanged) |

There is **no new error string for "both empty"**: both empty is a valid save that puts the game back to scheduled; only one
box filled is refused, with the built sentence.

## 2. The admin standings table

Where: the season rail's Standings item, club side (owner, admin, league admin, registrar, treasurer, anyone who reads house
league). Same columns as §1.1, same tooltips, same ranking box.

| Key | String | Tag |
|---|---|---|
| `adminStand.title` | Standings | keep |
| `adminStand.export` | Export | keep |
| `adminStand.tied` | T-3 | NEW (as §1.1) |
| `adminStand.level.col` | Level with | CHANGED, Option B below |
| `adminStand.level.cell` | {Rays} · two teams: {Rays and Hawks} (tooltip: Level on points, run differential and runs for) | CHANGED, Option B below |
| `adminStand.rules` | Ranked the way the public page ranks it. The rules come from the season’s sport ({Softball}) and can’t be changed here. | CHANGED: was "…are the ones the public page shows… can’t be edited here" (§13.5) |
| `adminStand.empty` | No scores yet. Standings appear once a game has both scores. | CHANGED: was "No completed games yet — standings will appear once scores are entered." |
| `adminStand.noteUnpub` | Families can’t see this table yet: {Division}’s schedule isn’t published. | NEW (shows above the table; the admin sees the table either way) |
| `adminStand.noteOff` | Families can’t see this table: standings are off for {Division}. | NEW |

**Option A (as drawn):** a column "Level on" with the chip **Level on RF**.
**Option B (recommended):** the column "Level with" naming the teams, **Rays**. "Level on RF" does not say who the team is
level with, which is the only thing an admin asks about a T-3. The tooltip carries the three rules.

## 3. The "Show standings" switch

Where: the division's setup, on by default (9e·5). Club side, who runs house league.

| Key | String | Tag |
|---|---|---|
| `switch.label` | Show standings | keep as drawn |
| `switch.help` | Turn off for a division that doesn’t rank teams. Families won’t see its table and coaches won’t see a standing line. You still see the table here. | NEW (one sentence per consequence, in the order a person asks them) |
| `switch.on` (toast) | Standings are on for {Division}. | NEW |
| `switch.off` (toast) | Standings are off for {Division}. Families can’t see them. | NEW |

## 4. The coach's standing line

Where: the coach's team page (`/{org}/league/{season}/team/{id}`), top of the Scores section. Read by the team's coach.

| Key | Case | String | Tag |
|---|---|---|---|
| `coachStand.line` | Ranked | {1st} of {6} · {4-1-0} · {8 points} | keep as drawn (desk may add "in the {U12 Division}" after "of 6") |
| `coachStand.tied` | Level with another team | Tied for {3rd} of {6} · {3-2-0} · {6 points} | NEW |
| `coachStand.one` | One point | … · 1 point | NEW (`pluralize`) |
| `coachStand.none` | Published, no counted game yet | Standings start with the first score. | NEW |
| `coachStand.link` | The link | See the standings | keep as drawn |
| `coachStand.heading` | The section | Scores and standings when the line shows; **Scores** when it does not | CHANGED: the drawing always said "Scores and standings", which is untrue when the switch is off |
| absent | Switch off, or schedule not published | no line, no "unranked", no placeholder | keep as drawn |

---

# Part B · 9e-3: Coach scores

## 5. The coach's Scores section

Where: the coach's team page. Coach of the team only (Q7). Replaces the stub **"The club enters scores for now."**, which goes.

| Key | String | Tag |
|---|---|---|
| `cs.title` | Scores | keep (see `coachStand.heading`) |
| `cs.today` | Today · {Jun 17} (the game row's day head) | drawn, keep |
| `cs.row.home` | {Twins} vs {Royals} · {6:00 p.m.}, {Maple Grove Park · Diamond 2}, a small "Home" tag after the field | CHANGED 2026-11-03 (phone review): was "you are the home team" on every row |
| `cs.enter` | Enter the score | keep as drawn (button, desk and phone) |
| `cs.change` | Change the score | NEW (the same door once a score is in; absent when reported or corrected) |
| `cs.final` | Final {9–3} | keep (the built public word) |
| `cs.away` | {Twins}’ coach enters the score. | CHANGED: was "The Twins’ coach enters the score." (§13.6) |
| `cs.foot` | Scores count in the standings as soon as they are entered. The league admin can correct them. Families aren’t emailed. | keep as drawn |
| `cs.foot.off` | Scores show on the schedule as soon as they are entered. The league admin can correct them. Families aren’t emailed. | NEW: the same line when standings are off |
| `cs.empty` | No games from today on. | keep as built (`coachNoneAhead`) |

### 5.1 Who entered it, as a coach reads it

| Key | Reader | String | Tag |
|---|---|---|---|
| `cs.by.me` | The coach who entered it | Entered by you at {8:12 p.m.} | CHANGED 2026-11-03 (phone review): was a two-sentence line; the "change until" rule is said once, in the Change window (`win.hint`) |
| `cs.by.other` | The other team's coach | Entered by {Twins}’ coach at {8:12 p.m.} | CHANGED: was "…the Twins’ coach…" |
| `cs.by.club` | Either coach, after a correction | The league admin corrected this score. | NEW |
| `cs.reported.me` | The coach who reported | You told the league admin this isn’t right. The score stands until they look. | NEW |
| `cs.reported.them` | The coach who entered it | {Royals}’ coach says this isn’t right. The league admin is checking it. | CHANGED: was "The Royals say…" (replaces the Change door) |

Use `{Date}` before the time when the entry is not from today: "Entered by Twins’ coach, Jun 17 at 8:12 p.m."

## 6. Entering the score

Where: the window the coach opens from "Enter the score" (desk window, phone full-screen sheet). Home team's coach, from the
game's start time.

| Key | String | Tag |
|---|---|---|
| `cs.win.title` | Enter the score (becomes **Change the score** when one is in) | keep as drawn |
| `cs.win.sub` | {Twins} vs {Royals} · {Thu, Jun 17} · {6:00 p.m.} | keep as drawn |
| `cs.win.home` | {Twins} · Home · you | keep as drawn |
| `cs.win.away` | {Royals} · Away | keep as drawn |
| `cs.win.box` (aria-label) | {Twins} score | keep as built (`GAME_WINDOW_WORDS.score`) |
| `cs.win.hint` | It counts in the standings right away. You can change it until the other coach reports it or the league admin corrects it. Families aren’t emailed. | CHANGED: was "…The league admin can correct it, and you can change it until they do." (§13.7) |
| `cs.win.hint.off` | It shows on the schedule right away. You can change it until the other coach reports it or the league admin corrects it. Families aren’t emailed. | NEW: standings-off variant |
| `cs.win.by` | Entered as {Alex Moreau} | keep as drawn |
| `cs.win.cancel` | Cancel | keep as drawn |
| `cs.win.save` | Save the score | keep as drawn |
| `cs.win.saving` | Saving… | keep as built |
| `cs.win.one` | Enter both scores, or neither. (Save is held) | keep as drawn, the built sentence |
| `cs.win.clear` | Both boxes are empty. Saving puts this game back to scheduled. | NEW: shown only when a coach empties a score already in |
| `cs.toast.saved` | Score saved. It counts in the standings now. | NEW |
| `cs.toast.saved.off` | Score saved. | NEW: standings-off variant |

## 7. The other coach: Report this score

Where: the away team's coach, on their team page, on a game that has a score they did not enter. Desk: a text door; phone: the
flag mark alone, with the aria-label below, 44 px.

| Key | String | Tag |
|---|---|---|
| `rep.door` | Report this score | keep as drawn (phone: the mark alone; aria-label "Report this score") |
| `rep.win.title` | Report this score | CHANGED on the phone sheet: was "Score isn’t right" (one name per thing) |
| `rep.win.sub` | {Twins} {7}, {Royals} {4} · {Thu, Jun 17} | keep as drawn |
| `rep.win.label` | What should it be? | keep as drawn |
| `rep.win.placeholder` | For example: we had it 6–4. | CHANGED: the drawn example named a foul ball and a 7th inning, which is ball-only (§13.8) |
| `rep.win.hint` | You can leave this empty. The score stays as entered until the league admin looks. Families aren’t emailed. | keep as drawn, one sentence on desk and phone |
| `rep.win.foot` | Sent to the league admin | keep as drawn |
| `rep.win.cancel` | Cancel | keep as drawn |
| `rep.win.send` | Report to the league admin | keep as drawn |
| `rep.win.sending` | Sending… | NEW |
| `rep.toast` | Reported. The league admin will look at it. | NEW |

Not built, deliberately (drawn): the away coach entering a different score. A reported score cannot be withdrawn by the
reporter in this stage; if the build adds that, it needs its own words (not drafted).

## 8. The league admin's side

Where: the game window and the schedule List, club side, who runs house league. A coach cannot reach any of it.

### 8.1 The three states of the game window

| Key | State | String | Tag |
|---|---|---|---|
| `club.tag.coach` | Entered by a coach, not looked at | **Coach entered** (tag) · Entered by {Alex Moreau}, {Twins}’ coach, {Jun 17} at {8:12 p.m.} | CHANGED: the drawing said "today at" (§13.9) |
| `club.tag.reported` | Reported by the other coach | **Reported** (tag) · Entered by {Alex Moreau}, {8:12 p.m.}. {Royals}’ coach says: “{We had it 6–4.}” | CHANGED: the tag was "Flagged" (§13.10) |
| `club.reported.empty` | Reported with no note | {Royals}’ coach reported this score and didn’t say what it should be. | NEW |
| `club.reported.note` | Under a reported score | This score counts until you change it. | keep, "The score counts until you change it." with "This" |
| `club.keep` | Button on a reported score | Keep {7–4} | keep as drawn |
| `club.correct` | Button on a reported score | Correct the score | keep as drawn |
| `club.kept` | After Keep, or after ✓ with no change | Checked by {Sam Lee}, {Jun 18} at {9:05 a.m.} | NEW (the "looked at" mark has no drawn words) |
| `club.corrected` | After the league admin changes it | Corrected by {Sam Lee}, {Jun 18} at {9:05 a.m.}. Coaches can’t change this score now. | CHANGED: was "Entered by the league admin… Both coaches see the new score; they can’t change it." |
| `club.entered` | The league admin enters a score nobody had | Entered by {Sam Lee}, {Jun 18} at {9:05 a.m.} | NEW (same pattern; no coach clause) |
| `club.toast.kept` | Toast | Marked as checked. | NEW |

The coach's name reads as the person ("Alex Moreau"); the other coach sees only the team ("Twins’ coach"). A removed coach's
entries keep their name (drawn edge).

### 8.2 "Scores to check"

The fold on the schedule List, same recipe as "Needs a new date".

| Key | String | Tag |
|---|---|---|
| `check.title` | Scores to check | keep as drawn (a count, not an alert) |
| `check.count` | {2} | keep (the amber count) |
| `check.help` | Scores coaches entered that you haven’t looked at. They already count in the standings. | NEW (the fold's tooltip; a reported one is listed first) |
| `check.row` | {Twins vs Royals} · {6:00 p.m.} · **Reported** · Final {7–4} · entered by {Alex Moreau} | CHANGED: "Flagged" → "Reported" |
| `check.row.coach` | {Hawks vs Cubs} · {7:30 p.m.} · **Coach entered** · Final {5–5} · entered by {Dana Silva} | keep as drawn |
| `check.row.phone` | {Twins vs Royals} {7–4} · Reported | keep as drawn, tag renamed |
| `check.empty` | (the fold is absent when the count is zero) | keep |

## 9. Refusals and states (coach and league admin)

These are server refusals as the window shows them, and the states a screen reads when the action is not available. Each is
a sentence that says what to do next or that nothing was changed.

| Key | When | String |
|---|---|---|
| `err.notHome` | A coach of the away team tries to enter | Only {Twins}’ coach enters the score. |
| `err.notStarted` | Before the game's start time | This game hasn’t started yet. |
| `err.calledOff` | A cancelled or postponed game | A cancelled or postponed game can’t be scored. |
| `err.closed` | After a report or a league admin change | This score can’t be changed now. Ask the league admin. |
| `err.changed` | A stale window | This score changed while the window was open. Close it and look again. (follows 9c's `*.err.changed`) |
| `err.finished` | The season is finished (Q16) | {Season name} has finished, so scores can’t be changed. |
| `err.gone` | The coach is no longer on the team | You’re no longer a coach of {Twins}. (reuse 9c `coachPage.gone`) |
| `err.noSignal` | No connection; what was typed stays | Couldn’t save. Check your connection and try again. |
| `err.reportOwn` | The entering coach tries to report their own score | (no screen: the door is absent) |

**The states in one line each** (what a coach reads on a game row): *not started* = no door, no sentence; *no score yet,
home coach* = "Enter the score"; *no score yet, away coach* = `cs.away`; *entered* = `cs.final` plus `cs.by.me` or `cs.by.other`;
*reported* = `cs.reported.me` or `cs.reported.them`; *corrected* = `cs.by.club`, no door.

---

# Part C · 9e-2: Rainout

## 10. The door and the window

Where: the schedule header, beside "Changes to send"; club side; owner, admin and league admin on an active season (absent for
the registrar, treasurer, coaches and a finished season).

| Key | String | Tag |
|---|---|---|
| `rain.button` | Rainout | keep as drawn (a word on the phone too: it can email hundreds of families) |
| `rain.title` | Rainout | keep as drawn |
| `rain.day` | Day | keep |
| `rain.day.value` | Today · {Thu, Jun 17} · {12 games} still to play · another day: {Fri, Jun 18} · {4 games} still to play | keep as drawn; "1 game still to play" |
| `rain.what` | What happens to them | keep as drawn |
| `rain.postpone` | Postpone them | keep as drawn (the default) |
| `rain.postpone.sub` | They leave their week and wait under “Needs a new date”. You give each a new date later. | keep as drawn |
| `rain.cancel` | Cancel them | keep as drawn |
| `rain.cancel.sub` | They stay on the schedule, struck through. You can put one back on later. | CHANGED: the drawing said "called off for good… only if you add a game", which the game window contradicts (§13.11) |
| `rain.which` | Which games | keep as drawn |
| `rain.places` | All places · {Maple Grove Park} · {Riverside} | keep as drawn |
| `rain.div` | {U10 Division} · {4 games} · {8 teams} | keep as drawn |
| `rain.div.phone` | {U10 Division} · {4 of 4} › | keep as drawn |
| `rain.game` | {Wrens vs Finches} · {5:30 p.m.} · {Maple Grove Park} · {Diamond 1} | keep as drawn |
| `rain.more` | {4} more, all ticked · {3} games, all ticked | keep as drawn |
| `rain.phoneHint` | Tick a division for all its games, or tap › to choose some. | keep as drawn |
| `rain.draft` | {U8 Division} is a draft, so none of its games are listed. | keep as drawn (phone: "U8 is a draft, so none of its games are listed.") |
| `rain.none` | No games are left to play on this day. · (no days at all:) No games are left to play. | NEW |
| `rain.tickOne` | Tick at least one game. (under a held-down button) | NEW |

### 10.1 What the press will do (the preview line, always under the list)

| Key | String | Tag |
|---|---|---|
| `rain.sum` | {12 games}, {24 teams}, {3 divisions}. | keep as drawn |
| `rain.sum.mail` | {214 emails} to {208 families}, sent as {3}, one per division. {6} of those families have children in two divisions and get two emails. The {24} teams’ coaches get a copy. | CHANGED: "households" → "families"; the two-email sentence reshaped so it adds up on the page (§13.1) |
| `rain.sum.one` | One division: {88 emails} to {88 families}. The {10} teams’ coaches get a copy. (no "sent as", no two-email sentence) | NEW: the short forms |
| `rain.sum.cap` | Doesn’t count toward today’s {three}. | NEW: reuse the built Changes to send foot's cap sentence, same words |
| `rain.sum.none` | No families to email. The coaches of the {24} teams get a copy. | NEW: no registered children on these teams |
| `rain.sum.hold` | Nobody is emailed now. The changes wait in Changes to send. | NEW: shown when the tick is off, in place of the three lines above |
| `rain.sum.phone` | {12 games}. {214 emails} to {208 families} in {3} sends. {6} get two. | CHANGED: "households" → "families" |

### 10.2 Tonight's practices (games only; practices are named, not touched)

| Key | Case | String | Tag |
|---|---|---|---|
| `rain.prac.today` | The day is today | Tonight’s practices aren’t changed here. | keep as drawn |
| `rain.prac.day` | Another day | Practices on {Fri, Jun 18} aren’t changed here. | NEW |
| `rain.prac.club` | Practices on the club's time | {3} use the club’s time: change them in the club’s Schedules. | CHANGED: was "…are the club’s time…" |
| `rain.prac.hand` | Practices booked by hand | {1} was booked by hand: change it in Practices. Cancelling it doesn’t email families. | CHANGED: says the missing email plainly (§13.12) |
| `rain.prac.phone` | The phone's one line | Practices aren’t changed here: {3} use the club’s time (Schedules), {1} was booked by hand (Practices; cancelling it emails no one). | CHANGED from "3 club practices and 1 of yours tonight aren’t changed here." |
| absent | No practices that day | no line | keep |

### 10.3 Email, the line, the buttons

| Key | String | Tag |
|---|---|---|
| `rain.email` | Email the families now | keep as drawn (ticked by default) |
| `rain.email.help` | Untick to hold them in Changes to send and review first. | keep as drawn |
| `rain.line.label` | A line for the email | keep as drawn (no "(optional)" tag) |
| `rain.line.hint` | You can leave this empty. It goes at the top of the family email and the coaches’ copy, in your words. 120 characters at most. | CHANGED: says where it appears and that it is not edited (§13.13) |
| `rain.line.placeholder` | For example: the fields are closed tonight. | NEW (a placeholder, never prefilled) |
| `rain.line.count` | {96} left · at 0: 0 left | NEW (shown while typing; the counter is the only limit message) |
| `rain.line.held` | It goes out with the changes when you send them. | NEW: appended under the hint when the tick is off (see §14.2, an open build question) |
| `rain.foot` | Nothing changes until you press the button. | keep as drawn (phone: "Nothing changes until you press.") |
| `rain.close` | Close | keep as drawn (never "Cancel": that is the other choice) |
| `rain.go.postpone.mail` | Postpone {12 games} and email {214 families} | keep as drawn |
| `rain.go.cancel.mail` | Cancel {12 games} and email {214 families} | keep as drawn |
| `rain.go.postpone` | Postpone {12 games} | keep as drawn (the tick is off) |
| `rain.go.cancel` | Cancel {12 games} | keep as drawn |
| `rain.go.one` | Postpone {1 game} and email {3 families} · email {1 family} | NEW: singulars |
| `rain.go.phone` | Postpone {12 games}, email {214} | keep as drawn |
| `rain.sending` | Sending… | keep as drawn |
| `rain.err.changed` | These games changed while the window was open. Nothing was changed. Look again. | keep as drawn (ticks kept) |
| `rain.err.finished` | {Season name} has finished, so games can’t be called off. | NEW (the button is absent; this is the refusal if a window was open) |

## 11. What it says afterwards

Where: the result sheet over the schedule.

### 11.1 Told now

| Key | String | Tag |
|---|---|---|
| `rain.done.title` | {12 games} postponed · {12 games} cancelled · {1 game} postponed | keep as drawn |
| `rain.done.date` | {Thu, Jun 17} | keep as drawn |
| `rain.done.sent` | {214 emails} sent ({U10 74}, {U12 88}, {U14 52}). The {24} teams’ coaches have a copy. | keep as drawn |
| `rain.done.noundo.postponed` | Emails can’t be taken back. To change a game, give it a new date; its families are told again. | CHANGED: the drawing's single line named both ways back for either verb (§13.14) |
| `rain.done.noundo.cancelled` | Emails can’t be taken back. To bring a game back, put it back on the schedule; its families are told again. | CHANGED: same |
| `rain.done.done` | Done | keep as drawn |
| `rain.done.dates` | Give them new dates | keep as drawn (postponed only; opens "Needs a new date") |

### 11.2 One send failed, or all

| Key | String | Tag |
|---|---|---|
| `rain.fail.some` | {U10 and U12} families were emailed ({162}). The {U14} email didn’t go: its {3} {postponements} are waiting in Changes to send. | keep as drawn ("cancellations" for cancel) |
| `rain.fail.all` | No emails went. The {12} {postponements} are waiting in Changes to send. | NEW |
| `rain.fail.open` | Open Changes to send | keep as drawn |
| `rain.fail.again` | (pressing the window's button again for a division already told) Those families were already emailed. Nothing more was sent. | NEW |

### 11.3 Held, and Put all back

| Key | String | Tag |
|---|---|---|
| `rain.held.title` | {12 games} postponed | keep as drawn |
| `rain.held.body` | Nobody has been told. The {12} changes are waiting in Changes to send. | keep as drawn |
| `rain.held.undo` | You can put all {12} back until the changes are sent. If any game has changed since, nothing is put back and you can undo them one at a time in Changes to send. | keep as drawn |
| `rain.held.back` | Put all {12} back | keep as drawn |
| `rain.held.send` | Send the changes | keep as drawn (the built button's words) |
| `rain.held.banner` | Rainout on {Thu, Jun 17}: {12 games} {postponed}, waiting to be sent. · **Put all {12} back** | NEW: the persistent Undo has to live somewhere a day later; the drawing is silent on where (§14.2) |
| `rain.back.title` | Put all {12} games back? | NEW |
| `rain.back.body` | They return to the schedule at their old times. Nobody was told, so nobody is told now. | NEW |
| `rain.back.yes` | Put all {12} back | NEW |
| `rain.back.keep` | Keep them {postponed} · Keep them {cancelled} | NEW (follows the game window's "Keep it") |
| `rain.back.done` | {12 games} put back. Nothing was sent. | NEW (toast) |
| `rain.back.refused` | A game changed since, so nothing was put back. You can undo them one at a time in Changes to send. | NEW (all-or-nothing) |
| `rain.back.gone` | These changes were already sent, so they can’t be put back. | NEW: the banner opened after someone else sent them |

## 12. The family email and the coaches' copy

The existing Games changed email is **not rewritten** (its subject "Games changed for {Twins and Rays}", its parts "{Club}
changed {Ava}’s games with {Twins}:", "Postponed: {game}, {day}. A new date is to come.", "Cancelled: … The club will tell you
if it is replayed.", the foot). Only the optional line is new.

| Key | String | Tag |
|---|---|---|
| `rainMail.line` | {the admin's own line, verbatim, one paragraph above the first part} | keep as drawn (**Option A**) |
| `rainMail.line.coach` | {the same line, verbatim, above the coach copy's first line} | keep as drawn |
| `rainMail.line.none` | (no line typed: nothing is added, no label, no space) | keep |

**Option A (recommended, as drawn):** the line stands alone at the top, no label. The next line already names the club ("Dev
League Org changed Ava’s games with Twins:"), so the line reads as the club's.
**Option B:** a lead-in, "A note from {club}:" above the line. It makes the voice explicit, but it adds a word to every rainout
email, and a short line like "Rain: the fields are closed tonight." already does the job.

### FOR OWNER SIGN-OFF — family-facing

1. **The line is the club's own words, delivered to every family the rainout reaches, with no review step between the typing
   and the send.** The field says so ("in your words", `rain.line.hint`). Nothing in the email says it was typed rather than
   written by the product. Confirm that is wanted (the alternative is a preview of the family email in the window, which is a
   build change, not a wording one).
2. **No new sentence is added to the email body.** The built "A new date is to come." and "The club will tell you if it is
   replayed." already fit a rainout, so no family-facing sentence is drafted here.
3. Public standings and the ranking box are family-facing, but they were ruled in 9e·2 to 9e·4; no sign-off needed.

---

## 13. What changed from the drawings, and why

1. **"households" became "families" in every count** (`rain.sum.mail`, `rain.sum.phone`). The 9d-2b copy (`HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`)
   and the code count FAMILIES ("Sent to 21 families", "Reaches 66 families"), and 9c §0 lists "households" as a word never
   shown. "Families" also matches the mail's own sentence. The two-email sentence is reshaped to read: "{208 families}… {6} of
   those families get two emails", so 208 + 6 = 214 adds up on the page.
2. **"Only played games count." became "A game counts once both scores are in."** "Played" is a status word; the rule a parent
   can check is the both-scores rule, the same one the pencil enforces.
3. **The phone's ranking line said "head-to-head"** while the desk said "the game between them". One word per thing: both say
   "the game between them".
4. **"…once the schedule is published and games are played"** (a public sentence) became "…once the schedule is up and the first
   scores are in". Families read "up" ("schedule is up", "schedule is coming"); "published" is staff language.
5. **Admin footer** "can't be edited here" became "can't be changed here" (the house verb), and the first clause no longer
   repeats "the ones the public page shows".
6. **"the Twins’ coach" / "The Royals say" lose the "the"** (9c §15.2: no "the" before a team name in a template). Reads as
   "Twins’ coach", "Royals’ coach says…". This is the one change that reads slightly flatter; it is right for every kind of
   team name.
7. **The score window's hint** said "you can change it until they do" (they = the league admin, but a flag also closes it).
   It now names both closers, because the ruling (9e·9) names both.
8. **The report placeholder** named "the 7th-inning run" and "a foul ball": ball-only, and the placeholder is the product's
   example for every sport the pack may ever carry.
9. **"today at 8:12 p.m." became "{Jun 17} at 8:12 p.m."**: a relative day is a second code path; a date is always true.
10. **"Flagged" became "Reported"** on the club side (the tag, the fold row, the phone row), because the coach's door is
    "Report this score" and the reporter did the reporting. "Coach entered" stays for an unreported coach score. The word
    "flag" is a code word and appears on no screen.
11. **Cancel's sub-line.** The drawing said a cancelled game is "called off for good" and returns "only if you add a game". The
    game window offers **Put it back on** for a cancelled game (`GAME_WINDOW_WORDS.putBack`, help article "Put it back on"), so
    the drawn sentence is false. It now says the game stays struck through and can be put back on.
12. **The hand-booked practice** line now says, in so many words, that cancelling it emails no family (finding E09), as asked.
13. **The line's hint** now says where it appears and that it is sent in the admin's own words, because the drawn hint only gave
    the limit.
14. **The result's second line** split by verb: "give it a new date" is only true of a postponed game and "put it back on" only
    of a cancelled one.
15. **Phone sheet title** "Score isn’t right" became "Report this score" (the desk window's title).

## 14. Open word questions

1. **Coach clears both boxes** (`cs.win.clear`). The drawing lets the entering coach do it and returns the game to scheduled.
   Not ruled either way for a coach. **Recommendation:** allow it, with `cs.win.clear` as the only guard.
2. **The held rainout's line, and where its Put all back lives a day later.** The drawing shows the Undo only on the result
   sheet and says it "lives tomorrow"; it does not draw the place. `rain.line.held` and `rain.held.banner` assume the line is
   kept with the held changes and sent at the later send, and that the banner sits at the top of Changes to send. If the line is
   not kept, hide the field when the tick is off and drop `rain.line.held`.
3. **A report note limit.** The report window has no character limit drawn. If the build adds one, reuse `rain.line.count`
   ("{n} left").
4. **"Level with"** (Option B, §2) is a recommendation; Option A is the drawn word.

## 15. Help-article keywords and searchText (suggestions only; the `/docs` pass writes the articles)

Add to the existing house-league schedule / standings articles' `keywords`, lowercase, no plan names:

- Standings: `standings`, `how the table is ranked`, `tie break`, `tied for`, `level on points`, `the game between them`,
  `run differential`, `runs for`, `shared place`, `t-3`, `show standings`, `hide standings`, `division without standings`,
  `standings before first score`, `a game counts when both scores are in`, `rf ra rd`
- Coach scores: `enter the score`, `change the score`, `coach enters score`, `home team enters the score`, `report this score`,
  `score isn't right`, `reported score`, `scores to check`, `coach entered`, `correct the score`, `keep the score`,
  `who entered the score`, `entered by`, `scores never email`
- Rainout: `rainout`, `rain out`, `rained out`, `rain`, `call off a day`, `postpone every game`, `cancel every game`, `one
  action`, `email the families now`, `hold in changes to send`, `put all back`, `emails can't be taken back`, `a line for the
  email`, `practices not changed`, `club practices`, `hand-booked practice`

`searchText` additions (one run, as the existing articles carry): *standings points tie level shared place T-3 run differential
runs for RF RA RD show standings switch division coach standing line enter the score home coach change the score report this
score reported coach entered scores to check keep correct entered by league admin finished season locked rainout postpone cancel
families coaches copy line 120 characters changes to send put all back emails can’t be taken back practices club’s schedules
practices booked by hand needs a new date give it a new date*.

## 16. Checks

By eye, because `npm run check:spelling` scans code only: "cancelled" (two Ls, never `Canceled`), "house league" lowercase, no
"installment", no "financial year", no `AM`/`PM`, every clock time through `formatTime()`, the possessive through `possessive()`
("Twins’ coach"), "colour"/"behaviour" untouched (none appear), no "households", no "flag" on a screen, no plan name, no
price, no "lock"/"upgrade" wording (9e·15 undecided), no "unlock" and none of the brand's forbidden words. The fixture names,
emails and scores above are examples and take `spelling-ok` if copied into a test string.
