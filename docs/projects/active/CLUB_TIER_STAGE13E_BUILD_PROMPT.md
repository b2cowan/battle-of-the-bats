# Club Tier Stage 13e · Numbers open their lines (build prompt, two sessions)

> Written 2026-11-16, after the owner ruled the 13e drawing's asks **13e-1 … 13e-8 all A** (paste-back in the chat).
> Paste into a **fresh chat on `dev`**, one session at a time:
> `execute Session A of @docs/projects/active/CLUB_TIER_STAGE13E_BUILD_PROMPT.md` (then B). Either order; they share no file.
> **2026-11-17: A and B committed; Session C (the four rulings 13e-9…12 + the words pass) added below; the walk follows C.**
> **2026-11-17: Session C built** (status in the Stage 13 plan §10); next the one walk.
>
> Drawing (the spec): https://claude.ai/artifact/ARCTT7eZvMZy3ZQQ6wzHSR, source
> [CLUB_TIER_STAGE13E_DRAWINGS.html](CLUB_TIER_STAGE13E_DRAWINGS.html) (captures in `stage13e-shots/`). Eight tabs: the overview with the
> "settled from the code" table, Still owing and the who-owes door, Find a child, Off-plan and Not filed, figures that say which they are,
> the tournament's book, the phone Schedule (closed into Find a child), the asks.
> **Open the tab for the piece you build: its numbered notes carry the exact words and rules; this prompt does not restate them.**
> Drawing prompt: [CLUB_TIER_STAGE13E_DRAWING_PROMPT.md](CLUB_TIER_STAGE13E_DRAWING_PROMPT.md).
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10 (the 2026-11-16 entries).
> Standing rules: `docs/agents/design/NAV_STANDARD.md`. Sibling prompt for shape: [CLUB_TIER_STAGE13D_BUILD_PROMPT.md](CLUB_TIER_STAGE13D_BUILD_PROMPT.md).
> Marks: **[V]** = the drawing session opened it 2026-11-16 on a local production copy; **[H]** = handed on, **re-open before editing**.
> Line numbers drift. Branch `dev`; explicit pathspecs; ask before committing; never push. Recommended model: Opus.
> Size: **Medium**, two sessions, **one walk** after B. Theme 4's rule governs the whole stage: **every figure opens its lines, and a
> figure on two screens has one definition or says which it is.** Every money change here is **words or a door**; no figure's arithmetic moves.

## What 13e is

- **Session A · the registrar's house league (13e-1, -2, -3, -4, -8):** Money's Still owing rows open the child; "Email these families" and
  "Open on Registrations" take the whole list where the work is; Registrations' Owing filter and Money's Still owing say they are the same
  list and share one rule; "Find a child or a parent" on House league's home, with the team's next game or practice on the row;
  Registrations' search names the other tab; Received says "8 players · 1 in part".
- **Session B · the money screens (13e-5, -6, -7, plus the Off-plan door):** Off-plan opens its lines (tile, Overview row, Not filed link),
  the Actual window's "[object Object]" bug, "includes…" and "Balance today" captions, "today, not at the close" on a closed year, the open
  year's board report gains the "includes" line, Rep teams' and the team account band's "includes $600.00 from 2025–26", the installments line
  reads "7 overdue · 5 more in the next 14 days", and the tournament's or a season's book opens the Ledger on **All time**.

Nobody gains a nav row. The treasurer **cannot open Registrations**, so for them Still owing's rows stay plain and both buttons are absent:
never a door to a refused page.

## Owner rulings this build carries (2026-11-16, the drawing's eight asks, all A)

