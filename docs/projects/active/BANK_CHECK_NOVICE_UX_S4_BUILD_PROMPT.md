**EXECUTED 2026-11-13: S4 built (plan §4, the S4 entry; the three calls ruled as recommended, the method line widened); owner walk §523 owed; commit on the owner's yes.**

**Written 2026-11-13, after S3's owner walk §505 PASSED 38/38 and its call-follow-ups were committed `eb6e166a8`. S4 is RULED (A6, 2026-11-08, "Reshape: the method line"; drawing D6 in the evaluation page) but not yet built, and no `/accounting` verdict on the print exists. Nothing here has been built.**

# Bank check through a volunteer's eyes — S4 (the printed check names its method) — build prompt, one session

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S4_BUILD_PROMPT.md` into a new chat on `dev`.**
> Plan of record: `BANK_CHECK_NOVICE_UX_PLAN.md` (§0 A6; §2 S4; §4 record). Spec: the evaluation page's **Words row 15**
> and **drawing D6** (`BANK_CHECK_NOVICE_UX_EVALUATION_CLAUDE.html`, published https://claude.ai/artifact/SDTnvjwNmq5HUUhAyj7BVF,
> Words tab row 15, End state tab D6; the file is one long line, grep it).
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`). `lib/bank-tab-words.ts` and both help files carry other
> sessions' hunks too. This repo's shell drops backslashes in heredocs and a backtick inside `node -e` EXECUTES: write edit
> scripts with the Write tool, or use Edit. No new files or migration are expected, so no dev-server restart.

## What this is, in product-owner words

