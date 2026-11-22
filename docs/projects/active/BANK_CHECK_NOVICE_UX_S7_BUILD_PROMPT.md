**Written 2026-11-22, after the S7 drawing was ruled (owner: "go with your recommendations", all nine asks). Nothing here has
been built. Sequenced after the release carrying the balance check (owner ruling 2026-11-17: saving a check to finish later is
after launch).**

# Bank check through a volunteer's eyes — S7 (start, work, save for later) — build prompt

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S7_BUILD_PROMPT.md` into a new chat on `dev`.**
> Plan of record: `BANK_CHECK_NOVICE_UX_PLAN.md` — **§0 A18 and its nine rulings (2026-11-22)**, §2 S7, §4. Spec: the drawing
> https://claude.ai/artifact/9hVJGaufeWfuG8mBjp1Meh (source `docs/projects/active/BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html`;
> tabs 1–7 are the states, tab 8 the asks as ruled). Build to the drawing (auto-memory `feedback_build_to_approved_mockups`).
> Where this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the code wins — say so out loud.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`). `lib/bank-tab-words.ts`, both help files and the data
> dictionary carry other sessions' hunks. Write edit scripts with the Write tool (heredocs drop backslashes; a backtick in
> `node -e` executes). New files + a migration → restart the dev server before handing off.
>
> **Likely three sessions.** Stop at the end of each part, report, and let the owner say go for the next. Part 1 is the
> stored record; Part 2 the two cards; Part 3 help, reviews and the walk.

## What this is, in product-owner words

Today a treasurer or coach can type a statement's balance, mark lines "Not in the bank yet", leave, and come back — but only
in that browser, for 14 days, and signing out throws it away. After S7 they press **Start checking this statement**; the date
settles into a strip at the top of the card ("Checking Oct 31, 2026 · Change"); the work sits under it as today; the card ends
with **Save for later** and **Save this check**. The work is kept as they go, on our servers, for them alone, and comes back on
any device they sign in on for 30 days after their last change. A colleague who can check the same account sees one quiet line
saying who has which date saved for later, never the work itself.

## What is already decided (do not re-ask) — plan §0, A18 rulings 1–9

1. **Mine only.** Per person, per account. The colleague's quiet line names the person, the date being checked and the day it
   was last changed. Saving a date already checked keeps the shipped replace sentence.
2. **30 days from the last change.** The Save for later notice names the end date; in the last 7 days the card's line under the
   heading names it again in warn ink; **no email**. The work also goes when the person loses write access to that account, when
   the account is deleted, and on a coach's team when the season rolls over or closes.
3. **Both portals**, own words. Coach: the cash is part of the statement (strip when typed; Change edits it; the cash link sits in
   the fields before Start and in Change). Club: at 2+ accounts the Account pill's option sub-line marks the account holding your
   saved work ("Your check of Oct 31 is saved for later" — drawing tab 4). Save for later shows to whoever can save a check today.
