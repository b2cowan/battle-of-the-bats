# Coach Portal Page Headers — Consistency Build Plan

**Status:** ruled 2026-08-11 (owner-approved through four mockup rounds). **BOTH PASSES BUILT on
dev 2026-08-11 — owner QA pending as `OWNER_QA_LEDGER.md` §10 (Group 3A), one sitting covering the
whole ruling.**

**Pass 2 (§4) BUILT 2026-08-11** (+ `/simplify` §5d and `/review` §5e the same day). The remaining
27 pages migrated; **zero `.pageSub` and zero `.breadcrumb` renders survive portal-wide, and the
only hand-rolled `.pageHeader` markup left is inside `CoachPageHeader` itself** (the §7 success
criteria, grep-proven). Retitles landed (Development report → "Is everyone getting attention?",
Tryouts history → "Tryout history", Season's End h1); seven iconless pages gained their icon; ten
pages gained the help "?"; `.pageSub` → `.bodyNote` (renamed so a future header can't reach for it
by muscle memory) and `.breadcrumb`/`.scoutBackLink` deleted outright. **The back-link punch item
went one level deeper than the plan asked:** one class was not enough — the markup was still
hand-copied into 27 files — so `components/coaches/CoachBackLink.tsx` now owns the shape, applied
to all 26 non-exempt call sites. typecheck ✓ · 1,595 unit tests ✓ · verify:changed full chain ✓
(demos still presentable) · 2 UAT heading assertions retargeted to the renamed report.

**The 23 SURFACED-NOT-REVIEWED baseline entries are CLOSED: 2 fixed, 18 argued with written
reasons, 3 pruned as fixed.** The two real ones were exactly the two the Pass 1 note predicted
would not survive scrutiny: the **coach-practice-plan content-overflow @1440 was a genuine defect**
— `.attendanceFooter` baked a slide-over-only `-1.5rem` sideways bleed into its base rule, so the
three PAGE consumers hung 24px past the page edge at every desktop width; the bleed now lives on
`.modalOverlay .attendanceFooter`, where it is measured, so a future page reusing the bar is right
by default. The other was the Lineups "Season insights" link at **21px tall — the smallest control
in the portal** — now carrying the `.lineupBackLink` tap-padding shape. The 18 kept entries are the
help hub's quick-link chips (a shared cross-portal shell, exempt), `.lineupFilterChip` at its ruled
36px phone height (2026-06-29 mobile conventions), and a desktop-only schedule event chip — all
three now point at the ONE portal-wide control-height ruling still owed (§5b).

**Pass 1 (§3) BUILT on dev 2026-08-11 (+ /simplify §5b and /review §5c the same day) — owner QA pending.** typecheck ✓ · 1,595 unit tests ✓ (9 new for the
season-label helper) · verify:changed full chain ✓ (demos still presentable) · 2 UAT heading
assertions retargeted "Team Calendar"→"Schedule" · admin rep-teams schedule h1 joined the rename
(its own breadcrumb already said "Schedule"). **Rendered layout sweep RUN (full, all 29 screens ×4
widths):** zero overflow/covered/scroll findings on migrated screens; the 38 initial tap-floor
flags → phone-width (≤640) now clears the 44px floor via the header grid's min-height (the lineup
view-toggle precedent — this also cleared previously-baselined phone findings); the ≥768px compact
control heights are the portal-wide grandfathered decision this pass deliberately did NOT take,
recorded with reasons in the baseline. Baseline re-snapshotted from the complete run: 2,076 →
1,715 entries (361 stale pruned), 53 now carry written reasons — 30 argued header-pass entries +
**23 marked SURFACED-NOT-REVIEWED (post-2026-08-05 feature debt: help-hub guide links, Lineups
All/League filter + Season insights link, a schedule event-chip row, and ONE REAL content-overflow
on coach-practice-plan @1440) — these are Pass 2 punch-list work, recorded so the gate runs green
without the debt being silently absorbed.**
**Binding visual spec:** mockup artifact `claude.ai/code/artifact/1ae95cd8-8bc2-4500-b024-1f6f0bc78f3a`
(source `docs/projects/active/COACH_PAGE_HEADER_CONSISTENCY_MOCKUP.html`; Options B/C renders live in
the artifact's version history).
**Binding ruling:** `memory/design_decisions.md` → *"2026-08-11 — Coach portal page headers: nothing
under the title; the masthead owns season AND role; actions right of the title on every screen."*
That entry supersedes the subtitle half of the same-day Overview-header entry (both its named-season
print and its kept role line).
**PM brief:** `COACH_PAGE_HEADER_CONSISTENCY_PM_BRIEF.md` (same folder).

---

## 1. The ruling in one screen (canonical text lives in the decision log)

1. **Nothing under the title.** No page under `/[orgSlug]/coaches/teams/[teamId]/` renders a
   subtitle line. Live facts relocate into the body they describe; framing lines required by prior
   rulings relocate into the card they frame; feature blurbs move to empty states or die.
2. **The masthead owns season AND role.** `CoachTeamHeader` shows the viewer's role as a tag beside
   the team name ("Head Coach"/"Assistant Coach") and shows an org's named season when richer than a
   bare year. The tag folds away on the phone-collapsed scroll bar (bare-name ruling stands).
3. **Actions right of the title — and only actions.** One row, title left, actions right. View
   switchers ride the body they switch (Schedule's List/Week/Month joins Roster's List/Depth-chart
   down in the body, all widths). Phone: secondaries go icon-only (hidden label + `aria-label`),
   the one lime primary keeps its label. **The help "?" is chrome:** anchored top-right beside the
   title at every width; on phones only the actions row drops below.
4. **One shared page-header component** (icon 22px · title · archive chip | actions | help) replaces
   ~40 hand-rolled copies and retires the two CSS forks.

**Explicitly NOT in scope (presentation-only change):** no route changes, no new API reads, no
migration, no archive-door or season-aware-route edits — `tests/unit/coach-season-write-guard.test.ts`
lists must not change. `CoachSeasonChip` behavior is untouched (renders nothing live; "{year} ·
Complete" on archives — deliberate redundancy for read-only worlds).

**Exempt surfaces (bespoke by design, inventory §3):** game bench console (`game/[eventId]`),
practice run mode (`practice/[eventId]/run`), chat, tryout check-in/score kiosks, awards certificate
print, `CoachTournamentRecord` (shared with the free org-less portal — flagged as a possible
follow-up, not this pass), help + notifications shells (shared cross-portal components).

---

## 2. Ground truth (from the 2026-08-11 inventory of all 48 pages)

- No shared page-header component exists; `CoachModalHeader` is the precedent that pages never got.
- Shared CSS: `coaches.module.css` `.pageHeader/.pageHeaderLeft/.headerIcon/.pageTitle/.pageSub`
  (~lines 832–891). **Two forks** hand-copy the block: `accounting/budget/budget.module.css` and
  `accounting/budget-vs-actual/bva.module.css` (the budget copy already drifted and broke its
  action alignment once — documented in its own CSS comment).
- Masthead: `components/coaches/CoachTeamHeader.tsx`, mounted once by the team layout. Meta line
  currently renders `{year} season · record`. Phone ≤900px: collapsed scroll state = bare team name
  (`.teamHeaderCollapsed` hides eyebrow/meta/right slot/nudge).
- Live bug this kills: `roster/page.tsx` subtitle appends the literal word "season" →
  **"2026 Season season"** on the Riverdale demo; Overview's `/^\d{4}$/` bare-year guard is defeated
  by a season literally named "2026 Season". Both season-label helpers (`seasonLabel()`) are
  independently re-declared in `roster/page.tsx` and `roster/[playerId]/page.tsx`; Overview has a
  third inline variant.
- Icon drift: 5 pages draw 20px in the 48px tile (Attendance, Roster, Staff, Tryouts, Tryouts
  history); 7 pages have no icon tile (Overview, Documents, Announcements, Roster detail,
  Season-End, Settings, Tournaments list).
- Two breadcrumb dialects (Money in-header "Portal /" vs Roster above-header "Coaches Portal ›");
  five back-link treatments (`.backLink`, `.lineupBackLink` ×2 glyph variants, `.scoutBackLink`
  -as-subtitle, `.recordBackLink`, `.gdBack`).

---

## 3. Build Pass 1 — the component, the masthead, the core screens

### 3.1 `CoachPageHeader` component (new: `components/coaches/CoachPageHeader.tsx`)

Props sketch:

```tsx
type CoachPageHeaderProps = {
  icon?: LucideIcon;              // rendered at size 22 in the 48px tile; omit = no tile (Overview)
  title: ReactNode;               // string or node; component wraps in <h1 className={pageTitle}>
  titleChips?: ReactNode;         // e.g. conditional division chip, premium badge (Overview only)
  season?: SeasonView;            // → <CoachSeasonChip> INSIDE the h1 (fixes the two outliers)
  teamBase?: string; chipExtraQuery?: string;   // pass-through for CoachSeasonChip
  actions?: ReactNode;            // the action group; primary = .btn-lime, secondaries plain
  help?: { label: string; request: HelpRequest };  // → iconOnly HelpButton, LAST, own slot
};
```

- Markup: `.pageHeader > .pageHeaderLeft(icon + h1[+chip]) + .pageHeaderActions + .pageHeaderHelp`.
- **No subtitle prop exists.** Rule 1 is enforced by construction.
- Desktop CSS: flex, title left (`margin-right:auto` on the left block), actions then help right,
  0.6rem gap. Drop the old `> *:last-child` auto-margin hack once all callers migrate.
- Phone (≤640px, matching the existing compact block): grid — row 1 = left block + help (help pinned
  top-right on the title line), row 2 = actions spanning full width, `justify-content:flex-end`.
  Existing compact metrics stand (title 1.35rem, tile 40px).
- **Icon-only secondaries on phone:** add a `.btnLabel` span convention — label wrapped in a span
  hidden ≤640px with `aria-label` on the button (the standing mobile-admin pattern, extended here).
  Applies to header secondaries only; the lime primary keeps its text at all widths. Check for an
  existing admin utility class first and reuse its name/shape if one exists.
- A11y: chip inside `<h1>` standardizes the accessible page name; help button is the last tab stop
  of the header at every width.

### 3.2 Masthead (`CoachTeamHeader` + team layout)

- **Role tag:** new prop (`coachRole`) threaded from the team layout's existing coach context.
  Renders beside the team name: `mono 0.6rem/700 uppercase chip, white fill, hairline border`
  (the mockup's quiet chip, NOT the lime premium badge). Add
  `.teamHeaderCollapsed` hide rule so the collapsed phone bar stays bare-name.
- **Named season:** new prop (`seasonName`). Display logic: strip any leading team-name prefix
  (shared helper, below); if the remainder differs from `String(year)` case-insensitively → render
  it verbatim; else render `{year} season` exactly as today. Archive right-slot behavior unchanged.
- **One season-label helper:** extract the canonical strip/compare into `lib/coach-season-label.ts`;
  delete the two page-local `seasonLabel()` copies and Overview's inline variant when their pages
  migrate (Pass 2 for the roster pair).

### 3.3 Core screens migrated in Pass 1

| Screen | Header after | Facts relocated |
|---|---|---|
| Overview | title only; division chip **only when team name lacks the division string** (case-insensitive contains); premium/status badges stay as `titleChips`; setup chip = action; help last | subtitle deleted (role → masthead; season → masthead) |
| Money hub + 7 panels | icon + title + chip; hub tab bar unchanged; help on hub AND on panels' standalone renders | season subtitles deleted; hub in-header breadcrumb deleted; panel `‹ Back to Money` links → standard back link (3.4) |
| Roster | icon (22px now) + title + chip; Attendance/Export/Add Player + help | count line → list toolbar: "12 active players · 2 inactive" leads the row that holds the List/Depth-chart toggle; above-header breadcrumb deleted |
| Roster player detail | title (player name) + chip; icon: `Users` 22 (joins the pattern) | `#number · Age` → the existing status row directly below; season text deleted |
| Schedule | **h1 "Team Calendar" → "Schedule"** (nav label untouched — it keys the access gate); actions = Import · Export · Add Event · help; in-header breadcrumb-nav deleted | List/Week/Month → first row of the body, all widths |
| Attendance | icon 22 + title + chip + help | static line deleted (its sentence moves to the empty state if the page has one; else dies) |

Pass 1 exit: `npm run verify:changed` green; rendered `check:layout` on the affected screens ×4
widths; commit as one unit ("Pass 1").

---

## 4. Build Pass 2 — the portal-wide sweep + punch list

### 4.1 Remaining page dispositions (subtitle → destination)

| Page | Disposition |
|---|---|
| Lineups hub | blurb → empty state |
| Lineup builder / practice plan (entity pages) | their `.lineupMetaRow` (game meta, "View on schedule") is BODY content already — ensure it renders below the header block, not inside it; add missing help button to the lineup builder (its practice twin has one) |
| Lineup template editor | blurb deleted; "Save template" stays the action |
| Development hub | team-name + guidance line deleted; first-run guidance → empty state |
| Team board | **required framing "Roster order — a coverage view, not a ranking" → first line of the board card** (binding coverage ruling wording, verbatim); add help button |
| Your drills / Plan templates | blurbs → empty states |
| Template editor | `shape · use` labels → body summary strip |
| Evaluation session | session date → body summary strip; back link standardized |
| Insights hub | team-name line deleted |
| Results | conditional line deleted |
| Awards | static line deleted; add help button |
| Playing time | provenance line "One row per player, from your saved lineups" → table's intro/first row (it's load-bearing provenance); add help button |
| History development report | **retitle "Development" → "Is everyone getting attention?"** (question voice, kills the duplicate-title pair); framing → body card; add help button |
| Opponents list | team-name line deleted |
| Opponent detail | back-link-as-subtitle → standard back link above header; record chip stays in title row; add help button |
| Practice history detail | inline season chip → `CoachSeasonChip` in h1; meta/tags → body |
| Documents / Email families | team+season lines deleted; icons added (`FileText` / `Mail` 22) |
| Coaching staff | team-name line deleted; icon 22 |
| Team settings | team-name line deleted; icon added (`Settings` 22) |
| Season's End | **h1 = "Season's End"** (was the team name — the same masthead-repeat Overview had); chip moves INSIDE h1; season line deleted |
| Tournaments list | blurb deleted; icon added (`Trophy` 22) |
| Tryouts hub | blurb → empty state; icon 22 |
| Tryouts history | **retitle → "Tryout history"**; `N sessions · N candidates` → body summary; icon 22 |
| Link Organization | static lines deleted; ONE icon both states (`Building2`) |

### 4.2 Punch list riding along

- **Back links:** one treatment for all drill-ins — `.lineupBackLink` shape (tap-target padding +
  lucide `ArrowLeft`), replacing the grey `.backLink`, both literal-glyph "←"/"‹" variants, and
  `.scoutBackLink`. (`.gdBack` and `.recordBackLink` are on exempt surfaces.)
- **CSS forks:** delete the header blocks in `budget.module.css` + `bva.module.css` (callers now use
  the component).
- **Help gaps:** every page whose help content has a matching section gets the iconOnly HelpButton in
  the component's help slot (map to existing `sectionIds`; where no article exists, skip and list in
  the commit message rather than inventing content).
- **Retire `.pageSub`** from `coaches.module.css` once zero callers remain (grep-proven).

### 4.3 Guardrails while sweeping

- Stage explicit pathspecs; `[teamId]`/`[orgSlug]` directories need `:(literal)` pathspecs (standing
  git gotcha).
- No `git add -A`. Verify `git show --stat HEAD` after each commit.
- Concurrent-session check before committing (`git rev-parse --abbrev-ref HEAD` = `dev`).

---

## 5. Verification (each pass) + sync obligations

1. `npm run verify:changed` (includes `check:demos`, `check:dictionary` — no schema change expected).
2. `npm run typecheck` (shared component + shared masthead props = shared-module change).
3. Rendered `npm run check:layout` — headers change on all 28 listed coach screens; expect findings
   to move (subtitles removed). Review the diff; ratchet only tightens.
4. Unit tests: grep for assertions on removed subtitle strings / "Team Calendar" h1; update
   alongside. Season-write-guard lists must show **zero diff**.
5. **Help-docs sync (`/docs`):** grep `lib/help-content/coaches.tsx` for "Team Calendar", references
   to page subtitles, and "under the title" phrasing; update in the same unit of work.
6. **Demo-drift check (CLAUDE.md standing rule):** grep the coach demo tour steps + moments dock
   copy for "Team Calendar", header/subtitle references, and the season name "2026 Season" as
   rendered in chrome; adjust seed/tour copy in the same unit of work; `npm run tick:demos` +
   `npm run check:demos` on dev.
7. Dev server restart before handoff (new files + shared modules).
8. Owner QA rides `OWNER_QA_LEDGER.md` as a new section when built (both passes, one sitting:
   desktop + 390px phone; include one archived season screen and one assistant-coach account to see
   the role tag + capability-dependent actions).

## 5b. Flagged by /simplify (2026-08-11) — deferred with the portal-wide control-height decision

- **ExportMenu's trigger buttons ignore the coach phone tap floor:** its own module pins them to
  the admin-ratified 32px with `!important` at ≤760px, which silently beats the header grid's
  44px min-height. Same class of decision as the grandfathered desktop control heights — the two
  conventions (admin 32px icon buttons vs. coach 44px floor) need ONE owner ruling, not a CSS
  arms race. Until then the coach header's other controls clear the floor; ExportMenu's two
  triggers don't.
- **Two label-collapse breakpoints in one row:** ExportMenu hides its label at ≤760px, the
  portal's `.headerBtnLabel` at ≤640px — between those widths "Import" keeps its word while
  "Export" beside it is already icon-only. Resolve together with the above.
- Inline style objects on Roster/Schedule secondary buttons predate this pass (slightly shrunk
  copies of `.btnSecondary`'s declared values) — reconciling them is a small visual change left
  for Pass 2, not silently bundled here.

## 5c. /review outcome (2026-08-11, high-risk tier, 4 lenses)

Security/tenant/contract lens: CLEAN — every capability gate bit-for-bit preserved in its move,
coachRole is the authenticated viewer's own row only, zero new fetches/routes, season-write-guard
lists zero-diff. Blast-radius lens: CLEAN beyond the fixes below (typecheck + 1,595 tests are the
proof for the type change; no UAT selector breaks — Playwright name matching is case-insensitive).

**Fixed from findings:** division chip now uses a WHOLE-WORD match (a bare substring hid "AA"
inside "AAA"); dues' Send-reminders aria-label now tracks the "Sending…" state; the retired grey
`.backLink` class deleted (zero consumers); the Add-Event popover gained max-height + scroll so
the phone tap floor can't run it off a short landscape viewport. **Refuted:** "embedded read-only
tabs lose their spacing" — the tab bar's own 1.4rem bottom margin holds the gap; the old empty
header div was a phantom extra 2rem.

**Confirmed, declined by design:** on phones the "?" is visually on the title row while actions
sit below, but tab order follows DOM (title → actions → help). Reordering the DOM would move the
same mismatch to desktop — which is currently perfect — so the phone keeps it: few controls,
screen-reader linear order unaffected. Do not "fix" one width by breaking the other.

## 5c-bis. What the rendered sweep found in Pass 2 — and one operational lesson

The 29-screen × 2-width sweep is the only gate that sees a defect which exists solely once a
browser has laid the page out, and in this pass it earned its cost three times:

1. **The practice-plan sideways scroll @1440** — a real defect, fixed at its source (§5d).
2. **The Lineups "Season insights" link at 21px** — the smallest control in the portal, on a link
   whose "quiet" visual register had been mistaken for a licence to skip the tap floor.
3. **~20 baselined back-link entries cleared by ONE rule.** Every drill-in's back link was 34px on
   a phone, and the baseline carried one entry per screen saying so — because the shape was
   hand-copied per screen. Extracting `CoachBackLink` meant a single `@media (max-width: 640px)`
   rule on `.lineupBackLink` fixed all of them at once. **This is the concrete argument for the
   component over the class:** the class made them consistent, the component made them fixable.

⚠ **Re-keyed findings are the sweep's standard false alarm and cost real time.** Dropping the
literal "←" from the back links (it became an `aria-hidden` lucide icon) changed every accessible
name from `a·← Insights` to `a·Insights` — so ~20 entries reported as NEW at their unchanged 34px.
**Before treating a rendered finding as a regression, grep the baseline for the same element under
its old accessible name.** The height is the tell: identical px in the detail string means a
re-key, not a change.

⚠ **A full 29-screen sweep exhausts the dev server's heap** (measured this pass: the node process
reached 6.6 GB, after which `coach-notifications @1440` timed out at 150s and the script aborted
before printing its verdict — the abort reads like a failure but is the server dying, not a
defect). The script's own error text says so. **Stop the server, delete `.next`, restart, then
re-run** — the same sequence AGENTS.md mandates for a stale cache.

## 5d. /simplify outcome — Pass 2 (2026-08-11)

Four lenses. Five fixes applied, and three of them were the same lesson at different depths: **a
shared mechanism was being special-cased instead of corrected.**

- **`.attendanceFooter`'s sideways bleed moved to the container that measures it.** The first fix
  cancelled the bleed on the three page consumers; the altitude lens was right that this was the
  wrong depth — the base rule was defaulting to the slide-over's context and every page had to
  remember an antidote. Now `.modalOverlay .attendanceFooter` owns it. (The bottom bleed stays
  universal: `.coachesMain`'s padding is set by arithmetic against exactly that 24px pull.)
- **`.pageHeaderBlock` deleted.** It reached past `CoachPageHeader`'s public contract to override
  the component's *internal* class from page CSS. The deeper answer was not a prop — it was that a
  meta row hugging the title **is the banned subtitle wearing a new class name**. Both entity pages
  now render theirs at ordinary body rhythm, and `.pageSummaryStrip` carries a comment saying why
  tightening it back up is off-limits.
- **`.lineupMetaRow` folded into `.pageSummaryStrip`** (same idea, different magic numbers, same
  pages) and **`.devBoardFraming` dropped for `.devCardNote`** (a near-duplicate for one call site).
- **`CoachBackLink` extracted** — see the status block above.

**Skipped:** the repeated `{ module: 'coaches', sectionIds: […] }` help literals — verified as a
pre-existing convention across 41 files with no factory to point at, so not a Pass 2 regression.

⚠ **Process note worth keeping:** the back-link codemod's regex used a lazy `[\s\S]*?` for the href
and **over-matched in one file**, swallowing an unrelated `<Link>`. Typecheck caught it; every
transformed file was then audited for net deletions before proceeding. A codemod over JSX needs a
verification pass that is not "did it compile" — a same-tag swallow can parse cleanly.

## 5e. /review outcome — Pass 2 (2026-08-11, high-risk tier, 5 lenses)

Tier forced to **high-risk** by the standing carve-out: shared portal chrome has the blast radius of
a shared module however small the diff.

**Deterministic gate:** verify:changed ✓ (token ratchets, palette contrast, snapshot freshness,
schema parity 0, dictionary, org-context guard, demos presentable) · typecheck ✓ · lint ✓ (0 errors)
· migrations n/a · rendered check:layout — see the status block.

**Security / archive-contract lens: CLEAN, and the presentation-only claim verified structurally** —
zero `fetch(` in the whole diff, no `app/api/**` or `lib/**` file touched, `coach-season-write-guard`
lists zero-diff, and the one new hook call (`useCoachSeasonPage` on the past-practice archive door)
traced to a pure resolve over already-loaded context that changes no request and widens nothing.
**CSS-cascade lens: CLEAN** — the four `.attendanceFooter` consumers are structurally disjoint at
every width; the slide-over keeps its bleed.

**Fixed from findings:** the retitled Insights report broke two Playwright assertions in
`plan-templates-layout.spec.ts` (retargeted); seven `import Link` statements survived the codemod's
cleanup pass (removed); one comment cited the wrong breakpoint for the mobile re-bleed (≤640, not
≤900).

**Refuted (raised by two lenses, dropped on adjudication):** "the binding coverage framing is now
missing from the empty states". In both files the empty-state branches render a placeholder
sentence and **no roster order at all** — the framing exists to stop a reader misreading a visible
roster order as a ranking, so above "Nothing on the board yet" it would be framing an absence. The
ruling's own words are "move into the card they frame", which is what shipped. Both lenses applied
the rule mechanically without checking whether the framed thing was on screen.

## 5f. Owner feedback on the shipped result (2026-08-12) — two changes, both taken

The owner opened the finished Overview and sent back two things within a day. Both are now built;
the ruling in `memory/design_decisions.md` records them as binding.

1. **“Why doesn't the Overview header have an icon like the rest?”** — because §3.3 and the binding
   mockup said title-only, while **§2 and the §4.2 punch list of this very plan said the opposite**
   (“the section icon on the 7 iconless pages”, Overview being one of the seven). The contradiction
   sat in the plan through a `/simplify` and a `/review` and was found by looking at the product.
   The exception is retired: **one exception in forty reads as an oversight**, because a coach meets
   the screens in sequence rather than side by side, and what registers is the title jumping 44px.
   ⚠ Do not re-derive the old rationale from §3.3 — that section is now superseded.

2. **“The next-event banner is too big and pushes down the more useful cards.”** — measurably true:
   228px desktop / **267px on a phone, a third of the viewport**, with the board's first row ending
   40px past the fold. The card's six situations each rendered their own kicker/headline/meta
   markup, so the *structure* was written six times and its cost was invisible; naming the three
   text slots once and rendering one arrangement got it to **144px / 199px** with the phone's first
   tile row now 14px above the fold. Copy byte-for-byte unchanged (proven by string-count diff
   against HEAD); the resolver untouched.

⚠ **One proposal in the mockup was wrong and was dropped during the build.** It argued the card's
date duplicated the sticky team bar and could go. The bar's right slot is `display:none` once the
phone header collapses on scroll — so the duplicate disappears exactly when a scrolling coach needs
it, and the card would have been left as the only copy of a fact just deleted. **A duplicate that
disappears is not a duplicate.** The saving comes from removing two stacked rows instead.

## 6. Risks & edge cases

- **Named-season display:** org season names that EMBED the team name ("Riverdale Ridge 12U 2026")
  must strip the prefix before the bare-year comparison — the shared helper owns this; test both
  directions ("2026", "2026 Season", "Fall Ball 2026", "{team} 2026").
- **Role tag on long names + phone:** name row wraps (flex-wrap) — verify at 320px; "Assistant
  Coach" is the long case.
- **Schedule fold:** the header row is the busiest — verify wrap behavior at 768–1024px widths
  (tablet), where actions may wrap below with text labels still visible (icon-only kicks in ≤640px).
- **check:layout ratchet:** removing subtitles shifts many screens; expect baseline movement, review
  rather than bulk-accept.
- **Money panels' standalone mode:** panels render headers only when NOT embedded — the component
  must respect the existing `embedded` gate so the hub never shows two headers.

## 7. Success criteria

- Zero `.pageSub` renders portal-wide; grep for the class returns only its (deleted) definition.
- "2026 Season season" cannot be produced by any code path (helper unit tests pin it).
- Masthead shows: named season when richer than bare year; role tag beside team name; collapsed
  phone bar = bare team name (tag folds).
- Every standard page: one header row (desktop), title+? row above one right-pinned actions row
  (phone ≤640px), zero horizontal scroll at 390px, all header controls ≥44px tap floor.
- Help "?" present and last on every page that has a help article; same corner every page.
- One back-link treatment on drill-ins; zero breadcrumbs on hubs; icons uniformly 22px.
- No diff in `coach-season-write-guard` lists; no new routes; no migration.
