**Written 2026-11-09 (rewritten after the owner's rulings and drawing approval the same day). S2 committed `0147063c5`, walk §503 PASSED. S3 RULED and DRAWINGS APPROVED 2026-11-09; BUILT and COMMITTED 2026-11-09 (`568175d16` code, `563bbb695` mig 457, dev applied), record in the plan §4; dev walk + Save measurement, /simplify, /review owed — next: `BANK_CHECK_NOVICE_UX_S3_FINISH_PROMPT.md`.**

# Bank check through a volunteer's eyes — S3 (Find's doors and its quiet list) — build prompt, one session

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S3_BUILD_PROMPT.md` into a new chat on `dev`.**
> Plan of record: `BANK_CHECK_NOVICE_UX_PLAN.md` (§0 A5, A7, A13; §2 S3 and its "Ruled 2026-11-09" bullet; §4 record).
> **The approved drawing is the spec:** `docs/projects/active/BANK_CHECK_NOVICE_UX_S3_DRAWINGS.html`, published at
> https://claude.ai/artifact/9EAmporN7VP8J7Q7Eqj6Kj (6 tabs, After/Today switch, every piece tagged NEW/RESTYLED/UNCHANGED
> with a note). Build to it (auto-memory `feedback_build_to_approved_mockups`); a difference you find necessary goes back
> to the owner, not into the code silently.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`). This repo's shell drops backslashes in heredocs and a backtick
> inside `node -e` EXECUTES: write edit scripts with the Write tool, or use Edit. A migration, new files or shared-module
> changes mean a dev-server restart before the owner looks (AGENTS.md; say so first, other sessions use the same server).

## What is already decided (do not re-ask)

**Step-1 rulings, owner 2026-11-09 ("agree with the recommendations"):**
1. **Coach words: reuse** the platform library's `League & Fees › Bank & payment fees` (scope `team`, money out, default)
   and `Other Income › Interest` (scope `team`, money in, not default). No coach migration, no new "Bank fees" word.
