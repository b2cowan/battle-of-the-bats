# Kickoff prompt — Coach page-level actions, Phase 1: the Money hub (paste into a fresh chat)

Build **Phase 1 of the coach portal page-level action pass** — the Money hub. The design is
approved and the mockup is binding; do not re-litigate it. Nothing in this project is built yet.

## Read first (in this order)

1. `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` — §3 is the twelve rules,
   **§4.1 is your work list**, §5 lists the shared pieces, §9 the verification. §3.1 names the two
   rules that carry teeth — read it twice.
2. `memory/design_decisions.md` — the **2026-08-13** entry (top of file) is binding, and the
   2026-08-11 page-header ruling directly below it is binding and **not reopened**.
3. The binding mockup: `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_MOCKUP.html`
   (artifact `44162825-32ef-4744-90dc-7939ee635e9e`). The "Decided shape" and "Inside the menus"
   sections are the spec.
4. `components/coaches/CoachPageHeader.tsx` — note the `embedded` prop, which exists *because* the
   Money panels needed a right-pinned actions row under the tabs. **Phase 1 largely removes the
   need for it.** Do not delete it without grepping every consumer.
5. `components/admin/tournament/TournamentAdminUI.tsx` — `ToolbarMenu` / `ToolbarMenuItem` /
   `ToolbarMenuSeparator`, and `app/[orgSlug]/admin/tournaments/data-tools/page.tsx` for how they
   are used as Import ▾ / Export ▾. **Bring this pattern across; do not invent a second menu.**

## The work (plan §4.1, build it in full)

**The Money page header** (`accounting/page.tsx`) gains constant `[Import ▾] [Export ▾]`, left of
the help "?" and identical on every tab.

- **Import ▾** — Budget lines · Expenses & payables · separator · **Recent imports**.
- **Export ▾** — Budget lines · Player dues · Expenses & payables · Fundraisers · Budget vs. actual,
  each row carrying its format chips on the row (no nested menu). Three of those five exports do
  not exist yet and are in scope.
- A row renders only where the coach has access to that data. PDF chips follow `pdf_exports`
  plan-gating — **absent, not locked.**

**The tab bar becomes pure navigation.** No actions on it. Full labels retained at every width.

**Every tab's own actions move into that tab's toolbar**, joining the control row it already has —
see the plan §4.1 table for which row each one joins. Five of seven already have one; Fundraisers
and Payments gain a thin right-pinned row; Allocations gets none.

**Creates unify to the lime fill.** Add Line, Add Expense and Add Payable stop being outlined.
`.btnGhost` stops being used for Import anywhere.

**Player Dues' two bulk actions come down too** — they act on the dues list, not on Money.

## The traps, stated so you don't rediscover them

- ⚠ **Rule 11 removes imports and spreadsheet exports from the PHONE header — and both importers
  carry a paste-a-block mode built precisely because phones have no file picker** (it is documented
  in `BudgetImportSheet.tsx`'s header comment). The mitigation is **mandatory, not optional**: every
  empty state that can accept an import keeps offering it at 390px. Verify it renders there; do not
  assume.
- ⚠ **Budget Plan's toolbar only renders when the plan is non-empty** (`allLines.length > 0`); the
  empty plan shows the first-run card with its three doors. Leave that card alone — but check its
  import door at 390px.
- ⚠ **The header cap is TWO buttons plus help.** If a screen wants a third, it folds into the
  primary as a choice or goes down to the list. Do not "just fit it in".
- ⚠ **Icon-only secondaries are legal only where a coach met the label on a wider screen.** Import
  and Export qualify.
- ⚠ **The admin `ExportMenu` pins its trigger at 32px with `!important` at ≤760px**, which loses to
  the coach portal's 44px phone tap floor. This pass resolves that **for the coach portal only** —
  do not change the admin's convention.
- ⚠ **The Money hub keeps every panel mounted** (`display:none` while inactive) so a half-filled
  form survives a tab switch. Whatever you do to the panels' headers must not remount them.

## House rules that have bitten this repo before

- Branch `dev`. Stage **explicit pathspecs**; bracketed dirs need `":(literal)app/[orgSlug]/…"`.
  Commit only on explicit owner OK; use `git commit -F <file>` (PS5.1 mangles inline quotes).
  After every commit run `git show --stat HEAD` — other agents share this working copy.
- **Never `Get-Content | Set-Content` a source file** (ANSI mojibake). Use the Edit tool.
- `npm run check:layout -- --changed` needs the dev server up **and a warm root** — hit
  `http://localhost:3000/` once first; the reachability probe is 5s and a cold compile exceeds it.
  Shared-CSS diffs sweep all 29 screens (~15 min); run it in the background. **An aborted sweep is a
  failure, not a pass** — read the output, not the exit code through a pipe.
- **Measure, don't screenshot.** Playwright probes reading computed geometry at
  390 / 640 / 834 / 900 / 1024 / 1280 / 1440. The portal's sidebar makes card width non-monotonic in
  viewport width (2026-08-12 ruling), so one width proves nothing.
- New files and shared-module changes ⇒ **restart the dev server before handoff** (stop → delete
  `.next` → `npm run dev` → wait for Ready).
- After the build: `/simplify`, then `/review` (**high-risk** — shared chrome plus new export
  paths), fix confirmed findings, then `npm run typecheck` + `npm test` + `npm run verify:changed`.
- **`/docs`**: the in-app Money guide (`lib/help-content/coaches.tsx`, `premium-money`) describes
  where these buttons are. Same unit of work.
- **Demo check**: the coach sandbox (`riverdale-ridge`) has tour narration pointing at money
  screens. Grep the tour steps and the moments dock for any sentence naming a button that moves.
- Owner QA rides `OWNER_QA_LEDGER.md`; update `TODO.md` and the plan's status line with the commit
  anchor when done.

## Before you write code

Give the owner the **plain-language UX summary** required by `AGENCY_RULES.md` — what a coach sees
and does differently on each Money tab, desktop and phone, and what changes for a read-only money
assistant. That is a blocking step.

## Scope discipline

Phase 1 is the Money hub only. Roster, Schedule, Plan templates, Drills, Awards and Overview are
Phases 2–3 — leave them alone even where the same fault is visible. If Phase 1 runs long, the
**three new exports are the agreed cut line** (say so rather than trimming something else).
