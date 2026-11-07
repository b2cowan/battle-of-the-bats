# Bank balance check BC8: the coach's touchpoints and the club's read (build prompt, two sessions)

> **BC8a done 2026-11-07** (built, walked on dev, /design, /review; plan §9 BC8 holds the record, §0 the three rulings: the
> Teams column is WITHDRAWN (B), "Bank not checked yet ›" before the first check, no window sentence without a check).
> **Next: BC8b.** ⚠ For BC8b: the Overview line sits under the Cash on hand card's IN/OUT bars, not in its foot (the walk;
> owner shown); Close the season has its own sentence now; the season windows exist only on a STANDALONE team (walk them on
> `uat-standalone`, `.probe/bank-bc8/bc8a-windows.mjs`); the /design and /review notes for the words are in plan §5.

> **Written 2026-11-06**, after BC7 was committed (BC7a `d5c9a4dbc`, BC7b `7d69006b7`; plan §9 BC7). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC8_BUILD_PROMPT.md` into a new chat on `dev`.** The first session
> builds **BC8a**; it ends by writing one line at the top of this file ("BC8a done …, next BC8b") and the second session
> starts at BC8b. ⚠ **First check BC7b is committed** (`git log --oneline -8 -- components/coaches/bank` shows a "BC7b"
> commit). If it isn't, stop and ask the owner.
>
> **The Stage 14 gate is met, verify it in one look.** Plan §9 held BC8 "after Stage 14" because Stage 14 owned the
> season windows' files (`components/coaches/StartNextSeasonModal.tsx`, `CloseSeasonModal.tsx`) and the roll
> (`lib/rep-season-rollover.ts`). Stage 14's six sessions are committed (S6 `4b7341f08`) and its build prompt's "Still open"
> notes "the stage is closed" (owner, 2026-11-06, skipping its `/demos`); its Definition of done is not ticked, but what
> is owed there (the staging layout sweep) touches no file. Before
> editing either window, run `git status --short -- components/coaches/StartNextSeasonModal.tsx components/coaches/CloseSeasonModal.tsx`:
> another session's uncommitted hunk there means stop and ask.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`; `.probe/bank-bc7/commit-b.sh` +
> `commit-b.cjs` is a working copy of it, incl. "HEAD + my exact edit" for `TODO.md` and a shared stylesheet). ⚠ This
> repo's shell drops backslashes in heredocs, a backtick inside a `node -e` string EXECUTES, and PowerShell turns a
> backtick-r inside a double-quoted string into a carriage return: write edit scripts with the Write tool, or use the Edit
> tool. ⚠ New files and new shared modules mean a dev-server restart before the owner looks in a browser (AGENTS.md, stop
> the server BEFORE deleting `.next`; other sessions use the same server, so say so before restarting it).
>
> **Why two sessions:** BC8a is the owner's question about the club's Teams column and three small reads on existing
> screens (the coach's Money Overview line, the two season windows' warning, the Teams column if ruled in). BC8b is a new
> printable page (the team report), the coach help article and the coach words' `/marketing` pass, which wants every
> coach line on screen first.
>
> **Not in BC8:** BC9 (the owner walk of both portals, `/marketing` putting "bank reconciliation" back, `/demos`); the prod
> apply of migrations 447, 449 and 450 (`MANUAL_PROD_STEPS.json`, one promote with the bank code); any change to
> `lib/rep-season-rollover.ts` (the warnings live in the windows' lists only); any club view of a coach's books beyond what
> the owner rules below.

## What is already there (read the code, not this list, before acting on a claim)

- **The coach's server (BC6b):** `GET /api/coaches/{orgSlug}/teams/{teamId}/bank` answers `{ account, canWrite, season,
  checks (newest first), checkedThrough, figure }`; money read reads, money write writes; no live season is
  `season_not_live` 409. "Never checked" is `checks.length === 0`, never `account === null`.
- **The coach's screen (BC7):** Money → Ledger → View: Bank, `components/coaches/bank/` (`CoachBankView` head line
  "Team bank account · checked through {date} · Matches / Off by $X", `CoachBankCheck`, `CoachBankFind`, `CoachBankWindow`
  the opened check, `DotPart`). Guard `tests/unit/bank-coach-view-guard.test.ts`. Walk `.probe/bank-bc7/walk.mjs`
  (sign-ins, the money-read assistant fixture, cleanup).
- **The club's touchpoints to copy from, not to share by force (BC5):** the Accounting Overview's bank line
  (`BANK_WORDS.overview*`), the fiscal-year close's bank row, and the printed check (`BankCheckReport.tsx`, desk only,
  "Print this check" for everyone who can open a check; the engine's report terms run bank first). ⚠ They are the ADMIN
  kit; the coaches portal has its own look. Only look-free pieces are shared (`lib/bank-screen.ts`, the engine): plan §0
  "Coach sharing".
- **The coach's Money Overview:** `app/[orgSlug]/coaches/teams/[teamId]/accounting/OverviewDashboard.tsx` (the Cash on
  hand card). **The season windows:** `components/coaches/StartNextSeasonModal.tsx`, `components/coaches/CloseSeasonModal.tsx`
  (head-coach-and-standalone-only doors, CLAUDE.md's season rule; unsettled money WARNS, never blocks).
- **The club's Teams tab:** `components/admin/kit/club/money/TeamsTable.tsx` and its team-scoped cash read
  (`teamCashHeld`; "Held by the team"). ⚠ `tests/unit/bank-r2-server-guard.test.ts` §2 forbids a club bank file importing
  `bank-coach-*`, and `tests/unit/bank-coach-routes-guard.test.ts` §3 allows the coach's bank only in its own files and the
  coaches portal (D1). A club column that reads a team's checks is a DELIBERATE change to those guards, never a quiet one.
- **⚠ Quiet reads (BC5a's lesson):** migrations 447/449/450 are not on prod. Any read the Overview or a season window adds
  must be quiet: a failed read leaves the line out and logs, it never takes down a core screen.
- **Words:** `lib/bank-tab-words.ts` (the club's settled words; the coach's `coach*` drafts), `lib/bank-check-words.ts`
  (refusals). Plan §5 lists every coach draft waiting for this stage's `/marketing` (BC7a, BC7b, Q1-A's divider,
  "Statements from this season only…", and BC6a's flag: the drafted refusal "…Check it from last season before you start a
  new one." sends the coach where the bank isn't).

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (rulings, B9, K6–K8, "Coach desk and reader", "Coach sharing", the BC5b report
   rulings "Report door / Report books changed / Report order / Report extras"), §5 (the coach rows and drafts), §6 R0 tab 7
   (where the mark shows: the coach Overview line, the Teams column, the season windows' sentence) and tab 9 (the report,
   incl. the coach's footer and what the team report drops), B9 (~line 1445), §9 BC5, BC7 and BC8.
2. The drawings: `BANK_BALANCE_CHECK_DRAWINGS.html` (https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN). Settled words in
   code win over the frames' drafts. If a BC8 surface has no frame, say so in the UX summary and build it from the club's
   walked equivalent (as BC7 did).
3. Memory: `decision_coach_books_stay_the_teams` (the owner's 2026-11-06 ruling), `feedback_past_decisions_are_reference_not_authority`,
   `feedback_money_figures_one_joined_band`, `feedback_clickable_design_annotations`, `feedback_portal_is_the_formatting_benchmark`,
   the coaches-portal season rule in CLAUDE.md, `reference_memory_index_settled.md` "UI conventions".
4. Guards: the two bank guards above, `bank-coach-view-guard`, `coach-history-endpoint-guard` (no year parameter), anything
   pinning the Overview's Cash on hand card or the two season windows (grep `tests/unit`).

---

## BC8a — the owner's question, the Overview line, the season windows, the Teams column (session 1)

### Ask the owner first (one AskUserQuestion, before the UX summary), only what the code, the drawings and §0 leave open

Verify each against the plan and the code first; drop a question a ruling already answers; add one the code raises.

1. **The club's Teams column "Bank checked"** (R0 tab 7; B9 ruled A on 2026-11-05, which includes it). ⚠ **Push back,
   don't just ask:** on 2026-11-06 the owner ruled the club's view of a coach's books is "at a good place right now, we
   want to maintain that independence" (`decision_coach_books_stay_the_teams`: one "Held by the team" figure, never more).
   That ruling is newer, and its REASON (the coach's independence) is wider than the items it listed. "Off by $X" on a club
   screen is a figure from the coach's books. **Recommend B: no club column**, and record that B9's Teams mark is withdrawn
   by the 11-06 ruling. Options: **A** as drawn ("Through {date}" + Matches / amber "Off by $X"; linked teams only, never a
   standalone team; the guards changed on purpose); **B** no column (recommended); **C** the date only ("Checked through
   {date}" / "Not checked yet", no result and no amount: assurance without a figure). Name the cost of each in the question.
2. **The coach Overview line when the team has never checked** (R0 tab 7 draws the checked state). Recommend "Bank not
   checked yet" as the door to the Bank view (it is how a coach finds the feature), for money read and money write alike;
   the alternative is no line until the first check.
3. **The season windows' warning when the team has never checked.** The drawn sentence assumes a check exists. Recommend:
   no warning for a team that never used the bank check (don't nag a coach about a tool they don't use), and the drawn
   sentence whenever one exists, whatever its date. Ask only if §0 or K6 doesn't already say.

Record the answers in plan §0 as ruled (add nothing they did not rule), and update B9 / R0 tab 7's line if the column is
withdrawn or changed.

### Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: a plain-language summary for a product manager first: what the coach sees on the Money Overview (the
line, where, what it says in each state, where it goes when tapped, the amber chip opens what it names), what the head
coach sees in Start next season and Close the season (the sentence, warn never block), what the club sees on its Teams tab
(as ruled), who sees what (money read / write / none; club roles), what a team with no live season sees (nothing: the
season gate already sends it to the closed-season page), and what is drawn vs built from the club's walked equivalent.
Wait for yes.

### The build (from the drawings and the club's walked touchpoints; settled words win)

1. **The coach's Money Overview line** in the Cash on hand card's foot, right of "Ledger": "Bank checked through {date} ·
   Matches" / amber "Off by $X" (a door: every highlight opens what it names) / the never-checked wording as ruled; it
   opens Ledger → View: Bank (`?section=ledger&view=bank`). One quiet read of the existing bank route (no `?date=`), money
   read and up; a coach without money access sees no line (the card already gates on money: confirm). Phone: the line
   wraps as the card's foot does (`DotPart`'s rule: never a lone "·").
2. **The season windows' warning** in `StartNextSeasonModal` and `CloseSeasonModal`, in their existing lists only (K6):
   "The bank is checked through {date}. Check the season's last statement before you {start the new season | close}: the
   new season's Bank view starts from its own opening balance." (R0 tab 7; drafts for BC8b's `/marketing`). Warn, never
   block; a quiet read; nothing in `lib/rep-season-rollover.ts` changes. A door to the Bank view only if the window can
   leave without losing what the coach typed (the one-window rules); otherwise the sentence alone.
3. **The Teams column, as ruled.** A or C: a team-scoped club read beside `teamCashHeld` (linked teams only, a standalone
   team is read by no club; who can open the Teams tab today is who sees it), the two guards changed deliberately with the
   ruling cited in the test, and the words drafted for BC8b. B: nothing built; the ruling recorded; the guards stay.
4. **No migration, no route change** unless the Teams column (A/C) needs a club route; a server gap is a finding for the
   owner.
5. **Checks:** the bank tests and guards, the Overview's and the windows' tests, `npm run typecheck`
   (`NODE_OPTIONS=--max-old-space-size=8192`), focused lint, `check:spelling`, `check:tokens`, `check:css-purity`, and
   `check:layout -- --only=<ids>` on a warm dev server for the coach Overview (and the Teams tab if built).
6. **The walk probe** `.probe/bank-bc8/bc8a.mjs` on dev (copy BC7's sign-ins; a money-read test coach needs BOTH a
   `rep_team_coaches` row AND an active `rep_team_staff_memberships` row, or the Money hub says "Forbidden"): the Overview
   line never-checked → after a matching check → after an off check (the chip opens the Bank view), money read sees the line,
   the two windows show the sentence and still proceed-able (open them, never confirm a roll or a close on the shared UAT
   team), at 1440 and 390. It removes everything it made.
7. **Then** `/design` (the line and the sentence against the portal's rules), `/review` (standard), records (plan §9 BC8,
   §0 rulings), the "BC8a done" line here, commit on the owner's yes, recommend `/clear`.

---

## BC8b — the team report, coach help, the coach words (session 2)

**Start here (written at the end of BC8a, 2026-11-07).** Paste `execute @docs/projects/active/BANK_BALANCE_CHECK_BC8_BUILD_PROMPT.md`
and begin at BC8b; first check the BC8a commit is in (`git log --oneline -3 -- components/coaches/bank` shows "BC8a"). What
BC8a left that this session needs:

- **The UX summary comes first, and the owner's open asks are few.** BC5b's report rulings (§0 "Report door / Report
  books changed / Report order / Report extras") carry to the team's report unless the code says a team differs. Ask the
  owner only what they leave open. Likely: whether the coach's report keeps "Prepared by / Reviewed by" lines (a team has
  no treasurer role of record; a coach may hand the page to the club's treasurer or the association), and the report's
  footer location words now that the Overview line also leads to the Bank view. Verify both against §0 before asking.
- **The report door.** `tests/unit/bank-coach-view-guard.test.ts` §2 asserts the opened check has NO print ("BC8's
  team report"): change it on purpose, in the same commit, to pin "Print this check" for money read AND write, desk only
  (absent ≤640). Read `components/admin/kit/club/money/bank/BankCheckReport.tsx` and its module for the engine's look-free
  report terms and the BC5b dark-theme trap (th/td reset to paper ink); the coach's page is drawn in the coaches portal's
  look, so share only the look-free terms (`/simplify` judges any move).
- **The words pass has more drafts than the prompt below lists.** Plan §5 now holds BC8a's: "Bank checked through {date} ›",
  "Bank not checked yet ›", and the two season sentences (Start next season's drawn one; Close the season's own, "…before
  you close: a closed season has no Bank view."). The /design and /review notes in §5: neither sentence says when the
  latest check is OFF, and a MATCHING check sits in Close the season's amber "Before you do" box as loud as money owed;
  propose a fix to the owner (e.g. the row only when off, or a quieter line when it matches), don't just reword.
- **Where things are now:** the Overview line sits under the Cash on hand card's IN/OUT bars, above the foot (not "right
  of Ledger": the walk). The chip opens its check through `?bankCheck=`; open the Bank view from a link the same way if
  the help article needs a deep link. The season windows exist only on a STANDALONE team: walk them on `uat-standalone`
  (`.probe/bank-bc8/bc8a-windows.mjs` is a working copy: the Settings "Season" section is a native `<details>`; the
  sidebar's SEASON group has the same name).
- **Help (`/docs`) covers the coach's Overview line and the two windows' sentence too**, in `lib/help-content/coaches.tsx`;
  `check:spelling` gates keywords and searchText.
- **Not BC8b:** the club Bank tab's own chip door (it opens the check and rewrites the address in one effect, the shape
  that reopened a check on Back in BC8a's walk) is BC9's re-walk; the admin kit is out of scope here.

1. **The team report** (K8, R0 tab 9, the BC5b rulings carried unless the owner said otherwise): "Print this check" in
   `CoachBankWindow` for everyone who can open a check (money read too), desk only (hidden ≤640), one printable US Letter
   page from a SAVED check: bank first as the club's (Bank balance on the statement · + Not in the bank yet · − Cash not
   deposited yet · = Should be in the bank · Your books on {date} · Result · "Checked by {name} ({role}), {date} at
   {time}" with `formatTime` · "Books now say $X" when it applies · Prepared by / Reviewed by lines · footer "Printed
   {date} from FieldLogicHQ · {team} · Money → Ledger → Bank"). It drops "Against the team's Ledger", "Not counted" and
   any online-payments line (a team has none). Reuse the engine's look-free report terms; draw the page in the coaches
   portal's look. ⚠ BC5b's trap: printed table cells inherit the app's screen inks, so on a dark theme they printed white
   on white; reset th/td to paper ink in the report's module. Prove it prints one page (the walk's `page.pdf`).
2. **Coach help:** run `/docs` for the coach's Bank view (Money → Ledger → View: Bank: what it's for, the date and balance,
   Cash not deposited yet, the band, Find and Not in the bank yet, Add the missing line, saved checks, the report, "this
   season only", money read vs write) and the Overview line; in `lib/help-content/coaches.tsx`, keywords and searchText in
   the settled spellings.
3. **`/marketing` on the coach words:** every coach draft in plan §5 (BC7a, BC7b, Q1-A's divider, "Statements from this
   season only…", the cash words), the Overview line, the season windows' sentence, the report's words, and BC6a's flag
   (the "…Check it from last season…" refusal). Settled words go into `lib/bank-tab-words.ts` / `bank-check-words.ts`; tick
   §5.
4. **The walk** `.probe/bank-bc8/bc8b.mjs`: the report from a saved check (money write and money read), one page, the
   settled words on the view, the Overview line and the windows; 1440 and 390 (the print door absent at 390). Screenshots
   for the owner. It removes everything it made.
5. **Finishing passes, in this order:** `/design` (the report against R0 tab 9 and the portal's rules), `/simplify` (a
   shared piece between the club's and the coach's report is likely: only look-free pieces move), `/review` (standard).
6. **Records:** plan §9 BC8 + §5 ticks, the TODO line as HEAD + your exact edit, the auto-memory note
   `project_bank_reconciliation.md` and its MEMORY.md line, the PM brief. Mark this prompt done. Commit on the owner's yes,
   then hand off in product-owner voice with how to look at it (which team, which sign-in, desk and phone), and say what's
   next: **BC9**, the owner walk of both portals (a checkable page and a § in the Owner QA Ledger), `/marketing` putting
   "bank reconciliation" back, `/demos`; then the prod apply of 447/449/450 with the bank code in one promote.

## Out of BC8

BC9's walk and marketing truth, the prod apply of 447/449/450, `lib/rep-season-rollover.ts`, any club read of a coach's
books beyond the owner's Teams-column ruling, any admin-kit component change the owner hasn't agreed to, hooks, checks or
baselines.
