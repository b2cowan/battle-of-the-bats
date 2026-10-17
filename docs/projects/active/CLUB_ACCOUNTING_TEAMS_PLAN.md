# Club Accounting · Teams — plan

**Hub (mockup, brief, plan, decisions, QA walk — one URL):** `docs/projects/active/CLUB_ACCOUNTING_TEAMS_HUB.html`
= https://claude.ai/artifact/M3iNQq4N8cRWeZCdN6G8Ps · **PM brief:** `CLUB_ACCOUNTING_TEAMS_PM_BRIEF.md` ·
**Build prompt:** `CLUB_ACCOUNTING_TEAMS_BUILD_PROMPT.md` · **TODO:** the sub-line under the Club Tier item.

- Asked by the owner 2026-10-16 (*"I have to scroll down on the dashboard to find the list of teams … there should be a
  teams tab … a dropdown to toggle from team to team … think of other ways we can enhance this user experience for the
  treasurer, how does this tie to the teams pages in the rep teams sections"*).
- Drawn 2026-10-16, hub version 1; /design pass 2026-10-16, hub version 2.
- **⚖ Ratified 2026-10-16, all eight asks as recommended** (owner: *"I agree, go ahead and write the plan and build
  prompt"*). Two corrections to the drawing found while writing this plan (§2.2), redrawn in hub version 3.
- Part of the Club release (owner 2026-10-12: everything in the Club Tier plan ships inside it). No migration.

---

## 1. What is true today (read from the code and the dev club, 2026-10-16)

A club's money is one Accounting page with tabs (Stage 3a, Ask 2 option B): Overview · Ledger · Allocations · Payment
requests · Budget · Budget vs. Actual (`accountingTabs`, `lib/admin-kit-nav.ts`; the frame is
`components/admin/kit/club/money/AccountingFrame.tsx`). A team's account with the club is
`app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx`, a page "one level down": its own header, a back arrow fixed to
the Overview, no tab row. It is the last such page in Accounting (Stage 3d turned the allocation and Payees into windows).

| | Finding | Evidence |
|---|---|---|
| **F1** | The teams are buried: "The teams" is the Overview's fourth of five sections, about 1,300px down at 1440 wide. A treasurer cannot open Rep Teams (Stage 1 ruling), so it is their only list of teams. | `accounting/page.tsx` section order; measured on the hub's drawing |
| **F2** | A team's account is a dead end: nothing on it leads to another team. Ten teams = ten trips through the Overview. | the account page has no team list or switcher |
| **F3** | The account's back arrow always says Overview, including for an owner who arrived from Rep Teams › the team › With the club; nothing leads back to the team page. | `backTo={{ href: base, label: 'Overview' }}` |
| **F4** | The account never says what is late while a payment is also coming due: the band's Outstanding caption counts installments, and the overdue amount shows only in Next due's caption when nothing is coming due. Dev: 11U AA owes $2,358.00 in three late installments (oldest Aug 23); its page says it nowhere. | the `outstanding` and `next` tiles' captions |
| **F5** | A waiting request is counted ("1 waiting") but has no row and no door on the account; Payment requests' Team filter takes no address. Dev: 13U AAA's $180.00 request, holding up its payout. | `withTheClub.requestsWaiting`; `payment-requests/page.tsx` reads only `?request=` |
| **F6** | The callout ends "Nothing here can be changed", false since Stage 3d: a Billed row opens the team's bill over the page, where the club records and confirms payments and sends reminders. | `teamAccountCallout` in `lib/club-money-words.ts`; `BillRoom` |
| **F7** | Two Outstandings for one team: the Overview's teams table reads the fiscal year on the Year pill (13U AAA $7,680.00 in 2026–27); the account, Rep Teams' board and its team page read every year ($8,280.00, with 2025–26's $600.00). Nothing on the row says why. | `SummaryTeamRow` (year rule) vs `teamsWithTheClub` (every year) |
| **F8** | No one to call: the account names no coach; Allocations' Coming due shows the head coach under each team, and a team's bill knows them (`TeamBill.headCoaches`, Remind goes to them). | `loadHeadCoaches` (`lib/club-team-board.ts`) |

## 2. The rulings

### 2.1 As ruled 2026-10-16 (each drawn on the hub)

1. **A Teams tab, second in Accounting's row** (Overview · Teams · Ledger · Allocations · Payment requests · Budget ·
   Budget vs. Actual), only for a club that runs rep teams, the rule Allocations and Payment requests follow. The
   Overview's teams table moves there whole (columns, group bands, the amber request count, the red overdue caption, the
   locked "held by the team" column, its closing row and its band), gaining a quiet **Group** filter and its own
   **Export** (the table).
2. **A team's account opens inside the Teams tab.** The tab row stays with Teams lit; a **Team pill** leads the toolbar
   (the Ledger's Book pill, `SingleSelectDropdown lead shrink`) and switches team; **"All teams"** returns to the table.
   No back arrow, no crumbs. The account keeps its address (`accounting/teams/{teamId}`); the list is
   `accounting/teams`. Not built: ‹ › stepping (screen 6 of the hub).
3. **The Overview keeps a teams card** where the table was: two counts and the card-foot door "Teams ›" (the budget
   card's own door). On a phone, one row that opens the tab. The board report (Export) keeps its teams section.
4. **The line under Outstanding says what is late** on a team's account, in the order the bill window's line (2026-10-16,
   `billOutstandingLine`) set: late in red with the warning mark, then sent. **No next-due reason**: the account keeps its
   Next due figure beside it, so the line never repeats the date. Nothing when nothing is late or sent; then the caption
   stays "N installments not yet received" (or "Nothing owed").
5. **"Needs you" on a team's account**: its late installments, payments sent for the club to confirm, and requests
   waiting on the club, one row each, every year (a closed year's row says so). A bill row opens the team's bill in the
   allocation window over the page (the statement's Billed rows' own door); a request row opens **the request's window
   over the page** (as drawn: "the request (Approve) over the page") — see §3.3 for the one door per kind. Shown only
   when something waits. Heading meta = count · amount in words ("3 · $2,358.00"), no closing row.
6. **The season line**: under the toolbar, the live season's name and its head coach(es) — "2026 Season · head coach
   Marcus Bell" — or "No head coach" in red when the live season has none; a team between seasons names its last closed
   season. **"In Rep Teams"** at the body's end for anyone who can open Rep Teams: a section with one framed row,
   "{team}’s team page" · "Coaches, roster, schedule and seasons", the exact shape of the team page's "With the club".
   A treasurer never sees it.
7. **The callout becomes one lock line** under the band about the one figure the club reads but doesn't own;
   "Nothing here can be changed" goes. Words to /marketing.
8. **The earlier year's line on the Teams table**: a team still owing on a closed year gets one line under its
   Outstanding naming what that year still owes. The row keeps the year's figure (Allocated − Collected = Outstanding);
   no figure's definition changes. One Outstanding everywhere was not ruled and needs its own session.

### 2.2 Corrections found writing this plan (redrawn in hub version 3; the owner may object)

- **C1 · The Overview card counts every year, as its band does.** The drawing said "7 teams have money late", counting
  the year's overdue only. The band beside it, "Owed by the teams … $11,226.00 overdue", counts every year (it includes
  2025–26's $1,200.00). Counted the band's way, dev has **8** teams with money late (14U AA's $600.00 from 2025–26 is
  late since Jul 15). The card reads its counts from the same read as the band, never a second definition.
- **C2 · The earlier year's line is red when that money is late.** The /design pass made the line quiet ink (blue is
  "held by the team"); but 14U AA's whole late amount is in that line, so a treasurer scanning the reds would miss it.
  The line names its state: **"+ $600.00 overdue from 2025–26"** in the late red when any of it is overdue, otherwise
  **"+ $600.00 from 2025–26"** in quiet ink. Colour stays a verdict (the design log's money-band rule).

## 3. What the build changes, screen by screen

### 3.1 The tab list and the frame
- `accountingTabs` gains `{ id: 'teams', label: 'Teams', href: `${a}/teams` }` second, inside the `runsRepTeams` spread.
- `accountingTabFor` lights **Teams** on `accounting/teams` **and on `accounting/teams/{id}`** (a prefix, for this tab
  only). The "page one level down" branch of `AccountingFrame` then serves no Accounting page; keep the branch only if a
  forwarded old address still needs it, and say so in its comment.
- The frame names the browser tab for the pages it owns; on a team's account the page names itself
  ("11U AA · Teams · Accounting | {club}"). ⚠ The frame's effect runs after the child's and overwrote it before (its own
  comment); the frame must not set the title on a team's address.

### 3.2 Accounting › Teams (`app/[orgSlug]/admin/accounting/teams/page.tsx`, new)
- Toolbar: **Year pill** (lead, `useClubYear` — the same year the other money tabs share) · **Group** (a quiet
  `MultiSelectDropdown`, its choices the club's groups and "No group", absent when the club has no groups) · Export
  pinned right. No band (Allocations and Payment requests open on their list; the totals are the closing row).
- The table: the Overview's `TeamsTable`, moved to its own component file and used only here; the phone keeps the
  Overview's row list (name + amber count, the red overdue or "Holding up a payout", what is owed, "Held by the team …"
  on every row, the total closing the list). The band under it drops "above": "Held by the teams: ($12,069.00) across 10
  teams. The coaches’ own books, never part of the club’s figures." (words: /marketing).
- **The earlier year's line** (Ask 8, C2): from the read's still-open installments for that team, one line per closed
  year, under the red overdue caption.
- A row opens the team's account (the name is the link; the row is the shortcut). The Group filter is not remembered
  between visits (the one-toolbar ruling's reason).
- Data: **the Overview's own read** (`/api/admin/accounting/summary?year=`: `summary.teams`, `summary.teamsCash`,
  `stillOpen`) — one definition of every figure on the two screens. If measuring shows the budget report inside it is
  slow for this tab, a `part=teams` that skips only the report is allowed; never a second computation of a team's figure.
- Export: the table as the board report already writes it (`BOARD_TEAMS_EXPORT_COLUMNS`, `boardTeamsExportRows`),
  Excel first then CSV, one button (the export ruling). A new entry in `lib/export/catalog.ts`.

### 3.3 A team's account (`accounting/teams/[teamId]/page.tsx`)
- Renders inside the frame (Teams lit). Its `AdminPageHeader` (back arrow, crumbs, title, TEAM chip) goes.
- Toolbar: **Team pill** · Export (the statement, unchanged) pinned right. The pill: `SingleSelectDropdown lead shrink
  label="Team"`; its list = "All teams" (detail "N teams"), then the teams the reader may see, under their group's
  heading (the table's band words, "No group" last), each with the amber waiting count (`mark`) and its every-year
  Outstanding as the quiet `detail`. Choosing a team **replaces** the address (the Book pill's `router.replace`, so Back
  leaves the tab instead of walking back through every team flicked through); "All teams" replaces to the table. A table
  row opens a team with an ordinary link (a history entry).
- **Season line** (Ask 6) under the toolbar.
- **The band** keeps its four figures. Outstanding's caption = the line (Ask 4) when something is late or sent, else
  today's caption. Use `billOutstandingLine` with the next-due reason left out (an option on the one function, never a
  copy), so the bill and the account cannot word late money two ways.
- **Lock line** (Ask 7) replaces the `Callout`.
- **Needs you** (Ask 5): a card with a table What · State · Amount · chevron (phone: framed rows, the figure at the end).
  Order: late (oldest first), then sent, then requests. State words: the still-open card's (`STILL_OPEN_WORDS`:
  "Overdue since Aug 23", "Sent Sep 22, waiting for you", the amber count + "holding up a payout"); a closed year's row
  adds "from 2025–26". Note under it: "A row opens {team}’s bill, where you record a payment or remind its coaches."
- **A request opens over the account** (Ask 5 as drawn; the Stage 3d rule "a record opens where you are: from a page,
  over it"). Today only Payment requests can open a request: its page holds the window and the Approve / Decline /
  Reverse questions (`RequestWindow`, `ApproveWindow`, `DeclineWindow`, `ReverseWindow` in `RequestWindows.tsx`, wired
  by `payment-requests/page.tsx`). Lift that wiring into **one shared request flow** that both pages mount, fed the
  request's row from the Payment requests read. Then **one door per kind on this page**: Needs you's request rows AND
  the statement's request rows open the request over the account (× returns; an answer re-reads the account). Stage 3d
  kept the statement's request rows on Payment requests only because no request window could open elsewhere. If the
  lift proves larger than this session, both request doors go to Payment requests at that request (today's door), and
  plan §11 records the departure for the owner.
- **Statement**: unchanged, inside a card headed "Statement" (no meta). Its date cells never wrap.
- **In Rep Teams** (Ask 6) last, `canOpen('module_rep_teams')`.

### 3.4 The Overview (`accounting/page.tsx`)
- The teams section becomes the **teams card**: heading "The teams", meta "10 teams · 2026–27", the line
  "**8 teams have money late** · 4 have a request waiting for you" (the first clause in the late red; either clause
  absent at zero; "Every team is up to date" when both are), and the door "Teams ›". Phone: one row, "The teams" /
  "8 with money late · 4 with a request waiting", opening the tab.
- The held-by-the-teams band leaves the Overview with the table. Export (the board report) is unchanged.

### 3.5 The Team pill's control (`components/coaches/SingleSelectDropdown.tsx`, shared)
- Gains opt-in **option groups** (a `group` on an option; a heading row in the panel, the table's band type). Every other
  caller is unchanged. ⚠ A coach-portal component: no default changes; the panel must scroll inside the viewport with
  ~30 teams at 390 (it has `max-height: 320px; overflow-y: auto` today — verify, don't assume).

### 3.6 Rep Teams
- Nothing changes on Rep Teams' screens. Its "With the club" row now lands on Accounting › Teams › {team} with the tab row.
- Found, reported not fixed: the Rep Teams board's group filter says **"Ungrouped"** where Accounting's bands say
  **"No group"** (one spelling rule) — and that filter is a native `<select>` (the form-selects ruling). The Teams tab
  uses "No group"; the board is the Rep Teams screens' owner's to settle.

## 4. Server reads (the call list)

| Read | Change |
|---|---|
| `GET /api/admin/accounting/summary` (`readBoardSummary` → `buildBoardSummary`) | **Add** to `position`: `owedByTheTeams.lateTeams` (teams with any overdue installment, every year — the band's scope) and `waitingOnYou.teams` (teams with a request waiting). Counts only; teams in the reader's groups (B11). |
| `GET /api/admin/accounting/teams` (`teamsWithTheClub`, every year; Rep Teams' board reads it) | **Add** `groupName` to each row (additive; the board ignores it). The Team pill reads it. |
| `GET /api/admin/accounting/teams/[teamId]/account` (`teamAccountRead`) | **Add** `season: { name, live, closedOn } \| null` with `headCoaches: string[]` (`loadHeadCoaches`, as `allocationDetail` does), and `needsYou: { count, amount, rows }` — rows from the team's loop already loaded there (late and sent installments via `clubInstallmentState`, the closed fiscal year's name when the bill counts in one — `allocationYearKey` + the fiscal setting, as `overviewYearReads` does) and from its requests already loaded (`requestWaitsOnClub`, `seasonsHoldingPayout`), each with its door. Reuse `owedRows` (export it from `lib/club-fiscal-reads.ts`) rather than a third reading of "still owed". |

No migration. No write route changes. The one-definition guard (`club-money-one-definition-guard.test.ts`) keeps every
figure in `lib/club-money-reads.ts` / `lib/club-budget-report.ts`.

## 5. Words (all in `lib/club-money-words.ts`, then a /marketing words pass on exactly these)

Tab "Teams" · pill label "Team", option "All teams", detail "N teams" · season line "{season} · head coach {names}" /
"No head coach" · Outstanding line (the bill's, without the next-due reason) · lock line "Cash on hand is {team}’s own
figure, read from its coaches’ books today. The club never adds it to its figures." · "Needs you" (already the bill
window's band word) · its note · "+ {amount} overdue from {year}" / "+ {amount} from {year}" · "from {year}" on a Needs
you row · Overview card line and its phone form · "Every team is up to date" · "In Rep Teams" · "{team}’s team page" ·
"Coaches, roster, schedule and seasons" · the Teams band without "above". ⚠ `check:spelling` gates the clock and
"installment"; run it.

## 6. What does not change

Every figure's definition (the year rule, every-year Outstanding, the held-by-the-team rule); the statement's rows and
doors; the bill window; the board report; Rep Teams' screens; the Ledger and the other tabs; who can open Accounting
(the layout's server gate); group limits (B11) — the pill's list, the table and Needs you all name only the reader's
groups' teams, and `clubTeamFor` already refuses a team outside them.

## 7. Gates

`tests/unit/admin-kit-nav.test.ts` (the tab list; Teams lights on both addresses; `teams/t1` is no longer "one level
down"; every tab a real page) · the club screens guards that read the account page (`club-stage3b-screens-guard`
`held: true`; `ledger-parity-screens-guard` `ledgerKit.cardsFrame`) · `club-money-one-definition-guard` (the routes) ·
the export catalog's guard · `money-summary-band-guard` · a new guard for this project (the frame lights Teams on a team's
address; the account renders no `AdminPageHeader`; Needs you and the season line read the account read; the Overview's
teams card reads `lateTeams`/`waitingOnYou.teams`; the pill uses `SingleSelectDropdown` with `lead`; Payment requests and
the account mount the one shared request flow, and the account holds no `payment-requests?request=` door) · `npm run
verify:changed` · `npm run typecheck` (shared modules change) · `check:layout --changed` on the changed screens at 1440 and
390, Warm and Dark (add `admin-accounting-teams` to `scripts/layout-screens.mjs`; also measure the Teams table at 1280 —
the drawing squeezed there; names over two lines are a finding) · /simplify (a new shared option-group prop) · /review ·
/design on the built screens · /docs (the Accounting articles: the Overview's teams table, a team's account, the new tab).

## 8. QA walk (the build session writes it on the hub's QA tab; the next free § in the Owner QA Ledger)

One purpose per walk, read-only unless a step says it writes:
- **W1** The Teams tab: second in the row; the table as the Overview had it; the earlier year's lines (13U AAA red with
  its own late; 14U AA red, its only late money); Group filter; Export.
- **W2** Moving between teams: a row opens 11U AA inside the tab; the pill switches to 13U AAA without leaving; "All
  teams" goes back; Back leaves the tab.
- **W3** What a team's account tells you: 11U AA's "3 late · since Aug 23", Needs you's three rows, the season line;
  13U AAA's four kinds of row; 12U AA's "No head coach".
- **W4** Needs you's doors: a late row opens the bill over the page (× returns); a request row opens the request over
  the page, and so does a paid request in the statement (× returns). (Read-only: open and close, change nothing.)
- **W4b** Payment requests unchanged after the request flow's lift: open a request, Approve's question then cancel, a
  `?request=` arrival (a notice's door), phone Back.
- **W5** The Overview: the teams card's counts match the band; the door; the table is gone.
- **W6** Two people: the owner sees "In Rep Teams" and comes back from Rep Teams' "With the club"; the treasurer sees no
  door, and the head coach's name.
- **W7** A phone (390): the tab row, the pill, the band two-up, Needs you's rows. **W8** Dark.

## 9. Considered and left out (hub screen 6)

‹ › stepping beside the pill · the band's tiles as doors · remembering the last team · sorting by "needs you" · a Money
tab on Rep Teams' team page (a treasurer can't open Rep Teams) · one Outstanding everywhere (its own session).

## 10. Risks

- **A shared component changes** (`SingleSelectDropdown`): opt-in prop only; the coach portal's pills are untouched.
- **The frame's title effect** overwriting the account's title (§3.1).
- **Lifting the request flow out of Payment requests** (§3.3): the page's Approve / Decline / Reverse questions, its
  `?request=` arrival and its phone Back step must behave exactly as before there (memory `project_coach_back_one_level`:
  a window's address and its Back step). Payment requests' own walk steps re-run after the lift.
- **The summary read's weight** on a list tab (§3.2): measure before adding a `part`.
- **A busy shared tree**: `TODO.md`, the QA ledger, `design_decisions.md`, `lib/club-money-words.ts`,
  `lib/help-content/accounting.tsx` often carry other sessions' hunks — commit from a private index with only this
  project's hunks, and typecheck the exported staged tree.

## 11. As built

**Built 2026-10-16 on `dev` in one session; committed `b9c9ced3` 2026-10-16 on the owner's word** (Part 0, the four
rulings in the design log, is its own commit, `2dbbf15f`). No migration, no write-route change. Walks: Owner QA Ledger **§321**, and the hub's **QA** tab (hub
version 4, same URL).

### 11.1 Where it lives
- **Reads:** `lib/club-team-needs.ts` (new, pure: `owedRows`, `teamsByGroup`, `teamNeedsYou`, `earlierYearLines`) ·
  `lib/club-money-reads.ts` (`teamAccountRead` gains `season`, `headCoaches`, `needsYou`; `teamsWithTheClub` gains
  `groupName`) · `lib/club-budget-report.ts` (`lateTeams`, `waitingOnYou.teams`, each team row's `earlier`,
  `teamsCashOf`) · `lib/club-money-figures.ts` (`teamsWithMoneyLate`, `teamsWithRequestWaiting`,
  `requestAskedAmount`).
- **Tab and frame:** `lib/admin-kit-nav.ts` (Teams second, `views: true`; `accountingTabFor` lights a views tab one
  segment under it) · `AccountingFrame.tsx` (titles only the tab's own address).
- **Screens:** `accounting/teams/page.tsx` (new) · `accounting/teams/[teamId]/page.tsx` (rewritten) ·
  `accounting/page.tsx` (the teams card) · `TeamsTable.tsx` (new, moved from the Overview) · `RequestFlow.tsx` (new, the
  one request flow; Payment requests mounts it too) · `SingleSelectDropdown.tsx` (opt-in `group`, `rowMark`, `fill`).
- **Words:** `TEAMS_WORDS`, `TEAMS_CARD_WORDS`, `TEAM_ACCOUNT_WORDS` in `lib/club-money-words.ts`; `teamAccountCallout`
  removed. **Export:** an `accounting-teams` catalog entry. **Help:** `lib/help-content/accounting.tsx`.
- **Tests:** `club-team-needs.test.ts` and `club-accounting-teams-guard.test.ts` (new); `club-budget-report`,
  `club-bill-outstanding-line`, `admin-kit-nav`, `club-stage3b-screens-guard` and the scheduler guard's request-flow
  assertion updated. **Layout registry:** `admin-accounting-teams` and `admin-accounting-team-pill`.

### 11.2 Departures from §3–§4 (each kept to the drawing's meaning)
1. **⚖ The earlier-year line covers ANY earlier fiscal year, closed or not** (owner, 2026-10-16, *"Yes, any earlier
   year"*). /review found that a year which has ended but isn't closed yet counts as late on the Overview's card (C1
   counts every year) while Ask 8's line named closed years only, so that team would be red on the card and plain on
   the Teams tab. The line now names every year before the one on screen.
2. **`owedRows` moved to a pure module** (`lib/club-team-needs.ts`) instead of being exported from
   `lib/club-fiscal-reads.ts`. That file is server-only and the unit suite can't load it. Both reads import the one
   copy.
3. **`billOutstandingLine` gained no option.** The account calls the same function with `nextDue: null`, which drops
   the next-due reason, so the bill and the account still can't word late money two ways.
4. **Next due's caption no longer carries the overdue amount** when nothing is coming due. It reads "Nothing coming
   due", because the overdue amount now sits under Outstanding (a status said once per screen).
5. **The Teams tab has no closed-year line** (`YearLine`) under its toolbar, as Allocations has none. The table only
   reads, and a closed year's figures need no lock explained there.
6. **The phone Team pill fills its row** (a new opt-in `fill` on the shared dropdown, phone widths only) because the
   drawing's caption asks for it. The Ledger's Book pill stays as it is.
7. **The earlier-year line breaks before "from" when squeezed.** It is two unbreakable halves, so "2025–26" never
   breaks at its dash. At 1440 it is one line, as drawn.
8. **A team the pill doesn't list** (for example, reached by its address) is placed right after "All teams", above
   the group headings.

### 11.3 Passes and gates
- **/simplify** (four lenses, this build's files only). /review then found two of its changes wrong, both fixed: the
  refused answer's sentence and a team-list cache (below).
- **/review, high-risk** (five lenses: 21 → 12 after dedup; no Critical or High). Confirmed and fixed:
  - Medium:
    - a refused answer lost the server's sentence;
    - a request row went dead after a failed read;
    - the earlier-year rule judged a no-budget-line bill's year from one team's payments. It now uses the first
      payment across every team, as the database's lock and the Overview do.
  - Low:
    - a team list cached past a sign-out;
    - a hand-back ask showing its first amount, not today's;
    - a picked group the new year doesn't have;
    - the Overview card for a club without rep teams;
    - an unlisted team's place in the pill.
  - One call went to the owner and became departure 1.
- **/design** (1440 and 390, Warm and Dark, against hub v3): matches. Fixed to the drawing:
  - the phone pill (departure 6);
  - the 1280 name wrap (departure 7: "UAT Between Seasons" went from 3 lines to 2, "UAT Test Team" from 2 to 1);
  - the lock line's gap above Needs you (1rem).
- **/marketing:** two sentences changed (the closed-season lock line; the bills-and-requests note). The rest kept.
  **/docs:** the Accounting guide (the tabs, the Overview's card, a new "The Teams tab", a team's account in four
  answers, exports).
- **Gates, all green on this build's files:** typecheck · focused lint · every touched unit suite plus the two new ones
  · `check:spelling` · contrast · export catalog · `check:club-money-arithmetic` · `check:layout --changed` at 1440 and
  390 Warm, with Dark contrast.
  - Three accepted baseline entries: the Group filter's checkbox at 361, 390 and 768. Its whole row is the tap target,
    as on Payment requests.
  - The full unit suite's few failures are in other sessions' in-progress files.

### 11.4 Measured, left as is
- **The summary read on the Teams tab** takes about 2.1–2.6 s, the same as the Overview, which makes the same read. No
  `part=teams` was added (§3.2 allowed one only if measuring called for it). A faster summary read speeds both
  screens, and belongs to whoever next works on it.

### 11.5 Found, not in this build
- **Rep Teams' "Ungrouped"** against Accounting's "No group" (§3.6), unchanged.
- **The possessive of a name ending in "s"** ("UAT Between Seasons’s team page"). The product forms every team
  possessive one way. /marketing recommends one product-wide helper (a bare apostrophe after a final "s") swept
  everywhere at once, rather than a second form on these screens. This needs the owner's ruling.
  **⚖ Ruled 2026-10-16** (owner: *"just put the apostrophe with no additional s (i.e. UAT Between Seasons')"*) and
  built product-wide the same day: `possessive()` in `lib/utils.ts` is the one place the product builds a possessive
  from a name (the curly apostrophe); about 210 hand-built ones in app/, components/ and lib/ moved onto it, and the
  three earlier copies (schedule words, team-coach notices, the tournament record) folded into it.
  `possessive-guard.test.ts` fails on a hand-built one. Design log 2026-10-16.

### 11.6 After the build
- **⚖ Cash on hand loses its blue edge** (owner, 2026-10-16: *"why is there a blue line here?"* → *"yes remove it"*).
  The edge was drawn for a separate card (Stage 3b); inside the joined band (Stage 3d) it sat on the divider beside the
  tile and read as a stray, heavier divider, as the teams table's held column did before it lost its own on 2026-10-07.
  The lock, the caption and the lock line carry the meaning. The band's `held` tile keeps its lock and no longer marks
  itself; `club-stage3d-screens-guard.test.ts` §5 holds it off. Design log 2026-10-16; table standard §3.5. Hub version
  6 redrew screen 3's after frames (the "today" frame keeps the edge it had) and W8's words.
- **QA §321 ✅ passed 2026-10-16, nine of nine walks** (36 of 36 steps; W7's verdict confirmed by the owner when asked).
