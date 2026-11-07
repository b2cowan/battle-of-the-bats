# Bank balance check BC7: the coach's Bank view in the Ledger, desk and phone (build prompt, two sessions)

> **✅ BC7 DONE 2026-11-06.** BC7a (desk) committed `d5c9a4dbc`; BC7b (the phone, the walk 95/95, `/design`, `/simplify`,
> `/review`) built 2026-11-06 — plan §9 BC7 has the anchors and the commit; `git log -- components/coaches/bank`. Nothing
> left to execute here; next is BC8 after Stage 14.

> **Written 2026-11-06**, after BC6 was committed (BC6a `60947d02c`, BC6b `4adaab834`; plan §9 BC6). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC7_BUILD_PROMPT.md` into a new chat on `dev`.** The first session
> builds **BC7a**; it ends by writing one line at the top of this file ("BC7a done …, next BC7b") and the second session
> starts at BC7b. ⚠ **First check BC6b is committed** (`git log --oneline -8 -- lib/bank-coach-steps.ts` shows a "BC6b"
> commit). If it isn't, stop and ask the owner.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`; `.probe/bank-bc6/commit-b.sh` +
> `commit-b.cjs` is a working copy of it, incl. "HEAD + my exact edit" for `TODO.md` and `DATA_DICTIONARY.md`). ⚠ This
> repo's shell drops backslashes in heredocs and a backtick inside a `node -e` string EXECUTES: write edit scripts with
> the Write tool, or use the Edit tool. ⚠ New files and new shared modules mean a dev-server restart before the owner
> looks in a browser (AGENTS.md, stop the server BEFORE deleting `.next`).
>
> **Why two sessions:** BC7a is the view on a desk: the fourth View option, the check form with Cash not deposited yet,
> the band and sums, Find with Not in the bank yet, the saved checks, the opened check and Delete, and the read-only view
> for money read. BC7b is the phone (one column, Find as row cards, Save last, as BC4b did for the club), the walks at
> both widths and the finishing passes. Neither touches the server's rules (BC6 owns them); a server gap found here is
> a finding, not a quiet fix.
>
> **Not in BC7:** the Money Overview line, the Start next season / Close the season warnings, the team report, the
> club's Teams column, coach help in `coaches.tsx`, `/marketing` on the coach words (all BC8, after Stage 14); the prod
> apply of migrations 447, 449 and 450 (one promote with the bank code). ⚠ BC8 still owes the owner a question: R0 tab 7
> draws a club Teams column "Bank checked" that reads each team's bank, against the owner's 2026-11-06 ruling that the
> club sees one cash figure per team and never a view into a coach's books (`decision_coach_books_stay_the_teams`).

## What is already there (read the code, not this list, before acting on a claim)

- **The server (BC6b):** `GET /api/coaches/{orgSlug}/teams/{teamId}/bank[?date=]` answers `{ account, canWrite, season:
  { name, start }, checks (newest first, each a CheckView with its band, result, Books now say, waiting items, who and
  when), checkedThrough, figure }`; with a date, `figure` = `{ refused, seasonStart, booksCents, suspects, lastSeason,
  stillWaiting, replaces }` (`lib/bank-coach-rules.ts` `CoachFigureForDate`). `POST …/bank/checks { date, bankCents,
  cashCents?, waiting: [lineKey…] }` (201, answers the bank read again, not the new id); `DELETE …/bank/checks/{id}`.
  Refusals are `{ error, code }` from `lib/bank-check-words.ts`. No live season: `season_not_live` 409 on every verb.
  ⚠ **For BC7 (plan §9 BC6):** "never checked" is `checks.length === 0`, never `account === null`.
- **The Ledger:** Money hub `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx`, `?section=ledger`, panel
  `LedgerPanel` in `accounting/expenses/panel.tsx`. Its arrangements are `LedgerView = 'timeline' | 'bills' | 'due'`
  (`LEDGER_VIEW_LABEL`, `isLedgerView`, `?view=`, remembered per team in localStorage), drawn by the shared
  `SingleSelectDropdown` labelled "View" (the options array is written out where `viewPill` is built). Money write on the
  client is `useCoachSeasonPage(…).capabilities?.money === 'write'`; the server's `canWrite` decides the bank form.
  Verify every line number before editing: the file is ~7,000 lines.
