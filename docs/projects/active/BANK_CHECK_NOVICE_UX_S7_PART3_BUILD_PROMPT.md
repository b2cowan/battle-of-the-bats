**Written 2026-11-22, after S7 Part 2 was committed (`6a037f582`). Part 1 is `96e2135ea` (the stored record) and
`e5dc36ad1` (the nightly sweep). Part 3 is not built.**

# Bank check through a volunteer's eyes — S7 Part 3 (help, the review, the two walks) — build prompt

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S7_PART3_BUILD_PROMPT.md` into a new chat on `dev`.**
> Plan of record: `BANK_CHECK_NOVICE_UX_PLAN.md` — **§0 A18 and its nine rulings (2026-11-22)** and §2 S7 (its "Part 1" and
> "Part 2" bullets say what is built). The rulings summary is in `BANK_CHECK_NOVICE_UX_S7_BUILD_PROMPT.md` ("What is already
> decided"). Spec: the drawing https://claude.ai/artifact/9hVJGaufeWfuG8mBjp1Meh (source
> `docs/projects/active/BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html`). Where this prompt and the plan differ, the plan wins; where
> the plan and the CODE differ, the code wins — say so out loud.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`: temp index from HEAD, shared files = HEAD + your exact edits,
> a HEAD guard in the same command as the commit, then `git reset -q -- <your paths>` in the main index). The help files,
> `docs/projects/active/OWNER_QA_LEDGER.md`, the board JSON and `lib/bank-tab-words.ts` may carry other sessions' hunks.
> Write edit scripts with the Write tool (heredocs drop backslashes; a backtick in `node -e` executes).
> **Stop when the two walks are published and recorded; let the owner walk them and report.**

## What Part 3 delivers, in product-owner words

The help says what the card now does (the work follows the person to any device for 30 days, it is theirs alone, a
colleague sees only that it exists), one adversarial review covers the whole S7 change, and the owner gets two short
checkable walks, one per portal, that replace the two browser-era walks (§490 club, §491 coach). After he passes them,
saving a check to finish later is ready for the next release: its three database steps (522, 523, 524) are already on
production.

## What Parts 1 and 2 built (read the code, don't re-derive it)

- **The card, both portals** (`components/admin/kit/club/money/bank/BankCheckForm.tsx`,
  `components/coaches/bank/CoachBankCheck.tsx`): before Start (fields + "Start checking this statement", nothing kept) →
  working (the strip "Checking {date} · Change", the coach's cash in it when typed; the foot: notes, Start over, Save for
  later, Save this check; on a phone the foot stacks, Save this check first) → Change (fields in place, Use these / Keep
  {date}, the amber line when a new date would clear marked lines; the work greyed and inert). Found again on any device
  ("Picked up where you left off"), the last 7 days in amber, a colleague's quiet line, "Updated from another device…",
  the club Account pill's olive second line at 2+ accounts.
- **One hook** `lib/hooks/useBankCheckWork.ts` (read on mount, kept as you go after a 600 ms pause, compare-and-swap,
  `keepalive` on leaving, `work_changed` re-reads, a failed keep shows in place of the resting sentence).
- **A "No" to "Still waiting?" is kept with the work** (owner ruling 2026-11-22; `answered_no_keys`, mig 524, keys only,
  cleared by a new date). This changes §491's recorded finding: the question is no longer asked again.
- **Sign-out no longer clears the work** (it follows the person); it only deletes the old browser copies.
- **Words** settled with `/marketing` 2026-11-22: the S7 block in `lib/bank-tab-words.ts` (`workKept`, `savedForLater`,
  `changeClears`, `startOverAsk`, `colleagueWho`/`colleagueWork`, `workEndsSoon`, `workElsewhere`, …). Use them in help
  verbatim, never paraphrased.
- **Proof scripts** (dev only): `.probe/bank-ux-s7/work-routes.mjs` (the routes, 31 checks) and
  `.probe/bank-ux-s7/cards.mjs` (both cards in a real browser at 1440 and 390). Dev asks each test login to accept the
  republished Terms once; `cards.mjs` ticks through it.

## Steps

