# Bank balance check BC2b, finishing: /marketing, /simplify, /review, records, commit (prompt)

> ✅ **DONE 2026-11-06.** Owner kept both /design departures (no Close; 640 wide); /marketing, /simplify, /review (high) applied; records written; the commit and its hash are in plan §9 BC2 and the TODO line.

> **Written 2026-11-06**, after BC2b was built, walked on dev and passed `/design`. **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC2B_FINISH_PROMPT.md` into a new chat on `dev`.** Other sessions share
> this working copy: stage explicit paths only, commit only your own hunks, and only when the owner says (the recipe is the
> auto-memory note `reference_partial_commit_shared_tree`: a private index built on the current HEAD, `BASE` recorded at
> `read-tree`, a HEAD guard immediately before the commit, a compare-and-swap `update-ref`; files other sessions also edit,
> such as `TODO.md`, are built as HEAD + your exact edit).
>
> The build prompt this finishes: `BANK_BALANCE_CHECK_BC2B_BUILD_PROMPT.md` (its steps 1–8 and the `/design` half of step 9
> are done). Do not rebuild anything below; start at "What is left".

## What BC2b built (uncommitted on dev; read the files, not this summary, before acting on any claim)

**Files (BC2b's and nothing else):** `components/admin/kit/club/money/bank/BankCheckWindow.tsx` (new), `BankStatements.tsx`,
`BankFigure.tsx`, `BankTab.tsx`, `BankCheckForm.tsx`, `BankShared.ts`, `Bank.module.css`, `lib/bank-tab-words.ts`,
`tests/unit/bank-r2c-screens-guard.test.ts`. Probes (git-ignored): `.probe/bank-bc2b/ui.mjs` (the walk) and `shots.mjs`
(screenshots). Check `git diff` on these paths for hunks from another session before staging; there should be none.

- **The saved checks** (`BankStatements.tsx`): every row opens its check (the kit's table door: `rowOpens`, the date a
  `nameButton`/`nameLink` named "Open the check for {date}", the `go` chevron); phone rows are `ClubRow as="button"`. The
  starting statement opens too and, when its `onItsWayCents` is NULL, says "card payments on their way weren't counted".
  Result: Matches · "Matches · n lines not in the bank yet" · amber "Off by $X" · amber "Books now say $X". Top line:
  "Checked through {date}" plus the amber chip when off, the chip a button that opens the latest check.
- **The opened check** (`BankCheckWindow.tsx`): eyebrow "{account} · saved check", title "Statement ending {date}", medium
  window (640) with the shipped band in past tense (`BankBand saved`), the saved sums (`BankSavedSums` + `savedSumRows`),
  "Books now say $X." with why, "Checked by {name} on {date} at {clock}" (`formatTime`). Delete is RepKit's `RecordDelete`
  ending the body, one `kind="question"` first, through `bankWrite('DELETE')`, a stale refusal to `staleRefresh`. Foot:
  "Check this statement again" only (a writer's). The start's window (520, no band, no foot): its balance, on its way,
  "Your books start from this balance", and while later checks stand, the server's `start_has_checks` sentence in place
  of its Delete.
- **Check this statement again:** `BankTab` keeps `again {date, n}` and re-keys `BankCheckForm` (`againDate`), which
  starts on that date and focuses the balance.

**Owner rulings this session (2026-11-06, all as recommended):** no cash field on the club desk (build to the drawing);
the starting statement opens and can be deleted while no later check stands; "line", not "cheque"; "Checked by" carries
the clock; yes to the UX summary.

**`/design` (2026-11-06) applied:** the delete door → `RecordDelete` at the body's end (decision 2026-10-09); no Close
button in a record window (the no-Close rule, 2026-10-09); medium width because the shipped band wrapped "Off by $12.40"
at 520 (every club window with the band is medium); the top-line chip made clickable; phone sums keep amounts right.
**Two departures from the approved drawing are waiting on the owner's eye** (no Close; 640 not 520). If he says keep the
drawing, change them back before the commit. Nothing new was logged in `memory/design_decisions.md` (these applied
standing rulings).

**Proved on dev:** 225 tests (bank tests + `admin-record-delete-guard`); tsc, eslint (bank folder, words, guard), spelling
clean; `check:layout --only=admin-accounting-bank` clean at 361/390/768/1440; `.probe/bank-bc2b/ui.mjs` →
`BANK_BC2B_UI_PASSED` (32 checks: save a matching and an off check, the top line and chip, open the off check, Check this
statement again replaces it (old row soft-deleted), the start's window with the sentence and no Delete, Delete with its
question (soft: `deleted_by`/`deleted_at` kept), a Stripe-down start's row and window, its start deleted back to the
Start card, the desk table's door). Every probe row removed; Stripe's account id restored. Dev's walk account
"Walk chequing" is back to its Sep 30 start only.

## What is left, in order

1. **Ask the owner one line first** if he hasn't answered: keep the two `/design` departures (no Close; 640 wide)?
2. **`/marketing` once on the words BC2 wrote:** BC2a's and BC2b's strings in `lib/bank-tab-words.ts` (BC2b's are the
   blocks "a saved check, opened", the top line's `checkedThroughLead`/`notCheckedLead`, `startNotCounted`, `openCheck`),
   checked against plan §5's list (tick the §5 lines it settles; add the *new* ones BC2b wrote: "Starting statement ·
   {date}", "Your books start from this balance", "Started by …", the start's delete question and its result sentence,
   "Books now say $X. A line dated on or before {date} changed…", "card payments on their way weren't counted"). Apply
   what it changes in the words module only; re-run the bank tests (several pin exact sentences) and `check:spelling`.
3. **`/simplify`** on the BC2a + BC2b diff of the bank folder (new abstractions: the form, `BankFigure`'s live and saved
   sums side by side, the window, the row door). Likely angles: `BankSums` vs `BankSavedSums` sharing a row; whether
   `throughWords` is still needed beside the new top line; `savedSumRows`' sign rules (check them against
   `figureCheck`/`startBooks` in `lib/bank-check.ts`: no arithmetic on the screen).
4. **`/review` (high)**, starting from the BC1 review's open list in plan §9 BC1 (M1 closed by BC2a; M2 and M3 are BC3's)
   plus BC2a's committed diff (`35fea92f0`) and BC2b's uncommitted one. Worth a hard look: the window holding a check that
   a stale re-read removed (`opened` resolves to null and the window closes); delete of the start then the Start card for
   the FIRST account (`overview.never` stays false); the form's re-key losing typed input; the chip door at 768 (tap floor).
   If code changes, re-run the gate and `node --env-file=.env.local .probe/bank-bc2b/ui.mjs`.
5. **Records (anti-drift wording: positive facts with anchors):** plan `BANK_RECONCILIATION_PLAN.md` §9 BC2: tick the three
   open BC2 lines with what was built, the rulings, `/design`, `/marketing`, `/simplify`, `/review`, the proofs; the TODO.md
   line (HEAD + your exact edit); the auto-memory note `project_bank_reconciliation.md` and its MEMORY.md line; the PM
   brief only if the plan changed in substance (the start now opens and deletes: say so if the brief lists the saved
   checks). Mark the BC2b build prompt done (a dated line at its top), and this prompt.
6. **Commit on the owner's yes**, one commit for BC2b (+ any /simplify or /review changes), message saying what the
   treasurer can now do; then `git show --stat HEAD` and confirm only these files. A second small commit for the records
   if the hash needs writing back.
7. **Hand-off to the owner** (product-owner voice): what changed, then a short "how to look at it" list (Accounting → Bank as
   the uat-rep-club treasurer: save an off check, open it, Check this statement again, delete it, open the starting
   statement). Say what is still missing: an off check can be saved, read, opened, replaced and deleted, but not yet
   worked down from the screen ("Find" is BC3). Offer `/docs` once (the Bank tab's help is a user-facing flow); a
   walk page is BC9's job. Next is BC3's build prompt.

## Out of this session

Find and everything under it (BC3), the phone stage (BC4), the touchpoints (BC5), anything coach-side (BC6+), the report,
the prod apply of migration 447, any change to hooks, checks or baselines.
