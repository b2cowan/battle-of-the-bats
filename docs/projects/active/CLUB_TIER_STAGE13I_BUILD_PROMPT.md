# Club Tier Stage 13i · The sidebar's shape (build prompt, three sessions)

> Written 2026-11-06, after the owner ruled the 13i drawing: *"this looks good, i agree with your recommendations"* (Asks 1–9 A), then
> the same day changed Ask 4: *"the sidebar footer should remain the same as before (plan an billing stays there along with the other nav
> footer elements)"*, so **Ask 4 = B**. The drawing (version 2) shows the ruled shape.
> Paste into a **fresh chat on `dev`**, one session at a time:
> `execute Session A of @docs/projects/active/CLUB_TIER_STAGE13I_BUILD_PROMPT.md` (then B, then C).
>
> Drawing (the spec): https://claude.ai/artifact/T42raG41vUxt7gjdJEjQMR, source
> [CLUB_TIER_STAGE13I_SIDEBAR_DRAWINGS.html](CLUB_TIER_STAGE13I_SIDEBAR_DRAWINGS.html). Tab 2 shows the owner's five screens today and after, tab 3
> the registrar and treasurer, tab 4 the phone, tab 5 the tab row and the tabs-inside-tabs answer, **tab 6 the NAV_STANDARD wording to write**.
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10. Drawing prompt:
> [CLUB_TIER_STAGE13I_DRAWING_PROMPT.md](CLUB_TIER_STAGE13I_DRAWING_PROMPT.md). Design decision: `memory/design_decisions.md` 2026-11-06.
> Marks: **[V]** = the planner opened it (file:line, 2026-11-06); **[H]** = a helper's read, **re-open before editing**. Line numbers drift.
> Branch `dev`; explicit pathspecs; ask before committing; never push. Recommended model: Opus (the nav every club role shares).

## Precondition: 13a lands first

13i starts only after **13a Session B is committed** (13a reshapes the same rail, phone bar and Organization hub: House league leads
for the league admin and registrar, the House league waiting count, the "View site" pill, the honest Organization doors). Check the
plan's status log. If 13a B is not committed, stop and say so. 13i keeps everything 13a built; it changes where things sit.

## What 13i is

**Places in the sidebar, pages on the page.** The club admin sidebar lists places only and never grows: the owner sees the same 10
rows on every screen (today 10 / 21 in a team / 18 in a season / 15 in Organization), the registrar 4, the treasurer 3. Every place
with more than one page shows them as **the shared tab row** under its title, the one Accounting and Families already use. One row is
lit: the place you are in, however deep. Club-only. The tournament sidebar, both coach portals and the support console do not change.

## Owner rulings this build carries (2026-11-06: Asks 1–3 and 5–9 A, Ask 4 B)

1. **A** Places-only club sidebar; every place's pages are tabs on its page.
2. **A** No arrows on club sidebar rows; the collapsed sidebar's program menus go (each icon is a straight link).
3. **A** Organization is a place with tabs (Members, Audit log, Settings, Venue library, PDF settings); the tile hub retires;
   Tournaments and My Coaches Portal leave Organization.
4. **B** **The sidebar's foot stays as it is**: Plan & billing, Help, the other portal, Collapse sidebar (and the site door per 13a).
   Plan & billing is **not** an Organization tab; it stays in the foot and in the phone's You group, and the fee-invoice pill stays on it.
5. **A** Two headings, **Programs** (Rep teams, House league, Tournaments) and **Club** (Accounting, Families, Public site,
   Organization); a heading only over two or more rows.
