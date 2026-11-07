# Plans & pricing · Stage 2 · Part 2: review and commit (kickoff prompt)

> Written 2026-11-06, after Part 2 was built and the owner approved the PM summary. Read first: the Part 2 line in the
> **Progress** block of [PLANS_PRICING_STAGE2_BUILD_PROMPT.md](PLANS_PRICING_STAGE2_BUILD_PROMPT.md) (what was ruled and built),
> and [PLANS_PRICING_STAGE2_PART2_BUILD_PROMPT.md](PLANS_PRICING_STAGE2_PART2_BUILD_PROMPT.md) (the brief).
> This session reviews and commits. It builds nothing new. **The owner has NOT yet approved the commit: ask before committing.**

## What Part 2 changed (read-only; nothing stored, no new Stripe call)

The Money tab tells the failed-payment story from the bills and charges it already reads from Stripe:
- A notice above the agree line when a bill is open after a failed try: amount owed, tax inside it (only when the whole bill is
  owed), the bank's reason in fixed words, Stripe's own try count (never a total, never "of 4"), the next try (or "was due…
  Read again", "no further try scheduled", "runs only if the club adds a new card"), and "keeps using everything" only when our
  record says past due. Doors: "See the bill" (the existing read-only sale window) and "Show them" (Not paid filter).
- The sale row's second line names the next try; the sale window gains a "Tries" line.
- `chargeFailureWords` names the bank's decline code (from the charge's `outcome`) wherever a failed charge is named (list,
  window, Story, the old charges words).
- The "Stripe could not be read" lines name the failed payment as waiting.

## The files, and whose edits are in them

Wholly Part 2 (stage whole files):
- `lib/console-money-stripe.ts`: `toMoneyInvoice` gains `attemptCount`, `nextAttemptAt`; `toMoneyCharge` gains `declineCode`, `adviceCode`.
- `lib/console-money-story.ts`: `failureWords(c.failureCode)` → `chargeFailureWords(c)` (import + one call).
- `tests/unit/console-money-failed-payment.test.ts` (new, untracked).
- `tests/unit/billing-location-evidence.test.ts`: the `{reviewStrip}\s*(\{failedNotice\}\s*)?\{head\}` guard widening.
- `docs/projects/active/PLANS_PRICING_STAGE2_BUILD_PROMPT.md`: Part 1 line now says committed `21b4d6617`; the Part 2 entry.
- This prompt file (`PLANS_PRICING_STAGE2_PART2_REVIEW_COMMIT_PROMPT.md`, untracked): commit it too.

