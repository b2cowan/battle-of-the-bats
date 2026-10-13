# Club Tier Stage 11d, part A — a hand-back that asks for money back: the ask, the answer, the credit (built to the hub's Stage 11d drawings)

> Paste into a fresh session on `dev`. **This part may run while Stage 11c builds** in another session: it changes the
> hand-back, the club's money and the coach's Money › Club, which 11c never touches, and it shares a handful of files
> with 11c, edited by hunks (listed under "Two sessions on one tree"). **Part B** (`CLUB_SCHEDULER_11D_B_BUILD_PROMPT.md`
> — the schedule's page: the callout, the asked Sundays on the grid, the slot window, Fair shares) **waits for 11c's
> commit**, because 11c rebuilds those same screens. Written 2026-10-12, the day Stage 11d was drawn and **ratified**: all
> nine asks and the `/design` review's D1–D7 as recommended (owner: *"I agree with the recommendations proposed in the
> club scheduler 11d's mockups"*).
>
> **The owner's direction, from walking §300 W10:** *"for handing back, can we give the option to include money back
> (i.e. equivalent of requesting money) so then the club confirms the hand back, thus opening the time slot and also
> making a 'payment request' that they later have to action as 'paid' once they do it. if the money is still owing from
> the team the amount they owe just goes down by that amount and there is nothing for the club to further action."*
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 11d**.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`); every NEW, RESTYLED, UNCHANGED and
>   WORDS tag note is a requirement. **This part builds:** **1 · The coach asks** (`#s11d-ask`: the window and the phone
>   sheet), **2 · While the club decides** (`#s11d-wait`: the practice, Money › Club), the **Payment requests** frame of
>   **3** (`#s11d-club-requests`), **4 · The answer** (`#s11d-answer`: the window, its three statements, Decline), **5 ·
>   After** (`#s11d-after`: the coach's bill, the club's account, Record paying) and **6 · The club's own changes**
>   (`#s11d-changes`: Send the changes). **Part B builds** the schedule-page frames of 3 (`#s11d-club-page`,
>   `#s11d-club-plain`) and Fair shares. **Where it stands** (`#s11d-status`) holds the findings S11D-01…06. The "Before"
>   frames are what is built today; they are not to build.
> - **"Formatting check"** (`#s11d-format`) is your checklist, every row, including the `/design` review's **D1–D7**
>   (ruled with the asks). **"Not drawn"** (`#s11d-build`) is the build's shape; every row is in scope, split between
>   the two parts as below.
> - The Decisions tab holds the rulings with their reasons: rows **"Stage 11d · Ask 1–9"**. Where you must depart, say
>   so and record why; never silently.
>
> **Read first:** `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` **§6d** (this stage), §5.6 (Send, and after it is sent), §6's build
> question B (2026-10-11 — the ruling this stage amends) and §7's "11a part A as built" / "11a part B as built"; the data
> dictionary's gotchas for `club_schedules` (gotcha 7 is build question B), `rep_cost_allocations`,
> `rep_allocation_installments` and `rep_team_payment_requests`; the header of `lib/club-money-figures.ts` (one definition
> per figure); the in-repo `memory/design_decisions.md` entry of 2026-10-12 **"A HAND-BACK MAY ASK FOR MONEY BACK"** and
> the entries it leans on ("A SENTENCE IN A WINDOW'S FOOT SITS AT ITS LEFT", the joined money band, the rare door, edit
> autosaves / create asks). Memory `project_club_stage11_scheduler`, `feedback_build_to_approved_mockups`,
> `feedback_portal_is_the_formatting_benchmark`, `feedback_money_figures_one_joined_band`,
> `decision_waiting_count_is_amber_pill`, `decision_rare_door_ends_body`, `decision_edit_autosaves_create_asks`,
> `decision_window_foot_text_left`, `reference_partial_commit_shared_tree`, `reference_shared_ledger_truncation`,
> `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`, `reference_backticks_in_shell_strings`.

## ⚠ The lessons this stage already paid for