6. **A** A page's own filter tabs become the view switch at the toolbar's left (Registrations' To review / Active / Waitlist / Ended).
7. **A** Below 900 the tab row scrolls sideways with its edge cue, the current tab in view.
8. **A** Tournament mode unchanged.
9. **A** Coach portals unchanged; club-only.

**What this reverses, on purpose:** the second half of the 2026-09-30 Accounting ruling ("separate jobs are listed in the rail; Rep
teams stays in the rail"). Its other clause **stands and is built**: a record's page one level down (an allocation, a team's account, a
registration) keeps its back arrow and has **no** tab row. Also re-opened: N3 (2026-10-17 Ask A2), the strip's program menus (Ask 3 of
that review), N7's Ask B3. **Do not reopen:** 13a's rulings (Asks 6–9, R1), N1, N5, N8 tiles, N10's bar for everyone, D1, the
2026-10-17 toolbar rule (left = which list), the 2026-09-27 "tab you're on is named by its colour".

## Before any code: the plain-language summary (required, blocking)

Each session opens with a product-manager summary in the conversation: what each of the five people (owner, admin, league admin,
registrar, treasurer) sees differently after **this session**, on a desk and on a phone, and what does not change. Then build.

## Facts the planner opened (2026-11-06)

- **The club rail is `components/admin/kit/AdminKitRail.tsx`** and only the club admin chrome (club and tournament mode) renders it
  [V: grep of every importer]. The Premium coach sidebar (`CoachesSidebar`), the free portal's shell and the support console's
  `PlatformAdminNav` are separate; the console imports `AdminKitFrame.module.css`, so **do not change the shared row classes**
  (`.item`, `.sub`, `.subLabel`, `.itemActive`); add club-only classes if you need them [H for the class list].
- **The program row is one `<Link>`; its arrow is an `aria-hidden` icon inside it** (`AdminKitRail.tsx:95-113`, `opensPages` :161) [V].
  A team's block is added **under** the program's pages (`:185-187`), a season's inside `.seasonBlock` (`:178-183`) [V].
- **The tab row is `components/shared/HubTabBar.tsx`**, promoted from the coach portal; the coach portal's hubs render it too [V].
  **Reuse it as is. Restyling it restyles the coaches portal** (its own header says so). Callers today: Accounting
  (`AccountingFrame.tsx`), Families (`FamiliesFrame.tsx`), a season's **Registrations** (`RegistrationsScreen.tsx`) and **Teams & draft**
  (`TeamsScreen.tsx`), and a team's **tryout flow** (`components/rep-teams/TryoutFlowHeader.tsx`) [V].
- **Tab lists live in `lib/admin-kit-nav.ts`:** `programDef` gives each program's `pages` (Rep teams :105-118 [H]), `accountingTabs` :381,
  `familiesTabs` :431, `kitOrgLinks` :272-300, `kitBillingLink` :257-265 (href via `getBillingHref`, key `org/billing`) [V for :381, :431,
  :263]. A team's pages are hard-coded in the rail (`repTeamPages()` ~:370) [H]; a season's are `SEASON_PAGES` / `seasonPagesFor` in
  `lib/house-league-season.ts:28-45` [H].
- **Bring in a coach's team** is `${r}/bring-in` with `also: /org/coaches-portal-links` (`admin-kit-nav.ts:117`) [V]. That second address
  lives under the Organization layout. See "Settle in the build".
- **The phone bar fills from `programs` in `clubProgramOrder`'s lead order** (`lib/nav-tiles.ts:43-70`; `LEAD_ORDER` =
  rep-teams, house-league, accounting, families, public-site, tournaments, `admin-kit-nav.ts:179-181`) [V]. **Leave `LEAD_ORDER` and
  `clubPhoneNav` alone.** The sidebar's Programs / Club grouping is a separate map, so no club's bar or tiles move (N10).
- **The fee-invoice pill** (the 2026-11-05 ruling: "told to the owner by a rail pill…") sits on the Plan & billing foot row
  (`AdminKitRail.tsx:327`) and, on a phone, on More and its Plan & billing row (`AdminKitBottomNav.tsx:168-175, 352`) [V]. **Ask 4 B keeps
  both where they are; do not move them.**