- **13e-1 A** F-R5-4 **closes into Find a child.** The result row names the team's next game or practice. **The phone Schedule does not
  change; 13g takes nothing** (and the hub's theme-8 mention of it is closed).
- **13e-2 A** "Email these families" on Still owing opens the season's **existing** Email families window with the 12 ticked. **Never a second
  sender, no new audience.** Sending stays under that window's own rules.
- **13e-3 A** **Link both ways**, and Registrations' Owing filter treats a child with a bank debit still clearing **the way Still owing does**.
  One rule, two lists that cannot drift. **Not a merge.**
- **13e-4 A** Find a child lives on **House league's home**, searching every running season, every tab; "Search past seasons too" on a miss.
- **13e-5 A** The door from a **tournament's or a season's book** (the Overview's books row; the tournament dashboard's "In the club's book"
  row) opens the Ledger on **All time**. **The Ledger's own default stays This month** (owner rule, test-pinned) and so does the General
  book's row and picking a book from the Book pill.
- **13e-6 A** The first two known lows **and** the open year's board report: "2026–27 includes …" + "Balance today"; "today, Nov 16, not at
  the close" on a closed year (words only, **no new read**); the "includes" line in the open year's board export. **The closed year's
  year-end file waits** (it would add a field to a locked read). Record it as its own small item, do not build it.
- **13e-7 A** Rep teams keeps the every-year figure and **says what it includes**: "$3,900.00 · includes $600.00 from 2025–26", the same on the
  team's account band and in the Overview's "Owed to the club" caption. **Accounting › Teams is unchanged** (the year, the earlier year its own line).
- **13e-8 A** Money's Received reads "8 players · 1 in part" (Dev Sharma on the copy: $75 of $150), so it stops disagreeing with the filter's 7.

**Ruled 2026-11-17 (the calls Sessions A and B left open; all as recommended; built in Session C):**
- **13e-9 A** A partly cleared fee's cell on Registrations reads "$50 owing · $100 clearing": owing first, the same owing amount as Money.
- **13e-10 A** "Email these families" past ~200 children is a **defect to fix**: the window's list leaves the address; same audience, same rules.
- **13e-11 A** Accounting's "House league money: … still owing" opens Money on **Still owing**, not Every line (13d's pin moves with it).
- **13e-12 A** The tournament's own sidebar into Accounting opens its book on **All time**, like the other two doors to it.

## ⚠ Where the drawing and the code can disagree (read before the summary)

1. **There is exactly one definition of "owed"** [V]. `lib/club-band-read.ts` (~L24–63) owns it. **Do not add a third owed query.** Session A's
   filter change goes through the shared test Still owing already uses; if the two readers are separate functions today, share the part that
   decides "owing" and pin it (source pin: no second definition). `club-money-one-definition-guard.test.ts` must stay green.
2. **The clearing-debit rule is the only place the two lists differ** [V]. Still owing keeps a child with whatever is not clearing yet; the
   filter drops the child entirely. Change the **filter** to match Still owing, not the other way round; Money's figure must not move.
   Test: a child with part of the fee clearing reads the same on both.
3. **Money's Still owing tile on This morning lands on "Every line", not on Still owing** [V]. The tab gets its own address so the tile, Back
   from a child, and "Open Still owing" on the filter all land on it. Re-open how Money's tabs are addressed before choosing; do not
   add a second tab mechanism.
4. **The Fee filter cannot be set by a link today** [V]. "Open on Registrations" needs one small addition (Active, Fee: Owing). Keep it to
   that; do not widen Registrations' link vocabulary.
5. **Find a child needs one new read across running seasons** [H, the only new read in the stage]. It is a **club read of registrations**:
   confirm which roles may read Registrations today (owner, admin, league admin, registrar) and gate the search the same way. The treasurer
   has no Registrations access and must **not** get the search by a side door. Max 8 rows, then "Show all"; the running season first; a
   waitlist or to-review child shows their place and no team line (drawing tab 3 note 5).
6. **"The team's next game or practice" must come from the schedule's own reader, not a second computation** [H]. Re-open how the house-league
   Schedule decides what is next (it already skips an empty week, rule C3, `58ecf0ee6`) and reuse it. The line names whatever comes first,
   a practice or a game. A child with no team yet gets no line.
7. **Off-plan is spending only, read from the year's plan and the Ledger** [V]. $3,660.00 = Field Equipment $1,200.00 + Paid to teams on
   request $120.00 + Not filed $2,340.00 on the copy. **The window must add up to the tile**; assert that in a test with a fixture that has
   all three kinds. `bva-figure-doors-guard.test.ts` forbids a "N lines" count on the tile: do not add one. **Extend** that guard, do not
   replace it. Each row opens that line's existing Actual window; **no Ledger button on the Off-plan window** (the Ledger has no "off-plan"
   filter and must not gain one by guessing items across categories).
8. **The Actual window's "ACTUAL · [OBJECT OBJECT]" is a real bug** [V]. The year is printed as a raw value. Fix it where the heading is
   built and **grep for the same pattern in the other windows** that take a year; add a test that no heading contains "[object".
9. **Off-plan must not touch the schedule's Bill window or "being billed"** [V, several-permits plan ~L613: "13e … don't touch it"]. The
   door opens a window of plan lines only. If a line in the window would sit on the Bill window's work, **stop at the line.**
