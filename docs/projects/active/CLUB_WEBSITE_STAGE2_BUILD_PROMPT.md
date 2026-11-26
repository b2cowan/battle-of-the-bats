# Club Website Enhancements — Stage 2 build prompt (Close a place)

> Written 2026-11-25, after the Stage 2 drawing and its rulings (owner: "Agree with all recommendations. Can you make
> the build prompt?"). **Three sessions, in order**, each pasted into a fresh chat (`/clear` first):
> - **2A** (Opus): *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE2_BUILD_PROMPT.md — Session 2A"*
> - **2B** (Opus): *"… — Session 2B"*
> - **2C** (Opus): *"… — Session 2C"*
>
> Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (§6 Stage 2 and the standing rules under the ladder, §7's Stage 0, events
> E1–E12 and Stage 2 K1–K17 rulings, §9, §10, and the two Stage 2 Progress entries of 2026-11-25: Part 1's census, the
> source of every code citation below, and Part 2's drawing). Status lives on the board (project `club-website`).
> **The drawing is the spec:** `CLUB_WEBSITE_STAGE2_DRAWINGS.html`, published
> https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM. Tab 9 (the build's shape) is the engineering half and `/db`'s
> review is its source; tabs 2–8 are what each person sees. Where this prompt and the plan differ, the plan wins; where
> the plan and the CODE differ, the code wins — say so out loud before building on it.

## ⛔ Start conditions (every session)

1. The K1–K17 rulings are in plan §7, ticked. If not, stop and tell the owner.
2. **Other sessions share this working copy** (at writing: Track P's build, Board Ready Stage 6, the schedules work
   that touches the same Venue library and permits). Commit your lines through a private index
   (`reference_partial_commit_shared_tree.md` in auto-memory), never `git add -A`. The plan and the board line are
   shared files: commit only your hunks.
3. **Milton Bats' three answers** (`CLUB_WEBSITE_STAGE0_PROMPT.md`'s feedback slot). Re-read it. If they are in and one
   bears on a ruled ask (most likely who closes a place, K1, or whether families read the strip, K4), tell the owner
   before building that piece. Do not re-rule it.
4. **Club events.** They did not exist in code when this was written (no table, no admin screen; Board Ready Stage 5
   builds them). If they exist when you start, the window's "Club events · nothing moves by itself" group (E7, tab 2) is
   built in 2B. If not, leave the group's slot and record that E7 rides with whichever of the two lands second, as E6
   and E10 do. Do not invent an events table to draw them.

## What the owner ruled (plan §7, all A, 2026-11-25; build exactly this)

- **K1** The Rainout's people close and reopen: owner, admin, house league admin. Programs a person cannot run (a
  tournament, rep teams) show in their window as counts with no door.
- **K2** A whole place, or one diamond of it.
- **K3** Day + Until. The strip shows from the press, so one set tonight reads "closed tomorrow (Sat, Nov 28)". It is
  gone by itself after Until.
- **K4** One strip box: a line per closed place, then the club's own notice. A closure never ends or replaces that notice.
- **K5** A closure sends at once. There is no hold. A held Rainout would show games as on under a strip that says closed.
- **K6** Scored games are never listed. A game already started is listed unticked, with "Started at 9:00 a.m.".
- **K7** Typed places are found by the place's name inside the typed text, in any case, and listed unticked. "Link
  both" tells no family.
- **K8** No wait on the real-venues project (R4). A club with no places opens the Venue library.
- **K9** The rep mark shows on the coach's schedule and game sheet, the public team page, the family schedule and the
  club home. It clears when the coach moves or cancels the game, or on Reopen.
- **K10** The rep coach email uses `/legal`'s fixed words (tab 7). It goes at the press, from "{Club} via
  FieldLogicHQ", with the admin as reply-to. With no head coach it goes to the team's other coaches. With no coach at
  all, the result says so.
- **K11** **A, not B.** Reopen takes the strip and the marks down and sends one line to each marked game's coach. The
  postponed games stay waiting. Reopen does NOT put back the games that haven't started.
- **K12** No strip on a tournament's pages. The tournament speaks through its own Rain delay.
- **K13** Every tournament playing that day is listed, linked diamonds or not. Its Rain delay opens on that day with
  the place's diamonds picked.
- **K14** Plans: League Plus, Club and Club · Association, through the places gate. No new key. It replaces the Rainout
  everywhere.
- **K15** The house league "Rainout" button opens Close a place on that season's places that day. "Rainout" is one
  word everywhere, held by the spelling check.
- **K16** The strip carries fixed words only. The admin's line goes in the families' email, never on the site.
- **K17** For every Rainout, not only closures: "Needs a new date" moves to the top of the public schedule while it
  holds a game postponed in the last 7 days.

Earlier rulings this stage must hold (do not re-open): Stage 0's A4 (one window), A5 (rep marked, not moved), A6 (typed
games listed unticked) and E7 (club events listed). Stage 1's G4 order and the home's "Not being played today" band
(`lib/club-games-home.ts`).

