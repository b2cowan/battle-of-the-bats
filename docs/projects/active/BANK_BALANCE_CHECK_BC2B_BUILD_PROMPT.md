# Bank balance check BC2b: the saved checks, the opened check, Delete, the account pill (build prompt)

> **Written 2026-11-06**, after BC2a was committed. **Paste `execute @docs/projects/active/BANK_BALANCE_CHECK_BC2B_BUILD_PROMPT.md`
> into a new chat on `dev`.** Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and
> only when the owner says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`: a private index built on
> the current HEAD, `BASE` recorded at `read-tree`, a HEAD guard immediately before the commit, a compare-and-swap `update-ref`;
> files other sessions also edit, such as `TODO.md`, are built as HEAD + your exact edit).
>
> This is the **second half of BC2**. The first half is done: read `BANK_BALANCE_CHECK_BC2_BUILD_PROMPT.md` for the stage's
> rules and "What BC2 must hold up", and the plan's §9 BC2 for what BC2a built, with its anchors. **Not in BC2b:** Find (hints,
> suspects, "Not in the bank yet", "Still waiting?", "Add the missing line") is BC3; the phone is BC4; the Overview line, Teams
> column and fiscal-year touchpoints are BC5; the printable report is later; the coach side is BC6+. Say what is missing in the
> hand-off: after BC2b an off check can be saved, read, opened, replaced and deleted, but not yet worked down from the screen.

## What is already there (BC2a, committed; do not rebuild)

- The check form on the Bank tab: `components/admin/kit/club/money/bank/BankCheckForm.tsx` (date, balance, Save; the figure for the
  day from `GET accounts/[id]?date=&asked=check`, debounced; the band from the engine's `figureCheck`).
- The band and the sums as pure drawing: `BankFigure.tsx` (`BankBand`, `BankSums`). **They take explicit props, so the opened
  check window reuses them** with the saved figures.
- The Start card with the Stripe notice (`BankSetup.tsx`), the shared amount field (`BankMoneyField.tsx`), `staleRefresh` in
  `BankTab.tsx` (a stale refusal re-reads the overview and the account, then says the sentence: **Delete must use it**),
  `isStaleView` / `readFigure` / `bankWrite` in `BankShared.ts`, the words in `lib/bank-tab-words.ts`, the engine's `typedCents`.
- Server: `DELETE accounts/[id]/checks/[checkId]` already exists and is guarded (`bank_check_delete`: soft, who and when kept;
  `start_has_checks` when later checks stand on the start). `GET accounts/[id]` already returns every saved check with its band
  (`figure`), `waiting`, `booksNowSayCents`, `checkedBy` / `checkedAt`, and `checkedThrough` per account for the pill.
- The saved-checks list is the BC1 read-only list in `BankStatements.tsx` (no links, no chevron).

## Ask the owner first (one line, blocks nothing but one field)

The club desk drawing has **no "Cash not deposited yet" field**; the coach phone drawing does, and the server already takes
`cashCents` on a club check. Build to the drawing (no field), say so in one line, and ask whether he wants it on the club desk.
If he says yes it is one field in `BankCheckForm`, saved with the check and shown in the opened check's sums.

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (rulings, as ruled), §5 (words), **§6 tab 5 (saved checks), tab 6 (Account pill) and R0 tab 8**,
   §9 BC1 (the `/review` line with its open items) and §9 BC2 (what BC2a built).
2. The approved drawings: `BANK_BALANCE_CHECK_DRAWINGS.html` (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN), tabs 5 and 6. **Build
   to the drawings; where plan §6 and a drawing disagree, say so to the owner before choosing.** Memory rules that apply: draw
   controls from the SHIPPED component, money figures are ONE joined band (also inside a window), every highlight is clickable,
   amber never red for "Off by", direction in words never a minus sign, the clock is `formatTime()`, dates only through
   `formatStoredDate`.
3. The client you are finishing (`components/admin/kit/club/money/bank/`) and the shipped form window `KitDialog` (an opened
   record elsewhere in the club kit, such as `BillWindows.tsx`, is the pattern for eyebrow, band, footer).

## Before any code: the UX summary (blocking)

`AGENCY_RULES.md` requires a plain-language summary for a product manager first: what the treasurer sees and does differently,
the benefits, the role differences. Present it, wait for the owner's yes, then build. (Reader note: club read = write today, so a
reader cannot reach the tab; build the reader branch anyway, behind `canMove`.)

## Work, in order

1. **The saved checks** (`BankStatements.tsx`): Statement date (a link) · The bank said · Should have been · Result · Checked by · ›.
   The starting statement stays greyed, "Starting point", no chevron. Result = "Matches", "Matches · n lines not in the bank yet",
   the amber "Off by $X" chip, and the amber "Books now say $X" chip (ask 6). **A start saved with Stripe not counted says so in its
   row** (the start's `onItsWayCents` is NULL: a quiet "card payments on their way weren't counted" under or beside "Starting
   point", so a later "Off by" has a reason on screen). The date link and the chevron open the check.
2. **The opened check** (a form window, 520, `KitDialog`): eyebrow "{account} · saved check", title "Statement ending {date}", the
   three joined tiles from the SAVED figures (the engine's figure of the saved check, already on each row), the saved sums
   (reuse `BankSums`: Your books as saved, on its way as saved or *not counted*, the check's Not-in-the-bank-yet items if any,
   Should have been), "Checked by {name} on {date} at {time}" (`formatTime`), the "Books now say $X" line when it applies; footer
   red ghost **Delete this check** · **Close** · **Check this statement again**.
3. **Delete** (ask 5): one question first ("Delete the check for {date}? Its figures go; who deleted it and when is kept."),
   writer only (`canMove`), the answer is the account read again, a stale refusal goes through `staleRefresh`. The starting
   statement's door says why it cannot go while later checks stand (`start_has_checks`, the server's sentence), and the screen may
   show that sentence before the tap rather than after.
4. **Check this statement again:** closes the window and opens the form with the date filled; saving replaces the old check (the
   server already replaces a live same-date check; the form already says "Saving replaces that check"). `BankCheckForm` needs a
   way to be handed a date from outside (a prop plus a key, or lifted state) and to scroll or focus the balance field.
5. **"Books now say"** is a chip on the saved row (done in BC1's list; make sure the opened check says it too). No warning on any
   money form (ask 6).
6. **The account pill:** options already carry "{date} · Matches|Off by $X" (`throughWords`); confirm "Checked through {date}" and
   the amber chip when off (ask 4) read as drawn on the top line, and that a second account starts at its own first-check card.
   **"Add an account" / "Name and books"** as built, with the Q3 sentence in the move window (already in `movesKeepEarlier`:
   check it reads as one sentence in the window and in the drawing).
7. **Guards:** extend `bank-r2c-screens-guard.test.ts` (Delete behind `canMove` and through `bankWrite`/`staleRefresh`, no tick
   vocabulary, the joined band inside the window too, the words module only, no screen arithmetic, the list's links are buttons or
   links with an accessible name); `npm run check:layout -- --only=admin-accounting-bank` (the flag takes `=`; if it says the session
   is not signed in, run `npx playwright test --config playwright.config.ts --project=auth-setup` first); `npm run typecheck`;
   focused lint; `npm run check:spelling`; the bank tests. `npm run verify:changed` runs the whole suite and currently fails in
   OTHER sessions' areas: report which failures, if any, are bank's.
8. **Prove on dev** as the uat-rep-club treasurer (passwords in `.env.local`; the dev server stays up, new files hot-reload).
   `.probe/bank-bc2/routes.mjs` and `.probe/bank-bc2/ui.mjs` are the pattern (a real browser at 390 so the date field is native;
   shell quoting eats backslashes and template literals, so write scripts with the Write/Edit tools, never a heredoc with `${}`).
   Walk: save a matching check, save an off check, open it, check the date again (replaced), delete one (soft, who and when kept),
   try to delete the start with a later check standing (the sentence), a Stripe-down start's row says so. Probe under
   `.probe/bank-bc2/`; remove every row afterwards and put Stripe's account id back if you forced it down.
9. **`/design` on the whole Bank screen** (form + list + window; memory: screens go through `/design` before hand-off), then
   **`/marketing` once on the words BC2 wrote** (the plan §5 checklist lists each; BC2a's are in `lib/bank-tab-words.ts`), then
   **`/simplify`** (new abstractions are likely: the form, the figure, the window), then **`/review` (high)**, starting from the BC1
   review's open list in plan §9 BC1 (M1 closed by BC2a's Start notice; M2 and M3 are BC3's) and BC2a's own diff. Record what was
   built under plan §9 BC2 (positive facts with anchors), the TODO line and the auto-memory note; update the PM brief if the plan
   changed. **A walk page for the owner (checkable, paste-back) is BC9's job; BC2b hands off with a short "how to look at it" list.**
   Commit on the owner's yes.

## Out of BC2b

Find and everything under it (BC3), the phone (BC4), the touchpoints (BC5), anything coach-side (BC6+), the report, the prod apply
of migration 447 (owed at a quiet moment; the owner has ruled nothing reaches customers before this project is complete), any
change to hooks, checks or baselines.
