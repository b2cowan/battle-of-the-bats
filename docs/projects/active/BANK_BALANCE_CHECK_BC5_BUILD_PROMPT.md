# Bank balance check BC5: the club's touchpoints (build prompt, two sessions)

> **✅ BC5 DONE. BC5b built 2026-11-06** (the printed check, bank first; the Bank help article; the club words' `/marketing`
> pass; walked `BANK_BC5B_WALK_PASSED` at 1440 and 390; owner rulings in plan §0 "Report door / Report books changed /
> Report order / Report extras"; record in plan §9 BC5). Next: BC6 (the coach's source and routes), and BC8's Teams
> column question for the owner.

> **BC5a done 2026-11-06, committed `0ec285816`** (built, walked `BANK_BC5A_WALK_PASSED` at 1440, 390 and 361, `/design` and `/review` applied;
> owner rulings in plan §0 "Overview accounts / Overview past year / Close row / Close snapshot"; record in plan §9 BC5).
> **Next BC5b** (below). For BC5b: the `/marketing` pass also takes the Overview line's words (`BANK_WORDS.overview*`) and
> the close row's (`CLOSE_YEAR_WORDS.bank*`); three `/design` points went to the owner (the chip after the chevron, the
> close row's "off by" not amber, its long bold noun). BC4b committed `6931b1e77` before BC5a began.

> **Written 2026-11-06**, after BC4b was built (plan §9 BC4). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC5_BUILD_PROMPT.md` into a new chat on `dev`.** The first session
> builds **BC5a**; it ends by writing one line at the top of this file ("BC5a done …, next BC5b") and the second session
> starts at BC5b. ⚠ **First check BC4b is committed** (`git log --oneline -8 -- components/admin/kit/club/money/bank/`
> shows a "BC4b" commit). If it isn't, stop and ask the owner: BC4b's files are the same files BC5 edits.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`: a private index built on the current
> HEAD, `BASE` recorded at `read-tree`, the pre-commit hook run on that index, a HEAD guard immediately before
> `commit-tree`, a compare-and-swap `update-ref`; files other sessions also edit, such as `TODO.md` and
> `DATA_DICTIONARY.md`, are built as HEAD + your exact edit). ⚠ This repo's shell drops backslashes in heredocs and a
> backtick inside a `node -e` string EXECUTES: write edit scripts with the Write tool, or use the Edit tool.
>
> **Why two sessions:** BC5a touches two existing club screens (the Accounting Overview and the fiscal-year close
> question) and one server read; BC5b is a new printable page, a help article and the club half's words. Each is a
> session's worth, and BC5b's words pass wants BC5a's lines on screen.
>
> **Not in BC5:** the club Teams tab's "Bank checked" column (plan R0 tab 7 draws it, but it reads each TEAM's bank, so it
> is BC8, the club's read after Stage 14; ⚠ BC8 must square it with the owner's 2026-11-06 ruling that the club sees one
> cash figure per team and never a view into a coach's books, auto-memory `decision_coach_books_stay_the_teams`);
> anything coach-side (BC6+); "Cash not deposited yet" on the club form (coach only, BC7: the club's saved check can
> already SHOW a cash amount, `BankCheckWindow`, but the club form sends `cashCents: null` and has no field, as ruled);
> the prod apply of migrations 447, 449 and 450 (`MANUAL_PROD_STEPS.json`, one promote with the bank code).

## What is already there (read the code, not this list, before acting on a claim)

- **The Bank tab** on a desk and a phone (BC2–BC4, `components/admin/kit/club/money/bank/`): the check, Find, the saved
  checks, the opened check (`BankCheckWindow`), the starting statement. Its words: `lib/bank-tab-words.ts`; refusals:
  `lib/bank-check-words.ts`. The tab's own top line already says "Checked through {date}" with an amber "Off by $X" chip
  that opens the latest check (`BankStatements`, ask 4).
- **The latest check per account** is read only for the Bank tab: `readClubBankAccount` (`lib/bank-club-read.ts`, its
  `latest` map from `checkedThrough()` in `lib/bank-club-rules.ts`), exposed as `accounts[].checkedThrough` by
  `bankAccountView` (`lib/bank-club-steps.ts`). **`bankOverview` (`lib/bank-club-steps.ts`, GET
  `/api/admin/accounting/bank`) returns `{ never, accounts:{id,name}[], books, canMove }` with no latest check**, though
  the route file's comment says it does: fix the comment or the read, whichever BC5a builds.
