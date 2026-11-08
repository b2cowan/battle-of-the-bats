# Build prompt — Bank check: work it down to zero, WD2 (the coach card, desk + phone)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-07 after WD1 was committed (`2a64a87d8`). Plan of record:
> `docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md` (§4 WD2, §4b words, §7 the WD1 build record). WD3 (help, `/docs`, the owner walks)
> is a separate session. The owner walk of WD1 may still be open: if it has produced findings against the shared helper, fix those first.

---

Bank check: work it down to zero — **WD2, the coach card.** Product code.

## Read first, in this order

1. The plan: §0 (the table of what the code already does), §1 rulings, §3.1–3.3, **§4b (settled words; the coach rows are yours)**, §5 (all six asks
   ruled A; they apply to the coach card the same way), **§7 (the WD1 build record: the two calls made, and the /simplify + /review result)**.
2. What WD1 built, as the model to copy: `lib/bank-check-draft.ts` (pure helpers, storage injected: `readDraft`, `writeDraft`, `clearDraft`,
   `sweepIdleDrafts`, `canKeepDrafts`, `offeredItems`, `keepOffered`, `anchorStarted`, `startedOffCents`, `itemOfLine`) and
   `components/admin/kit/club/money/bank/BankCheckForm.tsx` in full (the render-time adjustments for marks, the anchor and the restore line are the
   React-supported pattern; the effect versions failed the `react-hooks/refs`, `set-state-in-effect` and `purity` rules, so do not rewrite them as effects).
   `tests/unit/bank-check-draft.test.ts` for the test shape.
3. The coach card: `components/coaches/bank/CoachBankCheck.tsx` in full, then `CoachBankFind.tsx`, `CoachBankView.tsx`, `coachBank.ts`, and the words in
   `lib/bank-tab-words.ts` (shared by both portals) and `lib/bank-screen.ts`.
4. How the Ledger opens its Record money window: `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx` near the `<CoachBankView … onAddLine=…>`
   (about line 7562) and `openConversationFrom`.
5. The drawings (`BANK_CHECK_WORKING_DRAFT_DRAWINGS.html`, artifact https://claude.ai/artifact/HpFPDfFUAPLLeRLZyvTHMT) are the CLUB's frames; they
   name the coach words but do not draw the coach card. See "Design" below.

Broad reading goes to a helper agent (CLAUDE.md). Check a helper's claims against the code before building on them.

## What the coach sees after this (give the owner this summary before any code, per AGENCY_RULES)

The same five things as the club card, in the coach's words: the card remembers the date, balance, cash not deposited yet and the lines marked "Not in
the bank yet" while the coach goes elsewhere in the portal and comes back ("Picked up where you left off" · Start over); a quiet "Started off by $X";
a **"+ Record"** button that is always there; the figure re-read when the browser tab is back in view; Save clears it. No role change: only a coach
with money-write is given the card (a money-read assistant sees no form, so no draft).

## What this session changes (owner-ruled; do not re-open)

- **The same draft helper, the coach's key.** Club = the org slug, account = the **team id** (a team has one bank account, no pill), person = the signed-in
  coach. Same storage prefix as the club's, so `signOut()` (which both portals use: `MoreSheetFoot`, `CoachWallSignOut`) already clears these too.
  The person: the coach layout also wraps `OrgProvider`, so `useOrg().user?.id` is there; the card re-keys when it arrives, exactly as the club tab does
  (see `BankTab`). Nothing is read or kept until the person is known.
- **The helper grows one field: the cash.** The coach card has "Cash not deposited yet" beside the balance and it is part of the work. Add it to the
  draft as an optional string (default empty, so a WD1 draft still reads; the storage key version stays `v1`), count it in "worth keeping", validate it
  as a string on read, and extend the unit tests (write, read, an old draft without it, cash alone). Keep the helper pure and portal-blind.
- **"Started off by"** works as in the club card (anchored at the balance as last typed; marks, lines and the cash are the work and never move it).
  The coach band has no online payments (`onItsWayCents: null`).
- **Marks are re-checked on every read of the day** (the second WD1 call), through the shared `offeredItems` / `keepOffered`. The coach's figure has
  `suspects` and `stillWaiting` but no `onItsWay`: the helper's argument type must accept that without a cast (make `onItsWay` optional in its type
  rather than faking one). Use the shared `itemOfLine` and delete `CoachBankFind`'s own `itemOf` copy.
- **Restore at once** with the quiet line (plain "Picked up where you left off", plus " · last worked on {date}" only from an earlier day, via the shipped
  date helper `dayYear`) and **Start over** (no confirm). Figures are never restored: the day is read first, the band draws after. A mark the books no
  longer offer is dropped with the amber callout (§4b wording). Use the club's existing words; they are in the shared words file already.
- **A restored date the season no longer takes** (a draft from before a rollover; the coach card's day rules are the season's): the existing refusal
  sentence shows in place of the band, restored marks wait, Save stays off until another day is picked. Do not special-case it; confirm it with a test or
  a walk step.
