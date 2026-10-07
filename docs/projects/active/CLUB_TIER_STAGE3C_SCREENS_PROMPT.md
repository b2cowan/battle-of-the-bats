# Club Tier Stage 3c · session 2 — the fiscal year on every money screen, its close, New allocation and the payee window (built to hub version 46)

> Paste into a fresh session on `dev` **after session 1 (`CLUB_TIER_STAGE3C_SERVER_PROMPT.md`) is committed**. Its
> call list (routes, shapes, refusal codes, the fiscal year in every read, the lock, the retire list, the `NOT_YET`
> page list) is in plan §6 Stage 3. Written 2026-10-07, the day the drawings were **ratified**: every ask as
> recommended, and **Ask 9 — the club's year is its "fiscal year"**.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 3c**.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW, RESTYLED and UNCHANGED
>   tag note is a requirement; open each one. The flags name the finding each drawing answers.
> - **Ask 9 overrides the drawings' wording:** where a drawing says "The club's year" or "the year", the screen says
>   **"Fiscal year"** — the window's title, the Year pill ("Fiscal year 2025–26"), the close question, the refusals and
>   the year-end report. **Club side only**; the coach keeps "season". The sentences are /marketing's.
> - **"Formatting check"** (`#s3c-format`) is your checklist, every row, and its "Put to you" list is now ruled.
> - Where you must depart, say so at build time and record why; never silently.
>
> **Read first:** plan §6 Stage 3's 3c blockquotes (DRAWN, RATIFIED) and session 1's call list; §6 "Across every
> stage — formatting". Memory: `project_club_tier_readiness`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_build_to_approved_mockups`, `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`,
> `decision_autosave_word_is_transient`, `decision_one_toolbar_rare_tools_behind_tools`, `decision_export_is_one_button`,
> `decision_waiting_count_is_amber_pill`, `decision_close_x_is_plain_glyph`, `decision_drawer_layers_form_vs_menu`,
> `feedback_form_selects_are_dropdowns`, `feedback_required_marker_not_optional_tags`, `feedback_mobile_icon_only_actions`,
> `feedback_shared_component_over_shared_class`. The in-repo `memory/design_decisions.md` entries from 2026-09-02 on,
> especially 2026-10-05 to 2026-10-07 (phone sheets, the olive scope pill, a money tab's figures above its toolbar, the
> close ×, the club's six named differences).

## ⚠ The lessons this programme already paid for

- **The benchmark lives in the code's comments.** 3b's first drawings broke a dozen of the owner's rulings because
  they were made from memory of the coach's screens. Before building any surface that mirrors one, read the component
  it mirrors: the club's Budget and Budget vs. Actual as 3b built them, `HubTabBar`, the money kit, the club's
  `RepKit` rows and the coach's Club tab (`app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx`).
- **A drawing "matched to what was built" freezes an unreviewed screen.** New allocation shipped as a page because a
  drawing copied the build; §271's W2 then passed by ruling because no allocation was ever created in a browser. **This
  session's walk must create one from a budget line and read it back.**

## Preconditions (check before code)

1. **Session 1 is committed.** Read its call list and its four calls (whose books a late payment of an old season's
   bill lands in — ruled by the owner: the season running when it is recorded; the lock's mechanism; the fiscal
   year's key; where a request counts).
2. **The UX summary for the owner comes first** (AGENCY_RULES). Short: what a treasurer, a president, a club admin
   and a head coach each see differently, and any departure.
3. **Git and the dev server:** private index, explicit pathspecs; ask before a sweep or a restart; **one browser tester
   at a time** — ask the owner before any capture, probe or `auth-setup`.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`**, newest first, and its line in `memory/MEMORY.md` in the same change:
  1. **The club's period is its "fiscal year"** (Ask 9): one spelling, the club side only, every surface that reads a
     year; it names a period and promises no fiscal-accounting feature.
  2. **A closed fiscal year is read in place** on the club's money tabs, locked, every write absent (Ask 1) — a
     scoped departure from the coach's "a closed season is one page", for the reasons on the hub's Ask 1 screen (a club
     book runs across years; only the money tabs read a year, and already did).
  3. **Closing and Reopen** use the coach's words and rules (warns, never blocks; Reopen with a reason, the latest only).
  4. **A seventh named difference:** Budget vs. Actual's Compare › Against last year (Ask 8c).
  5. **A table that is a form** (Ask 6): New allocation's teams — the one place a cell holds a control; the shared part
     below.
  6. **A payee's window reads first, its report inside, no Export** (Ask 7).
  7. **An unpaid club bill stays on the coach's Club tab under its season until paid** (Ask 8b).
- **`docs/agents/design/TABLE_AND_LIST_STANDARD.md`:** the **form table** — a table whose rows are a create form's
  fields (a tick, a Share input), allowed only inside a create form; the rows still open nothing; a row may expand in
  place (down chevron); its closing row states the sum and the difference. Tagged shared with the tournament redesign,
  which draws entry forms. A `TABLE_EXCEPTION_REGISTER.md` row only if your build departs from it.
- **`CLAUDE.md`**, one short scoped paragraph in the Coaches Portal season section: the club's fiscal year is a
  different thing, read in place on the club's money tabs by owner ruling 2026-10-07, so no later session "corrects"
  the club to one page. Nothing else in that section changes.
- **`check:spelling`:** the owner's Ask 9 ruling is the ruling the gate needs to enforce **"financial year"** as a
  variant of "fiscal year" in customer-visible copy (escape hatch `spelling-ok` for a quoted statute). Its own commit;
  say what the gate now refuses.

## What to build

### 1. The fiscal year's window (specimen 1; Asks 5, 9)

- **Budget › Tools › Fiscal year**, the first row above Categories. A **record**: reads first (when the year starts,
  this year's span, the closed years), one borderless pencil turns the whole window into its form, ✓ turns it back;
  no pencil for a reader. The name autosaves (the floating pill); **the first month asks** — a dropdown of the twelve
  months, the months strip under it, and the consequence shown **before** the save (session 1's preview: which year
  keeps its months, which is short and by how much, where the first full year starts, how many planned lines move and
  where; ledger lines never move), decided by two buttons, a question inside the record. After the first close the
  first month reads only.
- **A new club** meets it on its first, empty plan: one quiet line under the empty state with an olive door; it shows
  only while the club has never set its year and has no plan.
- **The short year** reads like any other: the Year pill names it, its menu row adds "8 months" (the one exception to
  the bare rows), the grid shows its own months.
- **Phone:** the sheet's form layer (a title, a 44px ×, the bar covered), the months strip in initials, the years as
  short records in one frame, the two answers in the foot at full width.

### 2. Every money page reads a named fiscal year (specimen 2)

- **The Year pill** on Budget, Budget vs. Actual and the Overview prints the fiscal year's name, keeps the §271 bare
  rows and adds two glyphs with spoken names: a **lock** on a closed year, an olive **dot** on the year today falls in.
  The page opens on the year today falls in. Its stored choice moves to session 1's key.
- **Every sentence that printed a number prints the name** ("Net for 2026–27", "No plan for 2027–28 yet", "Start from
  2026–27's plan", "On the 2026–27 plan"), the export's title carries the name and the year's two days, a file name
  writes the en dash as a hyphen.
- **The club's quarters** start at its first month and are named by their months; the coach's are unchanged.
- **Empty the guard's `NOT_YET` page list**: every page that worked a year out by hand reads the year from its payload.

### 3. Closing a fiscal year, and a closed year read in place (specimen 3; Asks 1–3, 8d)

- **The Overview's line:** from the day after a year ends until someone closes it, one quiet line at the top names the
  year and the day it ended, with an **outlined** "Close 2025–26" (it opens a window); only to `canMoveClubMoney`.
- **The close question** (desk window; phone sheet's form layer): what it locks (every club-owned book's lines in the
  year, and the plan), what carries (the closing balance, locked), and the **four kinds of open money**, each counted,
  totalled and a door (right chevron) to the page that settles it; "Not yet" and Close. It warns and never blocks.
- **A closed year, read in place:** one line under the toolbar (closed, by whom, when; reopened, by whom, when and why);
  the lock on the pill; **every write absent, not greyed** — no Add line, no Start from, no line pencil, no Allocate;
  Tools keeps only its reads. A line's window reads with its two writes gone; an unbilled part says the club paid it.
  The allocation's page still receives its owed installments (dated today). The band's Cash on hand is the year's
  **closing**, at its last day.
- **The refusals in words:** Add entry's date field, as soon as a closed-year date is picked, says why under the field
  with the two ways out, and the add stays disabled; Undo, Reverse and Void are **absent** on a line dated in a closed
  year, with one locked sentence in their place (pointing at Reopen).
- **Reopen:** on the latest closed year only, an outlined button opening a window with a **required reason**; an older
  closed year reads "Only 2025–26, the latest closed year, can be reopened." Re-closing shows the same question with
  what changed since.

### 4. The year that opens (specimen 4; Ask 4)

- The Budget's opening row: on a year whose predecessor is closed, **locked**, with one caption saying where it came
  from; while the predecessor is open, as today.
- **"From 2025–26, still open"** on the Overview, under "Where the club stands", only while something is open: each
  unpaid installment and waiting request a row opening the page that settles it, the waiting count the amber pill; the
  section leaves when the last is settled. The ended-year line has gone once the year is closed.
- **Budget vs. Actual:** under From the teams, "last year's bills, paid this year" as its own line, **Budgeted blank**.

### 5. The annual meeting's papers (specimen 5; Ask 8c)

- **Compare › Against last year** on the Statement (club only): this year's Actual, last year's Actual, the Change
  (signed, coloured as a verdict only where the board reads one — the coach's Variance rule); the heading names the
  span compared (whole years; to the same day; the same months against a short year). Rows, folds and doors are the
  coach's, unchanged.
- **The Year-end report:** on a closed year the Overview's one Export writes it (Excel first, then PDF), in the
  drawing's order — the span and who closed it, the year at a glance, the Statement against budget and last year, the
  books at both ends, the teams' standing, what carried, and **the one line in place of the teams' cash**. Draw the PDF
  from the printed page on the hub (`#s3c-papers`). On an open year the Export stays 3b's board report.

### 6. New allocation, in the line's window (specimen 6; Ask 6)

- **"Allocate $X"** turns the line's window into the form in place: the head says what is billed and from where (what
  is left, what was already allocated), the body is the form, the foot has Cancel (back to the line, nothing made) and
  the lime **Create allocation**. No step bar. The window widens to fit its table; on a phone it is the whole screen.
- **Split and Pay, chosen once per bill:** Evenly · By amount · By percentage · By sessions; One payment or Installments
  with their dates. Labels in sentence case; **no "(optional)"**; required marked with the plain asterisk; **"Season",
  never "Program Year"**.
- **The teams as a form table** (the shared part from Part 0): Team · Season · Share · Due; every team that can be
  billed listed and ticked; a team with no open season listed, unticked and dim, with the reason; Share is an input
  under By amount, By percentage or By sessions; a row expands in place (down chevron) to give that team its own
  installments; the closing row sums the ticked teams and states the difference from the amount. **Build it as one
  shared component**, not a class.
- **Create returns to the line**, reading: the new allocation listed, Allocated updated, the unbilled part gone if
  nothing is left; the floating pill says what was made, once, and fades.
- **From Allocations, the same window** asks first what it bills from: a cost line on the open year's plan with
  something left (each with what's left), or "an off-plan bill". Picking a line fills the head and caps the amount.
- **Phone:** the form layer; the table becomes one frame of short records (team, then season and due, the share at
  the end), the ticks kept, a row opening in place; Cancel and Create in the foot.
- **The old New allocation page retires** (its Rep Teams stylesheet, inline overrides, its own money formatter, the
  hand-built step bar); its address forwards to Allocations with the window open.

### 7. A payee's window reads first (specimen 7; Ask 7)

- **The record standard:** the window opens to read (shared or not, and since when; how many of the club's own entries
  name it); the pencil turns Name and the Shared with teams switch into the form (the name autosaves; the switch saves on
  the tap); ✓ turns it back. Merge and Delete stay in the foot in both modes.
- **The report is the window's body** for a shared payee (3b's note, shortened; each team folding to its payments; the
  total; "Nothing recorded"; the counting rule), with a small Year pill in the section's head **only when the payee has
  records in more than one fiscal year**. While editing, the report folds to its one line. An unshared payee has no
  report section and nothing in its place.
- **No Export.** The report page and its address retire; an old link forwards to the Payees list with this payee's
  window open. Phone: the full-screen sheet.

### 8. The coach's side (specimen 8; Ask 8b)

- **Money › Club:** above the working season's bills, any bill still owed on an earlier season, under one band naming
  that season; **Still to pay the club** counts it and its caption says where it is from; **Settled this season** stays
  this season's. Paid, it leaves the tab. "We've sent it" and Take it back work as on any bill. The club's fiscal year
  and its year-end are never named on the coach's side. Words are /marketing's. The payment counts in the season
  running when it is recorded (S3C-11, ruled); the screen says nothing new about it.
- `check:register`, `check:money-report` and `coach-history-endpoint-guard` stay green; the coach's closed-season page
  doesn't move.

### 9. The old look's retirement

- In every file 3c rebuilds: the old New allocation page, the payee report page, the payee window's always-editing
  form, the Budget's and Budget vs. Actual's leftovers the year work touches. `npm run check:old-look:report` before;
  lock **your own** drops with `--init` in the same change (`--init` also locks other sessions' drops — hand-drop your
  entries if a peer has uncommitted ones).

## Help, words, walks

- **`/docs`:** the fiscal year (setting it, the short transition year), closing and reopening, a closed year read in
  place, the year-end report and Against last year, New allocation from a line and from Allocations, a payee's window,
  and the coach's Club tab band. The old New allocation and payee report steps go.
- **`/marketing`:** every tagged sentence — the window's consequences, the close question, the refusals, Reopen, the
  still-open section, "last year's bills, paid this year", the year-end report, the payee window's note, the coach's band
  and caption. Draft them, tagged; don't ship placeholders.
- **Walks §G** on the hub's QA tab: checkable walks, **one purpose each**, pinned to identities not figures (memory
  `feedback_qa_walkthroughs_as_checkable_artifacts`). Take the next Owner QA ledger § **at the moment you write it**
  (grep the ledger first; sessions collide on numbers). At least: setting the fiscal year (a new club, and the
  transition); every page reading the named year; closing a year (writes); a closed year read in place and its
  refusals; Reopen (writes); the year that opens; Against last year and the year-end report; **New allocation —
  create one from a budget line in the window and read it back on the line and on Allocations** (the definition of
  done); New allocation from Allocations, including an off-plan bill; a payee's window; the coach's earlier-season
  bill. Session 1's fixture holds the data; a walk that writes says it can be walked once.

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files, `check:club-money-arithmetic`,
  `check:spelling` (with the new variant), `check:css-selectors`, `check:public-tokens`, contrast checks,
  `check:old-look`, the one-definition guard with `NOT_YET` empty of the 3c pages.
- **`check:layout`, both themes,** on every touched screen, club and coach (ask the owner first; batches of about ten
  with `--only=` — a shared stylesheet with `--changed` sweeps everything and aborts on memory; baseline new entries
  with reasons, retire what no longer reproduces).
- **A guard test for the screens** (3a's `club-stage3a-screens-guard` pattern): "Fiscal year" spelled one way and absent
  from coach files; no "Program Year" and no "(optional)" in New allocation; a closed year renders no write control; the
  payee window has no Export; the form table is the shared component.
- Then `/simplify`, `/review` at the **high-risk** tier, and a `/design` review of the built screens against the hub at
  1440 and 390.

## Hand-off

- An owner-voice summary, the walks to run, departures from the drawings, and anything found and not fixed.
- The plan record, memory, the TODO line, and the hub's QA tab republished (the same address; read it fresh first,
  and read the live copy in full before publishing).
- **Commit only when the owner says**, from a private index with this session's files only; Part 0 is its own commit,
  and the spelling gate's change its own.
