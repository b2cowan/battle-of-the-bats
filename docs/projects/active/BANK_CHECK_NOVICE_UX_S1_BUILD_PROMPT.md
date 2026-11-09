**S1 done 2026-11-08, committed `bdb56dd2f`. S1b done 2026-11-08, committed `4b9e9a655` (plan §4 has the record);
owner walk §497 published. This prompt is finished; next is S2.**

# Bank check through a volunteer's eyes — S1 (words) and S1b (the club's start) — build prompt, two sessions

> **Written 2026-11-08**, when the project started (plan `BANK_CHECK_NOVICE_UX_PLAN.md`, every ask ruled in its §0).
> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S1_BUILD_PROMPT.md` into a new chat on `dev`.** The first
> session builds **S1**; it ends by writing one line at the top of this file ("S1 done …, next S1b") and the second
> session starts at S1b.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`). ⚠ Before editing a bank file, run
> `git status --short -- lib/bank-tab-words.ts lib/bank-check-words.ts lib/bank-screen.ts components/admin/kit/club/money/bank components/coaches/bank lib/help-content/accounting.tsx lib/help-content/coaches.tsx`.
> On 2026-11-08 another session held uncommitted hunks in `BankTab.tsx`, `bank-tab-words.ts` (the Account pill's
> sub-line: `throughResult`, `notCheckedLine`), `bank-screen.ts` and `accounting.tsx` (a permits paragraph near line 703).
> If they are still uncommitted, work around them and leave them out of your commit; if they collide with a row you must
> change, stop and ask. ⚠ This repo's shell drops backslashes in heredocs and a backtick inside `node -e` EXECUTES:
> write edit scripts with the Write tool, or use the Edit tool. New files or shared-module changes mean a dev-server
> restart before the owner looks (AGENTS.md; other sessions use the same server, say so first).

## Read first
1. The plan, all of it (`BANK_CHECK_NOVICE_UX_PLAN.md`) — §0 rulings, §1 what A17 overtakes, §2 S1 and S1b.
2. The evaluation's **Words** tab and **End state** tab: source `.probe/bank-ux-eval/claude/artifact.src.html` (search
   `id="words"` and `id="endstate"`; the page is long, read those sections, not the whole file). Rows 1–25 are the
   proposed strings; drawings D1, D2 (coach) and D4 (club start, superseded by A17) are the visual spec.
3. The shipped words: `lib/bank-tab-words.ts` (both portals' screens; the coach's keys start `coach…`),
   `lib/bank-check-words.ts` (refusals). `npm run check:spelling` guards one spelling per word.

---

## Session A — S1, words on both portals

**Scope (plan §2 S1):** rows 1, 3, 4, 5 (check form only), 6, 7, 8, 10 (leave the draft's own "Kept in this browser
only…" sentence as it is: S7 replaces it), 11, 13, 16, 19, 21, 22, 23, 25; A15's sentence ("Print any check you want to
keep first") in both season windows (`components/coaches/StartNextSeasonModal.tsx`, `CloseSeasonModal.tsx`, words
`coachSeason*` in `bank-tab-words.ts`); the help fixes — the club article's paragraph describing a read-only Bank tab
(T9: club read = write today, so rewrite it to what is true) and "Print this check" is "on a computer", in
`lib/help-content/accounting.tsx` (`bank-tab`) and `lib/help-content/coaches.tsx` (`premium-money-bank*`). Rows 9, 14, 17,
18 and D4/D5 are **S1b's**, not yours.

**Steps:**
1. **UX summary to the owner first** (AGENCY_RULES, blocking): a short before/after of what a coach and a treasurer read,
   per screen. Point out the two rulings that bend earlier ones (row 3 vs the BC2a word "Check a statement"; row 11 vs the
   cash field's placement) — both are owner-ruled now (A1a, A8), so this is information, not an ask.
2. **`/marketing`** settles each string from the Words tab's Proposed column (its first pass is folded in; this is the
   final read, including `keywords`/`searchText` in both help articles). One spelling everywhere.
3. Build. A4 (the purpose line) and A8 (the cash field behind "Holding cash you haven't deposited?") change layout on
   the coach card — check desk 1440 and phone 390/361. Row 7's "Any day this season, since {date}" and row 25's view-only
   sentence are coach-only. Row 22 keeps "Online payments on their way to your bank".
4. Tests: every word pin in `tests/unit/bank-*.test.ts` that asserts an old string moves to the new one (the 2026-11-08
   run had 434 bank tests passing); `npm run check:spelling`, `lint:focused` on touched files, `typecheck` if a shared
   module's shape changed.
5. A short walk on dev (desk + phone, both portals): first sight, a balance typed, off, saved, the list, a season window.
   `/design` on the changed cards. `/review` (standard) before the commit offer.
6. Record: plan §4 line + this file's top line; TODO line; offer the commit (own hunks only).

