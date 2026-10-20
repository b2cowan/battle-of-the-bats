# Club Tier Stage 7a: the tournament's money (build prompt)

> **Written 2026-10-20** after the owner ruled Stage 7 round 1: **all 13 asks, option A, as recommended** (design log
> 2026-10-20 "STAGE 7: A TOURNAMENT'S FEES LAND IN ITS OWN BOOK…"). **Paste this into a new chat on `dev`.** This prompt is
> **7a only** (Asks 1–4). 7b Add our teams, 7c Email families and 7d the coach's Tournaments get their prompts after 7a commits
> and its walk passes. Do not build them here. Ask 13: **7a gets its own checkable walk page** (one purpose per walk), a § in the
> Owner QA Ledger. Check the ledger's last § right before you write the entry; another session may have taken the number.

## What 7a makes true

A club that hosts a tournament sees the money in the club's books **without typing it twice**. Marking a visiting team paid
writes the fee into **that tournament's own book**, filed under a word the club picked once. The tournament counts in the club's
year as **one budget category** holding its revenue and its costs, so Budget vs. Actual can answer "did the tournament pay for
itself?" through **By activity**, the coach's report shape unchanged. The club's own team in its own tournament **pays no fee and
writes nothing**. The house league's fee path moves onto the **same single write**, which fixes its six defects.

## Read first

- **Drawings and rulings:** https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ (source
  `docs/projects/active/CLUB_TIER_STAGE7_DRAWINGS.html`). For 7a read: End state 2 (`#e-fee`, ~L619) and 3 (`#e-bva`, ~L678),
  the "Not drawn → The build carries → 7a" bullet (~L1034), Asks 1–4 (~L1085–1127), findings S7-01, S7-02, C18, G03, HL, BA.
  Ask 5 (Add our teams) is 7b: take only its **own-team rule** from here.
- `memory/design_decisions.md` entry 2026-10-20 "STAGE 7…" and the 3b/3c entries on the club's books, the fiscal-year lock,
  "Filed under", and the money-figures band (`feedback_money_figures_one_joined_band`).
