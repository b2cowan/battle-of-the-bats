# Bank balance check BC2: the club's Bank tab on a desk (build prompt, tabs 2, 5, 6 and R0 tab 8)

> **Written 2026-11-06**, after BC1 was committed (`12aa20e96`). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC2_BUILD_PROMPT.md` into a new chat on `dev`.** Other sessions share
> this working copy: stage explicit paths only, commit only your own hunks, and only when the owner says (the partial-commit
> recipe is in the auto-memory note `reference_partial_commit_shared_tree`: a private index built on the current HEAD, then a
> compare-and-swap `update-ref`; BC1's script is the pattern).
>
> **This stage is the first one a customer can see.** BC1 gave the Bank tab a server and an engine; the tab itself still shows
> only the account pill, Name and books and a read-only saved-checks list. BC2 gives the treasurer the whole desk screen:
> type a statement date and balance, watch "The bank says · Should be in the bank · Difference" figure as you type, save the
> check whether it matches or not, read the saved checks, open one, delete one, check a date again. **Not in BC2:** Find
> (hints, suspects, "Not in the bank yet", "Still waiting?", "Add the missing line") is BC3; the phone is BC4; the Overview
> line, Teams column and fiscal-year touchpoints are BC5; the printable report is later; the coach side is BC6+. Say what is
> missing in the hand-off: after BC2 an off check can be saved but cannot yet be worked down from the screen.

> **Chunking (the owner's rule: one session per heavy chunk).** Run **BC2a** first, then stop and say so; start **BC2b** in a
> fresh chat if the context is deep.
> - **BC2a:** the owner question below, the BC1 loose ends (step 1), words, the check form with the live band and sums, the
>   Stripe line and its Show, "Start checking" and Save.
> - **BC2b:** the saved-checks table, the opened check window, Delete, "Check this statement again", "Books now say", the
>   account pill result, Add an account / Name and books with the Q3 sentence, the layout guard, the probe, `/simplify`,
>   `/review`.

## Ask the owner first (one question, blocks the "Start here" screen only)

**A starting statement saved while Stripe does not answer books the card payments still on their way as $0**, and every later
check then reads "Off by" that amount for good (found by BC1's `/review`, plan §9 BC1 open item M1). Recommendation: **warn,
never block** (the house rule for unsettled money): when the start's "on its way" is *not counted*, the Start screen shows a
quiet notice ("Stripe didn't answer, so card payments on their way aren't counted yet") with **Try again** and **Start
anyway**; the saved start keeps the NULL so the check list can say so. Ask it in one line with that recommendation and build
what he rules. Everything else in BC2 does not wait on it.

## Read first

1. `docs/projects/active/BANK_RECONCILIATION_PLAN.md`: §0 (rulings, as ruled, including Q1–Q3), **§4 (the arithmetic, Stripe
   on its way, cash)**, **§5 (the words)**, **§6 (build notes: tabs 2, 5, 6 and R0 tab 8)**, §7 (reuse map), **§9 BC1 (what the
   server does, "BC1 build calls made 2026-11-05" and the `/review (high)` line with its open items)**, §9 BC2. **Never build
   from Appendix A's tick sections.**
2. The approved drawings: `docs/projects/active/BANK_BALANCE_CHECK_DRAWINGS.html` (published at
   https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN) and `bank-balance-check-shots/`. **Build to the drawings; where the plan's
   §6 and a drawing disagree, say so to the owner before choosing.** Memory rules that apply: draw controls from the SHIPPED
   component (the view switch is one white track), money figures are ONE joined band (tiles connected), every highlight is
   clickable, amber never red for "Off by", direction in words never a minus sign, the clock is `formatTime()`, dates only
   through `formatStoredDate`.
3. The client you are finishing: `components/admin/kit/club/money/bank/` (`BankTab`, `BankStatements`, `BankSetup`,
   `BankWindows`, `BankShared`, `Bank.module.css`) and the shipped band / money components the Overview and Budget vs. Actual
   already use. The server you consume (read, do not change except step 1): `app/api/admin/accounting/bank/**`,
   `lib/bank-club-read.ts`, `lib/bank-club-rules.ts`, `lib/bank-club-steps.ts`, `lib/bank-check.ts`, `lib/bank-tab-words.ts`,
   `lib/bank-check-words.ts`.
4. `docs/agents/db/DATA_DICTIONARY.md`, the bank section; `tests/unit/bank-r2-server-guard.test.ts` and
   `bank-r2c-screens-guard.test.ts` (what the guards pin; the screens guard must grow, not shrink).

## Before any code: the UX summary (blocking)

`AGENCY_RULES.md` requires a plain-language summary for a product manager before implementing: what the treasurer sees and does
differently, the benefits, and the role differences (whoever can move club money writes; a reader sees the same screen
without the form, Delete or Start). Present it, wait for the owner's yes, then build. Run `/design` on the screen before
handing off (memory: mockups and screens go through `/design` by default).

## What BC2 must hold up

- **Ruling 3:** Save works while off. No $0.00 gate. The result reads "Matches" or an amber "Off by $X" (never red).
- **Ask 10:** the check sits on the Bank tab itself, above the saved checks. No separate page.
- **Ask 7:** an account with no start shows "Start checking {account}": the two fields and "Start here". After that the same
  fields are "Check a statement".
- **Ask 8:** the Stripe line, with its Show (child rows, footer "Stripe pays these out on {date} · Payouts tab") and the
  *not counted* notice. Online-payment lines are shown, not tickable.
- **Ask 5:** Delete after one question, who and when kept; the starting statement says why it cannot go while later checks
  stand (`start_has_checks`).
- **Ask 6:** "Books now say $X" is a chip on a saved row; no warning on any money form.
- **Q3:** the move window says in one sentence that a move changes nothing earlier.
- The figure on screen comes from the server (`GET accounts/[id]?date=`, debounced as you type); **the screen never does the
  arithmetic** (one home: `lib/bank-check.ts`).
- Cents are typed as dollars with the shared parser; **it must accept the overdrawn form the product prints, "($50.00)",
  as well as a minus sign** (BC1 `/review` screen finding).
- A refusal that means "the view is stale" (`changed`, `account_not_found`) **re-reads the overview and the account** before
  saying the sentence (BC1 `/review` screen findings 1 and 2).
- After the first "Start here" the setup card must not stay live while the overview re-reads (finding 3): flip it locally.
- The checks table: Statement date (link) · The bank said · Should have been · Result · Checked by · ›; the starting statement
  greyed "Starting point", no chevron. The opened check is a 520 form window with Delete and "Check this statement again".

## Work, in order

1. **BC1 loose ends (small, bank files only, their own commit if the owner wants them apart):** a JSON `null` body gives a
   coded refusal, not a 500, on the five write routes; a lower bound on a statement date (nothing before 2000-01-01);
   cut a waiting item's label by code points, not UTF-16 units; the screens' stale-view handling above. Tests for each.
2. **Words.** Write the band, sums, save, saved-checks and window words from plan §5 into `lib/bank-tab-words.ts`; remove the
   BC1 placeholders that promise what BC1 lacked. The owner's spelling rules are build-enforced (`npm run check:spelling`).
3. **The check form (BC2a):** Statement date (default: today), Bank balance, the lime "Save this check" inline; the joined
   money band updating as you type; the sums always open (Your books with the book names, Online payments on their way · n ·
   Show, the total). Hint "Lines since your last match: n" is shown, but its **Show** is BC3's: leave it out or inert-free,
   never a dead link.
4. **Start checking (BC2a):** the first-check card and the owner's ruling above. After the start, the tab is the check form.
5. **Saved checks (BC2b):** the table, the opened window, Delete, "Check this statement again" (opens the form with the date
   filled; saving replaces the old one), "Books now say".
6. **The account pill (BC2b):** options carry "{date} · Matches|Off by $X"; "Checked through {date}" moves to the latest check
   with the amber chip when off (ask 4); "Add an account" and "Name and books" as built, with the Q3 sentence in the move window.
7. **Guards and checks:** extend `bank-r2c-screens-guard.test.ts` (no tick vocabulary, the joined band, the words module only,
   no screen arithmetic); add the layout registry entry check if the screen list needs it (`npm run check:layout -- --list`,
   then `npm run check:layout -- --only admin-accounting-bank` on a dev server that is already up: scoped, not a sweep);
   `npm run verify:changed`; `npm run typecheck` (shared modules touched); the bank tests.
8. **Prove on dev** as the uat-rep-club treasurer (passwords in `.env.local`; new route files need the dev server's child
   restarted): start, save a matching check, save an off check, open it, check the date again, delete one, a Stripe-down
   start (force it), a reader sees no form. Probe under `.probe/bank-bc2/`; remove every row afterwards.
9. `/marketing` once, on the words this stage wrote (before the walk); then `/simplify` (new abstractions are likely) and
   `/review` (high; start from the BC1 review's open list in plan §9). Record what was built under plan §9 BC2 (positive
   facts with anchors), update the PM brief if the plan changed, the TODO line and the auto-memory note. **A walk page for
   the owner (checkable, paste-back) is BC9's job; BC2 hands off with a short "how to look at it" list.** Commit on the
   owner's yes.

## Out of BC2

Find and everything under it (BC3), the phone (BC4), the touchpoints (BC5), anything on the coach side (BC6+), the report,
the prod apply of migration 447 (owed at a quiet moment; the owner has ruled nothing reaches customers before this project
is complete), any change to hooks, checks or baselines.