- **The Accounting Overview** (`app/[orgSlug]/admin/accounting/page.tsx`): PageNotice, the Year pill + Export, the year
  lines, `PayoutsStatusLine` (the nearest existing status line to copy), then the "Where the club stands" heading
  (`SUMMARY_WORDS.standsHeading`), the money band, `StillOpen`. Nothing bank-related renders there today. A closed fiscal
  year reads in place through the Year pill (CLAUDE.md's club fiscal-year ruling): decide what the line says on a past year.
- **The fiscal-year close question** (`CloseYearQuestion`, `components/admin/kit/club/money/FiscalYearParts.tsx`): its
  "Still open" list renders `OpenRow({count, noun, detail, figure, href, waiting})` rows from `closeQuestion()`
  (`lib/club-fiscal-reads.ts`, `YearOpenMoney`: installments, requests, unfiled, pending); `closeFiscalYear`
  (`lib/club-fiscal-year-moves.ts`) stores the snapshot. A bank row would be a fifth kind. ⚖ Warn, never block.
- **A printable page precedent:** `components/admin/tournament/PrintedPage.tsx` (`PrintedPage({name, eyebrow, title, dates,
  foot, children})`, `@media print` in its module), used by `app/[orgSlug]/admin/tournaments/summary/page.tsx`
  (`window.print()`, the page hidden on screen). Nothing prints under club Accounting today.
- **Help:** `lib/help-content/accounting.tsx` has no Bank article (only "bank" in passing; the Payouts article
  "Matching a payout to your bank statement" is the neighbour).
- **Walk probes:** `.probe/bank-bc3/walk.mjs`, `.probe/bank-bc3/bc3b.mjs`, `.probe/bank-bc4/bc4a.mjs`, width-aware (`WIDTH`),
  run with `node --import ./tests/ts-resolver.mjs --env-file=.env.local <file>`; they clean up after themselves and the walk
  account ("Walk chequing", uat-rep-club) ends on its Sep 30 start only. A fixed `waitForTimeout` before reading the
  figure has flaked under load: wait for the text instead.

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (ask 4 "the checked-through line", ask 9 "the association report stays", the BC4b
   phone rulings), §4 (the formula: the report prints it top to bottom), §5 (the unticked club words: "Bank" the tab, the
   mark "Bank: {account} checked through {date} ›" · "Bank: not checked yet ›", the report words, the help search words and
   the "reconcile" collision), §6 (**R0 tab 7** "where the mark shows" and **R0 tab 9** "the report", both re-worded by
   asks 4 and 9), §9 BC5 and BC8.
2. The drawings: `BANK_RECONCILIATION_DRAWINGS.html` **tab 7** "C7 / K7 · The Overview line" (~lines 1112-1150, club frame
   ~1117-1120) and "C7 · The fiscal-year close window" (~1158-1172, the Still open row ~1165-1170); **tab 9** the report
   (`#p9` ~1340-1401, paper frames ~1347 and ~1370, 8.5×11 in at 96 dpi). `BANK_BALANCE_CHECK_DRAWINGS.html`
   (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN) tab 5's side frame (~635-642: the line, Matches and "Off by $12.40")
   and Ask 9 (~732-734). Settled words win over the drawings' drafts (the R0 drawings predate the balance check: no
   "ticked", no "Against the team's Ledger").
3. Memory rules that apply: draw from the SHIPPED component, every highlight is clickable (the Overview chip opens the
   check), amber never red, a direction in words never a minus sign on a desk, the clock only through `formatTime`, a date
   only through `formatStoredDate`, money figures are ONE joined band, a record's rare door is `RecordAction` (never a foot
   row of its own).
4. Guards: `tests/unit/bank-r2c-screens-guard.test.ts`, `tests/unit/bank-r2-server-guard.test.ts`, and whatever pins the
   Overview and the close question (grep `tests/unit` for `standsHeading`, `CloseYearQuestion`, `closeQuestion`).

---

## BC5a — the Overview line and the fiscal-year close row (session 1)

### Ask the owner first (one AskUserQuestion, before the UX summary)

1. **More than one account on the Overview line.** The drawing draws one account. **Recommend:** one line per account,
   each its own door, in the account order the Bank tab uses ("Bank: Club chequing checked through Oct 31, 2026 ›",
   "Bank: Gaming account · not checked yet ›"); the other option is one line for the account that needs attention most
   (off, or the oldest check) with "+1 more".
2. **The Overview on a closed fiscal year** (the Year pill). **Recommend:** the line reads as of the year's last day
   ("checked through {the latest check on or before the year end}"), no chip change, still a door to the Bank tab; the
   other option is to hide it on a past year.
3. **When the fiscal-year close shows the bank row.** The drawing: "{account} last checked {date} · {Matches | Off by $X}"
   and "not checked in the last month of {year}" when the latest check is before the year's last month. **Recommend:** show
   a row only when something is open (no check in the year's last month, or the latest check is off), as every other
   Still open row only lists what is open; one row per such account; warn, never block; its link opens the Bank tab on
   that account. The other option: always show the bank row, Matches included, as a reassurance.

Record the answers in plan §0 as ruled (add nothing they did not rule).

### Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: a plain-language summary for a product manager first (what the treasurer sees and does differently,
the benefits, the role differences: a club admin who can only read sees the line and its door; the close question is a
writer's). Present it with the owner's answers folded in; wait for yes.

### The build

1. **Server:** the overview read carries each account's latest live check (date, result, off-by) and, for a past fiscal
   year, the latest on or before its end. Pure rule (latest check as of a date) in `lib/bank-club-rules.ts` with unit
   tests, the read in `lib/bank-club-read.ts`/`bank-club-steps.ts`; no arithmetic on a screen. Fix the route comment.
2. **The Overview line** (ask 4, R0 tab 7): right of "Where the club stands", no new row (drawn); "Bank: {account} checked
   through {date} ›" or "Bank: not checked yet ›", the amber "Off by $X" chip a door to the latest check (the Bank tab
   opened on it), the line a door to the Bank tab. Hidden when the club has no bank account and can't make one? Decide
   from the Bank tab's own `never` read, and say so in the UX summary. Phone: the heading row wraps; 44px doors.
