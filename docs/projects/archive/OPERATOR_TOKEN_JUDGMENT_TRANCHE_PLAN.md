# Operator Token Debt — P3 Judgment Tranche — Execution Plan

**Status:** APPROVED, applying. Zero-visual-change refactor (one flagged bug-fix exception, owner-ratified).
**Prompt:** `OPERATOR_TOKEN_JUDGMENT_TRANCHE_PROMPT.md`. **Predecessor:** P2 mechanical sweep (`fadfb2ee`).
**Scope root/ratchet:** `node scripts/check-public-tokens.mjs --scope=operator`. Baseline before P3 = **365 literals / 55 files**.

## PM summary (plain language)
The operator UI (admin console, coaches portal, scorekeeper, internal staff console) holds 365 raw color
values in its stylesheets. This pass converts them into **named, reusable design tokens** — the exact same
colors on screen, but themeable and maintainable. **No user sees any change.** It's the last cleanup gate
before the warm coaches-portal can be built (that build needs these surfaces remappable, not hard-coded).
One deliberate exception: ~7 spots where "danger" text currently renders the wrong (inherited) color instead
of red get fixed as a side effect of finishing a half-built token — owner-ratified, flagged for verification.

## Owner decisions (ratified 2026-07-21)
1. **Strip dead fallbacks.** `var(--TOKEN, #hex)` where TOKEN is always defined → `var(--TOKEN)`. The hex never
   rendered; removing it is zero-change and deletes stale/misleading dead values.
2. **Finish the `--danger-light` / `--warning-light` convention.** Define both tokens. Consolidates ~30 danger +
   ~8 warning literals. Side effect (ratified): ~7 no-fallback `var(--danger-light)` sites that currently render
   an inherited color start rendering red as intended — a bug fix, flagged per-site for owner verification.

## New global tokens (app/globals.css) — every value == today's rendered pixel
Status-text-on-dark tier ("-light", completes the existing `--success/--warning/--danger/--info` + `-strong`):
- `--success-light: #4ade80`  (green-400)  — positive / income / success text & glyphs on dark
- `--warning-light: #fbbf24`  (amber-400)  — warning / pending / behind text on dark
- `--danger-light:  #f87171`  (red-400)    — danger / negative / error / logout text on dark  ← finishes convention
- `--info-light:    #60a5fa`  (blue-400)   — info / link / posted / entity-badge text on dark
Ink:
- `--on-lime: #0f1123`  — dark ink for text/glyphs on lime/gold/amber bright fills (wire into global `.btn-lime`)
Platform-admin console status palette (the -300 tier, internal staff console only):
- `--pa-pos: #86efac` · `--pa-neg: #fca5a5` · `--pa-info: #93c5fd` · `--pa-caution: #fcd34d`
Platform-admin console shared surfaces (near-blacks, ≥2 files each):
- `--pa-option-bg: #0a0f0a` (native <option> bg) · `--pa-preview-bg: #050705` (JSON/pre preview) · `--pa-confirm-bg: #060807` (confirm-modal)
- `--pa-option-text: #f8fafc` + `--pa-option-checked-bg: #2563eb` — the native-`<select>` option text + `:checked` highlight, shared by change-requests + plans-pricing. (PROMOTED to globals during the build to complete the option triad; supersedes the per-file-scope note that appears further down.)

## Application rules (uniform)
- **A — Strip inert fallback.** `var(--T, #hex)` → `var(--T)` for T ∈ {white, white-90, white-80, white-40,
  white-30, success, warning, danger, info, blueprint-blue, logic-lime, primary-light, bg-2, bg-3, hud-surface,
  surface-2}. All are unconditionally defined in `:root`. **DO NOT strip** `var(--danger-light, …)`,
  `var(--warning-light, …)`, `var(--fl-surface, …)` (special-cased below).
- **B — Global "-light" swap (bare literals).** `#f87171`→`var(--danger-light)`, `#4ade80`→`var(--success-light)`,
  `#fbbf24`→`var(--warning-light)`, `#60a5fa`→`var(--info-light)`. Applies in admin + coaches + accounting +
  the platform-admin `email` screen. **Exceptions (do NOT swap):** branding rainbow swatch, scorekeeper (→ `--sk-*`),
  DepthChartBoard (kept).
- **C — On-lime swap.** bare `#0f1123` → `var(--on-lime)`. **Exceptions:** branding light-preview mockup text
  (`.modePreviewLight …`, keep); drift siblings `#0b0f14`/`#0a0c12`/`#000` on lime are a DIFFERENT value → do NOT
  fold; scope or keep + flag.