- **13a Session A's Organization doors:** `orgHubDoors` over `kitOrgLinks` + Tournaments + `kitBillingLink` + the person's Coaches
  Portal; one door → straight to it; none → the "not yours" screen (plan status log, 13a Session A entry) [H]. 13i's Organization tabs
  are that list **minus Tournaments, the Coaches Portal and Plan & billing** (Asks 3 and 4 B), i.e. `kitOrgLinks` alone.
- **Phone:** the "In ‹program›" disclosure is `AdminKitProgramRow.tsx` (renders only on the program's first page, `:200`) [V]; a season's
  phone frame is `components/admin/kit/club/SeasonPhoneFrame.tsx`, mounted by `seasons/[seasonId]/layout.tsx` [V]. The view switch is
  `components/coaches/kit/ViewSwitch.tsx` [V].

## Split: three sessions, each leaving `dev` working

- **Session A, pages on the page.** Every place gets its tab row; the sidebar is **not** touched yet (its rows are redundant for one
  session but nothing breaks). Items A0–A7.
- **Session B, the sidebar and the More sheet.** Places only, headings, foot, one lit row, the strip, the phone sheet, NAV_STANDARD and
  its guards. Items B1–B7.
- **Session C, words, checks, the walk.** Help articles, the demo check, the layout sweep, the walk. Items C1–C5.

Each session ends with `/simplify` → `/review` → `/docs` offered (C runs `/docs` itself), and asks before committing.

---

## Session A · Pages on the page

### A0 · The census, before code (report it in the summary)

List every route under `admin/rep-teams/`, `admin/rep-teams/teams/[teamId]/`, `admin/house-league/seasons/[seasonId]/` and `admin/org/`, and
put each in exactly one bin: **a tab** of its place, **a record page** one level down (back arrow, no tab row), or **belongs to another
place**. Known routes to bin [V, `ls`]: rep-teams `assistant-coaches bring-in documents past rename-slugs shared-library teams`; a team
`coaches history program-years roster schedule tryouts`; a season `club-schedule ledger money notifications registrations schedule
standings teams`; org `billing coaches-portal-links members (+ members/audit) notifications settings team-links tournaments venues`.
And list every page that **already has its own tab row** and becomes a tab of a place (at least the three `HubTabBar` callers above).
**Stop and ask the owner** for any route or inner tab row the drawing does not settle (see "Settle in the build").

### A1 · One list of tabs per place, in the nav model

In `lib/admin-kit-nav.ts`: a program's `pages` **is** its tab list (Rep teams' six). Add a team's tab list (Team page · Roster · Schedule ·
Tryouts · Coaches; move it out of the rail), keep the season's (`seasonPagesFor`), and add Organization's: `kitOrgLinks` in their order,
and nothing else (Plan & billing stays a foot row, Ask 4 B). One function each, called by the layouts in A2–A5 and, in Session B, by the
More sheet. A tab a person cannot open is not in the list; a list of one draws no row.

### A2 · Rep teams: the tab row on every program page

`rep-teams/layout.tsx` draws the place header ("Rep teams", no create in the header) and the tab row on every Rep teams page **except
under a team** (a team is its own place, A3). **Add team moves into the Teams tab's toolbar**, at its right end (2026-09-30: a create
belongs to the tab's toolbar). Each page keeps its body; its own duplicate title goes, as Accounting's tabs have none. Every tab is its
own address (Back, bookmarks and notification links keep working).

### A3 · A team is a place

A new layout for `rep-teams/teams/[teamId]/`: header "← Teams" (the back door, named by destination), eyebrow "Rep teams · {group}",
the team's name, its season chip; the team's tab row. The Team page's own actions (Close the season, Start next season) stay on the
Team page tab only. Sub-pages that the tab row now reaches **lose their "← {team}" back link** (2026-10-20: a back link stays only where
the tab row does not go); a record page one level deeper keeps its back arrow and has no tab row. **No team switcher** (not ruled;
from 14U AA to 15U AA is through Teams, as now). The header and tab row draw with the frame, before data; the team's name may show
a placeholder while it loads, but nothing shifts.

### A4 · A season is a place

