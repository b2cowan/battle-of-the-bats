# PDF Export Quality — plan

**Status:** **PHASE 1 + PHASE 2 PASSES 1–4 (REGISTERS, STATEMENTS & HANDOUTS, ROSTERS, WORKING
SHEETS) BUILT on dev** — passes 1–3 on 2026-08-23, Working sheets on 2026-08-24 (Owner QA Ledger
§79, §82, §84, §86 and §91; migration 259 dev-only; the Statements, Rosters and Working-sheets
passes added no migration. Working-sheets checkpoint-1 decisions — owner took all seven
recommendations: https://claude.ai/code/artifact/d3675cd6-ea40-47a6-b7c9-73c1d7a90616; built
gallery https://claude.ai/code/artifact/771dd950-ab5c-40db-9b2d-79b0ab05e854. Rosters checkpoint-1 decisions — owner took all four
recommendations: https://claude.ai/code/artifact/c189810f-c10f-468a-ab14-7efd1fca0c9a; built
gallery https://claude.ai/code/artifact/eaa601d4-0438-4046-947c-99b24d957ec5. Statements
checkpoint-1 mockups
https://claude.ai/code/artifact/43b20053-b0d5-4f8c-8f33-9f82c9855da8 — owner picked the drawn
one-pager, both doors, coach-hands-it-over; built gallery
https://claude.ai/code/artifact/dc3a8252-41bd-4050-9e2a-c6417426d557;
approved card mockup https://claude.ai/code/artifact/b72a7ee2-4c8d-4339-9b7a-8e5d3d6b1b93 — the
spec for the "How your documents look" card, incl. the two owner-approved additions: the
"Back to your club's look" reset row and the "Use your team colour" chip). Phase 1's fit
contract sharpened one rule in build (owner-agreed 2026-08-22): **fixed-column reports are
guaranteed to fit by construction; only customer-shaped tables (rubric categories,
settings-driven columns, coach-sized grids) may ever fall back to the drop-and-say-so note.**
The last two Phase-2 groups (schedules; posters, cards & brackets) and Phase 3 remain. Every structural decision below is **Decided**, made by the
owner in the 2026-08-21 planning session against rendered evidence, not descriptions.
**Evidence gallery (approved exhibits):** https://claude.ai/code/artifact/834cdd89-8c24-416f-acd8-c1930ff76dd1
— every document rendered by the real export code with realistic fictional data, in untouched-org and
branded-org variants. **The gallery is the visual spec for what "broken" and "good" mean here.**
**PM brief:** `PDF_EXPORT_QUALITY_PM_BRIEF.md` · **Raised:** owner, 2026-08-21, on the Budget vs. Actual PDF.
**History:** the session prompt that drove this (now served) is archived at
`docs/projects/archive/PDF_EXPORT_QUALITY_PLANNING_PROMPT.md`. Its warning was correct: the previous
inventory in this file was wrong, and §1 below replaces it from a code re-count.

---

## 1 · The corrected inventory (re-counted from code, 2026-08-21)

The old numbers — "fifteen PDFs: nine on one renderer, six bespoke" — were wrong four ways: two of
the nine were stubs, two of the "six bespoke" actually ride the shared engine, and the count missed
the check-in sheet, the blank bracket, and that Budget vs. Actual is two different documents on two
different surfaces. The true picture:

**17 documents ship. 12 ride the shared table engine (`lib/export/pdf.ts` `buildTablePDF`), 5 are
genuinely bespoke drawings. 3 menu buttons offer PDF and apologise instead.**

### On the shared table engine (12)