## Session B — S1b, the club's start is a statement's opening (A17)

**Scope (plan §2 S1b, §1):** the start card asks "Statement starts on" + "Opening balance", says nothing before that day is
compared with the bank, and on save opens the check form on that same statement (end date empty, cursor in it, one line
saying so, gone at the first save). The start becomes a starting balance dated the day checking starts on every surface
(saved list row + phone card, the start's window + delete words, Find's "since" headings, the look-back heading, the
printed check's starting-point line, refusals `bad_item` / `bad_start_item` / `before_start` / `start_exists` /
`start_after_checks` / `start_has_checks`, the club help article) and rows 9, 14, 17. Row 18 and D5 are gone (no same-day
dead end once the latest start is yesterday). No migration: the start row keeps meaning "the balance at the end of day D";
the card stores the day before the one typed; every screen shows D + 1. Data dictionary note on
`bank_checks.statement_end_date` for a `start` row.

**S1 hand-over (what S1 settled that S1b builds on, `bdb56dd2f`):**
- The check form is "Check your bank balance" + a purpose line (club: "your books") + **Date** (`checkDate`) + one note
  line (`balanceHint` until a balance is typed, `saveOffNote`, `replacesNote(date)`, `draftKept`). Draw the form-after-a-
  start FROM this shipped card (its purpose line and note line exist now), not from D-drawings.
- `statementDate` ("Statement date") and `setupLead` are now used ONLY by the start card — S1b replaces them; delete
  `statementDate` if nothing else reads it after.
- The list is **"Balance checks"**, its column **"Date"**, a window **"The check for {date}"**, **"Check this date
  again"**; empty club list "No balance checks since the starting point yet." — row 14's start cell and the "starting
  point" words are yours to rename with the start's names.
- The club band's middle caption (`bandShouldCaption`) still says "Your books on {date}, less what hasn't reached the
  bank yet" — row 9 is yours ("…since checking started {D+1}, adjusted for…": "adjusted", since an uncashed cheque is
  added). The first tile's caption is now "Bank balance on {date}".
- Refusals S1 reworded (do not undo): `ends_in_future`, `before_season`, `bad_team_item`. Yours: `bad_item`,
  `bad_start_item`, `before_start`, `start_exists`, `start_after_checks`, `start_has_checks`, `no_start`, and
  `bad_figures` / `bad_date` (both still say "statement").
- The early A17 patch predates all of this: expect conflicts in `bank-tab-words.ts`, `BankCheckForm.tsx`, the help
  article and the bank tests (S1 added pins in `bank-r2c-screens-guard` §14 and `bank-coach-view-guard` §9).
- Still uncommitted from ANOTHER session in the same files: the Account pill sub-line (`throughResult`,
  `notCheckedLine` in the words; `throughWords` in `bank-screen.ts`; `BankTab.tsx`) and a permits sentence in
  `accounting.tsx` (~line 703). Commit around them (S1 did it with `.probe/bank-ux-s1/commit.cjs` — temp index, the
  other session's edits put back to HEAD's text, hook run on the index, compare-and-swap).
- The printed check's title/"statement" words are S4's, but the starting-point line on it is yours (§1).

**Steps:**
1. **Redraw** the start card (D4) and the check form as it opens right after a start, as a Claude Artifact at true size
   (desk 1440 and phone 390), drawn from the shipped components and S1's words, NEW / RESTYLED / UNCHANGED tagged.
   **`/design` on it before hand-off.** Owner yes before building (build to approved mockups).
2. **The early build is a head start, not the spec:** `.probe/bank-ux-eval/A17_START_CARD_EARLY_BUILD.patch` (73 hunks,
   16 files, written before S1's words). `git apply --unidiff-zero --check` it first; it will conflict where S1 changed
   the same strings — re-apply the logic hunks (the two date helpers in `lib/bank-check.ts`, `BankSetup`, the form's
   after-start opening, `BankTab`'s state, the D + 1 displays, its tests) and rewrite the word hunks from S1's settled
   words + `/marketing`. Its one judgment call to show the owner in the drawing: no guessed end date after a start.
3. `/marketing` on the start's names (a "starting balance"; "since checking started"; row 14's cell).
4. Tests (the patch adds a date-shift test and a screens guard for every D + 1 display), spelling, dictionary check,
   typecheck (the engine changes), lint. Walk on dev: a start dated the 1st, the form after it, a check of that
   statement, Find off with the look-back, the printed check, delete the start.
5. `/simplify` (a new shared helper), `/review` (high: shared engine + money words), `/docs` if help changed beyond what
   you wrote. Record and offer the commit.

**Not in S1/S1b:** S2's door (the Overview line in every stage, the help link, the address), S3's fee door and quiet list,
S4's method line, S7's save-for-later; any change to how a team starts (a team starts from its season's opening balance).