2. **Club: add a fee word and an interest word for every club** in one migration. Verified on dev 2026-11-09 (report-only
   query of platform rows `org_id IS NULL AND team_id IS NULL`): the club's picker (`scope=org&forPlanning=1`, keeps
   `org`/`both`) has neither, and no club has made its own. Fee: **`Admin › Bank & payment fees`** (money out, default,
   all sports) under the existing platform `org` heading `Admin`. Interest: shape decided with `/dba`; the drawing shows
   **`Other Income · Interest`**, which the simplest route gives by widening the platform `Other Income` heading from
   `team` to `both` (the coach side is untouched: coaches see `team`+`both`). Check what that does to the club's Budget
   page, the categories panel and reports before choosing it (it also brings Rebate, Donation, Other income into the
   club's picker); the alternative is a new `org` heading holding only Interest. Same unit of work: `DATA_DICTIONARY.md`,
   `npm run refresh:snapshots`, `/dba`, `MANUAL_PROD_STEPS.json` if it is data-only. It reaches every club at once.
   **Take the next free migration number at the time of writing** (455 was taken 2026-11-09; other sessions add more).
3. **No "Record a deposit" door.** Money in shows **Record interest** beside today's **Record the missing amount**.
4. **Fee and interest doors only for a gap of $100.00 or less** (`band.offByCents <= 10000`, both directions). Above it,
   the box shows today's single door.
5. **Fee/interest doors only when NOTHING explains the gap** (the `off && !current` case). The exact, combo, half and
   (club) at-start callouts keep exactly today's buttons. **This narrows the earlier draft of this prompt, which said
   "the nothing-explains and exact/combo cases" — do not build the wider version.**
6. **Coach budget note:** when Record money was opened from a fee/interest door, the amber `fieldWarning` "{word} isn't
   in your budget — it will show on Budget vs. Actual as spending/income you didn't plan for." is replaced by a plain grey
   hint (drawn: *"Not in your budget yet, so it shows as off-plan on Budget vs. Actual."*, words final after /marketing).
   Every other opener keeps today's warning. The club's `filedUnderHint` ("Not on the {year} plan, so it counts as
   off-plan.") already reads plainly and is UNCHANGED.
7. **The doors are buttons in the shipped amber callout**, replacing today's sentence-plus-link in the `!current` branch.
8. **The repeat line (A7) keeps both doors.** (The /accounting read suggested no recording door on a repeat; the owner
   kept them: a repeated gap is either the same missing item or this month's fee again.)

**Defaults kept:** the prefill sets no tax (most bank charges are exempt, but the same word also catches card-processor
fees, which are not; the window's tax stays as today); status Posted (a Pending line would stay out of the check); the
date stays editable. **Not in S3** (later ideas, recorded in the plan): a duplicate-fee warning; marking lines created
from a bank check.

**Drawing asks, owner 2026-11-09 ("I agree with the recommendations"):**
- **D1** Desk rows: unnamed rows show "Not in the bank yet" as the quiet underlined link at rest (the phone's recipe,
  `LineAction quiet`); the row the callout names keeps its bordered button. Both portals.
- **D2** The repeat line names the last check's date: *"The same $4.50 as your last check, on Oct 31, 2026."*
- **D3** The banking-app line sits in the window's **pinned footer, above Cancel/Save**, on desk and phone (the club's
  Add an entry already fills a 1440 × 900 screen; a line at the end of the body would sit below the fold). Fee: *"Check
  your banking app first: was this a bank fee? Use the date it shows."*; interest: *"…was this interest? Use the date it
  shows."*
- **D4** The coach's phone callout stacks its buttons full width like the club's: copy the club's
  `@media (max-width: 768px)` rule (`Bank.module.css` ~305–306: `.calloutActs { display:flex; flex-direction:column;
  align-items:stretch; flex:1 1 100% }` + full-width buttons, 44px via `--tap-min`) into `CoachBank.module.css`. This
  also changes the coach's EXISTING matching-line callout on a phone; that is intended.

## The words (drafts from the drawing; `/marketing` has the final read in step 1)
| Where | Coach | Club |
|---|---|---|
| Fee door | Record a bank fee | Add a bank fee |
| Interest door | Record interest | Add interest |
| Today's door (unchanged) | Record the missing amount | Add the missing entry |
| Collapsed list (row 24) | No line matches {$x} on its own. **Show the {n} lines** to mark any the bank hasn’t received yet. | same |
| Its opened state | …**Hide the {n} lines**… (or "Hide them": /marketing) | same |
| Repeat (A7, D2) | The same **{$x}** as your last check, on {Mon D, YYYY}. | same |
| Banking-app line (D3) | Check your banking app first: was this a bank fee? Use the date it shows. (interest: was this interest?) | same |
| Coach budget note (ruling 6) | Not in your budget yet, so it shows as off-plan on Budget vs. Actual. | (club unchanged) |
| Prefilled description | Bank fee / Bank interest | Bank fee / Bank interest |
`{n}` = the lines the list would show (coach: this season's since-lines + last season's; club: since-lines + on-the-way +
before-start). With `n = 0` the collapsed line drops away entirely. One spelling: "Not in the bank yet" etc. already exist.

## The code (survey 2026-11-09; **re-verify the line numbers, they drift**)
- **Find, both portals:** coach `components/coaches/bank/CoachBankFind.tsx`, club
  `components/admin/kit/club/money/bank/BankFind.tsx` (mounted from `CoachBankCheck.tsx` / `BankCheckForm.tsx`). Words:
  `lib/bank-tab-words.ts` (`BANK_WORDS`: `recordMissingAmount` ~190, `addMissingEntry` ~192, `showThem`/`hideThem`
  ~128, `noLinesMatch` ~152, `notInBankYet` ~166, `hintOrMore/Less` ~136, `coachHintOrMore/Less` ~142).
- **The list:** `const listOpen = off || open` (CoachBankFind ~98, BankFind ~118). New: open on its own only when
  `off && current`; when `off && !current` it is closed until the new link opens it (reuse the `open` state). The
  `!current` branch (CoachBankFind ~153–158, BankFind ~211–216) is where the callout + doors + collapsed line go. The
  club callout is the kit `Callout tone="warn"` with `btn btn-outline` buttons (BankFind ~269–284); the coach's is
  `b.callout` + `styles.btnSecondary` (CoachBankFind ~224–238). Reuse each portal's own callout, not a new component.
- **Desk rows (D1):** coach `LineAction` (~271) renders `b.markBtn` (+`markShown` when hinted); `.markBtn` is `opacity:0`
  until row hover/focus (`CoachBank.module.css` ~206–226). Use the `quiet` link for unhinted desk rows too. Club: the same
  in `BankFind`/`Bank.module.css` (~232–251, 278). Both CSS files are regex-pinned by tests (below).
- **Prefill, coach (the risky part):** `CoachBankCheck.tsx` ~389 calls `onAddLine({direction, amount, date})`
  (`MissingLine`); `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx` ~7577 turns it into a Record
  money intent (`other-in` + `receivedDate`, or `spend` + `paidDate`); `RecordMoneyIntent.prefill` (`lib/coach-record-money.tsx`
  ~83–170) is `{receivedDate?, method?, note?, paidDate?}`; `openConversationFrom` (panel ~2043–2110) applies it. ⚠ **No
  word or description can be prefilled today.** Add OPTIONAL fields (e.g. `description?`, a word reference, a
  `fromBankDoor?` flag for ruling 6) so every other opener is unchanged. ⚠ The comment at panel ~2087 warns the
  `categories` list is usually still empty when the intent applies: resolve the word LATE (when the list arrives), by the
  platform item (prefer its id or the category+item name pair over a bare name; `Interest` and `Other income` names exist
  in more than one place). If the team can't see the item (removed/hidden), open with the description only and no word
  (never invent one). The picker: `BudgetItemPicker` (panel ~6194–6290; state `budgetCategoryId`, `budgetItemId`,
  `budgetItemName`, `category`, `description`; label "What did this pay for? *" for spend, "What is this? *" for money
  in). A typed description survives a later pick (`isItemLabel`, ~1568). The warning is `fieldWarning(...)` at ~6288.
  The footer line (D3) goes in the window's pinned footer: find the shared dialog footer the Record money window uses and
  add an optional slot, don't fork the window.
- **Prefill, club:** `BankCheckForm.tsx` state `adding` (~125, set ~299 and ~367), rendered
  `<AddEntryWindow prefill={adding} words={words}>`; `components/admin/kit/club/money/LedgerWindows.tsx` `AddEntryWindow`
  (~255) prefill is `{entryType?, date?, amount?}`. Grow it with optional `description?` and a word (resolved against
  `useBudgetWords`, ~85–97, which loads lazily: resolve when the list arrives) and the footer line. Save refuses an empty
  description and needs `word.itemId`; changing Money in/out resets the word (keep that).
- **A7:** the view carries saved `checks` (newest first) with a signed `figure.differenceCents` (`lib/bank-check.ts`
  ~144–166, `figureOfSaved`; club `lib/bank-club-rules.ts` `checkView`). **Verify the coach view carries them too** before
  relying on it. Compare the newest `kind==='check'` dated BEFORE the form's date (same date is replaced on save) with the
  live band's signed difference; equal and non-zero → the line. Never a start row. Coach checks are the working season's
  only.
- **The bank screen still never writes a book line:** the `/entries` guard in `bank-r2c-screens-guard` must stay true.

## Help (step 5)
Club article `bank-tab` (`lib/help-content/accounting.tsx` ~281, section `bank-tab-find` ~332–346, "Add the missing entry"
bullet ~341); coach article `premium-money-bank` (`lib/help-content/coaches.tsx` ~3034; "Record the missing amount" bullet
~3091; `searchText`/keywords ~3038). Add the fee/interest doors, the $100 rule in plain words, the collapsed list and the
repeat line. Words, `keywords` and `searchText` together.

## Steps
1. **`/marketing` on the words table above** (final read; it may change the drafts, the drawing then is updated with the
   same file path and republished) and on the help changes. `npm run check:spelling`.
2. **`/dba` on the club words** (ruling 2): choose the interest shape, write the migration, apply to dev, dictionary +
   snapshots. Report-only queries before and after (the club's `scope=org&forPlanning=1` list gains exactly the two words;
   the coach list is unchanged).
3. **Build** (a) the doors + prefill both portals, (b) the quiet list + desk rows + the coach phone callout rule (D4),
   (c) the repeat line. Optional fields only.
4. **Tests.** Update the pins on the old shapes: `bank-r2c-screens-guard` (the exact `setAdding({ entryType… amount:
   fieldAmount(band.offByCents) …})` text, the `prefill?.…` regexes on LedgerWindows, the markBtn CSS regexes),
   `bank-coach-view-guard` (the exact `onAddLine={…openConversationFrom(line.direction === 'in'…` text and the two intent
   literals), `bank-check-draft` (the `recordMissingAmount`/`addMissingEntry`/`hintOrMore`/`hintOrLess` strings and
   **"`{W.recordMissingAmount}` appears exactly twice in CoachBankFind"**). Add pins: fee/interest doors only in the
   `!current` branch and only at ≤ 10000 cents; never a deposit door; the list closed only when `off && !current`; A7
   compares SIGNED gaps and skips the same date and start rows; the prefilled windows carry the word, the description and
   the footer line; ruling 6's note only with the bank-door flag; the bank screen writes no line. `npm run typecheck`
   (shared modules), the bank + room-key + help guards, `verify:changed`.
5. **`/accounting` review before handing off** (CLAUDE.md, required): run it on the BUILT change (a prefilled expense
   under a default item, Off-plan until budgeted, interest as money in, no tax set, Posted). Note: CLAUDE.md scopes that
   agent to FieldLogicHQ's own books; the 2026-11-09 read was a principles review of customer bookkeeping, and that is
   what to ask for again. Apply findings or record them as owner questions.
6. **Walk on dev, desk + phone, both portals**, with a probe that asserts it is on its own team/account before every
   write: a $4.50 fee gap (doors, collapsed list, "Show the n lines" opens it, the fee window filled, save, the check then
   matches); a $0.85 interest gap; a $350 gap (one door); a gap a line explains (list open, no fee door, desk rows show the
   quiet link); a half-line gap; a repeat of the last check's gap (line + date), a same-date resave (no line), an
   equal-but-opposite gap (no line); a read-only coach (no doors); a coach team that removed Bank & payment fees (window
   opens without a word). `check:layout --changed` on the Bank view and the two windows. **Then measure** Save's distance
   on a 390 phone with Find open and the list collapsed, and report it: it decides S5 (A9).
7. `/simplify` (the prefill grows a shared shape); **`/review` (standard)**; `/docs` for the two help articles. `/legal`:
   nothing collected, emailed or promised, so no pass.
8. **Record:** plan §4 line + this file's top line; the TODO line (S3 built/committed, walk owed); offer the commit (own
   hunks only; the migration may want its own commit); write the owner's walk (one purpose, a checkable Artifact, a § in
   the Owner QA Ledger; fixture torn down after); update auto-memory `project_bank_check_novice_ux_evaluation.md`; the
   migration's prod apply is owed with the next promote (release-history record, not here).

**Risk: medium.** The coach Record money prefill (the late-resolution trap), a platform-wide data change for clubs, and
three tests that pin exact text. Nothing here may make the bank screen write a book line.