| Document | Surface | Notes today |
|---|---|---|
| Tournament Registrations | admin tournaments | division groups; fetches branding |
| Tournament Schedule | admin tournaments | **hand-forces landscape+compact** — the model D2 makes official |
| Tournament Results | admin tournaments | 11 cols incl. score-audit trail; org-default orientation → **9 pages/24 games, shredded** |
| Budget vs. Actual (org admin) | admin accounting | **hand-forces landscape**; 7 cols; clean |
| Coach Budget vs. actual (category shape) | coach Money | 4 cols; clean |
| Coach Budget **by month** (month grid) | coach Money | up to 17+ cols; org-default orientation → **7 pages of vertical confetti** — the document this project was raised on |
| Player Dues (team sheet) | coach Money | 6 cols; clean bones |
| Team Roster | coach roster | 10 cols with guardians; portrait → names shred; honours guardian-privacy toggle; DOB always |
| Tryout report — full detail | coach tryouts | 5+N cols; staff-only confirm; shreds names |
| Tryout check-in sheet | coach tryouts check-in | **only document that never fetches branding** (comment: "later polish"); tick-box column narrower than Notes |
| Practice sheet | coach practice event | groups mode; tables fit; blank "Tonight" header band |
| Development summary | coach player development | groups mode; structurally the best table document |

### Bespoke drawn documents (5)

| Document | Notes today |
|---|---|
| Tryout board summary | the standard-setter: correct page totals, stat row, receipt; never draws the logo |
| Lineup poster (dugout wall) | strong; accent + FieldLogicHQ line only |
| Batting-order card | strong |
| Playoff bracket | works incl. connectors + winner bolding; floats high, dead space below |
| Blank bracket (draw-day fill-in) | works |

### Stubs — PDF offered, apology delivered (3)

- **House League → Season Registrations** — shows *"PDF export is coming soon."* as a green **success** toast.
- **Rep Teams → Program-year roster** — info modal promising "org logo, header, and privacy settings" (a promise D4 currently makes impossible for every org).
- **Rep Teams → Tryout applicants** — same shape. (The export catalog already refuses to list these as live.)

**Plan gate:** every PDF sits behind `pdf_exports` (Tournament Plus and up, plus the standalone coach
Team plan). Every reader of these documents is a paying customer's audience.

---

## 2 · Decisions of record (owner, 2026-08-21 planning session)

1. **Group by what the document is for — six groups:**
   **Registers** (tourn. registrations, results, both admin/coach BVAs + month view, tryout full
   detail, HL registrations when built) · **Statements & handouts** (player dues, development
   summary, tryout board summary) · **Rosters** (team roster, rep roster when built) ·
   **Schedules** (tournament schedule) · **Working sheets** (practice sheet, check-in sheet) ·
   **Posters, cards & brackets** (lineup poster, batting card, bracket, blank bracket).
2. **The three stub PDF buttons come out of their menus in Phase 1** (no menu may lie); each PDF is
   then **built for real during its group's pass** — HL registrations and tryout applicants with
   Registers, rep roster with Rosters.
3. **Orientation/shape is a property of the report, declared in code.** The org-wide setting remains
   only as the default for reports that fit either way. (Schedule, bracket and admin BVA already do
   this by hand; it becomes official and universal.)
4. **The month grid stops pretending to be a PDF.** The month view's PDF button produces the
   **category statement** (the shape that fits paper); the month-by-month detail lives in the
   spreadsheet formats the same button already offers (whole-season, as ruled 2026-08-21).
5. **Content calls, all approved, built in-group:** Results drops its audit columns (submitted-by /
   at / source stay spreadsheet-only) · Dues gains a **per-family statement** variant beside the team
   sheet · the check-in sheet **fetches org branding** like everything else (and widens its tick-box
   column) · the drawn documents (board summary, bracket, posters/card) **draw the logo** once D4
   makes logos real.
6. **Standing floor rule:** *a document that is read, handed, or pinned gets a PDF; data someone
   works in stays a spreadsheet.* The ~20 spreadsheet-only exports (ledgers, standings, member
   lists, the club money datasets — several spreadsheet-only by existing owner ruling) all pass this
   test today; **nothing new is owed**. The rule governs every future export decision.
7. **Document branding is TWO LAYERS, and the team layer lives in the coaches portal** (owner,
   2026-08-21 follow-up). Today the design settings are club-admin-only and a standalone coach can
   reach none of it. Decided: every coach — standalone and club-owned — gets a "How your documents
   look" card in their portal's team settings (team logo, accent, footer). Club PDF Settings stay
   for club-admin paper **and are the inherited default**: a team that sets nothing shows the club's
   look; a team that customizes shows its own on team-generated paper. **No club "lock to our brand"
   toggle in v1** — inheritance makes uniformity the default; build a lock only if a real club asks.
   D1's name fallback follows the layer: **team paper falls back to the team name, admin paper to
   the org name.** Logo resolution: team logo → club logo → none.