4. **Kept as you go from Start.** Save for later confirms, names the end date and restarts the 30 days. A failed keep must say so
   on the card (the resting sentence must never promise what didn't happen).
5. **Change:** balance (and coach cash) change keeps every mark; a new date asks once, then clears the marks. "Check this date
   again" while other work is saved asks first, never a silent swap.
6. **A first-time match takes Start, then Save this check.** No Save before Start.
7. **Books moved:** a deleted marked line drops, counted in the shipped amber box (`draftDropped`); an edited line keeps its mark
   at its new amount, no note; a day the account no longer takes shows that day's shipped refusal.
8. **Found again on the card itself** (opens straight into the work). The Overview bank line is unchanged.
9. **Words** (final pass by `/marketing`): notice "Saved for later. Pick it up here, on any device you sign in on, until {date}.";
   resting sentence "Kept as you go, on any device you sign in on, until you save this check."; strip "Checking {date} · Change";
   Change's "Use these" / "Keep {date}" and its amber line; Start over in the foot; **Start over confirms in one line inside the
   card only when lines are marked** ("Start over? The 1 line you marked and the balance go." · Start over / Keep working); the
   strip shows **the date only** (the band's first tile carries the balance).

Also settled and unchanged: S5 parked; Find, the band, the gap doors and the saved-check list as shipped (S1–S4); the draft
holds the KEYS of marked lines and the "Started off by" anchor, never a line's figures or names.

## What the writer of this prompt checked in code on 2026-11-22

- **Today's draft** is `lib/bank-check-draft.ts`: a `DraftStore` over localStorage, key
  `fieldlogic:bank-check-draft:v1:{club slug}:{account|teamId}:{person}`, `DRAFT_IDLE_DAYS = 14`, `isWorthKeeping`,
  `readDraft`/`writeDraft`/`clearDraft`/`sweepIdleDrafts`/`clearAllDrafts`, and the pure helpers `offeredItems`,
  `keepOffered` (restored keys → kept + dropped count), `anchorStarted`, `startedOffCents`. Callers:
  `components/admin/kit/club/money/bank/BankCheckForm.tsx` and `BankFind.tsx`, `components/coaches/bank/CoachBankCheck.tsx` and
  `CoachBankFind.tsx`, and `lib/auth.ts` (signOut calls `clearAllDrafts` — **S7 removes that**: sign-out no longer clears work).
  Tests: `tests/unit/bank-check-draft.test.ts`. The pure helpers survive; the store becomes the server.
- **The key uses the club's web address**, which a rename would orphan. The new record keys to the organization's id.
- **Who writes:** club — anyone who can open the Accounting tab saves a check (read = write; no reader seat, A12 outside).
  Coach — `money === 'write'` (head coach always; Manager and Treasurer presets on; Assistant and Helper off by default); a
  view-only coach gets no card. The server routes that save checks today are the gate to copy:
  `app/api/admin/accounting/bank/accounts/[accountId]/checks/route.ts` and
  `app/api/coaches/[orgSlug]/teams/[teamId]/bank/checks/route.ts`.
- **Accounts:** club may have several (the Account pill appears at 2+); coach has one per team (a unique index).
- **No server-side per-person draft exists anywhere in the product** — there is no precedent to copy; `/dba` designs it.
- **Words to replace or keep** live in `lib/bank-tab-words.ts`: `draftKept` (replaced by the resting sentence),
  `draftPickedUp` / `draftPickedUpOn` (kept: "Picked up where you left off"), `draftDropped` (kept), `replacesNote` (kept).
- **Help that changes meaning:** `lib/help-content/accounting.tsx` (~393–400) and `lib/help-content/coaches.tsx` (~3159–3167):
  "in this browser only. It won't follow you to another device." and the "On a shared computer, press Start over" note (sign-out
  and 14 days) — both false after S7; keywords and searchText carry "kept in this browser", "shared computer", "sign out".
- **Walks to redo:** Owner QA Ledger §490 (WD1, club) and §491 (WD2, coach) test browser-only behaviour (a sign-out empties it).
  §491 also recorded that a "No" answer to "Still waiting?" is not kept — **raise it as an owner question in Part 2**; don't fold
  it in unasked.

## Part 1 — the stored record (`/dba` first)

1. Run `/dba` with the rulings above. One row per (organization, person, account) where account is the club's bank account or
   the coach's team; the date, typed balance, cash (coach), the marked line keys, the started anchor, created/changed times and
   an expiry 30 days after the last change. Ask `/dba` for: the key (org id, never the slug); how the rows go on loss of write
   access, account deletion, a coach's rollover/close, and a person's account-deletion request (Settings S1's flow); how expired
   rows are swept; and RLS / the route-level gate matching the check routes above. The colleague's quiet line needs other
   people's rows for the same account — name, date, changed — and nothing else leaves the server.
2. Migration on dev; **`docs/agents/db/DATA_DICTIONARY.md` and `npm run refresh:snapshots` in the same unit**; a production step
   recorded in the production-steps file, to go on before the promote that ships this code.
3. Routes in both portals: read mine + colleagues' summary, write (kept as you go; debounced on the client), Save for later
   (restart the 30 days, return the end date), discard; saving the check discards the work in the same request. Every write
   re-checks write access server-side.
4. `/legal`, light: the product now keeps a person's unfinished check on its servers with their name, shown to colleagues on that
   account. Confirm the privacy policy's list of what we keep and the Data Terms cover it; apply or record an owner question.
5. Tests: the gate (a view-only coach and a non-member are refused), the expiry, the colleagues' summary carrying no figures, the
   discard on save.

## Part 2 — the two cards, to the drawing

Both portals' cards take the drawing's seven states (tabs 1–7): no saved work, in progress (strip + marks + foot), Change
(fields in place, one lime "Use these", the rest dimmed), found again (with the pill's sub-line at 2+ accounts), books moved
(the shipped amber box), a colleague's quiet line, and the last 7 days (warn-ink line). Phone 390: the foot stacks, Save this
check first; inline links keep a 44px tap box. Replace the browser store with the routes; keep `keepOffered` and the anchor
helpers; remove `clearAllDrafts` from sign-out; show a failed keep on the card. `/marketing` settles the new strings first;
`/design` on the built cards at 1440 and 390 before hand-off. Raise the "Still waiting? No" question with the owner.

## Part 3 — help, reviews, the walk

- `/docs`: both help articles' "What it keeps" and the shared-computer note rewritten (any device you sign in on, 30 days,
  Start over confirms when lines are marked, a colleague sees who has a date saved); keywords and searchText follow; the one
  spelling gate.
- `/review` on the whole S7 diff; `/simplify` first if the two cards grow a shared hook (they will want one).
- `check:layout --changed` on the two bank screens; `npm run verify:changed`; typecheck (shared module + new routes).
- **One owner walk per portal** replacing §490 and §491 (a checkable Artifact, 20–50 boxes, one action a step, exact logins),
  including a second device or a second browser profile to show the work following the person, and a second person seeing only
  the quiet line. Fixtures on dev only, torn down after he reports.
- Record the stage in plan §4 and the board line in the same commit as the work.

## Don't

- Don't add release timing to anything; sequence by dependency.
- Don't edit shared automation, hooks or settings.
- Don't read production rows (counts and schema only); a question needing a person's row is answered on dev.
- Don't commit or push without his word.