10. **D1: a door from a club figure never opens a coach's own book.** Rep teams' "includes" caption is words on a figure the club already
    reads; it adds no link into the coach's Money.
11. **The Ledger can be narrowed by a link to a category, an item and dates** [V]. Not filed's "File them on the Ledger" link is a link to the
    Ledger narrowed to Not filed over the fiscal year (on a closed year the lines are locked, so it reads "See them on the Ledger").
    No month control on Budget vs. Actual (hub ruling ALSO T3); the band stays Collected · Spent · Off-plan · Cash on hand.
12. **Closed fiscal year is read in place and locked** (owner ruling 2026-10-07). Every new door and caption must be right on a closed year:
    no write control appears, and a caption never claims a closing figure it does not read.

## Session A · the registrar's house league

Screens touched: Money (Still owing rows, the two buttons, the Received caption), Registrations (search, the Fee: Owing line and its
door back, Open-on-Registrations landing), House league's home (Find a child), the club Overview's This morning "Still owing" tile (its
destination). **Drawing tabs 2, 3 and 7.** House league's home is the registrar's landing [V].

- **A1 · Rows open the child (13e-3 context).** The whole row is a link to that child's registration opened on its fee; Mark received is
  there. Back returns to Still owing. **Gate: someone who cannot open Registrations sees plain rows and no buttons.**
- **A2 · "Email these families" (13e-2 A).** Opens the season's Email families window with the same set ticked, "Who" reading their
  families (two siblings = one family). **Reuse the bulk bar's entry point; no new sender.** Nothing goes until Send, under that window's
  existing guards. With nothing owing, the tab's empty state and both buttons go. **Run `/legal`** before hand-off (family mail path, CASL):
  expect "no change" since the audience and consent rules are the existing window's, but record it.
- **A3 · "Open on Registrations" and the filter's twin (13e-3 A).** Registrations, Active, Fee: Owing on; the line "12 owing, the same 12
  as Money's Still owing. Open Still owing" **only when it is true** (Active, all divisions, no search, Owing the only filter). Counts come
  from the data, never from the prompt. With the shared rule (disagreement 2) the two counts cannot drift.
- **A4 · Received (13e-8 A).** "8 players · 1 in part", the part-paid child counted in Money and explained, not removed. The caption sits
  under the figure; on a phone the band is rows.
- **A5 · This morning's Still owing tile** lands on Still owing (disagreement 3).
- **A6 · Find a child or a parent (13e-4 A, 13e-1 A).** Above "Running now" on House league's home; every registration in every running
  season, any tab, by child, guardian or either email. Result: child, division, team, season, guardian, status and what is owing, then the
  team's next game or practice; the row opens the registration. States per tab 3: empty, a child with no team, several matches (≤8 then
  Show all), a miss offering "Search past seasons too". Reads while typing without jumping the rows below. Phone: full width, 46 px, one
  target per result.
- **A7 · Registrations' search names the tab (F-R5-1).** While a search is typed each tab's count is its matches; a miss reads "No one in
  To review matches "isaac". 1 match in Active" with a button that switches tab **and keeps the search**. **Not** one list across tabs
  (the rows carry different buttons: Approve is on To review only).

**Session A guards:** one shared owing rule, no second owed query; a child with a clearing debit reads the same on both lists; the gate
matrix for the buttons (registrar, owner, admin yes; treasurer no, **no dead link**); Email these families calls the existing window with
the set and builds no sender; Find a child is gated like Registrations and is read-only; the next-event line comes from the schedule's reader;
`club-money-one-definition-guard.test.ts` and `club-stage13d-money-handoff.test.ts` green.

## Session B · the money screens

