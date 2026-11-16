# Notifications that read at a glance — labelled rows instead of one paragraph

**Status:** census done 2026-11-14; scope and the one-line rule RULED by the owner 2026-11-14; **Stage 1 drawn
2026-11-14; Q1–Q9 RULED 2026-11-14 (all as recommended, see "Drawing rulings" below); Stage 2 build prompt written
(`NOTIFICATION_MESSAGE_ROWS_STAGE2_BUILD_PROMPT.md`)** — https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 (v2, `/design` applied; source
`NOTIFICATION_MESSAGE_ROWS_MOCKUP.html`). Q1–Q7 as the drawing prompt asked; Q8 = "A game changed" keeps its sentence
(tab 6's verdict); Q9 = the phone sheet's buttons when a notice outgrows it (moved games measured 131px below the first
view). `/legal` owed before Stage 3 for the moved-games email (Q7).
PM brief: `NOTIFICATION_MESSAGE_ROWS_PM_BRIEF.md`.
**Stage 2 BUILT 2026-11-14, committed `ed417b626` 2026-11-14** (see "Stage 2 as built" below); reviewed and simplified
2026-11-15 (see "Stage 2 review", fixes committed `b55793822`). **Stage 3 (the six list notices) BUILT 2026-11-15, simplified and
reviewed 2026-11-15, committed `8f5f2e491` 2026-11-15** (see "Stage 3 as built" and "Stage 3 review"); the four undrawn kinds ruled
2026-11-15. **Stage 4 (the few-facts coach and league notices) RULED and BUILT 2026-11-15, simplified and reviewed 2026-11-15,
committed `3902fc9e5` 2026-11-15** (see "Stage 4 as built" and "Stage 4 review"; five kinds get rows, the moved game keeps
its sentence, Q1). **Stage 5 (the tidy-up) RULED and BUILT 2026-11-15, simplified, reviewed and `/docs` applied 2026-11-15, committed `828ea0ad9` 2026-11-15** (owner: "as
recommended" on all seven; see "Stage 5 as built" and "Stage 5 simplify, review and docs"): "Score submitted" carries the game, the score, its state and who entered it, and goes only to the people who can open
Results; the six never-sent kinds are kept on purpose. **Stage 6 walk PASSED 48/48 on 2026-11-16** (owner paste-back: Get ready 2/2 · club owner on a computer 22/22 · coach in a phone-sized window 14/14 · "Score submitted" from real scores 9/9 · help article 1/1; the "Calls for you" block came back empty). **Owner calls answered 2026-11-16 ("they are fine as is"):** keep "Sent to" on a refund that was never sent; keep the hand-back line as built (no "ask for it back" sentence); keep the covered payment as the figure ("→ $0.00"); the held score/forfeit as a needs-attention notice stays not built (ruled "log it"). **The /marketing pass APPLIED 2026-11-16 (owner: "go ahead and apply")**: ten wording changes — the weekly line drops "and" ("· 2 more this week"); the time hand-off reads "gives 2 hours a week to <season>"; moved games "Families are told when you send them"; "the club will record paying it"; the unasked hand-back's next step "Ask the club for it back from the practice"; Payouts "Your Stripe account stays connected"; withdrawal line "Note attached"; the bank-debit and dispute "told" row is labelled "Told"; the availability row "Answered by" ("From" stays the date); "Billed" dropped for "Bill". Held back: "New sign-up" titles (Stage 4 Q5 ruling) and the club-payment "Received" row (date meaning unchecked). Tests updated; full suite fails only in 24 tests from other sessions' files.

## Stage 6 — the one walk (written 2026-11-15)

Checkable walk, 48 steps in five parts: https://claude.ai/artifact/6uVSUvJi46oJ3HqsrUthFQ (source
`NOTIFICATION_MESSAGE_ROWS_WALK.html`, built by `.probe/n5/walk-build.cjs`). Parts 1–2 open one real notice of every kind that now
shows rows (25 in the UAT club owner's bell, 13 in the UAT coach's), put there by `scripts/seed-notification-rows-walk.mjs`
(dev only, refuses production, built from the same wording code the senders call, idempotent by `metadata.seed`). Part 3 makes
"Score submitted" by entering real scores in the Dev Test Org's Live Demo tournament (it asks for approval, so a scorekeeper's entry
waits, an admin's is final; a forfeit, then a score over it for the Was row). Part 4 is the help sentence. Not walked (unit-tested):
the payments-ending notice, a held forfeit, a numeric correction's Was row, the needs-attention buttons on the seeded notices.
Five owner calls ride beside the steps. **Walked 2026-11-16: 48/48 passed; the owner-calls block came back empty.**

## Stage 5 as built (2026-11-15; committed `828ea0ad9`)

- **One entry point for the three senders** (Field scores; Results' score entry; Results' forfeit): the words are `scoreNotice`
  (`lib/score-notice.ts`, pure); the read and the send are `readScoreNoticeGame` (before the save) and `sendScoreNotice`
  (`lib/score-notice-server.ts`). The line: "Hawks 4, Ridge 12U 6 · Final · entered by kim@example.com" (visitors first; "Waiting for
  approval" when held; a forfeit "Ridge 12U wins by forfeit vs Hawks"; a correction of a final result "corrected by …"). Rows Game
  (the division as detail) · Score (bold) · Was (a correction only) · Status · Entered by. Titles unchanged ("Score submitted",
  "Forfeit pending approval", "Game forfeited"). A forfeit never shows the stored 1–0.
- **Held or final is now known on every path:** Results' score entry used to drop the save's answer; it keeps it.
- **The one extra read (Q5)** is one query before the save (both teams by their two links, the division, the slot words, the
  standing result). A failed read never stops a score: the notice says "Visitors" / "Home team". A bracket slot reads in the
  bracket's words ("Semifinal 1 winner").
- **Audience (Q6):** `resultsUserIds` (`lib/notify-recipients.ts`): whoever may enter scores (`canScore`, Results' own question),
  a volunteer only on a plan with volunteers (`volunteerShut`), staff to their assigned tournaments; never the person who entered
  it; nothing when no one else can (an empty list would reach every member).
- **Five labels** added (Game, Score, Status, Entered by, Was). `metadata` holds `facts` only (the kind had no metadata before).
- **The six never-sent kinds (Q7):** re-verified (no `notify()` call or `notifications` insert anywhere; two appear only in the UAT
  seed). Left exactly as they are; "tidy-up" closes as **kept on purpose**. The data dictionary's dead list now names all six.
- **Not built (Q3), for `/plan`:** a held score or forfeit as a needs-attention notice that clears itself on approval.
- **`/legal` 2026-11-15:** nothing owed (`docs/agents/legal/CASL_LATE_BILL_EMAIL.md`, "Stage 5 as built"); finding 11's count 27 → 28.
- **Tests:** the Stage 5 block in `tests/unit/notification-facts.test.ts` (every state, a forfeit each way, two corrections, every
  blank part read back, the bracket slot; a guard that every sender goes through the one entry, reads before it saves, and that the
  audience is Results' people with an empty-list stop).
- **For `/docs` (done, see the review section):** the tournaments FAQ "Where does a 'score submitted' notification take me?" says it goes to admins when a
  scorekeeper submits; it now goes to everyone who can open Results, for every entry (an admin's too), and says whether it is
  waiting for approval.

## Stage 5 simplify, review and docs (2026-11-15)

- **Simplify.** Three member lists (`tournamentTeamAdderUserIds`, `checkInUserIds`, `resultsUserIds`) each repeated the same
  member read and staff scoping; they now share one private `tournamentMembersWho(orgId, tournamentId, keep)` and are one line
  each (the test pins that exactly one such read remains). The game read's two error paths became one (a thrown read is logged
  once by the catch). **Kept as asked:** the read and the send stay two calls (the read must come BEFORE the save so a
  correction can name the old result); `fanPlaceholder` is the right reuse (it is what the fans' pages say for a slot);
  `UNREAD` stays (a failed read says "Visitors" / "Home team", never stops a score); `lib/notification-facts.ts` imports
  nothing; the pure/server split and the empty-list stop stand.
- **Review, argued from the code.**
  - Every sender reads after its scope guards and before the save (Field scores after `scopeGuard` + `requireTournamentInOrg`;
    Results' entry and forfeit after the capability, final-lock and `winningSide` checks); a refused save throws before the
    send, so no notice; `held` is the save's own answer on all three paths (`result.status === 'submitted'`, the entry's
    `status`, the forfeit's `pending`). A read that throws is caught and the score goes on.
  - **The embedded select was run against the dev database** (`.probe/n5/read-dev.cjs`): `teams!games_home_team_id_fkey`,
    `teams!games_away_team_id_fkey` and `divisions` (one key on that column, no hint needed) return names (a final game
    "Falcons" / "Hawks" in "U18"; a forfeit game with both team names; an open-slot game whose teams come back null with
    its slot words "1st Pool Pool A"), so the slot and forfeit paths are proved on real data as well as by the unit tests.
    ⚠ **Correction (2026-11-15):** the first probe (`.probe/n5/read.cjs`) was written with `@next/env`'s default loader,
    which reads `.env.production.local`, so it ran its four `limit 1` SELECTs against the PRODUCTION project (nothing
    was written or changed) and this section first said "dev". It was redone against `.env.local` with a refusal if the
    URL names production. A probe in this repo reads `.env.local` by hand, as the seed scripts do.
  - **Fixed (real):** the "was it final before?" rule lived in the server-only file where no test could reach it. It is now
    the pure `standingResult` in `lib/score-notice.ts`, tested: completed and forfeit stand; a held score, a pending forfeit,
    a scheduled or cancelled game and a half-written score have none (so a re-entry of a held score reads as new); a 0–0 is a
    result.
  - **Fixed (real):** the settings line for this kind read "A scorekeeper or coach submits a game result." — coaches never
    submit tournament scores, and admins' entries and forfeits send it too. It now reads "A game result is entered, or a
    forfeit is marked."
  - Audience re-read in `lib/roles.ts`: owner, admin, staff (assigned tournaments) and official hold `submit_scores`; league
    admin, registrar, treasurer and plain coach hold none by default, and `volunteerShut` removes an official on a plan with no
    volunteers; the actor is filtered out; an empty list sends nothing.
  - Nothing in the code reads the old bodies ("Submitted by scorekeeper", "needs admin approval", "team advances"): only the
    census, the mockup and a legal note quote them as history.
  - Blank inputs: the test reads back nine notices including blank names, blank division, blank address and a blank correction.
  - **Not changed, noted:** a member whose tournaments module is switched off but who holds a stored `submit_scores` grant
    would be told; Results' own page gates on the same capability, so the audience matches the screen it links to.
- **Docs (`/docs`).** One help sentence described this notice: tournaments FAQ "Where does a 'score submitted' notification
  take me?" (`lib/help-content/tournaments.tsx`). It said admins are notified when a scorekeeper submits. It now says it goes to
  everyone who can open Results & scoring except the person who entered it, for every entry (an admin's and a forfeit too),
  names the game, the score, Final or Waiting for approval and who entered it, and that a correction shows what it was
  before. Keywords and the page's search text gained the same words. No other help file mentions the notice.
- **Checks.** `notification-facts` (42), `club-stage2-server-guard`, `club-stage2-screens-guard`, `notification-feed-grouping`,
  `club-stage7b-add-our-teams` and `needs-attention-clears-itself` pass; `check:spelling` clean; `tsc` fails only in the
  untracked `layout-run-journal.test.ts`. `verify:changed` fails only in other sessions' files (workspace-flip and
  possessive guards, one door for the plan, the coach-stylesheet chain, billing rail, dispute screens, schedule bill, Stage 6
  owner-walk summary and more); none is in a file of this work.

## Stage 5 rulings (2026-11-15, owner: "as recommended" on all seven)

Q1 visitors first, the address kept · Q2 Game · Score · Status · Entered by · Q3 forfeits name the teams, titles unchanged;
needs-attention for held results logged for `/plan` · Q4 a correction says "corrected" with a Was row; a held re-entry reads as
new · Q5 one extra read accepted · Q6 the people who can open Results · Q7 the six kept as they are. The questions as asked:

## Stage 5 owner questions (2026-11-15, asked before any code)

Found in the code (re-verified by hand, not from the census): **"Score submitted" has three senders** (Field scores; the
Results screen's score entry; the Results screen's forfeit, which titles itself "Forfeit pending approval" / "Game
forfeited"). None loads the teams, the division or the old score; none stores any metadata; the forfeit says "home team" /
"away team", never a name. **The same words go out whether the score is final or held for an admin's approval** (the
Results score entry does not even keep the answer). **Audience: every active member of the org except the person who entered
it** (no recipients are passed), so house-league admins and registrars, treasurers and coaches with no tournament access get
every score, push on by default. Not a needs-attention kind (`know`), bundles by day ("N scores submitted"; an opened bundle
lists each one line). Every entry sends a new notice: a re-entry of a held score, and an admin's correction of a final one.
**The six never-sent kinds:** no sender anywhere (two are inserted only by the UAT seed script); `notifications.event_type`
is free text with no CHECK, so removing a kind is code-only, not a migration; the settings page already hides all six.

1. **The line** (recommended): visitor first, as the public pages and the fan "Final:" push read: "Hawks 4, Ridge 12U 6 ·
   Final · entered by kim@example.com"; held: "· Waiting for approval ·"; an unteamed bracket slot uses the bracket's own
   words ("Semifinal 1 winner 5, Hawks 3"). Keep the address (as Stage 4 Q5), or the person's name when the account has one.
2. **The rows:** Game (the matchup, the division as the quiet detail) · Score · Status (Final / Waiting for approval) ·
   Entered by; four new labels.
3. **Forfeits:** "Ridge 12U wins by forfeit vs Hawks · Waiting for approval · kim@example.com"; the Score row says "Ridge
   12U by forfeit", never the stored 1–0; titles unchanged. Making a held score or forfeit a needs-attention notice is NOT
   built here (it needs something that clears it on approval): log for `/plan`.
4. **Twice:** a correction of a final score says "corrected" and gains a **Was** row with the old score; a re-entry of a held
   score reads as a new one (it still waits).
5. **Cost:** one extra small read per score entered, before the write (teams, division, slot words, the old score). A
   150-game day ≈ 200 reads; the notice already looks up every org member for each send.
6. **Audience (widened):** send it to the people who can open the Results screen it links to (holders of the score tool,
   staff to their assigned tournaments), not to the whole org. Or keep the audience and log it for `/plan`.
7. **The six never-sent kinds:** leave them exactly as they are (recommended; they cost nothing, old rows still render, the
   seed uses two), close "tidy-up" in this plan as "kept on purpose", and correct the data dictionary's dead list (it
   names five, not six). Or remove the five waiting-on-a-trigger kinds (code only), or write rows for them now (rejected:
   rows with no sender to check against).

## Stage 4 as built (2026-11-15)

- **New registration** (`signupNotice` in `lib/league-signup.ts`, both senders): one line "Grace Kim · Summer 2027 · 1
  approved" for the family's sign-up and the hand-entered one (which gained the guardian and the outcome; ruling 5); the
  titles keep "New sign-up" / "New registration". Rows Season · Family · Players (one line per child, outcome bold; a
  status outside the three staff words names the child with no outcome). **Audience (Q2): the house-league desk**
  (`houseLeagueDeskUserIds`), the hand-entered one not to the person who typed it; nothing is sent when the desk is empty.
- **Withdrawal request** (`ASK_WORDS.notice`): the line is "Pat Doe · Spring 2026 · with a note" / "· No note", never the
  note's words; rows Family · Season · Note, the note quoted in full (300 at the door, nothing shortens it after). The
  120-character cut is gone with the words. Needs-attention keys unchanged.
- **Moved game** (`family_game_update`): untouched (Q1). The family email is byte-identical.
- **Assistant-coach approval** (`staffApprovalNotice` in `lib/coach-capabilities.ts`, one entry for the three senders):
  the line drops the role's sentence; rows Invited by (left out when unknown; the line says "A head coach") · Invited (the
  address as typed) · Team · Role (bold, what it gets as the detail). `inviteId` unchanged.
- **Practice plan** (`practicePlanSentMessage`): three or fewer stations is today's line; past three it names three and
  counts the rest. Rows You’re on (a list, fold 6, keep 30, "and N more on the plan") · Arrive by · Starts. The coach-chosen
  practice email still names every station. The send sheet's preview reads the same line.
- **Season started** (`clubSeasonNotice`): the line is the team and what came ("Ridge 12U · Came with the team: 14 players,
  the budget and the fee plan."), or with nothing the tryouts' state; rows Came with (one line each) · Tryouts · Last season
  ("kept as a record"). Closed and reopened unchanged, no rows. **Q8:** the first season passes its tryouts state, and the
  Overview's one-time card reads it too (a coach may have opened tryouts since the roll), so neither says "closed" when open.
- **Eleven labels** added to `FACT_LABELS` (Players, Note, Invited by, Invited, Role, You’re on, Arrive by, Starts, Came with,
  Tryouts, Last season); the label test now allows the house apostrophe.
- **Privacy draft §6** (push service row) reworded per Q5: the alert text can name a person, a child or a team.
- **Tests:** `tests/unit/notification-facts.test.ts` (the Stage 4 block: round-trips, blank inputs, every sender); the season
  notice's two guards moved to the new one line. One guard caught the hand-entered path's `'admin'` value as a role name: it
  is `'entered'`.
- **Checks:** the touched tests pass; spelling clean; type check clean except another session's untracked
  `layout-run-journal.test.ts`; `verify:changed` fails only on other sessions' files (listed in the hand-off).
- **For `/docs` (not changed here):** the coaches' practice-plan help says each person's push names "their stations" (true;
  past three it names three and counts the rest); the withdrawal help says the notice "opens Registrations on that child", but
  its link opens the season's Registrations list (pre-existing); the registrations search text says "one needs attention
  notice per sign-up", but the kind is a know notice (pre-existing).

## Stage 4 review (2026-11-15)

- **`/simplify`: no change.** `staffApprovalNotice` stays beside `STAFF_KIND_COPY` (the test must import the words, and
  `lib/assistant-invites.ts` loads the server client); `clubSeasonNotice` and `clubSeasonStartedCard` share one `startedFacts`
  (nothing written twice); `signupNotice`'s `via` stays `'signup' | 'entered'`; the coach-chosen practice email still names
  every station.
- **`/review`: clean.** Every blank input was run through the notice and read back (a blank guardian, a declined status, a
  blank child, a note of spaces, an unknown or blank inviter, no stations, a blank station, a first season with nothing
  carried, a roll with zero players): each still opens as rows, none voids them. Both registration senders reach
  `houseLeagueDeskUserIds` only, the hand-entered one without the person who typed it; an empty desk sends nothing; the
  hand-entered path stays fire-and-forget. The withdrawal note is never in the body. `programYear.tryoutOpen` exists on both
  reads (the first season's route and the Overview card's route); the roll path leaves it out. `lib/family-notify.ts` untouched.
- **`/docs`: three help sentences fixed.** The withdrawal help (house league article, club article) now says the notice opens the
  season's Registrations list (it never opened one child; the link is unchanged); the registrations help search text no longer
  says "needs attention notice per sign-up" (a know notice, to the house-league desk). The coaches' practice-plan help still reads
  true (its quoted line has two stations).
- **Still owed to `/legal`:** the privacy draft's retention finding 11 should name the withdrawal note now kept in full on the
  stored notice.

## Stage 4 rulings (2026-11-15, owner: "As recommended" on all eight)

Q1 `family_game_update` keeps its sentence and leaves the 28 (now 27) · Q2 the new-registration notice goes to the
house-league desk only, not to the admin who typed it · Q3 Players, one line per child · Q4 the note out of the line,
quoted in full in a Note row · Q5 keep the address; the privacy draft's push row is reworded · Q6 three named, the rest
counted · Q7 Came with · Tryouts · Last season · Q8 a first season with tryouts open says so. The questions as asked:

## Stage 4 owner questions (2026-11-15, asked before any code)

Found in the code before building (senders checked by hand): every kind has one builder through `notify()`; the generic
opt-in email and the push print the body. `/legal` 2026-11-15 (`docs/agents/legal/CASL_LATE_BILL_EMAIL.md`, "Stage 4
proposal"): CASL not owed on any of the six; the findings are folded into Q2, Q4, Q5 and Q8.

1. **`family_game_update` keeps its sentence** (recommended), the same call as Q8 for "A game changed": "vs Hawks is now
   Sat, Nov 8, 6:00 p.m. at Riverdale Park." is already one line and the summary. Families have no in-app frame at all
   (they get only the email, which prints this sentence), so rows would only ever reach the coach's copy. Or: the coach's
   copy gains Opponent · When · Where (three new labels); the family email is byte-identical either way.
2. **`house_league_registration_new` reaches every active org member** (`notify()` with no recipients), including people
   with no house-league access. `/legal`: a need-to-know finding (children's and the guardian's names). Recommended: send
   it to the house-league desk (as the withdrawal request already does) and not to the admin who typed it, in this build.
   Or keep the audience (the brief says it stays) and log it for `/plan`.
3. **Registration rows.** Recommended: Season · Family (the guardian) · **Players** (new label; one line per child with
   the outcome bold: "Henry Kim · **Approved**"). Or one **Status** row with the counts. Either way one line for both
   senders ("Grace Kim · Summer 2027 · 1 approved"), so the admin-entered body gains the guardian and the outcome
   (ruling 5); the two titles keep their words ("New sign-up" / "New registration": they say who started it).
4. **Withdrawal request.** Recommended (`/legal`): the line leaves the note's words out ("Pat Doe · Spring 2026 · with a
   note" / "· No note"), because a push or email would put a family's words (possibly health details) on a lock screen.
   Rows: Family · Season · **Note** (new label), quoted in full, never shortened. The full note is then copied into the
   stored rows (today 120 characters of it are in the body); `/legal` adds that to the privacy draft's retention finding
   11. Or: the Note row says only that there is a note, read in the Withdraw window (no copy).
5. **Assistant-coach approval.** One line drops the role's description: "Sam Lee invited pat@example.com to Ridge 12U as
   an assistant coach." Rows: **Invited by** · **Invited** (the address, exact) · Team · **Role** (bold role, what it gets
   as the quiet detail); three new labels. `/legal` notes the privacy draft (§6) says a push carries "no name or email",
   and this kind's push is on by default with the address in the line. Recommended: reword §6, because titles across the
   product already carry names ("New sign-up: Henry Kim"); taking one address out would not make §6 true. Or: the line
   drops the address ("Sam Lee invited a new assistant coach to Ridge 12U.").
6. **Practice plan.** Rows: **You’re on** (new label; the list, folding at 6) · **Arrive by** · **Starts** (two new
   labels); a person on nothing gets no list row. Recommended: the line names up to three and counts the rest ("You’re on
   Close control, Footwork ladder, Rondo and 2 more. Arrive by 5:45 p.m. for 6:00 p.m."), as family answers do; three or
   fewer is today's line (the help article's quote stays true). The coach-chosen practice email is untouched.
7. **Season started.** Line: "Ridge 12U · Came with the team: 14 players, the budget and the fee plan." (nothing came
   along: "Ridge 12U · Tryouts are closed until you open them."). Rows: **Came with** (new; a list: 14 players · The budget
   · The fee plan · The opening balance) · **Tryouts** (new) · **Last season** (new; "2026 Season", detail "kept as a
   record"). The Overview's one-time "New season" card keeps its paragraph.
8. **A first season created with tryouts open is told "Tryouts are closed until you open them."** (false; `/legal`: an
   open tryout is a live public form). Recommended: fix it along the way: the notice says "Tryouts are open." when they are.

## Stage 3 as built (2026-11-15)

- **The shared shape grew two things the drawing's tab 5 shows** (the Stage 3 prompt said no frame work was owed; the
  drawing disagreed): a row that IS its list (`listRow`, or `factRow` with no value and a list: the list is the row's
  answer, `<dd>`, starting on the label's line; on a phone it runs the full width like any list), and a list line with a
  bold part (`factLine`: "Maya · **In** · was Out"). `readNoticeFacts` stays all-or-nothing for both. Twelve labels added
  to `FACT_LABELS`: Divisions, Games, Answers, Answer, Now, Events, This week, Champions, Came off, Club owes, Paid for,
  Payment.
- **Moved games** (`LEAGUE_ADMIN_NOTICE.notice`, one sender `lib/club-schedule-send.ts`): one line = today's first
  sentence; rows Schedule · Divisions · Practices · Games (one game per line, fold 6, keep 30, "and N more on the
  schedule"); the waiting games are the next step. The body no longer carries line breaks.
- **Family answers** (`coachBellWords`): drawn shapes (several families: Answers list + Now; one change: Answer · From ·
  Now) and the ruled one for one family across events (Events list + From). Past three children the line names three and
  counts the rest. **The fold into an unread notice re-writes `facts` with the title and body**, both paths.
- **Weekly insights** (`formatInsightDigest`): one line = the first finding and a count ("· and 2 more this week"); rows =
  the same chosen findings, one per line under This week. Rows and body come from the one call per coach, so a coach
  never sees a finding their permissions withheld.
- **Hand-back answered**: the four builds are ONE entry, `HAND_BACK_WORDS.bellAnswered` (accepted / declined × on time /
  late). Accepted: Schedule · Practices · Came off (one line per payment that dropped, "Feb 1 · $864.00 → $432.00", date
  order; a covered payment reads "→ $0.00") · Club owes. Declined: Schedule · Practices · Reason, quoted exactly; the
  reason also stays in the line (ruling below). `tellTeamMoneyPeople` now carries `facts` (as `tellClubAccounting` did).
- **Refund whose** (`LEAGUE_ONLINE_NOTICE_WORDS.whose`): Paid for (the children, one per line) · Payment (total, receipt)
  · Book; next step "Choose the child, and it goes on that registration." Title unchanged.
- **Champions crowned** (`championsNotice` in `lib/champions.ts`): **no new read was needed**: `deriveChampions` already
  returned each champion's division; the notice threw it away. Up to three champions are named with their division, more
  are counted; rows list "U12 · **Ridge 12U**". The no-champion body is unchanged and stores no rows. The fans' push keeps
  its own names-only headline.
- **Email check (Q7):** five of the six can email when switched on (`card_refund_whose` has no setting). `/legal`
  2026-11-15: not a commercial message, nothing owed (`docs/agents/legal/CASL_LATE_BILL_EMAIL.md`, last section). One
  `/docs` note: the coaches' help answer on "Your week in review" says the push carries "the top items"; it now leads with
  one.
- **Words** are draft copy tagged `[marketing]`, owed to the one /marketing pass.
- **Tests:** `tests/unit/notification-facts.test.ts` (the six kinds' block), and the moved-games, family-bell and insights
  tests moved to the new one-line words.

## Stage 3 rulings (2026-11-15, owner, all as recommended)

1. **Weekly insights' line:** the first finding and a count of the rest; the findings under "This week" when opened.
2. **Champions' line:** up to three named with their division; more than three counted ("8 divisions have their
   champions — see the final results.").
3. **A declined hand-back's reason stays in the line** (quoted, never shortened); also the Reason row. Accepted adds the
   labels "Came off" and "Club owes".
4. **Refund whose** (Paid for · Payment · Book, the choice as next step) and **one family across events** (Events · From)
   as drawn in the question.

## Stage 3 owner questions (copy; not decided here)

1. **A covered payment** on an accepted hand-back reads "Dec 1 · $432.00 → $0.00" (the old sentence said "is covered").
   Keep the figure, or "→ covered". Owed to the /marketing pass.
2. **Games removed from a draft** read "2 removed from the draft" in the Games row (the line keeps "2 draft games
   removed"). Undrawn; a copy call for /marketing.

## Stage 3 review (2026-11-15)

- **Simplify:** `listRow` is no longer exported: every sender writes `factRow(label, null, { list })`, so there is one way to
  write a row that is its list (the helper stays inside the module as what `factRow` falls through to). The family answers'
  "was X" is written once (`was()`), not three times. Kept as built: each kind's own fold noun and "and N more …" closer
  (their words differ), `FactListLines`' `only` and string-or-`FactLine` items, `bellAnswered` as ONE entry for the four
  builds, the light-module boundary, every `[marketing]` tag and every one-open-copy metadata key.
- **Review, fixed:** the rows are read back all-or-nothing, so one blank part in one list line would have made a notice lose
  ALL its rows and fall back to the bare line. A list line with no text of its own now leads with its bold part
  (`factLine`), and a blank line is left out of any list (`capFactList`) instead of drawing as an empty bullet. "Refund whose"
  also tolerates a registration with no first name (it is left out of the list and the line; with none, the line says "more
  than one child").
- **Review, held (checked against the code):** both family-answer write paths (the fold into an unread notice, and a fresh
  notice) store `facts` built from the same bundle as the title and body, after the dev-only old-vocabulary shim; the weekly
  insights' rows and line come from the same chosen findings the coach's permissions allowed; a declined hand-back's reason
  is quoted exactly (the 500-character cap is at the door, nothing shortens it after) in both the line and the Reason row;
  `tellTeamMoneyPeople` keeps `teamId` and the caller's metadata and adds `facts` only when given (the lapsed ask carries
  none); refund whose gets its `body` and `facts` from the one spread and its one-open-copy key is untouched; the
  no-champion body is unchanged with no rows, and the fans' push still gets its names-only headline; the moved games' body has
  no line breaks and the next step shows only while games wait; a list-only row draws no empty `<dd>`.
- **Docs:** the coaches' help answer on "Your week in review" (and its search text and keywords) now says the push and the
  list lead with one finding and a count, and the opened note lists them under "This week". No other help text quotes the
  five other notices' words.
- **Checks:** the four test files of this work pass; spelling and the type check are clean; `verify:changed` shows only the
  failures already on the tree from other sessions' files (none in a file of this work).

## Stage 2 as built (2026-11-14)

- **The shared shape** `lib/notification-facts.ts` (`metadata.facts`: rows, an optional list under a row, an optional next
  step; `readNoticeFacts` reads it back all-or-nothing; `FACT_LABELS` is the one vocabulary, test-held at ≤ 11 characters).
  The message block draws it for ANY kind that stores it (`FactRows`, `FactListLines` in `NotificationMessage.tsx`); the
  settled line replaces the next step; lists fold at 6, at most 30 stored. On a phone the label stays beside its answer.
- **House league's time** stores the shared shape; a notice sent with the first shape (`metadata.timeChange`) still opens as
  rows (`lib/league-time-notice.ts`). That module is apart from `lib/league-time-handoff.ts` on purpose: the message block
  importing the handoff module reached the coach portal's ~945KB stylesheet (notification-open-in-place-guard).
- **Q9:** the phone reader measures its sheet and pins the button row (`data-sheet-foot`) only when the message outgrows it.
- **The fifteen money kinds** each have ONE words entry that every sender calls with facts. Two fixes found on the way:
  - `card_refund_failed` sender B (a team's bank send-back) said the payment's base amount: now the refund row's amount, or
    the whole payment plus the fee when the fee goes back and the family paid it. A send-back that could not go (Stripe
    refused, or no refund could be opened) and a refund Stripe refused at creation now say "couldn’t be sent", never
    "came back". Sender A (a child's) uses the refund row's amount when there is one.
  - `debit_reversed` for a team said "We emailed the family"; it now says "team".
  - `payments_ending`: the bell has its own one line and rows; the Payouts card keeps `endingNotice`'s paragraph.
- **Label call made in the build (raise if wrong):** the refund rows use "Reason", not the drawing's Q6 "Why" (one word per idea).
- **`team_money_sent`** was listed in Stage 4 below and in the Stage 2 prompt's fifteen; built here (a club money notice).
- **Email check (Q7):** the nine online-payment kinds have email off with no setting — nothing changes. Six club kinds can
  email when switched on (generic email prints the body): `club_bill_arrived` and `club_schedule_review` kept their body;
  `team_money_sent`, `club_payment_not_received`, `club_hand_back_asked`, `club_hand_back_unasked` got shorter. `/legal`
  2026-11-14: not a commercial message, nothing owed (`docs/agents/legal/CASL_LATE_BILL_EMAIL.md`, last section).
- **Words** are draft copy tagged `[marketing]` in the words files, owed to the one /marketing pass.
- Tests: `tests/unit/notification-facts.test.ts` (new), and the reference case's, dispute, paid-twice, 12c review, desk,
  hand-back and sheet-frame guards updated.

## Stage 2 review (2026-11-15)

- **Simplify:** one change. The failed-subscription ending's first sentence was written twice (the bell's line and the
  Payouts card's paragraph); it is now written once and the paragraph builds on it. The nine words helpers are each used
  at least twice and none repeats an existing money formatter; `endingBell` beside `endingNotice` stays (the card reads
  one, the bell the other); the light-module boundary, `useOutgrows` and `pinActions` stay as built.
- **Review, fixed:** two of the six club kinds that can email lost the fact that says WHICH payment when their body
  became one line. "Payment not received" (`club_payment_not_received`) once again names how it was paid and the day;
  "Team money sent" (`team_money_sent`) once again names how. Both are still one line; the rows are unchanged.
- **Review, held:** a malformed `metadata.facts` reads as null (never throws) and a notice stored with the first shape
  (`metadata.timeChange`) still draws as rows; a team's debit reversed says "team" in every row and line; refund amounts
  follow the refund row first, then the payment plus the fee only when the fee goes back and the family paid it, and a
  refund that could not be sent never says "came back"; all fifteen kinds' senders call their one words entry and store
  `facts` (every insert path checked); the pinned button row takes the same room as the unpinned one (16px above, the
  sheet's 14px under), so pinning cannot flip its own measure.
- **Owner questions (not decided here):**
  1. **"Sent to" on a refund that was never sent.** The row reads "Sent to · The card ending 4242" beside "Reason · It
     couldn’t be sent". The destination is right; the label may read as if it went. Keep, or a label such as "Refund to"
     (9 characters). Copy call, owed to the /marketing pass.
  2. **`club_hand_back_unasked`:** the one line no longer says "you can ask for it back from the practice" (that
     instruction is in the opened notice and the email's link). Keep, or restore it in the line.

Census (every kind, its real wording, its group, where it is built): `NOTIFICATION_MESSAGE_ROWS_CENSUS.md`.

## Why

An opened notification shows its body as one paragraph. For many kinds that paragraph strings together a
person, an amount, a date, a place and a next step, or a whole list ("Sat · 11:00 a.m.–12:00 p.m. · Diamond A;
Sat · 12:00–1:00 p.m. · Diamond B, Mar 13 – Apr 3"), so the one fact the reader wants has to be dug out of a
sentence. Found by the owner on "The club gave house league time" (2026-11-14); he asked for a review of every
kind rather than fixing them one at a time.

## The reference case (built 2026-11-14, committed `50622af4e` 2026-11-14)

`house_league_time_given`: the notification stores its facts (`metadata.timeChange`); the opened message — the
reader and the bell's drawer, which share one block — draws them as labelled rows (Season · Schedule · Gives /
Takes back with hours and dates, each slot on its own line), then the next step. The stored body became a
one-line summary, which is what list rows, push and email read. A notice sent before the change keeps its
paragraph. Built bespoke for that one kind; Stage 2 turns it into the shared pattern.

## The census (2026-11-14, 81 kinds)

| Group | Kinds | Treatment |
|---|---|---|
| Done | 1 | the reference case |
| C — a list inside the sentence | 6 | rows + a list |
| B — three or more separate facts | 22 | rows (about 15 are club/owner money notices) |
| X — text a person typed | 4 | untouched, always |
| A — one fact | 42 | untouched |
| Never sent | 6 | tidy-up |

Also found: several kinds are worded differently depending on which code path sends them (e.g. "A refund didn't
reach the card" from five places, "Payment received" from four); three kinds keep their amount or due date in the
TITLE (money received, a payment handed off, a coach's payment reminder); "Score submitted" says only who
submitted it; "Family answers" already stores its facts.

## Owner rulings (2026-11-14)

1. **Scope = all 28** (the 6 list kinds and the 22 few-facts kinds), through ONE shared pattern — not one kind at a time.
2. **The one-line rule:** for each of the 28, the list rows, push and email copy carry a one-line summary; the
   detail lives in the opened message.
3. **Draw it before building** (it is the shared block every notification wears).
4. **Notices already sent keep their paragraph** (pre-customer; no back-fill).
5. **Fix along the way:** one wording per kind across all its senders; the amount-in-title question; the thin "Score submitted".

## Drawing rulings (2026-11-14, owner paste-back: "Yes, as recommended" on each)

- **Q1** Label width on a computer: A, 5.5rem fixed, labels at most 11 characters. On a phone: A, the label beside its
  answer (lists run the full width). This changes the house-league time reference case, which stacks below 480px.
- **Q2** Next step / deadline: A, a deadline is a row; the instruction is one line under the rows; the settled line
  replaces that line once handled.
- **Q3** Long lists: B, fold at 6 ("Show N more …" opens the rest in place; keep up to 30).
- **Q4** Amount in the title (money received, payment handed off, payment reminder): A, leave it in the title.
- **Q5** "Score submitted": A, the one line carries game, score and who entered it (one extra read at send).
- **Q6** "A refund didn't reach the card": one wording, the senders pass facts; titles keep team / child.
- **Q7** Email copy: run `/legal` before Stage 3 (the moved-games email); Stage 2 checks each kind's email.
- **Q8** "A game changed": A, keep the sentence.
- **Q9** The phone sheet's buttons when a notice outgrows it: A, pin the button row at the sheet's foot, only when the
  message scrolls (ruled 2026-11-14, after the paste-back). A change to the reader's frame for every kind, both portals.

## Stages (sequenced by dependency)

1. **Drawing** — one Claude Artifact, before/after at true size, reader on a computer and the phone sheet, five
   real kinds (a money notice, a dispute with a deadline, the moved-games list, family answers, a moved game);
   /design before hand-off. Asks to settle there: the label style, where the next step / deadline sits, how a
   list longer than ~6 lines folds, the amount-in-title kinds, and what "Score submitted" should carry.
2. **The shared pattern + the money group** — one stored-facts shape any kind can fill (label → value rows, an
   optional list, an optional next step), drawn by the shared message block; house league's time moves onto it.
   Then the ~15 money kinds, each kind's senders brought to one wording in the same unit of work.
3. **The list kinds (C)** — family answers (facts already stored), moved games, insights digest, hand-back
   answered, refund whose; champions crowned needs each champion's division, which the body does not carry today.
4. **The remaining few-facts kinds (B)** — coach and league notices (game moved, practice plan, registration,
   withdrawal request, assistant-coach approval, season started). Team money sent was built in Stage 2.
5. **Tidy-up** — the six never-sent kinds; "Score submitted".
6. **One walk** for the whole change, then `/docs` for any help article that quotes a notification's wording.

## Watch items

- **Email copy.** Before shortening a kind's body, check whether its email is built from that body or from its
  own template: an email built from the body would lose its detail (then the email keeps the long form, or gets
  the rows). If any email's content changes materially, run `/legal` (CASL) before hand-off.
- **Needs-attention notices** (most money kinds) carry their own buttons and the settled line; the rows sit
  above both.
- **Bundles** (several notices of one kind on one day) open as a list of members; each member keeps its one-line
  summary — rows are for a single opened notice.
