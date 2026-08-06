# Build prompt — retire the last three hand-rolled dropdowns

> Paste this into a fresh chat, or point the new session at this file.
> Origin: Coach Onboarding Quiet Mode **Phase C0 remainder** — see
> `docs/projects/archive/COACH_ONBOARDING_QUIET_MODE_PLAN.md` §C0 and its `/simplify` finding 6.
> Owner approved this scope 2026-07-29, **after** coach-portal QA passed (deliberate ordering: this
> touches admin screens and shouldn't muddy that signal).

---

## The job

Three transient panels in the **tournament admin** bundle still hand-roll behaviour that now exists
as shared hooks. Retire the duplication.

**This is a maintenance job with essentially no user-visible change.** Say so plainly in your
summary — do not dress it up. The only behaviour a human can notice is the one you must not break
(see "The one thing that can regress").

---

## What already exists (read this first)

`components/coaches/overlay-hooks.ts` — built in Phase C0 against two real consumers (the
season-setup popover and the portal-tour drawer):

- `useDismissable(open, ref, onDismiss)` — outside pointer-down + Escape, listeners only while open,
  `onDismiss` held in a ref so an inline arrow doesn't churn listeners AND the latest closure always
  fires. **This one is ready to use as-is.**
- `useViewportFit(open, ref, margin?)` — nudges a panel CSS has already anchored, via
  `--panel-shift-x` / `--panel-max-h`. **This one is NOT sufficient here** — read its header
  comment, which says so explicitly.

---

## The three consumers, in ascending difficulty

### 1. `ToolbarStatusLegend` — `components/admin/tournament/TournamentAdminUI.tsx` (~line 459)
Dismiss only; the panel is CSS-positioned. **Direct `useDismissable` drop-in.** Delete its
hand-rolled effect. Lowest risk — do this one first and prove the pattern.

### 2. `ToolbarMenu` — same file (~line 230)
Dismiss **plus** trigger-anchored `position: fixed` placement with an **above/below flip**, and an
`align: 'start' | 'end'` option.

### 3. `ExportMenu` — `components/admin/ExportMenu.tsx` (~line 133)
Dismiss **plus** the *same* placement algorithm as #2. Diff against #2 before writing anything —
they are near-identical: ~85 duplicated lines. The only real differences are the minimum width
(220 vs 240) and that ExportMenu always right-aligns.

---

## The shape of the fix

**Two hooks, not one.** `useDismissable` covers all three. Add a NEW hook — suggested
`useAnchoredMenu(open, triggerRef, panelRef, opts)` returning the `CSSProperties` both #2 and #3
currently compute — parameterised by `minWidth` and `align`. It must reproduce, exactly:

- pin below the trigger (`bottom + 6`), clamped into the viewport horizontally with a 12px margin;
- **flip above** when the space below is less than `min(panelHeight, 160)` AND there is more room
  above;
- fall back to a full-height scrolling panel at the top margin when neither side fits;
- `requestAnimationFrame` on open, plus `resize` and capture-phase `scroll` listeners.

Both existing copies already do all of this. **Diff them and preserve the union of their behaviour**
— do not "improve" the algorithm in the same pass.

---

## Hard constraints

**Relocate the hooks first — this is the part that was blocking.** They currently live under
`components/coaches/`, and admin importing from a coach-portal folder is the wrong dependency
direction. Move them to a shell-neutral home (e.g. `lib/` or `components/shared/`) as a **rename-only
commit** with the coach-side imports updated, verified green, *before* touching any admin file. The
absence of a neutral home is precisely why the Phase A review deferred this twice — solve it
explicitly rather than working around it.

**Do not change any menu's appearance, contents, ordering, labels, or keyboard behaviour.** If the
diff contains a styling change, you have gone out of scope.

**Accessibility must be preserved verbatim** — `aria-haspopup`, `aria-expanded`, `role="menu"` /
`role="dialog"`, `aria-label`, and the `data-keep-label` behaviour on `ToolbarMenu`.

**Styling.** Custom CSS modules only. **No raw hex or brand `rgba()`** — every CSS baseline is at a
zero ratchet and `verify:changed` will fail you.

---

## The one thing that can regress

**The above/below flip.** It is the single behaviour a careless consolidation drops, and it is
invisible until someone opens a menu near the bottom of a window. Preserve it, and make it the
headline of the QA list you hand back.

---

## Process expected in this repo

- **Present a plain-language PM summary before writing code** (blocking, per `AGENCY_RULES.md`) —
  and lead with the fact that this is invisible to users.
- Work on **`dev`**. Never `master`. Stage explicit pathspecs only; use `:(literal)` for
  `[tournamentId]`-style paths, since brackets are glob syntax.
- **Never commit without explicit per-action approval from the owner.**
- ⚠ **Concurrent sessions share this working copy.** Re-check `git rev-parse --abbrev-ref HEAD`
  before committing and `git show --stat HEAD` after. During Quiet Mode, two separate sessions swept
  each other's uncommitted work into their commits — check for foreign hunks in files you touch
  before staging, not after.
- Verification: `npm run verify:changed`, `npm run lint:focused -- <files>`, and
  **`npm run typecheck` is required** — you are moving a shared module.
- The owner does all browser testing. No migration in this work.
- Update `TODO.md` (one line, linking the plan) and log the outcome in the Quiet Mode plan's §C0 so
  the parked follow-up is visibly closed.
- Offer `/simplify` then `/review` before treating it as done.

---

## Definition of done

1. All three panels use the shared hooks; zero hand-rolled outside-click/Escape/positioning code
   remains in `ExportMenu` or `TournamentAdminUI`.
2. The hooks live in a shell-neutral home, and no admin file imports from `components/coaches/`.
3. The above/below flip still works in all three, verified by the owner near a window's bottom edge.
4. No visual, textual, or a11y change anywhere.
5. Gate green: `verify:changed`, focused lint, `typecheck`, tests, all token baselines at zero.

---

## Out of scope

- The coach-portal consumers (season-setup popover, portal tour) — already done, don't revisit.
- `components/admin/BottomSheet.tsx` and `components/help/HelpDrawer.tsx` — those are full **modals**
  (portal + backdrop + scroll-lock + focus trap). They correctly do NOT reduce to these hooks.
  Leave them.
- Any behavioural improvement to the menus themselves.