A volunteer who prints a balance check to hand to a treasurer holds a page that **disagrees with the screen they just
read**: the screen works from the books ("Should have been in the bank $6,826.00", an uncashed cheque **+** $460.00); the
paper works from the bank, as an association's monthly form does ("What your books should say $6,361.50", the same cheque
**−** $460.00). Both are arithmetically right and the owner ruled the paper's bank-first order in BC5b. The fix ruled
2026-11-08 is **not** to reorder the paper: it is **one sentence above the items that says how the page was worked out**, so
the sign flip reads as a method, not a contradiction. Both portals, desk only (printing is a desk's door; no phone frame).

## What is already decided (do not re-ask)

1. **Keep the paper's order, its signs, its figures and the "Not in the bank yet" heading.** The method line is the only
   addition to the body (D6: tagged NEW; everything else UNCHANGED).
2. **Both portals get it**, club (`BankCheckReport.tsx`) and coach (`CoachBankReport.tsx`), from one shared words constant
   in `lib/bank-tab-words.ts` (near `reportEyebrow` … `reportFoot`). Every printed string already lives there; add no
   inline strings.
3. **Nothing on the printed page refers to the screen** (row 15).
4. **Nothing about the screen's summing changes.** `reportTerms` (bank first) and `savedTerms` (books first) in
   `lib/bank-check.ts` stay exactly as they are; the page components only format. No arithmetic goes on the page.
5. **`/accounting` review before hand-off** (CLAUDE.md: the change alters what the product prints about money). Apply what it
   finds or record it as an owner question. `/marketing` settles the final strings. `/design` on the print preview.

## What I (the writer of this prompt) checked in code on 2026-11-13, so you need not

- `reportTerms` (`lib/bank-check.ts`) runs: bank · each waiting item with `waitingOnStart` (a cheque −, a deposit +) ·
  online payments on their way (+, or "not counted") · cash (+) = `booksCents + differenceCents`. `savedTerms` is the
  opposite frame (books · on-its-way − · items with `waitingOnCheck` · cash −). Confirmed.
- The strings: `reportTitle` "{account} · statement ending {date}", `reportBank` "Bank balance on the statement",
  `reportShould` "What your books should say", `reportBooksOn` "Your books on {date}", `reportStartingPoint` (club only).
  The screen's own are `savedTitle` "The check for {date}" and `bandBankCaption` "Bank balance on {date}".
- No test pins `reportTitle`, `reportBank`, `reportShould`, `reportBooksOn`, so those can change without a pin breaking;
  the pins that exist are in `bank-r2c-screens-guard.test.ts` (describe 13: frame, `reportTerms` use, no arithmetic, eyebrow,
  `reportCheckedBy`, `reportFoot`, the starting-point line) and `bank-coach-view-guard.test.ts` (describe 8: coach frame,
  `coachReportFoot`, no club report code imported). Add pins for what you add.
- The two help paragraphs that describe the printed page and must follow the strings: club `bank-tab-print`
  (`lib/help-content/accounting.tsx` ~l. 388) and coach `premium-money-bank-print` (`lib/help-content/coaches.tsx` ~l. 3167),
  plus their `searchText`/`keywords`.
- The screen has **no printable method sentence**. `sumsTitle` is only an `aria-label`; the on-screen captions describe the
  books-first order and would contradict the paper; the help prose is JSX and also books-first. The method line is a **new
  constant**.

## Three things to settle FIRST, in the conversation, before building (PM summary + the questions, then wait)

The ruled sentence (row 15) is *"Worked from the bank's balance: cheques it hasn't cashed come off, deposits it hasn't
received go on."* Three problems with building it verbatim — argue them, do not paper over them:

1. **The sentence is only roughly true.** The club's page also adds *Online payments on their way* (+) and, on both pages,
   *Cash not deposited yet* (+). "…cheques come off, deposits go on" leaves those two kinds of line unexplained on the very
   page that exists to be understood by a non-accountant. Options: (a) the ruled sentence as it stands (simplest; cash and
   online payments are labelled lines that explain themselves); (b) a general phrase that covers them ("Worked from the bank's
   balance, adjusted for what hasn't reached it yet"); (c) the ruled sentence plus a second short clause. Recommend, after
   `/accounting` and `/marketing`. The page also carries two other candidate wordings (F16/S4 card: "Starting from the bank,
   then what hasn't reached it"; the Codex page: "Work back from the bank using the adjustments below…"); the owner ruled
   row 15's, so start there and only depart for a reason you can state.
2. **The title and "Bank balance on the statement".** Row 15 says *"If A1b passes, the title follows ("The check for Nov 8,
   2026", "Bank balance that day")."* A1b was ruled Reshape and S1 shipped without touching the print's title, so both are
   still S4's (plan §4, S1 entry: "the printed check's title and 'Bank balance on the statement'… the printed page as one
   unit"). **D6's after-frame still shows the OLD title and "on the statement"**, so renaming them is a difference from the
   approved drawing: bring it to the owner as a call with a recommendation (recommend yes — "statement" is the word A1b
   removed everywhere else; the page that carries the volunteer's name and signature lines should not be the one place it
   survives), do not slip it in. Also settle the club title's shape (`{account} · statement ending {date}` → e.g.
   `{account} · The check for {date}`).
3. **"Your books" vs "Your Ledger" on the coach's page.** The coach screen calls the books "your Ledger"
   (`coachSumBooks`); the coach's printed page says "Your books on…" and "What your books should say", and its result note
   says "than your books". Decide with `/marketing`/`/accounting` whether the coach's paper should say Ledger like the coach's
   screen. (The club says books everywhere; leave it.) This is a words call, but it is the exact "paper disagrees with the
   screen" class of defect S4 exists to remove.

Also ask the owner, as a one-line call, whether the club's *starting-point* note ("Your books when checking started {day}:
{bal} · change in the books since: {±}", S1b) still reads right beside the new method line, or whether it should sit under
the books row only (as now). Default: unchanged.

## Build (after the owner's yes on the three)

- One constant for the method line (and, if ruled, the renamed title / bank-row strings) in `lib/bank-tab-words.ts`; both
  report components render it above the items, in the print stylesheet's existing text style (a quiet one-line note, not a
  heading; see `BankReport.module.css` and `CoachBankReport.module.css`). It must print on the one US Letter page with the
  longest realistic check (many waiting items, a long account name) — measure that, do not assume.
- Pins: the method line renders above the items in both reports and nothing else about the order changed; both reports read
  the same constant; the coach report still imports no club report code; the renamed strings (if any).
- Help: both print paragraphs say what the page now says (the method line, and any renamed row/title), and their
  `searchText` follow. `npm run check:spelling` stays clean.
- `/docs` offer for the two help articles; `/review` offer when done (per CLAUDE.md); `/simplify` only if you add a new
  shared abstraction (you should not need to).
- Walk: the owner prints one real saved check from each portal (or "Save as PDF"). Write it as a short checkable walk
  (an Owner QA Ledger section, the next free number — **never sort the §numbers**): the method line is there and reads
  right, the order and figures are the same as before, one page, the signature lines still fit, the coach's and the club's
  say the same thing about the same check. Needs a fixture with a saved check that has an uncashed cheque, a not-yet-landed
  deposit, and (club) an online payment on its way; make your own (see `.probe/bank-ux-s3/owner/setup.mjs` and
  `teardown.mjs` for a pattern that removes only what it recorded) and tear it down after the owner reports.

## Out of scope (do not build on the way past)

- Changing the paper's order or signs (ruled: keep). Any change to `reportTerms`/`savedTerms`.
- A saved-checks money shelf (A15's other half; P4's own mockup session). The season windows' "Print any check you want to
  keep first" sentence (`seasonPrint`) is unchanged.
- S5, S6, S7 (S7 is the big one: its own drawing session first). Mig 457 prod apply (a promote step, not this session).
- A duplicate-fee warning; marking lines created from a bank check (recorded in the plan as later ideas).

## Done when

Both printed checks carry the method line above the items (and the ruled title/bank-row words, if the owner says yes), the
two help paragraphs match, the pins and the focused bank tests pass, `/accounting` and `/marketing` have been run and
their findings applied or recorded, the owner has a walk to print from, and the plan's §4 has an S4 entry with the
commit hash once the owner says commit.
