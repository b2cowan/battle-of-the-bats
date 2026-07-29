# Coaches Portal — Focused Mobile Pass

**Status:** Conventions LOCKED 2026-06-29. **Phase 0 + Schedule + Roster + Overview + Accounting-exemplar BUILT on `dev` (uncommitted) 2026-06-29** — typecheck + focused-lint clean, NO migration, awaiting owner device verification + `/review`. Remaining: 4 other Accounting tables + Tournaments/Announcements/Documents/Settings audit.
**Companion brief:** `COACHES_PORTAL_MOBILE_PM_BRIEF.md`
**Surface:** Premium Coaches Portal — `app/[orgSlug]/coaches/**`, shared styles `app/[orgSlug]/coaches/coaches.module.css`.
**Conventions (binding):** see the 2026-06-29 "Coaches Portal mobile conventions" entry in `memory/design_decisions.md` — read it first; this plan executes it.

## Why
Desktop features were built first and mobile was deferred to "a pass at the end," which quietly accrued debt (Overview/Roster/Schedule mobile gaps). Owner decision 2026-06-29: do a **focused mobile pass now**, conventions-first, surface-by-surface; and fold "mobile" into definition-of-done for future sections so this doesn't recur. **Key reframe:** the portal is already partly mobile-built (see conventions entry), so this is **standardize breakpoints + fill a few real gaps + audit**, not build-from-scratch.

## Approach
1. **Phase 0 — shared primitives + breakpoint standardization** (do FIRST; everything else leans on it).
2. Then sweep **surface-by-surface in phone-priority order**, each a small diff using the primitives, browser-verified per surface.

## Phase 0 — Primitives & breakpoint cleanup (no behaviour change intended, pure consolidation)
- **Standardize breakpoints to two:** `900px` (shell only) + `640px` (all content reflow). Migrate existing `600px` (slide-over sheet) and `520px` (form-grid 1-col) rules to `640px`. Audit for any other stray breakpoints.
- Extract/ document 5 shared primitives (reuse existing CSS where it already exists):
  1. **`tableAsCards`** — the Roster `thead{display:none}` + `td::before{content:attr(data-label)}` reflow, generalized for any list-table.
  2. **`scrollX`** — overflow-x wrapper + right edge-fade + sticky-first-column option (generalize `.lineupTableWrap`).
  3. **`sheetOnMobile`** — bottom-sheet overlay modifier (generalize `.slideOverScrim`); usable by the event form modal too.
  4. **`stickyActionBar`** — safe-area sticky footer (`env(safe-area-inset-bottom)`), already used in 3 places.
  5. Documented breakpoint constants/comment so nobody re-invents 600/520.

## Surface sweep (priority order)
- [x] **Schedule** — Week → vertical day-stack @640 (CSS reflow of the 7-col grid); Month grid fits (≥40px cells, no change needed); slide-over sheet migrated 600→640 via `.sheetOnMobile`; tab strip wraps; **lineup grid** → sticky batting#/player columns (player offset driven by `--lineup-lead` so the mode-conditional Start column is handled) + "swipe across innings →" hint; **attendance** status/note controls bumped to 36px @640; **event form** opts into `.sheetOnMobile` (Save bar clears the home indicator), When/Where grids 1-col @640, Links rows stack @640, Home/Away seg full-width.
- [x] **Roster** — drag confirmed already disabled on touch (grip hidden in card mode); added mobile-only up/down reorder buttons (reuse the reorder endpoint, optimistic + revert) so reordering is possible on a phone; status toggle → ≥40px in the card footer.
- [x] **Overview** — AUDITED clean: snapshot `auto-fit` collapses to 1 col, single-col setup, no fixed widths or overflow sources. No changes.
- [~] **The rest** — Accounting **Dues** table → `.tableAsCards` (exemplar, done). REMAINING: expenses/allocations/budget-vs-actual/fundraiser-detail tables (currently controlled bordered scroll — not silent — convert to cards in a follow-up), and a pass over Tournaments/Announcements/Documents/Settings. **Chat: left as-is** (own mobile lock 2026-06-25).

## Schedule deep-dive (owner screenshot rounds, 2026-06-29 — all on `dev`, /review-passed)
The Schedule surface got an extended interactive polish pass beyond the original sweep, all browser-reviewed by the owner round-by-round and verified by a high-risk `/review` (7 real defects fixed, mostly in auto-save concurrency):
- **Bottom nav** rebuilt: Overview · Schedule · Chat · Roster + More (team switcher in More for 2+ teams; no "My Teams" tab).
- **Full-screen modals** (cover the nav, back-arrow, scroll-lock, trimmed side gutters).
- **Lineup**: per-game reorder (mobile ↑↓), Lineup⇄Playing-time toggle, 2×2 settings grid, sticky lead columns sized for double digits, on-screen popovers (mutual-exclusive + outside-tap/Esc close), Clear confirm.
- **Save model**: auto-save (no Save button) + Undo/Redo + flush-on-close + mid-save race guard; icon-only footer tools.
- **Attendance**: connected segmented status pill + one-row icon+count filters.
- **Event form**: name demoted to optional (bottom); event rows wrap to show opponent+score+result.
- **Season Record → Overview** (DONE — extracted to a shared component).

## Acceptance (per surface)
No horizontal page scroll at 360–414px width; all primary controls ≥40px (dense-grid controls ≥36); overlays are bottom-sheets; sticky bars clear the bottom nav + home indicator; wide data is either reflowed cards or sticky-col+affordance scroll (never silent sideways scroll). Owner does device verification per surface.

## Notes
- Pure-CSS where possible; week day-stack may need a small render branch on the schedule page.
- No migrations. After shared-module/structural changes, restart the dev server before handoff.
- `/design` for any new visual decision; `/review` after each surface's substantive changes.