8. **The standalone Team plan includes document customization** (owner, 2026-08-21 follow-up) —
   today customization is Tournament Plus+; the Team plan gains it so a standalone team can carry
   its own identity. ⚠ Packaging inclusion: update `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts`
   in the same unit of work that ships it, and log via `/strategy`.
9. **The practice sheet's structure is DECIDED — the run sheet** (owner, 2026-08-22, in the
   structure session this decision had held the sheet for). The chart form was wrong for it — a
   practice plan is mostly sentences, and the table flattened them. The decided form: a drawn
   run-sheet layout (times down a left gutter, prose at full width, rotation grids compact inside
   their owning blocks) — off the table engine, still on the shared identity/footer/page-count
   plumbing. **Spec + rejected alternatives:**
   `docs/projects/active/PRACTICE_SHEET_STRUCTURE_PLAN.md` (approved rendered exhibits linked
   there). It builds in the **Working sheets** pass; Phase 1's generic plumbing still reaches the
   current sheet incidentally in the meantime.

---

## 3 · The defects — now five, all shared plumbing

**D1 · Title printed twice for every untouched org.** The header falls back to the *report title*
when `headerLine1` is blank, then the title block prints it again. The PDF Settings page's own hint
promises the opposite ("Defaults to your org name if left blank") — the fix is to make the code do
what that sentence says: pass the identity through and fall back to it (the board summary already
does exactly this). Per decision 7, the fallback follows the layer: **coach-portal documents fall
back to the team name, admin documents to the org name.** Also kill the practice sheet's empty dark
header band (its "Tonight" section has blank column headers).

⚠ **D1 was only ever true of PAGE 1 — found in the Rosters pass (§86), fixed there.** Any table
spilling past one page printed its continuation pages with no identity band at all: no crest, no
club or team name, nothing but a table and a footer. The grouped path already redrew the band
whenever IT added a page; autoTable's own pagination did not, which is how every flat multi-page
report (schedule, month grid, a long roster) shipped anonymous back pages. The fix makes the
grouped path's behaviour universal and was proved free by re-scanning the whole corpus to
byte-identical page counts. **Lesson for the remaining passes: a guarantee checked only on the
first rendered page is not checked.**

