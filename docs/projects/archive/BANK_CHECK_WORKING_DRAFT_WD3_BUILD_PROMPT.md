# Build prompt — Bank check: work it down to zero, WD3 (words, help, the two owner walks)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-07 after WD2 was committed (`47bd64918`, hash record
> `1a3af11c5`). Plan of record: `docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md` (§2, §3.1, §4 WD3, **§4b words**, §7 the
> WD1 build record, **§8 the WD2 build record**). This is the last stage. No product behavior changes here: words, help, walks.

---

Bank check: work it down to zero — **WD3, words + help + the two owner walks.**

## Read first, in this order

1. The plan: §2 (what the owner sees), §3.1 (the draft rules, incl. "Start over clears it" for a shared computer), §4b (the
   settled words and the open items), §7 and §8 (what was built, the calls made, what was left as built).
2. The words file `lib/bank-tab-words.ts` (both portals share it): the WD1/WD2 block (`record`, `recordMissingAmount`, `addEntry`,
   `addMissingEntry`, `draftPickedUp(On)`, `startOver`, `startedOffBy`, `draftKept`, `draftDropped`) and the shared Find hint words
   (`hintOrMore` / `hintOrLess`, the "…you haven't entered" sentence). ⚠ This file carries other sessions' uncommitted hunks.
3. The two help articles: the club's Bank tab article in `lib/help-content/accounting.tsx` (its `searchText` ~line 285 and the
   "Add the missing line" bullet ~line 339) and the coach's Bank view article in `lib/help-content/coaches.tsx` (~3038 and ~3091).
   Both still name the retired link. The hub arrays are in the `help/page.tsx` shells.
4. The walk conventions: auto-memory `feedback_qa_walkthroughs_as_checkable_artifacts.md` (checkable Artifact, paste-back, ONE
   PURPOSE PER WALK) and the Owner QA Ledger `docs/projects/active/OWNER_QA_LEDGER.md` (never sort the § numbers; take the next free
   ones at the time, another session may have taken one).

Broad reading goes to a helper agent (CLAUDE.md). Check a helper's claims against the code before building on them.

## First: the owner's open call (ask before any words change; plan §4b open items)

The shared Find hint says "a deposit or interest you haven't **entered**", and the coach now reads it beside "+ Record".
**Recommendation: give the coach card its own verb, "…you haven't recorded"**, as coach-only keys beside the shared ones (the club
keeps "entered", its Ledger's word). Ask once, with that recommendation; build what is ruled. If yes: the coach's Find reads the new
keys, a test pins both portals' sentences, nothing else moves.

## What this session changes

- **Words (`/marketing`).** One pass on the WD sentences in both portals, as they now render: the restore line, Start over, "Started
  off by", the resting sentence (short form; the long form only if the pass recommends it), the dropped-mark callout, "+ Add entry" /
  "+ Record", "Add the missing entry" / "Record the missing amount". Settled strings stay unless the pass finds a real defect; any
  change goes through the words file and moves its test pins (`tests/unit/bank-check-draft.test.ts` §11) with the code, never loosened.
  The three-nouns note (line / item / entry, §4b) is reported, not widened.
- **Help (`/docs`).** Each portal's bank article gains a short **"Work it down to zero"** part, in that portal's words: the card keeps
  your work in this browser until you save (it won't follow you to another device); "Started off by"; the "+ Add entry" / "+ Record"
  button; coming back to the tab reads the books again; **Start over clears it** (a shared computer); signing out clears it too. Fix
  the stale "Add the missing line" in both (club → "Add the missing entry", coach → "Record the missing amount"), including
  `searchText` / keywords (the spelling gate reads them).
- **Stale comments** naming the old link (WD2's /review list): `lib/bank-screen.ts:17`, `components/admin/kit/club/money/LedgerWindows.tsx:83`
  and `:256`, `lib/bank-club-steps.ts:100` and `:118`. Comment-only; skip any file holding another session's uncommitted hunk and say so.
  The data dictionary line (~9156) is prose about a column's meaning: leave it unless it misstates one.
- **Two owner walks, one purpose each**, as checkable Artifacts entered in the Owner QA Ledger:
  1. **Club card (WD1, still owed):** type a balance, mark a line, go to the Ledger and book a cheque, come back (picked up, "Off by"
     moved, "Started off by" shown), "+ Add entry" from the card, a line deleted in another tab drops with the amber note, Save clears
     it, Start over; phone width.
  2. **Coach card (WD2):** type a balance and some cash, mark a line, go to the Roster, come back (as left), "+ Record" and book a line,
     "Off by" falls to Matches, Save; cash alone is kept; a money-read assistant sees no form; phone width.
  Before listing a setup step as owed, check the records (auto-memory `feedback_check_records_before_listing_owner_steps.md`): name
  the dev club, account and team the walk uses, and that they exist.

## Boundaries

- **No behavior change.** No new control, no new rule, no route, no migration, no dictionary change. The shared draft hook (§8's
  /simplify follow-up) is **not** this session: it waits for both walks.
- Help keeps the season rule (coaches) and the fiscal-year words (club side only); "season" for coaches (AGENCY_RULES spelling).
- `/legal`: none (plan §3.1; WD2's review agreed). `/accounting`: none (customer bookkeeping is product work).

## Tests and checks

`node --import ./tests/ts-resolver.mjs --test tests/unit/bank-*.test.ts`, `npm run check:spelling`, `npm run lint:focused -- <the
files>`, any help-content tests the `/docs` agent names, and a typecheck with `NODE_OPTIONS=--max-old-space-size=8192` if the words
file changed (exclude `.next` with a temp tsconfig if the dev server's generated types block it; the WD2 one is
`.probe/tsconfig.wd2.json`). Other sessions' known failures are theirs: report, do not fix (at WD2: one GST/HST words guard).

## Finish

`/simplify` is not needed (no new abstraction); `/review` only if the words file or a component changed. Update the plan (status
line: WD3 and the project's state; a short §9 build record), the PM brief's status, and the TODO line (on the owner's walks passing,
mark it done and move it to `docs/projects/archive/TODO_COMPLETED_ARCHIVE.md`; the plan pair moves to `docs/projects/archive/` only
once both walks pass). **Commit only after the owner's yes, explicit pathspecs only**; `lib/bank-tab-words.ts`, `TODO.md` and the help
files may carry other sessions' hunks: build it as a partial commit (auto-memory `reference_partial_commit_shared_tree.md`;
`.probe/wd2-commit/commit.cjs` is the working template: temp index on the recorded HEAD, exact edits, hook, `commit-tree`, compare-and-swap).
