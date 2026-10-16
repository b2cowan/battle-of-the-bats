# Club Tier Stage 11d, part C — a hand-back the coach can change (built to the hub's Stage 11d "C" drawings)

> Paste into a fresh session on `dev`. **Run it after QA §308's last walks (W5, W6) are recorded** — they walk the
> hand-back code this part changes, and a hot-reloaded dev server under a walk makes its read-back worthless. It needs
> **none of part B** (`CLUB_SCHEDULER_11D_B_BUILD_PROMPT.md`); if part B runs at the same time, the shared files are
> listed under "Two sessions on one tree". Written 2026-10-16, the day part C was drawn and **ratified**: Asks 10–14 and the
> `/design` review's D1–D8 as recommended (owner: *"go ahead with your recommendations"*), with Ask 10's families clause
> corrected and re-asked the same day (owner: **"Show as Cancelled"**).
>
> **The owner, after passing §308 W3:** *"i think if a coach hands back a practice but does not ask for the money, it should
> still sit in a pending state where the practice is visible on the schedule until the club accepts it. they may have not
> ticked that by mistake and need to re adjust, it automatically disappearing gives the coach no ability to change the
> request."* The counter-proposal he accepted: the hand-back still lands at once; the coach keeps it on their own schedule
> and can change it there. Then, on the drawing: *"can we make these handed back ones a little more clear? … the single
> cross through of the title isn't that clear"* → C1b, option B.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 (v109) → Mockups → **Stage 11d** → the **"C"**
> links. Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`); every NEW / RESTYLED / UNCHANGED /
> SHARED tag note is a requirement:
> - **C1** `#s11d-c-schedule` — the coach's Schedule list after a hand-back (the After frame) and `#s11d-c-rowstates`
>   (what the row is sits with its title; what waits sits at its end, in amber).
> - **C1b** `#s11d-c-rows` — option **B** (the struck title with a filled quiet pill beside it), at 1440, 390 and in Dark.
>   A–F are the compared options; only B builds.
> - **C2** `#s11d-c-practice` — the handed-back practice's window (After), the four other states, the phone sheet.
> - **C3** `#s11d-c-questions` — *Take back which practices?*, *Ask the club for money back?*, Hand back's two changed lines.
> - **C4** `#s11d-c-club` — the club's Answer for a late ask, and the two bells.
> - **C · Formatting check** `#s11d-c-format` is your checklist, every row, D1–D8 included (ruled with the asks). **C · Not
>   drawn** `#s11d-c-build` is the build's shape; every row is in scope. The "Before" frames are today's; not to build.
> - The Decisions tab holds the rulings and their reasons: rows **"Stage 11d · Ask 10–14"**. Where you must depart, say so
>   and record why; never silently.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` **§6d part C** (this part) and **§6d "As built — part A"**; the
> in-repo `memory/design_decisions.md` entry of 2026-10-16 **"A HAND-BACK THE COACH CAN CHANGE; A ROW THAT ISN'T HAPPENING
> IS STRUCK, WITH A FILLED PILL BESIDE ITS TITLE"** and those it leans on (2026-10-12 "A HAND-BACK MAY ASK FOR MONEY BACK",
> 2026-10-13 "ON A PHONE, A RECORD'S STATUS ENDS ITS BODY", 2026-10-12 "A ROW'S CHIP HAS ONE PLACE", 2026-10-09 "A RECORD'S
> RARE DOOR ENDS ITS BODY", 2026-10-10 "ONE CALENDAR: THE RECIPE" C9); the data dictionary's `club_schedule_hand_backs`,
> `club_schedule_hand_back_slots`, `club_schedule_slots`, `rep_team_events`, `rep_team_payment_requests`. Memory
> `project_club_stage11_scheduler`, `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
> `decision_waiting_count_is_amber_pill`, `decision_rare_door_ends_body`, `decision_edit_autosaves_create_asks`,
> `decision_close_x_is_plain_glyph` (census every instance before stating scope), `reference_partial_commit_shared_tree`,
> `reference_shared_ledger_truncation`, `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`,
> `reference_backticks_in_shell_strings`.

