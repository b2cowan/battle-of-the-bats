# Bookkeeping · Reports "View" control, thin first cut (build prompt, ONE session)

> Written 2026-11-07 in the GST/HST Stage 4b kickoff session ([GST_HST_STAGE4B_KICKOFF_PROMPT.md](GST_HST_STAGE4B_KICKOFF_PROMPT.md)). Recommended model: Sonnet is enough.
> Plans of record: [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) §3 ladder row **3** (Q12) and row **4b**.
> Drawings (build to these, do not redraw): the View pill in `BOOKKEEPING_HOLISTIC_REEVAL_HUB.html` (Q12 frames) and the toolbar in
> https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan tab 5 ("View · GST/HST return ▾" beside the period control).
> Mark each fact you rely on [V] (you opened it this session) or [H] (handed over). Everything below is [H] unless marked [V 2026-11-07].

## Why this exists, and the owner ruling that shaped it

Row 3 of the ladder ("Reports that answer questions": one View pill over five views) is **drawn and ruled and NOT built** [V 2026-11-07: no
View pill and none of By month / Compare / Money position / Tax year exist in the code]. GST/HST 4b needs a place to live that is a **view
under Reports**, not a fifth tab (drawings Ask 7 = A). Waiting for all five views would hold 4b behind the accounts and registers
(Stage 2, redraw owed) and the category-to-tax-line mapping (Q13). **Owner ruling 2026-11-07: build a thin View control first, then 4b.**
The other views join the same control later as their own prerequisites land; nothing here is thrown away.

## What the owner sees after this build (almost nothing, on purpose)

- Reports looks and works **exactly as it does today**. The View pill appears only when Reports has **two or more** views. With the one
  view that exists now (Spending = today's page, **moved in unchanged, not tidied**), no pill renders and there is no dead choice.
- The first time the pill appears is when 4b adds "GST/HST return". The house rule says a pill is for more than three views; a two-choice pill
  is a deliberate, owner-accepted departure so there is no switch-to-pill rework later. Say so in the walk note; do not "fix" it to a switch.
- Every view gets its own address, so a link or Back lands on the same view (Q16).

## Build

1. **Split today's Reports section** (`app/platform-admin/bookkeeping/BookkeepingClient.tsx`, the inline Reports `<section>`, about lines
   263-332 [H]) into a `ReportsSpending` component. Move JSX and its local state; change **no** copy, order, filter or number. The shared period
   state (from/to) and the expense export stay available to any view.
2. **A small registry of report views** (key, label, whether it is available, its component). Today: `spending` only. Adding a view later is
   one registry entry plus its component, nothing else.
3. **The View control**: the shipped olive pill from the drawings, built from the **shipped component** (do not draw a new one). It renders only
   when the registry offers 2+ views. Phone: it keeps its place in the toolbar and does not wrap; check at 390.
4. **Addresses.** Extend the address contract in `lib/bookkeeping-navigation.ts` with a report-view sub-key (`?view=reports&report=...`), default
   `spending`, unknown value falls back to `spending`. Keep every existing address working. Update `tests/unit/bookkeeping-navigation.test.ts`.
5. **No data changes, no migration, no new API.**

## Checks

- `npm run verify:changed`; `npm run check:layout --changed` on Reports at desktop and 390 (the dev server, `--changed` only).
- A guard test: the registry has `spending`; with one view the pill is absent; with two it is present (render test or pure registry test).
- Before/after: Reports renders the same sections in the same order as before (note any unavoidable difference in the hand-off).
- `/review` offer after; `/simplify` only if the registry feels heavy for one entry. No help-content change (platform-admin only; confirm no
  Bookkeeping help article exists before skipping `/docs`).

## Rules of the room

Branch `dev` only; commit nothing until the owner says; stage explicit pathspecs. Do not change hooks, settings or database checks. A helper's
summary is a lead, not evidence. Do not add a tab; do not move Overview, Expenses or Ledger.

## Progress

(empty)
