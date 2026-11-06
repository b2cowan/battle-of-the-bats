# Bank balance check BC4: the start's lines on a re-check, then the Bank tab on a phone (build prompt, two sessions)

> **BC4a done 2026-11-06, committed `664f2086e`** (built, walked `BANK_BC4A_WALK_PASSED` at 1440 and 390, `/review` applied; record in plan §9 BC4);
> **next BC4b** (the phone, below). New words from BC4a for BC4b's `/marketing`: none (the sentence stays "Still waiting on
> {line}?"; start lines come marked `atStart` if a phone or desk caption wants it).

> **Written 2026-11-06**, after BC3 was committed (`d55c4ad77` BC3a, `12c697389` BC3b + its finishing passes). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC4_BUILD_PROMPT.md` into a new chat on `dev`.** The first session builds
> **BC4a**; it ends by writing one line at the top of this file ("BC4a done …, next BC4b") and the second session starts at
> BC4b. Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the
> owner says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`: a private index built on the
> current HEAD, `BASE` recorded at `read-tree`, the pre-commit hook run on that index, a HEAD guard immediately before
> `commit-tree`, a compare-and-swap `update-ref`; files other sessions also edit, such as `TODO.md` and
> `DATA_DICTIONARY.md`, are built as HEAD + your exact edit). ⚠ This repo's shell drops backslashes in heredocs and a
> backtick inside a `node -e` string EXECUTES: write edit scripts with the Write tool.
>
> **Why two sessions:** BC4a is not phone work. It is the owner's ruling of 2026-11-06 (plan §0 "Start item re-check"),
> which touches the server's day figure, the save's rules (M3) and the form. BC4b is the phone redraw, which is screens
> only. Splitting them keeps the money rule out of a layout session.
>
> **Not in BC4:** the Overview line, Teams column and touchpoints (BC5), the report, anything coach-side (BC6+), the prod
> apply of migrations 447, 449 and 450 (they go together, with the BC3 code, in one promote: `MANUAL_PROD_STEPS.json`).

## What is already there (do not rebuild; read the code, not this list, before acting on a claim)

- **The check, its saved checks, and Find on a desk** (`components/admin/kit/club/money/bank/`: `BankCheckForm`,
  `BankFigure` (band + sums), `BankFind`, `BankStatements`, `BankCheckWindow`, `BankSetup`, `BankTab`). Every word is in
  `lib/bank-tab-words.ts` (settled by `/marketing` in BC2 and BC3b, plan §5 ticks) and refusals in `lib/bank-check-words.ts`.
- **"Still waiting?" today** (`figureForDate`, `lib/bank-club-read.ts`): `stillWaiting` = the items of the latest EARLIER
  live CHECK (`latestBefore(checks.filter(kind === 'check'), date)`), never the start's. The form shows one sums row per
  item, "Still waiting on {line}?" Yes (marks it Not in the bank yet) / No (drops it for this check).
- **M3** (`savePlan`, `lib/bank-club-rules.ts`): a check's Not in the bank yet line dated on or before the start is
  `bad_item`. **Waiting at the start** (Q2-A, BC3b): a line of the 60 days before the start can be attached to the start
  (`PATCH …/setup` → `correctStart` → `startItemPlan` → `bank_start_waiting`, migs 449/450); the start's books move by it;
  the start records `corrected_at` / `corrected_by` (mig 450); saved later checks read "Books now say $X" with the start's
  reason (`startCorrected`).
- **Phone today** (`Bank.module.css` 640px and 768px blocks, `useIsPhone` in `BankStatements`): the saved checks are kit
  row cards; the check form's fields stack, Save is full width, sum rows wrap; the setup card is one column; `.link`,
  `.markBtn`, `.chipDoor` have 44px floors and the row button is always shown on a touch screen. **Find is still the kit's
  table at every width** (it scrolls sideways inside its frame), "Show 50 more" pages by 50, the callout's buttons are not
  full width, and the band says "Should be in the bank" at every width.