## ⚠ What drawing this part already found

- **Families DO see a cancelled practice.** The first draft said they don't, reading `lib/family-view.ts`'s next-up filter
  (~:162) as the schedule's. The family schedule (`FamilyTeamClient` "· Cancelled"), the team's public page
  (`RepTeamPublicSchedule`) and the family calendar feed (`teamFeedEntries`, F2: "Cancelled · …", marked cancelled) all
  KEEP a cancelled practice — the calendar recipe's C9. The ruling is that families see every handed-back practice as
  Cancelled; read every family surface on dev after the build, don't assume.
- **The daily sweep would destroy a late ask.** `club_hand_back_sweep()` (mig 328 ~:969) walks every `waiting` ask, re-prices
  it from the slots the team is STILL ON whose practice isn't cancelled, and lapses it when no Sunday is still to come. A
  late ask's slots are already handed back and its practices cancelled, so as written the sweep would **true its figure to
  $0.00** the first night and **lapse it** once the Sundays pass. Ask 12 says a late ask never lapses by date and keeps its
  figure. The sweep is something that runs by itself → precondition 3.
- **The practice's fate is decided by a SHARED step.** `club_hand_back_events` (mig 328 ~:676) calls
  `club_practice_retire(event)`, which cancels a worked-on practice and deletes an untouched one — and the club's own moves
  use the same retire. Ask 10 is about **hand-backs**: a hand-back cancels every practice it reaches; what a club move does
  is unchanged unless the owner rules otherwise (list every caller of `club_practice_retire` before you touch it).
- **The not-on chip is shared.** "Handed back" and "Cancelled" are one chip (`.eventChipCancelled`, `ScheduleCalendarViews`
  ~:266) and one head pill in the practice/game window (`ScheduleEventSheet` ~:677, `--warning`). Ask 14 moves the word
  beside the title and makes it quiet **for both words, every event kind** (games too). Census every place a cancelled
  event renders in the coaches portal — the list row, the week and month cell chips (`CellChip` ~:93, `calChipCancelled`),
  the month dot (`calMonthDotCancelled` ~:622), the window's head, any Overview / next-up card — and list them in the
  as-built before stating scope. The drawings cover the list row and the window; a calendar cell has no room for a pill
  (C6: time, then title), so there the strike stays and only the colour goes quiet — say so in the as-built.
- **Walk figures go stale.** §308's walks wrote dev's 15U AA (Jan 31 accepted and paid, Feb 7–28 credited, Jan 24 handed
  back without the tick before part C — deleted, so it can't come back from the coach's side). Read dev before you write a
  walk's figures.

## Two sessions on one tree (if part B runs beside you)

- **Part B's files — do not edit:** the schedule page `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`,
  `components/admin/kit/club/schedules/ScheduleGrid.tsx`, `ScheduleWindows.tsx`, `FairShares.tsx`, `Schedules.module.css`.
  If this part seems to need one, write it down for part B (a late ask on the schedule page reads like any ask, without
  ringed Sundays — their time is already open).