Screens touched: Budget vs. Actual (Off-plan tile, Not filed note, the Actual window), the Accounting Overview (Off-plan row, the Revenue
and books captions, Owed to the club's caption, the board report), the Ledger's door from a tournament's or a season's book and the
tournament dashboard's "In the club's book" row, Rep teams, a team's account band, and the club Overview's Installments line.
**Drawing tabs 4, 5 and 6.**

- **B1 · Off-plan opens its lines (tab 4).** The tile becomes a button with a chevron, words unchanged. A window "Off-plan · 2026–27" with
  one row per line nobody budgeted (name, category, "not planned", amount) that **adds up to the tile**, each row opening that line's
  Actual window. The Not filed row says "No budget word yet · file them on the Ledger". The Overview's Off-plan row is the same door. On a
  phone a full-screen sheet with the same rows.
- **B2 · "File them on the Ledger".** The Not filed note ends with the link of disagreement 11.
- **B3 · The Actual window's heading bug** (disagreement 8).
- **B4 · Figures that say which they are (13e-6 A, tab 5).** Revenue: "2026–27 includes house league fees $… · Harbourtown Invitational 2026
  $…"; the books table's "Balance today"; on a closed year "Owed to the club" says "today, {date}, not at the close"; the open year's
  board export carries the "includes" line.
- **B5 · Rep teams' Outstanding (13e-7 A).** "$3,900.00 · includes $600.00 from 2025–26" in the list and on the team's account band; the
  Overview's Owed caption names "$1,200.00 of it from 2025–26" (**the figure is unchanged**, still the one shared sum). No caption
  when nothing is carried over.
- **B6 · Installments due (F-O6-2).** "7 overdue · 5 more in the next 14 days": overdue first, in red; none overdue reads "in the next 14
  days"; none coming reads "7 overdue". Derive from the existing counts; the 7 are inside the 12 today [V].
- **B7 · The book's door opens on All time (13e-5 A, tab 6).** Only the **link** changes (the Overview's books row for a tournament's or a
  season's book, and the tournament dashboard's "In the club's book" row). The General book's row and the Ledger's default stay This month.
  Same window on a phone.

**Session B guards:** Off-plan window total equals the tile (fixture with all three kinds); no "N lines" on the tile; no "[object" in any
window heading; every figure on a Budget vs. Actual row still opens what is behind it (`bva-figure-doors-guard.test.ts` extended);
`money-one-arithmetic-guard.test.ts` and `club-accounting-teams-guard.test.ts` green; a closed year shows no write control and no
unqualified "today" figure; the Ledger's default is still This month (the owner rule's own test stays); the two door links carry All time.

## Help, words, layout (each session does its own; the walk is once)

- **Help** (`/docs` after each session): Money and Registrations articles in `house-league.tsx` (Still owing, Owing filter, Received, the
  search), a Find-a-child article, `accounting.tsx` (Off-plan, Not filed, Revenue's includes, Balance today, Owed to the club, the Ledger's
  All-time door), the Rep teams article, This morning's Installments line. **Search words move with the prose.** `npm run check:spelling`
  (one spelling: "installment", "a.m.").
- **Demos:** the demos run real product on fictional clubs and never gate it. After A and B, confirm the build's tour-anchor check; nothing else.
- **Layout:** `check:layout --changed` per session on the screens touched (dev server; **never a whole sweep there**), then the staging
  sweep once after B. Fixtures: a season with a part-paid child, a clearing debit, a waitlist child and a sibling pair; a year with an
  off-plan line, a Not filed line and an unplanned category; a team with an earlier-year balance; a closed year; a tournament whose book has money.
- **/legal:** Session A touches the family-mail path and a registrar search (a read of data they already hold): run it before hand-off.
  **/accounting:** no change to what FieldLogicHQ charges or records; not required. If a money definition moves, stop.
- **Words for `/marketing`** (one pass before the walk): "Email these families", "Open on Registrations", "1 in part", "Find a child or a
  parent", "Search past seasons too", "Show it in Active", "Off-plan · {year}", "File them on the Ledger", "See them on the Ledger", the
  includes / Balance today / "today, not at the close" captions, "7 overdue · 5 more in the next 14 days".

## After each session

