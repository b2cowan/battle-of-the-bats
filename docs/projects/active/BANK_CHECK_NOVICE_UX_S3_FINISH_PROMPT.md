**DONE 2026-11-09, the same day: steps 1–8 run and recorded in the plan §4 S3 entry. S3 code `568175d16`, mig 457 `563bbb695` (dev applied, prod pending), record `cfaf3b97b`. Owed: the owner's walk (Owner QA Ledger §505, https://claude.ai/artifact/UxVWFqJ5njVwCiypSjBufM), then tearing its fixture down (`.probe/bank-ux-s3/owner/teardown.mjs`), and the commit of the review's fixes (working tree).**

# Bank check through a volunteer's eyes — S3 finish (review, walk, measure, hand to the owner) — one session

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S3_FINISH_PROMPT.md` into a new chat on `dev`.**
> What was built and why: the plan `BANK_CHECK_NOVICE_UX_PLAN.md` §4 (the 2026-11-09 S3 entry) and
> `BANK_CHECK_NOVICE_UX_S3_BUILD_PROMPT.md` (rulings 1–8, D1–D4). The approved drawing is the spec:
> https://claude.ai/artifact/9EAmporN7VP8J7Q7Eqj6Kj (source `BANK_CHECK_NOVICE_UX_S3_DRAWINGS.html`). A difference you find
> necessary goes back to the owner, not into the code silently.
>
> Other sessions share this working copy and several of S3's files carry their uncommitted work (`lib/bank-tab-words.ts`,
> `Bank.module.css`, `bank-r2c-screens-guard.test.ts`, `lib/help-content/coaches.tsx`, `TODO.md`, and more as they go).
> Commit only your own hunks, only when the owner says, from a temp index with the HEAD guard (auto-memory
> `reference_partial_commit_shared_tree`; `.probe/s3-commit/partial.cjs` is last session's hunk picker — re-check its hunk
> indices, they move). Write edit scripts with the Write tool or use Edit: this shell drops backslashes in heredocs and a
> backtick inside `node -e` executes.

## What S3 changed (so you know what to look at)
- **Find, both portals:** when nothing explains a gap of $100.00 or less, the amber callout offers a fee door (bank less)
  or an interest door (bank more) beside today's gap door; the list folds behind "No line matches $X on its own. Show the
  n lines"; desk rows say "Not in the bank yet" as the quiet link at rest; "The same $X as your last check, on {date}."
  when the SIGNED gap equals the newest earlier saved check's; the coach phone callout stacks its buttons.
- **The windows:** coach Record money and club Add an entry open filled (gap, date, "Bank fee"/"Bank interest", the
  platform word found by NAME among platform rows); the banking-app line sits in the window foot's new `footerAbove`
  slot (shared `KitDialog` + `QuestionShell`); the coach's off-plan note is grey only when opened from a door.
- **Rules:** `lib/bank-gap-doors.ts`. **Pins:** `tests/unit/bank-gap-doors.test.ts` plus moved pins in
  `bank-coach-view-guard`, `bank-r2c-screens-guard`, `bank-check-draft`.
- **Mig 457 (data only):** platform `Admin › Bank & payment fees` (org) and platform `Other Income` widened `team → both`
  (clubs also gain Rebate, Donation, Other income — the owner has been told; reversible by a new migration if he asks).

## Steps
1. **Dev server.** S3 added files and changed shared modules, so the dev server needs a restart before anyone looks.
   Other sessions use the same server: **say so to the owner first and restart only on his yes** (AGENTS.md sequence:
   stop, clear `.next`, `npm run dev` with network access, check the platform-admin login page answers 200).
2. **`/simplify`** on S3's two commits (`git diff 06c0c4625..568175d16`, S3's files only). Places worth a look: the two
   render-phase word adjustments (coach panel, club `AddEntryWindow`) — one shared hook or not; `doorFill` /
   `doorFootLine` vs the club form's spread; the two Finds' near-identical quiet branch. Keep both portals' own callout
   components (the build prompt's rule).
3. **`/review` (standard)** on the same diff, after `/simplify`. Known risks to point it at: the coach word resolving late
   (form opened before the team's word list lands; a team that can't see the word; a branch switch after the word was
   chosen); a click event passed as a `door` argument (every no-argument call is wrapped and pinned); `footerAbove` in
   every KitDialog caller (it is optional, nothing else passes it); the club's `listCount` (the on-the-way row counts as
   one). Apply findings or record them as owner questions.
4. **Walk on dev, desk 1440 and phone 390, both portals,** with a probe that asserts it is on ITS OWN fixture team/account
   before every write (auto-memory: write-probes assert their account before each save; probes live in `.probe/`). Cases:
   a $4.50 fee gap (both doors, the folded list, "Show the 31 lines" opens it and reads "Hide the 31 lines." with the
   trailing words gone, the fee window filled with word + description + amount + date + the foot line, save, the check
   then matches); a $0.85 interest gap (interest door, Other money in / Money in, Other Income · Interest); a $350 gap (one
   door); a gap one line explains (list open by itself, no fee door, desk rows show the quiet link, the named row keeps
   its bordered button); a half-a-line gap (unchanged callout); one line only ("Show the line"); a repeat of the last
   check's gap (the line and its date), a same-date resave (no line), an equal-but-opposite gap (no line); a read-only
   coach (no doors at all, the sentence alone); a coach team that cannot see Bank & payment fees (find how a team hides a
   platform word first; the window must open with the description and NO word, never an invented one); the coach window
   opened before the word list has loaded (fresh page load, press the door at once: the word still arrives). Confirm the
   bank screen itself writes no book line (only the window's own Save does). Tear the fixture down after.
5. **`npm run check:layout -- --changed`** on the Bank view (both portals) and the two windows — the dev server only
   for the changed screens (AGENTS.md memory rule).
6. **Measure Save's distance** on a 390 phone with Find open and the list folded, both portals, and report it in plain
   numbers (the evaluation measured ~2,900px before S3). It decides S5 (plan A9: a second Save under the band); give
   the owner a recommendation, not just the figure.
7. **Write the owner's walk:** one purpose (S3), a checkable Artifact with paste-back (auto-memory
   `feedback_qa_walkthroughs_as_checkable_artifacts`), a new § in `docs/projects/active/OWNER_QA_LEDGER.md` (take the next
   free number at the time of writing; never re-sort), its own fixture (set up by a script, torn down after the owner
   reports). Put the five owner questions below in it as choices, so the walk also rules them.
8. **Record:** the plan §4 S3 entry (simplify/review outcome, the walk §, the measurement, the S5 recommendation), this
   file's top line, the TODO line, auto-memory `project_bank_check_novice_ux_evaluation.md`. Offer the commit (own hunks
   only). Mig 457's prod apply rides with the next promote (release-history record, not here).

## Owner questions to carry into the walk (from the 2026-11-09 bookkeeping review; NOT applied — the owner approved the copy)
- (a) Add "If both a fee and interest posted, record them as two lines." to the window's foot line?
- (b) "Use the date the bank posted it" in place of "Use the date it shows"?
- (c) The repeat line adds "If you recorded it then, this may be a new charge."?
- (d) A "Tax: none set" hint on the fee window for clubs registered for GST/HST (card-processor fees are taxable)?
- (e) The coach's fee word stays under League & Fees (ruling 1, reuse), or a professional's admin heading later?
Each needs `/marketing` if ruled yes; (d) is also `/accounting`-adjacent (it is customer bookkeeping, so a principles
read, as the 2026-11-09 one was).

## Known, not S3's (do not chase; mention if still true)
- `kit-dialog-floor-guard` "the tournament preview is the public page down to its ground" fails on the base commit
  (another session's admin chrome work).
- The full suite had 15 failures on 2026-11-09, all in other sessions' files (sign-up, billing, practice plans, plus-tax
  phrase in their coach-help hunks).
- `check-schema-parity` reports bank-check tables that exist on PROD only (`bank_check_added_lines`, `bank_check_changes`,
  `bank_check_events`, `bank_check_marks`, `bank_line_exclusions`, `bank_saved_lines`). Not from S3 (mig 457 is data
  only). Report it to the owner as a finding (a check means report, not fix).

**Risk: low to medium.** The code is committed and guarded; the risk is in what only a browser shows (the late word,
the foot line's height on a phone sheet, the 44px tap boxes inside a sentence).
