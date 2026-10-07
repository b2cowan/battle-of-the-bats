# Club Tier Readiness — Stage 3c mockup session prompt ("Club money: the club year")

> Paste into a fresh session on `dev`. Written 2026-10-07, after 3b was built, walked (§271 ✅, all eleven) and
> released (job 277, migration 317 applied first). **This session draws and settles rulings. It does not build.**
> Round 2 of the joint sequence: the tournament redesign's Stage 6 drawing may run at the same time. Read "Working
> beside the other sessions" before touching the dev server, the hub or any shared file.
>
> **Read first:**
> - `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
>   - §3, the exit definition. Point 4 is "plan a budget for a club year".
>   - §4C **C10** (the club cannot plan next year; no year-end, no rollover; the coach works in seasons and the two
>     meet only on an allocation's season), **C17** (the pasted ledger-entry id), and "The same figure, computed
>     differently".
>   - §5 **D2**, the ruling this stage builds: *a club "budget year" is a label the club picks ("2026–27") with a
>     start month; allocations bind to seasons; the money pages default to the current budget year; a year-end
>     exists (lock + carry). No fiscal-accounting features (no periods, no closing entries) in the first release.*
>   - **§6 Stage 3:** 3c's paragraph and **its two mockup items**, both raised by the owner in the §271 walk and
>     already written up in the plan with their "today", their weight, two shapes each and a recommendation:
>     **New allocation, redrawn** and **what the teams recorded paying a shared payee: a window, not a page**
>     (which also puts the payee window under the record standard). Draw them as written; don't re-derive them.
>   - **3b's record:** Ask 5 (the year's opening balance is already worked out from the books, and 3c moves its day
>     and locks a closed year); "Scheduled on the current year only"; *found, not in scope: a season stores no
>     close date*; the §271 follow-ups (bare years in the Year pill, the open year's dot, next year always offered).
>   - "Across every stage — formatting".
> - **The coaches portal's season rulings** (`CLAUDE.md`, "A SEASON IS LIVE UNTIL IT IS CLOSED"; plan
>   `docs/projects/active/COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md`). The closest precedent for a year-end, and the
>   hardest ask here. A season is live until the coach closes it; a closed season is one page. *Start next season*
>   and *Close the season*; unsettled money warns, never blocks; Reopen only while no season is live.
> - The hub (ONE artifact; republish the SAME path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html`
>   = https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. 3b's Mockups section is your drawing method and part of
>   your "before".
> - Memory: `project_club_tier_readiness`, `decision_record_reads_first_edits_whole`,
>   `decision_edit_autosaves_create_asks`, `feedback_portal_is_the_formatting_benchmark`,
>   `feedback_clickable_design_annotations`, `feedback_mockups_as_claude_artifacts`.

## Blocking gate — item ONE is the mockup

1. **Mockups on the hub's Mockups tab, before any code.** Nothing in 3c is built until the owner ratifies the
   drawings. Whole screen, before and after.
2. **Every highlight is clickable**: finding flags with a `data-here` sentence; NEW / RESTYLED / UNCHANGED tags with
   their own note; a findings dialog that jumps to its Full Plan heading.
3. **True size:** phone frames at 390px with the 44px block beside them. **Both themes:** "after" drawn Warm, with
   a Dark copy cloned at load.
4. **Check against the formatting benchmark BEFORE the owner sees a drawing.** Put the check on the hub, as 3a and
   3b did.
5. **Record every ruling on the Decisions tab as it happens.**

## The rulings your drawings follow (in-repo `memory/design_decisions.md`)

- **2026-10-07:**
  - The olive pill chooses what is read (the Year is one); a filter is quiet until it filters.
  - A money tab's figures sit above its toolbar.
  - A close × is a plain glyph.
- **2026-10-06:**
  - The club's Budget and Budget vs. Actual read like the coach's, with six named differences. A seventh is
    drift, not design.
  - A team's cash is read, labelled and never added in.
  - A month grid opens on this month on a phone (K-27 notation).
  - The coach is told what the club reads, in one quiet line.
- **2026-10-05:**
  - Phone sheets are one frame with two layers: a form covers the bar, a menu sits on top of it.
  - A filter's count sits at its row's end.
