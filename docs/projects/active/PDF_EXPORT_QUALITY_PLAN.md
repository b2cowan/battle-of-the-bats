# PDF Export Quality — plan

**Status:** **PHASE 1 + PHASE 2 PASS 1 (REGISTERS) BUILT on dev 2026-08-23** (Owner QA Ledger
§79 and §82; migration 259 dev-only;
approved card mockup https://claude.ai/code/artifact/b72a7ee2-4c8d-4339-9b7a-8e5d3d6b1b93 — the
spec for the "How your documents look" card, incl. the two owner-approved additions: the
"Back to your club's look" reset row and the "Use your team colour" chip). Phase 1's fit
contract sharpened one rule in build (owner-agreed 2026-08-22): **fixed-column reports are
guaranteed to fit by construction; only customer-shaped tables (rubric categories,
settings-driven columns, coach-sized grids) may ever fall back to the drop-and-say-so note.**
Phases 2–3 remain. Every structural decision below is **Decided**, made by the
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
- **Statements & handouts:** per-family dues statement built; identity defaults verified on all
  three. *Good = the club's face; one page; a stranger would think well of the club.*
- **Rosters:** roster declares landscape (or the wall copy sheds guardian columns — decide in-pass
  with the fit contract's per-column priorities); build the rep roster PDF the stub promised.
  *Good = readable pinned to a wall; privacy-aware.*
- **Working sheets:** check-in sheet branded + tick-box column widened; **the practice sheet is
  rebuilt as the decided run sheet** (decision 9 resolved 2026-08-22 — build to
  `PRACTICE_SHEET_STRUCTURE_PLAN.md` and its approved exhibits, not to the old table form).
  *Good = works in a coach's hand, in weather.*
- **Schedules:** already the model; verify against the gallery, nothing structural.
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
