# Design + UX pass — the Add-a-bill form (and its schedule editor)

**Owner-directed 2026-08-28, out of the §119 fold walk.** The Payables→Ledger fold settled this
form's STRUCTURE and WORDS; the owner's verdict on its PRESENTATION was *"this still looks pretty
awful."* This session makes it look like it belongs in the product. **One form, one modal — not a
portal-wide forms pass** (the money forms review is a separate body of work, currently on
sponsorships; do not touch its scope).

## 0 · THE MOCKUP GATE IS ITEM ONE — nothing builds before it

Per standing owner rule (`memory/feedback_mockups_as_claude_artifacts.md`): produce the mockups
as a **Claude Artifact**, get the owner's approval, THEN build. Specimens the artifact must
include, drawn in the shipped warm-portal palette:

1. **The whole modal, before/after** — desktop width, real copy (the current form's exact words;
   they are settled, see §2).
2. **The schedule editor's row** — one-payment state and a 3-payment state, before/after.
3. **The phone frame at 390px** — the modal already reflows; the redesign must not break it.
4. Element labels **NEW / RESTYLED / UNCHANGED** on everything.

## 1 · What the owner judged wrong (the three findings, from his own screenshots)

1. **Nested grey-on-grey chrome.** The tinted "Payment schedule" card contains a white inner card
   containing the rows — two borders and two fills wrapping one concept, and the heaviest thing
   on the form. Likely answer: ONE surface for the schedule (the mockup decides which).
2. **The date/amount row is unlabelled at desktop.** The Due/Amount microlabels exist but render
   only ≤640 — the row shape is borrowed from the budget sheet, whose desktop columns sit under
   its own headings (`.periodColHead`), which this editor never renders. ⚠⚠ **A one-line CSS
   override was tried and REVERTED (2026-08-28)** — `.periodFieldLabel` is a ROW flex, so forced
   labels rendered BESIDE their inputs and clipped the row ("Amount" cut to "nount"). The real
   fix is a layout decision: a column-headings row like the budget sheet's own, or restructured
   rows with stacked labels. Decide it in the mockup; note the browser's bare `yyyy-mm-dd` is its
   own empty-date hint and reads fine once a label exists.
3. **Two input rendering families on one form.** Plain inputs wear the warm tinted ground;
   the picker and date components render white. Required-ness and component-lineage are visually
   entangled — pick ONE grounds story for this form (and only this form; a portal-wide answer is
   the forms review's, later).

## 2 · What is SETTLED — re-opening any of these needs the owner, not a design lens

- Title **"Add a bill"** + subtitle carrying the teaching; **no intro paragraph**.
- **"Filed under *"** with the act-shaped placeholder ("Choose a budget item — …");
  **picker BEFORE description** (owner ruling 2026-08-15 — the pre-fill mechanism).
- Description's field and words; required markers = **plain asterisk only** (2026-08-26 ruling —
  never "(optional)", never a red marker).
- Schedule semantics: no "One payment" heading / no "#1" on a single row; **Repeat monthly** in
  button chrome beside **+ Add**; the reconcile sentence at the foot; Auto badges.
- The **"More — payee, tags, notes"** fold and its contents.
- The consequence line **pinned in the sticky footer**; the button says **"Save"**
  (2026-08-16 ruling — the consequence names the outcome, the button is a button).
- The two doors into this form (the toolbar's Add a bill; Record's "Not paid yet" hand-off row)
  and everything they carry.

## 3 · Engineering map + traps

- The modal body: the bill branch of the shared money form in
  `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx` (search `isPayableForm`);
  the schedule editor is `app/[orgSlug]/coaches/teams/[teamId]/accounting/InstallmentPlanEditor.tsx`.
- ⚠⚠ **The editor's row classes are the BUDGET SHEET'S**, imported from
  `accounting/budget/budget.module.css` (`periodInputRow` / `periodFieldLabel` / `periodFieldWhen`
  / `addPeriodBtn` …) and the dues sheet splits the same way. **Restyle via variant classes scoped
  to this editor** — a change to the shared classes silently restyles Generate Installments and
  the budget line editor. The stylesheet carries a headstone at `.periodFieldLabelText` about the
  reverted attempt; honour it.
- The picker is the shared `BudgetItemPicker` (its `placeholder` prop is per-caller); the date
  field is the shared `DateField`. Restyling SHARED components needs the same variant-class
  discipline.
- CSS-module purity gate: every rule locally scoped (`npm run check:css-module-purity` via
  `verify:changed`).
- ⚠ **The sweep cannot see a modal** — `check:layout` renders pages. Verification is
  **Playwright against the live dev server** (`memory/feedback_iterate_visual_with_playwright.md`
  + `memory/feedback_verify_with_playwright_not_screenshots.md`): open the real form on the UAT
  fixture, measure computed styles/boxes at 1440 and 390, iterate until the mockup and the screen
  agree. Do not ship from reasoning about CSS — that is how this pass's two predecessors failed.
- Dev server: `npm run dev` only; restart rules in `AGENTS.md`.

## 4 · Done means

- Owner-approved mockup artifact; build matches it (deviations recorded with reasons).
- Playwright-verified at 1440 and 390: no clipped text, no overflow, labels legible, tap floor
  held ≤768 (the 641–768 band is a touch band — 2026-08-27 ruling).
- Budget sheet + dues sheet visually UNCHANGED (screenshot both before/after — the shared-class
  trap is the likeliest failure).
- Gates: typecheck · unit suite · check:css-module-purity · check:spelling · lint:focused.
- Owner QA: append the outcome to **ledger §119** (this pass is a rider on the fold's section —
  Part E currently instructs walking structure/words only; lift that caveat when this ships).
- Update `COACH_PAYABLES_LEDGER_FOLD_PLAN.md` (§7 gains the pass's record) and the fold memory
  file; TODO.md line.
