# GST/HST · Stage 1 · Part 5: the closeout (build prompt)

> Written 2026-11-04 at the end of the session that committed Part 4. Parent prompt (read its ▶ Progress block FIRST: every
> ruling and every open follow-up from Parts 2–4 is there): [GST_HST_STAGE1_BUILD_PROMPT.md](GST_HST_STAGE1_BUILD_PROMPT.md).
> This prompt **replaces** the parent's "Part 5 · Closeout" section, which predates Part 3 and is wrong in one place (its walk
> asks for "an edit in Stripe's portal"; the owner ruled in Part 3 that Stripe's billing page no longer edits the address).
> Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 1. Recommended model: **Sonnet is enough**;
> `/accounting` and `/docs` run their own agents. Mark facts [V] (verified by you this session, file:line) or [H] (handed
> over). Everything here is [H] unless marked.

## Why this part exists (one paragraph)

Parts 1–4 built the thing: every paid checkout now asks the buyer where they are, once, and remembers it, and the build fails if a
new charge skips the question. What is left is what makes it safe to hand over: the **`/accounting` review** (blocking before
hand-off, CLAUDE.md), the **help articles** (no article mentions the billing address today), the **owner walk** (now the ONLY
end-to-end proof for two paths, see "Already true"), and one clean list of the **owner questions** the four parts left open.
No new product behaviour is planned in this part; anything the review finds that needs one is a finding first.

## Already true when you start

- **Committed on `dev`:** Parts 1+2 `fd55a1df3` (mig 433, dev only), Part 3 `32d466e59`, Part 4 `95dbdcbec` (record `b5f42ea47`).
  `/simplify` + `/review` were DONE for Parts 2 and 3; the owner skipped `/review` for Part 4 (tests only). Do not re-offer them
  unless this part changes product code.
- **The two automated UAT walks do not prove paths A/B or C end to end** [V 2026-11-04, ran them on the dev server]: both now
  seed an address, but both fail past it on Plan & billing screen drift (a "Coaches Portal ready" text no longer in the
  product; a `#billing-change`-scoped "Start my club" locator that no longer finds the button). So **the owner walk is the only
  end-to-end check of the Club checkout, Premium → Club in place, and coach Premium** — write it that way. The spec drift is a
  follow-up for the Plan & billing program, not this part.
- **No help article mentions the billing address** [V 2026-11-04, grep of `lib/help-content/`]. The club's Plan & billing
  articles live in `lib/help-content/org.tsx`, the coach's in `lib/help-content/coaches.tsx` [V: both mention Plan & billing].
- **Owner QA Ledger:** the highest §number on 2026-11-04 was **453** [V]. Re-grep before numbering; other sessions add fast.
- **Production steps owed (do not restate their detail elsewhere; point at their home):** mig 433 is `pending` in
  `supabase/migrations/MANUAL_PROD_STEPS.json` [V line 582]; `US_SALES_OPEN` stays absent/off in production; after the deploy,
  open Stripe's billing page once in test and once in live mode so portal configuration v2 is created and v1 switched off
  (parent Part 3 follow-up 5).

## Before any code: verify, then ask (no code)

1. **Where the walk runs.** The owner walks on the dev site (earlier walks in this program did). Check: is `dev` pushed far enough
   for Parts 1–4 to be on it (`git log origin/dev..dev`)? Is `US_SALES_OPEN=true` set on the **dev site's** environment, not only
   in local `.env.local` (Part 2 set it in `.env.local` only [H])? Is mock billing on or off there, and which paths therefore reach
   real Stripe TEST checkout? If the US switch is not on the dev site, the US half of the walk cannot run there: say so, and offer
   the owner the choice (set it on the dev site, an owner step; or walk the US half on localhost).
2. **Re-run the census.** `tests/unit/billing-location-every-path-guard.test.ts` IS the census now; run it. If it fails, a new
   charging path landed since Part 4: report it before anything else (that is a Part 2 gap, the owner decides).
3. **The disagreeing-card step.** Find how a walker gets a non-US card on a US buyer in Stripe TEST (a test card with a non-US
   issuing country) and where the flag then shows (the platform admin Money tab's "Billing address" block, Part 3). Write the
   exact card number and the exact words the walker should see into the walk.
4. **The open owner questions.** Read the parent Progress block's follow-up lists (Part 2 "Owner questions / follow-ups",
   Part 3 "Owner questions / follow-ups", Part 4's UAT note) and sort them: already ruled or fixed since (say by which part),
   for `/accounting`, for another program (name it), or still the owner's call.

**Asks for the owner** (present each with a recommendation; wait):
- **Ask 1 · The open questions, one list.** Present step 4's sorted list, owner's calls only, each with a recommendation
  (keep it short: the strictness items, the card-on-file reminder gap and its owner, the Stage 2 resolve items). Recommend that
  anything belonging to Stage 2 or another program is **recorded there, not built here**.
- **Ask 2 · The UAT spec drift.** Recommend: a one-line TODO item under the Plan & billing program pointing at the parent Progress
  block's Part 4 UAT note, rather than fixing another program's specs here.
- Anything `/accounting` returns that changes what we store or charge is an ask too, presented after the review (below).

## Do

**A · `/accounting` review (blocking).** Run `/accounting` on Stage 1 as built (it reads its own index first). Hand it at least:
- `billing_locations` has `ON DELETE CASCADE` on both buyer links, so deleting a club or a person deletes their address, US
  declaration and review flag (parent Part 2 follow-up 3). Does that meet the record-keeping expectation for a tax-relevant fact
  (6 years)? If not, what should happen instead? **A fix is a migration: do not write it here; bring it back as an ask.**
- The Stripe-fee recovery invoice is the one FieldLogicHQ charge that can go out with no address on file until Stage 5 (Part 4,
  owner Ask 2b). Confirm that is acceptable while nothing is taxed, and that Stage 5 is the right home.
- The family-to-club Connect payment has no buyer address on our side (Part 4, Ask 2a): confirm our payment fee's tax question
  belongs to a later stage.
- The provisional US declaration wording and its version label (parent Ask 2; T7 says reviewed with the accountant package).
- We now store a coach's **home address**: does the privacy policy need a line before Stage 2 (the TODO address-search item names
  GST/HST Stage 6 for a privacy line)?