- **The club's Bank tab to copy from, not to share by force:** `components/admin/kit/club/money/bank/` (BankTab,
  BankCheckForm, BankFigure, BankFind, BankStatements, BankCheckWindow, BankCheckReport, BankMoneyField, BankShared,
  BankSetup, BankWindows). ⚠ It is the ADMIN kit (RepKit, MoneyKit, ClubKit.module.css); the coaches portal has its own
  look (warm, `coaches.module.css`), and `bankUrl` / the `AccountView` type are hard-wired to the club's routes. The band
  already rides the coaches' `MoneySummaryBand`. `tests/unit/bank-r2-server-guard.test.ts` §2 forbids a club bank file
  importing `bank-coach-*` (D1), and `tests/unit/bank-coach-routes-guard.test.ts` §3 allows the coach's bank only in its
  own files and the coaches portal (`components/coaches/`, `app/[orgSlug]/coaches/`). ⚠ `lib/bank-coach-read.ts` and
  `-steps.ts` are `server-only`: a client screen imports types only.
- **Words:** `lib/bank-tab-words.ts` (the club's settled screen words, BC2–BC5 `/marketing`), `lib/bank-check-words.ts`
  (refusals; `before_season` and `bad_team_item` are BC6a drafts). Plan §5's coach rows: "Statements from this season
  only, since {date}.", "From the {2025 Season}" (open), the cash word.

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (rulings 1, 3, asks 1–10, Q1, B7, B9, B10; the BC6a rulings "O5: season start",
   "Q1 look-back", "Still waiting across the rollover"), §5 (the coach rows), §6 (the coach build notes: the phone line,
   "Add the missing line" opens the ordinary coach Ledger add, the Overview link, **K7** the read-only coach view, the
   report footer), §9 BC6 (the routes, the kept edges, "For BC7") and BC7–BC8.
2. The drawings: `BANK_BALANCE_CHECK_DRAWINGS.html` (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN). Coach frames:
   tab 2 "coach · Money → Ledger, View: Bank · phone" (Ridge 13U: "Team bank account · checked through …", the optional
   Cash not deposited yet, the caption "your books, less $X cash", the sums, Save, "Statements from this season only,
   since …"), the "coach's season" note, tab 4's cash options (A/B/C), tab 5's mark, tab 6's "no starting question".
   ⚠ **There is no coach DESK frame and no read-only frame** (ask 1). Settled words in code win over the frames' drafts.
3. The club's walked Bank tab (desk and phone) as the model for everything the coach frame doesn't draw; BC4's prompt
   (`BANK_BALANCE_CHECK_BC4_BUILD_PROMPT.md`) for the phone recipe (row cards, 10 at a time, signed amounts, Save last).
4. Memory: `feedback_build_to_approved_mockups`, `feedback_draw_controls_from_shipped_component` (the view switch is ONE
   white track), `feedback_money_figures_one_joined_band`, `feedback_clickable_design_annotations`,
   `feedback_portal_is_the_formatting_benchmark`, `decision_coach_books_stay_the_teams`, the coaches-portal season rule
   in CLAUDE.md, `reference_memory_index_settled.md` "UI conventions".
5. Guards: the two bank guards above, `tests/unit/coach-history-endpoint-guard.test.ts`, anything pinning the Ledger's
   views (grep `tests/unit` for `LedgerView`, `LEDGER_VIEW_LABEL`, `flhq-coach-ledger-view`).

---

## BC7a — the Bank view on a desk (session 1)

### Ask the owner first (one AskUserQuestion, before the UX summary), only what the code and the drawings leave open

Verify each against the code and the drawings first; drop a question they or a ruling already answer; add one the code
raises.

1. **The desk and read-only frames aren't drawn.** **Recommend:** build the desk from the phone frame laid out as the
   club's walked desk Bank tab (form and band on top, Find beside or below, saved checks under), and the read-only view
   as K7 says (the same view without the form, Find's buttons or Delete); the BC7b walk shows both widths to the owner
   before the commit. The alternative is a `/design` drawing session first (an Artifact, house layout), which holds
   BC7a by a session.
2. **Shared pieces or a coach copy.** The club's bank components are admin-kit. **Recommend:** move the truly shared,
   look-neutral pieces (the band and sums arithmetic, the money field, the Find list's row logic, the opened check's
   figures) into small kit-free modules both screens import, and draw the coach's view in the coaches portal's own
   look; never import the admin kit's bank screens into the coaches portal. Name each piece moved in the question.
   ⚠ A kit component change needs the owner's yes (it moves the club screens too); say which, if any.
3. **Cash not deposited yet:** tab 4's options A/B/C. Check §0 ask 1 and the plan for a ruling first; **recommend** the
   ruled one (the drawing recommends C), ask only if none is recorded.
4. **"Add the missing line" for a coach** (§6: opens the ordinary coach Ledger add): in BC7a, or later? **Recommend** in
   BC7a, through the Ledger's own add window with its date and the fee category it requires, and the view reads the
   bank again after it saves.
5. **Print for a coach.** BC5b's printed check is the club's; BC8 has "the team report". **Recommend:** no print in BC7
   (BC8 decides the team's paper with the report), unless the plan already rules one.
6. **The divider words "From the {2025 Season}"** are open in §5. **Recommend** as drawn, drafts settled by BC8's
   `/marketing`.

Record the answers in plan §0 as ruled (add nothing they did not rule).

### Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: a plain-language summary for a product manager first: where the coach finds it (Money → Ledger →
View: Bank), what a money-write coach does (date, balance, cash not deposited yet; the band; Find; mark Not in the bank
yet; save matching or not; open, re-check or delete a saved check), what a money-read coach sees (the same, no form, no
buttons), what a team with no live season sees (nothing: the season gate already sends it to the closed-season page),
and that the club sees none of it. Say what is drawn and what is built from the club's desk (ask 1). Wait for yes.

### The build (from the drawings and the club's walked tab; settled words win)

1. **The fourth View option "Bank"** in the Ledger's View pill (one `LedgerView` value, its label, `?view=bank`, the
   remembered view). ⚠ Grep every switch on `LedgerView` and every guard that lists the three views; a view a coach
   without money read can't open must not be offered (the Ledger already needs money read: confirm).
2. **The screen** (a coach component under `components/coaches/` or the Ledger's folder, by what the code does): the head
   line "Team bank account · checked through {date} · Matches / Off by $X" (none before a check: say so plainly), the
   form (Statement date, Bank balance, Cash not deposited yet; the day's figure read as the date changes; a refused day
   says its sentence, and "Statements from this season only, since {season.start}." stays under the date), the joined
   band and the sums ("Your books on {D}", "Cash not deposited yet −", "Should be in the bank"), Find (this season's
   lines, then last season's under its divider when `figure.lastSeason`), Still waiting?, Not in the bank yet marks,
   Save (ruling 3: it saves Off by $X too), "Check this statement again" when `figure.replaces`.
3. **The saved checks** newest first with their result and Books now say; one opens the check (its figures, its items,
   who and when); Delete with one question (ask 5). Money read: the same, no Delete.
4. **Refusals** answer through the server's `{ error, code }`, shown where the action was (never prose-parsed);
   `season_not_live` reads as the portal does elsewhere.
5. **No migration, no route change.** A server gap is a finding for the owner.
6. **Checks:** the bank tests and guards, the Ledger's tests, `npm run typecheck`
   (`NODE_OPTIONS=--max-old-space-size=8192` if it runs out of memory), focused lint, `check:spelling`, `check:tokens`,
   `check:css-purity` if the repo has it, and `check:layout -- --changed` on a warm dev server (add the Bank view to
   `scripts/layout-screens.mjs` if the Ledger's entry can't reach `?view=bank`: that file is not a watched automation
   file, but confirm with `scripts/check-agent-automation.mjs` `WATCHED_PATHS` before editing it).
7. **Then** `/review` (standard), records (plan §9 BC7, BC7a's anchors, §0 rulings), the "BC7a done" line here, commit on
   the owner's yes, recommend `/clear`.

---

## BC7b — the phone, the walks and the finishing passes (session 2)

**Carried from BC7a (committed `d5c9a4dbc`; read plan §9 BC7's BC7a line first):**
- The screens are `components/coaches/bank/` (`CoachBankView`, `CoachBankCheck`, `CoachBankFind`, `CoachBankWindow`,
  `coachBank.ts`, `CoachBank.module.css`); the guard is `tests/unit/bank-coach-view-guard.test.ts`; the layout id is
  `coach-ledger-bank`. At ≤760 the fields only stack two-up today and Find/saved checks fall back to the portal's
  `tableAsCards`: BC7b replaces that with the drawn phone frame.
- The band's tiles come from `bankBandTiles` (`lib/bank-screen.ts`, shared with the club): its phone `captionShort` for the
  middle tile is the CLUB's ("Your books, adjusted for what's pending"). The coach frame draws "your books, less $X cash"
  — override it in the coach view only (the club's caption is settled; don't change the shared one).
- Phone row cards: the coaches portal has `CoachRowList` / `CoachRow` (`components/coaches/CoachRowList.tsx`), not the
  club's `ClubRow`; no money screen uses it yet, so check `/design` agrees before building Find's cards on it.
- The walk needs a team with money and a live season: BC6b's probe used uat-rep-club "UAT Test Team" (2026 Season) with
  `UAT_COACH` as writer and a money-read assistant added for the run (`.probe/bank-bc6/bc6.mjs`).
- Kept at BC7a's `/review` (say so to `/design` if it raises them): "Check this statement again" starts with balance, cash
  and marks empty; a Ledger remembered on Bank reopens on Bank; the band's live region announces as the coach types.
- The dev server was not restarted after BC7a (shared); restart before the owner looks, per AGENTS.md.

1. **The phone** (≤ 600px, the club's BC4b recipe): one column, the fields side by side where the frame draws them, the
   cash field wide, the caption "your books, less $X cash", Find as row cards 10 at a time with signed amounts, Save full
   width and last; no sideways scroll at 390 and 361; tap floors (the portal's rule).
2. **The walk probe** `.probe/bank-bc7/walk.mjs` on dev as a uat coach with money write and one with money read (BC6b's
   `.probe/bank-bc6/bc6.mjs` shows the sign-ins and how it adds a money-read assistant for the run and removes it), at
   1440, 390 and 361: View: Bank opens; a first check; a matching save; an off save with a line Not in the bank yet and
   cash; the saved check opens and deletes; a date before the season start shows its sentence; money read sees no form
   and no buttons; screenshots for the owner. It removes everything it made.
3. **Finishing passes, in this order:** `/design` (the screen against the drawing and the portal's written rules), then
   `/simplify` (a shared piece between the club and coach screens is likely), then `/review` (standard). `/marketing` on
   the coach words is BC8's: note any new draft word in plan §5 for it.
4. **Records:** plan §9 BC7 + §5 ticks, the TODO line as HEAD + your exact edit, the auto-memory note
   `project_bank_reconciliation.md` and its MEMORY.md line, the PM brief. Mark this prompt done. Commit on the owner's
   yes, then hand off in product-owner voice with how to look at it (which team, which sign-in, desk and phone), offer
   `/docs` once (BC8 owns the help article; say so), and say what's next (BC8 after Stage 14; its Teams column question
   for the owner).

## Out of BC7

The server's rules and routes (BC6), the Overview line, the warnings, the team report, the Teams column and coach help
(BC8), the prod apply of 447/449/450, any club-side read of a team's bank, any change to hooks, checks or baselines, a
kit component change the owner hasn't agreed to.
