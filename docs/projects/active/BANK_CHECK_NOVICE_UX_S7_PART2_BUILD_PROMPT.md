**Written 2026-11-22, after S7 Part 1 was committed (`96e2135ea` the stored record, `e5dc36ad1` the nightly sweep). Part 2
is not built. Sequenced after the release carrying the balance check (owner ruling 2026-11-17).**

# Bank check through a volunteer's eyes — S7 Part 2 (the two cards, to the drawing) — build prompt

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S7_PART2_BUILD_PROMPT.md` into a new chat on `dev`.**
> Plan of record: `BANK_CHECK_NOVICE_UX_PLAN.md` — **§0 A18 and its nine rulings (2026-11-22)** and §2 S7 (its "Part 1"
> bullet says what is built). The parent prompt `BANK_CHECK_NOVICE_UX_S7_BUILD_PROMPT.md` still holds the rulings summary
> and the code facts checked before Part 1; read its "What is already decided" section first. Spec: the drawing
> https://claude.ai/artifact/9hVJGaufeWfuG8mBjp1Meh (source `docs/projects/active/BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html`;
> tabs 1–7 are the states, tab 8 the asks as ruled). Build to the drawing (auto-memory `feedback_build_to_approved_mockups`).
> Where this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the code wins — say so out loud.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`: temp index from HEAD, shared files = HEAD + your exact edits,
> a HEAD guard in the same command as the commit, then `git reset -q -- <your paths>` in the main index).
> `lib/bank-tab-words.ts`, both help files, the data dictionary, the board JSON and `MANUAL_PROD_STEPS.json` carry other
> sessions' hunks. Write edit scripts with the Write tool (heredocs drop backslashes; a backtick in `node -e` executes).
> New files → restart the dev server before handing off. **Stop at the end of Part 2, report, and let the owner say go for
> Part 3** (help, `/review`, the two walks).

## What Part 2 delivers, in product-owner words