Apply what it finds that is copy or a record; anything else goes back to the owner as an ask. Record its verdict in the Progress block.

**B · `/docs`.** Offer it (CLAUDE.md "Help-docs sync"); on a yes, the Plan & billing help for clubs AND for coaches gains, in
product words: where we ask for the billing address and why (sales tax; nothing is charged differently today), a coach gives
their **home** address and it covers every portal they pay for, a club gives the club's, change it on Plan & billing (the
Billing address button), Stripe's billing page no longer changes it, and the US sentence while US sales are closed. Keywords and
`searchText` too. One spelling everywhere (`npm run check:spelling`).

**C · The owner walk.** One purpose: *a buyer is asked where they are before paying, once, on every paid path, and the answer is
remembered.* House format (checkable Artifact, paste-back, memory `feedback_qa_walkthroughs_as_checkable_artifacts`); give it the
next §number in the Owner QA Ledger. Cover, each as its own checkable steps:
- every path: A club plan checkout · B Premium → Club in place (the club address block, prefilled from the coach's home address,
  editable) · C coach Premium new (the sign-up Address step) and reactivate · D the Founding next-season choice, if a fixture
  can reach it (say so if not) · E a move up on a live subscription (the move window opens the address window on refusal);
- asked **once**: a second purchase by the same buyer goes straight through with "Billed to …";
- Canada and US (the tick-box, and the US hold sentence when the switch is off, if the walker can see both);
- a PO Box refused, with the words shown;
- **Stripe's billing page offers no address edit** (this replaces the parent's "an edit in Stripe's portal");
- a disagreeing US card (verify step 3) flags the buyer, shown read-only on the platform admin Money tab, and never blocks;
- free, comped and trial buyers are not asked until they press a paid button.
State at the top that it is the only end-to-end proof of A/B and C (the UAT specs are broken past the address step).

**D · Verify.** `npm run verify:changed` (if its lint step still crashes on the eslint config, run `lint:focused` on your files and
say so); `npm run typecheck` if help content (`.tsx`) changed; `npm run check:spelling`; the billing-address tests
(`tests/unit/billing-location*.test.ts`). Other sessions' tests fail in the shared tree: check `git log` before calling one theirs.

## Rules (blocking)

- Present the task list, verify findings and asks first, and wait. Disagree out loud if the code says something here is wrong.
- Change no product behaviour except help copy and anything the owner rules from the asks. No migration in this part without an
  owner yes; if `/accounting` needs one, it is an ask.
- Do not edit `.claude/settings*.json`, hooks, `package.json` scripts, `scripts/check-*.mjs` or anything in `WATCHED_PATHS`.
- **Commit** on `dev` (re-check the branch), explicit pathspecs only, and check `git diff --cached --name-only` BEFORE committing:
  on 2026-11-04 another session's staged files rode into a commit here (fixed with `reset --soft` + `commit --only`). Shared
  files (`TODO.md`, the Owner QA Ledger) take only your hunks (partial-commit method, memory `reference_partial_commit_shared_tree`);
  grep your TODO line before staging (memory `reference_shared_ledger_truncation`). `git show --stat HEAD` after. **Do not push**
  unless the owner asks (verify step 1 may make the walk need it: that is the owner's call).
- Records, as a small follow-up commit: the parent Progress block (Part 5 line, `/accounting` verdict, the sorted owner
  questions), the plan's Stage 1 status line, the PM brief status, the TODO GST line (one line), the ledger §. Write positive
  facts with anchors ("committed `<hash>` <date>", "walk §N written"), never "not on prod". `BUSINESS_DECISIONS` only if an ask
  changed a ruling.

## After this part

Stage 1 is closed when the owner's walk passes and its findings are fixed or recorded. Then the prod steps above ride the next
promote, and **Stage 2 (tax live)** can be planned; it needs T4 and T5 (plan §4) and must read the buyer's review state through
`currentReview` (parent Part 3 note), and land the Premium → Club address copy before `applyMove`'s Stripe update (parent Part 3
⚠ Stage 2 note).

## Out of scope

Tax of any kind; Stripe Tax; "plus applicable taxes" copy; the strictness items (unless the owner rules them in Ask 1, and then
as their own small part); the removed-last-card webhook gap (card-on-file reminders own it); Stage 5's fee-recovery address;
fixing the Plan & billing UAT specs.
