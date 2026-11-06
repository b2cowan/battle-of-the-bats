# Bank balance check BC3: Find (build prompt, two sessions)

> **BC3a done 2026-11-06 (built and walked on dev, `BANK_BC3A_WALK_PASSED`; record in plan §9 BC3; the
> owner's two answers in plan §0). Next BC3b: start at "BC3b — the doors out of the check" below.** BC3a's build call to
> carry: hints only name lines in the direction that can close the gap (`hintsFor`); Find's words are drafts for BC3b's
> `/marketing` pass (plan §5).

> **Written 2026-11-06**, after BC2 was committed (`35fea92f0` BC2a, `d93b79055` BC2b + its finishing passes). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC3_BUILD_PROMPT.md` into a new chat on `dev`.** The first session builds
> **BC3a**; it ends by writing one line at the top of this file ("BC3a done …, next BC3b") and the second session starts at BC3b.
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner says
> (the recipe is the auto-memory note `reference_partial_commit_shared_tree`: a private index built on the current HEAD, `BASE`
> recorded at `read-tree`, a HEAD guard immediately before the commit, a compare-and-swap `update-ref`; files other sessions also
> edit, such as `TODO.md`, are built as HEAD + your exact edit).
>
> **Why two sessions:** the plan calls Find "the riskiest logic" (§9, the stage split). BC3a is Find on a check (the callout, the
> lines, Not in the bank yet, Still waiting?). BC3b is the two doors that reach outside the check (Add the missing line, Waiting
> at the start), the start's corrections, and the finishing passes.
>
> **Not in BC3:** the phone frames (BC4: row cards with signed amounts, "Show 10 more", full-width buttons; the desk layout must
> not break at 390, but nothing is redrawn for it), the Overview line, Teams column and touchpoints (BC5), the report, anything
> coach-side (BC6+: "From the {2025 Season}" is the coach's), the prod apply of migration 447.

## What is already there (do not rebuild; read the code, not this list, before acting on a claim)

- **The engine** (`lib/bank-check.ts`, tested in `tests/unit/bank-check.test.ts`): `findHints(differenceCents, candidates)`
  (exact, half only on even cents, same-direction pairs/triples, at most 3, nearest-dated first, `HINT_CAP` 400, a step limit),
  `suspectsSince` / `suspectsStart` (lines after the last MATCHED check or the start; same-account transfer pairs dropped),
  `latestBefore`, `figureCheck` and `startBooks` with waiting items, `savedTerms` (an opened check's lines and signs).
  **Nothing in the app calls `findHints` yet.** It is pure and client-safe: the hints follow the TYPED balance, so call it on
  the screen, as the form already calls `figureCheck`.
- **The day's figure** (`GET accounts/[id]?date=&asked=check`, `figureForDate` in `lib/bank-club-read.ts`) already returns
  `suspects { since, sinceMatch, total, lines }` (each line with `bookId`, `bookName`, `online`; capped at `SUSPECT_CAP` 1000)
  and `stillWaiting` (the latest earlier CHECK's items, never the start's). No route takes a search; no Q2 look-back exists.
- **The save already takes "Not in the bank yet" items:** `savePlan` (`lib/bank-club-rules.ts`) accepts `body.waiting` as line
  keys (`entry:{id}`, at most 200), reads each line's figures on the server by id (rule 6: the client sends keys only), and
  refuses `bad_item` unless it is posted, in this account's books, dated on or before the statement, and not a counted
  on-its-way line. **The form never sends `waiting` today**, and its band is figured with `waiting: []`.
- **The opened check already shows saved items** ("Not in the bank yet · {line}", `savedTerms`).
- **`pickerSearch`** (`lib/bank-club-rules.ts`): reads a search as an amount (either direction), words, or nothing. Tested, not
  wired to a screen. Plan O4: "12,50" doesn't parse (the shared cents parser `typedCents`); fix there, carefully (Canadian
  "1,250" is a thousands comma).
- **The ordinary add form:** `AddEntryWindow` in `components/admin/kit/club/money/LedgerWindows.tsx`. It takes no prefill today
  (type, date and amount are its own `useState` defaults), needs a `BookRef` with `kind` (the bank's books carry only id and
  name) and the club's budget words (the Ledger page loads them from `budget-categories?scope=org&forPlanning=1&hostedEvents=1`).
- **The Stripe warning is the server's** (BC2 review): a save that can't count Stripe is refused (`not_counted_down` /
  `not_counted_unlisted`) unless the body says `anyway`. Keep that: a save that now sends `waiting` must keep `anyway`.

## Ask the owner first (one AskUserQuestion, before the UX summary)

1. **What happens to saved checks when a line is marked "Waiting at the start" (Q2)?** The plan says it "fixes every later
   check" (§0 Q2, §4); ruling ask 6 says saved figures never change. **Recommend:** saved checks keep their figures and show
   the quiet "Books now say $X" (that is BC1 review M2's fix in `withBooksNow`: it must read the start's items as they are
   now); the next check, and "Check this statement again" on any of them, figure from the corrected start. The other option
   is re-figuring every saved later check, which breaks ask 6. Say which saved checks would change in the walk fixture.
2. **M3: may a check's "Not in the bank yet" item be dated on or before the starting statement?** **Recommend no:** the start
   already proved that line was in the bank (or it is Q2's, which attaches to the start instead). The refusal is `bad_item`'s
   sentence or a new code; `tests/unit/bank-r2-server-guard.test.ts` pins the `bad_item` line, so update it.

Record both answers in plan §0 as ruled (add nothing they did not rule).

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (rulings, as ruled: asks 2, 3, Q2), §4 (the formula, the starting statement, **hints**),
   §5 (Find's words), **§6 tab 3 build notes** (and the "since your last check" vs "match" note: build both as match), §9 BC1
   (M2, M3), §9 BC2 (what is built, and the review's recorded findings: the start re-saved under a standing check is BC3's, see
   BC3b step 3), the Open questions (O4).
2. The approved drawings `BANK_BALANCE_CHECK_DRAWINGS.html` (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN), **tab 3** (Find,
   desk 1440, and the "after one tap" frame) and tab 2's hint ("Lines since your last check (Sep 30): 13 · Show them"). **Not
   drawn:** "Still waiting on {line}?", "Waiting at the start", the half and combination hints. Build those from the plan's words
   and say so to the owner in the UX summary. Memory rules that apply: draw controls from the SHIPPED component (the kit's
   table, `RepChip`, `Callout`, the search field the club kit already uses), every highlight is clickable, amber never red,
   direction in words never a minus sign, money figures are ONE joined band.
3. The bank client (`components/admin/kit/club/money/bank/`) and its guard `tests/unit/bank-r2c-screens-guard.test.ts`. Several
   assertions pin today's shapes and must move with the work: "Find's Show them is not here (BC3)", the band's `figureCheck`
   call (`waiting: []`), Save's `{ date, bankCents: typed, anyway }`.

## Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: a plain-language summary for a product manager first (what the treasurer sees and does differently, the
benefits, the role differences; a reader cannot reach the tab today because club read = write, but build behind `canMove`).
Present it with the owner's two answers folded in; wait for yes.

---

## BC3a — Find on a check (session 1)

1. **"Find the $X"** (drawn tab 3): a section under the check form, **only while the check is off** (amber). The callout
   (`Callout tone="warn"`) names the first hint: exact ("Cheque #214 · Umpire clinic (Oct 29) is exactly $75.00. If the bank
   hasn't cashed it yet, that's the gap." + "Or the bank received $75.00 your books don't have: a deposit or interest you
   haven't entered."), half ("Half of $X. Entered the wrong way round?"), or 2–3 lines ("These {2|3} add up to $X"). Its buttons:
   **Not in the bank yet** (for an exact hint; a half or combination hint highlights its rows instead) and **Add the missing
   line** (BC3b wires it; in BC3a it may be absent, not a dead button). No hint: the callout drops away and the list stays.
   Hints come from `findHints` over the suspects **minus lines already marked**, on the TYPED difference.
2. **The lines** (drawn): toolbar "Lines since your last match · {date}" (or since the starting statement) with a search
   ("Find an amount or a name…", `pickerSearch` semantics: an amount matches either direction; filter on the screen, the lines
   are already in the figure). Table: Date · What (with its quiet detail) · Book · Money out · Money in (green) · the action. A
   hinted row is amber-soft with the chip "Exactly $X" (and a half or combination row its own chip). **Not in the bank yet**
   shows on that row and on hover/focus for any row (keyboard reachable, not hover-only). An online-payment line already on its
   way is greyed "on its way, counted above" and has no action (compare keys with the figure's on-its-way lines).
   Tab 2's plain hint ("Lines since your last match ({date}): n") becomes the drawn door **Show them**, which opens the lines
   when the check matches or before a balance is typed.
3. **Not in the bank yet + Undo** (ask 2): marking a line adds a row to the sums ("Not in the bank yet · {line}" + **Undo** +
   "+ $75.00" for money out, "− $X" for money in, signs from the engine), the band re-figures (`figureCheck` with the marked
   items: no arithmetic on the screen), the hint list re-runs without it, and when the check now matches the Find section
   closes (the drawn "after one tap" frame). Save sends the marked line KEYS as `waiting` (with `anyway` as today). The saved
   check then shows them (already built in the opened check). Changing the date clears the marks.
4. **Still waiting?** (ask 2; not drawn): the next check's sums carry one row per item of the latest earlier check
   (`stillWaiting`): "Still waiting on {line}?" with **Yes** (carries it onto this check as a marked item) and **No** (drops it);
   once answered it stops asking for this check. A carried item obeys the same server rules (dated on or before the statement).
5. **M3** as the owner ruled (server: `savePlan`, its guard).
6. **Guards and tests:** engine tests stay; extend the screens guard (Find behind `canMove`, hints only via `findHints`, no tick
   vocabulary still, every action keyboard reachable, the words module only); a server test that a marked line outside the
   account's books, a counted on-its-way line, and (per M3) a line on or before the start are refused. `npm run typecheck`,
   focused lint, `check:spelling`, the bank tests, `check:layout -- --only=admin-accounting-bank` (all four widths;
   `--width` is a single value, `--only` takes `=`).
7. **Prove on dev** as the uat-rep-club treasurer on "Walk chequing" (start Sep 30, $5,000.00). The walk needs real book
   lines: add them as the treasurer through the ordinary Ledger route (never a direct insert into the books), note them, and
   remove them afterwards with every probe check. Walk: an off check whose gap is one cheque (exact hint, chip, Not in the bank
   yet → Matches, Save, the opened check lists it); Undo; a half hint; a two-line hint; search by amount and by name; the next
   check asks Still waiting? (Yes carries, No drops). Probe under `.probe/bank-bc3/` (the BC2 probes are the pattern: password
   sign-in for routes, `tests/uat/.auth/rep-club-treasurer.json` for the browser; write scripts with Write/Edit, never a heredoc
   with `${}`). Restore everything; the walk account ends on its Sep 30 start only.
8. **End of BC3a:** record what was built in plan §9 BC3 (positive facts with anchors), add the "BC3a done" line at the top of
   this file, and recommend `/clear`. Commit on the owner's yes (one commit), or carry it into BC3b's commit if he prefers.

## BC3b — the doors out of the check, the start's corrections, the finishing passes (session 2)

1. **Add the missing line** (§6 tab 3): opens the ordinary `AddEntryWindow` **prefilled** with the amount, the statement date
   and the direction (bank more → money in; bank less → money out), on the account's first book. Add optional prefill props to
   `AddEntryWindow` (default behaviour unchanged for the Ledger page; check its callers and guards), supply the book's `kind`
   (the server knows each club book's type), and load the budget words the way the Ledger page does. The line is written by the
   Ledger's own route, never by bank code (the server guard "no bank code writes money" must still pass). After it lands, the
   form re-reads the day's figure. No separate bank-fee button.
2. **Waiting at the start** (Q2-A, as the owner ruled it): while no check since the start has matched, the lines also include
   the 60 days before the start (server: the figure's suspects for that case, marked as before the start). Such a line offers
   **Waiting at the start** with "This was written before your starting statement and cashed after it." Choosing it attaches the
   line to the starting statement (an item with `at_start`), which moves the start's books by its amount; then saved later checks
   behave as the owner ruled (recommended: "Books now say $X", M2's fix). Decide the step with `/dba` if it needs SQL: re-saving
   the start through `PUT …/setup` replaces it (a new id) while checks stand on it; a dedicated "add an item to the start" step
   may be cleaner. **Fold in the BC2 review finding** (plan §9 BC2): a check saved in the instant its start is re-saved carries
   the old start's books; the save should hold the start it read (an expected start id/books checked under the account lock).
   A new migration, if needed, follows the schema = dictionary rule (`DATA_DICTIONARY.md`, `npm run refresh:snapshots`,
   `check:dictionary`), goes through `/dba`, and its prod apply is parked with 447 in the manual prod steps.
3. **M2** in `withBooksNow`: "Books now say" reads the start's items as they are now.
4. **O4**: "12,50" in the shared cents parser, only if it can't be misread as twelve hundred fifty (say what you chose).
5. **Prove on dev** (extend `.probe/bank-bc3/`): Add the missing line opens prefilled and the check then matches; a cheque dated
   before the start found by the 60-day look-back, Waiting at the start, the start's window lists it, a later saved check shows
   "Books now say" (or as ruled); clean up every line, item and check.
6. **`/design`** on the whole Find section and the add/attach doors (before hand-off, per memory), then **`/marketing` once** on
   Find's words (plan §5's Find lines, the new hint and Still waiting / Waiting at the start sentences) **plus the two BC2 review
   refusals** (`not_counted_down` / `not_counted_unlisted`, plan §5 marks them for this pass), then **`/simplify`**, then
   **`/review` (high)**, starting from plan §9 BC2's recorded findings. Records: plan §9 BC3 (and §0 for the owner's two
   answers), §5 ticks, the TODO line (HEAD + your exact edit), the auto-memory note `project_bank_reconciliation.md` and its
   MEMORY.md line, the PM brief if the plan changed. Mark this prompt done. Commit on the owner's yes, then hand off in
   product-owner voice with a short "how to look at it" list, offer `/docs` once, and say what's next (BC4, the phone).

## Out of BC3

The phone redraw (BC4), the touchpoints and report (BC5), the coach side (BC6+), the prod apply of 447 (and of any BC3
migration), any change to hooks, checks or baselines.
