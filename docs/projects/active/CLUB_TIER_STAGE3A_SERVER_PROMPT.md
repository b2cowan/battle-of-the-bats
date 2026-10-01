# Club Tier Stage 3a · session 1 — the server half (club money: one step per money move, one rule, one set of definitions)

> Paste into a fresh session on `dev`. Written 2026-09-30, the day Stage 3a's drawings were **ratified**
> (hub v22): the owner agreed with every recommendation, **Ask 2 option B** (Accounting is one page with tabs).
> **The owner runs this after the tournament admin redesign's Stage 2 is built and committed** (see
> Preconditions).
>
> **Stage 3a runs as two sessions** (the Club Stage 1–2 precedent; the tournament redesign's Stage 2 prompt
> already expects this split):
> 1. **This one:** the server half. The coach's portal changes only where a money move's meaning changes
>    (the coach's "sent", below); no club screen is rebuilt here.
> 2. `CLUB_TIER_STAGE3A_SCREENS_PROMPT.md`: the Accounting frame and every 3a screen, built to the hub. It
>    starts after this session's commit and reads this session's call list.
>
> **Read first:**
> - Plan `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
>   - §3 (the exit definition's money points);
>   - **§4C** (C01–C19 with anchors, and "The same figure, computed differently");
>   - §5 **D1** (the coach's records are the source of truth for team money; the club reads them) and **D2**
>     (the club's year is 3c's; 3a must not contradict it);
>   - **§6 Stage 3, every blockquote:** drawn (v20), the `/design` review (v21), the second pass (v22), the
>     server list, and the ratification.
> - **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3a**.
>   - "Where the money rows stand" is the C-row status as of 2026-09-30. Re-read any row you touch; the code
>     may have moved again.
>   - **"Not drawn" is this session's list.** Every tag note on specimens 1–7 that names server work is a
>     requirement too.
>   - The Decisions tab's Stage 3a rows are the rulings, in full.
> - Memory: `project_club_tier_readiness`, `reference_coach_money_check_then_act`,
>   `reference_cascade_collisions_coach_budget`, `project_coach_money_centralization`,
>   `feedback_portal_is_the_formatting_benchmark`, `reference_code_gotchas_index` (dates:
>   `formatStoredDate` / `formatTime` only; the club's day, never UTC).

## The rulings this builds (owner, 2026-09-30: "I agree with your recommendations")

- **Ask 1 · one rule for every club money move.**
  - Record received, confirm, approve, decline, undo, reverse and send reminders all belong to **whoever holds
    the club's accounting**: the owner, the treasurer, or an admin with Accounting (`canOpenModule(…,
    'module_accounting')` in `lib/member-access.ts`; `canOpenRepMoney` stays the rule for *reaching* the loop).
  - **A coach never writes to the club's books.** The coach records that a payment is **sent** (the day, how,
    the reference). That writes nothing to the club's ledger. The club confirms it **received**, and that is the
    one moment the club's ledger is written.
  - The coach can take back their own "sent" until the club confirms it. A payment the club recorded is the
    club's to undo (S3A-01).
- **Ask 2 · option B.** Accounting owns Allocations and Payment requests. The screens session builds one
  Accounting page with tabs; this session makes every route behind those tabs answer to Accounting's rule,
  not Rep Teams'.
- **Ask 3 · taking money back.** Undo a recorded payment and reverse an approved request. Each asks, each needs
  a reason, and each **voids both sides** (the lines stay, marked void, with the reason and who did it) and
  tells the coach. Nothing is deleted. A transfer between the club's own books voids both halves. A line written
  by an allocation, a request or a house-league fee is changed where it came from, never voided on the ledger.
- **Ask 4 · reminders in 3a.** One Send reminders (Allocations, and one team from inside its bill). It goes to
  each team's head coaches, never the person clicking, with overdue installments included. A preview names every
  recipient and every team that can't be reached (no head coach; an unanswered invitation). "Last sent" says
  when and by whom. It asks first. Manual only.
- **Ask 5a.** A team's page in Accounting is **the team's account with the club**, built from the club's own
  records (billed · collected · paid to the team · outstanding), read-only. The team-ledger copy is no longer
  shown, and the club never writes to it.
- **Ask 5b.** The club is told when a waiting request holds up a team's end-of-season payout. When the club
  closes or rolls one of its teams' seasons, the warning counts unpaid installments and waiting requests
  beside families' dues. **It warns and never blocks** (binding, owner 2026-08-17).
- **Ask 5c.** Money notifications both ways, each shipping with its event.
- **Ask 5d and Ask 6** are the screens session's (the table parts; the ledger that reads like the coach's).
  This session supplies the reads they need (below).

## Before code

- **Present the product-manager UX summary** (AGENCY_RULES). Keep it short for a server session: what changes
  for a coach today (their "Record as paid" becomes "We've sent it" once session 2 lands; the server meaning
  changes here), and what a treasurer will be able to do once session 2 lands.
- **Three questions the drawings left open were RULED 2026-09-30** (owner: "I agree with your recommendations
  on those 3 items"). Build them as ruled; restate them in the UX summary so the owner sees them land.
  1. **A coach's Cash on hand when they say "sent".** The team's money has left its bank the moment the coach
     sends an e-Transfer, but the club hasn't confirmed it. **Ruled:** the coach's book counts it as money
     out on the sent date, tagged "Sent · waiting for the club", as the coach's Ledger tags a scheduled line.
     The club counts it as collected only when it confirms. The coach's Paid / Left on the bill stay "the club
     has it", as drawn.
  2. **Who else gets an allocation reminder.** **Ruled:** the head coaches, plus any team staff member the
     head coach has given money access (the portal's staff capabilities), if one exists; never the sender.
  3. **How the email says to pay the club.** No payment-instructions setting exists. **Ruled:** no new
     setting in 3a. The email's reply-to is the sender, and its words (by `/marketing`) say to reply to
     arrange payment.
- **Git.** Check `git status`. Other sessions' hunks sit in this tree; commit from a private index with
  explicit pathspecs (memory `reference_shared_worktree_stage_race`).
- **The dev server may be shared.** Ask before a sweep or a restart.

## Preconditions

1. **The tournament admin redesign's Stage 2 is committed.** `git log` shows its commits (its Part 0 email
   fix, Part 1's shared kit, and the screens), and `git status` shows none of its files modified (the
   `communication` and `registrations` screens, `RepKit.*`, `KitDialog.*`, migration 314). If any is still in
   flight, stop and tell the owner.
2. **The migration number.** 314 is the tournament redesign's. Take the next free number at the moment you
   write the file (`ls supabase/migrations`), and read `MANUAL_PROD_STEPS.json` for anything still owed.
3. **Decide what exists from the snapshots,** never from migration files (AGENCY_RULES): the installment's
   paid columns, the request's statuses and entry link, the notifications' type constraint, and the ledger
   kinds. Use `docs/agents/db/schema-snapshots/` and live `information_schema`.

## What to build

### 1. Every money move is one step, and a lost race leaves nothing behind (C07, J4-013, S3A-01, Ask 1, Ask 3)

Today the mark-paid routes write the ledger lines *before* the stamp, approval throws the entry id away and
has no "still waiting" guard, and the date is UTC.

- **One database function per move.** Each one writes the state change and both ledger lines (the club's and
  the team's) in one transaction, and **refuses if the state is no longer what the caller saw** (a
  conditional update on the current state; no orphaned pair). Dates are **the club's day**. Every move
  records **who** and **when**, and the ones that take money back record **why**.
  - **Coach: sent.** An installment moves to *sent*, with the day, how (Cheque · e-Transfer · Cash · Card ·
    Other) and the reference. **No ledger line.** This replaces today's coach "record as paid".
  - **Coach: take it back.** Only the coach's own *sent* that the club hasn't confirmed. It writes nothing.
    A received installment refuses in words: the club recorded it, so ask them to undo it (S3A-01).
  - **Club: record received.** Unpaid, or overdue, to *received*, with the day, how and the reference. The
    club's line and the team's line are written, linked both ways (`accounting_entry_id`).
  - **Club: confirm received.** *Sent* to *received*. It is the same write as record received, pre-filled
    from the coach's note.
  - **Club: undo.** *Received* back to unpaid (or overdue by its own date), with a reason. Both lines are
    voided through mig 275's two-sided void, and they stay, marked void.
  - **Club: approve a request.** *Pending* to *approved*, with the day, how and the reference. It writes the
    transfer and keeps its entry id. Guard on `status='pending'`, so a double approval is impossible.
  - **Club: decline.** *Pending* to *declined*, with the reason, which the coach reads. It writes no lines.
  - **Club: reverse an approval.** *Approved* to *reversed*, with a reason. Both lines are voided. The
    reversed request stays in the list and is closed; the coach may file a new one.
- **The migration** (dictionary + snapshots in the same unit of work, `npm run check:dictionary`):
  - the installment's *sent* state and its day, method, reference and who;
  - the received payment's method and reference;
  - the undo and reversal reasons, with who and when;
  - the request's `reversed` status and its entry link;
  - **no backfill.** Legacy rows keep NULL, which means "recorded before 3a". An installment a coach already
    recorded paid stays received; nothing is rewritten.
  - The migration is **prod-owed**. Record it in the plan and in `MANUAL_PROD_STEPS.json`.
- **The coach's figures follow at once.** The Register builds its club rows from the installment and the
  request, not from the club's ledger (verified 2026-09-30), so an undo or a reversal corrects Paid, Left and
  Cash on hand at the next read. Add *sent* to the Register as ruled (question 1): money out on its sent date,
  tagged "Sent · waiting for the club", and back out if the coach takes it back. Keep `npm run check:register`
  green.
- **A stale tap is refused in words.** When the coach acts on an installment or a request whose state has
  changed since the page loaded, return one coded 409 that says what changed and who can fix it (the shape of
  Stage 2's `season_not_live`). Session 2 renders it and refreshes the card in place.

### 2. One rule for who may move club money (C08, B11)

- **One server predicate** for every club money write: record received, confirm, undo, approve, decline,
  reverse, send reminders, ledger entries, transfers, payees and a new allocation. It is the Accounting rule
  above. **Share it; don't copy it.** Today approve allows owner / treasurer / admin, and mark paid allows
  owner / treasurer.
- **Group scope (B11).** Every one of those writes refuses a team outside a member's team-group limit.
- **The reads behind the tabs** (the allocations list and detail, payment requests, Coming due, a team's
  account) answer to the same Accounting rule plus the plan (C17: today the pages check the role only). They
  must stop depending on `module_rep_teams` for a treasurer.

### 3. One definition per figure (S3A-05, C06, J4-019, "The same figure, computed differently")

- **One pure module** that computes, for an allocation, a team and the club:
  - **Collected** = installments the club has *received* (after Ask 1). Approved requests are not in it.
  - **Outstanding.**
  - **Overdue** = unpaid after its due date, in the house day. This is the rule the Upcoming bills panel
    already gets right; the allocations list can never show one today.
  - **Next due.**
  - **Sent, waiting for the club.**
  - A book's **Balance** (all-time; see §5).
- **Every club read uses it:** the allocations list, an allocation, Coming due, a team's account, the Rep
  Teams team page's "With the club" line, and the club Overview's brief counts. 3b's summary will too.
- **Coming due** replaces the Upcoming bills panel's read. Team by team, in bands: overdue; sent, waiting for
  you to confirm; due in the next 14 days (the brief's own window, so the brief's count and this band agree).
  The panel's route retires with the Rep Teams board's panel in session 2 (put it on the retire list).

### 4. Payment requests the club can read (C15, S3A-03, Ask 5b)

- **The request read carries:**
  - the coach's own words;
  - **Filed as** (mig 271's new money / money back; a legacy request carries none);
  - the budget item in the team's plan;
  - who asked and when;
  - how they'd like to be paid;
  - the decision, with its reason, who and when;
  - and **"holding up the payout"**: the coach's own `closeOutBlockers` condition (`lib/season-settlement.ts`),
    **shared, not re-derived.**
- **The words are the coach's:** To club / From club; Approved / Declined / Reversed. One spelling on both
  sides.
- **The club's season window (Stage 2's club seasons route preflight)** counts unpaid installments and waiting
  requests beside families' dues. **It warns and never blocks.**

### 5. The club's books (C12, C13, C14, J4-016, C01, C17, Ask 5a, Ask 6's reads)

- **A team's book is read-only everywhere.**
  - Entries: add, edit and void already refuse on a team ledger; keep that.
  - **A transfer refuses when either side is a team's book.**
  - An ordinary entry can't be re-typed as half of a transfer.
  - A line written by an allocation, a request or a house-league fee is immutable on the ledger.
- **A transfer between the club's own books voids both halves,** through the same two-sided void. It asks for
  a reason and prints it under both.
- **A line names the team.** New lines are written with the drawn words ("Allocation received · 11U AA",
  "Paid to 11U AA", "From 14U Girls") and categories ("Team allocations", "Team support"). **Old lines read
  right too:** where a line has a source link, derive its words from the source at read time; never rewrite
  stored history.
- **The ledger read** that session 2's Ledger tab needs:
  - one book, oldest first, paged, with **no 1,000-row cap** (page through every row);
  - a date window, and a **Starting balance** (everything before the window);
  - the Balance **all-time** (one scope, so the Overview and the Ledger never print two balances for one book);
  - Status (posted · pending · void) with counts of what is there before narrowing;
  - Type (expenses · income · team allocations · team support · transfers · house league fees where the club
    runs one), and Category (the club's own list, never the teams');
  - for each line: who recorded it, and its source (for the line's window and its door);
  - the book's kind (Club · Tournament · House league · Team).
- **The export:** the whole period, one signed Amount column, void lines kept, marked VOID and left out of the
  totals.
- **A team's account read (Ask 5a):** billed, collected, paid to the team, and outstanding as a running figure,
  grouped by the team's own seasons, from allocations, installments and requests. Plus the "held by the teams"
  list (outstanding and next due per team) and the Rep Teams "With the club" line (outstanding, next due,
  whether a request waits). Nothing here reads `accounting_entries`.
- **Payees (C01):** list, rename, merge (every entry moves to the one kept; merge reports how many move) and
  create. **No delete while an entry names one.** The club's payees only.
- **The General ledger is made once.** Fix the creation race with a constraint or an upsert.
- **C17:** a general allocation's `sourceEntryId` is checked against the club's own entries.

### 6. Reminders (C16, J4-015, J4-030, Ask 4)

- **Preview (a read).** For each team: its head coaches and any staff member the head coach has given money
  access (question 2), every installment owed, overdue
  included, with the amount, due date and days late; the teams that can't be reached, and why; and the last
  wave's time and sender.
- **Send (a write).** One wave, to the recipients the preview named, never to the sender. It records who sent
  it, when, and to which teams, so "last sent" is true. There is also a single-team variant for the bill's
  "Remind 16U Girls".
- **The words are `/marketing`'s.** Draft them, tagged. The email must hold the team, each installment with its
  amount and due date, how late it is, and how to pay the club: no new setting; the reply-to is the sender, and
  the words say to reply to arrange payment (question 3).
- **Retire list for session 2:** the Accounting overview's "Allocation reminders · Run now" door. The
  families' "Dues reminders" buttons leave Accounting too, but **their routes stay** (Stage 5 decides any
  club-wide family send; the scheduled dues reminders are untouched).

### 7. Notifications (S3A-02, Ask 5c)

- **Check the type constraint first** (the snapshots). If types are constrained, adding them is part of the
  migration.
- **To the coach and the team's money staff,** in the "Your club" preferences group Stage 2 added
  (`club_season_changed`'s neighbour in `lib/notification-labels.ts`): the club received a payment; undid one
  (with the reason); approved a request; declined one (with the reason); reversed one (with the reason).
- **To the club's accounting people,** in the Accounting rows Stage 1 placed: a coach says a payment is sent; a
  new request; a request is holding up a payout (fired when the coach reaches the payout).
- **Each ships with its event** (Stage 1's rule: never a toggle with nothing behind it). Bell and email as each
  person's settings say. The titles and lines are `/marketing`'s; draft them.

## Not in this session

- Every screen (session 2), including the Accounting frame, the tabs, the forwarding of old addresses, the
  coach panel's words, and help.
- **3b:** Budget, Budget vs. Actual, the board summary, allocate arithmetic (C05, C09, C11), and the per-team
  read of the coach's own figures (D1).
- **3c:** the club's year (C10).
- **Stage 7:** tournament fees reaching a ledger (C18). The Type filter keeps its place.
- **Stage 5:** families' money.

## Gates

- **Watched automation first.** Read `WATCHED_PATHS` in `scripts/check-agent-automation.mjs`. If wiring a new
  gate into `verify:changed` touches a watched path, **ask the owner in this session** before you wire it
  (AGENCY_RULES: an earlier yes does not carry over). Give the wiring its own commit, and write the behaviour
  change in the message.
- **The new gates** (plan §6 Stage 3, owner-ratified as part of 3a):
  - `check:club-money-arithmetic`: the allocation, team and book figures recomputed from rows in a pure module,
    as `check-money-report-arithmetic.mjs` does for the coach;
  - a **"same figure, one definition" guard**: every surface that shows Collected, Outstanding, Overdue or
    Balance calls the one module;
  - a **money-move atomicity test** for every move in §1: a double submit leaves one pair of lines, and a step
    that fails leaves none.
- **Unit tests:**
  - the role rule and group scope, across every write;
  - the state machine: sent to received; take-back only on the coach's own unconfirmed *sent*; undo only on
    received; approve only on pending; reverse only on approved;
  - a transfer refuses a team's book;
  - a transfer's void takes both halves;
  - the ledger read pages past 1,000 rows, and its starting balance is right;
  - the export signs amounts and marks voids;
  - the General ledger race;
  - payee merge;
  - the preview names the unreachable teams;
  - the preflight counts money owed to the club and never refuses;
  - the stale-tap 409.
  - Mutation-test the refusals.
- **Existing guards stay green:** `check:register`, `check:money-report`, `coach-history-endpoint-guard` (no year
  parameter anywhere), `check:org-slug-callers`, `check:spelling`, and `check:dictionary` with
  `refresh:snapshots`.
- Run `npm run verify:changed`, `npm run typecheck` and the targeted unit files. A full unit run wipes
  `test-results/`; run it only when no peer is sweeping.
- Then `/simplify`, then `/review` at the **high-risk** tier (money, auth and a migration).

## Hand-off

- **An owner-voice summary:** what a coach's "Record as paid" now means on the server, and what a treasurer can
  do once session 2 lands.
- **A call list for session 2,** written into plan §6 Stage 3:
  - every route, with its request and response shape and its refusal codes;
  - the definitions module's exports;
  - the notification keys;
  - the retire list: the Upcoming bills panel and route, the overview's reminder doors, the Rep Teams money
    pages, and the old ledger page's writes.
- The plan record, the memory update, and the TODO line.
- **Commit only when the owner says,** from a private index with this session's files only. The migration is
  prod-owed: record it.