1. **`/docs` — both help articles, in one pass.** `lib/help-content/accounting.tsx` (~321 searchText, ~393–400 "What it
   keeps" and the "On a shared computer, press Start over" note) and `lib/help-content/coaches.tsx` (~3090 searchText,
   ~3159–3167). Both are now false: they say "this browser only", that signing out clears the work, and 14 days. Rewrite
   to what the card does: Start, then kept as you go on any device you sign in on, until the check is saved; 30 days from
   the last change, Save for later names the end date and the last 7 days say it again; Change and what a new date does to
   marks; Start over asks when lines are marked; a "No" to "Still waiting?" is remembered; a colleague who can check the same
   account sees who has which date saved for later, never the figures; sign-out no longer clears it (so the shared-computer
   note becomes "press Start over if you don't want to keep it", or goes — `/docs` decides with the owner's rulings).
   `keywords` and `searchText` follow ("kept in this browser", "shared computer", "sign out" go or change). The one-spelling
   gate (`npm run check:spelling`). Coach words say Ledger and Record; club words say books and entry.
2. **`/review` on the whole S7 change**: `96e2135ea`, `e5dc36ad1`, `6a037f582` and Part 3's own diff. Apply what it
   confirms; anything it finds in shared automation is a finding to report, not to change (AGENCY_RULES).
3. **The two walks** — checkable Artifacts (auto-memory `feedback_qa_walkthroughs_as_checkable_artifacts`,
   `feedback_walks_concise_one_action_per_step`, `feedback_walks_name_exact_logins`): one purpose per walk, 20–50 boxes, one
   action a step, every login named with its email AND password (read them from `.env.local`: `UAT_REP_CLUB_TREASURER_*`,
   `UAT_REP_CLUB_OWNER_*`, `UAT_COACH_*`, and a second money-write coach on "UAT Test Team" for the colleague line — set it
   up on dev and tear it down after he reports). Say up front that each login may meet the Terms screen once on dev.
   - **Club (replaces §490):** Start on a statement → mark a line and answer one "Still waiting?" No → Save for later (the
     notice's end date) → a second browser profile or the phone, same person: found again, the No not asked again → Change
     a new date (the amber line) and back out → the owner signs in: one quiet line, no figures → Start over asks → Save this
     check takes the work → the Account pill's line at 2+ accounts (create the second account on dev if the walk club has
     one only, and remove it after).
   - **Coach (replaces §491):** Start with cash typed (the strip shows it) → mark, leave for the Roster, come back → the
     phone: found again → Change the cash only (marks stay) → "+ Record" a bank fee → Save this check; a money-read
     assistant still sees no card; the second money-write coach sees the quiet line.
   - Before writing, **grep every walk** in the ledger and in published walk artifacts for the browser-era behaviour
     ("this browser", "sign out clears", "14 days") and list any other walk it invalidates. New ledger §s go at the END,
     next free numbers (never re-sort); mark §490 and §491 as replaced by them, with the reason. Publish with the Artifact
     tool; `/design` on the walk page is not needed (no drawing), but re-read the prompt file before publishing (auto-memory
     `reference_reread_prompt_before_publish`).
4. **`/legal`, a one-line confirmation only:** the general "work you save for later" privacy row (owner ruling 2026-11-22)
   is carried into the next policy draft. Migration 523 is now on production, so its 30-day sentence can go in; confirm the
   "No" answers (keys only, same row) need nothing more. No customer-facing change in this session.
5. **Verify:** the bank suites (`node --import ./tests/ts-resolver.mjs --test "tests/unit/bank-*.test.ts"`, 552 on
   2026-11-22), typecheck (`NODE_OPTIONS=--max-old-space-size=7000 npx tsc --noEmit`), `npm run verify:changed` (on
   2026-11-22 the suite had 33 failures, none in a bank file and none naming one; and its lint step crashed loading the
   react-hooks plugin — run `npx eslint <files>` directly and report the crash, don't change the script),
   `check:layout --only=coach-ledger-bank,admin-accounting-bank` (never the whole sweep on the dev server), and re-run
   `.probe/bank-ux-s7/cards.mjs`. Restart the dev server before hand-off if files were added.
6. **Record** in the same commit as the work, when the owner says commit: plan §2 S7 a "Part 3" bullet, the board line
   (`bank-check`: stage, next, remains; the walks' §s in its youOwe until he passes them).

## Not in Part 3

The release itself (`/release`, sequenced by dependency: S7 needs no further database step); S5 (stays parked); the
Overview's bank line (unchanged by ruling 8).

## Don't

- Don't add release timing to anything; sequence by dependency.
- Don't edit shared automation, hooks or settings.
- Don't read production rows (counts and schema only); a question needing a person's row is answered on dev.
- Don't commit or push without the owner's word.