- **A money row every figure must read is a census, not a grep.** The Payables Rebuild's prompt listed thirteen
  "readers": five were false positives, two real ones were missing, and it left the WRITERS out — which would have
  shipped bills invisible on every money screen. Before code, list every reader and writer of
  `rep_allocation_installments` (18 direct reads in `lib/` and `app/` at writing, plus the SQL steps, the fixtures and the
  seeders) and of `rep_team_payment_requests.status`, each with what it must do about a credit or an ask, and put the
  list in the plan's as-built. The club side already has one place per figure (`lib/club-money-figures.ts`, held by
  `club-money-one-definition-guard` and recomputed by `check:club-money-arithmetic`): the credit enters THERE, once, and
  the coach side's readers get the same one rule.
- **Two mistakes in opposite directions hide each other** (Coach Money credits, 2026-09-07: a season read wrong by
  $1,379.98 one way and $300.00 the other, and no total caught either). Assert the credit on the pure derivation, per bill
  and per installment, with a gate that fails loudly on zero rows — an earlier gate there read 12/12 while comparing
  nothing.
- **A link added to a money row must ride every step that moves that row** (mig 325: the payee merge moved the lines but
  not a permit's link). An ask and a credit point at slots, a bill, its installments, a request and a team: check the
  team's move into its club (mig 313), the season roll (`club_practices_carry`), a club payment's take-back (mig 275), the
  platform-admin org delete and the fixture's `--reset`.
- **A link written by hand rots.** The club→team money bells link to `…/coaches/teams/{id}/accounting/club`, a route
  deleted 2026-08-31, so every one of them 404s today (`lib/club-money-notify.ts` ~:118, `lib/club-schedule-send.ts` ~:594
  and ~:600; found while drawing this stage, ledger §300 "Found after the close"). Every bell this stage writes links
  through `lib/coach-money-links.ts`; fix the three dead ones first, in their own commit — the coach's answer bell lands on
  Money › Club, so this stage cannot ship over them.
- **Dev sends no email** (`RESEND_API_KEY` is blank in `.env.local`): a send's notice reads "Sent to 0 people", and a walk
  step that quotes an email must say what dev shows (§300 W5). **Walk figures go stale** when a later step regenerates or
  re-sends (§300 W7): read the rows on dev before recording a pass.
- **Unsettled money warns, never blocks** (CLAUDE.md, binding). The drawing's "Not drawn" says an unanswered request
  "already blocks" the season close-out; the code says it holds the season's **payout** (`clubRequestsHoldPayout` over
  `closeOutBlockers`). A waiting ask does exactly what any waiting request does, and nothing more.

## Two sessions on one tree (11c builds beside you)

- **11c's files — do not edit:** `lib/club-schedule-settings.ts`, `lib/club-schedule-engine.ts`, `lib/club-schedule-view.ts`,
  `components/admin/kit/club/schedules/` `NewScheduleWindow.tsx`, `ScheduleGrid.tsx`, `ScheduleWindows.tsx`,
  `FairShares.tsx` and `Schedules.module.css`, the schedule page `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`,
  `tests/unit/club-schedule-engine.test.ts`, `club-schedule-view.test.ts`, and the schedule entries of
  `scripts/layout-screens.mjs`. If this part seems to need one of them, it belongs to part B — write it down for part B.
- **Shared with 11c — edit by hunks:** `lib/club-schedule-server.ts` (11c: the request reader, the list's open count,
  the assignments, `draftToSave`; you: `computeBill` and what it reads), `lib/club-schedule-words.ts`,
  `tests/unit/club-scheduler-guard.test.ts`, `club-scheduler-screens-guard.test.ts`, `club-schedule-bill.test.ts`,
  `lib/help-content/org.tsx` (11c: New schedule's articles; you: the hand-back sub-topic, Payment requests and the
  allocations article), `docs/agents/db/DATA_DICTIONARY.md`. Use the Edit tool, never a whole-file Write; never revert a
  hunk you didn't write; a type error in 11c's half-built files is 11c's — say so, don't fix it.
- **Commit** as HEAD plus your own hunks (memory `reference_partial_commit_shared_tree`), then `git show --stat HEAD`.

## Preconditions (check before code)

1. **Git:** on `dev`; read `git log` and `git status` fresh. `d338c3f0` (11d drawn) and the 11d ratification records are in
   the log. Note which of 11c's files are dirty (11c running) or committed; either way this part proceeds.