- **D — Platform-admin -300 quad.** In `app/platform-admin/*` only: `#86efac`→`var(--pa-pos)`, `#fca5a5`→`var(--pa-neg)`,
  `#93c5fd`→`var(--pa-info)`, `#fcd34d`→`var(--pa-caution)`. (These shades are scoped/kept elsewhere: scorekeeper `--sk-red`, DepthChart `--never-fg`/`--okay-fg`.)
- **E — Platform-admin surfaces.** `#0a0f0a`→`var(--pa-option-bg)`, `#050705`→`var(--pa-preview-bg)`, `#060807`→`var(--pa-confirm-bg)`.
- **F — Scoped vars.** Per-file bespoke palettes (list below). Define once on the file's top/root selector, reference via var().
- **G — Keep + document.** Deliberate one-offs (list below). Add a one-line comment; value unchanged.
- **H — Flag only, no edit.** Drift/latent items (list below) recorded in the final report.

## Per-file scoped-var specs (rule F)
- `scorekeeper.module.css` → on `.page`: `--sk-ink #f8fafc`, `--sk-ink-dim #e2e8f0`, `--sk-ink-faint #cbd5e1`,
  `--sk-bg #172036`, `--sk-bg-deep #020617`, `--sk-amber #fbbf24`, `--sk-warm #fcd9a3`, `--sk-lime-tint #e6f5c4`, `--sk-red #fca5a5`.
  (Self-contained; the warm program remaps this separately — keep local, NOT the -light globals.)
- `accounting/accounting.module.css` → `--acct-violet #a78bfa` (typeBadgeTournament/linkedIndicator/typeTransfer),
  `--acct-panel-bg #1a1f2e` (.select option + .modal). Money/status → rule B globals.
- `accounting/budget/budget.module.css` + `accounting/budget-vs-actual/bva.module.css` → money/status via rule B.
  Bare `#f0f0f0` page titles (bva:28, budget:38) → keep + document (drift from the `var(--white-90)` heading
  convention; opaque vs alpha — cannot swap without a value change).
- `coaches/teams/[teamId]/accounting/budget-vs-actual/bva.module.css` → `--bva-unbudgeted #f97316` (unbudgeted section, ×3). Rest rule A/B.
- `coaches/teams/[teamId]/accounting/budget/budget.module.css` → `--budget-panel-bg #1a1f2e` (.modal). Rest rule A/B.
- `coaches/coaches.module.css` → `--tag-org-fg #a9bdf5` (×4), `--tag-org-active-bg #7aa2f7` (×1 line/2 props),
  `--tag-own-fg #c9e89a` (×1). `#f87171`→danger-light, `#0f1123`→on-lime, `#84cc16` inert fallbacks → rule A strip.
- `coaches/CoachesBottomNav.module.css` → `--nav-dropdown-bg #0d111a`. `#f87171`→danger-light; `#4fa3e0` inert fallbacks → strip.
- `admin/admin-common.module.css` → `--chip-pending #f6c453` (×2), `--chip-accepted #ccff66` (×2). `#60a5fa` inert fallbacks → strip.
- `admin/onboarding/onboarding.module.css` → `--onboarding-modal-bg #080b12` (×2), `--plan-badge-ok #86efac` (:1013),
  `--plan-error-text #fecaca` (:1078). `#4ade80` (live steps) → success-light. `#f0f0f0`/`#fff`/lime fallbacks → strip.
- `admin/tournaments/summary/summary.module.css` → `--modal-error-text #fecaca` (:477). `#0f1123`→on-lime.
- `components/admin/TournamentSetupWizard.module.css` → `--wizard-modal-bg #080b12` (:19), `--plan-error-text #fecaca` (:573).
  `#f0f0f0` fallbacks → strip.