`house-league/seasons/[seasonId]/layout.tsx`: one header on every season page: "← Seasons", eyebrow "House league", **the season's name
with the switch chevron** (the season picker moves out of the rail into the title: on a phone it opens the shipped switch sheet from
`SeasonPhoneFrame`; on a desk use the product's shipped pick-one menu, the one the Year pill opens), the status chip, then the season's
tab row (Registrations carries its waiting count). The sub-pages' own back links ("← Seasons" on Overview, "← {season}" elsewhere) go.
**`SeasonPhoneFrame`'s card and pill strip retire** (its switch sheet survives). **Registrations' status tabs become the `ViewSwitch` at
the toolbar's left** (Ask 6): only To review's count is amber, the others in the lighter ink; search, filters, Export, then Add
registration at the right end, per the 2026-10-17 toolbar rule. The club-schedule page keeps lighting Schedule (fix-now).

### A5 · Organization is a place with tabs

`org/layout.tsx`: header "Organization", tab row Members · Audit log · Settings · Venue library · PDF settings. Audit log lives under
`members/audit`, so **Members must not light there** (the existing step-aside rule, `isKitLinkActiveAmong`). **The `/org` hub page
retires**: `/org` goes to the first tab the person holds (13a's one-door rule: one tab → that page with no tab row; none → 13a's "not
yours" screen). Tournaments, My Coaches Portal and Plan & billing are no longer reached from Organization: Tournaments is a program row,
and the Coaches Portal door and Plan & billing are in the foot. **`org/billing` (Plan & billing) lives under this layout but is not an
Organization tab:** it draws its own header and **no** Organization tab row, and the sidebar lights its foot row there, not Organization
(today's step-aside rule). Bin the other `/org/*` routes per A0. Delete the hub's tile array only after nothing links to it.

### A6 · The phone, in the same session

The tab row already scrolls below 900 with its edge cue (`HubTabBar`), the current tab scrolled into view; verify it on each new place.
**`AdminKitProgramRow` ("In Rep teams") retires**: the tabs replace it, and it would duplicate them on Rep teams' first page. The bottom
bar is not touched.

### A7 · Session A's guards

A unit guard (new file, e.g. `tests/unit/club-stage13i-places-guard.test.ts`): each place's layout renders the shared tab row from the
model's list, not a hand-written one; Rep teams' tab row is absent under a team; no "← {team}" or "← {season}" back link on a page its
tab row reaches; Registrations has no tab row of its own and uses `ViewSwitch`; Add team is not in a page header; `/org` has no tile
array left. Re-point the guards that pin the old shapes (at least `house-league-season-frame.test.ts:93-96` [H]).

---

## Session B · The sidebar and the More sheet

### B1 · Places only, one lit row

In `AdminKitRail.tsx`: the club body lists Overview · Calendar · Schedules, then **Programs** (Rep teams, House league, Tournaments),
"Also on your plan" where it shows today, then **Club** (Accounting, Families, Public site, Organization). Each program in `LEAD_ORDER`'s
order inside its group, from a **group map** kept beside `LEAD_ORDER` (never a reordered `LEAD_ORDER`). **Nothing renders under a row:**
`RepTeamBlock`, `SeasonBlock`, the program pages, the Public site's lone "Site editor" row and Organization's rows all go. **No
chevrons** on club rows. **One lit row:** the place whose section you are in (Overview exact; the rest by section), at any depth. The
bold "open program" second style goes. A heading is drawn over two or more rows; a lone row keeps the heading's space with no word
(registrar: Overview, Calendar · House league · Organization). The tournament-only org's flat "Account" list, `TournamentRail` and
tournament mode are unchanged.

### B2 · The foot: unchanged (Ask 4 B)

Leave the foot exactly as 13a leaves it: Plan & billing (owner, with its fee-invoice pill), Help, the other portal's door (when held), the
site door per 13a, then Collapse sidebar. On Plan & billing's page the foot row is the one lit row.

### B3 · The row's end

A place's row carries **the sum of its pages' waiting counts**; each tab carries its own (House league = 13a's registrations count;
Accounting and Families unchanged). The view-only eye, where it applies, stays first on the row and on each tab it applies to (N9).

### B4 · The collapsed sidebar

Every club icon is a straight link to its place: the program and Organization menus (`opensMenu`, `stripMenuRowProps` and their menu
body, `AdminKitRail.tsx` ~:98, :156, :205-242 [H]) go for the club body. One lit icon. The tournament strip is unchanged.

### B5 · The phone More sheet

The sidebar's places under the sidebar's names, in the sidebar's order, two columns, never folded: a one-row group draws no heading
(the owner's Tournaments), then Club. **Organization appears once** (its pages are its tabs). You is unchanged (Account, Home, the
other portal, Plan & billing with its fee pill). Notifications, the tiles and `MoreSheetFoot` unchanged. Expected owner sheet: 19 entries
→ 14 (drawing tab 4, version 2).

### B6 · NAV_STANDARD.md

Rewrite N2, N3, N4, N7, N9, N10 and add **N11 · Pages on the page** with the drawing's tab-6 wording ("After 13i" column, version 2: N4
now writes the foot down as built, Plan & billing first), dated 2026-11-06,
citing this ruling. Exceptions: retire "The chevron follows the pages, not a list of names"; keep "Tournaments replaces the sidebar" and
"The club sidebar groups places; the coach sidebar groups pages" (now strictly true); add the 2026-09-30 reversal note under N11. Update
the "Built" line to name 13i.

### B7 · Guards, rewritten for the new rules

- `tests/unit/admin-kit-nav.test.ts`: the place lists and their gates (owner/admin/league admin/registrar/treasurer); one lit row at any
  depth (Rep teams lit on a team's Roster, House league on a season's Registrations, Organization on Audit log); `LEAD_ORDER` unchanged.
- `tests/unit/nav-standard-guard.test.ts`: N2 (no club heading folds; a heading only over ≥2 rows), N3 (no chevron in the club body;
  tournament group chevrons kept), N4 (the foot's order as built, Plan & billing first, unchanged by 13i), N7 (the club sheet lists
  Organization once; You keeps Plan & billing), N11 (every place's tab row is `HubTabBar`; Organization's tabs never include Plan & billing).
- **A phone-bar and More-sheet parity case:** for each of the five people, the sidebar's places = the bar's tabs + the tiles + the
  sheet's rows, nothing twice, nothing missing; and the bar and tiles for each person are **identical** to before 13i (snapshot the
  five before you start).
- Re-point the other guards that read the rail's source (at least `sidebar-strip-guard`, `club-stage1`, `club-stage6b`,
  `plan-billing-delegate-and-links`, `fee-invoice-alert`, `club-stage13a-doors-guard` [H]). A guard that pinned the old shape is
  rewritten to pin the new one, never deleted to go green.