3. **The fiscal-year close row** (R0 tab 7): a fifth `OpenRow` kind from `closeQuestion()`, carried into the stored
   snapshot if the other kinds are (read `closeSnapshot` first). Words from `lib/bank-tab-words.ts` (or the fiscal words
   module, whichever the other rows use; one home).
4. **No migration expected.** If one is needed: `/dba` first, the schema = dictionary rule, its prod apply parked with
   447/449/450.
5. **Checks:** the bank tests and the Overview/close guards, `npm run typecheck`, focused lint, `check:spelling`,
   `check:tokens`, `check:layout -- --only=admin-accounting-overview,admin-accounting-bank` (ask `--list` for the exact ids).
6. **Prove on dev** as the uat-rep-club treasurer: a probe (`.probe/bank-bc5/bc5a.mjs`) that saves a matching check, then an
   off one, and reads the Overview line, its chip's door, a past fiscal year through the Year pill, and the close
   question's row (open the close question without closing the year); clean up every check it saved. 1440 and 390.
7. **Then** `/design` on the line and the row against the drawings, `/review` (standard), records (plan §9 BC5), the
   "BC5a done" line here, commit on the owner's yes, recommend `/clear`.

---

## BC5b — the printable report, help, and the club half's words (session 2)

### Ask the owner first (one AskUserQuestion, before the UX summary)

1. **The report's door.** Undrawn on the balance check. **Recommend:** a quiet "Print this check" in the opened check's
   window (`RecordAction`, ending the body beside Delete's place, every saved check including a matching one; never the
   starting statement), opening the printable page (a print route, as the tournament summary does); not on a phone (R0:
   "no phone version"), so hidden below 640px.
2. **The report on a check whose books changed since** ("Books now say $X"). **Recommend:** print the saved figures, as
   saved, plus the "Books now say $X" line with its reason, so the paper never disagrees with the screen.

Record the answers in plan §0 as ruled.

### The build

1. **The report** (R0 tab 9, re-worded by ask 9; plan §6): one US Letter page from a saved check, the shipped
   `PrintedPage` frame. Eyebrow "{club} · Bank check"; "{account} · statement ending {date}"; "Books in this account: …";
   the formula top to bottom (Bank balance on the statement · + Not in the bank yet, a Date | What | Book | Amount table ·
   − Online payments on their way, or "not counted" · = Should be in the bank · Your books on {date}, "Starting point
   {date} {balance} + book movement since"); Result Matches / Off by $X; "Checked by {name} ({role}), {date} at {time}"
   (`formatTime`); "Books now say $X" when it applies; signature lines "Prepared by · date" and "Reviewed by · date";
   footer "Printed {date} from FieldLogicHQ · {club} · Accounting → Bank". No account number, no full line listing, no
   Budget vs. Actual. No cash row on the club report (the club has no cash field). Every figure from the engine's saved
   terms (`savedTerms`), no arithmetic on the page.
2. **Help** (`/docs`): a Bank article in `lib/help-content/accounting.tsx` (start a statement, check one, Find, Not in the
   bank yet, Still waiting?, Waiting at the start, the phone, the Overview line, the close row, the report); its
   `keywords`/`searchText` carry "reconcile / reconciliation" (plan §5's collision note with the coach's "reconcile the
   estimate"). The one-spelling rule covers keywords too.
3. **`/marketing` once** on the club half's unticked §5 words: "Bank" (the tab), the Overview mark, the close row, the
   report's words, "Print this check", the help article's title and search words. ⚠ "Bank reconciliation" stays off Club
   marketing until BC9's walk (BUSINESS_DECISIONS 2026-10-19): this pass settles product words, not marketing copy.
4. **Checks** as BC5a, plus the print page at 1440 (a probe that opens it and checks it is one page: `page.pdf` or the
   printed height under 11in).
5. **Finishing passes:** `/design` on the report against R0 tab 9, `/simplify` if a new shared piece appeared, `/review`
   (standard). Records: plan §9 BC5 and §5 ticks, the TODO line (HEAD + your exact edit), the auto-memory note
   `project_bank_reconciliation.md` and its MEMORY.md line, the PM brief. Mark this prompt done. Commit on the owner's yes,
   then hand off in product-owner voice with a short "how to look at it" list, and say what's next (BC6, the coach's
   source and routes; BC8's Teams column question for the owner).

## Out of BC5

The coach side (BC6+), the Teams column (BC8), the prod apply of 447/449/450, any change to hooks, checks or baselines,
a kit component change the owner hasn't agreed to.