Both Bank cards (club Bank tab, coach Ledger › Balance check) take the drawing's seven states: no saved work; **Start
checking this statement**, then the strip "Checking {date} · Change" over the work, ending with **Save for later** and
**Save this check**; Change (fields in place, one lime "Use these", the rest dimmed); found again on the card itself (and
the club Account pill's sub-line at 2+ accounts); books moved (the shipped amber box); a colleague's quiet line; the last
7 days (the end date again, in warn ink). The work is kept as they go on our servers; a failed keep says so on the card.

## What Part 1 built (read the code, don't re-derive it)

- **Shape and rules, client-safe:** `lib/bank-check-work.ts` — `CheckWork`, `SavedWork` (+ `revision`, `changedOn`,
  `endsOn`, all YYYY-MM-DD in the club's day), `ColleagueWork` (`name`, `date`, `changedOn` — nothing else),
  `WorkElsewhere` (`accountId`, `date`), `WorkRead`, `isWorkWorthKeeping`, `daysLeft`, `inLastWeek` (the last 7 days;
  the last day reads 1), `BANK_CHECK_DRAFT_DAYS = 30`.
- **Routes** (each handler re-asks the check route's own gate; refusals are `{ error, code }`):
  - Club: `/api/admin/accounting/bank/accounts/{accountId}/work?orgSlug={slug}` — GET `{ mine, colleagues, elsewhere }`.
  - Coach: `/api/coaches/{orgSlug}/teams/{teamId}/bank/work` — GET `{ mine, colleagues }`.
  - Both: **PUT** `{ work, revision }` → `{ saved }`. Use `revision: null` for the first keep (Start). After that, send the
    revision last read. `saved` is null when the work is no longer worth keeping (the row is removed).
  - **409 `work_changed`:** another device kept newer work, or the row expired. GET again and show what is there; never
    re-send blindly.
  - **400 `bad_work`:** the club sends no `cash`; text over 32 characters; a key outside 3–200 characters; more than 500
    marks.
  - **DELETE** = Start over. The coach's first PUT opens the team's account when none exists.
- **Already server-side, nothing to build:** a saved check removes the saver's work in the same request (both portals);
  loss of write access, a coach season's roll or close, expiry (nightly job + on sight) and the cascades remove it.
- **Kept from the browser draft:** `offeredItems`, `keepOffered` (restored keys → kept + dropped count, for the amber
  box), `anchorStarted`, `startedOffCents`, `itemOfLine` in `lib/bank-check-draft.ts`.

## Build steps

1. **`/marketing` first** settles the new strings against ruling 9 (the notice, the resting sentence, the strip, Change's
   "Use these" / "Keep {date}" and its amber line, Start over's one-line confirm, the colleague's quiet line, the last-7-days
   line, the Account pill sub-line "Your check of {date} is saved for later") **plus two the drawing doesn't word:**
   a failed keep (the resting sentence must never promise what didn't happen, ruling 4) and the `work_changed` reload
   ("changed on another device"). The API's own `work_changed` / `bad_work` words in `lib/bank-check-work-server.ts`
   `WORK_REFUSAL` are placeholders — settle them in the same pass. `draftKept` is replaced; `draftPickedUp` /
   `draftPickedUpOn`, `draftDropped`, `replacesNote` stay.
2. **One shared hook for both cards** (they will want it; `/simplify` after): reads GET on mount, keeps as you go
   (debounced; flushed on Save for later and on leaving the page with `fetch(…, { keepalive: true })`), holds the
   revision, surfaces `failed` and `changed` states, Start / Save for later / Start over. The card mounts after the bank is
   read, as today. **No keep before Start** (ruling 6: a first-time match takes Start, then Save this check).
3. **The two cards to tabs 1–7**, club then coach, each in its own words (ruling 3: coach cash is part of the statement —
   in the strip when typed, Change edits it, the cash link sits in the fields before Start and in Change). Change
   (ruling 5): a new balance or cash keeps every mark; a new date asks once (Use these / Keep {date}) then clears the marks;
   "Check this date again" while other work is saved asks first, never a silent swap. Start over (ruling 9): confirms in one
   line inside the card only when lines are marked; at once otherwise. Books moved (ruling 7): `keepOffered`'s dropped
   count → the shipped amber box; an edited line keeps its mark at its new amount; a day the account no longer takes shows
   that day's shipped refusal. The colleague's quiet line from `colleagues`. The last-7-days line from `inLastWeek`.
4. **The club Account pill (2+ accounts):** the option sub-line from `elsewhere` (drawing tab 4). The Overview bank line
   is unchanged (ruling 8).
5. **Retire the browser store:** remove `DraftStore`, `draftKey`, `browserDraftStore`, `readDraft`, `writeDraft`,
   `canKeepDrafts`, `clearDraft`, `sweepIdleDrafts`, `DRAFT_IDLE_DAYS` from the cards and the module. **Sign-out no
   longer clears the work** (ruling: it follows the person). Recommendation, say so if you differ: keep ONE small
   legacy cleanup that deletes any old `fieldlogic:bank-check-draft:v1:` browser keys (at sign-out and as the card mounts),
   with no import of them into the server — they are pre-S7 copies holding marked-line keys, and nothing reads them.
6. **Phone 390:** the foot stacks, Save this check first; inline links (Change, the cash link) keep a 44px tap box.
7. **Guards and tests that pin the browser draft and must learn S7** (rewrite them to the new behaviour, don't delete the
   intent): `tests/unit/bank-r2c-screens-guard.test.ts` (~363–365 the draft read on mount, ~636 `hasDraft ? W.draftKept`,
   ~671–675 the after-start draft rules), `tests/unit/bank-coach-view-guard.test.ts` (~86 Start over clears the draft,
   ~319–320 pins `draftKept`'s browser sentence), `tests/unit/bank-check-draft.test.ts` (the store tests go; the pure
   helpers' tests stay). The S7 server guards (`bank-r2-server-guard`, `bank-coach-routes-guard`,
   `bank-check-work.test.ts`) must still pass.
8. **Verify:** `npm run verify:changed` (32 failures in other sessions' files existed on 2026-11-22 — name any you add);
   typecheck (`NODE_OPTIONS=--max-old-space-size=7000 npx tsc --noEmit` — the default heap runs out);
   `check:layout --changed` on the two bank screens; prove the cards' calls on dev with a probe like
   `.probe/bank-ux-s7/work-routes.mjs` (dev logins: the uat-rep-club treasurer and owner; `uat-coach@uat-test-org.local`
   on "UAT Test Team"). Restart the dev server before hand-off.
9. **`/design` on the built cards at 1440 and 390** before hand-off, against the drawing.
10. **Raise with the owner (Part 2's one open question):** walk §491 (WD2, coach) recorded that a "No" answer to "Still
    waiting?" is not kept with the work. Ask whether S7 should keep it; don't fold it in unasked.
11. Record the stage in plan §2 S7 (a "Part 2" bullet) and the board line (`bank-check`, `remains`) in the same commit as
    the work, when the owner says commit.

## Not in Part 2

Help articles (`lib/help-content/accounting.tsx` ~393–400, `lib/help-content/coaches.tsx` ~3159–3167), `/review` on the
whole S7 diff, and the two owner walks replacing Owner QA Ledger §490 (club) and §491 (coach) are **Part 3**. The privacy
draft's general "work you save for later" row (owner ruling 2026-11-22) is carried by `/legal` into the next policy draft;
its 30-day sentence waits until migration 523 is on production.

## Don't

- Don't add release timing to anything; sequence by dependency.
- Don't edit shared automation, hooks or settings (the nightly job is already committed on the owner's word).
- Don't read production rows (counts and schema only); a question needing a person's row is answered on dev.
- Don't commit or push without the owner's word.