- Plan §6 Stage 7 (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`). **Its old wording "an automatic income entry on the org ledger"
  is replaced by Ask 1** (the tournament's own book).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's
  summary is a lead, not evidence.** The file:line leads below were gathered 2026-10-20 at HEAD `5ad535318` and the load-bearing
  ones re-opened by the main session; re-read before you rely on any.
- `docs/agents/db/DATA_DICTIONARY.md`: any migration updates it, and `npm run refresh:snapshots`, in the same unit of work.

## The ruled spec

| Part | Ruled | Drawn |
|---|---|---|
| Where a fee lands (Ask 1) | The tournament's **own book**, **opened by itself on the first paid fee**, filed under the word the club picks **once**. Not the org ledger, not the club's general book. Stage 12c's online payment will write the same line. | drawing 2 |
| Own team (Ask 2) | **No fee, said as such:** "Our team" on the row, "No fee" in Payment, "No fee · your club's team" on the coach's page. **Nothing is written to any book.** A club that wants its teams to pay toward hosting bills them through an allocation (Stage 3). | drawings 1, 7 |
| Joining the year (Ask 3) | The tournament is **one category on the club's budget** holding its revenue and its costs. Its book's lines count in the Statement **through the words they carry**. **By activity is the coach's report shape, unchanged.** A cost paid from the general book and filed under the tournament counts toward it. | drawing 3 |
| One write (Ask 4) | **One fee write, built here; the house league moves onto it.** Fixes its six defects, **a failing test for each.** | "Not drawn" 7a |
| Written when paid | A line per payment, **written when paid**, **voided with who and when on an undo, never revived, never fire-and-forget.** "Not tracked here" writes nothing. The tournament's book is opened by itself on the first paid fee with **no race when two people mark at once**; the setting's category and item are made on first use. | "Not drawn" 7a |

Everything the drawings show beyond this table (the setting's look, the By activity block, the own-team row words) is read from
the drawings. The words are `/marketing`'s: build the placements, flag the sentences.

## Corrections to what the drawings and plan said (verified in code 2026-10-20)

1. **The house league's source is `league_registration`** (`SOURCE_MODULE.leagueFee`, `lib/club-ledger.ts` ~L54–58; Type word
   `house_league_fees`), not `house_league`. A tournament fee needs its **own** source value and Type, and `isSourcedLine` must
   cover it (the ledger page already reserves a place in the Type list for "Tournament fees (C18)").
2. **The code comment says "Stages 7 and 9"**, not "Stage 7" (`lib/club-money-figures.ts` ~L635–637, ~L765–767, ~L862–866).
   Stage 9 is the house league's own joining. Update all three comments and decide with the owner **in the PR notes** whether
   the house league's book joins the Statement in 7a or waits for Stage 9: the drawings say "Stage 9's house-league seasons join
   the same way", so the recommendation is **tournaments join in 7a, the house league's join stays Stage 9**; do not
   silently widen it.
3. **Defect 6 is a crash, not a duplicate book.** `accounting_ledgers` already has `UNIQUE(org_id, entity_type, entity_id)`
   (mig 016). The real defect: `getOrCreateLeagueSeasonLedger` is select-then-insert (`lib/db.ts` ~L2885–2904), the loser of a
   race gets null and `mapLedger(data!)` throws. **Copy the safe pattern**: `getOrCreateRepTeamLedger` / `getOrCreateOrgLedger`
   (`lib/db.ts` ~L1884–1931, RPCs `club_team_ledger` / `club_general_ledger`, mig 315). The tournament book gets the same.
4. **Defect 3 is half-true.** A self-signed-up family later marked paid already gets a posted line through `setLeagueFeePaid`
   (`lib/league-fee-paid.ts` ~L91–98). The gap is that **no line exists before payment** and that **waitlist promotion and
   auto-approval write nothing**. With "written when paid" ruled, re-read what defect 3 *means*: if a line only ever appears
   at payment, the "pending line on approval" path (defect 2) is **removed**, not fixed. **Put the consequence to the owner**
   (a club that used the pending line as a receivables view loses it) before deleting it; the drawing's "Not drawn" bullet says
   the approval-day pending line "moves onto the write", which is the other reading. Resolve this at the start of the session.
5. **The tournament check-in "Mark paid" sends no email, bell or notice** and stamps amounts only; the bulk `mark_deposit_paid`
   sends none either; the row action and bulk `mark_paid` send all three. The one write must be called from **every** path that
   changes a paid figure, including check-in, bulk, import, and a team created already paid; but **do not add emails** to the
   quiet paths.
6. **There is no "own team" for a club org in code.** `teams` has no host flag. The only own-team machinery
   (`lib/host-own-team.ts`, `resolveHost`) returns null unless the org is a coaches-portal team workspace. The one signal for a
   club is **a rep-team link row (`rep_team_tournament_registrations`) whose `org_id` equals the tournament's org**. A club team
   that registered as a normal guest has no link and is, to the system, a visitor. **7a defines the rule** (recommended: linked
   to one of this club's rep teams = our team) and **7b's "Add our teams" creates exactly that link**, so the two stay one
   definition in ONE helper. Note the consequence for the owner: an unlinked club team still pays a fee until it is linked.
7. **The accounting Overview decides "no book yet" by book name** (`app/[orgSlug]/admin/accounting/page.tsx` ~L224–225), the
   Ledger page by `entityId`. A renamed tournament book would be offered again. Fix it to `entityId` here (the book is now
   auto-created, so a name match could create a second path to the same book).

## Leads (all under the repo root; line numbers approximate)

**Marking paid, today** (none writes any ledger line):
- Row: `app/api/admin/teams/route.ts` `update` branch ~L421, stamp ~L533–575, email/notice ~L705–725.
- Bulk: `app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts` (`mark_deposit_paid` ~L298, `mark_paid` ~L306).
- Check-in: `app/api/admin/check-in/route.ts` `mark_paid` ~L230–251, `unmark_paid` ~L253–263 (restores prior amounts: **a void must
  follow**).
- Other writers of paid figures: `lib/mark-paid.ts` (`markPaidInFullPatch`), `lib/import/tournament-teams-commit.ts` ~L203–220,
  `create-team` in the teams route, `lib/host-own-team.ts` (host default `paid`; becomes the "no fee" path for coaches-portal
  orgs, leave its behaviour), `app/api/register/route.ts` (creates `pending`).
- Guards that pin these paths: `tests/unit/team-update-allowlist-guard.test.ts`, `tournament-payments-tracked.test.ts`. **No
  test pins the check-in or bulk paths: write them.**

**The house league write** (`lib/db.ts` ~L2871–2938; `lib/league-fee-paid.ts` `setLeagueFeePaid` is already the shared tick):
1. fire-and-forget: `.../registrations/[regId]/route.ts` ~L217–223 and `.../registrations/route.ts` ~L143–150 use `void …catch`; the
   function ignores insert errors and uses `data!`.
2. pending on approval: same two call sites pass `'pending'`, gated on a stale pre-read with no unique index on
   `(source_module, source_entity_id)`: two concurrent approvals can write two lines.
3. none for self-signed-up: `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`, `createRegistration` (~L2552), waitlist
   `promoteFromWaitlist` (~L2647).
4. never voids: `[regId]/route.ts` declined (~L293) and withdrawn (~L360) branches; `voidEntry` (db.ts ~L2017) is imported and unused.
5. revives a void line: `league-fee-paid.ts` L59 `lineMoves = line.status !== (paid ? 'posted' : 'pending')` is true for `'void'`,
   then L75 `updateEntry` makes it posted/pending again; it also silently skips the move if the ledger is not found.
6. the race crash above.
- Existing guards: `tests/unit/club-stage5c-families-guard.test.ts` (pins the one write and "two presses make one line"),
  `club-stage3c-server-guard.test.ts` L65–66 (closed-year refusal inside `league-fee-paid.ts`),
  `club-money-figures.test.ts` ~L275–280, `club-budget-report.test.ts` ~L421. **No test touches the create function, the
  ledger get-or-create, void-on-decline or revival: write one that FAILS on today's code for each of the six, first.**
- The fiscal-year lock: every write goes through `refuseIfClosed`/`isClosedYearError` like `setLeagueFeePaid` does.

**The tournament's book and the Statement**
- Created only by hand today: `app/api/admin/accounting/ledgers/route.ts` ~L46–90 (`entityType 'tournament'`), UI
  `components/admin/kit/club/money/AddLedgerWindow.tsx`. Rail door `useAdminKitNav.ts` ~L71; `accounting/page.tsx` ~L127–138
  forwards only if a book exists.
- "Filed under" rule: `.../ledgers/[ledgerId]/entries/route.ts` ~L112–124 (`word_required`), `readFiledUnder`
  (`lib/club-budget-writes.ts` ~L487–505). **System-written lines skip it** and `fileLine` returns null for a sourced type
  (`lib/club-ledger.ts` ~L150). The tournament fee line is a sourced line, but **it must carry the tournament's word** so the
  Statement counts it (Ask 3); the club picks that word once (the setting, drawing 2). Edit guard for sourced lines:
  `entries/[entryId]/route.ts` ~L24–33.
- Statement scope: `isClubBook(kind)` is `kind === 'org'` (`lib/club-money-figures.ts` ~L639); `countsAsActual` ~L756, `spent`
  ~L768, `bandCollected` ~L780; `lib/club-budget-report.ts` ~L644 (`counted`), `lib/club-budget-read.ts` ~L160 (pending lines for
  club books only). The "other books" row: `otherBooksMovement` ~L868, `club-budget-report.ts` ~L776, `OTHER_BOOKS_WORD`
  (`lib/club-money-words.ts` ~L385), `MoneyMonthGrid.tsx` ~L537, exports `lib/club-money-reports.ts` ~L119/166/254.
  **One definition rule applies** (`club-money-one-definition-guard.test.ts`): change the definition in ONE place and let the
  readers follow. Cash on hand already includes tournament books (`clubCashOnHand` ~L822); keep it exact.
- ⚠ **S7-02:** the club's plan already has an expense category called **"Tournaments"** (entry fees the club pays for its teams
  elsewhere). The hosted tournament's category needs a name that cannot be confused with it: read drawing 2/3 for the name the
  owner saw.

**By activity**
- Coach shape: `lib/coach-budget-rollup.ts` ~L307–325, `rollupMoneyReport` ~L581–712; `ActivityGroup` is **file-local** in
  `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx` ~L586 (helpers ~L298–303, render ~L2378–2410).
  The club already calls `rollupMoneyReport` (`club-budget-report.ts` ~L677) and **throws the activities away** (~L685); its
  page forces `activities: []` (`admin/accounting/budget-vs-actual/page.tsx` ~L157) with view `'statement' | 'months'`.
  Recommended: lift `ActivityGroup` + helpers into `components/coaches/MoneyStatementRows.tsx` (where the shared rows already
  live; `rebaseReport` there is activity-aware), keep `report.activities`, add the third view. **A coach Budget/BvA guard reads
  panel + component**: update both guards. The club's By activity must be **the coach's shape, not a club variant**.

## Hard parts (design these before you write)

- **Atomic book + category + item creation on first paid fee.** Two admins marking two teams at once must not create two books,
  two categories or two items, and must not crash the loser. Put the open-or-get into the database (as `club_team_ledger` did) and
  prove it with the repo's atomicity script pattern (`scripts/check-club-money-atomicity.mjs`, `check:club-money-atomicity`).
  Any migration is ORDER-CRITICAL for the release and goes on the prod steps list (`MANUAL_PROD_STEPS`); function-only
  migrations are verified by `pg_proc`.
- **Undo.** Un-marking paid (row, bulk, check-in `unmark_paid`) **voids** the line with who and when; marking paid again writes a
  **new** line, never revives the void. The same rule for the house league (defect 5).
- **A partial payment / deposit.** The drawings write "a line per payment". Read drawing 2 for how a deposit then a balance
  reads; the check-in `unmark_paid` restores *prior amounts*, so the line set must reconcile with the team's `total_paid` at
  all times. Add an arithmetic check to `check-club-money-arithmetic` (a tournament's book total = sum of its teams' paid
  figures for fee lines). **If the drawings are silent on a case, do not invent: list it and ask the owner.**
- **A fee changed after payment, a withdrawn or declined paid team, a refund.** Refunds paid online are Stage 12; until then a
  refund is a typed money-out line. Decide (and ask) whether declining/withdrawing a paid team voids its fee lines or leaves them
  for the treasurer to refund by hand. Recommended: **leave them and say so** (money was taken); a void is for an *undo*, not a
  refund.
- **Closed fiscal year.** Every write respects the lock (`refuseIfClosed`). A fee marked paid for a closed year's tournament is
  refused with the same words as elsewhere.
- **"Not tracked here" tournaments** (`tournament-payments-tracked`) write nothing.
- **The own-team rule is one helper** shared with 7b (corrections 6).

## Definition of done

1. The six house-league defects each have a test that **failed on the old code** (red first), now green.
2. Marking paid by every path (row, bulk, check-in, import, create-paid) writes exactly one posted line per payment in the
   tournament's book; undo voids it; re-marking writes a new line; the own team and "not tracked" write nothing; two admins at
   once make one book. Tests for each, including the check-in and bulk paths.
3. The club's Statement and By activity read the tournament through its category; Cash on hand unchanged by joining; the
   arithmetic check extended and green (`npm run check:club-money-arithmetic`, `check:club-money-atomicity`).
4. The own team reads "Our team" / "No fee" / "No fee · your club's team" (admin row and coach page); the coach status model's
   `hasSchedule` path does not say "No fee set by the organizer" for it.
5. Gates: `npm run verify:changed`, `typecheck` (shared modules), the club unit tests, `check:layout --changed` on the 2–3
   screens touched, `check:spelling`. Dictionary + snapshots if a migration. **Do not run the whole-product layout sweep on dev.**
6. Records: plan §6 Stage 7 "7a BUILT" (departures + found-not-fixed), TODO, design log for any new ruling, Owner QA Ledger §,
   the project index (`stages/s7` + a log row), the 7a walk page (Ask 13). Offer `/review`, `/simplify`, `/design`, `/docs`
   and `/marketing` per CLAUDE.md; **commit only when the owner says**, through a private index (the tree holds other sessions'
   edits in TODO, plan, ledger, design log).

## Put to the owner at the start (do not guess)

1. Defect 2/3 reading: remove the approval-day pending line (written when paid only), or keep a pending line and fix it?
2. The house league's book: joins the Statement in 7a, or stays Stage 9's? (Recommended: stays.)
3. Declined/withdrawn paid tournament team: fee lines stay for a typed refund (recommended) or void?
4. Own-team rule: linked to this club's rep team (recommended); an unlinked club team still owes a fee until 7b links it.