### Two readings of the rulings, named to the owner at ruling time

- **K15's spelling-check rule.** `check:spelling` is not watched automation, but AGENCY_RULES widens it only on an owner
  ruling, and K15 is that ruling. Add a "Rainout" rule. The six "rain-out" strings in coach copy change in the same
  commit: `coaches/teams/[teamId]/announcements/page.tsx:61,86`, `coaches/teams/[teamId]/page.tsx:1022`,
  `RepAnnouncementEditor.tsx:291` and `lib/help-content/coaches.tsx:1403,1409`. "Rained out" is a different word and
  stays.
- **K14 is a gate change.** In 2B, `/billing` places the gate. `/strategy` logs the decision in `BUSINESS_DECISIONS.md`
  and corrects `PLAN_PRICING_FACTS.md:128`, which still calls the Rainout "not built", in the same commit as the gate.
  `lib/plan-config.ts` is touched only if the Facts doc says it must be.

## Read first (delegate broad reading to a helper; open the lines a conclusion turns on yourself)

- Tab 9 of the drawing, then the Part 1 census (plan Progress, 2026-11-25), and each file it cites. Re-check each
  citation. They were traced on 2026-11-25, and other sessions commit daily.
- The Rainout end to end: `lib/league-rainout.ts`, `lib/league-rainout-server.ts`, `lib/league-rainout-send.ts`, the
  route `app/api/admin/house-league/seasons/[seasonId]/schedule/rainout/` (both levels), migration 427, and the
  house league schedule page that opens it.
- The change log: `lib/league-game-changes.ts` (`placeDiffers`) and `lib/league-game-changes-server.ts` (the
  published, last-sent read).
- The Rain delay: `app/[orgSlug]/admin/tournaments/schedule/components/ShiftDayModal.tsx` and `schedule/page.tsx`'s
  `?tool=rain-delay`.
- The notice slot: `components/public/ClubFrame.tsx`, `lib/consumer-routes.ts:66-71`, and `lib/db.ts`'s notice reads.
  Read them to place the strip, not to change them.
- The Venue library (`lib/venue-library.ts`) and the places gate (`hasOrgVenueLibrary`, `lib/plan-features.ts`).
- The coach idioms to reuse, as shipped: the Moved chip, `ClubSourceNote`, the amber pill
  (`components/coaches/ClubSlotParts.tsx`, `ScheduleCalendarViews.tsx`, `coaches.module.css:3327,6457,6481`).
- The only club-to-coach email today: `lib/club-schedule-send.ts`, the sender and reply-to pattern.
- `/legal`'s review: `docs/agents/legal/CLUB_WEBSITE_STAGE2_CLOSE_A_PLACE_REVIEW.md`.
- `formatTime()` in `lib/utils.ts` for every time; the shared helpers in `lib/timezone.ts` for the club's "today".

---

## Session 2A — the migration and the press (nothing anyone sees)

1. **The migration**, numbered after the highest in `supabase/migrations/` at commit time (538 when written). Tab 9's
   three records:
   - **A closure record per club.** It holds the place and an optional diamond, kept by name too so a deleted place
     still reads. It also holds the first day, Until, when it shows from and ends, postpone or cancel, the families'
     line, who closed it, and who reopened it and when. It is server-only, as the Rainout's is.
   - **Each Rainout record gains its closure and place**, with a guard so a retried press cannot run twice. A closure
     "until Sunday" over two seasons is four Rainout records: one per season per day.
   - **The rep mark as its own record beside the rep game.** It holds the closure, the game, the time and place the game
     had when marked, and when the coach was emailed. A column on the game would let a second closure overwrite the
     first. "The coach moved it" is read, not written: a mark is spent when the game's time or place differs from what
     it had, or the game is cancelled.

   In the same unit: `DATA_DICTIONARY.md` entries for the new records, plus the stale lines tab 9 and the census name.
   House league "postponed" is called dead (:8146, :8692), and the game's diamond and place columns are called
   dev-only (:8717–:8723, :9000, :9003). Re-find these by text; the line numbers drift. Then `npm run refresh:snapshots`
   and `check:dictionary`. **Applying to dev needs the owner's word in this session.** Production waits for the release,
   so add the production step where the release reads it.