- **"+ Record"** (§4b): an outline button in the card's heading row, always drawn, enabled once the day's figure is read and the coach can write money
  (it already only mounts for a writer). It opens the Ledger's own **Record money** conversation **blank**. Add a second optional prop beside `onAddLine`
  (for example `onRecord`) wired in `panel.tsx` to open the conversation with no amount and no prefill other than what the gap link would give for the
  date; on a phone the word stays ("+ Record"), 44px, in the heading row (ask 6). The coach hub already re-reads the bank on every money write
  (`useMoneyRevision`), so nothing new is needed after a save.
- **The gap link is renamed**: "Add the missing line" becomes **"Record the missing amount"** in both places it shows (`CoachBankFind`'s link and
  callout button). Add the coach key to the words file (`recordMissingAmount`, and `record` for the button); retire the coach's use of `addMissing`
  and remove `addMissing` if nothing else reads it. This **changes the pin** in `tests/unit/bank-check-draft.test.ts` ("the coach card's gap link is
  unchanged until WD2") and the club-side pins that name `W.addMissing`; move them with the code, do not loosen them.
- **Fresh figure on focus / visibility**, debounced with the date read, **only while the Ledger is on screen** (`active`): the hub keeps the card mounted
  hidden, so a hidden card must not read.
- **The resting sentence** "Kept in this browser only, until you save this check." under Save with the other notes, only when this browser will hold a
  draft (the probe), as in WD1.
- **Save is the finish line, unchanged**; Save while off still works. On success the draft clears; on failure it survives.
- **"Check this statement again"** starts that day fresh (blank), leaving the old draft until the first keystroke replaces it, as in WD1.

## Design

The coach card has no drawn frame for the new pieces. Build the heading row, the restore line, the "Started off by" hint, the dropped-mark callout and the
resting sentence from the **shipped coach kit** (`coaches.module.css` `btnSecondary`, `formHint`, `CoachBank.module.css`), matching the club frames in
the drawings tab for tab (position and order, not the club's classes). Check at 1440 / 390 / 361. Then run `/design` on the built coach card; the drawings
may need a small coach frame added to the drawings file if `/design` asks for one (a drawing correction is part of this session, not a new ask).

## Boundaries

- **No per-line ticking, no shared drafts, no server draft, no migration, no route, no dictionary change.** Draft code never calls a bank route; the only
  writer of a book line stays the Ledger's own Record money route.
- **Club card untouched** except what the shared pieces force (the pins above, the helper's optional `onItsWay`).
- **Open owner call, do not decide it silently:** the shared hint text says "a deposit or interest you haven't entered", and the coach would read
  "entered" beside "Record" (plan §4b, open items). Report it in the hand-off with a recommendation; do not widen into the shared hint words.
- **A history decision:** the coach draft is the working season's instrument. It adds no year parameter and no look-back (CLAUDE.md, the coaches portal's
  history rule); `HISTORY_ENDPOINTS` must stay unchanged. The coach guard tests (`bank-coach-routes-guard`, `bank-coach-view-guard`) must still pass.

## Tests and checks

- Helper tests extended for the cash field (above). A coach guard in the style of WD1's: the coach card reads and writes the draft only through the helper,
  never calls a bank route for it, re-keys on the person, reads on focus only when `active`, and calls `itemOfLine` rather than its own copy.
- `node --import ./tests/ts-resolver.mjs --test tests/unit/bank-*.test.ts`, `npm run check:spelling`, `npm run lint:focused -- <the files>`, then typecheck with
  `NODE_OPTIONS=--max-old-space-size=8192` (the words file is shared). If a plain `npm run typecheck` is blocked by a syntax error in the dev server's generated
  `.next/dev/types/routes.d.ts`, run `tsc` with a temp tsconfig that excludes `.next` (that error hides every other one). Other sessions' known errors are
  theirs: report, do not fix.
- No new files in the app are expected beyond tests; if any are added or deleted, restart the dev server before hand-off (AGENTS.md). The owner does the
  browser walk; offer a short coach walk: type a balance and some cash, mark a line, go to the Roster, come back, see the card as left, tap "+ Record", book a
  line, watch "Off by" fall to Matches, Save.

## Finish

`/design` on the built coach card against the club frames, then `/simplify` (the helper gained a field and a second caller) and `/review`. The review's
adversarial points, beyond WD1's: a draft from the previous season after a rollover; the Ledger mounted hidden (no read while hidden, restore still happens);
cash typed alone; a money-read assistant (no form, no draft, nothing written); "Record" opened while a figure re-read lands; sign-out clearing a coach draft.
Help articles, `/docs` and the two owner walks are WD3. Update the plan (status line, §7-style build record, WD2 committed hash) and the TODO.md line.
**Commit only after the owner's yes (or an explicit finish prompt that carries it), explicit pathspecs only**; `lib/bank-tab-words.ts`, `TODO.md` and the
coach files may carry other sessions' uncommitted hunks: build the commit as a partial one (auto-memory `reference_partial_commit_shared_tree.md`;
the WD1 script in `.probe/wd1-commit/commit.cjs` is a working template: temp index on the recorded HEAD, exact edits, hook, `commit-tree`, compare-and-swap).