- **Shared — edit by hunks:** `lib/club-hand-back.ts`, `lib/club-hand-back-reads.ts`, `lib/club-hand-back-words.ts`,
  `lib/club-schedule-words.ts`, `lib/club-schedule-coach.ts`, `tests/unit/club-scheduler-screens-guard.test.ts`,
  `club-hand-back.test.ts`, `lib/help-content/org.tsx`, `docs/agents/db/DATA_DICTIONARY.md`. Edit tool only; never revert a
  hunk you didn't write. **Commit** as HEAD plus your own hunks (`reference_partial_commit_shared_tree`), then
  `git show --stat HEAD`.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` fresh. The part C records (hub v109, plan §6d part C, this prompt, the
   design log entry) are in the log or on disk. QA §308 W5–W6 are recorded (or the owner said to go ahead without them).
2. **The migration's number** is the next free one when you write it (grep `supabase/migrations/` and
   `MANUAL_PROD_STEPS.json` — other sessions take numbers). Mig 328 is on production (2026-10-13, job 279), so the new
   migration is an ordinary promote step; its `MANUAL_PROD_STEPS.json` entry goes in the same commit.
3. **The sweep is the owner's call in your conversation** (AGENCY_RULES 2026-09-26: anything that runs by itself changes
   only when the owner asked in the current conversation; an earlier yes does not carry over). Before changing
   `club_hand_back_sweep()`, ask with the options: (a) **recommended** — the sweep skips a late ask (its slots are already
   handed back: neither true its figure nor lapse it), one condition, its own commit; (b) the late ask is a different state
   the sweep never selects (more schema, same effect); (c) leave the sweep — a late ask then lapses when its Sundays pass
   and is trued to $0.00 the first night, which breaks Ask 12. Whatever the answer, put the sweep change in its own commit
   whose message says what behaviour changes.
4. **Dev's state:** read 15U AA and 15U AAA's hand-backs on `uat-rep-club`'s dome (`e1d3aa0f-5858-48d1-910b-eedf435b7f7b`)
   and write down which Sundays the walks can use — a free future Sunday each walk needs, none of §308's.

## Where the code is (re-grep before you trust a line)

- **Hand back:** `lib/club-schedule-coach.ts` (`handBackChoices`, `handBack` ~:301 → the step `club_schedule_hand_back`,
  then `tellBuilders`; `clubSourcesFor` ~:35 — `handedBackTeamId`); the route
  `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back/route.ts` (GET choices + `money`, POST hand back /
  ask, DELETE withdraw; gates `canManageSchedule`, `canWriteMoney`); the steps in mig 328: `club_hand_back_room` ~:649,
  `club_hand_back_events` ~:676, `club_schedule_hand_back` ~:714, `club_hand_back_ask` ~:771, `_withdraw` ~:833,
  `_decline` ~:858, `_accept` ~:894, `club_hand_back_sweep` ~:969. The record: `club_schedule_hand_backs` (`landed` for a
  hand-back without money) + `club_schedule_hand_back_slots` (`waiting`, `handed_back`).
- **The coach's screens:** `components/coaches/ClubSlotParts.tsx` (`HandBackQuestion` ~:107, `HandBackAskStatus`,
  `ClubPracticeEnd`, `WithdrawAskQuestion`), `components/coaches/ScheduleEventSheet.tsx` (the head pill ~:677; the end
  block ~:1110; `askStatusBlock` ~:1162), `components/coaches/ScheduleCalendarViews.tsx` (`EventChip` ~:217, the not-on
  chip ~:266, the struck title ~:307, `CellChip` ~:93), `app/[orgSlug]/coaches/coaches.module.css` (`.eventChipCancelled`
  ~:6292). Words: `lib/club-hand-back-words.ts`, `lib/club-schedule-words.ts` (`handedBack` bell ~:359, the coach words
  ~:827).
- **Reads:** `lib/club-hand-back-reads.ts` (`askSummaries`, `waitingAsksOfTeam`; it skips `landed` records ~:84 — part C's
  coach-side read needs them), `lib/club-hand-back.ts` (`askOffer` ~:89, `askHandBack` ~:114, `withdrawAsk` ~:221,
  `answerView` ~:260, `acceptAsk` ~:309, `declineAsk` ~:347, `sweepHandBacks` ~:371, `asksForRequests` ~:398).
- **The club's Answer:** `components/admin/kit/club/money/AnswerWindow.tsx`, opened from
  `app/[orgSlug]/admin/accounting/payment-requests/page.tsx`.
- **Send the changes' measure:** `lib/club-schedule-send.ts` (~:335–342 — a `landed`/`accepted` hand-back's `handed_back`
  minutes are added back so it never reads as the club taking time; a take-back must undo that).
- **Families:** `lib/family-view.ts`, `app/(consumer)/family/teams/[teamId]/FamilyTeamClient.tsx`,
  `components/public/RepTeamPublicSchedule.tsx`, `lib/export/team-feed-words.ts` (F2), the coach feed
  `lib/coach-calendar-feed.ts`.
- **Who:** `lib/coach-capabilities.ts` (`canManageSchedule`, `canWriteMoney`). **Bells:** `tellBuilders`
  (`lib/club-schedule-coach.ts`), `lib/club-money-notify.ts`; every coach link through `lib/coach-money-links.ts`.
- **Checks:** `tests/unit/club-hand-back.test.ts`, `club-scheduler-screens-guard.test.ts` (§11: the phone's ask status),
  `club-scheduler-guard.test.ts`; `scripts/check-club-money-arithmetic.mjs`; `scripts/check-club-money-atomicity.mjs` +
  `club-money-atomicity.sql` (`npm run check:club-money-atomicity -- --mutate`; T37 is part A's hand-back block).

## What to build

**A · Keep, never delete** (Ask 10; C1, Not drawn *Keep, never delete*). A hand-back cancels every practice it reaches —
worked-on or not — in one migration (a hand-back-only retire; the club's own moves keep `club_practice_retire` as is).
Hand-backs made before this ships keep what they did. Families: nothing to build if every family surface already shows a
cancelled practice as "· Cancelled" / "Cancelled · …" — **verify each on dev**, and fix any that drops it.

**B · How the row reads** (Ask 14; C1b option B, C1 `#s11d-c-rowstates`). The not-on word — Handed back, and Cancelled
with it — moves from the row's end to right after the title, as a **filled quiet pill** (soft ink on the fill, no border;
the drawing's `.p11dc-cx.f` is the look), the title still struck. Amber waiting pills (Hand-back asked, and Money asked
from E) keep the row's end; a handed-back row with a late ask waiting shows both. Same pill in the practice/game
window's head. Phone: beside the title, as the row already lays out. Calendar cells: the strike stays, the colour goes
quiet (no pill — see the census lesson). Both themes; `check:contrast` on the new pill.

