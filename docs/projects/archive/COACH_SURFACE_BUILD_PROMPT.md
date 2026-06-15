# Build prompt — Coach-Surface Design Pass, Slice 1 (paste into a new chat)

> This is a ready-to-paste prompt to start building the coach-surface design specs in a fresh session. Copy everything below the line. It starts with the cheapest, dependency-free slice (the design-only residual) and points at the two spec docs as the source of truth. (This file is a convenience artifact — not a plan; delete after use.)

---

Build **Slice 1 (the design-only residual)** of the Combined Coach-Surface Design/UX Pass. This is a normal code change on the coach surface — small, className/CSS-level, the cheapest and most dependency-free slice of the pass.

**READ FIRST (the spec is already written — build against it, don't re-design):**
- `docs/projects/archive/COACH_SURFACE_DESIGN_UX_PASS_FINDINGS.md` — the findings + per-state comps + route-back. **§9 (design-only residual)** is this slice's checklist; **§0** has three token rulings you must honour; **§7** has the 4 resolved owner decisions; **§10** has the build-order (this slice has NO dependency — it can land first).
- `docs/agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md` — the locked reusable rules (esp. **Section ii — button/chip hierarchy** for Rule CP-1 + the lifecycle-chip spec).

**LOCKED owner decisions (do not re-litigate):** standalone home stays **distinct** (identity band + strip; phase hero is tournament-only) · hero wash **18%** · `/coaches/join` button **migrates to `btn btn-lime`** · monogram **`--font-display`** at ≥52px.

**TOKEN RULINGS (critical — §0 of the findings doc):**
- `var(--text-secondary)` / `var(--text-tertiary)` are **REAL globals** (`globals.css:58-59,166-167`, = `--white-60`/`--white-40`). NOT ghost tokens. **Do not "fix" them** — no visual defect. (Migrating inline uses to `--white-N` is optional hygiene, not part of this slice.)
- `--text-2` / `--text-3` / `--text-muted` / `--surface-3` are **banned ghost tokens** (zero usages in the coach surface today — keep it that way).
- `--team-color` is a single colour value with **no `-rgb` twin** — tint via `color-mix(in srgb, var(--team-color, var(--logic-lime)) N%, transparent)`, never `rgba(var(--team-color-rgb), …)`.

**SLICE 1 SCOPE (the design-only residual — className/CSS only, no data/auth/API):**
1. `app/coaches/page.tsx:92` — "Claim team": `btn btn-outline btn-sm` → `btn btn-lime`, full-width, `margin-top: auto` (it's the most journey-critical button in the portal — J5-023; make it the loudest, per Rule CP-1).
2. `app/coaches/page.tsx:198` — "Express interest": `btn btn-outline btn-sm` → `btn-ghost btn-sm`.
3. `app/coaches/page.tsx:152` — "Explore the Coaches Portal" → standardize the verb to "Express interest" (one gated destination, one label — J2-029) and `btn-ghost btn-sm`.
4. Any other `btn-outline` inside the coach portal shell (`app/coaches/**`) → `btn-lime` (if it's the surface's one primary action) or `btn-ghost` (Rule CP-1 — `btn-outline` is banned in the portal). Grep first; confirm each before swapping.
5. Add the `.coachLifecycleChip` base + LIVE/UPCOMING/COMPLETE/FUTURE modifier classes (addendum Section ii table) to `coaches-portal.module.css` (or globals if the design system prefers) — **CSS only, no JS wiring this slice** (the tournament-list sort that uses them is phase5:ref(5h), a later slice).
6. The "Claim your team(s)" `sectionTitle` → `var(--logic-lime)` accent (it's the highest-priority section); leave other sectionTitles `--white-40`.

**OUT OF SCOPE for Slice 1** (later slices, per §10 build order): the `CoachEmptyState` component, the team-colour wash, the phase hero, the density reflow, the shell/nav fixes, the `/coaches/join` button migration (that's a coaches-a-e shell slice). Don't pull those forward.

**WORKFLOW / GOTCHAS:**
- Branch is `feat/free-tier-coaches` with **~132 uncommitted files** (Phases 5 + 6 in flight) — **commit only this slice's own files with targeted `git add`, never `-A`.** Don't touch the other uncommitted work.
- Per AGENCY_RULES: give a brief PM-UX summary before editing. Per CLAUDE.md: offer `/review` after the substantive change (it's a small diff, so the gate is cheap). The user does browser testing.
- CSS/className-only edits → **no dev-server restart needed** (hot reload covers it).
- After Slice 1 verifies, the recommended next slice is the **`CoachEmptyState` component** (the dependency gate — build once, then migrate the editor/tournament/BvA empties to it), then team-colour wash (Theme 4) → phase hero (Theme 1) → density (Theme 3) → shell/seam (coaches-a-e).