- **Standing:**
  - **A record reads first and edits whole.** Both of your mockup items turn on it.
  - Edit autosaves, create asks.
  - A waiting count is the amber pill.
  - Export is one button.
  - One toolbar, rare tools behind Tools.
  - One control height (34px on a computer).
  - No club name above a page title.
  - A door is olive text; an action that opens a window is an outlined button.
  - Accounting is one page with tabs.
  - A plan lock is never a dashed box.

## Verify before drawing

- **Every place the club's year is read today.** The year's span has one definition, the calendar year, and 3b
  left a note that 3c moves that one place and nothing else. List:
  - every screen with the Year pill (Budget, Budget vs. Actual, Overview, a payee's report);
  - every figure that takes a year;
  - exports and the board report's title;
  - anything that still reads a calendar year by hand.

  Tag each on the hub: changes with the club year / stays a calendar date. ⚠ The note undercounts. The year an
  allocation counts in, and the year a day falls in, are each read from a date's first four characters in the
  money definitions module (`allocationYear`, `clubYearOf`), so at least three places move, not one. Find them all.
- **C10 re-read against today's code.** Tag each part open / fixed (commit) / partly, since 3b already made next year
  selectable and the opening balance comes from the books.
- **How a team's season meets the club year.** Read which club year an allocation counts in today (3b's
  definition). Then read the fixture's teams' seasons and their dates, and say where a season straddles two club
  years once the start month is not January. Draw the straddling case. Don't assume it away.
- **What "ledgers archive at year-end" can mean.** A club book runs across years. Read whether archiving a book
  makes sense, or whether the plan's line really means "a closed year locks". If the line is wrong, say so.
- **Both mockup items' "today".** The plan wrote them on 2026-10-07; the §271 follow-ups are still landing.
  Re-read the code before drawing the "before".

## The specimens (draw these; nothing else)

1. **Setting the club year up: whole screen, desk + phone.**
   - Where a treasurer names the year and picks its start month, and who can.
   - **The year that changes.** Moving the start month off January makes one year short or long. Draw that
     transition year as the screens will show it.
2. **Every money page reading a named year.** Draw a delta, not a redraw: one tab whole (the Budget), then the Year
   pill, the page head and the board report's title on the others, with "2026–27" in place of "2026".
3. **Closing a year: whole screen, desk + phone.**
   - The action, and who holds it.
   - Its question window: what it locks, what carries, and what is still unsettled (unpaid allocations, waiting
     requests, money not filed under a word). A warning that never blocks, if Ask 2 holds.
   - **A closed year, read.** Every write is absent, not disabled. A backdated line into it is refused with words.
   - Reopen, if Ask 3 keeps it.
4. **The year that opens.** Its opening balance is the closed year's closing, locked. Also show what carries (the
   plan's lines through "Start from last year's plan", which exists today) and what stays in its own year (Ask 4).
5. **This year against last year, and the year-end papers.** The figures an annual meeting reads: the board
   report's year-end form (draw the printed page) and the comparison with last year (where it sits and what it
   compares). Desk + the printed page.
6. **New allocation, redrawn** — as the plan writes it.
   - A: in the line's window (recommended). B: a one-screen page.
   - One form for both doors.
   - Only open seasons offered.
   - The word for a team's season matches the coach portal's ("season", not "Program Year").
   - The per-team rows as a table where a column answers the question.
   - What replaces the pasted ledger-entry id.
7. **A payee's window reads first, with the shared-payee report inside it** — as the plan writes it.
   - A: in the window (recommended). B: keep the page, opened from the Payees list.
   - An unshared payee's window.
   - Whether Export earns a place.
8. **The coach's side, only where 3c reaches it.** For example, does a club year-end tell a head coach anything, or
   does an allocation name the club year? If nothing reaches the coach, say so on the hub instead of drawing a frame.

**Not drawn. List these on the hub as the build's work:**
- the migrations (the year's label and start month; a ledger archive stamp only if Ask 1 needs one; a season close
  date only if a specimen reads one), each with the dictionary and both snapshots;