2. **One database step for the whole press.**
   - It locks every division of every season first, in one fixed order, so two closures cannot deadlock.
   - It checks nothing changed since the window opened. One refusal covers the whole closure and names the changed
     games.
   - It links the ticked typed games, then writes every Rainout, the rep marks and the closure.
   - On any refusal it undoes all of it. Today's Rainout step *returns* its refusals instead of raising them
     (migration 427), so the new step must turn each one into a full undo.
   - Scored games are never touched (K6). Started games are touched only when ticked.
3. **Reopen as one step.** It stamps the closure reopened (who and when), and takes the strip and the marks down. It
   moves no game (K11 A).
4. **"Link both" is not news (K7).** Today a game that gains a place id counts as a moved game and would email its
   families (`placeDiffers` compares ids). The change log learns that a new link to the same typed place changes
   nothing. Pin it with a test that links a typed game and finds no change row and no email.
5. **The reads, server-side, no job.**
   - The strip's closures: the ones showing now, in the club's day. A closure from the press until the end of Until
     (K3); none once reopened.
   - The window's matching. A game matches on the place id first, then on the place's name inside the typed text, in
     any case (K7). The other place system (`rep_team_events.place_id`, the team's own places) is read the same way:
     say how.
   - Spent marks, by the rule in step 1.
   - A mark reaches a public read only through the reads that already decide what is public. A private team's mark
     never does. A house league game reaches one only through the published, last-sent read.
6. **The guard tests** (tab 9's list, the database half):
   - The press writes everything or nothing. A refusal in the second season leaves the first untouched.
   - A retried press runs once.
   - "Link both" records no change and sends no email.
   - The strip shows from the press and is gone after Until or Reopen, with no job.
   - No unpublished game, draft season or private team's mark reaches a public read.
   - The strip's read carries no count, division or name.
   - A second closure over the same rep game never clears the first's mark.

Nothing anyone sees changes in 2A. It touches the Rainout's step and the change log every house league email reads,
so it gets **its own `/review`** before 2B starts. Run typecheck (shared modules), `verify:changed` and the unit tests.
Offer the commit, and commit only at the owner's word. Records at the end of 2A: plan Progress (what landed, commit
ids), the §6 Stage 2 line, and the board line.

---

## Session 2B — the window, the result and Reopen

Start condition: 2A is committed and reviewed. If not, stop.

1. **The window** (tab 2, every state, phone first at 390, 640 on a computer), from the kit:
   - Built from `KitDialog`, FormTable groups (headers in the display face), `CheckChoice` with its partial tick, the
     view switch (44 px on a phone) and `Statement`.
   - Place or one diamond (K2), Day and Until (K3, stacked on a phone), postpone or cancel, and a line for the families'
     email.
   - The groups, folded on a phone where no decision is needed: house league; rep, "marked for the coach"; typed by
     hand, unticked, with "Link both"; started games, unticked; tournaments, each with "Open its Rain delay" (K13);
     club events if they exist (start condition 4).
   - Programs a person cannot run show as counts with no door (K1).
   - The no-places state opens the Venue library (K8). The nothing-scheduled state reads "Closing it still tells
     families on your site."
   - The button count equals the summary: "Close Lions Park, email 58".
2. **The press and its emails.** Sending happens after the database step, per division, as the Rainout's does. A failed
   division shows in the existing "waiting" banner with a retry. There is no hold (K5): remove "Email now" from this
   path. Then check from the code whether any held Rainout can still exist, and whether its "Put all back" path is
   still reachable. Keep it or retire it on that evidence, and say which.
3. **The rep coach email** (tab 7, K10), in `/legal`'s fixed words.
   - Sent at the press, from "{Club} via FieldLogicHQ", with the admin as reply-to.
   - With no head coach it goes to the team's other coaches. With none at all, the result says so.
   - Reopen sends each marked game's coach one line (K11).
   - It carries no unsubscribe, no link and no offer: `/legal` says that keeps it a service notice.
   - `/legal` reviews the shipped words before hand-off (CLAUDE.md: a change to what the product emails).
4. **The result** (tab 3):
   - "Lions Park closed", with the counts.
   - An amber row for typed games left unticked: "2 games with a typed place weren't changed." and "See the 2 games".
   - The rep line naming the head coach emailed, or saying none was.
   - Each tournament's "its 4 games at Lions Park aren't moved yet." with "Open its Rain delay".
5. **Reopen** (tab 3): the confirm ("Reopen Lions Park?", "Keep it closed", "Reopen and email 1 coach"), then its
   result: "Lions Park reopened", "4 games still need new dates.", and "Give them new dates". Also the Venue library's
   closed row with its Reopen, and the Overview tray line.
6. **The Rain delay hand-off** (K13; no migration). It opens on a given day with a set of diamonds picked; its Field
   filter takes one diamond today. A tournament with no linked diamonds opens on the day with none picked, and reads
   "Kestrel Bay closed Lions Park today. Its diamonds are picked below." only when some are.
7. **The gate** (K14, via `/billing`, then `/strategy` as above): the places gate, checked on the server. The rep steps
   are absent where rep teams are absent. Below League Plus the gate refuses.
8. **The house league "Rainout" button opens this window** on that season's places that day (K15), with the rep games
   there counted before the press. The spelling rule and the six coach strings land here too.
9. Words: exactly tab 9's list and plan §10. Then `/review` on this session. Records: plan Progress, the board line.
   Offer the commit, and commit only at the owner's word.

---

## Session 2C — what families and coaches see, then the close

Start condition: 2B is committed and reviewed. If not, stop.

1. **The strip** (tab 4) goes in the club frame's notice slot, on every club, team and house league page. Closures
   come first, then the club's own notice (K4), in fixed words (K16), in the club's day:
   - "Lions Park is closed today."
   - "… closed tomorrow (Sat, Nov 28)."
   - "… closed through Sun, Nov 29."
   - "Diamond 2 at Lions Park is closed today."
   - "All our fields are closed today."

   It never shows on a tournament's pages (K12). It has no motion and no link control beyond what the notice carries.
2. **The rep mark** (tabs 5 and 6, K9), each through the reads that already decide what is public:
   - The public team page and the family schedule: "Lions Park closed · waits for a new date".
   - The club home's "Not being played today" band: a "Place closed" row saying why.
   - The coach's schedule: the Moved-chip idiom with "Needs a new date".
   - The game sheet: the source note "From Kestrel Bay Softball Association · Lions Park closed on Sat, Nov 28. Give
     this game a new date with Edit, or cancel it."

   It clears when the coach moves or cancels the game, or on Reopen.
3. **"Needs a new date" at the top of the public house league schedule** while it holds a game postponed in the last 7
   days, for every Rainout (K17). This changes a shipped page.
4. **The guards, the screen half:** every surface that can show a marked rep game shows the mark; the strip carries no
   count, division or name on any page.
5. **The walk's seed.** The walk needs a Kestrel Saturday at Lions Park with house league games, a Public rep team
   game, a tournament game and a game with a typed place. Add them to Kestrel's extras seed, daytime only. The prospect
   reset wipes the club's budget lines, so re-run the extras after it. This is a walk task, not a demo step. Whether
   either demo shows a closed place is `/demos`' call, per cycle.
6. Then `/simplify` and `/review`. Then `/docs`, with tab 9's help changes:
   - A new "Close a place" topic: the window, Until, the typed-by-hand group, Reopen, and what each program's families
     and coaches hear.
   - The house league Rainout topics point at it.
   - The coach's help gains "When the club closes a field".
   - The Venue library topic gains the closed row.

   Then `/design` on the shipped screens against the drawing (tabs 2–6), at phone 390 and computer 1280, and `/legal`
   if any emailed or published words moved since 2B.
7. **One walk** as a checkable Artifact: 20–50 boxes, one action per step, exact logins. Closing needs
   `president@kestrel-bay.example.test` or the house league admin `league@kestrel-bay.example.test`; the coach side
   needs the U13 Ospreys' head coach; the public side needs none. Every password is `UATPassword2026!`.
8. **Records:** plan §6 tick and Progress, §9 items found, the PM brief if anything moved, the board line, and the Owner
   QA Ledger row for the walk. Offer the commit, and commit only at the owner's word, from a private index with this
   session's hunks only.

## Hard limits (every session)

- No hold on a closure.
- Nothing moves a tournament game except its own Rain delay.
- No strip on a tournament's pages.
- No admin words on the site.
- No child named.
- No AI-written words.
- No motion.
- No follow, alert or share control in a browser.
- No new background job: the strip ends by its own dates.
- Times only through `formatTime()`.
- Production is read only as counts and schema.

## Done means

- One press that closes a place for every program or changes nothing.
- "Link both" silent.
- The window, the result and Reopen as drawn on a phone and a computer.
- The coach email in `/legal`'s words.
- The strip on every club page and on no tournament's.
- The rep mark wherever a rep game shows.
- "Needs a new date" at the top of the house league schedule.
- The gate on the places plans.
- "Rainout" one word and held.
- Help updated, and one walk waiting for the owner.
- Nothing on production until a release.
