# Finish prompt — Bank check working draft, WD1: /simplify, /review, commit

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-07 after WD1 was built (plan §7 holds the build
> record). The owner asked for this prompt to simplify, review and commit: **running it is his yes to commit WD1**, once
> the review's findings are applied or reported. A must-fix that changes what the treasurer sees goes back to him first.

---

Bank check: work it down to zero — **finish WD1** (club desk + phone): `/simplify`, then `/review`, then commit.

## Read first

1. `docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md` §1, §3, §4b and **§7 (the build record and the two calls made in
   the build)**. Those two calls are said to the owner; do not "fix" them back to the literal ruling without asking.
2. The WD1 diff: `git diff` on the files below, and the two new files in full.

## The WD1 files (this session's, and only these)

New: `lib/bank-check-draft.ts`, `tests/unit/bank-check-draft.test.ts`, `docs/projects/active/BANK_CHECK_WORKING_DRAFT_WD1_FINISH_PROMPT.md`.
Changed, all WD1: `components/admin/kit/club/money/bank/BankCheckForm.tsx`, `BankFind.tsx`, `Bank.module.css`, `lib/auth.ts`,
`tests/unit/bank-r2c-screens-guard.test.ts`.
The project's own docs, untracked until now (the planning session's, same project): `BANK_CHECK_WORKING_DRAFT_PLAN.md`,
`_PM_BRIEF.md`, `_DRAWINGS.html`, `_WD1_BUILD_PROMPT.md` in `docs/projects/active/`.

**⚠ Shared with another session's uncommitted hunks — commit ONLY the WD1 hunks** (temp index, exact edits; see the auto-memory
`reference_partial_commit_shared_tree.md`):
- `lib/bank-tab-words.ts`: WD1 = the `addMissing` comment line and the new block from `addEntry` to `draftDropped`. NOT WD1:
  `throughResult` → "Checked through", `notCheckedLine`, and their comment.
- `components/admin/kit/club/money/bank/BankTab.tsx`: WD1 = the `useOrg` import, `const personId = …`, and the
  `<BankCheckForm key=… personId=…>` lines with their comment. NOT WD1: the Account pill's `detail:` → `sub:`.
- `TODO.md`: WD1 = the one "Bank check — work it down to zero" line's "WD1 … BUILT" text. Everything else is another session's.
- **Never stage** `lib/bank-screen.ts` (another session's) or anything else in the tree.

## Steps

1. **`/simplify`** on the WD1 files only. Watch for: duplication between `offeredItems` and `BankFind`'s `itemOf` (WD2 will
   reuse the helper, so the shared one should be the helper's); the form's render-time adjustments (marks re-checked against
   each new figure, the "Started off by" anchor, the restore line) staying the React-supported pattern (the lint's
   `react-hooks/refs`, `set-state-in-effect` and `purity` rules failed on the effect version, which is why it moved).
   Keep the helper pure with the storage injected. Do not change words.
2. **`/review`** on the same files. Points worth an adversarial look: a restored draft whose date the server now refuses;
   "Check this statement again" over an existing draft; the person arriving after mount (the form re-keys); focus re-read
   while the Add entry window is open; Save failing (the draft must survive); blocked storage; the sign-out paths that skip
   the `signOut()` wrapper (`scope: 'local'`, recorded in §7 as accepted because the key carries the person).
3. Re-run: `node --import ./tests/ts-resolver.mjs --test tests/unit/bank-*.test.ts`, `npm run check:spelling`, focused lint on
   the WD1 files, and `npm run typecheck` (use `NODE_OPTIONS=--max-old-space-size=8192`; the default heap ran out).
   **Known failures that are NOT WD1** (2026-11-07): 13 full-suite tests and the type errors in `lib/gst-return-filing.ts` /
   `app/api/platform-admin/bookkeeping/gst-return/filings/route.ts`, all other sessions' in-flight work. Report them; do not fix.
4. **Commit** on `dev` (check `git rev-parse --abbrev-ref HEAD` first), explicit pathspecs plus the partial hunks above.
   Message: `Bank check WD1: the club card keeps its work in this browser, "Started off by", Add entry any time, re-read on focus`
   with a short body (what the treasurer sees; the two build calls; no migration, no route). End with the attribution line the
   session's system reminder gives. Then `git show --stat HEAD` and confirm only WD1 landed; if a foreign file slipped in,
   `git reset --soft HEAD~1` and redo.
5. Record the hash: plan §7 and the header status line ("WD1 committed `<hash>` 2026-11-07"), the TODO line, and the build
   prompt's foot. Those edits go in a follow-up commit of the same pathspecs (TODO.md again by hunk).

## Hand-off

Say to the owner, in product-owner voice: what changed after simplify/review (if anything a treasurer would notice), the
commit hash, and that the owner walk (type a balance, leave to the Ledger, book a line, return, watch "Off by" fall to
Matches, Save) is still his. Restart the dev server only if files were added or deleted. WD2 (coach card) is next; offer to
write its kickoff only if asked.