---

## Session C · Words, checks, the walk

### C1 · Help articles (`/docs`)

Every article that names a sidebar row, an arrow, the "In Rep teams" row, the season block, Plan & billing's place or Organization's
hub. Known [H]: `lib/help-content/org.tsx:259-276` (the collapse-sidebar article: it also wrongly says Families opens a menu), `:116-121`,
`:402`, `:1325` (Plan & billing's place in the foot and More › You is unchanged, so `:249` / `:292` should stay true; check);
`house-league.tsx:38-50` (the season block, switcher and phone strip); `accounting.tsx:600` ("In Rep teams");
`tournaments.tsx:66-78, 97, 105` (check, likely unchanged). Search words (`keywords` / `searchText`) too. `npm run check:spelling`.

### C2 · The demos

No demo tour anchor targets a sidebar row [H: all 12 `data-sandbox-tour` anchors are page widgets]. Confirm with one grep; the build
fails if a tour destination stops existing, so a moved page (the `/org` hub) is checked by the build itself.

### C3 · The layout sweep

Not on the dev server. Run it against a local production build (`node .probe/p5-prodbuild.cjs start`, port 3100) or staging, every
club place at 1440 / 768 / 390, with an eye on the tab row's edge cue and no page scrolling sideways.

### C4 · The walk (one purpose: "you can always tell where you are and get back")

One checkable walk Artifact, its own Owner QA Ledger section (the next free §), for the owner, the registrar and the treasurer on a desk
and a phone: the row count is the same on every screen; one lit row; every place's tabs; into and out of a team and a season by the
header and by the row; the season switch; Organization's tabs (and the registrar's single door with no tab row); Plan & billing still in the
foot with its fee pill, and its page showing no Organization tabs; the More sheet's 14; Back and a bookmark land on the same tab. Rewrite one walk → grep
every walk that names a sidebar row or the "In Rep teams" row and re-point it.