- **Reviews:** `/simplify` (A shares the owing rule and adds one cross-season read; B adds one window; likely), then `/review`
  (high for A's shared rule and the new read; standard for B).
- **Records:** a status entry in the Stage 13 plan §10 per session (what was built, where it departed from this prompt, the commit hash once
  committed); the TODO 13e line; one line in the PM brief. `NAV_STANDARD.md` only if a place or tab moved (none expected). **If a migration
  turns out to be needed** (none expected) it follows the usual order and the data dictionary, snapshots and `MANUAL_PROD_STEPS.json`.
- **Restart:** the dev server needs a restart before hand-off after any session that adds a file.

## Session C · the four rulings of 2026-11-17, then the words pass (one session, before the walk)

> Added 2026-11-17 after Sessions A (`b52e2cd5a`) and B (`c73e51310`) were committed. Paste into a **fresh chat on `dev`**:
> `execute Session C of @docs/projects/active/CLUB_TIER_STAGE13E_BUILD_PROMPT.md`. Size: **Small**. Recommended model: Opus.
> The owner ruled the four calls A and B left open, **all as recommended** (2026-11-17, in the Session B chat): **13e-9 … 13e-12** below.
> Everything in "Where the drawing and the code can disagree" above still binds, above all: **one definition of owed, no third owed query,
> no figure's arithmetic moves, no second sender, no new audience.** Leads marked [V] were opened 2026-11-17; line numbers drift, re-open first.

**Order:** C1–C4 → `/docs` for what they changed → the help items owed → the `/marketing` pass (last, so C1's new words are in it) →
`/simplify` only if the diff grew an abstraction → `/review` standard (C2 touches a family-mail route: treat that hunk as high) → layout
`--only` the touched screens at 390 and 1440 → records → commit the way A and B did (private index built on HEAD in ONE script, the hook run
by hand, `commit-tree` + compare-and-swap `update-ref`; TODO.md and the Stage 13 plan are shared, commit only your lines). **Show the owner
the file list and message first and wait for the yes.**

- **C1 · 13e-9 A — a partly cleared fee says what is owing first.** A child with part of the fee clearing is on Registrations' Fee: Owing
  (Session A's shared rule) but the row's fee cell reads only "$100 clearing". It reads **"$50 owing · $100 clearing"**: the owing part first
  (it is why the child is in the list), the clearing part after; the second line (Bank debit · total · started) and the tip unchanged. [V]
  The cell's chip is built in `lib/house-league-registrations.ts` (~L274, `F.clearing`); the words live in `lib/house-league-money-words.ts`
  (~L255). **Find a child already words the same case** (`lib/house-league-find.ts` ~L89): make the two agree, one wording. The "$50 owing"
  is **the same number Money's Still owing row shows for that child** — take it from the reading Still owing uses (`clearingShareCents` and
  the fee's owing), never a new subtraction. Test: one child, part clearing, the same owing amount on Money's row, Registrations' cell and
  Find a child. A child whose whole fee is clearing keeps today's "$150 clearing" (nothing owing to say).
- **C2 · 13e-10 A — "Email these families" works past ~200 children (a defect, not a choice).** [V] The Email families window puts the
  ticked registrations in the address of its preview read (`components/admin/kit/club/families/EmailFamiliesWindow.tsx` ~L113–121,
  `&kind=season_families&registrationIds=…`), so a long list outgrows the host's address limit and the window shows its failed state. **Move
  the list out of the address** (the preview read carries it in a request body; re-open the season emails route under
  `app/api/admin/house-league/seasons/[seasonId]/emails/` and how Send already carries its list, and match that shape). **The same audience
  kind, the same guards, the same org and season scoping, the same consent rules** — no new kind, no server-side "owing" audience (13e-2 A:
  no new audience), no second sender. Both openers are fixed by it: Still owing's "Email these families" and Registrations' bulk bar. Check the
  other id-list kinds in that window (teams, divisions): if they are bounded by what a club can have, say so and leave them. Tests: a 600-id
  pick never puts ids in a URL; the route accepts the list in the body and refuses an id outside the season/org exactly as before.
  **`/legal`:** the audience and consent are unchanged, so expect "no change"; record it in the plan entry.
- **C3 · 13e-11 A — Accounting's "House league money: … still owing" opens Money on Still owing.** [V] The link
  (`app/[orgSlug]/admin/accounting/page.tsx` ~L385, `OWED_TO_THE_CLUB_WORDS.seasonDoor`) goes to the season's `/money`, which lands on Every
  line. It lands on **Still owing**, using **the same address Session A gave that tab** (the one This morning's Still owing tile uses; re-open
  it, do not invent a second). Update 13d's pin (`tests/unit/club-stage13d-money-handoff.test.ts` ~L196) to the new address and say in the
  test why it moved (13e-11).
- **C4 · 13e-12 A — the tournament's own sidebar arrives on All time.** [V] The tournament rail's Accounting door arrives with
  `?tournamentId=` and the Overview forwards it to that tournament's book (`app/[orgSlug]/admin/accounting/page.tsx` ~L161–172,
  `router.replace(\`${base}/ledger?book=…\`)`), which opens on This month. Build that address with **`bookLedgerHref`** (Session B, `lib/club-ledger.ts`)
  so all three doors to a tournament's book agree. The Ledger's own default, the General book and the Book pill stay This month. Extend
  Session B's B7 test to the third door, and update the file's header comment (~L25) and Session B's "owner call" note in the plan.
- **C5 · The help owed from B.** (a) This morning's Installments line ("7 overdue · 5 more in the next 14 days") is documented only in
  `lib/help-content/org.tsx`. Another session had uncommitted edits there on 2026-11-17: check `git diff HEAD -- lib/help-content/org.tsx`
  first; if it is still dirty, edit only your lines and commit them by exact-text replacement on HEAD, or record it owed again. (b) Split the
  two long accounting help sections Session B noted (`npm run measure:help -- --module=accounting`), per the `/docs` scannable standard.
  (c) The help for C1, C3 and C4 moves with them (house-league.tsx's Registrations fee article, accounting.tsx's Ledger door).
- **C6 · The `/marketing` words pass (the build's one pass, before the walk).** Hand it the whole stage's new words, as they read in the code
  (pull them from `lib/club-money-words.ts`, `lib/club-band-view.ts`, `lib/house-league-money-words.ts` and Session A's words files, not from
  this list): "Email these families", "Open on Registrations", "1 in part", "Find a child or a parent", "Search past seasons too", "Show it
  in Active", Session A's "Show the first 100 of N" and "Showing N of M. Type more of the name to narrow it.", C1's "$50 owing · $100
  clearing", the Off-plan window ("Off-plan · {year}", "{amount} nobody budgeted", its lead line, "not planned", "No budget word yet · file
  them on the Ledger"), "File them on the Ledger" / "See them on the Ledger", "{year} includes …", "Balance today", "today, {date}, not at the
  close", "includes $600.00 from 2025–26" and "$1,200.00 of it from 2025–26", "7 overdue · 5 more in the next 14 days". Apply what it
  changes in the words files only; a changed word moves its help text, its search words and any test pin with it; `npm run check:spelling`.
  A change it proposes to a **ruled** wording (13e-6, -7, -8 and C1 above) goes back to the owner as a question, not into the code.

**Session C guards:** Money's figures, the Overview's figures and the Outstanding column do not move (`money-one-arithmetic-guard`,
`club-money-one-definition-guard`, `club-accounting-teams-guard` green); C1's owing amount is one reading on three screens; no registration
id list in any email window address; the Email families route's audience and refusals unchanged; the Ledger's default still This month
(3a's pin); Session A's and B's tests green (update a pin only where a ruling above moved it, and say so in the test).

## The walk (once, after both sessions)

One walk, one purpose, its own Owner QA Ledger section (**the next free §**; read the ledger, never assume), as a checkable Artifact with a
paste-back, on a fresh Harbourtown copy. Purpose: **a number opens the lines behind it, and two screens that show the same figure say so.**
By role (registrar, owner/admin, treasurer, league admin), desk and phone: Still owing → the child → Back; Email these families to the
window and stop before Send (R3); Open on Registrations and the twin line; Received "1 in part"; Find a child (a match, no team yet, a
miss, past seasons); search naming the tab; Off-plan → three lines → an Actual window (heading reads right); Not filed's Ledger link;
the captions, on an open and a closed year; Rep teams' includes; the Installments line; a tournament's book opening on All time while
the General book still opens on This month. Counts in the walk come from the fixture. Walk to a send and stop (R3, 2026-11-06).
**Added by Session C (2026-11-17):** the partly cleared child's cell ("owing" first) on Registrations, matching Money and Find a child;
Accounting's "still owing" link landing on Still owing; the tournament's own sidebar opening its book on All time. The 200-plus mailing is
proven by Session C's tests, not walked (a fixture of 200 owing children is not a walk step); the walk opens the window once from Still owing.
**The walk runs after Session C,** not after B.

## Not in this build

- ~~The closed year's year-end file "includes" field~~ — built 2026-11-23 as its own small item (plan §10, 2026-11-23 entry).
- Families' "Owes money" (a third answer to "who owes", per family across rep and house league): **13h**.
- The phone Schedule's opening rule (13e-1 A: unchanged).
- A merged who-owes list; a month control on Budget vs. Actual; an "off-plan" Ledger filter; a door from a club figure into a coach's book.
- Anything in the schedule's Bill window or the several-permits work (its walks §531/§532 are still owed).
- F-T3-1, F-T5-1 (settled by 13d) and F-T3-5 (the bank check's Find): not redrawn, not rebuilt.