**Mixed: another session's uncommitted GST/HST Stage 3 Part 3b ("looked at" marks) and a portal-flag wording change are in the
same files. Do NOT revert them and do NOT commit them.** Use the partial-commit method (memory
`reference_partial_commit_shared_tree`: temp index from HEAD, apply only Part 2's hunks, CAS `update-ref`).
- `lib/console-money.ts`. Part 2's hunks: `MoneyInvoice` gains `attemptCount`/`nextAttemptAt`; `MoneyCharge` gains
  `declineCode`/`adviceCode`; the new `FAILURES` codes plus `chargeFailureWords`; `stripeSaysWords` uses `chargeFailureWords`; the new
  section "A failed payment (Plans & pricing Stage 2 Part 2…)" after `subscriptionsMoreWords` (`NextTry`, `FailedBill`, `nextTry`,
  `failedBillOf`, `failedBills`, `triesWords`, `nextTryShort`, `FAILED_WORDS`, `failedStoryWords`).
  NOT Part 2: the `flagWords` `portal` case ("A Coaches Portal this club pays for", dropping "Not a duplicate: ").
- `lib/console-money-sales.ts`. Part 2's hunks: the import (`chargeFailureWords, failedBillOf, invoicePaidForWords, nextTryShort,
  stripeSaysWords`); `saleStripeSays(row, readAt?)` with its doc comment and the `bill` lines in the `open` branch; the
  `unreachable` and `bothFailed` words ("any failed payment…"). NOT Part 2: everything the other session added (~36 lines, the
  Part 3b look/mark words and helpers).
- `app/platform-admin/orgs/[id]/MoneyTab.tsx`. Part 2's hunks: the `@/lib/console-money` import line (adds
  `chargeFailureWords, failedBillOf, failedBills, failedStoryWords, triesWords, FAILED_WORDS`, removes `failureWords`); the
  `failing` / `failedWords` / `failedNotice` block above `const gate =`; `{failedNotice}` between `{reviewStrip}` and `{head}`;
  `saleStripeSays(row, read?.readAt)` in the list; the `bill` const after `says` in `SaleWindow`; the `Tries` `<dt>/<dd>`; the
  failed-tries line using `chargeFailureWords(f)`. NOT Part 2: `FileDown`, `consoleDay`, `LookedMark`, `marksLooks`,
  `startOnLook`, `lookedOf`, `canMark`, `onLooksChanged`, the `looking` windows, the PDF button, the mark door.
  ⚠ The committed (HEAD) version lacks the other session's props. Part 2's hunks must apply cleanly to HEAD on their own. Check
  that the temp-index version of each mixed file still compiles alone (see step 4).
- `ClubRecord.tsx`, `page.tsx` and `money.module.css` in the same folder are NOT touched by Part 2: leave them out.

Re-check all of this with `git diff` before staging: another session may have moved on since this was written (memories
`reference_reread_prompt_before_publish`, `reference_shared_ledger_truncation`).

## Steps

1. `git rev-parse --abbrev-ref HEAD` must be `dev`. `git status --short` on the files above; read the current diffs of the three
   mixed files and confirm the hunk split above still holds.
2. **Run `/review`** (`.claude/commands/review.md`) on Part 2's changes only (it touches a money screen). Give the reviewers the
   Part 2 hunks, not the other session's. Points worth an adversarial look:
   - `failedBillOf`: does an `open` bill with `attempt_count > 0` and no failed charge read (an SCA `requires_action`) get
     honest words? Does a bill with a `pending` charge stay out? Does a sent fee invoice (`collection_method=send_invoice`,
     `attempt_count` 0) stay out?
   - `declineCode` from `outcome.reason` only when `outcome.type === 'issuer_declined'` (a Radar `blocked` reason must never
     read as a bank reason).
   - `nextTry`: `do_not_try_again` advice from the newest failed charge. A new card added since makes this stale: is the
     wording still true?
   - The notice comes after the `if (!readsStripe)` return and is built only from `read` (a guard test checks this).
   - `consoleDay` on `next_payment_attempt` (a Stripe instant shown as a Toronto day).
   - Spelling: the house gate passed; check the fixed reason words against `check:spelling` again after any wording change.
   Apply what survives verification; report the rest.
3. Tests: `node --import ./tests/ts-resolver.mjs --test tests/unit/console-money-failed-payment.test.ts tests/unit/console-money-sales.test.ts tests/unit/console-money-next-charge.test.ts tests/unit/console-money-needs-look.test.ts tests/unit/billing-location-evidence.test.ts`
   (95 + 27 passed at build time), plus every test that greps these files
   (`grep -rlE "console-money|MoneyTab|failureWords" tests/unit lib --include=*.test.ts`). Known reds NOT from this work, report
   and do not fix: `workspace-flip-guard` (portal-tag census), `support-console-stage3-guard` (console window foot,
   footerStart), `support-console-stage4b-inforce-guard`. The full `npm run typecheck` currently fails only in another
   session's admin-kit nav files (`AdminKitBottomNav.tsx`, `_club-people.ts`, `admin-kit-nav.test.ts`,
   `nav-standard-guard.test.ts`); confirm no error names a Part 2 file. `npm run lint:focused -- <the 7 files>` and
   `npm run check:spelling`.
4. **Ask the owner before committing.** Then build the commit with the partial-commit method. Before `update-ref`, check
   the temp-index versions of the three mixed files: `git show :<path>` from the temp index must contain every Part 2 hunk and
   none of the other session's (grep it for `marksLooks`, `lookedOf`, `FileDown`, `LookedMark`, and for the portal-flag
   wording: all absent). Then confirm the Part 2 symbols are all present.
   Suggested message: `Plans & pricing Stage 2 Part 2: the failed-payment story on one customer's Money tab, read only, from the
   tab's existing Stripe read (tries made and the next try, never a total)`, ending with the attribution lines from the
   system reminder.
5. `git show --stat HEAD`: only the Part 2 files. `git status` afterwards: the other session's edits are still in the working
   copy, untouched (diff the three mixed files again: their remaining diff is exactly the other session's).
6. Update the Part 2 line in the stage prompt's Progress block: replace "Built 2026-11-06" with "committed `<hash>` 2026-11-06"
   (if `/review` changed anything, say what in one clause). If that edit is not in the commit, make a tiny docs-only follow-up
   commit, with the owner's yes.
7. Hand-off to the owner in product-owner voice: what `/review` found and fixed, the commit, and the walk still owed (the
   four-item checklist from the build session: a past-due test-mode customer via a 0341 card and a plan move up; a recovered
   customer; a club with no Stripe customer; Support compared with a role without Stripe access). Offer `/docs` only if a staff help
   article covers the Money tab (platform-admin-only, so likely skip).

## Do not

Change any money behaviour, add a button, store anything, touch `.claude/settings*.json`, hooks, `package.json` scripts or
anything in `WATCHED_PATHS`, or touch live Stripe. Do not `git add -A` / `git add .`. Do not revert or "tidy" the other
session's hunks.