**D2 · No report owns its shape.** Reports declare orientation (and density where it matters) in the
export contract; the org preference applies only where either shape fits. With it comes a **fit
contract**: a declared minimum column width, per-column priorities for what drops first on narrow
targets, and a declared behaviour when a table still cannot fit — never the current fallback.
Row-splitting across page breaks (Results p2's orphaned cell fragments) is turned off.

**D3 · The page counter lies.** The table engine stamps "Page X of Y" while pages are still being
created, so a 9-page report reads "Page 1 of 1 … Page 2 of 2". Fix with the total-pages
placeholder/post-pass (the board summary's loop is the in-repo reference).

**D4 · The logo is a phantom.** No org has ever printed one: "Use org logo" stores nothing, the
upload override is itself "coming soon", and nothing feeds the org's uploaded logo into any
document. Fix: resolve identity into the PDF settings payload server-side (the API route is the
chokepoint) with the decision-7 layering — **team logo → club logo → none, team settings → club
settings → defaults** — draw it **aspect-fit** in the logo slot (the fixed 24×12 mm box would squash
a square crest), and guard/downscale size so an unoptimised upload cannot bloat every export (the
evidence run measured ~0.9 MB added per document by one oversized image). Ships with the coaches
portal "How your documents look" card (decision 7, all coaches incl. standalone per decision 8).
Fix the settings-page copy to match reality as shipped.

**D5 · Nothing renders a PDF in any check.** Every defect above survived every static gate and was
found by looking at the paper. Phase 3 adds a rendered-document check: generate the **widest real
tables** through the real renderers in Node (the planning session's harness proves the approach: a
small resolver shim + jsPDF runs headless) and assert page count, minimum column width, and true
page-total footers. It fails when a document stops fitting.

---

## 4 · Phases

**Phase 1 — the shared plumbing, one unit of work (D1–D4 + honest menus).**
Header fallback to the layered identity (team name on team paper, org name on admin paper) ·
per-report shape declaration with the fit contract · true page totals · the real identity pipeline
(server-resolved team → club → defaults, aspect-fit, size-guarded) **including the coaches-portal
"How your documents look" card for every coach, standalone included** (decisions 7–8; the Team-plan
inclusion updates the pricing Facts doc + plan config in this same unit) · remove the three stub PDF
options. Every one of the 12 engine documents improves at once; the drawn documents pick up the logo
hook. **Proof of done:** regenerate the evidence set and re-read it against the gallery — the
untouched-org variants must come out with one title, the right name for the layer, true page counts,
and no vertical shredding anywhere; plus one exhibit of a club team carrying its own look distinct
from its club's.

**Phase 2 — the six group passes, worst first.** Each pass applies its decided content calls and
judges on the group's own definition of good:
- **Registers — BUILT 2026-08-23 (QA §82).** Owner picked the tryout diet from rendered options:
  short codes + a legend, plus compact rows, so a ten-category rubric keeps every column. Rendering
  the pass also turned up two shared-plumbing defects nobody was looking for — column headings were
  measured in the regular face while printing bold (and then capped), so real reports printed
  "Divisio n"; and a subtitle was drawn as one line, so a long legend ran off the paper. Both fixed
  in-pass, owner-approved. ⚠ The heading fix pushed the **team roster** past landscape (it had been
  fitting only because its headings were allowed to shred) — it now declares compact as a regression
  guard, and the **Rosters pass still owns its real diet**. Original scope, all delivered:
- **Registers** (first — both unreadable documents live here): Results declares landscape and drops
  audit columns; tryout full detail declares landscape with a column diet; month-view PDF becomes
  the category statement; build the two stub registers (HL registrations, tryout applicants).
  *Good = complete, reconcilable, survives being emailed to a treasurer.*
- **Statements & handouts — BUILT 2026-08-23 (QA §84).** The per-family dues statement exists: a
  DRAWN one-pager (owner-picked from three rendered forms — the engine sections form ran to two
  pages on a sibling family, the minimal form lost the plan ahead) in the board summary's drawn
  family, on the shared identity/logo/footer plumbing, never a renderer fork. One household's
  children and nobody else's; siblings collapse via a server-made opaque family key that survives
  PII redaction (`lib/coach-family-dues.ts` reused as the one grouping-and-naming home, its rollup
  gaining a `paidUp` list); every figure is the dues payload's own arithmetic. Two doors, one
  builder: a "Family statement" action in the player's drawer, and "Family statements" as a
  second-document row in the Dues tab's existing Export dialog (`MoneyExportButton` gained
  `secondaryPdf` — the one-Export-control ruling holds). The batch file restarts page numbers per
  family and names the household on overflow pages. Delivery is coach-hands-it-over; **email
  attachment deliberately not built** (no attachment support exists in the email stack; the
  reminder path's rules stay settled). The board summary now draws the crest via a logo slot
  helper shared with the table engine (the bracket's own squashed version is the Posters pass's).
  Identity defaults confirmed on paper for all three handouts, no defect found. *Good = the
  club's face; one page; a stranger would think well of the club.*
- **Rosters — BUILT 2026-08-23 (QA §86).** The in-pass decision went to **two content variants of
  one document**, owner-picked from rendered options: the **wall copy** (number / player /
  positions / status, portrait) is what "Export → PDF" now gives you, and a **contacts sheet**
  (adds date of birth + guardian columns, landscape) is a second document row in the same Export
  menu — offered only to a coach granted family contacts, which is also what retired the
  four-empty-columns defect. ⚠ **Not a renderer fork** (§5 holds): one engine call, two column
  lists. The §82 compact regression guard is retired with it; merging First/Last into one `Player`
  column bought the width back. Also decided on paper: **no birthdates on the wall copy** (a
  birth-*year* variant was rendered and rejected — one value fourteen times on a single-age team).
  The **rep program-year roster PDF** exists on ADMIN paper, grouped by standing with counts, at
  the registers' privacy floor. The framing came from the CODE, not this plan: the
  guardian-contacts switch is club-admin-only, so a **standalone** coach had no way anywhere to
  stop their roster printing every child's birthdate — which is why "one document, everything"
  could not win. Two things rendering found that nobody was looking for: ⚠⚠ **every table
  spilling past one page printed its continuation pages with NO identity band at all** — no crest,
  no club or team name — so Phase 1's guarantee held only on page 1; fixed in the shared engine
  (`didDrawPage` + a reserved `margin.top`, the grouped path's behaviour made universal) and proved
  free by re-scanning the whole 54-document corpus to byte-identical page counts. And the
  rep-teams **"Excel with contact details"** export, raised in §82 and left then, had no plan check
  at all while the PDF above it carried one — now gated; the coaches' own roster spreadsheet was
  checked and deliberately left on its role grant. *Good = readable pinned to a wall; privacy-aware.*
- **Working sheets — BUILT 2026-08-24 (QA §91).** The practice sheet is rebuilt as the decided
  **run sheet** (decision 9): a drawn layout — times in a left gutter beside an accent spine, the
  coach’s prose at full width, each rotation grid inside the block that owns it with its
  honest-arithmetic statements as sentences and its group lists beneath — on the shared
  identity/logo/footer/page-total plumbing, never a fork of the table renderer. Its §82 compact
  stop-gap retired with it. Three edges the spec left open were decided from rendered pages, all
  seven checkpoint-1 recommendations taken: an **unfinished** rotation prints what is missing and
  the groups that exist (it used to print nothing at all); a block **taller than a page** takes a
  clean page and then flows, breaking only between whole lines and re-labelling itself
  “(continued)”; and a rotation whose customer-named groups cannot print whole **turns the grid
  on its side** rather than shredding a name. ⚠ The spec’s “rotation with no owning block” case
  was found in the CODE to be impossible — a rotation is a property of its block — and was
  reported rather than built around. The **check-in sheet** turned out worse than this plan
  recorded and is fixed whole: it now fetches branding (it was the only document in the product
  that never had), carries the team identity (its header band had **no name on it at all**), names
  the **session** it is printed for with date, time and place (two sessions on one weekend printed
  identical undated paper), prints a real **box** in a column named “Checked in” rather than a
  two-character “In” that earned it less width than the always-empty Notes column, declares
  portrait, says so when a tryout is blind, and is **in the export catalog** — recording honestly
  that it takes no plan gate, because the button never has. One shared-engine addition, opt-in and
  proved free across the 65-document corpus: a report may declare **a column the reader fills in by
  hand**. *Good = works in a coach’s hand, in weather.*
- **Schedules — BUILT on dev 2026-08-25** (owner QA §102; prompt
  `PDF_EXPORT_QUALITY_P2_SCHEDULES_BUILD_PROMPT.md`). ⚠ **This bullet used to read "already the
  model; verify against the gallery, nothing structural" — written in the 2026-08-21 planning
  session, and WRONG.** Rendered through the real exporter it carried FIVE defects, two of them
  worse than the prompt's own list: the Date column printed the **stored** `2026-07-31` (not the
  prompt's assumed "Fri, Jul 10" — that was a hand-written exhibit), so the word *Friday* appeared
  nowhere on a document whose whole job is a weekend; the Status column printed raw lower-case
  database words; the venue name repeated ahead of the only part that differed; a game with no time
  printed an **empty cell**; and — highest consequence, unlisted — **a cancelled game was
  typographically identical to a live one**, marked only by a small grey word past six columns.

  Shipped: games **group by day**, each heading naming the weekday, the game count and the day's
  single park (lifted only when every game has a field to leave behind); the screen's own status
  words (Final / Scheduled / Cancelled, sentence-cased for any future enum member); the Status
  column **speaks only where it is an exception** and comes off the paper entirely when nothing
  would speak, with a uniform day saying "· all final" once in its heading; a cancelled game **gives
  up its clock** (the Time cell reads CANCELLED, the row keeps "was 7:00 PM"); "Time TBD" where a
  time is missing. The print shape lives in `lib/export/schedule-document.ts`, shared so a league
  season reads the same way when it gets its PDF. Spreadsheet/CSV/iCal are untouched and still
  carry every column and every raw value.

  Three shared-engine fixes, reaching every grouped document (registers, results, development
  summary): a section that **spills a page carries its name onto the next one** marked
  "(continued)"; a heading can no longer strand itself at the foot of a page; and all sections of
  one document share **one column grid** — pinned only when every column can have what it wants, so
  an over-subscribed table keeps the existing squeeze. Proved by re-rendering the **78-document
  corpus** before and after: two rows moved, one of them not this pass's. ⚠ The cost is honest and
  the owner's to reverse: **tournament results went 4 pages → 5**, because the continued heading
  takes room at the top of every spilled page.

  **Decision 6 resolved (owner, 2026-08-25, from rendered paper):** the floor rule stands and the
  coach team season schedule + house-league season schedule **are owed PDFs** — each in **its own
  pass**, not absorbed here, because each is a new document with its own column decisions. The
  export catalog now records that rather than the stale "not yet implemented" (both ARE
  implemented; only the PDF is missing).

  ⚠ **Two things deliberately NOT done, both flagged to the owner:**
  1. **The clock spelling.** The tournament/admin surfaces say "8:00 AM" (`formatTime`, 28 files);
     the coach portal, family emails, run sheet and every help article say "8:00 a.m.". One word,
     two spellings in a customer's hands — the same shape as the `colour` / `-ise` piles in
     AGENCY_RULES. The schedule PDF was left matching its own screen; changing only the PDF would
     have created fresh paper-vs-screen drift. Owner + `/marketing` decision, its own pass.
  2. **Mid-word cell breaking on narrow columns** ("Maplewoo / d Mustangs" on the results report).
     PRE-EXISTING, caused by `CELL_TOKEN_CAP_MM` in the shared floor rule; changing it moves column
     widths on every table in the product. Its own pass.

  *Good = the whole weekend, at a glance, on a wall.*
- **Posters, cards & brackets:** logo on the drawn documents; bracket vertical centring. *Good = big
  type, high contrast, one job.*

**Phase 3 — the D5 check wired into the verify pipeline**, seeded from the session harness, run on
the widest-table fixtures so this class of rot cannot return unseen.

---

## 5 · Rejected / deliberately not built (with the why)

- **A landscape month-grid PDF** — rejected on evidence: landscape made it *worse* (7 pages → 11;
  the shorter page loses more than the wider one gains). The month grid is a spreadsheet shape.
- **Auto-orientation by column count** — rejected: an invisible flip, and column count is a poor
  proxy for width.
- **Building the three stubs immediately on today's template** — rejected: they would inherit the
  defects and be re-judged anyway; remove-then-build-in-group instead.
- **PDFs for the ~20 spreadsheet-only exports** — none owed; governed by the standing floor rule
  (decision 6).
- **A per-report formatting fork** — still forbidden. Phase 2 works through the shared contract
  (declared shape, column priorities), never by cloning the renderer.
- **A club "lock teams to our brand" toggle** — deferred, not rejected: inheritance already makes
  uniformity the default, and no club has asked. Build it when one does.
- **Restyling the practice sheet ahead of its spec** — decision 9's structure session has now
  ruled (run sheet, 2026-08-22); the sheet changes only to `PRACTICE_SHEET_STRUCTURE_PLAN.md`,
  in the Working-sheets pass. Also rejected there, by the owner from rendered pages: station
  cards (tear-off parked as a possible later variant) and the glance-strip hybrid.

## 6 · Regenerating the evidence

The exhibit generator (real renderers + fictional Riverdale Ridge fixtures, rendered in Chromium)
lives in the planning session's scratchpad, and its approach is documented by Phase 3, which
productionises the useful half of it as a repo check. The gallery artifact above holds the approved
"before" record; Phase 1's done-proof re-renders the same set as the "after".