2. **The migration's number** is the next free one at the moment you write it (328 was next on 2026-10-12; grep
   `supabase/migrations/` and `MANUAL_PROD_STEPS.json` again — other sessions take numbers). It needs mig 326 (dev only,
   prod `pending`), so its `MANUAL_PROD_STEPS.json` entry is ORDER-CRITICAL: after 326, at the same promote.
3. **Ask 7's notice needs something that runs by itself.** "An ask whose Sundays have all passed closes itself, and the
   coach is told" can't be done on a read alone. Adding or widening a scheduled job is the owner's call **in your
   conversation** (AGENCY_RULES, 2026-09-26: an earlier yes does not carry over). Ask the owner before building it, with
   the options: (a) a step in the existing scheduler tick (the pg_cron → route pattern of mig 183 and `lib/cron-auth.ts`;
   the dues reminders run this way) — **recommended**, the only option that tells the coach on the day; (b) close it at
   the next read of the ask by either side and tell the coach then; (c) no notice: the ask reads *Lapsed* wherever it
   shows. Whatever the answer, the figures follow on read (H below).
4. **Dev's state:** the §300 dome (`uat-rep-club`, schedule `e1d3aa0f-5858-48d1-910b-eedf435b7f7b`) is Final with
   `changed_since_sent` still true from W10's hand-back (15U AA, Mar 7–28, by the old path). Ask 9 stops new hand-backs
   setting it; it doesn't clear an old flag. Leave it, or clear it on dev for a schedule whose only pending changes are
   hand-backs — your call, said in the hand-off either way (part B's walks need to know). Production holds no schedules
   (326 is dev-only), so nothing to backfill.

## Where the code is (re-grep before you trust a line)

- **Hand back:** `lib/club-schedule-coach.ts` — `practiceSeries` (~:183), `handBackChoices` (~:208), `handBack` (~:225;
  lands at once through the step `club_schedule_hand_back`, then `tellBuilders`), `clubSourcesFor` (~:35, the practice's
  source and `handedBackTeamId`); the route `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back/route.ts`
  (gate `canManageSchedule` ~:34); the step in mig 326 (~:1026; it sets `changed_since_sent` ~:1065); the coach's parts
  `components/coaches/ClubSlotParts.tsx` (the source line, the Hand back window and sheet).
- **Send the changes:** `lib/club-schedule-send.ts` — `previewSend` (~:317; `owedBackCents` ~:413 and the changes email
  ~:420), `sendSchedule` (~:453; `owed_back` written ~:517), the bell links (~:594, ~:600 — the dead route),
  `changesSummary` (~:652, its `handedBack`); `lib/club-schedule-bill.ts` — `valuesAfterChanges` (~:196),
  `billCorrections` (~:210, gains and losses), `correctionInstallments` (~:226), `pricedMinutes` (~:42); the step
  `club_schedule_apply_changes` (mig 326); `club_schedule_sends.owed_back`; the window
  `components/admin/kit/club/schedules/SendWindow.tsx` (not 11c's).
- **The bill now:** `lib/club-schedule-server.ts` `computeBill` (shared with 11c — hunks only).
- **Club money:** `lib/club-money-figures.ts` (`ClubInstallmentFacts` ~:55, `clubBillFigures` ~:143, `remindsAbout`
  ~:242, `AccountRowKind` ~:280, `teamAccount` ~:332, `lineAllocated` ~:589, `owedByTheTeams` ~:781, `waitingOnYou`
  ~:792); `lib/club-money-reads.ts` (`loadClubLoop` ~:67, `allocationDetail` ~:201, `teamAccountRead` ~:400,
  `clubRequests` ~:473, `seasonsHoldingPayout` ~:519, `briefMoneyCounts` ~:537, `seasonOwedToClub` ~:556);
  `lib/club-money-reminders.ts`, `lib/club-money-reports.ts`, `lib/club-money-moves.ts`, `lib/club-money-notify.ts`,
  `lib/club-money-words.ts`, `lib/club-budget-read.ts`, `lib/club-budget-report.ts`, `lib/club-fiscal-reads.ts`,
  `lib/club-ledger-read.ts`; who moves club money: `lib/club-money-route.ts` (`canMoveClubMoney` — owner, treasurer, admin
  with Accounting). Screens: `components/admin/kit/club/money/RequestWindows.tsx` (`ApproveWindow` ~:139, its title
  ~:178; `DeclineWindow` ~:208), `app/[orgSlug]/admin/accounting/payment-requests/page.tsx`, the team's account
  `app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx`.
- **Coach money:** `lib/coach-club-bills.ts` (`getSeasonClubBills` ~:49, `getEarlierSeasonOwedBills` ~:103),
  `lib/coach-club-money.ts` (`ClubRequestStatus` ~:25, `clubRequestReportSide` ~:252 — `money_in_meaning` NULL reads as
  reimbursement), the routes `money-summary`, `budget-vs-actual`, `upcoming-payables` under
  `app/api/coaches/[orgSlug]/teams/[teamId]/` (each reads `rep_allocation_installments`), Money › Club
  `app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx`, the one way to link a money tab
  `lib/coach-money-links.ts`, the money permission `lib/coach-capabilities.ts` (`money: 'write'` — Make a request's).
- **Tables:** `rep_cost_allocations` → `rep_allocation_splits` → `rep_allocation_installments`; `rep_team_payment_requests`
  (CHECK `request_type` `payment_to_org|charge_to_org`, `status` `pending|approved|denied` — copy values verbatim;
  `money_in_meaning`); the fiscal lock (`club_allocation_locked`, `rep_cost_allocations_fiscal_lock`). ⚠
  `rep_dues_credits` is a FAMILY's dues credit — not this.
- **Checks:** `tests/unit/club-money-one-definition-guard.test.ts`, `club-money-figures.test.ts`,
  `club-schedule-bill.test.ts`, `club-schedule-send.test.ts`, `club-scheduler-guard.test.ts`,
  `coach-club-payment-season.test.ts`; `scripts/check-club-money-arithmetic.mjs` (runs inside `verify:changed`);
  `scripts/check-club-money-atomicity.mjs` + `club-money-atomicity.sql` (`npm run check:club-money-atomicity -- --mutate`).
- **Exports:** `lib/export/catalog.ts` (the club money exports; the coach's Club panel ~:960).

## What to build

**A · The record** (Not drawn: *The ask*, *The request it carries*). One migration, with the dictionary and the snapshots
(`npm run refresh:snapshots`) in the same unit of work; RLS on, service-role only, every write a SECURITY DEFINER step
scoped by org, locking in one order (mig 326's shape).
- **The ask:** the schedule, the team, the slots asked (each with its own figure), the scope chosen, the figure (the
  slots at what the club billed the team for them, worked out when asked), who asked and when, its state (waiting ·
  accepted · declined · withdrawn · lapsed), who answered and when, the decline's reason. A slot is in at most one
  waiting ask.
- **The request it carries:** a `rep_team_payment_requests` row raised with the ask — `charge_to_org` (from the club),
  `money_in_meaning = 'reimbursement'` (set by the ask, never asked of the coach: the club paying back the time's cost,
  so Budget vs. Actual nets it into the bill's cost through `clubRequestReportSide`), filed under the bill split's own
  item and category (the drawing's "filed under the bill's own word") and the club's line — linked to the ask so neither
  can be edited, approved, declined or deleted apart from the other. ⚠ Every reader of the request's `status` (Waiting on
  you, the payout hold, the fiscal year's open requests, the coach's lists, the reports) must say what an ask's request
  reads as in each state. If a new status value is needed (the drawing's *Credited*, and *Accepted · the club pays it*
  before Record paying), it is a CHECK change: copy the values verbatim and list every reader. **The shape to start from
  (decide with `/db`, record why):** the request carries the asked amount while waiting; at Accept the part still owed
  becomes the credit and the request carries only the rest — closing as Credited when nothing is left to pay, else
  staying open as accepted until Record paying approves it.
- **The credit (Ask 6):** a new row on the club↔team account: dated the day the club accepted, against one bill, never
  more than what is left on it, with its application to each installment STORED at Accept (latest unpaid payment first;
  never re-derived on read, so a later payment or take-back can't move it). It counts in its bill's fiscal year; a bill
  whose year is closed refuses it, in words, and Accept refuses with it (the drawing's "a closed fiscal year refusing a
  credit"; `club_allocation_locked` is the rule). A team's bills from this schedule (the first bill and any correction
  bills) are one pool for the credit, latest payment first.
- **What "still owes" means:** what the team has neither paid nor sent. ⚠ Read it this way and say so in the hand-off —
  the drawing never says what a *sent* installment is to a credit: the coach says the money is on its way, so crediting it
  would leave the club receiving more than is owed. A sent installment counts as paid for the credit; what Accept would
  have taken off it becomes the request to pay.

**B · The coach asks** (specimen 1; Asks 1, 2).
- Hand back's window and its phone sheet gain one tick, **Ask the club for $432.00 back**, off by default, with its line
  ("4 Sundays at $108.00 each, what the club billed 15U AA for them. The club answers first: until it does, the practices
  stay yours."), its figure following the scope picked above it; with the tick the second button reads **Ask the club**.
  Keep it · Ask the club stay the built question pair (no lime, no red). Shown only when the club billed the team for
  this schedule's time and the coach's money access is `write`; Hand back itself keeps its `canManageSchedule` gate.
- **The figure:** each asked slot at the rate the team was billed for this schedule — its priced minutes (the bill's
  `pricedMinutes`, which already halves a shared slot) × the team's rate (its share ÷ its priced minutes at Finalize; a
  correction bill's at `bill_scale`) — summed in cents, never more than the team's bills from this schedule less the
  credits already given. Worked out on the server, never typed, never trusted from the client.
- **Without the tick, Hand back is exactly today's** — except that it no longer marks the schedule (G).

**C · While the club decides** (specimen 2; Asks 2, 3, 4).
- The practices stay on the team's schedule and on every family surface and feed (6d reads them as ordinary practices:
  check it, change nothing there). Each carries the amber **Hand-back asked** pill; the practice's body ends with what was
  asked and **Withdraw the ask**, where Hand back this practice was (the rare door; not red).
- **Money › Club:** the ask is a From-club, money-back request, **Awaiting the club** (the built amber), in Waiting on the
  club's figure. **Withdraw** works from the practice and from the request, and removes the ask and its request together.
- **The club:** the ask is a row in **Accounting › Payment requests** ("Hand back 4 Sundays", the schedule and the dates
  under it, From club, Money back, the amount, the state), counted in Waiting on you; it opens the one **Answer** window.
  Answering takes `canMoveClubMoney`; anyone who can read the list without it sees the ask without Answer.

**D · The answer** (specimen 4; Asks 3, 5, 6). One window (640), the same from every door (Payment requests now; the
schedule's page in part B; the bell): the Sundays, who asked and when, the figure and how it was worked out, the team's bill
(billed · paid · still owed), **one statement of what Accept does** — exactly one of the three drawn ("Accept opens the 4
Sundays and takes $432.00 off what 15U AA owes. Its Feb 1 payment drops from $864.00 to $432.00. Nothing more for you to
do." · "…15U AA has paid its bill, so the club owes it $432.00. It waits in Payment requests until you record paying it." ·
the mixed case, "$200.00 off … the club owes it the other $232.00"), the quiet line on what the open time costs the club,
and the foot: its sentence at the left ("15U AA's coaches are told either way."), **Decline…** · **Accept** (the window's
one lime) at the right. **Decline…** opens its own window: an optional reason the coach reads, *Keep it waiting* ·
*Decline*.
- **Accept is one step:** the slots are handed back by the team (today's hand-back: the practices leave the schedule — a
  worked-on one cancelled and kept, an untouched one deleted — and the slots open), the credit and any request to pay are
  written, the coach is told; it **never** sets Changed since sent. A Sunday that has started by the moment of Accept is
  not in it (Ask 7). Refusals in words: a stale ask, an ask already answered, a closed year.
- **After** (specimen 5): the coach's bill gains **Credited** as a fifth figure in its joined band, only on a bill with a
  credit (D3: Billed · Paid · Left · Next due stay); the ask reads **Credited** (olive, beside Approved); the club's
  account gains a **Credit** row (`#s11d-after-acct`: "Credit · Winter dome · Sundays — 4 Sundays handed back, accepted by
  Morgan Ellis — −$432.00"), the Billed row untouched. The paid case: the accepted request waits in Payment requests
  ("Accepted Oct 14 · to pay") and is paid through the built Approve window, titled **Record paying 15U AA $432.00**, its
  lime **Record $432.00 paid** (D6), the rest unchanged; the coach's row reads "Accepted · the club pays it" until then.

**E · Every figure that reads a bill** (Ask 6) — billed less credited, through the one definition: the coach's Money ›
Club (the bill room, Still to pay the club, Next due), the money summary and upcoming bills, the club's team account and
statement, Owed by the teams, Coming due and the reminders (a payment the credit covers is never reminded about; one it
lowers is reminded at its new amount), Budget vs. Actual on both sides, the club line's allocated and Not allocated (the
club now carries the open time — Answer's quiet line), the fiscal year's figures and its close, the brief's counts, and
every export of them. Extend `check:club-money-arithmetic` (its independent walk subtracts credits on its own) and
`club-money-one-definition-guard` (a reader of installments that skips credits fails the build). Fair shares is part B.

**F · The club's own changes** (specimen 6; Ask 8). At **Send the changes**, a team that loses time is credited off what it
owes (or, for what it has paid, gets an accepted request to pay), under the same **Bill the corrections** switch, whose
line now says both ("A team that gained time gets a small bill for it, and a team that lost time has it taken off what it
owes, on the same budget line."). The loser's line reads "$108.00 comes off what 15U AA owes: its Feb 1 payment." — plain,
as the built lines (D7); the changes email and the send log say it. Written in the send's step with its baseline (11a's
High: never after the emails). **Build question B's owed-back goes:** stop writing `club_schedule_sends.owed_back` (the
dictionary says drop it at the next schema tidy, as `bookings_email`), drop `owedBackCents` from the preview and the email
words, and with them the hidden owed-back a changes send worked out for a hand-back team (S11D-03).

**G · A hand-back never makes the schedule Changed since sent** (Ask 9). The hand-back step stops setting
`changed_since_sent`; a hand-back is already on the team's schedule and the club's page, and its money settles at the
answer. `changesSummary` stops listing a hand-back as a change waiting for a send (keep its return shape for the page —
part B removes what the page does with it).

**H · A Sunday that comes unanswered** (Ask 7). On read, a waiting ask's Sundays are those not yet started and its figure
follows (Answer, the request rows, the coach's line); the stored request amount is trued at Accept. An ask whose Sundays
have all passed reads *Lapsed* and can't be accepted; how it closes and who is told is precondition 3's answer.

**I · Bells and email** (words: `/marketing`). The ask → the schedule's builders and the club's money movers; the answer
(accepted, with what it did to the money; declined, with the reason) → the team's staff with money access; withdrawn;
lapsed. **Where a bell opens (D5, read for who can open what):** a builder who can move club money → the schedule's page
with Answer open (`?answer=<ask id>`; part B makes the page honour it — until then it lands on the page); a money mover
without Schedules (the treasurer, §300 W13) → Payment requests with Answer open (built here); a builder who can't move
money → the schedule's page, where the ask shows without Answer. ⚠ D5 says "the schedule's page", but the treasurer can't
open it, and the ruling's reason ("a record opens from a notice where it lives, its window open") puts the treasurer's ask
in Payment requests. Say so in the hand-off.

**J · Words and help.** Every drawn sentence is a draft: `/marketing` words the tick and its line, the button, the pill,
Withdraw, the request's states, Answer's three statements and its foot, Decline's window, the Credit row, Credited, Record
paying, the send's line and the switch's line, the bells and emails — **before the walks**. `/docs`: the coach's Hand back
with money back (the coach's "Your club's schedule"), the club answering it (org › Schedules' hand-back sub-topic and the
Payment requests article), credits on a bill and the statement (the allocations article, "A schedule's bill"); keep
"refund", "money back" and "credit" as search terms.

## Gates

- **Unit tests are the drawings' numbers:** a Sunday is $108.00 (90 minutes of a full field at $72.00 an hour); 15U AA's
  four March Sundays $432.00; still owing $1,728.00 → its Feb 1 payment $864.00 → $432.00, Outstanding $1,296.00, the
  account's Credit row −$432.00; paid all $2,700.00 → a $432.00 request to pay, no credit; owing $200.00 → $200.00
  credited and $232.00 to pay; a sent installment is never credited; a shared slot asks for the team's half; a Sunday
  started before Accept leaves the figure; a slot in a waiting ask can't be asked again; Send the changes credits the
  loser $108.00 off its Feb 1 payment; a hand-back leaves the schedule Final.
- **Proved on dev in rolled-back blocks** (`.probe/s11d/…sql`, the 10a/11a pattern): ask → accept in each of the three
  cases → the rows; decline; withdraw; a stale accept refused; a closed year refused; two accepts at once (one wins).
- `check:club-money-arithmetic` (credits in its walk) and `check:club-money-atomicity -- --mutate` with new mutations for
  the accept and send steps (every mutation killed); `club-money-one-definition-guard` extended; `club-scheduler-guard`
  (the ask and the credit written only by their steps; Ask 9's flag); a screens guard section for the tick, the pill,
  Answer's foot, the fifth figure only with a credit, Record paying.
- `npm run verify:changed`, `npm run typecheck` (after `npx next typegen`), the targeted unit files, `check:dictionary`,
  `check:spelling`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:old-look`, `check:pdf` if an
  export's PDF changes.
- **`check:layout`, both themes,** on the coach's practice, Money › Club, Payment requests and the team's account (ask the
  owner first — it is the owner's dev server). If a saved sign-in has gone stale, refresh it
  (`npx playwright test --config playwright.config.ts --project=auth-setup`) — a redirect is a failure, not a skip.
- Then `/simplify`, `/review` at the **high-risk** tier (money, a migration, who may answer), and a `/design` review of the
  built screens against the hub at 1440 and 390, Warm and Dark.

## Walks

A new Owner QA ledger § (the number **at the moment you write it**; grep before and after appending, and grep your record
whole before staging — memory `reference_shared_ledger_truncation`), checkable walks on the hub's QA tab under Stage 11d,
one purpose each, with the sign-in card. **Generate every figure on dev before writing a walk** — dev's 15U AA already
handed Mar 7–28 back (W10, the old path), so pick Sundays and teams dev actually holds, and read each team's bill, payments
and what it has sent.
1. **A coach asks, then withdraws** — the tick, its figure following the scope, Ask the club, the pill, Money › Club,
   Withdraw.
2. **The club accepts while the team owes** — from Payment requests: Answer's statement, Accept, the credit on both sides
   (the bill's fifth figure, the account's Credit row, the latest payment lowered, Owed by the teams).
3. **The club accepts after the team paid** — the request to pay, Record paying, both sides.
4. **The club declines** — the reason the coach reads; the practices stay.
5. **A club move at Send the changes credits the team that lost time** — with **W10b**, owed from §300: the correction bill
   for the team that gained it (build question B's money, walked nowhere in §300).
6. **Phone (390)** — the coach's sheet and the practice; **Dark** — every changed frame.
(The schedule's page — the callout, the ringed Sundays, a plain hand-back staying Final, Fair shares, the bell opening
Answer on the page — is part B's walk.)

## Hand-off

- An owner-voice summary: what a coach and a club treasurer see and do differently, the walks to run, the departures (the
  sent-installment reading, D5's treasurer reading, precondition 3's answer), anything found and not fixed.
- **Notes for part B**, in the plan's §6d as-built: what the page must show (the callout, Answer's `?answer=` door, the
  ringed slots, `changesSummary`'s hand-back branch to remove), what Fair shares must read (the money side's figure per
  team for this schedule), dev's state.
- The records: plan `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` ("11d part A BUILT" at the top, §6d's as-built with the reader
  census), the PM brief, the TODO line, memory `project_club_stage11_scheduler`, the ledger §, and the hub's QA tab
  republished at the same address (read it first; parse every script before publishing).
- **Commit only when the owner says:** the three 404 bells in their own commit, then the stage; in shared files, HEAD plus
  your own hunks; `git show --stat HEAD` after each.
