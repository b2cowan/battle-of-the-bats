# Kickoff prompt — Coach Page Headers, Pass 2 (paste into a fresh chat)

Build **Pass 2 of the coach portal page-header ruling** — the portal-wide sweep. Pass 1 is
committed on dev (`ad43cae1`, 2026-08-11) and owner-QA-pending; do not re-litigate the ruling.

## Read first (in this order)

1. `docs/projects/active/COACH_PAGE_HEADER_CONSISTENCY_PLAN.md` — §4 is your work list
   (the page-by-page disposition table + punch list). §5b/§5c hold flags and declined
   findings — respect them (do NOT "fix" the phone tab-order or ExportMenu sizing).
2. `memory/design_decisions.md` — the 2026-08-11 header ruling (top of file) is binding.
3. `components/coaches/CoachPageHeader.tsx` — the component you'll be applying. It has an
   `embedded` prop, a `titleChips` slot, a `season` chip slot, and NO subtitle slot by
   construction. Never hand-roll a header shape; extend the component if a page needs
   something new, and log why.
4. The binding mockup: `docs/projects/active/COACH_PAGE_HEADER_CONSISTENCY_MOCKUP.html`
   (artifact 1ae95cd8-8bc2-4500-b024-1f6f0bc78f3a).

## The work (plan §4, in full — build the whole pass in one go)

- Migrate the remaining ~25 standard pages to `CoachPageHeader` per the §4.1 disposition
  table: every subtitle's content goes where the table says (body toolbar, card framing
  line, empty state, or deleted). Exempt surfaces are listed in plan §1 — leave them alone.
- Punch list §4.2: icons 22px + the section icon on the 7 iconless pages; help "?" filled
  wherever a help article exists (skip + list where none does); ONE back-link treatment
  (`.lineupBackLink` + lucide ArrowLeft) replacing every literal "←"/"‹" variant;
  retitles — history/development → "Is everyone getting attention?", tryouts/history →
  "Tryout history", Season's End h1 → "Season's End" (chip inside the h1); retire
  `.pageSub` and `.breadcrumb` from `coaches.module.css` once grep shows zero consumers.
- The 23 baseline entries marked SURFACED-NOT-REVIEWED (in `scripts/.layout-baseline.json`,
  reasons name this pass): review each — fix the real ones (the coach-practice-plan
  content-overflow @1440 is a REAL defect), argue or keep the rest with updated reasons.

## House rules that bit us in Pass 1 (save yourself the time)

- Branch `dev`; stage EXPLICIT pathspecs; bracketed dirs need `":(literal)app/[orgSlug]/…"`.
  Commit ONLY on explicit owner OK; commit message via `git commit -F <file>` (PS5.1 mangles
  inline quotes).
- `npm run check:layout -- --changed` needs the dev server up AND a warm root: hit
  `http://localhost:3000/` once first — the script's reachability probe is 5s and a cold
  compile exceeds it. Shared-CSS diffs sweep all 29 screens (~15 min); run it in the
  background. New findings from MOVED/RENAMED controls are usually re-keyed old sizes:
  fix phone (≤640) via the existing `.pageHeaderStd` tap-floor mechanism, record ≥768
  residue in the baseline WITH a reason (never bare `--init`-and-walk-away).
- Phone rules: secondaries wrap labels in `styles.headerBtnLabel` + `aria-label` (keep the
  aria-label CONTAINING the visible text, and dynamic if the label is a ternary — see the
  dues Send-reminders fix); lime primaries KEEP their words.
- After the build: run `/simplify` then `/review` (high-risk: shared chrome), fix confirmed
  findings, then `npm run typecheck` + `npm test` + `npm run verify:changed`. Check
  `lib/help-content/coaches.tsx` + the coach demo tour copy for any sentence describing a
  renamed/retitled screen (Pass 1 greps found none, but Pass 2 renames MORE titles —
  "Development", "Tryouts", Season's End — so grep those exact strings).
- When BOTH passes are on dev: add ONE Owner QA Ledger section covering the whole ruling
  (desktop + 390px phone, one archived season, one assistant-coach account), update
  TODO.md + the plan status with the commit anchors, and restart the dev server before
  handoff (new files rule).