**C · The handed-back practice** (Asks 11, 12, 13; C2). Its end: the sentence (when, with how many others, families see
it as cancelled, until when it can come back), then the rare doors **Ask the club for $X back** and **Take it back**, then
the club's sentence — each door only while it can be true (C2's Parts notes are the rules). The four other states as
drawn (the time given away; a late ask waiting — the amber Money asked pill, the ask line, Withdraw the ask; settled — both
the credit and the paid wording; a coach without money access — Take it back only, and who can ask). **Phone:** the
sentence and both doors end the body and the sheet has **no pinned foot** (ruled — the D2 departure from the 10-13 foot);
each door a 44 px row.

**D · Take it back** (Ask 11; C3 first frame). `GET` returns the three rows limited to the hand-back and to what can come
back, with counts and dates; `POST` lands at once through ONE new step (schedule locked first, as every 11d step): per
chosen practice — not started; its slot still open (no team on it since, in the schedule as it stands, sent or not); no
ask waiting on it; no money settled for it — restore the team to the slot (`club_schedule_slot_teams`), clear the slot's
`handed_back_*`, restore the practice as it was (status back, notes and attendance untouched), and take it out of the hand-
back's record (`handed_back` false, or the slot row gone — choose, say so in the dictionary); refuse with a sentence when
nothing can come back. Builders' bell: "{team} took back {n} practices" / "{schedule} · from {first}. The time is
{team}'s again." Never `changed_since_sent`; Send the changes' measure stops adding those minutes back. Families: no
message, as a hand-back sends none. Who: `canManageSchedule`. Keep it handed back · Take it back.