- **Walk probes** `.probe/bank-bc3/walk.mjs` (BC3a) and `.probe/bank-bc3/bc3b.mjs` (BC3b), run with
  `node --import ./tests/ts-resolver.mjs --env-file=.env.local <file>` (`WIDTH=390` for the phone): both pass at 1440 and
  390 today; they add their own lines through the Ledger route and remove every line, check and start correction.
  **BC4a added `.probe/bank-bc4/bc4a.mjs`** (the start's cheque asked on a re-check, passes at 1440 and 390). At a phone's
  width a saved check is a row card whose button is named by its title ("Oct 5, 2026 · $X"), not "Open the check for…":
  the walks use `.or(getByRole('button', { name: /^Oct 5, 2026/ }))`; keep a card's name starting with its date.
- **BC4a (committed `664f2086e` 2026-11-06):** "Still waiting?" now also carries the start's Waiting-at-the-start lines
  (`stillWaitingOn`, each marked `atStart`; the sentence unchanged), and a check may save one as Not in the bank yet (M3's
  exception). On a phone these are ordinary Still-waiting rows in the sums; nothing new to draw.

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (rulings, as ruled: ask 2, Q2, "Q2 + ask 6", M3, "Q2 look-back", **"Start item
   re-check"**), §4 (the formula), §5 (the words; BC4 owns the phone words "Bank balance" and "Should be there"), §6 (phone
   notes at the "Phone:" lines), §9 BC3 (what was built, the review's carried findings) and **§9 BC4**.
2. The approved drawings `BANK_BALANCE_CHECK_DRAWINGS.html` (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN): the phone
   frames are `fr w390`, phone CSS at ~lines 241-277. **Tab 1** club phone, a check that matches (~400-415); **tab 3** club
   phone, Off by $75.00 with Find (~525-547); **tab 5** only a note (~644: "the kit's white row cards… The window opens
   full screen, as every form window does on a phone"). Tab 2's phone frame is the COACH's (BC7), not this stage's.
3. Memory rules that apply: draw from the SHIPPED component (the kit's row cards, `RepChip`, `Callout`, `SearchField`,
   `KitDialog`), every highlight is clickable, amber never red, a direction in words never a minus sign on a desk (the
   phone's signed amounts are the drawing's, plan §6), money figures are ONE joined band, the dialog-footer tap floor.
4. The screens guard `tests/unit/bank-r2c-screens-guard.test.ts` and the server guard `tests/unit/bank-r2-server-guard.test.ts`:
   several assertions pin today's shapes (Find's table, `stillWaiting` from the latest earlier check, M3's line) and must
   move with the work, keeping what they protect.

---

## BC4a — the start's lines on an earlier re-check (session 1)

**The ruling (plan §0, owner 2026-11-06):** a check dated before a start's Waiting-at-the-start line cleared also asks
"Still waiting on {line}?" for each of the start's Waiting-at-the-start lines, as it asks about the previous check's lines.

**Why:** a cheque written before the starting statement and cashed after it is attached to the start (BC3b). A check
dated BEFORE the cheque cleared, re-checked with "Check this statement again", then reads off by the cheque, and nothing
can close it: M3 refuses a pre-start line as Not in the bank yet, and "Still waiting?" never carries the start's lines.

### Ask the owner first (one AskUserQuestion, before the UX summary)

1. **When is a start's line asked?** The app doesn't know the day a cheque cleared. **Recommend:** treat the start as the
   first link of the "Still waiting?" chain. A check asks about each of the start's Waiting-at-the-start lines unless a
   live check dated before it, **saved after the line was attached** (its `created_at` after the item's `added_at`), already
   answered: it carries the line (then the ordinary chain asks from that check) or it doesn't (the treasurer said No, or
   it matched without it). A check saved before the line was attached never saw the question, so it doesn't count. Say
   what the walk fixture would ask on each date. The other option is simpler and noisier: every check dated within six
   months of the start asks about every start line until one saved check says No.
2. **M3's exception:** a line carried from the start's list may be marked Not in the bank yet on a check, although it is
   dated before the start. **Recommend yes, for exactly the lines on the live start's list** (any other pre-start line stays
   `bad_item`). That is M3's own reasoning ("or it is Q2's, which attaches to the start instead"), and without it the Yes
   answer can't be saved. The refusal sentence for any other pre-start line stays as settled.

Record both answers in plan §0 as ruled (add nothing they did not rule).

### Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: a plain-language summary for a product manager first (what the treasurer sees and does differently,
the benefits, the role differences: club read = write today, build behind `canMove`). Present it with the owner's two
answers folded in; wait for yes.

### The build

1. **Server, the day figure:** `stillWaiting` also carries the start's Waiting-at-the-start items as the owner ruled
   (mark each as the start's, so the screen can say so if `/marketing` wants it; the sentence stays "Still waiting on
   {line}?"). Pure rule in `lib/bank-club-rules.ts` or `lib/bank-check.ts` with unit tests; the read stays in
   `figureForDate`.
2. **Server, the save:** `savePlan` lets a check's waiting key be a line on the live start's list (the M3 exception, as
   ruled); every other rule holds (posted, the account's books, on or before the statement, not counted on its way).
   Update the screens/server guards and `tests/unit/bank-club-routes.test.ts`'s M3 test.
3. **The form:** nothing new to draw; the start's lines arrive as Still-waiting rows. Yes marks the line; Save sends its
   key; the opened check lists it as "Not in the bank yet · {line}" (already built).
4. **No migration expected** (the rule reads `added_at` from 449 and the checks' `created_at`). If one is needed, `/dba`
   first, the schema = dictionary rule, and its prod apply parked with 447/449/450.
5. **Prove on dev:** extend `.probe/bank-bc3/bc3b.mjs` (or a new `.probe/bank-bc4/`): a cheque before the start, attached
   at the start, a check dated before it cleared re-checked → asks Still waiting? → Yes → Matches → Save; the opened check
   lists it; a check after it cleared doesn't ask (or as ruled); clean up every line, item, check and the start's
   `corrected_at` (the BC3b walk's cleanup is the pattern).
6. **Checks:** the bank tests, `npm run typecheck`, focused lint, `check:spelling`, `check:layout -- --only=admin-accounting-bank`
   (four widths). Then `/review` (standard: no new abstraction expected; `/simplify` only if one appears).
7. **End of BC4a:** record in plan §9 BC4 (positive facts with anchors), add the "BC4a done" line at the top of this file,
   commit on the owner's yes, and recommend `/clear`.

---

## BC4b — the Bank tab on a phone (session 2)

### Ask the owner first (one AskUserQuestion, before the UX summary)

The drawings leave three things open. Recommend, and let the owner rule:
1. **The sums on the club phone:** tab 1's club phone draws no sums under the band (the coach phone does; the data-note says
   "the sums behind the second tile"). **Recommend:** show them as on the desk, stacked under the band. "Not in the bank
   yet · {line}" + Undo and "Still waiting?" live there, so hiding them hides the marks.
2. **Find's search on a phone:** undrawn (the phone frame shows only the group head). **Recommend:** keep the product's
   `SearchField` full width above the cards; searching by amount is the fastest way to a cheque on a phone.
3. **"Show 10 more" (drawn) vs the desk's 50:** **Recommend 10 on a phone, 50 on a desk** (one page size per width; the words
   are the same function).

### Before any code: the UX summary (blocking)

As BC4a. Say plainly what is built from the drawing and what is NOT drawn and built from the desk's words and the kit's
phone patterns (the list below).

### The build (from the drawings; settled words win)

⚠ **The phone frames carry older draft words in places** ("Since your last match · {date}", "Not cashed yet? Or $75.00
came in that your books don't have?"). The words were settled afterwards (plan §5, `lib/bank-tab-words.ts`): **use the
settled words; the phone changes the layout, not the sentences**, except the two phone words BC4 owns ("Bank balance" for
the field label, "Should be there" for the band's middle tile, plan §5) and anything `/marketing` settles in this session.

1. **The band (tabs 1, 3):** three joined tiles, "The bank says" and "Should be there" two-up, "Difference" full width
   under them (drawing CSS ~248), still ONE joined band (memory rule). The middle tile's caption: the drawing's shorter
   "your books, less $X on its way" is a draft; take the settled caption unless `/marketing` settles a phone one.
2. **Find (tab 3):** below 640px Find is **row cards in one white list** (the kit's row-card pattern, as `BankStatements`
   uses), never the table:
   - title = what; sub-line = date · book · how it came, with its chip ("Exactly $X" / "Half of $X" / "Part of $X"); the
     **signed amount at the right** (−$75.00 out, +$100.00 in, green), as drawn and as plan §6 says for a phone;
   - a hinted card is amber-soft; the chip stays a door (every highlight is clickable);
   - the card is NOT a button; its action ("Not in the bank yet", or "Waiting at the start" before the start, or Undo on a
     marked line) is its own 44px control inside the card;
   - the greyed "Online payments · n · on their way, counted above" card has no action; the look-back's band row and
     sentence become a group head and a quiet line above their cards;
   - "Show 10 more" (as ruled) as the last, quiet row.
3. **The callout (tab 3):** its buttons on their own full-width row, equal widths, 44px ("Not in the bank yet", "Add the
   missing line", "Waiting at the start"); "{i} of {n} · Next possibility" below them.
4. **Windows full screen (tab 5's note):** confirm `KitDialog` goes full screen on a phone (find its file; the bank imports
   it as `../../KitDialog`); the opened check, the start's window, Delete's question and the "Add the missing line" window
   (the Ledger's `AddEntryWindow`) all follow. If `KitDialog` doesn't, that is a kit change: say so to the owner first.
5. **Undrawn on a phone, built from the desk's words and the kit's patterns** (say so in the UX summary): "Still waiting on
   {line}?" with Yes / No; "Waiting at the start", its group head and sentence; the half and combination hints; the
   bank-less sentence; "Or the bank…"/"The bank…" and Next possibility; the after-mark state (the "+ $75.00 · Undo" sums row,
   Find closing on a match); Show them / Hide them; the search's empty states; the Account pill's options and the Stripe
   child rows (tab 6); the opened check's contents and foot.
6. **No pinned strip or dock** (gone with the tick-off, plan §9 BC4). The desk layout must not change.
7. **Guards and tests:** extend the screens guard (Find is row cards below 640px and never a table there; the signed amount
   comes from the engine's sign, no arithmetic on the screen; every action keyboard reachable and ≥ 44px; the words module
   only; no tick vocabulary). `npm run typecheck`, focused lint, `check:spelling`, `check:tokens`, `check:css-purity`, the bank
   tests, `check:layout -- --only=admin-accounting-bank` (all four widths; `--width` is one value, `--only` takes `=`).
8. **Prove on dev at 390 and 361** as the uat-rep-club treasurer on "Walk chequing": extend the BC3 walks at `WIDTH=390`
   (and 361 for the band and the callout row) for the card shapes, the signed amounts, "Show 10 more", the callout's
   buttons, Still waiting? and Waiting at the start on cards, a window full screen, and no sideways scroll anywhere; the
   desk walks still pass at 1440, and `.probe/bank-bc4/bc4a.mjs` still passes at 1440 and 390 (it drives the Find
   callout's "Waiting at the start" button inside `[role="status"]` and the "Yes, still waiting on {line}" button). Restore everything; the walk account ends on its Sep 30 start only (`corrected_at` NULL).
9. **Finishing passes:** `/design` on the phone frames as built, against the drawings (before hand-off, per memory), then
   **`/marketing` once** on the phone words ("Bank balance", "Should be there", any phone caption, and anything new from
   BC4a), then `/simplify`, then **`/review`** (standard, or high if a kit component changed). Records: plan §9 BC4, §5
   ticks, the TODO line (HEAD + your exact edit), the auto-memory note `project_bank_reconciliation.md` and its MEMORY.md
   line, the PM brief. Mark this prompt done. Commit on the owner's yes, then hand off in product-owner voice with a short
   "how to look at it" list (on a phone, or the browser at 390), offer `/docs` once, and say what's next (BC5, the
   touchpoints).

## Out of BC4

The touchpoints and report (BC5), the coach side (BC6+), the prod apply of 447/449/450, any change to hooks, checks or
baselines, a kit component change the owner hasn't agreed to.
