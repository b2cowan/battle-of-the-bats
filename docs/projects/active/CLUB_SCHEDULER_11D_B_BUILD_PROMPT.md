# Club Tier Stage 11d, part B — the schedule's page: the ask above the grid, the asked Sundays, Fair shares (built to the hub's Stage 11d drawings)

> Paste into a fresh session on `dev` **once Stage 11c is committed and 11d part A is built** (its hand-off written in the
> plan's §6d). This part changes the four files 11c rebuilds — the schedule's page, the grid's chip, the slot window and
> Fair shares — so it starts only when 11c has let go of them. Written 2026-10-12 with part A
> (`CLUB_SCHEDULER_11D_A_BUILD_PROMPT.md`), the day Stage 11d was drawn and **ratified**: all nine asks and the `/design`
> review's D1–D7 as recommended (owner: *"I agree with the recommendations proposed in the club scheduler 11d's
> mockups"*).
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 11d**.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`); every NEW, RESTYLED, UNCHANGED and
>   WORDS tag note is a requirement. **This part builds** specimen **3 · The club sees it**'s schedule-page frames —
>   `#s11d-club-page` (the ask above the grid, its Sundays ringed, Final rather than Changed since sent) and
>   `#s11d-club-plain` (a plain hand-back leaves the page Final; Fair shares' note) — Answer's door on the page, and
>   Fair shares' Bill column (Not drawn: *Fair shares*). Part A built everything else.
> - **"Formatting check"** (`#s11d-format`) — every row that touches the page, with the `/design` review's **D1** (an asked
>   Sunday is never colour-only), **D4** (the plain hand-back's note) and **D5** (the bell opens the page with Answer open).
> - The Decisions tab: rows **"Stage 11d · Ask 3, 4, 6, 9"** carry this part's reasons.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` **§6d** and its **"11d part A BUILT"** as-built (the notes for part
> B: the ask's read, the `?answer=` door, the reader census, dev's state); **§6c** and its "11c BUILT" as-built (what the
> page, the chip — a shared slot's stacked names and split edge — and Fair shares look like now); the in-repo
> `memory/design_decisions.md` entries "A HAND-BACK MAY ASK FOR MONEY BACK", "NEW SCHEDULE, ROUND TWO" and "THE SIDEBAR
> COLLAPSES TO AN ICON STRIP … FAIR SHARES' FIGURES GO ABOVE THE TOOLBAR, ITS TEAMS BELOW THE GRID". Memory
> `project_club_stage11_scheduler`, `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_clickable_design_annotations`, `decision_waiting_count_is_amber_pill`, `reference_partial_commit_shared_tree`,
> `reference_shared_ledger_truncation`, `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`.

## ⚠ Where the drawings need a reading

- **Fair shares' plain hand-back disagrees with itself.** `#s11d-club-plain` draws 15U AA's Bill as **$2,268.00** (its time
  priced now) with the D4 note under it, "15U AA handed back 4 Sundays without asking for money: its bill stays
  $2,700.00." — two numbers for one bill on one panel, which is finding **S11D-05** itself. The "Not drawn" row carries
  the ruling's intent: the Bill column reads each team's bill so it **agrees with Money › Club**. Build it that way: the
  plain hand-back reads **$2,700.00** with the note, and the panel's total follows ($27,000.00, not the frame's
  $26,568.00). It is a departure from the frame; say so, with the reason.
- **"Billed less credited plus corrections" misses the paid case.** When an accepted ask's money went back as a request
  to pay (the team had paid), there is no credit, yet the team ends up paying $2,268.00. Fair shares' Bill, once a bill is
  made, = billed + corrections − credited − the money back on this schedule's accepted asks (waiting to be paid or
  recorded paid). Both accepted cases read $2,268.00; the plain hand-back $2,700.00. Before Finalize the column stays what
  it is today (the bill Bill the teams would make).
- **A shared slot asked by one of its teams** (11c's chip) is not drawn: ring the chip and carry the glyph, and let the
  slot window say which team asked.

## Preconditions (check before code)

1. **11c is committed:** its hashes are in `git log` and none of its files is dirty. If 11c is still building, stop and
   tell the owner.
2. **Part A is built:** its as-built and notes for part B are in plan §6d (the ask's read for the page, the `?answer=`
   door, `changesSummary`'s hand-back branch, dev's state). If not, stop and tell the owner.
3. **Fair shares' layout:** check whether the Sidebar Strip & Grid Width build has touched `FairShares.tsx` or the page.
   If either is dirty from another session, stop and tell the owner — three builds have now wanted this one panel. If it
   has landed, the Bill column and the note go on its team card; if it hasn't started, on today's panel, with a note left
   for that build.

## Where the code is (re-grep before you trust a line)

- **The page** `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`: the view's `changes` (`teams` and `handedBack`,
  ~:74), the changed callout built from both (~:298-299 — S11D-02's dead end: Send the changes shows only for
  `changes.teams`), the state chip (`ScheduleStateChip`, ~:250), the slots' `handedBackTeamId` (~:318). Line numbers will
  have moved with 11c.
- **The grid** `components/admin/kit/club/schedules/ScheduleGrid.tsx` `SlotChip` (11c's stacked shared chip; the amber
  ring that already means moved and not yet sent); the phone's Day · By team list (cfe43638).
- **The slot window** `ScheduleWindows.tsx`; **Fair shares** `FairShares.tsx` (today's Bill: `billShares(pricedMinutes(…))`
  on the client — the bill as Bill the teams would make it); `ScheduleParts.tsx` (`JoinedBand`, `Statement`,
  `ScheduleStateChip`); `Schedules.module.css`.
