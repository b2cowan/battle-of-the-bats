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
reviewed 2026-11-15, committed 2026-11-15** (see "Stage 3 as built" and "Stage 3 review"); the four undrawn kinds ruled
2026-11-15. Next: the owner's browser check of Stages 2 and 3, then Stage 4.

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