- `admin/tournaments/registrations/teams-admin.module.css` → `--teams-select-bg #111111` (:865). `#f87171`→danger-light,
  `#fbbf24`→warning-light. **:1660** `var(--warning-light, #f59e0b)` → **`var(--warning)`** (PIN #F59E0B before the global is defined). `#f5f5f5`/`#1a1f2b` fallbacks → strip.
- `platform-admin/email/email.module.css` → `--email-modal-bg #0b0f14` (.modal/.previewFrame). `#4ade80`→success-light, `#f87171`→danger-light. `#93c5fd`→pa-info.
- `platform-admin/change-requests/change-requests.module.css` → `--changereq-modal-bg #07100b`, `--changereq-proposal-text #bfdbfe`,
  `--pa-option-text #f8fafc` + `--pa-option-checked-bg #2563eb` (the native-option pair — shared with plans-pricing; scope per-file). pa-quad via rule D.
- `platform-admin/plans-pricing/plans-pricing.module.css` → `--pa-option-text #f8fafc` + `--pa-option-checked-bg #2563eb` (same pair). pa-quad via rule D.
- `platform-admin/customer-users/customer-users.module.css` → `--cu-surface #1a1a1a` (replaces `var(--fl-surface,#1a1a1a)`; --fl-surface is a ghost token, undefined). pa-quad via rule D.
- `platform-admin/dev-tools/dev.module.css` → `--dev-debug #ffff00` (×10). pa-pos/pa-neg on readiness/log lines.
- `platform-admin/dev-tools/playbook.module.css` → `--dev-debug #ffff00` (all code/debug uses incl .accent-yellow).
  Keep the other 7 rainbow-legend accents as documented categorical (rule G).
- `platform-admin/bulk-operations/bulk-operations.module.css` → `--bulkops-badge-warn #fde68a` (:296 outlier amber). pa-quad rest.

## Keep + document (rule G)
- `staff-kit.module.css` #333/#ccc/#000 — `@media print` PDF ink.
- `branding.module.css` #f87171/#fb923c/#fcd34d/#4ade80/#60a5fa/#c084fc conic-gradient swatch (×2 lines) — decorative
  "pick a color" wheel (NOT semantic); #080B14/#F5F7FC/#0F1123 — light/dark theme-preview mockup, not app chrome.
- `playbook.module.css` 7 rainbow-legend accents (#60a5fa/#a78bfa/#fb923c/#22d3ee/#f472b6/#2dd4bf/#a3e635) — categorical legend.
- `house-league.module.css` #a78bfa (×2) — already-documented intentional purple ("no semantic token; intentional"); add comment to the 2nd use.
- `DepthChartBoard.module.css` #bef264/#93c5fd/#fca5a5 — pinned best/okay/never palette (design-audited 2026-07-02;
  TH-5 warm variant ratified separately). Already declared once on `.wrap`; leave as the definition point.

## Flag only — latent drift/bugs (rule H, no edits this tranche)
- **On-lime value drift:** `schedule-admin.module.css:908` `#0a0c12`, `dashboard.module.css:2000` `#0b0f14`,
  `users.module.css:352` `#000` — same "ink on lime" role, slightly different near-black than `--on-lime` (#0f1123). Normalize later.
- **`--danger-light` bug-fix sites (owner-ratified):** no-fallback `var(--danger-light)` at `TieBreakerEditor.module.css:81`,
  `CoinTossRecorder.module.css:86`, `import/TournamentTeamsImportDialog.module.css:192,339`, `divisions/page.tsx:549,598,657`
  currently render inherited color → will render red once `--danger-light` is defined. Verify each in-browser.
- **Stale mismatched dead fallbacks (removed by rule A, listed for the record):** `CheckInBoard:207` (blueprint-blue),
  `ExportMenu:93` (primary-light), `PersonaPanel:81` (info), `teams-admin:957` (surface-2), `email-templates:565` (hud-surface),
  `feedback:228,252` (danger), `members:209`/`settings:611,711,855` (bg-2), `venues-admin:226` (danger),
  `onboarding:396,713` (logic-lime), coaches lime/blueprint fallbacks — fallback value ≠ real token; all inert; stripped.
- **`#f6c453` vs `--gold` (#F5C451):** admin-common pending-chip is 1–2 units off gold; kept as `--chip-pending` (bespoke), flagged.
- **`email` screen tier mismatch:** uses -400 (`--danger-light`/`--success-light`) while its platform-admin siblings use the -300 `--pa-*` quad. Preserved as-is (zero-change); consider normalizing later.

## Verification
1. Adversarial verify per group (independent reviewers over the diff): value-identity + correct token + no comment/selector corruption + cascade reaches (scoped-var ancestor correct).
2. `node scripts/check-public-tokens.mjs --scope=operator --report` + ratchet; `--init` re-freeze at the new floor.
3. `npm run verify:changed` (+ typecheck if shared modules touched — globals.css is shared).
4. Owner browser spot-check, especially the flagged `--danger-light` bug-fix sites.