- **The reads** `lib/club-schedule-server.ts` (the page's read — add the waiting asks and, for a money reader, each team's
  money-side figure for this schedule), `lib/club-schedule-view.ts`, `lib/club-schedule-words.ts`; part A's ask read and
  Answer window (names from its hand-off).
- **Tests** `tests/unit/club-schedule-view.test.ts`, `club-scheduler-screens-guard.test.ts`; **help** `lib/help-content/org.tsx`
  (org › Schedules); **layout** `scripts/layout-screens.mjs` (`admin-schedule` and its windows).

## What to build

**A · The ask above the grid** (Asks 3, 4). A callout with the page's amber waiting edge: "15U AA asks to hand back 4
Sundays, with $432.00 back", the Sundays listed ("Sun, Mar 7, 9:30 a.m. · Field 1" …), "Asked by Sam Whitford on Oct 12.
The Sundays stay 15U AA's until you answer." and **Answer** — the page's one lime while an ask waits (the line's Send is
absent on a Final schedule). Answer opens part A's window over the page. Someone who can't move club money sees the
callout without Answer, with a sentence saying who answers (words to `/marketing`). Several asks at once are not drawn:
one callout per ask, oldest first, is the recommendation — say what you chose.

**B · The asked Sundays** (D1). Each asked slot is ringed and carries **Hand back's own glyph** in the chip's corner, so an
ask never reads as a move (the ring alone already means moved-and-not-sent, and colour alone is never a status); the chip
stays Final. Give the glyph its own class (the drawing session lost an hour to a reused class). The slot window names it
**Hand-back asked** — who asked, the figure, and Answer for a money mover. The phone's Day · By team list carries the same
mark.

**C · Final, never Changed since sent** (Ask 9). After any hand-back, with money or without, the page reads Final with
nothing waiting: remove the hand-back branch of the changes callout (part A stopped listing hand-backs), so the dead end of
§300 W10 can't come back (`#s11d-club-plain`).

**D · The door** (D5). The page honours `?answer=<ask id>`: it opens Answer over the page for someone who can move club
money; a stale or answered id lands on the page with a notice saying so; someone who can't answer lands on the page with
the callout.

**E · Fair shares' Bill column** (Not drawn: *Fair shares*; D4). Once a bill is made, each team's Bill is the money side's
figure for this schedule (above), so it agrees with Money › Club; before Finalize it stays the proposed bill. A team that
handed time back without asking reads what it still pays, with the note "15U AA handed back 4 Sundays without asking for
money: its bill stays $2,700.00." The note's tag opens its explanation on click. On the Sidebar Strip layout if it has
landed.

**F · Words and help.** `/marketing` words the callout, the no-Answer sentence, the slot window's line, the stale-door
notice and the note **before the walks**. `/docs`: org › Schedules — an ask on the schedule and answering it there; a
hand-back no longer waits for a send; Fair shares' Bill after a hand-back.

## Gates

- **Unit tests:** the view's callout and asked-slot facts; Fair shares' Bill in four cases — a plain hand-back $2,700.00;
  an accepted ask while owing $2,268.00; an accepted ask after paying $2,268.00; a club move at Send the changes (the loser
  $108.00 less) — and the panel's total from them.
- **Screens guard** (extend `club-scheduler-screens-guard`): Answer is the page's one lime while an ask waits; an asked
  slot carries the glyph, never the ring alone; no changes callout for a hand-back; the page reads `?answer=`.
- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), `check:css-selectors`, `check:contrast` +
  `check:text-contrast`, `check:old-look`, `check:spelling`.
- **`check:layout`, both themes,** `--only=admin-schedule` and the slot window's entry (ask the owner first). A redirect is
  a failure, not a skip.
- Then `/review` (the page reads money: high-risk tier if the read changed, standard otherwise — say which), `/simplify`
  if the diff adds a shared helper, and a `/design` review of the page against the hub at 1440 and 390, Warm and Dark.

## Walks

Checkable walks on the hub's QA tab under Stage 11d, in part A's ledger § or a new one (the number at the moment you write
it; grep your record whole before staging), one purpose each, with the sign-in card. **Generate every figure on dev first.**
1. **The ask on the schedule** — a coach's ask shows as the callout, its Sundays ringed with the glyph, the slot window's
   line; Answer opens the one window; Accept opens the Sundays on the grid and the page stays Final.
2. **The bell's door** — a builder who moves money opens the page with Answer open; the treasurer's bell opens Payment
   requests (part A's).
3. **A plain hand-back** — the page stays Final, nothing waiting; Fair shares' Bill reads $2,700.00 with the note.
4. **Fair shares after an accepted ask** — owing and paid cases read the same figure as Money › Club.
5. **Who can't answer** — a builder without the club's money sees the ask without Answer.
6. **Phone (390)** — Day · By team shows the asked Sunday; **Dark** — every changed frame.

## Hand-off

- An owner-voice summary: what a club admin sees on the schedule now, the walks to run, the departures (Fair shares'
  plain-hand-back figure, the paid case, several asks at once, a shared slot asked by one team), anything found and not
  fixed.
- The records: plan ("11d BUILT" at the top, §6d's as-built), the PM brief, the TODO line (11d done once both parts' walks
  pass), memory `project_club_stage11_scheduler`, the ledger, the hub's QA tab republished at the same address (read it
  first; parse every script before publishing).
- **Notes to others:** the Sidebar Strip build (Fair shares' Bill and its note); Stage 9 / 11b (house league's practices
  will meet hand-backs the same way).
- **Commit only when the owner says:** HEAD plus your own hunks in shared files; `git show --stat HEAD` after.
