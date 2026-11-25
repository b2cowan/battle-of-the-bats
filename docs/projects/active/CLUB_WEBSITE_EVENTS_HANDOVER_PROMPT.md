# Club website ← Board Ready events: the handover (for the club website session)

Written 2026-11-24 by the Board Ready Stages 5 + 7 session, for whichever session runs the **Club Website Enhancements**
project next. Pick this up before Stage 1's drawing session; it changes what the end state has to hold.

## What the owner decided (2026-11-24)

**The work on club events is split in two.** Board Ready Stages 5 and 7 (club events; camps and clinics) own everything a
person *does* with an event. The club website project owns everything that *shows* events to the public, and decides
where they fit in its own end state. Neither project has started building, which is why the line is drawn now.

| Board Ready events project owns | Club website project owns |
|---|---|
| Events in Programs, the create window, field time from a permit, "Club events" on the staff calendar | Where events appear on the club home (today's ruling: inside News, A1/A2) |
| Sign-ups, accepting, the waitlist, sessions, the instructor's roster, the books and tax, the retention clock | Whether there is an Events tab at all |
| The sign-up path a family follows: sign-up page, confirmation email, Your sign-up, paying, withdrawing, the receipt | Each event's public page |
| **The one rule for what is public**: shown to Everyone = public, Club staff never, gone the day after it ends. Written once; the website calls it, never copies it | The champs-day public page (a page of games: your games part, your public-games rule, your score refresh) |
| A champs day *as a thing the club sets up* (names a house-league season) | Events in Open now, events at a closed place, sponsors on an event page and in the season report |

The family app (Board Ready ask 10A) belongs to neither; it is drawn and waits for the family-app project.

## What this changes in Board Ready's rulings

The owner ruled all 19 events asks on 2026-11-24 (`BOARD_READY_PLAN.md` §5 Stage 5 and Stage 7). With the split:
- **8A is withdrawn from Board Ready and is yours to decide.** It said: an Events tab after House league (shown only while
  an event for everyone is coming up), a movable "Coming up" row on Home with the next three, each event its own page,
  gone the day after it ends. It **conflicts with your A1 and A2** (fixed home order; events ride inside News; A2's
  rejected option B was "News and Events, each placed on its own"). Re-decide it in your drawings; do not build 8A as written.
- **5A's public page is yours**; the champs day itself stays Board Ready's.
- **19A's family-facing words that appear on the site** ("Sign up", "17 spots left", "Full · waitlist open") are yours to
  place; Board Ready keeps the words on the sign-up path and the club side.
- Everything else stays as ruled in Board Ready.

## The questions your end state now has to answer (draw them; recommend; the owner rules)

Each was found by cross-checking your drawings (`CLUB_WEBSITE_STAGE0_DRAWINGS.html`) and plan against the events
rulings and today's code. Line numbers are from 2026-11-24 working-tree copies.

1. **Events on the home.** Your A2 puts coming events in News (drawings :340, :904, Asks :1277; plan §2.4 :68). Decide:
   events only in News; whether an event with an open sign-up also rides Open now (your game-day frame already draws a
   clinic there, :393; Open now is capped at two rows, A1); whether `/news` lists events; whether any Events tab exists.
   Phone tab count matters: A15 refused a Photos page partly over "a sixth tab on a phone" (:1295); today's tabs are
   Home · Teams · Tryouts · House league · Tournaments (`lib/org-public-sections.ts:29-35`), and your News tab makes six.
2. **Before News exists.** If Board Ready Stage 5 ships before your Stage 4 (News), where do events show? Options: your
   Stage 4's events half moves earlier, or events show nowhere on the home until News and travel by link meanwhile.
   Board Ready's side of this: each sign-up gets a shareable link, as house-league registration has, so a club can send
   it in a Communications message from day one (**ruled yes by the owner, 2026-11-24**).
3. **A champs day on the home.** Its games are house-league games, so your Stage 1 "Today" shows them. Every division's
   last games on one day can flood the home, the problem A3 solved for a running tournament with one row (:401).
   Recommend one Today row that opens to the champs page. The champs page itself shows that day's games with scores and
   no standings (Board Ready drawing tab 6). Today no setting hides game scores (only `show_standings` hides a table,
   mig 423), so the page exposes nothing the public schedule does not already.
4. **The public-games rule and the refresh.** Your plan already makes Stage 1 the single home of "which house-league games
   are public" (plan :410-416, call never copy). The champs page must use it, and your Stage 6 score motion "applied once
   to every score surface" (:278) must count the champs page.
5. **Closing a place.** Your Close a place window lists games only (:837-843, A4). A camp session or a banquet at a closed
   field has no row. Decide whether the window lists events too; Board Ready will expose what is booked where.
6. **Sponsors.** Board Ready's champs page draws a "Sponsored by" line (a club event joins sponsorship's places). Your
   Stage 5 season report (:693-704) does not list event places yet.
7. **The photo question: still needs ONE owner, and the split does not settle it.** Yours (A8/C8/A13/A14): one built-in
   question, the same for every club, answer required but No costs nothing (:1131-1136, `MINORS_IMAGES_AND_CLUB_FEED.md`
   :160), asked at house-league and tryout sign-up (:1162-1168), governing photos filed under a team. Board Ready's 12A: on
   the camp form, an optional yes or no that can't be made required (its `/legal` review, item 8(c)). Two shapes for one
   consent, and a camp is not a team, so a camp "yes" unlocks nothing under your rule. The previous session recommended
   your Stage 3 own the question, camps join its "where it is asked" table, and `/legal` settle the shape. That is the
   owner's call, not yet ruled.
8. **Wording.** Your §3 line "No new no-login family doors. Public = tournaments and team public pages" (plan :86-87)
   reads as forbidding event and champs-day pages; reword it when you place them.
9. **Guard, already right.** Your plan forbids public reads from the staff calendar (`readClubCalendar`, plan :410-416;
   the guard test in F2, :1228). It now holds Club staff events too; keep the guard.

**Naming hazard:** both projects have a "Stage 5" and a "Stage 7" (yours: sponsors, the Big Board; Board Ready's: events,
camps). Always write the project name before a stage number in prompts and plans.

## Rules for this pick-up
- Draw before deciding; recommend; the owner rules. Record his rulings exactly, adding nothing he did not rule.
- Run `/legal` on question 7 (it is the owner's call to route it; ask). Run `/design` on any drawing before hand-off.
- Do not build any of Board Ready's admin or sign-up path; do not re-decide Board Ready's other rulings.
- When ruled, update your plan and PM brief, your board line, and tell the Board Ready plan (§5 Stage 5 has the split
  record; add the outcome there in one line).

Sources: `BOARD_READY_PLAN.md` §5 Stage 5 (the split record) and Stage 7; the events drawing
https://claude.ai/artifact/RdoaEjuySmXcVLyEQc6RtD (`BOARD_READY_STAGE5_7_EVENTS_CAMPS_DRAWINGS.html`); the reviews
`docs/agents/legal/BOARD_READY_STAGE5_7_EVENTS_CAMPS_REVIEW.md`, `docs/agents/accounting/BOARD_READY_STAGE7_CAMPS_REVIEW.md`.