- the year's span moved in its one place;
- the lock enforced on the server (a write into a closed year refused before it is made);
- the arithmetic gate re-proved across a year that does not start in January;
- **the old look's retirement** in every file 3c rebuilds (New allocation, the payee window, the payee report page if
  A removes it). `npm run check:old-look:report` lists what is left.

## The asks (each with a recommendation; Decisions rows, `open`)

1. **What a closed club year is.**
   - Option 1, recommended: **read in place, locked, through the Year pill** the money tabs already carry.
   - Option 2: **one page**, like the coach's closed season.

   The case for Option 1: a club book runs across years, so the year is a lens on continuous books. The coach's
   season is a container that owns the roster, the practices and the money. The coach's ruling bans a year
   parameter because one would reach thirty screens; here only the money tabs read a year, and they already do.
   Tradeoff: two shapes for "a finished period" across the two portals. Soften it with the same words (closed,
   reopen, warns never blocks). Put this to the owner plainly, because it is a departure from a binding precedent,
   argued on merit.
2. **What closing checks.** Recommend: unsettled money warns and never blocks (the coach's rule), and the question
   window lists what is unsettled.
3. **Reopen.** Recommend: whoever holds the club's accounting can reopen the most recent closed year only, with a
   reason that is recorded. Never two years back.
4. **What carries.** Recommend:
   - the closing balance carries, as next year's locked opening;
   - the plan carries only through "Start from last year's plan";
   - unpaid allocations and waiting requests stay in their own year and are listed on the next year's Overview
     until settled.
5. **Where the year is set, and when it can change.** Recommend: Accounting › Tools, for whoever holds the club's
   accounting. The start month can change until the first year is closed. After that, only an open year's label can
   change.
6. **New allocation: A or B,** as the plan words it (recommended A).
7. **The payee report: A or B,** and whether Export stays (recommended A, Export as a quiet action in the window's
   foot or dropped; say which and why).
8. **Anything the verification finds** that the plan's list misses. Say so; don't force-fit it.

## Working beside the other sessions

- **The tournament redesign's Stage 6 drawing** may run at the same time.
  - **One browser tester at a time.** Before any probe, capture or `auth-setup`, ask the owner whether another
    session is measuring. A second runner rotates the shared UAT sessions.
- **The hub and the Accounting pages may hold another session's uncommitted edits** (the §271 walk follow-ups, for
  example the Ledger's Item column). Read the hub fresh before every edit. If `git status` shows it modified by
  someone else, ask the owner whether that session is finished before you publish. Two sessions republishing one hub
  overwrite each other. Never touch another session's hunks.
- **A new shared pattern is an ask, not an invention.** Rows and tables have one recipe (`ClubRow*` in `RepKit`, the
  money table parts, §3.5's column the screen doesn't own). Phone sheets have one frame. A new variant is drawn as an
  ask tagged "shared".
- **No code, no help, no gates.** Your files:
  - the hub's Mockups Stage 3c section, and its FINDINGS / INTENTS / Decisions additions;
  - the plan's Stage 3 section (3c);
  - the PM brief, your TODO line, and memory.

  Parse the hub's scripts before every publish. Never `force` a refused publish; merge onto what it hands back.
- **Git:** use a private index and explicit pathspecs. Commit only when the owner says.

## Hand-off

- Write in product-owner voice.
- Lead with what a treasurer and a club president see differently:
  - the first time they set the year up;
  - at the end of a year;
  - in the papers they take to the annual meeting.

  Then what a head coach sees, if anything.
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each, **Ask 1 first**.
- Offer `/design` for a review pass if the session has budget.
- **Write the 3c build prompts only after the drawings are ratified.** Their definition of done carries:
  - the old-look retirement;
  - a New allocation walk that **creates one from a budget line and reads it back** (§271's W2 passed by ruling
    because no create was ever seen in the browser).

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Draw fiscal periods or closing entries (D2: not in the first release), or bank reconciliation (its own project,
  both portals, after 3c).
- Draw tournament fees reaching the ledger (Stage 7) or families' money (Stage 5).
- Change the coach's season model or the coach's closed-season page. Where the club year meets a season, the
  season's rules stand.
- Sum a team's money into the club's position.
- Change a price, a plan or a gate, or write customer copy. Draw the placement and tag it `/marketing`.
- Mint a second artifact. The hub is the only one.