**E · Ask for the money later** (Ask 12; C2, C3 second frame, C4). On a handed-back practice of time the club billed
(Ask 1's test), when no money was asked or settled for that hand-back's practices still handed back, a coach with
`canWriteMoney` on the live season sees **Ask the club for $X back**; the window reads the practices and the figure (Ask 1's
`bill_scale` figure), no choice; Cancel · Ask the club. It makes an ask over those slots with the same From-club,
money-back request on both lists (Ask 4). **Accept** settles only the money by Ask 5's three ways — it opens nothing (the
step must not re-run the opening on slots already open); **Decline** and **Withdraw** change nothing about the time; it
**never lapses by date** (precondition 3). The Answer window's variant: a *Handed back* row ("Oct 16 by …", "Their time is
already open."), the statement money only, and the quiet line counting **only the Sundays still open**, naming how many went
to another team (D3), gone when none are open. The coach's row shows the amber **Money asked** pill at its end while the ask
waits; the practice shows the ask line and Withdraw the ask; Take it back hides until it's withdrawn or answered.

**F · The money people's bell** (Ask 13; C4). When a coach without `canWriteMoney` hands back time the club billed, the
team's people with money write access get "{name} handed back {n} practices without asking for money" / "{schedule} · from
{first}. The club billed {figure} for them: you can ask for it back from the practice." — opening the first practice. No
bell when the coach could see the tick.

**G · Hand back's two lines** (C3 third frame). The lead: "The club can give the time to another team. Your families see it
as cancelled. Until the club gives it away, you can take it back." (replaces the built "Your families stop seeing it", on
the window and the phone sheet). The tick's line adds "You can also ask later, from the practice."

**H · Words and help.** Every drawn sentence is a draft: `/marketing` words the doors, both windows, the pill "Money
asked", the bells, the sentence's four states; D6–D8 are its notes ("paid · still owed" vs the club's bill window's
Collected · Outstanding; "Handed back" also a family refund in Player Dues; "Money asked" a third name for a waiting ask).
`/docs`: the coach's Hand back article gains "Changed your mind?" (Take it back, asking later); the club's Payment
requests article the late ask; the cancelled practice's look anywhere help describes it.

## Gates

`npm run typecheck`; focused lint; the unit suite, with new guards for: the hand-back step never deleting; the not-on pill
beside the title (both words, the list and the head) and quiet; the take-back step's four refusals; the late ask's Accept
opening nothing; the sweep skipping a late ask; the phone sheet's doors in the body, no pinned foot.
`check:club-money-arithmetic`; `npm run check:club-money-atomicity -- --mutate` extended to the take-back step and the late
ask (every mutation caught); `check:dictionary`, `check:spelling`, `check:contrast`; `check:layout --changed` in Warm and
Dark on the coach's Schedule (list, week, month), the practice sheet at 1440 and 390, and Payment requests' Answer.
Then `/simplify`, `/review` (high-risk: money, a SECURITY DEFINER step, an automatic job), `/design` at 1440 and 390 in
Warm and Dark against the drawings, `/marketing`, `/docs`. Refresh the dev snapshots with the migration.

## Walks

One purpose each, on the hub's QA tab and the next free QA ledger section, figures read from dev the day you write them:
1. **Hand back without the tick:** the practices stay, struck, the Handed back pill beside the title; the family schedule
   and the public team page read them "· Cancelled".
2. **Take it back This & future:** the practices come back as they were; the club's schedulers get the bell; the schedule
   isn't Changed since sent.
3. **The club gives one Sunday away, then the coach takes back:** that Sunday is left out of every row's count and its
   practice says the time went to another team.
4. **Ask later, the club accepts while the team owes:** a credit, money only; the Sundays stay open; the Answer's Handed
   back row.
5. **An assistant without money access hands back billed time:** they see Take it back only; the head coach gets the bell
   and asks from the practice.
6. **A cancelled game and a phone, then Dark:** a cancelled game wears the same quiet pill beside its title; every changed
   frame at 390; Dark.

## Hand-off

Plan §6d part C gets "As built — part C" (the census of not-on renders, the retire callers, the sweep answer, the
departures); the ledger section; the hub's QA tab and stage strip (republish per `reference_artifact_publish_needs_full_read`
— `read` first, check "counts as viewed"); TODO; memory `project_club_stage11_scheduler`. Offer `/docs` if not done and
say what dev's walks will find.