### C5 · Close-out

`/simplify` → `/review` → commit on the owner's word; the plan's status log (one entry per session, with the commit hashes); the TODO
Stage 13 line; the Stage 13 hub's ladder (13i) when it is next republished.

---

## Settle in the build (stop and ask; each has a recommendation)

1. *(Settled by Ask 4 B: the fee-invoice pill stays on Plan & billing in the foot. Nothing to ask.)*
2. **Inner tab rows the drawing did not draw.** Teams & draft (`TeamsScreen`) and the team's tryout flow (`TryoutFlowHeader`) already
   render `HubTabBar`. Registrations was drawn (Ask 6). If either inner row is a filter of one list, it becomes the `ViewSwitch` by Ask 6;
   if it is steps or separate pages, **stop and ask**: do not stack two `HubTabBar`s.
3. **`/org/coaches-portal-links`** (the second address of Bring in a coach's team), **`/org/team-links`**, **`/org/notifications`**,
   **`/org/tournaments`**, `rep-teams/rename-slugs`, a team's `program-years` and `history`, a season's `ledger` and `notifications`: bin each
   per A0. **Recommended:** a page reached from a Rep teams tab draws Rep teams' tabs (move or redirect it out of `/org` if needed); a page
   that is one record's detail is a record page.
4. **The desk season switcher's control.** Use a shipped pick-one menu (the Year pill's). If none fits, stop and ask rather than drawing
   a new control.

**Answered by the owner in Session A (2026-11-06), as asked and as answered:**

- **2 → "Division picker (Recommended)".** Teams & draft's per-division tab row becomes the division pick-one box Registrations uses, at
  the toolbar's left. (The team's tryout steps row is the coaches portal's only; the club's Tryouts page has no tab row.)
- **3 → "Record pages (Recommended)".** A team's History and one past season, Rename team addresses, and a club schedule read from a
  season: no tab row; each keeps its own title and back link.
- **4 → "Title opens the menu (Recommended)".** The title's chevron opens the Year pill's menu (same panel and rows), its button the
  title, as an opt-in face so every other caller is unchanged.
- **New, raised before code → "A 'The board' tab (Recommended)".** Retiring the Organization hub removed 13a's "The board" card (R1). For
  someone without Members, Organization gets a read-only "The board" tab in Members' place: names and roles, never an email.

## Done means

- The owner's sidebar has the same 10 rows on Overview, a team's Roster, a season's Registrations, Organization › Audit log and Accounting;
  the registrar's 4, the treasurer's 3; one lit row each time.
- Every place with two or more pages shows the shared tab row on desk and phone; no page shows two tab rows; no record page shows one.
- Every phone bar and tile set is identical to before 13i (the parity case passes).
- NAV_STANDARD describes the shape that ships; the guards pin it; help articles name it.
- The walk is published, ledgered, and walked by the owner.

## Do not

- Restyle `HubTabBar`, `ViewSwitch` or the shared row classes (each would change the coaches portal or the console).
- Touch the tournament sidebar, either coach portal or the support console.
- Reorder `LEAD_ORDER` or change `clubPhoneNav`.
- Add a team switcher, a Permits place (13c), or rename anything (13h).
- Record the owner's answers as anything but what they said.
