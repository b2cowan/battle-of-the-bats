# Bank balance check BC1: the engine, the migration and the club's server (build prompt, no new screens)

> **Written 2026-11-05**, with the plan rewrite. **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC1_BUILD_PROMPT.md` into a new chat on `dev`.** Other sessions share
> this working copy: stage explicit paths only, commit only your own hunks, and only when the owner says.
>
> **This stage takes the tick-off apart and puts the balance check's foundations in.** Nothing new reaches a customer.
> The dev Bank tab ends this stage showing only the account pill, Name and books and the saved-checks list. BC2 builds
> the check screen. Say that in the hand-off.
>
> **Owner asks Q1–Q3 were ruled 2026-11-05, all A** (plan §0). What BC1 builds for them: `bank_checks.book_ids`, with the
> "Books now say" re-figure reading each check's own books (Q3); waiting items on any check, the start included, with
> `at_start` (Q2). Q1 (last season's lines in the coach's Find) is BC6's and needs nothing from this migration.

> **⏩ RESUME (2026-11-05, second session): work steps 1–10 are DONE** (plan §9 BC1 records each: mig 447 on dev,
> dictionary + snapshots, engine, reader, routes, deletions, guards, the dev probe `.probe/bank-bc1/routes.mjs`
> `BANK_BC1_ROUTES_PASSED`; `/simplify` done; `/review` (high) done 2026-11-06: no Critical or High, open Medium/Low in plan §9 BC1). **Left:** commit 447 +
> `MANUAL_PROD_STEPS.json` + the code together on the owner's yes. Read plan §9 BC1's "BC1 build calls made 2026-11-05" first.

## Read first

1. `docs/projects/active/BANK_RECONCILIATION_PLAN.md`: §0 (rulings, as ruled), §1 (P1–P5, the three disagreements), §2,
   **§4 (the arithmetic, the hints, Stripe on its way, cash)**, §7 (the reuse map), §9 BC1, the Architectural decisions
   and Open questions O1, O2 and O6. **Never build from Appendix A's tick sections.** Read Appendix A §7 R1–R2 only for
   the records of what exists and why (lock order, the deadlock fixes, the refusal shape).
2. `docs/agents/db/DATA_DICTIONARY.md`, the bank section (about lines 8968–9245) and its gotchas. Decide what exists from
   the schema snapshots or live `information_schema`, never from migration files.
3. Migrations `436`, `437`, `439`, `440`, `442` (what you are reshaping), and `317:557` (`club_book_totals`, the sum the
   club figure stands on).
4. `supabase/migrations/MANUAL_PROD_STEPS.json` entries for 436–442 and its `_readme` (statuses: `applied`, `pending`,
   `held`).
5. `lib/bank-check.ts`, `lib/bank-club-map.ts`, `lib/bank-club-read.ts`, `lib/bank-club-rules.ts`,
   `lib/bank-club-steps.ts`, `lib/bank-check-fee.ts`, `lib/online-payouts.ts:250` (`readPayouts`, `withEntries`), and the
   guard `tests/unit/bank-r2-server-guard.test.ts` (it pins the function list, the route list and the live definitions).

## What BC1 must hold up

- **Ruling 3:** a check saves whether it matches or not. No $0.00 gate anywhere.
- **Ask 1:** the cash figure is a number on the check. **No bank code writes `accounting_entries` or any rep money
  table.** Add a guard test that pins it.
- **Ask 2:** "Not in the bank yet" items belong to one check. The next check reads the latest earlier check's items to
  ask "Still waiting?" (the asking is BC3's; BC1 only makes them readable).
- **Ask 3:** suspects = lines since the latest check that **matched when saved** (since the start if none).
- **Ask 5:** any check can be deleted; who and when are kept (soft delete). The starting statement can't be deleted
  while later checks exist.
- **Ask 6:** saved figures never change; "Books now say $X" is derived on read.
- **Ask 7:** a club account's first check is a starting statement (kind `start`, date + balance). No outstanding picker.
- **Ask 8:** "on its way" as defined in plan §4, with *not counted* when Stripe doesn't answer or a payout lists no lines.
- **B1/B7/B11:** unchanged: a bank account (name only), club books mapped, unmapped books in the first account, a team's
  one account; whoever can move club money writes (club read = write today); no new key.

## Work, in order

1. **Read-only prod count.** Count the rows in every bank table on prod (read-only; `reference_prod_supabase` memory has
   the safe way in). The expected answer is 0 everywhere. If not, stop and tell the owner before writing the migration.
2. **Draft the forward migration** `<next free number>_the_bank_check_is_a_balance.sql`. It must reach **the same end
   shape on dev (436/437/439/440/442 applied) and prod (436/437/439 only)**:
   - `DROP FUNCTION IF EXISTS` by signature for every function §7 deletes (440's and 442's included, `IF EXISTS` covers
     prod).
   - Drop `bank_check_marks`, `bank_check_added_lines`, `bank_check_changes`, `bank_line_exclusions`,
     `bank_saved_lines`, `bank_check_events`.
   - `bank_checks`: drop `status`, `checked_by`, `checked_at`, `outstanding_snapshot`, `bank_checks_checked_has_when`,
     `bank_checks_id_account`; add `kind` (start|check), `books_cents`, `on_its_way_cents` (nullable = not counted),
     `cash_not_deposited_cents` (nullable), `book_ids uuid[]` (club; null for a team), `deleted_by`, `deleted_at`;
     replace the one-per-date unique with a partial unique on live rows; at most one live `start` per account.
   - New `bank_check_waiting` (check id, line key text, line date, label, amount cents, direction in|out, `at_start`
     boolean for Q2), service-role only.
   - `bank_accounts`: drop `opening_date`, `opening_balance_cents`, `set_up_by`, `set_up_at` and `bank_accounts_opening_pair`
     (the start is a check now). Keep everything else, and keep 437's team move untouched.
   - Re-create `bank_book_move` and `bank_account_add` without exclusion / opening-pick / tick work, **keeping R2b-3's lock
     order** (Add an account's own advisory lock → accounts in id order → book; never book before account).
   - New: `bank_check_save` (one step: soft-delete a live check of the same date, insert the check and its waiting items;
     refuses a date after the club's today, and a `check` dated on or before the live start), `bank_check_delete`,
     `bank_books_through(p_ledgers uuid[], p_dates date[])` (posted in − posted out per date, one pass, the same
     status/type rule as `club_book_totals`).
   - Keep `bank_first_club_account`, `bank_club_account_of_book`, `bank_account_books` + its guard.
   - Service-role grants only (`migration-table-grants-guard.test.ts`); RLS on, no policies (dictionary rule 7).
   - **Run `/dba` on the draft before applying it to dev.** Apply it to dev, then a rolled-back SQL probe of every
     function.
3. **`MANUAL_PROD_STEPS.json`:** the new migration `pending` (function changes are invisible to `check:migrations`); 440
   and 442 → `held`, note "superseded by <new>, which reaches the same end shape; never apply". **Same commit**, so the
   promote block never lapses. (This is a data file the check reads, not the check itself: do not touch
   `scripts/check-manual-prod-migrations.mjs`.)
4. **Dictionary + snapshots:** rewrite the bank section of `DATA_DICTIONARY.md` (tables, columns, functions, gotchas,
   including the sign rules from plan §4); `npm run refresh:snapshots` (dev+prod), committing only the bank lines (other
   sessions' tables ride the snapshot); `npm run check:dictionary`.
5. **Engine `lib/bank-check.ts`** (pure, no IO), rewritten per §4: `figureCheck` (bank, books, on its way, waiting items,
   cash → should be, difference, result, direction), `findHints` (exact, half with cents parity, pairs/triples by sort +
   two pointers, **cap 400 most recent, ≤3 combinations, nearest-dated first**), `suspectsSince` (the latest check
   matched when saved), `booksNowSay`, the coach date cutoff over register rows (pure; BC6 wires it). Tests: both
   drawing examples figure exactly as drawn (Lakeshore Lynx Oct 31: books $8,255.53 − $412.00 = $7,843.53, Matches;
   bank $7,918.53 → Off by $75.00, Cheque #214 exact; Ridge 13U: $3,240.00 − $180.00 = $3,060.00, Matches); the
   asks page's Q2 example (start $5,000.00 with a $75.00 cheque at the start → $4,925.00); the cap; the parity; a
   transfer between two books in one account netting to zero.
6. **Club reader** (`lib/bank-club-read.ts`, `bank-club-map.ts`): accounts + books (carry), the figure for a date D
   (`bank_books_through` over the account's books; the start's own balance and waiting items), on its way (§4: 30-day
   look-back, payouts arrived ≤ D, processing lines included, *not counted* when Stripe is down or a payout lists no
   lines), suspects for D (with each line's book name), saved checks with "Books now say" (re-figured over each check's
   own `book_ids`; O1).
7. **Routes** under `app/api/admin/accounting/bank/**`, per §7: carry `GET/POST /`, `PATCH accounts/[id]`,
   `POST accounts/[id]/books`; rewrite `GET accounts/[id]` (account + saved checks; `?date=` adds the figure, on its way,
   suspects and hints input), `PUT accounts/[id]/setup` → the starting statement, `POST accounts/[id]/checks` → save;
   add `DELETE checks/[id]`; delete `checks/[id]` PATCH, `ticks`, `kept-out`, `mark`, `undo`, `lines`, `lines-before`.
   Same gate (`resolveClubMoney`, scope `books`). Refusals stay codes + words (`bank-check-words.ts`, trimmed).
8. **Delete the dead pieces** per §7: `lib/bank-check-fee.ts`; the tick halves of `bank-club-rules.ts` /
   `bank-club-steps.ts` / `bank-club-map.ts`; `BankCheck.tsx`, `FeeWindow`, `UndoWindow`, the pinned strip and dock,
   `isStuck`; the dead words in `bank-tab-words.ts`. `BankTab` keeps the account pill, Name and books and the saved-checks
   list (reshaped to read the new rows; BC2 finishes it). `BankSetup` keeps its name/books fields; its picker goes.
9. **Guards:** rewrite `bank-r2-server-guard.test.ts` §0–§6 for the new function and route lists and live definitions;
   add the "no bank code writes money" pin; trim `bank-r2c-screens-guard.test.ts` to §1, §4 and the generic §3;
   `team-move-coverage.test.ts` must still pass (437 unchanged).
10. **Prove on dev** as the uat-rep-club treasurer (passwords in `.env.local`): add an account, start from a statement, save a
    matching check, save an off check, mark a waiting item, delete a check, edit a book line and see "Books now say",
    move a book and see earlier checks unchanged (`book_ids`). Remove every row afterwards. Probe under `.probe/bank-bc1/`.
    New route files need the dev server's child restarted (Appendix A §7 R2c's walk gotcha).
11. `npm run verify:changed`, `npm run typecheck` (shared modules and routes changed), the bank tests. Then `/simplify` and
    `/review` (high). Record what was built under plan §9 BC1 (positive facts with anchors), the TODO line and the
    auto-memory note. Commit on the owner's yes.

## Out of BC1

The check screen, Find, the phone, the report, the Overview line (BC2–BC5); anything on the coach side (BC6+); any
wording pass (`/marketing` runs once per stage before the walk, on the words BC2+ write).
